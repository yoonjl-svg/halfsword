// probe15.mjs — the settings switch 'attack stick' turned on (it is off by default): the sword then listens to the right-hand stick only.
//  Saved in the settings before the page opens (the same thing the switch stores). Foe AI frozen.
import { boot } from './hlib.mjs';
const H = await boot({ base: process.argv[2], atkStick: true });
const out = (o) => console.log(JSON.stringify(o));
const box = async (sel) => { const b = await H.page.locator(sel).boundingBox().catch(() => null); return b ? { x: +b.x.toFixed(0), y: +b.y.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0) } : null; };
const z = await H.page.evaluate(() => { const W = innerWidth, Hh = innerHeight, step = 4, seen = {}; let total = 0; for (let y = 2; y < Hh; y += step) for (let x = 2; x < W; x += step) { const el = document.elementFromPoint(x, y); const n = el ? (el.id ? '#' + el.id : el.tagName.toLowerCase()) : 'null'; seen[n] = (seen[n] || 0) + 1; total++; } return { bodyClass: document.body.className, inputAtk: !!window.game.input?.atk, share: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, +(v / total * 100).toFixed(2)])) }; });
out({ part: 'layout', ...z, atkStick: await box('#atkStick'), guard: await box('#btnParry'), moveStick: await box('#moveStick') });
const A = await box('#atkStick'); const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2, r: A.w / 2 }; const G = await box('#btnParry');
for (let r = 1; r <= 3; r++) {
  await H.frames(90); let a = await H.snap();
  await H.tap(520, 150); await H.frames(40); let b = await H.snap(); const canvasTap = b.counts.thrust - a.counts.thrust;
  a = b; await H.swipe(560, 80, 440, 200, 4); await H.frames(45); b = await H.snap(); const canvasSwipe = { cut: b.counts.cut - a.counts.cut, hand: [+(b.hand[0] - a.hand[0]).toFixed(2), +(b.hand[1] - a.hand[1]).toFixed(2)] };
  await H.frames(60); a = await H.snap(); await H.tap(ac.x, ac.y); await H.frames(40); b = await H.snap(); const stickTap = b.counts.thrust - a.counts.thrust;
  await H.frames(60); a = await H.snap(); await H.down(2, ac.x, ac.y); for (let k = 0; k < 20; k++) await H.run(17); const m0 = await H.snap(); await H.up(2); await H.frames(30); b = await H.snap(); const stickRest = { thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, handHeld: m0.handHeld };
  await H.frames(60); a = await H.snap(); await H.down(2, ac.x, ac.y); await H.run(17); for (let k = 1; k <= 30; k++) { await H.moveSync(2, ac.x + ac.r * 0.9 * k / 30, ac.y - ac.r * 0.3 * k / 30); await H.run(17); } const m1 = await H.snap(); for (let k = 1; k <= 4; k++) { await H.moveSync(2, ac.x + ac.r * 0.9 - ac.r * 1.8 * k / 4, ac.y - ac.r * 0.3 + ac.r * 0.5 * k / 4); await H.run(17); } await H.frames(10); const m2 = await H.snap(); await H.up(2); await H.frames(45); b = await H.snap();
  const stickCut = { handAfterSlowPush: m1.hand, handAfterFlick: m2.hand, cut: b.counts.cut - a.counts.cut, thrust: b.counts.thrust - a.counts.thrust };
  await H.frames(60); await H.down(3, G.x + G.w / 2, G.y + G.h / 2); await H.frames(15); const g1 = await H.snap(); await H.up(3); await H.frames(5); const g2 = await H.snap();
  await H.frames(30); a = await H.snap(); await H.stick(0, 0.8); await H.frames(10); await H.tap(ac.x, ac.y); await H.frames(30); b = await H.snap(); await H.stickUp();
  out({ part: 'inputs', run: r, canvasTap_thrust: canvasTap, canvasSwipe, attackStickTap_thrust: stickTap, attackStickRestingThumb: stickRest, attackStickPushThenFlick: stickCut, guard: { heldWhilePressed: g1.guard?.held, heldAfter: g2.guard?.held }, walkAndStickTap: { moving: b.mv, thrust: b.counts.thrust - a.counts.thrust } });
}
await H.close();
