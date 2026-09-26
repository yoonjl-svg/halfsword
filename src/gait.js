// ─────────────────────────────────────────────────────────────
//  다리가 체중을 싣는 걸음 (BODY.weightMode = 'hybrid')
//
//  예전 방식('levitate'): 보이지 않는 힘이 골반을 거의 전부(몸무게의 94%) 떠받치고, 다리는 흉내만 냈다.
//  → 걸을 때 발이 땅을 미끄러지고 몸이 제 무게를 느끼지 않는 것처럼 보였다.
//
//  이 방식: 몸무게의 대부분(약 70%)을 다리 관절이 땅까지 전한다. 나머지는 예전 보조 힘이 그대로 받친다
//  (보조가 조금 남아 있어서 예전만큼 잘 넘어지지 않는다). 몸을 앞으로 보내는 힘·똑바로 세우는 힘도 예전 그대로다.
//
//   1) 딛은 발: 발을 디딘 자리(월드 좌표)를 기억하고, 다리 역운동학(IK)으로 엉덩이 → 그 자리까지 다리를 뻗는다.
//      골반이 움직여도 발은 그 자리에 붙어 있다 (미끄러지지 않는다). 발바닥은 정지 마찰처럼 붙잡는다(한계 = 마찰계수 × 실린 무게).
//   2) 골반 높이: 딛은 다리가 닿을 수 있는 높이 (뒤집힌 진자) → 두 발을 딛을 때 낮아지고 한 발 위를 지날 때 높아진다.
//      발을 막 디딘 순간 무릎이 살짝 굽으며 무게를 받는다 (하중 반응).
//   3) 걸음: 시간으로 박자를 맞추고(빠를수록 조금 잦게, 보폭은 길게), 내딛는 발은 "몸이 갈 곳"(속도 기반, Raibert)에 놓는다.
//      한 발로 설 때마다 무게중심이 딛은 발 쪽으로 옮겨 간다 (좌우 흔들림).
//   4) 멈추면 펜싱 자세(칼 든 쪽 발이 앞, 무릎을 살짝 굽힘)로 발을 고쳐 딛는다. 몸을 돌리면 발도 돌려 딛는다.
//   5) 세게 맞아 발이 끌리거나, 넘어지거나, 쓰러진 뒤에는 예전 방식(보조 힘 100%)으로 돌아갔다가,
//      일어서면 보조 힘을 천천히 줄이며 다리로 넘겨준다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BODY, GAIT } from './config.js';

const A_LEN = 0.43; // 허벅지 (엉덩이 → 무릎)
const B_LEN = 0.42; // 정강이 (무릎 → 발목)
/**
 * 'hybrid'일 때 다리 관절을 조금 바꾼다 (몸이 만들어질 때 한 번):
 *  발목을 공 관절로 → 다리가 옆으로 기울어도 발바닥이 땅에 평평하게 닿는다 (경첩이면 발 모서리로 선다)
 */
export function hybridJointDefs(defs) {
  for (const jd of defs) {
    if (jd.c === 'footF' || jd.c === 'footB') {
      jd.type = 'ball';
      jd.lim = { x: [-0.4, 0.4], y: [-0.3, 0.3], z: [-0.6, 0.8] }; // 옆으로 기울기, 비틀기, 앞뒤 굽히기
    }
  }
  return defs;
}

const ANKLE_H = 0.062; // 발바닥이 땅에 평평하게 닿았을 때 발목 높이 (발 0.07 − 체중에 눌려 땅에 파묻히는 몫 약 0.008: 물리 엔진의 부드러운 접촉)
const SOLE_C = new THREE.Vector3(0, -0.035, 0); // 발 몸체 기준 발바닥 가운데
const SOLE_T = new THREE.Vector3(0.1, -0.035, 0); // 발끝 쪽 (뒤꿈치를 들면 여기로 버틴다)
const TOE_X = 0.15; // 발목에서 발끝(뒤꿈치를 들 때 축이 되는 곳)까지 앞으로
const SOLE_Y = 0.07; // 발목에서 발바닥까지 아래로
// 뒤꿈치를 약 0.35라디안 들었을 때 발목이 올라가는 높이·앞으로 가는 거리 (골반 높이를 정할 때 쓴다)
const HEEL_DY = TOE_X * Math.sin(0.35) + SOLE_Y * (Math.cos(0.35) - 1);
const HEEL_DX = TOE_X * (1 - Math.cos(0.35)) + SOLE_Y * Math.sin(0.35);
const HIP_DROP = 0.04; // 골반 중심에서 엉덩이 관절까지 (아래로)
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 무릎을 phi(라디안) 굽혔을 때 엉덩이~발목 거리 */
const legLen = (phi) => Math.sqrt(A_LEN * A_LEN + B_LEN * B_LEN + 2 * A_LEN * B_LEN * Math.cos(phi));
const clamp = THREE.MathUtils.clamp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** 부드러운 출발·도착 (속도·가속도 0) */
const minJerk = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));

function mkLeg(k, side) {
  return {
    k,
    side, // 몸 기준 좌우 (+1 = 오른쪽)
    thigh: 'thigh' + k,
    shin: 'shin' + k,
    foot: 'foot' + k,
    stance: true,
    plant: new THREE.Vector3(), // 딛은 자리 (발목, 월드)
    yaw: 0, // 딛은 발의 방향 (월드)
    tLand: 1, // 디딘 뒤 지난 시간
    hip: new THREE.Vector3(), // 엉덩이 관절 (월드, 실제)
    ankle: new THREE.Vector3(), // 발목 (월드, 실제)
    footYaw: 0,
    soleY: 0,
    // 내딛는 중
    t: 0,
    T: 0.4,
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    yaw0: 0,
    yaw1: 0,
    lift: 0.07,
    kind: 'walk',
    phi: 0, // 지금 목표 무릎 굽힘
    heel: 0, // 뒤꿈치를 든 각도
    hFrac: 1,
    y0: 0, // 걸음을 바꿀 때 이미 들려 있던 높이
    rel: new THREE.Vector3(), // 엉덩이에 대한 내딛는 발목 목표
    relOk: false,
    des: new THREE.Vector3(), // 내딛는 발목 목표 (측정용)
    v0: new THREE.Vector3(), // 발을 뗄 때 발의 출발 속도
    fq: new THREE.Quaternion(), // 발 자세 (월드)
    fp: new THREE.Vector3(), // 발 위치 (월드)
    pinC: new THREE.Vector3(), // 딛을 때 발바닥 가운데가 닿은 곳 (월드)
    pinT: new THREE.Vector3(), // 발끝이 닿은 곳
  };
}

export class Gait {
  constructor(fighter) {
    this.f = fighter;
    const s = fighter.side;
    this.legs = { F: mkLeg('F', s), B: mkLeg('B', -s) };
    this.active = false;
    this.lev = 0; // 넘겨받는 중 더하는 보조 힘 비율 (1 = 예전 방식 그대로, 0 = 다리가 GAIT.assist 몫 빼고 전부)
    this.h = BODY.standHeight; // 골반 높이 목표
    this.hNom = BODY.standHeight;
    this.hv = 0;
    this.sinceTD = 1; // 마지막으로 발을 디딘 뒤 지난 시간
    this.lastTD = 'B'; // 마지막으로 디딘 발
    this.walking = false;
    this.walkT = 0; // 걷기 시작한 뒤 / 멈춘 뒤 지난 시간
    this.idleT = 0;
    this.stepT = 0.5; // 지금 걸음 박자 (한 걸음 시간)
    this.vf = new THREE.Vector3(); // 골반 수평 속도 (걸러진 값)
    this.sway = new THREE.Vector3(); // 좌우로 무게를 옮기는 속도 (want에 더한다)
    this.req = null; // 기술이 부탁한 걸음 (requestStep)
    this.settles = 0; // 멈춘 뒤 고쳐 딛은 횟수
    this.prevHead = fighter.heading;
    this.headRate = 0; // 몸을 돌리는 빠르기(rad/s)
    this.sinceEnter = 0;
  }

  /** 지금 이 걸음 방식이 몸을 맡고 있나 */
  get on() {
    return this.active;
  }

  /** 서기 시작(라운드 시작, 일어선 직후): 두 발을 지금 자리에 딛고, 보조 힘을 천천히 줄인다 */
  enter() {
    this.active = true;
    this.sense();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.stance = true;
      this.plantAt(L);
      L.tLand = 1;
    }
    this.lev = 1;
    this.sinceEnter = 0;
    const p = this.f.bodies.pelvis.translation();
    this.h = p.y;
    this.hv = 0;
    this.sinceTD = 0;
    this.walking = false;
    this.idleT = 0;
    this.req = null;
    this.settles = 0;
    this.prevHead = this.f.heading;
    this.headRate = 0;
    this.resetRates();
  }

  exit() {
    this.active = false;
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      J[l.thigh].gain = J[l.shin].gain = J[l.foot].gain = 1;
    }
    this.req = null;
  }

  // ── 몸 상태 읽기 ──
  sense() {
    const f = this.f;
    const pel = f.bodies.pelvis;
    const r = pel.rotation();
    const qP = _qP.set(r.x, r.y, r.z, r.w);
    const pt = pel.translation();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.hip.set(0, -HIP_DROP, L.side * 0.095).applyQuaternion(qP).add(_s1.set(pt.x, pt.y, pt.z));
      const fb = f.bodies[L.foot];
      const fr = fb.rotation();
      _qF.set(fr.x, fr.y, fr.z, fr.w);
      const ft = fb.translation();
      _s1.set(ft.x, ft.y, ft.z);
      L.fq.copy(_qF);
      L.fp.copy(_s1);
      L.ankle.set(-0.05, 0.035, 0).applyQuaternion(_qF).add(_s1);
      L.soleY = _s2.set(0, -0.035, 0).applyQuaternion(_qF).add(_s1).y;
      const fx = _s2.set(1, 0, 0).applyQuaternion(_qF);
      L.footYaw = Math.atan2(-fx.z, fx.x);
    }
    const v = pel.linvel();
    this.vf.x += (v.x - this.vf.x) * 0.25;
    this.vf.z += (v.z - this.vf.z) * 0.25;
  }

  /**
   * 기술이 걸음을 부탁한다 (AI의 베며 내딛기). kind: 'pass'(뒷발이 앞으로 나간다) | 'lunge'(앞발을 내딛는다)
   * fwd: 몸 기준 앞으로(m), side: 오른쪽으로(m), duration: 발이 떠 있는 시간(초)
   */
  requestStep(o = {}) {
    if (!GAIT.requestSteps || !this.active || this.f.state !== 'stand') return false;
    // 물러나는 중이면 받지 않는다 (몸은 뒤로, 발은 앞으로 가면 넘어진다)
    if (this.f.move.y < -0.1) return false;
    this.req = { kind: o.kind || 'pass', fwd: o.fwd ?? 0.5, side: o.side ?? 0, duration: clamp(o.duration ?? 0.4, 0.28, 0.7), age: 0 };
    return true;
  }

  /** 몸을 turn(라디안)만큼 돌리려 할 때, 딛은 발에 대해 엉덩이가 비틀 수 있는 만큼으로 줄인다 */
  limitTurn(turn) {
    if (!turn) return turn;
    const f = this.f;
    const pel = f.heading + (f.pelvisYawOffset || 0);
    let lim = Infinity;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (!l.stance) continue;
      const tw = wrap(pel - l.yaw) * Math.sign(turn); // 도는 쪽으로 이미 비튼 만큼
      lim = Math.min(lim, Math.max(0, GAIT.maxTwist - tw));
    }
    return Math.sign(turn) * Math.min(Math.abs(turn), lim);
  }

  /** 앞발(몸 기준 앞에 있는 발) */
  frontLeg(fwd) {
    const a = this.legs.F.plant;
    const b = this.legs.B.plant;
    return (a.x - b.x) * fwd.x + (a.z - b.z) * fwd.z >= 0 ? 'F' : 'B';
  }

  /**
   * 매 스텝(서 있는 동안) driveBalance가 부른다. want(가려는 속도, 월드)에 좌우 무게 옮기기·자리 지키기를 더하고,
   * 골반 높이 목표(this.h)를 정한다.
   */
  update(dt, want, fwd, rgt) {
    const f = this.f;
    if (!this.active) this.enter();
    else this.sense();
    // 넘겨받기: 일어선 직후엔 발을 펜싱 자세로 고쳐 딛을 때까지 보조 힘을 유지한다
    //  (무릎 꿇었던 자리 그대로 한 발로 서면 골반이 주저앉는다)
    this.sinceEnter += dt;
    const settled = !this.walking && this.legs.F.stance && this.legs.B.stance && this.sinceTD > 0.15 && !this.settleLeg(true);
    const walkedIn = this.walking && this.walkT > 0.8;
    if (this.sinceEnter > GAIT.handoverMax || settled || walkedIn) this.lev = Math.max(0, this.lev - dt / GAIT.handover);
    // 붙잡기 반사: 골반이 크게 주저앉거나 몸이 많이 기울면(세게 맞음) 보조 힘을 되살린다 → 예전 방식처럼 버틴다.
    //  보조가 커지면 딛은 발의 정지 마찰(pinFeet)도 약해져서 발이 끌려가며 버틴다
    {
      const sag = Math.max(this.h, this.hNom - 0.04) - f.bodies.pelvis.translation().y;
      const need = Math.max(
        clamp((sag - GAIT.catchSag) / 0.08, 0, 1),
        clamp((f.tiltDeg() - GAIT.catchTilt) / 20, 0, 1),
        clamp((f.offBalance - 0.15) / 0.25, 0, 1),
      );
      if (need > this.lev) this.lev += (need - this.lev) * Math.min(1, dt * 30);
    }
    const dHead = wrap(f.heading - this.prevHead);
    this.prevHead = f.heading;
    this.headRate += (dHead / dt - this.headRate) * Math.min(1, dt * 10);
    // 일어선 직후(보조 힘을 넘겨받는 중)엔 천천히 걷는다
    if (this.lev > 0) want.multiplyScalar(1 - GAIT.handoverSlow * this.lev);
    const speed = Math.hypot(want.x, want.z);
    const walkNow = speed > GAIT.walkMin;
    if (walkNow !== this.walking) {
      this.walking = walkNow;
      this.walkT = 0;
    }
    this.walkT += dt;
    this.idleT = walkNow ? 0 : this.idleT + dt;
    if (walkNow) this.settles = 0;
    // 걸음 박자: 느리면 한 걸음 약 0.55초, 빠를수록 잦아지고 보폭이 길어진다
    const vLat = Math.abs(want.x * rgt.x + want.z * rgt.z);
    const cad = Math.max(GAIT.cadence0 + GAIT.cadenceK * Math.max(0, speed - 1), speed / GAIT.maxStride, (2 * vLat) / GAIT.sideStride, GAIT.cadence0 * 0.9);
    const T = walkNow ? 1 / cad : GAIT.settleT / (1 - GAIT.dsFrac);
    this.stepT += (T - this.stepT) * Math.min(1, dt * 6);
    const Tds = this.stepT * GAIT.dsFrac;
    const Tsw = this.stepT - Tds;

    const L = this.legs;
    let swing = L.F.stance ? (L.B.stance ? null : L.B) : L.F;
    this.sinceTD += dt;
    for (const k of ['F', 'B']) L[k].tLand += dt;

    // ① 딛은 발이 크게 끌려갔으면(세게 맞음) 그 자리에서 다시 딛는다 (정지 마찰을 넘어 미끄러진 것)
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      const dx = l.ankle.x - l.plant.x;
      const dz = l.ankle.z - l.plant.z;
      if (dx * dx + dz * dz > GAIT.slipReset * GAIT.slipReset || l.soleY > 0.12) {
        this.plantAt(l);
      }
    }

    // ② 내딛는 발
    // 자세를 고쳐 딛던 중에 다시 걷기 시작하면: 지금 발 위치에서 걷는 걸음으로 바꾼다
    if (swing && walkNow && swing.kind === 'settle') {
      swing.p0.copy(swing.des);
      swing.y0 = Math.max(0, swing.des.y - ANKLE_H);
      swing.p0.y = ANKLE_H;
      swing.v0.set(0, 0, 0);
      swing.t = 0;
      swing.T = Math.max(0.22, Tsw * 0.8);
      swing.kind = 'walk';
      swing.hFrac = 1;
    }
    if (swing) {
      swing.t += dt;
      const u = swing.t / swing.T;
      if (u < GAIT.retarget) this.target(swing, want, fwd, rgt, Math.max(0, swing.T - swing.t));
      if ((u >= 1 && swing.soleY < 0.02) || u >= 1 + GAIT.lateMax / swing.T || (u > 0.8 && swing.soleY < 0.004)) {
        this.touchdown(swing, speed);
        swing = null;
      }
    }

    // ③ 새 걸음 시작
    if (!swing && this.sinceTD >= Tds && f.muscle > 0.15) {
      let next = null;
      let kind = 'walk';
      let Tstep = Tsw;
      // 다리가 닿지 않을 만큼 벌어진 발은 먼저 옮긴다
      for (const k of ['F', 'B']) {
        const l = L[k];
        const hx = l.hip.x - l.plant.x;
        const hz = l.hip.z - l.plant.z;
        if (hx * hx + hz * hz > GAIT.reachMax * GAIT.reachMax) next = next || k;
      }
      if (this.req && !next) {
        const front = this.frontLeg(fwd);
        next = this.req.kind === 'lunge' ? front : front === 'F' ? 'B' : 'F';
        kind = 'req';
        Tstep = this.req.duration;
      } else if (walkNow && !next) {
        // 걷기 시작: 가려는 쪽에서 뒤에 있는 발부터 (앞발부터 내딛으면 몸이 달아난다). 걷는 중: 번갈아
        if (this.walkT > this.stepT * 1.2 || this.sinceTD < this.stepT) next = this.lastTD === 'F' ? 'B' : 'F';
        else {
          const df = (L.F.plant.x - L.B.plant.x) * want.x + (L.F.plant.z - L.B.plant.z) * want.z;
          next = df > 0 ? 'B' : 'F';
        }
      } else if (next) kind = 'catch';
      else if (this.idleT > GAIT.settleDelay) {
        // 자리 고치기는 settleMax번까지, 몸을 돌려 발이 틀어진 것은 언제든 (발을 돌려 딛는다)
        next = this.settleLeg(this.settles < GAIT.settleMax);
        if (next) {
          kind = 'settle';
          this.settles++;
        }
      }
      if (next) {
        const l = L[next];
        this.begin(l, kind, Tstep);
        this.target(l, want, fwd, rgt, Tstep);
        // 자세 고치기: 멀리 옮길수록 천천히 (휙 옮기면 딛을 때 미끄러진다)
        if (kind === 'settle') l.T = clamp(GAIT.settleT + 0.5 * l.p0.distanceTo(l.p1), GAIT.settleT, 0.6);
        swing = l;
      }
    }
    if (this.req) {
      this.req.age += dt;
      if (this.req.age > 1) this.req = null;
    }

    // 기술 걸음 동안엔 몸도 그만큼 따라 나간다
    if (swing && swing.kind === 'req' && this.req) want.addScaledVector(fwd, (this.req.fwd * 0.8) / (swing.T + 0.15));
    // ④ 좌우 무게 옮기기: 한 발로 서는 동안 무게중심을 딛은 발 쪽으로 (want에 속도로 더한다)
    this.sway.set(0, 0, 0);
    if (swing && swing.kind !== 'catch') {
      const u = clamp(swing.t / swing.T, 0, 1);
      const st = swing === L.F ? L.B : L.F;
      const amp = GAIT.sway * (walkNow ? 1 : 0.5) * (1 - this.lev);
      const vs = ((amp * Math.PI) / swing.T) * Math.cos(Math.PI * u) * st.side;
      this.sway.set(rgt.x * vs, 0, rgt.z * vs);
      want.add(this.sway);
    }
    // ⑤ 가만히 서 있을 땐 무게중심을 두 발 사이(앞발 쪽으로 조금)에 둔다 → 서서 미끄러지지 않는다
    if (!walkNow && !swing) {
      const c = f.com;
      if (c) {
        const w = GAIT.weightFront;
        const front = this.frontLeg(fwd);
        const a = L[front].plant;
        const b = L[front === 'F' ? 'B' : 'F'].plant;
        const tx = b.x + (a.x - b.x) * w;
        const tz = b.z + (a.z - b.z) * w;
        const g = GAIT.holdGain * (1 - this.lev);
        _s1.set((tx - c.x) * g, 0, (tz - c.z) * g);
        if (_s1.length() > 0.3) _s1.setLength(0.3);
        want.add(_s1);
      }
    }

    // ⑥ 골반 높이: 딛은 다리가 닿는 높이 (무릎을 조금 굽힌 채)
    const drop = f.pelvisDropOffset || 0;
    const hurt = (1 - f.legHealth) * 0.1;
    // 빨리 걸을수록 무릎을 조금 더 굽힌 채 걷는다 (보폭이 길어도 골반이 크게 출렁이지 않게)
    const walkH = GAIT.walkHeight - GAIT.walkHeightFast * clamp((speed - 0.8) / 0.8, 0, 1);
    let hNom = (walkNow ? walkH : GAIT.guardHeight) - hurt - Math.max(0, drop);
    let hGeo = Infinity;
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      const bump = l.tLand < GAIT.loadTime ? Math.sin((Math.PI * l.tLand) / GAIT.loadTime) : 0;
      l.phi = GAIT.kneeBase + GAIT.loadKnee * bump * (this.walking || l.kind !== 'settle' ? 1 : 0.5);
      const Ls = legLen(l.phi);
      const hx = l.hip.x - l.plant.x;
      const hz = l.hip.z - l.plant.z;
      let hy = ANKLE_H + Math.sqrt(Math.max(0.04, Ls * Ls - hx * hx - hz * hz)) + HIP_DROP;
      // 뒤로 빠진 발은 뒤꿈치를 들어(발끝으로 서서) 더 높이 받칠 수 있다
      const back = hx * fwd.x + hz * fwd.z; // + = 발이 엉덩이 뒤에
      if (back > 0) {
        const r = Math.hypot(hx, hz);
        const r2 = Math.max(0, r - HEEL_DX);
        hy = Math.max(hy, ANKLE_H + HEEL_DY + Math.sqrt(Math.max(0.04, Ls * Ls - r2 * r2)) + HIP_DROP);
      }
      // 두 발로 딛을 땐 더 높이 받칠 수 있는 다리 기준 (뒷발은 뒤꿈치를 들어 따라온다)
      hGeo = hGeo === Infinity ? hy : Math.max(hGeo, hy);
    }
    this.hNom = hNom;
    // 보조 힘이 많이 받칠 땐(넘겨받는 중·붙잡기 반사) 다리가 닿지 않아도 골반을 제 높이에 둔다
    const hT = THREE.MathUtils.lerp(clamp(Math.min(hNom, hGeo), hNom - GAIT.maxDip, hNom), hNom, this.lev);
    // 딱 멈추는 2차 필터 (내려갈 땐 빨리: 다리가 닿지 않는 높이로 끌어올리지 않게)
    const w = hT < this.h ? GAIT.hDown : GAIT.hUp;
    this.hv += (w * w * (hT - this.h) - 2 * w * this.hv) * dt;
    this.h += this.hv * dt;
    if (this.h > hGeo + 0.01 + this.lev) this.h = Math.max(hGeo + 0.01 + this.lev, hNom - GAIT.maxDip);
  }

  /** 멈춘 뒤 펜싱 자세에서 가장 벗어난 발 (고쳐 딛을 발). 괜찮으면 null */
  settleLeg(posOk) {
    const c = this.f.com;
    if (!c) return null;
    let worst = null;
    let worstE = 0;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      this.guardSpot(l, _s3);
      const e = Math.hypot(l.plant.x - _s3.x, l.plant.z - _s3.z);
      const ye = Math.abs(wrap(l.yaw - this.guardYaw(l)));
      const tol = this.settles === 0 ? GAIT.settleTol : GAIT.settleTol * 1.6;
      const score = Math.max(posOk ? e / tol : 0, ye / GAIT.yawTol);
      if (score > 1 && score > worstE) {
        worstE = score;
        worst = k;
      }
    }
    return worst;
  }

  /** 펜싱 자세에서 이 발이 설 자리 (무게중심 기준) */
  guardSpot(l, out) {
    const c = this.f.com;
    // 몸을 돌리는 중이면 돌아갈 방향을 미리 본다
    const h = this.headAhead();
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const x = l.k === 'F' ? GAIT.guardLength * (1 - GAIT.weightFront) : -GAIT.guardLength * GAIT.weightFront;
    const z = l.side * GAIT.guardWidth * 0.5;
    // 오른쪽 = (-fz, 0, fx)
    return out.set(c.x + fx * x - fz * z, ANKLE_H, c.z + fz * x + fx * z);
  }

  /** 몸이 곧 바라볼 방향 (지금 도는 빠르기로 조금 앞질러) */
  headAhead() {
    return this.f.heading + clamp(this.headRate * GAIT.turnLead, -0.5, 0.5);
  }

  guardYaw(l) {
    return this.headAhead() + (l.k === 'B' ? -l.side * GAIT.rearToe : 0);
  }

  begin(l, kind, T) {
    l.stance = false;
    l.heel = 0;
    l.y0 = 0;
    l.relOk = false;
    l.kind = kind;
    l.t = 0;
    l.T = T;
    l.p0.set(l.ankle.x, ANKLE_H, l.ankle.z);
    l.p1.copy(l.p0);
    l.v0.set(this.vf.x * GAIT.liftCarry, 0, this.vf.z * GAIT.liftCarry);
    l.yaw0 = l.footYaw;
    l.lift = kind === 'settle' ? GAIT.liftSettle : GAIT.lift;
    // 걷는 중엔 발을 든 시간 내내 옮긴다 (일찍 도착하면 몸이 따라올 때까지 발이 몸 앞 멀리 떠 있어야 한다)
    l.hFrac = kind === 'settle' ? GAIT.hFrac : 1;
    if (kind === 'req') this.reqLeg = l.k;
  }

  /** 내딛을 자리 정하기 (remain: 발이 땅에 닿기까지 남은 시간) */
  target(l, want, fwd, rgt, remain) {
    const f = this.f;
    const other = l === this.legs.F ? this.legs.B : this.legs.F;
    const p = f.bodies.pelvis.translation();
    const out = l.p1;
    if (l.kind === 'settle') {
      this.guardSpot(l, out);
      l.yaw1 = this.guardYaw(l);
    } else if (l.kind === 'req' && this.req) {
      // 기술 걸음. lunge: 앞발을 fwd만큼 내딛는다. pass: 뒷발이 앞발을 지나 그 앞에 딛는다 (앞뒤 발이 바뀐다)
      const r = this.req;
      const base = r.kind === 'lunge' ? l.p0 : other.plant;
      const x = r.kind === 'lunge' ? r.fwd : Math.max(0.3, r.fwd - 0.1);
      const z = r.side + (r.kind === 'pass' ? l.side * GAIT.guardWidth : 0);
      out.set(base.x + fwd.x * x + rgt.x * z, ANKLE_H, base.z + fwd.z * x + rgt.z * z);
      l.yaw1 = this.headAhead();
    } else {
      // 몸이 닿을 때 있을 곳 + 속도 × (딛는 시간의 절반) (Raibert). 속도가 원하는 것보다 빠르면 더 멀리 딛어 받는다
      const v = this.vf;
      const Tst = this.stepT * (1 + GAIT.dsFrac);
      const px = p.x + v.x * remain;
      const pz = p.z + v.z * remain;
      const ox = want.x * Tst * 0.5 + GAIT.kv * (v.x - want.x);
      const oz = want.z * Tst * 0.5 + GAIT.kv * (v.z - want.z);
      const wd = GAIT.width;
      out.set(px + ox + rgt.x * l.side * wd, ANKLE_H, pz + oz + rgt.z * l.side * wd);
      l.yaw1 = this.headAhead();
      // 너무 멀리 뻗지 않게
      const dx = out.x - px;
      const dz = out.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > GAIT.maxReach) {
        out.x = px + (dx / d) * GAIT.maxReach;
        out.z = pz + (dz / d) * GAIT.maxReach;
      }
    }
    // 다리가 꼬이지 않게: 딛은 발에서 자기 쪽으로 최소 간격
    const lat = (out.x - other.plant.x) * rgt.x + (out.z - other.plant.z) * rgt.z;
    const need = GAIT.minWidth - lat * l.side;
    if (need > 0) out.addScaledVector(rgt, need * l.side);
  }

  touchdown(l, speed) {
    l.stance = true;
    this.plantAt(l);
    l.tLand = 0;
    this.sinceTD = 0;
    this.lastTD = l.k;
    if (l.kind === 'req') this.req = null;
    this.f.footstep = Math.max(this.f.footstep, clamp(speed / BODY.moveSpeed, 0.15, 1));
  }

  /** 지금 발 자리를 딛은 자리로 기억한다 (발바닥 가운데·발끝이 땅에 붙은 곳도) */
  plantAt(l) {
    l.plant.set(l.ankle.x, ANKLE_H, l.ankle.z);
    l.yaw = l.footYaw;
    l.pinC.copy(SOLE_C).applyQuaternion(l.fq).add(l.fp);
    l.pinT.copy(SOLE_T).applyQuaternion(l.fq).add(l.fp);
  }

  /** 다리 관절 목표 (applyPose가 부른다) */
  poseLegs() {
    const f = this.f;
    const J = f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      const g = l.stance ? 1 + (GAIT.stanceGain - 1) * (1 - this.lev) : GAIT.swingGain;
      J[l.thigh].gain = g;
      J[l.shin].gain = g;
      J[l.foot].gain = g;
    }
    const p = f.bodies.pelvis.translation();
    // 딛은 다리는 골반을 목표 높이로 밀어 올린다. 골반이 목표보다 높을 때 다리를 오므리면 (몸을 끌어내리지 못하고)
    // 발만 들리므로 조금만 오므린다
    const dh = clamp(this.h - p.y, -0.02, 0.05);
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (l.stance) {
        // 딛은 발: 골반이 목표 높이에 있다고 보고 그 자리까지 다리를 뻗는다 → 관절이 체중을 받쳐 골반을 그 높이로 민다
        _h.copy(l.hip);
        _h.y += dh;
        _a.copy(l.plant);
        // 다리가 닿지 않으면 발끝을 축으로 뒤꿈치를 든다 (뒤로 빠진 발이 땅을 끌지 않게)
        const heel = this.heelOff(l, _h, _a, legLen(l.phi));
        l.heel += (heel - l.heel) * 0.3;
        if (l.heel > 0.01) this.toePivot(l, _a, l.heel);
        this.legIK(l, _h, _a, l.yaw, -l.heel);
      } else {
        const u = clamp(l.t / l.T, 0, 1);
        // 앞뒤·옆으로는 발을 든 시간의 앞쪽 hFrac 동안 옮기고, 나머지 동안 거의 제자리에서 내려 딛는다
        //  (움직이는 채로 땅에 닿으면 미끄러진다)
        const uh = Math.min(1, u / l.hFrac);
        const s = minJerk(uh);
        // 5차 곡선: 발을 떼는 순간엔 몸과 함께 앞으로 나가기 시작하고(뒤에 끌리지 않게), 딛는 순간엔 땅에 대해 멈춘다
        const h1 = uh - 6 * uh * uh * uh + 8 * uh * uh * uh * uh - 3 * uh * uh * uh * uh * uh;
        _a.lerpVectors(l.p0, l.p1, s).addScaledVector(l.v0, h1 * l.T * l.hFrac);
        const late = l.t > l.T ? Math.min(0.02, (l.t - l.T) * 0.3) : 0;
        // 발은 일찍 들고(발끝이 걸리지 않게) 늦게 내린다. 들린 동안 발끝을 살짝 든다
        const up = THREE.MathUtils.smoothstep(u, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(u, Math.min(0.75, l.hFrac - 0.15), 1));
        _a.y = ANKLE_H + Math.max(l.lift * up, l.y0 * (1 - THREE.MathUtils.smoothstep(u, 0, 0.5))) - late;
        const yaw = l.yaw0 + wrap(l.yaw1 - l.yaw0) * s;
        // 엉덩이에 대한 발의 속도를 제한한다 (다리를 채찍처럼 휘두르면 그 반동이 몸을 떠민다)
        _d.subVectors(_a, l.hip);
        if (l.relOk) {
          const mv = GAIT.swingVmax * f.lastDt;
          _c.subVectors(_d, l.rel);
          if (_c.lengthSq() > mv * mv) {
            _c.setLength(mv);
            _d.copy(l.rel).add(_c);
            _a.addVectors(l.hip, _d);
          }
        }
        l.rel.copy(_d);
        l.relOk = true;
        l.des.copy(_a);
        this.legIK(l, l.hip, _a, yaw, GAIT.toeUp * Math.sin(Math.PI * u));
      }
    }
  }

  /** 딛은 발 발목이 엉덩이에서 Ls보다 멀면, 발끝을 축으로 뒤꿈치를 몇 라디안 들어야 닿는지 */
  heelOff(l, hip, ankle, Ls) {
    const dx = ankle.x - hip.x;
    const dy = ankle.y - hip.y;
    const dz = ankle.z - hip.z;
    if (dx * dx + dy * dy + dz * dz <= Ls * Ls) return 0;
    let lo = 0;
    let hi = GAIT.heelMax;
    for (let i = 0; i < 6; i++) {
      const m = (lo + hi) * 0.5;
      this.toePivot(l, _hp.copy(ankle), m);
      if (_hp.distanceToSquared(hip) > Ls * Ls) lo = m;
      else hi = m;
    }
    return hi;
  }

  /** 발끝(발바닥 앞쪽 모서리)을 축으로 뒤꿈치를 th만큼 들었을 때의 발목 위치 (ankle을 고친다) */
  toePivot(l, ankle, th) {
    const fx = Math.cos(l.yaw);
    const fz = -Math.sin(l.yaw);
    // 평평할 때 발끝 → 발목: 뒤로 TOE_X, 위로 SOLE_Y
    const c = Math.cos(th);
    const s = Math.sin(th);
    const back = TOE_X * c - SOLE_Y * s; // 발끝에서 뒤쪽으로
    const up = TOE_X * s + SOLE_Y * c;
    const tx = ankle.x + fx * TOE_X;
    const tz = ankle.z + fz * TOE_X;
    const ty = ankle.y - SOLE_Y;
    return ankle.set(tx - fx * back, ty + up, tz - fz * back);
  }

  /**
   * 다리 역운동학: 엉덩이(hip) → 발목(ankle)까지 다리를 뻗고, 발은 yaw 방향을 보며 땅과 나란하게.
   * 무릎·발목은 경첩이라 다리가 옆으로 기울면 발도 조금 기운다.
   */
  legIK(l, hip, ankle, yaw, pitch) {
    const f = this.f;
    const J = f.jointByName;
    const d = _d.subVectors(ankle, hip);
    let len = d.length();
    if (len < 1e-4) return;
    d.multiplyScalar(1 / len);
    len = clamp(len, 0.42, legLen(GAIT.kneeMin));
    const fwd = _fw.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // 무릎 축: 발이 보는 방향의 오른쪽 축을, 다리 방향에 수직이 되게 고친다
    const kx = _kx.set(-fwd.z, 0, fwd.x);
    kx.addScaledVector(d, -kx.dot(d));
    if (kx.lengthSq() < 1e-6) kx.set(0, 0, 1).applyQuaternion(f.yaw);
    kx.normalize();
    const m = _m.crossVectors(kx, d); // 다리 평면에서 앞쪽
    const cosK = clamp((A_LEN * A_LEN + B_LEN * B_LEN - len * len) / (2 * A_LEN * B_LEN), -1, 1);
    const phi = Math.PI - Math.acos(cosK); // 무릎 굽힘
    const cosA = clamp((A_LEN * A_LEN + len * len - B_LEN * B_LEN) / (2 * A_LEN * len), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const ut = _ut.copy(d).multiplyScalar(cosA).addScaledVector(m, sinA); // 허벅지 방향 (엉덩이 → 무릎)
    // 허벅지 자세 (월드): y = 뼈 반대 방향, z = 무릎 축
    _y.copy(ut).negate();
    _x.crossVectors(_y, kx);
    _M.makeBasis(_x, _y, kx);
    _qT.setFromRotationMatrix(_M);
    const pr = f.bodies.pelvis.rotation();
    _qP.set(pr.x, pr.y, pr.z, pr.w).invert();
    J[l.thigh].target.copy(_qP).multiply(_qT);
    J[l.shin].target.setFromAxisAngle(Z_AXIS, -phi);
    // 발목(공 관절): 발바닥이 땅과 나란히 yaw 방향을 보게 (pitch만큼 발끝을 들거나 뒤꿈치를 든다)
    //  발목 목표 = (정강이 목표 자세)⁻¹ × (발 월드 자세)
    _qS.copy(_qT).multiply(_qK.setFromAxisAngle(Z_AXIS, -phi)).invert();
    _qW.setFromAxisAngle(UP, yaw);
    if (pitch) _qW.multiply(_qK.setFromAxisAngle(Z_AXIS, pitch));
    J[l.foot].target.copy(_qS).multiply(_qW);
  }

  /** 발바닥 정지 마찰: 딛은 발을 디딘 자리에 붙잡는다 (한계 = 마찰계수 × 실린 무게, 넘으면 미끄러진다) */
  pinFeet() {
    const f = this.f;
    if (!GAIT.pinK) return;
    const W = f.totalMass * 9.81 * (1 - GAIT.assist) * (1 - this.lev) * f.muscle;
    const nSt = (this.legs.F.stance ? 1 : 0) + (this.legs.B.stance ? 1 : 0);
    if (!nSt || W <= 0) return;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (!l.stance || l.soleY > 0.03) continue;
      const fb = f.bodies[l.foot];
      // 붙잡는 곳: 발바닥 가운데 (뒤꿈치를 들었으면 발끝)
      const toe = l.heel > 0.05;
      const pin = toe ? l.pinT : l.pinC;
      const pt = _s1.copy(toe ? SOLE_T : SOLE_C).applyQuaternion(l.fq).add(l.fp);
      const v = fb.linvel();
      const w = fb.angvel();
      const c = fb.worldCom();
      const rx = pt.x - c.x;
      const ry = pt.y - c.y;
      const rz = pt.z - c.z;
      // 그 점의 속도 = v + ω × r
      const vx = v.x + w.y * rz - w.z * ry;
      const vz = v.z + w.x * ry - w.y * rx;
      let fx = GAIT.pinK * (pin.x - pt.x) - GAIT.pinD * vx;
      let fz = GAIT.pinK * (pin.z - pt.z) - GAIT.pinD * vz;
      const N = W / nSt;
      const lim = GAIT.pinMu * N;
      const fl = Math.hypot(fx, fz);
      if (fl > lim) {
        fx *= lim / fl;
        fz *= lim / fl;
      }
      _f.x = fx;
      _f.y = 0;
      _f.z = fz;
      _p.x = pt.x;
      _p.y = pt.y;
      _p.z = pt.z;
      fb.addForceAtPoint(_f, _p, true);
      // 발이 땅 위에서 도는 것도 마찰이 붙잡는다 (한계 = 마찰 × 무게 × 발바닥 크기)
      const lt = GAIT.pinMu * N * 0.05;
      _f.x = 0;
      _f.y = clamp(GAIT.pinYawK * wrap(l.yaw - l.footYaw) - GAIT.pinYawD * w.y, -lt, lt);
      _f.z = 0;
      fb.addTorque(_f, true);
    }
  }


  /** 관절 목표 속도 기록(driveJoints의 prevRV)을 지운다 → 목표가 한 번에 바뀌어도 모터가 튀지 않는다 */
  resetRates() {
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      for (const n of [l.thigh, l.shin, l.foot]) J[n].prevRV = null;
    }
  }
}

const _qP = new THREE.Quaternion();
const _qF = new THREE.Quaternion();
const _qT = new THREE.Quaternion();
const _M = new THREE.Matrix4();
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _s3 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _kx = new THREE.Vector3();
const _m = new THREE.Vector3();
const _ut = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _ks = new THREE.Vector3();
const _fx = new THREE.Vector3();
const _c = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _qS = new THREE.Quaternion();
const _qK = new THREE.Quaternion();
const _qW = new THREE.Quaternion();
const _f = { x: 0, y: 0, z: 0 };
const _p = { x: 0, y: 0, z: 0 };
