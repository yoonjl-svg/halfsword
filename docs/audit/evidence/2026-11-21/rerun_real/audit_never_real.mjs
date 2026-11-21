// 게임 규칙(무기가 바뀌면 유파 꾸러미도 바꿈)대로 돌린 판에서: 유파별 기술 목록 가운데 한 번도 시작 안 된 기술
// 쓰는 법: node tools/sim/audit_never_real.mjs <out40.json> <out24.json>
import { readFileSync } from 'node:fs';
import { newRound, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { getWeapon } from '../../src/weapons.js';
const realPersona = (c, w) => (c && w !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: getWeapon(w).id } : c?.ai.persona);
const W = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const sets = [[40, 1, ['margarethe', 'isolde', 'heinrich', 'liao', 'artoria', 'omari', 'tome', 'eira']], [24, 101, ['minami', 'roland', 'silver_wanderer', 'bernardo', 'chanda', 'white_scale', 'julia', 'liao']]];
const lists = {}; const fights = {};
for (const [N, S0, CH] of sets) for (let seed = S0; seed < S0 + N; seed++) {
  const i = seed - 1; const wP = W[i % 10], wE = W[(i * 3 + 5) % 10];
  const ch = CHARACTERS_BY_ID[CH[i % CH.length]], pc = CHARACTERS_BY_ID[CH[(i + 3) % CH.length]];
  const G = newRound({ walls: true, seed, weapon: wP, weapon2: wE, look: pc.look ?? LOOKS.player, look2: ch.look, revive: ch.revive, persona: realPersona(ch, wE), difficulty: ch.ai.level, AI2Class: AI, persona2: realPersona(pc, wP) });
  for (const a of [G.ai, G.ai2]) { const tr = a.art?.tradition ?? '?'; (lists[tr] ??= new Set()); for (const t of a.school.tech) lists[tr].add(t.name); fights[tr] = (fights[tr] || 0) + 1; }
  G.world.free();
}
const C = {}; for (const f of process.argv.slice(2)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')).C)) C[k] = (C[k] || 0) + v;
for (const tr of Object.keys(lists).sort()) {
  const all = [...lists[tr]]; const never = all.filter((n) => !C[`tech.start.${tr}.${n}`]);
  const started = all.reduce((s, n) => s + (C[`tech.start.${tr}.${n}`] || 0), 0);
  console.log(`${tr}: AI 자리 ${fights[tr]} · 기술 ${all.length}개 · 시작 ${started}번 · 한 번도 시작 안 됨 ${never.length}: ${never.join(', ') || '-'}`);
}
