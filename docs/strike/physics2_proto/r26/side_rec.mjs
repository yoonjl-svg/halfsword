// 빈팔 offArmIK 가 실제로 낸 팔꿈치 쪽을 셈 (읽기만 · 게임 코드 안 바꿈 — 조건 ④ 사람 쪽): ROOT=<나무> OUT=<파일.f32> node --import file://<이 파일> <재기 스크립트> ...
//  offArmIK 를 부른 바로 뒤 uarmO 목표에서 위팔 방향 u = −(목표 몸체 y 축)를 읽고, 게임이 쓴 팔꿈치 쪽 = u 에서 Dn 몫을 뺀 단위.
//  부름 하나 = Float32 8 칸 (가슴 틀 · 빈손 쪽 맞춤 z' = −side·z): Dn' (3) · 게임 pDir' (3) · 손 높이 D.y (어깨 기준 m) · 위팔 u.y (+ 면 팔꿈치가 어깨 위)
import { writeFileSync } from 'node:fs';
const root = process.env.ROOT, out = process.env.OUT;
if (!root || !out) throw new Error('side_rec: ROOT · OUT 이 필요하다');
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const q = new THREE.Quaternion(), D = new THREE.Vector3(), P = new THREE.Vector3(), U = new THREE.Vector3();
let buf = new Float32Array(1 << 20), n = 0;
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  D.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub(P.set(0, 0.1, -this.side * 0.2));
  const hy = D.y;
  D.normalize();
  const ret = orig.call(this, target, ...a);
  U.set(0, -1, 0).applyQuaternion(this.jointByName.uarmO.target); // 위팔 방향 (offArmIK: 몸체 y = −u)
  const uy = U.y;
  U.addScaledVector(D, -U.dot(D));
  if (U.lengthSq() > 1e-12) U.normalize(); else U.set(0, 0, 0); // 팔이 곧게 펴져 팔꿈치 쪽이 안 보이는 부름은 0
  if (n + 8 > buf.length) { const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
  const s = -this.side;
  buf.set([D.x, D.y, s * D.z, U.x, U.y, s * U.z, hy, uy], n); n += 8;
  return ret;
};
process.on('exit', () => { writeFileSync(out, Buffer.from(buf.buffer, 0, n * 4)); process.stderr.write(`side_rec ${out}: ${n / 8} 부름\n`); });
