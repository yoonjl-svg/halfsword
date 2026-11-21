// audit runner: AI-vs-AI duels over the ten representative weapons; dumps decision counters (globalThis.__AIC) and mode transitions.
// usage: node tools/sim/audit_ai.mjs <out.json> [N] [S0] [SECS] [charIds,comma]
import { writeFileSync } from 'node:fs';
import { newRound, DT, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
const W = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const CH = process.argv[6] ? process.argv[6].split(',') : ['margarethe', 'isolde', 'heinrich', 'liao', 'artoria', 'omari', 'tome', 'eira'];
const OUT = process.argv[2], N = +(process.argv[3] || 32), S0 = +(process.argv[4] || 1), SECS = +(process.argv[5] || 45);
globalThis.__AIC = globalThis.__AIC || {};
const C = globalThis.__AIC; const inc = (k) => (C[k] = (C[k] || 0) + 1);
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const fights = [];
for (let seed = S0; seed < S0 + N; seed++) {
  const i = seed - 1;
  const wP = W[i % 10], wE = W[(i * 3 + 5) % 10];
  const ch = CHARACTERS_BY_ID[CH[i % CH.length]];
  const pc = CHARACTERS_BY_ID[CH[(i + 3) % CH.length]];
  if (process.env.TRACE) console.error("start", seed, wP, wE, ch.id, pc.id);
  seedRand(seed);
  const G = newRound({ walls: true, seed, weapon: wP, weapon2: wE, look: pc.look ?? LOOKS.player, look2: ch.look, revive: ch.revive, persona: ch.ai.persona, difficulty: ch.ai.level, AI2Class: AI, persona2: pc.ai.persona });
  const am = new Map(); let tDead = null;
  for (let k = 0; k < SECS / DT; k++) {
    G.step();
    for (const a of [G.ai, G.ai2]) { if (!a) continue; const m = a.mode; if (m !== am.get(a)) { am.set(a, m); inc('mode.' + m); } }
    inc('aiSteps');
    const P = G.player, E = G.enemy;
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = G.t;
    if (tDead != null && G.t - tDead > 2) break;
  }
  if (process.env.TRACE) console.error("done", seed);
  fights.push(`${seed}:${wP}(${G.ai2?.art?.tradition})/${wE}(${G.ai?.art?.tradition}) ${G.player.state}/${G.enemy.state}`);
  G.world.free();
}
writeFileSync(OUT, JSON.stringify({ N, S0, SECS, fights, C }, null, 0));
console.log(fights.join('\n'));
