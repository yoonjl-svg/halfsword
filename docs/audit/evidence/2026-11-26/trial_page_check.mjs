// trial_page_check.mjs <base, e.g. http://127.0.0.1:4188/halfsword/>
// Audit check, independent of tools/physics2_page/isolation_check.mjs: does the /physics2/ trial page touch the main game's
// saved data, service worker or offline cache when both are opened in the same browser profile?
// Raw storage is read from a neutral same-origin document (pwa-build.json), where no game script and no storage wrapper runs.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
const raw = async () => { const p = await ctx.newPage(); await p.goto(base + 'pwa-build.json'); const d = await p.evaluate(async () => ({
  ls: Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])),
  regs: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope),
  caches: await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).length])),
})); await p.close(); return d; };
const sum = (d) => `storage keys ${Object.keys(d.ls).length} · service workers ${d.regs.length} · caches ${d.caches.map(([k, n]) => n + ' files').join(', ') || 'none'}`;
const visit = async (path, secs, taps = 0) => { const p = await ctx.newPage(); let fromSw = 0, n = 0; p.on('response', (r) => { n++; if (r.fromServiceWorker()) fromSw++; });
  await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(secs * 1000);
  for (let i = 0; i < taps; i++) { await p.touchscreen.tap(422, 195 + (i % 3) * 40); await p.waitForTimeout(700); }
  const info = await p.evaluate(() => ({ title: document.title, controlled: !!navigator.serviceWorker.controller, manifest: !!document.querySelector('link[rel=manifest]'), flag: window.__stillnessP2TrialStorage ?? null }));
  await p.close(); return { ...info, responses: n, fromSw }; };

// 1. main game first: let it install its worker and write its own keys, then add a marker key
console.log('1 main:', JSON.stringify(await visit('', 12, 4)));
{ const p = await ctx.newPage(); await p.goto(base + 'pwa-build.json'); await p.evaluate(() => localStorage.setItem('audit.marker', 'main-A')); await p.close(); }
const before = await raw(); console.log('  before trial:', sum(before)); console.log('  main keys:', Object.keys(before.ls).join(' | '));
// 2. trial page: both entry points, with taps
console.log('2 trial test.html:', JSON.stringify(await visit('physics2/test.html', 12, 6)));
console.log('2 trial index:', JSON.stringify(await visit('physics2/', 12, 6)));
const after = await raw(); console.log('  after trial:', sum(after));
const changed = Object.keys(before.ls).filter((k) => after.ls[k] !== before.ls[k]);
const added = Object.keys(after.ls).filter((k) => !(k in before.ls));
console.log(`  main keys changed or removed by the trial page: ${changed.length}${changed.length ? ' → ' + changed.join(', ') : ''}`);
console.log(`  keys added: ${added.length} · without the trial prefix: ${added.filter((k) => !k.startsWith('stillness.p2trial.')).length}`);
// 3. the known open item: the main game's emergency switch ?nosw=1 on a trial address
console.log('3 trial test.html?nosw=1:', JSON.stringify(await visit('physics2/test.html?nosw=1', 8)));
const afterNosw = await raw(); console.log('  after ?nosw=1 on the trial address:', sum(afterNosw));
const changed2 = Object.keys(before.ls).filter((k) => afterNosw.ls[k] !== before.ls[k]); console.log(`  main keys changed or removed: ${changed2.length}`);
// 4. open the main game again (online): does it come back?
console.log('4 main again:', JSON.stringify(await visit('', 15)));
const back = await raw(); console.log('  after reopening the main game:', sum(back));
await browser.close();
