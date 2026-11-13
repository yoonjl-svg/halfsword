// 독일 더티복싱 · 붙은 거리 규칙 (11/14 — 기록 docs/strike/de_dirty_2026-11-14.md · 확인표 3740 ~)
//  ① 파고들기 (사장님 11/14 '간격 잡기를 파고들기로 바꿔 … 두 걸음 빠르게 … 거리 제한은 없음' — config GAIT.deDig · gait.js): 두 걸음 · 기력 한 번 · 거리 제한 없음 · G2 몫 · 끄면 옛 간격 잡기 · 다른 유파 · AI 그대로
//  ② 붙은 거리 규칙 (사장님 11/14 '밀치기 기준 1m' · '묶인 1.2초 동안은 아무 공격도 못하고 기력이 2배' · '1m 이내에서는 손잡이 찍기만' · '2초간 다시 강제로 묶이지 않아' — config CLOSE · close_hold.js)
//  ③ B · C (설계안 — config DE_DIRTY · de_dirty.js · 기본 끔): 끔이면 아무 일 없음 · 켜면 그 몫만
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { newRound, CONFIG } from './harness_m.mjs';
import { digRun } from './de_dig_feel.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { Stamina } from '../../src/stamina.js';
import { closeStartD, closeHoldT, bargeHeld, closeInputGate, closeInputApply, clinchHoldK, closeRulesOn } from '../../src/close_hold.js';
import { deDirtyBody, mordDoorTick, openDoor, clinchRate, shoveLanded } from '../../src/de_dirty.js';
import { SchoolPassive } from '../../src/school_passive.js';

const { GAIT, CLOSE, DE_DIRTY, DE_DIRTY_ON, STAMINA, SECRET, realS, TIME } = CONFIG;
const K = TIME.k;
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const withCfg = (obj, patch, fn) => { const keep = Object.fromEntries(Object.keys(patch).map((k) => [k, obj[k]])); Object.assign(obj, patch); try { return fn(); } finally { Object.assign(obj, keep); } };

// ── ① 파고들기 ──
test('기본값: 파고들기 켬 · 두 걸음 · 목표 2.5 m/s (사장님 11/14 결정 · 빠르기는 감독 안) · 붙은 거리 규칙 1.0 m · 1.2 s · × 2 · 2.0 s · 칼자루만 켬 · AI 견줌 끔 · B · C 끔', () => {
  assert.equal(GAIT.deDig, 1);
  assert.equal(GAIT.digSteps, 2);
  assert.equal(GAIT.digV, GAIT.burstBackV, '앞 박찬 걸음 목표 = 뒤 박차기와 같은 절대 목표');
  assert.equal(CLOSE.startD, 1.0);
  near(CLOSE.holdMin, realS(1.2));
  assert.equal(CLOSE.holdDrain, 2);
  near(CLOSE.holdCool, realS(2.0));
  assert.equal(CLOSE.holdLock, 1);
  assert.equal(CLOSE.nearHilt, 1);
  assert.equal(CLOSE.startAI, null, 'AI 는 지금 판 (관문 그대로)');
  assert.deepEqual({ ...DE_DIRTY }, { armSlow: 0, clinchK: 1, door: 0, mordIndes: 0 }, 'B · C 기본 끔');
  near(DE_DIRTY_ON.armSlow, realS(0.6)); assert.equal(DE_DIRTY_ON.clinchK, 0.5); near(DE_DIRTY_ON.door, realS(0.6)); assert.equal(DE_DIRTY_ON.mordIndes, 1);
});

test('파고들기 몸: 서서 앞으로 세게 밀면 박찬 앞 걸음 둘(× digV ÷ 앞 걷는 빠르기 · 파고들기 걸음 표시) · 기력 pushCost 한 번 · 셋째 걸음은 보통 · 넘어지지 않음 · 보통 걸음보다 1 m 에 빨리 닿음', () => {
  const dig = digRun({ mode: 'dig', gap: 2.6, dur: 1.2 });
  const walk = digRun({ mode: 'walk', gap: 2.6, dur: 1.2 });
  assert.equal(dig.digs, 1);
  assert.equal(dig.digSteps, 2);
  const kF = GAIT.digV / GAIT.moveSpeed;
  assert.deepEqual(dig.steps.slice(0, 3).map((s) => [s.dig, s.fastK]), [[true, +kF.toFixed(3)], [true, +kF.toFixed(3)], [false, 1]]);
  near(dig.push, STAMINA.pushCost, 1e-9);
  assert.equal(dig.fell, false);
  assert.equal(walk.digs, 0);
  assert.equal(walk.push, 0);
  assert.ok(dig.t10 < walk.t10 - 0.2, `1 m 에 닿는 시간 파고들기 ${dig.t10} s · 보통 ${walk.t10} s`);
});

test('거리 제한 없음: 칼 거리(measure.contact) 근처에서 시작해도 서지 않음(잡기 없음 · 그 안으로 더 들어감) — 옛 간격 잡기(deDig 0)는 칼 거리에서 섬', () => {
  const dig = digRun({ mode: 'dig', gap: 2.0, dur: 0.9 });
  const old = digRun({ mode: 'chase', gap: 2.0, dur: 0.9 });
  assert.equal(dig.held, false, '파고들기는 잡기(deHold)를 안 검');
  assert.equal(dig.digSteps, 2);
  assert.equal(old.held, true, '옛 간격 잡기는 칼 거리에서 잡음');
  assert.ok(dig.dx06 > old.dx06 + 0.1, `0.6 s 에 간 거리 파고들기 ${dig.dx06} · 옛 ${old.dx06}`);
});

test('스킬트리 G2(몫 열쇠 chase — 이름만 파고들기) 없으면 안 남 · 뒤로 · 옆으로 밀면 안 남 · 끄면(deDig 0) 안 남', () => {
  const kitG1 = kitFromNodes('german', new Set(['G1']));
  const run = (kit, stick, side = 0) => {
    const G = newRound({ weapon: 'longsword', seed: 3, kit, gap: 2.6, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    try {
      G.ai.update = () => {};
      const P = G.player, g = P.gait;
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.6) / CONFIG.PHYSICS.timestep); i++) G.step();
      for (let i = 0; i < 600 && !(g.legs.F.stance && g.legs.B.stance && Math.hypot(g.vf.x, g.vf.z) < 0.1); i++) G.step();
      for (let i = 0; i < 200; i++) { P.move.set(side, stick); P.stickX = side; P.stickY = stick; G.step(); }
      return g.digs;
    } finally { G.world.free(); }
  };
  assert.equal(run(kitG1, 1), 0, 'G1 만');
  assert.equal(run(kitFromNodes('german', new Set(['G1', 'G2'])), 1), 1, 'G1 + G2');
  assert.equal(run(kitFromNodes('german', new Set(['G1', 'G2'])), -1), 0, '뒤로 = 뒤 박차기');
  assert.equal(run(kitFromNodes('german', new Set(['G1', 'G2'])), 0.3, 0.9), 0, '옆 몫이 큼');
  assert.equal(run(kitFromNodes('german', new Set(['G1', 'G2'])), 0.5), 0, 'burstStick 아래 (살짝 밀기)');
  withCfg(GAIT, { deDig: 0 }, () => assert.equal(run(kitFromNodes('german', new Set(['G1', 'G2'])), 1), 0, '끔'));
});

test('옛 간격 잡기: 사람(humanInput)은 거둠 · 끄면(deDig 0) 사람도 받을 창 · AI · 시뮬 몸은 늘 그대로', () => {
  const G = newRound({ weapon: 'longsword', seed: 3, kit: kitFromNodes('german', allNodeIds('german')) });
  try {
    for (let i = 0; i < 300; i++) G.step();
    const P = G.player;
    P.gait.active = true; P.foeDistance = () => 9;
    P.gait.foeWhiff();
    assert.ok(P.gait.chase, '시뮬 몸(사람 입력 표 없음) — 그대로');
    P.gait.chase = null; P.humanInput = true;
    P.gait.foeWhiff();
    assert.equal(P.gait.chase, null, '사람 — 거둠');
    withCfg(GAIT, { deDig: 0 }, () => { P.gait.foeWhiff(); assert.ok(P.gait.chase, '끄면 사람도 옛 판'); });
  } finally { G.world.free(); }
});

test('다른 유파 · AI: 서서 앞으로 세게 밀어도 파고들기 없음 — 몸 길이 파고들기 켬 · 끔 바이트 같음', () => {
  for (const [weapon, school] of [['rapier', 'italian'], ['uchigatana', 'japanese']]) {
    const path = (dig) => withCfg(GAIT, { deDig: dig }, () => {
      const G = newRound({ weapon, seed: 5, kit: kitFromNodes(school, allNodeIds(school)), gap: 2.6, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
      try {
        G.ai.update = () => {};
        const P = G.player;
        const xs = [];
        for (let i = 0; i < 400; i++) { if (i > 250) { P.move.set(0, 1); P.stickX = 0; P.stickY = 1; } G.step(); if (i % 10 === 0) xs.push(P.bodies.pelvis.translation().x); }
        return { xs, digs: P.gait.digs };
      } finally { G.world.free(); }
    });
    const a = path(0), b = path(1);
    assert.equal(b.digs, 0, school);
    assert.deepEqual(a.xs, b.xs, `${school} 몸 길 같음`);
  }
});

// ── ② 붙은 거리 규칙 ──
test('시작 거리: 사람 1.0 m(무기와 상관없이 — reach 가 더 길면 떨어짐만 reach) · 끄면 reach · AI · 시뮬 몸은 reach(견줌 startAI 를 켜면 그 거리)', () => {
  const human = { humanInput: true }, ai = { aiControlled: true }, sim = {};
  assert.equal(closeStartD(human, 0.77), 1.0);
  assert.equal(closeStartD(ai, 0.77), 0.77);
  assert.equal(closeStartD(sim, 0.77), 0.77);
  withCfg(CLOSE, { startD: null }, () => assert.equal(closeStartD(human, 0.77), 0.77));
  withCfg(CLOSE, { startAI: 1.0 }, () => { assert.equal(closeStartD(ai, 0.77), 1.0); assert.equal(closeRulesOn(ai), true); assert.equal(closeRulesOn(sim), false); });
  assert.equal(closeRulesOn(ai), false);
});

/** 실제 몸 밀치기 장면: 사람(롱소드 · 무유파 아님)이 상대(AI 끔 — 서 있음)를 가슴 사이 d0 에서 앞으로 민다 */
function shoveScene(fn, { gap = 0.85, seed = 4 } = {}) {
  const G = newRound({ weapon: 'longsword', seed, gap, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  try {
    G.ai.update = () => {};
    const P = G.player;
    P.canShove = true;
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.4) / CONFIG.PHYSICS.timestep); i++) G.step();
    const push = (y) => { P.move.set(0, y); P.stickX = 0; P.stickY = y; };
    return fn({ G, P, A: G.enemy, push });
  } finally { G.world.free(); }
}

test('실제 몸 — 1.0 m 안에서 밀면 밀치기가 남(옛 판 reach 0.77 은 아직 안 남) · 누르기에 들면 묶임 1.2 s: 스틱을 놓아도 안 끝남 → 묶임이 풀리면 끝 · 쿨타임 2.0 s 안 새 밀치기는 묶임 없음', () => {
  shoveScene(({ G, P, push }) => {
    let d = P.foeDistance();
    assert.ok(d > 0.8 && d < 1.0, `시작 가슴 사이 ${d}`);
    withCfg(CLOSE, { startD: null }, () => { push(0.9); G.step(); assert.equal(P.shoves, 0, '옛 판 — 닿는 거리 밖'); });
    push(0.9);
    let tPress = null;
    for (let i = 0; i < 400 && tPress == null; i++) { G.step(); if (P.barge?.phase === 'press') tPress = G.t; }
    assert.ok(P.shoves >= 1 && tPress != null, '밀치기 → 누르기');
    assert.ok(P.barge.hold > 0);
    push(0); // 스틱 놓음 — 묶인 동안은 안 끝남
    let tEnd = null;
    for (let i = 0; i < 600 && tEnd == null; i++) { G.step(); if (!P.barge) tEnd = G.t; }
    assert.ok(tEnd != null, '묶임이 풀리면 끝');
    const held = (tEnd - tPress) / K;
    assert.ok(held >= 1.2 - 0.02 && held < 1.2 + 0.1, `묶인 시간 ${held.toFixed(3)} s (실제)`);
    assert.equal(P.bargeEnd, 'release');
    assert.ok(P.closeLog.trap.release > 0, '갇힘(스틱 놓음이 먹지 않은 시간)을 셈');
    assert.ok(P.holdCool > 0, '쿨타임');
    push(0.9);
    for (let i = 0; i < 200 && !P.barge; i++) G.step();
    if (P.barge && P.foeDistance() <= 1.0) assert.equal(P.barge.hold, 0, '쿨타임 안 새 밀치기 — 묶임 없음');
    d = P.foeDistance();
  });
});

test('끄면(holdMin 0 · startD null) 밀치기 셈은 옛 판: 묶임 없음 · 스틱을 놓으면 그 스텝에 끝(release)', () => {
  withCfg(CLOSE, { startD: null, holdMin: 0 }, () => shoveScene(({ G, P, push }) => {
    push(0.9);
    for (let i = 0; i < 600 && P.barge?.phase !== 'press'; i++) G.step();
    assert.equal(P.barge?.phase, 'press');
    assert.equal(P.barge.hold, 0);
    push(0);
    G.step();
    assert.equal(P.barge, null);
    assert.equal(P.bargeEnd, 'release');
  }, { gap: 0.75 }));
});

test('입력 문: 묶인 동안 lock(비기 창도 안 씀) · 묶임 밖 1.0 m 안 = 칼자루만(공격 → 손잡이 찍기 · 모르트슐라크 창만 비기 허용) · 넘어진 상대 곁 · 총 · AI 는 아님', () => {
  const mk = (d, o = {}) => ({ humanInput: true, alive: true, state: 'stand', armed: true, weapon: { hiltLength: 0.13 }, foeDistance: () => d, foe: { alive: true, state: 'stand' }, barge: null, skill: { pommel() { this.n = (this.n ?? 0) + 1; return true; } }, ...o });
  const heldBarge = { phase: 'press', hold: 1, holdT: 0.5 };
  let g = closeInputGate(mk(0.9, { barge: heldBarge }), { S: { name: 'mordschlag' } });
  assert.deepEqual(g, { lock: true, near: false, secretOk: true });
  g = closeInputGate(mk(0.9), { S: { name: 'goNoSen' } });
  assert.deepEqual(g, { lock: false, near: true, secretOk: false });
  assert.equal(closeInputGate(mk(0.9), { S: { name: 'mordschlag' } }).secretOk, true);
  assert.equal(closeInputGate(mk(1.1), null).near, false);
  assert.equal(closeInputGate(mk(0.9, { foe: { alive: true, state: 'down' } }), null).near, false, '넘어진 상대 — 마무리는 그대로');
  assert.equal(closeInputGate(mk(0.9, { weapon: { gun: true } }), null).near, false);
  assert.deepEqual(closeInputGate(mk(0.9, { humanInput: undefined, aiControlled: true }), null), { lock: false, near: false, secretOk: true });
  withCfg(CLOSE, { nearHilt: 0 }, () => assert.equal(closeInputGate(mk(0.9), null).near, false));
  // 바꿈: 칼자루만 — 공격 입력이면 찍기 · 손가락 버림 / 느린 끌기는 그대로 / 묶임 — 다 버림
  const f = mk(0.9);
  const d = { x: 0.1, y: 0.2 };
  assert.equal(closeInputApply(f, { lock: false, near: true }, d, 1, false, 1 / 60), true);
  assert.equal(f.skill.n, 1);
  assert.deepEqual(d, { x: 0, y: 0 });
  const d2 = { x: 0.01, y: 0 };
  assert.equal(closeInputApply(f, { lock: false, near: true }, d2, 0, false, 1 / 60), false, '느린 끌기(자세 옮김)는 그대로');
  assert.deepEqual(d2, { x: 0.01, y: 0 });
  const d3 = { x: 0.3, y: 0 };
  assert.equal(closeInputApply(f, { lock: true, near: false }, d3, 1, true, 1 / 60), true);
  assert.equal(f.skill.n, 1, '묶인 동안 찍기도 안 남');
  assert.deepEqual(d3, { x: 0, y: 0 });
  assert.ok(f.closeLog.lockAtk === 1 && f.closeLog.nearAtk === 1);
});

function pair(german = [false, false]) {
  const fs = german.map((de) => {
    const position = { x: 0, y: 1, z: 0 };
    const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, humanInput: true, swordArt: { tradition: de ? 'german' : 'italian' },
      move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false },
      canShove: true, stickY: 0, barge: null, foeDistance: () => 0.5, closeTouch: () => false, bodies: { pelvis: { translation: () => position } }, position };
    f.stamina = new Stamina(f);
    f.stamina.value = 80;
    return f;
  });
  [fs[0].foe, fs[1].foe] = [fs[1], fs[0]];
  return fs;
}
const clinchStep = (fs, dt) => { for (const f of fs) f.stamina.stepClinch(dt); };

test('묶인 동안 붙어 버티기 기력 × 2 (두 몸 · 스틱을 놓고 안 닿아도) · 묶임 밖 · 밀치기 없음이면 그대로 · B2(독일 × 0.5)는 그 위에 독일 몸만', () => {
  const dt = 1 / 120;
  const fs = pair();
  fs[0].barge = { phase: 'press', hold: 1, holdT: 0.2 };
  assert.equal(clinchHoldK(fs[0], fs[1]), 2);
  clinchStep(fs, dt);
  for (const f of fs) near(f.stamina.spent.clinch, STAMINA.clinchPerSecond * 2 * dt, 1e-9);
  fs[0].barge.holdT = 1.1; // 묶임 풀림 · 스틱 놓음 · 안 닿음 → 붙어 버티기 아님
  const before = fs.map((f) => f.stamina.spent.clinch);
  clinchStep(fs, dt);
  assert.deepEqual(fs.map((f) => f.stamina.spent.clinch), before);
  withCfg(DE_DIRTY, { clinchK: 0.5 }, () => {
    const g = pair([true, false]);
    g[0].barge = { phase: 'press', hold: 1, holdT: 0 };
    assert.equal(clinchRate(g[0]), 0.5); assert.equal(clinchRate(g[1]), 1);
    clinchStep(g, dt);
    near(g[0].stamina.spent.clinch, STAMINA.clinchPerSecond * 2 * 0.5 * dt, 1e-9);
    near(g[1].stamina.spent.clinch, STAMINA.clinchPerSecond * 2 * dt, 1e-9);
  });
  withCfg(CLOSE, { holdDrain: 1 }, () => { const g = pair(); g[0].barge = { phase: 'press', hold: 1, holdT: 0 }; clinchStep(g, dt); near(g[0].stamina.spent.clinch, STAMINA.clinchPerSecond * dt, 1e-9); });
});

test('closeHoldT · bargeHeld: 쿨타임 안 0 · 끄면 0 · AI 는 견줌일 때만', () => {
  assert.ok(Math.abs(closeHoldT({ humanInput: true }) - realS(1.2)) < 1e-9);
  assert.equal(closeHoldT({ humanInput: true, holdCool: 0.5 }), 0);
  assert.equal(closeHoldT({ aiControlled: true }), 0);
  withCfg(CLOSE, { startAI: 1.0 }, () => assert.ok(closeHoldT({ aiControlled: true }) > 0));
  withCfg(CLOSE, { holdMin: 0 }, () => assert.equal(closeHoldT({ humanInput: true }), 0));
  assert.equal(bargeHeld({ phase: 'step', hold: 1, holdT: 0 }), false);
  assert.equal(bargeHeld({ phase: 'press', hold: 1, holdT: 1 }), false);
  assert.equal(bargeHeld({ phase: 'press', hold: 1, holdT: 0.99 }), true);
});

// ── ③ B · C ──
test('B · C 끔(기본): 독일 사람 몸이어도 문 · 팔 늦춤 · 창이 안 생김 · 기력 배율 1', () => {
  const f = { humanInput: true, swordArt: { tradition: 'german' }, alive: true, armed: true, state: 'stand' };
  const foe = { alive: true, armed: true, state: 'stand', stamina: { time: 0, attackId: 0 } };
  assert.equal(deDirtyBody(f, 'deClinch'), true);
  assert.equal(deDirtyBody(f, 'deHilt'), true);
  shoveLanded(f, foe);
  assert.equal(foe.flowRecovery, undefined);
  assert.equal(f.mordDoor, undefined);
  openDoor(f, 'dup');
  assert.equal(f.mordDoor, undefined);
  assert.equal(clinchRate(f), 1);
  assert.equal(deDirtyBody({ ...f, aiControlled: true, humanInput: undefined }, 'deClinch'), false, 'AI 아님');
  assert.equal(deDirtyBody({ ...f, swordArt: { tradition: 'italian' } }, 'deClinch'), false);
  assert.equal(deDirtyBody({ ...f, skillKit: { deClinch: false, deHilt: true } }, 'deClinch'), false, 'B 몫 열쇠 없으면 B 아님');
  assert.equal(deDirtyBody({ ...f, skillKit: { deClinch: false, deHilt: true } }, 'deHilt'), true, 'C 는 제 열쇠');
  // 새 몫 열쇠(새 칸 자리 대기)는 지금 G9 '그 순간'을 익히면 함께 켜짐 (임시 이음)
  const k9 = kitFromNodes('german', new Set(['G1', 'G2', 'G9']));
  assert.ok(k9.passive && k9.deClinch && k9.deHilt);
  const k2 = kitFromNodes('german', new Set(['G1', 'G2']));
  assert.ok(!k2.deClinch && !k2.deHilt);
});

test('B1 · C1 켬: 밀치기가 듦 → 상대 두 팔 0.6 s 늦춤 · 문(shove 는 거리와 상관없이 · dup 은 붙은 거리 안) · 문 시계 0.6 s', () => {
  withCfg(DE_DIRTY, { ...DE_DIRTY_ON, clinchK: 1, mordIndes: 0 }, () => {
    const f = { humanInput: true, swordArt: { tradition: 'german' } };
    const foe = { alive: true, armed: true, state: 'stand', stamina: { time: 3, attackId: 0 } };
    shoveLanded(f, foe);
    near(foe.flowRecovery.duration, realS(0.6));
    assert.equal(f.mordDoor.kind, 'shove');
    assert.ok(mordDoorTick(f, 0.1, false), 'shove 문 — 거리와 상관없이');
    assert.equal(mordDoorTick(f, realS(0.6), false), null, '0.6 s 지나면 닫힘');
    openDoor(f, 'dup');
    assert.equal(mordDoorTick(f, 0.01, false), null, 'dup 문 — 붙은 거리 밖');
    assert.ok(mordDoorTick(f, 0.01, true), 'dup 문 — 붙은 거리 안');
    // 밀치기 묶임 동안은 문 시계가 멈추고 창을 안 엶 (묶인 1.2 s 는 공격 못 함 — 풀린 뒤 0.6 s)
    shoveLanded(f, foe);
    f.barge = { phase: 'press', hold: 1, holdT: 0.1 };
    assert.equal(mordDoorTick(f, 5, false), null);
    assert.ok(f.mordDoor && Math.abs(f.mordDoor.t - realS(0.6)) < 1e-9, '시계 멈춤');
    f.barge = null;
    assert.ok(mordDoorTick(f, 0.1, false), '풀린 뒤 문');
  });
});

test('C2 켬: 모르트슐라크가 머리에 듦 → 그 순간 창(mord) · 비기가 도는 동안 시계 멈춤 · 끝나면 0.6 s · 한 비기에 한 번 · 끄면 안 열림', () => {
  const mk = () => {
    const f = { humanInput: true, alive: true, swordArt: { tradition: 'german' }, skill: { sec: { mord: {} } }, stamina: { inSecret: true } };
    const sp = new SchoolPassive(f);
    sp.set('german');
    return { f, sp };
  };
  { const { sp } = mk(); sp.deHit('head'); assert.equal(sp.win, null, '끔'); }
  withCfg(DE_DIRTY, { mordIndes: 1 }, () => {
    const { f, sp } = mk();
    sp.deHit('chest');
    assert.equal(sp.win, null, '머리가 아님');
    sp.deHit('head');
    assert.ok(sp.win?.mord);
    sp.win = null; sp.deHit('head');
    assert.equal(sp.win, null, '한 비기에 한 번');
    f.skill.sec = { mord: {} };
    sp.deHit('head');
    sp.tickIndes(5);
    assert.ok(sp.win, '비기 동안 멈춤');
    f.skill.sec = null; f.stamina.inSecret = false;
    sp.tickIndes(realS(0.6) * 0.9);
    assert.ok(sp.win);
    sp.tickIndes(realS(0.6) * 0.2);
    assert.equal(sp.win, null, '비기 뒤 0.6 s 에 닫힘');
  });
});

test('그 순간 창 시계: 파고들기 박찬 앞 걸음(digStep) 동안 멈춤 — 간격 잡기 빠른 디딤과 같은 규칙', () => {
  const g = { fastK: 1.375, chaseStep: false, digStep: true, hold: null };
  const f = { alive: true, gait: g, skill: {}, stamina: {} };
  const sp = new SchoolPassive(f);
  sp.set('german');
  sp.foeFailed('whiff');
  sp.tickIndes(5);
  assert.ok(sp.win?.chase, '멈춤');
  g.fastK = 1; g.digStep = false;
  sp.tickIndes(0.01);
  assert.ok(sp.win && !sp.win.chase, '걸음이 끝나면 남은 시계');
});

test('SECRET 모르트슐라크 붙음 셈은 그대로 (1.5 s · 0.8 m — 빠른 문은 더하는 길)', () => {
  assert.equal(SECRET.mordCloseN, 0.8);
  near(SECRET.mordPress, realS(1.5));
});
