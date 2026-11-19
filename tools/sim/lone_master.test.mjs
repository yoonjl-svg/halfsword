// 혼자 싸움 판단 시험 (11/19 사장님 '고수 한 명이 하수 두 명을 이기는 방법은 존재해야 하고, 그래야 의외성이 생겨' — src/ai_lone.js · config LONE · 기록 docs/strike/lone_master_2026-11-19.md):
//  ① 숙련 몫 w = MINDSET.profF (6 = 1 · 2 이하 0) ② 수가 밀림 = 내 동료와 붙지 않은 서 있는 적 둘 이상이 range 안 (동료와 붙은 적 · 멀리 있는 적은 안 셈)
//  ③ 둘째 칼끝 밖 (마음가짐 줄에 many.out 이 있는 유파만 — 일본) — 둘째가 그 칼끝 + out 안이면 그 몸에서 멀어지는 스틱 (숙련 몫 × 유파 곱 · 가까울수록) ④ 난수 안 부름 · 판 사본이 없으면(1:1) 그대로
//  ⑤ 다적의 자리 (일본만 — SCHOOL_MINDSET.japanese.many): 수가 밀리면 manyW = w · 줄 세우기 옆 스틱 (둘째를 겨눈 상대 뒤로) · 다른 유파 · 수가 안 밀리면 0
//  ⑥ 결투 고집 (이탈리아 — many.lever · many.out): 곱 1 − (1 − 값) × w — 숙련 6 은 둘째 칼끝 밖 걸음 0 · 다른 유파 1
//  ⑦ 결투 고집 — 겨눈 상대 붙듦 (many.fix · targeting.js): 수가 밀리면 상대 바꿈 기다림 × (1 + fix × w) · 수가 안 밀림 · 다른 유파 · 판 사본 없음 1
//  node --test tools/sim/lone_master.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './jelly_harness.mjs';
import { createSense, recordSense } from '../../src/team_sense.js';
import { loneW, loneOf, loneFeet, manyW, manyMul, fixHoldK } from '../../src/ai_lone.js';
import { SCHOOL_MINDSET } from '../../src/schools.js';

const { LONE, MINDSET } = CONFIG;

/** 가짜 몸 + AI (team_sense.test.mjs 와 같은 꼴): 가슴 (x, z) · 바라보는 각 heading · 편 · 숙련 */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: 'stand', blood: 1, foe: null, stamina: { level: 0, exhausted: false },
    bodies: { chest: { translation: () => ({ x, y: 1.3, z }) }, pelvis: { linvel: () => ({ x: o.vx ?? 0, y: 0, z: 0 }) } },
  };
  f.aiCtl = { me: f, mode: 'watch', M: { reach: o.reach ?? 1.8 }, mainProficiency: o.prof ?? 6, proficiency: o.prof ?? 6, stats: {}, sense: { t: 0 }, foe: null };
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

test('① 숙련 몫 w = MINDSET.profF (6 = 1 · 5 = 0.94 · 4 = 0.75 · 2 이하 0)', () => {
  for (let p = 0; p <= 6; p++) assert.equal(loneW({ mainProficiency: p }), MINDSET.profF[p]);
  assert.equal(loneW({ mainProficiency: 6 }), 1);
  assert.equal(loneW({ mainProficiency: 2 }), 0);
});

test('② 수가 밀림: 떨어진 적 둘이 range 안 — 둘째 = 겨눈 상대 말고 가장 가까운 적 · 하나뿐 · 동료와 붙은 적 · 숙련 2 는 아님', () => {
  // 혼자(1편 자리 0) 대 둘(0편 자리 1 · 2)
  const F = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 3, Math.PI / 2)];
  board(F, [1, 0, 0]);
  const L = noRandom(() => loneOf(F[0].aiCtl));
  assert.ok(L);
  assert.equal(L.n, 2);
  assert.ok(Math.abs(L.d2 - 3) < 1e-9);
  assert.ok(Math.abs(L.x2) < 1e-9 && Math.abs(L.z2 - 1) < 1e-9, '둘째 쪽 단위 벡터');
  // 둘째가 range 밖이면 아님
  const G = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, LONE.range + 0.5, Math.PI / 2)];
  board(G, [1, 0, 0]);
  assert.equal(loneOf(G[0].aiCtl), null);
  // 2:2 — 둘째 적이 내 동료와 붙었으면 아님
  const H = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 3, -Math.PI / 2), fake(3, 1, 0, 4.5, Math.PI / 2)];
  board(H, [1, 0, 3, 2]);
  assert.equal(loneOf(H[0].aiCtl), null, '동료와 붙은 적은 내 둘레의 수가 아님');
  // 숙련 2 — 몫 0
  const K = [fake(0, 1, 0, 0, 0, { prof: 2 }), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 3, Math.PI / 2)];
  board(K, [1, 0, 0]);
  assert.equal(loneOf(K[0].aiCtl), null);
});

test('③ 둘째 칼끝 밖 (마음가짐 줄에 many.out 이 있는 유파만): 둘째가 그 칼끝 + out 안이면 그 몸에서 멀어지는 스틱 (숙련 몫 · 유파 곱 · 가까울수록) · 바깥 · many.out 없는 유파는 그대로', () => {
  // 나는 +x 를 봄(heading 0) · 둘째가 오른쪽(+z 가 오른쪽 — fighter.right = (−앞.z, 앞.x) = (0, 1)) · manyGo 없음(줄 세우기 옆 스틱 안 탐)
  const jp = SCHOOL_MINDSET.japanese;
  const mk = (mind, prof, z2) => {
    const F = [fake(0, 1, 0, 0, 0, { prof }), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, z2, -Math.PI / 2)];
    F[0].aiCtl.mind = mind;
    board(F, [1, 0, 0]);
    return F;
  };
  const near = 1.8 + LONE.out / 2;
  const F = mk(jp, 6, near);
  const [fw, sd] = noRandom(() => loneFeet(F[0].aiCtl, 0, 0));
  assert.ok(Math.abs(fw) < 1e-9);
  assert.ok(Math.abs(sd + LONE.outK * jp.many.out * 0.5) < 1e-9, `왼쪽으로 비킴 ${sd} (칼끝 + out 의 반 — outK × many.out × ½)`);
  const w4 = MINDSET.profF[4];
  assert.ok(Math.abs(loneFeet(mk(jp, 4, near)[0].aiCtl, 0, 0)[1] + LONE.outK * 0.5 * w4 * (1 - (1 - jp.many.out) * w4)) < 1e-9, '숙련 4 — w × 유파 곱');
  for (const s of ['german', 'iberian', 'chinese']) assert.deepEqual(loneFeet(mk(SCHOOL_MINDSET[s], 6, near)[0].aiCtl, 0.3, 0.1), [0.3, 0.1], `${s} — many.out 없음 (11/19 고른 판: 다섯 유파 모두에 걸면 없음과 같음)`);
  assert.deepEqual(loneFeet(mk(undefined, 6, near)[0].aiCtl, 0.3, 0.1), [0.3, 0.1], '마음가짐 없는 몸 — 그대로');
  const H = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, near, -Math.PI / 2)];
  H[0].aiCtl.mind = jp;
  assert.deepEqual(loneFeet(H[0].aiCtl, 0.3, 0.1), [0.3, 0.1], '판 사본 없음 (1:1) — 그대로');
  assert.deepEqual(loneFeet(mk(jp, 6, 1.8 + LONE.out + 0.2)[0].aiCtl, 0.3, 0.1), [0.3, 0.1], '칼끝 + out 밖');
});

test('⑤ 다적의 자리: 일본(마음가짐 many)만 · 수가 밀리면 w · 줄 세우기 옆 스틱으로 둘째를 겨눈 상대 뒤로', () => {
  assert.ok(SCHOOL_MINDSET.japanese.many.go);
  for (const s of ['german', 'chinese']) assert.equal(SCHOOL_MINDSET[s].many, undefined, s);
  assert.equal(SCHOOL_MINDSET.iberian.many.go, undefined, '이베리아 many 는 합공에 덜 낌(ally — 11/19 서포트)만 · 다적의 자리 아님');
  assert.equal(SCHOOL_MINDSET.italian.many.go, undefined, '이탈리아는 다적의 자리가 아님 (결투 고집 — ⑥)');
  // 나 +x 를 봄 · 겨눈 상대 앞(2, 0) · 둘째 오른쪽 앞(1.5, 3) — 칼끝 + out 밖(둘째 칼끝 밖 몫 없음)
  const mk = (mind) => {
    const F = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 1.5, 3, Math.PI)];
    F[0].aiCtl.mind = mind;
    board(F, [1, 0, 0]);
    return F[0].aiCtl;
  };
  const jp = mk(SCHOOL_MINDSET.japanese);
  assert.equal(manyW(jp), 1);
  jp.manyGo = manyW(jp);
  const [fw, sd] = noRandom(() => loneFeet(jp, 0, 0));
  assert.ok(Math.abs(fw) < 1e-9);
  assert.ok(sd < -0.3, `둘째가 오른쪽 — 왼쪽으로 돎 ${sd}`);
  const de = mk(SCHOOL_MINDSET.german);
  assert.equal(manyW(de), 0, '다른 유파');
  de.manyGo = manyW(de);
  assert.deepEqual(loneFeet(de, 0, 0), [0, 0]);
  const G = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI)];
  G[0].aiCtl.mind = SCHOOL_MINDSET.japanese;
  board(G, [1, 0]);
  assert.equal(manyW(G[0].aiCtl), 0, '적 하나 — 수가 안 밀림');
});

test('⑥ 결투 고집 (이탈리아): 줄 세우기 · 피하기 · 둘째 칼끝 밖 몫 × (1 − (1 − 값) × w) — 숙련 6 은 0 · 4 는 ¼ · 다른 유파 1', () => {
  const ai = (s, p) => ({ mind: SCHOOL_MINDSET[s], mainProficiency: p });
  assert.equal(manyMul(ai('italian', 6), 'lever'), 0);
  assert.ok(Math.abs(manyMul(ai('italian', 4), 'out') - (1 - MINDSET.profF[4])) < 1e-12);
  assert.equal(manyMul(ai('italian', 2), 'lever'), 1, '숙련 2 — 유파다움 0');
  for (const s of ['german', 'iberian', 'japanese', 'chinese']) assert.equal(manyMul(ai(s, 6), 'lever'), 1, s);
  const F = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 1.8 + LONE.out / 2, -Math.PI / 2)];
  F[0].aiCtl.mind = SCHOOL_MINDSET.italian;
  board(F, [1, 0, 0]);
  assert.deepEqual(loneFeet(F[0].aiCtl, 0.2, 0), [0.2, 0], '이탈리아 숙련 6 — 둘째 칼끝 밖 걸음 없음');
});

test('⑦ 결투 고집 — 겨눈 상대 붙듦: 이탈리아가 수가 밀리면 바꿈 기다림 × (1 + fix × w) · 아니면 1', () => {
  const fix = SCHOOL_MINDSET.italian.many.fix;
  assert.ok(fix > 0);
  for (const s of ['german', 'iberian', 'japanese', 'chinese']) assert.equal(SCHOOL_MINDSET[s].many?.fix, undefined, s);
  const mk = (mind, prof, far = false) => {
    const F = [fake(0, 1, 0, 0, 0, { prof }), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, far ? LONE.range + 0.5 : 3, Math.PI / 2)];
    F[0].aiCtl.mind = mind;
    board(F, [1, 0, 0]);
    return F[0];
  };
  assert.ok(Math.abs(noRandom(() => fixHoldK(mk(SCHOOL_MINDSET.italian, 6))) - (1 + fix)) < 1e-12, '숙련 6');
  assert.ok(Math.abs(fixHoldK(mk(SCHOOL_MINDSET.italian, 4)) - (1 + fix * MINDSET.profF[4])) < 1e-12, '숙련 4');
  assert.equal(fixHoldK(mk(SCHOOL_MINDSET.italian, 6, true)), 1, '둘째가 range 밖 — 수가 안 밀림');
  assert.equal(fixHoldK(mk(SCHOOL_MINDSET.german, 6)), 1, '다른 유파');
  const H = mk(SCHOOL_MINDSET.italian, 6);
  H.teamSense = null;
  assert.equal(fixHoldK(H), 1, '판 사본 없음 (1:1)');
  assert.equal(fixHoldK({ aiCtl: null, teamSense: {} }), 1, '사람');
});
