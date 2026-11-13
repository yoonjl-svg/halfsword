// 독일 더티복싱 · 붙은 거리 규칙 (11/14 — 기록 docs/strike/de_dirty_2026-11-14.md · 확인표 3740 ~)
//  ① 파고들기 (사장님 11/14 '간격 잡기를 파고들기로 바꿔 … 두 걸음 빠르게 … 거리 제한은 없음' — config GAIT.deDig · gait.js): 두 걸음 · 기력 한 번 · 거리 제한 없음 · G2 몫 · 끄면 옛 간격 잡기 · 다른 유파 · AI 그대로
//  ② 붙은 거리 규칙 (사장님 11/14 '밀치기 기준 1m' · '묶인 1.2초 동안은 아무 공격도 못하고 기력이 2배' · '1m 이내에서는 손잡이 찍기만' · '2초간 다시 강제로 묶이지 않아' — config CLOSE · close_hold.js)
//  ③ 칼 씨름 (사장님 11/14 '1번으로 해' — config DE_DIRTY · de_dirty.js · 기본 켬) · 설계안 B · C 는 사장님 11/14 폐기(시험도 걷어냄)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { newRound, CONFIG } from './harness_m.mjs';
import { digRun } from './de_dig_feel.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { Stamina } from '../../src/stamina.js';
import { closeStartD, closeHoldT, bargeHeld, closeInputGate, closeInputApply, clinchHoldK, closeRulesOn } from '../../src/close_hold.js';
import { deDirtyBody } from '../../src/de_dirty.js';
import { SchoolPassive } from '../../src/school_passive.js';
import { ringRun } from './de_ring_feel.mjs';
import { G as PAD } from '../../src/ai_techniques.js';

const { GAIT, CLOSE, DE_DIRTY, STAMINA, SECRET, realS, TIME } = CONFIG;
const K = TIME.k;
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const withCfg = (obj, patch, fn) => { const keep = Object.fromEntries(Object.keys(patch).map((k) => [k, obj[k]])); Object.assign(obj, patch); try { return fn(); } finally { Object.assign(obj, keep); } };

// ── ① 파고들기 ──
test('기본값: 파고들기 켬 · 두 걸음 · 목표 2.5 m/s (사장님 11/14 결정 · 빠르기는 감독 안) · 붙은 거리 규칙 1.0 m · 1.2 s · × 2 · 2.0 s · 칼자루만 켬 · AI 도 같은 규칙(11/14) · 칼 씨름 켬 · 겹치기 ⓒ · 쌓임 0.4 s', () => {
  assert.equal(GAIT.deDig, 1);
  assert.equal(GAIT.digSteps, 2);
  assert.equal(GAIT.digV, GAIT.burstBackV, '앞 박찬 걸음 목표 = 뒤 박차기와 같은 절대 목표');
  assert.equal(CLOSE.startD, 1.0);
  near(CLOSE.holdMin, realS(1.2));
  assert.equal(CLOSE.holdDrain, 2);
  near(CLOSE.holdCool, realS(2.0));
  assert.equal(CLOSE.holdLock, 1);
  assert.equal(CLOSE.nearHilt, 1);
  assert.equal(CLOSE.startAI, 1.0, 'AI 도 같은 규칙 (사장님 11/14 \'2는 ai도 동일하게\')');
  assert.deepEqual({ ...DE_DIRTY, ringT: 0, ringNoRecover: 0 }, { ring: 1, ringDist: 0.6, ringT: 0, ringNoRecover: 0 }, '칼 씨름 기본 켬 (사장님 11/14 \'1번으로 해\') · B · C 폐기 (11/14)');
  assert.equal(CONFIG.DE_DIRTY_ON, undefined, 'B · C 켤 때 값도 걷어냄');
  near(DE_DIRTY.ringT, realS(1.2)); near(DE_DIRTY.ringNoRecover, realS(2.0)); assert.equal(CONFIG.UNIQUE_ASSIST.dupAuto, 'both', '겹치기 자동 ⓒ (사장님 11/14 \'c로 해\')'); near(CONFIG.UNIQUE_ASSIST.dupStackS, realS(0.4), 1e-9);
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
test('시작 거리: 사람 · AI 1.0 m(무기와 상관없이 — reach 가 더 길면 떨어짐만 reach · 11/14 AI 도) · 끄면 reach · 시뮬 대본 몸은 reach', () => {
  const human = { humanInput: true }, ai = { aiControlled: true }, sim = {};
  assert.equal(closeStartD(human, 0.77), 1.0);
  assert.equal(closeStartD(ai, 0.77), 1.0);
  assert.equal(closeStartD(sim, 0.77), 0.77);
  assert.equal(closeRulesOn(ai), true);
  assert.equal(closeRulesOn(sim), false);
  withCfg(CLOSE, { startD: null }, () => assert.equal(closeStartD(human, 0.77), 0.77));
  withCfg(CLOSE, { startAI: null }, () => { assert.equal(closeStartD(ai, 0.77), 0.77); assert.equal(closeRulesOn(ai), false); });
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

test('묶인 동안 붙어 버티기 기력 × 2 (두 몸 · 스틱을 놓고 안 닿아도) · 묶임 밖 · 밀치기 없음이면 그대로', () => {
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
  withCfg(CLOSE, { holdDrain: 1 }, () => { const g = pair(); g[0].barge = { phase: 'press', hold: 1, holdT: 0 }; clinchStep(g, dt); near(g[0].stamina.spent.clinch, STAMINA.clinchPerSecond * dt, 1e-9); });
});

test('closeHoldT · bargeHeld: 쿨타임 안 0 · 끄면 0 · AI 도(11/14) · AI 를 옛 판으로 돌리면 0 · 시뮬 대본 몸 0', () => {
  assert.ok(Math.abs(closeHoldT({ humanInput: true }) - realS(1.2)) < 1e-9);
  assert.equal(closeHoldT({ humanInput: true, holdCool: 0.5 }), 0);
  assert.ok(Math.abs(closeHoldT({ aiControlled: true }) - realS(1.2)) < 1e-9);
  assert.equal(closeHoldT({}), 0);
  withCfg(CLOSE, { startAI: null }, () => assert.equal(closeHoldT({ aiControlled: true }), 0));
  withCfg(CLOSE, { holdMin: 0 }, () => assert.equal(closeHoldT({ humanInput: true }), 0));
  assert.equal(bargeHeld({ phase: 'step', hold: 1, holdT: 0 }), false);
  assert.equal(bargeHeld({ phase: 'press', hold: 1, holdT: 1 }), false);
  assert.equal(bargeHeld({ phase: 'press', hold: 1, holdT: 0.99 }), true);
});

// ── ③ 칼 씨름 · 그 순간 창 ──
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

test('SECRET 모르트슐라크 붙음 셈은 그대로 (1.5 s · 0.8 m)', () => {
  assert.equal(SECRET.mordCloseN, 0.8);
  near(SECRET.mordPress, realS(1.5));
});

test('칼 씨름 1] (기본 켬): 묶인 동안 상대가 지침(기력 0 아래)이면 묶임을 끝내며 세게 밀침 — 상대가 0.6 m 쯤 물러남(새 동작 없이 물리 밀침 + 균형 걸음) · 1.2 s 무너짐 · 그 순간 창 · 끄면 안 남', () => {
  const on = ringRun({ ring: 1, dur: 1.5 });
  assert.ok(on.tRing != null && on.tRing >= on.tPress, '누르기(묶임) 안에서 남');
  assert.equal(on.indesRing, 1, '그 순간 창');
  const hit = on.rows.filter((r) => r.ring);
  const moved = Math.max(...hit.map((r) => r.moved ?? 0));
  assert.ok(moved >= DE_DIRTY.ringDist && moved < DE_DIRTY.ringDist + 0.3, `물러남 ${moved} m`);
  assert.ok(hit.length * 0.05 >= 1.15 && hit.length * 0.05 <= 1.3, `무너진 시간 ${hit.length * 0.05} s (실제 · 0.05 s 줄 — ringT 1.2 s)`);
  assert.ok(on.dMax > on.dRing + 0.15, `가슴 사이 ${on.dRing} → ${on.dMax} (미는 쪽도 앞으로 흘러 몸 사이는 물러난 거리보다 덜 벌어짐)`);
  const off = ringRun({ ring: 0, dur: 1.5 });
  assert.equal(off.tRing, null);
  assert.equal(off.indesRing, 0);
});

test('칼 씨름: 상대가 지침이 아니면 안 남 · 칼 씨름 몫 열쇠(deRing) 없으면 안 남 · 무너진 동안 칼 손 목표 = 옆 자세(sideR) · AI 는 공격 시작 안 함', async () => {
  const fresh = ringRun({ ring: 1, dur: 1.0, foeStamina: 50 });
  assert.equal(fresh.tRing, null, '상대 기력 50 — 안 남');
  const { ringCheck, ringStep } = await import('../../src/de_dirty.js');
  withCfg(DE_DIRTY, { ring: 1 }, () => {
    const me = { humanInput: true, swordArt: { tradition: 'german' }, skillKit: { deRing: false } };
    assert.equal(ringCheck(me, { alive: true, state: 'stand', stamina: { value: -5 } }), false, 'deRing 없음');
    const f = { alive: true, state: 'stand', move: new Vector2(), handOffset: new Vector2(), bodies: { pelvis: { translation: () => ({ x: 0, z: 0 }) } }, ringHit: { t: 0, T: 1, x0: 0, z0: 0, dx: 1, dz: 0, dMax: 0 } };
    ringStep(f, 0.01);
    assert.deepEqual([f.handOffset.x, f.handOffset.y], PAD.sideR);
    assert.equal(f.stickY, 0, '제 걸음 없음 — 밀린 몸은 균형 걸음으로만');
  });
  const { AI } = await import('../../src/ai.js');
  assert.equal(AI.prototype.startAttack.call({ me: { armed: true, stamina: { exhausted: false }, ringHit: {} }, staminaRest: false }, { name: 'oberhau' }, 'x'), false);
});

test('칼 씨름: 밀려난 상대 기력 회복 2.0 s 막힘 · 그 순간 창은 상대가 무너진 동안 열려 있다 무너짐이 끝나면 닫힘', () => {
  const st = new Stamina({ alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, aiControlled: true, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => ({ x: 0, y: 1, z: 0 }) } } });
  st.value = -10; st.rest = 10; st.noRecover = realS(2.0);
  const dt = 1 / 120;
  for (let t = 0; t < realS(2.0) - 2 * dt; t += dt) st.step(dt);
  assert.ok(Math.abs(st.value + 10) < 1e-9, `막힌 동안 ${st.value}`);
  for (let i = 0; i < 30; i++) st.step(dt);
  assert.ok(st.value > -10, '풀리면 회복');
  const foe = { ringHit: { t: 0 } };
  const f = { alive: true, gait: null, skill: {}, stamina: {} };
  const sp = new SchoolPassive(f);
  sp.set('german');
  sp.ringOpen(foe);
  sp.tickIndes(5);
  assert.ok(sp.win, '상대가 무너진 동안 열림');
  foe.ringHit = null;
  sp.tickIndes(0.01);
  assert.equal(sp.win, null, '무너짐이 끝나면 닫힘');
});

test('칼 씨름 뒤 무너진 상대에게도 밀치기가 다시 나감 (사장님 11/14 \'무너진 상대애게 밀치기가 또 나가야 죽음의알격 가능\' — 지금 규칙 그대로 묶어 둠): 쿨타임 안이라 묶임 없이', () => {
  const r = ringRun({ ring: 1, dur: 1.4, again: true });
  assert.ok(r.tRing != null, '칼 씨름');
  assert.ok(r.again && r.again.shoves >= 1, '무너진 상대에게 새 밀치기');
  assert.equal(r.again.hold, 0, '쿨타임 안 — 묶임 없음');
  assert.ok(r.again.ringHit, '그 밀치기는 무너진 동안 남');
});
