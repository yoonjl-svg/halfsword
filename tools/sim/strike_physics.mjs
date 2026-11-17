// ─────────────────────────────────────────────────────────────
//  strike_physics.mjs — 준비 · 거리 · 걸음이 칼의 힘에 드나 (11/17 — 사장님 '어떤 방향으로 휘두르기 위해 그 반대 방향으로 몸이나 팔을 움직여야 하는데' ·
//   '현실 검술이 왜 거리 다툼을 하는지도 생각해봐 그게 효과적인 타격에 도움이 되서잖아?' · 기록 docs/strike/measure_okori_2026-11-17.md). 게임 값은 건드리지 않는다(읽기만).
//  run   : 숙련 4 거울(유파 다섯 × 무기 둘 × 씨앗 × 자리 둘 · 두 자리 LOOKS.enemy · 60 s) — 공격마다 감기 깊이 · 몸통 감기 · 칼끝 빠르기 · 걸음 · 상처,
//          상처마다 칼날 자리(손잡이 쪽 0 ~ 칼끝 1 — combat analyze 의 t) · 닿는 빠르기 · 판정 에너지 · 심각도 · 부위 · 골반 사이 거리 − 친 쪽 칼끝 거리 · 걸음 · 몸 빠르기 · 결정타.
//          게임 값 그대로 · 재기 전용 수 덮어쓰기 --cfg=PATH:수,… (cfg_override.mjs — 예: 칼날 자리 무게 · 걸음 운동량을 견줄 때 --cfg=STRIKE.bladeW0:1,STRIKE.stepMass:0).
//  agg   : 표 (파일 여럿)
//  bench : 같은 칼을 같은 자리에서 — AI 손 대본(parry_assist_bench 와 같은 꼴): 쉼 0.6 s → 준비 자리(없음 · 실린 자리 · 너머 0.15)로 3 m/s → 0.15 s → 길을 11 m/s 로 긋기.
//          몸통 감기(오코리 몸 덧씌우기 크기 1) · 들어가는 걸음(pass 0.6) 있음 / 없음 · 거리 훑기. 맞는 쪽은 서 있는 몸(손을 아래 옆에 — 몸이 열림).
//  node tools/sim/strike_physics.mjs run [--seeds=1-6] [--shard=i/n] [--json=out.json] [--cfg=PATH:수,…]
//  node tools/sim/strike_physics.mjs agg a.json …
//  node tools/sim/strike_physics.mjs bench [--weapons=longsword,hwando,zweihander] [--json=out.json] [--cfg=PATH:수,…]
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, DT } from './harness_m.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { LOOKS } from '../../src/looks.js';
import { AI_PROFICIENCY } from '../../src/config.js';
import { TECH } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';
import { applyCfgArgs } from './cfg_override.mjs';
applyCfgArgs(); // config 수 덮어쓰기 (재기 전용 · 게임 값 그대로 — cfg_override.mjs)

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
function yawOf(q) { return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)); }
const unwrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ── 싸움 재기 ──
export function runFight({ school, wi, seed, swap, prof = [4, 4], dur = 60 }) {
  const weapon = WEAPONS[school][wi];
  const L = AI_PROFICIENCY.levels;
  const pP = swap ? prof[1] : prof[0], pE = swap ? prof[0] : prof[1];
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, look: LOOKS.enemy, look2: LOOKS.enemy,
    difficulty: L[pE], difficulty2: L[pP], persona: { proficiency: pE }, persona2: { proficiency: pP },
  });
  const F = [G.player, G.enemy];
  const A = [G.ai2, G.ai];
  const N = Math.ceil(dur / DT) + 8;
  const mk = () => ({ ax: new Float32Array(N), ay: new Float32Array(N), cy: new Float32Array(N), tip: new Float32Array(N), req: new Uint8Array(N), air: new Uint8Array(N), clos: new Float32Array(N) });
  const S = [mk(), mk()];
  const atks = [[], []];
  const wounds = [];
  let n = 0;
  G.onWound = (att, vic, r) => {
    if (!(r.severity > 0) && r.type === 'blunt') return;
    const i = att === F[0] ? 0 : att === F[1] ? 1 : -1;
    if (i < 0) return;
    const pa = att.bodies.pelvis.translation(), pv = vic.bodies.pelvis.translation();
    const dpp = Math.hypot(pv.x - pa.x, pv.z - pa.z);
    const ai = A[i];
    wounds.push({ i, n, u: +(r.t ?? 0).toFixed(3), speed: +(r.speed ?? 0).toFixed(2), E: +(r.energy ?? 0).toFixed(1), Ep: +(r.ephys ?? 0).toFixed(1), mEff: +(r.mEff ?? 0).toFixed(3), sev: +(r.severity ?? 0).toFixed(3),
      zone: r.zone, type: r.type, dpp: +dpp.toFixed(2), reach: +ai.M.reach.toFixed(2), mode: ai.mode, phase: ai.phase, why: ai.why ?? null, kind: ai.tech?.kind ?? null,
      clos: +S[i].clos[Math.max(0, n - 1)].toFixed(2), deciding: false });
  };
  for (let i = 0; i < 2; i++) {
    const ai = A[i];
    const oSA = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt = {}) => {
      const before = ai.atkSeq;
      const r = oSA(tech, why, opt);
      if (r && ai.mode === 'attack' && ai.atkSeq !== before) {
        const t = ai.tech;
        const end = t?.path?.length ? t.path[t.path.length - 1] : t?.from;
        atks[i].push({ iD: n, tech: t?.name, kind: t?.kind, why, chain: opt.chain ?? 0, secret: !!opt.secret, passive: !!opt.passive, skip: !!opt.skipChamber,
          dx: end ? end[0] - t.from[0] : 0, dy: end ? end[1] - t.from[1] : 0, iS: null, okori: ai.okori ? +ai.okori.T.toFixed(2) : 0, loaded: ai.okori?.loaded ?? null });
      }
      return r;
    };
    const oSS = ai.startStrike.bind(ai);
    ai.startStrike = (...x) => {
      const cur = atks[i][atks[i].length - 1];
      const r = oSS(...x);
      if (cur && cur.iS == null && ai.mode === 'attack') cur.iS = n;
      return r;
    };
  }
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(F[0]) && !out(F[1])) {
    G.step();
    for (let i = 0; i < 2; i++) {
      const f = F[i], o = F[1 - i], s = S[i];
      s.ax[n] = f.skill.aim.x; s.ay[n] = f.skill.aim.y;
      s.cy[n] = yawOf(f.bodies.chest.rotation());
      s.tip[n] = f.tipVel.length();
      const g = f.gait;
      s.req[n] = g?.req ? 1 : 0;
      s.air[n] = g && (!g.legs.F.stance || !g.legs.B.stance) ? 1 : 0;
      const pe = f.bodies.pelvis.translation(), po = o.bodies.pelvis.translation();
      const dx = po.x - pe.x, dz = po.z - pe.z, dd = Math.hypot(dx, dz) || 1e-3;
      const v = f.bodies.pelvis.linvel();
      s.clos[n] = (v.x * dx + v.z * dz) / dd;
    }
    n++;
  }
  // 결정타 = 진 쪽이 받은 마지막 상처
  const loser = out(F[0]) && !out(F[1]) ? 0 : out(F[1]) && !out(F[0]) ? 1 : -1;
  if (loser >= 0) {
    for (let k = wounds.length - 1; k >= 0; k--) if (wounds[k].i === 1 - loser && wounds[k].sev > 0) { wounds[k].deciding = true; break; }
  }
  for (const w of wounds) {
    const s = S[w.i];
    let st = 0;
    for (let j = Math.max(0, w.n - Math.round(0.5 / DT)); j < w.n; j++) if (s.req[j]) { st = 1; break; }
    w.step = st;
  }
  const attacks = [];
  for (let i = 0; i < 2; i++) {
    const s = S[i];
    const list = atks[i].filter((a) => a.iS != null);
    for (let q = 0; q < list.length; q++) {
      const a = list[q];
      const nx = list[q + 1];
      const dn = Math.hypot(a.dx, a.dy) || 1;
      const ux = a.dx / dn, uy = a.dy / dn;
      let depth = 0;
      for (let j = a.iD; j <= a.iS; j++) depth = Math.max(depth, -((s.ax[j] - s.ax[a.iD]) * ux + (s.ay[j] - s.ay[a.iD]) * uy));
      const dyaw = unwrap(s.cy[a.iS] - s.cy[a.iD]);
      const dhx = s.ax[a.iS] - s.ax[a.iD];
      const jE = Math.min(n - 1, nx ? nx.iD : n - 1, a.iS + Math.round(0.4 / DT));
      let tip = 0;
      for (let j = a.iS; j <= jE; j++) tip = Math.max(tip, s.tip[j]);
      let step = 0;
      for (let j = Math.max(0, a.iS - Math.round(0.4 / DT)); j <= Math.min(n - 1, a.iS + Math.round(0.2 / DT)); j++) if (s.req[j]) { step = 1; break; }
      const w = wounds.find((x) => x.i === i && x.n >= a.iS && x.n <= Math.min(n, a.iS + Math.round(1.0 / DT)) && (!nx || x.n < nx.iD));
      attacks.push({ i, tech: a.tech, kind: a.kind, why: a.why, chain: a.chain, secret: a.secret, passive: a.passive, skip: a.skip, okori: a.okori, loaded: a.loaded, ux: +ux.toFixed(2), uy: +uy.toFixed(2),
        prep: +((a.iS - a.iD) * DT).toFixed(3), depth: +depth.toFixed(3), dyaw: +dyaw.toFixed(3), dhx: +dhx.toFixed(3), tip: +tip.toFixed(2), step,
        wE: w ? w.E : null, wSev: w ? w.sev : null, wU: w ? w.u : null });
    }
  }
  const rec = { school, weapon, seed, swap, endT: +G.t.toFixed(2), loser, attacks, wounds: wounds.map(({ n: _n, ...w }) => w) };
  G.world.free();
  return rec;
}

// ── 통계 ──
const q = (a, p) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + ' %' : '-');
const med = (a) => q(a, 0.5);
const zoneTop = (ws) => { const c = {}; for (const w of ws) c[w.zone] = (c[w.zone] ?? 0) + 1; return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${pc(v / ws.length)}`).join(' · '); };

function woundRow(label, ws, all) {
  if (!ws.length) return `| ${label} | 0 | - | - | - | - | - | - | - |`;
  return `| ${label} | ${ws.length} (${pc(ws.length / all)}) | ${f1(med(ws.map((w) => w.speed)))} | ${f1(med(ws.map((w) => w.E)))} [${f1(q(ws.map((w) => w.E), 0.25))} ~ ${f1(q(ws.map((w) => w.E), 0.75))}] | ${f2(med(ws.map((w) => w.mEff)))} | ${f2(med(ws.map((w) => w.sev)))} | ${pc(ws.filter((w) => w.sev >= 1).length / ws.length)} | ${zoneTop(ws)} | ${pc(ws.filter((w) => w.deciding).length / ws.length)} |`;
}
const WHEAD = '| 칸 | 상처 수 (몫) | 닿는 빠르기 m/s (중앙) | 판정 에너지 J 중앙 [25 ~ 75 %] | 유효 질량 kg | 심각도 중앙 | 심각도 ≥ 1 몫 | 부위 (많은 셋) | 결정타 몫 |\n|---|---|---|---|---|---|---|---|---|';

export function report(runs) {
  const W = runs.flatMap((r) => r.wounds).filter((w) => w.type !== 'blunt' || w.sev > 0);
  const A = runs.flatMap((r) => r.attacks);
  const out = [];
  const fights = runs.length;
  const dec = runs.filter((r) => r.loser >= 0).length;
  out.push(`판 ${fights} (승부 ${dec}) · 상처 ${W.length} (베기 ${W.filter((w) => w.type === 'cut').length} · 찌르기 ${W.filter((w) => w.type === 'stab').length} · 둔타 ${W.filter((w) => w.type === 'blunt').length}) · 휘두름까지 간 공격 ${A.length}`);
  // 한눈에 (11/17 C 물리 견줌 — 판 길이 · 비김 · 판당 상처 · 칼날 끝 ⅓ 대 손잡이 쪽 ⅓ · 들어가며 대 서서 · 거리 칸 — 베기 판정 에너지 J 중앙)
  {
    const cut = W.filter((w) => w.type === 'cut');
    const eMed = (xs) => `${f1(med(xs.map((w) => w.E)))} J (${xs.length})`;
    const gap = (w) => w.dpp - w.reach;
    out.push(`\n### 한눈에`);
    out.push(`| 판 길이 평균 · 중앙 | 비김 (60 s 넘김 · 둘 다 섬) | 판당 상처 (심각도 > 0) | 판당 상처 (모두) |\n|---|---|---|---|`);
    out.push(`| ${f1(runs.reduce((a, r) => a + r.endT, 0) / fights)} · ${f1(med(runs.map((r) => r.endT)))} s | ${pc((fights - dec) / fights)} (${fights - dec}) | ${f2(W.filter((w) => w.sev > 0).length / fights)} | ${f2(W.length / fights)} |`);
    out.push(`\n| 베기 판정 에너지 J 중앙 (수) | 값 |\n|---|---|`);
    out.push(`| 칼날 끝 ⅓ (t ≥ ⅔) | ${eMed(cut.filter((w) => w.u >= 2 / 3))} |`);
    out.push(`| 칼날 가운데 ⅓ | ${eMed(cut.filter((w) => w.u >= 1 / 3 && w.u < 2 / 3))} |`);
    out.push(`| 칼날 손잡이 쪽 ⅓ (t < ⅓) | ${eMed(cut.filter((w) => w.u < 1 / 3))} |`);
    out.push(`| 들어가며 (친 쪽 골반 ≥ 0.5 m/s) | ${eMed(cut.filter((w) => w.clos >= 0.5))} |`);
    out.push(`| 서서 (±0.2 m/s) | ${eMed(cut.filter((w) => Math.abs(w.clos) < 0.2))} |`);
    out.push(`| 물러나며 (≤ −0.2 m/s) | ${eMed(cut.filter((w) => w.clos <= -0.2))} |`);
    out.push(`| 깊은 안 (골반 사이 − 칼끝 ≤ −0.45) | ${eMed(cut.filter((w) => gap(w) <= -0.45))} |`);
    out.push(`| 안 (−0.45 ~ −0.15) | ${eMed(cut.filter((w) => gap(w) > -0.45 && gap(w) <= -0.15))} |`);
    out.push(`| 간격 끝 (±0.15) | ${eMed(cut.filter((w) => gap(w) > -0.15 && gap(w) <= 0.15))} |`);
    out.push(`| 밖 (> +0.15) | ${eMed(cut.filter((w) => gap(w) > 0.15))} |`);
  }
  for (const ty of ['cut', 'stab']) {
    const ws = W.filter((w) => w.type === ty);
    const KO = ty === 'cut' ? '베기' : '찌르기';
    out.push(`\n### 칼날 자리 (손잡이 쪽 0 ~ 칼끝 1) — ${KO} ${ws.length}`);
    out.push(WHEAD);
    for (const [a, b] of [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]]) out.push(woundRow(`${a.toFixed(1)} ~ ${Math.min(1, b).toFixed(1)}`, ws.filter((w) => w.u >= a && w.u < b), ws.length));
    out.push(`\n### 골반 사이 거리 − 친 쪽 칼끝 거리(M.reach) — ${KO}`);
    out.push(WHEAD);
    for (const [nm, a, b] of [['깊은 안 (≤ −0.45)', -9, -0.45], ['안 (−0.45 ~ −0.15)', -0.45, -0.15], ['간격 끝 (−0.15 ~ +0.15)', -0.15, 0.15], ['밖 (> +0.15)', 0.15, 9]]) out.push(woundRow(nm, ws.filter((w) => w.dpp - w.reach > a && w.dpp - w.reach <= b), ws.length));
    out.push(`\n### 들어가는 걸음 · 몸 빠르기 — ${KO}`);
    out.push(WHEAD);
    out.push(woundRow('걸음 부탁 0.5 s 안 (있음)', ws.filter((w) => w.step), ws.length));
    out.push(woundRow('걸음 없음', ws.filter((w) => !w.step), ws.length));
    out.push(woundRow('친 쪽 골반이 상대 쪽 ≥ 0.5 m/s', ws.filter((w) => w.clos >= 0.5), ws.length));
    out.push(woundRow('친 쪽 골반 −0.2 ~ 0.2 m/s (서서)', ws.filter((w) => Math.abs(w.clos) < 0.2), ws.length));
    out.push(woundRow('친 쪽 물러나며 (≤ −0.2 m/s)', ws.filter((w) => w.clos <= -0.2), ws.length));
    out.push(`\n### 막힌 칼 대 치는 자리 — ${KO}`);
    out.push(WHEAD);
    out.push(woundRow('막힌 칼 (칼날 ⅓ 손잡이 쪽 · 거리 ≤ 칼끝 − 0.3)', ws.filter((w) => w.u < 1 / 3 && w.dpp - w.reach <= -0.3), ws.length));
    out.push(woundRow('치는 자리 (칼날 끝 ⅓ · 거리 > 칼끝 − 0.15)', ws.filter((w) => w.u >= 2 / 3 && w.dpp - w.reach > -0.15), ws.length));
  }
  // 감기 · 몸통 (공격)
  const C = A.filter((a) => a.kind === 'cut' && !a.chain && !a.secret);
  const lat = C.filter((a) => Math.abs(a.ux) >= 0.3);
  let num = 0;
  for (const a of lat) num += a.dyaw * a.dhx;
  const sg = num >= 0 ? 1 : -1; // 손이 오른쪽으로 가면 가슴도 그쪽으로 (자세표 몸 돌림 — 부호 맞춤)
  const coil = (a) => sg * a.dyaw * -Math.sign(a.ux) * (180 / Math.PI);
  const aRow = (label, xs) => `| ${label} | ${xs.length} | ${f2(med(xs.map((a) => a.prep)))} | ${f2(med(xs.map((a) => a.tip)))} [${f2(q(xs.map((a) => a.tip), 0.25))} ~ ${f2(q(xs.map((a) => a.tip), 0.75))}] | ${pc(xs.filter((a) => a.wE != null).length / (xs.length || 1))} | ${f1(med(xs.filter((a) => a.wE != null).map((a) => a.wE)))} | ${f2(med(xs.filter((a) => a.wSev != null).map((a) => a.wSev)))} |`;
  const AH = '| 칸 | 공격 | 결정 → 휘두름 s | 휘두름 칼끝 최고 m/s 중앙 [25 ~ 75 %] | 상처 낸 몫 | 상처 에너지 J 중앙 | 심각도 중앙 |\n|---|---|---|---|---|---|---|';
  out.push(`\n### 감기 깊이 (결정 → 휘두름 시작 사이 손이 베기 반대쪽으로 간 최대 패드 m) — 새 베기 ${C.length}`);
  out.push(AH);
  for (const [nm, a, b] of [['0 ~ 0.05 (감기 없음)', -1, 0.05], ['0.05 ~ 0.15', 0.05, 0.15], ['0.15 ~ 0.3', 0.15, 0.3], ['> 0.3 (크게 감음)', 0.3, 9]]) out.push(aRow(nm, C.filter((x) => x.depth > a && x.depth <= b)));
  out.push(`\n### 몸통 감기 (가로 몫 ≥ 0.3 인 베기 ${lat.length} · 결정 → 휘두름 시작 가슴 요 변화를 베기 반대쪽 + 로)`);
  out.push(AH);
  for (const [nm, a, b] of [['< 0° (베는 쪽으로 미리 돎)', -999, 0], ['0 ~ 5°', 0, 5], ['5 ~ 15°', 5, 15], ['> 15°', 15, 999]]) out.push(aRow(nm, lat.filter((x) => coil(x) > a && coil(x) <= b)));
  out.push(`\n### 공격 걸음 (휘두름 시작 0.4 s 앞 ~ 0.2 s 뒤에 걸음 부탁)`);
  out.push(AH);
  for (const k of ['cut', 'thrust']) {
    const xs = A.filter((a) => a.kind === k && !a.chain && !a.secret);
    out.push(aRow(`${k === 'cut' ? '베기' : '찌르기'} — 걸음 있음`, xs.filter((a) => a.step)));
    out.push(aRow(`${k === 'cut' ? '베기' : '찌르기'} — 걸음 없음`, xs.filter((a) => !a.step)));
  }
  out.push(`\n(부호 맞춤 ${sg > 0 ? '+' : '−'} · 판 길이 중앙 ${f1(med(runs.map((r) => r.endT)))} s)`);
  return out.join('\n');
}

// ── 같은 칼 대본 (bench) ──
const T = Object.fromEntries(TECH.map((t) => [t.name, t]));
export function trial({ weapon, tech, gap, chamber, coil, step }) {
  const t = T[tech];
  const Gm = newRound({ weapon, weapon2: weapon, seed: 1, gap, look: LOOKS.enemy, look2: LOOKS.enemy });
  const D = Gm.player, A = Gm.enemy;
  Gm.ai.update = () => {};
  A.move.set(0, 0);
  D.move.set(0, 0);
  const setPad = (f, x, y) => (f.handOffset.set(x, y), f.skill.aimRaw?.set?.(x, y));
  const end = t.path[t.path.length - 1];
  const dn = Math.hypot(end[0] - t.from[0], end[1] - t.from[1]) || 1;
  const ux = (end[0] - t.from[0]) / dn, uy = (end[1] - t.from[1]) / dn;
  const rest = [0.15, -0.1];
  const inPad = (x, y) => { const rr = Math.hypot(x, y); return rr > 0.6 ? [(x * 0.6) / rr, (y * 0.6) / rr] : [x, y]; }; // 손 목표 한도 안 (ai_measure.js 와 같음)
  const C = chamber === 'none' ? rest : chamber === 'deep' && t.kind !== 'thrust' ? inPad(t.from[0] - ux * 0.15, t.from[1] - uy * 0.15) : t.from;
  const r = { weapon, tech, gap, chamber, coil, step, tip: 0, hp: 0, E: null, sev: null, u: null, speed: null, zone: null, clash: 0 };
  let ph = 0, t0 = 0, pts = null, ts = null;
  const c0 = Gm.clashes;
  Gm.onWound = (att, vic, w) => { if (att === A && vic === D && r.E == null && (w.type !== 'blunt' || w.severity > 0)) { r.E = +w.energy.toFixed(1); r.sev = +w.severity.toFixed(3); r.u = +w.t.toFixed(3); r.speed = +w.speed.toFixed(2); r.zone = w.zone; r.type = w.type; } };
  Gm.before = () => {
    setPad(D, 0.4, -0.5); // 맞는 쪽: 손을 아래 옆에 (몸이 열림)
    const o = A.handOffset;
    const go = (tx, ty, sp) => {
      const dx = tx - o.x, dy = ty - o.y, dd = Math.hypot(dx, dy), st = sp * DT;
      if (dd > st) setPad(A, o.x + (dx / dd) * st, o.y + (dy / dd) * st);
      else return setPad(A, tx, ty), true;
      return false;
    };
    if (ph === 0) { setPad(A, rest[0], rest[1]); if (Gm.t > 0.6) ph = 1; }
    else if (ph === 1 && go(C[0], C[1], 3)) (ph = 2), (t0 = Gm.t);
    else if (ph === 2 && Gm.t - t0 > 0.15) {
      ph = 3; pts = t.path.map((p) => p.slice()); ts = Gm.t;
      A.okoriBody = null;
      if (step) A.move.set(0, 1);
    } else if (ph === 3 && go(pts[0][0], pts[0][1], 11) && (pts.shift(), !pts.length)) (ph = 4), (t0 = Gm.t);
    if (ph === 3 && step && Gm.t - ts < 0.02) A.gait?.requestStep({ kind: t.kind === 'thrust' ? 'lunge' : 'pass', fwd: 0.6, hold: 0.3 });
    if (ts != null && Gm.t - ts > 0.35) A.move.set(0, 0);
    if (coil && (ph === 1 || ph === 2)) { const y = -ux * 0.35; A.okoriBody = { pelvisYaw: y, chestYaw: y, pitch: 0, drop: 0 }; }
    if (ts != null && Gm.t - ts < 0.5) { r.tip = Math.max(r.tip, A.tipVel.length()); r.hp = Math.max(r.hp, A.hitPointVel.length()); }
  };
  while (Gm.t < 3.0 && (ph < 4 || Gm.t - t0 < 0.5)) Gm.step();
  r.clash = Gm.clashes - c0;
  r.tip = +r.tip.toFixed(2);
  r.hp = +r.hp.toFixed(2);
  Gm.world.free();
  return r;
}

export function benchAll(weapons) {
  const out = [];
  const cuts = ['zornhau', 'oberhau', 'zwerch', 'unterhau'];
  for (const weapon of weapons) {
    for (const tech of cuts) for (const gap of [1.35, 1.6, 1.85]) for (const chamber of ['none', 'loaded', 'deep']) out.push(trial({ weapon, tech, gap, chamber, coil: 0, step: 0 }));
    for (const tech of ['zornhau', 'zwerch', 'unterhau']) for (const gap of [1.35, 1.6, 1.85]) out.push(trial({ weapon, tech, gap, chamber: 'loaded', coil: 1, step: 0 }));
    for (const tech of [...cuts, 'stichOchs']) for (const gap of [1.35, 1.6, 1.85]) out.push(trial({ weapon, tech, gap: gap + 0.45, chamber: 'loaded', coil: 0, step: 1 }));
    for (const tech of [...cuts, 'stichOchs']) for (const gap of [1.1, 1.25, 1.4, 1.55, 1.7, 1.85, 2.0]) out.push(trial({ weapon, tech, gap, chamber: 'loaded', coil: 0, step: 0 }));
    console.error(`${weapon} 끝 (${out.length})`);
  }
  return out;
}

export function benchReport(R) {
  const out = [];
  const row = (label, xs) => {
    const hit = xs.filter((x) => x.E != null);
    return `| ${label} | ${xs.length} | ${f2(med(xs.map((x) => x.tip)))} | ${f2(med(xs.map((x) => x.hp)))} | ${pc(hit.length / (xs.length || 1))} | ${f1(med(hit.map((x) => x.E)))} | ${f2(med(hit.map((x) => x.sev)))} | ${f2(med(hit.map((x) => x.u)))} |`;
  };
  const H = '| 칸 | 번 | 칼끝 최고 m/s 중앙 | 타격점(칼날 0.7) 최고 m/s | 몸에 상처 | 상처 에너지 J 중앙 | 심각도 중앙 | 닿은 칼날 자리 |\n|---|---|---|---|---|---|---|---|';
  const plain = R.filter((x) => !x.coil && !x.step);
  out.push('### 감기 깊이 (같은 베기 · 같은 거리 1.35 · 1.6 · 1.85 m — 베기 넷)');
  out.push(H);
  for (const c of ['none', 'loaded', 'deep']) out.push(row({ none: '감기 없음 (쉼 자리에서 곧장 긋기)', loaded: '실린 자리 (기술 준비 자리)', deep: '너머 0.15 (베기 반대쪽으로 더 감음)' }[c], plain.filter((x) => x.chamber === c && [1.35, 1.6, 1.85].includes(x.gap) && x.tech !== 'stichOchs')));
  out.push('\n### 몸통 감기 (실린 자리 · 가로 몫 있는 베기 셋 · 같은 거리)');
  out.push(H);
  const lat = (x) => ['zornhau', 'zwerch', 'unterhau'].includes(x.tech) && [1.35, 1.6, 1.85].includes(x.gap) && x.chamber === 'loaded' && !x.step;
  out.push(row('몸통 감기 없음', R.filter((x) => lat(x) && !x.coil)));
  out.push(row('몸통 감기 20° (오코리 크기 1)', R.filter((x) => lat(x) && x.coil)));
  out.push('\n### 들어가는 걸음 (실린 자리 · 걸음 있음은 0.45 m 더 먼 데서)');
  out.push(H);
  for (const k of ['cut', 'thrust']) {
    const isK = (x) => (k === 'thrust') === (x.tech === 'stichOchs');
    out.push(row(`${k === 'cut' ? '베기' : '찌르기'} — 걸음 없음 (1.35 · 1.6 · 1.85)`, R.filter((x) => isK(x) && !x.step && !x.coil && x.chamber === 'loaded' && [1.35, 1.6, 1.85].includes(x.gap))));
    out.push(row(`${k === 'cut' ? '베기' : '찌르기'} — pass/lunge 0.6 (1.8 · 2.05 · 2.3)`, R.filter((x) => isK(x) && x.step)));
  }
  out.push('\n### 거리 훑기 (실린 자리 · 걸음 없음) — 베기 넷 · 찌르기');
  out.push(H);
  for (const g of [1.1, 1.25, 1.4, 1.55, 1.7, 1.85, 2.0]) {
    out.push(row(`베기 ${g.toFixed(2)} m`, R.filter((x) => x.tech !== 'stichOchs' && x.gap === g && x.chamber === 'loaded' && !x.coil && !x.step)));
  }
  for (const g of [1.1, 1.25, 1.4, 1.55, 1.7, 1.85, 2.0]) {
    out.push(row(`찌르기 ${g.toFixed(2)} m`, R.filter((x) => x.tech === 'stichOchs' && x.gap === g && x.chamber === 'loaded' && !x.coil && !x.step)));
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    const runs = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(report(runs));
  } else if (mode === 'bench') {
    const R = benchAll(arg('weapons', 'longsword,hwando,zweihander').split(','));
    const o = arg('json', null);
    if (o) writeFileSync(o, JSON.stringify(R));
    console.log(benchReport(R));
  } else if (mode === 'benchagg') {
    const R = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(benchReport(R));
  } else {
    const seeds = range(arg('seeds', '1-6'));
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const list = [];
    for (const school of SCHOOLS) for (let wi = 0; wi < 2; wi++) for (const seed of seeds) for (const swap of [false, true]) list.push({ school, wi, seed, swap });
    const mine = list.filter((_, k) => k % sn === si - 1);
    console.error(`전체 ${list.length} 판 · 이 샤드 ${mine.length}`);
    const runs = [];
    for (const f of mine) {
      const r = runFight({ ...f, dur: +arg('dur', '60') });
      runs.push(r);
      console.error(`${f.school} w${f.wi} s${f.seed} ${f.swap ? 'swap' : 'std'} → 상처 ${r.wounds.length} @${r.endT}s`);
    }
    const o = arg('json', null);
    if (o) writeFileSync(o, JSON.stringify(runs));
    else console.log(report(runs));
  }
}
