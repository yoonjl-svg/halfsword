// ─────────────────────────────────────────────────────────────
//  tell_study.mjs — 휘두름 전의 낌새 재기 (11/17 · docs/strike/tell_study_2026-11-17.md). 게임 값 · src 는 건드리지 않는다 (AI 메서드를 인스턴스에서만 감싸 기록).
//  판: 숙련 4 거울(기본) 유파 다섯 × 무기 둘 × 씨앗 × 자리 둘 · 두 자리 모두 LOOKS.enemy · 60 s. --prof=2:6 이면 낮은:높은 숙련 짝 (자리 번갈음).
//  공격(startStrike 까지 간 것)마다 — 결정(startAttack) · 휘두름 시작(startStrike) · 닿음(첫 상처, 없으면 칼끝이 상대 가슴에 가장 가까운 때)의 시각 · 거리 ·
//  결정 때 자세(guard.name) · 기술 · 줄(tech.open) · 낌새 여덟(문턱 넘음 시작) · 막는 쪽 꼴을 적는다.
//  node tools/sim/tell_study.mjs run [--seeds=1-6] [--prof=4|2:6] [--shard=i/n] [--json=out.json] [--dur=60] [--cfg=MEASURE.on:1,OKORI.on:1]
//  node tools/sim/tell_study.mjs agg a.json b.json …           (표)
//  node tools/sim/tell_study.mjs frames <school> <wi> <seed> <swap 0|1> [n=0] [wound=1]   (사람 눈 타임라인 — 공격 n 번째)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, DT } from './harness_m.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { LOOKS } from '../../src/looks.js';
import { AI_PROFICIENCY, PROF6_VITALITY } from '../../src/config.js';
import { isMain } from './is_main.mjs';
import * as CFG from '../../src/config.js';
// config 덮어쓰기 (재기 전용 · 게임 값 그대로 — prof_gap_measure 와 같은 꼴): --cfg=MEASURE.on:1,OKORI.on:1 … (간격과 박자 · 오코리 켜고 끄기는 이 칸으로만 — 11/17 스위치 없음)
for (const kv of ((process.argv.find((x) => x.startsWith('--cfg=')) ?? '').slice(6)).split(',').filter(Boolean)) {
  const [path, v] = kv.split(':');
  const [obj, key] = path.split('.');
  if (!CFG[obj] || !(key in CFG[obj])) throw new Error(`unknown cfg: ${path}`);
  CFG[obj][key] = Number.isNaN(+v) ? v : +v;
}

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };

// 낌새 문턱 (게임 값 아님 · 재기 전용)
export const CUES = ['step', 'foot', 'pelYaw', 'chYaw', 'com', 'hand', 'raise', 'tip', 'okori', 'wind'];
export const USABLE = ['step', 'raise', 'okori', 'wind']; // 쓸 만한 낌새 묶음 (간격과 박자 · 오코리 11/17 — 걸어 들어옴 · 칼 듦 · 보이는 오코리 · 느린 감기)
export const CUE_KO = {
  step: '걸어 들어옴 (골반이 상대 쪽 ≥ 0.3 m/s)', foot: '발 뗌 (두 발 중 하나가 딛지 않음)', pelYaw: '골반 돌림 (≥ 60 °/s)', chYaw: '가슴 돌림 (≥ 60 °/s)',
  com: '무게 옮김 (무게중심이 두 발 가운데보다 상대 쪽으로 ≥ 0.25 m/s)', hand: '손이 자세 자리를 떠남 (> 0.05)', raise: '칼 듦 (AI 눈 문턱 — 손 위 속도 > 1.6 · 높이 > 0.05)', tip: '칼끝 움직임 (> 2 m/s)',
  okori: '보이는 오코리 (f.okoriVis ≥ 0.2 — 높은 띠 읽는 문턱 · OKORI 켬일 때만)', wind: '느린 감기 (손이 자세 바깥쪽으로 > 1.3 m/s · 칼끝 < 3.5 m/s — OKORI.windV)',
};

const WIN = 6; // 0.05 s
function yawOf(q) { return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)); }
const unwrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** 막는 쪽 꼴 하나로: 공격(준비 · 다가감 · 휘두름) · 막기 · 비기 · 물러남 · 회복(공격 끝난 지 0.6 s 안) · 간 보기 · 못 섬 */
function defState(d) {
  if (d.down) return 'down'; // 넘어짐 · 일어남 (state down | getup)
  if (d.mode === 'attack') return d.phase === 'strike' || d.phase === 'follow' || d.phase === 'rdStrike' ? 'atk-strike' : 'atk-prep';
  if (d.mode === 'defend') return 'parry';
  if (d.mode === 'secret') return 'secret';
  if (d.mode === 'withdraw' || d.away > 0.4) return 'retreat';
  if (d.sinceAtk < 0.6) return 'recover';
  return 'watch';
}
export const FREE = new Set(['watch', 'retreat', 'recover', 'atk-prep', 'parry']); // 낌새를 받아 반응을 고를 수 있는 꼴 (휘두름 · 비기 · 넘어짐은 못 함)

export function runFight({ school, wi, seed, swap, prof = [4, 4], dur = 60 }) {
  const weapon = WEAPONS[school][wi];
  const lk = LOOKS.enemy;
  const L = AI_PROFICIENCY.levels;
  // prof = [플레이어 자리, 상대 자리] 숙련 — swap 이 두 자리를 바꿈
  const pP = swap ? prof[1] : prof[0], pE = swap ? prof[0] : prof[1];
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, look: lk, look2: lk,
    difficulty: L[pE], difficulty2: L[pP], persona: { proficiency: pE }, persona2: { proficiency: pP },
  });
  if (pP === 6) G.player.vitality = PROF6_VITALITY;
  if (pE === 6) G.enemy.vitality = PROF6_VITALITY;
  const F = [G.player, G.enemy];
  const A = [G.ai2, G.ai]; // F[i] 를 모는 AI
  const N = Math.ceil(dur / DT) + 8;
  const fa = (T = Float32Array) => new T(N);
  const mk = () => ({
    t: fa(), px: fa(), pz: fa(), cx: fa(), cz: fa(), py: fa(), cy: fa(), comx: fa(), comz: fa(), fmx: fa(), fmz: fa(), ax: fa(), ay: fa(),
    hvx: fa(), hvy: fa(), tip: fa(), gx: fa(), gy: fa(), clos: fa(), away: fa(), stF: fa(Uint8Array), stB: fa(Uint8Array), mode: new Array(N), phase: new Array(N),
    down: fa(Uint8Array), dcc: fa(), dpp: fa(), reach: fa(), hx: fa(), hy: fa(), hz: fa(), sa: fa(), okv: fa(),
  });
  const S = [mk(), mk()];
  const attacks = [[], []];
  const woundsBy = [[], []];
  G.onWound = (att, vic, r) => { if (r.severity > 0) woundsBy[att === F[0] ? 0 : 1].push({ t: G.t, zone: r.zone, type: r.type }); };
  for (let i = 0; i < 2; i++) {
    const ai = A[i];
    const oSA = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt = {}) => {
      const before = ai.atkSeq;
      const r = oSA(tech, why, opt);
      if (r && ai.mode === 'attack' && ai.atkSeq !== before) {
        const g = ai.guard; const me = F[i];
        let near = null, nd = 9;
        for (const x of ai.school.guards) { const dd = Math.hypot(x.pad[0] - me.handOffset.x, x.pad[1] - me.handOffset.y); if (dd < nd) { nd = dd; near = x.name; } }
        attacks[i].push({ i, iD: Math.round(G.t / DT), tech: ai.tech?.name, open: ai.tech?.open, kind: ai.tech?.kind, why, chain: opt.chain ?? 0, secret: !!opt.secret, passive: !!opt.passive, drill: !!opt.drill, feint: !!ai.feint,
          guard: g?.name ?? null, near, nearD: nd, hand: [me.handOffset.x, me.handOffset.y], iS: null, iE: null, reachD: ai.M.reach, foeReachD: ai.foeReach });
      }
      return r;
    };
    const oSS = ai.startStrike.bind(ai);
    ai.startStrike = (...x) => {
      const r = oSS(...x);
      const cur = attacks[i][attacks[i].length - 1];
      if (cur && cur.iS == null && (ai.mode === 'attack' || ai.mode === 'secret')) cur.iS = Math.round(G.t / DT);
      return r;
    };
  }
  const lastAtk = [-9, -9];
  const prevPh = ['', ''];
  let n = 0;
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(F[0]) && !out(F[1])) {
    G.step();
    for (let i = 0; i < 2; i++) {
      const f = F[i], o = F[1 - i], ai = A[i], s = S[i];
      const pe = f.bodies.pelvis.translation(), ch = f.bodies.chest.translation(), po = o.bodies.pelvis.translation(), co = o.bodies.chest.translation();
      s.t[n] = G.t; s.px[n] = pe.x; s.pz[n] = pe.z; s.cx[n] = ch.x; s.cz[n] = ch.z;
      s.py[n] = yawOf(f.bodies.pelvis.rotation()); s.cy[n] = yawOf(f.bodies.chest.rotation());
      let mx = 0, mz = 0, mt = 0;
      for (const k in f.bodies) { const rb = f.bodies[k]; const m = rb.mass(); if (!(m > 0)) continue; const p = rb.translation(); mx += p.x * m; mz += p.z * m; mt += m; }
      s.comx[n] = mx / mt; s.comz[n] = mz / mt;
      const ft1 = f.bodies.footF.translation(), ft2 = f.bodies.footB.translation();
      s.fmx[n] = (ft1.x + ft2.x) / 2; s.fmz[n] = (ft1.z + ft2.z) / 2;
      s.ax[n] = f.skill.aim.x; s.ay[n] = f.skill.aim.y; s.hvx[n] = f.skill.aimVel.x; s.hvy[n] = f.skill.aimVel.y;
      s.tip[n] = f.tipVel.length();
      s.okv[n] = f.okoriVis ?? 0;
      const bp = f.bladePoint(1); s.hx[n] = bp.x; s.hy[n] = bp.y; s.hz[n] = bp.z;
      const g = ai.guard; s.gx[n] = g ? g.pad[0] : 0; s.gy[n] = g ? g.pad[1] : 0;
      const dx = po.x - pe.x, dz = po.z - pe.z, dd = Math.hypot(dx, dz) || 1e-3;
      const v = f.bodies.pelvis.linvel();
      s.clos[n] = (v.x * dx + v.z * dz) / dd; s.away[n] = -s.clos[n];
      s.stF[n] = f.gait?.legs.F.stance ? 1 : 0; s.stB[n] = f.gait?.legs.B.stance ? 1 : 0;
      s.mode[n] = ai.mode; s.phase[n] = ai.phase; s.down[n] = f.state !== 'stand' || !f.alive ? 1 : 0;
      s.dpp[n] = dd; s.dcc[n] = Math.hypot(co.x - ch.x, co.z - ch.z); s.reach[n] = ai.M.reach;
      const ph = ai.mode === 'attack' ? ai.phase : '';
      if (prevPh[i] === 'strike' && ph !== 'strike') { const cur = attacks[i][attacks[i].length - 1]; if (cur && cur.iE == null) cur.iE = n; }
      if (ai.mode === 'attack') lastAtk[i] = G.t;
      prevPh[i] = ph;
      s.sa[n] = G.t - lastAtk[i];
    }
    n++;
  }
  const rec = { school, weapon, seed, swap, prof, endT: G.t, n, attacks: [], cueEv: {} };
  const dt = DT;
  const smooth = (arr, i, w) => { let a = 0, c = 0; for (let k = Math.max(0, i - w + 1); k <= i; k++) { a += arr[k]; c++; } return a / c; };
  const sig = [0, 1].map((i) => {
    const s = S[i], o = S[1 - i];
    const c = {};
    for (const k of CUES) c[k] = new Uint8Array(n);
    for (let j = 0; j < n; j++) {
      const j0 = Math.max(0, j - WIN);
      const T = (s.t[j] - s.t[j0]) || dt;
      const dx = o.px[j] - s.px[j], dz = o.pz[j] - s.pz[j], dd = Math.hypot(dx, dz) || 1e-3;
      c.step[j] = smooth(s.clos, j, 4) >= 0.3 ? 1 : 0;
      c.foot[j] = !s.stF[j] || !s.stB[j] ? 1 : 0;
      c.pelYaw[j] = Math.abs(unwrap(s.py[j] - s.py[j0])) / T >= 1.047 ? 1 : 0;
      c.chYaw[j] = Math.abs(unwrap(s.cy[j] - s.cy[j0])) / T >= 1.047 ? 1 : 0;
      const w = (s.comx[j] - s.fmx[j]) * dx / dd + (s.comz[j] - s.fmz[j]) * dz / dd;
      const w0 = (s.comx[j0] - s.fmx[j0]) * dx / dd + (s.comz[j0] - s.fmz[j0]) * dz / dd;
      c.com[j] = (w - w0) / T >= 0.25 ? 1 : 0;
      c.hand[j] = Math.hypot(s.ax[j] - s.gx[j], s.ay[j] - s.gy[j]) > 0.05 ? 1 : 0;
      c.raise[j] = s.hvy[j] > 1.6 && s.ay[j] > 0.05 ? 1 : 0;
      c.tip[j] = s.tip[j] > 2 ? 1 : 0;
      c.okori[j] = s.okv[j] >= 0.2 ? 1 : 0;
      const ar = Math.hypot(s.ax[j], s.ay[j]);
      c.wind[j] = ar > 1e-3 && (s.ax[j] * s.hvx[j] + s.ay[j] * s.hvy[j]) / ar > 1.3 && s.tip[j] < 3.5 ? 1 : 0;
    }
    return c;
  });
  const tAt = (j) => S[0].t[Math.min(j, n - 1)];
  for (let i = 0; i < 2; i++) {
    const s = S[i], o = S[1 - i];
    const list = attacks[i].filter((a) => a.iS != null);
    for (let qi = 0; qi < list.length; qi++) {
      const a = list[qi];
      const next = list[qi + 1];
      const jEnd = Math.min(n - 1, next ? next.iD : n - 1, a.iS + Math.round(1.0 / dt));
      const tS = tAt(a.iS);
      const w = woundsBy[i].find((x) => x.t >= tS - 0.02 && x.t <= Math.min(tAt(jEnd) + 0.02, tS + 1.0));
      let iC, ctype;
      if (w) { iC = Math.min(n - 1, Math.round(w.t / dt) - 1); ctype = 'wound'; }
      else {
        ctype = 'near'; let best = 9; iC = a.iS;
        const jN = Math.min(jEnd, a.iS + Math.round(0.6 / dt));
        for (let j = a.iS; j <= jN; j++) {
          const dd = Math.hypot(s.hx[j] - o.cx[j], s.hz[j] - o.cz[j]);
          if (dd < best) { best = dd; iC = j; }
        }
      }
      const tD = tAt(a.iD), tC = tAt(iC);
      const r = { school, weapon, seed, swap, i, tech: a.tech, open: a.open, kind: a.kind, why: a.why, chain: a.chain, secret: a.secret, passive: a.passive, drill: a.drill, feint: a.feint,
        guard: a.guard, near: a.near, nearD: +a.nearD.toFixed(3), hand: a.hand.map((x) => +x.toFixed(2)), wound: ctype === 'wound', zone: w?.zone ?? null,
        tD: +tD.toFixed(3), tS: +tS.toFixed(3), tC: +tC.toFixed(3), tE: a.iE != null ? +tAt(a.iE).toFixed(3) : null,
        reach: +a.reachD.toFixed(2), foeReach: +a.foeReachD.toFixed(2), foeReachTrue: +A[1 - i].M.reach.toFixed(2),
        dccD: +s.dcc[a.iD].toFixed(2), dccS: +s.dcc[a.iS].toFixed(2), dccC: +s.dcc[iC].toFixed(2), dppD: +s.dpp[a.iD].toFixed(2), dppS: +s.dpp[a.iS].toFixed(2), dppC: +s.dpp[iC].toFixed(2),
        defD: null, defS: null, cues: {}, def: {} };
      const dst = (j) => defState({ mode: o.mode[j], phase: o.phase[j], down: o.down[j], away: o.away[j], sinceAtk: o.sa[j] });
      r.defD = dst(a.iD); r.defS = dst(a.iS);
      for (const k of CUES) {
        const c = sig[i][k];
        let jj = -1;
        for (let j = a.iS; j >= Math.max(0, a.iS - Math.round(0.15 / dt)); j--) if (c[j]) { jj = j; break; }
        if (jj < 0) { r.cues[k] = null; continue; }
        let j0 = jj; const lim = Math.max(0, a.iS - Math.round(1.5 / dt));
        while (j0 > lim && c[j0 - 1]) j0--;
        const long = j0 === lim && c[lim];
        r.cues[k] = { lead: +(tC - tAt(j0)).toFixed(3), toS: +(tS - tAt(j0)).toFixed(3), beforeD: +(tD - tAt(j0)).toFixed(3), long: long ? 1 : 0 };
        r.def[k] = { at: dst(j0), at2: dst(Math.min(n - 1, j0 + 24)) };
      }
      r.outside = s.dcc[a.iD] > a.reachD;
      rec.attacks.push(r);
    }
  }
  for (const k of CUES) {
    let ev = 0, fol = 0, ev0 = 0, fol0 = 0;
    for (let i = 0; i < 2; i++) {
      const c = sig[i][k], s = S[i];
      const starts = attacks[i].filter((a) => a.iS != null).map((a) => a.iS);
      let last = -999;
      // 오코리는 공격을 고른 뒤에만 켜지는 몸짓이라 공격 꼴 안의 켜짐도 셈 · 몸 시작 + 준비 + 박자 걸음이 0.6 s 를 넘을 수 있어 1.2 s 안 휘두름을 봄 (바탕도 같은 창)
      const okc = k === 'okori';
      const win = okc ? 144 : 72;
      for (let j = 1; j < n; j++) {
        if (c[j] && !c[j - 1] && j - last > 36) {
          last = j;
          if ((!okc && s.mode[j - 1] === 'attack') || s.down[j] || s.dcc[j] > s.reach[j] + 0.6) continue;
          ev++;
          if (starts.some((x) => x > j && x <= j + win)) fol++;
        }
      }
      for (let j = 0; j < n; j += 12) {
        if (s.mode[j] === 'attack' || s.down[j] || s.dcc[j] > s.reach[j] + 0.6) continue;
        ev0++; if (starts.some((x) => x > j && x <= j + win)) fol0++;
      }
    }
    rec.cueEv[k] = { ev, fol, ev0, fol0 };
  }
  rec.frames = { S, n };
  G.world.free();
  return rec;
}

// ── 통계 ──
const q = (a, p) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + ' %' : '-');
const qs = (a) => (a.length ? `${f2(q(a, 0.5))} [${f2(q(a, 0.25))} ~ ${f2(q(a, 0.75))}]` : '-');
export function entropy(counts) { const t = counts.reduce((x, y) => x + y, 0); return t ? -counts.reduce((s, c) => s + (c ? (c / t) * Math.log2(c / t) : 0), 0) : 0; }
const isNewAttack = (a) => !a.chain && !a.secret && !a.passive && !a.drill;

function cueTable(A, runs) {
  const L = ['| 낌새 | 있었던 몫 | 닿음까지 앞섬 s — 중앙값 [25 ~ 75 %] | 휘두름 시작까지 앞섬 s | 결정보다 앞섬 s (> 0.05 면 결정 전부터) | ≥ 0.3 s 인 몫 | ≥ 0.3 s 이고 +0.2 s 뒤 막는 쪽이 반응 가능한 몫 | 낌새 뒤 0.6 s 안 휘두름 (아무 때 바탕) |', '|---|---|---|---|---|---|---|---|'];
  for (const k of CUES) {
    const has = A.filter((a) => a.cues[k] && !a.cues[k].long);
    const leads = has.map((a) => a.cues[k].lead);
    const toS = has.map((a) => a.cues[k].toS);
    const ok3 = leads.filter((x) => x >= 0.3).length;
    const usable = has.filter((a) => a.cues[k].lead >= 0.3 && FREE.has(a.def[k].at2)).length;
    const ev = runs.reduce((s, r) => s + r.cueEv[k].ev, 0), fol = runs.reduce((s, r) => s + r.cueEv[k].fol, 0);
    const ev0 = runs.reduce((s, r) => s + r.cueEv[k].ev0, 0), fol0 = runs.reduce((s, r) => s + r.cueEv[k].fol0, 0);
    L.push(`| ${CUE_KO[k]} | ${pc(has.length / A.length)} | ${qs(leads)} | ${qs(toS)} | ${qs(has.map((a) => a.cues[k].beforeD))} | ${pc(ok3 / A.length)} | ${pc(usable / A.length)} | ${ev ? pc(fol / ev) : '-'} (${fol0 ? pc(fol0 / ev0) : '-'}; 낌새 ${ev}) |`);
  }
  return L.join('\n');
}

export function report(runs) {
  const A = runs.flatMap((r) => r.attacks);
  const W = A.filter((a) => a.wound);
  const out = [];
  out.push(`판 ${runs.length} · 휘두름까지 간 공격 ${A.length} (그중 새 공격 ${A.filter(isNewAttack).length}) · 상처로 닿은 공격 ${W.length} (${pc(W.length / A.length)})`);
  out.push('\n## 시각');
  out.push(`결정 → 휘두름 시작: ${qs(A.map((a) => a.tS - a.tD))} s · 휘두름(strike 단계) 길이: ${qs(A.filter((a) => a.tE != null).map((a) => a.tE - a.tS))} · 휘두름 시작 → 닿음 (상처): ${qs(W.map((a) => a.tC - a.tS))} · 결정 → 닿음 (상처): ${qs(W.map((a) => a.tC - a.tD))}`);
  out.push('\n## 거리 (m)');
  for (const [nm, set] of [['모든', A], ['상처', W]]) {
    out.push(`${nm}: 가슴 사이 결정 때 ${qs(set.map((a) => a.dccD))} · 시작 ${qs(set.map((a) => a.dccS))} · 닿음 ${qs(set.map((a) => a.dccC))} | 골반 사이 결정 ${qs(set.map((a) => a.dppD))} · 시작 ${qs(set.map((a) => a.dppS))} · 닿음 ${qs(set.map((a) => a.dppC))} | M.reach ${qs(set.map((a) => a.reach))} · 상대 칼끝거리 ${qs(set.map((a) => a.foeReachTrue))} · 가슴거리 − M.reach: 결정 ${qs(set.map((a) => a.dccD - a.reach))} 시작 ${qs(set.map((a) => a.dccS - a.reach))} 닿음 ${qs(set.map((a) => a.dccC - a.reach))}`);
    const o = set.filter((a) => a.outside);
    out.push(`  ${nm}: 결정 때 간격 밖(가슴 거리 > M.reach) ${pc(o.length / set.length)} · 밖에서 결정 → 닿음 ${qs(o.map((a) => a.tC - a.tD))} · 안에서 결정 → 닿음 ${qs(set.filter((a) => !a.outside).map((a) => a.tC - a.tD))} · 상대 칼끝거리 안(가슴거리 < 상대 reach) 결정 ${pc(set.filter((a) => a.dccD < a.foeReachTrue).length / set.length)}`);
  }
  out.push('\n## 요약 (간격과 박자 · 오코리 11/17)');
  const earliest = (a) => Math.max(-9, ...USABLE.map((k) => (a.cues[k] && !a.cues[k].long ? a.cues[k].lead : -9)));
  for (const [nm, set] of [['상처', W], ['모든', A]]) {
    const L = set.map(earliest);
    out.push(`${nm} ${set.length}: 쓸 만한 낌새(걸음 · 칼 듦 · 오코리 · 감기) 가장 이른 것 ≥ 0.3 s ${pc(L.filter((x) => x >= 0.3).length / set.length)} · ≥ 0.5 s ${pc(L.filter((x) => x >= 0.5).length / set.length)} · 앞섬 ${qs(L.filter((x) => x > -9))} · 결정 때 간격 안(가슴 거리 ≤ M.reach) ${pc(set.filter((a) => !a.outside).length / set.length)} · 결정 때 막는 쪽 간 보기 ${pc(set.filter((a) => a.defD === 'watch').length / set.length)} · 휘두름 시작 때 간 보기 ${pc(set.filter((a) => a.defS === 'watch').length / set.length)}`);
  }
  const inf = USABLE.map((k) => { const ev = runs.reduce((x, r) => x + r.cueEv[k].ev, 0), fol = runs.reduce((x, r) => x + r.cueEv[k].fol, 0), ev0 = runs.reduce((x, r) => x + r.cueEv[k].ev0, 0), fol0 = runs.reduce((x, r) => x + r.cueEv[k].fol0, 0); return `${k} ${ev ? pc(fol / ev) : '-'} (낌새 ${ev} · 바탕 ${ev0 ? pc(fol0 / ev0) : '-'})`; });
  out.push(`읽는 값 (낌새 뒤 0.6 s 안 휘두름 · 오코리는 1.2 s 안): ${inf.join(' · ')}`);
  out.push(`판 길이 ${qs(runs.map((r) => r.endT))} s · 판당 휘두름 ${(A.length / runs.length).toFixed(1)} · 판당 상처 공격 ${(W.length / runs.length).toFixed(2)}`);
  out.push('\n## 낌새 표 — 상처로 닿은 공격');
  out.push(cueTable(W, runs));
  out.push('\n## 낌새 표 — 휘두름까지 간 모든 공격');
  out.push(cueTable(A, runs));
  out.push('\n## 낌새 표 — 상처 · 간격 밖에서 결정한 공격 (걸음이 박자)');
  out.push(cueTable(W.filter((a) => a.outside), runs));
  out.push('\n## 낌새 표 — 상처 · 간격 안에서 결정한 공격');
  out.push(cueTable(W.filter((a) => !a.outside), runs));
  out.push('\n## 몸 낌새 묶음 (걸음 · 골반 · 가슴 · 무게 — 배경 소음인 발 뗌 · 손 · 칼끝 빼고)');
  for (const [nm, set] of [['상처', W], ['모든', A]]) {
    const body = ['step', 'pelYaw', 'chYaw', 'com'];
    const lead = set.map((a) => Math.max(-9, ...body.map((k) => (a.cues[k] && !a.cues[k].long ? a.cues[k].lead : -9)))).filter((x) => x > -9);
    out.push(`${nm}: 넷 중 하나라도 있었던 몫 ${pc(lead.length / set.length)} · 가장 이른 낌새 앞섬 ${qs(lead)} · ≥ 0.3 s ${pc(lead.filter((x) => x >= 0.3).length / set.length)} · ≥ 0.5 s ${pc(lead.filter((x) => x >= 0.5).length / set.length)}`);
  }
  out.push('\n## 유파별 (상처 공격)');
  out.push('| 유파 | 공격 | 상처 몫 | 결정 때 간격 밖 | 결정 → 닿음(상처) s | 휘두름 시작 → 닿음 s | 걸음 앞섬 s | 가슴 돌림 앞섬 s | 칼 듦 있었던 몫 |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const sc of SCHOOLS) {
    const a = A.filter((x) => x.school === sc), w = W.filter((x) => x.school === sc);
    const ld = (k) => w.filter((x) => x.cues[k] && !x.cues[k].long).map((x) => x.cues[k].lead);
    out.push(`| ${KO[sc]} | ${a.length} | ${pc(w.length / a.length)} | ${pc(w.filter((x) => x.outside).length / w.length)} | ${qs(w.map((x) => x.tC - x.tD))} | ${qs(w.map((x) => x.tC - x.tS))} | ${qs(ld('step'))} | ${qs(ld('chYaw'))} | ${pc(ld('raise').length / w.length)} |`);
  }
  const stateTab = (set, key) => {
    const c = {}; for (const a of set) c[key(a)] = (c[key(a)] ?? 0) + 1;
    return Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pc(v / set.length)}`).join(' · ');
  };
  out.push('\n## 막는 쪽 꼴');
  for (const [nm, set] of [['모든', A], ['상처', W]]) {
    out.push(`${nm} — 결정 때: ${stateTab(set, (a) => a.defD)}`);
    out.push(`${nm} — 휘두름 시작 때: ${stateTab(set, (a) => a.defS)}`);
    for (const k of CUES) { const h = set.filter((a) => a.cues[k] && !a.cues[k].long); out.push(`${nm} — 낌새 ${k} 시작 때 (n=${h.length}): ${stateTab(h, (a) => a.def[k].at)} | +0.2 s: ${stateTab(h, (a) => a.def[k].at2)}`); }
  }
  return out.join('\n');
}

export function guardLine(runs, keyOf, gk = 'guard') {
  const A = runs.flatMap((r) => r.attacks).filter(isNewAttack);
  const out = [];
  for (const school of SCHOOLS) {
    const set = A.filter((a) => a.school === school && a[gk]).map((a) => ({ ...a, guard: a[gk] }));
    if (!set.length) continue;
    const tab = new Map();
    for (const a of set) { const g = a.guard; if (!tab.has(g)) tab.set(g, {}); const k = keyOf(a); tab.get(g)[k] = (tab.get(g)[k] ?? 0) + 1; }
    const marg = {}; for (const a of set) marg[keyOf(a)] = (marg[keyOf(a)] ?? 0) + 1;
    const H0 = entropy(Object.values(marg));
    let Hc = 0, hit = 0;
    const rows = [];
    for (const [g, c] of [...tab.entries()].sort((x, y) => Object.values(y[1]).reduce((s, v) => s + v, 0) - Object.values(x[1]).reduce((s, v) => s + v, 0))) {
      const nn = Object.values(c).reduce((s, v) => s + v, 0);
      Hc += (nn / set.length) * entropy(Object.values(c)); hit += Math.max(...Object.values(c));
      rows.push({ g, n: nn, top: Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${k} ${pc(v / nn)}`).join(' · '), H: entropy(Object.values(c)) });
    }
    const tr = set.filter((a) => a.seed % 2), te = set.filter((a) => a.seed % 2 === 0);
    const tt = new Map(); for (const a of tr) { const g = a.guard; if (!tt.has(g)) tt.set(g, {}); const k = keyOf(a); tt.get(g)[k] = (tt.get(g)[k] ?? 0) + 1; }
    const mm = {}; for (const a of tr) mm[keyOf(a)] = (mm[keyOf(a)] ?? 0) + 1;
    const modeAll = Object.entries(mm).sort((x, y) => y[1] - x[1])[0]?.[0];
    let ok = 0, ok0 = 0;
    for (const a of te) { const c = tt.get(a.guard); const p = c ? Object.entries(c).sort((x, y) => y[1] - x[1])[0][0] : modeAll; if (p === keyOf(a)) ok++; if (modeAll === keyOf(a)) ok0++; }
    out.push({ school, n: set.length, H0, Hc, accIn: hit / set.length, accHold: te.length ? ok / te.length : NaN, accBase: te.length ? ok0 / te.length : NaN, nGuard: tab.size, rows });
  }
  return out;
}

export function guardTable(runs, keyOf, title, gk = 'guard') {
  const R = guardLine(runs, keyOf, gk);
  const L = [`### ${title}`, '', '| 유파 | 공격 수 | 자세 가짓수 | H(줄) bit | H(줄\\|자세) bit | 자세로 맞힌 몫 (같은 표) | 반 나눠 시험: 자세 / 자세 모름 |', '|---|---|---|---|---|---|---|'];
  for (const r of R) L.push(`| ${KO[r.school]} | ${r.n} | ${r.nGuard} | ${r.H0.toFixed(2)} | ${r.Hc.toFixed(2)} | ${pc(r.accIn)} | ${pc(r.accHold)} / ${pc(r.accBase)} |`);
  return { md: L.join('\n'), R };
}

export function habits(runs) {
  const out = [];
  for (const school of [...SCHOOLS, 'all']) {
    const seqs = [];
    for (const r of runs) { if (school !== 'all' && r.school !== school) continue; for (const i of [0, 1]) seqs.push(r.attacks.filter((a) => a.i === i && isNewAttack(a))); }
    let n = 0, sameT = 0, sameO = 0, sameK = 0, sameG = 0;
    const tc = {}, oc = {}, kc = {};
    for (const s of seqs) for (let j = 0; j < s.length; j++) { tc[s[j].tech] = (tc[s[j].tech] ?? 0) + 1; oc[s[j].open] = (oc[s[j].open] ?? 0) + 1; kc[s[j].kind] = (kc[s[j].kind] ?? 0) + 1; }
    for (const s of seqs) for (let j = 1; j < s.length; j++) { n++; if (s[j].tech === s[j - 1].tech) sameT++; if (s[j].open === s[j - 1].open) sameO++; if (s[j].kind === s[j - 1].kind) sameK++; if (s[j].guard === s[j - 1].guard) sameG++; }
    // 우연 = 같은 유파 안에서 두 번 뽑아 같을 몫 (all 은 유파별 우연의 공격 수 가중 평균)
    const ch = (ss, key) => { const c = {}; let t = 0; for (const x of ss) for (const a of x) { c[a[key]] = (c[a[key]] ?? 0) + 1; t++; } return Object.values(c).reduce((s, v) => s + (v / t) ** 2, 0); };
    const chanceFor = (key) => {
      if (school !== 'all') return ch(seqs, key);
      let num = 0, den = 0;
      for (const sc of SCHOOLS) { const ss = []; for (const r of runs) if (r.school === sc) for (const i of [0, 1]) ss.push(r.attacks.filter((a) => a.i === i && isNewAttack(a))); const w = ss.reduce((x, y) => x + y.length, 0); num += w * ch(ss, key); den += w; }
      return num / den;
    };
    out.push({ school, n, sameT: sameT / n, chT: chanceFor('tech'), sameO: sameO / n, chO: chanceFor('open'), sameK: sameK / n, chK: chanceFor('kind'), sameG: sameG / n });
  }
  return out;
}

// ── 사람 눈 타임라인 ──
function framesMode() {
  const [school, wi, seed, swap, nth = '0', wantW = '1'] = args.slice(1);
  const rec = runFight({ school, wi: +wi, seed: +seed, swap: swap === '1', prof: [4, 4], dur: 60 });
  const { S } = rec.frames;
  const list = rec.attacks.filter((a) => (wantW === '1' ? a.wound : true) && isNewAttack(a));
  const a = list[+nth];
  if (!a) { console.log('공격 없음', list.length); return; }
  const s = S[a.i], o = S[1 - a.i];
  const j0 = Math.round(a.tS / DT) - 1;
  console.log(`${school}#${wi} seed=${seed} swap=${swap} 공격 ${nth}/${list.length} (${a.tech} / 줄 ${a.open} / 까닭 ${a.why} / 자세 ${a.guard}) 결정 ${(a.tD - a.tS).toFixed(2)} 닿음 ${(a.tC - a.tS).toFixed(2)} ${a.wound ? '상처 ' + a.zone : '헛침'} · 막는 쪽 ${a.defD} → ${a.defS}`);
  console.log('t(휘두름 시작=0) 공격 AI 모드/단계   가슴거리  걸음속도 발    골반°  가슴°  무게옮김  손(x,y)      손-자세 칼끝m/s | 막는 쪽');
  const py0 = s.py[j0 - 72], cy0 = s.cy[j0 - 72];
  for (let dj = -72; dj <= 30; dj += 6) {
    const j = j0 + dj; if (j < 6) continue;
    const t = s.t[j] - a.tS;
    const dx = o.px[j] - s.px[j], dz = o.pz[j] - s.pz[j], dd = Math.hypot(dx, dz) || 1e-3;
    const w = (s.comx[j] - s.fmx[j]) * dx / dd + (s.comz[j] - s.fmz[j]) * dz / dd;
    console.log(`${t.toFixed(3).padStart(7)}  ${(s.mode[j] + '/' + s.phase[j]).padEnd(16)} ${s.dcc[j].toFixed(2)}  ${s.clos[j].toFixed(2).padStart(6)}  ${(s.stF[j] ? 'F' : 'f') + (s.stB[j] ? 'B' : 'b')}  ${(unwrap(s.py[j] - py0) * 180 / Math.PI).toFixed(0).padStart(5)} ${(unwrap(s.cy[j] - cy0) * 180 / Math.PI).toFixed(0).padStart(5)}  ${w.toFixed(3).padStart(7)}  (${s.ax[j].toFixed(2)},${s.ay[j].toFixed(2)})  ${Math.hypot(s.ax[j] - s.gx[j], s.ay[j] - s.gy[j]).toFixed(2)}  ${s.tip[j].toFixed(1).padStart(5)}  | ${o.mode[j]}/${o.phase[j]}`);
  }
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    const runs = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(report(runs));
    const a = guardTable(runs, (x) => x.open, '자세 → 줄 (tech.open)');
    console.log('\n' + a.md);
    const b = guardTable(runs, (x) => x.tech, '자세 → 기술 (tech.name)');
    console.log('\n' + b.md);
    const c = guardTable(runs, (x) => x.open, '눈에 보이는 손 자리에서 가장 가까운 자세 → 줄 (tech.open · 결정 때 손 자리 기준)', 'near');
    console.log('\n' + c.md);
    console.log('\n## 자세별 줄 표');
    for (const r of a.R) { console.log(`\n### ${KO[r.school]}`); for (const x of r.rows) console.log(`- ${x.g} (n=${x.n}, H=${x.H.toFixed(2)}): ${x.top}`); }
    console.log('\n## 버릇');
    for (const h of habits(runs)) console.log(`${h.school} n=${h.n} · 같은 기술 ${pc(h.sameT)} (우연 ${pc(h.chT)}) · 같은 줄 ${pc(h.sameO)} (우연 ${pc(h.chO)}) · 같은 종류(베기/찌르기) ${pc(h.sameK)} (우연 ${pc(h.chK)}) · 같은 자세 ${pc(h.sameG)}`);
  } else if (mode === 'frames') framesMode();
  else {
    const seeds = range(arg('seeds', '1-6'));
    const dur = +arg('dur', '60');
    const prof = arg('prof', '4').split(':').map(Number);
    const profPair = prof.length === 1 ? [prof[0], prof[0]] : [Math.max(...prof), Math.min(...prof)]; // 플레이어 자리 = 높은 쪽 (swap 이 바꿈)
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const list = [];
    for (const school of SCHOOLS) for (let wi = 0; wi < 2; wi++) for (const seed of seeds) for (const swap of [false, true]) list.push({ school, wi, seed, swap });
    const mine = list.filter((_, k) => k % sn === si - 1);
    console.error(`전체 ${list.length} 판 · 이 샤드 ${mine.length}`);
    const runs = [];
    for (const f of mine) {
      const r = runFight({ ...f, prof: profPair, dur });
      delete r.frames;
      runs.push(r);
      console.error(`${f.school} w${f.wi} s${f.seed} ${f.swap ? 'swap' : 'std'} → 공격 ${r.attacks.length} @${r.endT.toFixed(1)}s`);
    }
    const o = arg('json', null);
    if (o) writeFileSync(o, JSON.stringify(runs));
    else console.log(report(runs));
  }
}
