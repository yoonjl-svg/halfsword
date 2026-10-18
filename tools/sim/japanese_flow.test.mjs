// 일본 흘림 묶음 시험 (사장님 10/18 22:1x — docs/strike/japanese_flow_adopt_2026-10-18.md)
//  흘림당한 쪽 기력 40(공격 하나에 한 번) · 팔 늦춤 0.36 s · 일본/이베리아 막는 동안 피해 20 % 감소(동방 50 % 그대로) · 판 값
//  node --test tools/sim/japanese_flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina } from '../../src/stamina.js';
import { STAMINA, SKILL } from '../../src/config.js';
import { FLOW_REDESIGN, spendFlowPenalty } from '../../src/nagashi_redesign.js';
import { FLOW_RECOVERY, beginFlowRecovery, flowRecoveryScale } from '../../src/nagashi_recovery.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { index: 0, alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f); return f;
}

test('판 값: 판정 개편 켬 · 공격 끝 = 실제 칼 기하 · 기력 40 · 창 0.12 s · 팔 늦춤 0.36 s(바닥 0.25) · 자연 회복 탈진 · 일본/이베리아 0.2 · 동방 0.5', () => {
  assert.equal(FLOW_REDESIGN.on, true); assert.equal(FLOW_REDESIGN.penalty, 40); assert.equal(FLOW_REDESIGN.window, 0.12); assert.equal(FLOW_REDESIGN.threatEnd, true);
  assert.equal(FLOW_RECOVERY.seconds, 0.36); assert.equal(FLOW_RECOVERY.floor, 0.25); assert.equal(STAMINA.exhaustNatural, true);
  assert.equal(SKILL.jpParryDmgCut, 0.2); assert.equal(SKILL.ibParryDmgCut, 0.2); assert.equal(SKILL.cnParryDmgCut, 0.5);
});

test('흘림당한 쪽 기력 40: 공격 번호 하나에 한 번 · 다른 방어자를 만나도 다시 안 냄 · 새 공격이면 다시 · 공격 번호 없으면 없음 · 40 끄면 없음', () => {
  const O = actor({ index: 1 }), D = actor({ index: 0 }), D2 = actor({ index: 2 });
  assert.equal(spendFlowPenalty(O, D), null); // 공격 번호 없음
  O.stamina.attack(); const v0 = O.stamina.value; // 베기 12 를 낸 뒤
  const e = spendFlowPenalty(O, D); assert.ok(e && e.charged); near(O.stamina.value, v0 - 40); near(e.actual, 40); assert.equal(O.stamina.counts.flow, 1);
  assert.equal(spendFlowPenalty(O, D), null); assert.equal(spendFlowPenalty(O, D2), null); near(O.stamina.value, v0 - 40); // 같은 공격 재접촉 · 다른 방어자
  O.stamina.attack(); const v1 = O.stamina.value; assert.ok(spendFlowPenalty(O, D)); near(O.stamina.value, v1 - 40); near(O.stamina.spent.flow, 80);
  const was = FLOW_REDESIGN.penalty; try { FLOW_REDESIGN.penalty = 0; O.stamina.attack(); const v2 = O.stamina.value; assert.equal(spendFlowPenalty(O, D), null); near(O.stamina.value, v2); } finally { FLOW_REDESIGN.penalty = was; }
});

test('흘림당한 쪽 기력 40: 바닥(−70)에서 멈추고 탈진 · 기력 무한(용사의 눈물)은 청구 없음', () => {
  const O = actor({ index: 1 }), D = actor();
  O.stamina.value = STAMINA.floor + 10; O.stamina.attack('cut', true); // 묶음 공격(비용 없음)으로 번호만
  const e = spendFlowPenalty(O, D); near(O.stamina.value, STAMINA.floor); near(e.actual, 10); assert.equal(O.stamina.exhausted, true);
  const H = actor({ index: 1 }); H.stamina.infinite = true; H.stamina.attack(); const h0 = H.stamina.value; const eh = spendFlowPenalty(H, D); assert.equal(eh.charged, false); near(H.stamina.value, h0);
});

test('팔 늦춤 0.36 s: 처음 1/3 은 0.25 · 끝에서 1 · 같은 공격 · 돌아오는 중 다시 안 걸림 · 쓰러짐/칼 놓침 = 1 · 0 이면 끔', () => {
  const O = actor({ index: 1 }), D = actor(); O.stamina.attack();
  assert.equal(beginFlowRecovery(O, D), true); assert.equal(beginFlowRecovery(O, D), false);
  const at = (t) => { O.stamina.time = O.flowRecovery.start + t; return flowRecoveryScale(O); };
  near(at(0), 0.25); near(at(0.12 - 1e-9), 0.25, 1e-6); near(at(0.24), 0.25 + 0.75 * 0.5); near(at(0.36), 1); near(at(1), 1);
  O.stamina.time = O.flowRecovery.start + 0.40; O.stamina.attack(); assert.equal(beginFlowRecovery(O, D), false); // 끝 + 0.12 s 안
  O.stamina.time = O.flowRecovery.start + 0.60; assert.equal(beginFlowRecovery(O, D), true); // 새 공격 · 충분히 뒤
  O.stamina.time = O.flowRecovery.start; O.state = 'down'; near(flowRecoveryScale(O), 1); O.state = 'stand'; O.armed = false; near(flowRecoveryScale(O), 1);
  const was = FLOW_RECOVERY.seconds; try { FLOW_RECOVERY.seconds = 0; const P = actor({ index: 1 }); P.stamina.attack(); assert.equal(beginFlowRecovery(P, D), false); near(flowRecoveryScale(P), 1); } finally { FLOW_RECOVERY.seconds = was; }
});

test('막는 동안 피해 감소: 일본 · 이베리아 × 0.8 · 동방 × 0.5 · 다른 유파 · 책 해제 · 막는 중 아님 = 1 · 끄면 1', () => {
  const keep = (tradition, { mode = 'defend', schoolParry = true } = {}) => {
    const g = Object.create(PlayerParryGuard.prototype); g.me = { swordArt: { tradition }, schoolParry }; g.mode = mode; return g.woundKeep();
  };
  near(keep('japanese'), 0.8); near(keep('iberian'), 0.8); near(keep('chinese'), 0.5);
  for (const t of ['german', 'italian', 'none', undefined]) near(keep(t), 1);
  near(keep('japanese', { mode: 'idle' }), 1); near(keep('iberian', { schoolParry: false }), 1);
  const was = { ...SKILL }; try { SKILL.jpParryDmgCut = 0; SKILL.ibParryDmgCut = 0; near(keep('japanese'), 1); near(keep('iberian'), 1); near(keep('chinese'), 0.5); } finally { SKILL.jpParryDmgCut = was.jpParryDmgCut; SKILL.ibParryDmgCut = was.ibParryDmgCut; }
});
