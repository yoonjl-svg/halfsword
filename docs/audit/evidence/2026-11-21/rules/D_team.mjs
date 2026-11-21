// D audit: 2v2 team fights in-process (counters aggregate). env N (default 8), SECS (60), J_COUNTS, J_ABL, PERTURB
import { newMatch, DT, CONFIG } from './jelly_harness.mjs';
const WEAPONS = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 3) % WEAPONS.length]);
import { LOOKS } from '../../src/looks.js';
if (process.env.PERTURB) CONFIG.BODY.uprightStiffness *= 1 + 1e-6 * +process.env.PERTURB;
const N = +(process.env.N || 8), SECS = +(process.env.SECS || 60);
globalThis.__JC = globalThis.__JC || {};
const out = [];
for (let seed = 1; seed <= N; seed++) {
  let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const weapons = loadout(seed, 4);
  const G = newMatch({ count: 4, ai: 'all', seed, walls: true, weapons, looks: Array(4).fill(LOOKS.enemy) });
  let downs = 0; const prev = new Map();
  for (let i = 0; i < SECS / DT && !G.over; i++) {
    G.step();
    for (const f of G.fighters) { const p = prev.get(f) ?? 'stand'; if (p === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev.set(f, f.state); }
  }
  const dead = G.fighters.filter((f) => f.state === 'dead').length;
  out.push({ seed, dead, downs, t: +G.t.toFixed(1), w: weapons.join(',') });
  G.world.free?.();
}
const dead = out.reduce((a, o) => a + o.dead, 0), downs = out.reduce((a, o) => a + o.downs, 0);
console.log(JSON.stringify({ abl: process.env.J_ABL || (process.env.PERTURB ? 'perturb' + process.env.PERTURB : 'base'), N, dead, downs }));
if (process.env.J_COUNTS) { const JC = globalThis.__JC; console.log(JSON.stringify(Object.fromEntries(Object.keys(JC).sort().map((k) => [k, +JC[k].toFixed(3)])))); }
console.log(out.map((o) => `${o.seed}:${o.w} dead${o.dead} d${o.downs} t${o.t}`).join('\n'));
