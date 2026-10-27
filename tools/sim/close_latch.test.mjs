// 밀치기 걸쇠 없앰 (10/25 23:3x 사장님 '밀치기는 붙은 거리 안에서 스틱을 한 번 놓았다가 다시 밀어야 시작됩니다 -> 이 걸쇠 없애. 밀치기의 도입 취지와도 맞지 않아.' — CLOSE.latch · fighter.js closeStep):
//  ① 스틱을 앞으로 쥔 채 걸어 들어오면 닿는 거리 안에서 곧장 밀치기 · 밀치는 동안은 새로 안 붙음 · 끝나도 밀고 있으면 곧장 다음 · ?closeLatch=1 이면 전 판(놓았다 밀어야)
//  ② 탈진으로 풀린 누르기는 한 번 놓아야 다시 (stamina.js '누르기 해제' 가 같은 스텝에 다시 눌리지 않게)
//  node --test tools/sim/close_latch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';

const { CLOSE } = CONFIG;
const withClose = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = CLOSE[k]), (CLOSE[k] = vals[k]); try { return fn(); } finally { Object.assign(CLOSE, old); } };

/** 사람 자리가 2 s 부터 스틱 앞으로 쥔 채 걸어 들어감(놓지 않음) · 상대는 가만히 · T 초 동안 밀치기 셈 */
function holdIn(T = 6) {
  const g = newRound({ weapon: 'longsword', seed: 7, gap: 1.6, sameLook: true });
  g.ai.update = () => g.enemy.move.set(0, 0);
  const P = g.player;
  P.canShove = true;
  const out = { starts: 0, firstAt: null, barges: new Set(), maxSame: 0, ends: {} };
  let prev = null;
  g.before = (t) => {
    const v = t < 2 ? 0 : 1;
    P.move.set(0, v); P.stickX = 0; P.stickY = v;
  };
  try {
    for (let i = 0; i < T / DT; i++) {
      g.step();
      const b = P.barge;
      if (b && b !== prev) { out.starts++; out.barges.add(b); if (out.firstAt == null) out.firstAt = g.t; }
      if (!b && prev) out.ends[P.bargeEnd] = (out.ends[P.bargeEnd] ?? 0) + 1;
      prev = b;
    }
    out.shoves = P.shoves;
    out.reach = CLOSE.reach(P.weapon);
  } finally { g.world.free(); }
  return out;
}

test('기본값: 걸쇠 없음 (사람 · AI)', () => {
  assert.equal(CLOSE.latch, 0);
  assert.equal(CLOSE.latchAI, 0);
});

test('① 쥔 채 걸어 들어오면 곧장 밀치기 · 밀치는 동안 새로 안 붙음(밀치기 하나 = 시작 하나) · 전 판(?closeLatch=1)은 밀치기 없음', () => {
  const on = holdIn();
  assert.ok(on.starts >= 1 && on.firstAt != null, `밀치기 ${on.starts}`);
  assert.equal(on.shoves, on.starts, '시작 셈 = 밀치기 셈 (한 밀치기가 스텝마다 다시 붙지 않음)');
  assert.ok(on.starts < 6 / 0.3, `밀치기 ${on.starts} — 스텝마다 거듭 안 남`);
  const off = withClose({ latch: 1 }, () => holdIn());
  assert.equal(off.starts, 0, '걸쇠 판 — 스틱을 놓지 않으면 밀치기 없음');
});

test('② 탈진으로 풀린 누르기는 스틱을 한 번 놓아야 다시 (bargeEnd exhausted — 걸쇠처럼)', () => {
  const g = newRound({ weapon: 'longsword', seed: 7, gap: 0.6, sameLook: true });
  g.ai.update = () => g.enemy.move.set(0, 0);
  const P = g.player;
  P.canShove = true;
  try {
    for (let i = 0; i < 2.2 / DT; i++) g.step();
    P.move.set(0, 1); P.stickX = 0; P.stickY = 1;
    g.before = () => { P.move.set(0, 1); P.stickX = 0; P.stickY = 1; };
    for (let i = 0; i < 20 && !P.barge; i++) g.step();
    assert.ok(P.barge, '닿는 거리 안 · 쥔 채 밀치기');
    P.barge = null;
    P.bargeEnd = 'exhausted'; // stamina.js stepClinch 의 '누르기 해제' 와 같은 끝
    for (let i = 0; i < 10; i++) g.step();
    assert.equal(P.barge, null, '탈진 해제 뒤 쥔 채로는 다시 안 붙음');
    g.before = () => { P.move.set(0, 0); P.stickX = 0; P.stickY = 0; };
    g.step();
    g.before = () => { P.move.set(0, 1); P.stickX = 0; P.stickY = 1; };
    for (let i = 0; i < 10 && !P.barge; i++) g.step();
    assert.ok(P.barge, '한 번 놓았다 밀면 다시');
  } finally { g.world.free(); }
});
