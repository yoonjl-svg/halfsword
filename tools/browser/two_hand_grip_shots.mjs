// 두손 칼 쥔 손 가까이 보기 (10/21 — 우치가타나 뒷손이 자루 끝을 넘어가나 확인)
//  무기마다 ?weapon=<id>&foeWeapon=<id> 로 두 검객이 같은 칼을 들고, 판 시작 정지 동안 쥔 손 가까이(칼 든 쪽 · 빈손 쪽) · 몸 옆(칼 전체),
//  싸움이 풀린 뒤 내 휘두르기 도중 · AI 휘두르기 도중을 찍는다 (game.freeCam). 콘솔 오류를 센다.
//  실행: 개발 서버를 띄운 뒤  node tools/browser/two_hand_grip_shots.mjs http://127.0.0.1:<포트> <출력 폴더> [무기,무기,…] [이름 앞붙이]
//   GUARD_ONLY=1 이면 판 시작 자세 사진만. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 헤드리스 SwiftShader 라 게임 시간이 실제보다 느리게 흐른다
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'out/grip';
const weapons = (process.argv[4] || 'uchigatana,kusanagi,monohoshizao').split(',');
const tag = process.argv[5] || '';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const watch = (page, t) => {
  page.on('pageerror', (e) => errors.push(`${t} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${t} console: ${m.text()}`));
};

// 쥔 손 가까이: 칼 원점(칼 든 주먹) ~ 빈손 자리(gripAlong) ~ 코등이 가운데를 화면 가운데로, 칼 축에 수직인 쪽에서
async function closeup(page, who, view, path, R = 0.5) {
  await page.evaluate(({ who, view, R }) => {
    const g = window.game;
    const T = g.THREE;
    const f = who === 'ai' ? g.enemy : g.player;
    const o = who === 'ai' ? g.player : g.enemy;
    const h = f.sword.translation();
    const q = f.sword.rotation();
    const axis = new T.Vector3(0, 1, 0).applyQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w)).normalize();
    const ga = f.weaponCfg.gripAlong, hl = f.weaponCfg.hiltLength;
    const c = new T.Vector3(h.x, h.y, h.z).addScaledVector(axis, (ga + hl) / 2);
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const s = f.side; // 칼 든 쪽
    let dir;
    if (view === 'body') { // 몸 옆에서 칼 전체 (칼 든 쪽, 가슴 높이)
      for (const m of o.meshes) m.group.visible = false;
      g.freeCam = true;
      g.camera.position.set(b.x - fz * s * 2.1 + fx * 0.45, 1.3, b.z + fx * s * 2.1 + fz * 0.45);
      g.camera.lookAt(b.x + fx * 0.45, 1.15, b.z + fz * 0.45);
      return;
    }
    let at = c;
    if (view === 'sword') dir = new T.Vector3(-fz * s, 0, fx * s); // 칼 든 쪽 옆
    else if (view === 'off' || view === 'end') dir = new T.Vector3(fz * s, 0, -fx * s); // 빈손 쪽 옆
    else dir = new T.Vector3(fx, 0.9, fz); // 앞 위
    dir.addScaledVector(axis, -dir.dot(axis)).normalize(); // 칼 축에 수직으로
    if (view === 'clean') { // 몸을 감추고 칼 + 두 주먹만 (주먹은 칼 그룹의 자식이라 남는다) — 주먹이 자루 어디를 쥐었나 한눈에
      for (const m of f.meshes) if (m.kind !== 'weapon') m.group.visible = false;
      // 주먹(hands.js — uv 없는 지오메트리)을 반투명으로: 주먹 속에서 자루가 끝나는지(허공을 쥐는지) 보인다. 찍은 뒤 되돌린다
      for (const c of f.swordGroup.children) {
        if (!c.isMesh || c.geometry.attributes.uv || c.position.y > 0.001 || c.userData.gripShotMat) continue;
        c.userData.gripShotMat = c.material;
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.opacity = 0.38;
        c.material.depthWrite = false;
      }
      dir = new T.Vector3(fz * s, 0.35, -fx * s);
      dir.addScaledVector(axis, -dir.dot(axis)).normalize();
      at = new T.Vector3(h.x, h.y, h.z).addScaledVector(axis, ga / 2 + 0.02);
    }
    if (view === 'end') { // 자루 끝 너머에서 빈손 주먹 쪽을 돌아본다 (자루 끝이 주먹 밖으로 나왔나)
      at = new T.Vector3(h.x, h.y, h.z).addScaledVector(axis, ga - 0.01);
      dir.multiplyScalar(0.75).addScaledVector(axis, -0.66).normalize();
    }
    if (view !== 'top') { dir.y += 0.12; dir.normalize(); }
    for (const m of o.meshes) m.group.visible = false;
    g.freeCam = true;
    g.camera.position.copy(at).addScaledVector(dir, R);
    g.camera.lookAt(at);
  }, { who, view, R });
  await page.waitForTimeout(350);
  await page.screenshot({ path });
  await page.evaluate(({ who }) => {
    const g = window.game;
    const f = who === 'ai' ? g.enemy : g.player;
    const o = who === 'ai' ? g.player : g.enemy;
    for (const m of [...o.meshes, ...f.meshes]) m.group.visible = true;
    for (const c of f.swordGroup.children) if (c.userData.gripShotMat) { c.material.dispose(); c.material = c.userData.gripShotMat; delete c.userData.gripShotMat; }
  }, { who });
}
const info = (page, who) =>
  page.evaluate((who) => {
    const g = window.game;
    const f = who === 'ai' ? g.enemy : g.player;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, weapon: f.weapon.id, gripping: !!f.gripping, swinging: !!f.skill?.swinging, guard: f.guardPose?.table?.[f.guardPose?.nearest]?.name ?? null, gripAlong: f.weaponCfg.gripAlong, hilt: f.weaponCfg.hiltLength };
  }, who);
const swipe = (page, k0 = 0) =>
  page.evaluate(async (k0) => {
    const cv = document.getElementById('game');
    const W = cv.clientWidth, H = cv.clientHeight;
    const b = { pointerId: 78 + k0, pointerType: 'touch', bubbles: true, isPrimary: true, button: 0 };
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
  watch(page, w);
  await page.goto(`${base}/?stage=castle&foe=isolde&weapon=${w}&foeWeapon=${w}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.tap('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.addStyleTag({ content: '#toast, #techCue, #foeIntro { opacity: 0 !important; }' });
  await page.evaluate(() => { window.game.settings && (window.game.settings.trail = false); }); // 손가락 흔적 선(화면 UI)은 사진에서 끈다
  await page.waitForFunction(() => window.game.stats.simTime >= 1.2 && window.game.player.gripping && window.game.enemy.gripping, null, { timeout: 300000, polling: 50 });
  console.log(w, 'guard', JSON.stringify(await info(page, 'me')), JSON.stringify(await info(page, 'ai')));
  await closeup(page, 'me', 'sword', `${out}/${tag}${w}_me_guard_swordside.png`);
  await closeup(page, 'me', 'off', `${out}/${tag}${w}_me_guard_offside.png`);
  await closeup(page, 'me', 'body', `${out}/${tag}${w}_me_guard_body.png`);
  await closeup(page, 'me', 'clean', `${out}/${tag}${w}_me_guard_clean.png`, 0.42);
  await closeup(page, 'ai', 'sword', `${out}/${tag}${w}_ai_guard_swordside.png`);
  await page.evaluate(() => { window.game.freeCam = false; });
  if (process.env.GUARD_ONLY) { await page.close(); continue; } // GUARD_ONLY=1: 판 시작 자세 사진만
  // 내 휘두르기 도중
  await page.waitForFunction(() => window.game.stats.simTime >= 2.4, null, { timeout: 300000, polling: 50 });
  let got = false;
  for (let tries = 0; tries < 4 && !got; tries++) {
    await swipe(page, tries);
    try {
      await page.waitForFunction(() => window.game.player.skill?.swinging, null, { timeout: 15000, polling: 20 });
      got = true;
    } catch {}
  }
  const ms = await info(page, 'me');
  await closeup(page, 'me', 'sword', `${out}/${tag}${w}_me_swing_swordside.png`, 0.6);
  console.log(w, 'me swing', got, JSON.stringify(ms));
  await page.evaluate(() => { window.game.freeCam = false; });
  // AI 휘두르기 도중 (저절로 안 나오면 기다린다)
  try {
    await page.waitForFunction(() => window.game.enemy.skill?.swinging && window.game.enemy.gripping, null, { timeout: 120000, polling: 20 });
    const ai = await info(page, 'ai');
    await closeup(page, 'ai', 'sword', `${out}/${tag}${w}_ai_swing_swordside.png`, 0.6);
    console.log(w, 'ai swing', JSON.stringify(ai));
  } catch {
    console.log(w, 'ai swing: none in time');
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);
