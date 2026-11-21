// usage: node tools/sim/audit_tab.mjs <out.json> [more.json ...]  (counters summed)
import { readFileSync } from 'node:fs';
const C = {}; let N = 0;
for (const f of process.argv.slice(2)) { const j = JSON.parse(readFileSync(f, 'utf8')); N += j.N; for (const [k, v] of Object.entries(j.C)) C[k] = (C[k] || 0) + v; }
const grp = (p) => Object.entries(C).filter(([k]) => k.startsWith(p)).map(([k, v]) => [k.slice(p.length), v]).sort((a, b) => b[1] - a[1]);
const show = (title, p, denom) => {
  const g = grp(p); const tot = denom ?? g.reduce((s, [, v]) => s + v, 0);
  let cum = 0; console.log(`\n## ${title} (total ${tot})`);
  for (const [k, v] of g) { cum += v; console.log(`${k}\t${v}\t${(100 * v / tot).toFixed(2)}%\tcum ${(100 * cum / tot).toFixed(1)}%`); }
};
console.log('N', N, 'opp.calls', C['opp.calls'], 'aiSteps', C.aiSteps);
show('opportunity candidates (v>0) per call', 'cand.', C['opp.calls']);
show('opportunity winner kind', 'win.');
show('fire (score>=need & in range) by kind', 'fire.');
show('startAttack tries by why', 'sa.try.');
show('startAttack ok by why', 'sa.ok.');
show('mode transitions', 'mode.');
show('tech picked', 'tech.pick.');
show('tech started', 'tech.start.');
show('winner by tradition', 'winT.');
