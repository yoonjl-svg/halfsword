// r27: 엔진 모터 스프링이 재는 각 검사 (재기만) — 무거운 자식(한 스텝에 거의 안 움직임) · 감쇠 0 · 굳기 100 으로 목표를 '엔진 각 2 asin(q_i)'(w ≥ 0 쪽)에 두면 토크 ≈ 0 인지,
//  회전 벡터(driveJoints 의 자세 각)에 두면 얼마인지. 자식 사원수를 −q 로 두어도(같은 회전 · w < 0) 같은지. 공 관절 · 경첩(z 축). node angle_check.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const RAPIER = (await import(join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init({});
const THREE = await import(join(ROOT, 'node_modules/three/build/three.module.js'));
const qa = (x, y, z, a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z).normalize(), a);
function torque(hinge, qp, qc, tgt, flip) {
  const W = new RAPIER.World({ x: 0, y: 0, z: 0 }); W.timestep = 1 / 120; W.integrationParameters.numSolverIterations = 6;
  const P = W.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation(qp));
  const C = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  W.createCollider(RAPIER.ColliderDesc.ball(0.1).setDensity(1e9), C);
  const J = W.createImpulseJoint(hinge ? RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) : RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), P, C, true);
  const q = flip ? new THREE.Quaternion(-qc.x, -qc.y, -qc.z, -qc.w) : qc;
  C.setRotation(q, true);
  (hinge ? [3] : [3, 4, 5]).forEach((a, i) => { J.rawSet.jointConfigureMotorModel(J.handle, a, 1); J.rawSet.jointConfigureMotor(J.handle, a, hinge ? tgt[2] : tgt[i], 0, 100, 0); });
  const I = C.effectiveAngularInertia().m11; W.step(); const w = C.angvel(); W.free();
  return Math.hypot(w.x, w.y, w.z) * I * 120;
}
const rv = (q) => { if (q.w < 0) q = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w); const s = Math.hypot(q.x, q.y, q.z); const a = 2 * Math.atan2(s, q.w); return s < 1e-12 ? [0, 0, 0] : [q.x / s * a, q.y / s * a, q.z / s * a]; };
const eng = (q) => { const sg = q.w < 0 ? -1 : 1; return [q.x, q.y, q.z].map((v) => 2 * Math.asin(sg * v)); };
let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const hinge of [false, true]) {
  const out = { eng: [], engFlip: [], rv: [] };
  for (let n = 0; n < 30; n++) {
    const qp = qa(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() * 2);
    const qr = hinge ? qa(0, 0, 1, (rnd() - 0.5) * 2.4) : qa(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() * 1.6);
    const qc = qp.clone().multiply(qr);
    out.eng.push(torque(hinge, qp, qc, eng(qr), false));
    out.engFlip.push(torque(hinge, qp, qc, eng(qr), true));
    out.rv.push(torque(hinge, qp, qc, rv(qr), false));
  }
  const mx = (a) => Math.max(...a).toFixed(4), md = (a) => [...a].sort((x, y) => x - y)[15].toFixed(4);
  console.log(`${hinge ? '경첩' : '공'} 관절 (굳기 100 · 자세 차 최대 ${hinge ? 1.2 : 1.6} rad): 목표 = 엔진 각 → |토크| 가운데 ${md(out.eng)} 최대 ${mx(out.eng)} N·m · 자식 −q 로 둠 ${md(out.engFlip)} / ${mx(out.engFlip)} · 목표 = 회전 벡터 ${md(out.rv)} / ${mx(out.rv)}`);
}
