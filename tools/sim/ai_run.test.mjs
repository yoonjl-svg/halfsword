// AI 뛰기 시험 (11/19 사장님 '뛰기 AI에도 넣고 무리 싸움에 먼저 넣어.' — src/ai_run.js · config AI_RUN · 기록 docs/strike/ai_run_2026-11-19.md):
//  ① 1:1 AI 는 뛰지 않음 (runReach 를 두지 않아 f.run 이 없음 — 관문 바이트 같음)
//  ② 셋 이상 판 AI 는 사람과 같은 규칙으로 뜀 (2:1 판 시작 — 짝의 둘째가 혼자와 붙은 동료에게 끼어듦): 걷는 끝보다 빠름 · 뛰는 동안 기력 초당 runCostRate · 회복 없음 ·
//     몸이 뛰는 쪽을 봄 · 닿기 전에 멈춤 · 닿을 때 기력 AI_RUN.keep 넘게
//  ③ 언제 (가짜 판): 겨눈 상대가 내 동료를 겨눔 → join · 나를 겨눠 다가옴 · 제삼자와 붙음(셋 따로) → 안 뜀 · 나를 겨눈 채 멀어짐 → chase · 다른 적이 칼끝 + near 안 → 안 뜀 ·
//     닿을 때 기력 어림이 keep 밑 → 안 뜀 · 간 보기 꼴이 아님 → 안 뜀 · 공격 꼴이면 runBreak · 뛰는 쪽 옆 몫 ≤ 앞 몫 × lat · 난수 안 부름
//  ① · ② 판은 AI 굴림(Math.random)에 씨앗을 둔다 (seedRand — 같은 씨앗이면 늘 같은 싸움)
//  node --test tools/sim/ai_run.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG, DT } from './jelly_harness.mjs';
import { aiRunFeet } from '../../src/ai_run.js';
import { createSense, recordSense } from '../../src/team_sense.js';
import { runCostRate, walkTopOf } from '../../src/run.js';
import { aiAtProficiency } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';

const { AI_RUN, RUN, GAIT } = CONFIG;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// AI 굴림 씨앗 (11/20 들쭉날쭉 고침): newMatch 의 seed 는 무기 파손 굴림(breakSeed)만 — AI 생성자 · 판단 굴림은 전역 Math.random 이라 시험이 씨앗을 둔다
//  (fights12 · many_fighters.test.mjs 와 같은 굴림). 안 두면 판마다 다른 싸움 — ② 가 20 번에 2 ~ 4 번 'AI 가 뜀'(아무도 안 뛴 판)으로 깨졌다.
//  시험이 끝나면 원래 Math.random 으로 되돌림 (같은 파일 다른 시험에 새지 않게 — 한 시험에서 여러 번 불러도 처음 것으로)
const realRandom = Math.random;
const seedRand = (t, seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  t.after(() => { Math.random = realRandom; });
};

test('① 1:1 AI 는 뛰지 않음: 15 s 판에서 두 AI 몸 모두 f.run · runReach 가 없음 (판 사본도 없음)', (t) => {
  seedRand(t, 2);
  const G = newMatch({ seed: 2, ai: 'all' });
  assert.equal(G.sense, undefined);
  for (let i = 0; i < 15 / DT && !G.over; i++) G.step();
  for (const f of G.fighters) {
    assert.ok(f.aiControlled);
    assert.equal(f.run, undefined, `${f.name} f.run 없음`);
    assert.equal(f.runReach, undefined, `${f.name} runReach 를 두지 않음`);
  }
  G.world.free();
});

test('② 셋 이상 판 AI 는 사람과 같은 규칙으로 뜀 (2:1 판 시작 — 짝의 둘째가 동료와 붙은 혼자에게)', (t) => {
  seedRand(t, 1);
  const W = ['zweihander', 'longsword', 'flamberge']; // 11/19 재기에 에스톡 · 세이버 안 씀 (전 estoc)
  const G = newMatch({ count: 3, ai: 'all', seed: 1, walls: true, weapons: W, looks: Array(3).fill(LOOKS.enemy), aiOf: (i) => aiAtProficiency({ ai: { persona: {} }, weapon: W[i] }, 4) });
  assert.ok(G.sense);
  const F = G.fighters;
  const rec = [];
  for (let i = 0; i < 6 / DT && !G.over; i++) {
    G.step();
    for (const f of F) {
      if (!f.run?.on) continue;
      const p = f.bodies.pelvis.translation();
      const v = f.bodies.pelvis.linvel();
      const q = f.foe.bodies.chest.translation();
      rec.push({ f, t: G.t, st: f.stamina.value, rest: f.stamina.rest, v: Math.hypot(v.x, v.z), head: f.heading, face: Math.atan2(-f.run.dz, f.run.dx), d: Math.hypot(q.x - p.x, q.z - p.z) });
    }
  }
  const runners = [...new Set(rec.map((r) => r.f))];
  assert.ok(runners.length >= 1, 'AI 가 뜀');
  for (const f of runners) {
    const R = rec.filter((r) => r.f === f);
    assert.ok(f.run.runs >= 1);
    assert.ok(R.some((r) => r.v > walkTopOf(f) * 1.3), `걷는 끝보다 빠름 (가장 빠름 ${Math.max(...R.map((r) => r.v)).toFixed(2)})`);
    for (let i = 1; i < R.length; i++) {
      if (R[i].t - R[i - 1].t > DT * 1.5) continue;
      assert.ok(R[i].st <= R[i - 1].st + 1e-9, '뛰는 동안 기력이 오르지 않음 (자연 회복 없음)');
      assert.ok(R[i].rest < DT * 1.5, '회복 시계가 스텝마다 0 으로 (뛰는 동안 회복 없음)');
    }
    let k = 1;
    while (k < R.length && R[k].t - R[k - 1].t < DT * 1.5) k++;
    const a = R[0];
    const b = R[k - 1]; // 첫 뛰기의 끝
    if (b.t - a.t > 0.3) assert.ok(Math.abs(a.st - b.st - runCostRate(f) * (b.t - a.t)) < runCostRate(f) * 0.1, `초당 runCostRate (${((a.st - b.st) / (b.t - a.t)).toFixed(2)} ≈ ${runCostRate(f).toFixed(2)})`);
    assert.ok(R.filter((r) => r.t - a.t > 0.5).every((r) => Math.abs(wrap(r.head - r.face)) < 0.6), '몸이 뛰는 쪽을 봄 (BODY.turnSpeed 그대로)');
    assert.ok(b.st > AI_RUN.keep - 1, `닿을 때 기력 남김 ${b.st.toFixed(1)}`);
    assert.ok(b.d > (f.foe.aiCtl?.M?.reach ?? 1.8), `상대 칼끝 밖에서 멈춤 (${b.d.toFixed(2)})`);
    assert.ok(f.run.end === 'stick' || f.run.on, `AI 가 스틱을 되돌려 멈춤 (${f.run.end})`);
  }
  G.world.free();
});

// ── 가짜 판 (team_sense.test.mjs 와 같은 꼴) ──
/** 가짜 몸 + AI: 가슴 (x, z) · 바라보는 각 heading · 편 */
function fake(index, team, x, z, heading, o = {}) {
  const f = {
    index, team, heading, alive: true, revival: null, state: 'stand', feetHeld: false, barge: null, blood: 1, foe: null, legHealth: 1, weapon: {}, swordArt: { tradition: 'german' },
    gait: { active: true, P: GAIT }, wearsPlate: () => false,
    stamina: { value: o.st ?? 100, level: 0, exhausted: false, infinite: false },
    bodies: { chest: { translation: () => ({ x, y: 1.3, z }) }, pelvis: { translation: () => ({ x, y: 0.9, z }), linvel: () => ({ x: 0, y: 0, z: 0 }) } },
  };
  f.aiCtl = { me: f, mode: o.mode ?? 'watch', M: { reach: 1.8 }, mainProficiency: 4, proficiency: 4, stats: {}, sense: { t: 0 }, foe: null, d: 0, myClosing: o.myClosing ?? 0, foeClosing: o.foeClosing ?? 0, staminaRest: false, chasing: false, holdDist: () => 2.2 };
  return f;
}
/** 겨눔 foes[i] = 자리 · 판 사본 한 장 · ai.d = 겨눈 상대까지 */
function board(F, foes) {
  F.forEach((f, i) => {
    f.foe = foes[i] >= 0 ? F[foes[i]] : null;
    f.aiCtl.foe = f.foe;
    if (f.foe) {
      const p = f.bodies.chest.translation();
      const q = f.foe.bodies.chest.translation();
      f.aiCtl.d = Math.hypot(q.x - p.x, q.z - p.z);
    }
  });
  const M = { fighters: F, t: 0 };
  M.sense = createSense(M);
  for (const f of F) f.teamSense = M.sense;
  recordSense(M);
  return M;
}
const noRandom = (fn) => {
  const r = Math.random;
  Math.random = () => { throw new Error('Math.random'); };
  try { return fn(); } finally { Math.random = r; }
};

test('③ 언제 뛰나: 겨눈 상대가 내 동료를 겨눔 → join · 나를 겨눠 다가옴 → 안 뜀 · 나를 겨눈 채 멀어짐 → chase · 셋 따로 제삼자와 붙음 → 안 뜀', () => {
  // 0 편: 나(0) · 동료(2) — 1 편: 적(1) 은 동료(2)와 붙음 · 나는 7 m 밖
  const F = [fake(0, 0, -7, 0, 0), fake(1, 1, 0, 0, Math.PI), fake(2, 0, 2, 0, Math.PI)];
  board(F, [1, 2, 1]);
  const ai = F[0].aiCtl;
  const [fw, sd] = noRandom(() => aiRunFeet(ai, 0.48, 0.1));
  assert.equal(ai.runWhy, 'join');
  assert.equal(F[0].runReach, 1, '스틱 끝 (사람과 같은 칸)');
  assert.ok(Math.abs(Math.hypot(fw, sd) - 1) < 1e-9 && fw > 0 && Math.abs(sd) <= AI_RUN.lat * fw + 1e-9, '상대 쪽 끝 · 옆 몫 ≤ 앞 몫 × lat');
  assert.deepEqual(ai.stats.run, { join: 1, chase: 0 });
  // 적이 나를 겨눠 다가옴 (판 시작처럼) — 안 뜀
  const G = [fake(0, 0, -7, 0, 0), fake(1, 1, 0, 0, Math.PI, { foeClosing: 0 }), fake(2, 0, 2, 0, Math.PI)];
  board(G, [1, 0, 1]);
  G[0].aiCtl.foeClosing = 1;
  assert.deepEqual(aiRunFeet(G[0].aiCtl, 0.48, 0.1), [0.48, 0.1], '스틱 그대로');
  assert.equal(G[0].runReach, 0);
  // 나를 겨눈 채 멀어짐 — chase
  G[0].aiCtl.foeClosing = -(AI_RUN.flee + 0.1);
  aiRunFeet(G[0].aiCtl, 0.48, 0);
  assert.equal(G[0].aiCtl.runWhy, 'chase');
  // 빈손 상대 — chase
  G[0].aiCtl.foeClosing = 1;
  G[0].aiCtl.chasing = true;
  aiRunFeet(G[0].aiCtl, 0.48, 0);
  assert.equal(G[0].aiCtl.runWhy, 'chase');
  // 셋 따로(편 0 · 1 · 2): 겨눈 상대가 제삼자와 붙음 — 안 뜀 (동료가 아님)
  const H = [fake(0, 0, -7, 0, 0), fake(1, 1, 0, 0, Math.PI), fake(2, 2, 2, 0, Math.PI)];
  board(H, [1, 2, 1]);
  H[0].aiCtl.foeClosing = 1;
  aiRunFeet(H[0].aiCtl, 0.48, 0);
  assert.equal(H[0].aiCtl.runWhy, null, '제삼자와 붙은 적에게는 안 뜀');
  H[0].aiCtl.foeClosing = -(AI_RUN.flee + 0.1);
  aiRunFeet(H[0].aiCtl, 0.48, 0);
  assert.equal(H[0].aiCtl.runWhy, null, '나를 겨누지 않은 채 멀어짐은 쫓기 아님');
});

test('③ 안 뜀: 다른 적이 칼끝 + near 안 (등이 열림) · 가까움(gap 안) · 닿을 때 기력 keep 밑 · 간 보기 꼴 아님 · 쉼 · 넘어짐 · 앞으로 안 감', () => {
  const mk = (o = {}) => {
    const F = [fake(0, 0, -7, 0, 0, o), fake(1, 1, 0, 0, Math.PI), fake(2, 0, 2, 0, Math.PI), fake(3, 1, o.ox ?? -9.5, o.oz ?? 0, 0)];
    board(F, [1, 2, 1, 2]);
    return F[0].aiCtl;
  };
  const why = (ai, fwd = 0.48) => (aiRunFeet(ai, fwd, 0), ai.runWhy);
  assert.equal(why(mk({ ox: -12 })), 'join', '다른 적 멀리 — 뜀');
  assert.equal(why(mk({ ox: -7 - (1.8 + AI_RUN.near - 0.1) })), null, '다른 적이 등 뒤 칼끝 + near 안 — 안 뜀');
  assert.equal(why(mk({ ox: -7, oz: 1.8 + AI_RUN.near - 0.1 })), null, '옆도');
  const near = mk({ ox: -12 });
  near.d = near.holdDist() + AI_RUN.gap - 0.01;
  assert.equal(why(near), null, '간 보는 거리 + gap 안 — 안 뜀');
  const tired = mk({ ox: -12, st: 60 });
  const left = tired.d - tired.holdDist();
  assert.ok(60 - (left / (walkTopOf(tired.me) * RUN.mul)) * runCostRate(tired.me) < AI_RUN.keep);
  assert.equal(why(tired), null, '닿을 때 기력 어림 keep 밑 — 안 뜀');
  const low = mk({ ox: -12, st: AI_RUN.keep });
  assert.equal(why(low), null, '기력 keep — 안 뜀');
  for (const mode of ['attack', 'defend', 'withdraw', 'secret']) assert.equal(why(mk({ ox: -12, mode })), null, `${mode} — 안 뜀`);
  const rest = mk({ ox: -12 });
  rest.staminaRest = true;
  assert.equal(why(rest), null, '기력 쉼');
  const kneel = mk({ ox: -12 });
  kneel.me.state = 'kneel';
  assert.equal(why(kneel), null, '무릎');
  assert.equal(why(mk({ ox: -12 }), 0), null, '스틱이 앞으로 안 감 (간 보기 걸음이 기다림)');
});

test('③ 뛰는 중: 멈추는 길(지금 빠르기에서 RUN.accel 로 줄며 가는 길 + 상대가 다가오는 길) 안이면 스틱을 되돌림 · 공격 꼴이면 runBreak', () => {
  const F = [fake(0, 0, -7, 0, 0), fake(1, 1, 0, 0, Math.PI), fake(2, 0, 2, 0, Math.PI)];
  board(F, [1, 2, 1]);
  const ai = F[0].aiCtl;
  F[0].run = { on: true, runs: 1 };
  ai.myClosing = 4;
  ai.foeClosing = 0.5;
  const t = 4 / RUN.accel;
  const stop = (4 * t) / 2 + 0.5 * t;
  ai.d = ai.holdDist() + stop + 0.05;
  aiRunFeet(ai, 0.48, 0);
  assert.equal(ai.runWhy, 'join', '멈추는 길 밖 — 계속 (gap 안이어도 뛰는 중이면)');
  ai.d = ai.holdDist() + stop - 0.05;
  aiRunFeet(ai, 0.48, 0);
  assert.equal(ai.runWhy, null, '멈추는 길 안 — 되돌림');
  assert.equal(F[0].runReach, 0);
  assert.ok(!F[0].runBreak);
  ai.mode = 'attack';
  aiRunFeet(ai, 0.48, 0);
  assert.equal(F[0].runBreak, true, '공격 꼴 = 사람의 공격 입력 (run.js 가 끊음)');
});
