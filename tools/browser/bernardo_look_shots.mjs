// 베르나르도 겉모습 전/후 그림 (10/23 — 사장님 10/23 '줄이면서 디자인 개선' · docs/handoff/hero_models_2026-10-23/bernardo_*.webp)
//  char_polish_shots.mjs 와 같은 길: ?look=bernardo:<판> 으로 상대를 세우고 AI 를 멈춘 채 1.2 초 서 있게 한 뒤 물리를 멈춰
//  앞 · 3/4(40°) · 뒤를 640 × 800 으로 찍는다(내 인물 · 칼은 감춤 — 상대 칼 티소나는 그대로). 이어 새 판에서 AI 를 켠 채
//  게임 카메라 그대로(폰 가로 844 × 390 · 화면 배율 2) 싸우는 거리 한 장 — 화면 글은 감춤.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/bernardo_look_shots.mjs http://127.0.0.1:5417 <출력 폴더> <판(v1 · v2 · v2-gold)> <접두어> [갈래 …] [--seed=<n>]
//  갈래: views(앞 · 3/4 · 뒤) · fight(싸우는 거리) · face(얼굴 · 목 가까이) · chest(팔 · 칼을 감추고 가슴 앞 — 겉옷 문장) ·
//   side(옆 둘 — 망토 쪽(인물 오른쪽) · 반대쪽, 10/24 망토 두께 보기). 없으면 views · fight
//  --seed=<n>: 페이지의 Math.random 을 씨앗 n 의 같은 수열로 — AI 가 처음 고르는 겨눔이 찍을 때마다 같아 전 · 후 자세가 같다(10/24)
//  출력: <접두어>_front.png · _angle.png · _back.png · _fight.png (· _face.png · _chest.png · _sideR.png · _sideL.png). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5417').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/hero_models_2026-10-23';
const ver = process.argv[4] || 'v2';
const prefix = process.argv[5] || `bernardo_${ver}`;
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
const want = new Set(process.argv.slice(6).filter((a) => !a.startsWith('--')));
const on = (k) => (!want.size && ['views', 'fight'].includes(k)) || want.has(k);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(viewport, fight, scale = 1) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  if (seedArg) await page.addInitScript((seed) => { let x = seed; Math.random = () => ((x = (x * 9301 + 49297) % 233280) / 233280); }, +seedArg.slice(7));
  await page.goto(`${base}/?stage=arena&look=bernardo:${ver}&weapon=longsword&foeWeapon=tizona&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, fight ? 5.0 : 1.2, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  return page;
}

if (on('views') || on('face') || on('chest') || on('side')) {
  const page = await open({ width: 640, height: 800 }, false);
  await page.evaluate(() => {
    const g = window.game;
    g.world.step = () => {}; // 물리를 멈춘다 (겉모습만 본다)
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
  });
  const shots = [];
  if (on('views')) shots.push(['front', 0, 2.2, 0.2, -0.05], ['angle', 40, 2.2, 0.2, -0.05], ['back', 180, 2.2, 0.2, -0.05]);
  if (on('face')) shots.push(['face', 30, 0.95, 0.62, 0.5]);
  if (on('chest')) shots.push(['chest', 0, 1.1, 0.38, 0.3]);
  if (on('side')) shots.push(['sideR', -90, 2.2, 0.2, -0.05], ['sideL', 90, 2.2, 0.2, -0.05]);
  for (const [name, deg, dist, h, aim] of shots) {
    await page.evaluate(({ name, deg, dist, h, aim }) => {
      const g = window.game, T = g.THREE, E = g.enemy;
      for (const part of ['uarmS', 'uarmO', 'farmS', 'farmO']) E.groups[part].visible = name !== 'chest';
      if (E.swordGroup) E.swordGroup.visible = name !== 'chest';
      const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
      const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
      fw.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
      const at = new T.Vector3(c.x, c.y + aim, c.z);
      g.camera.position.copy(at).addScaledVector(fw, dist).setY(c.y + h);
      g.camera.lookAt(at);
    }, { name, deg, dist, h, aim });
    await nextFrames(page, 4);
    await page.screenshot({ path: `${out}/${prefix}_${name}.png` });
  }
  await page.close();
}
// 싸우는 거리: 게임 카메라 그대로 (AI 는 그대로 싸움 · 5 초)
if (on('fight')) {
  const page = await open({ width: 844, height: 390 }, true, 2);
  await page.evaluate(() => { window.game.world.step = () => {}; });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${prefix}_fight.png` });
  await page.close();
}
await browser.close();
console.log(prefix, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
