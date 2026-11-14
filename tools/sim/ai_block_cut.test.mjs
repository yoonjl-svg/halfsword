// AI 막는 동안 피해 감소 시제품 시험 (11/15 사장님 '동방의 장점은 막을 때 피해 50% 감소인데 막기를 잘 활용 못하는 거 아닐까? …' · src/ai_block_cut.js ·
//  config SKILL.aiParryCut · 기록 docs/strike/cn_block_2026-11-15.md): 기본 끔 · 끄면 AI 판이 바이트 같음 · 사람 막기 단추와 같은 유파 몫 · 막는 중(칼로 받기)만 ·
//  켜도 독일끼리(롱소드) 판은 그대로. 시간 상한 기준은 없다.  node --test tools/sim/ai_block_cut.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { aiWoundKeep, schoolParryCut } from '../../src/ai_block_cut.js';

const S = CONFIG.SKILL;
function withSkill(over, fn) {
  const keep = { ...S };
  Object.assign(S, over);
  try {
    return fn();
  } finally {
    Object.assign(S, keep);
  }
}
/** AI 둘 판 — 몸 자리 · 피를 30 스텝마다 */
function trace({ weapon = 'longsword', weapon2 = 'qinggang', secs = 8, seed = 1 } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  G.world.free();
  return out.join(';');
}
const body = (tradition, mode = 'defend', defVoid = false) => ({ aiCtl: { mode, defVoid }, swordArt: { tradition } });

test('기본 켬(사장님 11/15) · 끄면 AI 판은 유파 몫 값을 안 읽음 (바이트 같음)', () => {
  assert.equal(S.aiParryCut, 1, '사장님 11/15 결정 — 동방 ai 막기 감소 켜');
  const a = withSkill({ aiParryCut: 0 }, () => trace());
  const b = withSkill({ aiParryCut: 0, cnParryDmgCut: 0.9, jpParryDmgCut: 0.9, ibParryDmgCut: 0.9 }, () => trace());
  assert.equal(a, b);
});

test('사람 막기 단추와 같은 유파 몫 · 막는 중(칼로 받기)만 · 피하기 · 공격 · 다른 유파는 1', () => {
  assert.equal(schoolParryCut('chinese'), S.cnParryDmgCut);
  assert.equal(schoolParryCut('japanese'), S.jpParryDmgCut);
  assert.equal(schoolParryCut('iberian'), S.ibParryDmgCut);
  for (const t of ['german', 'italian', 'none']) assert.equal(schoolParryCut(t), 0, t);
  assert.equal(aiWoundKeep(body('chinese')), 1 - S.cnParryDmgCut);
  assert.equal(aiWoundKeep(body('japanese')), 1 - S.jpParryDmgCut);
  assert.equal(aiWoundKeep(body('iberian')), 1 - S.ibParryDmgCut);
  assert.equal(aiWoundKeep(body('chinese', 'defend', true)), 1, '물러나 피하기는 막기가 아님');
  assert.equal(aiWoundKeep(body('chinese', 'attack')), 1);
  assert.equal(aiWoundKeep(body('chinese', 'watch')), 1);
  assert.equal(aiWoundKeep(body('german')), 1);
  assert.equal(aiWoundKeep({ swordArt: { tradition: 'chinese' } }), 1, 'AI 몸이 아님');
});

test('켜도 롱소드끼리 판은 그대로 (독일 — 감소 없음) · 켜면 동방 AI 판은 달라질 수 있음', () => {
  const a = trace({ weapon: 'longsword', weapon2: 'longsword', secs: 10 });
  const b = withSkill({ aiParryCut: 1 }, () => trace({ weapon: 'longsword', weapon2: 'longsword', secs: 10 }));
  assert.equal(a, b);
});
