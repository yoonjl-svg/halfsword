// 상점 시험판 (사장님 10/30 — 본판에 올리기 전에 사장님이 해 보는 하위 경로 /shop/ · tools/shop_page/vite.config.mjs). 생사전 시험판(/saengsa/)과 같은 꼴.
//  시험판 빌드(`VITE_SHOP_TEST=1` — config.js SHOP.testMode)에서만 켜진다. game_entry.js 의 첫 들여오기라 다른 모듈이 저장을 읽기 전에 건다.
//  같은 출처(github.io)의 본 게임 · 생사전 시험판과 localStorage 를 함께 쓰므로, 이 페이지의 localStorage 읽기 · 쓰기를 모두 SHOP_TEST_PREFIX 를 붙인 열쇠로 돌린다
//   (Storage.prototype 의 getItem · setItem · removeItem · key · length · clear — localStorage 일 때만 · sessionStorage 는 그대로).
//   열쇠 앞 'stillness.test.shop.' — 본 게임 저장(앞이 붙지 않은 것)도 생사전 시험판 저장('stillness.test.' + 본 열쇠)도 읽지도 고치지도 않는다. clear() 도 이 시험판 열쇠만 지운다.
//  시험판 저장이 비었으면(처음 열 때) 시험판 저장에만 지갑 SHOP.testCoins · testHeads · testHorns (사장님 확인 전).
//  주소 `?shopItems=2|3` = 파는 수(10/31 — 사장님 견주기) · `?horns=N` = 뿔피리를 N 으로(시험판만 — ?coins · ?heads 는 본판에도 있는 game_entry.js 그대로). ?shopAlter · ?shopSlot 은 shop_panel.js · ?horn 은 main.js 가 읽는다.
export const SHOP_TEST_PREFIX = 'stillness.test.shop.';
const TEST = (import.meta.env || {}).VITE_SHOP_TEST === '1';
/** 상점 시험판인가 (game_entry.js — 첫 화면을 건너 대기실 상점 칸) */
export const SHOP_TEST = TEST;

function installTestStorage() {
  let ls = null;
  try { ls = globalThis.localStorage ?? null; } catch { return false; }
  if (!ls || typeof Storage === 'undefined') return false;
  const P = Storage.prototype;
  if (P.__stillnessTest) return true;
  const { getItem, setItem, removeItem, key, clear } = P;
  const lengthOf = Object.getOwnPropertyDescriptor(P, 'length').get;
  const isLocal = (s) => s === ls;
  const testKeys = (s) => {
    const out = [];
    for (let i = 0, n = lengthOf.call(s); i < n; i++) {
      const k = key.call(s, i);
      if (k != null && k.startsWith(SHOP_TEST_PREFIX)) out.push(k);
    }
    return out;
  };
  P.getItem = function (k) { return getItem.call(this, isLocal(this) ? SHOP_TEST_PREFIX + k : k); };
  P.setItem = function (k, v) { return setItem.call(this, isLocal(this) ? SHOP_TEST_PREFIX + k : k, v); };
  P.removeItem = function (k) { return removeItem.call(this, isLocal(this) ? SHOP_TEST_PREFIX + k : k); };
  P.key = function (i) {
    if (!isLocal(this)) return key.call(this, i);
    const k = testKeys(this)[i];
    return k == null ? null : k.slice(SHOP_TEST_PREFIX.length);
  };
  P.clear = function () {
    if (!isLocal(this)) return clear.call(this);
    for (const k of testKeys(this)) removeItem.call(this, k);
  };
  Object.defineProperty(P, 'length', { configurable: true, enumerable: true, get() { return isLocal(this) ? testKeys(this).length : lengthOf.call(this); } });
  Object.defineProperty(P, '__stillnessTest', { value: true });
  return true;
}

if (TEST && installTestStorage()) {
  const [{ PROGRESS_KEY, update, setHorns }, { SHOP }] = await Promise.all([import('./lobby_progress.js'), import('./config.js')]);
  let fresh = false;
  try { fresh = localStorage.getItem(PROGRESS_KEY) == null; } catch { /* 저장이 막힘 */ }
  if (fresh) update((d) => { d.coins = SHOP.testCoins; d.heads = SHOP.testHeads; d.horns = SHOP.testHorns; return true; });
  const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
  if (params.has('horns')) setHorns(Number(params.get('horns')));
  if (['2', '3'].includes(params.get('shopItems'))) SHOP.items = Number(params.get('shopItems')); // 파는 수 견주기 (10/31 02:xx — A 둘 · B 셋)
}
