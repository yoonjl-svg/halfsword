// 일본 AI 고노센 쓰임 (11/19 — 사장님 11/19 '시작하면 무조건 고노센 웅크려서 샌드백이 되는 게 아니라 쓰기로 판단했을 때 준비하고 가급적 정확히 노려 발동되도록' ·
//  src/ai_plan_jp.js jpBeat · jpGnsRoom · jpGnsCue · jpGnsPrep · jpGnsSeat · jpGnsVoid · jpGnsIgnore · ai.js moveFeet · watch · respond · 기록 docs/strike/gonosen_ai_2026-11-19.md):
//  준비 결심(한 박자마다)은 틈(거리 − 상대 칼끝 어림 − 다가옴 × 한 박자)이 gnsRoom 이상일 때만 굴림(몫 = 띠 기울기 × 칸 lure × 쓸 까닭) · 결심한 동안 틈이 0 아래면 그만둠 ·
//  칼집에 든 준비는 미리 줄 닫기를 건너뛰고 · 칼이 오면 뽑아 받는 대신 물러나 헛치게 · 먼 위협 무시는 걸어 드는 몫을 뺌 · 판에서 결심 없이는 서지 않음.
//  node --test tools/sim/gonosen_ai.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { tiltOf } from '../../src/ai_plan.js';
import { readInit, readTick } from '../../src/ai_read.js';
import { jpInit, jpBeat, jpGnsRoom, jpGnsCue, jpGnsPrep, jpGnsSeat, jpGnsVoid, jpGnsIgnore, jpGnsKeep, jpGnsDrawHold, JP_PLAN } from '../../src/ai_plan_jp.js';
import { gnsEnterLine, IaiArm } from '../../src/secret.js';

const { AI_PLAN, AI_PLAN_JP: J, SECRET, GAIT } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

/** Math.random 을 잠깐 바꿈 (값 고정 · 굴림 셈) */
function withRandom(val, fn) {
  const rnd = Math.random;
  let n = 0;
  Math.random = () => (n++, val);
  try {
    return { r: fn(), draws: () => n };
  } finally {
    Math.random = rnd;
  }
}
/** 칼집에 든 몸 (iai_obi.js iaiSeated 가 보는 칸만) */
const seatedBody = () => ({ weapon: { id: 'uchigatana' }, notoSeat: 1, noto: { tab: [1] }, skill: { thrustPose: { w: 1 } }, armed: true, sword: {}, state: 'stand', stamina: { value: 100, infinite: false, secretReady: true } });
/** 가짜 일본 AI (고노센 쓰임 셈만 — 몸 없음) */
function fakeJp(prof = 5, o = {}) {
  const ai = {
    proficiency: prof,
    planK: tiltOf(prof),
    planLure: prof >= JP_PLAN.lureAt,
    planC: JP_PLAN.probe,
    planR: { mode: null },
    stats: { plan: {} },
    sense: { t: 20 },
    level: { reaction: 0.1 },
    d: 3.0,
    foeReach: 1.5,
    foeClosing: 0,
    foeAggro: 0,
    M: { reach: 1.5, contact: 1.2 },
    mode: 'watch',
    chasing: false,
    iaiArm: new IaiArm(),
    me: seatedBody(),
    foe: { swordArt: { tradition: 'japanese' }, stamina: { value: 50, infinite: false } },
    ...o,
  };
  ai.startWithdraw = (t) => ((ai.mode = 'withdraw'), (ai.wdT = t));
  readInit(ai);
  jpInit(ai);
  return ai;
}
const still = { hvx: 0, hvy: 0, hx: 0, hy: 0, state: 'stand' };
const raise = { hvx: 0, hvy: 2.5, hx: 0, hy: 0.3, state: 'stand' };

test('틈 (jpGnsRoom): 거리 − 상대 칼끝 어림 − 다가옴 × 한 박자 (AI_PLAN.beat) · 물러나는 상대는 0 으로', () => {
  const ai = fakeJp(5, { d: 3.0, foeReach: 1.5 });
  assert.ok(near(jpGnsRoom(ai), 1.5));
  ai.foeClosing = 0.4;
  assert.ok(near(jpGnsRoom(ai), 1.5 - 0.4 * AI_PLAN.beat));
  ai.foeClosing = -0.5;
  assert.ok(near(jpGnsRoom(ai), 1.5), '물러나는 상대는 0');
});

test('쓸 까닭 (jpGnsCue): 걸어 듦 1 · 버릇이 선 안에서 칼을 듦 1 · 선 밖이면 coin/2 · 모르면 coin · 몰아침은 그 위로', () => {
  const ai = fakeJp(5);
  const line = gnsEnterLine(ai.M);
  assert.equal(jpGnsCue(ai), AI_PLAN.coin, '모름');
  ai.foeClosing = GAIT.walkMin;
  assert.equal(jpGnsCue(ai), 1, '걸어 듦');
  ai.foeClosing = 0;
  const mk = (ds) => {
    const b = fakeJp(5);
    for (const d of ds) readTick(b, 1 / 120, d, raise, null), readTick(b, 1 / 120, d, still, null);
    return b;
  };
  assert.equal(jpGnsCue(mk([line - 0.2, line - 0.1])), 1, '선 안에서 듦');
  assert.equal(jpGnsCue(mk([line + 0.3, line + 0.4])), AI_PLAN.coin / 2, '선 밖에서 듦');
  const c = mk([line + 0.3, line + 0.4]);
  c.foeAggro = 0.9;
  assert.equal(jpGnsCue(c), 0.9, '몰아침');
});

test('준비 결심 (jpBeat): 틈이 gnsRoom 이상 · 기력 · 칸 lure 일 때만 굴림 — 몫 = 띠 기울기 × lure × 쓸 까닭 · 결심한 동안 · 준비됨 · 4 아래는 안 굴림', () => {
  const p = (ai) => ai.planK * ai.planC.lure * jpGnsCue(ai);
  const a = fakeJp(5, { d: 1.5 + J.gnsRoom + 0.01 });
  withRandom(p(a) - 1e-6, () => jpBeat(a));
  assert.equal(a.jpGns.prep, true, '몫 아래 — 결심');
  assert.equal(a.stats.plan.jp.lure, 1);
  assert.equal(withRandom(0, () => jpBeat(a)).draws(), 0, '결심한 동안 다시 안 굴림');
  const b = fakeJp(5, { d: 1.5 + J.gnsRoom + 0.01 });
  withRandom(p(b) + 1e-6, () => jpBeat(b));
  assert.equal(b.jpGns.prep, false, '몫 위 — 안 함');
  const c = fakeJp(5, { d: 1.5 + J.gnsRoom - 0.01 });
  assert.equal(withRandom(0, () => jpBeat(c)).draws(), 0, '틈이 모자라면 굴리지 않음');
  assert.equal(c.jpGns.prep, false);
  const e = fakeJp(5, { d: 4 });
  e.me.stamina.value = (SECRET.gnsCost ?? 35) - 1;
  assert.equal(withRandom(0, () => jpBeat(e)).draws(), 0, '고노센 값보다 기력이 적으면 안 굴림');
  const f = fakeJp(5, { d: 4, planC: JP_PLAN.commit });
  assert.equal(withRandom(0, () => jpBeat(f)).draws(), 0, '칸 lure 0');
  const g = fakeJp(5, { d: 4 });
  g.iaiArm.armed = true;
  assert.equal(withRandom(0, () => jpBeat(g)).draws(), 0, '이미 준비됨');
  const h = fakeJp(4, { d: 4, iaiArm: null });
  assert.equal(withRandom(0, () => jpBeat(h)).draws(), 0, '고노센 없음');
  const k = fakeJp(5, { d: 4, mode: 'defend' });
  assert.equal(withRandom(0, () => jpBeat(k)).draws(), 0, '간 보기 아님');
});

test('결심한 동안 (jpGnsPrep): 틈이 0 아래로 줄면 그만둠 (보통 간 보기) · 결심 없으면 서지 않음', () => {
  const ai = fakeJp(5, { d: 2.4 });
  assert.equal(jpGnsPrep(ai), false, '결심 없음');
  ai.jpGns.prep = true;
  assert.equal(jpGnsPrep(ai), true);
  ai.d = ai.foeReach + 0.05;
  assert.equal(jpGnsPrep(ai), true, '틈 0.05 — 이어 섬');
  ai.foeClosing = 0.05 / AI_PLAN.beat + 0.05;
  assert.equal(jpGnsPrep(ai), false, '걸어 드는 상대가 한 박자 안에 닿음 — 그만둠');
  assert.equal(ai.jpGns.prep, false);
  assert.equal(ai.stats.plan.jp.prepOff, 1);
});

test('칼집에 든 준비 (jpGnsSeat · jpGnsVoid): 준비됨 + 칼집에 듦일 때만 — 칼이 오면 물러나 헛치게 (gnsVoidT · 물러남은 준비 유지)', () => {
  const ai = fakeJp(5);
  assert.equal(jpGnsSeat(ai), false, '준비 전');
  assert.equal(jpGnsVoid(ai), false);
  ai.iaiArm.armed = true;
  assert.equal(jpGnsSeat(ai), true);
  ai.me.notoSeat = 0.5;
  assert.equal(jpGnsSeat(ai), false, '납도 중');
  ai.me.notoSeat = 1;
  ai.me.iaiDraw = { t: 0 };
  assert.equal(jpGnsSeat(ai), false, '뽑는 중');
  delete ai.me.iaiDraw;
  assert.equal(jpGnsVoid(ai), true);
  assert.equal(ai.mode, 'withdraw');
  assert.equal(ai.wdT, J.gnsVoidT);
  assert.equal(ai.stats.plan.jp.void, 1);
});

test('먼 위협 무시 (jpGnsIgnore): 걸어 드는 상대는 다가옴 × gnsLead 를 빼고 견줌', () => {
  const ai = fakeJp(5);
  ai.iaiArm.armed = true;
  withRandom(0, () => jpGnsKeep(ai));
  assert.equal(ai.jpGns.keep, true);
  const d = ai.foeReach + 0.3;
  assert.equal(jpGnsIgnore(ai, { id: 1 }, d), true, '서 있는 상대 — 무시');
  ai.foeClosing = 0.15 / J.gnsLead + 0.05;
  assert.equal(jpGnsIgnore(ai, { id: 2 }, d), false, '걸어 드는 상대 — 받음');
});

test('판: 일본 숙련 5 AI 는 결심 없이는 간 보기 동안 제자리에 서서 셈을 쌓지 않음 · 결심한 동안만 섬 (ai.js moveFeet)', async () => {
  let stillNoPrep = 0;
  let stillPrep = 0;
  let watchNoPrep = 0;
  for (let seed = 1; seed <= 6 && !stillPrep; seed++) {
    const G = newRound({ seed, weapon: 'uchigatana', weapon2: 'uchigatana', difficulty: 'hard', persona: { proficiency: 5 } });
    const ai = G.ai;
    assert.ok(ai.planJp && ai.iaiArm);
    G.before = () => G.player.move.set(0, 0);
    for (let i = 0; i < 10 / DT; i++) {
      G.step();
      if (ai.mode !== 'watch' || ai.chasing || ai.iaiArm.armed) continue;
      const st = !(G.enemy.stickX || G.enemy.stickY);
      if (ai.jpGns.prep) stillPrep += st ? 1 : 0;
      else (watchNoPrep++, (stillNoPrep += st && ai.iaiArm.t > 0.5 ? 1 : 0));
    }
    G.world.free();
  }
  assert.ok(stillPrep > 0, '결심한 동안 섬');
  assert.ok(stillNoPrep <= watchNoPrep * 0.1, `결심 없이 선 채 셈을 0.5 s 넘게 쌓음 ${stillNoPrep} / ${watchNoPrep}`);
});

test('칼집에 든 준비의 기다림 한도 (jpGnsDrawHold · gnsWait): 가까우면 뽑아 치지 않음 · 상대가 gnsWait 넘게 조용하면 거둠 · 멀면 뽑음', () => {
  const ai = fakeJp(5, { d: 1.5 + J.gnsRoom - 0.05 });
  ai.iaiArm.armed = true;
  assert.equal(jpGnsDrawHold(ai), true, '한 걸음 안 — 뽑지 않음');
  ai.jpGns.quietT = J.gnsWait;
  assert.equal(jpGnsDrawHold(ai), false, '조용한 상대 — 기다림을 거둠');
  ai.jpGns.quietT = 0;
  ai.d = 1.5 + J.gnsRoom + 0.05;
  assert.equal(jpGnsDrawHold(ai), false, '멀면 뽑아 침');
  ai.d = 1.5 + J.gnsRoom + 0.05;
  ai.foeClosing = 0.2 / SECRET.gnsDraw;
  assert.equal(jpGnsDrawHold(ai), true, '다가오는 상대는 뽑는 동안 다가옴을 셈');
  ai.iaiArm.armed = false;
  assert.equal(jpGnsDrawHold(ai), false, '준비 아님');
});

test('판: 서 있기만 하는 상대 앞에서 칼집에 든 채 끝없이 서지 않음 (gnsWait 뒤 뽑아 침)', async () => {
  const G = newRound({ seed: 2, weapon: 'uchigatana', weapon2: 'uchigatana', difficulty: 'hard', persona: { proficiency: 5 } });
  const ai = G.ai;
  G.before = () => G.player.move.set(0, 0);
  let armedAt = null;
  let drewAfter = false;
  for (let i = 0; i < 25 / DT && !drewAfter; i++) {
    G.step();
    if (armedAt == null && ai.iaiArm.armed) armedAt = G.t;
    if (armedAt != null && (G.enemy.iaiDraw || ai.mode === 'attack')) drewAfter = true;
  }
  assert.ok(armedAt != null, '판 시작에 준비');
  assert.ok(drewAfter, '조용한 상대 앞에서 뽑아 침');
  G.world.free();
});
