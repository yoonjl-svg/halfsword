// 무리 싸움 판단 (11/18 — 사장님 '다대다 전투에서 ai의 지능이 너무 무식하긴 해' · 설계 docs/design/team_sense_2026-11-18.md · src/team_sense.js):
//  ① 1:1 은 판 사본이 없다 (createMatch 가 셋 이상 판에만 M.sense · f.teamSense) · 2:2 · 셋 따로는 있고 한 장에 몸 N 칸
//  ② 층 가름 (본 유파 숙련도 — 바탕 0 ~ 2 · 가운데 3 ~ 5 몫 (p − 2) ÷ 3 · 위 6) · 눈(시야 · 늦음)
//  ③ 판 사본 사실: 늦은 장 고르기 · 붙음 · 시야 밖 몸은 안 보임 · 지금 겨눈 상대는 늘 보임
//  ④ 엄호 겨눔 (다친 동료를 겨눈 적 −) · 사람 몸은 덧셈 없음 · 칼길 비우기(동료가 칼 부채꼴 · 줄 위) · 열세 셈에서 동료와 붙은 적 뺌
//  ⑤ 편 수를 셈하지 않음 — 셋 따로(편 0 · 1 · 2)에서 남의 편 몸은 동료로 안 읽음 · 새 셈은 난수를 부르지 않음
//  node --test tools/sim/team_sense.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG, DT } from './jelly_harness.mjs';
import { createSense, recordSense, frameAt, tierOfProf, viewOf, senseScore, senseHold, laneMate, laneHold, busyFoe, outSkill, senseFeet, busyWithMate, pincerGoal } from '../../src/team_sense.js';
import { targetScore } from '../../src/targeting.js';

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

test('⑤ 셋 따로(편 0 · 1 · 2): 남의 편 몸은 동료로 안 읽음 · 새 셈은 난수를 부르지 않음', () => {
  // 셋이 저마다 편 · 2 가 무릎 · 1 이 2 를 겨눔 — 0 에게 2 는 동료가 아님 → 엄호 덧셈 없음
  const F = [fake(0, 0, 0, 0, 0), fake(1, 1, 2, 0, Math.PI), fake(2, 2, 1.2, 0.2, 0, { state: 'kneel' })];
  const M = board(F, [1, 2, 1]);
  noRandom(() => {
    assert.equal(senseScore(M, F[0], F[1]), 0);
    assert.equal(laneMate(F[0].aiCtl), null, '남의 편 몸은 칼길 동료가 아님');
    assert.equal(busyWithMate(M.sense, M.sense.frames.at(-1), 0, 1), false);
    assert.equal(busyFoe(F[0].aiCtl, F[1]), false);
    senseFeet(F[0].aiCtl, 0, 0);
    recordSense(Object.assign(M, { t: 1 }));
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
