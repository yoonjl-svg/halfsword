// 백린의 전사 줄이기 전 · 후 그림 (10/23 — 사장님 '디자인 바꾸지 말고 줄이기만' · docs/decisions.md 10/23 · 확인표 2315 ~ 2317 · 그림 docs/handoff/hero_models_2026-10-23/white_scale_*.webp)
//  같은 무대 · 같은 자세 · 같은 카메라로 v1(전달본 121,398 삼각형) · v2(줄인 판 26,648)를 한 장씩 찍는다(?look=white_scale:v1 · v2). 묶기는 tools/browser/white_scale_sheets.py
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/white_scale_shots.mjs http://127.0.0.1:5414 <출력 폴더> [갈래 …]
//  갈래 (없으면 모두):
//   views   정면 · 앞 3/4 · 뒤 · 가까이(가슴 · 치마 3/4) — 상대 AI 를 끄고 판 시작 자세로 1.2 s 선 뒤 물리를 멈춤 · 내 인물 · 칼 감춤 (720 × 900)
//   fight   결투 거리 — 게임 카메라 그대로 폰 가로 844 × 390 · 화면 배율 2 (판 시작 4 s 자세를 멈추고 상대를 맞붙는 거리 2.0 m 로 옮김 · 두 인물 · 글 그대로)
//  출력 png: views_<판>_<front|angle|back|detail>.png · fight_<판>.png (+ fight_<판>.json — 화면 속 상대 몸 상자) · 콘솔 오류 · HTTP 400 이상을 모아 끝에 적는다
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5414').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/hero_models_2026-10-23/shots';
const want = new Set(process.argv.slice(4));
const on = (k) => !want.size || want.has(k);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const VERSIONS = ['v1', 'v2'];
const GAP = 2.0; // 맞붙는 거리 (골반 사이 m)

function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`pageerror (${tag}): ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (${tag}): ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} (${tag}): ${r.url()}`); });
}
/** 백린의 전사(그 판)를 상대로 판을 열고, AI 를 끈 채 판 시작 자세로 until 초 세운다 */
async function open(ver, { viewport, scale = 1, until = 1.2 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  watch(page, ver);
  await page.goto(`${base}/?stage=arena&foe=white_scale&look=white_scale:${ver}&weapon=longsword&foeWeapon=muramasa&emo=0`, { waitUntil: 'networkidle', timeout: 600000 });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, until, { timeout: 900000 });
  return { ctx, page };
}
/** 상대 몸 · 옷 삼각형 · 메쉬 수 (보이는 것 — 칼 뺌) */
const count = (page) => page.evaluate(() => {
  const E = window.game.enemy;
  let t = 0, m = 0;
  for (const g of Object.values(E.groups)) g.traverse((o) => { let v = o; while (v) { if (!v.visible) return; v = v.parent; } if (o.isMesh) { const geo = o.geometry; t += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; m++; } });
  return { tris: t, meshes: m };
});
/** 상대 몸 기준 카메라: 골반 앞 방향을 deg 만큼 돌린 쪽 dist m · 카메라 높이 h · 보는 점 높이 aim · 화각 fov° */
async function cam(page, deg, dist, h, aim, fov) {
  await page.evaluate(({ deg, dist, h, aim, fov }) => {
    const g = window.game, T = g.THREE, E = g.enemy;
    g.camera.fov = fov;
    g.camera.aspect = innerWidth / innerHeight;
    g.camera.updateProjectionMatrix();
    const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    const at = new T.Vector3(c.x, aim, c.z);
    g.camera.position.copy(at).addScaledVector(fw.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180), dist).setY(h);
    g.camera.lookAt(at);
  }, { deg, dist, h, aim, fov });
  await nextFrames(page, 4);
}
const log = [];
const say = (s) => { console.log(s); log.push(s); };

if (on('views')) {
  for (const ver of VERSIONS) {
    const { ctx, page } = await open(ver, { viewport: { width: 720, height: 900 } });
    const n = await count(page);
    say(`views ${ver}: 몸 · 옷 삼각형 ${n.tris} · 메쉬 ${n.meshes}`);
    await page.evaluate(() => {
      const g = window.game;
      g.world.step = () => {};
      g.freeCam = true;
      for (const m of g.player.meshes) m.group.visible = false;
      if (g.player.swordGroup) g.player.swordGroup.visible = false;
      if (g.enemy.swordGroup) g.enemy.swordGroup.visible = false; // 칼이 가슴을 가리지 않게 (칼은 두 판이 같다)
      const st = document.createElement('style');
      st.textContent = 'body > :not(#game), #moveStick, #moveKnob { display: none !important; }';
      document.head.append(st);
    });
    for (const [name, deg, dist, h, aim, fov] of [['front', 0, 5.2, 1.3, 1.02, 26], ['angle', -35, 5.2, 1.3, 1.02, 26], ['back', 180, 5.2, 1.3, 1.02, 26], ['detail', -30, 2.6, 1.25, 1.0, 22]]) {
      await cam(page, deg, dist, h, aim, fov);
      await page.screenshot({ path: `${out}/views_${ver}_${name}.png` });
    }
    await ctx.close();
  }
}

if (on('fight')) {
  for (const ver of VERSIONS) {
    const { ctx, page } = await open(ver, { viewport: { width: 844, height: 390 }, scale: 2, until: 4 });
    // 물리를 멈추고, 상대(몸 · 칼 그대로 한 덩어리)를 내 인물 쪽으로 옮겨 맞붙는 거리(골반 사이 GAP m)에 세운다 — 판 시작 거리(5.6 m)는 너무 멀다.
    //  게임 카메라는 그대로 따라온다(자세 · 카메라가 두 판에 같다)
    await page.evaluate((gap) => {
      const g = window.game, E = g.enemy, P = g.player;
      g.world.step = () => {};
      const pe = E.bodies.pelvis.translation(), pp = P.bodies.pelvis.translation();
      const dx = pp.x - pe.x, dz = pp.z - pe.z, d = Math.hypot(dx, dz), k = (d - gap) / d;
      for (const rb of new Set(E.meshes.map((m) => m.rb).filter(Boolean))) {
        const t = rb.translation();
        rb.setTranslation({ x: t.x + dx * k, y: t.y, z: t.z + dz * k }, false);
      }
    }, GAP);
    await page.waitForTimeout(2500); // 카메라가 새 거리에 자리 잡게
    // 화면 속 상대 몸 상자(가까이 자르기용 · CSS 화소): 부위 몸체 자리(머리 · 발 · 손 …)를 화면에 비춘 상자 + 뿔 · 발끝 몫 여유
    const box = await page.evaluate(() => {
      const g = window.game, T = g.THREE, E = g.enemy;
      const W = innerWidth, H = innerHeight, xs = [], ys = [];
      for (const rb of Object.values(E.bodies)) {
        const t = rb.translation(), p = new T.Vector3(t.x, t.y, t.z).project(g.camera);
        xs.push((p.x + 1) / 2 * W);
        ys.push((1 - p.y) / 2 * H);
      }
      const h = Math.max(...ys) - Math.min(...ys);
      return { x0: Math.min(...xs) - h * 0.35, x1: Math.max(...xs) + h * 0.35, y0: Math.min(...ys) - h * 0.3, y1: Math.max(...ys) + h * 0.12, W, H };
    });
    const n = await count(page);
    say(`fight ${ver}: 화면 속 상대 자르기 상자 ${Math.round(box.x1 - box.x0)} × ${Math.round(box.y1 - box.y0)} CSS 화소 · 삼각형 ${n.tris}`);
    writeFileSync(`${out}/fight_${ver}.json`, JSON.stringify(box));
    await page.screenshot({ path: `${out}/fight_${ver}.png` });
    await ctx.close();
  }
}

await browser.close();
say(errors.length ? `오류 ${errors.length}:\n  ${errors.join('\n  ')}` : '콘솔 오류 0');
writeFileSync(`${out}/log.txt`, log.join('\n') + '\n');
process.exit(errors.length ? 1 : 0);
