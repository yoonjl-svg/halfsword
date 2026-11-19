// ─────────────────────────────────────────────────────────────
//  cut_parity.mjs — 한 칼 견줌: 사람 손가락 긋기 대 AI 긋기 (11/19 감독 — 사장님 'ai는 실제로 손가락을 이용해 물리적으로 긋는 게 아니지 않나' ·
//   기록 docs/strike/human_ai_parity_2026-11-19.md §12). 재기만 한다 — 싸움은 school_balance fightOne 그대로(사람 손가락 봇 · 숙련 3 AI) · 꽂개는 읽기만.
//   판마다 두 쪽 보통 베기(사람 = 봇 긋기 중 게임이 'basic' 으로 읽은 것 · AI = 공격 꼴 베기 기술 — 속임 · 비기 · 운동학 칼 · 헛스윙 연습 빼고)를 칼 하나씩 적음:
//   기술 이름 · 칼끝 가장 빠름(m/s) · 몸에 닿은 가장 센 판정 에너지(J — 손가락 긋기 판정 배율 hit 뒤 E · 앞 E0 = E / 그 닿음의 fingerCutK hit)
//   판 줄(이김 · 짐 · 받은 · 준 심각도)도 적어 school_balance 판 표와 같은 셈을 냄 (사람 입력 봇 대 AI)
//  node tools/sim/cut_parity.mjs run [--cells=japanese:uchigatana:uchigatana,…] [--seeds=1-8] [--set=…] [--json=파일(줄마다 판 하나 · 있으면 이어 잼)]
//  node tools/sim/cut_parity.mjs agg 파일 [--min=4]   (판 표 · 칸 × 쪽 × 기술마다 칼끝 · E0 · E 가운데 [사분위] · 유파마다 AI E0 / 사람 E0)
// ─────────────────────────────────────────────────────────────
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { CONFIG } from './harness_m.mjs';
import { fightOne, CELLS, cellRow } from './school_balance.mjs';
import { applySets } from './rapier_defence.mjs';
import { fingerCutK } from '../../src/finger_cut.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
// 파펜하이머 새김 띠 텍스처(src/pappenheimer_details.js inscription)가 캔버스를 그림 — school_balance 의 document 껍데기엔 createElement 가 없어 멈춤:
//  아무것도 그리지 않는 캔버스 (재기 전용 · 그림만 · 몸 · 판 그대로)
if (globalThis.document && typeof globalThis.document.createElement !== 'function') {
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, set: () => true });
  globalThis.document.createElement = () => ({ width: 0, height: 0, style: {}, getContext: () => noop });
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });
const TAIL = 0.35; // 칼이 끝난 뒤 닿음을 그 칼에 셈 (실제 s — 손가락 긋기 hit 창 recoverDelay 를 넉넉히 덮음)

/** 꽂개: 두 쪽 칼 토막 · 몸 닿음 (읽기만) */
function cutProbe() {
  const segs = [];
  let G, P, A, ai;
  let h = null; // 사람 지금 칼 { cur, seg }
  let a = null; // AI 지금 칼 { seq, seg }
  const touch = (seg, r, k) => {
    if (!seg || !r) return;
    const E = r.energy ?? 0;
    if (!(E > 0)) return;
    if (seg.E == null || E > seg.E) Object.assign(seg, { E, E0: E / (k || 1), k, ty: r.type, z: r.zone ?? null });
  };
  return {
    init(o) {
      ({ G, P, A } = o);
      ai = G.ai;
      const an0 = G.combat.analyze.bind(G.combat);
      G.combat.analyze = (pr, point, S, Pp, predicting = false) => {
        const r = an0(pr, point, S, Pp, predicting);
        if (predicting || !r) return r;
        const att = pr.w?.fighter, vic = pr.v?.fighter;
        if (!att || !vic || att === vic) return r;
        const t = G.t / K;
        const k = fingerCutK(att, 'hit');
        if (att === P && vic === A && h && t - (h.seg.t1 ?? t) <= TAIL) touch(h.seg, r, k);
        if (att === A && vic === P && a && t - (a.seg.t1 ?? t) <= TAIL) touch(a.seg, r, k);
        return r;
      };
    },
    step(cur) {
      const t = G.t / K;
      // 사람: 봇 긋기 토막 (fightOne cur — cls swing) — 이름은 끝에 cur 에서 읽음 (게임이 'basic' 을 강화 · 걸음 기술로 몇 스텝 늦게 바꿀 수 있음)
      if (cur && cur.cls === 'swing' && (!h || h.cur !== cur)) {
        h = { cur, seg: { side: 'H', name: null, base: cur.base ?? null, t0: t, t1: null, tip: 0, E: null, E0: null, k: null } };
        segs.push(h);
      }
      if (h) {
        if (h.cur === cur && P.skill.swinging) (h.seg.tip = Math.max(h.seg.tip, P.tipVel.length())), (h.seg.t1 = null);
        else if (h.seg.t1 == null) h.seg.t1 = t;
      }
      // AI: 공격 꼴 긋기 (strike · follow)
      const on = ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow');
      if (on && (!a || a.seq !== ai.atkSeq)) {
        const tc = ai.tech;
        const plain = tc?.kind === 'cut' && !ai.feint && !ai.secretRun && !ai.artRun && !ai.drillAtk && !A.skill?.sec && (A.secretHit ?? 1) === 1;
        a = { seq: ai.atkSeq, seg: { side: 'A', name: tc?.name ?? null, plain, t0: t, t1: null, tip: 0, E: null, E0: null, k: null } };
        segs.push(a);
      }
      if (a) {
        if (on && a.seq === ai.atkSeq) (a.seg.tip = Math.max(a.seg.tip, A.tipVel.length())), (a.seg.t1 = null);
        else if (a.seg.t1 == null) a.seg.t1 = t;
      }
    },
    done() {
      const out = [];
      for (const x of segs) {
        const s = x.seg;
        if (s.side === 'H') {
          if (x.cur.cls !== 'swing' || x.cur.name !== 'basic' || !s.base) continue; // 보통 손가락 긋기만 (강화 · 걸음 · 끌고 가는 칼 빼고)
          s.name = s.base;
        } else if (!s.plain) continue;
        out.push([s.side, s.name, r3(s.tip), r3(s.E), r3(s.E0), s.k == null ? null : r3(s.k), s.ty ?? null]);
      }
      return out;
    },
  };
}

const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const qs = (a) => `${f1(q(a, 0.5))} [${f1(q(a, 0.25))} ~ ${f1(q(a, 0.75))}]`;

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const x = rest.find((s) => s.startsWith(`--${k}=`)); return x ? x.slice(k.length + 3) : d; };
  if (mode === 'run') {
    applySets(arg('set', ''));
    const cells = arg('cells', CELLS.join(',')).split(',');
    const seeds = range(arg('seeds', '1-8'));
    const json = arg('json', null);
    const done = new Set();
    if (json && existsSync(json)) for (const l of readFileSync(json, 'utf8').split('\n').filter(Boolean)) { const o = JSON.parse(l); done.add(`${o.c} ${o.seed}`); }
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        if (done.has(`${c} ${seed}`)) continue;
        const r = fightOne({ school, weapon, opp, seed, probe: cutProbe() });
        const row = { c, seed, T: r.T, win: r.win, lose: r.lose, dealt: r.dealt, recv: r.recv, consD: r.consD, consR: r.consR, falls: r.falls, exh: r.exh, secretFired: r.secretFired, cuts: r.probe };
        if (json) appendFileSync(json, JSON.stringify(row) + '\n');
        console.error(`${c} ${seed} ${r.win ? 'W' : r.lose ? 'L' : 'D'} recv ${r.recv} cuts ${r.probe.length}`);
      }
    }
  } else if (mode === 'agg') {
    const rows = rest.filter((x) => !x.startsWith('--')).flatMap((p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    const min = +arg('min', 4);
    const byC = new Map();
    for (const r of rows) (byC.get(r.c) ?? byC.set(r.c, []).get(r.c)).push(r);
    console.log('| 칸 | 판 | 이김 · 짐 · 비김 | 받은 심각도 판당 | 준 |\n|---|---|---|---|---|');
    for (const [c, rs] of byC) { const x = cellRow(rs); console.log(`| ${c} | ${x.n} | ${x.win} · ${x.lose} · ${x.n - x.win - x.lose} | ${x.recv.toFixed(2)} | ${x.dealt.toFixed(2)} |`); }
    const all = cellRow(rows);
    console.log(`| 모두 | ${all.n} | ${all.win} · ${all.lose} · ${all.n - all.win - all.lose} (승 ${((100 * all.win) / all.n).toFixed(0)} %) | ${all.recv.toFixed(2)} | ${all.dealt.toFixed(2)} |\n`);
    console.log('| 칸 | 쪽 | 기술 | 칼 | 닿음 | 칼끝 m/s | E0 J (배율 앞) | E J (뒤) |\n|---|---|---|---|---|---|---|---|');
    const ratio = [];
    for (const [c, rs] of byC) {
      const by = new Map();
      for (const r of rs) for (const [side, name, tip, E, E0] of r.cuts) (by.get(`${side} ${name}`) ?? by.set(`${side} ${name}`, { side, name, tip: [], E: [], E0: [] }).get(`${side} ${name}`)) && (by.get(`${side} ${name}`).tip.push(tip), E != null && (by.get(`${side} ${name}`).E.push(E), by.get(`${side} ${name}`).E0.push(E0)));
      const names = [...new Set([...by.values()].map((v) => v.name))].filter((n) => (by.get(`H ${n}`)?.E.length ?? 0) >= min && (by.get(`A ${n}`)?.E.length ?? 0) >= min);
      for (const n of names) {
        for (const side of ['H', 'A']) { const v = by.get(`${side} ${n}`); console.log(`| ${c} | ${side === 'H' ? '사람' : 'AI'} | ${n} | ${v.tip.length} | ${v.E.length} | ${qs(v.tip)} | ${qs(v.E0)} | ${qs(v.E)} |`); }
        ratio.push({ c, n, h0: q(by.get(`H ${n}`).E0, 0.5), a0: q(by.get(`A ${n}`).E0, 0.5), ht: q(by.get(`H ${n}`).tip, 0.5), at: q(by.get(`A ${n}`).tip, 0.5) });
      }
    }
    console.log('\n| 칸 | 기술 | AI E0 / 사람 E0 (가운데) | AI 칼끝 / 사람 칼끝 |\n|---|---|---|---|');
    for (const x of ratio) console.log(`| ${x.c} | ${x.n} | ${(x.a0 / x.h0).toFixed(2)} | ${(x.at / x.ht).toFixed(2)} |`);
  } else console.error('node tools/sim/cut_parity.mjs run|agg …');
}
