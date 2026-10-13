// 도트 글꼴 격자 견주기 (docs/ui/pixel_font_2026-10-14.md): 갈무리11 · Jacquard 12 를 여러 크기로 그려 찍고, 글자 가장자리의 '반쯤 칠한 픽셀' 비율을 잰다.
//  도트 하나가 정수 px 에 떨어지는 크기(갈무리11 = 12·24·36 px, Jacquard 12 = 21·42·63 px)는 가장자리가 또렷하고(비율 낮음), 그 밖의 크기는 도트가 고르지 않게 번진다.
//  실행: 개발 서버(npx vite --port <포트>)를 띄운 뒤  node tools/ui/pixel_font_grid.mjs http://127.0.0.1:<포트> <출력 폴더>
//   → <출력>/grid_dpr1.png · grid_dpr3.png (흰 바탕 검은 글자, 줄마다 크기 이름표) + grid.json (줄마다 잉크 픽셀 가운데 회색 비율 %)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'grid';
fs.mkdirSync(out, { recursive: true });
const ROWS = [
  ...[11, 12, 15, 20, 22, 24].map((s) => ({ fam: 'Galmuri11', w: 400, s, text: '스테이지 1 · 포세이돈 신전 Langort' })),
  ...[11, 12, 15, 20, 24].map((s) => ({ fam: 'Galmuri11', w: 800, s, text: '긴 자세 · 하인리히 도른' })),
  ...[21, 24, 36, 42, 48].map((s) => ({ fam: 'Jacquard 12', w: 400, s, text: 'Stillness' })),
];
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Galmuri11'; src: url('/fonts/Galmuri11.woff2') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Galmuri11'; src: url('/fonts/Galmuri11-Bold.woff2') format('woff2'); font-weight: 700; }
@font-face { font-family: 'Jacquard 12'; src: url('/fonts/Jacquard12-latin.woff2') format('woff2'); font-weight: 400; }
html, body { margin: 0; background: #fff; color: #000; }
.row { display: flex; align-items: center; height: auto; padding: 4px 8px; border-bottom: 1px solid #ddd; }
.lab { flex: none; width: 150px; font: 12px/16px 'Galmuri11'; color: #666; }
.txt { white-space: nowrap; line-height: 1.25; letter-spacing: 0; }
</style><body>${ROWS.map((r, i) => `<div class="row"><span class="lab">${r.fam === 'Galmuri11' ? '갈무리11' : 'Jacquard12'} ${r.w === 800 ? '굵게 ' : ''}${r.s}px</span><span class="txt" id="t${i}" style="font-family:'${r.fam}';font-weight:${r.w};font-size:${r.s}px">${r.text}</span></div>`).join('')}</body>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-lcd-text'] }); // 글자 색 번짐(LCD 서브픽셀) 없이 — 회색 픽셀만 센다
const result = {};
for (const dpr of [1, 3]) {
  const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: dpr });
  await page.goto(base + '/fonts/provenance.json'); // 같은 출처에서 글꼴을 읽으려고 (내용은 아래로 갈아 끼운다)
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `grid_dpr${dpr}.png`), fullPage: true });
  // 글자마다: 그 칸만 찍어 회색(반쯤 칠한) 픽셀 비율 — 잉크(어두운 정도 > 8 %) 가운데 8 %~92 % 사이인 것
  const rows = [];
  for (let i = 0; i < ROWS.length; i++) {
    const buf = await page.locator(`#t${i}`).screenshot();
    const stat = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data;
      let ink = 0, gray = 0;
      for (let k = 0; k < d.length; k += 4) {
        const dark = 1 - (d[k] + d[k + 1] + d[k + 2]) / 765;
        if (dark > 0.08) {
          ink++;
          if (dark < 0.92) gray++;
        }
      }
      return { ink, grayPct: ink ? +((100 * gray) / ink).toFixed(1) : 0 };
    }, buf.toString('base64'));
    const r = ROWS[i];
    rows.push({ font: r.fam, weight: r.w, px: r.s, dotPx: +(r.s / (r.fam === 'Galmuri11' ? 12 : 21)).toFixed(3), ...stat });
  }
  result[`dpr${dpr}`] = rows;
  await page.close();
}
fs.writeFileSync(path.join(out, 'grid.json'), JSON.stringify(result, null, 1));
for (const [k, rows] of Object.entries(result)) console.log(k, rows.map((r) => `${r.font === 'Galmuri11' ? 'G' : 'J'}${r.weight === 800 ? 'b' : ''}${r.px}:${r.grayPct}%`).join(' '));
await browser.close();
