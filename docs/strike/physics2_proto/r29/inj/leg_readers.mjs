// r29 inj part 2a — the four readers of LEGS.limit outside the seven clamps, evaluated on a real built body (longsword fighter) at strength 1.0 / 0.8 / 0.5
//  and limit scale x1.00 / x1.25 (mutating the cell's exported LEGS.limit in-process; restored between rows).
//  usage: (cd <cell ll_10_100> && node <this dir>/leg_readers.mjs --root=. [--out=<txt>])
//  Strength is set the game's way: limbs.legF lowered so that legDrive.strengthOf('F') hits the target (muscle 1); the other leg stays limbs 1.
//  readers:  (a) legs_vmc.js ~297-298  CoP bounds of a weakened stance foot: forward room = anklePlantar*str/(m g), back room = ankleDorsi*str/(m g) from the ankle
//            (b) legs_vmc.js ~406      kneeBendMax(k, load): max knee bend held at load (full body weight and half body weight)
//            (c) legs_vmc.js ~421      hipReach(k) = hipFlex*str/(upper weight)
//            (d) gait.js ~2376         swing pull cap = min(GAIT.swingFmax, hipFlex*str/legMax)
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { LEGS, GAIT } = await import(u('src/config.js'));
const H = await import(u('tools/sim/harness_m.mjs'));
const L0 = { ...LEGS.limit };
const G = H.newRound({ walls: false, weapon: 'longsword', seed: 101 });
G.park();
const P = G.player;
for (let i = 0; i < Math.round(2 / H.DT); i++) { P.move.set(0, 0); G.step(); }
const D = P.legDrive;
const g = 9.81;
const W = (P.totalMass || 75) * g;
const Mg = P.gait?.Mg ?? W;
const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
say(`body: totalMass ${P.totalMass?.toFixed(2)} kg · m g ${W.toFixed(1)} N · gait Mg ${Mg.toFixed(1)} N · legMax ${D.legMax.toFixed(3)} m · GAIT.swingFmax ${GAIT.swingFmax} N · LEGS.kneeUse ${LEGS.kneeUse} · ecc ${LEGS.ecc}`);
// limb value that gives target strength: strengthOf = muscle*(0.6+0.4*legHealth)*(0.4+0.6*l), legHealth=(l+1)/2 → 0.12 l^2 + 0.56 l + 0.32 - s/muscle = 0
const limbFor = (s) => { const m = P.muscle, c = 0.32 - s / m; return (-0.56 + Math.sqrt(0.56 * 0.56 - 4 * 0.12 * c)) / (2 * 0.12); };
const deg = (x) => (Number.isFinite(x) ? ((x * 180) / Math.PI).toFixed(1) + '°' : 'no cap');
const LF = D.legs.F;
const a0 = (LF.pa.x - LF.sole.x) * LF.fx.x + (LF.pa.y - LF.sole.y) * LF.fx.y + (LF.pa.z - LF.sole.z) * LF.fx.z;
const aMax0 = LF.aMax, aMin0 = LF.aMin; // healthy flat stance: the foot's own CoP bounds (sole-centre frame)
say(`foot F (healthy, standing): ankle along foot a0 ${a0.toFixed(3)} m · CoP bounds aMin ${aMin0.toFixed(3)} .. aMax ${aMax0.toFixed(3)} m · reach from ankle: toe ${(aMax0 - a0).toFixed(3)} m · heel ${(a0 - aMin0).toFixed(3)} m`);
say('| scale | str target | limbs.legF | strengthOf(F) | (a) fwd CoP room m (bound used) | (a) back CoP room m (bound used) | (b) knee bend max @ m g | (b) @ m g / 2 | (c) hipReach m | (d) swing pull cap N |');
say('|---|---|---|---|---|---|---|---|---|---|');
for (const sc of [1.0, 1.25]) {
  for (const k of Object.keys(LEGS.limit)) LEGS.limit[k] = L0[k] * sc;
  for (const s of [1.0, 0.8, 0.5]) {
    const l = s >= 1 ? 1 : limbFor(s);
    P.limbs.legF = l;
    const str = D.strengthOf('F');
    const fwd = (LEGS.limit.anklePlantar * str) / W, back = (LEGS.limit.ankleDorsi * str) / W;
    const kb1 = D.kneeBendMax('F', Mg), kb2 = D.kneeBendMax('F', Mg / 2);
    const hr = D.hipReach('F');
    const fm = Math.min(GAIT.swingFmax, (LEGS.limit.hipFlex * str) / D.legMax);
    const useF = str < 1 ? Math.min(aMax0 - a0, fwd) : aMax0 - a0, useB = str < 1 ? Math.min(a0 - aMin0, back) : a0 - aMin0;
    say(`| x${sc.toFixed(2)} | ${s} | ${l.toFixed(3)} | ${str.toFixed(3)} | ${fwd.toFixed(3)} (${useF.toFixed(3)}) | ${back.toFixed(3)} (${useB.toFixed(3)}) | ${deg(kb1)} | ${deg(kb2)} | ${hr.toFixed(3)} | ${fm.toFixed(1)}${fm < GAIT.swingFmax ? '' : ' (at cap)'} |`);
  }
}
for (const k of Object.keys(LEGS.limit)) LEGS.limit[k] = L0[k];
P.limbs.legF = 1;
// foot geometry for (a): the room only binds when it is smaller than the foot's own reach from the ankle (comment in legs_vmc.js: toe 0.16 m · heel 0.06 m)
say('note (a): applied only when str < 1; binds when the room is below the foot reach from the ankle (legs_vmc.js comment: toe ~0.16 m, heel ~0.06 m).');
try { G.world.free(); } catch { /* */ }
if (args.out) writeFileSync(String(args.out), lines.join('\n') + '\n');
