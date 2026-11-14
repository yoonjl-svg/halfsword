// 유파 AI 기본 전투 흐름 2 단계 — 동방 플랜 시험 (11/14 — src/ai_plan_cn.js · ai_plan.js SCHOOL_PLAN.chinese · config AI_PLAN.cn · 기록 docs/strike/ai_plan_cn_2026-11-14.md):
//  열림(숙련도 · 스위치 · 거리 오차) · 허리 베기 몫 · 겹이 쌓이면 몰아치기를 줄이고 돌며 지치게 · 유도(4 부터) · 나서며 받기 · 격살을 노릴 마음(절대 규칙 대신 기울기) ·
//  수 읽기의 동방 몫(가운데 버릇 · 높음 되풀이) · 전략 층 덧칸은 반사 층을 안 건드림 · 다른 유파 판은 바이트 같음 · 판 하나에서 동방 행동이 남.
//  모두 기울기(곱 · 문턱 이동 · 확률)인지 본다 — '반드시'가 없음. 시간 상한 기준은 없다.  node --test tools/sim/ai_plan_cn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI, seedRandom } from './harness_m.mjs';
import { planFor, distErrWidth, PHASES, SCHOOL_PLAN } from '../../src/ai_plan.js';
import { cnTechW, cnNeed, cnHoldM, cnCircle, cnMeet, cnTick, cnFeint, cnNext, cnWill, cnWant } from '../../src/ai_plan_cn.js';

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

test('동방 플랜 열림 — 숙련도(무 = 없음) · 스위치 · 거리 오차 · 칸 = 고를 몫 0 ~ 1', () => {
  assert.ok(AI_PLAN.schools.includes('chinese'), '2 단계 기본 켬');
  assert.equal(planFor('chinese', 0), null, '무 = 플랜 없음');
  for (const p of [1, 2, 3, 4, 5, 6]) assert.equal(planFor('chinese', p), SCHOOL_PLAN.chinese, `숙련도 ${p}`);
  withPlan({ on: 0 }, () => assert.equal(planFor('chinese', 5), null, '`?aiPlan=0`'));
  withPlan(CN_OFF, () => {
    assert.equal(planFor('chinese', 5), null, '`?aiPlanCn=0`');
    assert.equal(distErrWidth(2, 'chinese'), 0);
  });
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((p) => +distErrWidth(p, 'chinese').toFixed(4)), [0.3, 0.24, 0.18, 0.12, 0.06, 0, 0], '0.3 m × (1 − 숙련도 ÷ 5) · 높음 0');
  const P = SCHOOL_PLAN.chinese;
  for (const ph of PHASES) {
    assert.deepEqual(Object.keys(P[ph]).sort(), ['circle', 'close', 'lure', 'meet', 'waist', 'wear'], ph);
    for (const v of Object.values(P[ph])) assert.ok(v >= 0 && v <= 1, '칸 = 고를 몫 0 ~ 1 (기울기)');
  }
  const got = [0, 1, 2, 3, 4, 5, 6].map((p) => {
    const { ai, free } = cnAi(p);
    const r = { cn: !!ai.planCn, lure: !!ai.planLure, gk: ai.secret?.when === 'gyeoksal', err: ai.distErr, habit: ai.planCn?.habitT ?? 0, repeat: ai.planCn?.repeatT ?? 0 };
    free();
    return r;
  });
  assert.deepEqual(got.map((r) => r.cn), [false, true, true, true, true, true, true]);
  assert.deepEqual(got.map((r) => r.lure), [false, false, false, false, true, true, true], '유도는 가운데 끝(4)부터');
  assert.deepEqual(got.map((r) => r.gk), [false, false, false, false, false, true, true], '격살 = 지금 비기 숙련도 5 (SECRET.aiOpenSchools · secretAt 그대로)');
  got.forEach((r, p) => {
    const w = distErrWidth(p, 'chinese');
    if (w > 0) assert.ok(r.err != null && Math.abs(r.err) <= w + 1e-12, `숙련도 ${p} 오차 ±${w}`);
    else assert.equal(r.err, undefined, `숙련도 ${p} 오차 없음 (굴리지 않음)`);
  });
  assert.deepEqual(got.map((r) => +(r.habit / realS(1)).toFixed(3)), [0, 0, 0, 6, 6, 10, 10], '버릇 창 — 가운데 6.0 s · 높음 10.0 s');
  assert.deepEqual(got.map((r) => +(r.repeat / realS(1)).toFixed(3)), [0, 0, 0, 0, 0, 10, 10], '되풀이 창 — 높음 10.0 s');
});

test('허리 베기 몫 — 띠 기울기 × 칸 · 다른 칼 · 쓰러진 상대 · 지친 국면은 그대로 · 기술 고르기에서 실제로 늚', () => {
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
  // 실제 기술 고르기: 같은 굴림 차례로 동방 몫 켬 · 끔 — 허리 베기 계열 몫이 늚
  const G = newRound({ walls: true, seed: 2, weapon: 'longsword', weapon2: 'hwando', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 2, planOff: true } }); // 3 단계(11/14): 상대 롱소드 AI 는 옛 판(planOff)
  while (G.t < 2) G.step();
  const ai = G.ai;
  const s = ai.lastSeen;
  const count = () => {
    seedRandom(7);
    let w = 0;
    for (let i = 0; i < 400; i++) if (UA.yaojiBleed.techs.includes(ai.pickTech(s, 'patience')?.name)) w++;
    return w;
  };
  const rd = AI_PLAN.read;
  AI_PLAN.read = { ...rd, on: 0 }; // 3 단계(11/14) 수 읽기(독일 상대엔 칼끝 밖 큰 칼을 덜)가 같은 기술 고르기에 겹쳐 — 동방 몫만 보려고 읽기 끔으로 묶음 (기준은 안 고침)
  let on, off;
  try {
    on = count();
    const keep = ai.planCn;
    ai.planCn = undefined;
    off = count();
    ai.planCn = keep;
  } finally {
    AI_PLAN.read = rd;
  }
  G.world.free();
  assert.ok(on > off, `허리 베기 ${on} > ${off} / 400`);
  assert.ok(on < 400, '늘 그렇지는 않음 (기울기)');
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
      assert.ok(ai.holdDist() <= ai.foeReach + 0.08 + 1e-9, `간 보는 거리 ${ai.holdDist().toFixed(3)}`);
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

test('나서며 받기 — 격살이 남았고 이 위협에 노릴 마음이 났으면(cnWant) 물러나 피하기를 칼로 받기로 → respond 가 나서며 받음', () => {
  const hi = cnAi(5);
  const lo = cnAi(4);
  try {
    const { ai, foe } = hi;
    ai.me.fightT = 1;
    foe.stamina.level = 0;
    let id = 100;
    const th = () => ({ id: ++id, line: 'highL', thrust: false });
    withRolls([0], (R) => {
      assert.equal(cnMeet(lo.ai, th()), false, '숙련 4 — 격살 없음');
      assert.equal(R.n, 0, '굴리지 않음');
    });
    withRolls([0.99], (R) => {
      const t = th();
      assert.equal(cnMeet(ai, t), false, '마음이 안 남 (겹 0 · 초반 — 마음 0.2)');
      assert.equal(R.n, 1);
      assert.equal(cnMeet(ai, t), false);
      assert.equal(R.n, 1, '같은 위협은 다시 굴리지 않음');
    });
    withRolls([0, AI_PLAN.cn.meetFresh - 1e-6], (R) => {
      assert.equal(cnMeet(ai, th()), true, '겹 0 · 초반에도 마음이 나면 — 안 지친 상대 meetFresh 몫');
      assert.equal(R.n, 2);
    });
    withRolls([0, AI_PLAN.cn.meetFresh + 1e-6], () => assert.equal(cnMeet(ai, th()), false));
    foe.stamina.level = 1;
    withRolls([0, 0.999], () => assert.equal(cnMeet(ai, th()), true, '지친 상대 — 띠 기울기 × 칸 (높음 1)'));
    foe.stamina.level = 0;
    ai.planCn.rep = 'highL';
    withRolls([0, 0.999], () => assert.equal(cnMeet(ai, th()), true, '되풀이 줄 — 받을 준비'));
    ai.planCn.rep = null;
    const td = th();
    ai.planCn.drawnId = td.id;
    withRolls([0, 0.999], () => assert.equal(cnMeet(ai, td), true, '유도가 끌어낸 칼 — 유도 중과 같게'));
    ai.planCn.drawnId = -1;
    // respond 안에서: 굴림 차례 = 알아챔 · 맞받아 베기 · 피하기 · 노릴 마음 · 나서며 받기
    const d = ai.foeReach; // 간격 끝 — 피하기 몫 0.8
    const resp = (rolls) => withRolls(rolls, () => {
      ai.mode = 'watch';
      assert.ok(ai.respond(th(), d));
      return { void: ai.defVoid, gk: !!ai.gk };
    });
    assert.deepEqual(resp([0, 0.99, 0, 0, 0]), { void: false, gk: true }, '피하기 → 칼로 받아 나서며 받음');
    assert.deepEqual(resp([0, 0.99, 0, 0, 0.99]), { void: true, gk: false }, '마음은 났지만 나서지 않음 (기울기)');
    assert.deepEqual(resp([0, 0.99, 0, 0.99]), { void: true, gk: false }, '마음이 안 남');
    assert.deepEqual(resp([0, 0.99, 0.99, 0]), { void: false, gk: true }, '칼로 받기로 정한 막기 + 마음 → 격살 시도');
    assert.deepEqual(resp([0, 0.99, 0.99, 0.99]), { void: false, gk: false }, '칼로 받되 노리지 않음 (겹 0 · 초반 — 옛 문이면 늘 안 노림 · 이제는 마음 0.2)');
    ai.me.secretUsed = 9;
    withRolls([0], (R) => {
      assert.equal(cnMeet(ai, th()), false, '이 판 격살을 다 씀');
      assert.equal(R.n, 0);
    });
  } finally {
    hi.free();
    lo.free();
  }
});

test('격살을 노릴 마음 (사장님 11/14 \'절대적 규칙은 지우자 마음의 기울기로\') — 겹 0 · 초반에도 가끔 · 겹이 많을수록 · 판이 길수록 · 지칠수록 더 · 높음도 반드시 없음 · 옛 판은 문 그대로', () => {
  const hi = cnAi(5);
  const mid = cnAi(3);
  const lo = cnAi(2);
  try {
    const { ai, foe } = hi;
    const G = CONFIG.SECRET.gyeoksalAi;
    const w0 = AI_PLAN.cn.will0;
    const at = (n, t, tired = 0, x = ai, th = null) => {
      setHunt(x.foe, n);
      x.foe.stamina.level = tired;
      x.me.fightT = t;
      return cnWill(x, th);
    };
    assert.ok(near(at(0, 0), w0) && w0 > 0, '겹 0 · 초반 — 0 이 아님 (작게)');
    assert.ok(near(at(G.stacks, 0), 0.5), '기준점(겹 1) 하나 — 반쯤 기욺');
    assert.ok(near(at(0, G.late), 0.5), '기준점(10 s) 하나');
    assert.ok(near(at(0, 0, 1), 0.5), '지친 상대');
    const byN = [0, 1, 2, 3, 5].map((n) => at(n, 2));
    for (let i = 1; i < byN.length; i++) assert.ok(byN[i] > byN[i - 1], `겹이 많을수록 ${byN.map((x) => x.toFixed(3))}`);
    const byT = [0, 5, 10, 20, 30].map((t) => at(0, realS(t)));
    for (let i = 1; i < byT.length; i++) assert.ok(byT[i] > byT[i - 1], `판이 길수록 ${byT.map((x) => x.toFixed(3))}`);
    assert.ok(at(1, 2, 1) > at(1, 2, 0), '지칠수록');
    const top = at(5, realS(30), 1, ai, { id: 7, line: 'highL' });
    assert.ok(top < 1 - w0 + 1e-12 && top > 0.75, `높음도 반드시 없음 (${top.toFixed(4)} ≤ ${1 - w0})`);
    // 높음은 칠 낌새를 읽음 (유도가 끌어낸 칼 · 되풀이 줄) — 가운데는 안 읽음
    ai.planCn.drawnId = 7;
    const th7 = { id: 7, line: 'highL' };
    assert.ok(at(0, 0, 0, ai, th7) > at(0, 0, 0, ai, { id: 8, line: 'highL' }), '높음 — 끌어낸 칼');
    mid.ai.planCn.drawnId = 7;
    const m7 = at(0, 0, 0, mid.ai, th7);
    // 무계획 (굴림 몫 Lk): 그 몫만큼 동전 — 가운데 ⅓ · 낮음 ⅔
    assert.ok(near(m7, (1 / 3) * AI_PLAN.coin + (2 / 3) * w0), `가운데 — 낌새 안 읽음 · 굴림 몫 ⅓ (${m7.toFixed(4)})`);
    assert.ok(near(at(0, 0, 0, lo.ai), (2 / 3) * AI_PLAN.coin + (1 / 3) * w0), '낮음 — 아무 때나 노리기도');
    // 실제 굴림: 겹 0 · 초반에도 가끔 · 겹이 많으면 더 자주 (위협 하나에 한 번)
    const count = (n) => {
      seedRandom(5);
      let k = 0;
      for (let i = 0; i < 400; i++) {
        setHunt(foe, n);
        foe.stamina.level = 0;
        ai.me.fightT = 0.5;
        if (cnWant(ai, { id: 1000 * (n + 1) + i, line: 'highL' })) k++;
      }
      return k;
    };
    const c0 = count(0);
    const c3 = count(3);
    assert.ok(c0 > 0 && c0 < 400, `겹 0 · 초반 ${c0} / 400 — 가끔`);
    assert.ok(c3 > c0 && c3 < 400, `겹 3 ${c3} > ${c0}`);
    // ai.gkWant: 플랜 몸 = 마음 · 옛 판(`?aiPlan=0`) = 문 그대로
    setHunt(foe, 0);
    ai.me.fightT = 0.5;
    withRolls([0], () => assert.equal(ai.gkWant({ id: 99999, line: 'highL' }), true, '플랜 몸 — 겹 0 · 초반에도 마음이 나면'));
    const old = withPlan({ on: 0 }, () => cnAi(5));
    try {
      assert.equal(old.ai.planCn, undefined);
      setHunt(old.foe, 0);
      old.ai.me.fightT = 0.5;
      withRolls([0], (R) => {
        assert.equal(old.ai.gkWant({ id: 1, line: 'highL' }), false, '옛 판 — 겹 0 · 10 s 전이면 안 노림 (문)');
        assert.equal(R.n, 0);
      });
      setHunt(old.foe, 1);
      assert.equal(old.ai.gkWant(), true);
    } finally {
      old.free();
    }
  } finally {
    hi.free();
    mid.free();
    lo.free();
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
  const cn1 = trace({ weapon2: 'hwando', prof: 5, secs: 8 });
  const cn0 = withPlan(CN_OFF, () => trace({ weapon2: 'hwando', prof: 5, secs: 8 }));
  assert.equal(cn1.cn, true);
  assert.equal(cn0.cn, false);
  assert.notEqual(cn1.text, cn0.text, '동방 켬은 판이 달라짐');
});

test('판 하나 — AI 동방(환도 숙련 5 · P 자리) 대 롱소드 AI(숙련 2) 씨앗 11: 허리 베기 → 사냥 겹 → 지치게 · 유도 · 노릴 마음 · 나서며 받기 · 격살 시도 · 국면이 실제로 남', () => withPlan({ read: { ...AI_PLAN.read, on: 0, fair: 0 } }, () => { // 3 단계(11/14) 그때 판으로 묶음 (기준은 안 고침): 수 읽기 · 공정함으로 씨앗 11 판이 갈라짐 (사냥 겹 0)
  const G = newRound({ walls: true, seed: 11, weapon: 'hwando', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 2, planOff: true }, persona2: { proficiency: 5 } }); // 3 단계(11/14): 상대 롱소드 AI 는 옛 판(planOff)
  const ai = G.ai2;
  let waist = 0;
  const sa = ai.startAttack;
  ai.startAttack = function (...a) {
    const r = sa.apply(this, a);
    if (r && this.mode === 'attack' && !this.secretRun && UA.yaojiBleed.techs.includes(this.feint ? this.uniqueByName.get(this.feint.name)?.name : this.tech?.name)) waist++;
    return r;
  };
  while (G.t < 30 && G.player.alive && G.enemy.alive) G.step();
  const C = ai.stats.cn;
  const P = ai.stats.plan;
  const gkTry = ai.stats.gkTry ?? 0;
  const hunt = G.enemy.cnHunt?.n ?? 0;
  G.world.free();
  assert.ok(waist > 0, `허리 베기 ${waist}`);
  assert.ok(hunt >= 1 && C.wearT > 0, `사냥 겹 ${hunt} · 지치게 ${C.wearT}`);
  assert.ok(C.lure > 0 && C.meet > 0 && C.want > 0, JSON.stringify(C));
  assert.ok(gkTry > 0, `격살 시도 막기 ${gkTry}`);
  assert.ok(P.judges > 0 && Object.values(P.t).reduce((x, y) => x + y, 0) > 0, '국면 시간이 쌓임');
}));
