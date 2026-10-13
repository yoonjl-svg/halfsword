// 잠든 습지 말레이곰 석상 렌더 (게임 모델 그대로 — 사진은 쓰지 않는다): docs/import/sluice/bear_*.webp
//  ortho  : 사장님 사진과 같은 구도(정면 직교, 685×512, 정수리 y 43 · 발바닥 y 492 · 몸 가운데 x 347 — 받침·땅 숨김) → 비율 맞대기용
//  front  : 정면 약간 아래에서 긴 렌즈(받침까지) · views : 앞 · 앞 왼쪽 35° · 옆 · 뒤 · face : 머리 가까이
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/sluice_bear_shots.mjs http://127.0.0.1:5173 [곰 키 m] [이름 꼬리]
//   (곰 키를 주면 그 키로, 이름 꼬리를 주면 bear_<보기>_<꼬리>.webp 로 — 크기 비교용)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const bearH = process.argv[3] ? `&bearH=${+process.argv[3]}` : '';
const tail = process.argv[4] ? `_${process.argv[4]}` : '';
const outDir = new URL('../../docs/import/sluice/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const shots = [
  ['ortho', 'view=ortho&plinth=0&ground=0&w=685&h=512'],
  ['front', 'view=front&w=640&h=800'],
  ['views', 'view=strip&w=1440&h=450'],
  ['face', 'view=face&w=480&h=480'],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.route('**/*', (r) => (r.request().url().startsWith(base) || r.request().url().startsWith('data:') ? r.continue() : r.abort())); // 바깥 요청 막기
for (const [name, qs] of shots) {
  await page.goto(`${base}/tools/browser/sluice_bear.html?${qs}${bearH}`);
  await page.waitForFunction(() => window.shot?.done, null, { timeout: 120000 });
  const s = await page.evaluate(() => window.shot);
  const buf = Buffer.from(s.url.slice(s.url.indexOf(',') + 1), 'base64');
  fs.writeFileSync(new URL(`bear_${name}${tail}.webp`, outDir), buf);
  console.log(`bear_${name}${tail}.webp ${(buf.length / 1024).toFixed(1)} KB · 삼각형 ${s.triangles}`);
}
console.log(errors.length ? `에러:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
if (errors.length) process.exit(1);
