// 풍차 베기(이베리아 B4) 길게 누름 — 실제 빌드 · CDP 터치 (사장님 10/31 01:4x '탭을 오래 누르고 있는 커맨드가 잘 안 먹혀. 그래서 레돈두가 잘 실행되지 않음.')
//  저장: 개발 서버 쪽에서 금화를 채워 진짜 배우기(skill_tree_store.js learnNode)로 이베리아 B1 → B5 → B4 를 익히고, 그 저장(localStorage 전부)을 빌드 쪽에 그대로 넣음.
//  판: 츠바이핸더 · 상대 롱소드(AI 멈춤 · 멀리) · 844×390 · 터치 기기. 화면 시계를 K 배로 늦춰(requestAnimationFrame · performance.now — 게임 코드는 그대로)
//   소프트웨어 GL 의 긴 프레임이 게임 시간을 깎지 않게 한다: 누름 D 초 = 벽시계 D/K 초 (게임은 D 초를 봄). 탭 길이는 CDP 사건 시각(timestamp)으로 실제 값.
//  누름마다: 엄지 떠돎(드리프트 — 처음 자리에서 가장 먼 거리 drift px · 천천히 떠돌다 조금 돌아옴) · 끝에 뗌 → 풍차 베기가 나갔나(stats.fired.redondo) ·
//   holdTick 상태 바뀜(idle → press → spent | wind)과 그때의 까닭(still · busy 갈래 · 식힘 · 비기 창 · 탈진) · 포인터 사건(캔버스에 닿았나 · 취소) · 기력 · 긋기
//  실행 (저장소 뿌리 · playwright 는 저장소 의존성에 없음 — npm i --no-save playwright): npm run build → npx vite preview --port <빌드 포트> --strictPort --host 127.0.0.1 &
//        npx vite --port <개발 포트> --strictPort --host 127.0.0.1 &   (배우기만 — 빌드에는 모듈이 없음)
//        node tools/browser/longpress_probe.mjs http://127.0.0.1:<빌드 포트> http://127.0.0.1:<개발 포트> [결과 json (기본 .tmp/longpress/hold.json)]
//   환경: K(0.15 — 화면 시계 배) · DUR(0.6,0.8,1.0,1.5 실제 초) · DRIFT(0,3,6,10,15,25 px) · REPS(2) · SCEN(grid,afterSwing,walking,stick,ring,ringTap,tapArt) · EXTRA(주소 덧붙임 — 예 &holdPx=12 · &stickGuard=0 = 전 판)
//   ring(10/31 08:xx 스틱 둘레): 왼 엄지가 원 테 6 · 14 px 밖(왼 아래) — 가만히 · 움직임 + 오른 엄지 1.0 s 누름(걸은 거리 · 걸음 스텝 · 감기) · 오른 엄지 탭 · 칼 쪽 둘레 바로 밖(+3 · 8 · 20 px) 탭
//   누른 시간은 게임 시계로 셈(게임이 본 실제 초 = gameHold) · 시도 사이 식힘은 지움(시험 발판) · 기력은 가득으로 · 줄마다 바로 찍음(긴 재기는 갈래를 나눠 돌림)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5391';
const dev = process.argv[3] || 'http://127.0.0.1:5392';
const outFile = process.argv[4] || '.tmp/longpress/hold.json';
const K = +(process.env.K || 0.15);
const DUR = (process.env.DUR || '0.6,0.8,1.0,1.5').split(',').map(Number);
const DRIFT = (process.env.DRIFT || '0,3,6,10,15,25').split(',').map(Number);
const REPS = +(process.env.REPS || 2);
const SCEN = (process.env.SCEN || 'grid,afterSwing,walking').split(',');
const EXTRA = process.env.EXTRA || '';
const W = 844, H = 390;
fs.mkdirSync(outFile.replace(/\/[^/]*$/, ''), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
// ① 진짜 배우기 (개발 서버 — 모듈을 직접 부름)
const dctx = await browser.newContext({ viewport: { width: W, height: H } });
const dpage = await dctx.newPage();
await dpage.goto(`${dev}/?weapon=zweihander`, { waitUntil: 'networkidle' });
await dpage.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
const save = await dpage.evaluate(async () => {
  const P = await import('/src/lobby_progress.js');
  const S = await import('/src/skill_tree_store.js');
  P.setCoins(100000);
  P.setHeads(100);
  const r = {};
  for (const id of ['B1', 'B5', 'B4']) r[id] = S.learnNode('iberian', id);
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  return { r, learned: [...(S.readLearned().iberian ?? [])], ls };
});
await dctx.close();
console.log(JSON.stringify({ learned: save.r, now: save.learned }));
// ② 빌드 판
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addInitScript(([ls, K0]) => {
  try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch { /* */ }
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  // 포인터 · 시스템 사건 (캔버스에 닿았나 · 취소 · 길게 누름 메뉴)
  window.__ev = [];
  for (const ev of ['pointerdown', 'pointerup', 'pointercancel', 'contextmenu', 'selectstart', 'touchcancel', 'lostpointercapture']) {
    window.addEventListener(ev, (e) => window.__ev.push({ ev, id: e.pointerId ?? null, tgt: e.target?.id || e.target?.tagName || '?', x: e.clientX ?? null, y: e.clientY ?? null, ts: Math.round(e.timeStamp) }), true);
  }
}, [save.ls, K]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = `${base}/?weapon=zweihander&foeWeapon=longsword&slowMo=0&camOpen=old${EXTRA}`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.evaluate(() => { game.config.ARENA.startGap = 4.2; game.config.ARENA.startHold = 0; });
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
await page.waitForFunction(() => window.game.stats.simTime > 1.5, null, { timeout: 240000 });
const kit = await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {}; // 상대는 서 있기만
  const uq = g.playerUnique;
  const f = g.player;
  window.__hl = [];
  window.__sw = 0;
  // 기력 청구 (어느 길 · 그때 운동학 칼 · 탭 찌르기)
  window.__ch = [];
  {
    const S = f.stamina;
    const ch = S.chargeAttack.bind(S);
    S.chargeAttack = function (kind, bundled, credit) { const v0 = S.value; const r = ch(kind, bundled, credit); window.__ch.push({ T: +g.stats.simTime.toFixed(3), kind, cost: +(v0 - S.value).toFixed(2), iai: !!(f.iai || f.iaiReq), hold: f.iaiHoldT > 0 || f.iaiFade > 0, tap: !!f.skill.tap, stack: (new Error().stack || '').split('\n').slice(2, 5).map((x) => x.trim().split(' ')[1]).join('<') }); return r; };
    const th = f.skill.thrust.bind(f.skill);
    window.__th = [];
    f.skill.thrust = function (o) { const iai = !!(f.iai || f.iaiReq), hold = f.iaiHoldT > 0 || f.iaiFade > 0; const r = th(o); window.__th.push({ T: +g.stats.simTime.toFixed(3), r: !!r, iai, hold, tap: !!f.skill.tap }); return r; };
  }
  const orig = uq.holdTick.bind(uq);
  uq.holdTick = function (dt) {
    const Hh = uq.hold;
    const P = uq.press;
    const st0 = Hh.st;
    const sk = f.skill;
    const pre = {
      down: P.down, still: P.still, secretOpen: P.secretOpen, cooling: uq.holdE ? uq.cooling(uq.holdE) : null, busy: uq.busy(),
      why: { blocked: !!uq.blocked, sec: !!sk.sec, tap: !!sk.tap, pom: !!sk.pom, vital: !!sk.vitalRange, state: f.state, finish: (f.finish?.amt ?? 0) > 0.5, iai: !!(f.iai || f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0), swinging: !!sk.swinging },
      exh: f.stamina.exhausted, stam: +f.stamina.value.toFixed(1), holdT: +(Hh.t ?? 0).toFixed(3),
    };
    if (sk.swinging) window.__sw++;
    if (Math.hypot(f.move.x, f.move.y) > 0.05) window.__mv = (window.__mv ?? 0) + 1;
    const r = orig(dt);
    if (Hh.st !== st0) window.__hl.push({ T: +g.stats.simTime.toFixed(3), from: st0, to: Hh.st, ...pre });
    return r;
  };
  return { tradition: f.swordArt?.tradition, weapon: f.weapon?.id, unique: uq?.list?.map((e) => e.name), holdE: uq.holdE?.name ?? null, rdHoldTime: g.config.UNIQUE_ASSIST.rdHoldTime, tapMs: g.config.INPUT.tapMs, tapPx: g.config.INPUT.tapPx, holdPx: g.config.INPUT.holdPx ?? null };
});
console.log(JSON.stringify({ kit }));
if (kit.holdE !== 'redondo') throw Error('풍차 베기 없음 ' + JSON.stringify(kit));
const cdp = await ctx.newCDPSession(page);
const stickBox = await page.locator('#moveStick').boundingBox();
const S0 = stickBox ? { x: stickBox.x + stickBox.width / 2, y: stickBox.y + stickBox.height / 2 } : null;
const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 18, radiusY: 18, force: 0.5 })), ...(ts != null ? { timestamp: ts } : {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setK = (k) => page.evaluate((v) => { window.__timeK = v; }, k);
const simT = () => page.evaluate(() => game.stats.simTime);
const waitSim = async (dtGame) => { const t0 = await simT(); await page.waitForFunction((t) => game.stats.simTime >= t, t0 + dtGame, { timeout: 300000, polling: 100 }); };
// 엄지 떠돎: 0 → 40 % 까지 천천히 가장 먼 자리(drift)로 · 그 뒤 70 % 쯤으로 조금 돌아옴 · ±0.4 px 떨림
const wander = (u, drift, ang, seed) => {
  const a = u < 0.4 ? drift * (0.5 - 0.5 * Math.cos((Math.PI * u) / 0.4)) : drift * (1 - 0.3 * (0.5 - 0.5 * Math.cos((Math.PI * (u - 0.4)) / 0.6)));
  const j = drift > 0 ? 0.4 : 0;
  const n1 = Math.sin(seed * 12.9898 + u * 91.7) * j, n2 = Math.cos(seed * 78.233 + u * 57.3) * j;
  return { dx: Math.cos(ang) * a + n1, dy: Math.sin(ang) * a + n2 };
};
// 준비: 몸 자유 · 식힘 지남 · 기력 가득 (시험 발판 — 적어 둠)
const ready = async () => {
  await setK(1);
  await page.waitForFunction(() => { const f = game.player, uq = game.playerUnique; return !uq.winding && uq.hold.st === 'idle' && !uq.coolRun.redondo && !f.skill.tap && !f.skill.swinging && !f.iai && !(f.iaiHoldT > 0) && !(f.iaiFade > 0) && f.state === 'stand'; }, null, { timeout: 300000, polling: 200 });
  await waitSim(0.4);
  // 시험 발판: 식힘을 지움(시도 사이 기다림만 줄임 — 식힘 중 누름은 'afterSwing' · 'cool' 갈래가 따로 봄) · 기력 가득
  await page.evaluate(() => { const S = game.player.stamina; S.value = S.max; if (!window.__keepCool) delete game.playerUnique.coolT.redondo; });
};
const snap = () => page.evaluate(() => { const uq = game.playerUnique, f = game.player; return { fired: uq.stats.fired?.redondo ?? 0, winds: uq.stats.winds ?? 0, refused: uq.stats.holdRefused ?? 0, cancel: { ...(uq.stats.windCancel ?? {}) }, hl: window.__hl.length, ev: window.__ev.length, sw: window.__sw, thrusts: f.skill.thrusts ?? 0, spent: { ...(f.stamina.spent ?? {}) }, stam: f.stamina.value, dist: f.foeDistance(), px: f.bodies.pelvis.translation().x, pz: f.bodies.pelvis.translation().z, mv: window.__mv ?? 0 }; });
const diff = (a, b) => ({ walked: +Math.hypot(b.px - a.px, b.pz - a.pz).toFixed(3), moveSteps: b.mv - a.mv, fired: b.fired - a.fired, winds: b.winds - a.winds, refused: b.refused - a.refused, thrusts: b.thrusts - a.thrusts, swingSteps: b.sw - a.sw });
// 한 번 누름 (벽시계는 D/K) — pts = 함께 닿아 있는 다른 손가락(스틱)
const HOLD0 = { x: W * 0.68, y: H * 0.42 };
async function hold({ dur, drift, ang, seed, stick = null }) {
  const id = 1;
  const p0 = { x: HOLD0.x + ((seed * 37) % 21) - 10, y: HOLD0.y + ((seed * 53) % 17) - 8 };
  await setK(K);
  const others = stick ? [{ ...stick.at(0), id: 9 }] : [];
  if (stick) {
    await touch('touchStart', others);
    await sleep(120 / K);
  }
  await touch('touchStart', [...others, { ...p0, id }]);
  const g0 = await simT();
  const wall = (dur / K) * 1000;
  const t0 = Date.now();
  let maxd = 0;
  for (;;) {
    await sleep(Math.max(8, 16 / K));
    // 누른 시간은 게임 시계로 (소프트웨어 GL 프레임이 길어 게임이 벽시계보다 늦게 가도 게임이 dur 실제 초를 보게) — 실제 초 × 템포 1.1
    const u = Math.min(1, ((await simT()) - g0) / (dur * 1.1));
    const w = wander(u, drift, ang, seed);
    maxd = Math.max(maxd, Math.hypot(w.dx, w.dy));
    const pts = [...(stick ? [{ ...stick.at(u), id: 9 }] : []), { x: p0.x + w.dx, y: p0.y + w.dy, id }];
    await touch('touchMove', pts);
    if (u >= 1) break;
  }
  const g1 = await simT();
  await touch('touchEnd', []);
  return { p0, maxd: +maxd.toFixed(1), gameHold: +((g1 - g0) / 1.1).toFixed(3) }; // 누른 동안 게임이 본 실제 초 (템포 1.1 나눔)
}
async function swipe() {
  // 빠른 긋기 (오른쪽 위로 100 px · 실제 0.08 s)
  await setK(K);
  const a = { x: W * 0.62, y: H * 0.55, id: 2 };
  await touch('touchStart', [a]);
  const n = 6;
  for (let i = 1; i <= n; i++) {
    await sleep(Math.max(8, 13 / K));
    await touch('touchMove', [{ x: a.x + (100 * i) / n, y: a.y - (60 * i) / n, id: 2 }]);
  }
  await touch('touchEnd', []);
}
const results = [];
async function trial(tag, o, pre = null, post = null) {
  await ready();
  const b = await snap();
  if (pre) await pre();
  const ch0 = await page.evaluate(() => [window.__ch.length, window.__th.length]);
  const h = await hold(o);
  if (post) { await setK(K); await post(); }
  await setK(1);
  await waitSim(1.6); // 내려침 · 기록
  const a = await snap();
  const rec = await page.evaluate(([hl, ev]) => ({ hl: window.__hl.slice(hl), ev: window.__ev.slice(ev).filter((e) => e.ev !== 'pointerup' || true) }), [b.hl, b.ev]);
  const d = diff(b, a);
  const spentD = {};
  for (const k of new Set([...Object.keys(a.spent), ...Object.keys(b.spent)])) { const v = (a.spent[k] ?? 0) - (b.spent[k] ?? 0); if (Math.abs(v) > 1e-6) spentD[k] = +v.toFixed(2); }
  const evSum = {};
  for (const e of rec.ev) evSum[`${e.ev}:${e.tgt}`] = (evSum[`${e.ev}:${e.tgt}`] ?? 0) + 1;
  const toSpent = rec.hl.find((x) => x.to === 'spent');
  const why = d.fired > 0 ? 'fired' : toSpent ? (!toSpent.still ? 'drift' : toSpent.cooling ? 'cooling' : toSpent.secretOpen ? 'secretOpen' : toSpent.busy ? 'busy:' + Object.entries(toSpent.why).filter(([k, v]) => v && k !== 'state' && k !== 'swinging').map(([k]) => k).join('+') : toSpent.exh ? 'exhausted' : 'other') : rec.hl.some((x) => x.to === 'wind') ? 'windNoFire' : rec.hl.some((x) => x.to === 'press') ? 'releasedEarly' : 'noPress';
  const chs = await page.evaluate(([a, b]) => ({ ch: window.__ch.slice(a), th: window.__th.slice(b) }), ch0);
  const r = { tag, ...o, charges: chs.ch, tapCalls: chs.th, stick: !!o.stick, maxd: h.maxd, gameHold: h.gameHold, ok: d.fired > 0, why, ...d, cancel: a.cancel, spentD, ev: evSum, hl: rec.hl };
  delete r.stickFn;
  results.push(r);
  console.log(JSON.stringify({ tag, dur: o.dur, drift: o.drift, ok: r.ok, why, maxd: h.maxd, gameHold: h.gameHold, hl: rec.hl.map((x) => `${x.from}>${x.to}@${x.holdT}`).join(' '), ch: chs.ch.map((c) => `${c.kind}${c.cost}${c.iai ? '/iai' : ''}${c.hold ? '/hold' : ''}`).join(','), th: chs.th.map((c) => `${c.r ? 'ok' : 'no'}${c.iai ? '/iai' : ''}${c.hold ? '/hold' : ''}`).join(','), d, ev: evSum, spentD }));
}
if (SCEN.includes('grid')) {
  let seed = 1;
  for (const dur of DUR) for (const drift of DRIFT) for (let k = 0; k < REPS; k++) await trial('grid', { dur, drift, ang: k % 2 ? 3.6 : 0.5, seed: seed++ });
}
if (SCEN.includes('afterSwing')) {
  let seed = 101;
  for (const gap of [0.1, 0.3]) for (const dur of [0.8, 1.0]) for (const drift of [0, 6]) {
    await trial('afterSwing', { dur, drift, ang: 0.5, seed: seed++, gap }, async () => { await swipe(); await setK(K); await waitSim(gap * 1.1); });
  }
}
if ((SCEN.includes('ring') || SCEN.includes('ringTap')) && S0) {
  // 스틱 둘레 (사장님 10/31 08:xx): 왼 엄지가 원 테 6 · 14 px 밖(둘레 안) — 가만히 · 걸으려고 움직임 → 오른 엄지 1.0 s 누름이 감기를 내나 · 걸었나
  const R = stickBox.width / 2;
  let seed = 401;
  for (const off of SCEN.includes('ring') ? [R + 6, R + 14] : []) {
    // 왼 아래(뒤 · 왼쪽으로 걸음 — 멈춘 상대 쪽으로 다가가 판이 끝나지 않게)
    const st = { at: () => ({ x: S0.x - off * 0.7071, y: S0.y + off * 0.7071 }) };
    await trial('ringStill', { dur: 1.0, drift: 0, ang: 0.5, seed: seed++, stick: st, off: +off.toFixed(0) });
    const st2 = { at: (u) => ({ x: S0.x - off * 0.7071 + 30 * u, y: S0.y + off * 0.7071 }) };
    await trial('ringMove', { dur: 1.0, drift: 0, ang: 0.5, seed: seed++, stick: st2, off: +off.toFixed(0) });
  }
  // 왼 엄지가 둘레 안에 가만히 있는 동안 오른 엄지 탭 하나 — 찌르기가 나가나 (전 판: 왼 엄지가 칼 손가락이라 오른 엄지 탭은 버려짐)
  for (const off of [R + 6, R + 14]) for (const k of [0, 1]) {
    await ready();
    const n0 = await page.evaluate(() => window.__th.length);
    const L = { x: S0.x - off * 0.7071, y: S0.y + off * 0.7071, id: 9 };
    const Rt = { x: W * 0.66 + k * 30, y: H * 0.45, id: 6 };
    await setK(K);
    await touch('touchStart', [L]);
    await sleep(150 / K);
    // 오른 엄지 탭 = 캔버스에 바로 포인터 사건(CDP 는 손가락 하나만 떼지 못함 — cavazione_probe 와 같은 꼴 · pointerType touch · 실제 50 ms)
    await page.evaluate(([x, y]) => {
      const cv = document.querySelector('canvas');
      const o = { pointerId: 77, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, bubbles: true, cancelable: true };
      cv.dispatchEvent(new PointerEvent('pointerdown', o));
      const until = Date.now() + 50;
      while (Date.now() < until) { /* 짧게 */ }
      window.dispatchEvent(new PointerEvent('pointerup', o));
    }, [Rt.x, Rt.y]);
    await sleep(100 / K);
    await touch('touchEnd', []);
    await setK(1);
    await waitSim(0.4);
    const th = await page.evaluate((n) => window.__th.slice(n), n0);
    const ev = await page.evaluate(() => window.__ev.slice(-6).map((e) => e.ev + ':' + e.tgt).join(','));
    const r0 = { tag: 'ringTap', off: +off.toFixed(0), k, thrust: th.filter((x) => x.r).length, calls: th.length, ev };
    results.push(r0);
    console.log(JSON.stringify(r0));
  }
  // 칼 쪽 둘레 바로 밖 탭: 원 가운데에서 R + 15 + 3 · 8 · 20 px · 오른쪽 · 오른 위 · 위 (각 -10 · -45 · -80°)
  for (const extra of SCEN.includes('ring') ? [3, 8, 20] : []) for (const deg of [-10, -45, -80]) {
    const r = R + 15 + extra;
    const pt = { x: S0.x + r * Math.cos((deg * Math.PI) / 180), y: S0.y + r * Math.sin((deg * Math.PI) / 180) };
    await ready();
    const n0 = await page.evaluate(() => window.__th.length);
    const T0 = Date.now() / 1000;
    await setK(K);
    await touch('touchStart', [{ ...pt, id: 5 }], T0);
    await sleep(60 / K);
    await touch('touchEnd', [], T0 + 0.05);
    await setK(1);
    await waitSim(0.4);
    const th = await page.evaluate((n) => window.__th.slice(n), n0);
    const ev = await page.evaluate(() => window.__ev.slice(-3).map((e) => e.ev + ':' + e.tgt).join(','));
    const r0 = { tag: 'sideTap', extra, deg, r: +r.toFixed(1), at: [+pt.x.toFixed(0), +pt.y.toFixed(0)], thrust: th.filter((x) => x.r).length, ev };
    results.push(r0);
    console.log(JSON.stringify(r0));
  }
}
if (SCEN.includes('tapArt')) {
  // 풍차 베기를 낸 뒤(뗌) gap 실제 초에 짧은 탭 (내려침 운동학 칼 · 끝 자세 붙잡기 동안) — 그 탭이 기력을 쓰나 · 찌르기가 보이나
  let seed = 301;
  for (const gap of [0.05, 0.15, 0.3, 0.5]) {
    await trial('tapArt', { dur: 0.9, drift: 0, ang: 0.5, seed: seed++, gap }, null, async () => {
      await waitSim(gap * 1.1);
      const T0 = Date.now() / 1000;
      await touch('touchStart', [{ x: W * 0.6, y: H * 0.5, id: 3 }], T0);
      await sleep(50 / K);
      await touch('touchEnd', [], T0 + 0.04);
    });
  }
}
if ((SCEN.includes('walking') || SCEN.includes('stick')) && S0) {
  let seed = 201;
  for (const dur of SCEN.includes('walking') ? [0.8, 1.0, 1.5] : []) for (const drift of [0, 6]) {
    // 스틱: 뒤 · 옆으로 천천히 (상대에 다가가지 않게) — 손가락이 패드 가운데서 30 px 아래 · 옆으로
    const st = { at: (u) => ({ x: S0.x + 22 * Math.sin(u * 3), y: S0.y + 30 }) };
    await trial('walking', { dur, drift, ang: 0.5, seed: seed++, stick: st });
  }
  // 왼 엄지가 패드 둥근 테 바로 밖(캔버스)에 닿음 — 그 손가락이 칼 손가락이 되나
  const R = stickBox.width / 2;
  for (const dur of [1.0]) for (const off of [R + 6, R + 14]) {
    const st = { at: () => ({ x: S0.x + off * 0.7071, y: S0.y - off * 0.7071 }) };
    await trial('stickMiss', { dur, drift: 0, ang: 0.5, seed: seed++, stick: st, off: +off.toFixed(0) });
    // 걸으려고 그 엄지를 움직임(패드 밖에서 끌기 — 30 px 위로 천천히)
    const st2 = { at: (u) => ({ x: S0.x + off * 0.7071, y: S0.y - off * 0.7071 - 30 * u }) };
    await trial('stickMissMove', { dur, drift: 0, ang: 0.5, seed: seed++, stick: st2, off: +off.toFixed(0) });
  }
}
const cell = {};
for (const r of results) {
  const k = `${r.tag}|${r.dur}|${r.drift}${r.gap != null ? '|g' + r.gap : ''}`;
  (cell[k] ??= { n: 0, ok: 0, why: {} }).n++;
  if (r.ok) cell[k].ok++;
  cell[k].why[r.why] = (cell[k].why[r.why] ?? 0) + 1;
}
fs.writeFileSync(outFile, JSON.stringify({ url, K, kit, learned: save.r, cell, results, errors }, null, 2));
console.log(JSON.stringify({ cell, errors: errors.slice(0, 5) }));
await browser.close();
