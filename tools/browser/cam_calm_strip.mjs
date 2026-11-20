// 뛰기 카메라 띠 (11/21 사장님 '몸이 상대를 안 봐도 괜찮아. 오히려 그게 맞지. 카메라 문제야 이건.' · 기록 docs/strike/cam_restore_2026-11-21.md)
//  폰 가로 844 × 390 (deviceScaleFactor 2 · 터치) · CDP 터치로 이동 스틱을 쥔다 · 상대 AI 는 그대로 싸움.
//  같은 조작을 판(코드 판본)마다: PLAN = [[판 시간 u, [스틱 x, 스틱 y] 또는 null(놓음)], …] (스틱 1 = 손잡이 길 끝 · 1.25 = 끝 넘어 — 늘 끝)
//  그림: SHOTS 판 시간마다 한 장(그동안 화면 시계를 멈춤) + 0.04 s 마다 숫자 — 카메라 방위 · 나 → 상대 방위 · 사이 각 · 상대 · 나의 화면 자리(NDC x) ·
//   카메라 ↔ 나 수평 거리 · 카메라 높이 · 몸 방향 · 뛰나 · 빠르기 (뒤에 cam_calm_stats.mjs 가 방위 도는 빠르기 · 흔들림을 셈)
//  실행 (저장소 뿌리): npx vite --port 5191 --strictPort & → node tools/browser/cam_calm_strip.mjs [주소] [그림 폴더] [이름]
//   환경: PW_CHROMIUM · DPR(기본 2) · PLAN(JSON) · END(끝 판 시간) · SHOTS(쉼표) · Q(덧 주소 — 'team=2v2' 등) · ST(기력 — 기본 100)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5191';
const outDir = process.argv[3] || '.tmp/cam';
const tag = process.argv[4] || 'now';
const DPR = +(process.env.DPR || 2);
const PLAN = JSON.parse(process.env.PLAN || '[[0,[1.25,0]],[6,null]]');
const END = +(process.env.END || 8);
const T = (process.env.SHOTS || '1,2.6,3.4,4.2,5,5.8,6.6,7.6').split(',').map(Number);
const Q = process.env.Q ? `&${process.env.Q}` : '';
const ST = +(process.env.ST || 100);
fs.mkdirSync(outDir, { recursive: true });
const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
// 화면 시계: 화면 하나마다 1/60 s 씩만 (벽시계와 상관없이 — 느린 그리기에서도 물리가 화면 시간을 다 따라가 폰 60 fps 와 같은 셈 · 찍는 동안 __timeK = 0 이면 멈춤)
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  let acc = performance.now();
  window.__timeK = 1;
  performance.now = () => acc;
  window.requestAnimationFrame = (cb) => raf(() => { acc += (1000 / 60) * (window.__timeK > 0 ? 1 : 0); cb(acc); });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&slowMo=0${Q}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
await page.evaluate(() => { game.config.ARENA.startHold = 0; });
if (Q) {
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'fight' || window.game.state === 'draw', null, { timeout: 240000 });
  if (await page.evaluate(() => game.state === 'draw')) await page.locator('#draw .wcard[data-i="0"]').click();
} else await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
await page.waitForFunction(() => !window.game.player.feetHeld && window.game.stats.simTime > 1.5, null, { timeout: 240000, polling: 100 });
await page.evaluate((st) => { game.player.stamina.value = st; }, ST);

const cdp = await ctx.newCDPSession(page);
const sb = await page.locator('#moveStick').boundingBox();
const C = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
const KR = 48;
const at = (kx, ky) => ({ x: C.x + kx * KR, y: C.y - ky * KR });
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 3, radiusX: 10, radiusY: 10, force: 0.5 })) });
const simT = () => page.evaluate(() => game.stats.simTime);
const read = () => page.evaluate(() => {
  const g = game, P = g.player, cam = g.camera;
  const E = (g.teamRun ? P.foe : null) ?? g.enemy;
  const p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation(), v = P.bodies.pelvis.linvel();
  const V = cam.position.constructor;
  const look = new V(0, 0, -1).applyQuaternion(cam.quaternion);
  const camYaw = Math.atan2(-look.z, look.x); // 화면 앞 방위 — fighter.heading 과 같은 셈
  const foeYaw = Math.atan2(-(e.z - p.z), e.x - p.x);
  const r = (x, n = 2) => (x == null ? null : +x.toFixed(n));
  const w = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ep = new V(e.x, 1.2, e.z).project(cam);
  const mp = new V(p.x, 1.2, p.z).project(cam);
  const n = g.fighters?.filter((f) => f && f.alive).map((f) => { const q = f.bodies.pelvis.translation(); const s = new V(q.x, 1.2, q.z).project(cam); return Math.abs(s.x) <= 1 && s.z < 1 ? 1 : 0; });
  return { t: r(g.stats.simTime, 3), vt: r(performance.now() / 1000, 3), run: !!P.run?.on, hold: r(P.run?.hold ?? 0), v: r(Math.hypot(v.x, v.z) * 1.1), camYaw: r(camYaw, 4), foeYaw: r(foeYaw, 4), head: r(P.heading, 3),
    camVsFoe: r(w(camYaw - foeYaw), 3), foeX: r(ep.x, 3), foeIn: Math.abs(ep.x) <= 1 && ep.z < 1, meX: r(mp.x, 3), camD: r(Math.hypot(cam.position.x - p.x, cam.position.z - p.z), 3), camH: r(cam.position.y, 3),
    fov: r(cam.fov, 1), rig: (() => { const R = g.camRig; return R ? [r(R.runYaw, 3), r(R.runPull, 3), r(R.runNdc, 3)] : null; })(), seen: n ? `${n.reduce((a, b) => a + b, 0)}/${n.length}` : null, me: [r(p.x), r(p.z)], foe: [r(e.x), r(e.z)], dist: r(Math.hypot(e.x - p.x, e.z - p.z)), state: P.state };
});
const shot = async (path) => {
  const k = await page.evaluate(() => { const k0 = window.__timeK; window.__timeK = 0; return k0; });
  await page.screenshot({ path, type: 'png', timeout: 240000 });
  await page.evaluate((k0) => { window.__timeK = k0; }, k);
};
const t0 = await simT();
const log = [];
let pi = 0, si = 0, held = false;
while (true) {
  const u = (await simT()) - t0;
  while (pi < PLAN.length && u >= PLAN[pi][0]) {
    const s = PLAN[pi][1];
    if (s) { if (!held) await touch('touchStart', [at(0, 0)]); await touch('touchMove', [at(s[0], s[1])]); held = true; }
    else if (held) { await touch('touchEnd', []); held = false; }
    pi++;
  }
  const r = await read();
  r.u = +u.toFixed(3);
  log.push(r);
  if (si < T.length && u >= T[si]) {
    await shot(`${outDir}/${tag}_${String(si).padStart(2, '0')}_u${T[si].toFixed(1)}.png`);
    si++;
  }
  if (u > END && si >= T.length) break;
  await page.waitForTimeout(40);
}
if (held) await touch('touchEnd', []);
fs.writeFileSync(`${outDir}/${tag}_log.json`, JSON.stringify({ plan: PLAN, log, errors }, null, 0));
console.log(JSON.stringify({ tag, frames: si, samples: log.length, errors: errors.slice(0, 5) }, null, 0));
await browser.close();
