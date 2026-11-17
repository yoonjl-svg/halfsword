// 이베리아 특수 공격 시험 — 풍차 베기 (B4 레돈두 · 사장님 10/29 00:4x ~ 01:5x · 08:3x — docs/strike/redondo_hold_2026-10-29.md · config UNIQUE_ASSIST.rdHold · rdHoldTime · rdDrain · rdSnapShare · rdSnapTime):
//   탭(손가락 · PC 왼 단추)을 끌지 않고 실제 0.6 s 넘게 누르면 머리 위로 칼을 돌리고(감기 — 걸음 그대로 · 기력이 듦) 떼면 왼 위 → 오른 아래로 내려 벰(10/30 곧장 사선 — redondo_motion.test.mjs) ·
//   0.6 s 전에 떼면 보통 탭 · 끌면 보통 긋기 · 식힘(내려침이 나간 순간부터 6 s) 중엔 감지 않음 · 맞음 · 막기 단추 · 비기는 감기를 그만두게(식힘 없음) · 기력이 바닥이면 저절로 내려침 ·
//   한 바퀴 넘게 돌린 뒤 낸 칼 = 이어 그은 칼 하나(흐르는 긋기 B5 · 이어지는 흐름 B6) · 사람의 왼 가로베기는 보통 긋기 · AI 는 그대로(왼 가로베기 강화동작)
//  손으로 누름을 놓는 시험 + 입력 층(input.js) 흉내 판.  node --test tools/sim/redondo_hold.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist, enhancedMoves } from '../../src/unique_assist.js';
import { kitFromNodes, nodeOf } from '../../src/skill_tree_data.js';
import { classifyStroke } from '../../src/attack_stroke.js';
import { G as PAD } from '../../src/ai_techniques.js';
// 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — SECRET.iberianSecret 'altib' 기본): 이 파일은 정수리 가르기 특수 공격 장면(무장 없이 길게 눌러 냄 · specialShare.redondo · AI 왼 가로베기 강화동작 — 10/29 ~ 11/01)이라
//  그 판('spin')으로 묶는다(이 파일 안에서만). 새 판(비기 알티바슈 포르트 · 특수 공격 싱지르 한 걸음)은 tools/sim/ib_swap.test.mjs

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, STAMINA, IB_FLOW, INPUT } = CONFIG;

test('기본값 — 길게 누름 실제 0.6 s · 기력 초당 붙어 버티기와 같은 수 · 고노센 칼끝 × 0.3 · 실제 0.4 s · 식힘 3 s(끝난 때부터 — 10/29 19:5x) · 흐름과 무관(10/31 19:xx) · B4 칸 = 정수리 가르기 · AI 는 왼 가로베기 강화동작 그대로', () => {
  assert.ok(Math.abs(UA.rdHoldTime - realS(0.6)) < 1e-12); // 사장님 '0.6초'
  assert.equal(UA.specialShare.redondo, 0.25); // 11/01 00:xx 사장님 '알티바슈는 25%로 하고' (전 0.2 ← 0.3)
  assert.ok(Math.abs(UA.specialCooldown - realS(3.0)) < 1e-12); // 10/29 19:5x 사장님 '특수공격 3초(발동이 완료된 시점부터)' (전 6 s · 나간 순간부터)
  const e = PLAYER_UNIQUE.iberian.find((x) => x.name === 'redondo');
  assert.equal(e.role, 'hold');
  assert.deepEqual(e.on, []); // 사람: 긋기 조건 없음 — 왼 가로베기는 보통 긋기
  assert.ok(e.special && e.hold);
  assert.equal(e.nameKo, '정수리 가르기 (알티바슈 포르트)'); // 사장님 10/31 19:xx 결정 (전 10/29 01:5x '풍차 베기 (레돈두)')
  assert.equal(e.orig, 'altibaxo forte'); // 원어 글자는 대기실 스킬에서만 (화면 글 지침 §1) — 피게이레두 낱말 altibaxo 로 지은 이름
  const n = nodeOf('iberian', 'B4');
  assert.equal(n.u, 'redondo'); // 열쇠는 그대로 (10/31 — 이름만 바꿈)
  // 칸 자리 · 이름 (스킬트리 자료는 판과 상관없이 하나 — 11/11 자리 바꿈 뒤: B4 = 비기 알티바슈 포르트 · 전 B4 자리(d 2 · cx 560 · B5 뒤)는 B7 싱지르 · 이어지는 흐름은 B7 뒤 — tools/sim/ib_swap.test.mjs)
  assert.equal(n.name, '알티바슈 포르트'); // 전 '정수리 가르기' (10/31 19:xx)
  assert.deepEqual([nodeOf('iberian', 'B7').d, nodeOf('iberian', 'B7').cx, [...nodeOf('iberian', 'B7').pre]], [2, 560, ['B5']]); // 01:3x 흐르는 긋기와 자리 바꿈 (그 자리 — 11/11 부터 B7)
  assert.deepEqual([nodeOf('iberian', 'B5').d, nodeOf('iberian', 'B5').cx, [...nodeOf('iberian', 'B5').pre]], [1, 588, ['B1']]);
  assert.deepEqual([...nodeOf('iberian', 'B6').pre], ['B7']);
  // AI 몫 그대로: 왼 가로베기 대신 머리 위 돌려 베기 (sword_art.js 가 읽는 표 — 11/11 표에 싱지르 칸이 더해짐 · 'spin' 판은 싱지르를 뺌 aiUniqueStages retired)
  assert.deepEqual(enhancedMoves('iberian').filter((m) => m.name === 'redondo'), [{ base: 'zwerchL', name: 'redondo', stage: 3 }]);
});

/** 사람 츠바이핸더 + 풍차 베기만 연 강화 · 상대는 서 있음 */
function body({ seed = 3, gap = 2.4, names = ['redondo'], kit = null, weapon = 'zweihander' } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', gap, kit });
  const P = G.player;
  G.ai.update = () => {};
  const uq = new PlayerUniqueAssist(P, { names: new Set(names) });
  const press = { down: false, still: true };
  G.before = () => uq.holdInput(press.down, press.still, false);
  for (let i = 0; i < 3; i++) G.step();
  const steps = (s) => { for (let i = 0; i < Math.round(s / DT); i++) G.step(); };
  return { G, P, uq, press, steps, free: () => G.world.free() };
}

test('사람 왼 가로베기는 보통 긋기 (풍차 베기를 열어도 강화동작으로 안 읽힘)', () => {
  const B = body();
  try {
    const { uq } = B;
    const c = classifyStroke(PAD.sideL, [1, 0]);
    assert.equal(c.tech, 'zwerchL');
    const pick = uq.choose({ tech: 'zwerchL', kind: 'cut', pad: c.pad, start: PAD.sideL }, PAD.sideL, [1, 0], uq.t);
    assert.equal(pick, null);
  } finally { B.free(); }
});

// ── 입력 층 (input.js — 브라우저 흉내는 부르는 동안만: 늘 두면 Rapier 가 멈춘다 · live_twin.mjs 와 같은 꼴) ──
const SHIM = { window: { addEventListener() {}, innerHeight: 390, innerWidth: 844 }, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
const withBrowser = (fn) => {
  const added = [];
  for (const k in SHIM) if (typeof globalThis[k] === 'undefined') (globalThis[k] = SHIM[k]), added.push(k);
  try { return fn(); } finally { for (const k of added) delete globalThis[k]; }
};
const { Input } = await import('../../src/input.js');

