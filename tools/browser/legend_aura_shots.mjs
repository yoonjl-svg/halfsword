// 레전드 칼 기운(aura.js AURA_PROFILES) 견줌 사진 (10/21 — 쿠사나기 기운 후보)
//  무기마다 ?weapon=<id>&foeWeapon=longsword 로 판을 열어 판 시작 자세(게임 카메라 · 칼 옆 가까이)와 내 휘두르기 도중(게임 카메라 · 칼 옆 가까이)을 찍는다.
//  기운이 붙었는지(legendaryAura 그룹 · tone)를 적고 콘솔 오류를 센다.
//  실행: 개발 서버를 띄운 뒤  node tools/browser/legend_aura_shots.mjs http://127.0.0.1:<포트> <출력 폴더> [무기,무기,…] [이름 앞붙이] [무대 id]
//   크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 헤드리스 SwiftShader 라 게임 시간이 실제보다 느리게 흐른다
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'out/aura';
const weapons = (process.argv[4] || 'kusanagi').split(',');
const tag = process.argv[5] || '';
const stage = process.argv[6] || 'castle';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

// 칼 옆 가까이: 칼날 가운데를 화면 가운데로, 칼 든 쪽 옆에서 (상대는 감춘다)
async function side(page, path, R = 0.95) {
  await page.evaluate((R) => {
    const g = window.game;
    const T = g.THREE;
    const f = g.player, o = g.enemy;
    const h = f.sword.translation();
    const q = f.sword.rotation();
    const axis = new T.Vector3(0, 1, 0).applyQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w)).normalize();
    const c = new T.Vector3(h.x, h.y, h.z).addScaledVector(axis, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength * 0.45);
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const s = f.side;
    const dir = new T.Vector3(-fz * s, 0, fx * s);
    dir.addScaledVector(axis, -dir.dot(axis)).normalize();
    dir.y += 0.15;
    dir.normalize();
    for (const m of o.meshes) m.group.visible = false;
    g.freeCam = true;
    g.camera.position.copy(c).addScaledVector(dir, R);
    g.camera.lookAt(c);
  }, R);
  await page.waitForTimeout(350);
  await page.screenshot({ path });
  await page.evaluate(() => {
    const g = window.game;
    for (const m of g.enemy.meshes) m.group.visible = true;
    g.freeCam = false;
  });
}
const swipe = (page, k0 = 0) =>
  page.evaluate(async (k0) => {
    const cv = document.getElementById('game');
    const W = cv.clientWidth, H = cv.clientHeight;
    const b = { pointerId: 90 + k0, pointerType: 'touch', bubbles: true, isPrimary: true, button: 0 };
    const x0 = W * 0.82, y0 = H * 0.25;
    cv.dispatchEvent(new PointerEvent('pointerdown', { ...b, clientX: x0, clientY: y0 }));
    for (let k = 1; k <= 8; k++) {
      await new Promise((r) => setTimeout(r, 16));
      window.dispatchEvent(new PointerEvent('pointermove', { ...b, clientX: x0 - k * W * 0.05, clientY: y0 + k * H * 0.07 }));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...b, clientX: x0 - 8 * W * 0.05, clientY: y0 + 8 * H * 0.07 }));
  }, k0);

for (const w of weapons) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(`${w} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${w} console: ${m.text()}`));
  await page.goto(`${base}/?stage=${stage}&foe=isolde&weapon=${w}&foeWeapon=longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#toast, #techCue, #foeIntro { opacity: 0 !important; }' });
  await page.evaluate(() => { window.game.settings && (window.game.settings.trail = false); }); // 손가락 흔적 선(화면 UI)은 사진에서 끈다
  await page.waitForFunction(() => window.game.stats.simTime >= 1.2, null, { timeout: 300000, polling: 50 });
  const aura = await page.evaluate(() => {
    let a = null;
    window.game.player.meshes.find((m) => m.kind === 'weapon')?.group.traverse((o) => { if (o.userData.legendaryAura) a = o.userData.legendaryAura; });
    return a;
  });
  console.log(w, 'aura', JSON.stringify(aura));
  await page.screenshot({ path: `${out}/${tag}${w}_guard_game.png` });
  await side(page, `${out}/${tag}${w}_guard_side.png`);
  await page.waitForFunction(() => window.game.stats.simTime >= 2.4, null, { timeout: 300000, polling: 50 });
  let got = false;
  for (let tries = 0; tries < 4 && !got; tries++) {
    await swipe(page, tries);
    try {
      await page.waitForFunction(() => window.game.player.skill?.swinging, null, { timeout: 15000, polling: 20 });
      got = true;
    } catch {}
  }
  await page.screenshot({ path: `${out}/${tag}${w}_swing_game.png` });
  await side(page, `${out}/${tag}${w}_swing_side.png`, 1.1);
  console.log(w, 'swing', got);
  await page.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);
