// 상점 칸 · 구입 확인 카드 사진 (사장님 10/31 02:xx — 칸 줄임(A 둘) · 셋 팔기(B) · 이름 한 단계 작게 · 확인 카드 왼쪽 글 / 오른쪽 그림 + 구입 · '이 물건을 사겠나?')
//  844 × 390 (폰 가로 · 터치) · 390 × 844 (PC 세로 창) 마다: 상점 칸(보통 — 에픽 · 레전드가 든 칸) · 확인 카드 넷(보통 · 에픽 뿔피리 · 얼터 머리 · 돈 모자람) · 얼터 칸
//  물건은 저장에 씨앗을 넣어 고른다(지금 칸에서 바라는 물건이 나오는 씨앗을 shop_rules.js 로 찾음 — 본판에도 스위치 없이). 시험판이면 주소 뒤에 ?shopItems=3 처럼 붙여 B 를 본다.
//  잼: 상점 칸 세로 넘침 · 확인 카드 넘침 · 화면 가로 넘침 · 파는 무기 이름이 낱말 가운데서 꺾이나 · 묻는 말 · 페이지 에러
//  node tools/browser/shop_layout_shots.mjs <주소> <사진 폴더> <이름표 A|B> [--items=2|3] [--query='?shopItems=3']
import { chromium } from 'playwright';
import fs from 'node:fs';
import { SHOP } from '../../src/config.js';
import { shopSlot, rollStock, SHOP_POOL } from '../../src/shop_rules.js';
import { getWeapon } from '../../src/weapons.js';
const args = process.argv.slice(2), opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const [baseArg, out = '.tmp/shop_layout', label = 'A'] = args.filter((a) => !a.startsWith('--'));
const base = (baseArg || 'http://127.0.0.1:5254/').replace(/\/?$/, '/'), query = opt('query') || '', items = Number(opt('items') || SHOP.items);
fs.mkdirSync(out, { recursive: true });
const CFG = { ...SHOP, items };
const NAMES = SHOP_POOL.map((id) => getWeapon(id).nameKo);
const KEY = 'stillness.lobby.progress.v1';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [], report = { label, items };
const R = (body) => new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`);
// 지금 칸에서 바라는 물건이 나오는 씨앗
const slot = shopSlot(Date.now());
const findSeed = (want) => { for (let seed = 1; seed < 200000; seed++) { const s = rollStock({ seed, slot, owned: ['tree_branch', 'druid_whip'] }, CFG); if (want(s)) return seed; } throw new Error('씨앗 없음'); };
const hi = (t) => t === 'epic' || t === 'legend', lo = (t) => t === 'common' || t === 'rare';
const SEED = {
  normal: findSeed((s) => !s.alter && s.items.some((i) => hi(i.tier)) && s.items.some((i) => lo(i.tier)) && s.items.some((i) => getWeapon(i.id).nameKo.length >= 6)), // 긴 이름도 (괄호 풀이는 개발 가지 bd158d48 에서 빠짐 — '모르겐슈테른' · '건슬링어의 리볼버' 꼴)
  alter: findSeed((s) => s.alter),
};
const METRICS = `const host=root.getElementById('shopHost'),card=root.querySelector('.shop-confirm'),vis=e=>e&&!e.hidden&&e.getBoundingClientRect().height>0;
  const hr=host.getBoundingClientRect(),cr=vis(card)?card.getBoundingClientRect():null,side=root.querySelector('.shop-c-side')?.getBoundingClientRect(),txt=root.querySelector('.shop-c-text')?.getBoundingClientRect();
  return {hostOverY:Math.max(0,Math.round(host.scrollHeight-host.clientHeight)),cardOverY:cr?Math.max(0,Math.round(card.scrollHeight-card.clientHeight)):null,cardOverX:cr?Math.max(0,card.scrollWidth-card.clientWidth):null,
    pageOverX:Math.max(0,document.documentElement.scrollWidth-innerWidth),panelOverX:Math.max(0,root.querySelector('.contents-panel').scrollWidth-root.querySelector('.contents-panel').clientWidth),
    sideRightOfText:cr?side.left>=txt.right-1:null,artPx:cr?Math.round(root.querySelector('.shop-c-art').getBoundingClientRect().width):null,
    itemH:[...root.querySelectorAll('.shop-item')].map(b=>Math.round(b.getBoundingClientRect().height)),nameFont:getComputedStyle(root.querySelector('.shop-iname')||document.body).fontSize,
    emptyBelowItems:Math.round(root.querySelector('.shop-foot').getBoundingClientRect().top-root.querySelector('.shop-items').getBoundingClientRect().bottom),
    note:cr?root.querySelector('.shop-c-note').textContent:null,buy:cr?!root.querySelector('.shop-buy').disabled:null};`;
const nameFit = `const el=root.querySelector('.shop-iname');if(!el)return ['(물건 없음)'];const keep=el.textContent,w=el.clientWidth,bad=[];
  const probe=document.createElement('span');probe.style.cssText='white-space:nowrap;position:absolute;visibility:hidden';el.after(probe);
  for(const n of ${JSON.stringify(NAMES)}){for(const word of n.split(' ')){probe.textContent=word;if(probe.getBoundingClientRect().width>w+.5)bad.push(n+' ('+word+')');}}
  probe.remove();el.textContent=keep;return bad;`;

for (const [size, width, height, phone] of [['844x390', 844, 390, true], ['390x844', 390, 844, false]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  const tab = (id) => p.evaluate(R(`root.getElementById('${id}').click();`));
  const shot = async (name) => { await p.evaluate(R(`root.getElementById('shopHost').scrollIntoView({block:'center'});`)); await p.waitForTimeout(300); const path = `${out}/shop${label}_${name}_${size}.png`; await p.screenshot({ path }); saved.push(path); return p.evaluate(R(METRICS)); };
  await p.goto(base + query, { waitUntil: 'networkidle' });
  await p.waitForFunction(R(`return !!root?.getElementById('tabShop') || root?.getElementById('noticeDialog')?.open || root?.getElementById('entrance')?.dataset.phase === 'ready';`), null, { timeout: 120000 });
  if (!(await p.evaluate(R(`return !!root.getElementById('tabShop');`)))) {
    if (await p.evaluate(R(`return root.getElementById('noticeDialog')?.open;`))) await p.evaluate(R(`root.getElementById('confirmNotices').click();`));
    await p.waitForFunction(R(`return !!root.getElementById('tabShop') || (root.getElementById('entrance')?.dataset.phase === 'ready' && !root.getElementById('enterLobby').disabled);`), null, { timeout: 120000 });
    if (!(await p.evaluate(R(`return !!root.getElementById('tabShop');`)))) await p.evaluate(R(`root.getElementById('enterLobby').click();`));
  }
  await p.waitForFunction(R(`return !!root?.getElementById('tabShop');`), null, { timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 5; i++) { const id = await p.evaluate(R(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`)); if (!id) break; await p.evaluate(R(`root.getElementById(${JSON.stringify(id)}).click();`)); await p.waitForTimeout(150); }
  const setSave = (seed, wallet) => p.evaluate(({ k, seed, slot, wallet }) => { const v = JSON.parse(localStorage.getItem(k) || '{"version":1,"acquisitions":[]}'); Object.assign(v, wallet); v.shop = { v: 1, seed, slot: slot - 1, rerolls: 0, alter: false, items: [] }; v.acquisitions = (v.acquisitions || []).filter((a) => !String(a.receipt).startsWith('weapon:')); localStorage.setItem(k, JSON.stringify(v)); }, { k: KEY, seed, slot, wallet });
  const reopen = async () => { await tab('tabItems'); await tab('tabShop'); await p.waitForTimeout(200); };
  const openItem = async (pred) => { const i = await p.evaluate(R(`return [...root.querySelectorAll('.shop-item')].find(b=>(${pred})(b.dataset.tier))?.dataset.i??null;`)); await p.evaluate(R(`root.querySelector('.shop-item[data-i="${i}"]').click();`)); };
  const closeCard = () => p.evaluate(R(`root.querySelector('.shop-cancel').click();`));
  const r = (report[size] = {});
  // 보통 칸 (에픽 · 레전드 + 커먼 · 레어 · 괄호 든 이름)
  await setSave(SEED.normal, { coins: 9000, heads: 5, horns: 9 }); await reopen();
  r.panel = await shot('panel'); r.names = await p.evaluate(R(nameFit));
  await openItem("t=>t==='common'||t==='rare'"); r.confirmNormal = await shot('confirm-normal'); await closeCard();
  await openItem("t=>t==='epic'||t==='legend'"); r.confirmEpic = await shot('confirm-epic'); await closeCard();
  await setSave(SEED.normal, { coins: 500, heads: 0, horns: 0 }); await reopen();
  await openItem("t=>t==='epic'||t==='legend'"); r.confirmShort = await shot('confirm-short'); await closeCard();
  // 얼터 칸
  await setSave(SEED.alter, { coins: 500, heads: 5, horns: 0 }); await reopen();
  r.alterPanel = await shot('alter'); await openItem("t=>true"); r.confirmAlter = await shot('confirm-alter'); await closeCard();
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/shop${label}_report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
console.log(saved.join('\n'));
console.log(errors.length ? `페이지 에러 ${errors.length}:\n${errors.join('\n')}` : '페이지 에러 0');
if (errors.length) process.exit(1);
