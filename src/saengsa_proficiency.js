// 생사전 숙련도 — 자리 표 하나 (사장님 10/29 14:1x 요지 — 모든 캐릭터는 주 유파만이 아니라 유파마다 숙련도가 있다).
//  인물별 다섯 유파 숙련도 · 전투 성향의 진짜 표는 따로 들어온다(인물 성향 작업 — src/character_temperament.js). 합칠 때 아래 proficiencyOf 한 함수만 그 표로 바꾼다.
//  지금 자리 값 = 인물 시트 숙련도(characters.js ai.proficiency — 시트 무기의 유파)에서 셈: 자기 유파 그대로 · 다른 유파 = 시트 − OTHER · 무유파 무기(none) = 시트 − NONE (0 아래 없음) ·
//   무유파 인물(마야 · 김씨 · 브론)은 none 이 시트 그대로 · 검술을 배우지 못한 브론(noSwordsmanship)은 다섯 유파 0. 표 전체 사장님 확인 전 (확인표 2791)
import { CHARACTERS_BY_ID } from './characters.js';
import { WEAPONS } from './weapons.js';
import { traditionOf } from './schools.js';

/** 숙련도 칸 — 다섯 유파 + 무유파 무기(none) */
export const PROF_SCHOOLS = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese', 'none']);
const OTHER = 2, NONE = 1; // 자리 값 규칙 (위 · 확인표 2791)

/** 인물 id → { german, italian, iberian, japanese, chinese, none } (모르는 인물은 모두 0) */
export function proficiencyOf(id) {
  const c = CHARACTERS_BY_ID[id];
  const out = Object.fromEntries(PROF_SCHOOLS.map((s) => [s, 0]));
  if (!c) return out;
  const p = c.ai?.proficiency ?? 0, main = traditionOf(WEAPONS[c.weapon]);
  for (const s of PROF_SCHOOLS) {
    if (s === main) out[s] = p;
    else if (s === 'none') out[s] = Math.max(0, p - NONE);
    else out[s] = c.noSwordsmanship ? 0 : Math.max(0, p - OTHER);
  }
  return out;
}
