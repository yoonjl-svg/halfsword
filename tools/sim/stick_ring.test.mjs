// 이동 스틱 둘레 (사장님 10/31 08:xx '새값 ok 본판에 넣어 이동스틱 주위의 일정 픽셀(+10~20px 정도)에선 공격 커맨드 입력이 안되도록 해.' — 확인표 3096 ~ 3099):
//   스틱 원(그려진 자리 · 크기) 바깥 INPUT.stickGuardPx(15) 안에 닿은 손가락은 칼 입력이 아님(탭 · 긋기 · 길게 누름 · 권총) · stickGuardGrab 1 이면 그 손가락이 스틱을 쥠 ·
//   둘레 밖 · 칼 쪽 손가락은 그대로 · 원 안 누름(패드 사건)은 그대로.  node --test tools/sim/stick_ring.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUT } from '../../src/config.js';

const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input, attachStick } = await import('../../src/input.js');
// 844 × 390 가로 화면 · 스틱 left 20 · bottom 20 · 110 px (index.html #moveStick) → 가운데 (75, 315) · 반지름 55
const PAD = { left: 20, top: 260, width: 110, height: 110 };
const C = { x: 75, y: 315 };
function rig({ hidden = false } = {}) {
  const L = {};
  const canvas = { addEventListener(t, f) { (L[t] ??= []).push(f); } };
  const PL = {};
  const cap = new Set();
  const pad = { addEventListener(t, f) { (PL[t] ??= []).push(f); }, getBoundingClientRect: () => (hidden ? { left: 0, top: 0, width: 0, height: 0 } : PAD), setPointerCapture: (id) => cap.add(id), releasePointerCapture: (id) => cap.delete(id), hasPointerCapture: (id) => cap.has(id) };
  const knob = { style: { transform: '' } };
  const input = withBrowser(() => new Input(canvas, new URLSearchParams('mobileVerticalGain=1')));
  withBrowser(() => attachStick(input, pad, knob));
  input.enabled = true;
  let ms = 1000;
  const ev = (type, id, x, y) => ({ type, pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: ms, stopPropagation() {}, target: canvas });
  const down = (id, x, y) => withBrowser(() => input.onDown(ev('pointerdown', id, x, y)));
  const move = (id, x, y) => withBrowser(() => input.onMove(ev('pointermove', id, x, y)));
  const up = (id, x, y) => withBrowser(() => { input.onUp(ev('pointerup', id, x, y)); if (cap.has(id)) for (const f of PL.pointerup ?? []) f({ ...ev('pointerup', id, x, y), target: pad }); });
  const padMove = (id, x, y) => withBrowser(() => { for (const f of PL.pointermove ?? []) f({ ...ev('pointermove', id, x, y), target: pad }); });
  return { input, down, move, up, padMove, wait: (d) => { ms += d; }, cap, knob };
}
const at = (r, deg = -45) => ({ x: C.x + r * Math.cos((deg * Math.PI) / 180), y: C.y + r * Math.sin((deg * Math.PI) / 180) });

test('기본값 — 둘레 15 px (사장님 10 ~ 20 px) · 둘레 손가락은 스틱을 쥠', () => {
  assert.equal(INPUT.stickGuardPx, 15);
  assert.equal(INPUT.stickGuardGrab, 1);
});

test('둘레 안 (원 밖 1 ~ 15 px): 칼 손가락이 아님 — 탭 · 누름 없음 · 스틱을 쥠 (그쪽으로 끝까지)', () => {
  for (const r of [56, 60, 65, 69.9]) {
    const { input, down, up, wait, cap, knob } = rig();
    const p = at(r);
    down(1, p.x, p.y);
    assert.equal(input.activeTouch, null, `칼 손가락 아님 ${r}`);
    assert.equal(input.press, null);
    assert.equal(input.holdState().down, false, '길게 누름 아님');
    assert.ok(cap.has(1), '스틱이 포인터를 쥠');
    const { x, y } = input.stickMove;
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-6 && x > 0.7 && y > 0.7, `오른 앞으로 끝까지 기욺 ${JSON.stringify(input.stickMove)}`);
    assert.notEqual(knob.style.transform, '');
    wait(60);
    up(1, p.x, p.y);
    assert.equal(input.consumeTaps(), 0, '탭 찌르기 없음');
    assert.deepEqual(input.stickMove, { x: 0, y: 0 }, '떼면 스틱 놓음');
  }
});

test('둘레에서 쥔 엄지가 끌면 스틱이 따라감 · 그동안 오른 엄지 탭 · 길게 누름은 그대로', () => {
  const { input, down, up, padMove, wait } = rig();
  const p = at(62, 0); // 원 오른쪽 7 px 밖
  down(1, p.x, p.y);
  padMove(1, C.x, C.y - 50); // 위로 (앞)
  assert.ok(input.stickMove.y > 0.9 && Math.abs(input.stickMove.x) < 0.05, JSON.stringify(input.stickMove));
  // 오른 엄지 탭
  down(2, 600, 200);
  assert.equal(input.activeTouch, 2);
  wait(60);
  up(2, 600, 200);
  assert.equal(input.consumeTaps(), 1, '오른 엄지 탭 찌르기');
  // 오른 엄지 길게 누름
  down(3, 610, 210);
  wait(700);
  assert.deepEqual(input.holdState(), { down: true, still: true });
  up(3, 610, 210);
  assert.equal(input.consumeTaps(), 0);
  up(1, C.x, C.y - 50);
  assert.deepEqual(input.stickMove, { x: 0, y: 0 });
});

test('둘레 바로 밖 (원 밖 16 px 넘게 · 칼 쪽): 탭 · 긋기 그대로', () => {
  for (const [r, deg] of [[71, -45], [72, 0], [75, -90], [90, -20]]) {
    const { input, down, move, up, wait } = rig();
    const p = at(r, deg);
    down(1, p.x, p.y);
    assert.equal(input.activeTouch, 1, `칼 손가락 ${r} · ${deg}°`);
    wait(60);
    up(1, p.x, p.y);
    assert.equal(input.consumeTaps(), 1, `탭 ${r} · ${deg}°`);
    assert.deepEqual(input.stickMove, { x: 0, y: 0 }, '스틱 그대로');
    // 끌기
    down(2, p.x, p.y);
    move(2, p.x + 60, p.y - 20);
    const d = input.consumeHandDelta();
    assert.ok(d.x > 0.3, '손이 움직임');
    up(2, p.x + 60, p.y - 20);
  }
});

test('스틱을 이미 다른 엄지가 쥐었으면 둘레 손가락은 버리기만 (칼도 스틱도 아님)', () => {
  const { input, down, up, wait } = rig();
  const a = at(60, -60);
  down(1, a.x, a.y);
  const s0 = { ...input.stickMove };
  const b = at(64, -10);
  down(2, b.x, b.y);
  assert.equal(input.activeTouch, null);
  assert.deepEqual(input.stickMove, s0, '스틱은 첫 엄지 것');
  wait(60);
  up(2, b.x, b.y);
  assert.equal(input.consumeTaps(), 0);
  up(1, a.x, a.y);
});

test('stickGuardGrab 0 = 버리기만 · stickGuardPx 0 = 전 판(둘레 없음 — 원 밖 캔버스 손가락은 칼) · 숨은 스틱 = 둘레 없음', () => {
  const g0 = INPUT.stickGuardGrab;
  const p0 = INPUT.stickGuardPx;
  try {
    INPUT.stickGuardGrab = 0;
    let R = rig();
    let p = at(62);
    R.down(1, p.x, p.y);
    assert.equal(R.input.activeTouch, null);
    assert.deepEqual(R.input.stickMove, { x: 0, y: 0 }, '스틱 안 쥠');
    R.wait(60);
    R.up(1, p.x, p.y);
    assert.equal(R.input.consumeTaps(), 0);
    INPUT.stickGuardGrab = 1;
    INPUT.stickGuardPx = 0;
    R = rig();
    R.down(1, p.x, p.y);
    assert.equal(R.input.activeTouch, 1, '전 판: 칼 손가락');
    R.wait(60);
    R.up(1, p.x, p.y);
    assert.equal(R.input.consumeTaps(), 1);
    INPUT.stickGuardPx = 15;
    R = rig({ hidden: true });
    R.down(1, p.x, p.y);
    assert.equal(R.input.activeTouch, 1, '숨은 스틱: 둘레 없음');
  } finally {
    INPUT.stickGuardGrab = g0;
    INPUT.stickGuardPx = p0;
  }
});

test('권총: 둘레 손가락은 쏘지 않음 · 둘레 밖은 닿는 순간 쏨 (그대로)', () => {
  const { input, down } = rig();
  input.tapOnDown = true;
  const p = at(63);
  down(1, p.x, p.y);
  assert.equal(input.consumeTaps(), 0);
  down(2, 600, 200);
  assert.equal(input.consumeTaps(), 1);
});
