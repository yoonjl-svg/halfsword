// prints each AI school's technique list (names) for the given characters; usage: node tools/sim/audit_techlist.mjs id1,id2,...
import { newRound, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
const W = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const seen = {};
for (const id of process.argv[2].split(',')) for (const w of W) {
  const ch = CHARACTERS_BY_ID[id];
  const G = newRound({ walls: true, seed: 1, weapon: w, weapon2: w, persona: ch.ai.persona, difficulty: ch.ai.level });
  const tr = G.ai.art?.tradition; const k = tr + ':' + G.ai.school.tech.map((t) => t.name).join(',');
  seen[k] = (seen[k] || 0) + 1; G.world.free();
}
for (const k of Object.keys(seen)) console.log(seen[k], k);
