// r38 설계 B — 닿음 기록으로 '미는 힘이 뚫는 힘을 넘는 동안 나아간 깊이'를 셈 (게임을 돌리지 않음 · 셈만 · 몸에 아무것도 걸지 않음)
//  node push_depth.mjs --in=L1:<L1.json>,L1nf:<L1nf.json>,... [--json=파일] > 표.txt
//  읽는 기록: r36 rescore.mjs 가 낸 JSON (스텝마다 [dk, 충격량 벡터(몸 토막이 받은 쪽), 다가오는 빠르기(칼 − 토막 · 스텝 전), 칼 축, 엔진 법선 합, 판정 코드가 건 충격량 크기, Σ J·v, Σ (J·축)(v·축)]).
//  묶음(닿음 한 번) · 찌르기 묶음 · 첫 찌르기 줄은 r36 table.mjs 와 같은 정의.
//
//  식 (칼 축 한 줄 위의 두 몸 · 줄인 질량 m):
//   굳은 닿음에서 두 몸이 함께 움직일 때의 닿는 힘 Fc 는, 두 몸에 걸린 다른 힘(관절 · 땅 · 무게)이 닿음의 움직임에 달리지 않는다면
//   무른 닿음의 상대 운동식 m·d'' = Fc(t) − R(d) 의 '미는 몫'과 같다 (Fc = (m_v F_a + m_a F_v)/(m_a+m_v) · 1/m = 1/m_a + 1/m_v).
//   m = 부딪힘 몫 Jc / v0 (다가옴이 0.1 v0 밑으로 떨어질 때까지의 칼 축 충격량 ÷ 처음 칼 축 다가옴). v0 < VMIN 이면 게임의 유효 질량(mUsed)으로 대신(갈음 수를 적음).
//   d(0) = 0 · d'(0) = v0 · 부딪힘 스텝 뒤 스텝마다 Fc = max(0, J·축)/dt. R(d) = 살갗(0 → Fp 를 dInd 까지 곧게) · 뚫린 뒤 Rafter.
//   움직임이 멎고(d' = 0) Fc ≤ R 이면 멈춤(정지 마찰). 기록이 끝나면 Fc = 0 으로 멎을 때까지.
//   끝 둘: 'full' = 묶음 기록 끝까지 · 'first' = 처음 멎은 때.
//  상처(B) = 살갗이 뚫림(d > dInd) · 뚫린 뒤 깊이 δ = d − dInd.
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const SETS = String(args.in).split(',').map((s) => { const i = s.indexOf(':'); return { name: s.slice(0, i), d: JSON.parse(readFileSync(s.slice(i + 1), 'utf8')) }; });
const DT = 1 / 120, SUB = 20, GAPK = 12, VMIN = 0.3, CAP = 0.30; // CAP: 깊이 상한 [어림 — 몸통 두께]
// 값 (자료 메모 $S/r38/data.md §0 · §3 · §5) — 아래 · 가운데 · 위
const VALS = {
  low: { Fp: 10, dInd: 0.02, Ra: 5 },   // 날카로운 · 빠르게 10 N(Ní Annaidh) · 뚫린 뒤 '크게 떨어짐'(Ankersen — 수 없음 [확인 전])
  mid: { Fp: 20, dInd: 0.02, Ra: 20 },  // 가만히 15 ~ 26 N 의 가운데 · dInd 약 20 mm(Gilchrist) → 살갗 일 ½·20·0.02 = 0.2 J (0.17 ~ 0.56 안)
  high: { Fp: 45, dInd: 0.02, Ra: 130 }, // 30 N × 옷 1.5(데님) · 뚫린 뒤 늘 연골 · 뼈 평균 위끝(Gitto 69 ~ 137 N)
};
const RANK = { none: 0, bruise: 1, wound: 2 }; const maxCat = (a, b) => (RANK[b] > RANK[a] ? b : a);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, lo = Math.floor(i); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (i - lo); };
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const q3 = (a, d = 2) => `${f(q(a, 0.1), d)} · ${f(q(a, 0.5), d)} · ${f(q(a, 0.9), d)}`;
function groups(run) { const out = []; const open = {};
  for (const r of run.rows) { const key = `${r.att}:${r.part}`; let g = open[key]; if (!g || r.k - g.last > GAPK) { g = open[key] = { att: r.att, part: r.part, rows: [], last: r.k }; out.push(g); } g.last = r.k; g.rows.push(r); }
  for (const g of out) { g.stab = g.rows.some((r) => r.re?.geom === 'stab'); g.cat1 = g.rows.reduce((c, r) => maxCat(c, r.cat), 'none'); g.first = g.rows.find((r) => r.re?.geom === 'stab' && !r.cool) ?? null; }
  return out; }
// 기록에서 칼 축 충격량 줄 뽑기
function trace(g, run) {
  const r = g.first; if (!r) return { why: 'cool' }; const e = r.ep != null ? run.eps[r.ep] : null; if (!e) return { why: 'noEp' };
  const dk0 = r.k - e.k0; const st = e.steps.filter((x) => x[0] >= dk0); const s0 = st.find((x) => dot(x[1], x[1]) > 0); if (!s0) return { why: 'noImp' };
  const ax = s0[3]; const v0 = dot(s0[2], ax); const game = st.some((x) => x[0] < s0[0] + 36 && x[5] > 0);
  const byK = new Map(st.filter((x) => x[0] >= s0[0]).map((x) => [x[0] - s0[0], x]));
  const last = Math.max(...byK.keys()); const J = []; for (let k = 0; k <= last; k++) { const x = byK.get(k); J.push(x ? { jax: dot(x[1], x[3]), vax: dot(x[2], x[3]) } : { jax: 0, vax: null }); }
  let nc = 0, Jc = 0; for (const s of J) { if (s.vax != null && s.vax >= 0.1 * v0 && nc < 3) { Jc += s.jax; nc++; } else break; }
  if (nc === 0) nc = 1, Jc = J[0].jax; // v0 ≤ 0 : 첫 스텝을 부딪힘으로
  const j0 = Math.sqrt(dot(s0[1], s0[1])); const cosN = dot(s0[1], ax) / j0; // 첫 충격량이 칼 축과 이룬 cos — 칼끝 닿음이면 1 가까이
  return { v0, Jc, nc, J, game, cosN, arm: r.body?.arm ?? null, mUsed: r.re.mUsed, zone: r.zone ?? r.part };
}
const COS_TIP = 0.7, ARM_L = 0.565; // 칼끝 닿음 문 [어림 — 45°] · 팔 길이(r36 rescore)
const tipOK = (T) => T.cosN >= COS_TIP;
function solve(T, V, end, cap = CAP) {
  const m = T.v0 >= VMIN && T.Jc > 0 ? T.Jc / T.v0 : T.mUsed; const fb = !(T.v0 >= VMIN && T.Jc > 0);
  const dc = V.Ec ? 0.01 : 0; const Fc0 = V.Ec ? V.Ec / dc : 0; // 옷 겹: 두께 1 cm 에 고른 힘으로 Ec 를 받음 [어림 꼴]
  const R = (d) => (d < dc ? Fc0 : d - dc < V.dInd ? (V.Fp * (d - dc)) / V.dInd : V.Ra);
  let d = 0, u = Math.max(0, T.v0), W = 0, Wf = 0, t = 0, stopped = false; const h = DT / SUB; const nRec = T.J.length;
  let Fpk = 0, Jpush = 0;
  for (let k = 0; k < nRec + 120; k++) { // 기록 뒤 1 s 까지 Fc = 0 으로
    const F = k < T.nc ? 0 : k < nRec ? Math.max(0, T.J[k].jax) / DT : 0; if (k >= T.nc && k < nRec) { Fpk = Math.max(Fpk, F); Jpush += F * DT; }
    for (let s = 0; s < SUB; s++) { const Rv = R(d);
      if (u <= 0 && F <= Rv) { u = 0; continue; }
      const a = (F - Rv) / m; const u2 = Math.max(0, u + a * h); const dd = 0.5 * (u + u2) * h; d += dd; W += Rv * dd; Wf += F * dd; u = u2; t += h; if (d >= cap) { d = cap; break; } }
    if (d >= cap) break;
    if (u === 0 && k >= T.nc) { if (end === 'first') { stopped = true; break; } if (k >= nRec) break; }
  }
  return { d, del: Math.max(0, d - V.dInd - dc), pierced: d > V.dInd + dc, W, Wf, m, fb, t, Fpk, Jpush, cap: d >= cap, Ekin: 0.5 * m * Math.max(0, T.v0) ** 2 };
}
const L = []; const P = (s = '') => L.push(s); const OUT = { VALS, sets: {} };
const EC = [0, 2, 7, 24, 50]; // 옷이 먼저 받는 일 J — 맨살 0 · 오늘 문턱 근처 7 · 방검복 낮은 칸 24 · 누빈 옷(창끝) 50 [확인 전]
const pierced = (x) => x.pierced;
P(`값: ${Object.entries(VALS).map(([k, v]) => `${k} Fp ${v.Fp} N · dInd ${v.dInd * 1000} mm · 뚫린 뒤 ${v.Ra} N`).join(' / ')} · VMIN ${VMIN} m/s · 칼끝 문 cos ≥ ${COS_TIP} · 깊이 상한 ${CAP} m · dt 1/120 s`);
P('B 상처 = 칼끝 닿음(첫 충격량이 칼 축과 cos ≥ 0.7)이고 살갗이 뚫림. ① = 같은 기록 칸의 게임 판정(묶음의 가장 센 답).');
P('');
P('## 1. 상처 수 — 찌르기 묶음 · ① 대 B (끝 full)');
P('기록 | 무기 간격 | 찌르기 묶음 | 셈에 쓴 (뺌: 판정 충격량 섞임 · 토막/충격량 없음 · 쉼) | 칼끝 닿음 | ① 상처 | B 아래 · 가운데 · 위 | B 가운데 끝 first | 부딪힘만 (가운데) | 둘 다 · ①만 · B만 (가운데) | B(가운데) 옷 일 0 · 2 · 7 · 24 · 50 J | m 갈음 · 상한 닿음');
const rowsAll = [];
for (const S of SETS) { const by = {};
  for (const run of S.d.runs) for (const g of groups(run)) { if (!g.stab) continue; const k = `${run.W}${run.add != null ? ' +' + run.add : ''}`; (by[k] ??= []).push({ g, run }); }
  for (const [k, G] of Object.entries(by).sort()) {
    const why = { game: 0, noEp: 0, noImp: 0, cool: 0 }; const U = [];
    for (const { g, run } of G) { const T = trace(g, run); if (T.why) { why[T.why]++; continue; } if (T.game) { why.game++; continue; }
      const tip = tipOK(T);
      const res = Object.fromEntries(Object.entries(VALS).map(([n, V]) => [n, solve(T, V, 'full')])); const first = solve(T, VALS.mid, 'first');
      const coll = solve({ ...T, J: T.J.slice(0, T.nc) }, VALS.mid, 'full'); const cloth = EC.map((e) => solve(T, { ...VALS.mid, Ec: e }, 'full'));
      const reach = T.arm != null ? solve(T, VALS.mid, 'full', Math.max(0.005, (1 - T.arm) * ARM_L)) : null;
      const u = { g, T, tip, res, first, coll, cloth, reach }; U.push(u); rowsAll.push({ set: S.name, k, ...u }); }
    const B = (pick) => U.filter((u) => u.tip && pierced(pick(u)));
    const w1 = U.filter((u) => u.g.cat1 === 'wound').length; const bm = B((u) => u.res.mid); const both = bm.filter((u) => u.g.cat1 === 'wound').length;
    const o = { nStab: G.length, used: U.length, why, tip: U.filter((u) => u.tip).length, w1, b: ['low', 'mid', 'high'].map((n) => B((u) => u.res[n]).length), first: B((u) => u.first).length, coll: B((u) => u.coll).length, both, only1: w1 - both, onlyB: bm.length - both, cloth: EC.map((e, i) => B((u) => u.cloth[i]).length), fb: U.filter((u) => u.tip && u.res.mid.fb).length, cap: U.filter((u) => u.tip && u.res.mid.cap).length };
    P(`${S.name} | ${k} | ${o.nStab} | ${o.used} (${why.game} · ${why.noEp + why.noImp} · ${why.cool}) | ${o.tip} | ${w1} | ${o.b.join(' · ')} | ${o.first} | ${o.coll} | ${both} · ${o.only1} · ${o.onlyB} | ${o.cloth.join(' · ')} | ${o.fb} · ${o.cap}`);
    (OUT.sets[S.name] ??= {})[k] = o;
  } }
const keys = [...new Set(rowsAll.map((r) => `${r.set}|${r.k}`))];
P('');
P('## 2. 깊이 · 일 — 칼끝 닿음만 · 가운데 값 · 10 · 50 · 90 %');
P('기록 | 무기 간격 | n | 다가옴 v0 m/s | 줄인 질량 m kg | ½mv0² J | 미는 힘 꼭대기 N | 미는 충격량 N·s | 깊이 d cm (상한 30) | 깊이 d cm (상한 = 남은 팔 펴짐) | 살이 받은 일 J | 미는 힘이 한 일 J | 뚫린 뒤 δ ≥ 0.7 · 2 · 5 cm (상한 30 / 팔)');
for (const key of keys) { const R = rowsAll.filter((r) => `${r.set}|${r.k}` === key && r.tip); const M = R.map((r) => r.res.mid); const Rr = R.map((r) => r.reach).filter(Boolean);
  const dd = (A) => [0.007, 0.02, 0.05].map((t) => A.filter((x) => x.del >= t).length).join(' · ');
  P(`${key.replace('|', ' | ')} | ${R.length} | ${q3(R.map((r) => r.T.v0))} | ${q3(M.map((x) => x.m), 1)} | ${q3(M.map((x) => x.Ekin))} | ${q3(M.map((x) => x.Fpk), 0)} | ${q3(M.map((x) => x.Jpush))} | ${q3(M.map((x) => x.d * 100), 1)} | ${q3(Rr.map((x) => x.d * 100), 1)} | ${q3(M.map((x) => x.W))} | ${q3(M.map((x) => x.Wf))} | ${dd(M)} / ${dd(Rr)}`); }
P('');
P('## 3. 칼끝 문의 몫 — 찌르기 묶음의 첫 충격량 cos(칼 축) 10 · 50 · 90 % · 칼끝 닿음 / 셈에 쓴 묶음');
for (const key of keys) { const R = rowsAll.filter((r) => `${r.set}|${r.k}` === key); P(`${key.replace('|', ' | ')}: ${q3(R.map((r) => r.T.cosN))} · ${R.filter((r) => r.tip).length} / ${R.length} · ① 상처 가운데 칼끝 아님 ${R.filter((r) => !r.tip && r.g.cat1 === 'wound').length}`); }
P('');
P('## 4. 토막별 (가운데 값 · 칼끝 닿음) — B 상처 / 칼끝 묶음 (① 상처)');
for (const W of ['rapier', 'longsword']) { const R = rowsAll.filter((r) => r.k.startsWith(W) && r.tip); const cls = (z) => (/head|neck/.test(z) ? '머리·목' : /chest|abdomen|pelvis/.test(z) ? '몸통' : '팔다리');
  const t = {}; for (const r of R) { const o = (t[`${r.set}:${cls(r.g.part)}`] ??= { n: 0, b: 0, w1: 0 }); o.n++; if (r.res.mid.pierced) o.b++; if (r.g.cat1 === 'wound') o.w1++; }
  P(`${W}: ${Object.entries(t).map(([k, o]) => `${k} ${o.b}/${o.n} (${o.w1})`).join(' · ')}`); }
P('');
P('## 5. 문턱 빠르기 — 칼끝 닿음에서 부딪힘만으로 살갗(가운데 0.2 J)을 뚫는 v0 = √(2·0.2/m) (m 가운데)');
for (const key of keys) { const R = rowsAll.filter((r) => `${r.set}|${r.k}` === key && r.tip && !r.res.mid.fb); const m = q(R.map((r) => r.res.mid.m), 0.5); P(`${key.replace('|', ' | ')}: m ${f(m, 2)} kg → ${m ? f(Math.sqrt(0.4 / m)) : '-'} m/s`); }
console.log(L.join('\n'));
if (args.json) writeFileSync(String(args.json), JSON.stringify(OUT));
