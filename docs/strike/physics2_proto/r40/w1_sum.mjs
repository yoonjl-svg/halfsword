// r40 W1 (읽기만) — r37 wrist_split.mjs 사람 베기 결과(split_*.json)에서 손목 관절 몫 wr 이 문턱을 넘는 스텝 몫
//  node w1_sum.mjs 이름=<json> [이름=<json> …] [--th=26]
//   스텝 고르기는 r37 split_sum.mjs 와 같음: 관문 획 창(k0 ~ kEnd) 안 · 칼이 아무것과도 안 닿은 스텝(nc 0) · 놓기 없음.
//   칸: 무기 · 꼴마다 스텝 수 · wr > 25 몫 · wr > th 몫 · wr 95 % · 최고 · 서보 합(srv) 최고 (N·m)
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2); const TH = +(argv.find((a) => a.startsWith('--th='))?.slice(5) ?? 26);
const q = (a, p) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(2) + ' %' : '-');
console.log(`| 무기 · 꼴 | 칸 | 스텝 | wr > 25 | wr > ${TH} | wr 95 % | wr 최고 | 서보 최고 |`); console.log('|---|---|---|---|---|---|---|---|');
const sets = argv.filter((a) => !a.startsWith('--')).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), JSON.parse(readFileSync(a.slice(i + 1), 'utf8')).rows]; });
const G = new Map();
for (const [nm, rows] of sets) for (const r of rows) {
  if (r.scene !== 'hcut' && r.scene !== 'hthrust') continue;
  const key = `${r.weapon} · ${r.form ?? 'tap'}`; const g = G.get(key) ?? G.set(key, new Map()).get(key); const xs = g.get(nm) ?? g.set(nm, []).get(nm);
  for (let i = Math.max(0, r.k0); i <= Math.min(r.steps.length - 1, r.kEnd); i++) { const x = r.steps[i]; if (!x || x.nc || x.placed) continue; xs.push(x); }
}
for (const k of [...G.keys()].sort()) for (const [nm, xs] of G.get(k)) { const n = xs.length; const wr = xs.map((x) => x.wr);
  console.log(`| ${k} | ${nm} | ${n} | ${pc(wr.filter((v) => v > 25).length / n)} | ${pc(wr.filter((v) => v > TH).length / n)} | ${f1(q(wr, 0.95))} | ${f1(Math.max(...wr))} | ${f1(Math.max(...xs.map((x) => x.srv)))} |`); }
