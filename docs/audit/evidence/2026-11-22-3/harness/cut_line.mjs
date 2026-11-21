// probe12.mjs — the slowest drag that becomes a cut (a cut = the game charges a cut to stamina), moves stepped in lock with the frames.
//  From rest each time. Drag for 16 frames at a set speed, in two directions. Also: the same with the guard button held.
import { boot } from './hlib.mjs';
const [base, withGuard = '0'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));
const H = await boot({ base });
const g = await H.page.locator('#btnParry').boundingBox();
for (const [name, ux, uy] of [['←', -1, 0], ['↙', -0.7, 0.7], ['↓', 0, 1]]) for (const px of [3, 4, 5, 6, 7, 8, 10, 12, 16]) {
  await H.frames(100);
  if (withGuard === '1') { await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(25); }
  const a = await H.snap(); let x = 620, y = 150, sw = 0, letGo = 0;
  await H.down(2, x, y); for (let k = 0; k < 14; k++) await H.run(17);
  for (let k = 0; k < 16; k++) { x += ux * px; y += uy * px; await H.moveSync(2, x, y); await H.run(17); const s = await H.snap(); if (s.swinging) sw++; if (s.guard?.broken) letGo++; }
  await H.up(2); for (let k = 0; k < 40; k++) { await H.run(17); const s = await H.snap(); if (s.swinging) sw++; if (s.guard?.broken) letGo++; }
  const b = await H.snap(); if (withGuard === '1') await H.up(3);
  out({ guardHeld: withGuard === '1', dir: name, pxPerFrame: px, pxPerSec: Math.round(px / 0.017), screenHeightsPerSec: +(px / 0.017 / 390).toFixed(2), cutCharged: b.counts.cut - a.counts.cut, swingFrames: sw, guardLetGoFrames: letGo, handMoved: +Math.hypot(b.hand[0] - a.hand[0], b.hand[1] - a.hand[1]).toFixed(2) });
}
await H.close();
