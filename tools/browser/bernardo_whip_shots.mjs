// 베르나르도 새 옷 프로필 · 채찍 섬네일 화면 점검 (10/24 — docs/import/bernardo_whip_import_2026-10-24.md §5): 폰 가로 844 × 390 · 화면 배율 2
//  ① 대기실 프로필 칸(?title=1&hero=bernardo — 첫 화면 → 여정 → 정지 → 대기실): 칸 그림 = ui/portraits/bernardo.webp(768²) · 그 뒤 아이템 칸에서 드루이드의 채찍을 눌러 설명 카드
//  ② 패배 창(?foe=bernardo): 결과 창 왼쪽 상대 프로필 + 오른쪽 승리 대사 (판 끝은 연결 확인용으로 강제 — 승률 자료 아님)
//  ③ 카드 뽑기(?cards=druid_whip,longsword): 채찍 카드 앞면 썸네일 = ui/weapons/druid_whip.webp
//  실행: npx vite build --outDir <빈 폴더> && node tools/pwa/build.mjs <그 폴더> → npx vite preview --outDir <그 폴더> --port 5541 --strictPort →
//        node tools/browser/bernardo_whip_shots.mjs http://127.0.0.1:5541 docs/handoff/bernardo_whip_2026-10-24
//  출력: 그 폴더에 WebP(품질 88 · method 6 — PNG 를 찍어 옮기고 지움) · 끝에 결과 줄(어긋나면 exit 1). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { titleToLobby } from './to_lobby.mjs';
import { UPDATE_NOTES } from '../../src/update_notes.js';

const base = (process.argv[2] || 'http://127.0.0.1:5541').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/bernardo_whip_2026-10-24';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [], fails = [], notes = [];
const IGNORED = /deprecated parameters for the initialization function/;
const check = (ok, what) => { (ok ? notes : fails).push(what); console.log(ok ? 'OK  ' : 'FAIL', what); };
const NOTICES = { hideRead: true, readIds: UPDATE_NOTES.map((n) => n.id) };
const TREE = { v: 1, at: '2026-10-21', books: 0, coins: 0, heads: 0, bonus: 500, notice: false };
const SEED = { 'stillness.lobby.sealCoins.v1': { version: 1, converted: 0, at: '2026-10-16', notice: false }, 'stillness.lobby.progress.v1': { version: 1, coins: 500, heads: 0, acquisitions: [], titles: [], title: '여행자', tree: TREE } };
const WEBP = "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=88, method=6)";
async function shot(page, name) {
  const png = `${out}/_${name}.png`;
  await page.screenshot({ path: png });
  execFileSync('python3', ['-I', '-c', WEBP, png, `${out}/${name}.webp`]);
  fs.rmSync(png);
}
async function open(query, title = true, touch = false) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, ...(touch ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(([seed, notices]) => {
    if (sessionStorage.getItem('bwShotSeeded')) return;
    localStorage.clear();
    localStorage.setItem('stillness.title.notices.v1', JSON.stringify(notices));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
    sessionStorage.setItem('bwShotSeeded', '1');
  }, [SEED, NOTICES]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base + '/' + query, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player, null, { timeout: 300000 });
  if (title) await page.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  return { ctx, page };
}
const shadow = (page, fn) => page.evaluate((src) => new Function('r', src)(document.querySelector('#gameEntrance').shadowRoot), fn);

// ① 대기실 프로필 칸 · 아이템 칸의 채찍
{
  const { ctx, page } = await open('?title=1&hero=bernardo');
  await titleToLobby(page);
  const s = await shadow(page, `const f = r.getElementById('lobbyPortrait'), i = r.getElementById('lobbyPortraitImg'); return { id: f.dataset.portrait, src: i.getAttribute('src'), natural: i.naturalWidth };`);
  check(s.id === 'bernardo' && s.src === 'ui/portraits/bernardo.webp' && s.natural === 768, `① 대기실 베르나르도: ${JSON.stringify(s)}`);
  await shot(page, 'lobby_bernardo');
  await page.locator('.inventory-item[data-item=druid_whip]').click();
  await page.waitForFunction(() => { const r = document.querySelector('#gameEntrance').shadowRoot, d = r.getElementById('itemDetail'), i = r.querySelector('.inventory-item[data-item=druid_whip] img'); return d && !d.hidden && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
  const w = await shadow(page, `const i = r.querySelector('.inventory-item[data-item=druid_whip] img'); return { src: i.getAttribute('src'), natural: [i.naturalWidth, i.naturalHeight], name: r.getElementById('itemName').textContent, rarity: r.getElementById('itemRarity').textContent, desc: r.getElementById('itemDescription').textContent };`);
  check(w.src === 'ui/weapons/druid_whip.webp' && w.natural[0] === 256 && w.name.includes('드루이드의 채찍'), `① 아이템 칸 채찍: ${JSON.stringify(w)}`);
  await shot(page, 'inventory_whip');
  await ctx.close();
}
// ② 패배 창 — 베르나르도에게 짐
{
  const { ctx, page } = await open('?foe=bernardo&foeWeapon=tizona&weapon=longsword&stage=cathedral', false);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => window.game.player.die('목', true));
  await page.waitForFunction(() => document.getElementById('menu').classList.contains('show') && document.getElementById('menuTitle').textContent === '패배', null, { timeout: 180000 });
  await page.waitForFunction(() => { const i = document.getElementById('menuFoeImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
  const a = await page.evaluate(() => { const f = document.getElementById('menuFoe'), i = document.getElementById('menuFoeImg'); return { shown: !f.hidden, id: f.dataset.portrait ?? null, src: i.getAttribute('src'), natural: i.naturalWidth, line: document.getElementById('menuFoeLine').hidden ? '' : document.getElementById('menuFoeQuote').textContent }; });
  check(a.shown && a.id === 'bernardo' && a.src === 'ui/portraits/bernardo.webp' && a.natural === 768 && !!a.line, `② 패배 창 베르나르도: ${JSON.stringify(a)}`);
  await shot(page, 'defeat_bernardo');
  await ctx.close();
}
// ③ 카드 뽑기 — 채찍 카드 앞면 (druid_whip_shots.mjs 'card' 와 같은 길)
{
  const { ctx, page } = await open('?stage=castle&foe=isolde&cards=druid_whip,longsword', false, true);
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 120000 });
  await page.evaluate(() => document.querySelector('#draw .wcard').click());
  await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 180000, polling: 50 });
  await page.evaluate(() => { window.game.draw.hold = true; });
  const c = await page.evaluate(async () => {
    const card = document.querySelector('#draw .wcard'), th = card.querySelector('.wthumb'), url = getComputedStyle(th).backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
    const img = new Image(); img.src = url; await img.decode().catch(() => {});
    return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, thumb: url?.replace(location.origin + '/', ''), natural: img.naturalWidth };
  });
  check(c.name.includes('드루이드의 채찍') && /ui\/weapons\/druid_whip\.webp$/.test(c.thumb ?? '') && c.natural === 256, `③ 카드 채찍: ${JSON.stringify(c)}`);
  await shot(page, 'card_whip');
  await ctx.close();
}
// ④ 채찍 맞음 소리 연결 (그림 없음): 녹음이 읽혔나 · sound.whip 이 어느 녹음을 내나 — 기본(C2 lash1) · ?whipHit=old(Thwack) · 겹침 막기(C2 뒤 끝 딱 안 냄)
for (const [q, want] of [['', 'whipLash'], ['&whipHit=old', 'whipHit']]) {
  const { ctx, page } = await open(`?stage=castle&foe=isolde&cards=druid_whip,longsword${q}`, false, true);
  await page.tap('#btnStart');
  await page.waitForFunction(() => { const s = window.game.sound?.samples; return s && ['whipSwish', 'whipCrack', 'whipHit', 'whipLash', 'whipArmor', 'whipClash'].every((k) => s[k]?.length); }, null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const s = window.game.sound, names = new Map(Object.entries(s.samples).flatMap(([k, list]) => list.map((b) => [b, k]))), heard = [];
    const layer0 = s.layer.bind(s);
    s.layer = (ev, buf, o) => { heard.push(names.get(buf)); return layer0(ev, buf, o); };
    s.whip('hit', 60, false);
    s.whip('crack', 20);
    await new Promise((ok) => setTimeout(ok, 400));
    s.whip('crack', 20);
    s.layer = layer0;
    const lash = s.samples.whipLash[0];
    return { loaded: Object.fromEntries(['whipSwish', 'whipCrack', 'whipHit', 'whipLash', 'whipArmor', 'whipClash'].map((k) => [k, s.samples[k].length])), heard, lashSec: +lash.duration.toFixed(3) };
  });
  const expect = want === 'whipLash' ? ['whipLash', 'whipCrack'] : ['whipHit', 'whipCrack', 'whipCrack']; // C2 뒤 0.2 s 안의 끝 딱은 막고 0.4 s 뒤는 냄 · old 판은 막지 않음
  check(JSON.stringify(r.heard) === JSON.stringify(expect) && r.loaded.whipLash === 1 && r.lashSec > 0.25 && r.lashSec < 0.32, `④ 맞음 소리 ${q || '기본'}: ${JSON.stringify(r)}`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (fails.length ? `FAIL ${fails.length}` : `PASS ${notes.length}`) + ' · 콘솔 오류 ' + errors.length);
for (const e of errors) console.log('  ' + e);
process.exit(fails.length || errors.length ? 1 : 0);
