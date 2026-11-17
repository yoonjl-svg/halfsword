// 두 팔 엇갈림 막기 둘째 (사장님 11/12 22:1x '남은 팔 엇갈림 고치고 ai에도 넣어' — docs/strike/arm_clear2_2026-11-12.md · 확인표 3620 ~ 3629):
//   사람: 대검 오른쪽 · 일본 두손 왼쪽 · 왼위에서 두 팔이 2 cm 넘게 안 뚫음 (11/12 첫 판은 뚫음) · 새 팔꿈치 뒤집힘 · 위팔 돌림 · 쥠 놓침 없음 · 두 손 쥔 채
//   한손 칼은 새 칸(손목 지금 몸 틈 · front · grip · 틈 없으면 기본 돌림)에 안 걸림 · AI 몸에도 켬 — AI 끼리 싸움에서 두 팔 뚫음이 줄고 · AI 비기 · 특수 공격 동안은 안 탐
//   (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_clear2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, AI } from './harness_m.mjs';
import { runDir, armReachSample } from './arm_reach_audit.mjs';

const { SKILL } = CONFIG;

test('기본값 — armClear front 0.24 · grip 0.13 (gap · near · yield 그대로)', () => {
  const C = SKILL.armClear;
  assert.equal(C.front, 0.24);
  assert.equal(C.grip, 0.13);
  assert.equal(C.gap, 0.01);
  assert.equal(C.near, 0.03);
  assert.equal(C.yield, 0.3);
});


test('사람 일본 두손 왼위 · 무라마사 위 (천천히) — 두 팔 안 뚫음 · 새 한도 닿음 없음', () => {
  for (const [w, dir] of [['muramasa', 'upLeft'], ['uchigatana', 'upLeft'], ['muramasa', 'up']]) {
    const now = runDir({ weapon: w, dir, mode: 'slow' });
    assert.ok(!now.flags.includes('arms'), `${w} ${dir} ${now.flags} ${now.frac.arms}`);
    for (const k of ['elbowUp', 'shRot', 'shPlane', 'grip']) assert.ok(!now.flags.includes(k), `${w} ${dir} 새 ${k}`);
  }
});


/** AI 끼리 롱소드 (숙련 3) — AI 두 몸의 두 팔 뚫음 스텝 몫 (서 있는 동안 · 4 스텝마다) */
function aiArms(seed, secs = 14) {
  const G = newRound({ seed, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, walls: true, persona: { proficiency: 3 }, persona2: { proficiency: 3 } });
  let n = 0, x = 0, grip = 0, up = 0;
  try {
    for (let i = 0; G.t < secs; i++) {
      G.step();
      if (G.t < 0.5 || i % 4) continue;
      for (const f of [G.player, G.enemy]) {
        if (f.state !== 'stand' || !f.armed) continue;
        const s = armReachSample(f);
        if (!s) continue;
        n++;
        if (s.arms < -0.02) x++;
        // 빈손 놓침 = 빈손이 쥐려는데(offHand want — 빈팔 · 근육이 성하고 한 손 발도가 아님) 못 쥠. 빈팔을 크게 다쳐 놓는 것(armO ≤ 0.3)은 뺌
        if (s.grip === false && f.muscle > 0.3 && f.limbs.armO > 0.3 && !(f.iai?.oneHand || f.iaiOneHold)) grip++;
        if (s.elbowUp > 30) up++;
      }
    }
  } finally {
    G.world.free();
  }
  return { n, arms: x / n, grip: grip / n, up: up / n };
}


