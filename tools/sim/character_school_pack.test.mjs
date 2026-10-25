// 인물 시트 무기의 유파 = AI 유파 꾸러미(persona.school)의 유파 (10/25 — 얼터 브론이 팔쉬온을 들고도 나뭇가지 꾸러미(무유파)로 싸우던 것을 잡음)
//  persona.school 을 둔 모든 인물(본 · 얼터 · 손님)에서 schoolOf(persona.school).tradition === traditionOf(시트 무기). persona.school 이 없으면 무기 꾸러미를 쓰므로 건너뜀
import test from 'node:test';
import assert from 'node:assert/strict';
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { schoolOf, traditionOf } = await import('../../src/schools.js');
const { WEAPONS, getWeapon } = await import('../../src/weapons.js');

test('인물 시트 무기 유파 = AI 유파 꾸러미 유파', () => {
  const bad = [];
  for (const [id, c] of Object.entries(CHARACTERS_BY_ID)) {
    const ps = c.ai?.persona?.school;
    if (!ps) continue;
    const w = WEAPONS[c.weapon] ?? getWeapon(c.weapon);
    const a = schoolOf(ps).tradition, b = traditionOf(w);
    if (a !== b) bad.push(`${id}: 무기 ${c.weapon}(${b}) · 꾸러미 ${ps}(${a})`);
  }
  assert.deepEqual(bad, []);
});

test('얼터 브론 = 팔쉬온 · 독일 꾸러미', () => {
  const b = CHARACTERS_BY_ID.bran_mad;
  assert.equal(b.weapon, 'falchion');
  assert.equal(b.ai.persona.school, 'falchion');
  assert.equal(CHARACTERS_BY_ID.bran.ai.persona.school, 'tree_branch'); // 본 브론 시트는 그대로
});
