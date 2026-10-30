// 기력이 모자라면 비기 못 씀 시험 (사장님 10/30 08:2x '기력이 모자라면 못써(다른 비기도 그렇게 해)' — config SECRET.secretStamina · stamina.js secretReady ·
//   secret.js PlayerSecretWatch(openWindow · fire · fireArmed 거절 · poor 셈) · skill.js secret · ai.js secretGo · spinGo · mordGo · secretPoor):
//   지금 기력 < 비기 값 STAMINA.secretCost(35 — 모든 비기 같은 값)이면 사람 창이 안 열림(열린 창도 닫힘) · AI 가 안 냄 · skill.secret 도 받지 않음 — 아무것도 안 나가고 판당 쓸 수 안 씀 ·
//   기력 무한 · 스위치 끔이면 늘 됨
//  작게 · 빠르게: 사람 창은 물리 스텝 없이 창만 돌린다.  node --test tools/sim/secret_stamina.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { TRADITIONS } from '../../src/schools.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const { SECRET, STAMINA } = CONFIG;

test('기본값 — 켬 · 비기 값 35 (새 문턱 없음) · 기력 ≥ 35 면 됨 · 무한 · 끔 · 기력 끔이면 늘 됨', () => {
  assert.equal(SECRET.secretStamina, 1);
  assert.equal(STAMINA.secretCost, 35);
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword' });
  try {
    const s = G.player.stamina;
    s.value = 35;
    assert.equal(s.secretReady, true);
    s.value = 34.9;
    assert.equal(s.secretReady, false);
    s.infinite = true;
    assert.equal(s.secretReady, true, '기력 무한');
    s.infinite = false;
    SECRET.secretStamina = 0;
    try {
      assert.equal(s.secretReady, true, '끔 = 전 판');
    } finally {
      SECRET.secretStamina = 1;
    }
  } finally {
    G.world.free();
  }
});

/** 독일 몸 + 비기 창 (몸이 붙은 채 — 모르트슐라크 조건) */
function body() {
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword', gap: 1.0 });
  const P = G.player;
  for (let i = 0; i < 3; i++) G.step();
  P.fightT = 1e3;
  P.foeDistance = () => 0.6;
  const W = new PlayerSecretWatch(P, G.enemy);
  const upd = () => W.update(DT, !!P.skill.sec);
  const until = (pred, max) => {
    for (let t = 0; t <= max; t += DT) {
      if (pred()) return t;
      upd();
    }
    return null;
  };
  return { G, P, W, upd, until, free: () => G.world.free() };
}

test('사람: 기력 20 이면 붙은 채 2 s 가 차도 창 없음 · 거절 셈 · 판당 쓸 수 그대로 · skill.secret 도 거절 · 기력이 차면 다음 2 s 에 창 → 나감', () => {
  const B = body();
  const { P, W, until } = B;
  try {
    P.stamina.value = 20;
    assert.equal(until(() => W.open, SECRET.mordPress + 0.2), null, '창 없음');
    assert.ok(W.poor.refused >= 1, `거절 ${W.poor.refused}`);
    assert.equal(W.poor.by.press, W.poor.refused);
    assert.equal(P.secretUsed ?? 0, 0, '판당 쓸 수 안 씀');
    assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), false, 'skill.secret 도 거절');
    assert.equal(P.skill.sec, null);
    P.stamina.value = 60;
    assert.ok(until(() => W.open, SECRET.mordPress + 0.2) != null, '기력이 차면 창');
    assert.equal(P.skill.secret(W.fire()), true);
    B.upd();
    assert.equal(P.secretUsed, 1);
  } finally {
    B.free();
  }
});

test('사람: 열린 창도 기력이 모자라지면 닫힘 · fire 는 null (거절 셈) · 끄면(secretStamina 0) 기력 20 에서도 창 · 나감', () => {
  const B = body();
  const { P, W, upd, until } = B;
  try {
    P.stamina.value = 60;
    assert.ok(until(() => W.open, SECRET.mordPress + 0.2) != null);
    P.stamina.value = 20;
    assert.equal(W.fire(), null, '창이 열린 뒤 모자라짐 — 비기 아님');
    assert.equal(W.open, null);
    assert.equal(W.poor.refused, 1);
    P.stamina.value = 60;
    assert.ok(until(() => W.open, SECRET.mordPress + 0.2) != null);
    P.stamina.value = 20;
    upd();
    assert.equal(W.open, null, '다음 스텝에 닫힘');
    assert.equal(W.poor.refused, 2);
  } finally {
    B.free();
  }
  SECRET.secretStamina = 0;
  const C = body();
  try {
    C.P.stamina.value = 20;
    assert.ok(C.until(() => C.W.open, SECRET.mordPress + 0.2) != null, '끔: 창');
    assert.equal(C.P.skill.secret(C.W.fire()), true, '끔: 나감');
  } finally {
    SECRET.secretStamina = 1;
    C.free();
  }
});

test('AI: 기력 20 이면 secretGo · mordGo · spinGo 모두 거절 (거절 셈 · 0.3 s 안 다시 거절은 한 번) · 판당 쓸 수 그대로 · 비기 실행 없음', () => {
  for (const id of ['roland', 'artoria', 'minami']) {
    const H = CHARACTERS_BY_ID[id];
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona });
    try {
      const ai = G.ai;
      const E = G.enemy;
      G.step();
      assert.ok(ai.secret, `${id} 비기`);
      E.stamina.value = 20;
      assert.equal(ai.secretGo(ai.secret), false, `${id} secretGo`);
      assert.equal(ai.mordGo(), false, `${id} mordGo`);
      assert.equal(ai.spinGo(), false, `${id} spinGo`);
      assert.equal(ai.stats.secretPoor, 1, `${id} 잇단 거절은 한 번`);
      assert.equal(E.secretUsed ?? 0, 0);
      assert.equal(ai.secretRun ?? null, null);
      assert.equal(E.skill.sec ?? null, null);
    } finally {
      G.world.free();
    }
  }
});
