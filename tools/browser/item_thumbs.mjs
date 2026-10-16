// 아이템 · 재화 그림 만들기 (사장님 10/16 14:4x ③ · 15:3x ⑦⑧⑨ — docs/import/item_art_2026-10-16.md):
//  스킬북 25 장 public/ui/books/<유파>_<급>.webp (256 × 336) · 금화 public/ui/wallet/coins.webp · 머리(천 주머니) public/ui/wallet/pouch.webp (256 × 256)
//  무기 카드 그림(weapon_thumbs.mjs)과 같은 빛 · 같은 금속 재질 · 투명 배경 webp. 책 문양 · 등급 색 · 모양을 바꾸면 다시 돌린다.
//  실행: vite 개발 서버를 띄운 뒤 playwright 가 있는 곳에서
//    node tools/browser/item_thumbs.mjs http://127.0.0.1:5251                    (전체 27 장)
//    node tools/browser/item_thumbs.mjs http://127.0.0.1:5251 coins pouch german_3 (몇 개만 — books · coins · pouch · <유파>_<급>)
//    --out=<폴더> 로 다른 곳에 저장(시험) · --q='by=0.6&bx=0.25' 로 구도 시험값을 넘긴다 (item_thumbs_page.js 머리말)
//  찍는 쪽은 tools/browser/item_thumbs.html (+ item_thumbs_page.js) — 브라우저로 열면 256 px 그림과 실제 화면 크기를 눈으로 볼 수 있다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const base = (args.find((a) => !a.startsWith('--') && /^https?:/.test(a)) || 'http://127.0.0.1:5251').replace(/\/$/, '');
const ids = args.filter((a) => !a.startsWith('--') && !/^https?:/.test(a));
const outDir = path.resolve(opt('out') || new URL('../../public/ui/', import.meta.url).pathname);
const query = [ids.length ? 'ids=' + ids.join(',') : '', opt('q') || ''].filter(Boolean).join('&');

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
// 그림은 페이지 모듈이 읽히는 동안 모두 찍는다 — 'load' 를 기다리면 25 장(소프트웨어 GL 로 수십 초)이 끝나야 넘어가므로 첫 응답만 기다린다
await page.goto(`${base}/tools/browser/item_thumbs.html${query ? '?' + query : ''}`, { waitUntil: 'commit' });
await page.waitForFunction(() => window.thumbs?.done, null, { timeout: 180000, polling: 250 }).catch(async (e) => {
  console.error(errors.join('\n') || String(e)); // 모형을 짓다 멈췄으면 그 에러를 보여 준다
  await browser.close();
  process.exit(1);
});
const list = await page.evaluate(() => window.thumbs.list);
// 자리 기준: 투명 여백 ≥ 4 px (물건이 틀에 닿지 않게) · 책은 급 숫자가 표지 안 ≥ 0.035 (책 높이 1 기준 — 256 px 그림에서 약 9 px) · 문양과 숫자 사이 ≥ 0.015
const MIN = { pad: 4, margin: 0.035, gap: 0.015 };
const bad = [];
for (const { path: rel, url, w, h, pad, margin, gap } of list) {
  if (!url.startsWith('data:image/webp')) throw new Error(`${rel}: webp 로 저장되지 않았다 (${url.slice(0, 30)})`);
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  const file = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  const miss = [pad < MIN.pad && `여백 ${pad}px`, margin != null && margin < MIN.margin && `숫자 여백 ${margin}`, gap != null && gap < MIN.gap && `문양-숫자 ${gap}`].filter(Boolean);
  if (miss.length) bad.push(`${rel}: ${miss.join(' · ')}`);
  console.log(`${rel.padEnd(24)} ${w}×${h}  ${(buf.length / 1024).toFixed(1).padStart(4)} KB  여백 ${String(pad).padStart(2)}px${margin != null ? `  숫자 여백 ${margin.toFixed(3)} · 문양-숫자 ${gap.toFixed(3)}` : ''}${buf.length > 20 * 1024 ? '  (20KB 넘음)' : ''}${miss.length ? '  ← 기준 미달' : ''}`);
}
if (bad.length) errors.push(`자리 기준 미달 (${JSON.stringify(MIN)}):\n  ${bad.join('\n  ')}`);
console.log(errors.length ? '에러:\n' + errors.join('\n') : `${list.length}장 저장 → ${outDir}`);
await browser.close();
if (errors.length) process.exit(1);
