// J audit runner: fightsN + branch counters (globalThis.__JC). N=36 by default. J_ABL=name to ablate.
import { newRound, DT, AI, CONFIG } from './jelly_harness.mjs';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = []; const N = +(process.env.N || 36), S0 = +(process.env.S0 || 1);
globalThis.__JC = globalThis.__JC || {};
for (let seed = S0; seed < S0 + N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null;
  for (let i = 0; i < 30 / DT; i++) {
    G.step();
    for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
  }
  out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, cause: [P.causeOfDeath, E.causeOfDeath].filter(Boolean).join('+') });
}
const deaths = out.filter(o => o.end.includes('dead')).length;
const winP = out.filter(o => o.end.endsWith('dead') && !o.end.startsWith('dead')).length;
const downs = out.reduce((s, o) => s + o.downs, 0);
const causes = {}; for (const o of out) if (o.cause) causes[o.cause] = (causes[o.cause] || 0) + 1;
const tD = out.filter(o => o.tDead != null).map(o => o.tDead); const meanT = tD.reduce((a, b) => a + b, 0) / Math.max(1, tD.length);
console.log(JSON.stringify({ abl: process.env.J_ABL || 'base', N, deaths, winP, downs, meanTDead: +meanT.toFixed(1), causes }));
const JC = globalThis.__JC; const keys = Object.keys(JC).sort();
if (process.env.J_COUNTS) console.log(JSON.stringify(Object.fromEntries(keys.map(k => [k, +JC[k].toFixed(2)]))));
console.log(out.map(o => `${o.seed}:${o.end}${o.tDead ? '@' + o.tDead : ''} d${o.downs}`).join(' '));
