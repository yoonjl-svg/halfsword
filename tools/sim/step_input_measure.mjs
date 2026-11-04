// ─────────────────────────────────────────────────────────────
//  step_input_measure.mjs — 걸음 공격 입력 읽힘 재기 (사장님 11/04 '걸음 공격 입력 인식도 동시에 봐.' · 기록 docs/strike/step_input_2026-11-05.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만).
//   사람 몸(0 번)을 두 엄지로 조작: 오른 엄지 = 실제 src/input.js Input 에 터치 사건(844 × 390 화면 — school_balance.mjs 와 같은 손) ·
//    왼 엄지 = 실제 attachStick(스틱 원 110 px · 손잡이 40 px · 데드존 0.15)에 누름 · 끌기 · 뗌. main.js playerInputFrame 차례 그대로 읽는다.
//   상대는 서 있기만 함(AI 멈춤 — 거리 3.2 m · 칼이 안 닿음): 몸이 넘어지거나 맞아 바쁜 일 없이 '입력이 읽히나'만 본다.
//   한 번(시도) = 손을 시작 자리로 천천히(휘두르기 문턱 밑) → 잠깐 멈춤 → 기본 긋기 한 획 · 스틱은 긋기 시작에 견준 때(dt)에 밀기 시작(0.06 s 에 걸쳐) ·
//    세기(a — 손잡이 반지름 몫) · 기울기(ang — 걸음 축에서 앞쪽으로 °) · 뗌(hold — 긋기 끝 뒤 · flick — 민 뒤 이만큼에 뗌).
//   읽음 = 그 시도 동안 게임이 그 걸음 공격을 냈나(unique_assist stats.fired) · 긋기 = 게임이 읽은 기본 동작(classify).
//  node tools/sim/step_input_measure.mjs grid  [--schools=german,iberian,japanese,chinese] [--set=UNIQUE_ASSIST.stepIn=0] [--reps=2]
//  node tools/sim/step_input_measure.mjs human [--schools=…] [--n=60] [--seed=1] [--set=…]   (자연스러운 사람 손 섞음)
//  node tools/sim/step_input_measure.mjs fp    [--schools=…] [--set=…]                      (뜻 없는 걸음 공격 — 스틱을 다른 뜻으로 쓴 긋기)
//  --json=파일 = 시도마다 기록
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, CONFIG, DT } from './harness_m.mjs';
import { PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { Input, attachStick } from '../../src/input.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const FR = 1 / 60; // 입력 프레임 (실제 s)
const UA = CONFIG.UNIQUE_ASSIST;
export const WEAPON = { german: 'longsword', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'hwando' };
/** 유파마다 걸음 공격 (PLAYER_UNIQUE role 'step' · stick 이 있는 것): [이름, 바탕 긋기, 스틱 쪽] */
export const STEP_OF = Object.fromEntries(Object.entries(PLAYER_UNIQUE).flatMap(([s, L]) => L.filter((e) => e.role === 'step' && e.stick && e.on?.[0]?.tech).map((e) => [s, { name: e.name, base: e.on[0].tech, stick: e.stick }])));

function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
function rng(seed) {
  let s = seed >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  r.g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return r;
}
// 브라우저 껍데기 (Input · attachStick 이 읽는 것만)
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
/** 사건 받는 껍데기 (스틱 원 · 캔버스) */
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
const STICK_RECT = { left: 20, top: 260, width: 110, height: 110 }; // index.html #moveStick (왼쪽 아래 20 px · 110 px)
const STICK_R = 40; // input.js attachStick 손잡이 반지름 (px)

/**
 * 한 유파 몸으로 시도들을 차례로. trials = [{ kind, base, stick: { dt, a, ang, side, hold, flick, ramp } | null, sjit, pause }]
 *  돌려줌: 시도마다 { …시도, read(걸음 공격 냈나), fired(그 시도에 낸 고유 공격 이름들), strokes(읽힌 긋기 [기본 동작, 패드, 스틱 x, y]), exhausted }
 */
export function runTrials(school, trials, { seed = 1, gap = 3.2, rest = 0.7 } = {}) {
  const S = STEP_OF[school];
  const rnd = rng(seed * 7919 + 17);
  const kit = kitFromNodes(school, allNodeIds(school));
  const G = newRound({ seed, weapon: WEAPON[school], weapon2: 'longsword', walls: true, gap, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  G.ai.update = () => {}; // 상대는 서 있기만
  const P = G.player;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(kit?.unique ?? []) });
  const guard = new PlayerParryGuard(P, G.enemy);
  P.stamina.controller = guard;
  const canvas = evTarget();
  const input = inputEnv(() => new Input(canvas, new URLSearchParams('')));
  input.enabled = true;
  const pad = evTarget(STICK_RECT);
  const knob = { style: {} };
  inputEnv(() => attachStick(input, pad, knob));
  // ── 오른 엄지 (칼) ──
  let fx = 620;
  let fy = 180;
  let down = false;
  const hand = (kind, dx = 0, dy = 0) => {
    if (kind === 'pointerdown') (fx = 620), (fy = 180);
    const base = { pointerId: 1, pointerType: 'touch', button: 0, timeStamp: Math.max(1, (G.t / K) * 1000), type: kind, clientX: fx, clientY: fy, target: canvas };
    if (kind === 'pointerdown') inputEnv(() => input.onDown(base)), (down = true);
    else if (kind === 'pointerup') inputEnv(() => input.onUp(base)), (down = false);
    else {
      const sc = CONFIG.INPUT.touchSensitivity / 390;
      fx += dx / sc;
      fy -= dy / (sc * input.mobileIntent.verticalGain);
      inputEnv(() => input.onMove({ ...base, clientX: fx, clientY: fy }));
    }
  };
  // ── 왼 엄지 (스틱) — 손잡이 자리 [x, y] (반지름 몫 · +y = 앞) ──
  let thumb = null;
  const cx = STICK_RECT.left + STICK_RECT.width / 2;
  const cy = STICK_RECT.top + STICK_RECT.height / 2;
  const stickAt = (p) => {
    const e = (k) => ({ pointerId: 2, pointerType: 'touch', clientX: cx + (p ? p[0] : 0) * STICK_R, clientY: cy - (p ? p[1] : 0) * STICK_R, type: k, target: pad, stopPropagation() {} });
    if (p && !thumb) pad.fire('pointerdown', e('pointerdown'));
    else if (p) pad.fire('pointermove', e('pointermove'));
    else if (thumb) pad.fire('pointerup', e('pointerup'));
    thumb = p;
  };
  /** 손 목표 프레임 (패드 m): 시작 자리(+ 가우스)로 천천히 · 멈춤 · 길 점마다 ± jit · 3 ~ 5.5 패드 m/s (school_balance.mjs 와 같은 손) */
  const strokeQ = (T, sjit, pause) => {
    let hx = P.handOffset.x;
    let hy = P.handOffset.y;
    const q = [];
    const to = (p, v) => {
      for (let j = 0; j < 500; j++) {
        const dx = p[0] - hx;
        const dy = p[1] - hy;
        const d = Math.hypot(dx, dy);
        if (d < 1e-7) break;
        const s = Math.min(d, v * FR);
        q.push([(dx / d) * s, (dy / d) * s]);
        hx += (dx / d) * s;
        hy += (dy / d) * s;
      }
    };
    to([T.from[0] + rnd.g() * sjit, T.from[1] + rnd.g() * sjit], CONFIG.SKILL.recoverSpeed);
    const swipeAt = q.length + pause;
    q.push(...Array.from({ length: pause }, () => [0, 0]));
    const v = 3 + rnd() * 2.5;
    for (const p of T.path) to([p[0] + (rnd() * 2 - 1) * 0.04, p[1] + (rnd() * 2 - 1) * 0.04], v);
    return { q, swipeAt, end: q.length };
  };
  // ── main.js playerInputFrame 차례 (막기 단추 · 비기 없음) ──
  const frame = () => {
    const d = input.consumeHandDelta();
    let taps = input.consumeTaps();
    if (P.stamina.exhausted) (d.x = 0), (d.y = 0), (taps = 0);
    guard.held = false;
    if (guard.broken && !P.skill.swinging && !P.skill.tap) guard.broken = false;
    uq.feed(d.x, d.y, FR, false, false);
    if (P.alive) (P.handOffset.x += d.x), (P.handOffset.y += d.y);
    P.handHeld = input.activeTouch !== null;
    P.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    const pr = input.press;
    P.handGrip = pr ? pr.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : P.inputActive;
    if (taps > 0 && P.alive) P.skill.thrust();
    const m = input.move;
    const feet = P.alive && !P.stamina.exhausted && P.skill.secretPhase !== 'stiff';
    P.move.set(feet ? m.x : 0, feet ? m.y : 0);
    P.stickX = feet ? m.x : 0;
    P.stickY = feet ? m.y : 0;
  };
  G.before = () => {
    guard.step(DT);
    if (guard.active) (P.inputActive = true), (P.handHeld = true);
  };
  let nextFrame = 0;
  /** 입력 프레임 n 개 (프레임마다 cb(번호) 뒤 playerInputFrame 차례 · 그 사이 물리 스텝) */
  const runFrames = (n, cb) => {
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
  const run = (realS) => runFrames(Math.round(realS / FR));
  // 읽힌 긋기 (unique_assist cur 가 바뀔 때마다)
  let seen = null;
  let strokes = [];
  const watch = () => {
    const c = uq.cur;
    if (c && c !== seen) {
      seen = c;
      strokes.push({ tech: c.tech, pad: c.pad, t: +(G.t / K).toFixed(3), sx: +(P.stickX ?? 0).toFixed(2), sy: +(P.stickY ?? 0).toFixed(2), busy: uq.busy(), d: +P.foeDistance().toFixed(2), unique: null, rec: c });
    }
  };
  const out = [];
  try {
    run(1.2); // 판 시작 정지 (ARENA.startHold) 지나기
    while (P.openHold) run(0.1);
    for (const tr of trials) {
      if (!P.alive || P.state !== 'stand') {
        out.push({ ...tr, skipped: P.state });
        run(1);
        continue;
      }
      const T = TECH_BY_NAME[tr.base];
      const fired0 = { ...uq.stats.fired };
      const steps0 = uq.stats.steps; // 걸음 공격 걸음이 받아들여진 수 (askStep — 몸이 다른 걸음 중이면 거절될 수 있음)
      strokes = [];
      hand('pointerdown');
      const { q, swipeAt, end } = strokeQ(T, tr.sjit ?? 0.03, tr.pause ?? 4);
      const st = tr.stick;
      // 스틱 때 (프레임 번호 — 긋기 시작 = swipeAt)
      const s0 = st ? swipeAt + Math.round(st.dt / FR) : null;
      const ramp = st ? Math.max(1, Math.round((st.ramp ?? 0.06) / FR)) : 0;
      const s1 = st ? (st.flick != null ? s0 + Math.max(1, Math.round(st.flick / FR)) : end + Math.round((st.hold ?? 0.15) / FR)) : null;
      // 스틱 쪽 단위 벡터: 'side' = 옆(side 부호) 에서 앞쪽으로 ang° · 'fwd' = 앞에서 옆(side 부호)으로 ang°
      const dirOf = () => {
        const r = ((st.ang ?? 0) * Math.PI) / 180;
        const want = st.want ?? S.stick;
        return want === 'fwd' ? [Math.sin(r) * (st.side ?? 1), Math.cos(r)] : [Math.cos(r) * (st.side ?? 1), Math.sin(r)];
      };
      const n0 = Math.min(s0 ?? 0, 0);
      let tSwipe = null;
      let exh = false;
      // 스틱이 긋기보다 먼저면(시작 자리로 가는 동안 또는 그 전) 앞에 빈 프레임을 둔다 (손은 그동안 그대로)
      const lead = -n0;
      const total = lead + Math.max(end, s1 ?? 0) + 2;
      runFrames(total, (k) => {
        const fi = k - lead; // 손 프레임 번호
        if (fi >= 0 && fi < q.length) {
          const [dx, dy] = q[fi];
          if (fi === swipeAt) tSwipe = G.t / K;
          hand('pointermove', dx, dy);
        }
        if (st) {
          if (fi >= s0 && fi < s1) {
            const u = Math.min(1, (fi - s0 + 1) / ramp);
            const D = dirOf();
            stickAt([D[0] * st.a * u, D[1] * st.a * u]);
          } else if (fi >= s1 && thumb) stickAt(null);
        }
        if (P.stamina.exhausted) exh = true;
      });
      if (down) hand('pointerup');
      if (thumb) stickAt(null);
      run(rest);
      // 거리 되돌리기 (앞 걸음 공격이 상대 쪽으로 다가감 — 다음 시도도 같은 거리에서): 스틱 앞뒤로 · 그 뒤 가만히
      let back = 0;
      while (Math.abs(P.foeDistance() - gap) > 0.25 && back < 120 && P.alive) {
        stickAt([0, P.foeDistance() > gap ? 0.8 : -0.8]);
        run(FR);
        back++;
      }
      if (thumb) stickAt(null);
      if (back) run(0.5);
      const fired = Object.entries(uq.stats.fired).flatMap(([k, v]) => Array.from({ length: v - (fired0[k] ?? 0) }, () => k));
      for (const s of strokes) s.unique = s.rec.unique, delete s.rec;
      out.push({ ...tr, read: fired.includes(S.name), stepped: uq.stats.steps > steps0, fired, strokes, tSwipe, exhausted: exh });
    }
  } finally {
    G.world.free();
  }
  return out;
}

/** 스틱 세기 a (손잡이 반지름 몫) → 게임 스틱 값 (attachStick 데드존 0.15 — 눈금 읽기용) */
export const stickValue = (a) => (a < 0.15 ? 0 : (Math.min(1, a) - 0.15) / 0.85);

// ── 시도 묶음 ──
const GRID_DT = [-0.4, -0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2, 0.3];
const GRID_A = [0.45, 0.6, 0.8, 1];
const GRID_ANG = [0, 30, 50];
export function gridTrials(school, reps = 2) {
  const S = STEP_OF[school];
  const out = [];
  for (let r = 0; r < reps; r++) {
    for (const dt of GRID_DT) for (const a of GRID_A) out.push({ kind: 'grid', base: S.base, stick: { dt, a, ang: 0, side: (out.length % 2) * 2 - 1 } });
    for (const ang of GRID_ANG.slice(1)) for (const dt of [-0.2, 0]) out.push({ kind: 'gridAng', base: S.base, stick: { dt, a: 0.8, ang, side: (out.length % 2) * 2 - 1 } });
    for (const flick of [0.1, 0.2]) for (const dt of [-0.3, -0.2, -0.1]) out.push({ kind: 'gridFlick', base: S.base, stick: { dt, a: 0.8, ang: 0, side: (out.length % 2) * 2 - 1, flick } });
  }
  return out;
}
/** 자연스러운 사람 손 (엄지 둘): 스틱 먼저 0 ~ 0.3 s 가 60 % · 긋기가 먼저 0 ~ 0.12 s 가 40 % · 세기 반지름 0.4 ~ 1.1 몫(1 넘으면 끝까지) · 기울기 가우스 15° · 다섯에 하나는 민 뒤 0.12 ~ 0.3 s 에 뗌 · 시작 자리 σ 0.03 */
export function humanTrials(school, n = 60, seed = 1) {
  const S = STEP_OF[school];
  const r = rng(seed * 104729 + school.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const dt = r() < 0.6 ? -r() * 0.3 : r() * 0.12;
    const flick = r() < 0.2 ? 0.12 + r() * 0.18 : null;
    out.push({ kind: 'human', base: S.base, stick: { dt: +dt.toFixed(3), a: +(0.4 + r() * 0.7).toFixed(2), ang: +(Math.abs(r.g()) * 15).toFixed(1), side: i % 2 ? 1 : -1, flick: flick == null ? null : +flick.toFixed(3) } });
  }
  return out;
}
/** 뜻 없는 걸음 공격 (같은 바탕 긋기 · 스틱은 다른 뜻): rest = 엄지를 스틱에 얹어 둠(데드존 근처 떨림) · walkStop = 옆(앞)으로 걷다 놓고 g 뒤 긋기 ·
 *  cutAway = 긋고 g 뒤 옆(앞)으로 비켜 걷기 · fwdWalk(옆 걸음 공격) = 앞으로 걸으며(옆 몫 0.25) 긋기 · diag = 앞 비스듬히 60° 로 걸으며 긋기 */
export function fpTrials(school, reps = 4) {
  const S = STEP_OF[school];
  const out = [];
  const side = () => (out.length % 2) * 2 - 1;
  for (let r = 0; r < reps; r++) {
    out.push({ kind: 'plain', base: S.base, stick: null });
    out.push({ kind: 'rest', base: S.base, stick: { dt: -0.6, a: 0.2, ang: 40 + r * 20, side: side(), hold: 0.2 } });
    for (const g of [0.1, 0.2, 0.3, 0.45]) out.push({ kind: `walkStop${g}`, base: S.base, stick: { dt: -0.6 - g, a: 0.8, ang: 0, side: side(), flick: 0.6 } });
    for (const g of [0.15, 0.25, 0.35, 0.5]) out.push({ kind: `cutAway${g}`, base: S.base, stick: { dt: g, a: 0.8, ang: 0, side: side(), hold: 0.3 } });
    if (S.stick === 'side') {
      out.push({ kind: 'fwdWalk', base: S.base, stick: { dt: -0.5, a: 0.8, ang: 75, side: side(), want: 'side' } });
      out.push({ kind: 'diag', base: S.base, stick: { dt: -0.5, a: 0.8, ang: 60, side: side(), want: 'side' } });
    } else {
      out.push({ kind: 'sideWalk', base: S.base, stick: { dt: -0.5, a: 0.8, ang: 75, side: side(), want: 'fwd' } });
      out.push({ kind: 'diag', base: S.base, stick: { dt: -0.5, a: 0.8, ang: 60, side: side(), want: 'fwd' } });
    }
  }
  return out;
}

/** 걷다가 긋기 (뜻 없음 — 스틱은 걸음에만): 같은 바탕 긋기 · 스틱은 아무 쪽(360° 고르게) · 세기 0.4 ~ 1 · 긋기 시작에 견줘 −1.2 ~ +0.6 s 에 밀기 시작 · 0.2 ~ 0.8 s 밂.
 *  읽힘 = 걸음 공격이 난 몫 (스틱이 긋기 시작 때 마침 그 쪽이면 전 판도 남 — 새 판이 더하는 몫을 잼) */
export function walkTrials(school, n = 60, seed = 1) {
  const S = STEP_OF[school];
  const r = rng(seed * 7727 + school.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = r() * 360;
    // dirOf 는 'side' 축에서 ang° (앞쪽으로) — 360° 를 고르게 덮도록 side 부호 · 각을 그대로 씀
    out.push({ kind: 'walk', base: S.base, stick: { dt: +(-1.2 + r() * 1.8).toFixed(3), a: +(0.4 + r() * 0.6).toFixed(2), ang: +ang.toFixed(1), side: 1, want: 'side', flick: +(0.2 + r() * 0.6).toFixed(3) } });
  }
  return out;
}

// ── 표 ──
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
/** 읽힘 = 걸음 공격 냄 · 바탕 = 게임이 그 바탕 긋기로 읽은 시도(시작 자리 · 첫 방향) · 바탕 안 읽힘 = 바탕으로 읽힌 시도 가운데 걸음 공격 */
export function summarize(rows) {
  const ok = rows.filter((r) => !r.skipped && !r.exhausted);
  const base = ok.filter((r) => r.strokes.some((s) => s.tech === r.base));
  return { n: ok.length, read: ok.filter((r) => r.read).length, base: base.length, readOfBase: base.filter((r) => r.read).length, skipped: rows.length - ok.length, stepped: ok.filter((r) => r.read && r.stepped).length };
}
export function gridTable(rows) {
  const out = [];
  const g = rows.filter((r) => r.kind === 'grid' && !r.skipped && !r.exhausted);
  out.push(`| 스틱 때 (긋기 시작에 견줌 · s) | ${GRID_A.map((a) => `세기 ${a} (값 ${stickValue(a).toFixed(2)})`).join(' | ')} |`, `|---|${GRID_A.map(() => '---:').join('|')}|`);
  for (const dt of GRID_DT) {
    const cells = GRID_A.map((a) => {
      const c = g.filter((r) => r.stick.dt === dt && r.stick.a === a && r.strokes.some((s) => s.tech === r.base));
      return `${c.filter((r) => r.read).length}/${c.length}`;
    });
    out.push(`| ${dt > 0 ? '+' : ''}${dt} ${dt < 0 ? '(스틱 먼저)' : dt > 0 ? '(긋기 먼저)' : ''} | ${cells.join(' | ')} |`);
  }
  const ang = rows.filter((r) => r.kind === 'gridAng' && !r.skipped && !r.exhausted && r.strokes.some((s) => s.tech === r.base));
  const fl = rows.filter((r) => r.kind === 'gridFlick' && !r.skipped && !r.exhausted && r.strokes.some((s) => s.tech === r.base));
  out.push('', `기울기 (세기 0.8): ${GRID_ANG.slice(1).map((a) => `${a}° ${pct(ang.filter((r) => r.stick.ang === a && r.read).length, ang.filter((r) => r.stick.ang === a).length)}`).join(' · ')} · 민 뒤 뗌(0.1 · 0.2 s — 스틱 먼저 0.1 ~ 0.3 s): ${[0.1, 0.2].map((f) => `${f} s ${pct(fl.filter((r) => r.stick.flick === f && r.read).length, fl.filter((r) => r.stick.flick === f).length)}`).join(' · ')}`);
  return out.join('\n');
}
export function fpTable(rows) {
  const by = {};
  for (const r of rows) if (!r.skipped && !r.exhausted) (by[r.kind] ??= []).push(r);
  return Object.entries(by).map(([k, rs]) => `${k} ${rs.filter((r) => r.read).length}/${rs.length}`).join(' · ');
}

if (isMain(import.meta.url)) {
  const [mode = 'human', ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  applySets(arg('set', ''));
  const schools = arg('schools', Object.keys(STEP_OF).join(',')).split(',');
  const all = {};
  for (const school of schools) {
    const seed = +arg('seed', 1);
    const trials = mode === 'grid' ? gridTrials(school, +arg('reps', 2)) : mode === 'fp' ? fpTrials(school, +arg('reps', 4)) : mode === 'walk' ? walkTrials(school, +arg('n', 60), seed) : humanTrials(school, +arg('n', 60), seed);
    const rows = runTrials(school, trials, { seed });
    all[school] = rows;
    const s = summarize(rows);
    console.log(`## ${school} · ${STEP_OF[school].name} (${STEP_OF[school].stick} + ${STEP_OF[school].base}) — ${mode}`);
    console.log(`읽힘 ${s.read}/${s.n} (${pct(s.read, s.n)}) · 바탕 긋기로 읽힘 ${s.base}/${s.n} · 그 가운데 걸음 공격 ${s.readOfBase}/${s.base} (${pct(s.readOfBase, s.base)}) · 읽힌 것 가운데 걸음 받아들여짐 ${s.stepped}/${s.read}${s.skipped ? ` · 건너뜀 ${s.skipped}` : ''}`);
    if (mode === 'grid') console.log(gridTable(rows));
    if (mode === 'fp') console.log(fpTable(rows));
    console.log('');
  }
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify({ mode, set: arg('set', ''), all }));
}
