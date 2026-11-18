// 생사전 인물 · 무기 자료 (src/saengsa_rules.js 에 넘기는 쪽 — 순수 규칙은 자료를 모른다)
//  로스터 = 그림이 있는 모든 인물(characters.js CHARACTERS_BY_ID · portraits.js PORTRAIT_IDS) — 주 인물 · 아르토리아 · 방랑 인물 · 손님(롤랑 · 베르나르도 · 백린의 전사) · 얼터(광기의 …)
//   (사장님 10/29 22:3x — 롤랑 · 베르나르도 · 아르토리아 · 얼터도 생사전 인물 · 기본 인물과 얼터는 다른 사람 · 감독 전달). 한 대회에 한 사람 한 번씩 (전: 주 인물에서 아르토리아를 뺀 열하나).
//  무기: 내 팀 세 사람 = 내가 가진 무기에서 배정(사장님 10/29 18:2x '무기는 랜덤 뽑기가 아니라 플레이어가 배정해 주는거야' — 경기마다 · 11/18 신청 때 배정은 걷음) — 가진 무기 = owned_weapons.js ownedWeapons(상점이 채울 자리).
//   고르기 카드 참고(11/18): 인물의 유파(hireSchoolOf — 숙련도가 가장 높은 유파) · 가진 무기를 유파마다(ownedBySchool) — 생사전에서 사람은 든 무기 유파의 숙련도로 싸운다(main.js teamAiOf · 빠른 셈 profFor)
//   상대 팀 = 팀마다 무기 아홉(사장님 11/19 '9개로 하자' · 전 다섯 10/29 19:5x — 11/19 무작위만 · 카드 뽑기와 같은 목록 · 같은 등급 확률에서 ??? 를 뺀 표 · 서로 다르게 · 씨앗 난수 — drawPool · signatureOf) → AI 가 나눠 줌(saengsa_rules.js aiArm).
//   전용무기 = 표 SAENGSA.signature (사장님 10/29 22:3x — 인물 하나에 하나 · 기본 인물과 얼터를 가름 · 생사전에서만) — 무명 검객은 없음.
//  입장 조건(18:2x): 호칭 SAENGSA.entry.title(정복자) + 가진 무기 SAENGSA.entry.weapons 개 — entryState
//  숙련도: 인물 = saengsa_proficiency.js proficiencyOf(character_temperament.js 표) · 무명 검객 = 대회마다 새로(saengsa_rules.js makeNameless — 사장님 10/29 18:2x) ·
//   나 = 스킬트리 — 그 유파에서 익힌 칸 수로(11/16 사장님 '사람 셈도 문턱 기준으로 바꿔' — 5 · 7 · 9 · 11 칸 · 전 10/29 17:5x · 18:1x — config SAENGSA.playerProf · 확인표 2792 · 4599 ~) · 무유파 무기는 빠른 셈 규칙(saengsa_rules.js profFor)
//  고용 금화 (사장님 10/29 14:5x '동료를 고용할 때 금화를 내는 걸로' · 15:5x '고용비는 그대로 둬'): SAENGSA.hire.base + step × 가장 높은 숙련도 ·
//   무명 검객 = SAENGSA.nameless.hire (15:5x '무명 검객은 고용비 20') — 특별 동료(특별한 증표로 고용 — 나중)는 { token } 자리만
import { SAENGSA } from './config.js';
import { CHARACTERS_BY_ID } from './characters.js';
import { WEAPON_LIST, RETIRED_WEAPONS, getWeapon, drawWeaponCards, TIER_DRAW, BREAK } from './weapons.js';
import { traditionOf, schoolOf } from './schools.js';
import { portraitSrc, PORTRAIT_IDS } from './portraits.js';
import { playerProficiency } from './skill_tree_store.js';
import { ownedWeapons } from './owned_weapons.js';
import { readProgress } from './lobby_progress.js';
import { readProfile } from './player_profile.js';
import { proficiencyOf } from './saengsa_proficiency.js';
import { NAMELESS, entryMissing } from './saengsa_rules.js';
import { namelessFace } from './saengsa_nameless.js';
import { SAENGSA_TEXT, CLOTH_KO } from './saengsa_text.js';

/** 생사전 로스터 (동료 고르기 · 상대 팀) */
export const SAENGSA_ROSTER = Object.freeze(Object.keys(CHARACTERS_BY_ID).filter((id) => PORTRAIT_IDS.includes(id)));
/** 동료 고르기 칸 = 로스터 + 무명 검객(맨 끝 — 둘 다 무명 검객이어도 됨) */
export const HIRE_ROSTER = Object.freeze([...SAENGSA_ROSTER, NAMELESS]);
/** 특별 동료 (특별한 증표로 고용 — 사장님 10/29 14:5x 말씀만 · 아직 없음): { id, token } 줄이 생기면 고르기 칸 · hireCostOf 가 읽는다 */
export const SPECIAL_COMPANIONS = Object.freeze([]);
/** 무작위 무기 목록 = 카드 뽑기 목록 (main.js PLAYER_WEAPON_POOL 과 같은 거름 — 엑스칼리버 복제품 · 빼 둔 무기 · 인물 전용 뺌) */
export const SAENGSA_WEAPONS = Object.freeze(WEAPON_LIST.filter((w) => w.id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(w.id) && !w.characterOnly).map((w) => w.id));
/** 씨앗 난수로 무기 하나 (등급 먼저 — TIER_DRAW) */
export const drawWeapon = (rnd) => drawWeaponCards([...SAENGSA_WEAPONS], 1, { rnd })[0];
/** 상대 팀 무기 뽑기 확률 = 카드 뽑기 TIER_DRAW 에서 SAENGSA.aiPool.excludeTiers(???) 를 0 으로 (남은 등급끼리 비율 — drawWeaponCards 가 0 인 등급을 건너뜀) */
export const AI_TIER_DRAW = Object.freeze(Object.fromEntries(Object.entries(TIER_DRAW).map(([t, w]) => [t, SAENGSA.aiPool.excludeTiers.includes(t) ? 0 : w])));
/** 상대 팀 무기 n 개 (서로 다르게 · taken 은 뺌 — 전용무기) */
export const drawPool = (rnd, n, taken = []) => drawWeaponCards(SAENGSA_WEAPONS.filter((id) => !taken.includes(id)), n, { rnd, tierDraw: AI_TIER_DRAW });
/** 전용무기 (사장님 10/29 22:3x 표 — SAENGSA.signature): 그 인물의 전용무기 id · 없으면 null (무명 검객 · 나 · 표에 없는 인물) */
export const signatureOf = (id) => SAENGSA.signature[id] ?? null;
/** 무기 → { school, tier, frag } (규칙의 빠른 셈 · 카드) · frag = 무거운 충돌 한 번에 부러질 확률(weapons.js breakChance(BREAK.jRef) — 등급표 · 재질 · 무기 고유 값) */
export function weaponInfo(id) {
  const w = getWeapon(id);
  return { school: traditionOf(w), tier: w.tier, frag: typeof w.breakChance === 'function' ? w.breakChance(BREAK.jRef) : 0 };
}
/** 가진 무기 (배정할 수 있는 것 — owned_weapons.js) */
export { ownedWeapons };
/** 유파 차례 (가진 무기 묶음 · 카드) */
export const SCHOOL_ORDER = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese', 'none']);
/** 가진 무기를 유파마다 { 유파: [무기 id] } — SCHOOL_ORDER 차례 · 무기가 없는 유파는 뺌 · 유파 안은 가진 차례 */
export function ownedBySchool(owned = ownedWeapons()) {
  const out = {};
  for (const s of SCHOOL_ORDER) {
    const list = owned.filter((w) => weaponInfo(w).school === s);
    if (list.length) out[s] = list;
  }
  return out;
}
/** 인물의 본 유파 (characters.js aiAtProficiency 와 같은 규칙: 꾸러미 persona.school 의 유파 → 없으면 시트 무기의 유파 · 'none' = 무유파) · 모르는 인물 = null */
function mainSchoolOf(id) {
  const c = CHARACTERS_BY_ID[id];
  if (!c) return null;
  const pack = c.ai?.persona?.school;
  return pack != null ? schoolOf(pack).tradition : traditionOf(getWeapon(c.weapon));
}
/**
 * 고르기 카드에 보일 유파 (11/18) = 숙련도가 가장 높은 유파 · 같으면 본 유파 — 생사전에서 그 인물은 든 무기 유파의 숙련도로 싸우므로 이 유파 무기를 주면 가장 잘 싸운다.
 *  지금 표에서는 본 유파와 같다(광기의 브론만 독일 1 > 무유파 0 → 독일). 무명 검객(유파가 대회마다 정해짐 — saengsa_rules.js makeNameless) · 나 · 모르는 인물 = null
 */
export function hireSchoolOf(id) {
  const main = mainSchoolOf(id);
  if (!main) return null;
  const p = proficiencyOf(id);
  let best = main;
  for (const s of SCHOOL_ORDER) if ((p[s] ?? -1) > (p[best] ?? 0)) best = s;
  return best;
}
/** 입장 호칭을 가졌나 (SAENGSA.entry.title 사건 — 정복자) */
export const hasEntryTitle = (progress = readProgress()) => progress.titles.some((t) => t.event === SAENGSA.entry.title);
/** 입장 조건 { missing: [모자란 것], owned: [가진 무기], hasTitle } (saengsa_rules.js entryMissing) */
export function entryState() {
  const progress = readProgress(), owned = ownedWeapons(progress), hasTitle = hasEntryTitle(progress);
  return { missing: entryMissing({ hasTitle, owned: owned.length }), owned, hasTitle };
}

/** 내 숙련도 (유파마다 익힌 칸 수 문턱 — 11/17 skill_tree_store.js 로 옮김 · 판의 몸 값과 함께 씀) */
export { playerProficiency };
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
/** 대회 속 사람 이름 (무명 검객 = '무명 검객 <붙인 이름>' — 사장님 10/29 17:5x · 붙인 이름이 없으면 옷 색으로) */
export const fighterName = (f) => (f?.id === NAMELESS ? (f.tag ? `${SAENGSA_TEXT.nameless} ${f.tag}` : spokenName(NAMELESS, f.cloth)) : nameOf(f?.id));
/** 프로필 그림 주소 (무명 검객 = 광기의 브론 그림의 옷 칸만 그 옷 색 — saengsa_nameless.js · 칠하기 전이면 광기의 브론 그림) */
export const portraitOf = (id, cloth = 0) => (id === NAMELESS ? namelessFace(cloth) : portraitSrc(id) ?? portraitSrc('player'));
/** 무기 이름 큰 줄 (괄호 앞 — '츠바이핸더 (대형 양손검)' → '츠바이핸더') */
export const weaponName = (id) => getWeapon(id).nameKo.replace(/\s*\(.*\)\s*$/, '');
/** 무기 그림 주소 */
export const weaponThumb = (id) => `ui/weapons/${getWeapon(id).id}.webp`;
/** 규칙에 넘길 자료 묶음 */
export const SAENGSA_DATA = Object.freeze({ roster: SAENGSA_ROSTER, drawWeapon, drawPool, signatureOf, weaponInfo, profOf });
