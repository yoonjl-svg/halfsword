// r28 읽기 지적 5 — miss_class.mjs 가 낸 json 으로 맞음 · 문턱 밑 줄을 가름 (시뮬레이션 없음): 간격 · 첫 가슴 닿음 스텝 · 그때 칼끝 · 에너지 · 칼끝 가장 빠름 · 골반 앞 이동
//  node miss_split.mjs <miss_a.json>
import { readFileSync } from 'node:fs';
const J = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rng = (a, d = 2) => (a.length ? `${Math.min(...a).toFixed(d)} ~ ${Math.max(...a).toFixed(d)}` : '-');
const by = new Map(); for (const r of J.rows) { if (!by.has(r.cls)) by.set(r.cls, []); by.get(r.cls).push(r); }
const first = (r) => (r.strikes ?? []).find((s) => s.i > 0 && s.E != null) ?? null; // 탭 뒤 처음 에너지를 잰 닿음
console.log(`| 갈래 | 줄 | 간격 m | 탭 때(스텝 0) 이미 몸에 닿음 | 첫 잰 닿음 스텝 | 그때 칼끝 m/s | 그때 에너지 J | 칼끝 가장 빠름 m/s | 골반 앞 m |`); console.log('|---|---|---|---|---|---|---|---|---|');
for (const [c, rs] of by) { const st = rs.map((r) => ({ s: first(r), r })).filter((x) => x.s); const at0 = rs.filter((r) => (r.strikes ?? []).some((s) => s.i === 0)).length;
  console.log(`| ${c} | ${rs.length} | ${rng(rs.map((r) => r.gap), 3)} | ${at0}/${rs.length} | ${rng(st.map((x) => x.s.i), 0)} | ${rng(st.map((x) => x.s.tipV), 1)} | ${rng(st.map((x) => x.s.E), 1)} | ${rng(rs.map((r) => r.tipPk), 1)} | ${rng(rs.map((r) => r.pelFwd), 2)} |`); }
for (const r of J.rows.filter((r) => r.seed === 4005 || r.seed === 4011)) console.log(`씨앗 ${r.seed} ${r.cls}: 간격 ${r.gap} · 닿음 ${JSON.stringify(r.strikes?.map((s) => [s.i, s.part, s.E == null ? null : +s.E.toFixed(1), +(s.tipV ?? 0).toFixed(1)]))} · 칼끝 가장 빠름 ${r.tipPk.toFixed(1)} · 골반 ${(r.pelFwd ?? NaN).toFixed(2)}`);
