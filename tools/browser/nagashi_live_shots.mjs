// 흘려 받기 실전 장면 찍기 (10/17 — docs/strike/ukenagashi_talho_2026-10-17.md §12). 읽기만 · 찍기만.
//  플레이어 = 우치가타나(일본 막기 책 — &uniqueStage=2) · 화면의 막기 단추(#btnParry)를 진짜 포인터로 누른 채 서 있고(맞아도 다치지 않게), 상대 AI 는 제 판단대로 친다.
//  흘려 받기(combat.js nagashi)가 처음 걸린 순간 · +OFFS 초를 옆에서 찍는다(KeyP 멈춤 · ?tempo=0.5). 그동안 칼끼리 새로 닿은 수 · 흘림 수를 센다(FIRST 줄).
//   FOE=<인물 — 기본 heinrich(보통)> SIM=<최대 초> MODE=on|off(흘려 받기 켬·끔) OFFS=0,0.06,0.12,0.2 SIDE=1|-1(카메라 쪽)
//   npx vite build && npx vite preview --port 4193 --strictPort &   node tools/browser/nagashi_live_shots.mjs http://127.0.0.1:4193 <폴더>
//  내놓는 것: <폴더>/live_<MODE>_<n>.png · 콘솔 FIRST · SHOT · ERRORS
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4193';
const dir = process.argv[3] || '.';
const MODE = process.env.MODE || 'on';
const SIM = +(process.env.SIM || 90);
const OFFS = (process.env.OFFS || '0,0.06,0.12,0.2').split(',').map(Number);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?weapon=uchigatana&foe=${process.env.FOE || 'heinrich'}&foeWeapon=longsword&slowMo=0&uniqueStage=2&tempo=${process.env.TEMPO || '0.5'}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerGuard, null, { timeout: 60000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
await page.evaluate((MODE) => {
  const g = window.game;
  g.config.NAGASHI.on = MODE === 'on' ? 1 : 0;
  g.player.applyWound = () => {};
  for (const id of ['techCue', 'toast', 'foeIntro', 'hint', 'moveStick', 'guardName', 'staminaHud', 'stageInfo', 'topButtons']) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  }
  const b = document.getElementById('btnParry');
  const r = b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, isPrimary: true, button: 0 }));
  b.style.visibility = 'hidden';
  const R = (window.__fl = { t0: g.stats.simTime, fresh: 0, nag: 0, flowT: null, info: null });
  const prev = g.combat.hooks.onClash;
  g.combat.hooks.onClash = (point, sp, info) => {
    prev?.(point, sp, info);
    if (info.fresh) R.fresh++;
    if (info.nagashi) {
      R.nag++;
      if (R.flowT == null) {
        R.flowT = g.stats.simTime;
        R.info = { vn: +info.vn.toFixed(2), guard: g.playerGuard.mode + ':' + g.playerGuard.line, cw: +(g.player.skill._cover?.w ?? 0).toFixed(2), d: +g.player.foeDistance().toFixed(2) };
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      }
    }
  };
}, MODE);
const freeze = (on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
const shoot = async (k) => {
  const info = await page.evaluate(() => {
    const g = window.game, f = g.player, o = g.enemy;
    document.getElementById('menu').style.visibility = 'hidden';
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const s = +(window.__side ?? 1), rx = -fz * s, rz = fx * s, R = 3.2;
    g.freeCam = true;
    g.camera.position.set(mx + rx * R, 1.5, mz + rz * R);
    g.camera.lookAt(mx, 1.3, mz);
    return { t: +(g.stats.simTime - window.__fl.flowT).toFixed(3), guard: g.playerGuard.mode + ':' + g.playerGuard.line, cw: +(f.skill._cover?.w ?? 0).toFixed(2) };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/live_${MODE}_${k}.png` });
  console.log(`SHOT ${k} ${JSON.stringify(info)}`);
};
await page.waitForFunction((SIM) => window.__fl.flowT != null || window.game.stats.simTime - window.__fl.t0 > SIM || window.game.state !== 'fight' && window.game.state !== 'paused', SIM, { timeout: 600000, polling: 20 });
const R = await page.evaluate(() => ({ ...window.__fl, now: window.game.stats.simTime }));
console.log('FIRST', JSON.stringify(R));
if (R.flowT != null) {
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 10000, polling: 5 });
  await page.evaluate((s) => (window.__side = s), +(process.env.SIDE || 1));
  await shoot(0);
  for (let i = 1; i < OFFS.length; i++) {
    await page.evaluate(() => (window.game.freeCam = false));
    await freeze(false);
    await page.waitForFunction((dtt) => window.game.stats.simTime - window.__fl.flowT >= dtt, OFFS[i], { timeout: 10000, polling: 2 });
    await freeze(true);
    await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 10000, polling: 5 });
    await shoot(i);
  }
}
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
