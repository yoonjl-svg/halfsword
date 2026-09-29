// usage: node walk.mjs <repoRoot>  -> TSV: path value srcExact srcName toolsExact toolsName srcFiles
import fs from 'fs'; import path from 'path';
const root = process.argv[2];
const cfg = await import(path.join(root, 'src/config.js'));
const leaves = [];
function walk(o, p) {
  if (o && typeof o === 'object' && !Array.isArray(o)) { for (const k of Object.keys(o)) walk(o[k], [...p, k]); }
  else leaves.push({ p, v: o });
}
for (const [k, v] of Object.entries(cfg)) walk(v, [k]);
function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'node_modules') files(fp, out); }
    else if (/\.(m?js|html)$/.test(f.name) && !fp.endsWith('src/config.js')) out.push(fp);
  }
  return out;
}
// strip line comments & block comments crudely so comment mentions don't count
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const load = fs2 => fs2.map(f => ({ f: path.relative(root, f), t: strip(fs.readFileSync(f, 'utf8')) }));
const SRC = load(files(path.join(root, 'src'))), TOOLS = load(files(path.join(root, 'tools')));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXPORTS = Object.keys(cfg);
// alias & spread discovery per file: const X = OBJ.a.b;  ({a, b} = OBJ.x)  ...OBJ.x
function aliases(t) {
  const al = [], dest = [], spread = [];
  const E = '(?:CONFIG\\.)?(' + EXPORTS.join('|') + ')((?:\\.[A-Za-z_$][\\w$]*)*)';
  for (const m of t.matchAll(new RegExp('\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*' + E + '\\s*[;,\\n)]', 'g'))) al.push([m[1], (m[2] + m[3])]);
  for (const m of t.matchAll(new RegExp('\\{([^{}]*)\\}\\s*=\\s*' + E + '\\b', 'g'))) dest.push([m[1].split(',').map(x => x.split(':')[0].split('=')[0].trim()), m[2] + m[3]]);
  for (const m of t.matchAll(new RegExp('\\.\\.\\.\\s*' + E + '\\b', 'g'))) spread.push(m[1] + m[2]);
  return { al, dest, spread };
}
for (const s of [SRC, TOOLS]) for (const o of s) o.a = aliases(o.t);
function aliasCount(set, p) {
  let n = 0, sp = 0; const full = p.join('.');
  for (const { t, a } of set) {
    for (const [name, base] of a.al) if (full.startsWith(base + '.')) { const rest = full.slice(base.length + 1).split('.'); const m = t.match(new RegExp('\\b' + esc(name) + '\\??\\.' + rest.map(esc).join('\\??\\.') + '\\b', 'g')); if (m) n += m.length; }
    for (const [names, base] of a.dest) if (full.startsWith(base + '.') && names.includes(full.slice(base.length + 1).split('.')[0])) n++;
    for (const base of a.spread) if (full.startsWith(base + '.')) sp++;
  }
  return [n, sp];
}
function count(set, re) { let n = 0; const fl = new Set(); for (const { f, t } of set) { const m = t.match(re); if (m) { n += m.length; fl.add(path.basename(f)); } } return [n, [...fl]]; }
const out = [];
for (const { p, v } of leaves) {
  const leaf = p[p.length - 1];
  // exact: OBJ.a.b (allow CONFIG.OBJ.a.b / optional chaining)
  const exactRe = new RegExp('\\b' + p.map(esc).join('\\??\\.') + '\\b', 'g');
  // name: identifier as property/destructure/string key: .leaf  | leaf: | {leaf | , leaf | 'leaf'
  const isIdent = /^[A-Za-z_$][\w$]*$/.test(leaf);
  const nameRe = isIdent ? new RegExp('(\\.\\s*' + esc(leaf) + '\\b|[{,]\\s*' + esc(leaf) + '\\s*[,}=:]|[\'"`]' + esc(leaf) + '[\'"`])', 'g') : new RegExp(esc(leaf), 'g');
  const [sa, ssp] = aliasCount(SRC, p), [ta, tsp] = aliasCount(TOOLS, p);
  const [se0] = count(SRC, exactRe), [sn, sf] = count(SRC, nameRe), [te0] = count(TOOLS, exactRe), [tn] = count(TOOLS, nameRe);
  const se = se0 + sa, te = te0 + ta;
  out.push([p.join('.'), JSON.stringify(v)?.slice(0, 40), se, sn, te, tn, (ssp?'spread'+ssp:'') , sf.slice(0, 4).join(',')].join('\t'));
}
console.log(out.join('\n'));
