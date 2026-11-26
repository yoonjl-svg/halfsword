// 팔꿈치 돌림 고르기 재기 (재는 사본 — inst_es.py 가 넣은 줄이 부름): ROOT=<나무> LABEL=<이름> node --import file://<이 파일> <도구>
const root = process.env.ROOT;
const { Fighter, HUMAN } = await import(root + '/src/fighter.js');
const HD = Math.PI / 180;
const N = [HUMAN.shoulderPlane[1] - 90, HUMAN.shoulderPlane[0] + 90].map((c) => [Math.sin(c * HD), Math.cos(c * HD)]);
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const st = { n: 0, thr1: 0, thrJump: 0, thrRev: 0, thrJump2h: 0, thrJump1h: 0, genJumpWant: 0, f1: 0, f1human1h: 0, r0out: 0, r0outHuman: 0, hair: 0, hairHuman: 0, flip: 0, wantFar: 0 };
let cur = null;
const prev = new WeakMap();
const ik = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (...a) { cur = this._ikMain ? this : null; try { return ik.apply(this, a); } finally { cur = null; } };
globalThis.__ES = (br, want, th0, k, human, rope, r0, a0, pDir, Dn, ca, sa, side) => {
  if (!cur) return; // 본 부름만
  st.n++;
  const two = !!cur.weaponCfg?.twoHand;
  const d = wrap(want - th0) / HD;
  const ux = ca * Dn.x + sa * pDir.x, uz = ca * Dn.z + sa * pDir.z;
  const m0 = Math.min(N[0][0] * ux + side * N[0][1] * uz, N[1][0] * ux + side * N[1][1] * uz);
  const P = prev.get(cur);
  if (br === 'thrust' && k === 1) {
    st.thr1++;
    if (Math.abs(d) > 20) { st.thrJump++; if (two) st.thrJump2h++; else st.thrJump1h++; if (P && P.thrD != null && Math.abs(P.thrD) > 20 && Math.sign(P.thrD) !== Math.sign(d)) st.thrRev++; }
  }
  if (!r0) { st.r0out++; if (human) st.r0outHuman++; }
  if (human && !r0 && want === th0 && !a0) { st.f1++; if (!two) st.f1human1h++; }
  if (m0 < 0 && m0 > -Math.sin(2 * HD) && Math.abs(want) > 30 * HD) { st.hair++; if (human) st.hairHuman++; }
  if (P && Math.sign(P.m0) !== Math.sign(m0) && Math.abs(wrap(want - P.want)) > 30 * HD) st.flip++;
  if (Math.abs(want) > 60 * HD) st.wantFar++;
  prev.set(cur, { thrD: br === 'thrust' && k === 1 ? d : null, m0, want });
};
process.on('exit', () => process.stderr.write(`돌림재기 ${process.env.LABEL}: 본 부름 ${st.n} · 찌르기 맞춤(k=1) ${st.thr1} 중 20° 넘는 바람 ${st.thrJump} (두손 ${st.thrJump2h} · 한손 ${st.thrJump1h}) 잇달아 뒤집힘 ${st.thrRev} · 0 이 밧줄 밖 ${st.r0out} (사람 범위 팔 ${st.r0outHuman}) · [지적 1] 사람 범위 밖 자리에 머묾 ${st.f1} (한손 ${st.f1human1h}) · [지적 3] 2° 안 넘음인데 30° 넘게 바람 ${st.hair} (사람 범위 팔 ${st.hairHuman}) · 밧줄 면 넘나들며 30° 넘게 바뀜 ${st.flip} · |바람| 60° 넘음 ${st.wantFar}\n`));
