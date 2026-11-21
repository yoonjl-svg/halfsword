// probe14.mjs — while the weapon cards are on screen (nothing equipped in the lobby -> the game deals cards: state 'draw'):
//  taps, swipes and the stick area on the game canvas — does any of it leak into the fight that follows?
//  Then one of the player's cards is tapped; taps keep coming while the cards turn; the first 90 fight frames are watched.
import { boot } from './hlib.mjs';
const base = process.argv[2];
for (let r = 1; r <= 3; r++) {
  const H = await boot({ base, weapon: null, stopAt: 'draw' });
  const st0 = await H.page.evaluate(() => window.game.state);
  const info = () => H.page.evaluate(() => { const g = window.game, p = g.player; return { state: g.state, enabled: !!g.input?.enabled, taps: g.input?.taps ?? null, thrust: p?.stamina?.counts?.thrust ?? 0, cut: p?.stamina?.counts?.cut ?? 0, tap: !!p?.skill?.tap, mv: p ? [+p.move.x.toFixed(2), +p.move.y.toFixed(2)] : null, cards: document.querySelectorAll('#draw .wcard:not(.foe)').length }; });
  await H.frames(60);
  const a = await info();
  // on the canvas, away from the cards (top-left corner and right edge), and on the stick place
  for (let k = 0; k < 4; k++) { await H.tap(40, 40); await H.frames(3); await H.tap(820, 60); await H.frames(3); }
  await H.swipe(700, 60, 600, 160, 4); await H.frames(5);
  await H.down(1, 86, 304); await H.run(17); await H.move(1, 86, 250); await H.frames(20);
  const b = await info();
  await H.up(1);
  const card = H.page.locator('#draw .wcard:not(.foe)').first(); const box = await card.boundingBox();
  let picked = false;
  for (let t = 0; t < 6 && !picked; t++) { await H.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await H.frames(20); picked = await H.page.evaluate(() => window.game.draw?.stage === 'reveal' || window.game.state === 'fight' || !!document.querySelector('#draw .wcard.picked, #draw .wcard.chosen')); }
  // keep tapping the canvas while the cards turn and the stage is built
  let n = 0, seenFight = null; const leak = { tapFrames: 0, movingFrames: 0 };
  for (let i = 0; i < 900; i++) {
    const s = await info();
    if (s.state === 'fight') { if (seenFight == null) seenFight = { atLoop: i, thrustAtFirstFightFrame: s.thrust, cut: s.cut, tapOn: s.tap, mv: s.mv, inputTaps: s.taps }; if (i - seenFight.atLoop >= 90) break; if (s.tap) leak.tapFrames++; if (s.mv && (s.mv[0] || s.mv[1])) leak.movingFrames++; await H.run(17); continue; }
    if (i % 6 === 0) { await H.tap(40, 40); n++; } else await H.run(17);
  }
  const z = await info();
  console.log(JSON.stringify({ run: r, stateAtStart: st0, cardsShown: a.cards, duringCards: { inputEnabled: b.enabled, thrust: b.thrust - a.thrust, cut: b.cut - a.cut, mv: b.mv, tapsHeldByInput: b.taps }, tapsSentWhileCardsTurn: n, firstFightFrame: seenFight, first90FightFrames: leak, end: { state: z.state, thrust: z.thrust, cut: z.cut }, errors: H.errors.slice(0, 2) }));
  await H.close();
}
