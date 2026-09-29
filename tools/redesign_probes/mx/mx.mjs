// Motion envelope + latency probe for the owner's two complaints (big motion, sluggishness).
// Run from the snapshot root:  cd <snap> && node <scratch>/mx/mx.mjs <sub>   (env WHOLE=0|1, HZ=60|120, W=weapon)
//  sub: hull | env | lat | redirect | stop | walk
import fs from 'node:fs';
const SNAP = '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/src_4b5c56a';
const H = await import(SNAP + '/tools/sim/harness_m.mjs');
const { newRound, THREE, DT, CONFIG, V, Q, handPos, feedTrace, inputPump } = H;
const { guardAt, GUARDS } = await import(SNAP + '/src/guards.js');
CONFIG.BODY.weightMode = 'hybrid'; // game default
if (process.env.CFG) for (const [k, v] of Object.entries(JSON.parse(process.env.CFG))) { const [a, b] = k.split('.'); CONFIG[a][b] = v; } // e.g. CFG='{"SKILL.aimFilter":200}'
const OUTDIR = '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/mx/out';
fs.mkdirSync(OUTDIR, { recursive: true });
const SUB = process.argv[2] || 'env';
const R2D = 180 / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const r0 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));

const PAD = { Pflug: [0.18, -0.28], Tag: [0.02, 0.52], ShR: [0.42, 0.42], ShL: [-0.4, 0.42], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], WechselL: [-0.4, -0.42], Ochs: [0.22, 0.26], OchsL: [-0.22, 0.26], Alber: [0, -0.5] };
const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL }, diagL: { ch: PAD.ShL, end: PAD.Wechsel }, vert: { ch: PAD.Tag, end: PAD.Alber },
  horizR: { ch: PAD.Side, end: PAD.SideL }, horizL: { ch: PAD.SideL, end: PAD.Side }, riseR: { ch: PAD.Wechsel, end: PAD.OchsL },
  // arm-only "small" cut from the home guard (Pflug): never commits when autoChamber is off (preview default)
  pflugDiag: { ch: PAD.Pflug, end: [-0.3, -0.45] },
};

function stroke(dx, dy, v, { shape = 'minjerk', hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; const k = shape === 'minjerk' ? sj(u) : u; return [dx * k, dy * k]; }, T: T + hold, lift, down };
}
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(xy[0], xy[1]);
  k.aimVel.set(0, 0); k.vel.set(0, 0); k.follow.set(0, 0);
}
function stage(o = {}) {
  CONFIG.WHOLE.on = o.whole;
  CONFIG.COMMIT.autoChamber = !!o.auto;
  const G = newRound({ walls: false, gap: (o.dist ?? 1.9) + 0.17, seed: o.seed ?? 7, weapon: o.weapon });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (o.air !== false) for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = o.skill ?? 0.7;
  setPad(P, o.pad ?? PAD.Pflug);
  inputPump(G, { hz: o.hz ?? 60 });
  P.commitLog = [];
  const oc = P.onCommit.bind(P);
  P.onCommit = (st, c, fam) => { P.commitLog.push({ t: G.t, st, c, fam }); return oc(st, c, fam); };
  G.run = (secs, fn) => { for (let i = 0; i < Math.round(secs / DT); i++) { fn?.(i); G.step(); } };
  return G;
}

// ── one sample: body-frame kinematics ──
const _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0);
function bodyYaw(rb) { const f = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(rb.rotation())); return Math.atan2(-f.z, f.x); }
function sample(G) {
  const f = G.player;
  const yawInv = f.yaw.clone().invert();
  const chest = V(f.bodies.chest.translation());
  const pel = V(f.bodies.pelvis.translation());
  const head = V(f.bodies.head.translation());
  const cq = Q(f.bodies.chest.rotation());
  const cqInv = cq.clone().invert();
  const hand = handPos(f);
  const tip = f.bladePoint(1, new THREE.Vector3());
  const toH = (p) => { const v = p.clone().sub(chest).applyQuaternion(yawInv); v.z *= f.side; return v; }; // heading frame, +z = sword side
  const toC = (p) => { const v = p.clone().sub(chest).applyQuaternion(cqInv); v.z *= f.side; return v; }; // torso (chest body) frame
  // shoulder: upper-arm direction in chest-body frame
  const ua = _x.clone().applyQuaternion(Q(f.bodies.uarmS.rotation())).applyQuaternion(cqInv); ua.z *= f.side;
  const fa = _x.clone().applyQuaternion(Q(f.bodies.farmS.rotation()));
  const uaW = _x.clone().applyQuaternion(Q(f.bodies.uarmS.rotation()));
  const elbow = Math.acos(THREE.MathUtils.clamp(uaW.dot(fa), -1, 1)) * R2D;
  const shElev = Math.asin(THREE.MathUtils.clamp(ua.y, -1, 1)) * R2D; // + = upper arm above horizontal (torso frame)
  const shAz = Math.atan2(-ua.z, ua.x) * R2D; // + = upper arm swung across the body toward the off side
  const tgtH = f.handTarget.clone().sub(chest).applyQuaternion(yawInv); tgtH.z *= f.side;
  const sk = f.skill;
  return {
    t: G.t,
    off: [f.handOffset.x, f.handOffset.y], anchor: [sk.anchor.x, sk.anchor.y], aimRaw: [sk.aimRaw.x, sk.aimRaw.y], aim: [sk.aim.x, sk.aim.y],
    handH: toH(hand), handC: toC(hand), tipH: toH(tip), tipC: toC(tip), tgtH,
    handW: hand, tipW: tip, headH: toH(head), headTopY: head.y + 0.1 - chest.y, chestY: chest.y, pelY: pel.y,
    pelTw: wrap(bodyYaw(f.bodies.pelvis) - f.heading) * R2D * -f.side, chTw: wrap(bodyYaw(f.bodies.chest) - f.heading) * R2D * -f.side,
    chVsPel: wrap(bodyYaw(f.bodies.chest) - bodyYaw(f.bodies.pelvis)) * R2D * -f.side,
    elbow, shElev, shAz, tipV: f.tipVel.length(), cm: f.commit?.on ? (f.commit.padOn ? 'P' : 'A') : '-', u: f.commit?.u ?? null,
    act: sk.activity, filterW: sk.filterW, bpPel: f.bodyPose.pelvisYaw * R2D, bpCh: f.bodyPose.chestYaw * R2D,
    com: f.com ? f.com.clone() : pel.clone(), heading: f.heading,
  };
}
const ext = (S, fn) => { const a = S.map(fn); return [Math.min(...a), Math.max(...a)]; };

// ── the standard cut: move finger slowly to chamber, dwell, then cut (same finger input with WHOLE on/off) ──
function doCut(G, famName, o = {}) {
  const P = G.player;
  const F = FAM[famName];
  const hz = o.hz ?? 60;
  const S = [];
  const smp = () => S.push(sample(G));
  const off = [P.handOffset.x, P.handOffset.y];
  let iCh0 = 0;
  let chambered = false;
  if (Math.hypot(F.ch[0] - off[0], F.ch[1] - off[1]) > 0.01) {
    const ch = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], o.chamberV ?? 1.2, { shape: 'drag', hold: (o.dwell ?? 0.6) * 1000, lift: false }), hz);
    chambered = true;
    while (!ch.done) { G.step(); smp(); }
  }
  const cur = [P.handOffset.x, P.handOffset.y];
  const end = o.to ?? F.end;
  const cut = feedTrace(G, stroke(end[0] - cur[0], end[1] - cur[1], o.v ?? 10, { shape: o.shape ?? 'minjerk', down: !chambered, lift: o.lift ?? true, hold: o.hold ?? 0 }), hz);
  do { G.step(); smp(); } while (cut.t0 == null);
  const i0 = S.length - 1;
  for (let i = 0; i < (o.after ?? 1.2) / DT; i++) { o.each?.(G, cut); G.step(); smp(); }
  return { S, i0, iCh0, t0: cut.t0, cut, fingerDir: [end[0] - cur[0], end[1] - cur[1]] };
}

function envSummary(C) {
  const { S, i0 } = C;
  const W = S.slice(0, i0 + Math.round(0.8 / DT)); // wind-up + 0.8 s of cut/follow-through
  const Wc = S.slice(i0, i0 + Math.round(0.8 / DT));
  const hx = ext(W, (s) => s.handH.x), hy = ext(W, (s) => s.handH.y), hz = ext(W, (s) => s.handH.z);
  const tx = ext(W, (s) => s.tipH.x), ty = ext(W, (s) => s.tipH.y), tz = ext(W, (s) => s.tipH.z);
  const cx = ext(W, (s) => s.handC.x);
  const headTop = Math.max(...W.map((s) => s.headTopY));
  const pel = ext(W, (s) => s.pelTw), ch = ext(W, (s) => s.chTw), cvp = ext(W, (s) => s.chVsPel);
  const el = ext(W, (s) => s.elbow), se = ext(W, (s) => s.shElev), sa = ext(W, (s) => s.shAz);
  const tipPk = Math.max(...Wc.map((s) => s.tipV));
  // hand-over-head, behind-frontal-plane and cross-body measures
  const aboveHead = Math.max(...W.map((s) => s.handH.y - s.headTopY));
  const behind = Math.min(...W.map((s) => s.handH.x)); // hand fwd relative to chest centre (heading frame)
  const behindC = Math.min(...W.map((s) => s.handC.x)); // in torso frame
  const cross = Math.min(...W.map((s) => s.handH.z)); // most off-side hand position (m, - = past midline toward off side)
  // bounding box in heading frame during the cut window only
  const bx = ext(Wc, (s) => s.handH.x), by = ext(Wc, (s) => s.handH.y), bz = ext(Wc, (s) => s.handH.z);
  // hand path length in heading frame during cut, wind-up hand travel back (opposite to cut) before cut
  let path = 0;
  for (let i = 1; i < Wc.length; i++) path += Wc[i].handH.distanceTo(Wc[i - 1].handH);
  let span = 0;
  for (let i = 0; i < W.length; i += 2) for (let j = i + 2; j < W.length; j += 2) span = Math.max(span, W[i].handH.distanceTo(W[j].handH));
  const cm = S.filter((s) => s.cm === 'P').length > 0;
  return {
    committed: cm,
    hand_fwd: hx.map(r2), hand_up: hy.map(r2), hand_side: hz.map(r2), headTop: r2(headTop),
    hand_aboveHeadTop_max: r2(aboveHead), hand_fwd_min_heading: r2(behind), hand_fwd_min_torso: r2(behindC), hand_side_min: r2(cross),
    cutBox: { fwd: bx.map(r2), up: by.map(r2), side: bz.map(r2) },
    tip_fwd: tx.map(r2), tip_up: ty.map(r2), tip_side: tz.map(r2),
    pelvisYaw: pel.map(r0), pelvisYawRange: r0(pel[1] - pel[0]), chestYaw: ch.map(r0), chestYawRange: r0(ch[1] - ch[0]), chestVsPelvis: cvp.map(r0),
    elbow: el.map(r0), shoulderElev: se.map(r0), shoulderAz: sa.map(r0),
    handPathCut: r2(path), handSpanAll: r2(span), tipPk: +tipPk.toFixed(1),
  };
}

const out = { sub: SUB, whole: process.env.WHOLE, hz: process.env.HZ };
const HZs = (process.env.HZ || '60,120').split(',').map(Number);
const WHs = (process.env.WHOLE ?? '0,1').split(',').map((x) => x === '1');
const weapon = process.env.W || undefined;

if (SUB === 'hull') {
  // static guard map: every pad position within the input disk → hand target (chest centre origin, heading frame) and body yaw targets
  const g = {};
  let mn = [9, 9, 9], mx = [-9, -9, -9], pel = [9, -9], ch = [9, -9];
  const R = CONFIG.WEAPON.reach;
  for (let x = -R; x <= R; x += 0.01) for (let y = -R; y <= R; y += 0.01) {
    if (Math.hypot(x, y) > R) continue;
    guardAt(x, y, g);
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.hand[k]); mx[k] = Math.max(mx[k], g.hand[k]); }
    pel = [Math.min(pel[0], g.pelvisYaw), Math.max(pel[1], g.pelvisYaw)];
    ch = [Math.min(ch[0], g.chestYaw), Math.max(ch[1], g.chestYaw)];
  }
  out.padRadius = R;
  out.handTargetHull = { fwd: [r2(mn[0]), r2(mx[0])], up: [r2(mn[1]), r2(mx[1])], side: [r2(mn[2]), r2(mx[2])] };
  out.guardTableYawDeg = { pelvis: [r0(pel[0] * R2D), r0(pel[1] * R2D)], chest: [r0(ch[0] * R2D), r0(ch[1] * R2D)] };
  out.guards = GUARDS.slice(0, 14).map((q) => ({ name: q.name, hand: q.hand, pelvisYaw: r0(q.pelvisYaw * R2D), chestYaw: r0(q.chestYaw * R2D) }));
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(OUTDIR + '/hull.json', JSON.stringify(out, null, 1));
}

if (SUB === 'env') {
  const fams = (process.env.FAMS || 'diagR,diagL,vert,horizR,horizL,riseR,pflugDiag').split(',');
  const vs = (process.env.VS || '8,12').split(',').map(Number);
  out.rows = [];
  for (const hz of HZs) for (const fam of fams) for (const v of vs) for (const whole of WHs) {
    const G = stage({ whole, hz, weapon });
    G.run(2.0);
    const C = doCut(G, fam, { hz, v, after: 1.2 });
    const A = envSummary(C);
    A.commits = G.player.commitLog.map((c) => `${c.st}@${r0((c.t - C.t0) * 1000)}`).join(' ');
    const row = { hz, fam, v, whole: whole ? 1 : 0, ...A };
    out.rows.push(row);
    console.log(JSON.stringify(row));
    if (process.env.TRACE && fam === process.env.TRACE && v === vs[0]) {
      const csv = ['t,phase,cm,hand_fwd,hand_up,hand_side,tip_fwd,tip_up,tip_side,pelTw,chTw,elbow,shElev,shAz,tipV'];
      C.S.forEach((s, i) => csv.push([r2((s.t - C.t0) * 1000) , i < C.i0 ? 'wind' : 'cut', s.cm, r2(s.handH.x), r2(s.handH.y), r2(s.handH.z), r2(s.tipH.x), r2(s.tipH.y), r2(s.tipH.z), r0(s.pelTw), r0(s.chTw), r0(s.elbow), r0(s.shElev), r0(s.shAz), +s.tipV.toFixed(1)].join(',')));
      fs.writeFileSync(`${OUTDIR}/trace_${fam}_${hz}_w${whole ? 1 : 0}.csv`, csv.join('\n'));
    }
  }
  fs.writeFileSync(`${OUTDIR}/env_${HZs.join('-')}${weapon ? '_' + weapon : ''}.json`, JSON.stringify(out, null, 1));
}

// ── latency: finger start → each stage of the pipeline moves 2 cm / 5 cm ──
function firstMove(S, i0, get, thr, dir) {
  const p0 = get(S[i0]);
  for (let i = i0; i < S.length; i++) {
    const p = get(S[i]);
    const d = dir ? (p[0] - p0[0]) * dir[0] + (p[1] - p0[1]) * dir[1] + ((p[2] ?? 0) - (p0[2] ?? 0)) * (dir[2] ?? 0) : Math.hypot(p[0] - p0[0], p[1] - p0[1], (p[2] ?? 0) - (p0[2] ?? 0));
    if (d >= thr) return S[i].t;
  }
  return null;
}
/** best time shift (ms) aligning signal b (pad xy) onto finger a (pad xy) over the stroke: min RMS of a(t) − b(t + lag) */
function lagMs(S, i0, iEnd, ga, gb) {
  let best = [1e9, 0];
  for (let L = 0; L <= 40; L++) {
    let e = 0, n = 0;
    for (let i = i0; i + L < iEnd; i++) { const a = ga(S[i]), b = gb(S[i + L]); e += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; n++; }
    if (n > 5 && e / n < best[0]) best = [e / n, L];
  }
  return r0(best[1] * DT * 1000);
}
const ms = (t, t0) => (t == null ? null : r0((t - t0) * 1000));

if (SUB === 'lat') {
  const fams = (process.env.FAMS || 'diagR,vert,horizR,diagL,pflugDiag').split(',');
  const vs = (process.env.VS || '6,12').split(',').map(Number);
  const shapes = (process.env.SHAPES || 'minjerk,drag').split(',');
  out.rows = [];
  for (const hz of HZs) for (const fam of fams) for (const v of vs) for (const shape of shapes) for (const whole of WHs) {
    const G = stage({ whole, hz, weapon });
    G.run(2.0);
    const C = doCut(G, fam, { hz, v, shape, after: 1.0 });
    const { S, i0, t0 } = C;
    const fd = C.fingerDir; const fl = Math.hypot(fd[0], fd[1]); const u = [fd[0] / fl, fd[1] / fl];
    const Tfin = C.cut.T / 1000;
    const iEnd = Math.min(S.length - 1, i0 + Math.round((Tfin + 0.15) / DT));
    // world-frame direction of the wrist's eventual displacement (0.3 s after start) for "along" metrics
    const w0 = S[i0].handW, w1 = S[Math.min(S.length - 1, i0 + Math.round(Math.min(Tfin, 0.3) / DT))].handW;
    const wd = w1.clone().sub(w0).normalize();
    const T0 = S[i0].tipW, T1 = S[Math.min(S.length - 1, i0 + Math.round(Math.min(Tfin, 0.3) / DT))].tipW;
    const td = T1.clone().sub(T0).normalize();
    const P = (k) => (s) => s[k];
    const Wv = (k) => (s) => [s[k].x, s[k].y, s[k].z];
    // time for aim (filtered hand target, pad space) to cover 50/90 % of finger displacement
    const frac = (k, f) => { for (let i = i0; i < S.length; i++) { const p = S[i][k]; const d = (p[0] - S[i0][k][0]) * u[0] + (p[1] - S[i0][k][1]) * u[1]; if (d >= f * fl) return S[i].t; } return null; };
    // wrist: time to 50/90 % of its own displacement along final direction at finger end + 0.3 s
    const iF = Math.min(S.length - 1, i0 + Math.round((Tfin + 0.3) / DT));
    const wTot = S[iF].handW.clone().sub(w0).length();
    const wfrac = (f) => { for (let i = i0; i < S.length; i++) if (S[i].handW.distanceTo(w0) >= f * wTot) return S[i].t; return null; };
    const pk = (k) => { let m = 0, tm = null; for (let i = i0; i < Math.min(S.length, i0 + Math.round(0.6 / DT)); i++) if (S[i][k] > m) { m = S[i][k]; tm = S[i].t; } return [m, tm]; };
    const [tipPk, tTipPk] = pk('tipV');
    const firstP = S.findIndex((s, i) => i >= i0 && s.cm === 'P');
    const row = {
      hz, fam, v, shape, whole: whole ? 1 : 0, fingerT_ms: r0(Tfin * 1000), fingerLen: r2(fl),
      commits: G.player.commitLog.map((c) => `${c.st}@${ms(c.t, t0)}`).join(' '), programStart_ms: firstP >= 0 ? ms(S[firstP].t, t0) : null,
      off2: ms(firstMove(S, i0, P('off'), 0.02, u), t0), anchor2: ms(firstMove(S, i0, P('anchor'), 0.02, u), t0), aimRaw2: ms(firstMove(S, i0, P('aimRaw'), 0.02, u), t0),
      aim2: ms(firstMove(S, i0, P('aim'), 0.02, u), t0), tgt2: ms(firstMove(S, i0, Wv('tgtH'), 0.02), t0),
      wrist2: ms(firstMove(S, i0, Wv('handW'), 0.02), t0), wrist2along: ms(firstMove(S, i0, Wv('handW'), 0.02, [wd.x, wd.y, wd.z]), t0),
      tip2: ms(firstMove(S, i0, Wv('tipW'), 0.02), t0), tip5along: ms(firstMove(S, i0, Wv('tipW'), 0.05, [td.x, td.y, td.z]), t0),
      aim50: ms(frac('aim', 0.5), t0), aim90: ms(frac('aim', 0.9), t0), off90: ms(frac('off', 0.9), t0),
      wrist50: ms(wfrac(0.5), t0), wrist90: ms(wfrac(0.9), t0),
      lag_aimRaw: lagMs(S, i0, iEnd, P('off'), P('aimRaw')), lag_aim: lagMs(S, i0, iEnd, P('off'), P('aim')),
      lag_wrist_vs_target: (() => { let best = [1e9, 0]; for (let L = 0; L <= 60; L++) { let e = 0, n = 0; for (let i = i0; i + L < iEnd + 30 && i + L < S.length; i++) { e += S[i].tgtH.distanceToSquared(S[i + L].handH); n++; } if (n > 5 && e / n < best[0]) best = [e / n, L]; } return [r0(best[1] * DT * 1000), r2(Math.sqrt(best[0]))]; })(),
      wristPkV: (() => { let m = 0; for (let i = i0 + 1; i < Math.min(S.length, i0 + 72); i++) m = Math.max(m, S[i].handW.distanceTo(S[i - 1].handW) / DT); return +m.toFixed(1); })(),
      tgtPkV: (() => { let m = 0; for (let i = i0 + 1; i < Math.min(S.length, i0 + 72); i++) m = Math.max(m, S[i].tgtH.distanceTo(S[i - 1].tgtH) / DT); return +m.toFixed(1); })(),
      tipPk: +tipPk.toFixed(1), tipPk_ms: ms(tTipPk, t0),
      pelvis5deg: ms((() => { const p0 = S[i0].pelTw; for (let i = i0; i < S.length; i++) if (Math.abs(S[i].pelTw - p0) >= 5) return S[i].t; return null; })(), t0),
      chest5deg: ms((() => { const p0 = S[i0].chTw; for (let i = i0; i < S.length; i++) if (Math.abs(S[i].chTw - p0) >= 5) return S[i].t; return null; })(), t0),
      // settle: after finger stops, when does the wrist come to rest (< 0.3 m/s for 50 ms)?
      wristSettle_ms: (() => { let run = 0; for (let i = i0 + Math.round(Tfin / DT); i < S.length - 1; i++) { const v = S[i + 1].handW.distanceTo(S[i].handW) / DT; run = v < 0.3 ? run + 1 : 0; if (run >= 6) return ms(S[i].t, t0 + Tfin); } return null; })(),
    };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${OUTDIR}/lat_${HZs.join('-')}${process.env.TAG || ''}.json`, JSON.stringify(out, null, 1));
}

// ── redirect: committed cut, then the player reverses (parry/feint/follow-up) at a given delay after the cut started ──
if (SUB === 'redirect') {
  const delays = (process.env.DELAYS || '100,200,350,500').split(',').map(Number);
  const fams = (process.env.FAMS || 'diagR,vert').split(',');
  out.rows = [];
  for (const hz of HZs) for (const fam of fams) for (const dl of delays) for (const whole of WHs) {
    const G = stage({ whole, hz, weapon });
    G.run(2.0);
    const P = G.player;
    const F = FAM[fam];
    let t2 = null; let q2 = null; let from = null;
    // cut at 10 m/s, finger stays down; at dl ms after start drag back toward the high guard opposite (Ochs on other side, i.e. a parry/raise)
    const C = doCut(G, fam, { hz, v: 10, lift: false, hold: 0, after: 1.2, each: (G2, cut) => {
      if (q2 == null && cut.t0 != null && (G2.t - cut.t0) * 1000 >= dl) {
        from = [P.handOffset.x, P.handOffset.y];
        const tgt = PAD.Ochs; // raise to Ochs (parry / change)
        q2 = feedTrace(G2, stroke(tgt[0] - from[0], tgt[1] - from[1], 6, { shape: 'minjerk', down: false, lift: true }), hz);
      }
    } });
    const S = C.S;
    const i2 = S.findIndex((s) => q2 && q2.t0 != null && s.t >= q2.t0 - 1e-9);
    if (i2 < 0) continue;
    t2 = S[i2].t;
    // new finger direction (pad): toward Ochs; measure aim (pad) and wrist world motion toward the new target
    const tgt = PAD.Ochs;
    const nd = [tgt[0] - from[0], tgt[1] - from[1]]; const nl = Math.hypot(nd[0], nd[1]); const un = [nd[0] / nl, nd[1] / nl];
    // expected world direction of that pad move: compare with WHOLE-off guard map: hand target at Ochs minus hand now (heading frame)
    const g = guardAt(tgt[0], tgt[1], {});
    const hTgt = new THREE.Vector3(g.hand[0], g.hand[1], g.hand[2]);
    const dist = (s) => s.handH.distanceTo(hTgt);
    const d0 = dist(S[i2]);
    let tAim = null, tW = null, tW50 = null, maxAway = 0, tipAway = 0;
    for (let i = i2; i < S.length; i++) {
      const a = S[i].aim; const da = (a[0] - S[i2].aim[0]) * un[0] + (a[1] - S[i2].aim[1]) * un[1];
      if (tAim == null && da >= 0.02) tAim = S[i].t;
      const dd = d0 - dist(S[i]);
      maxAway = Math.max(maxAway, -dd);
      if (tW == null && dd >= 0.02) tW = S[i].t;
      if (tW50 == null && dd >= 0.5 * (d0 - 0.05)) tW50 = S[i].t;
    }
    const row = { hz, fam, delay: dl, whole: whole ? 1 : 0, commits: P.commitLog.map((c) => `${c.st}@${ms(c.t, C.t0)}`).join(' '), cmAtRedirect: S[i2].cm, uAtRedirect: r2(S[i2].u),
      aimToward2cm_ms: ms(tAim, t2), wristToward2cm_ms: ms(tW, t2), wristHalfway_ms: ms(tW50, t2), wristMovesAwayFirst_m: r2(maxAway), d0: r2(d0) };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${OUTDIR}/redirect_${HZs.join('-')}.json`, JSON.stringify(out, null, 1));
}

// ── stop: finger stops half-way (still touching) — where does the hand/blade end up? (can I stop a cut?) ──
if (SUB === 'stop') {
  const fams = (process.env.FAMS || 'diagR,vert,horizR').split(',');
  out.rows = [];
  for (const hz of HZs) for (const fam of fams) for (const frac of [0.5, 0.7]) for (const whole of WHs) {
    const G = stage({ whole, hz, weapon });
    G.run(2.0);
    const F = FAM[fam];
    const to = [F.ch[0] + (F.end[0] - F.ch[0]) * frac, F.ch[1] + (F.end[1] - F.ch[1]) * frac];
    const C = doCut(G, fam, { hz, v: 10, to, lift: false, hold: 1000, after: 1.5 });
    const S = C.S;
    const g = guardAt(to[0], to[1], {});
    const hStop = new THREE.Vector3(g.hand[0], g.hand[1], g.hand[2]);
    const iE = C.i0 + Math.round((C.cut.T / 1000 - 1.0) / DT);
    let over = 0; for (let i = iE; i < S.length; i++) over = Math.max(over, S[i].handH.distanceTo(hStop));
    const last = S[S.length - 1];
    const row = { hz, fam, frac, whole: whole ? 1 : 0, commits: G.player.commitLog.map((c) => `${c.st}@${ms(c.t, C.t0)}`).join(' '),
      handMaxFromStopGuard_m: r2(over), handFinalFromStopGuard_m: r2(last.handH.distanceTo(hStop)), tipFinal_up: r2(last.tipH.y), pelTwFinal: r0(last.pelTw), chTwFinal: r0(last.chTw) };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${OUTDIR}/stop_${HZs.join('-')}.json`, JSON.stringify(out, null, 1));
}

// ── walk: joystick forward / stop — COM velocity latency, WHOLE on/off (gait fwdFix) ──
if (SUB === 'walk') {
  out.rows = [];
  for (const hz of HZs) for (const whole of WHs) for (const y of [0.5, 1.0, -1.0]) {
    const G = stage({ whole, hz, weapon, dist: 3.5 });
    G.run(2.0);
    const P = G.player;
    const pump = G.pump;
    const S = [];
    const fwd = P.forward(new THREE.Vector3());
    const c0 = P.com.clone();
    pump.stick = { x: 0, y };
    let t0 = G.t, t10 = null, t30 = null, tStop = null, vmax = 0;
    const pv = [];
    let prev = P.com.clone();
    for (let i = 0; i < 1.5 / DT; i++) { G.step(); const c = P.com.clone(); const v = c.clone().sub(prev).dot(fwd) / DT * Math.sign(y); prev = c; pv.push(v); }
    // smooth 3-step
    for (let i = 2; i < pv.length; i++) { const v = (pv[i] + pv[i - 1] + pv[i - 2]) / 3; vmax = Math.max(vmax, v); if (t10 == null && v >= 0.1) t10 = (i + 1) * DT; if (t30 == null && v >= 0.3) t30 = (i + 1) * DT; }
    pump.stick = { x: 0, y: 0 };
    const pv2 = [];
    for (let i = 0; i < 1.5 / DT; i++) { G.step(); const c = P.com.clone(); pv2.push(c.clone().sub(prev).dot(fwd) / DT * Math.sign(y)); prev = c; }
    for (let i = 2; i < pv2.length; i++) { const v = (pv2[i] + pv2[i - 1] + pv2[i - 2]) / 3; if (tStop == null && v < 0.1) tStop = (i + 1) * DT; }
    const row = { hz, whole: whole ? 1 : 0, stick: y, to0p1_ms: r0(t10 * 1000), to0p3_ms: r0(t30 * 1000), vmax: r2(vmax), stopTo0p1_ms: r0(tStop * 1000) };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${OUTDIR}/walk_${HZs.join('-')}.json`, JSON.stringify(out, null, 1));
}

// ── recover: finger lifted at the end of the cut → time until the fighter is back in Pflug (hand within 6 cm of guard hand, tip < 1.5 m/s),
//    and "hold": finger kept down at the end — how long the end pose / overlay is held (commit rest) ──
if (SUB === 'recover') {
  const fams = (process.env.FAMS || 'diagR,vert,horizR,diagL').split(',');
  out.rows = [];
  for (const hz of HZs) for (const fam of fams) for (const lift of [true, false]) for (const whole of WHs) {
    const G = stage({ whole, hz, weapon });
    G.run(2.0);
    const C = doCut(G, fam, { hz, v: 10, lift, hold: lift ? 0 : 1500, after: 2.5 });
    const S = C.S;
    const g = guardAt(PAD.Pflug[0], PAD.Pflug[1], {});
    const home = new THREE.Vector3(g.hand[0], g.hand[1], g.hand[2]);
    const tEnd = C.t0 + C.cut.T / 1000;
    let tHome = null;
    for (let i = C.i0; i < S.length; i++) if (S[i].t >= tEnd && S[i].handH.distanceTo(home) < 0.06 && S[i].tipV < 1.5) { tHome = S[i].t; break; }
    // commit overlay life: last sample where the commit is on
    let tCmOff = null;
    for (let i = C.i0; i < S.length; i++) if (S[i].cm !== '-') tCmOff = S[i].t;
    // for held finger: movement of the hand after the finger stopped (drift/hold)
    const iE = S.findIndex((s) => s.t >= tEnd);
    const iE2 = Math.min(S.length - 1, iE + Math.round(1.0 / DT));
    const row = { hz, fam, lift, whole: whole ? 1 : 0, fingerT_ms: r0(C.cut.T), commits: G.player.commitLog.map((c) => `${c.st}@${ms(c.t, C.t0)}`).join(' '),
      homeAfterFingerEnd_ms: ms(tHome, tEnd), commitOverlayUntil_ms: ms(tCmOff, tEnd),
      handDrift1s_m: iE >= 0 ? r2(S[iE2].handH.distanceTo(S[iE].handH)) : null, chTwAt1s: iE >= 0 ? r0(S[iE2].chTw) : null, pelTwAt1s: iE >= 0 ? r0(S[iE2].pelTw) : null };
    out.rows.push(row);
    console.log(JSON.stringify(row));
  }
  fs.writeFileSync(`${OUTDIR}/recover_${HZs.join('-')}.json`, JSON.stringify(out, null, 1));
}
