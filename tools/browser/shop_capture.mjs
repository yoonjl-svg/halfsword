// 상점 시험판 사진 · 점검 (사장님 10/30 19:0x — src/shop_panel.js · config.js SHOP): 시험판 빌드(/shop/)를 폰 가로 844 × 390 (화소 비 2 · 터치)에서
//  ① 보통 상점(뿔피리 값이 붙은 에픽 · 레전드가 나올 때까지 '다음 갱신') ② 얼터 상점(?shopAlter=1 · 가장 긴 줄 · 6 번 가나 · 9 번 한자) ③ 구입 확인 카드 → 구입 → '판매 완료'
//  ④ 돈이 모자란 확인 카드(모자란 재화 한 줄) ⑤ 왕 뿔피리 결과 창(?horn=1 — 대기실 Stage → 카드 → 상대 쓰러뜨림) · 좁은 화면 390 × 844(PC 세로 창 — 터치 없음) 보통 상점
//  점검: 페이지 에러 0 · 대사 20 줄(보통 10 · 얼터 10)이 두 화면에서 칸을 넘지 않나(가로 넘침 · 상점 칸 세로 넘침) · 파는 무기 이름이 낱말 가운데서 꺾이지 않나 · 대사 속 낱자모 · 줄표 · 가나 · 한자를 실제로 그린 글꼴(CDP CSS.getPlatformFontsForNode)
//  npx vite build --config tools/shop_page/vite.config.mjs --outDir .tmp/shop_site/shop --emptyOutDir && python3 -m http.server 5253 -d .tmp/shop_site
//   → node tools/browser/shop_capture.mjs http://127.0.0.1:5253/shop/ docs/handoff/shop_2026-10-30
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5253/shop/').replace(/\/?$/, '/'), out = process.argv[3] || '.tmp/shop_shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], saved = [], report = {};
const R = (body) => new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`);

async function open(size, width, height, phone, query = '') {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  await p.goto(base + query, { waitUntil: 'networkidle' });
  await p.waitForFunction(R(`return !!root?.querySelector('.shop-item, .shop-empty');`), null, { timeout: 120000 });
  await p.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 5; i++) { // 처음 열 때 알림 창(스킬트리 옮김 · 방랑 · 호칭)을 닫는다
    const id = await p.evaluate(R(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`));
    if (!id) break;
    await p.evaluate(R(`root.getElementById(${JSON.stringify(id)}).click();`));
    await p.waitForTimeout(150);
  }
  return { ctx, p, size };
}
const tap = (o, sel) => o.p.evaluate(R(`root.querySelector(${JSON.stringify(sel)}).click();`));
const shot = async (o, name) => { await o.p.waitForTimeout(350); const path = `${out}/shop_${name}_${o.size}.png`; await o.p.screenshot({ path }); saved.push(path); };
const stock = (o) => o.p.evaluate(R(`return [...root.querySelectorAll('.shop-item')].map(b=>({i:+b.dataset.i,id:b.dataset.id,tier:b.dataset.tier,sold:b.dataset.sold!=null,label:b.getAttribute('aria-label')}));`));
const state = (o) => o.p.evaluate(R(`return {alter:root.querySelector('.shop-keeper').dataset.alter,mood:root.querySelector('.shop-mood').hidden?null:root.querySelector('.shop-mood').textContent,name:root.querySelector('.shop-name').textContent,line:root.querySelector('.shop-line').textContent,timer:root.querySelector('.shop-refresh').textContent,wallet:root.querySelector('.panel-wallet')?.textContent,status:root.getElementById('lobbyStatus').textContent,confirm:root.querySelector('.shop-confirm').hidden?null:{name:root.querySelector('.shop-c-name').textContent,note:root.querySelector('.shop-c-note').textContent,buy:!root.querySelector('.shop-buy').disabled}};`));
/** 대사 한 줄을 넣고 넘침을 잼 — 상점 칸(.shop-host) 세로 · 대사 · 칸 가로 · 화면 가로 */
const fit = (o, text) => o.p.evaluate(R(`
  const host=root.getElementById('shopHost'),line=root.querySelector('.shop-line');line.textContent='“'+${JSON.stringify(text)}+'”';
  const h=host.getBoundingClientRect(),k=root.querySelector('.shop-keeper').getBoundingClientRect(),items=root.querySelector('.shop-items').getBoundingClientRect(),panel=root.querySelector('.contents-panel');
  return {lines:Math.round(line.getBoundingClientRect().height/parseFloat(getComputedStyle(line).lineHeight)),hostOver:Math.max(0,Math.round(host.scrollHeight-host.clientHeight)),lineOverX:Math.max(0,line.scrollWidth-line.clientWidth),
    keeperInside:k.right<=h.right+1&&k.left>=h.left-1,itemsBelow:items.top>=k.bottom-1,panelOverX:Math.max(0,panel.scrollWidth-panel.clientWidth),pageOverX:Math.max(0,document.documentElement.scrollWidth-innerWidth)};`));

/** 파는 무기 이름마다 가장 긴 낱말이 물건 칸 이름 줄 폭에 드나 (낱말 가운데서 꺾이지 않게) — 넘는 이름 목록 */
const { SHOP_POOL } = await import('../../src/shop_rules.js');
const { getWeapon } = await import('../../src/weapons.js');
const NAMES = SHOP_POOL.map((id) => getWeapon(id).nameKo);
const nameFit = (o) => o.p.evaluate(R(`
  const el=root.querySelector('.shop-iname');if(!el)return ['(물건 없음)'];const keep=el.textContent,w=el.clientWidth,bad=[];
  const probe=document.createElement('span');probe.style.cssText='white-space:nowrap;position:absolute;visibility:hidden';el.after(probe);
  for(const n of ${JSON.stringify(NAMES)}){for(const word of n.split(' ')){probe.textContent=word;if(probe.getBoundingClientRect().width>w+.5)bad.push(n+' ('+word+')');}}
  probe.remove();el.textContent=keep;return bad;`));

// ── 폰 가로 844 × 390 ──
{
  const o = await open('844x390', 844, 390, true, '?coins=1200&heads=999&horns=1'); // 다음 갱신 = 머리 1 (10/31) — 여러 번 누르려고 머리를 넉넉히
  // ① 보통 상점 — 에픽 · 레전드(뿔피리 값)가 한 칸이라도 나오고 커먼 · 레어(금화로 살 수 있음)도 나올 때까지 '다음 갱신'
  let tries = 0, s = await stock(o), st = await state(o);
  while (tries < 400 && !(st.alter === 'false' && s.some((x) => ['epic', 'legend'].includes(x.tier)) && s.some((x) => x.tier === 'common'))) { await tap(o, '.shop-next'); s = await stock(o); st = await state(o); tries++; }
  report.normal = { tries, stock: s, state: st };
  await shot(o, 'normal');
  // ④ 돈이 모자란 확인 카드 (금화 1,200 · 뿔피리 1 — 에픽 · 레전드는 금화와 뿔피리가 모자람)
  const dear = s.find((x) => ['epic', 'legend'].includes(x.tier));
  await tap(o, `.shop-item[data-i="${dear.i}"]`);
  report.short = await state(o);
  await shot(o, 'short');
  await tap(o, '.shop-cancel');
  // ③ 살 수 있는 커먼 → 확인 카드 → 구입 → 판매 완료
  const cheap = s.find((x) => x.tier === 'common');
  await tap(o, `.shop-item[data-i="${cheap.i}"]`);
  report.confirm = await state(o);
  await shot(o, 'confirm');
  await tap(o, '.shop-buy');
  report.bought = { state: await state(o), stock: await stock(o), owned: await o.p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).acquisitions.filter((a) => a.kind === 'item')) };
  await shot(o, 'soldout');
  // 산 무기가 아이템 칸에 · 장착 가능
  await tap(o, '#tabItems');
  report.inventory = await o.p.evaluate(R(`return [...root.querySelectorAll('.inventory-item[data-weapon]')].map(b=>b.dataset.weapon);`));
  await o.p.evaluate(R(`root.querySelector('.inventory-item[data-weapon="${cheap.id}"]').click();root.getElementById('equipItem').click();`));
  report.equipped = await o.p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.weapon.v1'))?.weapon);
  await o.p.evaluate(R(`root.getElementById('equipItem').closest('.item-detail') && root.getElementById('unequipItem').click();`)); // 다음 판은 카드로 (결과 창 사진)
  await tap(o, '#tabShop');
  // 대사 20 줄 넘침
  const { SHOP_LINES, SHOP_ALTER_LINES } = await import('../../src/shop_text.js');
  report.fit844 = [];
  for (const line of [...SHOP_LINES, ...SHOP_ALTER_LINES]) report.fit844.push({ line: line.slice(0, 14), ...(await fit(o, line)) });
  report.names844 = await nameFit(o);
  // 글꼴: 대사 속 특수 글자를 실제로 그린 글꼴 (CDP — 화면과 같은 글꼴 줄로 빛 DOM 에 같은 글을 놓고 잼)
  const cdp = await o.ctx.newCDPSession(o.p);
  const family = await o.p.evaluate(R(`return getComputedStyle(root.querySelector('.shop-line')).fontFamily;`));
  const probes = { 'ㄷ': 'ㄷ', 'ㄹ': 'ㄹ', 'ㅎ': 'ㅎ', '─': '─', '—': '—', '…': '…', 'それなら': 'それなら', '違う': '違う', '东西': '东西', '别人的': '别人的', '한글': '길손이여' };
  await o.p.evaluate(({ family, probes }) => {
    for (const [k, t] of Object.entries(probes)) { const s = document.createElement('span'); s.dataset.probe = k; s.textContent = t; s.style.cssText = `font-family:${family};font-size:12px;position:fixed;left:0;top:0;opacity:.01`; document.body.append(s); }
  }, { family, probes });
  await o.p.evaluate(() => document.fonts.ready);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  report.fonts = {};
  for (const k of Object.keys(probes)) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `span[data-probe="${k}"]` });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    report.fonts[k] = fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (웹폰트)' : ''} ×${f.glyphCount}`).join(' + ');
  }
  report.fontFamily = family;
  await o.ctx.close();
}
// ② 얼터 상점 + 얼터 대사 넘침은 위에서 · 사진
{
  const o = await open('844x390', 844, 390, true, '?shopAlter=1');
  report.alter = { state: await state(o), stock: await stock(o) };
  await shot(o, 'alter');
  // 얼터 대사 가운데 가장 긴 줄(세 줄이 되는 줄)을 넣은 사진
  const { SHOP_ALTER_LINES } = await import('../../src/shop_text.js');
  const longest = [...SHOP_ALTER_LINES].sort((a, b) => b.length - a.length)[0];
  report.alterLongest = { line: longest, ...(await fit(o, longest)) };
  await shot(o, 'alter-longest');
  for (const k of [5, 8]) { await fit(o, SHOP_ALTER_LINES[k]); await shot(o, `alter-line${k + 1}`); } // 6 번(가나) · 9 번(한자) — 글꼴 보기
  await o.ctx.close();
}
// ⑤ 왕 뿔피리 결과 창 (?horn=1 — 시험판에서 모든 상대 · 늘): 대기실 Stage → 카드 → 상대 쓰러뜨림
{
  const o = await open('844x390', 844, 390, true, '?horn=1');
  // 가진 무기(나뭇가지)를 장착하면 카드 없이 곧장 싸움 (소프트웨어 GL 에서 카드 고르기가 느림)
  await tap(o, '#tabItems');
  await o.p.evaluate(R(`root.querySelector('.inventory-item[data-weapon="tree_branch"]').click();root.getElementById('equipItem').click();`));
  await tap(o, '#lobbyDepart');
  await o.p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(window.game?.state), null, { timeout: 90000 });
  await o.p.waitForFunction(() => game.state === 'fight' && game.stats.simTime > 2, null, { timeout: 240000 });
  await o.p.evaluate(() => game.enemy.die('기절', true));
  await o.p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 240000 });
  report.result = await o.p.evaluate(() => ({ title: document.getElementById('menuTitle').textContent, reward: document.getElementById('menuReward').textContent, icons: [...document.querySelectorAll('#menuReward img')].map((i) => i.getAttribute('src').split('/').pop()), horns: JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).horns })); // 10/31: 뿔피리는 금화 줄 안 '뿔피리 +1'
  await shot(o, 'result-horn');
  await o.ctx.close();
}
// 좁은 화면 390 × 844 (PC 세로 창 — 대기실이 아래로 흐름) · 대사 20 줄 넘침
{
  const o = await open('390x844', 390, 844, false, '?shopAlter=0');
  await o.p.evaluate(R(`root.getElementById('panelShop').scrollIntoView();`));
  report.narrow = { state: await state(o), stock: await stock(o) };
  await shot(o, 'normal');
  const { SHOP_LINES, SHOP_ALTER_LINES } = await import('../../src/shop_text.js');
  report.fit390 = [];
  for (const line of [...SHOP_LINES, ...SHOP_ALTER_LINES]) report.fit390.push({ line: line.slice(0, 14), ...(await fit(o, line)) });
  report.names390 = await nameFit(o);
  await o.ctx.close();
}
await browser.close();
const worst = (list) => list.reduce((m, r) => ({ lines: Math.max(m.lines, r.lines), hostOver: Math.max(m.hostOver, r.hostOver), lineOverX: Math.max(m.lineOverX, r.lineOverX), panelOverX: Math.max(m.panelOverX, r.panelOverX), pageOverX: Math.max(m.pageOverX, r.pageOverX), bad: m.bad + (!r.keeperInside || !r.itemsBelow ? 1 : 0) }), { lines: 0, hostOver: 0, lineOverX: 0, panelOverX: 0, pageOverX: 0, bad: 0 });
report.fitSummary = { '844x390': worst(report.fit844), '390x844': worst(report.fit390) };
fs.writeFileSync(`${out}/shop_report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ normal: report.normal.state, short: report.short.confirm, confirm: report.confirm.confirm, bought: report.bought.state.status, sold: report.bought.stock.filter((x) => x.sold).map((x) => x.id), inventory: report.inventory, equipped: report.equipped, alter: report.alter.state, result: report.result, fit: report.fitSummary, nameBreaks: { '844x390': report.names844, '390x844': report.names390 }, fonts: report.fonts }, null, 1));
console.log(saved.join('\n'));
console.log(errors.length ? `페이지 에러 ${errors.length}:\n${errors.join('\n')}` : '페이지 에러 0');
if (errors.length) process.exit(1);
