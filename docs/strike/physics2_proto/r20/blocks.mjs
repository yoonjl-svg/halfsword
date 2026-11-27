// ─────────────────────────────────────────────────────────────
//  blocks.mjs — 관문 두 씨앗 묶음 견줌(흔들림) + 굳은 금 2 (런지 100 번에 넘어짐). 시뮬레이션 없음 — wb_gate 의 json 만 읽는다.
//   node docs/strike/physics2_proto/r20/blocks.mjs <묶음 A json> <묶음 B json> [--spread=파일] [--falls=파일]
//   흔들림 = 줄마다 두 묶음 가운데값의 차 |A − B| 와 씨앗 부트스트랩 90 % 구간. 나중 바뀜은 '진짜 바뀜 문턱'(= max(|A − B|, 두 구간 반폭 합, 과녁 폭 10 %))보다 커야 '진짜'.
//   두 묶음 판정 = 둘 다 PASS 일 때만 PASS · 한쪽만 PASS 면 SPLIT(통과 아님).
//   넘어짐 = 획을 시작해 3 s 안에 선 자세(stand)를 잃은 번 · 안 돌아옴 = 안 넘어졌지만 3 s 안에 자세로 못 돌아온 번 (둘 다 획 셈에서 빠짐) — 100 번 당.
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--')); const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [A, B] = pos.map((p) => JSON.parse(readFileSync(p, 'utf8')));
const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const spread = []; let bothPass = 0, bothM = 0;
console.log(`줄마다 두 묶음: A 씨앗 ${A.seeds.join('~')} · B 씨앗 ${B.seeds.join('~')}`);
for (const a of A.lines) {
  const b = B.lines.find((x) => x.id === a.id && x.weapon === a.weapon && x.path === a.path); if (!b) continue;
  const va = a.shareVal ?? a.med, vb = b.shareVal ?? b.med; const d = Math.abs(va - vb);
  // 읽기 지적 7: 흔들림 한 표본(|A − B|)만으로 가르지 않는다. 진짜 바뀜의 문턱 = max(|A − B|, 두 묶음 씨앗 부트스트랩 90 % 구간 반폭의 합, 과녁 폭의 10 %)
  const hw = (o) => (Number.isFinite(o.ciHi) && Number.isFinite(o.ciLo) ? (o.ciHi - o.ciLo) / 2 : NaN); const width = a.lo != null && a.hi != null ? Math.abs(a.hi - a.lo) : NaN;
  const minReal = Math.max(d, Number.isFinite(hw(a) + hw(b)) ? hw(a) + hw(b) : 0, Number.isFinite(width) ? 0.1 * width : 0);
  // 두 묶음 판정: 둘 다 PASS 일 때만 PASS (한 묶음만 PASS = 'SPLIT' · 통과 아님)
  const both = a.verdict === 'READ' ? 'READ' : a.verdict === 'PASS' && b.verdict === 'PASS' ? 'PASS' : a.verdict === 'PASS' || b.verdict === 'PASS' ? 'SPLIT' : a.verdict === 'TOO FEW' || b.verdict === 'TOO FEW' ? 'TOO FEW' : 'FAIL';
  spread.push({ id: a.id, weapon: a.weapon, path: a.path, name: a.name, A: va, B: vb, diff: d, ciA: [a.ciLo, a.ciHi], ciB: [b.ciLo, b.ciHi], minReal, nA: a.n, nB: b.n, vA: a.verdict, vB: b.verdict, both, kind: a.shareVal != null ? 'share' : 'median' });
  console.log(`  ${both.padEnd(7)} ${a.id} ${a.weapon.padEnd(9)} ${a.path.padEnd(5)} ${a.name.padEnd(22)} ${a.shareVal != null ? '몫' : '가운데'} A ${f(va)} [${f(a.ciLo)} ~ ${f(a.ciHi)}] (${a.n} · ${a.verdict}) · B ${f(vb)} [${f(b.ciLo)} ~ ${f(b.ciHi)}] (${b.n} · ${b.verdict}) · 차 ${f(d)} · 진짜 바뀜 문턱 ${f(minReal)}`);
}
for (const x of spread) if (x.both !== 'READ') { bothM++; if (x.both === 'PASS') bothPass++; }
console.log(`두 묶음 GATE wholebody: ${bothM && bothPass === bothM ? 'PASS' : 'FAIL'} (두 묶음 모두 PASS ${bothPass} of ${bothM})`);
console.log('가까운 찌르기 (적기만): A · B · 차');
const nearSpread = {};
for (const k of Object.keys(A.near ?? {})) for (const m of Object.keys(A.near[k])) { const va = A.near[k][m].med, vb = B.near?.[k]?.[m]?.med; nearSpread[`${k}/${m}`] = { A: va, B: vb, diff: Math.abs(va - vb), nA: A.near[k][m].n, nB: B.near?.[k]?.[m]?.n }; }
for (const k of Object.keys(A.near ?? {})) console.log(`  ${k.padEnd(16)} ` + ['pelPk', 'ratio', 'tHit', 'tipPk'].map((m) => { const x = nearSpread[`${k}/${m}`]; return `${m} ${f(x.A, 2)} · ${f(x.B, 2)} · ${f(x.diff, 2)}`; }).join(' | '));
// 넘어짐
const falls = {};
console.log('넘어짐 · 안 돌아옴 (100 번 당 · 두 묶음 합)');
for (const scene of ['far', 'near']) for (const w of ['rapier', 'longsword']) for (const path of ['human', 'ai']) {
  const k = `${scene}/${w}/${path}`; const ca = A.counts[k], cb = B.counts[k]; if (!ca || !cb) continue;
  const n = ca.strokes + cb.strokes, fell = ca.fell + cb.fell, nb = ca.notBack + cb.notBack;
  falls[k] = { strokes: n, fell, notBack: nb, fellPer100: n ? (100 * fell) / n : null, notBackPer100: n ? (100 * nb) / n : null, A: { strokes: ca.strokes, fell: ca.fell, notBack: ca.notBack }, B: { strokes: cb.strokes, fell: cb.fell, notBack: cb.notBack } };
  console.log(`  ${(scene === 'far' ? '먼 런지' : '가까운 찌르기').padEnd(7)} ${w.padEnd(9)} ${path.padEnd(5)} 획 ${String(n).padStart(4)} · 넘어짐 ${f(falls[k].fellPer100, 1)} /100 (A ${ca.fell}/${ca.strokes} · B ${cb.fell}/${cb.strokes}) · 안 돌아옴 ${f(falls[k].notBackPer100, 1)} /100`);
}
if (args.spread) writeFileSync(args.spread, JSON.stringify({ A: A.seeds, B: B.seeds, rule: 'both = 두 묶음 모두 PASS · minReal = max(|A-B|, 구간 반폭 합, 과녁 폭 10 %)', bothPass, bothM, lines: spread, near: nearSpread }, null, 1));
if (args.falls) writeFileSync(args.falls, JSON.stringify({ A: A.seeds, B: B.seeds, note: '넘어짐 = 시작 뒤 3 s 안에 stand 를 잃음 · 안 돌아옴 = 안 넘어졌으나 3 s 안에 자세(선 채 두 발 · 탭/휘두르기 끝 · 골반 ≥ 시작의 90 %)로 못 옴', falls }, null, 1));
