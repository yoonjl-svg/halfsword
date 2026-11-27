// r28 줄 표 (시뮬레이션 없음 — wb_gate json 만 읽음): P1 · P3 · P4 · P5 와 읽기 줄을 묶음마다 바탕 → 칸
//  node table.mjs --base=<A json>,<B json>[,<6001 json>] --cell=<A json>,<B json>[,<6001 json>] [--names=A,B,6001] [--json=파일]   (한 묶음만: --base=<x> --cell=<y> --names=6001)
//  줄의 뜻은 노트 r28_thrust.md '줄' 칸(재기 앞에 적음) 그대로:
//   P1 사람 길 찌르기 줄 가운데 칼끝 가장 빠름(tipPk) > 8 m/s 인 줄 = 0 (가까운 · 먼 · 두 무기 · 묶음마다) — AI 길 줄 수는 읽기
//   P3 가까운 사람 레이피어: 바탕에서 휘둘리지 않은 줄(A · B 의 tipPk ≤ 8)의 맞음 — 엇갈린 줄 부호 검정(정확 이항 · 양쪽) p ≥ 0.1 이거나 칸이 더 많음 · 가까운 사람 장검 80 줄 같은 검정
//   P4 L5 사람 레이피어 · 장검 판정 PASS (관문 json lines 의 verdict) — AI 레이피어 L5 는 읽기
//   P5 사람 길 넘어짐 0 · AI 넘어짐 /100 (장면 · 무기 넷)이 바탕의 씨앗 부트스트랩 90 % 위 끝을 넘지 않음 (judge.mjs H1 과 같은 셈 · 묶음마다 + 세 묶음 합)
//   읽기: C1 AI · AI 내려베기 휘두름 → 맞음 가운데와 획이 같은 씨앗 몫 · 가까운 탭 → 맞음 가운데(모든 줄 · 바탕 안 휘둘린 줄)
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const B = String(args.base).split(',').map(J), C = String(args.cell).split(',').map(J); const NAMES = args.names ? String(args.names).split(',') : ['A', 'B', '6001'].slice(0, B.length); // --names=6001 (한 묶음만 줄 때)
const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d)); const THR = 8;
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const binom2 = (k, n) => { if (!n) return 1; const c = (n, r) => { let x = 1; for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i; return x; }; const m = Math.min(k, n - k); let s = 0; for (let i = 0; i <= m; i++) s += c(n, i); return Math.min(1, (2 * s) / 2 ** n); };
const out = { P1: [], P3: [], P4: [], P5: [], read: [] };
const human = (R, sc, w) => R.rows.filter((r) => r.scene === sc && r.path === 'human' && r.weapon === w && r.valid);
const key = (r) => `${r.seed}|${r.rep ?? ''}`;
// P1
for (let b = 0; b < B.length; b++) for (const sc of ['near', 'far']) for (const w of ['rapier', 'longsword']) for (const p of ['human', 'ai']) {
  const sel = (R) => R.rows.filter((r) => r.scene === sc && r.path === p && r.weapon === w && r.valid); const o = sel(B[b]), n = sel(C[b]);
  if (!o.length && !n.length) continue; const ko = o.filter((r) => r.tipPk > THR).length, kn = n.filter((r) => r.tipPk > THR).length;
  const ok = p === 'human' ? kn === 0 : null; out.P1.push({ blk: NAMES[b], sc, w, p, before: [ko, o.length], after: [kn, n.length], ok });
  console.log(`P1 ${ok == null ? 'READ' : ok ? 'PASS' : 'FAIL'} 묶음 ${NAMES[b]} ${sc} ${w} ${p}: tipPk > 8 줄 ${ko}/${o.length} → ${kn}/${n.length}`); }
// P3
const sign = (label, pairs) => { const up = pairs.filter(([a, b]) => !a && b).length, dn = pairs.filter(([a, b]) => a && !b).length; const p = binom2(Math.min(up, dn), up + dn); const hb = pairs.filter(([a]) => a).length, hn = pairs.filter(([, b]) => b).length; const ok = hn >= hb || p >= 0.1;
  out.P3.push({ label, n: pairs.length, before: hb, after: hn, up, down: dn, p, ok }); console.log(`P3 ${ok ? 'PASS' : 'FAIL'} ${label}: 맞음 ${hb} → ${hn} / ${pairs.length} (엇갈림 바탕만 ${dn} · 칸만 ${up} · 양쪽 p ${f(p)})`); };
for (const [bl, bi] of B.length === 1 ? [[NAMES[0], [0]]] : [['A+B', [0, 1]], ...(B.length > 2 ? [['6001', [2]]] : [])]) {
  const pr = (w, filt) => bi.flatMap((b) => { const m = new Map(human(C[b], 'near', w).map((r) => [key(r), r])); return human(B[b], 'near', w).filter(filt).map((r) => [r.hit, !!m.get(key(r))?.hit]); });
  sign(`${bl} 가까운 사람 레이피어 · 바탕 안 휘둘린 줄`, pr('rapier', (r) => !(r.tipPk > THR)));
  sign(`${bl} 가까운 사람 장검 · 모든 줄`, pr('longsword', () => true));
  const wh = pr('rapier', (r) => r.tipPk > THR); console.log(`  읽기 ${bl} 바탕 휘둘린 레이피어 줄 ${wh.length}: 맞음 ${wh.filter(([a]) => a).length} → ${wh.filter(([, b]) => b).length}`); out.read.push({ what: `${bl} whipped rows hits`, n: wh.length, before: wh.filter(([a]) => a).length, after: wh.filter(([, b]) => b).length }); }
// P4 · C1
const line = (G, id, w, p) => G.lines.find((x) => x.id === id && x.weapon === w && x.path === p); const val = (L) => L?.shareVal ?? L?.med;
for (let b = 0; b < B.length; b++) { for (const [w, p] of [['rapier', 'human'], ['longsword', 'human'], ['rapier', 'ai']]) { const o = line(B[b], 'L5', w, p), n = line(C[b], 'L5', w, p); const ok = p === 'human' ? n?.verdict === 'PASS' : null;
    out.P4.push({ blk: NAMES[b], w, p, before: val(o), after: val(n), vb: o?.verdict, va: n?.verdict, nA: n?.n, ok }); console.log(`P4 ${ok == null ? 'READ' : ok ? 'PASS' : 'FAIL'} 묶음 ${NAMES[b]} L5 ${w} ${p}: ${f(val(o))} (${o?.verdict}) → ${f(val(n))} (${n?.verdict} · n ${n?.n})`); }
  const o = line(B[b], 'C1', 'longsword', 'ai'), n = line(C[b], 'C1', 'longsword', 'ai'); out.read.push({ what: `C1 AI ${NAMES[b]}`, before: val(o), after: val(n) }); console.log(`  읽기 C1 AI 묶음 ${NAMES[b]}: ${f(val(o))} (${o?.verdict}) → ${f(val(n))} (${n?.verdict})`); }
// P5 (judge.mjs H1 의 셈 · 묶음마다 + 합)
const fallsOf = (R, sc, w, p) => { const by = new Map(); for (const r of R) if (r.scene === sc && r.weapon === w && r.path === p && !r.cut) { if (!by.has(r.seed)) by.set(r.seed, [0, 0]); const x = by.get(r.seed); x[0]++; if (r.fell) x[1]++; } return by; };
const rate = (by, keys) => { let n = 0, k = 0; for (const s of keys) { const x = by.get(s); if (x) { n += x[0]; k += x[1]; } } return n ? (100 * k) / n : NaN; };
const cnt = (by) => [...by.values()].reduce((s, x) => [s[0] + x[1], s[1] + x[0]], [0, 0]);
const groups = [...B.map((_, b) => [NAMES[b], [b]]), ['합', B.map((_, b) => b)]];
for (const [gl, bi] of groups) for (const p of ['human', 'ai']) for (const w of ['rapier', 'longsword']) for (const sc of ['far', 'near']) {
  const RB = bi.flatMap((b) => B[b].rows), RC = bi.flatMap((b) => C[b].rows); const o = fallsOf(RB, sc, w, p), n = fallsOf(RC, sc, w, p); const seeds = [...o.keys()], seedsN = [...n.keys()]; if (!seeds.length && !seedsN.length) continue;
  // 위 끝은 바탕 씨앗만으로 (r28 읽기 지적 3: 전에는 바탕 ∪ 칸 씨앗을 뽑아 칸을 보기 앞에 적은 위 끝 18.2 와 쓴 위 끝 18.0 이 달랐다) — 칸을 보기 앞에 적은 수가 쓰는 수
  const ro = rate(o, seeds), rn = rate(n, seedsN); const R = rng(4242); const bo = []; for (let k = 0; k < 2000; k++) { const ks = seeds.map(() => seeds[Math.floor(R() * seeds.length)]); bo.push(rate(o, ks)); }
  const hi = q(bo, 0.95); const ok = p === 'human' ? cnt(n)[0] === 0 : !(rn > hi);
  out.P5.push({ blk: gl, p, w, sc, before: ro, after: rn, hi, cb: cnt(o), ca: cnt(n), ok }); console.log(`P5 ${ok ? 'PASS' : 'FAIL'} 묶음 ${gl} ${p} ${w} ${sc}: 넘어짐 /100 ${f(ro, 1)} (${cnt(o).join('/')}) [바탕 90 % 위 ${f(hi, 1)}] → ${f(rn, 1)} (${cnt(n).join('/')})`); }
// 읽기: AI 내려베기 휘두름 → 맞음 · 가까운 탭 → 맞음
for (let b = 0; b < B.length; b++) { const sel = (R) => R.rows.filter((r) => r.scene === 'cut' && r.path === 'ai' && r.desc && r.hit && !r.fell); const o = sel(B[b]), n = sel(C[b]);
  const by = (R) => { const m = new Map(); for (const r of R) { if (!m.has(r.seed)) m.set(r.seed, []); m.get(r.seed).push(r); } return m; }; const mo = by(o), mn = by(n); const seeds = [...new Set([...mo.keys(), ...mn.keys()])];
  const k2 = (L) => JSON.stringify((L ?? []).map((r) => [r.tHit, r.footGap])); const same = seeds.filter((s) => k2(mo.get(s)) === k2(mn.get(s))).length;
  out.read.push({ what: `AI desc swing→hit ${NAMES[b]}`, before: q(o.map((r) => r.tHit), 0.5), after: q(n.map((r) => r.tHit), 0.5), same, seeds: seeds.length });
  console.log(`  읽기 AI 내려베기 휘두름 → 맞음 묶음 ${NAMES[b]}: 가운데 ${f(q(o.map((r) => r.tHit), 0.5))} → ${f(q(n.map((r) => r.tHit), 0.5))} s · 획이 같은 씨앗 ${same}/${seeds.length}`);
  for (const w of ['rapier', 'longsword']) { const hb = human(B[b], 'near', w), hc = new Map(human(C[b], 'near', w).map((r) => [key(r), r])); const tt = (rs) => q(rs.filter((r) => r?.hit).map((r) => r.tHit), 0.5);
    const nw = hb.filter((r) => !(r.tipPk > THR)); out.read.push({ what: `near tap→hit ${w} ${NAMES[b]}`, all: [tt(hb), tt([...hc.values()])], nonWhip: [tt(nw), tt(nw.map((r) => hc.get(key(r))))] });
    console.log(`  읽기 가까운 탭 → 맞음 ${w} 묶음 ${NAMES[b]}: 모든 줄 ${f(tt(hb))} → ${f(tt([...hc.values()]))} s · 바탕 안 휘둘린 줄 ${f(tt(nw))} → ${f(tt(nw.map((r) => hc.get(key(r)))))} s`); } }
// 읽기 (r28 읽기 지적 6 — 손님 느낌): 가까운 사람 레이피어 탭 모든 줄의 맞음 수 · 맞은 줄의 맞을 때 칼끝 tipPk 가운데
for (let b = 0; b < B.length; b++) { const hb = human(B[b], 'near', 'rapier'), hc = human(C[b], 'near', 'rapier'); const h = (rs) => rs.filter((r) => r.hit);
  out.read.push({ what: `near human rapier hits ${NAMES[b]}`, before: [h(hb).length, hb.length], after: [h(hc).length, hc.length] });
  console.log(`  읽기 가까운 사람 레이피어 맞음 묶음 ${NAMES[b]}: ${h(hb).length}/${hb.length} → ${h(hc).length}/${hc.length} · 맞은 줄 칼끝 가장 빠름 가운데 ${f(q(h(hb).map((r) => r.tipPk), 0.5), 1)} → ${f(q(h(hc).map((r) => r.tipPk), 0.5), 1)} m/s`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
