// 사람 제비 베기 세 해법 시험 (사장님 10/25 21:1x '해법 1~3 좋아' — docs/strike/tsubame_snap_2026-10-25.md · config UNIQUE_ASSIST.tsuRuler · tsuSnap · tsuAim):
//   ① 끝 힘 잣대 = 꺾은 자리부터(올려 긋는 길) · ② 꺾는 순간 올려 긋는 길을 고노센 칼끝 빠르기 × 0.6 으로 0.2 s 까지 끌고 감(운동학 — 손가락 긋기와 같은 공격 · 붙잡기 없이 0.2 s 에 손가락으로) ·
//   ③ 올려 긋는 길 끝을 아래팔 · 겨드랑이 · 가슴 높이로 + 손 돌리기(손목 사람 범위). AI 길(schools.js) · 진 · 츠바메가에시(모노호시자오 kin)는 그대로. 셋 다 끄면 10/25 전 판.
//   ③ 몸통 띠(사장님 10/25 23:1x — UNIQUE_ASSIST.tsuBand): 올려 긋는 길이 처음 닿을 곳을 미리 끌고 가 보아 몸통 띠(골반 ~ 목 아래 가슴) 밖이면 길 높이를 가장 적게 옮김 · 운동학 칼 굴림 묶음.
//    끄면(`tsuBand` 0) 10/25 21:1x 판(가슴 높이 끝 점)
//   ③ 곧은 길(사장님 10/31 16:xx '제비 베기는 곧은 길로 바꿔' — UNIQUE_ASSIST.tsuHook 0 · docs/strike/tsubame_straight_2026-10-31.md): 꺾은 자리에서 왼 위로 곧게 한 번(TSU_AIM.line) ·
//    `tsuHook` 1 = 10/25 갈고리 길(TSU_AIM.band — 아래 시험이 그 판도 지킴)
//   ③ 낮은 시작(사장님 11/08 '낮은 데서 시작해도 날이 앞장서도록 고쳐' — UNIQUE_ASSIST.tsuArm · docs/strike/tsubame_low_2026-11-08.md): 꺾은 자리가 낮아 손목 밧줄 끝에서도 날이 문턱 밖이면
//    끌고 가는 동안 팔꿈치를 돌려(사람 팔 범위 안) 날 앞장 — 맨 아래 시험(감도 1 · 손가락 −0.7)
//  작게 · 빠르게(사장님): 씨앗 하나 · 14 s 판 셋 · 칼끝 길 판 넷.  node --test tools/sim/tsubame_snap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { tsubameRun, tsubameSummary } from './schielhau_strike.mjs';
import { TRADITIONS, JAPANESE_GAIT } from '../../src/schools.js';
import { G } from '../../src/ai_techniques.js';
import { PLAYER_UNIQUE, uniqueDef, PlayerUniqueAssist, TSU_AIM } from '../../src/unique_assist.js';
import { HUMAN } from '../../src/fighter.js';
import { traceRun, bend, bendCut, bendTrail } from './tsubame_trace.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const TSU = PLAYER_UNIQUE.japanese.find((e) => e.name === 'tsubameGaeshi');
const withUA = (o, fn) => {
  const old = Object.fromEntries(Object.keys(o).map((k) => [k, UA[k]]));
  Object.assign(UA, o);
  try {
    return fn();
  } finally {
    Object.assign(UA, old);
  }
};
const OFF = { tsuRuler: 0, tsuSnap: 0, tsuAim: 0 };

test('기본값 — 세 해법 켬 · 0.6 · 0.2 s (사장님 10/25 결정) · AI 길 그대로', () => {
  assert.equal(UA.tsuRuler, 1);
  assert.equal(UA.tsuSnap, 1);
  assert.equal(UA.tsuAim, 1);
  assert.equal(UA.tsuBand, 1);
  assert.equal(UA.tsuHook, 0, '곧은 길 (사장님 10/31 16:xx)');
  assert.deepEqual(TSU_AIM.line, { path: [[-0.3, 0.25]], plan: [[0, 0, 0], [0, 0, 0]], shift: 'slide', pathHint: true, arcCut: true });
  assert.deepEqual(TSU_AIM.band.path, [[0.2, -0.2], [0, 0.1]], '갈고리 길은 `?tsuHook=1` 로 그대로');
  assert.equal(UA.specialShare.tsubameGaeshi, 0.6); // 10/29 02:0x 특수 공격 칼끝 = 고노센 × n 한 표 (제비 베기는 전과 같은 0.6)
  assert.equal(UA.tsuSnapTime, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
  const u = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
  assert.deepEqual([u.from, ...u.path], [G.tag, [0.0, 0.14], G.alber, [0.06, -0.15], G.ochsR]); // AI 가 읽는 길은 그대로
});

test('③ 사람 잣대 길: 꺾는 자리까지 그대로 · 그 뒤 곧은 길(line) — tsuHook 1 이면 갈고리 몸통 띠 길(band) · tsuBand 0 이면 21:1x 길 · tsuAim 0 이면 전 길 · 덧칸 없음', () => {
  const ln = uniqueDef('japanese', TSU);
  assert.deepEqual(ln.pts.slice(0, 3), [G.tag, [0.0, 0.14], G.alber]);
  assert.deepEqual(ln.pts.slice(3), TSU_AIM.line.path, '꺾은 자리 다음은 점 하나 — 꺾은 자리가 어디든 곧은 줄');
  assert.equal(ln.plan.length, ln.pts.length);
  assert.deepEqual(ln.plan, ln.pts.map(() => [0, 0, 0]), '손가락 몫 덧칸 0');
  assert.deepEqual(ln.snapPlan.slice(2), TSU_AIM.line.plan, '끌고 가는 칼 덧칸 0');
  assert.equal(ln.band, true, '몸통 띠 · 굴림 묶음 그대로');
  assert.deepEqual(ln.snapOpt, { shift: 'slide', pathHint: true, arcCut: true });
  const on = withUA({ tsuHook: 1 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(on.pts.slice(0, 3), [G.tag, [0.0, 0.14], G.alber]);
  assert.deepEqual(on.pts.slice(3), TSU_AIM.band.path);
  assert.equal(on.plan.length, on.pts.length);
  assert.deepEqual(on.plan.slice(2), TSU_AIM.plan, '손가락 몫 덧칸은 21:1x 그대로');
  assert.deepEqual(on.snapPlan.slice(2), TSU_AIM.band.plan, '끌고 가는 칼 덧칸');
  assert.equal(on.band, true);
  assert.equal(on.snapOpt, undefined, '갈고리 판은 10/25 그대로 (띠 옮김 꼴 · 날 쪽 셈 · 잔상)');
  const old = withUA({ tsuBand: 0 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(old.pts.slice(3), TSU_AIM.path);
  assert.deepEqual(old.plan.slice(2), TSU_AIM.plan);
  assert.ok(!old.band);
  const off = withUA({ tsuAim: 0 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(off.pts.slice(3), [[0.06, -0.15], G.ochsR]);
  assert.equal(off.plan, undefined);
  assert.ok(!off.band);
});

/** 제비 베기 강화를 손으로 연다 (앞 칼 빗나감 뒤 위로 — 조건은 detect 가 보지만 여기선 start 만) → 걸린 끌고 감 요청 */
function fire(weapon = 'uchigatana') {
  const g = newRound({ walls: true, seed: 1, weapon, weapon2: 'longsword' });
  const P = g.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['tsubameGaeshi']) });
  const e = uq.list.find((x) => x.name === 'tsubameGaeshi');
  P.handOffset.set(0, -0.5);
  uq.start(e, { tech: null, kind: 'cut', pad: 'alber', t0: 0, dir: [0, 1], start: [0, -0.5], landed: false, bound: false, tEnd: null, unique: null }, 1);
  return { g, P, uq, e };
}

test('① 끝 힘 잣대 = 꺾은 자리부터 (끄면 내려베기 몫)', () => {
  const lenOf = PlayerUniqueAssist.lenOf;
  const a = fire();
  try {
    assert.ok(Math.abs(a.uq.r.len - lenOf(a.e.U.pts, 2)) < 1e-12);
  } finally {
    a.g.world.free();
  }
  const b = withUA({ tsuRuler: 0 }, fire);
  try {
    assert.ok(Math.abs(b.uq.r.len - lenOf(b.e.U.pts, 0, 2)) < 1e-12);
  } finally {
    b.g.world.free();
  }
});

test('② 꺾는 순간 끌고 감: 몫 0.6 · 0.2 s 상한 · 붙잡기 0 · 손가락 긋기와 같은 공격 · 덧칸 — 끝나면 0.2 s 에 손가락으로 · 끄면 요청 없음 · 갈고리 판(tsuHook 1) 요청 그대로', () => {
  const h = withUA({ tsuHook: 1 }, fire);
  try {
    const m = h.P.iaiReq.moves[0];
    assert.deepEqual(m.path, TSU_AIM.band.path);
    assert.deepEqual(m.plan, TSU_AIM.band.plan);
    assert.equal(m.band, true);
    assert.ok(!m.shift && !m.pathHint && !m.cleanArc && !m.roll && !h.P.iaiReq.arcCut, '10/25 갈고리 판 그대로');
  } finally {
    h.g.world.free();
  }
  const a = fire();
  try {
    const R = a.P.iaiReq;
    assert.ok(R?.combo);
    assert.equal(R.share, 0.6);
    assert.equal(R.maxT, 0); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    assert.equal(R.arcCut, true, '잔상은 베는 토막만');
    const m = R.moves[0];
    assert.ok(m.same && m.cutSweep);
    assert.deepEqual(m.from, [0, -0.5]);
    assert.deepEqual(m.path, TSU_AIM.line.path);
    assert.deepEqual(m.plan, TSU_AIM.line.plan);
    assert.equal(m.band, true, '몸통 띠 겨눔 · 굴림 묶음');
    assert.equal(m.shift, 'slide');
    assert.equal(m.pathHint, true);
    assert.equal(m.cleanArc, true);
    assert.ok(a.uq.r, '강화는 그대로');
    let n = 0;
    a.g.step();
    while (a.P.iai && n < 100) {
      a.g.step();
      n++;
    }
    assert.ok(n < 100, `끌고 간 칼이 끝남 ${(n * DT).toFixed(3)} s`); // 11/01 00:xx 사장님 '공격이 몇 초 안에 끝나야한다 이런 기준 없애라고 햇지' — 상한 없음(0)
    for (let k = 0; k < Math.ceil(0.25 / DT); k++) a.g.step();
    assert.equal(a.P.skill.thrustPose.w, 0, '0.2 s 뒤 손가락으로');
  } finally {
    a.g.world.free();
  }
  const b = withUA({ tsuSnap: 0 }, fire);
  try {
    assert.equal(b.P.iaiReq ?? null, null);
  } finally {
    b.g.world.free();
  }
});

test('진 · 츠바메가에시(모노호시자오 무기 비검 kin)는 그대로 — 전 길 · kin 0.5 · 붙잡기 0.2', () => {
  const a = fire('monohoshizao');
  try {
    assert.deepEqual(a.e.U.pts.slice(3), [[0.06, -0.15], G.ochsR]);
    const R = a.P.iaiReq;
    assert.equal(R.share, 0.5);
    assert.equal(R.hold, 0.2);
    assert.ok(!R.moves[0].same);
  } finally {
    a.g.world.free();
  }
});





