// 동시 대전 1단계 배관 (10/29 — 사장님 14:2x 생사전 2:2 · docs/strike/team_fight_2026-10-29.md · src/team.js · src/match.js):
//  ① 1:1 의 충돌 비트가 예전 식(자리 0 · 1 = 몸 2 · 8, 칼 4 · 16, 발 64 · 128, 몸통 256 · 512, 칼팔 1024 · 2048) 그대로
//  ② 2:2 에서 같은 편끼리는 어떤 콜라이더도 엔진 거름(구성원 & 거름 양쪽)을 못 넘고, 상대 편끼리는 몸 ↔ 몸 · 칼 ↔ 몸 · 칼 ↔ 칼 · 칼 ↔ 발이 넘는다 · 날아간 투구 비트 32 와 안 겹침
//  ③ sameSide · pairOf 가 같은 편 쌍을 버림 · 칼 쌍 묶기(groupBlades)가 싸움꾼 짝마다 · 들어온 차례 · AI setFoe 가 눈 · 간격 어림을 맞바꾸고 시계가 같음
//  ④ 시작 자리: 1:1 은 newRound 자리 그대로 · 2:2 는 편마다 옆으로 mateGap
//  ⑤ ~ ⑧ (2단계): 상대 고르기 규칙(가짜 몸 — 거리 · 쓰러짐 · 나눠 맡기 · 나를 침 · 기다림 · 붙잡힘 · 죽음 · 취향) · 편 전멸 · 결과 · 상대를 아는 반응 시간 · 상대마다 몫 맞바꿈
//  node --test tools/sim/team_fight.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { sameSide, teamOfIndex } from '../../src/team.js';
import { spawnSpots, orderControllers, pairFoe, standing, matchResult } from '../../src/match.js';
import { chooseTarget, targetScore, committed } from '../../src/targeting.js';

const mem = (g) => g >>> 16;
const filt = (g) => g & 0xffff;
const meets = (a, b) => (mem(a) & filt(b)) !== 0 && (mem(b) & filt(a)) !== 0; // Rapier InteractionGroups.test
const bodyCols = (f) => Object.entries(f.bodies).map(([k, rb]) => [k, rb.collider(0)]);
const swordCols = (f) => f.swordColliders.map((c) => ['weapon', c]);

/** 예전(10/29 전) fighter.js 의 비트 식 — 자리 i 의 부위 이름 → 그룹 */
function legacyGroups(i, part) {
  const groups = (m, f) => (m << 16) | f;
  const bodyBit = (k) => (k === 0 ? 2 : 8), weaponBit = (k) => (k === 0 ? 4 : 16), footBit = (k) => (k === 0 ? 64 : 128);
  const torsoBit = (k) => (k === 0 ? 256 : 512), armSBit = (k) => (k === 0 ? 1024 : 2048);
  const myBody = bodyBit(i), otherBody = bodyBit(1 - i), otherWeapon = weaponBit(1 - i);
  const HL = CONFIG.BODY.humanLimits;
  if (part === 'weapon') return HL ? groups(weaponBit(i), 1 | otherBody | otherWeapon | footBit(1 - i) | torsoBit(i)) : groups(weaponBit(i), 1 | otherBody | otherWeapon | footBit(1 - i));
  if (part.startsWith('foot')) return groups(footBit(i), 1 | otherWeapon);
  if (HL && ['pelvis', 'abdomen', 'chest', 'thighF', 'thighB'].includes(part)) return groups(myBody | torsoBit(i), 1 | otherBody | otherWeapon | weaponBit(i) | armSBit(i));
  if (HL && (part === 'uarmS' || part === 'farmS')) return groups(myBody | armSBit(i), 1 | otherBody | otherWeapon | torsoBit(i));
  return groups(myBody, 1 | otherBody | otherWeapon);
}

test('① 1:1 충돌 비트 = 예전 식 그대로 (편 = 자리 번호)', () => {
  const G = newMatch({ seed: 1 });
  for (const f of G.fighters) {
    assert.equal(f.team, f.index);
    assert.equal(f.human, f.index === 0);
    for (const [part, c] of [...bodyCols(f), ...swordCols(f)]) assert.equal(c.collisionGroups(), legacyGroups(f.index, part), `${f.name} ${part}`);
  }
});

test('② 2:2 같은 편은 서로 지나가고 상대 편은 부딪힌다 · 16 비트 안 · 투구 비트 32 와 안 겹침', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 1 });
  const F = G.fighters;
  assert.deepEqual(F.map((f) => f.team), [0, 1, 0, 1]);
  const HELMET = (32 << 16) | 1; // fighter.js knockOffHelmet
  let mates = 0, foes = { bodyBody: 0, swordBody: 0, swordSword: 0, swordFoot: 0, footBody: 0 };
  for (const a of F) {
    for (const [, c] of [...bodyCols(a), ...swordCols(a)]) {
      const g = c.collisionGroups();
      assert.ok(mem(g) <= 0xffff && mem(g) !== 0);
      assert.equal(mem(g) & 32, 0, `${a.name}: 투구 비트`);
      assert.equal(meets(g, HELMET), false, `${a.name}: 날아간 투구와 부딪힘`);
    }
    for (const b of F) {
      if (b.index <= a.index) continue;
      for (const [pa, ca] of [...bodyCols(a), ...swordCols(a)]) for (const [pb, cb] of [...bodyCols(b), ...swordCols(b)]) {
        const hit = meets(ca.collisionGroups(), cb.collisionGroups());
        if (a.team === b.team) { assert.equal(hit, false, `같은 편 ${a.name}.${pa} ↔ ${b.name}.${pb}`); mates++; continue; }
        const ka = pa === 'weapon' ? 'sword' : pa.startsWith('foot') ? 'foot' : 'body';
        const kb = pb === 'weapon' ? 'sword' : pb.startsWith('foot') ? 'foot' : 'body';
        const k = [ka, kb].sort().join('');
        if (k === 'bodybody') { assert.ok(hit, `${a.name}.${pa} ↔ ${b.name}.${pb}`); foes.bodyBody++; }
        if (k === 'bodysword') { assert.ok(hit); foes.swordBody++; }
        if (k === 'swordsword') { assert.ok(hit); foes.swordSword++; }
        if (k === 'footsword') { assert.ok(hit); foes.swordFoot++; }
        if (k === 'bodyfoot') { assert.equal(hit, false); foes.footBody++; }
      }
    }
  }
  assert.ok(mates > 0 && Object.values(foes).every((n) => n > 0));
  // 자기 칼 ↔ 제 몸통 (BODY.humanLimits): 자리마다 따로 — 같은 편 몸통과는 안 부딪힌다
  if (CONFIG.BODY.humanLimits) for (const f of F) assert.ok(meets(f.swordColliders[0].collisionGroups(), f.bodies.chest.collider(0).collisionGroups()));
  // 상대 편 칼 비트 (mordschlag · revive 가 읽는다)
  for (const f of F) assert.equal(f.bits.foeWeapon, mem(F[f.index ^ 1].swordColliders[0].collisionGroups()));
});

test('③ sameSide · pairOf · 칼 쌍 묶기 · AI setFoe', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 2 });
  const [P, E, P2, E2] = G.fighters;
  assert.ok(sameSide(P, P2) && sameSide(E, E2) && sameSide(P, P) && !sameSide(P, E) && !sameSide(P2, E));
  assert.equal(sameSide(null, P), false);
  const fake = {};
  assert.ok(sameSide(fake, fake) && !sameSide(fake, {})); // 편 없는 가짜 몸: 같은 몸일 때만 (예전 a === b)
  const C = G.combat;
  assert.equal(C.pairOf(P.swordColliders[0].handle, P2.bodies.chest.collider(0).handle), null, '같은 편 칼 → 몸');
  assert.ok(C.pairOf(P.swordColliders[0].handle, E2.bodies.chest.collider(0).handle), '상대 편 칼 → 몸');
  const w = (f, k = 0) => f.swordColliders[k].handle;
  const groups = C.groupBlades([[w(P2), w(E2)], [w(P), w(E)], [w(P2, 1), w(E2)], [w(P, 1), w(E)]]);
  assert.deepEqual(groups.map((g) => g.key), [2 * 4 + 3, 0 * 4 + 1], '들어온 차례');
  assert.deepEqual(groups.map((g) => g.pairs.length), [2, 2]);
  assert.equal(groups[1].A.fighter, P);
  assert.equal(C.groupBlades([[w(P), w(E)], [w(P, 1), w(E)]]).length, 1, '1:1 은 한 짝');
  // AI: 판 시작에 상대 편 둘을 적고, 바꾸면 눈 · 간격 어림이 맞바뀐다 (시계 같음)
  const ai = G.ais[0];
  assert.equal(ai.foe, E);
  for (let i = 0; i < 30; i++) G.step();
  const sE = ai.sense;
  ai.foeReach = 9.5;
  ai.setFoe(E2);
  assert.equal(ai.foe, E2);
  assert.notEqual(ai.sense, sE);
  assert.equal(ai.sense.foe, E2);
  assert.equal(ai.sense.t, sE.t, '같은 시계');
  assert.notEqual(ai.foeReach, 9.5);
  ai.setFoe(E);
  assert.equal(ai.sense, sE);
  assert.equal(ai.foeReach, 9.5);
  ai.setFoe(E); // 같은 상대: 아무 일 없음
  assert.equal(ai.sense, sE);
  // 1:1 AI 는 기록이 없다 (예전 길 그대로)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  assert.equal(G1.ais[1].foeRecs, undefined);
  assert.equal(G1.ais[0].foeRecs, undefined);
});

test('④ 시작 자리 · 조종 차례 · 기본 상대', () => {
  const gap = CONFIG.ARENA.startGap;
  assert.deepEqual(spawnSpots(2, { gap, mateGap: 1 }).map(({ x, z, heading }) => [x, z, heading]), [[-gap / 2, 0, 0], [gap / 2, 0, Math.PI]]);
  const s4 = spawnSpots(4, { gap, mateGap: 1.6 });
  assert.deepEqual(s4.map((s) => s.team), [0, 1, 0, 1]);
  assert.deepEqual(s4.map((s) => s.z), [-0.8, -0.8, 0.8, 0.8]);
  const s3 = spawnSpots(3, { gap, mateGap: 1.6 });
  assert.deepEqual(s3.map((s) => s.z), [-0.8, 0, 0.8]);
  assert.deepEqual([0, 1, 2, 3].map(teamOfIndex), [0, 1, 0, 1]);
  const me = (index, team, human = false) => ({ me: { index, team, human } });
  assert.deepEqual(orderControllers([me(0, 0, true), me(1, 1)]).map((c) => c.me.index), [1, 0], '1:1 — 상대 AI 먼저 (fights12)');
  assert.deepEqual(orderControllers([me(0, 0, true), me(1, 1), me(2, 0), me(3, 1)]).map((c) => c.me.index), [1, 3, 2, 0], '1 편 → 0 편 → 사람 맨 뒤');
  const G = newMatch({ count: 4, ai: 'all', seed: 3 });
  const F = G.fighters;
  assert.deepEqual(F.map((f) => pairFoe(f, G).index), [1, 0, 3, 2]);
  assert.deepEqual(standing(G), [2, 2]);
  assert.equal(CONFIG.TEAM_FIGHT.mateGap > 0, true);
});

// ── 2단계 ──
/** 가짜 몸 (상대 고르기 규칙만 — 가슴 자리 · 편 · 상태 · 조종) */
function fake(index, team, x, z, extra = {}) {
  const p = { x, y: 1.3, z };
  return { index, team, alive: true, state: 'stand', revival: null, foe: null, pos: p, bodies: { chest: { translation: () => p } }, wounds: [], limbs: {}, blood: 1, ...extra };
}
const fakeMatch = (F) => ({ fighters: F });
const pick = (M, f, dt = 0) => (f.foe = chooseTarget(f, M, dt));

test('⑤ 상대 고르기: 가까움 · 같으면 작은 자리 · 쓰러짐 · 나눠 맡기 · 나를 침 · 기다림 · 붙잡힘 · 죽음 · 취향', () => {
  const T = CONFIG.TEAM_FIGHT.target;
  const me = fake(0, 0, 0, 0), e1 = fake(1, 1, 2, 0), e3 = fake(3, 1, 0, 2), mate = fake(2, 0, 0, -1);
  const M = fakeMatch([me, e1, mate, e3]);
  assert.equal(pick(M, me), e1, '같은 거리면 작은 자리');
  e3.pos.z = 1.9;
  assert.equal(targetScore(M, me, e3) < targetScore(M, me, e1), true);
  assert.equal(pick(M, me, 0.01), e1, '0.1 m 차 — margin 안이라 그대로');
  // 쓰러진 상대: 다른 상대가 downNear 안에 서 있으면 + downAdd
  e1.state = 'down';
  assert.equal(targetScore(M, me, e1), 2 + T.downAdd);
  e3.pos.z = 5; // 3 m 밖
  assert.equal(targetScore(M, me, e1), 2);
  e1.state = 'stand';
  // 나눠 맡기: 같은 편이 겨눈 상대 + allyAdd
  mate.foe = e1;
  assert.equal(targetScore(M, me, e1), 2 + T.allyAdd);
  mate.foe = null;
  // 기다림: 1.0 m 더 낮은 후보 — hold 동안 이어져야 바꿈
  e3.pos.z = 1.0;
  let t = 0;
  while (me.foe === e1 && t < 5) (t += 0.05), pick(M, me, 0.05);
  assert.equal(me.foe, e3);
  assert.ok(Math.abs(t - T.hold) <= 0.051, `hold ${t}`);
  // 붙잡힘(공격 꼴)이면 안 바꿈
  e1.pos.x = 0.5;
  me.aiCtl = { mode: 'attack' };
  assert.ok(committed(me));
  for (let i = 0; i < 100; i++) pick(M, me, 0.05);
  assert.equal(me.foe, e3, '붙잡힘 동안 그대로');
  // 죽으면 붙잡혀 있어도 곧장
  e3.alive = false;
  assert.equal(pick(M, me, 0.01), e1);
  me.aiCtl = null;
  e3.alive = true;
  e3.pos.z = 1.0;
  e1.pos.x = 2;
  // 나를 치는 상대: 기다림 없이 (− attackSub)
  pick(M, me, 0); // 지금 e1 · 후보 e3 (1.0 대 2.0 — margin 넘음, 기다리는 중)
  const st = M.targeting.get(me);
  e3.foe = me;
  e3.aiCtl = { mode: 'attack', M: { reach: 1.5 } };
  assert.equal(pick(M, me, 0.01), e3, '나를 치는 상대는 곧장');
  assert.equal(st.why.attacked, 1);
  // 취향 갈고리: weakest — 다친 상대에 덧셈 (− prefAdd × 다친 정도)
  const s0 = targetScore(M, me, e1);
  me.targetPref = 'weakest';
  e1.blood = 0.45; // VITALS.collapseBlood 까지 잃음 → 다친 정도 1
  assert.equal(+(s0 - targetScore(M, me, e1)).toFixed(6), T.prefAdd);
  me.targetPref = null;
});

test('⑥ 편 전멸 = 판 끝 · 결과 (자리마다 alive · blood · wounds · causeOfDeath)', () => {
  const G = newMatch({ count: 3, ai: 'all', seed: 4 });
  assert.equal(G.over, false);
  G.step();
  assert.equal(G.over, false);
  G.fighters[1].die('시험');
  G.step();
  assert.equal(G.over, true);
  assert.equal(G.winner, 0);
  const R = matchResult(G);
  assert.equal(R.over, true);
  assert.equal(R.fighters.length, 3);
  assert.deepEqual(R.fighters.map((r) => r.alive), [true, false, true]);
  assert.equal(R.fighters[1].causeOfDeath, '시험');
  for (const r of R.fighters) assert.ok(typeof r.blood === 'number' && Array.isArray(r.wounds) && 'causeOfDeath' in r);
  // 1:1 도 같은 규칙 (읽기만)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  G1.enemy.die('시험');
  G1.step();
  assert.equal(G1.over, true);
  assert.equal(G1.winner, 0);
});

test('⑦ 상대를 아는 반응 시간: 상대를 바꾸면 새 상대의 face s 전 자리부터 (옛 상대 쪽으로 안 돎)', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 5 });
  const [P, E, , E2] = G.fighters;
  for (let i = 0; i < 60; i++) G.step();
  assert.ok(P.foes.includes(E) && P.foes.includes(E2));
  P.foe = E2;
  const tg = P.reactTarget(1 / 120);
  const q = E2.bodies.pelvis.translation(), o = E.bodies.pelvis.translation();
  assert.ok(Math.hypot(tg.x - q.x, tg.z - q.z) < 0.3, '새 상대 자리 근처');
  assert.ok(Math.hypot(tg.x - o.x, tg.z - o.z) > 1.0, '옛 상대 자리 아님');
  // 1:1 은 예전 기록 (상대 목록 없음)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  assert.equal(G1.player.foes, undefined);
  assert.equal(G1.player.mates, undefined);
});

test('⑧ AI 상대마다 몫 맞바꿈 (위협 걸쇠 · 몰아침 · 고노센 경계) · 그 상대와만의 셈은 0', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 6 });
  const ai = G.ais[0];
  const [, E, , E2] = G.fighters;
  for (let i = 0; i < 30; i++) G.step();
  assert.equal(ai.foe, E);
  Object.assign(ai, { threatId: 5, threatSeen: 5, foeAggro: 0.7, preArmed: false, gnsW: { mark: 1 }, combo: 2 });
  ai.setFoe(E2);
  assert.deepEqual([ai.threatId, ai.threatSeen, ai.foeAggro, ai.preArmed, ai.gnsW, ai.combo], [0, -1, 0, true, undefined, 0]);
  ai.setFoe(E);
  assert.deepEqual([ai.threatId, ai.threatSeen, ai.foeAggro, ai.preArmed, ai.gnsW.mark, ai.combo], [5, 5, 0.7, false, 1, 0]);
});
