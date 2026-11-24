// pair_restitution.mjs <checkout>
// Audit check: what restitution do blade colliders carry while apart, which combine rule they use, and what the pair value is
// for blade-blade and blade-helmet. Rapier combine rule codes: 0 Average · 1 Min · 2 Multiply · 3 Max (the higher code of the two colliders wins).
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { newRound, CONFIG } = await import(u('tools/sim/harness_m.mjs'));
const { WEAPONS } = await import(u('src/weapons.js')).catch(() => ({}));
const ids = WEAPONS ? Object.keys(WEAPONS) : ['longsword'];
const rows = [];
for (const weapon of ids) {
  let g; try { g = newRound({ weapon, weapon2: 'longsword', seed: 3, walls: false }); } catch (e) { rows.push(`${weapon}: (skipped — ${String(e.message).slice(0, 40)})`); continue; }
  g.step();
  const cs = g.player.swordColliders ?? []; if (!cs.length) { rows.push(`${weapon}: no blade colliders`); g.world.free(); continue; }
  const es = cs.map((c) => +c.restitution().toFixed(3)); const rules = [...new Set(cs.map((c) => c.restitutionCombineRule()))];
  const foe = g.enemy.swordColliders.map((c) => +c.restitution().toFixed(3));
  const pair = [...new Set(es.map((e) => +(e * foe[0]).toFixed(3)))];
  rows.push(`${weapon.padEnd(16)} blade parts ${JSON.stringify([...new Set(es)])} · rule ${rules} · vs longsword blade (${foe[0]}) pair ${JSON.stringify(pair)}`);
  g.world.free();
}
console.log(`BIND.restitution ${CONFIG.BIND.restitution} · sqrt ${Math.sqrt(CONFIG.BIND.restitution).toFixed(3)}`);
console.log(rows.join('\n'));
