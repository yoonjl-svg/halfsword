// guard_hold.mjs <checkout> [seeds=1..16] [weapon=longsword]
// Audit check for the re-seeded test "실제 칼 충돌을 상대 공격당 한 번의 막기 비용으로 셈" (tools/sim/stamina_integration.test.mjs).
// Same setup as that test: the player holds the guard button for 20 game seconds against the AI. Per seed it prints
// blade clashes, AI attacks started, attacks charged as a block, wounds the player took, and how long the player lived.
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { newRound, DT } = await import(u('tools/sim/harness_m.mjs'));
const { PlayerParryGuard } = await import(u('src/parry_button.js'));
const seeds = (process.argv[3] ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16').split(',').map(Number); const weapon = process.argv[4] ?? 'longsword';
const tot = { clashes: 0, attacks: 0, blocks: 0, wounds: 0, sev: 0, died: 0 };
for (const seed of seeds) {
  const g = newRound({ weapon, seed });
  const guard = new PlayerParryGuard(g.player, g.enemy); g.player.stamina.controller = guard; guard.held = true; g.before = () => guard.step(DT);
  let attacks = 0, lastId = g.enemy.stamina.attackId, i = 0;
  for (; i < 2400 && g.player.alive; i++) { g.step(); const id = g.enemy.stamina.attackId; if (id !== lastId) { attacks++; lastId = id; } }
  const w = g.wounds.filter((x) => x.vic === g.player); const sev = w.reduce((a, x) => a + (x.severity ?? 0), 0);
  const blocks = g.player.stamina.counts.block;
  console.log(`seed ${String(seed).padStart(2)}: clashes ${String(g.clashes).padStart(4)} · AI attacks ${String(attacks).padStart(2)} · charged as block ${String(blocks).padStart(2)} · wounds taken ${String(w.length).padStart(2)} (severity ${sev.toFixed(1)}) · ${g.player.alive ? 'alive 20.0 s' : 'down at ' + (i * DT).toFixed(1) + ' s'}`);
  tot.clashes += g.clashes; tot.attacks += attacks; tot.blocks += blocks; tot.wounds += w.length; tot.sev += sev; tot.died += g.player.alive ? 0 : 1;
  g.world.free();
}
console.log(`TOTAL ${seeds.length} seeds: clashes ${tot.clashes} · AI attacks ${tot.attacks} · charged as block ${tot.blocks} (${(100 * tot.blocks / Math.max(1, tot.attacks)).toFixed(0)} % of attacks) · wounds taken ${tot.wounds} (severity ${tot.sev.toFixed(1)}) · player down in ${tot.died}`);
