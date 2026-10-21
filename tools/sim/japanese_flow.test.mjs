// 일본 흘림 묶음 시험 (사장님 10/18 22:1x — docs/strike/japanese_flow_adopt_2026-10-18.md)
//  흘림당한 쪽 기력 40(공격 하나에 한 번) · 팔 늦춤 0.4 s(10/21 시간 통일 — 전 0.36) · 일본/이베리아 막는 동안 피해 20 % 감소(동방 50 % 그대로) · 판 값
//  node --test tools/sim/japanese_flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina } from '../../src/stamina.js';
import { STAMINA, SKILL, AI_PROFICIENCY } from '../../src/config.js';
import { FLOW_REDESIGN, spendFlowPenalty, aiFlowReady, flowShieldKeep } from '../../src/nagashi_redesign.js';
import { FLOW_RECOVERY, beginFlowRecovery, flowRecoveryScale } from '../../src/nagashi_recovery.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { index: 0, alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f); return f;
}

test('판 값: 판정 개편 켬 · 공격 끝 = 실제 칼 기하 · 기력 40 · 창 0.2 s · 팔 늦춤 0.4 s(바닥 0.25 — 10/21 시간 통일) · 자연 회복 탈진 · 일본/이베리아 0.2 · 동방 0.5', () => {
  assert.equal(FLOW_REDESIGN.on, true); assert.equal(FLOW_REDESIGN.penalty, 40); assert.equal(FLOW_REDESIGN.window, 0.2); assert.equal(FLOW_REDESIGN.threatEnd, true);
  assert.equal(FLOW_RECOVERY.seconds, 0.4); assert.equal(FLOW_RECOVERY.floor, 0.25); assert.equal(STAMINA.exhaustNatural, true);
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

test('팔 늦춤 0.4 s: 처음 1/3 은 0.25 · 끝에서 1 · 같은 공격 · 돌아오는 중 다시 안 걸림 · 쓰러짐/칼 놓침 = 1 · 0 이면 끔', () => {
  const O = actor({ index: 1 }), D = actor(); O.stamina.attack();
  assert.equal(beginFlowRecovery(O, D), true); assert.equal(beginFlowRecovery(O, D), false);
  const at = (t) => { O.stamina.time = O.flowRecovery.start + t; return flowRecoveryScale(O); };
  const T = FLOW_RECOVERY.seconds; near(at(0), 0.25); near(at(T / 3 - 1e-9), 0.25, 1e-6); near(at((2 * T) / 3), 0.25 + 0.75 * 0.5); near(at(T), 1); near(at(1), 1);
  O.stamina.time = O.flowRecovery.start + T + 0.04; O.stamina.attack(); assert.equal(beginFlowRecovery(O, D), false); // 끝 + 0.12 s 안
  O.stamina.time = O.flowRecovery.start + T + 0.24; assert.equal(beginFlowRecovery(O, D), true); // 새 공격 · 충분히 뒤
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

test('흘린 공격의 피해 감소 0.8 (사장님 10/18 23:4x): 흘린 그 공격 번호만 × 0.2 · 다른 칼 주인 · 새 공격 · 표시 없음 = 1 · 끄면 1', () => {
  assert.equal(FLOW_REDESIGN.flowDmgCut, 0.8);
  const O = actor({ index: 1 }), D = actor(), X = actor({ index: 2 });
  O.stamina.attack(); D.flowShield = { from: O, attackId: O.stamina.attackId };
  near(flowShieldKeep(D, O), 0.2); near(flowShieldKeep(D, X), 1); near(flowShieldKeep(actor(), O), 1);
  O.stamina.attack(); near(flowShieldKeep(D, O), 1); // 다음 공격(새 번호)
  D.flowShield = { from: O, attackId: O.stamina.attackId };
  const was = FLOW_REDESIGN.flowDmgCut; try { FLOW_REDESIGN.flowDmgCut = 0; near(flowShieldKeep(D, O), 1); } finally { FLOW_REDESIGN.flowDmgCut = was; }
});

test('일본 AI 흘림 자세 (사장님 10/18 23:4x): 막는 중은 늘 · 간 보기는 숙련도 2 부터 · 물러남은 4 부터 · 공격 중 · 헛막기는 아님', () => {
  const R = AI_PROFICIENCY.flowReady; assert.deepEqual(R, { watch: 2, withdraw: 4 });
  for (const p of [0, 1, 2, 3, 4, 5]) {
    assert.equal(aiFlowReady({ mode: 'defend', proficiency: p }), true); assert.equal(aiFlowReady({ mode: 'defend', defVoid: true, proficiency: p }), false);
    assert.equal(aiFlowReady({ mode: 'watch', proficiency: p }), p >= 2); assert.equal(aiFlowReady({ mode: 'withdraw', proficiency: p }), p >= 4);
    assert.equal(aiFlowReady({ mode: 'attack', proficiency: p }), false);
  }
  assert.equal(aiFlowReady(null), false); assert.equal(aiFlowReady({ mode: 'watch' }), true); // 숙련도 없는 AI = 기본 2
});

test('숙련도별 유파 고유 특성 배율 (사장님 10/18 23:4x): 숙련도 2 = 1(그대로) · 숙련도가 오를수록 커짐', () => {
  const K = AI_PROFICIENCY.schoolK; assert.equal(K.length, AI_PROFICIENCY.max + 1); assert.equal(K[2], 1);
  for (let i = 1; i < K.length; i++) assert.ok(K[i] > K[i - 1], `${i}`);
});
