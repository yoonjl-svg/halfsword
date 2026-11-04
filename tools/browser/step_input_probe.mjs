// 걸음 공격 입력 읽힘 — 본판 빌드(dist/)를 브라우저에서 두 엄지(오른 엄지 = 칼 쪽 화면에 CDP 터치 · 왼 엄지 = 이동 스틱 원 #moveStick 에 터치 포인터 사건)로 (11/05 — 기록 docs/strike/step_input_2026-11-05.md)
//  판: 독일 롱소드(?skillNodes=all — 비껴 딛는 가로베기) · 상대 롱소드(AI 멈춤 · 가슴 사이 3.2 m — 칼이 안 닿음) · 844 × 390 터치 기기.
//  시계: 이 컨테이너의 소프트웨어 GL 은 2 ~ 3 fps 라(프레임 dt 상한 0.1 s — 긋기 한 획이 한두 프레임에 몰림) 폰과 같은 60 fps 로 보려고 Playwright 가짜 시계로 프레임을 하나씩 돌린다
//   (page.clock — rAF · performance.now · Date 가 1/60 s 씩). 사건은 프레임 사이에 보낸다(실제 폰도 rAF 사이에 쌓인 사건을 다음 프레임이 읽음). 게임 코드 · 입력 길은 그대로.
//  시도마다: 오른 엄지를 대고 손을 옆 자세(sideR)로 천천히 옮김(휘두르기 문턱 밑) → 가로베기 한 획(4 패드 m/s) · 왼 엄지는 긋기 시작에 견준 때(dt)에 스틱 원 가운데 곁에 닿아 옆으로 0.05 s 에 걸쳐 밂
//   (세기 a — 손잡이 반지름 40 px 의 몫) · 밀었다 놓기(flick)도. 읽음 = 그 시도 동안 게임이 비껴 딛는 가로베기를 냈나(playerUnique.stats.fired) · 긋기 = 게임이 읽은 기본 동작(classify).
//  실행: npx vite build && (cd dist && python3 -m http.server 4391 --bind 127.0.0.1) &
//        node tools/browser/step_input_probe.mjs http://127.0.0.1:4391 .tmp/step_browser   · 주소 덧붙임 EXTRA='&stepIn=0'(전 판) · REPS=2
//  playwright 는 저장소 의존성에 없다 (미리 깐 것을 require 로 — NODE_PATH · 크롬 PW_CHROMIUM 기본 /opt/pw-browsers/chromium)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4391';
const out = process.argv[3] || '.tmp/step_browser';
fs.mkdirSync(out, { recursive: true });
const EXTRA = process.env.EXTRA || '';
const REPS = +(process.env.REPS || 2);
const W = 844;
const H = 390;
const FR = 1000 / 60; // 프레임 (ms)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 0.25 }); // 화면 배율 0.25 = 그리기만 가볍게
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = `${base}/?weapon=longsword&foeWeapon=longsword&skillNodes=all&slowMo=0&camOpen=old${EXTRA}`;
await page.clock.install();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000, polling: 200 });
await page.evaluate(() => { game.config.ARENA.startGap = 3.2; game.config.ARENA.startHold = 0; });
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000, polling: 200 });
await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
const frames = async (n = 1) => { for (let i = 0; i < n; i++) await page.clock.runFor(FR); };
await frames(90);
const setup = await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {}; // 상대는 서 있기만
  const uq = g.playerUnique;
  const log = (window.stLog = []);
  const orig = uq.classify.bind(uq);
  uq.classify = function (start, dir) {
    const c = orig(start, dir);
    log.push({ tech: c.tech, pad: c.pad, sx: +(g.player.stickX ?? 0).toFixed(2), sy: +(g.player.stickY ?? 0).toFixed(2), busy: uq.busy() });
    return c;
  };
  return { unique: uq.list.map((e) => e.name), stepIn: g.config.UNIQUE_ASSIST.stepIn, stepStick: g.config.UNIQUE_ASSIST.stepStick, dist: +g.player.foeDistance().toFixed(2), sim: +g.stats.simTime.toFixed(2) };
});
console.log(JSON.stringify({ url, setup }));
const cdp = await ctx.newCDPSession(page);
const stickBox = await page.locator('#moveStick').boundingBox();
if (!stickBox) throw Error('스틱 원 없음');
const SC = { x: stickBox.x + stickBox.width / 2, y: stickBox.y + stickBox.height / 2 };
const PX = 2.6 / H; // 패드 m / px (INPUT.touchSensitivity ÷ 화면 높이)
const VG = 1.35; // 폰 세로 배율 (mobile_intent.js)
let R = null; // 오른 엄지 { x, y } (없으면 뗌) — CDP 터치
let L = null; // 왼 엄지 { x, y } — 스틱 원(#moveStick)에 포인터 사건(pointerType 'touch')을 바로 보냄: CDP 는 두 손가락 가운데 하나만 떼지 못함(cavazione_probe.mjs 와 같은 까닭) · 스틱 쪽 받는 길(attachStick)은 같음
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || !R ? [] : [{ x: R.x, y: R.y, id: 1 }] });
const stickEv = (type) =>
  page.evaluate(([type, x, y]) => {
    const pad = document.getElementById('moveStick');
    pad.dispatchEvent(new PointerEvent(type, { pointerId: 77, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  }, [type, L?.x ?? 0, L?.y ?? 0]);
const hand = () => page.evaluate(() => [game.player.handOffset.x, game.player.handOffset.y]);
/** 오른 엄지로 손을 패드 자리 p 로 천천히 (0.9 패드 m/s — 휘두르기 문턱 1.5 밑 · 프레임마다) */
async function moveHandTo(p) {
  for (let i = 0; i < 90; i++) {
    const h = await hand();
    const dx = p[0] - h[0];
    const dy = p[1] - h[1];
    const d = Math.hypot(dx, dy);
    if (d < 0.02) return;
    const s = Math.min(d, (0.9 * FR) / 1000);
    R = { x: R.x + (dx / d) * s / PX, y: R.y - (dy / d) * s / (PX * VG) };
    await send('touchMove');
    await frames(1);
  }
}
/** 패드 길 → 프레임마다 오른 엄지 자리 (px) */
const pathPx = (from, path, v) => {
  const evs = [];
  let h = [...from];
  let x = R.x;
  let y = R.y;
  for (const p of path) {
    for (;;) {
      const dx = p[0] - h[0];
      const dy = p[1] - h[1];
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const s = Math.min(d, (v * FR) / 1000);
      h = [h[0] + (dx / d) * s, h[1] + (dy / d) * s];
      x += (dx / d) * s / PX;
      y -= (dy / d) * s / (PX * VG);
      evs.push({ x, y });
    }
  }
  return evs;
};
const ZW = { from: [0.52, 0.06], path: [[0.0, 0.1], [-0.52, 0.06]] }; // ai_techniques.js zwerch (sideR → sideL)
const trialsOf = () => {
  const T = [];
  for (let r = 0; r < REPS; r++) {
    for (const s of [{ dt: -0.15, a: 0.8 }, { dt: 0, a: 0.8 }, { dt: 0.05, a: 0.8 }, { dt: 0.1, a: 0.8 }, { dt: -0.15, a: 0.45 }, { dt: -0.3, a: 0.8, flick: 0.15 }, null, { dt: 0.4, a: 0.8, hold: 0.3, kind: 'away' }]) T.push(s ? { kind: s.kind ?? 'step', ...s } : { kind: 'plain' });
  }
  return T;
};
const results = [];
let side = 1;
for (const tr of trialsOf()) {
  side = -side;
  R = { x: 620, y: 180 };
  await send('touchStart');
  await frames(3);
  await moveHandTo(ZW.from);
  await frames(5);
  const before = await page.evaluate(() => ({ fired: { ...game.playerUnique.stats.fired }, n: window.stLog.length }));
  // 프레임마다 사건: 오른 엄지 긋기 · 왼 엄지 (dt 에 닿음 · 세 프레임에 걸쳐 밂 · 놓음)
  const sw = pathPx(ZW.from, ZW.path, 4);
  const at = new Map();
  const put = (f, e) => (at.get(f) ?? at.set(f, []).get(f)).push(e);
  sw.forEach((p, i) => put(i, { k: 'R', p }));
  if (tr.kind !== 'plain') {
    const f0 = Math.round((tr.dt * 1000) / FR);
    const tgt = SC.x + side * tr.a * 40;
    put(f0, { k: 'Ldown', p: { x: SC.x + side * 6, y: SC.y } });
    for (let j = 1; j <= 3; j++) put(f0 + j, { k: 'L', p: { x: SC.x + ((tgt - SC.x) * j) / 3, y: SC.y } });
    const f1 = tr.flick != null ? f0 + Math.round((tr.flick * 1000) / FR) : sw.length + Math.round(((tr.hold ?? 0.15) * 1000) / FR);
    put(f1, { k: 'Lup' });
  }
  const fs0 = Math.min(...at.keys());
  const fs1 = Math.max(...at.keys());
  for (let f = fs0; f <= fs1; f++) {
    for (const e of at.get(f) ?? []) {
      if (e.k === 'R') { R = e.p; await send('touchMove'); }
      else if (e.k === 'Ldown') { L = e.p; await stickEv('pointerdown'); }
      else if (e.k === 'L') { L = e.p; await stickEv('pointermove'); }
      else if (e.k === 'Lup') { await stickEv('pointerup'); L = null; }
    }
    await frames(1);
  }
  await frames(6);
  R = null;
  await send('touchEnd');
  if (L) { await stickEv('pointerup'); L = null; }
  await frames(40);
  const after = await page.evaluate((n) => ({ fired: { ...game.playerUnique.stats.fired }, strokes: window.stLog.slice(n), dist: +game.player.foeDistance().toFixed(2), state: game.player.state }), before.n);
  const fired = Object.entries(after.fired).flatMap(([k, v]) => Array.from({ length: v - (before.fired[k] ?? 0) }, () => k));
  const res = { ...tr, side, read: fired.includes('zwerchAbtritt'), base: after.strokes.some((s) => s.tech === 'zwerch'), fired, strokes: after.strokes.map((s) => `${s.tech}@${s.pad}(${s.sx},${s.sy})${s.busy ? 'B' : ''}`), dist: after.dist, state: after.state };
  results.push(res);
  console.log(JSON.stringify(res));
  // 거리 되돌리기 (스틱 앞뒤)
  for (let i = 0; i < 120; i++) {
    const d = await page.evaluate(() => game.player.foeDistance());
    if (Math.abs(d - 3.2) < 0.25) break;
    const first = !L;
    L = { x: SC.x, y: SC.y + (d > 3.2 ? -30 : 30) };
    await stickEv(first ? 'pointerdown' : 'pointermove');
    await frames(1);
  }
  if (L) { await stickEv('pointerup'); L = null; await frames(30); }
}
const by = {};
for (const r of results) {
  const k = r.kind === 'step' ? `dt ${r.dt}${r.flick != null ? ` flick ${r.flick}` : ''} a ${r.a}` : r.kind;
  (by[k] ??= []).push(r);
}
const summary = Object.fromEntries(Object.entries(by).map(([k, rs]) => [k, `${rs.filter((r) => r.read).length}/${rs.length} (가로베기로 읽힘 ${rs.filter((r) => r.base).length}/${rs.length})`]));
const tag = EXTRA.replace(/[^a-z0-9]/gi, '_') || 'default';
fs.writeFileSync(`${out}/step_input_${tag}.json`, JSON.stringify({ url, setup, results, summary, errors }, null, 2));
await page.screenshot({ path: `${out}/last_${tag}.png` });
console.log(JSON.stringify({ summary, errors: errors.slice(0, 5) }));
await browser.close();
