// Q1: steady-fight CPU profile (AI vs AI, TINY 8x4 drawing buffer, CDP CPU throttle).
//  node q1_profile.mjs <baseUrl> <stage> <rate> <outPrefix> [secs=20] [query extra]
//  writes <outPrefix>.cpuprofile and <outPrefix>.json (frames, perfmeter text, DOM mutations, style/layout ms, fight state)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, stage, rateS = '4', out, secsS = '20'] = process.argv.slice(2);
const rate = +rateS, secs = +secsS;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/?fps=1&stage=${stage}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.game, a = g.ai;
  const ai2 = new g.AI(g.player, g.enemy, 'normal');
  const orig = a.update.bind(a);
  a.update = (dt) => { orig(dt); try { ai2.update(dt); } catch (e) { window.__ai2err = String(e); } };
});
await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
// NOSHADOW=1: A/B probe only — castShadow off on every light at runtime, to price the shadow pass
if (process.env.NOSHADOW) await page.evaluate(() => window.game.scene.traverse((o) => { if (o.isLight) o.castShadow = false; }));
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.waitForTimeout(2000);
// in-page counters: rendered frames (rAF), DOM mutation records (body subtree), fight state per second
await page.evaluate(() => {
  const m = (window.__q1 = { frames: 0, mut: 0, mutAttr: 0, mutChild: 0, mutText: 0, perfTxt: [], states: [] });
  const meter = [...document.querySelectorAll('div')].find((e) => /^FPS /.test(e.textContent));
  window.__q1obs = new MutationObserver((recs) => {
    for (const r of recs) {
      if (meter && (r.target === meter || meter.contains(r.target))) continue; // perf readout itself excluded
      m.mut++; if (r.type === 'attributes') m.mutAttr++; else if (r.type === 'childList') m.mutChild++; else m.mutText++;
    }
  });
  window.__q1obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  m.meterMut = 0;
  let lastTxt = '';
  const f = () => { m.frames++; if (meter && meter.textContent !== lastTxt) { lastTxt = meter.textContent; m.perfTxt.push(lastTxt); } if (!m.stop) requestAnimationFrame(f); };
  requestAnimationFrame(f);
  m.iv = setInterval(() => m.states.push([window.game.state, window.game.player.alive, window.game.enemy.alive]), 1000);
});
await cdp.send('Performance.enable');
const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const pm0 = await pm();
const sim0 = await page.evaluate(() => window.game.stats.simTime);
await cdp.send('Profiler.start');
await page.waitForTimeout(secs * 1000);
const { profile } = await cdp.send('Profiler.stop');
const pm1 = await pm();
const q = await page.evaluate(() => { const m = window.__q1; m.stop = true; clearInterval(m.iv); window.__q1obs.disconnect(); return { ...m, iv: undefined, sim: window.game.stats.simTime, ri: window.game.renderInfo() }; });
fs.writeFileSync(`${out}.cpuprofile`, JSON.stringify(profile));
const wall = pm1.Timestamp - pm0.Timestamp;
const num = (re) => { const v = q.perfTxt.map((t) => (t.match(re) || [])[1]).filter(Boolean).map(Number); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
const sum = {
  stage, rate, secs, wallS: +wall.toFixed(2), frames: q.frames, fps: +(q.frames / wall).toFixed(1), simSecs: +(q.sim - sim0).toFixed(2), gameSpeed: num(/게임 속도 ([\d.]+)%/),
  perfmeter: { physMs: num(/물리 ([\d.]+)ms/), steps: num(/×([\d.]+)스텝/), drawMs: num(/그리기 ([\d.]+)ms/), frameMs: num(/  ([\d.]+)ms  그림/) },
  domMutPerS: +(q.mut / wall).toFixed(1), mutAttrPerS: +(q.mutAttr / wall).toFixed(1), mutChildPerS: +(q.mutChild / wall).toFixed(1), mutTextPerS: +(q.mutText / wall).toFixed(1),
  styleMsPerS: +(((pm1.RecalcStyleDuration - pm0.RecalcStyleDuration) * 1000) / wall).toFixed(2), layoutMsPerS: +(((pm1.LayoutDuration - pm0.LayoutDuration) * 1000) / wall).toFixed(2),
  styleCountPerS: +((pm1.RecalcStyleCount - pm0.RecalcStyleCount) / wall).toFixed(1), layoutCountPerS: +((pm1.LayoutCount - pm0.LayoutCount) / wall).toFixed(1),
  scriptMsPerS: +(((pm1.ScriptDuration - pm0.ScriptDuration) * 1000) / wall).toFixed(1), taskMsPerS: +(((pm1.TaskDuration - pm0.TaskDuration) * 1000) / wall).toFixed(1),
  calls: q.ri.calls, tris: q.ri.triangles, programs: q.ri.programs,
  states: q.states, ai2err: await page.evaluate(() => window.__ai2err || null), errors, perfSample: q.perfTxt.at(-1),
};
fs.writeFileSync(`${out}.json`, JSON.stringify(sum, null, 1));
console.log(JSON.stringify({ ...sum, states: sum.states.map((s) => s[0][0] + (s[1] ? 'P' : 'p') + (s[2] ? 'E' : 'e')).join('') }));
await browser.close();
