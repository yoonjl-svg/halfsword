import { boot } from './hlib.mjs';
const H = await boot({ base: process.argv[2], cells: ['G1'], weapon: 'longsword' });
const q = () => H.page.evaluate(() => { const g = window.game, p = g.player; const R = p.run; return { reach: +(p.runReach ?? -1).toFixed(2), mv: [p.move.x, p.move.y].map((v) => +v.toFixed(2)), run: R ? { on: R.on, armed: R.armed, hold: +R.hold.toFixed(2), end: R.end } : null, stam: +p.stamina.value.toFixed(0), fightT: +(p.fightT ?? 0).toFixed(1), locked: p.footLock ?? p.rooted ?? null }; });
for (const [fx, fy, label] of [[0, 1, 'fwd full'], [0, -1, 'back full'], [1, 0, 'right full']]) {
  await H.stick(fx, fy); const out = []; for (let i = 0; i < 200; i++) { await H.run(17); if (i % 40 === 39) out.push(await q()); } console.log(label, JSON.stringify(out)); await H.stickUp(); await H.frames(90);
}
await H.close();
