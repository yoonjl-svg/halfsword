// r28 — 바탕 칸이 r20 관문 줄을 그대로 다시 내나: 두 json 의 같은 씨앗 줄을 칸마다 견줌 (시뮬레이션 없음)
//  node repro_check.mjs <r20 gate json> <새 json>   → 줄 수 · 다른 줄 수 · 다른 칸 이름
import fs from 'node:fs';
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')).rows);
const seeds = new Set(b.map((r) => r.seed)); const A = a.filter((r) => seeds.has(r.seed));
const key = (r) => `${r.seed}|${r.scene}|${r.weapon}|${r.path}|${r.rep ?? ''}|${r.kind ?? ''}`;
let diff = 0, n = 0; const where = {};
const grp = (rows) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
const ga = grp(A), gb = grp(b);
for (const [k, ra] of ga) { const rb = gb.get(k) ?? []; if (ra.length !== rb.length) { diff++; where['count:' + k] = 1; continue; }
  ra.forEach((x, i) => { n++; const y = rb[i]; const bad = Object.keys(x).filter((c) => JSON.stringify(x[c]) !== JSON.stringify(y[c])); if (bad.length) { diff++; bad.forEach((c) => (where[c] = (where[c] ?? 0) + 1)); } }); }
console.log(`r20 줄 ${A.length} · 새 줄 ${b.length} · 견준 줄 ${n} · 다른 줄 ${diff}`, JSON.stringify(where));
