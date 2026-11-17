// 공격 조이스틱 시험 (11/17 — 사장님 '이동스위치처럼 공격 스위치를 만들어. 그걸로 공격해야 정교한 컨트롤이 되고 상대 공격을 막는 컨트롤 가능해져' ·
//  src/atk_stick.js · input.js attachAtkStick · main.js playerInputFrame · 기록 docs/strike/atk_stick_2026-11-17.md · 확인표 4656 ~)
//   ① 판: INPUT.atkStick 기본 0 (감독 안 · 사장님 확인 전) · 0 이면 아무것도 붙지 않고 손가락 입력이 그대로
//   ② 자리 조종: 손잡이 자리 → 손 목표(패드 m) · 끝까지 = 손 닿는 끝 WEAPON.reach · 데드존 = 이동 스틱 STICK_DEAD · 가만히 = 그 자리에 머묾 · 닿는 순간 뜀은 자세 복귀 빠르기
//   ③ 같은 길: 빠른 튕김 = 휘두르기 문턱(SKILL.swingSpeed)을 넘는 손 목표 · 느린 밂은 아님 · 엄지 움직임은 손가락 끌기 몫(handDX)에 안 들어감
//   ④ 명령: 탭 = 찌르기 · 길게 누름(가운데 얹은 엄지) = 풍차 베기 감기 · 쥔 엄지(막는 선)는 길게 누름 아님 · 원 긋기 = 싱지르 · 권총 닿는 순간 · 고노센 뽑기(쥠)
//   ⑤ 'stick' 판: 화면 손가락은 칼 아님 · 'both' 판: 둘 다 · 둘레(stickGuardPx)는 이동 스틱과 같음
//   ⑥ 물리: 네 자리를 쥐고 있으면 칼 손이 그쪽에 머묾 · 튕김은 손가락 긋기와 같은 칼끝 빠르기 (같은 손 목표 길이면 판이 바이트 같음)
//  node --test tools/sim/atk_stick.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUT, SKILL, WEAPON, SECRET, STAMINA, UNIQUE_ASSIST as UA, IB_LINK, ARENA, realS } from '../../src/config.js';
import { STICK_DEAD } from '../../src/stick_turn.js';
import { atkStickMode, atkStickState, atkStickTarget, atkStickStep, atkStickGrab, atkStickKnob, atkStickRelease } from '../../src/atk_stick.js';
import fs from 'node:fs';

const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input, attachStick, attachAtkStick } = await import('../../src/input.js');

// 844 × 390 가로 화면 · 이동 스틱 left 20 · bottom 20 · 110 px → 가운데 (75, 315) · 공격 조이스틱 right 20 · bottom 20 → 가운데 (769, 315) · 반지름 55 · 손잡이 40 px
const MOVE = { left: 20, top: 260, width: 110, height: 110 };
const ATK = { left: 714, top: 260, width: 110, height: 110 };
const C = { x: 769, y: 315 };
const KR = 40;
const F = 1 / 60;
const near = (a, b, e = 1e-9, m = '') => assert.ok(Math.abs(a - b) <= e, `${m} ${a} != ${b}`);

function padRig(box) {
  const L = {};
  const cap = new Set();
  const pad = { addEventListener(t, f) { (L[t] ??= []).push(f); }, getBoundingClientRect: () => box, setPointerCapture: (id) => cap.add(id), releasePointerCapture: (id) => cap.delete(id), hasPointerCapture: (id) => cap.has(id) };
  return { pad, L, cap, knob: { style: { transform: '' } } };
}
/** 입력 하나 + 이동 스틱 + (판이 있으면) 공격 조이스틱. 사건은 main.js 차례 그대로: 패드 사건(대상) → 창 사건(Input — 거품) */
function rig(mode = 'stick') {
  const CL = {};
  const canvas = { addEventListener(t, f) { (CL[t] ??= []).push(f); } };
  const input = withBrowser(() => new Input(canvas, { verticalGain: 1 }));
  const mv = padRig(MOVE);
  const at = padRig(ATK);
  withBrowser(() => attachStick(input, mv.pad, mv.knob));
  const st = withBrowser(() => attachAtkStick(input, at.pad, at.knob, mode));
  input.enabled = true;
  let ms = 1000;
  const ev = (type, id, x, y, target) => ({ type, pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: ms, stopPropagation() {}, target });
  const fire = (L, type, e) => { for (const f of L[type] ?? []) f(e); };
  // 공격 조이스틱 엄지 (패드에 닿음 — 캡처된 뒤 사건은 패드가 대상 · 창으로 거품)
  const sDown = (id, x, y) => withBrowser(() => fire(at.L, 'pointerdown', ev('pointerdown', id, x, y, at.pad)));
  const sMove = (id, x, y) => withBrowser(() => { const e = ev('pointermove', id, x, y, at.pad); fire(at.L, 'pointermove', e); input.onMove(e); });
  const sUp = (id, x, y) => withBrowser(() => { const e = ev('pointerup', id, x, y, at.pad); fire(at.L, 'pointerup', e); input.onUp(e); });
  const sCancel = (id, x, y) => withBrowser(() => { const e = ev('pointercancel', id, x, y, at.pad); fire(at.L, 'pointercancel', e); input.onCancel(e); });
  // 화면(캔버스) 손가락
  const cDown = (id, x, y) => withBrowser(() => input.onDown(ev('pointerdown', id, x, y, canvas)));
  const cMove = (id, x, y) => withBrowser(() => input.onMove(ev('pointermove', id, x, y, canvas)));
  const cUp = (id, x, y) => withBrowser(() => input.onUp(ev('pointerup', id, x, y, canvas)));
  return { input, st, at, mv, sDown, sMove, sUp, sCancel, cDown, cMove, cUp, wait: (d) => { ms += d; } };
}
/** 손잡이 자리 (x 오른쪽 · y 위, −1 ~ 1) → 화면 좌표 */
const P = (x, y) => ({ x: C.x + x * KR, y: C.y - y * KR });
/** main.js playerInputFrame 의 손 몫: 손가락 끌기 몫 + 조이스틱 몫 → 손 목표 (막는 것 없음 · 손 목표 자름 WEAPON.reach — skill.js 와 같음) */
function frame(R, hand, dt = F) {
  const d = R.input.consumeHandDelta();
  if (R.input.atk) { const s = atkStickStep(R.input.atk, hand, dt); d.x += s.x; d.y += s.y; }
  hand.x += d.x;
  hand.y += d.y;
  const L = Math.hypot(hand.x, hand.y);
  if (L > WEAPON.reach) { hand.x *= WEAPON.reach / L; hand.y *= WEAPON.reach / L; }
  return { d, v: Math.hypot(d.x, d.y) / dt };
}

test('① 판 값 — 기본 0 [감독 안 · 사장님 확인 전] · 판 읽기 · 0 이면 붙지 않음 · 새 수 없음(손 닿는 끝 · 데드존 · 자세 복귀 빠르기는 있던 수)', () => {
  assert.equal(INPUT.atkStick, 0);
  assert.equal(atkStickMode('stick'), 'stick');
  assert.equal(atkStickMode('both'), 'both');
  for (const v of ['0', 0, null, undefined, '', 'yes', 'STICK', 1]) assert.equal(atkStickMode(v), 0, String(v));
  const R = rig(0);
  assert.equal(R.st, null);
  assert.equal(R.input.atk, undefined, '0 판: 입력에 공격 조이스틱 없음');
  assert.equal(R.at.L.pointerdown, undefined, '0 판: 패드에 사건 없음');
  assert.equal(WEAPON.reach, 0.62);
  assert.equal(STICK_DEAD, 0.15);
  assert.equal(SKILL.recoverSpeed, 1.2);
  assert.ok(SKILL.recoverSpeed < SKILL.swingSpeed, '틈 메우기는 휘두르기 문턱보다 느림');
});

test('① 0 판 = 손가락 입력 그대로 (공격 조이스틱을 붙이지 않은 입력과 사건마다 같음)', () => {
  const run = (attach) => {
    const CL = {};
    const input = withBrowser(() => new Input({ addEventListener(t, f) { (CL[t] ??= []).push(f); } }, { verticalGain: 1 }));
    const mv = padRig(MOVE);
    withBrowser(() => attachStick(input, mv.pad, mv.knob));
    if (attach) withBrowser(() => attachAtkStick(input, padRig(ATK).pad, { style: {} }, 0));
    input.enabled = true;
    const out = [];
    let ms = 1000;
    const e = (type, id, x, y) => ({ type, pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: ms });
    const S = [['d', 1, 600, 200], ['m', 1, 640, 180], ['m', 1, 700, 150], ['u', 1, 700, 150], ['d', 2, 760, 315], ['u', 2, 760, 315], ['d', 3, 500, 250], ['m', 3, 505, 252], ['u', 3, 505, 252], ['d', 4, 780, 300], ['m', 4, 790, 260], ['u', 4, 790, 260]];
    for (const [k, id, x, y] of S) {
      withBrowser(() => (k === 'd' ? input.onDown(e('pointerdown', id, x, y)) : k === 'm' ? input.onMove(e('pointermove', id, x, y)) : input.onUp(e('pointerup', id, x, y))));
      ms += k === 'u' ? 300 : 60;
      out.push(JSON.stringify([input.handDX, input.handDY, input.taps, input.activeTouch, input.holdState(), input.press && { ...input.press }]));
    }
    return out;
  };
  assert.deepEqual(run(true), run(false));
});

test('② 자리 조종: 손잡이 → 손 목표 — 가운데 · 데드존 = 긴 자세 자리(0,0) · 끝까지 = 손 닿는 끝 · 위 = +y · 오른쪽 = +x · 1 넘음은 1', () => {
  for (const [x, y] of [[0, 0], [0.1, 0], [0, -0.15], [0.1, 0.1]]) {
    const t = atkStickTarget(x, y);
    assert.ok(Math.abs(t.x) < 1e-12 && Math.abs(t.y) < 1e-12, `데드존 ${x},${y}`);
  }
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [2, 0]]) {
    const t = atkStickTarget(x, y);
    near(Math.hypot(t.x, t.y), WEAPON.reach, 1e-12, `끝 ${x},${y}`);
    assert.ok(Math.sign(t.x) === Math.sign(Math.round(x * 1e6)) && Math.sign(t.y) === Math.sign(Math.round(y * 1e6)), `쪽 ${x},${y}`);
  }
  const h = atkStickTarget(0, 0.575); // 데드존과 끝의 한가운데
  near(h.y, WEAPON.reach / 2, 1e-12, '가운데 값');
  // 패드 자리 둘레: 지붕(0.02, 0.52) · 옆 자세(0.52, 0.06) · 바보(0, −0.5) 는 손잡이로 닿는 자리 (손 닿는 끝 안)
  for (const p of [[0.02, 0.52], [0.52, 0.06], [0, -0.5], [0.42, 0.42]]) assert.ok(Math.hypot(...p) < WEAPON.reach, `패드 ${p}`);
});

test('② 네 자리를 쥐고 있으면 손 목표가 그 자리로 가서 머묾 — 닿는 순간 뜀은 자세 복귀 빠르기(휘두르기 아님) · 머무는 동안 몫 0', () => {
  for (const [kx, ky] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const R = rig('stick');
    const hand = { x: 0.18, y: -0.28 }; // 쟁기(쉼 자세) 자리에서
    const p = P(kx, ky);
    R.sDown(1, p.x, p.y);
    assert.equal(R.input.atk.grip, true, '데드존 밖에 닿음 = 칼을 쥠');
    const want = atkStickTarget(kx, ky);
    let vmax = 0;
    let n = 0;
    while (Math.hypot(hand.x - want.x, hand.y - want.y) > 1e-9 && n < 600) { vmax = Math.max(vmax, frame(R, hand).v); n++; R.wait(1000 / 60); }
    assert.ok(n < 600, '닿음');
    assert.ok(vmax <= SKILL.recoverSpeed + 1e-9, `닿는 순간 뜀은 ${vmax} m/s — 자세 복귀 빠르기 안`);
    assert.ok(vmax < SKILL.swingSpeed, '휘두르기 아님');
    for (let i = 0; i < 60; i++) {
      const { d } = frame(R, hand);
      assert.ok(Math.hypot(d.x, d.y) < 1e-12, '머묾');
    }
    near(hand.x, want.x, 1e-9);
    near(hand.y, want.y, 1e-9);
    R.sUp(1, p.x, p.y);
  }
});

test('② 쥔 채 손잡이를 옮기면 손 목표가 같은 몫만큼 같은 프레임에 (엄지보다 빨리 · 늦게 가지 않음) · 엄지 움직임은 손가락 끌기 몫(handDX)에 안 들어감', () => {
  const R = rig('stick');
  const hand = { x: 0, y: 0 };
  R.sDown(1, P(0.5, 0).x, P(0.5, 0).y);
  for (let i = 0; i < 120; i++) frame(R, hand); // 닿음
  const path = [];
  for (let i = 0; i <= 30; i++) { const a = (i / 30) * Math.PI; path.push([0.5 * Math.cos(a), 0.5 * Math.sin(a)]); }
  for (const [x, y] of path) {
    R.sMove(1, P(x, y).x, P(x, y).y);
    assert.equal(R.input.handDX, 0);
    assert.equal(R.input.handDY, 0);
    frame(R, hand);
    const t = atkStickTarget(x, y);
    near(hand.x, t.x, 1e-9, 'x');
    near(hand.y, t.y, 1e-9, 'y');
  }
});

test('③ 빠른 튕김 = 휘두르기 문턱을 넘는 손 목표 (손가락 긋기와 같은 문턱) · 느린 밂은 아님 — 손 목표 빠르기 = 손잡이 빠르기 × 손 닿는 끝', () => {
  // 위 끝(지붕 쪽)에서 쥐고 → 아래 끝으로 4 프레임(0.067 s) 튕김
  const R = rig('stick');
  const hand = { x: 0, y: 0 };
  R.sDown(1, P(0, 1).x, P(0, 1).y);
  for (let i = 0; i < 120; i++) frame(R, hand);
  let vmax = 0;
  let moved = 0;
  for (let i = 1; i <= 4; i++) {
    const y = 1 - (2 * i) / 4;
    R.sMove(1, P(0, y).x, P(0, y).y);
    const f = frame(R, hand);
    vmax = Math.max(vmax, f.v);
    moved += Math.hypot(f.d.x, f.d.y);
  }
  assert.ok(vmax > SKILL.swingSpeed * 5, `튕김 ${vmax} m/s`);
  near(moved, 2 * WEAPON.reach, 1e-9, '위 끝 → 아래 끝 = 손 닿는 끝 두 배');
  // 느린 밂: 같은 길을 2 s
  const S = rig('stick');
  const h2 = { x: 0, y: 0 };
  S.sDown(1, P(0, 1).x, P(0, 1).y);
  for (let i = 0; i < 120; i++) frame(S, h2);
  let v2 = 0;
  for (let i = 1; i <= 120; i++) {
    const y = 1 - (2 * i) / 120;
    S.sMove(1, P(0, y).x, P(0, y).y);
    v2 = Math.max(v2, frame(S, h2).v);
  }
  assert.ok(v2 < SKILL.swingSpeed, `느린 밂 ${v2} m/s 는 휘두르기 아님`);
});

test('③ 얹은 엄지(가운데 · 데드존 안 · 24 px 안 떠돎)는 칼을 쥐지 않음 — 손 목표 그대로 · 데드존 밖으로 미는 순간부터 쥠 · 떼면 놓음(손가락 뗀 것과 같음)', () => {
  const R = rig('stick');
  const hand = { x: 0.18, y: -0.28 };
  R.sDown(1, C.x + 2, C.y - 1);
  for (let i = 0; i < 30; i++) {
    R.sMove(1, C.x + 2 + (i % 3), C.y - 1 + (i % 2)); // 떨림
    const { d } = frame(R, hand);
    assert.equal(Math.hypot(d.x, d.y), 0);
  }
  assert.equal(R.input.atk.grip, false);
  assert.equal(R.input.activeTouch, 1, '손가락이 닿음 (handHeld)');
  // 데드존 안에서 20 px 떠돎 (가운데 떠나지 않게 왔다 갔다 — 5 px 안) — 쥐지 않음
  R.sMove(1, C.x + 5, C.y);
  assert.equal(R.input.atk.grip, false);
  // 데드존 밖이어도 처음 자리에서 길게 누름 한도(24 px) 안이면 아직 얹은 엄지 (0.3 = 12 px — 길게 누름이 엄지 떠돎에 깨지지 않게)
  R.sMove(1, C.x + 0.3 * KR, C.y);
  assert.equal(R.input.atk.grip, false, '12 px 은 얹은 엄지');
  assert.equal(Math.hypot(frame(R, hand).d.x), 0);
  R.sMove(1, C.x + 0.7 * KR, C.y); // 28 px
  assert.equal(R.input.atk.grip, true, '쥠');
  assert.ok(frame(R, hand).v > 0, '쥐면 손 목표가 손잡이 자리로');
  // 데드존으로 돌아와도 쥔 채 (뗄 때까지)
  R.sMove(1, C.x, C.y);
  assert.equal(R.input.atk.grip, true);
  R.sUp(1, C.x, C.y);
  assert.equal(R.input.activeTouch, null, '뗌 = 손가락 뗌');
  assert.equal(R.input.atk.held, false);
  assert.equal(R.at.knob.style.transform, '', '손잡이 가운데로');
  const { d } = frame(R, hand);
  assert.equal(Math.hypot(d.x, d.y), 0, '뗀 뒤 몫 없음 — 손 목표는 skill.js 자세로 돌아가기가 맡음');
});

test('④ 탭 = 찌르기: 가운데 · 데드존 밖 톡 (180 ms · 12 px 안) → 탭 하나 · 길게 · 끌면 탭 아님 (손가락 탭 문턱 그대로)', () => {
  for (const [x, y, dur, mv, tap] of [[0, 0, 60, 0, 1], [0, 0, 170, 6, 1], [0.6, 0.6, 80, 0, 1], [0, 0, 250, 0, 0], [0, 0, 80, 20, 0], [-0.8, 0, 100, 3, 1]]) {
    const R = rig('stick');
    const p = P(x, y);
    R.sDown(1, p.x, p.y);
    R.wait(dur / 2);
    R.sMove(1, p.x + mv, p.y);
    R.wait(dur / 2);
    R.sUp(1, p.x + mv, p.y);
    assert.equal(R.input.consumeTaps(), tap, `${x},${y} ${dur} ms ${mv} px`);
  }
});

test('④ 길게 누름: 가운데 얹은 엄지는 길게 누름(엄지 떠돎 24 px 안 — 손가락과 같은 한도) · 칼을 쥔 엄지(데드존 밖에 닿음 · 끎)는 아님', () => {
  let R = rig('stick');
  R.sDown(1, C.x, C.y);
  R.wait(700);
  assert.deepEqual(R.input.holdState(), { down: true, still: true }, '가운데 누름');
  R.sMove(1, C.x + 5, C.y + 3); // 데드존(6 px) 안 떠돎
  assert.deepEqual(R.input.holdState(), { down: true, still: true });
  R.sUp(1, C.x + 5, C.y + 3);
  assert.deepEqual(R.input.holdState(), { down: false, still: false });
  R = rig('stick');
  R.sDown(1, P(0.7, 0.4).x, P(0.7, 0.4).y);
  R.wait(1500);
  assert.deepEqual(R.input.holdState(), { down: true, still: false }, '막는 선을 쥔 엄지는 길게 누름 아님');
  R = rig('stick');
  R.sDown(1, C.x, C.y);
  R.sMove(1, C.x + 26, C.y);
  assert.deepEqual(R.input.holdState(), { down: true, still: false }, '끎');
});

test('④ 권총: 조이스틱에 닿는 순간 쏨 (손가락과 같은 tapOnDown) · 고노센 뽑기: 칼을 쥔 엄지 = 쥠 · 얹은 엄지 = 아님 (drawInput 의 grip)', () => {
  const R = rig('stick');
  R.input.tapOnDown = true;
  R.sDown(1, C.x, C.y);
  assert.equal(R.input.consumeTaps(), 1, '닿는 순간');
  R.sUp(1, C.x, C.y);
  assert.equal(R.input.consumeTaps(), 0, '떼도 더 없음');
  R.input.tapOnDown = false;
  // 뽑기 (iai_obi.js drawInput — main.js 가 grip 을 조이스틱 엄지 쥠으로 넘김 · 아래 main.js 줄 시험): 얹은 엄지는 쥠 아님 · 민 엄지는 쥠
  const grip = () => (R.input.press?.atk ? R.input.atk.grip : false);
  R.sDown(2, C.x, C.y);
  assert.equal(grip(), false, '얹은 엄지는 쥠 아님');
  R.sMove(2, P(0.3, 0.1).x, P(0.3, 0.1).y);
  assert.equal(grip(), false, '12 px 떠돎은 얹은 엄지');
  R.sMove(2, P(0.7, 0.2).x, P(0.7, 0.2).y);
  assert.equal(grip(), true, '민 엄지(길게 누름 한도 넘게) = 칼을 쥠');
  R.sUp(2, P(0.7, 0.2).x, P(0.7, 0.2).y);
  R.sDown(3, P(0.4, -0.3).x, P(0.4, -0.3).y);
  assert.equal(grip(), true, '데드존 밖에 닿은 엄지 = 칼을 쥠');
  R.sUp(3, P(0.4, -0.3).x, P(0.4, -0.3).y);
});

test("⑤ 'stick' 판: 화면 손가락은 칼 아님(긋기 · 탭 · 누름 없음) · 'both' 판: 화면 손가락 그대로 + 조이스틱이 쥐고 있던 손가락을 넘겨받음", () => {
  let R = rig('stick');
  R.cDown(5, 500, 200);
  R.cMove(5, 560, 150);
  R.wait(60);
  R.cUp(5, 560, 150);
  assert.equal(R.input.handDX, 0);
  assert.equal(R.input.handDY, 0);
  assert.equal(R.input.consumeTaps(), 0);
  assert.equal(R.input.activeTouch, null);
  R.cDown(6, 500, 200);
  R.wait(60);
  R.cUp(6, 500, 200);
  assert.equal(R.input.consumeTaps(), 0, '화면 탭 아님');
  R = rig('both');
  R.cDown(5, 500, 200);
  R.cMove(5, 560, 150);
  assert.ok(R.input.handDX > 0.3, '화면 끌기 그대로');
  R.input.consumeHandDelta();
  // 조이스틱이 넘겨받음
  R.sDown(7, C.x, C.y);
  assert.equal(R.input.activeTouch, 7);
  assert.equal(R.input.press.atk, true);
  R.cMove(5, 600, 120);
  assert.equal(R.input.handDX, 0, '버린 손가락은 손을 못 움직임');
  R.cUp(5, 600, 120);
  assert.equal(R.input.activeTouch, 7, '버린 손가락을 떼도 조이스틱 그대로');
  R.wait(60);
  R.sUp(7, C.x, C.y);
  assert.equal(R.input.consumeTaps(), 1, '조이스틱 탭');
  // 조이스틱을 쥔 동안 화면 손가락은 칼 아님 (칼은 손가락 하나로만 — 전과 같음)
  R.sDown(8, C.x, C.y);
  R.cDown(9, 500, 200);
  assert.equal(R.input.activeTouch, 8);
  R.sUp(8, C.x, C.y);
});

test('⑤ 둘레: 공격 조이스틱 원 밖 15 px 안 화면 손가락은 조이스틱을 쥠 (이동 스틱 둘레와 같은 수) · 둘레 밖은 판대로 · 이동 스틱 둘레는 그대로', () => {
  for (const mode of ['stick', 'both']) {
    const R = rig(mode);
    R.cDown(1, C.x - 62, C.y); // 원 왼쪽 7 px 밖
    assert.equal(R.input.activeTouch, 1, `${mode}: 조이스틱을 쥠`);
    assert.equal(R.input.press?.atk, true);
    assert.equal(R.input.atk.id, 1);
    assert.ok(R.input.atk.x < -0.99, '그쪽으로 끝까지');
    assert.equal(R.input.atk.grip, true);
    R.wait(60);
    R.sUp(1, C.x - 62, C.y);
    assert.equal(R.input.atk.held, false);
    const out = { x: C.x - 75, y: C.y }; // 20 px 밖
    R.cDown(2, out.x, out.y);
    assert.equal(R.input.activeTouch, mode === 'both' ? 2 : null, `${mode}: 둘레 밖`);
    R.cUp(2, out.x, out.y);
    R.cDown(3, 75 + 62, 315); // 이동 스틱 둘레
    assert.equal(R.input.activeTouch, null, '이동 스틱 둘레는 칼 아님');
    assert.ok(R.input.stickMove.x > 0.99, '이동 스틱을 쥠');
  }
});

test('⑤ 취소 · 판 경계: 포인터 취소 · resetTransient · 입력 꺼짐이면 조이스틱을 놓음', () => {
  const R = rig('stick');
  R.sDown(1, P(0.5, 0.5).x, P(0.5, 0.5).y);
  R.sCancel(1, 0, 0);
  assert.equal(R.input.atk.held, false);
  assert.equal(R.input.activeTouch, null);
  R.sDown(2, P(0.5, 0.5).x, P(0.5, 0.5).y);
  R.input.resetTransient();
  assert.equal(R.input.atk.held, false);
  assert.equal(R.input.atk.id, null);
  assert.equal(R.at.knob.style.transform, '');
  R.sDown(3, P(0.5, 0.5).x, P(0.5, 0.5).y);
  R.input.enabled = false;
  R.sMove(3, P(0.2, 0.5).x, P(0.2, 0.5).y);
  assert.equal(R.input.atk.held, false, '꺼지면 놓음');
});

test('상태 함수: 쥠 · 놓음 · 쥐기 전 손잡이 자리 · 쥔 몸은 닿은 첫 프레임에 뜀 없음', () => {
  const s = atkStickState('both');
  assert.equal(s.mode, 'both');
  atkStickGrab(s, 4, 0.05, 0);
  assert.equal(s.grip, false);
  atkStickKnob(s, 0.05, 0, INPUT.holdPx);
  assert.equal(s.grip, true, '길게 누름 한도만큼 끌면 쥠');
  const out = atkStickStep(s, { x: 0, y: 0 }, F);
  near(out.x, 0, 1e-12);
  atkStickRelease(s);
  assert.equal(s.held, false);
  assert.deepEqual(atkStickStep(s, { x: 1, y: 1 }, F), { x: 0, y: 0 });
});

// ── ⑥ 물리 (harness — 사람 몸 · 손가락 끌기와 같은 차례: 60 Hz 화면 한 장 = 물리 두 스텝 · main.js 가 넣는 손 목표 · 손가락 닿음 · 움직임 · 쥠) ──
async function body(seed = 2) {
  const { newRound, handPos } = await import('./harness_m.mjs');
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'longsword', onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const Pl = G.player;
  G.ai.update = () => G.enemy.move.set(0, 0);
  Pl.skill.autoGuard = true;
  G.park();
  for (let i = 0; i < 30; i++) G.step();
  return { G, Pl, handPos };
}
const pelvisLocal = (Pl, p) => {
  const t = Pl.bodies.pelvis.translation();
  return { up: p.y - t.y, side: p.z - t.z, fwd: p.x - t.x };
};

test('⑥ 물리: 손잡이 네 자리를 쥐고 있으면 칼 손이 그쪽에 머묾 (위 > 아래 · 오른쪽 ≠ 왼쪽) — 손가락과 같은 서보', async () => {
  const B = await body();
  try {
    const { G, Pl, handPos } = B;
    const R = rig('stick');
    const res = {};
    for (const [name, kx, ky] of [['up', 0, 0.9], ['right', 0.9, 0], ['down', 0, -0.9], ['left', -0.9, 0]]) {
      const p = P(kx, ky);
      R.sDown(1, p.x, p.y);
      const tr = [];
      for (let i = 0; i < 90; i++) {
        const { d } = frame(R, { x: Pl.handOffset.x, y: Pl.handOffset.y });
        Pl.handOffset.x += d.x;
        Pl.handOffset.y += d.y;
        Pl.handHeld = true;
        Pl.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
        Pl.handGrip = R.input.atk.grip;
        G.step(); G.step();
        if (i >= 60) tr.push(pelvisLocal(Pl, handPos(Pl)));
      }
      const t = atkStickTarget(kx, ky);
      near(Pl.handOffset.x, t.x, 1e-6, `${name} 손 목표 x`);
      near(Pl.handOffset.y, t.y, 1e-6, `${name} 손 목표 y`);
      const m = (k) => tr.reduce((s, q) => s + q[k], 0) / tr.length;
      const sd = (k) => Math.sqrt(tr.reduce((s, q) => s + (q[k] - m(k)) ** 2, 0) / tr.length);
      res[name] = { up: m('up'), side: m('side'), sdUp: sd('up') };
      assert.ok(sd('up') < 0.03, `${name}: 마지막 0.5 s 칼 손이 머묾 (흔들림 ${sd('up')})`);
      R.sUp(1, p.x, p.y);
      for (let i = 0; i < 30; i++) { Pl.handHeld = false; Pl.inputActive = false; Pl.handGrip = false; frame(R, Pl.handOffset); G.step(); G.step(); }
    }
    assert.ok(res.up.up > res.down.up + 0.3, `위 ${res.up.up} > 아래 ${res.down.up}`);
    assert.ok(Math.abs(res.right.side - res.left.side) > 0.15, `오른쪽 ${res.right.side} · 왼쪽 ${res.left.side}`);
  } finally { B.G.world.free(); }
});

test('⑥ 물리: 손잡이 튕김(위 끝 → 아래 끝 4 프레임)은 휘두르기 · 칼끝이 빠름 — 같은 손 목표 길을 손가락이 그으면 판이 바이트 같음 (새 빠르기 · 힘 규칙 없음)', async () => {
  const run = async (src) => {
    const B = await body(4);
    try {
      const { G, Pl } = B;
      const R = rig(src === 'stick' ? 'stick' : 'both');
      const hand = Pl.handOffset;
      // 위 끝 쥐기 (닿기까지 1 s)
      const up = P(0, 1);
      if (src === 'stick') R.sDown(1, up.x, up.y);
      const fg = { x: 0, y: 0 };
      const ds = [];
      let swing = false, tip = 0;
      const tick = (d) => {
        hand.x += d.x; hand.y += d.y;
        Pl.handHeld = true;
        Pl.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
        Pl.handGrip = true;
        G.step(); G.step();
        swing ||= Pl.skill.swinging;
        tip = Math.max(tip, Pl.tipVel.length());
      };
      const seq = [];
      for (let i = 0; i < 60; i++) seq.push(null);
      for (let i = 1; i <= 4; i++) seq.push(1 - (2 * i) / 4);
      for (let i = 0; i < 30; i++) seq.push(-1);
      // 손가락 판은 조이스틱 판에서 받아 둔 손 목표 몫을 그대로 끌기 몫으로 (main.js 의 d 자리 하나)
      for (let i = 0; i < seq.length; i++) {
        if (src === 'stick') {
          if (seq[i] != null) R.sMove(1, P(0, seq[i]).x, P(0, seq[i]).y);
          const { d } = frame(R, { x: hand.x, y: hand.y });
          ds.push([d.x, d.y]);
          tick(d);
        } else {
          const d = { x: src[i][0], y: src[i][1] };
          fg.x += d.x;
          tick(d);
        }
      }
      return { ds, swing, tip, key: JSON.stringify([Pl.sword.translation(), Pl.sword.linvel(), Pl.handOffset]) };
    } finally { B.G.world.free(); }
  };
  const s = await run('stick');
  assert.equal(s.swing, true, '튕김 = 휘두르기');
  assert.ok(s.tip > 8, `칼끝 ${s.tip} m/s`);
  const f = await run(s.ds);
  assert.equal(f.key, s.key, '같은 손 목표 길 = 같은 판 (손가락 끌기 몫과 같은 자리)');
});

test('main.js 길 (브라우저 모듈이라 줄로 봄): 조이스틱 몫을 손가락 끌기 몫 d 에 더한 뒤에 긋기 · 비기 · 원 · 고유 동작 · 손 목표가 읽음 · 쥠 = 조이스틱 엄지 쥠 · 0 판은 붙이지 않음', () => {
  const src = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  const i = (s) => {
    const k = src.indexOf(s);
    assert.ok(k >= 0, `없음: ${s}`);
    return k;
  };
  const add = i('if (input.atk) { const s = atkStickStep(input.atk, player.handOffset, dt); d.x += s.x; d.y += s.y; }');
  assert.ok(add > i('const d = input.consumeHandDelta();\n'), '손가락 몫 뒤');
  for (const s of ['const swipe = Math.hypot(d.x, d.y)', 'player.skill.uniq?.feed(d.x, d.y', 'player.handOffset.x += d.x * inScale', 'player.inputActive = !secBusy']) assert.ok(i(s) > add, `조이스틱 몫 뒤에 읽음: ${s}`);
  i('grip: prD && !prD.mouse ? (prD.atk ? input.atk.grip : prD.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx))');
  i('player.handGrip = pr && !pr.mouse ? (pr.atk ? input.atk.grip : pr.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx)) : player.inputActive;');
  i("const atkStickOn = !!(input.isTouchDevice && attachAtkStick(input, $('atkStick'), $('atkKnob'), CONFIG.INPUT.atkStick));");
  i("if (params.has('atkStick')) CONFIG.INPUT.atkStick = atkStickMode(params.get('atkStick'));");
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<div id="atkStick" aria-label="공격 조이스틱"><div id="atkKnob"></div></div>'));
});
