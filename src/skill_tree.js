// 대기실 스킬 화면 (10/21 사장님 확정 스킬트리 — docs/design/skill_tree_2026-10-21/ · IMPLEMENTATION.md §5 · §8) — 유파 탭 다섯 · 탭마다 11 칸 트리.
//  사장님 10/21 18:3x '디아블로나 WOW처럼. 어떤 스킬을 찍으면 다음 스킬을 찍을 수 있고, 어떤 건 분기점이 되기도 … 유파마다 분기점이나 갈래의 모양이 조금씩 다르면 좋아' ·
//   18:4x '시작은 무조건 보법부터 … 보법 심화는 선택적인 곁가지로'. (전: 10/16 별자리 다섯 권 — 옛 스킬북은 skill_tree_store.js 가 한 번 거두고 돌려줌)
//  칸 = 그림 + 기술 이름 (사장님 10/22 00:2x '기존에 가지고 있던 아이콘이 사라져서 서운한데?' · 00:4x '보법1 보법2 이런 건 우리가 보려고 만든 범주 구분 … 기술 이름이 보이는 게'):
//   그림은 옛 스킬북 그림을 갈래대로(skill_tree_icons.js) · 이름은 칸 name(긴 이름은 낱말 경계에서 두 줄) · 갈래 말(보법 I · 막기 II · 심화 …)은 상세 카드 갈래 줄에만.
//  칸 상태 넷 (skill_tree_data.js nodeState): 잠김 = 이름 보조 색 · 그림 조금 흐리게(앞 칸이 모자람) · 배울 수 있음 = 금색 테두리 + 값 알약 · 익힘 = 갈래 색으로 채우고 빛 · 그림 제 색 ·
//   준비 중 = 점선 · 그림 잿빛 + 칸 아래 '준비 중' 알약(닫힌 비기 · 일본 손목 치기 심화).
//  줄 = 그림 모양 그대로(앞 칸 아래 → 뒤 칸 위 곡선): 곁가지(편지 · 보법 II)는 점선 · 앞 칸을 '모두' 익혀야 하는 칸은 줄이 만나는 곳에 금색 점 · 독일 2단계 관문은 가로 띠 하나.
//  칸을 누르면 상세 카드(유파 탭까지 덮음): 그림 · 이름(원어는 여기서만 — 화면 글 지침 §1) · 검술서 오의(lore) · 출처(src) · 효과 한 줄(작게) · 갈래 · 유파 · 상태 · 먼저 익힐 칸(잠김일 때) · 값 · '배우기'.
//   화면 읽기 차례 = 이름 · 오의 · 출처 · 효과 (사장님 10/22 00:5x '검술서나 참고 문헌에서의 오의를 밝힌 예전 방식이 더 나았던 거 같아' — 갈래 줄은 보이기만 위, 읽기는 효과 뒤).
//  유파 초기화: 판 맨 위 오른쪽(뿌리 칸 줄 · 판과 함께 내려감) '초기화' — 머리 1 · 확인 단계 · 누르는 높이 40 px(10/22 '너무 낮아 누르기 힘듭니다') · 익힌 칸이 없거나 머리 0 이면 못 누름.
//  꾸밈: 판 틀은 픽셀 결(창의 액자 1 — 겉) · 칸 · 줄 · 카드는 매끈(속 — 스타일 규칙 '겉은 픽셀, 속은 매끈', docs/design_language.md §5). 색은 싸움 화면 토큰과 등급 색(--tier-*) — 글자는 entrance_type.css, 자리는 lobby.css '스킬' 칸.
//  자리(layout): 모든 유파가 판 안에서 아래로 내려 보는 판 (사장님 10/22 00:3x '이탈리아 스킬트리처럼, 어차피 … 스크롤이 필요하니까, 지금보다 간격을 더 넓고 자연스럽게') —
//   칸 크기 · 줄 간격은 판 폭에서 셈(높이에 맞춰 줄이지 않음) · 가로는 판 폭 안(가장 붐비는 줄의 틈에서 칸 폭) · 이름이 좁으면 그 칸만 이웃이 허락하는 만큼 넓힘.
//   첫 화면에 뿌리 줄이 보이고 아래 끝은 흐림 + 꺾쇠(더 있음). 잰 도구 tools/browser/skill_tree_layout.mjs
import { TREE_SCHOOLS, TREE, NODE_CAT, nodesOf, nodeOf, nodeState, canLearn, isClosed, nodeEff, RESET_HEADS } from './skill_tree_data.js';
import { readLearned, learnNode, resetPreview, resetSchool } from './skill_tree_store.js';
import { readProgress } from './lobby_progress.js';
import { TRADITIONS } from './schools.js';
import { PLAYER_UNIQUE, uniqueDef } from './unique_assist.js';
import { COIN_SRC, POUCH_SRC } from './wallet_icons.js';
import { nodeIconSrc } from './skill_tree_icons.js';

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
/** 칸 이름 (판 칸 · 알림 · 화면 읽기 · 먼저 익힐 칸 — 칸 name, 사장님 10/22. 옛 자료에 없으면 두 줄 이어서) */
const nameOf = (n) => n.name ?? `${n.l1} ${n.l2}`;
/** 상세 카드 제목 · 갈래 글 (닫힌 칸은 판 칸과 같은 이름 — 원어 없이) */
export function nodeTitle(school, n) {
  const cat = NODE_CAT[n.cat];
  if (isClosed(school, n)) return { title: nameOf(n), kind: cat.label };
  if (n.u) {
    const e = PLAYER_UNIQUE[school]?.find((x) => x.name === n.u), U = e && uniqueDef(school, e);
    return { title: U ? withOrig(U.nameKo, U.orig) : nameOf(n), kind: e ? `${cat.label} · ${ROLE_KO[e.role] ?? ''}`.replace(/ · $/, '') : cat.label };
  }
  if (n.cat === 'passive') { const [nm, o] = PASSIVE_NAME[school] ?? [n.l2, null]; return { title: `패시브 · ${withOrig(nm, o)}`, kind: cat.label }; }
  if (n.cat === 'secret') { const S = TRADITIONS[school]?.secret, rd = /\(([^()]*)\)/.exec(S?.nameKo ?? '')?.[1]; return { title: `비기 · ${S?.orig && rd ? `${S.nameKo.replace(/\s*\(.*$/, '')} (${rd} · ${S.orig})` : S?.nameKo ?? n.l2}`, kind: cat.label }; }
  return { title: withOrig(n.title ?? `${n.l1} · ${n.l2}`, n.orig), kind: cat.label };
}

// 글 폭 (em) — 한글 1 · 빈칸 0.3 · 그 밖 0.6 (칸에 글이 안 들면 글자를 줄인다)
const emWidth = (t) => [...String(t)].reduce((a, ch) => a + (/[가-힣]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.62), 0);
/** 이름의 줄 나눔 후보: 한 줄 + 낱말 경계 두 줄 (한글은 낱말 가운데서 줄을 바꾸지 않는다 — entrance_type.css keep-all) */
const splits = (name) => { const w = String(name).split(' '); return [[w.join(' ')], ...w.slice(1).map((_, k) => [w.slice(0, k + 1).join(' '), w.slice(k + 1).join(' ')])]; };
const lineEm = (lines) => Math.max(...lines.map(emWidth));
/**
 * 칸 이름 줄 (tw = 글 폭 px · F = 글자 크기 상한) → { lines, font }: 글자가 가장 크게 드는 나눔 — 두 줄끼리 같으면 고른 쪽.
 *  예: '뉘른베르크에서 온 편지' → ['뉘른베르크에서', '온 편지'] · '돌며 베기'(한 줄에 듦) → ['돌며 베기'] — 두 줄은 글자가 6 % 넘게 커질 때만
 */
export function nameLines(name, tw, F) {
  let best = null;
  for (const lines of splits(name)) {
    const em = lineEm(lines), font = Math.min(F, tw / em);
    // 두 줄은 글자가 6 % 넘게 커질 때만 (거의 같으면 한 줄 — 짧은 이름이 괜히 접히지 않게)
    const gain = best ? (best.lines.length === 1 ? font / best.font - 1.06 : font - best.font - 0.01) : 1;
    if (!best || gain > 0 || (Math.abs(font - best.font) <= 0.01 && lines.length === 2 && best.lines.length === 2 && em < best.em)) best = { lines, font, em };
  }
  return best;
}
/** 이름이 바랄 수 있는 가장 좁은 글 폭 (em — 가장 고른 나눔) */
const minNameEm = (name) => Math.min(...splits(name).map(lineEm));

/**
 * root: 스킬 칸(Shadow root 안의 #skillTreeHost) · test: 테스트 경로(모든 칸 익힘 — 배우기 · 초기화 없음) · onWallet(): 금화 · 머리 · 레벨이 바뀌면(대기실 내 정보 칸 다시 그리기) ·
 * announce(text): 화면 읽기 알림
 */
export function mountSkillTree(root, { test = false, onWallet = () => {}, announce = () => {} } = {}) {
  root.innerHTML = `<div class="school-tabs" role="tablist" aria-label="유파">${TREE_SCHOOLS.map((s, i) => `<button role="tab" data-school="${s}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${TRADITIONS[s].nameKo}</button>`).join('')}</div>
    <div class="tree-frame card-frame"><div class="tree-scroll"><div class="tree-board" role="tabpanel"><svg class="tree-links" aria-hidden="true"></svg><div class="tree-nodes"></div>
      <button type="button" class="tree-reset" id="treeReset"><span>초기화</span><span class="price-part">${POUCH}${RESET_HEADS}</span></button></div></div>
    <section class="reset-confirm" hidden aria-labelledby="resetTitle"><b id="resetTitle" tabindex="-1"></b><p id="resetBody"></p><p id="resetPrice" class="detail-price"></p>
      <div class="confirm-actions"><button type="button" class="secondary" id="resetCancel">취소</button><button type="button" class="primary" id="resetOk">초기화</button></div>
    </section></div>
    <section class="node-detail" hidden aria-labelledby="nodeTitle"><button type="button" class="detail-close" aria-label="설명 닫기">×</button>
      <img class="detail-icon" id="nodeIcon" alt="" aria-hidden="true" draggable="false"><b id="nodeTitle" class="detail-title" tabindex="-1"></b>
      <figure class="detail-lore" id="nodeLoreBox"><blockquote id="nodeLore"></blockquote><figcaption id="nodeSrc"></figcaption></figure>
      <div class="detail-body"><p id="nodeEffect" class="detail-effect"></p><p id="nodePre" class="detail-pre"></p><p id="nodeState" class="detail-state" role="status"></p></div>
      <small id="nodeMeta" class="detail-meta"></small>
      <div class="detail-act"><p id="nodePrice" class="detail-price"></p><div class="detail-actions start-actions"><button type="button" id="learnNode">배우기</button></div></div>
    </section>`;
  const events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const $ = (sel) => root.querySelector(sel);
  const tabs = [...root.querySelectorAll('.school-tabs [role=tab]')];
  const frame = $('.tree-frame'), scroller = $('.tree-scroll'), board = $('.tree-board');
  let school = TREE_SCHOOLS[0], selected = null, lastNode = null, geo = null;
  const learnedNow = () => (test ? new Set(nodesOf(school).map((n) => n.id)) : readLearned()[school]);
  const stateOf = (n, learned) => (test && !isClosed(school, n) ? 'learned' : nodeState(school, n, learned));

  // ── 자리 셈: 판 폭에서 칸 크기 · 줄 간격 (높이는 판에 맞춰 줄이지 않는다 — 넘치면 판 안에서 아래로 내려 봄) ──
  function layout() {
    const W = scroller.clientWidth, H = scroller.clientHeight;
    if (!W || !H) return null;
    const nodes = nodesOf(school), rows = Math.max(...nodes.map((n) => n.d)) + 1;
    let gap = Infinity; // 같은 줄 칸 사이 가장 좁은 cx
    for (const a of nodes) for (const b of nodes) if (a !== b && a.d === b.d) gap = Math.min(gap, Math.abs(a.cx - b.cx));
    const half = Math.max(...nodes.map((n) => Math.abs(n.cx - 500))); // 가로 범위 = 뿌리(500) 둘레로 맞춤 — 뿌리가 늘 가운데
    const c0 = 500 - half, span = 2 * half || 1;
    const s = Math.min(1.5, Math.max(0.85, W / 386)); // 글자 · 틈 비 (폰 가로 판 386 px = 1)
    const g = Math.min(1, gap / span);
    // 바탕 칸 폭: 가장 붐비는 줄의 이웃 칸 사이 틈 m — 넉넉히 10·s (칸 폭 w 일 때 이웃 간격 = g × (W − w − 6) ≥ w + m), 그래서 너무 좁으면 틈 5 까지
    const fit = (m) => (g * (W - 6) - m) / (1 + g);
    let nodeW = Math.min(80 * s, fit(10 * s));
    if (nodeW < 56 * s) nodeW = Math.min(56 * s, fit(5));
    nodeW = Math.floor(Math.max(44, nodeW));
    const F = 10.5 * s, Fok = 9.5 * s, inner = 6; // 이름 글자 상한 · 넉넉한 크기 · 칸 안 옆 여백 합(테두리 1 + 안쪽 2 — 양쪽)
    const ih = Math.round(28 * s), lh = Math.round(F * 1.16); // 그림 높이(256 × 336 비 — 폭 ≈ 0.76 ih) · 이름 줄 높이
    const nodeH = 2 + 3 + ih + 2 + 2 * lh + 3 + 1; // 위 띠 · 안쪽 · 그림 · 틈 · 이름 두 줄 · 안쪽 · 아래 테
    const pill = Math.round(10 * s); // 값 · '준비 중' 알약이 칸 아래로 나오는 몫
    const rowGap = Math.round(32 * s); // 칸 아래 끝 ~ 다음 줄 칸 위 끝 (알약 포함 — 줄 곡선이 보일 만큼)
    const top = 6, bottom = pill + 8, pitch = nodeH + rowGap;
    const height = Math.ceil(top + nodeH + pitch * (rows - 1) + bottom);
    const padX = nodeW / 2 + 3;
    const X = (cx) => padX + ((cx - c0) / span) * (W - 2 * padX);
    const y = (d) => top + nodeH / 2 + d * pitch;
    // 칸마다 폭: 이름이 바탕 폭에서 넉넉한 크기(Fok)를 못 얻으면 이웃(틈 5)과 판 가장자리(3)가 허락하는 만큼 넓힘 — 가장자리 칸은 안쪽으로 조금 밀림
    const pos = {};
    for (let d = 0; d < rows; d++) {
      const P = nodes.filter((n) => n.d === d).sort((a, b) => a.cx - b.cx).map((n) => ({ n, x: X(n.cx), w: nodeW }));
      P.forEach((p, i) => {
        const want = Math.min(Math.ceil(minNameEm(nameOf(p.n)) * Fok + inner), Math.round(nodeW * 1.4));
        if (want <= p.w) return;
        const L = P[i - 1], R = P[i + 1], lo = L ? L.x + L.w / 2 + 5 : 3, hi = R ? R.x - R.w / 2 - 5 : W - 3;
        const w = Math.floor(Math.min(want, hi - lo));
        if (w > p.w) { p.w = w; p.x = Math.min(Math.max(p.x, lo + w / 2), hi - w / 2); }
      });
      for (const p of P) pos[p.n.id] = { x: p.x, y: y(d), w: p.w };
    }
    return { W, H, height, nodeW, nodeH, ih, lh, F, inner, pitch, s, pos, scroll: height > H + 0.5 };
  }

  function drawLinks(learned) {
    const svg = $('.tree-links'), g = geo, T = TREE[school];
    svg.setAttribute('viewBox', `0 0 ${g.W} ${g.height}`);
    svg.setAttribute('width', g.W);
    svg.setAttribute('height', g.height);
    const parts = [];
    const px = (n) => g.pos[n.id].x, py = (n) => g.pos[n.id].y;
    const bottomOf = (n) => [px(n), py(n) + g.nodeH / 2], topOf = (n) => [px(n), py(n) - g.nodeH / 2];
    const curve = ([x0, y0], [x1, y1]) => { const m = (y0 + y1) / 2; return `M${x0.toFixed(1)} ${y0.toFixed(1)} C${x0.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${m.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const cls = (from, to) => ['tree-link', to.opt ? 'opt' : '', learned.has(from.id) && learned.has(to.id) ? 'lit' : learned.has(from.id) && !isClosed(school, to) ? 'ready' : ''].filter(Boolean).join(' ');
    const gate = T.gate;
    if (gate) { // 독일 관문 — 2단계 셋 아래 가로 띠 하나 → 3단계 셋 (사장님 18:5x '기본기를 중시')
      const from = gate.from.map((id) => nodeOf(school, id)), to = gate.to.map((id) => nodeOf(school, id));
      const yb = (py(from[0]) + g.nodeH / 2 + py(to[0]) - g.nodeH / 2) / 2 + 4 * g.s; // 띠 = 두 줄 사이 가운데에서 조금 아래 (위 칸 값 알약과 떨어지게)
      const xs = [...from, ...to].map(px);
      const allIn = from.every((n) => learned.has(n.id));
      parts.push(`<path class="tree-link gate${allIn ? ' lit' : ''}" d="M${Math.min(...xs).toFixed(1)} ${yb.toFixed(1)} H${Math.max(...xs).toFixed(1)}"/>`);
      for (const n of from) { const [x0, y0] = bottomOf(n); parts.push(`<path class="tree-link${learned.has(n.id) ? ' lit' : ''}" d="M${x0.toFixed(1)} ${y0.toFixed(1)} V${yb.toFixed(1)}"/>`); }
      for (const n of to) { const [x1, y1] = topOf(n); parts.push(`<path class="tree-link${allIn && learned.has(n.id) ? ' lit' : allIn ? ' ready' : ''}" d="M${x1.toFixed(1)} ${yb.toFixed(1)} V${y1.toFixed(1)}"/>`); }
    }
    for (const n of nodesOf(school)) {
      if (gate?.to.includes(n.id)) continue;
      for (const pid of n.pre) parts.push(`<path class="${cls(nodeOf(school, pid), n)}" d="${curve(bottomOf(nodeOf(school, pid)), topOf(n))}"/>`);
      if (n.pre.length > 1) { const [x1, y1] = topOf(n); parts.push(`<circle class="tree-join" cx="${x1.toFixed(1)}" cy="${(y1 - 1).toFixed(1)}" r="${(2.8 * g.s).toFixed(1)}"/>`); } // '모두 익혀야' 표지 (그림의 금색 줄)
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
    board.style.setProperty('--ih', `${geo.ih}px`);
    board.style.setProperty('--lh', `${geo.lh}px`);
    board.style.setProperty('--s', geo.s.toFixed(3));
    scroller.dataset.scroll = geo.scroll ? 'y' : '';
    more();
  }
  // 아래로 더 볼 칸이 있나 (판이 창보다 길고 아직 끝까지 안 내림) — 아래 끝 흐림 + 꺾쇠 (lobby.css .tree-frame[data-more])
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
        const st = stateOf(n, learned), cat = NODE_CAT[n.cat], p = geo.pos[n.id];
        const nl = nameLines(nameOf(n), p.w - geo.inner, geo.F);
        const tail = st === 'open' ? `<span class="node-price">${priceHtml(n.price, n.heads)}</span>` : st === 'closed' ? '<span class="node-soon">준비 중</span>' : '';
        const label = `${nameOf(n)} · ${STATE_KO[st]}${st === 'open' ? ` · ${priceWords(n.price, n.heads)}` : ''}`;
        return `<button type="button" class="tree-node" data-node="${n.id}" data-cat="${n.cat}" data-tier="${cat.tier}" data-state="${st}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px;width:${p.w}px;margin-left:${(-p.w / 2).toFixed(1)}px" aria-label="${label}" aria-pressed="${selected === n.id}">
          <img class="node-icon" src="${nodeIconSrc(school, n)}" alt="" aria-hidden="true" draggable="false"><span class="node-name" style="font-size:${nl.font.toFixed(2)}px">${nl.lines.map((t) => `<span class="node-line">${t}</span>`).join('')}</span>${tail}</button>`;
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
    $('#nodeIcon').src = nodeIconSrc(school, n);
    $('#nodeTitle').textContent = title;
    $('#nodeTitle').dataset.tier = cat.tier;
    // 검술서 오의 · 출처 (칸 lore · src — 없으면 상자째 숨기고 효과만)
    const lore = st === 'closed' ? '' : n.lore ?? '';
    $('#nodeLore').textContent = lore;
    $('#nodeSrc').textContent = lore ? n.src ?? '' : '';
    $('#nodeSrc').hidden = !lore || !n.src;
    $('#nodeLoreBox').hidden = !lore;
    box.dataset.lore = lore ? 'y' : '';
    $('#nodeEffect').textContent = st === 'closed' ? '준비 중입니다.' : nodeEff(school, n);
    $('#nodeMeta').textContent = `${kind} · ${TRADITIONS[school].nameKo} 유파${test ? '' : ` · ${STATE_KO[st]}`}`;
    $('#nodeMeta').dataset.tier = cat.tier;
    // 먼저 익힐 칸: 잠김일 때만 (익혔거나 배울 수 있으면 이미 채움 · 준비 중이면 못 배움 — 10/22 카드에 오의 · 출처가 들며 자리를 아낌)
    const pre = n.pre.map((id) => nameOf(nodeOf(school, id)));
    $('#nodePre').textContent = pre.length ? `먼저 익힐 칸: ${pre.join(' · ')}${pre.length > 1 ? ' (모두)' : ''}` : '';
    $('#nodePre').hidden = st !== 'locked' || !pre.length;
    $('#nodePrice').innerHTML = st === 'closed' ? '' : `<span class="sr-only">값 ${priceWords(n.price, n.heads)}</span><span aria-hidden="true">${priceHtml(n.price, n.heads)}</span>`;
    $('#nodePrice').hidden = st === 'closed' || st === 'learned' || test;
    const can = canLearn(school, n, learned, P);
    const note = test ? '테스트 경로에서는 모든 칸을 익힌 것으로 봅니다.'
      : st === 'learned' ? '익힌 칸입니다.'
      : st === 'closed' ? '아직 배울 수 없습니다.'
      : can.why === 'pre' ? (pre.length ? '' : '먼저 익힐 칸이 있습니다.') // 잠김은 '먼저 익힐 칸: …' 줄이 까닭을 말한다 (같은 말 두 번 안 함)
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
  on($('.detail-close'), 'click', () => { const id = lastNode?.dataset.node; selected = null; render(); root.querySelector(`.tree-node[data-node="${id}"]`)?.focus({ preventScroll: true }); });
  on($('#learnNode'), 'click', () => {
    const n = nodeOf(school, selected);
    if (!n) return;
    const r = learnNode(school, n.id);
    announce(r.ok ? `${nameOf(n)} 익힘 — ${priceWords(n.price, n.heads)}${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'coins' ? '금화가 모자랍니다.' : r.why === 'heads' ? '머리가 모자랍니다.' : '배울 수 없습니다.');
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
