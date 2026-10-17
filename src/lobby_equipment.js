// 대기실 장착 (샛별 저장소 b73a9c82 · 3b280a1b — docs/import/lobby_port_2026-10-16.md · 고친 것 docs/import/lobby_fix_2026-10-16.md).
//  사장님 10/16 03:5x '장착하면 실제 전투에 가져나가게 해': 첫 화면·대기실에서 연 여정은 이 장착으로 싸운다 (main.js journeyLoadout) —
//   무기를 장착했으면 무대마다 카드 없이 그 무기 · 안 했으면 지금처럼 카드 / 케틀 햇을 장착했으면 투구(머리 방어)와 '생존술: 기력 +30', 벗으면 맨머리.
//   주소로 무대·상대·무기를 고정한 판 · 테스트 경로 · 옛 메뉴 판은 지금 그대로.
//  무기 칸: 나뭇가지 하나 (사장님 10/16 01:0x '무기에 롱소드는 삭제') — 설명 카드는 우리 무기 자료(weapons.js nameKo · desc · tier)를 lobby.js 가 읽는다.
//  방어구 칸: 둘 — 케틀 햇(머리 · 플레이어 겉모습의 머리 장비 looks.js helmet 'kettle') · 용사의 눈물(목 · 겉모습 그대로, 10/17 아래 HERO_TEAR).
//   거는 자리가 달라 둘 다 걸 수 있다 (armorSlot — 머리는 전 저장 armor.v1 그대로 · 목은 neck.v1).
export const LOBBY_ITEMS = Object.freeze(['tree_branch']);
const KETTLE_STAMINA = 30; // 케틀 햇 특수 능력 '생존술': 최대 기력 100 → 130 (사장님 10/16 03:5x — 플레이어만, 문턱·그 밖 규칙 그대로 · stamina.js setMaxBonus)
export const LOBBY_ARMOR = Object.freeze({
  id: 'kettle',
  nameKo: '케틀 햇', // 방어구 이름 — 사장님 10/16 01:0x 결정(샛별 쪽 이름에서 바꿈). 이름을 또 바꾸면 이 한 줄만 (대기실 칸·설명 카드·장착 알림·화면 읽기 글이 모두 이것을 읽는다)
  tier: 'legend', // 사장님 10/16 03:5x '케틀 햇은 전설 등급으로' — 등급 글·색은 무기 카드와 같은 표 (weapons.js TIER_LABEL '레전드' · index.html --tier-legend)
  description: '여행자의 필수품. 뒤집으면 요리를 할 수 있다.', // 샛별 쪽 글 그대로
  ability: `(생존술: 기력 +${KETTLE_STAMINA})`, // 사장님 10/16 03:5x '설명 뒤에 특수능력 문구 추가' — 카드는 설명 뒤에 이 줄을 등급 색으로 (무기 카드 특수 능력 줄 .wabil 과 같은 꼴)
  staminaBonus: KETTLE_STAMINA,
  thumbnail: 'ui/armor/kettle.webp',
});
// 용사의 눈물 (사장님 10/17 "용사의 눈물이라는 아이템(작은 물방울 모양의 다이아 목걸이) 만들어서 방어구에 넣어둬. 착용 효과는 기력 무한. 외형 변화는 없음.
//  이 아이템을 착용하고 전투 진입 시 어차피 기력 무한이기 때문에 기력바 표시하지 않음." — docs/import/hero_tear_2026-10-17.md):
//  목에 거는 것 — 머리(케틀 햇)와 자리가 달라 같이 걸 수 있고, 걸어도 케틀 햇 · 투구는 그대로. 겉모습은 그대로(몸에 아무것도 안 붙임 · 대기실 프로필 그림도 그대로).
//  능력: 첫 화면·대기실 여정에서 걸고 싸우면 플레이어 기력 무한(main.js newRound → stamina.js setInfinite — 비용 · 지침 · 탈진 없음) · 내 머리 위 기력 막대 없음(stamina_hud.js).
//  상대 AI · 시뮬은 그대로 (이 표시를 읽는 곳은 플레이어를 세우는 main.js 하나).
export const HERO_TEAR = Object.freeze({
  id: 'hero_tear',
  nameKo: '용사의 눈물', // 사장님 이름 그대로
  tier: 'legend', // 사장님 확인 전 — 케틀 햇(+30)과 같은 레전드 (기력 무한이 더 세다 · 등급 위가 없다)
  description: '물방울 모양의 작은 다이아 목걸이. 옷 안에 걸어 겉으로는 보이지 않는다.', // 사장님 확인 전 — '외형 변화는 없음'을 글로
  ability: '(기력 무한)', // 사장님 10/17 "'불굴'은 빼고 '기력 무한'만 써" (전 '(불굴: 기력 무한)')
  infiniteStamina: true,
  thumbnail: 'ui/armor/hero_tear.webp', // tools/browser/item_thumbs.mjs tear (금화 · 주머니 · 스킬북과 같은 도구 · 같은 빛 · 같은 금속)
});
/** 방어구 칸 차례 — 칸 그림 · 설명 카드 · 장착 단추가 이 표를 읽는다 (lobby.js) */
export const LOBBY_ARMORS = Object.freeze([LOBBY_ARMOR, HERO_TEAR]);
/** 방어구를 거는 자리: 'head' = 케틀 햇 · 'neck' = 용사의 눈물 (자리마다 하나씩 — 서로 벗기지 않는다) */
export const armorSlot = (id) => (id === HERO_TEAR.id ? 'neck' : 'head');
export const EQUIPMENT_KEY = 'stillness.lobby.weapon.v1';
const ARMOR_KEY = 'stillness.lobby.armor.v1';
const NECK_KEY = 'stillness.lobby.neck.v1';
let equipped = null;
let armor = 'kettle';
let neck = HERO_TEAR.id; // 처음부터 걸었다 (사장님 10/17 "용사의 눈물은 '장착'을 기본으로 해" — 케틀 햇처럼. 벗으면 null 이 저장되어 그대로)
/** 목 자리 (용사의 눈물 또는 null) — 머리 자리 readLobbyArmor 와 같은 규칙 */
export function readLobbyNeck() {
  try {
    const value = JSON.parse(localStorage.getItem(NECK_KEY));
    if (value?.version === 1 && [null, HERO_TEAR.id].includes(value.neck)) neck = value.neck;
  } catch { /* 이번 실행 동안 유지한다. */ }
  return neck;
}
export function saveLobbyNeck(id) {
  if (id !== null && id !== HERO_TEAR.id) return false;
  neck = id;
  try { localStorage.setItem(NECK_KEY, JSON.stringify({ version: 1, neck: id })); return true; }
  catch { return false; }
}
export function readLobbyArmor() {
  try {
    const value = JSON.parse(localStorage.getItem(ARMOR_KEY));
    if (value?.version === 1 && [null, LOBBY_ARMOR.id].includes(value.armor)) armor = value.armor;
  } catch { /* 이번 실행 동안 유지한다. */ }
  return armor;
}
export function saveLobbyArmor(id) {
  if (id !== null && id !== LOBBY_ARMOR.id) return false;
  armor = id;
  try { localStorage.setItem(ARMOR_KEY, JSON.stringify({ version: 1, armor: id })); return true; }
  catch { return false; }
}
export function readLobbyEquipment() {
  try {
    const value = JSON.parse(localStorage.getItem(EQUIPMENT_KEY));
    if (value?.version === 1) equipped = LOBBY_ITEMS.includes(value.weapon) ? value.weapon : null;
  } catch { /* 저장 불가 시 이번 실행 동안 유지한다. */ }
  return equipped;
}
export function saveLobbyEquipment(id) {
  if (id !== null && !LOBBY_ITEMS.includes(id)) return false;
  equipped = id;
  try { localStorage.setItem(EQUIPMENT_KEY, JSON.stringify({ version: 1, weapon: id })); return true; }
  catch { return false; }
}
