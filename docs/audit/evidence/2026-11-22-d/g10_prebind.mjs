// g10_prebind.mjs — the other half of the 11/22 rule: while bound by the shove and the secret window is NOT open, is an attack input still dropped?
//  node g10_prebind.mjs <baseUrl> <stroke|tap> <delayFrames> <run>
//  German + longsword, frozen foe. Stick held forward. The moment the game's own bargeHeld turns true (window still closed): wait <delayFrames>, send one fast stroke (or one tap), watch 30 frames.
import { boot } from './hlib.mjs';
const [base, kind = 'stroke', delayS = '0', r = '1'] = process.argv.slice(2);
const ids = Array.from({ length: 12 }, (_, i) => 'G' + (i + 1));
const H = await boot({ base, school: 'german', cells: ids, weapon: 'longsword', freezeFoe: true, settle: 3000 + (+r) * 170 });
const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, sk = p.skill, W = g.playerSecret, b = p.barge;
  return { state: g.state, alive: p.alive, open: !!W?.open, sec: sk.sec?.stage ?? null, phase: sk.secretPhase ?? null, pom: !!sk.pom, tap: !!sk.tap, counts: { ...p.stamina.counts },
    bound: !!b && b.phase === 'press' && b.hold > 0 && b.holdT < b.hold, holdT: b ? +(b.holdT ?? 0).toFixed(2) : null, hold: b ? +(b.hold ?? 0).toFixed(2) : null, lockAtk: p.closeLog?.lockAtk ?? 0, lockSecret: p.closeLog?.lockSecret ?? 0 }; });
await H.stick(0, 1); let at = null;
for (let i = 0; i < 1500; i++) { await H.run(17); const s = await look(); if (s.state !== 'fight' || !s.alive || s.open) break; if (s.bound) { at = s; break; } }
let res = { kind, delayFrames: +delayS, run: +r, boundSeen: !!at };
if (at) {
  for (let k = 0; k < +delayS; k++) await H.run(17);
  const a = await look(); let x = 620, y = 130;
  if (kind === 'tap') { await H.down(2, x, y); await H.run(17); await H.run(17); await H.up(2); }
  else { await H.down(2, x, y); await H.run(17); for (let k = 1; k <= 4; k++) { x -= 30; y += 26; await H.moveSync(2, x, y); await H.run(17); } await H.up(2); }
  const b = await look(); // right after the input — still bound?
  let sec = null, pom = false, tap = false, opened = false, boundFrames = 0;
  for (let k = 0; k < 30; k++) { await H.run(17); const t = await look(); if (t.sec || t.phase) sec = t.sec || t.phase; if (t.pom) pom = true; if (t.tap) tap = true; if (t.open) opened = true; if (t.bound) boundFrames++; }
  const z = await look(); const diff = {}; for (const k of Object.keys(z.counts)) if ((z.counts[k] ?? 0) !== (a.counts[k] ?? 0)) diff[k] = (z.counts[k] ?? 0) - (a.counts[k] ?? 0);
  res = { ...res, atInput: { bound: a.bound, holdT: a.holdT, hold: a.hold, windowOpen: a.open }, afterInput: { bound: b.bound, windowOpen: b.open }, secretRan: !!sec, pommel: pom, thrust: tap, countsChanged: diff, lockAtk: z.lockAtk - a.lockAtk, lockSecret: z.lockSecret - a.lockSecret, windowOpenedWhileWatching: opened, boundFramesWhileWatching: boundFrames };
}
await H.stickUp(); console.log(JSON.stringify(res)); await H.close();
