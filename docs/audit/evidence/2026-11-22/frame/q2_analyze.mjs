// Re-analyse q2_hitch.mjs raw frame logs. A frame belongs to the window if it STARTS in [click, firstFightFrame + 2000 ms].
//  node q2_analyze.mjs <q2_*.json>...
import fs from 'node:fs';
const rows = [];
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f)); const R = j.raw;
  const clicks = R.marks.filter((m) => m[0].startsWith('click:'));
  clicks.forEach((c, i) => {
    const e = j.events[i]; const t0 = c[1];
    const iF = R.t.findIndex((t, k) => t > t0 && R.st[k] === 'fight'); const tf = R.t[iF];
    const win = []; for (let k = 1; k < R.t.length; k++) if (R.t[k - 1] >= t0 && R.t[k - 1] <= tf + 2000) win.push(R.t[k] - R.t[k - 1]);
    const st = []; for (let k = 1; k < R.t.length; k++) if (R.t[k - 1] > tf + 2500 && R.t[k] <= tf + 3000 + 2500) st.push(R.t[k] - R.t[k - 1]);
    const med = st.length ? [...st].sort((a, b) => a - b)[st.length >> 1] : NaN;
    const longest = Math.max(...win);
    rows.push({ file: f.split('/').pop(), rate: j.rate, kind: e.kind, tr: `${e.from}->${e.to}`, longest: +longest.toFixed(0), over50: +win.filter((x) => x > 50).reduce((a, b) => a + b, 0).toFixed(0), excess: +win.filter((x) => x > 2 * med).reduce((a, b) => a + b - med, 0).toFixed(0), med: +med.toFixed(0), build: e.after.buildMs, warm: e.after.warmMs, newProg: e.newPrograms, prog: `${e.before.programs}->${e.after.programs}`, tex: `${e.before.textures}->${e.after.textures}`, geo: `${e.before.geometries}->${e.after.geometries}` });
  });
}
for (const r of rows) console.log(Object.values(r).join(' | '));
// medians per (rate, kind)
const g = {};
for (const r of rows) (g[`r${r.rate} ${r.kind}`] ??= []).push(r.longest);
console.log('== longest frame: median [min..max] (n)');
for (const [k, v] of Object.entries(g)) { const s = [...v].sort((a, b) => a - b); console.log(`${k}: ${s[s.length >> 1]} [${s[0]}..${s.at(-1)}] (${s.length})`); }
