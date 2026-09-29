// 물리 스텝 시간: 모의 1초당 CPU ms (AI 대 AI 3판 × 10초). 실행: node tools/redesign_probes/steptime.mjs (저장소 루트에서)
//  env DTX=2 (1/240 스텝), SWEPT=1 (실험판 src 필요: exp_src.patch 의 __SWEPT 훅 — 여기서는 적용하지 않았다)
const X = +(process.env.DTX || 1);
if (process.env.SWEPT) globalThis.__SWEPT = 1;
const CFG = await import('../../src/config.js');
CFG.PHYSICS.timestep = 1 / (120 * X);
const H = await import('../sim/harness_m.mjs');
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
