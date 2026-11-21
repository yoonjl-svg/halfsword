// Merge per-process result files and print a per-run summary table (input for report.md).
// node make_report.mjs <outDir> <resultsA.json> [resultsB.json ...]   (later files win per cell)
import fs from 'node:fs';
const [outDir, ...files] = process.argv.slice(2);
const all = {};
for (const f of files) { if (!fs.existsSync(f)) continue; const r = JSON.parse(fs.readFileSync(f, 'utf8')); for (const [k, v] of Object.entries(r)) if (v && !v.error) all[k] = v; else if (!all[k]) all[k] = v; }
fs.writeFileSync(`${outDir}/results.json`, JSON.stringify(all, null, 1));
for (const [cell, v] of Object.entries(all)) {
  if (v.error) { console.log(`${cell}: ERROR ${v.error.split('\n')[0]}`); continue; }
  const canon = v.runs.filter((r) => /^canon/.test(r.label));
  const n = canon.filter((r) => r.ok === true).length, ns = canon.filter((r) => r.ok === null).length;
  console.log(`\n${cell} (${v.school}/${v.weapon}, foe ${v.foe} with ${v.foeWeapon}) canonical fired ${n}/${canon.length}${ns ? `, ${ns} not set up` : ''}`);
  for (const r of v.runs) console.log(`  - ${r.label}: ok=${r.ok}${r.setup ? ' setup=' + r.setup : ''} fired=${JSON.stringify(r.fired ?? r.oppStartsDelta ?? r.gkCountersDelta ?? '')} cls=${JSON.stringify(r.classified ? { tech: r.classified.tech, pad: r.classified.pad, dir: r.classified.dir, start: r.classified.start } : r.secondStroke ? { first: r.firstStroke?.tech, second: r.secondStroke?.tech, gap: r.gapAfterFirstEnd_s, firstLanded: r.firstLanded } : '')} hud="${(r.hudAfter ?? '').slice(0, 40)}" ${r.taps ? 'taps=' + JSON.stringify(r.taps) : ''} ${r.noThreatAtTap != null ? 'noThreat=' + r.noThreatAtTap : ''} ${r.armedAfter_s != null ? `armed=${r.armedAfter_s}s window=${r.windowAfter_s}s ran=${r.secretRan}` : ''} ${r.riso ? 'riso=' + JSON.stringify(r.riso) + ' onF=' + r.framesCoveredAndMirroring : ''} d=${r.d ?? r.dAtWindow ?? ''}`);
}
