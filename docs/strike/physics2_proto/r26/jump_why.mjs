// 빈 위팔 명령 큰 뜀의 까닭 가르기 (읽기만): ROOT=<나무> LABEL=<이름> node --import file://<이 파일> tools/sim/fights12.mjs
//  arm_cmd2 와 같은 셈(싸움꾼 step 끝 · state stand · uarmO 목표 사원수 바뀜 각) 위에, 그 스텝에 offArmIK 가 몇 번 불렸나 · 마지막 부름의 손 축 Dn(가슴 틀) · 거리를 남겨
//  > 8° 뜀을 나눔: (A) 이 스텝 · 지난 스텝 둘 다 offArmIK — 손 축 Dn 이 돈 각 · 거리 바뀜으로 다시 나눔  (B) 한쪽만 offArmIK (다른 길이 빈팔 목표를 씀 — setZ · slerp 등)  (C) 둘 다 offArmIK 없음
//  (A) 안: 손 축이 2° 넘게 돔 (목표가 뜀) · 거리 2 cm 넘게 바뀜 · 둘 다 작음 (셈 자체 — 팔꿈치 쪽 장) 별로 수 · 가장 큰
const root = process.env.ROOT;
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = 180 / Math.PI, q = new THREE.Quaternion(), T = new THREE.Vector3();
const st = Fighter.prototype.step, ik = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const r = this.bodies.chest.rotation(), c = this.bodies.chest.translation();
  q.set(r.x, r.y, r.z, r.w).invert();
  T.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(q).sub({ x: 0, y: 0.1, z: -this.side * 0.2 });
  (this._jwD ||= new THREE.Vector3()).copy(T).normalize(); this._jwL = T.length(); this._jwN = (this._jwN ?? 0) + 1;
  return ik.call(this, target, ...a);
};
const K = {}; const add = (k, d) => { const s = (K[k] ||= { n: 0, mx: 0, s20: 0 }); s.n++; s.mx = Math.max(s.mx, d); s.s20 += d > 20; };
Fighter.prototype.step = function (...a) {
  this._jwN = 0;
  const r = st.apply(this, a);
  const J = this.jointByName?.uarmO;
  if (J && this.state === 'stand') {
    const p = this._jwP;
    if (p) {
      const d = 2 * Math.acos(Math.min(1, Math.abs(J.target.dot(p.q)))) * HD;
      if (d > 8) {
        const now = this._jwN > 0, was = p.n > 0;
        if (now && was) {
          const da = Math.acos(Math.min(1, this._jwD.dot(p.D))) * HD, dl = Math.abs(this._jwL - p.L);
          add(da > 2 ? 'A 손 축 돎 > 2°' : dl > 0.02 ? 'A 거리 > 2 cm' : 'A 셈 자체', d);
        } else add(now ? 'B 지난 스텝 다른 길' : was ? 'B 이 스텝 다른 길' : 'C offArmIK 없음', d);
      }
      p.q.copy(J.target); p.n = this._jwN; if (this._jwN) { p.D.copy(this._jwD); p.L = this._jwL; }
    } else this._jwP = { q: J.target.clone(), n: this._jwN, D: (this._jwD ?? new THREE.Vector3()).clone(), L: this._jwL ?? 0 };
  } else this._jwP = null;
  return r;
};
process.on('exit', () => { for (const [k, s] of Object.entries(K).sort()) process.stderr.write(`뜀 까닭 ${process.env.LABEL ?? ''} ${k}: > 8° ${s.n} · > 20° ${s.s20} · 가장 큰 ${s.mx.toFixed(1)}°\n`); });
