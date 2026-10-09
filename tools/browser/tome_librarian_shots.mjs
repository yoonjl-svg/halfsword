// 토메 비달 사서 외형(v2) 전/후 캡처 (docs/characters/tome_librarian_2026-10-10.md).
//  char_polish_shots.mjs 와 같은 구도(상대 AI 를 멈추고 1.2 초 선 뒤 물리를 멈춰 정면·3/4·옆, 640×800) +
//   _loggia : 붉은 회랑에서 4 초 싸운 뒤 게임 카메라 그대로 (내 인물도 보임)
//   _swing  : 붉은 회랑에서 싸우다 토메의 칼끝이 빨리 움직이는(휘두르는·찌르는) 순간을 멈춰 상대 앞 60° 옆에서
//   _select : 무기 뽑기 화면(상대 소개 칸 = 이름·칭호). ?weapon= 없이 '싸움 시작'을 누른 뒤
//   _face   : 머리 가까이 3/4 (안경·끈 확인)
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/tome_librarian_shots.mjs http://127.0.0.1:5173 <tome 또는 tome:v1> <접두어> [출력 폴더(기본 docs/handoff)]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const foeArg = process.argv[3] || 'tome';
const prefix = process.argv[4] || 'tome_shot';
const out = process.argv[5] || 'docs/handoff';
const who = foeArg.includes(':') ? `look=${foeArg}` : 'foe=tome';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(stage, { fight = true, weapon = true, until = 1.2 } = {}) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${stage}&${who}${weapon ? '&weapon=longsword&foeWeapon=rapier' : ''}&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.getByText('싸움 시작').click();
  if (!weapon) return page;
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, until, { timeout: 240000 });
  return page;
}
const hideUi = (page) => page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });

// 1) 정지 자세 세 방향 + 얼굴 가까이 (회색 원형 경기장 — 앞선 캡처와 같은 바탕)
{
  const page = await open('arena', { fight: false });
  await hideUi(page);
  await page.evaluate(() => {
    const g = window.game;
    g.world.step = () => {};
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
  });
  for (const [name, deg, dist, dy, lift] of [['front', 0, 2.2, -0.05, 0.2], ['threeq', 40, 2.2, -0.05, 0.2], ['side', 90, 2.2, -0.05, 0.2], ['back', 180, 2.2, -0.05, 0.2], ['face', 35, 0.75, 0.62, 0.66]]) {
    await page.evaluate(([deg, dist, dy, lift]) => {
      const g = window.game, T = g.THREE, E = g.enemy;
      const face = dist < 1; // 얼굴 가까이: 머리가 보는 쪽 기준
      const c = E.bodies[face ? 'head' : 'pelvis'].translation(), r = E.bodies[face ? 'head' : 'pelvis'].rotation();
      const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
      fw.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
      const at = new T.Vector3(c.x, c.y + (face ? 0 : dy), c.z);
      g.camera.position.copy(at).addScaledVector(fw, dist).setY(c.y + (face ? 0.04 : lift));
      g.camera.lookAt(at);
    }, [deg, dist, dy, lift]);
    await nextFrames(page, 4);
    await page.screenshot({ path: `${out}/${prefix}_${name}.png` });
  }
  await page.close();
}
// 2) 붉은 회랑 대전 장면: 게임 카메라 그대로
{
  const page = await open('loggia', { until: 4.0 });
  await hideUi(page);
  await page.evaluate(() => { window.game.world.step = () => {}; });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${prefix}_loggia.png` });
  await page.close();
}
// 3) 휘두름: 토메 칼이 빨리 움직이는 순간
{
  const page = await open('loggia', { until: 1.5 });
  await hideUi(page);
  await page.waitForFunction(() => {
    const g = window.game;
    if (!g.enemy.sword) return g.stats.simTime > 6;
    const v = g.enemy.sword.linvel();
    return g.stats.simTime > 2 && Math.hypot(v.x, v.y, v.z) > 5;
  }, null, { timeout: 240000, polling: 'raf' }).catch(() => {});
  await page.evaluate(() => {
    const g = window.game, T = g.THREE;
    g.world.step = () => {};
    g.freeCam = true;
    const e = g.enemy.bodies.pelvis.translation(), p = g.player.bodies.pelvis.translation();
    const toP = new T.Vector3(p.x - e.x, 0, p.z - e.z).normalize();
    const at = new T.Vector3(e.x, e.y + 0.1, e.z).addScaledVector(toP, 0.3);
    const view = toP.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 1.0);
    g.camera.position.copy(at).addScaledVector(view, 2.4).setY(e.y + 0.45);
    g.camera.lookAt(at);
  });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${prefix}_swing.png` });
  await page.close();
}
// 4) 무기 뽑기 화면 (상대 소개 칸의 이름·칭호)
{
  const page = await open('loggia', { weapon: false });
  await page.waitForFunction(() => window.game.state === 'draw' && document.getElementById('foeIntro').classList.contains('show'), null, { timeout: 120000 });
  await nextFrames(page, 30);
  await page.screenshot({ path: `${out}/${prefix}_select.png` });
  console.log('foeIntro:', await page.evaluate(() => document.getElementById('foeIntro').innerText.replace(/\s+/g, ' ')));
  await page.close();
}
await browser.close();
console.log(prefix, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
