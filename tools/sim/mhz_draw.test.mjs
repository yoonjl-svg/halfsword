// 모노호시자오(앞무게 두손 칼) 고노센 발도 한 손 시험 (사장님 11/13 결정 "본판에 넣어. 원전대로. 곧은 칼 길. 한손으로." — 기록 docs/strike/monohoshizao_draw_2026-11-13.md ·
//  확인표 3680 ~ · 시간 기준 없음 — 쥠 · 자리 · 거리만 봄)
//  ① 기본값: SECRET.iaiOneHeavy 1(사람) · iaiOneHeavyAi 1(AI — [사장님 11/13 결정] 'ai 에도 적용하고' · 전 0) · 다시 쥐는 시간 iaiRegrip 은 시간 사다리 값 · 모노호시자오는 틀 'heavy' 두손 칼
//  ② 사람 발도: 뽑아 냄 · 벰 · 굳음 · 풀기 동안 빈손이 칼자루를 놓음(쥠 없음 · 빈손 목표 = 칼집 손 자리 iaiSayaHand) · 맞음 몸통 · 굳음 칼 팔 뻗음 — 끄면 전 판(두 손)
//  ③ 보통 싸움은 두 손: 뽑기 전 두 손 쥠 · 풀기가 끝나면 빈손이 칼자루로 돌아와 다시 쥠(빈손 ↔ 칼자루 끝이 뽑기 전 틈 가까이)
//  ④ 돌아올 때 튐 없음: 풀기 끝 앞뒤 빈손 목표 이웃 스텝 옮김이 작음 — 곧장 쥐는 판(iaiRegrip 0 — 우치가타나 등 지금 꼴)은 0.3 m 넘게 튐
//  ⑤ 다른 칼 · AI 그대로: 우치가타나 발도는 스위치와 상관없이 같음 · AI 발도(웅크린 대기 — req.player 아님)는 AI 스위치를 켜야 한 손
//  node --test tools/sim/mhz_draw.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { mhzShot } from './mhz_draw.mjs';
import { WEAPONS } from '../../src/weapons.js';

const { SECRET } = CONFIG;
const withS = (vals, fn, O = SECRET) => {
  const old = {};
  for (const k of Object.keys(vals)) (old[k] = O[k]), (O[k] = vals[k]);
  try {
    return fn();
  } finally {
    Object.assign(O, old);
  }
};
const TORSO = new Set(['abdomen', 'pelvis', 'chest']);
const LADDER = [0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0];
const shot = (o = {}) => mhzShot({ weapon: 'monohoshizao', foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3, ...o });
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** 첫 뽑기 스텝은 낸 스텝 앞(그 스텝 offHand 가 이미 돈 뒤 발도가 걸림)이라 뺌 */
const after1 = (frames, ph) => frames.filter((f) => f.ph === ph).slice(ph === 'draw' ? 1 : 0);

test('① 기본값 — 사람 한 손 켬 · AI 켬([사장님 11/13 결정] \'ai 에도 적용하고\') · 다시 쥐는 시간은 사다리 값', () => {
  assert.equal(SECRET.iaiOneHeavy, 1);
  assert.equal(SECRET.iaiOneHeavyAi, 1);
  assert.ok(LADDER.includes(SECRET.iaiRegrip), `iaiRegrip ${SECRET.iaiRegrip}`);
  const W = WEAPONS.monohoshizao;
  assert.equal(W.frame, 'heavy', '모노호시자오 = 앞무게 틀');
  assert.equal(W.grip, 'two-hand', '보통 싸움은 두 손 칼 (사장님 11/12)');
  assert.equal(SECRET.iaiSayaHand.join(','), '0.24,-0.28,0', '칼집 손 자리는 사장님 10/14 결정 그대로');
});

test('② 사람 모노호시자오 발도 — 뽑아 냄 · 벰 · 굳음 · 풀기 동안 칼은 한 손 · 빈손은 칼집 손 자리 / 끄면 전 판(두 손)', () => {
  for (const start of ['hip', 'held']) {
    const on = shot({ start });
    const s = on.sum;
    assert.ok(s.ok && s.oneHand && s.regrip, `한 손 발도 (${start})`);
    assert.ok(on.hit && TORSO.has(on.hit.part), JSON.stringify(on.hit));
    assert.equal(s.stand, true);
    for (const ph of ['draw', 'hold', 'fade']) {
      const F = after1(on.frames, ph);
      assert.ok(F.length > 0, ph);
      assert.equal(F.filter((f) => f.grip).length, 0, `${start} ${ph} 동안 빈손이 칼자루를 놓음`);
      // 빈손 목표 = 칼집 손 자리 (가슴 몸체 틀 [앞, 위, 칼 든 쪽] — 빈손 쪽 바깥 0)
      const sh = SECRET.iaiSayaHand;
      assert.ok(F.every((f) => f.offT && dist3(f.offT, [sh[0], sh[1], -sh[2]]) < 1e-3), `${start} ${ph} 빈손 목표 = 칼집 손 자리`);
    }
    // 굳음 동안 빈손은 배 앞 (칼자루 끝과 멀리)
    assert.ok(after1(on.frames, 'hold').every((f) => f.gap > 0.3), `${start} 굳음 동안 빈손 ↔ 칼자루 끝 떨어짐`);
    assert.ok(s.hold.flex < 35 && s.hold.ext > 0.93, `굳음 0.3 s 칼 팔 뻗음 ${s.hold.flex}° · ${s.hold.ext}`);
  }
  const off = withS({ iaiOneHeavy: 0 }, () => shot());
  assert.ok(off.sum.ok && !off.sum.oneHand, '끈 판 = 두 손 발도');
  assert.ok(after1(off.frames, 'hold').every((f) => f.grip), '끈 판은 굳음 동안 두 손 쥠');
  assert.equal(off.hit.part, shot().hit.part, '맞는 곳 그대로 (운동학 칼 길 · 판정 에너지 그대로)');
});

test('③ 보통 싸움은 두 손 — 뽑기 전 두 손 쥠 · 풀기가 끝나면 빈손이 칼자루로 돌아와 다시 쥠', () => {
  for (const start of ['hip', 'held']) {
    const on = shot({ start });
    assert.equal(on.sum.preGrip, true, `${start} 뽑기 전 두 손`);
    const free = on.frames.filter((f) => f.ph === 'free');
    assert.ok(free.some((f) => f.grip), `${start} 다시 쥠`);
    // 다시 쥔 뒤 빈손이 칼자루 끝에 자리 잡음 (뽑기 전 틈 + 3 cm 안) · 다시 쥐기 몫이 끝남
    const last = free.at(-1);
    assert.ok(last.grip && last.gap <= on.sum.pre0 + 0.03, `${start} 틈 ${last.gap} (뽑기 전 ${on.sum.pre0})`);
    assert.equal(last.rgK, null, '다시 쥐기 몫 끝 (보통 두 손 쥠)');
  }
});

test('④ 돌아올 때 빈손 목표가 튀지 않음 — 곧장 쥐는 판(iaiRegrip 0)은 튐', () => {
  const on = shot({ start: 'hip' });
  assert.ok(on.sum.offJump.d < 0.03, `빈손 목표 이웃 스텝 옮김 ${JSON.stringify(on.sum.offJump)}`);
  // 다시 쥐는 몫이 0 → 1 로 고르게 (첫 스텝 0 가까이 · 줄지 않음)
  const K = on.frames.map((f) => f.rgK).filter((k) => k != null);
  assert.ok(K.length > 2 && K[0] < 0.05 && K.every((k, i) => i === 0 || k >= K[i - 1]), JSON.stringify(K.slice(0, 4)));
  const snap = withS({ iaiRegrip: 0 }, () => shot({ start: 'hip' }));
  assert.ok(snap.sum.offJump.d > 0.3, `곧장 쥐는 판 ${JSON.stringify(snap.sum.offJump)}`);
});

test('⑤ 다른 칼 · AI 그대로 — 우치가타나 발도는 스위치와 상관없음 · AI 발도는 AI 스위치를 켜야 한 손', () => {
  const strip = (r) => JSON.stringify({ ...r, frames: r.frames.map((f) => ({ ...f, rgK: null })) });
  const u1 = mhzShot({ weapon: 'uchigatana' });
  const u0 = withS({ iaiOneHeavy: 0, iaiRegrip: 0 }, () => mhzShot({ weapon: 'uchigatana' }));
  assert.equal(strip(u1), strip(u0), '우치가타나 사람 발도 바이트 같음');
  assert.ok(u1.sum.oneHand && !u1.sum.regrip, '우치가타나는 전부터 한 손 · 다시 쥐기 그대로(곧장)');
  const a0 = withS({ iaiOneHeavyAi: 0 }, () => mhzShot({ start: 'crouch' }));
  const a0b = withS({ iaiOneHeavy: 0, iaiOneHeavyAi: 0 }, () => mhzShot({ start: 'crouch' }));
  assert.equal(JSON.stringify(a0), JSON.stringify(a0b), 'AI 발도는 사람 스위치와 상관없음');
  assert.ok(!a0.sum.oneHand && after1(a0.frames, 'hold').every((f) => f.grip), 'AI 스위치 끔 = 두 손 발도 (전 판)');
  const a1 = mhzShot({ start: 'crouch' }); // 기본 = AI 켬 (11/13 결정)
  assert.ok(a1.sum.oneHand && a1.sum.regrip, 'AI 스위치 켬 = 한 손 발도');
  assert.equal(after1(a1.frames, 'hold').filter((f) => f.grip).length, 0, 'AI 스위치 켬 — 굳음 동안 빈손 놓음');
  assert.ok(a1.frames.filter((f) => f.ph === 'free').some((f) => f.grip), 'AI 스위치 켬 — 다시 쥠');
});
