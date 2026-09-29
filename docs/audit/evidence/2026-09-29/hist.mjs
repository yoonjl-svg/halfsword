// usage: node hist.mjs <gitdir> <rev>  -> TSV: key  firstCommit  nChanges  lastChangeCommit
import { execSync } from 'child_process'; import fs from 'fs'; import path from 'path';
const [repo, rev] = process.argv.slice(2);
const sh = c => execSync(c, { cwd: repo, maxBuffer: 1 << 28 }).toString();
const commits = sh(`git log --first-parent --reverse --format=%h ${rev} -- src/config.js`).trim().split('\n');
const tmp = path.resolve('hist_tmp'); fs.mkdirSync(tmp, { recursive: true });
const flat = (o, p = [], out = {}) => { if (o && typeof o === 'object' && !Array.isArray(o)) { for (const k in o) flat(o[k], [...p, k], out); } else out[p.join('.')] = JSON.stringify(o); return out; };
const state = {};
for (const c of commits) {
  const f = path.join(tmp, c + '.mjs');
  fs.writeFileSync(f, sh(`git show ${c}:src/config.js`));
  let m; try { m = await import(f); } catch (e) { console.error('skip', c, e.message); continue; }
  const L = flat({ ...m });
  for (const [k, v] of Object.entries(L)) {
    const s = state[k];
    if (!s) state[k] = { first: c, v, n: 0, last: c };
    else if (s.v !== v) { s.v = v; s.n++; s.last = c; }
  }
}
console.error('commits', commits.length);
for (const [k, s] of Object.entries(state)) console.log([k, s.first, s.n, s.last].join('\t'));
