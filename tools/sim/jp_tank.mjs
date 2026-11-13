// ─────────────────────────────────────────────────────────────
//  jp_tank.mjs — 일본 기다리는 중전차 재기 (11/14 — 사장님 '기다림과 침을 … 스택 시스템으로' · 설계안 docs/design/japanese_heavy_tank_2026-11-14.md · 기록 docs/strike/jp_tank_2026-11-14.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(판 스위치는 이 프로세스 안 --set 으로만). 싸움 = school_balance.mjs fightOne 그대로(사람 손가락 봇 · 실제 Input 터치 길 · 숙련 3 AI · 자연 바인드)
//   + 일본 봇 '참고 · 막고 · 한 칼'(jpBot 'tank' — school_balance 머리 글). 꽂개 하나(읽기만 — 난수 · 몸 · 칼 그대로):
//    기세 실은 칼(묶일 때 몫 > 0.005 — 끝난 뒤 몫 · 스택 · 썼나 · E 로 돌려받았나) · 스택 갈래(school_passive stats.stk) · 고노센 실행(창 꼴 — 'counter' = C 받아 치기) · 붙어 버티기 기력
//  판(V — 아래): v1 지금 main(스택 0 · 바위 몸 0) · v2 스택(흘려 받기 3) · v3 스택(흘려 받기 2) · v4 + 밀치기 기력 0 · v5 + 바위 몸 스택당 −4 %(= 이 가지 기본) · v6 ⑤ + C · v7 ⑤ + E · v8 모두 · v1old 지금 main 전 봇
//  node tools/sim/jp_tank.mjs fight --variant=v2 [--cells=…] [--seeds=1-24] [--stiff=0.6] [--json=파일]
//   --stiff=0.6 (11/14 감독 — 사장님 '모든 비기 경직 0.6초로 통일' 이 본판에 들기 전 재기만): SECRET.stiff.japanese = realS(0.6) (고노센 굳음 · 기본 1.2) · 판 이름에 '@0.6'
//  node tools/sim/jp_tank.mjs agg <json ...>   (Markdown 표 — 판 × 칸)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { CONFIG } from './harness_m.mjs';
import { fightOne, cellRow } from './school_balance.mjs';
import { applySets } from './rapier_defence.mjs';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const CELLS = ['japanese:uchigatana:longsword', 'japanese:monohoshizao:longsword', 'japanese:uchigatana:uchigatana', 'japanese:monohoshizao:monohoshizao', 'japanese:uchigatana:rapier', 'japanese:monohoshizao:rapier'];
const OLD = 'JP_TANK.stack=0,JP_TANK.lowShove=0,JP_TANK.rock=0';
export const V = {
  v1: { label: '① 지금 main', set: OLD, bot: 'tank' },
  v2: { label: '② 스택 (흘려 받기 3)', set: 'JP_TANK.lowShove=0,JP_TANK.rock=0', bot: 'tank' },
  v3: { label: '③ 스택 (흘려 받기 2)', set: 'JP_TANK.lowShove=0,JP_TANK.rock=0,JP_TANK.flow=2', bot: 'tank' },
  v4: { label: '④ ② + 밀치기 기력 0', set: 'JP_TANK.rock=0', bot: 'tank' },
  v5: { label: '⑤ ④ + 바위 몸 −4 %/스택', set: '', bot: 'tank' },
  v6: { label: '⑥ ⑤ + C', set: 'JP_TANK.counter=1', bot: 'tank' },
  v7: { label: '⑦ ⑤ + E (사장님 11/14 거둠)', set: 'JP_TANK.keep=1', bot: 'tank' }, // 11/14 사장님 '손목 치기 예외 없이.' — 견줌으로만 남김
  v8: { label: '⑧ 모두 (E 포함 — 거둠 전 판)', set: 'JP_TANK.counter=1,JP_TANK.keep=1', bot: 'tank' }, // E 를 거둔 뒤 '모두' = ⑥
  v1old: { label: '① 지금 main · 전 봇', set: OLD, bot: '' },
};

/** 꽂개 — fightOne probe 꼴 (init · step · done). 읽기만 */
export function tankProbe() {
  let G = null, P = null, A = null, W = null;
  const locks = [];
  const runs = [];
  let lastLock = null, lastRun = null;
  return {
    init(o) {
      ({ G, P, A, W } = o);
    },
    step() {
      const sp = P.schoolPassive;
      const L = sp?.lock;
      if (L && L !== lastLock) {
        lastLock = L;
        if (L.ken > 0.005) locks.push(L); // 묶인 때 몫 > 0 — 끝난 뒤 값은 done 에서 (E 가 고친 몫 · 쓴 것)
      }
      const run = P.skill?.sec ?? null;
      if (run && run !== lastRun && run.S?.name === 'goNoSen') runs.push({ t: r3(G.t / K), ev: run.ctx?.ev ?? null });
      lastRun = run;
    },
    done(fires) {
      const sp = P.schoolPassive;
      const loaded = locks.filter((L) => L.ken > 0.005 || L.kept);
      const used = loaded.filter((L) => !L.kept);
      const sec = fires.filter((f) => f.cls === 'secret');
      const gHit = (ev) => sec.filter((f) => f.wounds > 0 && runs.some((r) => (ev == null || r.ev === ev) && Math.abs(r.t - f.t / K) < 0.25)).length; // 기술 기록(fightOne 안 — t 게임 초 · wounds)의 비기와 같은 때(실제 s) 낸 고노센
      return {
        loaded: used.length,
        kenSum: r3(used.reduce((s, L) => s + L.ken, 0)),
        stkSum: used.reduce((s, L) => s + (L.stk ?? 0), 0),
        spent: used.filter((L) => L.spent).length,
        kept: loaded.filter((L) => L.kept).length,
        stats: sp ? { ken: { ...sp.stats.ken }, stk: JSON.parse(JSON.stringify(sp.stats.stk)) } : null,
        gns: runs.length,
        gnsCounter: runs.filter((r) => r.ev === 'counter').length,
        gnsHit: gHit(null),
        gnsCounterHit: gHit('counter'),
        runs, // 고노센 실행 { t 실제 s, ev 창 꼴 }
        counterWins: W?.counterWins ?? 0,
        clinch: { P: r3(P.stamina.spent?.clinch ?? 0), A: r3(A.stamina.spent?.clinch ?? 0), secP: r3((P.stamina.clinchSeconds ?? 0) / K) },
      };
    },
  };
}

/** 한 프로세스 안에서 칸 × 씨앗 */
export function runVariant(key, cells, seeds, { dur = 30, stiff = null } = {}) {
  const v = V[key];
  applySets(v.set);
  if (stiff != null) CONFIG.SECRET.stiff.japanese = CONFIG.realS(+stiff); // 고노센 굳음 (실제 s — 11/14 '모든 비기 경직 0.6초로 통일' 재기)
  const runs = [];
  const t0 = Date.now();
  for (const c of cells) {
    const [school, weapon, opp] = c.split(':');
    for (const seed of seeds) {
      const r = fightOne({ school, weapon, opp, seed, dur, probe: tankProbe(), jpBot: v.bot });
      delete r.reads;
      r.variant = stiff != null ? `${key}@${stiff}` : key;
      runs.push(r);
      console.error(JSON.stringify({ v: key, c, seed, win: r.win, lose: r.lose, T: r.T, recv: r.recv, ms: Date.now() - t0 }));
    }
  }
  return runs;
}

// ── 묶음 · 표 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const f2 = (x, k = 2) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(k));
const pct = (x) => (x == null || !Number.isFinite(x) ? '–' : `${Math.round(100 * x)}%`);

export function tankRow(rs) {
  const c = cellRow(rs);
  const pr = rs.map((r) => r.probe);
  const loaded = sum(pr.map((p) => p.loaded));
  const fires = rs.flatMap((r) => r.fires);
  const tsu = fires.filter((f) => f.name === 'tsubameGaeshi');
  const gns = sum(pr.map((p) => p.gns));
  const gc = sum(pr.map((p) => p.gnsCounter));
  return {
    ...c,
    draw: c.n - c.win - c.lose,
    loaded: loaded / c.n,
    kenAvg: loaded ? sum(pr.map((p) => p.kenSum)) / loaded : null,
    stkAvg: loaded ? sum(pr.map((p) => p.stkSum)) / loaded : null,
    spentFrac: loaded ? sum(pr.map((p) => p.spent)) / loaded : null,
    kept: mean(pr.map((p) => p.kept)),
    gns: gns / c.n,
    gnsHit: gns ? fires.filter((f) => f.cls === 'secret' && f.w > 0).length / gns : null, // 일본 비기 = 고노센 (판 결과 기술 기록 — 맞음 w)
    gnsC: gc / c.n,
    gnsCHit: gc ? sum(pr.map((p) => p.gnsCounterHit)) / gc : null,
    counterWins: mean(pr.map((p) => p.counterWins)),
    tsu: tsu.length / c.n,
    tsuHit: tsu.length ? tsu.filter((f) => f.w > 0).length / tsu.length : null,
    swings: fires.filter((f) => f.cls === 'swing' || f.cls === 'tap').length / c.n,
    src: ['idle', 'hit', 'block', 'flow', 'over'].map((k) => mean(pr.map((p) => p.stats?.stk?.[k] ?? 0))),
    ev: ['hit', 'block', 'flow'].map((k) => mean(pr.map((p) => p.stats?.stk?.ev?.[k] ?? 0))),
    clinchP: mean(pr.map((p) => p.clinch.P)),
    clinchA: mean(pr.map((p) => p.clinch.A)),
    clinchSec: mean(pr.map((p) => p.clinch.secP)),
  };
}

export function tankMarkdown(runs) {
  const by = {};
  for (const r of runs) ((by[r.variant] ??= {})[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const lab = (k) => { const [b, st] = k.split('@'); return `${V[b].label}${st ? ` · 굳음 ${st}` : ''}`; };
  const order = [...Object.keys(V).filter((k) => by[k]), ...Object.keys(V).flatMap((b) => Object.keys(by).filter((k) => k.startsWith(`${b}@`)))];
  const out = [];
  out.push('| 판 | 칸 | 판 수 | 이김 · 짐 · 비김 | 기세 실은 칼/판 | 실은 몫 평균 | 실은 스택 평균 | 실은 몫 씀 | 고노센/판 (맞음) | 받아 치기 고노센/판 (맞음) | 제비 베기/판 (맞음) | 준 심각도/판 | 받은 심각도/판 | 판 길이 s |');
  out.push('|---|---|---:|---|---:|---:|---:|---:|---|---|---|---:|---:|---:|');
  const all = (k) => Object.values(by[k]).flat();
  for (const k of order) {
    for (const [cell, rs] of Object.entries(by[k])) {
      const s = tankRow(rs);
      out.push(`| ${lab(k)} | ${cell.replace('japanese:', '')} | ${s.n} | ${s.win} · ${s.lose} · ${s.draw} | ${f2(s.loaded)} | ${pct(s.kenAvg)} | ${f2(s.stkAvg, 1)} | ${pct(s.spentFrac)} | ${f2(s.gns)} (${pct(s.gnsHit)}) | ${f2(s.gnsC)} (${pct(s.gnsCHit)}) | ${f2(s.tsu)} (${pct(s.tsuHit)}) | ${f2(s.dealt)} | ${f2(s.recv)} | ${f2(s.T, 1)} |`);
    }
    const s = tankRow(all(k));
    out.push(`| **${lab(k)}** | **여섯 칸** | ${s.n} | ${s.win} · ${s.lose} · ${s.draw} | ${f2(s.loaded)} | ${pct(s.kenAvg)} | ${f2(s.stkAvg, 1)} | ${pct(s.spentFrac)} | ${f2(s.gns)} (${pct(s.gnsHit)}) | ${f2(s.gnsC)} (${pct(s.gnsCHit)}) | ${f2(s.tsu)} (${pct(s.tsuHit)}) | ${f2(s.dealt)} | ${f2(s.recv)} | ${f2(s.T, 1)} |`);
  }
  out.push('', '| 판 (여섯 칸) | 스택 얻음/판 기다림 · 맞음 · 막기 · 흘려 받기 (넘침) | 일/판 맞음 · 막기 · 흘려 받기 | 낸 칼/판 | E 돌려받은 칼/판 | C 창/판 | 붙어 버티기 기력/판 나 · 상대 (버틴 s) |', '|---|---|---|---:|---:|---:|---|');
  for (const k of order) {
    const s = tankRow(all(k));
    out.push(`| ${lab(k)} | ${s.src.slice(0, 4).map((x) => f2(x, 1)).join(' · ')} (${f2(s.src[4], 1)}) | ${s.ev.map((x) => f2(x, 1)).join(' · ')} | ${f2(s.swings, 1)} | ${f2(s.kept)} | ${f2(s.counterWins)} | ${f2(s.clinchP, 1)} · ${f2(s.clinchA, 1)} (${f2(s.clinchSec, 2)}) |`);
  }
  return out.join('\n');
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(tankMarkdown(runs));
  } else {
    const key = arg('variant', 'v4');
    if (!V[key]) throw new Error(`판 ${key} 없음 — ${Object.keys(V).join(' · ')}`);
    const cells = arg('cells', CELLS.join(',')).split(',');
    const runs = runVariant(key, cells, range(arg('seeds', '1-24')), { dur: +arg('dur', 30), stiff: arg('stiff', null) });
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ variant: key, set: V[key].set, cells, runs }));
    console.log(tankMarkdown(runs));
  }
}
