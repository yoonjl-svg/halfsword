// 빈팔 offArmIK 부름마다 손 축 Dn 과 오늘 팔꿈치 쪽 pDir 을 적음 (읽기만 · 게임 코드 안 바꿈): ROOT=<나무> OUT=<파일.f32> node --import file://<이 파일> <재기 스크립트> ...
//  가슴 틀 · 빈손 쪽으로 맞춤(z' = −side·z — 바깥이 +z'). 부름 하나 = Float32 9 칸:
//   Dn' (3) · 오늘 pDir' (3 — pole 투영을 단위로, 투영이 0 이면 (0,−1,0) 오늘과 같게) · m = |pole 투영| · 손 높이 D.y (어깨 기준 m) · 거리 |D| (m)
//  pole 은 offArmIK 오늘 셈과 같은 (−0.25, −1, −side·0.5). 출력은 exit 때 한 번에 씀.
import { writeFileSync } from 'node:fs';
const root = process.env.ROOT, out = process.env.OUT;
if (!root || !out) throw new Error('dn_rec: ROOT · OUT 이 필요하다');
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const q = new THREE.Quaternion(), D = new THREE.Vector3(), P = new THREE.Vector3();
let buf = new Float32Array(1 << 20), n = 0;
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  D.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub(P.set(0, 0.1, -this.side * 0.2));
  const len = D.length(), hy = D.y;
  D.normalize();
  const pole = P.set(-0.25, -1, -this.side * 0.5).normalize();
  pole.addScaledVector(D, -pole.dot(D));
  const m = pole.length();
  if (pole.lengthSq() < 1e-6) pole.set(0, -1, 0);
  pole.normalize();
  if (n + 9 > buf.length) { const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; }
  const s = -this.side;
  buf.set([D.x, D.y, s * D.z, pole.x, pole.y, s * pole.z, m, hy, len], n); n += 9;
  return orig.call(this, target, ...a);
};
process.on('exit', () => { writeFileSync(out, Buffer.from(buf.buffer, 0, n * 4)); process.stderr.write(`dn_rec ${out}: ${n / 9} 부름\n`); });
