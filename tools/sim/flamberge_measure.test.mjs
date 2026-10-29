// 플랑베르주 간격 줄 판 (10/29 — WEAPON_MEASURE.flambergeFix · docs/strike/flamberge_measure_2026-10-29.md · 확인표 2900 ~ 2903 · 사장님 확인 전)
//  기본 'off' 는 손 표 그대로 · 판 줄은 츠바이핸더보다 조금 길다(가장 긴 몬탄테 칼) · 다른 무기 줄은 손대지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON_MEASURE } from '../../src/config.js';
import { MEASURED, CUT_TIME_30, FLAMBERGE_NOW, flambergeMeasureRow } from '../../src/weapon_measured.js';

test('기본 geo (사장님 10/29 17:5x) — 칼 길이대로 다시 매긴 줄 · off 는 옛 손 표 줄', () => {
  assert.equal(WEAPON_MEASURE.flambergeFix, process.env.FL_MEASURE ?? 'geo');
  assert.deepEqual(flambergeMeasureRow('off'), { row: [1.91, 2.57, 1.52, 0.77], cut: 0.57 });
  if (WEAPON_MEASURE.flambergeFix !== 'geo') return;
  assert.deepEqual(MEASURED.flamberge, [1.74, 2.09, 1.35, 0.77]);
  assert.equal(CUT_TIME_30.flamberge, 0.57);
  assert.deepEqual(FLAMBERGE_NOW.row, [1.91, 2.57, 1.52, 0.77]); // 옛 손 표 줄은 비교용으로 남음
});

test('판 줄 — 츠바이핸더보다 길고(맞닿기 · 칼끝 거리) 붙음 < 맞닿기 < 칼끝 거리', () => {
  const zw = MEASURED.zweihander;
  for (const mode of ['geo', 'step', 'contact']) {
    const { row, cut } = flambergeMeasureRow(mode);
    assert.equal(row.length, 4, mode);
    assert.ok(row[0] > zw[0] && row[0] - zw[0] < 0.15, `${mode} contact ${row[0]} vs 츠바이핸더 ${zw[0]}`);
    assert.ok(row[1] > zw[1], `${mode} reach ${row[1]} vs 츠바이핸더 ${zw[1]}`);
    assert.ok(row[2] < row[0] && row[0] < row[1], `${mode} 차례`);
    assert.ok(cut >= CUT_TIME_30.zweihander, `${mode} 베는 시간 ${cut} ≥ 츠바이핸더 ${CUT_TIME_30.zweihander} (늦은 베기)`);
  }
  // (가) 기하 = 츠바이핸더 × 손 ~ 칼끝 비 1.385 / 1.335
  const k = 1.385 / 1.335;
  const g = flambergeMeasureRow('geo').row;
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(g[i] - zw[i] * k) < 0.006, `geo ${i}`);
  // (다) 칼끝 거리 · 베는 시간은 지금 그대로
  assert.equal(flambergeMeasureRow('contact').row[1], FLAMBERGE_NOW.row[1]);
  assert.equal(flambergeMeasureRow('contact').row[3], FLAMBERGE_NOW.row[3]);
});

test('다른 무기 줄은 판과 상관없음', () => {
  assert.deepEqual(MEASURED.zweihander, [1.68, 2.01, 1.30, 0.47]);
  assert.deepEqual(MEASURED.tizona, [1.62, 1.91, 1.29, 0.53]);
  assert.deepEqual(MEASURED.durandal, [1.69, 1.91, 1.34, 0.42]);
  assert.deepEqual(MEASURED.longsword, [1.57, 1.8, 1.25, 0.41]);
});
