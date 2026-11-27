// r24: Rapier 0.19 공 관절 모터의 스프링 몫이 자세 차이를 어떻게 재는지 — 아주 무거운 자식 몸(한 스텝에 거의 안 움직임)으로 힘 법칙만 뽑아 후보 식과 견줌.  node law_probe.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAPIER = (await import(join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init({});
const THREE = await import(join(ROOT, 'node_modules/three/build/three.module.js'));
const DT = 1 / 120;
const qa = (x, y, z, a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z).normalize(), a);
function real(qp, q0, tgt, k) {
  const W = new RAPIER.World({ x: 0, y: 0, z: 0 });
  W.timestep = DT; W.integrationParameters.numSolverIterations = 1;
  const P = W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation(qp));
  const C = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  W.createCollider(RAPIER.ColliderDesc.ball(0.1).setDensity(1e9), C);
  const J = W.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), P, C, true);
  C.setRotation(q0, true);
  [3, 4, 5].forEach((a, i) => { J.rawSet.jointConfigureMotorModel(J.handle, a, 1); J.rawSet.jointConfigureMotor(J.handle, a, tgt[i], 0, k, 0); });
  const I = C.effectiveAngularInertia().m11;
  W.step();
  const w = C.angvel(); W.free();
  return [w.x * I / DT, w.y * I / DT, w.z * I / DT];
}
const rv = (q) => { const s = Math.hypot(q.x, q.y, q.z); const a = 2 * Math.atan2(s, q.w); return s < 1e-12 ? [0, 0, 0] : [q.x / s * a, q.y / s * a, q.z / s * a]; };
// 후보: 오차 e_i = 2(sin(t_i/2) − imag_i) 또는 (t_i − rv_i) ; 축 = 부모 틀 축 또는 imag 의 기울기 열
function grad(qrel, qp) { // d imag(qrel)/d(세계 회전 δ 를 자식에)  → 3x3 (행 i = imag_i)
  const G = [[], [], []]; const h = 1e-7;
  for (let j = 0; j < 3; j++) { const d = [0, 0, 0]; d[j] = 1; const dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...d), h); const qc = qp.clone().multiply(qrel); const q2 = qp.clone().invert().multiply(dq.multiply(qc)); for (let i = 0; i < 3; i++) G[i][j] = ([q2.x, q2.y, q2.z][i] - [qrel.x, qrel.y, qrel.z][i]) / h; }
  return G;
}
const ANG = {
  rv: (qr) => rv(qr),
  asin2: (qr) => [qr.x, qr.y, qr.z].map((v) => 2 * Math.asin(v)),
  atan2: (qr) => [qr.x, qr.y, qr.z].map((v) => 2 * Math.atan2(v, qr.w)),
};
const AX = {
  par: (qp, qr) => qp,
  child: (qp, qr) => qp.clone().multiply(qr),
  mid: (qp, qr) => qp.clone().multiply(new THREE.Quaternion().slerp(qr, 0.5)),
};
const cands = {};
for (const a in ANG) for (const x in AX) cands[a + '_' + x] = (qp, qr, t, k) => { const c = ANG[a](qr); return new THREE.Vector3(...t.map((v, i) => k * (v - c[i]))).applyQuaternion(AX[x](qp, qr)).toArray(); };
cands.sin_par = (qp, qr, t, k) => new THREE.Vector3(...t.map((x, i) => 2 * k * (Math.sin(x / 2) - [qr.x, qr.y, qr.z][i]))).applyQuaternion(qp).toArray();
cands.sin_mid = (qp, qr, t, k) => new THREE.Vector3(...t.map((x, i) => 2 * k * (Math.sin(x / 2) - [qr.x, qr.y, qr.z][i]))).applyQuaternion(AX.mid(qp, qr)).toArray();
cands.sinw_mid = (qp, qr, t, k) => new THREE.Vector3(...t.map((x, i) => 2 * k * (Math.sin(x / 2) - [qr.x, qr.y, qr.z][i]) / qr.w)).applyQuaternion(AX.mid(qp, qr)).toArray();
const err = {}; for (const c in cands) err[c] = [];
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let n = 0; n < 40; n++) {
  const qp = qa(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() * 2);
  const qr = qa(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() * 1.4);
  const t = [0, 1, 2].map(() => (rnd() - 0.5) * 1.6);
  const q0 = qp.clone().multiply(qr);
  const R = real(qp, q0, t, 100);
  for (const c in cands) { const M = cands[c](qp, qr, t, 100); err[c].push(Math.hypot(...M.map((v, i) => v - R[i])) / Math.hypot(...R)); }
  if (false) console.log('real', R.map((v) => v.toFixed(3)).join(' '), Object.entries(cands).map(([c, f]) => c + ' ' + f(qp, qr, t, 100).map((v) => v.toFixed(3)).join(' ')).join(' | '));
}
for (const c in err) { const e = err[c].sort((a, b) => a - b); console.log(c.padEnd(10), 'rel err median', e[20].toFixed(4), 'max', e[39].toFixed(4)); }
