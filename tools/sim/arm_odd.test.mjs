// 새로 생긴 이상한 팔 꼴 고침 (사장님 11/13 '본판에 넣고 새로 생긴 이상한 모양 고쳐' — docs/strike/arm_odd_2026-11-13.md · 확인표 3640 ~ 3644):
//   두손 칼 칼자루 끝 앞 바닥(SKILL.armClear.front)을 사람 손가락이 쥐는 순간 곧장 켜던 것을 frontIn 초로 들임 — 쥐는 순간 손 목표가 한 스텝에 3 ~ 14 cm 앞으로 튀던 것.
//   뒤랑달 우하 빠르게 거꾸로 쥠 · 츠바이핸더 · 티소나 우하 빠르게 손목 범위 밖 · 플랑베르주 왼쪽 빠르게 위팔 돌림 끝이 다시 문턱(스텝 10 %) 밑 · 끝 뻗음 그대로 · 두 손 쥠 그대로 ·
//   AI 몸 · 한손 칼은 바이트 같음 (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_odd.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, AI, THREE } from './harness_m.mjs';
import { runDir } from './arm_reach_audit.mjs';
import { withArmOld } from './arm_real_pin.mjs';

const { SKILL } = CONFIG;
const was2 = (fn) => withArmOld(fn, ['armOdd']); // 11/12 둘째 판 (쥐면 곧장 — frontIn 0)

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

test('쥐는 순간 손 목표가 안 튐 — 대검 · 일본 두손 천천히 끌기 (손가락 몫이 작은 판 · 둘째 판은 한 스텝에 5 cm 넘게)', () => {
  for (const [w, dir, mode] of [['zweihander', 'up', 'slow'], ['uchigatana', 'right', 'slow'], ['durandal', 'downRight', 'slow']]) {
    const now = gripJump(w, dir, mode);
    const was = was2(() => gripJump(w, dir, mode));
    assert.ok(was > 0.05, `${w} ${dir} ${mode} 둘째 판 튐 ${was.toFixed(3)}`);
    assert.ok(now < 0.015, `${w} ${dir} ${mode} 튐 ${was.toFixed(3)} → ${now.toFixed(3)}`);
  }
});

test('고친 칸 — 뒤랑달 우하 거꾸로 쥠 · 츠바이핸더 · 티소나 우하 손목 범위 밖 · 플랑베르주 왼쪽 위팔 돌림 (빠르게): 둘째 판은 걸림 · 지금은 안 걸림 · 뻗음 그대로 · 새 꼴 없음', () => {
  const cells = [['durandal', 'downRight', 'rev'], ['zweihander', 'downRight', 'oor'], ['tizona', 'downRight', 'oor'], ['flamberge', 'left', 'shRot']];
  for (const [w, dir, k] of cells) {
    const now = runDir({ weapon: w, dir, mode: 'fast' });
    const was = was2(() => runDir({ weapon: w, dir, mode: 'fast' }));
    assert.ok(was.flags.includes(k), `${w} ${dir} 둘째 판 ${k} ${was.frac[k]}`);
    assert.ok(!now.flags.includes(k), `${w} ${dir} ${k} ${was.frac[k].toFixed(3)} → ${now.frac[k].toFixed(3)}`);
    for (const x of ['arms', 'elbowUp', 'shPlane', 'shRot', 'rev', 'body', 'sword', 'grip', 'roll']) assert.ok(!now.flags.includes(x), `${w} ${dir} 새 ${x} ${now.frac[x]}`);
    assert.equal(now.frac.grip, 0, `${w} ${dir} 빈손 놓침`);
    assert.ok(now.end.reach > was.end.reach - 0.01, `${w} ${dir} 뻗음 ${was.end.reach.toFixed(3)} → ${now.end.reach.toFixed(3)}`);
  }
});

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

test('AI 몸 · 한손 칼은 안 걸림 — AI 끼리 츠바이핸더 · 우치가타나 · 사람 세이버 한 칸 바이트 같음', () => {
  const ai = { AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: 3 } };
  for (const o of [{ weapon: 'zweihander', weapon2: 'longsword', ...ai }, { weapon: 'uchigatana', weapon2: 'zweihander', ...ai }]) {
    assert.deepEqual(snapAfter(o, 600), was2(() => snapAfter(o, 600)), `${o.weapon} 대 ${o.weapon2}`);
  }
  const pose = () => { const r = runDir({ weapon: 'sabre', dir: 'right', mode: 'fast' }); return { hand: r.end.hand, frac: r.frac }; };
  assert.deepEqual(pose(), was2(pose));
});
