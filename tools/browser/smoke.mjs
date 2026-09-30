// 브라우저 스모크: 한 판 시작 → 무기 카드 한 장 고르기 (내 카드 1번. 맨 오른쪽은 상대 칸이라 못 고른다) → 상대 카드가 뒤집히는지 →
//  싸움 8초 진행 → 콘솔 에러 0 확인 (싸움이 실제로 흘렀는지도 본다). 아틀라스 풀기 로그 ('[atlas] pack decode') 가 싸움 (state 'fight') 전에 찍혔는지,
//  적용된 손짓 방식·손 몫 (GESTURE.input·DRIVE.hands/handMode/ffFilter) 을 찍고 주소 질의와 맞는지 본다 (새 브라우저라 저장값 없음: 질의 없으면 기본 감기·몸통만)
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/smoke.mjs http://127.0.0.1:5173 ['?input=stroke&hand=wind']   (셋째 인자 = 주소 뒤 질의, 없으면 그대로)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const query = process.argv[3] || '';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 480, height: 840 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
let atlasLog = null, fightSeen = false; // 아틀라스 풀기 로그와 그때 싸움이 이미 시작됐는지
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text() + ' @' + (m.location()?.url || '?'));
  if (atlasLog == null && m.text().startsWith('[atlas] pack decode')) atlasLog = { text: m.text(), beforeFight: !fightSeen };
});
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(base + '/' + query, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 30000 });
await page.getByText('싸움 시작').click();
// 무기 뽑기: 카드가 다 깔리면(0.45초) 내 카드 첫 장을 누르고, 상대 카드가 뒤집힌 뒤 카드가 사라져 싸움이 시작될 때까지 기다린다
await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 30000 });
await page.locator('#draw .wcard[data-i="0"]').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
fightSeen = true;
console.log('atlas:', atlasLog ? `${atlasLog.text} (싸움 전 ${atlasLog.beforeFight})` : '없음');
const cfg = await page.evaluate(() => { const C = window.game.config; return { input: C.GESTURE.input, hands: C.DRIVE.hands, handMode: C.DRIVE.handMode, ffFilter: C.DRIVE.ffFilter, gestureAi: C.GESTURE.ai }; });
console.log('config:', JSON.stringify(cfg));
{
  const q = new URLSearchParams(query);
  const expInput = q.get('input') === 'stroke' ? 'stroke' : 'wind';
  const wind = q.get('hand') === 'wind';
  if (cfg.input !== expInput) errors.push(`GESTURE.input ${cfg.input} != query/default ${expInput}`);
  if (wind ? !(cfg.hands === true && cfg.handMode === 'windOnly' && cfg.ffFilter === true) : cfg.hands !== false) errors.push(`hand config ${JSON.stringify(cfg)} does not match '${wind ? 'wind' : 'trunk'}' (query '${query}')`);
}
if (!atlasLog?.beforeFight) errors.push(`atlas decode log not seen before state 'fight' (${atlasLog ? atlasLog.text : 'none'})`);
const drawn = await page.evaluate(() => ({ foeFlipped: document.querySelector('#draw .wcard.foe').classList.contains('flipped'), foeCard: window.game.draw.ids[2], foeWeapon: window.game.enemy.weapon.id, intro: document.getElementById('foeIntro').textContent }));
if (!drawn.foeFlipped) errors.push('foe card was not revealed before the fight');
if (drawn.foeCard !== drawn.foeWeapon) errors.push(`foe card ${drawn.foeCard} != foe weapon ${drawn.foeWeapon}`);
if (/무기:/.test(drawn.intro)) errors.push('weapon text line still in the foe intro: ' + drawn.intro);
const sim0 = await page.evaluate(() => window.game.stats.simTime);
await page.waitForTimeout(8000);
const state = await page.evaluate(() => ({ game: window.game.state, sim: +window.game.stats.simTime.toFixed(2), p: window.game.player.state, e: window.game.enemy.state, w: window.game.player.weapon.id, fw: window.game.enemy.weapon.id }));
console.log('8s state:', JSON.stringify(state));
const ran = state.sim > sim0; // 싸움(물리)이 실제로 흘렀나
if (!ran) errors.push(`fight did not run (simTime ${sim0} → ${state.sim}, state ${state.game})`);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
