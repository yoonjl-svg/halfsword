// Independent check of motorRoom / motorSpring / motorDamp with a fake LegDrive `this` (no engine).
// Usage: (cd $S/wt_cap && node $S/r27/read/room_check.mjs)
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
const ROOT = resolve('.');
const M = await import(pathToFileURL(join(ROOT, 'src/legs_vmc.js')).href);
const C = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const THREE = (await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href));
const { LegDrive } = M; const LEGS = C.LEGS; const lim = LEGS.limit;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function fake(str = 1, h = 1 / 240) {
  const mkL = (k) => ({ k, thighN: 'thigh' + k, shinN: 'shin' + k, footN: 'foot' + k, tqH: V(), tqK: V(), tqA: V(),
    mRp: new Float64Array(7), mRm: new Float64Array(7), mCutK: new Float64Array(7), mDf: new Float64Array(7), mW: new Float64Array(7), mA: new Float64Array(7) });
  const av = {}; for (const n of ['pelvis', 'thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB']) av[n] = V();
  const o = Object.create(LegDrive.prototype);
  Object.assign(o, { legs: { F: mkL('F'), B: mkL('B') }, av, hSub: h, strengthOf: () => str });
  return o;
}
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const I = new THREE.Quaternion();
// --- 1) hand cases: knee, identity frames ---
console.log('== hand cases (identity frames, str 1, h 1/240) ==');
for (const k of ['F', 'B']) {
  const D = fake(); const L = D.legs[k];
  // drive: parent-side knee torque -200 (extension) along thigh z; joint speed child-parent = +2 rad/s about z
  L.tqK.set(0, 0, -200); D.av['shin' + k].set(0, 0, 2);
  const o = D.motorRoom('shin' + k, I, I);
  console.log(`knee ${k}: rp ${f3(L.mRp[o])} (hand: R- = 250-200 = 50) rm ${f3(L.mRm[o])} (hand: R+ = 130+200 = 330) mW ${f3(L.mW[o])} (hand 2)`);
  // spring: k 1000, target 0.1 above engine angle 0, tv 0 -> ke=100, c = 1000*h*(0-2)= -8.333 ; ke+c=91.67 > 50 -> t = 0 + (50+8.333)/1000 = 0.058333
  const t = D.motorSpring(k, o, 0.1, 0, 1000);
  console.log(`  spring t ${f3(t)} (hand 0.058) cut ${L.mCutK[o]}`);
  // damp: dw = 0-2 = -2 <0 -> B = rm + sp, sp = 1000*0.058333 + 1000*h*(-2) = 58.333-8.333=50 -> B=380 -> d*2<=380 for d<=190; with d=300 -> d_eff 190
  const d = D.motorDamp(k, o, t, 0, 1000, 300);
  console.log(`  d_eff ${f3(d)} (hand 190) ; total model k e + (h k + d) dw = ${f3(1000 * t + (1000 / 240 + d) * -2)} in [-${f3(L.mRm[o])}, ${f3(L.mRp[o])}]`);
}
// ankle z with identity: drive parent-side +240 (plantar), limit plantar 250 dorsi 60
for (const k of ['F', 'B']) {
  const D = fake(); const L = D.legs[k];
  L.tqA.set(0, 0, 240);
  const o = D.motorRoom('foot' + k, I, I);
  console.log(`ankle ${k} z: motor + (child +z = dorsi) uses parent-side - room: rp ${f3(L.mRp[o + 2])} (hand dorsi 60+240=300) rm ${f3(L.mRm[o + 2])} (hand plantar 250-240=10); x rp/rm ${f3(L.mRp[o])}/${f3(L.mRm[o])} (50/50)`);
}
// --- 2) property test: random rotations, random drive, random motor torques within room -> drive+motor within limit on each limit axis ---
console.log('== property test, random frames (hip/knee/ankle x F/B, str random) ==');
const rq = () => new THREE.Quaternion(Math.random() - .5, Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
const KEYS = { t: [['hipAbd', 'hipAbd'], ['hipRot', 'hipRot'], ['hipFlex', 'hipFlex']], s: [['kneeExt', 'kneeFlex']], f: [['ankleInv', 'ankleInv'], ['ankleRot', 'ankleRot'], ['ankleDorsi', 'anklePlantar']] };
let worst = -Infinity, bad = 0, N = 0, maxUse = 0;
for (let it = 0; it < 20000; it++) {
  for (const kind of ['t', 's', 'f']) for (const k of ['F', 'B']) {
    const str = Math.random(); const D = fake(str); const L = D.legs[k];
    const qp = rq(), qc = kind === 's' ? qp.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.random() * 2)) : rq();
    const name = (kind === 't' ? 'thigh' : kind === 's' ? 'shin' : 'foot') + k;
    const n = KEYS[kind].length;
    // limit axes b_j (world); drive inside limit
    const qL = kind === 's' ? qp : qc; const b = [0, 1, 2].slice(0, n).map((j) => (n === 1 ? V(0, 0, 1) : V(...[0, 1, 2].map((q) => +(q === j)))).applyQuaternion(qL));
    const tq = kind === 't' ? L.tqH : kind === 's' ? L.tqK : L.tqA; tq.set(0, 0, 0);
    const tj = [];
    for (let j = 0; j < n; j++) { const lo = lim[KEYS[kind][j][0]] * str, hi = lim[KEYS[kind][j][1]] * str; const v = -lo + Math.random() * (lo + hi); tj.push(v); tq.addScaledVector(b[j], v); }
    const o = D.motorRoom(name, qp, qc);
    const a = [0, 1, 2].slice(0, n).map((i) => (n === 1 ? V(0, 0, 1) : V(...[0, 1, 2].map((q) => +(q === i)))).applyQuaternion(qp));
    // extreme motor torques: each axis at +rp or -rm (vertex of the box)
    for (let rep = 0; rep < 4; rep++) {
      const m = a.map((_, i) => (Math.random() < .5 ? L.mRp[o + i] : -L.mRm[o + i]));
      // world torque on parent: drive + motor (-m a_i)
      const P = tq.clone(); for (let i = 0; i < n; i++) P.addScaledVector(a[i], -m[i]);
      for (let j = 0; j < n; j++) {
        const pj = P.dot(b[j]); const lo = lim[KEYS[kind][j][0]] * str, hi = lim[KEYS[kind][j][1]] * str;
        const over = Math.max(pj - hi, -lo - pj); N++;
        if (over > 1e-9) bad++;
        worst = Math.max(worst, over);
        const use = hi + lo > 0 ? (pj + lo) / (hi + lo) : 0; maxUse = Math.max(maxUse, use);
      }
    }
  }
}
console.log(`axis-checks ${N} · over limit ${bad} · worst excess ${worst.toExponential(2)} N·m`);
// --- 3) old clamp equivalence ---
let neq = 0; for (let i = 0; i < 1e6; i++) { const base = Math.random() * 300, s = Math.random(), w = (Math.random() - .5) * 20; if (M.legLimit(base, s, w) !== base * s) neq++; }
console.log(`legLimit(base,str,w) !== base*str with ecc=${LEGS.ecc}: ${neq} / 1e6`);
// --- 4) zero room: k>0, strength 0 -> spring/damp outputs finite, floor ---
{ const D = fake(0); const L = D.legs.F; D.av.shinF.set(0, 0, 3); const o = D.motorRoom('shinF', I, I);
  const t = D.motorSpring('F', o, 0.2, 0, 25.2); const d = D.motorDamp('F', o, t, 0, 25.2, 5);
  console.log(`str 0: rp ${L.mRp[o]} rm ${L.mRm[o]} t ${f3(t)} d_eff ${d}`); }
// k = 0 path
{ const D = fake(0); const L = D.legs.F; D.av.shinF.set(0, 0, 3); const o = D.motorRoom('shinF', I, I);
  const t = D.motorSpring('F', o, 0.2, 0, 0); const d = D.motorDamp('F', o, t, 0, 0, 5);
  console.log(`str 0, k 0: t ${f3(t)} d_eff ${d} (k=0 and d_eff=0 would lock)`); }
{ const D = fake(0); const o = D.motorRoom('shinF', I, I);
  const d = D.motorDamp('F', o, 0, 0, 0, 0);
  console.log(`str 0, k 0, d 0, dw 0: d_eff ${d}`); }
