// 이번 이식의 범위 감사용. 뒤의 정상 개발까지 옛 인물/무기 표에 묶는 상시 테스트가 아니다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS } from '../../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
const old = JSON.parse(fs.readFileSync(new URL('./before/specs.json', import.meta.url)));
let checked = 0;
for (const [id, v] of Object.entries(old.weapons)) if (id !== 'chixiao') {
  assert.deepEqual(JSON.parse(JSON.stringify({ ...WEAPONS[id], parts: WEAPONS[id].buildParts({ grip: 0x888888, hilt: 0x888888 }) })), v, id);
  checked++;
}
assert.deepEqual(JSON.parse(JSON.stringify(CHARACTERS_BY_ID)), old.characters);
const result = { baseline: 'f489e3088ee4f754bded7e7aab9264109dfbda3c', existingWeaponsUnchanged: checked, charactersUnchanged: true };
fs.writeFileSync(new URL('./results/scope.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
