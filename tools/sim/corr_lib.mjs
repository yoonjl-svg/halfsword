// ─────────────────────────────────────────────────────────────
//  corr_lib.mjs — 검술 보정 v2 측정 도구 공통 (chain_corr·corr_s0·corr_ai_battery 가 쓴다)
//   src 를 스스로 불러오지 않는다: 부르는 쪽이 제 트리(--root)의 모듈을 넘긴다 (다른 체크아웃·시험 트리에서도 같은 도구)
//   - 스위치 알아보기: SKILL.corr / corrAI / corrTip, BODY.humanLimits 가 없는 트리면 'feature absent' (옛 길만 돈다)
//   - 입력 펌프: wbs-impl(895973d) tools/sim/harness_m.mjs inputPump·feedTrace(:152-300) 를 옮김. 이 트리 input.js 에 없는
//     fingerTrace·handDeltaAt(INPUT.coalesce)·손짓 층(ges)은 있으면 쓰고 없으면 건너뛴다 (?.). main.js frame() 의 입력 줄과 같은 차례
//   - 화면 빠르기: 60·120 Hz, 30J (30 fps ± 25 % 씨앗 흔들림 = 24~40 fps), J (24~45 fps 씨앗 수열, wbs chain.mjs jitterPump 와 같은 식)
//   - 날 각 탭: Combat.prototype.analyze 를 감싸 결과 r 옆(WeakMap)에 edgeAlign 을 combat.js:141-181 식 그대로 다시 잰다 (r 은 건드리지 않음)
//   - 패드 무리: chain.mjs FAM + 초보 긋기 A/B/C (design_novice_feel §8) + liftShort / holdShort (② 양성·음성)
//  자르기·한도·바닥은 넣지 않는다 (재기만 한다)
// ─────────────────────────────────────────────────────────────

/** 이 트리에 새 보정 스위치가 있나 */
export const hasCorr = (CONFIG) => !!CONFIG?.SKILL && 'corr' in CONFIG.SKILL;
export const hasLimits = (CONFIG) => !!CONFIG?.BODY && 'humanLimits' in CONFIG.BODY;
/** 파이터 한 명의 보정 방식 (newRound 뒤). 기능이 없는 트리에선 아무것도 안 한다 */
export function setCorr(CONFIG, f, mode, tip) {
  if (!hasCorr(CONFIG) || !f?.skill) return false;
  f.skill.corr = mode;
  if (tip != null) f.skill.corrTip = tip;
  return true;
}

// ── 패드 자리 (chain.mjs / 옛 record_wbs.mjs 와 같다) ──
export const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], OchsL: [-0.22, 0.26] };
//  v = 베는 획 손가락 빠르기 (m/s). chain.mjs 네 무리는 --v 기본 12. 초보 긋기는 §8 의 거리 ÷ 시간
//  hold = 획 끝에서 누른 채 (ms), 그 뒤 뗀다. short = 끝 자리를 판에서 잰다 (겨눈 머리 선보다 SHORT_DEG 위, 세로 길)
//  chHold = 감기 자리에서 누른 채 기다리는 ms (초보 긋기·짧은 무리: §8 '0 (holding)' — 쥔 자리에서 시작. 칼이 감기 자리에 닿을 시간:
//   거른 손 목표(aimFilter 14 rad/s)가 0.3~0.4 s 에 자리 잡는다 → 0.5 s. 없으면 chain.mjs W 변형처럼 감기에서 곧장 벤다)
export const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL, v: 12, cut: 'zornhau' },
  vert: { ch: PAD.Tag, end: PAD.Alber, v: 12, cut: 'oberhau' },
  horizR: { ch: PAD.Side, end: PAD.SideL, v: 12, cut: 'mittelhau' },
  riseR: { ch: PAD.Wechsel, end: PAD.OchsL, v: 12, cut: 'unterhau' },
  // 초보 긋기 A: 짧고 느린 사선, 끝에서 누른 채 (0.33 m ≈ 0.2 s → 1.65 m/s). 누름 300 ms 뒤 뗀다
  novA: { ch: [0.25, 0.25], end: [0.02, 0.0], v: 1.65, hold: 300, chHold: 500, cut: 'swipeA' },
  // 초보 긋기 B: 상대를 가로지르는 납작 긋기 0.65 m / 0.2 s
  novB: { ch: [0.35, 0.05], end: [-0.3, 0.05], v: 3.25, chHold: 500, cut: 'swipeB' },
  // 초보 긋기 C: 짧게 톡 아래로 0.2 m / 0.08 s, 곧바로 뗌
  novC: { ch: [0.05, 0.3], end: [0.05, 0.1], v: 2.5, chHold: 500, cut: 'swipeC' },
  // ② 양성: 세로 길에서 머리 선보다 SHORT_DEG 위에서 멈추고 곧바로 뗀다 (초보 빠르기 3 m/s)
  liftShort: { ch: PAD.Tag, end: null, short: true, v: 3, chHold: 500, cut: 'liftShort' },
  // ② 음성: 같은 멈춤을 1 s 누른 채 (뗌 없음 → ② 없어야 한다), 그 뒤 뗀다
  holdShort: { ch: PAD.Tag, end: null, short: true, v: 3, hold: 1000, chHold: 500, cut: 'holdShort' },
};
// 짧게 멈춤: 칼자루 → 상대 머리 가운데 선보다 25° 위 (과제의 20~30° 가운데. 선언된 기하, 튜닝 아님)
export const SHORT_DEG = 25;
/** guardDir(fighter.js:136-143) 높이 매핑의 닫힌 역: 올림각 el(rad) → 패드 y (x 는 무리 값 그대로) */
export function padYForEl(el) {
  return el > 0 ? 0.1 + (el * 0.5) / 1.65 : 0.1 + el / 1.1;
}
/** 한 획 (chain.mjs stroke 와 같다) */
export function stroke(dx, dy, v, { hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
}
/** 패드를 한 자리에 놓는다 (판을 만든 뒤 한 번, chain.mjs setPad) */
export function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
  k.aimVel?.set(0, 0);
  k.vel?.set(0, 0);
  k.follow?.set(0, 0);
}

// ── 입력 펌프 ──
const SCREEN_H = 390;
const SHIM = { window: { addEventListener() {}, innerHeight: SCREEN_H, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
/** input.js 를 부르는 동안만 브라우저 흉내를 둔다 (늘 두면 Rapier 가 브라우저로 알고 멈춘다 — wbs harness_m 주석) */
function withBrowser(fn) {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try {
    return fn();
  } finally {
    for (const k of added) delete globalThis[k];
  }
}
/** 화면 빠르기: '60' '120' → 고정, '30J' → 30 fps ± 25 % (24~40 fps), 'J' → 24~45 fps (씨앗 고정 수열, 판마다 처음부터) */
export function pacer(input, seed) {
  const s = String(input);
  if (s === 'J' || s === '30J') {
    let js = (seed * 2654435761) >>> 0;
    const next = () => ((js = (Math.imul(js, 1664525) + 1013904223) >>> 0), js / 4294967296);
    return s === 'J' ? () => 24 + 21 * next() : () => 30 / (0.75 + 0.5 * next());
  }
  const hz = +s;
  if (!(hz > 0)) throw new Error(`모르는 입력 빠르기 ${input} (60 | 120 | 30J | J)`);
  return () => hz;
}
/**
 * G 에 게임과 같은 입력 길을 붙인다 (한 번만). deps = { Input, CONFIG, DT }
 *  main.js frame(): consumeHandDelta → handOffset (칼·권총 아닐 때), handHeld = activeTouch !== null, inputActive, tapOnDown, 탭 → thrust, move.
 *  멈칫(hitStop)의 입력 0.25 배·물리 0.12 배는 시뮬에 없다 (wbs harness 와 같음)
 */
export function inputPump(G, deps, { f = G.player, pace = () => 60 } = {}) {
  if (G.pump) return G.pump;
  const { Input, CONFIG, DT } = deps;
  const input = withBrowser(() => new Input({ addEventListener() {} }, new URLSearchParams('mobileVerticalGain=1')));
  input.enabled = true;
  f.skill.autoGuard = true; // main.js:419
  if (input.fingerTrace) {
    // 다른 가지(wbs)의 입력 층: main.js 와 같게
    f.skill.detect = true;
    f.skill.trace = input.fingerTrace;
    f.ges?.attachTrace?.(input.fingerTrace);
    f.ges?.reset?.();
  }
  const ppm = SCREEN_H / CONFIG.INPUT.touchSensitivity; // 패드 m → px
  const P = { G, f, input, pace, hz: 60, wall: 1000, acc: 0, budget: 0, queue: [], fx: 600, fy: 200, frames: 0, ppm, stick: { x: 0, y: 0 }, events: [] };
  const send = (type, x, y) => {
    const e = { type, pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: P.wall };
    withBrowser(() => (type === 'pointerdown' ? input.onDown(e) : type === 'pointermove' ? input.onMove(e) : input.onUp(e)));
    if (type !== 'pointermove') P.events.push({ type: type === 'pointerdown' ? 'down' : 'up', gt: G.t, wall: P.wall });
  };
  P.frame = () => {
    P.hz = P.pace();
    P.wall += 1000 / P.hz;
    P.acc += 1 / P.hz;
    P.frames++;
    const q = P.queue[0];
    if (q) {
      if (q.w0 == null) {
        q.w0 = P.wall;
        q.t0 = G.t;
        if (q.down) {
          if (input.activeTouch !== null) send('pointerup', P.fx, P.fy);
          send('pointerdown', P.fx, P.fy);
        }
        q.bx = P.fx;
        q.by = P.fy;
      }
      const tau = Math.min(P.wall - q.w0, q.T);
      const [x, y] = q.pos(tau);
      const nx = q.bx + x * ppm;
      const ny = q.by - y * ppm;
      if (nx !== P.fx || ny !== P.fy) send('pointermove', nx, ny);
      P.fx = nx;
      P.fy = ny;
      if (P.wall - q.w0 >= q.T) {
        if (q.lift) send('pointerup', nx, ny);
        q.done = true;
        q.t1 = G.t;
        P.queue.shift();
      }
    }
    input.fingerTrace?.tick?.(P.wall);
    const d = input.consumeHandDelta();
    if (!CONFIG.INPUT.coalesce && f.alive && !f.weapon?.gun) {
      f.handOffset.x += d.x;
      f.handOffset.y += d.y;
    }
    f.handHeld = input.activeTouch !== null;
    f.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    input.tapOnDown = !!f.weapon?.gun;
    if (input.consumeTaps() > 0 && f.alive) f.skill.thrust();
    if (P.stick) f.move.set(f.alive ? P.stick.x : 0, f.alive ? P.stick.y : 0);
    while (P.acc >= DT - 1e-9) {
      P.acc -= DT;
      P.budget++;
    }
  };
  P.tick = () => {
    while (P.budget <= 0) P.frame();
    P.budget--;
    P.stepWall = P.wall - (P.acc + P.budget * DT) * 1000;
    f.stepT = P.stepWall;
    if (CONFIG.INPUT.coalesce && input.handDeltaAt) {
      const s = input.handDeltaAt(P.stepWall);
      if (f.alive) {
        f.handOffset.x += s.x;
        f.handOffset.y += s.y;
      }
    }
  };
  const step0 = G.step;
  G.step = () => {
    P.tick();
    step0();
  };
  G.pump = P;
  return P;
}
/** 합성 손가락 궤적을 넣는다 (wbs feedTrace). trace = { fn, T, down, lift } 또는 [[t ms, x, y], …] */
export function feedTrace(G, trace) {
  const P = G.pump;
  const tr = Array.isArray(trace) ? { pts: trace } : trace;
  let pos = tr.fn;
  let T = tr.T;
  if (!pos) {
    const pts = tr.pts;
    T = pts[pts.length - 1][0];
    pos = (t) => {
      if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
      for (let i = 1; i < pts.length; i++) {
        if (t <= pts[i][0]) {
          const a = pts[i - 1], b = pts[i];
          const u = (t - a[0]) / Math.max(1e-9, b[0] - a[0]);
          return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        }
      }
      const z = pts[pts.length - 1];
      return [z[1], z[2]];
    };
  }
  const q = { pos, T, down: tr.down ?? true, lift: tr.lift ?? true, done: false, t0: null, t1: null, w0: null };
  P.queue.push(q);
  return q;
}

// ── 날 각 탭 (combat.js:141-181 과 같은 식, 결과 r 옆에 적는다) ──
//  kind: cut · stab (판정 그대로) · flat (칼날 닿음인데 edgeAlign ≤ STRIKE.edgeAlign, 찌르기 후보 아님) ·
//        underE (칼날 베기·찌르기 후보였으나 문턱을 못 넘어 blunt) · blunt (칼날 밖·날 없는 무기·부러진 토막)
export function tapEdge(Combat, THREE, CONFIG) {
  if (Combat.prototype.__corrTap) return Combat.prototype.__corrTap;
  const { STRIKE, BREAK } = CONFIG;
  const orig = Combat.prototype.analyze;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const qi = new THREE.Quaternion();
  const tap = { info: new WeakMap(), listeners: new Set(), n: 0 };
  Combat.prototype.analyze = function (pr, point, S, P, predicting = false) {
    const r = orig.call(this, pr, point, S, P, predicting);
    if (r && !predicting) {
      const att = pr.w.fighter;
      const axis = Y.clone().applyQuaternion(S.q);
      const edge = X.clone().applyQuaternion(S.q);
      const rel = r.dir.clone().multiplyScalar(r.speed);
      const perp = rel.clone().addScaledVector(axis, -rel.dot(axis));
      const pl = perp.length();
      const ea = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
      const HL = att.weaponCfg.hiltLength;
      const local = point.clone().sub(S.p).applyQuaternion(qi.copy(S.q).invert());
      const isBlade = pr.w.part === 'blade' && local.y > HL - 0.01 && !!att.weaponCfg.edged && (!att.weaponBroken || !!BREAK?.stubEdge);
      const along = rel.dot(axis) / r.speed;
      const win = att.weaponCfg.thrustStyle ? att.weaponCfg.thrustStyle.window : 0;
      const stabCand = isBlade && along > STRIKE.stabAlign - win && r.t > 0.8 - win;
      const kind = r.type === 'cut' ? 'cut' : r.type === 'stab' ? 'stab' : !isBlade ? 'blunt' : stabCand ? 'underE' : ea > STRIKE.edgeAlign ? 'underE' : 'flat';
      const rec = { ea, eaDeg: (Math.acos(Math.min(1, ea)) * 180) / Math.PI, kind, isBlade, along, t: r.t, speed: r.speed, energy: r.energy, att, vic: pr.v.fighter, part: pr.v.part };
      tap.info.set(r, rec);
      tap.n++;
      for (const l of tap.listeners) l(rec, r);
    }
    return r;
  };
  Combat.prototype.__corrTap = tap;
  return tap;
}

// ── 작은 통계 ──
export const q = (a, p) => {
  const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!b.length) return null;
  const i = (b.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return b[lo] + (b[hi] - b[lo]) * (i - lo);
};
export const med = (a) => q(a, 0.5);
export const mean = (a) => {
  const b = a.filter((x) => x != null && Number.isFinite(x));
  return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null;
};
export const rN = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(n));
/** 윌슨 95 % 구간 */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - w) / d, (c + w) / d];
}
