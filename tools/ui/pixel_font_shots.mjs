// 도트 글꼴(갈무리11 · Jacquard 12 — docs/ui/pixel_font_2026-10-14.md) 화면 확인: 메뉴 · 카드 고르기(뒤집은 카드) · 판 시작 소개 · 싸움 중 자세 칸을 찍고,
//  글자마다 실제로 그린 글꼴(크로미움 CSS.getPlatformFontsForNode) · document.fonts 상태 · 콘솔 오류 · 바깥 주소 요청을 적는다.
//  실행: 개발 서버(npx vite --port <포트>)를 띄운 뒤
//        node tools/ui/pixel_font_shots.mjs http://127.0.0.1:<포트> <출력 폴더> <이름표(before|after)>
//  화면: 가로 폰 844×390 (dpr 3, 터치) · PC 1280×720 (dpr 1). 무대·상대·카드는 고정(?stage=poseidon&foe=heinrich&cards=longsword,pistol — 롱소드(자세 원어 Langort·Vom Tag 등)와 설명이 가장 긴 리볼버)
//  바깥 주소(127.0.0.1 밖)로 가는 요청은 모두 막고 센다 — 글꼴이 우리 파일로만 그려지는지 보려고.
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'shots';
const label = process.argv[4] || 'after';
fs.mkdirSync(out, { recursive: true });
const VIEWS = [
  { name: '844', width: 844, height: 390, dpr: 3, touch: true },
  { name: '1280', width: 1280, height: 720, dpr: 1, touch: false },
].filter((v) => !process.env.ONLY || process.env.ONLY.split(',').includes(v.name));
const QUERY = '?stage=poseidon&foe=heinrich&cards=longsword,pistol';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const report = { label, base, views: {} };

// 글자 요소가 실제로 그린 글꼴 (자식 글 마디 기준)
async function platformFonts(cdp, selectors) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const res = {};
  for (const sel of selectors) {
    try {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      if (!nodeId) continue;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      if (fonts?.length) res[sel] = fonts.map((f) => `${f.familyName}${f.isCustomFont ? '' : ' (시스템)'} ×${f.glyphCount}`).join(' + ');
    } catch {
      /* 없는 요소 */
    }
  }
  return res;
}
// 요소를 지금 모습 그대로 붙잡는다 (게임 루프가 show 를 떼지 못하게 — 이 캡처 페이지 안에서만)
const PIN = (ids) => ids.forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove = () => {}; });
const STYLE = (sels) => Object.fromEntries(sels.map((s) => {
  const el = document.querySelector(s);
  if (!el) return [s, null];
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return [s, { font: `${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily.slice(0, 40)}`, ls: cs.letterSpacing, box: [r.left, r.top, r.width, r.height].map((v) => +v.toFixed(2)), text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 50) }];
}));

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
  const shot = async (scene, sels, extra = {}) => {
    const file = path.join(out, `${label}_${scene}_${v.name}.png`);
    // 소프트웨어 GL 은 한 장면 그리기가 1 초를 넘길 수 있다 — 화면 두 장이 더 그려진 뒤에 찍는다 (안 그러면 바뀌기 전 장면이 찍힌다)
    for (let i = 0; i < 3; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: file });
    R.scenes[scene] = { file, fonts: await platformFonts(cdp, sels), style: await page.evaluate(STYLE, sels), ...extra };
    console.log('SHOT', file);
  };

  await page.goto(base + '/' + QUERY, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  R.documentFonts = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}${f.unicodeRange !== 'U+0-10FFFF' ? ' [범위]' : ''}`));
  R.fontsCheck = await page.evaluate(() => ({ galmuri400: document.fonts.check('12px Galmuri11'), galmuri700: document.fonts.check('bold 12px Galmuri11'), jacquard: document.fonts.check('42px "Jacquard 12"', 'S') }));
  await shot('menu', ['#menuTitle', '#menuTitle .wordmark', '#menuSub', '.row > span', '#btnStart']);

  // 카드 고르기: 세 장을 모두 뒤집어 앞면을 본다 (순서는 game.draw.hold 로 멈춤)
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.game.draw.hold = true;
    document.querySelectorAll('#draw .wcard').forEach((c) => c.classList.add('flipped'));
  });
  await page.waitForTimeout(1200);
  const cards = await page.evaluate(() => {
    const d = getComputedStyle(document.getElementById('draw'));
    return {
      cw: d.getPropertyValue('--cw'), ch: d.getPropertyValue('--ch'), desc: d.getPropertyValue('--desc'), name: d.getPropertyValue('--name'),
      faces: [...document.querySelectorAll('#draw .wcard')].map((el) => {
        const face = el.querySelector('.wface');
        const thumb = el.querySelector('.wthumb');
        const abil = el.querySelector('.wabil');
        const last = abil.textContent ? abil : el.querySelector('.wdesc');
        const thumbMin = thumb.offsetHeight <= parseFloat(getComputedStyle(thumb).minHeight) + 0.5;
        const bottom = last.offsetTop + last.offsetHeight;
        const limit = face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom);
        return { name: el.querySelector('.wname').textContent, descPx: getComputedStyle(el.querySelector('.wdesc')).fontSize, over: thumbMin && bottom > limit, thumbH: thumb.offsetHeight, room: +(limit - bottom).toFixed(1) };
      }),
    };
  });
  await shot('cards', ['#draw .wcard[data-i="0"] .wname', '#draw .wcard[data-i="0"] .wdesc', '#draw .wcard[data-i="0"] .wtier', '#draw .wcard[data-i="1"] .wdesc', '#draw .wcard[data-i="2"] .wname', '#stageInfo .stg'], { cards });

  // 판 시작: 카드를 되돌리고 1번을 골라 싸움으로 — 가운데 소개 · 판 알림 · 왼쪽 위 두 줄
  await page.evaluate(() => {
    document.querySelectorAll('#draw .wcard').forEach((c) => c.classList.remove('flipped'));
    window.game.draw.hold = false;
  });
  await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight' && document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 90000 });
  await page.evaluate(PIN, ['foeIntro', 'toast', 'stageInfo']);
  await page.waitForTimeout(700);
  await shot('intro', ['#foeIntro b', '#foeIntro i', '#foeIntro span', '#toast', '#stageInfo .stg', '#stageInfo .foe b', '#stageInfo .foe span']);

  // 싸움 중 자세 칸 (오른쪽 위 ①): 자세 이름이 뜨면 붙잡아 찍는다. 가운데 소개·판 알림은 걷는다
  await page.evaluate(() => {
    for (const id of ['foeIntro', 'toast']) {
      const el = document.getElementById(id);
      delete el.classList.remove;
      el.style.transition = 'none'; // 그리기가 느린 소프트웨어 GL 에서도 곧바로 걷히게
      el.classList.remove('show');
    }
  });
  await page.waitForFunction(() => document.getElementById('guardName').classList.contains('show') && document.getElementById('guardName').innerText.trim(), null, { timeout: 90000 });
  await page.evaluate(PIN, ['guardName']);
  await page.waitForTimeout(500);
  await shot('fight', ['#guardName b', '#guardName small', '#stageInfo .stg', '#stageInfo .foe b', '#stageInfo .foe span', '#btnParry', '#hint']);
  R.errors = errors;
  R.outsideRequests = outside;
  R.fontRequests = [...new Set(fontReqs)];
  await ctx.close();
}
fs.writeFileSync(path.join(out, `${label}_report.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.views).map(([k, r]) => [k, { errors: r.errors.length, outside: r.outsideRequests.length, fonts: r.fontRequests }]))));
await browser.close();
