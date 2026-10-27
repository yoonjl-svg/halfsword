// 이탈리아 무기 간격 — 찌르기 잣대 시험 (10/25 — 파펜하이머 들임 중 '간격 생성기가 이탈리아 무기를 못 잼' · docs/strike/italian_measure_2026-10-25.md):
//  간격 생성기(weapon_measure.mjs measureAll — 분노의 베기)는 이탈리아 자세표 무기를 깨진 값으로 잰다(대본 베기 — 기록 §2).
//  이탈리아 유파 무기는 찌르기 잣대(measureThrust — 3번 자세 탭 찌르기 · 칼날 70 % 지점 · 같은 실행 롱소드 찌르기 비율)로 잰다 — 찌르기 잣대 줄(ITALIAN_THRUST)이 그 비율인지,
//  판 스위치 THRUST.itMeasure 세 판('old' 지금 판 · 'contact' 맞닿음만 · 'full' 줄 통째)이 손 표에 맞게 들어가는지, 리솔루토가 'contact' 판에서 지금 맞닿음을 쓰는지,
//  잣대가 팔 두 판에서 같은지, 분노의 베기 잣대가 그대로 재는 한손 무기(세이버)에서 손 표와 맞는지 본다.
//  node --test tools/sim/italian_measure.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { measureThrust, rulerOf } from './weapon_measure.mjs';
import { MEASURED, CUT_TIME_30, ITALIAN_NOW, ITALIAN_THRUST, italianMeasureRows, risolutoContact } from '../../src/weapon_measured.js';

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
// 생성기 실행과 같은 조건 (with_config ARENA.startHold=0) · 줄을 잰 10/25 판의 과녁 몸 AI 반응(AI_REACT.face) 게임 0.2 s —
//  표준 시간(10/25 22:3x) 뒤 그 값이 실제 0.2 s(게임 0.22)라 서 있는 과녁 몸이 도는 늦음이 달라져 롱소드 잣대가 5 mm 짧게 재진다(비율 0.35 %).
//  잰 값(ITALIAN_THRUST 줄)은 그대로 두고(docs/strike/time_standard_2026-10-25.md §2 '잰 값') 이 시험은 잰 때의 조건으로 생성기를 돌린다
const HOLD0 = [[ARENA, 'startHold', 0], [CONFIG.AI_REACT, 'face', 0.2]];
const IT = ['rapier', 'dartagnan', 'balisarda', 'pappenheimer'];

test('잣대 고르기: 이탈리아 유파 무기(파펜하이머 포함)만 찌르기 · 나머지는 분노의 베기 · 강제 둘', () => {
  for (const id of IT) assert.equal(rulerOf(id), 'thrust', id);
  for (const id of ['longsword', 'sabre', 'falchion', 'qinggang', 'estoc', 'zweihander']) assert.equal(rulerOf(id), 'zornhau', id);
  assert.equal(rulerOf('rapier', 'zornhau'), 'zornhau');
  assert.equal(rulerOf('sabre', 'thrust'), 'thrust');
});

test('판 스위치 세 판: old = 지금 줄 그대로 · contact = 맞닿음만 찌르기 잣대 · full = 줄 통째 (리솔루토는 contact 판에서 지금 맞닿음)', () => {
  for (const id of IT) {
    const now = ITALIAN_NOW.MEASURED[id], thr = ITALIAN_THRUST.MEASURED[id];
    const o = italianMeasureRows('old')[id], c = italianMeasureRows('contact')[id], f = italianMeasureRows('full')[id];
    assert.deepEqual(o.row, now, `${id} old`);
    assert.equal(o.cut, ITALIAN_NOW.CUT_TIME_30[id]);
    assert.deepEqual(c.row, [thr[0], now[1], now[2], now[3]], `${id} contact`);
    assert.equal(c.cut, ITALIAN_NOW.CUT_TIME_30[id]);
    assert.deepEqual(f.row, thr, `${id} full`);
    assert.equal(f.cut, ITALIAN_THRUST.CUT_TIME_30[id]);
    const live = italianMeasureRows(THRUST.itMeasure)[id];
    assert.deepEqual(MEASURED[id], live.row, `${id} 손 표 = 지금 판(${THRUST.itMeasure})`);
    assert.equal(CUT_TIME_30[id], live.cut);
    assert.equal(risolutoContact(id, 'contact'), now[0], `${id} contact 판 리솔루토 = 지금 맞닿음`);
    assert.equal(risolutoContact(id, 'old'), null);
    assert.equal(risolutoContact(id, 'full'), null);
  }
});

test('찌르기 잣대 줄 = 같은 실행 롱소드 찌르기 비율 × 롱소드 손 값 (contact · reach · clinch 0.005 안 · 베는 시간 0.01 안)', () => {
  withSets(HOLD0, () => {
    const L = measureThrust('longsword');
    const LS = MEASURED.longsword;
    for (const id of IT) {
      const m = measureThrust(id);
      const k = m.raw / L.raw;
      const kt = m.cutTime / L.cutTime;
      const row = ITALIAN_THRUST.MEASURED[id];
      const msg = `${id}: 비율 ${k.toFixed(4)} → ${(LS[0] * k).toFixed(3)} / ${(LS[1] * k).toFixed(3)} / ${(LS[2] * k).toFixed(3)} · 줄 ${row.join(' / ')}`;
      assert.ok(Math.abs(row[0] - LS[0] * k) < 0.005, msg);
      assert.ok(Math.abs(row[1] - LS[1] * k) < 0.005, msg);
      assert.ok(Math.abs(row[2] - LS[2] * k) < 0.005, msg);
      assert.ok(Math.abs(row[3] - LS[3] * kt) < 0.01, `${msg} · 시간 비 ${kt.toFixed(3)}`);
      assert.ok(Math.abs(ITALIAN_THRUST.CUT_TIME_30[id] - 0.3 * kt) < 0.01, `${id} CUT_TIME_30 ${ITALIAN_THRUST.CUT_TIME_30[id]} · 0.30 × ${kt.toFixed(3)}`);
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
    assert.ok(Math.abs(MEASURED.longsword[0] * k - MEASURED.sabre[0]) < 0.06, `세이버 찌르기 잣대 ${(MEASURED.longsword[0] * k).toFixed(3)} · 손 표 ${MEASURED.sabre[0]}`);
  });
});
