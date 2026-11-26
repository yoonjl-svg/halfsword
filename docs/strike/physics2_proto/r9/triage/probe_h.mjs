// probe (h): body of jp_gait.test.mjs '일본 서 있는 자세' — stance length (front-back plant distance along heading) every 0.5 s, plus plant events
const T = process.argv[2];
const { newRound, DT } = await import(T + '/tools/sim/harness_m.mjs');
for (const seed of process.argv.slice(3)) {
  const G = newRound({ walls: false, seed: +seed, weapon: 'uchigatana', weapon2: 'longsword', gap: 20 });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  const Ls = []; let plants = 0, prevF = null, prevB = null;
  for (let i = 0; i < Math.round((+process.env.DUR || 8) / DT); i++) {
    P.move.set(0, 0); G.step();
    const g = P.gait, h = P.heading, fx = Math.cos(h), fz = -Math.sin(h);
    const kF = `${g.legs.F.plant.x.toFixed(3)},${g.legs.F.plant.z.toFixed(3)}`, kB = `${g.legs.B.plant.x.toFixed(3)},${g.legs.B.plant.z.toFixed(3)}`;
    if (prevF && kF !== prevF) plants++; if (prevB && kB !== prevB) plants++; prevF = kF; prevB = kB;
    if ((i + 1) % 60 === 0) Ls.push(+Math.abs((g.legs.F.plant.x - g.legs.B.plant.x) * fx + (g.legs.F.plant.z - g.legs.B.plant.z) * fz).toFixed(3));
  }
  console.log(JSON.stringify({ seed: +seed, L_every_0_5s: Ls, plantMoves: plants }));
  G.world.free();
}
process.exit(0);
