// r36 선임 덧 — 같은 기록(rescore.mjs 의 JSON)을 한 가지 더 읽음 (게임을 돌리지 않음 · 셈만)
//  node lead_variants.mjs L1:<L1.json> L2:<L2.json> N:<N.json> [F:<F.json>]
//  ①′ = 팔 몫(STRIKE.thrustAssist 3.5 kg)을 '뻗는 구간 안'일 때만이 아니라 찌르기 기하인 모든 줄에 실음(값은 그대로 · 조건만 뗌). 나머지 셈은 table.mjs 의 ② 와 같은 식.
//  함께 적음: 찌르기 묶음 첫 줄의 닿는 빠르기 · 팔 몫이 실린 첫 줄의 수 · 2.0 m/s 넘게 닿은 묶음의 수.
import { readFileSync } from 'node:fs';
const MIN_E = 6, THRUST = 3.5, GAPK = 12;
const RANK = { none: 0, bruise: 1, wound: 2 }; const maxCat = (a, b) => (RANK[b] > RANK[a] ? b : a);
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, lo = Math.floor(i); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (i - lo); };
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
function classify(eff, thr, Eb, physK, eStab, postK) { // table.mjs classify 와 같음 (combat.js 459 ~ 476 · strike 986)
  if (eff > thr) return eStab * physK < MIN_E ? { cat: 'none' } : { cat: 'wound' };
  return Eb * physK >= MIN_E ? { cat: 'bruise' } : { cat: 'none' };
}
function groups(run) { const out = []; const open = {};
  for (const r of run.rows) { const key = `${r.att}:${r.part}`; let g = open[key]; if (!g || r.k - g.last > GAPK) { g = open[key] = { rows: [], last: r.k }; out.push(g); } g.last = r.k; g.rows.push(r); }
  for (const g of out) { g.stab = g.rows.some((r) => r.re?.geom === 'stab'); g.cat1 = g.rows.reduce((c, r) => maxCat(c, r.cat), 'none'); g.first = g.rows.find((r) => r.re?.geom === 'stab' && !r.cool) ?? null; }
  return out; }
function score1p(g) { let cat = 'none';
  for (const r of g.rows) { let c = r.cat; const R = r.re;
    if (R?.geom === 'stab' && !r.cool && !R.push) { const E = 0.5 * (R.mFree + THRUST) * R.speed * R.speed; c = classify(E * R.K, R.thr, R.Eblunt, R.physK, E * 2 * R.hk, R.postK).cat; }
    cat = maxCat(cat, c); }
  return cat; }
console.log('묶음 | 무기 간격 | 찌르기 묶음 | 첫 줄에 팔 몫 실림 | 닿는 빠르기 10 · 50 · 90 % m/s | 2.0 m/s 넘게 닿은 묶음 | ① 상처 | ①′ 상처 (팔 몫을 모든 찌르기 줄에)');
for (const a of process.argv.slice(2)) { const i = a.indexOf(':'); const name = a.slice(0, i); const d = JSON.parse(readFileSync(a.slice(i + 1), 'utf8')); const by = {};
  for (const run of d.runs) for (const g of groups(run)) { if (!g.stab) continue; const k = `${run.W ?? '-'} ${run.add != null ? '+' + run.add : ''}`; (by[k] ??= []).push(g); }
  for (const [k, G] of Object.entries(by).sort()) { const sp = G.map((g) => g.first?.re.speed);
    console.log(`${name} | ${k} | ${G.length} | ${G.filter((g) => g.first?.re.push).length} | ${f(q(sp, 0.1))} · ${f(q(sp, 0.5))} · ${f(q(sp, 0.9))} | ${sp.filter((v) => v > 2.0).length} | ${G.filter((g) => g.cat1 === 'wound').length} | ${G.filter((g) => score1p(g) === 'wound').length}`); } }
