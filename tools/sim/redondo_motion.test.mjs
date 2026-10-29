// 풍차 베기(B4 레돈두) 감기 휘청 고침 · 감기 꼴 셋 시험 (사장님 10/29 20:0x '레돈두는 처음 발동을 시작할 때 캐릭터가 크게 휘청거려. 이 문제를 반드시 고쳐야 하고,
//  머리 위로 칼을 돌리는 동작이 너무 빠르고 조악 … 좀 더 천천히 큰 동작으로 돌리거나 어깨에 얹는 고정 준비동작으로' — docs/strike/redondo_hold_2026-10-29.md §8 ·
//  config UNIQUE_ASSIST.rdSteady · rdRamp · rdWindMode · rdSlow · rdShoulder · src/iberian_redondo.js · fighter.js armsPlaced)
//  손가락은 누르는 동안 화면에 닿아 있다(게임 main.js handHeld = activeTouch) — 이 몫이 없던 10/29 판 시험 · 재기는 휘청을 못 봤다.
//  node --test tools/sim/redondo_motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { windSpec, windRate } from '../../src/iberian_redondo.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, IB_FLOW } = CONFIG;
const R2D = 180 / Math.PI;

/** 사람 몸 + 풍차 베기만 · 상대는 멀리 서 있음 · 누르는 동안 손가락 닿음(handHeld) · set = 이 판만 바꿀 UNIQUE_ASSIST 칸 */
function body({ weapon = 'zweihander', set = {}, kit = null, seed = 3 } = {}) {
  const keep = Object.fromEntries(Object.keys(set).map((k) => [k, UA[k]]));
  Object.assign(UA, set);
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', kit });
  const P = G.player;
  G.ai.update = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  const press = { down: false };
  G.before = () => {
    uq.holdInput(press.down, true, false);
    P.handHeld = press.down;
  };
  const steps = (s, each) => { for (let i = 0; i < Math.round(s / DT); i++) { G.step(); each?.(); } };
  steps(3.0); // 판 시작 정지(2 s) 뒤 서 있는 자세
  return { G, P, uq, press, steps, free: () => { G.world.free(); Object.assign(UA, keep); } };
}
/** 가슴 위 축 ↔ 하늘 각 (°) */
const tiltOf = (P) => {
  const r = P.bodies.chest.rotation();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  return Math.acos(Math.min(1, up.y)) * R2D;
};
/** 누름 → 감기 holdS 실제 초 동안의 흔들림: 가슴 기울기 바뀜 최대 · 무게중심이 발 둘레 밖으로 벗어난 몫 최대(m) · 넘어짐 */
function sway(B, holdS) {
  const { P, uq, press, steps } = B;
  const t0 = tiltOf(P);
  let dTilt = 0, off = 0, fell = false;
  press.down = true;
  steps(realS(0.6) + realS(holdS), () => {
    if (!uq.winding) return;
    dTilt = Math.max(dTilt, Math.abs(tiltOf(P) - t0));
    off = Math.max(off, P.offBalance ?? 0);
    if (P.state !== 'stand') fell = true;
  });
  return { dTilt, off, fell };
}

test('기본값 — 휘청 고침 켬 · 감기 꼴은 사장님이 고르실 때까지 10/29 판(spin) · 안 A 한 바퀴 1.2 s · 안 B 얹은 채 0.6 s = 감음 (시간 사다리)', () => {
  assert.equal(UA.rdSteady, 1);
  assert.equal(UA.rdRamp, 1);
  assert.equal(UA.rdWindMode, 'spin');
  assert.ok(Math.abs(UA.rdSlow.loopT - realS(1.2)) < 1e-12);
  assert.ok(Math.abs(UA.rdSlow.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdShoulder.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdShoulder.woundT - realS(0.6)) < 1e-12);
  assert.equal(windSpec().kind, 'spin');
  assert.ok(Math.abs(windRate() - (2 * Math.PI) / UA.rdLoopT) < 1e-12, 'spin = 10/29 판 한 바퀴');
});

test('휘청 고침 — 네 칼(츠바이핸더 · 플랑베르주 · 티소나 · 듀란달) 손가락을 대고 길게 눌러 감아도 가슴이 크게 안 젖혀지고 · 무게중심이 발 둘레 안 · 안 넘어짐 / 고치기 전(rdSteady 0)은 휘청', () => {
  for (const weapon of ['zweihander', 'flamberge', 'tizona', 'durandal']) {
    const B = body({ weapon });
    try {
      const s = sway(B, 1.2);
      assert.ok(s.dTilt < 12, `${weapon} 가슴 기울기 ${s.dTilt.toFixed(1)}°`);
      assert.ok(s.off < 0.05, `${weapon} 발 둘레 밖 ${(s.off * 100).toFixed(1)} cm`);
      assert.equal(s.fell, false, weapon);
    } finally { B.free(); }
  }
  const B = body({ set: { rdSteady: 0 } });
  try {
    const s = sway(B, 1.2);
    assert.ok(s.off > 0.2 || s.dTilt > 20, `고치기 전 재현 — 발 둘레 밖 ${(s.off * 100).toFixed(1)} cm · 기울기 ${s.dTilt.toFixed(1)}°`);
  } finally { B.free(); }
});

test('휘청 고침 — 감는 동안 손목 원뿔 · 칼 어깨 면 밧줄을 떼고, 내려침이 끝나면 · 그만둔 팔을 내려놓으면 다시 건다', () => {
  const B = body();
  try {
    const { P, uq, press, steps } = B;
    assert.ok(P.shoulderRopes?.length && P.gripCone?.length, '처음엔 걸려 있음');
    press.down = true; steps(realS(0.8));
    assert.equal(uq.winding, true);
    assert.equal(P.shoulderRopes, null, '감는 동안 어깨 면 밧줄 없음');
    assert.equal(P.gripCone, null, '감는 동안 손목 원뿔 없음');
    assert.equal(P.armsPlaced(), true);
    press.down = false; steps(DT * 3);
    assert.equal(uq.stats.fired.redondo, 1, '내려침');
    assert.equal(P.shoulderRopes, null, '내려침 동안도 뗀 채');
    let k = 0;
    while ((P.iai || P.iaiReq) && k++ < 400) steps(DT);
    steps(0.5); // 운동학 칼 끝 · 끝 자세 놓기(iaiFade) · 덧씌우기 칸 내려놓기(0.12 s) 뒤
    assert.ok(P.shoulderRopes?.length, '내려침 끝 → 어깨 면 밧줄 다시');
    assert.ok(P.gripCone?.length, '손목 원뿔 다시');
    assert.equal(P.armsPlaced(), false);
    // 그만둠 (막기 단추) → 덧씌우기 칸을 내려놓은 뒤 다시
    uq.coolT = {};
    press.down = true; steps(realS(0.8));
    assert.equal(P.shoulderRopes, null);
    uq.blocked = true; steps(DT * 2); uq.blocked = false; press.down = false;
    assert.equal(uq.winding, false);
    steps(0.4);
    assert.ok(P.shoulderRopes?.length && P.gripCone?.length, '그만둔 뒤 다시');
  } finally { B.free(); }
});

test('안 A slowSpin — 한 바퀴 실제 약 1.2 s · 칼끝 원이 10/29 판보다 큼 · 한 바퀴 넘게 감으면 흐름 셈 · 떼면 같은 내려침', () => {
  const B = body({ set: { rdWindMode: 'slowSpin' } });
  try {
    const { P, uq, press, steps } = B;
    press.down = true; steps(realS(0.7));
    assert.equal(uq.winding, true);
    assert.equal(P.rdWind.M.kind, 'spin');
    const T0 = P.rdWind.turns;
    steps(realS(0.6) + realS(1.2) * 0.5); // 섞기 끝 뒤
    const ta = P.rdWind.turns;
    steps(realS(0.6));
    const rate = (P.rdWind.turns - ta) / 0.6; // 실제 초당 바퀴
    assert.ok(Math.abs(1 / rate - 1.2) < 0.05, `한 바퀴 ${(1 / rate).toFixed(2)} s`);
    assert.ok(P.rdWind.turns > T0);
    // 칼끝 원 반지름 (손 ~ 칼끝 × sin cone) — 10/29 판 cone 30 보다 큼
    assert.ok(UA.rdSlow.cone > UA.rdLoop.cone);
    press.down = false; steps(DT * 3);
    assert.equal(uq.stats.fired.redondo, 1);
  } finally { B.free(); }
});

test('안 B shoulder — 오른 어깨에 얹어 멈춤(칼끝이 거의 안 움직임 · 날 위) · 얹은 채 0.6 s 넘게 쥐면 흐름 셈(n 1) · 그 전에 떼면 셈 없음 · 떼면 같은 내려침', () => {
  const run = (holdS) => {
    const B = body({ set: { rdWindMode: 'shoulder' } });
    try {
      const { P, uq, press, steps } = B;
      press.down = true; steps(realS(0.6) + realS(holdS));
      assert.equal(uq.winding, true);
      const W = P.rdWind;
      assert.equal(W.M.kind, 'shoulder');
      // 섞기 끝 뒤 칼끝 빠르기 (놓인 자리의 차)
      let tipV = 0;
      if (W.t > UA.rdShoulder.windIn + 0.05) {
        const a = P.bladePoint(1, new THREE.Vector3());
        steps(DT);
        tipV = P.bladePoint(1, new THREE.Vector3()).distanceTo(a) / DT;
      }
      // 칼 든 쪽 어깨 위 · 칼끝은 뒤 (몸 틀)
      const inv = P.yaw.clone().invert();
      const c = P.bodies.chest.translation();
      const tip = P.bladePoint(1, new THREE.Vector3()).sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(inv);
      const turns = W.turns;
      press.down = false; steps(DT * 3);
      return { tipV, tip, turns, fired: uq.stats.fired.redondo ?? 0, chain: uq.stats.windChain?.at(-1) };
    } finally { B.free(); }
  };
  const long = run(1.0);
  assert.ok(long.tipV < 1.0, `얹은 칼끝 ${long.tipV.toFixed(2)} m/s`);
  assert.ok(long.tip.x < -0.5, '칼끝은 뒤');
  assert.ok(long.turns >= 1, '0.6 s 넘게 얹음 = 감음');
  assert.equal(long.fired, 1);
  const short = run(0.3);
  assert.ok(short.turns < 1, '0.6 s 전');
  assert.equal(short.fired, 1, '떼면 내려침 (셈 없이)');
});

test('흐르는 긋기 셈 (IB_FLOW.windmillChain simple) — 안 B 는 얹은 채 0.6 s 를 한 바퀴 자리로', async () => {
  const { kitFromNodes } = await import('../../src/skill_tree_data.js');
  const kitAll = kitFromNodes('iberian', new Set(['B1', 'B5', 'B4', 'B6']));
  const run = (holdS) => {
    const B = body({ set: { rdWindMode: 'shoulder' }, kit: kitAll, seed: 7 });
    try {
      const { uq, press, steps } = B;
      press.down = true; steps(realS(0.6) + realS(holdS)); press.down = false; steps(DT * 3);
      return uq.stats.windChain?.at(-1);
    } finally { B.free(); }
  };
  assert.equal(IB_FLOW.windmillChain, 'simple');
  assert.equal(run(0.4), 0, '0.6 s 전 → 셈 없음');
  assert.equal(run(0.8), 1, '0.6 s 넘게 → n 1');
});
