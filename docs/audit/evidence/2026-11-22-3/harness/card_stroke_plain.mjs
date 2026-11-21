// probe9.mjs — the card's stroke, done the way a player who has only read the card would do it (no knowledge of where the hand must start).
//  For each stroke cell, from rest (no touch for 1.5 s), three ways:
//   plain    : put the finger down and stroke in the card's direction
//   pullback : one touch — pull the other way first (slow, ~100 px), then stroke in the card's direction
//   placed   : (what the testers did) slide the hand slowly to the start place the code wants, then stroke
//  Fired = the move's own counter went up (game.playerUnique.stats.fired). Foe AI frozen (far away) — strokes do not need the foe.
import { boot } from './hlib.mjs';
const [base, only] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));
const ids = (p) => Array.from({ length: 12 }, (_, i) => p + (i + 1));
const DIR = { '←': [-1, 0], '↓': [0, 1], '↙': [-0.7, 0.7], '↘': [0.7, 0.7] };
const CELLS = [
  { cell: 'G5', school: 'german', weapon: 'longsword', p: 'G', dir: '↙', move: 'schielhau', card: '사선 긋기(↙)', place: [70, -70] },
  { cell: 'G8', school: 'german', weapon: 'longsword', p: 'G', dir: '←', stick: [1, 0], move: 'zwerchAbtritt', card: '좌우 이동(←/→)과 동시에 수평 긋기(←)', place: [90, 0] },
  { cell: 'I7', school: 'italian', weapon: 'rapier', p: 'I', dir: '↓', move: 'imbroccata', card: '아래로 내려 긋기(↓/↙/↘)', place: [0, -60] },
  { cell: 'B3', school: 'iberian', weapon: 'zweihander', p: 'B', dir: '↙', stick: [1, 0], move: 'talhoRodeado', card: '좌우 이동(←/→)과 동시에 사선 긋기(↙)', place: [70, -70] },
  { cell: 'J7', school: 'japanese', weapon: 'uchigatana', p: 'J', dir: '↓', short: true, move: 'kote', card: '가운데서 짧게 수직 긋기(↓)', place: [0, 0] },
  { cell: 'J6', school: 'japanese', weapon: 'uchigatana', p: 'J', dir: '↘', stick: [1, 0], move: 'hirakiGiri', card: '좌우 이동(←/→)과 동시에 사선 긋기(↘)', place: [-70, -70] },
  { cell: 'C3', school: 'chinese', weapon: 'qinggang', p: 'C', dir: '←', move: 'yaoji', card: '수평 긋기(←)', place: [90, 0] },
  { cell: 'C5', school: 'chinese', weapon: 'qinggang', p: 'C', dir: '←', stick: [0, 1], move: 'chebuYaoji', card: '앞으로 이동(↑)과 동시에 수평 긋기(←)', place: [90, 0] },
].filter((c) => !only || only.split(',').includes(c.cell));
let H = null, cur = null;
for (const c of CELLS) {
  if (cur !== c.school) { if (H) await H.close(); H = await boot({ base, school: c.school, cells: ids(c.p), weapon: c.weapon }); cur = c.school; }
  const fired = () => H.page.evaluate(() => ({ ...(window.game.playerUnique?.stats?.fired ?? {}) }));
  const list = await H.page.evaluate(() => (window.game.playerUnique?.list ?? []).map((e) => e.name));
  const [ux, uy] = DIR[c.dir]; const n = c.short ? 3 : 6;
  for (const way of ['plain', 'pullback', 'placed']) {
    const res = [];
    for (let r = 0; r < 3; r++) {
      await H.stickUp(); await H.frames(90);
      const f0 = await fired(); const s0 = await H.snap();
      if (c.stick) { await H.stick(c.stick[0], c.stick[1]); await H.frames(6); }
      let x = 540, y = 190;
      await H.down(2, x, y); await H.run(17);
      if (way === 'pullback') for (let k = 0; k < 12; k++) { x -= ux * 8; y -= uy * 8; await H.move(2, x, y); await H.run(17); }
      if (way === 'placed') { for (let k = 0; k < 30; k++) { x += c.place[0] / 30; y += c.place[1] / 30; await H.move(2, x, y); await H.run(17); } await H.frames(4); }
      const h1 = (await H.snap()).hand;
      for (let k = 0; k < n; k++) { x += ux * 24; y += uy * 24; await H.move(2, x, y); await H.run(17); }
      await H.up(2); await H.frames(45);
      const f1 = await fired(); const s1 = await H.snap();
      res.push({ fired: (f1[c.move] ?? 0) - (f0[c.move] ?? 0), other: Object.keys(f1).filter((k) => k !== c.move && (f1[k] ?? 0) > (f0[k] ?? 0)), handAtStroke: h1, cut: s1.counts.cut - s0.counts.cut, cue: s1.cue });
    }
    out({ cell: c.cell, card: c.card, move: c.move, learned: list, way, firedOf3: res.filter((r) => r.fired > 0).length, runs: res });
  }
}
if (H) await H.close();
