// 유파 비기 식힘 시험 (사장님 10/29 17:5x '유파별 비기는 쿨타임 10초 적용해.' — config UNIQUE_ASSIST.secretCooldown · secret.js PlayerSecretWatch):
//   특수 공격 식힘(special_cooldown.test.mjs)과 같은 틀 — 비기가 나간 순간(skill.secret 이 받아 me.skill.sec 에 새 실행이 걸린 때)부터 실제 10 s 동안 그 비기의 창 · 조건은 없는 것
//   (창이 안 열림 · 무장 · 누르기 셈이 안 쌓임 — 비기가 도는 동안과 같은 '바쁨'). 창을 썼어도 skill.secret 이 받지 않았으면 식힘 없음. 0 = 끔. 사람만(AI 비기는 PlayerSecretWatch 를 안 씀).
//  작게 · 빠르게: 물리 스텝 없이 창만 돌린다(몸은 서 있음).  node --test tools/sim/secret_cooldown.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET } = CONFIG;
const CD = realS(10.0);

test('기본값 — 비기 식힘 실제 10 s (시간 사다리 10.0 — 사장님이 더한 칸) · 특수 공격 식힘 6 s 그대로', () => {
  assert.ok(Math.abs(UA.secretCooldown - CD) < 1e-12);
  assert.ok(Math.abs(UA.specialCooldown - realS(6.0)) < 1e-12);
});

/** 몸 하나 + 비기 창 (판 시작 정지는 지난 것으로) */
function body(weapon, gap) {
  const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword', ...(gap ? { gap } : {}) });
  const P = G.player;
  for (let i = 0; i < 3; i++) G.step();
  P.fightT = 1e3; // 판 시작 정지(openHold) 지남 — 무장 시계가 셈
  const W = new PlayerSecretWatch(P, G.enemy);
  const upd = () => W.update(DT, !!P.skill.sec);
  /** pred 가 참이 될 때까지 (최대 max 게임 초) — 걸린 게임 초 또는 null */
  const until = (pred, max) => {
    for (let t = 0; t <= max; t += DT) {
      if (pred()) return t;
      upd();
    }
    return null;
  };
  return { G, P, W, upd, until, free: () => G.world.free() };
}

test('독일 모르트슐라크: 낸 순간부터 식힘 · 10 s 동안 누르기를 이어도 창 없음(셈도 안 쌓임) · 식힘 뒤 다시 누르기 시간만큼 → 창', () => {
  const B = body('longsword', 1.0);
  const { P, W, upd, until } = B;
  try {
    assert.equal(W.S?.when, 'press');
    P.barge = { phase: 'press' };
    assert.ok(until(() => W.open, SECRET.mordPress + 0.1) != null, '처음 창');
    const o = W.fire();
    const tFire = W.t;
    assert.equal(P.skill.secret(o), true, '비기 나감');
    upd();
    assert.equal(W.coolT, tFire, '나간 순간부터');
    assert.ok(W.cooling());
    assert.ok(Math.abs(W.coolLeft() - (CD - DT)) < 1e-9);
    P.skill.sec = null; // 비기 끝 (굳음까지) — 식힘은 그대로
    P.barge = { phase: 'press' };
    let sawOpen = false;
    let maxPress = 0;
    while (W.t - tFire < CD - DT / 2) {
      upd();
      if (W.open) sawOpen = true;
      maxPress = Math.max(maxPress, W.pressT ?? 0);
    }
    assert.equal(sawOpen, false, '식힘 중 창 없음');
    assert.equal(maxPress, 0, '식힘 중 누르기 셈 0');
    const dt = until(() => W.open, SECRET.mordPress + 0.1);
    assert.ok(dt != null && Math.abs(W.t - tFire - (CD + SECRET.mordPress)) < 2 * DT, `식힘 + 누르기 ${(W.t - tFire) / CONFIG.TIME.k} 실제 s`);
  } finally {
    B.free();
  }
});

test('창을 썼어도 비기가 안 나가면(skill.secret 이 받지 않음) 식힘 없음 — 다시 누르기 시간만큼이면 창', () => {
  const B = body('longsword', 1.0);
  const { P, W, upd, until } = B;
  try {
    P.barge = { phase: 'press' };
    until(() => W.open, SECRET.mordPress + 0.1);
    const o = W.fire();
    P.skill.tap = {}; // 보통 탭 찌르기가 도는 중 — skill.secret 이 받지 않음
    assert.equal(P.skill.secret(o), false);
    P.skill.tap = null;
    upd();
    assert.equal(W.coolT, null);
    assert.equal(W.cooling(), false);
    P.barge = { phase: 'press' };
    assert.ok(until(() => W.open, SECRET.mordPress + 0.1) != null, '식힘 없이 다시 창');
  } finally {
    B.free();
  }
});

test('일본 고노센: 식힘 중엔 준비(발도 대기)가 안 걸림 — 웅크림 · 준비 표시 · 사건 창 모두 없음 → 식힘 뒤 2 s 침착하면 다시 준비', () => {
  const B = body('uchigatana');
  const { P, W, upd, until } = B;
  try {
    assert.ok(W.S?.do?.instant);
    assert.ok(until(() => W.iaiArm.armed, SECRET.iaiArmTime + 0.1) != null, '처음 준비');
    P.skill.sec = { S: W.S }; // 고노센이 나감 (skill.secret 이 건 실행)
    upd();
    const t0 = W.coolT;
    P.skill.sec = null;
    let during = false;
    while (W.t - t0 < CD - DT / 2) {
      upd();
      if (W.iaiArm.armed || W.open) during = true;
    }
    assert.equal(during, false, '식힘 중 준비 · 창 없음');
    until(() => W.iaiArm.armed, SECRET.iaiArmTime + 0.1);
    assert.ok(Math.abs(W.t - t0 - (CD + SECRET.iaiArmTime)) < 2 * DT);
  } finally {
    B.free();
  }
});

test('이베리아 싱지르: 식힘 중엔 무장 창이 안 열림 → 식힘 뒤 무장 시간만큼이면 다시 창', () => {
  const B = body('zweihander');
  const { P, W, upd, until } = B;
  try {
    assert.equal(W.S?.when, 'spinArm');
    assert.ok(until(() => W.open, SECRET.ibSpin.armTime + 0.1) != null, '처음 무장 창');
    const o = W.fire();
    P.skill.sec = { S: o.S };
    upd();
    const t0 = W.coolT;
    P.skill.sec = null;
    let during = false;
    while (W.t - t0 < CD - DT / 2) {
      upd();
      if (W.open || W.spinArm.armed) during = true;
    }
    assert.equal(during, false);
    until(() => W.open, SECRET.ibSpin.armTime + 0.1);
    assert.ok(Math.abs(W.t - t0 - (CD + SECRET.ibSpin.armTime)) < 2 * DT);
  } finally {
    B.free();
  }
});

test('이탈리아 리솔루토 · 동방 격살: 식힘 중 조건 셈은 바쁨으로 받음(덮음 셈 비움 · 새 맞닿음 거절) · 식힘이 끝나면 아님', () => {
  for (const [weapon, tick] of [['rapier', 'risoTick'], ['qinggang', 'gyeoksalTick']]) {
    const B = body(weapon);
    const { P, W, upd } = B;
    try {
      const seen = [];
      const orig = W[tick].bind(W);
      W[tick] = (...a) => (seen.push(a[a.length - 1]), orig(...a)); // 마지막 인자 = busy
      upd();
      assert.equal(seen.at(-1), false, `${weapon} 식힘 전`);
      P.skill.sec = { S: W.S };
      upd();
      P.skill.sec = null;
      const t0 = W.coolT;
      upd();
      assert.equal(seen.at(-1), true, `${weapon} 식힘 중`);
      while (W.t - t0 < CD + DT) upd();
      assert.equal(seen.at(-1), false, `${weapon} 식힘 뒤`);
    } finally {
      B.free();
    }
  }
});

test('0 = 끔: 비기가 끝나면 곧장 다시 조건을 봄', () => {
  const B = body('longsword', 1.0);
  const { P, W, upd, until } = B;
  UA.secretCooldown = 0;
  try {
    P.barge = { phase: 'press' };
    until(() => W.open, SECRET.mordPress + 0.1);
    assert.equal(P.skill.secret(W.fire()), true);
    upd();
    assert.equal(W.cooling(), false);
    P.skill.sec = null;
    P.barge = { phase: 'press' };
    assert.ok(until(() => W.open, SECRET.mordPress + 0.1) != null);
  } finally {
    UA.secretCooldown = CD;
    B.free();
  }
});
