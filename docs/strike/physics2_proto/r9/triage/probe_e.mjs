// probe (e): tsubameRun / tsubameSummary (tools/sim/schielhau_strike.mjs, the helpers the test reads) over seeds, plus a per-0.5s trace of distance / state for one seed
const T = process.argv[2];
const { tsubameRun, tsubameSummary } = await import(T + '/tools/sim/schielhau_strike.mjs');
const trace = process.env.TR ? +process.env.TR : null;
for (const s of process.argv.slice(3)) {
  const tr = [];
  const onStep = trace === +s ? (G, P) => { if (Math.round(G.t / (1 / 120)) % 60 === 0) tr.push([+G.t.toFixed(1), +P.foeDistance().toFixed(2), P.state, P.armed ? 'A' : '-', +P.stamina.value.toFixed(0), P.stamina.exhausted ? "X" : "", ["x","z"].map((k)=>+P.bodies.pelvis.translation()[k].toFixed(2)).join(","), ["x","z"].map((k)=>+G.enemy.bodies.pelvis.translation()[k].toFixed(2)).join(","), +P.move.y.toFixed(2), +P.skill.stance?.toFixed?.(2) || 0]); } : null;
  const r = tsubameRun(+s, { immortal: true, dur: 14, ghostDown: true, onStep });
  const d = tsubameSummary([r]);
  console.log(JSON.stringify({ seed: +s, combos: d.combos, fired: d.firedCombos, downContacts: d.downContacts, drawn: r.drawn, falls: r.falls, meDead: r.meDead, t: +r.t.toFixed(2) }));
  if (tr.length) for (const x of tr) console.log('   ', JSON.stringify(x));
}
process.exit(0);
