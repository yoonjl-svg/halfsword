// r41 걸음 1 깊이 재기 — 표 (시뮬 없음 · pierce_depth.mjs 의 json 만 셈)
//  node pierce_table.mjs --out=<결과 폴더> → 표 다섯: ① 깊이 분포 ② 깊이를 멈추게 한 것 ③ 정직 검산 ④ 칼끝 문 수 대 r38 push_depth 칼끝 수 ⑤ 상처 수
//  멈춘 것(가장 깊을 때 · 차례대로 첫째): 살갗에서 멎음(안 뚫림) · 지나감(dMax ≥ Lexit − 0.5 cm) · 코등이·칼자루가 상대 몸에 엔진 닿음 · 공격자 팔이 상대 몸에 닿음 ·
//   상대 밀려남(그 토막의 칼 축 빠르기 > 0.3 m/s — 칼끝과 함께 움직임) · 공격자 멈춤(나머지). 0.3 m/s 는 이 표의 가름 잣대 [확인 전].
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const O = String(args.out ?? '.');
const load = (n) => { const f = join(O, n + '.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };
const G = ['L1', 'L2', 'N', 'F']; const GN = { L1: '런지 팔 먼저', L2: '런지 팔 기다림', N: '가까운', F: '싸움' }; const FPS = [10, 60, 230]; const FFS = [0, 26];
const q = (a0, p) => { const a = a0.filter(Number.isFinite); if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const cm = (x) => (x == null ? '-' : (x * 100).toFixed(1)); const f2 = (x) => (x == null ? '-' : x.toFixed(2));
const cells = (o, g) => { // 묶음 안의 칸: 무기 (· 런지면 add)
  const m = new Map(); if (!o) return m;
  for (const r of o.runs) { const k = r.W + (g.startsWith('L') ? ` +${r.add}` : ''); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return new Map([...m.entries()].sort());
};
const P = (runs) => runs.flatMap((r) => r.pierces.filter((p) => p.entered));
function stopper(p) {
  if (!p.pierced) return 'skin';
  if (p.Lexit != null && p.dMax >= p.Lexit - 0.005) return 'through';
  if (p.peak?.hiltJ > 0) return 'hilt';
  if (p.peak?.armJ > 0) return 'arm';
  if (p.peak?.vicAx > 0.3) return 'pushed';
  return 'stopped';
}
const L = [];
L.push(`r41 걸음 1 — 칼끝 문 + 살갗 스프링 (상처 판정 그대로) · 결과 폴더 ${O.replace(/^.*\/r41\//, '$S/r41/')}`);
L.push('깊이 = 들어온 점 E(겉 · 광선)에서 칼끝까지 칼 축 깊이 · 칼끝 든 = 칼끝 문이 열리고 칼끝이 실제로 그 토막 안에 듦(entered) · 뚫림 = 깊이 ≥ XP 20 mm');
L.push('');
L.push('## ① 깊이 분포 — 칼끝 든 수 · 뚫린 수 · 깊이 cm 10 · 50 · 90 % · 가장 큼 · 들어올 때 칼 축 빠르기 50 % m/s · 걸린 시간 50 % s · 충격량 합 50 % N·s · 한 일 50 % J');
for (const ff of FFS) for (const g of G) {
  for (const fp of FPS) {
    const o = load(`fp${fp}_ff${ff}_${g}`); if (!o) continue;
    for (const [k, runs] of cells(o, g)) {
      const ps = P(runs); const d = ps.map((p) => p.dMax);
      L.push(`FF ${ff} | ${g} ${GN[g]} | ${k} | FP ${fp} | 든 ${ps.length} · 뚫림 ${ps.filter((p) => p.pierced).length} | 깊이 ${cm(q(d, 0.1))} · ${cm(q(d, 0.5))} · ${cm(q(d, 0.9))} · ${cm(d.length ? Math.max(...d) : null)} | v ${f2(q(ps.map((p) => p.vIn), 0.5))} | 시간 ${f2(q(ps.map((p) => p.dur), 0.5))} | J ${f2(q(ps.map((p) => p.Jsum), 0.5))} | 일 ${f2(q(ps.map((p) => p.W), 0.5))}`);
    }
  }
}
L.push('');
L.push('## ② 깊이를 멈추게 한 것 (FF 0 · 칼끝 든 것만) — 살갗에서 멎음 · 지나감 · 코등이 · 팔 · 상대 밀려남 · 공격자 멈춤 | 끝: 겹침 없음 clear · 사라짐 gone · 장면 끝에 남음');
for (const g of G) for (const fp of FPS) {
  const o = load(`fp${fp}_ff0_${g}`); if (!o) continue;
  for (const [k, runs] of cells(o, g)) {
    const ps = P(runs); const c = { skin: 0, through: 0, hilt: 0, arm: 0, pushed: 0, stopped: 0 }; for (const p of ps) c[stopper(p)]++;
    const e = { clear: 0, gone: 0, open: 0 }; for (const p of ps) e[p.end === 'clear' ? 'clear' : p.end === 'gone' ? 'gone' : 'open']++;
    L.push(`${g} | ${k} | FP ${fp} | ${c.skin} · ${c.through} · ${c.hilt} · ${c.arm} · ${c.pushed} · ${c.stopped} | 끝 ${e.clear} · ${e.gone} · ${e.open}`);
  }
}
L.push('');
L.push('## ③ 정직 검산 — 건 충격량 쌍의 합 |ΣJ| 최대 (N·s) · 원점 둘레 토크 합 |Στ| 최대 · 쌍이 아닌 스텝 · 끝 스텝에 엔진 닿음 목록에 겹침(contactDist < 0) · 되돌린 다음 스텝 엔진 충격량 > 0 (수 · 최대 N·s) · 몸 안 칼날이 상대 다른 토막과 엔진 닿음 (수 · 최대 N·s)');
for (const ff of FFS) for (const g of G) for (const fp of FPS) {
  const o = load(`fp${fp}_ff${ff}_${g}`); if (!o) continue;
  const ps = P(o.runs); const sJ = Math.max(0, ...o.runs.map((r) => r.chk.maxSumJ)), sT = Math.max(0, ...o.runs.map((r) => r.chk.maxSumT)); const odd = o.runs.reduce((a, r) => a + r.chk.oddSteps, 0);
  const ov = ps.filter((p) => p.endDist != null && p.endDist < 0).length; const rj = ps.filter((p) => p.restoreJ > 0); const jo = ps.filter((p) => p.Jother > 0);
  L.push(`FF ${ff} | ${g} | FP ${fp} | ${sJ.toExponential(1)} · ${sT.toExponential(1)} · ${odd} | 겹침 ${ov} / ${ps.filter((p) => p.end).length} | 되돌림 ${rj.length} · ${f2(rj.length ? Math.max(...rj.map((p) => p.restoreJ)) : 0)} | 다른 토막 ${jo.length} · ${f2(jo.length ? Math.max(...jo.map((p) => p.Jother)) : 0)}`);
}
L.push('');
// r38 push_depth.txt §1 '칼끝 닿음' 칸 (오늘 칸 · nf 칸) — 읽은 값
const PD = { 'L1|longsword +0.3': [5, 4], 'L1|longsword +0.45': [16, 17], 'L1|rapier +0.3': [26, 26], 'L1|rapier +0.45': [46, 46], 'L2|longsword +0.3': [1, 2], 'L2|longsword +0.45': [1, 6], 'L2|rapier +0.3': [27, 32], 'L2|rapier +0.45': [25, 38], 'N|longsword': [9, 9], 'N|rapier': [7, 20], 'F|longsword': [2, 4], 'F|rapier': [8, 25] };
L.push('## ④ 칼끝 문에 든 수 대 r38 push_depth 칼끝 닿음 (오늘 칸 · nf 칸 — 읽은 값) — FP 10 · FF 0 · 문 열림(든 + 안 든) · 든 · 묶음(같은 공격자 · 토막의 0.1 s 넘게 끊긴 듦) · 칼끝 든 판 수 · 묶음이 ±1 로 맞나');
{ for (const g of G) { const o = load(`fp10_ff0_${g}`); if (!o) continue;
  for (const [k, runs] of cells(o, g)) { const pd = PD[`${g}|${k}`]; const all = runs.flatMap((r) => r.pierces); const ps = P(runs); const nr = runs.filter((r) => r.pierces.some((p) => p.entered)).length;
    let ne = 0; for (const r of runs) { const last = new Map(); for (const p of r.pierces.filter((x) => x.entered).sort((a, b) => a.kOpen - b.kOpen)) { const key = `${p.att}:${p.part}`; const e = last.get(key); if (e == null || p.kOpen - e > 12) ne++; last.set(key, p.k0 + Math.round((p.dur ?? 1e3) * 120)); } } // 묶음 = 같은 공격자 · 토막에서 0.1 s 넘게 끊긴 칼끝 듦 (r36 닿음 토막과 같은 끊김)
    L.push(`${g} | ${k} | 열림 ${all.length} · 든 ${ps.length} · 묶음 ${ne} · 판 ${nr} | push_depth ${pd ? pd.join(' · ') : '-'} | 묶음 ±1 오늘 ${pd ? (Math.abs(ne - pd[0]) <= 1 ? '예' : '아니오') : '-'} · nf ${pd ? (Math.abs(ne - pd[1]) <= 1 ? '예' : '아니오') : '-'}`); } } }
L.push('');
L.push('## ⑤ 상처 수 (combat.strike 의 상처 줄 · 공격자 → 상대) — 바탕 | FP 10 · 60 · 230 (FF 0) | FP 10 · 60 · 230 (FF 26) · 상처 줄 / 그 가운데 찌르기 (상처가 난 판 수 · p = 칼끝 길에서 난 상처)');
for (const g of G) { const b = load(`base_${g}`); const keys = new Set([...cells(b, g).keys()]);
  for (const k of keys) {
    const cnt = (o) => { if (!o) return '-'; const runs = cells(o, g).get(k) ?? []; const w = runs.flatMap((r) => r.rows.filter((x) => x.cat === 'wound')); const nr = runs.filter((r) => r.rows.some((x) => x.cat === 'wound')).length; const pw = w.filter((x) => x.pierce).length; const ws = w.filter((x) => x.type === 'stab').length; return `${w.length}/${ws}(${nr}${o.pierce ? '·p' + pw : ''})`; };
    L.push(`${g} | ${k} | 바탕 ${cnt(b)} | ${FPS.map((fp) => cnt(load(`fp${fp}_ff0_${g}`))).join(' · ')} | ${FPS.map((fp) => cnt(load(`fp${fp}_ff26_${g}`))).join(' · ')}`);
  } }
console.log(L.join('\n'));
