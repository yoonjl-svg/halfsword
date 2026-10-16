// 독일 왕관 꼴 캡처 (10/12 — docs/strike/kron_shape_2026-10-12.md §5). 읽기만(시험용으로 상처만 끈다).
//  플레이어(독일 · WEAPON)가 화면의 '막기' 단추를 진짜 포인터로 누른 채 서 있고, 상대 AI(롱소드)는 닿는 거리에 들면 정수리 베기(oberhau)만 낸다.
//  막기 버튼이 그 줄을 머리 위(highC)로 읽은 수만 본다(다른 줄로 읽으면 다음 수) — 손이 막기 자리에 닿은 뒤 처음 칼끼리 맞닿은 순간(맞닿지 않으면 상대가 따라 베기에 든 때) 멈추고 앞·옆에서 찍는다.
//  KRON=true|pad (주소 ?kronShape=) · VIEWS=front,side · PREFIX=kron_player
//   npx vite build && npx vite preview --port <내 포트> --strictPort &   node tools/browser/kron_shape_shots.mjs http://127.0.0.1:<포트> <폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4199';
const dir = process.argv[3] || '.';
const KRON = process.env.KRON || 'true';
const WEAPON = process.env.WEAPON || 'longsword';
const PREFIX = process.env.PREFIX || 'kron_player';
const VIEWS = (process.env.VIEWS || 'front,side').split(',').filter(Boolean);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 640, height: 480 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
// &uniqueStage=2: 보법·막기 책 — 10/16 08:1x 인장 없앰부터 주소 판도 산 책을 읽어(새 브라우저 = 책 없음), 그 전 주소 판처럼 플레이어 유파 걸음·막기를 켠다
await page.goto(`${base}/?weapon=${WEAPON}&foeWeapon=longsword&slowMo=0&kronShape=${KRON}&uniqueStage=2`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerGuard && window.game.ai, null, { timeout: 60000 });
await page.evaluate(() => {
  document.getElementById('techCue').style.visibility = 'hidden';
  const g = window.game;
  const ai = g.ai;
  g.player.applyWound = () => {};
  g.enemy.applyWound = () => {};
  const R = (window.__ks = { pause: null, clashT: null, low: null, info: null });
  // 상대: 닿는 거리에 들면 정수리 베기만 (속임 없이)
  const upd = ai.update.bind(ai);
  ai.update = (dt) => {
    upd(dt);
    if (ai.mode === 'watch' && ai.me.foeDistance() < ai.M.reach + 0.05 && g.stats.simTime > 2.6) ai.startAttack(ai.school.techByName.oberhau, 'attack', { noFeint: true });
  };
  const pg = g.playerGuard;
  const arrived = () => { const p = pg.padOf('highC'); return Math.hypot(g.player.handOffset.x - p[0], g.player.handOffset.y - p[1]) < 0.08; }; // 손이 막기 자리에 닿은 뒤의 맞닿음만 (두 꼴 같은 잣대)
  const hk = g.combat.hooks.onClash;
  g.combat.hooks.onClash = (...a) => {
    hk?.(...a);
    if (R.clashT == null && pg.mode === 'defend' && pg.line === 'highC' && ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow') && arrived()) (R.clashT = g.stats.simTime), (R.pause = 'clash'), window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); // 그 스텝에 곧장 멈춤
  };
  const step0 = g.player.step.bind(g.player);
  g.player.step = (dt) => {
    step0(dt);
    // 맞닿지 않은 수: 상대가 따라 베기(follow)에 든 첫 스텝 — 손이 막기 자리에 닿아 있으면 그때 멈춘다 (받는 자세 그대로)
    if (R.clashT == null && pg.mode === 'defend' && pg.line === 'highC' && ai.mode === 'attack' && ai.phase === 'follow' && arrived()) (R.clashT = -1), (R.pause = 'follow'), window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  };
});
// 막기 단추를 누른 채 둔다 (pointerdown 만)
await page.evaluate(() => {
  const b = document.getElementById('btnParry');
  const r = b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, isPrimary: false, button: 0 }));
});
await page.waitForFunction(() => window.__ks.pause || window.game.stats.simTime > 40, null, { timeout: 600000, polling: 30 });
await page.evaluate(() => {
  if (window.game.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  document.getElementById('menu').style.visibility = 'hidden';
});
await page.waitForTimeout(250);
const info = await page.evaluate(() => {
  const g = window.game, f = g.player;
  const ct = f.bodies.chest.translation();
  const V = (a) => [a.x, a.y, a.z];
  const p0 = V(f.bladePoint(0)), p1 = V(f.bladePoint(1));
  const F = V(f.forward()), Rt = V(f.right());
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const rel = [p0[0] - ct.x, p0[1] - ct.y, p0[2] - ct.z];
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const L = Math.hypot(...d) || 1;
  return { why: window.__ks.pause, t: +g.stats.simTime.toFixed(2), line: g.playerGuard.line, mode: g.playerGuard.mode, guardName: document.getElementById('guardName')?.textContent ?? null, cover: +(f.skill._cover?.w ?? 0).toFixed(2),
    bladeBase: [dot(rel, F), rel[1], f.side * dot(rel, Rt)].map((x) => +x.toFixed(2)), tip: [+((Math.asin(d[1] / L) * 180) / Math.PI).toFixed(0), +((Math.atan2(f.side * dot(d, Rt), dot(d, F)) * 180) / Math.PI).toFixed(0)] };
});
for (const view of VIEWS) {
  await page.evaluate((view) => {
    const g = window.game, f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx, s = f.side;
    const ang = { front: [0.85, 0.53], side: [0, 1], q34: [0.5, 0.87] }[view];
    const R = 3.2;
    const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
    g.freeCam = true;
    g.camera.position.set(b.x + cx * R, 1.6, b.z + cz * R);
    g.camera.lookAt(b.x + fx * 0.5, 1.45, b.z + fz * 0.5);
  }, view);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/${PREFIX}_${KRON}_${view}.png` });
}
console.log('INFO ' + JSON.stringify(info));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
