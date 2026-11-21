// Q2: round-start hitches. Records every rAF frame from page load; triggers (1) first fight from the menu,
//  (3) N next rounds with a stage change (win -> result panel button -> next stage in journey order),
//  (2) M next rounds on the same stage (lose -> result panel button -> rematch). Rounds end through the in-game death path.
//  node q2_hitch.mjs <baseUrl> <rate> <outJson> [stageChanges=4] [sameStage=2]
//  env PROFILE=<prefix>: CPU profile (200 us) across the first stage-change transition -> <prefix>.cpuprofile
//  env START=<stageId>: journey stage pin is NOT used; START only selects ?stage= for the first round when given (default: journey start)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, rateS = '1', out, nChS = '4', nSameS = '2'] = process.argv.slice(2);
const rate = +rateS, NCH = +nChS, NSAME = +nSameS;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(page);
// frame recorder installed before any page script
await page.addInitScript(() => {
  const R = (window.__fr = { t: [], st: [], marks: [] });
  let last = 0;
  const f = (now) => { R.t.push(now); R.st.push(window.game ? window.game.state : '-'); requestAnimationFrame(f); };
  requestAnimationFrame(f);
  window.__mark = (k) => R.marks.push([k, performance.now()]);
});
await page.goto(`${base}/?fps=1&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; }); // TINY: software-GL fill out of the picture
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.waitForTimeout(2500);
const info = () => page.evaluate(() => { const g = window.game; return { stage: g.stage.id, buildMs: +g.stage.buildMs.toFixed(1), warmMs: +(g.stage.warmMs || 0).toFixed(1), clearMs: +(g.stage.clearMs || 0).toFixed(1), programs: g.renderInfo().programs, geometries: g.renderInfo().geometries, textures: g.renderInfo().textures, canvas: document.querySelector('canvas').width + 'x' + document.querySelector('canvas').height, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) }; });
const events = [];
async function waitFightFrames() {
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
  await page.waitForTimeout(3000);
}
let profiled = false;
async function transition(kind, clickFn) {
  const before = await info();
  const doProf = process.env.PROFILE && kind === 'stageChange' && !profiled;
  if (doProf) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  await page.evaluate((k) => window.__mark('click:' + k), kind);
  await clickFn();
  if (doProf) {
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
    await page.waitForTimeout(400);
    const { profile } = await cdp.send('Profiler.stop');
    fs.writeFileSync(`${process.env.PROFILE}.cpuprofile`, JSON.stringify(profile));
    profiled = true;
  }
  await waitFightFrames();
  const after = await info();
  events.push({ kind, from: before.stage, to: after.stage, before, after, newPrograms: after.programs - before.programs });
}
async function endRound(win) {
  await page.evaluate((w) => { const g = window.game; window.__mark(w ? 'death:win' : 'death:lose'); if (g.player.alive && g.enemy.alive) (w ? g.enemy : g.player).die('목', true); }, win);
  await page.waitForFunction(() => window.game.state === 'paused' && document.getElementById('btnStart') && !document.getElementById('btnStart').hidden, null, { timeout: 240000 });
  await page.evaluate(() => window.__mark('panel'));
  await page.waitForTimeout(1500);
}
// (1) first fight from the menu
await transition('firstStart', () => page.getByText('여정 시작').click());
// (3) stage changes
for (let i = 0; i < NCH; i++) { await endRound(true); await transition('stageChange', () => page.click('#btnStart')); }
// (2) same stage (rematch after a loss)
for (let i = 0; i < NSAME; i++) { await endRound(false); await transition('sameStage', () => page.click('#btnStart')); }
const R = await page.evaluate(() => window.__fr);
// analysis: for each click mark, window [click, firstFightFrame + 2000ms]; also [death, click] (round end + result panel)
const dts = R.t.map((t, i) => (i ? t - R.t[i - 1] : 0));
const clicks = R.marks.filter((m) => m[0].startsWith('click:'));
const deaths = R.marks.filter((m) => m[0].startsWith('death:'));
const steady = []; // frames in fight, 1-3 s after start, for reference
clicks.forEach((c, i) => {
  const t0 = c[1];
  const iFirst = R.t.findIndex((t, j) => t > t0 && R.st[j] === 'fight');
  const tf = R.t[iFirst];
  const win = []; for (let j = 1; j < R.t.length; j++) if (R.t[j] > t0 && R.t[j] <= tf + 2000) win.push(dts[j]);
  const st = []; for (let j = 1; j < R.t.length; j++) if (R.t[j] > tf + 1000 && R.t[j] <= tf + 3000) st.push(dts[j]);
  steady.push(...st);
  const d = deaths.filter((m) => m[1] < t0).at(-1);
  const pre = []; if (d) for (let j = 1; j < R.t.length; j++) if (R.t[j] > d[1] && R.t[j] <= t0) pre.push(dts[j]);
  const e = events[i];
  e.clickToFightMs = +(tf - t0).toFixed(0);
  e.longestMs = +Math.max(...win).toFixed(1);
  e.over50SumMs = +win.filter((x) => x > 50).reduce((a, b) => a + b, 0).toFixed(0);
  e.over50Count = win.filter((x) => x > 50).length;
  e.top3 = [...win].sort((a, b) => b - a).slice(0, 3).map((x) => +x.toFixed(0));
  e.steadyMedianMs = st.length ? +[...st].sort((a, b) => a - b)[Math.floor(st.length / 2)].toFixed(1) : null;
  e.excessOver2xSteadyMs = e.steadyMedianMs ? +win.filter((x) => x > 2 * e.steadyMedianMs).reduce((a, b) => a + b - e.steadyMedianMs, 0).toFixed(0) : null; // hitch time beyond a normal frame
  e.roundEndLongestMs = pre.length ? +Math.max(...pre).toFixed(1) : null; // death -> panel -> click window
});
const res = { rate, events, errors, raw: R };
fs.writeFileSync(out, JSON.stringify(res, null, 1));
for (const e of events) console.log(`${e.kind.padEnd(11)} ${e.from}->${e.to} longest ${e.longestMs}ms top3 ${e.top3} >50ms sum ${e.over50SumMs}ms (${e.over50Count}) excess>2xMed ${e.excessOver2xSteadyMs}ms click->fight ${e.clickToFightMs}ms steadyMed ${e.steadyMedianMs} build ${e.after.buildMs} warm ${e.after.warmMs} clear ${e.after.clearMs} prog ${e.before.programs}->${e.after.programs} roundEndLongest ${e.roundEndLongestMs} canvas ${e.after.canvas}`);
if (errors.length) console.log('ERR', errors.slice(0, 3));
await browser.close();
