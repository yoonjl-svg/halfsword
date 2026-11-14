// 유파 AI 플랜 2 단계 — 이베리아 시험 (11/14 — src/ai_plan_ib.js · ai_plan.js SCHOOL_PLAN.iberian · config AI_PLAN.ib · 기록 docs/strike/ai_plan_ib_2026-11-14.md):
//  플랜 열림(띠 무 · 스위치 · 이베리아만 뺌) · 표 칸 0 ~ 1 · 거리 오차 · 띠마다 차림(유도 4 부터 · 비기 5 부터 · B6 몸) · 사슬을 이을 마음(기울기 — 늘이 아님 · 기력 장치 · 무장 쪽 · 불리 · 무계획) ·
//  원으로 이을 몫(맞바꿈 · 상대 유파 거리 · 버릇 6 s · 되풀이 10 s · 무계획) · 알티바슈 무장 쪽 몫(기력이 많을수록) · 버릇 고리 버퍼(굴림 없음 · 새 배열 없음) ·
//  넓게 돎 · 옆 박차기 · 고노센 선(무 · 낮음은 무모하게 넘음) · 판에서 이베리아 행동이 남 · 스위치 끔 = 옛 판 · 다른 유파는 그대로.
//  시간 상한 기준은 없다.  node --test tools/sim/ai_plan_ib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { planFor, tiltOf, luckOf, distErrWidth, PHASES, SCHOOL_PLAN } from '../../src/ai_plan.js';
import { ibStats, chainWant, spinK, armK, habitN, ibTick, ibCircle, ibSide, ibFeetV, schoolRead, swapReady, nextFree } from '../../src/ai_plan_ib.js';

const { AI_PLAN, IB_LINK, STAMINA } = CONFIG;
/** AI_PLAN 칸을 잠깐 바꿔 fn 을 돌리고 되돌림 ('ib.x' = 이베리아 칸) */
function withPlan(over, fn) {
  const keep = { ...AI_PLAN, ib: { ...AI_PLAN.ib } };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('ib.')) AI_PLAN.ib = { ...AI_PLAN.ib, [k.slice(3)]: v };
    else AI_PLAN[k] = v;
  }
  try {
    return fn();
  } finally {
    Object.assign(AI_PLAN, keep);
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
/** 판을 만들고 시작 정지를 지난 뒤 이베리아(츠바이핸더) AI 하나 — 상대 롱소드 */
function ibAi(prof, weapon = 'zweihander') {
  const G = newRound({ weapon: 'longsword', weapon2: weapon, seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  G.enemy.ibChainAi = false; // 판이 처음 붙인 AI(숙련 2 — 이베리아 플랜)가 몸에 건 B6 표식을 지움 (한 몸에 AI 둘 — 시험만)
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof });
  return { G, ai, free: () => G.world.free() };
}
/** 가짜 AI (셈 함수만 — 몸 없음) */
function fake(p, o = {}) {
  const ai = {
    proficiency: p,
    planK: tiltOf(p),
    planLuck: luckOf(p),
    planC: SCHOOL_PLAN.iberian.commit,
    planPh: 'commit',
    chain: 0,
    sense: { t: 20 },
    foeClosing: 0,
    foeReach: 1.9,
    hitLanded: true,
    bound: false,
    d: 2,
    M: { reach: 2.0, contact: 1.7, clinch: 1.3 },
    foe: { swordArt: { tradition: 'german' } },
    me: { sword: true, armed: true, state: 'stand', weaponBroken: false, ibTradeUsed: false, stamina: { value: 80, max: 100, weight: 1.3, secretReady: true } },
    stats: { ib: ibStats() },
    ...o,
  };
  const band = [0, 1, 1, 2, 2, 3, 3][p];
  ai.ibPlan = { read: band >= 2, habit: band >= 2, repeat: band >= 3, mem: band >= 3 ? 10 : band >= 2 ? 6 : 0, hitT: new Float64Array(4).fill(-Infinity), hitI: 0, lureT: -Infinity, ...(o.ibPlan ?? {}) };
  return ai;
}
/** AI 둘 판 (자리 0 = 롱소드 AI 숙련 2 · 자리 1 = 이베리아 AI) — secs 초 돌리며 몸 자리 · 피를 30 스텝마다 적은 글 */
function trace({ weapon2 = 'zweihander', prof = 2, secs = 6, seed = 2 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: 2 } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const r = { text: out.join(';'), ib: !!G.ai.ibPlan, chainOn: !!G.enemy.ibChainOn?.() };
  G.world.free();
  return r;
}

test('이베리아 플랜 열림 · 표 · 거리 오차 — 띠 무는 플랜 없음 · 스위치 · 이베리아만 뺌', () => {
  assert.ok(AI_PLAN.schools.includes('iberian') && AI_PLAN.errSchools.includes('iberian'), '2 단계 기본 켬');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((p) => !!planFor('iberian', p)), [false, true, true, true, true, true, true]);
  assert.equal(planFor('iberian', 3), SCHOOL_PLAN.iberian);
  assert.equal(SCHOOL_PLAN.iberian.ib, true);
  assert.equal(SCHOOL_PLAN.iberian.lureAt, 4, '유도는 가운데 끝(4)부터');
  withPlan({ on: 0 }, () => assert.equal(planFor('iberian', 5), null, '`?aiPlan=0`'));
  withPlan({ schools: ['italian'] }, () => assert.equal(planFor('iberian', 5), null, '`?aiPlanIb=0` — 이베리아만 뺌'));
  for (const ph of PHASES) {
    const C = SCHOOL_PLAN.iberian[ph];
    assert.ok(C, ph);
    for (const k of ['wide', 'dash', 'slant', 'chain', 'spin', 'swap', 'arm', 'lure']) assert.ok(C[k] >= 0 && C[k] <= 1, `${ph}.${k} = 고를 몫 0 ~ 1 (기울기 — 반드시가 아님)`);
    for (const k of ['retreat', 'receive', 'link', 'engage', 'invite']) assert.equal(C[k], undefined, `${ph}.${k} — 이탈리아 칸 이름을 안 씀 (공통 고리가 0 으로 읽음)`);
  }
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((p) => +distErrWidth(p, 'iberian').toFixed(4)), [0.3, 0.24, 0.18, 0.12, 0.06, 0, 0], '0.3 m × (1 − 숙련도 ÷ 5) · 높음 0 (사장님 11/14)');
  const I = AI_PLAN.ib;
  assert.equal(I.chainKeep, 0.6);
  assert.ok(Math.abs(I.dashT - CONFIG.realS(0.4)) < 1e-12 && Math.abs(I.armWait - CONFIG.realS(3.0)) < 1e-12, '시간 사다리 0.4 · 3.0 s');
  assert.equal(I.outStep, 0.3, '걸음 사다리 0.3 m');
  assert.equal(I.readCut, 0.6);
  assert.equal(I.chainBody, 1);
});

test('AI 이베리아 차림 — 띠마다 (플랜 · 유도 4 부터 · 알티바슈 무장 5 부터 · B6 몸 · 거리 오차)', () => {
  const got = [0, 1, 2, 3, 4, 5, 6].map((p) => {
    const { ai, free } = ibAi(p);
    const r = { ib: !!ai.ibPlan, lure: !!ai.planLure, arm: !!ai.spinArm, chainOn: !!ai.me.ibChainOn(), err: ai.distErr, read: ai.ibPlan?.read ?? false, repeat: ai.ibPlan?.repeat ?? false, mem: ai.ibPlan?.mem ?? 0 };
    free();
    return r;
  });
  assert.deepEqual(got.map((r) => r.ib), [false, true, true, true, true, true, true], '무 = 플랜 없음');
  assert.deepEqual(got.map((r) => r.lure), [false, false, false, false, true, true, true]);
  assert.deepEqual(got.map((r) => r.arm), [false, false, false, false, false, true, true], '알티바슈 = 지금 비기 숙련도 5');
  assert.deepEqual(got.map((r) => r.chainOn), [false, true, true, true, true, true, true], 'B6 이어지는 흐름 — 플랜이 있는 AI 몸 (chainBody 1)');
  assert.deepEqual(got.map((r) => r.read), [false, false, false, true, true, true, true], '상대 유파 읽기는 가운데부터');
  assert.deepEqual(got.map((r) => r.repeat), [false, false, false, false, false, true, true], '되풀이는 높음');
  assert.deepEqual(got.map((r) => r.mem), [0, 0, 0, 6, 6, 10, 10], '기억 창 6.0 · 10.0 s');
  got.forEach((r, p) => {
    const w = distErrWidth(p, 'iberian');
    if (w > 0) assert.ok(r.err != null && Math.abs(r.err) <= w + 1e-12, `숙련도 ${p} 오차 ±${w}`);
    else assert.equal(r.err, undefined, `숙련도 ${p} 오차 없음`);
  });
  withPlan({ 'ib.chainBody': 0 }, () => {
    const { ai, free } = ibAi(5);
    assert.equal(ai.me.ibChainOn(), false, 'chainBody 0 — AI 몸은 그 전 판');
    free();
  });
});

test('사슬을 이을 마음 — 기울기 (이을수록 · 기력 0 칼 · 무장 쪽 · 불리 · 무계획) · 늘 이음이 아님 · 굴림 없음', () => {
  const { r, draws } = withRandom(null, () => {
    const hi = fake(5);
    const w0 = chainWant(hi, 0.3, 0);
    hi.chain = 2;
    const w2 = chainWant(hi, 0.3, 0);
    assert.ok(w0 > 0.3 && w2 > w0 && w2 < 1, `이을 마음 ${w0.toFixed(3)} → 이어질수록 ${w2.toFixed(3)} (굴림은 남김)`);
    assert.ok(chainWant(hi, 1, 0) <= 1);
    // 기력 장치 (가운데부터): 다음 칼이 세 칼마다 기력 0 칼
    const mid = fake(3);
    const plain = chainWant(mid, 0.3, 0);
    mid.me = { ...mid.me, ibChainOn: () => true, ibFlowChainNow: () => 1, ibLastN: 1, ibChainN0: 0 };
    assert.equal(nextFree(mid.me), true, '사슬 셋째 칼 (n 2 · 첫 칼 n 0)');
    assert.ok(chainWant(mid, 0.3, 0) > plain, '기력 0 칼이면 더 이음');
    mid.me.ibLastN = 0;
    assert.equal(nextFree(mid.me), false);
    const lo = fake(1, { me: { ...mid.me, ibLastN: 1 } });
    const loPlain = fake(1);
    assert.equal(chainWant(lo, 0.3, 0), chainWant(loPlain, 0.3, 0), '낮음은 기력 장치를 안 셈 (무계획)');
    // 높음 + 알티바슈가 남음: 무장 쪽 몫만큼 덜 이음
    assert.ok(chainWant(fake(5), 0.3, 0.8) < chainWant(fake(5), 0.3, 0));
    // 불리 · 맞바꿈을 쓴 뒤 → 빠지는 쪽
    const b = fake(5, { planPh: 'behind', planC: SCHOOL_PLAN.iberian.behind });
    const bw = chainWant(b, 0.3, 0);
    b.me = { ...b.me, ibTradeUsed: true };
    assert.ok(chainWant(b, 0.3, 0) < bw);
    // 유도 ① 뒤 상대가 걸어 들어오면 다음 칼로 받아침
    const l = fake(5, { foeClosing: 0.6 });
    const lw = chainWant(l, 0.3, 0);
    l.ibPlan.lureT = l.sense.t - 0.2;
    assert.ok(chainWant(l, 0.3, 0) > lw);
    // 무계획: 굴림 몫만큼 동전(coin) 쪽 — 칼 끝(맞힘 · 헛침)에 덜 맞춤
    const loA = chainWant(fake(1), 0.75, 0);
    const loB = chainWant(fake(1), 0.3, 0);
    const hiA = chainWant(fake(5), 0.75, 0);
    const hiB = chainWant(fake(5), 0.3, 0);
    assert.ok(Math.abs(loA - loB) < Math.abs(hiA - hiB), '낮음은 칼 끝에 따른 차이가 작음');
    return true;
  });
  assert.ok(r);
  assert.equal(draws(), 0, '셈만 — 굴림 없음');
});

test('원으로 이을 몫 — 맞바꿈이 남으면 더 · 상대 유파 거리(가운데부터) · 버릇 6 s · 되풀이 10 s · 무계획은 덜 가림', () => {
  // 맞바꿈
  const hi = fake(5);
  const left = spinK(hi, 1.8);
  assert.equal(swapReady(hi.me), true);
  hi.me = { ...hi.me, ibTradeUsed: true };
  const used = spinK(hi, 1.8);
  assert.ok(left > used, `남음 ${left.toFixed(3)} > 씀 ${used.toFixed(3)}`);
  const lo = fake(1);
  const loLeft = spinK(lo, 1.8);
  lo.me = { ...lo.me, ibTradeUsed: true };
  assert.ok(loLeft / spinK(lo, 1.8) < left / used, '낮음은 맞바꿈을 덜 셈 (무모 — 원을 아무 때나)');
  // 상대 유파 — 이탈리아: 그 칼끝 어림 안이면 덜 · 독일: 헛친 뒤 맞닿기보다 멀면 덜 · 낮음은 안 읽음
  const it = fake(5, { foe: { swordArt: { tradition: 'italian' } } });
  assert.ok(spinK(it, 1.5) < spinK(it, 2.0), '이탈리아 칼끝 안에서는 원을 덜 시작');
  assert.equal(schoolRead(fake(1, { foe: { swordArt: { tradition: 'italian' } } }), 1.5), 1, '낮음은 상대 유파를 안 읽음');
  const de = fake(5, { hitLanded: false });
  assert.ok(spinK(de, 1.9) < spinK(de, 1.6), '독일 — 헛친 뒤 먼 거리에서 원을 덜');
  assert.equal(schoolRead(fake(5), 1.9), 1, '맞힌 뒤는 그대로');
  assert.ok(schoolRead(fake(3, { hitLanded: false }), 1.9) > schoolRead(fake(5, { hitLanded: false }), 1.9), '높음일수록 또렷');
  // 버릇 (가운데 6.0 s): 원 사이를 친 상대 — 맞바꿈이 남으면 꾀어 맞바꿈(더) · 썼으면 덜
  const m = fake(3);
  const m0 = spinK(m, 1.8);
  m.ibPlan.hitT[0] = m.sense.t - 3;
  assert.equal(habitN(m), 1);
  assert.ok(spinK(m, 1.8) > m0, '버릇 · 맞바꿈 남음 → 더');
  m.me = { ...m.me, ibTradeUsed: true };
  const mUsed0 = spinK(fake(3, { me: { ...m.me } }), 1.8);
  assert.ok(spinK(m, 1.8) < mUsed0, '버릇 · 맞바꿈 씀 → 덜');
  m.ibPlan.hitT[0] = m.sense.t - 7;
  assert.equal(habitN(m), 0, '6.0 s 창 밖');
  // 되풀이 (높음 10.0 s 안에 두 번) — 한 번보다 또렷
  const h = fake(5, { me: { ...fake(5).me, ibTradeUsed: true } });
  h.ibPlan.hitT[0] = h.sense.t - 7;
  const h1 = spinK(h, 1.8);
  assert.equal(habitN(h), 1, '높음은 10.0 s 창');
  h.ibPlan.hitT[1] = h.sense.t - 2;
  assert.ok(spinK(h, 1.8) < h1, '되풀이 — 두 번 곱');
  // 이어 돌리기가 꺼지면 원 후보 없음
  const keep = IB_LINK.ai;
  IB_LINK.ai = 0;
  try {
    assert.equal(spinK(fake(5), 1.8), 0);
  } finally {
    IB_LINK.ai = keep;
  }
});

test('알티바슈 무장 쪽 몫 — 높음 · 비기가 남았을 때 · 기력이 많을수록 (비기 몫 35 위)', () => {
  const { ai, free } = ibAi(5);
  ai.planC = SCHOOL_PLAN.iberian.commit;
  const S = ai.me.stamina;
  S.value = S.max;
  const full = armK(ai);
  S.value = 60;
  const half = armK(ai);
  S.value = STAMINA.secretCost;
  assert.ok(full > half && half > 0 && armK(ai) === 0, `${full.toFixed(3)} > ${half.toFixed(3)} > 0`);
  S.value = S.max;
  ai.planC = SCHOOL_PLAN.iberian.finish;
  assert.equal(armK(ai), 0, '끝내기 — 무장(2 s)보다 곧장 사슬');
  ai.planC = SCHOOL_PLAN.iberian.commit;
  ai.me.secretUsed = 99;
  assert.equal(armK(ai), 0, '비기를 다 씀');
  free();
  const g = ibAi(4);
  g.ai.planC = SCHOOL_PLAN.iberian.commit;
  assert.equal(armK(g.ai), 0, '숙련 4 — 비기 없음');
  g.free();
});

test('버릇 고리 버퍼 — 원 한 번에 한 번 · 굴림 없음 · 새 배열 없음 · 옆 박차기 진행', () => {
  const { ai, free } = ibAi(5);
  const I = ai.ibPlan;
  const buf = I.hitT;
  const { draws } = withRandom(null, () => {
    ai.me.ibLink = {};
    ibTick(ai, 1 / 120, { id: 1 }, false);
    ibTick(ai, 1 / 120, { id: 1 }, false);
    assert.equal(ai.stats.ib.habit, 1, '원 한 번에 한 번');
    ai.me.ibLink = null;
    ibTick(ai, 1 / 120, null, false);
    ai.me.ibLink = {};
    ibTick(ai, 1 / 120, null, false);
    assert.equal(ai.stats.ib.habit, 1, '안 친 원은 안 셈');
    ibTick(ai, 1 / 120, null, true);
    assert.equal(ai.stats.ib.habit, 2, '맞음도 셈');
    ai.me.ibLink = null;
    for (let i = 0; i < 10; i++) {
      ai.me.ibLink = {};
      ibTick(ai, 1 / 120, { id: i }, false);
      ai.me.ibLink = null;
      ibTick(ai, 1 / 120, null, false);
    }
  });
  assert.equal(draws(), 0, '굴림 없음');
  assert.equal(I.hitT, buf, '같은 고리 버퍼 (새 배열 없음)');
  assert.equal(I.hitT.length, 4);
  free();
});

test('넓게 돎 · 옆 박차기 (같은 돌기 굴림 x · 가운데부터는 기력을 봄 — 낮음은 안 봄)', () => {
  const { ai, free } = ibAi(5);
  ai.mode = 'watch';
  ai.planC = SCHOOL_PLAN.iberian.contest;
  ai.d = ai.holdDist();
  ai.circle = 0;
  withRandom(0.99, () => ibCircle(ai, 0.3)); // 옛 줄은 x 0.3 = 멈춤 → 넓게 돎: 멈춤 몫이 줄어 돎
  assert.ok(Math.abs(ai.circle) > ai.pers.circleRate, `돎 ${ai.circle.toFixed(3)} (옆걸음 × 1.5)`);
  assert.equal(ai.ibPlan.dash.on, false, '굴림이 크면 안 박참');
  withRandom(0, () => ibCircle(ai, 0.3));
  assert.equal(ai.ibPlan.dash.on, true, '옆 박차기 몫 (띠 세기 × 칸 dash)');
  assert.equal(ibSide(ai, 0, ai.d, ai.holdDist()), ai.ibPlan.dash.side, '옆 박차기 동안 옆 끝');
  ai.ibPlan.dash.on = false;
  ai.me.stamina.value = 10; // 쉼 문턱 + 박차기 값 밑
  withRandom(0, () => ibCircle(ai, 0.3));
  assert.equal(ai.ibPlan.dash.on, false, '높음 — 기력이 모자라면 안 박참');
  free();
  const lo = ibAi(2);
  lo.ai.mode = 'watch';
  lo.ai.planC = SCHOOL_PLAN.iberian.contest;
  lo.ai.d = lo.ai.holdDist();
  lo.ai.me.stamina.value = 10;
  withRandom(0, () => ibCircle(lo.ai, 0.9));
  assert.equal(lo.ai.ibPlan.dash.on, true, '낮음 — 기력을 안 봄 (무계획 · 바닥까지)');
  lo.free();
  // 간 보기(멀리)에서는 박차지 않음 — 거리 다툼(간 보는 거리 + 0.6 안)에서
  const far = ibAi(5);
  far.ai.mode = 'watch';
  far.ai.planC = SCHOOL_PLAN.iberian.probe;
  far.ai.d = far.ai.holdDist() + 1.5;
  withRandom(0, () => ibCircle(far.ai, 0.9));
  assert.equal(far.ai.ibPlan.dash.on, false);
  far.free();
});

test('고노센 선 — 무 · 낮음은 무모하게 넘음(beat 마다 굴림) · 높음은 굴리지 않고 그대로', () => {
  const lo = fake(2, { gnsW: { ready: true }, chasing: false, spinArm: null });
  lo.ibPlan = { ...lo.ibPlan, out: false, gnsT: 0, gnsCross: false };
  const { r: v } = withRandom(0, () => ibFeetV(lo, -0.4, 2));
  assert.equal(v, 0.18, '선을 넘어 발끝으로 기어 듦');
  assert.equal(lo.stats.ib.gnsCross, 1);
  const { r: v2, draws } = withRandom(0.99, () => ibFeetV(lo, -0.4, 2));
  assert.equal(v2, 0.18, '그 박자 동안 그대로');
  assert.equal(draws(), 0, 'beat 안에서는 다시 안 굴림');
  const hi = fake(5, { gnsW: { ready: true }, chasing: false, spinArm: null });
  hi.ibPlan = { ...hi.ibPlan, out: false, gnsT: 0, gnsCross: false };
  const { r: vh, draws: dh } = withRandom(0, () => ibFeetV(hi, -0.4, 2));
  assert.equal(vh, -0.4);
  assert.equal(dh(), 0, '높음 — 굴림 없음');
  // 칼끝 밖 무장 기다림: 내 칼끝 거리 + outStep 안이면 물러섬
  const o = fake(5, { spinArm: { armed: false }, gnsW: null });
  o.ibPlan = { ...o.ibPlan, out: true };
  assert.ok(ibFeetV(o, 0.18, o.M.reach) < 0);
  assert.equal(ibFeetV(o, 0.18, o.M.reach + 0.5), 0.18);
});

test('판: AI 이베리아 숙련 2 대 롱소드 AI — 국면 · 이베리아 행동(사슬 · 이어 돌리기 · 원으로 이음 · 옆 박차기)이 남', () => {
  const tot = { judges: 0, cont: 0, end: 0, link: 0, spin: 0, dash: 0, phT: 0 };
  for (const seed of [1, 3, 6]) {
    const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'zweihander', AI2Class: AI, persona: { proficiency: 2 }, persona2: { proficiency: 2 } });
    while (G.t < 20 && G.player.alive && G.enemy.alive) G.step();
    const st = G.ai.stats;
    tot.judges += st.plan.judges;
    tot.phT += Object.values(st.plan.t).reduce((a, b) => a + b, 0);
    tot.cont += st.ib.cont;
    tot.end += st.ib.end;
    tot.spin += st.ib.spinPick;
    tot.dash += st.ib.dash;
    tot.link += st.ibLink?.fired ?? 0;
    G.world.free();
  }
  assert.ok(tot.judges > 0 && tot.phT > 0, '국면 시간이 쌓임');
  assert.ok(tot.cont + tot.end > 0, `이베리아 사슬 판단 ${JSON.stringify(tot)}`);
  assert.ok(tot.link > 0, '이어 돌리기');
  assert.ok(tot.spin + tot.dash > 0, '원으로 이음 · 옆 박차기');
});

test('스위치 끔 = 옛 판 (이베리아 — `?aiPlan=0` · 이베리아만 뺌이 같고 켬은 다름) · 다른 유파는 이베리아 칸을 안 읽음', () => {
  const off = withPlan({ on: 0 }, () => trace({ prof: 2 }));
  const none = withPlan({ schools: ['italian'], errSchools: ['italian'] }, () => trace({ prof: 2 }));
  const on = trace({ prof: 2 });
  assert.equal(off.ib, false);
  assert.equal(off.chainOn, false, '옛 판 AI 몸 — B6 없음');
  assert.equal(off.text, none.text, '끔 = 옛 길 (파고들기도 안 걸림 — 츠바이핸더는 짧지 않음)');
  assert.equal(on.ib, true);
  assert.equal(on.chainOn, true);
  assert.notEqual(on.text, off.text, '켬은 판이 달라짐');
  // 이탈리아 · 롱소드 판은 이베리아를 켜도 그대로
  for (const w of ['rapier', 'longsword']) {
    const a = trace({ weapon2: w, prof: 2, secs: 4 });
    const b = withPlan({ schools: ['italian'], errSchools: ['italian'] }, () => trace({ weapon2: w, prof: 2, secs: 4 }));
    assert.equal(a.text, b.text, `${w} 판`);
  }
});
