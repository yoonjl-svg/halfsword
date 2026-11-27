// ─────────────────────────────────────────────────────────────
//  다리로만 서기 · 걷기 · 돌기 — 가상 모형 제어 (자코비안 전치) · 물리 2.0 시제품 (2026-11-24)
//
//  예전: 골반을 위로 미는 힘(받침) · 골반과 가슴을 수평으로 미는 힘(걷기 밀기) · 보이지 않는 운동학 몸체에 묶은 회전 모터(닻)가 몸을 세우고 옮기고 돌렸다.
//   셋 다 땅에 반작용이 없는 몸 밖 힘이었다 (docs/strike/physics2_h1_first_2026-11-24.md).
//  지금: 같은 뜻(자세 높이 · 가려는 빠르기 · 곧게 서기 · 바라볼 쪽)을 '몸이 땅에서 받고 싶은 힘과 토크'로 바꾼 뒤, 땅을 딛은 발에 나눠
//   그 발 다리의 관절 토크(엉덩이 세 축 · 무릎 · 발목)로만 낸다. 토크는 모두 이웃한 두 토막에 같은 크기 · 반대 방향으로 건다(근육 쌍) — 몸 전체로는 힘도 토크도 0.
//   땅을 딛은 발이 없으면 낼 힘이 없다 — 몸은 떨어지고 넘어진다. 그것이 맞다.
//
//  차례 (스텝마다 · Fighter.driveJoints 가 부름):
//   1) 바라는 것: 수직 N = M g + 높이 스프링 · 수평 F = M · velGain · (가려는 속도 − 무게중심 속도) [가속 한도 안] · 몸통 토크 M = 기울기 · yaw 되먹임.
//   2) 압력 중심: F 와 M 을 함께 내려면 땅 반력이 지나야 할 점 p* = 무게중심 밑 + (M_z − h F_x) / N , −(M_x + h F_z) / N.
//      p* 를 딛은 발바닥 안으로 자른다(발이 뒤집히지 않게). 잘리면 몸통 토크를 지키고 수평 힘이 물러선다 — 몸이 그 발 위의 거꾸로 선 진자가 된다(다음 발이 받는다).
//   3) 발마다: 수직 하중은 p* 가 두 발 사이 어디냐로 · 수평 힘은 하중 몫대로 + 두 발이 서로 버티는 몫(다리가 버팀목이 되어 관절 토크가 준다) +
//      yaw 는 두 발에 반대로 거는 수평 힘 짝(한 발이면 발바닥 비틀기 — 마찰 × 하중 × 발바닥 팔 길이까지). 발마다 마찰 원뿔 안으로 자른다.
//   4) 관절 토크 = (압력 중심 − 관절) × 땅 반력 + 관절 아래 토막 무게의 모멘트 (자코비안 전치 = 정역학). 사람 한도(config LEGS.limit × 근력)로 자르고 얼마나 자주 닿는지 적는다.
//  못 낸 나머지 (this.rem · 다리 B3): 3) 에서 바란 몸통 토크와 딛은 발이 실제로 받기로 한 땅 반력이 주는 토크의 차를 스텝마다 적는다 — yaw 와 기울기 따로.
//   Fighter.driveAid 가 그것을 상한(config AID.yawMax · tiltMax) 안에서 골반에 '선언된 밖 토크'로 건다. 자세 오차를 보는 둘째 제어기가 아니다 — 발이 다 낼 수 있으면 0.
//  내딛는 다리: 발목을 목표로 이끄는 힘(gait.poseLegs 가 정함)을 같은 식으로 엉덩이 · 무릎 토크 쌍으로 바꾼다 (예전에는 발과 골반에 작용선이 다른 힘 둘 — 짝 없는 짝힘이 남았다).
//
//  엔진 사실 (Rapier 0.19.3 한 관절 · 한 다리 시험): 명시 토크 쌍은 그대로 전달된다. 명시 감쇠는 d < 2 I / dt 안에서만 선다 → 몸통 되먹임의 각속도는
//   골반 하나가 아니라 몸통 네 토막(골반 · 배 · 가슴 · 머리)의 각운동량 ÷ 관성으로 잰다(골반만 재면 0.1 kg·m² 에 걸려 터진다).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { LEGS, AID } from './config.js';

const G = 9.81;
const TRUNK = ['pelvis', 'abdomen', 'chest', 'head'];
const UPPER = ['pelvis', 'abdomen', 'chest', 'head', 'uarmS', 'farmS', 'uarmO', 'farmO'];
const ARMS = ['uarmS', 'farmS', 'uarmO', 'farmO'];
const FOOT_HX = 0.12; // 발 상자 반 길이 (fighter.js partDefs)
const FOOT_HZ = 0.05; // 반 너비
const FOOT_HY = 0.035; // 반 높이 (발 몸체 중심 → 발바닥)
const clamp = THREE.MathUtils.clamp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * 다리 관절 한 축 · 한 방향의 토크 한도 (N·m): base = LEGS.limit 의 그 방향 칸 · str = 근력 몫(strengthOf) · wEcc = 그 방향 토크를 거슬러 도는 관절 빠르기(rad/s · 근육이 늘어나며 버틸 때 +).
 *  늘어나며 버티는 근육은 한도 × (1 + (LEGS.ecc − 1) × (wEcc ÷ LEGS.eccW 를 0 ~ 1 로 자름)) — LEGS.ecc 1 이면 늘 한도 × 근력 그대로(같은 수).
 */
export function legLimit(base, str, wEcc) {
  const W = LEGS.eccW;
  return base * str * (1 + (LEGS.ecc - 1) * (wEcc > 0 ? (wEcc < W ? wEcc / W : 1) : 0));
}
/** 부모 쪽 토크 t 를 [−한도(lo 칸), 한도(hi 칸)] 로 자름 · w = (자식 − 부모) 각속도의 그 축 몫 — 부모 쪽 + 토크는 w > 0 일 때 늘어나며 버틴다 */
const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));

const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _r = new THREE.Vector3();
const _t = new THREE.Vector3();
const _gv = new THREE.Vector3();
const _w = new THREE.Vector3();
const _L = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
const _wr = new THREE.Vector3();
const _tq = { x: 0, y: 0, z: 0 };
const _wp = new THREE.Vector3(); // 이번 스텝 골반 각속도 (drive 가 읽어 senseLeg 가 씀)

// ── 볼록 다각형 (수평면 xz) — 받침 다각형 셈 (점 8 개까지 · 임시 배열을 다시 씀) ──
const _px = new Float64Array(8), _pz = new Float64Array(8); // 넣는 점
const _hx = new Float64Array(10), _hz = new Float64Array(10); // 껍질 (반시계 · x → z 평면)
const _ord = [0, 1, 2, 3, 4, 5, 6, 7];
const _near = { x: 0, z: 0 };
const crs = (ox, oz, ax, az, bx, bz) => (ax - ox) * (bz - oz) - (az - oz) * (bx - ox);
/** 점 n 개(_px · _pz)의 볼록 껍질 → _hx · _hz, 꼭짓점 수를 돌려준다 (단조 사슬) */
function hullOf(n) {
  const o = _ord;
  for (let i = 0; i < n; i++) o[i] = i;
  for (let i = 1; i < n; i++) { // 끼워 넣기 차례 맞춤 (x, 다음 z)
    const k = o[i];
    let j = i - 1;
    while (j >= 0 && (_px[o[j]] > _px[k] || (_px[o[j]] === _px[k] && _pz[o[j]] > _pz[k]))) { o[j + 1] = o[j]; j--; }
    o[j + 1] = k;
  }
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = _px[o[i]], z = _pz[o[i]];
    while (k >= 2 && crs(_hx[k - 2], _hz[k - 2], _hx[k - 1], _hz[k - 1], x, z) <= 0) k--;
    _hx[k] = x; _hz[k++] = z;
  }
  const t = k + 1;
  for (let i = n - 2; i >= 0; i--) {
    const x = _px[o[i]], z = _pz[o[i]];
    while (k >= t && crs(_hx[k - 2], _hz[k - 2], _hx[k - 1], _hz[k - 1], x, z) <= 0) k--;
    _hx[k] = x; _hz[k++] = z;
  }
  return k - 1;
}
/** 점이 껍질 안인가 */
function inHull(n, x, z) {
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (crs(_hx[i], _hz[i], _hx[j], _hz[j], x, z) < -1e-9) return false;
  }
  return true;
}
/** 껍질 안의 점 o 에서 d 쪽으로 갈 때 껍질 안에 남는 가장 큰 몫 (0 ~ 1) */
function rayHull(n, ox, oz, dx, dz) {
  let s = 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = _hx[j] - _hx[i], ez = _hz[j] - _hz[i];
    const den = ex * dz - ez * dx; // 모서리 안쪽 법선 쪽 몫의 변화 (음수 = 밖으로 나감)
    if (den < -1e-12) {
      const num = ex * (oz - _hz[i]) - ez * (ox - _hx[i]); // 지금 안쪽 거리 (≥ 0)
      s = Math.min(s, Math.max(0, num / -den));
    }
  }
  return s;
}
/** 껍질에서 점에 가장 가까운 점 → _near */
function nearHull(n, x, z) {
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = _hx[j] - _hx[i], ez = _hz[j] - _hz[i];
    const l2 = ex * ex + ez * ez;
    const t = l2 > 1e-12 ? clamp(((x - _hx[i]) * ex + (z - _hz[i]) * ez) / l2, 0, 1) : 0;
    const qx = _hx[i] + ex * t, qz = _hz[i] + ez * t;
    const d2 = (x - qx) * (x - qx) + (z - qz) * (z - qz);
    if (d2 < best) { best = d2; _near.x = qx; _near.z = qz; }
  }
  if (n === 0) { _near.x = x; _near.z = z; }
}

const NAMES = ['hip', 'knee', 'ankle'];
const mkStat = () => ({ n: 0, sat: 0, sum: 0, peak: 0, hist: new Uint32Array(100) }); // hist: 5 N·m 칸

function mkLeg(f, k) {
  const J = f.jointByName;
  const an = (name) => { const a = J[name].joint.anchor1(); return new THREE.Vector3(a.x, a.y, a.z); };
  return {
    k,
    thighN: 'thigh' + k, shinN: 'shin' + k, footN: 'foot' + k,
    hipA: an('thigh' + k), kneeA: an('shin' + k), ankleA: an('foot' + k), // 부모 토막 틀의 관절 자리
    ph: new THREE.Vector3(), pk: new THREE.Vector3(), pa: new THREE.Vector3(), // 관절 자리 (월드)
    xT: new THREE.Vector3(), xS: new THREE.Vector3(), xF: new THREE.Vector3(), // 토막 질량중심
    qT: new THREE.Quaternion(), qF: new THREE.Quaternion(),
    sole: new THREE.Vector3(), fx: new THREE.Vector3(), fz: new THREE.Vector3(), // 발바닥 가운데 · 발 앞 축 · 옆 축 (월드)
    hx: 0, hz: 0, lx: 0, lz: 0, // 수평면의 발 앞 · 옆 단위
    aMin: 0, aMax: 0, // 압력 중심이 발 앞뒤로 갈 수 있는 범위 (발바닥 가운데 기준 m)
    on: false, // 이번 스텝에 땅 반력을 낼 수 있는 발
    c: new THREE.Vector3(), // 이번 스텝 압력 중심 (월드)
    Gx: 0, Gy: 0, Gz: 0, ny: 0, // 이번 스텝에 이 발이 받으려는 땅 반력 · 발바닥 비틀기
    Cx: 0, Cz: 0, // 이번 스텝에 이 발이 줄 수 있는 수평 힘 (받기로 한 하중의 마찰 원뿔 안 — 못 낸 나머지 셈만 읽음)
    pull: null, // 내딛는 발목을 이끄는 힘 (gait.poseLegs 가 스텝마다 둠 · 쓰고 나면 지움)
    pullV: new THREE.Vector3(),
    stat: { hip: mkStat(), knee: mkStat(), ankle: mkStat() },
    raw: { hx: 0, hy: 0, hz: 0, k: 0, ax: 0, ay: 0, az: 0 }, // 자르기 앞 관절 토크 (재는 도구가 읽음 — 엉덩이 · 발목은 그 토막 틀의 축마다 · 무릎은 경첩 축)
    wH: new THREE.Vector3(), wK: 0, wA: new THREE.Vector3(), // 이번 스텝 앞 관절 빠르기 (자식 − 부모 · 한도 틀: 엉덩이 = 허벅지 틀 · 무릎 = 허벅지 z · 발목 = 발 틀)
  };
}

export class LegDrive {
  constructor(fighter) {
    this.f = fighter;
    this.legs = { F: mkLeg(fighter, 'F'), B: mkLeg(fighter, 'B') };
    this.intent = null; // driveBalance 가 스텝마다 둠 { want, aLim, h, yaw }
    this.push = new THREE.Vector3(); // 이번 스텝에 다리로 더 밀려는 수평 힘 (붙어 밀기 · 맞밀기 — 땅 반력으로 낸다)
    this.cop = new THREE.Vector3(); // 지난 스텝의 압력 중심 (걸음이 읽음)
    this._on = [];
    this._soft = [];
    {
      // 다리를 다 폈을 때 엉덩이 ~ 발목 거리 = 허벅지(엉덩이 관절 ~ 무릎 관절) + 정강이(무릎 관절 ~ 발목 관절)
      const J = fighter.jointByName;
      const len = (a, b) => { const p = J[a].joint.anchor2(), q = J[b].joint.anchor1(); return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z); };
      for (const k of ['F', 'B']) {
        this.legs[k].lenT = len('thigh' + k, 'shin' + k);
        this.legs[k].lenS = len('shin' + k, 'foot' + k);
      }
      this.legMax = this.legs.F.lenT + this.legs.F.lenS;
    }
    this.copOk = false;
    this.capDist = 0; // 캡처 점이 받침 다각형 밖으로 나간 거리 (0 = 안 · 걸음이 읽어 받아 딛는다)
    this.w0 = 0; // √(g ÷ 윗몸 질량중심 높이) — 캡처 점 = 무게중심 + 속도 ÷ w0 (걸음이 같은 값을 읽는다 · 0 = 아직 안 잼)
    this.wTrunk = new THREE.Vector3(); // 몸통 각속도 (각운동량 ÷ 관성)
    this.xT = new THREE.Vector3(); // 윗몸 질량중심 (senseTrunk)
    this.vT = new THREE.Vector3(); // 그 속도
    this.swM = new THREE.Vector3(); // 이번 스텝에 내딛는 다리를 이끄는 토크 쌍이 윗몸에 거는 모멘트 (딛은 다리가 맞받는다)
    this.armM = new THREE.Vector3(); // 두 팔 · 칼을 휘두르는 근육 쌍이 몸통에 거는 모멘트 = −d(팔 · 칼의 몸통에 대한 각운동량)/dt (걸러진 값 · 딛은 다리가 맞받는다)
    this.armL = new THREE.Vector3(); // 지난 스텝의 그 각운동량 (armMomentum)
    this.armL2 = new THREE.Vector3(); // 두 스텝 앞의 값
    this.armOk = false; // armL 이 지난 스텝 값인가 (서 있지 않던 스텝 뒤에는 처음부터)
    this.armOk2 = false; // armL2 가 두 스텝 앞 값인가
    this.wPrev = new THREE.Vector3(); // 지난 스텝의 몸통 각속도 (거르지 않은 값)
    this.rem = new THREE.Vector3(); // 이번 스텝에 발이 못 낸 몸통 토크 = 바란 것 − 딛은 발이 땅에서 받을 수 있는 것 (월드 · y = 수직축 · x, z = 기울기 축 · N·m) — Fighter.driveAid 가 읽어 상한 안에서 골반에 건다
    this.lostHip = new THREE.Vector3(); // (재기만) 이번 스텝에 딛은 엉덩이 관절 한도에 잘린 토크 (월드 — 골반이 덜 받은 몫)
    this.dbg = { N: 0, Fx: 0, Fz: 0, Mx: 0, My: 0, Mz: 0, clipped: 0, n: 0, clipN: 0, slipN: 0, pull: 0, on: 0 }; // (pull: 이번 스텝에 내딛는 발목을 이끈 힘의 크기 · on: 땅을 누른 발 수 — 재는 도구가 읽음)
  }

  /** 몸통 네 토막의 각운동량 ÷ 관성 = 몸통 각속도 (월드) */
  trunkRate(out) {
    const f = this.f;
    let M = 0;
    _c.set(0, 0, 0);
    _gv.set(0, 0, 0);
    for (const n of TRUNK) {
      const b = f.bodies[n];
      const m = b.mass(), p = b.worldCom(), v = b.linvel();
      _c.x += p.x * m; _c.y += p.y * m; _c.z += p.z * m;
      _gv.x += v.x * m; _gv.y += v.y * m; _gv.z += v.z * m;
      M += m;
    }
    _c.multiplyScalar(1 / M);
    _gv.multiplyScalar(1 / M);
    _L.set(0, 0, 0);
    let ixx = 0, iyy = 0, izz = 0, ixy = 0, ixz = 0, iyz = 0;
    for (const n of TRUNK) {
      const b = f.bodies[n];
      const m = b.mass(), p = b.worldCom(), v = b.linvel(), w = b.angvel(), r = b.rotation();
      const dx = p.x - _c.x, dy = p.y - _c.y, dz = p.z - _c.z;
      const ux = v.x - _gv.x, uy = v.y - _gv.y, uz = v.z - _gv.z;
      _L.x += m * (dy * uz - dz * uy); _L.y += m * (dz * ux - dx * uz); _L.z += m * (dx * uy - dy * ux);
      ixx += m * (dy * dy + dz * dz); iyy += m * (dx * dx + dz * dz); izz += m * (dx * dx + dy * dy);
      ixy -= m * dx * dy; ixz -= m * dx * dz; iyz -= m * dy * dz;
      // 토막 제 관성: 주축 틀로
      const ip = b.principalInertia(), lf = b.principalInertiaLocalFrame();
      _q.set(r.x, r.y, r.z, r.w).multiply(_qi.set(lf.x, lf.y, lf.z, lf.w));
      _qi.copy(_q).invert();
      _w.set(w.x, w.y, w.z).applyQuaternion(_qi);
      _w.set(_w.x * ip.x, _w.y * ip.y, _w.z * ip.z).applyQuaternion(_q);
      _L.add(_w);
      for (let i = 0; i < 3; i++) {
        _a.set(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0).applyQuaternion(_q); // 주축 i (월드)
        const s = i === 0 ? ip.x : i === 1 ? ip.y : ip.z;
        ixx += s * _a.x * _a.x; iyy += s * _a.y * _a.y; izz += s * _a.z * _a.z;
        ixy += s * _a.x * _a.y; ixz += s * _a.x * _a.z; iyz += s * _a.y * _a.z;
      }
    }
    _m3.set(ixx, ixy, ixz, ixy, iyy, iyz, ixz, iyz, izz).invert();
    return out.copy(_L).applyMatrix3(_m3);
  }

  /** 다리 하나의 관절 자리 · 토막 질량중심 · 발 틀 읽기 */
  senseLeg(L) {
    const f = this.f;
    const pel = f.bodies.pelvis, th = f.bodies[L.thighN], sh = f.bodies[L.shinN], ft = f.bodies[L.footN];
    let t = pel.translation(), r = pel.rotation();
    L.ph.copy(L.hipA).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_t.set(t.x, t.y, t.z));
    t = th.translation(); r = th.rotation();
    L.qT.set(r.x, r.y, r.z, r.w);
    L.pk.copy(L.kneeA).applyQuaternion(L.qT).add(_t.set(t.x, t.y, t.z));
    L.xT.set(t.x, t.y, t.z);
    t = sh.translation(); r = sh.rotation();
    L.pa.copy(L.ankleA).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_t.set(t.x, t.y, t.z));
    L.xS.set(t.x, t.y, t.z);
    t = ft.translation(); r = ft.rotation();
    L.qF.set(r.x, r.y, r.z, r.w);
    L.xF.set(t.x, t.y, t.z);
    L.fx.set(1, 0, 0).applyQuaternion(L.qF);
    L.fz.set(0, 0, 1).applyQuaternion(L.qF);
    L.sole.set(0, -FOOT_HY, 0).applyQuaternion(L.qF).add(L.xF);
    const hl = Math.hypot(L.fx.x, L.fx.z) || 1;
    L.hx = L.fx.x / hl; L.hz = L.fx.z / hl;
    L.lx = -L.hz; L.lz = L.hx;
    // 관절 빠르기 (자식 − 부모 · 한도 틀) — 한도 셈(clampLeg)이 읽는다
    let w = th.angvel();
    const tx = w.x, ty = w.y, tz = w.z;
    L.wH.set(tx - _wp.x, ty - _wp.y, tz - _wp.z).applyQuaternion(_qi.copy(L.qT).invert());
    w = sh.angvel();
    _t.set(0, 0, 1).applyQuaternion(L.qT);
    L.wK = (w.x - tx) * _t.x + (w.y - ty) * _t.y + (w.z - tz) * _t.z;
    const sx = w.x, sy = w.y, sz = w.z;
    w = ft.angvel();
    L.wA.set(w.x - sx, w.y - sy, w.z - sz).applyQuaternion(_qi.copy(L.qF).invert());
  }

  /** 이 발이 땅 반력을 낼 수 있나 — 발바닥 가장 낮은 모서리가 땅에 닿아 있음 (기울어 디딘 발은 닿은 끝만 압력 중심 범위) */
  footContact(L) {
    const f = this.f;
    // 발 앞 축 · 옆 축이 땅 면에서 들린 몫(sin) · 발바닥 가운데가 땅 면에서 뜬 거리. 평지는 세계 위 축 그대로.
    //  지형 무대(넷째 판): 그 발 밑 땅의 법선으로 잰다 — 수평 기준으로 재면 10° 비탈에 나란히 디딘 발이 '발끝으로 선 발'(내리막 쪽) · '뒤꿈치로 선 발'(오르막 쪽)로 읽혀
    //  압력 중심이 발끝 · 뒤꿈치 2 cm 에 갇히고(가만히 서도 몸이 비탈 아래로 흘러감), 땅 위 2 cm 에 뜬 발도 닿은 발로 읽혔다
    let ty = L.fx.y, tz = L.fz.y, gap = L.sole.y;
    if (f.terrain) {
      const n = f.terrain.normalAt(L.sole.x, L.sole.z);
      ty = L.fx.x * n.x + L.fx.y * n.y + L.fx.z * n.z;
      tz = L.fz.x * n.x + L.fz.y * n.y + L.fz.z * n.z;
      gap = (L.sole.y - f.groundHeightAt(L.sole.x, L.sole.z)) * n.y;
    }
    const low = gap - FOOT_HX * Math.abs(ty) - FOOT_HZ * Math.abs(tz);
    const m = LEGS.copMargin;
    const toe = clamp((-ty - 0.03) / 0.06, 0, 1); // 발끝으로 선 정도
    const heel = clamp((ty - 0.03) / 0.06, 0, 1); // 뒤꿈치로 선 정도
    L.aMin = THREE.MathUtils.lerp(-(FOOT_HX - m), FOOT_HX - m - 0.02, toe);
    L.aMax = THREE.MathUtils.lerp(FOOT_HX - m, -(FOOT_HX - m - 0.02), heel);
    // 힘 빠진 발목 (넷째 판 · 다친 몸): 압력 중심을 발목에서 앞 · 뒤로 옮기는 것은 발목 토크다 — 한도 × 근력 몫 ÷ 몸무게보다 멀리는 못 옮긴다.
    //  성한 몸은 발끝까지 0.16 m · 뒤꿈치까지 0.06 m 가 모두 한도 안(0.24 · 0.08 m)이라 그대로. 근력 몫 0.5 면 앞 0.12 m 까지 — 못 내는 압력 중심을 셈에 넣으면 받침 다각형을 실제보다 넓게 믿는다
    const str = this.strengthOf(L.k);
    if (str < 1) {
      const w = (f.totalMass || 75) * G, a0 = (L.pa.x - L.sole.x) * L.fx.x + (L.pa.y - L.sole.y) * L.fx.y + (L.pa.z - L.sole.z) * L.fx.z; // 발목의 발 앞뒤 자리 (발바닥 가운데 기준)
      L.aMax = Math.max(L.aMin, Math.min(L.aMax, a0 + (LEGS.limit.anklePlantar * str) / w));
      L.aMin = Math.min(L.aMax, Math.max(L.aMin, a0 - (LEGS.limit.ankleDorsi * str) / w));
    }
    return low < LEGS.contactGap;
  }

  /** 토크 쌍: 부모에 +τ, 자식에 −τ */
  pair(parent, child, x, y, z) {
    _tq.x = x; _tq.y = y; _tq.z = z;
    parent.addTorque(_tq, true);
    _tq.x = -x; _tq.y = -y; _tq.z = -z;
    child.addTorque(_tq, true);
  }

  note(st, mag, sat) {
    st.n++;
    st.sum += mag;
    if (mag > st.peak) st.peak = mag;
    if (sat) st.sat++;
    st.hist[Math.min(99, (mag / 5) | 0)]++;
  }

  /**
   * 다리 하나의 관절 토크: 발이 (점 c 에서) 받는 힘 Fv 와 비틀기 ny, 그리고 관절 아래 토막 무게(grav 1 이면)를 버티는 정역학 토크를
   *  엉덩이(골반 ↔ 허벅지) · 무릎(허벅지 ↔ 정강이 · 경첩 축 몫만) · 발목(정강이 ↔ 발) 쌍으로 건다. 사람 한도 × str 로 자른다.
   */
  legTorques(L, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring = grav) {
    const f = this.f;
    const pel = f.bodies.pelvis, th = f.bodies[L.thighN], sh = f.bodies[L.shinN], ft = f.bodies[L.footN];
    const lim = LEGS.limit;
    const mT = th.mass(), mS = sh.mass(), mF = ft.mass();
    // 관절 p 둘레: (c − p) × F + (0, ny, 0) + Σ (x_k − p) × (0, −m_k g, 0)
    const at = (p, out, nS, nT) => {
      const rx = c.x - p.x, ry = c.y - p.y, rz = c.z - p.z;
      out.set(ry * Fz - rz * Fy, rz * Fx - rx * Fz + ny, rx * Fy - ry * Fx);
      if (grav) {
        // (x − p) × (0, −w, 0) = ( (x−p)_z · w , 0 , −(x−p)_x · w )
        let w = mF * G;
        out.x += (L.xF.z - p.z) * w; out.z -= (L.xF.x - p.x) * w;
        if (nS) { w = mS * G; out.x += (L.xS.z - p.z) * w; out.z -= (L.xS.x - p.x) * w; }
        if (nT) { w = mT * G; out.x += (L.xT.z - p.z) * w; out.z -= (L.xT.x - p.x) * w; }
      }
      return out;
    };
    // 발목 (발 틀: x 안팎 기울기 · y 비틀기 · z 발바닥 굽힘(+) / 발등 굽힘(−))
    if (ankleOn) {
      at(L.pa, _a, false, false);
      _qi.copy(L.qF).invert();
      _b.copy(_a).applyQuaternion(_qi);
      L.raw.ax = _b.x; L.raw.ay = _b.y; L.raw.az = _b.z;
      const x = clampLeg(_b.x, L.wA.x, lim.ankleInv, lim.ankleInv, str);
      const y = clampLeg(_b.y, L.wA.y, lim.ankleRot, lim.ankleRot, str);
      const z = clampLeg(_b.z, L.wA.z, lim.ankleDorsi, lim.anklePlantar, str);
      const sat = x !== _b.x || y !== _b.y || z !== _b.z;
      _b.set(x, y, z);
      this.note(L.stat.ankle, _b.length(), sat);
      _b.applyQuaternion(L.qF);
      this.pair(sh, ft, _b.x, _b.y, _b.z);
    }
    // 무릎 (경첩 축 = 허벅지 z · 부모 쪽 − = 펴는 토크)
    {
      at(L.pk, _a, true, false);
      _b.set(0, 0, 1).applyQuaternion(L.qT);
      let s0 = _a.dot(_b);
      if (spring) {
        // 디딘 무릎이 다 펴지기 앞서 굽히는 쪽으로 되미는 스프링 (LEGS.kneeFree 안쪽): 다 펴진 다리는 관절 한도에 얹힌 버팀목이 되어 토크와 무관하게 몸을 받친다 —
        //  그러면 바라는 땅 반력을 다리 토크로 정할 수 없다(무릎을 조금 굽힌 채 서야 다리가 힘을 고를 수 있다)
        const len = L.ph.distanceTo(L.pa);
        const c = clamp((L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS), -1, 1);
        const phi = Math.PI - Math.acos(c); // 무릎 굽힘 (0 = 다 폄)
        if (phi < LEGS.kneeFree) s0 += LEGS.kneeFreeK * (LEGS.kneeFree - phi) * str;
      }
      L.raw.k = s0;
      const s = clampLeg(s0, L.wK, lim.kneeExt, lim.kneeFlex, str);
      this.note(L.stat.knee, Math.abs(s), s !== s0);
      this.pair(th, sh, _b.x * s, _b.y * s, _b.z * s);
    }
    // 엉덩이 (허벅지 틀: x 벌림 · 모음 · y 돌림 · z 굽힘 · 폄)
    {
      at(L.ph, _a, true, true);
      _qi.copy(L.qT).invert();
      _b.copy(_a).applyQuaternion(_qi);
      L.raw.hx = _b.x; L.raw.hy = _b.y; L.raw.hz = _b.z;
      const x = clampLeg(_b.x, L.wH.x, lim.hipAbd, lim.hipAbd, str);
      const y = clampLeg(_b.y, L.wH.y, lim.hipRot, lim.hipRot, str);
      const z = clampLeg(_b.z, L.wH.z, lim.hipFlex, lim.hipFlex, str);
      const sat = x !== _b.x || y !== _b.y || z !== _b.z;
      if (sat && ankleOn) this.lostHip.add(_c.set(_b.x - x, _b.y - y, _b.z - z).applyQuaternion(L.qT)); // 딛은 다리의 엉덩이 한도에 잘린 몫 (재기만)
      _b.set(x, y, z);
      this.note(L.stat.hip, _b.length(), sat);
      _b.applyQuaternion(L.qT);
      this.pair(pel, th, _b.x, _b.y, _b.z);
    }
  }

  /** 다리 근력 몫 (driveJoints 의 다리 근육과 같은 꼴 — 근육 세기 · 다리 건강 · 그 다리 기능 · 인물 힘) */
  strengthOf(k) {
    const f = this.f;
    return f.muscle * (0.6 + 0.4 * f.legHealth) * (0.4 + 0.6 * f.limbs['leg' + k]); // 인물 힘 몫(PROF_BODY.strength — 숙련도 칸)은 다리 받치는 힘에 곱하지 않는다: 옛 판에서도 서기 · 걷기는 숙련도와 무관했다(밖 받침이 했다). 칼 · 밀치기 힘에는 그대로 곱한다
  }

  /**
   * 이 다리가 수직 하중 load(N)를 받칠 때 버틸 수 있는 가장 큰 무릎 굽힘(rad) — 무릎 펴는 토크 한도(LEGS.limit.kneeExt × 근력 몫) × LEGS.kneeUse 에서 (물리 2.0 넷째 판 · 다친 몸의 자세).
   *  땅 반력이 발목 → 엉덩이 줄을 지날 때 무릎 토크 = 하중 × d , d = 무릎이 그 줄에서 벗어난 거리 = a b sin φ ÷ √(a² + b² + 2 a b cos φ) (a 허벅지 · b 정강이 · φ 무릎 굽힘).
   *  성한 다리(근력 몫 1 · 몸무게 전부): d 0.27 m → 80° — 서기 · 걷기 · 런지 자세의 무릎(37 ~ 80°)을 막지 않는다. 근력 몫 0.5 → 39° · 0.3 → 22°.
   *  걸음 장치(gait.js ⑥ 골반 높이)가 읽어 그 다리가 버틸 수 있는 높이 밑으로는 골반을 내리지 않는다 — 힘이 빠진 몸은 무릎을 펴고 선다.
   */
  kneeBendMax(k, load) {
    const L = this.legs[k], ab = L.lenT * L.lenS, s2 = L.lenT * L.lenT + L.lenS * L.lenS;
    const d = (LEGS.limit.kneeExt * this.strengthOf(k) * LEGS.kneeUse) / Math.max(1, load);
    const dOf = (phi) => (ab * Math.sin(phi)) / Math.sqrt(s2 + 2 * ab * Math.cos(phi));
    let lo = 0, hi = 1.9; // (d 는 110° 쯤까지 늘어난다 — 그 너머는 '막지 않음')
    if (dOf(hi) <= d) return Infinity;
    for (let i = 0; i < 12; i++) { const m = 0.5 * (lo + hi); if (dOf(m) < d) lo = m; else hi = m; }
    return lo;
  }

  /**
   * 한 발로 선 이 다리의 엉덩이가 버틸 수 있는 '엉덩이 관절에서 그 위에 얹힌 무게 줄까지의 앞뒤 거리'(m) = 엉덩이 굽힘 · 폄 토크 한도 × 근력 몫 ÷ 얹힌 무게(온몸 − 그 다리).
   *  성한 몸 0.33 m (펜싱 자세의 엉덩이 ~ 발 앞뒤 거리 0.25 ~ 0.31 을 덮는다) · 근력 몫 0.5 → 0.16 · 0.3 → 0.10. 걸음 장치(gait.js stanceK)가 읽어 다친 몸의 자세 길이를 줄인다
   */
  hipReach(k) {
    const f = this.f, L = this.legs[k];
    const up = f.totalMass + (f.armed && f.sword ? f.sword.mass() : 0) - f.bodies[L.thighN].mass() - f.bodies[L.shinN].mass() - f.bodies[L.footN].mass();
    return (LEGS.limit.hipFlex * this.strengthOf(k)) / Math.max(1, up * G);
  }

  /** 윗몸(골반 · 배 · 가슴 · 머리 · 두 팔 · 칼)의 질량중심 → this.xT (몸통 토크의 기준 점 — 딛은 다리의 땅 반력이 이 점을 지나면 윗몸이 돌지 않는다) · 그 속도 → this.vT */
  senseTrunk() {
    const f = this.f;
    let M = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
    const add = (b) => {
      const m = b.mass(), p = b.worldCom(), v = b.linvel();
      x += p.x * m; y += p.y * m; z += p.z * m;
      vx += v.x * m; vy += v.y * m; vz += v.z * m;
      M += m;
    };
    for (const n of UPPER) if (f.bodies[n] && !f.detachedParts?.has(n)) add(f.bodies[n]); // 잘려 떨어진 팔은 윗몸이 아니다 (armMomentum 과 같은 가름)
    if (f.armed && f.sword) add(f.sword);
    this.xT.set(x / M, y / M, z / M);
    this.vT.set(vx / M, vy / M, vz / M);
  }

  /**
   * 두 팔 · 칼이 몸통에 대해 움직이는 몫의 각운동량(윗몸 질량중심 둘레) → out.
   *  L_rel = Σ m r × (v − v_윗몸 − ω_몸통 × r) + I (ω − ω_몸통) , r = 토막 질량중심 − 윗몸 질량중심.
   *  윗몸이 한 덩어리로 돌면 0 이다(몸통 되먹임과 되물리지 않는다). 이 값이 바뀌는 빠르기가 팔 · 칼을 휘두르는 근육 쌍(어깨 · 팔꿈치 · 손목 · 빈손)이 몸통에 거는 반작용의 합이다 —
   *  엔진 모터가 낸 토크는 읽을 수 없으므로 명령한 토크가 아니라 실제 움직임으로 잰다.
   */
  armMomentum(out, wT) {
    const f = this.f;
    const xT = this.xT, vT = this.vT;
    out.set(0, 0, 0);
    const add = (b) => {
      const m = b.mass(), p = b.worldCom(), v = b.linvel(), w = b.angvel(), r = b.rotation();
      const rx = p.x - xT.x, ry = p.y - xT.y, rz = p.z - xT.z;
      // 몸통과 함께 도는 몫을 뺀 속도
      const ux = v.x - vT.x - (wT.y * rz - wT.z * ry), uy = v.y - vT.y - (wT.z * rx - wT.x * rz), uz = v.z - vT.z - (wT.x * ry - wT.y * rx);
      out.x += m * (ry * uz - rz * uy); out.y += m * (rz * ux - rx * uz); out.z += m * (rx * uy - ry * ux);
      const ip = b.principalInertia(), lf = b.principalInertiaLocalFrame();
      _q.set(r.x, r.y, r.z, r.w).multiply(_qi.set(lf.x, lf.y, lf.z, lf.w));
      _qi.copy(_q).invert();
      _w.set(w.x - wT.x, w.y - wT.y, w.z - wT.z).applyQuaternion(_qi);
      _w.set(_w.x * ip.x, _w.y * ip.y, _w.z * ip.z).applyQuaternion(_q);
      out.add(_w);
    };
    for (const n of ARMS) if (f.bodies[n] && !f.detachedParts?.has(n)) add(f.bodies[n]);
    if (f.armed && f.sword) add(f.sword);
    return out;
  }

  /**
   * 스텝마다 (Fighter.driveJoints 가 부름): 내딛는 다리 이끌기 + 딛은 다리로 몸 받치기.
   *  몸통 먼저: 몸통을 세우는 토크(자세 되먹임 − 내딛는 다리 반작용 − 칼 팔 반작용)는 줄이지 않는다. 압력 중심이 발바닥 가장자리에 닿아 순수 토크로 못 내는 몫은
   *  땅 반력이 기울어(수평 힘) 낸다 — 그 수평 힘이 무게중심을 밀어내는 것은 받아들이고, 다음 발이 받는다(src/gait.js 의 캡처 점 디딤).
   */
  drive() {
    const f = this.f;
    const it = this.intent;
    this.intent = null;
    this.copOk = false;
    this.capDist = 0;
    this.swM.set(0, 0, 0);
    this.rem.set(0, 0, 0);
    this.lostHip.set(0, 0, 0);
    this.dbg.pull = 0;
    if (f.missingLeg || !f.jointByName.thighF?.joint || !f.jointByName.thighB?.joint) { this.push.set(0, 0, 0); this.armM.set(0, 0, 0); this.armOk = this.armOk2 = false; return; }
    { const w = f.bodies.pelvis.angvel(); _wp.set(w.x, w.y, w.z); } // 골반 각속도 (관절 빠르기 — senseLeg)
    for (const k of ['F', 'B']) this.senseLeg(this.legs[k]);
    this.senseTrunk();
    const xT = this.xT;
    // ── 내딛는 다리: 발목을 목표로 이끄는 힘 + 다리 무게 → 엉덩이 · 무릎 토크 쌍 ──
    //  그 반작용(이끄는 힘 p 가 발목에서 윗몸에 거꾸로 걸린 것과 같은 모멘트 (발목 − 윗몸 질량중심) × (−p))을 적어 두고 아래에서 딛은 다리가 맞받는다
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      if (!L.pull) continue;
      L.pull = null;
      const p = L.pullV;
      // 발이 받는 힘 p (발목 점) = 다리가 '땅 반력 −p 를 받는' 것과 같은 식의 반대 부호
      this.legTorques(L, L.pa, -p.x, -p.y, -p.z, 0, true, this.strengthOf(k), false, false);
      this.dbg.pull = Math.hypot(p.x, p.y, p.z);
      const rx = L.pa.x - xT.x, ry = L.pa.y - xT.y, rz = L.pa.z - xT.z;
      this.swM.x -= ry * p.z - rz * p.y;
      this.swM.y -= rz * p.x - rx * p.z;
      this.swM.z -= rx * p.y - ry * p.x;
    }
    if (!it || f.state !== 'stand' || !(f.muscle > 0.1) || !f.com) { this.push.set(0, 0, 0); this.armM.set(0, 0, 0); this.armOk = this.armOk2 = false; return; }
    const gait = f.gait;
    // ── 땅 반력을 낼 수 있는 발 ──
    //  on = 땅을 누를 수 있는 발 — 받침 다각형과 수평 힘은 이 발들만.
    //  soft = 디딘 발인데 다리가 다 펴져 더 누를 수 없는 발(엉덩이 ~ 발목 거리가 다리 길이 끝)이고 지난 스텝에 실제로 누른 힘도 거의 없는 발 — 아래로 누르는 작은 힘만 준다(땅을 찾음).
    //   그런 발에 하중을 맡기면 셈한 압력 중심과 실제가 어긋나고, 수평 힘을 주면 발만 끌린다. 누를 수 있는 발이 하나도 없으면 닿은 발을 모두 on 으로 본다
    const M = f.totalMass + (f.armed && f.sword ? f.sword.mass() : 0);
    const on = this._on, soft = this._soft;
    on.length = soft.length = 0;
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.on = !!gait?.active && gait.legs[k].stance && this.footContact(L);
      if (!L.on) continue;
      const taut = L.ph.distanceTo(L.pa) > this.legMax - LEGS.tautGap;
      if (taut && !((gait.legs[k].N || 0) > LEGS.firmLoad * M * G)) soft.push(L);
      else on.push(L);
    }
    if (!on.length) while (soft.length) on.push(soft.pop());
    const pel = f.bodies.pelvis;
    const pp = pel.translation(), pv = pel.linvel();
    const com = f.com, cv = f.comVel;
    // ── 1) 바라는 것 ──
    const vy = f.terrain ? pv.y - f.groundVelocityAt(pp.x, pp.z, pv) : pv.y;
    let N = clamp(M * G + LEGS.heightK * (it.h - pp.y) - LEGS.heightD * vy, LEGS.loadMin * M * G, LEGS.loadMax * M * G);
    const fl = M * it.aLim;
    let Fx = clamp(M * LEGS.velGain * (it.want.x - cv.x), -fl, fl) + this.push.x;
    let Fz = clamp(M * LEGS.velGain * (it.want.z - cv.z), -fl, fl) + this.push.z;
    this.push.set(0, 0, 0);
    // 몸통: 골반이 곧게 서고 yaw 는 바라볼 쪽으로 — 기울기 오차는 골반 위 축, 각속도는 몸통 네 토막
    // 몸통 각속도 · 팔과 칼의 각운동량은 두 스텝 평균으로 쓴다: 칼 팔(명시 어깨 근육 · 손목)은 서 있을 때도 스텝마다 부호가 뒤집히는 떨림(위팔 yaw ± 1.7 rad/s · 가슴 ± 0.5 rad/s — 잰 값 · 출발 판도 같음)을 갖고 있다.
    //  한 스텝 값을 그대로 쓰면 그 떨림이 감쇠 토크(yawD · tiltD)와 반작용 맞받기에 ± 수십 N·m 로 실린다. 이웃한 두 스텝의 평균은 그 떨림을 정확히 지운다(반 스텝 늦음)
    const wRaw = this.trunkRate(_wr); // (임시 벡터를 쓰므로 아래 골반 축 셈보다 먼저)
    const wT = this.wTrunk;
    if (this.armOk) wT.addVectors(wRaw, this.wPrev).multiplyScalar(0.5);
    else wT.copy(wRaw);
    this.wPrev.copy(wRaw);
    // 팔 · 칼의 반작용: 몸통에 대한 각운동량(두 스텝 평균)이 바뀐 빠르기 = (L[n] − L[n−2]) ÷ 2 dt (한 번 더 거름 · LEGS.armMax 안 — 칼이 부딪혀 한 스텝에 튀는 몫은 다리가 따라 내지 않는다)
    {
      const L = this.armMomentum(_L, wRaw);
      if (this.armOk && this.armOk2 && f.lastDt > 0) {
        _t.subVectors(L, this.armL2).multiplyScalar(-0.5 / f.lastDt);
        const tl = _t.length();
        if (tl > LEGS.armMax) _t.multiplyScalar(LEGS.armMax / tl);
        this.armM.lerp(_t, LEGS.armBlend);
      } else this.armM.set(0, 0, 0);
      this.armOk2 = this.armOk;
      this.armL2.copy(this.armL);
      this.armL.copy(L);
      this.armOk = true;
    }
    const r = pel.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    const up = _a.set(0, 1, 0).applyQuaternion(_q);
    const sinT = Math.hypot(up.x, up.z);
    const ang = Math.atan2(sinT, up.y);
    const kT = sinT > 1e-6 ? (Math.min(ang, LEGS.tiltErrMax) / sinT) * LEGS.tiltK : 0;
    // 위 축을 수직으로 돌리는 회전 벡터 = up × (0,1,0) = (−up.z, 0, up.x). 되먹임 몫은 tiltMax 안 — 그 위에 반작용 맞받기(내딛는 다리 · 칼 팔)를 얹는다
    let Mx = kT * -up.z - LEGS.tiltD * wT.x;
    let Mz = kT * up.x - LEGS.tiltD * wT.z;
    {
      const ml = Math.hypot(Mx, Mz);
      if (ml > LEGS.tiltMax) { Mx *= LEGS.tiltMax / ml; Mz *= LEGS.tiltMax / ml; }
    }
    const ax = _b.set(1, 0, 0).applyQuaternion(_q);
    const psi = Math.hypot(ax.x, ax.z) > 0.3 ? Math.atan2(-ax.z, ax.x) : it.yaw;
    // yaw: 땅이 줄 수 있는 수직축 토크는 작다 — 한 발 디딤은 발바닥 비틀기(μ · N · twistArm ≈ 26 N·m), 두 발 디딤은 두 발 수평 힘 짝(고르게 실렸을 때 90 N·m 쯤).
    //  오차에 비례한 토크를 상한으로 자르면 늘 상한에 걸려 멈출 때를 놓친다(잰 값: 90° 돌아서기에서 요구가 ± yawMax 에 붙은 채 35° 넘는 오차가 남음).
    //  그래서 '지금 오차에서 멈출 수 있는 가장 빠른 도는 빠르기' ω* = min(yawK ÷ yawD · |e| , √(2 · yawDecel · |e|)) 를 따라간다.
    //  한 발로 선 동안은 무르게(yawKs · yawDs): 걷는 두 다리는 엇갈리며 수직축 각운동량을 걸음마다 주고받고 윗몸은 그 반대로 몇 도 돈다 — 그 흔들림(걸음 박자)을 발바닥 비틀기로 되잡으려 들면 키운다.
    //  두 발이 다 실린 동안은 두 발 힘 짝으로 세게(yawK · yawD) — 돌아서기 · 베기 받기는 거기서 한다
    const eY = wrap(it.yaw - psi);
    const kY = on.length === 2 ? LEGS.yawK : LEGS.yawKs, dY = on.length === 2 ? LEGS.yawD : LEGS.yawDs;
    const wY = Math.sign(eY) * Math.min((kY / dY) * Math.abs(eY), Math.sqrt(2 * LEGS.yawDecel * Math.abs(eY)));
    let My = clamp(dY * (wY + it.yawRate - wT.y), -LEGS.yawMax, LEGS.yawMax);
    // 반작용 맞받기: 내딛는 다리를 이끄는 토크 쌍 · 팔과 칼을 휘두르는 근육 쌍이 윗몸에 거는 모멘트만큼 딛은 다리가 거꾸로 낸다 (딛은 엉덩이 토크 = −몸통 되먹임 − 내딛는 엉덩이 토크)
    Mx -= (this.swM.x + this.armM.x) * LEGS.reactFF;
    Mz -= (this.swM.z + this.armM.z) * LEGS.reactFF;
    My -= (this.swM.y + this.armM.y) * LEGS.reactFF;
    const d = this.dbg;
    d.n++;
    d.on = on.length;
    if (!on.length) { d.N = d.Fx = d.Fz = 0; return; } // 딛은 발이 없다 — 낼 힘이 없다. '못 낸 나머지'도 0 으로 둔다(위에서 0): 땅에 닿은 발이 없으면 땅이 줄 토크도 없으니 밖에서 메울 몫이 없다 — 뜬 몸은 중력만 받는다 (넷째 판 · 선임 결정 §4-1)
    // 땅을 찾는 발: 아래로 누르는 힘만 (전체 수직 힘에서 뺌)
    for (const L of soft) {
      const ns = LEGS.shareMin * N;
      N -= ns;
      L.c.copy(L.sole);
      L.Gx = L.Gz = L.ny = 0;
      L.Gy = ns;
    }
    // ── 2) 압력 중심 ──
    const gy0 = on.length === 2 ? (on[0].sole.y + on[1].sole.y) * 0.5 : on[0].sole.y;
    const h = Math.max(0.3, com.y - gy0);
    const hT = Math.max(0.5, xT.y - gy0); // 수평 땅 반력이 윗몸을 돌리는 팔 길이 (윗몸 질량중심 높이)
    // 받침 다각형 = 딛은 발바닥(압력 중심이 갈 수 있는 범위)의 볼록 껍질.
    //  땅 반력(수직 N · 수평 F)과 몸통 토크 M 을 함께 내는 압력 중심 p* = 무게중심 밑 + (M_z − hT F_x) / N , −(M_x + hT F_z) / N.
    //  p* 가 다각형 밖이면 가장 가까운 가장자리 점에 두고, 그 점에서 M 을 그대로 내는 수평 힘을 다시 센다 — 몸통 토크는 줄이지 않고 수평 힘이 물러선다(몸통 먼저).
    let m = LEGS.copMargin;
    const hull = () => {
      let np = 0;
      for (const L of on) {
        const e = LEGS.copMargin - m; // 여유를 줄인 만큼 앞뒤 범위도 넓힘
        for (let i = 0; i < 4; i++) {
          const a = i < 2 ? L.aMin - e : L.aMax + e, b = (i === 0 || i === 3 ? -1 : 1) * (FOOT_HZ - m);
          _px[np] = L.sole.x + L.fx.x * a + L.fz.x * b;
          _pz[np++] = L.sole.z + L.fx.z * a + L.fz.z * b;
        }
      }
      return hullOf(np);
    };
    let nh = hull();
    const w0 = (this.w0 = Math.sqrt(G / hT)); // 이 구동 아래 몸이 넘어가는 빠르기: 수평 가속 = (g ÷ hT) · (무게중심 − 압력 중심) (몸통 토크 0 일 때)
    // 캡처 점(무게중심 + 속도 ÷ ω)이 받침 밖이면 가장자리 여유까지 쓰고, 그래도 밖이면 그 거리를 적는다 (걸음이 읽어 받아 딛는다)
    let capDist = 0;
    {
      const ax0 = com.x + cv.x / w0, az0 = com.z + cv.z / w0;
      if (!inHull(nh, ax0, az0)) {
        m = LEGS.copEdge;
        nh = hull();
        if (!inHull(nh, ax0, az0)) {
          nearHull(nh, ax0, az0);
          capDist = Math.hypot(ax0 - _near.x, az0 - _near.z);
        }
      }
    }
    this.capDist = capDist;
    const px = com.x + (Mz - hT * Fx) / N, pz = com.z - (Mx + hT * Fz) / N;
    let qx = px, qz = pz;
    if (!inHull(nh, px, pz)) {
      nearHull(nh, px, pz);
      qx = _near.x;
      qz = _near.z;
      d.clipN++;
    }

    d.clipped = Math.hypot(qx - px, qz - pz);
    // 발마다: 두 발이면 두 발 가운데를 잇는 선 위의 몫 t + 발마다 같은 어긋남(발 범위 안으로), 한 발이면 그 발 안.
    //  땅에 닿은 디딘 발은 하중을 LEGS.shareMin 몫 밑으로 비우지 않는다 — 관절 모터가 다리 길이 쪽으로 버티지 않으므로(gait.poseLegs) 하중 0 인 다리는 흐느적거려 발이 끌린다
    const local = (L, ox, oz) => {
      // 발바닥 가운데에서 (ox, oz) 만큼 떨어진 점을 발 범위 안으로 → L.c (월드 · 발바닥 면 위)
      const a = clamp(ox * L.hx + oz * L.hz, L.aMin - (LEGS.copMargin - m), L.aMax + (LEGS.copMargin - m));
      const b = clamp(ox * L.lx + oz * L.lz, -(FOOT_HZ - m), FOOT_HZ - m);
      L.c.copy(L.sole).addScaledVector(L.fx, a).addScaledVector(L.fz, b);
    };
    let wA = 1; // on[0] 의 하중 몫
    if (on.length === 2) {
      const A = on[0], B = on[1];
      const Dx = A.sole.x - B.sole.x, Dz = A.sole.z - B.sole.z;
      const D2 = Dx * Dx + Dz * Dz;
      wA = D2 > 1e-6 ? clamp(((qx - B.sole.x) * Dx + (qz - B.sole.z) * Dz) / D2, LEGS.shareMin, 1 - LEGS.shareMin) : 0.5;
      const bx = B.sole.x + wA * Dx, bz = B.sole.z + wA * Dz;
      local(A, qx - bx, qz - bz);
      local(B, qx - bx, qz - bz);
    } else local(on[0], qx - on[0].sole.x, qz - on[0].sole.z);
    const cx = on.length === 2 ? wA * on[0].c.x + (1 - wA) * on[1].c.x : on[0].c.x;
    const cz = on.length === 2 ? wA * on[0].c.z + (1 - wA) * on[1].c.z : on[0].c.z;
    this.cop.set(cx, gy0, cz);
    this.copOk = true;
    // 칼 팔 반작용 맞받기(−armM)의 기울기 몫 가운데 압력 중심으로 낼 수 없는 몫 (hx · hz):
    //  그 몫은 다리 일이 아니라 (아직 물리가 아닌) 칼 구동이 몸통에 건 것이다. 압력 중심이 받침 안에서 옮겨 낼 수 있는 데까지만 발이 내고, 받침 밖으로 나가야 낼 수 있는 몫은
    //  수평 힘으로 바꿔 무게중심을 밀지 않고 '못 낸 나머지'로 남긴다(AID.tiltMax 안 — Fighter.driveAid 가 골반에 밖 토크로 건다). 그 상한을 넘는 몫과
    //  다리 제 몫(자세 되먹임 · 내딛는 다리 반작용 · 가려는 속도)은 예전 그대로 수평 힘이 물러선다(몸통 먼저).
    //  셈: 칼 팔 몫을 뺀 압력 중심 p1 을 받침 안으로 자른 점에서 칼 팔 몫만큼 옮긴 점 p2 — 그 점이 받침 밖으로 나간 거리 × N. 칼 팔 몫이 받침 안쪽으로 당기거나 가장자리를 따라 옮기면 0.
    let hx = 0, hz = 0;
    {
      const aX = -this.armM.x * LEGS.reactFF, aZ = -this.armM.z * LEGS.reactFF;
      let x1 = px - aZ / N, z1 = pz + aX / N;
      if (!inHull(nh, x1, z1)) { nearHull(nh, x1, z1); x1 = _near.x; z1 = _near.z; }
      const x2 = x1 + aZ / N, z2 = z1 - aX / N;
      if (!inHull(nh, x2, z2)) {
        nearHull(nh, x2, z2);
        hx = -N * (z2 - _near.z);
        hz = N * (x2 - _near.x);
        const hl = Math.hypot(hx, hz);
        if (hl > AID.tiltMax) { hx *= AID.tiltMax / hl; hz *= AID.tiltMax / hl; }
      }
    }
    // 실제 압력 중심에서 몸통 토크(위의 칼 팔 몫을 뺀 것)를 그대로 내는 수평 힘 (자르지 않았으면 바라던 값 그대로)
    Fx = (Mz - hz - (cx - com.x) * N) / hT;
    Fz = -(Mx - hx + (cz - com.z) * N) / hT;
    // 마찰 원뿔 (전체)
    const mu = LEGS.mu;
    {
      const fh = Math.hypot(Fx, Fz);
      if (fh > mu * N) { Fx *= (mu * N) / fh; Fz *= (mu * N) / fh; d.slipN++; }
    }
    d.N = N; d.Fx = Fx; d.Fz = Fz; d.Mx = Mx; d.My = My; d.Mz = Mz;
    // ── 3) 발마다 ──
    if (on.length === 2) {
      const A = on[0], B = on[1];
      const NA = N * wA, NB = N * (1 - wA);
      const Dx = A.c.x - B.c.x, Dz = A.c.z - B.c.z;
      const Lf = Math.hypot(Dx, Dz) || 1e-6;
      const ux = Dx / Lf, uz = Dz / Lf;
      let Ax = Fx * wA, Az = Fz * wA, Bx = Fx * (1 - wA), Bz = Fz * (1 - wA);
      // 서로 버티는 몫: 두 발이 바깥으로 땅을 밀어(땅은 안으로 되밀어) 땅 반력이 엉덩이 관절 쪽을 지나게 → 엉덩이 · 무릎 토크가 준다
      {
        const hA = Math.max(0.2, A.ph.y - A.c.y), hB = Math.max(0.2, B.ph.y - B.c.y);
        const aA = (A.c.x - A.ph.x) * ux + (A.c.z - A.ph.z) * uz, aB = (B.c.x - B.ph.x) * ux + (B.c.z - B.ph.z) * uz;
        const fA = Ax * ux + Az * uz, fB = Bx * ux + Bz * uz;
        // 최소 제곱: Σ (a_i N_i + h_i (f_i + σ_i s))² , σ_A = −1 , σ_B = +1
        let s = (hA * (aA * NA + hA * fA) - hB * (aB * NB + hB * fB)) / (hA * hA + hB * hB);
        s = clamp(s * LEGS.brace, 0, 0.3 * mu * Math.min(NA, NB));
        Ax -= ux * s; Az -= uz * s; Bx += ux * s; Bz += uz * s;
      }
      // yaw: 이미 생기는 몫 [(p − c) × F]_y 를 빼고, 나머지를 두 발의 수평 힘 짝(선에 수직)으로 — 모자라면 발바닥 비틀기
      const have = (cz - com.z) * Fx - (cx - com.x) * Fz;
      let need = My - have;
      const iMax = 0.6 * mu * Math.min(NA, NB);
      const I = clamp(need / Lf, -iMax, iMax);
      // 짝: A 에 +I e , B 에 −I e , e = (uz, −ux) → yaw 모멘트 = I · Lf
      Ax += uz * I; Az -= ux * I; Bx -= uz * I; Bz += ux * I;
      need -= I * Lf;
      const nA = clamp(need * wA, -mu * NA * LEGS.twistArm, mu * NA * LEGS.twistArm);
      const nB = clamp(need * (1 - wA), -mu * NB * LEGS.twistArm, mu * NB * LEGS.twistArm);
      // 발마다 마찰 원뿔
      //  (하중은 바라는 값과 지난 스텝에 잰 값 가운데 작은 쪽으로 — 아직 덜 실린 발을 수평으로 밀면 미끄러진다)
      const cone = (x, z, n) => { const fh = Math.hypot(x, z); return fh > mu * n ? (mu * n) / fh : 1; };
      const sA = cone(Ax, Az, Math.min(NA, 1.3 * (gait.legs[A.k].N || 0) + 20)), sB = cone(Bx, Bz, Math.min(NB, 1.3 * (gait.legs[B.k].N || 0) + 20));
      A.Gx = Ax * sA; A.Gy = NA; A.Gz = Az * sA; A.ny = nA;
      B.Gx = Bx * sB; B.Gy = NB; B.Gz = Bz * sB; B.ny = nB;
      // 발이 '줄 수 있는' 수평 힘 (아래 못 낸 나머지 셈만 읽는다): 그 발이 이 스텝에 받기로 한 하중의 마찰 원뿔(μ · N) 안.
      //  위의 '지난 스텝 하중 × 1.3 + 20' 으로 줄인 몫은 제어가 미끄러질까 봐 스스로 덜 민 것(조심)이지 발이 못 내는 것이 아니다 — 그 차는 나머지에 넣지 않는다(밖 도움으로 흘러 나가지 않는다 · 넷째 판 · 선임 결정 §4-6)
      const cA = cone(Ax, Az, NA), cB = cone(Bx, Bz, NB);
      A.Cx = Ax * cA; A.Cz = Az * cA;
      B.Cx = Bx * cB; B.Cz = Bz * cB;
    } else {
      const A = on[0];
      const have = (cz - com.z) * Fx - (cx - com.x) * Fz;
      A.Gx = Fx; A.Gy = N; A.Gz = Fz;
      A.Cx = Fx; A.Cz = Fz;
      A.ny = clamp(My - have, -mu * N * LEGS.twistArm, mu * N * LEGS.twistArm);
    }
    // ── 못 낸 나머지 (this.rem) = 바란 몸통 토크 (Mx, My, Mz) − 딛은 발들이 받기로 한 땅 반력이 주는 토크 (기준 점 = 무게중심 위 hT — 위 2) 의 압력 중심 식과 같은 점) ──
    //  발이 바란 것을 다 낼 수 있으면 정확히 0 이다. 0 이 아니게 되는 곳:
    //   yaw — 두 발 수평 힘 짝의 한도(0.6 μ min N) · 발바닥 비틀기 한도(μ N twistArm) · 발마다 마찰 원뿔(받기로 한 하중 μ · N) · 한 발 디딤(비틀기뿐)
    //   기울기 — 전체 마찰 원뿔 · 발마다 마찰 원뿔(받기로 한 하중 μ · N)에 줄어든 수평 힘의 몫 · 위에서 남긴 칼 팔 몫(hx · hz)
    //  세지 않는 것: 관절 토크 한도에 잘린 몫(legTorques — 근력 한도는 밖에서 채우지 않는다 · this.lostHip 로 재기만) · 땅을 찾는 발(soft)이 누르는 힘의 모멘트 ·
    //   압력 중심이 잘려 수평 힘이 물러선 몫 가운데 다리 제 몫(걷기는 그 수평 힘으로 넘어가며 다음 발로 받는다 — 밖에서 채우면 걷기 받침이 된다) ·
    //   제어의 조심(덜 실린 발의 마찰 원뿔을 지난 스텝 하중으로 줄인 몫 — 발이 줄 수 있는 힘 L.Cx · L.Cz 로 센다) · 딛은 발 없음(나머지 0 — 뜬 몸은 중력만)
    {
      let rx = Mx, ry = My, rz = Mz;
      for (const L of on) {
        const ax = L.c.x - com.x, az = L.c.z - com.z;
        rx -= -hT * L.Cz - az * L.Gy;
        ry -= az * L.Cx - ax * L.Cz + L.ny;
        rz -= ax * L.Gy + hT * L.Cx;
      }
      this.rem.set(rx, ry, rz);
    }
    // ── 4) 관절 토크 ──
    for (const L of on) this.legTorques(L, L.c, L.Gx, L.Gy, L.Gz, L.ny, true, this.strengthOf(L.k), true);
    for (const L of soft) this.legTorques(L, L.c, 0, L.Gy, 0, 0, true, this.strengthOf(L.k), true);
  }

  /** 관절 토크 장부 요약: 관절마다 평균 · 95 % · 최고 (N·m) · 한도에 닿은 스텝 몫 */
  summary() {
    const out = {};
    for (const k of ['F', 'B']) {
      for (const j of NAMES) {
        const s = this.legs[k].stat[j];
        let acc = 0, p95 = 0;
        for (let i = 0; i < 100; i++) { acc += s.hist[i]; if (acc >= 0.95 * s.n) { p95 = (i + 1) * 5; break; } }
        out[j + k] = { n: s.n, mean: s.n ? +(s.sum / s.n).toFixed(1) : 0, p95, peak: +s.peak.toFixed(1), satShare: s.n ? +(s.sat / s.n).toFixed(4) : 0 };
      }
    }
    out.steps = this.dbg.n;
    out.copClipShare = this.dbg.n ? +(this.dbg.clipN / this.dbg.n).toFixed(4) : 0;
    out.frictionClipShare = this.dbg.n ? +(this.dbg.slipN / this.dbg.n).toFixed(4) : 0;
    return out;
  }

  resetStats() {
    for (const k of ['F', 'B']) for (const j of NAMES) this.legs[k].stat[j] = mkStat();
    this.dbg.n = this.dbg.clipN = this.dbg.slipN = 0;
  }
}
