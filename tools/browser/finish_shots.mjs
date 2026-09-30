// 마무리 찌르기 확인 (src/skill.js thrust → plungePose, src/finish.js plunge): 실제 게임 화면(844×390 가로 폰, 터치)에서
//  상대를 강제로 쓰러뜨리고(window.game — 시험 전용 주소 값 없음) 누운 몸통이 약 1.5m 앞에 오게 걸어간 뒤 칼 쪽 화면을 한 번 톡 친다.
//  찍는 순간: 탭 직전 · 겨눔(내리찌르기를 시작하는 프레임) · 칼이 누운 몸에 처음 닿은 프레임 · 그 뒤
//  확인하는 것: 콘솔 에러 0, 탭이 마무리 찌르기(tap.down)였나, 걸음을 부탁했나·그 발이 디뎠나, 접촉 판정(찌르기/베기/둔기)·에너지·상처
//  시간은 playwright 가짜 시계로 한 프레임(1/60초)씩 돌린다 (느린 소프트웨어 렌더링에서도 같은 순간이 찍힌다)
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/finish_shots.mjs http://127.0.0.1:5173 <출력 폴더> [거리 m = 1.5]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '.';
const DIST = +(process.argv[4] || 1.5);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
await page.clock.install({ time: new Date('2026-09-30T12:00:00') });
await page.clock.pauseAt(new Date('2026-09-30T12:00:01'));
await page.goto(`${base}/?weapon=longsword`, { waitUntil: 'networkidle' });
for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
await page.clock.runFor(200);
await page.evaluate(() => document.getElementById('btnStart').click());
const run = (ms) => page.clock.runFor(ms);
const shot = async (name) => {
  const file = path.join(out, `${name}.png`);
  fs.writeFileSync(file, await page.screenshot());
  return file;
};
// 내 가슴에서 상대 몸통(가슴·배·골반) 가장 가까운 곳까지 수평 거리 (tools/sim/down_hits.mjs torsoDist)
const dist = () =>
  page.evaluate(() => {
    const g = window.game;
    const c = g.player.bodies.chest.translation();
    let m = Infinity;
    for (const k of ['chest', 'abdomen', 'pelvis']) {
      const p = g.enemy.bodies[k]?.translation();
      if (p) m = Math.min(m, Math.hypot(p.x - c.x, p.z - c.z));
    }
    return m;
  });
await run(2600); // 판 시작 정지(ARENA.startHold) 지나기
// 상대를 쓰러뜨려 일어나지 못하게, AI 는 멈춤. 접촉 기록 (플레이어 칼 → 상대 몸)
await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {};
  g.enemy.knockDown(true);
  g.enemy.downTime = 1e9;
  const C = g.combat;
  const orig = C.strike.bind(C);
  window.__hits = [];
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (pr.w.fighter === g.player && pr.v?.fighter === g.enemy && r) window.__hits.push({ part: pr.v.part, type: r.type, energy: +r.energy.toFixed(1), thr: r.thr, sev: +r.severity.toFixed(3) });
    return r;
  };
});
await run(2500);
// 누운 몸통까지 DIST 가 되게 걷는다: 걷는 입력을 이 시험 동안만 줄여(W 키 × 0.3) 천천히 다가가고, 닿으면 놓고 멈춰 선 뒤 잰다
await page.evaluate(() => {
  const mv = window.game.player.move;
  const set = mv.set.bind(mv);
  window.__walk = 0.3;
  mv.set = (x, y) => set(x * window.__walk, y * window.__walk);
});
const before = await dist();
let d = before;
for (let i = 0; i < 4 && Math.abs(d - DIST) > 0.08; i++) {
  const key = d > DIST ? 'KeyW' : 'KeyS';
  await page.keyboard.down(key);
  for (let t = 0; t < 6000; t += 51) {
    await run(51);
    d = await dist();
    if (key === 'KeyW' ? d <= DIST + 0.04 : d >= DIST - 0.04) break;
  }
  await page.keyboard.up(key);
  await run(600);
  d = await dist();
}
await page.evaluate(() => (window.__walk = 1));
await run(400);
d = await dist();
const pre = await page.evaluate(() => ({ fin: window.game.player.finish.on, amt: +window.game.player.finish.amt.toFixed(2), short: +window.game.player.finish.plunge.short.toFixed(3), steep: window.game.player.finish.plunge.steep }));
const files = [await shot('finish_0_before_tap')];
const n0 = await page.evaluate(() => window.game.player.skill.thrusts);
await page.touchscreen.tap(844 * 0.72, 390 * 0.42); // 칼 쪽(오른쪽) 화면을 한 번 톡
const rec = { tap: null, go: null, hit: null };
let hover = false;
let hitShot = false;
for (let t = 0; t < 3000; t += 17) {
  await run(17);
  const s = await page.evaluate(() => {
    const p = window.game.player;
    const tp = p.skill.tap;
    const G = p.gait;
    return { thrusts: p.skill.thrusts, down: !!tp?.down, wait: tp ? (tp.wait === undefined ? 'none' : tp.wait ? 'waiting' : 'done') : null, go: !!tp?.go, w: +p.skill.thrustPose.w.toFixed(2), push: p.skill.thrustPush, lastTD: G?.lastTD, sinceTD: G ? +G.sinceTD.toFixed(3) : null, hits: window.__hits.length };
  });
  if (!rec.tap && s.thrusts > n0) rec.tap = { t, down: s.down, wait: s.wait };
  if (rec.tap && !hover && s.go) {
    hover = true;
    rec.go = { t, ...s };
    files.push(await shot('finish_1_hover'));
  }
  if (s.hits > 0 && !hitShot) {
    hitShot = true;
    rec.hit = { t, ...s };
    files.push(await shot('finish_2_contact'));
  }
  if (hitShot && t > (rec.hit?.t ?? 0) + 250) break;
  if (rec.tap && !s.down && s.wait === null && t > 1500) break;
}
files.push(await shot('finish_3_after'));
const result = await page.evaluate(() => ({ hits: window.__hits.slice(0, 4), wounds: window.game.enemy.wounds?.length ?? null, enemy: window.game.enemy.state, player: window.game.player.state }));
console.log(JSON.stringify({ startDist: +before.toFixed(2), tapDist: +d.toFixed(2), pre, rec, result, files }, null, 1));
console.log(errors.length ? `콘솔 에러 ${errors.length}:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
process.exit(errors.length ? 1 : 0);
