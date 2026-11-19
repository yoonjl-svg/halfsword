// 뒤돌아 뛰기 카메라 띠 (11/20 — 사장님 '뒤돌아서 뛰는 거 이상하더라 … 카메라가 혼란스러워져서 게임이 꼬이더라고' · 기록 docs/strike/run_2026-11-20.md)
//  폰 가로 844 × 390 (deviceScaleFactor 2 · 터치) · CDP 터치로 이동 스틱을 쥔다 · 상대 AI 는 그대로 싸움(쫓아옴).
//  같은 조작: 발이 풀린 뒤 ① 스틱 뒤 끝 3.0 s(돌아서 달아남) → ② 오른쪽 끝 1.5 s(둘레를 돎) → ③ 놓음 2.5 s(서서 상대 쪽으로 돌아옴) → ④ 앞 끝 1.0 s(다시 상대 쪽으로)
//  그림: 정해 둔 판 시간마다 한 장(그동안 화면 시계를 멈춤) + 0.05 s 마다 숫자(카메라 방위 · 나 → 상대 방위 · 몸 방향 · 뛰는 쪽 · 스틱이 화면에서 가리키는 쪽과 몸이 실제로 가는 쪽의 차이)
//  실행 (저장소 뿌리): npx vite --port 5191 --strictPort & → node tools/browser/run_cam_strip.mjs [주소] [그림 폴더] [이름]
//   환경: PW_CHROMIUM · K(화면 시계 배 — 기본 0.25) · DPR(기본 2) · SHOTS(찍을 판 시간 — 쉼표, 기본 아래 T)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5191';
const outDir = process.argv[3] || '.tmp/cam';
const tag = process.argv[4] || 'now';
const K = +(process.env.K || 0.25);
const DPR = +(process.env.DPR || 2);
const T = (process.env.SHOTS || '0,0.6,1.2,1.8,2.4,3.0,3.6,4.2,5.0,6.0,7.0,7.6').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript((K0) => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = K0;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
}, K);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&slowMo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
await page.evaluate(() => { game.config.ARENA.startHold = 0; });
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
await page.waitForFunction(() => !window.game.player.feetHeld && window.game.stats.simTime > 1.5, null, { timeout: 240000, polling: 100 });
// 상대 AI 는 그대로 (쫓아옴 · 칼도 냄)
await page.evaluate(() => { game.player.stamina.value = 100; });

const cdp = await ctx.newCDPSession(page);
const sb = await page.locator('#moveStick').boundingBox();
const C = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
const KR = 48;
const at = (kx, ky) => ({ x: C.x + kx * KR, y: C.y - ky * KR });
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 3, radiusX: 10, radiusY: 10, force: 0.5 })) });
const simT = () => page.evaluate(() => game.stats.simTime);
const read = () => page.evaluate(() => {
  const g = game, P = g.player, E = g.enemy, cam = g.camera;
  const p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation(), v = P.bodies.pelvis.linvel();
  const look = new cam.position.constructor(0, 0, -1).applyQuaternion(cam.quaternion);
  const camYaw = Math.atan2(-look.z, look.x); // 화면 위쪽(앞) 방위 — fighter.heading 과 같은 셈
  const foeYaw = Math.atan2(-(e.z - p.z), e.x - p.x);
  const velYaw = Math.hypot(v.x, v.z) > 0.3 ? Math.atan2(-v.z, v.x) : null;
  // 스틱이 화면에서 가리키는 방위 (화면 위 = 카메라 앞) — 스틱 원값 (stickX 오른쪽 · stickY 위)
  const sx = P.stickX || 0, sy = P.stickY || 0;
  const stickYaw = sx * sx + sy * sy > 0.01 ? camYaw + Math.atan2(-sx, sy) : null;
  const r = (x) => (x == null ? null : +x.toFixed(2));
  const w = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // 상대가 화면 어디에 보이나 (NDC x · 앞이면 z < 1)
  const ep = new cam.position.constructor(e.x, 1.2, e.z).project(cam);
  return { t: r(g.stats.simTime), run: !!P.run?.on, back: !!P.run?.back, v: r(Math.hypot(v.x, v.z) * 1.1), camYaw: r(camYaw), foeYaw: r(foeYaw), head: r(P.heading), velYaw: r(velYaw), stickYaw: r(stickYaw),
    stickVsVel: stickYaw != null && velYaw != null ? r(w(stickYaw - velYaw)) : null, camVsFoe: r(w(camYaw - foeYaw)), foeNdc: [r(ep.x), r(ep.y), ep.z < 1], camPos: [r(cam.position.x), r(cam.position.y), r(cam.position.z)], me: [r(p.x), r(p.z)], foe: [r(e.x), r(e.z)], dist: r(Math.hypot(e.x - p.x, e.z - p.z)) };
});
const shot = async (path) => {
  const k = await page.evaluate(() => { const k0 = window.__timeK; window.__timeK = 0; return k0; });
  await page.screenshot({ path, type: 'png', timeout: 240000 });
  await page.evaluate((k0) => { window.__timeK = k0; }, k);
};
// 조작 시간표 (판 시간 — 발이 풀린 뒤 u)
const plan = [[0, [0, -1.25]], [3.0, [1.25, 0]], [4.5, null], [7.0, [0, 1.25]], [8.0, null]];
const t0 = await simT();
const log = [];
let pi = 0, si = 0, held = false;
while (true) {
  const u = (await simT()) - t0;
  while (pi < plan.length && u >= plan[pi][0]) {
    const s = plan[pi][1];
    if (s) { if (!held) await touch('touchStart', [at(0, 0)]); await touch('touchMove', [at(s[0], s[1])]); held = true; }
    else if (held) { await touch('touchEnd', []); held = false; }
    pi++;
  }
  const r = await read();
  r.u = +u.toFixed(2);
  log.push(r);
  if (si < T.length && u >= T[si]) {
    await shot(`${outDir}/${tag}_${String(si).padStart(2, '0')}_u${T[si].toFixed(1)}.png`);
    si++;
  }
  if (u > 8.0 && si >= T.length) break;
  await page.waitForTimeout(40);
}
if (held) await touch('touchEnd', []);
fs.writeFileSync(`${outDir}/${tag}_log.json`, JSON.stringify({ log, errors }, null, 0));
console.log(JSON.stringify({ frames: si, samples: log.length, errors }, null, 0));
await browser.close();
