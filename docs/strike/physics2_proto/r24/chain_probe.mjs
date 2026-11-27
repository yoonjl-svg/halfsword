// r24: 두 자유 몸(정강이 3 kg · 발 1.1 kg · 발 무게중심이 관절에서 떨어짐)을 경첩으로 잇고 엔진 모터 한 스텝 —
//  (처음 빠르기는 관절 점이 멈춘 채 발이 그 둘레를 도는 꼴) 한 스텝 뒤 관절 상대 빠르기를 legMuscle 의 작은 스텝 셈(K = 두 몸 역관성 합 · 또는 관절 자리 묶음을 넣은 K_eff)이 내다본 값과 견줌.  node chain_probe.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAPIER = (await import(join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init({});
const DT = 1 / 120;
function engine({ w0, k, d, tgt, tv, offC, mP, mC, n = 6, pgs = 4 }) {
  const W = new RAPIER.World({ x: 0, y: 0, z: 0 });
  W.timestep = DT; W.integrationParameters.numSolverIterations = n; W.integrationParameters.numInternalPgsIterations = pgs;
  const P = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.2, 0));
  W.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 0.2, 0.05).setMass(mP), P);
  const C = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(offC, -0.04, 0));
  W.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.035, 0.05).setMass(mC), C);
  const J = W.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: -0.2, z: 0 }, { x: -offC, y: 0.04, z: 0 }, { x: 0, y: 0, z: 1 }), P, C, true);
  if (k > 0 || d > 0) { J.rawSet.jointConfigureMotorModel(J.handle, 3, 1); J.rawSet.jointConfigureMotor(J.handle, 3, tgt, tv, k, d); }
  C.setAngvel({ x: 0, y: 0, z: w0 }, true);
  C.setLinvel({ x: -w0 * 0.04, y: w0 * offC, z: 0 }, true); // 관절 점(무게중심에서 (−offC, 0.04))이 멈춰 있게: v = −ω × r_A
  const Ip = P.effectiveWorldInvInertia().m33, Ic = C.effectiveWorldInvInertia().m33;
  W.step();
  const r = C.angvel().z - P.angvel().z;
  W.free();
  return { r, Ip, Ic };
}
function model(w0, k, d, tgt, tv, K, n = 6) {
  const h = DT / n, c = d + h * k, A = 1 / (1 + c * h * K);
  let w = w0, e = tgt, s = 0;
  for (let m = 0; m < n; m++) { const t = A * (k * e + c * (tv - w)); s += t; w += h * K * t; e -= h * w; }
  return { w, tau: s / n };
}
// K_eff (평면 · z 축): 두 몸이 관절 점에서 이어짐 — 1/K_eff = 회전 관성 짝 (아래 식은 fighter.js jointMobility 의 평면 판)
function keff(mP, IpInv, mC, IcInv, rP, rC) { // r = 관절 점 − 무게중심 (x, y)
  // 3x3 를 평면에서: 짝 토크 τ 에 대한 상대 각가속도 — 수치로 풂
  const K = IpInv + IcInv;
  const Bm = [[-rP[1] * IpInv - rC[1] * IcInv], [rP[0] * IpInv + rC[0] * IcInv]]; // [r]×(0,0,I⁻¹τ) 의 x,y
  const s = 1 / mP + 1 / mC;
  const W = [[s + rP[1] * rP[1] * IpInv + rC[1] * rC[1] * IcInv, -rP[0] * rP[1] * IpInv - rC[0] * rC[1] * IcInv], [-rP[0] * rP[1] * IpInv - rC[0] * rC[1] * IcInv, s + rP[0] * rP[0] * IpInv + rC[0] * rC[0] * IcInv]];
  const det = W[0][0] * W[1][1] - W[0][1] * W[1][0];
  const Wi = [[W[1][1] / det, -W[0][1] / det], [-W[1][0] / det, W[0][0] / det]];
  const b = [Bm[0][0], Bm[1][0]];
  const q = b[0] * (Wi[0][0] * b[0] + Wi[0][1] * b[1]) + b[1] * (Wi[1][0] * b[0] + Wi[1][1] * b[1]);
  return K - q;
}
console.log('경우                         엔진 끝 빠르기   K=두 몸 합   K_eff(관절 묶음)   모터 없음');
for (const [nm, o] of [
  ['발목 감쇠만 d 7 · 무게중심 6 cm', { w0: 5, k: 0, d: 7.2, tgt: 0, tv: 0, offC: 0.06, mP: 3, mC: 1.1 }],
  ['발목 감쇠만 d 24', { w0: 5, k: 0, d: 24, tgt: 0, tv: 0, offC: 0.06, mP: 3, mC: 1.1 }],
  ['발목 스프링 k 700 + d 24', { w0: 2, k: 700, d: 24, tgt: 0.3, tv: 0, offC: 0.06, mP: 3, mC: 1.1 }],
  ['무릎 꼴 d 100 · 3.5 kg · 7 kg', { w0: 5, k: 1600, d: 100, tgt: 0.2, tv: 0, offC: 0.2, mP: 7, mC: 3.5 }],
  ['무릎 꼴 d 30 (디딘)', { w0: 3, k: 80, d: 30, tgt: 0.05, tv: 0, offC: 0.2, mP: 7, mC: 3.5 }],
]) {
  const E = engine(o), N = engine({ ...o, k: 0, d: 0 });
  const K2 = E.Ip + E.Ic;
  const Ke = keff(o.mP, E.Ip, o.mC, E.Ic, [0, -0.2], [-o.offC, 0.04]);
  const drift = 0;
  const m2 = model(o.w0, o.k, o.d, o.tgt, o.tv, K2).w + drift, me = model(o.w0, o.k, o.d, o.tgt, o.tv, Ke).w + drift;
  console.log(nm.padEnd(30), E.r.toFixed(3).padStart(10), m2.toFixed(3).padStart(12), me.toFixed(3).padStart(14), N.r.toFixed(3).padStart(12), '  K', K2.toFixed(1), 'Keff', Ke.toFixed(1));
}
