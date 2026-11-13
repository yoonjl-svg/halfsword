// 사람 고노센 발도 · 제비 베기 원전 꼴 시험 (사장님 11/13 '플레이어 고노센 자세가 좀 어정쩡히 이상해졌어. 실제 발도슬이나 원전이 재현되도록 검토해. 동작과 칼의 길 모두. 제비베기도 좀 휘던데.'
//  — 기록 docs/strike/iai_real_2026-11-13.md · 확인표 3660 ~ · 시간 기준 없음)
//  ① 기본값: SECRET.iaiReal 1 · 원전 꼴 길 iaiPathReal (뽑는 자리 = 전 B · 배를 지나는 자리 = 배 길 M) · UNIQUE_ASSIST.tsuTip 1
//  ② 사람 발도(서 있는 롱소드 과녁 · 허리 대기에서 — 게임 길 skill.secret): 맞음 몸통 · 끝 오른 주먹이 오른 어깨 위 · 오른쪽 · 굳음 0.3 s 팔꿈치 35° 안 · 숙임 12° 안 · 옆으로 안 밀림 ·
//     허리 대기 몸 비틂 없음 — 끄면(`?iaiReal=0`) 전 판(배 길 끝 가슴 높이 · 굳음 팔꿈치 50° 넘게 · 숙임 25° 넘게 · 옆 0.2 m 넘게)
//  ③ AI 발도(웅크린 대기에서 — req.player 아님)는 켜든 끄든 같음
//  ④ 제비 베기 되돌림 칼(tsubame_trace — 가만히 선 상대 · 손가락 그대로): 베는 토막 칼끝 · 잔상 곧음(휨 몫 0.05 아래) · 날 앞장 · 손목 범위 안 — 끄면 전 판(0.07 안팎) ·
//     낮은 시작(손가락 −0.7 — 꺾은 손이 배 아래)은 전 판 그대로(사장님 11/08 날 앞장 판)
//  node --test tools/sim/iai_real.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { gnsShot } from './iai_real.mjs';
import { standShot } from './gns_belly.mjs';
import { traceRun, bendCut, bendTrail } from './tsubame_trace.mjs';
import { HUMAN } from '../../src/fighter.js';

const { SECRET, UNIQUE_ASSIST: UA } = CONFIG;
const withS = (vals, fn, O = SECRET) => {
  const old = {};
  for (const k of Object.keys(vals)) (old[k] = O[k]), (O[k] = vals[k]);
  try {
    return fn();
  } finally {
    Object.assign(O, old);
  }
};

test('① 기본값 — 원전 꼴 켬 · 뽑는 자리 · 배를 지나는 자리는 전 길 그대로 · 제비 베기 칼끝 곧은 줄 켬', () => {
  assert.equal(SECRET.iaiReal, 1);
  assert.equal(UA.tsuTip, 1);
  const R = SECRET.iaiPathReal;
  assert.deepEqual(R.B, SECRET.iaiPathRise.B, '뽑는 자리 (왼 허리) 그대로');
  assert.deepEqual([R.M.hand, R.M.yaw, R.M.el], [SECRET.iaiPathBelly.M.hand, SECRET.iaiPathBelly.M.yaw, SECRET.iaiPathBelly.M.el], '배를 지나는 자리 = 배 길 M (사장님 11/06)');
  assert.ok(R.N.at > 0 && R.N.at < R.M.at && R.M.at < 1, '뽑아 냄 → 배 → 끝 차례');
  assert.equal(R.N.yaw, R.B.yaw, '뽑아 내는 동안 칼날은 칼집 줄 (옆 각 그대로)');
  assert.ok(R.E.hand[1] > SECRET.iaiPathBelly.E.hand[1] && R.E.el > SECRET.iaiPathBelly.E.el, '끝이 어깨 위로 (7 시 → 1 시)');
  assert.ok(R.E.body.pitch + R.draw.pitch < SECRET.iaiPath.E.body.pitch + SECRET.stance.iai.draw.pitch, '숙임 합이 줄어듦');
  assert.deepEqual(R.ready, { pelvisYaw: 0, chestYaw: 0 }, '허리 대기 몸 비틂 없음 (正対)');
  assert.equal(SECRET.iaiSayaHand.join(','), '0.24,-0.28,0', '빈손 자리는 사장님 10/14 결정 그대로');
});

const shot = (o = {}) => gnsShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3, ...o });
const TORSO = new Set(['abdomen', 'pelvis', 'chest']);

test('② 사람 발도 — 원전 꼴: 맞음 몸통 · 끝 주먹 어깨 위 오른쪽 · 굳음 팔 뻗음 · 숙임 작음 · 옆 밀림 없음 / 끄면 전 판', () => {
  const on = shot();
  const off = withS({ iaiReal: 0 }, () => shot());
  for (const r of [on, off]) {
    assert.ok(r.sum.armed && r.sum.ok, '준비 · 비기 냄');
    assert.ok(r.hit && TORSO.has(r.hit.part), JSON.stringify(r.hit));
    assert.equal(r.sum.stand, true, '끝까지 서 있음');
  }
  const s = on.sum;
  const end = on.frames.filter((f) => f.ph === 'draw').at(-1);
  assert.ok(end.wr[1] > end.sh[1] + 0.05 && end.wr[2] > end.sh[2], `끝 오른 주먹이 오른 어깨 위 · 오른쪽 ${JSON.stringify([end.wr, end.sh])}`);
  assert.ok(end.tip[1] > end.wr[1] + 0.3, '칼끝은 손 위 (1 시 쪽)');
  assert.ok(s.hold.flex < 35 && s.hold.ext > 0.93, `굳음 0.3 s 팔 뻗음 ${s.hold.flex}° · ${s.hold.ext}`);
  assert.ok(s.pitchMax < 12, `숙임 ${s.pitchMax}°`);
  const hold = on.frames.filter((f) => f.ph === 'hold');
  assert.ok(Math.max(...hold.map((f) => Math.abs(f.pel[2]))) < 0.1, '굳음 동안 골반이 옆으로 안 밀림');
  assert.ok(Math.abs(on.pre.chestYaw) < 8, `허리 대기 가슴 비틂 ${on.pre.chestYaw}°`);
  // 끈 판 = 11/13 전 판 (배 길 · 몸 틀 한 점 굳음 · 숙인 몸 · 비튼 허리 대기)
  const e0 = off.frames.filter((f) => f.ph === 'draw').at(-1);
  assert.ok(e0.wr[1] < end.wr[1] - 0.2, '끈 판 끝 손은 가슴 높이');
  assert.ok(off.sum.hold.flex > 50 && off.sum.pitchMax > 25, `끈 판 굳음 팔꿈치 ${off.sum.hold.flex}° · 숙임 ${off.sum.pitchMax}°`);
  assert.ok(Math.max(...off.frames.filter((f) => f.ph === 'hold').map((f) => Math.abs(f.pel[2]))) > 0.2, '끈 판은 굳음 동안 옆으로 밀림');
  assert.ok(off.pre.chestYaw > 15, '끈 판 허리 대기는 비틂');
});

test('② 칼집을 떠난 뒤부터 맞음 · 잔상 (뽑아 내는 동안은 칼집 안)', () => {
  const on = shot();
  const draw = on.frames.filter((f) => f.ph === 'draw');
  const firstCut = draw.findIndex((f) => f.cut);
  assert.ok(firstCut > 0, '처음 몇 스텝은 베는 몫이 아님');
  // 뽑아 내는 동안 손은 몸 가운데 앞으로 (손목 앞 거리가 늘어남)
  assert.ok(draw[firstCut].wr[0] > draw[0].wr[0] + 0.1, `손 앞으로 ${draw[0].wr[0]} → ${draw[firstCut].wr[0]}`);
});

test('③ AI 발도(웅크린 대기에서 — 사람 아님)는 켜든 끄든 같음', () => {
  const strip = (r) => JSON.stringify({ ...r, frames: undefined });
  const on = standShot({ foeW: 'longsword', guard: 'langort', start: 'crouch', gapAdd: 0.3 });
  const off = withS({ iaiReal: 0 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'crouch', gapAdd: 0.3 }));
  assert.equal(strip(on), strip(off));
});

test('④ 제비 베기 되돌림 칼 — 칼끝 곧은 줄: 베는 토막 · 잔상 곧음 · 날 앞장 · 손목 범위 안 / 끄면 전 판 / 낮은 시작은 전 판 그대로', () => {
  const k = CONFIG.STRIKE.edgeAlign;
  for (const [gap, seed] of [[1.15, 701], [1.15, 702]]) {
    const tr = traceRun('line', seed, gap);
    assert.ok(tr.fired);
    const b = bendCut(tr);
    const t = bendTrail(tr);
    assert.ok(b.devShare < 0.05 && b.kinkDeg < 15, `칼끝 ${JSON.stringify(b)}`);
    assert.ok(t.devShare < 0.05 && t.kinkDeg < 15, `잔상 ${JSON.stringify(t)}`);
    const W = tr.wr.filter((w) => w && w[1]);
    assert.ok(W.every((w) => w[3] <= 1), '손목 범위 안');
    assert.ok(W.every((w) => w[2] <= HUMAN.forearmRoll + 1), '굴림 한도 안');
    assert.ok(W.filter((w) => w[5] > k).length >= 0.8 * W.length, '날 앞장');
    assert.ok(tr.hits[0] && TORSO.has(tr.hits[0].part) && tr.hits[0].edge > k, JSON.stringify(tr.hits));
    const old = withS({ tsuTip: 0 }, () => traceRun('line', seed, gap), UA);
    assert.ok(bendCut(old).devShare > 0.06, `끈 판 휨 ${JSON.stringify(bendCut(old))}`);
  }
  const lowOn = traceRun('line', 701, 1.15, { low: -0.7 });
  const lowOff = withS({ tsuTip: 0 }, () => traceRun('line', 701, 1.15, { low: -0.7 }), UA);
  assert.deepEqual(lowOn.tip, lowOff.tip, '낮은 시작(꺾은 손이 배 아래)은 전 판 그대로');
});
