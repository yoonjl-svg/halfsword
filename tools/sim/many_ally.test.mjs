// 결투 고집 — 동료가 있을 때 (11/19 — 이탈리아 마음가짐 many.ally · many.hunt · 셈 src/ai_mindset.js manyMul · manyHuntOff · 쓰는 곳 src/team_sense.js ·
//  기록 docs/strike/team_support_2026-11-19.md · 수가 밀릴 때의 결투 고집 many.lever · out · fix 와 한곳):
//  ① 곱 = 1 − (1 − ally) × 숙련 곡선 (이탈리아 6 = 0 · 4 = 0.25 · 2 이하 1 · 이베리아 6 = 0.5) · 다른 유파 1 · 사냥 끔은 곱이 hunt 밑 (이탈리아 숙련 4 부터 · 이베리아 없음)
//  ② 엄호 겨눔 덧셈(넘어진 동료를 겨눈 적)을 거둠 — 숙련 2 · 독일은 그대로
//  ③ 사냥할 때(겨눈 상대가 동료와 붙음)로 보지 않음 — 제 간격에서 기다리는 꼴 그대로 · 독일 · 숙련 2 는 그대로
//  ④ 집게(동료가 붙은 내 상대를 축으로 돎) · 옆 기습 빈틈을 거둠 · 칼길 비우기는 그대로
//  ⑤ 난수를 부르지 않음
//  node --test tools/sim/many_ally.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './jelly_harness.mjs';
import { SCHOOL_MINDSET } from '../../src/schools.js';
import { manyMul, manyHuntOff } from '../../src/ai_mindset.js';
import { createSense, recordSense, senseScore, senseFeet, ambushOpp, huntFree, laneMate } from '../../src/team_sense.js';

const TS = CONFIG.TEAM_SENSE;
const profF = CONFIG.MINDSET.profF;
const IT = SCHOOL_MINDSET.italian.many;

/** 가짜 몸 (team_sense.test.mjs 꼴 + 마음가짐 줄) */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: o.state ?? 'stand', blood: 1, foe: null, stamina: { level: 0, exhausted: false },
    bodies: { chest: { translation: () => ({ x, y: 1.3, z }) }, pelvis: { linvel: () => ({ x: 0, y: 0, z: 0 }) } },
  };
  f.aiCtl = { me: f, mode: o.mode ?? 'watch', phase: 'ready', M: { reach: 1.8 }, mind: o.school ? SCHOOL_MINDSET[o.school] : null, mainProficiency: o.prof ?? 6, proficiency: o.prof ?? 6, stats: {}, sense: { t: 0 }, foe: null };
  return f;
}
function board(F, foes) {
  F.forEach((f, i) => {
    f.foe = foes[i] >= 0 ? F[foes[i]] : null;
    f.aiCtl.foe = f.foe;
  });
  const M = { fighters: F, t: 0 };
  M.sense = createSense(M);
  for (const f of F) f.teamSense = M.sense;
  recordSense(M);
  return M;
}
const noRandom = (fn) => {
  const r = Math.random;
  Math.random = () => { throw new Error('Math.random'); };
  try { return fn(); } finally { Math.random = r; }
};
const ai = (school, prof) => ({ mind: SCHOOL_MINDSET[school], mainProficiency: prof });

test('① 곱 = 1 − (1 − ally) × 숙련 곡선 · 다른 유파 1 · 사냥 끔은 숙련 4 부터', () => {
  assert.equal(IT.ally, 0);
  for (let p = 0; p <= 6; p++) assert.ok(Math.abs(manyMul(ai('italian', p), 'ally') - (1 - (1 - IT.ally) * profF[p])) < 1e-12, `p${p}`);
  assert.equal(manyMul(ai('italian', 6), 'ally'), 0);
  assert.equal(manyMul(ai('italian', 2), 'ally'), 1);
  for (const s of ['german', 'japanese', 'chinese']) assert.equal(manyMul(ai(s, 6), 'ally'), 1, s);
  assert.equal(manyMul(ai('iberian', 6), 'ally'), SCHOOL_MINDSET.iberian.many.ally, '이베리아: 합공에 덜 낌 (11/19 서포트 — 같은 칸)');
  assert.equal(manyMul(null, 'ally'), 1);
  assert.equal(manyMul({ mind: null, mainProficiency: 6 }, 'ally'), 1, '무유파 · 숙련 0 (마음가짐 없음)');
  assert.deepEqual([2, 3, 4, 5, 6].map((p) => manyHuntOff(ai('italian', p))), [false, false, true, true, true]);
  for (const s of ['german', 'iberian', 'japanese', 'chinese']) assert.equal(manyHuntOff(ai(s, 6)), false, s);
});

test('② 엄호 겨눔 덧셈을 거둠 (숙련 6) · 숙련 2 · 독일은 그대로', () => {
  // 0 · 2 = 0 편 · 1 · 3 = 1 편. 2 가 무릎 · 3 이 2 를 겨눔 · 0 은 1 을 겨눔 (team_sense.test ④ 와 같은 판)
  const mk = (school, prof) => [fake(0, 0, 0, 0, 0, { school, prof }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0, { state: 'kneel' }), fake(3, 1, 2.5, 2.5, Math.PI)];
  const D = mk('german', 2);
  assert.equal(senseScore(board(D, [1, 0, 3, 2]), D[0], D[3]), -TS.cover.sub);
  const I2 = mk('italian', 2);
  assert.equal(senseScore(board(I2, [1, 0, 3, 2]), I2[0], I2[3]), -TS.cover.sub);
  const I6 = mk('italian', 6);
  assert.equal(noRandom(() => senseScore(board(I6, [1, 0, 3, 2]), I6[0], I6[3])) + 0, 0);
  const I4 = mk('italian', 4);
  assert.ok(senseScore(board(I4, [1, 0, 3, 2]), I4[0], I4[3]) > -TS.cover.sub, '숙련 4: 일부만');
});

test('③ 사냥할 때로 보지 않음 — 이탈리아 숙련 4 · 6 (독일 · 숙련 2 는 그대로)', () => {
  const hunt = (school, prof) => {
    const H = [fake(0, 0, 0, 0, 0, { school, prof }), fake(1, 1, 2.5, 0, Math.PI / 2), fake(2, 0, 2.5, 1.5, -Math.PI / 2, { prof: 4 })];
    board(H, [1, 2, 1]);
    return noRandom(() => huntFree(H[0].aiCtl));
  };
  assert.equal(hunt('german', 6), true);
  assert.equal(hunt('italian', 2), true);
  assert.equal(hunt('italian', 4), false);
  assert.equal(hunt('italian', 6), false);
});

test('④ 집게 · 옆 기습을 거둠 · 칼길 비우기는 그대로', () => {
  // 나(0) (0, 0) → +x · 상대(1) (1.5, 0) 이 동료(2) (−0.3, 1.2) 와 붙음 · 상대는 +z 를 봄 (나는 그 앞 밖)
  const mk = (school) => [fake(0, 0, 0, 0, 0, { school }), fake(1, 1, 1.5, 0, -Math.PI / 2), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
  const G = mk('german');
  board(G, [1, 2, 1]);
  assert.notDeepEqual(senseFeet(G[0].aiCtl, 0.2, 0.1), [0.2, 0.1], '독일: 집게로 돎');
  assert.ok(ambushOpp(G[0].aiCtl)?.v > 0, '독일: 옆 기습 빈틈');
  const I = mk('italian');
  board(I, [1, 2, 1]);
  assert.deepEqual(noRandom(() => senseFeet(I[0].aiCtl, 0.2, 0.1)), [0.2, 0.1], '이탈리아 6: 돌지 않음');
  assert.equal(noRandom(() => ambushOpp(I[0].aiCtl)), null);
  // 칼길 비우기: 동료가 내 칼길 위 — 이탈리아도 비킴
  const L = [fake(0, 0, 0, 0, 0, { school: 'italian' }), fake(1, 1, 4, 0, Math.PI), fake(2, 0, 1.2, 0.2, 0, { prof: 4 })];
  board(L, [1, 0, 1]);
  assert.ok(laneMate(L[0].aiCtl)?.fan);
  assert.ok(senseFeet(L[0].aiCtl, 0, 0)[1] < 0, '동료(오른쪽)에게서 왼쪽으로 비킴');
});
