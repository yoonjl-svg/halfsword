// probe (d): body of '실제 칼 충돌을 상대 공격당 한 번의 막기 비용으로 셈' (tools/sim/stamina_integration.test.mjs) over seeds
const T = process.argv[2];
const { newRound, DT } = await import(T + '/tools/sim/harness_m.mjs');
const { PlayerParryGuard } = await import(T + '/src/parry_button.js');
for (const s of process.argv.slice(3)) {
  const g = newRound({ weapon: 'longsword', seed: +s });
  const guard = new PlayerParryGuard(g.player, g.enemy); g.player.stamina.controller = guard; guard.held = true; g.before = () => guard.step(DT);
  let i = 0, firstClash = null, aiAtk = 0, prevMode = null;
  for (; i < 2400 && g.player.alive; i++) { g.step(); if (g.clashes > 0 && firstClash == null) firstClash = +(i * DT).toFixed(2); const m = g.ai.mode; if (m === 'attack' && prevMode !== 'attack') aiAtk++; prevMode = m; }
  const st = g.player.stamina;
  console.log(JSON.stringify({ seed: +s, clashes: g.clashes, block: st.counts.block, spentBlock: +st.spent.block.toFixed(1), spentAtk: st.spent.attack, alive: g.player.alive, t: +(i * DT).toFixed(2), firstClash, aiAttacks: aiAtk, hp: +(g.player.blood ?? 0).toFixed(2) }));
  g.world.free();
}
process.exit(0);
