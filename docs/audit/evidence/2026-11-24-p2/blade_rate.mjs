// blade_rate.mjs <checkout with tools/sim/harness_m.mjs and node_modules>
// Audit helper for the "is the sword slow?" reading of the realism gap map.
// Drives the same scripted cuts as tools/sim/chain_probe.mjs (hand target swept at the family's speed, seed 7, foe parked)
// and prints, per cut: peak tip speed, peak blade angular rate (swing only, spin about the blade axis removed), sword mass, tip distance from the grip.
// Speeds are per game second (TIME.tempo applies on screen).
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs')); const { FAM } = await import(u('tools/sim/corr_lib.mjs'));
const { newRound, DT, THREE, CONFIG } = H; const D = 180 / Math.PI;
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
console.log(`tempo ${CONFIG.TIME?.tempo}`);
for (const weapon of (process.argv[3] ?? 'longsword,zweihander,uchigatana').split(',')) for (const fam of ['diagR', 'vert', 'horizR']) {
  const F = FAM[fam]; const G = newRound({ walls: false, weapon, seed: 7 }); G.park(); const P = G.player;
  P.handOffset.set(F.ch[0], F.ch[1]); for (let i = 0; i < Math.round(3.0 / DT); i++) { P.move.set(0, 0); G.step(); }
  let tgt = F.end; const tips = [], rates = [];
  for (let k = 0; k < 6; k++) {
    const from = [P.handOffset.x, P.handOffset.y], dist = Math.hypot(tgt[0] - from[0], tgt[1] - from[1]);
    const n = Math.round((dist / F.v + 0.6) / DT); let vt = 0, wr = 0;
    for (let i = 0; i < n; i++) {
      const off = P.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
      if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
      P.move.set(0, 0); G.step();
      const tip = P.bladePoint(1, new THREE.Vector3()); const v = P.sword.velocityAtPoint(tip); vt = Math.max(vt, Math.hypot(v.x, v.y, v.z));
      const q = P.sword.rotation(); const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      const w = P.sword.angvel(); const W = new THREE.Vector3(w.x, w.y, w.z); W.addScaledVector(blade, -W.dot(blade)); wr = Math.max(wr, W.length());
    }
    if (tgt === F.end) { tips.push(vt); rates.push(wr); }
    tgt = tgt === F.end ? F.ch : F.end;
  }
  const g = P.sword.translation(); const tip = P.bladePoint(1, new THREE.Vector3());
  console.log(`${weapon.padEnd(11)} ${fam.padEnd(7)} tip ${med(tips).toFixed(1)} m/s · blade swing rate ${(med(rates) * D).toFixed(0)} deg/s (${med(rates).toFixed(1)} rad/s) · sword ${P.sword.mass().toFixed(2)} kg · tip ${Math.hypot(tip.x - g.x, tip.y - g.y, tip.z - g.z).toFixed(2)} m from the grip`);
}
