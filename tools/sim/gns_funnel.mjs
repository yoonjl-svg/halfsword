// ─────────────────────────────────────────────────────────────
//  gns_funnel.mjs — 고노센(J5) AI 깔때기 재기 (11/19 · 읽기만 — 난수 · 몸 · 판단에 손대지 않음 · 기록 docs/strike/gonosen_ai_2026-11-19.md)
//  prof_gap_measure.mjs --gns 가 높은 쪽 AI 에 이 흔적(gnsProbe)을 붙여 판 기록마다 `gns` 칸을 씀 → 이 도구가 요약:
//   node tools/sim/gns_funnel.mjs a.json [b.json …]   (판 기록 파일마다 한 벌 · 여러 파일은 --merge 로 합침)
//  깔때기: 정함(유도 · 준비 결심) → 준비 셈 시작 → 1 s → 납도 시작(iaiArmTime) → 준비됨(납도 끝) → 상대가 발도 선 안 → 발도 → 맞힘 · 막힘 · 빗나감
//  덧: 꼴(없음 · 준비 셈 · 납도 · 준비됨 · 뽑기 · 발도)마다 머문 시간 · 받은 · 준 상처 · 상대가 그 꼴에 연 공격 · 준비 셈 시작 거리 · 준비가 풀린 까닭 ·
//      선 안에 들 때 상대 꼴 · 다가오는 빠르기 · 발도 때 상대 공격의 나이(칼을 연 뒤 · 내려치기 시작 뒤 초) · 발도 거리
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { SECRET } from '../../src/config.js';
import { gnsEnterLine } from '../../src/secret.js';
import { isMain } from './is_main.mjs';

const r3 = (x) => (Number.isFinite(x) ? +x.toFixed(3) : null);

/** 높은 쪽 AI 고노센 흔적 (prof_gap_measure measureFight0 이 판 만든 뒤 한 번 · 스텝마다 poll · 상처마다 wound · 끝에 done) */
export function gnsProbe({ G, aiHi, aiLo, hiF, loF, dt }) {
  const A = aiHi.iaiArm;
  const line = gnsEnterLine(aiHi.M);
  const T = SECRET.iaiArmTime;
  const ph = {}; // 꼴마다 초
  const took = {}, dealt = {}, loAtk = {}, loAtkFree = {}, resetWhy = {}, armEnd = {}, fireFail = {};
  const arms = []; // 1 s 넘은 준비 셈 (시작 거리 · 유도 중 · 가장 멀리 간 셈 · 끝 까닭)
  const ready = []; // 준비됨 한 번마다
  const fires = [];
  const lures = [];
  const foeAtkArmed = []; // 준비됨 · 납도 동안 상대가 연 공격
  const voids = []; // 물러나 피함 (jpGnsVoid)
  let prevVoidN = 0;
  let nStart = 0, n1 = 0, nT = 0, nArmed = 0;
  let prevT = 0, prevArmed = false, arm = null, rdy = null, lure = null, prevLureN = aiHi.stats.plan?.jp?.lure ?? 0;
  let loSeq = aiLo.atkSeq, loAtkT0 = -1, loStrikeT0 = -1, loPrevPhase = null, loCur = null;
  let hiAtkEnd = -9, hiPrevMode = aiHi.mode, hurtT = -9, fire = null, prevPain = hiF.pain, wasModeArm = aiHi.mode;
  const tDist = () => {
    const a = hiF.bodies.chest.translation(), b = loF.bodies.chest.translation();
    return Math.hypot(b.x - a.x, b.z - a.z);
  };
  const closing = () => {
    const a = hiF.bodies.chest.translation(), b = loF.bodies.chest.translation();
    const d = Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z));
    const v = loF.bodies.chest.linvel();
    return -(v.x * (b.x - a.x) + v.z * (b.z - a.z)) / d;
  };
  const phase = () => {
    if (hiF.iai || hiF.iaiReq || (aiHi.secretRun && aiHi.secretRun.S?.name === 'goNoSen')) return 'fire';
    if (hiF.iaiDraw) return 'draw';
    if (!A) return 'none';
    if (A.armed) return 'armed';
    if (A.t >= T) return 'sheath';
    if (A.t > 0) return 'arming';
    return 'none';
  };
  const loState = () => (aiLo.mode === 'attack' ? `atk:${aiLo.phase}` : aiLo.mode);
  // 발도를 낸 순간 (secretGo — 그대로 부르고 결과만 적음)
  const sg = aiHi.secretGo;
  aiHi.secretGo = function (S, ctx = {}) {
    const ok = sg.call(this, S, ctx);
    if (S?.name !== 'goNoSen') return ok;
    if (!ok) {
      const why = this.me.stamina.exhausted ? 'exhausted' : this.staminaRest ? 'rest' : !this.me.stamina.secretReady ? 'poor' : 'other';
      fireFail[why] = (fireFail[why] ?? 0) + 1;
      return ok;
    }
    const th = ctx.th ?? {};
    fire = {
      t: r3(G.t), ev: th.ev ?? '?', charge: !!th.charge, dSeen: r3(ctx.d), d: r3(tDist()), line: r3(line), contact: r3(aiHi.M.contact), cl: r3(closing()),
      lo: loState(), loTech: aiLo.mode === 'attack' ? aiLo.tech?.name ?? '?' : '-',
      atkAge: aiLo.mode === 'attack' && loAtkT0 >= 0 ? r3(G.t - loAtkT0) : null, strikeAge: aiLo.mode === 'attack' && aiLo.phase === 'strike' && loStrikeT0 >= 0 ? r3(G.t - loStrikeT0) : null,
      armedFor: rdy ? r3(G.t - rdy.t0) : null, hit: null, blocked: null, took: 0,
    };
    fires.push(fire);
    if (rdy) rdy.fired = true;
    if (loCur) loCur.fired = true;
    return ok;
  };
  /** 준비(셈 · 준비됨)가 풀린 까닭: 아픔(상처 · 아픔 +0.05 — AI 의 '맞았나' 와 같은 수) · 그 스텝 꼴(공격 · 막기 · 비기 · 물러남) · 걸음 뜻 · 뽑기 */
  const cause = () => (G.t - hurtT < 0.05 ? 'hurt' : aiHi.mode !== 'watch' ? aiHi.mode : hiF.iaiDraw ? `draw` : Math.hypot(hiF.stickX || 0, hiF.stickY || 0) > 0 ? 'move' : 'other');
  // 미리 줄 닫기 (anticGo — 막기 2.0 · 자세 → 칼길 · 간격과 박자가 부름): 꼴마다 수 (칼집에 든 준비에서 부르면 막는 꼴 → 준비가 풀리고 뽑기)
  const ag = aiHi.anticGo;
  const antic = {};
  aiHi.anticGo = function (...a) {
    const p = phase();
    antic[p] = (antic[p] ?? 0) + 1;
    return ag.apply(this, a);
  };
  const poll = () => {
    if (hiF.pain > prevPain + 0.05) hurtT = G.t;
    prevPain = hiF.pain;
    const p = phase();
    ph[p] = (ph[p] ?? 0) + dt;
    const d = tDist();
    // 상대 공격 (공격 번호가 바뀔 때마다 하나)
    if (aiLo.atkSeq !== loSeq) {
      loSeq = aiLo.atkSeq;
      loAtkT0 = G.t;
      loStrikeT0 = -1;
      loAtk[p] = (loAtk[p] ?? 0) + 1;
      const free = aiHi.mode !== 'attack' && aiHi.mode !== 'secret' && G.t - hiAtkEnd > 1.0;
      if (free) loAtkFree[p] = (loAtkFree[p] ?? 0) + 1;
      if (loCur) loCur = null;
      if (p === 'armed' || p === 'sheath') {
        loCur = { ph: p, d0: r3(d), minD: d, inLine: d <= line, fired: false, hurt: 0, tech: aiLo.tech?.name ?? '?', why: aiLo.why ?? '-', gw: null, cl0: r3(closing()), maxCl: closing() };
        if (rdy) rdy.loAtk++;
        foeAtkArmed.push(loCur);
      }
    }
    if (aiLo.phase === 'strike' && loPrevPhase !== 'strike' && aiLo.mode === 'attack') loStrikeT0 = G.t;
    loPrevPhase = aiLo.mode === 'attack' ? aiLo.phase : null;
    if (loCur) {
      if (aiLo.mode !== 'attack') (loCur.maxCl = r3(loCur.maxCl)), (loCur = null);
      else {
        if (loCur.gw == null) loCur.gw = aiLo.gnsW?.plan?.kind ?? '-'; // 고노센 경계의 결행 · 속임 (gnsAct — 공격을 연 뒤 첫 스텝에 보임)
        if (loCur.wEnd == null && aiLo.phase !== 'windup') (loCur.wEnd = r3(d)), (loCur.wT = r3(G.t - loAtkT0)); // 들기(준비 자세) 끝 — 그때 거리 · 걸린 초
        loCur.maxCl = Math.max(loCur.maxCl, closing());
        loCur.minD = Math.min(loCur.minD, d);
        if (d <= line) loCur.inLine = true;
      }
    }
    if (hiPrevMode === 'attack' && aiHi.mode !== 'attack') hiAtkEnd = G.t;
    hiPrevMode = aiHi.mode;
    // 물러나 피함 (11/19 jpGnsVoid — 칼집에 든 준비에 칼이 옴): 그 뒤 1.2 s 안 발도 · 0.8 s 안 맞음
    const vn = aiHi.stats.plan?.jp?.void ?? 0;
    if (vn !== prevVoidN) {
      prevVoidN = vn;
      voids.push({ t: G.t, d: r3(d), cl: r3(closing()), lo: loState(), fired: false, took: 0 });
    }
    for (const v of voids) if (!v.done) {
      if (G.t - v.t > 1.2) v.done = true;
      else if (p === 'fire') v.fired = true;
    }
    // 유도 (jpBeat — 서서 lureT)
    const ln = aiHi.stats.plan?.jp?.lure ?? 0;
    if (ln !== prevLureN) {
      prevLureN = ln;
      lure = { t0: G.t, d: r3(d), cl: r3(closing()), foeReach: r3(aiHi.foeReach), armed: false, took: 0, loAtk: 0 };
      lures.push(lure);
    }
    if (lure) {
      if (p === 'armed') lure.armed = true;
      if (aiHi.planR?.mode !== 'stop' && !aiHi.jpGns?.prep) (lure.dur = r3(G.t - lure.t0)), (lure = null); // 옛 판 = 공통 멈춤 'stop' · 11/19 판 = 준비 결심 jpGns.prep
    }
    // 준비 셈
    if (A) {
      const t = A.t;
      if (t > 0 && prevT === 0 && !A.armed) {
        nStart++;
        arm = { t0: G.t, d0: r3(d), dSeen: r3(aiHi.d), foeReach: r3(aiHi.foeReach), lure: aiHi.planR?.mode === 'stop' || !!aiHi.jpGns?.prep, tMax: 0, cl: r3(closing()) };
      }
      if (arm) {
        if (t > arm.tMax) {
          if (arm.tMax < 1.0 && t >= 1.0) (n1++, arms.push(arm));
          if (arm.tMax < T && t >= T) nT++;
          arm.tMax = t;
        }
        if (A.armed) {
          arm.end = 'armed';
          arm = null;
        } else if (t === 0) {
          const why = cause();
          arm.end = why;
          arm.dEnd = r3(d);
          arm.tMax = r3(arm.tMax);
          if (arm.tMax >= 0.25) resetWhy[why] = (resetWhy[why] ?? 0) + 1;
          arm = null;
        }
      }
      if (A.armed && !prevArmed) {
        nArmed++;
        rdy = { t0: G.t, d0: r3(d), dSeen: r3(aiHi.d), line: r3(line), foeReach: r3(aiHi.foeReach), minD: d, inLine: null, fired: false, took: 0, keep: null, invite: null, waryT: 0, loAtk: 0 };
        ready.push(rdy);
      }
      if (rdy) {
        if (rdy.keep == null && aiHi.jpGns?.was) (rdy.keep = !!aiHi.jpGns.keep), (rdy.invite = !!aiHi.jpGns.invite);
        rdy.minD = Math.min(rdy.minD, d);
        if (aiLo.gnsW?.ready) rdy.waryT += dt;
        if (!rdy.inLine && d <= line) rdy.inLine = { at: r3(G.t - rdy.t0), cl: r3(closing()), lo: loState(), loTech: aiLo.mode === 'attack' ? aiLo.tech?.name ?? '?' : '-' };
        if (!A.armed) {
          const why = p === 'fire' || rdy.fired ? 'fire' : `${cause()}${hiF.iaiDraw ? `/${hiF.iaiDraw.why}` : ''}`;
          rdy.end = why;
          rdy.dur = r3(G.t - rdy.t0);
          rdy.minD = r3(rdy.minD);
          armEnd[why] = (armEnd[why] ?? 0) + 1;
          rdy = null;
        }
      }
      prevT = t;
      prevArmed = A.armed;
    }
    // 발도 결과 (발도 끝 — instantResult)
    if (fire && fire.hit == null && hiF.instantResult && !hiF.iai) {
      fire.hit = !!hiF.instantResult.hit;
      fire.blocked = !!hiF.instantResult.blocked;
      fire.part = hiF.instantResult.part ?? null;
    }
  };
  const wound = (att, vic, r) => {
    if (!(r?.severity > 0)) return;
    const p = phase();
    if (vic === hiF) {
      took[p] = (took[p] ?? 0) + 1;
      for (const v of voids) if (G.t - v.t <= 0.8) v.took++;
      hurtT = G.t;
      if (rdy) rdy.took++;
      if (lure) lure.took++;
      if (fire && fire.hit == null) fire.took++;
      if (loCur) loCur.hurt++;
    } else if (att === hiF) dealt[p] = (dealt[p] ?? 0) + 1;
  };
  const done = () => {
    aiHi.secretGo = sg;
    aiHi.anticGo = ag;
    if (rdy) (rdy.end = 'end'), (rdy.dur = r3(G.t - rdy.t0)), (rdy.minD = r3(rdy.minD));
    for (const x of ready) x.waryT = r3(x.waryT);
    for (const x of foeAtkArmed) if (typeof x.maxCl !== 'number' || !Number.isFinite(x.maxCl)) x.maxCl = null; else x.maxCl = r3(x.maxCl);
    for (const k of Object.keys(ph)) ph[k] = r3(ph[k]);
    for (const x of foeAtkArmed) x.minD = r3(x.minD);
    for (const v of voids) (v.t = r3(v.t)), delete v.done;
    return { voids, antic, gw: aiLo.gnsW ? { ...aiLo.gnsW.n } : null, line: r3(line), contact: r3(aiHi.M.contact), reach: r3(aiHi.M.reach), nStart, n1, nT, nArmed, ph, took, dealt, loAtk, loAtkFree, resetWhy, armEnd, fireFail, arms, ready, fires, lures, foeAtkArmed, jp: aiHi.stats.plan?.jp ?? null, sec: aiHi.stats.secrets?.goNoSen ?? null };
  };
  return { poll, wound, done };
}

// ── 요약 ──
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const q = (xs, p) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const qs = (xs) => (xs.length ? `p25 ${f2(q(xs, 0.25))} · p50 ${f2(q(xs, 0.5))} · p75 ${f2(q(xs, 0.75))} (${xs.length})` : '-');
const tally = (xs) => xs.reduce((o, k) => ((o[k] = (o[k] ?? 0) + 1), o), {});
const top = (o, n, N) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${(v / N).toFixed(2)}`).join(' · ');

/** 판 기록 (prof_gap_measure --gns) → 깔때기 요약 글 */
export function funnelTable(rows) {
  const R = rows.filter((r) => r.gns);
  const N = R.length;
  if (!N) return '(gns 칸 없음 — prof_gap_measure --gns 로 잰 판 기록이 아님)';
  const G = R.map((r) => r.gns);
  const sum = (f) => G.reduce((a, g) => a + (f(g) ?? 0), 0);
  const per = (f) => (sum(f) / N).toFixed(2);
  const add = (k) => G.reduce((o, g) => { for (const [a, v] of Object.entries(g[k] ?? {})) o[a] = (o[a] ?? 0) + v; return o; }, {});
  const ready = G.flatMap((g) => g.ready);
  const fires = G.flatMap((g) => g.fires);
  const lures = G.flatMap((g) => g.lures);
  const arms = G.flatMap((g) => g.arms);
  const fa = G.flatMap((g) => g.foeAtkArmed ?? []);
  const W = rows.filter((r) => r.result === 'hi').length, D = rows.filter((r) => r.result === 'draw').length;
  const jp = (k) => per((g) => g.jp?.[k]);
  const L = [];
  L.push(`${N} 판 · hi 몫 ${((100 * (W + D / 2)) / rows.length).toFixed(1)} % · 선 ${f2(mean(G.map((g) => g.line)))} m · 맞닿기 ${f2(mean(G.map((g) => g.contact)))} · 칼끝 ${f2(mean(G.map((g) => g.reach)))}`);
  L.push('', '| 깔때기 (판당) | 수 |', '|---|---|');
  L.push(`| 유도 (jpBeat lure — 서서 lureT) · 준비 결심 (decide) | ${per((g) => g.lures.length)} · ${jp('decide')} |`);
  L.push(`| 준비 셈 시작 (모든 · 0.25 s 넘음은 풀린 까닭 표) | ${per((g) => g.nStart)} |`);
  L.push(`| 셈 1 s 넘음 (유도 중 몫) | ${per((g) => g.n1)} (${f2(arms.filter((a) => a.lure).length / Math.max(1, arms.length))}) |`);
  L.push(`| 납도 시작 (셈 = iaiArmTime) | ${per((g) => g.nT)} |`);
  L.push(`| 준비됨 (납도 끝) | ${per((g) => g.nArmed)} |`);
  L.push(`| 준비됨 동안 상대가 발도 선 안 | ${(ready.filter((x) => x.inLine).length / N).toFixed(2)} |`);
  L.push(`| 발도 (고노센 냄) · 기력 등으로 못 냄 | ${(fires.length / N).toFixed(2)} · ${top(add('fireFail'), 4, N) || '0'} |`);
  L.push(`| 맞힘 · 막힘 · 빗나감 | ${(fires.filter((f) => f.hit).length / N).toFixed(2)} · ${(fires.filter((f) => f.blocked).length / N).toFixed(2)} · ${(fires.filter((f) => !f.hit && !f.blocked).length / N).toFixed(2)} |`);
  L.push('');
  const phT = add('ph');
  const tot = Object.values(phT).reduce((a, v) => a + v, 0);
  L.push(`꼴마다 초 (판당): ${Object.entries(phT).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(2)} (${((100 * v) / tot).toFixed(0)} %)`).join(' · ')}`);
  L.push(`받은 상처 (꼴마다 판당): ${top(add('took'), 8, N)} | 준 상처: ${top(add('dealt'), 8, N)}`);
  L.push(`상대가 연 공격 (그때 내 꼴): ${top(add('loAtk'), 8, N)} | 그 가운데 먼저 연 것(내 칼에 답하지 않음): ${top(add('loAtkFree'), 8, N)}`);
  L.push(`준비 셈이 풀린 까닭 (0.25 s 넘은 셈): ${top(add('resetWhy'), 8, N)}`);
  L.push(`준비됨이 끝난 까닭: ${top(add('armEnd'), 8, N)} | 미리 줄 닫기 (꼴마다 판당): ${top(add('antic'), 6, N) || '0'}`);
  L.push(`준비 셈 시작 거리 (1 s 넘은 셈 · 참 가슴 사이 m): ${qs(arms.map((a) => a.d0))} · 상대 칼끝 어림 ${f2(mean(arms.map((a) => a.foeReach)))} · 시작 때 상대 다가옴 ${qs(arms.map((a) => a.cl))}`);
  L.push(`준비됨 순간 거리: ${qs(ready.map((x) => x.d0))} · 준비됨 동안 가장 가까움: ${qs(ready.map((x) => x.minD))} · 준비됨 길이 s: ${qs(ready.filter((x) => x.dur != null).map((x) => x.dur))} · 지킴 keep ${f2(mean(ready.map((x) => (x.keep ? 1 : 0))))} · 꾐 invite ${f2(mean(ready.map((x) => (x.invite ? 1 : 0))))}`);
  const IL = ready.filter((x) => x.inLine).map((x) => x.inLine);
  L.push(`선 안에 든 순간: 준비된 뒤 ${qs(IL.map((x) => x.at))} s · 상대 다가옴 ${qs(IL.map((x) => x.cl))} m/s · 상대 꼴 ${top(tally(IL.map((x) => x.lo)), 5, Math.max(1, IL.length))} (몫)`);
  L.push(`준비됨 · 납도 동안 상대가 연 공격 ${(fa.length / N).toFixed(2)} 판당 — 선 안에 듦 ${f2(fa.filter((x) => x.inLine).length / Math.max(1, fa.length))} · 발도로 받음 ${f2(fa.filter((x) => x.fired).length / Math.max(1, fa.length))} · 나를 벰 ${f2(fa.filter((x) => x.hurt > 0).length / Math.max(1, fa.length))} · 연 거리 ${qs(fa.map((x) => x.d0))} · 가장 가까움 ${qs(fa.map((x) => x.minD))} · 가장 빠른 다가옴 ${qs(fa.filter((x) => x.maxCl != null).map((x) => x.maxCl))} · 경계 결행/속임 ${top(tally(fa.map((x) => x.gw ?? '-')), 3, Math.max(1, fa.length))} · 들기 끝 거리 ${qs(fa.filter((x) => x.wEnd != null).map((x) => x.wEnd))} · 들기 초 ${qs(fa.filter((x) => x.wT != null).map((x) => x.wT))}`);
  L.push(`상대가 준비를 봄(경계 W.ready) 몫 (준비됨 시간 가운데): ${f2(sum((g) => g.ready.reduce((a, x) => a + (x.waryT ?? 0), 0)) / Math.max(1e-9, ready.reduce((a, x) => a + (x.dur ?? 0), 0)))} · 상대 경계 셈 (판당): ${top(G.reduce((o, g) => { for (const [k, v] of Object.entries(g.gw ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}), 3, N)}`);
  L.push(`발도: 사건 ${top(tally(fires.map((f) => f.ev + (f.charge ? '/charge' : ''))), 5, Math.max(1, fires.length))} (몫) · 거리 ${qs(fires.map((f) => f.d))} · 상대 꼴 ${top(tally(fires.map((f) => f.lo)), 5, Math.max(1, fires.length))} · 상대 칼을 연 뒤 ${qs(fires.filter((f) => f.atkAge != null).map((f) => f.atkAge))} s · 내려치기 시작 뒤 ${qs(fires.filter((f) => f.strikeAge != null).map((f) => f.strikeAge))} s · 다가옴 ${qs(fires.map((f) => f.cl))} · 발도 동안 맞음 ${(fires.filter((f) => f.took > 0).length / Math.max(1, fires.length)).toFixed(2)}`);
  const V = G.flatMap((g) => g.voids ?? []);
  if (V.length) L.push(`물러나 피함 (칼집에 든 준비 · 판당 ${(V.length / N).toFixed(2)}): 1.2 s 안 발도 ${f2(V.filter((v) => v.fired).length / V.length)} · 0.8 s 안 맞음 ${f2(V.filter((v) => v.took > 0).length / V.length)} · 거리 ${qs(V.map((v) => v.d))} · 다가옴 ${qs(V.map((v) => v.cl))} · 상대 꼴 ${top(tally(V.map((v) => v.lo)), 4, V.length)}`);
  L.push(`유도: 판당 ${(lures.length / N).toFixed(2)} · 그동안 준비됨 ${f2(mean(lures.map((x) => (x.armed ? 1 : 0))))} · 그동안 맞음 ${f2(mean(lures.map((x) => x.took)))} · 거리 ${qs(lures.map((x) => x.d))} · 상대 다가옴 ${qs(lures.map((x) => x.cl))}`);
  const jpk = [...new Set(G.flatMap((g) => Object.keys(g.jp ?? {})))];
  if (jpk.length) L.push(`jp 셈 (판당): ${jpk.map((k) => `${k} ${jp(k)}`).join(' · ')}`);
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (process.argv.includes('--merge')) console.log(funnelTable(files.flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  else for (const p of files) console.log(`\n## ${p}\n${funnelTable(JSON.parse(readFileSync(p, 'utf8')))}`);
}
