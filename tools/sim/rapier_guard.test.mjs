// Rapier 콜백 예외 드러내기 시험 (11/17 — src/rapier_guard.js · 기록 docs/strike/ae_port_2026-11-17.md §11-2):
//  물리 엔진이 부르는 콜백(contactPair → strike → analyze 등) 안의 예외는 엔진 경계에서 삼켜져 '상처 없음'으로만 보였다.
//  이제 첫 예외를 combat.lastError 에 남기고 · 한 번 console.error · node 에서는 G.step() 이 다시 던진다.
//  node --test tools/sim/rapier_guard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { guarded, rethrowRapier } from '../../src/rapier_guard.js';

test('analyze 가 던지면 G.step() 이 그 예외를 던짐 · combat.lastError 에 남음 (전엔 판이 상처 없이 이어짐)', () => {
  const orig = Combat.prototype.analyze;
  const err = new Error('analyze 시험 예외');
  let calls = 0;
  Combat.prototype.analyze = function () { calls++; throw err; };
  const quiet = console.error;
  console.error = () => {};
  try {
    const G = newRound({ seed: 1, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI });
    let caught = null;
    try { while (G.t < 30) G.step(); } catch (e) { caught = e; }
    assert.ok(calls > 0, 'analyze 가 한 번도 안 불림 — 시험이 닿음을 못 만듦');
    assert.equal(caught, err, `G.step() 이 예외를 던지지 않음 (analyze ${calls} 번 · t ${G.t.toFixed(2)})`);
    assert.equal(G.combat.lastError, err, 'combat.lastError 에 첫 예외가 없음');
    assert.ok(calls <= 4, `첫 예외가 난 걸음에서 곧 멈춰야 함 (analyze ${calls} 번)`);
  } finally {
    Combat.prototype.analyze = orig;
    console.error = quiet;
  }
});

test('guarded · rethrowRapier: 엔진에는 대신값 · 첫 예외만 lastError · 겹친 콜백도 한 번 던지고 비움', () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const box = {};
    const a = new Error('a'), b = new Error('b');
    const fa = guarded(box, () => { throw a; }, 7);
    const fb = guarded(box, () => { throw b; }, 0);
    const ok = guarded(box, (x) => x * 2, 0);
    assert.equal(ok(3), 6, '예외 없으면 그대로');
    rethrowRapier(box);
    assert.equal(box.lastError, undefined, '예외 없으면 아무것도 안 남김');
    const outer = guarded(box, () => { fb(); rethrowRapier(box); return 1; }, -1);
    assert.equal(outer(), -1, '안쪽 예외가 바깥 콜백에서 다시 잡혀 대신값');
    assert.equal(fa(), 7);
    assert.throws(() => rethrowRapier(box), (e) => e === b);
    assert.equal(box.lastError, b, '첫 예외가 남음');
    rethrowRapier(box);
    assert.equal(box.pending, null, '한 번 던지면 비움');
  } finally {
    console.error = quiet;
  }
});
