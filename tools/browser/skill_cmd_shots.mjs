// 스킬 상세 카드 맨 아래 입력 줄 그림 · 점검 (10/24 — 사장님 14:1x '커맨드가 있는 공격은 스킬 설명 최하단에 커맨드 적어' · 10/25 17:3x 도식 '입력: …' · 18:3x 낱말 긋기 · 탭 · src/skill_tree_data.js NODE_CMD · docs/text/skill_cmd_2026-10-24.md)
//  몇 칸 익힌 저장으로 첫 화면 → 여정 → 정지 → 대기실 '스킬' → 유파 탭 → 칸을 눌러 상세 카드:
//   ① 그림 한 장씩 — 비기 모르트슐라크(G10 — 잠김 · 가장 긴 입력 줄 · 844 × 390 과 680 × 360) · 스틱 + 사선 긋기 비껴서며 찌르기(I2 — 잠김 · 화살표 둘) ·
//      수직 긋기 제비 베기(J9 — 잠김) · 막기 + 스틱 격살(C9 — 익힘) · 740 × 360 싱지르(B7 — 잠김 · 그 화면에서 가장 빠듯한 카드).
//      보는 것: 입력 줄 글 = '입력: ' + 칸 cmd · 한 줄 · 카드 맨 아래(보이는 것 가운데 가장 아래) · 없는 칸은 숨김 ·
//      그 줄을 그린 글꼴(크롬 개발 도구 CSS.getPlatformFontsForNode — 화살표 · 느낌표까지 프리텐다드여야, 시스템 글꼴로 넘어가면 실패)
//   10/25 22:3x · 23:1x: 비기 칸(사장님 글 — 33 자 넘음)은 두 줄까지 받음 · 그림에 J5 · I4(844 × 390) · J5(680 × 360) 더함
//   ② 모든 칸(다섯 유파 × 11) × 화면 여섯(폰 가로 844 × 390 · 740 × 360 · 844 × 340 · 680 × 360 · 작은 가로 568 × 320 · PC 1280 × 720): 입력 줄 한 줄 · 줄 끝 남는 폭 · 카드 넘침.
//      넘침은 844 × 390 · 740 × 360 · 568 × 320 · PC 에서 0 이어야(걸리면 실패) · 844 × 340 · 680 × 360 은 적어만 둔다(값 · '배우기'가 있는 안 배운 칸 몇이 원래 빠듯 — 문서 §4)
//  실행: vite build(+ tools/pwa/build.mjs) → vite preview 를 띄운 뒤  node tools/browser/skill_cmd_shots.mjs http://127.0.0.1:5528 [출력 폴더(기본 docs/handoff/skill_input_2026-10-25)]
//  출력(WebP · 화면 배율 2): card_G10_844x390 · card_I2_844x390 · card_J9_844x390 · card_C9_844x390 · card_B7_740x360 · card_G10_680x360. 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium) · 끝 코드 0 = 모두 맞음 · 콘솔 오류 0
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { titleToLobby } from './to_lobby.mjs';
import { TREE_SCHOOLS, nodeOf, nodesOf } from '../../src/skill_tree_data.js';

const base = (process.argv[2] || 'http://127.0.0.1:5528').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/skill_input_2026-10-25';
fs.mkdirSync(out, { recursive: true });
const errors = [], report = [], sweep = [];
const toWebp = (png, name) => { execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=82, method=6)", png, `${out}/${name}.webp`]); fs.rmSync(png); };
// 상태가 고루 보이게: 독일 · 이베리아는 앞쪽 몇 칸 · 동방은 격살까지
const learned = { german: ['G1', 'G2', 'G5', 'G8', 'G3'], iberian: ['B1', 'B10'], chinese: ['C1', 'C3', 'C7', 'C6', 'C8', 'C9'] };
const SAVE = { version: 1, coins: 640, heads: 12, titles: [], title: '', acquisitions: Object.entries(learned).flatMap(([s, ids]) => ids.map((id) => ({ receipt: `skill:${s}:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } }))) };
const SIZES = [
  { w: 844, h: 390, must: true, shots: [['german', 'G10', 'locked'], ['italian', 'I2', 'locked'], ['japanese', 'J9', 'locked'], ['chinese', 'C9', 'learned'], ['japanese', 'J5', 'locked'], ['italian', 'I4', 'locked']] }, // J5 · I4 — 10/25 22:3x 사장님 비기 글(두 줄)
  { w: 740, h: 360, must: true, shots: [['iberian', 'B7', 'locked']] },
  { w: 844, h: 340, must: false, shots: [] },
  { w: 680, h: 360, must: false, shots: [['german', 'G10', 'locked'], ['japanese', 'J5', 'locked']] },
  { w: 568, h: 320, must: true, shots: [] },
  { w: 1280, h: 720, must: true, shots: [] },
];
// 열린 카드 읽기 (Shadow root 안)
const readCard = () => {
  const r = document.querySelector('#gameEntrance').shadowRoot, box = r.querySelector('.node-detail'), cmd = r.getElementById('nodeCmd'), txt = r.getElementById('nodeCmdText');
  const shown = [...box.querySelectorAll('*')].filter((k) => !k.closest('[hidden]') && !k.classList.contains('detail-close') && k.getBoundingClientRect().height > 0);
  const lowest = shown.reduce((a, k) => (k.getBoundingClientRect().bottom > (a?.getBoundingClientRect().bottom ?? -1) + 0.5 ? k : a), null);
  // room = 한 줄일 때 글 끝에서 줄 오른쪽 끝까지 남는 폭(px) — 가장 긴 줄이 어느 화면에서 얼마나 남는지
  // lines = 줄 수 — 조각 사각형의 서로 다른 윗변 수(10/25 괄호 화살표 낱말을 한 덩이 span 으로 감싸며 한 줄에도 사각형이 여럿 — skill_tree.js cmd-nb)
  const room = cmd.hidden ? null : Math.round(cmd.getBoundingClientRect().right - parseFloat(getComputedStyle(cmd).paddingRight) - txt.getBoundingClientRect().right);
  return { state: box.dataset.state, title: r.getElementById('nodeTitle').textContent, cmd: cmd.hidden ? null : cmd.textContent, text: txt.textContent, lines: cmd.hidden ? 0 : new Set([...txt.getClientRects()].map((q) => Math.round(q.top))).size, room, wide: cmd.scrollWidth > cmd.clientWidth + 0.5, last: !cmd.hidden && (lowest === cmd || cmd.contains(lowest)), over: box.scrollHeight - box.clientHeight };
};
// 입력 줄을 실제로 그린 글꼴 (크롬 개발 도구 — 글자 수 · 글꼴 이름). 화살표 · 느낌표가 프리텐다드에 있어 시스템 글꼴(두부 상자 · 다른 꼴)로 넘어가지 않는지 본다
const platformFonts = async (p, cdp, id) => {
  const fonts = {};
  for (const sel of ['nodeCmdText', 'nodeCmd']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('#gameEntrance').shadowRoot.getElementById('${sel}')` });
    const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId });
    const { fonts: f } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    for (const x of f) fonts[x.familyName] = (fonts[x.familyName] ?? 0) + x.glyphCount;
  }
  return fonts;
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const { w, h, must, shots } of SIZES) {
  const size = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: shots.length ? 2 : 1, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  const cdp = shots.length ? await ctx.newCDPSession(p) : null;
  if (cdp) { await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('DOM.getDocument', { depth: -1, pierce: true }); }
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
    if (n.cmd) {
      await p.evaluate(() => document.fonts.ready);
      await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
      C.fonts = await platformFonts(p, cdp, id);
      // ↻ · ↺ 는 프리텐다드에 없어 보충 조각 Noto Sans Math 가 그린다(10/25 싱지르 입력 줄 — index.html 글꼴 줄 · docs/ui/webfont_2026-10-14.md) — 그 글자가 있는 줄만 받음
      const other = Object.keys(C.fonts).filter((k) => !/^Pretendard/.test(k) && !(k === 'Noto Sans Math' && /[↻↺]/.test(C.cmd ?? '')));
      if (other.length) errors.push(`${size} ${id} 입력 줄을 프리텐다드 밖 글꼴로 그림: ${JSON.stringify(C.fonts)}`);
    }
    report.push({ size, id, ...C });
    if (C.state !== want) errors.push(`${size} ${id} 상태 ${C.state} (기대 ${want})`);
    if (n.cmd) {
      if (C.cmd !== `입력: ${n.cmd}` || C.text !== n.cmd) errors.push(`${size} ${id} 입력 줄 ${JSON.stringify(C.cmd)}`);
      if (!C.last) errors.push(`${size} ${id} 입력 줄이 카드 맨 아래가 아님`);
    } else if (C.cmd !== null) errors.push(`${size} ${id} 입력 줄이 없어야`);
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
      // 비기 칸은 10/25 22:3x · 23:1x 사장님 글(33 자 넘음 — 카드에서 두 줄까지 · docs/text/editing_guide.md 입력 줄) · 그 밖은 한 줄
      const maxLines = n.cat === 'secret' ? 2 : 1;
      if (n.cmd && C.state !== 'closed' && (C.cmd !== `입력: ${n.cmd}` || C.lines > maxLines || C.wide || (C.lines === 1 && C.room < 0) || !C.last)) errors.push(`${size} ${n.id} 입력 줄 ${C.lines} 줄 · 남는 폭 ${C.room}px · 맨 아래 ${C.last} · ${JSON.stringify(C.cmd)}`);
      if (!n.cmd && C.cmd !== null) errors.push(`${size} ${n.id} 입력 줄이 없어야`);
      if (must && C.over > 1) errors.push(`${size} ${n.id} 카드 넘침 +${C.over}px`);
      await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
    }
  }
  const over = rows.filter((r) => r.over > 1);
  const withCmd = rows.filter((r) => r.cmd), tight = withCmd.reduce((a, r) => (a && a.room <= r.room ? a : r), null);
  sweep.push(`${size} · 칸 ${rows.length} · 입력 줄 ${withCmd.length} (모두 한 줄 ${withCmd.every((r) => r.lines === 1)} · 가장 적게 남는 폭 ${tight ? `${tight.id} ${tight.room}px` : '-'}) · 넘침 ${over.length ? over.map((r) => `${r.id}(${r.state}) +${r.over}px`).join(' · ') : 0}${must ? '' : ' — 적어만 둠'}`);
  await ctx.close();
}
await browser.close();
for (const r of report) console.log(`${r.size} ${r.id} ${r.state} · ${r.title} · ${r.cmd ?? '(입력 줄 없음)'} · ${r.lines} 줄 · 남는 폭 ${r.room}px · 맨 아래 ${r.last} · 넘침 ${r.over} · 글꼴 ${JSON.stringify(r.fonts ?? {})}`);
for (const s of sweep) console.log(s);
console.log(errors.length ? `FAIL\n  ${errors.join('\n  ')}` : `PASS 입력 줄 = '입력: ' + 칸 cmd · 한 줄(여섯 화면) · 카드 맨 아래 · 없는 칸은 숨김 · 프리텐다드로 그림 · 넘침 0(844 × 390 · 740 × 360 · 568 × 320 · PC) · 콘솔 오류 0 (그림 ${report.length} 장)`);
process.exit(errors.length ? 1 : 0);
