// r37 느낌의 크기 (읽기만) — 사람 베기 결과(split_hcut_*.json) 여럿을 견줌
//  node feel_sum.mjs 이름=<json> [이름=<json> …]   (첫째를 바탕으로 봄)
//   무기 · 베기 꼴마다: 획 수 · 맞음 몫 · 칼끝 가장 빠름(관문 창) 가운데 · 첫 움직임 → 칼끝 가장 빠름 시간 가운데 · 첫 움직임 → 맞음 시간 가운데 · 맞음 에너지(판정 energy) 가운데 · 바탕과 같은 씨앗 짝의 칼끝 비 가운데
import { readFileSync } from 'node:fs';
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
const sets = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), JSON.parse(readFileSync(a.slice(i + 1), 'utf8')).rows]; });
const key = (r) => `${r.weapon} · ${r.form}`; const id = (r) => `${r.seed}|${r.form}|${r.rep ?? 0}`;
const base = new Map(sets[0][1].map((r) => [key(r) + id(r), r]));
const groups = [...new Set(sets[0][1].map(key))].sort();
console.log('| 묶음 | 칸 | 획 | 맞음 | 칼끝 가장 빠름 m/s | → 가장 빠름 s | → 맞음 s | 맞음 에너지 J | 칼끝 ÷ 바탕 (짝) | 맞음 에너지 ÷ 바탕 (짝 · 둘 다 맞음) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const g of groups) for (const [nm, rows] of sets) {
  const R = rows.filter((r) => key(r) === g && !r.fell && !r.cut); const H = R.filter((r) => r.hit);
  const ratio = R.map((r) => { const b = base.get(key(r) + id(r)); return b ? r.tipPk / b.tipPk : null; });
  const eR = H.map((r) => { const b = base.get(key(r) + id(r)); return b?.hit && b.wound && r.wound ? r.wound.E / b.wound.E : null; });
  console.log(`| ${g} | ${nm} | ${R.length} | ${H.length} | ${f1(q(R.map((r) => r.tipPk), 0.5))} | ${f3(q(R.map((r) => r.tTip), 0.5))} | ${f3(q(H.map((r) => r.tHit), 0.5))} | ${f1(q(H.map((r) => r.wound?.E), 0.5))} | ${f2(q(ratio, 0.5))} | ${f2(q(eR, 0.5))} |`);
}
