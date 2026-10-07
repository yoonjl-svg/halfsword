// R2′ M1 (10/7): 서기 자세 골반 yaw 충격량 응답. 외부 충격량(ext) / 엉덩이 내부 힘쌍(pair*) / 지속 토크 펄스(pulse*).
//  같은 seed 의 기준판(변형 없음)과 변형판을 같은 순서로 돌려 차이만 본다 (결정적이라 차이 = 충격량 효과).
//  충격량은 솔버 직전(제어기 player.step 뒤, world.step 앞)에 넣는다 → 그 스텝 안에서 관절·모터가 받아내는 몫이 1 스텝 Δω 로 나온다.
// usage: node m1_probe.mjs --root=<tree> [--seeds=7,8,9] [--J=1] [--tau=60] [--dur=0.25] [--settle=1.5] [--out=file.json]
import { realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(args.root ? resolve(String(args.root)) : resolve(HERE, '..', '..')); // 기본 = 이 저장소 (chain_ledger 와 같음); --root 로 다른 작업 공간
const u = (p) => pathToFileURL(resolve(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const { CONFIG, DT } = H;
const seeds = String(args.seeds || '7,8,9').split(',').map(Number);
const J = +(args.J ?? 1), TAU = +(args.tau ?? 60), DUR = +(args.dur ?? 0.25), SETTLE = +(args.settle ?? 1.5);
const NSTEP = Math.round(DUR / DT);

const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z), sub = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z), scl = (a, s) => V3(a.x * s, a.y * s, a.z * s);
const cross = (a, b) => V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qrot = (q, v) => { const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z; return V3(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x); };
const qinvrot = (q, v) => qrot(qconj(q), v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UPPER_N = ['pelvis', 'abdomen', 'chest', 'head', 'uarmS', 'farmS', 'uarmO', 'farmO', 'sword'];
const LEGS_N = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
const TORSO_N = ['pelvis', 'abdomen', 'chest', 'head'];

function mkStep(G, hook) {
  const { world, eventQueue, player, enemy, ai, combat } = G;
  return () => {
    player.foe = G.parkEnemy ? null : enemy;
    enemy.foe = G.parkEnemy ? null : player;
    player.faceTarget = G.faceP || enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    if (!G.parkEnemy) ai.update(DT); else enemy.move.set(0, 0);
    player.step(DT);
    enemy.step(DT);
    player.cacheState();
    enemy.cacheState();
    if (hook) hook(G.t);
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    G.t += DT;
  };
}

function enumerate(P) {
  const named = [...Object.entries(P.bodies), ['sword', P.sword]].filter(([, b]) => b);
  const bodies = [], names = [], seen = new Set();
  for (const [n, b] of named) if (!seen.has(b.handle)) { seen.add(b.handle); bodies.push(b); names.push(n); }
  return { bodies, names };
}

function sample(P, E) {
  const { bodies, names } = E;
  const n = bodies.length;
  const m = [], Ip = [], Iq = [], p = [], v = [], w = [], q = [];
  let c = V3(), vc = V3(), M = 0;
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    m[i] = b.mass(); const pi = b.principalInertia(); Ip[i] = V3(pi.x, pi.y, pi.z); Iq[i] = b.principalInertiaLocalFrame();
    const pc = b.worldCom(), lv = b.linvel(), av = b.angvel(), r = b.rotation();
    p[i] = V3(pc.x, pc.y, pc.z); v[i] = V3(lv.x, lv.y, lv.z); w[i] = V3(av.x, av.y, av.z); q[i] = { x: r.x, y: r.y, z: r.z, w: r.w };
    c = add(c, scl(p[i], m[i])); vc = add(vc, scl(v[i], m[i])); M += m[i];
  }
  c = scl(c, 1 / M); vc = scl(vc, 1 / M);
  const Ly = {}, Iw = {}, yaw = {}, wy = {}, pos = {};
  let Iall = 0;
  for (let i = 0; i < n; i++) {
    const qw = qmul(q[i], Iq[i]);
    const wl = qinvrot(qw, w[i]);
    const Lr = qrot(qw, V3(Ip[i].x * wl.x, Ip[i].y * wl.y, Ip[i].z * wl.z));
    const Li = add(Lr, scl(cross(sub(p[i], c), sub(v[i], vc)), m[i]));
    const ey = qinvrot(qw, V3(0, 1, 0));
    const iw = Ip[i].x * ey.x * ey.x + Ip[i].y * ey.y * ey.y + Ip[i].z * ey.z * ey.z;
    const fx = qrot(q[i], V3(1, 0, 0));
    Ly[names[i]] = Li.y; Iw[names[i]] = iw; yaw[names[i]] = Math.atan2(-fx.z, fx.x); wy[names[i]] = w[i].y; pos[names[i]] = p[i];
    const dx = p[i].x - c.x, dz = p[i].z - c.z;
    Iall += iw + m[i] * (dx * dx + dz * dz);
  }
  // 윗몸 관성 (윗몸 질량중심 기준, 장부 Iup 과 같은 정의)
  let cu = V3(), mu = 0;
  for (const nm of UPPER_N) { const i = names.indexOf(nm); if (i < 0) continue; cu = add(cu, scl(p[i], m[i])); mu += m[i]; }
  cu = scl(cu, 1 / mu);
  let Iup = 0;
  for (const nm of UPPER_N) { const i = names.indexOf(nm); if (i < 0) continue; const dx = p[i].x - cu.x, dz = p[i].z - cu.z; Iup += Iw[nm] + m[i] * (dx * dx + dz * dz); }
  const grp = (list) => list.reduce((s, nm) => s + (Ly[nm] ?? 0), 0);
  return { t: P.t, Ly, Iw, yaw, wy, pos, Lup: grp(UPPER_N), Llegs: grp(LEGS_N), Ltorso: grp(TORSO_N), Ltot: Object.values(Ly).reduce((s, x) => s + x, 0), Iup, Iall, Ipel: Iw.pelvis, state: P.state, off: P.offBalance };
}

function run(seed, variant) {
  const G = H.newRound({ walls: false, weapon: 'longsword', weapon2: 'longsword', seed });
  G.park();
  const P = G.player;
  const E = enumerate(P);
  const pel = P.bodies.pelvis, thF = P.bodies.thighF, thB = P.bodies.thighB;
  let k = -1;
  const hook = () => {
    if (k < 0) return;
    const imp = (b, y) => b.applyTorqueImpulse({ x: 0, y, z: 0 }, true);
    if (variant === 'ext' && k === 0) imp(pel, J);
    else if (variant === 'pairF' && k === 0) { imp(pel, J); imp(thF, -J); }
    else if (variant === 'pairS' && k === 0) { imp(pel, J); imp(thF, -J / 2); imp(thB, -J / 2); }
    else if (variant === 'pulseS' && k < NSTEP) { imp(pel, TAU * DT); imp(thF, -TAU * DT / 2); imp(thB, -TAU * DT / 2); }
    else if (variant === 'pulseF' && k < NSTEP) { imp(pel, TAU * DT); imp(thF, -TAU * DT); }
    else if (variant === 'pulseExt' && k < NSTEP) imp(pel, TAU * DT);
  };
  const step = mkStep(G, hook);
  for (let i = 0; i < Math.round(SETTLE / DT); i++) { P.move.set(0, 0); step(); }
  const out = [sample(P, E)];
  for (k = 0; k < NSTEP; k++) { P.move.set(0, 0); step(); out.push(sample(P, E)); }
  return { names: E.names, s: out };
}

const d2 = (r) => (r * 180) / Math.PI;
const med = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)).sort((p, q) => p - q); return x.length ? (x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2) : null; };
const f = (x, n = 1) => (x == null ? '-' : (+x).toFixed(n));
const VARIANTS = String(args.variants || 'ext,pairF,pairS,pulseS,pulseF,pulseExt').split(',');
const AT = [1, 2, 6, 12, NSTEP].filter((i, j, a) => i <= NSTEP && a.indexOf(i) === j);
const res = { root: ROOT, chain: CONFIG.BODY?.chain ?? null, J, TAU, DUR, DT, seeds, variants: {} };
console.log(`m1_probe 뿌리 ${ROOT} · BODY.chain ${res.chain} · DT ${DT} · J ${J} N·m·s · 펄스 τ ${TAU} N·m × ${DUR} s (= ${TAU * DUR} N·m·s) · settle ${SETTLE} s · seeds ${seeds.join(',')}`);
const base = {};
for (const sd of seeds) base[sd] = run(sd, 'none');
{
  const b0 = seeds.map((sd) => base[sd].s[0]);
  const bE = seeds.map((sd) => base[sd].s[NSTEP]);
  console.log(`기준판(변형 없음): I_골반 ${f(med(b0.map((s) => s.Ipel)), 3)} · I_윗몸 ${f(med(b0.map((s) => s.Iup)), 3)} · I_전체 ${f(med(b0.map((s) => s.Iall)), 3)} kg·m² · 상태 ${b0.map((s) => s.state).join('/')} · 0.25 s 동안 기준판 골반 yaw 변화 ${seeds.map((sd) => f(d2(wrap(base[sd].s[NSTEP].yaw.pelvis - base[sd].s[0].yaw.pelvis)), 2)).join('/')} °`);
  res.base = { Ipel: med(b0.map((s) => s.Ipel)), Iup: med(b0.map((s) => s.Iup)), Iall: med(b0.map((s) => s.Iall)), state: b0.map((s) => s.state), stateEnd: bE.map((s) => s.state) };
}
const NAMES = base[seeds[0]].names;
for (const vr of VARIANTS) {
  const runs = {};
  for (const sd of seeds) runs[sd] = run(sd, vr);
  const Jt = vr.startsWith('pulse') ? TAU * DUR : J;
  const row = { Jt, at: {}, yawEnd: {}, dL: {}, slip: {}, state: seeds.map((sd) => runs[sd].s[NSTEP].state) };
  const diff = (sd, i, key, nm) => (nm ? runs[sd].s[i][key][nm] - base[sd].s[i][key][nm] : runs[sd].s[i][key] - base[sd].s[i][key]);
  for (const i of AT) {
    row.at[i] = {};
    for (const nm of NAMES) row.at[i][nm] = med(seeds.map((sd) => diff(sd, i, 'wy', nm)));
    row.dL[i] = { up: med(seeds.map((sd) => diff(sd, i, 'Lup'))), legs: med(seeds.map((sd) => diff(sd, i, 'Llegs'))), torso: med(seeds.map((sd) => diff(sd, i, 'Ltorso'))), tot: med(seeds.map((sd) => diff(sd, i, 'Ltot'))) };
  }
  for (const nm of NAMES) row.yawEnd[nm] = med(seeds.map((sd) => wrap(runs[sd].s[NSTEP].yaw[nm] - base[sd].s[NSTEP].yaw[nm])));
  for (const nm of ['footF', 'footB']) row.slip[nm] = med(seeds.map((sd) => { const a = runs[sd].s[NSTEP].pos[nm], b = base[sd].s[NSTEP].pos[nm]; return Math.hypot(a.x - b.x, a.z - b.z); }));
  res.variants[vr] = row;
  const b0 = res.base;
  const ref = vr.startsWith('pulse')
    ? `자유 윗몸 기준: 끝 ω ${f(d2(Jt / b0.Iup), 0)} °/s · 끝 각 ${f(d2(0.5 * (TAU / b0.Iup) * DUR * DUR), 1)} ° (I_윗몸) / 끝 각 ${f(d2(0.5 * (TAU / b0.Iall) * DUR * DUR), 1)} ° (I_전체)`
    : `자유 강체 기준 Δω: 골반만 ${f(d2(J / b0.Ipel), 0)} · 윗몸 ${f(d2(J / b0.Iup), 0)} · 전체 ${f(d2(J / b0.Iall), 0)} °/s`;
  console.log(`\n== ${vr} (J 합 ${f(Jt, 2)} N·m·s) — ${ref}; 끝 상태 ${row.state.join('/')}`);
  const hdr = ['스텝(ms)', ...NAMES].map((s) => s.padStart(7)).join('');
  console.log(hdr);
  for (const i of AT) console.log(`${String(Math.round(i * DT * 1000)).padStart(7)}${NAMES.map((nm) => f(d2(row.at[i][nm]), 0).padStart(7)).join('')}   Δω_y °/s`);
  console.log(`${'yaw끝°'.padStart(7)}${NAMES.map((nm) => f(d2(row.yawEnd[nm]), 1).padStart(7)).join('')}`);
  console.log(`ΔL_y (N·m·s, 변형−기준): ${AT.map((i) => `${Math.round(i * DT * 1000)} ms 윗몸 ${f(row.dL[i].up, 3)} 다리 ${f(row.dL[i].legs, 3)} 몸통 ${f(row.dL[i].torso, 3)} 전체 ${f(row.dL[i].tot, 3)}`).join(' | ')}`);
  console.log(`발 자리 차(0.25 s, m): F ${f(row.slip.footF, 4)} B ${f(row.slip.footB, 4)}`);
}
if (args.out) writeFileSync(resolve(String(args.out)), JSON.stringify(res, null, 1));
