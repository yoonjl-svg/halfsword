// usage: node extract.cjs <typescript-module-dir> <config.js> <out.json>
const [tsDir, file, out] = process.argv.slice(2);
const ts = require(tsDir);
const fs = require('fs');
const text = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line; // 0-based
const nLines = sf.getLineStarts().length;
const hasCode = new Array(nLines).fill(false);
const commentsByLine = Array.from({ length: nLines }, () => []);
const commentOnly = new Array(nLines).fill(false);
const comments = [];
const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
let t;
while ((t = sc.scan()) !== ts.SyntaxKind.EndOfFileToken) {
  const s = sc.getTokenPos(), e = sc.getTextPos();
  if (t === ts.SyntaxKind.SingleLineCommentTrivia || t === ts.SyntaxKind.MultiLineCommentTrivia) {
    const c = { s, e, l0: lineOf(s), l1: lineOf(e - 1), text: text.slice(s, e) };
    comments.push(c);
    commentsByLine[c.l0].push(c);
  } else if (t !== ts.SyntaxKind.WhitespaceTrivia && t !== ts.SyntaxKind.NewLineTrivia) {
    for (let l = lineOf(s); l <= lineOf(Math.max(s, e - 1)); l++) hasCode[l] = true;
    if (t === ts.SyntaxKind.CloseBraceToken) { /* template continuation not expected */ }
  }
}
for (const c of comments) for (let l = c.l0; l <= c.l1; l++) if (!hasCode[l]) commentOnly[l] = true;
const clean = (s) => s.replace(/^\/\/+/, '').replace(/^\/\*+|\*+\/$/g, '').trim();
function above(startLine) {
  const parts = []; let l = startLine - 1;
  while (l >= 0 && commentOnly[l]) { l--; }
  for (let k = l + 1; k < startLine; k++) for (const c of commentsByLine[k]) parts.push(clean(c.text));
  return { text: parts.join(' / '), from: l + 2 };
}
function onLines(a, b) { const p = []; for (let l = a; l <= b; l++) for (const c of commentsByLine[l]) if (hasCode[l] || l === a) p.push(clean(c.text)); return p; }
const keys = [];
function propName(n) { const nm = n.name; if (!nm) return null; if (ts.isIdentifier(nm) || ts.isStringLiteral(nm) || ts.isNumericLiteral(nm)) return nm.text; return nm.getText(sf); }
function visitObj(obj, path, parentIdx) {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) { keys.push({ path: path + '.<' + ts.SyntaxKind[p.kind] + '>', skipped: true }); continue; }
    const name = propName(p); const kp = path + '.' + name;
    const init = ts.isPropertyAssignment(p) ? p.initializer : p.name;
    addKey(kp, p, init, parentIdx);
  }
}
function addKey(kp, node, init, parentIdx) {
  const sl = lineOf(node.getStart(sf)), el = lineOf(node.end - 1);
  const isObj = init && ts.isObjectLiteralExpression(init);
  const ab = above(sl);
  let trail;
  if (isObj) { const cl = lineOf(init.end - 1); trail = onLines(sl, sl).concat(cl !== sl ? onLines(cl, cl) : []); }
  else trail = onLines(sl, el).filter((x, i, a) => true);
  // for leaf: drop comment-only lines inside multi-line leaf? keep all
  const idx = keys.length;
  keys.push({ path: kp, line: sl + 1, endLine: el + 1, isObj: !!isObj, value: isObj ? null : init.getText(sf).replace(/\s+/g, ' ').slice(0, 200), above: ab.text, aboveFrom: ab.from, trail: trail.join(' / '), parent: parentIdx });
  if (isObj) visitObj(init, kp, idx);
}
for (const st of sf.statements) {
  if (ts.isVariableStatement(st) && st.modifiers && st.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
    for (const d of st.declarationList.declarations) {
      if (!d.initializer) continue;
      addKey(d.name.text, st, d.initializer, -1);
    }
  }
}
fs.writeFileSync(out, JSON.stringify(keys));
console.log(file, 'keys', keys.length, 'leaves', keys.filter((k) => !k.isObj && !k.skipped).length, 'objects', keys.filter((k) => k.isObj).length, 'skipped', keys.filter((k) => k.skipped).length);
