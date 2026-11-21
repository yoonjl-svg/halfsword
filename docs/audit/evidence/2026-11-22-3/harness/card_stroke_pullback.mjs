// probe11.mjs — "pull back, then cut" in one touch: how fast may the pull-back be before the card's move stops coming out?
//  node probe11.mjs <baseUrl> <cell>
//  From rest, one touch: pull the finger the other way ~96 px at a set speed, wait a set number of frames, then stroke in the card's direction (6 x 24 px).
//  Fired = the move's own counter went up. Foe AI frozen; for stick cells the player is walked back to 4.5 m before every try.
import { boot } from './hlib.mjs';
const [base, cellId] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));
const ids = (p) => Array.from({ length: 12 }, (_, i) => p + (i + 1));
const DIR = { '←': [-1, 0], '↓': [0, 1], '↙': [-0.7, 0.7], '↘': [0.7, 0.7] };
const CELLS = {
  G5: { school: 'german', weapon: 'longsword', p: 'G', dir: '↙', move: 'schielhau' },
  G8: { school: 'german', weapon: 'longsword', p: 'G', dir: '←', stick: [1, 0], move: 'zwerchAbtritt' },
  B3: { school: 'iberian', weapon: 'zweihander', p: 'B', dir: '↙', stick: [1, 0], move: 'talhoRodeado' },
  J6: { school: 'japanese', weapon: 'uchigatana', p: 'J', dir: '↘', stick: [1, 0], move: 'hirakiGiri' },
  C3: { school: 'chinese', weapon: 'qinggang', p: 'C', dir: '←', move: 'yaoji' },
  C5: { school: 'chinese', weapon: 'qinggang', p: 'C', dir: '←', stick: [0, 1], move: 'chebuYaoji' },
};
const c = CELLS[cellId];
const H = await boot({ base, school: c.school, cells: ids(c.p), weapon: c.weapon });
const fired = () => H.page.evaluate(() => ({ ...(window.game.playerUnique?.stats?.fired ?? {}) }));
const [ux, uy] = DIR[c.dir];
const SPEEDS = (process.env.SPEEDS ?? '2,3,4,6,8,12').split(',').map(Number), PAUSES = (process.env.PAUSES ?? '0,6').split(',').map(Number); // pause = frames the finger stays still at the turn
for (const speed of SPEEDS) for (const pause of PAUSES) {
  const res = [];
  for (let r = 0; r < 3; r++) {
    await H.stickUp();
    for (let i = 0; i < 400 && (await H.snap()).d < 4.5; i++) { await H.stick(0, -1); await H.run(17); } await H.stickUp(); await H.frames(90);
    const f0 = await fired(); const s0 = await H.snap();
    if (c.stick) { await H.stick(c.stick[0], c.stick[1]); await H.frames(6); }
    let x = 540, y = 190;
    await H.down(2, x, y); await H.run(17);
    const n = Math.round(96 / speed);
    for (let k = 0; k < n; k++) { x -= ux * speed; y -= uy * speed; await H.moveSync(2, x, y); await H.run(17); }
    const sMid = await H.snap();
    await H.frames(pause);
    for (let k = 0; k < 6; k++) { x += ux * 24; y += uy * 24; await H.moveSync(2, x, y); await H.run(17); }
    await H.up(2); await H.frames(45);
    const f1 = await fired(); const s1 = await H.snap();
    res.push({ fired: (f1[c.move] ?? 0) - (f0[c.move] ?? 0), cutsCharged: s1.counts.cut - s0.counts.cut, cutsDuringPullBack: sMid.counts.cut - s0.counts.cut, hand: sMid.hand, d: s0.d });
  }
  out({ cell: cellId, move: c.move, pullBackPxPerFrame: speed, pullBackPxPerSec: Math.round(speed / 0.017), pullBackSec: +(Math.round(96 / speed) * 0.017).toFixed(2), pauseFrames: pause, firedOf3: res.filter((r) => r.fired > 0).length, cutsDuringPullBack: res.map((r) => r.cutsDuringPullBack), cutsCharged: res.map((r) => r.cutsCharged), handAtStroke: res[0].hand });
}
await H.close();
