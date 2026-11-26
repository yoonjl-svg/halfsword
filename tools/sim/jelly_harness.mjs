// jelly_harness: deterministic Node replica of main.js newRound()+step loop (no rendering).
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import * as CONFIG from '../../src/config.js';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { AI } from '../../src/ai.js';
import { Combat } from '../../src/combat.js';
import { setSupportFloor } from '../../src/gait.js';
import { terrainForStage, createTerrainGround, applyTerrainHazards } from '../../src/etna_ground.js';
import { createMatch, stepMatch, orderControllers, spawnSpots, pairFoe } from '../../src/match.js'; // 동시 대전 판 newMatch (10/29)
import { fieldOfMap, mapSpawnSpots, SAENGSA_MAP_BY_ID } from '../../src/saengsa_maps.js'; // 생사전 전용 맵 (11/21 — newMatch opts.map)
import { CIRCLE_FIELD } from '../../src/field.js';

await RAPIER.init();
export { RAPIER, THREE, CONFIG, AI };
const { PHYSICS, ARENA } = CONFIG;
export const DT = PHYSICS.timestep;

export function newRound(opts = {}) {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = opts.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  // 지형 무대 시험(opts.stageId — 화산섬 'etna' 만, tools/sim/slope_check.mjs): main.js newRound 의 지형 갈래와 같은 바닥. 안 주면 아래 평평한 상자 바닥 그대로 (관문 바이트 같음)
  const terrain = opts.stageId ? terrainForStage(opts.stageId) : null;
  const environment = terrain ? createTerrainGround(RAPIER, world, GROUND_GROUPS, terrain, { radius: ARENA.radius, walls: opts.walls !== false }) : null;
  if (environment) setSupportFloor(world, environment.floor);
  else {
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor); // 발 체중 받침은 이 바닥 접촉만 (main.js newRound 와 같게 — 벽에 닿은 발 힘은 받침이 아님, 10/14)
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < (opts.walls === false ? 0 : n); i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }
  }
  const scene = new THREE.Scene();
  const gap = opts.gap ?? ARENA.startGap;
  // 지형 시험만: 시작 자리 z·방향(opts.playerZ·enemyZ·heading·heading2)과 땅(terrain). 평지 판은 전과 같은 인자
  const player = terrain
    ? new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, z: opts.playerZ ?? 0, heading: opts.heading ?? 0, terrain, look: LOOKS.player, breakSeed: opts.seed })
    : new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, heading: 0, look: LOOKS.player, breakSeed: opts.seed });
  const enemy = terrain
    ? new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, z: opts.enemyZ ?? 0, heading: opts.heading2 ?? Math.PI, terrain, look: LOOKS.enemy, breakSeed: opts.seed })
    : new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, heading: Math.PI, look: LOOKS.enemy, breakSeed: opts.seed });
  if (opts.onFighter) { opts.onFighter(player, world, RAPIER); opts.onFighter(enemy, world, RAPIER); }
  const ai = new AI(enemy, player, opts.difficulty ?? 'normal');
  player.skill.level = opts.skill ?? 0.7;
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (att, vic, r) => hits.push(`${att.name}->${r.zone}:${r.type} ${r.energy.toFixed(0)}J`), onClash: () => {} });
  const G = { world, eventQueue, player, enemy, ai, combat, hits, t: 0, ai2: null, parkEnemy: false, environment };
  G.step = () => {
    player.foe = G.parkEnemy ? null : enemy;
    enemy.foe = G.parkEnemy ? null : player;
    player.faceTarget = G.faceP || enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    if (!G.parkEnemy) ai.update(DT);
    else enemy.move.set(0, 0);
    if (G.ai2) G.ai2.update(DT);
    if (G.before) G.before(G.t);
    player.step(DT);
    enemy.step(DT);
    player.cacheState();
    enemy.cacheState();
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    if (environment) G.burns = applyTerrainHazards(environment, colliderInfo, DT); // 지형 시험만: 용암 화상 (main.js 와 같은 자리 — 물리 스텝 뒤)
    G.t += DT;
  };
  G.park = () => {
    // move enemy far away (so player acts alone)
    for (const { rb } of enemy.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x + 40, y: t.y, z: t.z + 40 }, true);
    }
    G.parkEnemy = true;
    G.faceP = { x: 100, y: 1, z: 0 };
  };
  return G;
}

// ── 동시 대전 판 (10/29 — src/match.js stepMatch · docs/strike/team_fight_2026-10-29.md) ──
//  newRound 와 같은 평지 세계(지형 없음)에 싸움꾼 count 명(자리 0, 1, 2, … — 11/20 넷 제한 없음 · 0 편 = 짝수 자리, 1 편 = 홀수 자리)을 세우고, 스텝은 src/match.js 의 공용 차례로 돈다.
//  1:1(count 2)은 newRound 와 같은 자리 · 겉모습 · 시드 · 만드는 차례 — tools/sim/match_twin.mjs 가 fights12 해시로 확인한다.
//  opts: count(2) · gap(ARENA.startGap) · mateGap(TEAM_FIGHT.mateGap — 한 편 둘 사이 옆 간격) · seed · walls · iters · difficulty ·
//        ai(AI 를 붙일 자리 — 안 주면 [1] = newRound 처럼 상대만. 'all' 이면 모두) · foeOf(f, M, dt)(상대 고르기 — 안 주면 둘이면 다른 하나 · 셋 이상이면 src/targeting.js chooseTarget) · weapons(자리마다 무기 id) · looks(자리마다 겉모습 — 안 주면 0 편 LOOKS.player(케틀 투구) · 1 편 LOOKS.enemy(투구 없음): newRound 와 같음) · onFighter
//  AI 는 조종 부르는 차례(1 편 → 0 편, 자리 차례, 사람 몸 맨 뒤 — orderControllers)대로 만든다: AI 생성자의 Math.random 차례 (fights12 = 상대 AI 먼저)
//  돌려줌 G = 판(M) + { player(자리 0), enemy(자리 1), ai(자리 1 의 AI), ai2(자리 0 의 AI), ais(자리 → AI), hits, step(), before? }
export function newMatch(opts = {}) {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = opts.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor);
  // 경계 막이 = 지도 꼴의 벽 (11/21 — src/field.js): 원 무대 32 조각(예전 그대로) · opts.map('bridges' · 'court')이면 생사전 전용 맵의 둔덕 · 물가 · 난간 · 성벽 (main.js resetWorld 와 같음)
  const field = opts.map ? fieldOfMap(opts.map) : CIRCLE_FIELD;
  if (opts.walls !== false) field.walls(RAPIER, world, ground, GROUND_GROUPS);
  const scene = new THREE.Scene();
  const count = opts.count ?? 2;
  // 시작 자리: 전용 맵이면 무대 표(편마다 x ∓ 14 · z −2.5 · 0 · +2.5 — main.js newTeamRound 와 같음) · 아니면 예전 그대로 (편 = 자리 홀짝)
  const spots = opts.map ? mapSpawnSpots(SAENGSA_MAP_BY_ID[opts.map], Array.from({ length: count }, (_, i) => i % 2)) : spawnSpots(count, { gap: opts.gap ?? ARENA.startGap, mateGap: opts.mateGap ?? CONFIG.TEAM_FIGHT.mateGap });
  // 이름: 0 편 P · P2 · P3 …, 1 편 E · E2 · E3 … (편 안 차례 — 2:2 는 예전 P · E · P2 · E2 그대로)
  const NAMES = spots.map((s, i) => { const k = spots.slice(0, i).filter((o) => o.team === s.team).length; return (s.team === 0 ? 'P' : 'E') + (k ? k + 1 : ''); });
  const W = (i) => (opts.weapons?.[i] ? { weapon: opts.weapons[i] } : {}); // 자리마다 무기 (안 주면 Fighter 기본 — 롱소드) · 같은 편도 같은 물리 (11/20 — 제 몸만 걸이가 버림 · src/self_contact.js)
  const fighters = spots.map((s, i) => (s.z === 0
    ? new Fighter(RAPIER, world, scene, colliderInfo, { index: i, name: NAMES[i], x: s.x, heading: s.heading, look: opts.looks?.[i] ?? (s.team === 0 ? LOOKS.player : LOOKS.enemy), breakSeed: opts.seed, ...W(i) })
    : new Fighter(RAPIER, world, scene, colliderInfo, { index: i, name: NAMES[i], x: s.x, z: s.z, heading: s.heading, look: opts.looks?.[i] ?? (s.team === 0 ? LOOKS.player : LOOKS.enemy), breakSeed: opts.seed, ...W(i) })));
  if (opts.map) for (const f of fighters) f.field = field; // 전용 맵: AI 띠 · 길목 길 · 물러남 끝이 읽는다 (원 무대는 달지 않음 — 예전 그대로)
  if (opts.onFighter) for (const f of fighters) opts.onFighter(f, world, RAPIER);
  const player = fighters[0];
  const enemy = fighters[1];
  player.skill.level = opts.skill ?? 0.7; // newRound 와 같은 값 (자리 0 에 AI 를 붙이면 AI 가 제 실력으로 덮는다 — fights12 와 같음)
  const want = opts.ai === 'all' ? fighters.map((f) => f.index) : opts.ai ?? [1];
  const order = orderControllers(want.map((i) => ({ me: fighters[i] }))).map((c) => c.me.index);
  const M0 = { fighters };
  const ais = [];
  for (const i of order) {
    const a = opts.aiOf?.(i) ?? null; // 자리마다 실력 · 성격 (team_balance.mjs — aiAtProficiency) · 없으면 예전 그대로
    ais[i] = a ? new AI(fighters[i], pairFoe(fighters[i], M0), a.level, a.persona) : new AI(fighters[i], pairFoe(fighters[i], M0), opts.difficulty ?? 'normal'); // 상대마다 눈(addFoe)은 createMatch 가 (셋 이상 판)
  }
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (att, vic, r) => hits.push(`${att.name}->${r.zone}:${r.type} ${r.energy.toFixed(0)}J`), onClash: () => {} });
  const G = createMatch({ world, eventQueue, combat, fighters, controllers: order.map((i) => ais[i]), foeOf: opts.foeOf ?? null, capture: !!opts.capture }); // opts.capture: 거점전 (11/21 — opts.map 과 함께)
  Object.assign(G, { player, enemy, ai: ais[1] ?? null, ai2: ais[0] ?? null, ais, hits });
  const hooks = { afterControl: () => G.before?.(G.t) };
  G.step = () => stepMatch(G, DT, hooks);
  return G;
}

// helpers
export const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
export const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
/** wrist (hand) world position = farmS local (0.13,0,0) */
export function handPos(f) {
  const b = f.bodies.farmS;
  return new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
}
/** express world point in fighter's yaw frame relative to chest (x fwd, y up, z right) */
export function toBody(f, p, origin) {
  const o = origin || V(f.bodies.chest.translation());
  return p.clone().sub(o).applyQuaternion(f.yaw.clone().invert());
}
export const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
export const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
export const p2p = (a) => Math.max(...a) - Math.min(...a);
export const f3 = (x) => +x.toFixed(3);
export const f2 = (x) => +x.toFixed(2);
export const f1 = (x) => +x.toFixed(1);
