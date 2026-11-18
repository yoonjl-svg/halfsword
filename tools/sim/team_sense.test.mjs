// 무리 싸움 판단 (11/18 — 사장님 '다대다 전투에서 ai의 지능이 너무 무식하긴 해' · 설계 docs/design/team_sense_2026-11-18.md · src/team_sense.js):
//  ① 1:1 은 판 사본이 없다 (createMatch 가 셋 이상 판에만 M.sense · f.teamSense) · 2:2 · 셋 따로는 있고 한 장에 몸 N 칸
//  ② 층 가름 (본 유파 숙련도 — 바탕 0 ~ 2 · 가운데 3 ~ 5 몫 (p − 2) ÷ 3 · 위 6) · 눈(시야 · 늦음)
//  ③ 판 사본 사실: 늦은 장 고르기 · 붙음 · 시야 밖 몸은 안 보임 · 지금 겨눈 상대는 늘 보임
//  ④ 엄호 겨눔 (다친 동료를 겨눈 적 −) · 사람 몸은 덧셈 없음 · 칼길 비우기(동료가 칼 부채꼴 · 줄 위) · 열세 셈에서 동료와 붙은 적 뺌
//  ④ 사냥할 때(huntFree — 겨눈 상대가 남과 붙었고 나를 붙잡은 적 없음): 상대가 들어오기를 기다리는 꼴(고노센 준비 · 싱지르 · 리솔루토 · 이베리아 무장)을 안 기다림
//  ⑤ 편 수를 셈하지 않음 — 셋 따로(편 0 · 1 · 2)에서 남의 편 몸은 동료로 안 읽음 · 새 셈은 난수를 부르지 않음
//  ⑥ (P2 가운데 3 ~ 5) 노릴 상대(옆 · 등 보인 붙은 적 · 다친 적 · 지친 적 · 몰아침 — 붙잡혀 있으면 없음) · 협공 각 80 / 100 / 120° · 옆 기습 빈틈(바탕은 없음) · 끼어듦
//  ⑦ (P3 위 6) 내다봄(피 흐름) · 엄호 미리 · 2:2 → 2:1(지고 있는 동료의 적) · 칼 내는 순간 기습(기다림 → 침) · 틈 베기 · 방패 · 이끌기 · 역할(묶기 · 이어 치기 — AI 동료만) ·
//     등 뒤 알림(판정 · 화면 밖 화살표 깜빡)
//  node --test tools/sim/team_sense.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG, DT } from './jelly_harness.mjs';
import { createSense, recordSense, frameAt, tierOfProf, viewOf, senseScore, senseHold, laneMate, laneHold, busyFoe, outSkill, senseFeet, busyWithOther, pincerGoal, ambushOpp, shieldOpp, bloodAhead, assignRoles, backThreat, huntFree } from '../../src/team_sense.js';
import { targetScore } from '../../src/targeting.js';
import { createTeamHud, TEAM_COLORS } from '../../src/team_hud.js';
import * as THREE from 'three';

const TS = CONFIG.TEAM_SENSE;

/** 가짜 몸: 가슴 (x, z) · 바라보는 각 heading(라디안 — fighter.forward = (cos h, −sin h)) · 편 · AI 꼴 */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: o.state ?? 'stand', blood: o.blood ?? 1, foe: null, stamina: { level: 0, exhausted: false },
    bodies: { chest: { translation: () => ({ x, y: 1.3, z }) }, pelvis: { linvel: () => ({ x: 0, y: 0, z: 0 }) } },
  };
  if (o.ai !== false) f.aiCtl = { me: f, mode: o.mode ?? 'watch', M: { reach: o.reach ?? 1.8 }, mainProficiency: o.prof ?? 2, proficiency: o.prof ?? 2, stats: {}, sense: { t: 0 }, foe: null };
  return f;
}
/** 가짜 판: 몸들 · 겨눔(foes[i] = 겨눈 자리) · 판 사본 한 장 */
function board(F, foes) {
  F.forEach((f, i) => {
    f.foe = foes[i] >= 0 ? F[foes[i]] : null;
    if (f.aiCtl) f.aiCtl.foe = f.foe;
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

test('① 1:1 은 판 사본 없음 · 2:2 는 있고 스텝마다 장이 쌓임 (몸 넷 칸)', () => {
  const G1 = newMatch({ seed: 1 });
  assert.equal(G1.sense, undefined);
  for (const f of G1.fighters) assert.equal(f.teamSense, undefined);
  const G = newMatch({ count: 4, ai: 'all', seed: 1 });
  assert.ok(G.sense);
  for (const f of G.fighters) assert.equal(f.teamSense, G.sense);
  for (let i = 0; i < 30; i++) G.step();
  assert.ok(G.sense.frames.length >= 4);
  const fr = G.sense.frames.at(-1);
  assert.equal(fr.b.length, 4);
  for (const r of fr.b) for (const k of ['x', 'z', 'fx', 'fz', 'foe', 'reach']) assert.equal(typeof r[k], 'number');
  // 장 사이 간격 = TEAM_SENSE.frame (게임 초)
  const F = G.sense.frames;
  assert.ok(Math.abs(F.at(-1).t - F.at(-2).t - TS.frame) < DT + 1e-9);
});

test('② 층: 0 ~ 2 바탕 · 3 ~ 5 가운데 몫 (p − 2) ÷ 3 · 6 위 (사방 · 0.2 s · 내다봄)', () => {
  for (const p of [0, 1, 2]) assert.deepEqual([tierOfProf(p).tier, tierOfProf(p).k], ['base', 0]);
  assert.deepEqual([3, 4, 5].map((p) => tierOfProf(p).tier), ['mid', 'mid', 'mid']);
  assert.deepEqual([3, 4, 5].map((p) => +tierOfProf(p).k.toFixed(3)), [0.333, 0.667, 1]);
  const top = tierOfProf(6);
  assert.equal(top.tier, 'top');
  assert.equal(top.eye.fov, 360);
  assert.ok(top.eye.lag < tierOfProf(4).eye.lag && tierOfProf(4).eye.lag < tierOfProf(2).eye.lag);
  assert.ok(top.eye.ahead > 0);
  // 협공 목표 각: 바탕 ≤ 가운데 ≤ 위
  assert.ok(pincerGoal(tierOfProf(2)) <= pincerGoal(tierOfProf(4)) && pincerGoal(tierOfProf(5)) <= pincerGoal(top));
  // 열세 몫: 바탕 = out.base · 5 · 6 = 1
  const A = (p) => ({ mainProficiency: p });
  assert.equal(outSkill(A(1)), TS.out.base);
  assert.equal(outSkill(A(5)), 1);
  assert.equal(outSkill(A(6)), 1);
});

test('③ 늦은 장 고르기 · 시야 (앞 120° 밖은 안 보임 · 겨눈 상대는 늘 보임 · 6 은 사방)', () => {
  const S = { frames: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((t) => ({ t, b: [] })) };
  assert.equal(frameAt(S, 0).t, 0.7);
  assert.equal(frameAt(S, 0.3).t, 0.4);
  assert.equal(frameAt(S, 5).t, 0);
  assert.equal(frameAt({ frames: [] }, 0.1), null);
  // 나(0 편)는 +x 를 봄 · 뒤(−x)에 적 2 · 앞에 적 1
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 1, -2, 0, 0)];
  board(F, [1, 0, 0]);
  const v = viewOf(F[0].aiCtl);
  assert.equal(v.sees(1), true);
  assert.equal(v.sees(2), false, '바탕 눈: 등 뒤는 안 보임');
  F[0].aiCtl.foe = F[2];
  assert.equal(viewOf(F[0].aiCtl).sees(2), true, '겨눈 상대는 늘 보임');
  const G = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 2, 0, Math.PI), fake(2, 1, -2, 0, 0)];
  board(G, [1, 0, 0]);
  assert.equal(viewOf(G[0].aiCtl).sees(2), true, '6: 사방');
});

test('④ 엄호 겨눔: 넘어진 동료를 겨눈 적 − cover.sub · 짧은 바꿈 기다림 · 사람 몸은 덧셈 없음', () => {
  // 0 · 2 = 0 편, 1 · 3 = 1 편. 2 가 무릎(서 있지 않음) · 3 이 2 를 겨눔 · 0 은 1 을 겨눔 (3 은 0 앞에 보임)
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0, { state: 'kneel' }), fake(3, 1, 2.5, 2.5, Math.PI)];
  const M = board(F, [1, 0, 3, 2]);
  assert.equal(senseScore(M, F[0], F[3]), -TS.cover.sub);
  assert.equal(senseScore(M, F[0], F[1]), 0);
  assert.equal(senseHold(M, F[0], F[3]), TS.cover.hold);
  assert.equal(senseHold(M, F[0], F[1]), null);
  // targetScore 에 들어감 (M.sense 가 있는 판)
  const want = Math.hypot(2.5, 2.5) + CONFIG.TEAM_FIGHT.target.allyAdd - TS.cover.sub; // 거리 + 나눠 맡기(동료 2 가 3 을 겨눔) − 엄호
  assert.ok(Math.abs(targetScore(M, F[0], F[3]) - want) < 1e-9);
  // 피가 cover.blood 밑이어도
  F[2].state = 'stand';
  F[2].blood = TS.cover.blood - 0.01;
  recordSense(Object.assign(M, { t: 1 }));
  assert.equal(senseScore(M, F[0], F[3]), -TS.cover.sub);
  // 사람 몸(aiCtl 없음)은 덧셈 없음
  const H = [fake(0, 0, 0, 0, 0, { ai: false }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0, { state: 'kneel' }), fake(3, 1, 2.5, 2.5, Math.PI)];
  const MH = board(H, [1, 0, 3, 2]);
  assert.equal(senseScore(MH, H[0], H[3]), 0);
  // 시야 밖(등 뒤)의 적은 모름 — 바탕 눈
  const B = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, -1.5, 0.3, 0, { state: 'kneel' }), fake(3, 1, -2.5, 0.3, 0)];
  const MB = board(B, [1, 0, 3, 2]);
  assert.equal(senseScore(MB, B[0], B[3]), 0);
});

test('④ 칼길 비우기: 동료가 나 → 상대 줄 위 · 칼 부채꼴이면 공격 미룸 · 옆으로 비킴', () => {
  // 나(0) → 상대(1) 가 +x 4 m · 동료(2)가 그 사이 (1.2, 0.2)
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 4, 0, Math.PI), fake(2, 0, 1.2, 0.2, 0)];
  board(F, [1, 0, 1]);
  const L = laneMate(F[0].aiCtl);
  assert.ok(L && L.fan);
  assert.equal(L.side, 1, '동료는 내 오른쪽 (+z = fighter.right)');
  assert.equal(laneHold(F[0].aiCtl), true);
  assert.equal(F[0].aiCtl.stats.team.laneHold, 1);
  // 미룸 걸쇠: lane.hold 동안은 다시 셈 없이 미룸
  assert.equal(laneHold(F[0].aiCtl), true);
  F[0].aiCtl.sense.t = TS.lane.hold + 0.01;
  F[2].bodies.chest.translation = () => ({ x: 1.2, y: 1.3, z: 1.5 }); // 줄에서 비켜남
  const M = { fighters: F, t: 1, sense: F[0].teamSense };
  recordSense(M);
  assert.ok(laneMate(F[0].aiCtl), '늦은 눈: 비킨 것을 아직 모름');
  recordSense(Object.assign(M, { t: 2 }));
  assert.equal(laneMate(F[0].aiCtl), null);
  assert.equal(laneHold(F[0].aiCtl), false);
  // 발: 동료가 오른쪽이면 왼쪽으로 (side −)
  const G = [fake(0, 0, 0, 0, 0), fake(1, 1, 4, 0, Math.PI), fake(2, 0, 1.2, 0.2, 0)];
  board(G, [1, 0, 1]);
  const [, side] = senseFeet(G[0].aiCtl, 0, 0);
  assert.ok(side < 0);
  // 동료가 상대 뒤(나보다 멀리)면 줄 위가 아님
  const H = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 3, 0.1, Math.PI)];
  board(H, [1, 0, 1]);
  assert.equal(laneMate(H[0].aiCtl), null);
});

test('④ 협공 자리: 동료가 붙은 상대 — 각이 바탕 목표(60°)보다 작으면 동료에게서 멀어지는 쪽으로 돎', () => {
  // 상대 X(1) 가 원점 · 동료 B(2) 가 X 에서 −x 1.5 m (X 가 B 를 겨눔) · 나(0)는 X 에서 −x 로 3 m, z +0.3 (각 ≈ 6°)
  const F = [fake(0, 0, -3, 0.3, 0), fake(1, 1, 0, 0, Math.PI), fake(2, 0, -1.5, 0, 0)];
  board(F, [1, 2, 1]);
  const [, side] = senseFeet(F[0].aiCtl, 0, 0);
  // 나는 +x 를 봄(heading 0) · 오른쪽 = +z. B 는 X 에서 −x · 나는 −x 조금 +z → B 에게서 멀어지는 X 둘레 쪽 = +z = 오른쪽
  assert.ok(side > 0, `side ${side}`);
  // 각이 이미 넉넉하면(90°) 안 돎
  const G = [fake(0, 0, 0, -2, Math.PI / 2), fake(1, 1, 0, 0, Math.PI), fake(2, 0, -1.5, 0, 0)];
  board(G, [1, 2, 1]);
  assert.deepEqual(senseFeet(G[0].aiCtl, 0, 0), [0, 0]);
});

test('④ 열세 셈: 내 동료와 붙은 적은 뺌 (눈에 보일 때) · 아니면 셈', () => {
  // 나(0) +x 봄 · 적 1 앞 2 m(나를 겨눔) · 적 3 이 동료 2 와 붙음(오른쪽 앞)
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0), fake(3, 1, 2.6, 2.5, Math.PI)];
  board(F, [1, 0, 3, 2]);
  assert.equal(busyFoe(F[0].aiCtl, F[3]), true);
  assert.equal(busyFoe(F[0].aiCtl, F[1]), false);
  // 동료와 멀어지면(칼끝 + 0.5 밖) 붙음 아님
  const G = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, -2, 3.5, 0), fake(3, 1, 2.6, 2.5, Math.PI)];
  board(G, [1, 0, 3, 2]);
  assert.equal(busyFoe(G[0].aiCtl, G[3]), false);
});

test('⑤ 셋 따로(편 0 · 1 · 2): 남의 편 몸은 동료로 안 읽음 · 제삼자와 붙은 적은 열세 셈에서 뺌 · 새 셈은 난수를 부르지 않음', () => {
  // 셋이 저마다 편 · 2 가 무릎 · 1 이 2 를 겨눔 — 0 에게 2 는 동료가 아님 → 엄호 덧셈 없음
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 2, 1.2, 0.2, 0, { state: 'kneel' })];
  const M = board(F, [1, 2, 1]);
  noRandom(() => {
    assert.equal(senseScore(M, F[0], F[1]), 0);
    assert.equal(laneMate(F[0].aiCtl), null, '남의 편 몸은 칼길 동료가 아님');
    assert.equal(busyWithOther(M.sense, M.sense.frames.at(-1), 0, 1), false, '무릎 꿇은 몸과는 붙음으로 안 셈');
    assert.equal(busyFoe(F[0].aiCtl, F[1]), false);
    senseFeet(F[0].aiCtl, 0, 0);
    recordSense(Object.assign(M, { t: 1 }));
  });
  // 1 이 서 있는 2 와 붙음 → 0 에게 1 은 '남과 붙은 적' (열세 셈에서 뺌 · 숙련 4 면 옆 기습 빈틈)
  const E = [fake(0, 0, 0, 0, 0, { prof: 4 }), fake(1, 1, 2, 0, Math.PI / 2), fake(2, 2, 2, -1.2, -Math.PI / 2)];
  const ME = board(E, [1, 2, 1]);
  noRandom(() => {
    assert.equal(busyWithOther(ME.sense, ME.sense.frames.at(-1), 0, 1), true);
    assert.equal(busyFoe(E[0].aiCtl, E[1]), true);
    assert.equal(ambushOpp(E[0].aiCtl)?.kind, 'ambush');
  });
  // 실제 판: 2:2 몇 스텝 동안 새 셈만 부른 난수 0 (판 사본 적기 · 상대 고르기 덧셈 · 발)
  const G = newMatch({ count: 4, ai: 'all', seed: 2 });
  for (let i = 0; i < 12; i++) G.step();
  noRandom(() => {
    recordSense(Object.assign(G, { t: G.t + 1 }));
    for (const f of G.fighters) {
      for (const g of G.fighters) if (g.team !== f.team) senseScore(G, f, g), senseHold(G, f, g);
      laneMate(f.aiCtl);
      senseFeet(f.aiCtl, 0.3, 0);
    }
  });
});

test('⑥ P2 노릴 상대 (가운데 몫 k): 동료와 붙어 옆을 보인 적 · 다친 적 · 지친 적 · 몰아침 · 붙잡혀 있으면 없음 · 바탕은 없음', () => {
  // 나(0, 숙련 5)는 원점에서 +x · 지금 상대 1 은 +x 3 m 에서 동료 2 를 겨눔(붙음 — 2 는 1 에서 −z 1.2 m) → 1 은 −z 를 봄 · 나는 1 의 옆
  const mk = (prof) => [fake(0, 0, 0, 0, 0, { prof }), fake(1, 1, 3, 0, Math.PI / 2), fake(2, 0, 3, -1.2, -Math.PI / 2), fake(3, 1, -3, 0, 0)];
  const F = mk(5);
  const M = board(F, [3, 2, 1, 0]); // 나는 3 을 겨눔(3 이 나를 겨눔 — 멀어서 안 붙음)
  assert.equal(senseScore(M, F[0], F[1]), -TS.opp.side, '옆을 보인 붙은 적 − side × 1');
  const F4 = mk(4);
  const M4 = board(F4, [3, 2, 1, 0]);
  assert.ok(Math.abs(senseScore(M4, F4[0], F4[1]) + TS.opp.side * (2 / 3)) < 1e-9, '숙련 4 = ⅔');
  const F2 = mk(2);
  const M2 = board(F2, [3, 2, 1, 0]);
  assert.equal(senseScore(M2, F2[0], F2[1]), 0, '바탕은 없음');
  // 그 적이 나를 보고 있으면(앞 ± 60° 안) 옆 덧셈 없음
  const G = [fake(0, 0, 0, 0, 0, { prof: 5 }), fake(1, 1, 3, 0, Math.PI), fake(2, 0, 3.8, -0.9, Math.PI), fake(3, 1, -3, 0, 0)];
  const MG = board(G, [3, 2, 1, 0]);
  assert.equal(senseScore(MG, G[0], G[1]), 0);
  // 다친 적 · 지친 적
  const H = [fake(0, 0, 0, 0, 0, { prof: 5 }), fake(1, 1, 3, 0, Math.PI, { blood: 0.7 }), fake(2, 0, -2, 4, 0), fake(3, 1, -3, 0, 0)];
  H[1].stamina.level = 1;
  const MH = board(H, [3, 0, 3, 0]);
  const wd = (1 - 0.7) / (1 - CONFIG.VITALS.collapseBlood);
  assert.ok(Math.abs(senseScore(MH, H[0], H[1]) - (-TS.opp.wound * Math.min(1, wd) - TS.opp.tired)) < 1e-9);
  // 붙잡혀 있으면(지금 상대 3 이 나를 겨눠 붙음) 다른 적 덧셈 없음 · 지금 상대는 그대로
  const P = [fake(0, 0, 0, 0, 0, { prof: 5 }), fake(1, 1, 3, 0, Math.PI / 2, { blood: 0.7 }), fake(2, 0, 3, -1.2, -Math.PI / 2), fake(3, 1, -1.5, 0, 0)];
  const MP = board(P, [3, 2, 1, 0]);
  assert.equal(senseScore(MP, P[0], P[1]), 0);
  // 몰아침: 피 focus 밑 적은 나눠 맡기 덧셈을 거둠 (동료 2 가 그 적을 겨눔)
  const Q = [fake(0, 0, 0, 0, 0, { prof: 5 }), fake(1, 1, 3, 0, Math.PI, { blood: TS.opp.focus - 0.05 }), fake(2, 0, -2, 4, 0), fake(3, 1, -3, 0, 0)];
  const MQ = board(Q, [3, 0, 1, 0]);
  const wq = Math.min(1, (1 - Q[1].blood) / (1 - CONFIG.VITALS.collapseBlood));
  assert.ok(Math.abs(senseScore(MQ, Q[0], Q[1]) - (-TS.opp.wound * wq - CONFIG.TEAM_FIGHT.target.allyAdd)) < 1e-9);
});

test('⑥ P2 협공 각 · 옆 기습 빈틈 (가운데만 — 바탕 없음) · 끼어듦', () => {
  assert.deepEqual([3, 4, 5].map((p) => Math.round(pincerGoal(tierOfProf(p)))), [80, 100, 120]);
  // 겨눈 상대 1 이 동료 2 와 붙음 · 나는 1 의 옆(앞 밖)
  const mk = (prof) => [fake(0, 0, 0, 0, 0, { prof }), fake(1, 1, 2, 0, Math.PI / 2), fake(2, 0, 2, -1.2, -Math.PI / 2)];
  const F = mk(4);
  board(F, [1, 2, 1]);
  const A = noRandom(() => ambushOpp(F[0].aiCtl));
  assert.equal(A.kind, 'ambush');
  assert.ok(Math.abs(A.v - TS.ambush.mid * (2 / 3)) < 1e-9);
  const B = mk(2);
  board(B, [1, 2, 1]);
  assert.equal(ambushOpp(B[0].aiCtl), null, '바탕은 기습 없음');
  // 내가 그 적 앞이면 없음
  const C = [fake(0, 0, 0, 0, 0, { prof: 4 }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 2.6, -1.2, Math.PI)];
  board(C, [1, 2, 1]);
  assert.equal(ambushOpp(C[0].aiCtl), null);
  // 끼어듦: 겨눈 상대 1 이 무릎 꿇은 동료 2 를 겨눔 — 1 을 축으로 2 쪽으로 돎 (2 는 1 에서 +z · 나는 1 에서 −x → 2 쪽 = 내 오른쪽(+z))
  const D = [fake(0, 0, -1, 0, 0, { prof: 5 }), fake(1, 1, 1.5, 0, -Math.PI / 2), fake(2, 0, 1.5, 1.5, Math.PI / 2, { state: 'kneel' })];
  board(D, [1, 2, 1]);
  const [, side] = senseFeet(D[0].aiCtl, 0, 0);
  assert.ok(side > 0, `side ${side}`);
  assert.equal(D[0].aiCtl.stats.team.interpose, 1);
});

/** 판 사본에 장을 하나 더 (몸 상태를 바꾼 뒤) */
const tick = (M, t) => recordSense(Object.assign(M, { t }));

test('⑦ P3 내다봄 · 엄호 미리 · 지고 있는 동료의 적 먼저 (6 만)', () => {
  // 동료 2 의 피가 0.95 → 0.85 로 빠르게 떨어짐 (아직 0.75 위) · 적 3 이 2 를 겨눔 · 나(0)는 6 · 5
  const mk = (prof) => [fake(0, 0, 0, 0, 0, { prof }), fake(1, 1, 3, 0, Math.PI), fake(2, 0, 1.5, 2.5, 0, { blood: 0.95 }), fake(3, 1, 2.6, 2.5, Math.PI)];
  for (const prof of [6, 5]) {
    const F = mk(prof);
    const M = board(F, [1, 0, 3, 2]);
    for (let t = 0.05; t <= 0.6 + 1e-9; t += 0.05) {
      F[2].blood = 0.95 - (0.1 * t) / 0.6;
      tick(M, t);
    }
    const fr = M.sense.frames.at(-1);
    const ahead = bloodAhead(M.sense, fr, 2, TS.eye.top.ahead);
    assert.ok(ahead < TS.cover.blood, `내다본 피 ${ahead}`);
    const s = senseScore(M, F[0], F[3]);
    if (prof === 6) assert.ok(s <= -TS.cover.sub - TS.two.sub + 1e-9, `6: 미리 엄호 + 지고 있는 동료의 적 ${s}`);
    else assert.ok(s > -TS.cover.sub, `5: 아직 엄호 아님 ${s}`);
  }
});

test('⑦ P3 칼 내는 순간 기습: 6 은 기다리다(− hold) 그 적이 동료에게 칼을 내면 + top · 기다림이 지나면 + mid · 이미 칼끝 안이면 곧장', () => {
  const near = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 2, 0, Math.PI / 2), fake(2, 0, 2, -1.2, -Math.PI / 2)];
  board(near, [1, 2, 1]);
  assert.deepEqual(noRandom(() => ambushOpp(near[0].aiCtl)), { v: TS.ambush.top, kind: 'ambush' }, '칼끝 + shot.near 안 — 기다림 없이');
  const F = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 2.6, 0, Math.PI / 2), fake(2, 0, 2.6, -1.2, -Math.PI / 2)];
  const M = board(F, [1, 2, 1]);
  const ai = F[0].aiCtl;
  ai.sense.t = 10;
  let A = noRandom(() => ambushOpp(ai));
  assert.equal(A.kind, undefined);
  assert.equal(A.hold, TS.ambush.hold);
  F[1].aiCtl.mode = 'attack';
  tick(M, 1);
  tick(M, 2);
  A = ambushOpp(ai);
  assert.deepEqual([A.kind, A.v], ['ambush', TS.ambush.top]);
  F[1].aiCtl.mode = 'watch';
  tick(M, 3);
  tick(M, 4);
  ai.sense.t = 10 + TS.ambush.wait + 0.01;
  A = ambushOpp(ai);
  assert.deepEqual([A.kind, A.v], ['ambush', TS.ambush.mid]);
  assert.ok(ai.stats.team.ambushWait >= 1 && ai.stats.team.ambushStrike === 1);
});

test('⑦ P3 방패: 지금 상대 뒤로 다른 적이 한 줄이면 몰아침 (6 만) · 남과 붙은 적은 아님', () => {
  const mk = (prof, yFoe) => [fake(0, 0, 0, 0, 0, { prof }), fake(1, 1, 2, 0, Math.PI), fake(2, 1, 3.5, 0.3, Math.PI), fake(3, 0, -3, 3, 0)];
  const F = mk(6);
  board(F, [1, 0, 0, 1]);
  assert.deepEqual(shieldOpp(F[0].aiCtl), { v: TS.shield.add, kind: 'press' });
  const G = mk(5);
  board(G, [1, 0, 0, 1]);
  assert.equal(shieldOpp(G[0].aiCtl), null);
  // 뒤 적 2 가 동료 3 과 붙음 → 방패 아님
  const H = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 2, 0, Math.PI), fake(2, 1, 3.5, 0.3, Math.PI), fake(3, 0, 4.5, 1.2, Math.PI)];
  board(H, [1, 0, 3, 2]);
  assert.equal(shieldOpp(H[0].aiCtl), null);
});

test('⑦ P3 이끌기: 6 이 물러날 때 비어 있는 동료 쪽으로 기울임', () => {
  // 나(0) +x 봄 · 상대 1 앞 · 동료 2 는 내 오른쪽(+z) 뒤쪽에 비어 있음
  const F = [fake(0, 0, 0, 0, 0, { prof: 6, mode: 'withdraw' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, -1.5, 2, 0)];
  board(F, [1, 0, 1]);
  const [, side] = senseFeet(F[0].aiCtl, -0.8, 0);
  assert.ok(side > 0, `side ${side}`);
  assert.equal(F[0].aiCtl.stats.team.lure, 1);
  const G = [fake(0, 0, 0, 0, 0, { prof: 5, mode: 'withdraw' }), fake(1, 1, 2, 0, Math.PI), fake(2, 0, -1.5, 2, 0)];
  board(G, [1, 0, 1]);
  assert.deepEqual(senseFeet(G[0].aiCtl, -0.8, 0), [-0.8, 0], '5 는 이끌기 없음');
});

test('⑦ P3 역할: 6 → AI 동료 묶기 · 이어 치기 (사람 동료 · 5 는 없음) · 받은 몸의 점수', () => {
  // 묶기: 6(0) 의 상대 1 이 동료 2(AI) 와 붙음 → 2 에게 pin(1)
  const F = [fake(0, 0, -1.2, 0, 0, { prof: 6 }), fake(1, 1, 1, 0, -Math.PI / 2), fake(2, 0, 1, -1.2, Math.PI / 2, { prof: 5 }), fake(3, 1, -5, 4, 0)];
  const M = board(F, [1, 2, 1, 2]);
  const R = M.sense.roles.get(F[2]);
  assert.deepEqual([R.role, R.x, R.by], ['pin', 1, 0]);
  assert.equal(M.sense.roleN.pin, 1);
  assert.ok(senseScore(M, F[2], F[1]) <= -TS.role.pin + 1e-9);
  // 묶기 받은 몸은 집게로 돌지 않음 (6 이 등으로 돎)
  senseFeet(F[2].aiCtl, 0, 0);
  assert.equal(F[2].aiCtl.stats.team?.pincer ?? 0, 0);
  M.sense.roles.clear(); // 역할이 없으면 (숙련 5 — 목표 120° · 지금 90°) 집게로 돎
  senseFeet(F[2].aiCtl, 0, 0);
  assert.equal(F[2].aiCtl.stats.team.pincer, 1);
  // 이어 치기: 6(0) 이 상대 1 에게 붙잡힘 · 동료 2(AI) 는 비어 있음 → 2 에게 follow(1)
  const G = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -2, 3, 0), fake(3, 1, -6, 5, 0)];
  const MG = board(G, [1, 0, 3, 2]);
  assert.equal(MG.sense.roles.get(G[2])?.role, 'follow');
  assert.ok(senseScore(MG, G[2], G[1]) <= -TS.role.follow + 1e-9);
  // 사람 동료 · 5 는 역할 없음
  const H = [fake(0, 0, 0, 0, 0, { prof: 6 }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -2, 3, 0, { ai: false }), fake(3, 1, -6, 5, 0)];
  const MH = board(H, [1, 0, 3, 2]);
  assert.equal(MH.sense.roles.size, 0);
  const K = [fake(0, 0, 0, 0, 0, { prof: 5 }), fake(1, 1, 1.5, 0, Math.PI), fake(2, 0, -2, 3, 0), fake(3, 1, -6, 5, 0)];
  const MK = board(K, [1, 0, 3, 2]);
  assert.equal(MK.sense.roles.size, 0);
  noRandom(() => assignRoles(MG));
  // 둘 다 6: 앞 자리 6 이 지휘 — 뒤 자리 6 은 묶기를 받고 주지 않음 (서로 묶기 없음)
  const W = [fake(0, 0, -1.2, 0, 0, { prof: 6 }), fake(1, 1, 1, 0, -Math.PI / 2), fake(2, 0, 1, -1.2, Math.PI / 2, { prof: 6 }), fake(3, 1, -5, 4, 0)];
  const MW = board(W, [1, 2, 1, 2]);
  assert.equal(MW.sense.roles.get(W[2])?.role, 'pin');
  assert.equal(MW.sense.roles.get(W[0]), undefined);
});

test('⑦ P3 등 뒤 알림: 나를 겨눈 AI 가 공격 꼴 · 칼끝 안 · 등 뒤일 때만', () => {
  const H = fake(0, 0, 0, 0, 0, { ai: false });
  const g = fake(1, 1, -1.5, 0.2, 0, { mode: 'attack' });
  H.teamSense = g.teamSense = {};
  g.foe = H;
  assert.equal(backThreat(H, g), true);
  g.aiCtl.mode = 'watch';
  assert.equal(backThreat(H, g), false, '공격 꼴 아님');
  g.aiCtl.mode = 'attack';
  g.bodies.chest.translation = () => ({ x: 1.5, y: 1.3, z: 0.2 });
  assert.equal(backThreat(H, g), false, '앞');
  g.bodies.chest.translation = () => ({ x: -3.5, y: 1.3, z: 0 });
  assert.equal(backThreat(H, g), false, '칼끝 밖');
  g.bodies.chest.translation = () => ({ x: -1.5, y: 1.3, z: 0.2 });
  g.foe = null;
  assert.equal(backThreat(H, g), false, '나를 안 겨눔');
  g.foe = H;
  delete H.teamSense;
  assert.equal(backThreat(H, g), false, '1:1 (판 사본 없음)');
});

test('⑦ P3 등 뒤 알림 화면: 나를 등 뒤에서 칠 참인 AI 의 화면 밖 화살표만 붉게 깜빡 (글 · 소리 없음)', () => {
  // 가짜 문서 (team_hud.js 가 쓰는 것만)
  const el = () => {
    const e = { style: {}, dataset: {}, children: [], classList: { toggle() {} }, setAttribute() {}, getBoundingClientRect: () => ({ height: 0 }) };
    e.append = (...c) => e.children.push(...c);
    e.appendChild = (c) => e.children.push(c);
    e.replaceChildren = () => (e.children = []);
    Object.defineProperty(e, 'childElementCount', { get: () => e.children.length });
    return e;
  };
  const doc = { createElement: el, body: el() };
  const hud = createTeamHud(doc);
  const body = (f, x, z) => { f.bodies.head = { translation: () => ({ x, y: 1.7, z }) }; f.shortName = `f${f.index}`; f.name = f.shortName; return f; };
  // 나(0 — 사람) 원점 +x 봄 · 적 1 이 등 뒤 1.2 m 에서 나를 겨눠 공격 꼴 · 적 3 은 등 뒤에 있으나 간 보기 · 동료 2 는 앞
  const H = body(fake(0, 0, 0, 0, 0, { ai: false }), 0, 0);
  const A = body(fake(1, 1, -1.2, 0.3, 0, { mode: 'attack' }), -1.2, 0.3);
  const M2 = body(fake(2, 0, 2, 1, 0), 2, 1);
  const B = body(fake(3, 1, -1.5, -1, 0, { mode: 'watch' }), -1.5, -1);
  const F = [H, A, M2, B];
  F.forEach((f) => (f.teamSense = {}));
  A.foe = H;
  B.foe = H;
  hud.show(F);
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100);
  cam.position.set(0, 1.6, 0);
  cam.lookAt(5, 1.6, 0);
  cam.updateMatrixWorld();
  const arrows = hud.root.children[0].children;
  const blinkOn = 0; // now = 0 ms → 깜빡임 켠 박자
  const blinkOff = 1000 / (2 * TS.back.blink) + 1; // 꺼진 박자
  hud.update(cam, H, true, H, 1280, 720, blinkOn);
  assert.equal(arrows[1].dataset.warn, '1');
  assert.equal(arrows[1].style.borderBottomColor, TS.back.color);
  assert.match(arrows[1].style.transform, /scale\(1\.3\)/);
  assert.equal(arrows[3].dataset.warn, '', '공격 꼴이 아닌 적은 알림 없음');
  assert.equal(arrows[3].style.borderBottomColor, TEAM_COLORS[1]);
  hud.update(cam, H, true, H, 1280, 720, blinkOff);
  assert.equal(arrows[1].style.borderBottomColor, TEAM_COLORS[1], '꺼진 박자 = 제 편 색');
  // 지켜보기(사람 몸 없음)면 알림 없음
  hud.update(cam, H, true, null, 1280, 720, blinkOn);
  assert.equal(arrows[1].dataset.warn, '');
  assert.equal(doc.body.children.length, 1, '글 칸 · 소리 없음 — 화면 덧칸은 그 전 하나(teamHud) 그대로');
});

test('④ 사냥할 때: 겨눈 상대가 동료와 붙었고 나를 붙잡은 적 없음 (바탕부터 — 기다리는 꼴을 안 기다림)', () => {
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI / 2), fake(2, 0, 2, -1.2, -Math.PI / 2), fake(3, 1, -5, 4, 0)];
  board(F, [1, 2, 1, 2]);
  assert.equal(noRandom(() => huntFree(F[0].aiCtl)), true);
  // 다른 적 3 이 나를 붙잡음 → 아님
  const G = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI / 2), fake(2, 0, 2, -1.2, -Math.PI / 2), fake(3, 1, 1.2, 0.8, 0)];
  board(G, [1, 2, 1, 0]);
  assert.equal(huntFree(G[0].aiCtl), false);
  // 겨눈 상대가 나를 겨눔 → 아님
  const H = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 0, 2, -1.2, -Math.PI / 2), fake(3, 1, -5, 4, 0)];
  board(H, [1, 0, 1, 2]);
  assert.equal(huntFree(H[0].aiCtl), false);
});

test('⑦ P3 틈 베기: 6 은 붙잡혀 있어도 내 칼끝 안의 등 보인 남과 붙은 적으로 잠깐 돎 (지금 상대가 치는 중이면 아님 · 5 는 없음)', () => {
  // 나(0)는 상대 3 에게 붙잡힘(3 이 나를 겨눔 1.5 m) · 적 1 은 동료 2 와 붙어 내게 등(1 은 +z 를 봄 · 나는 1 의 −x 쪽 1.6 m)
  const mk = (prof) => [fake(0, 0, 0, 0, 0, { prof }), fake(1, 1, 1.6, 0, -Math.PI / 2), fake(2, 0, 1.6, 1.2, Math.PI / 2), fake(3, 1, -1.5, 0, 0)];
  const F = mk(6);
  const M = board(F, [3, 2, 1, 0]);
  const s6 = senseScore(M, F[0], F[1]);
  assert.ok(s6 <= -TS.shot.sub - TS.opp.side + 1e-9, `6 ${s6}`);
  assert.equal(senseHold(M, F[0], F[1]), TS.shot.hold);
  const G = mk(5);
  const MG = board(G, [3, 2, 1, 0]);
  assert.equal(senseScore(MG, G[0], G[1]), 0, '5: 붙잡혀 있으면 없음');
  // 지금 상대 3 이 나를 치는 중이면 없음
  const H = mk(6);
  H[3].aiCtl.mode = 'attack';
  const MH = board(H, [3, 2, 1, 0]);
  assert.equal(senseScore(MH, H[0], H[1]), 0);
});
