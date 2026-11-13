// 일본 기다리는 중전차 (11/14 — 사장님 '기다림과 침을 단순히 시간이 아닌 스택 시스템으로 … 최대 10스택 중첩 +80%' · '낮은 걸음 … 밀치기에 기력이 소모되는 않는'):
//  config JP_TANK · src/school_passive.js(스택 · B1 · E) · src/jp_tank.js(낮은 걸음) · src/secret.js(C) · 기록 docs/strike/jp_tank_2026-11-14.md
//  실제 물리 몸(harness_m)에서 스택 셈 · 배율 · 스위치를 본다. 판의 크기는 tools/sim/jp_tank.mjs. 시간 상한 · '몇 초 안에' 기준 없음
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { lowShoveFree } from '../../src/jp_tank.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { fightOne } from './school_balance.mjs';
const JT = CONFIG.JP_TANK;
const SP = CONFIG.SCHOOL_PASSIVE;
const UA = CONFIG.UNIQUE_ASSIST;
const J0 = { ...JT };
const restore = () => Object.assign(JT, J0);

/** 사람(humanInput) 일본 몸 weapon · 상대 롱소드(AI 멈춤) · 판 시작 정지 지남 */
function fixture(weapon = 'uchigatana', { human = true, ...opts } = {}) {
  const g = newRound({ weapon, weapon2: 'longsword', gap: 1.6, seed: 7, ...opts });
  const f = g.player, a = g.enemy;
  g.ai.update = () => {};
  f.foe = a; a.foe = f;
  f.fightT = a.fightT = CONFIG.ARENA.startHold;
  if (human) f.humanInput = true;
  return { g, f, a, sp: f.schoolPassive };
}
const tick = (fx, sec) => { for (let i = 0; i < Math.round(sec / DT); i++) fx.sp.update(DT); };
const sec = (s) => CONFIG.realS(s); // 실제 초 → 게임 초
function startTapThrust(f) {
  assert.ok(f.skill.thrust({ step: false }), 'tap thrust starts');
  for (let i = 0; i < 40 && !f.skill.thrustPush; i++) f.skill.updateThrust(DT);
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('값: 사장님 11/14 — 1 초 · 맞음 1 · 막기 2 · 최대 10 · +8 %/스택 · 흘려 받기 3(감독 권고) · 낮은 걸음 켬 · B1 · C · E 끔', () => {
  assert.equal(JT.stack, 1);
  assert.equal(JT.ai, 0);
  assert.ok(near(JT.per, CONFIG.realS(1.0)));
  assert.deepEqual([JT.hit, JT.block, JT.flow, JT.max], [1, 2, 3, 10]);
  assert.ok(near(JT.each * JT.max, 0.8));
  assert.equal(JT.lowShove, 1);
  assert.deepEqual([JT.brace, JT.counter, JT.keep], [0, 0, 0]);
  assert.ok(near(JT.counterWin, CONFIG.realS(0.6)));
});

test('스택 — 휘두르지 않은 1 초마다 +1 · 몫 = 스택 × 8 % · 판 시작 정지 동안은 안 셈', () => {
  const fx = fixture();
  try {
    const { sp, f } = fx;
    assert.equal(sp.stackOn, true);
    tick(fx, sec(0.9)); assert.equal(sp.stk, 0, '1 초 전');
    tick(fx, sec(0.2)); assert.equal(sp.stk, 1, '1 초');
    tick(fx, sec(3)); assert.equal(sp.stk, 4, '4 초');
    assert.ok(near(sp.charge, 4 * 0.08), `charge ${sp.charge}`);
    assert.equal(sp.stackShow, 4, '화면 표시');
    assert.equal(sp.stats.stk.idle, 4);
    f.fightT = 0; // 판 시작 정지
    tick(fx, sec(3)); assert.equal(sp.stk, 4, '정지 동안 그대로');
  } finally { fx.g.world.free(); }
});

test('스택 — 상한 10 (넘친 몫은 버림)', () => {
  const fx = fixture();
  try {
    tick(fx, sec(14.5));
    assert.equal(fx.sp.stk, 10);
    assert.ok(near(fx.sp.charge, 0.8));
    fx.sp.guardEvent('block', fx.a, 1);
    assert.equal(fx.sp.stk, 10);
    assert.equal(fx.sp.stats.stk.over, 4 + 2, '넘친 몫 (기다림 4 + 막기 2)');
  } finally { fx.g.world.free(); }
});

test('스택 — 맞음 +1 (상처나 의식이 깎인 맞음만 · 상대 공격 하나에 한 번)', () => {
  const fx = fixture();
  try {
    const { sp, a } = fx;
    a.stamina.attackId = 3;
    sp.tookHit(a, false); assert.equal(sp.stk, 0, '깎인 것 없음');
    sp.tookHit(a, true); assert.equal(sp.stk, 1);
    sp.tookHit(a, true); assert.equal(sp.stk, 1, '같은 공격 두 곳');
    a.stamina.attackId = 4;
    sp.tookHit(a, true); assert.equal(sp.stk, 2, '새 공격');
    assert.equal(sp.stats.stk.ev.hit, 2);
  } finally { fx.g.world.free(); }
});

test('스택 — 막기 +2 · 흘려 받기 +3 · 한 공격에 둘이 함께 들면 큰 쪽 하나만 (흘려 받기 2 판 견줌)', () => {
  for (const flow of [3, 2]) {
    const fx = fixture();
    try {
      JT.flow = flow;
      const { sp, a } = fx;
      sp.guardEvent('block', a, 1); assert.equal(sp.stk, 2, '막기');
      sp.guardEvent('block', a, 1); assert.equal(sp.stk, 2, '같은 공격 다시 막음');
      sp.guardEvent('flow', a, 1); assert.equal(sp.stk, Math.max(2, flow), '막기 뒤 흘려 받기 — 큰 쪽');
      sp.guardEvent('flow', a, 2); assert.equal(sp.stk, Math.max(2, flow) + flow, '흘려 받기만');
      sp.guardEvent('block', a, 2); assert.equal(sp.stk, Math.max(2, flow) + flow, '흘려 받기 뒤 막기 — 큰 쪽');
      sp.guardEvent('block', a, 3); assert.equal(sp.stk, Math.max(2, flow) + flow + 2, '새 공격 막기');
      assert.equal(sp.flowN, 2, '흘려 받기 수 (C)');
      assert.deepEqual([sp.stats.stk.ev.block, sp.stats.stk.ev.flow], [3, 2]);
    } finally { restore(); fx.g.world.free(); }
  }
});

test('스택 — 칼을 내면 그 칼에 실리고(10 스택 × 1.8) 0 부터 · 휘두르는 동안 안 쌓임 · 맞으면 씀', () => {
  const fx = fixture();
  try {
    const { f, sp } = fx;
    tick(fx, sec(10.5));
    assert.equal(sp.stk, 10);
    startTapThrust(f);
    assert.equal(sp.lock.stk, 10);
    assert.ok(near(sp.lock.ken, 0.8));
    assert.equal(sp.stk, 0, '0 부터');
    tick(fx, sec(1.5)); assert.equal(sp.stk, 0, '휘두르는 동안 안 쌓임');
    assert.ok(near(sp.dealtK(), 1.8), `× ${sp.dealtK()}`);
    sp.onHit({ schoolK: sp.dealtK(), schoolLock: sp.lastLock });
    assert.equal(sp.dealtK(), 1, '씀');
    assert.equal(sp.stats.stk.strokes, 1);
    assert.equal(sp.stats.stk.sum, 10);
  } finally { fx.g.world.free(); }
});

test('스택 — 빗나간 칼의 몫은 afterWindow 안 제비 베기가 들고 감 (밖이면 버림)', () => {
  for (const [gap, tsu, want] of [[0.3, true, 0.4], [0.3, false, null], [UA.afterWindow + 0.1, true, null]]) {
    const fx = fixture();
    try {
      const { f, sp } = fx;
      tick(fx, sec(5.5)); // 5 스택
      startTapThrust(f);
      f.skill.tap = null; f.skill.thrustPush = false; // 못 맞히고 끝남
      tick(fx, gap);
      const fresh = sp.charge;
      if (tsu) f.artTech = 'tsubameGaeshi';
      startTapThrust(f);
      const k = sp.dealtK();
      f.artTech = null;
      if (want != null) assert.ok(near(k, 1 + want), `carried ${k}`);
      else assert.ok(near(k, 1 + fresh), `fresh only ${k}`);
    } finally { fx.g.world.free(); }
  }
});

test('스택 — 고노센에도 실림 (지금 규칙 그대로 — SCHOOL_PASSIVE.japanese.secret)', () => {
  const fx = fixture();
  try {
    const { f, sp } = fx;
    tick(fx, sec(6.5));
    f.skill.sec = { S: { name: 'goNoSen' } };
    f.stamina.secret();
    assert.equal(sp.lock.stk, 6);
    assert.ok(near(sp.dealtK(), 1.48), `× ${sp.dealtK()}`);
    assert.equal(sp.stk, 0);
  } finally { fx.f.skill.sec = null; fx.g.world.free(); }
});

test('스위치 끔(JP_TANK.stack 0) · AI · 시뮬 대본 몸 = 전 판 (6 s 곧은 오름 +30 %)', () => {
  const cases = [['끔', { human: true }, () => (JT.stack = 0)], ['대본 몸', { human: false }, () => {}], ['AI 몫', { human: true }, (fx) => (fx.sp.ai = true)]];
  for (const [name, o, set] of cases) {
    const fx = fixture('uchigatana', o);
    try {
      set(fx);
      assert.equal(fx.sp.stackOn, false, name);
      assert.equal(fx.sp.stackShow, null, name);
      tick(fx, SP.japanese.full / 2);
      assert.ok(Math.abs(fx.sp.charge - 0.15) < 0.01, `${name} 반 ${fx.sp.charge}`);
      fx.sp.guardEvent('block', fx.a, 1);
      fx.sp.tookHit(fx.a, true);
      assert.equal(fx.sp.stk, 0, `${name}: 스택 없음`);
    } finally { restore(); fx.g.world.free(); }
  }
  const fa = fixture();
  try {
    JT.ai = 1; fa.sp.ai = true;
    assert.equal(fa.sp.stackOn, true, 'AI 견줌 스위치');
  } finally { restore(); fa.g.world.free(); }
  const de = fixture('longsword');
  try {
    tick(de, sec(3)); de.sp.guardEvent('block', de.a, 1);
    assert.equal(de.sp.stackOn, false); assert.equal(de.sp.stk, 0, '독일 몸');
  } finally { de.g.world.free(); }
});

test('B1 (끔이 기본): 켜면 받는 피해 × (1 − 0.3 × 스택/10)', () => {
  const fx = fixture();
  try {
    const { sp } = fx;
    tick(fx, sec(5.5));
    assert.equal(sp.takenK(), 1, '끔');
    JT.brace = 1;
    assert.ok(near(sp.takenK(), 0.85));
    tick(fx, sec(5));
    assert.ok(near(sp.takenK(), 0.7), '가득 × 0.7');
    startTapThrust(fx.f);
    assert.equal(sp.takenK(), 1, '칼을 내면 함께 사라짐');
  } finally { restore(); fx.g.world.free(); }
});

test('E (끔이 기본): 켜면 손목 치기 · 비껴 베기는 스택을 쓰지도 지우지도 않음', () => {
  for (const [keep, tech] of [[0, 'kote'], [1, 'kote'], [1, 'hirakiGiri'], [1, 'zornhau']]) {
    const fx = fixture();
    try {
      JT.keep = keep;
      const { f, sp } = fx;
      tick(fx, sec(6.5));
      startTapThrust(f);
      f.artTech = tech; // 지금 긋는 기술 (unique_assist.js strokeTechOf)
      sp.update(DT);
      const kept = keep && tech !== 'zornhau';
      assert.equal(sp.stk, kept ? 6 : 0, `${keep} ${tech} 스택`);
      assert.ok(near(sp.dealtK(), kept ? 1 : 1.48), `${keep} ${tech} × ${sp.dealtK()}`);
      f.artTech = null;
    } finally { restore(); fx.g.world.free(); }
  }
});

test('C (끔이 기본): 켜면 흘려 받기가 든 스텝에 비기 창 (counterWin) — 그 안 공격이 고노센', () => {
  for (const on of [0, 1]) {
    const fx = fixture();
    try {
      JT.counter = on;
      const { f, a, sp } = fx;
      assert.equal(playerSecretOf(f)?.name, 'goNoSen');
      const W = new PlayerSecretWatch(f, a);
      W.update(DT, false);
      assert.equal(W.open, null);
      sp.guardEvent('flow', a, 9);
      W.update(DT, false);
      if (!on) { assert.equal(W.open, null, '끔'); continue; }
      assert.equal(W.open?.ctx?.ev, 'counter');
      assert.ok(near(W.open.t, JT.counterWin - DT, 1e-6) || near(W.open.t, JT.counterWin, 1e-6));
      assert.equal(W.counterWins, 1);
      const o = W.fire();
      assert.equal(o?.S?.name, 'goNoSen', '공격 입력 → 고노센');
      sp.guardEvent('flow', a, 9); W.update(DT, false);
      assert.equal(W.open, null, '같은 공격의 흘림은 한 번');
    } finally { restore(); fx.g.world.free(); }
  }
});

test('J1 낮은 걸음 — 사람 일본은 붙어 버티기(밀치기)에 기력 0 · 상대는 그대로 · 끄면 전 판', () => {
  const kitAll = kitFromNodes('japanese', allNodeIds('japanese'));
  const kitNoFoot = kitFromNodes('japanese', new Set([...allNodeIds('japanese')].filter((n) => n !== 'J1')));
  for (const [name, o, want] of [['사람 · 낮은 걸음', { kit: kitAll }, true], ['낮은 걸음 안 익힘', { kit: kitNoFoot }, false], ['대본 몸', { human: false }, false]]) {
    const fx = fixture('uchigatana', o);
    try {
      assert.equal(lowShoveFree(fx.f), want, name);
      assert.equal(lowShoveFree(fx.a), false, `${name}: 상대`);
    } finally { fx.g.world.free(); }
  }
  for (const on of [1, 0]) {
    const fx = fixture('uchigatana', { kit: kitAll });
    try {
      JT.lowShove = on;
      const { f, a } = fx;
      f.stamina.canClinch = () => true; // 붙어 버팀 (밀치기 누르기 + 닿음 — 조건은 stamina.js canClinch)
      const p0 = f.stamina.value, q0 = a.stamina.value;
      for (let i = 0; i < 60; i++) { f.stamina.stepClinch(DT); a.stamina.stepClinch(DT); }
      const dP = p0 - f.stamina.value, dA = q0 - a.stamina.value;
      assert.ok(dA > 1, `상대 빠짐 ${dA}`);
      if (on) assert.equal(dP, 0, '낮은 걸음 0');
      else assert.ok(near(dP, dA, 1e-6), `끔 = 같이 빠짐 ${dP} · ${dA}`);
    } finally { restore(); fx.g.world.free(); }
  }
  const de = fixture('longsword');
  try { assert.equal(lowShoveFree(de.f), false, '독일 사람'); } finally { de.g.world.free(); }
});

test('다른 유파 · 전 봇 판은 바이트 같음 (스택 켬 · 끔 · 일본 봇 tank 끼움)', () => {
  const h = (r) => createHash('sha256').update(JSON.stringify(r)).digest('hex');
  const one = (o) => fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 2, dur: 4, ...o });
  const base = h(one({}));
  try {
    assert.equal(h(one({ jpBot: 'tank' })), base, '독일 — 일본 봇 스위치');
    Object.assign(JT, { stack: 0, lowShove: 0 });
    assert.equal(h(one({})), base, '독일 — 스택 끔');
    Object.assign(JT, { stack: 1, lowShove: 1, brace: 1, counter: 1, keep: 1, ai: 1 });
    assert.equal(h(one({})), base, '독일 — 모두 켬');
  } finally { restore(); }
});

test('새 몫 열쇠 (11/14 감독 — 새 칸 자리 대기): jpRock · jpBrace 는 J1 · jpTaiSen 은 J3 과 함께 · 안 익히면 꺼짐', () => {
  const all = [...allNodeIds('japanese')];
  const kit = (drop) => kitFromNodes('japanese', new Set(all.filter((n) => !drop.includes(n))));
  assert.deepEqual(['jpRock', 'jpBrace', 'jpTaiSen'].map((k) => kit([])[k]), [true, true, true]);
  assert.deepEqual(['jpRock', 'jpBrace', 'jpTaiSen'].map((k) => kit(['J1'])[k]), [false, false, true]);
  assert.deepEqual(['jpRock', 'jpBrace', 'jpTaiSen'].map((k) => kit(['J3'])[k]), [true, true, false]);
  // B1 — J1 없는 몸은 덜 다치지 않음
  for (const [drop, want] of [[[], 0.7], [['J1'], 1]]) {
    const fx = fixture('uchigatana', { kit: kit(drop) });
    try {
      JT.brace = 1;
      tick(fx, sec(10.5));
      assert.ok(near(fx.sp.takenK(), want), `B1 ${drop} ${fx.sp.takenK()}`);
    } finally { restore(); fx.g.world.free(); }
  }
  // C — J3 없는 몸은 받아 치기 창 없음
  for (const [drop, want] of [[[], 'counter'], [['J3'], null]]) {
    const fx = fixture('uchigatana', { kit: kit(drop) });
    try {
      JT.counter = 1;
      const W = new PlayerSecretWatch(fx.f, fx.a);
      W.update(DT, false);
      fx.sp.guardEvent('flow', fx.a, 3);
      W.update(DT, false);
      assert.equal(W.open?.ctx?.ev ?? null, want, `C ${drop}`);
    } finally { restore(); fx.g.world.free(); }
  }
});
