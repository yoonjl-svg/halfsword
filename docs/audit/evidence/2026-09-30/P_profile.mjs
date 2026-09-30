// 5 s CDP CPU profile + 5 s sampled allocation profile during an AI-vs-AI fight.
//  node P_profile.mjs <baseUrl> <stage> <rate> <outPrefix>    (env DPR=3 default, TINY=1 shrinks drawing buffer)
import { chromium } from './P_pw/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:5190', stage = 'temple', rateS = '4', out = 'P_raw/prof'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: +(process.env.DPR || 3), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/?fps=1&stage=${stage}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
await page.locator('#draw .wcard[data-i="0"]').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
await page.evaluate(() => {
  const g = window.game, a = g.ai, ai2 = new g.AI(g.player, g.enemy, 'normal'), orig = a.update.bind(a);
  a.update = (dt) => { orig(dt); ai2.update(dt); };
});
if (process.env.TINY) await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +rateS });
await page.waitForTimeout(2000);
const frames = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else r(n); })(); }));

// CPU profile
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
const nFrames = await frames();
const { profile } = await cdp.send('Profiler.stop');
fs.writeFileSync(out + '.cpuprofile', JSON.stringify(profile));

// allocation sampling (incl. objects already collected by GC = total allocation, not just retained)
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const nFrames2 = await frames();
const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
fs.writeFileSync(out + '.heapprofile', JSON.stringify(hp));
await browser.close();

// --- aggregate CPU self time
const file = (u) => (u ? u.replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '') : '');
const dt = {}; // node id -> self ms
const times = profile.timeDeltas; const samples = profile.samples;
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < samples.length; i++) dt[samples[i]] = (dt[samples[i]] || 0) + (times[i + 1] ?? 0) / 1000;
const total = Object.values(dt).reduce((a, b) => a + b, 0);
const fn = {}, fl = {};
for (const [id, ms] of Object.entries(dt)) {
  const cf = byId.get(+id).callFrame;
  let f = file(cf.url) || (cf.functionName.startsWith('(') ? cf.functionName : '(native/' + (cf.url || 'builtin') + ')');
  if (/wasm/.test(cf.url) || /^\$?wasm-function|rapier/i.test(cf.functionName)) f = 'rapier (wasm)';
  const k = `${cf.functionName || '(anon)'}  ${f}:${cf.lineNumber + 1}`;
  fn[k] = (fn[k] || 0) + ms; fl[f] = (fl[f] || 0) + ms;
}
// inclusive time for a few named roots
const children = new Map(profile.nodes.map((n) => [n.id, n.children || []]));
const incl = (id) => (dt[id] || 0) + children.get(id).reduce((a, c) => a + incl(c), 0);
const inclBy = {};
for (const n of profile.nodes) {
  const name = n.callFrame.functionName, f = file(n.callFrame.url);
  const key = { frame: 'frame (main loop)', render: 'WebGLRenderer.render', step: 'World.step', update: 'update', sample: 'sample', syncMeshes: 'syncMeshes' }[name];
  if (key && (f.includes('src/') || f.includes('three') || f.includes('rapier'))) { const kk = `${key} @${f}`; inclBy[kk] = (inclBy[kk] || 0) + incl(n.id); }
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
// --- aggregate allocations by file / function (bytes over 5 s)
const al = {}, alf = {};
(function walk(n) { const cf = n.callFrame; const f = file(cf.url) || cf.functionName || '(root)'; const k = `${cf.functionName || '(anon)'}  ${f}:${cf.lineNumber + 1}`; al[k] = (al[k] || 0) + n.selfSize; alf[f] = (alf[f] || 0) + n.selfSize; (n.children || []).forEach(walk); })(hp.head);
const allocTotal = Object.values(alf).reduce((a, b) => a + b, 0);
const topB = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1024).toFixed(0).padStart(7)} KB  ${k}`);
const rep = [
  `stage ${stage} rate ${rateS} dpr ${process.env.DPR || 3} tiny ${!!process.env.TINY}: profile ${total.toFixed(0)} ms, frames ${nFrames} in 5 s`,
  '--- top 15 self time (function  file:line)', ...top(fn, 15),
  '--- self time by file', ...top(fl, 20),
  '--- inclusive (selected)', ...top(inclBy, 12),
  `--- allocation over 5 s: ${(allocTotal / 1048576).toFixed(1)} MB total, frames ${nFrames2}, ${(allocTotal / 1024 / nFrames2).toFixed(0)} KB/frame; by file`, ...topB(alf, 12),
  '--- top allocating functions', ...topB(al, 15),
].join('\n');
fs.writeFileSync(out + '.txt', rep);
console.log(rep);
