// 플레이어 비기 경직 멈춤 (사장님 10/10 20:5x '손 빠르기 줄이지 말고 잠깐 아예 못 움직이게' — docs/strike/secret_stiff_2026-10-10.md) 브라우저 확인:
//  싸움을 띄우고 비기 창을 열어(저절로 안 열리면 직접 — player_secret_shots.mjs 와 같은 길) 톡으로 비기를 낸 뒤, 경직(stage 'stiff')에 들면
//  스틱(키보드 W·D 누름)·칼 쪽 끌기(손가락 pointermove)·톡을 넣는다. 경직 동안 걸러진 손 목표(skill.aim)·손 목표(handOffset)가 경직이 시작된 자리에서
//  움직였는지, 스틱이 몸에 들어갔는지(player.move) 잰다. 경직이 끝난 뒤 같은 입력을 다시 넣어 조작이 다시 듣는지(대조)도 잰다.
//  실행: npx vite build && npx vite preview --port 4173 --strictPort &
//        node tools/browser/player_stiff_freeze.mjs http://127.0.0.1:4173 <PNG 폴더> [무기 id (기본 longsword)]
//  소프트웨어 GL 은 느리다(벽 10 s ≈ 게임 1~2 s). 끝 코드 0 = 경직 동안 손 목표·스틱 모두 안 움직임 + 경직 뒤 조작이 다시 들음
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shotDir = process.argv[3] || '.';
const weapon = process.argv[4] || 'longsword';
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${base}/?weapon=${weapon}&foeWeapon=longsword`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
const probe = () =>
  page.evaluate(() => {
    const g = window.game;
    const p = g.player;
    const pl = p.bodies.pelvis.translation();
    return {
      sim: +g.stats.simTime.toFixed(3),
      state: g.state,
      open: !!g.playerSecret?.open,
      stage: p.skill.sec?.stage ?? null,
      aim: [p.skill.aim.x, p.skill.aim.y],
      off: [p.handOffset.x, p.handOffset.y],
      move: [p.move.x, p.move.y],
      pel: [pl.x, pl.z],
      d: +p.foeDistance().toFixed(2),
      reach: p.swordArt.measure.reach,
      when: [].concat(g.playerSecret.S?.when ?? []),
      S: g.playerSecret.S?.name ?? null,
    };
  });
const tap = (x = 620, y = 210) =>
  page.evaluate(
    async ([x, y]) => {
      const cv = document.getElementById('game');
      const o = { pointerId: 77, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 };
      cv.dispatchEvent(new PointerEvent('pointerdown', o));
      await new Promise((r) => setTimeout(r, 40));
      cv.dispatchEvent(new PointerEvent('pointerup', o));
    },
    [x, y],
  );
// 칼 쪽 끌기: 손가락을 대고 dx·dy px 씩 n 번 움직였다 뗀다 (한 번에 30 ms)
const drag = (n = 12, dx = 14, dy = -8) =>
  page.evaluate(
    async ([n, dx, dy]) => {
      const cv = document.getElementById('game');
      let x = 600, y = 230;
      const o = () => ({ pointerId: 78, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
      cv.dispatchEvent(new PointerEvent('pointerdown', o()));
      for (let i = 0; i < n; i++) {
        x += dx;
        y += dy;
        window.dispatchEvent(new PointerEvent('pointermove', o()));
        await new Promise((r) => setTimeout(r, 30));
      }
      window.dispatchEvent(new PointerEvent('pointerup', o()));
    },
    [n, dx, dy],
  );
let r = await probe();
console.log(`WEAPON ${weapon} secret ${r.S}`);
// ① 창 열기 → 톡으로 비기
const t1 = Date.now();
const near = r.when.includes('combo') || r.when.includes('firstHit') ? r.reach + 0.1 : 2.4;
while (r.d > near && Date.now() - t1 < 60000 && r.state === 'fight') {
  await page.waitForTimeout(150);
  r = await probe();
}
await page.evaluate(() => {
  const ps = window.game.playerSecret;
  if (!ps.open) ps.openWindow(null);
  if (ps.open) ps.open.t = 5;
});
await tap();
// ② 경직을 기다린다
const t2 = Date.now();
const stages = [];
while (Date.now() - t2 < 90000) {
  r = await probe();
  if (stages[stages.length - 1] !== r.stage) stages.push(r.stage);
  if (r.stage === 'stiff' || (stages.length > 1 && r.stage === null)) break;
  await page.waitForTimeout(30);
}
console.log('STAGES ' + JSON.stringify(stages));
if (r.stage !== 'stiff') {
  console.log('NO_STIFF ' + JSON.stringify(r));
  console.log('ERRORS ' + JSON.stringify(errors));
  await browser.close();
  process.exit(1);
}
// ③ 경직 동안 입력: 스틱(W·D) 누른 채 끌기·톡
const s0 = r;
await page.screenshot({ path: `${shotDir}/player_stiff_${weapon}_1_start.png` });
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyD');
const dragP = drag();
const dev = { aim: 0, off: 0, move: 0, pel: 0, n: 0 };
let tapped = false;
let last = s0;
while (true) {
  r = await probe();
  if (r.stage !== 'stiff') break;
  last = r;
  dev.n++;
  dev.aim = Math.max(dev.aim, Math.hypot(r.aim[0] - s0.aim[0], r.aim[1] - s0.aim[1]));
  dev.off = Math.max(dev.off, Math.hypot(r.off[0] - s0.off[0], r.off[1] - s0.off[1]));
  dev.move = Math.max(dev.move, Math.hypot(r.move[0], r.move[1]));
  dev.pel = Math.max(dev.pel, Math.hypot(r.pel[0] - s0.pel[0], r.pel[1] - s0.pel[1]));
  if (!tapped && dev.n > 3) {
    tapped = true;
    await tap(640, 200);
  }
  await page.waitForTimeout(25);
}
await dragP;
await page.screenshot({ path: `${shotDir}/player_stiff_${weapon}_2_after.png` });
console.log(`STIFF sim ${s0.sim} → ${last.sim} (${(last.sim - s0.sim).toFixed(2)} s, 표본 ${dev.n}) · aim 최대 움직임 ${dev.aim.toFixed(5)} · handOffset ${dev.off.toFixed(5)} · 스틱(player.move) 최대 ${dev.move.toFixed(3)} · 골반 수평 이동 ${dev.pel.toFixed(3)} m`);
// ④ 대조: 경직이 끝난 뒤 같은 입력 (W·D 는 아직 누른 채) → 손 목표·스틱이 다시 듣나
await page.waitForTimeout(200);
const c0 = await probe();
await drag();
await page.waitForTimeout(300);
const c1 = await probe();
await page.keyboard.up('KeyW');
await page.keyboard.up('KeyD');
const ctl = { off: Math.hypot(c1.off[0] - c0.off[0], c1.off[1] - c0.off[1]), move: Math.hypot(c1.move[0], c1.move[1]), stage: c1.stage };
console.log(`AFTER 경직 뒤 끌기 → handOffset ${ctl.off.toFixed(3)} · 스틱(player.move) ${ctl.move.toFixed(3)} · 단계 ${ctl.stage}`);
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
const ok = dev.n > 0 && dev.aim < 1e-6 && dev.off < 1e-6 && dev.move === 0 && ctl.off > 0.01 && ctl.move > 0.5 && !errors.length;
console.log(ok ? 'OK' : 'FAIL');
process.exit(ok ? 0 : 1);
