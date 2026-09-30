// Perf baseline: one stage, one CPU throttle rate, one run.
//  node P_measure.mjs <baseUrl> <stage> <rate> <outJson> [seconds=15]
//  landscape 844x390 @ DPR 3 (game caps pixel ratio at 2), touch/mobile context, AI-vs-AI (second AI drives the player).
import { chromium } from './P_pw/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [base = 'http://127.0.0.1:5190', stage = 'poseidon', rateS = '4', out = '/dev/stdout', secsS = '15'] = process.argv.slice(2);
const rate = +rateS, secs = +secsS;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: +(process.env.DPR || 3), isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/?fps=1&stage=${stage}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 60000 });
await page.locator('#draw .wcard[data-i="0"]').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });

// AI-vs-AI: a second AI drives the player, called once per physics step alongside the foe AI
await page.evaluate(() => {
  const g = window.game;
  const a = g.ai;
  const ai2 = new g.AI(g.player, g.enemy, 'normal');
  const orig = a.update.bind(a);
  a.update = (dt) => { orig(dt); try { ai2.update(dt); } catch (e) { window.__ai2err = String(e); } };
});
// TINY=1: shrink the drawing buffer to 8x4 so software-GL fill cost vanishes (CPU-bound proxy; shadow map still rendered)
if (process.env.TINY) await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
// NOSHADOW=1: A/B experiment — turn off castShadow on every light (runtime only, no source change) to price the shadow pass
if (process.env.NOSHADOW) await page.evaluate(() => { let r = window.game.player.meshes[0].group; while (r.parent) r = r.parent; r.traverse((o) => { if (o.isLight) o.castShadow = false; }); });
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.waitForTimeout(2000); // settle

function sceneStats() {
  const g = window.game;
  let root = g.player.meshes[0].group;
  while (root.parent) root = root.parent;
  const s = { lights: 0, lightTypes: {}, shadowLights: [], meshes: 0, visibleMeshes: 0, instanced: 0, skinned: 0, points: 0, lines: 0, sprites: 0, transparentMats: 0, additiveMats: 0, materials: 0, castShadowMeshes: 0, objects: 0 };
  const mats = new Set();
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  root.traverse((o) => {
    s.objects++;
    if (o.isLight) {
      s.lights++;
      s.lightTypes[o.type] = (s.lightTypes[o.type] || 0) + 1;
      if (o.castShadow && visible(o)) s.shadowLights.push(`${o.type}:${o.shadow.mapSize.x}x${o.shadow.mapSize.y}`);
    }
    if (o.isMesh) { s.meshes++; if (visible(o)) s.visibleMeshes++; if (o.isInstancedMesh) s.instanced++; if (o.isSkinnedMesh) s.skinned++; if (o.castShadow && visible(o)) s.castShadowMeshes++; }
    if (o.isPoints) s.points++;
    if (o.isLine || o.isLineSegments) s.lines++;
    if (o.isSprite) s.sprites++;
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) mats.add(m);
  });
  for (const m of mats) { s.materials++; if (m.transparent) s.transparentMats++; if (m.blending === 2) s.additiveMats++; }
  s.fog = !!root.fog; s.bgType = root.background ? root.background.constructor.name : null;
  s.shadowMapType = null;
  return s;
}

// per-frame sampling in the page
await cdp.send('Performance.enable');
const pm = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
const pm0 = await pm();
await page.evaluate((secs) => new Promise((res) => {
  const g = window.game;
  const d = []; const calls = []; const tris = []; const heap = []; const perfTxt = [];
  let last = performance.now(); const t0 = last;
  const meter = [...document.querySelectorAll('div')].find((e) => /^FPS /.test(e.textContent));
  let lastTxt = '';
  function f(now) {
    d.push(now - last); last = now;
    const ri = g.renderInfo(); calls.push(ri.calls); tris.push(ri.triangles);
    if (performance.memory && d.length % 10 === 0) heap.push(performance.memory.usedJSHeapSize);
    if (meter && meter.textContent !== lastTxt) { lastTxt = meter.textContent; perfTxt.push(lastTxt); }
    if (now - t0 < secs * 1000) requestAnimationFrame(f); else { window.__m = { d, calls, tris, heap, perfTxt, ri, state: g.state, stats: { ...g.stats }, pAlive: g.player.alive, eAlive: g.enemy.alive }; res(); }
  }
  requestAnimationFrame(f);
}), secs);
const pm1 = await pm();
const m = await page.evaluate(() => window.__m);
const sc = await page.evaluate(sceneStats);
const ai2err = await page.evaluate(() => window.__ai2err || null);

// 5 s trace: GC events (minor/major) + heap growth
const heapBefore = await page.evaluate(() => performance.memory.usedJSHeapSize);
const events = [];
cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
await cdp.send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-v8.gc', transferMode: 'ReportEvents' });
await page.waitForTimeout(5000);
const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.end');
await done;
const heapAfter = await page.evaluate(() => performance.memory.usedJSHeapSize);
const gcNames = {};
for (const e of events) if (/GC|Scavenge|MarkCompact|MinorMS/i.test(e.name) && e.ph === 'X' || (e.ph === 'B' && /GC/.test(e.name))) gcNames[e.name] = (gcNames[e.name] || 0) + 1;
const minorGC = (gcNames.MinorGC || 0), majorGC = (gcNames.MajorGC || 0);
const gcMs = events.filter((e) => (e.name === 'MinorGC' || e.name === 'MajorGC') && e.dur).reduce((a, e) => a + e.dur / 1000, 0);

// summarize
const d = m.d.slice(1).filter((x) => x > 0);
const avg = d.reduce((a, b) => a + b, 0) / d.length;
const sorted = [...d].sort((a, b) => b - a);
const p5 = sorted[Math.floor(d.length * 0.05)];
const p1 = sorted[Math.floor(d.length * 0.01)];
const num = (re) => { const v = m.perfTxt.map((t) => (t.match(re) || [])[1]).filter(Boolean).map(Number); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
const mean = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(0);
const summary = {
  stage, rate, dprSet: +(process.env.DPR || 3), tiny: !!process.env.TINY, frames: d.length, fpsAvg: +(1000 / avg).toFixed(1), fps5low: +(1000 / p5).toFixed(1), fps1low: +(1000 / p1).toFixed(1), frameMs: +avg.toFixed(2), frameP95: +p5.toFixed(1),
  physMs: num(/물리 ([\d.]+)ms/), steps: num(/×([\d.]+)스텝/), renderMs: num(/그리기 ([\d.]+)ms/), gameSpeed: num(/게임 속도 ([\d.]+)%/),
  calls: mean(m.calls), callsMax: Math.max(...m.calls), tris: mean(m.tris), trisMax: Math.max(...m.tris),
  programs: m.ri.programs, geometries: m.ri.geometries, textures: m.ri.textures,
  heapMB: +(m.heap.at(-1) / 1048576).toFixed(1), heapMinMB: +(Math.min(...m.heap) / 1048576).toFixed(1), heapMaxMB: +(Math.max(...m.heap) / 1048576).toFixed(1),
  gc5s: { minor: minorGC, major: majorGC, gcMs: +gcMs.toFixed(1), names: gcNames, heapDeltaMB: +((heapAfter - heapBefore) / 1048576).toFixed(2) },
  mainThread: (() => { const n = m.d.length; const dd = (k) => +(((pm1[k] - pm0[k]) * 1000) / n).toFixed(2); return { taskMsPerFrame: dd('TaskDuration'), scriptMsPerFrame: dd('ScriptDuration'), layoutMsPerFrame: dd('LayoutDuration'), styleMsPerFrame: dd('RecalcStyleDuration'), wallMsPerFrame: +(((pm1.Timestamp - pm0.Timestamp) * 1000) / n).toFixed(2) }; })(),
  scene: sc, canvas: await page.evaluate(() => { const c = document.querySelector('canvas'); return `${c.width}x${c.height}`; }), dpr: await page.evaluate(() => devicePixelRatio),
  endState: { state: m.state, pAlive: m.pAlive, eAlive: m.eAlive, simTime: +m.stats.simTime?.toFixed?.(1) }, ai2err, errors,
  perfSample: m.perfTxt.at(-1),
};
fs.writeFileSync(out, JSON.stringify({ summary, raw: { d: m.d, calls: m.calls, tris: m.tris, heap: m.heap, perfTxt: m.perfTxt } }));
const s = summary;
console.log(`${stage} r${rate}${process.env.TINY ? ' TINY' : ''}${process.env.NOSHADOW ? ' NOSHADOW' : ''} dpr${process.env.DPR || 3}: fps ${s.fpsAvg}/${s.fps5low} frame ${s.frameMs}ms phys ${s.physMs} render ${s.renderMs} speed ${s.gameSpeed}% calls ${s.calls}(${s.callsMax}) tris ${(s.tris / 1000).toFixed(0)}k(${(s.trisMax / 1000).toFixed(0)}k) prog ${s.programs} geo ${s.geometries} tex ${s.textures} lights ${sc.lights} ${JSON.stringify(sc.lightTypes)} shadow [${sc.shadowLights}] meshes ${sc.visibleMeshes}/${sc.meshes} castSh ${sc.castShadowMeshes} pts ${sc.points} transp ${sc.transparentMats} add ${sc.additiveMats} mats ${sc.materials} main task ${s.mainThread.taskMsPerFrame} script ${s.mainThread.scriptMsPerFrame} steps ${s.steps} heap ${s.heapMB}MB gc ${minorGC}/${majorGC} ${s.gc5s.gcMs}ms dHeap ${s.gc5s.heapDeltaMB} canvas ${s.canvas} end ${JSON.stringify(s.endState)} ${ai2err || ''} ${errors.length ? 'ERR ' + errors.join('|') : ''}`);
await browser.close();
