// probe (c2): tip path near the mouth during sheathing (notoRun keepTrace) — y = along scabbard axis past the mouth (m), e = ellipse ratio, tip in pelvis frame
const T = process.argv[2];
const { notoRun } = await import(T + '/tools/sim/iai_obi.mjs');
for (const weapon of process.argv.slice(3)) {
  const o = notoRun({ weapon, mode: 'hip', seed: 1, keepTrace: true });
  const tr = o.trace; const k = tr.findIndex((r, i) => i > 0 && r.inside && !tr[i - 1].inside);
  console.log(weapon, 'entry', JSON.stringify(o.even.entry), 'handGap', o.handGap);
  for (const r of tr.slice(Math.max(0, k - 5), k + 2)) console.log('  t', r.t.toFixed(3), 'y', r.y.toFixed(3), 'e', r.e.toFixed(2), 'tip', [r.tip.x, r.tip.y, r.tip.z].map((v) => v.toFixed(3)).join(','), 'mouth', [r.mouth.x, r.mouth.y, r.mouth.z].map((v) => v.toFixed(3)).join(','));
}
process.exit(0);
