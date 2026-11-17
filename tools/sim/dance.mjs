// 춤 지수: 손가락 미세 떨림(±1cm) 속에서 칼·몸통이 얼마나 흔들리는가 + 천천히 자세 옮길 때 몸통 비틀림
//  + 자세 유지 오차(guard-hold error)
import { newRound, THREE, DT, CONFIG } from './jelly_harness.mjs';
import { guardAt, GUARDS } from '../../src/guards.js';
const variant = process.argv[2] || 'base';
if (process.env.PATCH) { const m = await import(process.env.PATCH); m.default?.(CONFIG); }
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const ang = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 57.2958;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pads = [[0.18, -0.28], [0.3, 0.34], [0.1, 0.4], [0.26, 0.0], [-0.1, -0.35], [0.02, 0.15]];
const bladeW = [], chestW = [];
for (const p of pads) {
  const G = newRound({ walls: false }); G.park(); G.ai.update = () => {};
  const P = G.player; P.skill.level = 0.7;
  P.handOffset.set(p[0], p[1]); for (let i = 0; i < 2.5 / DT; i++) G.step();
  let jx = 0, jy = 0;
  for (let i = 0; i < 3 / DT; i++) {
    // 느린 떨림: 1cm 안팎을 천천히 오가는 손가락 (60Hz 입력을 120Hz 스텝에 나눠)
    if (i % 2 === 0) { jx += (rnd() - 0.5) * 0.004 - jx * 0.05; jy += (rnd() - 0.5) * 0.004 - jy * 0.05; }
    P.handOffset.set(p[0] + jx, p[1] + jy);
    G.step();
    const w = P.sword.angvel(); const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation()));
    const W = new THREE.Vector3(w.x, w.y, w.z); W.addScaledVector(b, -W.dot(b));
    bladeW.push(W.length());
    const c = P.bodies.chest.angvel(); chestW.push(Math.hypot(c.x, c.y, c.z));
  }
}
// 천천히 자세 옮기기: 쟁기 → 어깨 지붕 → 왼쪽 쟁기 → 긴 자세, 각각 0.8초에 걸쳐 (휘두르기 아님)
const G = newRound({ walls: false }); G.park(); G.ai.update = () => {};
const P = G.player; P.skill.level = 0.7;
const path = [[0.18, -0.28], [0.42, 0.42], [-0.18, -0.28], [0.0, 0.03]];
P.handOffset.set(...path[0]); for (let i = 0; i < 1.2 / DT; i++) G.step();
const yaw = []; const cw2 = [];
for (let k = 1; k < path.length; k++) {
  const a = path[k - 1], b = path[k];
  for (let i = 0; i < 0.8 / DT; i++) { const t = (i + 1) * DT / 0.8; P.handOffset.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); G.step(); const c = P.bodies.chest.angvel(); cw2.push(Math.hypot(c.x, c.y, c.z)); yaw.push(P.bodyPose.chestYaw); }
  for (let i = 0; i < 0.6 / DT; i++) { G.step(); const c = P.bodies.chest.angvel(); cw2.push(Math.hypot(c.x, c.y, c.z)); yaw.push(P.bodyPose.chestYaw); }
}
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const yawRange = (Math.max(...yaw) - Math.min(...yaw)) * 57.3;
console.log(`${variant}: jitter bladeW_rms ${rms(bladeW).toFixed(2)} chestW_rms ${rms(chestW).toFixed(2)} | slow-move chestW_rms ${rms(cw2).toFixed(2)} chestYaw range ${yawRange.toFixed(0)}°`);

// ── 자세 유지 오차(guard-hold error): 자세 하나를 잡고 오래 버틸 때, 손가락이 잘게 떨려도
//    칼끝 방향·몸통 비틀림이 그 자세의 "정답"에서 얼마나 벗어나는가 (도) ──
{
  const holdPads = [GUARDS[2].pad, GUARDS[5].pad, GUARDS[0].pad]; // 황소, 쟁기, 지붕(위)
  const devDir = [], devYaw = [];
  for (const pad of holdPads) {
    const G = newRound({ walls: false }); G.park(); G.ai.update = () => {};
    const P = G.player; P.skill.level = 0.7;
    P.handOffset.set(pad[0], pad[1]); for (let i = 0; i < 2.5 / DT; i++) G.step();
    const target = guardAt(pad[0], pad[1], {});
    const targetDir = new THREE.Vector3(...target.dir).applyQuaternion(P.yaw);
    const yaw0 = P.bodyPose.chestYaw;
    let jx = 0, jy = 0;
    for (let i = 0; i < 3 / DT; i++) {
      if (i % 2 === 0) { jx += (rnd() - 0.5) * 0.004 - jx * 0.05; jy += (rnd() - 0.5) * 0.004 - jy * 0.05; }
      P.handOffset.set(pad[0] + jx, pad[1] + jy);
      G.step();
      const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation()));
      devDir.push(ang(blade, targetDir));
      devYaw.push(Math.abs(P.bodyPose.chestYaw - yaw0) * 57.3);
    }
  }
  console.log(`${variant}: guard-hold error  bladeDir ${(Math.max(...devDir)).toFixed(1)}°(최대) ${rms(devDir).toFixed(1)}°(rms)  chestYaw ${(Math.max(...devYaw)).toFixed(1)}°(최대) ${rms(devYaw).toFixed(1)}°(rms)`);
}

