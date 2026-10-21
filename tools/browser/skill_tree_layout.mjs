// 스킬트리 판 겹침 점검 + 사진 (10/21 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md §5 · 전: 10/16 별자리 다섯 권 점검)
//  옛 스킬북을 가진 저장(옮기기 알림이 뜨는 꼴)과 몇 칸 익힌 저장으로 첫 화면 → 여정 → 정지 → 대기실 '스킬' — 유파 다섯 × 화면 다섯(폰 가로 844 · 740 · 680 · 작은 가로 568 · PC):
//  ① 칸끼리(값 알약 포함) 겹치는지 ② 칸이 판 폭 밖으로 나가는지 ③ 칸 글이 칸 밖으로 넘치는지 ④ 줄(곡선)이 다른 칸을 지나는지 ⑤ 초기화 단추가 칸과 겹치는지 ⑥ 값 그림이 읽혔는지.
//  SHOTS=<폴더> 면 844 × 390 사진: 옮김 알림 · 유파 다섯 · 상세 카드 · 초기화 확인. 하나라도 걸리면 종료 코드 1
//  npx vite --port 5391 --strictPort →  node tools/browser/skill_tree_layout.mjs http://127.0.0.1:5391   (SHOTS=docs/design/skill_tree_2026-10-21/impl_shots)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
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
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
let bad = 0;
const sizes = SHOTS ? [['landscape', 844, 390]] : [['landscape', 844, 390], ['landscape-740', 740, 360], ['landscape-680', 680, 360], ['small-landscape', 568, 320], ['desktop', 1280, 720]];
for (const [name, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
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
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/notice_${w}x${h}.png` });
  await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('closeTree').click());
  await p.locator('#tabSkills').click();
  const report = [];
  for (const school of SCHOOLS) {
    await p.locator(`.school-tabs [data-school=${school}]`).click();
    await p.waitForTimeout(80);
    const r = await p.evaluate(() => {
      const root = document.querySelector('#gameEntrance').shadowRoot, sc = root.querySelector('.tree-scroll'), sr = sc.getBoundingClientRect();
      const boxes = [], texts = [];
      for (const n of root.querySelectorAll('.tree-node')) {
        const b = n.getBoundingClientRect(); boxes.push({ id: n.dataset.node, l: b.left, r: b.right, t: b.top, b: b.bottom, part: 'node' });
        const pr = n.querySelector('.node-price'); if (pr) { const q = pr.getBoundingClientRect(); boxes.push({ id: n.dataset.node, l: q.left, r: q.right, t: q.top, b: q.bottom, part: 'price' }); }
        for (const s of n.querySelectorAll('.node-l1, .node-l2')) { const q = s.getBoundingClientRect(); if (q.left < b.left - 0.5 || q.right > b.right + 0.5) texts.push(`${n.dataset.node}:${s.textContent}`); }
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
      const reset = root.getElementById('treeReset').getBoundingClientRect();
      const resetHit = boxes.filter((b) => Math.min(b.r, reset.right) - Math.max(b.l, reset.left) > 0.5 && Math.min(b.b, reset.bottom) - Math.max(b.t, reset.top) > 0.5 && b.t < sr.top + 40).map((b) => b.id);
      const icons = [...root.querySelectorAll('.price-icon')].filter((i) => !(i.complete && i.naturalWidth > 0)).length;
      const states = [...root.querySelectorAll('.tree-node')].reduce((a, n) => ((a[n.dataset.state] = (a[n.dataset.state] ?? 0) + 1), a), {});
      return { hits, out, texts, through: [...new Set(through)], resetHit, icons, board: [Math.round(board.width), Math.round(board.height)], view: [Math.round(sr.width), Math.round(sr.height)], states };
    });
    bad += r.hits.length + r.out.length + r.texts.length + r.through.length + r.resetHit.length + r.icons;
    report.push(`${school}: ${[r.hits.length ? 'overlap ' + r.hits.join(',') : '', r.out.length ? 'outside ' + r.out.join(',') : '', r.texts.length ? 'text ' + r.texts.join(',') : '', r.through.length ? 'links through ' + r.through.join(',') : '', r.resetHit.length ? 'reset × ' + r.resetHit.join(',') : '', r.icons ? `icons ${r.icons}` : ''].filter(Boolean).join(' | ') || 'ok'} (board ${r.board} · view ${r.view} · ${JSON.stringify(r.states)})`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/tree_${school}_${w}x${h}.png` });
  }
  if (SHOTS) {
    // 상세 카드: 독일 겹치기(관문을 넘어 배울 수 있음) · 닫힌 비기 · 편지 · 일본 막기 III(배울 수 있음 — 금화) · 이탈리아 패시브(잠김)
    for (const [school, id] of [['german', 'G7'], ['german', 'G10'], ['german', 'G11'], ['japanese', 'J4'], ['italian', 'I10']]) {
      await p.locator(`.school-tabs [data-school=${school}]`).click();
      await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).click(), id);
      await p.waitForTimeout(60);
      await p.screenshot({ path: `${SHOTS}/detail_${school}_${id}_${w}x${h}.png` });
      await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
    }
    await p.locator('.school-tabs [data-school=german]').click();
    await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('treeReset').click());
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${SHOTS}/reset_confirm_german_${w}x${h}.png` });
    await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('resetOk').click());
    await p.waitForTimeout(80);
    const after = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; return { coins: r.getElementById('lobbyCoins').textContent, heads: r.getElementById('lobbyHeads').textContent, level: r.getElementById('lobbyLevel').textContent, learned: r.querySelectorAll('.tree-node[data-state=learned]').length, reset: r.getElementById('treeReset').disabled }; });
    console.log(`  초기화 뒤 ${JSON.stringify(after)} (전 ${JSON.stringify({ coins: notice.coins, level: notice.level })})`);
    await p.screenshot({ path: `${SHOTS}/after_reset_german_${w}x${h}.png` });
  }
  console.log(`${name} ${w}×${h}\n  ` + report.join('\n  '));
  await ctx.close();
}
await browser.close();
console.log(bad ? `FAIL ${bad}` : `PASS 칸 · 값 · 줄 · 초기화 단추 겹침 없음 · 글 넘침 없음 · 옮김 알림 (5 유파 × ${sizes.length} 화면)`);
if (bad) process.exit(1);
