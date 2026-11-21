// usage: node walk2.mjs <root> -> TSV: path value srcExact srcName toolsExact toolsName dynFlag files
import fs from 'fs'; import path from 'path';
const root = process.argv[2];
const cfg = await import(path.join(root, 'src/config.js'));
const leaves = [];
function walk(o, p) { if (o && typeof o === 'object' && !Array.isArray(o)) { for (const k of Object.keys(o)) walk(o[k], [...p, k]); } else leaves.push({ p, v: o }); }
for (const [k, v] of Object.entries(cfg)) walk(v, [k]);
function files(dir, out = []) { if (!fs.existsSync(dir)) return out; for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const fp = path.join(dir, f.name); if (f.isDirectory()) { if (f.name !== 'node_modules') files(fp, out); } else if (/\.(m?js|html)$/.test(f.name) && !fp.endsWith('src/config.js')) out.push(fp); } return out; }
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXPORTS = Object.keys(cfg);
const EX = EXPORTS.join('|');
function load(list) { return list.map(f => { const t = strip(fs.readFileSync(f, 'utf8')); const al = {}; // export -> {local names}
  const add = (e, n) => { (al[e] ||= new Set([e])).add(n); };
  for (const m of t.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*config(?:\.js)?['"]/g)) for (const part of m[1].split(',')) { const [a, b] = part.split(/\s+as\s+/).map(x => x.trim()); if (a && b && EXPORTS.includes(a)) add(a, b); }
  // const X = CONFIG.OBJ  / const X = OBJ (whole object only, no further path)
  for (const m of t.matchAll(new RegExp('\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:CONFIG\\.)?(' + EX + ')\\s*[;,\\n)]', 'g'))) add(m[2], m[1]);
  // sub-object alias: const X = OBJ.a.b  -> base path
  const sub = []; for (const m of t.matchAll(new RegExp('\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:CONFIG\\.)?(' + EX + ')((?:\\??\\.[A-Za-z_$][\\w$]*)+)\\s*[;,\\n)]', 'g'))) sub.push([m[1], m[2] + m[3].replace(/\?/g, '')]);
  const dest = []; for (const m of t.matchAll(new RegExp('\\{([^{}]*)\\}\\s*=\\s*(?:CONFIG\\.)?(' + EX + ')((?:\\.[A-Za-z_$][\\w$]*)*)', 'g'))) dest.push([m[1].split(',').map(x => x.split(':')[0].split('=')[0].trim()), m[2] + m[3]]);
  const dyn = new Set(); for (const e of EXPORTS) { const names = [...(al[e] || [e])]; for (const n of names) if (new RegExp('\\b' + esc(n) + '\\s*\\[|Object\\.(?:keys|entries|values)\\(\\s*' + esc(n) + '\\b|\\.\\.\\.\\s*' + esc(n) + '\\b|\\b' + esc(n) + '(?:\\.[A-Za-z_$][\\w$]*)+\\[').test(t)) dyn.add(e); }
  return { f: path.relative(root, f), t, al, sub, dest, dyn }; }); }
const SRC = load(files(path.join(root, 'src'))), TOOLS = load(files(path.join(root, 'tools')));
function exact(set, p) { let n = 0; const fl = []; const full = p.join('.'); const leaf = p[p.length - 1];
  for (const o of set) { if (!o.t.includes(leaf)) continue; let c = 0;
    const names = [...(o.al[p[0]] || [p[0]])]; const pre = '(?:\\b' + names.map(esc).join('|\\b') + ')'; 
    const re = new RegExp('(?:\\bCONFIG\\??\\.)?' + pre + p.slice(1).map(k => '\\??\\.' + esc(k)).join('') + '(?![\\w$])', 'g'); const m = o.t.match(re); if (m) c += m.length;
    for (const [nm, base] of o.sub) if (full.startsWith(base + '.')) { const rest = full.slice(base.length + 1).split('.'); const m2 = o.t.match(new RegExp('\\b' + esc(nm) + rest.map(k => '\\??\\.' + esc(k)).join('') + '(?![\\w$])', 'g')); if (m2) c += m2.length; }
    for (const [ns, base] of o.dest) if (full.startsWith(base + '.') && ns.includes(full.slice(base.length + 1).split('.')[0])) c++;
    if (c) { n += c; fl.push(path.basename(o.f)); } }
  return [n, fl]; }
function nameCount(set, leaf) { const isId = /^[A-Za-z_$][\w$]*$/.test(leaf); const re = isId ? new RegExp('(\\.\\s*' + esc(leaf) + '\\b|[{,]\\s*' + esc(leaf) + '\\s*[,}=:]|[\'"`]' + esc(leaf) + '[\'"`])', 'g') : new RegExp(esc(leaf), 'g'); let n = 0; for (const o of set) { if (!o.t.includes(leaf)) continue; const m = o.t.match(re); if (m) n += m.length; } return n; }
const dynTop = {}; for (const o of SRC) for (const e of o.dyn) (dynTop[e] ||= new Set()).add(path.basename(o.f));
const out = [];
for (const { p, v } of leaves) { const leaf = p[p.length - 1];
  const [se, sf] = exact(SRC, p), [te] = exact(TOOLS, p);
  out.push([p.join('.'), JSON.stringify(v)?.slice(0, 40), se, nameCount(SRC, leaf), te, nameCount(TOOLS, leaf), dynTop[p[0]] ? 'dyn:' + [...dynTop[p[0]]].slice(0, 3).join('+') : '', sf.slice(0, 4).join(',')].join('\t')); }
console.log(out.join('\n'));
