// 인물 외형 다듬기 전/후 캡처 (docs/characters/char_polish_2026-10-10.md).
//  상대 인물 하나를 ?foe=<id> 로 세우고, 상대 AI 를 멈춘 채 1.2 초 서 있게 한 뒤 물리를 멈추고
//  상대 가슴 기준 정면·3/4·옆·뒤 네 방향에서 찍는다(내 인물은 감춤). 이어 새 판에서 AI 를 켠 채 싸우는 장면 한 장.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/char_polish_shots.mjs http://127.0.0.1:5173 <인물 id[:외형 판]> <접두어(예: minami_before)> [출력 폴더(기본 docs/handoff)] [무대(기본 arena)]
//  출력: <접두어>_front.png · _threeq.png · _side.png · _back.png · _fight.png (각 640×800)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const foeArg = process.argv[3] || 'minami'; // 'minami:v4' 꼴이면 그 외형 판으로 (?look=)
const foe = foeArg.split(':')[0];
const prefix = process.argv[4] || `${foe}_shot`;
const out = process.argv[5] || 'docs/handoff';
const stage = process.argv[6] || 'arena';
const FOE_WEAPON = { minami: 'monohoshizao', omari: 'zweihander', tome: 'rapier', artoria: 'excalibur', samira: 'pistol', renji: 'morgenstern', eira: 'rapier', isolde: 'saber', liao: 'qinggang', heinrich: 'excalibur_replica', bran: 'tree_branch' }; // characters.js 의 무기 그대로
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(fight) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${stage}&${foeArg.includes(':') ? `look=${foeArg}` : `foe=${foe}`}&weapon=longsword&foeWeapon=${FOE_WEAPON[foe] || 'longsword'}&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 }).catch((e) => { console.log(errors.join('\n')); throw e; });
  await page.getByText('싸움 시작').click({ timeout: 300000 }); // 기다림을 넉넉히: 여러 작업자가 같은 기계에서 돌릴 때(부하 30+) 느려진다
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, fight ? 4.0 : 1.2, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  return page;
}

// 1) 정지 자세 네 방향
{
  const page = await open(false);
  await page.evaluate(() => {
    const g = window.game;
    g.world.step = () => {}; // 물리를 멈춘다 (겉모습만 본다)
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
  });
  for (const [name, deg] of [['front', 0], ['threeq', 40], ['side', 90], ['back', 180]]) {
    await page.evaluate((deg) => {
      const g = window.game, T = g.THREE, E = g.enemy;
      const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
      const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
      fw.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
      const at = new T.Vector3(c.x, c.y - 0.05, c.z);
      g.camera.position.copy(at).addScaledVector(fw, 2.2).setY(c.y + 0.2);
      g.camera.lookAt(at);
    }, deg);
    await nextFrames(page, 4);
    await page.screenshot({ path: `${out}/${prefix}_${name}.png` });
  }
  await page.close();
}
// 2) 싸우는 장면: 두 사람을 잇는 선의 옆에서 상대 쪽을 가깝게 (AI 는 그대로 싸움)
{
  const page = await open(true);
  await page.evaluate(() => {
    const g = window.game, T = g.THREE;
    g.world.step = () => {};
    g.freeCam = true;
    const e = g.enemy.bodies.pelvis.translation(), p = g.player.bodies.pelvis.translation();
    const toP = new T.Vector3(p.x - e.x, 0, p.z - e.z).normalize();
    const at = new T.Vector3(e.x, e.y + 0.05, e.z).addScaledVector(toP, 0.35);
    const view = toP.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 1.0); // 상대 앞쪽 60° 옆에서 (내 인물은 화면 가장자리)
    g.camera.position.copy(at).addScaledVector(view, 2.6).setY(e.y + 0.4);
    g.camera.lookAt(at);
  });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${prefix}_fight.png` });
  await page.close();
}
await browser.close();
console.log(prefix, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
