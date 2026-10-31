// 고노센 준비 → 창 (사람 · 실제 빌드 · CDP 터치) — 사장님 10/31 08:xx '웅크리기를 없앴더니 고노센 발동창이 안열려.'
//  저장: 개발 서버 쪽에서 금화를 채워 진짜 배우기(skill_tree_store.js learnNode)로 일본 J1 → J2 → J3 → J4 → J5 를 익히고, 그 저장(localStorage 전부)을 빌드 쪽에 그대로 넣음.
//  판: 打刀(일본) · 상대 롱소드(AI 그대로 — 친다) · 844×390 · 터치 기기. 화면 시계를 K 배로 늦춰(requestAnimationFrame · performance.now — 게임 코드는 그대로)
//   소프트웨어 GL 의 긴 프레임이 게임 시간을 깎지 않게 한다. 손가락 사건은 게임 시계에 맞춰 보냄(약 16 ms 게임 시간마다 한 번).
//  스텝마다(PlayerSecretWatch.update 를 감쌈 — 판정은 게임 그대로 · 읽기만): 준비 켜짐 · 꺼짐 · 셈이 0 으로 돌아간 때와 그 까닭(휘두름 · 탭 · 손잡이 · 비기 · 막기 단추 ·
//   맞음 · 비기 실행 · 걸음 뜻 · 판 시작 정지 · 다 씀 · 넘어짐) · 창이 열린 때(사건 · 가슴 사이) · AI 공격 시작(그때 준비였나 · 가슴 사이 · 발도 선) ·
//   화면에 보이는 것(② 줄 글 · 꼴 · 흐림 · 금색 '!' · 웅크림 무게 · 손 덧씌우기 · 칼 자리 — 5 번 / 게임 초)
//  손가락 갈래(SCEN): none(손 뗌) · stick(엄지를 스틱에 얹음 — 가운데에서 STICKOFF px · 떨림) · sword(칼 쪽 화면에 손가락을 얹음 — 떨림 · 천천히 떠돎 DRIFT px) ·
//   both · play(다가가 멈추고 기다림 — 스틱 엄지는 떼고 칼 손가락은 얹음 · 창이 뜨면 REACT 초 뒤 그음 · FIRE=1 일 때)
//  실행: 빌드(vite build --outDir <폴더>) → vite preview --outDir <폴더> --port <빌드 포트> & · 개발 서버(배우기만 — 파일 감시 끈 설정) --port <개발 포트> &
//        node tools/browser/gonosen_window_probe.mjs http://127.0.0.1:<빌드 포트> http://127.0.0.1:<개발 포트> [결과 json (기본 .tmp/gns_window/probe.json)]
//   환경: CROUCH(1,0 — ?gnsCrouch=) · SCEN(none,stick,sword,both,play) · DUR(40 게임 초 한 판) · K(0.2) · FIRE(0 — 1 이면 창에서 그어 냄) · REACT(0.25 실제 초)
//         STICKOFF(4 px) · DRIFT(4 px) · JIT(0.6 px) · EXTRA(주소 덧붙임) · WEAPON(uchigatana) · FOE(longsword)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5872';
const dev = process.argv[3] || 'http://127.0.0.1:5871';
const outFile = process.argv[4] || '.tmp/gns_window/probe.json';
const E = process.env;
const K = +(E.K || 0.2);
const CROUCH = (E.CROUCH || '1,0').split(',').map(Number);
const SCEN = (E.SCEN || 'none,stick,sword,both,play').split(',');
const DUR = +(E.DUR || 40);
const FIRE = E.FIRE === '1';
const REACT = +(E.REACT || 0.25);
const STICKOFF = +(E.STICKOFF ?? 4);
const DRIFT = +(E.DRIFT ?? 4);
const JIT = +(E.JIT ?? 0.6);
const EXTRA = E.EXTRA || '';
const WEAPON = E.WEAPON || 'uchigatana';
const FOE = E.FOE || 'longsword';
const W = 844, H = 390;
fs.mkdirSync(outFile.replace(/\/[^/]*$/, ''), { recursive: true });
const browser = await chromium.launch({ executablePath: E.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
// ① 진짜 배우기 (개발 서버 — 모듈을 직접 부름 · 값을 치르고 앞 칸부터)
const dctx = await browser.newContext({ viewport: { width: W, height: H } });
const dpage = await dctx.newPage();
await dpage.goto(`${dev}/?weapon=${WEAPON}`, { waitUntil: 'networkidle' });
await dpage.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
const save = await dpage.evaluate(async () => {
  const P = await import('/src/lobby_progress.js');
  const S = await import('/src/skill_tree_store.js');
  P.setCoins(100000);
  P.setHeads(100);
  const r = {};
  for (const id of ['J1', 'J2', 'J3', 'J4', 'J5']) r[id] = S.learnNode('japanese', id);
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  return { r, learned: [...(S.readLearned().japanese ?? [])], ls };
});
await dctx.close();
console.log(JSON.stringify({ learned: save.r, now: save.learned }));
if (!save.learned.includes('J5')) throw Error('J5 못 배움 ' + JSON.stringify(save.r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function run(crouch, scen) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(([ls]) => {
    try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch { /* */ }
    const raf = window.requestAnimationFrame.bind(window);
    const pn = performance.now.bind(performance);
    let last = pn(), acc = last;
    window.__timeK = 1;
    const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
    performance.now = clock;
    window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  }, [save.ls]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const url = `${base}/?weapon=${WEAPON}&foeWeapon=${FOE}&slowMo=0&camOpen=old&gnsCrouch=${crouch}${EXTRA}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 240000 });
  const kit = await page.evaluate(() => {
    const g = window.game, ps = g.playerSecret, p = g.player, e = g.enemy, ai = g.ai, C = g.config.SECRET;
    const L = (window.__gl = { tr: [], resets: [], opens: [], atk: [], samples: [], fires: [], wounds: [], armedT: 0, liveT: 0, steps: 0, t0: g.stats.simTime });
    let prevPain = p.pain, lastMode = ai.mode, sampleAt = 0, armT0 = null, maxT = 0;
    const V0 = ps.view();
    const line = V0.contact + C.iaiStep + C.iaiMargin;
    const chestD = () => { const a = p.bodies.chest.translation(), b = e.bodies.chest.translation(); return Math.hypot(a.x - b.x, a.z - b.z); };
    const slot = () => { const el = document.querySelector('#techSlot .slot'); if (!el) return null; const cs = getComputedStyle(el); return { text: el.textContent.trim(), kind: el.dataset.kind ?? null, show: el.classList.contains('show'), opacity: +cs.opacity, visible: el.classList.contains('show') && document.getElementById('techCue')?.classList.contains('show') }; };
    const orig = ps.update.bind(ps);
    ps.update = function (dt, busy) {
      const A = ps.iaiArm, sk = p.skill, T = g.stats.simTime;
      const t0 = A.t, a0 = A.armed, op0 = ps.opened, sec0 = sk.sec;
      const hurt = p.pain > prevPain + 0.05;
      prevPain = p.pain;
      const why = { swing: !!sk.swinging, tap: !!sk.tap, pom: !!sk.pom, sec: !!sk.sec, parry: !!p.parryGuard?.held, hurt, busy: !!busy, move: Math.hypot(p.stickX || 0, p.stickY || 0) > 0, hold: !!p.openHold, spent: ps.left <= 0, notStand: p.state !== 'stand' || !p.alive || !p.armed, foeDown: !e.alive || e.state !== 'stand' };
      const r = orig(dt, busy);
      L.steps++;
      const live = p.alive && e.alive && p.state === 'stand' && e.state === 'stand' && !p.openHold;
      if (live) L.liveT += dt;
      if (A.armed) L.armedT += dt;
      maxT = Math.max(maxT, A.t);
      if (A.armed !== a0) { L.tr.push({ T: +T.toFixed(3), armed: A.armed, d: +chestD().toFixed(2), why: A.armed ? null : Object.keys(why).filter((k) => why[k]) }); if (A.armed) armT0 = T; }
      if (t0 > 0 && A.t === 0 && !A.armed) {
        const w = Object.keys(why).filter((k) => why[k] && !(k === 'move' && a0));
        L.resets.push({ T: +T.toFixed(3), t: +t0.toFixed(3), armed: a0, why: w.length ? w : ['?'], hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], vel: +sk.vel.length().toFixed(2), held: !!p.handHeld, act: !!p.inputActive });
      }
      if (ps.opened !== op0 && ps.open) L.opens.push({ T: +T.toFixed(3), ev: ps.open.ctx?.ev ?? null, charge: !!ps.open.ctx?.charge, d: +chestD().toFixed(2), line: +line.toFixed(2), armedFor: armT0 != null ? +(T - armT0).toFixed(2) : null });
      if (ai.mode === 'attack' && lastMode !== 'attack') L.atk.push({ T: +T.toFixed(3), d: +chestD().toFixed(2), line: +line.toFixed(2), armed: A.armed, t: +A.t.toFixed(2), wary: !!ai.gnsW?.ready, plan: ai.gnsW?.plan?.kind ?? null });
      lastMode = ai.mode;
      if (sk.sec && sk.sec !== sec0) L.fires.push({ T: +T.toFixed(3), name: sk.sec.S?.name ?? null, d: +chestD().toFixed(2), w0: e.wounds?.length ?? 0 });
      if (T >= sampleAt) {
        sampleAt = T + 0.2;
        const tip = p.bladePoint(1, new g.THREE.Vector3()), pel = p.bodies.pelvis.translation(), head = p.bodies.head.translation();
        const cue = g.strikeCue?.state ?? null;
        L.samples.push({ T: +T.toFixed(2), armed: A.armed, t: +A.t.toFixed(2), open: !!ps.open, crouchW: +(p.iaiReadyW ?? 0).toFixed(2), handW: +(p.skill.thrustPose?.w ?? 0).toFixed(2), pelY: +pel.y.toFixed(2), headY: +head.y.toFixed(2), tipY: +tip.y.toFixed(2), d: +chestD().toFixed(2), aiMode: ai.mode, slot: slot(), cueOpen: cue?.open ?? null, cueGold: cue?.gold ?? null, held: !!p.handHeld, act: !!p.inputActive, stick: [+(p.stickX || 0).toFixed(2), +(p.stickY || 0).toFixed(2)], stam: +p.stamina.value.toFixed(0), left: ps.left });
      }
      return r;
    };
    // 판이 바뀌면 (새 Fighter · 새 창) 감싼 것이 사라진다 — 이 도구는 한 판만 본다
    return { tradition: p.swordArt?.tradition, weapon: p.weapon?.id, secret: ps.S?.name ?? null, foe: e.weapon?.id, foeName: e.name, aiLevel: ai.level ?? null, crouch: C.gnsCrouch, line: +line.toFixed(2), foeReach: +V0.foeReach.toFixed(2), armTime: C.iaiArmTime };
  });
  console.log(JSON.stringify({ crouch, scen, kit }));
  if (kit.secret !== 'goNoSen') throw Error('고노센 아님 ' + JSON.stringify(kit));
  const cdp = await ctx.newCDPSession(page);
  const stickBox = await page.locator('#moveStick').boundingBox();
  const SC = { x: stickBox.x + stickBox.width / 2, y: stickBox.y + stickBox.height / 2 };
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 18, radiusY: 18, force: 0.5 })) });
  const simT = () => page.evaluate(() => game.stats.simTime);
  const st = () => page.evaluate(() => { const g = game, ps = g.playerSecret; return { T: g.stats.simTime, armed: !!ps?.iaiArm?.armed, open: !!ps?.open, opened: ps?.opened ?? 0, d: g.player.foeDistance(), fight: g.state === 'fight', alive: g.player.alive && g.enemy.alive, sec: !!g.player.skill.sec, left: ps?.left ?? 0 }; });
  await page.evaluate((k) => { window.__timeK = k; }, K);
  // 손가락 자리
  const seed = scen.length * 7 + crouch;
  const noise = (u, s) => Math.sin(s * 12.9898 + u * 91.7) * JIT;
  const thumb = { id: 9, x: SC.x + STICKOFF * 0.6, y: SC.y - STICKOFF * 0.8 };
  const finger = { id: 1, x: W * 0.7, y: H * 0.45 };
  const useStick = scen === 'stick' || scen === 'both';
  const useSword = scen === 'sword' || scen === 'both' || scen === 'play';
  const down = [];
  const pts = (T) => {
    const out = [];
    const u = T - g0;
    if (thumbDown) out.push({ id: 9, x: (walk ? SC.x : thumb.x) + noise(u, seed) + 0.5 * Math.sin(u * 0.7), y: (walk ? SC.y - 30 : thumb.y) + noise(u, seed + 1) });
    if (fingerDown) {
      const drift = DRIFT * (0.5 - 0.5 * Math.cos(Math.min(1, (u % 9) / 6) * Math.PI)); // 천천히 떠돎 (9 s 마다 처음 자리로 — 손가락을 고쳐 얹음)
      out.push({ id: 1, x: finger.x + drift * 0.8 + noise(u, seed + 2) + swipeDx, y: finger.y + drift * 0.6 + noise(u, seed + 3) + swipeDy });
    }
    return out;
  };
  let thumbDown = false, fingerDown = false, walk = false, swipeDx = 0, swipeDy = 0;
  const g0 = await simT();
  if (useStick) { thumbDown = true; await touch('touchStart', pts(g0)); }
  if (useSword) { fingerDown = true; await touch('touchStart', pts(g0)); }
  let due = null, seen = 0, fired = 0;
  for (;;) {
    await sleep(Math.max(8, 16 / K));
    const s = await st();
    if (!s.fight || s.T - g0 > DUR) break;
    // play: 멀면 스틱으로 다가감(엄지를 스틱 위로 · 가슴 사이가 발도 선 + 0.6 m 안이 될 때까지) · 그 뒤 엄지를 뗌
    if (scen === 'play') {
      const want = s.d > kit.line + 0.6 && !s.armed;
      if (want && !thumbDown) { thumbDown = true; walk = true; await touch('touchStart', pts(s.T)); }
      else if (!want && thumbDown) { thumbDown = false; walk = false; await touch('touchEnd', pts(s.T).filter((p) => p.id !== 9)); }
    }
    if (s.opened !== seen) { seen = s.opened; if (s.open && FIRE && s.left > 0) due = s.T + REACT * 1.1; }
    if (due != null && s.T >= due && !s.sec) {
      due = null;
      // 긋기: 손가락이 얹혀 있으면 그 자리에서 아래로 빠르게 · 없으면 새로 닿아 긋기
      if (!fingerDown) { fingerDown = true; await touch('touchStart', pts(s.T)); }
      for (let i = 1; i <= 4; i++) { swipeDx = -10 * i; swipeDy = 30 * i; await touch('touchMove', pts(s.T)); await sleep(Math.max(4, 8 / K)); }
      swipeDx = swipeDy = 0;
      fired++;
      if (!useSword) { fingerDown = false; await touch('touchEnd', pts(s.T).filter((p) => p.id !== 1)); }
      continue;
    }
    if (thumbDown || fingerDown) await touch('touchMove', pts(s.T));
  }
  if (thumbDown || fingerDown) await touch('touchEnd', []);
  await page.evaluate(() => { window.__timeK = 1; });
  const L = await page.evaluate(() => {
    const g = window.game, e = g.enemy;
    const L = window.__gl;
    for (const f of L.fires) f.wounds = (e.wounds ?? []).slice(f.w0).map((w) => `${w.part}:${w.type}:${(w.severity ?? 0).toFixed(1)}`);
    L.end = { T: g.stats.simTime, pAlive: g.player.alive, eAlive: e.alive, state: g.state };
    return L;
  });
  const why = {};
  for (const r of L.resets) for (const k of r.why) why[k] = (why[k] ?? 0) + 1;
  const tOver = (a) => L.resets.filter((r) => r.t >= a).length;
  const visArmed = L.samples.filter((x) => x.armed);
  const sum = {
    crouch, scen, liveT: +L.liveT.toFixed(1), armedT: +L.armedT.toFixed(1), armedShare: L.liveT ? +(L.armedT / L.liveT).toFixed(2) : 0, armOns: L.tr.filter((x) => x.armed).length,
    resets: L.resets.length, resetWhy: why, resetsAfter1s: tOver(1), opens: L.opens.length, opensPerMin: L.liveT ? +((60 * L.opens.length) / L.liveT).toFixed(2) : 0, openEv: L.opens.map((o) => o.ev),
    firstOpenT: L.opens[0] ? +(L.opens[0].T - L.t0).toFixed(1) : null, atk: L.atk.length, atkArmed: L.atk.filter((a) => a.armed).length, atkArmedInLine: L.atk.filter((a) => a.armed && a.d <= a.line).length, atkInLine: L.atk.filter((a) => a.d <= a.line).length,
    fires: L.fires.map((f) => ({ T: f.T, d: f.d, wounds: f.wounds })), firedSwipes: fired,
    seenArmed: { n: visArmed.length, slotShown: visArmed.filter((x) => x.slot?.visible && x.slot?.kind === 'secretArm').length, slotTexts: [...new Set(visArmed.map((x) => x.slot?.visible ? `${x.slot.kind}:${x.slot.text}` : 'hidden'))].slice(0, 4), crouchW: visArmed.length ? +(visArmed.reduce((s, x) => s + x.crouchW, 0) / visArmed.length).toFixed(2) : null, handW: visArmed.length ? +(visArmed.reduce((s, x) => s + x.handW, 0) / visArmed.length).toFixed(2) : null, opacity: visArmed.find((x) => x.slot?.visible)?.slot?.opacity ?? null },
    end: L.end, errors: errors.slice(0, 5),
  };
  console.log(JSON.stringify(sum));
  results.push({ ...sum, kit, log: L });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 1));
  await ctx.close();
}
for (const scen of SCEN) for (const c of CROUCH) await run(c, scen);
await browser.close();
