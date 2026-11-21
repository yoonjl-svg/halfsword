// probe7.mjs — when does the game judge a sword-finger drag to be an "attack input" (the same line that ends a run, lets go of the guard,
//  fires an open secret window, and gives the pommel strike at hilt distance: main.js `swipe`)?
//  Same finger speed, three ways the frames can fall:  even = one move per 17 ms frame · long_frame = one 306 ms frame in the middle
//  · two_in_one = no move on one frame, two on the next.   px 0 is the control (finger resting).
//  Read-only hook: counts the frames in which main.js set player.runBreak (attack or guard input seen this frame).
import { boot } from './hlib.mjs';
const [base, part = 'run'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));
const H = await boot({ base });
await H.page.evaluate(() => { const p = window.game.player; let v = false; window.__brk = 0; Object.defineProperty(p, 'runBreak', { configurable: true, get: () => v, set: (x) => { if (x) window.__brk++; v = x; } }); });
const brk = () => H.page.evaluate(() => window.__brk);
const runInfo = () => H.page.evaluate(() => { const r = window.game.player.run; return { on: !!r?.on, end: r?.end ?? null }; });
let late = 0; const mv = async (x) => { const w = await H.moveSync(2, x, 200); if (w !== 0) late++; }; // late = moves the page had not yet seen when the call returned
const gesture = async (mode, px, look) => {
  let x = 520;
  await H.down(2, x, 200); for (let k = 0; k < 14; k++) { await H.run(17); await look(); } // rest 238 ms: not a tap
  if (mode === 'even') for (let k = 0; k < 24; k++) { x += px; await mv(x); await H.run(17); await look(); }
  if (mode === 'two_in_one') for (let k = 0; k < 24; k++) { if (k % 2) { x += px; await mv(x); x += px; await mv(x); } await H.run(17); await look(); }
  if (mode === 'long_frame') { for (let k = 0; k < 3; k++) { x += px; await mv(x); await H.run(17); await look(); } for (let k = 0; k < 18; k++) { x += px; await mv(x); } await H.page.clock.fastForward(306); await H.run(17); await look('long'); for (let k = 0; k < 3; k++) { x += px; await mv(x); await H.run(17); await look(); } }
  await H.up(2);
};
if (part === 'run') {
  for (const mode of ['even', 'two_in_one', 'long_frame']) for (const px of [0, 1, 2, 3, 3.5, 4, 5]) for (let rep = 1; rep <= 2; rep++) {
    await H.stickUp(); await H.frames(70);
    await H.stick(1, 0); let on = false; for (let i = 0; i < 260 && !on; i++) { await H.run(17); on = (await runInfo()).on; } await H.frames(10);
    late = 0; const b0 = await brk(); let endedAt = null, k = 0, swing = 0;
    await gesture(mode, px, async (tag) => { k++; const r = await runInfo(); if (!r.on && endedAt == null) endedAt = tag ?? k; if ((await H.snap()).swinging) swing++; });
    const r = await runInfo();
    out({ part, mode, pxPerFrame: px, pxPerSec: Math.round(px / 0.017), rep, ranBefore: on, attackInputFrames: (await brk()) - b0, runEnded: !r.on, endReason: r.end, endedAtFrame: endedAt, swingFrames: swing, movesSeenLate: late });
  }
}
if (part === 'guard') {
  const g = await H.page.locator('#btnParry').boundingBox();
  for (const mode of ['even', 'two_in_one', 'long_frame']) for (const px of [0, 1, 2, 3, 3.5, 4, 5]) for (let rep = 1; rep <= 2; rep++) {
    await H.frames(70);
    await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(25);
    late = 0; const a = await H.snap(); let broke = 0, maxHand = 0;
    await gesture(mode, px, async () => { const s = await H.snap(); if (s.guard?.broken) broke++; maxHand = Math.max(maxHand, Math.hypot(s.hand[0] - a.hand[0], s.hand[1] - a.hand[1])); });
    await H.up(3);
    out({ part, mode, pxPerFrame: px, pxPerSec: Math.round(px / 0.017), rep, heldBefore: a.guard?.held, framesGuardLetGo: broke, handMoved: +maxHand.toFixed(3), cut: (await H.snap()).counts.cut - a.counts.cut, movesSeenLate: late });
  }
}
await H.close();
