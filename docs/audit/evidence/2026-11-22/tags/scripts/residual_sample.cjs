// residual_sample.cjs <blocktag.tsv> <rows.json (old/new at the rewrite)> <keys.json of the current config> <seed> <n>
//  From the BLOCK-TAG candidates, keep those whose CURRENT comment still carries a plain owner tag
//  (no "값 감독", no "확인 전", no "감독 안/값"), then print a seeded random sample with old and current comments.
const fs = require('fs');
const [bt, rowsF, keysF, seedS = '7', nS = '30'] = process.argv.slice(2);
const cand = fs.readFileSync(bt, 'utf8').split('\n').slice(1).map((l) => l.split('\t')).filter((c) => c[0] === 'BLOCK-TAG').map((c) => c[1]);
const rows = new Map(JSON.parse(fs.readFileSync(rowsF, 'utf8')).map((r) => [r.path, r]));
const keys = new Map(JSON.parse(fs.readFileSync(keysF, 'utf8')).map((k) => [k.path, k]));
const cur = (p) => { const k = keys.get(p); if (!k) return null; let t = [k.above, k.trail].filter(Boolean).join(' ‖ '); return t; };
const hdr = (p) => { let q = p; while (q.includes('.')) { q = q.slice(0, q.lastIndexOf('.')); const k = keys.get(q); const t = k ? [k.above, k.trail].filter(Boolean).join(' ‖ ') : ''; if (/\[사장님/.test(t)) return q + ': ' + t; } return ''; };
const weak = /값 감독|확인 전|감독 안|감독 값|꼴 값 그대로|권고대로/;
const still = cand.filter((p) => { const t = cur(p); if (t == null) return false; const own = /\[사장님/.test(t); const h = hdr(p); return (own && !weak.test(t)) || (!own && !weak.test(t) && h && !/줄마다|줄의 표시대로|나머지/.test(h)); });
let s = +seedS; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const pick = []; const pool = [...still]; while (pick.length < +nS && pool.length) pick.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
console.log(`BLOCK-TAG candidates ${cand.length} · still plain-owner (own or via header) ${still.length} · sample ${pick.length} (seed ${seedS})`);
for (const p of pick) { const r = rows.get(p); console.log(`\n### ${p} = ${String(keys.get(p).value).slice(0, 40)}\nNOW: ${String(cur(p)).slice(0, 300)}${/\[사장님/.test(cur(p)) ? '' : '\n HDR: ' + hdr(p).slice(0, 260)}\nOLD: ${String(r?.oldText ?? '').slice(0, 520)}`); }
