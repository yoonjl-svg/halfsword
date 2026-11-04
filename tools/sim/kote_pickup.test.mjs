// 손목 치기 떨굼 완화 · 떨어진 칼 줍기 시험 (사장님 11/04 '코테는 칼을 더 자주 떨어트리게 해. 단 떨어진 무기를 줍는 동작을 신설하자' —
//  config UNIQUE_ASSIST.koteDrop.ease · PICKUP · src/combat.js koteOn · koteSword · strike · src/pickup.js · 기록 docs/strike/kote_pickup_2026-11-05.md)
//  node --test tools/sim/kote_pickup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { pickupReady, canPickup, swordReachDist } from '../../src/pickup.js';
import { snapshotFighter, applyFighterSnapshot } from '../../src/fight_snapshot.js';

const K = CONFIG.UNIQUE_ASSIST.koteDrop;
const PU = CONFIG.PICKUP;
const keepKote = { ...K };
const keepPU = { ...PU };
const restore = () => { Object.assign(K, keepKote); Object.assign(PU, keepPU); };

function round(weapon = 'longsword', weapon2 = weapon, seed = 3, park = true) {
  const g = newRound({ weapon, weapon2, seed, walls: true });
  if (park) g.park();
  else g.ai.update = () => {};
  return g;
}
/** 플레이어가 칼 쪽으로 걷는 손 (봇 — 칼자루까지 0.45 m 안이면 섬) · press = 막기 단추 */
function walker(g, press = () => false) {
  const P = g.player;
  g.before = () => {
    P.move.set(0, 0);
    P.pickupPress = press(g.t);
    if (!P.armed && !P.pickup && canPickup(P)) {
      const p = P.bodies.pelvis.translation(), s = P.sword.translation();
      const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.45) { const F = P.forward(), R = P.right(); P.move.set(((dx * R.x + dz * R.z) / d) * 0.6, ((dx * F.x + dz * F.z) / d) * 0.6); }
    }
    P.stickX = P.move.x; P.stickY = P.move.y;
  };
}
const run = (g, s) => { for (let i = 0; i < s / DT; i++) g.step(); };

test('기본값: 손목 치기 떨굼 완화 켬(ease 1 · 2 J · 0.4 s · 1.5 m/s — 확률 · 부위 · 사람만 · 한 번은 그대로) · 줍기 끔(mode 0 · ai 0)', () => {
  assert.deepEqual([K.ease, K.easeE, K.easeAfter, K.easeVn, K.p, K.ai, K.once, K.judge, K.swordVn, K.swordHalf], [1, 2, 0.4, 1.5, 0.5, 0, 1, 'all', 3, 0.5]);
  assert.deepEqual([PU.mode, PU.ai, PU.reach, PU.bend, PU.lift], [0, 0, 0.6, 0.4, 0.2]);
  assert.ok([0.3, 0.45, 0.6, 0.9].includes(PU.reach), '걸음 사다리');
  assert.ok([0.2, 0.4, 0.6].includes(PU.bend) && [0.2, 0.4, 0.6].includes(PU.lift), '시간 사다리');
  assert.ok(CONFIG.SECRET.stance.pickup.drop > 0);
});

test('완화: 판정 문턱(6 J) 밑 아래팔 닿음도 easeE 넘으면 굴림 · ease 0 이면 10/24 판 그대로 · 손목 치기 아닌 긋기는 아님', () => {
  const g = round('monohoshizao', 'longsword', 9, false);
  try {
    const P = g.player, E = g.enemy, C = g.combat;
    g.step();
    const pr = C.pairOf(P.bladeColliders[0].handle, E.bodies.farmS.collider(0).handle);
    assert.ok(pr && pr.v.part === 'farmS');
    const point = new THREE.Vector3().copy(E.bodies.farmS.translation());
    const hit = (E0) => { C.analyze = () => ({ energy: E0, type: 'blunt', severity: 0, absorb: 0, mFree: 0.3 }); E.hitCooldowns.clear(); return C.strike(pr, point, false); };
    K.p = 1e-9; // 굴림만 셈 (떨구지 않음)
    P.artTech = 'kote';
    assert.equal(hit(3), null, '판정은 그대로 없음 (6 J 밑)');
    assert.equal(C.koteLog?.length, 1, '3 J — 굴림');
    hit(1.5);
    assert.equal(C.koteLog.length, 1, '1.5 J (easeE 밑) — 아님');
    K.ease = 0; P.artTech = 'zornhau'; hit(3); P.artTech = 'kote';
    assert.equal(C.koteLog.length, 1, 'ease 0 · 다른 긋기 — 아님');
    hit(3);
    assert.equal(C.koteLog.length, 1, 'ease 0 — 10/24 판(6 J 밑은 굴리지 않음)');
  } finally { restore(); g.world.free(); }
});

test('완화: 손목 치기 긋기가 끝난 뒤 easeAfter(0.4 실제 s) 안 닿음도 · 다음 긋기 · 탭이 시작되면 아님 · 칼 반쪽 문턱 1.5 m/s', () => {
  const g = round('monohoshizao', 'longsword', 9, false);
  try {
    const P = g.player, E = g.enemy, C = g.combat;
    K.p = 1e-9;
    const cut = { type: 'cut', severity: 0.2 };
    P.skill.uniq = { cur: null, r: null, last: { unique: 'kote', tEnd: 1.0 }, t: 1.3, stats: { strokes: 1 } };
    C.koteCheck(P, E, 'farmS', cut);
    assert.equal(C.koteLog?.length, 1, '끝난 뒤 0.3 s');
    P.skill.uniq.last = { unique: 'kote', tEnd: 1.0 }; P.skill.uniq.t = 1.5;
    C.koteCheck(P, E, 'farmS', cut);
    assert.equal(C.koteLog.length, 1, '끝난 뒤 0.5 s — 아님');
    P.skill.uniq.t = 1.3; P.skill.uniq.cur = { unique: null }; // (0.2 s 안이면 strokeTechOf 가 그대로 손목 치기라 0.3 s 로)
    C.koteCheck(P, E, 'farmS', cut);
    assert.equal(C.koteLog.length, 1, '다음 긋기가 시작됨 — 아님');
    P.skill.uniq.cur = null; K.ease = 0;
    C.koteCheck(P, E, 'farmS', cut);
    assert.equal(C.koteLog.length, 1, 'ease 0 — strokeTechOf 의 0.2 s 창만');
    K.ease = 1;
    // 칼 반쪽: 맞부딪는 빠르기 2 m/s — 완화 켬이면 굴림 · 끔이면 아님
    P.skill.uniq = { cur: { unique: 'kote' }, last: null, t: 0, stats: { strokes: 2 } };
    const clash = (vn) => {
      const point = E.bladePoint(0.2), c = P.sword.translation();
      const nrm = new THREE.Vector3(point.x - c.x, point.y - c.y, point.z - c.z).normalize();
      const S = (v) => ({ com: point.clone(), w: new THREE.Vector3(), v });
      C.koteSword({ fighter: P }, { fighter: E }, S(nrm.clone().multiplyScalar(2)), S(new THREE.Vector3()), point, nrm, vn);
    };
    clash(1.2);
    assert.equal(C.koteLog.length, 1, '1.2 m/s — 문턱 밑');
    clash(2);
    assert.equal(C.koteLog.length, 2, '2 m/s — 굴림');
    P.skill.uniq = { cur: { unique: 'kote' }, last: null, t: 0, stats: { strokes: 3 } };
    K.ease = 0; clash(2);
    assert.equal(C.koteLog.length, 2, 'ease 0 — 3 m/s 문턱');
  } finally { restore(); g.world.free(); }
});

test('줍기 끔(기본): 칼을 놓친 채 · 줍는 상태 없음', () => {
  const g = round();
  try {
    const P = g.player;
    walker(g, () => true);
    run(g, 1); P.dropSword(); run(g, 4);
    assert.equal(P.armed, false); assert.equal(P.pickup ?? null, null); assert.equal(P.pickupLog, undefined);
  } finally { restore(); g.world.free(); }
});

test('줍기 auto: 칼 곁에 가면 저절로 — 웅크려 쥐고 일어섬 · 다시 쥔 칼은 손목에 · 서 있음 · 값 깨짐 없음 · 칼이 순간이동하지 않음', () => {
  const g = round();
  try {
    const P = g.player;
    PU.mode = 'auto';
    walker(g);
    run(g, 1); P.dropSword();
    let maxStep = 0, prev = null, minPelvis = Infinity, crouched = false;
    for (let i = 0; i < 5 / DT && !P.armed; i++) {
      g.step();
      const s = P.sword.translation();
      if (prev) maxStep = Math.max(maxStep, Math.hypot(s.x - prev.x, s.y - prev.y, s.z - prev.z));
      prev = { ...s };
      if (P.pickup?.phase === 'bend') { minPelvis = Math.min(minPelvis, P.bodies.pelvis.translation().y); crouched ||= !!P.secretStance; }
    }
    assert.equal(P.armed, true, '다시 쥠');
    assert.ok(crouched && minPelvis < 0.8, `웅크림 (골반 ${minPelvis.toFixed(2)})`);
    assert.ok(maxStep < 0.12, `한 스텝 칼 옮김 ${maxStep.toFixed(3)} m`);
    run(g, 1);
    const L = P.pickupLog;
    assert.equal(L.length, 1); assert.equal(L[0].ok, true);
    const motion = (L[0].t1 - L[0].t0) / CONFIG.TIME.k;
    assert.ok(motion > 0.3 && motion < 0.7, `동작 ${motion.toFixed(2)} 실제 s (굽힘 0.4 + 올림 0.2)`);
    assert.equal(P.state, 'stand');
    const w = P.bodies.farmS, q = w.rotation(), t = w.translation();
    const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(t.x, t.y, t.z));
    const s = P.sword.translation();
    assert.ok(wrist.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 0.05, '칼자루가 손목에');
    assert.ok(P.swordColliders.every((c) => c.collisionGroups() !== 0), '칼 충돌 되돌림');
    assert.ok([s.x, s.y, s.z].every(Number.isFinite));
  } finally { restore(); g.world.free(); }
});

test('줍기 block: 곁에 서도 단추를 안 누르면 그대로 · 누르면 주움 · 단추 글 = pickupReady', () => {
  const g = round('zweihander');
  try {
    const P = g.player;
    PU.mode = 'block';
    let press = false;
    walker(g, () => press);
    run(g, 1); P.dropSword(); run(g, 3);
    assert.equal(P.armed, false, '안 누름');
    assert.ok(swordReachDist(P) <= PU.reach && pickupReady(P), '곁 — 단추 글 줍기');
    press = true; run(g, 1.5);
    assert.equal(P.armed, true, '누름 — 주움');
    assert.equal(pickupReady(P), false);
  } finally { restore(); g.world.free(); }
});

test('못 주움: 칼 팔 기능이 문턱 밑 · 휘는 마디 무기 · 넘어지면 그만둠(칼은 땅에 · 충돌 그대로)', () => {
  PU.mode = 'auto';
  let g = round();
  try {
    const P = g.player;
    walker(g);
    run(g, 1); P.dropSword(); P.limbs.armS = CONFIG.VITALS.dropSwordArm * 0.5; run(g, 3);
    assert.equal(P.armed, false); assert.equal(canPickup(P), false);
  } finally { g.world.free(); }
  g = round('druid_whip', 'longsword');
  try {
    const P = g.player;
    if (P.flexWeapon) { walker(g); run(g, 1); P.dropSword(); run(g, 3); assert.equal(P.armed, false, '채찍은 줍지 않음'); }
  } finally { g.world.free(); }
  g = round();
  try {
    const P = g.player;
    walker(g);
    run(g, 1); P.dropSword();
    for (let i = 0; i < 5 / DT && P.pickup?.phase !== 'bend'; i++) g.step();
    assert.equal(P.pickup?.phase, 'bend');
    const groups = P.swordColliders.map((c) => c.collisionGroups());
    P.knockDown(true);
    g.step();
    assert.equal(P.pickup ?? null, null); assert.equal(P.armed, false);
    assert.equal(P.pickupLog.at(-1).ok, false); assert.equal(P.pickupLog.at(-1).why, 'down');
    assert.deepEqual(P.swordColliders.map((c) => c.collisionGroups()), groups);
  } finally { restore(); g.world.free(); }
});

test('AI 줍기: ai 1 이면 칼을 놓친 AI 가 걸어가 주움 · ai 0 이면 그대로(물러남)', () => {
  for (const ai of [1, 0]) {
    const g = newRound({ weapon: 'longsword', seed: 4, walls: true });
    try {
      PU.ai = ai;
      run(g, 3); g.enemy.dropSword(); run(g, 6);
      assert.equal(g.enemy.armed, !!ai, `ai ${ai}`);
      if (ai) assert.equal(g.enemy.pickupLog?.at(-1)?.ok, true);
    } finally { restore(); g.world.free(); }
  }
});

test('몸 사본(이어하기): 칼을 놓친 채면 disarmed · 줍기 켠 몸만 새 판도 놓친 채 시작 · 끔이면 칼을 쥔 채(오늘)', () => {
  const body = (over = {}) => ({ weapon: { id: 'longsword', fragile: true }, blood: 1, bleed: 0, consciousness: 1, pain: 0, limbs: { armS: 1, armO: 1, legF: 1, legB: 1 }, wounds: [], weaponBroken: false, stamina: { value: 100, max: 130 }, secretUsed: 0, armed: true, human: true, dropSword() { this.armed = false; }, ...over });
  const s = JSON.parse(JSON.stringify(snapshotFighter(body({ armed: false }))));
  assert.equal(s.disarmed, true);
  assert.equal(snapshotFighter(body()).disarmed, undefined, '쥔 몸은 칸 없음 (옛 꼴 그대로)');
  try {
    const a = body(); applyFighterSnapshot(a, s); assert.equal(a.armed, true, '줍기 끔 — 칼을 쥔 채');
    PU.mode = 'block';
    const b = body(); applyFighterSnapshot(b, s); assert.equal(b.armed, false, '줍기 켬 — 놓친 채');
    const c = body({ human: false }); applyFighterSnapshot(c, s); assert.equal(c.armed, true, 'AI 몸은 PICKUP.ai');
    PU.ai = 1;
    const d = body({ aiControlled: true }); applyFighterSnapshot(d, s); assert.equal(d.armed, false);
  } finally { restore(); }
  // 실제 몸: 놓친 채 시작한 판에서 주움
  const g = round();
  try {
    PU.mode = 'auto';
    applyFighterSnapshot(g.player, s);
    assert.equal(g.player.armed, false);
    walker(g); run(g, 5);
    assert.equal(g.player.armed, true);
    assert.equal(snapshotFighter(g.player).disarmed, undefined, '주운 뒤 사본은 쥔 몸');
  } finally { restore(); g.world.free(); }
});
