// Standalone Rapier probe: does soft CCD stop a thin blade from tunnelling through a 4 cm-radius capsule?
//  실행: node tools/redesign_probes/ccdprobe.mjs (저장소 루트에서; src 패치 불필요)
//  mode lin: blade translates at v (no rotation). mode rot: blade rotates about its hilt end with tip speed v.
import R from '@dimforge/rapier3d-compat'; // 저장소 node_modules (src/main.js 와 같은 패키지)
await R.init();
function run(mode, v, ccd, phase) {
  const w = new R.World({ x: 0, y: 0, z: 0 }); w.timestep = 1 / 120;
  const tgt = w.createRigidBody(R.RigidBodyDesc.fixed());
  w.createCollider(R.ColliderDesc.capsule(0.095, 0.04).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }), tgt); // along z
  const Lb = 1.05, HL = 0.13;
  let bd = R.RigidBodyDesc.dynamic().setGravityScale(0).setSoftCcdPrediction(ccd);
  const b = w.createRigidBody(bd);
  w.createCollider(R.ColliderDesc.cuboid(0.011, Lb / 2, 0.011).setTranslation(0, HL + Lb / 2, 0).setMass(1.2), b);
  const R0 = HL + 0.95 * Lb;
  if (mode === 'lin') {
    b.setTranslation({ x: -0.5 - phase * v / 120, y: -R0, z: 0 }, true); b.setLinvel({ x: v, y: 0, z: 0 }, true);
  } else {
    // pivot at (0, -R0? ) : blade points +y from pivot; place pivot so that blade at angle 0 crosses target (0,0,0) at radius R0
    const om = v / (HL + Lb); const a0 = -0.6 - phase * om / 120; // start angle (rad) about z
    b.setTranslation({ x: 0, y: -R0, z: 0 }, true);
    b.setRotation({ x: 0, y: 0, z: Math.sin(a0 / 2), w: Math.cos(a0 / 2) }, true);
    b.setAngvel({ x: 0, y: 0, z: om }, true);
    const com = b.worldCom(); const rx = com.x - 0, ry = com.y + R0; // v = w x r
    b.setLinvel({ x: -om * ry, y: om * rx, z: 0 }, true);
  }
  let touched = false; const v0 = mode === 'lin' ? b.linvel().x : b.angvel().z;
  for (let k = 0; k < 40; k++) { w.step(); w.contactPairsWith(b.collider(0), () => {}); w.contactPair(b.collider(0), tgt.collider(0), (m) => { if (m.numContacts() > 0) touched = true; }); }
  const v1 = mode === 'lin' ? b.linvel().x : b.angvel().z;
  return { stopped: Math.abs(v1) < 0.7 * Math.abs(v0), touched };
}
for (const mode of ['lin', 'rot']) for (const ccd of [0, 0.2, 0.5, 1.0]) {
  const row = [];
  for (const v of [16, 24, 32, 40, 50]) { let st = 0, to = 0; const N = 10; for (let p = 0; p < N; p++) { const r = run(mode, v, ccd, p / N); st += r.stopped; to += r.touched; } row.push(`${v}:${st * 10}%`); }
  console.log(mode, 'ccd', ccd, 'blade stopped by capsule (no tunnelling):', row.join(' '));
}
