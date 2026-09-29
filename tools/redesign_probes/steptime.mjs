// 물리 스텝 시간: 모의 1초당 CPU ms (AI 대 AI 3판 × 10초). 실행: node tools/redesign_probes/steptime.mjs (저장소 루트에서)
//  env DTX=2 (1/240 스텝), SWEPT=0|1 (config.js STRIKE.sweep 끔/켬. 주지 않으면 설정 기본값)
const X = +(process.env.DTX || 1);
const CFG = await import('../../src/config.js');
if (process.env.SWEPT != null) CFG.STRIKE.sweep = !!+process.env.SWEPT;
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
console.log(`DTX ${X} SWEPT ${CFG.STRIKE.sweep}: ${(tot / n).toFixed(0)} ms CPU per simulated second (${(tot / n / 10).toFixed(1)}% of one core)`);
