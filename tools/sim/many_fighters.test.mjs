// 한 판 넷 제한 걷음 (11/20 — 사장님 '이딴 규칙은 없애' · 기록 docs/strike/many_fighters_2026-11-20.md · src/self_contact.js):
//  ① 자리 번호 제한 없음 (자리 7 · 여덟 판이 선다 · 음수 · 정수 아님은 그대로 막음) · 짝 열쇠(pairKey)가 자리 수와 상관없이 서로 다름
//  ② 3:3 이 돈다 (NaN · 예외 없음 · 상처가 남 · 편 전멸로 끝나거나 시간까지)
//  ③ 제 몸끼리는 접촉이 없다 (엔진이 푼 접점 — 제 칼 · 칼팔 ↔ 제 몸통만 남음) · 같은 편 · 상대 편 몸은 맞닿는다 (같은 편도 적과 똑같이 — 사장님 10/29 22:3x)
//  ④ 물리 스텝은 걸이와 함께여야 한다 — 걸이 없이 돌리면 제 몸이 맞닿는다(이 방식의 약속) · 전투 없는 도구용 selfHooks 는 제 몸만 버림
//  ⑤ 칼 잔상 칸이 판의 싸움꾼 수만큼 늘어남 (sword_trail.js)
//  node --test tools/sim/many_fighters.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, RAPIER, THREE, DT } from './jelly_harness.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { pairKey } from '../../src/team.js';
import { pairAllowed, selfHooks, SELF } from '../../src/self_contact.js';
import { createSwordTrails } from '../../src/sword_trail.js';

const W6 = ['longsword', 'kriegsmesser', 'rapier', 'uchigatana', 'hwando', 'zweihander']; // 다섯 유파 대표 무기 (estoc · sabre 쓰지 않음)
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const finite = (f) => [f.bodies.chest.translation(), f.bodies.pelvis.translation(), f.sword.translation()].every((t) => Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z));
/** 싸움꾼의 몸 · 칼 콜라이더 [부위, 콜라이더] (칼은 부품마다) */
const colsOf = (f) => [...Object.entries(f.bodies).map(([k, rb]) => [k, rb.collider(0)]), ...f.swordColliders.map((c) => ['weapon', c])];
/** 두 콜라이더 사이 엔진이 푼 접점 수 */
function contacts(world, a, b) {
  let n = 0;
  world.contactPair(a, b, (m) => { n += m.numContacts(); });
  return n;
}
/** 제 몸 쌍마다 접점 수를 더함 — 걸이가 허락하지 않는 쌍(bad) · 허락하는 쌍(ok: 제 칼 · 칼팔 ↔ 제 몸통) */
function ownContacts(world, info, F) {
  const out = { bad: 0, ok: 0, badPairs: [] };
  for (const f of F) {
    const C = colsOf(f);
    for (let x = 0; x < C.length; x++) for (let y = x + 1; y < C.length; y++) {
      const [pa, ca] = C[x], [pb, cb] = C[y];
      if (pa === 'weapon' && pb === 'weapon') continue; // 같은 칼 강체 — 엔진이 보지 않음
      const n = contacts(world, ca, cb);
      if (!n) continue;
      if (pairAllowed(info.get(ca.handle), info.get(cb.handle))) out.ok += n;
      else { out.bad += n; out.badPairs.push(`${f.name} ${pa}↔${pb}`); }
    }
  }
  return out;
}
/** 두 싸움꾼 사이 접점 수 (몸 ↔ 몸 · withWeapon 이면 칼 ↔ 몸 · 칼 ↔ 칼도) */
function bodyContacts(world, a, b, withWeapon = false) {
  let n = 0;
  for (const [pa, ca] of colsOf(a)) for (const [pb, cb] of colsOf(b)) if ((withWeapon || (pa !== 'weapon' && pb !== 'weapon')) && !pa.startsWith('foot') && !pb.startsWith('foot')) n += contacts(world, ca, cb);
  return n;
}

test('① 자리 번호 제한 없음 · 짝 열쇠가 서로 다름', () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const info = new Map();
  const f = new Fighter(RAPIER, world, new THREE.Scene(), info, { index: 7, name: 'F7', x: 0, heading: 0, look: LOOKS.enemy });
  assert.equal(f.index, 7);
  assert.equal(f.team, 1, '홀수 자리 = 1 편');
  for (const bad of [-1, 1.5, NaN, '2']) assert.throws(() => new Fighter(RAPIER, world, new THREE.Scene(), info, { index: bad, name: 'x', x: 3, heading: 0, look: LOOKS.enemy }));
  world.free();
  // 여덟 판이 서고 한 스텝 돈다
  seedRand(1);
  const G = newMatch({ count: 8, ai: 'all', seed: 1, weapons: [...W6, 'flamberge', 'qinggang'] });
  assert.deepEqual(G.fighters.map((g) => g.team), [0, 1, 0, 1, 0, 1, 0, 1]);
  for (let i = 0; i < 12; i++) G.step();
  assert.ok(G.fighters.every(finite));
  G.world.free();
  // 짝 열쇠: 차례 있는 짝마다 다름 (자리 0 ~ 39)
  const seen = new Set();
  for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) if (i !== j) seen.add(pairKey(i, j));
  assert.equal(seen.size, 40 * 39);
});

test('② 3:3 이 돈다 — NaN · 예외 없음 · 상처 · 모두 다른 편 상대를 겨눔', () => {
  seedRand(5);
  const G = newMatch({ count: 6, ai: 'all', seed: 5, walls: true, weapons: W6 });
  const F = G.fighters;
  assert.deepEqual(F.map((f) => f.team), [0, 1, 0, 1, 0, 1]);
  let wounds = 0;
  G.combat.hooks.onWound = () => { wounds++; };
  for (let i = 0; i < Math.round(12 / DT) && !G.over; i++) {
    G.step();
    if (i % 30 === 0) for (const f of F) {
      assert.ok(finite(f), `${f.name} NaN @ ${(i * DT).toFixed(2)} s`);
      if (f.alive && f.foe) assert.notEqual(f.foe.team, f.team, `${f.name} 의 상대가 같은 편`);
    }
  }
  assert.ok(wounds > 0, "12 s 동안 상처 0");
  assert.equal(F.filter((f) => f.foes?.length === 3).length, 6, '상대 편 셋씩 (f.foes)');
  G.world.free();
});

test('③ 제 몸끼리는 접점 없음 · 같은 편 · 상대 편 몸은 맞닿음 (3:3 · 붙여 세움)', () => {
  seedRand(2);
  // 편 사이 0.9 m · 같은 편 옆 0.35 m 로 붙여 세운다 — 첫 스텝부터 팔 · 칼 · 몸이 겹친다
  const G = newMatch({ count: 6, ai: "all", seed: 2, walls: true, gap: 0.9, mateGap: 0.35, weapons: W6 });
  const F = G.fighters, info = G.combat.info;
  let own = { bad: 0, ok: 0, badPairs: [] }, mate = 0, foe = 0;
  for (let i = 0; i < 240; i++) {
    G.step();
    const o = ownContacts(G.world, info, F);
    own.bad += o.bad; own.ok += o.ok; own.badPairs.push(...o.badPairs);
    if (i % 4) continue;
    for (const a of F) for (const b of F) if (a.index < b.index) { const n = bodyContacts(G.world, a, b, true); if (a.team === b.team) mate += n; else foe += n; }
  }
  assert.equal(own.bad, 0, `제 몸 접점: ${[...new Set(own.badPairs)].slice(0, 8).join(' · ')}`);
  assert.ok(mate > 0, '같은 편 몸이 맞닿지 않음 (같은 편도 적과 똑같이 부딪혀야)');
  assert.ok(foe > 0, '상대 편 몸이 맞닿지 않음');
  assert.ok(F.every(finite));
  G.world.free();
});

test('④ 걸이가 제 몸을 버린다 — 걸이 없이 돌면 제 몸이 맞닿음 · selfHooks 는 제 몸만 버림', () => {
  const run = (hooks) => {
    seedRand(3);
    const G = newMatch({ count: 2, seed: 3 });
    let bad = 0;
    for (let i = 0; i < 60; i++) {
      for (const f of G.fighters) f.step(DT);
      for (const f of G.fighters) f.cacheState();
      if (hooks === 'none') G.world.step(); // 큐도 걸이도 없이 (Rapier JS 는 큐 없이 부르면 걸이를 버린다 · 큐만 주면 걸이를 부르다 TypeError)
      else G.world.step(G.eventQueue, hooks === 'self' ? selfHooks(G.combat.info) : G.combat.physicsHooks);
      if (hooks === 'combat') G.combat.afterStep(G.world, G.eventQueue);
      bad += ownContacts(G.world, G.combat.info, G.fighters).bad;
    }
    G.world.free();
    return bad;
  };
  assert.ok(run('none') > 0, '걸이 없이도 제 몸이 안 닿음 — 그렇다면 이 시험의 전제(충돌 그룹에 싸움꾼 비트 없음)가 바뀐 것');
  assert.equal(run('self'), 0);
  assert.equal(run('combat'), 0);
  // pairAllowed 표: 제 몸통 ↔ 칼 · 칼팔만
  const me = {}, other = {};
  const I = (fighter, self) => ({ fighter, self });
  assert.ok(pairAllowed(I(me, SELF.torso), I(me, SELF.weapon)));
  assert.ok(pairAllowed(I(me, SELF.arm), I(me, SELF.torso)));
  for (const [a, b] of [[SELF.torso, SELF.torso], [SELF.arm, SELF.weapon], [SELF.arm, SELF.arm], [SELF.none, SELF.torso], [SELF.weapon, SELF.weapon], [SELF.none, SELF.weapon]]) assert.equal(pairAllowed(I(me, a), I(me, b)), false, `${a} ${b}`);
  for (const a of Object.values(SELF)) for (const b of Object.values(SELF)) assert.ok(pairAllowed(I(me, a), I(other, b)), '남과는 늘 (그다음은 충돌 그룹)');
  assert.ok(pairAllowed(I(me, SELF.none), undefined), '싸움꾼이 아닌 것(땅 · 벽)');
  assert.equal(GROUND_GROUPS, (1 << 16) | 0xffff);
  { // 큐만 주고 걸이를 안 주면 엔진이 걸이를 부르다 멈춘다 (크게 실패 — 조용히 제 몸이 맞닿지 않음). 그 세계는 빌린 채 남아 풀 수 없다(free 안 함)
    const G = newMatch({ count: 2, seed: 3 });
    assert.throws(() => G.world.step(G.eventQueue), TypeError);
  }
});

test('⑤ 칼 잔상 칸이 싸움꾼 수만큼', () => {
  const T = createSwordTrails(new THREE.Scene());
  assert.equal(T.slots, 2);
  const fake = (i) => ({ index: i, weapon: null });
  assert.equal(T.attach([fake(0), fake(1)]).length, 2);
  const h = T.attach(Array.from({ length: 6 }, (_, i) => fake(i)));
  assert.equal(h.length, 6);
  assert.equal(T.slots, 6);
  T.sample(DT);
  T.update();
  assert.equal(T.attach([fake(0), fake(1)]).length, 6, '줄이지 않음 (빈 칸은 그리지 않음)');
});
