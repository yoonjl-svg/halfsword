// 사람 기력 회복 시험 (사장님 10/29 17:5x '인간 플레이어의 기력 회복 속도 25로 상승시켜.' — config STAMINA.humanRecoverPerSecond · stamina.js recoverRate):
//   사람 입력이 모는 몸(main.js 플레이어 — Fighter 옵션 human: true → humanInput)만 실제 초당 21 → 25 · AI 15 그대로 · 시뮬 대본 몸(AI 도 사람 입력도 아님 — 자리 0 이어도)은 21 그대로(관문 바이트 같음).
//   쉼(0.6 s) 뒤 회복 · 자연 회복 탈진(−70 → −35) 모두 같은 빠르기.  node --test tools/sim/human_stamina.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina, recoverRate } from '../../src/stamina.js';
import { STAMINA, TIME, realS, realRate } from '../../src/config.js';
import { RAPIER, THREE, newRound } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f);
  return f;
}
/** 바닥(탈진)에서 가득까지 걸린 실제 초 (아무것도 안 함 · 막기 안 쥠) */
function refill(f, dt = 1 / 120) {
  f.stamina.spend('attack', STAMINA.max - STAMINA.floor);
  near(f.stamina.value, STAMINA.floor);
  let t = 0;
  let exT = null;
  while (f.stamina.value < STAMINA.max - 1e-9 && t < 60) {
    f.stamina.step(dt);
    t += dt;
    if (exT == null && !f.stamina.exhausted) exT = t;
  }
  return { full: t / TIME.k, exhaust: exT / TIME.k };
}

test('기본값 — 사람 25 · 시뮬 대본 몸 21 · AI 15 (실제 초당)', () => {
  near(STAMINA.humanRecoverPerSecond, realRate(25));
  near(STAMINA.playerRecoverPerSecond, realRate(21));
  near(STAMINA.recoverPerSecond, realRate(15));
  near(recoverRate({ humanInput: true }), realRate(25));
  near(recoverRate({}), realRate(21));
  near(recoverRate({ aiControlled: true }), realRate(15));
  near(recoverRate({ aiControlled: true, humanInput: true }), realRate(15)); // AI 가 모는 몸이면 AI 값
});

test('사람: 쉼 0.6 s 뒤 실제 1 s 에 +25 · 탈진 −70 → −35 1.4 s · 바닥에서 가득 6.8 s (전 21: 1.667 · 8.10 s) · AI · 대본 몸 그대로', () => {
  const h = actor({ humanInput: true });
  h.stamina.spend('attack', 50);
  const v0 = h.stamina.value;
  const T = realS(1.6);
  for (let t = 0; t < T - 1e-9; t += 1 / 120) h.stamina.step(Math.min(1 / 120, T - t));
  near(h.stamina.value, v0 + 25, 1e-6);
  const H = refill(actor({ humanInput: true }));
  near(H.exhaust, 35 / 25, 1 / 120);
  near(H.full, 170 / 25, 2 / 120);
  const S = refill(actor());
  near(S.full, 170 / 21, 2 / 120);
  const A = refill(actor({ aiControlled: true }));
  near(A.full, 170 / 15, 2 / 120);
});

test('Fighter 옵션 human: true → humanInput (main.js 플레이어) · 시뮬 자리 0 은 아님(AI 가 모는 몸도 대본 몸도)', () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    const f = new Fighter(RAPIER, world, new THREE.Scene(), new Map(), { index: 0, name: 'H', x: 0, heading: 0, look: LOOKS.player, human: true });
    assert.equal(f.humanInput, true);
    near(recoverRate(f), realRate(25));
  } finally {
    world.free();
  }
  const G = newRound({ walls: false, seed: 1 });
  try {
    assert.equal(G.player.humanInput, undefined);
    near(recoverRate(G.player), realRate(21));
    near(recoverRate(G.enemy), realRate(15));
  } finally {
    G.world.free();
  }
});
