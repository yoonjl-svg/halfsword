// 숙련 4 거울(칸 같음 · 높음) — X 쪽에만 값 덮기 · node fx2.mjs <name> <seeds> <out> '<json level>' [vitality]
import { writeFileSync } from 'node:fs';
const R = '/home/user/halfsword/.tmp/wk-parry-fast';
const H = await import(`${R}/tools/sim/harness_m.mjs`);
const M = await import(`${R}/tools/sim/prof_gap_measure.mjs`);
const { WEAPONS } = await import(`${R}/tools/sim/ai_ring_measure.mjs`);
const [name, seedsN, out, lvJson, vit] = process.argv.slice(2);
const lv = JSON.parse(lvJson || '{}');
const rows = [];
for (const school of M.SCHOOLS) for (const [wi, weapon] of WEAPONS[school].entries()) for (let seed = 1; seed <= +seedsN; seed++) for (const swap of [false, true]) {
  const pX = { proficiency: 4, ...(Object.keys(lv).length ? { level: lv } : {}) }, pY = { proficiency: 4 };
  const g = H.newRound({ seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: H.AI, difficulty: 'hard', difficulty2: 'hard', persona: swap ? pX : pY, persona2: swap ? pY : pX });
  const X = swap ? g.enemy : g.player, Y = swap ? g.player : g.enemy;
  if (vit) X.vitality = +vit;
  let xW = 0, yW = 0;
  g.onWound = (a, v, r) => { if (!(r.severity > 0)) return; if (a === X) xW++; else if (a === Y) yW++; };
  const dead = (f) => !f.alive || f.state === 'dead';
  while (g.t < 60 && !dead(X) && !dead(Y)) g.step();
  rows.push({ name, school, res: dead(Y) && !dead(X) ? 'x' : dead(X) && !dead(Y) ? 'y' : 'd', xW, yW });
  g.world.free();
}
writeFileSync(out, JSON.stringify(rows));
