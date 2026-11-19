// 유파 AI 기본 전투 흐름 2 단계 — 동방 플랜 시험 (11/14 — src/ai_plan_cn.js · ai_plan.js SCHOOL_PLAN.chinese · config AI_PLAN.cn · 기록 docs/strike/ai_plan_cn_2026-11-14.md):
//  열림(숙련도 · 스위치 · 거리 오차) · 허리 베기 몫 · 겹이 쌓이면 몰아치기를 줄이고 돌며 지치게 · 유도(4 부터) · 나서며 받기 · 격살을 노릴 마음(절대 규칙 대신 기울기) ·
//  수 읽기의 동방 몫(가운데 버릇 · 높음 되풀이) · 전략 층 덧칸은 반사 층을 안 건드림 · 다른 유파 판은 바이트 같음 · 판 하나에서 동방 행동이 남.
//  모두 기울기(곱 · 문턱 이동 · 확률)인지 본다 — '반드시'가 없음. 시간 상한 기준은 없다.  node --test tools/sim/ai_plan_cn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI, seedRandom } from './harness_m.mjs';
import { planFor, distErrWidth, PHASES, SCHOOL_PLAN } from '../../src/ai_plan.js';
import { cnTechW, cnNeed, cnHoldM, cnCircle, cnMeet, cnTick, cnFeint, cnNext, cnWill, cnWant } from '../../src/ai_plan_cn.js';
import { mindGap } from '../../src/ai_mindset.js';

const { AI_PLAN, UNIQUE_ASSIST: UA, realS } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const CN_OFF = { schools: AI_PLAN.schools.filter((t) => t !== 'chinese'), errSchools: AI_PLAN.errSchools.filter((t) => t !== 'chinese') };
function withPlan(over, fn) {
  const keep = { ...AI_PLAN };
  Object.assign(AI_PLAN, over);
  try {
    return fn();
  } finally {
    Object.assign(AI_PLAN, keep);
  }
}
/** Math.random 을 정한 값들로 (다 쓰면 마지막 값) — 굴림 수도 셈 */
function withRolls(vals, fn) {
  const rnd = Math.random;
  const R = { n: 0 };
  Math.random = () => vals[Math.min(R.n++, vals.length - 1)];
  try {
    return fn(R);
  } finally {
    Math.random = rnd;
  }
}
/** 판을 만들고 시작 정지를 지난 뒤 동방(환도) AI 하나 — 상대 롱소드 */
function cnAi(prof, weapon = 'hwando') {
  const G = newRound({ weapon: 'longsword', weapon2: weapon, seed: 1, gap: 2.4 });
  G.ai.update = () => {};
  while (G.t < 0.3) G.step();
  const ai = new AI(G.enemy, G.player, 'normal', { proficiency: prof });
  ai.planC = ai.plan?.probe ?? null;
  return { G, ai, foe: G.player, free: () => G.world.free() };
}
const setHunt = (f, n) => (f.cnHunt = { n, hits: n, last: new Map(), t5: null });
/** AI 둘 판 (자리 0 = 롱소드 AI · 자리 1 = weapon2 AI) — secs 초 돌리며 몸 자리 · 피를 30 스텝마다 적은 글 */
function trace({ weapon2, prof = 2, secs = 4, seed = 2 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const r = { text: out.join(';'), cn: !!G.ai.planCn };
  G.world.free();
  return r;
}


test('허리 베기 몫 — 띠 기울기 × 칸 · 다른 칼 · 쓰러진 상대 · 지친 국면은 그대로', () => {
  const lo = cnAi(2);
  const hi = cnAi(5);
  try {
    const Wk = AI_PLAN.cn.waist;
    assert.ok(near(cnTechW(lo.ai, { name: 'chebuYaoji' }, 'patience'), 1 + Wk / 3), '낮음 ⅓');
    assert.ok(near(cnTechW(hi.ai, { name: 'yaoji' }, 'patience'), 1 + Wk), '높음 1');
    assert.equal(cnTechW(hi.ai, { name: 'zornhau' }, 'patience'), 1, '허리 베기 계열 밖');
    assert.equal(cnTechW(hi.ai, { name: 'yaoji' }, 'finish'), 1, '쓰러진 상대 내려치기');
    hi.ai.planC = SCHOOL_PLAN.chinese.tired;
    assert.equal(cnTechW(hi.ai, { name: 'yaoji' }, 'patience'), 1, '지쳤을 때 — 휘두름을 덜함 (칸 0)');
    hi.ai.planC = SCHOOL_PLAN.chinese.probe;
    hi.ai.planCn.quiet = true;
    assert.ok(near(cnTechW(hi.ai, { name: 'yaoji' }, 'patience'), 1 + 2 * Wk), '높음 · 안 치는 상대 — 견제를 더 (× 2)');
    hi.ai.planCn.quiet = false;
    // 날개 접기 속임 고르기: P = f ÷ (n − 1 + f) — 굴림 하나
    const cands = [...hi.ai.school.feints];
    const L = cands.find((f) => hi.ai.uniqueByName.get(f.name)?.name === 'lianchi');
    assert.ok(L, '숙련 5 꾸러미에 날개 접기');
    const other = cands.find((f) => f !== L);
    const q = Wk / (cands.length + Wk);
    withRolls([q - 1e-6], (R) => {
      assert.equal(cnFeint(hi.ai, cands, other), L);
      assert.equal(R.n, 1);
    });
    withRolls([q + 1e-6], () => assert.equal(cnFeint(hi.ai, cands, other), other));
    withRolls([0], (R) => {
      assert.equal(cnFeint(hi.ai, cands, L), L, '이미 날개 접기 — 굴림 없음');
      assert.equal(R.n, 0);
    });
  } finally {
    lo.free();
    hi.free();
  }
});

test('겹이 쌓이면 몰아치기를 줄이고 돌며 지치게 — 상대가 지치면 · 안 치는 상대면 거둠 · 큰 틈은 그대로', () => {
  const hi = cnAi(5);
  const lo = cnAi(2);
  try {
    const { ai, foe } = hi;
    assert.equal(cnNeed(ai, 1, 'patience'), 1, '겹 없음');
    setHunt(foe, 2);
    setHunt(lo.foe, 2);
    foe.stamina.level = 0;
    lo.foe.stamina.level = 0;
    assert.ok(near(cnNeed(ai, 1, 'patience'), 1 + AI_PLAN.cn.wear * 2), '겹마다 + wear × 띠 기울기 (높음 1)');
    assert.ok(near(cnNeed(lo.ai, 1, 'patience'), 1 + (AI_PLAN.cn.wear * 2) / 3), '낮음 ⅓');
    assert.equal(cnNeed(ai, 1, 'recover'), 1, '상대 헛친 뒤 — 큰 틈은 그대로');
    assert.equal(cnNeed(ai, 1, 'finish'), 1, '무너짐 — 그대로');
    ai.planCn.quiet = true;
    assert.equal(cnNeed(ai, 1, 'patience'), 1, '안 치는 상대는 기다리지 않음');
    ai.planCn.quiet = false;
    foe.stamina.level = 1;
    assert.equal(cnNeed(ai, 1, 'patience'), 1, '지친 상대 — 지치게 하기를 거둠 (몰아침은 공통 틀)');
    // 이어 치기: 겹을 쌓은 상대가 안 지쳤는데 맞혔으면 빠져 돎
    ai.hitLanded = true;
    assert.equal(cnNext(ai, 0.8), 0.8, '지친 상대');
    foe.stamina.level = 0;
    assert.ok(near(cnNext(ai, 0.8), 0.8 * (1 - AI_PLAN.cn.wearNext)));
    ai.hitLanded = false;
    assert.equal(cnNext(ai, 0.8), 0.8, '못 맞힘');
    // 돎: 겹이 있고 상대가 안 지쳤으면 멈춤 몫이 모두 돎으로(높음) · 빠르기 × (1 + circle)
    const base = ai.pers.circleDir * ai.pers.circleRate;
    assert.ok(near(cnCircle(ai, 0, 0.1), base * (1 + AI_PLAN.cn.circle)));
    assert.ok(near(cnCircle(ai, -0.3, 0.9), -0.3 * (1 + AI_PLAN.cn.circle)));
    setHunt(foe, 0);
    assert.equal(cnCircle(ai, 0, 0.1), 0, '겹 없음 — 멈춤 몫의 절반만 돎으로 (x 0.1 은 그대로 멈춤)');
    assert.ok(cnCircle(ai, 0, 0.3) !== 0);
    // 가까운 간격
    assert.ok(near(cnHoldM(ai, 0.2), 0.2 * (1 - AI_PLAN.cn.close)));
    ai.planC = SCHOOL_PLAN.chinese.ahead;
    assert.equal(cnHoldM(ai, 0.2), 0.2, '우위 — 돌며 기다림 (칸 0)');
  } finally {
    hi.free();
    lo.free();
  }
});

test('유도 (가운데 끝 4 부터): 겹이 있으면 간 보기 한 번에 한 번 굴려 상대 칼끝 바로 밖에 섬 · 칼을 내면 끝 · 3 은 없음', () => {
  const m4 = cnAi(4);
  const m3 = cnAi(3);
  try {
    const { ai, foe } = m4;
    const S = ai.planCn;
    const st = { state: 'stand' };
    ai.mode = 'watch';
    withRolls([0], (R) => {
      cnTick(ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 0, '겹 없음 — 굴리지 않음');
    });
    setHunt(foe, 1);
    withRolls([0], (R) => {
      cnTick(ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 1);
      assert.ok(S.lure > 0 && S.st.lure === 1);
      assert.equal(cnHoldM(ai, 0.2), 0, '상대 칼끝 바로 밖 (최소 여유)');
      assert.ok(ai.holdDist() <= ai.foeReach + 0.08 + (mindGap(ai) ?? 0) + 1e-9, `간 보는 거리 ${ai.holdDist().toFixed(3)}`); // 유파 마음가짐 (11/18): 바닥 = 상대 칼끝 + 동방 거리 선 여유(gap 0.25) + 0.08
      assert.ok(near(cnNeed(ai, 1, 'patience'), 1 + AI_PLAN.cn.wear * ai.planK + AI_PLAN.cn.lureNeed * ai.planK), '먼저 치지 않는 쪽');
      assert.equal(cnNeed(ai, 1, 'recover'), 1, '큰 틈은 그대로');
      cnTick(ai, 1 / 120, 2, st, { id: 9, line: 'highL', thrust: false });
      assert.equal(S.lure, 0, '상대가 칼을 냄 — 끝');
      assert.equal(S.st.lureDraw, 1);
      cnTick(ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 1, '같은 간 보기에선 다시 굴리지 않음');
      ai.mode = 'attack';
      cnTick(ai, 1 / 120, 2, st, null);
      ai.mode = 'withdraw';
      cnTick(ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 2, '공격 뒤 물러남 — 한 번 더');
    });
    withRolls([0.99], () => {
      ai.mode = 'attack';
      cnTick(ai, 1 / 120, 2, st, null);
      ai.mode = 'watch';
      ai.planCn.lure = 0;
      cnTick(ai, 1 / 120, 2, st, null);
      assert.equal(S.lure, 0, '굴림이 안 나오면 없음 (기울기)');
    });
    setHunt(m3.foe, 3);
    m3.ai.mode = 'watch';
    withRolls([0], (R) => {
      cnTick(m3.ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 0, '가운데 3 — 유도 없음');
    });
  } finally {
    m4.free();
    m3.free();
  }
  // 높음 · 격살이 남음: 겹이 없어도 지친 상대면 유도로 끌어냄 (판 시간과 상관없이) · 안 지친 상대 · 겹 0 이면 굴리지 않음
  const h = cnAi(5);
  try {
    const st = { state: 'stand' };
    const again = () => {
      h.ai.mode = 'attack';
      cnTick(h.ai, 1 / 120, 2, st, null);
      h.ai.mode = 'watch';
    };
    h.ai.mode = 'watch';
    h.ai.me.fightT = 1;
    h.foe.stamina.level = 0;
    withRolls([0], (R) => {
      cnTick(h.ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 0, '겹 0 · 안 지친 상대 — 유도 없음');
      again();
      h.foe.stamina.level = 1;
      cnTick(h.ai, 1 / 120, 2, st, null);
      assert.equal(R.n, 1, '지친 상대 — 겹 없이도');
      assert.ok(h.ai.planCn.lure > 0);
      h.ai.me.armed = false;
      cnTick(h.ai, 1 / 120, 2, st, null);
      assert.equal(h.ai.planCn.lure, 0, '칼을 놓치면 끝');
      h.ai.me.armed = true;
    });
  } finally {
    h.free();
  }
});



test('수 읽기의 동방 몫 — 가운데 버릇(안 치는 상대) · 높음 되풀이(같은 줄 두 번 10.0 s 안) · 낮음은 없음 · 본 위협만', () => {
  const lo = cnAi(2);
  const mid = cnAi(3);
  const hi = cnAi(5);
  try {
    const st = { state: 'stand' };
    const tick = (ai, t, th = null) => {
      ai.sense.t = t;
      ai.me.fightT = t;
      cnTick(ai, 1 / 120, 3, st, th);
    };
    for (const { ai } of [lo, mid, hi]) ai.mode = 'attack'; // 유도 굴림이 안 끼게
    tick(lo.ai, 20);
    assert.equal(lo.ai.planCn.quiet, false, '낮음 — 버릇 안 봄');
    tick(mid.ai, realS(6) + 1);
    assert.equal(mid.ai.planCn.quiet, true, '가운데 — 6.0 s 동안 칼을 안 낸 상대');
    tick(mid.ai, realS(6) + 1.5, { id: 1, line: 'highL' });
    assert.equal(mid.ai.planCn.quiet, false);
    tick(mid.ai, realS(6) + 2, { id: 2, line: 'highL' });
    assert.equal(mid.ai.planCn.rep, null, '가운데 — 되풀이 안 봄');
    tick(hi.ai, 1, { id: 1, line: 'highL' });
    tick(hi.ai, 2, { id: 2, line: 'lowR' });
    assert.equal(hi.ai.planCn.rep, null);
    tick(hi.ai, 3, { id: 3, line: 'highL' });
    assert.equal(hi.ai.planCn.rep, 'highL', '같은 줄 두 번');
    assert.equal(hi.ai.planCn.st.rep, 1);
    tick(hi.ai, 3.5, { id: 3, line: 'highL' });
    assert.equal(hi.ai.planCn.st.rep, 1, '같은 위협은 한 번');
    tick(hi.ai, 3 + realS(10) + 0.1);
    assert.equal(hi.ai.planCn.rep, null, '10.0 s 지나면 잊음');
    tick(hi.ai, 20, { id: 4, line: 'highR' });
    tick(hi.ai, 20 + realS(10) + 0.5, { id: 5, line: 'highR' });
    assert.equal(hi.ai.planCn.rep, null, '10.0 s 넘게 떨어진 두 번은 되풀이 아님');
  } finally {
    lo.free();
    mid.free();
    hi.free();
  }
});

// 고노센 경계 무모는 11/14 합치며 공통 틀 하나로 (ai.js gnsWatch W.reck — 네 유파 같은 규칙 · 굴림 몫 낮음 ⅔): 시험은 gonosen_risk.test '⑤ 무모' · ai_plan.test '네 유파 고노센 무모'

test('전략 층 덧칸 — 굴림 없이 지나는 스텝 · 반사 층 상태를 안 건드림', () => {
  const { ai, foe, free } = cnAi(5);
  try {
    setHunt(foe, 2);
    ai.mode = 'defend'; // 유도 굴림 자리 아님
    const before = JSON.stringify({ mode: ai.mode, phase: ai.phase, timer: ai.timer, hand: [ai.hand.x, ai.hand.y], tech: ai.tech?.name ?? null, threatSeen: ai.threatSeen, defVoid: ai.defVoid });
    withRolls([0.5], (R) => {
      for (let i = 0; i < 240; i++) cnTick(ai, 1 / 120, 2, { state: 'stand' }, i % 60 === 0 ? { id: 100 + i, line: 'highC' } : null);
      assert.equal(R.n, 0, '굴림 없음');
    });
    const after = JSON.stringify({ mode: ai.mode, phase: ai.phase, timer: ai.timer, hand: [ai.hand.x, ai.hand.y], tech: ai.tech?.name ?? null, threatSeen: ai.threatSeen, defVoid: ai.defVoid });
    assert.equal(after, before);
  } finally {
    free();
  }
});

test('다른 유파 판은 동방 몫과 상관없이 바이트 같음 · 동방 판은 켬 ↔ 끔(`?aiPlanCn=0`) 이 다름', () => {
  const it1 = trace({ weapon2: 'rapier', prof: 3 });
  const it0 = withPlan(CN_OFF, () => trace({ weapon2: 'rapier', prof: 3 }));
  assert.equal(it1.text, it0.text, '이탈리아 — 동방 칸이 안 닿음');
  const ls1 = trace({ weapon2: 'longsword', prof: 5 });
  const ls0 = withPlan(CN_OFF, () => trace({ weapon2: 'longsword', prof: 5 }));
  assert.equal(ls1.text, ls0.text, '롱소드끼리');
  // 8 → 12 s (11/19 합침 — 사람 · AI 같게 v2 묶음 · C1 뺌 + 개발 쪽 AI 뛰기 · 뒤 박차기 몸 닿음 · AI 박차는 때): 켬 · 끔 판이 처음 갈리는 때가 씨앗 2 에서 6.5 s(개발 쪽) · 8.0 s(v2 가지 — 창 끝)
  //  → 8.25 s 로 밀려 8 s 창 밖 (씨앗 1 은 10.75 · 3 은 7.25 s) — 동방 칸이 처음 몸을 바꾸는 때가 판 흐름 따라 옮긴 몫이라 창을 넓힘
  const cn1 = trace({ weapon2: 'hwando', prof: 5, secs: 12 });
  const cn0 = withPlan(CN_OFF, () => trace({ weapon2: 'hwando', prof: 5, secs: 12 }));
  assert.equal(cn1.cn, true);
  assert.equal(cn0.cn, false);
  assert.notEqual(cn1.text, cn0.text, '동방 켬은 판이 달라짐');
});

