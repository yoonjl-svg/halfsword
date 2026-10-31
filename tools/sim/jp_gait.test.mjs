// 일본 걸음 설계대로 (10/29 20:5x · 21:0x 사장님 '다른 유파보다 확연히 느려도 돼' — docs/strike/jp_gait_2026-10-29.md) · speedMul 0.70 (10/31 08:xx 사장님 '일본 바로잡아' — 전 0.67)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JAPANESE_GAIT, JAPANESE_GAIT_OLD, setJapaneseGait } from '../../src/schools.js';
import { newRound, DT } from './harness_m.mjs';

test('일본 걸음 칸: 보폭 규칙 밖 · 설계 박자 2.2 · 보폭 0.5 · 사람 칸은 trailReach 만 · speedMul 0.70 · settleStance · 전 판 스위치', () => {
  assert.equal(JAPANESE_GAIT.strideK, undefined);
  assert.equal(JAPANESE_GAIT.cadence0, 2.2);
  assert.equal(JAPANESE_GAIT.maxStride, 0.5);
  assert.deepEqual(JAPANESE_GAIT.player, { trailReach: 0.36 });
  assert.equal(JAPANESE_GAIT.speedMul, 0.7);
  assert.equal(JAPANESE_GAIT.settleStance, true);
  assert.deepEqual(JAPANESE_GAIT_OLD.player, { trailReach: 0.36, dsFrac: 0.18, lift: 0.05 });
  const keep = { ...JAPANESE_GAIT };
  try {
    setJapaneseGait('old');
    assert.equal(JAPANESE_GAIT.strideK, 0.8);
    assert.equal(JAPANESE_GAIT.speedMul, undefined);
    assert.equal(JAPANESE_GAIT.settleStance, undefined);
    setJapaneseGait(0.67); // `?jpWalk=0.67` = 10/30 판 빠르기
    assert.equal(JAPANESE_GAIT.speedMul, 0.67);
  } finally {
    for (const k of Object.keys(JAPANESE_GAIT)) delete JAPANESE_GAIT[k];
    Object.assign(JAPANESE_GAIT, keep);
  }
});

test('일본 서 있는 자세: 5 s 뒤 앞뒤 자세 길이 0.45 언저리 (전 판 0.31)', () => {
  const G = newRound({ walls: false, seed: 7, weapon: 'uchigatana', weapon2: 'longsword', gap: 20 });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  for (let i = 0; i < Math.round(5 / DT); i++) { P.move.set(0, 0); G.step(); }
  const g = P.gait, h = P.heading, fx = Math.cos(h), fz = -Math.sin(h);
  const L = Math.abs((g.legs.F.plant.x - g.legs.B.plant.x) * fx + (g.legs.F.plant.z - g.legs.B.plant.z) * fz);
  G.world.free();
  assert.ok(L > 0.39 && L < 0.51, `자세 길이 ${L.toFixed(3)}`);
});
