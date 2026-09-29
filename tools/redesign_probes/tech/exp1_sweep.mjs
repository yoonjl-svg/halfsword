// Experiment 1: hit detection vs tip speed.
// A blade (the attacker's real sword rigid body, grip joint removed) is swept on an exact circular arc about a pivot
// ("the hand") through a standing dummy's sword forearm (farmS) or neck (lower head ball), at a set tip speed, with the
// sub-step phase randomised. Uses the real Fighter / Combat code from the scratch copy (tech/snap, env-gated patches).
//
// usage: node exp1_sweep.mjs [weapon=longsword] [target=farm|neck] [speeds=20,24,28,32,36,40,45] [phases=16]
// env:   MODE=driven|free   CCD=base|scale|<metres>   DT=120|240   SPEED_GATE (read by patched combat.js)
//        F=0.75 (crossing point as fraction of blade length from the hilt)  CUT=edge|flat
import fs from 'node:fs';
const SNAP = '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech/snap';
const H = await import(SNAP + '/tools/sim/harness_m.mjs');
const { newRound, THREE, CONFIG } = H;
CONFIG.BODY.weightMode = process.env.BODYMODE || 'hybrid';

const WEAPON = process.argv[2] || 'longsword';
const TARGET = process.argv[3] || 'farm'; // farm | neck | blade (the dummy's own sword, held in guard)
const SPEEDS = (process.argv[4] || '20,24,28,32,36,40,45').split(',').map(Number);
const PHASES = +(process.argv[5] || 16);
const MODE = process.env.MODE || 'driven';
const CCD = process.env.CCD || 'base';
const HZP = +(process.env.DT || 120);
const DTP = 1 / HZP;
const F = +(process.env.F || 0.75);
const CUT = process.env.CUT || 'edge';
const OUT = process.env.OUT;
const GATE = +(process.env.SPEED_GATE || 30);

const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);

// segment-segment closest distance
function segSeg(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return p1.distanceTo(p2);
  if (a <= 1e-12) { s = 0; t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-12) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = p1.clone().addScaledVector(d1, s), c2 = p2.clone().addScaledVector(d2, t);
  return c1.distanceTo(c2);
}
function pointSeg(p, a, b) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}


// ── Prototype fix: swept blade test (JS-side continuous detection for the cut-through path) ──
//  pre-step pose = fighter.cache (already stored by cacheState before world.step), post-step pose = live body.
//  K sub-samples chosen so the blade point nearest the target moves at most `win` per sub-sample.
const SWEPT = !!process.env.SWEPT;
const sweptStats = { calls: 0, ns: 0n, added: 0 };
function sweptCheck(combat, A, B, partNames) {
  const t0 = process.hrtime.bigint();
  sweptStats.calls++;
  const S0 = A.cache.sword, sw = A.sword;
  const p1 = V(sw.translation()), q1 = Qr(sw.rotation());
  const HL = A.weaponCfg.hiltLength, L = A.weaponCfg.bladeLength;
  const tip0 = new THREE.Vector3(0, HL + L, 0).applyQuaternion(S0.q).add(S0.p);
  const tip1 = new THREE.Vector3(0, HL + L, 0).applyQuaternion(q1).add(p1);
  const travel = tip0.distanceTo(tip1);
  let hit = null;
  for (const name of partNames) {
    const body = B.bodies[name];
    const P0 = B.cache.parts[name];
    const col = body.collider(0);
    const sh = col.shape; // capsule: halfHeight, radius ; ball: radius
    const r = sh.radius ?? 0.1;
    const hh = sh.halfHeight ?? 0;
    const win = r + 0.01;
    const K = Math.max(1, Math.ceil(travel / win));
    const bp1 = V(body.translation()), bq1 = Qr(body.rotation());
    const cq = Qr(col.rotation()); // collider world rotation (post); capsule axis = collider local y
    const lq = bq1.clone().invert().multiply(cq); // collider rotation relative to body
    for (let k = 0; k <= K && !hit; k++) {
      const u = k / K;
      const p = S0.p.clone().lerp(p1, u), q = S0.q.clone().slerp(q1, u);
      const a = new THREE.Vector3(0, HL, 0).applyQuaternion(q).add(p), b = new THREE.Vector3(0, HL + L, 0).applyQuaternion(q).add(p);
      const bp = P0.p.clone().lerp(bp1, u), bq = P0.q.clone().slerp(bq1, u).multiply(lq);
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(bq);
      const d = hh > 0 ? segSeg(a, b, bp.clone().addScaledVector(ax, -hh), bp.clone().addScaledVector(ax, hh)) : pointSeg(bp, a, b);
      if (d < r + 0.004) {
        // contact point: point on the blade closest to the part centre at this sub-sample
        const ab = b.clone().sub(a);
        const tt = THREE.MathUtils.clamp(bp.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
        hit = { name, point: a.clone().addScaledVector(ab, tt), col };
      }
    }
    if (hit) break;
  }
  sweptStats.ns += process.hrtime.bigint() - t0;
  return hit;
}

function trial(v, phase, seed) {
  const G = newRound({ seed, weapon: WEAPON, weapon2: 'longsword', gap: 3.0 });
  const { world, eventQueue, combat, player: P, enemy: E } = G;
  world.timestep = DTP;
  // attacker: body parked far away, grip joint removed, sword free (no gravity/damping)
  world.removeImpulseJoint(P.gripJoint, true);
  for (const { rb, kind } of P.meshes) if (kind !== 'weapon') { const t = rb.translation(); rb.setTranslation({ x: t.x, y: t.y + 0, z: t.z + 40 }, true); }
  P.anchor.setTranslation({ x: P.anchor.translation().x, y: P.anchor.translation().y, z: P.anchor.translation().z + 40 }, true);
  const S = P.sword;
  S.setGravityScale(0, true);
  S.setAngularDamping(0);
  S.setLinearDamping(0);
  S.setTranslation({ x: -1.5, y: 1.2, z: -30 }, true);
  // dummy: its own sword does not collide (so it cannot shield the target)
  if (TARGET !== 'blade') for (const c of E.swordColliders) c.setCollisionGroups(0);
  // keep the dummy's other body parts out of the blade test: only its sword can be touched
  if (TARGET === 'blade') for (const [h, inf] of G.combat.info) if (inf.fighter === E && inf.kind !== 'weapon') world.getCollider(h).setCollisionGroups(0);
  E.foe = null;
  const face = { x: -10, y: 1.2, z: 0 };
  const stepE = (dt) => {
    E.faceTarget = face;
    if (E.alive !== false) E.step(dt);
    P.cacheState();
    E.cacheState();
  };
  // settle 0.5 s at the game timestep
  world.timestep = 1 / 120;
  for (let i = 0; i < 60; i++) { stepE(1 / 120); S.setLinvel({ x: 0, y: 0, z: 0 }, true); S.setAngvel({ x: 0, y: 0, z: 0 }, true); world.step(eventQueue, combat.physicsHooks); combat.afterStep(world, eventQueue); }
  world.timestep = DTP;

  const HL = P.weaponCfg.hiltLength, L = P.weaponCfg.bladeLength;
  const Rtip = HL + L;
  const Rc = HL + F * L;
  const omega = v / Rtip;
  // target geometry
  let c, n, d0, partName, radius;
  if (TARGET === 'farm') {
    const b = E.bodies.farmS;
    c = V(b.translation());
    const a = new THREE.Vector3(1, 0, 0).applyQuaternion(Qr(b.rotation())).normalize();
    // pivot beside the forearm (outside of the body), blade horizontal at the crossing, moving down
    const toBody = V(E.bodies.chest.translation()).sub(c);
    let side = new THREE.Vector3().crossVectors(a, new THREE.Vector3(0, 1, 0)).normalize();
    if (side.dot(toBody) > 0) side.negate(); // side points away from the dummy's centre line
    d0 = side.clone().negate(); // blade points from pivot (outside) toward the forearm and past it
    n = a.clone();
    if (new THREE.Vector3().crossVectors(n, d0).y > 0) n.negate(); // blade moves DOWN at the crossing
    partName = 'farmS';
    radius = 0.04;
  } else if (TARGET === 'blade') {
    const b = E.sword;
    const q = Qr(b.rotation());
    const EHL = E.weaponCfg.hiltLength, EL = E.weaponCfg.bladeLength;
    c = new THREE.Vector3(0, EHL + 0.5 * EL, 0).applyQuaternion(q).add(V(b.translation()));
    const a = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    // attacker blade crosses the defender's blade perpendicular, moving DOWN onto it, pivot beside it (like farm)
    let side = new THREE.Vector3().crossVectors(a, new THREE.Vector3(0, 1, 0)).normalize();
    d0 = side.clone().negate();
    n = a.clone();
    if (new THREE.Vector3().crossVectors(n, d0).y > 0) n.negate();
    partName = 'sword';
    radius = 0.008;
  } else {
    const b = TARGET === 'chest' ? E.bodies.chest : E.bodies.head;
    const q = Qr(b.rotation());
    c = new THREE.Vector3(0, TARGET === 'chest' ? 0 : -0.07, 0).applyQuaternion(q).add(V(b.translation()));
    // horizontal cut from the attacker's side (-x): pivot in front-right of the dummy, blade sweeps across the neck
    n = new THREE.Vector3(0, 1, 0);
    d0 = new THREE.Vector3(0.5, 0, 1).normalize(); // blade direction at the crossing (pivot is at c - Rc*d0: in front (-x) and to the side (-z))
    if (new THREE.Vector3().crossVectors(n, d0).x < 0) n.negate(); // edge moves toward +x (into the dummy) — roughly
    partName = TARGET === 'chest' ? 'chest' : 'head';
    radius = TARGET === 'chest' ? 0.11 : 0.1;
  }
  const O = c.clone().addScaledVector(d0, -Rc);
  const lc = S.localCom();
  const localCom = new THREE.Vector3(lc.x, lc.y, lc.z);
  const poseAt = (th) => {
    const d = d0.clone().applyAxisAngle(n, th);
    const mv = new THREE.Vector3().crossVectors(n, d); // motion direction of the blade line
    let x = mv.clone(), z = n.clone().negate();
    if (CUT === 'flat') { x = n.clone(); z = new THREE.Vector3().crossVectors(x, d); }
    const m = new THREE.Matrix4().makeBasis(x, d, z);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    return { q, d };
  };
  const setPose = (th, setVel) => {
    const { q } = poseAt(th);
    S.setTranslation({ x: O.x, y: O.y, z: O.z }, true);
    S.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    if (setVel) {
      const com = localCom.clone().applyQuaternion(q).add(O);
      const w = n.clone().multiplyScalar(omega);
      const vc = new THREE.Vector3().crossVectors(w, com.clone().sub(O));
      S.setLinvel({ x: vc.x, y: vc.y, z: vc.z }, true);
      S.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
    }
  };
  let ccdVal = 0.2;
  if (CCD === 'scale') ccdVal = Math.max(0.2, 1.5 * v * DTP);
  else if (CCD !== 'base') ccdVal = +CCD;
  S.setSoftCcdPrediction(ccdVal);

  const k = Math.ceil(0.5 / (omega * DTP));
  const th0 = -(k + phase) * omega * DTP;
  const log = { pred: 0, predFast: 0, filter: 0, strikes: [], nullFast: 0, nullFastSpeed: 0, wounds: [], analyzeSpeeds: [] };
  // instrument combat
  const origAnalyze = combat.analyze.bind(combat);
  combat.analyze = (pr, point, Ss, Pp, predicting) => {
    const r = origAnalyze(pr, point, Ss, Pp, predicting);
    if (pr.v.fighter === E) {
      const vB = Ss.v.clone().add(new THREE.Vector3().crossVectors(Ss.w, point.clone().sub(Ss.com)));
      const vP = Pp.v.clone().add(new THREE.Vector3().crossVectors(Pp.w, point.clone().sub(Pp.com)));
      const sp = vB.sub(vP).length();
      if (!predicting) log.analyzeSpeeds.push(+sp.toFixed(1));
      if (pr.v.part === partName) {
        if (predicting) { log.pred++; if (!r && sp > GATE) log.predFast++; }
        else if (!r && sp > GATE) { log.nullFast++; log.nullFastSpeed = Math.max(log.nullFastSpeed, sp); }
      }
    }
    return r;
  };
  const origFilter = combat.filterContactPair.bind(combat);
  combat.filterContactPair = (c1, c2) => { const r = origFilter(c1, c2); log.filter++; return r; };
  // wound part name: hook strike to know the body part
  const origClash = combat.bladeClash.bind(combat);
  log.clash = 0; log.clashFresh = 0; log.clashJ = 0; log.clashVn = 0;
  combat.hooks.onClash = (point, sp, info) => { log.clash++; if (info.fresh) { log.clashFresh++; log.clashJ = Math.max(log.clashJ, info.impulse); log.clashVn = Math.max(log.clashVn, info.vn); } };
  log.unstick = 0; log.stuckMax = 0; log.held = false;
  combat.onUnstick = () => { log.unstick++; };
  const origStrike = combat.strike.bind(combat);
  combat.strike = (pr, point, passing) => { const r = origStrike(pr, point, passing); if (pr.v.fighter === E) log.strikes.push({ part: pr.v.part, passing, ok: !!r }); if (pr.v.fighter === E && r) log.wounds.push({ part: pr.v.part, zone: r.zone, type: r.type, E: Math.round(r.energy), pass: r.pass, sp: +r.speed.toFixed(1), passing }); return r; };

  // geometric truth: does the swept blade line (as a capsule of radius hx) cross the target within the run?
  const hx = 0.024; // not used for truth; truth uses blade centre line vs target radius (conservative)
  let geomHit = false, sweptHit = false, minD = 1e9;
  const tgtBody = partName === 'sword' ? E.sword : E.bodies[partName];
  const targetDist = (d) => {
    // distance from the blade centre line (hilt->tip) to the target (capsule axis or ball centre)
    const a = O.clone().addScaledVector(d, HL), b = O.clone().addScaledVector(d, HL + L);
    const tq = Qr(tgtBody.rotation()), tp = V(tgtBody.translation());
    if (partName === 'sword') {
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(tq);
      return segSeg(a, b, tp.clone().addScaledVector(ax, E.weaponCfg.hiltLength), tp.clone().addScaledVector(ax, E.weaponCfg.hiltLength + E.weaponCfg.bladeLength)) - radius;
    }
    if (partName === 'farmS') {
      const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(tq);
      return segSeg(a, b, tp.clone().addScaledVector(ax, -0.095), tp.clone().addScaledVector(ax, 0.095)) - radius;
    }
    return pointSeg(tp, a, b) - radius;
  };
  // run
  let th = th0;
  const steps = k + 2 + Math.ceil(0.6 / (omega * DTP));
  setPose(th, true);
  let tipMaxFree = 0;
  for (let i = 0; i < steps; i++) {
    if (MODE === 'driven') setPose(th, true);
    stepE(DTP);
    const thPrev = th;
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    if (SWEPT) {
      const before = log.strikes.filter((x) => x.part === partName).length;
      const h = sweptCheck(combat, P, E, [partName]);
      if (h && before === 0 && !E.hitCooldowns.has(`${P.index}:${partName}`)) {
        const pr = combat.pairOf(P.bladeColliders[0].handle, h.col.handle);
        if (pr) { const r = combat.strike(pr, h.point, true); if (r) { sweptStats.added++; log.sweptAdded = (log.sweptAdded || 0) + 1; } }
      }
    }
    th += omega * DTP;
    // continuous truth over this step (analytic arc), 24 sub-samples
    for (let s = 0; s <= 24; s++) {
      const t = thPrev + ((th - thPrev) * s) / 24;
      const dd = targetDist(poseAt(t).d);
      minD = Math.min(minD, dd);
    }
    for (const [, cc] of combat.cutting) { if (cc.stuckT > 0) log.stuckMax = Math.max(log.stuckMax, cc.stuckT); if (cc.held) log.held = true; }
    if (MODE === 'free') {
      const w = S.angvel(), lv = S.linvel();
      const q = Qr(S.rotation()), p = V(S.translation());
      const tip = new THREE.Vector3(0, Rtip, 0).applyQuaternion(q).add(p);
      const com = V(S.worldCom());
      const vt = V(lv).add(new THREE.Vector3().crossVectors(V(w), tip.sub(com)));
      tipMaxFree = Math.max(tipMaxFree, vt.length());
    }
  }
  geomHit = minD < 0.0;
  // free mode: where did the attacker blade end up relative to the defender blade? (sign of the crossing-point side)
  let passedThrough = null, tipAfter = null;
  if (MODE === 'free' && TARGET !== 'blade') {
    const q = Qr(S.rotation()), p = V(S.translation());
    const w = S.angvel(), lv = S.linvel();
    const tip = new THREE.Vector3(0, Rtip, 0).applyQuaternion(q).add(p);
    tipAfter = +V(lv).add(new THREE.Vector3().crossVectors(V(w), tip.sub(V(S.worldCom())))).length().toFixed(1);
    const tb = E.bodies[partName];
    log.tgtV = +V(tb.linvel()).length().toFixed(2);
  }
  if (TARGET === 'blade') {
    const q = Qr(S.rotation()), p = V(S.translation());
    const d = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const pt = p.clone().addScaledVector(d, Rc);
    const eq = Qr(E.sword.rotation()), ep = V(E.sword.translation());
    const ea = new THREE.Vector3(0, 1, 0).applyQuaternion(eq);
    const mv0 = new THREE.Vector3().crossVectors(n, d0); // motion direction at crossing
    const rel = pt.sub(ep); rel.addScaledVector(ea, -rel.dot(ea));
    passedThrough = rel.dot(mv0) > 0; // attacker crossing point is beyond the defender's blade line
    const w = S.angvel(), lv = S.linvel();
    const tip = new THREE.Vector3(0, Rtip, 0).applyQuaternion(q).add(p);
    tipAfter = +V(lv).add(new THREE.Vector3().crossVectors(V(w), tip.sub(V(S.worldCom())))).length().toFixed(1);
  }
  const tw = log.wounds.filter((w) => w.part === partName);
  const ts = log.strikes.filter((s) => s.part === partName);
  return { held: log.held, stuckMax: +log.stuckMax.toFixed(3), unstick: log.unstick, tgtV: log.tgtV, tipMaxFree: +tipMaxFree.toFixed(1), v, phase: +phase.toFixed(3), clash: log.clash, clashFresh: log.clashFresh, clashJ: +log.clashJ.toFixed(2), clashVn: +log.clashVn.toFixed(1), passedThrough, tipAfter, geomHit, minD: +minD.toFixed(3), filter: log.filter, strikes: ts.length, wound: tw.length > 0, w: tw[0] || null, other: log.wounds.filter((w) => w.part !== partName).map((w) => w.part + ':' + w.E).join(' '), pred: log.pred, predFast: log.predFast, nullFast: log.nullFast, nullFastSpeed: +log.nullFastSpeed.toFixed(1), ccd: ccdVal, speeds: log.analyzeSpeeds.slice(0, 4) };
}

const res = [];
const t0 = Date.now();
for (const v of SPEEDS) {
  const rows = [];
  for (let i = 0; i < PHASES; i++) rows.push(trial(v, (i + 0.5) / PHASES, 1000 + i));
  res.push(...rows);
  const g = rows.filter((r) => r.geomHit);
  const hit = g.filter((r) => r.wound);
  const cut = hit.filter((r) => r.w.type !== 'blunt');
  const nullF = g.filter((r) => !r.wound && (r.nullFast > 0 || (r.strikes === 0 && r.predFast > 0)));
  const noContact = g.filter((r) => !r.wound && !(r.nullFast > 0 || (r.strikes === 0 && r.predFast > 0)));
  const Es = hit.map((r) => r.w.E);
  if (TARGET === 'blade') {
    const cl = g.filter((r) => r.clash > 0);
    const through = g.filter((r) => r.passedThrough);
    console.log(`${WEAPON} blade ${MODE} ccd=${CCD} dt=1/${HZP} F=${F} v=${v}: geom ${g.length}/${rows.length}  clash registered ${cl.length}/${g.length}  (fresh ${g.filter((r) => r.clashFresh > 0).length}, med J ${cl.length ? cl.map((r) => r.clashJ).sort((a, b) => a - b)[cl.length >> 1] : '-'} N*s)  ${MODE === 'free' ? `ended beyond the parry ${through.length}/${g.length} (without any clash ${through.filter((r) => r.clash === 0).length}), tip after med ${g.map((r) => r.tipAfter).sort((a, b) => a - b)[g.length >> 1]}` : ''} [${Date.now() - t0} ms]`);
    continue;
  }
  if (MODE === 'free') {
    const ta = hit.map((r) => r.tipAfter / r.v).sort((a, b) => a - b);
    console.log(`   free: exit tip/entry med ${ta.length ? ta[ta.length >> 1].toFixed(2) : '-'}  stuck(held) ${g.filter((r) => r.held).length}  unstick ${g.filter((r) => r.unstick).length}  target part speed after med ${g.map((r) => r.tgtV).sort((a, b) => a - b)[g.length >> 1]} m/s  tip max seen ${Math.max(...g.map((r) => r.tipMaxFree))}`);
  }
  console.log(`${WEAPON} ${TARGET} ${MODE} ccd=${CCD} dt=1/${HZP} F=${F} ${CUT} v=${v}: geom ${g.length}/${rows.length}  wound ${hit.length}/${g.length} (cut/stab ${cut.length}, pass ${hit.filter((r) => r.w.pass).length})  missed: >gate ${nullF.length} (max ${Math.max(0, ...nullF.map((r) => r.nullFastSpeed))} m/s), no-register ${noContact.length}  E med ${Es.length ? Es.sort((a, b) => a - b)[Es.length >> 1] : '-'} J  [${Date.now() - t0} ms]`);
}
if (SWEPT) console.log(`swept test: ${sweptStats.calls} calls, ${(Number(sweptStats.ns) / sweptStats.calls / 1000).toFixed(1)} us/call (1 part), added ${sweptStats.added} hits`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ WEAPON, TARGET, MODE, CCD, HZP, F, CUT, gate: process.env.SPEED_GATE || 30, res }, null, 0));
