// 전체 빠르기 손잡이 `?tempo=` (10/10) 부담 어림: 게임과 같은 판(롱소드 AI 둘, 벽)에서 물리 한 스텝(AI 둘 + 두 몸 + world.step + combat) ms 를 재고
//  tempo 마다 실제 1 초 스텝 수(120 × tempo) · 1 초 물리 ms · 60 fps 한 프레임 물리 ms · 프레임당 스텝 상한(PHYSICS.maxStepsPerFrame) 안인지 적는다.
//  그리기·소리는 빼고 물리만. 이 기계(노드) 기준이라 폰은 몇 배 느리다 — tempo 1 대비 배율로 읽는다. 실행: node tools/sim/tempo_step_cost.mjs [판 초 20]
import { newRound, DT, AI, CONFIG } from './jelly_harness.mjs';
const secs = +(process.argv[2] || 20);
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
let ms = 0;
let n = 0;
for (let seed = 1; seed <= 3; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed });
  G.player.skill.level = 0.7;
  G.ai2 = new AI(G.player, G.enemy, 'normal');
  for (let i = 0; i < secs / DT; i++) {
    const t = performance.now();
    G.step();
    ms += performance.now() - t;
    n++;
  }
}
const per = ms / n;
const cap = CONFIG.PHYSICS.maxStepsPerFrame;
const rows = [1, 1.35, 1.5, 1.7].map((tempo) => {
  const sps = 120 * tempo;
  const perFrame60 = sps / 60;
  return `| ${tempo} | ${sps.toFixed(0)} | ${(sps * per).toFixed(0)} ms (${((sps * per) / 10).toFixed(1)} %) | ${perFrame60.toFixed(2)} 스텝 · ${(perFrame60 * per).toFixed(2)} ms | ${(120 * tempo / 30).toFixed(1)} 스텝 (30 fps 기기${120 * tempo / 30 > cap ? ' — 상한 ' + cap + ' 넘음' : ''}) |`;
});
console.log(`스텝 한 번 ${per.toFixed(3)} ms (n ${n})`);
console.log('| tempo | 1 초 스텝 | 1 초 물리 ms (한 코어 몫) | 60 fps 한 프레임 | 30 fps 한 프레임 |');
console.log('|---|---|---|---|---|');
console.log(rows.join('\n'));
