// 막아찌르기 입력형 (10/21): 막기 단추 새 누름 = 바로 약한 찌르기 한 번 · 누른 때부터 0.6 s 받는 칼날 상처 × 0.5 · 찌르는 동안 주는 피해 × 0.6.
// 실제 물리 몸에서 상태 · 비용 · 취소를 본다. 효과(이기나 지나)의 증거는 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
const V = CONFIG.SKILL.itOppositionVals;
function fixture(weapon = 'rapier') {
  const g = newRound({ weapon, weapon2: 'longsword', gap: 1.6, seed: 9 });
  const f = g.player, a = g.enemy; g.ai.update = () => {}; f.foe = a; a.foe = f;
  const guard = new PlayerParryGuard(f, a); f.stamina.controller = guard;
  const press = () => { guard.held = true; guard.step(DT); };
  const release = () => { guard.held = false; guard.step(DT); };
  return { g, f, a, guard, mod: guard.opposition, press, release };
}
const run = (fx, sec) => { for (let i = 0; i < Math.round(sec / DT); i++) { fx.guard.step(DT); fx.f.skill.update(DT); } };

test('new press starts one paid thrust at once — no contact, no foe attack needed', () => {
  const fx = fixture();
  try {
    const { f, mod, guard, press } = fx;
    press();
    assert.ok(mod.run); assert.equal(mod.starts, 1);
    assert.ok(Math.abs(f.stamina.spent.attack - CONFIG.STAMINA.thrustCost * f.stamina.weight) < 1e-8, 'one normal thrust');
    assert.equal(guard.woundKeep(), 1 - V.shieldCut);
    assert.equal(mod.dealtK(), V.dealt);
  } finally { fx.g.world.free(); }
});

test('holding does not repeat; a new press after the move starts again; a press during the move is not queued', () => {
  const fx = fixture();
  try {
    const { mod, press, release } = fx;
    press(); run(fx, .2); release(); press(); // 진행 중 다시 누름 — 예약 없음
    assert.equal(mod.starts, 1);
    run(fx, 1.2); assert.equal(mod.run, null); assert.equal(mod.lastEnd.reason, 'complete');
    assert.equal(mod.starts, 1, 'held after the move = ordinary block, no second thrust');
    release(); press(); assert.equal(mod.starts, 2);
  } finally { fx.g.world.free(); }
});

test('a short tap still finishes the move', () => {
  const fx = fixture();
  try {
    const { mod, press, release } = fx;
    press(); release(); run(fx, .1); assert.ok(mod.run, 'release does not cancel');
    run(fx, 1.2); assert.equal(mod.lastEnd.reason, 'complete');
  } finally { fx.g.world.free(); }
});

test('protection lasts shield seconds of real time even when the move is slowed', () => {
  const fx = fixture();
  try {
    const { f, mod, guard, press } = fx;
    f.stamina.level = 1; press();
    run(fx, V.shield - .05); assert.equal(guard.woundKeep(), 1 - V.shieldCut);
    run(fx, .1); assert.equal(guard.woundKeep(), 1, 'ends at 0.6 s');
    if (mod.run) assert.equal(mod.dealtK(), V.dealt); // 지쳐 느린 동작은 아직 찌르는 중일 수 있다 — 주는 피해만 낮다
  } finally { fx.g.world.free(); }
});

for (const mode of ['exhaustion', 'manual', 'down', 'lost', 'enemyDead', 'broken']) {
  test(`interrupt cancels the move and its protection: ${mode}`, () => {
    const fx = fixture();
    try {
      const { f, a, guard, mod, press } = fx;
      press(); assert.ok(mod.run);
      if (mode === 'exhaustion') f.stamina.exhaustLeft = 1;
      if (mode === 'manual') { f.skill.thrust(); assert.ok(f.skill.tap); }
      if (mode === 'down') f.state = 'down';
      if (mode === 'lost') f.armed = false;
      if (mode === 'enemyDead') a.state = 'dead';
      if (mode === 'broken') guard.broken = true;
      f.skill.update(DT);
      assert.equal(mod.run, null); assert.equal(mod.lastEnd.reason, 'interrupt');
      guard.step(DT); assert.equal(guard.woundKeep(), 1);
      if (mode === 'manual') assert.ok(f.skill.tap, 'manual attack keeps ownership of pose');
    } finally { fx.g.world.free(); }
  });
}

for (const mode of ['bookOff', 'otherWeapon', 'disabled', 'broken']) {
  test(`no start: ${mode}`, () => {
    const fx = fixture(mode === 'otherWeapon' ? 'longsword' : 'rapier');
    try {
      const { f, guard, mod, press } = fx;
      if (mode === 'bookOff') f.schoolParry = false;
      if (mode === 'disabled') CONFIG.SKILL.itOpposition = 0;
      if (mode === 'broken') guard.broken = true;
      press();
      assert.equal(mod.run, null); assert.equal(mod.starts, 0); assert.equal(guard.woundKeep(), 1);
    } finally { CONFIG.SKILL.itOpposition = 1; fx.g.world.free(); }
  });
}

test('blade contact during the move is not billed as a separate block', () => {
  const fx = fixture();
  try {
    const { f, a, press } = fx;
    press(); a.stamina.attack('cut');
    const before = f.stamina.spent.block ?? 0; f.stamina.block(a);
    assert.equal(f.stamina.spent.block ?? 0, before);
  } finally { fx.g.world.free(); }
});

test('real physics round: one press, one paid thrust, completes', () => {
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 1.65, seed: 1 });
  try {
    const p = g.player, a = g.enemy; p.fightT = a.fightT = CONFIG.ARENA.startHold;
    p.skill.corr = CONFIG.SKILL.corr; p.skill.corrTip = CONFIG.SKILL.corrTip; p.skill.autoGuard = true;
    const guard = new PlayerParryGuard(p, a); p.stamina.controller = guard; g.ai.update = () => {};
    g.before = () => { if (g.t > .6) guard.held = true; guard.step(DT); p.inputActive = guard.active; a.move.set(0, 0); };
    for (let i = 0; i < 180; i++) g.step();
    assert.equal(guard.opposition.starts, 1);
    assert.equal(guard.opposition.lastEnd?.reason, 'complete');
    assert.ok(Math.abs(p.stamina.spent.attack - CONFIG.STAMINA.thrustCost * p.stamina.weight) < 1e-8);
  } finally { g.world.free(); }
});
