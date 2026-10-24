// AI 모르트슐라크 화면 확인 (10/24 사장님 'ai도 비기 쓰게 해' — src/ai.js mordTick · docs/strike/german_mordschlag_2026-10-22.md §12)
//  실제 게임 화면(844×390 가로 폰 · 성 안뜰)에서 아르토리아(숙련도 5 · 독일)가 몸을 붙여 밀고(누르기 1.5 s) → 창 → 모르트슐라크(칼날을 거꾸로 쥐고 칼자루로 머리)까지.
//  플레이어는 입력 없음(제자리 · 기본 자세). 아르토리아가 간 보는 거리(가슴 2 m 안)에 오면 '몸 붙이기' 굴림(ai.js mordPressGo — 인물 밀치기 확률)을 이긴 것으로 둔다(press.go — 그 뒤는 게임 그대로).
//  시간은 playwright 가짜 시계로 한 프레임(1/60 s)씩 (mordschlag_shots.mjs 와 같은 틀). 찍는 것: 이름 붙은 순간의 게임 카메라 · 옆 카메라 PNG + 순간마다 JSON · 콘솔 오류 수.
//  실행: npx vite build --outDir <임시>/dist && npx vite preview --outDir <임시>/dist --port 5503 --strictPort &   (끝나면 그 PID 만 끈다)
//        node tools/browser/mordschlag_ai_shots.mjs http://127.0.0.1:5503 docs/handoff/mordschlag_ai [무대=castle]
//  playwright 는 저장소 의존성에 없다(/home/user/halfsword/node_modules 에 있음). 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5503').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/mordschlag_ai';
const stage = process.argv[4] || 'castle';
const FRAME = 17;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.clock.install({ time: new Date('2026-10-24T12:00:00') });
await page.clock.pauseAt(new Date('2026-10-24T12:00:01'));
await page.goto(`${base}/?foe=artoria&stage=${stage}&weapon=longsword`, { waitUntil: 'networkidle' });
for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
await page.clock.runFor(200);
await page.evaluate(() => {
  const b = document.getElementById('btnStart');
  if (b) b.click();
});
for (let i = 0; i < 200 && !(await page.evaluate(() => window.game?.state === 'fight' && !!window.game.ai)); i++) {
  await page.clock.runFor(100);
  if (i === 20) await page.getByText('여정 시작').click({ timeout: 2000 }).catch(() => {});
}
const info = await page.evaluate(() => {
  const g = window.game;
  const ai = g.ai;
  window.__rec = () => {
    const P = g.player, E = g.enemy, A = g.ai;
    const r3 = (v) => +(+v).toFixed(3);
    return {
      t: r3(E.fightT ?? 0), d: r3(E.foeDistance()), reach: r3(g.config.CLOSE.reach(E.weapon)),
      barge: E.barge?.phase ?? null, bargeEnd: E.bargeEnd ?? null, pressT: r3(A.press?.pressT ?? 0), win: r3(A.press?.win ?? 0), wins: A.press?.wins ?? 0, go: !!A.press?.go,
      mode: A.mode, run: A.secretRun?.stage ?? null, sec: E.skill.sec?.stage ?? null, grip: E.mordGrip ? r3(E.mordGrip.g) : null,
      cue: document.getElementById('techCue')?.textContent ?? document.querySelector('.tech-cue')?.textContent ?? null,
      foe: P.state, pPain: r3(P.pain), pCons: r3(P.consciousness), fired: A.stats.secrets?.mordschlag?.fired ?? 0,
    };
  };
  return { foe: g.enemy?.weapon?.id, secret: ai?.secret?.name ?? null, prof: ai?.proficiency, press: !!ai?.press, close: ai?.persona?.close ?? null };
});
console.log(JSON.stringify(info));
const frames = [];
const frame = async () => {
  await page.clock.runFor(FRAME);
  const r = await page.evaluate(() => window.__rec());
  r.errors = errors.length;
  frames.push(r);
  return r;
};
let nShot = 0;
const shots = [];
const shot = async (name, r) => {
  nShot++;
  const stem = `${String(nShot).padStart(2, '0')}_${name}`;
  fs.writeFileSync(path.join(out, `${stem}.png`), await page.screenshot());
  await page.evaluate(() => {
    const g = window.game, T = g.THREE;
    const a = g.player.pelvisPos, b = g.enemy.pelvisPos;
    const m = new T.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const d = new T.Vector3().subVectors(b, a).setY(0).normalize();
    const side = new T.Vector3(-d.z, 0, d.x);
    if (m.clone().addScaledVector(side, 2.6).setY(0).length() > 6.3) side.negate();
    g.__cam = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
    g.freeCam = true;
    g.camera.position.copy(m).addScaledVector(side, 2.6).setY(1.35);
    g.camera.lookAt(m.x, 1.1, m.z);
  });
  await page.clock.runFor(FRAME);
  fs.writeFileSync(path.join(out, `${stem}_side.png`), await page.screenshot());
  await page.evaluate(() => {
    const g = window.game;
    g.camera.position.copy(g.__cam.p);
    g.camera.quaternion.copy(g.__cam.q);
    g.freeCam = false;
  });
  const rr = await frame();
  shots.push({ name, at: r, after: rr });
};
const until = async (fn, maxS) => {
  let r = frames[frames.length - 1] ?? (await frame());
  for (let t = 0; t < maxS && !fn(r); t += FRAME / 1000) r = await frame();
  return r;
};

let r = await until((x) => x.t >= 2.05, 5); // 판 시작 정지
let tries = 0;
for (; tries < 6 && !r.fired; tries++) {
  // 몸 붙이기 굴림을 이긴 것으로 (간 보기 · 닿는 거리 밖이면 걸어 들어가 밀치기 → 누르기 — 그 뒤는 게임 그대로)
  r = await until((x) => x.mode === 'watch' && !x.run && x.d < 2, 10); // 간 보는 거리까지 다가온 뒤 (판 시작 간격은 5 m 넘음 — 칠 거리 밖이면 붙이기가 곧장 풀림)
  await page.evaluate(() => { const A = window.game.ai; if (A.press && !A.press.go) { A.press.go = true; A.press.goWhy = 'shot'; } });
  r = await frame(); // 고친 뒤의 순간부터 본다
  r = await until((x) => x.barge === 'press' || !x.go, 6);
  if (r.barge === 'press' && !shots.some((s) => s.name === 'press')) await shot('press', r);
  r = await until((x) => x.wins > 0 || x.fired > 0 || (!x.go && !x.barge), 4);
  if (r.wins > 0 && !shots.some((s) => s.name === 'window')) await shot('window', r);
  r = await until((x) => x.fired > 0 || x.win <= 0, 1);
}
const seen = new Set();
for (let t = 0; t < 3 && (r.sec || t < 0.2); t += FRAME / 1000) {
  r = await frame();
  if (r.sec && !seen.has(r.sec)) {
    seen.add(r.sec);
    await shot(r.sec, r);
  }
}
r = await until((x) => !x.sec, 2);
await shot('after', r);
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ info, tries, shots, errors, last: r }, null, 1));
console.log(JSON.stringify({ tries, fired: r.fired, wins: r.wins, stages: [...seen], foe: r.foe, pPain: r.pPain, pCons: r.pCons, errors: errors.length, shots: shots.map((s) => s.name) }));
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
await browser.close();
