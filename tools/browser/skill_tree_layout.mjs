// 스킬트리 판 겹침 점검 + 사진 (10/21 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md §5 · §8 · 전: 10/16 별자리 다섯 권 점검)
//  옛 스킬북을 가진 저장(옮기기 알림이 뜨는 꼴)과 몇 칸 익힌 저장으로 첫 화면 → 여정 → 정지 → 대기실 '스킬' — 유파 다섯 × 화면 여섯(폰 가로 844 × 390 · 844 × 340 · 740 · 680 · 작은 가로 568 · PC):
//  ① 칸끼리(값 · '준비 중' 알약 포함) 겹치는지 ② 칸이 판 폭 밖으로 나가는지 ③ 칸 이름이 칸 밖으로 넘치는지 ④ 줄(곡선)이 다른 칸을 지나는지 ⑤ 초기화 단추가 칸과 겹치는지 · 누르는 높이 40 px
//  ⑥ 값 그림 · 칸 그림(옛 스킬북 그림 256 × 336 — 10/22)이 읽혔는지 ⑦ 내려 보는 판(10/22): 첫 화면에 뿌리 칸이 다 보이는지 · 더 있으면 아래 흐림 표시 · 가로로 넘치지 않는지
//  ⑧ 상세 카드: 모든 칸을 하나씩 열어 카드가 넘치지 않는지(세로 · 가로) · 카드 그림이 읽혔는지 · 갈래 말이 판 칸 글에 없는지 ⑨ 초기화 확인 단추 높이 ≥ 40
//  + 844 × 390 에서 손가락 끌기(터치)로 판이 실제로 내려가는지.
//  SHOTS=<폴더> 면 844 × 390 · 844 × 340 사진: 옮김 알림 · 유파 다섯(판 위 · 끝까지 내린 판 · 상세 카드) · 초기화 확인 + rects.json(자를 자리 — skill_tree_icons_sheet.py). 하나라도 걸리면 종료 코드 1
//  npx vite --port 5391 --strictPort →  node tools/browser/skill_tree_layout.mjs http://127.0.0.1:5391   (SHOTS=<폴더>)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5391';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
// 옛 스킬북 셋(독일 1 · 2급 · 일본 1급 — 옮기면 금화 400 + 500) + 익힌 칸 몇(상태 넷이 다 보이게)
const learned = { german: ['G1', 'G2', 'G5', 'G8', 'G3'], italian: ['I1', 'I3'], iberian: ['B1', 'B10'], japanese: ['J1', 'J2', 'J3'], chinese: ['C1', 'C3'] };
const SAVE = { version: 1, coins: 120, heads: 25, titles: [], title: '여행자', acquisitions: [
  { receipt: 'skillbook:german:1', kind: 'skillbook' }, { receipt: 'skillbook:german:2', kind: 'skillbook' }, { receipt: 'skillbook:japanese:1', kind: 'skillbook' },
  ...Object.entries(learned).flatMap(([s, ids]) => ids.map((id) => ({ receipt: `skill:${s}:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } }))),
] };
// 사진의 상세 카드 (유파마다 하나 — 배울 수 있음 · 잠김 · 익힘 · 편지 · 닫힌 칸이 고루)
const DETAIL = { german: 'G7', italian: 'I11', iberian: 'B4', japanese: 'J8', chinese: 'C3' };
const CAT_WORDS = /^(보법|막기|패시브|비기|심화|편지|고유 공격)( |$)/;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
let bad = 0;
const sizes = SHOTS ? [['landscape', 844, 390], ['landscape-340', 844, 340]] : [['landscape', 844, 390], ['landscape-340', 844, 340], ['landscape-740', 740, 360], ['landscape-680', 680, 360], ['small-landscape', 568, 320], ['desktop', 1280, 720]];
const rects = {};
// 사진 전: 대기실 안 그림이 모두 풀릴 때까지 (칸은 고를 때마다 다시 그려져 그림도 새로 붙는다) + 두 틀
const settle = (p) => p.evaluate(() => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
for (const [name, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: name === 'landscape' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 90000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 30000 });
  await titleToLobby(p);
  const notice = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot, d = r.getElementById('treeDialog'); return { open: d.open, text: r.getElementById('treeText').textContent, coins: r.getElementById('lobbyCoins').textContent, level: r.getElementById('lobbyLevel').textContent }; });
  const wantText = '스킬북이 유파마다 11칸의 스킬트리로 바뀌었습니다. 가지고 있던 스킬북 3권을 거두고 쓴 금화 400을 돌려드렸습니다. 레벨도 그만큼 내려갑니다. 새로 익히시도록 금화 500을 더 드립니다.';
  if (!notice.open || notice.text !== wantText) { bad++; console.log(`  notice ${JSON.stringify(notice)}`); }
  if (SHOTS && name === 'landscape') await p.screenshot({ path: `${SHOTS}/notice_${w}x${h}.png` });
  await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('closeTree').click());
  await p.locator('#tabSkills').click();
  // 사진 자를 자리 (스킬 창 — 대기실 오른쪽 칸)
  rects[`${w}x${h}`] = await p.evaluate(() => { const b = document.querySelector('#gameEntrance').shadowRoot.querySelector('.contents-panel').getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); });
  const report = [];
  for (const school of SCHOOLS) {
    await p.locator(`.school-tabs [data-school=${school}]`).click();
    await p.waitForTimeout(80);
    await p.evaluate(() => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('.tree-node img, .tree-reset img')].map((i) => i.decode().catch(() => {}))));
    const r = await p.evaluate((CAT) => {
      const root = document.querySelector('#gameEntrance').shadowRoot, sc = root.querySelector('.tree-scroll'), sr = sc.getBoundingClientRect(), frame = root.querySelector('.tree-frame');
      const boxes = [], texts = [], words = [];
      for (const n of root.querySelectorAll('.tree-node')) {
        const b = n.getBoundingClientRect(); boxes.push({ id: n.dataset.node, l: b.left, r: b.right, t: b.top, b: b.bottom, part: 'node' });
        for (const q of n.querySelectorAll('.node-price, .node-soon')) { const c = q.getBoundingClientRect(); boxes.push({ id: n.dataset.node, l: c.left, r: c.right, t: c.top, b: c.bottom, part: 'price' }); }
        for (const s of n.querySelectorAll('.node-line, .node-icon')) { const q = s.getBoundingClientRect(); if (q.left < b.left - 0.5 || q.right > b.right + 0.5 || q.top < b.top - 0.5 || q.bottom > b.bottom + 0.5) texts.push(`${n.dataset.node}:${s.textContent || 'icon'}`); }
        const shown = [...n.querySelectorAll('.node-line')].map((s) => s.textContent).join(' ');
        if (CAT && new RegExp(CAT).test(shown)) words.push(`${n.dataset.node}:${shown}`);
      }
      const hits = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j]; if (A.id === B.id) continue;
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l), oy = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (ox > 0.5 && oy > 0.5) hits.push(`${A.id}${A.part === 'price' ? '$' : ''}×${B.id}${B.part === 'price' ? '$' : ''}`);
      }
      const out = boxes.filter((b) => b.part === 'node' && (b.l < sr.left - 0.5 || b.r > sr.right + 0.5)).map((b) => b.id);
      // 줄: 경로를 따라 0.5 px 마다 — 양 끝 칸 밖의 다른 칸 안을 지나면 걸림 (svg 좌표 = 판 좌표)
      const board = root.querySelector('.tree-board').getBoundingClientRect(), through = [];
      for (const path of root.querySelectorAll('.tree-links path')) {
        const L = path.getTotalLength();
        const near = boxes.filter((b) => b.part === 'node');
        const ends = new Set();
        const p0 = path.getPointAtLength(0), p1 = path.getPointAtLength(L);
        for (const b of near) for (const q of [p0, p1]) if (board.left + q.x >= b.l - 2 && board.left + q.x <= b.r + 2 && board.top + q.y >= b.t - 2 && board.top + q.y <= b.b + 2) ends.add(b.id);
        for (let t = 0; t <= L; t += 0.5) {
          const q = path.getPointAtLength(t), x = board.left + q.x, y = board.top + q.y;
          for (const b of near) if (!ends.has(b.id) && x > b.l + 1 && x < b.r - 1 && y > b.t + 1 && y < b.b - 1) through.push(b.id);
        }
      }
      const rb = root.getElementById('treeReset').getBoundingClientRect();
      const resetHit = boxes.filter((b) => Math.min(b.r, rb.right) - Math.max(b.l, rb.left) > 0.5 && Math.min(b.b, rb.bottom) - Math.max(b.t, rb.top) > 0.5).map((b) => b.id);
      if (rb.height < 39.5) resetHit.push(`height ${rb.height}`);
      if (rb.right > sr.right + 0.5 || rb.top < sr.top - 0.5) resetHit.push('outside');
      const icons = [...root.querySelectorAll('.price-icon, .node-icon')].filter((i) => !(i.complete && i.naturalWidth > 0)).length + [...root.querySelectorAll('.node-icon')].filter((i) => i.naturalWidth !== 256 || i.naturalHeight !== 336 || i.getAttribute('alt') !== '' || i.getAttribute('aria-hidden') !== 'true').length;
      const states = [...root.querySelectorAll('.tree-node')].reduce((a, n) => ((a[n.dataset.state] = (a[n.dataset.state] ?? 0) + 1), a), {});
      // 내려 보기: 뿌리 칸(첫 칸)이 첫 화면에 다 보임 · 판이 창보다 길면 흐림 표시 · 가로 넘침 없음
      const rootBox = boxes.find((b) => b.part === 'node' && b.id.endsWith('1') && b.id.length === 2);
      const scroll = [];
      if (!rootBox || rootBox.t < sr.top - 0.5 || rootBox.b > sr.bottom + 0.5) scroll.push('root hidden');
      if (sc.scrollHeight > sc.clientHeight + 2 && !frame.hasAttribute('data-more')) scroll.push('no more-mark');
      if (sc.scrollWidth > sc.clientWidth + 0.5) scroll.push(`h-overflow ${sc.scrollWidth}>${sc.clientWidth}`);
      const fonts = [...root.querySelectorAll('.node-name')].map((e) => parseFloat(e.style.fontSize));
      const widths = [...root.querySelectorAll('.tree-node')].map((e) => e.getBoundingClientRect().width);
      return { hits, out, texts, words, through: [...new Set(through)], resetHit, icons, scroll, board: [Math.round(board.width), Math.round(board.height)], view: [Math.round(sr.width), Math.round(sr.height)], states, font: [Math.min(...fonts), Math.max(...fonts)].map((v) => +v.toFixed(1)), cell: [Math.min(...widths), Math.max(...widths)].map(Math.round), scrollable: sc.scrollHeight > sc.clientHeight + 2 };
    }, CAT_WORDS.source);
    // ⑧ 상세 카드: 칸을 하나씩 열어 넘침 · 그림
    const cards = await p.evaluate(async () => {
      const root = document.querySelector('#gameEntrance').shadowRoot, out = [];
      for (const id of [...root.querySelectorAll('.tree-node')].map((e) => e.dataset.node)) {
        const n = root.querySelector(`.tree-node[data-node="${id}"]`); // 칸은 고를 때마다 다시 그려진다 — 매번 새로 찾음
        n.click();
        const box = root.querySelector('.node-detail'), icon = root.getElementById('nodeIcon');
        await icon.decode().catch(() => {});
        const kids = [...box.querySelectorAll('.detail-main > *:not([hidden]), .detail-foot > *:not([hidden])')];
        const b = box.getBoundingClientRect(), wide = kids.filter((k) => k.getBoundingClientRect().right > b.right - 1 + 0.5).map((k) => k.id || k.className);
        const v = box.scrollHeight - box.clientHeight;
        if (v > 1 || wide.length || !(icon.complete && icon.naturalWidth === 256) || box.hidden) out.push(`${id}${box.hidden ? ' hidden' : ''}${v > 1 ? ` +${v}px` : ''}${wide.length ? ` wide ${wide}` : ''}${icon.naturalWidth === 256 ? '' : ' icon'}`);
        root.querySelector('.detail-close').click();
      }
      return out;
    });
    bad += r.hits.length + r.out.length + r.texts.length + r.words.length + r.through.length + r.resetHit.length + r.icons + r.scroll.length + cards.length;
    report.push(`${school}: ${[r.hits.length ? 'overlap ' + r.hits.join(',') : '', r.out.length ? 'outside ' + r.out.join(',') : '', r.texts.length ? 'text ' + r.texts.join(',') : '', r.words.length ? 'category words ' + r.words.join(',') : '', r.through.length ? 'links through ' + r.through.join(',') : '', r.resetHit.length ? 'reset × ' + r.resetHit.join(',') : '', r.icons ? `icons ${r.icons}` : '', r.scroll.length ? 'scroll ' + r.scroll.join(',') : '', cards.length ? 'card ' + cards.join(',') : ''].filter(Boolean).join(' | ') || 'ok'} (board ${r.board} · view ${r.view}${r.scrollable ? ' · 내려 봄' : ''} · 칸 폭 ${r.cell.join('~')} · 이름 ${r.font.join('~')} px · ${JSON.stringify(r.states)})`);
    if (SHOTS) {
      await settle(p);
      await p.screenshot({ path: `${SHOTS}/tree_${school}_${w}x${h}.png` });
      await p.evaluate(() => { const sc = document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-scroll'); sc.scrollTop = sc.scrollHeight; });
      await settle(p);
      await p.screenshot({ path: `${SHOTS}/tree_${school}_end_${w}x${h}.png` });
      await p.evaluate(() => { document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-scroll').scrollTop = 0; });
      await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).click(), DETAIL[school]);
      await settle(p);
      await p.screenshot({ path: `${SHOTS}/detail_${school}_${DETAIL[school]}_${w}x${h}.png` });
      await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
    }
  }
  // 손가락 끌기 (844 × 390 — 터치 문맥): 판 가운데를 위로 120 px 끌면 판이 내려가야 한다 (칸 단추 위에서 시작해도)
  if (name === 'landscape') {
    await p.locator('.school-tabs [data-school=italian]').click();
    const box = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-scroll').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.7 }; });
    const cdp = await ctx.newCDPSession(p);
    const pt = (y) => [{ x: box.x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(box.y) });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(box.y - k * 10) }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
    const top = await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-scroll').scrollTop);
    const opened = await p.evaluate(() => !document.querySelector('#gameEntrance').shadowRoot.querySelector('.node-detail').hidden);
    if (top < 60 || opened) { bad++; report.push(`touch drag: scrollTop ${top}${opened ? ' · 카드가 열림' : ''}`); } else report.push(`touch drag: 판이 ${Math.round(top)} px 내려감`);
    await p.evaluate(() => { document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-scroll').scrollTop = 0; });
  }
  // ⑨ 초기화 확인 → 초기화 (독일)
  await p.locator('.school-tabs [data-school=german]').click();
  await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('treeReset').click());
  await p.waitForTimeout(60);
  const confirmH = await p.evaluate(() => [...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('.confirm-actions button')].map((b) => b.getBoundingClientRect().height));
  if (confirmH.length !== 2 || confirmH.some((v) => v < 39.5)) { bad++; report.push(`confirm buttons ${confirmH}`); }
  if (SHOTS) { await settle(p); await p.screenshot({ path: `${SHOTS}/reset_confirm_german_${w}x${h}.png` }); }
  await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('resetOk').click());
  await p.waitForTimeout(80);
  const after = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; return { coins: r.getElementById('lobbyCoins').textContent, heads: r.getElementById('lobbyHeads').textContent, level: r.getElementById('lobbyLevel').textContent, learned: r.querySelectorAll('.tree-node[data-state=learned]').length, reset: r.getElementById('treeReset').disabled }; });
  if (after.learned !== 0 || !after.reset) { bad++; report.push(`after reset ${JSON.stringify(after)}`); }
  const learnH = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; r.querySelector('.tree-node[data-node="G1"]').click(); const b = r.getElementById('learnNode').getBoundingClientRect().height; r.querySelector('.detail-close').click(); return b; });
  console.log(`${name} ${w}×${h}  (초기화 뒤 ${JSON.stringify(after)} · 전 ${JSON.stringify({ coins: notice.coins, level: notice.level })} · 단추 높이 초기화 확인 ${confirmH.map(Math.round)} · 배우기 ${Math.round(learnH)})\n  ` + report.join('\n  '));
  await ctx.close();
}
await browser.close();
if (SHOTS) writeFileSync(`${SHOTS}/rects.json`, JSON.stringify(rects));
console.log(bad ? `FAIL ${bad}` : `PASS 칸 · 알약 · 줄 · 초기화 단추 겹침 없음 · 이름 · 그림 넘침 없음 · 내려 보기 · 상세 카드 넘침 없음 · 옮김 알림 (5 유파 × ${sizes.length} 화면)`);
if (bad) process.exit(1);
