// Rewrite a .cpuprofile taken on the production build to original source files/names using the build's source maps.
//  node prof_map.mjs <in.cpuprofile> <distDir> <out.cpuprofile> <moduleDirWithSourceMapJs>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const [inp, dist, out, modDir] = process.argv.slice(2);
const { SourceMapConsumer } = createRequire(path.resolve(modDir) + '/')('source-map-js');
const p = JSON.parse(fs.readFileSync(inp));
const cons = {};
const get = (url) => {
  const m = url.match(/\/(assets\/[^?]+\.js)/); if (!m) return null;
  if (!(m[1] in cons)) { const f = path.join(dist, m[1] + '.map'); cons[m[1]] = fs.existsSync(f) ? new SourceMapConsumer(JSON.parse(fs.readFileSync(f))) : null; }
  return cons[m[1]];
};
let mapped = 0;
for (const n of p.nodes) {
  const c = n.callFrame; if (!c.url) continue;
  const sm = get(c.url); if (!sm) continue;
  const o = sm.originalPositionFor({ line: c.lineNumber + 1, column: c.columnNumber });
  if (!o.source) continue;
  const src = o.source.replace(/^(\.\.\/)+/, '').replace(/^.*node_modules\/three\/build\//, 'deps/three/').replace(/^.*node_modules\/@dimforge\//, 'deps/rapier/');
  c.url = 'http://x/' + src; c.functionName = (o.name && c.functionName.length <= 3 ? o.name : c.functionName) + (c.functionName.length <= 3 ? '~' + c.functionName : '');
  c.lineNumber = o.line - 1; mapped++;
}
fs.writeFileSync(out, JSON.stringify(p));
console.log('mapped nodes', mapped, 'of', p.nodes.length);
