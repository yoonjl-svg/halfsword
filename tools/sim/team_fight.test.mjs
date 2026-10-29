// 동시 대전 1단계 배관 (10/29 — 사장님 14:2x 생사전 2:2 · docs/strike/team_fight_2026-10-29.md · src/team.js · src/match.js):
//  ① 1:1 의 충돌 비트가 예전 식(자리 0 · 1 = 몸 2 · 8, 칼 4 · 16, 발 64 · 128, 몸통 256 · 512, 칼팔 1024 · 2048) 그대로
//  ② 2:2 에서 같은 편끼리는 어떤 콜라이더도 엔진 거름(구성원 & 거름 양쪽)을 못 넘고, 상대 편끼리는 몸 ↔ 몸 · 칼 ↔ 몸 · 칼 ↔ 칼 · 칼 ↔ 발이 넘는다 · 날아간 투구 비트 32 와 안 겹침
//  ③ sameSide · pairOf 가 같은 편 쌍을 버림 · 칼 쌍 묶기(groupBlades)가 싸움꾼 짝마다 · 들어온 차례 · AI setFoe 가 눈 · 간격 어림을 맞바꾸고 시계가 같음
//  ④ 시작 자리: 1:1 은 newRound 자리 그대로 · 2:2 는 편마다 옆으로 mateGap
//  node --test tools/sim/team_fight.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { sameSide, teamOfIndex } from '../../src/team.js';
import { spawnSpots, orderControllers, pairFoe, standing } from '../../src/match.js';

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
