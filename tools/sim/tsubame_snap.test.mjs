// 사람 제비 베기 세 해법 시험 (사장님 10/25 21:1x '해법 1~3 좋아' — docs/strike/tsubame_snap_2026-10-25.md · config UNIQUE_ASSIST.tsuRuler · tsuSnap · tsuAim):
//   ① 끝 힘 잣대 = 꺾은 자리부터(올려 긋는 길) · ② 꺾는 순간 올려 긋는 길을 고노센 칼끝 빠르기 × 0.6 으로 0.2 s 까지 끌고 감(운동학 — 손가락 긋기와 같은 공격 · 붙잡기 없이 0.2 s 에 손가락으로) ·
//   ③ 올려 긋는 길 끝을 아래팔 · 겨드랑이 · 가슴 높이로 + 손 돌리기(손목 사람 범위). AI 길(schools.js) · 진 · 츠바메가에시(모노호시자오 kin)는 그대로. 셋 다 끄면 10/25 전 판.
//  작게 · 빠르게(사장님): 씨앗 하나 · 14 s 판 둘.  node --test tools/sim/tsubame_snap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { tsubameRun, tsubameSummary } from './schielhau_strike.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { G } from '../../src/ai_techniques.js';
import { PLAYER_UNIQUE, uniqueDef, PlayerUniqueAssist, TSU_AIM } from '../../src/unique_assist.js';

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
  assert.equal(UA.tsuSnapShare, 0.6);
  assert.equal(UA.tsuSnapTime, 0.2);
  const u = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
  assert.deepEqual([u.from, ...u.path], [G.tag, [0.0, 0.14], G.alber, [0.06, -0.15], G.ochsR]); // AI 가 읽는 길은 그대로
});

test('③ 사람 잣대 길: 꺾는 자리까지 그대로 · 그 뒤 aim 길 · 덧칸 [꺾은 자리, ...길] — 끄면 전 길 · 덧칸 없음', () => {
  const on = uniqueDef('japanese', TSU);
  assert.deepEqual(on.pts.slice(0, 3), [G.tag, [0.0, 0.14], G.alber]);
  assert.deepEqual(on.pts.slice(3), TSU_AIM.path);
  assert.equal(on.plan.length, on.pts.length);
  assert.deepEqual(on.plan.slice(2), TSU_AIM.plan);
  const off = withUA({ tsuAim: 0 }, () => uniqueDef('japanese', TSU));
  assert.deepEqual(off.pts.slice(3), [[0.06, -0.15], G.ochsR]);
  assert.equal(off.plan, undefined);
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

test('② 꺾는 순간 끌고 감: 몫 0.6 · 0.2 s 상한 · 붙잡기 0 · 손가락 긋기와 같은 공격 · 덧칸 — 끝나면 0.2 s 에 손가락으로 · 끄면 요청 없음', () => {
  const a = fire();
  try {
    const R = a.P.iaiReq;
    assert.ok(R?.combo);
    assert.equal(R.share, 0.6);
    assert.equal(R.maxT, 0.2);
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    const m = R.moves[0];
    assert.ok(m.same && m.cutSweep);
    assert.deepEqual(m.from, [0, -0.5]);
    assert.deepEqual(m.path, TSU_AIM.path);
    assert.equal(m.plan.length, m.path.length + 1);
    assert.ok(a.uq.r, '강화는 그대로');
    let n = 0;
    a.g.step();
    while (a.P.iai && n < 100) {
      a.g.step();
      n++;
    }
    assert.ok(n * DT <= 0.2 + 2 * DT, `끌고 간 시간 ${(n * DT).toFixed(3)} s`);
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

test('한 판 견줌 (씨앗 1 · 14 s · 상대 상처 끔 · 아래 칼 빗나감): 공격당 심각도 10 배 넘게 · 다리보다 팔 · 가슴 · 손목 범위 안', () => {
  const run = () => tsubameSummary([tsubameRun(1, { immortal: true, dur: 14, ghostDown: true })]);
  const on = run();
  const off = withUA(OFF, run);
  assert.ok(on.perAtk >= 10 * Math.max(off.perAtk, 0.02), `켬 ${on.perAtk} · 끔 ${off.perAtk}`);
  assert.ok(on.snapHits >= 1);
  const P = on.parts;
  const legs = (P.thighF ?? 0) + (P.thighB ?? 0) + (P.shinF ?? 0) + (P.shinB ?? 0) + (P.pelvis ?? 0);
  const upper = (P.farmS ?? 0) + (P.farmO ?? 0) + (P.uarmS ?? 0) + (P.uarmO ?? 0) + (P.chest ?? 0);
  assert.ok(upper > legs, JSON.stringify(P));
  assert.equal(on.oor, 0);
  assert.ok(on.roll78 <= Math.ceil(on.contacts * 0.25), `굴림 끝 ${on.roll78} / ${on.contacts}`);
});
