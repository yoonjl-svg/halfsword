// 동방 격살 AI 몫 시험 (11/14 사장님 '동방도 격살 쓰게 해' — ai.js gyeoksalAi · gkWant · secretGo · config SECRET.aiOpenSchools · SECRET.gyeoksalAi · UNIQUE_ASSIST.cnHunt.ai ·
//  기록 docs/strike/cn_ai_gyeoksal_2026-11-14.md): 열림(숙련도 문) · 쓸 때(겹 1 · 10 s) · 나서며 받음(걸음 앞) · 사람과 같은 다섯 조건 · 갈라지면 저절로 · 사람과 같은 한 칼(판정 · 사냥 겹 빠르기) ·
//  AI 쉼 걸쇠는 격살엔 안 걸림 · 판당 1 번.  node --test tools/sim/cn_ai_gyeoksal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { useSecret } from '../../src/secret.js';

const { SECRET, UNIQUE_ASSIST: UA, AI_PLAN } = CONFIG;
/** 옛 판(`?aiPlan=0` — 유파 플랜 끔)으로 fn: 11/14 사장님 '동방도 반드시 스택이 쌓여야 격살을 쓴다는 절대적 규칙은 지우자 마음의 기울기로 남겨둬' 뒤
 *  플랜 몸(동방 숙련 1 ~ 6 · 기본 켬)의 격살 쓸 때는 마음의 기울기(ai_plan_cn.js cnWill · 시험 ai_plan_cn.test) — 옛 문(겹 1 · 10 s) 장면은 옛 판에서 그대로 봄 (기준 안 고침) */
function oldPlan(fn) {
  const keep = AI_PLAN.on;
  AI_PLAN.on = 0;
  try { return fn(); } finally { AI_PLAN.on = keep; }
}

/** AI 동방(숙련 5) 하나 — 칼 든 상대 앞 · 판 시작 정지는 지난 것으로 */
function cnAi(prof = 5, weapon = 'qinggang') {
  const G = newRound({ weapon: 'longsword', weapon2: weapon, seed: 1, gap: 1.35 });
  G.ai.update = () => {};
  while (G.t < 0.5) G.step();
  const ai = new AI(G.enemy, G.player, 'expert', { proficiency: prof });
  return { G, ai, free: () => G.world.free() };
}
/** 상대 칼이 들어오는 중 (최근 칼끝 6 m/s — gyeoksal.test fastFoe 와 같은 꼴) */
function fastFoe(ai, v = 6) {
  if (ai.sense.head < 0) ai.sense.record(DT); // 눈에 한 칸은 있게
  const s = ai.sense.buf[ai.sense.head];
  s.t = 0;
  s.tvx = v;
  s.tvy = s.tvz = 0;
}
/** 격살 시도 막기 한 번을 대본으로: 막기 줄 line · 걸음(스틱) · 닿음 차례 touches(스텝마다 true/false) → secretGo 로 간 ctx (안 갔으면 null) */
function attempt(ai, { line = 'highR', stick = [0, 1], touches = [true, true, false], speed = 6, woundAge = Infinity, t0 = 0 } = {}) {
  ai.mode = 'defend';
  ai.defLine = line;
  ai.defVoid = false;
  ai.gk = { t: t0, seen: false, pend: null };
  ai.gkWoundAge = woundAge;
  ai.me.stickX = stick[0];
  ai.me.stickY = stick[1];
  fastFoe(ai, speed);
  let sent = null;
  ai.secretGo = (S, ctx) => ((sent = { S: S.name, ...ctx }), true);
  for (const t of touches) {
    ai.gkTouch = () => t;
    ai.gyeoksalAi(1.35, DT);
  }
  return sent;
}




test('조건 (사람 gyeoksalTick 과 같음): 처음 닿음이 press 안 · 걸음 앞 · 상대 칼 들어옴 · 0.6 s 안 안 베임 · 받은 줄이 격살 자세 → 갈라지는 스텝에 받은 자세의 급소로 (ctx gk)', () => {
  const B = cnAi();
  const { ai } = B;
  try {
    const ok = attempt(ai, { line: 'highR' });
    assert.deepEqual(ok, { S: 'gyeoksal', slot: 'geojeong', stance: 'geojeong', line: 'highR', gk: true });
    assert.equal(attempt(ai, { line: 'thrust' }).slot, 'eogeo');
    assert.equal(attempt(ai, { line: 'lowL' }).slot, 'yoryak');
    assert.equal(attempt(ai, { line: 'highL' }).slot, 'bongdu');
    assert.equal(attempt(ai, { t0: SECRET.gyeoksal.press + 0.05 }), null, '때 늦음');
    assert.equal(attempt(ai, { stick: [0, -0.3] }), null, '나서지 않음');
    assert.equal(attempt(ai, { stick: [0.9, 0.5] }), null, '옆 걸음');
    assert.equal(attempt(ai, { speed: 2 }), null, '상대 칼이 들어오지 않음');
    assert.equal(attempt(ai, { woundAge: 0.1 }), null, '방금 베임');
    assert.equal(attempt(ai, { line: 'nope' }), null, '격살 자세가 아닌 줄');
    assert.equal(attempt(ai, { touches: [true, true, true] }), null, '아직 붙어 있음 — 기다림');
    assert.ok(ai.gk?.pend, '기다리는 중');
    ai.gkWoundAge = 0;
    ai.gkTouch = () => false;
    ai.gyeoksalAi(1.35, DT);
    assert.equal(ai.gk, null, '기다리는 동안 베이면 없던 일');
    ai.gk = { t: 0, seen: false, pend: null };
    ai.mode = 'attack';
    ai.gyeoksalAi(1.35, DT);
    assert.equal(ai.gk, null, '내가 공격하면 없던 일');
  } finally { B.free(); }
});

