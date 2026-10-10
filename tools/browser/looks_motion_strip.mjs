// 싸우는 동안 몇 순간을 이어 찍는다 — 흔들리는 장식(투야나 추트키)·팔과 몸통 사이 틈(마야)을 움직임 속에서 본다 (docs/characters/looks_polish3_2026-10-11.md).
//  물리를 멈추지 않고, 상대 골반 기준 앞 비스듬(기본 50°) 1.8 m 에서 따라가며 시뮬 시간 간격마다 한 장씩 찍어 가로로 이어 붙인다.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/looks_motion_strip.mjs <주소> <인물 id[:외형 판]> <출력 png> [장 수(기본 3)] [간격 초(기본 0.3)] [각도(기본 50, 음수 = 반대쪽)] [시작 초(기본 3)]
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const [, , baseArg, foeArg = 'eira', out = 'docs/handoff/motion_strip.png', nArg = '3', gapArg = '0.3', degArg = '50', startArg = '3'] = process.argv;
const base = (baseArg || 'http://127.0.0.1:5173').replace(/\/$/, '');
const n = Number(nArg), gap = Number(gapArg), deg = Number(degArg), start = Number(startArg);
const FOE_WEAPON = { artoria: 'excalibur', samira: 'pistol', renji: 'morgenstern', eira: 'rapier' };
const foe = foeArg.split(':')[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 420, height: 600 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(`${base}/?stage=arena&${foeArg.includes(':') ? `look=${foeArg}` : `foe=${foe}`}&weapon=longsword&foeWeapon=${FOE_WEAPON[foe] || 'longsword'}&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
await page.getByText('싸움 시작').click({ timeout: 300000 });
await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
// 매 프레임 카메라를 상대에 붙인다 (게임 카메라 대신)
await page.evaluate((deg) => {
  const g = window.game, T = g.THREE;
  g.freeCam = true;
  const follow = () => {
    const E = g.enemy, c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    fw.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    const at = new T.Vector3(c.x, c.y + 0.15, c.z);
    g.camera.position.copy(at).addScaledVector(fw, 1.8).setY(c.y + 0.35);
    g.camera.lookAt(at);
    requestAnimationFrame(follow);
  };
  follow();
}, deg);
const shots = [];
for (let i = 0; i < n; i++) {
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, start + i * gap, { timeout: 900000 });
  shots.push(await page.screenshot());
}
// 이어 붙이기: 브라우저 캔버스로 (파이썬·이미지 도구 없이)
const strip = await page.evaluate(async (pngs) => {
  const imgs = await Promise.all(pngs.map((b64) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + b64; })));
  const cv = document.createElement('canvas'); cv.width = imgs.reduce((s, im) => s + im.width, 0); cv.height = imgs[0].height;
  const cx = cv.getContext('2d'); let x = 0;
  for (const im of imgs) { cx.drawImage(im, x, 0); x += im.width; }
  return cv.toDataURL('image/png').split(',')[1];
}, shots.map((b) => b.toString('base64')));
const fs = await import('node:fs');
fs.writeFileSync(out, Buffer.from(strip, 'base64'));
await browser.close();
console.log(out, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
