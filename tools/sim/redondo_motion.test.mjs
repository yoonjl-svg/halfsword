// 풍차 베기(B4 레돈두) 감기 휘청 고침 · 감기 꼴 셋 시험 (사장님 10/29 20:0x '레돈두는 처음 발동을 시작할 때 캐릭터가 크게 휘청거려. 이 문제를 반드시 고쳐야 하고,
//  머리 위로 칼을 돌리는 동작이 너무 빠르고 조악 … 좀 더 천천히 큰 동작으로 돌리거나 어깨에 얹는 고정 준비동작으로' — docs/strike/redondo_hold_2026-10-29.md §8 ·
//  config UNIQUE_ASSIST.rdSteady · rdRamp · rdWindMode · rdSlow · rdShoulder · src/iberian_redondo.js · fighter.js armsPlaced)
//  손가락은 누르는 동안 화면에 닿아 있다(게임 main.js handHeld = activeTouch) — 이 몫이 없던 10/29 판 시험 · 재기는 휘청을 못 봤다.
//  node --test tools/sim/redondo_motion.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { windSpec } from '../../src/iberian_redondo.js';
// 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — SECRET.iberianSecret 'altib' 기본): 이 파일은 풍차 베기 · 정수리 가르기 특수 공격 장면(무장 없이 길게 눌러 냄 · 10/29 ~ 10/31)이라
//  그 판('spin')으로 묶는다(이 파일 안에서만). 비기가 된 판은 tools/sim/ib_swap.test.mjs

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, IB_FLOW } = CONFIG;
const R2D = 180 / Math.PI;
// 뗌 → 벰 상한: 칼끝 몫 0.5(10/30 · 10/31 판 시험을 맞춘 값)에서 잡은 수를 지금 칼끝 몫에 맞춰 늘림 — 드는 길은 같은 길을 칼끝 빠르기로 감 (10/31 13:5x 0.5 → 0.3 · 꼴은 그대로 지킴)
const LEAD_MAX = (s05) => s05 * 0.5 / UA.specialShare.redondo;

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

test('기본값 — 휘청 고침 켬 · 감기 꼴 = 안 B(shoulder — 사장님 10/31 02:xx \'풍차 베기. 아까 b안으로 본판 적용해.\' · 10/30 00:1x 판 안 A) · 얹은 채 0.6 s = 감음(얹은 때부터 — 감독 해석) · 안 A 한 바퀴 1.2 s (시간 사다리) · 내려침 = 곧장 사선(direct)', () => {
  assert.equal(windSpec().kind, 'shoulder'); // 메기 'load' 는 어깨 꼴과 같은 놓기 (자리만 rdLoad)
  assert.equal(windSpec().name, 'load');
  assert.ok(Math.abs(UA.rdLoad.windIn - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.rdLoad.woundT - realS(0.6)) < 1e-12);
  assert.ok(UA.rdTajo.angle >= 45 && UA.rdTajo.angle <= 90, '사장님 10/31 19:xx \'45도~90도 사이로\'');
});

