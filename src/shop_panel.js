// 대기실 '상점' 칸 (사장님 10/30 19:0x — 규칙 shop_rules.js · 값 config.js SHOP · 글 shop_text.js · 꼴 shop.css). lobby.js 가 ③ 창 상점 칸에 단다(SHOP.enabled 일 때만 — 본판은 끔).
//  위: 상인 프로필(쥘리아 크리스테바 · 얼터면 광기의 쥘리아 크리스테바 — public/ui/portraits/<id>.webp · 없으면 빈 액자 1) + 장면 글(얼터만 '*크리스테바의 분위기가 이상하다*') · 이름 · “대사”
//   (방랑 전용 상대 알림 창과 같은 차례 · 같은 꼴 — 장면 글은 대사와 같은 색 · 크기, 사장님 10/24 02:4x). 대사는 칸을 열 때마다 무작위(바로 앞 대사는 빼고 — rand01).
//  아래: 파는 물건 둘(SHOP.slots) — 그림 · 이름 · 등급 · 값. 누르면 확인 카드(이름 · 등급 · 설명 · 값 · 취소 / 구입) → 구입 = lobby_progress.js purchase 한 번의 저장
//   (금화 · 머리 · 뿔피리를 내고 얻은 것 'weapon:<id>' — owned_weapons.js · 아이템 칸 · 장착 · 생사전 가진 무기 수에 바로). 산 물건은 '판매 완료'(다음 갱신까지).
//   돈이 모자라면 확인 카드에 모자란 재화를 한 줄로('금화가 부족합니다.') · 구입 단추는 누를 수 없음.
//  맨 아래: 다음 갱신까지 남은 시간(15 초마다 다시 셈 · 칸이 바뀌면 새 물건). 시험판(SHOP.testMode)만 '다음 갱신' 단추 · 주소 ?shopSlot=N(N 칸 뒤) · ?shopAlter=1 / 0(얼터 억지로 켬 / 끔)
import { SHOP } from './config.js';
import { readProgress, purchase, ensureShopStock, rand01 } from './lobby_progress.js';
import { ownedWeapons, weaponReceipt } from './owned_weapons.js';
import { shopSlot, msToNextSlot, rollStock, normalizeShop } from './shop_rules.js';
import { SHOP_TEXT, SHOP_LINES, SHOP_ALTER_LINES, SHOP_ALTER_MOOD, SHOP_KEEPER_NAME, shortText, leftText } from './shop_text.js';
import { portraitSrc } from './portraits.js';
import { getWeapon, TIER_LABEL, weaponSpecText } from './weapons.js';
import { COIN_ICON, POUCH_ICON, HORN_ICON } from './wallet_icons.js';

const num = (n) => n.toLocaleString('ko-KR');
/** 값 표지 (그림 + 수) — 금화 · 머리 · 뿔피리 중 0 이 아닌 것 */
export function priceHtml(it, short = []) {
  const part = (k, icon, n) => (n ? `<span class="shop-cost${short.includes(k) ? ' short' : ''}" data-cost="${k}">${icon}<b>${num(n)}</b></span>` : '');
  return part('coins', COIN_ICON, it.coins) + part('heads', POUCH_ICON, it.heads) + part('horns', HORN_ICON, it.horns);
}
/** 시험판 주소 스위치 (SHOP.testMode 일 때만 읽음) */
function testSwitches(search) {
  const q = new URLSearchParams((search ?? '').slice(1).replace(/\?/g, '&'));
  const a = q.get('shopAlter'), n = Number(q.get('shopSlot'));
  return { alter: a === '1' ? true : a === '0' ? false : null, offset: q.has('shopSlot') && Number.isSafeInteger(n) ? n : 0 };
}

export function mountShopPanel(host, { status = () => {}, onWallet = () => {}, now = () => Date.now(), search = globalThis.location?.search ?? '' } = {}) {
  const test = SHOP.testMode ? testSwitches(search) : { alter: null, offset: 0 };
  host.innerHTML = `<div class="shop-keeper">
      <figure class="shop-portrait"><img alt="" draggable="false" decoding="async"></figure>
      <div class="shop-say"><p class="shop-mood" hidden></p><p class="shop-name"></p><p class="shop-line"></p></div>
    </div>
    <div class="shop-items" aria-label="파는 물건"></div>
    <p class="shop-foot"><span class="shop-refresh" role="timer"></span>${SHOP.testMode ? `<button type="button" class="secondary small shop-next">${SHOP_TEXT.nextSlot}</button>` : ''}</p>
    <div class="shop-confirm" role="group" aria-label="${SHOP_TEXT.confirm}" hidden>
      <p class="item-head"><b class="shop-c-name" tabindex="-1"></b><span class="shop-c-tier"></span></p>
      <p class="shop-c-desc"></p>
      <p class="shop-c-row"><span class="shop-c-price"></span></p>
      <p class="shop-c-note" role="status"></p>
      <div class="confirm-actions"><button type="button" class="secondary shop-cancel">${SHOP_TEXT.cancel}</button><button type="button" class="primary shop-buy">${SHOP_TEXT.buy}</button></div>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  const events = new AbortController(), on = (el, type, fn) => el?.addEventListener(type, fn, { signal: events.signal });
  const img = q('.shop-portrait img');
  on(img, 'error', () => { q('.shop-portrait').dataset.empty = ''; });
  let stock = null, picked = null, lastLine = -1, keeper = null, timer = 0;
  const slotNow = () => shopSlot(now()) + test.offset;

  function loadStock() {
    const slot = slotNow(), owned = ownedWeapons();
    stock = ensureShopStock({ slot, roll: (seed) => rollStock({ seed, slot, owned, forceAlter: test.alter }), valid: (s) => !!normalizeShop(s), forceAlter: test.alter });
  }
  function pickLine() {
    const list = stock?.alter ? SHOP_ALTER_LINES : SHOP_LINES;
    let i = Math.min(list.length - 1, Math.floor(rand01() * list.length));
    if (list.length > 1 && i === lastLine) i = (i + 1 + Math.floor(rand01() * (list.length - 1))) % list.length; // 바로 앞 대사는 다시 안 나오게
    lastLine = i;
    return list[i];
  }
  function renderKeeper(newLine) {
    const id = stock?.alter ? SHOP.alterKeeper : SHOP.keeper, box = q('.shop-keeper');
    box.dataset.alter = String(!!stock?.alter);
    if (keeper !== id) {
      keeper = id; delete q('.shop-portrait').dataset.empty;
      img.src = portraitSrc(id) ?? `ui/portraits/${id}.webp`; // 상인 그림은 인물 표 밖 — 들여온 그림이 portraits.js 에 들면 그 길 · 아니면 같은 폴더
    }
    img.alt = `${SHOP_KEEPER_NAME[id]} 프로필`;
    q('.shop-mood').hidden = !stock?.alter;
    q('.shop-mood').textContent = SHOP_ALTER_MOOD;
    q('.shop-name').textContent = SHOP_KEEPER_NAME[id];
    if (newLine || !q('.shop-line').textContent) q('.shop-line').textContent = `“${pickLine()}”`;
  }
  const sold = (it) => ownedWeapons().includes(it.id);
  function renderItems() {
    const list = q('.shop-items');
    if (!stock?.items.length) { list.innerHTML = `<p class="empty-panel shop-empty">${SHOP_TEXT.empty}</p>`; return; }
    list.innerHTML = stock.items.map((it, i) => {
      const w = getWeapon(it.id), gone = sold(it);
      return `<button type="button" class="shop-item" data-i="${i}" data-id="${it.id}" data-tier="${it.tier}"${gone ? ' aria-disabled="true" data-sold=""' : ''}>
        <span class="shop-thumb"><img src="ui/weapons/${it.id}.webp" alt="" draggable="false"></span>
        <span class="shop-iname">${w.nameKo}</span><span class="shop-itier">${TIER_LABEL[it.tier]}</span>
        <span class="shop-price">${priceHtml(it)}</span>${gone ? `<span class="shop-sold">${SHOP_TEXT.soldOut}</span>` : ''}</button>`;
    }).join('');
    for (const icon of list.querySelectorAll('.shop-cost img')) { icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); }
    for (const b of list.querySelectorAll('.shop-item')) b.setAttribute('aria-label', `${b.querySelector('.shop-iname').textContent} · ${b.querySelector('.shop-itier').textContent} · ${b.querySelector('.shop-price').textContent.replace(/\s+/g, ' ').trim() || ''}${b.dataset.sold != null ? ` · ${SHOP_TEXT.soldOut}` : ''}`);
  }
  function renderTimer() {
    const left = leftText(msToNextSlot(now()));
    q('.shop-refresh').textContent = `${SHOP_TEXT.refresh} ${left}${test.offset ? ` · 시험 칸 +${test.offset}` : ''}`;
  }
  function shortOf(it) {
    const p = readProgress();
    return [p.coins < it.coins && 'coins', p.heads < it.heads && 'heads', p.horns < it.horns && 'horns'].filter(Boolean);
  }
  function openConfirm(i) {
    const it = stock.items[i], w = getWeapon(it.id), sp = weaponSpecText(w), card = q('.shop-confirm');
    picked = i;
    card.dataset.tier = it.tier;
    q('.shop-c-name').textContent = w.nameKo; q('.shop-c-tier').textContent = TIER_LABEL[it.tier];
    q('.shop-c-desc').textContent = `${(w.desc || '').replace(/\n/g, ' ')}${sp ? ` (${sp})` : ''}`.trim(); // 아이템 칸 설명 카드와 같은 글 (스펙은 대기실에서만 — 편집 지침 §3)
    const short = shortOf(it);
    q('.shop-c-price').innerHTML = priceHtml(it, short);
    for (const icon of q('.shop-c-price').querySelectorAll('img')) { icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); }
    q('.shop-c-note').textContent = short.length ? shortText(short) : SHOP_TEXT.confirm;
    q('.shop-c-note').dataset.tone = short.length ? 'short' : '';
    q('.shop-buy').disabled = short.length > 0;
    card.hidden = false;
    q('.shop-c-name').focus({ preventScroll: true });
  }
  function closeConfirm(refocus = true) {
    const card = q('.shop-confirm');
    if (card.hidden) return;
    card.hidden = true;
    const i = picked; picked = null;
    if (refocus) q(`.shop-item[data-i="${i}"]`)?.focus({ preventScroll: true });
  }
  function buy() {
    if (picked == null) return;
    const it = stock.items[picked];
    const r = purchase({ receipt: weaponReceipt(it.id), kind: 'item', price: it.coins, heads: it.heads, horns: it.horns });
    if (!r.ok) {
      const text = r.why === 'owned' ? SHOP_TEXT.owned : r.short?.length ? shortText(r.short) : SHOP_TEXT.failed;
      q('.shop-c-note').textContent = text; q('.shop-c-note').dataset.tone = 'short';
      q('.shop-buy').disabled = true;
      return;
    }
    const i = picked;
    closeConfirm(false);
    renderItems();
    onWallet();
    status(r.saved ? SHOP_TEXT.bought : `${SHOP_TEXT.bought} ${SHOP_TEXT.unsaved}`, 'notice');
    q(`.shop-item[data-i="${i}"]`)?.focus({ preventScroll: true });
  }
  on(q('.shop-items'), 'click', (e) => {
    const b = e.target.closest('.shop-item');
    if (!b || b.dataset.sold != null) return;
    openConfirm(Number(b.dataset.i));
  });
  on(q('.shop-cancel'), 'click', () => closeConfirm());
  on(q('.shop-buy'), 'click', buy);
  on(q('.shop-confirm'), 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeConfirm(); } });
  on(q('.shop-next'), 'click', () => { test.offset++; closeConfirm(false); loadStock(); renderKeeper(true); renderItems(); renderTimer(); }); // 시험판만
  /** 칸을 열 때 (lobby.js selectTab): 새 대사 · 이 칸 물건 · 남은 시간 · 15 초마다 다시 셈(칸이 바뀌면 새 물건) */
  function refresh() {
    closeConfirm(false);
    const was = stock?.slot;
    loadStock();
    renderKeeper(true);
    renderItems();
    renderTimer();
    clearInterval(timer);
    timer = setInterval(() => {
      if (host.closest('[hidden]')) return; // 칸이 닫혀 있으면 쉰다 (다시 열면 refresh)
      if (slotNow() !== stock?.slot) { closeConfirm(false); loadStock(); renderKeeper(true); renderItems(); }
      renderTimer();
    }, 15000);
    return was !== stock?.slot;
  }
  return {
    refresh,
    get stock() { return stock && structuredClone(stock); }, // 시험 · 사진 도구
    destroy() { clearInterval(timer); events.abort(); },
  };
}
