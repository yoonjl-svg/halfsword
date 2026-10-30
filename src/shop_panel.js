// 대기실 '상점' 칸 (사장님 10/30 19:0x · 10/31 00:2x — 규칙 shop_rules.js · 값 config.js SHOP · 글 shop_text.js · 꼴 shop.css). lobby.js 가 ③ 창 상점 칸에 단다(SHOP.enabled — 10/31 본판 켬).
//  위: 상인 프로필(얼터면 광기의 그림 julia_mad — public/ui/portraits/<id>.webp · 없으면 빈 액자 1) + 장면 글(얼터만 '*크리스테바의 분위기가 이상하다*') · 이름 · “대사”
//   (방랑 전용 상대 알림 창과 같은 차례 · 같은 꼴 — 장면 글은 대사와 같은 색 · 크기, 사장님 10/24 02:4x). 이름은 얼터도 '쥘리아 크리스테바'(10/31 00:2x).
//   대사는 칸을 열 때 · 물건을 다시 들일 때마다 무작위(바로 앞 대사는 빼고 — rand01).
//  가운데: 파는 물건 SHOP.items(2 또는 3 — 10/31 02:xx 견주기) — 그림 · 이름 · 등급 · 값. 누르면 확인 카드 → 구입 = lobby_progress.js purchase 한 번의 저장
//   확인 카드(사장님 10/31 02:xx '설명은 왼쪽에 몰아서 뜨고 오른쪽에는 해당 무기의 풀일러스트랑 구매 버튼'): 왼쪽 = 이름 · 등급 · 설명(스펙) · 값 · 묻는 말 '이 물건을 사겠나?'(모자라면 모자란 재화) /
//   오른쪽 = 무기 그림 크게(무기 카드 · 아이템 칸과 같은 그림 public/ui/weapons/<id>.webp — 따로 그린 큰 그림은 없음 · 등급 빛) + '구입' · 닫기 = 오른쪽 위 ×(스킬 칸 설명 카드와 같은 꼴) · Esc
//   (금화 · 머리 · 뿔피리를 내고 얻은 것 'weapon:<id>' — owned_weapons.js · 아이템 칸 · 장착 · 생사전 가진 무기 수에 바로). 산 물건은 '판매 완료'(다음 갱신까지).
//   돈이 모자라면 확인 카드에 모자란 재화를 한 줄로('금화가 부족합니다.') · 구입 단추는 누를 수 없음.
//  맨 아래: '⏳ 1:29:59' — 다음 갱신까지 남은 시간이 1 초마다 줄어듦(사장님 10/31 00:2x · 초 경계에 맞춤 · 칸이 바뀌면 새 물건). 칸이 닫혀 있거나(다른 탭) · 화면이 숨었거나 ·
//   대기실이 걷혔으면(싸움 — lobby.destroy) 시계는 쉰다. 오른쪽 '[머리] 1 다음 갱신' = 머리 1 로 지금 칸 물건을 새로(rerollShopStock — 한 번의 저장 · 4 시간 갱신 시각 그대로) ·
//   머리가 없으면 단추는 꺼지고 옆에 '머리가 부족합니다.'.
//  새 물건이 들어오면(다시 들이기 · 상점을 보는 동안의 4 시간 갱신 — 사장님 10/31 01:3x '효과음도 나고 쥘리아 대사도 바뀌게') '철-컥' 소리(ui_sound.js — 대기실 소리 규칙 그대로) +
//   지금과 다른 대사(얼터가 되면 얼터 대사 · 장면 글 켬 / 보통으로 돌아오면 보통 대사 · 장면 글 끔). 칸이 안 보일 때 지난 갱신은 소리 없이 — 다시 열면 새 대사로. 시험판(SHOP.testMode)만 주소 ?shopSlot=N(N 칸 뒤) · ?shopAlter=1 / 0(얼터 억지로 켬 / 끔)
import { SHOP } from './config.js';
import { readProgress, purchase, ensureShopStock, rerollShopStock, rand01 } from './lobby_progress.js';
import { ownedWeapons, weaponReceipt } from './owned_weapons.js';
import { shopSlot, msToNextSlot, rollStock, normalizeShop, topUpStock } from './shop_rules.js';
import { SHOP_TEXT, SHOP_LINES, SHOP_ALTER_LINES, SHOP_ALTER_MOOD, SHOP_KEEPER_NAME, SHOP_HOURGLASS, shortText, clockText, nextLine } from './shop_text.js';
import { loadUiCue, playUiCue } from './ui_sound.js'; // 새 물건 '철-컥' (10/31 01:3x — ui_sound.js UI_SOUND.restock)
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
  const cost = SHOP.rerollHeads;
  host.dataset.count = String(SHOP.items); // 2 = 옆 그림 칸 · 3 = 세로 칸 (shop.css)
  host.innerHTML = `<div class="shop-keeper">
      <figure class="shop-portrait"><img alt="" draggable="false" decoding="async"></figure>
      <div class="shop-say"><p class="shop-mood" hidden></p><p class="shop-name"></p><p class="shop-line"></p></div>
    </div>
    <div class="shop-items" aria-label="파는 물건"></div>
    <p class="shop-foot"><span class="shop-refresh" role="timer"><span class="shop-hg" aria-hidden="true">${SHOP_HOURGLASS}</span><span class="shop-clock"></span><span class="shop-test"></span></span>
      <span class="shop-reroll"><span class="shop-reroll-why" hidden>${SHOP_TEXT.rerollShort}</span><button type="button" class="secondary small shop-next" aria-label="${SHOP_TEXT.reroll} · ${SHOP_TEXT.heads} ${cost}"><span class="shop-cost" aria-hidden="true">${POUCH_ICON}<b>${cost}</b></span>${SHOP_TEXT.reroll}</button></span></p>
    <div class="shop-confirm" role="group" aria-label="${SHOP_TEXT.confirm}" hidden>
      <div class="shop-c-text">
        <p class="item-head"><b class="shop-c-name" tabindex="-1"></b><span class="shop-c-tier"></span></p>
        <p class="shop-c-desc"></p>
        <p class="shop-c-row"><span class="shop-c-price"></span></p>
        <p class="shop-c-note" role="status"></p>
      </div>
      <div class="shop-c-side"><span class="shop-c-art"><img alt="" draggable="false"></span><button type="button" class="primary shop-buy">${SHOP_TEXT.buy}</button></div>
      <button type="button" class="shop-cancel" aria-label="${SHOP_TEXT.close}">×</button>
    </div>`;
  const q = (sel) => host.querySelector(sel);
  for (const icon of host.querySelectorAll('.shop-next img')) { icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); }
  const events = new AbortController(), on = (el, type, fn) => el?.addEventListener(type, fn, { signal: events.signal });
  const img = q('.shop-portrait img');
  on(img, 'error', () => { q('.shop-portrait').dataset.empty = ''; });
  loadUiCue('restock'); // 새 물건 소리 녹음을 미리 (누름 없이 받음)
  let stock = null, picked = null, shownLine = '', keeper = null, tickT = 0;
  const slotNow = () => shopSlot(now()) + test.offset;
  const rollFor = (slot) => { const owned = ownedWeapons(); return (seed, reroll) => rollStock({ seed, slot, reroll, owned, forceAlter: test.alter }); };

  function loadStock() {
    const slot = slotNow();
    stock = ensureShopStock({ slot, roll: rollFor(slot), valid: (s) => !!normalizeShop(s), fix: (s) => topUpStock(s, { owned: ownedWeapons() }), forceAlter: test.alter }); // 옛 2 개 칸 → 지금 수만큼 채움 (10/31)
  }
  /** 지금 보이는 대사와 다른 대사 (보통 · 얼터 표 — nextLine) */
  function pickLine() {
    return (shownLine = nextLine(stock?.alter ? SHOP_ALTER_LINES : SHOP_LINES, shownLine, rand01));
  }
  function renderKeeper(newLine) {
    const id = stock?.alter ? SHOP.alterKeeper : SHOP.keeper, box = q('.shop-keeper');
    box.dataset.alter = String(!!stock?.alter);
    if (keeper !== id) {
      keeper = id; delete q('.shop-portrait').dataset.empty;
      img.src = portraitSrc(id) ?? `ui/portraits/${id}.webp`; // 상인 그림 — portraits.js 에 든 그림 · 아니면 같은 폴더
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
    const left = clockText(msToNextSlot(now()));
    q('.shop-clock').textContent = left;
    q('.shop-refresh').setAttribute('aria-label', `${SHOP_TEXT.refreshLabel} ${left}`);
    q('.shop-test').textContent = test.offset ? ` · 시험 칸 ${test.offset > 0 ? '+' : ''}${test.offset}` : '';
  }
  /** '다음 갱신' 단추: 머리가 값보다 적으면 꺼짐 + 옆에 짧은 까닭 */
  function renderReroll() {
    const short = readProgress().heads < cost;
    q('.shop-next').disabled = short;
    q('.shop-reroll-why').hidden = !short;
  }
  function shortOf(it) {
    const p = readProgress();
    return [p.coins < it.coins && 'coins', p.heads < it.heads && 'heads', p.horns < it.horns && 'horns'].filter(Boolean);
  }
  function openConfirm(i) {
    const it = stock.items[i], w = getWeapon(it.id), sp = weaponSpecText(w), card = q('.shop-confirm');
    picked = i;
    card.dataset.tier = it.tier;
    q('.shop-c-art img').src = `ui/weapons/${it.id}.webp`; // 무기 그림 크게 (오른쪽)
    q('.shop-c-name').textContent = w.nameKo; q('.shop-c-tier').textContent = TIER_LABEL[it.tier];
    // 아이템 칸 설명 카드와 같은 글 (스펙은 대기실에서만 — 편집 지침 §3) · 스펙 괄호는 한 덩이(줄 끝에서 '1 / kg)' 처럼 쪼개지지 않게)
    q('.shop-c-desc').textContent = (w.desc || '').replace(/\n/g, ' ').trim();
    if (sp) { const spec = document.createElement('span'); spec.className = 'shop-c-spec'; spec.textContent = `(${sp})`; q('.shop-c-desc').append(' ', spec); }
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
    renderReroll(); // 얼터 물건은 머리로 산다
    onWallet();
    status(r.saved ? SHOP_TEXT.bought : `${SHOP_TEXT.bought} ${SHOP_TEXT.unsaved}`, 'notice');
    q(`.shop-item[data-i="${i}"]`)?.focus({ preventScroll: true });
  }
  /** 다음 갱신 (머리 1 — 사장님 10/31 00:2x): 지금 칸 물건을 같은 규칙으로 새로 · 한 번의 저장 · 4 시간 갱신 시각은 그대로 */
  function reroll() {
    const slot = slotNow();
    if (stock?.slot !== slot) loadStock(); // 칸이 막 바뀌었으면 새 칸 물건부터 (그 물건을 다시 들임)
    const r = rerollShopStock({ slot, roll: rollFor(slot), heads: cost });
    if (!r.ok) { renderReroll(); if (r.why === 'heads') status(SHOP_TEXT.rerollShort); return; }
    stock = r.stock;
    closeConfirm(false);
    renderKeeper(true); // 다른 대사 (얼터면 얼터 대사 · 장면 글)
    renderItems();
    renderReroll();
    onWallet();
    playUiCue('restock'); // 누름 안 — 첫 소리라도 낼 수 있다
    status(r.saved ? SHOP_TEXT.rerolled : `${SHOP_TEXT.rerolled} ${SHOP_TEXT.unsaved}`, 'notice');
  }
  on(q('.shop-items'), 'click', (e) => {
    const b = e.target.closest('.shop-item');
    if (!b || b.dataset.sold != null) return;
    openConfirm(Number(b.dataset.i));
  });
  on(q('.shop-cancel'), 'click', () => closeConfirm());
  on(q('.shop-buy'), 'click', buy);
  on(q('.shop-next'), 'click', reroll);
  on(q('.shop-confirm'), 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeConfirm(); } });
  // ── 시계: 1 초마다(초 경계에 맞춤) · 칸이 보일 때만 ──
  const shown = () => host.isConnected && !host.closest('[hidden]') && !document.hidden;
  function stop() { clearTimeout(tickT); tickT = 0; }
  function tick() {
    tickT = 0;
    if (!shown()) return; // 닫힌 칸 · 숨은 화면 · 걷힌 대기실(싸움)에서는 멈춤 — 다시 열면 refresh · start
    if (slotNow() !== stock?.slot) { closeConfirm(false); loadStock(); renderKeeper(true); renderItems(); renderReroll(); playUiCue('restock'); } // 4 시간 갱신 — 보는 동안만 돌므로 소리도 보는 동안만
    renderTimer();
    tickT = setTimeout(tick, 1000 - (now() % 1000) + 15);
  }
  function start() { stop(); tick(); }
  on(document, 'visibilitychange', () => { if (!document.hidden && shown() && !tickT) start(); });
  /** 칸을 열 때 (lobby.js selectTab): 새 대사 · 이 칸 물건 · 남은 시간 · 시계 시작 */
  function refresh() {
    closeConfirm(false);
    onWallet(); // 제목 줄 지갑을 저장 값으로
    loadStock();
    renderKeeper(true);
    renderItems();
    renderReroll();
    renderTimer();
    start();
  }
  return {
    refresh,
    stop, // 다른 탭으로 (lobby.js selectTab)
    get ticking() { return !!tickT; }, // 시험 · 사진 도구
    get stock() { return stock && structuredClone(stock); },
    destroy() { stop(); events.abort(); },
  };
}
