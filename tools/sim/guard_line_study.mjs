// ─────────────────────────────────────────────────────────────
//  guard_line_study.mjs — '자세 → 칼길' 안(docs/design/guard_line_2026-11-17.md)의 읽기 전용 계산. 게임 값 · src 는 건드리지 않는다.
//  입력: tell_study.mjs 가 쓴 판 기록 json (`node tools/sim/tell_study.mjs run --seeds=1-6 --prof=4 --shard=i/n --json=a.json` 여럿).
//  하는 일: 새 공격(이어치기 · 비기 · 패시브 · 연습 뺌)의 기술 몫 P0(기술)을 유파 버릇으로 그대로 두고, 자세 → 기술 무게 W(자세, 기술)^τ 를 곱해
//          합친 분포 J(자세, 기술)을 만든다(IPF — 기술 몫 = 버릇 그대로 · 자세 몫 = 정해 준 대로). 그 위에서 H(줄 | 자세) · 줄 맞히기 몫을 잰다.
//  자세 몫 두 가지: obs = 지금 AI 가 고른 자세 몫(langort · pflugR 이 78 %) · watch = 유파 간 보는 자세 목록의 w(고르게 흩어짐 — 안의 'AI 가 자세를 먼저 고른다' 몫)
//  보이는 자세 q: 막는 쪽이 본 자세가 공격 자세와 같을 몫(지금 43 % — tell_study §5) · 다르면 아무 자세(자세 몫대로)
//  node tools/sim/guard_line_study.mjs a.json b.json …   [--w=P:1,S:0.35,U:0.08]
//  무게 · τ · q 는 모두 [감독 안 · 사장님 확인 전]. 표 MAP 은 문서 §3 표와 같은 칸(자세 → 기본(P) · 보조(S) — 나머지 U).
//  (11/17 구현 뒤) MAP 은 설계 때 모형 표 그대로 둔다 — 게임 표는 schools.js TRADITIONS[유파].lineMap ([사장님 11/17 결정 2] 고유 기술은 넷만 묶음).
//  재기 판 measured (11/17 · 읽기 전용): tell_study 기록(전 · 후 어느 판이든 — 보이는 손 aim · 박자 beat · 속임 줄 feintOpen · 막는 쪽 읽은 줄 cov 칸)에서
//   유파마다 손 자세(게임 nearGuard 와 같은 후보 · 거리 — src/guard_line.js) 인정 몫 · H(줄 | 손 자세) · 줄 · 기술 맞히기 · 약속 지킨 몫(P · S · U) · 읽은 줄 덮기 적중 · 유파 맛 기술 몫.
//  node tools/sim/guard_line_study.mjs measured a.json b.json …
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { TRADITIONS } from '../../src/schools.js';
import { isMain } from './is_main.mjs';
import { nearGuard, lineClass, PARRY_LINE } from '../../src/guard_line.js';
import { entropy } from './tell_study.mjs';

export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
export const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };

/** 자세(코드 열쇠) → { P: 기본 기술들, S: 보조 기술들 } · 적지 않은 기술은 U(드묾). 근거는 문서 §3 의 표 칸. 오른 · 왼 거울은 같은 꼴로 묶음 */
export const MAP = {
  german: {
    tag: { P: ['oberhau', 'zornhau', 'duplieren'], S: ['zornhauL', 'schielhau', 'krumphau'] },
    tagR: { P: ['zornhau', 'schielhau', 'krumphau', 'duplieren'], S: ['oberhau', 'zwerchAbtritt', 'zornhauL'] },
    ochsR: { P: ['stichOchs', 'stichOchsL'], S: ['stichPflug', 'zornhauL', 'schielhau'] },
    ochsL: { P: ['stichOchs', 'stichOchsL'], S: ['stichPflugL', 'zornhauL', 'schielhau'] },
    pflugR: { P: ['stichPflug', 'stichPflugL'], S: ['unterhau', 'stichOchs', 'zornhauL'] },
    pflugL: { P: ['stichPflug', 'stichPflugL'], S: ['unterhauL', 'stichOchsL', 'zornhauL'] },
    langort: { P: ['stichPflug', 'stichPflugL', 'stichOchs', 'stichOchsL'], S: ['zwerchAbtritt', 'zwerch', 'zwerchL', 'zornhauL', 'schielhau'] },
    alber: { P: ['stichAlber', 'unterhau', 'unterhauL'], S: ['zornhauL', 'stichPflug', 'schielhau'] },
    wechselR: { P: ['unterhau', 'unterhauL'], S: ['stichPflug', 'stichAlber'] },
  },
  italian: {
    tag: { P: ['imbroccata'], S: ['oberhau', 'zornhau'] },
    ochsR: { P: ['stichOchs', 'stichOchsL'], S: ['imbroccata', 'stichPflug'] },
    pflugR: { P: ['stichPflug'], S: ['stichPflugL', 'inquartata'] },
    langort: { P: ['stichPflug', 'stichPflugL'], S: ['inquartata', 'stichOchs'] },
    pflugL: { P: ['stichPflugL', 'inquartata'], S: ['stichPflug'] },
    alber: { P: ['stichAlber', 'passataSotto'], S: ['unterhau', 'stichPflug'] },
    wechselR: { P: ['passataSotto'], S: ['stichPflug', 'stichAlber', 'unterhau'] },
  },
  iberian: {
    langort: { P: ['zornhau', 'zornhauL', 'talhoReves'], S: ['talhoRodeado', 'oberhau', 'altibaixo', 'unterhau', 'unterhauL', 'stichPflug'] },
    ochsR: { P: ['redondo', 'talhoRodeado', 'stichOchs', 'stichOchsL'], S: ['oberhau', 'altibaixo', 'zornhauL', 'cingir'] },
    ochsL: { P: ['redondo', 'cingir', 'stichOchsL', 'stichOchs'], S: ['zornhauL', 'oberhau', 'talhoRodeado'] },
    pflugR: { P: ['zornhau', 'zornhauL', 'talhoReves'], S: ['stichPflug', 'unterhau'] },
    pflugL: { P: ['zornhau', 'zornhauL', 'talhoReves'], S: ['stichPflug', 'unterhauL'] },
    alber: { P: ['unterhau', 'unterhauL', 'talhoRevezBaixo'], S: ['zornhau', 'zornhauL', 'cingir'] },
    wechselR: { P: ['unterhau', 'talhoRevezBaixo'], S: ['unterhauL', 'cingir', 'talhoRodeado'] },
    wechselL: { P: ['unterhauL', 'talhoRevezBaixo'], S: ['unterhau', 'cingir'] },
    nebenR: { P: ['cingir'], S: ['zornhauL', 'unterhau'] },
  },
  japanese: {
    langort: { P: ['kote', 'hirakiGiri'], S: ['zornhau', 'stichPflug', 'oberhau'] },
    tag: { P: ['oberhau', 'tsubameGaeshi'], S: ['zornhau', 'zornhauL', 'kote'] },
    tagR: { P: ['zornhau', 'hirakiGiri'], S: ['oberhau', 'kote', 'zornhauL'] },
    alber: { P: ['unterhau', 'unterhauL'], S: ['kote', 'stichAlber', 'stichPflug'] },
    nebenR: { P: ['zwerch', 'unterhau'], S: ['zornhau', 'kote'] },
    sideR: { P: ['zwerch', 'unterhau', 'oberhau'], S: ['zornhau', 'hirakiGiri'] },
    sideL: { P: ['unterhauL', 'zornhauL', 'zwerchL'], S: ['kote', 'hirakiGiri'] },
  },
  chinese: {
    nebenR: { P: [], S: ['zornhau', 'chebuYaoji', 'yaoji', 'unterhau', 'stichPflug', 'wristCut'] }, // 간수세: 기미를 따름 — 줄을 잡지 않음(무게 모두 보조)
    langort: { P: ['yaoji', 'chebuYaoji', 'zuoyi'], S: ['oberhau', 'zornhau', 'zwerchL', 'stichPflug'] },
    pflugR: { P: ['stichPflug', 'yaoji'], S: ['chebuYaoji', 'zornhau', 'stichPflugL'] },
    pflugL: { P: ['stichPflugL', 'yaoji'], S: ['chebuYaoji', 'zwerchL', 'stichPflug'] },
    sideR: { P: ['zwerch', 'yaoji', 'chebuYaoji'], S: ['zornhau', 'zwerchL'] },
    ochsR: { P: ['stichOchs', 'stichOchsL'], S: ['oberhau', 'zornhau', 'chebuYaoji'] },
    alber: { P: ['stichAlber', 'unterhau'], S: ['wristCut', 'zornhauL'] },
    tag: { P: ['oberhau'], S: ['zornhau', 'zornhauL', 'yaoji'] },
    tagR: { P: ['zornhau', 'zuoyi'], S: ['oberhau', 'yaoji', 'zwerchL'] },
  },
};

export const WT = { P: 1, S: 0.35, U: 0.08 };
export const isNew = (a) => !a.chain && !a.secret && !a.passive && !a.drill;
const H = (ps) => -ps.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);

function wOf(school, g, t, wt) {
  const m = MAP[school]?.[g];
  if (!m) return 1;
  return m.P.includes(t) ? wt.P : m.S.includes(t) ? wt.S : wt.U;
}

/** J(자세, 기술) — 자세 몫 pg · 기술 몫 p0 를 지키며 무게 W^τ 를 따르는 합친 분포 (IPF) */
export function joint(school, pg, p0, tau, wt = WT, free = false) {
  const gs = Object.keys(pg), ts = Object.keys(p0);
  let J = gs.map((g) => ts.map((t) => pg[g] * p0[t] * Math.pow(wOf(school, g, t, wt), tau)));
  if (free) { // 버릇 고정 없음 — 자세 무게를 기술 무게에 그냥 곱함(고르기에 실제로 곱하는 꼴 · 기술 몫이 움직임)
    J = J.map((r, i) => { const s = r.reduce((x, y) => x + y, 0) || 1; return r.map((v) => (v / s) * pg[gs[i]]); });
    return { gs, ts, J };
  }
  for (let it = 0; it < 200; it++) {
    for (let i = 0; i < gs.length; i++) { const s = J[i].reduce((x, y) => x + y, 0) || 1; J[i] = J[i].map((v) => (v / s) * pg[gs[i]]); }
    for (let j = 0; j < ts.length; j++) { let s = 0; for (let i = 0; i < gs.length; i++) s += J[i][j]; s ||= 1; for (let i = 0; i < gs.length; i++) J[i][j] *= p0[ts[j]] / s; }
  }
  return { gs, ts, J };
}

/** 줄 몫으로 접어 H(줄 | 자세) · 줄 맞히기(자세를 알 때 · 보는 자세 q) 를 잰다. key = 기술 → 줄 이름 (또는 기술 이름 그대로 = 기술 수준) */
export function measure(jt, pg, key, qs = [1]) {
  const { gs, ts, J } = jt;
  const lines = [...new Set(ts.map(key))];
  const PL = gs.map((g, i) => { const row = lines.map(() => 0); ts.forEach((t, j) => { row[lines.indexOf(key(t))] += J[i][j]; }); const s = row.reduce((x, y) => x + y, 0) || 1; return row.map((v) => v / s); });
  const marg = lines.map((_, k) => gs.reduce((s, g, i) => s + pg[g] * PL[i][k], 0));
  const Hc = gs.reduce((s, g, i) => s + pg[g] * H(PL[i]), 0);
  const star = PL.map((r) => r.indexOf(Math.max(...r)));
  const accBase = Math.max(...marg);
  const acc = {};
  for (const q of qs) {
    let a = 0;
    gs.forEach((g, i) => {
      let other = 0; gs.forEach((s, k) => { other += pg[s] * PL[i][star[k]]; });
      a += pg[g] * (q * PL[i][star[i]] + (1 - q) * other);
    });
    acc[q] = a;
  }
  return { H0: H(marg), Hc, accBase, acc, lines };
}

export function load(paths) { return paths.flatMap((p) => JSON.parse(readFileSync(p, 'utf8'))); }

/** 유파 간 보는 자세 몫 w (코드 열쇠별 · 목록 밖은 0) */
export function watchShare(school) {
  const gs = TRADITIONS[school].guards.filter((g) => g.pad && MAP[school]?.[g.name]);
  const raw = Object.fromEntries(gs.map((g) => [g.name, g.w ?? 1]));
  const t = Object.values(raw).reduce((x, y) => x + y, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / t]));
}

const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + ' %' : '-');

// ── 재기 판 (measured) ──
/** 유파 맛 기술 (설계 §1-4 · [사장님 11/17 결정 2] 그대로여야 할 몫) */
export const FLAVOUR = { german: ['schielhau'], italian: ['stichPflug', 'stichPflugL', 'imbroccata'], iberian: ['talhoRodeado', 'cingir'], japanese: ['kote', 'zornhau'], chinese: ['yaoji', 'chebuYaoji'] };
const realOpen = (a) => a.feintOpen ?? a.open; // 속임은 바꾼 길의 줄
/** 공격 하나의 손 자세 (게임과 같은 함수 · 같은 후보 — 기록된 보이는 손 aim) */
export function glNearOf(a) { return a.aim ? nearGuard({ hx: a.aim[0], hy: a.aim[1] }, a.school)?.name ?? null : null; }

/** 판 기록 묶음 → 유파마다 재기 줄 */
export function measured(runs) {
  const A = runs.flatMap((r) => r.attacks).filter(isNew);
  const out = [];
  for (const sc of SCHOOLS) {
    const set = A.filter((a) => a.school === sc).map((a) => ({ ...a, gn: glNearOf(a), ro: realOpen(a) }));
    const n = set.length;
    const rec = set.filter((a) => a.gn);
    const cnt = (xs, k) => { const c = {}; for (const x of xs) c[k(x)] = (c[k(x)] ?? 0) + 1; return c; };
    const top = (c) => Math.max(0, ...Object.values(c));
    // H(줄 | 손 자세) · 맞히기 (같은 표 — 설계 §6-3 '자세 앎 q = 1' 과 같은 셈)
    const lineAll = cnt(rec, (a) => a.ro), techAll = cnt(rec, (a) => a.tech);
    const byG = {}; for (const a of rec) (byG[a.gn] ??= []).push(a);
    let Hc = 0, HcMM = 0, accL = 0, accT = 0;
    const mm = (c) => { const v = Object.values(c), N = v.reduce((x, y) => x + y, 0); return N ? entropy(v) + (v.filter((x) => x > 0).length - 1) / (2 * N * Math.LN2) : 0; }; // Miller–Madow (적은 표본 치우침 고침)
    for (const xs of Object.values(byG)) {
      const cl = cnt(xs, (a) => a.ro), ct = cnt(xs, (a) => a.tech);
      Hc += (xs.length / rec.length) * entropy(Object.values(cl));
      HcMM += (xs.length / rec.length) * mm(cl);
      accL += top(cl); accT += top(ct);
    }
    // 반 나눠 시험 (홀수 씨앗으로 표 → 짝수 씨앗을 맞힘 — 같은 표 맞히기의 치우침 없이)
    const half = (key) => {
      const tr = rec.filter((a) => a.seed % 2), te = rec.filter((a) => a.seed % 2 === 0);
      const tg = {}; for (const a of tr) { const c = (tg[a.gn] ??= {}); c[key(a)] = (c[key(a)] ?? 0) + 1; }
      const all = cnt(tr, key); const m0 = Object.entries(all).sort((x, y) => y[1] - x[1])[0]?.[0];
      let ok = 0, ok0 = 0;
      for (const a of te) { const c = tg[a.gn]; const g = c ? Object.entries(c).sort((x, y) => y[1] - x[1])[0][0] : m0; if (g === key(a)) ok++; if (m0 === key(a)) ok0++; }
      return te.length ? [ok0 / te.length, ok / te.length] : [NaN, NaN];
    };
    const [hl0, hl] = half((a) => a.ro), [ht0, ht] = half((a) => a.tech);
    // 약속 지킨 몫: 손 자세에서 그 기술이 기본 · 보조 · 드묾 · 묶지 않음
    const adh = { P: 0, S: 0, U: 0, free: 0 };
    for (const a of rec) adh[lineClass(sc, a.gn, a.tech) ?? 'free']++;
    const bound = adh.P + adh.S + adh.U;
    // 막는 쪽 읽은 줄 덮기 (휘두름 시작 때) — 적중 = 덮은 줄 = 실제 줄
    const cov = set.filter((a) => a.cov);
    const covHit = cov.filter((a) => a.cov === PARRY_LINE[a.ro]).length;
    const covAny = set.filter((a) => a.covAny);
    const covAnyHit = covAny.filter((a) => a.covAny === PARRY_LINE[a.ro]).length;
    const techC = cnt(set, (a) => a.tech);
    const flav = Object.fromEntries((FLAVOUR[sc] ?? []).map((t) => [t, (techC[t] ?? 0) / (n || 1)]));
    const top4 = Object.entries(techC).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([t, c]) => `${t} ${pc(c / n)}`).join(' · ');
    const gs = runs.filter((r) => r.school === sc).flatMap((r) => r.gl ?? []).filter(Boolean);
    const gl = gs.reduce((o, g) => { for (const k in g) o[k] = (o[k] ?? 0) + g[k]; return o; }, {});
    out.push({ school: sc, n, rec: rec.length / (n || 1), beat: set.filter((a) => a.beat).length / (n || 1), feint: set.filter((a) => a.feint).length / (n || 1),
      H0: entropy(Object.values(lineAll)), Hc, H0MM: mm(lineAll), HcMM, hl0, hl, ht0, ht, accL0: top(lineAll) / (rec.length || 1), accL: accL / (rec.length || 1), accT0: top(techAll) / (rec.length || 1), accT: accT / (rec.length || 1),
      adhP: adh.P / (bound || 1), adhS: adh.S / (bound || 1), adhU: adh.U / (bound || 1), free: adh.free / (rec.length || 1),
      cov: cov.length / (n || 1), covHit: cov.length ? covHit / cov.length : NaN, covAny: covAny.length / (n || 1), covAnyHit: covAny.length ? covAnyHit / covAny.length : NaN, flav, top4, gl });
  }
  return out;
}

export function measuredTable(runs) {
  const R = measured(runs);
  const L = [];
  L.push(`판 ${runs.length} · 새 공격 ${R.reduce((s, r) => s + r.n, 0)}`);
  L.push('\n| 유파 | 새 공격 | 손 자세 인정 | 박자 뒤 | H(줄) → H(줄\\|손 자세) bit (같은 표 · 치우침 고침) | 줄 맞히기 모름 → 앎 (같은 표 · 반 나눠) | 기술 맞히기 모름 → 앎 (같은 표 · 반 나눠) | 약속 P · S · U (묶인 기술) · 묶지 않음 | 속임 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of R) L.push(`| ${KO[r.school]} | ${r.n} | ${pc(r.rec)} | ${pc(r.beat)} | ${r.H0.toFixed(2)} → ${r.Hc.toFixed(2)} · ${r.H0MM.toFixed(2)} → ${r.HcMM.toFixed(2)} | ${pc(r.accL0)} → ${pc(r.accL)} · ${pc(r.hl0)} → ${pc(r.hl)} | ${pc(r.accT0)} → ${pc(r.accT)} · ${pc(r.ht0)} → ${pc(r.ht)} | ${pc(r.adhP)} · ${pc(r.adhS)} · ${pc(r.adhU)} · ${pc(r.free)} | ${pc(r.feint)} |`);
  L.push('\n| 유파 | 읽은 줄 덮은 채 휘두름 시작 (몫 · 적중) | 결정 ~ 휘두름 사이 덮음 (몫 · 적중) | 읽기 굴림 · 나옴 · 위협 봄 · 위협 줄 = 덮은 줄 · 안 옴 | 박자 · 건너뜀 · 낸 공격 | 유파 맛 기술 몫 | 많이 쓴 기술 |');
  L.push('|---|---|---|---|---|---|---|');
  for (const r of R) {
    const g = r.gl;
    L.push(`| ${KO[r.school]} | ${pc(r.cov)} · ${pc(r.covHit)} | ${pc(r.covAny)} · ${pc(r.covAnyHit)} | ${g.enter ?? 0} · ${g.go ?? 0} · ${g.th ?? 0} · ${g.hit ?? 0} · ${g.end ?? 0} | ${g.beat ?? 0} · ${g.beatSkip ?? 0} · ${g.beatFire ?? 0} | ${Object.entries(r.flav).map(([t, v]) => `${t} ${pc(v)}`).join(' · ')} | ${r.top4} |`);
  }
  return { md: L.join('\n'), R };
}

if (isMain(import.meta.url) && process.argv[2] === 'measured') {
  console.log(measuredTable(load(process.argv.slice(3).filter((x) => !x.startsWith('--')))).md);
} else if (isMain(import.meta.url)) {
  const files = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const wArg = process.argv.find((x) => x.startsWith('--w='));
  const wt = wArg ? Object.fromEntries(wArg.slice(4).split(',').map((kv) => kv.split(':')).map(([k, v]) => [k, +v])) : WT;
  const A = load(files).flatMap((r) => r.attacks).filter(isNew);
  const TAUS = [0, 0.5, 1];
  const QS = [0.43, 0.7, 1];
  console.log(`새 공격 ${A.length} · 무게 ${JSON.stringify(wt)}`);
  for (const mode of ['obs', 'near', 'watch']) for (const free of [false, true]) {
    console.log(`\n## 자세 몫 = ${mode === 'obs' ? '지금 AI 가 고른 몫' : mode === 'near' ? '손에서 가장 가까운 자세(사람 눈 · 거리 ≤ 0.2)' : '간 보는 자세 w'} · ${free ? '버릇 고정 없음(기술 무게에 곱함)' : '버릇 고정(기술 몫 그대로)'}`);
    console.log('| 유파 | τ | H(줄) | H(줄|자세) | 줄 맞힘 (자세 모름) | 자세 앎 q=1 | q=0.7 | q=0.43 | 기술 맞힘 모름 → 앎(q=1) | 기술 몫 이동(TV) |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (const sc of SCHOOLS) {
      const set = A.filter((a) => a.school === sc);
      const open = {};
      const c = {}; for (const a of set) { c[a.tech] = (c[a.tech] ?? 0) + 1; open[a.tech] = a.open; }
      const n = set.length;
      const p0 = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / n]));
      let pg;
      if (mode === 'near') { const gc = {}; for (const a of set) if (MAP[sc][a.near] && a.nearD <= 0.2) gc[a.near] = (gc[a.near] ?? 0) + 1; const tg = Object.values(gc).reduce((x, y) => x + y, 0); pg = Object.fromEntries(Object.entries(gc).map(([k, v]) => [k, v / tg])); }
      else if (mode === 'obs') { const gc = {}; for (const a of set) if (MAP[sc][a.guard]) gc[a.guard] = (gc[a.guard] ?? 0) + 1; const tg = Object.values(gc).reduce((x, y) => x + y, 0); pg = Object.fromEntries(Object.entries(gc).map(([k, v]) => [k, v / tg])); }
      else pg = watchShare(sc);
      for (const tau of TAUS) {
        const jt = joint(sc, pg, p0, tau, wt, free);
        const L = measure(jt, pg, (t) => open[t], QS);
        const T = measure(jt, pg, (t) => t, [1]);
        let tv = 0; jt.ts.forEach((t, j) => { let m = 0; jt.gs.forEach((g, i) => { m += jt.J[i][j]; }); tv += Math.abs(m - p0[t]) / 2; });
        console.log(`| ${KO[sc]} | ${tau} | ${L.H0.toFixed(2)} | ${L.Hc.toFixed(2)} | ${pc(L.accBase)} | ${pc(L.acc[1])} | ${pc(L.acc[0.7])} | ${pc(L.acc[0.43])} | ${pc(T.accBase)} → ${pc(T.acc[1])} | ${pc(tv)} |`);
      }
    }
  }
}
