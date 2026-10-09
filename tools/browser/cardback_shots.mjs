// 무기 카드 고르기 화면(픽셀 카드 뒷면) 캡처 + 콘솔 에러 확인 (10/10 카드 뒷면 3단계)
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/cardback_shots.mjs http://127.0.0.1:5173 [출력 폴더(기본 docs/handoff)] [무대 id ...]
//  찍는 것: cardbacks_game_<무대>.png — 1280×800, '싸움 시작' 뒤 카드가 다 펼쳐진 고르기 화면
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'docs/handoff';
const stages = process.argv.slice(4).length ? process.argv.slice(4) : ['loggia', 'corsair', 'sacred_grove'];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const stage of stages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${stage} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${stage} console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${stage} http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${stage}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
  const info = await page.evaluate(() => ({ back: document.getElementById('draw').dataset.back, px: getComputedStyle(document.getElementById('draw')).getPropertyValue('--px') }));
  await page.screenshot({ path: `${out}/cardbacks_game_${stage}.png` });
  console.log(stage, JSON.stringify(info));
  await page.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
