// ─────────────────────────────────────────────────────────────
//  ratna_drypath_sim.mjs — 라트나 '마른 길을 아는 AI' 노드 시뮬 (docs/import/ratna_drypath_2026-10-14.md)
//   main.js 의 판 세우기·스텝 차례를 따르고 잠든 습지까지 세운다: 석상 충돌체(configureStageObstacle) · 진흙 감속(configureWetlandMovement) · 시작 옆 비킴(stageStartZ) ·
//   발 받침 바닥(setSupportFloor). 상대 AI 는 인물 시트 그대로(CHARACTERS_BY_ID — 실력 숫자·성격·숙련도), 무기는 시트 무기, 겉모습은 기본(물리만 잰다). 결정적(같은 시드 → 같은 판).
//  node tools/sim/ratna_drypath_sim.mjs eq --base=<git 판>      대조: 그 판의 src/ai.js 와 지금 ai.js 의 스텝마다 AI 결정(스틱 · 손 목표 · 꼴 · 골반 자리) 해시를 20 s 견준다
//      A 라트나 · 기본 무대 시드 1~3 · B 다른 인물 모두 · 잠든 습지 시드 1 · C 라트나 · 잠든 습지 · 표식 뺌 시드 1~3 → 같아야 한다 / D 라트나 · 잠든 습지 · 표식 그대로 → 달라야 한다
//  node tools/sim/ratna_drypath_sim.mjs stats <still|retreat|circle> [초=40] [시드=1,2,3]  전(표식 뺌 — C 로 옛 길과 같음을 본 판) / 후
//      플레이어 정해진 입력: still 가만히 · retreat 라트나가 2.3 m 안이면 물러나고(스틱 −0.8) 3.4 m 밖이면 다가감(+0.5) · circle retreat + 늘 오른쪽 옆걸음 0.5
//      판 시작 정지 2 s 는 빼고 센다 · 판이 끝나면 다음 시드(시드 × 100 + 판 번호)로 이어 초를 채운다
//  node tools/sim/ratna_drypath_sim.mjs stones [출력 json]   디딤돌 여덟(stage_sluice.js paving 을 같은 난수로 다시 지음) 윗면 위 젖음 · 가장 가까운 웅덩이 가장자리
//  값 바꿔 보기: DRY_<칸>=값 (예: DRY_fan=0.6 DRY_power=0.3,0.4,0.6,0.7,0.85,1) — config.js DRYPATH 를 덮는다
// ─────────────────────────────────────────────────────────────
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as CONFIG from '../../src/config.js';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { AI } from '../../src/ai.js';
import { Combat } from '../../src/combat.js';
import { setSupportFloor } from '../../src/gait.js';
import { configureStageObstacle, stageStartZ } from '../../src/arena_obstacle.js';
import { configureWetlandMovement, wetlandWetness, WETLAND_PUDDLES, puddleOutline } from '../../src/wetland_ground.js';
import { CHARACTERS, CHARACTERS_BY_ID } from '../../src/characters.js';

await RAPIER.init();
const { PHYSICS, ARENA } = CONFIG;
const DT = PHYSICS.timestep;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('DRY_') && k.slice(4) in CONFIG.DRYPATH) CONFIG.DRYPATH[k.slice(4)] = k === 'DRY_power' ? v.split(',').map(Number) : +v;

function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const READY = [0.12, -0.18];
const slowHand = (off, q, sp) => {
  const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT;
  if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]);
};

/** 판 하나: main.js newRound 와 같은 세계 · 같은 스텝 차례 (그리기·소리 빼고) */
function makeRound({ seed, stage = 'sluice', foeId = 'ratna', AIClass = AI, flagOff = false, policy = 'still' }) {
  seedRandom(seed);
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor);
  const n = 32, R = ARENA.radius + 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS), ground);
  }
  const stone = configureStageObstacle(RAPIER, world, stage, GROUND_GROUPS);
  const z0 = stageStartZ(stage);
  const scene = new THREE.Scene();
  const foe = CHARACTERS_BY_ID[foeId];
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -ARENA.startGap / 2, z: z0, heading: 0, look: LOOKS.player, weapon: 'longsword', breakSeed: seed });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: ARENA.startGap / 2, z: z0, heading: Math.PI, look: LOOKS.enemy, weapon: foe.weapon, breakSeed: seed, revive: foe.revive });
  for (const f of [player, enemy]) {
    configureWetlandMovement(f, stage);
    f.arenaObstacle = stone?.navigation ?? null;
  }
  const persona = flagOff ? { ...foe.ai.persona, terrainSense: undefined } : foe.ai.persona;
  const ai = new AIClass(enemy, player, foe.ai.level, persona);
  player.skill.level = 0.7;
  player.skill.autoGuard = true;
  const G = { world, player, enemy, ai, t: 0 };
  const combat = new Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  G.step = () => {
    player.foe = enemy;
    enemy.foe = player;
    player.faceTarget = enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    ai.update(DT);
    const p = player.bodies.pelvis.translation(), e = enemy.bodies.pelvis.translation();
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    const fy = policy === 'retreat' || policy === 'circle' ? (d < 2.3 ? -0.8 : d > 3.4 ? 0.5 : 0) : 0;
    const fx = policy === 'circle' ? 0.5 : 0;
    player.move.set(player.alive ? fx : 0, player.alive ? fy : 0);
    slowHand(player.handOffset, READY, 1.0);
    player.step(DT);
    enemy.step(DT);
    player.cacheState();
    enemy.cacheState();
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    G.t += DT;
  };
  G.free = () => world.free();
  return G;
}

const mode = process.argv[2] || 'stats';
const opt = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const pos = process.argv.slice(3).filter((a) => !a.startsWith('--'));

if (mode === 'eq') {
  // 그 판의 ai.js 를 임시 폴더에 꺼내 가져오기 경로만 이 저장소 src 로 바꿔 불러온다 (다른 모듈은 지금 것과 같은 것을 쓴다)
  const base = opt.base || 'HEAD';
  const dir = mkdtempSync(path.join(tmpdir(), 'drypath-eq-'));
  const srcUrl = pathToFileURL(path.join(ROOT, 'src')).href;
  const threeUrl = pathToFileURL(path.join(ROOT, 'node_modules/three/build/three.module.js')).href;
  const old = execFileSync('git', ['-C', ROOT, 'show', `${base}:src/ai.js`], { encoding: 'utf8' }).replace(/from '\.\//g, `from '${srcUrl}/`).replace(/from 'three'/g, `from '${threeUrl}'`);
  writeFileSync(path.join(dir, 'ai_base.mjs'), old);
  const { AI: BaseAI } = await import(pathToFileURL(path.join(dir, 'ai_base.mjs')).href);
  rmSync(dir, { recursive: true, force: true });
  const f6 = (v) => (Number.isFinite(v) ? v.toFixed(6) : String(v));
  const trace = (o) => {
    const G = makeRound(o);
    const h = createHash('sha256');
    for (let i = 0; i < 20 / DT; i++) {
      G.step();
      const E = G.enemy, a = G.ai, pe = E.bodies.pelvis.translation();
      h.update(`${f6(E.move.x)},${f6(E.move.y)},${f6(E.handOffset.x)},${f6(E.handOffset.y)},${a.mode},${a.phase},${f6(pe.x)},${f6(pe.z)};`);
      if (!G.player.alive || !E.alive) break;
    }
    const out = { hash: h.digest('hex').slice(0, 12), t: +G.t.toFixed(2), attacks: G.ai.stats.attacks, rnd: Math.random() };
    G.free();
    return out;
  };
  const rows = [];
  let bad = 0;
  const cmp = (label, a, b, wantSame) => {
    const A = trace(a), B = trace(b), same = A.hash === B.hash && A.rnd === B.rnd;
    if (same !== wantSame) bad++;
    rows.push(`${label.padEnd(40)} ${A.hash} ${B.hash} ${same ? '같음' : '다름'}${same === wantSame ? '' : '  ← 기대와 다름'} (t ${A.t}/${B.t} · 공격 ${A.attacks}/${B.attacks})`);
  };
  for (const seed of [1, 2, 3]) {
    cmp(`A 라트나 · 기본 무대 · 시드 ${seed}`, { seed, stage: 'arena', AIClass: BaseAI }, { seed, stage: 'arena' }, true);
    cmp(`C 라트나 · 잠든 습지 · 표식 뺌 · 시드 ${seed}`, { seed, AIClass: BaseAI }, { seed, flagOff: true }, true);
    cmp(`D 라트나 · 잠든 습지 · 표식 그대로 · 시드 ${seed}`, { seed, AIClass: BaseAI }, { seed }, false);
  }
  for (const c of [...CHARACTERS, ...Object.values(CHARACTERS_BY_ID).filter((x) => !CHARACTERS.includes(x) && x.id !== 'ratna')]) cmp(`B ${c.id} · 잠든 습지 · 시드 1`, { seed: 1, foeId: c.id, AIClass: BaseAI }, { seed: 1, foeId: c.id }, true);
  console.log(`기준 ${base} 의 src/ai.js ↔ 지금\n${rows.join('\n')}\n${bad ? `기대와 다른 줄 ${bad}` : '모두 기대대로'}`);
}

if (mode === 'stats') {
  const policy = pos[0] || 'still';
  const secs = +(pos[1] || 40);
  const seeds = (pos[2] || '1,2,3').split(',').map(Number);
  const run = (seed, flagOff) => {
    const S = { t: 0, wetR: 0, wetP: 0, hiR: 0, hiP: 0, back: 0, attacks: 0, aborted: 0, landed: 0, rounds: 0, nearT: 0, touchT: 0, stuck: 0, flips: 0, nearMoveT: 0 };
    for (let r = 0; S.t < secs - 1e-9; r++) {
      const G = makeRound({ seed: seed * 100 + r, flagOff, policy });
      S.rounds++;
      let slowT = 0, prev = null;
      for (let i = 0; i < 60 / DT && S.t < secs - 1e-9; i++) {
        G.step();
        const E = G.enemy, P = G.player;
        if (!E.alive || !P.alive) break;
        if (G.t < ARENA.startHold) continue;
        S.t += DT;
        const pe = E.bodies.pelvis.translation(), pp = P.bodies.pelvis.translation();
        const wr = wetlandWetness(pe.x, pe.z), wp = wetlandWetness(pp.x, pp.z);
        S.wetR += wr * DT;
        S.wetP += wp * DT;
        if (wr > 0.3) S.hiR += DT;
        if (wp > 0.3) S.hiP += DT;
        const dx = pp.x - pe.x, dz = pp.z - pe.z, dd = Math.hypot(dx, dz) || 1e-6;
        for (const k of [0.8, 1.6, 2.4]) S.back += (wetlandWetness(pp.x + (dx / dd) * k, pp.z + (dz / dd) * k) / 3) * DT;
        // 석상 근처(골반이 가운데에서 1.8 m 안): 1.25 m 안 = 받침에 몸이 닿는 거리 · 끼임 = 스틱 0.3 넘게 미는데 골반 0.15 m/s 아래가 0.5 s 넘게 · 뒤집힘 = 이웃 스텝 스틱이 90° 넘게 돎
        const rb = Math.hypot(pe.x, pe.z), m = Math.hypot(E.move.x, E.move.y);
        if (rb < 1.8) {
          S.nearT += DT;
          if (rb < 1.25) S.touchT += DT;
          const v = E.bodies.pelvis.linvel();
          if (m > 0.3 && E.state === 'stand') {
            S.nearMoveT += DT;
            if (Math.hypot(v.x, v.z) < 0.15) { slowT += DT; if (slowT >= 0.5 && slowT - DT < 0.5) S.stuck++; } else slowT = 0;
            if (prev && prev[0] * E.move.x + prev[1] * E.move.y < 0) S.flips++;
          } else slowT = 0;
        } else slowT = 0;
        prev = m > 0.2 ? [E.move.x, E.move.y] : null;
      }
      S.attacks += G.ai.stats.attacks;
      S.aborted += G.ai.stats.aborted;
      S.landed += G.ai.stats.landed;
      G.free();
    }
    return S;
  };
  const fmt = (S) => `라트나 젖음 평균 ${(S.wetR / S.t).toFixed(3)} · >0.3 ${((100 * S.hiR) / S.t).toFixed(1)} % | 상대 젖음 평균 ${(S.wetP / S.t).toFixed(3)} · >0.3 ${((100 * S.hiP) / S.t).toFixed(1)} % · 등 뒤 ${(S.back / S.t).toFixed(3)} | 공격 시도 ${S.attacks} (거둠 ${S.aborted} · 칼 나감 ${S.attacks - S.aborted} · 맞힘 ${S.landed}) · 판 ${S.rounds} | 석상 1.8 m 안 ${S.nearT.toFixed(1)} s · 1.25 m 안 ${S.touchT.toFixed(1)} s · 끼임 ${S.stuck} · 뒤집힘 ${S.flips} (밀며 근처 ${S.nearMoveT.toFixed(1)} s)`;
  const tot = { off: [], on: [] };
  for (const seed of seeds) {
    for (const [k, off] of [['off', true], ['on', false]]) {
      const S = run(seed, off);
      tot[k].push(S);
      console.log(`시드 ${seed} ${k === 'off' ? '전' : '후'} ${S.t.toFixed(1)} s: ${fmt(S)}`);
    }
  }
  for (const k of ['off', 'on']) {
    const A = tot[k].reduce((a, S) => { for (const key of Object.keys(S)) a[key] = (a[key] ?? 0) + S[key]; return a; }, {});
    console.log(`합 ${k === 'off' ? '전' : '후'} ${A.t.toFixed(1)} s (${policy}): ${fmt(A)}`);
  }
}

if (mode === 'stones') {
  // stage_sluice.js paving() 의 디딤돌을 같은 난수(rng 63977)·같은 소비 순서로 다시 짓는다 — 윗면 다각형(돌림 포함)과 그 위 젖음(2 cm 격자)
  const TAU = Math.PI * 2;
  const rng = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
  const STEPS = { count: 8, from: -7.25, to: -1.48, sway: 0.3, radius: [0.25, 0.34] };
  const q = rng(63977);
  const stones = [];
  for (let i = 0; i < STEPS.count; i++) {
    const u = i / (STEPS.count - 1);
    const x = STEPS.from + (STEPS.to - STEPS.from) * u + (q() - 0.5) * 0.08;
    const z = STEPS.sway * Math.sin(u * Math.PI * 1.3 + 0.4) * (1 - u * 0.7) + (q() - 0.5) * 0.08;
    const R = STEPS.radius[0] + (STEPS.radius[1] - STEPS.radius[0]) * (i === STEPS.count - 1 ? 1 : q());
    const n = 7 + Math.floor(q() * 3), pts = [];
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + (q() - 0.5) * 0.5;
      const rr = R * (0.8 + q() * 0.36) * (1 + 0.18 * Math.cos(a * 2 + i));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const rot = q() * TAU;
    for (let k = 0; k < 15 * n - 6; k++) q(); // 이끼 칠: toNonIndexed 꼭짓점(윗면 n − 2 + 옆 두 고리 4n 세모 × 3)마다 한 번
    const c = Math.cos(rot), s = Math.sin(rot);
    const poly = pts.map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]);
    const inside = (px, pz) => { let ins = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, za] = poly[a], [xb, zb] = poly[b]; if (za > pz !== zb > pz && px < ((xb - xa) * (pz - za)) / (zb - za) + xa) ins = !ins; } return ins; };
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    let maxW = 0, cells = 0;
    for (let gx = Math.min(...xs); gx <= Math.max(...xs); gx += 0.02) for (let gz = Math.min(...zs); gz <= Math.max(...zs); gz += 0.02) if (inside(gx, gz)) { maxW = Math.max(maxW, wetlandWetness(gx, gz)); cells++; }
    let edge = Infinity, which = 0;
    WETLAND_PUDDLES.forEach((p, k) => { for (let a = 0; a < TAU; a += TAU / 720) { const f = puddleOutline(a, p.phase), d = Math.hypot(p.x + Math.cos(a) * p.rx * f - x, p.z + Math.sin(a) * p.rz * f - z); if (d < edge) { edge = d; which = k + 1; } } });
    stones.push({ i: i + 1, x: +x.toFixed(2), z: +z.toFixed(2), R: +R.toFixed(2), area: +(cells * 0.0004).toFixed(2), maxWet: +maxW.toFixed(3), edge: +edge.toFixed(2), puddle: which, poly: poly.map((p) => p.map((v) => +v.toFixed(3))) });
  }
  for (const s of stones) console.log(`돌 ${s.i}: (${s.x}, ${s.z}) 반지름 ${s.R} m · 윗면 ${s.area} m² · 윗면 위 젖음 가장 큼 ${s.maxWet} · 가장 가까운 웅덩이 ${s.puddle} 가장자리까지 ${s.edge} m`);
  if (pos[0]) {
    // 지도 그림용(tools/browser/ratna_drypath_map.py): 젖음 격자 −7 ~ 7 m · 0.05 m 칸 · 석상 받침 · 길잡이 반지름 · 결투장
    const N = 281, H = 7, grid = [];
    for (let j = 0; j < N; j++) grid.push(Array.from({ length: N }, (_, i) => +wetlandWetness(-H + (2 * H * i) / (N - 1), -H + (2 * H * j) / (N - 1)).toFixed(3)));
    const { BEAR_PLINTH, BEAR_AVOID_RADIUS } = await import('../../src/stage_sluice_bear.js');
    const { OBSTACLE_ROUTE } = await import('../../src/arena_obstacle.js');
    writeFileSync(pos[0], JSON.stringify({ N, H, grid, stones: stones.map((s) => s.poly), bear: { plinth: BEAR_PLINTH.radius, clear: BEAR_AVOID_RADIUS + OBSTACLE_ROUTE.clear }, arena: ARENA.radius }));
  }
}
