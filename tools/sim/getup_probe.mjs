// getup_probe.mjs — 일어서기 동안 두 다리의 시간표를 읽기만 한다 (몸·관절·설정에 쓰지 않는다). 10/8 사장님 "두 다리로 동시에 일어나는 모습" 조사 도구 (docs/strike/getup_lead_2026-10-08.md)
//  node tools/sim/getup_probe.mjs [--mode=light|heavy|both] [--seeds=40,41] [--jit] [--set=BODY.getupLead=1,BODY.getupLag=0.4] [--quiet] [--csv=path]
//   light = 가슴·머리 밀기 300 N·s(support_measure getup 장면과 같은 꼴) → 게임 넘어짐 판정(발 디딤 잃음) → getup(무릎) → stand
//   heavy = knockDown(true) 로 완전히 쓰러짐(down) → fallDuration 뒤 getup → stand.  --jit = 씨앗마다 밀기 ±15 %·방향 ±0.3 rad (getupN 꼴)
//   요약 줄: 선 때 · 다시 넘어짐 · 무릎이 절반 펴진 때(앞 F·뒤 B)와 그 차(뒷다리 지연 s) · 서는 동안 발바닥 최고 높이(발을 뗐나) · 골반 최저. --quiet 없으면 1/30 s 시간표(상태·kneelAmount·근육·골반·보이지 않는 받침 fy/Mg·발 하중·무릎/엉덩이 각·발·정강이·손·몸통 땅 반력/Mg·gait lev)
import * as H from './harness_m.mjs';
const { THREE, CONFIG, DT } = H;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const b = a.replace(/^--/, ''); const i = b.indexOf('='); return i < 0 ? [b, ''] : [b.slice(0, i), b.slice(i + 1)]; }));
const mode = args.mode || 'both';
// --set=GROUP.key=value,... (with_config 와 같은 꼴) — 아무것도 만들기 전에 CONFIG 에 넣는다
for (const kv of (args.set || '').split(',').filter(Boolean)) { const [path, v] = kv.split('='); const [g, k] = path.split('.'); CONFIG[g][k] = Number.isNaN(+v) ? v : +v; }
const seeds = (args.seeds || String(args.seed ?? 40)).split(',').map(Number);
const quiet = 'quiet' in args;
const seed = +(args.seed ?? 40);
const R2D = 180 / Math.PI;
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3();
const rot = (rb, q) => { const r = rb.rotation(); return q.set(r.x, r.y, r.z, r.w); };
function rotVec(q, out) { const w = Math.min(1, Math.abs(q.w)); const sgn = q.w < 0 ? -1 : 1; const s = Math.sqrt(1 - w * w); if (s < 1e-6) return out.set(0, 0, 0); const angle = 2 * Math.acos(w); return out.set(q.x, q.y, q.z).multiplyScalar((sgn * angle) / s); }
function jointZ(f, name) { const j = f.joints.find((x) => x.name === name); rot(j.parent, _q1); rot(j.child, _q2); _q3.copy(j.restInv).multiply(_q1.invert().multiply(_q2)); return rotVec(_q3, _v).z; }
function targetZ(f, name) { const j = f.joints.find((x) => x.name === name); _q3.copy(j.restInv).multiply(j.target); return rotVec(_q3, _v).z; }
function groundN(world, f) {
  const out = {};
  for (const name in f.bodies) {
    const b = f.bodies[name];
    let vy = 0;
    for (let i = 0; i < b.numColliders(); i++) {
      const col = b.collider(i);
      world.contactPairsWith(col, (other) => {
        const pb = other.parent ? other.parent() : null;
        if (pb && pb.isFixed && pb.isFixed()) world.contactPair(col, other, (m) => { const n = m.normal(); for (let k = 0, K = m.numContacts(); k < K; k++) vy += m.contactImpulse(k) * Math.abs(n.y); });
      });
    }
    out[name] = vy / DT;
  }
  return out;
}
function run(kind, seed) {
  const G = H.newRound({ seed, walls: false, gap: 4 });
  G.park();
  const P = G.player;
  const Mg = P.totalMass * 9.81;
  const hold = CONFIG.ARENA.startHold;
  while (G.t < hold + 1 - 1e-9) G.step();
  const t0 = G.t;
  const jit = (sd, i) => { let a = (sd * 374761393 + i * 668265263) >>> 0; a = Math.imul(a ^ (a >>> 13), 1274126177) >>> 0; return ((a ^ (a >>> 16)) >>> 0) / 4294967296 - 0.5; };
  const J = (kind === 'light' ? 300 : 800) * ('jit' in args ? 1 + 0.3 * jit(seed, 1) : 1);
  const ang = 'jit' in args ? 0.6 * jit(seed, 2) : 0;
  let mid = null;
  const ws = G.world.step.bind(G.world);
  G.world.step = (eq, hooks) => { const uf = P.bodies.pelvis.userForce(); mid = { fy: uf.y, fx: uf.x, fz: uf.z }; ws(eq, hooks); };
  const rows = [];
  const ev = {};
  let prev = P.state;
  if (kind === 'heavy') P.knockDown(true); // 완전히 쓰러짐(down) → fallDuration 뒤 getup
  G.before = (t) => {
    if (kind !== 'heavy' && t - t0 < 0.25 - 1e-9) for (const k of ['chest', 'head']) P.bodies[k].applyImpulse({ x: -Math.cos(ang) * J * DT * 4, y: 0, z: -Math.sin(ang) * J * DT * 4 }, true);
  };
  const samp = () => {
    const N = groundN(G.world, P);
    const sF = P.solePoint('footF', new THREE.Vector3()), sB = P.solePoint('footB', new THREE.Vector3());
    const r = {
      t: +(G.t - t0).toFixed(3), st: P.state, stT: +P.stateTime.toFixed(2), kn: +P.kneelAmount.toFixed(2), mus: +P.muscle.toFixed(2),
      py: +P.bodies.pelvis.translation().y.toFixed(3), fy: +((mid?.fy ?? 0) / Mg).toFixed(2),
      soleF: +sF.y.toFixed(3), soleB: +sB.y.toFixed(3), loadF: +P.footLoad.F.toFixed(2), loadB: +P.footLoad.B.toFixed(2),
      kneeF: +(jointZ(P, 'shinF') * R2D).toFixed(0), kneeB: +(jointZ(P, 'shinB') * R2D).toFixed(0), hipF: +(jointZ(P, 'thighF') * R2D).toFixed(0), hipB: +(jointZ(P, 'thighB') * R2D).toFixed(0),
      tKneeF: +(targetZ(P, 'shinF') * R2D).toFixed(0), tKneeB: +(targetZ(P, 'shinB') * R2D).toFixed(0),
      NfF: +(N.footF / Mg).toFixed(2), NfB: +(N.footB / Mg).toFixed(2), NsF: +(N.shinF / Mg).toFixed(2), NsB: +(N.shinB / Mg).toFixed(2),
      Nhand: +((N.farmS + N.farmO + N.uarmS + N.uarmO) / Mg).toFixed(2), Ntrunk: +((N.pelvis + N.abdomen + N.chest + N.head) / Mg).toFixed(2),
      lev: P.gait?.active ? +(P.gait.lev ?? 0).toFixed(2) : null,
    };
    rows.push(r);
    return r;
  };
  let standAt = null;
  let n = 0;
  while (G.t < t0 + 12 && (standAt == null || G.t < standAt + 1.5)) {
    G.step();
    n++;
    if (P.state !== prev) { ev[`${prev}->${P.state}`] = +(G.t - t0).toFixed(2); if (P.state === 'stand') standAt = G.t; prev = P.state; }
    if (n % 4 === 0 && P.state !== 'stand' || (standAt != null && n % 4 === 0)) samp();
  }
  // 요약: 무릎이 무릎꿇기 각도에서 선 각도까지 절반 펴진 때(앞 F·뒤 B), 그 차(뒷다리 지연), 선 때, 다시 넘어짐, 서는 동안 발 하중
  const rise = rows.filter((x) => x.st === 'getup' && x.kn < 1);
  const half = (key) => { if (!rise.length) return null; const a = rise[0][key], b = rows.find((x) => x.st === 'stand')?.[key] ?? rise[rise.length - 1][key]; const mid = (a + b) / 2; const hit = rise.find((x) => (b > a ? x[key] >= mid : x[key] <= mid)); return hit ? hit.t : null; };
  const tStand = ev['getup->stand'] ?? null;
  const refall = tStand != null && rows.some((x) => x.t > tStand && x.st !== 'stand');
  const soleBmax = rise.length ? Math.max(...rise.map((x) => x.soleB)) : null;
  const soleFmax = rise.length ? Math.max(...rise.map((x) => x.soleF)) : null;
  const sum = { seed, kind, J, tGetup: ev['stand->getup'] ?? ev['down->getup'] ?? null, tStand, refall, halfF: half('kneeF'), halfB: half('kneeB'), lagB: half('kneeB') != null && half('kneeF') != null ? +(half('kneeB') - half('kneeF')).toFixed(2) : null, soleFmax, soleBmax, pyMin: Math.min(...rows.map((x) => x.py)) };
  return { kind, J: +J.toFixed(0), Mg: +Mg.toFixed(0), ev, rows, sum: { ...sum, J: +J.toFixed(0) } };
}
const res = [];
for (const sd of seeds) {
  if (mode === 'light' || mode === 'both') res.push(run('light', sd));
  if (mode === 'heavy' || mode === 'both') res.push(run('heavy', sd));
}
console.log('seed kind J | tGetup tStand refall | half-knee F B lagB(s) | soleF/B max in rise | pelvis min');
for (const r of res) { const s = r.sum; console.log(`${s.seed} ${s.kind} ${s.J} | ${s.tGetup} ${s.tStand} ${s.refall ? 'REFALL' : 'ok'} | ${s.halfF} ${s.halfB} ${s.lagB} | ${s.soleFmax} ${s.soleBmax} | ${s.pyMin.toFixed(3)}`); }
for (const r of quiet ? [] : res) {
  console.log(`\n== ${r.kind} (J ${r.J} N·s, Mg ${r.Mg} N) events ${JSON.stringify(r.ev)}`);
  console.log('t | st stT kn mus | py fy/Mg | soleF soleB loadF loadB | kneeF kneeB (tgt) hipF hipB | NfF NfB NsF NsB Nhand Ntrunk | lev');
  for (const x of r.rows) {
    if (x.st === 'down' && x.stT < 1.8) continue; // 누운 동안은 건너뛴다
    console.log(`${x.t.toFixed(2)} | ${x.st.padEnd(5)} ${x.stT.toFixed(2)} ${x.kn.toFixed(2)} ${x.mus.toFixed(2)} | ${x.py.toFixed(3)} ${x.fy.toFixed(2)} | ${x.soleF.toFixed(3)} ${x.soleB.toFixed(3)} ${x.loadF.toFixed(2)} ${x.loadB.toFixed(2)} | ${String(x.kneeF).padStart(4)} ${String(x.kneeB).padStart(4)} (${x.tKneeF}/${x.tKneeB}) ${String(x.hipF).padStart(4)} ${String(x.hipB).padStart(4)} | ${x.NfF.toFixed(2)} ${x.NfB.toFixed(2)} ${x.NsF.toFixed(2)} ${x.NsB.toFixed(2)} ${x.Nhand.toFixed(2)} ${x.Ntrunk.toFixed(2)} | ${x.lev ?? '-'}`);
  }
}
if (args.csv) { const fs = await import('node:fs'); fs.writeFileSync(args.csv, JSON.stringify(res)); }
