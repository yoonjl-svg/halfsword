// 독일 띠 높음 (숙련 5 ~) 계획 시험 (11/19 — [사장님 11/19 결정] '숙련 5면 이미 대가잖아 …' · 기록 docs/strike/de_band3_2026-11-19.md · src/ai_plan_de.js)
//  ① 읽고 박차기 — 칼을 냄(낌새 뒤 첫 휘두름 · 달려듦 — deCommit) · 닿는 칼 · 걸어선 못 빠짐 · 박차면 빠짐일 때만 (deBackRead) ② 뒤 칼 (deNachTick) ③ 비기 기력은 모르트슐라크로 누르는 동안만 (deReserve)
//  11/19 §8 (기록 docs/strike/burst_whiff_2026-11-19.md): 출발 읽기(deLeaveTick — 감은 꼴을 읽고 서서 기다리다 칠 거리에 들면 박참) · 뒤 칼은 걸음을 뗀 뒤 · 오코리 없음 · 비낀 칼 꼬리는 다시 안 막음(deNachKeep)
//  띠 낮음 · 가운데(숙련 1 ~ 4)는 옛 판 그대로
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { deBackRead, deReserve, master, deCommit, deCueTick, deLeaveTick, deNachTick, deNachKeep } from '../../src/ai_plan_de.js';

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
  assert.ok(st.back - st.leave <= read, '위협에 박찬 수 ≤ 읽은 수 (칸 몫 굴림) · 출발 읽기로 박찬 수(leave)는 따로');
  assert.ok(st.leave <= st.leaveRead && st.leaveRead <= st.leaveSee, '출발 읽기: 박참 ≤ 읽음 ≤ 본 꼴');
  assert.ok(st.backVoid <= st.back && st.nach <= st.backVoid, '비낌 ≤ 박참 · 뒤 칼 ≤ 비낌');
  G.world.free();
});

test('출발 읽기 · 뒤 칼 (11/19 §8): 한 박자 안 칠 거리에서 감은 꼴을 읽으면 서서 기다림 · 칠 거리에 들면 박참 · 걸음을 뗀 뒤에야 비낌 · 비낀 칼 꼬리는 다시 안 막음', () => {
  const G = pair(4, 5);
  const ai = G.ai2;
  const me = ai.me;
  const st = ai.stats.plan.de;
  const s0 = { hx: 0, hy: 0, hvx: 0, hvy: 0, okori: 0, tvx: 0, tvy: 0, tvz: 0, mvx: 0, mvy: 0, mvz: 0, state: 'stand' };
  ai.planC = { ...(ai.planC ?? {}), back: 1 };
  me.stamina.value = 100;
  ai.staminaRest = false;
  ai.foeClosing = 0;
  ai.foeReach = 1.8; // 위 가름 시험과 같은 칼끝 어림 (1.7 = 'read')
  me.fightT = CONFIG.ARENA.startHold + 0.1; // 판 시작 정지(feetHeld)가 지난 몸
  // 꼴 없음 → 서지 않음
  assert.equal(deLeaveTick(ai, s0, 1.7, null), false);
  assert.equal(ai.deLeave.set, false);
  // 감은 꼴(낌새)이어도 한 박자 안에 칠 거리 밖이면 아직 읽지 않음
  ai.deCue.t = ai.sense.t;
  assert.equal(deLeaveTick(ai, s0, 2.6, null), false);
  assert.equal(st.leaveSee, 0);
  assert.equal(ai.deLeave.set, false);
  // 칠 거리 가까이 · 걸어도 빠지는 거리 → 읽고 서서 기다림 (박차지 않음)
  assert.equal(deLeaveTick(ai, s0, 1.83, null), false);
  assert.equal(st.leaveSee, 1);
  assert.equal(st.leaveRead, 1, '띠 높음 읽기 몫 OKORI.read × planK = 1');
  assert.equal(ai.deLeave.set, true, '서서 기다림');
  // 쉬는 중이면 박차지 않음 (박찬 뒤 뒤 칼을 못 냄)
  ai.staminaRest = true;
  assert.equal(deLeaveTick(ai, s0, 1.7, null), false);
  ai.staminaRest = false;
  // 칼이 떠나면 닿는데 걸어선 못 빠지고 박차면 빠지는 거리 → 박참 · 파고들기 앞 끝은 거둠 · 뒤 칼 기다림
  ai.deDig.t = 0.3;
  assert.equal(deLeaveTick(ai, s0, 1.7, null), true);
  assert.equal(st.leave, 1);
  assert.equal(ai.deDig.t, 0);
  assert.ok(me.gait.burst?.fore === -1, '뒤 박차기를 걺');
  const N = ai.deNach;
  assert.ok(N && !N.lift && !N.voided);
  assert.equal(deLeaveTick(ai, s0, 1.7, null), false, '꼴 하나에 한 번');
  // 걸음을 떼기 전엔 비낌을 보지 않음 (어림 초가 지나도)
  ai.sense.t += 1;
  assert.equal(deNachTick(ai, s0, 1.7, null), false);
  assert.equal(N.voided, false);
  // 걸음을 뗌 → 칼을 봄 → 칼이 지나감 → 비낌 · 뒤 칼 (오코리 없음)
  me.bwBurstAt = (me.fightT ?? 0) + 0.01;
  assert.equal(deNachTick(ai, s0, 1.9, { id: 9, tc: 0.1 }), false);
  assert.ok(N.lift && N.seen && N.thId === 9);
  let opt = null;
  const sa = ai.startAttack.bind(ai);
  ai.startAttack = (t, why, o) => ((opt = o), sa(t, why, o));
  assert.equal(deNachTick(ai, s0, 1.9, null), true);
  assert.ok(N.voided && N.fired && opt?.nach === true, '뒤 칼 = opt.nach');
  assert.equal(ai.okori, null, '뒤 칼은 오코리 없음');
  // 비낀 칼의 꼬리 (같은 번호 · 한 번 꺾인 번호 · 판정 박자 두 칸 안)는 다시 막지 않음 — 새 휘두름 · 오래된 꼬리는 막음
  assert.equal(deNachKeep(ai, { id: 9 }), true);
  assert.equal(deNachKeep(ai, { id: 10 }), true);
  assert.equal(deNachKeep(ai, { id: 11 }), false);
  ai.sense.t += 2 * AI_PLAN.tick + 0.01;
  assert.equal(deNachKeep(ai, { id: 9 }), false);
  G.world.free();
});

test('뒤 칼: 걸음 장치가 박차기를 버리면 뒤 칼도 없음', () => {
  const G = pair(4, 5);
  const ai = G.ai2;
  const s0 = { hx: 0, hy: 0, hvx: 0, hvy: 0, okori: 0, tvx: 0, tvy: 0, tvz: 0, mvx: 0, mvy: 0, mvz: 0, state: 'stand' };
  ai.deNach = { t0: ai.sense.t, tau: AI_PLAN.tick, until: ai.sense.t + 2, w0: 0, f0: ai.me.fightT ?? 0, lift: false, seen: false, thId: null, vT: 0, voided: false, fired: false, seq: -1, fw0: 0, dig: false };
  ai.me.gait.burst = null;
  ai.me.bwBurstAt = null;
  assert.equal(deNachTick(ai, s0, 1.9, null), false);
  assert.equal(ai.deNach, null);
  G.world.free();
});
