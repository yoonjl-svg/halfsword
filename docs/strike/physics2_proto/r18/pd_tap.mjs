// 빈팔 큰 뜀 형편에 팔꿈치 쪽 남음 |pDir| · 빈 목표 거리 · 길(path) · 새로 시작(fresh) 더함 (읽기만 · 게임 코드 안 바꿈): ROOT=<나무> node --import file://<이 파일> --import file://<r17>/arm_big.mjs ...
//  offArmIK 앞에서 같은 셈(빈 어깨 · pole)으로 f._offPd · f._offT 를 둔다 — arm_big.mjs 가 읽는 칸. f._offPd 는 '|pDir| p<길>' 에 이 스텝 팔꿈치 쪽을 몸에서 새로 세면 ' 새' 가 붙은 글
//  (11/27 읽기 지적: 앞 판은 function (target) 로 감싸 길 인자를 떨궈 늘 path 0 — 고침: 남은 인자를 그대로 넘김)
const root = process.env.ROOT;
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const q = new THREE.Quaternion(), T = new THREE.Vector3(), P = new THREE.Vector3();
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  T.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub(P.set(0, 0.1, -this.side * 0.2));
  this._offT = +T.length().toFixed(3);
  const Dn = T.normalize(), pole = P.set(-0.25, -1, -this.side * 0.5).normalize();
  const path = a[0] ?? 0;
  const fresh = !(this._offElbT >= (this._armTick ?? 0) - 1) || this._offElbP !== path || this._offElbW !== this.weaponCfg; // offElbowDir 와 같은 조건
  this._offPd = `${pole.addScaledVector(Dn, -pole.dot(Dn)).length().toFixed(3)} p${path}${fresh ? ' 새' : ''}`;
  return orig.call(this, target, ...a);
};
