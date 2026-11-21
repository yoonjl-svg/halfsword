// probe18.mjs — tap on a KNEELING foe: how long from the tap to the thrust, and how did the "walk into range first" step end?
//  Forced: foe AI frozen, and the foe's two legs set to 0.2 health (below the 0.25 line) so it sinks and stays kneeling —
//  a state a real fight reaches by wounding the legs. One tap per boot, then 170 frames with no other input.
//  node probe18.mjs <baseUrl> <distance> <run> [weapon school]
import { boot } from './hlib.mjs';
const [base, D = '1.5', r = '1', weapon = 'longsword', school = 'german'] = process.argv.slice(2);
const H = await boot({ base, weapon, school });
const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, e = g.enemy, sk = p.skill, st = p.stamina; const tp = sk.tap;
  return { ps: p.state, es: e.state, d: +p.foeDistance().toFixed(2), tap: !!tp, vital: !!tp?.vital, down: !!tp?.down, pom: !!sk.pom, vr: !!sk.vitalRange, last: sk.lastVitalRange ?? null, ends: sk.vitalRangeEnds ? { ...sk.vitalRangeEnds } : null, thrust: st.counts.thrust, foeChestY: +e.bodies.chest.translation().y.toFixed(2) }; });
await H.stick(0, 0.8); for (let i = 0; i < 600; i++) { await H.run(17); if ((await H.snap()).d <= +D) break; } await H.stickUp(); await H.frames(10 + (+r) * 7);
await H.page.evaluate(() => { const e = window.game.enemy; e.limbs.legF = 0.2; e.limbs.legB = 0.2; });
let st = null; for (let i = 0; i < 900; i++) { await H.run(17); st = (await look()).es; if (st === 'kneel') break; } await H.frames(40);
const s0 = await look(); await H.down(2, 600, 190); await H.run(17); await H.up(2);
let vrFrames = 0, startAt = null, what = null;
for (let k = 0; k < 170; k++) { await H.run(17); const t = await look(); if (t.vr) vrFrames++; if (t.tap && startAt == null) { startAt = k; what = t.down ? 'plunge' : t.vital ? 'vital thrust' : 'plain thrust'; } if (t.pom && startAt == null) { startAt = k; what = 'pommel'; } }
const z = await look();
console.log(JSON.stringify({ forced: 'foe AI frozen · foe leg health set to 0.2', weapon, wantD: +D, run: +r, at: { es: s0.es, d: s0.d, foeChestY: s0.foeChestY }, walkIntoRangeSec: +(vrFrames * 0.017).toFixed(2), thrustStartedAfterSec: startAt == null ? null : +((startAt + 1) * 0.017).toFixed(2), what, howRangeStepEnded: z.ends, thrustCharged: z.thrust - s0.thrust, dAfter: z.d }));
await H.close();
