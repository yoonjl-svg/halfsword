// node idle_screens.mjs <baseUrl> ; per-screen idle cost, writes idle_screens.json next to this file
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5196';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  window.__raf = 0; window.__src = {}; window.__ivFired = 0; window.__toFired = 0; window.__ivLive = new Map(); window.__ivMade = 0;
  const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => { const k = (new Error().stack.split('\n')[2] || '').trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, ''); window.__src[k] = (window.__src[k] || 0) + 1; return r((t) => { window.__raf++; f(t); }); };
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window), st = window.setTimeout.bind(window);
  window.setInterval = (f, ms, ...a) => { window.__ivMade++; const id = si((...x) => { window.__ivFired++; return typeof f === 'function' ? f(...x) : 0; }, ms, ...a); window.__ivLive.set(id, ms); return id; };
  window.clearInterval = (id) => { window.__ivLive.delete(id); return ci(id); };
  window.setTimeout = (f, ms, ...a) => st((...x) => { window.__toFired++; return typeof f === 'function' ? f(...x) : 0; }, ms, ...a);
});
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
const anims = () => page.evaluate(() => {
  const set = new Set(document.getAnimations()); const walk = (n) => { for (const e of n.querySelectorAll('*')) if (e.shadowRoot) { e.shadowRoot.getAnimations().forEach((a) => set.add(a)); walk(e.shadowRoot); } };
  walk(document);
  const out = []; for (const a of set) { if (a.playState !== 'running') continue; const ef = a.effect; let t = {}; try { t = ef.getTiming(); } catch {} let props = []; try { props = [...new Set(ef.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)); } catch {}
    const el = ef?.target; out.push({ name: a.animationName || a.transitionProperty || a.constructor.name, inf: t.iterations === Infinity, dur: t.duration, props, el: el ? (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')) : '?' }); }
  return out; });
async function sample(label, secs = 8) {
  await page.waitForTimeout(3000);
  const rd = () => page.evaluate(() => ({ src: { ...window.__src }, f: window.game?.renderInfo?.().frame ?? null, raf: window.__raf, iv: window.__ivFired, to: window.__toFired, live: window.__ivLive.size, made: window.__ivMade }));
  const a = await pm(), r0 = await rd(); await page.waitForTimeout(secs * 1000); const b = await pm(), r1 = await rd();
  const w = b.Timestamp - a.Timestamp; const an = await anims(); const inf = an.filter((x) => x.inf);
  const cheap = (p) => p.every((k) => ['transform', 'opacity', 'translate', 'rotate', 'scale'].includes(k));
  const o = { label, raf: +((r1.raf - r0.raf) / w).toFixed(1), frames3d: r1.f == null ? null : +((r1.f - r0.f) / w).toFixed(1), taskMs: +(((b.TaskDuration - a.TaskDuration) * 1000) / w).toFixed(1), scriptMs: +(((b.ScriptDuration - a.ScriptDuration) * 1000) / w).toFixed(1), layoutMs: +(((b.LayoutDuration - a.LayoutDuration) * 1000) / w).toFixed(1), styleMs: +(((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000) / w).toFixed(1), layoutCount: +(((b.LayoutCount - a.LayoutCount)) / w).toFixed(1), anims: an.length, infinite: inf.length, infExpensive: inf.filter((x) => !cheap(x.props)).length, ivFiredPerSec: +((r1.iv - r0.iv) / w).toFixed(2), toFiredPerSec: +((r1.to - r0.to) / w).toFixed(2), liveIntervals: r1.live, rafSrcPerSec: Object.fromEntries(Object.entries(r1.src).map(([k, v]) => [k, +((v - (r0.src[k] || 0)) / w).toFixed(0)]).filter((e) => e[1] > 0)), top: inf.slice(0, 6).map((x) => `${x.name} [${x.props.join(',')}] ${x.dur}ms ${x.el}`) };
  console.log(JSON.stringify(o)); return o; }
const res = [];
const tryClick = async (sel) => { try { await page.locator(sel).first().click({ timeout: 4000 }); return true; } catch (e) { console.log('click fail', sel); return false; } };
await page.goto(base + '/', { waitUntil: 'networkidle' });
const modalOpen = await page.evaluate(() => !!document.getElementById('gameEntrance').shadowRoot.querySelector('dialog[open]'));
if (modalOpen) { res.push(await sample('1a title + auto notices dialog')); await tryClick('#confirmNotices'); await page.waitForTimeout(800); }
res.push(await sample('1 title (bare)'));
for (const [lab, open, close] of [['1b title: notices re-open', '#openNotices', '#confirmNotices'], ['1c title: settings open', '#openSettings', '#closeSettings'], ['1d title: account open', '#openAccount', '#closeAccount']]) {
  if (await tryClick(open)) { res.push(await sample(lab, 6)); await tryClick(close); await page.waitForTimeout(500); } }
if (await tryClick('#enterLobby')) {
  await page.waitForSelector('#tabItems', { timeout: 30000 }).catch(() => {});
  const dlg = await page.evaluate(() => !!document.getElementById('gameEntrance').shadowRoot.querySelector('dialog[open]'));
  if (dlg) { res.push(await sample('2a lobby + auto skill-tree notice dialog', 6)); await page.locator('dialog[open] button').first().click(); await page.waitForTimeout(800); }
  res.push(await sample('2 lobby (items tab)'));
  for (const [id, lab] of [['#tabShop', '3a shop'], ['#tabSkills', '3b skills'], ['#tabEvent', '3c saengsa tab'], ['#tabCapture', '3d capture']]) { if (await tryClick(id)) res.push(await sample(lab, 6)); }
  await tryClick('#tabEvent'); await page.waitForTimeout(800);
  const dis = await page.evaluate(() => { const b = document.getElementById('gameEntrance').shadowRoot.getElementById('saengsaEnter'); const l = document.getElementById('gameEntrance').shadowRoot.getElementById('sgLook'); return { enterDisabled: b?.disabled, lookHidden: l?.hidden }; });
  console.log('saengsa buttons', JSON.stringify(dis)); res.push({ label: 'saengsa buttons', ...dis });
  let opened = false;
  if (dis.lookHidden === false && await tryClick('#sgLook')) opened = true; else if (dis.enterDisabled === false && await tryClick('#saengsaEnter')) opened = true;
  if (opened) { await page.waitForTimeout(1500); res.push(await sample('3e saengsa page')); } else res.push({ label: '3e saengsa page', note: 'not reachable (enter disabled, no look button)' });
}
await page.goto(base + '/test.html', { waitUntil: 'networkidle' });
res.push(await sample('4 test.html'));
fs.writeFileSync(new URL('./idle_screens.json', import.meta.url).pathname, JSON.stringify(res, null, 1));
await browser.close();
