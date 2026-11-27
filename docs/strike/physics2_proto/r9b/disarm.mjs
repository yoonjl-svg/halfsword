// 칼 놓친 싸움 (T2 재기 판): fights12 와 같은 판 · 씨앗 1 ~ 6 · 1 s 에 한쪽(홀수 씨앗 player · 짝수 enemy)이 칼을 놓침 · 20 s. 놓친 쪽은 AI 그대로(줍기 · 맨손)
//  ROOT=<나무> node disarm.mjs
const root = process.env.ROOT;
const { newRound, DT, AI } = await import(root + '/tools/sim/jelly_harness.mjs');
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
for (let seed = 1; seed <= 6; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed });
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  const F = seed % 2 ? P : E;
  let rearmed = 0, was = true;
  for (let i = 0; i < 20 / DT; i++) {
    if (Math.abs(i * DT - 1) < DT / 2) F.dropSword();
    G.step();
    if (F.armed && !was) rearmed++;
    was = F.armed;
  }
  console.log(`seed ${seed}: ${P.state}/${E.state} · 놓친 쪽 ${F === P ? 'P' : 'E'} 다시 쥠 ${rearmed}`);
}
