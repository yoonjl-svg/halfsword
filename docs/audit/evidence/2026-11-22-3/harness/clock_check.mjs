// probe6.mjs — which clock does the page's event time follow in this harness: the stepped (fake) clock or the wall clock?
import { boot, sleep } from './hlib.mjs';
const H = await boot({ base: process.argv[2] });
await H.page.evaluate(() => { window.__ts = []; for (const t of ['pointerdown', 'pointerup']) window.addEventListener(t, (e) => window.__ts.push([t, +e.timeStamp.toFixed(1)]), true); });
const p = { x: 620, y: 200, id: 7 };
const send = (type) => H.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [p] });
for (const [label, steppedMs, wallMs] of [['stepped 17 / wall 400', 17, 400], ['stepped 170 / wall 0', 170, 0], ['stepped 204 / wall 0', 204, 0], ['stepped 408 / wall 0', 408, 0], ['stepped 17 / wall 0', 17, 0]]) {
  const a = await H.snap();
  await send('touchStart'); for (let k = 0; k < Math.round(steppedMs / 17); k++) await H.run(17); if (wallMs) await sleep(wallMs);
  await send('touchEnd'); await H.frames(40);
  const b = await H.snap(); const ts = await H.page.evaluate(() => window.__ts.splice(0));
  console.log(JSON.stringify({ label, pageSawMs: +(ts.at(-1)[1] - ts[0][1]).toFixed(1), thrust: b.counts.thrust - a.counts.thrust }));
  await H.frames(60);
}
await H.close();
