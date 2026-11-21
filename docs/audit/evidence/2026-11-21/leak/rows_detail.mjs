// Per-row audio-node and top-geometry breakdown from a leak_rounds.mjs JSON.  node rows_detail.mjs <json>
import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const r of d.rows) {
  const a = r.descr.AudioNode || {};
  const top = Object.entries(r.descr.BufferGeometry).sort((x, y) => y[1] - x[1])[0];
  console.log(r.round, r.stage, 'Convolver', a.ConvolverNode || 0, 'Gain', a.GainNode || 0, 'BufferSource', a.AudioBufferSourceNode || 0, '| top geometry', top.join(' x'));
}
