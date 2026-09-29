// Whole-body speed probe (scratch, not product): arm cut (WHOLE.commit=false) vs committed cut (WHOLE.commit=true)
// Records per-physics-step time series of pelvis/chest yaw rate, shoulder/hand/tip speed, segmental contributions
// to tip & hand velocity, and cap saturation (wrist, shoulder, elbow, spine) from the instrumented fighter.js copy.
// Run: node tools/sim/hybrid.mjs tseq.mjs   env: WEAPONS=longsword,zweihander,sabre FAMS=diagR,vert,horizR HZS=60,120 VS=12 DIST=2.0 DWELL=1.0 AIR=1
import fs from 'node:fs';
import { newRound, THREE, DT, CONFIG, V, Q, handPos, feedTrace, inputPump } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
// ── counterfactual knobs (probe only) ──
// CFGSET="SKILL.aimFilterStrike=48;SKILL_BODY.pelvis=68"  WMUL="maxAimTorque:1.5,wristVmax:1.5"  JMUL="uarmS.max:1.5,farmS.max:1.5"
// TRUNKOFF=1 (pin pelvis/chest yaw targets to 0)  CHESTFRAME=ff|fb (hand target + aim in chest yaw frame)  FRAMEK=1
for (const kv of (process.env.CFGSET || '').split(';').filter(Boolean)) {
  const [k, v] = kv.split('=');
  const path = k.split('.');
  let o = CONFIG;
  for (const p of path.slice(0, -1)) o = o[p];
  o[path[path.length - 1]] = v === 'true' ? true : v === 'false' ? false : v.startsWith('[') || v.startsWith('{') ? JSON.parse(v) : +v;
}
const WMUL = (process.env.WMUL || '').split(',').filter(Boolean).map((x) => x.split(':')).map(([k, f]) => [k, +f]);
const JMUL = (process.env.JMUL || '').split(',').filter(Boolean).map((x) => x.split(':')).map(([k, f]) => [k.split('.'), +f]);
if (process.env.TRUNKOFF) {
  const orig = Fighter.prototype.updateBodyPose;
  Fighter.prototype.updateBodyPose = function (dt) {
    orig.call(this, dt);
    if (this.index !== 0) return;
    this.bodyPose.pelvisYaw = this.bodyPose.chestYaw = 0;
    this.bodyPoseVel.pelvisYaw = this.bodyPoseVel.chestYaw = 0;
    this.pelvisYawOffset = 0;
  };
}

const R2D = 180 / Math.PI;
const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], OchsL: [-0.22, 0.26], ShL: [-0.4, 0.42] };
const FAM = { diagR: { ch: PAD.ShR, end: PAD.WechselL }, vert: { ch: PAD.Tag, end: PAD.Alber }, horizR: { ch: PAD.Side, end: PAD.SideL }, riseR: { ch: PAD.Wechsel, end: PAD.OchsL }, diagL: { ch: PAD.ShL, end: PAD.Wechsel } };
const WEAPONS = (process.env.WEAPONS || 'longsword,zweihander,sabre').split(',');
const FAMS = (process.env.FAMS || 'diagR,vert,horizR').split(',');
const HZS = (process.env.HZS || '60,120').split(',').map(Number);
const VS = (process.env.VS || '12').split(',').map(Number);
const DIST = +(process.env.DIST || 2.0);
const DWELL = +(process.env.DWELL || 1.0);
const AIR = process.env.AIR !== '0';
const WIN = +(process.env.WIN || 0.6);
const MODES = (process.env.MODES || 'arm,commit').split(',');
const OUT = process.env.OUT || 'tseq.json';
const STR = process.env.STR != null ? +process.env.STR : null;

function stroke(dx, dy, v, { hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
}
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(xy[0], xy[1]);
  k.aimVel.set(0, 0); k.vel.set(0, 0); k.follow.set(0, 0);
}
const lv = (rb) => V(rb.linvel());
const av = (rb) => V(rb.angvel());
const com = (rb) => V(rb.worldCom());
/** velocity of world point p if it were rigidly attached to body rb */
const carry = (rb, p) => lv(rb).add(av(rb).cross(p.clone().sub(com(rb))));
function rotKE(rb) {
  const w = av(rb).applyQuaternion(Q(rb.rotation()).invert()).applyQuaternion(Q(rb.principalInertiaLocalFrame()).invert());
  const I = rb.principalInertia();
  return 0.5 * (I.x * w.x * w.x + I.y * w.y * w.y + I.z * w.z * w.z);
}

function sample(G, f, t, prev) {
  const B = f.bodies;
  const tip = f.bladePoint(1, new THREE.Vector3());
  const hand = handPos(f);
  const ch = B.chest;
  const cq = Q(ch.rotation());
  const sh = new THREE.Vector3(0, 0.1, f.side * 0.2).applyQuaternion(cq).add(V(ch.translation()));
  const vTip = carry(f.sword, tip);
  const vHand = carry(B.farmS, hand);
  const vSh = carry(ch, sh);
  // tip decomposition: pelvis carry | chest rel pelvis (spine) | upper arm rel chest (shoulder) | forearm rel upper arm (elbow) | sword rel forearm (wrist)
  const cP = carry(B.pelvis, tip), cC = carry(ch, tip), cU = carry(B.uarmS, tip), cF = carry(B.farmS, tip);
  const u = vTip.lengthSq() > 1e-9 ? vTip.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const part = { pel: cP.dot(u), spine: cC.clone().sub(cP).dot(u), shoulder: cU.clone().sub(cC).dot(u), elbow: cF.clone().sub(cU).dot(u), wrist: vTip.clone().sub(cF).dot(u) };
  // chest yaw only (world vertical component of chest angvel) carrying the tip
  const wc = av(ch);
  const yawOnlyTip = new THREE.Vector3(0, wc.y, 0).cross(tip.clone().sub(com(ch))).dot(u);
  // hand decomposition: pelvis | spine | arm (hand rel chest)
  const uh = vHand.lengthSq() > 1e-9 ? vHand.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const hP = carry(B.pelvis, hand), hC = carry(ch, hand);
  const hpart = { pel: hP.dot(uh), spine: hC.clone().sub(hP).dot(uh), arm: vHand.clone().sub(hC).dot(uh) };
  // how much the arm cancels the trunk carry at the hand: component of (hand rel chest) along trunk carry direction
  const hCn = hC.length() > 1e-6 ? hC.clone().normalize() : null;
  const armAlongTrunk = hCn ? vHand.clone().sub(hC).dot(hCn) : 0;
  const ht = f.handTarget.clone();
  const I = f.ins;
  const cm = f.commit || {};
  const sk = f.skill;
  const s = {
    t,
    pelW: av(B.pelvis).y, abdW: av(B.abdomen).y, chW: wc.y,
    shV: vSh.length(), handV: vHand.length(), tipV: vTip.length(), tipVfd: f.tipVel.length(), swW: av(f.sword).length(),
    swRelW: av(f.sword).sub(av(B.farmS)).length(),
    part, yawOnlyTip, hpart, trunkAtHand: hC.length(), armAlongTrunk,
    ht, htV: prev ? ht.distanceTo(prev.ht) / DT : 0,
    aimV: sk.aimVel.length(), aimRawV: prev ? Math.hypot(sk.aimRaw.x - prev.arx, sk.aimRaw.y - prev.ary) / DT : 0, arx: sk.aimRaw.x, ary: sk.aimRaw.y,
    bpPel: f.bodyPose.pelvisYaw, bpCh: f.bodyPose.chestYaw, bpPelV: f.bodyPoseVel.pelvisYaw, bpChV: f.bodyPoseVel.chestYaw,
    act: sk.activity, u: cm.u ?? null, stage: cm.stage ?? null, on: !!cm.on, padOn: !!cm.padOn, yawK: sk.cutPose?.yawK ?? 1, wBody: sk.cutPose?.wBody ?? 0,
    wrSat: !!I.wr.sat, wrHill: I.wr.hill ?? 1, wrPre: I.wr.pre ?? 0, wrCap: I.wr.cap ?? 0, wrCap0: I.wr.cap0 ?? 0, wAimRaw: I.wr.wAimRaw ?? 0, wrRelease: !!I.wr.release, wrBrake: !!I.wr.brake, wrAngle: I.wr.angle ?? 0, vAlong: I.wr.vAlong ?? 0,
    shSat: !!I.sh.sat, shHill: I.sh.hill ?? 1, shPre: I.sh.pre ?? 0, shCap: I.sh.cap ?? 0, shMaxT: I.sh.maxT ?? 0, shW: I.sh.wSw ?? 0, shWT: I.sh.wT ?? 0,
    elSat: !!I.el.sat, elHill: I.el.hill ?? 1, elErr: I.el.err ?? 0, elMErr: I.el.mErr ?? 0, elW: I.el.wRel ?? 0,
    chSatY: !!I.sp.chest?.satY, abSatY: !!I.sp.abdomen?.satY, chVclamp: !!I.sp.chest?.velClampY, abVclamp: !!I.sp.abdomen?.velClampY, chTgtVy: I.sp.chest?.tgtVy ?? 0, abTgtVy: I.sp.abdomen?.tgtVy ?? 0,
    heading: f.heading, hl: I.hl ? I.hl.slice() : null,
    // sword energy bookkeeping (world): KE, wrist-torque power, off-hand power, gravity power
    ...(() => {
      const sw = f.sword; const m = sw.mass(); const vc = lv(sw); const w = av(sw);
      const q = Q(sw.rotation()); const qi = q.clone().invert(); const wl = w.clone().applyQuaternion(qi);
      const pI = sw.principalInertia(); const pF = sw.principalInertiaLocalFrame(); const qf = Q(pF); const wp = wl.clone().applyQuaternion(qf.clone().invert());
      const KE = 0.5 * m * vc.lengthSq() + 0.5 * (pI.x * wp.x * wp.x + pI.y * wp.y * wp.y + pI.z * wp.z * wp.z);
      const tau = I.wr.tau ? new THREE.Vector3(...I.wr.tau) : new THREE.Vector3();
      const Pw = tau.dot(w);
      let Po = 0; if (I.off) { Po = new THREE.Vector3(...I.off.F).dot(new THREE.Vector3(...I.off.vp)); }
      const Pg = -m * 9.81 * vc.y;
      // trunk rotational KE (pelvis+abdomen+chest about their own COMs, yaw only) for comparison
      const trunkKE = ['pelvis', 'abdomen', 'chest'].reduce((a, k) => a + rotKE(B[k]), 0); const armKE = ['uarmS', 'farmS', 'uarmO', 'farmO'].reduce((a, k) => a + rotKE(B[k]) + 0.5 * B[k].mass() * lv(B[k]).lengthSq(), 0);
      return { KE, Pw, Po, Pg, trunkKE, armKE };
    })(),
  };
  return s;
}

function trial(weapon, mode, fam, hz, v) {
  CONFIG.WHOLE.commit = mode !== 'arm';
  const gap = DIST + 0.17;
  const G = newRound({ walls: false, gap, seed: 7, weapon });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (AIR) for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  if (STR != null) P.strength = STR;
  for (const [k, f] of WMUL) P.weaponCfg[k] *= f;
  for (const [[jn, key], f] of JMUL) for (const j of P.joints) if (j.name === jn) j[key] *= f;
  if (process.env.CHESTFRAME) { P.insChestFrame = process.env.CHESTFRAME; P.insFrameK = +(process.env.FRAMEK || 1); }
  P.skill.level = 0.7;
  setPad(P, PAD.Pflug);
  const pump = inputPump(G, { hz });
  const wounds = [];
  G.onWound = (att, vic, r) => att === P && wounds.push({ t: G.t, E: r.energy, zone: r.zone, v: r.speed, mEff: r.mEff });
  const commits = [];
  const oc = P.onCommit.bind(P);
  P.onCommit = (st, c, fm) => { commits.push({ t: G.t, st, c, fm }); return oc(st, c, fm); };
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  const F = FAM[fam];
  const off = [P.handOffset.x, P.handOffset.y];
  const chq = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 1.2, { hold: DWELL * 1000, lift: false }), hz);
  while (!chq.done) G.step();
  const cur = [P.handOffset.x, P.handOffset.y];
  const cut = feedTrace(G, stroke(F.end[0] - cur[0], F.end[1] - cur[1], v, { down: false, lift: true }), hz);
  const S = [];
  let prev = null;
  do { G.step(); } while (cut.t0 == null);
  const t0 = cut.t0;
  // include a few samples before
  for (let i = 0; i < Math.round((WIN + 0.3) / DT); i++) {
    const s = sample(G, P, G.t - t0, prev);
    S.push(s);
    prev = s;
    G.step();
  }
  return { S, commits: commits.map((c) => ({ ...c, t: c.t - t0 })), wounds: wounds.map((w) => ({ ...w, t: w.t - t0 })), cutT: cut.T, Ihand: P.swordIhand, mass: P.swordMass, Tc: P.commit?.Tc, c: P.commit?.c };
}

function summarize(r) {
  const S = r.S.filter((s) => s.t >= -1e-9 && s.t <= WIN);
  const pk = (k, sgn = 1) => { let b = S[0]; for (const s of S) if (sgn * s[k] > sgn * b[k]) b = s; return b; };
  // yaw sign: direction of net chest rotation during cut
  const netCh = S[S.length - 1].heading; // not used
  const chSum = S.reduce((a, s) => a + s.chW, 0);
  const sg = Math.sign(chSum) || 1;
  const pelPk = pk('pelW', sg), chPk = pk('chW', sg), abPk = pk('abdW', sg);
  const shPk = pk('shV'), handPk = pk('handV'), tipPk = pk('tipV'), swPk = pk('swW'), htPk = pk('htV'), aimPk = pk('aimV');
  const iTip = S.indexOf(tipPk);
  const upToTip = S.slice(0, iTip + 1);
  const frac = (k) => +(100 * S.filter((s) => s[k]).length / S.length).toFixed(0);
  const fracTo = (k) => +(100 * upToTip.filter((s) => s[k]).length / Math.max(1, upToTip.length)).toFixed(0);
  const ms = (s) => Math.round(s.t * 1000);
  const r1 = (x) => +x.toFixed(1);
  const r2 = (x) => +x.toFixed(2);
  const P = tipPk.part;
  return {
    tip: r1(tipPk.tipV), tipFD: r1(Math.max(...S.map((s) => s.tipVfd))), t_tip: ms(tipPk),
    pelRate: Math.round(sg * pelPk.pelW * R2D), t_pel: ms(pelPk),
    abdRate: Math.round(sg * abPk.abdW * R2D), t_abd: ms(abPk),
    chRate: Math.round(sg * chPk.chW * R2D), t_ch: ms(chPk),
    sh: r2(shPk.shV), t_sh: ms(shPk), hand: r2(handPk.handV), t_hand: ms(handPk), swW: r1(swPk.swW), t_swW: ms(swPk),
    htV: r2(htPk.htV), t_ht: ms(htPk), aimV: r2(aimPk.aimV), t_aim: ms(aimPk),
    // tip contributions at tip peak (m/s along tip velocity)
    atTip: { pel: r2(P.pel), spine: r2(P.spine), shoulder: r2(P.shoulder), elbow: r2(P.elbow), wrist: r2(P.wrist), chestYawOnly: r2(tipPk.yawOnlyTip) },
    atTipHand: r2(tipPk.handV), atTipCh: Math.round(sg * tipPk.chW * R2D), atTipPel: Math.round(sg * tipPk.pelW * R2D),
    // hand contributions at hand peak
    atHand: { pel: r2(handPk.hpart.pel), spine: r2(handPk.hpart.spine), arm: r2(handPk.hpart.arm), trunkCarry: r2(handPk.trunkAtHand), armAlongTrunk: r2(handPk.armAlongTrunk) },
    sat: { wrist: frac('wrSat'), wristToTip: fracTo('wrSat'), shoulder: frac('shSat'), shoulderToTip: fracTo('shSat'), elbow: frac('elSat'), elbowToTip: fracTo('elSat'), chestY: frac('chSatY'), abdY: frac('abSatY'), chVclamp: frac('chVclamp'), wAim25: +(100 * S.filter((s) => s.wAimRaw > 25).length / S.length).toFixed(0), release: frac('wrRelease'), brake: frac('wrBrake') },
    atTipCaps: { wrHill: r2(tipPk.wrHill), wrCap: r1(tipPk.wrCap), wrCap0: r1(tipPk.wrCap0), wrPre: r1(tipPk.wrPre), vAlong: r1(tipPk.vAlong), shHill: r2(tipPk.shHill), shCap: r1(tipPk.shCap), shPre: r1(tipPk.shPre), elHill: r2(tipPk.elHill), wAimRaw: r1(tipPk.wAimRaw), release: tipPk.wrRelease, brake: tipPk.wrBrake },
    minWrHillToTip: r2(Math.min(...upToTip.map((s) => s.wrHill))), minShHillToTip: r2(Math.min(...upToTip.map((s) => s.shHill))),
    commits: r.commits.map((c) => `${c.st}@${Math.round(c.t * 1000)}`).join(','), Tc: r.Tc != null ? r2(r.Tc) : null, c: r.c != null ? r2(r.c) : null,
    u_atTip: tipPk.u != null ? r2(tipPk.u) : null, yawK_atTip: r2(tipPk.yawK), wBody_atTip: r2(tipPk.wBody),
    wounds: r.wounds.slice(0, 2).map((w) => `${w.zone}:${Math.round(w.E)}J@${Math.round(w.t * 1000)}v${w.v.toFixed(1)}m${w.mEff.toFixed(2)}`).join(' '),
  };
}

const results = [];
for (const weapon of WEAPONS)
  for (const fam of FAMS)
    for (const hz of HZS)
      for (const v of VS)
        for (const mode of MODES) {
          const r = trial(weapon, mode, fam, hz, v);
          const sm = summarize(r);
          results.push({ weapon, fam, hz, v, mode, sm, S: process.env.SERIES ? r.S.map((s) => ({ ...s, ht: undefined })) : undefined });
          console.log(`${weapon.padEnd(10)} ${fam.padEnd(6)} ${hz} v${v} ${mode.padEnd(6)}`, JSON.stringify(sm));
        }
fs.writeFileSync(OUT, JSON.stringify({ env: { DIST, DWELL, AIR, WIN }, results }, null, 0));
console.log('saved', OUT);
