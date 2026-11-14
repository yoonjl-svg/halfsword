// 유파 AI 3 단계 — 수 읽기 · 공정함 · AI 고노센 시험 (11/14 — src/ai_read.js · ai_plan_jp.js jpGns* · ai.js secretLag · seenSwing · gnsWatch · config AI_PLAN.read ·
//  기록 docs/strike/ai_read_2026-11-14.md):
//  읽기 그릇(띠마다 칸 · 본 칼 적기 — 같은 위협 번호는 한 번 · 버릇 6 s · 되풀이 10 s · 칼 든 거리 · 굴림 없음 · 새 배열 없음) ·
//  상대 유파 대표 위험(가운데부터 · 기울기) · 대가 창 · 상대 기력(높음) · 걸음 · 기술 · 이어 치기 곱 · 스위치(read.on · aiPlan) ·
//  공정함(비기 조건을 알아채는 눈의 반응 시간 · 박자 찌르기는 늦게 본 휘두름 · 고노센 경계는 늦게 본 준비 자세) ·
//  AI 고노센 준비 지키기(준비가 켜질 때 한 번 굴림 · 먼 위협 · 낌새 · 맞으러 나감 · 꾐) · 판에서 AI 고노센이 남.
//  시간 상한 기준은 없다.  node --test tools/sim/ai_read.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { tiltOf, SCHOOL_PLAN } from '../../src/ai_plan.js';
import { readInit, readNote, readLineN, readAtkN, readRepeatLine, readRaiseD, readTick, readNeed, readFeetV, readTechK, readChainK, costOpen, foeCost } from '../../src/ai_read.js';
import { jpInit, jpGnsFeet, jpGnsHold, jpGnsIgnore, jpGnsKeep, JP_PLAN } from '../../src/ai_plan_jp.js';
import { aiBeatTick } from '../../src/italian_outbox.js';
import { gnsEnterLine, useSecret } from '../../src/secret.js';

const { AI_PLAN, AI_PLAN_JP, SECRET, STAMINA, JP_TANK, TIME } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

/** AI_PLAN.read 칸을 잠깐 바꿔 fn 을 돌리고 되돌림 · on = AI_PLAN.on */
function withRead(over, fn, on = AI_PLAN.on) {
  const rd = AI_PLAN.read;
  const on0 = AI_PLAN.on;
  AI_PLAN.read = { ...rd, ...over };
  AI_PLAN.on = on;
  try {
    return fn();
  } finally {
    AI_PLAN.read = rd;
    AI_PLAN.on = on0;
  }
}
/** Math.random 을 잠깐 바꿈 (값 고정 · 굴림 셈) */
function withRandom(val, fn) {
  const rnd = Math.random;
  let n = 0;
  Math.random = () => (n++, val ?? rnd());
  try {
    return { r: fn(), draws: () => n };
  } finally {
    Math.random = rnd;
  }
}
/** 가짜 AI (읽기 셈만 — 몸 없음) · 상대 유파 tr */
function fake(prof, tr = 'german', o = {}) {
  const ai = {
    proficiency: prof,
    planK: tiltOf(prof),
    stats: { plan: {} },
    sense: { t: 20 },
    level: { reaction: 0.2 },
    d: 2.2,
    foeReach: 1.9,
    foeClosing: 0,
    M: { reach: 2.0, contact: 1.7 },
    chasing: false,
    hitLanded: false,
    bound: false,
    foe: { swordArt: { tradition: tr }, stamina: { value: 50, infinite: false } },
    me: { stamina: { value: 50, level: 0, infinite: false } },
    ...o,
  };
  readInit(ai);
  return ai;
}
const still = { hvx: 0, hvy: 0, hx: 0, hy: 0, state: 'stand' };
const raise = { hvx: 0, hvy: 2.5, hx: 0, hy: 0.3, state: 'stand' };

test('읽기 그릇 — 띠마다 칸 (무 · 낮음은 안 읽음 · 가운데 상대 유파 · 버릇 · 높음 되풀이 · 대가 창 · 기력) · 값', () => {
  const R = AI_PLAN.read;
  assert.equal(R.on, 1);
  assert.equal(R.fair, 1);
  assert.equal(R.gns, 1);
  assert.ok(near(R.habitT, 6.0 * TIME.k) && near(R.repeatT, 10.0 * TIME.k), '버릇 6.0 s · 되풀이 10.0 s (2 단계 값 그대로 — 그릇 하나로)');
  for (const k of ['risk', 'cost', 'stamina']) assert.ok(R[k] > 0 && R[k] < 1, `${k} 기울기 몫 0 ~ 1`);
  const row = (p) => {
    const r = fake(p).read;
    return [r.school, r.habit, r.repeat];
  };
  assert.deepEqual(row(1), [false, false, false], '낮음');
  assert.deepEqual(row(2), [false, false, false], '낮음');
  assert.deepEqual(row(3), [true, true, false], '가운데');
  assert.deepEqual(row(4), [true, true, false], '가운데');
  assert.deepEqual(row(5), [true, true, true], '높음');
  assert.deepEqual(row(6), [true, true, true], '높음');
});

test('본 칼 적기 — 같은 위협 번호는 한 번 · 버릇 창 · 지금 칼 뺌 · 되풀이 줄 · 칼 든 거리(두 번부터) · 굴림 없음 · 새 배열 없음', () => {
  const ai = fake(5);
  const R = ai.read;
  const bufs = [R.t, R.line, R.id, R.d, R.rT, R.rD];
  const { draws } = withRandom(0.5, () => {
    readNote(ai, { id: 1, line: 'high' });
    readNote(ai, { id: 1, line: 'high' });
    assert.equal(R.st.notes, 1, '같은 위협 번호는 한 번');
    ai.sense.t += 1;
    readNote(ai, { id: 2, line: 'high' });
    readNote(ai, { id: 3, line: 'low' });
    assert.equal(readLineN(ai, 'high', AI_PLAN.read.habitT), 2);
    assert.equal(readLineN(ai, 'high', AI_PLAN.read.habitT, 2), 1, '지금 보는 칼(번호 2)은 버릇에 안 셈');
    assert.equal(readAtkN(ai, AI_PLAN.read.repeatT), 3);
    assert.equal(readRepeatLine(ai, AI_PLAN.read.repeatT), 'high');
    ai.sense.t += AI_PLAN.read.habitT + 0.01;
    assert.equal(readLineN(ai, 'high', AI_PLAN.read.habitT), 0, '버릇 창 밖');
    ai.sense.t += AI_PLAN.read.repeatT;
    assert.equal(readRepeatLine(ai, AI_PLAN.read.repeatT), null, '되풀이 창 밖');
    // 칼 든 거리 (readTick — 늦게 본 손이 오르는 첫 스텝마다)
    assert.ok(Number.isNaN(readRaiseD(ai)), '모름');
    readTick(ai, 1 / 120, 2.3, raise, null);
    readTick(ai, 1 / 120, 2.2, raise, null);
    assert.equal(R.st.raises, 1, '오르는 동안은 한 번');
    readTick(ai, 1 / 120, 2.2, still, null);
    readTick(ai, 1 / 120, 2.1, raise, null);
    assert.ok(near(readRaiseD(ai), 2.2), '두 번부터 평균');
    readTick(ai, 1 / 120, 2.0, still, { id: 7, line: 'mid' });
    assert.equal(R.st.notes, 4, '이 스텝 본 위협을 적음');
  });
  assert.equal(draws(), 0, '굴림 없음');
  assert.deepEqual([R.t, R.line, R.id, R.d, R.rT, R.rD], bufs, '고리 버퍼 그대로 (새 배열 없음)');
});

test('상대 유파 대표 위험 (가운데부터 · 기울기) — 이탈리아 · 일본 · 독일 · 동방 · 이베리아 · 큰 틈엔 안 얹음 · 낮음은 0', () => {
  const opp = { kind: 'patience' };
  const big = { kind: 'recover' };
  for (const p of [3, 5]) {
    const r = tiltOf(p) * AI_PLAN.read.risk;
    // 이탈리아 — 칼 우위 빛
    const it = fake(p, 'italian', { foe: { swordArt: { tradition: 'italian' }, itEdge: { until: 5 }, fightT: 1, stamina: { value: 50 } } });
    assert.ok(near(readNeed(it, opp), r), `이탈리아 ${p}`);
    assert.equal(readNeed(it, big), 0, '큰 틈');
    it.foe.fightT = 6;
    assert.equal(readNeed(it, opp), 0, '빛이 꺼짐');
    // 일본 — 준비된 고노센 선 언저리 · 스택이 쌓이기 전 견제
    const jp = fake(p, 'japanese', { gnsW: { ready: true, reck: false, line: 2.0 } });
    assert.ok(near(readNeed(jp, opp), r), `일본 선 언저리 ${p}`);
    jp.d = 2.5;
    assert.equal(readNeed(jp, opp), 0, '선에서 멂');
    jp.gnsW.reck = true;
    jp.d = 2.0;
    assert.equal(readNeed(jp, opp), 0, '무모로 경계를 접음');
    jp.gnsW = { ready: false };
    jp.foe.schoolPassive = { stackOn: true, stk: 0 };
    assert.ok(near(readNeed(jp, opp), -r), '스택 0 — 견제');
    jp.foe.schoolPassive.stk = JP_TANK.max;
    assert.equal(readNeed(jp, opp), 0, '스택이 쌓임 — 견제 없음');
    // 독일 — 내 칼끝 밖에서 칼을 덜 냄
    const de = fake(p, 'german');
    de.d = de.M.reach + 0.2;
    assert.ok(near(readNeed(de, opp), r), `독일 ${p}`);
    de.d = de.M.reach - 0.2;
    assert.equal(readNeed(de, opp), 0, '칼끝 안');
    // 동방 — 발톱 자국 · 내 지침
    const cn = fake(p, 'chinese');
    assert.equal(readNeed(cn, opp), 0, '자국 없음 · 생생');
    cn.me.cnHunt = { n: 1 };
    assert.ok(near(readNeed(cn, opp), r * 0.5));
    cn.me.stamina.level = 1;
    assert.ok(near(readNeed(cn, opp), r), '자국 + 지침');
    // 이베리아 — 원 사이 · 무장 꼴
    const ib = fake(p, 'iberian', { foe: { swordArt: { tradition: 'iberian' }, ibLink: {}, stamina: { value: 50 } } });
    readTick(ib, 1 / 120, 2.2, still, null);
    assert.equal(readNeed(ib, opp), 0, '원을 막 봄 — 반응 시간 전');
    ib.sense.t += 0.3;
    assert.ok(near(readNeed(ib, opp), p === 5 ? -tiltOf(p) * AI_PLAN.read.cost : -r), '원 사이 — 칠 마음 (높음은 대가 창으로 한 번)');
    ib.foe.ibLink = null;
    for (let i = 0; i < Math.ceil(SECRET.ibSpin.armTime * 120) + 2; i++) readTick(ib, 1 / 120, 2.5, still, null);
    assert.ok(near(readNeed(ib, opp), r), '무장처럼 보임 — 참음');
  }
  for (const p of [1, 2]) for (const tr of ['german', 'italian', 'japanese', 'chinese', 'iberian']) assert.equal(readNeed(fake(p, tr, { d: 2.5 }), opp), 0, `낮음 ${p} ${tr}`);
});

test('대가 창 · 상대 기력 (높음만) — 반응 시간 뒤부터 · 빠른 칼 · 가운데는 안 읽음', () => {
  const opp = { kind: 'patience' };
  const tech = { fast: true };
  for (const p of [3, 5]) {
    const ai = fake(p, 'longsword-none', { d: 1.8 });
    ai.foe.secretStiff = 0.5;
    assert.equal(foeCost(ai.foe), 'stiff');
    readTick(ai, 1 / 120, 1.8, still, null);
    assert.equal(costOpen(ai), false, '막 봄');
    ai.sense.t += 0.25;
    readTick(ai, 1 / 120, 1.8, still, null);
    const k = tiltOf(p);
    if (p === 5) {
      assert.equal(costOpen(ai), true);
      assert.ok(near(readNeed(ai, opp), -k * AI_PLAN.read.cost), '대가 창 — 칠 마음');
      assert.ok(near(readTechK(ai, tech), 1 + k * AI_PLAN.read.cost), '빠른 칼');
      ai.d = ai.M.reach + 0.5;
      assert.equal(readNeed(ai, opp), 0, '멂');
      // 상대 기력 (머리 위 막대)
      ai.foe.secretStiff = 0;
      readTick(ai, 1 / 120, 1.8, still, null);
      ai.me.stamina.value = 80;
      ai.foe.stamina.value = 20;
      const diff = 60 / STAMINA.max;
      assert.ok(near(readNeed(ai, opp), -k * AI_PLAN.read.stamina * diff), '내가 더 남음 — 몰아침');
      ai.me.stamina.value = 20;
      ai.foe.stamina.value = 80;
      assert.ok(near(readNeed(ai, opp), k * AI_PLAN.read.stamina * diff), '모자람 — 기다림');
      ai.foe.stamina.infinite = true;
      assert.equal(readNeed(ai, opp), 0, '무한 기력 상대');
    } else {
      assert.equal(costOpen(ai), false, '가운데 — 대가 창을 안 읽음');
      ai.me.stamina.value = 80;
      ai.foe.stamina.value = 20;
      assert.equal(readNeed(ai, opp), 0, '가운데 — 기력을 안 읽음');
    }
  }
});

test('걸음 · 기술 · 이어 치기 곱 — 이탈리아 곧게 안 듦 · 칼 우위 빛엔 벌림 · 이베리아 무장 꼴 · 독일 큰 칼 · 헛친 뒤 덜 이음 · 낮음 그대로', () => {
  const k = tiltOf(3);
  const r = k * AI_PLAN.read.risk;
  const it = fake(3, 'italian', { foe: { swordArt: { tradition: 'italian' }, itEdge: null, fightT: 1, stamina: { value: 50 } } });
  assert.ok(near(readFeetV(it, 1, it.foeReach + 0.2), 1 - r), '맞박자 거리 — 곧게 안 듦');
  assert.equal(readFeetV(it, 1, it.foeReach + 0.5), 1, '먼 데선 그대로');
  assert.equal(readFeetV(it, -0.5, it.foeReach + 0.2), -0.5, '물러남은 그대로');
  it.foe.itEdge = { until: 5 };
  assert.ok(near(readFeetV(it, 1, 2.5), -r), '칼 우위 빛 — 벌림');
  it.chasing = true;
  assert.equal(readFeetV(it, 1, 2.5), 1, '쫓는 중엔 안 봄');
  const ib = fake(3, 'iberian');
  for (let i = 0; i < Math.ceil(SECRET.ibSpin.armTime * 120) + 2; i++) readTick(ib, 1 / 120, 2.5, still, null);
  const want = ib.foeReach + (SECRET.altib?.aiFire ?? SECRET.ibSpin.aiFire) + 0.1;
  assert.ok(readFeetV(ib, 1, want - 0.2) < 0, '무장 꼴 — 그 칼끝 + aiFire 밖으로');
  assert.equal(readFeetV(ib, 1, want + 0.2), 1);
  const de = fake(3, 'german', { d: 2.3 });
  assert.ok(near(readTechK(de, { presses: true }), 1 - r), '독일 — 칼끝 밖 큰 칼을 덜');
  assert.equal(readTechK(de, { presses: false }), 1);
  assert.ok(near(readChainK(de), 1 - r), '헛친 뒤 덜 이음');
  de.hitLanded = true;
  assert.equal(readChainK(de), 1, '맞혔으면 그대로');
  const low = fake(2, 'italian', { foe: { swordArt: { tradition: 'italian' }, itEdge: { until: 5 }, fightT: 1, stamina: { value: 50 } } });
  assert.equal(readFeetV(low, 1, 2.0), 1, '낮음 그대로');
  assert.equal(readTechK(fake(2, 'german', { d: 2.3 }), { presses: true }), 1);
  assert.equal(readChainK(fake(2, 'german')), 1);
});

test('스위치 — read.on 0 이면 읽기 몫 0 · 곱 1 (그릇은 유파 버릇에 그대로 씀) · aiPlan 0 이면 그릇 없음', () => {
  withRead({ on: 0 }, () => {
    const de = fake(5, 'german', { d: 2.5 });
    assert.equal(readNeed(de, { kind: 'patience' }), 0);
    assert.equal(readTechK(de, { presses: true }), 1);
    assert.equal(readChainK(de), 1);
    assert.equal(readFeetV(fake(5, 'italian', { foe: { swordArt: { tradition: 'italian' }, itEdge: { until: 5 }, fightT: 1 } }), 1, 2.0), 1);
    readNote(de, { id: 1, line: 'high' });
    assert.equal(readLineN(de, 'high', AI_PLAN.read.habitT), 1, '버릇 그릇은 그대로');
  });
  const off = withRead({}, () => {
    const G = newRound({ weapon: 'longsword', weapon2: 'rapier', seed: 1 });
    const r = { read: G.ai.read, lag: G.ai.secretLag() };
    G.world.free();
    return r;
  }, 0);
  assert.equal(off.read, undefined, '`?aiPlan=0` — 그릇 없음');
  assert.equal(off.lag, 0, '`?aiPlan=0` — 옛 판 눈');
});

test('공정함 — 비기 조건을 알아채는 눈에 반응 시간(몸 자리는 앞질러) · 박자 찌르기는 늦게 본 휘두름 · 고노센 경계는 늦게 본 준비 자세 (스틱 · 속 셈 아님) · 끄면 옛 판', () => {
  // ① 비기 조건 눈 (secretScan · spinTick — 실행은 그대로)
  const G = newRound({ weapon: 'uchigatana', weapon2: 'longsword', seed: 1 });
  try {
    const ai = G.ai;
    ai.update = () => {};
    while (G.t < 0.5) G.step();
    assert.ok(ai.level.reaction > 0);
    assert.equal(ai.secretLag(), ai.level.reaction);
    assert.equal(withRead({ fair: 0 }, () => ai.secretLag()), 0, 'fair 0 — 옛 판 (지금 모습)');
    // 손 · 칼 · 자세는 늦게 · 몸 자리는 간 보기 거리 셈처럼 앞질러 (본 자리 + 골반 속도 × 반응 시간 × predict)
    const sv = ai.sense.seen(ai.level.reaction);
    const o = ai.secretSeen();
    const a = ai.level.reaction * ai.level.predict;
    assert.ok(near(o.cx, sv.cx + sv.vx * a) && near(o.cz, sv.cz + sv.vz * a), '몸 자리 앞질러 봄');
    assert.deepEqual([o.hx, o.hy, o.hvx, o.hvy, o.state, o.tx, o.tz], [sv.hx, sv.hy, sv.hvx, sv.hvy, sv.state, sv.tx, sv.tz], '손 · 칼 · 자세는 늦은 그대로');
    assert.equal(ai.secretSeen(), o, '덧칸 하나를 다시 씀 (새 객체 없음)');
    assert.equal(withRead({ fair: 0 }, () => ai.secretSeen()), ai.sense.seen(0), 'fair 0 — 지금 모습');
    // ② 박자 찌르기 — 늦게 본 손 빠르기
    const seen = ai.sense.seen.bind(ai.sense);
    let hand = 4;
    let ready = 0;
    ai.sense.seen = (lag) => ({ ...seen(lag), hvx: hand, hvy: 0, ready, state: 'stand', armed: true });
    assert.equal(ai.seenSwing(), true);
    hand = 1;
    assert.equal(ai.seenSwing(), false);
    const B = { t: 0, foeAtk: null, foeSw: false };
    aiBeatTick(B, 0.01, true);
    aiBeatTick(B, 0.01, true);
    assert.equal(B.foeAtk.n, 1, '휘두름 하나에 한 번');
    aiBeatTick(B, 0.01, false);
    aiBeatTick(B, 0.01, true);
    assert.equal(B.foeAtk.n, 2);
    // ③ 고노센 경계 — 사람 상대(우치가타나)의 준비를 늦게 본 준비 자세로
    const d = ai.d;
    ai.gnsW = null;
    ai.gnsWatch(1 / 120, d, false);
    assert.equal(ai.gnsW.user, true, '사람 우치가타나 — 고노센 쓰는 몸');
    assert.equal(ai.gnsW.ready, false, '자세 없음');
    ready = 1;
    ai.gnsWatch(1 / 120, d, false);
    assert.equal(ai.gnsW.ready, true, '준비 자세가 보임 (스틱으로 2.6 s 서 있지 않았어도)');
    assert.ok(near(ai.gnsW.line, gnsEnterLine({ reach: G.player.swordArt.measure.reach, contact: G.player.swordArt.measure.contact })), '선은 보이는 칼로');
    withRead({ fair: 0 }, () => {
      ai.gnsW = null;
      ai.gnsWatch(1 / 120, d, false);
      assert.equal(ai.gnsW.ready, false, 'fair 0 — 옛 판(사람 스틱 셈 — 판 시작 0.5 s 는 아직)');
    });
    ai.gnsW = null;
    ai.gnsWatch(1 / 120, d, false);
    assert.equal(ai.gnsW.ready, true);
    useSecret(G.player);
    ai.gnsWatch(1 / 120, d, false);
    assert.equal(ai.gnsW.ready, false, '이 판 비기를 다 쓴 사람은 자세가 보여도 준비 아님 (옛 눈과 같은 규칙)');
  } finally {
    G.world.free();
  }
});

/** 가짜 일본 AI (고노센 준비 셈만) */
function fakeJp(prof, o = {}) {
  const ai = fake(prof, 'german', { planC: JP_PLAN.probe, iaiArm: { armed: false }, M: { reach: 1.75, contact: 1.07 }, foeReach: 1.85, ...o });
  ai.stats.plan = {};
  jpInit(ai);
  return ai;
}

test('AI 고노센 준비 지키기 — 켜질 때 한 번 굴림 · 먼 위협 안 받음 · 낌새에 쥠 · 선 밖이면 맞으러 나감 · 선 안에서 멈춤 · 헛친 칼 뒤 · 풀리면 끝', () => {
  const ai = fakeJp(5);
  const G = ai.jpGns;
  const line = gnsEnterLine(ai.M);
  // 준비 전 — 아무 일 없음
  assert.equal(jpGnsKeep(ai), false);
  assert.equal(jpGnsFeet(ai, 0.4, 2.4), 0.4);
  // 켜질 때 한 번 굴림 (지킴 · 꾐)
  ai.iaiArm.armed = true;
  const { draws } = withRandom(0, () => jpGnsKeep(ai));
  assert.equal(draws(), 2, '지킴 · 꾐 두 번');
  assert.equal(G.keep, true);
  assert.ok(near(G.line, line));
  const again = withRandom(0, () => jpGnsKeep(ai));
  assert.equal(again.draws(), 0, '켜진 동안 다시 안 굴림');
  // 먼 위협 — 상대 칼끝 + 0.15 밖은 받지 않음 (위협 하나에 한 번 셈)
  assert.equal(jpGnsIgnore(ai, { id: 5 }, ai.foeReach + 0.3), true);
  assert.equal(jpGnsIgnore(ai, { id: 5 }, ai.foeReach + 0.3), true);
  assert.equal(ai.stats.plan.jp.ignore, 1);
  assert.equal(jpGnsIgnore(ai, { id: 6 }, ai.foeReach + 0.1), false, '가까운 위협은 받음');
  // 헛치는 칼이 지나는 동안 쥠 → 끝나면 선 밖이면 맞으러 (꾐은 아래 시험)
  G.invite = false;
  G.meet = 0;
  jpGnsIgnore(ai, { id: 5 }, ai.foeReach + 0.3);
  assert.equal(jpGnsHold(ai, still, ai.foeReach + 0.3), true, '헛치는 동안 쥠');
  assert.equal(jpGnsHold(ai, still, line + 0.3), true, '끝남 — 맞으러 나감');
  assert.ok(G.meet > 0);
  assert.equal(jpGnsFeet(ai, 0, line + 0.3), 3, '스틱 끝');
  assert.equal(jpGnsFeet(ai, 0, line - SECRET.iaiMargin - 0.01), 0, '선 안 — 멈춤');
  assert.equal(G.meet, 0);
  // 낌새 (칼 듦) — 쥠 · 선 밖이면 맞으러 · 낌새 하나에 한 번
  assert.equal(jpGnsHold(ai, raise, line + 0.4), true);
  assert.ok(G.meet > 0);
  const m = ai.stats.plan.jp.meet;
  G.meet = 0;
  assert.equal(jpGnsHold(ai, raise, line + 0.4), true);
  assert.equal(ai.stats.plan.jp.meet, m, '같은 낌새엔 다시 안 나감');
  assert.equal(jpGnsHold(ai, still, line + 0.4), false, '낌새 끝');
  assert.equal(jpGnsHold(ai, raise, line - 0.1), true, '선 안 낌새 — 쥠(비기 셈이 냄)');
  assert.equal(G.meet, 0);
  // 풀리면 끝
  ai.iaiArm.armed = false;
  assert.equal(jpGnsKeep(ai), false);
  assert.equal(jpGnsHold(ai, raise, 2.4), false);
  assert.equal(jpGnsIgnore(ai, { id: 9 }, 3), false);
  assert.equal(G.keep || G.invite || G.struck || G.meet > 0, false);
  // 스위치 gns 0 (`?aiGns=0`) = 그 전 판 — 준비가 켜져도 지키지 않음 · 굴림 없음
  const g0 = fakeJp(5, { iaiArm: { armed: true } });
  const off = withRead({ gns: 0 }, () => withRandom(0, () => [jpGnsKeep(g0), jpGnsIgnore(g0, { id: 1 }, 3), jpGnsHold(g0, raise, 3), jpGnsFeet(g0, 0.4, 3)]));
  assert.deepEqual(off.r, [false, false, false, 0.4]);
  assert.equal(off.draws(), 0);
  // 지킴 몫 = 띠 세기 × 칸 still × 서 있기 몫 — 굴림 값이 몫 바로 위면 안 지킴 · 낮음 · 서 있기 칸 0 도 그 몫
  const pk = (p, C) => tiltOf(p) * C.still * AI_PLAN_JP.still;
  for (const [p, C] of [[5, JP_PLAN.probe], [3, JP_PLAN.probe], [1, JP_PLAN.probe], [5, JP_PLAN.commit]]) {
    const b = fakeJp(p, { planC: C, iaiArm: { armed: true } });
    withRandom(pk(p, C) + 1e-6, () => jpGnsKeep(b));
    assert.equal(b.jpGns.keep, false, `숙련 ${p} 몫 위`);
    if (pk(p, C) > 0) {
      const c = fakeJp(p, { planC: C, iaiArm: { armed: true } });
      withRandom(pk(p, C) - 1e-6, () => jpGnsKeep(c));
      assert.equal(c.jpGns.keep, true, `숙련 ${p} 몫 아래`);
    }
  }
});

test('AI 고노센 꾐 — 상대가 칼을 드는 거리(버릇)가 선 밖이면 선 − iaiMargin 까지 다가감 · 선 안이면 안 꾐 · 모르면 굴림 몫(coin)', () => {
  const C = JP_PLAN.probe;
  const line = gnsEnterLine({ contact: 1.07 });
  const mk = (rds) => {
    const ai = fakeJp(5, { planC: C });
    for (const d of rds) {
      readTick(ai, 1 / 120, d, raise, null);
      readTick(ai, 1 / 120, d, still, null);
    }
    ai.iaiArm.armed = true;
    return ai;
  };
  const p = (known) => tiltOf(5) * C.lure * (known ? 1 - AI_PLAN.coin / 2 : AI_PLAN.coin);
  // 버릇: 선 밖에서 듦
  const a = mk([line + 0.4, line + 0.5]);
  withRandom(p(true) - 1e-6, () => jpGnsKeep(a));
  assert.equal(a.jpGns.invite, true);
  const v = jpGnsFeet(a, 0, line + 1.0);
  assert.ok(v > 0, '다가감');
  assert.ok(jpGnsFeet(a, 0, line - SECRET.iaiMargin - 0.1) < 0, '지나치면 물러섬');
  // 버릇: 선 안에서 듦 — 꾈 까닭 없음
  const b = mk([line - 0.2, line - 0.3]);
  withRandom(0, () => jpGnsKeep(b));
  assert.equal(b.jpGns.invite, false);
  // 모름 — 상대 칼끝 + 0.4 어림 · 굴림 몫 coin
  const c = mk([]);
  withRandom(p(false) + 1e-6, () => jpGnsKeep(c));
  assert.equal(c.jpGns.invite, false);
  const e = mk([]);
  withRandom(p(false) - 1e-6, () => jpGnsKeep(e));
  assert.ok(e.foeReach + 0.4 > line);
  assert.equal(e.jpGns.invite, true, '모름 — 어림 거리(상대 칼끝 + 0.4)가 선 밖 · 굴림 몫 아래');
});

test('판: 일본 숙련 5 대 롱소드 AI (씨앗 1 · 2) — AI 고노센이 남 · 지킴 · 읽기 판단이 남', () => {
  let fired = 0;
  let keep = 0;
  let risk = 0;
  for (const seed of [1, 2]) {
    const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'uchigatana', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 2 } });
    const ai = G.ai;
    while (G.t < 30 && G.player.alive && G.enemy.alive) G.step();
    fired += ai.stats.secrets?.goNoSen?.fired ?? 0;
    keep += ai.stats.plan.jp.keep;
    risk += Object.values(ai.stats.read.risk).reduce((s, x) => s + x, 0);
    G.world.free();
  }
  assert.ok(keep >= 1, `지킴 ${keep}`);
  assert.ok(fired >= 1, `AI 고노센 ${fired}`);
  assert.ok(risk >= 1, `상대 유파 위험 읽기 ${risk}`);
});
