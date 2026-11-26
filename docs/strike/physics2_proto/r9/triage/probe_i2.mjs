// probe (i2): ringRun's setup (gap 0.85, seed 4, german kit, AI off) — chest distance and blade-blade contact during the start hold, every 0.1 s
const T = process.argv[2];
const { newRound, CONFIG } = await import(T + '/tools/sim/harness_m.mjs');
const { kitFromNodes, allNodeIds } = await import(T + '/src/skill_tree_data.js');
CONFIG.DE_DIRTY.ring = 1;
const G = newRound({ weapon: 'longsword', seed: 4, gap: 0.85, kit: kitFromNodes('german', allNodeIds('german')), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
G.ai.update = () => {};
G.player.canShove = true;
const out = [];
const N = Math.round((CONFIG.ARENA.startHold + 0.4) / CONFIG.PHYSICS.timestep);
for (let i = 0; i < N; i++) { G.step(); if (i % 12 === 0 || i === N - 1) { const a = G.player.bodies.pelvis.translation(), b = G.enemy.bodies.pelvis.translation(); out.push([+(i * CONFIG.PHYSICS.timestep).toFixed(2), +G.player.foeDistance().toFixed(3), +a.x.toFixed(2), +b.x.toFixed(2), G.clashes ?? null]); } }
console.log('startHold', CONFIG.ARENA.startHold, JSON.stringify(out));
process.exit(0);
