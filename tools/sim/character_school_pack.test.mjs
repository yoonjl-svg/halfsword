// 인물 시트 무기의 유파 = AI 유파 꾸러미(persona.school)의 유파 — 단, 광기의 브론은 예외 (사장님 10/25 20:0x)
//  브론은 화전민 — 검술을 배우지 못한 대신 힘이 매우 세다. 팔쉬온을 들어도 무유파(나뭇가지 꾸러미 'tree_branch')로 싸우는 것이 조율된 설정이다.
//  persona.school 이 없으면 무기 꾸러미를 쓰므로 건너뜀
import test from 'node:test';
import assert from 'node:assert/strict';
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { schoolOf, traditionOf } = await import('../../src/schools.js');
const { WEAPONS, getWeapon } = await import('../../src/weapons.js');

const NO_SCHOOL = new Set(['bran_mad']); // 사장님 10/25 20:0x — 검술을 배우지 못함

test('인물 시트 무기 유파 = AI 유파 꾸러미 유파 (광기의 브론 빼고)', () => {
  const bad = [];
  for (const [id, c] of Object.entries(CHARACTERS_BY_ID)) {
    if (NO_SCHOOL.has(id)) continue;
    const ps = c.ai?.persona?.school;
    if (!ps) continue;
    const w = WEAPONS[c.weapon] ?? getWeapon(c.weapon);
    const a = schoolOf(ps).tradition, b = traditionOf(w);
    if (a !== b) bad.push(`${id}: 무기 ${c.weapon}(${b}) · 꾸러미 ${ps}(${a})`);
  }
  assert.deepEqual(bad, []);
});

test('광기의 브론 = 팔쉬온을 들되 무유파 (사장님 10/25 20:0x)', () => {
  const b = CHARACTERS_BY_ID.bran_mad;
  assert.equal(b.weapon, 'falchion');
  assert.equal(b.ai.persona.school, 'tree_branch');
  assert.equal(schoolOf(b.ai.persona.school).tradition, 'none');
});
