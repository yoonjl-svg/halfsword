// my_probe.mjs <checkout dir name>/<file, e.g. wt2/src/skill.js> <line> <col> <rawdir...> : was the character at line:col executed in any process? (innermost V8 range wins)
import fs from 'node:fs'; import path from 'node:path';
const [suffix, lineS, colS, ...dirs] = process.argv.slice(2);
let hits = [], procs = 0;
for (const d of dirs) for (const f of fs.readdirSync(d)) {
  const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
  for (const r of j.result) {
    if (!r.url.endsWith('/' + suffix)) continue;
    procs++;
    const src = fs.readFileSync(new URL(r.url), 'utf8');
    const lines = src.split('\n'); let off = 0; for (let i = 0; i < +lineS - 1; i++) off += lines[i].length + 1; off += +colS;
    let best = null;
    for (const fn of r.functions) for (const rg of fn.ranges) if (rg.startOffset <= off && off < rg.endOffset && (!best || rg.endOffset - rg.startOffset <= best.endOffset - best.startOffset)) best = rg;
    if (best && best.count > 0) hits.push(`${path.basename(d)}/${f}:${best.count}`);
  }
}
console.log(`${suffix}:${lineS}:${colS} processes that loaded the file ${procs}, executed in ${hits.length}`, hits.slice(0, 4).join(' '));
