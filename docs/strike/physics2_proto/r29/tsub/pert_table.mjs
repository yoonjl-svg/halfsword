// pert.jsonl (run_pert.sh) → 값 짝마다: 시험 통과 · 닿기 앞 넘어짐(preFall) · 판 안 넘어짐 · 넘어짐 갈래 · 첫 베기 시작 · 가장 가까운 거리
//  node pert_table.mjs <pert.jsonl> [--rows] > 표
import { readFileSync } from 'node:fs';
const f = process.argv[2], rows = process.argv.includes('--rows');
const R = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const by = new Map();
for (const r of R) { const [set, p] = r.tag.split('|'); if (!by.has(set)) by.set(set, []); by.get(set).push({ ...r, p }); }
console.log('| 값 짝 | 판 | 통과 | 닿기 앞 넘어짐 | 14 s 안 넘어짐 | 넘어짐 갈래 | 넘어진 때 | 베기 시작 없음 | 가장 가까운 거리 p50 |');
console.log('|---|---|---|---|---|---|---|---|---|');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
for (const [set, A] of by) {
  const n = A.length, pre = A.filter((r) => r.preFall), anyF = A.filter((r) => r.fall);
  const kinds = {}; for (const r of anyF) kinds[r.fall.cause] = (kinds[r.fall.cause] ?? 0) + 1;
  console.log(`| ${set} | ${n} | ${A.filter((r) => r.pass).length} | ${pre.length} | ${anyF.length} | ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'} | ${anyF.map((r) => r.fall.t.toFixed(1)).join(' ') || '-'} | ${A.filter((r) => r.firstCombo == null).length} | ${med(A.map((r) => r.minD)).toFixed(2)} |`);
}
if (rows) for (const r of R) console.log(`${r.tag.padEnd(22)} pass ${r.pass ? 1 : 0} pre ${r.preFall ? 1 : 0} fall ${r.fall ? r.fall.t + ' ' + r.fall.cause : '-'} combo1 ${r.firstCombo ?? '-'} minD ${r.minD}`);
