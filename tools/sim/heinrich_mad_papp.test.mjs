// 광기의 하인리히 파펜하이머 · 투야나 숙련도 3 시험 (사장님 10/25 18:5x — docs/decisions.md 10/25 18:5x · 확인표 2547 ~ 2550)
//  ① "파펜하이머 들어오면 광기의 하인리히가 파펜하이머를 들고 이탈리아 유파로 싸우게 해." — 시트 무기 · 숙련도 표 · AI 꾸러미 · 간격 · 고유 동작 · 낮의 하인리히 그대로
//  ② "투야나 숙련도 1 올려. 광기의 투야나도 자동으로 1 오르게 됨." — 2 → 3 · 얼터 4(따로 적지 않음)
//  ③ 시트 무기가 바뀐 뒤의 옛 저장(여정 이어하기 · 방랑 진행 판) → 지금 시트 무기
//  node --test tools/sim/heinrich_mad_papp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS_BY_ID, savedFoeWeapon } from '../../src/characters.js';
import { schoolOf } from '../../src/schools.js';
import { AI_PROFICIENCY, SCHOOL_PASSIVE } from '../../src/config.js';
import { newRound, AI } from './harness_m.mjs';

const C = CHARACTERS_BY_ID;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
/** 인물을 상대 자리(enemy)에 세운 AI — 롱소드 AI 와 맞붙임 */
const aiOf = (id) => {
  const c = C[id];
  const G = newRound({ seed: 3, weapon: 'longsword', weapon2: c.weapon, difficulty: c.ai.level, persona: c.ai.persona, AI2Class: AI });
  return { G, ai: G.ai };
};

test('광기의 하인리히: 파펜하이머 · 이탈리아 숙련도 3(원본 2 + 1) · 실력 숫자 hard · 꾸러미 = 무기 id 꾸러미', () => {
  const m = C.heinrich_mad;
  assert.equal(m.weapon, 'pappenheimer');
  assert.equal(m.ai.proficiency, 3);
  assert.equal(m.ai.level, AI_PROFICIENCY.levels[3]);
  assert.equal(m.ai.persona.school, 'pappenheimer');
  assert.deepEqual(m.ai.persona.proficiency, { italian: 3 });
  // 실력 숫자 +20 % 는 무기와 상관없이 그대로 (낮의 하인리히 시트 위)
  near(m.ai.persona.level.reaction, 0.175);
  near(m.ai.persona.level.strength, 1.38);
  near(m.ai.persona.level.strikeSpeed, 15.6);
  // 성격 · 목소리는 낮의 하인리히 그대로 · 대사는 광기의 하인리히 1종씩 그대로
  assert.deepEqual(m.ai.persona.pers, C.heinrich.ai.persona.pers);
  assert.equal(m.voice, C.heinrich.voice);
  assert.deepEqual(m.lines, { intro: ['무릎은 필요 없다. 목만.'], win: ['…이제 파도 소리가 들리는군.'] });
});

test('낮의 하인리히는 그대로: 엑스칼리버 복제품 · 독일 숙련도 2 · 복제품 꾸러미', () => {
  const h = C.heinrich;
  assert.equal(h.weapon, 'excalibur_replica');
  assert.equal(h.ai.proficiency, 2);
  assert.equal(h.ai.level, 'normal');
  assert.equal(h.ai.persona.school, 'excalibur_replica');
  assert.deepEqual(h.ai.persona.proficiency, { german: 2 });
});

test('광기의 하인리히 AI: 이탈리아 자세 · 기술 · 파펜하이머 실측 간격 · 고유 동작 셋 · 패시브 칸 · 비기 없음', () => {
  const { G, ai } = aiOf('heinrich_mad');
  assert.equal(G.enemy.weapon.id, 'pappenheimer');
  assert.equal(ai.art.tradition, 'italian');
  assert.equal(ai.school.id, 'pappenheimer');
  assert.equal(ai.proficiency, 3);
  const M = schoolOf('pappenheimer').measure;
  for (const k of ['contact', 'reach', 'clinch', 'cutTime']) near(ai.art.measure[k], M[k]); // 꾸러미 간격 = 파펜하이머 실측 그대로 (AI 가 쓰는 ai.M 은 여기에 R2′ 묶음 보정 BODY.r2pAiContact 를 더함)
  assert.ok(Math.abs(M.contact - 1.51) < 1e-9 && Math.abs(M.reach - 1.66) < 1e-9); // weapon_measured.js MEASURED.pappenheimer (확인표 2531)
  assert.deepEqual(ai.school.guards.map((g) => g.name), ['pflugR', 'langort', 'pflugL', 'ochsR', 'tag']); // 이탈리아 간 보는 자세 (3번 · 뻗은 3번 · 4번 · 2번 · 1번)
  for (const n of ['inquartata', 'imbroccata', '칼끝 돌려 빼기 (카바치오네)']) assert.ok(ai.uniqueByName.has(n), n);
  assert.ok(ai.proficiency < SCHOOL_PASSIVE.at); // 패시브 칸(곧은 선)은 4 부터
  assert.equal(ai.secret, null); // 비기는 5 에서만
  G.world.free();
});

test('투야나 숙련도 3(사장님 10/25) · 광기의 투야나 4(얼터 규칙 — 따로 적지 않음)', () => {
  const t = C.eira, tm = C.eira_mad;
  assert.equal(t.weapon, 'rapier');
  assert.equal(t.ai.proficiency, 3);
  assert.equal(t.ai.level, 'hard');
  assert.deepEqual(t.ai.persona.proficiency, { italian: 3 });
  assert.equal(tm.ai.proficiency, 4);
  assert.equal(tm.ai.level, 'hard');
  assert.deepEqual(tm.ai.persona.proficiency, { italian: 4 });
  assert.ok(tm.appearanceOnly);
  assert.deepEqual(tm.ai.persona.level, t.ai.persona.level); // 외양만 얼터 — 실력 숫자 +20 % 없음
  const a = aiOf('eira').ai, b = aiOf('eira_mad').ai;
  assert.ok(a.uniqueByName.has('칼끝 돌려 빼기 (카바치오네)')); // 3 에서 열림 (2 = 비껴서며 찌르기 · 위에서 내려 찌르기)
  assert.ok(a.proficiency < SCHOOL_PASSIVE.at && b.proficiency >= SCHOOL_PASSIVE.at); // 얼터만 패시브 칸(곧은 선)
  assert.equal(b.secret, null);
});

test('옛 저장의 상대 무기: 시트 무기가 바뀌었으면 지금 시트 무기 · 대체 무기가 있는 인물 · 같은 무기는 그대로', () => {
  assert.equal(savedFoeWeapon(C.heinrich_mad, 'excalibur_replica'), 'pappenheimer');
  assert.equal(savedFoeWeapon(C.heinrich_mad, 'pappenheimer'), 'pappenheimer');
  assert.equal(savedFoeWeapon(C.heinrich, 'excalibur_replica'), 'excalibur_replica');
  assert.equal(savedFoeWeapon(C.bran, 'falchion'), 'falchion'); // 주워 온 칼 (weaponAlt)
  assert.equal(savedFoeWeapon(undefined, 'longsword'), 'longsword');
});
