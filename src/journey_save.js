// 여정 이어하기 지점 (첫 화면 '이어하기' — 샛별 저장소 215d7b7e 를 우리 여정에 맞춤, docs/import/lobby_port_2026-10-16.md §5)
//  무대 시작 자리만 저장한다: 무대 · 그 무대 상대 · 상대 무기 · (카드를 펼쳤으면) 내 카드 두 장 · (골랐으면) 내 무기 · 지난 판 무기.
//  해금(깬 수 stillness.journeyClears.v1 · 인장)·설정(gladiator-settings)·싸움 중 물리 상태는 이 열쇠에 넣지 않는다.
//  무대 차례는 stages.js STAGE_ORDER, 저장 내용이 지금 여정과 맞는지는 main.js validJourney 가 본다.
export const JOURNEY_SAVE_KEY = 'stillness.journey.checkpoint.v1';

// 첫 화면을 건너뛰는 주소 (우리 판 — 샛별 쪽은 test·weapon·foe·foeWeapon·stage·hero·look·lookv 여덟 열쇠만 건너뜀):
//  주소에 게임 인자가 하나라도 있으면 지금처럼 바로 게임 메뉴('여정 시작')로 — ?stage= ?weapon= ?foe= ?look= ?stamina=0 ?foeWhiff=1 ?tempo= … 모두.
//  첫 화면·대기실은 인자 없는 주소(설치한 앱의 시작 주소 './' 포함)에서만 나온다.
//  ?title=0 = 늘 건너뜀 · ?title=1 = 다른 인자가 있어도 첫 화면 (대기실 화면 점검용 — 주소로 무대·상대·무기를 고정한 판은 여정을 저장하지 않는다, main.js journeySaves)
//  셈에서 빼는 인자: title 자신 · nosw(서비스 워커 비상 스위치 — pwa.js) · 바깥 링크가 붙이는 utm_* · fbclid · gclid
const NOT_GAME_ARGS = new Set(['title', 'nosw', 'fbclid', 'gclid']);
export function skipsTitle(params) {
  const forced = params.get('title');
  if (forced === '0') return true;
  if (forced === '1') return false;
  for (const key of params.keys()) if (!NOT_GAME_ARGS.has(key) && !key.startsWith('utm_')) return true;
  return false;
}

const id = (value) => typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value);
export function readJourney(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage.getItem(JOURNEY_SAVE_KEY));
    if (!value || value.version !== 1 || !id(value.stage)) return null;
    for (const key of ['foe', 'foeWeapon', 'weapon', 'lastWeapon']) if (value[key] != null && !id(value[key])) return null;
    if (value.cards != null && (!Array.isArray(value.cards) || value.cards.length !== 2 || !value.cards.every(id))) return null;
    if ((value.weapon || value.cards) && (!value.foe || !value.foeWeapon)) return null;
    return { stage: value.stage, foe: value.foe ?? null, foeWeapon: value.foeWeapon ?? null, weapon: value.weapon ?? null, lastWeapon: value.lastWeapon ?? null, cards: value.cards ?? null };
  } catch {
    return null;
  }
}
export function writeJourney(checkpoint, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.setItem(JOURNEY_SAVE_KEY, JSON.stringify({ ...checkpoint, version: 1 }));
    return true;
  } catch {
    return false;
  }
}
