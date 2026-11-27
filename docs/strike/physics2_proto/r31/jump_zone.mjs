// 'A 셈 자체' 뜀(r26 jump_why 와 같은 가름)이 어느 띠에서 나나 (읽기만): ROOT=<나무> OUT=<json> node --import file://<이 파일> tools/sim/fights12.mjs
//  jump_why 와 같이: step 끝 · state stand · uarmO 목표 바뀜 > 8° · 이 스텝 · 지난 스텝 둘 다 offArmIK · 손 축 돎 ≤ 2° · 거리 바뀜 ≤ 2 cm → 셈 자체.
//  그 뜀마다 이 스텝 손 축의 −pole 각 θ(°) · 실제 위팔의 손 축 곧은 몫 m(지난 · 이 스텝) · 실제 팔꿈치 쪽이 한 스텝에 돈 각 · 뜀 각 을 적음
import { writeFileSync } from 'node:fs';
const root = process.env.ROOT, out = process.env.OUT;
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = 180 / Math.PI, q = new THREE.Quaternion(), qb = new THREE.Quaternion(), T = new THREE.Vector3(), P = new THREE.Vector3(), A = new THREE.Vector3();
const st = Fighter.prototype.step, ik = Fighter.prototype.offArmIK, rows = [];
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  T.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub(P.set(0, 0.1, -this.side * 0.2));
  const L = T.length(); T.normalize();
  const th = Math.acos(Math.max(-1, Math.min(1, -T.dot(P.set(-0.25, -1, -this.side * 0.5).normalize())))) * HD;
  const u = this.bodies.uarmO.rotation();
  A.set(0, -1, 0).applyQuaternion(qb.set(u.x, u.y, u.z, u.w)).applyQuaternion(q); A.addScaledVector(T, -A.dot(T));
  this._jz = { D: T.clone(), L, th, m: A.length(), e: A.clone().normalize() }; this._jzN = (this._jzN ?? 0) + 1;
  return ik.call(this, target, ...a);
};
Fighter.prototype.step = function (...a) {
  this._jzN = 0;
  const r = st.apply(this, a);
  const J = this.jointByName?.uarmO;
  if (J && this.state === 'stand') {
    const p = this._jzP, now = this._jzN > 0 ? this._jz : null;
    if (p) {
      const d = 2 * Math.acos(Math.min(1, Math.abs(J.target.dot(p.q)))) * HD;
      if (d > 8 && now && p.z) {
        const da = Math.acos(Math.min(1, now.D.dot(p.z.D))) * HD, dl = Math.abs(now.L - p.z.L);
        if (da <= 2 && dl <= 0.02) rows.push([+d.toFixed(1), +now.th.toFixed(2), +p.z.th.toFixed(2), +now.m.toFixed(3), +p.z.m.toFixed(3), +(Math.acos(Math.max(-1, Math.min(1, now.e.dot(p.z.e)))) * HD).toFixed(1)]);
      }
      p.q.copy(J.target); p.z = now;
    } else this._jzP = { q: J.target.clone(), z: now };
  } else this._jzP = null;
  return r;
};
process.on('exit', () => writeFileSync(out, JSON.stringify(rows)));
