// 공격 원 그리기 몸짓 시험 (10/24 — 이베리아 싱지르 공격 원 판 · src/attack_circle.js · secret.js PlayerSecretWatch.spinCircle · docs/strike/iberian_spin_2026-10-22.md §14)
//  node --test tools/sim/attack_circle.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { circleState, circleStep, circleClear, circleLive, circleFit, circleTurn, CIRCLE_INNER } from '../../src/attack_circle.js';
import { SECRET, SKILL, UNIQUE_ASSIST, ARENA, realS } from '../../src/config.js'; // realS: 표준 시간(10/25) — 무장 1.5 s 는 실제 초

const F = 1 / 60; // 프레임 (60 fps)
const R = Math.PI / 180;
const V = SECRET.ibSpin;
const opt = (o = {}) => ({ time: V.circleTime, need: 2 * Math.PI, rMin: V.circleR, gap: V.circleGap, inner: V.circleInner, ...o });

/** 손 길 f(u) (u 0 → 1, 손 m) 를 dur 초에 고르게 그린다 — 프레임마다 손 움직임을 넣는다. 돌려줌: 처음 참이 된 시각 또는 null */
function drive(st, path, dur, { down = true, o = opt() } = {}) {
  const n = Math.max(1, Math.round(dur / F));
  let prev = path(0);
  let hit = null;
  for (let i = 1; i <= n; i++) {
    const p = path(i / n);
    if (circleStep(st, F, p[0] - prev[0], p[1] - prev[1], down, o) && hit == null) hit = i * F;
    prev = p;
  }
  return hit;
}
/** 반지름 r 원호: a0 에서 turn° (+ = 반시계), 가로 · 세로 배율 sx · sy (폰 세로 1.35 배 — mobile_intent) */
const arc = (r, a0, turn, sx = 1, sy = 1) => (u) => [sx * r * Math.cos((a0 + turn * u) * R), sy * r * Math.sin((a0 + turn * u) * R)];
const line = (x0, y0, x1, y1) => (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
/** 꺾인 줄 (점들을 고른 시간으로) */
const poly = (pts) => (u) => {
  const k = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
  const t = u * (pts.length - 1) - k;
  return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t];
};

test('판 값: 공격 원 판 기본 · 1.5 s (사다리 무장) · 반지름 하한 없음 (사장님 10/24 — 전 0.15 m) · 멈춤 0.2 s (사다리 반응) · 안쪽 문턱 반지름의 0.5', () => {
  assert.equal(V.input, 'attackCircle');
  assert.equal(V.circleTime, 1.5);
  assert.equal(V.circleR, 0); // 하한 없음 (사장님 10/24 10:2x '최소크기 제한 철폐')
  assert.equal(V.circleGap, 0.2);
  assert.equal(V.circleInner, 0.5);
  assert.equal(CIRCLE_INNER, V.circleInner);
});

test('한 바퀴(370°) 0.5 · 0.8 · 1.2 s 참 · 두 쪽 모두 · 그린 쪽 부호(반시계 +1 · 시계 −1)', () => {
  for (const dur of [0.5, 0.8, 1.2])
    for (const dir of [1, -1]) {
      const st = circleState();
      const hit = drive(st, arc(0.3, 30, dir * 370), dur);
      assert.ok(hit != null, `${dur} s ${dir}`);
      assert.equal(st.sgn, dir);
    }
});

test('한 바퀴 못 미침 거짓: 300° · 340° (가운데가 원호 쪽으로 쏠려도 360° 를 못 넘음)', () => {
  for (const turn of [300, 340, -340]) assert.equal(drive(circleState(), arc(0.3, 90, turn), 0.8), null, `${turn}`);
});

test('작은 원도 참 (하한 없음 — 사장님 10/24: 반지름 0.1 · 0.05 m) · 큰 원(0.2 m) 참 · 시험 값 rMin 0.15 를 주면 작은 원 거짓(옛 판)', () => {
  assert.notEqual(drive(circleState(), arc(0.1, 0, 400), 0.6), null);
  assert.notEqual(drive(circleState(), arc(0.05, 0, 400), 0.6), null);
  assert.notEqual(drive(circleState(), arc(0.2, 0, 400), 0.6), null);
  assert.equal(drive(circleState(), arc(0.1, 0, 400), 0.6, { o: opt({ rMin: 0.15 }) }), null);
});

test('느린 원 거짓 (한 바퀴 2.5 s — 1.5 s 안에는 216°) · 0.6 s 시험 값이면 0.8 s 원도 거짓', () => {
  assert.equal(drive(circleState(), arc(0.3, 0, 370), 2.5), null);
  assert.equal(drive(circleState(), arc(0.3, 0, 370), 0.8, { o: opt({ time: 0.6 }) }), null);
  assert.notEqual(drive(circleState(), arc(0.3, 0, 370), 0.5, { o: opt({ time: 0.6 }) }), null);
});

test('폰 세로 1.35 배로 늘어난 원(타원)도 참 · 납작한 타원(1 : 0.5)도 참', () => {
  assert.notEqual(drive(circleState(), arc(0.3, 0, 370, 1, 1.35), 0.8), null);
  assert.notEqual(drive(circleState(), arc(0.4, 0, 370, 1, 0.5), 0.8), null);
});

test('원이 아닌 끌기는 거짓: 곧은 긋기 · 오가기 · 지그재그 · S 자 · 반원 갈고리 · 큰 C (270°)', () => {
  const cases = {
    곧은: line(-0.5, 0.3, 0.5, -0.3),
    오가기: poly([[-0.4, 0], [0.4, 0.02], [-0.4, 0.04], [0.4, 0.06], [-0.4, 0.08]]),
    지그재그: poly([[-0.5, 0.3], [-0.2, -0.3], [0.1, 0.3], [0.4, -0.3], [0.7, 0.3]]),
    'S 자': (u) => (u < 0.5 ? arc(0.25, 180, -180)(u * 2) : arc(0.25, 180, 180)(u * 2 - 1).map((x, i) => x + (i ? 0 : 0.5))),
    반원갈고리: (u) => (u < 0.5 ? line(-0.5, 0.3, 0.2, 0.3)(u * 2) : arc(0.3, 90, -180)(u * 2 - 1).map((x, i) => x + (i ? 0 : 0.2))),
    큰C: arc(0.4, 45, 270),
  };
  for (const [k, p] of Object.entries(cases)) assert.equal(drive(circleState(), p, 0.6), null, k);
});

test('가운데를 지나는 마디에서 버림 (가운데 건너뜀 = 원 아님): 곧은 줄 하나는 가운데 둘레 180° 안팎이지만 0', () => {
  const pts = [{ x: -1, y: 0.001 }, { x: -0.5, y: 0.001 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }];
  const F2 = circleFit(pts);
  assert.ok(Math.abs(circleTurn(pts, F2.cx, F2.cy, 0)) > 3); // 문턱 없으면 반 바퀴로 읽힘
  assert.ok(Math.abs(circleTurn(pts, F2.cx, F2.cy, F2.r * CIRCLE_INNER)) < 0.01); // 건너뛴 뒤 마디 몫만
});

test('획 끝: 손가락을 떼면 셈 비움 · 0.2 s 넘게 멈추면 셈 비움 · 떼었다 이어 그린 반 바퀴 둘은 거짓', () => {
  const st = circleState();
  assert.equal(drive(st, arc(0.3, 0, 200), 0.4), null);
  assert.ok(circleLive(st, V.circleTime));
  circleStep(st, F, 0, 0, false, opt()); // 뗌
  assert.equal(st.pts.length, 0);
  assert.equal(circleLive(st, V.circleTime), false);
  assert.equal(drive(st, arc(0.3, 200, 200), 0.4), null);
  // 멈춤
  const st2 = circleState();
  drive(st2, arc(0.3, 0, 200), 0.4);
  for (let i = 0; i < Math.round(0.25 / F); i++) circleStep(st2, F, 0, 0, true, opt());
  assert.equal(st2.pts.length, 0);
  assert.equal(drive(st2, arc(0.3, 200, 200), 0.4), null);
  // 0.1 s 멈춤은 이어 셈
  const st3 = circleState();
  drive(st3, arc(0.3, 0, 200), 0.4);
  for (let i = 0; i < Math.round(0.1 / F); i++) circleStep(st3, F, 0, 0, true, opt());
  assert.notEqual(drive(st3, arc(0.3, 200, 200), 0.4), null);
  circleClear(st3);
  assert.equal(st3.turn, 0);
});

test('8 자는 고리 하나가 닫힌 때 참 (닫힌 고리 = 원 — 그린 쪽은 그 고리의 쪽)', () => {
  const st = circleState();
  const hit = drive(st, (u) => [0.35 * Math.sin(2 * Math.PI * u), 0.35 * Math.sin(4 * Math.PI * u)], 1.0);
  assert.ok(hit != null && hit <= 0.6, `${hit}`);
});

test('원 앞의 곧은 들머리(가운데에서 밀어 나감)는 버리고 그 뒤 원으로 참', () => {
  const st = circleState();
  const p = (u) => (u < 0.15 ? [0.3 * (u / 0.15), 0] : arc(0.3, 0, 380)((u - 0.15) / 0.85));
  assert.notEqual(drive(st, p, 1.0), null);
});

