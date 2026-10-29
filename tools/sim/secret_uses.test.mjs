// 유파 비기 판당 쓸 수 시험 (사장님 10/29 19:5x '비기는 쿨타임을 없애고 판당 1회만 쓸 수 있게 하자.(동방 격살은 3회)' · 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' —
//   config UNIQUE_ASSIST.secretUses · secret.js secretLeft · useSecret · PlayerSecretWatch · ai.js dropSecret · gnsWatch — 사장님 10/29 20:5x 확인):
//   비기가 실제로 나간 때(skill.secret 이 받음 · AI 비기 실행)만 셈 · 다 쓰면 그 판엔 창 · 조건이 안 걸림(비기가 도는 동안과 같은 바쁨) · 판(몸)이 새로면 다시 · 동방 3 번 · AI 같은 수
//  작게 · 빠르게: 사람 창은 물리 스텝 없이 창만 돌린다.  node --test tools/sim/secret_uses.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { PlayerSecretWatch, secretLeft, secretUsesOf, useSecret, secretSpent } from '../../src/secret.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { SECRET } = CONFIG;

test('기본값 — 판당 1 번 · 동방 3 번 · 비기 식힘 칸(secretCooldown)은 없음', () => {
  assert.deepEqual(UA.secretUses, { default: 1, chinese: 3 });
  assert.equal('secretCooldown' in UA, false);
  for (const [tr, n] of [['german', 1], ['italian', 1], ['iberian', 1], ['japanese', 1], ['chinese', 3]]) assert.equal(secretUsesOf({ swordArt: { tradition: tr } }), n, tr);
});

/** 몸 하나 + 비기 창 (판 시작 정지는 지난 것으로) */
function body(weapon, gap) {
  const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword', ...(gap ? { gap } : {}) });
  const P = G.player;
  for (let i = 0; i < 3; i++) G.step();
  P.fightT = 1e3;
  if (weapon === 'longsword') P.foeDistance = () => 0.6; // 모르트슐라크 조건 = 몸이 붙은 채 2 s (10/29 20:0x mordRule 'close' — 롱소드 붙은 거리 0.77 안)
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

test('독일 모르트슐라크: 낸 때 한 번 셈 · 다 쓰면 그 판엔 누르기를 이어도 창 없음(셈도 0) · 새 판(새 몸)은 다시', () => {
  const B = body('longsword', 1.0);
  const { P, W, upd, until } = B;
  try {
    P.barge = { phase: 'press' };
    assert.ok(until(() => W.open, SECRET.mordPress + 0.1) != null, '처음 창');
    assert.equal(W.left, 1);
    assert.equal(P.skill.secret(W.fire()), true);
    upd();
    assert.equal(P.secretUsed, 1);
    assert.equal(W.left, 0);
    P.skill.sec = null;
    P.barge = { phase: 'press' };
    let saw = false;
    let maxPress = 0;
    for (let t = 0; t < 4 * SECRET.mordPress; t += DT) {
      upd();
      if (W.open) saw = true;
      maxPress = Math.max(maxPress, W.pressT ?? 0);
    }
    assert.equal(saw, false, '다 쓴 판엔 창 없음');
    assert.equal(maxPress, 0);
  } finally {
    B.free();
  }
  const C = body('longsword', 1.0);
  try {
    assert.equal(C.W.left, 1, '새 판');
    C.P.barge = { phase: 'press' };
    assert.ok(C.until(() => C.W.open, SECRET.mordPress + 0.1) != null);
  } finally {
    C.free();
  }
});

test('창을 썼어도 비기가 안 나가면(skill.secret 이 받지 않음) 셈 없음 — 다시 누르기 시간만큼이면 창', () => {
  const B = body('longsword', 1.0);
  const { P, W, upd, until } = B;
  try {
    P.barge = { phase: 'press' };
    until(() => W.open, SECRET.mordPress + 0.1);
    const o = W.fire();
    P.skill.tap = {};
    assert.equal(P.skill.secret(o), false);
    P.skill.tap = null;
    upd();
    assert.equal(P.secretUsed ?? 0, 0);
    P.barge = { phase: 'press' };
    assert.ok(until(() => W.open, SECRET.mordPress + 0.1) != null);
  } finally {
    B.free();
  }
});

test('일본 고노센 · 이베리아 싱지르: 한 번 쓴 판엔 준비 · 무장이 다시 안 걸림 (웅크림 · 표시 · 창 없음)', () => {
  for (const [w, armed] of [['uchigatana', (W) => W.iaiArm.armed], ['zweihander', (W) => W.spinArm.armed || !!W.open]]) {
    const B = body(w);
    const { P, W, upd, until } = B;
    try {
      assert.ok(until(() => armed(W), 2.5) != null, `${w} 처음`);
      const o = W.open ? W.fire() : null;
      P.skill.sec = { S: o?.S ?? W.S };
      upd();
      P.skill.sec = null;
      let again = false;
      for (let t = 0; t < 6; t += DT) {
        upd();
        if (armed(W)) again = true;
      }
      assert.equal(again, false, w);
    } finally {
      B.free();
    }
  }
});

test('동방 격살 3 번: 두 번 쓴 뒤에도 조건을 보고(바쁨 아님) · 세 번째 뒤엔 바쁨', () => {
  const B = body('qinggang');
  const { P, W, upd } = B;
  try {
    const seen = [];
    const orig = W.gyeoksalTick.bind(W);
    W.gyeoksalTick = (...a) => (seen.push(a[a.length - 1]), orig(...a));
    for (let k = 1; k <= 3; k++) {
      P.skill.sec = { S: W.S, k };
      upd();
      P.skill.sec = null;
      upd();
      assert.equal(P.secretUsed, k);
      assert.equal(seen.at(-1), k === 3, `${k} 번째 뒤`);
    }
    assert.equal(secretLeft(P), 0);
  } finally {
    B.free();
  }
});

test('AI: 비기를 다 쓰면 비기 없는 AI 와 같은 길 (싱지르 무장 · 모르트슐라크 누르기 · 발도 대기 없음) · 판당 같은 수', () => {
  for (const id of ['roland', 'artoria', 'minami']) {
    const H = CHARACTERS_BY_ID[id];
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona });
    try {
      const ai = G.ai;
      assert.ok(ai.secret, `${id} 비기`);
      G.step();
      assert.ok(ai.secret, `${id} 쓰기 전`);
      useSecret(G.enemy); // AI 가 비기를 낸 것과 같은 셈 (spinGo · mordGo · secretGo)
      assert.ok(secretSpent(G.enemy));
      G.step();
      assert.equal(ai.secret, null, `${id} 다 씀`);
      assert.equal(ai.spinArm ?? null, null);
      assert.equal(ai.iaiArm ?? null, null);
      assert.ok(!ai.press || 'tech' in ai.press);
      assert.equal(ai.secretGo({ do: {} }), false, '다 쓴 뒤엔 secretGo 도 거절');
    } finally {
      G.world.free();
    }
  }
});

test('AI 가 보는 사람 고노센 준비: 이 판 비기를 다 쓴 사람은 준비 아님 (ai.js gnsWatch)', () => {
  const H = CHARACTERS_BY_ID.margarethe;
  const G = newRound({ seed: 2, weapon: 'uchigatana', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona });
  try {
    const P = G.player;
    P.fightT = 1e3;
    const ai = G.ai;
    for (let t = 0; t < SECRET.iaiArmTime + 0.2; t += DT) ai.gnsWatch(DT, 3, false);
    assert.equal(ai.gnsW.user, true);
    assert.equal(ai.gnsW.ready, true, '준비로 봄');
    useSecret(P);
    ai.gnsWatch(DT, 3, false);
    assert.equal(ai.gnsW.ready, false, '다 쓴 사람은 준비 아님');
  } finally {
    G.world.free();
  }
});

test("끝없음(null) · 'inf' : 판당 제한 없음", () => {
  const U = UA.secretUses;
  UA.secretUses = null;
  try {
    const f = { swordArt: { tradition: 'german' }, secretUsed: 9 };
    assert.equal(secretSpent(f), false);
  } finally {
    UA.secretUses = U;
  }
});

void AI;
