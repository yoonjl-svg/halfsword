// probe (f): the 'now' arm of wrist_audit '10/24 17:2x 뒤 탭 찌르기' — standTrial over the five gaps, with seed base offsets (pinned base = 311)
const T = process.argv[2];
const { standTrial } = await import(T + '/tools/sim/tap_thrust.mjs');
const { wristSample } = await import(T + '/tools/sim/wrist_audit.mjs');
for (const base of process.argv.slice(3).map(Number)) {
  const rows = [];
  for (const gap of [1.5, 1.7, 1.9, 2.1, 2.3]) {
    let hold = null;
    const r = standTrial({ gap, pad: [0.22, 0.26], foePad: [0.0, -0.5], seed: base + Math.round(gap * 10), before: (G) => { const st = G.step.bind(G); G.step = () => { st(); const tp = G.player.skill.tap; if (tp && !hold && tp.t >= tp.K.aim + tp.K.extend) hold = wristSample(G.player); }; } });
    rows.push([gap, r.stab ? 'S' : '.', r.first?.type ?? '-', r.first?.zone ?? r.first?.part ?? '', +r.tipMin.toFixed(3), +(r.fwdGap ?? NaN).toFixed(3), +r.step.toFixed(2), r.clashed ? 'clash' : '', hold ? Math.round(hold.dev) : null]);
  }
  console.log(JSON.stringify({ base, stab: rows.filter((x) => x[1] === 'S').length, rows }));
}
process.exit(0);
