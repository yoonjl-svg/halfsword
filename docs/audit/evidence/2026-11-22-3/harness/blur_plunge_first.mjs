// probe8.mjs — two more looks
//  node probe8.mjs <baseUrl> <part>     part = blur | plunge
//   blur   : the window loses focus (a call, a banner — here a blur event sent by script) while three fingers are down; the player comes back
//            and taps 'resume' with the fingers never lifted. What still works, and what does the guard button show?
//   plunge : tap on a foe lying down, from several distances (foe knocked down by script and kept down) -> plunge / plain thrust / walk-then-plunge
import { boot } from './hlib.mjs';
const [base, part = 'blur'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));

if (part === 'blur') {
  for (let r = 1; r <= 2; r++) {
    const H = await boot({ base });
    const g = await H.page.locator('#btnParry').boundingBox();
    await H.stick(0, 0.8); await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.down(2, 560, 200); await H.frames(20);
    const m = await H.snap(); const lit0 = await H.page.evaluate(() => document.getElementById('btnParry').classList.contains('on'));
    await H.page.evaluate(() => window.dispatchEvent(new Event('blur'))); await H.frames(30);
    const p = await H.snap();
    const rb = H.page.locator('#btnResume'); const vis = await rb.isVisible().catch(() => false); let resumed = false;
    if (vis) { const b = await rb.boundingBox(); await H.down(6, b.x + b.width / 2, b.y + b.height / 2); await H.run(17); await H.up(6); resumed = true; }
    await H.frames(40);
    const a = await H.snap(); const lit1 = await H.page.evaluate(() => document.getElementById('btnParry').classList.contains('on'));
    // fingers still down: wiggle the stick thumb and the sword finger
    await H.move(1, H.SC.x, H.SC.y - H.SC.r * 0.9); await H.move(2, 600, 220); await H.frames(20);
    const w = await H.snap();
    // lift and press again
    await H.up(1); await H.up(2); await H.up(3); await H.frames(10);
    await H.stick(0, 0.8); await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(20);
    const z = await H.snap(); await H.up(3); await H.stickUp();
    out({ part, run: r, forced: 'blur event sent by script', before: { mv: m.mv, guardHeld: m.guard.held, guardLit: lit0, handHeld: m.handHeld }, pausedState: p.state, resumeButtonSeen: vis, afterResume_fingersNeverLifted: { state: a.state, mv: a.mv, guardHeld: a.guard.held, guardLit: lit1, handHeld: a.handHeld }, afterWiggle: { mv: w.mv, handHeld: w.handHeld, guardHeld: w.guard.held }, afterLiftAndPressAgain: { mv: z.mv, guardHeld: z.guard.held } });
    await H.close();
  }
}

if (part === 'plunge') {
  for (const D of [0.45, 0.7, 0.95, 1.2, 1.5, 1.9, 2.4]) for (let r = 1; r <= 2; r++) {
    const H = await boot({ base });
    await H.stick(0, 0.8); for (let i = 0; i < 600; i++) { await H.run(17); if ((await H.snap()).d <= D) break; } await H.stickUp(); await H.frames(20);
    await H.page.evaluate(() => { const e = window.game.enemy; e.knockDown(true); e.downTime = 1e9; }); await H.frames(90 + r * 15);
    const a = await H.snap(); await H.tap(620, 200);
    const seen = { down: 0, tap: 0, vital: 0, pom: 0 }; let firstTap = null, walk = 0;
    for (let k = 0; k < 200; k++) { await H.run(17); const s = await H.snap(); if (s.tap) { seen.tap++; if (firstTap == null) firstTap = k; if (s.tap.down) seen.down++; if (s.tap.vital) seen.vital++; } if (s.pom) seen.pom++; }
    const b = await H.snap();
    const kind = seen.down ? (firstTap > 3 ? 'walks, then plunge' : 'plunge') : seen.pom ? 'pommel' : seen.tap ? 'plain thrust' : 'nothing';
    out({ part, wantD: D, run: r, forced: 'foe AI frozen · foe knocked down and kept down', dAtTap: a.d, foeState: a.es, result: kind, firstTapFrame: firstTap, seen, dAfter: b.d, thrustCharged: b.counts.thrust - a.counts.thrust });
    await H.close();
  }
}
