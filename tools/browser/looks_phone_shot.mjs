// 폰 화면 한 장: 게임 카메라 그대로, 가로 844×390(게임은 가로 화면만) — 인물이 실제 거리에서 어떻게 읽히는지 본다 (docs/characters/looks_polish_2026-10-10.md).
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/looks_phone_shot.mjs <주소> <인물 id[:외형 판]> <출력 png> [무대(기본 arena)] [싸운 시간 초(기본 8)]
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const foeArg = process.argv[3] || 'renji';
const out = process.argv[4] || `docs/handoff/${foeArg.replace(':', '_')}_phone.png`;
const stage = process.argv[5] || 'arena';
const secs = Number(process.argv[6] || 8); // 두 사람이 다가와 맞붙은 뒤
const FOE_WEAPON = { artoria: 'excalibur', samira: 'pistol', renji: 'morgenstern', eira: 'rapier' };
const foe = foeArg.split(':')[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(`${base}/?stage=${stage}&${foeArg.includes(':') ? `look=${foeArg}` : `foe=${foe}`}&weapon=longsword&foeWeapon=${FOE_WEAPON[foe] || 'longsword'}&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
await page.getByText('싸움 시작').click({ timeout: 300000 });
await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, secs, { timeout: 900000 });
await page.evaluate(() => { window.game.world.step = () => {}; }); // 그 자리에서 멈춰 찍는다 (카메라는 게임 카메라 그대로)
await page.evaluate(() => new Promise((ok) => { let n = 4; const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
await page.screenshot({ path: out });
const dist = await page.evaluate(() => { const g = window.game, c = g.camera.position, e = g.enemy.bodies.pelvis.translation(); return Math.hypot(c.x - e.x, c.y - e.y, c.z - e.z).toFixed(2); });
await browser.close();
console.log(out, `camera→foe ${dist} m`, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
