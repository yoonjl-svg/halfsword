// 카드 앞면 설명 글 넘침 점검 (10/14 글자 규칙 — 카드 설명 작게 --fs-s · 이름 보통 --fs-m, docs/ui/webfont_2026-10-14.md · 앞선 도트 글꼴 판 docs/ui/pixel_font_2026-10-14.md):
//  가로 화면마다 무기를 세 장씩 카드에 채우고(main.js openDraw 와 같은 방법 — 특수 능력 줄 따로) 화면 크기 바뀜(resize)으로 layoutDraw 를 다시 돌린 뒤,
//  카드 크기(--cw·--ch) · 설명·이름 글자 크기 · 그림 칸 최소 높이(--thumbMin) · 넘침(main.js cardTextOverflows 와 같은 판정 + 앞면 상자 밖으로 나간 글)을 잰다.
//  실행: 개발 서버를 띄운 뒤  node tools/cardface/desc_fit_check.mjs http://127.0.0.1:<포트>
//  넘침이 하나라도 있으면 종료 코드 1. playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const SIZES = [
  [844, 390, 3],
  [932, 430, 3],
  [844, 340, 3],
  [568, 320, 2],
  [1280, 720, 1],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
let bad = 0;
let checked = 0;
const errors = [];
for (const [w, h, dpr] of SIZES) {
  const touch = w < 1000;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}×${h} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${w}×${h} console: ${m.text()}`));
  await page.goto(`${base}/?stage=poseidon&foe=heinrich`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  const ids = await page.evaluate(async () => (await import('/src/weapons.js')).WEAPON_LIST.map((x) => x.id));
  const rows = [];
  const before = checked;
  for (let k = 0; k < ids.length; k += 3) {
    const group = [0, 1, 2].map((j) => ids[(k + j) % ids.length]);
    const res = await page.evaluate(async (group) => {
      const { getWeapon, TIER_LABEL } = await import('/src/weapons.js');
      const cards = [...document.querySelectorAll('#draw .wcard')];
      cards.forEach((el, i) => {
        const wp = getWeapon(group[i]);
        el.dataset.tier = wp.tier || 'common';
        const [, main, sub] = wp.nameKo.match(/^(.*?)\s*\((.*)\)\s*$/) || [null, wp.nameKo, ''];
        el.querySelector('.wname').textContent = main;
        el.querySelector('.wsub').textContent = sub;
        el.querySelector('.wtier').textContent = TIER_LABEL[wp.tier] || TIER_LABEL.common;
        const abil = wp.ability ? ` (${wp.ability})` : '';
        const desc = wp.desc || '';
        el.querySelector('.wdesc').textContent = abil && desc.endsWith(abil) ? desc.slice(0, -abil.length) : desc;
        el.querySelector('.wabil').textContent = wp.ability ? `(${wp.ability})` : '';
        el.classList.add('flipped');
      });
      window.dispatchEvent(new Event('resize')); // main.js: resize → layoutDraw (글자 크기 · 넘치면 폭 넓힘)
      await new Promise((r) => setTimeout(r, 700));
      const d = getComputedStyle(document.getElementById('draw'));
      return {
        cw: d.getPropertyValue('--cw'),
        ch: d.getPropertyValue('--ch'),
        desc: `${getComputedStyle(cards[0].querySelector('.wdesc')).fontSize} · 이름 ${getComputedStyle(cards[0].querySelector('.wname')).fontSize} · 그림 칸 최소 ${getComputedStyle(cards[0].querySelector('.wthumb')).minHeight}`,
        faces: cards.map((el, i) => {
          const face = el.querySelector('.wface');
          const thumb = el.querySelector('.wthumb');
          const abil = el.querySelector('.wabil');
          const last = abil.textContent ? abil : el.querySelector('.wdesc');
          const thumbMin = thumb.offsetHeight <= parseFloat(getComputedStyle(thumb).minHeight) + 0.5;
          const limit = face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom);
          const bottom = last.offsetTop + last.offsetHeight;
          const outBox = ['.wname', '.wsub', '.wtier', '.wdesc', '.wabil'].filter((s) => {
            const c = face.querySelector(s);
            return c && getComputedStyle(c).display !== 'none' && (c.offsetTop + c.offsetHeight > face.clientHeight || c.scrollWidth > c.clientWidth + 1);
          });
          // spare = 그림 칸이 더 줄어들 수 있는 높이(px) — 0 아래로 가면(그림 칸이 가장 작은데도 글이 아래 여백을 넘으면) 넘침
          const spare = thumb.offsetHeight - parseFloat(getComputedStyle(thumb).minHeight) + Math.min(0, limit - bottom);
          return { id: group[i], over: (thumbMin && bottom > limit) || outBox.length > 0, outBox, spare: +spare.toFixed(1), thumbH: thumb.offsetHeight, descPx: getComputedStyle(el.querySelector('.wdesc')).fontSize };
        }),
      };
    }, group);
    rows.push(res);
    for (const f of res.faces) {
      checked++;
      if (f.over) {
        bad++;
        console.log(`  넘침 ${w}×${h} ${f.id}: 여유 ${f.spare}px ${f.outBox.join(',')}`);
      }
    }
  }
  const descs = [...new Set(rows.map((r) => r.desc.trim()))];
  const cws = rows.map((r) => parseFloat(r.cw));
  const minSpare = Math.min(...rows.flatMap((r) => r.faces.map((f) => f.spare)));
  console.log(`${w}×${h} (dpr ${dpr}): 카드 ${checked - before} 장 · 설명 글자 ${descs.join(' / ')} · 카드 폭 ${Math.min(...cws)}~${Math.max(...cws)}px × 높이 ${rows[0].ch.trim()} · 가장 작은 여유 ${minSpare}px`);
  for (const r of rows) console.log(`    ${r.faces.map((f) => f.id).join(',')} → 폭 ${r.cw.trim()} · 설명 ${r.desc.trim()} · 여유 ${r.faces.map((f) => f.spare).join('/')}px`);
  await ctx.close();
}
console.log(`확인 ${checked} 장 · 넘침 ${bad} 장 · 콘솔 오류 ${errors.length}`, errors.slice(0, 3));
await browser.close();
process.exit(bad || errors.length ? 1 : 0);
