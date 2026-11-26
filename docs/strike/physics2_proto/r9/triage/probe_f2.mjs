// probe (f2): first contact record of the tap thrust at 1.5 / 1.7 m (and gap jitter 1.45..1.75), full fields
const T = process.argv[2];
const { standTrial } = await import(T + '/tools/sim/tap_thrust.mjs');
for (const gap of process.argv.slice(3).map(Number)) {
  const r = standTrial({ gap, pad: [0.22, 0.26], foePad: [0.0, -0.5], seed: 311 + Math.round(gap * 10) });
  const f = r.first ? Object.fromEntries(Object.entries(r.first).filter(([k, v]) => typeof v !== 'object').map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v])) : null;
  console.log(gap, r.stab ? 'STAB' : '-', JSON.stringify(f), 'tipMin', r.tipMin.toFixed(3));
}
process.exit(0);
