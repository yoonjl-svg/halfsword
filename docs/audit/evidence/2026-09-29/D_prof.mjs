// per-substep wall-clock profile of AI-vs-AI fights (hybrid unless LEVITATE=1). N fights x 30 s
import * as CONFIG from '../../src/config.js';
if (!process.env.LEVITATE) CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, AI } = await import('./jelly_harness.mjs');
const { Fighter } = await import('../../src/fighter.js');
const { Skill } = await import('../../src/skill.js');
const { Gait } = await import('../../src/gait.js');
const { Combat } = await import('../../src/combat.js');
const acc = {};
const wrap = (proto, name, label) => {
  const f = proto[name]; if (!f) return;
  proto[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { acc[label] = (acc[label] || 0) + performance.now() - t; } };
};
for (const m of ['step','updateState','updateHeading','updateBodyPose','driveBalance','updateFooting','applyPose','shove','driveSword','armIK','offHand','driveJoints','manualMuscle','elbowGravity','trackBlade','cacheState']) wrap(Fighter.prototype, m, 'F.' + m);
for (const m of ['update']) wrap(Skill.prototype, m, 'Skill.' + m);
for (const m of ['update','pinFeet','poseLegs','sense']) wrap(Gait.prototype, m, 'Gait.' + m);
wrap(AI.prototype, 'update', 'AI.update');
wrap(Combat.prototype, 'afterStep', 'Combat.afterStep');
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const N = +(process.env.N || 3); let steps = 0, tWorld = 0, tAll = 0;
for (let seed = 1; seed <= N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); G.ai2 = new AI(G.player, G.enemy, 'normal');
  const ws = G.world.step.bind(G.world); G.world.step = (...a) => { const t = performance.now(); ws(...a); tWorld += performance.now() - t; };
  for (let i = 0; i < 30 / DT; i++) { const t = performance.now(); G.step(); tAll += performance.now() - t; steps++; }
}
const us = (ms) => +(1000 * ms / steps).toFixed(1);
console.log(`steps ${steps}  total us/step ${us(tAll)}  world.step(rapier) ${us(tWorld)} (${(100*tWorld/tAll).toFixed(0)}%)`);
for (const [k, v] of Object.entries(acc).sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(22)} ${String(us(v)).padStart(7)} us/step (both fighters)  ${(100*v/tAll).toFixed(1)}%`);
console.log(`shove: steps with chest dist<=0.75: ${globalThis.__shoveNear || 0}, shove force applied: ${globalThis.__shoveN || 0} steps, max F ${globalThis.__shoveMaxF || 0}`);
