// 독일 G6 무릎 꺾기 뒤 끝내기 시험 (11/19 — 사장님 '권고대로' · 기록 docs/strike/de_band3_2026-11-19.md §G6 · src/ai_plan_de.js deKnee)
//  내 곁눈 베기가 꺾은 무릎(foe.buckleAt 이 바뀜)을 늦게 본 모습으로 보면 곧장 '끝내기' 공격 — 한 꺾음에 한 번 · 다시 선 모습을 보면 끝
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { deKnee } from '../../src/ai_plan_de.js';

const { AI_PROFICIENCY } = CONFIG;

test('꺾음을 본 뒤 꿇은 모습이면 곧장 끝내기 · 한 꺾음에 한 번 · 선 모습이면 끝', () => {
  const G = newRound({ seed: 5, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, difficulty: AI_PROFICIENCY.levels[2], difficulty2: AI_PROFICIENCY.levels[3], persona: { proficiency: 2 }, persona2: { proficiency: 3 } });
  for (let i = 0; i < 300; i++) G.step(); // 판 시작 정지가 풀릴 때까지
  const ai = G.ai2;
  assert.ok(ai.planDe && ai.deKnee, '독일 플랜 몸');
  const s = { ...ai.sense.seen(0) };
  const near = Math.min(ai.d, ai.holdDist());
  assert.equal(deKnee(ai, { ...s, state: 'stand' }, near), false, '꺾음 없음');
  assert.equal(ai.stats.plan.de.knee, 0);
  ai.foe.buckleAt = 1.23;
  assert.equal(deKnee(ai, { ...s, state: 'stand' }, near), false, '아직 꿇은 모습을 못 봄 (반응 지연)');
  assert.equal(ai.stats.plan.de.knee, 1);
  assert.equal(deKnee(ai, { ...s, state: 'getup' }, ai.holdDist() + ai.watchReachOut() + 0.5), false, '칠 거리 밖');
  ai.mode = 'watch';
  ai.staminaRest = false;
  assert.equal(deKnee(ai, { ...s, state: 'getup' }, near), true, '꿇은 모습 → 끝내기');
  assert.equal(ai.mode, 'attack');
  assert.equal(ai.why, 'finish');
  assert.equal(ai.stats.plan.de.kneeGo, 1);
  assert.equal(deKnee(ai, { ...s, state: 'getup' }, near), false, '한 꺾음에 한 번');
  ai.foe.buckleAt = 2.5; // 새 꺾음
  assert.equal(ai.deKnee.live, false);
  deKnee(ai, { ...s, state: 'getup' }, ai.holdDist() + ai.watchReachOut() + 0.5);
  assert.equal(ai.deKnee.live, true);
  assert.equal(deKnee(ai, { ...s, state: 'stand' }, near), false, '다시 선 모습 → 그 꺾음 끝');
  assert.equal(ai.deKnee.live, false);
  G.world.free();
});
