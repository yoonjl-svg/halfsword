// probe5.mjs — two more looks
//  node probe5.mjs <baseUrl> <part>     part = cadence | blocked
//   cadence : eight taps at a fixed beat -> how many become thrusts (a tap that lands while the last thrust is still going is dropped, not kept)
//   blocked : the player's own body cannot act (lying down / sword dropped) -> do tap, swipe, stick and guard leak
import { boot, sleep } from './hlib.mjs';
const [base, part = 'cadence'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));

if (part === 'cadence') {
  // counts what STARTED (thrust or, at hilt distance, pommel strike), and keeps the distance: each thrust steps forward, so walk back between beats
  for (const weapon of ['longsword', 'rapier', 'zweihander']) {
    const H = await boot({ base, weapon, school: weapon === 'rapier' ? 'italian' : weapon === 'zweihander' ? 'iberian' : 'german' });
    for (const gap of [10, 14, 18, 22, 26, 30, 34, 38, 44, 50, 60]) {
      for (let i = 0; i < 400 && (await H.snap()).d < 4.5; i++) { await H.stick(0, -1); await H.run(17); } await H.stickUp(); await H.frames(90);
      const a = await H.snap(); let starts = 0, was = false, poms = 0, wasP = false;
      const look = async () => { const s = await H.snap(); const on = !!s.tap; if (on && !was) starts++; was = on; if (s.pom && !wasP) poms++; wasP = s.pom; };
      for (let i = 0; i < 8; i++) { await H.down(2, 620, 200); await H.run(17); await look(); await H.up(2); for (let k = 0; k < gap - 1; k++) { await H.run(17); await look(); } }
      for (let k = 0; k < 60; k++) { await H.run(17); await look(); }
      const b = await H.snap();
      out({ part, weapon, gapMs: gap * 17, taps: 8, thrustsStarted: starts, pommelStarted: poms, thrustCharged: b.counts.thrust - a.counts.thrust, d0: a.d, d1: b.d });
    }
    await H.close();
  }
}

if (part === 'blocked') {
  for (const what of ['down', 'dropped']) for (let r = 1; r <= 3; r++) {
    const H = await boot({ base });
    const g = await H.page.locator('#btnParry').boundingBox();
    if (what === 'down') await H.page.evaluate(() => window.game.player.knockDown(true));
    if (what === 'dropped') await H.page.evaluate(() => window.game.player.dropSword());
    await H.frames(12 + r * 10);
    const a = await H.snap(); const p0 = await H.page.evaluate(() => { const t = window.game.player.bodies.chest.translation(); return [t.x, t.z]; });
    await H.tap(620, 200); await H.frames(8);
    await H.swipe(680, 120, 560, 260, 4); await H.frames(8);
    await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(10); const m = await H.snap(); await H.up(3);
    await H.stick(1, 0); await H.frames(40); const n = await H.snap(); const p1 = await H.page.evaluate(() => { const t = window.game.player.bodies.chest.translation(); return [t.x, t.z]; }); await H.stickUp();
    let back = null; for (let i = 0; i < 700; i++) { await H.run(17); const s = await H.snap(); if (what === 'down' ? s.ps === 'stand' : s.grip !== undefined && (await H.page.evaluate(() => window.game.player.armed))) { back = +((i + 1) * 0.017).toFixed(1); break; } }
    const z = await H.snap();
    out({ part, what, run: r, forced: what === 'down' ? 'player knocked down once' : 'player sword dropped once', stateAtInput: a.ps, autoPickAtInput: a.autoPick, thrust: n.counts.thrust - a.counts.thrust, cut: n.counts.cut - a.counts.cut, guardHeld: m.guard?.held, guardName: m.guardName, stickMv: n.mv, bodyMovedM: +Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2), secToBack: back, thrustAfter: z.counts.thrust - a.counts.thrust });
    await H.close();
  }
}
