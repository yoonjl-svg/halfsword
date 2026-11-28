// r36 다시 채점 · 표 — rescore.mjs 가 낸 JSON 을 읽어 ① 검산 · ② · ③ 다시 채점 · 노트 §3 의 표 (게임을 돌리지 않음 · 셈만)
//  node table.mjs --in=L1:<L1.json>,L2:<L2.json>,N:<N.json>[,F:<F.json>] [--mfrom=L1,L2] [--json=파일] > 표.txt
//  닿음 한 번(줄 묶음) = 같은 공격자 · 같은 상대 몸 토막의 판정 줄이 0.1 s(12 스텝) 넘게 끊기기 전까지. 묶음의 ③ 닿음 토막 = 그 묶음 첫 줄에 이어진 토막(rescore.mjs linkRows).
//  찌르기 묶음 = 다시 셈의 갈래가 stab(판정 코드의 찌르기 기하 — combat.js 342)인 줄이 하나라도 있는 묶음. ② · ③ 은 찌르기 묶음만 바꾸고 그 밖은 ① 그대로.
//  ② 줄마다: stab 이고 쉼(같은 부위 쉼) 밖 · 팔 펴짐 ≥ 0.9 · 무게중심 빠르기의 칼 축 쪽 > 0 · 상대 쪽(수평) > 0 이면 실제 에너지 = ½ (mUsed + m) v² 로 같은 식(eff = E × K) · 묶음 답 = 줄 답의 가장 센 것.
//  ③ 묶음마다: 첫 찌르기 줄(쉼 밖)의 K · 문턱 · 뒤 배율로, 실제 에너지 = ½ Jn(T) vn (Jn = 첫 닿음 법선 쪽 충격량 합 · vn = 첫 닿음 법선 쪽 다가오는 빠르기). 멍 에너지 = ½ Jn vn × (게임 멍 에너지 ÷ 팔 몫 없는 실제 에너지).
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const SETS = String(args.in).split(',').map((s) => { const i = s.indexOf(':'); return { name: s.slice(0, i), d: JSON.parse(readFileSync(s.slice(i + 1), 'utf8')) }; });
const MIN_E = 6, ARM_ASSIST = 0.3, GAPK = 12, WI = [0, 1, 2], TW = ['0.025', '0.05', '0.1'];
const RANK = { none: 0, bruise: 1, wound: 2 }; const maxCat = (a, b) => (RANK[b] > RANK[a] ? b : a);
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, lo = Math.floor(i); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (i - lo); };
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
function classify(eff, thr, Eb, physK, eStab, postK) { // combat.js 459 ~ 476 · strike 986 (rescore.mjs classify 와 같음)
  if (eff > thr) return eStab * physK < MIN_E ? { cat: 'none', sev: 0 } : { cat: 'wound', sev: ((eff - thr) / 60) * postK };
  return Eb * physK >= MIN_E ? { cat: 'bruise', sev: 0 } : { cat: 'none', sev: 0 };
}
// ── 묶음 짓기 ──
function groups(run) {
  const out = []; const open = {};
  for (const r of run.rows) { const key = `${r.att}:${r.part}`; let g = open[key]; if (!g || r.k - g.last > GAPK) { g = open[key] = { att: r.att, part: r.part, k0: r.k, last: r.k, rows: [] }; out.push(g); } g.last = r.k; g.rows.push(r); }
  for (const g of out) { const e = g.rows.find((r) => r.ep != null); g.ep = e ? run.eps[e.ep] : null; g.stab = g.rows.some((r) => r.re?.geom === 'stab'); g.cat1 = g.rows.reduce((c, r) => maxCat(c, r.cat), 'none'); g.sev1 = Math.max(0, ...g.rows.map((r) => (r.cat === 'wound' ? r.sev : 0))); g.first = g.rows.find((r) => r.re?.geom === 'stab' && !r.cool) ?? null; }
  return out;
}
const cond2 = (r) => r.re?.geom === 'stab' && !r.cool && r.body && r.body.arm >= 0.9 && r.body.comAx > 0 && r.body.comTo > 0;
function score2(g, m) { if (!g.stab) return { cat: g.cat1, sev: g.sev1, any: false }; let cat = 'none', sev = 0, any = false;
  for (const r of g.rows) { let c = r.cat, s = r.cat === 'wound' ? r.sev : 0;
    if (cond2(r)) { any = true; const R = r.re; const v2 = R.speed * R.speed; const E2 = R.ephysUsed + 0.5 * m * v2; const x = classify(E2 * R.K, R.thr, R.Eblunt, R.physK, E2 * 2 * R.hk, R.postK); c = x.cat; s = x.sev; }
    cat = maxCat(cat, c); if (c === 'wound') sev = Math.max(sev, s); }
  return { cat, sev, any }; }
const NW = [3, 6, 12]; const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const winCache = new Map();
function w3(g, wi) { // 첫 찌르기 줄(쉼 밖)의 스텝부터: 첫 충격량 스텝 s0 의 방향 u · 그 스텝의 다가오는 빠르기 · 창 n 스텝 합
  const key = g; let W = winCache.get(key); if (!W) { W = {}; winCache.set(key, W); const r = g.first; const run = g.run;
    const e = r && r.ep != null ? run.eps[r.ep] : null; if (!r) W.why = 'cool'; else if (!e) W.why = 'noEp';
    else { const dk0 = r.k - e.k0; const st = e.steps.filter((x) => x[0] >= dk0); const s0 = st.find((x) => dot(x[1], x[1]) > 0);
      if (!s0) W.why = 'noImp'; else { const jm = Math.sqrt(dot(s0[1], s0[1])); const u = s0[1].map((c) => c / jm); W.vn = dot(s0[2], u); W.vax = dot(s0[2], s0[3]); W.lag = s0[0] - dk0;
        W.w = NW.map((n) => { const ss = st.filter((x) => x[0] >= s0[0] && x[0] < s0[0] + n); const mags = ss.map((x) => Math.sqrt(dot(x[1], x[1]))).filter((m) => m > 0).sort((a, b) => a - b);
          return { Jn: ss.reduce((a, x) => a + dot(x[1], u), 0), Jax: ss.reduce((a, x) => a + dot(x[1], s0[3]), 0), Jgame: ss.reduce((a, x) => a + x[5], 0), Wax: ss.reduce((a, x) => a + x[7], 0), spike: mags.length ? mags[mags.length - 1] / mags[(mags.length - 1) >> 1] : null }; }); } } }
  return W.why ? { why: W.why } : { vn: W.vn, vax: W.vax, lag: W.lag, ...W.w[wi] };
}
function score3(g, wi) { // 찌르기 묶음만
  if (!g.stab) return { cat: g.cat1, sev: g.sev1, E: null, mu: null };
  const r = g.first; const m = w3(g, wi); if (m.why === 'cool') return { cat: 'none', sev: 0, E: null, mu: null, why: 'cool' }; if (m.why) return { cat: null, why: m.why };
  const J = m.Jn, v = m.vn; if (!(v > 0.05) || !(J > 0)) return { cat: 'none', sev: 0, E: 0, mu: null, why: 'v' };
  const R = r.re; const E3 = 0.5 * J * v; const eU = 0.5 * (R.mFree + ARM_ASSIST) * R.speed * R.speed; const kb = R.Eblunt / eU;
  const x = classify(E3 * R.K, R.thr, E3 * kb, R.physK, E3 * 2 * R.hk, R.postK);
  return { cat: x.cat, sev: x.sev, E: E3, mu: J / v, muAx: m.vax > 0.05 ? m.Jax / m.vax : null, game: m.Jgame > 0 };
}
// ── μ 의 가운데값 (② 의 m) ──
const mFrom = String(args.mfrom ?? 'L1,L2').split(',');
const all = []; for (const S of SETS) for (const run of S.d.runs) for (const g of groups(run)) (g.run = run), all.push({ set: S.name, run, g });
const okMu = (g) => { if (!g.stab) return null; const m = w3(g, 1); return !m.why && m.vn > 0.05 && m.Jn > 0 && !(m.Jgame > 0) ? m.Jn / m.vn : null; };
const muPool = all.filter((x) => mFrom.includes(x.set)).map((x) => okMu(x.g)).filter((y) => y != null);
const MU = q(muPool, 0.5); const MS = [MU, 5, 10, 20, 40];
const L = []; const P = (s = '') => L.push(s); const J = { MU, nMu: muPool.length, sets: {} };
P(`② 의 m = ③ 이 잰 실린 질량 μ (T = 0.05 s) 의 가운데값 ${f(MU)} kg (${mFrom.join(' · ')} 찌르기 묶음 ${muPool.length} 개 · 끌림 충격량이 섞인 묶음 뺌) [잰] · 10 % ${f(q(muPool, 0.1))} · 90 % ${f(q(muPool, 0.9))}`);
// ── B 검산 ──
P(''); P('## B 검산 — 대본이 판정 식으로 다시 센 ① 대 게임 (판정 줄마다)');
for (const S of SETS) { let n = 0, bad = 0, badE = 0, badB = 0, thrRe = 0; const why = {};
  for (const run of S.d.runs) for (const r of run.rows) { if (!r.re) continue; n++; if (r.re.thrSrc === 're') thrRe++;
    const eRel = r.eff != null ? Math.abs(r.re.eff - r.eff) / Math.max(1e-9, Math.abs(r.eff)) : 0; if (eRel > 1e-4) { badE++; why[`eff ${r.re.geom}`] = (why[`eff ${r.re.geom}`] ?? 0) + 1; }
    if (r.type === 'blunt' && r.energy != null && Math.abs(r.re.Eblunt - r.energy) / Math.max(1e-9, r.energy) > 1e-4) badB++;
    if (r.re.cat !== r.cat) { bad++; const k = `${r.cat}→${r.re.cat}`; why[k] = (why[k] ?? 0) + 1; } }
  P(`${S.name}: 다시 센 줄 ${n} · 답(상처/멍/없음)이 다른 줄 ${bad} · 실효 에너지가 1e-4 넘게 다른 줄 ${badE} · 멍 에너지가 다른 줄 ${badB} · 문턱을 옮겨 센 줄 ${thrRe} / ${n} ${Object.keys(why).length ? JSON.stringify(why) : ''}`);
  J.sets[S.name] = { check: { n, bad, badE, badB, thrRe, why } }; }
// ── 표 ──
const keyOf = (x) => `${x.set} | ${x.run.W}${x.run.add != null ? ' +' + x.run.add : ''}`;
const cells = [...new Set(all.map(keyOf))];
P(''); P('## D 표 — 찌르기 묶음(닿음 한 번) · 판 = 찌르기로 닿은 판 (판의 답 = 그 판 찌르기 묶음의 가장 센 답)');
P('묶음 | 무기 간격 | 판 / 찌르기로 닿은 판 | 찌르기 묶음 | ② 조건 든 묶음 | ① 상처 판 · 묶음 (멍 묶음) | ② m=μ 상처 판 · 묶음 | ② 5 · 10 · 20 · 40 kg 상처 묶음 | ③ T=0.025 · 0.05 · 0.1 상처 묶음 | ③ 0.05 상처 판 · 멍 묶음 | ① 에너지 가운데 J | ③ 0.05 에너지 가운데 J | μ 10 % · 가운데 · 90 % kg (T 0.05) | ③ 창 셋 사이 답 바뀐 몫 | ② 와 ③(0.05) 같은 답(상처/아님) 몫');
for (const c of cells) {
  const X = all.filter((x) => keyOf(x) === c); const runs = [...new Set(X.map((x) => x.run))]; const st = X.filter((x) => x.g.stab);
  const nRunsAll = new Set(all.filter((x) => keyOf(x) === c).map((x) => x.run)).size; const runSet = SETS.find((S) => S.name === X[0].set).d.runs.filter((r) => keyOf({ set: X[0].set, run: r }) === c).length;
  const stRuns = [...new Set(st.map((x) => x.run))];
  const s2 = MS.map((m) => st.map((x) => score2(x.g, m))); const s3 = WI.map((wi) => st.map((x) => score3(x.g, wi)));
  const w = (arr) => arr.filter((y) => y.cat === 'wound').length; const runW = (scores) => new Set(st.filter((x, i) => scores[i].cat === 'wound').map((x) => x.run)).size;
  const c1 = st.map((x) => ({ cat: x.g.cat1 })); const e1 = st.map((x) => x.g.first?.re.ephysUsed ?? null); const e3 = s3[1].map((y) => y.E);
  const mus = s3[1].map((y) => y.mu).filter((y) => y != null && !Number.isNaN(y));
  const valid3 = st.map((x, i) => WI.every((wi) => s3[wi][i].cat != null)); const chg = st.filter((x, i) => valid3[i] && new Set(WI.map((wi) => s3[wi][i].cat === 'wound')).size > 1).length; const nv = valid3.filter(Boolean).length;
  const agree = st.filter((x, i) => s3[1][i].cat != null && (s2[0][i].cat === 'wound') === (s3[1][i].cat === 'wound')).length; const na = s3[1].filter((y) => y.cat != null).length;
  P(`${c} | ${runSet} / ${stRuns.length} | ${st.length} | ${s2[0].filter((y) => y.any).length} | ${runW(c1)} · ${w(c1)} (${c1.filter((y) => y.cat === 'bruise').length}) | ${runW(s2[0])} · ${w(s2[0])} | ${s2.slice(1).map(w).join(' · ')} | ${s3.map(w).join(' · ')} | ${runW(s3[1])} · ${s3[1].filter((y) => y.cat === 'bruise').length} | ${f(q(e1, 0.5))} | ${f(q(e3, 0.5))} | ${f(q(mus, 0.1), 1)} · ${f(q(mus, 0.5), 1)} · ${f(q(mus, 0.9), 1)} | ${nv ? f(chg / nv) : '-'} (${chg}/${nv}) | ${na ? f(agree / na) : '-'} (${agree}/${na})`);
  (J.sets[X[0].set].cells ??= {})[c] = { runs: runSet, stRuns: stRuns.length, nStab: st.length, w1: w(c1), w2: s2.map(w), w3: s3.map(w), runW1: runW(c1), runW2: runW(s2[0]), runW3: runW(s3[1]), e1: q(e1, 0.5), e3: q(e3, 0.5), mu: [q(mus, 0.1), q(mus, 0.5), q(mus, 0.9)], chg, nv, agree, na, noEp: s3[1].filter((y) => y.why === 'noEp' || y.why === 'noImp').length, game: s3[1].filter((y) => y.game).length };
}
{ const pool = (names) => { let a = 0, na = 0, c = 0, nv = 0, w1 = 0, w2 = 0, w3 = 0; for (const S of SETS.filter((S) => names.includes(S.name))) for (const v of Object.values(J.sets[S.name].cells ?? {})) { a += v.agree; na += v.na; c += v.chg; nv += v.nv; w1 += v.w1; w2 += v.w2[0]; w3 += v.w3[1]; } return { a, na, c, nv, w1, w2, w3 }; };
  for (const names of [['L1', 'L2', 'N'], ['L1', 'L2'], ['N'], ['F']]) { const p = pool(names); if (!p.na) continue; P(`모음 ${names.join('+')}: ② 와 ③(0.05) 같은 답 ${f(p.a / p.na)} (${p.a}/${p.na}) · ③ 창 셋 사이 답 바뀜 ${f(p.c / p.nv)} (${p.c}/${p.nv}) · 상처 묶음 ① ${p.w1} · ② ${p.w2} · ③ ${p.w3}`); J.pool = { ...(J.pool ?? {}), [names.join('+')]: p }; } }
// ── ③ 의 닿음 질 (E) ──
P(''); P('## E 닿음 — 찌르기 묶음의 닿음 토막: J 가 창과 함께 자람 · 스텝 충격량 튐(가장 큼 ÷ 가운데 · 0.1 s 안) · 끌림(판정 코드가 건 충격량)이 섞인 몫 · 이어지지 않은 묶음');
P('묶음 무기 간격 | 토막 | J(0.05)/J(0.025) 가운데 | J(0.1)/J(0.05) 가운데 | 튐 가운데 (90 %) | 끌림 섞임 | 못 잰 묶음(cool 쉼 · noEp 토막 없음 · noImp 충격량 없음) | vn 가운데 m/s | v 칼축 가운데 | μ 칼축(Jax/vax) 가운데 | ∫F·v (칼 축) 0.05 가운데 J | ½Jv (0.05) 가운데 J | 판정 줄 → 첫 충격량 스텝 가운데');
for (const c of cells) { const st = all.filter((x) => keyOf(x) === c && x.g.stab); const E = st.map((x) => ({ a: w3(x.g, 0), b: w3(x.g, 1), c: w3(x.g, 2) })).filter((e) => !e.a.why);
  const why = {}; for (const x of st) { const m = w3(x.g, 1); if (m.why) why[m.why] = (why[m.why] ?? 0) + 1; }
  const r1 = E.map((e) => (e.a.Jn > 0 ? e.b.Jn / e.a.Jn : null)), r2 = E.map((e) => (e.b.Jn > 0 ? e.c.Jn / e.b.Jn : null));
  P(`${c} | ${E.length} | ${f(q(r1, 0.5))} | ${f(q(r2, 0.5))} | ${f(q(E.map((e) => e.c.spike), 0.5), 1)} (${f(q(E.map((e) => e.c.spike), 0.9), 1)}) | ${E.filter((e) => e.c.Jgame > 0).length} | ${JSON.stringify(why)} | ${f(q(E.map((e) => e.b.vn), 0.5))} | ${f(q(E.map((e) => e.b.vax), 0.5))} | ${f(q(E.map((e) => (e.b.vax > 0.05 ? e.b.Jax / e.b.vax : null)), 0.5), 1)} | ${f(q(E.map((e) => e.b.Wax), 0.5))} | ${f(q(E.map((e) => (e.b.vn > 0 ? 0.5 * e.b.Jn * e.b.vn : null)), 0.5))} | ${f(q(E.map((e) => e.b.lag), 0.5), 0)}`); }
// ── μ 가 무엇에 따라 ──
P(''); P('## E μ (T 0.05 · 끌림 섞인 토막 뺌) — 닿는 빠르기(vn) · 팔 펴짐 · 무기별 가운데 (개수)');
const muRows = all.filter((x) => okMu(x.g) != null).map((x) => ({ set: x.set, W: x.run.W, vn: w3(x.g, 1).vn, arm: x.g.first.body?.arm, push: x.g.first.re.push, part: x.g.part, mu: okMu(x.g) }));
for (const W of ['rapier', 'longsword']) for (const set of SETS.map((S) => S.name)) { const R = muRows.filter((r) => r.W === W && r.set === set); if (!R.length) continue;
  const bin = (pred) => { const a = R.filter(pred).map((r) => r.mu); return `${f(q(a, 0.5), 1)} (${a.length})`; };
  P(`${set} ${W}: vn < 0.5 ${bin((r) => r.vn < 0.5)} · 0.5 ~ 1 ${bin((r) => r.vn >= 0.5 && r.vn < 1)} · 1 ~ 2 ${bin((r) => r.vn >= 1 && r.vn < 2)} · ≥ 2 ${bin((r) => r.vn >= 2)} | 팔 < 0.9 ${bin((r) => !(r.arm >= 0.9))} · ≥ 0.9 ${bin((r) => r.arm >= 0.9)} | 몸통·머리 ${bin((r) => /chest|abdomen|pelvis|head|neck/.test(r.part))} · 팔다리 ${bin((r) => !/chest|abdomen|pelvis|head|neck/.test(r.part))}`); }
// ── N 의 상처 세기 ──
P(''); P('## N · F — 찌르기 상처의 세기 분포 (10 % · 가운데 · 90 % · 개수)');
for (const S of SETS.filter((S) => S.name === 'N' || S.name === 'F')) for (const W of ['rapier', 'longsword']) { const st = all.filter((x) => x.set === S.name && x.run.W === W && x.g.stab);
  const d = (a) => { const b = a.filter((y) => y.cat === 'wound').map((y) => y.sev); return `${f(q(b, 0.1), 3)} · ${f(q(b, 0.5), 3)} · ${f(q(b, 0.9), 3)} (${b.length})`; };
  P(`${S.name} ${W}: ① ${d(st.map((x) => ({ cat: x.g.cat1, sev: x.g.sev1 })))} | ② m=μ ${d(st.map((x) => score2(x.g, MU)))} | ② 40 kg ${d(st.map((x) => score2(x.g, 40)))} | ③ 0.05 ${d(st.map((x) => score3(x.g, 1)))} | ③ 0.05 끌림 섞인 묶음 ${st.filter((x) => score3(x.g, 1).game).length} / ${st.length}`); }
console.log(L.join('\n'));
if (args.json) writeFileSync(String(args.json), JSON.stringify(J));
