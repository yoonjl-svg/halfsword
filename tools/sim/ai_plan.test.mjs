// 유파 AI 기본 전투 흐름 1 단계 시험 (11/14 — src/ai_plan.js · ai.js plan* · config AI_PLAN · 설계안 docs/design/ai_school_baseline_2026-11-14.md §9):
//  띠 · 기울기 · 거리 오차 값 · 플랜 열림(유파 · 띠 무 · 스위치) · 국면 판정 일곱 · 사건이 나면 같은 스텝에 다시 판정 · 0.2 s 박자는 굴림을 안 더함 ·
//  전략 층은 반사 층 상태를 건드리지 않음 · 이탈리아 행동이 숙련도에 따라 열림 · 리솔루토 맞춤 걸음은 본 걸음 · 플랜 없는 유파는 바이트 같음 · 스위치 끔 = 옛 판.
//  인물 숙련도 새 배치(§10 — 시트 · 얼터 · 생사전 카드 · 고용 금화). 시간 상한 기준은 없다.  node --test tools/sim/ai_plan.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { bandOf, tiltOf, distErrWidth, planFor, judgePhase, seenStep, axesOf, PHASES } from '../../src/ai_plan.js';
import { foeStep, mirrorOk, mirrorStep } from '../../src/italian_risoluto.js';

const { AI_PLAN } = CONFIG;
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
  assert.equal(distErrWidth(2, 'german'), 0, '1 단계는 이탈리아만');
  withPlan({ on: 0 }, () => assert.equal(distErrWidth(0, 'italian'), 0, '스위치 끔'));
  const A = axesOf(4, 'italian');
  assert.equal(A.band, 2);
  assert.equal(A.lure, true);
  assert.equal(axesOf(3, 'italian').lure, false, '유도는 가운데 끝(4)부터');
  assert.equal(axesOf(1, 'italian').link, true);
  assert.equal(axesOf(0, 'italian').link, false);
  assert.equal(AI_PLAN.on, 1, '1 단계 기본 켬');
  assert.deepEqual(AI_PLAN.schools, ['italian']);
});

test('플랜 열림: 이탈리아 · 띠 무 아님 · 스위치 — 다른 유파는 없음', () => {
  assert.ok(planFor('italian', 2));
  assert.equal(planFor('italian', 0), null, '무 = 플랜 없음');
  for (const t of ['german', 'japanese', 'chinese', 'iberian', 'none']) assert.equal(planFor(t, 5), null, t);
  withPlan({ on: 0 }, () => assert.equal(planFor('italian', 5), null));
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

test('플랜 없는 유파는 바이트 같음 (롱소드 AI 끼리 · 켬 = 끔)', () => {
  const on = trace({ weapon2: 'longsword', prof: 2 });
  const off = withPlan({ on: 0 }, () => trace({ weapon2: 'longsword', prof: 2 }));
  assert.equal(on.plan, false);
  assert.equal(on.text, off.text);
  const on5 = trace({ weapon2: 'uchigatana', prof: 5, secs: 3 });
  const off5 = withPlan({ on: 0 }, () => trace({ weapon2: 'uchigatana', prof: 5, secs: 3 }));
  assert.equal(on5.text, off5.text, '일본 숙련 5');
});

test('스위치 끔 = 옛 판 (이탈리아 — 끔 · 플랜 유파 비움이 같고 켬은 다름)', () => {
  const off = withPlan({ on: 0 }, () => trace({ weapon2: 'rapier', prof: 2 }));
  const none = withPlan({ schools: [], errSchools: [] }, () => trace({ weapon2: 'rapier', prof: 2 }));
  const on = trace({ weapon2: 'rapier', prof: 2 });
  assert.equal(off.plan, false);
  assert.equal(off.text, none.text, '끔 = 옛 길');
  assert.equal(on.plan, true);
  assert.notEqual(on.text, off.text, '켬은 판이 달라짐');
  assert.ok(on.stats.judges > 0 && Object.values(on.stats.t).reduce((x, y) => x + y, 0) > 0, '국면 시간이 쌓임');
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
