// probe16.mjs — in a real fight (foe AI running, nothing forced): of the taps and strokes a player sends, how many become an action,
//  and when one does not, what was the player's body doing at that moment?
//  node probe16.mjs <baseUrl> <weapon> <school> <fightNo>
//  One input every 50 frames (0.85 s — slower than the tap beat that loses taps), tap and stroke in turn, strokes alternate direction.
//  "Became an action" = within 12 frames a thrust / pommel strike / plunge / secret starts (tap), or within 25 frames a cut is charged
//  or a secret / pommel strike starts (stroke).
import { boot } from './hlib.mjs';
const [base, weapon = 'longsword', school = 'german', no = '1'] = process.argv.slice(2);
const H = await boot({ base, weapon, school, freezeFoe: false, settle: 3000 });
const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, e = g.enemy, sk = p.skill, st = p.stamina;
  return { state: g.state, ps: p.state, es: e.state, alive: p.alive, foeAlive: e.alive, armed: p.armed, d: +p.foeDistance().toFixed(2), tap: !!sk.tap, pom: !!sk.pom, sw: !!sk.swinging, sec: sk.secretPhase ?? null, secOpen: !!g.playerSecret?.open,
    thrust: st.counts.thrust, cut: st.counts.cut, secret: st.counts.secret ?? 0, autoPick: !!p.autoPick, exhausted: !!st.exhausted, hitStop: g.hitStop?.left > 0, roundOver: !!g.roundOver, hp: p.hp ?? null }; });
const recs = []; let dirFlip = 1, kind = 'tap';
for (let f = 0; f < 4200; f++) {
  await H.run(17);
  if (f % 50 !== 25) { if (f % 10 === 0) { const s = await look(); if (s.state !== 'fight' || !s.alive || !s.foeAlive) break; } continue; }
  const s0 = await look(); if (s0.state !== 'fight' || !s0.alive || !s0.foeAlive) break;
  let acted = null;
  if (kind === 'tap') {
    await H.down(2, 600, 190); await H.run(17); await H.up(2);
    for (let k = 0; k < 12 && !acted; k++) { await H.run(17); const s = await look(); if (s.thrust > s0.thrust) acted = 'thrust'; else if (s.pom && !s0.pom) acted = 'pommel'; else if (s.tap && !s0.tap) acted = 'tap move'; else if (s.sec && !s0.sec) acted = 'secret'; else if (s.secret > s0.secret) acted = 'secret'; }
    f += 13;
  } else {
    const x0 = dirFlip > 0 ? 660 : 540, x1 = dirFlip > 0 ? 540 : 660; dirFlip = -dirFlip;
    await H.down(2, x0, 130); await H.run(17); for (let k = 1; k <= 5; k++) { await H.moveSync(2, x0 + (x1 - x0) * k / 5, 130 + 20 * k); await H.run(17); } await H.up(2);
    for (let k = 0; k < 25 && !acted; k++) { await H.run(17); const s = await look(); if (s.cut > s0.cut) acted = 'cut'; else if (s.pom && !s0.pom) acted = 'pommel'; else if (s.sec && !s0.sec) acted = 'secret'; else if (s.secret > s0.secret) acted = 'secret'; }
    f += 31;
  }
  recs.push({ fight: +no, weapon, f, kind, acted, at: { ps: s0.ps, es: s0.es, d: s0.d, armed: s0.armed, tapBusy: s0.tap, pomBusy: s0.pom, swinging: s0.sw, sec: s0.sec, secOpen: s0.secOpen, autoPick: s0.autoPick, exhausted: s0.exhausted, hitStop: s0.hitStop, roundOver: s0.roundOver } });
  console.log(JSON.stringify(recs.at(-1)));
  kind = kind === 'tap' ? 'stroke' : 'tap';
}
const end = await look();
console.log(JSON.stringify({ fight: +no, weapon, end: { state: end.state, alive: end.alive, foeAlive: end.foeAlive }, inputs: recs.length, acted: recs.filter((r) => r.acted).length, errors: H.errors.slice(0, 2) }));
await H.close();
