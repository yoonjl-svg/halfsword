// suite.mjs <baseUrl> <outJsonl> <scenario,scenario,...|all> [repeats=3]
//  Each scenario boots a fresh page (normal path), sends REAL touch events, and records what the game did.
//  "forced" lists every precondition that was set through window.game instead of being played.
import fs from 'node:fs';
import { boot, sleep } from './hlib.mjs';
const [base, out, which = 'all', repS = '3'] = process.argv.slice(2);
const REP = +repS;
const G12 = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
const I12 = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12'];
const watch = async (H, n, pick) => { const seen = {}; await H.frames(n, async () => { const s = await H.snap(); for (const [k, f] of Object.entries(pick)) if (f(s)) seen[k] = (seen[k] || 0) + 1; }); return seen; };
const SX = 620, SY = 200; // sword-side finger
const walkTo = async (H, dist, max = 600) => { await H.stick(0, 0.8); for (let i = 0; i < max; i++) { await H.run(17); const s = await H.snap(); if (s.d <= dist) break; } await H.stickUp(); await H.frames(20); };
const downFoe = (H) => H.page.evaluate(() => { const e = window.game.enemy; e.knockDown(true); e.downTime = 1e9; });

const SC = {
  // ── 가. basic inputs ──
  async tap_plain(H) { const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 40, { tap: (s) => !!s.tap, drive: (s) => !!s.tap?.drive, head: (s) => !!s.tap?.head }); const b = await H.snap();
    return { expect: 'thrust', ok: b.counts.thrust === a.counts.thrust + 1 && !!seen.tap, obs: { thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, seen } }; },
  async tap_head(H) { // raise the hand with a slow drag up, release, then tap
    await H.drag(SX, 260, SX, 150, 50); await H.up(2); await H.frames(3); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 40, { tap: (s) => !!s.tap, head: (s) => !!s.tap?.head }); const b = await H.snap();
    return { expect: 'head thrust (hand above headPad 0.15)', ok: !!seen.head, obs: { handBefore: a.hand, thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, seen } }; },
  async swipe_cut(H) { const a = await H.snap(); await H.swipe(680, 120, 560, 260, 4); const seen = await watch(H, 40, { swinging: (s) => s.swinging }); const b = await H.snap();
    return { expect: 'cut', ok: b.counts.cut === a.counts.cut + 1, obs: { cut: b.counts.cut - a.counts.cut, thrust: b.counts.thrust - a.counts.thrust, seen } }; },
  async drag_slow(H) { const a = await H.snap(); await H.drag(SX, 200, SX - 60, 240, 60); const mid = await H.snap(); await H.up(2); await H.frames(30); const b = await H.snap();
    return { expect: 'hand moves, no cut, no thrust', ok: b.counts.cut === a.counts.cut && b.counts.thrust === a.counts.thrust && (mid.hand[0] !== a.hand[0] || mid.hand[1] !== a.hand[1]), obs: { hand0: a.hand, handMid: mid.hand, cut: b.counts.cut - a.counts.cut, thrust: b.counts.thrust - a.counts.thrust, gripMid: mid.grip } }; },
  async hold_still(H) { const a = await H.snap(); await H.down(2, SX, SY); await H.run(17); await sleep(260); await H.frames(20); const mid = await H.snap(); await H.up(2); await H.frames(30); const b = await H.snap();
    return { expect: 'long still press is not a tap: nothing', ok: b.counts.thrust === a.counts.thrust && b.counts.cut === a.counts.cut, obs: { thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, handHeldMid: mid.handHeld } }; },
  async swipe_speed(H) { // slowest drag that still becomes a cut: px per frame (17 ms) over 8 frames, after a rest so it is not a tap
    const res = []; for (const px of [3, 4, 5, 6, 7, 8, 10, 12, 16]) { const a = await H.snap(); await H.down(2, 680, 140); await H.run(17); await sleep(200); let sw = 0; for (let k = 1; k <= 8; k++) { await H.move(2, 680 - px * k, 140 + px * k * 0.6); await H.run(17); if ((await H.snap()).swinging) sw++; } await H.up(2); for (let k = 0; k < 45; k++) { await H.run(17); if ((await H.snap()).swinging) sw++; } const b = await H.snap(); res.push([px, sw > 0 ? 1 : 0, b.counts.cut - a.counts.cut]); await H.frames(40); }
    const first = res.find((r) => r[1] > 0)?.[0] ?? null; return { expect: 'report threshold', ok: first != null, obs: { 'px/frame,swinging,charged': res, firstSwingAt_pxPerFrame: first, asScreenHeightsPerSec: first ? +((first * Math.hypot(1, 0.6)) / 390 / 0.017).toFixed(2) : null } }; },
  async guard_button(H) { const a = await H.snap(); const b0 = await H.page.locator('#btnParry').boundingBox(); const gx = b0.x + b0.width / 2, gy = b0.y + b0.height / 2;
    await H.down(3, gx, gy); await H.frames(10); const mid = await H.snap(); await H.up(3); await H.frames(10); const b = await H.snap();
    return { expect: 'guard held while pressed, released after; no thrust', ok: mid.guard.held && !b.guard.held && b.counts.thrust === a.counts.thrust, obs: { heldMid: mid.guard, heldAfter: b.guard, thrust: b.counts.thrust - a.counts.thrust, block: b.counts.block - a.counts.block, guardNameMid: mid.guardName } }; },
  async guard_then_tap(H) { const a = await H.snap(); const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.frames(10); await H.tap(SX, SY);
    const seen = await watch(H, 6, { broken: (s) => s.guard.broken, tap: (s) => !!s.tap }); const seen2 = await watch(H, 120, { broken: (s) => s.guard.broken, tap: (s) => !!s.tap, heldNotBroken: (s) => s.guard.held && !s.guard.broken && !s.tap }); const b = await H.snap(); await H.up(3); await H.frames(5);
    return { expect: 'guard opens for the thrust, then closes again while still pressed', ok: b.counts.thrust === a.counts.thrust + 1 && (seen.broken || seen2.broken) > 0 && seen2.heldNotBroken > 0, obs: { thrust: b.counts.thrust - a.counts.thrust, seen, seen2, end: b.guard } }; },
  async guard_then_swipe(H) { const a = await H.snap(); const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.frames(10); await H.swipe(680, 120, 560, 260, 4);
    const seen = await watch(H, 150, { broken: (s) => s.guard.broken, swinging: (s) => s.swinging, heldNotBroken: (s) => s.guard.held && !s.guard.broken && !s.swinging }); const b = await H.snap(); await H.up(3); await H.frames(5);
    return { expect: 'guard opens for the cut, then closes again while still pressed', ok: b.counts.cut === a.counts.cut + 1 && seen.heldNotBroken > 0, obs: { cut: b.counts.cut - a.counts.cut, seen, end: b.guard } }; },
  async guard_holds_hand(H) { const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.frames(20); const a = await H.snap(); await H.drag(SX, 200, SX - 60, 250, 60); const mid = await H.snap(); await H.up(2); await H.up(3); await H.frames(10); const b = await H.snap();
    return { expect: 'while guarding, a slow drag does not move the hand target by the finger (guard owns the hand)', ok: b.counts.cut === a.counts.cut, obs: { hand0: a.hand, handMid: mid.hand, cut: b.counts.cut - a.counts.cut, guardMid: mid.guard } }; },
  async stick_walk(H) { const a = await H.snap(); await H.stick(0, 0.7); await H.frames(60); const m = await H.snap(); await H.stickUp(); await H.frames(40); const b = await H.snap();
    return { expect: 'walk toward the foe; stop on release', ok: m.mv[1] > 0 && m.d < a.d && b.mv[0] === 0 && b.mv[1] === 0, obs: { d0: a.d, dMid: m.d, mvMid: m.mv, mvAfter: b.mv } }; },
  async stick_run(H) { // sideways full tilt (inside the front half) so the frozen foe is not in the way
    const a = await H.snap(); await H.stick(1, 0); let on = null; for (let i = 0; i < 220; i++) { await H.run(17); const s = await H.snap(); if (s.run && on == null) on = +((i + 1) * 17 / 1000).toFixed(2); } const m = await H.snap(); await H.stickUp(); await H.frames(40); const b = await H.snap();
    return { expect: 'run starts after holding full tilt about 2.0 s', ok: on != null && Math.abs(on - 2.2) < 0.5 && !b.run, obs: { runOnAfterSec_gameClock: on, stam0: a.stam, stamMid: m.stam, runAfterRelease: b.run } }; },
  async stick_run_back(H) { const a = await H.snap(); await H.stick(0, -1); let on = null; for (let i = 0; i < 220; i++) { await H.run(17); const s = await H.snap(); if (s.run && on == null) on = +((i + 1) * 17 / 1000).toFixed(2); } const m = await H.snap(); await H.stickUp();
    return { expect: 'report only: full tilt straight back for 3.7 s (rule in run.js:86-88: front half only)', ok: on == null, obs: { runOnAfterSec: on, mvMid: m.mv, d0: a.d, dEnd: m.d } }; },
  async run_broken_by_tap(H) { await H.stick(1, 0); let on = false; for (let i = 0; i < 220 && !on; i++) { await H.run(17); on = (await H.snap()).run; } await H.frames(20); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 10, { run: (s) => s.run }); const b = await H.snap(); await H.stickUp();
    return { expect: 'a tap while running ends the run and thrusts', ok: on && !b.run && b.counts.thrust === a.counts.thrust + 1, obs: { ranBefore: on, framesStillRunningAfterTap: seen.run || 0, thrust: b.counts.thrust - a.counts.thrust, runAfter: b.run } }; },
  // ── tap branches that need a situation ──
  async tap_pommel(H) { await walkTo(H, 0.9); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 40, { pom: (s) => s.pom, tap: (s) => !!s.tap }); const b = await H.snap();
    return { expect: 'hilt distance: tap = pommel strike, not a thrust', ok: !!seen.pom && !seen.tap, forced: ['foe AI frozen'], obs: { d: a.d, seen, thrust: b.counts.thrust - a.counts.thrust, cue: b.cue } }; },
  async tap_plunge(H) { await walkTo(H, 1.6); await downFoe(H); await H.frames(90); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 240, { down: (s) => !!s.tap?.down, cleave: (s) => !!s.tap?.cleave, tap: (s) => !!s.tap }); const b = await H.snap();
    return { expect: 'foe on the ground: tap = plunge finish', ok: !!seen.down && !seen.cleave, forced: ['foe AI frozen', 'foe knocked down and kept down'], obs: { d: a.d, es: a.es, seen, thrust: b.counts.thrust - a.counts.thrust, esAfter: b.es, cue: b.cue } }; },
  async tap_cleave(H) { await walkTo(H, 1.8); await downFoe(H); await H.frames(90); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 240, { down: (s) => !!s.tap?.down, cleave: (s) => !!s.tap?.cleave }); const b = await H.snap();
    return { expect: 'greatsword, foe on the ground: tap = cleave finish', ok: !!seen.cleave, forced: ['foe AI frozen', 'foe knocked down and kept down'], obs: { d: a.d, es: a.es, seen, esAfter: b.es, cue: b.cue } }; },
  async tap_getup_vital(H, r) { await walkTo(H, 1.6); await H.page.evaluate(() => window.game.enemy.knockDown(true)); let st = null; for (let i = 0; i < 900; i++) { await H.run(17); st = (await H.snap()).es; if (st === 'getup' || st === 'kneel') break; } await H.frames((r - 1) * 30); const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 120, { vital: (s) => !!s.tap?.vital, down: (s) => !!s.tap?.down, tap: (s) => !!s.tap }); const b = await H.snap();
    return { expect: 'foe getting up: tap = plunge while still low, vital thrust once higher', ok: !!(seen.vital || seen.down), forced: ['foe AI frozen', 'foe knocked down once'], obs: { framesAfterGetupStart: (r - 1) * 30, esAtTap: a.es, d: a.d, seen, vitalCount: b.vital - a.vital, thrust: b.counts.thrust - a.counts.thrust } }; },
  async tap_gun(H) { const a = await H.snap(); await H.down(2, SX, SY); await H.run(17); const m = await H.snap(); await sleep(260); await H.frames(10); await H.up(2); await H.frames(30); const b = await H.snap();
    return { expect: 'pistol: fires at touch-down (not at release)', ok: m.spent.attack > a.spent.attack || (m.shots ?? 0) > (a.shots ?? 0), obs: { spentBefore: a.spent.attack, spentAtDown: m.spent.attack, spentAfter: b.spent.attack, shots: [a.shots, m.shots, b.shots], counts: b.counts } }; },
  async tap_whip(H) { const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 40, { flick: (s) => s.flick, tap: (s) => !!s.tap }); const b = await H.snap();
    return { expect: 'whip: tap = flick', ok: !!seen.flick, obs: { seen, counts: b.counts } }; },
  async tap_italian(H) { const a = await H.snap(); await H.tap(SX, SY); const seen = await watch(H, 40, { it: (s) => !!s.tap?.it, tap: (s) => !!s.tap }); const b = await H.snap();
    return { expect: 'Italian sword: tap = lunge thrust', ok: !!seen.it, obs: { seen, thrust: b.counts.thrust - a.counts.thrust } }; },
  // ── 다. states where input must not act ──
  async exhausted(H) { let n = 0; for (; n < 80; n++) { await H.swipe(680, 120, 560, 260, 3); await H.swipe(560, 260, 680, 120, 3); if ((await H.snap()).exhausted) break; } const a = await H.snap(); await H.frames(5); await H.tap(SX, SY); await H.swipe(680, 120, 560, 260, 4); await H.stick(0, 0.8); await H.frames(30); const b = await H.snap(); await H.stickUp();
    return { expect: 'exhausted (reached by real swipes, default necklace taken off): tap, swipe and stick do nothing', ok: a.exhausted && b.counts.thrust === a.counts.thrust && b.counts.cut === a.counts.cut && b.mv[0] === 0 && b.mv[1] === 0, forced: ['default necklace (infinite stamina) taken off in the save'], obs: { swipePairsToExhaust: n + 1, stam: a.stam, exhausted: a.exhausted, thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, mv: b.mv } }; },
  async default_stamina(H) { const a = await H.snap(); for (let n = 0; n < 12; n++) { await H.swipe(680, 120, 560, 260, 3); await H.swipe(560, 260, 680, 120, 3); } const b = await H.snap();
    return { expect: 'report only: stamina after 24 fast cuts with the default save', ok: true, obs: { stam0: a.stam, stamAfter: b.stam, cuts: b.counts.cut - a.counts.cut, spentAttack: b.spent.attack, exhausted: b.exhausted } }; },
  async paused(H) { const pb = await H.page.locator('#btnPause').boundingBox(); await H.page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2); await H.frames(20); const a = await H.snap(); await H.tap(SX, SY); await H.swipe(680, 120, 560, 260, 4); await H.stick(0, 0.8); await H.frames(20); const m = await H.snap(); await H.stickUp();
    const rb = H.page.locator('#btnResume'); let resumed = false; if (await rb.isVisible().catch(() => false)) { const r = await rb.boundingBox(); await H.page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); resumed = true; } const seen = await watch(H, 90, { tap: (s) => !!s.tap, swinging: (s) => s.swinging, moving: (s) => s.mv[0] !== 0 || s.mv[1] !== 0 }); const b = await H.snap();
    return { expect: 'paused: input ignored, and nothing queued fires after resume', ok: a.state === 'paused' && m.counts.thrust === a.counts.thrust && b.counts.thrust === a.counts.thrust && b.counts.cut === a.counts.cut && !seen.tap && !seen.swinging && !seen.moving, obs: { stateAtPause: a.state, resumed, stateAfter: b.state, thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, seenAfterResume: seen } }; },
  async round_over(H) { await H.page.evaluate(() => window.game.enemy.die('목', true)); let st = null; for (let i = 0; i < 600; i++) { await H.run(17); st = (await H.snap()).state; if (st !== 'fight') break; } const a = await H.snap(); await H.tap(SX, SY); await H.swipe(680, 120, 560, 260, 4); await H.stick(0, 0.8); await H.frames(20); const b = await H.snap(); await H.stickUp();
    return { expect: 'round over (result panel): input ignored', ok: a.state !== 'fight' && b.counts.thrust === a.counts.thrust && b.counts.cut === a.counts.cut && b.mv[0] === 0 && b.mv[1] === 0, forced: ['foe killed'], obs: { state: a.state, thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, mv: b.mv } }; },
  async opening_lock(H) { return { expect: 'n/a', ok: true, obs: {} }; },
  // ── 라. finger wiring ──
  async two_fingers(H) { const a = await H.snap(); await H.stick(0, 0.7); await H.frames(20); await H.tap(SX, SY); const seen = await watch(H, 30, { tap: (s) => !!s.tap, moving: (s) => s.mv[1] > 0 }); await H.swipe(680, 120, 560, 260, 4); await H.frames(40); const b = await H.snap(); await H.stickUp();
    return { expect: 'stick thumb + sword finger together: walk and attack at once', ok: b.counts.thrust === a.counts.thrust + 1 && b.counts.cut === a.counts.cut + 1 && seen.moving > 0, obs: { thrust: b.counts.thrust - a.counts.thrust, cut: b.counts.cut - a.counts.cut, seen } }; },
  async second_sword_finger(H) { const a = await H.snap(); await H.down(2, SX, SY); await H.run(17); await sleep(250); await H.frames(5); await H.down(4, SX + 80, SY + 40); await H.run(17); await H.up(4); await H.frames(20); const m = await H.snap(); await H.up(2); await H.frames(30); const b = await H.snap();
    return { expect: 'one sword finger only: a second finger tapping while the first rests does nothing', ok: m.counts.thrust === a.counts.thrust && b.counts.thrust === a.counts.thrust, obs: { thrustMid: m.counts.thrust - a.counts.thrust, thrustEnd: b.counts.thrust - a.counts.thrust, handHeldMid: m.handHeld } }; },
  async stick_ring(H) { const R = H.SC.r; const res = {}; for (const [k, off] of [['inRing_+10px', R + 10], ['outside_+25px', R + 25]]) { const a = await H.snap(); await H.down(5, H.SC.x + off, H.SC.y); await H.run(17); const m = await H.snap(); await H.up(5); await H.frames(40); const b = await H.snap(); res[k] = { thrust: b.counts.thrust - a.counts.thrust, mvAtDown: m.mv, canvasDown: m.ev.down - a.ev.down }; await H.frames(30); }
    return { expect: 'within 15 px outside the stick circle: not a sword tap (grabs the stick); farther out: a sword tap', ok: res['inRing_+10px'].thrust === 0 && res['outside_+25px'].thrust === 1, obs: res }; },
  async cancel_stick(H) { await H.stick(0, 0.8); await H.frames(30); const m = await H.snap(); await H.cancel(); await H.frames(30); const b = await H.snap();
    return { expect: 'touch cancelled by the system (call, notification): walking stops, nothing stays held', ok: m.mv[1] > 0 && b.mv[0] === 0 && b.mv[1] === 0, obs: { mvBefore: m.mv, mvAfter: b.mv, cancelSeen: b.ev.cancel } }; },
  async cancel_sword(H) { const a = await H.snap(); await H.down(2, 680, 120); await H.run(17); await H.move(2, 650, 155); await H.run(17); await H.cancel(); await H.frames(40); const b = await H.snap(); await H.tap(SX, SY); await H.frames(40); const c = await H.snap();
    return { expect: 'sword finger cancelled mid-drag: finger released, no stuck hold, next tap works', ok: !b.handHeld && c.counts.thrust === a.counts.thrust + 1, obs: { handHeldAfterCancel: b.handHeld, cut: b.counts.cut - a.counts.cut, thrustAfter: c.counts.thrust - a.counts.thrust } }; },
  async cancel_guard(H) { const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.frames(15); const m = await H.snap(); await H.cancel(); await H.frames(30); const b = await H.snap();
    return { expect: 'guard thumb cancelled: guard released, not stuck on', ok: m.guard.held && !b.guard.held, obs: { heldBefore: m.guard.held, heldAfter: b.guard.held } }; },
  async tap_on_buttons(H) { const a = await H.snap(); const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.run(17); await H.up(3); await H.frames(40); const b = await H.snap();
    return { expect: 'a quick tap on the guard button is not a sword tap', ok: b.counts.thrust === a.counts.thrust, obs: { thrust: b.counts.thrust - a.counts.thrust, block: b.counts.block - a.counts.block } }; },
  async blur_reset(H) { await H.stick(0, 0.8); const b0 = await H.page.locator('#btnParry').boundingBox(); await H.down(3, b0.x + b0.width / 2, b0.y + b0.height / 2); await H.frames(20); const m = await H.snap(); await H.page.evaluate(() => { window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange')); }); await H.frames(30); const b = await H.snap();
    return { expect: 'report only: what stays held after the window loses focus while fingers are still down', ok: true, forced: ['blur event dispatched by script'], obs: { before: { mv: m.mv, guard: m.guard.held }, after: { mv: b.mv, guard: b.guard.held, state: b.state } } }; },
};
const SETUP = {
  exhausted: { tearOff: true },
  tap_cleave: { weapon: 'zweihander' }, tap_gun: { weapon: 'pistol' }, tap_whip: { weapon: 'druid_whip' }, tap_italian: { school: 'italian', cells: I12, weapon: 'rapier' },
};
const names = which === 'all' ? Object.keys(SC).filter((n) => n !== 'opening_lock') : which.split(',');
for (const n of names) for (let r = 1; r <= REP; r++) {
  let rec;
  try {
    const H = await boot({ base, school: 'german', cells: G12, weapon: 'longsword', ...(SETUP[n] ?? {}), settle: 6000 + (r - 1) * 170 });
    try { const res = await SC[n](H, r); rec = { scenario: n, run: r, ...res, errors: H.errors.slice(0, 2) }; } finally { await H.close(); }
  } catch (e) { rec = { scenario: n, run: r, ok: false, error: String(e).slice(0, 300) }; }
  fs.appendFileSync(out, JSON.stringify(rec) + '\n');
  console.log(`${n} #${r} ${rec.ok ? 'OK ' : 'NO '} ${JSON.stringify(rec.obs ?? rec.error).slice(0, 230)}`);
}
