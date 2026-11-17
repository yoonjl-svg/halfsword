// 유파 AI 기본 전투 흐름 1 단계 시험 (11/14 — src/ai_plan.js · ai.js plan* · config AI_PLAN · 설계안 docs/design/ai_school_baseline_2026-11-14.md §9):
//  띠 · 기울기 · 거리 오차 값 · 플랜 열림(유파 · 띠 무 · 스위치) · 국면 판정 일곱 · 사건이 나면 같은 스텝에 다시 판정 · 0.2 s 박자는 굴림을 안 더함 ·
//  전략 층은 반사 층 상태를 건드리지 않음 · 이탈리아 행동이 숙련도에 따라 열림 · 리솔루토 맞춤 걸음은 본 걸음 · 플랜 없는 유파는 바이트 같음 · 스위치 끔 = 옛 판.
//  인물 숙련도 새 배치(§10 — 시트 · 얼터 · 생사전 카드 · 고용 금화).
//  11/14 덧붙임(§11): 무 · 낮음 띠 '행운에 기대는 전투'(굴림 몫 · 무모 · 무계획 — 성급함 아님 · 플랜 유파만) · 띠별 기력 셈 · 파고들기(공통 틀 — 내 칼이 뚜렷이 짧을 때만).
//  2 단계 일본(§12): 플랜 · 스택 · 바위 몸 AI · 스택 문턱 기울기 · 막기 쪽 · 버릇 · 되풀이 · 제비 베기 · 유도 · 옛 판 스위치.
//  시간 상한 기준은 없다.  node --test tools/sim/ai_plan.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { bandOf, tiltOf, luckOf, distErrWidth, planFor, judgePhase, seenStep, axesOf, PHASES } from '../../src/ai_plan.js';
import { foeStep, mirrorOk, mirrorStep } from '../../src/italian_risoluto.js';

const { AI_PLAN, JP_TANK } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
/** AI_PLAN 칸을 잠깐 바꿔 fn 을 돌리고 되돌림 */
function withPlan(over, fn) {
  const keep = { ...AI_PLAN };
  Object.assign(AI_PLAN, over);
  try {
    return fn();
  } finally {
    Object.assign(AI_PLAN, keep);
  }
}
/** AI 둘 판 (자리 0 = 롱소드 AI · 자리 1 = weapon2 AI) — secs 초 돌리며 몸 자리 · 피를 30 스텝마다 적은 글 */
function trace({ weapon2 = 'longsword', prof = 2, secs = 4, seed = 2 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const ai = G.ai;
  const r = { text: out.join(';'), plan: !!ai.plan, stats: ai.stats.plan ?? null, distErr: ai.distErr };
  G.world.free();
  return r;
}
/** 판을 만들고 시작 정지를 지난 뒤 이탈리아(레이피어) AI 하나 — 상대 롱소드 */
function itAi(prof) {
  const G = newRound({ weapon: 'longsword', weapon2: 'rapier', seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof });
  return { G, ai, free: () => G.world.free() };
}

test('띠 · 기울기 · 거리 오차 — 사장님 11/14 띠(0 무 · 1 ~ 2 낮음 · 3 ~ 4 가운데 · 5 ~ 6 높음)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(bandOf), [0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(tiltOf).map((x) => +x.toFixed(4)), [0, 0.3333, 0.3333, 0.6667, 0.6667, 1, 1]);
  const w = [0, 1, 2, 3, 4, 5, 6].map((p) => +distErrWidth(p, 'italian').toFixed(4));
  assert.deepEqual(w, [0.3, 0.24, 0.18, 0.12, 0.06, 0, 0], '0.3 m × (1 − 숙련도 ÷ 5) · 높음 0');
  const A = axesOf(4, 'italian');
  assert.equal(A.band, 2);
  assert.equal(A.lure, true);
  assert.equal(axesOf(3, 'italian').lure, false, '유도는 가운데 끝(4)부터');
  assert.equal(axesOf(1, 'italian').link, true);
  assert.equal(axesOf(0, 'italian').link, false);
  assert.ok(['italian', 'japanese', 'iberian', 'chinese', 'german'].every((t) => AI_PLAN.schools.includes(t)), '1 단계 이탈리아 · 2 단계 일본 · 이베리아 · 동방 · 3 단계 독일');
});

test('플랜 열림: 이탈리아 · 띠 무 아님 · 스위치 — 다른 유파는 없음', () => {
  assert.ok(planFor('italian', 2));
  assert.equal(planFor('italian', 0), null, '무 = 플랜 없음');
  for (const t of ['japanese', 'iberian', 'chinese', 'german']) assert.ok(planFor(t, 2), `2 · 3 단계 ${t}`);
  const P = planFor('italian', 3);
  for (const ph of PHASES) assert.ok(P[ph], ph);
  for (const ph of PHASES) for (const v of Object.values(P[ph])) assert.ok(v >= 0 && v <= 1, '칸 = 고를 몫 0 ~ 1 (기울기 — 반드시가 아님)');
});

test('국면 판정 일곱 — 위에서부터', () => {
  const mk = (o = {}) => ({ me: { stamina: { exhausted: false } }, foe: { state: 'stand', stamina: {} }, staminaRest: false, desperate: false, cautious: false, lastHurtT: null, sense: { t: 10 }, mode: 'watch', riso: null, press: null, holdDist: () => 2, ...o });
  assert.equal(judgePhase(mk(), 4), 'probe');
  assert.equal(judgePhase(mk(), 2.3), 'contest');
  assert.equal(judgePhase(mk({ mode: 'defend' }), 2.3), 'commit');
  assert.equal(judgePhase(mk({ cautious: true, mode: 'attack' }), 2.3), 'ahead');
  assert.equal(judgePhase(mk({ cautious: true, foe: { state: 'down', stamina: {} } }), 2.3), 'finish');
  assert.equal(judgePhase(mk({ riso: { win: 0.2 } }), 4), 'finish', '내 비기 창');
  assert.equal(judgePhase(mk({ lastHurtT: 9.5, riso: { win: 0.2 } }), 4), 'behind', '맞은 뒤 1.2 s 안');
  assert.equal(judgePhase(mk({ lastHurtT: 8 }), 4), 'probe', '1.2 s 지남');
  assert.equal(judgePhase(mk({ desperate: true, staminaRest: true }), 4), 'tired');
  assert.equal(judgePhase(mk({ me: { stamina: { exhausted: true } } }), 4), 'tired');
});

test('리솔루토 맞춤 걸음은 본 걸음 — 사람 스틱을 읽지 않음', () => {
  assert.equal(seenStep(0.5), 'advance');
  assert.equal(seenStep(-0.5), 'retreat');
  assert.equal(seenStep(0.1), null);
  const me = { stickX: 0, stickY: -1 };
  for (const y of [-1, 0, 1]) assert.equal(mirrorOk(me, { move: { x: 0, y } }), mirrorStep(me, foeStep({ move: { x: 0, y } })), 'mirrorOk = mirrorStep(foeStep) — 사람 창 그대로');
  const { ai, free } = itAi(5);
  assert.equal(typeof ai.riso?.W.stepOf, 'function', '플랜 있는 리솔루토 AI');
  ai.foe.move.set(0, 1); // 사람 스틱은 앞(들어옴)인데
  ai.foeClosing = 0; // 본 다가옴은 0
  assert.equal(ai.riso.W.stepOf(), null, '본 것만');
  ai.foeClosing = 0.6;
  assert.equal(ai.riso.W.stepOf(), 'advance');
  free();
});

test('3 단계 셋 합침 (감독 11/14 — 공정함 ①): 플랜 없는 몸(planOff · 무 띠)의 리솔루토 맞춤 걸음도 공정함 스위치가 켜졌으면 본 걸음 · 끄면(또는 옛 판) 사람 스틱', () => {
  for (const [over, seen] of [[{}, true]]) {
    withPlan(over, () => {
      const G = newRound({ weapon: 'longsword', weapon2: 'rapier', seed: 1, gap: 2.4 });
      G.ai.update = () => {};
      while (G.t < 0.3) G.step();
      const ai = new AI(G.enemy, G.player, 'normal', { proficiency: 5, planOff: true }); // 플랜 없는 몸(planOff — 무 띠와 같은 길) · 비기(리솔루토)는 숙련 5
      const free = () => G.world.free();
      assert.equal(ai.plan, null, '플랜 없음');
      assert.equal(typeof ai.riso?.W.stepOf, 'function', '리솔루토 AI');
      ai.foe.move.set(0, 1); // 사람 스틱은 앞(들어옴)
      ai.foeClosing = 0; // 본 다가옴은 0
      assert.equal(ai.riso.W.stepOf(), seen ? null : 'advance', seen ? '본 것만' : '옛 줄 — 사람 스틱');
      free();
    });
  }
});

test('이탈리아 행동이 숙련도(띠)에 따라 열림', () => {
  const got = [0, 1, 2, 3, 4, 5, 6].map((p) => {
    const { ai, free } = itAi(p);
    const r = { p, plan: !!ai.plan, k: ai.planK ?? 0, lure: !!ai.planLure, err: ai.distErr, riso: !!ai.riso };
    free();
    return r;
  });
  assert.deepEqual(got.map((r) => r.plan), [false, true, true, true, true, true, true], '무 = 플랜 없음');
  assert.deepEqual(got.map((r) => +r.k.toFixed(3)), [0, 0.333, 0.333, 0.667, 0.667, 1, 1]);
  assert.deepEqual(got.map((r) => r.lure), [false, false, false, false, true, true, true], '유도 4 부터');
  for (const r of got) {
    const w = distErrWidth(r.p, 'italian');
    if (w > 0) assert.ok(r.err != null && Math.abs(r.err) <= w + 1e-12, `숙련도 ${r.p} 오차 ±${w}`);
    else assert.equal(r.err, undefined, `숙련도 ${r.p} 오차 없음 (굴리지 않음)`);
  }
  assert.deepEqual(got.map((r) => r.riso), [false, false, false, false, false, true, true], '리솔루토 = 지금 비기 숙련도 5');
});

test('전략 층: 사건이 나면 같은 스텝에 다시 판정 · 박자 사이엔 그대로 · 굴림 없음 · 반사 층 상태를 안 건드림', () => {
  const { ai, free } = itAi(3);
  const s = { hvx: 0, hvy: 0, state: 'stand' };
  ai.planT = 10; // 박자가 멀다
  ai.mode = 'watch';
  ai.d = 4;
  const judges0 = ai.stats.plan.judges;
  // 굴림 셈 · 반사 층 상태 사본
  const rnd = Math.random;
  let draws = 0;
  Math.random = () => (draws++, rnd());
  const before = JSON.stringify({ mode: ai.mode, phase: ai.phase, timer: ai.timer, hand: [ai.hand.x, ai.hand.y], tech: ai.tech?.name ?? null, threatSeen: ai.threatSeen });
  try {
    ai.planTick(1 / 120, 4, false, s);
    assert.equal(ai.stats.plan.judges, judges0, '사건 없고 박자 전 — 다시 보지 않음');
    ai.mode = 'attack'; // 꼴이 바뀌어도 박자 전이면 국면 그대로
    ai.planTick(1 / 120, 4, false, s);
    assert.equal(ai.planPh, 'probe');
    ai.mode = 'watch';
    ai.planTick(1 / 120, 4, true, s); // 맞음 = 사건
    assert.equal(ai.planPh, 'behind', '맞은 그 스텝에 불리할 때');
    assert.equal(ai.stats.plan.events, 1);
    ai.lastHurtT = -100;
    ai.planTick(1 / 120, 4, false, { ...s, state: 'down' }); // 상대가 넘어짐 = 사건
    assert.equal(ai.planPh, 'finish');
    ai.planT = 0; // 박자가 됨
    ai.planTick(1 / 120, 4, false, { ...s, state: 'down' });
    assert.ok(ai.planT > 0 && near(ai.planT, AI_PLAN.tick - 1 / 120, 1e-6), '박자는 tick 마다 (엇갈림 유지)');
    assert.equal(draws, 0, '전략 층은 굴림을 안 더함');
    const after = JSON.stringify({ mode: ai.mode, phase: ai.phase, timer: ai.timer, hand: [ai.hand.x, ai.hand.y], tech: ai.tech?.name ?? null, threatSeen: ai.threatSeen });
    assert.equal(after, before, '반사 층 상태 그대로');
  } finally {
    Math.random = rnd;
    free();
  }
});

test('AI 여럿 — 처음 박자를 자리 번호로 엇갈림', () => {
  const G = newRound({ weapon: 'rapier', weapon2: 'rapier', seed: 1 });
  const a = new AI(G.player, G.enemy, 'normal', { proficiency: 3 });
  const b = new AI(G.enemy, G.player, 'normal', { proficiency: 3 });
  assert.ok(a.planT !== b.planT, `${a.planT} ≠ ${b.planT}`);
  G.world.free();
});

test('인물 숙련도 새 배치 (사장님 11/14 — §10): 시트 · 얼터 + 1 · 못 박음 · 생사전 카드 숫자 · 고용 금화', async () => {
  const { CHARACTERS_BY_ID: C } = await import('../../src/characters.js');
  const { proficiencyOf } = await import('../../src/saengsa_proficiency.js');
  const { hireCostOf } = await import('../../src/saengsa_roster.js');
  const { SAENGSA } = await import('../../src/config.js');
  const want = { bran: 0, heinrich: 3, margarethe: 4, omari: 3, renji: 3, liao: 4, eira: 2, terracotta: 2, chanda: 3, isolde: 1, tome: 2, minami: 5, samira: 4, ratna: 2, silver_wanderer: 4 };
  for (const [id, p] of Object.entries(want)) assert.equal(C[id].ai.proficiency, p, id);
  const mad = { bran_mad: 1, heinrich_mad: 4, margarethe_mad: 5, omari_mad: 4, renji_mad: 4, liao_mad: 5, eira_mad: 3, samira_mad: 5, silver_wanderer_mad: 6, terracotta_mad: 5 };
  for (const [id, p] of Object.entries(mad)) assert.equal(C[id].ai.proficiency, p, id);
  assert.equal(C.heinrich_mad.ai.persona.proficiency.italian, 4, '광기의 하인리히 이탈리아 4 — 비기 없음(5 부터)');
  // 생사전 카드 숫자 = 다섯 유파 표 (주 유파 칸 = 시트)
  for (const [id, school, p] of [['bran', 'none', 0], ['heinrich', 'german', 3], ['margarethe', 'german', 4], ['omari', 'iberian', 3], ['renji', 'none', 3], ['liao', 'chinese', 4], ['eira', 'italian', 2], ['silver_wanderer_mad', 'japanese', 6]]) assert.equal(proficiencyOf(id)[school], p, `${id} 카드`);
  // 고용 금화 = 바탕 + 걸음 × 가장 높은 숙련도
  for (const [id, best] of [['bran', 0], ['heinrich', 3], ['margarethe', 4], ['liao', 4], ['eira', 2]]) assert.equal(hireCostOf(id).coins, SAENGSA.hire.base + SAENGSA.hire.step * best, `${id} 고용`);
});

test('무 · 낮음 띠 = 행운에 기대는 전투 (사장님 11/14): 굴림 몫 · 무모 · 무계획 — 성급함 아님 · 플랜 유파만', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(luckOf).map((x) => +x.toFixed(4)), [1, 0.6667, 0.6667, 0.3333, 0.3333, 0, 0], '1 − 기울기');
  assert.equal(+axesOf(2, 'italian').luck.toFixed(4), 0.6667);
  const lo = itAi(2);
  const hi = itAi(5);
  const rnd = Math.random;
  let draws = 0;
  Math.random = () => (draws++, rnd());
  try {
    assert.ok(near(lo.ai.planLuck, 2 / 3) && hi.ai.planLuck === 0);
    // 빈틈 판단 흐림: 높음은 굴리지 않고 그대로 · 낮음은 beat 마다 한 번 굴려 붙잡음 (같은 장면에서도 판마다 다름)
    assert.equal(hi.ai.planGamble(0.7), 0.7);
    assert.equal(draws, 0, '높음 — 굴림 없음');
    const a = lo.ai.planGamble(0.7);
    const b = lo.ai.planGamble(0.7);
    assert.equal(draws, 1, 'beat 안에서는 한 번만');
    assert.equal(a, b);
    assert.ok(Math.abs(a - 0.7) <= AI_PLAN.luckAmp * lo.ai.planLuck + 1e-12, '흐림 폭 = luckAmp × 굴림 몫');
    // 무모: 위협 하나에 한 번 굴림 · 높음은 늘 접음(굴림 없음)
    draws = 0;
    assert.equal(hi.ai.planReck({ id: 7 }), false);
    assert.equal(draws, 0);
    const r1 = lo.ai.planReck({ id: 7 });
    assert.equal(lo.ai.planReck({ id: 7 }), r1, '같은 위협은 같은 답');
    assert.equal(draws, 1);
  } finally {
    Math.random = rnd;
  }
  // 무모: 상대 칼끝 밖 여유를 덜 셈 (굴림 몫만큼) — 참을성 · 박자(기질)는 그대로
  const h0 = lo.ai.holdDist();
  const keepLuck = lo.ai.planLuck;
  lo.ai.planLuck = 0;
  const h1 = lo.ai.holdDist();
  lo.ai.planLuck = keepLuck;
  assert.ok(h0 < h1, `여유 ${h0.toFixed(3)} < ${h1.toFixed(3)}`);
  // 기력 (① 무기 이해 — 기력): 무계획은 쉼 문턱이 바닥 쪽 · 높음 + 비기 남음은 비기 몫(35)을 남겨 둠
  lo.ai.d = 1.0; // 상대 칼끝 안 — 안전하지 않음
  lo.ai.foeClosing = 0;
  const r0 = lo.ai.restAt;
  const rl = lo.ai.planRestAt();
  assert.ok(rl <= r0 && (r0 > CONFIG.STAMINA.aiAggressiveRestAt ? rl < r0 : true), `낮음 쉼 문턱 ${rl} ≤ ${r0}`);
  hi.ai.d = 1.0;
  hi.ai.foeClosing = 0;
  assert.ok(hi.ai.riso && hi.ai.planRestAt() >= CONFIG.STAMINA.secretCost, '높음 · 비기 남음 → 비기 몫을 남김');
  lo.free();
  hi.free();
});

test('파고들기 (사장님 11/14 — 공통 틀): 내 칼이 상대 칼보다 뚜렷이 짧을 때만 · 모든 유파 · 스위치 끔 = 옛 판', () => {
  const digOf = (w, foe = 'longsword') => {
    const G = newRound({ seed: 1, weapon: foe, weapon2: w, AI2Class: AI, persona: { proficiency: 2 }, persona2: { proficiency: 2 } });
    const r = { me: G.ai.digNow(), foe: G.ai2.digNow(), k: G.ai.digK };
    G.world.free();
    return r;
  };
  for (const w of ['morgenstern', 'frozen_tuna', 'rubber_chicken', 'uchigatana']) {
    const r = digOf(w);
    assert.equal(r.me, true, `${w} AI 대 롱소드`);
    assert.equal(r.foe, false, `롱소드 AI 대 ${w} — 긴 쪽은 아님`);
  }
  for (const w of ['longsword', 'rapier', 'monohoshizao', 'zweihander']) assert.equal(digOf(w).me, false, `${w} — 뚜렷이 짧지 않음 (롱소드끼리 거울 판은 그대로)`);
  assert.ok(near(digOf('morgenstern').k, 1 / 3), '띠 기울기 (낮음 ⅓ — 유파와 상관없이)');
});


/** 판을 만들고 시작 정지를 지난 뒤 일본 AI 하나 — 상대 롱소드 */
function jpAi(prof, weapon = 'uchigatana') {
  const G = newRound({ weapon: 'longsword', weapon2: weapon, seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof });
  return { G, ai, free: () => G.world.free() };
}


test('2 단계 일본 — 기울기: 스택 문턱 · 막기 쪽 · 서 있기 · 기술 · 버릇 · 되풀이 · 제비 베기 (절대 규칙 없음)', async () => {
  const { jpNeed, jpVoid, jpStill, jpTechK, jpSeeThreat, jpGuardChance, jpRead, jpTsubame } = await import('../../src/ai_plan_jp.js');
  const { ai, free } = jpAi(5);
  const rnd = Math.random;
  try {
    ai.planC = ai.plan.contest;
    const sp = ai.me.schoolPassive;
    sp.stk = 0;
    const n0 = jpNeed(ai, { kind: 'patience' });
    sp.stk = CONFIG.JP_TANK.max;
    const n10 = jpNeed(ai, { kind: 'patience' });
    assert.ok(n0 > 0 && n10 < 0, `스택 0 → 참음 ${n0} · 가득 → 먼저 ${n10}`);
    assert.equal(jpNeed(ai, { kind: 'recover' }), 0, '헛친 뒤 같은 큰 틈엔 스택 몫을 안 얹음');
    const heavy = Object.values(ai.school.techByName).find((t) => t.presses);
    assert.ok(heavy && jpTechK(ai, heavy) > 1, '가득 — 크고 단순한 내려베기를 더 고름');
    sp.stk = 0;
    assert.ok(jpVoid(ai, 0.8) < 0.8 && jpVoid(ai, 0.8) > 0, '피하기 몫이 줄지만 0 은 아님');
    assert.ok(jpStill(ai) > 0 && jpStill(ai) <= CONFIG.AI_PLAN_JP.still);
    // 버릇 (가운데부터): 같은 줄이 다시 오면 막을 눈 몫이 큼 · 다른 줄은 그대로
    const gc = 0.6;
    jpSeeThreat(ai, { line: 'highL' });
    assert.ok(jpGuardChance(ai, { line: 'highL' }, gc) > gc);
    assert.equal(jpGuardChance(ai, { line: 'lowR' }, gc), gc);
    // 되풀이 (높음): 같은 줄 두 번 → 그 줄이 새로 읽힐 때 한 번 굴려 흘려 받기 자리를 미리 (줄이 그대로면 다시 안 굴림)
    jpSeeThreat(ai, { line: 'highL' });
    Math.random = () => 0;
    jpRead(ai);
    assert.equal(ai.jpPre, 'highL');
    Math.random = () => 0.999;
    jpRead(ai);
    assert.equal(ai.jpPre, 'highL', '같은 줄이면 다시 굴리지 않음');
    ai.jpRep = null;
    jpRead(ai);
    assert.equal(ai.jpPre, null, '굴림 — 늘은 아님');
    // 제비 베기: 내려벤 칼이 빗나감 → 굴림 몫으로 이어 냄
    const down = Object.values(ai.school.techByName).find((t) => t.kind === 'cut' && t.from?.[1] > 0 && t.name !== 'tsubameGaeshi');
    ai.tech = down;
    ai.hitLanded = false;
    ai.chain = 0;
    Math.random = () => 0;
    assert.equal(jpTsubame(ai, true), true);
    assert.equal(ai.tech.name, 'tsubameGaeshi');
    assert.equal(jpTsubame(ai, true), false, '제비 베기 다음엔 다시 안 냄');
  } finally {
    Math.random = rnd;
    free();
  }
  // 낮음(숙련 2): 버릇 · 되풀이 몫 없음 · 스택 판 아님
  const lo = jpAi(2);
  try {
    lo.ai.planC = lo.ai.plan.contest;
    jpSeeThreat(lo.ai, { line: 'highL' });
    assert.equal(jpGuardChance(lo.ai, { line: 'highL' }, 0.6), 0.6, '낮음 — 버릇 안 읽음');
    assert.equal(jpNeed(lo.ai, { kind: 'patience' }), 0, '스택 판 아님 → 스택 몫 없음');
  } finally {
    lo.free();
  }
});

/** 롱소드(독일) AI 하나 — 상대 weapon (AI 멈춤) */
function deAi(prof, foeWeapon = 'longsword', persona = {}) {
  const G = newRound({ weapon: foeWeapon, weapon2: 'longsword', seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < (CONFIG.ARENA.startHold ?? 0) + 0.1) G.step(); // 판 시작 정지(발 묶임)를 지남 — 박찬 걸음 장치가 걸리게
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof, ...persona });
  return { G, ai, free: () => G.world.free() };
}


test('3 단계 독일 — 내 기력 ↔ 상대 기력의 차 (우위면 밀어 묶음 · 열세면 숨 고름 · 띠가 높을수록 또렷 · 높음은 바위 몸 상대면 뒤집음)', async () => {
  const { deDiff, deCloseCfg, deHoldM } = await import('../../src/ai_plan_de.js');
  const hi = deAi(5);
  const lo = deAi(2);
  try {
    for (const x of [hi, lo]) x.ai.planC = x.ai.plan.contest;
    const set = (x, me, foe) => ((x.ai.me.stamina.value = me), (x.ai.foe.stamina.value = foe));
    set(hi, 100, 20);
    const up = deDiff(hi.ai);
    const rUp = deCloseCfg(hi.ai, 0).rate;
    set(hi, 20, 100);
    const down = deDiff(hi.ai);
    const rDown = deCloseCfg(hi.ai, 0).rate;
    assert.ok(up > 0 && down < 0 && rUp > rDown, `우위 ${up} · 열세 ${down} — 밀 몫 ${rUp} > ${rDown}`);
    assert.ok(deHoldM(hi.ai, 0.3) > deHoldM((set(hi, 100, 20), hi.ai), 0.3), '열세면 칼끝 밖 여유가 큼 (숨 고름)');
    set(lo, 100, 20);
    const loUp = deDiff(lo.ai);
    assert.ok(loUp > 0 && loUp < up * 0.5, `낮음은 거의 안 셈 (무계획) ${loUp} ≪ ${up}`);
  } finally {
    hi.free();
    lo.free();
  }
  // 바위 몸 상대(일본 숙련 5 AI — 스택 판 · 밀치기 기력 0): 높음은 우위여도 밀어 지치게 할 수 없음 → 열세 쪽
  const G = newRound({ seed: 1, weapon: 'uchigatana', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    ai.planC = ai.plan.contest;
    ai.me.stamina.value = 100;
    ai.foe.stamina.value = 20;
    assert.ok(G.ai2.me.schoolPassive.stackOn, '상대 일본 스택 판');
    assert.ok(deDiff(ai) < 0, '바위 몸 상대 — 셈이 뒤집힘');
  } finally {
    G.world.free();
  }
});

test('독일 붙은 거리 연계 (사장님 11/15 결정 (나) · (다)): 낮은 띠 파고들기 굴림 몫 · 맞닿기 안 헛침에 밀 마음', async () => {
  const { deDigTry, deCloseCfg, deFeet } = await import('../../src/ai_plan_de.js');
  const DE = CONFIG.AI_PLAN_DE;
  const R = Math.random;
  const s = { state: 'stand' };
  /** 헛침 한 번 (거둠 → 멈춤) 을 굴림 값 u 로 — 건 수 · 밀 마음 */
  const whiff = (x, d, u) => {
    const ai = x.ai;
    ai.me.gait.burst = null;
    ai.deDig.t = ai.deDig.after = 0;
    ai.deDig.push = false;
    deDigTry(ai, s, d, false);
    Math.random = () => u;
    try {
      return deDigTry(ai, s, d, true);
    } finally {
      Math.random = R;
    }
  };
  const lo = deAi(2);
  const hi = deAi(5);
  try {
    for (const x of [lo, hi]) x.ai.planC = x.ai.plan.contest;
    // (나) 칸 몫 1 에서 낮음 0.2 → 0.4 (계획 몫 × (1 − 굴림 몫) + 동전 × 굴림 몫) · 높음 0.6 그대로 (굴림 몫 0)
    const far = (x) => x.ai.M.contact + 0.2;
    assert.equal(whiff(lo, far(lo), 0.3), true, '(나): 낮음 0.4 몫 — 0.3 굴림이 남');
    assert.equal(whiff(lo, far(lo), 0.41), false, '(나): 낮음 0.4 몫 위는 안 남 (기울기 — 늘은 아님)');
    assert.equal(whiff(hi, far(hi), 0.59), true, '높음 0.6 그대로');
    assert.equal(whiff(hi, far(hi), 0.61), false, '높음 0.6 그대로');
    // (다) 맞닿기(무기 간격표 contact — 내가 믿는 거리) 안 헛침: 끄면 굴림 없음 · 켜면 밀 몫으로 굴려 걸어 들어감 → 들어서면 굴림 없이 밂
    const near = (x) => x.ai.M.contact - 0.3;
    hi.ai.closeInside = false;
    assert.equal(whiff(hi, near(hi), 0.99), false, '켬: 밀 몫(늘은 아님)으로 굴림');
    assert.equal(hi.ai.stats.plan.de.pushTry, 1);
    assert.equal(whiff(hi, near(hi), 0), true, '켬: 밀 마음이 남');
    assert.ok(hi.ai.deDig.push && hi.ai.deDig.t > 0, '밖이면 파고들기와 같은 창으로 걸어 들어감 (공격 미룸)');
    assert.equal(hi.ai.me.gait.burst, null, '박찬 걸음은 아님 (걸어 들어감)');
    assert.equal(deCloseCfg(hi.ai, 0).rate, 1, '들어서면 굴림 없이 민다');
    assert.equal(deFeet(hi.ai, 0.01, 1.3, 1.0), 1, '닿는 거리 밖 — 스틱 앞 끝');
    hi.ai.closeWant = true;
    deFeet(hi.ai, 0.01, 0.9, 1.0);
    assert.equal(hi.ai.deDig.push, false, '밀었으면 밀 마음을 지움');
    assert.ok(deCloseCfg(hi.ai, 0).rate < 1, '그 뒤는 평소 밀 몫');
    hi.ai.closeWant = false;
    hi.ai.closeInside = true;
    assert.equal(whiff(hi, 0.95, 0), true);
    assert.equal(hi.ai.closeWant, true, '이미 닿는 거리 안이면 곧장 민다');
  } finally {
    Math.random = R;
    lo.free();
    hi.free();
  }
});

