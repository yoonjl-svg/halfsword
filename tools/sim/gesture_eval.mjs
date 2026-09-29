// R2 손짓 층 관문 (docs/strike/r2_impl_spec.md §8.2 Gesture, W2): 짜 놓은 손가락 길(SyntheticFinger)을 머리 없는 파이터에 넣고
//  S(t)·φ(t)·상태 흐름·지연을 잰다. 두 입력 방식 모두 ((A) wind, (B) stroke).
// 실행: node tools/sim/gesture_eval.mjs [--input=wind|stroke|both] [--out=파일.json] [--quiet]
//       node tools/sim/hybrid.mjs gesture_eval.mjs --input=wind
//  사례: (i) 쟁기 → 어깨 지붕 → 뒤집힘 → 바꿈 (zornhau 감기)  (ii) 감기 없는 쟁기 긋기  (iii) 감기 끝에서 1 s 버티기
//        (iv) 떼기 → tauRelease 로 풀림, 정확히 0  (v) 3 mm / 8 Hz 떨림  (+ 손가락 궤적 길(feedTrace) 60/120 Hz 로 같은 φ̇ 확인)
//  PASS/FAIL 은 최소 목표에만. 나머지는 보고
import { newRound, CONFIG, DT, feedTrace, inputPump } from './harness_m.mjs';
import { SyntheticFinger, GES_NAMES, GES_CUT, GES_FOLLOW, GES_WIND, GES_IDLE, GES_RECOVER, padFam } from '../../src/strike/gesture.js';
import { isMain } from './is_main.mjs';
import fs from 'node:fs';

const G_ = CONFIG.GESTURE;
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const QUIET = process.argv.includes('--quiet');
const STEP_MS = DT * 1000;
const PFLUG = [0.18, -0.28];
const TAG_R = [0.42, 0.42]; // 어깨 지붕 (diagR 준비 자세)
const WECHSEL_L = [-0.4, -0.42]; // 바꿈 (diagR 끝 자세)
const f3 = (x) => (x == null || !Number.isFinite(x) ? x : +x.toFixed(3));
const f1 = (x) => (x == null || !Number.isFinite(x) ? x : +x.toFixed(1));

// ── 손가락 길 짓기 (절대 패드 m, ms). 터치 표본 120 Hz ──
class Path {
  constructor(x, y) {
    this.pts = [[0, x, y, 1]];
    this.marks = {};
  }
  get last() {
    return this.pts[this.pts.length - 1];
  }
  hold(ms) {
    const [t, x, y, h] = this.last;
    const n = Math.max(1, Math.round(ms / (1000 / 120)));
    for (let k = 1; k <= n; k++) this.pts.push([t + (ms * k) / n, x, y, h]);
    return this;
  }
  /** (x, y) 까지 평균 빠르기 speed (m/s). shape 'lin' = 곧은 빠르기, 'mj' = 최소 저크 */
  move(x, y, speed, shape = 'lin') {
    const [t0, x0, y0] = this.last;
    const L = Math.hypot(x - x0, y - y0);
    const T = (L / speed) * 1000;
    const n = Math.max(1, Math.ceil(T / (1000 / 120)));
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const s = shape === 'mj' ? u * u * u * (10 - 15 * u + 6 * u * u) : u;
      this.pts.push([t0 + u * T, x0 + (x - x0) * s, y0 + (y - y0) * s, 1]);
    }
    return this;
  }
  lift() {
    const [t, x, y] = this.last;
    this.pts.push([t + 1, x, y, 0]);
    return this;
  }
  mark(k) {
    this.marks[k] = this.last[0];
    return this;
  }
  get T() {
    return this.last[0];
  }
  /** 떨림 겹치기: 3 mm / 8 Hz (x = sin, y = cos) — 120 Hz 로 다시 뽑는다 */
  jitter(amp = 0.003, hz = 8) {
    const sf = toSynth(this);
    const o = {};
    const out = new Path(0, 0);
    out.pts = [];
    for (let t = 0; t <= this.T + 1e-9; t += 1000 / 120) {
      sf.at(t, o);
      const a = 2 * Math.PI * hz * (t / 1000);
      out.pts.push([t, o.x + amp * Math.sin(a), o.y + amp * Math.cos(a), o.held || t === 0 ? 1 : 0]);
    }
    out.marks = { ...this.marks };
    return out;
  }
}
function toSynth(path) {
  const sf = new SyntheticFinger(path.pts.length + 8);
  for (const [t, x, y, h] of path.pts) sf.push(t, x, y, h === 1);
  return sf;
}

// ── 사례 ──
function zornhauWind(shape, vw = 3, vs = 6) {
  return new Path(...PFLUG).hold(400).move(...TAG_R, vw, shape).mark('rev').move(...WECHSEL_L, vs, shape).mark('stop').hold(1200);
}
function plowDrag(input, vs = 6) {
  // 쟁기에서 사선 아래로 0.6 m. (A)는 감기로 읽히지 않게 5 cm 되짚고 곧바로 긋는다 (sL0 안, 머묾 없음) — (B)는 쉬다가 곧바로
  const dx = -0.7, dy = -0.72, dl = Math.hypot(dx, dy);
  const p = new Path(...PFLUG).hold(400);
  if (input !== 'stroke') p.move(PFLUG[0] - (dx / dl) * 0.05, PFLUG[1] - (dy / dl) * 0.05, 1.0, 'lin');
  p.mark('rev');
  const [, x0, y0] = p.last;
  return p.move(x0 + (dx / dl) * 0.6, y0 + (dy / dl) * 0.6, vs, 'lin').mark('stop').hold(1200);
}
function holdTop() {
  return new Path(...PFLUG).hold(400).move(...TAG_R, 3, 'mj').mark('top').hold(1000).mark('rev').move(...WECHSEL_L, 6, 'mj').mark('stop').hold(1200);
}
function liftTop() {
  return new Path(...PFLUG).hold(400).move(...TAG_R, 3, 'mj').mark('top').hold(100).lift().mark('lift').hold(1500);
}
function liftAfter() {
  return new Path(...PFLUG).hold(400).move(...TAG_R, 3, 'lin').mark('rev').move(...WECHSEL_L, 6, 'lin').lift().mark('lift').hold(1500);
}
function stillJitter() {
  return new Path(...PFLUG).hold(2400).jitter();
}

/** 머리 없는 파이터 한 판에 길 하나: 스텝마다 손짓 층 출력을 적는다 */
function runSynth(path, input, opts = {}) {
  const save = { input: G_.input, clock: G_.clock };
  G_.input = input;
  if (opts.clock) G_.clock = opts.clock;
  const G = newRound({ seed: 1, walls: false });
  G.park();
  const f = G.player;
  const sf = toSynth(path);
  const ges = f.ges;
  ges.attachSource(sf);
  ges.reset();
  let commits = 0;
  f.onCommit = (st) => {
    if (st === 'B') commits++;
  };
  const o = {};
  let k = 0;
  G.before = () => {
    const t = ++k * STEP_MS;
    f.stepT = t;
    sf.at(t, o);
    // 손(패드)은 손가락을 따른다 (main.js 와 같이 handOffset 에; 0.62 m 자르기는 skill 이 한다)
    f.handOffset.set(o.x, o.y);
    f.handHeld = !!o.held;
    f.inputActive = Math.hypot(o.vx, o.vy) > 1e-3;
  };
  const rec = [];
  const nSteps = Math.ceil((path.T + (opts.tail ?? 300)) / STEP_MS);
  for (let i = 0; i < nSteps; i++) {
    G.step();
    rec.push({ t: k * STEP_MS, st: ges.state, S: ges.S, Sw: ges.Swind, Ss: ges.Sstroke, over: ges.over, c: ges.c, phiF: ges.phiF, phi: ges.phi, phiDot: ges.phiDot, famA: ges.famA, famB: ges.famB, mix: ges.famMix, side: ges.side, busy: ges.busy, v: Math.hypot(ges.v[0], ges.v[1]), arc0: ges.arc0, len: ges.strokeLen, mode: ges.mode, o: [...ges.o].map(x=>+x.toFixed(3)), p: [...ges.p].map(x=>+x.toFixed(3)) });
  }
  G_.input = save.input;
  G_.clock = save.clock;
  return { rec, commits, cuts: f.strike.stats.cuts, marks: path.marks, sf };
}

/** 손가락 궤적 길 (input.js → fingerTrace → readFinger): feedTrace, 화면 hz / 터치 touchHz */
function runTrace(path, input, hz, touchHz, lat = 0) {
  const save = G_.input;
  G_.input = input;
  const G = newRound({ seed: 1, walls: false });
  G.park();
  const f = G.player;
  f.handOffset.set(path.pts[0][1], path.pts[0][2]);
  inputPump(G, { hz, touchHz });
  // 손가락을 댄 자리 기준 상대 이동 (첫 점 = 0)
  const [, x0, y0] = path.pts[0];
  const lifted = path.pts.some((q) => q[3] === 0);
  const q = feedTrace(G, { pts: path.pts.filter((q) => q[3] === 1).map(([t, x, y]) => [t, x - x0, y - y0]), lift: lifted }, hz, { touchHz, lat });
  const ges = f.ges;
  const rec = [];
  let w0 = null;
  for (let i = 0; i < Math.ceil((path.T + 300) / STEP_MS) + 4; i++) {
    G.step();
    if (w0 == null && q.w0 != null) w0 = q.w0;
    rec.push({ t: w0 == null ? -1 : f.stepT - w0, st: ges.state, S: ges.S, phiF: ges.phiF, phiDotF: ges.phiDotF, phi: ges.phi, famA: ges.famA, v: Math.hypot(ges.v[0], ges.v[1]) });
  }
  G_.input = save;
  return { rec, marks: path.marks };
}

// ── 잣대 ──
const firstIdx = (rec, fn, from = 0) => {
  for (let i = from; i < rec.length; i++) if (fn(rec[i], i)) return i;
  return -1;
};
function timeline(rec) {
  const out = [];
  let prev = -1;
  for (const r of rec) {
    if (r.st !== prev) out.push([f1(r.t), GES_NAMES[r.st]]);
    prev = r.st;
  }
  return out;
}
/** 길에서 손가락이 뒤집힘 기준(|v| > vStrike, v·ŵ < revDot·|v|)을 처음 만족하는 시각 — 표본 기울기로 (몸과 무관) */
function fingerCriterionT(sf, tFrom, wHat, auto = false) {
  const o = {};
  for (let t = tFrom; t < tFrom + 1000; t += 0.25) {
    sf.at(t, o);
    const sp = Math.hypot(o.vx, o.vy);
    if (sp <= G_.vStrike) continue;
    if (auto || (o.vx * wHat[0] + o.vy * wHat[1]) < G_.revDot * sp) return t;
  }
  return null;
}
/** 긋기의 최대 손가락 속도가 뒤집힘 뒤 5 % 위상 (φ ≥ 0.05) 에 닿는 지연 */
function lat(rec, tRev) {
  const iCut = firstIdx(rec, (r) => r.st === GES_CUT && r.t >= tRev - 1e-9);
  const from = Math.max(0, iCut);
  const iP5 = iCut < 0 ? -1 : firstIdx(rec, (r) => r.st >= GES_CUT && r.phi >= 0.05, from);
  const iF5 = iCut < 0 ? -1 : firstIdx(rec, (r) => r.st >= GES_CUT && r.phiF >= 0.05, from);
  return { iCut, cutMs: iCut >= 0 ? rec[iCut].t - tRev : null, phi5Ms: iP5 >= 0 ? rec[iP5].t - tRev : null, phiF5Ms: iF5 >= 0 ? rec[iF5].t - tRev : null };
}
function famFlipsAfterLock(rec, iCut) {
  if (iCut < 0) return null;
  const r0 = rec[iCut];
  const tLock = r0.t + G_.lateSelect * 1000;
  let fam = null;
  let flips = 0;
  for (let i = iCut; i < rec.length && rec[i].st >= GES_CUT && rec[i].st <= GES_FOLLOW; i++) {
    const r = rec[i];
    const locked = r.t >= tLock || r.len >= G_.lateSelectLen;
    if (!locked) continue;
    if (fam == null) fam = r.famA;
    else if (r.famA !== fam) flips++;
  }
  return { fam, flips };
}
function series(rec, every = 2) {
  const out = [];
  for (let i = 0; i < rec.length; i += every) {
    const r = rec[i];
    out.push([f1(r.t), r.st, f3(r.S), f3(r.phiF), f3(r.phi)]);
  }
  return out;
}

// ── 사례별 판정 ──
function evalAll(input) {
  const A = input !== 'stroke';
  const res = { input, cases: {}, pass: true };
  const check = (name, ok, info) => {
    res.cases[name] = { ok, ...info };
    if (ok === false) res.pass = false;
  };

  // (i) zornhau 감기: 곧은 빠르기(lin, 뒤집힘 = 꼭짓점)와 최소 저크(mj) 둘 다
  for (const shape of ['lin', 'mj']) {
    const path = zornhauWind(shape);
    const R = runSynth(path, input);
    const tRev = path.marks.rev;
    // 뒤집힘 기준을 손가락이 처음 만족하는 시각 (A: 감기 방향 반대. B: 쉬다가 vStrike — 두 번째 긋기는 되돌아 긋기)
    const wHat = [TAG_R[0] - PFLUG[0], TAG_R[1] - PFLUG[1]];
    const wl = Math.hypot(...wHat);
    const tCrit = fingerCriterionT(R.sf, tRev, [wHat[0] / wl, wHat[1] / wl]);
    const L = lat(R.rec, tRev);
    const iCut = L.iCut;
    const cut = iCut >= 0 ? R.rec[iCut] : null;
    const latSteps = cut && tCrit != null ? (cut.t - tCrit) / STEP_MS : null;
    const ff = famFlipsAfterLock(R.rec, iCut);
    const iStop = firstIdx(R.rec, (r) => r.t >= path.marks.stop);
    const iRec = firstIdx(R.rec, (r) => !r.busy, Math.max(0, iStop));
    const Send = iStop > 0 ? R.rec[iStop - 1].S : null;
    const last = R.rec[R.rec.length - 1];
    const info = {
      shape, cuts: R.cuts, commits: R.commits, famA: cut?.famA, fam: cut ? padFam(cut.famA)?.base : null, side: cut?.side, mode: cut?.mode,
      S_atReversal: f3(cut?.S), S_endStroke: f3(Send), over_max: f3(Math.max(...R.rec.map((r) => r.over))),
      latency_criterion_to_CUT_steps: latSteps != null ? +latSteps.toFixed(2) : null, latency_vertex_to_CUT_ms: f1(L.cutMs), latency_vertex_to_phi5_ms: f1(L.phi5Ms), latency_vertex_to_phiF5_ms: f1(L.phiF5Ms),
      famAfterLock: ff, busyClear_after_stop_ms: iRec >= 0 && iStop >= 0 ? f1(R.rec[iRec].t - path.marks.stop) : null,
      S_final: last.S, state_final: GES_NAMES[last.st], timeline: timeline(R.rec), series: series(R.rec),
    };
    if (A) check(`i_zornhau_${shape}`, !!cut && cut.famA === 'diagR' && cut.S >= 0.9 && latSteps != null && latSteps <= 1 && R.cuts === 1 && ff?.flips === 0 && last.S === 0, info);
    else {
      // (B): 감기 다리 자체가 긋기다 (쉬다가 vStrike). 되돌아 긋기가 두 번째 베기 — diagR, 끝에서 S
      const i2 = firstIdx(R.rec, (r) => r.st === GES_CUT && r.t >= tRev - 1e-9 && r.famA === 'diagR');
      info.second = i2 >= 0 ? { famA: R.rec[i2].famA, t: f1(R.rec[i2].t - tRev) } : null;
      check(`i_zornhau_${shape}`, R.cuts >= 1 && i2 >= 0 && latSteps != null && latSteps <= 1 && last.S === 0, info);
    }
  }

  // (시뮬 A/B 전용) clock 'floor' = 설계서 옛 법칙 1/T0 + kv·v: 같은 zornhau 길 — 보고만
  {
    const path = zornhauWind('lin');
    const R = runSynth(path, input, { clock: 'floor' });
    const L = lat(R.rec, path.marks.rev);
    check('floor_clock_report', null, { cuts: R.cuts, latency_vertex_to_phi5_ms: f1(L.phi5Ms), S_final: R.rec[R.rec.length - 1].S, timeline: timeline(R.rec) });
  }

  // (ii) 쟁기 긋기 (감기 없음): S = arc0·(len/Lref)·(v̄/vRef), 잠근 뒤 무리 안 바뀜
  {
    const path = plowDrag(input);
    const R = runSynth(path, input);
    const tRev = path.marks.rev;
    const iCut = firstIdx(R.rec, (r) => r.st === GES_CUT);
    const cut = iCut >= 0 ? R.rec[iCut] : null;
    const tCrit = fingerCriterionT(R.sf, tRev - 60, [0.7 / 1.004, 0.72 / 1.004], !A);
    const ff = famFlipsAfterLock(R.rec, iCut);
    const iStop = firstIdx(R.rec, (r) => r.t >= path.marks.stop);
    const endR = iStop > 0 ? R.rec[iStop - 1] : null;
    const last = R.rec[R.rec.length - 1];
    const info = {
      cuts: R.cuts, famA: endR?.famA, mode: cut?.mode, arc0: f3(endR?.arc0), strokeLen: f3(endR?.len), S_end: f3(endR?.S), Sstroke_end: f3(endR?.Ss),
      latency_criterion_to_CUT_steps: cut && tCrit != null ? +((cut.t - tCrit) / STEP_MS).toFixed(2) : null, famAfterLock: ff, S_final: last.S, timeline: timeline(R.rec), series: series(R.rec),
    };
    check('ii_plow_stroke', !!cut && cut.mode === 'stroke' && endR.S > 0 && ff?.flips === 0 && R.cuts === 1 && last.S === 0, info);
  }

  // (iii) 감기 끝에서 1 s 버티기: S 가 그대로 (A). (B) 는 감기가 없으므로 보고만
  {
    const path = holdTop();
    const R = runSynth(path, input);
    const t0 = path.marks.top + 50, t1 = path.marks.rev;
    const hold = R.rec.filter((r) => r.t >= t0 && r.t <= t1);
    const Smin = Math.min(...hold.map((r) => r.S)), Smax = Math.max(...hold.map((r) => r.S));
    const fams = new Set(hold.map((r) => r.famA));
    const iCut = firstIdx(R.rec, (r) => r.st === GES_CUT && r.t >= t1 - 1e-9);
    const last = R.rec[R.rec.length - 1];
    const info = { S_hold_min: f3(Smin), S_hold_max: f3(Smax), statesDuringHold: [...new Set(hold.map((r) => GES_NAMES[r.st]))], famsDuringHold: [...fams], cutAfterHold: iCut >= 0 ? { famA: R.rec[iCut].famA, S: f3(R.rec[iCut].S) } : null, cuts: R.cuts, S_final: last.S, timeline: timeline(R.rec) };
    if (A) check('iii_hold_top_1s', Smax - Smin === 0 && Smin >= 0.9 && hold.every((r) => r.st === GES_WIND) && fams.size === 1 && iCut >= 0 && R.rec[iCut].S >= 0.9 && last.S === 0, info);
    else check('iii_hold_top_1s', last.S === 0, info);
  }

  // (iv) 떼기: tauRelease 로 풀리고 정확히 0 으로 (감기 끝에서 떼기 / 긋고 떼기)
  for (const [name, mk] of [['iv_lift_top', liftTop], ['iv_lift_after_stroke', liftAfter]]) {
    const path = mk();
    const R = runSynth(path, input, { tail: 600 });
    const tL = path.marks.lift;
    const i0 = firstIdx(R.rec, (r) => r.t >= tL);
    const S0 = i0 > 0 ? R.rec[i0 - 1].S : 0;
    const iT = firstIdx(R.rec, (r) => r.t >= tL + G_.tauRelease * 1000);
    const ratio = S0 > 0 && iT >= 0 ? R.rec[iT].S / S0 : null;
    const iZero = firstIdx(R.rec, (r) => r.S === 0, Math.max(0, i0));
    const tZero = iZero >= 0 ? R.rec[iZero].t - tL : null;
    const tZeroExpect = S0 > 0 ? G_.tauRelease * Math.log(S0 / G_.sSnap) * 1000 : null;
    const last = R.rec[R.rec.length - 1];
    const info = { S_atLift: f3(S0), S_ratio_after_tau: f3(ratio), expect_ratio: f3(Math.exp(-1)), zero_after_ms: f1(tZero), expect_zero_ms: f1(tZeroExpect), S_final: last.S, state_final: GES_NAMES[last.st], cuts: R.cuts, timeline: timeline(R.rec) };
    const decayOk = S0 === 0 || (ratio != null && Math.abs(ratio - Math.exp(-1)) < 0.03);
    check(name, decayOk && last.S === 0 && last.st === GES_IDLE, info);
  }

  // (v) 3 mm / 8 Hz 떨림: 가만히 + 떨림 → 베기 없음, S = 0. 감기 버티기 + 떨림 → 베기는 하나, 버티는 동안 무리 안 바뀜
  {
    const R = runSynth(stillJitter(), input);
    const Smax = Math.max(...R.rec.map((r) => r.S));
    check('v_jitter_still', R.cuts === 0 && Smax === 0, { cuts: R.cuts, S_max: Smax, states: [...new Set(R.rec.map((r) => GES_NAMES[r.st]))] });
    const pj = holdTop().jitter();
    const R2 = runSynth(pj, input);
    const hold = R2.rec.filter((r) => r.t >= pj.marks.top + 50 && r.t <= pj.marks.rev);
    const fams = new Set(hold.map((r) => r.famA));
    const cutsHold = new Set(hold.filter((r) => r.st >= GES_CUT && r.st <= GES_FOLLOW).map(() => 1)).size;
    const iCut = firstIdx(R2.rec, (r) => r.st === GES_CUT && r.t >= pj.marks.rev - 1e-9);
    const ff = famFlipsAfterLock(R2.rec, iCut);
    const last = R2.rec[R2.rec.length - 1];
    const info = { cuts: R2.cuts, famsDuringHold: [...fams], cutDuringHold: cutsHold > 0, famAfterLock: ff, S_hold_min: f3(Math.min(...hold.map((r) => r.S))), S_final: last.S, timeline: timeline(R2.rec) };
    if (A) check('v_jitter_hold_top', R2.cuts === 1 && fams.size === 1 && !cutsHold && ff?.flips === 0 && last.S === 0, info);
    else check('v_jitter_hold_top', !cutsHold && ff?.flips === 0 && last.S === 0, info);
  }

  // 손가락 궤적 길 (input.js → FingerTrace → readFinger): 60 / 120 Hz 화면, 120 Hz 터치 — 같은 φ̇, 같은 뒤집힘 지연
  {
    const path = zornhauWind('lin');
    const out = {};
    for (const [hz, th] of [[60, 60], [60, 120], [120, 120]]) {
      const R = runTrace(path, input, hz, th);
      const tRev = path.marks.rev;
      const iCut = firstIdx(R.rec, (r) => r.st === GES_CUT && r.t >= tRev - 30);
      const cut = iCut >= 0 ? R.rec[iCut] : null;
      // 터치 표본(touchHz 격자)이 뒤집힘을 처음 보여 주는 표본 시각 (그 표본으로 끝나는 구간의 기울기가 기준을 만족)
      const sf = toSynth(path);
      const o0 = {}, o1 = {};
      const dT = 1000 / th;
      const wv = [TAG_R[0] - PFLUG[0], TAG_R[1] - PFLUG[1]];
      const wl = Math.hypot(...wv);
      let tSample = null;
      for (let t = Math.floor(tRev / dT) * dT; t < tRev + 200; t += dT) {
        sf.at(t, o0);
        sf.at(t + dT, o1);
        const vx = ((o1.x - o0.x) / dT) * 1000, vy = ((o1.y - o0.y) / dT) * 1000;
        const sp = Math.hypot(vx, vy);
        if (sp > G_.vStrike && (A ? (vx * wv[0] + vy * wv[1]) / wl < G_.revDot * sp : true)) {
          tSample = t + dT;
          break;
        }
      }
      const mid = R.rec.filter((r) => r.st === GES_CUT && r.t > tRev + 40 && r.t < path.marks.stop - 20);
      const pd = mid.map((r) => r.phiDotF);
      const last = R.rec[R.rec.length - 1];
      out[`${hz}Hz_touch${th}`] = { cutAfterVertex_ms: cut ? f1(cut.t - tRev) : null, latency_sample_to_CUT_steps: cut && tSample != null ? +((cut.t - tSample) / STEP_MS).toFixed(2) : null, famA: cut?.famA, S_atReversal: f3(cut?.S), phiDotF_mean: f3(pd.reduce((a, b) => a + b, 0) / Math.max(1, pd.length)), phiDotF_expect: f3(6 / G_.sL1), S_final: R.rec[R.rec.length - 1].S, state_final: GES_NAMES[last.st] };
    }
    const vals = Object.values(out).map((o) => o.phiDotF_mean);
    const spread = Math.max(...vals) - Math.min(...vals);
    const okA = Object.values(out).every((o) => (A ? o.famA === 'diagR' && o.S_atReversal >= 0.9 && o.latency_sample_to_CUT_steps != null && o.latency_sample_to_CUT_steps <= 1 : true));
    check('trace_60_120Hz', okA && spread <= 0.02 * Math.max(...vals), { ...out, phiDotF_spread: f3(spread) });
  }

  // 이벤트 시각이 rAF 보다 lat ms 앞선 브라우저 (60 Hz 화면, 120/240 Hz 터치): 긋는 중에 v 가 0 으로 끊기지 않고 CUT 이 FOLLOW 까지 간다
  {
    const path = zornhauWind('lin');
    const tRev = path.marks.rev;
    const out = {};
    let ok = true;
    for (const [th, lat] of [[120, 6], [120, 10], [240, 5], [240, 10]]) {
      const R = runTrace(path, input, 60, th, lat);
      const iCut = firstIdx(R.rec, (r) => r.st === GES_CUT && r.t >= tRev - 30);
      const iFol = iCut >= 0 ? firstIdx(R.rec, (r) => r.st === GES_FOLLOW, iCut) : -1;
      const iRec = iCut >= 0 ? firstIdx(R.rec, (r) => r.st === GES_RECOVER, iCut) : -1;
      const last = R.rec[R.rec.length - 1];
      const o = { famA: iCut >= 0 ? R.rec[iCut].famA : null, cutAfterVertex_ms: iCut >= 0 ? f1(R.rec[iCut].t - tRev) : null, follow: iFol >= 0, recover_phiF: iRec >= 0 ? f3(R.rec[iRec].phiF) : null, S_final: last.S, timeline: timeline(R.rec) };
      out[`touch${th}_lat${lat}`] = o;
      if (!(o.follow && (!A || o.famA === 'diagR') && last.S === 0)) ok = false;
    }
    check('trace_latency', ok, out);
  }
  return res;
}

if (isMain(import.meta.url)) {
  const which = arg('input', 'both');
  const inputs = which === 'both' ? ['wind', 'stroke'] : [which];
  const all = [];
  for (const inp of inputs) all.push(evalAll(inp));
  const outFile = arg('out', null);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify({ format: 'gesture-eval/1', config: G_, results: all }, null, 1));
  for (const r of all) {
    console.log(`\n=== GESTURE.input = '${r.input}' — ${r.pass ? 'PASS' : 'FAIL'} ===`);
    for (const [k, c] of Object.entries(r.cases)) {
      const { timeline: tl, series: _s, ...rest } = c;
      console.log(`${c.ok === false ? 'FAIL' : c.ok === true ? 'pass' : '----'}  ${k}  ${JSON.stringify(rest)}`);
      if (!QUIET && tl) console.log(`      timeline ${JSON.stringify(tl)}`);
    }
  }
  process.exitCode = all.every((r) => r.pass) ? 0 : 1;
}
export { evalAll, runSynth, runTrace, Path, zornhauWind };
