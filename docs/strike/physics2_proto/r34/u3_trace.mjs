// ─────────────────────────────────────────────────────────────
//  u3_trace.mjs (r34 · 뛰기 여섯째 진단 · 안 본 판) — hop_trace.mjs 를 그대로 옮기고 '판이 바꾸는 것'을 하나씩 따로 고르는 인자만 더한 재는 대본. 몸에 힘 · 빠르기를 걸지 않는다.
//   node u3_trace.mjs --root=<칸> --weapon=longsword --variants=100-123 | --list=103,110 [--settleV=<판>] [--nudgeV=<판>] [--seedV=<판>] [--nudgeJ=6] [--settleS=<초>] --json=<요약> [--dump=<스텝 기록>]
//   settleV · nudgeV · seedV: 자리 잡기 길이 · 가슴 치기 쪽 · 난수 씨앗을 그 판 번호의 것으로 바꿔 씀(주지 않으면 판 번호 그대로 = run_scenes 와 같음). settleS 는 자리 잡기 초를 바로 줌. dump 의 pre = 뛰기 직전 몸 상태.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync, renameSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;

const SCENE = String(args.scene ?? 'hop');
const CFG = await import(u('src/config.js'));

/** 장면 이름 → { 덮어쓰기, 차례 } */
function sceneDef(name) {
  const m = name.match(/^run(\d{2,3})$/);
  if (m) { const v = m[1].length === 2 ? +m[1] / 10 : +m[1] / 100; return { kind: 'steady', v, cfg: { 'RUN.cost': 0, 'RUN.legVmax': v }, after: 12, warm: 3 }; }
  if (name === 'hop') return { kind: 'hop', cfg: { 'RUN.cost': 0, 'RUN.legVmax': 0, 'RUN.contactMax': 0.26 }, after: 6, warm: 0 };
  if (name === 'run') return { kind: 'entry', cfg: {}, after: 5, warm: 0 };
  if (name === 'runbreak') return { kind: 'break', cfg: {}, after: 7, warm: 0 };
  if (name === 'runturn') { const v = args.vturn != null ? +args.vturn : +(0.8 * CFG.RUN.legVmax).toFixed(3); return { kind: 'turn', v, cfg: { 'RUN.cost': 0, 'RUN.legVmax': v }, after: 7, warm: 0 }; }
  if (name === 'runhit') return { kind: 'hit', cfg: { 'RUN.cost': 0 }, after: 6, warm: 0 };
  if (name === 'walkhit') return { kind: 'walkhit', cfg: {}, after: 0, warm: 0 };
  throw new Error('장면: hop · run<빠르기> · run · runbreak · runturn · runhit · walkhit');
}
const DEF = sceneDef(SCENE);
// 덮어쓰기 (재기 전용 · 없는 칸은 건너뜀)
const cfgDone = [], cfgMissing = [];
for (const [path, v] of Object.entries(DEF.cfg)) {
  const ks = path.split('.'); let o = CFG;
  for (const k of ks.slice(0, -1)) o = o?.[k];
  const last = ks[ks.length - 1];
  if (o && typeof o[last] === 'number') { cfgDone.push([path, o[last], v]); o[last] = v; } else cfgMissing.push(path);
}
const H = await import(u('tools/sim/harness_m.mjs'));
const HON = await import(u('tools/sim/honesty.mjs'));
const DT = H.DT, G0 = 9.81;
const LP = await import(u('tools/sim/lowpass.mjs'));
const FY_HZ = args.fyHz != null ? +args.fyHz : 20; // 거른 수직 힘 최고의 차단 주파수 (Patoz 외 2022 달리기 힘판 20 Hz · 4 차 영위상 · owner_open_questions)
const { LEGS } = H.CONFIG;
const LIM = LEGS.limit;

const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const fwdOf = (P, part = 'pelvis') => { const q = P.bodies[part].rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
const stickTo = (P, x, y) => { P.move.set(x, y); P.stickX = x; P.stickY = y; };
// 작은 사원수 셈 (honesty.mjs 와 같은 꼴)
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const rotvec = (q) => { const w = Math.max(-1, Math.min(1, q.w)), s = Math.sqrt(Math.max(0, 1 - w * w)), a = 2 * Math.acos(Math.abs(w)), k = s > 1e-9 ? (a / s) * (w < 0 ? -1 : 1) : 2; return { x: q.x * k, y: q.y * k, z: q.z * k }; };
const qrot = (q, v) => { const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x); return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) }; };
const q2 = (r) => ({ x: r.x, y: r.y, z: r.z, w: r.w });
const pct = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };

// 관절 끝 (jointDefs lim · rad): 엉덩이 z 폄 끝 · 무릎 다 폄 끝 · 발목 발등 굽힘 끝 — 0.03 rad 안
const ENDS = { hip: { j: 'thigh', lo: -0.5 }, knee: { j: 'shin', hi: 0.02 }, ankle: { j: 'foot', lo: -0.6 } };
const NEAR = 0.03;
/** 축 몫: 바란 raw ÷ 그 쪽 한도 */
const shares = (raw, str) => ({
  hipFlex: Math.abs(raw.hz) / (LIM.hipFlex * str), hipAbd: Math.abs(raw.hx) / (LIM.hipAbd * str), hipRot: Math.abs(raw.hy) / (LIM.hipRot * str),
  knee: raw.k < 0 ? -raw.k / (LIM.kneeExt * str) : raw.k / (LIM.kneeFlex * str),
  ankle: raw.az > 0 ? raw.az / (LIM.anklePlantar * str) : -raw.az / (LIM.ankleDorsi * str),
});
const AXES = ['hipFlex', 'hipAbd', 'hipRot', 'knee', 'ankle'];

let LASTPRE = null;
function one(variant) {
  const vSeed = args.seedV != null ? +args.seedV : variant, vSet = args.settleV != null ? +args.settleV : variant, vNud = args.nudgeV != null ? +args.nudgeV : variant, nJ = args.nudgeJ != null ? +args.nudgeJ : 6;
  const G = H.newRound({ walls: false, weapon: String(args.weapon ?? 'longsword'), seed: 100 + vSeed });
  G.park();
  const P = G.player, R = rng(1000 + variant * 7919);
  const settle = Math.round((args.settleS != null ? +args.settleS : 2.0 + 0.11 * vSet) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt && nJ > 0) hitChest(P, nJ, vNud * 2.39996); G.step(); }
  const PRE = LASTPRE = (() => { const pp = P.bodies.pelvis.translation(), pv = P.bodies.pelvis.linvel(), f = fwdOf(P); const ft = (k) => { const a = P.bodies['foot' + k].translation(), dx = a.x - pp.x, dz = a.z - pp.z; return { f: +(dx * f.x + dz * f.z).toFixed(4), r: +(-dx * f.z + dz * f.x).toFixed(4), y: +a.y.toFixed(4) }; };
    return { py: +pp.y.toFixed(4), v: +Math.hypot(pv.x, pv.z).toFixed(4), tilt: +P.tiltDeg().toFixed(2), F: ft('F'), B: ft('B'), muscle: typeof P.muscle === 'number' ? P.muscle : null, stam: typeof P.stamina?.value === 'number' ? +P.stamina.value.toFixed(2) : null, sw: P.sword ? (() => { const a = P.sword.worldCom(), dx = a.x - pp.x, dz = a.z - pp.z; return { f: +(dx * f.x + dz * f.z).toFixed(4), r: +(-dx * f.z + dz * f.x).toFixed(4), y: +(a.y - pp.y).toFixed(4) }; })() : null, state: P.state, yaw: +Math.atan2(f.z, f.x).toFixed(4) }; })();
  const named = bodiesOf(P), bodies = named.map(([, b]) => b);
  let M = 0; for (const b of bodies) M += b.mass();
  const Mg = M * G0;
  const rec = { active: false };
  const D = P.legDrive;
  // 다리 관절 장부 (honesty attach — 축마다 한도 · 뛰는 동안 도움). 재는 창 안 스텝만 축 장부에 넣는다
  const L = HON.attach(G.world, named, {
    fighter: P, legLimit: LIM,
    axisTag: (n) => (rec.active ? (P.gait?.legs?.[n.slice(-1)]?.stance ? 'S' : 'W') : null),
    onJoint: (J, tm, te, prev, cur) => {
      if (!rec.active) return;
      const kind = /^thigh/.test(J.name) ? 'hip' : /^shin/.test(J.name) ? 'knee' : /^foot/.test(J.name) ? 'ankle' : null;
      if (!kind) return;
      const k = J.name.slice(-1), st = !!P.gait?.legs?.[k]?.stance;
      const e = rotvec(qmul(J.restInv, qmul(qconj(prev.q[J.ip]), prev.q[J.ic])));
      const E = ENDS[kind], z = e.z;
      const A = (rec.ends[kind + k + (st ? 'S' : 'W')] ||= { n: 0, near: 0, zMin: Infinity, zMax: -Infinity });
      A.n++; if ((E.lo != null && z <= E.lo + NEAR) || (E.hi != null && z >= E.hi - NEAR)) { A.near++; rec.endEv.push({ i: rec.steps.length, key: kind + k + (st ? 'S' : 'W'), z: +z.toFixed(4) }); }
      A.zMin = Math.min(A.zMin, z); A.zMax = Math.max(A.zMax, z);
      // 각속도 · 일률 (디딘 다리만): 전달 토크(명시 + 모터)의 관절 축 몫과 상대 각속도
      const fr = kind === 'knee' ? prev.q[J.ip] : prev.q[J.ic], ax = qrot(fr, { x: 0, y: 0, z: 1 });
      const T = { x: tm.x + te.x, y: tm.y + te.y, z: tm.z + te.z }, wc = cur.w[J.ic], wp = cur.w[J.ip], wr = { x: wc.x - wp.x, y: wc.y - wp.y, z: wc.z - wp.z };
      const tAx = T.x * ax.x + T.y * ax.y + T.z * ax.z, wAx = wr.x * ax.x + wr.y * ax.y + wr.z * ax.z, pw = T.x * wr.x + T.y * wr.y + T.z * wr.z;
      if (st) {
        const lim = kind === 'hip' ? LIM.hipFlex : kind === 'knee' ? LIM.kneeExt : LIM.anklePlantar;
        const W = (rec.rate[kind] ||= { wPk: 0, pPk: 0 });
        if (Math.abs(tAx) > lim / 3) W.wPk = Math.max(W.wPk, Math.abs(wAx));
        W.pPk = Math.max(W.pPk, pw / M);
        if (kind === 'knee') { const s = (rec.kneeNow[k] ??= { max: 0 }); s.max = Math.max(s.max, -z); }
      }
    },
  });
  HON.hook(G, [L]);
  // legTorques 감싸기 (재기만 — 인자 · 돌려줌 그대로)
  const calls = [];
  if (D?.legTorques) { const orig = D.legTorques.bind(D); D.legTorques = (Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring) => { const r = orig(Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring); const ent = { k: Lg.k, stance: !!ankleOn, raw: { ...Lg.raw }, str: str || 1, Fy, ax: ankleOn ? (c.x - Lg.pa.x) * Lg.hx + (c.z - Lg.pa.z) * Lg.hz : null };
    if (ankleOn) { // 나눠 보기 (재기만): 수직 힘만 · 수평 힘까지(비틀기 없이) · 같은 수직 힘을 발목 바로 밑에서
      const keep = { ...Lg.raw };
      D.legRaw(Lg, c, 0, Fy, 0, 0, grav, str, true, spring); ent.rawV = { ...Lg.raw };
      D.legRaw(Lg, c, Fx, Fy, Fz, 0, grav, str, true, spring); ent.rawH = { ...Lg.raw };
      D.legRaw(Lg, { x: Lg.pa.x, y: c.y, z: Lg.pa.z }, 0, Fy, 0, 0, grav, str, true, spring); ent.rawA = { ...Lg.raw };
      Object.assign(Lg.raw, keep);
      const len = Lg.ph.distanceTo(Lg.pa), cc = Math.max(-1, Math.min(1, (Lg.lenT * Lg.lenT + Lg.lenS * Lg.lenS - len * len) / (2 * Lg.lenT * Lg.lenS)));
      ent.knee = Math.PI - Math.acos(cc); ent.Fx = Fx; ent.Fz = Fz; ent.ny = ny;
      ent.armK = (c.x - Lg.pk.x) * Lg.hx + (c.z - Lg.pk.z) * Lg.hz; ent.hipF = (c.x - Lg.ph.x) * Lg.hx + (c.z - Lg.ph.z) * Lg.hz;
    }
    calls.push(ent); return r; }; }
  // 발 법선 힘 (엔진 접촉 · 고정 물체만)
  const nIter = G.world.integrationParameters?.numSolverIterations ?? 4, KC = nIter / (nIter + 1);
  const footN = (k) => {
    const rb = P.bodies['foot' + k]; let N = 0;
    for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) {
      const col = rb.collider(ci);
      G.world.contactPairsWith(col, (other) => { const ob = other.parent(); if (!ob || !ob.isFixed()) return; G.world.contactPair(col, other, (m) => { const n = m.normal(); for (let q = 0, nk = m.numContacts(); q < nk; q++) N += Math.abs(n.y * m.contactImpulse(q) * KC) / DT; }); });
    }
    return N;
  };
  const comNow = () => { let x = 0, y = 0, z = 0, vx = 0, vz = 0, vy = 0; for (const b of bodies) { const m = b.mass(), p = b.worldCom(), v = b.linvel(); x += m * p.x; y += m * p.y; z += m * p.z; vx += m * v.x; vy += m * v.y; vz += m * v.z; } return { x: x / M, y: y / M, z: z / M, vx: vx / M, vy: vy / M, vz: vz / M }; };
  Object.assign(rec, { ends: {}, rate: {}, kneeNow: {}, kneeDeep: [], steps: [], endEv: [] });
  const ctx = { G, P, R, s: {} };
  const secsMax = 2.5 + DEF.after + (DEF.kind === 'walkhit' ? 6 : 0) + 1;
  let fell = false, tFall = null, why = '', lowFor = 0, tiltFor = 0, tOn = null, i = 0;
  const thr = 0.03 * Mg;
  let dn0 = D?.dbg?.n ?? 0, slip0 = D?.dbg?.slipN ?? 0;
  const prevSt = { F: false, B: false };
  for (i = 0; i < Math.round(secsMax / DT); i++) {
    const t = i * DT;
    drive(ctx, t, tOn);
    calls.length = 0;
    G.step();
    const st = P.state, on = !!P.run?.on;
    if (on && tOn == null) tOn = t;
    const c = comNow(), pp = P.bodies.pelvis.translation(), tl = P.tiltDeg();
    lowFor = pp.y < 0.5 ? lowFor + DT : 0; tiltFor = tl > 60 ? tiltFor + DT : 0;
    if (!fell && (st !== 'stand' || lowFor > 0.25 || tiltFor > 0.25)) { fell = true; tFall = +t.toFixed(3); why = st !== 'stand' ? st : lowFor > 0.25 ? '주저앉음' : '가슴 60°'; }
    // 재는 창: 뛰기 시작 + warm ~ 시작 + after (걷기 장면은 3 s ~ 9 s)
    const t0 = DEF.kind === 'walkhit' ? 2.5 : tOn;
    rec.active = !fell && t0 != null && t >= t0 && t <= t0 + DEF.after + (DEF.kind === 'walkhit' ? 6 : 0); // 정직 · 관절 끝 장부는 뛰기 시작부터
    const warm = rec.active && t < t0 + DEF.warm; // 걸음 셈의 창은 시작 + warm 부터 (그 전에 넘어지면 시작부터 넘어질 때까지 — winFallback)
    const dn = D?.dbg?.n ?? 0, ran = dn !== dn0; dn0 = dn;
    const slip = D?.dbg?.slipN ?? 0, slipped = slip !== slip0; slip0 = slip;
    const nF = footN('F'), nB = footN('B');
    const S = {
      t, on, fy: L.lastRes?.y ?? 0, nF, nB, c, py: pp.y, tilt: tl,
      plan: ran && (D.dbg.on > 0) ? D.dbg.N : 0, planJ: D?.plan?.J ?? null, cap: D?.dbg?.capCut ?? null, ran, slipped,
      chestPitch: (() => { const q = P.bodies.chest.rotation(), f = fwdOf(P); const ux = 2 * (q.x * q.y - q.w * q.z), uz = 2 * (q.y * q.z + q.w * q.x); return (Math.asin(Math.max(-1, Math.min(1, ux * f.x + uz * f.z))) * 180) / Math.PI; })(),
      chestYaw: (() => { const f = fwdOf(P, 'chest'); return Math.atan2(f.z, f.x); })(),
      gs: { F: !!P.gait?.legs?.F?.stance, B: !!P.gait?.legs?.B?.stance },
      calls: calls.map((x) => ({ k: x.k, stance: x.stance, sh: shares(x.raw, x.str), abdArm: x.stance && x.Fy > 0.3 * Mg ? Math.abs(x.raw.hx) / x.Fy : null, copAx: x.ax, Fy: x.Fy })),
      act: rec.active, warm,
      x: (() => { const g = P.gait, R = g?.runG, pl = R?.plan, dd = D?.dbg ?? {}; const leg = (k) => { const l = g?.legs?.[k]; if (!l) return null; return { st: !!l.stance, t: +(l.t ?? 0).toFixed(4), T: +(l.T ?? 0).toFixed(4), ax: +l.ankle.x.toFixed(4), ay: +l.ankle.y.toFixed(4), az: +l.ankle.z.toFixed(4), p1x: l.p1 ? +l.p1.x.toFixed(4) : null, p1z: l.p1 ? +l.p1.z.toFixed(4) : null, mode: l.runMode ?? null, gf: g.groundForce ? +g.groundForce(l).toFixed(1) : null }; };
        return { F: leg('F'), B: leg('B'), runG: !!R, plan: pl ? { k: pl.k, t: +pl.t.toFixed(4), Tc: +pl.Tc.toFixed(4), Tf: +pl.Tf.toFixed(4), J: +pl.J.toFixed(2), vto: +pl.vto.toFixed(4), vy0: +pl.vy0.toFixed(4), km: +pl.km.toFixed(4), Jc: +pl.Jc.toFixed(2) } : null,
          dN: ran ? +(dd.N ?? 0).toFixed(1) : null, dFx: ran ? +(dd.Fx ?? 0).toFixed(1) : null, dFz: ran ? +(dd.Fz ?? 0).toFixed(1) : null, dOn: ran ? dd.on : null, cut: !!dd.capCut, capAx: D?.capAxis ?? null, ts: dd.trunkShare ?? null, side: dd.side ?? null, Mx: dd.Mx ?? null, Mz: dd.Mz ?? null,
          vdx: R?.vdes ? +R.vdes.x.toFixed(4) : null, vdz: R?.vdes ? +R.vdes.z.toFixed(4) : null, bf: R?.bias ? +R.bias.f.toFixed(4) : null, fwdx: R?.fwd ? +R.fwd.x.toFixed(4) : null, fwdz: R?.fwd ? +R.fwd.z.toFixed(4) : null, rgtx: R?.rgt ? +R.rgt.x.toFixed(4) : null, rgtz: R?.rgt ? +R.rgt.z.toFixed(4) : null,
          px: +pp.x.toFixed(4), pz: +pp.z.toFixed(4), fm: +(P.muscle ?? 0).toFixed(3) }; })(),
      callsX: calls.filter((q) => q.stance).map((q) => ({ k: q.k, Fy: +q.Fy.toFixed(1), Fx: +q.Fx.toFixed(1), Fz: +q.Fz.toFixed(1), ny: +(q.ny ?? 0).toFixed(2), knee: +q.knee.toFixed(4), armK: +q.armK.toFixed(4), hipF: +q.hipF.toFixed(4), ax: +q.ax.toFixed(4), str: q.str,
        sh: shares(q.raw, q.str), shV: shares(q.rawV, q.str), shH: shares(q.rawH, q.str), shA: shares(q.rawA, q.str), rk: +q.raw.k.toFixed(1), rkV: +q.rawV.k.toFixed(1), raz: +q.raw.az.toFixed(1), razV: +q.rawV.az.toFixed(1) })),
    };
    rec.steps.push(S);
    // 디딘 무릎 가장 깊이 (걸음 장치의 디딤 칸 한 번마다)
    for (const k of ['F', 'B']) { if (prevSt[k] && !S.gs[k] && rec.kneeNow[k]) { rec.kneeDeep.push(rec.kneeNow[k].max); rec.kneeNow[k] = null; } prevSt[k] = S.gs[k]; }
    if (fell) break;
    if (t0 != null && t > t0 + DEF.after + (DEF.kind === 'walkhit' ? 6 : 0) + 0.05) break;
  }
  const out = summarize(rec, { variant, fell, tFall, why, tOn, Mg, M, L, ctx });
  if (args.dump) DUMP.push({ variant, pre: PRE, weapon: String(args.weapon ?? 'longsword'), Mg, M, tOn, fell, tFall, endEv: rec.endEv, steps: rec.steps.map((x) => ({ t: x.t, on: x.on, fy: +x.fy.toFixed(1), nF: +x.nF.toFixed(1), nB: +x.nB.toFixed(1), c: Object.fromEntries(Object.entries(x.c).map(([a, b]) => [a, +b.toFixed(4)])), py: +x.py.toFixed(4), tilt: +x.tilt.toFixed(2), plan: +x.plan.toFixed(1), planJ: x.planJ, cap: x.cap, ran: x.ran, chestPitch: +x.chestPitch.toFixed(2), chestYaw: +x.chestYaw.toFixed(4), gs: x.gs, act: x.act, warm: x.warm, x: x.x, callsX: x.callsX })) });
  try { G.world.free(); } catch { /* */ }
  return out;
}

/** 장면마다 조종 (legs_battery.mjs · run_probe.mjs 의 run · runbreak 와 같은 꼴) */
function drive(ctx, t, tOn) {
  const { P, s, R } = ctx;
  const k = DEF.kind;
  if (k === 'walkhit') { P.runReach = 0; stickTo(P, 0, 1); s.hitAt ??= 3.0 + 2.0 * R(); s.ang ??= R() * Math.PI * 2; if (!s.hit && t >= s.hitAt) { hitChest(P, 30, s.ang); s.hit = t; } return; }
  if (k === 'break') {
    if (!s.broke) { P.runReach = 1; stickTo(P, 0, 1); if (tOn != null && t - tOn >= 1.5) { P.runBreak = true; s.broke = t; } }
    else { P.runReach = 0; stickTo(P, 0, t - s.broke < 1.5 ? -1 : 0); }
    return;
  }
  P.runReach = 1;
  if (k === 'turn' && tOn != null && t - tOn >= 3) { s.turned ??= t; stickTo(P, 1, 0); return; }
  stickTo(P, 0, 1);
  if (k === 'hit' && tOn != null) { s.hitAt ??= tOn + 1.0 + 2.0 * R(); s.ang ??= R() * Math.PI * 2; if (!s.hit && t >= s.hitAt) { hitChest(P, 30, s.ang); s.hit = t; } }
}

function summarize(rec, o) {
  const { Mg, M, L, ctx } = o;
  const S = rec.steps, A0 = S.filter((x) => x.act), W1 = A0.filter((x) => !x.warm), fb = W1.length < Math.round(1 / DT), W = fb ? A0 : W1;
  const thr = 0.03 * Mg;
  const out = { variant: o.variant, scene: SCENE, weapon: String(args.weapon ?? 'longsword'), fell: o.fell, tFall: o.tFall, why: o.why, tOn: o.tOn != null ? r3(o.tOn) : null, runT: S.filter((x) => x.on).length * DT, winT: r3(W.length * DT), winFallback: fb && A0.length > 0, Mg: r3(Mg), cfgMissing };
  // ── 접촉 사건 (발마다 디딤 · 두 발 모두 뜸) ──
  const tds = [], contacts = [], flights = [];
  let air = 0, pitchTO = null;
  const cur = { F: null, B: null };
  let phase = null; const phases = []; // 받침 = 어느 발이든 실린 동안
  for (let i = 0; i < W.length; i++) {
    const x = W[i], onF = x.nF > thr, onB = x.nB > thr, any = onF || onB;
    for (const k of ['F', 'B']) {
      const isOn = k === 'F' ? onF : onB;
      if (isOn && !cur[k]) { cur[k] = { t0: x.t, i }; tds.push({ t: x.t, k, air, py: x.py, i }); }
      if (!isOn && cur[k]) { contacts.push(x.t - cur[k].t0); cur[k] = null; }
    }
    if (any) {
      if (air > 0 && pitchTO != null) flights.push({ T: air, dPitch: Math.abs(x.chestPitch - pitchTO) });
      air = 0; pitchTO = null;
      if (!phase) phase = { t0: x.t, J: 0, Jp: 0, planJ: x.planJ };
      phase.J += x.fy * DT; phase.Jp += x.plan * DT;
    } else {
      if (air === 0) pitchTO = x.chestPitch;
      air += DT;
      if (phase) { phase.T = x.t - phase.t0; phases.push(phase); phase = null; }
    }
  }
  const tdAfter = tds.filter((d, j) => j > 0 || d.air > 0); // 첫 디딤은 앞 뜬 시간을 모름(창 시작) — 창 첫 스텝에 이미 실린 발은 뺀다
  const tdReal = tds.filter((d) => d.i > 0);
  out.tdN = tdReal.length;
  out.flyStepShare = r3(W.length ? W.filter((x) => x.nF <= thr && x.nB <= thr).length / W.length : null); // 두 발 모두 뜬 스텝 몫
  out.flightShare05 = r3(tdReal.length ? tdReal.filter((d) => d.air > 0.05 - 1e-9).length / tdReal.length : W.length ? 0 : null); // 디딤 가운데 앞에 0.05 s 넘게 뜬 몫
  out.flightMean = r3(tdReal.length ? mean(tdReal.map((d) => d.air)) : 0);
  out.contactMean = r3(mean(contacts));
  out.cadence = r3(W.length ? tdReal.length / (W.length * DT) : null);
  out.pitchFlightMax = r3(flights.length ? Math.max(...flights.map((f) => f.dPitch)) : 0);
  out.pitchFlightP95 = r3(pct(flights.map((f) => f.dPitch), 0.95) ?? 0);
  // 수직 힘
  out.fyPeakBW = r3(W.length ? Math.max(...W.map((x) => x.fy)) / Mg : null);
  // 거른 수직 힘 최고 (힘판 논문처럼 — 판 전체 줄을 영위상 2 차 버터워스 앞뒤로 거른 뒤 재는 창 안 최고 · lowpass.mjs). fyPeakBW(거르지 않음)는 그대로 두고 읽기만.
  { const fyAll = Float64Array.from(S, (x) => x.fy / Mg), i0 = W.length ? S.indexOf(W[0]) : -1, i1 = W.length ? S.indexOf(W[W.length - 1]) : -1, fs = 1 / DT;
    const pk = (fc) => (i0 >= 0 ? r3(LP.peakFiltered(fyAll, fs, fc, i0, i1)) : null);
    out.fyLpHz = FY_HZ; out.fyPeakLpBW = pk(FY_HZ); out.fyPeakLp20BW = pk(20); out.fyPeakLp25BW = pk(25);
    out.fyWin = [i0, i1]; out.fyBW = Array.from(fyAll, (v) => +v.toFixed(4)); }
  out.fyPlanPeakBW = r3(W.length ? Math.max(...W.map((x) => x.plan)) / Mg : null);
  const ph = phases.filter((p) => p.T >= 0.05);
  const ratios = ph.map((p) => (p.planJ != null ? p.J / p.planJ : p.Jp > 1 ? p.J / p.Jp : null)).filter((r) => r != null);
  out.impRatioMean = r3(mean(ratios)); out.impRatioMin = r3(ratios.length ? Math.min(...ratios) : null); out.impRatioMax = r3(ratios.length ? Math.max(...ratios) : null); out.impPhases = ratios.length;
  if (!ph.length && W.length) { const J = W.reduce((s, x) => s + x.fy * DT, 0), Jp = W.reduce((s, x) => s + x.plan * DT, 0); out.impRatioMean = out.impRatioMin = out.impRatioMax = r3(Jp > 1 ? J / Jp : null); out.impNote = '뜸 없음 — 창 전체의 받은 ÷ 시킨'; }
  out.impSrc = S.some((x) => x.planJ != null) ? 'legDrive.plan.J' : 'dbg.N 적분';
  // 온 걸음 창 (같은 발 F 디딤 → 마지막 F 디딤)
  const fT = tdReal.filter((d) => d.k === 'F');
  let a = 0, b = W.length - 1;
  if (fT.length >= 2) { a = fT[0].i; b = fT[fT.length - 1].i; }
  const SW = W.slice(a, b + 1);
  out.strides = Math.max(0, fT.length - 1);
  out.fyMeanBW = r3(SW.length ? mean(SW.map((x) => x.fy)) / Mg : null);
  if (SW.length > 1) {
    const c0 = SW[0].c, c1 = SW[SW.length - 1].c, T = (SW.length - 1) * DT;
    out.vMean = r3(Math.hypot(c1.x - c0.x, c1.z - c0.z) / T);
  }
  // 걸음 안 빠르기 폭
  const ranges = [];
  for (let j = 0; j + 1 < fT.length; j++) { const seg = W.slice(fT[j].i, fT[j + 1].i + 1).map((x) => Math.hypot(x.c.vx, x.c.vz)); ranges.push(Math.max(...seg) - Math.min(...seg)); }
  out.vRangeMean = r3(mean(ranges));
  // 디딜 때 골반 높이 흐름 (5 s 에 내려간 cm)
  if (tdReal.length >= 3) { const xs = tdReal.map((d) => d.t), ys = tdReal.map((d) => d.py), mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0; for (let j = 0; j < xs.length; j++) { sxy += (xs[j] - mx) * (ys[j] - my); sxx += (xs[j] - mx) ** 2; } out.tdPelvisDrop5s = r3(sxx > 0 ? (-sxy / sxx) * 5 * 100 : 0); } else out.tdPelvisDrop5s = null;
  out.pelvisMin = r3(W.length ? Math.min(...W.map((x) => x.py)) : null);
  out.tiltMean = r3(mean(W.map((x) => x.tilt)));
  out.frictionCut = r3(W.filter((x) => x.ran).length ? W.filter((x) => x.slipped).length / W.filter((x) => x.ran).length : null);
  // 바란 ÷ 한도 (디딘 다리 = 디딘 스텝 · 든 다리 = 뜬 스텝)
  const stS = {}, swS = {}; for (const k of AXES) { stS[k] = []; swS[k] = []; }
  let stanceSteps = 0, satSteps = 0, capSteps = 0, capKnown = false;
  const abdArm = [], copAx = [];
  for (const x of W) {
    const st = x.calls.filter((cc) => cc.stance);
    if (st.length) { stanceSteps++; if (st.some((cc) => AXES.some((k) => cc.sh[k] > 1))) satSteps++; if (x.cap != null) { capKnown = true; if (x.cap) capSteps++; } }
    for (const cc of x.calls) for (const k of AXES) { if (!cc.stance && k === 'ankle') continue; (cc.stance ? stS : swS)[k].push(cc.sh[k]); }
    if (st.length === 1 && st[0].abdArm != null) abdArm.push(st[0].abdArm);
    for (const cc of st) if (cc.copAx != null && cc.Fy > 0.3 * Mg) copAx.push(cc.copAx);
  }
  out.share = {}; for (const k of AXES) out.share[k] = { st95: r3(pct(stS[k], 0.95)), st99: r3(pct(stS[k], 0.99)), stPk: r3(stS[k].length ? Math.max(...stS[k]) : null), sw95: r3(pct(swS[k], 0.95)), sw99: r3(pct(swS[k], 0.99)), swPk: r3(swS[k].length ? Math.max(...swS[k]) : null) };
  { const v = AXES.flatMap((k) => [out.share[k].st99, out.share[k].sw99]).filter((x) => x != null); out.share99Max = v.length ? r3(Math.max(...v)) : null; }
  out.cutShare = r3(stanceSteps ? (capKnown ? capSteps : satSteps) / stanceSteps : null);
  out.cutSrc = capKnown ? 'legDrive.dbg.capCut' : '대신 셈: 바란 토크가 한도를 넘은 디딘 스텝';
  out.abdArmMean = r3(mean(abdArm)); out.copMean = r3(mean(copAx));
  out.kneeDeepDeg = r3(rec.kneeDeep.length ? (Math.max(...rec.kneeDeep) * 180) / Math.PI : null);
  // 윗몸 yaw 흔들림 (가슴 앞 − 무게중심 가는 쪽 · 평균을 뺀 95 %)
  { const dev = []; for (const x of W) { const v = Math.hypot(x.c.vx, x.c.vz); if (v < 0.5) continue; let d = x.chestYaw - Math.atan2(x.c.vz, x.c.vx); d = Math.atan2(Math.sin(d), Math.cos(d)); dev.push(d); } const m0 = mean(dev) ?? 0; out.yawSwayP95 = r3(dev.length ? (pct(dev.map((d) => Math.abs(d - m0)), 0.95) * 180) / Math.PI : null); }
  // 관절 끝 · 각속도 · 일률
  out.ends = Object.fromEntries(Object.entries(rec.ends).map(([k, A]) => [k, { share: r3(A.near / Math.max(1, A.n)), n: A.n, zMin: r3(A.zMin), zMax: r3(A.zMax) }]));
  out.endMax = Object.keys(out.ends).length ? r3(Math.max(...Object.values(out.ends).map((e) => e.share))) : null;
  out.rate = Object.fromEntries(Object.entries(rec.rate).map(([k, x]) => [k, { wPk: r3(x.wPk), pPkWkg: r3(x.pPk) }]));
  // 정직 (honesty 요약)
  const HS = L.summary(), cat = (k, q) => HS.cats?.[k]?.[q] ?? 0;
  out.hon = { supportNs: r3(cat('support', 'Fimp')), pushNs: r3(cat('push', 'Fimp')), anchorNms: r3(cat('anchor', 'Timp')), writeNs: r3(cat('write', 'Fimp')), extJoints: HS.externalJoints.length, aidRun: HS.aidRun, aidAll: { yawAvg: r3(HS.aid.yaw.avg), yawPk: r3(HS.aid.yaw.peak), tiltAvg: r3(HS.aid.tilt.avg), tiltPk: r3(HS.aid.tilt.peak), forceNs: r3(HS.aid.grossNs) } };
  out.legAxes = HS.legAxes;
  { let pk = null, m99 = null; for (const v of Object.values(HS.legAxes ?? {})) { pk = Math.max(pk ?? 0, v.peak); m99 = Math.max(m99 ?? 0, v.motorP99); } out.delivPeakMax = r3(pk); out.motorP99Max = r3(m99); } // 장부가 비면 null (관문에서 '없음' = FAIL)
  // 장면마다의 수
  const all = S;
  const vAt = (t) => { const seg = all.filter((x) => x.t >= t - 0.125 && x.t < t + 0.125); return seg.length ? mean(seg.map((x) => Math.hypot(x.c.vx, x.c.vz))) : null; };
  if (DEF.kind === 'hop' && W.length > 1) {
    const c0 = W[0].c, c1 = W[W.length - 1].c; out.drift = r3(Math.hypot(c1.x - c0.x, c1.z - c0.z));
    const tm = W[W.length - 1].t - 3, k3 = W.find((x) => x.t >= tm); out.drift3sSpeed = r3(k3 ? Math.hypot(c1.x - k3.c.x, c1.z - k3.c.z) / 3 : null);
  }
  if (DEF.kind === 'entry' && o.tOn != null) {
    const t0 = o.tOn; out.vAt = [0, 1, 2, 3, 4].map((d) => r3(vAt(t0 + d)));
    const c0 = all.find((x) => x.t >= t0)?.c, c4 = all.filter((x) => x.t <= t0 + 4).pop()?.c; out.dist4 = r3(c0 && c4 ? Math.hypot(c4.x - c0.x, c4.z - c0.z) : null);
    out.fellEarly = o.fell && o.tFall != null && o.tFall - t0 < 1.5; out.accel1 = r3(out.vAt[1] != null && out.vAt[0] != null ? out.vAt[1] - out.vAt[0] : null);
  }
  if (DEF.kind === 'entry' && o.tOn == null) { out.vAt = null; out.fellEarly = o.fell; }
  if (DEF.kind === 'break' && ctx.s.broke != null) {
    const tb = ctx.s.broke, v0 = vAt(tb), after = all.filter((x) => x.t >= tb), stop = after.find((x) => Math.hypot(x.c.vx, x.c.vz) < 0.3);
    out.vBreak = r3(v0); out.stopT = r3(stop ? stop.t - tb : null); out.stopDist = r3(stop ? Math.hypot(stop.c.x - after[0].c.x, stop.c.z - after[0].c.z) : null); out.decel = r3(stop && stop.t > tb ? v0 / (stop.t - tb) : null);
  }
  if (DEF.kind === 'turn' && ctx.s.turned != null) {
    const t1 = ctx.s.turned, seg = all.filter((x) => x.t >= t1 && x.t <= t1 + 3), v0 = vAt(t1 - 0.125), h0 = Math.atan2(seg[0]?.c.vz ?? 0, seg[0]?.c.vx ?? 1);
    let done = null, dmax = 0; for (const x of seg) { let d = Math.atan2(x.c.vz, x.c.vx) - h0; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); dmax = Math.max(dmax, d); if (done == null && d >= 0.9 * Math.PI / 2) done = x; }
    const end = done ?? seg[seg.length - 1], segT = seg.filter((x) => x.t <= end.t), vm = mean(segT.map((x) => Math.hypot(x.c.vx, x.c.vz)));
    out.vTurn0 = r3(v0); out.turnDone = !!done; out.turnT = r3(end.t - t1); out.turnDeg = r3((dmax * 180) / Math.PI);
    out.latAccel = r3(end.t > t1 ? (vm * Math.min(dmax, Math.PI / 2)) / (end.t - t1) : null); out.turnLoss = r3(v0 > 0 ? 1 - Math.min(...segT.map((x) => Math.hypot(x.c.vx, x.c.vz))) / v0 : null);
  }
  if (DEF.kind === 'hit' || DEF.kind === 'walkhit') { out.hitAt = r3(ctx.s.hit ?? null); out.hitDone = ctx.s.hit != null; }
  out.vTarget = DEF.v ?? null;
  return out;
}

const vr = args.variants ? String(args.variants).split('-').map(Number) : [+(args.variant ?? 0), +(args.variant ?? 0)];
if (vr.length === 1) vr.push(vr[0]);
const LIST = args.list ? String(args.list).split(',').map(Number) : Array.from({ length: vr[1] - vr[0] + 1 }, (_, j) => vr[0] + j);
const res = [];
const DUMP = [];
if (!args.quiet) console.log(`뛰기 장면 ${SCENE} · ${args.weapon ?? 'longsword'} · 판 ${vr[0]}~${vr[1]} · 덮어씀 ${JSON.stringify(cfgDone)}${cfgMissing.length ? ' · 없는 칸(건너뜀) ' + cfgMissing.join(',') : ''}`);
for (const v of LIST) {
  const r = one(v); r.pre = LASTPRE; res.push(r);
  if (!args.quiet) console.log(JSON.stringify(r));
}
if (args.dump) { const f = String(args.dump); writeFileSync(f + '.tmp', JSON.stringify(DUMP)); renameSync(f + '.tmp', f); }
if (args.json) { const f = String(args.json); writeFileSync(f + '.tmp', JSON.stringify({ scene: SCENE, weapon: String(args.weapon ?? 'longsword'), cfgDone, cfgMissing, runs: res })); renameSync(f + '.tmp', f); }
