// Speed sweep: scripted blade (infinitely strong arm) sweeps through a standing dummy's forearm / neck
// at a given tip speed. Counts: hook calls, contact manifolds, wounds (zone, J), missed passes.
// env: CCD (soft ccd prediction m; 'auto' = max(0.2, k*v*dt)), CAP (combat speed cap, default 30),
//      DTX (timestep divisor, 1 = 1/120, 2 = 1/240), W weapon, TGT farm|neck|chest, T frac along blade (0.75)
// usage: node tools/sim/speedsweep.mjs "20,26,32,38,45" [phases]
const speeds = (process.argv[2] || '20,26,32,38,45').split(',').map(Number);
const PH = +(process.argv[3] || 12);
const CCDENV = process.env.CCD || '0.2';
const CAP = +(process.env.CAP || 30);
const DTX = +(process.env.DTX || 1);
const W = process.env.W || 'longsword';
const TGT = process.env.TGT || 'farm';
const TF = +(process.env.T || 0.75);
globalThis.__SPEEDCAP = CAP; if (process.env.SWEPT) globalThis.__SWEPT = 1;
const CFG = await import('../../src/config.js');
CFG.PHYSICS.timestep = 1 / (120 * DTX);
const H = await import('./harness_m.mjs');
const { newRound, THREE } = H;
const DT = CFG.PHYSICS.timestep;

function runOne(vtip, phase) {
  const ccd = CCDENV === 'auto' ? Math.max(0.2, 1.3 * vtip * DT) : +CCDENV; // used only for info
  globalThis.__CCD = ccd;
  const G = newRound({ seed: 7, walls: false, weapon: W, gap: 2.0 });
  G.world.timestep = DT;
  const { world, player: A, enemy: V } = G;
  // detach attacker's sword; hide victim's sword far away
  world.removeImpulseJoint(A.gripJoint, true);
  A.sword.setGravityScale(0, true);
  const TB = TGT === 'blade';
  if (!TB) {
  world.removeImpulseJoint(V.gripJoint, true);
  V.sword.setGravityScale(0, true);
  V.sword.setTranslation({ x: 50, y: 5, z: 50 }, true);
  }
  // let victim settle 0.3 s
  const settle = () => {
    V.faceTarget = A.bodies.pelvis.translation();
    V.foe = null;
    V.move.set(0, 0);
    V.step(DT);
    if (!TB) { V.sword.setTranslation({ x: 50, y: 5, z: 50 }, true);
    V.sword.setLinvel({ x: 0, y: 0, z: 0 }, true); }
  };
  for (let i = 0; i < Math.round(0.3 / DT); i++) {
    settle();
    A.sword.setTranslation({ x: -30, y: 5, z: -30 }, true);
    A.sword.setLinvel({ x: 0, y: 0, z: 0 }, true);
    A.sword.setAngvel({ x: 0, y: 0, z: 0 }, true);
    A.cacheState(); V.cacheState();
    world.step(G.eventQueue, G.combat.physicsHooks);
    G.combat.afterStep(world, G.eventQueue);
  }
  // freeze the dummy (kinematic): detection test, target does not drift
  if (!process.env.LIVE) for (const b of [...Object.values(V.bodies), ...(TB ? [V.sword] : [])]) { b.setBodyType(H.RAPIER.RigidBodyType.KinematicPositionBased, true); b.setLinvel({x:0,y:0,z:0}, true); b.setAngvel({x:0,y:0,z:0}, true); }
  // target
  const partName = TGT === 'farm' ? 'farmS' : TGT === 'neck' ? 'head' : 'chest';
  const pb = TB ? V.sword : V.bodies[partName];
  let tcol = null; for (const [h, info] of G.combat.info) if (info.fighter === V && info.body === pb && (!TB || info.part === 'blade')) tcol = world.getCollider(h);
  const T = H.V(tcol.translation());
  if (TB) { const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(H.Q(V.sword.rotation())); T.addScaledVector(ax, 0.1 * V.weaponCfg.bladeLength); }
  if (TGT === 'neck') T.y -= 0.075;
  const HL = A.weaponCfg.hiltLength, L = A.weaponCfg.bladeLength;
  const R = HL + TF * L; // pivot→contact radius
  const Rtip = HL + L;
  const omega = vtip / Rtip;
  // plane: for forearm (lies along x in V frame, horizontal) cut vertically downward; axis n = horizontal ⟂ forearm
  // for neck/chest: horizontal sweep, n = up
  let n, d0;
  const fa = new THREE.Vector3(TB ? 0 : 1, TB ? 1 : 0, 0).applyQuaternion(H.Q(pb.rotation())); // part local x (forearm is alongX); blade: local y
  if (TB) { n = fa.clone().normalize(); }
  else if (TGT === 'farm') {
    fa.y = 0; fa.normalize();
    n = fa.clone(); // rotate about forearm axis → blade sweeps across it (⟂)
  } else n = new THREE.Vector3(0, 1, 0);
  // pivot placed so blade crosses T after sweeping angle a0 (start 50° before) with phase jitter
  const a0 = (50 * Math.PI) / 180 + phase * omega * DT; // phase ∈ [0,1): sub-step offset
  // direction from pivot to T at crossing: dC ⟂ n. choose dC pointing from attacker side toward victim & up/sideways
  let dC;
  if (TGT === 'farm') dC = new THREE.Vector3(0, -1, 0).cross(n).cross(n).negate().normalize(); // pointing down at crossing
  else dC = new THREE.Vector3(1, 0, 0).applyQuaternion(V.yaw.clone()).multiplyScalar(-1); // from victim front toward attacker? blade tip passes T
  if (TGT === 'farm') dC.set(0, -1, 0);
  if (TB) { dC = new THREE.Vector3(0, -1, 0).addScaledVector(n, n.y).normalize(); if (dC.lengthSq() < 0.1) dC.set(1, 0, 0).addScaledVector(n, -n.x).normalize(); }
  const P = T.clone().addScaledVector(dC, -R);
  // blade direction at time t: d(t) = rot(n, -a0 + omega t) dC
  const qAt = (ang) => {
    const d = dC.clone().applyAxisAngle(n, ang);
    // sword local y → d, local z → n
    const x = new THREE.Vector3().crossVectors(d, n);
    const m = new THREE.Matrix4().makeBasis(x, d, n);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };
  const hooks = { calls: 0, pass: 0 };
  const orig = G.combat.filterContactPair.bind(G.combat);
  const bladeSet = new Set(A.bladeColliders.map((c) => c.handle));
  const tgtCols = new Set();
  for (const [h, info] of G.combat.info) if (info.fighter === V && info.body === pb) tgtCols.add(h);
  G.combat.physicsHooks.filterContactPair = (c1, c2) => {
    const r = orig(c1, c2);
    if ((bladeSet.has(c1) && tgtCols.has(c2)) || (bladeSet.has(c2) && tgtCols.has(c1))) { hooks.calls++; if (r === 0) hooks.pass++; }
    return r;
  };
  const w0 = G.wounds.length; const c0 = G.clashes;
  let partHit = 0; { const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (a, v, r, pt, pr) => { if (v === V && pr?.v?.part === partName && (TGT !== 'neck' || r.zone === 'neck')) partHit++; return ow(a, v, r, pt, pr); }; }
  const spd = []; G.onWound = (att, vic, r) => { if (vic === V) spd.push(`${r.zone}@${r.speed.toFixed(1)}`); };
  let bounces = 0; const zoneWant = TGT === 'farm' ? 'arm' : TGT;
  let manif = 0, overl = 0;
  const steps = Math.ceil((2 * a0) / (omega * DT)) + 4;
  let tStep = 0, tAfter = 0;
  const t0 = performance.now();
  for (let k = 0; k < steps; k++) {
    const ang = -a0 + omega * k * DT;
    A.sword.setTranslation({ x: P.x, y: P.y, z: P.z }, true);
    const q = qAt(ang);
    A.sword.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    // body origin at pivot → linvel of origin = 0, but COM moves: set angvel only; Rapier linvel is COM velocity
    const com = H.V(A.sword.worldCom());
    const vcom = n.clone().multiplyScalar(omega).cross(com.clone().sub(P));
    A.sword.setLinvel({ x: vcom.x, y: vcom.y, z: vcom.z }, true);
    A.sword.setAngvel({ x: n.x * omega, y: n.y * omega, z: n.z * omega }, true);
    if (process.env.LIVE) settle();
    A.cacheState(); V.cacheState();
    let gd = 9;
    for (const bc of A.bladeColliders) for (const h of tgtCols) { const sc = bc.contactCollider(world.getCollider(h), 1.0); if (sc && sc.distance < gd) gd = sc.distance; }
    const hc0 = hooks.calls;
    const ts = performance.now();
    world.step(G.eventQueue, G.combat.physicsHooks);
    tStep += performance.now() - ts;
    for (const bc of A.bladeColliders) for (const h of tgtCols) world.contactPair(bc, world.getCollider(h), (m) => { if (m.numContacts() > 0) { manif++; for (let i = 0; i < m.numContacts(); i++) if (m.contactDist(i) < 0.004) { overl++; break; } } });
    let mc = -1, md = 9;
    for (const bc of A.bladeColliders) for (const h of tgtCols) world.contactPair(bc, world.getCollider(h), (m) => { mc = Math.max(mc, m.numContacts()); for (let i = 0; i < m.numContacts(); i++) md = Math.min(md, m.contactDist(i)); });
    if (process.env.TRACE && gd < 0.6) { const bcw = H.V(A.bladeColliders[0].translation()); const ax = new THREE.Vector3(0,1,0).applyQuaternion(H.Q(A.sword.rotation())); const tc = H.V(tcol.translation()); const rel = tc.clone().sub(bcw); const lineD = rel.clone().addScaledVector(ax, -rel.dot(ax)).length(); console.log('  drift', tc.distanceTo(T).toFixed(3), 'lineDist', lineD.toFixed(3), 'along', rel.dot(ax).toFixed(3), 'HL', HL, 'L', L); }
    if (process.env.TRACE && gd < 0.6) console.log('k', k, 'geomDist', gd.toFixed(3), 'hook', hooks.calls - hc0, 'manifContacts', mc, 'minDist', md.toFixed(3), 'cutting', G.combat.cutting.size);
    const lr = G.combat.lastRebound; const ta = performance.now(); G.combat.afterStep(world, G.eventQueue); tAfter += performance.now() - ta; if (G.combat.lastRebound && G.combat.lastRebound !== lr) bounces++;
  }
  const ws = G.wounds.slice(w0).filter((w) => w.vic === V);
  // contact point speed actually reported
  if (TB) partHit = G.clashes - c0;
  return { hooks: hooks.calls, pass: hooks.pass, manif, overl, wounds: ws.map((w) => `${w.zone}:${w.type}:${w.energy.toFixed(0)}`), hit: partHit > 0, spd, bounces, stepMs: tStep / steps, afterMs: tAfter / steps, ccd };
}

const out = [];
for (const v of speeds) {
  let hit = 0, bnc = 0, anyContact = 0, overl = 0, E = [], types = {}, ms = 0, am = 0;
  for (let p = 0; p < PH; p++) {
    const r = runOne(v, p / PH);
    if (r.hit) hit++;
    if (r.manif > 0) anyContact++; if (r.bounces > 0) bnc++;
    if (r.overl > 0) overl++;
    ms += r.stepMs; am += r.afterMs;
    for (const w of r.wounds) { const [z, t, e] = w.split(':'); types[`${z}:${t}`] = (types[`${z}:${t}`] || 0) + 1; E.push(+e); }
    if (process.env.VERB) console.log(v, p, JSON.stringify(r));
  }
  const row = { vtip: v, vcontact: +(v * (0 + (1) * 1)).toFixed(1), hitPct: Math.round((100 * hit) / PH), bouncePct: Math.round((100 * bnc) / PH), contactPct: Math.round((100 * anyContact) / PH), overlapPct: Math.round((100 * overl) / PH), Emed: E.sort((a, b) => a - b)[E.length >> 1] ?? null, types, stepMs: +(ms / PH).toFixed(3), afterMs: +(am / PH).toFixed(4) };
  out.push(row);
  console.log(JSON.stringify({ W, TGT, TF, CCD: CCDENV, CAP, DTX, ...row }));
}
