// Longest d_eff/d period-2 chatter runs in the fight probe (new tree), stand state only, with the d_eff/d series.
// Usage: node chatter_top.mjs <probe dir> new4
import { readFileSync } from 'node:fs';
const [dir, tag] = process.argv.slice(2);
const mser = new Map();
for (const l of readFileSync(`${dir}/${tag}_fight.sp.jsonl`, 'utf8').trim().split('\n').map((x) => JSON.parse(x))) {
  if (l.state !== 'stand') continue;
  for (const [nm, J] of Object.entries(l.J)) if (J.mo) J.mo.forEach((m, i) => { const k = `${l.wid}:${l.who}:${nm}:${i}`; (mser.get(k) ?? mser.set(k, []).get(k)).push([l.s, m[1], m[0], (nm.endsWith('F') ? l.stF : l.stB) ? 'S' : 'W']); });
}
const runs = [];
for (const [k, v] of mser) { v.sort((a, b) => a[0] - b[0]); let r = 0, start = 0;
  for (let x = 2; x <= v.length; x++) {
    const ok = x < v.length && v[x][0] === v[x - 1][0] + 1 && v[x - 1][0] === v[x - 2][0] + 1;
    const flip = ok && Math.abs(v[x - 1][1] - v[x - 2][1]) > 0.5 && Math.abs(v[x][1] - v[x - 1][1]) > 0.5 && Math.sign(v[x - 1][1] - v[x - 2][1]) !== Math.sign(v[x][1] - v[x - 1][1]);
    if (flip) { if (!r) start = x - 2; r++; } else { if (r) runs.push({ k, len: r + 2, s: v[start][0], st: v[start][3], df: v.slice(start, start + Math.min(r + 2, 12)).map((q) => q[1].toFixed(2)).join(' ') }); r = 0; } } }
runs.sort((a, b) => b.len - a.len);
const hist = {}; for (const r of runs) { const b = r.len >= 10 ? '>=10' : r.len >= 6 ? '6-9' : r.len >= 4 ? '4-5' : '3'; hist[b] = (hist[b] ?? 0) + 1; }
console.log(`stand-state fight chatter runs by length (steps): ${JSON.stringify(hist)}`);
for (const r of runs.slice(0, 8)) console.log(`${r.k} step ${r.s} ${r.st} len ${r.len}: d_eff/d ${r.df}`);
