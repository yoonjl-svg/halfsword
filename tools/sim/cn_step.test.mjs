// 동방 보법 회피 '편섬(偏閃)' 시제품 시험 (11/15 사장님 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · src/cn_step.js · config CN_STEP ·
//  기록 docs/strike/cn_step_2026-11-15.md): 기본 끔 · 끄면 판이 바이트 같음 · 동방 몸만(사람은 C1) · 공격 창 · 꺾음 · 걷기 시작 · ⓐ 박찬 한 걸음 + 줄임 · ⓑ 줄임만 ·
//  ⓒ 저절로 비킴(칼이 오는 반대쪽) · AI 꺾음 굴림(공격 중은 안 함) · 판에서 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/cn_step.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { cnStepOn, cnSee, cnStepTick, cnStepMove, cnStepKeep, cnAiTurn } from '../../src/cn_step.js';
import { kitFromNodes } from '../../src/skill_tree_data.js';

const C = CONFIG.CN_STEP;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
function withMode(m, fn) {
  const keep = { ...C };
  C.mode = m;
  try {
    return fn();
  } finally {
    Object.assign(C, keep);
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
  const n = G.enemy.cnStep?.n ? { ...G.enemy.cnStep.n } : null;
  G.world.free();
  return { text: out.join(';'), n };
}
/** 가짜 동방 몸 (걸음 장치 · 기력 · 스틱만) */
const body = (o = {}) => ({ swordArt: { tradition: 'chinese' }, move: { x: 0, y: 1 }, state: 'stand', aiControlled: true, aiCtl: { mode: 'watch' }, stamina: { time: 10, value: 80, exhausted: false }, gait: { active: true, burst: null, burstBrake: false, fastK: 1 }, ...o });
const TH = { line: 'highR', thrust: false };
const DT = 1 / 120;

test('기본 끔 · 끄면 동방 판은 값을 안 읽음 · 켜도 동방이 아닌 판(롱소드끼리)은 그대로', () => {
  assert.equal(C.mode, 0, '시제품 — 사장님 판정 전');
  assert.ok([0.2, 0.4, 0.6].map(CONFIG.realS).some((v) => near2(v, C.win)) && [0.2, 0.4].map(CONFIG.realS).some((v) => near2(v, C.slideT)), '시간 사다리');
  const a = trace();
  const b = withMode(0, () => { C.cut = 0.9; C.win = CONFIG.realS(2); return trace(); });
  assert.equal(a.text, b.text);
  assert.equal(a.n, null);
  const m0 = trace({ weapon2: 'longsword' });
  for (const m of ['a', 'b', 'c']) assert.equal(withMode(m, () => trace({ weapon2: 'longsword' })).text, m0.text, `롱소드끼리 ${m}`);
});
function near2(a, b) { return Math.abs(a - b) < 1e-9; }

test('동방 몸만 · 사람은 보법 I(C1 — footwork) 을 익힌 몸만', () => withMode('a', () => {
  assert.equal(cnStepOn(body()), true);
  assert.equal(cnStepOn(body({ swordArt: { tradition: 'german' } })), false);
  assert.equal(cnStepOn(body({ skillKit: kitFromNodes('chinese', new Set(['C3'])) })), false, 'C1 없음');
  assert.equal(cnStepOn(body({ skillKit: kitFromNodes('chinese', new Set(['C1'])) })), true);
  assert.equal(cnStepOn(body({ schoolFootwork: false })), false);
}));

test('ⓐ 꺾어 딛기: 창이 열린 뒤 스틱을 크게 꺾으면 그 쪽 박찬 한 걸음 + 줄임 시간 · 작게 꺾음 · 창 밖은 없음', () => withMode('a', () => {
  const f = body();
  cnSee(f, TH);
  cnStepTick(f, DT);
  assert.ok(f.cnStep.open, '창');
  f.move = { x: 0.2, y: 0.98 }; // 작게 꺾음 (≈ 12°)
  cnStepTick(f, DT);
  assert.equal(f.gait.burst, null);
  f.move = { x: 1, y: 0 }; // 90° 꺾음 → 오른 옆 박찬 걸음
  cnStepTick(f, DT);
  assert.deepEqual(f.gait.burst, { fore: 0, side: 1, lat: 1 });
  assert.equal(f.cnStep.n.trig, 1);
  near(cnStepKeep(f), 1 - C.cut);
  f.stamina.time += C.slideT + 0.01;
  assert.equal(cnStepKeep(f), 1, '줄임 시간이 지나면 그대로');
  // 창이 닫힌 뒤(위협 없음) 꺾음은 셈 안 함
  const g = body();
  cnSee(g, null);
  cnStepTick(g, DT);
  g.move = { x: -1, y: 0 };
  cnStepTick(g, DT);
  assert.equal(g.gait.burst, null);
  // 서 있다 걷기 시작 → 박찬 걸음 (뒤 · 앞도)
  for (const [mv, want] of [[{ x: 0, y: -1 }, -1], [{ x: 0, y: 1 }, 1]]) {
    const h = body({ move: { x: 0, y: 0 } });
    cnSee(h, TH);
    cnStepTick(h, DT);
    h.move = mv;
    cnStepTick(h, DT);
    assert.equal(h.gait.burst?.fore, want, JSON.stringify(mv));
  }
}));

test('ⓑ 줄임만: 꺾으면 창이 끝날 때까지 줄임 · 몸은 그대로 / ⓒ 저절로 비킴: 칼이 오는 반대쪽 · 스틱을 잠깐 쥠 · 치는 중 · 기력 없음은 안 함', () => {
  withMode('b', () => {
    const f = body();
    cnSee(f, TH);
    cnStepTick(f, DT);
    f.move = { x: -1, y: 0 };
    cnStepTick(f, DT);
    assert.equal(f.gait.burst, null, '몸 움직임 없음');
    near(cnStepKeep(f), 1 - C.cut);
    f.stamina.time += C.win + 0.01;
    assert.equal(cnStepKeep(f), 1);
  });
  withMode('c', () => {
    const f = body();
    cnSee(f, TH); // 오른쪽으로 오는 칼 → 왼쪽으로
    cnStepTick(f, DT);
    assert.equal(f.gait.burst?.side, -1);
    assert.deepEqual(cnStepMove(f), { x: -1, y: 0 });
    f.stamina.time += CONFIG.realS(0.2) + 0.01;
    assert.equal(cnStepMove(f), null, '스틱은 잠깐만');
    const busy = body({ aiCtl: { mode: 'attack' } });
    cnSee(busy, TH);
    cnStepTick(busy, DT);
    assert.equal(busy.gait.burst, null, '치는 중');
    const tired = body({ stamina: { time: 10, value: 5, exhausted: false } });
    cnSee(tired, TH);
    cnStepTick(tired, DT);
    assert.equal(tired.gait.burst, null, '기력 모자람');
  });
});

test('AI 꺾음: 창 하나에 한 번 굴림 — 높음(띠 기울기 1)은 늘 · 공격 중은 안 굴림 · 칼이 오는 반대쪽 옆 스틱을 잠깐', () => withMode('a', () => {
  const f = body();
  const ai = { me: f, proficiency: 5, mode: 'watch', pers: { circleDir: 1 } };
  cnSee(f, TH);
  cnStepTick(f, DT);
  assert.deepEqual(cnAiTurn(ai, 1, 0), [0, -1]);
  f.stamina.time += C.aiT + 0.01;
  assert.deepEqual(cnAiTurn(ai, 1, 0), [1, 0], '잠깐 뒤 그대로');
  const g = body();
  const at = { me: g, proficiency: 5, mode: 'attack', pers: { circleDir: 1 } };
  cnSee(g, TH);
  cnStepTick(g, DT);
  assert.deepEqual(cnAiTurn(at, 1, 0), [1, 0], '공격 중');
}));

test('판에서 쓰임 — 환도 AI 숙련 5 대 롱소드 AI (씨앗 1 · 20 s): ⓐ 창 · 꺾음 · 박찬 걸음 · ⓒ 저절로 비킴', () => {
  const a = withMode('a', () => trace({ secs: 20 }));
  assert.ok(a.n.win > 0 && a.n.trig > 0 && a.n.slide > 0, JSON.stringify(a.n));
  const c = withMode('c', () => trace({ secs: 20 }));
  assert.ok(c.n.auto > 0, JSON.stringify(c.n));
});
