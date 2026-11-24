// yaw_point_contact.mjs <path to a checkout that has tools/sim/honesty.mjs and node_modules>
// Audit check for the "yaw beyond the friction-couple limit" number.
// An honest body: one foot-sized box (0.24 x 0.07 x 0.10 m, friction 0.9) carrying 75 kg, standing still on the ground.
// Inside it a flywheel is spun up by an internal torque pair (+T on the wheel, -T on the leg) — no outside force of any kind.
// The only thing that can hold the foot from turning is ground friction. What does the tool read?
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]);
const u = (p) => pathToFileURL(join(ROOT, p)).href;
globalThis.__honestyDbg = [];
const { attach, hook } = await import(u('tools/sim/honesty.mjs'));
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init();
const run = (label, { cx, cz, T, pgs, hz }) => {
  const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); w.timestep = 1 / 120; w.integrationParameters.numSolverIterations = 6;
  if (pgs) w.integrationParameters.numInternalPgsIterations = pgs;
  if (hz) w.integrationParameters.contact_natural_frequency = hz;
  w.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9), w.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const A = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
  w.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.035, 0.05).setTranslation(0, 0.035, 0).setMass(1.1).setFriction(0.9), A);
  w.createCollider(RAPIER.ColliderDesc.ball(0.05).setTranslation(cx, 0.9, cz).setMass(50).setSensor(true), A);
  const Bw = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, 0.9, cz));
  w.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.02, 0.3).setMass(23.9).setSensor(true), Bw);
  w.createImpulseJoint(RAPIER.JointData.revolute({ x: cx, y: 0.9, z: cz }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), A, Bw, true);
  for (let i = 0; i < 120; i++) w.step();
  const yaw = () => { const q = A.rotation(); return (2 * Math.atan2(q.y, q.w) * 180) / Math.PI; };
  const y0 = yaw(); globalThis.__honestyDbg.length = 0;
  const L = attach(w, [['footA', A], ['wheel', Bw]]);
  const G = { world: w, step: () => { A.resetTorques(true); Bw.resetTorques(true); Bw.addTorque({ x: 0, y: T, z: 0 }, true); A.addTorque({ x: 0, y: -T, z: 0 }, true); w.step(); } };
  hook(G, [L]); const secs = 2; for (let i = 0; i < secs * 120; i++) G.step();
  const S = L.summary(); const d = globalThis.__honestyDbg; const n = d.length || 1;
  const avg = (f) => d.reduce((s, x) => s + f(x), 0) / n;
  console.log(`${label}\n   foot turned ${(yaw() - y0).toFixed(2)} deg in ${secs} s · wheel spin ${Bw.angvel().y.toFixed(1)} rad/s (expected ${(T / 1.434 * secs).toFixed(1)} if the foot holds)\n   tool: contact points ${avg((x) => x.npts).toFixed(1)} · ground normal ${avg((x) => x.Ns).toFixed(0)} N · friction-couple limit it computed ${avg((x) => x.budget).toFixed(1)} N·m · yaw torque it found ${avg((x) => Math.abs(x.r.y)).toFixed(1)} N·m (true friction couple = ${T}) · "beyond the limit" ${avg((x) => Math.max(0, Math.abs(x.r.y) - x.budget)).toFixed(1)} N·m · outside force share ${(100 * S.forceShare).toFixed(1)} % · joints to outside ${S.externalJoints.length}\n`);
};
for (const eng of [{ name: 'engine as in the game now', pgs: 0, hz: 0 }, { name: 'engine as in prototypes A/B (inner iterations 4, contact 120 Hz)', pgs: 4, hz: 120 }]) {
  console.log('=== ' + eng.name);
  for (const T of [10, 30, 45, 60, 70, 80, 85, 90, 100]) run(`weight over one corner of the foot, internal torque ${T} N·m`, { cx: 0.10, cz: 0.04, T, ...eng });
  for (const T of [30, 60, 80, 85, 90, 100]) run(`weight centred on the foot, internal torque ${T} N·m`, { cx: 0, cz: 0, T, ...eng });
}
