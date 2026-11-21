// Coverage of lines ADDED/CHANGED in src/ by given commits, evaluated on the HEAD tree of <checkout>.
// Added line (commit tree) is mapped to HEAD through `git diff -U0 <commit> HEAD -- file`; lines touched again later are "relaid".
// usage: node commits.mjs <checkout> <A.json> <B.json> <C.json> <commit> [<commit> ...]   (read-only git: diff only)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [, , M, aF, bF, cF, ...commits] = process.argv;
const S = { A: JSON.parse(fs.readFileSync(aF)), B: JSON.parse(fs.readFileSync(bF)), C: JSON.parse(fs.readFileSync(cF)) };
const git = (...a) => execFileSync('git', ['-C', M, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
function hunks(diff) {
  const out = {}; let file = null;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(4) === '/dev/null' ? null : l.slice(6); if (file) out[file] ??= []; continue; }
    const m = l.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m && file) out[file].push({ os: +m[1], ol: m[2] == null ? 1 : +m[2], ns: +m[3], nl: m[4] == null ? 1 : +m[4] });
  }
  return out;
}
const sets = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, Object.fromEntries(Object.entries(v.files).map(([f, x]) => [f, { code: new Set(x.codeLines), ex: new Set(x.execLines), part: new Set(x.partLines || []) }]))]));
console.log('| commit | files | added lines | comment/blank | relaid later | code lines mapped | exec A | exec B | exec C | of C: partly run | by nothing | nothing % | nothing by file |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const c of commits) {
  const H = hunks(git('diff', '-U0', `${c}^`, c, '--', 'src'));
  let added = 0, nonCode = 0, relaid = 0, mapped = 0, eA = 0, eB = 0, eC = 0, none = 0, partC = 0; const noneBy = {};
  for (const [file, hs] of Object.entries(H)) {
    const lines = []; for (const h of hs) for (let i = 0; i < h.nl; i++) lines.push(h.ns + i);
    added += lines.length;
    const later = hunks(git('diff', '-U0', c, 'HEAD', '--', file))[file] ?? [];
    const C = sets.C[file]; if (!C) { relaid += lines.length; continue; } // file gone at HEAD
    for (const n of lines) {
      let shift = 0, dead = false;
      for (const h of later) {
        if (h.ol === 0) { if (n > h.os) shift += h.nl; continue; }
        if (n >= h.os && n < h.os + h.ol) { dead = true; break; }
        if (n >= h.os + h.ol) shift += h.nl - h.ol;
      }
      if (dead) { relaid++; continue; }
      const L = n + shift;
      if (!C.code.has(L)) { nonCode++; continue; }
      mapped++;
      const a = sets.A[file].ex.has(L), b = sets.B[file].ex.has(L), cc = C.ex.has(L);
      eA += a; eB += b; eC += cc; if (cc && C.part.has(L)) partC++; if (!cc) { none++; noneBy[file] = (noneBy[file] ?? 0) + 1; }
    }
  }
  const nb = Object.entries(noneBy).map(([f, n]) => `${f.replace('src/', '')} ${n}`).join(', ');
  console.log(`| ${c} | ${Object.keys(H).length} | ${added} | ${nonCode} | ${relaid} | ${mapped} | ${eA} | ${eB} | ${eC} | ${partC} | ${none} | ${mapped ? ((100 * none) / mapped).toFixed(0) : '-'} | ${nb} |`);
}
