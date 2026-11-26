// probe (e2): approach phase of tsubameRun (seed-independent before the first combo): distance, clashes, pelvis velocity, blade-blade closest distance, hand height
const T = process.argv[2];
const { tsubameRun } = await import(T + '/tools/sim/schielhau_strike.mjs');
const THREE = await import(T + '/node_modules/three/build/three.module.js');
const dur = +process.argv[3];
const segD = (a0, a1, b0, b1) => { let best = 9; for (let i = 0; i <= 10; i++) { const p = a0.clone().lerp(a1, i / 10); for (let j = 0; j <= 10; j++) best = Math.min(best, p.distanceTo(b0.clone().lerp(b1, j / 10))); } return best; };
const r = tsubameRun(1, { immortal: true, dur, ghostDown: true, onStep: (G, P) => {
  const k = Math.round(G.t / (1 / 120)); if (k % 15 || G.t < 9.25 || G.t > 11.8) return; const g = P.gait, hh = P.heading, fx = Math.cos(hh), fz = -Math.sin(hh); const SL = (g.legs.F.plant.x - g.legs.B.plant.x) * fx + (g.legs.F.plant.z - g.legs.B.plant.z) * fz;
  const E = G.enemy;
  const bd = segD(P.bladePoint(0, new THREE.Vector3()), P.bladePoint(1, new THREE.Vector3()), E.bladePoint(0, new THREE.Vector3()), E.bladePoint(1, new THREE.Vector3()));
  const tipE = segD(P.bladePoint(1, new THREE.Vector3()), P.bladePoint(1, new THREE.Vector3()), E.bladePoint(0, new THREE.Vector3()), E.bladePoint(1, new THREE.Vector3()));
  const pv = P.bodies.pelvis.linvel(); const h = P.bodies.farmS.translation(); const pp = P.bodies.pelvis.translation();
  console.log(JSON.stringify({ SL: +SL.toFixed(2), td: g.lastTDKind, swing: ['F','B'].map((n)=>g.legs[n].swing?n:'').join(''), settle: !!g.settleRel, t: +G.t.toFixed(2), d: +P.foeDistance().toFixed(2), clashes: G.clashes, vx: +pv.x.toFixed(2), vz: +pv.z.toFixed(2) }));
} });
console.log(JSON.stringify({ drawn: r.drawn, fired: r.fired, t: r.t }));
process.exit(0);
