// 플랑베르주 간격 줄 (10/29 — config.js WEAPON_MEASURE.flamberge · docs/strike/flamberge_measure_2026-10-29.md · 확인표 2900 ~ 2903)
//  판 줄은 츠바이핸더보다 조금 길다(가장 긴 몬탄테 칼) · 다른 무기 줄은 손대지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';

test('geo (사장님 10/29 17:5x) — 칼 길이대로 다시 매긴 줄', () => {
  assert.deepEqual(MEASURED.flamberge, [1.74, 2.09, 1.35, 0.77]);
  assert.equal(CUT_TIME_30.flamberge, 0.57);
});

test('판 줄 — 츠바이핸더보다 길고(맞닿기 · 칼끝 거리) 붙음 < 맞닿기 < 칼끝 거리 · 츠바이핸더 × 손 ~ 칼끝 비', () => {
  const zw = MEASURED.zweihander;
  const row = MEASURED.flamberge, cut = CUT_TIME_30.flamberge;
  assert.ok(row[0] > zw[0] && row[0] - zw[0] < 0.15, `contact ${row[0]} vs 츠바이핸더 ${zw[0]}`);
  assert.ok(row[1] > zw[1], `reach ${row[1]} vs 츠바이핸더 ${zw[1]}`);
  assert.ok(row[2] < row[0] && row[0] < row[1], '차례');
  assert.ok(cut >= CUT_TIME_30.zweihander, `베는 시간 ${cut} ≥ 츠바이핸더 ${CUT_TIME_30.zweihander} (늦은 베기)`);
  const k = 1.385 / 1.335;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(row[i] - zw[i] * k) < 0.006, `geo ${i}`);
});

test('다른 무기 줄은 판과 상관없음', () => {
  assert.deepEqual(MEASURED.zweihander, [1.68, 2.01, 1.30, 0.47]);
  assert.deepEqual(MEASURED.tizona, [1.62, 1.91, 1.29, 0.53]);
  assert.deepEqual(MEASURED.durandal, [1.69, 1.91, 1.34, 0.42]);
  assert.deepEqual(MEASURED.longsword, [1.57, 1.8, 1.25, 0.41]);
});
