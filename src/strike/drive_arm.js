// ─────────────────────────────────────────────────────────────
//  R2 팔 (docs/strike/r2_impl_spec.md §6, W4): ClipDrive 에 붙이는 팔 몫 (mixin).
//   손 목표 = 명령 가슴 틀의 클립 손 (잰 가슴이 아님: 손 → 어깨 반작용 → 가슴 → 손 고리를 끊는다), 칼끝 겨눔 slerp, wAim 은 클립 빠르기 두 몫,
//   겨눔 휘기(warp, 도움 손잡이 ≤ warpMax), 팔꿈치 pole 이력, 순수 solveArmIK (φB, φB ± Δφ 세 번 → ω_des·α_des), 모터 빠르기 15/20 → 40·S,
//   함께 힘주기(어깨 휘두름·팔꿈치, 비틀기 축은 안 함), 팔 앞먹임 회전력 (Hill 한도 앞에 더한다 — 한도는 원래 있던 것 하나뿐)
//  S = 0 이면 어떤 고리도 불리지 않는다 (fighter.js 가 drive.w > 0 로 막는다). rateLim(15) = 15 + 25·0, cocontract() = 1 + 0.5·0
//  상한·바닥 없음: 새 자르기는 rateLim 의 S 비례 빠르기 하나. warp 길이 자르기는 warp 벡터에만 (도움 크기), 손 닿음 자르기는 센다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { DRIVE, COMMIT } from '../config.js';
import { ClipDrive } from './drive.js';
import { makeSample, CH, chestFrame, m3apply, D2R } from './atlas.js';

const clamp = THREE.MathUtils.clamp;
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
/** 덧씌움 봉투 (skill.js env 와 같은 식): a → b 오름, c 까지 버팀, d 에서 0 */
const env = (u, a, b, c, d) => (u <= a ? 0 : u < b ? sj((u - a) / (b - a)) : u <= c ? 1 : u < d ? 1 - sj((u - c) / (d - c)) : 0);
const PHI_R = 0.55, PHI_C = 0.85, PHI_F = 1.6, PHI_G = 2.2; // clip/2 위상 마디 (§4.2)

// ───────── 순수 두 마디 IK (오늘 armIK 와 같은 셈·차례: S = 0 에서 비트까지 같다) ─────────
const _sD = new THREE.Vector3();
const _sP = new THREE.Vector3();
const _sU = new THREE.Vector3();
const _sX = new THREE.Vector3();
const _sF = new THREE.Vector3();
const _sT = new THREE.Vector3();
const _sM = new THREE.Matrix4();
export function makeArmOut() {
  return { qUarm: new THREE.Quaternion(), flex: 0, elbow: new Float64Array(3), hand: new Float64Array(3), d: 0, len: 0, clamped: false };
}
/**
 * solveArmIK(T_chest, S_sh, pole_chest, out[, a, b]) — 부작용 없음. 가슴 틀 손 목표 T, 어깨 S, 팔꿈치 pole (정규화된 것).
 *  out: qUarm (위팔 목표, 가슴 기준), flex (팔꿈치), elbow·hand (가슴 틀), d (쓴 거리), len (원래 거리), clamped (d ≠ len)
 */
export function solveArmIK(T, Ssh, pole, out, a = 0.3, b = 0.27) {
  const D = _sD.copy(T).sub(Ssh);
  const len = D.length();
  const d = clamp(len, 0.08, a + b - 0.005);
  const Dn = D.normalize();
  const pDir = _sP.copy(pole).addScaledVector(Dn, -pole.dot(Dn));
  if (pDir.lengthSq() < 1e-6) pDir.set(0, -1, 0);
  pDir.normalize();
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const u = _sU.copy(Dn).multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha)); // 위팔 방향
  const flex = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  // 위팔 몸체 좌표축: x = 위팔 방향, y = 아래팔이 접히는 쪽, z = x × y (팔꿈치 경첩 축)
  const xA = _sX.copy(u);
  const fore = _sF.copy(Dn).multiplyScalar(d).sub(_sT.copy(u).multiplyScalar(a)); // 팔꿈치 → 손
  const yA = fore.addScaledVector(u, -fore.dot(u));
  if (yA.lengthSq() < 1e-6) yA.set(0, 1, 0).addScaledVector(u, -u.y);
  yA.normalize();
  const zA = _sT.crossVectors(xA, yA).normalize();
  _sM.makeBasis(xA, yA, zA);
  out.qUarm.setFromRotationMatrix(_sM);
  out.flex = flex;
  out.d = d;
  out.len = len;
  out.clamped = d !== len;
  out.elbow[0] = Ssh.x + u.x * a;
  out.elbow[1] = Ssh.y + u.y * a;
  out.elbow[2] = Ssh.z + u.z * a;
  out.hand[0] = Ssh.x + Dn.x * d;
  out.hand[1] = Ssh.y + Dn.y * d;
  out.hand[2] = Ssh.z + Dn.z * d;
  return out;
}
/** 팔꿈치 굽힘 (solveArmIK 와 같은 식) */
export const flexOf = (a, b, d) => Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
const _rch = { Dn: new THREE.Vector3(), flex: 0 };
/** pole 고리 앞에: 어깨 → 손 방향 Dn 과 굽힘 (solveArmIK 와 같은 식, 결과에 영향 없음) */
export function armReach(T, Ssh, a = 0.3, b = 0.27) {
  const D = _rch.Dn.copy(T).sub(Ssh);
  const d = clamp(D.length(), 0.08, a + b - 0.005);
  D.normalize();
  _rch.flex = flexOf(a, b, d);
  return _rch;
}

// ───────── 작은 도우미 (할당 없음) ─────────
const _q = new THREE.Quaternion(); // 명령 가슴 틀 (바라보는 틀)
const _qR = new THREE.Quaternion(); // 실제 가슴 (월드)
const _qI = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _p = new THREE.Vector3();
const _a3 = new Float64Array(3);
const _b3 = new Float64Array(3);
const _anc = { x: 0, y: 0, z: 0 };
const qCmd = (cmd) => _q.set(cmd.qChestCmd[0], cmd.qChestCmd[1], cmd.qChestCmd[2], cmd.qChestCmd[3]);
const setQ = (o, r) => o.set(r.x, r.y, r.z, r.w);
/** 쿼터니언 → 회전 벡터 (fighter.js toRotVec 과 같은 규칙) */
function rotVec(q, out) {
  const w = Math.min(1, Math.abs(q.w));
  const sgn = q.w < 0 ? -1 : 1;
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-6) return out.set(0, 0, 0);
  return out.set(q.x, q.y, q.z).multiplyScalar((sgn * 2 * Math.acos(w)) / s);
}
/** 몸 틀 관성 텐서 (질량 중심, 9칸 행 우선) — drive.js 와 같은 식 */
function localTensor(rb, out) {
  const p = rb.principalInertia();
  const q = rb.principalInertiaLocalFrame();
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const R0 = 1 - 2 * (y * y + z * z), R1 = 2 * (x * y - w * z), R2 = 2 * (x * z + w * y);
  const R3 = 2 * (x * y + w * z), R4 = 1 - 2 * (x * x + z * z), R5 = 2 * (y * z - w * x);
  const R6 = 2 * (x * z - w * y), R7 = 2 * (y * z + w * x), R8 = 1 - 2 * (x * x + y * y);
  const R = [R0, R1, R2, R3, R4, R5, R6, R7, R8], P = [p.x, p.y, p.z];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = R[i * 3] * P[0] * R[j * 3] + R[i * 3 + 1] * P[1] * R[j * 3 + 1] + R[i * 3 + 2] * P[2] * R[j * 3 + 2];
  return out;
}
/** 월드 관성 (점 p 둘레) 을 I 에 더한다: R·Iloc·Rᵀ + m(|r|²E − r rᵀ) */
function addInertia(I, e, p) {
  const rb = e.rb, q = rb.rotation(), c = rb.worldCom(), m = e.m, L = e.I;
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const R0 = 1 - 2 * (y * y + z * z), R1 = 2 * (x * y - w * z), R2 = 2 * (x * z + w * y);
  const R3 = 2 * (x * y + w * z), R4 = 1 - 2 * (x * x + z * z), R5 = 2 * (y * z - w * x);
  const R6 = 2 * (x * z - w * y), R7 = 2 * (y * z + w * x), R8 = 1 - 2 * (x * x + y * y);
  // A = R·L
  const A0 = R0 * L[0] + R1 * L[3] + R2 * L[6], A1 = R0 * L[1] + R1 * L[4] + R2 * L[7], A2 = R0 * L[2] + R1 * L[5] + R2 * L[8];
  const A3 = R3 * L[0] + R4 * L[3] + R5 * L[6], A4 = R3 * L[1] + R4 * L[4] + R5 * L[7], A5 = R3 * L[2] + R4 * L[5] + R5 * L[8];
  const A6 = R6 * L[0] + R7 * L[3] + R8 * L[6], A7 = R6 * L[1] + R7 * L[4] + R8 * L[7], A8 = R6 * L[2] + R7 * L[5] + R8 * L[8];
  const rx = c.x - p.x, ry = c.y - p.y, rz = c.z - p.z, r2 = rx * rx + ry * ry + rz * rz;
  I[0] += A0 * R0 + A1 * R1 + A2 * R2 + m * (r2 - rx * rx);
  I[1] += A0 * R3 + A1 * R4 + A2 * R5 - m * rx * ry;
  I[2] += A0 * R6 + A1 * R7 + A2 * R8 - m * rx * rz;
  I[3] += A3 * R0 + A4 * R1 + A5 * R2 - m * ry * rx;
  I[4] += A3 * R3 + A4 * R4 + A5 * R5 + m * (r2 - ry * ry);
  I[5] += A3 * R6 + A4 * R7 + A5 * R8 - m * ry * rz;
  I[6] += A6 * R0 + A7 * R1 + A8 * R2 - m * rz * rx;
  I[7] += A6 * R3 + A7 * R4 + A8 * R5 - m * rz * ry;
  I[8] += A6 * R6 + A7 * R7 + A8 * R8 + m * (r2 - rz * rz);
  // 세로 각운동량 몫 (점 p 둘레, 절대 속도): (m r × v)_y + (R·L·Rᵀ·ω)_y
  const v = rb.linvel(), om = rb.angvel();
  const Iw3 = A3 * R0 + A4 * R1 + A5 * R2, Iw4 = A3 * R3 + A4 * R4 + A5 * R5, Iw5 = A3 * R6 + A4 * R7 + A5 * R8;
  return m * (rz * v.x - rx * v.z) + Iw3 * om.x + Iw4 * om.y + Iw5 * om.z;
}
/** 몸의 한 점 (몸 틀 a) → 월드 */
function bodyPoint(rb, a, o) {
  const q = rb.rotation(), t = rb.translation();
  return o.set(a.x, a.y, a.z).applyQuaternion(setQ(_qI, q)).add(_p.set(t.x, t.y, t.z));
}
/** Dn 에 수직인 두 단위 벡터 a → b 를 Dn 둘레로 u 만큼 (마주봄도 된다) */
function turnAbout(a, b, Dn, u, o) {
  const th = Math.atan2(_z.crossVectors(a, b).dot(Dn), a.dot(b)) * u;
  const c = Math.cos(th), s = Math.sin(th);
  _z.crossVectors(Dn, a);
  return o.copy(a).multiplyScalar(c).addScaledVector(_z, s);
}

function makePole() {
  return { prev: new THREE.Vector3(), from: new THREE.Vector3(), last: -1, candT: 0, blend: -1 };
}
function makeArm(dr) {
  const f = dr.f, J = f.jointByName;
  const a2 = (j) => {
    const a = j.joint.anchor2();
    return { x: a.x, y: a.y, z: a.z };
  };
  const a1 = (j) => {
    const a = j.joint.anchor1();
    return { x: a.x, y: a.y, z: a.z };
  };
  const body = (rb) => ({ rb, m: rb.mass(), I: localTensor(rb, new Float64Array(9)) });
  // 새 debug 칸 (drive.debug 에 한 번 붙인다)
  const d = dr.debug;
  for (const k of ['elbowRateErr', 'elbowRateDes', 'elbowRateCmd', 'elbowRateMeas', 'ffArm', 'ffElbow', 'ffCapArm', 'I_arm', 'I_fore', 'omegaDes', 'alphaDes', 'poleHold', 'poleFlipS', 'poleFlipO', 'poleJump', 'poleJumpDeg', 'poleJumpMaxS', 'poleJumpMaxO', 'alphaKink', 'warpK', 'girdle']) d[k] ??= 0;
  return {
    tDes: -1, // ω_des 가 이번 스텝 것인지 (드라이브 시계 도장)
    omegaDes: new THREE.Vector3(), alphaDes: new THREE.Vector3(), wFlex: 0, aFlex: 0,
    Tp: new THREE.Vector3(), Tm: new THREE.Vector3(), outP: makeArmOut(), outM: makeArmOut(),
    poles: [makePole(), makePole()],
    Ac: makeSample(), rq: { cut: '', side: 'right', phi: 0, S: 0, over: 0, cutB: null, wAB: 0 }, M: new Float64Array(9),
    cutSeen: -2, fadeT0: -1, rcT: -1,
    I: new Float64Array(9),
    uarm: body(f.bodies.uarmS), farm: body(f.bodies.farmS), sw: { rb: null, m: 0, I: new Float64Array(9) },
    shA: a2(J.uarmS), elA: a2(J.farmS),
    g: { base: [a1(J.uarmS), a1(J.uarmO)], off: [new Float64Array(2), new Float64Array(2)], j: [J.uarmS.joint, J.uarmO.joint], touched: false },
  };
}

const ArmMixin = {
  /** 팔 상태 (처음 쓸 때 한 번 만든다) */
  get arm() {
    return (this._arm ??= makeArm(this));
  },
  /** 모터 목표 빠르기 한도 base → top 을 S 만큼 (15 → 40, 어깨 wT 20 → shoulderRate 40). S = 0 이면 base 그대로 */
  rateLim(base, top = DRIVE.motorRate) {
    return base + (top - base) * this._w;
  },
  /** 함께 힘주기 배율 1 + cocontract·S (어깨 휘두름·팔꿈치만) */
  cocontract() {
    return 1 + DRIVE.cocontract * this._w;
  },
  /** 이번 스텝의 ω_des 가 있나 (armIK 가 풀었나) */
  armValid() {
    return this._arm !== undefined && this._arm.tDes === this.t;
  },
  /** 팔꿈치 굽힘 빠르기 ω_des_flex (rad/s) */
  omegaFlex() {
    return this._arm.wFlex;
  },
  /** 올린 빠르기 한도가 이번 스텝에도 물었다 (스텝마다 한 번 센다) */
  noteRateClip() {
    const st = this.arm;
    if (st.rcT === this.t) return;
    st.rcT = this.t;
    this.stats.rateClip++;
    this.debug.rateClip++;
  },
  /** 팔 앞먹임이 든 뒤 Hill 한도가 물었다 */
  noteFfCap() {
    this.stats.ffCap++;
    this.debug.ffCap++;
    this.debug.ffCapArm++; // 팔 몫만 (몸통 몫과 같은 ffCap 에도 센다)
  },
  /** 섞지 않고 한 스텝에 돈 pole 각 (보고만, 도는 것은 안 바꾼다): 이번 각·팔마다 가장 큰 각, poleHystDeg/2 넘으면 센다 */
  notePoleJump(deg, arm) {
    const d = this.debug;
    d.poleJumpDeg = deg;
    if (arm) {
      if (deg > d.poleJumpMaxO) d.poleJumpMaxO = deg;
    } else if (deg > d.poleJumpMaxS) d.poleJumpMaxS = deg;
    if (deg > 0.5 * DRIVE.poleHystDeg) d.poleJump++;
  },
  /** 팔꿈치 모터 목표 빠르기 기록: vz (모터에 넘긴 값), 잰 경첩 빠르기 */
  noteElbow(vz, meas) {
    const d = this.debug, st = this._arm;
    d.elbowRateCmd = vz;
    d.elbowRateMeas = meas;
    d.elbowRateDes = st ? st.wFlex : 0;
    d.elbowRateErr = vz - d.elbowRateDes;
  },

  // ───────── §6.1 손 목표 ─────────
  /** handLocal (바라보는 틀, 가슴 원점) += (Qc_cmd·(handS + warp) − handLocal)·c */
  mixHand(handLocal) {
    if (!DRIVE.hands) return; // 켜는 차례 (팔 끔)
    this.aimWarp();
    const cmd = this.cmd, c = this._c, hs = cmd.handS, wp = cmd.warp;
    _v.set(hs[0] + wp[0], hs[1] + wp[1], hs[2] + wp[2]).applyQuaternion(qCmd(cmd));
    handLocal.x += (_v.x - handLocal.x) * c;
    handLocal.y += (_v.y - handLocal.y) * c;
    handLocal.z += (_v.z - handLocal.z) * c;
    // 기록: 명령 손 (월드) · 실제 손목점 (farmS (0.13, 0, 0)) · 차이
    const f = this.f, d = this.debug, ct = f.bodies.chest.translation();
    _w.copy(handLocal).applyQuaternion(f.yaw);
    d.handCmdW[0] = _w.x + ct.x;
    d.handCmdW[1] = _w.y + ct.y;
    d.handCmdW[2] = _w.z + ct.z;
    _anc.x = 0.13;
    _anc.y = 0;
    _anc.z = 0;
    bodyPoint(f.bodies.farmS, _anc, _w);
    d.handActW[0] = _w.x;
    d.handActW[1] = _w.y;
    d.handActW[2] = _w.z;
    d.handErr = Math.hypot(d.handCmdW[0] - _w.x, d.handCmdW[1] - _w.y, d.handCmdW[2] - _w.z);
  },

  // ───────── §6.2 겨눔 ─────────
  /** aim (바라보는 틀, 단위) = slerp(aim, Qc_cmd·sword, c) */
  mixAim(aim) {
    if (!DRIVE.hands) return;
    const cmd = this.cmd, s = cmd.sword, c = this._c;
    const t = _v.set(s[0], s[1], s[2]).applyQuaternion(qCmd(cmd)).normalize();
    const dot = clamp(aim.dot(t), -1, 1);
    const th = Math.acos(dot);
    const sn = Math.sin(th);
    if (sn > 1e-6) {
      const ka = Math.sin((1 - c) * th) / sn, kb = Math.sin(c * th) / sn;
      aim.multiplyScalar(ka).addScaledVector(t, kb);
    } else if (dot < 0) {
      // 마주봄: 축이 정해지지 않는다 → 세로 축과 수직인 쪽으로 돈다
      _w.crossVectors(aim, _x.set(0, 1, 0));
      if (_w.lengthSq() < 1e-8) _w.crossVectors(aim, _x.set(1, 0, 0));
      _w.normalize();
      aim.multiplyScalar(Math.cos(c * Math.PI)).addScaledVector(_w.cross(aim), Math.sin(c * Math.PI));
    } else aim.lerp(t, c);
    aim.normalize();
    // 기록: 명령 칼끝 방향 (월드), 칼과 그 사이 각
    const f = this.f, d = this.debug;
    _w.copy(t).applyQuaternion(f.yaw);
    d.aimCmdW[0] = _w.x;
    d.aimCmdW[1] = _w.y;
    d.aimCmdW[2] = _w.z;
    if (f.sword) {
      _x.set(0, 1, 0).applyQuaternion(setQ(_qI, f.sword.rotation()));
      d.aimErrDeg = Math.acos(clamp(_x.dot(_w), -1, 1)) / D2R;
    }
  },
  /**
   * §4.3 DRIVE.edgeFromClip 고리 (기본 끔): flatTarget (월드, 단위, 이미 flat 과 부호 맞춤) = lerp(flatTarget, blade × (yaw·Qc_cmd·edge), c).
   *  edge 는 날이 향하는 쪽이라 칼 면 방향으로는 게임의 moving 몫 (mf = blade × edgeDir) 과 같은 식으로 바꾼다. moving 섞기 앞에 부른다
   */
  mixEdge(flatTarget, blade, flat) {
    if (!DRIVE.hands) return;
    const e = this.cmd.edge;
    _v.set(e[0], e[1], e[2]).applyQuaternion(qCmd(this.cmd)).applyQuaternion(this.f.yaw);
    const mf = _w.crossVectors(blade, _v);
    if (mf.lengthSq() < 1e-4) return; // 날이 칼 축과 겹침: 정해지지 않는다
    mf.normalize();
    if (mf.dot(flat) < 0) mf.negate();
    flatTarget.lerp(mf, this._c);
    if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(mf);
    flatTarget.normalize();
  },
  /** wAim (월드, 차분값) = lerp(차분, R·(swordDot·φ̇) + ω_chestCmd, c), R = yaw·Qc_cmd */
  aimRate(wAim) {
    if (!DRIVE.hands) return;
    const cmd = this.cmd, sd = cmd.swordDot, pd = cmd.phiDot, wc = cmd.wChestCmd;
    _v.set(sd[0] * pd, sd[1] * pd, sd[2] * pd).applyQuaternion(qCmd(cmd)).applyQuaternion(this.f.yaw);
    _v.x += wc[0];
    _v.y += wc[1];
    _v.z += wc[2];
    wAim.lerp(_v, this._c);
  },

  // ───────── §6.3 겨눔 휘기 (도움 손잡이) ─────────
  /** cmd.warp (명령 가슴 틀) = Qc_cmd⁻¹·clampLen((zone − hc) ⊥ sword(φc), warpMax)·env(φ)·fade. 상대 없음·창 밖 → 0 */
  aimWarp() {
    const cmd = this.cmd, st = this.arm, wp = cmd.warp, d = this.debug;
    if (st.cutSeen !== this._cutSeen) {
      st.cutSeen = this._cutSeen; // 새 획: 결과 페이드를 되돌린다
      st.fadeT0 = -1;
    }
    wp[0] = wp[1] = wp[2] = 0;
    d.warp = 0;
    d.warpK = 0;
    const foe = this.f.foe, phi = cmd.phi;
    if (!foe || !foe.bodies || !(phi > PHI_R - 0.05) || !(phi < PHI_G)) return;
    let k = env(phi, PHI_R - 0.05, PHI_C, PHI_F, PHI_G);
    if (st.fadeT0 >= 0) k *= 1 - sj((this.t - st.fadeT0) / DRIVE.warpFade);
    d.warpK = k;
    if (!(k > 0)) return;
    // 맞을 때(φc)의 손·칼 (지금 S·무리로 한 번 더 표본)
    const rq = st.rq, r0 = this._req;
    rq.cut = r0.cut;
    rq.side = r0.side;
    rq.S = r0.S;
    rq.over = r0.over;
    rq.cutB = r0.cutB;
    rq.wAB = r0.wAB;
    rq.phi = PHI_C;
    const A = st.Ac;
    this.atlas.sample(A, rq);
    const M = chestFrame(A.v[CH.chestYaw], A.v[CH.chestLean], A.v[CH.chestSide], st.M);
    m3apply(M, A.v, CH.handS, _a3, 0); // hc (바라보는 틀, 가슴 원점)
    m3apply(M, A.v, CH.sword, _b3, 0); // 칼 (φc)
    // 과녁 (월드): 내려·위 → 머리–가슴 선 planeK, 가로 → 어깨 선, 올려 → 배
    const B = foe.bodies, cut = this._cut;
    if (cut === 'mittelhau') {
      _anc.x = 0;
      _anc.y = 0.1;
      _anc.z = 0;
      bodyPoint(B.chest, _anc, _x);
    } else if (cut === 'unterhau') {
      const t = B.abdomen.translation();
      _x.set(t.x, t.y, t.z);
    } else {
      const tc = B.chest.translation(), th = B.head.translation(), k2 = COMMIT.planeK;
      _x.set(tc.x + (th.x - tc.x) * k2, tc.y + (th.y - tc.y) * k2, tc.z + (th.z - tc.z) * k2);
    }
    const ct = this.f.bodies.chest.translation();
    _x.x -= ct.x;
    _x.y -= ct.y;
    _x.z -= ct.z;
    _x.applyQuaternion(_qI.copy(this.f.yaw).invert()); // 바라보는 틀
    const s = _y.set(_b3[0], _b3[1], _b3[2]).normalize();
    const dv = _x.set(_x.x - _a3[0], _x.y - _a3[1], _x.z - _a3[2]);
    dv.addScaledVector(s, -dv.dot(s));
    const L = dv.length();
    if (L > DRIVE.warpMax) dv.multiplyScalar(DRIVE.warpMax / L); // 도움 크기 (warp 벡터에만)
    dv.multiplyScalar(k);
    d.warp = dv.length();
    dv.applyQuaternion(qCmd(cmd).invert()); // 명령 가슴 틀로
    wp[0] = dv.x;
    wp[1] = dv.y;
    wp[2] = dv.z;
  },

  // ───────── §6.4 어깨·팔꿈치 pole ─────────
  /** 어깨 뿌리 (가슴 틀 Ssh). 'off' = 그대로 (기본). 'anchor' = (prot, lift, 0)·S 를 girdleRate 로 옮기고 관절 anchor1 도 같이 */
  shoulder(Ssh, arm = 0) {
    if (DRIVE.girdle !== 'anchor') return;
    const st = this.arm, G = st.g, g = arm ? this.cmd.girdleO : this.cmd.girdleS, o = G.off[arm];
    const tx = g[1] * this._w, ty = g[0] * this._w; // girdle = [lift, prot] → (prot, lift, 0)
    const dx = tx - o[0], dy = ty - o[1], L = Math.hypot(dx, dy), mv = DRIVE.girdleRate * (this.f.lastDt || 1 / 120);
    const u = L > mv ? mv / L : 1;
    o[0] += dx * u;
    o[1] += dy * u;
    Ssh.x += o[0];
    Ssh.y += o[1];
    const b = G.base[arm];
    _anc.x = b.x + o[0];
    _anc.y = b.y + o[1];
    _anc.z = b.z;
    G.j[arm].setAnchor1(_anc);
    G.touched = true;
    this.debug.girdle = Math.hypot(G.off[0][0], G.off[0][1]);
  },
  /** 어깨띠를 썼으면 S = 0 이 된 스텝에 한 번 되돌린다 */
  girdleRestore() {
    const G = this._arm?.g;
    if (!G?.touched) return;
    for (let i = 0; i < 2; i++) {
      G.off[i][0] = G.off[i][1] = 0;
      G.j[i].setAnchor1(G.base[i]);
    }
    G.touched = false;
  },
  get girdleTouched() {
    return !!this._arm?.g.touched;
  },
  /**
   * pole (실제 가슴 틀, 단위, 오늘 기본값) → normalize(lerp(pole, R_chest⁻¹·yaw·Qc_cmd·clipPole, S)) 를 Dn 에 사영, 이력:
   *  |사영| < poleMinDir 이거나 앞 방향과 poleHystDeg 넘게 벌어지면 후보 → poleHystT 이어지고 굽힘 > poleMinFlexDeg 일 때 받아들여 poleBlendT 동안 돌린다.
   *  arm 0 = 칼 든 팔, 1 = 빈팔. 상태는 팔마다, S = 0 을 지나면 다시 잡는다
   */
  pole(pole, Dn, flex, arm = 0) {
    if (!DRIVE.hands) return;
    const st = this.arm, P = st.poles[arm], dt = this.f.lastDt || 1 / 120, cmd = this.cmd;
    if (!(P.last >= this.t - 1.5 * dt)) {
      // 새로 켜짐: 앞 스텝 (S = 0) 에 쓰던 기본 pole 의 사영에서 시작
      P.prev.copy(pole).addScaledVector(Dn, -pole.dot(Dn));
      if (P.prev.lengthSq() < 1e-6) P.prev.set(0, -1, 0);
      P.prev.normalize();
      P.candT = 0;
      P.blend = -1;
    }
    P.last = this.t;
    const src = arm ? cmd.poleO : cmd.poleS;
    _v.set(src[0], src[1], src[2]).applyQuaternion(qCmd(cmd)).applyQuaternion(this.f.yaw).applyQuaternion(setQ(_qR, this.f.bodies.chest.rotation()).invert());
    const pNew = _w.copy(pole).lerp(_v, this._w).normalize();
    const pd = pNew.addScaledVector(Dn, -pNew.dot(Dn));
    const m = pd.length();
    const prev = _x.copy(P.prev).addScaledVector(Dn, -P.prev.dot(Dn));
    if (prev.lengthSq() < 1e-12) prev.copy(m > 1e-9 ? pd : _y.set(0, -1, 0));
    prev.normalize();
    const out = _y;
    if (P.blend >= 0) {
      // 받아들인 뒤 돌리는 중: 새 방향으로
      P.blend += dt;
      const u = Math.min(1, P.blend / DRIVE.poleBlendT);
      const from = P.from.addScaledVector(Dn, -P.from.dot(Dn));
      if (from.lengthSq() < 1e-12) from.copy(prev);
      from.normalize();
      if (m > 1e-9) turnAbout(from, pd.multiplyScalar(1 / m), Dn, u, out);
      else out.copy(from);
      if (u >= 1) P.blend = -1;
    } else {
      const cand = m < DRIVE.poleMinDir || (m > 1e-9 && prev.dot(pd) / m < Math.cos(DRIVE.poleHystDeg * D2R));
      if (!cand) {
        P.candT = 0;
        out.copy(pd).multiplyScalar(1 / m);
        // 후보 아님 (또는 붙든 후보가 풀림): 섞지 않고 바로 간다 → 앞 방향과의 각을 센다 (poleFlip 과 따로)
        this.notePoleJump(Math.acos(clamp(prev.dot(out), -1, 1)) / D2R, arm);
      } else {
        P.candT += dt;
        if (P.candT >= DRIVE.poleHystT && flex > DRIVE.poleMinFlexDeg * D2R && m > 1e-9) {
          // 받아들임 (센다) → poleBlendT 동안 돌린다
          this.stats.poleFlip++;
          this.debug.poleFlip++;
          if (arm) this.debug.poleFlipO++;
          else this.debug.poleFlipS++;
          P.candT = 0;
          P.blend = 0;
          P.from.copy(prev);
        }
        out.copy(prev);
      }
    }
    this.debug.poleHold = P.candT;
    P.prev.copy(out);
    pole.copy(out);
  },

  // ───────── §6.6 ω_des·α_des (armIK 뒤, S > 0) ─────────
  /**
   * 손 닿음 자르기를 세고, 손 목표를 φB ± Δφ 로 옮겨 두 번 더 푼다 (같은 pole·어깨):
   *  T± = T + R_chest⁻¹·yaw·Qc_cmd·c·(±h′Δφ + ½h″Δφ²) (클립 손의 가슴 틀 움직임 — 가슴이 도는 몫은 몸통이 낸다)
   *  → ω_des = R_chest·rotvec(q₊q₋⁻¹)/(2Δφ)·φ̇, α_des = R_chest·(rotvec(q₊q₀⁻¹) − rotvec(q₀q₋⁻¹))/Δφ²·φ̇² + (ω/φ̇)·φ̈, 굽힘도 같이
   */
  armRates(T, Ssh, pole, o) {
    const st = this.arm, S = this.stats, d = this.debug;
    if (o.clamped) {
      S.reachClamp++;
      d.reachClamp++;
      const ov = o.len - o.d;
      if (ov > S.reachClampMax) S.reachClampMax = ov;
    }
    st.tDes = -1;
    if (!this.handOn || !DRIVE.hands) return;
    const A = this.A, cmd = this.cmd, c = this._c, h = DRIVE.ikDphi, hh = 0.5 * h * h;
    const o1 = CH.handS, d1 = A.d1, d2 = A.d2;
    setQ(_qR, this.f.bodies.chest.rotation());
    _qI.copy(_qR).invert();
    const q = qCmd(cmd), yaw = this.f.yaw;
    _v.set(d1[o1] * h * c, d1[o1 + 1] * h * c, d1[o1 + 2] * h * c).applyQuaternion(q).applyQuaternion(yaw).applyQuaternion(_qI); // 한 차 몫
    _w.set(d2[o1] * hh * c, d2[o1 + 1] * hh * c, d2[o1 + 2] * hh * c).applyQuaternion(q).applyQuaternion(yaw).applyQuaternion(_qI); // 두 차 몫
    const Tp = st.Tp.copy(T).add(_v).add(_w);
    const Tm = st.Tm.copy(T).sub(_v).add(_w);
    const P = solveArmIK(Tp, Ssh, pole, st.outP);
    const M = solveArmIK(Tm, Ssh, pole, st.outM);
    const pd = cmd.phiDot, pdd = cmd.phiDDot;
    // 손 닿음 자르기 꺾임을 세 풀이가 걸치면 두 차 차분은 꺾임/h 라 α 가 부푼다 → 두 차 몫을 빼고 센다 (한 차 몫·φ̈ 는 둔다)
    const kink = P.clamped !== o.clamped || M.clamped !== o.clamped;
    if (kink) d.alphaKink++;
    // 어깨: 가슴 기준 회전 → 월드 (manualMuscle 의 wT 와 같은 틀)
    const r1 = rotVec(_qI.copy(P.qUarm).multiply(_q.copy(M.qUarm).invert()), _x).multiplyScalar(1 / (2 * h)); // dθ/dφ
    const rp = rotVec(_qI.copy(P.qUarm).multiply(_q.copy(o.qUarm).invert()), _y);
    const rm = rotVec(_qI.copy(o.qUarm).multiply(_q.copy(M.qUarm).invert()), _z);
    if (kink) rp.set(0, 0, 0);
    else rp.sub(rm).multiplyScalar(1 / (h * h)); // d²θ/dφ²
    st.omegaDes.copy(r1).multiplyScalar(pd).applyQuaternion(_qR);
    st.alphaDes.copy(rp).multiplyScalar(pd * pd).addScaledVector(r1, pdd).applyQuaternion(_qR);
    // 팔꿈치 굽힘
    const f1 = (P.flex - M.flex) / (2 * h), f2 = kink ? 0 : (P.flex - 2 * o.flex + M.flex) / (h * h);
    st.wFlex = f1 * pd;
    st.aFlex = f2 * pd * pd + f1 * pdd;
    st.tDes = this.t;
    d.omegaDes = st.omegaDes.length();
    d.alphaDes = st.alphaDes.length();
    d.elbowRateDes = st.wFlex;
  },
  /** 어깨 wT (월드, 차분값) = lerp(차분, ω_des, S) */
  shoulderRate(wT) {
    wT.lerp(this._arm.omegaDes, this._w);
  },

  /**
   * 팔 앞먹임 (§6.6): uarmS → T (_mT, Hill 한도 앞) += ffGain·S·I_arm·α_des (I_arm = 위팔·아래팔·칼의 어깨 둘레 관성 텐서, 스텝마다)
   *  farmS → I_fore·α_flex·ffGain·S 를 경첩 축으로 addTorque 짝 (farmS +, uarmS −), 근력 한도 maxT 로만 자른다 (ffCap 에 센다)
   */
  armFF(j, T, maxT) {
    const st = this._arm, f = this.f, B = f.bodies, d = this.debug, k = DRIVE.ffGain * this._w;
    const sw = f.armed ? f.sword : null;
    if (sw && st.sw.rb !== sw) {
      st.sw.rb = sw;
      st.sw.m = sw.mass();
      localTensor(sw, st.sw.I);
    }
    const I = st.I;
    I.fill(0);
    if (j.name === 'uarmS') {
      const p = bodyPoint(B.uarmS, st.shA, _w); // 어깨 (월드)
      let L = addInertia(I, st.uarm, p) + addInertia(I, st.farm, p);
      if (sw) L += addInertia(I, st.sw, p);
      d.L_arm = L;
      if (!DRIVE.ff) return T;
      const a = st.alphaDes;
      const tx = (I[0] * a.x + I[1] * a.y + I[2] * a.z) * k;
      const ty = (I[3] * a.x + I[4] * a.y + I[5] * a.z) * k;
      const tz = (I[6] * a.x + I[7] * a.y + I[8] * a.z) * k;
      const al = a.length();
      d.I_arm = al > 1e-9 ? (a.x * (I[0] * a.x + I[1] * a.y + I[2] * a.z) + a.y * (I[3] * a.x + I[4] * a.y + I[5] * a.z) + a.z * (I[6] * a.x + I[7] * a.y + I[8] * a.z)) / (al * al) : I[4];
      d.ffArm = Math.hypot(tx, ty, tz);
      T.x += tx;
      T.y += ty;
      T.z += tz;
      return T;
    }
    // 팔꿈치: 경첩 축 = 위팔 z (월드), 점 = 팔꿈치
    if (!DRIVE.ff) return T;
    const n = _x.set(0, 0, 1).applyQuaternion(setQ(_qR, B.uarmS.rotation()));
    const e = bodyPoint(B.farmS, st.elA, _w); // 팔꿈치 (월드)
    addInertia(I, st.farm, e);
    if (sw) addInertia(I, st.sw, e);
    const If = n.x * (I[0] * n.x + I[1] * n.y + I[2] * n.z) + n.y * (I[3] * n.x + I[4] * n.y + I[5] * n.z) + n.z * (I[6] * n.x + I[7] * n.y + I[8] * n.z);
    d.I_fore = If;
    let t = If * st.aFlex * k;
    if (t > maxT) {
      t = maxT;
      this.noteFfCap();
    } else if (t < -maxT) {
      t = -maxT;
      this.noteFfCap();
    }
    d.ffElbow = t;
    _anc.x = n.x * t;
    _anc.y = n.y * t;
    _anc.z = n.z * t;
    B.farmS.addTorque(_anc, true);
    _anc.x = -_anc.x;
    _anc.y = -_anc.y;
    _anc.z = -_anc.z;
    B.uarmS.addTorque(_anc, true);
    return T;
  },

  // ───────── §6.7 결과 ─────────
  /** 부딪힘·상처 결과 (combat.js 두 곳): warp 를 warpFade 동안 0 으로, stats.lastResult 에 (φ, S, kind). S = 0 이면 아무것도 안 한다 */
  onResult(kind, info) {
    if (!(this._w > 0)) return;
    const st = this.arm;
    if (st.fadeT0 < 0) st.fadeT0 = this.t;
    const lr = (this.stats.lastResult ??= { phi: 0, S: 0, kind: '', t: 0 });
    lr.phi = this.cmd.phi;
    lr.S = this._w;
    lr.kind = kind;
    lr.t = this.t;
  },
};

// ClipDrive 에 붙인다 (getter 는 속성 설명자로)
for (const [k, desc] of Object.entries(Object.getOwnPropertyDescriptors(ArmMixin))) Object.defineProperty(ClipDrive.prototype, k, desc);

export { ClipDrive };
