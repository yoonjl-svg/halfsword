// 이탈리아 무기 간격 — 찌르기 잣대 시험 (10/25 — 파펜하이머 들임 중 '간격 생성기가 이탈리아 무기를 못 잼' · docs/strike/italian_measure_2026-10-25.md):
//  간격 생성기(weapon_measure.mjs measureAll — 분노의 베기)는 이탈리아 자세표 무기를 사람 팔 범위(JOINTS.swivelHuman) 뒤 0.83 처럼 깨진 값으로 잰다.
//  이탈리아 유파 무기는 찌르기 잣대(measureThrust — 3번 자세 탭 찌르기 · 칼날 70 % 지점 · 같은 실행 롱소드 찌르기 비율)로 잰다 — 손 표(weapon_measured.js)가 그 비율인지,
//  잣대가 팔 두 판에서 같은지, 분노의 베기 잣대가 그대로 재는 한손 무기(세이버)에서 손 표와 맞는지 본다.
//  node --test tools/sim/italian_measure.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { measureThrust, rulerOf } from './weapon_measure.mjs';
import { MEASURED, CUT_TIME_30, ITALIAN_ZORNHAU } from '../../src/weapon_measured.js';

const { JOINTS, ARENA, THRUST } = CONFIG;
const withSets = (L, fn) => {
  const old = L.map(([o, k]) => o[k]);
  L.forEach(([o, k, v]) => (o[k] = v));
  try {
    return fn();
  } finally {
    L.forEach(([o, k], i) => (o[k] = old[i]));
  }
};
const HOLD0 = [[ARENA, 'startHold', 0]]; // 생성기 실행과 같은 조건 (with_config ARENA.startHold=0)
const LS = MEASURED.longsword;
const IT = ['rapier', 'dartagnan', 'balisarda'];

test('잣대 고르기: 이탈리아 유파 무기만 찌르기 · 나머지는 분노의 베기 · 강제 둘', () => {
  for (const id of IT) assert.equal(rulerOf(id), 'thrust', id);
  for (const id of ['longsword', 'sabre', 'falchion', 'qinggang', 'estoc', 'zweihander']) assert.equal(rulerOf(id), 'zornhau', id);
  assert.equal(rulerOf('rapier', 'zornhau'), 'zornhau');
  assert.equal(rulerOf('sabre', 'thrust'), 'thrust');
});

test("손 표 이탈리아 줄 = 찌르기 잣대 비율 × 롱소드 손 값 (contact · reach · clinch 0.005 안 · 베는 시간 0.01 안) — 옛 줄은 ITALIAN_ZORNHAU", { skip: THRUST.itMeasure === 'old' }, () => {
  withSets(HOLD0, () => {
    const L = measureThrust('longsword');
    for (const id of IT) {
      const m = measureThrust(id);
      const k = m.raw / L.raw;
      const kt = m.cutTime / L.cutTime;
      const row = MEASURED[id];
      const msg = `${id}: 비율 ${k.toFixed(4)} → ${(LS[0] * k).toFixed(3)} / ${(LS[1] * k).toFixed(3)} / ${(LS[2] * k).toFixed(3)} · 손 표 ${row.join(' / ')}`;
      assert.ok(Math.abs(row[0] - LS[0] * k) < 0.005, msg);
      assert.ok(Math.abs(row[1] - LS[1] * k) < 0.005, msg);
      assert.ok(Math.abs(row[2] - LS[2] * k) < 0.005, msg);
      assert.ok(Math.abs(row[3] - LS[3] * kt) < 0.01, `${msg} · 시간 비 ${kt.toFixed(3)}`);
      assert.ok(Math.abs(CUT_TIME_30[id] - 0.3 * kt) < 0.01, `${id} CUT_TIME_30 ${CUT_TIME_30[id]} · 0.30 × ${kt.toFixed(3)}`);
      assert.ok(ITALIAN_ZORNHAU.MEASURED[id] && ITALIAN_ZORNHAU.CUT_TIME_30[id] != null, `${id} 옛 줄`);
    }
  });
});

test('찌르기 잣대는 팔 두 판(사람 팔 범위 swivelHuman · 엎친 손 wristPronate 켬 · 끔)에서 0.02 m 안으로 같다 — 분노의 베기 잣대처럼 팔 규칙에 깨지지 않음', () => {
  withSets(HOLD0, () => {
    const now = measureThrust('rapier').raw;
    const old = withSets([[JOINTS, 'swivelHuman', 0], [JOINTS, 'wristPronate', 0]], () => measureThrust('rapier').raw);
    assert.ok(Math.abs(now - old) < 0.02, `레이피어 70 % 지점 지금 ${now.toFixed(3)} · 전 팔 ${old.toFixed(3)} m`);
  });
});

test('맞춰 봄: 분노의 베기 잣대가 그대로 재는 세이버는 찌르기 잣대로도 손 표 contact 와 0.06 m 안', () => {
  withSets(HOLD0, () => {
    const k = measureThrust('sabre').raw / measureThrust('longsword').raw;
    assert.ok(Math.abs(LS[0] * k - MEASURED.sabre[0]) < 0.06, `세이버 찌르기 잣대 ${(LS[0] * k).toFixed(3)} · 손 표 ${MEASURED.sabre[0]}`);
  });
});
