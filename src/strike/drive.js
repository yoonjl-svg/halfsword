// ─────────────────────────────────────────────────────────────
//  R2 클립 추적 (docs/strike/r2_impl_spec.md §5): 손짓(f.ges) → 아틀라스 표본 → 몸통·골반 시간표, 닻 풀기, 앞먹임 회전력,
//   척추·엉덩이 범위와 무른 한계, 발 돌림·뒤꿈치, 내딛기. 팔(손·겨눔·IK)은 drive_arm.js (W4) 몫 — 여기선 cmd 칸만 채운다
//  S = 0 (정확히 0, 손짓 층의 sSnap) 이면 w = 0: 어떤 고리도 엔진에 쓰지 않는다. S 가 0 이 되는 스텝에 관절 한계를 한 번 되돌린다
//  상한·바닥·쿨다운 없음: 걸음 시간은 Math.max(d, 1e-3) 뿐, 발 돌림은 빠르기 한도 없이 바로 쓴다, over 는 모든 채널에 이득 1.
//   앞먹임 회전력은 원래 있던 근력 한도 j.max·mus 로만 자른다 (Q4, debug.ffCap 에 센다)
// ─────────────────────────────────────────────────────────────
import { DRIVE, GESTURE, GAIT, STROKE } from '../config.js';
import { makeSample, toGame, carryOver, CH, D2R, DROP_BASE, GAME_SIGN, GUARD_PADS, chestFrame, quatFromM3 } from './atlas.js';
import { GES_IDLE, GES_WIND, GES_CUT, GES_FOLLOW, padFam } from './gesture.js';

const ANG_Y = 4; // RawJointAxis.AngY (fighter.js MOTOR_AXES[1]): 비틀기 축
const KEYS = ['pelvisYaw', 'chestYaw', 'pitch', 'drop', 'side'];
const DOTS = ['pelvisYawDot', 'chestYawDot', 'pitchDot', 'dropDot', 'sideDot'];
const ABOVE_CHEST = ['chest', 'head', 'uarmS', 'farmS', 'uarmO', 'farmO'];
const MODE_NUM = { wind: 1, stroke: 2 };
const TAU = Math.PI * 2;

const smoothstep = (a, b, x) => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};
const wrap = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
};

// 무리 이름 → 클립 베기 이름 (패드 무리 key 'diagR', 기본 무리 'diag', 베기 이름 'zornhau' 모두). 모듈을 읽을 때 한 번 (스텝마다 할당 없음)
const CUT_OF = {};
for (const [base, cut] of Object.entries(GESTURE.famClip)) (CUT_OF[base] = cut), (CUT_OF[cut] = cut);
for (const k of Object.keys(STROKE.path)) {
  const pf = padFam(k);
  if (pf && GESTURE.famClip[pf.base]) CUT_OF[k] = GESTURE.famClip[pf.base];
}
const CUT_IDX = {};
Object.values(GESTURE.famClip).forEach((c, i) => (CUT_IDX[c] = i));

function makeCmd() {
  return {
    S: 0, c: 0, over: 0, mode: 0, phi: -1, phiDot: 0, phiDDot: 0, phiF: -1, phiDotF: 0,
    pelvisYaw: 0, pelvisYawDot: 0, pelvisYawDDot: 0, chestYaw: 0, chestYawDot: 0, chestYawDDot: 0,
    pitch: 0, pitchDot: 0, pitchDDot: 0, drop: 0, dropDot: 0, side: 0, sideDot: 0, sideDDot: 0,
    qChestCmd: new Float64Array([0, 0, 0, 1]), // 바라보는 틀 쿼터니언 [x, y, z, w] (three.js 차례)
    wChestCmd: new Float64Array(3), // 명령 가슴 틀의 월드 각속도 (rad/s)
    handS: new Float64Array(3), handO: new Float64Array(3), sword: new Float64Array(3),
    swordDot: new Float64Array(3), // 칼 방향의 dω/dφ (가슴 틀, φ 당) — 쓰는 쪽이 φ̇ 를 곱한다 (§6.2)
    edge: new Float64Array(3), poleS: new Float64Array(3), poleO: new Float64Array(3),
    girdleS: new Float64Array(2), girdleO: new Float64Array(2),
    balanceAssist: 1,
    foot: { stance: { yaw: 0, lift: 0 }, swing: { yaw: 0, lift: 0 } }, // 역할(딛는 발·내딛는 발)로. yaw 는 게임 rad, lift 0–1
    step: { fwd: 0, side: 0, liftPhi: 0, landPhi: 0 },
    warp: new Float64Array(3), // W4 (§6.3). 여기선 0
    openness: 0, guardGap: 0,
  };
}
const _g0 = {}, _g1 = {}, _g2 = {}; // toGame 그릇 (값·dφ·d²φ)

/** 몸 쿼터니언 q 의 R^T·ŷ (월드 위쪽을 몸 틀로) */
const invUp = (q, o) => {
  o[0] = 2 * (q.x * q.y + q.w * q.z);
  o[1] = 1 - 2 * (q.x * q.x + q.z * q.z);
  o[2] = 2 * (q.y * q.z - q.w * q.x);
  return o;
};
/** 몸 쿼터니언 q 의 R·ŷ (몸 y 축을 월드로) */
const bodyY = (q, o) => {
  o[0] = 2 * (q.x * q.y - q.w * q.z);
  o[1] = 1 - 2 * (q.x * q.x + q.z * q.z);
  o[2] = 2 * (q.y * q.z + q.w * q.x);
  return o;
};
/** 몸 x 축의 수평 방위 (gait l.yaw 와 같은 규칙: atan2(−fx.z, fx.x)) */
const yawOf = (q) => Math.atan2(-2 * (q.x * q.z - q.w * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));

/** 몸 틀 관성 텐서 (질량 중심, 9칸 행 우선). 부위 모양·덧붙인 관성은 싸움 중 바뀌지 않는다 (발 무게만 바뀌는데 여기 없다) */
function localTensor(rb, out = new Float64Array(9)) {
  const p = rb.principalInertia();
  const q = rb.principalInertiaLocalFrame();
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
  const P = [p.x, p.y, p.z];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = R[i * 3] * P[0] * R[j * 3] + R[i * 3 + 1] * P[1] * R[j * 3 + 1] + R[i * 3 + 2] * P[2] * R[j * 3 + 2];
  return out;
}

export class ClipDrive {
  constructor(fighter, atlas) {
    const f = (this.f = fighter);
    this.atlas = atlas;
    this._w = 0;
    this._c = 0;
    this.active = false; // 앞 스텝에 S > 0 이었나 (되돌림 한 번)
    this.touched = false; // 관절 한계를 바꿨나
    this.stepping = false; // 내딛기를 부탁했고 아직 안 디뎠다
    this.landed = false;
    this.handOn = false; // W4: mode === 'wind' || DRIVE.handOnStroke
    this.t = 0; // 드라이브 시계 (s, 스텝마다 dt)
    this.cmd = makeCmd();
    this.A = makeSample();
    this.Arev = makeSample();
    this.A0 = makeSample();
    this._tmp = makeSample();
    this._req = { cut: '', side: 'right', phi: 0, S: 0, over: 0, cutB: null, wAB: 0 };
    this._M = new Float64Array(9);
    this._v3 = new Float64Array(3);
    this._u3 = new Float64Array(3);
    this._T = { x: 0, y: 0, z: 0 };
    this._restChest = new Float64Array([0, 0, 0, -1]); // W4b: mixBody 앞 자세표 가슴 [chestYaw, pitch, side, 드라이브 시각]
    this._hm = 0; // W4b: 손 몫 방식 0 track · 1 finger · 2 governed · 3 windOnly (armStep 이 w > 0 스텝마다)
    this._dtS = 0; // W4c: 이번 스텝 dt (w > 0 스텝에서만 쓴다)
    this._ffT = -1; // W4c ffFilter: 앞 스텝 명령 빠르기를 적은 드라이브 시각
    this._ffPrev = new Float64Array(4); // W4c ffFilter: 앞 스텝 chestYawDot·pelvisYawDot·pitchDot·sideDot
    // 컷(한 획) 상태
    this._cutSeen = -1;
    this._inCut = false;
    this._carry = false;
    this._phiAlign = 0;
    this._phiStart = 0; // 이어받기 시작 위상: 감기 0, 긋기 φ_align / −autoWindPhi (§5.2)
    this._rebaseD = 0; // 감기 베기: 걸러진 몸 위상이 시작할 때 들고 온 변위 (§5.2 이어받기의 φ 는 0 에서 시작한다)
    this._tau = 0;
    this._gPhiPrev = -1;
    this._stepDone = false;
    this._tcSeen = false;
    this._cut = null;
    this._side = 'right';
    this._S = 0;
    this._over = 0;
    this._phiB = -1;
    this._phiDot = 0;
    this._phiDDot = 0;
    this._state = GES_IDLE;
    this._stepFoot = 'R';
    this._swingLeg = 'B';
    // 발 돌림 (다리마다 {yawTDSeen, base, clipRef, role, cut}) — 디딜 때마다 다시 잡는다
    this._piv = { F: { seen: NaN, base: 0, ref: 0, role: '', cut: -2 }, B: { seen: NaN, base: 0, ref: 0, role: '', cut: -2 } };
    // 짜 놓은 위상 (drive.script)
    this._scr = false;
    this._sc = { phi: -1, S: 0, cut: 'zornhau', side: 'right', phiDot: NaN, prevPhi: NaN, prevDot: 0, cutN: 0, was: false };
    // 닻 (driveBalance 가 알려 준다)
    this._kY = 0;
    this._dY = 0;
    this._headPrev = f.heading;
    // 관절: 비틀기 한계 (생성자 문자 그대로 되돌린다) + 무른 한계
    const J = f.jointByName;
    const hipW = DRIVE.hipTwist - GAIT.hipTwist; // 다리 걸음(hybrid)이면 0.9 → 1.1, 공중(levitate)이면 0.6 → 0.8
    this._lims = [
      { j: J.abdomen, lo: J.abdomen.lim.y[0], hi: J.abdomen.lim.y[1], wide: DRIVE.absTwist, kS: DRIVE.kSoft.spine, L: 0 },
      { j: J.chest, lo: J.chest.lim.y[0], hi: J.chest.lim.y[1], wide: DRIVE.chestTwist, kS: DRIVE.kSoft.spine, L: 0 },
      { j: J.thighF, lo: J.thighF.lim.y[0], hi: J.thighF.lim.y[1], wide: J.thighF.lim.y[1] + hipW, kS: DRIVE.kSoft.hip, L: 0 },
      { j: J.thighB, lo: J.thighB.lim.y[0], hi: J.thighB.lim.y[1], wide: J.thighB.lim.y[1] + hipW, kS: DRIVE.kSoft.hip, L: 0 },
    ];
    // 관성: 부위마다 몸 틀 텐서·질량 (한 번). 칼은 몸이 바뀌면 다시
    this._ib = {};
    for (const n of [...ABOVE_CHEST, 'abdomen', 'pelvis']) this._ib[n] = { rb: f.bodies[n], m: f.bodies[n].mass(), I: localTensor(f.bodies[n]) };
    this._sw = { rb: null, m: 0, I: new Float64Array(9) };
    // 관절 자리 (자식 몸 틀): 가슴 관절 (배→가슴), 배 관절 (골반→배)
    const a2 = (j) => {
      const a = j.joint.anchor2();
      return [a.x, a.y, a.z];
    };
    this._aChest = a2(J.chest);
    this._aAbd = a2(J.abdomen);
    // 읽기 전용 보기 (손짓 층이 없으면 드라이브가 만든다: script 시험용)
    if (!f.strike) f.strike = { S: 0, phi: -1, state: GES_IDLE, homePad: null, openness: 0, guardGap: 0, nearGuards: null, stats: { cuts: 0, commits: 0, atlasMissing: 0 } };
    const st = f.strike.stats;
    for (const k of ['stepRequests', 'stepRefused', 'stepLost', 'stepLanded', 'footSlipMax', 'ffCap', 'reachClamp', 'reachClampMax', 'poleFlip', 'rateClip', 'girdleMax']) st[k] ??= 0;
    this.stats = st;
    // §5.8 (Float64: 수는 배정도, 벡터는 Float64Array)
    this.debug = {
      t: 0, state: 0, S: 0, c: 0, mode: 0, phiF: -1, phiB: -1, phiDot: 0, phiDDot: 0, fam: -1, side: 1, tCut: 0,
      handCmdW: new Float64Array(3), handActW: new Float64Array(3), handErr: 0, aimCmdW: new Float64Array(3), aimErrDeg: 0,
      pelvisYawCmd: 0, pelvisYawAct: 0, pelvisLag: 0, chestYawCmd: 0, chestYawAct: 0, chestLag: 0,
      ffAbd: 0, ffChest: 0, ffHip: 0, ffCap: 0, tauAnchor: 0, P_anchor: 0, L_trunk: 0, L_arm: 0,
      I_aboveChest: 0, I_aboveAbd: 0, I_pelvis: 0, softLim: 0,
      stepReq: 0, stepDur: 0, tStepReq: -1, landed: 0, tLand: -1, tTc: -1, footSlip: 0, footSlipMax: 0,
      warp: 0, reachClamp: 0, poleFlip: 0, rateClip: 0,
      windRebase: 0, ffFiltered: 0, // W4c: windOnly 베기 손 차이 (m), 앞먹임이 스텝 평균 가속을 썼나 (1 몸통, 2 팔)
    };
  }

  /** = S (0 이면 모든 고리가 멈춘다). 정확한 0 은 손짓 층의 sSnap 이 보장한다 */
  get w() {
    return this._w;
  }
  /** 자세표 ↔ 클립 넘김 smoothstep(0, mixX, S) — S 는 크기, c 는 섞음 (§5.3) */
  get c() {
    return this._c;
  }

  // ───────── 매 스텝 (skill.update 뒤) ─────────
  update(dt) {
    const f = this.f;
    const g = f.ges;
    this.t += dt;
    if (this.stepping && f.gait?.req?.kind !== 'strike') {
      // 부탁한 걸음이 딛기 전에 사라졌다 (다른 부탁이 덮음·1초 지남·걸음 꺼짐) — 다시 부탁하지 않는다, 센다
      this.stepping = false;
      this.stats.stepLost++;
    }
    let S, over, st, mode, phiG, phiDotG, phiDDotG, cutN, cut, cutB, wAB, side;
    if (this._scr) {
      const s = this._sc;
      S = s.S;
      over = S > 1 ? S - 1 : 0;
      if (S > 1) S = 1;
      st = s.phi < 0 ? GES_WIND : s.phi < 1 ? GES_CUT : GES_FOLLOW;
      mode = 'wind';
      const pd = Number.isFinite(s.phiDot) ? s.phiDot : Number.isFinite(s.prevPhi) ? (s.phi - s.prevPhi) / dt : 0;
      phiDDotG = Number.isFinite(s.prevPhi) ? (pd - s.prevDot) / dt : 0;
      phiG = s.phi;
      phiDotG = pd;
      s.prevPhi = s.phi;
      s.prevDot = pd;
      if (st >= GES_CUT && !s.was) s.cutN++;
      s.was = st >= GES_CUT;
      cutN = s.cutN;
      cut = cutB = s.cut;
      wAB = 0;
      side = s.side;
    } else {
      if (!g) return this.idle();
      S = g.S;
      over = g.over;
      st = g.state;
      mode = g.mode;
      phiG = g.phi;
      phiDotG = g.phiDot;
      phiDDotG = g.phiDDot;
      cutN = g.view ? g.view.stats.cuts : 0;
      cut = CUT_OF[g.famA];
      cutB = CUT_OF[g.famB] ?? cut;
      wAB = g.famMix;
      side = g.side;
    }
    if (S === 0 || !cut) {
      this._gPhiPrev = phiG;
      return this.idle();
    }
    const first = !this.active;
    this.active = true;
    this._w = S;
    this._c = smoothstep(0, DRIVE.mixX, S);
    this._dtS = dt;
    // 새 획 (베기 시작 뒤 처음 보는 S > 0 스텝): 이어받기 표본·φ_align·돌아갈 자세·걸음 한 번
    if (st === GES_WIND || st === GES_IDLE) this._inCut = false;
    else if (cutN !== this._cutSeen) this.beginCut(g, S, over, st, mode, phiG, cut, cutB, wAB, side, dt, first);
    if (first) this.rebaseRoles();
    // 몸 위상 phiB (§5.2 / §3.10)
    let phiB = phiG, phiBDot = phiDotG, phiBDDot = phiDDotG;
    if (this._inCut) {
      this._tau += dt;
      if (mode === 'stroke') phiB = this._phiAlign + phiG;
      else if (this._rebaseD !== 0) {
        // 감기 베기: 걸러진 위상은 φ_rev 에서 이어 오지만 이어받기는 φ = 0 에서 시작하는 위상을 쓴다 → 거르개의 제 응답(임계 감쇠, 변위 d, 속도 0)을 뺀다
        const w = GESTURE.phiW, x = w * this._tau, e = Math.exp(-x), d = this._rebaseD;
        phiB = phiG - d * (1 + x) * e;
        phiBDot = phiDotG + d * w * w * this._tau * e;
        phiBDDot = phiDDotG - d * w * w * (x - 1) * e;
      }
    }
    this._gPhiPrev = phiG;
    this._phiB = phiB;
    this._phiDot = phiBDot;
    this._phiDDot = phiBDDot;
    this._state = st;
    this._S = S;
    this._over = over;
    this._cut = cut;
    this._side = side;
    this.handOn = mode === 'wind' || DRIVE.handOnStroke;
    // 표본 (크기 S, over 는 아틀라스가 모든 채널에 이득 1 로 잇는다)
    const A = this.A, rq = this._req;
    rq.cut = cut;
    rq.side = side;
    rq.phi = phiB;
    rq.S = S;
    rq.over = over;
    rq.cutB = cutB;
    rq.wAB = wAB;
    this.atlas.sample(A, rq);
    // 이어받기 (두 방식 다): 페이드 좌표 = 베기 시작 뒤 위상 phiB − phiStart (감기는 phiStart 0 이라 그대로)
    const u = phiB - this._phiStart;
    if (this._carry && this._inCut && u < DRIVE.carryPhi) carryOver(A, this.Arev, this.A0, u > 0 ? u : 0, DRIVE.carryPhi);
    this.toCmd(A, phiB, phiBDot, phiBDDot, S, over, mode, g);
    if (this.armStep) this.armStep(dt); // W4b: 손 몫 방식 (DRIVE.handMode, w > 0 에서만 읽는다). 'track' 은 아무것도 안 쓴다
    if (!this._tcSeen && this._inCut && phiB >= 0.85) {
      this._tcSeen = true;
      this.debug.tTc = this.t;
    }
    // 역할: 한 발만 떠 있으면 그 발이 내딛는 발
    const gt = f.gait;
    if (gt) {
      const Fs = gt.legs.F.stance, Bs = gt.legs.B.stance;
      if (Fs !== Bs) this._swingLeg = Fs ? 'B' : 'F';
    }
    this.requestStepIfDue(st, S + over);
    this.fillDebug(st, mode, g, phiG, cut, side);
  }

  /** S = 0: w = 0, 앞 스텝까지 켜져 있었으면 한 번 되돌린다 */
  idle() {
    this._w = 0;
    this._c = 0;
    if (this.active) this.restoreOnce();
  }

  restoreOnce() {
    this.active = false;
    if (this.touched) {
      for (const L of this._lims) L.j.joint.rawSet.jointSetLimits(L.j.joint.handle, ANG_Y, L.lo, L.hi);
      this.touched = false;
    }
    this._piv.F.cut = this._piv.B.cut = -2; // 다음에 켜지면 발 돌림을 다시 잡는다
    this.debug.S = 0;
    this.debug.c = 0;
  }

  beginCut(g, S, over, st, mode, phiG, cut, cutB, wAB, side, dt, first) {
    const f = this.f;
    this._cutSeen = this._scr ? this._sc.cutN : g.view ? g.view.stats.cuts : 0;
    this._inCut = true;
    this._tau = 0;
    this._stepDone = false;
    this._tcSeen = false;
    this.landed = false;
    this.debug.tCut = this.t;
    this.debug.tTc = -1;
    this.debug.tLand = -1;
    this.debug.stepReq = 0;
    this.debug.landed = 0;
    this._carry = false;
    this._rebaseD = 0;
    this._phiAlign = 0;
    this._phiStart = 0;
    if (!this._scr) {
      if (mode === 'wind') {
        // 이어받기 표본: φ_rev 와 0, 이 순간의 S 로 한 번 (§5.2)
        const rq = this._req;
        rq.cut = cut;
        rq.side = side;
        rq.S = S;
        rq.over = over;
        rq.cutB = cutB;
        rq.wAB = wAB;
        // φ_rev 는 뒤집힐 때 몸이 보이던 위상 (앞 스텝 걸러진 φ, 감기 뜻역 [−1, 0]): 이어받기 첫 스텝이 그 자세와 정확히 같다
        //  (손가락 φ_rev = g.phiRev 와는 거르개 늦음·앞섬만큼 다르다 — 그 차이만큼 뛰지 않게)
        rq.phi = this._gPhiPrev < 0 ? this._gPhiPrev : 0;
        this.atlas.sample(this.Arev, rq);
        rq.phi = 0;
        this.atlas.sample(this.A0, rq);
        this._carry = true;
        this._rebaseD = this._gPhiPrev; // 앞 스텝의 거르개 위상 (이번 스텝에 한 번 움직였다: τ = dt 부터)
        this._tau = 0;
      } else {
        if (g.input !== 'stroke') this._phiAlign = this.phiAlign(cut, side, S, over, cutB, wAB);
        else this._phiAlign = -GESTURE.autoWindPhi;
        this._phiStart = this._phiAlign;
        // 감기 없는 긋기의 이어받기 (§3.5 / §5.2): A0 = 시작 위상 표본, Arev = 베기 시작 때 몸이 따르던 자세 (W3 결정)
        //  켜져 있었으면 앞 스텝의 표본 A (이번 스텝에 덮어쓰기 전) 그대로. 처음 켜지면 앞 표본이 없다 → A0 에 몸통 다섯 칸만
        //  지금 명령 자세(bodyPose = 자세표 몫, c 가 0 이던 앞 스텝)를 클립 단위로 넣는다 (손·칼·발은 A0 그대로 = 이어받을 몫 0)
        if (!first) {
          const P = this.A, R = this.Arev;
          R.v.set(P.v);
          R.d1.set(P.d1);
          R.d2.set(P.d2);
        }
        const rq = this._req;
        rq.cut = cut;
        rq.side = side;
        rq.S = S;
        rq.over = over;
        rq.cutB = cutB;
        rq.wAB = wAB;
        rq.phi = this._phiStart;
        this.atlas.sample(this.A0, rq);
        if (first) {
          const R = this.Arev, bp = f.bodyPose;
          R.v.set(this.A0.v);
          R.d1.set(this.A0.d1);
          R.d2.set(this.A0.d2);
          R.v[CH.pelvisYaw] = bp.pelvisYaw / GAME_SIGN.yaw;
          R.v[CH.chestYaw] = bp.chestYaw / GAME_SIGN.yaw;
          R.v[CH.chestLean] = bp.pitch / GAME_SIGN.lean;
          R.v[CH.chestSide] = bp.side / GAME_SIGN.side;
          R.v[CH.pelvisDrop] = (bp.drop + DROP_BASE) / GAME_SIGN.drop;
        }
        this._carry = true;
      }
    }
    // 돌아갈 자세 (§5.7): S > 0 이 된 뒤에만
    const sv = f.strike;
    const rid = this.atlas.recoverTo(cut, side, S);
    sv.homePad = GUARD_PADS[rid] ?? null;
    sv.nearGuards = this.atlas.nearGuards(cut, side, S);
    // 발 역할: 클립에서 내딛는 발 (step.foot), 게임에서 뒤에 있는 발이 지나간다 (gait.js 다음 발 규칙)
    this._stepFoot = this.atlas.fam(cut, side).medium.meta.step?.foot ?? 'R';
    this.rebaseRoles();
  }

  /** 뒤에 있는 발 = 내딛는 역할 (두 발 다 디딘 때). 한 발이 떠 있으면 그 발 */
  rebaseRoles() {
    const gt = this.f.gait;
    if (!gt) return;
    const F = gt.legs.F, B = gt.legs.B;
    if (F.stance !== B.stance) {
      this._swingLeg = F.stance ? 'B' : 'F';
      return;
    }
    const h = this.f.heading;
    const d = (F.plant.x - B.plant.x) * Math.cos(h) - (F.plant.z - B.plant.z) * Math.sin(h);
    this._swingLeg = d >= 0 ? 'B' : 'F';
  }

  /** (A) 감기 없는 긋기: clip.chest.yaw(φ) 가 지금 명령 가슴 yaw 와 같은 φ ∈ [0, 0.85] (끝에서는 끝 값) */
  phiAlign(cut, side, S, over, cutB, wAB) {
    const target = -this.f.bodyPose.chestYaw / D2R; // 게임 rad → 클립 도
    const o = this._tmp, rq = this._req;
    rq.cut = cut;
    rq.side = side;
    rq.S = S;
    rq.over = over;
    rq.cutB = cutB;
    rq.wAB = wAB;
    const yawAt = (p) => {
      rq.phi = p;
      this.atlas.sample(o, rq);
      return o.v[CH.chestYaw];
    };
    let a = 0, b = 0.85;
    const ya = yawAt(a), yb = yawAt(b);
    if ((target - ya) * (target - yb) > 0) return Math.abs(target - ya) <= Math.abs(target - yb) ? a : b;
    const up = yb > ya;
    for (let i = 0; i < 30; i++) {
      const m = 0.5 * (a + b);
      const ym = yawAt(m);
      if (ym < target === up) a = m;
      else b = m;
    }
    return 0.5 * (a + b);
  }

  /** 표본 → 게임 단위 cmd (§4.3) */
  toCmd(A, phiB, pd, pdd, S, over, mode, g) {
    const cmd = this.cmd;
    toGame(A.v, _g0);
    toGame(A.d1, _g1, true);
    toGame(A.d2, _g2, true);
    const pd2 = pd * pd;
    cmd.S = S;
    cmd.c = this._c;
    cmd.over = over;
    cmd.mode = MODE_NUM[mode] ?? 0;
    cmd.phi = phiB;
    cmd.phiDot = pd;
    cmd.phiDDot = pdd;
    cmd.phiF = g && !this._scr ? g.phiF : phiB;
    cmd.phiDotF = g && !this._scr ? g.phiDotF : pd;
    cmd.pelvisYaw = _g0.pelvisYaw;
    cmd.pelvisYawDot = _g1.pelvisYaw * pd;
    cmd.pelvisYawDDot = _g2.pelvisYaw * pd2 + _g1.pelvisYaw * pdd;
    cmd.chestYaw = _g0.chestYaw;
    cmd.chestYawDot = _g1.chestYaw * pd;
    cmd.chestYawDDot = _g2.chestYaw * pd2 + _g1.chestYaw * pdd;
    cmd.pitch = _g0.pitch;
    cmd.pitchDot = _g1.pitch * pd;
    cmd.pitchDDot = _g2.pitch * pd2 + _g1.pitch * pdd;
    cmd.drop = _g0.drop;
    cmd.dropDot = _g1.drop * pd;
    cmd.side = _g0.side;
    cmd.sideDot = _g1.side * pd;
    cmd.sideDDot = _g2.side * pd2 + _g1.side * pdd; // W4b: 명령 가슴 각가속도 (handMode 'finger' 팔 앞먹임)
    if (DRIVE.ffFilter) this.ffStepMean(cmd);
    // 가슴 틀 (명령): M = ry(−yaw)·rz(−lean)·rx(side) → 쿼터니언. 각속도 = ȧ·ŷ + ry(a)·ḃẑ + ry(a)rz(b)·ċx̂ (a = chestYaw, b = −pitch, c = side)
    const v = A.v;
    const M = chestFrame(v[CH.chestYaw], v[CH.chestLean], v[CH.chestSide], this._M);
    quatFromM3(M, cmd.qChestCmd);
    const a = cmd.chestYaw, b = -cmd.pitch;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const ad = cmd.chestYawDot, bd = -cmd.pitchDot, cd = cmd.sideDot;
    // ry(a)·ẑ = (sa, 0, ca), ry(a)·rz(b)·x̂ = (ca·cb, sb, −sa·cb)
    const wx = bd * sa + cd * ca * cb, wy = ad + cd * sb, wz = bd * ca - cd * sa * cb;
    const q = this.f.yaw; // 바라보는 틀 → 월드
    const tx = 2 * (q.y * wz - q.z * wy), ty = 2 * (q.z * wx - q.x * wz), tz = 2 * (q.x * wy - q.y * wx);
    cmd.wChestCmd[0] = wx + q.w * tx + (q.y * tz - q.z * ty);
    cmd.wChestCmd[1] = wy + q.w * ty + (q.z * tx - q.x * tz);
    cmd.wChestCmd[2] = wz + q.w * tz + (q.x * ty - q.y * tx);
    for (let k = 0; k < 3; k++) {
      cmd.handS[k] = v[CH.handS + k];
      cmd.handO[k] = v[CH.handO + k];
      cmd.sword[k] = v[CH.sword + k];
      cmd.swordDot[k] = A.d1[CH.sword + k];
      cmd.edge[k] = v[CH.edge + k];
      cmd.poleS[k] = v[CH.poleS + k];
      cmd.poleO[k] = v[CH.poleO + k];
    }
    for (let k = 0; k < 2; k++) {
      cmd.girdleS[k] = v[CH.girdleS + k];
      cmd.girdleO[k] = v[CH.girdleO + k];
    }
    const gm = Math.hypot(v[CH.girdleS], v[CH.girdleS + 1], v[CH.girdleO], v[CH.girdleO + 1]);
    if (gm > this.stats.girdleMax) this.stats.girdleMax = gm;
    cmd.balanceAssist = balanceAssist(phiB);
    // 발: 역할로 (클립 step.foot = 내딛는 발)
    const sw = this._stepFoot === 'L';
    cmd.foot.swing.yaw = sw ? _g0.footLYaw : _g0.footRYaw;
    cmd.foot.stance.yaw = sw ? _g0.footRYaw : _g0.footLYaw;
    cmd.foot.swing.lift = sw ? v[CH.footLLift] : v[CH.footRLift];
    cmd.foot.stance.lift = sw ? v[CH.footRLift] : v[CH.footLLift];
    cmd.openness = v[CH.openness];
    cmd.guardGap = v[CH.guardGap];
    const sv = this.f.strike;
    sv.openness = cmd.openness;
    sv.guardGap = cmd.guardGap;
  }

  /**
   * W4c DRIVE.ffFilter: 앞먹임 가속 = 이번 스텝 명령 빠르기의 평균 가속 (v′φ̇ 가 한 스텝에 바뀐 만큼 / dt). 한 점 v″·φ̇² 는
   *  손가락 빠르기에서 한 스텝에 φ 가 0.3 넘게 가 클립 곡률을 띄엄띄엄 집어 부호가 스텝마다 뒤집힌다. 앞 스텝이 꺼져 있었으면 한 점 값 그대로. 새 상수 없음
   */
  ffStepMean(cmd) {
    const P = this._ffPrev, dt = this._dtS;
    this.debug.ffFiltered = 0;
    if (this._ffT >= this.t - 1.5 * dt) {
      const k = 1 / dt;
      cmd.chestYawDDot = (cmd.chestYawDot - P[0]) * k;
      cmd.pelvisYawDDot = (cmd.pelvisYawDot - P[1]) * k;
      cmd.pitchDDot = (cmd.pitchDot - P[2]) * k;
      cmd.sideDDot = (cmd.sideDot - P[3]) * k;
      this.debug.ffFiltered = 1;
    }
    P[0] = cmd.chestYawDot;
    P[1] = cmd.pelvisYawDot;
    P[2] = cmd.pitchDot;
    P[3] = cmd.sideDot;
    this._ffT = this.t;
  }

  /** 한 획에 한 번 (§5.6): 긋는 중(CUT·FOLLOW) · S > stepS · 무리 잠김 · 걸음 켜짐. 거절은 센다, 다시 부탁하지 않는다 */
  requestStepIfDue(st, Sx) {
    // CUT 또는 FOLLOW (긋는 중): 느리게 쌓이는 (B)·감기 없는 긋기는 S 가 φ 1 을 넘어서야 stepS 를 넘을 수 있다 — Q7 "S > 0.3 인 긋기는 모두 내딛는다"
    if (!DRIVE.step || this._stepDone || !this._inCut || (st !== GES_CUT && st !== GES_FOLLOW)) return;
    if (!(this._S > DRIVE.stepS)) return;
    if (!this._scr && !this.f.ges?._locked) return;
    const gt = this.f.gait;
    if (!gt?.active) return;
    this._stepDone = true;
    const s = this.atlas.step(this._cut, this._side, Sx); // 획마다 한 번 (할당)
    const pace = this._scr ? this._phiDot : this.cmd.phiDotF; // 손가락이 φ 를 모는 빠르기 (짜 놓은 위상이면 그 빠르기)
    const dur = s.swingT * (s.phiDotClip / Math.max(pace, 1e-3));
    const c = this.cmd.step;
    c.fwd = s.fwd * DRIVE.stepScale;
    c.side = s.side;
    c.liftPhi = s.liftPhi;
    c.landPhi = s.landPhi;
    this.stats.stepRequests++;
    this.debug.stepDur = dur;
    const ok = gt.requestStep({ kind: 'strike', fwd: c.fwd, side: c.side, duration: dur, hold: DRIVE.stepHold });
    if (!ok) this.stats.stepRefused++;
    else {
      this.stepping = true;
      this.landed = false;
      this.debug.stepReq = 1;
      this.debug.tStepReq = this.t;
    }
  }

  /** gait.onTouchdown('strike') */
  onLanded(foot) {
    this.landed = true;
    this.stepping = false;
    this.stats.stepLanded++;
    this.debug.landed = 1;
    this.debug.tLand = this.t;
  }

  // ───────── 몸 자세 (updateBodyPose 끝, pelvisYawOffset 앞) ─────────
  mixBody(bp, bv) {
    // W4b: 섞기 전 자세표 가슴 (handMode 'finger' 가 손을 돌리는 기준 틀). 몸 모양엔 안 쓴다
    const r = this._restChest;
    r[0] = bp.chestYaw;
    r[1] = bp.pitch;
    r[2] = bp.side;
    r[3] = this.t;
    if (!DRIVE.trunk) return;
    const c = this._c, cmd = this.cmd;
    for (let i = 0; i < 5; i++) {
      const k = KEYS[i];
      bp[k] = bp[k] + (cmd[k] - bp[k]) * c;
      bv[k] = bv[k] + (cmd[DOTS[i]] - bv[k]) * c;
    }
  }

  /** 닻 yaw 강성 배율 1 − K·S·balanceAssist (감쇠는 그대로) */
  anchorYawRelax() {
    return DRIVE.trunk ? 1 - DRIVE.anchorRelaxYawK * this._w * this.cmd.balanceAssist : 1;
  }
  anchorYawDamp() {
    return DRIVE.trunk ? 1 - DRIVE.anchorRelaxYawD * this._w : 1;
  }
  /** driveBalance 가 이번 스텝 닻 yaw 강성·감쇠를 알려 준다 (debug.tauAnchor) */
  noteAnchor(k, d) {
    this._kY = k;
    this._dY = d;
  }
  twistLim() {
    return DRIVE.trunk ? 0.8 + (DRIVE.spineTwist - 0.8) * this._w : 0.8;
  }
  swingTwist() {
    return DRIVE.feet ? GAIT.swingTwist + (DRIVE.swingTwist - GAIT.swingTwist) * this._w : GAIT.swingTwist;
  }
  maxTwist() {
    return DRIVE.feet ? GAIT.maxTwist + (DRIVE.maxTwist - GAIT.maxTwist) * this._w : GAIT.maxTwist;
  }
  /** 발끝 딛기 마찰 팔 길이: 0.05 → toeLever (S 만큼) */
  toeLever() {
    return DRIVE.feet ? 0.05 + (DRIVE.toeLever - 0.05) * this._w : 0.05;
  }
  /** 딛은 발 뒤꿈치 바닥: 역할의 lift · heelMax · S */
  heelFloor(k) {
    if (!DRIVE.feet) return 0;
    const r = k === this._swingLeg ? this.cmd.foot.swing : this.cmd.foot.stance;
    return r.lift * GAIT.heelMax * this._w;
  }

  // ───────── 발 돌림 (gait.pinFeet, let ye 앞) ─────────
  footPivot(l) {
    if (!DRIVE.feet) return;
    const P = this._piv[l.k];
    const role = l.k === this._swingLeg ? 'swing' : 'stance';
    const cy = this.cmd.foot[role].yaw;
    if (l.yawTD !== P.seen || role !== P.role || P.cut !== this._cutSeen) {
      // 다시 잡기: 새로 디딤·역할 바뀜·새 획·다시 켜짐 → Δ = 0 에서 시작 (뛰는 곳이 없으니 빠르기 한도가 필요 없다)
      P.seen = l.yawTD;
      P.base = l.yaw;
      P.ref = cy;
      P.role = role;
      P.cut = this._cutSeen;
    }
    l.yaw = P.base + (cy - P.ref) * this._w;
  }
  /** 발 돌림 마찰 걸림 (gait 가 알린다): 가장 큰 넘침 (rad) */
  noteSlip(e) {
    this.debug.footSlip = e;
    if (e > this.debug.footSlipMax) this.debug.footSlipMax = e;
    if (e > this.stats.footSlipMax) this.stats.footSlipMax = e;
  }

  // ───────── 회전력 (applyPose 뒤) ─────────
  applyTorques() {
    if (!(this._w > 0)) return;
    const f = this.f, S = this._w, cmd = this.cmd, B = f.bodies, dbg = this.debug;
    // 관절 비틀기 한계 넓히기 L = base + (wide − base)·S, 무른 한계 (S > 0 에서만. 되돌림은 restoreOnce 한 번)
    if (DRIVE.trunk) {
      for (const L of this._lims) {
        L.L = L.hi + (L.wide - L.hi) * S;
        L.j.joint.rawSet.jointSetLimits(L.j.joint.handle, ANG_Y, -L.L, L.L);
      }
      this.touched = true;
      dbg.softLim = 0;
      for (const L of this._lims) this.softLimit(L, S);
    }
    // 앞먹임 회전력 (§5.4)
    dbg.ffChest = dbg.ffAbd = dbg.ffHip = 0;
    const pel = B.pelvis, abd = B.abdomen, ch = B.chest;
    const qc = ch.rotation(), qa = abd.rotation(), qp = pel.rotation();
    const iPel = this.ownVert(this._ib.pelvis, qp);
    const tc = ch.translation(), ta = abd.translation();
    // 가슴 관절·배 관절 자리 (월드)
    const jc = this.rotAdd(qc, this._aChest, tc, this._v3);
    const jcx = jc[0], jcz = jc[2];
    let Ic = 0;
    for (const n of ABOVE_CHEST) Ic += this.vertI(this._ib[n], jcx, jcz);
    const sw = f.armed ? f.sword : null;
    if (sw) {
      if (this._sw.rb !== sw) {
        this._sw.rb = sw;
        this._sw.m = sw.mass();
        localTensor(sw, this._sw.I);
      }
      Ic += this.vertI(this._sw, jcx, jcz);
    }
    const ja = this.rotAdd(qa, this._aAbd, ta, this._v3);
    const jax = ja[0], jaz = ja[2];
    let Ia = this.vertI(this._ib.abdomen, jax, jaz);
    for (const n of ABOVE_CHEST) Ia += this.vertI(this._ib[n], jax, jaz);
    if (sw) Ia += this.vertI(this._sw, jax, jaz);
    dbg.I_aboveChest = Ic;
    dbg.I_aboveAbd = Ia;
    dbg.I_pelvis = iPel;
    if (DRIVE.ff) {
      const J = f.jointByName;
      const kf = DRIVE.ffGain * S;
      const musS = Math.max(0.1, f.muscle);
      const aC = cmd.chestYawDDot, aP = cmd.pelvisYawDDot;
      // 가슴 관절: 가슴 +τ2, 배 −τ2 (가슴 몸 y 축)
      const tau2 = this.cap(kf * Ic * aC, J.chest.max * musS);
      const yc = bodyY(qc, this._u3);
      this.torque(ch, yc, tau2);
      this.torque(abd, yc, -tau2);
      // 배 관절: 배 +τ1, 골반 −τ1 (배 몸 y 축)
      const tau1 = this.cap(kf * Ia * aC, J.abdomen.max * musS);
      const ya = bodyY(qa, this._u3);
      this.torque(abd, ya, tau1);
      this.torque(pel, ya, -tau1);
      dbg.ffChest = tau2;
      dbg.ffAbd = tau1;
      if (DRIVE.ffHip) {
        // 엉덩이: 골반 +τh, 딛은 허벅지 −τh·몫 (둘 다 디디면 반씩, 하나만이면 그 발, 딛은 발 없음 = 두 허벅지 반씩, levitate(걸음 없음) = 닻이 받는다: 골반만)
        const yp = bodyY(qp, this._u3);
        let th = kf * iPel * aP + tau1;
        const gt = f.gait;
        const sF0 = gt?.active ? gt.legs.F.stance : false, sB0 = gt?.active ? gt.legs.B.stance : false;
        // 다리 걸음(hybrid)인데 딛은 발이 없다 (넘어짐·걸음 꺼짐·두 발 공중): 땅 닻이 받지 않는다 → 두 허벅지가 반씩 (엉덩이 관절 안쪽 짝)
        const air = !!gt && !sF0 && !sB0;
        const F = sF0 || air, Bk = sB0 || air;
        const cF = F ? J.thighF.max * this.legMus('F') : 0, cB = Bk ? J.thighB.max * this.legMus('B') : 0;
        if (F || Bk) {
          const sF = F && Bk ? 0.5 : F ? 1 : 0;
          const tF = this.cap(th * sF, cF), tB = this.cap(th * (1 - sF), cB);
          th = tF + tB;
          if (F) this.torque(B.thighF, yp, -tF);
          if (Bk) this.torque(B.thighB, yp, -tB);
        } else th = this.cap(th, (J.thighF.max * this.legMus('F') + J.thighB.max * this.legMus('B')));
        this.torque(pel, yp, th);
        dbg.ffHip = th;
      }
    }
    this.measure(qp, qc, iPel, Ia);
  }

  cap(t, m) {
    if (t > m) {
      this.stats.ffCap++;
      this.debug.ffCap++;
      return m;
    }
    if (t < -m) {
      this.stats.ffCap++;
      this.debug.ffCap++;
      return -m;
    }
    return t;
  }
  legMus(k) {
    const f = this.f;
    const lim = k === 'F' ? f.limbs.legF : f.limbs.legB;
    return Math.max(0.15, f.muscle) * (0.6 + 0.4 * f.legHealth) * (0.4 + 0.6 * lim);
  }
  torque(rb, ax, t) {
    const T = this._T;
    T.x = ax[0] * t;
    T.y = ax[1] * t;
    T.z = ax[2] * t;
    rb.addTorque(T, true);
  }
  rotAdd(q, a, t, o) {
    // o = R(q)·a + t
    const x = a[0], y = a[1], z = a[2];
    const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
    o[0] = x + q.w * tx + (q.y * tz - q.z * ty) + t.x;
    o[1] = y + q.w * ty + (q.z * tx - q.x * tz) + t.y;
    o[2] = z + q.w * tz + (q.x * ty - q.y * tx) + t.z;
    return o;
  }
  /** 제 몸 틀 관성의 월드 수직 성분 */
  ownVert(e, q) {
    const u = invUp(q, this._u3), I = e.I;
    return u[0] * (I[0] * u[0] + I[1] * u[1] + I[2] * u[2]) + u[1] * (I[3] * u[0] + I[4] * u[1] + I[5] * u[2]) + u[2] * (I[6] * u[0] + I[7] * u[1] + I[8] * u[2]);
  }
  /** (jx, jz) 를 지나는 수직축 둘레 관성: m·r⊥² + 제 관성 */
  vertI(e, jx, jz) {
    const c = e.rb.worldCom();
    const dx = c.x - jx, dz = c.z - jz;
    return e.m * (dx * dx + dz * dz) + this.ownVert(e, e.rb.rotation());
  }

  /** 무른 한계 (§5.5): 넓힌 한계 L 의 softLim 안쪽부터 τ = −kSoft·S·(|q| − (L − softLim))₊·sign(q) − dSoft·ω (그 띠 안에서만: 튐 막기, 빠르기 한도 아님) */
  softLimit(L, S) {
    const j = L.j, qp = j.parent.rotation(), qc = j.child.rotation(), ri = j.restInv;
    // q_rel = restInv · (qp⁻¹ · qc)
    const ax = -qp.x, ay = -qp.y, az = -qp.z, aw = qp.w;
    const mx = aw * qc.x + ax * qc.w + ay * qc.z - az * qc.y;
    const my = aw * qc.y - ax * qc.z + ay * qc.w + az * qc.x;
    const mz = aw * qc.z + ax * qc.y - ay * qc.x + az * qc.w;
    const mw = aw * qc.w - ax * qc.x - ay * qc.y - az * qc.z;
    const ry = ri.w * my - ri.x * mz + ri.y * mw + ri.z * mx;
    const rw = ri.w * mw - ri.x * mx - ri.y * my - ri.z * mz;
    // fighter.js toRotVec 과 같은 규칙 (y 성분)
    const w = Math.min(1, Math.abs(rw)), sn = Math.sqrt(1 - w * w);
    const q = sn < 1e-6 ? 0 : (ry * (rw < 0 ? -1 : 1) * 2 * Math.acos(w)) / sn;
    const pen = Math.abs(q) - (L.L - DRIVE.softLim);
    if (!(pen > 0)) return;
    const yp = bodyY(qp, this._u3);
    const wc = j.child.angvel(), wp = j.parent.angvel();
    const om = (wc.x - wp.x) * yp[0] + (wc.y - wp.y) * yp[1] + (wc.z - wp.z) * yp[2];
    const t = -L.kS * S * pen * Math.sign(q) - DRIVE.dSoft * om;
    this.torque(j.child, yp, t);
    this.torque(j.parent, yp, -t);
    if (Math.abs(t) > Math.abs(this.debug.softLim)) this.debug.softLim = t;
  }

  /** 골반·가슴 늦음, 닻 회전력, 몸통 각운동량 (§5.8) */
  measure(qp, qc, iPel, Ia) {
    const f = this.f, d = this.debug, bp = f.bodyPose, bv = f.bodyPoseVel;
    const h = f.heading, dt = f.lastDt || 1 / 120;
    const pelA = wrap(yawOf(qp) - h), chA = wrap(yawOf(qc) - h);
    d.pelvisYawCmd = bp.pelvisYaw;
    d.pelvisYawAct = pelA;
    d.pelvisLag = wrap(pelA - bp.pelvisYaw);
    d.chestYawCmd = bp.chestYaw;
    d.chestYawAct = chA;
    d.chestLag = wrap(chA - bp.chestYaw);
    const wA = wrap(h - this._headPrev) / dt + bv.pelvisYaw;
    this._headPrev = h;
    const wP = f.bodies.pelvis.angvel().y;
    d.tauAnchor = this._kY * wrap(h + f.pelvisYawOffset - yawOf(qp)) + this._dY * (wA - wP);
    d.P_anchor = d.tauAnchor * (wA - wP);
    d.L_trunk = Ia * f.bodies.chest.angvel().y;
  }

  fillDebug(st, mode, g, phiG, cut, side) {
    const d = this.debug;
    d.t = this.t;
    d.state = st;
    d.S = this._S;
    d.c = this._c;
    d.mode = MODE_NUM[mode] ?? 0;
    d.phiF = g && !this._scr ? g.phiF : phiG;
    d.phiB = this._phiB;
    d.phiDot = this._phiDot;
    d.phiDDot = this._phiDDot;
    d.fam = CUT_IDX[cut] ?? -1;
    d.side = side === 'left' ? -1 : 1;
  }

  // ───────── 시험: 손짓 층을 건너뛰고 위상을 직접 (puppet·관문) ─────────
  /** script(phi, S, fam, side[, phiDot]) — fam = 베기 이름('zornhau') 또는 무리('diag'·'diagR'). script(null) 이면 끝 */
  script(phi, S, fam, side = 'right', phiDot) {
    if (phi == null) {
      this._scr = false;
      return;
    }
    const s = this._sc;
    this._scr = true;
    s.phi = phi;
    s.S = S;
    s.cut = CUT_OF[fam] ?? fam;
    s.side = side;
    s.phiDot = phiDot ?? NaN;
  }
}

/** DRIVE.balanceAssist(φ): 조각 선형 (R2 는 늘 1) */
function balanceAssist(phi) {
  const T = DRIVE.balanceAssist, P = T.phi, V = T.v;
  if (!(phi > P[0])) return V[0];
  for (let i = 1; i < P.length; i++) if (phi <= P[i]) return V[i - 1] + ((V[i] - V[i - 1]) * (phi - P[i - 1])) / (P[i] - P[i - 1]);
  return V[V.length - 1];
}

export { CUT_OF };
