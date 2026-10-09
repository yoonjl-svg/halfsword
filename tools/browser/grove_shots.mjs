// 신목의 숲 전/후 캡처 + 그리기 호출·프레임 시간(참고치) (10/10 소나무·안개 작업)
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/grove_shots.mjs http://127.0.0.1:5173 <접두어(grove_before|grove_after)> [출력 폴더(기본 docs/handoff)]
//  찍는 것: <접두어>_phone.png (폰 가로 844×420, 경기 카메라) · <접두어>_wide.png (1600×900, 신목 쪽을 넓게)
//           <접두어>_fight.png (844×420, 싸우는 중) · grove_after 일 때는 무대를 넘긴 다음 장면 <접두어>_next_stage.png (안개가 남지 않는지)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const prefix = process.argv[3] || 'grove_shot';
const out = process.argv[4] || 'docs/handoff';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const frameMs = (page, n = 60) => page.evaluate((n) => new Promise((ok) => {
  const ts = []; const f = (t) => { ts.push(t); ts.length > n ? ok(ts) : requestAnimationFrame(f); }; requestAnimationFrame(f);
}), n).then((ts) => { const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b); return { median: +d[d.length >> 1].toFixed(1), mean: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) }; });

async function open(viewport, fight) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=sacred_grove&foe=minami&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 90000 });
  return page;
}
const hideUi = (page) => page.addStyleTag({ content: 'body > :not(#game) { display: none !important; }' });

// ① 폰 가로, 경기 카메라 그대로 (가만히 겨눈 두 사람)
let page = await open({ width: 844, height: 420 }, false);
await page.keyboard.press('KeyP');
await page.evaluate(() => { window.game.freeCam = true; });
await hideUi(page); await nextFrames(page);
const perf = { phone: { ...(await frameMs(page)), ...(await page.evaluate(() => window.game.renderInfo())) } };
await page.screenshot({ path: `${out}/${prefix}_phone.png` });
await page.close();

// ② 넓은 화면, 결투장 뒤에서 신목과 숲 쪽을 넓게 본다
page = await open({ width: 1600, height: 900 }, false);
await page.keyboard.press('KeyP');
await page.evaluate(() => { const g = window.game; g.freeCam = true; g.camera.position.set(-9, 4.2, 6); g.camera.lookAt(14, 5.5, -2); g.camera.updateMatrixWorld(); });
await hideUi(page); await nextFrames(page);
perf.wide = { ...(await frameMs(page)), ...(await page.evaluate(() => window.game.renderInfo())) };
await page.screenshot({ path: `${out}/${prefix}_wide.png` });
await page.close();

// ②' (GROVE_EXTRA=1 일 때만) 반대쪽 숲을 가까이 — 고치는 동안 둘레 소나무 꼴을 보는 용도
if (process.env.GROVE_EXTRA) {
  page = await open({ width: 1200, height: 700 }, false);
  await page.keyboard.press('KeyP');
  const look = (process.env.GROVE_LOOK || '2,3,2,-20,7,6').split(',').map(Number); // 카메라 자리 x,y,z + 보는 곳 x,y,z
  await page.evaluate((v) => { const g = window.game; g.freeCam = true; g.camera.position.set(v[0], v[1], v[2]); g.camera.lookAt(v[3], v[4], v[5]); g.camera.updateMatrixWorld(); }, look);
  await hideUi(page); await nextFrames(page);
  await page.screenshot({ path: `${out}/${prefix}_forest.png` });
  await page.close();
}

// ③ 싸우는 장면 (AI 그대로 6초)
page = await open({ width: 844, height: 420 }, true);
await page.waitForTimeout(6000);
await hideUi(page); await nextFrames(page);
await page.screenshot({ path: `${out}/${prefix}_fight.png` });
// ④ 다른 무대로 넘긴다: 안개·하늘색이 처음 값으로 돌아왔는지
await page.evaluate(() => window.game.setStage('temple'));
await nextFrames(page, 6);
const after = await page.evaluate(() => {
  let scene = null; window.game.player.meshes[0].group.traverseAncestors((o) => { if (o.isScene) scene = o; });
  const f = scene?.fog; return { stage: window.game.stage.id, fog: f ? { type: f.type ?? (f.isFogExp2 ? 'FogExp2' : 'Fog'), color: '#' + f.color.getHexString(), near: f.near, far: f.far, density: f.density } : null, groveLeft: scene.children.filter((o) => (o.name || '').startsWith('grove-')).length };
});
await page.screenshot({ path: `${out}/${prefix}_next_stage.png` });
await page.close();
await browser.close();
console.log(JSON.stringify({ prefix, perf, nextStage: after }, null, 1));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
