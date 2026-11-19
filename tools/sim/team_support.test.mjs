// 서포트 (11/19 — 사장님 '동방과 독일이 서포트에 강하고 이베리아가 서포트에 특별히 도움 안 되는 걸로 하자' · src/team_support.js · 기록 docs/strike/team_support_2026-11-19.md):
//  ① 1:1 AI 는 이 셈을 하나도 타지 않음 (supS · stats.support 없음) · 셋 이상 판(2:1)의 AI 는 탐
//  ② 몫 = 숙련 곡선 MINDSET.profF (숙련 2 이하 0 · 4 = 0.75 · 6 = 1) · 유파 칸 없는 몸(일본 · 무유파) 0 · 이탈리아 결투 고집 duelK
//  ③ 독일 · 동방 돌기: 동료와 붙은 내 상대를 축으로 동료에게서 먼 쪽 · 각이 넉넉하면 · 상대가 나를 겨누면 그대로 · 다른 유파 · 숙련 2 는 그대로 · 동료 칼길에 서면 비킴 · 묶기 역할은 앞을 지킴
//  ④ 이베리아: 칼길 한가운데가 아니면 미루지 않음 · 비키는 걸음 거둠 · 혼자(동료 없음)는 그대로
//  ⑤ 독일 동료와 붙은 적 겨눔 (붙잡혀 있으면 없음) · 동료 칼끝 쪽 밀치기 · 동료가 곁이면 묶기 · 혼자는 굴림대로 · 동료가 칠 때 박자
//  ⑥ 동방 기습 (그 적 앞 밖만) · 치고 빠짐
//  ⑦ 이탈리아 결투 고집: 무리 싸움 판단의 엄호 덧셈을 거둠 · 사냥할 때로 보지 않음 (다른 유파 · 숙련 2 는 그대로)
//  ⑧ 난수를 부르지 않음
//  node --test tools/sim/team_support.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { aiAtProficiency } from '../../src/characters.js';
import { createSense, recordSense, senseScore, huntFree } from '../../src/team_sense.js';
import { supportOf, duelK, duelHunt, supportScore, supportFeet, laneFree, supportOpp, shoveToMate, supportChain } from '../../src/team_support.js';

const TS = CONFIG.TEAM_SENSE;
const SU = CONFIG.TEAM_SUPPORT;
const profF = CONFIG.MINDSET.profF;

/** 가짜 몸 (team_sense.test.mjs 와 같은 꼴 + 유파): 가슴 (x, z) · 바라보는 각 heading(라디안 — forward = (cos h, −sin h)) · 편 · 유파 · 숙련 */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: o.state ?? 'stand', blood: 1, foe: null, stamina: { level: 0, exhausted: false },
    bodies: { chest: { translation: () => ({ x, y: 1.3, z }) }, pelvis: { linvel: () => ({ x: 0, y: 0, z: 0 }) } },
  };
  f.aiCtl = { me: f, mode: o.mode ?? 'watch', phase: 'ready', M: { reach: o.reach ?? 1.8 }, art: { tradition: o.school ?? 'none' }, mainProficiency: o.prof ?? 6, proficiency: o.prof ?? 6, stats: {}, sense: { t: 0 }, foe: null };
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
const aiOf = (weapon, p) => aiAtProficiency({ ai: { persona: {} }, weapon }, p);

test('① 1:1 AI 는 서포트 셈을 타지 않음 · 2:1 AI 는 탐', () => {
  const W = ['longsword', 'hwando'];
  const G = newMatch({ count: 2, ai: 'all', seed: 3, walls: true, weapons: W, aiOf: (i) => aiOf(W[i], 6) });
  for (let i = 0; i < 900 && !G.over; i++) G.step();
  for (const a of G.ais) {
    assert.equal(a.supS, undefined, '1:1: supportOf 를 부른 적 없음');
    assert.equal(a.stats.support, undefined);
  }
  const W3 = ['longsword', 'uchigatana', 'hwando'];
  const H = newMatch({ count: 3, ai: 'all', seed: 3, walls: true, weapons: W3, aiOf: (i) => aiOf(W3[i], 6) });
  for (let i = 0; i < 600 && !H.over; i++) H.step();
  assert.equal(H.ais[0].supS?.key, 'de');
  assert.equal(H.ais[0].supS?.w, 1);
  assert.equal(H.ais[2].supS?.key, 'cn');
});

test('② 몫 = 숙련 곡선 · 일본 · 무유파 0 · 이탈리아 결투 고집', () => {
  for (const p of [0, 1, 2, 3, 4, 5, 6]) assert.equal(supportOf({ art: { tradition: 'german' }, proficiency: p }).w, profF[p]);
  assert.equal(profF[2], 0);
  assert.equal(profF[4], 0.75);
  assert.equal(supportOf({ art: { tradition: 'japanese' }, proficiency: 6 }).w, 0);
  assert.equal(supportOf({ art: { tradition: 'none' }, proficiency: 6 }).w, 0);
  assert.equal(duelK({ art: { tradition: 'italian' }, proficiency: 6 }), SU.it.duel);
  assert.equal(duelK({ art: { tradition: 'italian' }, proficiency: 2 }), 0);
  assert.equal(duelK({ art: { tradition: 'german' }, proficiency: 6 }), 0);
  assert.equal(duelK({ art: { tradition: 'iberian' }, proficiency: 6 }), SU.ib.coop);
  assert.equal(duelHunt({ art: { tradition: 'iberian' }, proficiency: 6 }), false, '이베리아는 사냥할 때 그대로');
  assert.equal(duelHunt({ art: { tradition: 'italian' }, proficiency: 6 }), true);
  assert.equal(duelHunt({ art: { tradition: 'italian' }, proficiency: 3 }), false, '숙련 3 (몫 0.44) — 문턱 밑');
  assert.equal(duelK(null), 0);
});

test('③ 독일 · 동방 돌기: 동료에게서 먼 쪽으로 · 각이 넉넉하면 · 다른 유파 · 숙련 2 는 그대로', () => {
  // 나(0) (0, 0) → +x 를 봄 · 상대(1) (1.5, 0) · 동료(2) (−0.3, 1.2) 가 같은 상대를 겨눔 (상대 자리에서 본 각 ≈ 34° · 내가 동료 칼길 밖) — 동료는 숙련 4 (6 이면 내게 묶기 역할을 줌 → 앞을 지킴)
  for (const school of ['german', 'chinese']) {
    const F = [fake(0, 0, 0, 0, 0, { school }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
    board(F, [1, 2, 1]); // 상대(1)는 동료(2)와 붙음 (동료가 앞을 잡음)
    const [fwd, side] = noRandom(() => supportFeet(F[0].aiCtl, 0, 0));
    assert.equal(fwd, 0);
    assert.ok(side < -0.3, `${school}: 동료(+z)에게서 먼 쪽(−z = 왼쪽)으로 돎 — ${side}`);
  }
  // 각이 넉넉함: 동료가 상대 맞은편 (2.8, 0.3)
  const F = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, 2.8, 0.3, Math.PI)];
  board(F, [1, 2, 1]);
  assert.deepEqual(supportFeet(F[0].aiCtl, 0.2, 0.1), [0.2, 0.1]);
  for (const o of [{ school: 'japanese' }, { school: 'german', prof: 2 }, { school: 'italian' }]) {
    const G = [fake(0, 0, 0, 0, 0, o), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
    board(G, [1, 2, 1]);
    assert.deepEqual(supportFeet(G[0].aiCtl, 0.2, 0.1), [0.2, 0.1], JSON.stringify(o));
  }
  // 동방은 공격 다가감에서는 돌지 않음 · 독일은 돎
  const C = [fake(0, 0, 0, 0, 0, { school: 'chinese', mode: 'attack' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
  C[0].aiCtl.phase = 'approach';
  board(C, [1, 2, 1]);
  assert.deepEqual(supportFeet(C[0].aiCtl, 0.3, 0), [0.3, 0]);
  const D = [fake(0, 0, 0, 0, 0, { school: 'german', mode: 'attack' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
  D[0].aiCtl.phase = 'approach';
  board(D, [1, 2, 1]);
  assert.ok(supportFeet(D[0].aiCtl, 0.3, 0)[1] < 0);
  // 상대가 나를 겨눔 (동료와 붙지 않음) → 돌지 않음
  const E = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 4 })];
  board(E, [1, 0, 1]);
  assert.deepEqual(supportFeet(E[0].aiCtl, 0.2, 0.1), [0.2, 0.1]);
  // 동료 칼길 밖: 동료(2) (0, 0) → 그 상대(1) (3, 0) 줄 위 (1.5, 0.2) 에 선 나(0) 는 줄에서 먼 쪽(+z = 오른쪽)으로 비킴 · 일본은 그대로
  for (const school of ['german', 'chinese', 'japanese']) {
    const Q = [fake(0, 0, 1.5, 0.2, 0, { school }), fake(1, 1, 3, 0, Math.PI), fake(2, 0, 0, 0, 0, { prof: 4 })];
    board(Q, [1, 2, 1]);
    const q = noRandom(() => supportFeet(Q[0].aiCtl, 0.2, -0.5));
    if (school === 'japanese') assert.deepEqual(q, [0.2, -0.5]);
    else assert.ok(q[1] > 0.2, `${school}: ${q}`);
  }
  // 6 동료가 준 묶기 역할을 받은 몸은 돌지 않음 (앞을 지킴 — team_sense.js 와 같음)
  const P = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -0.3, 1.2, 0, { prof: 6 })];
  const MP = board(P, [1, 0, 1]);
  assert.equal(MP.sense.roles.get(P[0])?.role, 'pin');
  assert.deepEqual(supportFeet(P[0].aiCtl, 0.2, 0.1), [0.2, 0.1]);
});

test('④ 이베리아: 칼길 · 혼자는 그대로', () => {
  // 나(0) → 상대(1) +x 2 m · 동료(2) 가 줄에서 0.3 m (칼 부채꼴 안)
  const F = [fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.3, 0)];
  board(F, [1, 0, 1]);
  assert.equal(noRandom(() => laneFree(F[0].aiCtl)), true, '한가운데가 아니면 미루지 않음');
  const [, side] = supportFeet(F[0].aiCtl, 0, 0);
  assert.ok(side > 0, '비키는 걸음(동료 반대쪽 −)을 거둠 → +');
  // 한가운데 (줄에서 0.05 m)
  const G = [fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.05, 0)];
  board(G, [1, 0, 1]);
  assert.equal(laneFree(G[0].aiCtl), false);
  // 다른 유파는 늘 false
  const H = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.3, 0)];
  board(H, [1, 0, 1]);
  assert.equal(laneFree(H[0].aiCtl), false);
  // 겨눔 덧셈은 없음 (나눠 맡기 그대로)
  const M = board([fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 0, 1.6, 0), fake(3, 1, 2, 1.6, Math.PI)], [1, 0, 1, 2]);
  assert.equal(supportScore(M, M.fighters[0], M.fighters[1]), 0);
  // 혼자 (2:1 의 혼자 — 동료 없음): 덧셈 · 비킴 셈 모두 그대로
  const L = board([fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 1, 2, 1.6, Math.PI)], [1, 0, 0]);
  assert.equal(supportScore(L, L.fighters[0], L.fighters[1]), 0);
  assert.equal(laneFree(L.fighters[0].aiCtl), false);
  assert.deepEqual(supportFeet(L.fighters[0].aiCtl, 0.2, 0.1), [0.2, 0.1]);
});

test('⑤ 독일: 동료와 붙은 적 겨눔 · 동료 칼끝 쪽 밀치기 · 동료가 칠 때 박자', () => {
  // 0 · 2 = 0 편 · 1 · 3 = 1 편. 3 이 동료 2 와 붙음 (2 를 겨눠 1.2 m) · 0 은 1 을 겨눔 (1 은 2 를 겨눔 — 0 을 붙잡지 않음)
  const F = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const M = board(F, [1, 2, 3, 2]);
  assert.equal(supportScore(M, F[0], F[3]), -SU.de.focus);
  assert.equal(supportScore(M, F[0], F[1]), 0);
  // 지금 상대(1)가 나를 붙잡음 → 다른 적 덧셈 없음
  const G = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.2, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const MG = board(G, [1, 0, 3, 2]);
  assert.equal(supportScore(MG, G[0], G[3]), 0);
  // 밀치기: 나(0) → 상대(1) 0.6 m · 동료(2) 가 상대 맞은편 (1.6, 0.2) → 밀면 동료 칼끝 쪽
  const S = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 1.6, 0.2, Math.PI)];
  board(S, [1, 0, 1]);
  assert.equal(noRandom(() => shoveToMate(S[0].aiCtl)), true);
  const T = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, -0.2, 0.8, 0)];
  board(T, [1, 0, 1]);
  assert.equal(shoveToMate(T[0].aiCtl), true, '묶기: 동료가 곁(상대에서 pinR 안)에 서 있으면 붙어 묶음');
  const V = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, -3.5, 2.5, 0)];
  board(V, [1, 0, 1]);
  assert.equal(shoveToMate(V[0].aiCtl), false, '동료가 멀면 굴림대로');
  const Lo = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 1, 1.6, 0.2, Math.PI)];
  board(Lo, [1, 0, 0]);
  assert.equal(shoveToMate(Lo[0].aiCtl), false, '혼자(동료 없음)는 굴림대로');
  const U = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 1.6, 0.2, Math.PI)];
  board(U, [1, 0, 1]);
  assert.equal(shoveToMate(U[0].aiCtl), false, '독일만');
  // 박자: 동료(2) 가 내 상대(1)를 치는 중 (공격 꼴 · 붙음)
  const A = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, 1.5, 1.2, 0, { mode: 'attack' })];
  const MA = board(A, [1, 2, 1]);
  assert.deepEqual(noRandom(() => supportOpp(A[0].aiCtl)), { v: SU.de.follow, kind: 'ambush' });
  A[2].aiCtl.mode = 'watch'; // 동료가 치기를 멈춤 → 늦은 장(층 눈)이 그 장을 볼 때부터 없음
  for (const t of [1, 2]) (MA.t = t), recordSense(MA);
  assert.equal(supportOpp(A[0].aiCtl), null);
});

test('⑥ 동방: 동료와 붙은 적의 앞 밖이면 기습 · 앞이면 없음 · 치고 빠짐', () => {
  // 상대(1) 가 동료(2)를 겨눔 (+z 쪽을 봄 — heading −π/2 → forward (0, 1)) · 나(0) 는 그 옆 (−x 쪽)
  const F = [fake(0, 0, 0.3, 0, 0, { school: 'chinese' }), fake(1, 1, 1.8, 0, -Math.PI / 2), fake(2, 0, 1.8, 1.4, Math.PI / 2)];
  board(F, [1, 2, 1]);
  assert.deepEqual(noRandom(() => supportOpp(F[0].aiCtl)), { v: SU.cn.ambush, kind: 'ambush' });
  assert.equal(noRandom(() => supportChain(F[0].aiCtl, 0.8)), 0.8 * (1 - SU.cn.run));
  // 내가 그 앞 (상대 앞 +z 쪽 — 동료 곁)
  const G = [fake(0, 0, 2.6, 1.3, Math.PI, { school: 'chinese' }), fake(1, 1, 1.8, 0, -Math.PI / 2), fake(2, 0, 1.8, 1.4, Math.PI / 2)];
  board(G, [1, 2, 1]);
  assert.equal(supportOpp(G[0].aiCtl), null);
  // 상대가 나와 붙음 (동료와 아님) → 그대로
  const H = [fake(0, 0, 0.3, 0, 0, { school: 'chinese' }), fake(1, 1, 1.8, 0, Math.PI), fake(2, 0, 1.8, 2.6, 0)];
  board(H, [1, 0, 1]);
  assert.equal(supportChain(H[0].aiCtl, 0.8), 0.8);
  assert.equal(supportOpp(H[0].aiCtl), null);
});

test('⑦ 이탈리아 결투 고집: 엄호 덧셈을 거둠 · 사냥할 때로 보지 않음 (독일은 그대로)', () => {
  // team_sense.test ④ 엄호와 같은 판: 2 가 무릎 · 3 이 2 를 겨눔 · 0 은 1 을 겨눔
  const mk = (school, prof) => [fake(0, 0, 0, 0, 0, { school, prof }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0, { state: 'kneel' }), fake(3, 1, 2.5, 2.5, Math.PI)];
  const D = mk('german', 2);
  const MD = board(D, [1, 0, 3, 2]);
  assert.equal(senseScore(MD, D[0], D[3]), -TS.cover.sub);
  const I = mk('italian', 2);
  const MI = board(I, [1, 0, 3, 2]);
  assert.equal(senseScore(MI, I[0], I[3]), -TS.cover.sub, '숙련 2: 몫 0 — 그대로');
  const B6 = mk('iberian', 6);
  const MB6 = board(B6, [1, 0, 3, 2]);
  assert.equal(senseScore(MB6, B6[0], B6[3]), -TS.cover.sub * (1 - SU.ib.coop), '이베리아: coop 만큼 거둠');
  const I6 = mk('italian', 6);
  const MI6 = board(I6, [1, 0, 3, 2]);
  assert.equal(senseScore(MI6, I6[0], I6[3]) + 0, 0, '숙련 6: 엄호 덧셈 없음');
  // 사냥할 때(겨눈 상대가 동료와 붙음): 독일은 참 · 이탈리아 숙련 6 은 거짓 (제 간격에서 기다리는 꼴 그대로) · 숙련 2 는 참
  const hunt = (school, prof) => {
    const H = [fake(0, 0, 0, 0, 0, { school, prof }), fake(1, 1, 2.5, 0, Math.PI / 2), fake(2, 0, 2.5, 1.5, -Math.PI / 2)];
    board(H, [1, 2, 1]);
    return huntFree(H[0].aiCtl);
  };
  assert.equal(hunt('german', 6), true);
  assert.equal(hunt('italian', 6), false);
  assert.equal(hunt('italian', 2), true);
});
