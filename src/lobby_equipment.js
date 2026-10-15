// 대기실 장착 (샛별 저장소 b73a9c82 · 3b280a1b — docs/import/lobby_port_2026-10-16.md · 고친 것 docs/import/lobby_fix_2026-10-16.md).
//  사장님 10/16 03:5x '장착하면 실제 전투에 가져나가게 해': 첫 화면·대기실에서 연 여정은 이 장착으로 싸운다 (main.js journeyLoadout) —
//   무기를 장착했으면 무대마다 카드 없이 그 무기 · 안 했으면 지금처럼 카드 / 케틀 햇을 장착했으면 투구(머리 방어)와 '생존술: 기력 +30', 벗으면 맨머리.
//   주소로 무대·상대·무기를 고정한 판 · 테스트 경로 · 옛 메뉴 판은 지금 그대로.
//  무기 칸: 나뭇가지 하나 (사장님 10/16 01:0x '무기에 롱소드는 삭제') — 설명 카드는 우리 무기 자료(weapons.js nameKo · desc · tier)를 lobby.js 가 읽는다.
//  방어구 칸: 하나 — 플레이어 겉모습의 머리 장비(looks.js helmet 'kettle').
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
export const EQUIPMENT_KEY = 'stillness.lobby.weapon.v1';
const ARMOR_KEY = 'stillness.lobby.armor.v1';
let equipped = null;
let armor = 'kettle';
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
