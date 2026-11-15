// 동방 보법 회피 '편섬(偏閃)' 시험 (11/15 사장님 '방향을 꺾은 순간으로 하자. 그렇다고 항상 켜지면 안돼. 0.4초 50% 감소.' · '동방 유파 설계에 이것도 감안한 전투 스타일과
//  뛰어들기가 나오도록 해' · 첫 안 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · src/cn_step.js · ai_plan_cn.js cnDive · config CN_STEP · 기록 docs/strike/cn_step_2026-11-15.md):
//  기본 꺾음('turn') · 끄면(0) 판이 바이트 같음 · 동방 몸만(사람은 C1) · 걷는 중 45° 꺾음 → 0.4 s 칼날 상처 × 0.5 · 서 있다 걷기 · 작은 꺾음 · 천천히 돎은 아님 ·
//  다시 걸기 한도 1.2 s · 곧게 걸음 한도(견줌) · AI 偏閃奏進(굴림 · 꺾을 쪽 · 뛰어듦) · 견줌 ⓐ ⓑ ⓒ · 판에서 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/cn_step.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { cnStepOn, cnSee, cnStepTick, cnStepMove, cnStepKeep, cnAiTurn } from '../../src/cn_step.js';
import { cnDive, cnDiveTick } from '../../src/ai_plan_cn.js';
import { kitFromNodes } from '../../src/skill_tree_data.js';

const C = CONFIG.CN_STEP;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
function withMode(m, fn, o = {}) {
  const keep = { ...C };
  const keepD = CONFIG.AI_PLAN.cn.dive;
  C.mode = m;
  Object.assign(C, o);
  if ('dive' in o) CONFIG.AI_PLAN.cn.dive = o.dive;
  try {
    return fn();
  } finally {
    Object.assign(C, keep);
    for (const k of Object.keys(C)) if (!(k in keep)) delete C[k];
    CONFIG.AI_PLAN.cn.dive = keepD;
  }
}
function trace({ weapon = 'longsword', weapon2 = 'hwando', secs = 8, seed = 1 } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const n = [G.player, G.enemy].map((f) => (f.cnStep?.n ? { ...f.cnStep.n } : null));
  const cn = [G.ai, G.ai2].map((a) => (a?.stats?.cn ? { ...a.stats.cn } : null));
  G.world.free();
  return { text: out.join(';'), n, cn };
}
/** 가짜 동방 몸 (걸음 장치 · 기력 · 스틱만) */
const body = (o = {}) => ({ swordArt: { tradition: 'chinese' }, move: { x: 0, y: 1 }, state: 'stand', armed: true, aiControlled: true, aiCtl: { mode: 'watch' }, stamina: { time: 10, value: 80, exhausted: false }, gait: { active: true, burst: null, burstBrake: false, fastK: 1 }, ...o });
const TH = { line: 'highR', thrust: false };
const DT = 1 / 120;
/** secs 동안 스텝마다 스틱 mv(함수면 시각마다)로 */
function run(f, secs, mv) {
  for (let t = 0; t < secs - 1e-9; t += DT) {
    if (mv) f.move = typeof mv === 'function' ? mv(t) : mv;
    cnStepTick(f, DT);
    f.stamina.time += DT;
  }
}
const ladder = (v, rungs) => rungs.map(CONFIG.realS).some((r) => Math.abs(r - v) < 1e-9);

test('기본 끔(11/15 감독 — 1.2 s · 45° 사장님 판정 전 · ① 판에서 다시 잼) · 사장님 값 0.4 s · 50 % · 끄면(0) 동방 판은 값을 안 읽음 · 켜도 동방이 아닌 판(롱소드끼리)은 그대로', () => {
  assert.equal(C.mode, 0, '11/15 감독: ① 둥근 칼 읽기 판에서 다시 재기 전 끔 (전 기본 turn)');
  assert.equal(CONFIG.AI_PLAN.cn.dive, 0, '偏閃奏進도 끔');
  near(C.keepT, CONFIG.realS(0.4));
  near(C.cut, 0.5);
  near(C.turn, Math.PI / 4);
  assert.ok(ladder(C.turnT, [0.2]) && ladder(C.rearm, [1.2]) && C.straight === 0, '시간 사다리 (사장님 확인 전)');
  const a = withMode(0, () => trace());
  const b = withMode(0, () => trace(), { cut: 0.9, keepT: CONFIG.realS(2), rearm: 0, dive: 0 });
  assert.equal(a.text, b.text);
  assert.deepEqual(a.n, [null, null]);
  const m0 = withMode(0, () => trace({ weapon2: 'longsword' }));
  for (const m of ['turn', 'a', 'b', 'c']) assert.equal(withMode(m, () => trace({ weapon2: 'longsword' })).text, m0.text, `롱소드끼리 ${m}`);
});

test('동방 몸만 · 사람은 보법 I(C1 — footwork) 을 익힌 몸만', () => withMode('turn', () => {
  assert.equal(cnStepOn(body()), true);
  assert.equal(cnStepOn(body({ swordArt: { tradition: 'german' } })), false);
  assert.equal(cnStepOn(body({ skillKit: kitFromNodes('chinese', new Set(['C3'])) })), false, 'C1 없음');
  assert.equal(cnStepOn(body({ skillKit: kitFromNodes('chinese', new Set(['C1'])) })), true);
  assert.equal(cnStepOn(body({ schoolFootwork: false })), false);
  assert.equal(withMode(0, () => cnStepOn(body())), false, '끔');
}));

test('꺾음: 걷는 중 45° 넘게 꺾은 때부터 0.4 s 칼날 상처 × 0.5 · 키보드 대각 한 칸(45°)도 · 작은 꺾음 · 서 있다 걷기 · 천천히 돎 · 멈춤은 아님', () => withMode('turn', () => {
  const f = body();
  run(f, 0.5, { x: 0, y: 1 });
  assert.equal(cnStepKeep(f), 1, '곧게 걷기');
  run(f, DT, { x: 1, y: 0 }); // 90°
  assert.equal(f.cnStep.n.trig, 1);
  near(cnStepKeep(f), 0.5);
  run(f, C.keepT - 2 * DT);
  near(cnStepKeep(f), 0.5, 1e-9);
  run(f, 3 * DT);
  assert.equal(cnStepKeep(f), 1, '0.4 s 뒤 그대로');
  assert.equal(f.cnStep.n.trig, 1, '같은 꺾음은 한 번');
  // 키보드 대각 (앞 → 앞 + 오른 = 45°)
  const k = body();
  run(k, 0.5, { x: 0, y: 1 });
  run(k, DT, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
  assert.equal(k.cnStep.n.trig, 1, '45°');
  // 작은 꺾음 (30°)
  const s = body();
  run(s, 0.5, { x: 0, y: 1 });
  run(s, 0.5, { x: 0.5, y: Math.sqrt(0.75) });
  assert.equal(s.cnStep.n.turn, 0);
  // 서 있다 걷기 시작 · 멈춤 (꺾음 아님)
  const g = body({ move: { x: 0, y: 0 } });
  run(g, 0.5, { x: 0, y: 0 });
  run(g, 0.5, { x: 1, y: 0 });
  run(g, 0.5, { x: 0, y: 0 });
  assert.equal(g.cnStep.n.turn, 0);
  // 천천히 돎 (초당 90° — 0.2 s 에 18°)
  const r = body();
  run(r, 2, (t) => ({ x: Math.sin((t * Math.PI) / 2), y: Math.cos((t * Math.PI) / 2) }));
  assert.equal(r.cnStep.n.turn, 0, '천천히 도는 것');
  // 손가락 스틱 꺾음 (5 스텝에 걸쳐 90°) 은 잡음
  const h = body();
  run(h, 0.5, { x: 0, y: 1 });
  run(h, 5 * DT, (t) => { const a = Math.min(1, (t + DT) / (5 * DT)) * (Math.PI / 2); return { x: Math.sin(a), y: Math.cos(a) }; });
  assert.equal(h.cnStep.n.trig, 1, '몇 스텝에 걸친 꺾음');
  // 뒤로 꺾음 (180°) · 발이 묶임 · 넘어짐은 아님
  const b = body();
  run(b, 0.5, { x: 0, y: 1 });
  run(b, DT, { x: 0, y: -1 });
  assert.equal(b.cnStep.n.trig, 1, '뒤로');
  const held = body({ feetHeld: true });
  run(held, 0.5, { x: 0, y: 1 });
  run(held, DT, { x: 1, y: 0 });
  assert.equal(held.cnStep.n.turn, 0, '발이 묶임');
}));

test("'항상 켜지면 안돼': 다시 걸기 1.2 s — 지그재그로 꺾어도 켜진 몫 ≤ 0.4 ÷ 1.2 · 한도 없음이면 거의 늘 · 곧게 걸음 한도(견줌)", () => {
  const zig = (o) => withMode('turn', () => {
    const f = body();
    run(f, 0.5, { x: 0, y: 1 });
    run(f, 12, (t) => ({ x: Math.floor(t / CONFIG.realS(0.2)) % 2 ? 0.7 : -0.7, y: 0.7 }));
    return f.cnStep.n;
  }, o);
  const free = zig({ rearm: 0 });
  const lim = zig({});
  const st = zig({ rearm: 0, straight: CONFIG.realS(0.4) });
  assert.ok(free.onT / free.T > 0.9, `한도 없음 ${free.onT / free.T}`);
  assert.ok(lim.onT / lim.T <= 0.4 / 1.2 + 0.01 && lim.onT / lim.T > 0.25, `다시 걸기 1.2 s ${lim.onT / lim.T}`);
  assert.ok(lim.block > 0 && lim.trig < free.trig);
  assert.equal(st.trig, 1, '곧게 걸음 0.4 s — 처음 0.5 s 곧게 걸은 뒤 첫 꺾음 하나만 · 0.2 s 지그재그는 안 걸림');
  // 다시 걸기: 1.2 s 지나면 다시 걸림
  withMode('turn', () => {
    const f = body();
    run(f, 0.5, { x: 0, y: 1 });
    run(f, DT, { x: 1, y: 0 });
    run(f, 0.5);
    run(f, DT, { x: 0, y: 1 });
    assert.equal(f.cnStep.n.trig, 1);
    assert.equal(f.cnStep.n.block, 1, '1.2 s 안');
    run(f, C.rearm);
    run(f, DT, { x: -1, y: 0 });
    assert.equal(f.cnStep.n.trig, 2, '1.2 s 뒤');
  });
});

test('AI 偏閃奏進(켠 판 `?cnStep=turn&cnDive=1`): 높음(띠 기울기 1)은 늘 · 칼이 오는 반대쪽 옆 — 그 쪽으로 걷던 중이면 반대로 · 꺾는 시간 뒤 앞 박찬 걸음 + 허리 베기 · 0 이면 안 함', () => withMode('turn', () => {
  const mk = (o = {}) => {
    const me = body(o.me);
    const started = [];
    return {
      me, planC: { dive: 1 }, planK: 1, planLuck: 0, staminaRest: false, mode: 'defend', foe: { alive: true }, secret: null, pers: { circleDir: 1 },
      planCn: { st: { diveRoll: 0, dive: 0, diveGo: 0 } },
      school: { techByName: { chebuYaoji: { name: 'chebuYaoji' }, yaoji: { name: 'yaoji' } } },
      techNow: (t) => t ?? null,
      startAttack(t, why) { started.push([t.name, why]); return true; },
      started, ...o.ai,
    };
  };
  const a = mk();
  const D = cnDive(a, TH, 1.5);
  assert.deepEqual(D, { t: 0, side: -1 }, '오른쪽으로 오는 칼 → 왼쪽');
  const w = mk({ me: { move: { x: -1, y: 0 } } });
  assert.equal(cnDive(w, TH, 1.5).side, 1, '이미 왼쪽으로 걷는 중 → 오른쪽으로 꺾음');
  a.cnDive = D;
  assert.deepEqual(cnAiTurn(a, 1, 0), [0, -1], '꺾는 동안 옆 스틱');
  assert.equal(cnDiveTick(a, C.aiT / 2), false);
  assert.equal(cnDiveTick(a, C.aiT / 2 + 1e-6), true);
  assert.deepEqual(a.started, [['chebuYaoji', 'dive']]);
  assert.equal(a.me.gait.burst?.fore, 1, '앞 박찬 걸음');
  assert.equal(a.me.gait.burst?.dig, 1);
  assert.equal(a.cnDive, null);
  const c = mk({ ai: { techNow: (t) => (t?.name === 'chebuYaoji' ? null : t) } });
  c.cnDive = cnDive(c, TH, 1.5);
  cnDiveTick(c, C.aiT);
  assert.deepEqual(c.started, [['yaoji', 'dive']], '체보요격이 식는 중이면 요격');
  const leave = mk();
  leave.cnDive = cnDive(leave, TH, 1.5);
  leave.mode = 'withdraw';
  assert.deepEqual(cnAiTurn(leave, 1, 0), [1, 0], '막기 꼴을 벗어나면 버림');
  assert.equal(leave.cnDive, null);
  assert.equal(cnDive(mk({ ai: { planC: { dive: 0 } } }), TH, 1.5), null, '칸 0');
  assert.equal(cnDive(mk({ me: { stamina: { time: 10, value: 5, exhausted: false } } }), TH, 1.5), null, '기력 < 12');
  assert.equal(withMode('turn', () => cnDive(mk(), TH, 1.5), { dive: 0 }), null, '`?cnDive=0`');
  assert.equal(withMode('a', () => cnDive(mk(), TH, 1.5)), null, "꺾음('turn')일 때만");
  // 무 · 낮음은 운 (기울기 0 · 굴림 몫 1 → 동전 0.5)
  let yes = 0;
  for (let i = 0; i < 400; i++) if (cnDive(mk({ ai: { planK: 0, planLuck: 1 } }), TH, 1.5)) yes++;
  assert.ok(yes > 140 && yes < 260, `운 ${yes} / 400`);
}, { dive: 1 }));

test('견줌 ⓐ 꺾어 딛기 · ⓑ 줄임만 · ⓒ 저절로 비킴 (공격 창 — 첫 시제품 그대로)', () => {
  withMode('a', () => {
    const f = body();
    cnSee(f, TH);
    cnStepTick(f, DT);
    assert.ok(f.cnStep.open, '창');
    f.move = { x: 1, y: 0 };
    cnStepTick(f, DT);
    assert.deepEqual(f.gait.burst, { fore: 0, side: 1, lat: 1 });
    near(cnStepKeep(f), 1 - C.cut);
  });
  withMode('b', () => {
    const f = body();
    cnSee(f, TH);
    cnStepTick(f, DT);
    f.move = { x: -1, y: 0 };
    cnStepTick(f, DT);
    assert.equal(f.gait.burst, null, '몸 움직임 없음');
    near(cnStepKeep(f), 1 - C.cut);
  });
  withMode('c', () => {
    const f = body();
    cnSee(f, TH);
    cnStepTick(f, DT);
    assert.equal(f.gait.burst?.side, -1);
    assert.deepEqual(cnStepMove(f), { x: -1, y: 0 });
    const busy = body({ aiCtl: { mode: 'attack' } });
    cnSee(busy, TH);
    cnStepTick(busy, DT);
    assert.equal(busy.gait.burst, null, '치는 중');
  });
  withMode('a', () => {
    const f = body();
    const ai = { me: f, proficiency: 5, mode: 'watch', pers: { circleDir: 1 } };
    cnSee(f, TH);
    cnStepTick(f, DT);
    assert.deepEqual(cnAiTurn(ai, 1, 0), [0, -1], 'ⓐ AI 꺾음');
  });
});

test('판에서 쓰임 (켠 판) — 환도 AI 숙련 5 대 롱소드 AI (씨앗 2 · 30 s): 꺾음 · 줄임이 걸림 · 한도에 막힘 · 偏閃奏進 굴림 · 뛰어듦 / 뛰어들기 0 이면 굴림 없음', () => {
  const run2 = (o) => withMode('turn', () => trace({ weapon: 'hwando', weapon2: 'longsword', seed: 2, secs: 30 }), o);
  const a = run2({ dive: 1 });
  const n = a.n[0];
  assert.ok(n.turn > 0 && n.trig > 0 && n.block > 0 && n.onT > 0, JSON.stringify(n));
  assert.ok(n.onT / n.T < 0.4, '늘 켜지지 않음');
  const cn = a.cn[1];
  assert.ok(cn.dive > 0 && cn.diveGo > 0, JSON.stringify(cn));
  const b = run2({ dive: 0 });
  assert.equal(b.cn[1].diveRoll, 0);
  assert.equal(a.n[1], null, '롱소드 몸은 셈 없음');
});
