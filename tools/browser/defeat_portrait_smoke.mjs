// 패배 창 프로필 + 대사 점검 (사장님 10/17 22:1x · 23:4x — docs/design/portrait_ui_2026-10-17.md §4)
//  ① 여정(첫 화면 Stage 1 → 카드 → 싸움)에서 짐: 싸움 화면엔 승리 대사가 안 뜸(10/18 01:4x '싸움 화면쪽은 빼') → 패배 창 = 상대 프로필(원본을 줄인 768² · 그림 안 액자 1) + 그 오른쪽 같은 대사 ·
//     그림 한 변 = 같은 화면 대기실 프로필 칸과 같은 CSS px(23:4x '패배 팝업 프로필도 같은 크기로') · 금화 줄 · 단추와 안 겹침 · 창이 화면 안 · 그 뒤 정지 창엔 없음
//  ② 이긴 판: 프로필 · 대사 없음(전 그대로)  ③ 그림 없는 상대(?foe=default 기본 상대): 그림 칸 숨김 · 대사 없음(전 꼴)  ④ 변형(광기의 하인리히)은 자기 그림(10/18 16:3x — 전: 바탕 인물) · ?portrait=hd 예비 · ?portraitGrid=1 칸 줄
//  ⑤ 출처 줄이 있는 대사(병마용)는 대사 아래 작은 줄 — 싸움 화면 대사 칸과 같은 꼴  ⑥ ?portrait=low = 예비 픽셀판(pixelated)
//  npm run build && npx vite preview --port 5182 →  node tools/browser/defeat_portrait_smoke.mjs http://127.0.0.1:5182 /tmp/<빈 폴더> [크기 WxH@dpr,…]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, lobbyFromBattle } from './to_lobby.mjs';
import { CHARACTERS_BY_ID, lineSourceOf } from '../../src/characters.js';
// 패배 창 대사 = 그 상대의 승리 대사 중 하나(randomLine — 없으면 taunt) · 출처 줄 = lineSourceOf (이름으로 인물을 찾음 — 이름은 겹치지 않는다)
const byName = (n) => Object.values(CHARACTERS_BY_ID).find((c) => c.name === n);
const unq = (q) => (q || '').replace(/^“|”$/g, '');
const winLineOf = (name, q) => { const c = byName(name); return !!c && [...(c.lines?.win ?? []), c.taunt].filter(Boolean).includes(unq(q)); };
const base = process.argv[2] || 'http://127.0.0.1:5182', out = process.argv[3] || '/tmp/defeat-portrait';
const sizes = (process.argv[4] || '844x390@3,932x430@3,740x360@3,667x375@2,568x320@2,1280x720@1,1440x900@1').split(',').map((s) => { const [wh, d] = s.split('@'); const [w, h] = wh.split('x').map(Number); return { w, h, dpr: Number(d || 1) }; });
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p, tag) => { p.on('pageerror', (e) => errors.push(`${tag} ${e}`)); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${tag} ${m.text()}`); }); p.on('response', (r) => { if (r.status() >= 400) errors.push(`${tag} ${r.status()} ${r.url()}`); }); };
const context = async (s) => { const phone = s.w < 1000; const c = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr, isMobile: phone, hasTouch: phone }); await c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called'); r.abort(); }); return c; };
const title = async (p) => {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
};
const toFight = async (p) => { if (await p.evaluate(() => game.state) === 'draw') { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator('#draw .wcard[data-i="0"]').click(); } await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 }); };
const urlFight = async (p, q) => { await p.goto(base + '/?' + q, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 }); await p.evaluate(() => document.getElementById('btnStart').click()); await toFight(p); };
// 지고 결과 창까지: 싸움 화면 대사(있으면)를 읽어 둔다 — 결과 창은 게임 시간 3.5 s 뒤라 SwiftShader 가 바쁘면 실제로는 훨씬 오래 걸린다(기다림 150 s)
async function lose(p) {
  await p.waitForFunction(() => !document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 20000 }).catch(() => {}); // 판 시작 소개(같은 칸)가 걷힌 뒤에 — 대사를 소개 글과 헷갈리지 않게
  // 싸움 화면 대사 칸(#foeIntro)에 진 뒤 뜨는 글을 모두 적어 둔다 — 10/18 01:4x 부터 승리 대사는 안 떠야 한다(부활 대사 등 다른 글은 상관없음)
  await p.evaluate(() => { const el = document.getElementById('foeIntro'); window.__foeShown = []; new MutationObserver(() => { if (el.classList.contains('show')) window.__foeShown.push(el.querySelector('span').textContent); }).observe(el, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true, characterData: true }); });
  await p.evaluate(() => game.player.die('목', true));
  await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 150000 });
  await p.waitForFunction(() => { const f = document.getElementById('menuFoe'), i = document.getElementById('menuFoeImg'); return f.hidden || (i.complete && i.naturalWidth > 0); }, null, { timeout: 20000 });
  return p.evaluate(() => window.__foeShown);
}
const popup = (p) => p.evaluate(() => {
  const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; };
  const f = document.getElementById('menuFoe'), img = document.getElementById('menuFoeImg'), card = document.querySelector('#menu .card');
  const hit = (a, b) => a.l < b.r - .5 && a.r > b.l + .5 && a.t < b.b - .5 && a.b > b.t + .5;
  const fr = R(f), others = ['menuTitle', 'menuSub', 'menuFoeLine', 'menuReward', 'btnStart', 'btnLobby'].filter(vis).map((id) => [id, R(document.getElementById(id))]);
  const cr = R(card);
  return {
    title: document.getElementById('menuTitle').textContent, shown: vis('menuFoe'), foeShown: card.classList.contains('foe-shown'), id: f.dataset.portrait ?? null, mode: f.dataset.mode ?? null,
    src: img.getAttribute('src'), natural: img.naturalWidth, rendering: getComputedStyle(img).imageRendering, size: [fr.w, fr.h], alt: img.alt,
    line: vis('menuFoeLine') ? document.getElementById('menuFoeQuote').textContent : null, source: vis('menuFoeLine') ? document.getElementById('menuFoeSource').textContent : null,
    sourceShown: vis('menuFoeLine') && getComputedStyle(document.getElementById('menuFoeSource')).display !== 'none',
    overlap: vis('menuFoe') ? others.filter(([, r]) => hit(fr, r)).map(([id]) => id) : [], lineRightOfPortrait: vis('menuFoe') && vis('menuFoeLine') ? R(document.getElementById('menuFoeLine')).l >= fr.r : null,
    inView: cr.l >= -.5 && cr.t >= -.5 && cr.r <= innerWidth + .5 && cr.b <= innerHeight + .5, scrolls: card.scrollHeight > card.clientHeight + 1,
    reward: vis('menuReward'), buttons: ['btnStart', 'btnLobby'].filter(vis).map((id) => { const r = R(document.getElementById(id)); return r.b <= innerHeight + .5 && r.t >= -.5; }),
  };
});
try {
  // ① 여정에서 짐 — 화면 크기마다: 대기실 프로필 한 변 ↔ 패배 창 프로필 한 변
  for (const s of sizes) {
    const tag = `${s.w}x${s.h}`, c = await context(s), p = await c.newPage(); watch(p, tag);
    await p.goto(base + '/?title=1', { waitUntil: 'networkidle' }); await title(p);
    await departTitle(p); await lobbyFromBattle(p);
    const lobbySide = await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('lobbyPortrait').getBoundingClientRect().width);
    await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('lobbyDepart').click());
    await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 });
    await toFight(p);
    const foe = await p.evaluate(() => game.enemy.name);
    const shown = await lose(p);
    const a = await popup(p);
    await p.screenshot({ path: `${out}/loss_${tag}.png` });
    assert.equal(a.title, '패배'); assert.equal(a.shown, true, JSON.stringify(a)); assert.equal(a.foeShown, true);
    assert.equal(a.src, `ui/portraits/${a.id}.webp`); assert.equal(a.natural, 768); assert.equal(a.mode, 'pixel'); assert.notEqual(a.rendering, 'pixelated'); // 10/18 16:3x 투명 배경 도트판(768² · 매끈하게 줄임)
    assert.equal(a.alt, `${foe} 프로필`);
    assert.ok(Math.abs(a.size[0] - lobbySide) < .5 && Math.abs(a.size[1] - lobbySide) < .5, `${tag} popup ${a.size} vs lobby ${lobbySide}`);
    assert.ok(winLineOf(foe, a.line), `${tag} line ${a.line} is not a win line of ${foe}`); assert.ok(!shown.includes(a.line), `${tag} fight screen showed ${shown}`); // 대사는 패배 창에만
    assert.equal(a.lineRightOfPortrait, true); assert.deepEqual(a.overlap, [], `${tag} overlap ${a.overlap}`);
    assert.equal(a.reward, true); assert.ok(a.inView && a.buttons.length === 2 && a.buttons.every(Boolean), `${tag} ${JSON.stringify(a)}`);
    // 다시 겨루기 → 정지 창엔 프로필 · 대사 없음
    await p.locator('#btnStart').click(); await toFight(p);
    await p.evaluate(() => document.getElementById('btnPause').click()); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await popup(p);
    assert.deepEqual([paused.title, paused.shown, paused.foeShown, paused.line], ['일시정지', false, false, null]);
    checks.push({ check: `${tag}: loss popup shows the foe profile (${a.id}, transparent pixel 768 webp, smooth) at the lobby profile size ${lobbySide} px, one of the foe's win lines to its right (not shown on the fight screen), no overlap with title/cause/reward/buttons, card in view${a.scrolls ? ' (scrolls)' : ''}; pause after a rematch shows none`, foe, line: a.line, size: a.size });
    await c.close();
  }
  const s = sizes[0], tag = `${s.w}x${s.h}`;
  // ② 이긴 판 · ③ 기본 상대(그림 없음) · ④ 변형(자기 그림) · hd 예비 · 칸 줄 · ⑤ 출처 줄 · ⑥ ?portrait=low
  {
    const c = await context(s), p = await c.newPage(); watch(p, tag);
    await urlFight(p, 'foe=heinrich&weapon=longsword');
    await p.evaluate(() => game.enemy.die('목', true)); await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 150000 });
    const w = await popup(p); assert.deepEqual([w.title, w.shown, w.foeShown, w.line], ['승리', false, false, null]);
    checks.push({ check: 'win popup: no profile, no line (unchanged)' });
    await urlFight(p, 'foe=default&weapon=longsword');
    await lose(p); const d = await popup(p); await p.screenshot({ path: `${out}/loss_default_${tag}.png` });
    assert.deepEqual([d.title, d.shown, d.foeShown, d.line], ['패배', false, false, null]); assert.ok(d.inView && d.buttons.every(Boolean));
    checks.push({ check: 'loss to the default foe (no character, no portrait, no line): portrait slot hidden, card as before' });
    await urlFight(p, 'foe=heinrich_mad&weapon=longsword');
    const shownM = await lose(p); const m = await popup(p); await p.screenshot({ path: `${out}/loss_variant_${tag}.png` });
    assert.equal(m.id, 'heinrich_mad'); assert.equal(m.src, 'ui/portraits/heinrich_mad.webp'); assert.ok(winLineOf('광기의 하인리히 도른', m.line), m.line); assert.ok(!shownM.includes(m.line)); // 변형의 대사 · 10/18 16:3x 부터 얼터 자기 그림
    checks.push({ check: 'variant (heinrich_mad) has its own portrait (10/18 — was the base character portrait)', line: m.line });
    await urlFight(p, 'foe=heinrich_mad&weapon=longsword&portrait=hd');
    await lose(p); const h = await popup(p);
    assert.deepEqual([h.id, h.mode, h.src, h.natural], ['heinrich', 'hd', 'encounters/portraits-hd-20261017/heinrich.webp', 768]); // 예비 hd = 10/17 원본 판 · 얼터는 바탕 인물
    checks.push({ check: '?portrait=hd: the 10/17 high-resolution backup (variant → base portrait)' });
    await urlFight(p, 'foe=heinrich&weapon=longsword&portraitGrid=1');
    await lose(p); const g = await popup(p);
    assert.equal(await p.evaluate(() => { const f = document.getElementById('menuFoe'); return f.hasAttribute('data-grid') && /grid-overlay\.svg/.test(getComputedStyle(f, '::after').backgroundImage); }), true);
    await p.screenshot({ path: `${out}/loss_grid_${tag}.png` }); assert.equal(g.id, 'heinrich');
    checks.push({ check: '?portraitGrid=1: 22×22 grid lines over the portrait' });
    let src = null;
    for (let i = 0; i < 6 && !src?.sourceShown; i++) { await urlFight(p, 'foe=terracotta&weapon=longsword'); const shownT = await lose(p); src = await popup(p); src.shown = shownT; }
    await p.screenshot({ path: `${out}/loss_terracotta_${tag}.png` });
    assert.equal(src.id, 'terracotta'); assert.ok(winLineOf('병마용', src.line), src.line); assert.equal(src.source, lineSourceOf(byName('병마용'), unq(src.line))); assert.ok(!src.shown.includes(src.line)); assert.deepEqual(src.overlap, []);
    checks.push({ check: `terracotta: win line + source line (lineSourceOf)${src.sourceShown ? '' : ' — no sourced line came up in 6 tries'}`, line: src.line, source: src.source });
    await c.close();
    const c2 = await context(s), q = await c2.newPage(); watch(q, tag);
    await urlFight(q, 'foe=samira&weapon=longsword&portrait=low');
    await lose(q); const lo = await popup(q); await q.screenshot({ path: `${out}/loss_low_${tag}.png` });
    assert.deepEqual([lo.id, lo.mode, lo.src, lo.natural, lo.rendering], ['samira', 'low', 'encounters/portraits-frame1-20261017/low/samira.png', 1254, 'pixelated']);
    checks.push({ check: '?portrait=low: the backup pixel portrait (low.png 1254², pixelated)' });
    await c2.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/defeat_portrait.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} defeat-portrait checks; errors ${errors.length}`);
