// ① 둥근 칼 읽기 + 칼끝 틈 건너기 — 모든 AI 시험 (11/15 [사장님 11/15 결정] '둥근 칼 읽기 모든 유파에 넣어' · config AI_ARC · ai.js arcHit · gapHold · startAttack ·
//  진단 docs/strike/cn_root_2026-11-15.md · 기록 docs/strike/ai_arc_2026-11-15.md): 기본 켬 · 끄면 셈 · 굴림 없음 · 둥글게 오는 칼은 곧은 줄 눈이 못 봐도 봄 · 곧게 지나가는 칼은 안 봄 ·
//  칼끝 틈 — 긴 칼 앞 내 칼끝 밖 보통 공격만 띠 기울기로 참음 · 헛친 틈 등은 건넘 · 판에서 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/ai_arc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';

const A = CONFIG.AI_ARC;
function withArc(o, fn) {
  const keep = { ...A };
  Object.assign(A, o);
  try {
    return fn();
  } finally {
    Object.assign(A, keep);
  }
}
/** 동방(환도) AI 숙련 p 대 츠바이핸더 — 동방 = E 자리(G.ai) */
function round(p = 5, foe = 'zweihander', seed = 1) {
  const G = newRound({ seed, walls: true, weapon: foe, weapon2: 'hwando', AI2Class: AI, persona: { proficiency: p }, persona2: { proficiency: 5 } }); // persona = E 자리 AI(G.ai)
  return { G, ai: G.ai, free: () => G.world.free() };
}
/** 가슴 (0, 1.2, 0) 앞 1.6 m 의 o 를 축 (0, 1, 0) 으로 도는 칼 — 칼끝 반지름 rT · 타격점 rM · 지금 각 a0(0 = 가슴 쪽) · 각이 w rad/s 로 줄어듦 (늦게 본 모습 s).
 *  곧은 줄(접선)이 가슴에서 |1.6 cos a0 − r| 만큼 비껴 가도록 — rT 1.5 · rM 1.3 · a0 1.25 면 0.99 · 0.80 m (원통 0.55 밖) · 둥글게는 a0 ÷ w 초 뒤 가슴 0.1 ~ 0.3 m */
function swing({ rT = 1.5, rM = 1.3, a0 = 1.25, w = 6 } = {}) {
  const o = [0, 1.2, 1.6];
  const at = (r) => [o[0] + r * Math.sin(a0), o[1], o[2] - r * Math.cos(a0)];
  const vel = (r) => [-w * r * Math.cos(a0), 0, -w * r * Math.sin(a0)];
  const T = at(rT), M = at(rM), vT = vel(rT), vM = vel(rM);
  return { tx: T[0], ty: T[1], tz: T[2], mx: M[0], my: M[1], mz: M[2], tvx: vT[0], tvy: vT[1], tvz: vT[2], mvx: vM[0], mvy: vM[1], mvz: vM[2], hx: 0, hy: 0, hvx: 0, hvy: 0 };
}

test('값 (0.6 s 시간 사다리 · 칸 = 물리 한 스텝 · 0.3 m 걸음 사다리) · 둥근 눈 · 칼끝 틈 셈이 탐', () => {
  assert.ok(Math.abs(A.horizon - CONFIG.realS(0.6)) < 1e-9 && A.gap === 0.3 && !('step' in A) && !('minW' in A), '내다보는 칸 = 물리 한 스텝 (새 수 없음)');
  const run = () => {
    const { G, ai, free } = round();
    while (G.t < 12) G.step();
    const r = { arc: ai.stats.arcSeen ?? 0, gap: ai.stats.arcGap ?? 0 };
    free();
    return r;
  };
  const on = run();
  assert.ok(on.arc > 0 && on.gap > 0, JSON.stringify(on));
});

test('둥근 눈: 둥글게 몸으로 오는 칼은 곧은 줄 눈(0.45 s)이 못 봐도 봄 · 곧게 비껴 가는 칼 · 느린 칼 · 먼 칼은 안 봄', () => {
  const { G, ai, free } = round();
  try {
    const C = { x: 0, y: 1.2, z: 0 }, R = { x: 1, y: 0, z: 0 };
    ai.foeReach = 2.0;
    const s = swing();
    const th = ai.threat(s, C, R, 1.6);
    assert.ok(th && typeof th.line === 'string' && th.thrust === false, JSON.stringify(th));
    // 곧게 비껴 가는 칼 (회전 없음 — 칼끝 · 타격점이 같은 빠르기로 옆으로)
    const lin = { ...s, tvx: 6, tvy: 0, tvz: 0, mvx: 6, mvy: 0, mvz: 0 };
    assert.equal(ai.threat(lin, C, R, 1.6), null, '곧게 지나감');
    // 느린 칼 (칼끝 3.5 m/s 밑)
    assert.equal(ai.threat(swing({ w: 1.5 }), C, R, 1.6), null, '느림');
    // 먼 칼 (상대 칼끝 어림 + 0.9 밖)
    assert.equal(ai.threat(s, C, R, 3.0), null, '멂');
  } finally {
    free();
  }
});

test('칼끝 틈: 상대 칼이 0.3 m 넘게 길고 내 칼끝 밖이면 보통 공격을 띠 기울기만큼 참음 · 헛친 틈 · 받아 친 틈 · 이어 치기는 건넘 · 칼이 비슷하거나 내 칼끝 안이면 안 참음', () => {
  const { ai, free } = round(5);
  try {
    ai.foeReach = ai.M.reach + 0.5;
    ai.d = ai.M.reach + 0.2;
    ai.gapT = -Infinity;
    const t = ai.pickTech(ai.sense.seen(0), 'patience');
    const keepMode = ai.mode;
    assert.equal(ai.startAttack(t, 'patience'), false, '높음 — 참음');
    assert.ok(ai.stats.arcGap >= 1);
    for (const why of ['recover', 'counter', 'riposte', 'stepin', 'finish']) {
      ai.mode = keepMode;
      assert.equal(ai.gapHold() && !['recover', 'counter', 'riposte', 'stepin', 'finish'].includes(why), false);
    }
    ai.mode = 'watch';
    assert.equal(ai.startAttack(t, 'recover'), true, '헛친 틈은 건넘');
    ai.mode = 'watch';
    ai.foeReach = ai.M.reach + 0.2;
    ai.gapT = -Infinity;
    assert.equal(ai.gapHold(), false, '0.3 m 안');
    ai.foeReach = ai.M.reach + 0.5;
    ai.d = ai.M.reach - 0.1;
    ai.gapT = -Infinity;
    assert.equal(ai.gapHold(), false, '내 칼끝 안');
    withArc({ gap: 0 }, () => { ai.d = ai.M.reach + 0.2; ai.gapT = -Infinity; assert.equal(ai.gapHold(), false, 'gap 0'); });
  } finally {
    free();
  }
  // 무 · 낮음 · 가운데: 박자마다 굴림 (기울기 0 · ⅓ · ⅔)
  const share = (p) => {
    const { ai, free: f } = round(p);
    ai.foeReach = ai.M.reach + 0.5;
    ai.d = ai.M.reach + 0.2;
    let yes = 0;
    for (let i = 0; i < 300; i++) { ai.gapT = -Infinity; if (ai.gapHold()) yes++; }
    f();
    return yes / 300;
  };
  assert.equal(share(0), 0);
  const lo = share(1), mid = share(3);
  assert.ok(lo > 0.2 && lo < 0.47 && mid > 0.55 && mid < 0.8, `${lo} ${mid}`);
});

