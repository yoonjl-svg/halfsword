// probe (e5): tsubameRun with a longer dur — when does the first combo start, and how many combos/fired
const T = process.argv[2];
const { tsubameRun, tsubameSummary } = await import(T + '/tools/sim/schielhau_strike.mjs');
for (const s of process.argv.slice(4)) { const r = tsubameRun(+s, { immortal: true, dur: +process.argv[3], ghostDown: true }); const d = tsubameSummary([r]); console.log(JSON.stringify({ seed: +s, dur: +process.argv[3], combos: d.combos, fired: d.firedCombos, downContacts: d.downContacts, t0: r.rows.map((x) => +x.t0.toFixed(2)), falls: r.falls })); }
process.exit(0);
