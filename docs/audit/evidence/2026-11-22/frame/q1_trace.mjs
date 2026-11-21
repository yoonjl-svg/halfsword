// Q1 helper: main-thread trace during an AI-vs-AI fight (no JS profiler) to see what the non-JS ("(program)") time is.
//  node q1_trace.mjs <baseUrl> <stage> <rate> <outJson> [secs=4]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, stage, rateS = '1', out, secsS = '4'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/?fps=1&stage=${stage}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 120000 });
await page.evaluate(() => { const g = window.game, a = g.ai; const ai2 = new g.AI(g.player, g.enemy, 'normal'); const o = a.update.bind(a); a.update = (dt) => { o(dt); ai2.update(dt); }; });
if (!process.env.FULL) await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +rateS });
await page.waitForTimeout(2000);
const events = [];
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
await cdp.send('Tracing.start', { categories: 'devtools.timeline,toplevel,v8,blink,gpu,cc,disabled-by-default-devtools.timeline,disabled-by-default-v8.gc', transferMode: 'ReportEvents' });
await page.waitForTimeout(+secsS * 1000);
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.end'); await done;
// renderer main thread = thread that ran FunctionCall for our page
const fc = events.filter((e) => e.name === 'FireAnimationFrame' && e.ph === 'X');
const pid = fc[0]?.pid, tid = fc[0]?.tid;
const main = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X' && e.dur);
const t0 = Math.min(...main.map((e) => e.ts)), t1 = Math.max(...main.map((e) => e.ts + e.dur));
// exclusive time per event name (stack by nesting)
main.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
const excl = {}, incl = {}; const st = [];
for (const e of main) {
  while (st.length && st.at(-1).ts + st.at(-1).dur <= e.ts) st.pop();
  if (st.length) excl[st.at(-1).name] = (excl[st.at(-1).name] || 0) - Math.min(e.dur, st.at(-1).ts + st.at(-1).dur - e.ts);
  excl[e.name] = (excl[e.name] || 0) + e.dur; incl[e.name] = (incl[e.name] || 0) + e.dur;
  st.push(e);
}
const wall = (t1 - t0) / 1000;
const frames = fc.length;
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(6)}ms ${((v / 1000 / wall) * 100).toFixed(1).padStart(5)}% ${(v / 1000 / frames).toFixed(2).padStart(6)}ms/fr  ${k}`);
const res = { stage, rate: +rateS, wallMs: +wall.toFixed(0), frames, excl: top(excl), incl: top(incl) };
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log(`wall ${wall.toFixed(0)}ms frames ${frames}`); console.log('== exclusive'); console.log(res.excl.join('\n')); console.log('== inclusive'); console.log(res.incl.slice(0, 15).join('\n'));
await browser.close();
