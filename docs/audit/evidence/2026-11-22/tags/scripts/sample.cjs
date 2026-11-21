// usage: node sample.cjs <rows.json> <seed> <decisions_main...>  — step 4 date check on a seeded sample of 40 OWNER keys
const fs = require('fs'); const [rj, seedS, ...dfiles] = process.argv.slice(2);
let s = +seedS; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const rows = JSON.parse(fs.readFileSync(rj, 'utf8')).filter((r) => r.newOwn === 'OWNER' && !r.isObj && /\[사장님 \d/.test(r.newText));
const a = rows.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
const lines = []; for (const f of dfiles) fs.readFileSync(f, 'utf8').split('\n').forEach((t, i) => lines.push({ f, n: i + 1, t }));
// a line's dates: M/D tokens, plus '## 2026-MM-DD' headings carried down
let cur = null; for (const L of lines) { const h = L.t.match(/^##+ 2026-(\d\d)-(\d\d)/); if (h) cur = +h[1] + '/' + +h[2]; L.dates = new Set([...L.t.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map((m) => +m[1] + '/' + +m[2])); if (cur) L.dates.add(cur); L.owner = /사장님/.test(L.t); }
const near = (d) => { const [m, dd] = d.split('/').map(Number); const dt = new Date(2026, m - 1, dd); return [-1, 0, 1].map((k) => { const x = new Date(dt.getTime() + k * 864e5); return x.getMonth() + 1 + '/' + x.getDate(); }); };
console.log('pool', rows.length, 'seed', seedS);
for (const r of a.slice(0, 40)) {
  const tag = r.newText.match(/\[사장님 ([^\]]*)\]/)[1]; const dates = [...tag.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map((m) => +m[1] + '/' + +m[2]);
  const leaf = r.path.split('.').pop(); const top = r.path.split('.')[0];
  const keyRe = new RegExp('`?(' + top + '\\.)?[^`\\s]*\\b' + leaf + '\\b'); const num = (r.value || '').match(/-?\d*\.?\d+/); 
  let best = null, other = null;
  for (const L of lines) { if (!L.owner) continue; const k = keyRe.test(L.t) && new RegExp('\\b' + leaf + '\\b').test(L.t);
    if (!k) continue; const onDate = dates.some((d) => near(d).some((x) => L.dates.has(x)));
    if (onDate && !best) best = L; else if (!onDate && !other) other = L; }
  const v = best ? 'CONFIRMED?(key named on date)' : other ? 'DATE-MISMATCH?(key named, other date)' : 'NOT-FOUND-by-key';
  const L = best || other; 
  console.log([r.path, r.value, '[사장님 ' + tag + ']', v, L ? L.f.replace(/.*docs_/, '').replace('_main.txt', '') + ':' + L.n + ' ' + L.t.slice(0, 160).replace(/\s+/g, ' ') : ''].join(' | '));
}
