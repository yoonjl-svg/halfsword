// ─────────────────────────────────────────────────────────────
//  motion_regress.mjs — 사람 고유 공격 · 특수 공격 · 비기 길 재기 (11/18 — 기록 docs/strike/motion_regress_2026-11-18.md)
//   사장님 11/17 '물리가 변하면서 고유공격, 특수공격, 비기 길이나 빠르기 같은 게 좀 달라진 거 같아' — 11/16 끝(54299e65)과 지금을 같은 입력으로 견주는 도구. 재기만 한다.
//   사람 몸(0 번)을 main.js playerInputFrame 차례 그대로 몬다: 실제 src/input.js Input 에 터치 사건(844 × 390) · attachStick(스틱) ·
//   PlayerUniqueAssist · PlayerParryGuard · PlayerSecretWatch (모든 칸을 익힌 몸 — kitFromNodes(유파, 모든 칸)) · 물리 스텝마다 비기 창 · 막기 단추.
//   상대는 AI 를 멈추고 서 있기만(손 대본이 있는 수는 상대 손을 프레임마다 옮김 — AI 없음 · 빌드가 바뀌어도 같은 상대).
//   수 이름: 맨 이름 = 허공(상대 3.2 m) · …Near = 손을 시작 자리에 쥔 채 칼끝 거리 − 0.15 m 까지 걸어 들어가 긋기(맞음 — C 물리가 닿는 판) ·
//    …Trig = 조건 길(상대가 걸어 듦 · 밀치기 · 상대 베기 · 칼 맞댐 — 창이 열리는 때 · 거리) · tapDirect · secretDirect = 실행부 곧장(uq.launchTap · skill.secret).
//   수마다: 낸 때(입력 시작)부터 그 수가 도는 동안 (+ 손가락 긋기는 칼끝이 1.5 m/s 밑으로 가라앉을 때까지 0.4 s 안) — 걸린 게임 초 dur · 칼끝 길 path (m) ·
//    칼끝 최고 vmax · 평균 vmean (m/s) · 낸 이름 fired · 내가 낸 맞음 hits · 칼끝 흔적(--json 의 trail — 게임 초 · 월드 m).
//  node tools/sim/motion_regress.mjs [수 이름,…] [--json=파일]
//   다른 체크아웃을 같은 도구로: MR_ROOT=<체크아웃> node tools/sim/motion_regress.mjs …  · 재기 전용 수 덮어쓰기: MR_CFG=STRIKE.stepMass:0,STRIKE.bladeW0:1 (C 물리 뺀 판)
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const ROOT = process.env.MR_ROOT ? pathToFileURL(process.env.MR_ROOT.replace(/\/?$/, '/')).href : new URL('../../', import.meta.url).href;
const imp = (p) => import(new URL(p, ROOT).href);
const { newRound, CONFIG, DT, THREE } = await imp('tools/sim/harness_m.mjs');
const { PlayerUniqueAssist } = await imp('src/unique_assist.js');
const { PlayerParryGuard } = await imp('src/parry_button.js');
const { PlayerSecretWatch } = await imp('src/secret.js');
const { Input, attachStick } = await imp('src/input.js');
const { allNodeIds, kitFromNodes } = await imp('src/skill_tree_data.js');
const { closeInputGate, closeInputApply } = await imp('src/close_hold.js');
const { drawInput, drawTapTake } = await imp('src/iai_obi.js');
const { TECH_BY_NAME, G: PADS } = await imp('src/ai_techniques.js');
const { LOOKS } = await imp('src/looks.js');
const { TRADITIONS, playerSecretDef } = await imp('src/schools.js');

const K = CONFIG.TIME.k; // 실제 초 → 게임 초 (템포 1.1)
// 재기 전용 수 덮어쓰기 MR_CFG=PATH:수,… (예: STRIKE.stepMass:0,STRIKE.bladeW0:1 — C 물리를 뺀 판으로 견줌)
for (const kv of (process.env.MR_CFG ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split(':');
  const keys = path.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o?.[k];
  if (o && keys.at(-1) in o) o[keys.at(-1)] = +v;
  else console.error('MR_CFG: no such key', path);
}
const FR = 1 / 60; // 입력 프레임 (실제 s)

// ── 브라우저 껍데기 (Input · attachStick 이 읽는 것만 — step_input_measure.mjs 와 같음) ──
const win = { innerWidth: 844, innerHeight: 390, addEventListener() {}, location: { search: '' } };
function inputEnv(fn) {
  const had = Object.hasOwn(globalThis, 'window');
  const old = globalThis.window;
  globalThis.window = win;
  try {
    return fn();
  } finally {
    if (had) globalThis.window = old;
    else delete globalThis.window;
  }
}
globalThis.document ??= { pointerLockElement: null };
globalThis.matchMedia ??= () => ({ matches: true });
function evTarget(rect = null) {
  const H = {};
  return {
    H,
    style: {},
    addEventListener(k, fn) { (H[k] ??= []).push(fn); },
    fire(k, e) { for (const fn of H[k] ?? []) fn(e); },
    getBoundingClientRect: () => rect ?? { left: 0, top: 0, width: 0, height: 0 },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => true,
  };
}
const STICK_RECT = { left: 20, top: 260, width: 110, height: 110 };
const STICK_R = 40;

/** 판 하나: 사람 몸 · 상대(멈춤) · 입력 껍데기 · main.js 프레임 차례 */
function makeRig({ school, weapon, gap = 3.2, seed = 3, foeWeapon = 'longsword' }) {
  const kit = kitFromNodes(school, allNodeIds(school));
  const G = newRound({ seed, weapon, weapon2: foeWeapon, walls: true, gap, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  G.ai.update = () => {};
  const P = G.player;
  const E = G.enemy;
  E.strength = 1; // 멈춘 상대 몸은 11/16 판 그대로(숙련 3 = 보통 힘 1 · 버티는 힘 1) — 숙련도별 몸 값(E · config PROF_BODY 3 칸 0.8)이면 상대 칼 · 몸이 처져 사람 수 길이 바뀜. 이 도구는 사람 수만 견줌
  E.vitality = 1;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.autoGuard = true;
  P.canShove = true;
  const sec = new PlayerSecretWatch(P, E, { locked: !kit?.secret });
  const guard = new PlayerParryGuard(P, E);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: kit?.unique ?? new Set() });
  const canvas = evTarget();
  const input = inputEnv(() => new Input(canvas));
  input.enabled = true;
  const pad = evTarget(STICK_RECT);
  inputEnv(() => attachStick(input, pad, { style: {} }));
  const R = { G, P, E, uq, sec, guard, input, kit, school, weapon, rows: [], marks: {}, log: [], secretFired: [] };
  // ── 오른 엄지 (칼) ──
  let fx = 620, fy = 180, down = false, tms = 1;
  const ev = (kind, x, y) => ({ pointerId: 1, pointerType: 'touch', button: 0, timeStamp: (tms = Math.max(tms + 1, (G.t / K) * 1000)), type: kind, clientX: x, clientY: y, target: canvas });
  R.down = () => { if (down) return; fx = 620; fy = 180; inputEnv(() => input.onDown(ev('pointerdown', fx, fy))); down = true; };
  R.up = () => { if (!down) return; inputEnv(() => input.onUp(ev('pointerup', fx, fy))); down = false; };
  R.move = (dx, dy) => {
    if (!down) R.down();
    const sc = CONFIG.INPUT.touchSensitivity / 390;
    fx += dx / sc;
    fy -= dy / (sc * input.mobileIntent.verticalGain);
    inputEnv(() => input.onMove(ev('pointermove', fx, fy)));
  };
  R.isDown = () => down;
  // ── 왼 엄지 (스틱) ──
  let thumb = null;
  const cx = STICK_RECT.left + STICK_RECT.width / 2, cy = STICK_RECT.top + STICK_RECT.height / 2;
  R.stick = (p) => {
    const e = (k) => ({ pointerId: 2, pointerType: 'touch', clientX: cx + (p ? p[0] : 0) * STICK_R, clientY: cy - (p ? p[1] : 0) * STICK_R, type: k, target: pad, stopPropagation() {} });
    if (p && !thumb) pad.fire('pointerdown', e('pointerdown'));
    else if (p) pad.fire('pointermove', e('pointermove'));
    else if (thumb) pad.fire('pointerup', e('pointerup'));
    thumb = p;
  };
  R.guardHeld = false;
  // ── main.js playerInputFrame 차례 (막기 단추 · 비기 · 고유 · 길게 누름) ──
  const frame = () => {
    const player = P;
    const dt = FR;
    const d = input.consumeHandDelta();
    const exhausted = player.stamina.exhausted;
    if (exhausted) { d.x = 0; d.y = 0; }
    input.tapOnDown = !!player.weapon?.gun;
    let taps = input.consumeTaps();
    if (exhausted) taps = 0;
    const swipe = Math.hypot(d.x, d.y) / Math.max(dt, 1e-3) >= CONFIG.SKILL.swingSpeed;
    const closeGate = closeInputGate(player, sec);
    let secBusy = exhausted || !!player.skill.secretPhase || closeGate.lock;
    const secSwipe = swipe && !sec?.S?.do?.tapOnly;
    const atkWin = !!sec?.open && !(sec.stickOwns?.() ?? false) && !(sec.circleOwns?.() ?? false) && !sec.holdOwns();
    const secArm = !((CONFIG.SECRET.secretHold ?? 1) && (player.skill.tap || player.skill.pom));
    if (atkWin && (taps > 0 || secSwipe) && !secBusy && player.alive && secArm && closeGate.secretOk) {
      const o = sec.fire();
      if (o) o.dir = [d.x, d.y];
      if (player.skill.secret(o)) { secBusy = true; R.secretFired.push({ t: G.t, name: o?.S?.name ?? null, ev: o?.ctx?.ev ?? null }); }
    }
    const prD = input.press;
    const parryDown = R.guardHeld;
    if (player.alive && drawInput(player, { taps, grip: prD && !prD.mouse ? prD.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : Math.abs(d.x) + Math.abs(d.y) > 1e-5, guard: parryDown }, secBusy)) {
      secBusy = true;
      d.x = 0;
      d.y = 0;
    } else if (drawTapTake(player) && !secBusy) taps++;
    if (player.alive && (closeGate.lock || !secBusy) && closeInputApply(player, closeGate, d, taps, swipe, dt)) taps = 0;
    if (!secBusy && player.alive && (taps > 0 || swipe) && sec?.canBuffer()) sec.buffer([d.x, d.y]);
    const bufHold = !secBusy && !!sec?.bufferHold;
    if (secBusy || bufHold) taps = 0;
    let guardHold = false;
    player.pickupPress = parryDown;
    {
      const Gd = guard;
      Gd.held = parryDown && !player.iaiDraw;
      if (Gd.broken && (!Gd.held || (!player.skill.swinging && !player.skill.tap && !swipe && taps === 0))) Gd.broken = false;
      if (Gd.held && !bufHold && (swipe || taps > 0)) Gd.broken = true;
      guardHold = Gd.held && !Gd.broken && !secBusy;
    }
    player.skill.uniq?.feed(d.x, d.y, dt, guardHold || bufHold || !!guard?.held, guardHold || bufHold);
    if (player.skill.uniq?.holdE) {
      const hs0 = input.holdState();
      const hs = closeGate.lock || closeGate.near ? { ...hs0, down: false } : hs0;
      player.skill.uniq.holdInput(hs.down && !exhausted, hs.still, !!sec?.open, !!sec?.holdOwns());
    }
    const winding = !!player.skill.uniq?.winding;
    if (player.alive && !player.weapon?.gun && !secBusy && !guardHold && !bufHold && !winding) {
      player.handOffset.x += d.x;
      player.handOffset.y += d.y;
    }
    player.handHeld = input.activeTouch !== null;
    player.inputActive = !secBusy && !bufHold && !winding && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    const pr = input.press;
    player.handGrip = pr && !pr.mouse ? pr.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : player.inputActive;
    if (taps > 0 && player.alive) player.skill.thrust();
    const m = input.move;
    const feet = player.alive && !exhausted && player.skill.secretPhase !== 'stiff';
    player.move.set(feet ? m.x : 0, feet ? m.y : 0);
    player.stickX = feet ? m.x : 0;
    player.stickY = feet ? m.y : 0;
  };
  G.before = () => {
    sec.update(DT, !!P.skill.sec);
    if (sec.queued && !P.skill.sec && P.alive) {
      const o = sec.fire();
      if (o && P.skill.secret(o)) R.secretFired.push({ t: G.t, name: o?.S?.name ?? null, ev: o?.ctx?.ev ?? null, queued: 1 });
    }
    guard.step(DT);
  };
  const tip = new THREE.Vector3(), hilt = new THREE.Vector3();
  const watch = () => {
    P.bladePoint(1, tip);
    P.bladePoint(0, hilt);
    const sk = P.skill;
    R.rows.push({
      t: G.t,
      tip: [tip.x, tip.y, tip.z],
      hilt: [hilt.x, hilt.y, hilt.z],
      iai: P.iai ? P.iai.kind ?? 1 : 0,
      sec: sk.sec ? sk.sec.stage ?? 1 : 0,
      tap: sk.tap ? 1 : 0,
      link: P.ibLink ? 1 : 0,
      wind: uq.winding ? 1 : 0,
      uq: uq.r ? uq.r.e.name : 0,
      sw: sk.swinging ? 1 : 0,
      st: P.state,
      hold: (P.iaiHoldT ?? 0) > 0 || (P.iaiFade ?? 0) > 0 ? 1 : 0,
    });
  };
  let nextFrame = 0;
  R.frames = (n, cb) => {
    let k = 0;
    for (;;) {
      if (G.t / K >= nextFrame - 1e-8) {
        if (k >= n) return;
        cb?.(k);
        frame();
        nextFrame += FR;
        k++;
      }
      G.step();
      watch();
    }
  };
  R.wait = (realS, cb) => R.frames(Math.max(1, Math.round(realS / FR)), cb);
  R.mark = (k) => (R.marks[k] = G.t);
  /** 손가락을 패드 자리 p 로 (빠르기 v 패드 m/s — 휘두르기 문턱 밑이면 자리 옮김) · onFrame(번호) */
  R.to = (p, v, onFrame) => {
    const q = [];
    let hx = P.handOffset.x, hy = P.handOffset.y;
    for (let j = 0; j < 600; j++) {
      const dx = p[0] - hx, dy = p[1] - hy, dd = Math.hypot(dx, dy);
      if (dd < 1e-7) break;
      const s = Math.min(dd, v * FR);
      q.push([(dx / dd) * s, (dy / dd) * s]);
      hx += (dx / dd) * s;
      hy += (dy / dd) * s;
    }
    if (q.length) R.frames(q.length, (k) => { onFrame?.(k); R.move(q[k][0], q[k][1]); });
    return q.length;
  };
  /** 한 획: 바탕 기술 T 의 시작 자리로 천천히 · 멈춤 · 길 점마다 빠르게 (v 패드 m/s) — 긋기 시작에 mark('start') */
  R.strokeOf = (T, { v = 4.5, pause = 4, onSwipe = null, slow = true, lift = true } = {}) => {
    R.down();
    if (slow) R.to(T.from, CONFIG.SKILL.recoverSpeed * 0.9);
    R.frames(pause);
    R.mark('start');
    let n = 0;
    for (const p of T.path) n += R.to(p, v, (k) => onSwipe?.(n + k));
    if (lift) { R.frames(2); R.up(); }
  };
  R.tap = () => { R.up(); R.frames(1); R.down(); R.frames(1); R.up(); };
  return R;
}

// ── 재기 ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
/** 낸 때 t0 부터 수가 도는 동안(active 마지막 스텝까지) + tail 게임 초 안에서 칼끝이 1.5 m/s 밑으로 0.1 s 가라앉을 때까지 */
function measure(R, t0, active, { maxT = 2.5, tail = 0 } = {}) {
  const rows = R.rows.filter((r) => r.t >= t0 - 1e-9 && r.t <= t0 + maxT + 1e-9);
  if (rows.length < 2) return null;
  let lastAct = -1;
  rows.forEach((r, i) => { if (active(r)) lastAct = i; });
  let end = Math.max(1, lastAct);
  if (tail > 0) {
    let calm = 0;
    for (let i = end + 1; i < rows.length && rows[i].t - rows[end].t <= tail + 1e-9; i++) {
      const v = len3(sub(rows[i].tip, rows[i - 1].tip)) / DT;
      calm = v < 1.5 ? calm + DT : 0;
      end = i;
      if (calm >= 0.1) break;
    }
  }
  const W = rows.slice(0, end + 1);
  let path = 0, vmax = 0;
  for (let i = 1; i < W.length; i++) {
    const s = len3(sub(W[i].tip, W[i - 1].tip));
    path += s;
    vmax = Math.max(vmax, s / DT);
  }
  const dur = W.at(-1).t - W[0].t;
  const actDur = lastAct >= 0 ? rows[lastAct].t - rows[0].t : 0;
  const disp = len3(sub(W.at(-1).tip, W[0].tip));
  const trail = W.filter((_, i) => i % 3 === 0 || i === W.length - 1).map((r) => [+(r.t - t0).toFixed(3), ...r.tip.map((x) => +x.toFixed(3))]);
  return { dur: +dur.toFixed(3), act: +actDur.toFixed(3), path: +path.toFixed(3), vmax: +vmax.toFixed(2), vmean: +(dur > 0 ? path / dur : 0).toFixed(2), disp: +disp.toFixed(3), trail };
}
function dbg(R, t0) {
  for (const w of R.G.wounds) console.log('  wound', (w.t - t0).toFixed(3), w.att.name, '->', w.vic.name, w.zone, w.type, w.energy.toFixed(1), (w.severity ?? 0).toFixed(3));
  console.log('  hits', R.G.hits.join(' | '));
  let prev = null;
  for (const r of R.rows) { if (r.t < t0 - 1e-9 || r.t > t0 + 0.9) continue; if (prev) { const v = len3(sub(r.tip, prev.tip)) / DT; if ((Math.round((r.t - t0) / DT) % 4) === 0 || v > 20) console.log('  t', (r.t - t0).toFixed(3), 'v', v.toFixed(1), 'st', r.st, 'uq', r.uq, 'sw', r.sw, 'E', R.E.state, 'armed', R.P.armed); } prev = r; }
}
const firedSince = (R, f0) => Object.entries(R.uq.stats.fired).flatMap(([k, v]) => Array.from({ length: v - (f0[k] ?? 0) }, () => k));

function settle(R) {
  R.wait(1.3); // 판 시작 정지 지나기
  let n = 0;
  while (R.P.openHold && n++ < 40) R.wait(0.1);
}

// ── 수 대본 ──
const W = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'qinggang' };
const STEP_STICK = (R, side, a = 0.8) => (k) => { if (k === 0) R.stick(side === 'fwd' ? [0, a] : side === 'back' ? [0, -a] : [a * side, 0]); };
/** 손가락 긋기로 내는 고유 공격 (걸음 · 강화): base 기술 · stick 'side' 1 · 'fwd' · null */
function fingerMove({ school, name, base, stick = null, gap = 3.2, v = 4.5, stickLead = 0.1, near = 0 }) {
  return () => {
    const R = makeRig({ school, weapon: W[school], gap });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      const T = TECH_BY_NAME[base] ?? { from: PADS.langort, path: [[0.02, -0.22]] };
      R.down();
      R.to(T.from, CONFIG.SKILL.recoverSpeed * 0.9);
      R.frames(4);
      if (near) approach(R, near);
      if (stick) { R.stick(stick === 'fwd' ? [0, 0.8] : stick === 'back' ? [0, -0.8] : [0.8 * stick, 0]); R.wait(stickLead); }
      R.mark('start');
      for (const p of T.path) R.to(p, v);
      R.frames(2);
      R.up();
      R.wait(0.15);
      R.stick(null);
      R.wait(1.4);
      const fired = firedSince(R, f0);
      const hits = R.G.wounds.filter((w) => w.t >= R.marks.start && w.att === R.P).map((w) => `${w.zone}:${w.type}:${w.energy.toFixed(0)}`);
      const m = measure(R, R.marks.start, (r) => r.uq === name || (r.iai && r.t - R.marks.start < 0.6) || (r.tap && r.t - R.marks.start < 0.6), { maxT: 2.0, tail: 0.4 });
      if (process.env.MR_DEBUG) dbg(R, R.marks.start);
      return { fired, d: R.approachD, hits, ...m };
    } finally {
      R.G.world.free();
    }
  };
}
/** 손을 그 자리에 쥔 채 스틱 앞으로 걸어 들어감: 가슴 사이가 칼끝 거리(swordArt.measure.reach) − near 가 될 때까지 · 놓고 0.25 s */
function approach(R, near) {
  const want = (R.P.swordArt?.measure?.reach ?? 1.8) - near;
  let n = 0;
  R.stick([0, 0.8]);
  while (R.P.foeDistance() > want && n++ < 200) R.frames(1);
  R.stick(null);
  R.wait(0.25);
  R.approachD = +R.P.foeDistance().toFixed(3);
}
/** 탭으로 내는 특수 · 고유 공격 실행부 곧장 (uq.launchTap — 조건 길 밖) */
function tapDirect({ school, name, gap, stick = null, pre = null }) {
  return () => {
    const R = makeRig({ school, weapon: W[school], gap });
    try {
      settle(R);
      if (stick) { R.stick(stick); R.wait(0.12); }
      pre?.(R);
      const e = R.uq.tapList?.find((x) => x.name === name) ?? R.uq.list.find((x) => x.name === name);
      if (!e) return { fired: [], err: 'no entry ' + name };
      const f0 = { ...R.uq.stats.fired };
      R.mark('start');
      const t0 = R.G.t;
      let ok = false;
      R.frames(1, () => { ok = R.uq.launchTap(e, R.uq.t, false, null); });
      R.wait(0.2);
      R.stick(null);
      R.wait(1.6);
      const fired = firedSince(R, f0);
      const m = measure(R, t0, (r) => r.iai || r.tap || r.hold, { maxT: 2.0 });
      return { fired, launched: ok, ...m };
    } finally {
      R.G.world.free();
    }
  };
}
/** 비기 실행부 곧장 (skill.secret — secret_trail_probe.mjs 와 같은 ctx) */
function secretDirect({ school, gap, ctx }) {
  return () => {
    const R = makeRig({ school, weapon: W[school], gap });
    try {
      settle(R);
      const S = playerSecretDef(school) ?? TRADITIONS[school].secret;
      R.mark('start');
      const t0 = R.G.t;
      let ok = false;
      const b0 = R.P.skill.secretBursts ?? 0;
      R.frames(1, () => { ok = R.P.skill.secret({ S, ctx }); });
      R.wait(2.4);
      const m = measure(R, t0, (r) => (r.sec && r.sec !== 'stiff') || r.iai, { maxT: 2.6 });
      const stiff = R.rows.find((r) => r.t >= t0 && r.sec === 'stiff');
      return { fired: ok ? [S.name ?? school + 'Secret'] : [], bursts: (R.P.skill.secretBursts ?? 0) - b0, stiffAt: stiff ? +(stiff.t - t0).toFixed(3) : null, ...m };
    } finally {
      R.G.world.free();
    }
  };
}


// ── 조건 길 (상대를 대본으로 — AI 없음): 창이 열리는 때 · 거리 · 낸 수 ──
/** 상대 손 대본: 패드 자리 p 로 빠르기 v (입력 프레임마다 — 상대 검술 층이 손 목표를 따름) */
function foeTo(R, p, v) {
  const E = R.E;
  const q = [];
  let hx = E.handOffset.x, hy = E.handOffset.y;
  for (let j = 0; j < 600; j++) {
    const dx = p[0] - hx, dy = p[1] - hy, dd = Math.hypot(dx, dy);
    if (dd < 1e-7) break;
    const st = Math.min(dd, v * FR);
    q.push([(dx / dd) * st, (dy / dd) * st]);
    hx += (dx / dd) * st;
    hy += (dy / dd) * st;
  }
  return q;
}
function foeStroke(R, name, v = 4.5) {
  const T = TECH_BY_NAME[name];
  R.foeQ = [...foeTo(R, T.from, 1.0), ...Array(4).fill([0, 0])];
  R.foeQ.lateStroke = () => { let hx = T.from[0], hy = T.from[1]; const out = []; for (const p of T.path) { const dx = p[0] - hx, dy = p[1] - hy, n = Math.max(1, Math.round(Math.hypot(dx, dy) / v / FR)); for (let i = 0; i < n; i++) out.push([dx / n, dy / n]); hx = p[0]; hy = p[1]; } return out; };
}
/** 프레임마다: 상대 손 대본 한 칸 */
function foeFrame(R) {
  const E = R.E;
  if (R.foeQ?.length) {
    const d = R.foeQ.shift();
    E.handOffset.x += d[0];
    E.handOffset.y += d[1];
    E.inputActive = Math.abs(d[0]) + Math.abs(d[1]) > 1e-5;
    E.handHeld = true;
    if (!R.foeQ.length && R.foeQ.lateStroke) { const ls = R.foeQ.lateStroke; R.foeQ = ls(); }
  } else if (R.foeQ) { E.inputActive = false; }
}
const secMeasure = (R, t0) => measure(R, t0, (r) => (r.sec && r.sec !== 'stiff') || r.iai, { maxT: 2.6 });
/** 창이 열리기를 기다림 (max 실제 초) — 프레임마다 cb */
function untilOpen(R, maxS, cb) {
  let n = 0;
  const N = Math.round(maxS / FR);
  while (!R.sec.open && n++ < N) R.frames(1, () => cb?.(n));
  return R.sec.open ? { t: R.G.t, ev: R.sec.open.ctx?.ev ?? null, d: +R.P.foeDistance().toFixed(3) } : null;
}
function fireOpen(R) {
  const b0 = R.P.skill.secretBursts ?? 0;
  R.mark('start');
  const t0 = R.G.t;
  R.tap();
  R.wait(2.4);
  const m = secMeasure(R, t0);
  return { fired: R.secretFired.map((x) => x.name), bursts: (R.P.skill.secretBursts ?? 0) - b0, ...m };
}

export const MOVES = {
  // 독일
  zwerchAbtritt: fingerMove({ school: 'german', name: 'zwerchAbtritt', base: 'zwerch', stick: 1 }),
  schielhau: fingerMove({ school: 'german', name: 'schielhau', base: 'zornhau' }),
  zwerchAbtrittNear: fingerMove({ school: 'german', name: 'zwerchAbtritt', base: 'zwerch', stick: 1, near: 0.15 }),
  schielhauNear: fingerMove({ school: 'german', name: 'schielhau', base: 'zornhau', near: 0.15 }),
  duplieren: tapDirect({ school: 'german', name: 'duplieren', gap: 1.4 }),
  mordschlag: secretDirect({ school: 'german', gap: 0.75, ctx: { ev: 'press' } }),
  // 이탈리아
  imbroccata: fingerMove({ school: 'italian', name: 'imbroccata', base: 'stichOchs' }),
  imbroccataDown: fingerMove({ school: 'italian', name: 'imbroccata', base: 'oberhau' }),
  imbroccataNear: fingerMove({ school: 'italian', name: 'imbroccata', base: 'oberhau', near: 0.15 }),
  cavazione: tapDirect({ school: 'italian', name: 'cavazione', gap: 1.6 }),
  inquartata: tapDirect({ school: 'italian', name: 'inquartata', gap: 1.8, stick: [0.8, 0] }),
  risoluto: secretDirect({ school: 'italian', gap: 1.6, ctx: { ev: 'risoluto', path: 'hold', held: 0.6 } }),
  // 이베리아
  talhoRodeado: fingerMove({ school: 'iberian', name: 'talhoRodeado', base: 'zornhau', stick: 1 }),
  talhoRodeadoNear: fingerMove({ school: 'iberian', name: 'talhoRodeado', base: 'zornhau', stick: 1, near: 0.15 }),
  // 이어 돌리기 (B7): 내려 벤 칼 바로 뒤 같은 내려 베기를 다시 그음 — 칼이 머리 위로 돌아 다음 칼 시작 자리로
  cingir: () => {
    const R = makeRig({ school: 'iberian', weapon: W.iberian, gap: 3.2 });
    try {
      settle(R);
      const T = TECH_BY_NAME.zornhau;
      R.down();
      R.to(T.from, CONFIG.SKILL.recoverSpeed * 0.9);
      R.frames(4);
      for (const p of T.path) R.to(p, 5.5);
      // 앞 칼이 다 나간 뒤 0.1 s (ib_link.mjs airOne 과 같은 손) · 다음 칼(왼 분노의 베기 ↘)의 길 옮김만 지금 손 자리에서 — 시작 자리로 가지 않음
      let n = 0;
      while ((R.P.skill.swinging || R.uq.link || R.P.ibLink) && n++ < 120) R.frames(1);
      R.wait(0.1);
      R.mark('start');
      const t0 = R.G.t;
      const st0 = R.uq.stats.link?.fired ?? 0;
      if (process.env.MR_DEBUG) console.log('  cingir pre', JSON.stringify({ chain: R.P.ibFlowChainNow?.(), sw: R.P.ibFlowSw, pk: R.P.ibFlowPk, hand: [R.P.handOffset.x, R.P.handOffset.y], ok: R.uq.linkOk?.(), busy: R.uq.busy(), state: R.P.state, link: R.uq.stats.link, ends: R.uq.stats.ends, strokes: R.uq.stats.strokes }));
      const L = TECH_BY_NAME.zornhauL;
      const pts = [L.from, ...L.path];
      for (let i = 0; i + 1 < pts.length; i++) {
        const d = [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]];
        const nn = Math.max(1, Math.round(Math.hypot(d[0], d[1]) / 5.5 / FR));
        R.frames(nn, () => R.move(d[0] / nn, d[1] / nn));
      }
      R.frames(2);
      R.up();
      R.wait(2.0);
      const linked = (R.uq.stats.link?.fired ?? 0) - st0;
      const m = measure(R, t0, (r) => r.link, { maxT: 2.2, tail: 0.6 });
      return { fired: linked > 0 ? ['cingir×' + linked] : [], ...m };
    } finally {
      R.G.world.free();
    }
  },
  // 알티바슈 포르트 (B4 비기): 칼끝 거리 밖 2 s 무장 → 길게 눌러 메기 → 뗌
  altib: () => {
    const R = makeRig({ school: 'iberian', weapon: W.iberian, gap: 3.4 });
    try {
      settle(R);
      let n = 0;
      while (!R.sec.open && n++ < 60) R.wait(0.1);
      const armedAt = R.sec.open ? R.G.t : null;
      const b0 = R.P.skill.secretBursts ?? 0;
      R.down();
      R.mark('press');
      R.wait(1.0);
      R.mark('start');
      const t0 = R.G.t;
      R.up();
      R.wait(2.2);
      const wind0 = R.rows.find((r) => r.t >= R.marks.press && r.wind);
      const m = measure(R, t0, (r) => r.iai || (r.sec && r.sec !== 'stiff') || r.wind, { maxT: 2.4 });
      const mw = wind0 ? measure(R, wind0.t, (r) => r.iai || (r.sec && r.sec !== 'stiff') || r.wind, { maxT: 3.4 }) : null;
      return { fired: R.secretFired.map((s) => s.name ?? 'secret'), bursts: (R.P.skill.secretBursts ?? 0) - b0, armed: armedAt != null, windFrom: wind0 ? +(wind0.t - R.marks.press).toFixed(3) : null, withWind: mw ? { dur: mw.dur, path: mw.path, vmax: mw.vmax } : null, ...m };
    } finally {
      R.G.world.free();
    }
  },
  // 일본
  hirakiGiri: fingerMove({ school: 'japanese', name: 'hirakiGiri', base: 'zornhauL', stick: 1 }),
  hirakiGiriNear: fingerMove({ school: 'japanese', name: 'hirakiGiri', base: 'zornhauL', stick: 1, near: 0.15 }),
  kote: fingerMove({ school: 'japanese', name: 'kote', base: 'langortDown' }),
  koteNear: fingerMove({ school: 'japanese', name: 'kote', base: 'langortDown', near: 0.15 }),
  // 제비 베기: 내려 벤 칼이 빗나간 뒤(거리 밖) 위로 긋기
  tsubameGaeshi: () => {
    const R = makeRig({ school: 'japanese', weapon: W.japanese, gap: 3.2 });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      const T = TECH_BY_NAME.oberhau;
      R.down();
      R.to(T.from, CONFIG.SKILL.recoverSpeed * 0.9);
      R.frames(4);
      for (const p of T.path) R.to(p, 4.5);
      R.frames(2);
      R.mark('start');
      const t0 = R.G.t;
      R.to([R.P.handOffset.x + 0.05, R.P.handOffset.y + 0.6], 4.5);
      R.frames(2);
      R.up();
      R.wait(1.8);
      const fired = firedSince(R, f0);
      const m = measure(R, t0, (r) => r.uq === 'tsubameGaeshi' || r.iai, { maxT: 2.0, tail: 0.4 });
      return { fired, ...m };
    } finally {
      R.G.world.free();
    }
  },
  gonosen: secretDirect({ school: 'japanese', gap: 1.9, ctx: {} }),
  // 동방
  chebuYaoji: fingerMove({ school: 'chinese', name: 'chebuYaoji', base: 'zwerch', stick: 'fwd' }),
  yaoji: fingerMove({ school: 'chinese', name: 'yaoji', base: 'zwerch' }),
  chebuYaojiNear: fingerMove({ school: 'chinese', name: 'chebuYaoji', base: 'zwerch', stick: 'fwd', near: 0.15 }),
  yaojiNear: fingerMove({ school: 'chinese', name: 'yaoji', base: 'zwerch', near: 0.15 }),
  // 날개 접기: 스틱 뒤로 물러나는 동안 탭 (입력 길 그대로)
  lianchi: () => {
    const R = makeRig({ school: 'chinese', weapon: W.chinese, gap: 2.4 });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      R.stick([0, -0.8]);
      R.wait(0.3);
      R.mark('start');
      const t0 = R.G.t;
      R.tap();
      R.wait(0.1);
      R.stick(null);
      R.wait(1.8);
      const fired = firedSince(R, f0);
      const m = measure(R, t0, (r) => r.iai || r.tap || r.hold, { maxT: 2.0 });
      return { fired, ...m };
    } finally {
      R.G.world.free();
    }
  },
  lianchiDirect: tapDirect({ school: 'chinese', name: 'lianchi', gap: 2.0 }),

  // ── 조건 길 ──
  gonosenTrig: () => {
    const R = makeRig({ school: 'japanese', weapon: W.japanese, gap: 3.0 });
    try {
      settle(R);
      let n = 0;
      while (!R.sec.iaiArm?.armed && n++ < 80) R.wait(0.1);
      const armedAt = R.G.t;
      const win = untilOpen(R, 4, () => R.E.move.set(0, 1));
      R.E.move.set(0, 0);
      if (!win) return { fired: [], err: 'no window', armed: !!R.sec.iaiArm?.armed };
      return { win: { ev: win.ev, d: win.d, after: +(win.t - armedAt).toFixed(3) }, ...fireOpen(R) };
    } finally { R.G.world.free(); }
  },
  mordTrig: () => {
    const R = makeRig({ school: 'german', weapon: W.german, gap: 0.8 });
    try {
      settle(R);
      const t0 = R.G.t;
      R.stick([0, 0.8]);
      const win = untilOpen(R, 4);
      R.stick(null);
      if (!win) return { fired: [], err: 'no window', d: +R.P.foeDistance().toFixed(3) };
      return { win: { ev: win.ev, d: win.d, after: +(win.t - t0).toFixed(3) }, ...fireOpen(R) };
    } finally { R.G.world.free(); }
  },
  inqTrig: () => {
    const R = makeRig({ school: 'italian', weapon: W.italian, gap: 1.9 });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      foeStroke(R, 'zornhau');
      let n = 0, tapAt = null;
      R.stick([0.8, 0]);
      while (n++ < 120 && tapAt == null) R.frames(1, () => { foeFrame(R); if (R.guard.noThreat <= 0.05 && R.guard.threatId > 0) tapAt = R.G.t; });
      if (tapAt == null) return { fired: [], err: 'no threat' };
      R.mark('start');
      const t0 = R.G.t;
      R.up(); R.frames(1, () => foeFrame(R)); R.down(); R.frames(1, () => foeFrame(R)); R.up();
      R.wait(1.6, () => foeFrame(R));
      R.stick(null);
      const fired = firedSince(R, f0);
      const m = measure(R, t0, (r) => r.iai || r.tap || r.hold, { maxT: 2.0 });
      return { fired, ...m };
    } finally { R.G.world.free(); }
  },
  gyeoksalTrig: () => {
    const R = makeRig({ school: 'chinese', weapon: W.chinese, gap: 1.7 });
    try {
      settle(R);
      const b0 = R.P.skill.secretBursts ?? 0;
      foeStroke(R, 'zornhau');
      let n = 0, pressAt = null;
      while (n++ < 150 && !(R.P.skill.secretBursts > b0)) R.frames(1, () => { foeFrame(R); if (pressAt == null && R.guard.noThreat <= 0.05 && R.guard.threatId > 0) { pressAt = R.G.t; R.guardHeld = true; R.stick([0, 0.8]); } });
      R.guardHeld = false; R.stick(null);
      const fireStep = R.rows.find((r) => r.t >= (pressAt ?? Infinity) && r.sec && r.sec !== 'stiff');
      if (!fireStep) { R.wait(0.5); return { fired: [], err: 'no gyeoksal', press: pressAt != null, open: R.sec.opened }; }
      R.wait(2.0);
      const m = secMeasure(R, fireStep.t);
      return { fired: ['gyeoksal'], bursts: (R.P.skill.secretBursts ?? 0) - b0, pressToFire: +(fireStep.t - pressAt).toFixed(3), ...m };
    } finally { R.G.world.free(); }
  },
  dupTrig: () => {
    const R = makeRig({ school: 'german', weapon: W.german, gap: 1.25 });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      let n = 0;
      R.down();
      R.to([0.06, 0.12], 0.8);
      while (n++ < 240 && !R.uq.stats.fired.duplieren) R.frames(1, () => R.move(-0.002, 0));
      R.up();
      const st = R.rows.find((r, i) => i > 0 && r.iai && !R.rows[i - 1].iai);
      R.wait(1.6);
      const fired = firedSince(R, f0);
      if (!fired.includes('duplieren') || !st) return { fired, err: 'no dup' };
      const m = measure(R, st.t, (r) => r.iai || r.hold, { maxT: 2.0 });
      return { fired, ...m };
    } finally { R.G.world.free(); }
  },
  cavTrig: () => {
    const R = makeRig({ school: 'italian', weapon: W.italian, gap: 1.3 });
    try {
      settle(R);
      const f0 = { ...R.uq.stats.fired };
      let n = 0;
      R.down();
      R.to([-0.06, 0.12], 0.8);
      while (n++ < 240 && !(R.uq.touch && R.uq.t - R.uq.touch.t0 > 0.35)) R.frames(1, () => R.move(0.002, 0));
      R.up();
      if (!R.uq.touch) return { fired: [], err: 'no touch' };
      R.frames(1);
      R.mark('start');
      const t0 = R.G.t;
      R.tap();
      R.wait(1.6);
      const fired = firedSince(R, f0);
      const m = measure(R, t0, (r) => r.iai || r.tap || r.hold, { maxT: 2.0 });
      return { fired, ...m };
    } finally { R.G.world.free(); }
  },
  gyeoksal: secretDirect({ school: 'chinese', gap: 1.35, ctx: { ev: 'gyeoksal', slot: 'geojeong', stance: 'geojeong' } }),
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const want = (args.find((a) => !a.startsWith('--')) ?? Object.keys(MOVES).join(',')).split(',');
  const jsonOut = args.find((a) => a.startsWith('--json='))?.slice(7);
  const out = {};
  for (const k of want) {
    if (!MOVES[k]) { console.log(k, 'no such move'); continue; }
    const t = Date.now();
    let r;
    try { r = MOVES[k](); } catch (e) { r = { err: String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ') }; }
    out[k] = r;
    const { trail, ...rest } = r ?? {};
    console.log(k.padEnd(15), JSON.stringify(rest), `(${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out));
  process.exit(0);
}
