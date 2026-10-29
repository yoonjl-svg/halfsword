// 동방 잰 박자 (10/29 21:0x 사장님 '동방 박자도 바꾸고' — docs/strike/cn_cadence_2026-10-29.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHINESE_GAIT, setChineseGait, TRADITIONS } from '../../src/schools.js';

test('동방 걸음 칸: 보폭 규칙 k 0.75 · 전 판 스위치 0.9 · 독일은 칸 없음(k 1.0)', () => {
  assert.equal(CHINESE_GAIT.strideK, 0.75);
  assert.equal(TRADITIONS.chinese.gait, CHINESE_GAIT);
  assert.equal(TRADITIONS.german.gait?.strideK, undefined);
  try {
    setChineseGait('old');
    assert.equal(CHINESE_GAIT.strideK, 0.9);
  } finally {
    CHINESE_GAIT.strideK = 0.75;
  }
});
