// 브라우저 스모크: 한 판 시작 → 8초 진행 → 콘솔 에러 0 확인
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/smoke.mjs http://127.0.0.1:5173
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 480, height: 840 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text() + ' @' + (m.location()?.url || '?')); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
await page.getByText('싸움 시작').click();
await page.waitForTimeout(8000);
const state = await page.evaluate(() => ({ p: window.game.player.state, e: window.game.enemy.state, w: window.game.player.weapon.id, fw: window.game.enemy.weapon.id }));
console.log('8s state:', JSON.stringify(state));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
