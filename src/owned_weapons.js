// 가진 무기 (생사전 무기 배정 · 입장 조건 — 사장님 10/29 18:2x '무기는 상점에서 사게 해야하는데 이건 이따 개발하자')
//  가진 무기 = 모두가 가진 시작 무기(lobby_equipment.js LOBBY_ITEMS — 나뭇가지 · 드루이드의 채찍) + 얻은 것 기록(lobby_progress.js acquisitions)의 무기 줄.
//  무기 줄 = kind 'item' · receipt weaponReceipt(id) ('weapon:<무기 id>'). 상점이 생기면 purchase({ receipt: weaponReceipt(id), kind: 'item', price }) 로 이 목록이 저절로 찬다.
//  지금 본 게임에서 무기 줄을 쓰는 곳은 없다(시험판 저장만 — src/test_storage.js).
import { LOBBY_ITEMS } from './lobby_equipment.js';
import { readProgress } from './lobby_progress.js';
import { WEAPON_LIST } from './weapons.js';

const WEAPON_IDS = new Set(WEAPON_LIST.map((w) => w.id));
const PREFIX = 'weapon:';
/** 무기 → 얻은 것 기록 열쇠 */
export const weaponReceipt = (id) => `${PREFIX}${id}`;
/** 가진 무기 id (시작 무기 먼저 · 얻은 차례 · 겹침 없음 · 모르는 무기는 뺌) */
export function ownedWeapons(progress = readProgress()) {
  const got = (progress?.acquisitions ?? []).filter((a) => a.kind === 'item' && typeof a.receipt === 'string' && a.receipt.startsWith(PREFIX)).map((a) => a.receipt.slice(PREFIX.length));
  return [...new Set([...LOBBY_ITEMS, ...got])].filter((id) => WEAPON_IDS.has(id));
}
