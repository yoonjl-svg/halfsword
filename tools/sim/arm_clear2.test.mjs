// 두 팔 엇갈림 막기 둘째 (사장님 11/12 22:1x '남은 팔 엇갈림 고치고 ai에도 넣어' — docs/strike/arm_clear2_2026-11-12.md · 확인표 3620 ~ 3629):
//   사람: 대검 오른쪽 · 일본 두손 왼쪽 · 왼위에서 두 팔이 2 cm 넘게 안 뚫음 (11/12 첫 판은 뚫음) · 새 팔꿈치 뒤집힘 · 위팔 돌림 · 쥠 놓침 없음 · 두 손 쥔 채
//   한손 칼은 새 칸(body · front · grip · miss)에 안 걸림 · AI 몸에도 켬(armClear.ai) — AI 끼리 싸움에서 두 팔 뚫음이 줄고 · AI 비기 · 특수 공격 동안은 안 탐
//   (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_clear2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, AI } from './harness_m.mjs';
import { runDir, armReachSample } from './arm_reach_audit.mjs';
import { withArmOld, ARM_CLEAR1 } from './arm_real_pin.mjs';

const { SKILL } = CONFIG;
const old1 = (fn) => withArmOld(fn, ['armClear2']); // 11/12 첫 판 두 팔 엇갈림 막기 (main 30929293)

test('기본값 — armClear ai 1 · body 1 · front 0.24 · grip 0.13 · miss base (on · gap · near · hold · yield 그대로)', () => {
  const C = SKILL.armClear;
  assert.equal(C.on, 1);
  assert.equal(C.ai, 1);
  assert.equal(C.body, 1);
  assert.equal(C.front, 0.24);
  assert.equal(C.grip, 0.13);
  assert.equal(C.miss, 'base');
  assert.equal(C.gap, 0.01);
  assert.equal(C.near, 0.03);
  assert.equal(C.yield, 0.3);
  assert.deepEqual(Object.keys(ARM_CLEAR1).sort(), ['ai', 'body', 'front', 'grip', 'miss']);
});

test('사람 대검 오른쪽 · 일본 두손 왼쪽 (천천히): 첫 판은 두 팔이 뚫음 · 지금은 안 뚫음 · 새 뒤집힘 · 위팔 돌림 · 쥠 놓침 없음 · 손이 목표에 닿음', () => {
  const cells = [['zweihander', 'right'], ['tizona', 'right'], ['durandal', 'right'], ['uchigatana', 'left'], ['kusanagi', 'left'], ['muramasa', 'left']];
  for (const [w, dir] of cells) {
    const now = runDir({ weapon: w, dir, mode: 'slow' });
    const was = old1(() => runDir({ weapon: w, dir, mode: 'slow' }));
    if (w !== 'durandal') assert.ok(was.flags.includes('arms'), `${w} ${dir} 첫 판 ${was.flags} ${was.frac.arms}`); // 뒤랑달 오른쪽은 첫 판 6 % (문턱 밑)
    assert.ok(!now.flags.includes('arms') && now.frac.arms < 0.05, `${w} ${dir} 지금 두 팔 ${now.frac.arms}`);
    for (const k of ['elbowUp', 'shRot', 'grip', 'body', 'sword', 'rev']) assert.ok(!now.flags.includes(k), `${w} ${dir} 새 ${k}`);
    assert.equal(now.frac.grip, 0, `${w} ${dir} 빈손 놓침`);
    // 대검 오른쪽은 더 뻗음(칼자루 끝 앞 바닥) · 일본 왼쪽 첫 판 1.00 은 빈손에 끌려 목표를 18 ~ 21 cm 지나친 꼴 — 지금은 목표에 닿음(오차 줄어듦 · 뻗음 0.9 넘게)
    if (dir === 'right') assert.ok(now.end.reach > was.end.reach + 0.05, `${w} ${dir} 뻗음 ${was.end.reach.toFixed(3)} → ${now.end.reach.toFixed(3)}`);
    else assert.ok(now.end.err < was.end.err && now.end.err < 0.06 && now.end.reach > 0.9, `${w} ${dir} 오차 ${was.end.err.toFixed(3)} → ${now.end.err.toFixed(3)} · 뻗음 ${now.end.reach.toFixed(3)}`);
  }
});

test('사람 일본 두손 왼위 · 무라마사 위 (천천히) — 두 팔 안 뚫음 · 새 한도 닿음 없음', () => {
  for (const [w, dir] of [['muramasa', 'upLeft'], ['uchigatana', 'upLeft'], ['muramasa', 'up']]) {
    const now = runDir({ weapon: w, dir, mode: 'slow' });
    assert.ok(!now.flags.includes('arms'), `${w} ${dir} ${now.flags} ${now.frac.arms}`);
    for (const k of ['elbowUp', 'shRot', 'shPlane', 'grip']) assert.ok(!now.flags.includes(k), `${w} ${dir} 새 ${k}`);
  }
});

test('사람 한손 칼은 새 칸(body · front · grip · miss)에 안 걸림 — 세이버 · 발리사르다 · 환도 끝 자세 바이트 같음', () => {
  const pose = (w, dir) => {
    const r = runDir({ weapon: w, dir, mode: 'slow' });
    return { reach: r.end.reach, hand: r.end.hand, flags: r.flags, frac: r.frac.arms };
  };
  for (const [w, dir] of [['sabre', 'right'], ['balisarda', 'left'], ['hwando', 'upLeft']]) {
    // AI 몫은 첫 판처럼 끄고(서 있는 상대 몸도 같게) 새 칸만 견줌
    const a = withArmOld(() => { SKILL.armClear.ai = 0; return pose(w, dir); }, ['armClear2']);
    const b = (() => { const keep = SKILL.armClear.ai; SKILL.armClear.ai = 0; try { return pose(w, dir); } finally { SKILL.armClear.ai = keep; } })();
    assert.deepEqual(b, a, `${w} ${dir}`);
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

test('AI 몸에도 (armClear.ai — 사장님 11/12 결정): AI 끼리 롱소드 두 팔 뚫음 몫이 끈 판보다 줄어듦 · 뒤집힘 · 쥠 놓침 안 늘어남', () => {
  let on = { n: 0, a: 0, g: 0, u: 0 }, off = { n: 0, a: 0, g: 0, u: 0 };
  for (const seed of [3, 7]) {
    const a = aiArms(seed);
    const b = (() => { const keep = SKILL.armClear.ai; SKILL.armClear.ai = 0; try { return aiArms(seed); } finally { SKILL.armClear.ai = keep; } })();
    on = { n: on.n + a.n, a: on.a + a.arms * a.n, g: on.g + a.grip * a.n, u: on.u + a.up * a.n };
    off = { n: off.n + b.n, a: off.a + b.arms * b.n, g: off.g + b.grip * b.n, u: off.u + b.up * b.n };
  }
  const r = (o, k) => o[k] / o.n;
  assert.ok(r(off, 'a') > 0.05, `끈 판 AI 두 팔 ${r(off, 'a').toFixed(3)}`);
  assert.ok(r(on, 'a') < r(off, 'a') * 0.6, `AI 두 팔 ${r(off, 'a').toFixed(3)} → ${r(on, 'a').toFixed(3)}`);
  assert.ok(r(on, 'g') <= r(off, 'g') + 0.02, `AI 빈손 놓침 ${r(off, 'g').toFixed(3)} → ${r(on, 'g').toFixed(3)}`);
  assert.ok(r(on, 'u') <= r(off, 'u') + 0.02, `AI 뒤집힘 ${r(off, 'u').toFixed(3)} → ${r(on, 'u').toFixed(3)}`);
});

test('AI 비기 · 특수 공격 동작 동안은 안 탐 (사람 비기 · 고유 공격과 같은 규칙) · ai 0 이면 AI 몸은 첫 판 그대로', () => {
  const G = newRound({ seed: 5, weapon: 'longsword', weapon2: 'longsword', walls: true });
  try {
    const E = G.enemy;
    G.ai.update = () => E.move.set(0, 0);
    while (G.t < 2.0) G.step();
    E.aiCtl.secretRun = { stage: 'test' };
    for (let i = 0; i < 30; i++) G.step();
    assert.equal(E.armClrT, 0, '비기 동안 켜짐 없음');
    assert.equal(!!E._clrOn, false);
    E.aiCtl.secretRun = null;
    E.aiCtl.specRun = { name: 'test', motion: null };
    for (let i = 0; i < 30; i++) G.step();
    assert.equal(E.armClrT, 0, '특수 공격 동작 동안 켜짐 없음');
  } finally {
    G.world.free();
  }
  // ai 0: AI 몸의 팔은 첫 판(사람만) 그대로 — 서 있는 AI 롱소드 몸 바이트 같음
  const stand = () => {
    const H = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'longsword', walls: true });
    try {
      while (H.t < 3) H.step();
      const t = H.enemy.bodies.farmS.translation();
      return [t.x, t.y, t.z];
    } finally {
      H.world.free();
    }
  };
  const a = (() => { const keep = SKILL.armClear.ai; SKILL.armClear.ai = 0; try { return stand(); } finally { SKILL.armClear.ai = keep; } })();
  const b = old1(stand);
  assert.deepEqual(a, b);
});
