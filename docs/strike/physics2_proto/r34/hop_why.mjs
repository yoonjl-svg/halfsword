// ─────────────────────────────────────────────────────────────
//  hop_why.mjs (r34 · 뛰기 여섯째 진단) — hop_trace.mjs 가 쓴 스텝 기록(--dump)을 읽어 본 판 다섯 줄의 기전을 표로 낸다. 시뮬을 돌리지 않는다(읽기만).
//   node hop_why.mjs <이름> <dump 파일들…>     줄의 정의(디딤 · 뜬 시간 · 받침 · 99 % · 흐름)는 run_scenes.mjs summarize 와 같은 셈을 옮겨 씀.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const [name, ...files] = process.argv.slice(2);
const G0 = 9.81;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (a, p) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const f2 = (x, d = 3) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d));
const runs = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const DT = 1 / 120;
const out = [];
const P = (...a) => out.push(a.join(' '));

const agg = { td: [], ph: [], kneeHi: [], drift: [], ends: [], lifts: [] };
for (const r of runs) {
  const tag = `${r.weapon.slice(0, 4)}#${r.variant}`;
  const S = r.steps, W = S.filter((x) => x.act && !x.warm);
  const Mg = r.Mg, thr = 0.03 * Mg, M = r.M;
  const t0 = W[0]?.t ?? 0;
  // ── 들어가기: 뛰는 걸음(runG)이 생긴 때 · 그 앞 걷는 동안 간 길 ──
  const iG = W.findIndex((x) => x.x.runG);
  // ── 뗌 사건 (걸음 장치의 디딤 → 뜸) — 그 스텝 앞 계획 · 위 속도 ──
  const lifts = [];
  for (let i = 1; i < W.length; i++) for (const k of ['F', 'B']) {
    const a = W[i - 1].x[k], b = W[i].x[k];
    if (a?.st && !b?.st) { const pl = W[i - 1].x.plan; lifts.push({ i, k, t: W[i].t - t0, vy: W[i].c.vy, vto: pl?.vto ?? null, pt: pl?.t ?? null, Tc: pl?.Tc ?? null, early: pl ? pl.t < pl.Tc - 1e-6 : null, planK: pl?.k ?? null, other: W[i].x[k === 'F' ? 'B' : 'F']?.st, Tf: pl?.Tf ?? null }); }
  }
  // ── 접촉 사건 (run_scenes 와 같은 셈) ──
  const tds = []; let air = 0; const cur = { F: null, B: null }; let lastOff = { F: null, B: null };
  let phase = null; const phases = [];
  for (let i = 0; i < W.length; i++) {
    const x = W[i], onF = x.nF > thr, onB = x.nB > thr, any = onF || onB;
    for (const k of ['F', 'B']) {
      const isOn = k === 'F' ? onF : onB;
      if (isOn && !cur[k]) { cur[k] = { i }; tds.push({ i, k, air, t: x.t - t0, otherOn: k === 'F' ? onB : onF, sinceOff: lastOff[k] != null ? (i - lastOff[k]) * DT : null, l: x.x[k], lPrev: W[Math.max(0, i - 1)].x[k], vy: x.c.vy, gs: x.gs[k], otherGs: x.gs[k === 'F' ? 'B' : 'F'] }); }
      if (!isOn && cur[k]) { cur[k] = null; lastOff[k] = i; }
    }
    if (any) {
      air = 0;
      if (!phase) phase = { i0: i, t0: x.t, J: 0, Jp: 0, planJ: x.planJ, steps: [] };
      phase.J += x.fy * DT; phase.Jp += x.plan * DT; phase.steps.push(i);
    } else {
      air += DT;
      if (phase) { phase.T = x.t - phase.t0; phases.push(phase); phase = null; }
    }
  }
  const tdReal = tds.filter((d) => d.i > 0);
  tdReal.forEach((d, n) => { d.n = n; });
  for (const d of tdReal) {
    // 그 발의 앞 뜸: 걸음 장치가 그 발을 뗀 때(lifts) 가운데 마지막
    const lf = lifts.filter((q) => q.k === d.k && q.i <= d.i).pop();
    const ol = lifts.filter((q) => q.k !== d.k && q.i <= d.i).pop(); // 다른 발이 마지막으로 뗀 때
    d.lift = lf; d.oLift = ol;
    // 이 디딤 앞 마지막 받침이 끝난 때 (두 발 모두 뜸이 시작된 스텝) 의 위 속도
    let j = d.i - 1; while (j > 0 && (W[j].nF <= thr && W[j].nB <= thr)) j--;
    d.vyOff = W[Math.min(W.length - 1, j + 1)].c.vy; d.airSteps = d.i - j - 1;
    d.gsLate = W[d.i].x[d.k === 'F' ? 'B' : 'F']?.st; // 닿은 스텝에 걸음 장치가 다른 발을 아직 디딤으로 둠
    agg.td.push({ tag, ...d, l: undefined, lPrev: undefined });
  }
  // ── 받침마다 충격량 ──
  for (const p of phases.filter((q) => q.T >= 0.05)) {
    const st = p.steps.map((i) => W[i]);
    const plans = st.map((x) => x.x.plan).filter(Boolean);
    const pj = st.map((x) => x.planJ).filter((v) => v != null);
    const firstPlanAt = st.findIndex((x) => x.planJ != null);
    const n = st.length, th = (a, b) => st.slice(Math.floor(a * n), Math.floor(b * n)).reduce((s, x) => s + x.fy * DT, 0);
    const plan0 = plans[0];
    const Jc = plans.length ? plans[plans.length - 1].Jc : null;
    const ratio = p.planJ != null ? p.J / p.planJ : p.Jp > 1 ? p.J / p.Jp : null;
    const cutN = st.filter((x) => x.x.cut).length;
    const both = st.filter((x) => x.nF > thr && x.nB > thr).length;
    const kSet = new Set(plans.map((q) => q.k));
    agg.ph.push({ tag, t: p.t0 - t0, T: p.T, J: p.J, planJ0: p.planJ, planJlast: pj.length ? pj[pj.length - 1] : null, planJmax: pj.length ? Math.max(...pj) : null, ratio, ratioLast: pj.length ? p.J / pj[pj.length - 1] : null, Jc, Jp: p.Jp, Tc: plan0?.Tc ?? null, Tf: plan0?.Tf ?? null, firstPlanAt, cutN, both, n, nPlans: kSet.size,
      J1: th(0, 1 / 3) / (p.J || 1), J2: th(1 / 3, 2 / 3) / (p.J || 1), J3: th(2 / 3, 1) / (p.J || 1), vyStart: st[0].c.vy, vyEnd: W[Math.min(W.length - 1, p.steps[n - 1] + 1)].c.vy, vto: plan0?.vto ?? null, vy0: plan0?.vy0 ?? null, kmMean: plans.length ? mean(plans.map((q) => q.km)) : null, Mg });
  }
  // ── 디딘 무릎 · 발목 몫 (모든 디딘 부름) ──
  for (let i = 0; i < W.length; i++) {
    const x = W[i];
    for (const c of x.callsX ?? []) {
      const pl = x.x.plan, other = c.k === 'F' ? 'B' : 'F';
      agg.kneeHi.push({ side: x.x.side, fwdx: x.x.fwdx, fwdz: x.x.fwdz, cFx: c.Fx, cFz: c.Fz, MgR: Mg, tag, t: x.t - t0, k: c.k, knee: c.sh.knee, ankle: c.sh.ankle, kneeV: c.shV.knee, ankleV: c.shV.ankle, kneeH: c.shH.knee, ankleH: c.shH.ankle, kneeA: c.shA.knee, Fy: c.Fy / Mg, kAng: c.knee, armK: c.armK, ax: c.ax, s: pl && pl.k === c.k ? pl.t / pl.Tc : null, nOn: (x.callsX ?? []).length, Fh: Math.hypot(c.Fx, c.Fz) / Mg, rk: c.rk, rkV: c.rkV, raz: c.raz, razV: c.razV, cut: x.x.cut, gsOther: x.gs[other], dN: x.x.dN });
    }
  }
  // ── 자리 흐름 ──
  {
    const c0 = W[0].c, fx = W.find((x) => x.x.fwdx != null)?.x, fw = { x: fx?.fwdx ?? 1, z: fx?.fwdz ?? 0 }, rg = { x: fx?.rgtx ?? 0, z: fx?.rgtz ?? 1 };
    const at = (tt) => { const x = W.find((q) => q.t - t0 >= tt - 1e-9) ?? W[W.length - 1]; const dx = x.c.x - c0.x, dz = x.c.z - c0.z; return { d: Math.hypot(dx, dz), f: dx * fw.x + dz * fw.z, l: dx * rg.x + dz * rg.z }; };
    const v0 = { f: c0.vx * fw.x + c0.vz * fw.z, l: c0.vx * rg.x + c0.vz * rg.z };
    const gIdx = iG < 0 ? W.length - 1 : iG, cg = W[gIdx].c;
    // 디딤 자리 (닿은 스텝 발목 − 무게중심 · 앞 · 옆) · 그때 속도
    const place = tdReal.map((d) => { const x = W[d.i], a = x.x[d.k]; const dx = a.ax - x.c.x, dz = a.az - x.c.z; return { k: d.k, t: x.t - t0, f: dx * fw.x + dz * fw.z, l: dx * rg.x + dz * rg.z, vf: x.c.vx * fw.x + x.c.vz * fw.z, vl: x.c.vx * rg.x + x.c.vz * rg.z }; });
    // 수평 충격량 (받침 동안 · 몸 전체 운동량 바뀜으로) — 앞 · 옆 속도 줄
    const vAt = (tt) => { const x = W.find((q) => q.t - t0 >= tt - 1e-9) ?? W[W.length - 1]; return { f: x.c.vx * fw.x + x.c.vz * fw.z, l: x.c.vx * rg.x + x.c.vz * rg.z }; };
    const yaw0 = W[0].chestYaw, yawE = W[W.length - 1].chestYaw;
    const pelYaw = (x) => Math.atan2(x.x.fwdz ?? 0, x.x.fwdx ?? 1);
    agg.drift.push({ tag, weapon: r.weapon, tG: W[gIdx].t - t0, dG: Math.hypot(cg.x - c0.x, cg.z - c0.z), v0, vAbs0: Math.hypot(c0.vx, c0.vz), d05: at(0.5), d1: at(1), d2: at(2), d3: at(3), d6: at(6.1), v1: vAt(1), v2: vAt(2), v3: vAt(3), v45: vAt(4.5), place, dyaw: Math.atan2(Math.sin(yawE - yaw0), Math.cos(yawE - yaw0)), heading0: pelYaw(W.find((x) => x.x.fwdx != null) ?? W[0]), headingE: pelYaw(W[W.length - 1]) });
  }
  // ── 판마다: 뛰는 걸음(runG)이 생긴 뒤만 셌을 때 (같은 기록 · 재는 창만 옮김 — 고침이 아님) ──
  {
    const gi = iG < 0 ? W.length : iG;
    const tdA = tdReal.filter((d) => d.i >= gi), fsAll = tdReal.length ? tdReal.filter((d) => d.air >= 0.05 - 1e-9).length / tdReal.length : null;
    const fsG = tdA.length ? tdA.filter((d) => d.air >= 0.05 - 1e-9).length / tdA.length : null;
    const shAll = [], shG = [], shPlan = [], ankDor = [], ankPl = [], kneeG = [];
    for (let i = 0; i < W.length; i++) for (const c of W[i].callsX ?? []) {
      const v = Math.max(c.sh.knee, c.sh.ankle); shAll.push(c.sh.knee, c.sh.ankle);
      if (i >= gi) { shG.push(c.sh.knee, c.sh.ankle); kneeG.push(c.sh.knee); if (c.raz > 0) ankPl.push(c.sh.ankle); else ankDor.push(c.sh.ankle); }
      if (W[i].x.plan && W[i].x.plan.k === c.k) shPlan.push(c.sh.knee, c.sh.ankle);
    }
    // 디딤 99 % 는 run_scenes 처럼 축마다 따로 (무릎 · 발목 각각 99 % 의 큰 쪽)
    const p99 = (rows) => rows;
    const kA = [], aA = [], kG = [], aG = [], kP = [], aP = [];
    for (let i = 0; i < W.length; i++) for (const c of W[i].callsX ?? []) { kA.push(c.sh.knee); aA.push(c.sh.ankle); if (i >= gi) { kG.push(c.sh.knee); aG.push(c.sh.ankle); } if (W[i].x.plan && W[i].x.plan.k === c.k) { kP.push(c.sh.knee); aP.push(c.sh.ankle); } }
    const phG = phases.filter((q) => q.T >= 0.05 && q.i0 >= gi).map((q) => (q.planJ != null ? q.J / q.planJ : q.Jp > 1 ? q.J / q.Jp : null)).filter((v) => v != null);
    const cG = W[Math.min(gi, W.length - 1)].c, cE = W[W.length - 1].c, c1 = (W.find((q) => q.t - t0 >= 1) ?? W[0]).c;
    agg.perRun = agg.perRun || [];
    agg.perRun.push({ tag, tG: (W[Math.min(gi, W.length - 1)].t - t0), fsAll, fsG, nTdEntry: tdReal.length - tdA.length, shAll99: Math.max(pct(kA, 0.99), pct(aA, 0.99)), shG99: Math.max(pct(kG, 0.99), pct(aG, 0.99)), knG99: pct(kG, 0.99), anG99: pct(aG, 0.99), shPlan99: Math.max(pct(kP, 0.99), pct(aP, 0.99)), knP99: pct(kP, 0.99), anP99: pct(aP, 0.99), ankDorShare: ankDor.length / Math.max(1, ankDor.length + ankPl.length), ankDor99: pct(ankDor, 0.99), ankPl99: pct(ankPl, 0.99),
      impAllMin: null, impGMin: phG.length ? Math.min(...phG) : null, impGMax: phG.length ? Math.max(...phG) : null, driftG: Math.hypot(cE.x - cG.x, cE.z - cG.z), dGf: (() => { const fx = W.find((x) => x.x.fwdx != null)?.x; return fx ? (cE.x - cG.x) * fx.fwdx + (cE.z - cG.z) * fx.fwdz : null; })(), dGl: (() => { const fx = W.find((x) => x.x.fwdx != null)?.x; return fx ? (cE.x - cG.x) * fx.rgtx + (cE.z - cG.z) * fx.rgtz : null; })(), vG: Math.hypot(cG.vx, cG.vz), drift1: Math.hypot(cE.x - c1.x, cE.z - c1.z) });
    // 받침 안 시킨 · 받은 (셋으로 나눔) — 뛰는 걸음 뒤 받침
    for (const q of phases.filter((q) => q.T >= 0.05 && q.i0 >= gi)) {
      const st = q.steps.map((i) => W[i]), n = st.length;
      const seg = (a, b) => { const z = st.slice(Math.floor(a * n), Math.floor(b * n)); return [z.reduce((s, x) => s + x.fy * DT, 0), z.reduce((s, x) => s + x.plan * DT, 0)]; };
      const [r1, c1_] = seg(0, 1 / 3), [r2, c2] = seg(1 / 3, 2 / 3), [r3, c3] = seg(2 / 3, 1);
      const noCmd = st.filter((x) => !(x.plan > 0)).length, noCmdJ = st.filter((x) => !(x.plan > 0)).reduce((s, x) => s + x.fy * DT, 0);
      // 뗌 뒤(걸음 장치가 뗀 뒤 땅 힘 남음)
      const pjs = st.map((x) => x.x.plan).filter(Boolean), pl0 = pjs[0];
      (agg.seg ||= []).push({ tag, ratio: q.planJ != null ? q.J / q.planJ : q.J / q.Jp, r1, r2, r3, c1: c1_, c2, c3, noCmd, noCmdJ, J: q.J, Jp: q.Jp, T: q.T, n, rPlan: pl0 ? q.J / pl0.J : null, Tc: pl0?.Tc, early: pl0 ? q.T < pl0.Tc - 0.02 : null, km: pjs.length ? Math.max(...pjs.map((z) => z.km)) : null });
    }
  }
  // ── 관절 끝 ──
  for (const e of r.endEv) {
    const i = S.indexOf(W[0]); const j = e.i - i; if (j < 0 || j >= W.length) continue;
    const x = W[j], kk = e.key.slice(-2, -1), pl = x.x.plan;
    const ln = x.x[kk];
    agg.ends.push({ tag, key: e.key, t: x.t - t0, z: e.z, s: pl && pl.k === kk ? pl.t / pl.Tc : null, lt: ln ? ln.t : null, lT: ln ? ln.T : null, mode: ln?.mode, n: W.length });
  }
  agg.lifts.push(...lifts.map((q) => ({ tag, ...q })));
}

// ─────────── 표 ───────────
P(`# ${name} · 판 ${runs.length}`);
// 1. 뜬 디딤
{
  const td = agg.td, short = td.filter((d) => d.air < 0.05 - 1e-9);
  P(`\n## 1 뜬 디딤 — 디딤 ${td.length} · 0.05 s 못 뜬 ${short.length} (${f2(short.length / td.length)})`);
  const cls = (d) => {
    if (d.air === 0) return d.otherOn ? (d.gsLate ? 'A0 다른 발 아직 디딤(걸음 장치도 디딤)' : 'A1 다른 발 걸음 장치는 뗐는데 땅 힘 남음') : 'A2 같은 스텝';
    if (d.sinceOff != null && d.sinceOff < 0.06) return 'B 같은 발 다시 닿음(튕김)';
    return 'C 짧게 뜸';
  };
  const by = {}; for (const d of short) (by[cls(d)] ||= []).push(d);
  for (const [k, a] of Object.entries(by)) P(`- ${k}: ${a.length} · 뜬 시간 평균 ${f2(mean(a.map((d) => d.air)))} · 몇째 디딤 ${a.map((d) => d.n).slice(0, 30).join(',')} · 판 ${[...new Set(a.map((d) => d.tag))].length}`);
  const first = short.filter((d) => d.n <= 1).length; P(`- 처음 두 디딤 안: ${first} / ${short.length}`);
  const byT = [0, 1, 2, 3, 4, 5, 6].map((s) => short.filter((d) => d.t >= s && d.t < s + 1).length); P(`- 1 s 칸마다 못 뜬 수(0-1 … 6-): ${byT.join(' · ')} · 모든 디딤 ${[0, 1, 2, 3, 4, 5, 6].map((s) => td.filter((d) => d.t >= s && d.t < s + 1).length).join(' · ')}`);
  // 그 앞 뗌
  const withL = short.filter((d) => d.oLift);
  P(`- 못 뜬 디딤 앞에 다른 발을 뗀 때: 계획보다 일찍(길이 조건) ${withL.filter((d) => d.oLift.early).length} · 계획 시간 다 채움 ${withL.filter((d) => d.oLift.early === false).length} · 뗄 때 위 속도 ÷ 계획 vto 평균 ${f2(mean(withL.filter((d) => d.oLift.vto > 0).map((d) => d.oLift.vy / d.oLift.vto)))} (잘 뜬 디딤 ${f2(mean(td.filter((d) => d.air >= 0.05 && d.oLift?.vto > 0).map((d) => d.oLift.vy / d.oLift.vto)))})`);
  P(`- 받침 끝(두 발 뜸 시작) 위 속도: 못 뜬 ${f2(mean(short.filter((d) => d.air > 0).map((d) => d.vyOff)))} · 잘 뜬 ${f2(mean(td.filter((d) => d.air >= 0.05).map((d) => d.vyOff)))} m/s · 계획 뜸 Tf 평균 ${f2(mean(agg.ph.map((p) => p.Tf).filter((v) => v != null)))} s (뜸 Tf 의 g Tf/2 = ${f2(mean(agg.ph.map((p) => p.Tf).filter((v) => v != null)) * G0 / 2)} m/s)`);
  const fl = td.map((d) => d.air); P(`- 뜬 시간 나눔(모든 디딤): 10 % ${f2(pct(fl, 0.1))} · 50 % ${f2(pct(fl, 0.5))} · 90 % ${f2(pct(fl, 0.9))} s · 0.04 ~ 0.05 에 든 몫 ${f2(fl.filter((v) => v >= 0.04 && v < 0.05).length / fl.length)}`);
  P('- 못 뜬 디딤 (판 · 째 · 발 · 뜬 · 다른 발 뗀 것이 일찍? · 뗄 때 vy/vto · 받침 끝 vy · 닿을 때 vy):');
  for (const d of short.slice(0, 40)) P(`  ${d.tag} n${d.n} ${d.k} air ${f2(d.air)} t ${f2(d.t, 2)} oEarly ${d.oLift?.early} vy/vto ${f2(d.oLift?.vto ? d.oLift.vy / d.oLift.vto : null, 2)} vyOff ${f2(d.vyOff, 2)} vyTD ${f2(d.vy, 2)} otherOn ${d.otherOn} gsLate ${d.gsLate} sinceOff ${f2(d.sinceOff, 3)}`);
}
// 2. 충격량
{
  const ph = agg.ph, bad = ph.filter((p) => p.ratio != null && (p.ratio < 0.9 || p.ratio > 1.1));
  P(`\n## 2 받은 ÷ 계획 충격량 — 받침 ${ph.length} · 0.9 ~ 1.1 밖 ${bad.length} (낮음 ${bad.filter((p) => p.ratio < 0.9).length} · 높음 ${bad.filter((p) => p.ratio > 1.1).length})`);
  const q = (a, fn) => f2(mean(a.map(fn).filter((v) => v != null && Number.isFinite(v))));
  for (const [lab, a] of [['밖(낮음)', bad.filter((p) => p.ratio < 0.9)], ['밖(높음)', bad.filter((p) => p.ratio > 1.1)], ['안', ph.filter((p) => p.ratio >= 0.9 && p.ratio <= 1.1)]]) {
    if (!a.length) continue;
    P(`- ${lab} ${a.length}: 비 ${q(a, (p) => p.ratio)} · 받침 시간 T ${q(a, (p) => p.T)} (계획 Tc ${q(a, (p) => p.Tc)}) · 시킨 Jc ÷ 계획 ${q(a, (p) => (p.Jc != null && p.planJ0 ? p.Jc / p.planJ0 : null))} · 받은 ÷ 시킨 ${q(a, (p) => (p.Jc ? p.J / p.Jc : null))} · 첫 계획까지 스텝 ${q(a, (p) => p.firstPlanAt)} · 깎인 스텝 ${q(a, (p) => p.cutN)} · 두 발 실린 스텝 ${q(a, (p) => p.both)} · 계획 둘 이상 ${a.filter((p) => p.nPlans > 1).length} · 처음 계획이 앞 받침 것(시작 ≠ 끝) ${a.filter((p) => p.planJ0 != null && p.planJlast != null && Math.abs(p.planJ0 - p.planJlast) > 1).length} · 계획 없이 시작(dbg.N 적분 셈) ${a.filter((p) => p.planJ0 == null).length} · 구간 몫 ${q(a, (p) => p.J1)} / ${q(a, (p) => p.J2)} / ${q(a, (p) => p.J3)} · 받침 끝 vy ${q(a, (p) => p.vyEnd)} (계획 vto ${q(a, (p) => p.vto)}) · km 평균 ${q(a, (p) => p.kmMean)}`);
  }
  P('- 낮은 받침 (판 · 때 · 비 · T/Tc · Jc/계획 · 받은/시킨 · 시작 vy · 끝 vy/vto · 깎임 · 두 발):');
  for (const p of bad.filter((p) => p.ratio < 0.9).slice(0, 30)) P(`  ${p.tag} t ${f2(p.t, 2)} r ${f2(p.ratio)} rLast ${f2(p.ratioLast)} T ${f2(p.T)}/${f2(p.Tc)} Jc/J0 ${f2(p.Jc / p.planJ0)} J/Jc ${f2(p.J / p.Jc)} vy ${f2(p.vyStart, 2)}→${f2(p.vyEnd, 2)}/${f2(p.vto, 2)} cut ${p.cutN} both ${p.both} nPl ${p.nPlans} fp ${p.firstPlanAt}`);
  P(`- 첫 받침(t < 0.7 s)이 낮은 수: ${bad.filter((p) => p.ratio < 0.9 && p.t < 0.7).length} / ${bad.filter((p) => p.ratio < 0.9).length}`);
  P(`- 모든 받침: 받은 ÷ 시킨 Jc ${q(ph, (p) => (p.Jc ? p.J / p.Jc : null))} · 시킨 ÷ 계획 ${q(ph, (p) => (p.Jc != null && p.planJ0 ? p.Jc / p.planJ0 : null))} · 받은 ÷ 마지막 계획 ${q(ph, (p) => p.ratioLast)}`);
}
// 3. 무릎 · 발목
{
  const K = agg.kneeHi, sv = K.map((c) => Math.max(c.knee, c.ankle));
  const p99k = pct(K.map((c) => c.knee), 0.99), p99a = pct(K.map((c) => c.ankle), 0.99);
  P(`\n## 3 디딘 무릎 · 발목 — 디딘 부름 ${K.length} · 묶은 99 %: 무릎 ${f2(p99k)} · 발목 ${f2(p99a)}`);
  const hi = K.filter((c) => c.knee > 0.75 || c.ankle > 0.75);
  P(`- 0.75 넘은 부름 ${hi.length} (${f2(hi.length / K.length, 4)}) — 무릎이 큰 쪽 ${hi.filter((c) => c.knee >= c.ankle).length} · 발목 ${hi.filter((c) => c.ankle > c.knee).length} · 두 발 실림(부름 둘) ${hi.filter((c) => c.nOn === 2).length} · 깎인 스텝 ${hi.filter((c) => c.cut).length}`);
  const sb = (c) => (c.s == null ? 'plan없음' : c.s < 0.15 ? '닿음 0-15 %' : c.s < 0.35 ? '15-35 %' : c.s < 0.65 ? '가운데 35-65 %' : c.s < 0.85 ? '65-85 %' : '뗌 85- %');
  const byS = {}; for (const c of hi) (byS[sb(c)] ||= []).push(c);
  for (const [k, a] of Object.entries(byS)) P(`  · 디딤 때 ${k}: ${a.length} · 무릎 ${f2(mean(a.map((c) => c.knee)))} 발목 ${f2(mean(a.map((c) => c.ankle)))} · 수직 힘 ${f2(mean(a.map((c) => c.Fy)))} 몸무게 · 무릎 굽힘 ${f2(mean(a.map((c) => (c.kAng * 180) / Math.PI)), 1)}° · 무릎→압력 중심 팔 ${f2(mean(a.map((c) => c.armK)))} m · 압력 중심(발목 앞) ${f2(mean(a.map((c) => c.ax)))} · 수직만 무릎 ${f2(mean(a.map((c) => c.kneeV)))} 발목 ${f2(mean(a.map((c) => c.ankleV)))} · 수평 더함 무릎 ${f2(mean(a.map((c) => c.kneeH)))} 발목 ${f2(mean(a.map((c) => c.ankleH)))} · 수평 힘 ${f2(mean(a.map((c) => c.Fh)))}`);
  // 수직 힘 최고 · 무릎 굽힘 · 팔 길이의 나눔 (디딘 한 발 부름)
  const one = K.filter((c) => c.nOn === 1 && c.Fy > 0.5);
  P(`- 한 발 디딤 · 수직 힘 > 0.5 몸무게 ${one.length}: 수직 힘 99 % ${f2(pct(one.map((c) => c.Fy), 0.99))} · 최고 ${f2(Math.max(...one.map((c) => c.Fy)))} 몸무게 · 무릎 굽힘 99 % ${f2((pct(one.map((c) => c.kAng), 0.99) * 180) / Math.PI, 1)}° · 무릎 팔 99 % ${f2(pct(one.map((c) => Math.abs(c.armK)), 0.99))} m`);
  // 설계 셈 다시: 수직 힘 1.95 몸무게를 같은 팔로
  const lim = { kneeExt: 312.5 }, Mg = mean(K.map(() => 0)) || 0;
  P(`- 99 % 몫을 낸 부름의 갈래 (무릎 몫 상위 1 %): `);
  const top = [...K].sort((a, b) => Math.max(b.knee, b.ankle) - Math.max(a.knee, a.ankle)).slice(0, Math.max(1, Math.round(K.length * 0.01)));
  P(`  수직 힘 ${f2(mean(top.map((c) => c.Fy)))} · 무릎 굽힘 ${f2(mean(top.map((c) => (c.kAng * 180) / Math.PI)), 1)}° · 무릎 팔 ${f2(mean(top.map((c) => c.armK)))} · 압력 중심 ${f2(mean(top.map((c) => c.ax)))} · 수직만 몫(무릎/발목) ${f2(mean(top.map((c) => c.kneeV)))}/${f2(mean(top.map((c) => c.ankleV)))} · 수평 더함 ${f2(mean(top.map((c) => c.kneeH)))}/${f2(mean(top.map((c) => c.ankleH)))} · 온 몫 ${f2(mean(top.map((c) => c.knee)))}/${f2(mean(top.map((c) => c.ankle)))} · 같은 수직 힘을 발목 밑에서 무릎 ${f2(mean(top.map((c) => c.kneeA)))} · 디딤 때 s ${f2(mean(top.map((c) => c.s).filter((v) => v != null)))} · plan 없음 ${top.filter((c) => c.s == null).length} · 두 발 ${top.filter((c) => c.nOn === 2).length} · 무릎이 큰 쪽 ${top.filter((c) => c.knee >= c.ankle).length}/${top.length} · 1 s 안 ${top.filter((c) => c.t < 1).length}`);
  const byT = [0, 1, 2, 3, 4, 5].map((s) => hi.filter((c) => c.t >= s && c.t < s + 1).length); P(`- 0.75 넘은 부름의 1 s 칸: ${byT.join(' · ')}`);
}
// 4. 흐름
{
  const D = agg.drift;
  P(`\n## 4 자리 흐름 — 판 ${D.length}`);
  P(`- 6 s 흐름 평균 ${f2(mean(D.map((d) => d.d6.d)))} m · 0.5 s ${f2(mean(D.map((d) => d.d05.d)))} · 1 s ${f2(mean(D.map((d) => d.d1.d)))} · 2 s ${f2(mean(D.map((d) => d.d2.d)))} · 3 s ${f2(mean(D.map((d) => d.d3.d)))}`);
  P(`- 6 s 앞(+) · 옆(오른쪽 +) 평균 ${f2(mean(D.map((d) => d.d6.f)))} / ${f2(mean(D.map((d) => d.d6.l)))} · 앞이 큰 판 ${D.filter((d) => Math.abs(d.d6.f) > Math.abs(d.d6.l)).length} · 뒤로 간 판 ${D.filter((d) => d.d6.f < 0).length}`);
  P(`- 뛰는 걸음이 생기기까지 ${f2(mean(D.map((d) => d.tG)))} s (가장 김 ${f2(Math.max(...D.map((d) => d.tG)))}) · 그동안 간 길 ${f2(mean(D.map((d) => d.dG)))} m`);
  P(`- 창 시작 무게중심 속도 ${f2(mean(D.map((d) => d.vAbs0)))} m/s (앞 ${f2(mean(D.map((d) => d.v0.f)))} · 옆 ${f2(mean(D.map((d) => d.v0.l)))}) · 1 s 뒤 앞 ${f2(mean(D.map((d) => d.v1.f)))} · 2 s ${f2(mean(D.map((d) => d.v2.f)))} · 3 s ${f2(mean(D.map((d) => d.v3.f)))} · 4.5 s ${f2(mean(D.map((d) => d.v45.f)))}`);
  for (const w of ['longsword', 'rapier', 'zweihander']) { const a = D.filter((d) => d.weapon === w); if (!a.length) continue; P(`  · ${w}: 6 s 앞 ${f2(mean(a.map((d) => d.d6.f)))} 옆 ${f2(mean(a.map((d) => d.d6.l)))} · 흐름 ${f2(mean(a.map((d) => d.d6.d)))} · 첫 1 s ${f2(mean(a.map((d) => d.d1.d)))}`); }
  const pl = D.flatMap((d) => d.place.map((p) => ({ ...p, tag: d.tag })));
  P(`- 디딤 자리(발목 − 무게중심, 닿을 때): 앞 평균 ${f2(mean(pl.map((p) => p.f)))} m · 옆(오른쪽 +) F ${f2(mean(pl.filter((p) => p.k === 'F').map((p) => p.l)))} · B ${f2(mean(pl.filter((p) => p.k === 'B').map((p) => p.l)))} · 닿을 때 앞 속도 평균 ${f2(mean(pl.map((p) => p.vf)))} · 뒤 3 s 앞 속도 ${f2(mean(pl.filter((p) => p.t > 3).map((p) => p.vf)))} 옆 ${f2(mean(pl.filter((p) => p.t > 3).map((p) => p.vl)))}`);
  P('- 판마다 (판 · 6 s 흐름 · 앞/옆 · 1 s/3 s 흐름 · 시작 속도 앞/옆 · 뛰는 걸음까지 s · 그 길 · 몸 돈 각°):');
  for (const d of D) P(`  ${d.tag} ${f2(d.d6.d)} f ${f2(d.d6.f, 2)} l ${f2(d.d6.l, 2)} · d1 ${f2(d.d1.d, 2)} d3 ${f2(d.d3.d, 2)} · v0 ${f2(d.v0.f, 2)}/${f2(d.v0.l, 2)} · v1 ${f2(d.v1.f, 2)} v3 ${f2(d.v3.f, 2)} · tG ${f2(d.tG, 2)} dG ${f2(d.dG, 2)} · yaw ${f2((d.dyaw * 180) / Math.PI, 0)}`);
}
// 5. 관절 끝
{
  const E = agg.ends; P(`\n## 5 관절 끝 — 사건 ${E.length}`);
  const by = {}; for (const e of E) (by[e.key.replace(/[FB]/, '')] ||= []).push(e);
  for (const [k, a] of Object.entries(by)) {
    const tags = {}; for (const e of a) tags[e.tag] = (tags[e.tag] || 0) + 1;
    const sb = (e) => (k.endsWith('S') ? (e.s == null ? 'plan없음(두 발 · 닿기 전)' : e.s < 0.2 ? '닿음' : e.s < 0.8 ? '가운데' : '뗌') : e.lT ? (e.lt / e.lT < 0.25 ? '뜸 앞' : e.lt / e.lT < 0.75 ? '뜸 가운데' : '닿기 전') : '-');
    const bs = {}; for (const e of a) bs[sb(e)] = (bs[sb(e)] || 0) + 1;
    P(`- ${k} (S 디딤 · W 뜸): ${a.length} 스텝 · 판 ${Object.keys(tags).length} · 판마다 ${Object.entries(tags).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([t, n]) => t + ':' + n).join(' ')} · 때 ${JSON.stringify(bs)} · 1 s 칸 ${[0, 1, 2, 3, 4, 5].map((s) => a.filter((e) => e.t >= s && e.t < s + 1).length).join('·')}`);
  }
}
// 6. 재는 창을 뛰는 걸음이 생긴 뒤로 옮기면 (같은 기록 — 고침이 아니라 줄이 무엇을 재는지 가림)
{
  const R = agg.perRun;
  P(`\n## 6 판마다 — 창 전체 대 뛰는 걸음(runG) 뒤만`);
  P(`- 뜬 디딤 몫: 창 전체 가장 나쁨 ${f2(Math.min(...R.map((r) => r.fsAll)))} (0.9 밑 ${R.filter((r) => r.fsAll < 0.9).length}) · runG 뒤 가장 나쁨 ${f2(Math.min(...R.map((r) => r.fsG)))} (0.9 밑 ${R.filter((r) => r.fsG < 0.9).length}) · 들어가는 동안 디딤 수 평균 ${f2(mean(R.map((r) => r.nTdEntry)), 2)}`);
  P(`- 무릎 · 발목 99 %: 창 전체 가장 큼 ${f2(Math.max(...R.map((r) => r.shAll99)))} · runG 뒤 ${f2(Math.max(...R.map((r) => r.shG99)))} (가운데 ${f2(pct(R.map((r) => r.shG99), 0.5))} · 무릎 ${f2(Math.max(...R.map((r) => r.knG99)))} 발목 ${f2(Math.max(...R.map((r) => r.anG99)))}) · 뛰는 디딤(plan) 스텝만 ${f2(Math.max(...R.map((r) => r.shPlan99)))} (무릎 ${f2(Math.max(...R.map((r) => r.knP99)))} 발목 ${f2(Math.max(...R.map((r) => r.anP99)))}) · 0.75 넘는 판 runG 뒤 ${R.filter((r) => r.shG99 > 0.75).length}`);
  P(`- 발목: runG 뒤 디딘 부름 가운데 발등 굽힘 쪽(한도 75) 몫 ${f2(mean(R.map((r) => r.ankDorShare)))} · 발등 쪽 99 % 가장 큼 ${f2(Math.max(...R.map((r) => r.ankDor99)))} · 발바닥 쪽 ${f2(Math.max(...R.map((r) => r.ankPl99)))}`);
  P(`- 충격량 비 runG 뒤: 가장 낮음 ${f2(Math.min(...R.map((r) => r.impGMin)))} · 가장 높음 ${f2(Math.max(...R.map((r) => r.impGMax)))} · 0.9 밑 판 ${R.filter((r) => r.impGMin < 0.9).length}`);
  P(`- 흐름: runG 뒤 ~ 끝 가장 큼 ${f2(Math.max(...R.map((r) => r.driftG)))} (가운데 ${f2(pct(R.map((r) => r.driftG), 0.5))} · 0.5 넘는 판 ${R.filter((r) => r.driftG > 0.5).length}) · 1 s ~ 끝 가장 큼 ${f2(Math.max(...R.map((r) => r.drift1)))} (0.5 넘는 판 ${R.filter((r) => r.drift1 > 0.5).length})`);
  for (const w of ['long', 'rapi', 'zwei']) { const a = R.filter((r) => r.tag.startsWith(w)); P(`  · ${w} runG 뒤 흐름 앞 ${f2(mean(a.map((r) => r.dGf)))} 옆(오른쪽 +) ${f2(mean(a.map((r) => r.dGl)))} · runG 생길 때 속도 ${f2(mean(a.map((r) => r.vG)))} m/s`); }
  for (const r of R) P(`  ${r.tag} tG ${f2(r.tG, 2)} fs ${f2(r.fsAll, 2)}→${f2(r.fsG, 2)} sh ${f2(r.shAll99, 2)}→${f2(r.shG99, 2)} (plan ${f2(r.shPlan99, 2)}) imp ${f2(r.impGMin, 3)} drift G ${f2(r.driftG, 2)} 1s ${f2(r.drift1, 2)}`);
  const sg = agg.seg ?? [];
  const lo = sg.filter((q) => q.ratio < 0.9), ok = sg.filter((q) => q.ratio >= 0.9);
  for (const [lab, a] of [['낮음', lo], ['안', ok]]) if (a.length) P(`- 받침 셋으로 (${lab} ${a.length}): 받은/시킨 앞 ${f2(mean(a.map((q) => q.r1 / q.c1)))} · 가운데 ${f2(mean(a.map((q) => q.r2 / q.c2)))} · 뒤 ${f2(mean(a.map((q) => q.r3 / q.c3)))} · 시킨 몫 ${f2(mean(a.map((q) => q.c1 / q.Jp)))}/${f2(mean(a.map((q) => q.c2 / q.Jp)))}/${f2(mean(a.map((q) => q.c3 / q.Jp)))} · 시킴 없는 스텝 ${f2(mean(a.map((q) => q.noCmd)), 1)} (그 받은 몫 ${f2(mean(a.map((q) => q.noCmdJ / q.J)))}) · T ${f2(mean(a.map((q) => q.T)))}`);
}
// 8. 받은 ÷ 디딜 때 세운 계획 J (설계의 뜻) — 관문 셈은 받침 첫 스텝에 계획이 아직 없어 늘 '시킨 수직 힘 적분'으로 나눔
{
  const sg = (agg.seg ?? []).filter((q) => q.rPlan != null);
  P(`\n## 8 받은 ÷ 계획 J (runG 뒤 받침 ${sg.length})`);
  P(`- 관문 셈(받은 ÷ 시킨 적분): 0.9 밑 ${sg.filter((q) => q.ratio < 0.9).length} · 받은 ÷ 계획 J: 평균 ${f2(mean(sg.map((q) => q.rPlan)))} · 0.9 밑 ${sg.filter((q) => q.rPlan < 0.9).length} · 1.1 위 ${sg.filter((q) => q.rPlan > 1.1).length} · 가장 낮음 ${f2(Math.min(...sg.map((q) => q.rPlan)))}`);
  P(`- 받침이 계획 Tc 보다 0.02 s 넘게 짧음(일찍 뗌) ${sg.filter((q) => q.early).length} — 그 받침 받은 ÷ 계획 평균 ${f2(mean(sg.filter((q) => q.early).map((q) => q.rPlan)))} · 아닌 받침 ${f2(mean(sg.filter((q) => !q.early).map((q) => q.rPlan)))} · 관문 셈 비 일찍 ${f2(mean(sg.filter((q) => q.early).map((q) => q.ratio)))} / 아님 ${f2(mean(sg.filter((q) => !q.early).map((q) => q.ratio)))}`);
  P(`- 시킨 적분 ÷ 계획 J 평균 ${f2(mean(sg.map((q) => q.Jp / (q.J / q.rPlan))))} · km 최고 평균 ${f2(mean(sg.map((q) => q.km)))}`);
}
// 7. 뛰는 디딤(plan) 스텝의 무릎 · 발목 몫 나눔 — 수직 힘만 · 수평 힘 더함 · 비틀기까지(= 온 값)
{
  const K = agg.kneeHi.filter((c) => c.s != null);
  const dor = K.filter((c) => c.raz <= 0), pl = K.filter((c) => c.raz > 0);
  const row = (lab, a, key) => P(`- ${lab} ${a.length}: 99 % 온 ${f2(pct(a.map((c) => c[key]), 0.99))} · 수직만 ${f2(pct(a.map((c) => c[key + 'V']), 0.99))} · 수평 더함 ${f2(pct(a.map((c) => c[key + 'H']), 0.99))} · 평균 온 ${f2(mean(a.map((c) => c[key])))} 수직만 ${f2(mean(a.map((c) => c[key + 'V'])))} 수평 더함 ${f2(mean(a.map((c) => c[key + 'H'])))} · 압력 중심(발목 앞) 평균 ${f2(mean(a.map((c) => c.ax)))} · 수평 힘 ${f2(mean(a.map((c) => c.Fh)))} 몸무게`);
  P(`\n## 7 뛰는 디딤 스텝 몫 나눔 (부름 ${K.length})`);
  row('발목 · 발등 굽힘 쪽', dor, 'ankle'); row('발목 · 발바닥 쪽', pl, 'ankle'); row('무릎', K, 'knee');
  const top = [...K].sort((a, b) => Math.max(b.knee, b.ankle) - Math.max(a.knee, a.ankle)).slice(0, Math.max(1, Math.round(K.length * 0.01)));
  P(`- 위 1 % (${top.length}): 발목이 큰 쪽 ${top.filter((c) => c.ankle > c.knee).length} (발등 쪽 ${top.filter((c) => c.ankle > c.knee && c.raz <= 0).length}) · 온 ${f2(mean(top.map((c) => Math.max(c.knee, c.ankle))))} · 그 축 수직만 ${f2(mean(top.map((c) => (c.ankle > c.knee ? c.ankleV : c.kneeV))))} · 수평 더함 ${f2(mean(top.map((c) => (c.ankle > c.knee ? c.ankleH : c.kneeH))))} · 수직 힘 ${f2(mean(top.map((c) => c.Fy)))} · 수평 힘 ${f2(mean(top.map((c) => c.Fh)))} · 무릎 굽힘 ${f2(mean(top.map((c) => (c.kAng * 180) / Math.PI)), 1)}° · 디딤 때 s ${f2(mean(top.map((c) => c.s)))} · 깎임 ${top.filter((c) => c.cut).length}`);
  { const z = K.filter((c) => c.s >= 0.3 && c.s < 0.7 && c.fwdx != null); const sag = z.map((c) => Math.abs(c.cFx * c.fwdx + c.cFz * c.fwdz) / c.MgR), lat = z.map((c) => Math.abs(-c.cFx * c.fwdz + c.cFz * c.fwdx) / c.MgR), sd = z.map((c) => Math.abs(c.side ?? 0) * c.Fy);
    P(`- 디딤 가운데(s 0.3 ~ 0.7) 수평 힘 나눔 (몸무게): 앞뒤 ${f2(mean(sag))} · 옆 ${f2(mean(lat))} · 그 가운데 옆 기울이기(abdUse · sideMu) 몫 ${f2(mean(sd))} · 옆 기울이기가 켜진 부름 몫 ${f2(z.filter((c) => Math.abs(c.side ?? 0) > 1e-4).length / Math.max(1, z.length))}`); }
  const sb = [0, 0.2, 0.4, 0.6, 0.8, 1.01]; P(`- 디딤 때(s)마다 발목 평균 · 무릎 평균 · 수직 힘: ${sb.slice(0, -1).map((a, i) => { const z = K.filter((c) => c.s >= a && c.s < sb[i + 1]); return `${a}-${sb[i + 1]}: ${f2(mean(z.map((c) => c.ankle)), 2)}/${f2(mean(z.map((c) => c.knee)), 2)}/${f2(mean(z.map((c) => c.Fy)), 2)}`; }).join(' · ')}`);
}
console.log(out.join('\n'));
