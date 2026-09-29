// 브라우저 손짓 층 시험 (R2 W2, GESTURE.on): CDP 터치로 칼 쪽 화면에서 감기(쟁기 → 어깨 지붕) → 뒤집어 긋기(→ 바꿈) → 떼기를 실제 브라우저 길
//  (pointermove → input.js → fingerTrace → main.js 스텝 시각 stepT → Gesture.update)로 넣고, 스텝마다 player.strike 를 적는다.
//  보는 것: 끄는 동안 S 가 오르나 (A), 뒤집힘에서 CUT, 뗀 뒤 S 가 정확히 0, onCommit('B') 한 번, 콘솔 에러 0. ?input=wind 와 ?input=stroke 둘 다.
//  헤드리스는 한 프레임이 길어(≈ 170 ms) 프레임마다 물리 6 스텝(50 ms)만 돈다 — 적힌 스텝 사이에 빈 곳이 있다. 지연·모양은 tools/sim/gesture_eval.mjs 로 본다
//  실행: vite 개발 서버를 띄운 뒤  node tools/browser/gesture_touch.mjs http://127.0.0.1:5173 [--out=폴더]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const outDir = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6);
const W = 320, H = 180; // 작은 창 + 픽셀 모드 (헤드리스 그리기가 가볍게: 한 프레임 ≈ 80 ms)
const PFLUG = [0.18, -0.28], TAG_R = [0.42, 0.42], WECHSEL_L = [-0.4, -0.42]; // gesture_eval 과 같은 zornhau 감기
const argN = (k, d) => +((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
// 헤드리스는 렌더러가 프레임(≈ 100~170 ms)마다 한 번 터치를 받아 조각이 스텝보다 늦게 들어온다 (실기기는 한 프레임 안).
//  손짓 층은 마지막 조각 뒤 한 표본 간격이 지나면 멈춘 손가락으로 보므로, 늦게 온 조각으로는 끄는 동안의 빠르기를 못 본다.
//  그래서 각 터치에 제 시각(CDP timestamp)을 달아 LEAD ms 먼저 보낸다: 조각의 시각은 손가락 길 그대로, 스텝은 제 시각의 자리·빠르기를 읽는다
const V_WIND = argN('vwind', 1.0), V_CUT = argN('vcut', 4.0), GAP = argN('gap', 8), LEAD = argN('lead', 400); // 패드 m/s, 터치 표본 간격 ms, 미리 보내기 ms
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const results = [];
for (const mode of ['wind', 'stroke']) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('gladiator-settings', JSON.stringify({ pixel: true })); } catch {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  await page.goto(`${base}/?input=${mode}&weapon=longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
  if (await page.evaluate(() => window.game.state === 'draw')) await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  const setup = await page.evaluate((PF) => {
    const g = window.game, p = g.player;
    g.ai.update = () => {}; // 적은 가만히
    // 헤드리스 한 프레임(≈ 100~170 ms)에 물리 6 스텝(50 ms)만 돌면 손가락 길의 절반 넘게를 건너뛴다 → 이 시험에서만 프레임 몫(dt ≤ 0.1 s)을 다 돌린다
    g.config.PHYSICS.maxStepsPerFrame = 12;
    // 쟁기 패드에서 시작 (손짓 층의 p 는 손 목표에 맞춰 시작한다)
    const k = p.skill;
    p.handOffset.set(PF[0], PF[1]);
    for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(PF[0], PF[1]);
    k.aimVel.set(0, 0); k.vel.set(0, 0); k.follow.set(0, 0);
    const rec = (window.__rec = []), ev = (window.__ev = []), com = (window.__com = []);
    const step = p.step.bind(p), T = g.input.fingerTrace;
    p.step = (dt) => {
      step(dt);
      const s = p.strike, q = p.ges;
      rec.push([+p.stepT.toFixed(1), s.state, +s.S.toFixed(4), +q.Swind.toFixed(4), +q.Sstroke.toFixed(4), +s.phi.toFixed(3), s.famA, q.held ? 1 : 0, s.c === 1 ? 1 : 0, +q.p[0].toFixed(3), +q.p[1].toFixed(3), +q.o[0].toFixed(3), +q.o[1].toFixed(3), +q.v[0].toFixed(2), +q.v[1].toFixed(2), T.count ? +(p.stepT - T.t[T.idx(0)]).toFixed(1) : null]);
    };
    const oc = p.onCommit;
    p.onCommit = (st, S, fam) => { com.push([+p.stepT.toFixed(1), st, +(+S).toFixed(3), fam]); oc?.(st, S, fam); };
    for (const k2 of ['pointerdown', 'pointermove', 'pointerup']) window.addEventListener(k2, (e) => ev.push([k2[7], +e.timeStamp.toFixed(1), e.clientX, e.clientY]), true);
    const I = window.game.config.INPUT;
    return { input: g.config.GESTURE.input, on: g.config.GESTURE.on, segOn: document.querySelector('[data-setting="gestureInput"] button.on')?.dataset.v, scale: I.touchSensitivity / Math.max(320, innerHeight), ges: !!p.ges, weapon: p.weapon.id };
  }, PFLUG);
  await page.waitForTimeout(600); // 손 목표가 쟁기에 자리 잡게
  const cdp = await ctx.newCDPSession(page);
  // 손가락 길 (화면 px): 패드 +y 위 = 화면 −y
  const X0 = W * 0.72, Y0 = H * 0.62, sc = setup.scale;
  const px = (pad) => [X0 + (pad[0] - PFLUG[0]) / sc, Y0 - (pad[1] - PFLUG[1]) / sc];
  const pts = []; // [ms, x, y]
  const leg = (a, b, v, t0) => { const n = Math.max(1, Math.round((Math.hypot(b[0] - a[0], b[1] - a[1]) / v) * 1000 / GAP)); for (let k = 1; k <= n; k++) pts.push([t0 + k * GAP, ...px([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])]); return t0 + n * GAP; };
  let t = 120; // 대고 잠깐 (쉼 → 원점)
  for (let k = GAP; k <= t; k += GAP) pts.push([k, ...px(PFLUG)]);
  t = leg(PFLUG, TAG_R, V_WIND, t);
  const iRev = pts.length - 1; // 꼭짓점 (이 표본까지 감기)
  t = leg(TAG_R, WECHSEL_L, V_CUT, t);
  const iStop = pts.length - 1;
  for (let k = 1; k <= 12; k++) pts.push([t + k * GAP, ...pts[iStop].slice(1)]); // 댄 채 잠깐
  const tUp = t + 13 * GAP;
  const sends = [];
  const t0 = Date.now() + LEAD; // 손가락 길의 0 ms (벽시계). 터치는 제 시각보다 LEAD 먼저 보낸다
  const at = async (ms) => { const w = t0 + ms - LEAD - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); };
  const ts = (ms) => (t0 + ms) / 1000; // CDP timestamp (epoch s)
  sends.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X0, y: Y0, id: 1 }], timestamp: ts(0) }));
  for (const [ms, x, y] of pts) {
    await at(ms);
    sends.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }], timestamp: ts(ms) }));
  }
  await at(tUp);
  sends.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: ts(tUp) }));
  await Promise.all(sends);
  // 뗀 뒤 S 가 0 이 되고 IDLE 로 돌아갈 때까지 (물리 시계로 FOLLOW → RECOVER → 풀림)
  await page.waitForFunction(() => { const r = window.__rec, l = r[r.length - 1]; return l && l[7] === 0 && l[2] === 0 && l[1] === 0; }, null, { timeout: 60000, polling: 250 }).catch(() => {});
  const { rec, ev, com, tr } = await page.evaluate(() => { const T = window.game.input.fingerTrace, tr = []; for (let k = Math.min(T.count, 200) - 1; k >= 0; k--) { const i = T.idx(k); tr.push([+T.t[i].toFixed(1), +T.x[i].toFixed(4), +T.y[i].toFixed(4), T.flag[i]]); } return { rec: window.__rec, ev: window.__ev, com: window.__com, tr }; });
  const down = ev.find((e) => e[0] === 'd'), up = ev.find((e) => e[0] === 'u');
  const moves = ev.filter((e) => e[0] === 'm'); // 렌더러가 받은 이벤트 (헤드리스는 여러 조각이 한 이벤트로 합쳐진다)
  const tDown = down?.[1], tUpEv = up?.[1], tRev = tDown + pts[iRev][0], tStop = tDown + pts[iStop][0]; // 손가락 길 시각 (터치마다 제 시각)
  const rel = (x) => (x == null ? null : +(x - tDown).toFixed(1));
  const during = rec.filter((r) => r[0] >= tDown && r[0] <= tRev);
  const iCut = rec.findIndex((r) => r[0] >= tDown && r[1] === 2);
  const cut = iCut >= 0 ? rec[iCut] : null;
  const after = rec.filter((r) => r[0] > tUpEv);
  const zero = after.find((r) => r[2] === 0);
  const Smax = Math.max(0, ...rec.filter((r) => r[0] >= tDown).map((r) => r[2]));
  const gaps = moves.slice(1).map((m, i) => m[1] - moves[i][1]);
  const K = {
    mode, setup, errors: errors.length, moves: moves.length, sent: pts.length, pieces: tr.filter((r) => r[0] > tDown && r[0] <= tUpEv && !(r[3] & 2)).length, moveGapMedMs: +[...gaps].sort((a, b) => a - b)[gaps.length >> 1]?.toFixed(1),
    tRev: rel(tRev), tStop: rel(tStop), tUp: rel(tUpEv), upOnTime: tUpEv != null && Math.abs(tUpEv - tDown - tUp) < 2, stepsLogged: rec.filter((r) => r[0] >= tDown).length,
    SwindMaxBeforeRev: Math.max(0, ...during.map((r) => r[3])), SmaxBeforeRev: Math.max(0, ...during.map((r) => r[2])), stateBeforeRev: [...new Set(during.map((r) => r[1]))],
    stateSeq: rec.filter((r) => r[0] >= tDown).reduce((a, r) => (a[a.length - 1] === r[1] ? a : [...a, r[1]]), []),
    cutT: cut ? rel(cut[0]) : null, cutAfterRevMs: cut && tRev != null ? +(cut[0] - tRev).toFixed(1) : null, cutS: cut?.[2], cutFam: cut?.[6],
    Smax, SmaxRel: rel(rec.find((r) => r[0] >= tDown && r[2] === Smax)?.[0]),
    commits: com.map((c) => [rel(c[0]), c[1], c[2], c[3]]),
    zeroAfterLiftMs: zero ? +(zero[0] - tUpEv).toFixed(1) : null, finalS: rec[rec.length - 1]?.[2], finalState: rec[rec.length - 1]?.[1],
    exactZeroAfter: zero ? after.slice(after.indexOf(zero)).every((r) => r[2] === 0) : false,
  };
  K.ok = !errors.length && setup.input === mode && setup.segOn === mode && !!cut && K.commits.length === 1 && K.finalS === 0 && K.exactZeroAfter && K.Smax > 0 && (mode === 'stroke' ? K.SwindMaxBeforeRev === 0 : K.SwindMaxBeforeRev > 0);
  results.push(K);
  if (outDir) fs.writeFileSync(`${outDir}/gesture_touch_${mode}.json`, JSON.stringify({ key: K, cols: ['stepT', 'state', 'S', 'Swind', 'Sstroke', 'phi', 'famA', 'held', 'c1', 'px', 'py', 'ox', 'oy', 'vx', 'vy', 'lagMs'], tDown, rec: rec.filter((r) => r[0] >= tDown - 50), ev, trace: tr.filter((r) => r[0] >= tDown - 50), commits: com, errors }, null, 0));
  await ctx.close();
}
for (const K of results) console.log(`${K.ok ? 'OK ' : 'NG '} ${JSON.stringify(K)}`);
await browser.close();
process.exit(results.every((K) => K.ok) ? 0 : 1);
