// Were the lines a commit REMOVED from src/ executed on the parent tree?
// usage: node removed.mjs <gitCheckout> <commit> <parentA.json> <parentB.json> <parentC.json>
// (the parent coverage JSONs come from merge.mjs run on an exported copy of <commit>^)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [, , M, c, ...jf] = process.argv;
const VERBOSE = process.env.VERBOSE === '1';
const P = jf.map((f) => JSON.parse(fs.readFileSync(f)));
const diff = execFileSync('git', ['-C', M, 'diff', '-U0', `${c}^`, c, '--', 'src'], { encoding: 'utf8', maxBuffer: 1 << 28 });
let file = null; const rem = {};
for (const l of diff.split('\n')) {
  if (l.startsWith('--- ')) { file = l.slice(4) === '/dev/null' ? null : l.slice(6); continue; }
  const m = l.match(/^@@ -(\d+)(?:,(\d+))? /);
  if (m && file) { const s = +m[1], n = m[2] == null ? 1 : +m[2]; for (let i = 0; i < n; i++) (rem[file] ??= []).push(s + i); }
}
const tot = { all: 0, code: 0, ex: [0, 0, 0] }; const rows = [];
for (const [f, ls] of Object.entries(rem)) {
  const code = new Set(P[2].files[f].codeLines); const ex = P.map((p) => new Set(p.files[f].execLines));
  const cl = ls.filter((L) => code.has(L));
  const e = ex.map((s) => cl.filter((L) => s.has(L)));
  tot.all += ls.length; tot.code += cl.length; e.forEach((x, i) => (tot.ex[i] += x.length));
  // a removed executed line inside a function body (per merged fns ranges) is printed with its text when VERBOSE=1
  if (VERBOSE && e[2].length) {
    const src = execFileSync('git', ['-C', M, 'show', `${c}^:${f}`], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n');
    const fns = P[2].files[f].fns;
    for (const L of e[2]) { const inFn = fns.some((x) => x.line < L && L <= x.end); console.log(`    ${f}:${L} ${inFn ? 'IN-FN' : 'top'} ${src[L - 1].trim().slice(0, 110)}`); }
  }
  if (e[2].length) rows.push(`${f}: ${e[2].length}/${cl.length} removed code lines executed in C (lines ${e[2].slice(0, 12).join(',')}${e[2].length > 12 ? ',...' : ''})`);
}
console.log(`removed lines ${tot.all}, of which code ${tot.code}; executed on parent tree: A ${tot.ex[0]}, B ${tot.ex[1]}, C ${tot.ex[2]}`);
for (const r of rows) console.log('  ' + r);
