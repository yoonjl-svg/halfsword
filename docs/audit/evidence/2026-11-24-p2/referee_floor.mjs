// referee_floor.mjs <path to a checkout that has tools/sim/honesty.mjs and node_modules>
// Audit check: what does the "outside torque share" read on bodies that are certainly honest (no hidden force at all)?
// The pass line for prototypes is "under 5 %". If honest bodies already read near or above that, the line sits inside the noise.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]);
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { attach, hook } = await import(u('tools/sim/honesty.mjs'));
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init();
const mk = () => { const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); w.timestep = 1 / 120; w.integrationParameters.numSolverIterations = 6; return w; };
const ground = (w) => w.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9), w.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
const tiltQ = (deg) => { const a = (deg * Math.PI) / 180; return { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }; };
const drive = (w, L, secs, each) => { let i = 0; const G = { world: w, step: () => { each?.(i++); w.step(); } }; hook(G, [L]); for (let k = 0; k < Math.round(secs * 120); k++) G.step(); return L.summary(); };
const pct = (x) => (100 * x).toFixed(1) + ' %';
const line = (name, S) => console.log(`${name}\n   outside torque share ${pct(S.torque.share)} · outside ${S.torque.outNms.toFixed(1)} N·m·s · ground ${S.torque.groundNms.toFixed(1)} N·m·s · tilt residual ${S.torque.tiltResNms.toFixed(1)} · outside force share ${pct(S.forceShare)}\n`);
// three links (5 kg each, 0.4 m) joined end to end by ball joints, standing as a column leaning 20 degrees
const chain = (w, lean = 20) => {
  const bodies = []; const a = (lean * Math.PI) / 180;
  for (let i = 0; i < 3; i++) { const c = 0.2 + 0.4 * i; const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-Math.sin(a) * c, Math.cos(a) * c + 0.06, 0).setRotation(tiltQ(lean))); w.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 0.2, 0.05).setMass(5).setFriction(0.9), b); bodies.push(b); }
  for (let i = 0; i < 2; i++) w.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: 0.2, z: 0 }, { x: 0, y: -0.2, z: 0 }), bodies[i], bodies[i + 1], true);
  return bodies;
};
{ const w = mk(); ground(w); const bs = chain(w); const S = drive(w, attach(w, bs.map((b, i) => ['link' + i, b])), 4); line('A passive three-link chain, leaning, left to fall and settle (4 s)', S); }
{ const w = mk(); ground(w); const bs = chain(w); const S = drive(w, attach(w, bs.map((b, i) => ['link' + i, b])), 4, (i) => { const t = 6 * Math.sin(i / 20); for (const b of bs) b.resetTorques(true); bs[0].addTorque({ x: 0, y: 0, z: t }, true); bs[1].addTorque({ x: 0, y: 0, z: -t }, true); bs[1].addTorque({ x: t, y: 0, z: 0 }, true); bs[2].addTorque({ x: -t, y: 0, z: 0 }, true); }); line('B same chain, with honest internal "muscle" torque pairs wriggling it (4 s)', S); }
{ const w = mk(); ground(w); const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.0, 0).setLinvel(3, 0, 1).setAngvel({ x: 4, y: 2, z: -6 })); w.createCollider(RAPIER.ColliderDesc.cuboid(0.15, 0.1, 0.25).setMass(8).setFriction(0.9), b); const S = drive(w, attach(w, [['box', b]]), 4); line('C a box thrown with spin, tumbling to rest (4 s)', S); }
{ const w = mk(); ground(w); const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.2, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(8).setFriction(0.9), b); for (let i = 0; i < 120; i++) w.step(); const S = drive(w, attach(w, [['box', b]]), 30); line('D a box simply resting on the ground (30 s)', S); }
