// 다리 1.5 합격선 G1~G10 (docs/whole_body_strike.md 9장. 다리 1.5 검증 도구 scratchpad/hyb·verify5177·implementer 를 저장소로 옮겼다)
// 실행 (저장소 뿌리): node tools/sim/hybrid.mjs legs_gates.mjs <부분> [N]      (levitate 와 견줄 땐 MODE=levitate)
//   부분:
//     stand [N]      G1 가만히 섰을 때·자세를 바꿀 때 발이 받친 몸무게, 딛은 발 미끄러짐
//     walk [N]       G1·G2·G3·G8 8방향 × 조이스틱 1/0.6/0.4: 서기 → 5초 걷기 → 3초 멈춤 → 걷기·멈춤 4번. 몸무게·미끄러짐·넘어짐·출렁임·흔들림·걸음 빠르기
//     circle [N]     G2 가만히 선 상대 둘레를 1.5/1.8/2.1 m 에서 돈다 (양쪽 발 미끄러짐)
//     turn [N]       G5 제자리 돌기 ±45~180°(홀수 판은 돈 뒤 1.2초 앞으로 걷기): 딛은 발 비틀림·미끄러짐
//     mash [N] [초]  G4 조이스틱 마구 흔들기 (8방향 / 상대 앞 / 아날로그 세 가지): 선 채 분당 넘어짐
//     getup [N]      G6 넘어뜨리고(무겁게·가볍게·밀기 셋) 일어선 뒤 골반 처짐, 3초 안 다시 넘어짐. 판 시작 처짐
//     push [N]       (참고) 서서·걸으며 가슴을 60/90/120 N·s 로 밀 때 넘어짐
//     fight [N] [초] G7 AI 대 AI (보통, 같은 시드 짝): 선 채 분당 넘어짐과 까닭, 발이 받친 몸무게
//     step [N]       G10 requestStep: 앞발 내딛기 0.25/0.3/0.45 m, 뒷발 지나 딛기 0.6 m, 뒤로 0.5 m → 발 이동(부탁 대비), 닿은 뒤 밀림, 넘어짐
//     all            위를 모두 (G9 성능은 perf_ab.mjs)
//   결과: 요약(SUMMARY 줄)을 찍고 JSON 을 OUT(없으면 OUTDIR 또는 임시 폴더의 legs_<부분>_<모드>.json)에 남긴다
// 재는 법 (검증 담당 h7.js 그대로)
//  - 발 힘: 땅과 닿은 접촉 충격량 ÷ dt ÷ 1.1667 (연구 단계 보정, 가만히 놓인 상자로 30·90 Hz 에서 확인)
//  - 미끄러짐: 한 번 닿음(0.1 W 넘게 실린 동안) 동안 압력 중심점이 발바닥 위에서 움직인 거리 (닿음이 0.06초 넘게 끊기면 새 닿음)
//  - 출렁임·흔들림: 무게중심 높이·옆 위치에서 ±0.5초 이동 평균을 뺀 뒤 1초 창마다 최고−최저의 평균
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RAPIER, THREE, CONFIG, AI } from './harness_m.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { Combat } from '../../src/combat.js';

if (process.env.MODE) CONFIG.BODY.weightMode = process.env.MODE;
const MODE = CONFIG.BODY.weightMode;
const SUB = process.argv[2] || 'all';
const NARG = process.argv[3] != null ? +process.argv[3] : null;
const DT = CONFIG.PHYSICS.timestep;
const CAL = 1.1667;
const r2 = (x) => +(+x).toFixed(2);
const r3 = (x) => +(+x).toFixed(3);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// ── 판 차리기: 판마다 설정을 처음 값으로 되돌린다 (with_config 로 바꾼 값은 처음 값에 들어 있다) ──
const DEFAULTS = {};
for (const [k, v] of Object.entries(CONFIG)) if (v && typeof v === 'object') DEFAULTS[k] = JSON.parse(JSON.stringify(v));
function seedRandom(seed) {
  let s = (seed * 7919 + 13) % 2147483647;
  if (s <= 0) s += 2147483646;
  Math.random = () => ((s = (s * 48271) % 2147483647) - 1) / 2147483646;
}

/**
 * main.js newRound() 과 같은 판 + 재는 틀(V).
 *  o.mode: 'solo'(상대를 멀리 치운다) | 'near'(상대를 o.gap m 앞에 세운다) | 'fight'(AI 대 AI, o.playerAI = 난이도)
 *  o.face: 'dir'(V.faceAng 방향을 본다) | 'enemy', o.noWalls: 벽을 치운다
 */
let LAST = null; // 앞 판의 물리 세계 (새 판을 차릴 때 풀어 wasm 메모리가 쌓이지 않게)
function mk(o = {}) {
  if (LAST) LAST.world.free(), LAST.eq.free();
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (k === 'BODY') {
      const wm = CONFIG.BODY.weightMode;
      Object.assign(CONFIG[k], JSON.parse(JSON.stringify(v)));
      CONFIG.BODY.weightMode = wm;
    } else Object.assign(CONFIG[k], JSON.parse(JSON.stringify(v)));
  }
  seedRandom(o.seed ?? 1);
  const { PHYSICS, ARENA } = CONFIG;
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const groundCol = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < (o.noWalls ? 0 : n); i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS), ground);
  }
  const scene = new THREE.Scene();
  const P = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -ARENA.startGap / 2, heading: 0, look: LOOKS.player });
  const E = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: ARENA.startGap / 2, heading: Math.PI, look: LOOKS.enemy });
  const ai = new AI(E, P, o.difficulty || 'normal');
  P.skill.level = o.skill ?? 0.7;
  P.skill.autoGuard = true;
  const combat = new Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  return (LAST = harness({ P, E, world, ai, combat, groundCol }, o));
}

/** 재는 틀 (검증 담당 h7.js 를 모듈로). main.js 물리 고리와 같은 순서로 한 스텝을 돈다 */
function harness(g, o) {
  const { P, E, world } = g;
  const V = { P, E, world, t: 0, o, DT };
  V.shift = (f, dx, dz) => {
    for (const { rb } of f.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
    }
    const t = f.anchor.translation();
    f.anchor.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  };
  V.mode = o.mode || 'solo';
  if (V.mode === 'solo') V.shift(E, -25 - E.bodies.pelvis.translation().x, -25 - E.bodies.pelvis.translation().z);
  if (V.mode === 'near') {
    const pp = P.bodies.pelvis.translation();
    const ep = E.bodies.pelvis.translation();
    V.shift(E, pp.x + (o.gap ?? 2) - ep.x, pp.z - ep.z);
  }
  V.eq = new RAPIER.EventQueue(true);
  V.pai = o.playerAI ? new AI(P, E, o.playerAI) : null;
  V.face = new THREE.Vector3(100, 1, 0);
  V.faceMode = o.face || 'dir';
  V.faceAng = o.faceAng ?? 0;
  V.col2part = new Map();
  world.forEachCollider((c) => {
    const b = c.parent();
    if (!b) return;
    for (const f of [P, E]) for (const nm in f.bodies) if (b.handle === f.bodies[nm].handle) V.col2part.set(c.handle, [f, nm]);
  });
  const rotVec = (q, out) => {
    const w = Math.min(1, Math.abs(q.w));
    const sg = q.w < 0 ? -1 : 1;
    const s = Math.sqrt(1 - w * w);
    if (s < 1e-6) return out.set(0, 0, 0);
    return out.set(q.x, q.y, q.z).multiplyScalar((sg * 2 * Math.acos(w)) / s);
  };
  // 넘어짐(까닭), 보조 힘(addForce 의 위 방향 합), 다리 관절 목표 속도 제한(±15 rad/s)에 걸린 수, 발 닿음 수
  for (const f of [P, E]) {
    const I = (f._lg = { extYstep: 0, kd: [], clampStand: 0, tdEvents: 0 });
    for (const nm in f.bodies) {
      const b = f.bodies[nm];
      const add = b.addForce.bind(b);
      b.addForce = (F, w) => {
        I.extYstep += F.y;
        return add(F, w);
      };
    }
    const kd = f.knockDown.bind(f);
    f.knockDown = (heavy) => {
      if (f.state === 'stand') {
        const cause = f.balance <= 0 ? 'gauge' : f.tiltDeg() > CONFIG.BODY.fallTiltDeg ? 'tilt' : f.offBalanceTime > CONFIG.BALANCE.fallDelay ? 'footing' : f.legHealth < 0.25 ? 'legs' : f.gait && f.gait.active && (f.gait.lowT > CONFIG.GAIT.lowTime || f.gait.satT > CONFIG.GAIT.lowTime) ? 'collapse' : 'other';
        I.kd.push({ t: r3(V.t), cause, heavy: !!heavy, py: r3(f.bodies.pelvis.translation().y) });
      }
      return kd(heavy);
    };
    const LEGJ = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
    const rq = new THREE.Quaternion();
    const rr = new THREE.Vector3();
    const dj = f.driveJoints.bind(f);
    f.driveJoints = (...a) => {
      const inv = f.lastDt > 0 ? 1 / f.lastDt : 0;
      for (const nm of LEGJ) {
        const j = f.jointByName[nm];
        if (!j || !j.prevRV) continue;
        rotVec(rq.copy(j.restInv).multiply(j.target), rr);
        const m = j.type === 'hinge' ? Math.abs(rr.z - j.prevRV.z) * inv : Math.max(Math.abs(rr.x - j.prevRV.x), Math.abs(rr.y - j.prevRV.y), Math.abs(rr.z - j.prevRV.z)) * inv;
        if (m > 15 && f.state === 'stand') I.clampStand++;
      }
      return dj(...a);
    };
    if (f.gait) {
      const td = f.gait.touchdown.bind(f.gait);
      f.gait.touchdown = (...a) => {
        I.tdEvents++;
        return td(...a);
      };
    }
  }
  V.hooks = [];
  V.step = () => {
    P.foe = E;
    E.foe = P;
    if (V.faceMode === 'enemy') P.faceTarget = E.bodies.pelvis.translation();
    else {
      const p = P.bodies.pelvis.translation();
      V.face.set(p.x + 100 * Math.cos(V.faceAng), 1, p.z - 100 * Math.sin(V.faceAng));
      P.faceTarget = V.face;
    }
    E.faceTarget = P.bodies.pelvis.translation();
    if (V.mode === 'fight') {
      g.ai.update(DT);
      if (V.pai) V.pai.update(DT);
    } else E.move.set(0, 0);
    for (const h of V.hooks) h();
    P._lg.extYstep = 0;
    E._lg.extYstep = 0;
    P.step(DT);
    E.step(DT);
    P.cacheState();
    E.cacheState();
    world.step(V.eq, g.combat.physicsHooks);
    g.combat.afterStep(world, V.eq);
    V.t += DT;
  };
  // 한 파이터의 땅 접촉: 부위별 수직 힘, 발마다 충격량으로 가중한 압력 중심(발 기준 좌표)
  const ct0 = { F: 0, B: 0, other: 0, lF: [0, 0, 0, 0], lB: [0, 0, 0, 0] };
  V.contacts = (f) => {
    const out = ct0;
    out.F = out.B = out.other = 0;
    for (const a of [out.lF, out.lB]) a[0] = a[1] = a[2] = a[3] = 0;
    world.contactPairsWith(g.groundCol, (c2) => {
      const e = V.col2part.get(c2.handle);
      if (!e || e[0] !== f) return;
      world.contactPair(g.groundCol, c2, (m, flipped) => {
        const nrm = m.normal();
        let s = 0;
        const isFoot = e[1] === 'footF' || e[1] === 'footB';
        const L = e[1] === 'footF' ? out.lF : out.lB;
        for (let i = 0; i < m.numContacts(); i++) {
          const imp = m.contactImpulse(i);
          s += imp;
          if (isFoot && imp > 0) {
            const lp = flipped ? m.localContactPoint1(i) : m.localContactPoint2(i);
            if (lp) (L[0] += lp.x * imp), (L[1] += lp.y * imp), (L[2] += lp.z * imp), (L[3] += imp);
          }
        }
        const fy = (s * Math.abs(nrm.y)) / DT;
        if (isFoot) out[e[1] === 'footF' ? 'F' : 'B'] += fy;
        else out.other += fy;
      });
    });
    return out;
  };
  const com = {};
  V.comOf = (f) => {
    let M = 0, x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0; // prettier-ignore
    const add = (b) => {
      const m = b.mass();
      const c = b.worldCom();
      const v = b.linvel();
      x += c.x * m;
      y += c.y * m;
      z += c.z * m;
      vx += v.x * m;
      vy += v.y * m;
      vz += v.z * m;
      M += m;
    };
    for (const nm in f.bodies) add(f.bodies[nm]);
    if (f.armed && f.sword) add(f.sword);
    Object.assign(com, { x: x / M, y: y / M, z: z / M, vx: vx / M, vy: vy / M, vz: vz / M, M });
    return com;
  };
  const tmpV = new THREE.Vector3();
  const yawOf = (q) => (tmpV.set(1, 0, 0).applyQuaternion(q), Math.atan2(-tmpV.z, tmpV.x));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  V.track = (f) => ({ f, t0: V.t, n: 0, A: { stand: [], feet: [], other: [], ext: [], lev: [] }, con: { F: null, B: null }, contacts: [], comY: [], lat: [], spd: [], pelY: [], kd0: f._lg.kd.length, clamp0: f._lg.clampStand, td0: f._lg.tdEvents, tdT: [], prevPose: { F: null, B: null }, tiltMax: 0 });
  const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _l = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3(), _o = new THREE.Vector3(); // prettier-ignore
  const GAP = 0.06;
  V.sample = (T) => {
    const f = T.f;
    const ct = V.contacts(f);
    V.comOf(f);
    const W = com.M * 9.81;
    T.n++;
    const stand = f.state === 'stand';
    const A = T.A;
    A.stand.push(stand ? 1 : 0);
    A.feet.push((ct.F + ct.B) / CAL / W);
    A.other.push(ct.other / CAL / W);
    A.ext.push(f._lg.extYstep / W);
    A.lev.push(f.gait && f.gait.active ? f.gait.lev : 0);
    if (stand) T.tiltMax = Math.max(T.tiltMax, f.tiltDeg());
    if (f.gait && f.gait.active && f._lg.tdEvents !== T._tdLast) {
      if (T._tdLast !== undefined) T.tdT.push(V.t);
      T._tdLast = f._lg.tdEvents;
    }
    for (const k of ['F', 'B']) {
      const b = f.bodies[k === 'F' ? 'footF' : 'footB'];
      const load = ct[k] / CAL / W;
      const r = b.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      const t = b.translation();
      _p.set(t.x, t.y, t.z);
      const yaw = yawOf(_q);
      const L = k === 'F' ? ct.lF : ct.lB;
      let C = T.con[k];
      if (C && load < 0.04) {
        C.gap += DT;
        if (C.gap > GAP || !stand) {
          C.dur = V.t - C.t0;
          C.net = Math.hypot(C.dx, C.dz);
          if (C.peak > 0.2) T.contacts.push(C);
          T.con[k] = C = null;
        }
      }
      if (!C && load > 0.1 && stand) C = T.con[k] = { k, t0: V.t, peak: 0, dx: 0, dz: 0, maxNet: 0, yaw0: yaw, yawMax: 0, gap: 0 };
      if (C) {
        if (load >= 0.04) C.gap = 0;
        C.peak = Math.max(C.peak, load);
        const pp = T.prevPose[k];
        if (L[3] > 0 && pp && load > 0.1) {
          _l.set(L[0] / L[3], L[1] / L[3], L[2] / L[3]); // 압력 중심 (발 기준)
          _w.copy(_l).applyQuaternion(_q).add(_p);
          _n.copy(_l).applyQuaternion(pp.q).add(pp.p);
          C.dx += _w.x - _n.x;
          C.dz += _w.z - _n.z;
          C.maxNet = Math.max(C.maxNet, Math.hypot(C.dx, C.dz));
        }
        if (load > 0.1) C.yawMax = Math.max(C.yawMax, Math.abs(wrap(yaw - C.yaw0)));
      }
      const P0 = T.prevPose[k] || (T.prevPose[k] = { p: new THREE.Vector3(), q: new THREE.Quaternion() });
      P0.p.copy(_p);
      P0.q.copy(_q);
    }
    const rgt = f.right(_o);
    T.comY.push(com.y);
    T.lat.push(com.x * rgt.x + com.z * rgt.z);
    T.spd.push(Math.hypot(com.vx, com.vz));
    T.pelY.push(f.bodies.pelvis.translation().y);
  };
  V.flush = (T) => {
    for (const k of ['F', 'B']) {
      const C = T.con[k];
      if (C) {
        C.dur = V.t - C.t0;
        C.net = Math.hypot(C.dx, C.dz);
        if (C.peak > 0.2) T.contacts.push(C);
        T.con[k] = null;
      }
    }
  };
  const pp = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
  const osc = (a, win = 60) => {
    if (a.length < 2 * win + 10) return pp(a);
    const r = [];
    let s = 0;
    for (let j = 0; j < 2 * win + 1; j++) s += a[j];
    for (let i = win; i < a.length - win - 1; i++) {
      r.push(a[i] - s / (2 * win + 1));
      s += a[i + win + 1] - a[i - win];
    }
    const ps = [];
    for (let i = 0; i + 2 * win <= r.length; i += 2 * win) ps.push(pp(r.slice(i, i + 2 * win)));
    return ps.length ? mean(ps) : pp(r);
  };
  V.summary = (T, from = 0) => {
    V.flush(T);
    const f = T.f;
    const t0 = T.t0 + from - 1e-9;
    const cs = T.contacts.filter((c) => c.t0 >= t0);
    const nets = cs.map((c) => c.net).sort((a, b) => a - b);
    const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
    const skip = Math.round(from / DT);
    const A = T.A;
    let nS = 0, feet = 0, ext = 0, extMax = 0; // prettier-ignore
    for (let i = skip; i < A.stand.length; i++) {
      if (!A.stand[i]) continue;
      nS++;
      feet += A.feet[i];
      ext += A.ext[i];
      extMax = Math.max(extMax, A.ext[i]);
    }
    const tdT = T.tdT.filter((t) => t >= t0);
    const span = tdT.length > 1 ? tdT[tdT.length - 1] - tdT[0] : 0;
    return {
      feetW: r3(feet / Math.max(1, nS)), extMean: r3(ext / Math.max(1, nS)), extMax: r3(extMax), // prettier-ignore
      contacts: cs.length, slipMean: r2((100 * nets.reduce((a, b) => a + b, 0)) / Math.max(1, nets.length)), slipP90: r2(100 * q(nets, 0.9)), slipP99: r2(100 * q(nets, 0.99)), slipMax: r2(100 * (nets[nets.length - 1] || 0)),
      over2: cs.filter((c) => c.net > 0.02).length, over3: cs.filter((c) => c.net > 0.03).length,
      yawMaxDeg: r2(57.3 * Math.max(0, ...cs.map((c) => c.yawMax))),
      bobCm: r2(100 * osc(T.comY.slice(skip))), swayCm: r2(100 * osc(T.lat.slice(skip))), cadence: span > 0 ? r2((tdT.length - 1) / span) : 0,
      speed: r2(mean(T.spd.slice(skip))), kd: f._lg.kd.length - T.kd0, kdLog: f._lg.kd.slice(T.kd0), clampHits: f._lg.clampStand - T.clamp0,
      tiltMax: r2(T.tiltMax), pelMin: r3(Math.min(...T.pelY.slice(skip))), tStand: r2(nS * DT), state: f.state,
    };
  };
  V.run = (n, before, Ts) => {
    for (let i = 0; i < n; i++) {
      if (before) before(i);
      V.step();
      if (Ts) for (const T of Ts) V.sample(T);
    }
  };
  V.runT = (sec, before, Ts) => V.run(Math.round(sec / DT), before, Ts);
  return V;
}

const out = { sub: SUB, mode: MODE, gates: {} };
const log = (...a) => console.log(...a);
const want = (name) => SUB === name || SUB === 'all';

// ── G1 가만히 서기·자세 바꾸기 ──
if (want('stand')) {
  const n = SUB === 'stand' && NARG ? NARG : 6;
  const rows = [];
  for (let s = 0; s < n; s++) {
    const V = mk({ seed: 60 + s, noWalls: true, mode: 'solo' });
    const P = V.P;
    const rnd = Math.random;
    V.faceAng = rnd() - 0.5;
    V.runT(4, () => P.move.set(0, 0));
    const T = V.track(P);
    V.runT(10, () => P.move.set(0, 0), [T]);
    const Sq = V.summary(T, 0);
    const T2 = V.track(P); // 자세 바꾸기: 손 패드 자리가 0.8초마다 뛴다
    let left = 0;
    V.runT(10, () => { P.move.set(0, 0); left -= DT; if (left <= 0) { left = 0.8; P.handOffset.set((rnd() - 0.5) * 1.0, (rnd() - 0.4) * 1.0); } }, [T2]); // prettier-ignore
    const Sg = V.summary(T2, 0);
    rows.push({ Sq, Sg });
    log(`s${s} 가만히 feet=${Sq.feetW} ext=${Sq.extMean} slip max=${Sq.slipMax} | 자세 바꾸기 feet=${Sg.feetW} slip max=${Sg.slipMax} >2:${Sg.over2}/${Sg.contacts} kd=${Sg.kd}`);
  }
  const g = { quietFeetW: r3(mean(rows.map((r) => r.Sq.feetW))), guardFeetW: r3(mean(rows.map((r) => r.Sg.feetW))), guardSlipOver2: `${rows.reduce((a, r) => a + r.Sg.over2, 0)}/${rows.reduce((a, r) => a + r.Sg.contacts, 0)}`, guardSlipMax: Math.max(...rows.map((r) => r.Sg.slipMax)), kd: rows.reduce((a, r) => a + r.Sg.kd + r.Sq.kd, 0) };
  out.gates.stand = g;
  log('SUMMARY stand (G1)', JSON.stringify(g));
}

// ── G1·G2·G3·G8 8방향 걷기 ──
if (want('walk')) {
  const nSeeds = SUB === 'walk' && NARG ? NARG : 1;
  const DIRS = { F: [0, 1], FR: [0.7071, 0.7071], R: [1, 0], BR: [0.7071, -0.7071], B: [0, -1], BL: [-0.7071, -0.7071], L: [-1, 0], FL: [-0.7071, 0.7071] };
  const agg = { kd: 0, n: 0, over2: 0, contacts: 0, worst: 0, feet: [], sfeet: [], rows: [] };
  for (const mag of [1, 0.6, 0.4])
    for (const [dn, d] of Object.entries(DIRS))
      for (let s = 0; s < nSeeds; s++) {
        const seed = 100 + s * 17 + Math.round(mag * 10) + Object.keys(DIRS).indexOf(dn) * 3;
        const V = mk({ seed, noWalls: true, mode: 'solo' });
        const P = V.P;
        const rnd = Math.random;
        V.faceAng = (rnd() - 0.5) * 1.0;
        const pre = 2.2 + rnd() * 0.8;
        const jit = (rnd() - 0.5) * 0.2;
        const mx = (d[0] * Math.cos(jit) - d[1] * Math.sin(jit)) * mag;
        const my = (d[0] * Math.sin(jit) + d[1] * Math.cos(jit)) * mag;
        const r = { dir: dn, mag };
        const Tst = V.track(P);
        V.runT(pre, () => P.move.set(0, 0), [Tst]);
        r.stand = V.summary(Tst, 1.2);
        const Tw = V.track(P);
        V.runT(5, () => P.move.set(mx, my), [Tw]);
        r.walk = V.summary(Tw, 1.2);
        r.walkAll = V.summary(Tw, 0);
        const Ts = V.track(P);
        V.runT(3, () => P.move.set(0, 0), [Ts]);
        r.stop = V.summary(Ts, 0);
        const Tc = V.track(P);
        for (let i = 0; i < 4; i++) {
          V.runT(0.5 + rnd() * 0.6, () => P.move.set(mx, my), [Tc]);
          V.runT(0.4 + rnd() * 0.8, () => P.move.set(0, 0), [Tc]);
        }
        V.runT(2, () => P.move.set(0, 0), [Tc]);
        r.cycles = V.summary(Tc, 0);
        r.kd = P._lg.kd.length;
        agg.kd += r.kd;
        agg.n++;
        for (const x of [r.stand, r.walkAll, r.stop, r.cycles]) {
          agg.over2 += x.over2;
          agg.contacts += x.contacts;
          agg.worst = Math.max(agg.worst, x.slipMax);
        }
        agg.feet.push(r.walk.feetW);
        agg.sfeet.push(r.stand.feetW);
        agg.rows.push({ dir: dn, mag, v: r.walk.speed, feet: r.walk.feetW, slipMax: r.walkAll.slipMax, over2: r.walkAll.over2, contacts: r.walkAll.contacts, bob: r.walk.bobCm, sway: r.walk.swayCm, cad: r.walk.cadence, kd: r.kd });
        const w = r.walk;
        log(`${dn.padEnd(2)} ${mag} | v=${w.speed} feet=${w.feetW} slip max=${r.walkAll.slipMax} p90=${w.slipP90} >2:${w.over2}/${w.contacts} yaw=${w.yawMaxDeg} bob=${w.bobCm} sway=${w.swayCm} cad=${w.cadence} tilt=${w.tiltMax} | stop ${r.stop.slipMax} cyc ${r.cycles.slipMax} ${r.cycles.over2}/${r.cycles.contacts} | kd=${r.kd} ${P._lg.kd.map((k) => k.cause).join(',')}`);
      }
  const fwd = agg.rows.filter((r) => r.dir === 'F');
  const g = { runs: agg.n, G1walkFeetW: r3(mean(agg.feet)), G1standFeetW: r3(mean(agg.sfeet)), G2slipOver2: `${agg.over2}/${agg.contacts}`, G2slipOver2Pct: r2((100 * agg.over2) / Math.max(1, agg.contacts)), G2slipMax: agg.worst, G3kd: agg.kd, G8fwd: fwd.map((r) => ({ mag: r.mag, v: r.v, bob: r.bob, sway: r.sway, cad: r.cad })) };
  out.gates.walk = g;
  out.walkRows = agg.rows;
  log('SUMMARY walk (G1 G2 G3 G8)', JSON.stringify(g));
}

// ── G2 상대 둘레 돌기 ──
if (want('circle')) {
  const nSeeds = SUB === 'circle' && NARG ? NARG : 4;
  const rows = [];
  for (let s = 0; s < nSeeds; s++)
    for (const R of [1.5, 1.8, 2.1]) {
      const V = mk({ seed: 300 + s * 11 + Math.round(R * 10), noWalls: true, mode: 'near', gap: R, face: 'enemy' });
      const P = V.P;
      const E = V.E;
      const dir = s % 2 ? -1 : 1;
      const mag = [1, 0.8, 0.6][s % 3];
      V.runT(2.5, () => P.move.set(0, 0));
      const TP = V.track(P);
      const TE = V.track(E);
      V.runT(14, (i) => {
        const p = P.bodies.pelvis.translation();
        const e = E.bodies.pelvis.translation();
        const radial = Math.max(-0.6, Math.min(0.6, (Math.hypot(e.x - p.x, e.z - p.z) - R) * 2.5));
        const side = dir * mag;
        P.move.set(s >= 3 && Math.floor(i / 480) % 2 ? -side : side, radial);
      }, [TP, TE]); // prettier-ignore
      const a = V.summary(TP, 1.5);
      const b = V.summary(TE, 1.5);
      rows.push(a, b);
      log(`s${s} R=${R} | P v=${a.speed} slip max=${a.slipMax} p90=${a.slipP90} >2:${a.over2}/${a.contacts} yaw=${a.yawMaxDeg} kd=${a.kd} | E slip max=${b.slipMax} >2:${b.over2}/${b.contacts} kd=${b.kd}`);
    }
  const c = rows.reduce((x, r) => x + r.contacts, 0);
  const o = rows.reduce((x, r) => x + r.over2, 0);
  const g = { contacts: c, over2: o, over2Pct: r2((100 * o) / Math.max(1, c)), slipMax: Math.max(...rows.map((r) => r.slipMax)), slipMeanAvg: r2(mean(rows.map((r) => r.slipMean))), yawMax: Math.max(...rows.map((r) => r.yawMaxDeg)), kd: rows.reduce((x, r) => x + r.kd, 0) };
  out.gates.circle = g;
  log('SUMMARY circle (G2)', JSON.stringify(g));
}

// ── G5 제자리 돌기 ──
if (want('turn')) {
  const nSeeds = SUB === 'turn' && NARG ? NARG : 6;
  const angs = [180, -180, 90, -90, 135, -45];
  const rows = [];
  for (let s = 0; s < nSeeds; s++) {
    const V = mk({ seed: 500 + s * 7, noWalls: true, mode: 'solo' });
    const P = V.P;
    V.faceAng = 0;
    V.runT(3, () => P.move.set(0, 0));
    const T = V.track(P);
    for (let k = 0; k < angs.length; k++) {
      V.faceAng += (angs[(k + s) % angs.length] * Math.PI) / 180;
      V.runT(2.5 + (s % 3) * 0.3, () => P.move.set(0, 0), [T]);
      if (s % 2) V.runT(1.2, () => P.move.set(0, 1), [T]); // 돈 뒤 앞으로 걷기
    }
    const S = V.summary(T, 0);
    rows.push(S);
    log(`s${s} slip max=${S.slipMax} p90=${S.slipP90} >2:${S.over2}/${S.contacts} yaw=${S.yawMaxDeg} feet=${S.feetW} kd=${S.kd}`);
  }
  const c = rows.reduce((a, r) => a + r.contacts, 0);
  const o = rows.reduce((a, r) => a + r.over2, 0);
  const g = { contacts: c, over2: o, over2Pct: r2((100 * o) / Math.max(1, c)), slipMax: Math.max(...rows.map((r) => r.slipMax)), slipP90Avg: r2(mean(rows.map((r) => r.slipP90))), yawMax: Math.max(...rows.map((r) => r.yawMaxDeg)), kd: rows.reduce((a, r) => a + r.kd, 0) };
  out.gates.turn = g;
  log('SUMMARY turn (G5)', JSON.stringify(g));
}

// ── G4 조이스틱 마구 흔들기 ──
if (want('mash')) {
  const nSeeds = SUB === 'mash' && NARG ? NARG : 10;
  const dur = SUB === 'mash' && process.argv[4] ? +process.argv[4] : 20;
  const D8 = [[0, 1], [0.7071, 0.7071], [1, 0], [0.7071, -0.7071], [0, -1], [-0.7071, -0.7071], [-1, 0], [-0.7071, 0.7071]]; // prettier-ignore
  const res = {};
  for (const variant of ['far', 'enemy', 'analog']) {
    let kd = 0, standT = 0, c = 0, o = 0, mx = 0; // prettier-ignore
    const causes = [];
    for (let s = 0; s < nSeeds; s++) {
      const V = mk({ seed: 700 + s * 29 + variant.length * 7, noWalls: true, mode: variant === 'enemy' ? 'near' : 'solo', gap: 2.2, face: variant === 'enemy' ? 'enemy' : 'dir' });
      const P = V.P;
      const rnd = Math.random;
      V.runT(2.5, () => P.move.set(0, 0));
      const T = V.track(P);
      let left = 0;
      let cur = [0, 0];
      for (let i = 0; i < Math.round(dur / DT); i++) {
        if (left <= 0) {
          left = 0.15 + rnd() * 0.3;
          if (variant === 'analog') {
            const a = rnd() * 6.283;
            const m = rnd();
            cur = [Math.cos(a) * m, Math.sin(a) * m];
          } else cur = rnd() < 0.1 ? [0, 0] : D8[Math.floor(rnd() * 8)];
        }
        left -= DT;
        if (variant === 'enemy') {
          const p = P.bodies.pelvis.translation();
          const e = V.E.bodies.pelvis.translation();
          P.move.set(cur[0], Math.hypot(e.x - p.x, e.z - p.z) > 4 ? 1 : cur[1]);
        } else P.move.set(cur[0], cur[1]);
        V.step();
        V.sample(T);
        if (P.state === 'stand') standT += DT;
      }
      const S = V.summary(T, 0);
      kd += S.kd;
      causes.push(...S.kdLog.map((k) => k.cause));
      c += S.contacts;
      o += S.over2;
      mx = Math.max(mx, S.slipMax);
    }
    res[variant] = { kd, standMin: r2(standT / 60), kdPerMin: r3(kd / (standT / 60)), causes: causes.join(','), slipOver2Pct: r2((100 * o) / Math.max(1, c)), slipMax: mx };
    log(`mash ${variant}`, JSON.stringify(res[variant]));
  }
  const kd = Object.values(res).reduce((a, r) => a + r.kd, 0);
  const mins = Object.values(res).reduce((a, r) => a + r.standMin, 0);
  const g = { ...res, kdPerMinAll: r3(kd / mins) };
  out.gates.mash = g;
  log('SUMMARY mash (G4)', JSON.stringify(g));
}

// ── G6 일어서기·판 시작 ──
if (want('getup')) {
  const trials = SUB === 'getup' && NARG ? NARG : 20;
  const rows = [];
  for (let i = 0; i < trials; i++) {
    const V = mk({ seed: 900 + i * 31 + 5, noWalls: true, mode: 'solo' });
    const P = V.P;
    const rnd = Math.random;
    const res = {};
    const pel = () => P.bodies.pelvis.translation().y;
    const T0 = V.track(P);
    V.faceAng = (rnd() - 0.5) * 2;
    V.runT(3, () => P.move.set(0, 0), [T0]);
    const walkPre = i % 2 === 1;
    const wa = rnd() * 6.283;
    V.runT(rnd() * 4, () => (walkPre ? P.move.set(Math.cos(wa), Math.sin(wa)) : P.move.set(0, 0)));
    res.roundStartDip = r3(Math.min(T0.pelY[0], mean(T0.pelY.slice(-30))) - Math.min(...T0.pelY));
    const kind = ['heavy', 'light', 'push', 'pushSide', 'pushBack'][i % 5];
    res.kind = kind;
    if (kind === 'heavy') P.knockDown(true);
    else if (kind === 'light') P.knockDown(false);
    else {
      const fw = P.forward(new THREE.Vector3());
      const rg = P.right(new THREE.Vector3());
      const d = kind === 'push' ? fw : kind === 'pushSide' ? rg : fw.clone().negate();
      const J = 220 + rnd() * 200;
      P.bodies.chest.applyImpulse({ x: d.x * J, y: 0, z: d.z * J }, true);
    }
    let t = 0;
    while (P.state === 'stand' && t < 2.5) (V.step(), (t += DT));
    if (P.state === 'stand') {
      rows.push(res);
      continue;
    }
    t = 0;
    while (P.state !== 'stand' && t < 15) {
      P.move.set(0, 0);
      V.step();
      t += DT;
    }
    res.getupT = r2(t);
    if (P.state !== 'stand') {
      res.noGetup = P.state;
      rows.push(res);
      continue;
    }
    const kd0 = P._lg.kd.length;
    const h = [];
    for (let k = 0; k < 360; k++) {
      P.move.set(0, 0);
      V.step();
      h.push(pel());
    }
    res.dip = r3(Math.min(h[0], mean(h.slice(-60))) - Math.min(...h));
    res.refall = P._lg.kd.length - kd0;
    rows.push(res);
    log(`#${i} ${kind} getupT=${res.getupT} dip=${res.dip} refall=${res.refall} roundStartDip=${res.roundStartDip}`);
  }
  const ok = rows.filter((r) => r.dip != null);
  const g = { trials: rows.length, gotUp: ok.length, refalls: ok.reduce((a, r) => a + r.refall, 0), dipMaxCm: r2(100 * Math.max(...ok.map((r) => r.dip))), dipMeanCm: r2(100 * mean(ok.map((r) => r.dip))), getupTMean: r2(mean(ok.map((r) => r.getupT))), roundStartDipMaxCm: r2(100 * Math.max(...rows.map((r) => r.roundStartDip))) };
  out.gates.getup = g;
  log('SUMMARY getup (G6)', JSON.stringify(g));
}

// ── (참고) 밀기 ──
if (want('push')) {
  const N = SUB === 'push' && NARG ? NARG : 4;
  const walks = { stand: [0, 0], F: [0, 1], B: [0, -1], R: [1, 0] };
  const rows = [];
  for (const J of [60, 90, 120])
    for (const [wn, w] of Object.entries(walks))
      for (let k = 0; k < N; k++) {
        const V = mk({ seed: 9900 + k * 13 + J, noWalls: true, mode: 'solo' });
        const P = V.P;
        V.runT(3, () => P.move.set(0, 0));
        V.runT(1.5 + (k % 4) * 0.09, () => P.move.set(w[0], w[1]));
        const a = (k / N) * Math.PI * 2;
        P.bodies.chest.applyImpulse({ x: Math.cos(a) * J, y: 0, z: Math.sin(a) * J }, true);
        const kd0 = P._lg.kd.length;
        V.runT(3, () => P.move.set(w[0], w[1]));
        rows.push({ J, wn, kd: P._lg.kd.length - kd0 });
      }
  const g = Object.fromEntries([60, 90, 120].map((J) => [`J${J}`, Object.fromEntries(Object.keys(walks).map((wn) => [wn, `${rows.filter((r) => r.J === J && r.wn === wn && r.kd).length}/${N}`]))]));
  out.gates.push = g;
  log('SUMMARY push', JSON.stringify(g));
}

// ── G7 AI 대 AI ──
if (want('fight')) {
  const nSeeds = SUB === 'fight' && NARG ? NARG : 16;
  const dur = SUB === 'fight' && process.argv[4] ? +process.argv[4] : 60;
  let kd = 0, standT = 0, simT = 0, feet = 0, feetN = 0, deaths = 0; // prettier-ignore
  const cause = {};
  const per = [];
  for (let s = 0; s < nSeeds; s++) {
    const seed = 2000 + s * 37;
    const V = mk({ seed, mode: 'fight', face: 'enemy', playerAI: 'normal', difficulty: 'normal' });
    const P = V.P;
    const E = V.E;
    const TP = V.track(P);
    const TE = V.track(E);
    const st = { P: 0, E: 0 };
    let deathT = null;
    for (let i = 0; i < Math.round(dur / DT); i++) {
      V.step();
      if ((i & 3) === 0) V.sample(TP), V.sample(TE);
      if (P.state === 'stand') st.P += DT;
      if (E.state === 'stand') st.E += DT;
      if (deathT === null && (!P.alive || !E.alive)) deathT = V.t;
      if (deathT !== null && V.t > deathT + 1) break;
    }
    const SP = V.summary(TP, 0);
    const SE = V.summary(TE, 0);
    const k = [...P._lg.kd, ...E._lg.kd];
    for (const x of k) cause[x.cause + (x.heavy ? 'H' : '')] = (cause[x.cause + (x.heavy ? 'H' : '')] || 0) + 1;
    kd += k.length;
    standT += st.P + st.E;
    simT += V.t;
    feet += SP.feetW + SE.feetW;
    feetN += 2;
    if (deathT !== null) deaths++;
    per.push({ seed, kd: k.length, standMin: r2((st.P + st.E) / 60), deathT: deathT && r2(deathT) });
    log(`s${seed} kd ${P._lg.kd.length}+${E._lg.kd.length} [${k.map((x) => x.cause + (x.heavy ? 'H' : '')).join(',')}] stand ${r2(st.P)}+${r2(st.E)}s death=${deathT && r2(deathT)} feet ${SP.feetW}/${SE.feetW}`);
  }
  const sm = standT / 60;
  const g = { seeds: nSeeds, simMin: r2(simT / 60), standMin: r2(sm), kd, kdPerStandMin: r3(kd / sm), footingPerStandMin: r3((cause.footing || 0) / sm), collapsePerStandMin: r3((cause.collapse || 0) / sm), cause, deaths, feetW: r3(feet / feetN) };
  out.gates.fight = g;
  out.fightPer = per;
  log('SUMMARY fight (G7)', JSON.stringify(g));
}

// ── G10 requestStep ──
if (want('step')) {
  const reps = SUB === 'step' && NARG ? NARG : 3;
  const REQ = [
    ['lunge0.25', { kind: 'lunge', fwd: 0.25, duration: 0.3 }],
    ['lunge0.30', { kind: 'lunge', fwd: 0.3, duration: 0.3 }],
    ['lunge0.45', { kind: 'lunge', fwd: 0.45, duration: 0.36 }],
    ['pass0.6', { kind: 'pass', fwd: 0.6, duration: 0.4 }],
    ['passBack0.5', { kind: 'pass', fwd: -0.5, duration: 0.45 }],
  ];
  const res = {};
  const V3 = () => new THREE.Vector3();
  for (const [name, req] of REQ) {
    const rows = [];
    for (let k = 0; k < reps; k++) {
      const V = mk({ seed: 1300 + k * 17, noWalls: true, mode: 'solo' });
      const P = V.P;
      V.faceAng = 0;
      V.runT(3 + k * 0.13, () => P.move.set(0, 0));
      if (!P.gait || !P.gait.active) {
        rows.push({ accepted: false, why: 'no gait' });
        continue;
      }
      const fw = P.forward(V3());
      // 움직일 발: lunge = 앞발, pass = 뒷발 (앞뒤는 지금 발 자리로 가린다)
      const lead = P.gait.frontLeg(fw);
      const foot = req.kind === 'lunge' ? lead : lead === 'F' ? 'B' : 'F';
      const body = foot === 'F' ? 'footF' : 'footB';
      const s0 = P.solePoint(body, V3());
      const kd0 = P._lg.kd.length;
      const ok = P.gait.requestStep(req);
      let tdT = null;
      let sTD = null;
      const td = P.gait.touchdown;
      P.gait.touchdown = (l, sp) => {
        const r = td(l, sp);
        if (tdT === null && l.k === foot) (tdT = V.t), (sTD = P.solePoint(body, V3()));
        return r;
      };
      const t0 = V.t;
      // 닿은 뒤 밀림: 그 발이 딛고 있는 동안(닿은 뒤 0.5초까지) 발바닥이 닿은 자리에서 가장 멀어진 거리.
      //  그 뒤 자세로 돌아가며 다시 딛는 걸음은 밀림이 아니다 (다시 디디면 restep 으로 센다)
      let drift = 0;
      let lifted = false;
      const cur = V3();
      V.runT(1.2, () => {
        P.move.set(0, 0);
        if (tdT === null || lifted || V.t - tdT > 0.5) return;
        if (!P.gait.legs[foot].stance) return void (lifted = true);
        P.solePoint(body, cur);
        drift = Math.max(drift, Math.hypot(cur.x - sTD.x, cur.z - sTD.z));
      });
      P.gait.touchdown = td;
      const along = (a) => (a.x - s0.x) * fw.x + (a.z - s0.z) * fw.z;
      rows.push({ accepted: ok, tdT: tdT && r3(tdT - t0), moved: sTD && r3(along(sTD)), drift: sTD && r3(drift), restep: lifted, kd: P._lg.kd.length - kd0 });
    }
    const got = rows.filter((r) => r.moved != null);
    res[name] = { req: req.fwd, accepted: `${rows.filter((r) => r.accepted).length}/${rows.length}`, landed: got.length, movedMean: r3(mean(got.map((r) => r.moved))), ratio: r2(mean(got.map((r) => r.moved)) / req.fwd), driftMaxCm: got.length ? r2(100 * Math.max(...got.map((r) => r.drift))) : null, restep: got.filter((r) => r.restep).length, tdT: r3(mean(got.map((r) => r.tdT))), kd: rows.reduce((a, r) => a + (r.kd || 0), 0) };
    log(`step ${name}`, JSON.stringify(res[name]));
  }
  out.gates.step = res;
  log('SUMMARY step (G10)', JSON.stringify(res));
}

const f = process.env.OUT || path.join(process.env.OUTDIR || os.tmpdir(), `legs_${SUB}_${MODE}.json`);
fs.writeFileSync(f, JSON.stringify(out, null, 1));
log('결과 파일:', f);
