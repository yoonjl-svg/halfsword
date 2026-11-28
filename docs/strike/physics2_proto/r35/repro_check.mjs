// r35 — ai_tip_trace.mjs 의 획이 관문 줄(wb_gate.mjs --json 의 rows · AI 길 찌르기)을 그대로 다시 내는지 (읽기만)
//  node repro_check.mjs --trace=<trace_*.json> --gate=<gate_*.json>
//   씨앗 · 무기 · 장면 · 차례(같은 씨앗 · 무기 안의 순서)로 짝짓고 tipPk · hit · tHit · gap0 를 견줌.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const T = JSON.parse(readFileSync(String(args.trace), 'utf8')).strokes; const G = JSON.parse(readFileSync(String(args.gate), 'utf8')).rows.filter((r) => r.path === 'ai' && r.scene !== 'cut');
let same = 0, diff = 0, miss = 0; const bad = [];
const keys = [...new Set(T.map((r) => `${r.weapon}|${r.seed}`))];
for (const k of keys) { const [w, s] = k.split('|'); const a = T.filter((r) => r.weapon === w && r.seed === +s); const b = G.filter((r) => r.weapon === w && r.seed === +s);
  if (a.length !== b.length) bad.push(`${k}: 획 수 ${a.length} 대 관문 ${b.length}`);
  // 관문 rows 는 몸(player 먼저 · enemy 다음) 차례 · 몸 안에서 사건 차례 — 대본도 같은 차례로 쌓음
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i], y = b[i]; if (!x || !y) { miss++; continue; }
    const ok = Math.abs(x.tipPk - y.tipPk) < 1e-9 && x.hit === y.hit && x.scene === y.scene && Math.abs(x.gap0 - y.gap0) < 1e-9; if (ok) same++; else { diff++; if (bad.length < 20) bad.push(`${k} #${i}: tipPk ${x.tipPk.toFixed(3)} 대 ${y.tipPk.toFixed(3)} · hit ${x.hit} 대 ${y.hit} · scene ${x.scene} 대 ${y.scene}`); } } }
console.log(`짝 ${same + diff} · 같음 ${same} · 다름 ${diff} · 짝 없음 ${miss}`); for (const l of bad) console.log('  ' + l);
