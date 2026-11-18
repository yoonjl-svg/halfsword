// 독일 띠 높음 (숙련 5 ~) 계획 시험 (11/19 — [사장님 11/19 결정] '숙련 5면 이미 대가잖아 …' · 기록 docs/strike/de_band3_2026-11-19.md · src/ai_plan_de.js)
//  ① 읽고 박차기 — 칼을 냄(낌새 뒤 첫 휘두름 · 달려듦 — deCommit) · 닿는 칼 · 걸어선 못 빠짐 · 박차면 빠짐일 때만 (deBackRead) ② 뒤 칼 (deNachTick) ③ 비기 기력은 모르트슐라크로 누르는 동안만 (deReserve)
//  띠 낮음 · 가운데(숙련 1 ~ 4)는 옛 판 그대로
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { deBackRead, deReserve, master, deCommit, deCueTick } from '../../src/ai_plan_de.js';

const { AI_PLAN, AI_PROFICIENCY, STAMINA } = CONFIG;

/** 독일 거울 한 판의 두 AI (높은 쪽 숙련 hi = 플레이어 자리 ai2) */
function pair(lo, hi, seed = 7) {
  const G = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, difficulty: AI_PROFICIENCY.levels[lo], difficulty2: AI_PROFICIENCY.levels[hi], persona: { proficiency: lo }, persona2: { proficiency: hi } });
  return G;
}

test('띠 높음만 대가 몫: 숙련 5 · 6 = master · 숙련 1 ~ 4 아님 (띠 기울기 1)', () => {
  for (const [p, want] of [[1, false], [2, false], [3, false], [4, false], [5, true], [6, true]]) {
    const G = pair(1, p);
    assert.equal(!!G.ai2.planDe, true, `숙련 ${p} 독일 플랜`);
    assert.equal(master(G.ai2), want, `숙련 ${p}`);
    if (want) assert.ok('backVoid' in G.ai2.stats.plan.de && 'nach' in G.ai2.stats.plan.de, '재기 칸');
    else assert.ok(!('backVoid' in G.ai2.stats.plan.de), '띠 낮음 · 가운데는 옛 재기 칸 그대로');
    G.world.free();
  }
});

test('읽고 박차기 가름: 안 닿음 far · 걸어도 빠짐 walk · 박차야 빠짐 read · 박차도 못 빠짐 deep (τ ≥ 판정 박자 한 칸)', () => {
  const ai = { foeReach: 1.8, foeClosing: 0 };
  const th = { tc: 0 }; // τ = AI_PLAN.tick
  assert.ok(AI_PLAN.tick > 0);
  assert.equal(deBackRead(ai, th, 2.2), 'far');
  assert.equal(deBackRead(ai, th, 1.83), 'walk');
  assert.equal(deBackRead(ai, th, 1.7), 'read');
  assert.equal(deBackRead(ai, th, 1.2), 'deep');
  // 다가오는 상대: 같은 거리라도 닿는 쪽으로 (지금 거리 − 다가옴 × τ)
  assert.equal(deBackRead({ foeReach: 1.8, foeClosing: 0 }, th, 1.95), 'far');
  assert.equal(deBackRead({ foeReach: 1.8, foeClosing: 1 }, th, 1.95), 'read');
  // 남은 초가 길면 박찬 걸음이 더 감 → 더 깊은 칼도 빠짐
  assert.equal(deBackRead(ai, { tc: 0.45 }, 1.2), 'read');
});

test('칼을 냄 가름: 칼 든 낌새를 본 뒤 그 낌새의 첫 휘두름 · 달려듦만 (자세 옮김 · 앞 휘두름의 뒤는 아님)', () => {
  const s0 = { hx: 0, hy: 0, hvx: 0, hvy: 0, okori: 0, tvx: 0, tvy: 0, tvz: 0 };
  const ai = { deCue: { t: -Infinity, id: -1 }, sense: { t: 1 }, threatId: 4, foeClosing: 0 };
  assert.equal(deCommit(ai, { id: 5 }), false, '낌새 없음');
  deCueTick(ai, { ...s0, hy: 0.3, hvy: 2 }); // 손을 들어 올림
  assert.equal(ai.deCue.id, 4);
  assert.equal(deCommit(ai, { id: 5 }), true, '낌새 뒤 첫 휘두름');
  assert.equal(deCommit(ai, { id: 6 }), false, '낌새 뒤 둘째 휘두름 (앞 칼의 뒤)');
  ai.sense.t = 1 + 2 * AI_PLAN.tick + 0.01;
  assert.equal(deCommit(ai, { id: 5 }), false, '낌새가 오래됨');
  ai.foeClosing = 1;
  assert.equal(deCommit(ai, { id: 9 }), true, '달려듦');
  ai.foeClosing = 0;
  deCueTick(ai, { ...s0, okori: 0.5 }); // 오코리 (끊긴 뒤 다시 — 새 낌새)
  assert.equal(ai.deCue.id, 4);
  ai.threatId = 7;
  ai.sense.t += 0.05;
  deCueTick(ai, { ...s0, okori: 0.5 }); // 이어진 낌새는 번호 그대로
  assert.equal(ai.deCue.id, 4);
});

test('비기 기력 35: 독일 띠 높음은 모르트슐라크로 누르는 동안만 남김 (planRestAt)', () => {
  const G = pair(4, 5);
  const ai = G.ai2;
  assert.ok(ai.secret && ai.press, '숙련 5 독일 = 모르트슐라크 칸(G10)');
  ai.press.go = false;
  assert.equal(deReserve(ai), false);
  assert.ok(ai.planRestAt() < STAMINA.secretCost, '누르지 않는 동안은 35 를 남기지 않음');
  ai.press.go = true;
  assert.equal(deReserve(ai), true);
  assert.ok(ai.planRestAt() >= STAMINA.secretCost, '누르는 동안은 35 를 남김');
  ai.press.go = false;
  G.world.free();
});

test('한 판: 띠 높음 독일은 읽고 박찬 수만 박차고 박찬 칼은 모두 닿는 칼 (판 셈이 맞물림)', () => {
  const G = pair(4, 5, 3);
  while (G.t < 30 && G.player.alive && G.enemy.alive && G.player.state !== 'dead' && G.enemy.state !== 'dead') G.step();
  const st = G.ai2.stats.plan.de;
  const read = st.backSee - st.backFar - st.backWalk - st.backDeep - st.backCue - st.backStam; // 'read' · 칼을 냄 · 기력도 있던 수
  assert.ok(st.backSee > 0 && read >= 0, `가름 ${JSON.stringify(st)}`);
  assert.ok(st.back <= read, '박찬 수 ≤ 읽은 수 (칸 몫 굴림)');
  assert.ok(st.backVoid <= st.back && st.nach <= st.backVoid, '비낌 ≤ 박참 · 뒤 칼 ≤ 비낌');
  G.world.free();
});
