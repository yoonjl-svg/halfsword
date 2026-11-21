// Point probes into raw V8 coverage: for each probe (file, line, substring) report which processes executed that char.
// usage: node probe.mjs <checkout> <probes.json> <label=rawDir> [<label=rawDir> ...]
// probes.json: [{ "id": "...", "file": "src/x.js", "line": 123, "sub": "text on that line" }]
// A process is labelled by the tools/sim/*.mjs script(s) it loaded that are a test file or gate (first match).
// Count at a char = count of the innermost (shortest) range containing it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [, , checkoutArg, probesFile, ...sets] = process.argv;
const root = path.resolve(checkoutArg);
const probes = JSON.parse(fs.readFileSync(probesFile, 'utf8'));
const texts = new Map();
for (const p of probes) {
  const abs = path.join(root, p.file);
  if (!texts.has(abs)) texts.set(abs, fs.readFileSync(abs, 'utf8'));
  const t = texts.get(abs);
  const lines = t.split('\n');
  let off = 0;
  for (let i = 0; i < p.line - 1; i++) off += lines[i].length + 1;
  const L = lines[p.line - 1] ?? '';
  const k = p.sub ? L.indexOf(p.sub) : L.search(/\S/);
  if (k < 0) { p.err = `sub not found on line: ${p.sub}`; continue; }
  p.abs = abs; p.off = off + k;
}
const toPath = (u) => { u = u.split('?')[0]; try { return u.startsWith('file:') ? fileURLToPath(u) : u; } catch { return u; } };
const res = probes.map(() => ({}));
for (const s of sets) {
  const [label, dir] = s.split('=');
  for (const fn of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch { continue; }
    const byPath = new Map();
    let who = null;
    for (const sc of j.result || []) {
      const p = toPath(sc.url);
      byPath.set(p, sc);
      const m = p.match(/tools\/sim\/([^/]+\.mjs)$/);
      if (m && (m[1].endsWith('.test.mjs') || !who)) { if (!who || m[1].endsWith('.test.mjs')) who = m[1]; }
    }
    who = who || '(runner)';
    probes.forEach((p, i) => {
      if (p.err) return;
      const sc = byPath.get(p.abs);
      if (!sc) return;
      let best = null;
      for (const f of sc.functions) for (const r of f.ranges)
        if (r.startOffset <= p.off && p.off < r.endOffset && (!best || r.endOffset - r.startOffset <= best.endOffset - best.startOffset)) best = r;
      if (best && best.count > 0) { (res[i][label] ??= new Set()).add(who); }
    });
  }
}
for (const [i, p] of probes.entries()) {
  const r = res[i];
  const parts = Object.entries(r).map(([k, v]) => `${k}:${[...v].join(',')}`);
  console.log(`${p.id}\t${p.file}:${p.line}\t${p.err ?? (parts.length ? parts.join(' | ') : 'NOTHING')}`);
}
