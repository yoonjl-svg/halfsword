// 동방 막아 죽이기 (격살 · 10/22) 그림 — 받은 자세마다 한 칼의 잔상(옆 카메라) + 창이 열린 때의 금빛 '!' (docs/strike/chinese_gyeoksal_2026-10-22.md §6). 읽기만.
//  판정(때맞춤 · 앞으로 · 받아 냄)은 건너뛰고 한 칼만 곧장 낸다 — skill.secret({ S: playerSecret.S, ctx: { slot: 자세 } }) · 실행 · 상처는 게임 함수 그대로.
//  실행: npx vite --port 4237 --strictPort &   (빌드 없이 개발 서버)
//        node tools/browser/gyeoksal_shots.mjs http://127.0.0.1:4237 docs/handoff/gyeoksal [상대 무기 longsword] [자세들 geojeong,eogeo,yoryak,bongdu,window]
//  내놓는 것: gk_<자세>.png 넷 · gk_window.png · 줄마다 SHOT(맞은 곳 · 갈래 · 심각도) · ERRORS. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4237';
const dir = process.argv[3] || 'docs/handoff/gyeoksal';
const FOE = process.argv[4] || 'longsword';
const SLOTS = (process.argv[5] || 'geojeong,eogeo,yoryak,bongdu').split(','); // 고를 자세 (창 그림은 다섯째 인자에 window 가 있거나 인자가 없을 때)
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 320 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/?weapon=qinggang&foeWeapon=${FOE}&skillNodes=all&slowMo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret?.S, null, { timeout: 90000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
  await page.evaluate(() => (window.game.config.SECRET.instantArcLife = 8)); // 잔상만 오래 (느린 소프트웨어 GL 에서 그림에 남게 — 시험만)
  return page;
}
const near = async (page) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const { d, c } = await page.evaluate(() => ({ d: window.game.player.foeDistance(), c: window.game.player.swordArt.measure.contact }));
    if (d < c + 0.15) break;
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('KeyW');
};
const sideShot = async (page, path) => {
  await page.evaluate(() => {
    const g = window.game;
    const a = g.player.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(mx - (dz / L) * 3.0, 1.6, mz + (dx / L) * 3.0);
    g.camera.lookAt(mx, 1.0, mz);
    document.getElementById('menu').style.visibility = 'hidden';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
};
for (const slot of SLOTS.filter((x) => x !== 'window')) {
  const page = await open();
  await near(page);
  const ok = await page.evaluate((slot) => {
    const g = window.game;
    g.ai.update = () => {}; // 상대는 칼을 든 채 서 있게 (그림만)
    return g.player.skill.secret({ S: g.playerSecret.S, ctx: { ev: 'gyeoksal', slot, stance: slot } });
  }, slot);
  const t0 = Date.now();
  let res = null;
  while (Date.now() - t0 < 60000) {
    res = await page.evaluate(() => {
      const p = window.game.player;
      return !p.iai && p.instantResult?.combo ? { part: p.instantResult.part, zone: p.instantResult.zone, type: p.instantResult.type, sev: p.instantResult.sev, aim: p.instantResult.aim, n: p.instantArc?.pts?.length ?? 0 } : null;
    });
    if (res) break;
    await page.waitForTimeout(20);
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })));
  await sideShot(page, `${dir}/gk_${slot}${FOE === 'longsword' ? '' : '_' + FOE}.png`);
  console.log(`SHOT ${slot} 냄 ${ok} 겨눔 ${res?.aim} 맞은 곳 ${res?.part ?? '-'} ${res?.zone ?? ''} ${res?.type ?? ''} 심각도 ${(res?.sev ?? 0).toFixed(2)} 조각 ${res?.n ?? 0}`);
  await page.context().close();
}
if (!process.argv[5] || SLOTS.includes('window')) {
  // 창이 열린 때: 상대 머리 위 금빛 '!' (strike_cue.js — 비기 창) · 오른쪽 위 비기 이름 알림
  const page = await open();
  await near(page);
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => {};
    g.playerSecret.openWindow({ ev: 'gyeoksal', slot: 'geojeong', stance: 'geojeong' }, 0.6);
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${dir}/gk_window.png` });
  console.log(`SHOT window → ${dir}/gk_window.png`);
  await page.context().close();
}
console.log(`ERRORS ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
