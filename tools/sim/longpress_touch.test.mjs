// 길게 누름 떠돎 한도 · 가벼운 손끝 기력 (사장님 10/31 01:4x '탭을 오래 누르고 있는 커맨드가 잘 안 먹혀. 그래서 레돈두가 잘 실행되지 않음.' ·
//  01:5x '화면에 손가락을 아주 조금 대거나 여러 번 잘못 톡톡 건드려질 때 실제로 아무 커맨드 입력은 안 되면서 기력은 소모되거든') — 기록 docs/strike/longpress_touch_2026-10-31.md
//   ① input.js holdState: 손가락 길게 누름은 INPUT.holdPx(24) 안이면 '끌지 않음' · 탭 판정(tapMs 180 · tapPx 12) · 마우스(clickPx 6)는 그대로
//   ② stamina.js: 사람 입력 몸(humanInput)의 긋기는 손 목표가 STAMINA.humanStrokeMin(0.15 패드 m) 넘게 움직여야 베기로 청구 · 탭 찌르기 10 · 칼 닿음 청구 · AI · 시뮬 대본 몸 그대로
//  node --test tools/sim/longpress_touch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina } from '../../src/stamina.js';
import { STAMINA, INPUT } from '../../src/config.js';

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input } = await import('../../src/input.js');
function newInput() {
  const L = {};
  const canvas = { addEventListener(t, f) { (L[t] ??= []).push(f); } };
  const input = withBrowser(() => new Input(canvas, new URLSearchParams('mobileVerticalGain=1')));
  input.enabled = true;
  let ms = 1000;
  const send = (type, x, y, o = {}) => withBrowser(() => { const e = { type, pointerId: 1, pointerType: o.mouse ? 'mouse' : 'touch', button: 0, clientX: x, clientY: y, movementX: o.mx ?? 0, movementY: o.my ?? 0, timeStamp: ms }; type === 'pointerdown' ? input.onDown(e) : type === 'pointermove' ? input.onMove(e) : input.onUp(e); });
  return { input, send, wait: (d) => { ms += d; }, L };
}

test('기본값 — 길게 누름 떠돎 24 px · 탭 180 ms · 12 px · 마우스 6 px 그대로 · 사람 긋기 바닥 0.15 m · 긋기 0.06 m 그대로', () => {
  assert.equal(INPUT.holdPx, 24);
  assert.equal(INPUT.tapMs, 180);
  assert.equal(INPUT.tapPx, 12);
  assert.equal(INPUT.clickPx, 6);
  near(STAMINA.humanStrokeMin, 0.15);
  near(STAMINA.strokeTravel, 0.06);
  assert.equal(STAMINA.cutCost, 12);
  assert.equal(STAMINA.thrustCost, 10);
});

test('길게 누름: 엄지가 0.6 s 동안 20 px 떠돌아도 끌지 않음 · 25 px 넘으면 끌기 (전 판은 12 px)', () => {
  for (const [drift, still] of [[0, true], [6, true], [11, true], [15, true], [20, true], [23, true], [25, false], [40, false]]) {
    const { input, send, wait } = newInput();
    send('pointerdown', 600, 200);
    for (let i = 1; i <= 36; i++) { wait(1000 / 60); send('pointermove', 600 + (drift * Math.min(1, i / 20)) * 0.8, 200 + (drift * Math.min(1, i / 20)) * 0.6); }
    const hs = input.holdState();
    assert.equal(hs.down, true);
    assert.equal(hs.still, still, `떠돎 ${drift} px`);
  }
});

test('탭 판정은 그대로 — 12 px · 180 ms 문턱 (길게 누름 한도와 따로)', () => {
  for (const [dur, move, tap] of [[60, 0, true], [60, 11, true], [60, 13, false], [170, 5, true], [200, 0, false], [400, 0, false]]) {
    const { input, send, wait } = newInput();
    send('pointerdown', 600, 200);
    wait(dur / 2);
    send('pointermove', 600 + move, 200);
    wait(dur / 2);
    send('pointerup', 600 + move, 200);
    assert.equal(input.consumeTaps(), tap ? 1 : 0, `${dur} ms · ${move} px`);
  }
});

test('마우스 길게 누름은 clickPx 6 그대로', () => {
  const { input, send } = newInput();
  globalThis.document = { pointerLockElement: null };
  try {
    send('pointerdown', 600, 200, { mouse: true });
    input.press.moved = 5;
    assert.equal(input.holdState().still, true);
    input.press.moved = 7;
    assert.equal(input.holdState().still, false);
  } finally { delete globalThis.document; }
});

test('캔버스: 길게 누름 메뉴 · 글자 고르기 시작을 막음 (iOS)', () => {
  const { L } = newInput();
  for (const t of ['contextmenu', 'selectstart']) {
    assert.ok(L[t]?.length, t);
    let stopped = false;
    L[t][0]({ preventDefault: () => { stopped = true; } });
    assert.ok(stopped, t);
  }
});

// ── 기력 ──
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f);
  return f;
}
// 손 목표를 dist(패드 m)만큼 steps 스텝 동안 빠르게 옮김 (휘두르기) → 쉼 0.3 s (긋기 끝맺음)
function flick(f, dist, steps = 2, dir = [0.8, 0.6]) {
  const dt = 1 / 120;
  f.stamina.step(dt); // 쉬던 손 (긋기 시작 자리)
  for (let i = 0; i < steps; i++) {
    f.skill.swinging = true;
    f.skill.vel.set((dir[0] * dist) / (steps * dt), (dir[1] * dist) / (steps * dt));
    f.handOffset.x += (dir[0] * dist) / steps;
    f.handOffset.y += (dir[1] * dist) / steps;
    f.stamina.step(dt);
  }
  f.skill.swinging = false;
  f.skill.vel.set(0, 0);
  for (let i = 0; i < 40; i++) f.stamina.step(dt);
}

test('사람: 가벼운 손끝(손 0.07 ~ 0.14 m 빠른 떨림)은 베기로 청구 안 함 · 0.16 m 넘는 긋기는 12 — 시뮬 대본 몸 · 전 판은 0.06 m 부터 12', () => {
  for (const d of [0.07, 0.1, 0.14]) {
    const h = actor({ humanInput: true });
    h.handOffset.set(0.1, 0.0);
    flick(h, d);
    assert.equal(h.stamina.counts.cut, 0, `사람 ${d}`);
    near(h.stamina.spent.attack, 0);
    assert.equal(h.stamina.freeStrokes, 1);
    const s = actor();
    s.handOffset.set(0.1, 0.0);
    flick(s, d);
    assert.equal(s.stamina.counts.cut, 1, `대본 몸 ${d}`);
  }
  const h = actor({ humanInput: true });
  h.handOffset.set(0.1, 0.0);
  flick(h, 0.3, 4);
  assert.equal(h.stamina.counts.cut, 1);
  near(h.stamina.spent.attack, 12);
});

test('사람: 떼기 직전 미끄러진 탭 = 찌르기 10 하나 (전 판 22 — 찌르기 10 + 미끄러짐 베기 12)', () => {
  const h = actor({ humanInput: true });
  h.handOffset.set(0.1, 0.0);
  const dt = 1 / 120;
  h.stamina.step(dt); // 쉬던 손
  h.skill.swinging = true;
  h.skill.vel.set(8, 0);
  h.handOffset.x += 0.067;
  h.stamina.step(dt);
  h.skill.swinging = false;
  h.stamina.attack('thrust');
  near(h.stamina.spent.attack, 10);
  assert.equal(h.stamina.counts.cut, 0);
  assert.equal(h.stamina.counts.thrust, 1);
  const saved = STAMINA.humanStrokeMin;
  STAMINA.humanStrokeMin = 0; // `?strokeMin=0` = 전 판
  try {
    const o = actor({ humanInput: true });
    o.handOffset.set(0.1, 0.0);
    o.stamina.step(dt);
    o.skill.swinging = true;
    o.skill.vel.set(8, 0);
    o.handOffset.x += 0.067;
    o.stamina.step(dt);
    o.skill.swinging = false;
    o.stamina.attack('thrust');
    near(o.stamina.spent.attack, 22);
  } finally { STAMINA.humanStrokeMin = saved; }
});

test('사람: 짧은 손길도 칼이 닿으면 청구 (닿음 = 공격 — 그대로)', () => {
  const h = actor({ humanInput: true });
  h.handOffset.set(0.1, 0.0);
  h.stamina.step(1 / 120);
  h.skill.swinging = true;
  h.skill.vel.set(8, 0);
  h.handOffset.x += 0.07;
  h.stamina.step(1 / 120);
  h.stamina.contactAttack('cut');
  near(h.stamina.spent.attack, 12);
});
