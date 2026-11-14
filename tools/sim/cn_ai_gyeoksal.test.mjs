// 동방 격살 AI 몫 시험 (11/14 사장님 '동방도 격살 쓰게 해' — ai.js gyeoksalAi · gkWant · secretGo · config SECRET.aiOpenSchools · SECRET.gyeoksalAi · UNIQUE_ASSIST.cnHunt.ai ·
//  기록 docs/strike/cn_ai_gyeoksal_2026-11-14.md): 열림(숙련도 문) · 쓸 때(겹 3 · 10 s) · 나서며 받음(걸음 앞) · 사람과 같은 다섯 조건 · 갈라지면 저절로 · 사람과 같은 한 칼(판정 · 사냥 겹 빠르기) ·
//  AI 쉼 걸쇠는 격살엔 안 걸림 · 판당 1 번.  node --test tools/sim/cn_ai_gyeoksal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { useSecret } from '../../src/secret.js';

const { SECRET, UNIQUE_ASSIST: UA } = CONFIG;

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

test('열림: aiOpenSchools 에 동방 · AI 몫(aiSecret) = 격살 · 숙련도 5 이상만 · 격살 끔이면 옛 막기 연환 · AI 사냥 겹 켬 · 쓸 때 값 [사장님 11/14]', () => {
  assert.ok(SECRET.aiOpenSchools.includes('chinese'));
  assert.equal(TRADITIONS.chinese.aiSecret.name, 'gyeoksal');
  assert.equal(UA.cnHunt.ai, 1);
  assert.deepEqual(SECRET.gyeoksalAi, { stacks: 3, late: CONFIG.realS(10) });
  for (const [prof, want] of [[5, 'gyeoksal'], [4, null]]) {
    const B = cnAi(prof);
    try { assert.equal(B.ai.secret?.name ?? null, want, `숙련도 ${prof}`); } finally { B.free(); }
  }
  const keep = SECRET.gyeoksal.on;
  SECRET.gyeoksal.on = 0;
  const B = cnAi(5);
  try { assert.equal(B.ai.secret.name, 'lianhuanParry', '`?gyeoksal=0` = 옛 막기 연환'); } finally { B.free(); SECRET.gyeoksal.on = keep; }
});

test('쓸 때 (gkWant — 판당 1 번이라 아낌): 상대 사냥 겹 3 이상 · 또는 판이 10 s 넘음 — 그 전엔 보통 막기', () => {
  const B = cnAi();
  const { ai } = B;
  try {
    ai.me.fightT = 0;
    ai.foe.cnHunt = { n: 2, hits: 2, last: new Map(), t5: null };
    assert.equal(ai.gkWant(), false);
    ai.foe.cnHunt.n = 3;
    assert.equal(ai.gkWant(), true);
    ai.foe.cnHunt.n = 0;
    ai.me.fightT = CONFIG.realS(10);
    assert.equal(ai.gkWant(), true);
  } finally { B.free(); }
});

test('나서며 받음: 칼로 받기로 정한 막기(respond)에 격살 시도를 두고 걸음은 앞(스틱 1) — 칼이 닿거나 때(gyeoksal.press)가 지나면 보통 막기 걸음(−0.3) · 피하기 · 다 쓴 판은 시도 없음', () => {
  const B = cnAi();
  const { ai } = B;
  try {
    ai.me.fightT = CONFIG.realS(10);
    const rnd = Math.random;
    let k = 0;
    Math.random = () => (k++ === 0 ? 0 : 0.99); // 막기 봄(첫 굴림) · 패시브 · 맞받아 베기 · 피하기 안 함
    try { assert.equal(ai.respond({ id: 1, line: 'highR', thrust: false }, 1.35), true); } finally { Math.random = rnd; }
    assert.equal(ai.mode, 'defend');
    assert.equal(ai.defVoid, false);
    assert.ok(ai.gk && !ai.gk.seen);
    ai.moveFeet(DT, 1.35);
    assert.equal(ai.me.stickY, 1, '나섬');
    ai.gk.t = SECRET.gyeoksal.press + 0.01;
    ai.moveFeet(DT, 1.35);
    assert.equal(ai.me.stickY, -0.3, '때가 지남 — 보통 막기');
    useSecret(ai.me);
    k = 0;
    Math.random = () => (k++ === 0 ? 0 : 0.99);
    try { ai.respond({ id: 2, line: 'highR', thrust: false }, 1.35); } finally { Math.random = rnd; }
    assert.equal(ai.gk, null, '판당 1 번을 다 씀');
  } finally { B.free(); }
});

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

test('한 칼 = 사람과 같은 격살 (secretGo → requestCombo 덧칸 — 판정 배율 · 칼끝 빠르기 0.7 × 사냥 겹) · AI 쉼 걸쇠는 격살엔 안 걸림 · 판당 1 번 셈', () => {
  for (const [n, share] of [[0, 0.7], [5, 0.7 * 1.4]]) {
    const B = cnAi();
    const { ai, G } = B;
    try {
      if (n) ai.foe.cnHunt = { n, hits: n, last: new Map(), t5: null };
      ai.staminaRest = true;
      assert.equal(ai.secretGo(ai.secret, { slot: 'yoryak' }), false, '쉼 걸쇠 — 보통 비기 길은 막힘');
      assert.equal(ai.secretGo(ai.secret, { slot: 'yoryak', gk: true }), true, '격살은 기력 0 이하만 막음');
      assert.equal(ai.me.secretUsed, 1);
      assert.ok(Math.abs(ai.me.iaiReq.share - share) < 1e-12, `겹 ${n}`);
      assert.equal(ai.me.iaiReq.hitMul, SECRET.gyeoksalHitMul ?? SECRET.hitMul);
      assert.equal(ai.me.iaiReq.arcCut, true);
      assert.equal(ai.secretGo(ai.secret, { slot: 'yoryak', gk: true }), false, '판당 1 번');
      for (let i = 0; i < 3; i++) G.step();
    } finally { B.free(); }
  }
});
