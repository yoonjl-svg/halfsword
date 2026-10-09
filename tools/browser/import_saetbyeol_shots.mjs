// 샛별 저장소에서 가져온 세 무대·세 인물 스모크 + 캡처 (10/10).
//  무대마다 ?stage=<id> 로 고정해 기본 상대(STAGE_FOE)가 나오는지 → 무기 카드 한 장 → 싸움 6초 → 콘솔 에러 0 → 캡처
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/import_saetbyeol_shots.mjs http://127.0.0.1:5173 [출력 폴더(기본 docs/handoff)]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'docs/handoff';
const CASES = [
  { stage: 'loggia', foe: 'tome', weapon: 'rapier' },
  { stage: 'corsair', foe: 'omari', weapon: 'zweihander' },
  { stage: 'sacred_grove', foe: 'minami', weapon: 'monohoshizao' },
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 480, height: 840 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${c.stage}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
  const back = await page.evaluate(() => document.getElementById('draw').dataset.back);
  await page.screenshot({ path: `${out}/import_saetbyeol_${c.stage}_draw.png` });
  await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  const sim0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => ({
    stage: window.game.stage.id, game: window.game.state, sim: +window.game.stats.simTime.toFixed(2),
    foeWeapon: window.game.enemy.weapon.id, foeName: document.querySelector('#foeIntro b')?.textContent,
    tradition: window.game.ai?.art?.tradition ?? window.game.ai?.school?.tradition,
  }));
  await page.screenshot({ path: `${out}/import_saetbyeol_${c.stage}_fight.png` });
  if (s.stage !== c.stage) errors.push(`stage ${s.stage} != ${c.stage}`);
  if (s.foeWeapon !== c.weapon) errors.push(`foe weapon ${s.foeWeapon} != ${c.weapon}`);
  if (!(s.sim > sim0)) errors.push(`fight did not run (${sim0} → ${s.sim})`);
  console.log(c.stage, JSON.stringify({ ...s, back }), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
