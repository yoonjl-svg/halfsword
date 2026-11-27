// 팔 명령 뜀을 싸움꾼마다 따로 셈 (읽기만 · r9b arm_cmd2 와 같은 셈): ROOT=<나무> OUT=<json> node --import file://<이 파일> <재기 스크립트>
//  칼 팔: armIK 본 부름(_ikMain)마다 uarmS.target x 축 바뀜 각 · 빈 팔: step 끝 · state stand 의 uarmO.target 사원수 바뀜 각 (서 있지 않으면 잇기 끊음)
//  싸움꾼(몸 하나)마다 > 8° 수 — T4 · T1 의 씨앗 흔들림(싸움꾼 묶음 붓스트랩)에 씀. arm_cmd2 와 함께 실어도 서로 안 건드림
import { writeFileSync } from 'node:fs';
const root = process.env.ROOT, out = process.env.OUT;
if (!root || !out) throw new Error('arm_seed: ROOT · OUT 이 필요하다');
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = 180 / Math.PI, K = Symbol('r31as'), all = [], X = new THREE.Vector3();
const rec = (f) => f[K] || (f[K] = (all.push({ s: 0, s8: 0, o: 0, o8: 0, pS: null, pO: null }), all[all.length - 1]));
const ik = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (...a) {
  const r = ik.apply(this, a);
  if (this._ikMain) {
    const R = rec(this), u = X.set(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
    if (R.pS) { const d = Math.acos(Math.max(-1, Math.min(1, u.dot(R.pS)))) * HD; R.s++; if (d > 8) R.s8++; R.pS.copy(u); } else R.pS = u.clone();
  }
  return r;
};
const st = Fighter.prototype.step;
Fighter.prototype.step = function (...a) {
  const r = st.apply(this, a);
  const J = this.jointByName?.uarmO;
  if (J) {
    const R = rec(this);
    if (this.state === 'stand') {
      if (R.pO) { const d = 2 * Math.acos(Math.min(1, Math.abs(J.target.dot(R.pO)))) * HD; R.o++; if (d > 8) R.o8++; R.pO.copy(J.target); } else R.pO = J.target.clone();
    } else R.pO = null;
  }
  return r;
};
process.on('exit', () => writeFileSync(out, JSON.stringify(all.map(({ s, s8, o, o8 }) => ({ s, s8, o, o8 })))));
