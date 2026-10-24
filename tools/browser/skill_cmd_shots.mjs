// 스킬 상세 카드 맨 아래 조작 줄 그림 · 점검 (10/24 — 사장님 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어' · src/skill_tree_data.js NODE_CMD · docs/text/skill_cmd_2026-10-24.md)
//  몇 칸 익힌 저장으로 첫 화면 → 여정 → 정지 → 대기실 '스킬' → 유파 탭 → 칸을 눌러 상세 카드:
//   ① 그림 한 장씩 — 비기 모르트슐라크(G10 — 잠김 · 가장 긴 조작 줄) · 스틱 + 긋기 돌며 베기(B3 — 배울 수 있음 · 값 · 배우기) · 패시브 인데스(G9 — 배울 수 있음 · 조작 줄 없음) ·
//      막기 + 스틱 격살(C9 — 익힘) · 740 × 360 싱지르(B7 — 잠김 · 그 화면에서 가장 빠듯한 카드). 보는 것: 조작 줄 글 = 칸 cmd · 한 줄 · 카드 맨 아래(보이는 것 가운데 가장 아래) · 없는 칸은 숨김
//   ② 모든 칸(다섯 유파 × 11) × 화면 여섯(폰 가로 844 × 390 · 740 × 360 · 844 × 340 · 680 × 360 · 작은 가로 568 × 320 · PC 1280 × 720): 조작 줄 한 줄 · 카드 넘침.
//      넘침은 844 × 390 · 740 × 360 · 568 × 320 · PC 에서 0 이어야(걸리면 실패) · 844 × 340 · 680 × 360 은 적어만 둔다(값 · '배우기'가 있는 안 배운 칸 몇이 원래 빠듯 — 문서 §4)
//  실행: vite build(+ tools/pwa/build.mjs) → vite preview 를 띄운 뒤  node tools/browser/skill_cmd_shots.mjs http://127.0.0.1:5528 [출력 폴더(기본 docs/handoff/skill_cmd_2026-10-24)]
//  출력(WebP · 화면 배율 2): card_G10_844x390 · card_B3_844x390 · card_G9_844x390 · card_C9_844x390 · card_B7_740x360. 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium) · 끝 코드 0 = 모두 맞음 · 콘솔 오류 0
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { titleToLobby } from './to_lobby.mjs';
import { TREE_SCHOOLS, nodeOf, nodesOf } from '../../src/skill_tree_data.js';

const base = (process.argv[2] || 'http://127.0.0.1:5528').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/skill_cmd_2026-10-24';
fs.mkdirSync(out, { recursive: true });
const errors = [], report = [], sweep = [];
const toWebp = (png, name) => { execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=82, method=6)", png, `${out}/${name}.webp`]); fs.rmSync(png); };
// 상태가 고루 보이게: 독일 · 이베리아는 앞쪽 몇 칸 · 동방은 격살까지
const learned = { german: ['G1', 'G2', 'G5', 'G8', 'G3'], iberian: ['B1', 'B10'], chinese: ['C1', 'C3', 'C7', 'C6', 'C8', 'C9'] };
const SAVE = { version: 1, coins: 640, heads: 12, titles: [], title: '', acquisitions: Object.entries(learned).flatMap(([s, ids]) => ids.map((id) => ({ receipt: `skill:${s}:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } }))) };
const SIZES = [
  { w: 844, h: 390, must: true, shots: [['german', 'G10', 'locked'], ['iberian', 'B3', 'open'], ['german', 'G9', 'open'], ['chinese', 'C9', 'learned']] },
  { w: 740, h: 360, must: true, shots: [['iberian', 'B7', 'locked']] },
  { w: 844, h: 340, must: false, shots: [] },
  { w: 680, h: 360, must: false, shots: [] },
  { w: 568, h: 320, must: true, shots: [] },
  { w: 1280, h: 720, must: true, shots: [] },
];
// 열린 카드 읽기 (Shadow root 안)
const readCard = () => {
  const r = document.querySelector('#gameEntrance').shadowRoot, box = r.querySelector('.node-detail'), cmd = r.getElementById('nodeCmd'), txt = r.getElementById('nodeCmdText');
  const shown = [...box.querySelectorAll('*')].filter((k) => !k.closest('[hidden]') && !k.classList.contains('detail-close') && k.getBoundingClientRect().height > 0);
  const lowest = shown.reduce((a, k) => (k.getBoundingClientRect().bottom > (a?.getBoundingClientRect().bottom ?? -1) + 0.5 ? k : a), null);
  return { state: box.dataset.state, title: r.getElementById('nodeTitle').textContent, cmd: cmd.hidden ? null : cmd.textContent, text: txt.textContent, lines: cmd.hidden ? 0 : txt.getClientRects().length, last: !cmd.hidden && (lowest === cmd || cmd.contains(lowest)), over: box.scrollHeight - box.clientHeight };
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const { w, h, must, shots } of SIZES) {
  const size = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: shots.length ? 2 : 1, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size} pageerror ${e}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${size} console ${m.text()}`));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 120000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 60000 });
  await titleToLobby(p);
  // 옮김 알림 · 호칭 알림이 뜨면 닫는다 (하나 닫으면 다음 것이 뜰 수 있다)
  for (let k = 0; k < 12; k++) {
    await p.waitForTimeout(120);
    const open = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; if (r.getElementById('treeDialog')?.open) return r.getElementById('closeTree').click(), true; if (r.getElementById('titleDialog')?.open) return r.getElementById('closeTitle').click(), true; return false; });
    if (!open) break;
  }
  await p.locator('#tabSkills').click();
  const settle = () => p.evaluate(() => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  // ① 그림
  for (const [school, id, want] of shots) {
    await p.locator(`.school-tabs [data-school=${school}]`).click();
    await settle();
    await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).click(), id);
    await settle();
    const C = await p.evaluate(readCard);
    const n = nodeOf(school, id);
    report.push({ size, id, ...C });
    if (C.state !== want) errors.push(`${size} ${id} 상태 ${C.state} (기대 ${want})`);
    if (n.cmd) {
      if (C.cmd !== `조작 ${n.cmd}` || C.text !== n.cmd) errors.push(`${size} ${id} 조작 줄 ${JSON.stringify(C.cmd)}`);
      if (!C.last) errors.push(`${size} ${id} 조작 줄이 카드 맨 아래가 아님`);
    } else if (C.cmd !== null) errors.push(`${size} ${id} 조작 줄이 없어야`);
    const name = `card_${id}_${size}`;
    await p.screenshot({ path: `${out}/_${name}.png` });
    toWebp(`${out}/_${name}.png`, name);
    await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
  }
  // ② 모든 칸
  const rows = [];
  for (const school of TREE_SCHOOLS) {
    await p.locator(`.school-tabs [data-school=${school}]`).click();
    await settle();
    for (const n of nodesOf(school)) {
      await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).click(), n.id);
      const C = await p.evaluate(readCard);
      rows.push({ id: n.id, ...C });
      if (n.cmd && C.state !== 'closed' && (C.text !== n.cmd || C.lines !== 1 || !C.last)) errors.push(`${size} ${n.id} 조작 줄 ${C.lines} 줄 · 맨 아래 ${C.last} · ${JSON.stringify(C.text)}`);
      if (!n.cmd && C.cmd !== null) errors.push(`${size} ${n.id} 조작 줄이 없어야`);
      if (must && C.over > 1) errors.push(`${size} ${n.id} 카드 넘침 +${C.over}px`);
      await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
    }
  }
  const over = rows.filter((r) => r.over > 1);
  sweep.push(`${size} · 칸 ${rows.length} · 조작 줄 ${rows.filter((r) => r.cmd).length} (모두 한 줄 ${rows.filter((r) => r.cmd).every((r) => r.lines === 1)}) · 넘침 ${over.length ? over.map((r) => `${r.id}(${r.state}) +${r.over}px`).join(' · ') : 0}${must ? '' : ' — 적어만 둠'}`);
  await ctx.close();
}
await browser.close();
for (const r of report) console.log(`${r.size} ${r.id} ${r.state} · ${r.title} · ${r.cmd ?? '(조작 줄 없음)'} · ${r.lines} 줄 · 맨 아래 ${r.last} · 넘침 ${r.over}`);
for (const s of sweep) console.log(s);
console.log(errors.length ? `FAIL\n  ${errors.join('\n  ')}` : `PASS 조작 줄 = 칸 cmd · 한 줄 · 카드 맨 아래 · 없는 칸은 숨김 · 넘침 0(844 × 390 · 740 × 360 · 568 × 320 · PC) · 콘솔 오류 0 (그림 ${report.length} 장)`);
process.exit(errors.length ? 1 : 0);
