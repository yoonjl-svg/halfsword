// AI 막는 동안 피해 감소 시험 (11/15 사장님 '동방의 장점은 막을 때 피해 50% 감소인데 막기를 잘 활용 못하는 거 아닐까? …' → '동방 ai 막기 감소 켜' · src/ai_block_cut.js ·
//  기록 docs/strike/cn_block_2026-11-15.md): 늘 켬 · 사람 막기 단추와 같은 유파 몫 · 막는 중(칼로 받기)만 ·
//  독일끼리(롱소드) 판은 유파 몫 값을 안 읽음. 시간 상한 기준은 없다.  node --test tools/sim/ai_block_cut.test.mjs
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

test('사람 막기 단추와 같은 유파 몫 · 막는 중(칼로 받기)만 · 피하기 · 공격 · 다른 유파는 1', () => {
  assert.equal(schoolParryCut('chinese'), S.cnParryDmgCut);
  for (const t of ['japanese', 'iberian', 'german', 'italian', 'none']) assert.equal(schoolParryCut(t), 0, t); // 일본 · 이베리아 0.2 는 11/15 사장님 결정으로 없앰 (칸은 11/21 지움)
  assert.equal(aiWoundKeep(body('chinese')), 1 - S.cnParryDmgCut);
  assert.equal(aiWoundKeep(body('japanese')), 1);
  assert.equal(aiWoundKeep(body('iberian')), 1);
  assert.equal(aiWoundKeep(body('chinese', 'defend', true)), 1, '물러나 피하기는 막기가 아님');
  assert.equal(aiWoundKeep(body('chinese', 'attack')), 1);
  assert.equal(aiWoundKeep(body('chinese', 'watch')), 1);
  assert.equal(aiWoundKeep(body('german')), 1);
  assert.equal(aiWoundKeep({ swordArt: { tradition: 'chinese' } }), 1, 'AI 몸이 아님');
});

test('롱소드끼리 판은 유파 몫 값을 안 읽음 (독일 — 감소 없음 · 바이트 같음)', () => {
  const a = trace({ weapon: 'longsword', weapon2: 'longsword', secs: 10 });
  const b = withSkill({ cnParryDmgCut: 0.9 }, () => trace({ weapon: 'longsword', weapon2: 'longsword', secs: 10 }));
  assert.equal(a, b);
});
