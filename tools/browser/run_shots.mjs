// 뛰기 화면 점검 (11/18 — src/run.js · config RUN · 기록 docs/strike/run_2026-11-18.md)
//  폰 가로 844×390 (deviceScaleFactor 2 · 터치) · CDP 터치로 이동 스틱을 쥐고 끝까지 민다 → 그림: 큰 스틱 HUD · 뛰는 동안 스틱 테두리 ·
//   옆에서 본 뛰기 띠(카메라를 몸 옆에 둠 — game.freeCam) · 뒤로 끝까지 당겨 돌아서 달아나기 띠(게임 카메라 그대로) · 옆으로 뛰기 띠(게임 카메라) · 칸 겹침 표
//  실행 (저장소 뿌리): npx vite --port 5176 --strictPort & → node tools/browser/run_shots.mjs [주소 http://127.0.0.1:5176] [그림 폴더]
//   환경: PW_CHROMIUM(크로미움 실행 파일) · K(화면 시계 배 — 소프트웨어 GL 의 긴 프레임이 게임 시간을 깎지 않게, 기본 0.25)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5176';
const outDir = process.argv[3] || 'docs/strike/run_2026-11-18';
const K = +(process.env.K || 0.25);
fs.mkdirSync(outDir, { recursive: true });
const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 그림을 찍는 동안은 화면 시계를 멈춘다 (소프트웨어 GL 은 한 장에 수십 초 — 그동안 판이 흐르면 띠의 간격이 깨짐)
const shot = async (page, path) => {
  const k = await page.evaluate(() => { const k0 = window.__timeK; window.__timeK = 0; return k0; });
  await page.screenshot({ path, type: 'png', timeout: 240000 });
  await page.evaluate((k0) => { window.__timeK = k0; }, k);
};
const report = {};

const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
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
await page.waitForFunction(() => window.game.stats.simTime > 1.5, null, { timeout: 240000 });
// 상대는 서 있기만 (조작만 봄) · 판 시작 카메라가 끝나 발이 풀릴 때까지 (브라우저는 판마다 ARENA.startHold 를 카메라 길이로 덮음)
await page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
await page.waitForFunction(() => !window.game.player.feetHeld, null, { timeout: 240000, polling: 100 });
const want = (n) => !process.env.SCENES || process.env.SCENES.split(',').includes(n); // 장면 고르기 (SCENES=turn,side,…)

const simT = () => page.evaluate(() => game.stats.simTime);
const waitSim = async (s) => { const t0 = await simT(); await page.waitForFunction((t) => game.stats.simTime >= t, t0 + s, { timeout: 240000, polling: 30 }); };
const boxes = () => page.evaluate(() => {
  const ids = ['moveStick', 'btnParry', 'hint', 'emoMsg', 'guardName', 'techSlot', 'topButtons', 'stageInfo', 'atkStick'];
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === 'none' || !(r.width > 0 && r.height > 0)) continue;
    out[id] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), opacity: +cs.opacity };
  }
  // 칼 칸들 · 그 밖의 보이는 고정 칸 가운데 이동 스틱(원 + 둘레 15 px · 손잡이가 길 끝에서 원 밖으로 나간 몫 포함)과 닿는 것
  const st = out.moveStick;
  const R = st.w / 2 + 15;
  const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
  const hits = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('#moveStick')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || (cs.position !== 'fixed' && cs.position !== 'absolute')) continue;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || r.width > 600) continue;
    const nx = Math.max(r.left, Math.min(cx, r.right)), ny = Math.max(r.top, Math.min(cy, r.bottom));
    if (Math.hypot(nx - cx, ny - cy) < R) hits.push(`${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}`);
  }
  return { vw: innerWidth, vh: innerHeight, out, nearStick: hits };
});
const read = () => page.evaluate(() => {
  const P = game.player, v = P.bodies.pelvis.linvel(), p = P.bodies.pelvis.translation();
  return { on: !!P.run?.on, k: +(P.run?.k ?? 0).toFixed(2), v: +Math.hypot(v.x, v.z).toFixed(2), head: +P.heading.toFixed(2), x: +p.x.toFixed(2), z: +p.z.toFixed(2), st: +P.stamina.value.toFixed(1), ring: document.getElementById('moveStick').classList.contains('run'), knob: document.getElementById('moveKnob').style.transform };
});

const cdp = await ctx.newCDPSession(page);
const sb = await page.locator('#moveStick').boundingBox();
const C = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
const KR = 48; // input.js MOVE_STICK_R
const at = (kx, ky) => ({ x: C.x + kx * KR, y: C.y - ky * KR });
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 3, radiusX: 10, radiusY: 10, force: 0.5 })) });
const refill = () => page.evaluate(() => { game.player.stamina.value = 100; });
const backToStart = () => page.evaluate(() => {
  // 다음 장면 전에 두 몸을 처음 자리 근처로 (기력 가득) — 판을 다시 열지 않고
  game.player.stamina.value = 100;
});

// ① 큰 스틱 HUD (가만히)
report.hudIdle = await boxes();
report.stick = { box: sb, travel: KR };
await shot(page, `${outDir}/hud_stick_idle.png`);

// ② 돌아서 달아나기: 상대를 보다가 스틱을 뒤 끝으로 (게임 카메라 그대로 — 몸이 카메라 쪽으로 뜀) — 띠
if (want('turn')) {
await refill();
await touch('touchStart', [at(0, 0)]);
await touch('touchMove', [at(0, -1.25)]); // 원 밖까지 끎 — 손잡이는 길 끝(48 px)에서 멈춤
report.turnStrip = [];
for (let i = 0; i < 16; i++) {
  report.turnStrip.push(await read());
  await shot(page, `${outDir}/turn_away_${String(i).padStart(2, '0')}.png`);
  await waitSim(0.25);
}
await touch('touchEnd', []);
report.turnBack = [];
for (let i = 0; i < 6; i++) {
  await waitSim(0.25);
  report.turnBack.push(await read());
  if (i === 1 || i === 5) await shot(page, `${outDir}/turn_back_${i}.png`);
}
await waitSim(1.0);
}

// ③ 옆으로 뛰기 (오른쪽 끝 — 상대 둘레를 돎 · 게임 카메라)
if (want('side')) {
await refill();
await touch('touchStart', [at(0, 0)]);
await touch('touchMove', [at(1.25, 0)]);
report.sideRun = [];
for (let i = 0; i < 8; i++) {
  report.sideRun.push(await read());
  if (i % 2 === 1) await shot(page, `${outDir}/side_run_${String(i).padStart(2, '0')}.png`);
  await waitSim(0.3);
}
await touch('touchEnd', []);
await waitSim(1.5);
}

// ④ 상대를 바라보는 쪽 25 m 앞으로 치워 두고(곧게 뛸 자리) 스틱 90 % (걷기 · 뛰지 않음) → 끝까지 (뜀 · 테두리 밝게)
if (want('fwd')) {
await page.evaluate(() => {
  const P = game.player, E = game.enemy, p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation();
  const h = P.heading, tx = p.x + Math.cos(h) * 25 - e.x, tz = p.z - Math.sin(h) * 25 - e.z;
  for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + tx, y: t.y, z: t.z + tz }, true); }
  const a = E.anchor.translation();
  E.anchor.setTranslation({ x: a.x + tx, y: a.y, z: a.z + tz }, true);
});
await waitSim(1.2);
await refill();
await touch('touchStart', [at(0, 0.3)]);
await touch('touchMove', [at(0, 0.9)]);
await waitSim(0.8);
report.walk90 = await read();
await shot(page, `${outDir}/hud_stick_walk90.png`);
await touch('touchMove', [at(0, 1.25)]);
await waitSim(0.25);
report.runStart = await read();
await shot(page, `${outDir}/hud_stick_run.png`);
await waitSim(0.6);
// ⑤ 옆에서 본 앞으로 뛰기 띠 (카메라를 몸 오른쪽 4.2 m · 높이 1.15 m — freeCam)
await page.evaluate(() => { game.freeCam = true; });
const sideCam = () => page.evaluate(() => {
  const P = game.player, p = P.bodies.pelvis.translation();
  const h = P.heading, fx = Math.cos(h), fz = -Math.sin(h), rx = Math.sin(h), rz = Math.cos(h);
  game.camera.position.set(p.x + rx * 4.2 + fx * 0.6, 1.15, p.z + rz * 4.2 + fz * 0.6);
  game.camera.lookAt(p.x + fx * 0.6, 0.85, p.z + fz * 0.6);
});
report.sideStrip = [];
await page.evaluate(() => { window.__timeK = 0.08; });
for (let i = 0; i < 10; i++) {
  await sideCam();
  await sleep(60);
  await sideCam();
  report.sideStrip.push(await read());
  await shot(page, `${outDir}/run_side_${String(i).padStart(2, '0')}.png`);
  await waitSim(0.06);
}
await page.evaluate(() => { window.__timeK = 0.25; game.freeCam = false; });
await touch('touchEnd', []);
await waitSim(1.5);
report.afterRelease = await read();
}
report.hudRun = await boxes();
report.errors = errors;
await browser.close();
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
