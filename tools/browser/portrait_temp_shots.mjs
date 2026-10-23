// 임시 프로필 그림 찍기 (10/23 — 진짜 그림은 샛별 저장소에 따로 부탁 · docs/import/wander_heroes_import_2026-10-23.md §5):
//  상대 인물 하나를 ?foe=<id> 로 세우고 AI 를 멈춘 채 1.2 초 서 있게 한 뒤 물리를 멈추고, 무대 · 내 인물을 감춘 채
//  얼굴 · 가슴 위를 오른쪽 3/4 에서 768² 로 두 번 찍는다(바탕 검정 · 흰색 — 두 장의 차이로 투명도를 셈한다, tools/ui/portraits_temp_build.py).
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/portrait_temp_shots.mjs http://127.0.0.1:5173 <출력 폴더> <인물 id> [인물 id …]
//  출력: <id>_black.png · <id>_white.png
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
//  10/24 — 세 인물 모두 샛별 저장소 손그림 확정본으로 바뀜(docs/import/hero_profiles_import_2026-10-24.md) · 이 도구는 기록으로 둔다
import { chromium } from 'playwright';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff';
const ids = process.argv.slice(4);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`${id} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} console: ${m.text()}`); });
  await page.goto(`${base}/?stage=arena&foe=${id}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.2, null, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  await page.evaluate(() => {
    const g = window.game, T = g.THREE, E = g.enemy;
    g.world.step = () => {}; // 물리를 멈춘다 (겉모습만 본다)
    g.freeCam = true;
    g.screenTint.visible = false;
    // 상대 몸 · 빛만 남긴다 (무대 · 내 인물 · 칼 · 그림자 받는 바닥 감춤)
    const keep = new Set(E.meshes.map((m) => m.group));
    for (const o of g.scene.children) if (!keep.has(o) && !o.isLight) o.visible = false;
    if (E.swordGroup) E.swordGroup.visible = false;
    for (const part of ['farmS', 'farmO']) if (E.groups[part]) E.groups[part].visible = false; // 겨눈 팔뚝이 가슴을 가리지 않게
    g.scene.fog = null;
    // 도트 프로필처럼 밝고 또렷하게: 하늘 · 땅 빛 하나 + 카메라 쪽 빛 하나를 더한다 (무대 빛만으로는 어둡다)
    g.scene.add(new T.HemisphereLight(0xfff4e2, 0x4a3a2a, 1.4));
    const key = new T.DirectionalLight(0xffffff, 1.6);
    g.scene.add(key);
    g.__portraitKey = key;
    // 얼굴 · 가슴 위 — 오른쪽 3/4 (인물 앞 방향을 인물 오른쪽으로 35° 돌린 쪽에서 · 얼굴이 화면 오른쪽을 본다)
    const h = E.bodies.head.translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    const dir = fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), (-35 * Math.PI) / 180);
    const at = new T.Vector3(h.x, h.y - 0.06, h.z);
    g.camera.fov = 16;
    g.camera.aspect = 1;
    g.camera.updateProjectionMatrix();
    g.camera.position.copy(at).addScaledVector(dir, 1.35).setY(at.y + 0.07);
    g.camera.lookAt(at);
    key.position.copy(g.camera.position).add(new T.Vector3(0, 0.6, 0));
    key.target.position.copy(at);
    g.scene.add(key.target);
  });
  for (const [name, color] of [['black', 0x000000], ['white', 0xffffff]]) {
    await page.evaluate((color) => { const g = window.game; g.scene.background = new g.THREE.Color(color); }, color);
    await nextFrames(page, 4);
    await page.screenshot({ path: `${out}/${id}_${name}.png` });
  }
  await page.close();
}
await browser.close();
console.log(ids.join(' '), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
