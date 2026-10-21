// 대기실 스킬 화면 (10/21 사장님 확정 스킬트리 — docs/design/skill_tree_2026-10-21/ · IMPLEMENTATION.md §5) — 유파 탭 다섯 · 탭마다 11 칸 트리.
//  사장님 10/21 18:3x '디아블로나 WOW처럼. 어떤 스킬을 찍으면 다음 스킬을 찍을 수 있고, 어떤 건 분기점이 되기도 … 유파마다 분기점이나 갈래의 모양이 조금씩 다르면 좋아' ·
//   18:4x '시작은 무조건 보법부터 … 보법 심화는 선택적인 곁가지로'. (전: 10/16 별자리 다섯 권 — 옛 스킬북은 skill_tree_store.js 가 한 번 거두고 돌려줌)
//  칸 상태 넷 (skill_tree_data.js nodeState): 잠김 = 흐리게(앞 칸이 모자람) · 배울 수 있음 = 금색 테두리 + 값 · 익힘 = 갈래 색으로 채우고 빛 · 준비 중 = 점선(닫힌 비기 · 일본 손목 치기 심화).
//  줄 = 그림 모양 그대로(앞 칸 아래 → 뒤 칸 위 곡선): 곁가지(편지 · 보법 II)는 점선 · 앞 칸을 '모두' 익혀야 하는 칸은 줄이 만나는 곳에 금색 점 · 독일 2단계 관문은 가로 띠 하나.
//  칸을 누르면 판 위에 상세 카드: 이름(원어는 여기서만 — 화면 글 지침 §1) · 갈래 · 효과 한 줄 · 먼저 익힐 칸 · 값(금화 · 머리 그림) · '배우기'(또는 못 배우는 까닭).
//  유파 초기화: 판 오른쪽 위 '초기화' — 머리 1 · 확인 단계(돌려받는 금화 · 머리와 드는 머리를 보임) · 익힌 칸이 없거나 머리 0 이면 못 누름 · 다른 유파는 그대로.
//  꾸밈: 판 틀은 픽셀 결(창의 액자 1 — 겉) · 칸 · 줄 · 카드는 매끈(속 — 스타일 규칙 '겉은 픽셀, 속은 매끈', docs/design_language.md §5). 색은 싸움 화면 토큰과 등급 색(--tier-*) — 글자는 entrance_type.css, 자리는 lobby.css '스킬' 칸.
//  폰 가로(844 × 390 — 판 약 386 × 216 px)에 맞게 칸 크기 · 줄 간격을 판 크기에서 셈(layout). 줄이 많아 판에 안 들면(이탈리아 6 줄) 판 안에서 아래로 내려 본다. 잰 도구 tools/browser/skill_tree_layout.mjs
import { TREE_SCHOOLS, TREE, NODE_CAT, nodesOf, nodeOf, nodeState, canLearn, isClosed, nodeEff, RESET_HEADS } from './skill_tree_data.js';
import { readLearned, learnNode, resetPreview, resetSchool } from './skill_tree_store.js';
import { readProgress } from './lobby_progress.js';
import { TRADITIONS } from './schools.js';
import { PLAYER_UNIQUE, uniqueDef } from './unique_assist.js';
import { COIN_SRC, POUCH_SRC } from './wallet_icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// 값 그림 — 대기실 지갑과 같은 금화 · 천 주머니(wallet_icons.js — 꾸밈이라 감춤: 단추 이름이 '금화 N · 머리 N' 을 읽는다)
const COIN = `<img class="price-icon" src="${COIN_SRC}" alt="" aria-hidden="true" draggable="false">`;
const POUCH = `<img class="price-icon" src="${POUCH_SRC}" alt="" aria-hidden="true" draggable="false">`;
const won = (v) => v.toLocaleString('ko-KR');
/** 값 표시 (그림 + 숫자 — 글 없음): 금화만 · 머리만 · 둘 다 */
const priceHtml = (coins, heads) => [coins ? `<span class="price-part">${COIN}${won(coins)}</span>` : '', heads ? `<span class="price-part">${POUCH}${won(heads)}</span>` : ''].join('');
const priceWords = (coins, heads) => [coins ? `금화 ${won(coins)}` : '', heads ? `머리 ${won(heads)}` : ''].filter(Boolean).join(' · ');
const STATE_KO = { learned: '익힘', open: '배울 수 있음', locked: '잠김', closed: '준비 중' };

// 원어 (사장님 10/19 02:0x '대기실 스킬에서만 원어 병기') — 패시브 이름 · 원어 (config SCHOOL_PASSIVE 이름 — 10/21)
const PASSIVE_NAME = {
  german: ['인데스', 'Indes'],
  italian: ['곧은 선 (리네아 레타)', 'linea retta'],
  iberian: ['손목 힘', null],
  japanese: ['기다림과 침 (켄타이)', '懸待'],
  chinese: ['숨 바꾸기 (토납)', '吐納'],
};
/** 기술 이름: '뜻 (소리)' + 원어 → '뜻 (소리 · 원어)'. 원어가 없으면 그대로 */
export function withOrig(nameKo, orig) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(nameKo ?? '');
  if (!orig) return nameKo ?? '';
  return m ? `${m[1]} (${m[2]} · ${orig})` : `${nameKo} (${orig})`;
}
const ROLE_KO = { enh: '강화동작', step: '걸음 기술', chain: '이어 긋기' }; // 공지와 같은 말 (10/22 '걸음 명령' → '걸음 기술')
/** 상세 카드 제목 · 갈래 글 */
export function nodeTitle(school, n) {
  const cat = NODE_CAT[n.cat];
  if (isClosed(school, n)) return { title: n.cat === 'secret' ? '비기' : n.title ?? `${n.l1} · ${n.l2}`, kind: cat.label };
  if (n.u) {
    const e = PLAYER_UNIQUE[school]?.find((x) => x.name === n.u), U = e && uniqueDef(school, e);
    return { title: U ? withOrig(U.nameKo, U.orig) : `${n.l1} ${n.l2}`, kind: e ? `${cat.label} · ${ROLE_KO[e.role] ?? ''}`.replace(/ · $/, '') : cat.label };
  }
  if (n.cat === 'passive') { const [nm, o] = PASSIVE_NAME[school] ?? [n.l2, null]; return { title: `패시브 · ${withOrig(nm, o)}`, kind: cat.label }; }
  if (n.cat === 'secret') { const S = TRADITIONS[school]?.secret, rd = /\(([^()]*)\)/.exec(S?.nameKo ?? '')?.[1]; return { title: `비기 · ${S?.orig && rd ? `${S.nameKo.replace(/\s*\(.*$/, '')} (${rd} · ${S.orig})` : S?.nameKo ?? n.l2}`, kind: cat.label }; }
  return { title: withOrig(n.title ?? `${n.l1} · ${n.l2}`, n.orig), kind: cat.label };
}
/** 칸 이름 (알림 · 화면 읽기 — 가운뎃점 없이): 고유 공격 = 기술 이름의 뜻(비껴 딛는 가로베기) · 심화 = '곁눈 베기 심화' · 편지 = '뉘른베르크에서 온 편지' · 그 밖 = 두 줄 이어서(보법 II 간격 잡기) */
function nameOf(school, n) {
  if (n.u) { const e = PLAYER_UNIQUE[school]?.find((x) => x.name === n.u), U = e && uniqueDef(school, e); if (U?.nameKo) return U.nameKo.replace(/\s*\(.*$/, ''); }
  if (n.title && (n.cat === 'deep' || n.cat === 'letter')) return n.title.split(' · ')[0];
  return `${n.l1} ${n.l2}`;
}
/** 먼저 익힐 칸 글: 보법 · 막기 · 패시브 · 비기는 갈래 이름(보법 I · 막기 II), 그 밖은 칸 이름 */
const preName = (school, n) => (['foot', 'parry', 'passive', 'secret'].includes(n.cat) ? n.l1 : nameOf(school, n));
const shortName = nameOf;

// 글 폭 (em) — 한글 1 · 빈칸 0.3 · 그 밖 0.6 (칸에 글이 안 들면 글자를 줄인다)
const emWidth = (t) => [...String(t)].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.62), 0);

/**
 * root: 스킬 칸(Shadow root 안의 #skillTreeHost) · test: 테스트 경로(모든 칸 익힘 — 배우기 · 초기화 없음) · onWallet(): 금화 · 머리 · 레벨이 바뀌면(대기실 내 정보 칸 다시 그리기) ·
 * announce(text): 화면 읽기 알림
 */
export function mountSkillTree(root, { test = false, onWallet = () => {}, announce = () => {} } = {}) {
  root.innerHTML = `<div class="school-tabs" role="tablist" aria-label="유파">${TREE_SCHOOLS.map((s, i) => `<button role="tab" data-school="${s}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${TRADITIONS[s].nameKo}</button>`).join('')}</div>
    <div class="tree-frame card-frame"><div class="tree-scroll"><div class="tree-board" role="tabpanel"><svg class="tree-links" aria-hidden="true"></svg><div class="tree-nodes"></div></div></div>
    <button type="button" class="tree-reset" id="treeReset"><span>초기화</span><span class="price-part">${POUCH}${RESET_HEADS}</span></button>
    <section class="node-detail" hidden aria-labelledby="nodeTitle"><button type="button" class="detail-close" aria-label="설명 닫기">×</button>
      <div class="detail-head"><b id="nodeTitle" tabindex="-1"></b><small id="nodeMeta"></small></div>
      <p id="nodeEffect" class="detail-effect"></p><p id="nodePre" class="detail-pre"></p><p id="nodePrice" class="detail-price"></p><p id="nodeState" class="detail-state" role="status"></p>
      <div class="detail-actions start-actions"><button type="button" id="learnNode">배우기</button></div>
    </section>
    <section class="reset-confirm" hidden aria-labelledby="resetTitle"><b id="resetTitle" tabindex="-1"></b><p id="resetBody"></p><p id="resetPrice" class="detail-price"></p>
      <div class="confirm-actions"><button type="button" class="secondary" id="resetCancel">취소</button><button type="button" class="primary" id="resetOk">초기화</button></div>
    </section></div>`;
  const events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const $ = (sel) => root.querySelector(sel);
  const tabs = [...root.querySelectorAll('.school-tabs [role=tab]')];
  const frame = $('.tree-frame'), scroller = $('.tree-scroll'), board = $('.tree-board');
  let school = TREE_SCHOOLS[0], selected = null, lastNode = null, geo = null;
  const learnedNow = () => (test ? new Set(nodesOf(school).map((n) => n.id)) : readLearned()[school]);
  const stateOf = (n, learned) => (test && !isClosed(school, n) ? 'learned' : nodeState(school, n, learned));

  // ── 자리 셈: 판 폭 · 높이에서 칸 크기 · 줄 간격 (줄이 많아 판에 안 들면 판을 늘려 안에서 내려 본다) ──
  function layout() {
    const W = scroller.clientWidth, H = scroller.clientHeight;
    if (!W || !H) return null;
    const nodes = nodesOf(school), rows = Math.max(...nodes.map((n) => n.d)) + 1;
    let gap = Infinity; // 같은 줄 칸 사이 가장 좁은 cx
    for (const a of nodes) for (const b of nodes) if (a !== b && a.d === b.d) gap = Math.min(gap, Math.abs(a.cx - b.cx));
    const half = Math.max(...nodes.map((n) => Math.abs(n.cx - 500))); // 가로 범위 = 뿌리(500) 둘레로 맞춤 — 뿌리가 늘 가운데
    const c0 = 500 - half, span = 2 * half || 1;
    const s = Math.min(1.5, Math.max(0.85, W / 386)); // 글자 · 틈 비 (폰 가로 판 386 px = 1)
    const g = gap / span, m = 5 * s; // 칸 사이 틈 m: 칸 폭 w 일 때 이웃 칸 간격 = g × (W − w − 6) ≥ w + m
    const nodeW = Math.floor(Math.max(46, Math.min(84 * s, (g * (W - 6) - m) / (1 + g))));
    const nodeH = Math.round(Math.max(28, Math.min(40, 28 * s)));
    const pill = Math.round(10 * s); // 값 알약이 칸 아래로 나오는 몫
    const top = 5, bottom = pill + 2;
    const pitch = Math.max(nodeH + pill + 2, rows > 1 ? (H - top - bottom - nodeH) / (rows - 1) : 0);
    const height = Math.ceil(top + nodeH + pitch * (rows - 1) + bottom);
    const padX = nodeW / 2 + 3;
    const x = (cx) => padX + ((cx - c0) / span) * (W - 2 * padX);
    const y = (d) => top + nodeH / 2 + d * pitch;
    return { W, H, height, nodeW, nodeH, pitch, s, x, y, scroll: height > H + 0.5 };
  }

  function drawLinks(learned) {
    const svg = $('.tree-links'), g = geo, T = TREE[school];
    svg.setAttribute('viewBox', `0 0 ${g.W} ${g.height}`);
    svg.setAttribute('width', g.W);
    svg.setAttribute('height', g.height);
    const parts = [];
    const bottomOf = (n) => [g.x(n.cx), g.y(n.d) + g.nodeH / 2], topOf = (n) => [g.x(n.cx), g.y(n.d) - g.nodeH / 2];
    const curve = ([x0, y0], [x1, y1]) => { const m = (y0 + y1) / 2; return `M${x0.toFixed(1)} ${y0.toFixed(1)} C${x0.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const cls = (from, to) => ['tree-link', to.opt ? 'opt' : '', learned.has(from.id) && learned.has(to.id) ? 'lit' : learned.has(from.id) && !isClosed(school, to) ? 'ready' : ''].filter(Boolean).join(' ');
    const gate = T.gate;
    if (gate) { // 독일 관문 — 2단계 셋 아래 가로 띠 하나 → 3단계 셋 (사장님 18:5x '기본기를 중시')
      const from = gate.from.map((id) => nodeOf(school, id)), to = gate.to.map((id) => nodeOf(school, id));
      const yb = (g.y(from[0].d) + g.nodeH / 2 + g.y(to[0].d) - g.nodeH / 2) / 2;
      const xs = [...from, ...to].map((n) => g.x(n.cx));
      const allIn = from.every((n) => learned.has(n.id));
      parts.push(`<path class="tree-link gate${allIn ? ' lit' : ''}" d="M${Math.min(...xs).toFixed(1)} ${yb.toFixed(1)} H${Math.max(...xs).toFixed(1)}"/>`);
      for (const n of from) { const [x0, y0] = bottomOf(n); parts.push(`<path class="tree-link${learned.has(n.id) ? ' lit' : ''}" d="M${x0.toFixed(1)} ${y0.toFixed(1)} V${yb.toFixed(1)}"/>`); }
      for (const n of to) { const [x1, y1] = topOf(n); parts.push(`<path class="tree-link${allIn && learned.has(n.id) ? ' lit' : allIn ? ' ready' : ''}" d="M${x1.toFixed(1)} ${yb.toFixed(1)} V${y1.toFixed(1)}"/>`); }
    }
    for (const n of nodesOf(school)) {
      if (gate?.to.includes(n.id)) continue;
      for (const pid of n.pre) parts.push(`<path class="${cls(nodeOf(school, pid), n)}" d="${curve(bottomOf(nodeOf(school, pid)), topOf(n))}"/>`);
      if (n.pre.length > 1) { const [x1, y1] = topOf(n); parts.push(`<circle class="tree-join" cx="${x1.toFixed(1)}" cy="${(y1 - 1).toFixed(1)}" r="${(2.6 * g.s).toFixed(1)}"/>`); } // '모두 익혀야' 표지 (그림의 금색 줄)
    }
    svg.innerHTML = parts.join('');
  }

  function size() {
    geo = layout();
    if (!geo) return;
    board.style.width = `${geo.W}px`;
    board.style.height = `${geo.height}px`;
    board.style.setProperty('--nw', `${geo.nodeW}px`);
    board.style.setProperty('--nh', `${geo.nodeH}px`);
    board.style.setProperty('--s', geo.s.toFixed(3));
    scroller.dataset.scroll = geo.scroll ? 'y' : '';
    more();
  }
  // 아래로 더 볼 칸이 있나 (판이 창보다 길고 아직 끝까지 안 내림) — 아래 끝 흐림 (lobby.css .tree-frame[data-more])
  function more() {
    const left = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    if (left > 2) frame.dataset.more = ''; else delete frame.dataset.more;
  }
  function render() {
    size();
    if (geo && scroller.clientWidth !== geo.W) size(); // 내림 막대가 생기거나 없어져 폭이 바뀌면 한 번 더 (가로로 넘치지 않게)
    const learned = learnedNow(), P = readProgress();
    root.dataset.school = school;
    board.setAttribute('aria-label', `${TRADITIONS[school].nameKo} 스킬트리`);
    if (geo) {
      $('.tree-nodes').innerHTML = nodesOf(school).map((n) => {
        const st = stateOf(n, learned), cat = NODE_CAT[n.cat];
        const l2 = st === 'closed' ? '준비 중' : n.l2;
        const f1 = Math.min(10.5 * geo.s, (geo.nodeW - 6) / emWidth(n.l1)), f2 = Math.min(9.5 * geo.s, (geo.nodeW - 6) / emWidth(l2));
        const price = st === 'open' ? `<span class="node-price">${priceHtml(n.price, n.heads)}</span>` : '';
        const label = `${shortName(school, n)} · ${STATE_KO[st]}${st === 'open' ? ` · ${priceWords(n.price, n.heads)}` : ''}`;
        return `<button type="button" class="tree-node" data-node="${n.id}" data-cat="${n.cat}" data-tier="${cat.tier}" data-state="${st}" style="left:${geo.x(n.cx).toFixed(1)}px;top:${geo.y(n.d).toFixed(1)}px" aria-label="${label}" aria-pressed="${selected === n.id}">
          <span class="node-l1" style="font-size:${f1.toFixed(2)}px">${n.l1}</span><span class="node-l2" style="font-size:${f2.toFixed(2)}px">${l2}</span>${price}</button>`;
      }).join('');
      drawLinks(learned);
    }
    renderReset(learned, P);
    renderDetail(learned, P);
  }

  function renderReset(learned, P) {
    const btn = $('#treeReset'), pre = resetPreview(school, P);
    btn.hidden = test;
    btn.disabled = !pre.ok;
    const why = pre.why === 'empty' ? '익힌 칸이 없습니다' : pre.why === 'heads' ? '머리가 모자랍니다' : '';
    btn.setAttribute('aria-label', `${TRADITIONS[school].nameKo} 스킬 초기화 · 머리 ${RESET_HEADS}${why ? ` · ${why}` : ''}`);
    btn.title = why;
  }

  function renderDetail(learned = learnedNow(), P = readProgress()) {
    const box = $('.node-detail');
    const n = selected && nodeOf(school, selected);
    if (!n) { box.hidden = true; return; }
    const st = stateOf(n, learned), cat = NODE_CAT[n.cat], { title, kind } = nodeTitle(school, n);
    box.hidden = false;
    box.dataset.state = st;
    box.dataset.tier = cat.tier;
    $('#nodeTitle').textContent = title;
    $('#nodeTitle').dataset.tier = cat.tier;
    $('#nodeMeta').textContent = `${kind} · ${TRADITIONS[school].nameKo} 유파${test ? '' : ` · ${STATE_KO[st]}`}`;
    $('#nodeMeta').dataset.tier = cat.tier;
    $('#nodeEffect').textContent = st === 'closed' ? '준비 중입니다.' : nodeEff(school, n);
    const pre = n.pre.map((id) => preName(school, nodeOf(school, id)));
    $('#nodePre').textContent = pre.length ? `먼저 익힐 칸: ${pre.join(' · ')}${pre.length > 1 ? ' (모두)' : ''}` : '처음 익히는 칸입니다.';
    $('#nodePrice').innerHTML = st === 'closed' ? '' : `<span class="sr-only">값 ${priceWords(n.price, n.heads)}</span><span aria-hidden="true">${priceHtml(n.price, n.heads)}</span>`;
    $('#nodePrice').hidden = st === 'closed' || st === 'learned' || test;
    const can = canLearn(school, n, learned, P);
    const note = test ? '테스트 경로에서는 모든 칸을 익힌 것으로 봅니다.'
      : st === 'learned' ? '익힌 칸입니다.'
      : st === 'closed' ? '아직 배울 수 없습니다.'
      : can.why === 'pre' ? '먼저 익힐 칸이 있습니다.'
      : can.why === 'coins' ? `금화가 모자랍니다. 가진 금화 ${won(P.coins)}`
      : can.why === 'heads' ? `머리가 모자랍니다. 가진 머리 ${won(P.heads)}` : '';
    $('#nodeState').textContent = note;
    $('#nodeState').hidden = !note;
    const btn = $('#learnNode');
    btn.hidden = test || st === 'learned';
    btn.disabled = !can.ok;
    btn.innerHTML = st === 'closed' ? '준비 중' : `배우기`;
  }

  function select(id, node = null) {
    selected = selected === id ? null : id;
    lastNode = node;
    closeReset(false);
    render();
    if (selected) $('#nodeTitle').focus({ preventScroll: true });
  }
  function selectTab(tab) {
    for (const t of tabs) { const sel = t === tab; t.setAttribute('aria-selected', String(sel)); t.tabIndex = sel ? 0 : -1; }
    school = tab.dataset.school; selected = null; closeReset(false); scroller.scrollTop = 0; render();
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
  on($('.tree-nodes'), 'click', (e) => { const n = e.target.closest('.tree-node'); if (n) select(n.dataset.node, n); });
  on($('.detail-close'), 'click', () => { const id = lastNode?.dataset.node; selected = null; render(); root.querySelector(`.tree-node[data-node="${id}"]`)?.focus(); });
  on($('#learnNode'), 'click', () => {
    const n = nodeOf(school, selected);
    if (!n) return;
    const r = learnNode(school, n.id);
    announce(r.ok ? `${shortName(school, n)} 익힘 — ${priceWords(n.price, n.heads)}${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'coins' ? '금화가 모자랍니다.' : r.why === 'heads' ? '머리가 모자랍니다.' : '배울 수 없습니다.');
    render(); onWallet();
  });
  // ── 유파 초기화 (머리 1 · 확인 단계) ──
  function openReset() {
    const pre = resetPreview(school);
    if (!pre.ok || test) return;
    selected = null; render();
    const box = $('.reset-confirm');
    $('#resetTitle').textContent = `${TRADITIONS[school].nameKo} 스킬 초기화`;
    $('#resetBody').textContent = `익힌 칸 ${pre.count}개를 모두 지우고 쓴 값을 돌려받습니다. 레벨도 ${pre.count}만큼 내려갑니다.`;
    $('#resetPrice').innerHTML = `<span class="price-row"><span class="price-label">돌려받음</span>${priceHtml(pre.coins, pre.heads) || '<span class="price-part">0</span>'}</span><span class="price-row"><span class="price-label">드는 값</span>${priceHtml(0, pre.cost)}</span>`;
    box.hidden = false;
    $('#resetTitle').focus({ preventScroll: true });
  }
  function closeReset(refocus = true) {
    const box = $('.reset-confirm');
    if (box.hidden) return;
    box.hidden = true;
    if (refocus) $('#treeReset').focus({ preventScroll: true });
  }
  on(scroller, 'scroll', more);
  on($('#treeReset'), 'click', openReset);
  on($('#resetCancel'), 'click', () => closeReset());
  on($('#resetOk'), 'click', () => {
    const r = resetSchool(school);
    closeReset(false);
    announce(r.ok ? `${TRADITIONS[school].nameKo} 스킬 초기화 — 칸 ${r.count}개 · 돌려받음 ${priceWords(r.coins, r.heads) || '0'} · 머리 ${RESET_HEADS} 사용${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'heads' ? '머리가 모자랍니다.' : '초기화할 칸이 없습니다.');
    render(); onWallet();
    $('#treeReset').focus({ preventScroll: true });
  });
  on(root, 'keydown', (e) => { if (e.key === 'Escape' && !$('.reset-confirm').hidden) { e.preventDefault(); closeReset(); } });
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => render()) : null;
  sizer?.observe(frame);
  render();
  return {
    refresh: render,
    show(s, id = null) { const tab = tabs.find((t) => t.dataset.school === s); if (tab) selectTab(tab); if (id) select(id); },
    destroy() { events.abort(); sizer?.disconnect(); },
  };
}
