// r29 inj part 3 table: node cnt2_table.mjs <out dir>
import { readFileSync, existsSync } from 'node:fs';
const O = process.argv[2];
const AX = ['hip x (abd/add)', 'hip y (rot)', 'hip z (flex/ext)', 'knee', 'ankle x (inv/ev)', 'ankle y (rot)', 'ankle z (plantar/dorsi)'];
const rd = (f) => (existsSync(`${O}/${f}`) ? readFileSync(`${O}/${f}`, 'utf8') : null);
const body = (t) => t?.split('\n').filter((l) => !/deprecated/.test(l)).join('\n').trim();
for (const [tag, cell] of [['13_125', 'll_13_125'], ['10_125', 'll_10_125'], ['10_100', 'll_10_100']]) {
  const a = body(rd(`f12_cnt2_${tag}.txt`)), b = body(rd(`f12_${cell}.txt`));
  console.log(`identity: instrumented ll_13_125_cnt2 (${tag}) fights12 output vs cell ${cell}: ${a && b ? (a === b ? 'IDENTICAL' : 'DIFFERENT') : 'missing'}`);
}
const ref = body(rd('../e3/cnt_fights.txt')), mine = body(rd('f12_cnt2_13_125.txt'));
if (ref && mine) console.log(`identity: instrumented cnt2 (13_125) vs earlier ll_13_125_cnt output (e3/cnt_fights.txt): ${ref === mine ? 'IDENTICAL' : 'DIFFERENT'}`);
const n = (x, d = 3) => (x == null ? '-' : (+x).toFixed(d));
for (const tag of ['13_125', '10_125', '10_100']) {
  const J = rd(`w2_${tag}.json`); if (!J) continue;
  const W = JSON.parse(J);
  console.log(`\n${tag} (ecc ${W.legs.ecc} · hipFlex ${W.legs.hipFlex}) · fights12 · stance-leg clamp calls; same-step repeat calls skipped: ${W.rep}`);
  console.log('| axis | calls | at limit | at limit, prev step also clamped | abs dwE rad/s median / p95 / max | limit change N·m median / p95 / max | as share of limit median / p95 / max | alternation runs len 2 | len >= 3 | len >= 5 | longest |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  const T = { calls: 0, sat: 0, r3: 0, r5: 0 };
  W.ax.forEach((A, i) => {
    const r = A.runs, ge = (k) => r.slice(k).reduce((s, x) => s + x, 0), longest = r.reduce((m, x, j) => (x > 0 ? j : m), 0);
    T.calls += A.calls; T.sat += A.sat; T.r3 += ge(3); T.r5 += ge(5);
    console.log(`| ${AX[i]} | ${A.calls} | ${A.sat} | ${A.satCons} | ${n(A.dw[0])} / ${n(A.dw[1])} / ${n(A.dw[2])} | ${n(A.dl[0], 2)} / ${n(A.dl[1], 2)} / ${n(A.dl[2], 2)} | ${n(100 * (A.sh[0] ?? 0), 2)} % / ${n(100 * (A.sh[1] ?? 0), 2)} % / ${n(100 * (A.sh[2] ?? 0), 2)} % | ${r[2]} | ${ge(3)} | ${ge(5)} | ${longest}${longest >= 63 ? '+' : ''} |`);
  });
  console.log(`| all | ${T.calls} | ${T.sat} | | | | | | ${T.r3} | ${T.r5} | |`);
}
