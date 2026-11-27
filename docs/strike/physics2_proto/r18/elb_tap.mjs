// 빈 위팔 명령 한 스텝 돎을 |pDir|(m) 칸별로 모음 (읽기만 · 게임 코드 안 바꿈 — 11/27 읽기 지적 '축 위 헤맴'): ROOT=<나무> node --import file://<이 파일> tools/sim/fights12.mjs
//  offArmIK 가 불린 스텝마다 uarmO 목표가 지난 불림(바로 앞 스텝일 때만)에서 돈 각 · m = |pole − (pole·Dn)Dn| (빈 어깨 · pole 은 offArmIK 와 같은 셈)
//  칸: m < 0.05 (면 안 정해짐) · 0.05 ~ 0.488 · ≥ 0.488 (늘어뜨린 팔 m0 위) — 스텝 수 · 평균 °/스텝 · 1° 넘는 스텝 · 가장 큰
const root = process.env.ROOT;
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = 180 / Math.PI, q = new THREE.Quaternion(), T = new THREE.Vector3(), P = new THREE.Vector3();
const B = [0.05, 0.488, 9], st = B.map(() => ({ n: 0, s: 0, g1: 0, mx: 0 }));
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  T.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub(P.set(0, 0.1, -this.side * 0.2)).normalize();
  const pole = P.set(-0.25, -1, -this.side * 0.5).normalize(), m = pole.addScaledVector(T, -pole.dot(T)).length();
  const ret = orig.call(this, target, ...a);
  const tick = this._armTick ?? 0, J = this.jointByName.uarmO;
  if (this._tapQ && this._tapT === tick - 1) { // 지난 스텝 마지막 불림 → 이 스텝 첫 불림
    const d = 2 * Math.acos(Math.min(1, Math.abs(J.target.dot(this._tapQ)))) * HD, s = st[B.findIndex((b) => m < b)];
    s.n++; s.s += d; s.g1 += d > 1; s.mx = Math.max(s.mx, d);
  }
  (this._tapQ ||= new THREE.Quaternion()).copy(J.target); this._tapT = tick; // 한 스텝에 여러 번이면 마지막 것
  return ret;
};
process.on('exit', () => {
  const L = ['m < 0.05', '0.05 ≤ m < 0.488', 'm ≥ 0.488'];
  st.forEach((s, i) => process.stderr.write(`빈 위팔 명령 돎 ${process.env.LABEL ?? ''} ${L[i]}: 스텝 ${s.n} · 평균 ${(s.s / Math.max(1, s.n)).toFixed(3)}°/스텝 (${(s.s / Math.max(1, s.n) * 120).toFixed(0)}°/초) · 1° 넘음 ${s.g1} · 가장 큰 ${s.mx.toFixed(1)}°\n`));
});
