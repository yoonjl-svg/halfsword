// Round-over-round leak probe: plays N rounds through the normal result-panel flow and records
// post-GC heap, renderer counts, live-instance counts (CDP queryObjects), DOM counters, physics world size.
//  node leak_rounds.mjs <baseUrl> <query> <rounds> <outJson> [fightSecs=8] [forceWin=1]
//  query example: "fps=1&weapon=longsword&emo=0"   (add stage=<id> to pin the stage)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, query, roundsS = '8', out = '/dev/stdout', secsS = '8', forceWinS = '1'] = process.argv.slice(2);
const ROUNDS = +roundsS, SECS = +secsS, FORCE_WIN = forceWinS === '1';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--enable-precise-memory-info'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/?${query}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });

// prototypes to count, resolved in page; each entry is an expression yielding a prototype object
const PROTOS = {
  Fighter: 'Object.getPrototypeOf(game.player)',
  AI: 'game.AI.prototype',
  BufferGeometry: 'game.THREE.BufferGeometry.prototype',
  Material: 'game.THREE.Material.prototype',
  Texture: 'game.THREE.Texture.prototype',
  Object3D: 'game.THREE.Object3D.prototype',
  Mesh: 'game.THREE.Mesh.prototype',
  Light: 'game.THREE.Light.prototype',
  RenderTarget: 'game.THREE.WebGLRenderTarget.prototype',
  RapierWorld: 'Object.getPrototypeOf(game.world)',
  RapierRigidBody: 'Object.getPrototypeOf(game.world.bodies.getAll()[0])',
  RapierCollider: 'Object.getPrototypeOf(game.world.colliders.getAll()[0])',
  RapierImpulseJoint: '(()=>{const a=[];game.world.impulseJoints.forEach(j=>a.push(j));return a.length?Object.getPrototypeOf(a[0]):null})()',
  WasmMemory: 'WebAssembly.Memory.prototype',
  AudioNode: 'AudioNode.prototype',
  AudioBufferSourceNode: 'AudioBufferSourceNode.prototype',
  AudioBuffer: 'AudioBuffer.prototype',
};
async function queryArr(expr) {
  const p = await cdp.send('Runtime.evaluate', { expression: expr, objectGroup: 'q' });
  if (!p.result.objectId) return null;
  const q = await cdp.send('Runtime.queryObjects', { prototypeObjectId: p.result.objectId, objectGroup: 'q' });
  return q.objects.objectId;
}
async function onArr(id, fn) {
  const r = await cdp.send('Runtime.callFunctionOn', { objectId: id, functionDeclaration: fn, returnByValue: true, objectGroup: 'q' });
  return r.result.value;
}
// histograms describing what the instances are (for naming surplus objects)
const DESCR = {
  BufferGeometry: `function(){const h={};for(const g of this){if(!Object.prototype.hasOwnProperty.call(g,'uuid'))continue;const k=g.type+'|'+(g.name||'')+'|v'+(g.attributes.position?g.attributes.position.count:0)+'|attrs:'+Object.keys(g.attributes).join(',');h[k]=(h[k]||0)+1;}return h}`,
  Material: `function(){const h={};for(const m of this){if(!Object.prototype.hasOwnProperty.call(m,'uuid'))continue;const k=m.type+'|'+(m.name||'')+'|'+(m.map?'map':'')+(m.userData&&Object.keys(m.userData).length?'|ud:'+Object.keys(m.userData).join(','):'');h[k]=(h[k]||0)+1;}return h}`,
  Texture: `function(){const h={};for(const t of this){if(!Object.prototype.hasOwnProperty.call(t,'uuid'))continue;const i=t.image;const k=t.constructor.name+'|'+(t.name||'')+'|'+(i?(i.width||i.data&&i.data.length||'?')+'x'+(i.height||''):'noimg');h[k]=(h[k]||0)+1;}return h}`,
  Object3D: `function(){const sc=game.scene;const h={};for(const o of this){if(!Object.prototype.hasOwnProperty.call(o,'uuid'))continue;let r=o;while(r.parent)r=r.parent;const k=(r===sc?'inScene':'detached')+'|'+o.type+'|'+(o.name||'');h[k]=(h[k]||0)+1;}return h}`,
  AudioNode: `function(){const h={};for(const n of this){const k=n.constructor.name;h[k]=(h[k]||0)+1;}return h}`,
  WasmMemory: `function(){return this.map(m=>m.buffer.byteLength)}`,
};
async function gc() {
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
}
async function snapshot(label) {
  await gc();
  const heap = await cdp.send('Runtime.getHeapUsage');
  const dom = await cdp.send('Memory.getDOMCounters');
  const pageInfo = await page.evaluate(() => {
    const g = window.game;
    const ri = g.renderInfo();
    let objects = 0, meshes = 0; const mats = new Set();
    g.scene.traverse((o) => { objects++; if (o.isMesh) meshes++; for (const m of [].concat(o.material || [])) mats.add(m); });
    let joints = 0; g.world.impulseJoints.forEach(() => joints++);
    return { stage: g.stage.id, state: g.state, geometries: ri.geometries, textures: ri.textures, programs: ri.programs, sceneObjects: objects, sceneMeshes: meshes, sceneMaterials: mats.size,
      bodies: g.world.bodies.len(), colliders: g.world.colliders.len(), joints, debris: g.debris.count(), particles: g.particles?.count ?? null };
  });
  const counts = {}, descr = {};
  for (const [k, expr] of Object.entries(PROTOS)) {
    try {
      const id = await queryArr(expr);
      if (!id) { counts[k] = null; continue; }
      counts[k] = await onArr(id, "function(){let n=0;for(const o of this){try{if(Object.getPrototypeOf(o)&&Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(o),'constructor')&&Object.getPrototypeOf(o).constructor.prototype===Object.getPrototypeOf(o)&&!Object.prototype.hasOwnProperty.call(o,'constructor'))n++;}catch(e){n++}}return n}");
      if (DESCR[k]) descr[k] = await onArr(id, DESCR[k]);
    } catch (e) { counts[k] = 'err:' + String(e.message || e).slice(0, 80); }
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'q' });
  }
  const row = { label, heapMB: +(heap.usedSize / 1048576).toFixed(2), dom, ...pageInfo, counts, wasmBytes: descr.WasmMemory, descr };
  delete row.descr.WasmMemory;
  console.log(JSON.stringify({ label, stage: row.stage, heapMB: row.heapMB, geo: row.geometries, tex: row.textures, prog: row.programs, obj: row.sceneObjects, bodies: row.bodies, colliders: row.colliders, dom: dom.nodes + '/' + dom.jsEventListeners, counts, wasm: row.wasmBytes }));
  return row;
}
async function attachAi2() {
  await page.evaluate(() => {
    const g = window.game, a = g.ai;
    if (a.__ai2) return;
    const ai2 = new g.AI(g.player, g.enemy, 'normal');
    const orig = a.update.bind(a);
    a.update = (dt) => { orig(dt); try { ai2.update(dt); } catch (e) { window.__ai2err = String(e); } };
    a.__ai2 = true;
  });
}
const rows = [];
for (let r = 1; r <= ROUNDS; r++) {
  await attachAi2();
  await page.waitForTimeout(1500);
  rows.push({ round: r, ...(await snapshot(`r${r}-fight`)) });
  // fight AI vs AI for SECS wall seconds (creates wounds, blood, debris, trails), then end it
  await page.waitForTimeout(SECS * 1000);
  const end = await page.evaluate((fw) => {
    const g = window.game;
    const before = { p: g.player.alive, e: g.enemy.alive, simTime: +g.stats.simTime.toFixed(1) };
    if (fw && g.player.alive && g.enemy.alive) g.enemy.die('목', true);
    else if (g.player.alive && g.enemy.alive) g.player.die('목', true);
    return before;
  }, FORCE_WIN);
  rows.at(-1).fightEnd = end;
  await page.waitForFunction(() => window.game.state === 'paused' && document.getElementById('btnStart') && !document.getElementById('btnStart').hidden, null, { timeout: 180000 });
  rows.at(-1).button = await page.evaluate(() => document.getElementById('btnStart').textContent);
  if (r === ROUNDS) break;
  await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
}
await page.waitForTimeout(1000);
rows.push({ round: 'end', ...(await snapshot('end-resultpanel')) });
fs.writeFileSync(out, JSON.stringify({ base, query, rounds: ROUNDS, secs: SECS, rows, errors, ai2err: await page.evaluate(() => window.__ai2err || null) }, null, 1));
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
