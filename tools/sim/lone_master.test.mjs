// 혼자 싸움 판단 시험 (11/19 사장님 '고수 한 명이 하수 두 명을 이기는 방법은 존재해야 하고, 그래야 의외성이 생겨' — src/ai_lone.js · config LONE · 기록 docs/strike/lone_master_2026-11-19.md):
//  ① 숙련 몫 w = MINDSET.profF (6 = 1 · 2 이하 0) ② 수가 밀림 = 내 동료와 붙지 않은 서 있는 적 둘 이상이 range 안 (동료와 붙은 적 · 멀리 있는 적은 안 셈)
//  ③ 둘째 칼끝 밖 — 둘째가 그 칼끝 + out 안이면 그 몸에서 멀어지는 스틱 (숙련 몫만큼 · 가까울수록) ④ 난수 안 부름 · 판 사본이 없으면(1:1) 그대로
//  node --test tools/sim/lone_master.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './jelly_harness.mjs';
import { createSense, recordSense } from '../../src/team_sense.js';
import { loneW, loneOf, loneFeet } from '../../src/ai_lone.js';

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

test('③ 둘째 칼끝 밖: 둘째가 그 칼끝 + out 안이면 그 몸에서 멀어지는 스틱 (숙련 몫 · 가까울수록) · 바깥이면 그대로', () => {
  // 나는 +x 를 봄(heading 0) · 둘째가 오른쪽(+z 가 오른쪽 — fighter.right = (−앞.z, 앞.x) = (0, 1))
  const F = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 1.8 + LONE.out / 2, -Math.PI / 2)];
  board(F, [1, 0, 0]);
  const [fw, sd] = noRandom(() => loneFeet(F[0].aiCtl, 0, 0));
  assert.ok(Math.abs(fw) < 1e-9);
  assert.ok(Math.abs(sd + LONE.outK * 0.5) < 1e-9, `왼쪽으로 비킴 ${sd} (칼끝 + out 의 반 — outK × ½)`);
  const P4 = [fake(0, 1, 0, 0, 0, { prof: 4 }), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 1.8 + LONE.out / 2, -Math.PI / 2)];
  board(P4, [1, 0, 0]);
  assert.ok(Math.abs(loneFeet(P4[0].aiCtl, 0, 0)[1] + LONE.outK * 0.5 * MINDSET.profF[4]) < 1e-9, '숙련 4 는 ¾');
  const H = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 1.8 + LONE.out / 2, -Math.PI / 2)];
  for (const f of H) f.foe = null;
  assert.deepEqual(loneFeet(H[0].aiCtl, 0.3, 0.1), [0.3, 0.1], '판 사본 없음 (1:1) — 그대로');
  const G = [fake(0, 1, 0, 0, 0), fake(1, 0, 2, 0, Math.PI), fake(2, 0, 0, 1.8 + LONE.out + 0.2, -Math.PI / 2)];
  board(G, [1, 0, 0]);
  assert.deepEqual(loneFeet(G[0].aiCtl, 0.3, 0.1), [0.3, 0.1]);
});
