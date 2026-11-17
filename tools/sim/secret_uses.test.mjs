// 유파 비기 판당 쓸 수 시험 (사장님 10/29 19:5x '비기는 쿨타임을 없애고 판당 1회만 쓸 수 있게 하자.(동방 격살은 3회)' · 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' —
//   config UNIQUE_ASSIST.secretUses · secret.js secretLeft · useSecret · PlayerSecretWatch · ai.js dropSecret · gnsWatch — 사장님 10/29 20:5x 확인):
//   비기가 실제로 나간 때(skill.secret 이 받음 · AI 비기 실행)만 셈 · 다 쓰면 그 판엔 창 · 조건이 안 걸림(비기가 도는 동안과 같은 바쁨) · 판(몸)이 새로면 다시 · 동방 3 번 · AI 같은 수
//  작게 · 빠르게: 사람 창은 물리 스텝 없이 창만 돌린다.  node --test tools/sim/secret_uses.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { PlayerSecretWatch, secretLeft, secretUsesOf, useSecret, secretSpent } from '../../src/secret.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
// 준비까지 (11/14 사장님 '2초 후에 납도 시작' — 일본 준비는 iaiArmTime 뒤 납도 SECRET.iaiSheathe 가 끝나야 · 帯刀 끄면 납도 없음 · secret.js IaiArm.extra)
const ARM = () => CONFIG.SECRET.iaiArmTime + (CONFIG.SECRET.iaiObi && CONFIG.SECRET.iaiSheathe > 0 ? CONFIG.SECRET.iaiSheathe : 0);

const UA = CONFIG.UNIQUE_ASSIST;
const { SECRET } = CONFIG;


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
