// 대기실 스킬북 화면 (docs/import/lobby_fix_2026-10-16.md §6) — 유파 탭 다섯 · 탭마다 책 다섯을 별자리처럼 룬 줄로 잇는다.
//  사장님 10/16 03:5x '스킬트리처럼 유파별 문서가 박힌 … 해금되면 색이 밝아지고 누르면 설명과 함께' · 04:3x '책은 책이지만 별자리나 스킬트리처럼 룬 문자처럼 연결돼 있어.
//   구입하면 밝아지고 사용 봉인 선택 가능. 사용하면 섬네일 자리를 둥근 빛이 감쌈.'
//  상태 셋 (skill_books.js bookState): 안 삼 = 어둡게 + 값 · 사용 = 밝게 + 둥근 빛 · 봉인 = 밝게, 빛 없음(판에서 꺼짐). 줄은 꾸밈 — 아무 차례로나 산다.
//  책을 누르면 판 위에 설명 카드: 이름 · 급 · 등급 · 유파 · 효과 한 줄(고유자세는 넷을 적고 '임시') · 짧은 출처 · 구입(안 삼) 또는 사용 / 봉인(산 책).
//  꾸밈은 우리 픽셀 결(대기실 나무 판 · 카드 틀) — 글자는 entrance_type.css 규칙, 색·자리는 lobby.css '스킬북' 칸.
import { BOOK_SCHOOLS, ROMAN, booksOf, readBooks, bookState, setBookInUse, buyBook, headPriceOf } from './skill_books.js';
import { readProgress } from './lobby_progress.js';
import { TRADITIONS } from './schools.js';

// 별자리 꼴 (판 좌표 300 × 210 — 유파 무기·몸놀림을 본뜸 · 폰 가로의 좁은 판에서도 책이 안 겹치게 줄은 셋까지): at = 책 I~V 자리 · links = 이은 줄 (책 번호 1~5)
export const CONSTELLATIONS = Object.freeze({
  german: { at: [[150, 30], [62, 100], [238, 100], [150, 100], [150, 164]], links: [[1, 4], [2, 4], [4, 3], [4, 5]] }, // 롱소드 십자: 칼끝 · 코등이 좌우 · 칼밑 · 폼멜
  italian: { at: [[150, 30], [78, 92], [222, 92], [104, 164], [196, 164]], links: [[1, 2], [1, 3], [2, 4], [3, 5], [4, 5]] }, // 레이피어 컵 고리(오각)
  iberian: { at: [[42, 164], [92, 86], [150, 30], [208, 86], [258, 164]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 몬탄테: 머리 위로 크게 도는 호
  japanese: { at: [[44, 164], [98, 130], [152, 98], [206, 64], [258, 30]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 휜 칼: 비스듬히 올라가는 곡선
  chinese: { at: [[42, 46], [96, 164], [150, 70], [204, 164], [258, 46]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 검무의 꺾이는 걸음(W)
});

// 유파 문양 (12 × 12 픽셀 — 픽셀 결 crispEdges): 칼날 = 밝은 쇠 · 손잡이 = 금빛
const EMBLEMS = {
  german: { blade: 'M5 0h2v7H5z', hilt: 'M2 7h8v1H2zM5 8h2v2H5zM4 10h4v1H4z' },
  italian: { blade: 'M6 0h1v7H6z', hilt: 'M4 5h1v1H4zM8 5h1v1H8zM3 6h1v1H3zM9 6h1v1H9zM1 7h10v1H1zM3 8h1v1H3zM9 8h1v1H9zM4 9h1v1H4zM8 9h1v1H8zM6 8h1v2H6zM5 10h3v1H5z' },
  iberian: { blade: 'M5 0h2v6H5zM1 1h1v1H1zM0 2h1v4H0zM1 6h1v1H1z', hilt: 'M2 6h8v1H2zM2 7h1v1H2zM9 7h1v1H9zM5 7h2v3H5zM4 10h4v1H4z' },
  japanese: { blade: 'M10 0h1v1h-1zM9 1h1v1H9zM8 2h2v1H8zM7 3h2v1H7zM6 4h2v1H6zM5 5h2v1H5z', hilt: 'M3 6h4v2H3zM2 8h2v1H2zM1 9h2v1H1zM0 10h2v1H0z' },
  chinese: { blade: 'M5 0h2v6H5z', hilt: 'M3 6h1v1H3zM8 6h1v1H8zM4 7h4v1H4zM5 8h2v2H5zM4 10h4v1H4zM6 11h1v1H6z' },
};
const SVG_NS = 'http://www.w3.org/2000/svg';
// 급 I~V (픽셀 숫자 4 칸 높이 — 표지 아래, 등급 색): I = 세로 막대 · V = 꺾쇠
const NUMERAL = { I: (x) => `M${x} 0h1v4h-1z`, V: (x) => `M${x} 0h1v2h-1zM${x + 2} 0h1v2h-1zM${x + 1} 2h1v2h-1z` };
function numeralPath(tier) {
  const glyphs = ROMAN[tier].split(''), w = glyphs.reduce((n, g) => n + (g === 'V' ? 3 : 1), 0) + glyphs.length - 1;
  let x = 10 - Math.ceil(w / 2), d = '';
  for (const g of glyphs) { d += NUMERAL[g](x); x += (g === 'V' ? 3 : 1) + 1; }
  return d;
}
/** 책 섬네일 (가죽 표지 · 책등 · 쪽 가장자리 · 가운데 유파 문양 · 아래 급 숫자) — 20 × 26 픽셀 */
function bookSvg(school, tier) {
  const e = EMBLEMS[school] ?? EMBLEMS.german;
  return `<svg class="book-svg" viewBox="0 0 20 26" aria-hidden="true" shape-rendering="crispEdges">
    <path class="book-edge" d="M3 1h15v1h1v23H3z"/>
    <path class="book-pages" d="M17 2h1v22h-1z"/>
    <path class="book-cover" d="M2 1h14v24H2z"/>
    <path class="book-spine" d="M2 1h2v24H2z"/>
    <path class="book-band" d="M4 3h12v1H4zM4 23h12v1H4z"/>
    <g transform="translate(4 5)"><path class="emblem-blade" d="${e.blade}"/><path class="emblem-hilt" d="${e.hilt}"/></g>
    <path class="book-numeral" transform="translate(0 18)" d="${numeralPath(tier)}"/>
  </svg>`;
}
const COIN_SVG = '<svg class="price-coin" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="#674823" d="M2 0h12v2h2v12h-2v2H2v-2H0V2h2Z"/><path fill="#d9a441" d="M3 1h10v2h2v10h-2v2H3v-2H1V3h2Z"/><path fill="#f3d785" d="M4 3h8v2H5v7H3V4h1Z"/></svg>';

/** 룬 줄 하나 (판 좌표): 두 책 사이 곧은 줄 + 가운데 룬 꺾쇠 둘(ᚲ 꼴) + 작은 마름모 */
function runeLink(a, b, lit) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const r = 22; // 책 자리를 비운다
  const p = (t, n = 0) => `${(a[0] + ux * t + nx * n).toFixed(1)} ${(a[1] + uy * t + ny * n).toFixed(1)}`;
  const m = len / 2;
  const d = `M${p(r)} L${p(len - r)} M${p(m - 9, 6)} L${p(m - 3)} L${p(m - 9, -6)} M${p(m + 3, 6)} L${p(m + 9)} L${p(m + 3, -6)}`;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `rune-link${lit ? ' lit' : ''}`);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  const gem = document.createElementNS(SVG_NS, 'path');
  gem.setAttribute('class', 'rune-gem');
  gem.setAttribute('d', `M${p(m, 0)} m0 -3 l3 3 l-3 3 l-3 -3 z`);
  g.append(path, gem);
  return g;
}

/**
 * root: 스킬북 칸(Shadow root 안의 #skillTreeHost) · test: 테스트 경로(모두 열림 — 사고팔기 없음) · onWallet(): 금화가 바뀌면(대기실 내 정보 칸 다시 그리기) ·
 * announce(text): 화면 읽기 알림
 */
export function mountSkillTree(root, { test = false, onWallet = () => {}, announce = () => {} } = {}) {
  root.innerHTML = `<div class="school-tabs" role="tablist" aria-label="유파">${BOOK_SCHOOLS.map((s, i) => `<button role="tab" data-school="${s}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${TRADITIONS[s].nameKo}</button>`).join('')}</div>
    <div class="tree-frame card-frame"><div class="tree-board" role="tabpanel" aria-label="스킬북 별자리"><svg class="tree-links" viewBox="0 0 300 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg><div class="tree-nodes"></div>
    <section class="book-detail" hidden aria-labelledby="bookTitle"><button type="button" class="detail-close" aria-label="설명 닫기">×</button>
      <div class="detail-head"><span class="book-thumb detail-thumb"></span><div><b id="bookTitle" tabindex="-1"></b><small id="bookMeta"></small></div></div>
      <p id="bookEffect" class="detail-effect"></p><ul id="bookList" class="detail-list" hidden></ul><p id="bookSource" class="detail-source"></p><p id="bookState" class="detail-state" role="status"></p>
      <div class="detail-actions start-actions"><button type="button" id="buyBook">구입</button><button type="button" id="useBook">사용</button><button type="button" id="sealBook">봉인</button></div>
    </section></div></div>`;
  const events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const $ = (sel) => root.querySelector(sel);
  const tabs = [...root.querySelectorAll('.school-tabs [role=tab]')];
  let school = BOOK_SCHOOLS[0], selected = null, lastNode = null;
  const stateOf = (books, id) => (test ? 'use' : bookState(books, id));

  function render() {
    const books = readBooks(), C = CONSTELLATIONS[school], list = booksOf(school);
    const svg = $('.tree-links');
    svg.replaceChildren(...C.links.map(([i, j]) => runeLink(C.at[i - 1], C.at[j - 1], stateOf(books, list[i - 1].id) !== 'unowned' && stateOf(books, list[j - 1].id) !== 'unowned')));
    $('.tree-nodes').innerHTML = list.map((b, k) => {
      const st = stateOf(books, b.id), [x, y] = C.at[k];
      const label = `${b.title} · ${ROMAN[b.tier]}급 ${b.rarityKo} · ${st === 'unowned' ? `금화 ${b.price} · 사지 않음` : st === 'use' ? '사용 중' : '봉인'}`;
      return `<button type="button" class="book-node" data-tier="${b.rarity}" data-book="${b.tier}" data-state="${st}" style="left:${(x / 3).toFixed(2)}%;top:${(y / 2.1).toFixed(2)}%" aria-label="${label}" aria-pressed="${selected === b.tier}">
        <span class="book-thumb" data-tier="${b.rarity}">${bookSvg(school, b.tier)}</span>
        <span class="book-cat">${b.label}</span>${st === 'unowned' ? `<span class="book-price">${COIN_SVG}${b.price}</span>` : ''}</button>`;
    }).join('');
    root.dataset.school = school;
    renderDetail(books);
  }

  function renderDetail(books = readBooks()) {
    const box = $('.book-detail');
    if (!selected) { box.hidden = true; return; }
    const b = booksOf(school)[selected - 1], st = stateOf(books, b.id), coins = readProgress().coins;
    box.hidden = false;
    box.dataset.state = st;
    $('.detail-thumb').dataset.tier = b.rarity;
    $('.detail-thumb').innerHTML = bookSvg(school, b.tier);
    $('.detail-head').dataset.state = st;
    $('#bookTitle').textContent = b.title;
    $('#bookTitle').dataset.tier = b.rarity;
    $('#bookMeta').textContent = `${ROMAN[b.tier]}급 · ${b.rarityKo} · ${b.schoolKo} 유파`;
    $('#bookMeta').dataset.tier = b.rarity;
    $('#bookEffect').textContent = b.effect + (b.provisional ? ' (임시)' : '');
    $('#bookList').hidden = !b.list;
    $('#bookList').innerHTML = (b.list ?? []).map((n) => `<li>${n}</li>`).join('');
    $('#bookSource').textContent = `출처 · ${b.source}`;
    const head = headPriceOf(b.tier); // 머리로 사는 값 — 사장님 확인 전 (지금 null — 단추 없음)
    $('#bookState').textContent = test ? '테스트 경로 — 모든 책이 열려 있습니다'
      : st === 'unowned' ? `금화 ${b.price}${head != null ? ` · 머리 ${head}` : ''}${coins < b.price ? ` — 금화가 모자랍니다 (가진 금화 ${coins})` : ''}`
        : st === 'use' ? '사용 중 — 싸움에서 켜짐' : '봉인 — 싸움에서 꺼짐';
    $('#buyBook').hidden = test || st !== 'unowned';
    $('#buyBook').textContent = `구입 · 금화 ${b.price}`;
    $('#buyBook').disabled = coins < b.price;
    for (const id of ['#useBook', '#sealBook']) $(id).hidden = test || st === 'unowned';
    $('#useBook').disabled = st === 'use';
    $('#sealBook').disabled = st === 'sealed';
  }

  function select(tier, node = null) {
    selected = selected === tier ? null : tier;
    lastNode = node;
    render();
    if (selected) $('#bookTitle').focus({ preventScroll: true });
  }
  function selectTab(tab) {
    for (const t of tabs) { const sel = t === tab; t.setAttribute('aria-selected', String(sel)); t.tabIndex = sel ? 0 : -1; }
    school = tab.dataset.school; selected = null; render();
  }
  for (const tab of tabs) {
    on(tab, 'click', () => selectTab(tab));
    on(tab, 'keydown', (e) => {
      const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (k == null && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const i = tabs.indexOf(tab), next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + k + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  }
  on($('.tree-nodes'), 'click', (e) => { const n = e.target.closest('.book-node'); if (n) select(+n.dataset.book, n); });
  on($('.detail-close'), 'click', () => { const n = lastNode; selected = null; render(); root.querySelector(`.book-node[data-book="${n?.dataset.book}"]`)?.focus(); });
  on($('#buyBook'), 'click', () => {
    const b = booksOf(school)[selected - 1];
    const r = buyBook(school, b.tier);
    announce(r.ok ? `${b.title} 구입 — 금화 ${b.price}${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'coins' ? '금화가 모자랍니다.' : '살 수 없습니다.');
    render(); onWallet();
  });
  for (const [id, use] of [['#useBook', true], ['#sealBook', false]]) on($(id), 'click', () => {
    const b = booksOf(school)[selected - 1];
    const saved = setBookInUse(b.id, use);
    announce(`${b.title} ${use ? '사용' : '봉인'}${saved ? '' : '. 이번 실행 동안 유지됩니다.'}`);
    render();
  });
  render();
  return {
    refresh: render,
    show(s, tier = null) { const tab = tabs.find((t) => t.dataset.school === s); if (tab) selectTab(tab); if (tier) select(tier); },
    destroy() { events.abort(); },
  };
}
