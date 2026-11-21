// usage: node merge.mjs <out.json> <first-pass results...> -- <second-pass results>  (second pass keys override first pass: G1/G2/B2 re-run with the burst hook)
import fs from 'node:fs';
const a = process.argv.slice(2); const outF = a.shift();
const all = {}; for (const f of a.filter((x) => x !== '--')) Object.assign(all, JSON.parse(fs.readFileSync(f, 'utf8')));
fs.writeFileSync(outF, JSON.stringify(all, null, 1)); console.log(Object.keys(all).join(' '));
