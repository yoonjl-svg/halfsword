// referee_holes.mjs <path to a checkout that has tools/sim/honesty.mjs and node_modules>
// Audit check of the measuring tool used as referee for the physics-2 prototypes:
// each case props a body up by a means that is NOT a force call, then prints what the tool reports.
// A case is a "hole" when the body is clearly held up by something unphysical and the tool's numbers still read clean.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]);
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { attach, hook } = await import(u('tools/sim/honesty.mjs'));
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
await RAPIER.init();
const mk = (grav = -9.81) => { const w = new RAPIER.World({ x: 0, y: grav, z: 0 }); w.timestep = 1 / 120; w.integrationParameters.numSolverIterations = 6; return w; };
const ground = (w, mu = 0.9) => w.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(mu), w.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
const tiltQ = (deg) => { const a = (deg * Math.PI) / 180; return { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }; };
// a 1 m pole (10 kg) standing on its end, leaning 12 degrees (past its tipping angle of 5.7): left alone it must fall
const pole = (w, o = {}) => { const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.56, 0).setRotation(tiltQ(12)).setAngularDamping(o.ad ?? 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 0.5, 0.05).setMass(10).setFriction(o.mu ?? 0.9), b); return b; };
const slab = (w, mu) => { const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.05, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.05, 0.5).setMass(10).setFriction(mu), b); return b; };
const box = (w, y, mu = 0.9) => { const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, y, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setDensity(125).setFriction(mu), b); return b; };
const drive = (w, L, secs, each) => { const G = { world: w, step: () => { each?.(); w.step(); } }; hook(G, [L]); for (let i = 0; i < Math.round(secs * 120); i++) G.step(); return L.summary(); };
const leanOf = (b) => { const q = b.rotation(); const upY = 1 - 2 * (q.x * q.x + q.z * q.z); return +((Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI).toFixed(1); };
const pct = (x) => (100 * x).toFixed(1) + ' %';
const line = (name, held, S, extra = '') => console.log(`${name}\n   body: ${held}\n   tool: outside force share ${pct(S.forceShare)} · support share ${pct(S.supportShare)} · ground normal / weight ${pct(S.check.groundNShare)} · unexplained vertical ${S.check.hiddenYNs.toFixed(1)} N·s · friction over limit ${S.check.frictionExcessNs.toFixed(1)} N·s · joints to outside ${S.externalJoints.length} · foreign contact ${(S.cats.foreignN?.Fimp ?? 0).toFixed(1)} N·s · damping torque ${(S.cats.damp?.Timp ?? 0).toFixed(1)} N·m·s · placed steps ${S.place.calls}${extra}\n`);

{ const w = mk(); ground(w); const b = pole(w); const S = drive(w, attach(w, [['pole', b]]), 3); line('0 control — leaning pole, nothing done', `lean after 3 s ${leanOf(b)} deg`, S); }
{ const w = mk(); ground(w); const b = pole(w); b.lockRotations(true, true); const S = drive(w, attach(w, [['pole', b]]), 3); line('1 rotation lock — rb.lockRotations(true)', `lean after 3 s ${leanOf(b)} deg`, S); }
{ const w = mk(); ground(w); const b = pole(w); b.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 5000, y: 5000, z: 5000 }, { x: 0, y: 0, z: 0, w: 1 }, true); const S = drive(w, attach(w, [['pole', b]]), 3); line('2 added rotational inertia 5000 kg·m² (set once, before measuring)', `lean after 3 s ${leanOf(b)} deg`, S); }
{ const w = mk(); ground(w); const b = pole(w, { ad: 200 }); const S = drive(w, attach(w, [['pole', b]]), 3); line('3 angular damping 200', `lean after 3 s ${leanOf(b)} deg`, S); }
{ const w = mk(); ground(w); const prop = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.0, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.05, 0.5).setFriction(0.9), prop); const b = box(w, 1.26); for (let i = 0; i < 120; i++) w.step(); const S = drive(w, attach(w, [['box', b]]), 2); line('4 invisible kinematic platform under the body (1 m above the ground)', `height ${b.translation().y.toFixed(2)} m (held in the air)`, S); }
{ const w = mk(-4.905); ground(w); const b = box(w, 0.2); for (let i = 0; i < 120; i++) w.step(); const S = drive(w, attach(w, [['box', b]]), 2); line('5 world gravity halved (-4.905)', 'resting on the ground under half gravity', S); }
for (const mu of [0.9, 5]) { const w = mk(); ground(w, mu); const b = slab(w, mu); for (let i = 0; i < 120; i++) w.step(); const m = b.mass(); const L = attach(w, [['slab', b]]); const x0 = b.translation().x; const S = drive(w, L, 2, () => { b.resetForces(true); b.addForce({ x: 2 * m * 9.81, y: 0, z: 0 }, true); }); line(`6 flat slab pushed sideways with 2 x its weight — friction coefficient ${mu} on slab and ground`, `moved ${(b.translation().x - x0).toFixed(3)} m in 2 s`, S, ' · (the sideways push itself counts as an outside force — look at "friction over limit")'); }
{ const w = mk(); ground(w); const b = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 2, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setDensity(125), b); const S = drive(w, attach(w, [['box', b]]), 2); line('7 the body itself switched to kinematic, hanging 2 m up', `height ${b.translation().y.toFixed(2)} m · mass() ${b.mass().toFixed(1)}`, S); }
