// 서포트 (11/19 — 사장님 '동방과 독일이 서포트에 강하고 이베리아가 서포트에 특별히 도움 안 되는 걸로 하자' · src/team_support.js · 기록 docs/strike/team_support_2026-11-19.md):
//  ① 1:1 AI 는 이 셈을 하나도 타지 않음 (supS · stats.support 없음) · 셋 이상 판(2:1)의 AI 는 탐
//  ② 몫 = 숙련 곡선 MINDSET.profF (숙련 2 이하 0 · 4 = 0.75 · 6 = 1) · 유파 칸 없는 몸(일본 · 이탈리아 · 무유파) 0 — 이탈리아 결투 고집은 마음가짐 many 칸(many_ally.test.mjs)
//  ③ 독일 돌기: 동료와 붙은 내 상대를 축으로 동료에게서 먼 쪽 · 각이 넉넉하면 · 상대가 나를 겨누면 그대로 · 다른 유파 · 숙련 2 · 동방(4 차 — 돌기 없음)은 그대로 · 동료 칼길에 서면 비킴 · 묶기 역할은 앞을 지킴
//  ④ 이베리아 (7 차 — 사장님 11/20 '(나)로 · 좀 더 마구잡이로 베어서'): (나) 같은 편 비킴 거리 × sepX · 동료와 붙은 적을 피함 / 마구잡이 베기 버릇 몫 h = 1 − calm × 숙련 곡선 —
//     칼길: 줄에서 lane.w × (1 − h) 밖이면 미루지 않음 · 비키는 걸음 × (1 − h) · 서 있는 동료가 있으면 크게 휩쓰는 베기 무게 · 혼자(동료 없음)는 그대로
//  ⑤ 독일: 동료의 적으로 겨눔을 바꾸지 않음 — 제 적이 이미 묶여 있을 때만(무릎 · 칼 놓침 …) 동료를 치는 적으로 · 동료 칼끝 쪽 밀치기 · 동료가 곁이면 묶기 · 2:2 의 제 적은 묶음 ·
//     동료 칼길 위에서는 밀지 않음 · 혼자는 굴림대로 · 동료가 칠 때 박자
//  ⑥ 동방: 동료를 치는 적 겨눔 (치는 중이면 더 · 붙잡혀 있으면 없음) · 기습 (그 적 앞 밖만) · 치고 빠짐(2:2) · 바꿀 적이 없으면(2:1) 다가가 붙어 있고 이어 침
//  ⑧ 난수를 부르지 않음
//  node --test tools/sim/team_support.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { aiAtProficiency } from '../../src/characters.js';
import { createSense, recordSense } from '../../src/team_sense.js';
import { supportOf, supportScore, supportFeet, mateSepX, laneFree, supportOpp, shoveToMate, supportChain, sweepOf, sweepW } from '../../src/team_support.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';

const TS = CONFIG.TEAM_SENSE;
const SU = CONFIG.TEAM_SUPPORT;
const profF = CONFIG.MINDSET.profF;
// AI 굴림 씨앗 (11/20 — ai_run.test.mjs 와 같은 꼴): newMatch 의 seed 는 무기 파손 굴림(breakSeed)만 — AI 생성자 · 판단 굴림은 전역 Math.random 이라
//  판마다 시험이 씨앗을 둔다 (fights12 · many_fighters.test.mjs 와 같은 굴림 · 같은 씨앗이면 늘 같은 싸움). 시험이 끝나면 원래 Math.random 으로 되돌림
const realRandom = Math.random;
const seedRand = (t, seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  t.after(() => { Math.random = realRandom; });
};

/** 가짜 몸 (team_sense.test.mjs 와 같은 꼴 + 유파): 가슴 (x, z) · 바라보는 각 heading(라디안 — forward = (cos h, −sin h)) · 편 · 유파 · 숙련 */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: o.state ?? 'stand', armed: true, blood: 1, foe: null, stamina: { level: 0, exhausted: false },
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

test('① 1:1 AI 는 서포트 셈을 타지 않음 · 2:1 AI 는 탐', (t) => {
  const W = ['longsword', 'hwando'];
  seedRand(t, 3);
  const G = newMatch({ count: 2, ai: 'all', seed: 3, walls: true, weapons: W, aiOf: (i) => aiOf(W[i], 6) });
  for (let i = 0; i < 900 && !G.over; i++) G.step();
  for (const a of G.ais) {
    assert.equal(a.supS, undefined, '1:1: supportOf 를 부른 적 없음');
    assert.equal(a.stats.support, undefined);
  }
  const W3 = ['longsword', 'uchigatana', 'hwando'];
  seedRand(t, 3);
  const H = newMatch({ count: 3, ai: 'all', seed: 3, walls: true, weapons: W3, aiOf: (i) => aiOf(W3[i], 6) });
  for (let i = 0; i < 600 && !H.over; i++) H.step();
  assert.equal(H.ais[0].supS?.key, 'de');
  assert.equal(H.ais[0].supS?.w, 1);
  assert.equal(H.ais[2].supS?.key, 'cn');
});

test('② 몫 = 숙련 곡선 · 일본 · 이탈리아 · 무유파 0', () => {
  for (const p of [0, 1, 2, 3, 4, 5, 6]) assert.equal(supportOf({ art: { tradition: 'german' }, proficiency: p }).w, profF[p]);
  assert.equal(profF[2], 0);
  assert.equal(profF[4], 0.75);
  assert.equal(supportOf({ art: { tradition: 'japanese' }, proficiency: 6 }).w, 0);
  assert.equal(supportOf({ art: { tradition: 'none' }, proficiency: 6 }).w, 0);
  assert.equal(supportOf({ art: { tradition: 'italian' }, proficiency: 6 }).w, 0);
  assert.equal(supportOf({ art: { tradition: 'iberian' }, proficiency: 4 }).w, 0.75);
  assert.ok(Math.abs(mateSepX({ art: { tradition: 'iberian' }, proficiency: 6 }) - SU.ib.sepX) < 1e-12);
  assert.ok(Math.abs(mateSepX({ art: { tradition: 'iberian' }, proficiency: 4 }) - (1 + (SU.ib.sepX - 1) * 0.75)) < 1e-12);
  assert.ok(SU.ib.sepX > 1, '(나) 동료와 떨어져 섬');
  assert.equal(mateSepX({ art: { tradition: 'iberian' }, proficiency: 2 }), 1);
  // 마구잡이 베기 버릇 몫 h = 1 − calm × 숙련 곡선 (숙련이 낮을수록 · 높아도 남음) · 다른 유파 0
  for (const p of [0, 1, 2, 3, 4, 5, 6]) assert.ok(Math.abs(supportOf({ art: { tradition: 'iberian' }, proficiency: p }).h - (1 - SU.ib.calm * profF[p])) < 1e-12, `h p${p}`);
  assert.equal(supportOf({ art: { tradition: 'iberian' }, proficiency: 2 }).h, 1);
  assert.ok(supportOf({ art: { tradition: 'iberian' }, proficiency: 6 }).h > 0.5, '숙련 6 에도 남음');
  for (const s of ['german', 'chinese', 'italian', 'japanese', 'none']) assert.equal(supportOf({ art: { tradition: s }, proficiency: 4 }).h, 0, s);
  assert.equal(mateSepX({ art: { tradition: 'german' }, proficiency: 6 }), 1);
});

test('③ 독일 돌기: 동료에게서 먼 쪽으로 · 각이 넉넉하면 · 다른 유파 · 숙련 2 · 동방은 그대로', () => {
  // 나(0) (0, 0) → +x 를 봄 · 상대(1) (1.5, 0) · 동료(2) (−0.3, 1.2) 가 같은 상대를 겨눔 (상대 자리에서 본 각 ≈ 34° · 내가 동료 칼길 밖) — 동료는 숙련 4 (6 이면 내게 묶기 역할을 줌 → 앞을 지킴)
  for (const school of ['german']) {
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
  for (const o of [{ school: 'japanese' }, { school: 'german', prof: 2 }, { school: 'italian' }, { school: 'chinese' }]) {
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

test('④ 이베리아 (7 차): (나) 동료와 붙은 적을 피함 · 마구잡이 베기 — 칼길 · 비킴 거둠 · 휩쓰는 베기 · 혼자는 그대로', () => {
  // (나) 동료가 붙은 적을 피함: 나(0) → 상대(1) · 동료(2) 와 붙은 적(3) 겨눔 + avoid × w
  const M = board([fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)], [1, 2, 3, 2]);
  assert.ok(Math.abs(noRandom(() => supportScore(M, M.fighters[0], M.fighters[3])) - SU.ib.avoid) < 1e-12);
  assert.equal(M.fighters[0].aiCtl.stats.support.ibAvoid, 1);
  assert.equal(supportScore(M, M.fighters[0], M.fighters[1]), 0, '동료와 붙지 않은 적은 그대로');
  const M2 = board([fake(0, 0, 0, 0, 0, { school: 'iberian', prof: 2 }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)], [1, 2, 3, 2]);
  assert.equal(supportScore(M2, M2.fighters[0], M2.fighters[3]), 0, '숙련 2 는 (나) 몫 0');
  // 칼길: 나 → 상대 +x 2 m · 동료가 줄에서 0.3 m (칼 부채꼴 안) — 숙련 6 (h = 1 − calm): 줄 폭 lane.w × calm 밖 → 미루지 않음
  const h6 = 1 - SU.ib.calm;
  const L = [fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.3, 0, { prof: 4 })];
  board(L, [1, 0, 1]);
  assert.ok(0.3 > TS.lane.w * (1 - h6));
  assert.equal(noRandom(() => laneFree(L[0].aiCtl)), true);
  // 비키는 걸음 거둠: senseFeet ① 이 낸 옆 걸음 −side × k × clamp(1 − perp / w) 의 h 만큼 되돌림
  const step = TS.lane.k * Math.min(1, Math.max(0.3, 1 - 0.3 / TS.lane.w));
  const [fw, sd] = noRandom(() => supportFeet(L[0].aiCtl, 0.2, -0.3));
  assert.equal(fw, 0.2);
  assert.ok(Math.abs(sd - (-0.3 + step * h6)) < 1e-9, `비킴 × (1 − h) ${sd}`);
  assert.equal(L[0].aiCtl.stats.support.ibLaneStep, 1);
  // 한가운데(0.05 m): 숙련 6 은 미룸 · 숙련 2 (h 1) 는 늘 안 미룸
  const Lc = [fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.05, 0, { prof: 4 })];
  board(Lc, [1, 0, 1]);
  assert.equal(laneFree(Lc[0].aiCtl), false, '숙련 6 은 한가운데면 미룸');
  const L2 = [fake(0, 0, 0, 0, 0, { school: 'iberian', prof: 2 }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.05, 0, { prof: 4 })];
  board(L2, [1, 0, 1]);
  assert.equal(laneFree(L2[0].aiCtl), true, '숙련 2 는 한가운데도 안 미룸');
  const Ld = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.0, 0.3, 0, { prof: 4 })];
  board(Ld, [1, 0, 1]);
  assert.equal(laneFree(Ld[0].aiCtl), false, '독일은 늘 미룸 셈 그대로');
  // 칼길에 동료가 없으면 걸음 그대로
  const Far = [fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 0, 1.5, 0, { prof: 4 })];
  board(Far, [1, 0, 1]);
  assert.deepEqual(supportFeet(Far[0].aiCtl, 0.2, -0.3), [0.2, -0.3], '(가) 원 가로지름은 걷음 — 동료 쪽으로 돌지 않음');
  // 휩쓰는 베기: 서 있는 동료가 있으면 sweep × h · 가로 베기 1 + k · 비스듬히 · 곧게 내려베기 ≈ 1 · 찌르기 1
  const k = noRandom(() => sweepOf(Far[0].aiCtl));
  assert.ok(Math.abs(k - SU.ib.sweep * h6) < 1e-12);
  const T = TECH_BY_NAME;
  assert.ok(Math.abs(sweepW(k, T.zwerch) - (1 + k)) < 1e-12, '가로 베기');
  assert.ok(Math.abs(sweepW(k, T.zornhau) - (1 + k)) < 1e-12, '비스듬히 (가로 0.82 m)');
  assert.ok(sweepW(k, T.unterhau) > 1 && sweepW(k, T.unterhau) < 1 + k, '올려 비스듬히 (가로 0.6 m)');
  assert.ok(sweepW(k, T.oberhau) < 1 + 0.05 * k, '곧게 내려베기');
  assert.equal(sweepW(k, T.stichPflug), 1, '찌르기');
  assert.equal(sweepW(0, T.zwerch), 1);
  assert.equal(sweepOf(Ld[0].aiCtl), 0, '독일 0');
  // 혼자 (2:1 의 혼자 — 동료 없음): 그대로
  const S = board([fake(0, 0, 0, 0, 0, { school: 'iberian' }), fake(1, 1, 2, 0, Math.PI), fake(2, 1, 2, 1.6, Math.PI)], [1, 0, 0]);
  assert.equal(laneFree(S.fighters[0].aiCtl), false);
  assert.deepEqual(supportFeet(S.fighters[0].aiCtl, 0.2, -0.3), [0.2, -0.3]);
  assert.equal(sweepOf(S.fighters[0].aiCtl), 0, '혼자는 휩쓰는 베기 덧셈 없음');
});

test('⑤ 독일: 동료와 붙은 적 겨눔 · 동료 칼끝 쪽 밀치기 · 묶기 · 동료 칼길 위에서는 안 밂 · 동료가 칠 때 박자', () => {
  // 0 · 2 = 0 편 · 1 · 3 = 1 편. 3 이 동료 2 와 붙음 (2 를 겨눠 1.2 m) · 0 은 1 을 겨눔 (1 은 2 를 겨눔 — 0 을 붙잡지 않음)
  const F = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const M = board(F, [1, 2, 3, 2]);
  assert.equal(supportScore(M, F[0], F[3]), 0, '독일은 동료의 적으로 겨눔을 바꾸지 않음 (제 적이 서서 칼을 쥠)');
  assert.equal(supportScore(M, F[0], F[1]), 0);
  // 동료를 치는 적 (6 차): 제 적(1)이 이미 묶여 있을 때만 (무릎 · 칼 놓침)
  F[1].state = 'kneel';
  assert.equal(supportScore(M, F[0], F[3]), -SU.de.focus, '제 적이 무릎 — 동료를 치는 적으로');
  assert.equal(F[0].aiCtl.stats.support.deSwitch, 1);
  F[1].state = 'stand';
  F[1].armed = false;
  assert.equal(supportScore(M, F[0], F[3]), -SU.de.focus, '제 적이 칼을 놓침');
  F[1].armed = true;
  assert.equal(supportScore(M, F[0], F[3]), 0);
  // 2:2 의 제 적 묶기: 동료가 멀어도(다른 적과 붙음) 내 적(1)이 내 동료와 붙지 않았으면 밂
  const O = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, -3.5, 4.0, 0), fake(3, 1, -2.5, 4.0, Math.PI)];
  board(O, [1, 0, 3, 2]);
  assert.equal(noRandom(() => shoveToMate(O[0].aiCtl)), 1);
  // 지금 상대(1)가 나를 붙잡음 → 다른 적 덧셈 없음
  const G = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.2, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const MG = board(G, [1, 0, 3, 2]);
  assert.equal(supportScore(MG, G[0], G[3]), 0);
  // 밀치기: 나(0) → 상대(1) 0.6 m · 동료(2) 가 상대 맞은편 (1.6, 0.2) → 밀면 동료 칼끝 쪽
  const S = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 1.6, 0.2, Math.PI)];
  board(S, [1, 0, 1]);
  assert.equal(noRandom(() => shoveToMate(S[0].aiCtl)), 1);
  const T = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 0.6, 2.0, -Math.PI / 2)];
  board(T, [1, 0, 1]);
  assert.equal(shoveToMate(T[0].aiCtl), 1, '묶기: 동료가 곁(상대에서 pinR 안)에 서 있으면 붙어 묶음');
  const B = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, -0.2, 0.8, 0)];
  board(B, [1, 0, 1]);
  assert.equal(shoveToMate(B[0].aiCtl), -1, '동료 칼길(동료 → 상대 줄) 위에 서 있으면 밀지 않음');
  const V = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 3.5, 3.0, Math.PI)];
  board(V, [1, 0, 1]);
  assert.equal(shoveToMate(V[0].aiCtl), 0, '동료가 멀면 굴림대로');
  const Lo = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 1, 1.6, 0.2, Math.PI)];
  board(Lo, [1, 0, 0]);
  assert.equal(shoveToMate(Lo[0].aiCtl), 0, '혼자(동료 없음)는 굴림대로');
  const U = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 0.6, 0, Math.PI), fake(2, 0, 1.6, 0.2, Math.PI)];
  board(U, [1, 0, 1]);
  assert.equal(shoveToMate(U[0].aiCtl), 0, '독일만');
  // 박자: 동료(2) 가 내 상대(1)를 치는 중 (공격 꼴 · 붙음)
  const A = [fake(0, 0, 0, 0, 0, { school: 'german' }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, 1.5, 1.2, 0, { mode: 'attack' })];
  const MA = board(A, [1, 2, 1]);
  assert.deepEqual(noRandom(() => supportOpp(A[0].aiCtl)), { v: SU.de.follow, kind: 'ambush' });
  A[2].aiCtl.mode = 'watch'; // 동료가 치기를 멈춤 → 늦은 장(층 눈)이 그 장을 볼 때부터 없음
  for (const t of [1, 2]) (MA.t = t), recordSense(MA);
  assert.equal(supportOpp(A[0].aiCtl), null);
});

test('⑥ 동방: 동료를 치는 적 겨눔 · 동료와 붙은 적의 앞 밖이면 기습 · 앞이면 없음 · 치고 빠짐', () => {
  // 0 · 2 = 0 편 · 1 · 3 = 1 편. 3 이 동료 2 와 붙음 · 0 은 1 을 겨눔 (1 은 2 를 겨눔 — 0 을 붙잡지 않음)
  const Q = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const MQ = board(Q, [1, 2, 3, 2]);
  assert.equal(noRandom(() => supportScore(MQ, Q[0], Q[3])), -SU.cn.focus);
  const Qa = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 2.5, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI, { mode: 'attack' })];
  const MQa = board(Qa, [1, 2, 3, 2]);
  assert.equal(supportScore(MQa, Qa[0], Qa[3]), -(SU.cn.focus + SU.cn.hit), '동료를 치는 중이면 더');
  const Qp = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 1.2, 0, Math.PI), fake(2, 0, 1.0, 2.0, 0), fake(3, 1, 2.2, 2.0, Math.PI)];
  const MQp = board(Qp, [1, 0, 3, 2]);
  assert.equal(supportScore(MQp, Qp[0], Qp[3]), 0, '지금 상대가 나를 붙잡음');
  // 상대(1) 가 동료(2)를 겨눔 (+z 쪽을 봄 — heading −π/2 → forward (0, 1)) · 나(0) 는 그 옆 (−x 쪽)
  const F = [fake(0, 0, 0.3, 0, 0, { school: 'chinese' }), fake(1, 1, 1.8, 0, -Math.PI / 2), fake(2, 0, 1.8, 1.4, Math.PI / 2)];
  board(F, [1, 2, 1]);
  assert.deepEqual(noRandom(() => supportOpp(F[0].aiCtl)), { v: SU.cn.ambush, kind: 'ambush' });
  assert.equal(noRandom(() => supportChain(F[0].aiCtl, 0.8)), 0.8 * (1 + SU.cn.press), '2:1 (바꿀 적 없음): 붙어 싸움');
  // 2:2 (서 있는 적 둘): 치고 빠짐
  const F4 = [fake(0, 0, 0.3, 0, 0, { school: 'chinese' }), fake(1, 1, 1.8, 0, -Math.PI / 2), fake(2, 0, 1.8, 1.4, Math.PI / 2), fake(3, 1, -3, -3, 0)];
  board(F4, [1, 2, 1, 0]);
  assert.equal(supportChain(F4[0].aiCtl, 0.8), 0.8 * (1 - SU.cn.run));
  // 다가감 (2:1 · 동료가 앞을 잡음): 칼끝 + inGap 밖이면 앞 스틱 inK 까지 · 안에서는 물러나지 않음 · 2:2 는 그대로
  const In = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 2.5, 0, Math.PI / 2), fake(2, 0, 2.5, 1.4, -Math.PI / 2, { prof: 4 })];
  board(In, [1, 2, 1]);
  assert.deepEqual(noRandom(() => supportFeet(In[0].aiCtl, 0.1, 0.2)), [SU.cn.inK, 0.2]);
  const In2 = [fake(0, 0, 1.0, 0, 0, { school: 'chinese' }), fake(1, 1, 2.5, 0, Math.PI / 2), fake(2, 0, 2.5, 1.4, -Math.PI / 2, { prof: 4 })];
  board(In2, [1, 2, 1]);
  assert.deepEqual(supportFeet(In2[0].aiCtl, -0.4, 0.2), [0, 0.2], '붙어 있음 — 물러나지 않음');
  const In4 = [fake(0, 0, 0, 0, 0, { school: 'chinese' }), fake(1, 1, 2.5, 0, Math.PI / 2), fake(2, 0, 2.5, 1.4, -Math.PI / 2, { prof: 4 }), fake(3, 1, -3, -3, 0)];
  board(In4, [1, 2, 1, 0]);
  assert.deepEqual(supportFeet(In4[0].aiCtl, 0.1, 0.2), [0.1, 0.2], '2:2 는 그대로');
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
