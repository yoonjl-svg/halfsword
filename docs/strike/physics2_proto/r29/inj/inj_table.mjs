// r29 inj part 2 table: node inj_table.mjs <out dir>  (reads walk_<cell>.json from run_inj.sh)
import { readFileSync, existsSync } from 'node:fs';
const O = process.argv[2];
const cells = ['ll_10_100', 'll_10_125', 'll_13_100', 'll_13_125'];
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : 0; };
const f = (a, d = 3) => `${mean(a).toFixed(d)} ± ${sd(a).toFixed(d)}`;
console.log('injured thighF, bleed 0, stand 2 s then walk forward 10 s, 8 seeds (mean ± sd over seeds; falls = count of 8)');
console.log('| cell | str F (measured) | str B | falls | speed along m/s | side drift m/s | pelvis mean m | pelvis min m | cadence steps/s | step length m | stance share F (hurt) | stance share B | F/B touchdowns |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const keep = {};
for (const c of cells) {
  if (!existsSync(`${O}/walk_${c}.json`)) continue;
  const { runs } = JSON.parse(readFileSync(`${O}/walk_${c}.json`, 'utf8'));
  for (const t of [...new Set(runs.map((r) => r.target))]) {
    const R = runs.filter((r) => r.target === t), ok = R.filter((r) => !r.fell);
    keep[`${c}:${t}`] = ok;
    const g = (k) => ok.map((r) => r[k]).filter((x) => x != null);
    console.log(`| ${c} | ${f(g('strF'))} | ${f(g('strB'))} | ${R.length - ok.length}/${R.length} | ${f(g('alongV'))} | ${f(g('sideV'))} | ${f(g('yMean'))} | ${f(g('yMin'))} | ${f(g('cadence'), 2)} | ${f(g('stepLen'))} | ${f(g('stanceShareF'))} | ${f(g('stanceShareB'))} | ${mean(g('tdF')).toFixed(1)}/${mean(g('tdB')).toFixed(1)} |`);
  }
}
// paired difference vs ll_10_100 (same seed = same start), per strength
console.log('\npaired change vs ll_10_100 (same seeds, non-fallen in both): speed m/s · pelvis mean m · step length m — mean [min .. max]');
for (const c of cells.slice(1)) for (const t of [1, 0.8, 0.5]) {
  const A = keep[`ll_10_100:${t}`], B = keep[`${c}:${t}`]; if (!A || !B) continue;
  const pr = (k) => { const d = []; for (const b of B) { const a = A.find((x) => x.v === b.v); if (a && a[k] != null && b[k] != null) d.push(b[k] - a[k]); } return d.length ? `${mean(d).toFixed(3)} [${Math.min(...d).toFixed(3)} .. ${Math.max(...d).toFixed(3)}]` : '-'; };
  console.log(`${c} str ${t}: speed ${pr('alongV')} · pelvis ${pr('yMean')} · step ${pr('stepLen')} · cadence ${pr('cadence')}`);
}
// limp size: healthy (str 1) minus injured, per cell
console.log('\nfalls split: during the 2 s stand right after the wound (first non-stand state, time after the wound) vs during the walk');
for (const c of cells) { if (!existsSync(`${O}/walk_${c}.json`)) continue; const { runs } = JSON.parse(readFileSync(`${O}/walk_${c}.json`, 'utf8'));
  for (const t of [1, 0.8, 0.5]) { const R = runs.filter((r) => r.target === t); const sf = R.filter((r) => r.standFall); const wf = R.filter((r) => r.fell && !r.standFall);
    console.log(`${c} str ${t}: stand-phase ${sf.length}/${R.length} [${sf.map((r) => `seed ${r.v}: ${r.standFall.state} @${r.standFall.t} s`).join(', ')}] · walk-phase ${wf.length}/${R.length} [${wf.map((r) => `seed ${r.v} @${r.tFall} s`).join(', ')}] · stand-phase pelvis min (mean) ${(R.reduce((s, r) => s + r.standPelMin, 0) / R.length).toFixed(3)} m`); } }
console.log('\nlimp size per cell = str 1 value minus injured value (speed m/s · pelvis m · step length m)');
for (const c of cells) for (const t of [0.8, 0.5]) {
  const A = keep[`${c}:1`], B = keep[`${c}:${t}`]; if (!A || !B) continue;
  const m = (R, k) => mean(R.map((r) => r[k]).filter((x) => x != null));
  console.log(`${c} str ${t}: speed loss ${(m(A, 'alongV') - m(B, 'alongV')).toFixed(3)} · pelvis drop ${(m(A, 'yMean') - m(B, 'yMean')).toFixed(3)} · step shortening ${(m(A, 'stepLen') - m(B, 'stepLen')).toFixed(3)} · stance share F-B ${(m(B, 'stanceShareF') - m(B, 'stanceShareB')).toFixed(3)} (healthy ${(m(A, 'stanceShareF') - m(A, 'stanceShareB')).toFixed(3)})`);
}
