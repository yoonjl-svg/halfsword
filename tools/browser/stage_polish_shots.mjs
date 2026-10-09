// 붉은 회랑·산호 항구 전/후 캡처 (10/10 무대 다듬기)
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/stage_polish_shots.mjs http://127.0.0.1:5173 <무대(loggia|corsair)> <접두어(loggia_before …)> [출력 폴더(기본 docs/handoff)]
//  찍는 것: <접두어>_phone.png (폰 가로 844×420, 경기 카메라, 두 사람 가만히) · <접두어>_wide.png (1600×900, 무대마다 정한 넓은 각도)
//           <접두어>_fight.png (844×420, 싸우는 중 6초)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const stage = process.argv[3] || 'loggia';
const prefix = process.argv[4] || `${stage}_shot`;
const out = process.argv[5] || 'docs/handoff';
// 넓은 각도: 카메라 자리 x,y,z + 보는 곳 x,y,z
const WIDE = {
  loggia: [-10.5, 5.2, 9.5, 3.5, 0.6, -3.5], // 서쪽 난간 앞에서 결투장 바닥·북쪽 회랑·동쪽 문 쪽
  corsair: [-9.5, 5.5, -9, 9, 0.2, 6], // 성문 쪽에서 앞마당·부두·바다 쪽
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(viewport, fight) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${stage}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 90000 });
  return page;
}
const hideUi = (page) => page.addStyleTag({ content: 'body > :not(#game) { display: none !important; }' });
const perf = {};

// ① 폰 가로, 경기 카메라 그대로
let page = await open({ width: 844, height: 420 }, false);
await page.keyboard.press('KeyP');
await page.evaluate(() => { window.game.freeCam = true; });
await hideUi(page); await nextFrames(page);
perf.phone = await page.evaluate(() => window.game.renderInfo());
await page.screenshot({ path: `${out}/${prefix}_phone.png` });
await page.close();

// ② 넓은 화면
page = await open({ width: 1600, height: 900 }, false);
await page.keyboard.press('KeyP');
const look = (process.env.SHOT_LOOK ? process.env.SHOT_LOOK.split(',').map(Number) : WIDE[stage]);
await page.evaluate((v) => { const g = window.game; g.freeCam = true; g.camera.position.set(v[0], v[1], v[2]); g.camera.lookAt(v[3], v[4], v[5]); g.camera.updateMatrixWorld(); }, look);
await hideUi(page); await nextFrames(page);
perf.wide = await page.evaluate(() => window.game.renderInfo());
await page.screenshot({ path: `${out}/${prefix}_wide.png` });
await page.close();

// ③ 싸우는 장면 (AI 그대로 6초)
if (!process.env.SHOT_NO_FIGHT) {
  page = await open({ width: 844, height: 420 }, true);
  await page.waitForTimeout(6000);
  await hideUi(page); await nextFrames(page);
  await page.screenshot({ path: `${out}/${prefix}_fight.png` });
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ stage, prefix, perf }));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
