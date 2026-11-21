// 손가락 빠르기 시간 시험 (감사 가지 N-032 — src/input.js handSpanMs · consumeHandDelta · main.js playerInputFrame 의 긋기 판단 'swipe'):
//  손가락 빠르기 = 이번 프레임 이동 ÷ 그 이동이 실제로 걸린 시간. 전엔 0.1 s 로 자른 프레임 시간(dt)으로 나눠
//   ① 긴 프레임 한 장(0.3 s)에 쌓인 느린 손놀림이 3 배로 ② 한 프레임에 몰린 움직임 사건 둘이 2 배로 읽혀 공격 입력(긋기 · 뛰기 끊김 · 막기 풀림 · 비기 창)이 됐다.
//   ③ 고른 프레임(프레임마다 사건 하나)은 전과 같은 값 — 문턱 · 손맛 그대로여야 한다.
//  사건 차례는 브라우저 그대로: pointerdown → pointermove … → 프레임마다 consumeHandDelta (main.js)
//  node --test tools/sim/hand_span.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL } from '../../src/config.js';

const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input, handSpanMs } = await import('../../src/input.js');

/** 화면 손가락 하나 + 프레임 시계. move(dx, at) = at ms 에 찍힌 움직임 사건 · frame(ms) = 프레임 하나를 넘기고 main.js 처럼 긋기 판단 */
function rig() {
  const canvas = { addEventListener() {} };
  const input = withBrowser(() => new Input(canvas, { verticalGain: 1 }));
  input.enabled = true;
  let x = 520;
  let now = 1000;
  const ev = (type, at) => ({ type, pointerId: 2, pointerType: 'touch', button: 0, clientX: x, clientY: 200, timeStamp: at, stopPropagation() {} });
  return {
    input,
    get now() { return now; },
    down: () => withBrowser(() => input.onDown(ev('pointerdown', now))),
    move: (dx, at = now) => { x += dx; withBrowser(() => input.onMove(ev('pointermove', at))); },
    /** 프레임 하나 (frameMs 뒤): 옛 식(자른 dt)과 새 식(handSpanMs)의 빠르기 px/s · 긋기 판단 */
    frame(frameMs) {
      now += frameMs;
      const d = input.consumeHandDelta();
      const dt = Math.min(0.1, frameMs / 1000);
      const spanS = handSpanMs(d, frameMs) / 1000;
      const pxPerM = 390 / 2.6; // 화면 높이 390 px = 손 2.6 m (INPUT.touchSensitivity)
      const dist = Math.hypot(d.x, d.y);
      return { d, dt, spanS, oldPx: (dist / Math.max(dt, 1e-3)) * pxPerM, newPx: (dist / Math.max(spanS, 1e-3)) * pxPerM, swipe: dist / Math.max(spanS, 1e-3) >= SKILL.swingSpeed, swipeOld: dist / Math.max(dt, 1e-3) >= SKILL.swingSpeed };
    },
  };
}
const LINE = SKILL.swingSpeed * (390 / 2.6); // 225 px/s

test('③ 고른 프레임: 사건 하나 · 프레임 0.1 s 아래면 나누는 시간이 옛 dt 와 비트까지 같다 (문턱 그대로 — 16 ms 프레임에 3.5 px 아님 · 4 px 긋기)', () => {
  for (const F of [16, 1000 / 60, 17, 33.4, 50, 99.9, 100]) {
    const R = rig();
    R.down();
    R.frame(F);
    for (let k = 0; k < 6; k++) {
      R.move(2);
      const f = R.frame(F);
      assert.equal(f.spanS, f.dt, `프레임 ${F} ms`);
      assert.equal(f.newPx, f.oldPx);
    }
  }
  const R = rig();
  R.down();
  R.frame(16);
  R.move(3.5);
  assert.equal(R.frame(16).swipe, false, '3.5 px / 16 ms = 219 px/s');
  R.move(4);
  assert.equal(R.frame(16).swipe, true, '4 px / 16 ms = 250 px/s');
  assert.ok(Math.abs(LINE - 225) < 1e-9);
});

test('③ 쉬던 손가락이 움직이기 시작한 프레임: 쉰 시간을 넣지 않는다 (사건 하나 · 둘 모두 — 첫 긋기 판단이 늦어지지 않음)', () => {
  const R = rig();
  R.down();
  for (let k = 0; k < 14; k++) R.frame(16); // 238 ms 쉼
  R.move(4);
  const a = R.frame(16);
  assert.equal(a.spanS, 0.016);
  assert.equal(a.swipe, true);
  // 120 Hz 손가락(사건이 프레임마다 둘, 시각 8 ms 간격): 쉬다 시작해도 한 프레임
  const B = rig();
  B.down();
  for (let k = 0; k < 14; k++) B.frame(16);
  B.move(2, B.now + 8);
  B.move(2, B.now + 16);
  const b = B.frame(16);
  assert.equal(b.spanS, 0.016);
  assert.equal(b.swipe, true);
});

test('① 긴 프레임 한 장: 자르지 않은 프레임 시간으로 나눈다 — 초당 118 px 손놀림이 0.3 s 프레임에 공격 입력이 되지 않음 (옛 식은 됨)', () => {
  const R = rig();
  R.down();
  R.frame(16);
  for (let k = 0; k < 3; k++) { R.move(2); R.frame(17); }
  const t = R.now;
  for (let k = 0; k < 18; k++) R.move(2, t); // 긴 프레임 동안 쌓인 사건 (시각은 모두 프레임 첫머리 — 감사 도구와 같은 꼴)
  const f = R.frame(306);
  assert.equal(f.d.n, 18);
  assert.equal(f.spanS, 0.306);
  assert.equal(f.swipe, false, `새 식 ${f.newPx.toFixed(0)} px/s`);
  assert.equal(f.swipeOld, true, `옛 식 ${f.oldPx.toFixed(0)} px/s (3 배)`);
  // 선 위(초당 235 px — 4 px / 17 ms)는 긴 프레임에서도 공격 입력
  const S = rig();
  S.down();
  S.frame(16);
  for (let k = 0; k < 3; k++) { S.move(4); S.frame(17); }
  for (let k = 0; k < 18; k++) S.move(4, S.now);
  assert.equal(S.frame(306).swipe, true);
});

test('② 사건 둘이 한 프레임에 (앞 프레임은 빔): 사건마다 표본 간격 하나로 나눈다 — 같은 시각이면 한 프레임씩 · 다른 시각이면 그 간격', () => {
  // 같은 시각에 찍힌 둘 (감사 도구 two_in_one 꼴) — 초당 118 px(2 px / 17 ms)는 아무 일 없음, 옛 식은 프레임 하나 걸러 공격 입력
  const R = rig();
  R.down();
  R.frame(16);
  let atkOld = 0;
  let atkNew = 0;
  for (let k = 0; k < 24; k++) {
    if (k % 2) { R.move(2); R.move(2); }
    const f = R.frame(16);
    if (f.swipe) atkNew++;
    if (f.swipeOld) atkOld++;
    if (k % 2) assert.equal(f.spanS, 0.032);
  }
  assert.equal(atkNew, 0);
  assert.equal(atkOld, 12);
  // 다른 시각(실제 표본 시각 — 16.7 ms 간격)으로 찍힌 둘: 그 간격 둘
  const T = rig();
  T.down();
  T.frame(16.7);
  T.move(2);
  T.frame(16.7);
  T.frame(16.7); // 빈 프레임
  T.move(2, T.now - 16.7);
  T.move(2, T.now);
  const g = T.frame(16.7);
  assert.ok(Math.abs(g.spanS - 0.0334) < 1e-9, String(g.spanS));
  assert.equal(g.swipe, false);
  // 선 위(4 px 씩)는 몰려 들어도 공격 입력
  const S = rig();
  S.down();
  S.frame(16);
  S.frame(16);
  S.move(4);
  S.move(4);
  assert.equal(S.frame(16).swipe, true);
});

test('표본 간격은 앞 손 사건(움직임 · 누름) 뒤 실제로 지난 시간을 넘지 않는다 · 120 Hz 손가락의 고른 프레임은 한 프레임', () => {
  // 누른 바로 뒤 프레임에 같은 시각 사건 둘: 누름부터 지난 시간(16 ms)보다 길게 잡지 않음
  const R = rig();
  R.down();
  R.move(2, R.now + 16);
  R.move(2, R.now + 16);
  assert.equal(R.frame(16).spanS, 0.016);
  // 120 Hz: 프레임마다 사건 둘 (8.35 ms 간격) — 프레임 시간 그대로
  const H = rig();
  H.down();
  H.frame(16.7);
  for (let k = 0; k < 5; k++) {
    H.move(1, H.now + 8.35);
    H.move(1, H.now + 16.7);
    const f = H.frame(16.7);
    assert.ok(Math.abs(f.spanS - 0.0167) < 1e-12, String(f.spanS));
  }
});

test('새 칼 손가락 · 취소(resetHand)는 앞 손가락의 사건 수 · 시각을 잇지 않는다', () => {
  const R = rig();
  R.down();
  R.move(2);
  R.move(2);
  R.input.resetHand();
  const f = R.frame(16);
  assert.equal(f.d.n, 0);
  assert.equal(f.d.x, 0);
  R.down();
  R.move(2, R.now);
  assert.equal(R.frame(16).d.sinceMs, 0);
});
