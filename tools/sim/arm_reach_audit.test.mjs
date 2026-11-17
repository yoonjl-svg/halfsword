// 모든 무기 팔 뻗음 점검 (사장님 11/12 '이탈리아 무기들 여전히 팔이 잘 안펴져. 레전드 무기로 오른쪽으로 안 펴지는 경험 … 끝까지 안 펴지면서 팔 모양도 이상하더라. 모든 무기 상하좌우 다 테스트해봐.'
//  — docs/strike/arm_reach_audit_2026-11-12.md · 확인표 3570 ~). 도구 tools/sim/arm_reach_audit.mjs (사람 손가락 — 실제 Input 길 · 가운데 → 여덟 방향 끝까지).
//   한손 찌르기 칼(이탈리아 무기 넷) 날것 매핑 잣대 = 무기별 바탕 표 · 두손 칼 빈팔 닿는 곳 · 한손 칼 패드 끝 뻗음은 늘 켬 (11/12 사장님 '셋 다 진행해.' — docs/strike/arm_real_2026-11-12.md · 스위치 걷음 11/17).
//   11/12 넷의 시험은 arm_real.test.mjs
//   node --test tools/sim/arm_reach_audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDir, flagsOf, weaponCells, DIRS, FLAGS } from './arm_reach_audit.mjs';
import { WEAPONS } from '../../src/weapons.js';

const ITALIAN = ['rapier', 'dartagnan', 'balisarda', 'pappenheimer'];

test('도구 — 무기 표 모두 (레전드 포함) · 유파 · 여덟 방향', () => {
  const cells = weaponCells();
  assert.equal(cells.length, Object.keys(WEAPONS).length);
  for (const id of ['excalibur', 'kusanagi', 'balisarda', 'durandal', 'chixiao']) assert.equal(cells.find((c) => c.weapon === id).tier, 'legend', id);
  assert.deepEqual(ITALIAN.map((w) => cells.find((c) => c.weapon === w).school), ITALIAN.map(() => 'italian'));
  assert.equal(Object.keys(DIRS).length, 8);
  assert.deepEqual(Object.keys(flagsOf({ elbow: 0, elbowUp: 0, shPlane: 0, shBack: 0, shRot: 0, wristFE: 0, wrist: 0, roll: 0, oor: 0, dev: 0, fe: 0, body: 1, arms: 1, sword: 1, grip: null })), FLAGS);
});

test('패드 끝 뻗음 (11/12): 한손 칼 오른쪽 끝 팔이 두손 칼 위 끝만큼 펴짐 · 이상 꼴 없음', () => {
  const on = runDir({ weapon: 'balisarda', dir: 'right', mode: 'slow' });
  const two = runDir({ weapon: 'longsword', dir: 'up', mode: 'slow' }); // 두손 칼이 끝까지 끈 뻗음 (팔 IK 사람 칼 몫 0.975 에 닿음)
  assert.ok(on.end.reach >= two.end.reach, `오른쪽 뻗음 ${on.end.reach.toFixed(3)} (두손 위 ${two.end.reach.toFixed(3)})`);
  assert.deepEqual(on.flags, [], `켬 이상 꼴 ${on.flags}`);
});
