// Cost inventory probe for committed (whole-body, L1) cuts vs arm cuts on the SAME finger trace.
// Runs against the read-only snapshot src_4b5c56a. WHOLE.commit is toggled at runtime per trial (the code reads it every step).
// usage: node probe.mjs <sub> [N]
//   timeline  single big cut (4 families x 8/12 m/s x {air-miss at 1.7 m, hit at 1.55 m, far miss 2.8 m}) x finger {lift, back, hold}
//   rect      does COMMIT.recover (hit/miss/blocked recovery time) change anything? (trajectory hash)
//   abort     feint/abort: reverse or redirect the finger at t ms after start
//   block     static block: attacker rebound, push, time to guard
//   combo     second cut right after the first
//   aiwin     AI exploitation: big cut that whiffs near a live AI; does the AI punish (commit on vs off)?
import fs from 'node:fs';
const SNAP = '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/src_4b5c56a';
const H = await import(SNAP + '/tools/sim/harness_m.mjs');
const { newRound, THREE, DT, CONFIG, V, Q, handPos, feedTrace, inputPump } = H;
CONFIG.BODY.weightMode = process.env.MODE || 'hybrid';
const SUB = process.argv[2] || 'timeline';
const NARG = process.argv[3] != null ? +process.argv[3] : null;
const HZ = +(process.env.HZ || 60);
const OUTDIR = SNAP + '/../costs/out';

const r0 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : NaN; };
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))] : NaN; };
const med = (a) => q(a, 0.5);
const pct = (n, d) => (d ? +((100 * n) / d).toFixed(1) : null);
const line = (k, o) => console.log(String(k).padEnd(34), JSON.stringify(o));

const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], ShL: [-0.4, 0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], WechselL: [-0.4, -0.42], Wechsel: [0.38, -0.44], Side: [0.52, 0.03], SideL: [-0.52, 0.03], HangL: [-0.3, 0.28] };
const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL },
  diagL: { ch: PAD.ShL, end: PAD.Wechsel },
  vert: { ch: PAD.Tag, end: PAD.Alber },
  horizR: { ch: PAD.Side, end: PAD.SideL },
  horizL: { ch: PAD.SideL, end: PAD.Side },
};
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
function stroke(dx, dy, v, { shape = 'drag', hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  const fn = (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; const k = shape === 'minjerk' ? sj(u) : u; return [dx * k, dy * k]; };
  return { fn, T: T + hold, lift, down };
}
/** polyline trace: legs = [[dx,dy,v,holdMs]] continuous from the current finger point */
function poly(legs, { lift = true, down = true } = {}) {
  const segs = [];
  let t = 0, x = 0, y = 0;
  for (const [dx, dy, v, hold = 0] of legs) {
    const T = (Math.hypot(dx, dy) / v) * 1000;
    segs.push({ t0: t, T, x0: x, y0: y, dx, dy });
    x += dx; y += dy; t += T + hold;
  }
  const fn = (tm) => {
    let px = 0, py = 0;
    for (const s of segs) {
      if (tm < s.t0) break;
      const u = Math.min(1, (tm - s.t0) / Math.max(1e-6, s.T));
      px = s.x0 + s.dx * u; py = s.y0 + s.dy * u;
    }
    return [px, py];
  };
  return { fn, T: t, lift, down, segs };
}
const CHEST_GAP = 0.17;
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(xy[0], xy[1]);
  k.aimVel.set(0, 0); k.vel.set(0, 0); k.follow.set(0, 0);
}
function stage(o = {}) {
  const gap = o.dist != null ? o.dist + CHEST_GAP : o.gap ?? 2.0;
  const G = newRound({ walls: o.walls ?? false, gap, seed: o.seed ?? 7, weapon: o.weapon, weapon2: o.weapon2, difficulty: o.difficulty });
  const P = G.player, E = G.enemy;
  if (!o.foeAI) G.ai.update = () => E.move.set(0, 0);
  if (!o.foeSword && !o.foeAI) for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (o.air) for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  if (o.immortal) E.die = () => {};
  if (o.immortalP) P.die = () => {};
  P.skill.level = o.skill ?? 0.7;
  if (o.pad !== null) setPad(P, o.pad ?? PAD.Pflug);
  inputPump(G, { hz: o.hz ?? HZ });
  G.woundsR = [];
  G.onWound = (att, vic, r) => G.woundsR.push({ t: G.t, att, vic, zone: r.zone, E: r.energy, speed: r.speed });
  G.clashT = [];
  const oc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, touch) => { oc?.(point, sp, touch); G.clashT.push({ t: G.t, vn: touch ? touch.vn : sp, fresh: !!touch?.fresh, J: touch?.impulse }); };
  for (const f of [P, E]) {
    f.commitLog = [];
    const oc2 = f.onCommit.bind(f);
    f.onCommit = (stg, c, fam) => { f.commitLog.push({ t: G.t, stg, c, fam }); return oc2(stg, c, fam); };
    f.resLog = [];
    const or = f.onStrikeResult.bind(f);
    f.onStrikeResult = (k, info) => { f.resLog.push({ t: G.t, k }); return or(k, info); };
    f.tdLog = [];
    if (f.gait) { const ot = f.gait.onTouchdown.bind(f.gait); f.gait.onTouchdown = (foot, s, kind) => { f.tdLog.push({ t: G.t, foot, kind }); return ot(foot, s, kind); }; }
    f.kdLog = [];
    const kd = f.knockDown.bind(f);
    f.knockDown = (heavy) => { if (f.state === 'stand') f.kdLog.push({ t: G.t, heavy }); return kd(heavy); };
  }
  G.run = (secs, fn) => { for (let i = 0; i < Math.round(secs / DT); i++) { fn?.(i); G.step(); } };
  return G;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
/** one sample of the striker P (and view of foe E) */
function sample(G, P, E) {
  const cm = P.commit;
  const yawInv = P.yaw.clone().invert();
  const mid = P.bladePoint(0.5, new THREE.Vector3());
  const tip = P.bladePoint(1, new THREE.Vector3());
  let online = null;
  if (E) {
    const ch = V(E.bodies.chest.translation());
    const bx = tip.x - mid.x, by = tip.y - mid.y, bz = tip.z - mid.z;
    const qx = ch.x - mid.x, qy = ch.y - mid.y, qz = ch.z - mid.z;
    online = (bx * qx + by * qy + bz * qz) / (Math.hypot(bx, by, bz) * Math.hypot(qx, qy, qz) + 1e-6);
  }
  const hand = handPos(P);
  const chest = V(P.bodies.chest.translation());
  const fwd = P.forward(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.bodies.chest.rotation())).applyQuaternion(yawInv);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const f1 = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(P.bodies.chest.rotation()));
  const chYaw = Math.atan2(-f1.z, f1.x);
  const p1 = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(P.bodies.pelvis.rotation()));
  const pelYaw = Math.atan2(-p1.z, p1.x);
  return {
    t: G.t,
    on: cm.on, stg: cm.stage, u: cm.u, hb: cm.hb, ended: cm.ended, fading: cm.fading, res: cm.result, rest: P.skill.rest.w,
    tip: P.tipVel.length(), tipW: tip, online,
    aim: [P.skill.aim.x, P.skill.aim.y], off: [P.handOffset.x, P.handOffset.y],
    hand, handB: hand.clone().sub(chest).applyQuaternion(yawInv),
    com: P.com ? P.com.clone() : V(P.bodies.pelvis.translation()), comV: P.comVel.clone(), fwd,
    s: P.support, offB: P.offBalance, stum: P.stumble.length(), lean: Math.atan2(up.x, up.y) * 180 / Math.PI,
    chTw: -wrap(chYaw - P.heading) * 180 / Math.PI, pelTw: -wrap(pelYaw - P.heading) * 180 / Math.PI,
    state: P.state, feet: [V(P.bodies.footF.translation()), V(P.bodies.footB.translation())],
    lunge: P.skill.lunge, mvY: P.move.y, recov: P.skill.recovering,
  };
}

/** the classic "big cut" finger: move to chamber slowly (dwell), then cut at v to the end pose */
function bigCut(G, fam, { v = 12, dwell = 0.4, after = 'lift', backV = 4, hold = 1.5, chamberV = 1.2 } = {}) {
  const P = G.player;
  const F = FAM[fam];
  const off = [P.handOffset.x, P.handOffset.y];
  const ch = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], chamberV, { hold: dwell * 1000, lift: false }), HZ);
  const dx = F.end[0] - F.ch[0], dy = F.end[1] - F.ch[1];
  let cut;
  if (after === 'lift') cut = feedTrace(G, stroke(dx, dy, v, { down: false, lift: true }), HZ);
  else if (after === 'hold') cut = feedTrace(G, poly([[dx, dy, v, hold * 1000]], { down: false, lift: true }), HZ);
  else if (after === 'back') {
    // straight back to Pflug from the end pose immediately (active recovery to guard)
    const bx = PAD.Pflug[0] - F.end[0], by = PAD.Pflug[1] - F.end[1];
    cut = feedTrace(G, poly([[dx, dy, v, 0], [bx, by, backV, 800]], { down: false, lift: true }), HZ);
  }
  return { ch, cut };
}

/** metrics of one trial from samples S starting at the cut start index i0 */
function metrics(S, i0, t0, P, E, guardHandB) {
  const W = S.slice(i0);
  const at = (pred) => { const s = W.find(pred); return s ? r0((s.t - t0) * 1000) : null; };
  const firstB = P.commitLog.find((c) => c.stg === 'B' && c.t >= t0 - 0.05);
  const tB = firstB ? r0((firstB.t - t0) * 1000) : null;
  const tHb = at((s) => s.hb);
  const tEnded = at((s) => s.ended);
  const iOnEnd = W.findIndex((s, i) => i > 0 && W[i - 1].on && !s.on);
  const tOff = iOnEnd >= 0 ? r0((W[iOnEnd].t - t0) * 1000) : null;
  let iPk = 0;
  for (let i = 0; i < W.length && W[i].t - t0 <= 0.6; i++) if (W[i].tip > W[iPk].tip) iPk = i;
  const tipPk = W[iPk].tip;
  // blade leaves the line of the foe (cos < 0.88) and comes back "on line and slow" -- AI's 'online' test
  let tOffline = null, tOnline = null;
  for (let i = 0; i < W.length; i++) {
    const s = W[i];
    if (tOffline == null && s.online != null && s.online < 0.88) tOffline = s.t;
    if (tOffline != null && i > iPk && s.online != null && s.online > 0.88 && s.tip < 3) { tOnline = s.t; break; }
  }
  // hand back to within 0.12 m of the guard hand (body frame) with tip < 2 m/s, after the peak
  let tGuard = null;
  for (let i = iPk; i < W.length; i++) if (W[i].handB.distanceTo(guardHandB) < 0.12 && W[i].tip < 2) { tGuard = W[i].t; break; }
  // blade "stopped" after the swing: tip < 20% of peak after the peak
  let tStop = null;
  for (let i = iPk; i < W.length; i++) if (W[i].tip < 0.2 * tipPk) { tStop = W[i].t; break; }
  // body: COM travel along facing, peak speed, time to settle
  const s0 = W[0];
  const f = s0.fwd;
  const along = (s) => (s.com.x - s0.com.x) * f.x + (s.com.z - s0.com.z) * f.z;
  const sideOf = (s) => (s.com.x - s0.com.x) * -f.z + (s.com.z - s0.com.z) * f.x;
  let comMax = -1e9, comEnd = along(W[W.length - 1]), vPk = 0, iV = 0;
  for (let i = 0; i < W.length; i++) { const a = along(W[i]); if (a > comMax) comMax = a; const sp = Math.hypot(W[i].comV.x, W[i].comV.z); if (sp > vPk) (vPk = sp), (iV = i); }
  let tSettle = null;
  for (let i = iV; i < W.length; i++) if (Math.hypot(W[i].comV.x, W[i].comV.z) < 0.1) { tSettle = W[i].t; break; }
  let sMin = 1, iS = 0;
  for (let i = 0; i < W.length; i++) if (W[i].s < sMin) (sMin = W[i].s), (iS = i);
  let tS9 = null;
  for (let i = iS; i < W.length; i++) if (W[i].s >= 0.9) { tS9 = W[i].t; break; }
  const leanPk = Math.max(...W.map((s) => s.lean - s0.lean));
  const chPk = Math.max(...W.map((s) => Math.abs(s.chTw - s0.chTw)));
  let tLeanBack = null;
  const iL = W.findIndex((s) => s.lean - s0.lean === leanPk);
  for (let i = iL; i < W.length; i++) if (W[i].lean - s0.lean < 5) { tLeanBack = W[i].t; break; }
  const feet0 = s0.feet;
  const footMove = Math.max(...[0, 1].map((k) => Math.max(...W.map((s) => Math.hypot(s.feet[k].x - feet0[k].x, s.feet[k].z - feet0[k].z)))));
  const catches = P.tdLog.filter((d) => d.t >= t0 && d.kind === 'catch').length;
  const tds = P.tdLog.filter((d) => d.t >= t0).map((d) => d.kind);
  const stumbleMax = Math.max(...W.map((s) => s.stum));
  const offBMax = Math.max(...W.map((s) => s.offB));
  const rs = P.resLog.filter((r) => r.t >= t0);
  const ms = (t) => (t == null ? null : r0((t - t0) * 1000));
  return {
    s0: r3(s0.s), tB, tHb, tEnded, tOff, lock_ms: tB != null && tHb != null ? tHb - tB : null, res: rs[0]?.k ?? null,
    tipPk: r1(tipPk), tPk: ms(W[iPk].t), tStop: ms(tStop), tOffline: ms(tOffline), tOnline: ms(tOnline), tGuard: ms(tGuard),
    comMax: r3(comMax), comEnd: r3(comEnd), comSide: r3(sideOf(W[W.length - 1])), comVpk: r2(vPk), tSettle: ms(tSettle),
    sMin: r3(sMin), tS9: ms(tS9), leanPk: r1(leanPk), tLeanBack: ms(tLeanBack), chTwPk: r1(chPk), footMove: r3(footMove), catches, tds: tds.join(','),
    stumbleMax: r3(stumbleMax), offBMax: r3(offBMax), kd: P.kdLog.filter((k) => k.t >= t0).length,
  };
}

function runTrial({ fam, v = 12, commit, dist, air, seed = 7, after = 'lift', secs = 2.0, foeSword = false, blockPad = null, dwell = 0.4, weapon, skill }) {
  CONFIG.WHOLE.commit = commit;
  const G = stage({ dist, air, seed, immortal: true, immortalP: true, foeSword, weapon, skill });
  const P = G.player, E = G.enemy;
  if (blockPad) E.handOffset.set(blockPad[0], blockPad[1]);
  G.run(1.6);
  // guard hand (body frame) at Pflug, measured now
  const s00 = sample(G, P, E);
  const guardHandB = s00.handB.clone();
  const S = [];
  const { ch, cut } = bigCut(G, fam, { v, after, dwell });
  while (cut.t0 == null) { G.step(); S.push(sample(G, P, E)); }
  const i0 = S.length - 1;
  const t0 = cut.t0;
  for (let i = 0; i < secs / DT; i++) { G.step(); S.push(sample(G, P, E)); }
  const m = metrics(S, i0, t0, P, E, guardHandB);
  m.hits = G.woundsR.filter((w) => w.att === P && w.t >= t0 && w.t <= t0 + 0.8).map((w) => `${w.zone}:${r0(w.E)}`).join(' ');
  m.clash = G.clashT.filter((c) => c.t >= t0 && c.t <= t0 + 0.8).length;
  return { m, S, i0, t0, G };
}

const out = { sub: SUB, hz: HZ, mode: CONFIG.BODY.weightMode };
const save = (name) => { fs.writeFileSync(`${OUTDIR}/${name}.json`, JSON.stringify(out, null, 1)); console.log('saved', `${OUTDIR}/${name}.json`); };

// ─────────────────────────────────────────────────────────────
if (SUB === 'timeline') {
  const fams = (process.env.FAMS || 'diagR,vert,horizR,diagL').split(',');
  const vs = (process.env.VS || '8,12').split(',').map(Number);
  const scenes = (process.env.SCENES || 'air1.7,hit1.55,far2.8').split(',');
  const afters = (process.env.AFTERS || 'lift,back,hold').split(',');
  const rows = [];
  for (const sc of scenes) for (const after of afters) for (const fam of fams) for (const v of vs) for (const commit of [false, true]) {
    const dist = +sc.replace(/[a-z]+/, '');
    const air = sc.startsWith('air');
    const { m } = runTrial({ fam, v, commit, dist, air, after, secs: after === 'hold' ? 2.4 : 2.0, seed: 7 });
    rows.push({ sc, after, fam, v, commit, ...m });
  }
  out.rows = rows;
  // summary: commit vs arm per scene/after, medians over fams x v
  const keys = ['tB', 'lock_ms', 'tHb', 'tEnded', 'tOff', 'tipPk', 'tPk', 'tStop', 'tOnline', 'tGuard', 'comMax', 'comEnd', 'comVpk', 'tSettle', 'sMin', 'tS9', 'leanPk', 'tLeanBack', 'chTwPk', 'footMove', 'catches', 'stumbleMax', 'offBMax', 'kd'];
  out.sum = {};
  for (const sc of scenes) for (const after of afters) for (const commit of [false, true]) {
    const rs = rows.filter((r) => r.sc === sc && r.after === after && r.commit === commit);
    const o = { n: rs.length, confirmed: rs.filter((r) => r.tB != null).length, res: rs.map((r) => r.res ?? '-').join(',') };
    for (const k of keys) o[k] = r2(med(rs.map((r) => r[k])));
    o.tOnline_null = rs.filter((r) => r.tOnline == null).length;
    o.tGuard_null = rs.filter((r) => r.tGuard == null).length;
    out.sum[`${sc}/${after}/${commit ? 'commit' : 'arm'}`] = o;
    line(`${sc}/${after}/${commit ? 'COMMIT' : 'arm'}`, o);
  }
  save('timeline_' + HZ);
}

// ─────────────────────────────────────────────────────────────
if (SUB === 'rect') {
  // COMMIT.recover (hit 0.3 / miss 0.5 / blocked 0.4 s) -- does it change the motion at all?
  const hash = (S) => { let h = 0; for (const s of S) { const x = Math.round(s.tipW.x * 1e5) + 3 * Math.round(s.tipW.y * 1e5) + 7 * Math.round(s.tipW.z * 1e5) + 11 * Math.round(s.com.x * 1e5); h = (h * 31 + x) | 0; } return h; };
  const variants = { default: { hit: 0.3, miss: 0.5, blocked: 0.4 }, tiny: { hit: 0.01, miss: 0.01, blocked: 0.01 }, huge: { hit: 3, miss: 3, blocked: 3 } };
  const rows = [];
  for (const [sc, dist, air] of [['air1.7', 1.7, true], ['hit1.55', 1.55, false], ['far2.8', 2.8, false]]) for (const fam of ['diagR', 'vert', 'horizR']) for (const after of ['lift', 'hold', 'back']) {
    const hs = {};
    const tOffs = {};
    for (const [k, rec] of Object.entries(variants)) {
      CONFIG.COMMIT.recover = rec;
      const { S, m } = runTrial({ fam, v: 12, commit: true, dist, air, after, secs: 3.5 });
      hs[k] = hash(S);
      tOffs[k] = m.tOff;
    }
    CONFIG.COMMIT.recover = variants.default;
    rows.push({ sc, fam, after, same: hs.default === hs.tiny && hs.default === hs.huge, tOff: tOffs });
    line(`${sc}/${fam}/${after}`, rows[rows.length - 1]);
  }
  out.rows = rows;
  save('rect');
}

if (SUB === "rect2") {
  const variants = { default: { hit: 0.3, miss: 0.5, blocked: 0.4 }, tiny: { hit: 0.01, miss: 0.01, blocked: 0.01 }, huge: { hit: 3, miss: 3, blocked: 3 } };
  for (const [sc, dist, air] of [["air1.7", 1.7, true], ["hit1.55", 1.55, false]]) for (const fam of ["diagR", "vert", "horizR"]) for (const after of ["lift", "hold"]) {
    const S = {};
    const M = {};
    for (const [k, rec] of Object.entries(variants)) { CONFIG.COMMIT.recover = rec; const r = runTrial({ fam, v: 12, commit: true, dist, air, after, secs: 3.0 }); S[k] = r.S; M[k] = r.m; }
    CONFIG.COMMIT.recover = variants.default;
    const dev = (a, b) => { let tip = 0, com = 0, t = null; for (let i = 0; i < Math.min(a.length, b.length); i++) { const d = a[i].tipW.distanceTo(b[i].tipW); if (d > tip) tip = d; if (t == null && d > 0.01) t = a[i].t; const c = a[i].com.distanceTo(b[i].com); if (c > com) com = c; } return { tipMax_cm: r1(tip * 100), comMax_cm: r1(com * 100), first1cm_s: t == null ? null : r2(t) }; };
    line(sc + "/" + fam + "/" + after, { tiny: dev(S.default, S.tiny), huge: dev(S.default, S.huge), guard: [M.tiny.tGuard, M.default.tGuard, M.huge.tGuard], online: [M.tiny.tOnline, M.default.tOnline, M.huge.tOnline] });
  }
}

// ─────────────────────────────────────────────────────────────
if (SUB === 'abort') {
  // Feint / abort: cut diagR (ShR -> WechselL) at 12 m/s; at tr ms after the cut starts the finger (a) reverses back toward the
  //  chamber at 8 m/s ('rev'), or (b) turns 90 deg toward a high-left hanging block (HangL) at 8 m/s ('turn'). Air (no contact).
  //  Measure: did the commit fade (abort)? time from the change until the hand target / blade tip reaches the new goal (within 0.1 m pad)
  //  and until the tip velocity along the original cut direction is reversed.
  const rows = [];
  const fam = process.env.FAM || 'diagR';
  const F = FAM[fam];
  for (const kind of (process.env.KINDS || 'rev,turn,perp').split(',')) for (const tr of [50, 80, 110, 140, 170, 200, 240]) for (const commit of [false, true]) {
    CONFIG.WHOLE.commit = commit;
    const G = stage({ dist: 1.7, air: true, immortal: true, immortalP: true });
    const P = G.player, E = G.enemy;
    G.run(1.6);
    const off = [P.handOffset.x, P.handOffset.y];
    feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 1.2, { hold: 400, lift: false }), HZ);
    const dx = F.end[0] - F.ch[0], dy = F.end[1] - F.ch[1];
    const L = Math.hypot(dx, dy);
    const v = 12;
    const dCut = Math.min(L, (v * tr) / 1000);
    const px = F.ch[0] + (dx / L) * dCut, py = F.ch[1] + (dy / L) * dCut;
    const goal = kind === 'rev' ? F.ch : kind === 'perp' ? [px - (dy / L) * 0.35, py + (dx / L) * 0.35] : PAD.HangL;
    const legs = [[(dx / L) * dCut, (dy / L) * dCut, v, 0], [goal[0] - px, goal[1] - py, 8, 600]];
    const cut = feedTrace(G, poly(legs, { down: false, lift: true }), HZ);
    const S = [];
    while (cut.t0 == null) { G.step(); S.push(sample(G, P, E)); }
    const t0 = cut.t0;
    for (let i = 0; i < 1.5 / DT; i++) { G.step(); S.push(sample(G, P, E)); }
    const tc = t0 + tr / 1000; // the moment the finger changes (physics clock ~ wall clock here)
    const W = S.filter((s) => s.t >= tc);
    const faded = S.some((s) => s.fading);
    const B = P.commitLog.find((c) => c.stg === 'B');
    const tB = B ? r0((B.t - t0) * 1000) : null;
    const aimAt = W.find((s) => Math.hypot(s.aim[0] - goal[0], s.aim[1] - goal[1]) < 0.1);
    // tip world position at the change; reference: tip path at goal pose -> use hand pad aim for "arrival", and tip velocity reversal
    const d0 = new THREE.Vector3(dx, dy, 0).normalize();
    // "blade stops going the old way": tip speed < 3 m/s after change, first time
    const stopAt = W.find((s, i) => i > 2 && s.tip < 3);
    const hbAt = S.find((s) => s.hb);
    const hitWouldBe = null;
    // Extra: the maximum distance the tip kept travelling along the original direction after the change (world, projected onto the
    // tip displacement direction measured over the 50 ms before the change)
    const pre = S.filter((s) => s.t <= tc && s.t > tc - 0.05);
    let carry = null;
    if (pre.length > 1) {
      const a = pre[0].tipW, b = pre[pre.length - 1].tipW;
      const dir = b.clone().sub(a);
      if (dir.length() > 1e-4) {
        dir.normalize();
        carry = Math.max(...W.map((s) => s.tipW.clone().sub(b).dot(dir)));
      }
    }
    rows.push({ kind, tr, commit, tB, faded, hbAt: hbAt ? r0((hbAt.t - t0) * 1000) : null, aimArrive_ms: aimAt ? r0((aimAt.t - tc) * 1000) : null, tipSlow_ms: stopAt ? r0((stopAt.t - tc) * 1000) : null, carry_m: r3(carry) });
    line(`${kind} tr=${tr} ${commit ? 'COMMIT' : 'arm'}`, rows[rows.length - 1]);
  }
  out.rows = rows;
  save('abort_' + fam + '_' + HZ);
}

// ─────────────────────────────────────────────────────────────
if (SUB === 'block') {
  // Static block: foe (no AI) holds a high-left hanging guard; I cut diagR at 12 m/s from 1.55 m. Commit on vs off.
  //  Measure: clash, tip speed loss, rebound (tip velocity reversal), striker COM pushed back, hand pushed, lean change, time to online/guard
  const N = NARG ?? 12;
  const rows = [];
  const CFGS = [[1.75, -0.5, 0.3], [1.75, 0, -0.05], [1.75, 0, 0.15], [1.55, -0.5, -0.25]];
  for (let k = 0; k < CFGS.length * 3; k++) for (const commit of [false, true]) {
    const [bd, bx, by] = CFGS[k % CFGS.length];
    const bp = [bx, by];
    const { m, S, i0, t0, G } = runTrial({ fam: 'diagR', v: +(process.env.V || 12), commit, dist: bd + 0.02 * (Math.floor(k / CFGS.length) - 1), foeSword: true, blockPad: bp, seed: 200 + k, after: process.env.AFTER || 'lift', secs: 2.0 });
    const cl = G.clashT.filter((c) => c.t >= t0 && c.t < t0 + 0.6 && c.fresh);
    let loss = null, rebound = null, handBack = null, comBack = null;
    if (cl.length) {
      const tc = cl[0].t;
      const pre = S.filter((s) => s.t <= tc && s.t > tc - 0.05);
      const post = S.filter((s) => s.t > tc && s.t <= tc + 0.08);
      if (pre.length && post.length) {
        loss = 1 - Math.min(...post.map((s) => s.tip)) / Math.max(...pre.map((s) => s.tip));
        const a = pre[0].tipW, b = pre[pre.length - 1].tipW;
        const dir = b.clone().sub(a).normalize();
        rebound = -Math.min(0, Math.min(...S.filter((s) => s.t > tc && s.t <= tc + 0.3).map((s) => s.tipW.clone().sub(b).dot(dir)))); // how far the tip went BACK
        const sc = S.find((s) => s.t >= tc);
        const f = sc.fwd;
        comBack = -Math.min(0, Math.min(...S.filter((s) => s.t > tc && s.t <= tc + 0.6).map((s) => (s.com.x - sc.com.x) * f.x + (s.com.z - sc.com.z) * f.z)));
        handBack = Math.max(...S.filter((s) => s.t > tc && s.t <= tc + 0.3).map((s) => s.handB.distanceTo(sc.handB)));
      }
    }
    const maxE = Math.max(0, ...G.woundsR.filter((w) => w.att === G.player && w.t >= t0 && w.t <= t0 + 0.8).map((w) => w.E));
    rows.push({ k, commit, maxE: r0(maxE), clash: cl.length > 0, vn: cl.length ? r1(cl[0].vn) : null, J: cl.length ? r2(cl[0].J) : null, loss: r2(loss), rebound_m: r3(rebound), comBack_m: r3(comBack), handMove_m: r3(handBack), ...m });
  }
  out.rows = rows;
  for (const commit of [false, true]) {
    const rs = rows.filter((r) => r.commit === commit && r.clash && r.J > 0.3);
    line(commit ? 'COMMIT blocked' : 'arm blocked', { n: rows.filter((r) => r.commit === commit).length, clash: rs.length, res: rs.map((r) => r.res ?? '-').join(','), hitThrough30: rs.filter((r) => r.maxE >= 30).length, maxE: r0(med(rs.map((r) => r.maxE))), vn: r1(med(rs.map((r) => r.vn))), J: r2(med(rs.map((r) => r.J))), loss: r2(med(rs.map((r) => r.loss))), rebound_m: r3(med(rs.map((r) => r.rebound_m))), comBack_m: r3(med(rs.map((r) => r.comBack_m))), handMove_m: r3(med(rs.map((r) => r.handMove_m))), comMax: r3(med(rs.map((r) => r.comMax))), sMin: r3(med(rs.map((r) => r.sMin))), catches: rs.reduce((s, r) => s + r.catches, 0), kd: rs.reduce((s, r) => s + r.kd, 0), tOnline: r0(med(rs.map((r) => r.tOnline))), tGuard: r0(med(rs.map((r) => r.tGuard))), tOff: r0(med(rs.map((r) => r.tOff))), leanPk: r1(med(rs.map((r) => r.leanPk))) });
  }
  save('block_' + HZ);
}

// ─────────────────────────────────────────────────────────────
if (SUB === "blockscan") {
  const fam = process.env.FAM || "diagR";
  for (const dist of [1.55, 1.75]) for (const bx of [-0.5, -0.35, -0.2, 0.0]) for (const by of [-0.25, -0.05, 0.15, 0.3]) {
    const o = {};
    for (const commit of [false, true]) {
      const { m, G, t0 } = runTrial({ fam, v: 12, commit, dist, foeSword: true, blockPad: [bx, by], seed: 300, after: "lift", secs: 1.0 });
      const cl = G.clashT.filter((c) => c.t >= t0 && c.t < t0 + 0.6 && c.fresh);
      o[commit ? "C" : "a"] = { vn: cl.length ? r1(cl[0].vn) : null, J: cl.length ? r2(cl[0].J) : null, hits: m.hits, res: m.res };
    }
    line(`d=${dist} pad=${bx},${by}`, o);
  }
}

// ─────────────────────────────────────────────────────────────
if (SUB === 'combo') {
  // Two cuts: diagR (ShR -> WechselL) at 12 m/s, then after a pause p ms at the end, diagL-up... we use a reverse "rising" cut from WechselL
  //  back up to ShR? That is a riseL-like path. Use horizontal pair instead: horizR (Side -> SideL) then horizL (SideL -> Side).
  //  Measure: second cut confirmed?, time between tip peaks, 2nd tip peak, time from 1st start to 2nd peak.
  const rows = [];
  for (const [f1, f2] of [['horizR', 'horizL'], ['diagR', 'diagL']]) for (const p of [0, 60, 120, 200, 300]) for (const commit of [false, true]) {
    CONFIG.WHOLE.commit = commit;
    const G = stage({ dist: 1.7, air: true, immortal: true, immortalP: true });
    const P = G.player, E = G.enemy;
    G.run(1.6);
    const A = FAM[f1];
    const off = [P.handOffset.x, P.handOffset.y];
    feedTrace(G, stroke(A.ch[0] - off[0], A.ch[1] - off[1], 1.2, { hold: 400, lift: false }), HZ);
    // second cut starts from where the first ended: for diag, go from WechselL to ShL (lift) quickly then cut diagL
    const legs = [[A.end[0] - A.ch[0], A.end[1] - A.ch[1], 12, p]];
    if (f2 === 'horizL') legs.push([FAM.horizL.end[0] - A.end[0], FAM.horizL.end[1] - A.end[1], 12, 0]);
    else legs.push([PAD.ShL[0] - A.end[0], PAD.ShL[1] - A.end[1], 4, 80], [FAM.diagL.end[0] - PAD.ShL[0], FAM.diagL.end[1] - PAD.ShL[1], 12, 0]);
    const cut = feedTrace(G, poly(legs, { down: false, lift: true }), HZ);
    const S = [];
    while (cut.t0 == null) { G.step(); S.push(sample(G, P, E)); }
    const t0 = cut.t0;
    for (let i = 0; i < 2.0 / DT; i++) { G.step(); S.push(sample(G, P, E)); }
    const Bs = P.commitLog.filter((c) => c.stg === 'B' && c.t >= t0 - 0.05);
    // tip peaks: first in [0, 0.5], second after the second leg starts
    const seg2 = cut.segs ? null : null;
    const t2 = t0 + (legs[0][2] ? Math.hypot(legs[0][0], legs[0][1]) / legs[0][2] : 0) + p / 1000 + (f2 === 'diagL' ? Math.hypot(legs[1][0], legs[1][1]) / 4 + 0.08 : 0);
    const W1 = S.filter((s) => s.t >= t0 && s.t < t2);
    const W2 = S.filter((s) => s.t >= t2 && s.t < t2 + 0.6);
    const pk = (W) => W.reduce((a, b) => (b.tip > a.tip ? b : a), W[0]);
    const p1 = pk(W1), p2 = pk(W2);
    rows.push({ pair: `${f1}>${f2}`, p, commit, confirms: Bs.map((b) => r0((b.t - t0) * 1000)).join(','), pk1: r1(p1.tip), t1: r0((p1.t - t0) * 1000), pk2: r1(p2.tip), t2: r0((p2.t - t0) * 1000), gap: r0((p2.t - p1.t) * 1000) });
    line(`${f1}>${f2} p=${p} ${commit ? 'COMMIT' : 'arm'}`, rows[rows.length - 1]);
  }
  out.rows = rows;
  save('combo_' + HZ);
}

// ─────────────────────────────────────────────────────────────
if (SUB === 'aiwin') {
  // A live AI (difficulty D) faces the player. The player walks into ~2.0 m and throws a big cut (chamber 0.1 s, 12 m/s) that
  //  may or may not land; then either lifts (auto guard) or drags back to Pflug. Repeated every ~2.5 s for 30 s.
  //  Commit on vs off (same finger!). Per strike: did the AI start an attack within 1.0 s after my cut ended, with which 'why';
  //  was I wounded within 1.0 s after my cut ended; AI 'opportunity' kinds seen.
  const N = NARG ?? 16;
  const diff = process.env.DIFF || 'normal';
  const after = process.env.AFTER || 'lift';
  const res = {};
  for (const commit of [false, true]) {
    const rows = [];
    let kds = 0, stand = 0;
    for (let seed = 1; seed <= N; seed++) {
      CONFIG.WHOLE.commit = commit;
      const G = stage({ walls: true, gap: CONFIG.ARENA.startGap, seed: 900 + seed, foeAI: true, difficulty: diff, immortal: true, immortalP: true });
      const P = G.player, E = G.enemy, ai = G.ai;
      const aiLog = [];
      const sa = ai.startAttack.bind(ai);
      ai.startAttack = (tech, why, o) => { const r = sa(tech, why, o); if (r !== false) aiLog.push({ t: G.t, why, tech: tech?.name }); return r; };
      const opLog = [];
      const op = ai.opportunity.bind(ai);
      ai.opportunity = (s, d) => { const r = op(s, d); opLog.push({ t: G.t, kind: r.kind, score: r.score }); return r; };
      let rnd = seed * 7919;
      const R = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
      let next = 1.5 + R();
      let cur = null;
      const att = [];
      const fams = ['diagR', 'vert', 'horizR', 'diagL'];
      for (let i = 0; i < 30 / DT; i++) {
        const d = P.foeDistance();
        if (P.state === 'stand') stand += DT;
        if (!cur) G.pump.stick = { x: 0, y: d > 2.1 ? 0.8 : d < 1.5 ? -0.6 : 0 };
        if (!cur && G.t > next && d < 2.2 && P.state === 'stand' && !G.pump.queue.length) {
          const fam = fams[Math.floor(R() * fams.length)];
          const F = FAM[fam];
          G.pump.stick = { x: 0, y: 0 };
          const off = [P.handOffset.x, P.handOffset.y];
          feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 2.5, { hold: 100, lift: false }), HZ);
          const dx = F.end[0] - F.ch[0], dy = F.end[1] - F.ch[1];
          let tr;
          if (after === 'back') tr = feedTrace(G, poly([[dx, dy, 12, 0], [PAD.Pflug[0] - F.end[0], PAD.Pflug[1] - F.end[1], 4, 200]], { down: false, lift: true }), HZ);
          else tr = feedTrace(G, stroke(dx, dy, 12, { down: false }), HZ);
          cur = { fam, tr, T1: (Math.hypot(dx, dy) / 12) };
        }
        G.step();
        if (cur && cur.tr.t0 != null && cur.tEnd == null) cur.tEnd = cur.tr.t0 + cur.T1; // cut stroke end (finger reached end pose)
        if (cur && cur.tr.done) {
          cur.t0 = cur.tr.t0;
          att.push(cur);
          cur = null;
          next = G.t + 1.8 + R() * 1.2;
        }
      }
      for (const a of att) {
        const te = a.tEnd;
        const aiA = aiLog.find((x) => x.t >= te && x.t <= te + 1.0);
        const aiDuring = aiLog.find((x) => x.t >= a.t0 && x.t < te);
        const got = G.woundsR.find((w) => w.vic === P && w.t >= te && w.t <= te + 1.0);
        const mine = G.woundsR.filter((w) => w.att === P && w.t >= a.t0 && w.t <= a.t0 + 0.8);
        const recOp = aiLog.find((x) => x.t >= te && x.t <= te + 1.0 && x.why === 'recover');
        rows.push({ aiDuring: aiDuring ? aiDuring.why : null, fam: a.fam, aiAtk: aiA ? aiA.why : null, aiAtk_ms: aiA ? r0((aiA.t - te) * 1000) : null, got: !!got, got_ms: got ? r0((got.t - te) * 1000) : null, gotE: got ? r0(got.E) : 0, myE: r0(mine.reduce((s, w) => s + w.E, 0)), myHit: mine.length > 0, recoverSeen: !!recOp, recoverSeen_ms: recOp ? r0((recOp.t - te) * 1000) : null });
      }
      kds += P.kdLog.length;
    }
    const whys = {};
    for (const r of rows) if (r.aiAtk) whys[r.aiAtk] = (whys[r.aiAtk] || 0) + 1;
    res[commit ? 'commit' : 'arm'] = {
      strikes: rows.length, myHit_pct: pct(rows.filter((r) => r.myHit).length, rows.length), myE_mean: r1(mean(rows.map((r) => r.myE))),
      aiAttack1s_pct: pct(rows.filter((r) => r.aiAtk).length, rows.length), aiAtk_ms_med: r0(med(rows.map((r) => r.aiAtk_ms))), aiWhy: whys,
      recoverSeen_pct: pct(rows.filter((r) => r.recoverSeen).length, rows.length), recoverSeen_ms_med: r0(med(rows.map((r) => r.recoverSeen_ms))),
      gotHit1s_pct: pct(rows.filter((r) => r.got).length, rows.length), got_ms_med: r0(med(rows.map((r) => r.got_ms))), gotE_mean_when_hit: r1(mean(rows.filter((r) => r.got).map((r) => r.gotE))),
      kdPerMin: r2(kds / Math.max(1e-6, stand / 60)),
    };
    res[commit ? 'commit' : 'arm'].rows = rows;
    line(`${diff}/${after} ${commit ? 'COMMIT' : 'arm'}`, { ...res[commit ? 'commit' : 'arm'], rows: undefined });
  }
  out.res = res;
  save(`aiwin_${diff}_${after}_${HZ}_N${N}`);
}
