// T6 빈 팔꿈치가 어색한 쪽에 눌러앉나 (읽기만 · 게임 코드 안 바꿈): ROOT=<나무> OUT=<json> node --import file://<이 파일> <재기 스크립트> ...
//  싸움꾼(몸 하나)마다 서 있는(state stand) 스텝에서 실제 빈 팔꿈치(uarmO 몸 먼 끝 · 가슴 틀 · 빈손 쪽 맞춤 z' = −side·z):
//   (a) 팔꿈치가 어깨(0, 0.1, ∓0.2)보다 0.05 m 넘게 높음  (b) 팔꿈치가 가슴 가운데 줄 건너 칼 쪽(z' < 0)이거나 등뼈 줄(가슴 가운데 세로 줄)에서 0.10 m 안
//   (c) 따라감 띠 머묾: 그 스텝 마지막 offArmIK 의 손 축이 −pole 에서 안 각(칸의 ARM.offElbowIn · 없으면 10°) 안인 스텝이 이어진 동안 —
//       길이(스텝) · 실제 팔꿈치 쪽(위팔의 손 축에 곧은 몫)이 머묾 처음에서 돈 가장 큰 각 · 명령 팔꿈치 쪽이 돈 가장 큰 각
import { writeFileSync } from 'node:fs';
const root = process.env.ROOT, out = process.env.OUT;
if (!root || !out) throw new Error('elb_rec: ROOT · OUT 이 필요하다');
const { Fighter } = await import(root + '/src/fighter.js');
const { ARM } = await import(root + '/src/config.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const ZIN = ARM.offElbowIn ?? 10, HD = 180 / Math.PI, K = Symbol('r31er'), all = [];
const qi = new THREE.Quaternion(), qb = new THREE.Quaternion(), D = new THREE.Vector3(), P = new THREE.Vector3(), A = new THREE.Vector3(), C = new THREE.Vector3(), E = new THREE.Vector3();
const rec = (f) => f[K] || (f[K] = (all.push({ n: 0, a: 0, b: 0, dw: [], cur: null, last: null }), all[all.length - 1]));
const perp = (v, n, o) => { o.copy(v).addScaledVector(n, -v.dot(n)); const m = o.length(); return m > 1e-9 ? o.divideScalar(m) : null; };
const ang = (p, q) => Math.acos(Math.max(-1, Math.min(1, p.dot(q)))) * HD;
const chestInv = (f) => { const r = f.bodies.chest.rotation(); return qi.set(r.x, r.y, r.z, r.w).invert(); };
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (target, ...a) {
  const c = this.bodies.chest.translation(); chestInv(this);
  D.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(qi).sub(P.set(0, 0.1, -this.side * 0.2)).normalize();
  const th = Math.acos(Math.max(-1, Math.min(1, -D.dot(P.set(-0.25, -1, -this.side * 0.5).normalize())))) * HD;
  const ub = this.bodies.uarmO.rotation();
  const act = perp(A.set(0, -1, 0).applyQuaternion(qb.set(ub.x, ub.y, ub.z, ub.w)).applyQuaternion(qi), D, A);
  const actV = act ? act.clone() : null, Dn = D.clone();
  const r = orig.call(this, target, ...a);
  const cmd = perp(C.set(0, -1, 0).applyQuaternion(this.jointByName.uarmO.target), Dn, C);
  rec(this).last = { th, act: actV, cmd: cmd ? cmd.clone() : null };
  return r;
};
const close = (R) => { if (R.cur) { R.dw.push([R.cur.len, +R.cur.dr.toFixed(2), +R.cur.dc.toFixed(2)]); R.cur = null; } };
const st = Fighter.prototype.step;
Fighter.prototype.step = function (...a) {
  const R0 = this.bodies ? rec(this) : null; if (R0) R0.last = null;
  const r = st.apply(this, a);
  if (!R0 || !this.jointByName?.uarmO) return r;
  const R = R0;
  if (this.state !== 'stand') { close(R); return r; }
  R.n++;
  const u = this.bodies.uarmO, t = u.translation(), q = u.rotation(), c = this.bodies.chest.translation(); chestInv(this);
  E.set(0, -0.15, 0).applyQuaternion(qb.set(q.x, q.y, q.z, q.w)).add(t).sub(c).applyQuaternion(qi);
  const zo = -this.side * E.z;
  if (E.y - 0.1 > 0.05) R.a++;
  if (zo < 0 || Math.hypot(E.x, zo) < 0.1) R.b++;
  const L = R.last;
  if (L && L.th < ZIN && L.act && L.cmd) {
    if (!R.cur) R.cur = { len: 1, a0: L.act, c0: L.cmd, dr: 0, dc: 0 };
    else { R.cur.len++; R.cur.dr = Math.max(R.cur.dr, ang(L.act, R.cur.a0)); R.cur.dc = Math.max(R.cur.dc, ang(L.cmd, R.cur.c0)); }
  } else close(R);
  return r;
};
process.on('exit', () => { for (const R of all) close(R); writeFileSync(out, JSON.stringify({ zin: ZIN, f: all.map(({ n, a, b, dw }) => ({ n, a, b, dw })) })); });
