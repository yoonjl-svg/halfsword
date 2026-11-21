// probe10.mjs — tap on a foe lying down: does the plunge start, and when it does not, which condition said no?
//  Foe AI frozen · foe knocked down by script and kept down (forced). The player walks to a distance, the foe is knocked down, 2 s wait, one tap.
//  Read at the tap: player.finish (on · canStart · target in my frame [fwd, up, side] · plunge.surfaceInside · surfaceWalk), body heights.
import { boot } from './hlib.mjs';
const [base, weapon = 'longsword', school = 'german'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));
for (const D of [0.8, 1.2, 1.6, 2.0]) for (let r = 1; r <= 4; r++) {
  const H = await boot({ base, weapon, school });
  await H.stick(0, 0.8); for (let i = 0; i < 600; i++) { await H.run(17); if ((await H.snap()).d <= D) break; } await H.stickUp(); await H.frames(15 + r * 6);
  await H.page.evaluate(() => { const e = window.game.enemy; e.knockDown(true); e.downTime = 1e9; }); await H.frames(120);
  const diag = await H.page.evaluate(() => { const g = window.game, p = g.player, e = g.enemy, f = p.finish, pl = f?.plunge; const y = (b) => +e.bodies[b].translation().y.toFixed(2);
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation(), ep = e.bodies.pelvis.translation(); const h = (a) => +Math.hypot(a.x - pc.x, a.z - pc.z).toFixed(2);
    return { on: !!f?.on, canStart: !!f?.canStart, amt: +(f?.amt ?? 0).toFixed(2), target: f?.target ? [...f.target].map((v) => +v.toFixed(2)) : null, surfaceInside: !!pl?.surfaceInside, surfaceWalk: !!pl?.surfaceWalk, surfaceShort: +(pl?.surfaceShort ?? 0).toFixed(2), foeChestY: y('chest'), foePelvisY: y('pelvis'), myChestY: +pc.y.toFixed(2), flatToFoeChest: h(ec), flatToFoePelvis: h(ep) }; });
  const a = await H.snap(); await H.tap(620, 200);
  const seen = { down: 0, tap: 0, vital: 0, pom: 0 }; let firstTap = null;
  for (let k = 0; k < 200; k++) { await H.run(17); const s = await H.snap(); if (s.tap) { seen.tap++; if (firstTap == null) firstTap = k; if (s.tap.down) seen.down++; if (s.tap.vital) seen.vital++; } if (s.pom) seen.pom++; }
  const b = await H.snap();
  const kind = seen.down ? (firstTap > 3 ? 'walks, then plunge' : 'plunge') : seen.pom ? 'pommel' : seen.tap ? 'plain thrust' : 'nothing';
  out({ weapon, wantD: D, run: r, dAtTap: a.d, foeState: a.es, result: kind, firstTapFrame: firstTap, ...diag, dAfter: b.d });
  await H.close();
}
