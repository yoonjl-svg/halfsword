// 새로 생긴 이상한 팔 꼴 고침 (사장님 11/13 '본판에 넣고 새로 생긴 이상한 모양 고쳐' — docs/strike/arm_odd_2026-11-13.md · 확인표 3640 ~ 3644):
//   두손 칼 칼자루 끝 앞 바닥(SKILL.armClear.front)을 사람 손가락이 쥐는 순간 곧장 켜던 것을 frontIn 초로 들임 — 쥐는 순간 손 목표가 한 스텝에 3 ~ 14 cm 앞으로 튀던 것.
//   뒤랑달 우하 빠르게 거꾸로 쥠 · 츠바이핸더 · 티소나 우하 빠르게 손목 범위 밖 · 플랑베르주 왼쪽 빠르게 위팔 돌림 끝이 다시 문턱(스텝 10 %) 밑 · 끝 뻗음 그대로 · 두 손 쥠 그대로 ·
//   AI 몸 · 한손 칼은 바이트 같음 (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_odd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, AI, THREE } from './harness_m.mjs';
import { runDir } from './arm_reach_audit.mjs';

const { SKILL } = CONFIG;

test('기본값 — armClear.frontIn 0.1 s (다른 칸 그대로)', () => {
  const C = SKILL.armClear;
  assert.equal(C.frontIn, 0.1);
  assert.deepEqual({ on: C.on, gap: C.gap, near: C.near, yield: C.yield, ai: C.ai, body: C.body, front: C.front, grip: C.grip, miss: C.miss }, { on: 1, gap: 0.01, near: 0.03, yield: 0.3, ai: 1, body: 1, front: 0.24, grip: 0.13, miss: 'base' });
});

/** 손가락을 쥔 첫 스텝부터 0.15 s 안 스텝 사이 손 목표(몸 틀) 옮김 가장 큰 것 (m) */
function gripJump(weapon, dir, mode) {
  const T = [];
  runDir({ weapon, dir, mode, onRound({ G, P }) {
    const st = G.step.bind(G);
    G.step = () => {
      st();
      const c = P.bodies.chest.translation();
      T.push({ t: G.t, w: P.frontW ?? 0, v: P.handTarget.clone().sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(P.yaw.clone().invert()) });
    };
  } });
  const i0 = T.findIndex((s) => s.w > 0);
  assert.ok(i0 > 0, `${weapon} 앞 바닥을 안 탐`);
  let mx = 0;
  for (let i = i0; i < T.length && T[i].t <= T[i0].t + 0.15; i++) mx = Math.max(mx, T[i].v.distanceTo(T[i - 1].v));
  return mx;
}



/** n 스텝 뒤 두 몸 가슴 · 칼 자리 (바이트 견줌) */
function snapAfter(o, n) {
  const G = newRound({ seed: 3, walls: true, ...o });
  try {
    for (let i = 0; i < n; i++) G.step();
    return [G.player, G.enemy].flatMap((f) => [f.bodies.chest.translation(), f.sword?.translation()].filter(Boolean).flatMap((t) => [t.x, t.y, t.z]));
  } finally {
    G.world.free();
  }
}

