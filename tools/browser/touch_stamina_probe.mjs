// 가벼운 손끝 · 잘못 건드림이 기력을 쓰나 — 실제 빌드 · CDP 터치 (사장님 10/31 01:5x '화면에 손가락을 아주 조금 대거나 여러 번 잘못 톡톡 건드려질 때 실제로 아무 커맨드 입력은 안 되면서 기력은 소모되거든')
//  판: 롱소드 · 상대 롱소드(AI 멈춤 · 멀리) · 844×390 · 터치. 화면 시계 K 배(longpress_probe 와 같음) · 탭 길이는 CDP 사건 시각으로 실제 값.
//  시도마다: 입력 층(탭으로 셌나 · 끌기) · 공격이 났나(탭 찌르기 시작 · 휘두르기 스텝 · 손 목표 움직임) · 기력 청구(어느 길 — 탭 찌르기 attack · 긋기 commitStroke(관찰 · 끝맺음 · 닿음)) · 낸 값
//  실행 (저장소 뿌리 · npm i --no-save playwright): npm run build → npx vite preview --port <포트> --strictPort --host 127.0.0.1 &
//        node tools/browser/touch_stamina_probe.mjs http://127.0.0.1:<포트> [결과 json (기본 .tmp/longpress/stamina.json)] · 환경: K(0.15) · WEAPON(longsword) · EXTRA(예 &strokeMin=0 = 전 판) · ONLY(갈래)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5391';
const outFile = process.argv[3] || '.tmp/longpress/stamina.json';
const K = +(process.env.K || 0.15);
const WEAPON = process.env.WEAPON || 'longsword';
const EXTRA = process.env.EXTRA || '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const W = 844, H = 390;
fs.mkdirSync(outFile.replace(/\/[^/]*$/, ''), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  window.__ev = [];
  for (const ev of ['pointerdown', 'pointerup', 'pointercancel']) window.addEventListener(ev, (e) => window.__ev.push({ ev, tgt: e.target?.id || e.target?.tagName || '?' }), true);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = `${base}/?weapon=${WEAPON}&foeWeapon=longsword&slowMo=0&camOpen=old${EXTRA}`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.evaluate(() => { game.config.ARENA.startGap = 4.2; game.config.ARENA.startHold = 0; });
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
await page.waitForFunction(() => window.game.stats.simTime > 1.5, null, { timeout: 240000 });
await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {};
  const f = g.player;
  const S = f.stamina;
  window.__ch = [];
  window.__path = [];
  const tag = (name) => { const o = S[name].bind(S); S[name] = function (...a) { window.__path.push(name); try { return o(...a); } finally { window.__path.pop(); } }; };
  for (const n of ['attack', 'finishStroke', 'observeStroke', 'contactAttack', 'commitStroke']) tag(n);
  const ch = S.chargeAttack.bind(S);
  S.chargeAttack = function (kind, bundled, credit) {
    const v0 = S.value;
    const st = S.stroke ?? S.strokeTail;
    const r = ch(kind, bundled, credit);
    window.__ch.push({ T: +g.stats.simTime.toFixed(3), kind, bundled: !!bundled, path: window.__path.join('>'), cost: +(v0 - S.value).toFixed(2), stroke: st ? { travel: +st.travel.toFixed(3), matched: st.matched, enters: st.enters, kind: st.kind } : null, tap: !!f.skill.tap });
    return r;
  };
  // 손 목표 · 휘두르기 · 탭 찌르기 — 스텝마다
  window.__mx = { sw: 0, hand: 0, taps: 0 };
  const st0 = f.step.bind(f);
  let prev = null;
  let tap0 = false;
  f.step = function (dt) {
    const r = st0(dt);
    if (f.skill.swinging) window.__mx.sw++;
    const h = [f.handOffset.x, f.handOffset.y];
    if (prev) window.__mx.hand += Math.hypot(h[0] - prev[0], h[1] - prev[1]);
    prev = h;
    if (f.skill.tap && !tap0) window.__mx.taps++;
    tap0 = !!f.skill.tap;
    return r;
  };
});
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 1, radiusX: 18, radiusY: 18, force: 0.5 })), ...(ts != null ? { timestamp: ts } : {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setK = (k) => page.evaluate((v) => { window.__timeK = v; }, k);
const simT = () => page.evaluate(() => game.stats.simTime);
const waitSim = async (dtGame) => { const t0 = await simT(); await page.waitForFunction((t) => game.stats.simTime >= t, t0 + dtGame, { timeout: 300000, polling: 100 }); };
const P0 = { x: W * 0.66, y: H * 0.45 };
/** 손가락 하나: dur 실제 초 동안 slide px 를 '끝 몰림'(떼기 직전 미끄러짐 — 가볍게 대다 뗌) 또는 '고름' 으로 · 사건 시각 = 실제 */
async function finger({ dur, slide = 0, ang = 0.6, shape = 'end', at = P0, id = 1 }) {
  const T0 = Date.now() / 1000;
  await touch('touchStart', [{ ...at, id }], T0);
  const n = Math.max(1, Math.round(dur / 0.016));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = shape === 'end' ? slide * Math.max(0, (u - 0.6) / 0.4) : slide * u;
    await sleep(Math.max(4, (dur / n / K) * 1000));
    await touch('touchMove', [{ x: at.x + Math.cos(ang) * a, y: at.y + Math.sin(ang) * a, id }], T0 + u * dur);
  }
  await touch('touchEnd', [], T0 + dur + 0.001);
}
async function swipe() {
  const a = { x: W * 0.6, y: H * 0.6 };
  const T0 = Date.now() / 1000;
  await touch('touchStart', [{ ...a, id: 2 }], T0);
  for (let i = 1; i <= 6; i++) { await sleep(Math.max(4, (0.013 / K) * 1000)); await touch('touchMove', [{ x: a.x + 18 * i, y: a.y - 12 * i, id: 2 }], T0 + i * 0.013); }
  await touch('touchEnd', [], T0 + 0.08);
}
const ready = async () => {
  await setK(1);
  await page.waitForFunction(() => { const f = game.player; return !f.skill.tap && !f.skill.swinging && !f.skill.pom && f.state === 'stand' && !f.iai && !(f.iaiHoldT > 0); }, null, { timeout: 300000, polling: 200 });
  await waitSim(0.6);
  await page.evaluate(() => { const S = game.player.stamina; S.value = S.max; });
};
const results = [];
async function trial(tag, o, act) {
  if (ONLY && !ONLY.includes(tag)) return;
  await ready();
  const b = await page.evaluate(() => ({ ch: window.__ch.length, ev: window.__ev.length, mx: { ...window.__mx }, spent: game.player.stamina.spent.attack, counts: { ...game.player.stamina.counts }, thrusts: game.player.skill.thrusts ?? 0 }));
  await setK(K);
  await act();
  await setK(1);
  await waitSim(1.2);
  const a = await page.evaluate(() => ({ ch: window.__ch.length, ev: window.__ev.length, mx: { ...window.__mx }, spent: game.player.stamina.spent.attack, counts: { ...game.player.stamina.counts }, thrusts: game.player.skill.thrusts ?? 0 }));
  const ch = await page.evaluate((n) => window.__ch.slice(n), b.ch);
  const ev = await page.evaluate((n) => window.__ev.slice(n), b.ev);
  const r = {
    tag, ...o,
    downs: ev.filter((e) => e.ev === 'pointerdown').length,
    thrustStarts: a.mx.taps - b.mx.taps, swingSteps: a.mx.sw - b.mx.sw, handTravel: +(a.mx.hand - b.mx.hand).toFixed(3),
    spent: +(a.spent - b.spent).toFixed(2), cut: a.counts.cut - b.counts.cut, thrust: a.counts.thrust - b.counts.thrust,
    charges: ch.map((c) => ({ kind: c.kind, path: c.path, cost: c.cost, stroke: c.stroke, tap: c.tap })),
  };
  results.push(r);
  console.log(JSON.stringify(r));
}
// ① 아주 짧게 댐 (20 · 40 · 80 ms) × 떼기 직전 미끄러짐 0 · 3 · 6 · 9 · 11 px (탭 문턱 12 px 안 — 탭) 과 14 px (밖 — 끌기)
for (const dur of [0.02, 0.04, 0.08]) for (const slide of [0, 3, 6, 9, 11, 14]) await trial('light', { dur, slide }, () => finger({ dur, slide, shape: 'end' }));
// ② 작은 끌기 (0.25 s 동안 고르게 2 · 5 · 8 · 12 · 15 px — 탭이 아님)
for (const slide of [2, 5, 8, 12, 15]) for (const ang of [0.6, -1.4]) await trial('drag', { dur: 0.25, slide, ang }, () => finger({ dur: 0.25, slide, ang, shape: 'even' }));
// ③ 두세 번 잘못 톡톡 (40 ms 손끝 · 사이 0.12 s · 떼기 직전 4 px)
for (const n of [2, 3]) await trial('multi', { n }, async () => { for (let i = 0; i < n; i++) { await finger({ dur: 0.04, slide: 4, ang: 0.6 + i }); await sleep((0.12 / K) * 1000); } });
// ④ 바쁠 때 탭: 탭 찌르기 도는 중(0.15 s 뒤) · 긋는 중(빠른 긋기 0.04 s 뒤)
await trial('busyTap', { during: 'tap' }, async () => { await finger({ dur: 0.05 }); await sleep((0.15 / K) * 1000); await finger({ dur: 0.05, slide: 3 }); });
await trial('busySwing', { during: 'swing' }, async () => { await swipe(); await sleep((0.04 / K) * 1000); await finger({ dur: 0.05, slide: 3 }); });
// 비교: 진짜 공격 (탭 하나 · 빠른 긋기 하나)
await trial('realTap', {}, () => finger({ dur: 0.06 }));
await trial('realSwipe', {}, () => swipe());
fs.writeFileSync(outFile, JSON.stringify({ url, K, results, errors }, null, 2));
console.log(JSON.stringify({ n: results.length, errors: errors.slice(0, 5) }));
await browser.close();
