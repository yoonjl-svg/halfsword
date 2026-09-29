// 브라우저 터치 끌기 시험 (R0 입력, INPUT.coalesce): CDP 터치 이벤트로 손가락을 실제 브라우저 길(pointermove → input.js onMove → fingerTrace →
//  main.js 물리 스텝마다 handDeltaAt → handOffset)로 끌어, 조각 수·시각(이벤트마다 제 시각인지), 손 목표 이동 = 손가락 이동(px × 배율)인지,
//  예측으로 앞선 몫(≤ predictMs × 손가락 빠르기)과 뗀 뒤 되튐이 없는지, 콘솔 에러 0 을 본다. 켬(기본)과 끔(INPUT.coalesce=false, 같은 모듈)을 견준다.
//  헤드리스 CDP 는 이벤트를 하나씩 바로 보내므로 getCoalescedEvents 는 [자기 자신] 이다 — 합쳐진 목록 자체는 시뮬(tools/sim/input_latency.mjs touchHz)로 본다
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/touch_trace.mjs http://127.0.0.1:5173
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 860, height: 420 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
await page.goto(base + '/?weapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
await page.getByText('싸움 시작').click();
await page.waitForTimeout(2500);
await page.evaluate(() => { window.game.ai.update = () => {}; }); // 시험 중엔 적이 가만히
const cdp = await ctx.newCDPSession(page);
const W = 860, H = 420;
const X = W * 0.72, Y = H * 0.55; // 칼 쪽(오른쪽) 화면
const N = 10, STEP = [-5, -4], GAP_MS = 8; // 10 표본, 표본마다 (−5, −4) px (왼쪽 위로 64 px, 패드 0.4 m — 손 반경 0.62 m 안). 헤드리스는 이벤트 하나에 한 프레임(≈1 s)이 걸린다
const frames = (n) => page.evaluate((n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n); // 화면 프레임 n 개 기다림 (헤드리스는 느리다)
const snap = () => page.evaluate(() => {
  const g = window.game, I = g.input, tr = I.fingerTrace, p = g.player;
  const n = Math.min(tr.count, 64), ts = [];
  for (let k = 0; k < n; k++) ts.push(tr.t[tr.idx(k)]);
  return { hx: p.handOffset.x, hy: p.handOffset.y, total: tr.total, sx: tr.sx, sy: tr.sy, cx: I._cur.x, cy: I._cur.y, ts, scale: (I.constructor && 2.6) / Math.max(320, innerHeight), predicted: tr.pn };
});
const setFlag = (on) => page.evaluate(async (on) => { const m = await import('/src/config.js'); m.INPUT.coalesce = on; return { coalesce: m.INPUT.coalesce, predictMs: m.INPUT.predictMs, sens: m.INPUT.touchSensitivity }; }, on);
const results = [];
for (const on of [true, false]) {
  const cfg = await setFlag(on);
  await page.waitForFunction(() => !window.game.player.skill.tap, null, { timeout: 8000 });
  // 앞 끌기 뒤 자세로 돌아가기(1.2 m/s, 헤드리스는 프레임마다 게임 시간 0.05 s)가 끝나 손 목표가 멈출 때까지
  await page.waitForFunction(() => { const p = window.game.player, k = p.skill; const h = p.handOffset; const still = window.__hs && Math.abs(window.__hs[0] - h.x) + Math.abs(window.__hs[1] - h.y) < 1e-6; window.__hs = [h.x, h.y]; return !k.recovering && still; }, null, { timeout: 90000, polling: 400 });
  // 같은 자리에서 시작 (쟁기 패드. 돌아간 자세가 다르면 끌기 끝이 손 반경 0.62 m 를 넘어 잘린다)
  await page.evaluate(() => { const p = window.game.player, k = p.skill; p.handOffset.set(0.18, -0.28); for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(0.18, -0.28); k.aimVel.set(0, 0); k.vel.set(0, 0); k.follow.set(0, 0); });
  await frames(3);
  const a = await snap();
  const t0 = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X, y: Y, id: 1 }] });
  for (let i = 1; i <= N; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: X + STEP[0] * i, y: Y + STEP[1] * i, id: 1 }] });
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  const dragMs = Date.now() - t0;
  await frames(3); // 손가락은 댄 채 멈춤 (댄 동안은 자세로 돌아가지 않는다). 마지막 이벤트의 몫이 다 들어가도록 프레임을 기다린다
  const held = await snap();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frames(2);
  const lifted = await snap();
  const scale = cfg.sens / Math.max(320, H);
  const exp = { x: STEP[0] * N * scale, y: -STEP[1] * N * scale }; // 패드: +x 오른쪽, +y 위
  const got = { x: held.hx - a.hx, y: held.hy - a.hy };
  const err = Math.hypot(got.x - exp.x, got.y - exp.y);
  const pieces = held.total - a.total; // 움직임 조각 (뗀 조각 전)
  const newTs = held.ts.slice(0, Math.min(pieces, held.ts.length));
  const distinct = new Set(newTs.map((t) => t.toFixed(3))).size;
  const mono = newTs.every((t, i) => i === 0 || t <= newTs[i - 1]); // ts 는 최근 것부터
  const vPad = (Math.hypot(STEP[0], STEP[1]) * N * scale) / (dragMs / 1000); // 실제 끈 빠르기 (패드 m/s)
  const ahead = Math.hypot(held.cx - held.sx, held.cy - held.sy); // 커서가 실제 조각 합보다 앞선 몫 (예측)
  const kick = Math.hypot(lifted.cx - held.cx, lifted.cy - held.cy); // 뗀 뒤 커서 이동 (되튐이면 > 0)
  // 허용: 손 목표 이동 오차·예측 앞섬 ≤ predictMs × 끈 빠르기의 2배 (마지막 조각의 빠르기는 평균과 다르다), 최소 1 mm. 뗀 뒤 커서는 그대로
  const tol = Math.max(0.001, 2 * cfg.predictMs * 1e-3 * vPad);
  const ok = pieces === N && distinct === N && mono && err <= (on ? tol : 1e-4) && (!on || ahead <= tol) && (!on || kick <= 1e-6);
  results.push({ on, ok, pieces, distinct, mono, dragMs, vPad: +vPad.toFixed(2), exp: [+exp.x.toFixed(4), +exp.y.toFixed(4)], got: [+got.x.toFixed(4), +got.y.toFixed(4)], err_mm: +(err * 1000).toFixed(1), ahead_mm: on ? +(ahead * 1000).toFixed(1) : null, kick_mm: on ? +(kick * 1000).toFixed(2) : null, predicted: held.predicted });
}
await setFlag(true);
for (const r of results) console.log(`${r.ok ? 'OK ' : 'NG '} ${r.on ? '켬' : '끔'}: 조각 ${r.pieces}/${N} (제 시각 ${r.distinct}, 순서 ${r.mono}) · 끌기 ${r.dragMs} ms (${r.vPad} m/s) · 손 목표 이동 ${JSON.stringify(r.got)} 기대 ${JSON.stringify(r.exp)} 오차 ${r.err_mm} mm · 예측 앞섬 ${r.ahead_mm} mm · 뗀 뒤 되튐 ${r.kick_mm} mm · 브라우저 예측 표본 ${r.predicted}`);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '콘솔 에러 0');
await browser.close();
process.exit(results.every((r) => r.ok) && !errors.length ? 0 : 1);
