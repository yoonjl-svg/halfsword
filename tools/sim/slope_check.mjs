// slope_check.mjs — 화산섬(etna) 비탈 이식 검증 도구 (필요할 때 돌림 · 관문 아님 — 사장님 10/14 21:1x '새 몸놀림마다 비탈에서도 맨날 시험할 필요는 없다')
//  docs/import/volcano_port_2026-10-14.md §4. 실제 Fighter·Gait·Combat·AI·Rapier 를 jelly_harness 의 지형 갈래(opts.stageId 'etna')로 돌려 읽기만 한다
//  (몸을 옮기거나 힘·속도·자세를 덮어쓰지 않는다 — 일어서기 시험의 넘어뜨리기·AI 밀기 시험의 충격만 시험 장치).
//   node tools/sim/slope_check.mjs [--only=surface,gait,lava,ai,fx,reach] [--out=/tmp/slope.json]
//  · surface : Rapier 아래 방향 광선 ↔ 땅 계약(heightAt·normalAt) 이 같은 삼각형인지
//  · gait    : 샛별 53188ff8 의 걸음 14 조건(가만히 위·아래 · 오르막 · 내리막 · 가로 · 옆 오르막·내리막 · 위쪽 오르막 · 일어서기 위·아래 · 완만·가파른 자리 가만히·일어서기)
//              — 문턱도 샛별 그대로(발 접촉 > 90 % · 서 있음 100 % · 땅 위 골반 0.72~1.12 m · 기울기 < 40° · 발바닥 침투 < 45 mm · 나아감 · 가만히 미끄럼 < 0.15 m · 8 s 안 일어섬)
//              샛별이 그쪽 판에서 잰 값(발 접촉 ≥ 94.81 % · 침투 ≤ 10.81 mm · 기울기 ≤ 27.69°)과 우리 판 값을 나란히 적는다
//  · lava    : 화상 '약하게'(사장님 결정 10/14) — 감지 경계 · 칼/잘린 부위 무효 · 다리 하나만 · 겹침 없음 · 60/120 Hz 같음 · 벗어나면 멈춤 · 팔 → 칼 놓침 · 사망 없음 · 실제 걸어 들어가 무릎
//  · ai      : 용암 피하기(내리막 요청 돌림·기술 걸음 취소·용암 밖) · 밀리면 들어감(보이지 않는 벽 아님) · 무릎 꿇은 채 용암 속 상대를 끝내는지
//  · fx      : 땅 기준으로 바꾼 효과·판정 — 핏방울이 비탈에 앉고 용암에서 사라짐 · 오르막에서 쓰러진 상대의 마무리 진입 높이
//  · reach   : 간격표는 수평 거리 — 비탈에서 두 가슴 높낮이 차와 실제 3 차원 거리 (AI 대 AI, 보고만)
import fs from 'node:fs';
import { newRound, THREE, DT, AI, RAPIER } from './jelly_harness.mjs';
import { GROUND_GROUPS } from '../../src/fighter.js';
import { GAIT } from '../../src/config.js';
import { ETNA, ETNA_TERRAIN, createTerrainGround, applyTerrainHazards } from '../../src/etna_ground.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const b = a.replace(/^--/, ''); const i = b.indexOf('='); return i < 0 ? [b, ''] : [b.slice(0, i), b.slice(i + 1)]; }));
const only = new Set((args.only || 'surface,gait,lava,ai,fx,reach').split(','));
const T = ETNA_TERRAIN;
const report = { surface: null, gait: [], lava: [], ai: [], reach: null, failures: [] };
const fail = (m) => report.failures.push(m);
const check = (ok, m) => { if (!ok) fail(m); return ok; };
const close = (G) => { G.eventQueue.free(); G.world.free(); };
const gradeAt = (x, z) => { const n = T.normalAt(x, z); return (Math.atan2(Math.hypot(n.x, n.z), n.y) * 180) / Math.PI; };
const relH = (p) => p.y - T.heightAt(p.x, p.z);
const f1 = (x) => (Number.isFinite(x) ? +x.toFixed(1) : x);
const f3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : x);
const v3 = new THREE.Vector3();
// AI·상처의 Math.random 을 장면 씨앗으로 고정 (fights12 와 같은 꼴) — 같은 명령이면 같은 숫자
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const round = (o) => { seedRand(o.seed ?? 1); return newRound(o); };

// ── surface ──
if (only.has('surface')) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const env = createTerrainGround(RAPIER, world, GROUND_GROUPS, T, { walls: false });
  world.step();
  let n = 0, maxDy = 0, maxDn = 0;
  // 0.5 m 칸마다 두 삼각형 안쪽 한 점씩 (칸의 대각선 위는 두 면이 만나 법선이 정해지지 않으므로 피한다)
  const pts = [];
  for (let x0 = -6.5; x0 < 6.5; x0 += 0.5) for (let z0 = -6.5; z0 + 0.5 <= 5.0; z0 += 0.5) pts.push([x0 + 0.12, z0 + 0.14], [x0 + 0.37, z0 + 0.39]);
  for (const [x, z] of pts) {
    if (x * x + z * z > 6.5 * 6.5) continue;
    const hit = world.castRayAndGetNormal(new RAPIER.Ray({ x, y: 10, z }, { x: 0, y: -1, z: 0 }), 30, true, undefined, undefined, env.lava, undefined, (c) => c.handle === env.floor.handle);
    if (!hit) { fail(`surface: 광선이 땅을 못 맞춤 (${x}, ${z})`); continue; }
    const y = 10 - hit.timeOfImpact;
    const nn = T.normalAt(x, z);
    maxDy = Math.max(maxDy, Math.abs(y - T.heightAt(x, z)));
    maxDn = Math.max(maxDn, Math.abs(hit.normal.x - nn.x), Math.abs(hit.normal.y - nn.y), Math.abs(hit.normal.z - nn.z));
    n++;
  }
  let gsum = 0, gn = 0, gmin = 99, gmax = 0;
  for (let x = -6.5; x <= 6.5; x += 0.1) for (let z = -6.5; z <= ETNA.lavaEdgeZ; z += 0.1) {
    if (x * x + z * z > 6.5 * 6.5) continue;
    const g = gradeAt(x, z); gsum += g; gn++; gmin = Math.min(gmin, g); gmax = Math.max(gmax, g);
  }
  world.free();
  report.surface = { rays: n, maxHeightError: maxDy, maxNormalError: maxDn, grade: { mean: gsum / gn, min: gmin, max: gmax, samples: gn } };
  check(maxDy < 1e-4 && maxDn < 1e-3, `surface: 광선 ↔ 땅 계약 차 높이 ${maxDy} · 법선 ${maxDn}`);
  console.log(`surface  광선 ${n} · 높이 차 최대 ${maxDy.toExponential(2)} m · 법선 차 최대 ${maxDn.toExponential(2)} · 기울기 평균 ${f1(gsum / gn)}° (${f1(gmin)}~${f1(gmax)}°, 0.1 m 표본 ${gn})`);
}

// ── gait: 샛별 14 조건 ──
if (only.has('gait')) {
  const seed = 73021;
  const ext = { shallow: null, steep: null };
  for (let x = -4.75; x <= 4.75; x += 0.25) for (let z = -4.75; z <= 3.5; z += 0.25) {
    if (x * x + z * z > 4.75 * 4.75) continue;
    const s = { x, z, grade: gradeAt(x, z) };
    if (!ext.shallow || s.grade < ext.shallow.grade) ext.shallow = s;
    if (!ext.steep || s.grade > ext.steep.grade) ext.steep = s;
  }
  const cases = [
    { name: 'idle-high', z: -2, heading: 0, move: [0, 0] },
    { name: 'idle-low', z: 2, heading: 0, move: [0, 0] },
    { name: 'uphill', z: 1, heading: Math.PI / 2, move: [0, 0.5] },
    { name: 'downhill', z: -2, heading: -Math.PI / 2, move: [0, 0.5] },
    { name: 'across', z: 0, heading: 0, move: [0, 0.5] },
    { name: 'side-uphill', z: 1, heading: 0, move: [-0.5, 0] },
    { name: 'side-downhill', z: -2, heading: 0, move: [0.5, 0] },
    { name: 'upper-mountainside-uphill', z: -3.5, heading: Math.PI / 2, move: [0, 0.5] },
    { name: 'getup-high', z: -2, heading: 0, move: [0, 0], recovery: true },
    { name: 'getup-low', z: 2, heading: 0, move: [0, 0], recovery: true },
    ...['shallow', 'steep'].flatMap((band) => [
      { name: `idle-${band}-grade`, x: ext[band].x, z: ext[band].z, grade: ext[band].grade, heading: 0, move: [0, 0] },
      { name: `getup-${band}-grade`, x: ext[band].x, z: ext[band].z, grade: ext[band].grade, heading: 0, move: [0, 0], recovery: true },
    ]),
    // 우리 판 더함: 샛별 일어서기 조건(가슴 55 N·s)은 비탈에서 몸이 다 눕기 전에 일어서기로 넘어가는 판이 있어(아래 '누움' 칸), 120 N·s 로 실제로 땅에 눕힌 뒤 일어서기를 한 번 더 본다
    { name: 'getup-fall-high', z: -2, heading: 0, move: [0, 0], recovery: true, impulse: 120, mustLie: true },
    { name: 'getup-fall-low', z: 2, heading: 0, move: [0, 0], recovery: true, impulse: 120, mustLie: true },
    { name: 'getup-fall-shallow-grade', x: ext.shallow.x, z: ext.shallow.z, grade: ext.shallow.grade, heading: 0, move: [0, 0], recovery: true, impulse: 120, mustLie: true },
    { name: 'getup-fall-steep-grade', x: ext.steep.x, z: ext.steep.z, grade: ext.steep.grade, heading: 0, move: [0, 0], recovery: true, impulse: 120, mustLie: true },
  ];
  for (const spec of cases) {
    const G = round({ seed, walls: false, stageId: 'etna', gap: spec.x === undefined ? undefined : -2 * spec.x, playerZ: spec.z, enemyZ: -20, heading: spec.heading });
    G.parkEnemy = true; // 멀리 선 상대의 AI 만 끈다 (몸은 옮기지 않는다)
    const f = G.player;
    let i = 0, start, endMove, firstGetup = null, firstStand = null, sup = 0, meas = 0, standing = 0;
    let minH = Infinity, maxH = -Infinity, maxTilt = 0, minSole = Infinity, lowest = Infinity;
    G.before = () => {
      f.faceTarget = null;
      f.move.set(...(i < 360 || i >= 720 ? [0, 0] : spec.move));
      if (spec.recovery && i === 360) { f.knockDown(true); f.bodies.chest.applyImpulse({ x: spec.impulse ?? 55, y: 0, z: 0 }, true); }
    };
    const ticks = spec.recovery ? 1200 : 960;
    for (i = 0; i < ticks; i++) {
      G.step();
      const p = f.bodies.pelvis.translation();
      const h = relH(p);
      if (i === 359) start = { ...p };
      if (i === 719) endMove = { ...p };
      if (spec.recovery && f.state === 'getup' && firstGetup === null) firstGetup = i;
      if (firstGetup !== null && f.state === 'stand' && firstStand === null) firstStand = i;
      if (spec.recovery && i >= 360 && firstStand === null) lowest = Math.min(lowest, h); // 넘어진 뒤 일어서기 전까지 땅 위 골반 최저 (실제로 누웠나)
      if (spec.recovery ? i >= 960 : i >= 420) {
        meas++;
        if (f.gait.groundForce(f.gait.legs.F) + f.gait.groundForce(f.gait.legs.B) > 1) sup++;
        if (f.state === 'stand') standing++;
        minH = Math.min(minH, h); maxH = Math.max(maxH, h); maxTilt = Math.max(maxTilt, f.tiltDeg());
        for (const foot of ['footF', 'footB']) minSole = Math.min(minSole, relH(f.solePoint(foot, v3)));
      }
      if (!Number.isFinite(h) || !f.alive) { fail(`gait ${spec.name}: 값이 깨지거나 죽음 (스텝 ${i})`); break; }
    }
    const end = f.bodies.pelvis.translation();
    const ix = Math.cos(spec.heading) * spec.move[1] + Math.sin(spec.heading) * spec.move[0];
    const iz = -Math.sin(spec.heading) * spec.move[1] + Math.cos(spec.heading) * spec.move[0];
    const dl = Math.hypot(ix, iz);
    const progress = dl ? ((endMove.x - start.x) * ix + (endMove.z - start.z) * iz) / dl : 0;
    const row = { name: spec.name, x: spec.x ?? null, z: spec.z, grade: spec.grade, impulse: spec.recovery ? spec.impulse ?? 55 : null, lowest: spec.recovery ? lowest : null, progress, support: sup / meas, standing: standing / meas, minH, maxH, maxTilt, minSole, firstGetup, firstStand, drift: Math.abs(end.z - start.z) };
    report.gait.push(row);
    check(row.support > 0.9, `gait ${spec.name}: 발 접촉 ${row.support}`);
    check(row.standing === 1 && minH > 0.72 && maxH < 1.12 && maxTilt < 40, `gait ${spec.name}: 자세·받침 범위 (서 있음 ${row.standing} · 골반 ${f3(minH)}~${f3(maxH)} · 기울기 ${f1(maxTilt)})`);
    check(minSole > -0.045, `gait ${spec.name}: 발바닥 침투 ${f3(minSole)}`);
    if (dl) check(progress > (spec.move[0] ? 0.6 : 2), `gait ${spec.name}: 나아감 ${f3(progress)} m`);
    if (spec.name.startsWith('idle')) check(row.drift < 0.15, `gait ${spec.name}: 가만히 미끄럼 ${f3(row.drift)} m`);
    if (spec.recovery) check(firstGetup !== null && firstStand !== null && firstStand < 960, `gait ${spec.name}: 8 s 안에 못 일어섬`);
    if (spec.mustLie) check(lowest < 0.4, `gait ${spec.name}: 실제로 눕지 않음 (골반 최저 ${f3(lowest)} m)`);
    close(G);
  }
  const sb = report.gait.filter((r) => !r.name.startsWith('getup-fall'));
  const worst = { support: Math.min(...sb.map((r) => r.support)), sole: -Math.min(...sb.map((r) => r.minSole)), tilt: Math.max(...sb.map((r) => r.maxTilt)) };
  report.gaitWorst = worst;
  console.log('gait     이름                         나아감  발접촉   서있음  골반(땅위)       기울기  침투mm  일어섬(s)  누움(골반 최저)');
  for (const r of report.gait) console.log(`         ${r.name.padEnd(28)} ${String(f3(r.progress)).padStart(6)}  ${(r.support * 100).toFixed(1).padStart(5)}%  ${(r.standing * 100).toFixed(0).padStart(4)}%  ${f3(r.minH)}~${f3(r.maxH)}  ${String(f1(r.maxTilt)).padStart(5)}°  ${(-r.minSole * 1000).toFixed(1).padStart(5)}  ${r.firstStand !== null ? ((r.firstStand - 360) * DT).toFixed(2) : '—'}${r.lowest !== null ? `  ${f3(r.lowest)} m (${r.impulse} N·s)` : ''}${r.grade !== undefined ? `  (자리 ${f1(r.grade)}°)` : ''}`);
  console.log(`         샛별 14 조건 가장 나쁜 값: 발 접촉 ${(worst.support * 100).toFixed(2)} % (샛별 ≥ 94.81) · 발바닥 침투 ${(worst.sole * 1000).toFixed(2)} mm (샛별 ≤ 10.81) · 몸 기울기 ${worst.tilt.toFixed(2)}° (샛별 ≤ 27.69)`);
}

// ── lava ──
if (only.has('lava')) {
  // (1) 감지 장치: 작은 상자 몸 + 가짜 싸움꾼(샛별 hazard 시험과 같은 꼴) — 실제 applyTerrainHazards 를 부른다
  const fixture = ({ above = -0.001, parts = ['footF'], kind = 'body', detached = false, dt = DT } = {}) => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = dt;
    const env = createTerrainGround(RAPIER, world, GROUND_GROUPS, T, { walls: false });
    const f = {
      state: 'stand', pain: 0, blood: 1, bleed: 0, wounds: [], bodies: {}, limbs: { legF: 1, legB: 1, armS: 1, armO: 1 }, detachedParts: new Set(detached ? parts : []), armed: true, revival: null, dropped: 0, died: 0,
      get alive() { return this.state !== 'dead'; },
      get legHealth() { return (this.limbs.legF + this.limbs.legB) / 2; },
      get legsCannotSupport() { return this.legHealth < 0.25 || (!!this.lavaBurn && this.lavaBurn.legs.some((k) => this.limbs[k] < 0.25)); },
      knockDown() { if (this.state === 'stand') this.state = 'getup'; }, dropSword() { this.armed = false; this.dropped++; }, die() { this.died++; this.state = 'dead'; },
    };
    const info = new Map();
    for (const [i, part] of parts.entries()) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(i * 0.1, ETNA.lavaLevel + 0.02 + above, 6));
      const col = world.createCollider(RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.02).setCollisionGroups(GROUND_GROUPS), body);
      f.bodies[part] = body;
      info.set(col.handle, { fighter: f, kind, part, body });
    }
    return { f, tick() { world.step(); return applyTerrainHazards(env, info, dt); }, close() { world.free(); } };
  };
  const L = (name, ok, detail = '') => { report.lava.push({ name, ok, detail }); check(ok, `lava ${name} ${detail}`); };
  for (const [name, opts, burn] of [['감지 경계: 용암면 1 mm 위는 화상 없음', { above: 0.001 }, false], ['감지 경계: 1 mm 아래 발 → 화상', {}, true], ['머리가 닿아도 화상만 (사망 없음)', { parts: ['head'] }, true], ['칼만 닿으면 화상 없음', { kind: 'weapon', parts: ['blade'] }, false], ['잘린 팔은 화상 없음', { parts: ['farmO'], detached: true }, false]]) {
    const q = fixture(opts);
    q.tick();
    const ok = q.f.alive && !!q.f.lavaBurn === burn && (!burn || (q.f.pain > 0 && q.f.blood === 1 && q.f.bleed === 0 && q.f.wounds[0]?.type === 'burn' && q.f.wounds[0]?.bleed === 0));
    L(name, ok, `화상 ${!!q.f.lavaBurn} 통증 ${f3(q.f.pain)}`);
    q.close();
  }
  { const q = fixture(); for (let i = 0; i < 120; i++) q.tick(); L('닿은 다리만 기능 감소 · 무릎 전이 · 부위마다 상처 하나', q.f.alive && q.f.state === 'getup' && q.f.limbs.legF === 0 && q.f.limbs.legB === 1 && q.f.wounds.length === 1 && q.f.pain >= 1, `legF ${f3(q.f.limbs.legF)} legB ${q.f.limbs.legB} 상처 ${q.f.wounds.length}`); q.close(); }
  { const q = fixture(); let t25 = null; for (let i = 0; i < 120 && t25 === null; i++) { q.tick(); if (q.f.limbs.legF < 0.25) t25 = (i + 1) * DT; } L('다리 0.25 문턱까지 시간', t25 !== null && t25 < 0.3, `${t25?.toFixed(3)} s`); q.close(); }
  { const a = fixture(), b = fixture({ parts: ['footF', 'shinF', 'thighF'] }); for (let i = 0; i < 12; i++) { a.tick(); b.tick(); } L('한 다리 여러 마디가 닿아도 겹쳐 세지 않음', Math.abs(a.f.limbs.legF - b.f.limbs.legF) < 1e-10, `${f3(a.f.limbs.legF)} / ${f3(b.f.limbs.legF)}`); a.close(); b.close(); }
  { const a = fixture({ dt: 1 / 60 }), b = fixture({ dt: 1 / 120 }); for (let i = 0; i < 12; i++) a.tick(); for (let i = 0; i < 24; i++) b.tick(); L('60 / 120 Hz 같은 피해', Math.abs(a.f.limbs.legF - b.f.limbs.legF) < 1e-6, `${f3(a.f.limbs.legF)} / ${f3(b.f.limbs.legF)}`); a.close(); b.close(); }
  { const q = fixture(); for (let i = 0; i < 60; i++) q.tick(); const leg = q.f.limbs.legF; const p = q.f.bodies.footF.translation(); q.f.bodies.footF.setTranslation({ ...p, y: p.y + 2 }, true); for (let i = 0; i < 600; i++) q.tick(); L('벗어나면 피해 멈춤 · 잃은 기능은 그대로', q.f.alive && q.f.limbs.legF === leg && q.f.lavaBurn.inLava === false, `legF ${f3(leg)} → ${f3(q.f.limbs.legF)}`); q.close(); }
  { const q = fixture({ parts: ['farmS'] }); for (let i = 0; i < 60; i++) q.tick(); L('칼 든 팔이 0.15 아래면 칼을 놓침 (기존 문턱)', q.f.dropped === 1 && !q.f.armed, `armS ${f3(q.f.limbs.armS)}`); q.close(); }
  { const q = fixture({ parts: ['footF', 'head', 'chest'] }); for (let i = 0; i < Math.round(20 / DT); i++) q.tick(); L('20 s 계속 닿아도 사망 없음 (약하게)', q.f.alive && q.f.died === 0 && q.f.pain <= 2, `통증 ${f3(q.f.pain)} 접촉 ${f1(q.f.lavaBurn.contactTime)} s`); q.close(); }
  // (2) 실제 싸움꾼: 용암 속에서 시작 — 양쪽 같은 규칙
  for (const who of ['player', 'enemy']) {
    const G = round({ seed: 24, stageId: 'etna', playerZ: who === 'player' ? 6 : 0, enemyZ: who === 'enemy' ? 6 : 0 });
    for (let i = 0; i < 3; i++) G.step();
    const f = G[who];
    L(`실제 ${who === 'player' ? '플레이어' : '상대'} 첫 닿음: 살아 있고 화상·통증·출혈 0`, f.alive && !!f.lavaBurn && f.pain > 0 && f.wounds.some((w) => w.type === 'burn') && f.bleed === 0 && f.blood === 1, `통증 ${f3(f.pain)}`);
    close(G);
  }
  // (3) 실제 내리막 조종 입력으로 걸어 들어가 무릎 (위치·피해를 넣지 않음)
  {
    const G = round({ seed: 31, stageId: 'etna', heading: -Math.PI / 2, enemyZ: -20 });
    G.parkEnemy = true;
    G.faceP = { x: -2.8, y: 0, z: 100 };
    const f = G.player;
    let contact = null, before = 0, lowest = Infinity, legMin = 1, atTwo = null, atTen = null, i = 0;
    G.before = () => f.move.set(0, i < 240 || contact !== null ? 0 : 1);
    for (i = 0; i < 4000; i++) {
      G.step();
      const h = relH(f.bodies.pelvis.translation());
      if (!f.lavaBurn) before = h;
      if (f.lavaBurn && contact === null) contact = G.t;
      if (contact !== null) {
        lowest = Math.min(lowest, h); legMin = Math.min(legMin, f.legHealth);
        if (!atTwo && G.t - contact >= 2) atTwo = { state: f.state, alive: f.alive, kneel: f.kneelAmount, h, legHealth: f.legHealth, red: Math.min(1, f.pain) * 0.35 };
        if (!atTen && G.t - contact >= 10) { atTen = { state: f.state, alive: f.alive, pain: f.pain, legF: f.limbs.legF, legB: f.limbs.legB, armS: f.limbs.armS, armed: f.armed, cause: f.causeOfDeath ?? null }; break; }
      }
    }
    const ok = contact !== null && atTwo?.alive && atTwo.kneel > 0.9 && before - lowest > 0.18 && legMin < 0.65 && atTwo.red > 0.3 && atTen?.alive;
    report.lavaWalk = { contactSeconds: contact, pelvisBefore: before, pelvisLowest: lowest, atTwo, atTen };
    L('실제 걸어 들어감: 2 s 뒤 무릎·골반 내려앉음·붉은 가장자리, 10 s 뒤에도 살아 있음', !!ok, `닿음 ${contact?.toFixed(2)} s · 골반 ${f3(before)} → ${f3(lowest)} m · 2 s ${atTwo?.state} 무릎 ${f3(atTwo?.kneel)} · 10 s ${atTen?.state} 살아있음 ${atTen?.alive}`);
    close(G);
  }
  console.log('lava     ' + report.lava.map((r) => `${r.ok ? '○' : '×'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n         '));
}

// ── ai ──
if (only.has('ai')) {
  const A = (name, ok, detail = '') => { report.ai.push({ name, ok, detail }); check(ok, `ai ${name} ${detail}`); };
  const desiredZ = (f) => (f.move.x * GAIT.sideFactor * Math.cos(f.heading) - f.move.y * (f.move.y < 0 ? GAIT.backFactor : 1) * Math.sin(f.heading)) * GAIT.moveSpeed;
  // (1) 칼 놓은 상대가 내리막(물가 가까이)에 가만히 — 실제 AI 가 다가가며 내리막 요청을 돌리는지 (샛별 AI 시험과 같은 꼴, 시드 251)
  {
    const G = round({ seed: 251, stageId: 'etna', playerZ: 4.4, enemyZ: 3.2, gap: 2.5, heading: Math.PI / 2, heading2: -Math.PI / 2 });
    G.player.dropSword();
    let redirects = 0, before = 0, active = false, maxZ = -Infinity, reqAfter = null, cancels = 0;
    const uc = G.ai.updateCombat.bind(G.ai);
    G.ai.updateCombat = (dt) => { uc(dt); before = desiredZ(G.enemy); active = G.enemy.alive && G.enemy.state === 'stand' && !G.enemy.feetHeld; reqAfter = G.enemy.gait?.req ?? null; };
    G.before = () => { if (active && before > 0.01 && desiredZ(G.enemy) < -0.01) redirects++; if (reqAfter && !G.enemy.gait?.req) cancels++; reqAfter = null; };
    for (let i = 0; i < 720; i++) { G.step(); maxZ = Math.max(maxZ, G.enemy.bodies.pelvis.translation().z); }
    report.aiApproach = { redirects, cancels, maxZ, state: G.enemy.state, burned: !!G.enemy.lavaBurn };
    A('다가가며 내리막 요청을 돌림 · 용암 밖에 남음', redirects > 0 && G.enemy.alive && !G.enemy.lavaBurn && maxZ < ETNA.lavaEdgeZ, `돌림 ${redirects} 번 · 기술 걸음 취소 ${cancels} 번 · 골반 최대 z ${f3(maxZ)} (물가 ${ETNA.lavaEdgeZ})`);
    close(G);
  }
  // (1b) 물가 가까이 선 상대(칼 든 채 가만히)를 실제 AI 가 칠 때 — 내리막 기술 걸음 취소 셈 · AI 는 용암 밖 (상대 z 3.9 · 4.7 — 4.7 은 AI 가 닿으려면 경고 띠 안으로 들어와야 하는 자리)
  for (const pz of [3.9, 4.7]) {
    const G = round({ seed: 252, stageId: 'etna', playerZ: pz, enemyZ: pz - 1.6, gap: 1.6, heading: Math.PI / 2, heading2: -Math.PI / 2 });
    let reqAfter = null, cancels = 0, maxZ = -Infinity, hits = 0;
    const uc = G.ai.updateCombat.bind(G.ai);
    G.ai.updateCombat = (dt) => { uc(dt); reqAfter = G.enemy.gait?.req ?? null; };
    G.before = () => { if (reqAfter && !G.enemy.gait?.req) cancels++; reqAfter = null; };
    for (let i = 0; i < Math.round(12 / DT) && G.player.alive; i++) { G.step(); maxZ = Math.max(maxZ, G.enemy.bodies.pelvis.translation().z); }
    hits = G.hits.filter((h) => h.startsWith('E->')).length;
    (report.aiStrike ??= []).push({ playerZ: pz, cancels, maxZ, hits, burned: !!G.enemy.lavaBurn, playerAlive: G.player.alive });
    A(`물가 가까이(z ${pz}) 선 상대를 치는 동안 용암 밖`, !G.enemy.lavaBurn && maxZ < ETNA.lavaEdgeZ, `기술 걸음 취소 ${cancels} 번 · AI 골반 최대 z ${f3(maxZ)} · AI 가 낸 상처 ${hits} · 상대 ${G.player.alive ? '살아 있음' : `죽음(${G.player.causeOfDeath})`}`);
    close(G);
  }
  // (2) 밖에서 민 충격(시험 장치 — 특정 기술의 힘이 아님): 보이지 않는 보호벽이 아니라 들어가고, 덴 뒤 무릎 · 사망 없음
  {
    const G = round({ seed: 251, stageId: 'etna', playerZ: 0, enemyZ: 3.6, gap: 2.5, heading2: Math.PI / 2 });
    let pushed = false, beforeState = null, contactAt = null, maxZ = -Infinity, kneelAt = null, alive10 = null;
    G.before = () => {
      if (pushed || G.t < 2.1) return;
      pushed = true;
      beforeState = G.enemy.state;
      for (const body of new Set([...Object.values(G.enemy.bodies), G.enemy.sword])) body.applyImpulse({ x: 0, y: 0, z: body.mass() * 7 }, true);
    };
    for (let i = 0; i < 2400; i++) {
      G.step();
      maxZ = Math.max(maxZ, G.enemy.bodies.pelvis.translation().z);
      if (G.enemy.lavaBurn && contactAt === null) contactAt = G.t;
      if (contactAt !== null && kneelAt === null && (G.enemy.state === 'getup' || G.enemy.state === 'kneel' || G.enemy.state === 'down')) kneelAt = G.t;
      if (contactAt !== null && G.t - contactAt > 10) { alive10 = G.enemy.alive; break; }
    }
    report.aiPush = { beforeState, contactAt, maxZ, kneelAt, alive10, state: G.enemy.state, cause: G.enemy.causeOfDeath ?? null, legs: [G.enemy.limbs.legF, G.enemy.limbs.legB] };
    A('밀리면 물가를 넘어 들어감 (보이지 않는 벽 아님)', pushed && beforeState === 'stand' && maxZ > ETNA.lavaEdgeZ && contactAt !== null, `골반 최대 z ${f3(maxZ)} · 닿음 ${contactAt?.toFixed(2)} s`);
    A('덴 뒤 넘어짐/무릎, 10 s 뒤에도 용암으로 죽지 않음', kneelAt !== null && (alive10 === true || (alive10 === false && G.enemy.causeOfDeath !== '용암')), `상태 ${G.enemy.state} · 살아있음 ${alive10} · 사망 원인 ${G.enemy.causeOfDeath ?? '—'}`);
    close(G);
  }
  // (3) 플레이어가 용암에 걸어 들어가 무릎 꿇은 뒤 — AI(상대)가 30 s 안에 끝내는가 (약하게 규칙의 남는 위험: 꿇은 채 판이 길어짐) · 보고만.
  //  상대는 옆(+x)에 세워 두고 AI 를 끈 채(몸은 그대로) 플레이어만 걸어 들어간다. 플레이어가 무릎 꿇고 2 s 뒤 AI 를 켠다
  for (const seed of [31, 32, 33]) {
    const G = round({ seed, stageId: 'etna', heading: -Math.PI / 2, playerZ: 2.5, enemyZ: -1, gap: 3 });
    G.parkEnemy = true;
    G.faceP = { x: -1.5, y: 0, z: 100 };
    const f = G.player;
    let contact = null, i = 0, aiOn = null, deathAt = null, minD = Infinity, eMaxZ = -Infinity;
    G.before = () => { f.move.set(0, i < 240 || contact !== null ? 0 : 1); };
    for (i = 0; i < Math.round(45 / DT); i++) {
      G.step();
      if (f.lavaBurn && contact === null) contact = G.t;
      if (aiOn === null && contact !== null && G.t - contact > 2) { G.parkEnemy = false; G.faceP = null; aiOn = G.t; }
      if (aiOn !== null) {
        const a = f.bodies.chest.translation(), b = G.enemy.bodies.chest.translation();
        minD = Math.min(minD, Math.hypot(b.x - a.x, b.z - a.z));
        eMaxZ = Math.max(eMaxZ, G.enemy.bodies.pelvis.translation().z);
        if (G.t - aiOn > 30) break;
      }
      if (!f.alive) { deathAt = G.t; break; }
    }
    const rowDetail = `플레이어 닿음 ${contact?.toFixed(1)} s · ${f.state} · AI 켬 뒤 ${deathAt !== null ? `${(deathAt - aiOn).toFixed(1)} s 에 ${f.causeOfDeath}` : '30 s 안에 못 끝냄'} · 가슴 수평 거리 최소 ${f3(minD)} m · AI 골반 최대 z ${f3(eMaxZ)} · AI 화상 ${!!G.enemy.lavaBurn}`;
    report.ai.push({ name: `용암 속 무릎 꿇은 플레이어를 AI 가 끝내나 (시드 ${seed})`, ok: true, detail: rowDetail, report: true, finished: deathAt !== null, seconds: deathAt !== null ? deathAt - aiOn : null, minD, eMaxZ, aiBurned: !!G.enemy.lavaBurn });
    close(G);
  }
  console.log('ai       ' + report.ai.map((r) => `${r.report ? '·' : r.ok ? '○' : '×'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`).join('\n         '));
}

// ── fx: 땅 기준으로 바꾼 효과·판정 (핏방울 · 마무리 진입 높이) ──
if (only.has('fx')) {
  const { Particles } = await import('../../src/effects.js');
  const { lowFinishPosture, LOW_FINISH } = await import('../../src/finish_entry.js');
  const rows = [];
  // (1) 핏방울: 오르막 땅(z −4)에 떨어지면 그 땅 위에 얼룩으로 앉고, 용암면 밑으로 들어가면 사라진다
  {
    const P = new Particles(new THREE.Scene());
    P.terrain = T;
    P.add(new THREE.Vector3(0.3, T.heightAt(0.3, -4) + 0.5, -4), new THREE.Vector3(0, 0, 0), 0x8a0000, 0.02, 3, true);
    P.add(new THREE.Vector3(0.3, ETNA.lavaLevel + 0.5, 6), new THREE.Vector3(0, 0, 0), 0x8a0000, 0.02, 3, true);
    for (let i = 0; i < 120; i++) P.update(1 / 60);
    const it = P.list[0];
    const ok = P.list.length === 1 && it.stuck && Math.abs(it.p.y - (T.heightAt(it.p.x, it.p.z) + 0.002)) < 1e-6;
    rows.push({ name: '핏방울: 비탈에 앉고 용암에서 사라짐', ok, detail: `남은 입자 ${P.list.length} · 얼룩 높이 − 땅 ${f3(it ? it.p.y - T.heightAt(it.p.x, it.p.z) : NaN)} m` });
  }
  // (2) 마무리 진입 높이: 오르막 자리에서 쓰러진 상대 — 땅 높이를 빼야 낮은 몸으로 읽힌다 (빼지 않으면 땅이 0.7 m 높아 못 연다)
  {
    const G = round({ seed: 61, stageId: 'etna', playerZ: -4.2, enemyZ: -4.2, gap: 3 });
    G.parkEnemy = true;
    G.faceP = { x: 10, y: 0, z: -4.2 };
    for (let i = 0; i < 60; i++) G.step();
    G.enemy.knockDown(true);
    G.enemy.bodies.chest.applyImpulse({ x: 120, y: 0, z: 0 }, true); // 실제로 눕히는 넘어뜨리기 (시험 장치 — 일어서기 'getup-fall' 과 같은 세기)
    G.player.foe = G.enemy;
    const e = G.enemy;
    let got = null, minRel = Infinity;
    for (let i = 0; i < 480 && !got; i++) {
      G.step();
      G.player.foe = G.enemy;
      const top = Math.max(e.bodies.chest.translation().y, e.bodies.pelvis.translation().y);
      const pp = e.bodies.pelvis.translation();
      const rel = top - T.heightAt(pp.x, pp.z);
      if (e.state === 'down') minRel = Math.min(minRel, rel);
      // 누운 몸(땅 위 꼭대기가 진입 높이보다 0.1 m 넘게 낮음)이 되는 첫 스텝에서 두 판정을 견준다
      if (e.state === 'down' && rel < LOW_FINISH.enterHeight - 0.1) {
        got = { rel, ground: T.heightAt(pp.x, pp.z), now: lowFinishPosture(G.player, e), flatRule: top <= LOW_FINISH.enterHeight && top + LOW_FINISH.minimumDrop < G.player.bodies.chest.translation().y, t: G.t };
      }
    }
    rows.push({ name: '마무리 진입: 오르막에서 쓰러진 상대가 낮은 몸으로 읽힘', ok: !!got && got.now === true && got.flatRule === false, detail: got ? `땅 ${f3(got.ground)} m · 몸 꼭대기 땅 위 ${f3(got.rel)} m · 지금 판정 ${got.now} · 땅 안 뺀 판정 ${got.flatRule}` : `누운 몸이 안 됨 (down 중 땅 위 꼭대기 최저 ${f3(minRel)} m)` });
    close(G);
  }
  report.fx = rows;
  for (const r of rows) check(r.ok, `fx ${r.name} ${r.detail}`);
  console.log('fx       ' + rows.map((r) => `${r.ok ? '○' : '×'} ${r.name} (${r.detail})`).join('\n         '));
}

// ── reach: 간격표(수평 거리) ↔ 비탈의 높낮이 차 (AI 대 AI · 보고만) ──
if (only.has('reach')) {
  const rows = [];
  for (const [label, o] of [['내리막 쪽(+z)과 오르막 쪽(−z)', { gap: 0.6, playerZ: -1.4, enemyZ: 1.4, heading: -Math.PI / 2, heading2: Math.PI / 2 }], ['가로(같은 높이)', { gap: 2.8, playerZ: -0.5, enemyZ: -0.5 }]]) {
    for (const seed of [41, 42]) {
      const G = round({ seed, stageId: 'etna', ...o });
      G.ai2 = new AI(G.player, G.enemy, 'normal');
      let n0 = 0;
      for (let i = 0; i < Math.round(20 / DT) && G.player.alive && G.enemy.alive; i++) {
        G.step();
        if (G.hits.length > n0) {
          n0 = G.hits.length;
          const a = G.player.bodies.chest.translation(), b = G.enemy.bodies.chest.translation();
          const d = Math.hypot(b.x - a.x, b.z - a.z), dy = b.y - a.y;
          rows.push({ label, seed, d, dy, d3: Math.hypot(d, dy), hit: G.hits[n0 - 1] });
        }
      }
      close(G);
    }
  }
  const slope = rows.filter((r) => r.label.startsWith('내리막'));
  const level = rows.filter((r) => !r.label.startsWith('내리막'));
  const stat = (rs) => rs.length ? { hits: rs.length, meanAbsDy: rs.reduce((s, r) => s + Math.abs(r.dy), 0) / rs.length, maxAbsDy: Math.max(...rs.map((r) => Math.abs(r.dy))), meanExtra: rs.reduce((s, r) => s + (r.d3 - r.d), 0) / rs.length, maxExtra: Math.max(...rs.map((r) => r.d3 - r.d)), meanD: rs.reduce((s, r) => s + r.d, 0) / rs.length } : { hits: 0 };
  report.reach = { slope: stat(slope), level: stat(level), rows };
  for (const [k, s] of [['비탈 위아래', report.reach.slope], ['가로', report.reach.level]]) console.log(`reach    ${k}: 닿음 ${s.hits} 번 · 가슴 수평 거리 평균 ${f3(s.meanD)} m · 높낮이 차 평균 ${f3(s.meanAbsDy)} (최대 ${f3(s.maxAbsDy)}) m · 3 차원 − 수평 평균 ${f3(s.meanExtra)} (최대 ${f3(s.maxExtra)}) m`);
}

console.log(report.failures.length ? `\n못 미침 ${report.failures.length} 건:\n  ${report.failures.join('\n  ')}` : '\n못 미침 0');
if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 1));
