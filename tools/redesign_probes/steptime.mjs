const X = +(process.env.DTX || 1);
if (process.env.SWEPT) globalThis.__SWEPT = 1;
const CFG = await import('/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/exp/src/config.js');
CFG.PHYSICS.timestep = 1 / (120 * X);
const H = await import('/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/exp/tools/sim/harness_m.mjs');
let tot = 0, n = 0;
for (let s = 0; s < 3; s++) {
  const G = H.newRound({ seed: 200 + s, AI2Class: H.AI });
  G.world.timestep = CFG.PHYSICS.timestep;
  const steps = Math.round(10 * 120 * X);
  const t0 = performance.now();
  for (let k = 0; k < steps; k++) G.step();
  tot += performance.now() - t0; n += 10;
}
console.log(`DTX ${X} SWEPT ${!!process.env.SWEPT}: ${(tot / n).toFixed(0)} ms CPU per simulated second (${(tot / n / 10).toFixed(1)}% of one core)`);
