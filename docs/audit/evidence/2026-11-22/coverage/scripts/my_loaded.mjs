// my_loaded.mjs <checkout> <rawdir...> : which src files appear with any executed function in the raw V8 coverage
import fs from 'node:fs'; import path from 'node:path';
const [root, ...dirs] = process.argv.slice(2);
const seen = new Set();
for (const d of dirs) for (const f of fs.readdirSync(d)) {
  const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
  for (const r of j.result) { const u = r.url || ''; const i = u.indexOf('/src/'); if (i < 0 || !u.endsWith('.js') || u.includes('node_modules')) continue; if (!u.includes(path.basename(root) + '/src/')) continue; seen.add(u.slice(i + 1)); }
}
const all = fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter((x) => String(x).endsWith('.js')).map((x) => 'src/' + x);
console.log('loaded', seen.size, 'of', all.length, 'never', all.filter((x) => !seen.has(x)).length, 'main.js loaded?', seen.has('src/main.js'));
if (process.env.LIST) for (const x of all.filter((y) => !seen.has(y)).sort()) console.log(x);
