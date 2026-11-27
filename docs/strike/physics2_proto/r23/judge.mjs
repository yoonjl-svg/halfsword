// r23 T1 판정 (시뮬레이션 없음 — wb_gate json 만 읽음): G1 · G2 · H1 의 줄마다 PASS / FAIL
//  node judge.mjs --baseA=<r20 gate_4001-4040.json> --baseB=<r20 gate_4041-4080.json> --newA=<새 A> --newB=<새 B> --spread=<r20 spread.json> [--json=파일]
//  G1: 사람 L5(레이피어 · 장검) · AI C1 · 사람 C1 · C2(두 길)이 두 새 묶음 모두 PASS · 그 밖 줄(판정 · 읽기)이 나쁜 쪽(과녁에서 멀어짐)으로 문턱(spread.json minReal)보다 더 움직이지 않음 — 묶음마다 옛 대 새
//  G2: 가까운 찌르기(사람 길) 탭 → 맞음 가운데값이 옛 값 + 한 스텝(0.0083 s) 넘게 길지 않음(무기마다 · 두 묶음 합) · AI 내려베기 휘두르기 시작 → 맞음 가운데값 차 ≤ 한 스텝
//  H1: 사람 길 넘어짐 0 · AI 길 넘어짐 100 번 당(blocks.mjs 의 장면: 먼 · 가까운 찌르기) 이 옛 값의 씨앗 부트스트랩 90 % 구간 위 끝을 넘지 않음 (+ 씨앗 짝 차의 90 % 구간도 적음)
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const J = (p) => JSON.parse(readFileSync(String(p), 'utf8'));
const bA = J(args.baseA), bB = J(args.baseB), nA = J(args.newA), nB = J(args.newB), SP = J(args.spread);
const STEP = 1 / 120; const f = (x, d = 3) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const out = { G1: [], G1moves: [], G2: [], H1: [] };
const val = (L) => L.shareVal ?? L.med;
const dist = (L, v) => { if (!Number.isFinite(v)) return NaN; if (L.lo != null && L.hi != null && !L.shareVal && L.id !== 'L6') return v < L.lo ? L.lo - v : v > L.hi ? v - L.hi : 0; if (L.id === 'C1') return Math.max(0, 0.8 - v); if (L.id === 'L6') return Math.max(0, 0.5 - v); return NaN; };
// G1 — 꼭 PASS 여야 하는 줄
const must = [['L5', 'rapier', 'human'], ['L5', 'longsword', 'human'], ['C1', 'longsword', 'ai'], ['C1', 'longsword', 'human'], ['C2', 'longsword', 'human'], ['C2', 'longsword', 'ai']];
const find = (G, id, w, p) => G.lines.find((x) => x.id === id && x.weapon === w && x.path === p);
for (const [id, w, p] of must) { const a = find(nA, id, w, p), b = find(nB, id, w, p), oa = find(bA, id, w, p), ob = find(bB, id, w, p);
  const ok = a?.verdict === 'PASS' && b?.verdict === 'PASS';
  out.G1.push({ id, w, p, before: [val(oa), val(ob)], after: [val(a), val(b)], vBefore: [oa?.verdict, ob?.verdict], vAfter: [a?.verdict, b?.verdict], ok });
  console.log(`G1 ${ok ? 'PASS' : 'FAIL'} ${id} ${w} ${p}: 옛 ${f(val(oa))} · ${f(val(ob))} (${oa?.verdict} · ${ob?.verdict}) → 새 ${f(val(a))} · ${f(val(b))} (${a?.verdict} · ${b?.verdict})`); }
// G1 — 그 밖 줄이 나쁜 쪽으로 문턱보다 더 움직였나
let badN = 0;
for (const s of SP.lines) { for (const [blk, O, N] of [['A', bA, nA], ['B', bB, nB]]) {
  const o = find(O, s.id, s.weapon, s.path), n = find(N, s.id, s.weapon, s.path); if (!o || !n) continue;
  const vo = val(o), vn = val(n); const mv = vn - vo; const dO = dist(o, vo), dN = dist(n, vn);
  const big = Number.isFinite(mv) && Math.abs(mv) > s.minReal; const bad = big && Number.isFinite(dO) && Number.isFinite(dN) && dN > dO;
  if (big) { out.G1moves.push({ id: s.id, w: s.weapon, p: s.path, blk, before: vo, after: vn, minReal: s.minReal, distBefore: dO, distAfter: dN, bad }); if (bad) badN++;
    console.log(`  움직임 ${bad ? '나쁜 쪽' : Number.isFinite(dN) ? '좋은 쪽' : '방향 없음(읽기)'} ${s.id} ${s.weapon} ${s.path} 묶음 ${blk}: ${f(vo)} → ${f(vn)} (문턱 ${f(s.minReal)} · 과녁까지 ${f(dO)} → ${f(dN)})`); } } }
console.log(`G1 그 밖 줄 나쁜 쪽 움직임: ${badN} → ${badN ? 'FAIL' : 'PASS'}`); out.G1bad = badN;
// G2
const rows = (G) => G.rows; const both = (a, b) => [...rows(a), ...rows(b)];
for (const w of ['rapier', 'longsword']) { const sel = (R) => R.filter((r) => r.scene === 'near' && r.weapon === w && r.path === 'human' && r.hit && r.valid);
  const o = sel(both(bA, bB)), n = sel(both(nA, nB)); const mo = q(o.map((r) => r.tHit), 0.5), mn = q(n.map((r) => r.tHit), 0.5); const ok = mn <= mo + STEP + 1e-9;
  const blk = [[bA, nA], [bB, nB]].map(([x, y]) => [q(sel(rows(x)).map((r) => r.tHit), 0.5), q(sel(rows(y)).map((r) => r.tHit), 0.5)]);
  out.G2.push({ what: `near ${w} human tap→hit`, before: mo, after: mn, hitsBefore: o.length, hitsAfter: n.length, blocks: blk, ok });
  console.log(`G2 ${ok ? 'PASS' : 'FAIL'} 가까운 찌르기 ${w} 사람 탭 → 맞음 가운데 ${f(mo)} → ${f(mn)} s (맞은 획 ${o.length} → ${n.length} · 묶음 A ${f(blk[0][0])} → ${f(blk[0][1])} · B ${f(blk[1][0])} → ${f(blk[1][1])})`); }
{ const sel = (R) => R.filter((r) => r.scene === 'cut' && r.path === 'ai' && r.desc && r.hit && !r.fell); const o = sel(both(bA, bB)), n = sel(both(nA, nB));
  const mo = q(o.map((r) => r.tHit), 0.5), mn = q(n.map((r) => r.tHit), 0.5); const ok = Math.abs(mn - mo) <= STEP + 1e-9;
  // 흔들림 보기: 씨앗 단위 부트스트랩 90 % 구간(옛) · 씨앗마다 획이 글자까지 같은 씨앗 수
  const by = (R) => { const m = new Map(); for (const r of R) { if (!m.has(r.seed)) m.set(r.seed, []); m.get(r.seed).push(r); } return m; };
  const mo2 = by(o), mn2 = by(n); const seeds = [...new Set([...mo2.keys(), ...mn2.keys()])]; const Rr = rng(77); const bs = [];
  for (let b = 0; b < 2000; b++) { const a = []; for (let k = 0; k < seeds.length; k++) a.push(...(mo2.get(seeds[Math.floor(Rr() * seeds.length)]) ?? []).map((r) => r.tHit)); bs.push(q(a, 0.5)); }
  const key = (L) => JSON.stringify((L ?? []).map((r) => [r.tHit, r.footGap]));
  const sameSeeds = seeds.filter((s) => key(mo2.get(s)) === key(mn2.get(s))).length;
  out.G2.push({ what: 'AI desc swing→hit', before: mo, after: mn, nBefore: o.length, nAfter: n.length, ciBefore: [q(bs, 0.05), q(bs, 0.95)], sameSeeds, seeds: seeds.length, ok });
  console.log(`G2 ${ok ? 'PASS' : 'FAIL'} AI 내려베기 휘두르기 시작 → 맞음 가운데 ${f(mo)} → ${f(mn)} s (획 ${o.length} → ${n.length} · 옛 값 씨앗 부트스트랩 90 % ${f(q(bs, 0.05))} ~ ${f(q(bs, 0.95))} · 획이 글자까지 같은 씨앗 ${sameSeeds}/${seeds.length})`); }
// H1
const fallsOf = (R, sc, w, p) => { const by = new Map(); for (const r of R) if (r.scene === sc && r.weapon === w && r.path === p && !r.cut) { if (!by.has(r.seed)) by.set(r.seed, [0, 0]); const x = by.get(r.seed); x[0]++; if (r.fell) x[1]++; } return by; };
const rate = (by, keys) => { let n = 0, k = 0; for (const s of keys) { const x = by.get(s); if (x) { n += x[0]; k += x[1]; } } return n ? (100 * k) / n : NaN; };
for (const p of ['human', 'ai']) for (const w of ['rapier', 'longsword']) for (const sc of ['far', 'near']) {
  const o = fallsOf(both(bA, bB), sc, w, p), n = fallsOf(both(nA, nB), sc, w, p); const seeds = [...new Set([...o.keys(), ...n.keys()])];
  const ro = rate(o, seeds), rn = rate(n, seeds); const R = rng(4242); const bo = [], bd = [];
  for (let b = 0; b < 2000; b++) { const ks = seeds.map(() => seeds[Math.floor(R() * seeds.length)]); const x = rate(o, ks), y = rate(n, ks); bo.push(x); bd.push(y - x); }
  const hi = q(bo, 0.95), lo = q(bo, 0.05); const dlo = q(bd, 0.05), dhi = q(bd, 0.95);
  const cnt = (by) => [...by.values()].reduce((s, x) => [s[0] + x[1], s[1] + x[0]], [0, 0]);
  const ok = p === 'human' ? cnt(n)[0] === 0 : !(rn > hi);
  out.H1.push({ p, w, sc, before: ro, after: rn, ciBefore: [lo, hi], diffCI: [dlo, dhi], countBefore: cnt(o), countAfter: cnt(n), ok });
  console.log(`H1 ${ok ? 'PASS' : 'FAIL'} ${p} ${w} ${sc}: 넘어짐 /100 ${f(ro, 1)} (${cnt(o).join('/')}) [옛 90 % ${f(lo, 1)} ~ ${f(hi, 1)}] → ${f(rn, 1)} (${cnt(n).join('/')}) · 씨앗 짝 차 90 % ${f(dlo, 1)} ~ ${f(dhi, 1)}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
