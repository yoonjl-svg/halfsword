// 생사전 인물 · 무기 자료 (src/saengsa_rules.js 에 넘기는 쪽 — 순수 규칙은 자료를 모른다)
//  로스터 = 주 인물(characters.js CHARACTERS) 가운데 방랑 전용(wander_rules.js WANDER_EXCLUSIVE — 아르토리아)을 뺀 열하나 · 얼터 · 손님 인물은 넣지 않는다 (감독 10/29).
//  무기 = 무작위(사장님 10/29 14:1x 요지 — 무기는 캐릭터에게 무작위로 배정) — 카드 뽑기와 같은 목록 · 같은 등급 확률(weapons.js TIER_DRAW · drawWeaponCards — 칸 하나) · 씨앗 난수.
//   내 무기를 빌려 주면 그 사람은 늘 그 무기(사장님 10/29 14:1x 요지 — 내 무기를 장착시킨 캐릭터는 늘 그 무기로 출전) — 내 무기 = 대기실 아이템 칸 무기(lobby_equipment.js LOBBY_ITEMS).
//  숙련도: 인물 = saengsa_proficiency.js proficiencyOf(character_temperament.js 표) · 무명 검객 = SAENGSA.nameless.prof · 나 = 스킬트리 — 그 유파에서 익힌 칸 가운데 가장 높은 급
//   (보법 1 · 막기 2 · 고유 공격 · 심화 3 · 패시브 4 · 비기 5 — skill_tree_data.js NODE_CAT stage · 확인표 2792) · 무유파 무기는 빠른 셈 규칙(saengsa_rules.js profFor)
//  고용 금화 (사장님 10/29 14:5x '동료를 고용할 때 금화를 내는 걸로' · 15:5x '고용비는 그대로 둬'): SAENGSA.hire.base + step × 가장 높은 숙련도 ·
//   무명 검객 = SAENGSA.nameless.hire (15:5x '무명 검객은 고용비 20') — 특별 동료(특별한 증표로 고용 — 나중)는 { token } 자리만
import { SAENGSA } from './config.js';
import { CHARACTERS, CHARACTERS_BY_ID } from './characters.js';
import { WANDER_EXCLUSIVE } from './wander_rules.js';
import { WEAPON_LIST, RETIRED_WEAPONS, getWeapon, drawWeaponCards } from './weapons.js';
import { traditionOf } from './schools.js';
import { portraitSrc } from './portraits.js';
import { readLearned } from './skill_tree_store.js';
import { NODE_CAT, TREE_SCHOOLS, nodeOf } from './skill_tree_data.js';
import { LOBBY_ITEMS } from './lobby_equipment.js';
import { readProfile } from './player_profile.js';
import { proficiencyOf, PROF_SCHOOLS } from './saengsa_proficiency.js';
import { NAMELESS } from './saengsa_rules.js';
import { namelessFace } from './saengsa_nameless.js';
import { SAENGSA_TEXT, CLOTH_KO } from './saengsa_text.js';

/** 생사전 로스터 (동료 고르기 · 상대 팀) */
export const SAENGSA_ROSTER = Object.freeze(CHARACTERS.filter((c) => !WANDER_EXCLUSIVE.includes(c.id)).map((c) => c.id));
/** 동료 고르기 칸 = 로스터 + 무명 검객(맨 끝 — 둘 다 무명 검객이어도 됨) */
export const HIRE_ROSTER = Object.freeze([...SAENGSA_ROSTER, NAMELESS]);
/** 특별 동료 (특별한 증표로 고용 — 사장님 10/29 14:5x 말씀만 · 아직 없음): { id, token } 줄이 생기면 고르기 칸 · hireCostOf 가 읽는다 */
export const SPECIAL_COMPANIONS = Object.freeze([]);
/** 무작위 무기 목록 = 카드 뽑기 목록 (main.js PLAYER_WEAPON_POOL 과 같은 거름 — 엑스칼리버 복제품 · 빼 둔 무기 · 인물 전용 뺌) */
export const SAENGSA_WEAPONS = Object.freeze(WEAPON_LIST.filter((w) => w.id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(w.id) && !w.characterOnly).map((w) => w.id));
/** 씨앗 난수로 무기 하나 (등급 먼저 — TIER_DRAW) */
export const drawWeapon = (rnd) => drawWeaponCards([...SAENGSA_WEAPONS], 1, { rnd })[0];
/** 무기 → { school, tier } (규칙의 빠른 셈 · 카드) */
export function weaponInfo(id) {
  const w = getWeapon(id);
  return { school: traditionOf(w), tier: w.tier };
}
/** 내 무기 (빌려 줄 수 있는 것 — 대기실 아이템 칸 무기) */
export const ownedWeapons = () => [...LOBBY_ITEMS];

/** 내 숙련도 (스킬트리) */
export function playerProficiency(learned = readLearned()) {
  const out = Object.fromEntries(PROF_SCHOOLS.map((s) => [s, 0]));
  for (const s of TREE_SCHOOLS) {
    for (const id of learned[s] ?? []) out[s] = Math.max(out[s], NODE_CAT[nodeOf(s, id)?.cat]?.stage ?? 0);
  }
  return out;
}
/** 인물(또는 'player') → 숙련도 */
export const profOf = (id) => (id === 'player' ? playerProficiency() : proficiencyOf(id));
/** 고용 값: { coins } (특별 동료면 { token }) */
export function hireCostOf(id) {
  const special = SPECIAL_COMPANIONS.find((c) => c.id === id);
  if (special) return { token: special.token };
  if (id === NAMELESS) return { coins: SAENGSA.nameless.hire };
  const best = Math.max(...Object.values(proficiencyOf(id)));
  return { coins: SAENGSA.hire.base + SAENGSA.hire.step * best };
}
/** 화면 이름 (나 = 대기실 이름) */
export const nameOf = (id) => (id === 'player' ? readProfile().name : id === NAMELESS ? SAENGSA_TEXT.nameless : CHARACTERS_BY_ID[id]?.name ?? id);
/** 화면 읽기 이름 (무명 검객은 옷 색까지 — 한 팀에 둘 이상일 때 가름) */
export const spokenName = (id, cloth) => (id === NAMELESS ? `${SAENGSA_TEXT.nameless} · ${CLOTH_KO[cloth] ?? ''}` : nameOf(id));
/** 프로필 그림 주소 (무명 검객 = 광기의 브론 그림의 옷 칸만 그 옷 색 — saengsa_nameless.js · 칠하기 전이면 광기의 브론 그림) */
export const portraitOf = (id, cloth = 0) => (id === NAMELESS ? namelessFace(cloth) : portraitSrc(id) ?? portraitSrc('player'));
/** 무기 이름 큰 줄 (괄호 앞 — '츠바이핸더 (대형 양손검)' → '츠바이핸더') */
export const weaponName = (id) => getWeapon(id).nameKo.replace(/\s*\(.*\)\s*$/, '');
/** 무기 그림 주소 */
export const weaponThumb = (id) => `ui/weapons/${getWeapon(id).id}.webp`;
/** 규칙에 넘길 자료 묶음 */
export const SAENGSA_DATA = Object.freeze({ roster: SAENGSA_ROSTER, drawWeapon, weaponInfo, profOf });
