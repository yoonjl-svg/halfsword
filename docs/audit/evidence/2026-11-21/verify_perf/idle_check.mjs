// idle cost: node idle.mjs <base> ; title / start menu / paused fight / fake-hidden. Reports rAF/s, renderer frames/s, main-thread ms/s (Task/Script), cdp CPU throttle 1.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:5191';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
async function sample(page, cdp, label, secs = 6) {
  const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const a = await pm(); const r0 = await page.evaluate(() => ({ f: window.game?.renderInfo?.().frame ?? null, raf: window.__raf || 0, timers: window.__timers || 0 }));
  await page.waitForTimeout(secs * 1000);
  const b = await pm(); const r1 = await page.evaluate(() => ({ f: window.game?.renderInfo?.().frame ?? null, raf: window.__raf || 0, timers: window.__timers || 0, calls: window.game?.renderInfo?.().calls ?? null, state: window.game?.state, startOpen: document.documentElement.hasAttribute('data-start-open'), heap: performance.memory.usedJSHeapSize / 1048576 }));
  const w = b.Timestamp - a.Timestamp;
  const o = { label, state: r1.state, startOpen: r1.startOpen, rafPerSec: +((r1.raf - r0.raf) / w).toFixed(1), threeFramesPerSec: r1.f == null ? null : +((r1.f - r0.f) / w).toFixed(1), drawCallsLast: r1.calls, mainTaskMsPerSec: +(((b.TaskDuration - a.TaskDuration) * 1000) / w).toFixed(1), scriptMsPerSec: +(((b.ScriptDuration - a.ScriptDuration) * 1000) / w).toFixed(1), layoutMsPerSec: +(((b.LayoutDuration - a.LayoutDuration) * 1000) / w).toFixed(1), styleMsPerSec: +(((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000) / w).toFixed(1), timersCreated: r1.timers, heapMB: +r1.heap.toFixed(0) };
  console.log(JSON.stringify(o)); return o;
}
const res = [];
for (const rate of [1]) {
  for (const [name, url, steps] of [['title', '/', 'title'], ['menu(?stage=)', '/?stage=poseidon&weapon=longsword&emo=0', 'menu'], ['paused-fight', '/?stage=poseidon&weapon=longsword&emo=0', 'pause'], ['fake-hidden-fight', '/?stage=poseidon&weapon=longsword&emo=0', 'hidden']]) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { window.__raf = 0; window.__timers = 0; const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => r((t) => { window.__raf++; f(t); }); const si = window.setInterval.bind(window); window.setInterval = (...a) => { window.__timers++; return si(...a); }; });
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    if (steps === 'pause' || steps === 'hidden') {
      await page.getByText('여정 시작').click();
      await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 90000 });
      if (steps === 'pause') { await page.keyboard.press('KeyP'); await page.waitForTimeout(1500); }
      else { await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(1500); }
    }
    res.push({ rate, ...(await sample(page, cdp, name)) });
    await ctx.close();
  }
}
import fs from 'node:fs'; fs.writeFileSync(new URL('./idle.json', import.meta.url).pathname, JSON.stringify(res, null, 1));
await browser.close();
