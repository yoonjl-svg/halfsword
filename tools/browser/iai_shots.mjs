// 발도(고노센) · 이베리아 휩쓸기 (10/10 — src/secret_instant.js) 브라우저 확인. 콘솔 에러 0.
//  docs/handoff/iai_rear_1.png · iai_rear_2.png  — 뒤쪽 게임 카메라에서 발도 잔상 (내 발도 · 상대 발도)
//  docs/handoff/iai_side.png                      — 옆에서 본 발도 잔상
//  docs/handoff/iai_ready.png                     — 상대 AI 발도 대기 자세 (상대 간격 밖 iaiArmTime 초)
//  docs/handoff/iai_stiff.png                     — 발도 뒤 경직 (따라 베기 끝에서 앞으로 뻗은 채)
//  docs/handoff/iberian_sweep_cam.png             — 이베리아 휩쓸기 중 카메라가 사이드스텝 쪽으로 돈 장면
//  docs/handoff/iberian_sweep_trail.png           — 이베리아 휩쓸기 잔상 + 같은 칼의 보통 휘두르기 잔상(같은 색)
//  소프트웨어 GL 은 화면이 느려(벽 10 s ≈ 게임 1~2 s) 시험에서만 잔상 시간·창 시간을 늘리고, 상대 비기가 오래 안 나오면 직접 낸다.
//  실행: npx vite build && npx vite preview --port 4187 --strictPort &
//        node tools/browser/iai_shots.mjs http://127.0.0.1:4187 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4187';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
async function open(q, arcLife = 8) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.evaluate((L) => (window.game.config.SECRET.instantArcLife = L), arcLife);
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
  return page;
}
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +g.player.foeDistance().toFixed(2), pStage: g.player.skill.sec?.stage ?? null, pArc: g.player.instantArc?.id ?? 0, eArc: g.enemy.instantArc?.id ?? 0, aiStage: g.ai.secretRun?.stage ?? null, armed: !!g.ai.iaiArm?.armed, readyW: +(g.enemy.iaiReadyW ?? 0).toFixed(2), eRes: g.enemy.instantResult, pRes: g.player.instantResult, pAlive: g.player.alive, eAlive: g.enemy.alive };
  });
const side = async (page, path) => {
  await page.evaluate(() => {
    const g = window.game;
    const a = g.player.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(mx - (dz / L) * 3.4, 1.7, mz + (dx / L) * 3.4);
    g.camera.lookAt(mx, 1.15, mz);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const tap = (page) =>
  page.evaluate(async () => {
    const cv = document.getElementById('game');
    const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 210, bubbles: true, isPrimary: true, button: 0 };
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise((r) => setTimeout(r, 40));
    cv.dispatchEvent(new PointerEvent('pointerup', o));
  });
const forceWindow = (page) =>
  page.evaluate(() => {
    const W = window.game.playerSecret;
    if (!W.open) W.openWindow(null);
    W.open.t = 5;
  });
async function waitFor(page, pred, ms) {
  const t0 = Date.now();
  let r = await probe(page);
  while (!pred(r) && Date.now() - t0 < ms && r.state === 'fight') {
    await page.waitForTimeout(100);
    r = await probe(page);
  }
  return r;
}

// ① 상대 AI 발도: 대기 자세 → 발도(뒤쪽 카메라) → 옆 → 경직
{
  const page = await open('?weapon=longsword&foeWeapon=monohoshizao');
  let r = await waitFor(page, (x) => x.armed && x.readyW > 0.9, 200000);
  if (r.armed) {
    await side(page, `${dir}/iai_ready.png`);
    out.ready = r;
  }
  // 대기 자세의 상대에게 내가 걸어 들어간다(W) → 상대가 칼을 들기 전 닿는 거리에서 저절로 안 나오면 직접 낸다 (조건 판정만 건너뜀 — 실행은 그대로)
  let forced = false;
  await page.keyboard.down('KeyW');
  r = await waitFor(page, (x) => x.eArc > 0 || x.d < 2.15, 90000);
  await page.keyboard.up('KeyW');
  if (!(r.eArc > 0)) r = await waitFor(page, (x) => x.eArc > 0, 4000);
  if (!(r.eArc > 0) && r.pAlive) {
    forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    r = await waitFor(page, (x) => x.eArc > 0, 30000);
  }
  if (r.eArc > 0) {
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${dir}/iai_rear_2.png` });
    out.rearFoe = { ...(await probe(page)), forced };
    await side(page, `${dir}/iai_side.png`);
    r = await waitFor(page, (x) => x.aiStage === 'stiff', 20000);
    if (r.aiStage === 'stiff') {
      await page.waitForTimeout(400);
      await side(page, `${dir}/iai_stiff.png`);
      out.stiff = await probe(page);
    }
  } else out.rearFoe = { none: r };
  await page.context().close();
}
// ② 내 발도 (뒤쪽 카메라)
{
  const page = await open('?weapon=monohoshizao&foeWeapon=longsword');
  await waitFor(page, (x) => x.d < 2.2, 90000);
  await forceWindow(page);
  await tap(page);
  const r = await waitFor(page, (x) => x.pArc > 0, 30000);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${dir}/iai_rear_1.png` });
  out.rearMe = r;
  await page.context().close();
}
// ③ 이베리아 휩쓸기: 카메라 돎 + 잔상 (+ 보통 휘두르기 잔상 같은 색)
{
  const page = await open('?weapon=zweihander&foeWeapon=longsword');
  // 시험만: 보통 잔상이 느린 화면에서도 보이게 (빠르기 문턱 낮춤·조금 길게), 손가락 흔적 선(화면 UI)은 끔 — 비기 잔상과 보통 잔상의 색을 한 장에서 견준다
  await page.evaluate(() => {
    const g = window.game;
    g.config.SWORD_TRAIL.vMin = 1.5;
    g.config.SWORD_TRAIL.life = 0.5;
    g.settings.trail = false;
  });
  await waitFor(page, (x) => x.d < 2.4, 90000);
  await forceWindow(page);
  await tap(page);
  let r = await waitFor(page, (x) => x.pArc > 0, 30000);
  await page.waitForTimeout(120); // 카메라가 도는 중 (0.15 s 실시간)
  await page.screenshot({ path: `${dir}/iberian_sweep_cam.png` });
  out.sweepCam = { ...r, cam: await page.evaluate(() => [window.game.camera.position.x, window.game.camera.position.z].map((v) => +v.toFixed(2))) };
  // 경직이 끝난 뒤 보통 휘두르기(손가락 끌기) — 같은 칼의 보통 잔상과 비기 잔상(남겨 둠)을 한 장에
  r = await waitFor(page, (x) => x.pStage === null, 30000);
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const cv = document.getElementById('game');
    const base = { pointerId: 78, pointerType: 'touch', bubbles: true, isPrimary: true, button: 0 };
    cv.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: 700, clientY: 120 }));
    for (let k = 1; k <= 8; k++) {
      await new Promise((res) => setTimeout(res, 16));
      window.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: 700 - k * 45, clientY: 120 + k * 30 }));
    }
    window.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: 340, clientY: 360 }));
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${dir}/iberian_sweep_trail.png` });
  out.sweepTrail = await probe(page);
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
