// 본판 빌드(dist/) 브라우저 스모크: 무기·주소 인자(knob) 여러 개를 차례로 띄워 콘솔 에러·예외·두 사람 생존·자세 이름(#guardName)을 본다
//  실행: npx vite build && npx vite preview --port 4173 --strictPort &
//        node tools/browser/build_smoke.mjs http://127.0.0.1:4173 <스크린샷 폴더>
//  ?weapon= 이 없는 주소는 무기 뽑기를 거친다 (내 카드 1번). 결과는 JSON 한 줄씩 + 끝에 요약. 에러가 하나라도 있으면 종료 코드 1
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shotDir = process.argv[3] || null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const WEAPONS = ['longsword', 'qinggang', 'monohoshizao', 'zweihander', 'sabre', 'frozen_tuna', 'rapier'];
const URLS = [...WEAPONS.map((w) => `?weapon=${w}`), '?schoolArt=0', '?schoolRest=pflugR&weapon=qinggang', '?oneVersatile=thrust&weapon=qinggang', '?pommel=1', '?motionLib=0'];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const rows = [];
let settingsCheck = null;
for (const q of URLS) {
  const page = await browser.newPage({ viewport: { width: 480, height: 840 } });
  const errors = [];
  const exceptions = [];
  page.on('pageerror', (e) => exceptions.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' @' + (m.location()?.url || '?')); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  const row = { url: q };
  try {
    await page.goto(base + '/' + q, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
    if (!settingsCheck) {
      // 설정 패널: '검술 보정' 칸([data-setting="skill"])이 없어야 하고 나머지 줄은 보여야 한다
      settingsCheck = await page.evaluate(() => ({
        skillSeg: document.querySelectorAll('[data-setting="skill"]').length,
        settings: [...document.querySelectorAll('#menu [data-setting]')].map((el) => `${el.dataset.setting}:${el.offsetWidth || el.offsetHeight ? 'visible' : 'hidden'}:${el.className}`),
        rowTexts: [...document.querySelectorAll('#menu .row > span')].map((s) => s.textContent.trim()),
      }));
    }
    await page.getByText('싸움 시작').click();
    if (!/weapon=/.test(q)) {
      await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 30000 });
      await page.locator('#draw .wcard[data-i="0"]').click();
    }
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
    const sim0 = await page.evaluate(() => window.game.stats.simTime);
    const names = new Set();
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const t = await page.evaluate(() => document.getElementById('guardName').innerText.replace(/\s+/g, ' ').trim());
      if (t) names.add(t);
      if (i === 15 && shotDir && /^\?weapon=[a-z_]+$/.test(q)) {
        row.shot = `${shotDir}/${q.slice(8)}.png`;
        await page.screenshot({ path: row.shot });
      }
    }
    Object.assign(row, await page.evaluate(() => ({ state: window.game.state, sim: +window.game.stats.simTime.toFixed(2), pw: window.game.player?.weapon?.id, ew: window.game.enemy?.weapon?.id, pAlive: !!window.game.player?.alive, eAlive: !!window.game.enemy?.alive, pState: window.game.player?.state, eState: window.game.enemy?.state })));
    row.ran = row.sim > sim0;
    row.guardNames = [...names];
  } catch (e) {
    exceptions.push('harness: ' + e.message.split('\n')[0]);
  }
  row.consoleErrors = errors;
  row.exceptions = exceptions;
  rows.push(row);
  console.log(JSON.stringify(row));
  await page.close();
}
console.log('SETTINGS ' + JSON.stringify(settingsCheck));
await browser.close();
const bad = rows.filter((r) => r.consoleErrors.length || r.exceptions.length || !r.ran);
console.log(bad.length ? `FAIL ${bad.length}/${rows.length}` : `PASS ${rows.length}/${rows.length} (콘솔 에러 0, 예외 0)`);
process.exit(bad.length || settingsCheck?.skillSeg ? 1 : 0);
