// 동방 expert 막을 눈 시험 (11/19 — 사장님 '권고대로' · 기록 docs/strike/de_band3_2026-11-19.md §동방 · src/ai_plan_cn.js cnGuardChance)
//  expert 의 막을 눈 +0.1 은 격살을 노릴 마음이 난 위협(격살이 남음 · cnWant)에만 — 그 밖엔 hard 값 · expert 아닌 몸은 그대로(굴림 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { cnGuardChance } from '../../src/ai_plan_cn.js';

const { AI_LEVELS, AI_PROFICIENCY } = CONFIG;

/** 판을 만들고 시작 정지를 지난 뒤 동방(환도) AI 하나 — 숙련 prof · 실력 이름은 숙련 표 그대로 */
function cnAi(prof) {
  const G = newRound({ weapon: 'longsword', weapon2: 'hwando', seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  const ai = new AI(G.enemy, G.player, AI_PROFICIENCY.levels[prof], { proficiency: prof });
  return { G, ai };
}

function withRolls(vals, fn) {
  const rnd = Math.random;
  const R = { n: 0 };
  Math.random = () => vals[Math.min(R.n++, vals.length - 1)];
  try {
    return fn(R);
  } finally {
    Math.random = rnd;
  }
}

test('expert 동방: 격살을 노릴 위협만 expert 막을 눈 · 그 밖은 hard 값 · 같은 위협은 같은 답', () => {
  const { G, ai } = cnAi(6);
  assert.equal(ai.levelName, 'expert');
  assert.ok(ai.planCn, '동방 플랜');
  const hi = ai.level.guardChance;
  const lo = AI_LEVELS.hard.guardChance;
  assert.ok(hi > lo, 'expert 막을 눈이 hard 위');
  assert.equal(ai.secret?.when, 'gyeoksal', '숙련 6 동방 = 격살');
  assert.equal(withRolls([0], () => cnGuardChance(ai, { id: 11 }, hi)), hi, '마음이 남 (굴림 0)');
  assert.equal(withRolls([0.999], () => cnGuardChance(ai, { id: 11 }, hi)), hi, '같은 위협은 붙잡은 답');
  assert.equal(withRolls([0.999], () => cnGuardChance(ai, { id: 12 }, hi)), lo, '마음이 안 남 → hard 값');
  assert.equal(ai.stats.cn.gcWant, 2);
  assert.equal(ai.stats.cn.gcCut, 1);
  ai.secret = null; // 격살이 없는 몸 (다 썼거나 칸 없음)
  assert.equal(withRolls([0], (R) => [cnGuardChance(ai, { id: 13 }, hi), R.n]).join(), `${lo},0`, '격살 없음 → hard 값 · 굴림 없음');
  G.world.free();
});

test('expert 가 아닌 동방 몸은 막을 눈 그대로 · 굴림 없음', () => {
  const { G, ai } = cnAi(5);
  assert.notEqual(ai.levelName, 'expert');
  const gc = ai.level.guardChance;
  assert.equal(withRolls([0.5], (R) => [cnGuardChance(ai, { id: 3 }, gc), R.n]).join(), `${gc},0`);
  G.world.free();
});
