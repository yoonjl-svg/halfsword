// Summaries from merged coverage JSONs (merge.mjs output).
// usage: node analyze.mjs <checkout> <A.json> <B.json> <C.json> <section>   section = totals | top25 | classify | input
import fs from 'node:fs';
import path from 'node:path';
const [, , checkoutArg, aF, bF, cF, section] = process.argv;
const root = path.resolve(checkoutArg);
const S = { A: JSON.parse(fs.readFileSync(aF)), B: JSON.parse(fs.readFileSync(bF)), C: JSON.parse(fs.readFileSync(cF)) };
const files = Object.keys(S.C.files);
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '-');
const cov = (set, f) => { const v = S[set].files[f]; return { cl: v.codeLines.length, el: v.execLines.length, ft: v.fns.length, fe: v.fns.filter((x) => x.exec).length, loaded: v.loaded }; };
const lp = (set, f) => { const c = cov(set, f); return c.loaded ? pct(c.el, c.cl) : 'nl'; };

// import graph (static + dynamic string imports)
const impRe = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;
function importsOf(abs) {
  const t = fs.readFileSync(abs, 'utf8'); const out = [];
  for (const m of t.matchAll(impRe)) { const s = m[1] || m[2] || m[3]; if (s && s.startsWith('.')) out.push(path.resolve(path.dirname(abs), s)); }
  return out;
}
const importers = new Map(files.map((f) => [f, new Set()]));
for (const f of files) for (const d of importsOf(path.join(root, f))) { const r = path.relative(root, d); if (importers.has(r)) importers.get(r).add(f); }
const simDir = path.join(root, 'tools/sim');
const simEntries = fs.readdirSync(simDir).filter((x) => x.endsWith('.mjs')).map((x) => path.join(simDir, x));
function reachFrom(entries) {
  const reach = new Set(); const stack = []; const seen = new Set();
  for (const e of entries) for (const d of importsOf(e)) stack.push(d);
  while (stack.length) { // tools/sim helper libs import each other: follow non-src too
    const a = stack.pop(); if (seen.has(a)) continue; seen.add(a);
    if (!fs.existsSync(a)) continue;
    const r = path.relative(root, a);
    if (r.startsWith('src/')) reach.add(r);
    if (a.endsWith('.js') || a.endsWith('.mjs')) for (const d of importsOf(a)) stack.push(d);
  }
  return reach;
}
const reach = reachFrom(simEntries);
const GATES = ['fights12', 'live_battery', 'match_twin', 'finish_thrust', 'corr_s0', 'weapon_smoke', 'team_fights'];
const reachGT = reachFrom(simEntries.filter((e) => e.endsWith('.test.mjs') || GATES.includes(path.basename(e, '.mjs'))));
const family = (f) => {
  const b = path.basename(f);
  if (/^stage_|^stages?\b|arena|courtyard|grove|loggia/.test(b)) return 'stage';
  if (/^outfit_|^looks|^armor_look|^hair|^face/.test(b)) return 'outfit/looks';
  if (/lobby|saengsa|title|shop|card|draw_ui|result|menu|portrait|profile|skill_tree_ui|ui_|hud/.test(b)) return 'ui/lobby/saengsa/hud';
  if (/sound|audio|sfx|music/.test(b)) return 'sound';
  if (/fx|effect|trail|particle|blood|spark|aura|light/.test(b)) return 'effects';
  if (/cam/.test(b)) return 'camera';
  if (/input|touch|stick|parry_button/.test(b)) return 'input';
  return 'other';
};

if (section === 'totals') {
  console.log('| set | src files | loaded | never loaded | code lines exec/total | % | functions exec/total | % |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const s of ['A', 'B', 'C']) {
    let cl = 0, el = 0, ft = 0, fe = 0, ld = 0;
    for (const f of files) { const c = cov(s, f); cl += c.cl; el += c.el; ft += c.ft; fe += c.fe; ld += c.loaded; }
    console.log(`| ${s} | ${files.length} | ${ld} | ${files.length - ld} | ${el}/${cl} | ${pct(el, cl)} | ${fe}/${ft} | ${pct(fe, ft)} |`);
  }
  // loaded but function coverage 0 except top level
  for (const s of ['A', 'B', 'C']) {
    const topOnly = files.filter((f) => { const c = cov(s, f); return c.loaded && c.ft > 0 && c.fe === 0; });
    console.log(`${s}: loaded but no function ever called (top-level only): ${topOnly.length} files, ${topOnly.reduce((a, f) => a + cov(s, f).cl, 0)} lines`);
  }
}
if (section === 'top25') {
  const top = [...files].sort((a, b) => cov('C', b).cl - cov('C', a).cl).slice(0, 25);
  console.log('| file | code lines | fns | A lines% | B lines% | C lines% | A fns% | B fns% | C fns% |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const f of top) {
    const c = cov('C', f);
    const fp = (s) => { const x = cov(s, f); return x.loaded ? pct(x.fe, x.ft) : 'nl'; };
    console.log(`| ${f.replace('src/', '')} | ${c.cl} | ${c.ft} | ${lp('A', f)} | ${lp('B', f)} | ${lp('C', f)} | ${fp('A')} | ${fp('B')} | ${fp('C')} |`);
  }
}
if (section === 'classify') {
  const low = files.filter((f) => { const c = cov('C', f); return !c.loaded || c.el / Math.max(1, c.cl) < 0.1; });
  const fam = {}; const ii = [];
  for (const f of low) {
    const c = cov('C', f);
    if (reachGT.has(f) && c.loaded) { ii.push(`${f.replace('src/', '')} (${c.cl} lines, ${pct(c.el, c.cl)}%)`); continue; }
    const cls = !reach.has(f) ? '(i) browser-only' : '(i\') other Node tools only';
    { const k = cls + ' / ' + family(f); (fam[k] ??= { n: 0, cl: 0, files: [] }); fam[k].n++; fam[k].cl += c.cl; fam[k].files.push(`${path.basename(f, '.js')}${c.loaded ? '*' : ''}<-${[...importers.get(f)].map((x) => path.basename(x, '.js')).slice(0, 2).join('+') || 'none'}`); continue; }
    if (!reach.has(f)) { const k = family(f); (fam[k] ??= { n: 0, cl: 0, files: [] }); fam[k].n++; fam[k].cl += c.cl; fam[k].files.push(`${path.basename(f, '.js')}${c.loaded ? '*' : ''}<-${[...importers.get(f)].map((x) => path.basename(x, '.js')).slice(0, 2).join('+') || 'none'}`); }
    else ii.push(`${f.replace('src/', '')} (${c.cl} lines, ${c.loaded ? pct(c.el, c.cl) + '%' : 'never loaded'})`);
  }
  console.log(`files never loaded or <10% lines in C: ${low.length} (${low.reduce((a, f) => a + cov('C', f).cl, 0)} lines)`);
  console.log(`(i) not statically reachable from any tools/sim/*.mjs: ${low.filter((f) => !reach.has(f)).length} files`);
  console.log('| family | files | code lines | members (name<-importer; * = loaded by something) |');
  console.log('|---|---|---|---|');
  for (const [k, v] of Object.entries(fam).sort((a, b) => b[1].cl - a[1].cl)) console.log(`| ${k} | ${v.n} | ${v.cl} | ${v.files.join(', ')} |`);
  console.log(`(ii) loaded by gates/tests (static import graph) but <10% lines run: ${ii.length}`);
  for (const x of ii) console.log('  ' + x);
  console.log(`src files statically reachable from any tools/sim script: ${reach.size}/${files.length}; from gates+tests: ${reachGT.size}`);
}
if (section === 'input') {
  const list = (process.env.INPUT_FILES || '').split(',').filter(Boolean);
  console.log('| file | code lines | fns | A fn% | B fn% | C fn% | A line% | B line% | C line% | never-run fns in C |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  let tot = { cl: 0, A: 0, B: 0, C: 0, ft: 0, fA: 0, fB: 0, fC: 0 };
  for (const spec of list) {
    const [f, range] = spec.split(':');
    const inR = (L) => { if (!range) return true; const [a, b] = range.split('-').map(Number); return L >= a && L <= b; };
    const row = { };
    for (const s of ['A', 'B', 'C']) {
      const v = S[s].files[f];
      const cl = v.codeLines.filter(inR), el = v.execLines.filter(inR);
      const fns = v.fns.filter((x) => inR(x.line));
      row[s] = { cl: cl.length, el: el.length, ft: fns.length, fe: fns.filter((x) => x.exec).length, never: fns.filter((x) => !x.exec) };
    }
    tot.cl += row.C.cl; tot.ft += row.C.ft; for (const s of ['A', 'B', 'C']) { tot[s] += row[s].el; tot['f' + s] += row[s].fe; }
    const named = row.C.never.filter((x) => x.name !== '(anon)');
    const nev = named.map((x) => `${x.name}@${x.line}`).join(' ') + (row.C.never.length > named.length ? ` +${row.C.never.length - named.length} anon` : '');
    console.log(`| ${f.replace('src/', '')}${range ? ':' + range : ''} | ${row.C.cl} | ${row.C.ft} | ${pct(row.A.fe, row.A.ft)} | ${pct(row.B.fe, row.B.ft)} | ${pct(row.C.fe, row.C.ft)} | ${pct(row.A.el, row.A.cl)} | ${pct(row.B.el, row.B.cl)} | ${pct(row.C.el, row.C.cl)} | ${nev.slice(0, 400)} |`);
  }
  console.log(`| TOTAL | ${tot.cl} | ${tot.ft} | ${pct(tot.fA, tot.ft)} | ${pct(tot.fB, tot.ft)} | ${pct(tot.fC, tot.ft)} | ${pct(tot.A, tot.cl)} | ${pct(tot.B, tot.cl)} | ${pct(tot.C, tot.cl)} | |`);
}
