// jelly_harness: deterministic Node replica of main.js newRound()+step loop (no rendering).
// NOTE: newRound() only puts an AI on `enemy` by default — `player` sits still (no input) unless
// you pass opts.AI2Class (usually AI, imported from here). AI-vs-AI scripts that forget this end up
// benchmarking "AI vs. a passive dummy holding a sword", not a real fight (bit us once — weapon_balance.mjs).
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import * as CONFIG from '../../src/config.js';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { AI } from '../../src/ai.js';
import { Combat } from '../../src/combat.js';
import { Input } from '../../src/input.js';

await RAPIER.init();
export { RAPIER, THREE, CONFIG, AI };
const { PHYSICS, ARENA } = CONFIG;
export const DT = PHYSICS.timestep;

// 결정적 난수 (같은 seed → 같은 판). Math.random 을 바꿔치기한다
//  SOFF=<n>: 모든 시드에 n 을 더한다 (도구를 고치지 않고 다른 시드 묶음으로 다시 잰다. 없으면 예전과 같다)
const SOFF = +(process.env.SOFF || 0);
export function seedRandom(seed) {
  let a = (seed + SOFF) >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newRound(opts = {}) {
  if (opts.seed != null) seedRandom(opts.seed);
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = opts.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCol = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
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
  // look/look2 = 플레이어·상대 자리 겉모습 (캐릭터 look 을 주면 투구·판금이 판정에 들어간다, config.js ARMOR). 생략하면 예전 그대로
  //  breakSeed(판 시드)는 무기 파손 굴림과 방어구 연출 전용 난수의 씨앗 (fighter.js — 한 프로세스에서 판을 어떤 순서로 돌려도 같은 판은 같게)
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, heading: 0, look: opts.look ?? LOOKS.player, weapon: opts.weapon, breakSeed: opts.seed });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, heading: Math.PI, look: opts.look2 ?? (opts.sameLook ? LOOKS.player : LOOKS.enemy), weapon: opts.weapon2 ?? opts.weapon, breakSeed: opts.seed });
  if (opts.onFighter) { opts.onFighter(player, world, RAPIER); opts.onFighter(enemy, world, RAPIER); }
  const AIC = opts.AIClass || AI;
  const ai = new AIC(enemy, player, opts.difficulty ?? 'normal', opts.persona ?? null);
  player.skill.level = opts.skill ?? 0.7;
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (att, vic, r) => { hits.push(`${att.name}->${r.zone}:${r.type} ${r.energy.toFixed(0)}J`); G.wounds.push({ t: G.t, att, vic, zone: r.zone, type: r.type, energy: r.energy, severity: r.severity }); G.onWound?.(att, vic, r); }, onClash: () => { G && G.clashes++; } });
  const G = { world, eventQueue, player, enemy, ai, combat, hits, t: 0, ai2: null, parkEnemy: false, clashes: 0, wounds: [], groundCol }; // groundCol: 발 접촉 힘을 재는 도구(legs_gates)가 쓴다
  if (opts.AI2Class) G.ai2 = new opts.AI2Class(player, enemy, opts.difficulty2 ?? opts.difficulty ?? 'normal', opts.persona2 ?? null);
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

// ─────────────────────────────────────────────────────────────
//  손가락 궤적 넣기 (온몸 베기 docs/whole_body_strike.md 4-5, feedTrace)
//  합성 손가락 궤적을 게임과 같은 길로 넣는다: 화면 프레임(hz)마다 input.js(Input.onDown/onMove/onUp)가 손가락 이벤트를
//  받아 handDX·handDY·fingerTrace 에 쌓고, main.js frame() 처럼 consumeHandDelta → player.handOffset·handHeld·inputActive,
//  탭이면 찌르기. 물리 스텝은 main.js 와 같은 누적 시계(acc)로 돈다 (60 Hz 면 프레임마다 2스텝, 90 Hz 면 1·1·2스텝 …)
//  → 새로고침 빠르기에 따라 손 목표가 갱신되는 박자까지 폰과 같다. 결심 판정(L1)은 skill.detect 인 파이터만 한다(여기서 켠다)
//  궤적: { pts: [[t ms, x, y], ...] } (손가락을 댄 자리에서의 이동, 패드 m, 사이는 직선) 또는 { fn: (t ms) => [x, y], T: ms }
//   · down (기본 true): 첫 프레임에 손가락을 댄다. false 면 앞 궤적에서 떼지 않은 손가락이 그 자리에서 이어 간다
//   · lift (기본 true): 끝나는 프레임에 손가락을 뗀다 (TRACE_LIFT 조각)
//  화면: innerHeight 390 px → 1 패드 m = 150 px (INPUT.touchSensitivity 2.6)
// ─────────────────────────────────────────────────────────────
const SCREEN_H = 390;
const SHIM = { window: { addEventListener() {}, innerHeight: SCREEN_H, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
/** input.js 를 부르는 동안만 브라우저 흉내(window·document·matchMedia)를 둔다.
 *  늘 두면 안 된다: Rapier(wasm)가 전역 window 가 있으면 브라우저로 보고 window.performance 를 찾다가 멈춘다 */
function withBrowser(fn) {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try {
    return fn();
  } finally {
    for (const k of added) delete globalThis[k];
  }
}

/** G 에 게임과 같은 입력 길(펌프)을 붙인다 (한 번만. 두 번째부터는 있는 것을 돌려준다). f = 입력을 받는 파이터 */
export function inputPump(G, { hz = 60, f = G.player } = {}) {
  if (G.pump) return G.pump;
  const input = withBrowser(() => new Input({ addEventListener() {} }));
  input.enabled = true;
  f.skill.detect = true; // 결심 판정은 플레이어만 (main.js 와 같게)
  f.skill.trace = input.fingerTrace; // 결심 판정이 읽는 손가락 원래 궤적 (main.js 와 같게)
  f.skill.autoGuard = true;
  const ppm = SCREEN_H / CONFIG.INPUT.touchSensitivity; // 패드 m → px (input.js 가 쓰는 배율의 거꾸로)
  // stick: 조이스틱 {x, y}. main.js 처럼 프레임마다 f.move 에 넣는다 (검술 층의 내딛기가 올려 둔 move 도 다음 프레임에 되돌아간다).
  //  null 로 두면 도구가 f.move 를 직접 다룬다
  const P = { G, f, input, hz, wall: 1000, acc: 0, budget: 0, queue: [], fx: 600, fy: 200, frames: 0, ppm, stick: { x: 0, y: 0 } };
  // 손가락 이벤트 하나를 input.js 에 (그동안만 브라우저 흉내). 시각 = 이 프레임의 벽시계
  const send = (type, x, y) => {
    const e = { type, pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: P.wall };
    withBrowser(() => (type === 'pointerdown' ? input.onDown(e) : type === 'pointermove' ? input.onMove(e) : input.onUp(e)));
  };
  P.frame = () => {
    P.wall += 1000 / P.hz;
    P.acc += 1 / P.hz;
    P.frames++;
    const q = P.queue[0];
    if (q) {
      if (q.w0 == null) {
        q.w0 = P.wall;
        q.t0 = G.t;
        if (q.down) {
          if (input.activeTouch !== null) send('pointerup', P.fx, P.fy);
          send('pointerdown', P.fx, P.fy);
        }
        q.bx = P.fx;
        q.by = P.fy;
      }
      const tau = Math.min(P.wall - q.w0, q.T);
      const [x, y] = q.pos(tau);
      const nx = q.bx + x * ppm;
      const ny = q.by - y * ppm;
      if (nx !== P.fx || ny !== P.fy) send('pointermove', nx, ny);
      P.fx = nx;
      P.fy = ny;
      if (P.wall - q.w0 >= q.T) {
        if (q.lift) send('pointerup', nx, ny);
        q.done = true;
        q.t1 = G.t;
        P.queue.shift();
      }
    }
    // main.js frame(): 손 목표 갱신 (입력 → 플레이어). 손가락 궤적에 프레임 시각
    input.fingerTrace.tick(P.wall);
    const d = input.consumeHandDelta();
    if (f.alive) {
      f.handOffset.x += d.x;
      f.handOffset.y += d.y;
    }
    f.handHeld = input.activeTouch !== null;
    f.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    if (input.consumeTaps() > 0 && f.alive) f.skill.thrust();
    if (P.stick) f.move.set(f.alive ? P.stick.x : 0, f.alive ? P.stick.y : 0);
    while (P.acc >= DT - 1e-9) {
      P.acc -= DT;
      P.budget++;
    }
  };
  P.tick = () => {
    while (P.budget <= 0) P.frame();
    P.budget--;
  };
  const step0 = G.step;
  G.step = () => {
    P.tick();
    step0();
  };
  G.pump = P;
  return P;
}

/**
 * 합성 손가락 궤적을 넣는다 (다음 화면 프레임부터). 앞에 넣은 궤적이 남아 있으면 그 뒤에 이어 넣는다.
 * @returns 궤적 기록 { done, t0(시작한 물리 시각), t1(끝난 물리 시각), T(ms) } — G.step() 을 돌리면 채워진다
 */
export function feedTrace(G, trace, hz = 60, opts = {}) {
  const P = inputPump(G, { hz, f: opts.f });
  P.hz = hz;
  const tr = Array.isArray(trace) ? { pts: trace } : trace;
  let pos = tr.fn;
  let T = tr.T;
  if (!pos) {
    const pts = tr.pts;
    T = pts[pts.length - 1][0];
    pos = (t) => {
      if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
      for (let i = 1; i < pts.length; i++) {
        if (t <= pts[i][0]) {
          const a = pts[i - 1];
          const b = pts[i];
          const u = (t - a[0]) / Math.max(1e-9, b[0] - a[0]);
          return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        }
      }
      const z = pts[pts.length - 1];
      return [z[1], z[2]];
    };
  }
  const q = { pos, T, down: tr.down ?? true, lift: tr.lift ?? true, done: false, t0: null, t1: null, w0: null };
  P.queue.push(q);
  return q;
}
