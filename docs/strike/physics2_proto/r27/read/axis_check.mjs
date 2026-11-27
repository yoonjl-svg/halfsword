// Which world axis does the engine's spherical-joint motor on AngX/AngY/AngZ push along, when parent and child frames differ?
// motorRoom assumes a_i = parent body axis i. Usage: (cd $S/wt_cap && node $S/r27/read/axis_check.mjs)
import RAPIER from '../../wt_cap/node_modules/@dimforge/rapier3d-compat/rapier.mjs';
await RAPIER.init();
const ang = +(process.argv[2] ?? 1.0); // relative rotation of child about parent z (rad), like a flexed hip
const qz = (a) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
for (const axis of [3, 4, 5]) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 240; world.integrationParameters.numSolverIterations = 6;
  const mk = (q, fixed) => { const rb = world.createRigidBody((fixed ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic()).setRotation(q).setAngularDamping(0)); world.createCollider(RAPIER.ColliderDesc.ball(0.1).setDensity(1000), rb); return rb; };
  const P = mk(qz(0), true), Cb = mk(qz(ang), false);
  const j = world.createImpulseJoint(RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), P, Cb, true);
  const raw = j.rawSet ?? world.impulseJoints.raw;
  raw.jointConfigureMotorModel(j.handle, axis, 1);
  // pure velocity motor (k = 0): drive relative speed toward 1 rad/s on this axis
  raw.jointConfigureMotor(j.handle, axis, 0, 1, 0, 0.05);
  world.step();
  const w = Cb.angvel(); const n = Math.hypot(w.x, w.y, w.z);
  const i = axis - 3; const pa = [0, 0, 0]; pa[i] = 1; // parent axis (world = parent here)
  const ca = i === 0 ? [Math.cos(ang), Math.sin(ang), 0] : i === 1 ? [-Math.sin(ang), Math.cos(ang), 0] : [0, 0, 1];
  const h = ang / 2, ha = i === 0 ? [Math.cos(h), Math.sin(h), 0] : i === 1 ? [-Math.sin(h), Math.cos(h), 0] : [0, 0, 1];
  const dir = [w.x / n, w.y / n, w.z / n]; const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI).toFixed(1);
  console.log(`rel z ${ang} rad · motor Ang${'XYZ'[i]}: child angvel dir (${dir.map((v) => v.toFixed(3)).join(', ')}) · angle to parent axis ${deg(dot(dir, pa))}° · to child axis ${deg(dot(dir, ca))}° · to half-way axis ${deg(dot(dir, ha))}°`);
}
