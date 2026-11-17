// 모노호시자오(앞무게 두손 칼) 고노센 발도 한 손 시험 (사장님 11/13 결정 "본판에 넣어. 원전대로. 곧은 칼 길. 한손으로." — 기록 docs/strike/monohoshizao_draw_2026-11-13.md ·
//  확인표 3680 ~ · 시간 기준 없음 — 쥠 · 자리 · 거리만 봄)
//  ① 기본값: SECRET.iaiOneHeavy 1(사람) · iaiOneHeavyAi 1(AI — [사장님 11/13 결정] 'ai 에도 적용하고' · 전 0) · 다시 쥐는 시간 iaiRegrip 은 시간 사다리 값 · 모노호시자오는 틀 'heavy' 두손 칼
//  ② 사람 발도: 뽑아 냄 · 벰 · 굳음 · 풀기 동안 빈손이 칼자루를 놓음(쥠 없음 · 빈손 목표 = 칼집 손 자리 iaiSayaHand) · 맞음 몸통 · 굳음 칼 팔 뻗음 — 끄면 전 판(두 손)
//  ③ 보통 싸움은 두 손: 뽑기 전 두 손 쥠 · 풀기가 끝나면 빈손이 칼자루로 돌아와 다시 쥠(빈손 ↔ 칼자루 끝이 뽑기 전 틈 가까이)
//  ④ 돌아올 때 튐 없음: 풀기 끝 앞뒤 빈손 목표 이웃 스텝 옮김이 작음 — 곧장 쥐는 판(iaiRegrip 0 — 우치가타나 등 지금 꼴)은 0.3 m 넘게 튐
//  ⑤ 다른 칼 · AI 그대로: 우치가타나 발도는 앞무게 스위치와 상관없이 같음(11/13 '우치가타나 부드럽게' 뒤 다시 쥐기는 켬) · AI 발도(웅크린 대기 — req.player 아님)는 AI 스위치를 켜야 한 손
//  (11/13 iai_saya: ① 칼집 손 자리 · ② 빈손 목표 자리 · ⑤ 우치가타나 다시 쥐기 — 사장님 결정으로 바뀐 기본값 줄만 고침)
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
/** 11/13 판으로 묶음 (11/14 iai_saya2 — 사장님 '원전과 다른 셋 이어서 맞춰': 발도 대기 왼손 칼집 입 · 뽑아 내는 동안 鞘引き · 풀기와 겹친 다시 쥐기 · 鞘戻し 점 —
 *  이 시험 ② · ④ 는 그 전 판 장면(뽑기 · 풀기 내내 빈손 목표 = 칼집 손 자리 · 풀기 끝 뒤 곧은 다시 쥐기)을 잰 것이라 기준을 고치지 않고 그때 판으로 돌림 · 새 꼴은 iai_saya2.test) */
const then1113 = (fn) => withS({ iaiSayaReady: 0, iaiRegripFade: 0, iaiSayaModoshi: 0 }, fn);

test('① 기본값 — 사람 한 손 켬 · AI 켬([사장님 11/13 결정] \'ai 에도 적용하고\') · 다시 쥐는 시간은 사다리 값', () => {
  assert.ok(LADDER.includes(SECRET.iaiRegrip), `iaiRegrip ${SECRET.iaiRegrip}`);
  const W = WEAPONS.monohoshizao;
  assert.equal(W.frame, 'heavy', '모노호시자오 = 앞무게 틀');
  assert.equal(W.grip, 'two-hand', '보통 싸움은 두 손 칼 (사장님 11/12)');
  // 11/13 사장님 결정 '욍손자리 원전대로'로 칼집 손 기본 자리가 왼 허리(SECRET.iaiSaya 1 · iaiSayaHip — 골반 틀)로 바뀜 (iai_saya_2026-11-13 — 이 줄만 고침 · 전: 10/14 배 앞 iaiSayaHand 가 기본)
  assert.equal(SECRET.iaiSayaHand.join(','), '0.24,-0.28,0', '`?iaiSaya=0` 판 = 10/14 배 앞 그대로');
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

