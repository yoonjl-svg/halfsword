// jelly_harness: deterministic Node replica of main.js newRound()+step loop (no rendering).
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import * as CONFIG from '../../src/config.js';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { AI } from '../../src/ai.js';
import { Combat } from '../../src/combat.js';
import { setSupportFloor } from '../../src/gait.js';

await RAPIER.init();
export { RAPIER, THREE, CONFIG, AI };
// 마무리·약한 자세 겨눔 스위치 (10/12, harness_m.mjs 와 같은 환경 변수 — 안 주면 src 기본 그대로): FINISH_ENTRY=down|low|downlow|auto · FINISH_MODE=kill|power25 · VITAL=0|1 · PLATE_NECK=0|1
{
  const { FINISH } = await import('../../src/finish.js');
  if (['down', 'low', 'downlow', 'auto'].includes(process.env.FINISH_ENTRY)) FINISH.entry = process.env.FINISH_ENTRY;
  if (['power25', 'kill'].includes(process.env.FINISH_MODE)) FINISH.mode = process.env.FINISH_MODE;
  if (['0', '1'].includes(process.env.VITAL)) FINISH.vital = process.env.VITAL === '1';
  if (['0', '1'].includes(process.env.PLATE_NECK)) FINISH.plateNeck = process.env.PLATE_NECK === '1';
  {
    const { VITAL } = await import('../../src/vital_target.js'); // 묶음 갈래: VITAL_AI=0|1 · VITAL_THRUST=0|1 · VITAL_PCUT=0|1
    for (const [e, k] of [['VITAL_AI', 'aiCut'], ['VITAL_THRUST', 'thrust'], ['VITAL_PCUT', 'playerCut']]) if (['0', '1'].includes(process.env[e])) VITAL[k] = process.env[e] === '1';
  }
}
const { PHYSICS, ARENA } = CONFIG;
export const DT = PHYSICS.timestep;

export function newRound(opts = {}) {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = opts.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
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
  const scene = new THREE.Scene();
  const gap = opts.gap ?? ARENA.startGap;
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, heading: 0, look: LOOKS.player, breakSeed: opts.seed });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, heading: Math.PI, look: LOOKS.enemy, breakSeed: opts.seed });
  if (opts.onFighter) { opts.onFighter(player, world, RAPIER); opts.onFighter(enemy, world, RAPIER); }
  const ai = new AI(enemy, player, opts.difficulty ?? 'normal');
  player.skill.level = opts.skill ?? 0.7;
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (att, vic, r) => hits.push(`${att.name}->${r.zone}:${r.type} ${r.energy.toFixed(0)}J`), onClash: () => {} });
  const G = { world, eventQueue, player, enemy, ai, combat, hits, t: 0, ai2: null, parkEnemy: false };
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
    G.t += DT;
  };
  G.park = () => {
    // move enemy far away (so player acts alone)
    for (const { rb } of enemy.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x + 40, y: t.y, z: t.z + 40 }, true);
    }
    enemy.anchor.setTranslation({ x: enemy.anchor.translation().x + 40, y: enemy.anchor.translation().y, z: enemy.anchor.translation().z + 40 }, true);
    G.parkEnemy = true;
    G.faceP = { x: 100, y: 1, z: 0 };
  };
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
