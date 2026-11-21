// probe19.mjs — "bound" time: pushing into the foe inside 1 m starts a shove; while bound (about 1.2 s) no attack should come out.
//  Foe AI frozen (forced). The player walks in with the stick held forward; once the shove is on: a tap, a fast stroke, a tap. Then, after it ends, one more tap.
import { boot } from './hlib.mjs';
const base = process.argv[2];
for (let r = 1; r <= 3; r++) {
  const H = await boot({ base });
  const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, sk = p.skill, st = p.stamina, b = p.barge; const held = !!b && Object.entries(b).filter(([k, v]) => typeof v === 'number' || typeof v === 'boolean').map(([k, v]) => k + '=' + (typeof v === 'number' ? +v.toFixed(2) : v)).join(' ');
    return { d: +p.foeDistance().toFixed(2), barge: held || null, phase: b?.phase ?? b?.stage ?? null, tap: !!sk.tap, pom: !!sk.pom, sw: !!sk.swinging, thrust: st.counts.thrust, cut: st.counts.cut, push: st.counts.push ?? 0, lockT: +(p.closeLog?.lockT ?? 0).toFixed(2) }; });
  await H.stick(0, 1); let on = null, first = null;
  for (let i = 0; i < 700; i++) { await H.run(17); const s = await look(); if (s.barge && s.push > 0 || (s.barge && /hold|lock/.test(s.barge))) { on = i; first = s; break; } if (s.barge && !first) first = s; }
  const a = await look(); const seen = { tapFrames: 0, pomFrames: 0, swingFrames: 0, framesWatched: 0 };
  const step = async (n) => { for (let k = 0; k < n; k++) { await H.run(17); const s = await look(); seen.framesWatched++; if (s.tap) seen.tapFrames++; if (s.pom) seen.pomFrames++; if (s.sw) seen.swingFrames++; } };
  await step(4); await H.down(2, 600, 190); await H.run(17); await H.up(2); await step(8);
  await H.down(2, 660, 130); await H.run(17); for (let k = 1; k <= 5; k++) { await H.moveSync(2, 660 - 24 * k, 130 + 20 * k); await H.run(17); } await H.up(2); await step(10);
  await H.down(2, 600, 190); await H.run(17); await H.up(2); await step(12);
  const b = await look();
  await H.stickUp(); for (let k = 0; k < 120; k++) await H.run(17);
  const c = await look(); await H.down(2, 600, 190); await H.run(17); await H.up(2); let after = null; for (let k = 0; k < 40; k++) { await H.run(17); const s = await look(); if (!after && (s.pom || s.tap)) after = s.pom ? 'pommel' : 'thrust'; }
  console.log(JSON.stringify({ run: r, forced: 'foe AI frozen', shoveSeenAtFrame: on, shoveState: first?.barge, dAtShove: a.d, duringBound: { thrust: b.thrust - a.thrust, cut: b.cut - a.cut, ...seen, lockSecondsCounted: +(b.lockT - a.lockT).toFixed(2) }, afterBound: { d: c.d, shove: c.barge, tapGives: after } }));
  await H.close();
}
