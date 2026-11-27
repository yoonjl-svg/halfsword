// r29 inj part 2b — injured-leg walk. Same scene shape as tools/sim/legs_battery.mjs HOLES.legwound (solo longsword body, park, settle 2.0 + 0.11 i s with the
//  6 N·s chest nudge 0.5 s before, then a cut wound on thighF through Fighter.applyWound — the battery's wound() — then stand 2 s, then move (0, 1)).
//  Differences from the battery scene: walk lasts --secs (10) instead of 6, and the wound is given bleedPerSev 0 (as the battery's gutwound does) so the leg
//  strength stays at its target during the walk instead of sinking with blood loss. Severity is chosen so legDrive.strengthOf('F') ≈ target (LIMB_LOSS 0.7).
//  usage: (cd <cell> && node <this dir>/inj_walk.mjs --root=. [--str=1,0.8,0.5] [--n=8] [--secs=10] [--ecc=] [--lim=] [--out=<json>])
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { LEGS } = await import(u('src/config.js'));
if (args.ecc != null) LEGS.ecc = +args.ecc;
if (args.lim != null) for (const k of Object.keys(LEGS.limit)) LEGS.limit[k] *= +args.lim;
const H = await import(u('tools/sim/harness_m.mjs'));
const { LIMB_LOSS } = await import(u('src/fighter.js'));
const DT = H.DT, THREE = H.THREE;
const STRS = String(args.str ?? '1,0.8,0.5').split(',').map(Number);
const N = +(args.n ?? 8), SECS = +(args.secs ?? 10);
const limbFor = (s) => (s >= 1 ? 1 : (-0.56 + Math.sqrt(0.56 * 0.56 - 4 * 0.12 * (0.32 - s))) / 0.24);
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
const runs = [];
for (const target of STRS) for (let v = 0; v < N; v++) {
  const G = H.newRound({ walls: false, weapon: 'longsword', seed: 100 + v });
  G.park();
  const P = G.player;
  const settle = Math.round((2.0 + 0.11 * v) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, v * 2.39996); G.step(); }
  const l = limbFor(target), sev = (1 - l) / LIMB_LOSS;
  if (sev > 0) P.applyWound({ part: 'thighF', zone: 'leg', type: 'cut', severity: sev, energy: 40, local: new THREE.Vector3(), bleedPerSev: 0, dir: new THREE.Vector3(1, 0, 0) });
  const r = { target, v, sev: +sev.toFixed(3), limbF: +P.limbs.legF.toFixed(3), fell: false, tFall: null };
  r.standFall = null; r.standPelMin = 9;
  for (let i = 0; i < Math.round(2 / DT); i++) { P.move.set(0, 0); G.step(); const st = P.state; r.standPelMin = Math.min(r.standPelMin, +P.bodies.pelvis.translation().y.toFixed(3)); if (r.standFall == null && st !== 'stand') r.standFall = { t: +(i * DT).toFixed(3), state: st }; }
  const c0 = P.bodies.pelvis.translation(), p0 = { x: c0.x, z: c0.z }, f0 = fwdOf(P);
  const n = Math.round(SECS / DT);
  let ySum = 0, yN = 0, low = 0, tilt = 0, sF = 0, sB = 0, stF = 0, stB = 0, prevF = null, prevB = null, strF = 0, strB = 0, kneeSum = { F: 0, B: 0 }, yMin = 9;
  const D = P.legDrive;
  for (let i = 0; i < n; i++) {
    P.move.set(0, 1);
    G.step();
    const c = P.bodies.pelvis.translation();
    const st = P.state;
    low = c.y < 0.5 ? low + DT : 0;
    tilt = P.tiltDeg() > 60 ? tilt + DT : 0;
    if (!r.fell && (st === 'down' || st === 'getup' || st === 'dead' || st === 'kneel' || low > 0.25 || tilt > 0.25)) { r.fell = true; r.tFall = +(i * DT).toFixed(2); r.fellState = st; break; }
    ySum += c.y; yN++; yMin = Math.min(yMin, c.y);
    const g = P.gait?.legs;
    if (g) {
      const F = !!g.F.stance, B = !!g.B.stance;
      if (prevF === false && F) sF++;
      if (prevB === false && B) sB++;
      prevF = F; prevB = B;
      if (F) stF++;
      if (B) stB++;
    }
    strF += D.strengthOf('F'); strB += D.strengthOf('B');
  }
  const c = P.bodies.pelvis.translation(), dx = c.x - p0.x, dz = c.z - p0.z;
  const T = yN * DT;
  Object.assign(r, {
    T: +T.toFixed(2), alongV: +((dx * f0.x + dz * f0.z) / Math.max(T, DT)).toFixed(3), sideV: +((dx * -f0.z + dz * f0.x) / Math.max(T, DT)).toFixed(3),
    yMean: +(ySum / Math.max(1, yN)).toFixed(3), yMin: +yMin.toFixed(3), tdF: sF, tdB: sB, cadence: +((sF + sB) / Math.max(T, DT)).toFixed(3),
    stepLen: sF + sB ? +((dx * f0.x + dz * f0.z) / (sF + sB)).toFixed(3) : null, stanceShareF: +(stF / Math.max(1, yN)).toFixed(3), stanceShareB: +(stB / Math.max(1, yN)).toFixed(3),
    strF: +(strF / Math.max(1, yN)).toFixed(3), strB: +(strB / Math.max(1, yN)).toFixed(3),
  });
  runs.push(r);
  console.log(JSON.stringify(r));
  try { G.world.free(); } catch { /* */ }
}
if (args.out) writeFileSync(String(args.out), JSON.stringify({ legs: { ecc: LEGS.ecc, limit: LEGS.limit }, runs }, null, 1));
