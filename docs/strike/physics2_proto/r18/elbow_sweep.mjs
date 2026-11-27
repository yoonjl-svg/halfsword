// 빈 팔꿈치 쪽 쓸기 (읽기만 · 몸은 안 움직임): ROOT=<나무> node elbow_sweep.mjs [--rows]
//  롱소드 몸 하나를 세워 1 초 둔 뒤, 몸은 멈춘 채 빈손 목표를 가슴 틀에서 어깨 → pole(아래 · 뒤 · 바깥) 쪽을 지나게 쓸며 스텝마다 offArmIK 를 부른다 (_armTick 을 하나씩 늘림).
//  쓸기: 방향 = pole + s·v + b·w (v · w 는 pole 에 곧은 두 축) · s −0.6 → 0.6 을 120 스텝(1 초) · 빗나감 b = 0 · 0.01 · 0.03 · 0.05 · 0.2 · 거리 0.45 m — 그 뒤 보통 자리(앞 아래 [0.35, −0.25, 0.1])로 60 스텝 옮겨 120 스텝 둠.
//  줄마다: 가장 큰 한 스텝 명령 뜀(uarmO.target 사원수 각) · 팔꿈치 방향(위팔의 축에 곧은 몫) 가장 큰 한 스텝 돎 · 끝에 팔꿈치와 pole 쪽 사이 각(덫 ② — 보통 자리로 돌아와 pole 쪽으로 왔나).
//  덫 ① 쓸기: 기억된 팔꿈치를 pole 의 반대쪽에 둔 채 보통 자리에서 시작 (반대쪽 섞기가 0 을 지나 뒤집히나) — 지금 위팔을 반대로 놓고 시작.
const root = process.env.ROOT;
const H = await import(root + '/tools/sim/harness_m.mjs');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const ROWS = process.argv.includes('--rows');
const HD = 180 / Math.PI;
const G = H.newRound({ weapon: 'longsword', weapon2: 'longsword', seed: 1, gap: 3 });
const f = G.player;
G.ai.update = () => {};
for (let i = 0; i < 120; i++) G.step();
const J = f.jointByName;
const ch = f.bodies.chest, r = ch.rotation(), c = ch.translation();
const qc = new THREE.Quaternion(r.x, r.y, r.z, r.w), C = new THREE.Vector3(c.x, c.y, c.z);
const S = new THREE.Vector3(0, 0.1, -f.side * 0.2);
const pole = new THREE.Vector3(-0.25, -1, -f.side * 0.5).normalize();
const v = new THREE.Vector3(1, 0, 0).addScaledVector(pole, -pole.x).normalize();
const w = new THREE.Vector3().crossVectors(pole, v).normalize();
const world = (pc) => pc.clone().applyQuaternion(qc).add(C);
const elbow = () => { // 위팔 방향(가슴 틀)의 축에 곧은 몫 · 축 = 지금 목표 방향
  const u = new THREE.Vector3(0, -1, 0).applyQuaternion(J.uarmO.target);
  return u;
};
let tick = (f._armTick ?? 0) + 10;
function run(targets, label, path = 2) {
  // 앞 스텝(부르기 전) 명령에서부터 잼 — 첫 스텝 뜀도 셈
  const D0 = targets[0].clone().sub(S).normalize(), u0 = elbow();
  let prevQ = J.uarmO.target.clone(), prevE = u0.addScaledVector(D0, -u0.dot(D0)), maxJ = 0, maxE = 0, at = -1;
  const rows = [];
  targets.forEach((pc, i) => {
    f._armTick = ++tick;
    f.offArmIK(world(pc), path);
    const q = J.uarmO.target.clone();
    const Dn = pc.clone().sub(S).normalize();
    const u = elbow();
    const e = u.clone().addScaledVector(Dn, -u.dot(Dn));
    const pr = pole.clone().addScaledVector(Dn, -pole.dot(Dn));
    if (prevQ) {
      const j = 2 * Math.acos(Math.min(1, Math.abs(prevQ.dot(q)))) * HD;
      const ea = e.lengthSq() > 1e-12 && prevE.lengthSq() > 1e-12 ? e.angleTo(prevE) * HD : 0;
      if (j > maxJ) (maxJ = j), (at = i);
      maxE = Math.max(maxE, ea);
      if (ROWS) rows.push(`${label} ${i} |pDir| ${pr.length().toFixed(3)} 뜀 ${j.toFixed(1)}° 팔꿈치 돎 ${ea.toFixed(1)}° 팔꿈치-pole ${(e.angleTo(pr) * HD).toFixed(0)}°`);
    }
    prevQ = q; prevE = e;
  });
  const Dn = targets.at(-1).clone().sub(S).normalize();
  const u = elbow(), e = u.addScaledVector(Dn, -u.dot(Dn)), pr = pole.clone().addScaledVector(Dn, -pole.dot(Dn));
  console.log(`${label.padEnd(26)} 가장 큰 뜀 ${maxJ.toFixed(1)}° (스텝 ${at}) · 팔꿈치 한 스텝 가장 큰 돎 ${maxE.toFixed(1)}° · 끝 팔꿈치-pole 쪽 ${(e.angleTo(pr) * HD).toFixed(1)}°`);
  if (ROWS) console.log(rows.join('\n'));
}
const R = 0.45, home = new THREE.Vector3(0.35, -0.25, -f.side * 0.1);
const lerpPts = (A, B, n) => Array.from({ length: n }, (_, i) => A.clone().lerp(B, (i + 1) / n));
for (const b of [0, 0.01, 0.03, 0.05, 0.2]) {
  const sw = Array.from({ length: 121 }, (_, i) => { const s = -0.6 + (1.2 * i) / 120; return S.clone().addScaledVector(pole.clone().addScaledVector(v, s).addScaledVector(w, b).normalize(), R); });
  const start = sw[0];
  f._armTick = ++tick; f.offArmIK(world(start), 2); // 시작 자리 (기억 시작)
  for (let i = 0; i < 240; i++) { f._armTick = ++tick; f.offArmIK(world(start), 2); }
  run([...sw, ...lerpPts(sw.at(-1), home, 60), ...Array(120).fill(home)], `쓸기 빗나감 b=${b}`);
}
// 덫 ①: 기억이 pole 반대쪽인 채로 보통 자리에서 (기억된 팔꿈치를 반대로 뒤집어 넣음 — 기억이 없는 나무에선 그냥 보통 자리)
f._armTick = ++tick; f.offArmIK(world(home), 2);
if (f._offElb) f._offElb.negate();
f._armTick = ++tick; f.offArmIK(world(home), 2); // 뒤집힌 기억의 첫 명령 (여기서부터 잼 — 기억을 뒤집은 것은 이 재기의 손이라 그 한 스텝은 안 셈)
run(Array(240).fill(home), '덫 ① 반대쪽 기억에서');
// 몸에서 시작: 다른 길(1)로 바꾸는 첫 스텝 — 지금 위팔(서 있는 몸)과 명령 차
{
  const ub = f.bodies.uarmO.rotation();
  const qb = qc.clone().invert().multiply(new THREE.Quaternion(ub.x, ub.y, ub.z, ub.w));
  f._armTick = ++tick + 5; f.offArmIK(world(home), 1);
  const ub0 = new THREE.Vector3(0, -1, 0).applyQuaternion(qb), u1 = new THREE.Vector3(0, -1, 0).applyQuaternion(J.uarmO.target);
  console.log(`길 바꿈 첫 스텝: 몸 위팔 ↔ 명령 위팔 ${(ub0.angleTo(u1) * HD).toFixed(1)}°`);
}
