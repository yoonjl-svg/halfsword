// 몬탄테 쥠 넓힘 (10/10 사장님 '쥠은 고증대로 넓혀' — weapons.js 츠바이핸더 자루·폼멜·gripAlong) 캡처: 츠바이핸더 AI 의
//  쥔 손 가까이(칼자루 옆 0.75 m) · 대기(간 보기, 옆) · 베기 한가운데(옆). 콘솔 에러 0.
//  docs/handoff/montante_grip_{before,after}_{hands,guard,cut}.png (PREFIX 로 앞 이름 — 전/후 비교용)
//  대기 = 간 보기 2.5 s 뒤 빈손이 칼자루를 쥔(gripping) 때, 베기 = 공격 'strike' 들어서 STRIKE_MS 뒤
//  실행: npx vite build && npx vite preview --port 4193 --strictPort &
//        PREFIX=montante_grip_after node tools/browser/montante_grip_shots.mjs http://127.0.0.1:4193 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4193';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'montante_grip';
const STRIKE_MS = +(process.env.STRIKE_MS || 120);
const WAIT = +(process.env.WAIT_MS || 300000);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${base}/?weapon=longsword&foeWeapon=zweihander`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
await page.evaluate(() => {
  document.getElementById('techCue').style.visibility = 'hidden';
  window.game.player.applyWound = () => {}; // 시험만: 캡처가 끝날 때까지 둘 다 죽지 않게
  window.game.enemy.applyWound = () => {};
});
const probe = () =>
  page.evaluate(() => {
    const g = window.game;
    const f = g.enemy, ai = g.ai;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, mode: ai?.mode ?? null, phase: ai?.phase ?? null, guard: ai?.guard?.name ?? null, tech: ai?.tech?.name ?? null, gripping: !!f.gripping, gripAlong: f.weaponCfg.gripAlong };
  });
const shot = async (view, path) => {
  await page.evaluate((view) => {
    const g = window.game;
    const f = g.enemy, o = g.player;
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx;
    const s = f.side; // 칼 든 쪽에서
    g.freeCam = true;
    if (view === 'hands') {
      const h = f.sword.translation(); // 칼 원점 = 오른손
      const R = 0.75;
      g.camera.position.set(h.x + rx * s * R + fx * 0.15, h.y + 0.12, h.z + rz * s * R + fz * 0.15);
      g.camera.lookAt(h.x, h.y - 0.08, h.z);
    } else {
      const R = 2.6;
      g.camera.position.set(b.x + rx * s * R, 1.35, b.z + rz * s * R);
      g.camera.lookAt(b.x, 1.15, b.z);
    }
  }, view);
  await page.waitForTimeout(150);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const freeze = (on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
async function waitFor(pred, ms, step = 40) {
  const t0 = Date.now();
  let r = await probe();
  while (!pred(r) && Date.now() - t0 < ms && (r.state === 'fight' || r.state === 'paused')) {
    await page.waitForTimeout(step);
    r = await probe();
  }
  return r;
}
let r = await waitFor((x) => x.sim > 2.5 && x.mode === 'watch' && x.gripping, WAIT);
await freeze(true);
await shot('hands', `${dir}/${PREFIX}_hands.png`);
await shot('guard', `${dir}/${PREFIX}_guard.png`);
await freeze(false);
out.guard = r;
r = await waitFor((x) => x.mode === 'attack' && x.phase === 'strike', WAIT, 15);
await page.waitForTimeout(STRIKE_MS);
r = await probe();
await freeze(true);
await shot('cut', `${dir}/${PREFIX}_cut.png`);
await freeze(false);
out.cut = r;
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
