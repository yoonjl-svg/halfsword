// 일본 비기 순간 베기 (10/10 — src/secret_instant.js) 브라우저 확인: 잔상(쓸린 호)이 보이는 장면 두 장 + 경직 자세 한 장. 콘솔 에러 0.
//  ① 플레이어(모노호시자오)의 비기 창을 열고(저절로 안 열리면 직접 — player_secret_shots.mjs 와 같은 꼴) 톡 → 순간 베기 직후 PNG
//  ② 같은 판에서 경직(칼끝을 떨어뜨린 자세 · '경직' 또렷이) PNG
//  ③ 상대 AI(打刀)가 순간 베기를 낸 직후 PNG (내 무기 롱소드 — 상대 쪽 비기)
//  소프트웨어 GL 은 화면이 느려(벽 10 s ≈ 게임 1~2 s) 시험에서만 잔상 시간(SECRET.instantArcLife, 실시간)과 창 시간을 늘린다.
//  실행: npx vite build && npx vite preview --port 4187 --strictPort &
//        node tools/browser/secret_instant_shots.mjs http://127.0.0.1:4187 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4187';
const shotDir = process.argv[3] || '.';
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.evaluate(() => (window.game.config.SECRET.instantArcLife = 8)); // 시험만: 느린 화면에서도 잔상이 사진에 남게
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
  return page;
}
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const el = document.getElementById('techCue');
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +g.player.foeDistance().toFixed(2), stage: g.player.skill.sec?.stage ?? null, pArc: g.player.instantArc?.id ?? 0, eArc: g.enemy.instantArc?.id ?? 0, pRes: g.player.instantResult, eRes: g.enemy.instantResult, aiStage: g.ai.secretRun?.stage ?? null, cue: `${el.dataset.kind}/${el.dataset.who}/${el.innerText.replace(/\s+/g, ' ').trim()}/${(+getComputedStyle(el).opacity).toFixed(2)}` };
  });
// 옆에서 보기: 真向 은 뒤 카메라에서 칼날 면이 모로 서 선으로만 보인다 → 사진 찍는 순간만 카메라를 두 사람 옆으로 (game.freeCam)
const sideShot = async (page, path) => {
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
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const out = {};
// ① ② 플레이어 순간 베기
{
  const page = await open('?weapon=monohoshizao&foeWeapon=longsword');
  let r = await probe(page);
  const t0 = Date.now();
  while (r.d > 2.3 && Date.now() - t0 < 90000 && r.state === 'fight') {
    await page.waitForTimeout(150);
    r = await probe(page);
  }
  await page.evaluate(() => {
    const W = window.game.playerSecret;
    if (!W.open) W.openWindow(null);
    W.open.t = 5;
  });
  await page.evaluate(async () => {
    const cv = document.getElementById('game');
    const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 210, bubbles: true, isPrimary: true, button: 0 };
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise((res) => setTimeout(res, 40));
    cv.dispatchEvent(new PointerEvent('pointerup', o));
  });
  const t1 = Date.now();
  let shot1 = null;
  let shot2 = null;
  while (Date.now() - t1 < 60000) {
    await page.waitForTimeout(60);
    r = await probe(page);
    if (!shot1 && r.pArc > 0) {
      shot1 = r;
      await sideShot(page, `${shotDir}/secret_instant_player.png`);
    }
    if (shot1 && !shot2 && r.stage === 'stiff' && r.sim - shot1.sim > 0.5) {
      shot2 = r;
      await page.screenshot({ path: `${shotDir}/secret_instant_stiff.png` });
      break;
    }
    if (shot1 && r.stage === null) break;
  }
  out.player = shot1;
  out.stiff = shot2;
  await page.context().close();
}
// ③ 상대 AI 순간 베기
{
  const page = await open('?weapon=longsword&foeWeapon=uchigatana');
  const t0 = Date.now();
  let r = await probe(page);
  let shot = null;
  let forced = false;
  while (Date.now() - t0 < 300000 && r.state === 'fight') {
    await page.waitForTimeout(80);
    r = await probe(page);
    if (r.eArc > 0) {
      shot = { ...r, forced };
      await sideShot(page, `${shotDir}/secret_instant_foe.png`);
      break;
    }
    // 저절로 안 나오면 (150 s 벽시계) 닿을 만한 거리에서 AI 비기를 직접 낸다 (조건 판정만 건너뜀 — 실행은 그대로)
    if (!forced && Date.now() - t0 > 150000 && r.d < 2.3 && r.d > 1.5) {
      forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    }
  }
  out.foe = shot ?? { none: r };
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length || !out.player ? 1 : 0);
