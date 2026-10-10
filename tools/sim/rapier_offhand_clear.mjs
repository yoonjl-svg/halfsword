// 빈팔 ↔ 제 칼 거리 (10/10 이탈리아 빈팔 고증 — schools.js offArm): 플레이어 레이피어가 기술 길마다 혼자 휘두를 때
//  빈팔(위팔·아래팔 캡슐 선분)과 제 칼날 선분(bladePoint 0 → 1) 사이 가장 가까운 거리. 빈팔은 제 칼과 물리로 닿지 않는다(충돌 묶음 bodyGroups)
//  → 겉으로 겹쳐 보이는지(거리 < 캡슐 반지름 0.045 + 칼 두께 0.01) 프레임 수를 센다. 읽기만 (물리·난수 무관)
//  node tools/sim/rapier_offhand_clear.mjs [무기id=rapier]
//  OA_OFF=1: 이탈리아 빈팔 칸을 끈다(전 = 오늘 그대로 자세)
import { newRound, DT, THREE } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { getWeapon } from '../../src/weapons.js';
const id = process.argv[2] || 'rapier';
if (process.env.OA_OFF === '1') delete TRADITIONS.italian.offArm;
const W = getWeapon(id);
const art = resolveSwordArt(W);
const T = art.school.tech;
const segDist = (p1, q1, p2, q2) => { // 두 선분 사이 최단 거리
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  s = den > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
};
const ends = (rb, half) => {
  const t = rb.translation(), r = rb.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const c = new THREE.Vector3(t.x, t.y, t.z);
  const u = new THREE.Vector3(0, half, 0).applyQuaternion(q);
  return [c.clone().add(u), c.clone().sub(u)];
};
console.log(`${id} 빈팔 ↔ 제 칼 (${process.env.OA_OFF === '1' ? '빈팔 칸 끔 = 전' : `빈팔 칸 ${JSON.stringify(TRADITIONS[art.tradition]?.offArm ?? null)}`}) — 기술: 가장 가까운 m · 겹쳐 보이는 프레임(< 0.055 m)`);
let worst = Infinity, overlapAll = 0, framesAll = 0;
const rows = [];
for (const tech of [{ name: '(대기)', from: T[0].from, path: [] }, ...T]) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  const set = (x, y) => { P.handOffset.set(x, y); P.skill.aimRaw?.set?.(x, y); };
  set(tech.from[0], tech.from[1]);
  for (let t = 0; t < 0.8; t += DT) G.step();
  const pts = tech.path.map((p) => p.slice());
  let cur = [tech.from[0], tech.from[1]];
  let min = Infinity, over = 0, n = 0;
  for (let t = 0; t < 2.0; t += DT) {
    if (pts.length) {
      const [tx, ty] = pts[0];
      const dx = tx - cur[0], dy = ty - cur[1], L = Math.hypot(dx, dy), stp = 11 * DT;
      if (L <= stp) { cur = [tx, ty]; pts.shift(); } else cur = [cur[0] + (dx / L) * stp, cur[1] + (dy / L) * stp];
      set(cur[0], cur[1]);
    }
    G.step();
    const b0 = P.bladePoint(0, new THREE.Vector3()), b1 = P.bladePoint(1, new THREE.Vector3());
    const [u0, u1] = ends(P.bodies.uarmO, 0.105), [f0, f1] = ends(P.bodies.farmO, 0.095); // 캡슐 선분 반 길이 (fighter.js partDefs)
    const d = Math.min(segDist(u0, u1, b0, b1), segDist(f0, f1, b0, b1)) - 0.045;
    min = Math.min(min, d);
    n++;
    if (d < 0.01) over++;
  }
  worst = Math.min(worst, min);
  overlapAll += over;
  framesAll += n;
  rows.push(`${tech.name} ${min.toFixed(3)} · ${over}`);
}
console.log(`  ${rows.join(' | ')}`);
console.log(`  모두: 가장 가까운 ${worst.toFixed(3)} m · 겹쳐 보이는 프레임 ${overlapAll}/${framesAll}`);
