// 한 손 발도 왼손(칼집 손) 자리 원전대로 · 우치가타나 등 다시 쥐기 부드럽게 시험 (사장님 11/13 결정 "ai 에도 적용하고 우치가타나 부드럽게. 모두 본판 넣어. 욍손자리 원전대로." —
//  기록 docs/strike/iai_saya_2026-11-13.md · 확인표 3700 ~ · 시간 기준 없음 — 자리 · 쥠 · 거리만 봄)
//  ① 기본값: SECRET.iaiSaya 1 · 칼집 손 자리 iaiSayaHip = 왼 허리 옆(골반 틀 — 몸 옆 줄 · 허리띠 높이 · 골반 너비 밖) · iaiRegripAll 1 · 10/14 배 앞 iaiSayaHand 는 전 판 값 그대로
//  ② 사람 발도 (우치가타나 · 모노호시자오 — 허리 대기 · 손가락 쥔 채): 뽑아 냄 · 벰 · 굳음 · 풀기 동안 빈손 목표 = 왼 허리(골반 틀 iaiSayaHip) · 쥠 없음 ·
//     굳음 동안 빈손이 왼 허리 옆에 섬(뒷짐 아님 — 몸 옆 줄 앞뒤 6 cm 안 · 골반 너비 밖) / 끄면(iaiSaya 0) 빈손 목표 = 10/14 배 앞(가슴 틀)
//  ③ AI 발도(웅크린 대기 — req.player 아님) · 다른 일본 칼(무라마사 · 쿠사나기)도 같은 자리
//  ④ 우치가타나 등 다시 쥐기 부드럽게: 돌아올 때 빈손 목표 이웃 스텝 옮김이 작음(보통 두 손 싸움 몫 안) · 다시 쥐는 몫 0 → 1 고르게 · 다시 쥐고 자리 잡음 —
//     끄면(iaiRegripAll 0) 우치가타나는 곧장(0.3 m 넘게 튐) · 모노호시자오는 끄든 말든 부드럽게(11/13 iaiOneHeavy 판)
//  ⑤ 칼 길 그대로: 맞는 곳 · 베는 몫 칼끝 길 · 칼끝 빠르기 · 굳음 칼 각이 왼손 자리와 상관없음(운동학 칼 길)
//  node --test tools/sim/iai_saya.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { mhzShot } from './mhz_draw.mjs';

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
const BODY_PARTS = new Set(['abdomen', 'pelvis', 'chest', 'farmS', 'uarmS']);
const shot = (o = {}) => mhzShot({ weapon: 'uchigatana', foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3, ...o });
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** 첫 뽑기 스텝은 낸 스텝 앞(그 스텝 offHand 가 이미 돈 뒤 발도가 걸림)이라 뺌 */
const phase = (frames, ph) => frames.filter((f) => f.ph === ph).slice(ph === 'draw' ? 1 : 0);
/** 골반 틀 기록([앞, 위, 칼 든 쪽 +])의 칼집 손 자리 — 빈손 쪽은 칼 든 쪽의 반대 */
const hipP = () => [SECRET.iaiSayaHip[0], SECRET.iaiSayaHip[1], -SECRET.iaiSayaHip[2]];
const PELVIS_HALF_W = 0.16; // fighter.js partDefs pelvis 상자 반 너비

test('① 기본값 — 칼집 손 자리 원전(왼 허리) 켬 · 우치가타나 등 다시 쥐기 부드럽게 켬 · 10/14 배 앞은 전 판 값', () => {
  assert.equal(SECRET.iaiSaya, 1);
  assert.equal(SECRET.iaiRegripAll, 1);
  const [x, y, z] = SECRET.iaiSayaHip;
  assert.ok(Math.abs(x) <= 0.05, `몸 옆 줄 (앞뒤 ${x})`);
  assert.ok(y >= 0.03 && y <= 0.12, `허리띠 높이 (골반 가운데 위 ${y})`);
  assert.ok(z > PELVIS_HALF_W && z < 0.3, `왼 허리 바깥 (${z})`);
  assert.equal(SECRET.iaiSayaHand.join(','), '0.24,-0.28,0', '`?iaiSaya=0` 판 = 10/14 배 앞 그대로');
});

test('② 사람 발도 — 뽑아 냄 · 벰 · 굳음 · 풀기 동안 빈손 목표 = 왼 허리 · 굳음 동안 빈손이 왼 허리 옆 / 끄면 10/14 배 앞', () => {
  for (const weapon of ['uchigatana', 'monohoshizao']) {
    for (const start of ['hip', 'held']) {
      const r = shot({ weapon, start });
      assert.ok(r.sum.ok && r.sum.oneHand, `${weapon} ${start} 한 손 발도`);
      for (const ph of ['draw', 'hold', 'fade']) {
        const F = phase(r.frames, ph);
        assert.ok(F.length > 0, ph);
        assert.equal(F.filter((f) => f.grip).length, 0, `${weapon} ${start} ${ph} 동안 빈손이 칼자루를 놓음`);
        assert.ok(F.every((f) => f.offP && dist3(f.offP, hipP()) < 1e-3), `${weapon} ${start} ${ph} 빈손 목표 = 왼 허리 (골반 틀)`);
      }
      // 굳음 뒤 반(잔심 — 머무는 자리) 빈손 (아래팔 끝) — 왼 허리 옆: 목표 4 cm 안 · 몸 옆 줄 앞뒤 6 cm 안(뒷짐 아님) · 골반 너비 밖
      const H = phase(r.frames, 'hold');
      const late = H.slice(Math.floor(H.length / 2));
      assert.ok(late.length > 20, '굳음 길이');
      for (const f of late) {
        assert.ok(dist3(f.ohP, hipP()) < 0.04, `${weapon} ${start} 굳음 빈손 ${JSON.stringify(f.ohP)} ↔ 왼 허리 ${JSON.stringify(hipP())}`);
        assert.ok(Math.abs(f.ohP[0]) < 0.06 && -f.ohP[2] > PELVIS_HALF_W, `${weapon} ${start} 굳음 빈손 몸 옆 ${JSON.stringify(f.ohP)}`);
      }
    }
  }
  const off = withS({ iaiSaya: 0 }, () => shot());
  const sh = SECRET.iaiSayaHand;
  assert.ok(phase(off.frames, 'hold').every((f) => f.offT && dist3(f.offT, [sh[0], sh[1], -sh[2]]) < 1e-3), '끈 판 = 10/14 배 앞 (가슴 틀)');
});

test('③ AI 발도 · 다른 일본 칼도 같은 칼집 손 자리', () => {
  for (const [weapon, start] of [['uchigatana', 'crouch'], ['monohoshizao', 'crouch'], ['muramasa', 'hip'], ['kusanagi', 'held']]) {
    const r = shot({ weapon, start });
    assert.ok(r.sum.ok && r.sum.oneHand, `${weapon} ${start} 한 손 발도`);
    const F = [...phase(r.frames, 'draw'), ...phase(r.frames, 'hold'), ...phase(r.frames, 'fade')];
    assert.ok(F.every((f) => f.offP && dist3(f.offP, hipP()) < 1e-3), `${weapon} ${start} 빈손 목표 = 왼 허리`);
    assert.equal(F.filter((f) => f.grip).length, 0, `${weapon} ${start} 빈손 놓음`);
    const H = phase(r.frames, 'hold');
    const late = H.slice(Math.floor(H.length / 2)); // 굳음 뒤 반 (머무는 자리)
    assert.ok(late.length > 20 && late.every((f) => dist3(f.ohP, hipP()) < 0.06), `${weapon} ${start} 굳음 빈손 왼 허리 곁 ${JSON.stringify(late.at(-1)?.ohP)}`);
  }
});

test('④ 우치가타나 등 다시 쥐기 부드럽게 — 튐 없음 · 몫 고르게 · 다시 쥐고 자리 잡음 / 끄면 우치가타나 곧장', () => {
  for (const [weapon, start] of [['uchigatana', 'hip'], ['uchigatana', 'held'], ['uchigatana', 'crouch'], ['muramasa', 'held'], ['kusanagi', 'hip']]) {
    const r = shot({ weapon, start });
    assert.ok(r.sum.regrip, `${weapon} ${start} 다시 쥐기 켬`);
    assert.ok(r.sum.offJump.d < 0.08, `${weapon} ${start} 빈손 목표 이웃 스텝 옮김 ${JSON.stringify(r.sum.offJump)} (보통 두 손 싸움 몫 안)`);
    const K = r.frames.map((f) => f.rgK).filter((k) => k != null);
    assert.ok(K.length > 2 && K[0] < 0.05 && K.every((k, i) => i === 0 || k >= K[i - 1]), `${weapon} ${start} 몫 ${JSON.stringify(K.slice(0, 4))}`);
    const free = r.frames.filter((f) => f.ph === 'free');
    const last = free.at(-1);
    assert.ok(last.grip && last.gap <= r.sum.pre0 + 0.03 && last.rgK == null, `${weapon} ${start} 다시 쥐고 자리 잡음 (틈 ${last.gap} · 뽑기 전 ${r.sum.pre0})`);
  }
  const snap = withS({ iaiRegripAll: 0 }, () => shot({ start: 'hip' }));
  assert.ok(!snap.sum.regrip && snap.sum.offJump.d > 0.3, `끈 판 우치가타나 곧장 ${JSON.stringify(snap.sum.offJump)}`);
  const mhz = withS({ iaiRegripAll: 0 }, () => shot({ weapon: 'monohoshizao' }));
  assert.ok(mhz.sum.regrip && mhz.sum.offJump.d < 0.08, '모노호시자오는 끄든 말든 부드럽게 (11/13 iaiOneHeavy 판)');
});

test('⑤ 칼 길 그대로 — 맞는 곳 · 베는 몫 칼끝 길 · 빠르기 · 굳음 칼 각이 왼손 자리와 상관없음', () => {
  for (const weapon of ['uchigatana', 'monohoshizao']) {
    const on = shot({ weapon });
    const off = withS({ iaiSaya: 0, iaiRegripAll: 0 }, () => shot({ weapon }));
    assert.ok(on.hit && BODY_PARTS.has(on.hit.part), JSON.stringify(on.hit));
    assert.equal(on.hit.part, off.hit.part, `${weapon} 맞는 곳`);
    assert.ok(Math.abs(on.hit.E - off.hit.E) < 1, `${weapon} 판정 에너지 ${on.hit.E} · ${off.hit.E}`);
    const a = on.sum.tipCut;
    const b = off.sum.tipCut;
    assert.ok(Math.abs(a.len - b.len) < 0.02 && Math.abs(a.devShare - b.devShare) < 0.01, `${weapon} 칼끝 길 ${JSON.stringify(a)} · ${JSON.stringify(b)}`);
    assert.ok(Math.abs(on.sum.tipVmax - off.sum.tipVmax) < 1, `${weapon} 칼끝 빠르기 ${on.sum.tipVmax} · ${off.sum.tipVmax}`);
    assert.ok(Math.abs(on.sum.hold.elev - off.sum.hold.elev) < 2 && Math.abs(on.sum.hold.flex - off.sum.hold.flex) < 2, `${weapon} 굳음 칼 · 팔 ${JSON.stringify(on.sum.hold)} · ${JSON.stringify(off.sum.hold)}`);
  }
});
