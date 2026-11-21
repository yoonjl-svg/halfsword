// probe2.mjs <baseUrl> : what pointer events does the page receive when a second finger goes down (CDP touch)
import { boot } from './hlib.mjs';
const H = await boot({ base: process.argv[2], cells: ['G1'], weapon: 'longsword' });
await H.page.evaluate(() => { window.__log = []; for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'gotpointercapture', 'touchstart', 'touchend', 'touchcancel']) window.addEventListener(t, (e) => window.__log.push(`${t}:${e.pointerId ?? (e.changedTouches ? [...e.changedTouches].map((x) => x.identifier).join('+') : '')}@${e.target?.id || e.target?.tagName}`), true); });
const log = async (label) => { const l = await H.page.evaluate(() => { const x = window.__log.slice(); window.__log.length = 0; return x; }); const s = await H.snap(); console.log(label.padEnd(26), JSON.stringify(l), 'mv', s.mv, 'guard', s.guard.held, 'handHeld', s.handHeld); };
await H.stick(0, 0.7); await H.frames(10); await log('stick down+tilt');
await H.down(2, 620, 200); await H.run(17); await log('sword finger down');
await H.frames(5); await log('5 frames later');
await H.up(2); await H.run(17); await log('sword finger up');
await H.frames(20); await log('20 frames later');
await H.stickUp(); await log('stick up');
const vp = await H.page.evaluate(() => ({ meta: document.querySelector('meta[name=viewport]')?.content, ta: getComputedStyle(document.getElementById('game')).touchAction, taStick: getComputedStyle(document.getElementById('moveStick')).touchAction, taBody: getComputedStyle(document.body).touchAction, taParry: getComputedStyle(document.getElementById('btnParry')).touchAction }));
console.log(JSON.stringify(vp));
await H.close();
