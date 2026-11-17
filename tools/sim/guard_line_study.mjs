// ─────────────────────────────────────────────────────────────
//  guard_line_study.mjs — '자세 → 칼길' 안(docs/design/guard_line_2026-11-17.md)의 읽기 전용 계산. 게임 값 · src 는 건드리지 않는다.
//  입력: tell_study.mjs 가 쓴 판 기록 json (`node tools/sim/tell_study.mjs run --seeds=1-6 --prof=4 --shard=i/n --json=a.json` 여럿).
//  하는 일: 새 공격(이어치기 · 비기 · 패시브 · 연습 뺌)의 기술 몫 P0(기술)을 유파 버릇으로 그대로 두고, 자세 → 기술 무게 W(자세, 기술)^τ 를 곱해
//          합친 분포 J(자세, 기술)을 만든다(IPF — 기술 몫 = 버릇 그대로 · 자세 몫 = 정해 준 대로). 그 위에서 H(줄 | 자세) · 줄 맞히기 몫을 잰다.
//  자세 몫 두 가지: obs = 지금 AI 가 고른 자세 몫(langort · pflugR 이 78 %) · watch = 유파 간 보는 자세 목록의 w(고르게 흩어짐 — 안의 'AI 가 자세를 먼저 고른다' 몫)
//  보이는 자세 q: 막는 쪽이 본 자세가 공격 자세와 같을 몫(지금 43 % — tell_study §5) · 다르면 아무 자세(자세 몫대로)
//  node tools/sim/guard_line_study.mjs a.json b.json …   [--w=P:1,S:0.35,U:0.08]
//  무게 · τ · q 는 모두 [감독 안 · 사장님 확인 전]. 표 MAP 은 문서 §3 표와 같은 칸(자세 → 기본(P) · 보조(S) — 나머지 U).
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { TRADITIONS } from '../../src/schools.js';
import { isMain } from './is_main.mjs';

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

const pc = (x) => (100 * x).toFixed(0) + ' %';
if (isMain(import.meta.url)) {
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
