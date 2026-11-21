// v_summary.mjs <outDir> : stage-change / same-stage / first-start longest frame per run, base vs variant
import fs from 'node:fs';
const dir = process.argv[2];
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
for (const tag of ['v_base', 'v_nock']) {
  const all = { stageChange: [], sameStage: [], firstStart: [] }, rest = [], own = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(tag + '_')).sort()) {
    const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    const row = [];
    for (const e of j.events) {
      all[e.kind].push(e.longestMs);
      if (e.kind === 'stageChange') { const o = e.after.buildMs + e.after.warmMs; own.push(o); rest.push(e.longestMs - o); row.push(`${e.to}:${e.longestMs.toFixed(0)}(${o.toFixed(0)})`); }
      else row.push(`${e.kind}:${e.longestMs.toFixed(0)}`);
    }
    console.log(f, row.join('  '), j.errors.length ? 'ERR ' + j.errors[0] : '');
  }
  for (const k of Object.keys(all)) if (all[k].length) console.log(`  ${tag} ${k}: n=${all[k].length} median ${med(all[k]).toFixed(0)} range ${Math.min(...all[k]).toFixed(0)}-${Math.max(...all[k]).toFixed(0)}`);
  if (own.length) console.log(`  ${tag} own counters build+warm: median ${med(own).toFixed(0)} range ${Math.min(...own).toFixed(0)}-${Math.max(...own).toFixed(0)} | longest minus own: median ${med(rest).toFixed(0)} range ${Math.min(...rest).toFixed(0)}-${Math.max(...rest).toFixed(0)}`);
}
