// 사람 저절로 줍기 · 칼 팔 다침 한 줄 시험 ([사장님 11/18 결정] '못 줍는 규칙은 그대로 두고, 떨어질 때 칼 팔을 다쳐 칼을 쥘 수 없다 같은 한 줄 … 단, 자동으로 줍게 하자.
//  … 일단 칼 근처로 가면 그 다음부터는 내 입력과 무관히 자동으로 다가가서 칼을 주움.' — src/pickup.js humanPickup · config PICKUP.near · 기록 docs/strike/auto_pickup_2026-11-18.md)
//  사람 몸 = humanInput (main.js 플레이어와 같은 표시) · 상대는 멀리 치워 둠(park). 입력(G.before — main.js 프레임 입력 자리)은 칼과 반대쪽으로 걷고 막기를 안 누름.
//  node --test tools/sim/auto_pickup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, DT } from './harness_m.mjs';
import { PICKUP_HOOKS, wreckedArm, canPickup } from '../../src/pickup.js';

const PU = CONFIG.PICKUP;
const run = (g, s, stop = () => false) => { for (let i = 0; i < s / DT && !stop(); i++) g.step(); };

/** 사람 몸(자리 0 — humanInput) 하나 · 상대 치움 · input(P) = 프레임 입력 (기본: 아무것도 안 함) */
function round(weapon = 'longsword', seed = 3) {
  const g = newRound({ weapon, seed, walls: true, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  g.park();
  const P = g.player;
  g.input = () => { P.move.set(0, 0); P.stickX = P.stickY = 0; P.pickupPress = false; };
  g.before = () => g.input(P);
  return g;
}
/** 칼을 놓치고 dist m (몸 기준 방향 a° — 0 = 앞) 자리 땅에 둠 (떨어져 멈출 때까지 · 놓친 바로 그 스텝에 옮겨 손 곁에서 저절로 줍지 않게) */
function dropAt(g, dist, a = 0, arm = null) {
  const P = g.player;
  if (arm != null) P.limbs.armS = arm;
  P.dropSword();
  place(g, dist, a, 0.15);
  run(g, 1.2);
}
function place(g, dist, a = 0, y = null) {
  const P = g.player, p = P.bodies.pelvis.translation(), s = P.sword.translation(), F = P.forward(), R = P.right(), th = (a * Math.PI) / 180;
  P.sword.setTranslation({ x: p.x + (F.x * Math.cos(th) + R.x * Math.sin(th)) * dist, y: y ?? s.y, z: p.z + (F.z * Math.cos(th) + R.z * Math.sin(th)) * dist }, true);
  P.sword.setLinvel({ x: 0, y: 0, z: 0 }, true);
  P.sword.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
const gripD = (P) => { const p = P.bodies.pelvis.translation(), s = P.sword.translation(); return Math.hypot(s.x - p.x, s.z - p.z); };
/** 칼에서 멀어지는 입력 (몸 기준 칼 반대쪽 스틱 1) */
const awayInput = (P) => {
  const p = P.bodies.pelvis.translation(), s = P.sword.translation(), F = P.forward(), R = P.right(), dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz) || 1;
  P.move.set((dx * R.x + dz * R.z) / d, (dx * F.x + dz * F.z) / d);
  P.stickX = P.move.x; P.stickY = P.move.y; P.pickupPress = false;
};
const towardInput = (P) => { awayInput(P); P.move.multiplyScalar(-0.7); P.stickX = P.move.x; P.stickY = P.move.y; };

test('기본값: PICKUP.near 1.5 m (감독 안) · 그만둠 near + 0.3', () => {
  assert.equal(PU.near, 1.5);
  assert.ok(PU.near > PU.reach, '줍는 문(reach) 밖에서 먼저 시작');
});

test('칼 곁(near 안)이면 저절로 걸어가 주움 — 칼과 반대로 걷는 입력 · 막기 안 누름을 버림', () => {
  const g = round();
  try {
    const P = g.player;
    run(g, 1);
    dropAt(g, 1.3, 30);
    g.input = awayInput; // 칼에서 멀어지는 입력 (버려져야 함)
    let started = null, moveOk = true;
    for (let i = 0; i < 4 / DT && !(P.armed && !P.pickup); i++) {
      g.step();
      if (P.autoPick && started == null) started = gripD(P);
      if (P.autoPick && !P.pickup && P.move.length() > 0) { const s = P.sword.translation(), p = P.bodies.pelvis.translation(), F = P.forward(), R = P.right(); const toward = (s.x - p.x) * (P.move.x * R.x + P.move.y * F.x) + (s.z - p.z) * (P.move.x * R.z + P.move.y * F.z); if (toward < 0) moveOk = false; }
    }
    assert.ok(started != null && started <= PU.near + 1e-6, `저절로 시작 (칼자루 ${started?.toFixed(2)} m)`);
    assert.equal(P.armed, true, '주움');
    assert.equal(P.pickupLog?.at(-1)?.ok, true);
    assert.ok(moveOk, '다가가는 동안 발은 칼 쪽 (입력 버림)');
    run(g, 0.6);
    assert.equal(P.autoPick, null, '다시 쥔 뒤 손을 돌려줌');
    const p0 = { ...P.bodies.pelvis.translation() };
    run(g, 0.5);
    const p1 = P.bodies.pelvis.translation();
    assert.ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.05, '돌려준 뒤엔 입력대로 걸음');
  } finally { g.world.free(); }
});

test('near 밖이면 시작 안 함 · 걸어서 near 안에 들면 그때부터 저절로', () => {
  const g = round();
  try {
    const P = g.player;
    run(g, 1);
    dropAt(g, 2.3, 0);
    const p0 = { ...P.bodies.pelvis.translation() }, d0 = gripD(P);
    run(g, 2);
    const p1 = P.bodies.pelvis.translation();
    assert.ok(d0 > PU.near, `칼자루 ${d0.toFixed(2)} m`);
    assert.equal(P.autoPick ?? null, null, '시작 안 함');
    assert.equal(P.armed, false);
    assert.ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.15, '몸이 칼로 가지 않음');
    g.input = towardInput; // 사람이 칼 쪽으로 걸음
    let started = null;
    run(g, 6, () => { if (P.autoPick && started == null) started = gripD(P); if (started != null) g.input = awayInput; return P.armed && !P.pickup; });
    assert.ok(started != null && started <= PU.near + 1e-6 && started > PU.near - 0.25, `near 에 들 때 시작 (${started?.toFixed(2)} m)`);
    assert.equal(P.armed, true, '들어간 뒤엔 반대 입력에도 주움');
  } finally { g.world.free(); }
});

test('그만둠: 넘어짐 · 칼이 near + 0.3 밖으로 · 못 줍는 칼 · 죽음 — 손을 돌려줌', () => {
  for (const why of ['down', 'far', 'arm', 'dead']) {
    const g = round();
    try {
      const P = g.player;
      run(g, 1);
      dropAt(g, 1.45, 0);
      run(g, 0.5, () => !!P.autoPick);
      assert.ok(P.autoPick, `${why}: 시작`);
      assert.equal(P.pickup ?? null, null, `${why}: 아직 다가가는 중`);
      if (why === 'down') P.knockDown(true);
      if (why === 'far') place(g, PU.near + 0.3 + 0.25, 0);
      if (why === 'arm') P.limbs.armS = CONFIG.VITALS.dropSwordArm * 0.5;
      if (why === 'dead') P.die('시험', true);
      g.input = (Q) => { Q.move.set(0.3, -0.4); Q.stickX = 0.3; Q.stickY = -0.4; Q.pickupPress = false; };
      g.step();
      assert.equal(P.autoPick, null, `${why}: 그만둠`);
      assert.equal(P.armed, false, `${why}: 칼은 땅에`);
      if (why === 'far' || why === 'arm') assert.deepEqual([+P.move.x.toFixed(2), +P.move.y.toFixed(2)], [0.3, -0.4], `${why}: 입력이 다시 발을 몬다`);
      run(g, 1);
      assert.equal(P.armed, false, `${why}: 다시 줍지 않음`);
    } finally { g.world.free(); }
  }
});

test('칼 팔을 다쳐 놓침: 못 주움 그대로 · 놓친 때 한 줄 한 번 · 손목 치기 떨굼(팔 멀쩡) · AI 몸은 줄 없음', () => {
  const calls = [];
  PICKUP_HOOKS.onArmDrop = (f) => calls.push(f.index);
  try {
    let g = round();
    try {
      const P = g.player;
      run(g, 1);
      dropAt(g, 0.7, 0, CONFIG.VITALS.dropSwordArm * 0.6);
      assert.equal(wreckedArm(P), true);
      assert.deepEqual(calls, [0], '한 줄 한 번');
      assert.equal(P.armDropNotes, 1);
      run(g, 3);
      assert.equal(P.armed, false, '못 주움');
      assert.equal(P.autoPick ?? null, null);
      assert.equal(P.pickupLog, undefined);
      assert.deepEqual(calls, [0], '더 띄우지 않음');
    } finally { g.world.free(); }
    g = round();
    try {
      const P = g.player;
      run(g, 1);
      dropAt(g, 0.7, 0);
      run(g, 2, () => P.armed && !P.pickup);
      assert.equal(P.armed, true, '손목 치기 떨굼 — 저절로 주움');
      assert.deepEqual(calls, [0], '줄 없음');
    } finally { g.world.free(); }
    g = newRound({ weapon: 'longsword', seed: 4, walls: true });
    try {
      const E = g.enemy;
      run(g, 1);
      E.limbs.armS = 0.05; E.dropSword();
      run(g, 1);
      assert.deepEqual(calls, [0], 'AI 몸은 줄 없음');
      assert.equal(E.autoPick, undefined, 'AI 는 aiPickup 그대로');
    } finally { g.world.free(); }
    assert.equal(wreckedArm({ severedLimbs: new Set(['armS']), limbs: { armS: 0.9 } }), true, '잘린 팔');
    assert.equal(canPickup({ alive: true, armed: false, sword: {}, state: 'stand', severedLimbs: new Set(['armS']), limbs: { armS: 0.9 } }), false);
  } finally { PICKUP_HOOKS.onArmDrop = null; }
});

test('사람 몸이 아니면(humanInput 없음 — 시뮬 대본 몸) 그대로: 저절로 줍지 않고 누름으로만', () => {
  const g = newRound({ weapon: 'longsword', seed: 3, walls: true });
  try {
    g.park();
    const P = g.player;
    let press = false;
    g.before = () => { P.move.set(0, 0); P.stickX = P.stickY = 0; P.pickupPress = press; };
    run(g, 1);
    P.dropSword(); place(g, 0.7, 0, 0.15); run(g, 2);
    assert.equal(P.armed, false); assert.equal(P.autoPick, undefined);
    press = true; run(g, 1.5);
    assert.equal(P.armed, true);
  } finally { g.world.free(); }
});
