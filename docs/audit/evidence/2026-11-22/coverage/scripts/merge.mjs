// Merge raw V8 coverage (NODE_V8_COVERAGE dirs) into per-file line/function coverage for <checkout>/src/**/*.js
// usage: node merge.mjs <checkout> <out.json> <rawDir> [<rawDir> ...]
// Rule: per process, all ranges of a file are painted outer-first (sort start asc, end desc), so the innermost
// range's count wins for each char. A char is "executed" if count>0 in any process.
// Code chars = non-whitespace chars outside comments (comments from the parser).
// Line executed = it has >=1 code char that is executed. Function executed = char at its body start executed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [, , checkoutArg, outFile, ...rawDirs] = process.argv;
const root = path.resolve(checkoutArg);
const srcRoot = path.join(root, 'src');
const { parseAst } = await import(path.join(root, 'node_modules/rolldown/dist/parse-ast-index.mjs'));

function listJs(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...listJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const files = listJs(srcRoot).sort();
const srcText = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const execMap = new Map(); // abs path -> Uint8Array
const procCount = new Map(); // abs -> number of processes that loaded it
let nRaw = 0;

function toPath(url) {
  let u = url.split('?')[0].split('#')[0];
  try { if (u.startsWith('file:')) return fileURLToPath(u); } catch { return null; }
  return path.isAbsolute(u) ? u : null;
}
for (const dir of rawDirs) {
  for (const fn of fs.readdirSync(dir)) {
    if (!fn.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch { continue; }
    nRaw++;
    for (const sc of j.result || []) {
      const p = toPath(sc.url);
      if (!p || !srcText.has(p)) continue;
      const len = srcText.get(p).length;
      const ranges = [];
      for (const f of sc.functions) for (const r of f.ranges) ranges.push(r);
      ranges.sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
      const cnt = new Float64Array(len);
      for (const r of ranges) cnt.fill(r.count, Math.max(0, r.startOffset), Math.min(len, r.endOffset));
      let ex = execMap.get(p);
      if (!ex) { ex = new Uint8Array(len); execMap.set(p, ex); }
      for (let i = 0; i < len; i++) if (cnt[i] > 0) ex[i] = 1;
      procCount.set(p, (procCount.get(p) || 0) + 1);
    }
  }
}

function fnName(node, parent, key) {
  if (node.id && node.id.name) return node.id.name;
  if (!parent) return '(anon)';
  if (parent.type === 'VariableDeclarator' && parent.id?.name) return parent.id.name;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key)
    return parent.key.name || parent.key.value || '(computed)';
  if (parent.type === 'AssignmentExpression') {
    const l = parent.left; if (l.type === 'MemberExpression') return (l.property?.name || '?'); return l.name || '(assign)';
  }
  return '(anon)';
}
function walk(node, parent, cb) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) walk(n, parent, cb); return; }
  if (typeof node.type === 'string') cb(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (v && typeof v === 'object') walk(v, typeof node.type === 'string' ? node : parent, cb);
  }
}

const out = { checkout: root, rawDirs, nRaw, files: {} };
for (const f of files) {
  const text = srcText.get(f);
  const rel = path.relative(root, f);
  let ast, parseErr = null;
  try { ast = parseAst(text, { lang: 'js' }); } catch (e) { parseErr = String(e).slice(0, 200); }
  const isComment = new Uint8Array(text.length);
  if (ast) { // comments = '//' or '/*' outside string/regex/template literal spans (spans taken from the AST)
    const lit = new Uint8Array(text.length + 1);
    walk(ast.body, null, (n) => { if (n.type === 'Literal' || n.type === 'TemplateElement') lit.fill(1, n.start, n.end); });
    for (let i = 0; i < text.length; i++) {
      if (lit[i] || text[i] !== '/') continue;
      if (text[i + 1] === '/') { const e = text.indexOf('\n', i); const end = e < 0 ? text.length : e; isComment.fill(1, i, end); i = end; }
      else if (text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); const end = e < 0 ? text.length : e + 2; isComment.fill(1, i, end); i = end - 1; }
    }
  } else { // fallback: crude // stripping
    let i = 0; while ((i = text.indexOf('//', i)) >= 0) { const e = text.indexOf('\n', i); isComment.fill(1, i, e < 0 ? text.length : e); i = e < 0 ? text.length : e; }
  }
  const ex = execMap.get(f);
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const codeLines = [], execLines = [], partLines = []; // partLines: executed lines that also hold a never-executed code char
  for (let L = 0; L < lineStarts.length; L++) {
    const s = lineStarts[L], e = L + 1 < lineStarts.length ? lineStarts[L + 1] : text.length;
    let code = false, run = false, miss = false;
    for (let i = s; i < e; i++) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || isComment[i]) continue;
      code = true; if (ex && ex[i]) run = true; else miss = true;
    }
    if (code) codeLines.push(L + 1);
    if (run) execLines.push(L + 1);
    if (run && miss) partLines.push(L + 1);
  }
  const lineOf = (off) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= off) lo = m; else hi = m - 1; } return lo + 1; };
  const fns = [];
  if (ast) walk(ast.body, null, (n, p) => {
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      const b = n.body?.start ?? n.start;
      fns.push({ name: fnName(n, p), line: lineOf(n.start), end: lineOf(n.end), exec: !!(ex && ex[b]) });
    }
  });
  out.files[rel] = { loaded: !!ex, procs: procCount.get(f) || 0, parseErr, codeLines, execLines, partLines, fns };
}
fs.writeFileSync(outFile, JSON.stringify(out));
let cl = 0, el = 0, fT = 0, fE = 0, loaded = 0;
for (const v of Object.values(out.files)) { cl += v.codeLines.length; el += v.execLines.length; fT += v.fns.length; fE += v.fns.filter((x) => x.exec).length; loaded += v.loaded; }
console.log(`raw=${nRaw} files=${files.length} loaded=${loaded} lines=${el}/${cl} (${(100 * el / cl).toFixed(1)}%) fns=${fE}/${fT} (${(100 * fE / fT).toFixed(1)}%)`);
