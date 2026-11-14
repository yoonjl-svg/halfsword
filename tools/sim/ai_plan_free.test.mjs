// 유파 AI 3 단계 — 무유파 플랜 '막싸움꾼' 시험 (11/14 사장님 'A안 켜고 3단계 진행해' · '독일과 함께 무유파 무모함 켜' · src/ai_plan_free.js · config AI_PLAN_FREE ·
//  기록 docs/strike/ai_plan_free_2026-11-14.md): 기본 켬 · 값은 사다리 칸 · 끄면 판이 바이트 같음 · 무 띠에도 굴림 · 쳐내기 셈(창 · 계획 몫 · 막 휘두름 몫 · 박자) ·
//  쳐낸 뒤 건너 들어감 · 붙어 두들김 · 판에서 실제로 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/ai_plan_free.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { planFor, distErrWidth } from '../../src/ai_plan.js';
import { FREE_PLAN, freeBeat, freeBeatOnWay, freeNeed, freeStepIn, freeAfter, freeFeet, freePress, freeBackK } from '../../src/ai_plan_free.js';

const { AI_PLAN_FREE: F, AI_PLAN } = CONFIG;
function withFree(over, fn) {
  const keep = { ...F };
  Object.assign(F, over);
  try {
    return fn();
  } finally {
    Object.assign(F, keep);
  }
}
function withRandom(v, fn) {
  const r = Math.random;
  Math.random = () => v;
  try {
    return fn();
  } finally {
    Math.random = r;
  }
}
/** AI 둘 판 (자리 0 = 롱소드 AI · 자리 1 = weapon2 AI) — secs 초 돌리며 몸 자리 · 피를 30 스텝마다 적은 글 */
function trace({ weapon2 = 'morgenstern', prof = 2, secs = 8, seed = 2 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const r = { text: out.join(';'), free: G.ai.stats.free ? { ...G.ai.stats.free } : null, plan: !!G.ai.plan };
  G.world.free();
  return r;
}
/** 쳐내기 셈만 보는 가짜 AI 몸 (쳐내기 굴림 · 공격 시작은 기록만) */
function fakeAi({ k = 1, lk = 0, high = false, d = 1.9 } = {}) {
  const ai = {
    planFree: { rollT: 0, crossSeq: -1 },
    planC: FREE_PLAN.contest,
    planK: k,
    planLuck: lk,
    chasing: false,
    Mup: null,
    foe: { alive: true },
    me: { armed: true },
    foeReach: 1.85,
    M: { reach: 1.0, clinch: 0.75 },
    sense: { t: 10 },
    d,
    stats: { free: { beat: 0, wild: 0, onWay: 0, beatBound: 0, beatHit: 0, beatMiss: 0, go: 0, goStrike: 0, press: 0 } },
    started: [],
    foeClass: () => ({ high, online: !high }),
    pickTech: (s, why, prefer) => ({ name: 'zornhau', why, prefer }),
    startAttack(t, why) {
      this.started.push(why);
      this.why = why;
      this.atkSeq = (this.atkSeq ?? 0) + 1;
      return true;
    },
  };
  return ai;
}
const S = { state: 'stand', armed: true };

test('무유파 플랜 기본 켬 · 값은 사다리 칸 · 무유파만 · 끄면 판이 바이트 같음 (값을 바꿔도 안 읽음)', () => {
  assert.equal(F.on, 1, '사장님 11/14 \'독일과 함께 무유파 무모함 켜\'');
  assert.ok([0.3, 0.6].includes(F.beatOut) && [0.3, 0.6].includes(F.beatGap), '걸음 사다리');
  for (let p = 0; p <= 6; p++) assert.equal(planFor('none', p), FREE_PLAN, `무유파 숙련 ${p}`);
  assert.equal(withFree({ on: 0 }, () => planFor('none', 3)), null, '끄면 플랜 없음');
  assert.ok(Math.abs(distErrWidth(0, 'none') - AI_PLAN.errMax) < 1e-9 && distErrWidth(5, 'none') === 0, '거리 오차 — 무 0.3 · 높음 0');
  assert.equal(withFree({ on: 0 }, () => distErrWidth(0, 'none')), 0, '끄면 거리 오차 없음');
  const a = withFree({ on: 0 }, () => trace());
  const b = withFree({ on: 0, beat: 1, wild: 1, beatOut: 0.6, beatGap: 0.6, go: 1, press: 1, back: 1 }, () => trace());
  assert.equal(a.text, b.text, '스위치가 꺼져 있으면 값은 판에 안 닿음');
  assert.equal(a.free, null, '재기 칸도 안 생김');
  assert.equal(a.plan, false);
});

test('무 띠(숙련 0)에도 굴림 — 기울기 0 · 굴림 몫 1 / 높음은 기울기 1 · 굴림 0 / 다른 유파 몸은 무유파 자리를 안 탐', () => {
  const G = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'morgenstern', AI2Class: AI, persona: { proficiency: 0 }, persona2: { proficiency: 0 } });
  assert.equal(G.ai.plan, FREE_PLAN);
  assert.equal(G.ai.planK, 0);
  assert.equal(G.ai.planLuck, 1);
  assert.ok(G.ai.planFree && G.ai.stats.free, '무유파 몸만 planFree');
  assert.ok(Math.abs(G.ai.distErr) <= AI_PLAN.errMax + 1e-9, '거리 오차 ±0.3 안');
  assert.equal(G.ai2.planFree, undefined, '롱소드 AI 는 무유파 자리를 안 탐');
  G.world.free();
  const H = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'frozen_tuna', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  assert.equal(H.ai.planK, 1);
  assert.equal(H.ai.planLuck, 0);
  assert.equal(H.ai.distErr ?? 0, 0, '높음은 거리 오차를 안 굴림');
  H.world.free();
});

test('쳐내기 셈: 창(내 칼끝 + 0.1 < d ≤ 상대 칼끝 어림 + beatOut) · 계획 몫(칼이 내 앞 줄) · 막 휘두름 몫 · AI_PLAN.beat 박자 · 다가가다 막힘', () => {
  // 높음(계획 1) · 칼끝이 겨눔 · 창 안 · 굴림 0 → 계획 쳐내기
  let ai = fakeAi();
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), true);
  assert.deepEqual(ai.started, ['beat']);
  assert.equal(ai.stats.free.beat, 1);
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), false, '박자 안에서는 다시 안 굴림');
  ai.sense.t += AI_PLAN.beat;
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), true, '박자가 지나면 다시');
  // 창 밖
  for (const d of [1.85 + F.beatOut + 0.01, 1.05]) {
    ai = fakeAi();
    assert.equal(withRandom(0, () => freeBeat(ai, S, d)), false, `d ${d}`);
  }
  // 굴림이 몫을 넘으면 안 냄 — 몫 = planK × 칸 × beat
  ai = fakeAi();
  assert.equal(withRandom(FREE_PLAN.contest.beat * F.beat + 1e-6, () => freeBeat(ai, S, 1.9)), false);
  // 칼을 높이 든 상대 — 계획 몫 0 · 막 휘두름 몫만 (무 띠: 굴림 몫 1)
  ai = fakeAi({ k: 1, lk: 0, high: true });
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), false, '높이 든 칼은 쳐낼 칼이 없음 (계획)');
  ai = fakeAi({ k: 0, lk: 1, high: true });
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), true, '막 휘두름은 때를 안 가림');
  assert.equal(ai.stats.free.wild, 1);
  // 쓰러진 상대 · 칼 놓친 상대 · 쉼(칸 0)은 안 냄
  ai = fakeAi();
  assert.equal(withRandom(0, () => freeBeat(ai, { state: 'down', armed: true }, 1.9)), false);
  ai = fakeAi();
  ai.planC = FREE_PLAN.tired;
  assert.equal(withRandom(0, () => freeBeat(ai, S, 1.9)), false);
  // 다가가다 막힘: 칠 거리까지 beatGap 넘게 남으면 지금 칼을 쳐내기로 (기술 그대로)
  ai = fakeAi();
  ai.why = 'patience';
  ai.need = 0.9;
  withRandom(0, () => freeBeatOnWay(ai, S, 1.5));
  assert.equal(ai.why, 'beat');
  assert.equal(ai.stats.free.onWay, 1);
  ai = fakeAi();
  ai.why = 'patience';
  ai.need = 1.3;
  withRandom(0, () => freeBeatOnWay(ai, S, 1.5));
  assert.equal(ai.why, 'patience', '칠 거리 가까이면 그대로');
  // 쳐내기 칼은 지금 거리에서 곧장 · 한 걸음 내딛음
  ai.why = 'beat';
  assert.equal(freeNeed(ai, 0.9), 1.85 + F.beatOut);
  assert.equal(freeStepIn(ai), true);
  ai.why = 'patience';
  assert.equal(freeNeed(ai, 0.9), 0.9);
  assert.equal(freeStepIn(ai), false);
});

test('쳐낸 뒤 건너 들어감(몫 = planK × go + 굴림 몫 × coin) · 그 다가감은 스틱 끝 · 붙어 두들김', () => {
  const ai = fakeAi();
  ai.lastSeen = S;
  ai.why = 'beat';
  ai.bound = true;
  ai.atkSeq = 3;
  assert.equal(withRandom(F.go - 1e-6, () => freeAfter(ai, 1.5)), true);
  assert.equal(ai.why, 'dig');
  assert.equal(ai.planFree.crossSeq, ai.atkSeq);
  assert.equal(ai.stats.free.beatBound, 1);
  assert.equal(freeFeet(ai, 0.3, 0.5), 1, '건너 들어가는 다가감은 스틱 끝');
  assert.equal(freeFeet(ai, -0.21, 0), -0.21, '칠 거리면 그대로');
  ai.atkSeq++;
  assert.equal(freeFeet(ai, 0.3, 0.5), 0.3, '다른 공격은 그대로');
  const b = fakeAi();
  b.lastSeen = S;
  b.why = 'beat';
  assert.equal(withRandom(F.go + 1e-6, () => freeAfter(b, 1.5)), false, '몫을 넘으면 안 들어감');
  assert.equal(b.stats.free.beatMiss, 1);
  b.why = 'patience';
  assert.equal(withRandom(0, () => freeAfter(b, 1.5)), false, '쳐내기 칼이 아니면 그대로');
  // 붙어 두들김: 붙은 거리면 이어 칠 몫이 큼 · 물러나는 시간이 짧음 / 멀면 그대로
  b.planC = FREE_PLAN.commit;
  const w = freePress(b, 0.5, 1.1);
  assert.ok(Math.abs(w - (0.5 + 0.5 * FREE_PLAN.commit.press * F.press)) < 1e-9);
  assert.equal(freePress(b, 0.5, 1.5), 0.5);
  assert.ok(Math.abs(freeBackK(b) - (1 - FREE_PLAN.commit.press * F.back)) < 1e-9);
  b.planK = 0;
  assert.equal(freePress(b, 0.5, 1.1), 0.5, '무 띠(기울기 0)는 계획 몫이 없음');
  assert.equal(freeBackK(b), 1);
});

test('판에서 쓰임 — 모르겐슈테른 AI 숙련 5 는 쳐내기(계획) · 건너 들어감 · 숙련 0 은 막 휘두름만 (대 롱소드 AI · 씨앗 1 ~ 2 · 30 s)', () => {
  const sum = (prof) => {
    const T = { beat: 0, wild: 0, go: 0, goStrike: 0 };
    for (const seed of [1, 2]) {
      const r = trace({ weapon2: 'morgenstern', prof, secs: 30, seed });
      for (const k in T) T[k] += r.free[k];
    }
    return T;
  };
  const hi = sum(5);
  assert.ok(hi.beat > 0 && hi.go > 0, JSON.stringify(hi));
  assert.equal(hi.wild, 0, '높음은 굴림 몫 0');
  const lo = sum(0);
  assert.equal(lo.beat, 0, '무 띠는 계획 몫 0');
  assert.ok(lo.wild > 0, JSON.stringify(lo));
});
