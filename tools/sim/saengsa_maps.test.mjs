// 생사전 전용 맵 (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — src/field.js 지도 꼴 · src/saengsa_maps.js 무대 표 · src/field_route.js AI 길목 길 ·
//  설계 docs/design/saengsa_3v3_2026-11-21.md §3-1 · §3-3 · §5 · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//  ① 원 무대 지도 꼴은 옛 식과 바이트까지 같음 (1:1 관문 그대로) ② 표 → 막이 · 길목 · 시작 자리 · 거점 ③ 맵 뽑기 = 경기 씨앗 ④ AI 가 다리로 건넘
//  node --test tools/sim/saengsa_maps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAPIER, THREE, CONFIG, newMatch, DT } from './jelly_harness.mjs';
import { CIRCLE_FIELD, fieldOf } from '../../src/field.js';
import { SAENGSA_MAPS, SAENGSA_MAP_BY_ID, mapGeo, mapSpawnSpots, fieldForStage, fieldOfMap, pickSaengsaMap, mapOfMatch, isSaengsaStage, mapThumbSvg } from '../../src/saengsa_maps.js';
import { sweepParams } from '../../src/camera_rig.js';
import { STAGE_NAME_KO, STAGE_ORDER } from '../../src/stages.js';
import { hash32 } from '../../src/saengsa_rules.js';

const { ARENA } = CONFIG;
const realRandom = Math.random;
const seedRand = (t, seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  t.after(() => { Math.random = realRandom; });
};

test('원 무대 지도 꼴 = 옛 식 (radial · outward 나눗셈 · 띠 · 물러남 끝 · 카메라 10.5 m) — 바이트까지 같음', () => {
  const F = fieldOf({});
  assert.equal(F, CIRCLE_FIELD);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const o = {};
  for (let i = 0; i < 20000; i++) {
    const x = (r() - 0.5) * 24, z = (r() - 0.5) * 24, fx = r() - 0.5, fz = r() - 0.5;
    const rA = Math.hypot(x, z);
    assert.equal(F.radial(x, z), rA);
    F.outward(x, z, o);
    assert.equal(-(o.x * fx + o.z * fz) / o.len, -(x * fx + z * fz) / rA); // ai.js 울타리 띠 outBack 옛 식
    assert.equal(F.radial(x, z) > ARENA.radius - ARENA.aiWall, rA > ARENA.radius - ARENA.aiWall);
    assert.equal(ARENA.radius - F.radial(x, z), ARENA.radius - Math.hypot(x, z)); // secret_instant.js 물러남 끝
    const v = new THREE.Vector3(x, 2.3, z), w = v.clone();
    F.clampCamera(v, 2.7);
    const rr = Math.hypot(w.x, w.z);
    if (rr > 10.5) w.multiplyScalar(10.5 / rr).setY(2.7);
    assert.deepEqual([v.x, v.y, v.z], [w.x, w.y, w.z]);
  }
  for (const id of ['poseidon', 'courtyard', 'sluice', 'etna', null]) assert.equal(fieldForStage(id), CIRCLE_FIELD);
});

test('원 무대 경계 벽 = 옛 32 조각 그대로 (자리 · 돌림 · 반폭)', async () => {
  const W1 = new RAPIER.World({ x: 0, y: -9.81, z: 0 }), W2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  CIRCLE_FIELD.walls(RAPIER, W1, W1.createRigidBody(RAPIER.RigidBodyDesc.fixed()), 7);
  const b2 = W2.createRigidBody(RAPIER.RigidBodyDesc.fixed()), n = 32, R = ARENA.radius + 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, half = R * Math.tan(Math.PI / n) + 0.05, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    W2.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(7), b2);
  }
  const dump = (W) => { const out = []; W.forEachCollider((c) => out.push([c.translation(), c.rotation(), c.halfExtents(), c.collisionGroups()])); return JSON.stringify(out); };
  assert.equal(dump(W1), dump(W2));
  W1.free(); W2.free();
});

test('무대 표 → 두 다리 개울: 36 × 24 · 개울 4 m · 다리 z ∓ 7 (너비 2.6 · 길이 5.6) · 시작 x ∓ 14 · 거점 · 길목 점', () => {
  const m = SAENGSA_MAP_BY_ID.bridges, G = mapGeo(m), F = fieldOfMap('bridges');
  assert.deepEqual(m.size, [36, 24]);
  assert.deepEqual(G.half, { x: 18, z: 12 });
  assert.equal(G.blocks.length, 3);
  for (const b of G.blocks) assert.deepEqual([b.x0, b.x1], [-2, 2]);
  assert.deepEqual(G.lanes.map((l) => [l.z0, l.z1, l.x0, l.x1]), [[-8.3, -5.7, -2.8, 2.8], [5.7, 8.3, -2.8, 2.8]]);
  assert.deepEqual(G.points, [{ x: 0, z: -7, r: 1.3 }, { x: 0, z: 7, r: 1.3 }]);
  assert.deepEqual(G.chokes.map((c) => [c.x, c.z]), [[-3.4, -7], [3.4, -7], [-3.4, 7], [3.4, 7]]);
  assert.ok(Math.abs(Math.hypot(G.points[0].x - G.points[1].x, G.points[0].z - G.points[1].z) - 14) < 1e-9, '두 거점 사이 14 m');
  // 시작: 셋 −2.5 · 0 · +2.5 / 둘 ∓1.25 / 하나 0
  const spots = mapSpawnSpots(m, [0, 1, 0, 1, 0, 1]);
  assert.deepEqual(spots.map((s) => [s.x, s.z, s.team]), [[-14, -2.5, 0], [14, -2.5, 1], [-14, 0, 0], [14, 0, 1], [-14, 2.5, 0], [14, 2.5, 1]]);
  assert.deepEqual(mapSpawnSpots(m, [0, 1, 0, 1, 0]).filter((s) => s.team === 1).map((s) => s.z), [-1.25, 1.25]);
  assert.deepEqual(mapSpawnSpots(m, [0, 1]).map((s) => s.z), [0, 0]);
  // 막이 거리 · 안쪽 방향: 판 가운데 개울 둑 · 바깥 둔덕 · 다리 위(길목 — 막이 띠 없음)
  assert.equal(F.edgeDist(-14, 0), 4);
  assert.deepEqual(F.inward(-17.5, 0), { x: 1, z: 0 });
  assert.equal(F.edgeDist(0, 7), 5, '다리 위는 바깥 테두리만');
  assert.ok(F.radial(-2.5, 0) > ARENA.radius - ARENA.aiWall, '개울 둑 0.5 m = AI 띠 안');
  assert.ok(!(F.radial(-10, 0) > ARENA.radius - ARENA.aiWall));
  // 길: 시작 → 건너편 시작은 막힘 · 다리 머리 점을 거쳐 (곧은 거리 28 m · 길 31 m 남짓)
  assert.ok(F.segBlocked({ x: -14, z: 0 }, { x: 14, z: 0 }));
  assert.ok(!F.segBlocked({ x: -14, z: 0 }, { x: -3.4, z: 7 }));
  const r = F.route({ x: -14, z: 2.5 }, { x: 14, z: 2.5 });
  assert.equal(r.lane, 1);
  assert.deepEqual([r.way.x, r.way.z], [-3.4, 7]);
  assert.ok(r.len > 28 && r.len < 32, `${r.len}`);
  assert.deepEqual([F.route({ x: -1, z: 7 }, { x: 14, z: 2.5 }).way.x, F.route({ x: -1, z: 7 }, { x: 14, z: 2.5 }).way.z], [3.4, 7], '다리 위 → 저쪽 머리');
  assert.deepEqual([F.route({ x: 1.4, z: 5.9 }, { x: 0.7, z: -6.2 }).way.x, F.route({ x: 1.4, z: 5.9 }, { x: 0.7, z: -6.2 }).way.z], [3.4, 7], '다리 위에서 다른 다리 위 상대 — 난간 · 물을 뚫지 않음');
  assert.equal(F.pathLen({ x: -5, z: 0 }, { x: -9, z: 3 }), 5, '같은 쪽은 곧은 거리');
  // 카메라 테두리: 둔덕 밖 1.3 m
  const v = new THREE.Vector3(30, 2.3, -30);
  F.clampCamera(v, 2.6);
  assert.deepEqual([v.x, v.y, v.z], [19.3, 2.6, -13.3]);
  // 충돌체: 바깥 넷 + 물가 여섯 + 난간 넷
  assert.equal(G.colliders.length, 14);
  for (const k of G.colliders) assert.ok(k.h.every((h) => h > 0));
  assert.deepEqual(sweepParams(m.stage).r0, 16);
  assert.deepEqual(sweepParams(m.stage).h0, 7);
});

test('무대 표 → 성벽 안뜰: 34 × 22 · 가운데 성벽 3 m · 문 z ∓ 6 (문길 2.4 · 깊이 3.4 · 지붕) · 시작 x ∓ 13 · 벽 너머 시야 가림', () => {
  const m = SAENGSA_MAP_BY_ID.court, G = mapGeo(m), F = fieldOfMap('court');
  assert.deepEqual(G.half, { x: 17, z: 11 });
  assert.deepEqual(G.lanes.map((l) => [l.z0, l.z1, l.x0, l.x1]), [[-7.2, -4.8, -1.7, 1.7], [4.8, 7.2, -1.7, 1.7]]);
  assert.deepEqual(G.points.map((p) => [p.z, p.r]), [[-6, 1.2], [6, 1.2]]);
  assert.equal(G.roofs.length, 2);
  assert.ok(G.blocks.every((b) => b.sight));
  assert.ok(F.sightBlocked({ x: -5, z: 0 }, { x: 5, z: 0 }), '성벽 너머 안 보임');
  assert.ok(!F.sightBlocked({ x: -5, z: 6 }, { x: 5, z: 6 }), '문길로는 보임');
  assert.ok(!F.sightBlocked({ x: -5, z: 0 }, { x: -9, z: 8 }), '같은 쪽');
  assert.deepEqual(mapSpawnSpots(m, [0, 1]).map((s) => s.x), [-13, 13]);
  const r = F.route({ x: -13, z: 0 }, { x: 13, z: 0 });
  assert.ok([-6, 6].includes(r.way.z) && r.way.x === -2.3);
  const v = new THREE.Vector3(30, 2.3, 0);
  F.clampCamera(v, 2.3);
  assert.ok(v.x < 17 && v.x > 16, '카메라는 바깥 성벽 안');
});

test('맵 뽑기 = 경기 씨앗 (다시보기 · 이어받기 · 고르기 화면 같음) · 둘 다 나옴 · 이름 · 여정 차례 밖', () => {
  const t = { seed: 123456 }, m = { id: 'r1-m3' };
  assert.equal(mapOfMatch(t, m), pickSaengsaMap(hash32(t.seed, m.id)));
  assert.equal(pickSaengsaMap(99), pickSaengsaMap(99));
  const n = { bridges: 0, court: 0 };
  for (let i = 0; i < 400; i++) n[pickSaengsaMap(hash32(i, 'x')).id]++;
  assert.ok(n.bridges > 150 && n.court > 150, JSON.stringify(n));
  for (const map of SAENGSA_MAPS) {
    assert.ok(isSaengsaStage(map.stage));
    assert.equal(STAGE_NAME_KO[map.stage], map.name);
    assert.ok(!STAGE_ORDER.includes(map.stage), '여정 차례에 없음');
    assert.ok(map.name.length <= 8);
    assert.match(mapThumbSvg(map), /^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/);
  }
});

test('AI 가 다리로 건넘 (두 다리 개울 1:1 — 시작 x ∓ 14 · 30 s 안에 맞붙음 · 물에 안 들어감)', (t) => {
  seedRand(t, 3);
  const G = newMatch({ count: 2, ai: 'all', seed: 3, walls: true, map: 'bridges', weapons: ['longsword', 'longsword'] });
  const F = G.fighters;
  assert.ok(F.every((f) => f.field === fieldOfMap('bridges')));
  let met = null, wet = 0;
  for (let i = 0; i < 30 / DT && !G.over; i++) {
    G.step();
    const a = F[0].bodies.pelvis.translation(), b = F[1].bodies.pelvis.translation();
    for (const p of [a, b]) if (Math.abs(p.x) < 1.6 && Math.abs(Math.abs(p.z) - 7) > 1.5) wet++;
    if (met == null && Math.hypot(a.x - b.x, a.z - b.z) < 3) met = G.t;
  }
  assert.ok(met != null && met < 30, `맞붙은 때 ${met}`);
  assert.equal(wet, 0, '개울 위에 선 스텝');
});

test('성벽 안뜰 카메라: 성벽에 등을 대면 벽을 따라 돌려 내 몸이 보임 · 문길 안은 지붕 밑 · 두 다리는 돌림 없음', async () => {
  const { fieldCamera, fieldCamBlocked, fieldGuardOf } = await import('../../src/field_camera.js');
  const F = fieldOfMap('court');
  // 가운데 성벽(x −0.75 ~ 0.75) 왼쪽 면에 등을 대고 −x 를 봄 → 어깨 너머 카메라는 벽 속(x +1.6)
  const origin = { x: -1.15, y: 1.0, z: 0 };
  const cam = new THREE.Vector3(-1.15 + 2.9, 2.3, 0.9);
  assert.ok(fieldCamBlocked(F, origin, cam), '돌리기 전 — 벽에 막힘');
  // 그 자리의 각 그대로 (instant — 화면에서는 시간 상수 tauOut 으로 돌아 나감)
  const c2 = new THREE.Vector3(-1.15 + 2.9, 2.3, 0.9);
  const { clampStageCamera } = await import('../../src/arena_obstacle.js');
  clampStageCamera(origin, c2, fieldGuardOf(F), { instant: true, field: F });
  assert.ok(!fieldCamBlocked(F, origin, c2), `돌린 자리 ${c2.x.toFixed(2)}, ${c2.z.toFixed(2)} — 내 몸이 보임`);
  assert.ok(c2.x < -0.75 - 0.4, '벽 이쪽');
  // 문길 안 (지붕 밑 2.7 m): 카메라 높이를 지붕 밑으로
  const o2 = { x: 0.2, y: 1.0, z: 6 }, c3 = new THREE.Vector3(-2.7, 3.2, 6.5);
  fieldCamera(F, o2, c3, CONFIG.CAMERA.minDist);
  assert.ok(c3.y <= SAENGSA_MAP_BY_ID.court.gate.roof - 0.3, `지붕 밑 ${c3.y}`);
  // 두 다리 개울: 시야 막이가 없어 돌림 · 비침 없음 (테두리에 밀렸을 때 위로만)
  const B = fieldOfMap('bridges');
  assert.equal(fieldGuardOf(B), null);
  const c4 = new THREE.Vector3(-14 - 2.9, 2.3, 0.9);
  fieldCamera(B, { x: -14, y: 1, z: 0 }, c4, CONFIG.CAMERA.minDist);
  assert.deepEqual([c4.x, c4.y, c4.z], [-16.9, 2.3, 0.9]);
});

test('길목 나눠 쓰기: 동료가 다리 위에 있으면(싸우든 걷든) 그 뒤에 줄 서지 않고 다리 머리 뒤에서 기다림 · 동료가 가는 다리는 길게 셈', async () => {
  const { routeThroughField, FIELD_ROUTE } = await import('../../src/field_route.js');
  const F = fieldOfMap('bridges');
  const V = (x, z) => ({ x, y: 1, z });
  const body = (x, z) => ({ pelvis: { translation: () => V(x, z) }, chest: { translation: () => V(x, z) } });
  const fighter = (x, z, extra = {}) => ({ alive: true, state: 'stand', armed: true, field: F, heading: 0, fightT: 10, bodies: body(x, z), move: { x: 0, y: 0.5, set(a, b) { this.x = a; this.y = b; } }, ...extra });
  const run = (me, foe, mates) => { me.mates = mates; const ai = { me, foe, mode: 'watch', phase: 'ready' }; routeThroughField(ai); return ai; };
  // 적(1 편)이 다리(z +7) 위 · 동료가 그 적과 붙어 싸움(동료가 내 쪽 머리에 더 가까움) · 나는 내 쪽 물가
  const foe = fighter(0.5, 7);
  const mate = fighter(-0.9, 7, { foe, aiCtl: { fieldLane: -1, M: { reach: 1.6 } } });
  const me = fighter(-6, 5);
  const ai = run(me, foe, [mate]);
  assert.deepEqual([+ai.fieldRoute.way.x.toFixed(2), ai.fieldRoute.way.z], [-3.4 - FIELD_ROUTE.back, 7], '다리 머리 뒤 기다리는 자리');
  assert.deepEqual([me.fieldFace.x, me.fieldFace.z], [0, 7], '다리 가운데를 봄');
  const me2 = fighter(-3.4 - FIELD_ROUTE.back + 0.2, 7);
  run(me2, foe, [mate]);
  assert.deepEqual([me2.move.x, me2.move.y], [0, 0], '닿으면 섬');
  // 동료가 다리 위를 걸어가기만 해도(상대가 멀리) 그 다리 안이면 들어가 뒤에 줄 서지 않음 · 다리에 아무도 없으면 곧장
  const far = fighter(14, 0);
  const walker = fighter(-0.9, 7, { foe: far, aiCtl: { fieldLane: 1 } });
  const ai3 = run(fighter(-6, 5), foe, [walker]);
  assert.deepEqual([+ai3.fieldRoute.way.x.toFixed(2), ai3.fieldRoute.way.z], [-3.4 - FIELD_ROUTE.back, 7], '걷는 동료 뒤에도 줄 서지 않음');
  const ai3b = run(fighter(-6, 5), foe, [fighter(-9, -3, { foe: far, aiCtl: { fieldLane: -1 } })]);
  assert.equal(ai3b.fieldRoute, null, '다리에 동료 없음 — 막히지 않은 곧은 길');
  // 건너편 상대 · 동료 둘이 다리 z +7 로 가는 중 → 나는 다리 z −7 로 (나눠 건넘)
  const me4 = fighter(-14, 0.5);
  const ai4 = run(me4, fighter(14, 2), [fighter(-10, 3, { aiCtl: { fieldLane: 1 } }), fighter(-9, 4, { aiCtl: { fieldLane: 1 } })]);
  assert.equal(ai4.fieldLane, 0);
  const ai5 = run(fighter(-14, 0.5), fighter(14, 2), []);
  assert.equal(ai5.fieldLane, 1, '동료가 없으면 가까운 다리');
});
