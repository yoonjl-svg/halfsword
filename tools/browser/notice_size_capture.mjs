// 공지 글자 크기 두 길 맞대기 — 처음 들어올 때 뜨는 공지 · 아래 줄 '공지사항'으로 연 공지 (사장님 10/17 '들어가자마자 뜨는 공지의 글자가 여전히 크게 나옴.
//  공지사항 눌러서 보면 정상인데 그 크기로 통일' — docs/import/notice_size_2026-10-17.md)
//  크기: phone-landscape 844×390 · phone-portrait 390×844(공지는 '폰을 가로로 돌려 주십시오'가 덮음 → 가로로 돌려 잼) — 화소 비 3 · 터치 · screen 390×844(아이폰 17e)
//  재는 것(창 제목 h2 · 공지 제목 h3 · 본문 p · 날짜 time): 계산 글자 크기 · 줄 높이 · text-size-adjust · 실제 줄 상자 높이 · 글 칸 폭 · 줄 수
//   + 창이 열린 동안 #entrance 안(창 밖)에서 바뀐 DOM — 아이폰 웹킷에서 #entrance 에서 시작하는 배치(그때만 글자 자동 키움 셈이 공지 창까지 닿는다)
//   + iphone: 웹킷 옛 글자 자동 키움 셈을 위 값에 그대로 적용한 크기(모형 — 기기에서 잰 값이 아님. 크로미움엔 이 셈이 없어 실제 화면은 안 커진다)
//  사진(창만): <label>_first_<크기>.png · <label>_button_<크기>.png · 모형이 크기를 바꾸면 <label>_first-iphone-model_<크기>.png (모형 크기를 입혀 그림)
//  npm run build && npx vite preview --port 4301 →  node tools/browser/notice_size_capture.mjs http://127.0.0.1:4301 <폴더> <before|after>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4301', out = process.argv[3] || '/tmp/notice-size', label = process.argv[4] || 'run';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const errors = [], report = { label, base, sizes: {} };
const S = 'document.querySelector("#gameEntrance").shadowRoot';
const ready = (p) => p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });

// 창이 열린 동안 #entrance 안 · 창 밖에서 상자를 바꾸는 DOM 바뀜을 적는다 (Shadow root 를 붙일 때 MutationObserver 를 단다 — 페이지 스크립트보다 먼저).
//  빼는 것: 창을 여는 차례에 함께 쌓인 것(showModal 때 버림 — 그 배치는 바로 뒤 강제 배치(scrollTop)가 화면 전체로 한다) · 값이 그대로인 속성 · 닫힌 창 안
const watchMutations = () => {
  window.__noticeMut = [];
  const t0 = performance.now(), attach = Element.prototype.attachShadow, showModal = HTMLDialogElement.prototype.showModal, observers = [];
  Element.prototype.attachShadow = function (init) {
    const sr = attach.call(this, init);
    const mo = new MutationObserver((list) => {
      const d = sr.getElementById('noticeDialog'), entrance = sr.getElementById('entrance');
      if (!d?.open || getComputedStyle(d).display === 'none') return; // 세로 폰에서 감춘 창은 상자가 없어 셈할 글자도 없다
      for (const m of list) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || d.contains(el) || !entrance?.contains(el) || el.closest('dialog:not([open])')) continue;
        if (m.type === 'attributes' && m.oldValue === el.getAttribute(m.attributeName)) continue;
        window.__noticeMut.push({ t: Math.round(performance.now() - t0), what: `${m.type} ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : ''}${m.attributeName ? ' @' + m.attributeName : ''}${m.addedNodes.length ? ' +' + [...m.addedNodes].map((n) => n.nodeName.toLowerCase()).join(',') : ''}` });
      }
    });
    mo.observe(sr, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true });
    observers.push(mo);
    return sr;
  };
  HTMLDialogElement.prototype.showModal = function () { for (const mo of observers) mo.takeRecords(); return showModal.call(this); };
};

// 아이폰(작은 화면) 웹킷 옛 글자 자동 키움 — WebKit 소스 그대로: RenderBlockFlow::adjustFontSizes · TextAutoSizingValue::adjustTextNodeSizes ·
//  기본값 minimumZoomFontSize 15 · 한 줄 1.7 · 여러 줄 1.95 · 최대 1.7 배 (아이폰은 idempotent 셈을 안 쓴다 — WebPreferencesDefaultValuesIOS.mm)
//  visibleWidth = 화면 세로 폭(WebPageProxy::textAutosizingWidth = screen 기준 폭 — 돌려도 그대로). 셈이 그 글 칸까지 닿을 때(reach)만
function measure(reach) {
  const visibleWidth = Math.min(screen.width, screen.height);
  const model = ({ size, width, lines, tsa }) => {
    if (!reach || tsa !== 'auto' || !lines || visibleWidth >= width) return size; // text-size-adjust 가 auto 가 아니면 셈에서 빠진다
    const scale = visibleWidth / width, minFont = Math.round(15 / scale);
    if (!(Math.round(size * scale) < minFont)) return size;
    const candidate = Math.round(Math.min(minFont, size * Math.max((lines === 1 ? 1.7 : 1.95) / Math.log10(size), 1)));
    return candidate > size ? Math.min(candidate, Math.round(size * 1.7)) : size; // 같은 꼴 글이 둘 이상(공지 다섯)이라 그룹 평균 = 이 값
  };
  const root = document.querySelector('#gameEntrance').shadowRoot;
  const one = (el) => {
    const s = getComputedStyle(el), range = document.createRange(); range.selectNodeContents(el);
    const rects = [...range.getClientRects()], box = el.getBoundingClientRect();
    const v = { size: parseFloat(s.fontSize), lineHeight: s.lineHeight, tsa: s.webkitTextSizeAdjust || s.textSizeAdjust, glyph: rects.length ? +rects[0].height.toFixed(1) : 0, width: +box.width.toFixed(1), lines: new Set(rects.map((r) => Math.round(r.top))).size };
    return { ...v, iphone: model(v) };
  };
  const pick = (sel) => { const all = [...root.querySelectorAll(sel)].map(one); return { ...all[0], all: all.map((a) => a.iphone) }; };
  return { h2: pick('#noticeHeading'), h3: pick('.notice-entry h3'), p: pick('.notice-entry p'), date: pick('.notice-meta time') };
}
// #entrance = 웹킷 배치 경계(isLayoutBoundary: overflow 가 visible 아님 · 폭 auto 아님 · 높이 고정 길이)이고, 고정 높이라 화면 전체 배치의 자동 키움 셈은 그 안으로 들어가지 않는다
//  (RenderElement::adjustFontSizesOnBlocks — includeNonFixedHeight). 그래서 공지 창(DOM 으로 #entrance 안)은 #entrance 에서 시작한 배치 때만 셈에 든다
const entranceBox = () => {
  const root = document.querySelector('#gameEntrance').shadowRoot, e = root.getElementById('entrance'), s = getComputedStyle(e);
  const rule = [...root.querySelectorAll('style')].flatMap((st) => [...st.sheet.cssRules]).find((r) => r.selectorText === '#entrance');
  const height = rule?.style.height || '';
  return { height: s.height, specifiedHeight: height, width: rule?.style.width || '', overflow: s.overflow, boundary: s.overflow !== 'visible' && /^\d+(\.\d+)?(px|s?vh|d?vh|l?vh)$/.test(height), dialogParent: root.getElementById('noticeDialog').parentElement.id };
};
const state = async (p, path) => {
  const triggers = await p.evaluate(() => window.__noticeMut.splice(0));
  const box = await p.evaluate(entranceBox);
  const reach = box.boundary && triggers.length > 0;
  return { path, reach, triggers, entrance: box, text: await p.evaluate(measure, reach) };
};
// 모형 크기를 입혀 그린 사진 (웹킷이 줄 높이도 같은 배율로 키운다 — 숫자 줄 높이는 정수로 내림)
const paintModel = (p, text) => p.evaluate(new Function('text', `const root=${S};
  for (const [key, sel] of [['h3','.notice-entry h3'],['p','.notice-entry p'],['date','.notice-meta time']]) {
    root.querySelectorAll(sel).forEach((el, i) => { const used = text[key].all[i], size = text[key].size; if (used === size) return;
      el.style.fontSize = used + 'px'; const lh = parseFloat(text[key].lineHeight); if (lh) el.style.lineHeight = Math.trunc(lh * used / size) + 'px'; });
  }`), text);
const clearModel = (p) => p.evaluate(new Function(`const root=${S}; root.querySelectorAll('.notice-entry h3, .notice-entry p, .notice-meta time').forEach(el => el.removeAttribute('style'));`));

for (const [size, W, H] of [['phone-landscape', 844, 390], ['phone-portrait', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => { errors.push(`${size}: auth server called`); r.abort(); });
  await ctx.addInitScript(watchMutations);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${size}: ${r.status()} ${r.url()}`); });
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2000); // 픽셀 제목 그림 · 계정 단추가 다 붙을 때까지
  const entry = {};
  if (H > W) { // 세로: 공지 창은 감춰져 있다 → 가로로 돌려 같은 공지를 잰다
    entry.portraitHidden = await p.evaluate(new Function(`const d=${S}.getElementById('noticeDialog');return d.open && getComputedStyle(d).display==='none' && getComputedStyle(document.getElementById('rotate')).display!=='none';`));
    await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(400);
  }
  entry.first = await state(p, 'first');
  const dialog = p.locator('#noticeDialog');
  await dialog.screenshot({ path: `${out}/${label}_first_${size}.png` });
  const changed = ['h3', 'p', 'date'].some((k) => entry.first.text[k].all.some((v) => v !== entry.first.text[k].size));
  if (changed) { await paintModel(p, entry.first.text); await dialog.screenshot({ path: `${out}/${label}_first-iphone-model_${size}.png` }); await clearModel(p); }
  await p.locator('#confirmNotices').click(); await ready(p); await p.waitForTimeout(300);
  await p.evaluate(() => window.__noticeMut.splice(0));
  await p.locator('#openNotices').click(); await p.waitForTimeout(1500);
  entry.button = await state(p, 'button');
  await dialog.screenshot({ path: `${out}/${label}_button_${size}.png` });
  report.sizes[size] = entry;
  await ctx.close();
}
report.errors = errors;
fs.writeFileSync(`${out}/${label}.json`, JSON.stringify(report, null, 1));
await browser.close();
// 한 줄 요약: 크기마다 [길] h2/h3/p/date = 계산(아이폰 모형)
for (const [size, e] of Object.entries(report.sizes)) for (const path of ['first', 'button']) {
  const t = e[path].text, f = (k) => `${t[k].size}${t[k].iphone !== t[k].size ? `(${t[k].iphone})` : ''}`;
  console.log(`${label} ${size} ${path}: h2 ${f('h2')} · h3 ${f('h3')} · p ${f('p')} · date ${f('date')} · tsa ${t.p.tsa} · reach ${e[path].reach} (triggers ${e[path].triggers.length})`);
}
console.log(`errors ${errors.length}${errors.length ? ': ' + errors.join(' | ') : ''}`);
