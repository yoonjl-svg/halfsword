// 간격과 박자 · 오코리 (11/17 — docs/strike/measure_okori_2026-11-17.md) 캡처: 상대 AI(롱소드)의 몸 시작(오코리)을 옆에서 — 낮은 띠(숙련 1) · 높은 띠(숙련 5) · 끔(숙련 1).
//  장면마다: 결정 직후(오코리 가운데) · 칼이 나가는 순간 · 간 보기(선 밖). 콘솔 에러를 센다. 판 값은 건드리지 않음(읽기 · 멈춤 · 카메라만).
//  실행: npx vite --port 5177 --strictPort &   node tools/browser/okori_shots.mjs http://127.0.0.1:5177 docs/strike/measure_okori_2026-11-17
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright'); // 미리 깔린 playwright (전역 — require 길)
const base = process.argv[2] || 'http://127.0.0.1:5177';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const log = [];
async function open(q, on) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  if (on) {
    // 앱이 실제로 불러온 config 모듈 주소 그대로 (개발 서버가 고친 뒤 ?t= 를 붙이면 다른 인스턴스가 됨)
    const ok = await page.evaluate(async () => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/src\/config\.js(\?|$)/.test(n)).pop() ?? '/src/config.js';
      const C = await import(url);
      C.MEASURE.on = 1;
      C.OKORI.on = 1;
      return url;
    });
    log.push({ tag: 'config', url: ok });
  }
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.evaluate(() => { const c = document.getElementById('techCue'); if (c) c.style.visibility = 'hidden'; });
  return page;
}
const probe = (page) => page.evaluate(() => {
  const g = window.game, ai = g.ai, f = g.enemy;
  return { sim: +(g.stats?.simTime ?? 0).toFixed(2), state: g.state, mode: ai.mode, phase: ai.phase, why: ai.why ?? null, tech: ai.tech?.name ?? null, d: +f.foeDistance().toFixed(2), foeReach: +ai.foeReach.toFixed(2),
    okT: ai.okori ? +ai.okori.t.toFixed(2) : null, okTT: ai.okori ? +ai.okori.T.toFixed(2) : null, okDone: ai.okori?.done ?? null, vis: +(f.okoriVis ?? 0).toFixed(2), prof: ai.proficiency, alive: f.alive && g.player.alive };
});
const pause = (page, on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); const m = document.getElementById('menu'); if (m) m.style.visibility = on ? 'hidden' : ''; }, on);
// 옆에서 (두 사람 줄에 수직 · 상대 AI 쪽을 가운데)
const shot = async (page, path) => {
  await page.evaluate(() => {
    const g = window.game;
    const b = g.enemy.bodies.chest.translation(), a = g.player.bodies.chest.translation();
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    let fx = a.x - b.x, fz = a.z - b.z; const L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L;
    g.freeCam = true;
    g.camera.position.set(mx - fz * 3.2 + (b.x - mx) * 0.3, 1.35, mz + fx * 3.2 + (b.z - mz) * 0.3);
    g.camera.lookAt(mx + (b.x - mx) * 0.3, 1.0, mz + (b.z - mz) * 0.3);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
// 기다렸다 찍기: cond(p) 가 참인 순간 멈추고 찍음
async function catchShot(page, cond, path, tag, timeout = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await probe(page);
    if (!p.alive) return null;
    if (cond(p)) {
      await pause(page, true);
      const q = await probe(page);
      await shot(page, path);
      log.push({ tag, path, ...q });
      await pause(page, false);
      return q;
    }
    await page.waitForTimeout(10);
  }
  log.push({ tag, path, miss: true });
  return null;
}
// 켜기: 주소 스위치가 없다(사장님 11/17 '스위치 투성이라') — 개발 서버가 내는 같은 config 모듈(/src/config.js)의 안쪽 깃발을 판 시작 전에 켬 (재기 전용)
const W = '?weapon=longsword&foeWeapon=longsword';
for (const [name, prof, on] of [['low', 1, 1], ['high', 5, 1], ['off', 1, 0]]) {
  const page = await open(`${W}&foeProficiency=${prof}`, on);
  await catchShot(page, (p) => p.mode === 'watch' && p.d < p.foeReach + 0.6, `${dir}/${name}_watch.png`, `${name} 간 보기 (선 가까이)`);
  if (!on) await catchShot(page, (p) => p.mode === 'attack' && (p.phase === 'windup' || p.phase === 'approach'), `${dir}/${name}_decide.png`, `${name} 결정 직후`);
  else await catchShot(page, (p) => p.mode === 'attack' && p.okT != null && !p.okDone && p.okT >= 0.5 * p.okTT, `${dir}/${name}_okori.png`, `${name} 오코리 가운데`);
  await catchShot(page, (p) => p.mode === 'attack' && p.phase === 'strike', `${dir}/${name}_strike.png`, `${name} 칼이 나감`);
  await page.context().close();
}
await browser.close();
fs.writeFileSync(`${dir}/shots.json`, JSON.stringify({ log, errors }, null, 1));
console.log(JSON.stringify(log, null, 1));
console.log('errors', errors.length, errors.slice(0, 5));
