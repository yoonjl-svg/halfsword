// 모든 무기 팔 뻗음 점검 (사장님 11/12 '이탈리아 무기들 여전히 팔이 잘 안펴져. 레전드 무기로 오른쪽으로 안 펴지는 경험 … 끝까지 안 펴지면서 팔 모양도 이상하더라. 모든 무기 상하좌우 다 테스트해봐.'
//  — docs/strike/arm_reach_audit_2026-11-12.md · 확인표 3570 ~). 도구 tools/sim/arm_reach_audit.mjs (사람 손가락 — 실제 Input 길 · 가운데 → 여덟 방향 끝까지).
//   ① 한손 찌르기 칼(이탈리아 무기 넷) 날것 매핑 잣대 SKILL.thrustScale 'base': 패드 오른쪽 끝에서 손이 칼 어깨보다 오른쪽 · 이상 꼴 없음 ·
//      여덟 방향 모두 뻗음이 전 판('off')보다 크고 다른 한손 칼 묶음의 가장 낮은 값(동방 환도 — 같은 한손 틀 · 지금 값) 이상 · 'off' 는 전 판 꼴(손이 칼 어깨 안쪽 · 팔꿈치 더 굽음)
//   ② 다른 무기는 그대로 (배수 · 몸 돌림 바이트 같음) · ③ 스위치 둘(twoHandReach · edgeReach — 11/12 사장님 결정으로 기본 켬 · docs/strike/arm_real_2026-11-12.md) 전 판 · 켬 견줌 · 쉼 자리 그대로
//   ① · ② 는 그때 잰 조건(패드 끝 뻗음 · 동방 잣대 · 두 팔 엇갈림 막기 전 — arm_real_pin.mjs)으로 묶음. 11/12 넷의 시험은 arm_real.test.mjs
//   node --test tools/sim/arm_reach_audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG } from './harness_m.mjs';
import { runDir, flagsOf, weaponCells, DIRS, FLAGS } from './arm_reach_audit.mjs';
import { WEAPONS } from '../../src/weapons.js';

const { SKILL } = CONFIG;
const ITALIAN = ['rapier', 'dartagnan', 'balisarda', 'pappenheimer'];
const withSkill = (o, fn) => {
  const old = {};
  for (const k of Object.keys(o)) (old[k] = SKILL[k]), (SKILL[k] = o[k]);
  try { return fn(); } finally { Object.assign(SKILL, old); }
};
const corr = (weapon) => {
  const G = newRound({ weapon, weapon2: 'longsword', seed: 1 });
  try {
    const f = G.player;
    f.skill.corr = 'v2';
    const c = f.corrScale(f.skill.level);
    return { k: c.k, stC: c.stC, S: c.S.toArray() };
  } finally {
    G.world.free();
  }
};

test('기본값 — thrustScale base · twoHandReach 1 · edgeReach 1 (11/12 사장님 \'셋 다 진행해.\' — 전 시험 스위치 0)', () => {
  assert.equal(SKILL.thrustScale, 'base');
  assert.equal(SKILL.twoHandReach, 1);
  assert.equal(SKILL.edgeReach, 1);
});

test('도구 — 무기 표 모두 (레전드 포함) · 유파 · 여덟 방향', () => {
  const cells = weaponCells();
  assert.equal(cells.length, Object.keys(WEAPONS).length);
  for (const id of ['excalibur', 'kusanagi', 'balisarda', 'durandal', 'chixiao']) assert.equal(cells.find((c) => c.weapon === id).tier, 'legend', id);
  assert.deepEqual(ITALIAN.map((w) => cells.find((c) => c.weapon === w).school), ITALIAN.map(() => 'italian'));
  assert.equal(Object.keys(DIRS).length, 8);
  assert.deepEqual(Object.keys(flagsOf({ elbow: 0, elbowUp: 0, shPlane: 0, shBack: 0, shRot: 0, wristFE: 0, wrist: 0, roll: 0, oor: 0, dev: 0, fe: 0, body: 1, arms: 1, sword: 1, grip: null })), FLAGS);
});

test('② 다른 무기 날것 매핑 그대로 (thrustScale 끔과 바이트 같음)', () => {
  for (const w of ['longsword', 'sabre', 'hwando', 'uchigatana', 'zweihander', 'tree_branch']) {
    const a = corr(w);
    const b = withSkill({ thrustScale: 'off' }, () => corr(w));
    assert.deepEqual(a, b, w);
  }
  // 이탈리아 넷은 한손 바탕 표 잣대 — 다른 한손 칼과 같은 쉼 자리 몸 돌림 꼴 (전 판 57.5° · 배수 0.602)
  for (const w of ITALIAN) {
    const a = corr(w);
    const b = withSkill({ thrustScale: 'off' }, () => corr(w));
    assert.ok(Math.abs(b.k - 0.602) < 0.002 && Math.abs((b.stC * 180) / Math.PI - 57.5) < 0.2, `${w} 전 판 k ${b.k} · ${(b.stC * 180) / Math.PI}°`);
    assert.ok(a.k > b.k && a.stC < b.stC, `${w} k ${b.k.toFixed(3)} → ${a.k.toFixed(3)} · 몸 돌림 ${((b.stC * 180) / Math.PI).toFixed(1)} → ${((a.stC * 180) / Math.PI).toFixed(1)}°`);
  }
});




test('③ 패드 끝 뻗음 (edgeReach — 11/12 기본 1): 한손 칼 오른쪽 끝 팔이 펴짐 (전 판 0 보다) · 쉼 자리 손 목표 그대로 · 두손 칼 그대로', () => {
  const pad = (w) => {
    const G = newRound({ weapon: w, weapon2: 'longsword', seed: 1 });
    try {
      const f = G.player;
      f.skill.corr = 'v2';
      return f.padHand(SKILL.homeGuard[0], SKILL.homeGuard[1], f.skill.level, new (f.handTarget.constructor)()).toArray();
    } finally {
      G.world.free();
    }
  };
  for (const w of ['sabre', 'balisarda', 'longsword']) assert.deepEqual(withSkill({ edgeReach: 0 }, () => pad(w)), pad(w), `${w} 쉼 자리`);
  const old = withSkill({ edgeReach: 0 }, () => runDir({ weapon: 'balisarda', dir: 'right', mode: 'slow' }));
  const on = runDir({ weapon: 'balisarda', dir: 'right', mode: 'slow' });
  const two = runDir({ weapon: 'longsword', dir: 'up', mode: 'slow' }); // 두손 칼이 끝까지 끈 뻗음 (팔 IK 사람 칼 몫 0.975 에 닿음)
  assert.ok(on.end.reach > old.end.reach && on.end.reach >= two.end.reach, `오른쪽 뻗음 ${old.end.reach.toFixed(3)} → ${on.end.reach.toFixed(3)} (두손 위 ${two.end.reach.toFixed(3)})`);
  assert.deepEqual(on.flags, [], `켬 이상 꼴 ${on.flags}`);
  const ls = runDir({ weapon: 'longsword', dir: 'right', mode: 'slow' });
  const lsOld = withSkill({ edgeReach: 0 }, () => runDir({ weapon: 'longsword', dir: 'right', mode: 'slow' }));
  assert.deepEqual(lsOld.end, ls.end);
});
