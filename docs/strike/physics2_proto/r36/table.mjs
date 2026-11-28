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
function score3(g, wi) { // 찌르기 묶음만
  if (!g.stab) return { cat: g.cat1, sev: g.sev1, E: null, mu: null };
  const r = g.first; const e = g.ep; if (!r) return { cat: 'none', sev: 0, E: null, mu: null, why: 'cool' }; if (!e) return { cat: null, why: 'noEp' };
  const J = e.win[wi].Jn, v = e.vn; if (!(v > 0.05) || !(J > 0)) return { cat: 'none', sev: 0, E: 0, mu: null, why: 'v' };
  const R = r.re; const E3 = 0.5 * J * v; const eU = 0.5 * (R.mFree + ARM_ASSIST) * R.speed * R.speed; const kb = R.Eblunt / eU;
  const x = classify(E3 * R.K, R.thr, E3 * kb, R.physK, E3 * 2 * R.hk, R.postK);
  // 3 의 나머지 묶음 줄(같은 닿음)은 ① 으로 판정이 났다면 그 답도 봄? — 아님: ③ 은 닿음 한 번에 에너지 하나 (첫 줄의 셈만)
  return { cat: x.cat, sev: x.sev, E: E3, mu: J / v, muAx: e.vax > 0.05 ? e.win[wi].Jax / e.vax : null, game: e.win[wi].Jgame > 0 };
}
// ── μ 의 가운데값 (② 의 m) ──
const mFrom = String(args.mfrom ?? 'L1,L2').split(',');
const all = []; for (const S of SETS) for (const run of S.d.runs) for (const g of groups(run)) all.push({ set: S.name, run, g });
const muPool = all.filter((x) => mFrom.includes(x.set) && x.g.stab && x.g.first && x.g.ep && x.g.ep.vn > 0.05 && x.g.ep.win[1].Jn > 0 && !(x.g.ep.win[1].Jgame > 0)).map((x) => x.g.ep.win[1].Jn / x.g.ep.vn);
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
  (J.sets[X[0].set].cells ??= {})[c] = { runs: runSet, stRuns: stRuns.length, nStab: st.length, w1: w(c1), w2: s2.map(w), w3: s3.map(w), runW1: runW(c1), runW2: runW(s2[0]), runW3: runW(s3[1]), e1: q(e1, 0.5), e3: q(e3, 0.5), mu: [q(mus, 0.1), q(mus, 0.5), q(mus, 0.9)], chg, nv, agree, na, noEp: s3[1].filter((y) => y.why === 'noEp').length, game: s3[1].filter((y) => y.game).length };
}
// ── ③ 의 닿음 질 (E) ──
P(''); P('## E 닿음 — 찌르기 묶음의 닿음 토막: J 가 창과 함께 자람 · 스텝 충격량 튐(가장 큼 ÷ 가운데 · 0.1 s 안) · 끌림(판정 코드가 건 충격량)이 섞인 몫 · 이어지지 않은 묶음');
P('묶음 무기 간격 | 토막 | J(0.05)/J(0.025) 가운데 | J(0.1)/J(0.05) 가운데 | 튐 가운데 (90 %) | 끌림 섞임 | 토막 없음 | vn 가운데 m/s | v 칼축 가운데 | μ 칼축(Jax/vax) 가운데 | ∫F·v (칼 축) 0.05 가운데 J | ½Jv (0.05) 가운데 J');
for (const c of cells) { const st = all.filter((x) => keyOf(x) === c && x.g.stab); const E = st.map((x) => x.g.ep).filter(Boolean);
  const r1 = E.map((e) => (e.win[0].Jn > 0 ? e.win[1].Jn / e.win[0].Jn : null)), r2 = E.map((e) => (e.win[1].Jn > 0 ? e.win[2].Jn / e.win[1].Jn : null));
  P(`${c} | ${E.length} | ${f(q(r1, 0.5))} | ${f(q(r2, 0.5))} | ${f(q(E.map((e) => e.spike), 0.5), 1)} (${f(q(E.map((e) => e.spike), 0.9), 1)}) | ${E.filter((e) => e.win[2].Jgame > 0).length} | ${st.length - E.length} | ${f(q(E.map((e) => e.vn), 0.5))} | ${f(q(E.map((e) => e.vax), 0.5))} | ${f(q(E.map((e) => (e.vax > 0.05 ? e.win[1].Jax / e.vax : null)), 0.5), 1)} | ${f(q(E.map((e) => e.win[1].Wax), 0.5))} | ${f(q(E.map((e) => (e.vn > 0 ? 0.5 * e.win[1].Jn * e.vn : null)), 0.5))}`); }
// ── μ 가 무엇에 따라 ──
P(''); P('## E μ (T 0.05 · 끌림 섞인 토막 뺌) — 닿는 빠르기(vn) · 팔 펴짐 · 무기별 가운데 (개수)');
const muRows = all.filter((x) => x.g.stab && x.g.first && x.g.ep && x.g.ep.vn > 0.05 && x.g.ep.win[1].Jn > 0 && !(x.g.ep.win[1].Jgame > 0)).map((x) => ({ set: x.set, W: x.run.W, vn: x.g.ep.vn, arm: x.g.first.body?.arm, push: x.g.first.re.push, part: x.g.part, mu: x.g.ep.win[1].Jn / x.g.ep.vn }));
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
