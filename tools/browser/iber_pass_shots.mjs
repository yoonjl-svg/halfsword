// 이베리아 지나는 자리 캡처 (10/10 — docs/motion/iberian_montante_2026-10-10.md §16): 츠바이핸더 몸(기본 AI — WHO=player 면 플레이어)이 패드 자리 하나를 붙들고 있을 때 옆에서. 폰 가로 844×420. 콘솔 에러 0.
//  PADS = 이름:x:y 쉼표 (기본 tag·tagR·sideR·nebenR·wechselR·tagL·sideL·wechselL — 오른쪽을 다 돈 뒤 왼쪽: 오른 뒤에서 왼 뒤로 곧장 옮기면 칼이 몸에 걸린다) · WEAPON (기본 zweihander) · PREFIX (기본 iber_pass) · VIEW side|q34 (기본 side)
//  시험만: 플레이어 손 자리를 패드에 둔다(handOffset·skill.aimRaw — montante_pass.mjs 와 같은 칸, 손가락 누름 handHeld 없음), AI 는 치러 들지 않게, 플레이어는 맞지 않게.
//  실행: npx vite build && npx vite preview --port 4193 --strictPort &
//        PREFIX=iber_pass_after node tools/browser/iber_pass_shots.mjs http://127.0.0.1:4193 <출력 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4193';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'iber_pass';
const WEAPON = process.env.WEAPON || 'zweihander';
const VIEW = process.env.VIEW || 'side';
const WHO = process.env.WHO || 'enemy'; // enemy = AI 몸(간 보는 자세를 그 패드로 붙잡음) · player = 플레이어 몸(손 자리를 패드에)
const PADS = (process.env.PADS || 'tag:0.02:0.52,tagR:0.42:0.42,sideR:0.52:0.03,nebenR:0.55:-0.26,wechselR:0.38:-0.44,tagL:-0.4:0.42,sideL:-0.52:0.03,wechselL:-0.4:-0.42')
  .split(',').map((s) => { const [n, x, y] = s.split(':'); return { n, x: +x, y: +y }; });
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(WHO === 'player' ? `${base}/?weapon=${WEAPON}&foeWeapon=longsword` : `${base}/?weapon=longsword&foeWeapon=${WEAPON}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.ai, null, { timeout: 60000 });
await page.evaluate(() => {
  document.getElementById('techCue').style.visibility = 'hidden';
  const g = window.game;
  g.player.applyWound = () => {};
  g.ai.startAttack = () => {};
  if (g.ai.pers) g.ai.pers.aggr = 0;
  window.__who = null;
  window.__pad = null;
  // AI 몸: 간 보는 자세를 그 패드로 붙잡는다 (japanese_guard_shots.mjs 와 같은 꼴 — 시험만)
  const ai = g.ai;
  ai.iaiArm = null;
  const pick = ai.pickGuard.bind(ai);
  ai.pickGuard = (...a) => (window.__pad && window.__who === 'enemy' ? (ai.guard = { name: 'pass', pad: window.__pad, threat: 0.5, high: 0.5, low: 0.5 }) : pick(...a));
  // 판 스텝마다 손 자리를 패드에 (입력 처리가 매 프레임 손 자리를 다시 쓰므로 검객 step 앞에서 덮는다)
  const p = g.player, st = p.step.bind(p);
  p.step = (...a) => {
    if (window.__pad && window.__who === 'player') {
      p.handOffset.set(window.__pad[0], window.__pad[1]);
      p.skill.aimRaw?.set?.(window.__pad[0], window.__pad[1]);
    }
    return st(...a);
  };
});
const probe = () => page.evaluate((who) => {
  const g = window.game, f = g[who];
  const V = (a) => [a.x, a.y, a.z];
  const ct = f.bodies.chest.translation();
  const p0 = V(f.bladePoint(0)), p1 = V(f.bladePoint(1));
  const F = V(f.forward()), Rt = V(f.right());
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const rel = [p0[0] - ct.x, p0[1] - ct.y, p0[2] - ct.z];
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const L = Math.hypot(...d) || 1;
  return { sim: +g.stats.simTime.toFixed(2), grip: !!f.gripping, guard: [+dot(rel, F).toFixed(2), +rel[1].toFixed(2), +(f.side * dot(rel, Rt)).toFixed(2)],
    tip: [+((Math.asin(d[1] / L) * 180) / Math.PI).toFixed(0), +((Math.atan2(f.side * dot(d, Rt), dot(d, F)) * 180) / Math.PI).toFixed(0)], nearest: f.guardPose?.table?.[f.guardPose?.nearest]?.name ?? null };
}, WHO);
const freeze = (on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
await page.waitForFunction(() => window.game.stats.simTime > 2.5, null, { timeout: 60000 });
for (const P of PADS) {
  await page.evaluate(([p, w]) => { window.__pad = p; window.__who = w; const ai = window.game.ai; if (w === 'enemy') { ai.guard = { name: 'pass', pad: p, threat: 0.5, high: 0.5, low: 0.5 }; ai.mode = 'watch'; } }, [[P.x, P.y], WHO]);
  const t0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForFunction((t) => window.game.stats.simTime > t + 1.4, t0, { timeout: 180000 });
  await freeze(true);
  out[P.n] = await probe();
  await page.evaluate(([view, who]) => {
    const g = window.game, f = g[who], o = who === 'enemy' ? g.player : g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx, s = -f.side;
    const ang = { side: [0, 1], q34: [0.5, 0.87] }[view];
    const R = 2.6;
    const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
    g.freeCam = true;
    g.camera.position.set(b.x + cx * R, 1.35, b.z + cz * R);
    g.camera.lookAt(b.x - fx * 0.1, 1.15, b.z - fz * 0.1);
  }, [VIEW, WHO]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/${PREFIX}_${WHO}_${P.n}_${VIEW}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  await freeze(false);
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
