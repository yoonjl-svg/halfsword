// 본판 빌드 상점 점검 · 사진 (사장님 10/31 00:2x — 본판에 상점 열기 · '⏳ h:mm:ss' · 다음 갱신 머리 1 · 얼터도 '쥘리아 크리스테바' · 결과 창 뿔피리 = 금화 · 머리 줄과 같은 꼴)
//  폰 가로 844 × 390 (화소 비 2 · 터치) — 시험판 스위치 없이 본판 그대로:
//   ① 대기실 상점 칸: 시계가 1 초마다 줄어드나 · 다른 칸이면 멈추나 · 모래시계를 그린 글꼴(CDP — 우리 보충 Noto Sans Symbols 2 인가 · 색 그림 문자가 아닌가)
//   ② 다음 갱신(머리 1 — 진짜 누름): 머리 −1 · 저장 rerolls 1 · 다른 대사 · '철-컥' 소리(페이지의 AudioBufferSourceNode.start 를 세어 봄 — 0.27 초 녹음) · 새로고침해도 같은 물건
//   ②b 4 시간 갱신(10/31 01:3x — 페이지 Date.now 를 갱신 2.5 초 앞으로 옮김): 상점을 보는 중이면 새 칸 · 다른 대사 · 소리 / 다른 탭이면 소리 없음 · 다시 열면 새 대사
//   ③ 구입 → 판매 완료 ④ 머리 0 → 단추 꺼짐 + 까닭
//   ⑤ 얼터: 지금 칸이 얼터가 되는 씨앗을 저장에 넣고 연다(shop_rules.js 로 찾음) — 이름 '쥘리아 크리스테바' · 장면 글
//   ⑥ 결과 창: 방랑을 연 저장(상대 롤랑 — 왕)으로 방랑 → 상대 쓰러뜨림 · 뿔피리 50 % 는 페이지의 crypto 난수를 그 순간만 0 으로(게임 코드는 그대로) → 금화 · 머리 줄 옆 '[뿔피리] 뿔피리 +1'
//  npm run build && python3 -m http.server 5254 -d dist → node tools/browser/shop_real_check.mjs http://127.0.0.1:5254/ docs/handoff/shop_2026-10-31
import { chromium } from 'playwright';
import fs from 'node:fs';
import { shopSlot, rollStock } from '../../src/shop_rules.js';
const base = (process.argv[2] || 'http://127.0.0.1:5254/').replace(/\/?$/, '/'), out = process.argv[3] || '.tmp/shop_real';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [], report = {};
const R = (body) => new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`);
const KEY = 'stillness.lobby.progress.v1';
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
// 결과 창 사진만: crypto 난수를 window.__zeroRand 동안 0 으로 (rand01 → 뿔피리 50 % 통과)
await ctx.addInitScript(() => {
  // 소리 세기: 버퍼 소리 시작마다 길이(초)를 적음 (상점 '철-컥' = 0.27 초 · 문맥을 열 때 무음 한 칸은 아주 짧음)
  window.__abStarts = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { try { window.__abStarts.push(+(this.buffer?.duration ?? 0).toFixed(3)); } catch { /* 셈만 */ } return start.apply(this, a); };
  // 시계 옮기기 (4 시간 갱신 점검): Date.now 에 __shift ms 를 더함
  const realNow = Date.now.bind(Date);
  window.__shift = 0;
  Date.now = () => realNow() + window.__shift;
  const orig = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => { if (window.__zeroRand && a instanceof Uint32Array) { a.fill(0); return a; } return orig(a); };
});
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
const shot = async (name) => { await p.waitForTimeout(300); const path = `${out}/real_${name}_844x390.png`; await p.screenshot({ path }); saved.push(path); };
const save = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const tab = (id) => p.evaluate(R(`root.getElementById('${id}').click();`));
async function toLobby(query = '') {
  await p.goto(base + query, { waitUntil: 'networkidle' });
  await p.waitForFunction(R(`return root?.getElementById('noticeDialog')?.open || root?.getElementById('entrance')?.dataset.phase === 'ready';`), null, { timeout: 90000 });
  if (await p.evaluate(R(`return root.getElementById('noticeDialog').open;`))) await p.evaluate(R(`root.getElementById('confirmNotices').click();`));
  await p.waitForFunction(R(`return root.getElementById('entrance')?.dataset.phase === 'ready' && !root.getElementById('enterLobby').disabled;`), null, { timeout: 90000 });
  await p.evaluate(R(`root.getElementById('enterLobby').click();`));
  await p.waitForFunction(R(`return !!root?.getElementById('tabShop');`), null, { timeout: 90000 });
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 5; i++) { // 처음 들어올 때 알림 창(스킬트리 옮김 · 방랑 · 호칭)
    const id = await p.evaluate(R(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`));
    if (!id) break;
    await p.evaluate(R(`root.getElementById(${JSON.stringify(id)}).click();`));
    await p.waitForTimeout(150);
  }
}
const shopState = () => p.evaluate(R(`return {name:root.querySelector('.shop-name').textContent,mood:root.querySelector('.shop-mood').hidden?null:root.querySelector('.shop-mood').textContent,alter:root.querySelector('.shop-keeper').dataset.alter,
  clock:root.querySelector('.shop-clock').textContent,hg:root.querySelector('.shop-hg').textContent,items:[...root.querySelectorAll('.shop-item')].map(b=>b.dataset.id+(b.dataset.sold!=null?'(판매 완료)':'')),
  rerollDisabled:root.querySelector('.shop-next').disabled,why:root.querySelector('.shop-reroll-why').hidden?null:root.querySelector('.shop-reroll-why').textContent,wallet:root.querySelector('.panel-wallet').textContent,status:root.getElementById('lobbyStatus').textContent};`));
const secs = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };

// ① 상점 칸 · 시계
await toLobby('?coins=1500&heads=2');
await tab('tabShop');
const c0 = await shopState(); await p.waitForTimeout(2300); const c1 = await shopState();
report.clock = { first: c0.clock, after2s: c1.clock, ticked: secs(c0.clock) - secs(c1.clock), format: /^\d:\d\d:\d\d$/.test(c1.clock), hourglass: [...c0.hg].map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase()).join(' ') };
await tab('tabItems'); const h0 = await p.evaluate(R(`return root.querySelector('.shop-clock').textContent;`)); await p.waitForTimeout(2300); const h1 = await p.evaluate(R(`return root.querySelector('.shop-clock').textContent;`));
report.clock.pausedWhileClosed = h0 === h1;
await tab('tabShop'); const r0 = await shopState(); await p.waitForTimeout(1300); const r1 = await shopState();
report.clock.resumed = secs(r0.clock) - secs(r1.clock) >= 1;
// 모래시계를 그린 글꼴
const cdp = await ctx.newCDPSession(p);
await p.evaluate(R(`const s=document.createElement('span');s.id='hgProbe';s.textContent=root.querySelector('.shop-hg').textContent;s.style.cssText='font-family:'+getComputedStyle(root.querySelector('.shop-hg')).fontFamily+';font-size:13px;position:fixed;left:0;top:0;opacity:.01';document.body.append(s);`));
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
{ const { root } = await cdp.send('DOM.getDocument', { depth: -1 }); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#hgProbe' }); const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); report.hourglassFont = fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (웹폰트)' : ''} ×${f.glyphCount}`).join(' + '); }
report.normal = c0;
await shot('shop');
// ② 다음 갱신 (머리 1 — 진짜 누름: 소리 문맥은 누름 안에서만 열린다)
const line = () => p.evaluate(R(`return root.querySelector('.shop-line').textContent;`));
const cues = () => p.evaluate(() => window.__abStarts.filter((d) => d > 0.2).length);
const before = await save(), lineBefore = await line(), cue0 = await cues();
await p.locator('.shop-next').click();
await p.waitForTimeout(400);
const after = await save(), st2 = await shopState();
report.reroll = { headsBefore: before.heads, headsAfter: after.heads, rerolls: after.shop.rerolls, slotSame: after.shop.slot === before.shop.slot, itemsBefore: before.shop.items.map((i) => i.id), itemsAfter: after.shop.items.map((i) => i.id), status: st2.status, alter: after.shop.alter,
  lineBefore, lineAfter: await line(), lineChanged: lineBefore !== (await line()), moodShownIffAlter: (st2.mood != null) === after.shop.alter, sound: (await cues()) - cue0, soundLengths: await p.evaluate(() => window.__abStarts) };
await shot('reroll');
// 새로고침 → 같은 물건 (다시 안 뽑음)
await toLobby(''); await tab('tabShop');
const reload = await save();
report.reroll.afterReload = { rerolls: reload.shop.rerolls, same: JSON.stringify(reload.shop.items) === JSON.stringify(after.shop.items), shown: (await shopState()).items };
// ②b 4 시간 갱신 — 다시 한 번 진짜 누름(소리 문맥을 연다 · 머리 1)으로 다시 들인 뒤, 시계를 갱신 2.5 초 앞으로
await p.locator('.shop-next').click();
await p.waitForTimeout(400);
const toBoundary = () => p.evaluate(() => { const span = 4 * 3600e3, tz = 9 * 3600e3, n = Date.now(), next = (Math.floor((n + tz) / span) + 1) * span - tz; window.__shift += next - 2500 - n; });
{
  const s0 = await save(), l0 = await line(), q0 = await cues();
  await toBoundary(); await p.waitForTimeout(4500);
  const s1 = await save(), st = await shopState();
  report.schedule = { open: { slotBefore: s0.shop.slot, slotAfter: s1.shop.slot, rerollsAfter: s1.shop.rerolls, lineChanged: l0 !== (await line()), alter: s1.shop.alter, moodShownIffAlter: (st.mood != null) === s1.shop.alter, sound: (await cues()) - q0, clock: st.clock } };
  await shot('refresh');
}
{
  await tab('tabItems');
  const s0 = await save(), l0 = await line(), q0 = await cues();
  await toBoundary(); await p.waitForTimeout(4500);
  const mid = await save();
  await tab('tabShop'); await p.waitForTimeout(300);
  const s1 = await save();
  report.schedule.closed = { slotBefore: s0.shop.slot, slotWhileClosed: mid.shop.slot, slotAfterOpen: s1.shop.slot, lineChanged: l0 !== (await line()), sound: (await cues()) - q0 };
}
await p.evaluate(() => { window.__shift = 0; }); // 시계 제자리 (다음 점검은 지금 칸)
await tab('tabItems'); await tab('tabShop'); await p.waitForTimeout(300); // 지금 칸 물건으로 다시 그림
// ③ 구입 (살 수 있는 물건 — 커먼 · 레어 · 얼터면 머리 3)
const can = await p.evaluate(R(`const p=JSON.parse(localStorage.getItem('${KEY}'));return [...root.querySelectorAll('.shop-item')].map(b=>b.dataset.i).find(i=>{const it=p.shop.items[i];return it&&it.coins<=p.coins&&it.heads<=p.heads&&it.horns<=p.horns;})??null;`));
if (can == null) { await p.evaluate((k) => { const v = JSON.parse(localStorage.getItem(k)); v.coins = 20000; v.heads = 9; v.horns = 9; localStorage.setItem(k, JSON.stringify(v)); }, KEY); await tab('tabItems'); await tab('tabShop'); }
const pick = can ?? '0';
await p.evaluate(R(`root.querySelector('.shop-item[data-i="${pick}"]').click();`));
await shot('confirm');
await p.evaluate(R(`root.querySelector('.shop-buy').click();`));
report.buy = { state: await shopState(), owned: (await save()).acquisitions.filter((a) => a.kind === 'item').map((a) => a.receipt) };
await shot('soldout');
// ④ 머리 0 → 단추 꺼짐 + 까닭
await p.evaluate((k) => { const v = JSON.parse(localStorage.getItem(k)); v.heads = 0; localStorage.setItem(k, JSON.stringify(v)); }, KEY);
await tab('tabItems'); await tab('tabShop');
report.noHeads = await shopState();
await shot('noheads');
// ⑤ 얼터 — 지금 칸이 얼터가 되는 씨앗
const slot = shopSlot(Date.now());
let seed = 1; while (!rollStock({ seed, slot, owned: [] }).alter) seed++;
await p.evaluate(({ k, seed, slot }) => { const v = JSON.parse(localStorage.getItem(k)); v.heads = 3; v.shop = { v: 1, seed, slot: slot - 1, rerolls: 0, alter: false, items: [] }; localStorage.setItem(k, JSON.stringify(v)); }, { k: KEY, seed, slot });
await tab('tabItems'); await tab('tabShop');
report.alter = await shopState();
await shot('alter');
// ⑥ 결과 창 — 방랑(상대 롤랑 = 왕) · ③ 에서 산 무기 장착(카드 없이 곧장 싸움 — 나뭇가지면 호칭 '나무꾼' 창이 결과 창을 덮음)
await p.evaluate((k) => {
  const v = JSON.parse(localStorage.getItem(k));
  v.wander = { cleared: [], unlocked: true, legacyChecked: true, noticeSeen: true, run: { id: 'shop-check', round: 1, wins: 0, stage: 'poseidon', foe: 'roland', foeWeapon: 'durandal', status: 'active', weapon: null, cards: null, lastWeapon: null, headTaken: false, fighting: false, encounterSeen: true, reward: null } };
  localStorage.setItem(k, JSON.stringify(v));
  const bought = v.acquisitions.find((a) => a.kind === 'item' && a.receipt.startsWith('weapon:'))?.receipt.slice(7) ?? 'druid_whip';
  localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon: bought }));
}, KEY);
await toLobby('');
const hornsBefore = (await save()).horns;
await p.evaluate(R(`root.getElementById('lobbyWander').click();`));
await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight', 'encounter'].includes(window.game?.state), null, { timeout: 120000 });
report.fightFoe = await p.evaluate(() => window.game.enemy?.name);
await p.waitForFunction(() => game.state === 'fight' && game.stats.simTime > 2, null, { timeout: 240000 });
report.shopTickInFight = await p.evaluate(() => !!document.querySelector('#gameEntrance')); // 대기실이 걷혔나(상점 시계도 같이 멈춤 — lobby.destroy)
await p.evaluate(() => { window.__zeroRand = true; game.enemy.die('기절', true); });
await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 240000 });
await p.evaluate(() => { window.__zeroRand = false; });
report.titleNotice = await p.evaluate(() => document.getElementById('titleNotice')?.classList.contains('show') ?? null); // 호칭 창이 결과 창을 덮었나
report.result = await p.evaluate(() => { const el = document.getElementById('menuReward'); const r = el.getBoundingClientRect(), card = el.closest('.card')?.getBoundingClientRect(); return { title: document.getElementById('menuTitle').textContent, sub: document.getElementById('menuSub').textContent, row: el.textContent, icons: [...el.querySelectorAll('img')].map((i) => i.getAttribute('src').split('/').pop()), rowInsideCard: !card || (r.left >= card.left - 1 && r.right <= card.right + 1), rowHeight: Math.round(r.height) }; });
report.result.horns = { before: hornsBefore, after: (await save()).horns };
await shot('result-horn');
await browser.close();
fs.writeFileSync(`${out}/real_report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
console.log(saved.join('\n'));
console.log(errors.length ? `페이지 에러 ${errors.length}:\n${errors.join('\n')}` : '페이지 에러 0');
if (errors.length) process.exit(1);
