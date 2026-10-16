// 첫 화면·대기실 디자인 맞추기 시안 (docs/design/ui_unify_2026-10-16.md §3 — 검토용, 코드 안 바꿈): 전투 화면 창·단추 규칙을 CSS 로 덧입혀 찍는다 — 폰 가로 844×390 · 화소 비 3
//  npm run build && npx vite preview --port 5241 →  node tools/ui/ui_unify_mock.mjs http://127.0.0.1:5241 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const MOCK = `
.profile-panel,.contents-panel,dialog,.notice-card,.dialog-card{background:rgba(24,18,14,.9)!important;border:1px solid rgba(243,233,216,.18)!important;border-radius:10px!important;box-shadow:none!important}
.start-actions button,.lobby-header button,.title-utility button,.confirm-button,.account-submit,.dialog-actions button{background:rgba(24,18,14,.55)!important;border:1px solid rgba(243,233,216,.22)!important;border-radius:8px!important;box-shadow:none!important;color:#F3E9D8!important;text-shadow:none!important;background-image:none!important}
.start-actions button::before,.start-actions button::after{display:none!important}
#lobbyDepart,#newJourney,#equipItem:not(:disabled),#unequipItem:not(:disabled){background:#D9A441!important;border-color:#D9A441!important;color:#1B1410!important;font-weight:700!important}
.lobby-tabs button[aria-selected=true]{border-color:#D9A441!important;color:#D9A441!important;background:rgba(217,164,65,.1)!important}
.start-actions button:disabled{opacity:.4!important}
.inventory-frame{border:0!important;border-image:none!important;padding:0!important}
.inventory-frame::before,.inventory-frame::after{display:none!important}
.inventory-item{border-radius:8px!important;overflow:hidden}
.inventory-item img{image-rendering:auto!important;transform:scale(1.6);filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))!important}
.inventory-item[data-armor=kettle]{background:radial-gradient(closest-side,rgba(255,210,74,.32),transparent 85%),rgba(0,0,0,.25)!important}
.inventory-item[data-weapon=tree_branch]{background:radial-gradient(closest-side,rgba(184,182,176,.28),transparent 85%),rgba(0,0,0,.25)!important}
#itemName{}
`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
  const books = ['german:1', 'german:2', 'german:3'];
  localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 1240, heads: 3, titles: [], title: '여행자', acquisitions: books.map((b) => ({ receipt: `skillbook:${b}`, kind: 'skillbook' })) }));
});
const p = await ctx.newPage();
const inject = () => p.evaluate((css) => { const root = document.querySelector('#gameEntrance').shadowRoot; let s = root.getElementById('mockcss'); if (!s) { s = document.createElement('style'); s.id = 'mockcss'; root.appendChild(s); } s.textContent = css; }, MOCK);
await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').tap();
await p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('entrance').dataset.phase === 'ready', null, { timeout: 20000 });
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/mock_title_before.png` }); await inject(); await p.waitForTimeout(200); await p.screenshot({ path: `${out}/mock_title_after.png` });
await p.locator('#newJourney').tap(); await p.locator('#characterView canvas').waitFor({ timeout: 20000 }); await p.waitForTimeout(1200);
await p.locator('#tabArmor').tap(); await p.locator('button[data-armor=kettle]').tap(); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('mockcss')?.remove());
const zoom = async (name, sel, pad = 2) => { const b = await p.locator(sel).first().boundingBox(); await p.screenshot({ path: `${out}/${name}.png`, clip: { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 } }); };
await p.screenshot({ path: `${out}/mock_lobby_before.png` }); await zoom('mz_kettle_before', 'button[data-armor=kettle]');
await inject(); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/mock_lobby_after.png` }); await zoom('mz_kettle_after', 'button[data-armor=kettle]');
await p.locator('#tabSkills').tap(); await p.waitForTimeout(500); await zoom('mz_book', '.book-node[data-book="1"]', 4);
await browser.close();
