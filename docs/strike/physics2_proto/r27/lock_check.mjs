// r27 C7 굳음 검사 (재기만): 엔진 모터에 굳기 k · 감쇠 d 를 줄 때 축이 굳는지 — 부모 고정 · 자식 자유(중력 0) 한 관절에 1 N·m 를 한 스텝 걸고 자식 각속도를 본다.
//  견줌: 모터 없음에 가까움(k 0 · d 1e-9) · 굳음(k 0 · d 0) · 이 고침의 가장 작은 값(LEGS.capDFloor 감쇠 · 다리 모터 가장 작은 k 와 k 0).
//  그리고 다리 관절 모터 k 의 가장 작은 값(근력 몫 바닥 0.15 × 다리 건강 바닥 0.6 × 다리 기능 바닥 0.4 × 걸음 gain 1 미만이면 그것까지)을 이 나무 몸에서 읽어 적는다.
//  쓰는 법: (cd <나무> && node docs/strike/physics2_proto/r27/lock_check.mjs)
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const ROOT = process.cwd();
const RAPIER = (await import(pathToFileURL(join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs')).href)).default;
await RAPIER.init();
const { LEGS } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
function one(hinge, k, d) {
  const W = new RAPIER.World({ x: 0, y: 0, z: 0 }); W.timestep = 1 / 120; W.integrationParameters.numSolverIterations = 6;
  const P = W.createRigidBody(RAPIER.RigidBodyDesc.fixed()), C = W.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
  W.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 0.2, 0.05).setDensity(1000), C);
  const J = W.createImpulseJoint(hinge ? RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) : RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), P, C, true);
  for (const a of hinge ? [3] : [3, 4, 5]) { J.rawSet.jointConfigureMotorModel(J.handle, a, 1); J.rawSet.jointConfigureMotor(J.handle, a, 0, 0, k, d); }
  C.addTorque({ x: 0, y: 0, z: 1 }, true);
  W.step();
  const w = C.angvel().z; W.free(); return w;
}
const fmt = (x) => x.toExponential(3);
for (const hinge of [true, false]) {
  const ref = one(hinge, 0, 1e-9);
  const rows = [['k 0 · d 1e-9 (거의 없음)', 0, 1e-9], ['k 0 · d 0 (굳음)', 0, 0], [`k 0 · d ${LEGS.capDFloor} (바닥)`, 0, LEGS.capDFloor], [`k 1 · d ${LEGS.capDFloor}`, 1, LEGS.capDFloor], [`k 1 · d 0`, 1, 0]];
  console.log(`${hinge ? '경첩' : '공'} 관절: 1 N·m 한 스텝 뒤 자식 각속도 z (거의 없음 = ${fmt(ref)} rad/s 에 대한 몫)`);
  for (const [nm, k, d] of rows) { const w = one(hinge, k, d); console.log(`  ${nm.padEnd(26)} ${fmt(w)} (${(w / ref).toFixed(4)})`); }
}
// 이 나무 몸의 다리 모터 k 바닥
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const G = H.newRound({ walls: false, weapon: 'longsword', seed: 1 });
let kmin = Infinity, who = '';
for (const j of G.player.joints) { if (!/^(thigh|shin|foot)/.test(j.name)) continue; const kk = j.k * 0.15 * 0.6 * 0.4 * Math.min(1, j.gain || 1); if (kk < kmin) { kmin = kk; who = j.name; } }
console.log(`다리 모터 k 의 바닥 (j.k × 0.15 × 0.6 × 0.4 × min(1, gain)): ${kmin.toFixed(3)} N·m/rad (${who}) → 늘 0 보다 큼 · 감쇠는 LEGS.capDFloor ${LEGS.capDFloor} 밑으로 안 내려감 → k = d = 0 인 길 없음`);
