// 다시 싸우기 N 번 뒤 GPU 자원(geometries·textures·programs)·힙이 자라는지 (10/8 가져올 후보 점검: 샛별의 셰이더 자원 누수 고침이 우리에게도 해당하는가).
//  ?weapon= 으로 뽑기 없이 바로 싸움 → 2.5 s → P(일시정지) → '처음부터 다시' → … 를 N 번. 한 판마다 game.renderInfo() 를 적는다.
//  실행: vite 개발 서버 뒤  PW_CHROMIUM=… node tools/browser/restart_leak_check.mjs [http://127.0.0.1:5173] [N=6]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const N = +(process.argv[3] || 6);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base + '/?weapon=longsword&foeWeapon=longsword', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
const info = () => page.evaluate(() => { window.gc?.(); const r = window.game.renderInfo(); return { ...r, stage: window.game.stage.id, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; });
const rows = [];
rows.push({ round: 0, ...(await info()) });
for (let i = 1; i <= N; i++) {
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  rows.push({ round: i, ...(await info()) });
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 10000 });
  await page.waitForTimeout(300);
}
// 배경 바꾸기 두 바퀴(STAGE_ORDER 여섯 곳): 셰이더 예열·재질 해제 경로
const ORDER = ['poseidon', 'clearing', 'temple', 'castle', 'poseidon_night', 'cathedral'];
for (let lap = 1; lap <= 2; lap++) for (const id of ORDER) {
  await page.evaluate((id) => window.game.setStage(id), id);
  await page.waitForTimeout(1200);
  rows.push({ round: `s${lap}`, ...(await info()) });
}
console.log('round\tstage\tgeometries\ttextures\tprograms\tcalls\ttriangles\theapMB');
for (const r of rows) console.log([r.round, r.stage, r.geometries, r.textures, r.programs, r.calls, r.triangles, r.heapMB].join('\t'));
const sr = rows.filter((r) => String(r.round).startsWith('s')); const d = (k) => sr.at(-1)[k] - sr[5][k];
console.log(`배경 1 바퀴 끝 → 2 바퀴 끝(같은 배경 cathedral): Δgeometries ${d('geometries')} · Δtextures ${d('textures')} · Δprograms ${d('programs')} · Δheap ${sr.at(-1).heapMB != null ? (sr.at(-1).heapMB - sr[5].heapMB).toFixed(1) + ' MB' : 'n/a'}`);
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
