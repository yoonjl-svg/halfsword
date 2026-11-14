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
  const jk = JP_TANK.ai;
  Object.assign(AI_PLAN, over);
  if (!AI_PLAN.on) JP_TANK.ai = 0; // 옛 판 = AI 일본 스택 · 바위 몸도 끔 (main.js `?aiPlan=0` 과 같게)
  try {
    return fn();
  } finally {
    Object.assign(AI_PLAN, keep);
    JP_TANK.ai = jk;
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
  assert.ok(['italian', 'japanese', 'iberian', 'chinese'].every((t) => AI_PLAN.schools.includes(t)), '1 단계 이탈리아 · 2 단계 일본 · 이베리아 · 동방');
});

test('플랜 열림: 이탈리아 · 띠 무 아님 · 스위치 — 다른 유파는 없음', () => {
  assert.ok(planFor('italian', 2));
  assert.equal(planFor('italian', 0), null, '무 = 플랜 없음');
  for (const t of ['german', 'none']) assert.equal(planFor(t, 5), null, t);
  for (const t of ['japanese', 'iberian', 'chinese']) assert.ok(planFor(t, 2), `2 단계 ${t}`);
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
  const on5 = trace({ weapon2: 'sabre', prof: 5, secs: 3 });
  const off5 = withPlan({ on: 0 }, () => trace({ weapon2: 'sabre', prof: 5, secs: 3 }));
  assert.equal(on5.text, off5.text, '독일 세이버 숙련 5 (플랜 없음 · 칼끝 차 0.27 — 파고들기도 안 걸림)');
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
  // 스위치 끔 · 문턱이 닿지 않으면 옛 판과 바이트 같음 · 켬은 다름 (무유파 냉동 참치 숙련 5 — 플랜 없는 유파 · 2 단계부터 일본은 플랜이 있어 뺌)
  const off = withPlan({ on: 0 }, () => trace({ weapon2: 'frozen_tuna', prof: 5, secs: 12 }));
  const never = withPlan({ digShort: 99 }, () => trace({ weapon2: 'frozen_tuna', prof: 5, secs: 12 }));
  const on = trace({ weapon2: 'frozen_tuna', prof: 5, secs: 12 });
  assert.equal(never.text, off.text, '파고들기가 안 걸리면 옛 판');
  assert.notEqual(on.text, off.text, '파고들기 판은 달라짐');
});

test('파고들기 판: 모르겐슈테른 AI 대 롱소드 AI — 헛친 틈 · 늘린 시간 한도 · 받으며 들어감이 쓰임', () => {
  const G = newRound({ seed: 1, walls: true, weapon: 'longsword', weapon2: 'morgenstern', AI2Class: AI, difficulty: 'normal', persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  while (G.t < 20 && G.player.alive && G.enemy.alive) G.step();
  const D = G.ai.stats.dig;
  G.world.free();
  assert.ok(D, '파고들기 재기 칸');
  assert.ok(D.recover + D.keep + D.long > 0, JSON.stringify(D));
});

/** 판을 만들고 시작 정지를 지난 뒤 일본 AI 하나 — 상대 롱소드 */
function jpAi(prof, weapon = 'uchigatana') {
  const G = newRound({ weapon: 'longsword', weapon2: weapon, seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof });
  return { G, ai, free: () => G.world.free() };
}

test('2 단계 일본 — 플랜 · 스택 · 바위 몸 AI (사장님 11/14 확인) · 숙련도 4 부터 스택 · 옛 판 스위치', async () => {
  const { lowShoveFree } = await import('../../src/jp_tank.js');
  assert.equal(JP_TANK.ai, 1);
  const got = [0, 2, 3, 4, 5].map((p) => {
    const { ai, free } = jpAi(p);
    const r = { p, plan: !!ai.plan, jp: !!ai.planJp, stack: !!ai.me.schoolPassive?.stackOn, rock: lowShoveFree(ai.me), tsubame: !!ai.school.techByName.tsubameGaeshi, lure: !!ai.planLure, dig: ai.digNow() };
    free();
    return r;
  });
  assert.deepEqual(got.map((r) => r.jp), [false, true, true, true, true], '무 = 플랜 없음');
  assert.deepEqual(got.map((r) => r.stack), [false, false, false, true, true], '스택 = 4 급 유파 패시브(숙련도 4 부터 — 사람 4 급 책과 같음)');
  assert.deepEqual(got.map((r) => r.rock), [false, false, false, true, true], '바위 몸 밀치기 기력 0 도 스택 판인 AI');
  assert.deepEqual(got.map((r) => r.lure), [false, false, false, true, true], '유도 4 부터');
  assert.ok(got.every((r) => r.dig), '우치가타나 — 짧은 칼 파고들기는 플랜과 함께 그대로 걸림');
  withPlan({ on: 0 }, () => {
    const { ai, free } = jpAi(5);
    assert.equal(ai.plan, null);
    assert.equal(ai.me.schoolPassive.stackOn, false, '옛 판 = AI 스택 끔');
    assert.equal(lowShoveFree(ai.me), false);
    free();
  });
});

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

test('2 단계 일본 — 옛 판 스위치: AI_PLAN.on 0 (+ JP_TANK.ai 0) = 일본을 플랜에서 뺀 판과 바이트 같음 · 켬은 다름', () => {
  const off = withPlan({ on: 0 }, () => trace({ weapon2: 'monohoshizao', prof: 5, secs: 6 }));
  const none = withPlan({ schools: ['italian'], errSchools: ['italian'] }, () => {
    const jk = JP_TANK.ai;
    JP_TANK.ai = 0;
    try {
      return trace({ weapon2: 'monohoshizao', prof: 5, secs: 6 });
    } finally {
      JP_TANK.ai = jk;
    }
  });
  const on = trace({ weapon2: 'monohoshizao', prof: 5, secs: 6 });
  assert.equal(off.text, none.text, '끔 = 일본 플랜 없는 길');
  assert.equal(on.plan, true);
  assert.notEqual(on.text, off.text, '켬은 판이 달라짐');
});
