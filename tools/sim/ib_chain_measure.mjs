// ─────────────────────────────────────────────────────────────
//  ib_chain_measure.mjs — 이베리아 B6 '이어지는 흐름' · B4 풍차 베기와 사슬 재기 (사장님 10/29 01:4x · 01:5x · 08:3x — docs/strike/redondo_hold_2026-10-29.md §3 · §4)
//   재기만 한다 — 게임 값은 건드리지 않는다. 0 번 자리 사람 몸을 손가락 봇이 긋는다(ib_flow_measure.mjs 와 같은 입력 길 — 60 Hz 프레임마다 handOffset 이동 ·
//   최소 저크 손가락(천천히 떠서 가운데서 평균의 1.875 배 · 천천히 멈춤 — 사람 손) · 숙련 0.7 · corr · corrTip · autoGuard). 스킬트리 b5 = 이베리아 칸 모두 − B6 · b6 = 모두.
//   진짜 긋기 · 사슬 · n 은 게임 읽기 그대로(fighter.js updateIbFlow — 휘두르기 끝마다 ibFlowWasCut · ibFlowChain · ibCutN) · 기력은 chargeAttack 청구 그대로.
//   chain   = 허공 이어 긋기(상대 6 m 밖 · 서 있음): 한 벌 = K 칼(set 'practice' 3 ~ 5 · 'fight' 1 ~ 3 · 'endless' 끝없이) · 칼 사이 쉼 0 ~ pmax s(손가락 댄 채) · 벌 사이 1.0 ~ 1.6 s 손 뗌 ·
//             빠르기 3.5 ~ 6 패드 m/s(평균) → n 분포 · 사슬 길이 · 최대 n · 칼마다 위력(b5 · b6) · 기력 배율
//   exhaust = 기력 가득(100)에서 허공 이어 긋기를 끝없이(쉼 0 ~ pmax) — 탈진(바닥 −70 · stamina.exhausted)까지 청구된 베기 수 · 시간 · 지침(0 밑) 까지 · 무기 넷
//   fight   = 사람 싸움 30 s (ib_flow_measure.mjs fight 와 같은 봇 — 15 % 탭 · 나머지 1 ~ 3 칼 이어 긋기 · 막기 단추) · b5 대 b6 · 준 칼날 상처 심각도 · 승패
//   reach   = 풍차 베기 'inside' 가 닿나 (10/29 감독 — 사장님 'simple' 결정 뒤 재기만): 1 ~ 3 칼 이어 긋기 → 손 뗌 → 다시 대기까지 delay(s) → 끌지 않고 길게 누름(감기 · 한 바퀴 넘게 돌린 뒤 뗌) ·
//             누름 시작이 마지막 진짜 긋기 끝에서 몇 s · 창(0.6 s) 안 몫 · 누름 첫 0.6 s(감기 전) 칼끝 빠르기(놓인 자리의 차 · p50 · 1.5 m/s 밑 몫 = 칼이 섬)
//  사용법: node tools/sim/ib_chain_measure.mjs chain|exhaust|fight|reach [--ws=zweihander] [--seeds=8] [--seed0=1] [--dur=30] [--pmax=0.5] [--set=practice|fight|endless]
//          [--max=120] [--opps=longsword,uchigatana,rapier] [--prof=3] [--delays=0.1,0.2,0.3,0.4,0.5,h] [--json=.tmp/파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { isMain } from './is_main.mjs';

const { SKILL, IB_FLOW, UNIQUE_ASSIST: UA, STAMINA } = CONFIG;
const FRAME = 1 / 60;
const SPF = Math.max(1, Math.round(FRAME / DT));
const ALL = allNodeIds('iberian');
export const KITS = { b5: kitFromNodes('iberian', new Set([...ALL].filter((id) => id !== 'B6'))), b6: kitFromNodes('iberian', ALL) };
const lcg = (seed) => { let s = (seed * 7919 + 17) >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const qt = (a, p) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))] : NaN; };
const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);

function setupPlayer(P) {
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
}
/** 손가락 프레임 줄 (최소 저크 · 느린 감기 < 1.5 는 고른 빠르기) — ib_flow_measure.mjs fingerTo 와 같음 */
function fingerTo(st, p, v, held) {
  const fr = [];
  const dx = p[0] - st.x, dy = p[1] - st.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return fr;
  if (v < 1.5) {
    const n = Math.max(1, Math.ceil(d / (v * FRAME)));
    for (let i = 0; i < n; i++) fr.push([dx / n, dy / n, held]);
  } else {
    const n = Math.max(1, Math.round(d / v / FRAME));
    let s0 = 0;
    for (let i = 1; i <= n; i++) {
      const u = i / n, s = u * u * u * (10 - 15 * u + 6 * u * u);
      fr.push([dx * (s - s0), dy * (s - s0), held]);
      s0 = s;
    }
  }
  st.x = p[0]; st.y = p[1];
  return fr;
}
const hold = (n, held) => Array.from({ length: Math.max(0, Math.round(n)) }, () => [0, 0, held]);
const WP = [[0.42, 0.4], [-0.42, 0.4], [0.52, 0.06], [-0.5, 0.06], [0.4, -0.4], [-0.4, -0.4], [0.02, 0.52], [0.0, -0.45]];
function nextWp(rnd, x, y) {
  let c = WP.filter((p) => Math.hypot(p[0] - x, p[1] - y) > 0.6);
  if (!c.length) c = WP;
  return c[Math.floor(rnd() * c.length)];
}
/** 한 벌: 첫 자리로 → 쉼 → K 칼 (칼 사이 쉼 0 ~ pmax · 손가락 댄 채) */
function chainFrames(rnd, st, K, pmax, windV = 1.2, windHeld = true, windPause = 0.3) {
  const fr = [];
  fr.push(...fingerTo(st, nextWp(rnd, st.x, st.y), windV, windHeld));
  fr.push(...hold(windPause / FRAME, windHeld));
  for (let k = 0; k < K; k++) {
    if (k > 0) fr.push(...hold((rnd() * pmax) / FRAME, true));
    const p = nextWp(rnd, st.x, st.y);
    fr.push(...fingerTo(st, [p[0] + (rnd() - 0.5) * 0.08, p[1] + (rnd() - 0.5) * 0.08], 3.5 + rnd() * 2.5, true));
  }
  return fr;
}

/** 휘두르기 끝마다 게임 읽기 그대로 적음 (진짜 긋기 · 사슬 · n · 위력) · 기력 청구(베기)마다 배율 */
function tracker(P) {
  const T = { cuts: [], charges: [], wasSw: false };
  const ca = P.stamina.chargeAttack.bind(P.stamina);
  P.stamina.chargeAttack = (kind = 'cut', bundled = P.stamina.inSecret, credit = 0) => {
    if (!bundled && !P.stamina.exhausted) T.charges.push({ t: P.ibFlowT ?? 0, kind, n: kind === 'cut' ? P.ibChainN?.() ?? 0 : 0, k: kind === 'cut' ? P.ibChainCostK?.() ?? 1 : 1, v0: P.stamina.value });
    return ca(kind, bundled, credit);
  };
  T.step = () => {
    const sw = !!P.ibFlowSw;
    if (T.wasSw && !sw) {
      const real = !!P.ibFlowWasCut;
      const chain = !!P.ibFlowChain;
      T.cuts.push({ t: P.ibFlowT, real, chain, n: real && chain ? P.ibCutN ?? 0 : 0, k: P.ibFlowOn ? P.ibFlowK() : 1 });
    }
    T.wasSw = sw;
  };
  return T;
}
/** 진짜 긋기 줄 → 사슬 길이(이어 그은 수의 최고 — 사슬 하나마다) */
function chainsOf(cuts) {
  const R = cuts.filter((c) => c.real);
  const out = [];
  let cur = 0;
  for (const c of R) {
    if (c.n > 0) cur = Math.max(cur, c.n);
    else {
      if (cur > 0) out.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) out.push(cur);
  return out;
}
const distOf = (a) => a.reduce((o, x) => ((o[x] = (o[x] ?? 0) + 1), o), {});

/** 허공 이어 긋기 (chain · exhaust): 상대 6 m 밖에 선 채 · 상처 없음 */
export function airRun({ w = 'zweihander', kit = 'b6', seed = 1, dur = 30, pmax = 0.5, set = 'practice', untilExhaust = false } = {}) {
  const G = newRound({ walls: false, weapon: w, weapon2: 'longsword', seed, gap: 6, kit: KITS[kit] });
  const P = G.player, E = G.enemy;
  setupPlayer(P);
  for (const x of [P, E]) x.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  new PlayerUniqueAssist(P, { names: KITS[kit].unique }); // main.js 처럼 익힌 칸 강화 (P.skill.uniq)
  const rnd = lcg(seed * 13);
  const T = tracker(P);
  const st = { x: 0, y: 0 };
  let queue = [], next = 1.0, k = 0, tTired = null, tEx = null, cutsTired = null;
  G.before = () => {
    if (!queue.length && G.t >= next) {
      st.x = P.handOffset.x; st.y = P.handOffset.y;
      const K = set === 'endless' ? 400 : set === 'fight' ? (() => { const r = rnd(); return r < 0.4 ? 1 : r < 0.75 ? 2 : 3; })() : 3 + Math.floor(rnd() * 3);
      queue = chainFrames(rnd, st, K, pmax);
      queue.push(...hold(6, false));
      next = Infinity;
    }
    if (k++ % SPF === 0) {
      const fq = queue.shift() ?? [0, 0, false];
      P.skill.uniq?.feed(fq[0], fq[1], FRAME, false);
      P.handOffset.x += fq[0]; P.handOffset.y += fq[1];
      P.handHeld = fq[2];
      P.inputActive = Math.abs(fq[0]) + Math.abs(fq[1]) > 1e-5;
      if (!queue.length && next === Infinity) next = G.t + 1.0 + rnd() * 0.6;
    }
    P.move.set(0, 0); P.stickX = 0; P.stickY = 0;
  };
  try {
    const maxT = untilExhaust ? dur : dur;
    for (let i = 0; i < Math.round(maxT / DT); i++) {
      G.step();
      T.step();
      if (tTired == null && P.stamina.value < 0) { tTired = G.t; cutsTired = T.charges.length; }
      if (untilExhaust && P.stamina.exhausted) { tEx = G.t; break; }
    }
    return { w, kit, seed, cuts: T.cuts, charges: T.charges, tTired, cutsTired, tEx, cutsEx: tEx != null ? T.charges.length : null, vMin: Math.min(...T.charges.map((c) => c.v0)), t: G.t, spent: { ...P.stamina.spent }, kinds: distOf(T.charges.map((c) => c.kind)), weight: +P.stamina.weight.toFixed(3) };
  } finally { G.world.free(); }
}

/** 칼 묶음 표 */
export function cutTable(runs, kit) {
  const C = runs.flatMap((r) => r.cuts);
  const R = C.filter((c) => c.real);
  const ch = runs.flatMap((r) => chainsOf(r.cuts));
  const ns = R.map((c) => c.n);
  const pow = (n) => (n <= 0 ? 1 : kit === 'b6' ? 1 + (IB_FLOW.power - 1) * n : IB_FLOW.power);
  const charges = runs.flatMap((r) => r.charges);
  return {
    swings: C.length, real: R.length, chained: R.filter((c) => c.n > 0).length,
    nDist: distOf(ns), nMax: Math.max(0, ...ns), chains: ch.length, chainLenDist: distOf(ch), chainLenP50: qt(ch, 0.5), chainLenP90: qt(ch, 0.9),
    powMean: r3(mean(R.map((c) => pow(c.n)))), powSeen: r3(mean(R.map((c) => c.k))), costK: r3(mean(charges.map((c) => c.k))), costKMin: r3(Math.min(1, ...charges.map((c) => c.k))),
  };
}

// ───────── fight (ib_flow_measure.mjs fight 꼴 · 키트 b5 / b6) ─────────
export function fightRun(opp, seed, kit, { w = 'zweihander', dur = 30, prof = 3, delay = 0.15 } = {}) {
  const G = newRound({ walls: true, seed, weapon: w, weapon2: opp, persona: { proficiency: prof }, kit: KITS[kit] });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player, A = G.enemy;
  setupPlayer(P);
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  new PlayerUniqueAssist(P, { names: KITS[kit].unique });
  const rnd = lcg(seed * 31 + Math.round(delay * 1000));
  const [CONTACT, REACH] = MEASURED[w] ?? MEASURED.longsword;
  const T = tracker(P);
  let queue = [], nextAtk = 2.6, due = Infinity, heldUntil = 0, lastMotion = -1, notice = false, k = 0, taps = 0;
  const st = { x: 0, y: 0 };
  G.before = () => {
    const t = G.t, dist = P.foeDistance();
    const motion = A.armed && dist < 2.4 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity && !queue.length) { due = t + delay + rnd() * 0.1; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) { due = Infinity; heldUntil = t + 0.6 + rnd() * 0.4; }
    guard.held = t < heldUntil && !queue.length && !P.skill.tap;
    guard.broken = !!(P.skill.tap || P.skill.pom || queue.length);
    if (!guard.held && !queue.length && t >= nextAtk && dist < REACH + 0.3 && P.alive && P.armed && !P.stamina.exhausted) {
      if (rnd() < 0.15) { if (P.skill.thrust()) taps++; }
      else {
        st.x = P.handOffset.x; st.y = P.handOffset.y;
        const r = rnd(), K = r < 0.4 ? 1 : r < 0.75 ? 2 : 3;
        queue = chainFrames(rnd, st, K, 0.4, 1.6, false, 4 * FRAME);
        queue.push(...hold(6, false));
      }
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    guard.step(DT);
    P.inputActive = guard.active;
    if (k++ % SPF === 0) {
      const fq = queue.shift() ?? [0, 0, false];
      const u = P.skill.uniq;
      u?.feed(fq[0], fq[1], FRAME, false);
      P.handOffset.x += fq[0]; P.handOffset.y += fq[1];
      P.handHeld = fq[2];
      if (Math.abs(fq[0]) + Math.abs(fq[1]) > 1e-5) P.inputActive = true;
    }
    const fwd = P.stamina.exhausted || !P.alive ? 0 : queue.length && dist > CONTACT ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.25 ? 0.45 : 0;
    P.move.set(0.18 * Math.sin(t * 0.65 + seed), fwd);
    P.stickX = P.move.x; P.stickY = P.move.y;
  };
  let dealt = 0, recv = 0, dealtFlow = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (att === A && vic === P) recv += sv;
    if (att === P && vic === A) { dealt += sv; if (P.ibFlowOn) dealtFlow += sv; }
  };
  let end = dur;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      T.step();
      if ((!P.alive || !A.alive) && end === dur) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    return { opp, seed, kit, win: !A.alive && P.alive, lose: !P.alive && A.alive, dealt, dealtFlow, recv, taps, t: G.t, cuts: T.cuts, charges: T.charges, staminaEnd: P.stamina.value };
  } finally { G.world.free(); }
}

// ───────── reach: 풍차 베기 'inside' 가 닿나 ─────────
export function reachRun({ w = 'zweihander', seed = 1, delay = 0.3, kit = 'b6', mode = IB_FLOW.windmillChain } = {}) {
  const keep = IB_FLOW.windmillChain;
  IB_FLOW.windmillChain = mode;
  const G = newRound({ walls: false, weapon: w, weapon2: 'longsword', seed, gap: 6, kit: KITS[kit] });
  const P = G.player, E = G.enemy;
  setupPlayer(P);
  for (const x of [P, E]) x.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  const uq = new PlayerUniqueAssist(P, { names: KITS[kit].unique });
  const rnd = lcg(seed * 977 + Math.round(delay * 1000));
  const st = { x: 0, y: 0 };
  const out = [];
  let queue = [], phase = 'idle', next = 1.0, k = 0, tUp = null, upD = 0, tPress = null, cur = null, tip0 = null;
  const press = { down: false };
  G.before = () => {
    uq.holdInput(press.down, true, false);
    if (phase === 'idle' && G.t >= next && !uq.cooling(uq.holdE)) {
      st.x = P.handOffset.x; st.y = P.handOffset.y;
      const r = rnd(), K = r < 0.4 ? 1 : r < 0.75 ? 2 : 3;
      queue = chainFrames(rnd, st, K, 0.4);
      phase = 'cuts';
    }
    if (k++ % SPF === 0) {
      const fq = queue.shift() ?? [0, 0, false];
      if (!uq.winding) { uq.feed(fq[0], fq[1], FRAME, false); P.handOffset.x += fq[0]; P.handOffset.y += fq[1]; } // 감는 동안 손가락은 안 읽음 (main.js)
      P.handHeld = fq[2] || press.down;
      P.inputActive = !uq.winding && Math.abs(fq[0]) + Math.abs(fq[1]) > 1e-5;
      if (phase === 'cuts' && !queue.length) {
        phase = 'up'; tUp = G.t; P.handHeld = false;
        upD = delay === 'h' ? 0.15 + rnd() * 0.35 : delay; // 손 뗌 → 다시 대기 ('h' = 사람 손 섞음 0.15 ~ 0.5 s)
      }
    }
    if (phase === 'up' && G.t - tUp >= upD) {
      phase = 'press'; press.down = true; tPress = G.t;
      cur = { d: +upD.toFixed(3), gap: (P.ibFlowT ?? 0) - (P.ibFlowCutEnd ?? -9), chainN: P.ibFlowChainNow?.() ?? -1, tip: [] };
      cur.inWin = cur.gap <= UA.afterWindow;
      tip0 = null;
    }
    if (phase === 'press') {
      const tp = P.bladePoint(1, new THREE.Vector3());
      if (!uq.winding && tip0) cur.tip.push(tp.distanceTo(tip0) / DT);
      tip0 = tp;
      if (uq.winding && (P.rdWind?.turns ?? 0) >= 1.05) {
        press.down = false;
        phase = 'fire';
      } else if (G.t - tPress > 4) { press.down = false; phase = 'fire'; cur.noWind = true; }
    }
    if (phase === 'fire' && !P.iai && !P.iaiReq && !uq.winding) {
      cur.n = uq.stats.windChain?.at(-1) ?? null;
      out.push(cur);
      cur = null;
      phase = 'idle';
      next = G.t + 0.5;
    }
    P.move.set(0, 0); P.stickX = 0; P.stickY = 0;
  };
  try {
    for (let i = 0; i < Math.round(40 / DT); i++) G.step();
    return out.map((x) => ({ d: x.d, gap: r3(x.gap), inWin: x.inWin, chainN: x.chainN, n: x.n, tipP50: r3(qt(x.tip, 0.5)), still: x.tip.length ? r3(x.tip.filter((v) => v < 1.5).length / x.tip.length) : null, noWind: !!x.noWind }));
  } finally { IB_FLOW.windmillChain = keep; G.world.free(); }
}

if (isMain(import.meta.url)) {
  const args = {};
  const pos = [];
  for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) args[m[1]] = m[2] ?? true; else pos.push(a); }
  const MODE = pos[0] ?? 'chain';
  const NS = +(args.seeds ?? 8), S0 = +(args.seed0 ?? 1);
  const SEEDS = Array.from({ length: NS }, (_, i) => S0 + i);
  const WS = String(args.ws ?? args.w ?? 'zweihander').split(',');
  const out = { mode: MODE, args, res: [] };
  if (MODE === 'chain') {
    for (const w of WS) for (const kit of ['b5', 'b6']) {
      const runs = SEEDS.map((seed) => airRun({ w, kit, seed, dur: +(args.dur ?? 30), pmax: +(args.pmax ?? 0.5), set: args.set ?? 'practice' }));
      const tb = cutTable(runs, kit);
      out.res.push({ w, kit, tb });
      console.log(`${w} ${kit} chain(${args.set ?? 'practice'} · 쉼 0 ~ ${args.pmax ?? 0.5}): ${JSON.stringify(tb)}`);
    }
  } else if (MODE === 'exhaust') {
    for (const w of WS) for (const kit of ['b5', 'b6']) {
      const runs = SEEDS.map((seed) => airRun({ w, kit, seed, dur: +(args.max ?? 120), pmax: +(args.pmax ?? 0.3), set: 'endless', untilExhaust: true }));
      const ex = runs.filter((r) => r.tEx != null);
      const s = { n: runs.length, weight: runs[0].weight, kinds: runs[0].kinds, spent: Object.fromEntries(Object.entries(runs[0].spent).map(([k, v]) => [k, r3(v)])), exhausted: ex.length, cutsEx: r3(mean(ex.map((r) => r.cutsEx))), cutsExMin: Math.min(...ex.map((r) => r.cutsEx)), cutsExMax: Math.max(...ex.map((r) => r.cutsEx)), tEx: r3(mean(ex.map((r) => r.tEx))), cutsTired: r3(mean(runs.map((r) => r.cutsTired).filter((x) => x != null))), tTired: r3(mean(runs.map((r) => r.tTired).filter((x) => x != null))), vMin: r3(Math.min(...runs.map((r) => r.vMin))), tb: (({ nDist, chainLenDist, ...x }) => x)(cutTable(runs, kit)) };
      out.res.push({ w, kit, s, runs: runs.map((r) => ({ seed: r.seed, cutsEx: r.cutsEx, tEx: r.tEx, cutsTired: r.cutsTired, tTired: r.tTired })) });
      console.log(`${w} ${kit} exhaust: ${JSON.stringify(s)}`);
    }
  } else if (MODE === 'fight') {
    const opps = String(args.opps ?? 'longsword,uchigatana,rapier').split(',');
    for (const w of WS) {
      const by = {};
      for (const kit of ['b5', 'b6']) {
        const runs = [];
        for (const opp of opps) for (const seed of SEEDS) runs.push(fightRun(opp, seed, kit, { w, dur: +(args.dur ?? 30), prof: +(args.prof ?? 3) }));
        const tb = cutTable(runs, kit);
        const s = { n: runs.length, win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length, dealt: r3(mean(runs.map((r) => r.dealt))), dealtFlow: r3(mean(runs.map((r) => r.dealtFlow))), recv: r3(mean(runs.map((r) => r.recv))), staminaEnd: r3(mean(runs.map((r) => r.staminaEnd))), tb };
        by[kit] = { runs, s };
        out.res.push({ w, kit, s, runs: runs.map((r) => ({ opp: r.opp, seed: r.seed, win: r.win, lose: r.lose, dealt: r3(r.dealt), recv: r3(r.recv) })) });
        console.log(`${w} ${kit} fight: ${JSON.stringify(s)}`);
      }
      // 같은 판 짝 차이 (b6 − b5) · 부트스트랩 95 %
      const dif = by.b6.runs.map((r, i) => r.dealt - by.b5.runs[i].dealt);
      const lcgB = lcg(7), B = [];
      for (let b = 0; b < 2000; b++) { let s = 0; for (let i = 0; i < dif.length; i++) s += dif[Math.floor(lcgB() * dif.length)]; B.push(s / dif.length); }
      console.log(`${w} 준 상처 b6 − b5 = ${r3(mean(dif))} [${r3(qt(B, 0.025))}, ${r3(qt(B, 0.975))}]`);
      out.res.push({ w, diff: { mean: r3(mean(dif)), ci: [r3(qt(B, 0.025)), r3(qt(B, 0.975))] } });
    }
  } else if (MODE === 'reach') {
    const delays = String(args.delays ?? '0.1,0.2,0.3,0.4,0.5,h').split(',').map((x) => (x === 'h' ? 'h' : +x));
    for (const w of WS) for (const d of delays) {
      const R = SEEDS.flatMap((seed) => reachRun({ w, seed, delay: d, mode: args.mode ?? IB_FLOW.windmillChain }));
      const W = R.filter((x) => !x.noWind);
      const s = { delay: d, n: R.length, wound: W.length, inWin: W.filter((x) => x.inWin).length, inWinShare: r3(W.filter((x) => x.inWin).length / Math.max(1, W.length)), gapP50: r3(qt(W.map((x) => x.gap), 0.5)), gapP10: r3(qt(W.map((x) => x.gap), 0.1)), tipP50: r3(qt(W.map((x) => x.tipP50), 0.5)), stillP50: r3(qt(W.map((x) => x.still), 0.5)), nDist: distOf(W.map((x) => x.n)), insideN: distOf(W.filter((x) => x.chainN >= 0).map((x) => x.chainN + 1)) };
      out.res.push({ w, s, R });
      console.log(`${w} reach delay ${d}: ${JSON.stringify(s)}`);
    }
  }
  if (args.json) writeFileSync(args.json, JSON.stringify(out));
}
