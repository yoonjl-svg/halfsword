// Summarise a leak_rounds.mjs JSON: per-round table + histogram diff between two rows.
//  node table.mjs <json> [fromRowIndex=2] [toRowIndex=last-fight]
import fs from 'node:fs';
const [file, fromS = '2', toS] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const R = d.rows;
const C = ['Fighter', 'AI', 'BufferGeometry', 'Material', 'Texture', 'Object3D', 'Mesh', 'RenderTarget', 'RapierWorld', 'RapierRigidBody', 'RapierCollider', 'AudioNode', 'AudioBufferSourceNode', 'AudioBuffer'];
const H = ['rnd', 'stage', 'heapMB', 'geo', 'tex', 'prog', 'sObj', 'sMesh', 'sMat', 'bod', 'col', 'wasmKB', 'domN', 'domL', ...C.map((c) => c.replace('Rapier', 'R').replace('BufferGeometry', 'BufGeo').replace('AudioBufferSourceNode', 'ABSN'))];
console.log('| ' + H.join(' | ') + ' |');
console.log('|' + H.map(() => '---').join('|') + '|');
for (const r of R) {
  const v = [r.round, r.stage, r.heapMB, r.geometries, r.textures, r.programs, r.sceneObjects, r.sceneMeshes, r.sceneMaterials, r.bodies, r.colliders, (r.wasmBytes || []).map((b) => b / 1024).join('+'), r.dom.nodes, r.dom.jsEventListeners, ...C.map((c) => r.counts[c])];
  console.log('| ' + v.join(' | ') + ' |');
}
const fights = R.filter((r) => r.round !== 'end');
const a = R[+fromS], b = toS != null ? R[+toS] : fights.at(-1);
console.log(`\nfight ends: ${fights.map((r) => JSON.stringify(r.fightEnd) + ' ' + r.button).join('\n')}`);
console.log(`\nhistogram diff row ${R.indexOf(a)} (${a.round},${a.stage}) -> row ${R.indexOf(b)} (${b.round},${b.stage}); per-round = /${R.indexOf(b) - R.indexOf(a)}`);
for (const k of Object.keys(b.descr)) {
  const ha = a.descr[k] || {}, hb = b.descr[k] || {};
  const keys = new Set([...Object.keys(ha), ...Object.keys(hb)]);
  const diff = [...keys].map((x) => [x, (hb[x] || 0) - (ha[x] || 0)]).filter(([, n]) => n !== 0).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1]));
  console.log(`\n## ${k}: ${Object.values(ha).reduce((s, n) => s + n, 0)} -> ${Object.values(hb).reduce((s, n) => s + n, 0)}`);
  for (const [x, n] of diff.slice(0, 25)) console.log(`  ${n > 0 ? '+' : ''}${n}  ${x}`);
}
