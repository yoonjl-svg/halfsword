// ─────────────────────────────────────────────────────────────
//  R2 꼭두각시 (docs/strike/r2_impl_spec.md §8.1): 클립을 게임 몸에 옮겨 놓고(물리 없음) 좌표·부호를 본다
//   kinPose  : 아틀라스 표본(φ, S) → 게임 단위(toGame) → 게임 몸 치수의 몸통 틀·어깨·팔 IK(armIK 와 같은 a 0.3, b 0.27, 끝 0.565)
//              → 손목점(farmS 몸 틀 (0.13, 0, 0) = 팔꿈치에서 0.265 m)·팔꿈치·칼끝. 좌표 = 클립 월드 (x 앞 · y 위 · z 칼 든 쪽, 시작 때 골반 밑 땅)
//   Puppet   : 파이터의 모든 몸 + 칼을 kinematic 으로 바꿔 kinPose 자리에 매 스텝 놓는다 (main.js ?puppet=<클립 id>, tools/sim/puppet.mjs)
//  드라이브(drive.js)·엔진 경로에 끼지 않는다: 이 파일은 꼭두각시를 켤 때만 읽힌다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeSample, toGame, CH, chestFrame, DROP_BASE } from './atlas.js';

// 게임 몸 치수 (fighter.js partDefs·jointDefs, tools/motion/lib/game_joints.mjs ANCHORS)
export const PUP = {
  hipY: 0.93, waistUp: 0.13, chestUp: 0.27, // 엉덩이 관절 0.93 · 허리 1.06 · 가슴 가운데 1.33
  shoulder: [0, 0.1, 0.2], // 가슴 틀 (armIK S)
  a: 0.3, b: 0.27, reach: 0.565, // armIK: 위팔 · 아래팔+손목 · 끝 (a + b − 0.005)
  wrist: 0.265, // 팔꿈치 → 손목점 (farmS 가운데 0.135 + 몸 틀 (0.13, 0, 0))
  swordTip: 1.18, offHand: -0.14, // 칼자루 0.13 + 칼날 1.05, 빈손 자리
  hipZ: 0.095, thigh: 0.43, shin: 0.42, ankleY: 0.08, foot: 0.16,
  // 클립 v0 디딤 (24 벌 모두 같다: 칼 쪽 발 R 이 뒤 [−0.26, ±0.15], 반대 발이 앞 [0.27, ∓0.10]) — 묶음(브라우저)엔 발 자리가 없어 여기서.
  //  node 도구는 원본 J 의 발목을 쓰고 이 값과의 차이를 보고한다 (puppet.mjs)
  stanceFoot: [0.27, 0.1],
  hipShare: 0.38, // 골반 앞으로 옮김 = 내딛는 발 옮김 × 0.38 (zornhau/mittelhau large J: 0.30/0.78). 보기용 근사 (node 는 J 의 hipC)
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** kinPose 결과 그릇 (미리 만들어 쓴다) */
export function makePose() {
  const V = () => new THREE.Vector3();
  const Q = () => new THREE.Quaternion();
  return {
    g: {}, A: makeSample(), Mc: new Float64Array(9), frameErr: 0,
    qP: Q(), qC: Q(), qAbd: Q(),
    hipC: V(), waist: V(), C: V(), head: V(),
    shS: V(), shO: V(), handCmd: V(), handCmdO: V(), elS: V(), hS: V(), elO: V(), hO: V(), sword: V(), tip: V(), edge: V(), poleS: V(), poleO: V(),
    qUS: Q(), qFS: Q(), qUO: Q(), qFO: Q(), qSword: Q(), flatErrDeg: 0,
    reachClamp: 0, reachOver: 0, reachClampO: 0, flex: 0,
    legs: { L: { hip: V(), knee: V(), ankle: V(), toe: V(), qT: Q(), qS: Q(), qF: Q() }, R: { hip: V(), knee: V(), ankle: V(), toe: V(), qT: Q(), qS: Q(), qF: Q() } },
    // 게임 척추 목표(applyPose 의 Euler YXZ, 관절 틀 = 몸 틀)로 조립한 가슴 — 부호 확인 (iii)
    qCgame: Q(), shSg: V(), shOg: V(),
  };
}

/** 기저 (열 = 몸 x·y·z) → 쿼터니언 */
function basisQ(x, y, z, out) {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}
/** 몸 −y 가 dir 을 향하고 x 가 hint 쪽인 회전 (허벅지·정강이·빈팔) */
function alignDown(dir, hint, out) {
  const y = _v.copy(dir).normalize().negate();
  const x = hint.clone().addScaledVector(y, -hint.dot(y));
  if (x.lengthSq() < 1e-8) x.copy(Math.abs(y.x) < 0.9 ? X : Z).addScaledVector(y, -(Math.abs(y.x) < 0.9 ? y.x : y.z));
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return basisQ(x, y.clone(), z, out);
}

/**
 * 두 마디 IK (fighter.js armIK 와 같은 식): 어깨 s, 목표 t, 꺾는 쪽 pole (같은 틀) → 팔꿈치·손목점·몸 회전(위팔 x = 위팔 방향, y = 접히는 쪽)
 *  돌려주는 값: 끝에 닿지 않아 자른 길이 (m, 0 이면 닿음)
 */
function armIK(s, t, pole, a, b, hand, el, hw, qU, qF) {
  const D = _v.subVectors(t, s);
  const L = D.length();
  const d = THREE.MathUtils.clamp(L, 0.08, a + b - 0.005);
  const Dn = D.clone().normalize();
  const p = pole.clone().addScaledVector(Dn, -pole.dot(Dn));
  if (p.lengthSq() < 1e-6) p.set(0, -1, 0);
  p.normalize();
  const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const u = Dn.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(p, Math.sin(alpha));
  el.copy(s).addScaledVector(u, a);
  const fore = Dn.clone().multiplyScalar(d).addScaledVector(u, -a); // 팔꿈치 → IK 끝 (길이 b)
  const fl = fore.length() || 1;
  hw.copy(el).addScaledVector(fore, hand / fl);
  const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  if (qU) {
    const yA = fore.clone().addScaledVector(u, -fore.dot(u));
    if (yA.lengthSq() < 1e-6) yA.set(0, 1, 0).addScaledVector(u, -u.y);
    yA.normalize();
    const zA = new THREE.Vector3().crossVectors(u, yA).normalize();
    basisQ(u, yA, zA, qU);
    qF.copy(qU).multiply(_q.setFromAxisAngle(Z, flex));
  }
  return { over: L - d, flex };
}

/**
 * 클립 한 순간 → 게임 몸 자세 (물리 없음). req = { cut, side, phi, S, girdle: 'off'|'anchor', hip: [x, z] | null, feet: fn | null }
 *  feet(phi) → { L: { ankle: [x,y,z], toe: [x,y,z] }, R: … } (node: 원본 J). 없으면 PUP.stanceFoot + 클립 step 자료로 근사
 */
export function kinPose(atlas, req, P = makePose()) {
  const A = atlas.sample(P.A, { cut: req.cut, side: req.side, phi: req.phi, S: req.S, over: 0, cutB: null, wAB: 0 });
  const v = A.v;
  const g = toGame(v, P.g);
  // 게임 단위로 다시 짓는 틀: 골반 = qY(pelvisYaw), 가슴 = qY(chestYaw)·qZ(−pitch)·qX(side) (§4.3). 아틀라스 chestFrame(클립 도)과 견준다
  P.qP.setFromAxisAngle(UP, g.pelvisYaw);
  P.qC.setFromAxisAngle(UP, g.chestYaw).multiply(_q.setFromAxisAngle(Z, -g.pitch)).multiply(new THREE.Quaternion().setFromAxisAngle(X, g.side));
  const Mc = chestFrame(v[CH.chestYaw], v[CH.chestLean], v[CH.chestSide], P.Mc);
  _m.makeRotationFromQuaternion(P.qC);
  const e = _m.elements; // 열 우선
  P.frameErr = Math.max(Math.abs(e[0] - Mc[0]), Math.abs(e[4] - Mc[1]), Math.abs(e[8] - Mc[2]), Math.abs(e[1] - Mc[3]), Math.abs(e[5] - Mc[4]), Math.abs(e[9] - Mc[5]), Math.abs(e[2] - Mc[6]), Math.abs(e[6] - Mc[7]), Math.abs(e[10] - Mc[8]));
  P.qAbd.copy(P.qP).slerp(P.qC, 0.5);
  const hx = req.hip ? req.hip[0] : 0, hz = req.hip ? req.hip[1] : 0;
  P.hipC.set(hx, PUP.hipY - (g.drop + DROP_BASE), hz);
  P.waist.set(0, PUP.waistUp, 0).applyQuaternion(P.qP).add(P.hipC);
  P.C.set(0, PUP.chestUp, 0).applyQuaternion(P.qC).add(P.waist);
  P.head.set(0, 0.29, 0).applyQuaternion(P.qC).add(P.C);
  const toC = (o, x, y, z) => o.set(x, y, z).applyQuaternion(P.qC).add(P.C);
  const dirC = (o, off) => o.set(v[off], v[off + 1], v[off + 2]).applyQuaternion(P.qC);
  // 어깨 (가슴 틀 (0, 0.1, ±0.2)). 'anchor' 면 girdle [lift, prot] 만큼 (prot, lift, 0)
  const gS = req.girdle === 'anchor' ? [v[CH.girdleS + 1], v[CH.girdleS]] : [0, 0];
  const gO = req.girdle === 'anchor' ? [v[CH.girdleO + 1], v[CH.girdleO]] : [0, 0];
  toC(P.shS, PUP.shoulder[0] + gS[0], PUP.shoulder[1] + gS[1], PUP.shoulder[2]);
  toC(P.shO, PUP.shoulder[0] + gO[0], PUP.shoulder[1] + gO[1], -PUP.shoulder[2]);
  toC(P.handCmd, v[CH.handS], v[CH.handS + 1], v[CH.handS + 2]);
  toC(P.handCmdO, v[CH.handO], v[CH.handO + 1], v[CH.handO + 2]);
  dirC(P.sword, CH.sword).normalize();
  dirC(P.edge, CH.edge).normalize();
  dirC(P.poleS, CH.poleS);
  dirC(P.poleO, CH.poleO);
  const rS = armIK(P.shS, P.handCmd, P.poleS, PUP.a, PUP.b, PUP.wrist, P.elS, P.hS, P.qUS, P.qFS);
  P.reachOver = rS.over;
  P.reachClamp = rS.over > 1e-9 ? 1 : 0;
  P.flex = rS.flex;
  P.tip.copy(P.hS).addScaledVector(P.sword, PUP.swordTip);
  // 빈팔: 클립 handO 로 (게임은 빈손 용수철이 칼자루를 잡는다 — 여기선 자리만)
  const rO = armIK(P.shO, P.handCmdO, P.poleO, PUP.a, PUP.b, PUP.wrist, P.elO, P.hO, null, null);
  P.reachClampO = rO.over > 1e-9 ? 1 : 0;
  alignDown(_v.subVectors(P.elO, P.shO).clone(), _v.set(1, 0, 0).applyQuaternion(P.qC).clone(), P.qUO);
  alignDown(new THREE.Vector3().subVectors(P.hO, P.elO), new THREE.Vector3(1, 0, 0).applyQuaternion(P.qC), P.qFO);
  // 칼: 몸 y = 칼날, z = 게임의 멈춘 칼 면(RIGHT_LOCAL 을 칼날에 수직으로) — driveSword 의 flatTarget 과 같다
  const flat = new THREE.Vector3(0, 0, 1).addScaledVector(P.sword, -P.sword.z);
  if (flat.lengthSq() < 1e-4) flat.set(1, 0, 0).addScaledVector(P.sword, -P.sword.x);
  flat.normalize();
  basisQ(new THREE.Vector3().crossVectors(P.sword, flat), P.sword, flat, P.qSword);
  P.flatErrDeg = (Math.acos(THREE.MathUtils.clamp(Math.abs(flat.dot(P.edge)), 0, 1)) * 180) / Math.PI; // 멈춘 칼 면 ↔ 클립 날 (보고만, §4.3)
  // 게임 척추 목표로 조립 (applyPose: twist = chestYaw − pelvisYaw 를 0.45/0.55, bend = −pitch 반씩, roll = side·sideShare 각 관절)
  const tw = g.chestYaw - g.pelvisYaw, bend = -g.pitch, roll = g.side * (req.sideShare ?? 0.5);
  const eu = new THREE.Euler();
  P.qCgame.copy(P.qP).multiply(new THREE.Quaternion().setFromEuler(eu.set(roll, tw * 0.45, bend * 0.5, 'YXZ'))).multiply(new THREE.Quaternion().setFromEuler(eu.set(roll, tw * 0.55, bend * 0.5, 'YXZ')));
  P.shSg.set(0, 0.1, 0.2).applyQuaternion(P.qCgame);
  P.shOg.set(0, 0.1, -0.2).applyQuaternion(P.qCgame);
  // 다리
  const F = req.feet ? req.feet(req.phi) : defaultFeet(atlas, req, g);
  for (const k of ['L', 'R']) {
    const lg = P.legs[k], s = k === 'R' ? 1 : -1;
    lg.hip.set(0, 0, s * PUP.hipZ).applyQuaternion(P.qP).add(P.hipC);
    lg.ankle.fromArray(F[k].ankle);
    lg.toe.fromArray(F[k].toe);
    const fdir = new THREE.Vector3(lg.toe.x - lg.ankle.x, 0, lg.toe.z - lg.ankle.z).normalize();
    const r = armIK(lg.hip, lg.ankle, fdir.clone().add(new THREE.Vector3(0, 0.15, 0)), PUP.thigh, PUP.shin + 0.005, PUP.shin, lg.knee, new THREE.Vector3(), null, null);
    lg.over = r.over;
    alignDown(new THREE.Vector3().subVectors(lg.knee, lg.hip), fdir, lg.qT);
    alignDown(new THREE.Vector3().subVectors(lg.ankle, lg.knee), fdir, lg.qS);
    const fd = new THREE.Vector3().subVectors(lg.toe, lg.ankle).normalize();
    const zf = new THREE.Vector3().crossVectors(fd, UP).normalize();
    basisQ(fd, new THREE.Vector3().crossVectors(zf, fd), zf, lg.qF);
  }
  return P;
}

/** 묶음만 있을 때의 발 (클립 v0 디딤 + step 자료, 발 yaw·들림 채널). 좌표 = 클립 월드 */
function defaultFeet(atlas, req, g) {
  const fam = atlas.fam(req.cut, req.side);
  const st = (fam.large.meta.step || fam.medium.meta.step);
  const sf = st.foot; // 내딛는 발 (클립)
  const s = atlas.step(req.cut, req.side, req.S);
  const from = st.from; // [x, z]
  const u = THREE.MathUtils.clamp((req.phi - s.liftPhi) / Math.max(1e-6, s.landPhi - s.liftPhi), 0, 1);
  const w = u * u * (3 - 2 * u);
  const out = {};
  for (const k of ['L', 'R']) {
    const moving = k === sf;
    let x, z, up = 0;
    if (moving) {
      x = from[0] + s.fwd * w;
      z = from[1] + s.side * w;
      up = 0.08 * Math.sin(Math.PI * u);
    } else {
      x = PUP.stanceFoot[0];
      z = -Math.sign(from[1]) * PUP.stanceFoot[1];
    }
    const yaw = k === 'L' ? g.footLYaw : g.footRYaw; // 게임 rad (+ = 왼쪽으로 돎)
    const lift = (k === 'L' ? g.footLHeel : g.footRHeel) / 0.5; // heelMax 로 나눠 0–1
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    const pf = Math.asin(Math.min(0.9, lift * 0.5));
    const toe = [x + fx * PUP.foot, 0.02 + up, z + fz * PUP.foot];
    out[k] = { ankle: [toe[0] - fx * PUP.foot * Math.cos(pf), PUP.ankleY + up + PUP.foot * Math.sin(pf), toe[2] - fz * PUP.foot * Math.cos(pf)], toe };
  }
  return out;
}

/** 보기용 골반 앞뒤 옮김 (묶음 길): 내딛는 발 옮김 × hipShare */
function defaultHip(atlas, req) {
  const s = atlas.step(req.cut, req.side, req.S);
  const u = THREE.MathUtils.clamp((req.phi - s.liftPhi) / Math.max(1e-6, s.landPhi - s.liftPhi), 0, 1);
  const w = u * u * (3 - 2 * u);
  return [s.fwd * PUP.hipShare * w, s.side * PUP.hipShare * w];
}

/** 클립 id ('zornhau_right_large') → { cut, side, S } */
export function parseClipId(id) {
  const m = /^([a-z]+)_(right|left)_(small|medium|large)$/.exec(id || '');
  if (!m) return null;
  return { cut: m[1], side: m[2], S: { small: 0, medium: 0.5, large: 1 }[m[3]], size: m[3] };
}

const BODY_OF = {
  pelvis: (P) => [P.hipC.clone().add(new THREE.Vector3(0, 0.04, 0).applyQuaternion(P.qP)), P.qP],
  abdomen: (P) => [P.waist.clone().add(new THREE.Vector3(0, 0.07, 0).applyQuaternion(P.qAbd)), P.qAbd],
  chest: (P) => [P.C, P.qC],
  head: (P) => [P.head, P.qC],
  uarmS: (P) => [new THREE.Vector3().addVectors(P.shS, P.elS).multiplyScalar(0.5), P.qUS],
  farmS: (P) => [new THREE.Vector3(0.135, 0, 0).applyQuaternion(P.qFS).add(P.elS), P.qFS],
  uarmO: (P) => [new THREE.Vector3().addVectors(P.shO, P.elO).multiplyScalar(0.5), P.qUO],
  farmO: (P) => [new THREE.Vector3(0, -0.14, 0).applyQuaternion(P.qFO).add(P.elO), P.qFO],
  thighF: (P) => [new THREE.Vector3().addVectors(P.legs.R.hip, P.legs.R.knee).multiplyScalar(0.5), P.legs.R.qT],
  shinF: (P) => [new THREE.Vector3().addVectors(P.legs.R.knee, P.legs.R.ankle).multiplyScalar(0.5), P.legs.R.qS],
  footF: (P) => [new THREE.Vector3(0.05, -0.035, 0).applyQuaternion(P.legs.R.qF).add(P.legs.R.ankle), P.legs.R.qF],
  thighB: (P) => [new THREE.Vector3().addVectors(P.legs.L.hip, P.legs.L.knee).multiplyScalar(0.5), P.legs.L.qT],
  shinB: (P) => [new THREE.Vector3().addVectors(P.legs.L.knee, P.legs.L.ankle).multiplyScalar(0.5), P.legs.L.qS],
  footB: (P) => [new THREE.Vector3(0.05, -0.035, 0).applyQuaternion(P.legs.L.qF).add(P.legs.L.ankle), P.legs.L.qF],
};

/**
 * 몸을 통째로 kinematic 으로 두고 클립대로 놓는 꼭두각시. opts = { cut, side, S, loop, pace, girdle, feet, hip }
 *  update(dt): 클립 시계(pace 배)로 φ 를 넘기고 놓는다. 게임 칼 든 쪽은 늘 오른쪽(fighter.side +1) — 클립 z 칼 쪽 = 게임 z
 */
export class Puppet {
  constructor(fighter, atlas, opts = {}) {
    this.f = fighter;
    this.atlas = atlas;
    this.o = { loop: true, pace: 1, girdle: 'off', ...opts };
    this.P = makePose();
    this.t = 0;
    this.T = atlas.marks(opts.cut, opts.side, opts.S)[5];
    this.on = false;
  }
  start() {
    const f = this.f;
    const p = f.bodies.pelvis.translation();
    this.origin = new THREE.Vector3(p.x, 0, p.z);
    this.q0 = new THREE.Quaternion().setFromAxisAngle(UP, f.heading);
    const KIN = f.R.RigidBodyType.KinematicPositionBased;
    for (const n in f.bodies) f.bodies[n].setBodyType(KIN, true);
    if (f.sword) f.sword.setBodyType(KIN, true);
    this.on = true;
    this.place(this.phi(), true);
  }
  stop() {
    const f = this.f;
    const DYN = f.R.RigidBodyType.Dynamic;
    for (const n in f.bodies) f.bodies[n].setBodyType(DYN, true);
    if (f.sword) f.sword.setBodyType(DYN, true);
    this.on = false;
  }
  phi() {
    return this.atlas.phiAt(this.o.cut, this.o.side, Math.min(this.t, this.T), this.o.S);
  }
  update(dt) {
    if (!this.on) return;
    this.t += dt * this.o.pace;
    if (this.t > this.T + 0.4) this.t = this.o.loop ? 0 : this.T + 0.4;
    this.place(this.phi());
  }
  /** φ 자리로 몸을 놓는다 (now: 바로 옮김 — 시작 때만) */
  place(phi, now = false) {
    const o = this.o, f = this.f;
    const req = { cut: o.cut, side: o.side, phi, S: o.S, girdle: o.girdle, feet: o.feet, sideShare: o.sideShare };
    req.hip = o.hip ? o.hip(phi) : defaultHip(this.atlas, req);
    const P = kinPose(this.atlas, req, this.P);
    const put = (rb, pos, q) => {
      const w = pos.clone().applyQuaternion(this.q0).add(this.origin);
      const wq = this.q0.clone().multiply(q);
      if (now) {
        rb.setTranslation(w, true);
        rb.setRotation(wq, true);
      } else {
        rb.setNextKinematicTranslation(w);
        rb.setNextKinematicRotation(wq);
      }
    };
    for (const n in BODY_OF) if (f.bodies[n]) put(f.bodies[n], ...BODY_OF[n](P));
    if (f.sword) put(f.sword, P.hS, P.qSword);
    return P;
  }
}
