// 공격 조이스틱 화면 점검 (11/17 — INPUT.atkStick · src/atk_stick.js · 기록 docs/strike/atk_stick_2026-11-17.md)
//  폰 흉내(playwright devices — 'iPhone 13 landscape' 가로 · 'iPhone 13' 세로) · `?atkStick=stick` 판 · CDP 터치로 손잡이를 네 자리에 쥐고 · 튕기고 · 톡 침 →
//   손 목표(handOffset) · 칼 손 높이 · 휘두르기 · 칼끝 빠르기 · 탭 찌르기 · 화면 칸 겹침(조이스틱 둘 · 막기 단추 · 안내 · 알림 · 오른쪽 위 칸)을 재고 그림을 남김
//  실행 (저장소 뿌리): npx vite --port 5176 --strictPort --host 127.0.0.1 & → node tools/browser/atk_stick_shots.mjs [주소 http://127.0.0.1:5176] [그림 폴더 docs/strike/atk_stick_2026-11-17]
//   환경: PW_CHROMIUM(크로미움 실행 파일 — 없으면 playwright 기본) · MODE(stick · both) · K(화면 시계 배 — 소프트웨어 GL 의 긴 프레임이 게임 시간을 깎지 않게, 기본 0.25)
import fs from 'node:fs';
import { createRequire } from 'node:module';
// playwright 는 저장소 의존성에 없음 — 깔린 자리(NODE_PATH · 전역)에서 require 로 (ESM import 는 NODE_PATH 를 안 봄)
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5176';
const outDir = process.argv[3] || 'docs/strike/atk_stick_2026-11-17';
const MODE = process.env.MODE || 'stick';
const K = +(process.env.K || 0.25);
fs.mkdirSync(outDir, { recursive: true });
const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 그림: CSS 픽셀 크기(폰 화면 그대로) · jpeg 80 (저장소에 두는 그림이라 작게)
const shot = (page, path) => page.screenshot({ path, scale: 'css', type: 'jpeg', quality: 80 });
const report = { mode: MODE, views: {} };

async function open(devName) {
  const { defaultBrowserType, ...dev } = devices[devName];
  void defaultBrowserType;
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript((K0) => {
    // 화면 시계를 K 배로 (게임 코드는 그대로 — tools/browser/longpress_probe.mjs 와 같은 꼴)
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
  await page.goto(`${base}/?atkStick=${MODE}&weapon=longsword&foeWeapon=longsword&slowMo=0&camOpen=old`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
  return { ctx, page, errors };
}

/** 보이는 HUD 칸들의 상자 · 서로 겹침 */
async function boxes(page) {
  return page.evaluate(() => {
    const ids = ['moveStick', 'atkStick', 'btnParry', 'hint', 'emoMsg', 'guardName', 'techSlot', 'topButtons', 'stageInfo'];
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const shown = cs.display !== 'none' && r.width > 0 && r.height > 0;
      out[id] = { shown, opacity: +cs.opacity, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    const vw = innerWidth, vh = innerHeight;
    const hit = [];
    const keys = Object.keys(out).filter((k) => out[k].shown);
    // 둥근 단추 셋은 원으로 · 나머지는 상자로 (안내 · 알림은 글이 차면 최대 폭까지 — 최대 폭 상자로 셈)
    const round = new Set(['moveStick', 'atkStick', 'btnParry']);
    const maxBox = (id) => {
      const el = document.getElementById(id);
      const b = out[id];
      if (id !== 'hint' && id !== 'emoMsg') return b;
      const mw = parseFloat(getComputedStyle(el).maxWidth);
      return { ...b, x: Math.round(vw / 2 - mw / 2), w: Math.round(mw) };
    };
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        const a = maxBox(keys[i]), b = maxBox(keys[j]);
        let over;
        if (round.has(keys[i]) && round.has(keys[j])) {
          const d = Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
          over = d < a.w / 2 + b.w / 2;
        } else over = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        if (over) hit.push([keys[i], keys[j]]);
      }
    const offscreen = keys.filter((k) => out[k].x < 0 || out[k].y < 0 || out[k].x + out[k].w > vw || out[k].y + out[k].h > vh);
    return { vw, vh, out, overlap: hit, offscreen };
  });
}

// ── 가로 (싸움) ──
{
  const { ctx, page, errors } = await open('iPhone 13 landscape');
  await page.evaluate(() => { game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('hint')).opacity > 0.9, null, { timeout: 240000 });
  const V = { errors };
  V.start = await boxes(page); // 싸움 시작 한 줄 안내가 떠 있는 때
  V.start.hintText = await page.evaluate(() => document.getElementById('hint').textContent);
  await shot(page, `${outDir}/land_start.jpg`);
  await page.waitForFunction(() => window.game.stats.simTime > 1.0, null, { timeout: 240000 });
  V.hud = await boxes(page);
  await shot(page, `${outDir}/land_fight.jpg`);
  // 상대는 서 있기만 · 기력은 가득 (조작만 봄)
  await page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator('#atkStick').boundingBox();
  const C = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const KR = 40;
  const at = (kx, ky) => ({ x: C.x + kx * KR, y: C.y - ky * KR });
  const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 7, radiusX: 12, radiusY: 12, force: 0.5 })), ...(ts != null ? { timestamp: ts } : {}) });
  const simT = () => page.evaluate(() => game.stats.simTime);
  const waitSim = async (s) => { const t0 = await simT(); await page.waitForFunction((t) => game.stats.simTime >= t, t0 + s, { timeout: 240000, polling: 50 }); };
  const read = () => page.evaluate(() => {
    const g = window.game, P = g.player, pel = P.bodies.pelvis.translation(), s = P.sword.translation();
    return { hand: [+P.handOffset.x.toFixed(3), +P.handOffset.y.toFixed(3)], swordUp: +(s.y - pel.y).toFixed(3), swordSide: +(s.z - pel.z).toFixed(3), swinging: !!P.skill.swinging, tip: +P.tipVel.length().toFixed(2), tap: !!P.skill.tap, held: !!P.handHeld, grip: P.handGrip, knob: document.getElementById('atkKnob').style.transform };
  });
  // ① 네 자리 쥐기
  V.hold = {};
  for (const [name, kx, ky] of [['up', 0, 0.9], ['right', 0.9, 0], ['down', 0, -0.9], ['left', -0.9, 0]]) {
    await touch('touchStart', [at(kx, ky)]);
    await waitSim(1.2);
    V.hold[name] = await read();
    await shot(page, `${outDir}/land_hold_${name}.jpg`);
    await touch('touchEnd', []);
    await waitSim(0.8);
  }
  // ② 튕김: 위 끝을 쥐고 → 아래 끝으로
  await touch('touchStart', [at(0, 1)]);
  await waitSim(1.2);
  const pre = await read();
  await page.evaluate(() => {
    window.__sw = { swing: false, tip: 0 };
    const P = window.game.player, st = P.step.bind(P);
    P.step = (dt) => { const r = st(dt); window.__sw.swing ||= !!P.skill.swinging; window.__sw.tip = Math.max(window.__sw.tip, P.tipVel.length()); return r; };
  });
  await page.evaluate(() => { window.__timeK = 0.05; }); // 튕기는 동안 화면 시계를 더 늦춰 프레임마다 손잡이 자리 하나씩
  for (const y of [0.5, 0, -0.5, -1]) { await touch('touchMove', [at(0, y)]); await sleep(120); }
  await page.evaluate(() => { window.__timeK = 0.25; });
  await waitSim(0.15);
  await shot(page, `${outDir}/land_flick.jpg`);
  await waitSim(0.4);
  V.flick = { before: pre, after: await read(), ...(await page.evaluate(() => ({ swing: window.__sw.swing, tipMax: +window.__sw.tip.toFixed(2) }))) };
  await touch('touchEnd', []);
  await waitSim(1.0);
  // ③ 탭: 가운데 톡
  const thr0 = await page.evaluate(() => { const P = window.game.player; window.__tap = 0; const th = P.skill.thrust.bind(P.skill); P.skill.thrust = (o) => { window.__tap++; return th(o); }; return 0; });
  void thr0;
  // 탭 길이는 CDP 사건 시각으로 실제 값 (소프트웨어 GL 은 사건이 늦게 처리돼 사건 시각이 벌어짐 — longpress_probe.mjs 와 같은 꼴)
  const T0 = Date.now() / 1000;
  await touch('touchStart', [at(0, 0)], T0);
  await sleep(30);
  await touch('touchEnd', [], T0 + 0.06);
  await waitSim(0.2);
  V.tap = { thrusts: await page.evaluate(() => window.__tap), ...(await read()) };
  await shot(page, `${outDir}/land_tap.jpg`);
  // ④ 'stick' 판: 화면 끌기는 칼이 아님
  const h0 = await read();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 400, y: 150, id: 9 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 400 + i * 30, y: 150 - i * 10, id: 9 }] }); await sleep(40); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitSim(0.2);
  V.canvasSwipe = { before: h0.hand, after: (await read()).hand };
  report.views.landscape = V;
  await ctx.close();
}

// ── 세로 (폰을 세로로 든 채 — 싸움 화면은 '가로로 돌려 주세요' 가림막이 덮음: 가림막을 걷고 칸 자리만 봄) ──
{
  const { ctx, page, errors } = await open('iPhone 13');
  await page.evaluate(() => { game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
  await page.waitForFunction(() => window.game.stats.simTime > 1.0, null, { timeout: 240000 });
  const rotate = await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display);
  await shot(page, `${outDir}/port_rotate.jpg`);
  await page.evaluate(() => { document.getElementById('rotate').style.display = 'none'; });
  const hud = await boxes(page);
  await shot(page, `${outDir}/port_fight_hud.jpg`);
  report.views.portrait = { errors, rotateCover: rotate, hud };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
