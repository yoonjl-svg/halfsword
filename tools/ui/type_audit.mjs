// 글자 전수 점검 (10/14 글자 규칙 — docs/ui/webfont_2026-10-14.md): 화면마다 글자가 든 요소를 모두 훑어
//  계산된 크기 · 굵기 · 줄 높이 · 자간 · 색 · 글꼴(실제로 그린 글꼴 — 크로미움 CSS.getPlatformFontsForNode)을 적고 화면을 찍는다.
//  실행: 개발 서버(npx vite --port <포트>)를 띄운 뒤
//        node tools/ui/type_audit.mjs http://127.0.0.1:<포트> <출력 폴더> <이름표(before|after)>
//   → <출력>/<이름표>_<장면>_<화면>.png + <이름표>_audit.json (요소마다 값 · 콘솔 오류 · 바깥 요청 · document.fonts)
//  화면: 가로 폰 844×390 (dpr 3, 터치) · PC 1280×720 (dpr 1) + 세로 폰 390×844 (돌려 달라는 안내만). 무대·상대·카드 고정
//   (?stage=poseidon&foe=heinrich&cards=longsword,pistol — 자세 원어 Langort 가 나오는 롱소드와 설명이 가장 긴 리볼버)
//  장면: menu(첫 메뉴) · draw_back(엎은 카드 + 왼쪽 위) · draw_face(세 장 뒤집음, 1번은 '내 무기') · intro(판 시작 '대면' · 소개) ·
//        fight(① 자세 + ② 기술 줄 · 감정 줄을 DOM 으로 넣음) · ready(② 비기 창 열림 secretReady 를 DOM 으로) · pause(일시정지 창) ·
//        result(패배 창 + 판 알림 '패배' — DOM 으로) · rotate(세로 폰) · test(test.html)
//  바깥 주소(127.0.0.1 밖)로 가는 요청은 막고 센다 — 글꼴이 우리 파일로만 그려지는지 보려고.
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'type_audit';
const label = process.argv[4] || 'after';
fs.mkdirSync(out, { recursive: true });
const QUERY = '?stage=poseidon&foe=heinrich&cards=longsword,pistol';
const VIEWS = [
  { name: '844', width: 844, height: 390, dpr: 3, touch: true },
  { name: '1280', width: 1280, height: 720, dpr: 1, touch: false },
].filter((v) => !process.env.ONLY || process.env.ONLY.split(',').includes(v.name));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const report = { label, base, views: {} };

// 글자가 든 요소 전부 (자기 글 마디가 있고 화면에 보이는 것): 계산된 값 + 표시용 data-ta 번호
function collect() {
  const hex = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c;
    const [r, g, b, a] = m[1].split(',').map((s) => parseFloat(s));
    const h = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return a !== undefined && a < 1 ? `${h} α${+a.toFixed(2)}` : h;
  };
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) {
        parts.unshift(`#${e.id}`);
        break;
      }
      if (e.classList.length) s += '.' + [...e.classList].slice(0, 2).join('.');
      parts.unshift(s);
    }
    return parts.join(' ');
  };
  const seen = [];
  let n = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'CANVAS', 'svg', 'SVG'].includes(el.tagName)) continue;
    if (el.closest('.wcard:not(.flipped) .wface, .wcard.flipped .wback')) continue; // 카드의 안 보이는 면 (뒷면 숨기기)
    const own = [...el.childNodes].filter((c) => c.nodeType === 3 && c.textContent.trim()).map((c) => c.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op < 0.05) continue;
    // 화면 밖 (뒤집히기 전 카드 앞면 등) — 뒷면이 보이는 앞면은 빼지 않는다 (배치 상자로만 본다)
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    el.dataset.ta = String(n++);
    seen.push({
      ta: el.dataset.ta,
      sel: path(el),
      text: own.replace(/\s+/g, ' ').slice(0, 40),
      size: cs.fontSize,
      weight: cs.fontWeight,
      lh: cs.lineHeight,
      ls: cs.letterSpacing,
      color: hex(cs.color),
      family: cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
      opacity: +op.toFixed(2),
      box: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)),
    });
  }
  return seen;
}

async function platformFonts(cdp, items) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  for (const it of items) {
    try {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-ta="${it.ta}"]` });
      if (!nodeId) continue;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      it.drawn = (fonts || []).map((f) => `${f.familyName}${f.isCustomFont ? '' : ' (시스템)'} ×${f.glyphCount}`).join(' + ');
    } catch {
      /* 사라진 요소 */
    }
  }
}
const PIN = (ids) => ids.forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove = () => {}; // 게임 루프가 show 를 떼지 못하게 (이 캡처 페이지 안에서만)
});
const UNPIN = (ids) => ids.forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  delete el.classList.remove;
  el.style.transition = 'none';
  el.classList.remove('show');
});

async function runScenes(v, ctx, page, cdp, R) {
  const shot = async (scene) => {
    for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const file = path.join(out, `${label}_${scene}_${v.name}.png`);
    await page.evaluate(() => document.querySelectorAll('[data-ta]').forEach((e) => delete e.dataset.ta));
    const items = await page.evaluate(collect);
    await platformFonts(cdp, items);
    await page.screenshot({ path: file });
    R.scenes[scene] = { file, items };
    console.log('SHOT', file, items.length);
  };
  await page.goto(base + '/' + QUERY, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  R.documentFonts = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}${f.unicodeRange !== 'U+0-10FFFF' ? ' [범위]' : ''}`));
  await shot('menu');

  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 90000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  await page.waitForTimeout(500);
  await shot('draw_back');
  await page.evaluate(() => {
    document.querySelectorAll('#draw .wcard').forEach((c) => c.classList.add('flipped'));
    document.querySelector('#draw .wcard[data-i="0"]').classList.add('picked');
  });
  await page.waitForTimeout(1200);
  R.cards = await page.evaluate(() => {
    const d = getComputedStyle(document.getElementById('draw'));
    return { cw: d.getPropertyValue('--cw').trim(), ch: d.getPropertyValue('--ch').trim(), name: d.getPropertyValue('--name').trim(), desc: d.getPropertyValue('--desc').trim() };
  });
  await shot('draw_face');

  await page.evaluate(() => {
    document.querySelectorAll('#draw .wcard').forEach((c) => c.classList.remove('flipped', 'picked'));
    window.game.draw.hold = false;
  });
  await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight' && document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 120000 });
  await page.evaluate(PIN, ['foeIntro', 'toast', 'stageInfo', 'hint']);
  await page.waitForTimeout(700);
  await shot('intro');

  // 싸움 중: 가운데 소개·판 알림을 걷고 ① 자세가 뜨면 ② 기술 줄 · 감정 줄을 넣는다 (main.js paintLine · showEmoMsg 와 같은 짜임)
  await page.evaluate(UNPIN, ['foeIntro', 'toast']);
  await page.waitForFunction(() => document.getElementById('guardName').classList.contains('show') && document.getElementById('guardName').innerText.trim(), null, { timeout: 120000 });
  await page.evaluate(PIN, ['guardName']);
  const line = (kind, b, o, t) => {
    const el = document.querySelector('#techSlot .slot');
    el.innerHTML = `<b>${b}</b><small>${o ? `<span class="o">${o}</span>` : ''}<span class="t">${o ? ' · ' : ''}${t}</span></small>`;
    el.dataset.kind = kind;
    el.dataset.who = 'me';
    el.classList.add('show');
    el.classList.remove = () => {}; // 게임 루프가 매 프레임 toggle('show', …) 로 걷지 못하게
    el.classList.toggle = () => true;
  };
  await page.evaluate(`(${line})('unique', '굽은 베기', 'Krumphau', '내 독일 · 고유 동작')`);
  await page.evaluate(() => {
    const e = document.getElementById('emoMsg');
    e.textContent = '하인리히 도른의 분노가 폭발한다';
    e.dataset.emotion = 'anger';
    e.classList.add('show');
    e.classList.remove = () => {};
  });
  await page.waitForTimeout(500);
  await shot('fight');
  await page.evaluate(`(${line})('secretReady', '세 번 바꿔 치기', 'Dreiwechsel', '내 독일 · 비기')`);
  await page.waitForTimeout(400);
  await shot('ready');

  // 일시정지 창
  await page.evaluate(() => document.getElementById('btnPause').click());
  await page.waitForFunction(() => document.getElementById('menu').classList.contains('show'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  await shot('pause');

  // 판 결과 창 (패배): main.js 결과 창과 같은 글 자리에 넣는다 + 판 알림 '패배'
  await page.evaluate(() => {
    document.getElementById('menuTitle').textContent = '패배';
    document.getElementById('menuSub').textContent = '목을 베였다 · 하인리히 도른: “기어서 살려 달라 하랬지.”';
    document.getElementById('btnStart').textContent = '다시 싸우기';
    document.getElementById('btnResume').style.display = 'none';
    const t = document.getElementById('toast');
    t.textContent = '패배';
    t.classList.add('show');
  });
  await page.waitForTimeout(400);
  await shot('result');
}

for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, hasTouch: v.touch, isMobile: v.touch });
  const outside = [];
  await ctx.route((url) => !/^(https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:)/.test(url.href), (r) => {
    outside.push(r.request().url());
    return r.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()} ${r.url()}`));
  const fontReqs = [];
  page.on('request', (r) => /\.woff2?(\?|$)/.test(r.url()) && fontReqs.push(r.url().replace(base, '')));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const R = (report.views[v.name] = { scenes: {} });
  await runScenes(v, ctx, page, cdp, R);
  // test.html (같은 화면 크기)
  await page.goto(base + '/test.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelectorAll('[data-ta]').forEach((e) => delete e.dataset.ta));
  const items = await page.evaluate(collect);
  await platformFonts(cdp, items);
  const file = path.join(out, `${label}_test_${v.name}.png`);
  await page.screenshot({ path: file });
  R.scenes.test = { file, items };
  console.log('SHOT', file, items.length);
  R.errors = errors;
  R.outsideRequests = outside;
  R.fontRequests = [...new Set(fontReqs)];
  await ctx.close();
}
// 세로 폰: 돌려 달라는 안내 (터치 세로에서만 덮는다)
if (!process.env.ONLY || process.env.ONLY.split(',').includes('rotate')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.route((url) => !/^(https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:)/.test(url.href), (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()}`));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await page.goto(base + '/' + QUERY, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.evaluate(() => document.getElementById('rotate').classList.add('enabled')); // main.js 는 '싸움 시작' 을 누른 뒤에 켠다 — 여기서는 바로 켠다
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const items = await page.evaluate(collect);
  await platformFonts(cdp, items);
  const file = path.join(out, `${label}_rotate_390.png`);
  await page.screenshot({ path: file });
  report.views['390'] = { scenes: { rotate: { file, items: items.filter((i) => i.sel.startsWith('#rotate')) } }, errors };
  console.log('SHOT', file);
  await ctx.close();
}
fs.writeFileSync(path.join(out, `${label}_audit.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.views).map(([k, r]) => [k, { errors: r.errors?.length, outside: r.outsideRequests?.length, fonts: r.fontRequests }]))));
await browser.close();
