// 비기 자세 (10/10 04:2x — 발도 웅크림 · 이탈리아 런지, src/secret_instant.js stanceTick) 옆에서 본 캡처. 콘솔 에러 0.
//  docs/handoff/stance_iai_ready.png · stance_iai_draw.png · stance_iai_stiff.png — 상대 모노호시자오(일본) 발도 대기 · 발도 순간 · 뻗은 경직
//  docs/handoff/stance_lunge.png — 상대 레이피어(이탈리아) Passata 런지 순간
//  상대 골반 높이·두 발 사이(보폭)·몸통 숙임을 함께 적는다. 비기가 오래 안 나오면 직접 낸다(조건 판정만 건너뜀).
//  실행: npx vite build && npx vite preview --port 4187 --strictPort &
//        node tools/browser/stance_shots.mjs http://127.0.0.1:4187 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4187';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  await page.evaluate(() => (document.getElementById('techCue').style.visibility = 'hidden')); // 기술 이름 알림이 자세를 가리지 않게 (시험만)
  return page;
}
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const e = g.enemy;
    const pv = e.bodies.pelvis.translation();
    const L = e.gait?.legs;
    const stride = L ? Math.hypot(L.F.plant.x - L.B.plant.x, L.F.plant.z - L.B.plant.z) : null;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +g.player.foeDistance().toFixed(2), pAlive: g.player.alive, eAlive: e.alive, armed: !!g.ai.iaiArm?.armed, readyW: +(e.iaiReadyW ?? 0).toFixed(2), aiStage: g.ai.secretRun?.stage ?? null, aiPhase: g.ai.phase, eArc: e.instantArc?.id ?? 0, lungeT: +(e.lungeT ?? 0).toFixed(2), stance: e.secretStance ? { drop: +e.secretStance.drop.toFixed(2), pitchDeg: +((e.secretStance.pitch * 180) / Math.PI).toFixed(0) } : null, pelvisY: +pv.y.toFixed(2), stride: stride != null ? +stride.toFixed(2) : null, tilt: +e.tiltDeg().toFixed(0) };
  });
// 상대를 옆에서 (상대가 화면 가운데, 카메라는 두 사람 줄에 수직)
const side = async (page, path) => {
  await page.evaluate(() => {
    const g = window.game;
    const a = g.player.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(b.x - (dx / L) * 0.6 - (dz / L) * 3.0, 1.05, b.z - (dz / L) * 0.6 + (dx / L) * 3.0);
    g.camera.lookAt(b.x - (dx / L) * 0.6, 0.85, b.z - (dz / L) * 0.6);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
async function waitFor(page, pred, ms, step = 80) {
  const t0 = Date.now();
  let r = await probe(page);
  while (!pred(r) && Date.now() - t0 < ms && (r.state === 'fight' || r.state === 'paused')) {
    await page.waitForTimeout(step);
    r = await probe(page);
  }
  return r;
}
// ① 일본: 대기 → 발도 순간 → 경직 (ONLY=lunge 면 건너뜀)
if (process.env.ONLY !== 'lunge') {
  const page = await open('?weapon=longsword&foeWeapon=monohoshizao');
  let r = await waitFor(page, (x) => x.armed && x.readyW > 0.95 && x.stance?.drop > 0.25, 200000);
  await side(page, `${dir}/stance_iai_ready.png`);
  out.ready = r;
  let forced = false;
  // 발도 길 75 % 가 되는 물리 스텝에서 일시정지(P)로 멈춰 찍는다 (메뉴는 가림 — 0.12~0.15 s 동작이라 시간 맞추기로는 놓친다)
  await page.evaluate(() => {
    const g = window.game;
    const c = g.combat;
    const o = c.afterStep.bind(c);
    let done = false;
    c.afterStep = (...a) => {
      const res = o(...a);
      const I = g.enemy.iai;
      if (!done && I?.kind === 'iai' && I.t / I.T >= 0.75) {
        done = true;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      }
      return res;
    };
  });
  await page.keyboard.down('KeyW');
  r = await waitFor(page, (x) => x.eArc > 0 || x.d < 2.15, 90000, 40);
  await page.keyboard.up('KeyW');
  if (!(r.eArc > 0)) r = await waitFor(page, (x) => x.eArc > 0, 4000, 40);
  if (!(r.eArc > 0) && r.pAlive) {
    forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    r = await waitFor(page, (x) => x.eArc > 0, 30000, 40);
  }
  r = await waitFor(page, (x) => x.state === 'paused', 10000, 40);
  await page.evaluate(() => (document.getElementById('menu').style.visibility = 'hidden'));
  await side(page, `${dir}/stance_iai_draw.png`);
  out.draw = { ...r, forced };
  await page.evaluate(() => {
    document.getElementById('menu').style.visibility = '';
    if (window.game.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  });
  r = await waitFor(page, (x) => x.aiStage === 'stiff', 20000);
  await page.waitForTimeout(500);
  r = await probe(page);
  await side(page, `${dir}/stance_iai_stiff.png`);
  out.stiff = r;
  await page.context().close();
}
// ② 이탈리아 런지
{
  const page = await open('?weapon=longsword&foeWeapon=rapier');
  await page.evaluate(() => (window.game.player.applyWound = () => {})); // 시험만: 런지가 나올 때까지 내가 죽지 않게 (상대 동작·물리 그대로)
  let r = await waitFor(page, (x) => x.lungeT > 0 && x.lungeT < 0.3 && x.stance?.drop > 0.15, 120000, 30);
  let forced = false;
  if (!(r.lungeT > 0)) {
    await page.keyboard.down('KeyW');
    r = await waitFor(page, (x) => x.d < 2.0, 60000, 40);
    await page.keyboard.up('KeyW');
    forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    r = await waitFor(page, (x) => x.lungeT > 0 && x.lungeT < 0.3 && x.stance?.drop > 0.15, 30000, 30);
  }
  await side(page, `${dir}/stance_lunge.png`);
  out.lunge = { ...r, forced };
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
