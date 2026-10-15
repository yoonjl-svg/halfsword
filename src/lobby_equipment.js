// 대기실의 장착 표시 (샛별 저장소 b73a9c82 · 3b280a1b). 대기실 캐릭터의 겉모습에만 — 여정의 무기 카드·이어하기 저장과 따로 둔다.
//  무기 칸: 나뭇가지 하나 (사장님 10/16 01:0x '무기에 롱소드는 삭제') — 설명 카드는 우리 무기 자료(weapons.js nameKo · desc · tier)를 lobby.js 가 읽는다.
//  방어구 칸: 하나 — 플레이어 겉모습의 머리 장비(looks.js helmet 'kettle') 그대로, 대기실 미리보기에서 보이고 안 보이고만 바뀐다.
export const LOBBY_ITEMS = Object.freeze(['tree_branch']);
export const LOBBY_ARMOR = Object.freeze({
  id: 'kettle',
  nameKo: '케틀 햇', // 방어구 이름 — 사장님 10/16 01:0x 결정(샛별 쪽 이름에서 바꿈). 이름을 또 바꾸면 이 한 줄만 (대기실 칸·설명 카드·장착 알림·화면 읽기 글이 모두 이것을 읽는다)
  tier: 'common', // 등급 글은 우리 무기 카드와 같은 표 weapons.js TIER_LABEL ('커먼' — 샛별 쪽 글과 같다)
  description: '여행자의 필수품. 뒤집으면 요리를 할 수 있다.', // 샛별 쪽 글 그대로 (사장님 확인 전)
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
