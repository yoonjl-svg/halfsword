// 팔 명령 뜀 재기 둘 (미리 싣는 재기 · 읽기만): ROOT=<나무> LABEL=<이름> node --import file://<이 파일> <나무>/tools/sim/fights12.mjs
//  칼 팔: tools/sim/arm_cmd_probe.mjs 와 같은 셈 — armIK 본 부름(_ikMain)마다 위팔 명령 x 축(uarmS.target) 방향의 바뀜 각 · 8° · 20° 넘는 수 · 가장 큰
//  빈 팔: off_cmd.mjs 와 같은 셈 — 싸움꾼 step 끝마다 서 있는(state stand) 스텝의 빈 위팔 명령(uarmO.target 사원수) 바뀜 각 · 서 있지 않으면 잇기 끊음
//  줄 꼴: '팔 명령2 <이름>: 칼 팔 N · >8° a · >20° b · 가장 큰 c° | 빈 팔 M · >8° d · >20° e · 가장 큰 f°'
const root = process.env.ROOT;
if (!root) throw new Error('arm_cmd2: ROOT=<나무> 가 필요하다');
const { Fighter } = await import(root + '/src/fighter.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const HD = Math.PI / 180;
const S = { n: 0, j8: 0, j20: 0, max: 0, tmax: null }, O = { n: 0, j8: 0, j20: 0, max: 0 };
const prevS = new WeakMap(), prevO = new WeakMap();
const X = new THREE.Vector3();
const ik = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (...a) {
  const r = ik.apply(this, a);
  if (this._ikMain) {
    const u = X.set(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
    const p = prevS.get(this);
    if (p) {
      const d = Math.acos(Math.max(-1, Math.min(1, u.dot(p)))) / HD;
      S.n++; if (d > 8) S.j8++; if (d > 20) S.j20++; if (d > S.max) S.max = d;
      p.copy(u);
    } else prevS.set(this, u.clone());
  }
  return r;
};
const st = Fighter.prototype.step;
Fighter.prototype.step = function (...a) {
  const r = st.apply(this, a);
  const J = this.jointByName?.uarmO;
  if (J && this.state === 'stand') {
    const p = prevO.get(this);
    if (p) {
      const d = (2 * Math.acos(Math.min(1, Math.abs(J.target.dot(p))))) / HD;
      O.n++; if (d > 8) O.j8++; if (d > 20) O.j20++; if (d > O.max) O.max = d;
      p.copy(J.target);
    } else prevO.set(this, J.target.clone());
  } else prevO.delete(this);
  return r;
};
process.on('exit', () => process.stderr.write(`팔 명령2 ${process.env.LABEL ?? ''}: 칼 팔 ${S.n} · >8° ${S.j8} · >20° ${S.j20} · 가장 큰 ${S.max.toFixed(1)}° | 빈 팔 ${O.n} · >8° ${O.j8} · >20° ${O.j20} · 가장 큰 ${O.max.toFixed(1)}°\n`));
