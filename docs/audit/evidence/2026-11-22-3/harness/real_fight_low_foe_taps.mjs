// probe17.mjs — tap on a foe who is kneeling or getting up in a real fight (nothing forced): how long from the tap to the thrust,
//  and how did the "walk into range first" step end?  (probe16 sent a stroke 0.6 s after every tap, which calls that step off — so it could not tell.)
//  The fight runs with taps and strokes in turn until the foe kneels or is getting up; from then on only single taps, each watched for 170 frames with no other input.
import { boot } from './hlib.mjs';
const [base, weapon = 'longsword', school = 'german', no = '1'] = process.argv.slice(2);
const H = await boot({ base, weapon, school, freezeFoe: false, settle: 3000 });
const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, e = g.enemy, sk = p.skill, st = p.stamina; const tp = sk.tap;
  return { state: g.state, ps: p.state, es: e.state, alive: p.alive, foeAlive: e.alive, d: +p.foeDistance().toFixed(2), tap: !!tp, vital: !!tp?.vital, down: !!tp?.down, pom: !!sk.pom, vr: !!sk.vitalRange, last: sk.lastVitalRange ?? null, thrust: st.counts.thrust }; });
let dirFlip = 1, kind = 'tap', n = 0;
for (let f = 0; f < 6000 && n < 12; f++) {
  await H.run(17);
  if (f % 10 === 0) { const s = await look(); if (s.state !== 'fight' || !s.alive || !s.foeAlive) break;
    if ((s.es === 'kneel' || s.es === 'getup') && s.ps === 'stand' && !s.tap && !s.pom && !s.vr) {
      const s0 = s; await H.down(2, 600, 190); await H.run(17); await H.up(2);
      let vrFrames = 0, startAt = null, what = null, endLast = null;
      for (let k = 0; k < 170; k++) { await H.run(17); const t = await look(); if (t.vr) vrFrames++; if (t.tap && startAt == null) { startAt = k; what = t.down ? 'plunge' : t.vital ? 'vital thrust' : 'plain thrust'; endLast = t.last; } if (t.pom && startAt == null) { startAt = k; what = 'pommel'; } if (t.state !== 'fight' || !t.alive) break; }
      const z = await look(); n++;
      console.log(JSON.stringify({ fight: +no, weapon, tapNo: n, at: { es: s0.es, d: s0.d }, walkIntoRangeFrames: vrFrames, thrustStartedAfterSec: startAt == null ? null : +((startAt + 1) * 0.017).toFixed(2), what, howRangeStepEnded: endLast ?? z.last, thrustCharged: z.thrust - s0.thrust, foeAfter: z.es, dAfter: z.d }));
      f += 172; continue;
    } }
  if (f % 50 !== 25) continue;
  if (kind === 'tap') { await H.down(2, 600, 190); await H.run(17); await H.up(2); f += 1; }
  else { const x0 = dirFlip > 0 ? 660 : 540, x1 = dirFlip > 0 ? 540 : 660; dirFlip = -dirFlip; await H.down(2, x0, 130); await H.run(17); for (let k = 1; k <= 5; k++) { await H.moveSync(2, x0 + (x1 - x0) * k / 5, 130 + 20 * k); await H.run(17); } await H.up(2); f += 6; }
  kind = kind === 'tap' ? 'stroke' : 'tap';
}
const end = await look();
console.log(JSON.stringify({ fight: +no, weapon, end: { state: end.state, alive: end.alive, foeAlive: end.foeAlive }, tapsAtLowFoe: n }));
await H.close();
