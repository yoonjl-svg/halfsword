// usage: node appendix.cjs <rows.json> <seed> <appendix files...> — step 7: 15 keys with OLD comment > 300 chars, 60-char middle slice found in appendix?
const fs = require('fs'); const [rj, seedS, ...files] = process.argv.slice(2);
let s = +seedS; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const norm = (t) => t.replace(/\/\/|\/\*|\*\/| \/ |\s+/g, '');
const app = norm(files.map((f) => { const t = fs.readFileSync(f, 'utf8'); const i = t.indexOf('## 부록'); return i < 0 ? '' : t.slice(i); }).join(''));
const seen = new Set(); const pool = JSON.parse(fs.readFileSync(rj, 'utf8')).filter((r) => r.oldText.length > 300 && !seen.has(r.oldText) && seen.add(r.oldText));
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
let hit = 0; console.log('distinct long OLD comments', pool.length);
for (const r of pool.slice(0, 15)) { const n = norm(r.oldText); const m = Math.floor(n.length / 2) - 30; const sl = n.slice(m, m + 60);
  const inApp = app.includes(sl), inNew = norm(r.newText).includes(sl); if (inApp || inNew) hit++;
  console.log(r.path, 'len', r.oldText.length, inApp ? 'HIT-appendix' : inNew ? 'HIT-still-in-config' : 'MISS', inApp || inNew ? '' : sl); }
console.log('hits', hit, '/ 15');
