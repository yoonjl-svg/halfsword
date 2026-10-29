// 숙련도 상한 6 · 숙련도 6 버티는 힘 · 시트 무기 (사장님 10/29 22:4x · 22:5x — docs/decisions.md 같은 때)
//  node --test tools/sim/prof6.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROFICIENCY, PROF6_VITALITY } from '../../src/config.js';
import { CHARACTERS_BY_ID as C } from '../../src/characters.js';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';

const all = Object.values(C);

test("상한 6 · 숙련도 표마다 6 칸 ('상한 6으로 올려')", () => {
  assert.equal(AI_PROFICIENCY.max, 6);
  for (const k of ['levels', 'schoolK', 'reaction']) assert.ok(AI_PROFICIENCY[k][6] != null, k);
});

test('얼터 = 원본 +1 (상한 6) · 광기의 병마용만 5 로 못 박음', () => {
  for (const c of all.filter((x) => x.variantOf)) {
    const want = c.proficiencyFixed ?? Math.min(6, C[c.variantOf].ai.proficiency + 1);
    assert.equal(c.ai.proficiency, want, c.id);
  }
  assert.equal(C.terracotta_mad.ai.proficiency, 5);
  for (const [id, p] of [['artoria', 6], ['artoria_mad', 6], ['minami', 5], ['minami_mad', 6], ['omari', 2], ['omari_mad', 3], ['samira', 4], ['samira_mad', 5]]) assert.equal(C[id].ai.proficiency, p, id);
});

test('숙련도 표의 열쇠 = 실제로 싸우는 유파 (광기의 마야 = 세이버 독일 5 · 마야 = 무유파 4)', () => {
  assert.deepEqual(C.samira.ai.persona.proficiency, { none: 4 });
  assert.deepEqual(C.samira_mad.ai.persona.proficiency, { german: 5 });
  assert.deepEqual(C.omari.ai.persona.proficiency, { iberian: 2 });
  assert.deepEqual(C.artoria.ai.persona.proficiency, { german: 6 });
});

test('숙련도 6 이면 버티는 힘 1.1 — 규칙 한 곳 (롤랑 · 베르나르도 · 아르토리아 · 광기의 아르토리아 · 광기의 미나미)', () => {
  assert.equal(PROF6_VITALITY, 1.1);
  const six = all.filter((c) => c.ai?.proficiency === 6).map((c) => c.id).sort();
  assert.deepEqual(six, ['artoria', 'artoria_mad', 'bernardo', 'minami_mad', 'roland']);
  for (const c of all) assert.equal(c.vitality ?? 1, c.ai?.proficiency === 6 ? PROF6_VITALITY : 1, c.id);
});

test('시트 무기: 미나미 쿠사나기 · 광기의 미나미 무라마사 · 다라이시 우치가타나 · 광기의 다라이시 모노호시자오 — 모두 일본 · 꾸러미 = 무기', () => {
  for (const [id, w] of [['minami', 'kusanagi'], ['minami_mad', 'muramasa'], ['silver_wanderer', 'uchigatana'], ['silver_wanderer_mad', 'monohoshizao']]) {
    assert.equal(C[id].weapon, w, id);
    assert.equal(C[id].ai.persona.school, w, `${id} 꾸러미`);
    assert.equal(traditionOf(WEAPONS[w]), 'japanese', `${id} 유파`);
    assert.deepEqual(Object.keys(C[id].ai.persona.proficiency), ['japanese'], id);
  }
});

test("무기와 어긋나던 글 · 겉모습 (사장님 10/30 00:4x '… 최소 수정으로 모순만 덜어내는 방식으로 고쳐')", () => {
  for (const id of ['minami', 'minami_mad']) assert.ok(C[id].lines.losing.includes('칼이 짧아서가 아니에요. 제가 서툴러서예요.'), id);
  assert.ok(C.silver_wanderer.school.startsWith('기존 우치가타나와') && C.silver_wanderer_mad.school.startsWith('기존 모노호시자오와'));
  assert.ok(!C.silver_wanderer.backstory.includes('긴 칼'));
  assert.equal(C.silver_wanderer.look.daraishiScabbardLen, 0.75);
  assert.equal(C.silver_wanderer_mad.look.daraishiScabbardLen, undefined, '광기의 다라이시 검집 0.94 그대로');
  const madText = ['school', 'signatureMoves', 'favoriteGuards', 'movementNotes', 'weaknesses'].map((k) => C.samira_mad[k]).join(' ');
  assert.ok(!/리볼버|총구|장전|사격/.test(madText), madText);
  assert.ok(C.samira.school.includes('리볼버'), '낮의 마야 글 그대로');
});
