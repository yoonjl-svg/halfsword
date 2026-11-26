// probe (c): notoRun (tools/sim/iai_obi.mjs, the helper ⑭ reads) over seeds. usage: node probe_c.mjs <tree> <weapon> <mode> <seed...>
const T = process.argv[2];
const { notoRun } = await import(T + '/tools/sim/iai_obi.mjs');
const [weapon, mode] = process.argv.slice(3, 5);
for (const s of process.argv.slice(5)) {
  const o = notoRun({ weapon, mode, seed: +s });
  const e = o.even;
  console.log(JSON.stringify({ weapon, mode, seed: +s, entry: e?.entry, side: e?.sideEntries, sideAt: e?.sideAt?.slice(0, 2), tipStepMax: e?.tipStepMax, start: o.start, handGap: o.handGap, tipV: o.tipV, body: o.body }));
}
process.exit(0);
