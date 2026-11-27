// r24: Rapier 0.19 관절 모터가 한 스텝에 실제로 내는 토크를 닫힌 꼴로 다시 세는 식 찾기 (재기만).
//  부모 = 고정 몸 · 자식 = 무게중심이 관절 점에 있는 자유 몸(중력 0 · 감쇠 0) → 자식이 받은 토크 = (I₁ω₁ − I₀ω₀)/dt 가 곧 모터 토크.
//  견주는 식: 작은 스텝(numSolverIterations = n)마다 끝 빠르기로 센 스프링 · 감쇠 τ = (1 + c h K)⁻¹ (k e + c (tv − ω)) · c = d + h k · h = dt/n · K = 자식 관성의 역 (부모 고정)
//   e = 목표 − 지금 (회전 벡터 · 부모 틀) , 작은 스텝마다 e −= h ω.   node motor_model.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAPIER = (await import(join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init();
const THREE = await import(join(ROOT, 'node_modules/three/build/three.module.js'));
const DT = 1 / 120;
const rotvec = (q) => { if (q.w < 0) q = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w); const s = Math.hypot(q.x, q.y, q.z); if (s < 1e-9) return new THREE.Vector3(2 * q.x, 2 * q.y, 2 * q.z); const a = 2 * Math.atan2(s, q.w); return new THREE.Vector3(q.x / s * a, q.y / s * a, q.z / s * a); };
function run({ hinge, q0, w0, tgt, tv, k, d, dims = [0.05, 0.03, 0.12], dens = 1000, n = 6, pgs = 4 }) {
  const W = new RAPIER.World({ x: 0, y: 0, z: 0 });
  W.timestep = DT; W.integrationParameters.numSolverIterations = n; W.integrationParameters.numInternalPgsIterations = pgs;
  const P = W.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const C = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
  W.createCollider(RAPIER.ColliderDesc.cuboid(...dims).setDensity(dens), C);
  const data = hinge ? RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) : RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  const J = W.createImpulseJoint(data, P, C, true);
  const raw = J.rawSet;
  C.setRotation(q0, true); C.setAngvel(w0, true);
  const axes = hinge ? [3] : [3, 4, 5];
  const cur = rotvec(q0.clone());
  axes.forEach((a, i) => { raw.jointConfigureMotorModel(J.handle, a, 1); const c = hinge ? 'z' : 'xyz'[i]; raw.jointConfigureMotor(J.handle, a, tgt[c], tv[c], k, d); });
  const I0 = C.effectiveAngularInertia(); const L0 = mulS(I0, w0);
  W.step();
  const w1 = C.angvel(); const I1 = C.effectiveAngularInertia(); const L1 = mulS(I1, w1);
  const real = new THREE.Vector3(L1.x - L0.x, L1.y - L0.y, L1.z - L0.z).multiplyScalar(1 / DT);
  // 닫힌 꼴
  const Iinv = C.effectiveWorldInvInertia; // not used (use I0 matrix invert)
  const M = new THREE.Matrix3().set(I0.m11, I0.m12, I0.m13, I0.m12, I0.m22, I0.m23, I0.m13, I0.m23, I0.m33);
  let K = M.clone().invert();
  if (hinge) { const kz = new THREE.Vector3(0, 0, 1).applyMatrix3(K).z; K = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, kz); }
  const h = DT / n, c = d + h * k;
  const A = new THREE.Matrix3().identity(); { const e = A.elements, ke = K.elements; for (let i = 0; i < 9; i++) e[i] += c * h * ke[i]; } A.invert();
  const mask = hinge ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 1, 1);
  let e = new THREE.Vector3(tgt.x, tgt.y, tgt.z).sub(cur).multiply(mask);
  let w = new THREE.Vector3(w0.x, w0.y, w0.z).multiply(mask);
  const tvv = new THREE.Vector3(tv.x, tv.y, tv.z).multiply(mask);
  const sum = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = e.clone().multiplyScalar(k).add(tvv.clone().sub(w).multiplyScalar(c)).applyMatrix3(A).multiply(mask);
    sum.add(t); w.add(t.clone().applyMatrix3(K).multiplyScalar(h)).multiply(mask); e.addScaledVector(w, -h);
  }
  sum.multiplyScalar(1 / n);
  const naive = new THREE.Vector3(tgt.x, tgt.y, tgt.z).sub(cur).multiplyScalar(k).add(tvv.clone().sub(new THREE.Vector3(w0.x, w0.y, w0.z)).multiplyScalar(d)).multiply(mask);
  W.free();
  return { real, model: sum, naive };
}
function mulS(I, w) { return { x: I.m11 * w.x + I.m12 * w.y + I.m13 * w.z, y: I.m12 * w.x + I.m22 * w.y + I.m23 * w.z, z: I.m13 * w.x + I.m23 * w.y + I.m33 * w.z }; }
const f = (v) => `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.z.toFixed(2)}`;
const cases = [];
const qa = (x, y, z, a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z).normalize(), a);
// 스프링만 (작은 · 큰 각) · 감쇠만 · 섞임 · 가벼운 몸(발) · 무거운 몸(허벅지)
for (const [nm, dims, dens] of [['heavy', [0.06, 0.2, 0.06], 1000], ['light', [0.12, 0.035, 0.05], 1000]]) {
  for (const hinge of [false, true]) {
    cases.push([nm + (hinge ? ' hinge' : ' ball') + ' spring small', { hinge, dims, dens, q0: qa(1, 0.3, 0.2, 0.1), w0: { x: 0, y: 0, z: 0 }, tgt: { x: 0.12, y: 0.05, z: 0.1 }, tv: { x: 0, y: 0, z: 0 }, k: 100, d: 0.001 }]);
    cases.push([nm + (hinge ? ' hinge' : ' ball') + ' spring big', { hinge, dims, dens, q0: qa(0.3, 0.2, 1, 0.9), w0: { x: 0, y: 0, z: 0 }, tgt: { x: 0.3, y: 0.2, z: 1.1 }, tv: { x: 0, y: 0, z: 0 }, k: 100, d: 0.001 }]);
    cases.push([nm + (hinge ? ' hinge' : ' ball') + ' damp', { hinge, dims, dens, q0: qa(1, 0.3, 0.2, 0.3), w0: { x: 1, y: -2, z: 3 }, tgt: { x: 0, y: 0, z: 0 }, tv: { x: 0.5, y: 0, z: -1 }, k: 0, d: 20 }]);
    cases.push([nm + (hinge ? ' hinge' : ' ball') + ' both', { hinge, dims, dens, q0: qa(0.2, 0.3, 1, 0.6), w0: { x: 1, y: -2, z: 3 }, tgt: { x: 0.1, y: 0.2, z: 0.7 }, tv: { x: 0.5, y: 0, z: -1 }, k: 1000, d: 60 }]);
  }
}
for (const [nm, c] of cases) {
  if (c.hinge) { c.q0 = qa(0, 0, 1, c.q0 === undefined ? 0.3 : 2 * Math.acos(Math.min(1, c.q0.w))); c.w0 = { x: 0, y: 0, z: c.w0.z }; }
  const r = run(c);
  console.log(nm.padEnd(26), 'real', f(r.real).padEnd(26), 'model', f(r.model).padEnd(26), 'naive', f(r.naive));
}
