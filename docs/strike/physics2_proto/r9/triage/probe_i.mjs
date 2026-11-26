// probe (i): ringRun({ring:1, dur, again:true}) (tools/sim/de_ring_feel.mjs — the helper de_dirty reads) over seeds and two durations
const T = process.argv[2];
const { ringRun } = await import(T + '/tools/sim/de_ring_feel.mjs');
const dur = +process.argv[3];
for (const seed of process.argv.slice(4).map(Number)) {
  const r = ringRun({ ring: 1, dur, again: true, seed });
  console.log(JSON.stringify({ seed, dur, tPress: r.tPress, tRing: r.tRing != null ? +r.tRing.toFixed(3) : null, again: r.again, d0: r.d0, dRing: r.dRing, dMax: r.dMax }));
}
process.exit(0);
