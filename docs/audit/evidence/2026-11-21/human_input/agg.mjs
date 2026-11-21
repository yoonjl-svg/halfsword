// usage: node agg.mjs <out-dir> — per-tool counter summary from @@JC lines
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const tot = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt') && x !== '_log.txt').sort()) {
  const line = readFileSync(join(dir, f), 'utf8').split('\n').find((l) => l.startsWith('@@JC '));
  if (!line) { console.log(f, 'NO COUNTERS'); continue; }
  const C = JSON.parse(line.slice(5));
  const hits = Object.entries(C).filter(([k]) => /^hit\.(cut|stab|blunt)/.test(k)).reduce((s, [, v]) => s + v, 0);
  const inst = C['inst.applied'] || 0;
  const m = Object.entries(C).filter(([k]) => /^(m|mi|roll)\./.test(k)).map(([k, v]) => `${k}=${v}`).join(' ');
  const misc = ['kd.balance.light', 'dropSword', 'decap', 'clash.nagashi'].filter((k) => C[k]).map((k) => `${k}=${C[k]}`).join(' ');
  console.log(`${f.replace('.txt', '')}: strikeWounds=${hits} instWounds=${inst} | ${m} | ${misc}`);
  for (const [k, v] of Object.entries(C)) if (/^(m|mi|roll)\./.test(k) || k === 'inst.applied') tot[k] = (tot[k] || 0) + v;
  tot.strikeWounds = (tot.strikeWounds || 0) + hits;
}
console.log('TOTAL', JSON.stringify(tot));
