// 롤랑 · 베르나르도 가르기 (사장님 10/29 15:5x '롤랑과 베르나르도의 성향과 캐릭터를 분화해서 싸움 스타일도 바꾸도록 해' — docs/characters/temperament_2026-10-29.md §7-3)
//  아르토리아 숫자 그대로 · 셋이 서로 다른 기질 · 싱지르 걸쇠의 발(pers.spinHold) · 셋 다 칭호 '왕'
//  node --test tools/sim/kings_split.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { newRound, AI } from './harness_m.mjs';

const C = CHARACTERS_BY_ID;

test('아르토리아 숫자는 그대로 (사장님 — 롤랑 · 베르나르도만 바꿈)', () => {
  const P = C.artoria.ai.persona;
  assert.deepEqual(P.level, { reaction: 0.26, guardChance: 0.7, counter: 0.35, feint: 0.2, followUp: 0.42, read: 0.75, discipline: 0.88, strength: 1, aggression: 0.8, windup: 0.7, skill: 0.82 });
  assert.deepEqual(P.pers, { precision: 0.85, guardStick: 2.5, fearful: 0.2, angry: 0.2, dogged: 0.45, guardSpeed: 0.85, rhythm: 2.6, margin: 0.22, aggr: 0.85, vor: 0.45, patienceTime: 4.5, circleRate: 0.22,
    guardPref: { tagR: 1.6, pflugR: 1.5, ochsR: 1.1, langort: 1.2 }, techPref: { zornhau: 1.5, oberhau: 1.25, zornhauL: 1.2, stichPflug: 1.1 } });
});

test('셋은 서로 다른 기질 · 숙련도 · 칭호는 그대로', () => {
  const [a, r, b] = ['artoria', 'roland', 'bernardo'].map((id) => C[id].ai.persona);
  for (const [x, y, w] of [[a, r, '아르토리아 · 롤랑'], [a, b, '아르토리아 · 베르나르도'], [r, b, '롤랑 · 베르나르도']]) {
    assert.notDeepEqual(x.level, y.level, `${w} level`);
    assert.notDeepEqual(x.pers, y.pers, `${w} pers`);
  }
  assert.ok(r.pers.margin > a.pers.margin && a.pers.margin > b.pers.margin, '간격: 롤랑 > 아르토리아 > 베르나르도');
  assert.ok(b.pers.aggr * b.level.aggression > r.pers.aggr * r.level.aggression, '베르나르도가 먼저 들어간다');
  assert.equal(C.roland.ai.proficiency, 6);
  assert.equal(C.bernardo.ai.proficiency, 6);
  for (const id of ['artoria', 'roland', 'bernardo']) assert.equal(C[id].epithet, '왕');
});

test('싱지르 걸쇠의 발: 롤랑 기다림(기본) · 베르나르도 걸어 들어감 · 다른 AI 는 기본 그대로', () => {
  const aiOf = (id) => newRound({ seed: 3, weapon: 'longsword', weapon2: C[id].weapon, difficulty: C[id].ai.level, persona: C[id].ai.persona, AI2Class: AI }).ai;
  assert.equal(aiOf('roland').pers.spinHold, true);
  assert.equal(aiOf('bernardo').pers.spinHold, false);
  assert.ok(aiOf('roland').spinArm && aiOf('bernardo').spinArm, '둘 다 싱지르를 쓴다 (이베리아 숙련도 6)');
  assert.equal(newRound({ seed: 3, weapon: 'longsword', difficulty: 'normal' }).ai.pers.spinHold, true);
});
