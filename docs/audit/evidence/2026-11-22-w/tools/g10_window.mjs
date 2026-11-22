// g10_window.mjs — German secret G10 (card: "상대와 몸이 붙은 채 1.5초 이상 밀치면(↑) 비기 활성화"):
//  when the window opens (the gold '!'), does a stroke sent right then become the secret — or is it dropped because the body is "bound" by the shove?
//  node g10_window.mjs <baseUrl> <frozen|ai> <delayFrames> <run>
//  'bound' below = the game's own bargeHeld (close_hold.js): phase 'press', hold > 0, holdT < hold.
//  The stick is held forward the whole time (that is what opens the window). When game.playerSecret.open turns true: wait <delayFrames>, then one fast stroke.
import { boot } from './hlib.mjs';
const [base, foe = 'frozen', delayS = '0', r = '1'] = process.argv.slice(2);
const ids = Array.from({ length: 12 }, (_, i) => 'G' + (i + 1));
const H = await boot({ base, school: 'german', cells: ids, weapon: 'longsword', freezeFoe: foe === 'frozen', settle: 3000 + (+r) * 170 });
const look = () => H.page.evaluate(() => { const g = window.game, p = g.player, sk = p.skill, W = g.playerSecret, b = p.barge, fb = p.foe?.barge;
  return { state: g.state, alive: p.alive, d: +p.foeDistance().toFixed(2), open: !!W?.open, ev: W?.open?.ev ?? null, name: W?.S?.name ?? null, sec: sk.sec?.stage ?? null, phase: sk.secretPhase ?? null, secret: p.stamina.counts.secret ?? 0, cut: p.stamina.counts.cut, pom: !!sk.pom,
    barge: b ? { phase: b.phase ?? null, holdT: +(b.holdT ?? 0).toFixed(2), hold: +(b.hold ?? 0).toFixed(2), bound: b.phase === 'press' && b.hold > 0 && b.holdT < b.hold } : null, foeBarge: fb ? { phase: fb.phase ?? null, bound: fb.phase === 'press' && fb.hold > 0 && fb.holdT < fb.hold } : null, lockT: +(p.closeLog?.lockT ?? 0).toFixed(2) }; });
await H.stick(0, 1); let openAt = null, s0 = null;
for (let i = 0; i < 1500; i++) { await H.run(17); const s = await look(); if (s.state !== 'fight' || !s.alive) break; if (s.open) { openAt = i; s0 = s; break; } }
let res = { foe, delayFrames: +delayS, run: +r, windowOpened: openAt != null, openedAfterSec: openAt == null ? null : +((openAt + 1) * 0.017).toFixed(2) };
if (openAt != null) {
  for (let k = 0; k < +delayS; k++) await H.run(17);
  const a = await look(); let x = 620, y = 130;
  await H.down(2, x, y); await H.run(17); for (let k = 1; k <= 4; k++) { x -= 30; y += 26; await H.moveSync(2, x, y); await H.run(17); } await H.up(2);
  let ran = null, openFrames = 0, pom = false; for (let k = 0; k < 60; k++) { await H.run(17); const t = await look(); if ((t.sec || t.phase) && !ran) ran = t.sec || t.phase; if (t.open) openFrames++; if (t.pom) pom = true; }
  const z = await look();
  res = { ...res, atOpen: { d: s0.d, name: s0.name, barge: s0.barge, foeBarge: s0.foeBarge }, atStroke: { windowStillOpen: a.open, barge: a.barge, lockSecondsSoFar: a.lockT }, secretRan: !!ran || z.secret > a.secret, stage: ran, pommelInstead: pom && !ran, cutCharged: z.cut - a.cut, lockSecondsDuring: +(z.lockT - a.lockT).toFixed(2), windowOpenFramesAfter: openFrames };
}
await H.stickUp();
console.log(JSON.stringify(res));
await H.close();
