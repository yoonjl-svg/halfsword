// 걸음 공격 입력 읽기 시험 (11/05 — config UNIQUE_ASSIST.stepIn · stepStick · stepPre · stepPost · unique_assist.js stickOk · stickTick · stepLateTick · 기록 docs/strike/step_input_2026-11-05.md)
//  두 엄지 손(step_input_measure.mjs runTrials — 실제 Input 터치 · 실제 attachStick 스틱 원 · main.js 입력 차례 · 서 있는 상대)으로 독일 비껴 딛는 가로베기(옆 + 가로베기)를 낸다.
//  전 판(stepIn 0): 긋기 시작 스텝 한 순간의 스틱 · 문턱 0.5 → 스틱이 그 순간보다 늦거나 · 살짝 밀거나 · 밀었다 놓으면 기본 가로베기.
//  새 판(stepIn 1): 문턱 0.3 · 긋기 시작 전 0.2 s 안의 스틱 · 시작 뒤 0.2 s 안에 온 스틱 → 걸음 공격. 스틱 없는 긋기 · 긋고 0.35 s 뒤 비켜 걷기는 그대로 기본 가로베기.
//  node --test tools/sim/step_input.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { runTrials, stickValue } from './step_input_measure.mjs';
import { stickDir } from '../../src/unique_assist.js';

const UA = CONFIG.UNIQUE_ASSIST;
const tr = (kind, stick) => ({ kind, base: 'zwerch', stick });
// 시도들 (side 는 번갈아 — 몸이 한쪽으로 흐르지 않게)
const TRIALS = [
  tr('early', { dt: -0.15, a: 0.8, side: -1 }), // 스틱 먼저 · 끝까지 가깝게
  tr('late', { dt: 0.08, a: 0.8, side: 1 }), // 긋기가 0.08 s 먼저
  tr('soft', { dt: -0.15, a: 0.45, side: -1 }), // 살짝 민 엄지 (값 0.35)
  tr('flick', { dt: -0.25, a: 0.8, side: 1, flick: 0.12 }), // 밀었다 긋기 0.13 s 전에 놓음
  tr('plain', null), // 스틱 없음
  tr('away', { dt: 0.35, a: 0.8, side: -1, hold: 0.3 }), // 긋고 0.35 s 뒤 비켜 걷기
];
function run(stepIn) {
  const was = UA.stepIn;
  UA.stepIn = stepIn;
  try {
    return Object.fromEntries(runTrials('german', TRIALS, { seed: 3 }).map((r) => [r.kind, r]));
  } finally {
    UA.stepIn = was;
  }
}

test('기본값: 새 판 켬 · 문턱 0.3(걸음 사다리) · 앞뒤 창 0.2 실제 s(시간 사다리)', () => {
  assert.equal(UA.stepIn, 1);
  assert.equal(UA.stepStick, 0.3);
  assert.ok(Math.abs(UA.stepPre - CONFIG.realS(0.2)) < 1e-12);
  assert.ok(Math.abs(UA.stepPost - CONFIG.realS(0.2)) < 1e-12);
});

test('스틱 쪽 판단 (stickDir): 옆 = 옆 몫 ≥ 문턱 · 앞뒤 몫 이하 / 앞 = 앞 몫 ≥ 문턱 · 옆 몫보다 큼', () => {
  assert.ok(stickDir('side', -0.35, 0.1, 0.3));
  assert.ok(!stickDir('side', -0.35, 0.1, 0.5)); // 전 판 문턱 0.5 는 못 넘음
  assert.ok(!stickDir('side', 0.5, 0.6, 0.3)); // 앞이 더 큼
  assert.ok(stickDir('fwd', 0.2, 0.4, 0.3));
  assert.ok(!stickDir('fwd', 0.45, 0.4, 0.3));
  assert.ok(!stickDir('fwd', 0, -0.8, 0.3)); // 뒤는 앞이 아님
  assert.equal(stickValue(0.45).toFixed(2), '0.35'); // 손잡이 반지름 45 % = 값 0.35 (데드존 0.15)
});

test('새 판: 늦은 스틱 · 살짝 민 엄지 · 밀었다 놓은 엄지도 걸음 공격 · 스틱 없는 긋기 · 긋고 비켜 걷기는 기본 동작', () => {
  const R = run(1);
  for (const k of Object.keys(R)) assert.ok(R[k].strokes.some((s) => s.tech === 'zwerch'), `${k}: 가로베기로 읽힘`);
  for (const k of ['early', 'late', 'soft', 'flick']) assert.ok(R[k].read, `${k}: 걸음 공격`);
  for (const k of ['plain', 'away']) assert.ok(!R[k].read, `${k}: 기본 동작`);
});

test('전 판(stepIn 0): 긋기 시작 순간의 스틱만 · 문턱 0.5 — 스틱 먼저 · 끝까지 민 것만 걸음 공격', () => {
  const R = run(0);
  assert.ok(R.early.read);
  for (const k of ['late', 'soft', 'flick', 'plain', 'away']) assert.ok(!R[k].read, `${k}: 기본 동작`);
});
