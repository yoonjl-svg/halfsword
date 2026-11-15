// ─────────────────────────────────────────────────────────────
//  it_tone_measure.mjs — 찌르기를 막을 수 있나 · 이탈리아가 왜 이기나 (11/15 사장님 '이탈리아 누를 안 가져와' → '찌르기의 맛은 살려야 해. 혹은 찌르기를 더 잘 방어할 방법?
//   지금 찌르기 막기 거의 불가능하지 않아?' · 기록 docs/strike/it_tone_2026-11-15.md) — 재기만 (판은 스위치로만 바꿈 — config AI_TELL · THRUST.driveAi)
//  들어오는 공격 하나마다(치는 쪽 AI startAttack · 리솔루토 런지 · 사람 봇 탭 · 비껴서며 찌르기): 갈래(찌르기 · 비껴서며 찌르기 · 리솔루토 · 베기) ·
//   끝(맞음 상처 · 닿음만 · 칼로 막음 parried(막는 꼴에서 칼끼리 닿음) · 칼에 걸림 blocked(막는 꼴 아님) · 피함(물러나 피하기 · 물러남 — 안 닿음) · 헛침(그 밖 안 닿음)) ·
//   때(실제 초): 결정 → 칼이 나감(팔 뻗기 시작 — AI startStrike · 사람 탭) → 칼끝 3.5 m/s → 앞발 걸음 부탁 → 처음 닿음 · 받는 쪽이 '오는 칼'로 본 때.
//  이탈리아가 준 칼날 상처마다: 어디서(리솔루토 · 비껴서며 찌르기 · 빼서 찌르기 · 보통 찌르기 · 베기) · 맞박자 × 1.3 · 칼 우위 동안 · 받는 쪽 까닭(못 봄 · 봤지만 막지 않음 · 막기 · 피하기 골랐는데 맞음 · 치는 중).
//  node tools/sim/it_tone_measure.mjs ring [--pairs=german:italian,…] [--vars=0,tell,…] [--seeds=1-3] --out=x.jsonl
//  node tools/sim/it_tone_measure.mjs bot [--cells=def:german:longsword:rapier,atk:italian:rapier:longsword] [--vars=0,…] [--seeds=1-12] --out=x.jsonl
//  node tools/sim/it_tone_measure.mjs agg x.jsonl …
//  판(vars — '+' 로 여럿): 0 = 지금 · tell = AI 찌르기 낌새 눈(AI_TELL.ai) · guard = 사람 막기 단추 낌새(AI_TELL.guard) · drive = AI 찌르기 몸 싣기(THRUST.driveAi 3)
//   11/16 리솔루토 세 안 (기록 §8): stop · counter = 1안 칼 우위 길 · touch2 = 2안 칼끝 얽힘 0.2 s · wait = 3안 AI 박자 싸움 0.2 s · aware = 3안 다른 유파 리솔루토 위험 읽기
//   이탈리아 몸 재기 it: 칼 우위가 켜진 길(새로 · 켜진 채 다시) · 켜진 시간 · 맞박자 맞음 · 창 길별 열림 · 흘려보냄 · 낸 길 · 박자 싸움 까닭 / risoHold = 받는 쪽이 발을 묶은 스텝
//  node tools/sim/it_tone_measure.mjs riso x.jsonl … — 리솔루토 · 칼 우위 표 (§8)
// ─────────────────────────────────────────────────────────────
import { appendFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { itThrustKind, itEdgeOn } from '../../src/italian_outbox.js';
import { WEAPONS, PAIRS } from './ai_ring_measure.mjs';

const K = CONFIG.TIME.k;
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
const VAR = { guardP: '' }; // 재기 봇 손 (판 값 아님)
const WIN_T = CONFIG.realS(1.5); // 공격 하나의 창 (다음 공격이 먼저 시작하면 거기까지)

//  진단용 (있던 스위치 — 새 값 없음): noriso = AI 이탈리아 리솔루토 닫음(SECRET.aiOpenSchools) · inq0 = AI 비껴서며 찌르기 기울기 끔(AI_PLAN.it.inq 0) · inq3 = 기울기 0.3 · inqold = 옛 칼(UNIQUE_ASSIST.inqAi 0)
export function withVar(v, fn) {
  const keep = { ai: CONFIG.AI_TELL.ai, guard: CONFIG.AI_TELL.guard, latch: CONFIG.AI_TELL.latch, drive: CONFIG.THRUST.driveAi, hdrive: CONFIG.THRUST.drive, kphys: CONFIG.STRIKE.hitKPhys, inqMul: CONFIG.IT_OUTBOX.inqMul, open: CONFIG.SECRET.aiOpenSchools, it: CONFIG.AI_PLAN.it, inqAi: CONFIG.UNIQUE_ASSIST.inqAi, from: CONFIG.IT_OUTBOX.edgeFrom, tmin: CONFIG.SECRET.risolutoTouchMin, wait: CONFIG.SECRET.risoAiWait, aware: CONFIG.AI_PLAN.read.riso };
  const p = String(v).split('+');
  CONFIG.AI_TELL.ai = p.includes('tell') ? 1 : 0;
  CONFIG.AI_TELL.guard = p.includes('guard') ? 1 : 0;
  CONFIG.THRUST.driveAi = p.includes('drive') ? 3 : 0;
  CONFIG.AI_TELL.latch = p.includes('latch') ? CONFIG.realS(0.6) : 0; // 막기 단추 낌새 붙잡기 0.6 s (시간 사다리)
  VAR.guardP = p.includes('gp1') ? '1' : ''; // 재기 봇만 (판 값 아님)
  CONFIG.THRUST.drive = p.includes('hdrive') ? 3 : keep.hdrive; // 사람 탭 찌르기 몸 싣기 (THRUST.drive 3)
  CONFIG.STRIKE.hitKPhys = p.includes('kphys') ? 1 : keep.kphys; // 배율은 상처에만
  CONFIG.IT_OUTBOX.inqMul = p.includes('inq8') ? 0.8 : p.includes('inq5') ? 0.5 : keep.inqMul; // 비껴서며 찌르기 배율 (사람 · AI)
  if (p.includes('noriso')) CONFIG.SECRET.aiOpenSchools = keep.open.filter((x) => x !== 'italian');
  if (p.includes('inq0')) CONFIG.AI_PLAN.it = { ...keep.it, inq: 0 };
  if (p.includes('inq3')) CONFIG.AI_PLAN.it = { ...keep.it, inq: 0.3 }; // 기울기 반 (0.3 — 있던 수)
  if (p.includes('inqold')) CONFIG.UNIQUE_ASSIST.inqAi = 0;
  // 11/16 리솔루토 세 안 (§8): stop · counter = 1안 칼 우위 길(IT_OUTBOX.edgeFrom) · touch2 = 2안 칼끝 얽힘 0.2 s(SECRET.risolutoTouchMin) · wait = 3안 AI 박자 싸움 0.2 s(SECRET.risoAiWait) · aware = 3안 다른 유파 읽기(AI_PLAN.read.riso 1)
  CONFIG.IT_OUTBOX.edgeFrom = p.includes('stop') ? 'stop' : p.includes('counter') ? 'counter' : keep.from;
  CONFIG.SECRET.risolutoTouchMin = p.includes('touch2') ? CONFIG.realS(0.2) : keep.tmin;
  CONFIG.SECRET.risoAiWait = p.includes('wait') ? CONFIG.realS(0.2) : keep.wait;
  CONFIG.AI_PLAN.read.riso = p.includes('aware') ? 1 : keep.aware;
  try { return fn(); } finally {
    CONFIG.IT_OUTBOX.edgeFrom = keep.from; CONFIG.SECRET.risolutoTouchMin = keep.tmin; CONFIG.SECRET.risoAiWait = keep.wait; CONFIG.AI_PLAN.read.riso = keep.aware; Object.assign(CONFIG.AI_TELL, { ai: keep.ai, guard: keep.guard, latch: keep.latch }); CONFIG.THRUST.driveAi = keep.drive; CONFIG.THRUST.drive = keep.hdrive; CONFIG.STRIKE.hitKPhys = keep.kphys; CONFIG.IT_OUTBOX.inqMul = keep.inqMul; CONFIG.SECRET.aiOpenSchools = keep.open; CONFIG.AI_PLAN.it = keep.it; CONFIG.UNIQUE_ASSIST.inqAi = keep.inqAi; }
}

/**
 * 한 판의 재기 그릇: 몸 둘(X · Y)마다 치는 쪽 공격 기록 · 받는 쪽 꼴 · 닿음 · 상처.
 *  side = { f 몸, ai (있으면), guard (사람 막기 단추 — 있으면), school }
 */
function tracker(G, sides) {
  const atks = [];
  const wounds = [];
  const cur = new Map(); // 몸 → 지금 공격 기록
  const other = (S) => sides.find((x) => x !== S);
  const begin = (S, o) => {
    const prev = cur.get(S);
    if (prev) prev.tEnd ??= G.t;
    const D = other(S);
    const rec = { by: S.school, byW: S.f.weapon?.id, kind: o.kind, tech: o.tech ?? null, why: o.why ?? null, t0: G.t, ts: o.ts ?? null, tTip: null, tFoot: null, tTouch: null, tClash: null, tSeen: null, sev: 0, touch: 0, clash: 0, def: null, defMode: null, edge: false };
    rec.react = D.ai ? D.ai.level.reaction / K : null;
    atks.push(rec);
    cur.set(S, rec);
    return rec;
  };
  const live = (S) => { const r = cur.get(S); return r && r.tEnd == null && G.t - r.t0 <= WIN_T ? r : null; };
  for (const S of sides) {
    const D = () => other(S);
    if (S.ai) {
      const ai = S.ai;
      const sa = ai.startAttack;
      ai.startAttack = function (t, why, o = {}) {
        const n0 = this.atkSeq;
        const r = sa.call(this, t, why, o);
        if (r && this.atkSeq !== n0) begin(S, { kind: this.tech?.name === 'inquartata' ? 'I9' : this.tech?.kind === 'thrust' ? 'thrust' : 'cut', tech: this.tech?.name, why });
        return r;
      };
      const ss = ai.startStrike;
      ai.startStrike = function (...a) { const r = live(S); if (r && r.ts == null) r.ts = G.t; return ss.apply(this, a); };
      // 받는 쪽 눈: 이 AI 가 상대 공격을 '오는 칼'로 본 때
      const th0 = ai.threat;
      ai.threat = function (...a) { const h = th0.apply(this, a); const r = live(D()); if (h && r && r.tSeen == null) r.tSeen = G.t; return h; };
    }
    const g = S.f.gait;
    if (g?.requestStep) {
      const rq = g.requestStep.bind(g);
      g.requestStep = (o = {}) => { const ok = rq(o); const r = live(S); if (ok && r && r.ts != null && r.tFoot == null && (o.fwd ?? 0) > 0) r.tFoot = G.t; return ok; };
    }
    S.prev = { tap: false, iai: null, sec: false, riso: false, gid: S.guard?.threatId ?? 0, eo: null };
    // 리솔루토 재기 (§8 — 이탈리아 몸만): 칼 우위가 켜진 길(새로 켜짐 fresh · 켜진 채 다시 refresh) · 켜진 시간 · 창 길별 열림 · 흘려보냄 · 낸 길
    if (S.school === 'italian') {
      S.it = { fresh: {}, refresh: {}, edgeT: 0, opened: {}, lapsed: {}, path: null };
      const R = (S.R = S.ai?.riso); // 다 쓰면 ai.riso 가 비므로 처음 것을 쥠
      if (R) {
        const rt = S.ai.risoTick;
        S.ai.risoTick = function (...a) {
          const w0 = R.st.wins, f0 = R.st.fired, on0 = R.win > 0, p0 = R.ctx?.path;
          const out = rt.apply(this, a);
          if (R.st.wins > w0) S.it.opened[R.ctx?.path] = (S.it.opened[R.ctx?.path] ?? 0) + 1;
          if (R.st.fired > f0) S.it.path = R.ctx?.path ?? null;
          else if (on0 && !(R.win > 0) && R.st.wins === w0) S.it.lapsed[p0] = (S.it.lapsed[p0] ?? 0) + 1;
          return out;
        };
      }
      const W = S.W;
      if (W?.riso) {
        const ow = W.openWindow;
        W.openWindow = function (ctx, ...a) { const ok = ow.call(this, ctx, ...a); if (ok && ctx?.ev === 'risoluto') S.it.opened[ctx.path] = (S.it.opened[ctx.path] ?? 0) + 1; return ok; };
        const fi = W.fire;
        W.fire = function (...a) { const p = this.open?.ctx?.ev === 'risoluto' ? this.open.ctx.path : null; const o = fi.apply(this, a); if (o && p) S.it.path = p; return o; };
      }
    }
  }
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const S = sides.find((x) => x.f === att);
    if (!S || vic !== other(S).f) return;
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    const rec = live(S) ?? cur.get(S);
    if (rec && G.t - rec.t0 <= WIN_T * 1.5) {
      gDiag(rec, other(S));
      rec.touch++;
      rec.tTouch ??= G.t;
      rec.sev += sv;
    }
    if (!(sv > 0)) return;
    const D = other(S);
    const k = S.school === 'italian' ? (S.ai?.secretRun?.stage === 'riso' || att.skill?.sec ? 'riso' : itThrustKind(att) === 'special' ? 'I9' : itThrustKind(att) === 'cav' ? 'cav' : itThrustKind(att) ? 'thrust' : 'cut') : rec?.kind ?? 'other';
    wounds.push({ by: S.school, sv, src: k, stop: !!r.itThrust?.stop, edge: !!(att.itEdge && itEdgeOn(att) && att.itEdge.t0 < (att.fightT ?? 0) - 1e-6), seen: rec?.tSeen != null, def: rec?.def ?? null, defMode: dState(D), kind: rec?.kind ?? null });
  };
  const pc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, info, ...rest) => {
    pc?.(point, sp, info, ...rest);
    for (const S of sides) {
      const r = live(S);
      if (!r || !info || !((info.a === S.f && info.b === other(S).f) || (info.b === S.f && info.a === other(S).f))) continue;
      if (r.ts == null && r.kind !== 'riso') continue;
      gDiag(r, other(S));
      r.clash++;
      if (r.tClash == null) (r.tClash = G.t), (r.defMode = dState(other(S)));
    }
  };
  /** 사람 막기 단추 진단 (처음 닿은 때): 누름 · 줄 · 막는 자리까지 손 거리(패드 m) · 막기에 든 뒤 지난 때 */
  function gDiag(r, D) {
    const g = D.guard;
    if (!g || r.gd) return;
    const p = g.line ? g.padOf(g.line) : null;
    const o = D.f.handOffset;
    r.gd = { held: !!g.held, active: !!g.active, mode: g.mode, line: g.line, pd: p ? +Math.hypot(p[0] - o.x, p[1] - o.y).toFixed(3) : null, sinceDef: r.gDef != null ? +((G.t - r.gDef) / K).toFixed(3) : null, heldAgo: D.lastHeld != null ? +((G.t - D.lastHeld) / K).toFixed(3) : null, broken: !!g.broken, tap: !!D.f.skill?.tap, swing: !!D.f.skill?.swinging };
  }
  function dState(D) {
    if (D.ai) { const a = D.ai; return a.mode === 'defend' ? (a.defVoid ? 'void' : 'parry') : a.mode === 'attack' ? (a.phase === 'strike' || a.phase === 'follow' ? 'striking' : 'attack') : a.mode; }
    if (D.guard) return D.guard.active && D.guard.mode === 'defend' ? 'parry' : D.guard.active ? 'held' : D.f.skill?.tap || D.f.skill?.swinging ? 'striking' : 'free';
    return 'other';
  }
  return {
    step() {
      for (const S of sides) {
        const f = S.f;
        // 사람 봇 공격(탭 찌르기 · 비껴서며 찌르기 · 리솔루토) · AI 리솔루토(비기 — startAttack 을 거치지 않음)
        const tap = !!f.skill?.tap;
        const iai = f.iai?.tech ?? null;
        const sec = !!f.skill?.sec;
        const riso = S.ai?.secretRun?.stage === 'riso';
        if (!S.ai) {
          if (iai && iai !== S.prev.iai) begin(S, { kind: iai === 'inquartata' ? 'I9' : 'thrust', tech: iai, ts: G.t });
          else if (tap && !S.prev.tap && !iai) begin(S, { kind: 'thrust', tech: 'tap', ts: G.t });
          else if (sec && !S.prev.sec) begin(S, { kind: 'riso', tech: 'secret', ts: G.t, why: S.it?.path ?? null });
        } else if (riso && !S.prev.riso) begin(S, { kind: 'riso', tech: 'risoluto', ts: G.t, why: S.it?.path ?? null });
        S.prev.tap = tap; S.prev.iai = iai; S.prev.sec = sec; S.prev.riso = riso;
        if (S.it) {
          const e = f.itEdge;
          if (e && e !== S.prev.eo) {
            const was = S.prev.eo && e.t0 < S.prev.eo.until - 1e-9;
            const B = was ? S.it.refresh : S.it.fresh;
            B[e.why] = (B[e.why] ?? 0) + 1;
            S.prev.eo = e;
          }
          if (itEdgeOn(f)) S.it.edgeT += G.t - (S.it.lt ?? G.t);
          S.it.lt = G.t;
        }
        const r = live(S);
        if (r && r.ts != null && r.tTip == null && f.tipVel && f.tipVel.length() > 3.5) r.tTip = G.t;
        // 받는 쪽 꼴 (이 공격 창 안 처음 막기 · 피하기 · 물러남 · 맞받아 침)
        const D = other(S);
        if (r) {
          const st = dState(D);
          if (r.def == null && (st === 'parry' || st === 'void' || st === 'withdraw')) r.def = st;
          if (D.guard && D.guard.threatId !== D.prev.gid && r.tSeen == null) r.tSeen = G.t;
          if (D.guard && D.guard.mode === 'defend' && r.gDef == null) r.gDef = G.t;
          if (itEdgeOn(f)) r.edge = true;
        }
        if (D.guard) D.prev.gid = D.guard.threatId;
        if (D.guard?.held) D.lastHeld = G.t;
      }
    },
    /** 이탈리아 몸 리솔루토 · 칼 우위 재기 (§8) */
    itInfo() {
      const S = sides.find((x) => x.it);
      if (!S) return null;
      const o = S.f.itOut ?? {};
      const R = S.R;
      const W = R?.W ?? S.W?.riso;
      return { fresh: S.it.fresh, refresh: S.it.refresh, edgeT: +(S.it.edgeT / K).toFixed(2), stopHits: o.stopHits ?? 0, thrustHits: o.thrustHits ?? 0, opened: S.it.opened, lapsed: S.it.lapsed, tries: W ? { ...W.opens } : null, gapBlocked: R ? R.st.gapBlocked : W?.gapBlocked ?? 0, cue: R?.st.cue ?? null, side: S.ai ? 'ai' : 'bot', runs: W ? runHist(W.runs) : null };
    },
    /** 받는 쪽 리솔루토 위험 읽기 (§8 — 발을 묶은 스텝 수) */
    risoHold() { return sides.reduce((a, S) => a + (S.ai?.read?.st.risoHold ?? 0), 0); },
    finish() {
      for (const S of sides) { const r = cur.get(S); if (r) r.tEnd ??= G.t; }
      for (const a of atks) {
        a.out = a.sev > 0 ? 'landed' : a.clash > 0 ? (a.defMode === 'parry' ? 'parried' : 'blocked') : a.touch > 0 ? 'touch' : a.def === 'void' || a.def === 'withdraw' ? 'evaded' : 'whiffed';
        for (const k of ['ts', 'tTip', 'tFoot', 'tTouch', 'tClash', 'tSeen', 'tEnd']) if (a[k] != null) a[k] = +((a[k] - a.t0) / K).toFixed(4);
        a.t0 = +(a.t0 / K).toFixed(3);
      }
      return { atks, wounds };
    },
  };
}

/** 끝난 덮인 채 나아가기 길이 (실제 초) — 0.2 s 밑 · 0.2 ~ 0.6 · 0.6 이상 */
function runHist(runs) {
  const h = [0, 0, 0];
  for (const x of runs ?? []) h[x / K < 0.2 - 1e-9 ? 0 : x / K < 0.6 - 1e-9 ? 1 : 2]++;
  return h;
}

/** 고리 한 판 (ai_ring_measure.mjs ringFight 와 같은 판) + 재기 */
export function ringFightT({ a, b, wa, wb, seed, swap, dur = 30 }) {
  const G = newRound({ seed, walls: true, weapon: swap ? wb : wa, weapon2: swap ? wa : wb, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const SA = { f: swap ? G.enemy : G.player, ai: swap ? G.ai : G.ai2, school: a };
  const SB = { f: swap ? G.player : G.enemy, ai: swap ? G.ai2 : G.ai, school: b };
  const T = tracker(G, [SA, SB]);
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(SA.f) && !out(SB.f)) { G.step(); T.step(); }
  const res = { win: out(SB.f) && !out(SA.f), lose: out(SA.f) && !out(SB.f), T: +(G.t / K).toFixed(2), tellA: SA.ai.stats.tell ?? 0, tellB: SB.ai.stats.tell ?? 0, it: T.itInfo(), risoHold: T.risoHold(), ...T.finish() };
  G.world.free();
  return res;
}

/** 사람 손가락 봇 한 판 (school_balance.mjs fightOne · 상대 AI 숙련 5) + 재기 — 봇 = P · AI = A */
export function botFightT(fightOne, { school, weapon, opp, seed, foeSchool }) {
  process.env.SB_FOE_PROF = '5';
  process.env.SB_IT_BOT = school === 'italian' ? 'outbox' : '';
  process.env.SB_GUARD_P = VAR.guardP; // 'gp1' 판: 쳐 오면 늘 막기 단추 (막는 사람 — 기본 0.6)
  let T = null;
  let ctx = null;
  const r = fightOne({
    school, weapon, opp, seed,
    onRound: ({ G, P, A, guard, W }) => {
      const SP = { f: P, guard, school, W };
      const SA = { f: A, ai: G.ai, school: foeSchool };
      T = tracker(G, [SP, SA]);
      ctx = { G, P, A, guard, SA };
      const st = G.step.bind(G);
      G.step = (...x) => { const o = st(...x); T.step(); return o; };
    },
  });
  const res = { win: r.win ?? null, lose: r.lose ?? null, T: r.T ?? null, tellAi: ctx?.SA.ai.stats.tell ?? 0, tellGuard: ctx?.guard.stats.tell ?? 0, it: T.itInfo(), risoHold: T.risoHold(), ...T.finish() };
  return res;
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });

// ── 표 ──
const pc = (n, d) => (d > 0 ? `${Math.round((100 * n) / d)} %` : '-');
const med = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const OUTS = ['landed', 'touch', 'parried', 'blocked', 'evaded', 'whiffed'];
const OUTK = { landed: '맞음(상처)', touch: '닿음만', parried: '막음(막는 꼴)', blocked: '칼에 걸림', evaded: '피함', whiffed: '헛침' };
export function outcomeTable(atks, groupKey, label) {
  const groups = [...new Set(atks.map(groupKey))];
  const L = [`| ${label} | 공격 | ${OUTS.map((k) => OUTK[k]).join(' | ')} | 본 몫 | 결정 → 닿음 | 칼 나감 → 닿음 | 칼끝 3.5 → 닿음 | 앞발 → 닿음 | 본 때 → 닿음 |`, `|---|---:|${OUTS.map(() => '---:').join('|')}|---:|---:|---:|---:|---:|---:|`];
  for (const g of groups) {
    const A = atks.filter((a) => groupKey(a) === g);
    const hit = A.filter((a) => a.tTouch != null || a.tClash != null);
    const tc = (a) => Math.min(a.tTouch ?? Infinity, a.tClash ?? Infinity);
    L.push(`| ${g} | ${A.length} | ${OUTS.map((k) => pc(A.filter((a) => a.out === k).length, A.length)).join(' | ')} | ${pc(A.filter((a) => a.tSeen != null).length, A.length)} | ${f2(med(hit.map((a) => tc(a))))} | ${f2(med(hit.filter((a) => a.ts != null).map((a) => tc(a) - a.ts)))} | ${f2(med(hit.filter((a) => a.tTip != null).map((a) => tc(a) - a.tTip)))} | ${f2(med(hit.filter((a) => a.tFoot != null).map((a) => tc(a) - a.tFoot)))} | ${f2(med(hit.filter((a) => a.tSeen != null).map((a) => tc(a) - a.tSeen)))} |`);
  }
  return L.join('\n');
}
export function woundTable(ws, groupKey, label) {
  const groups = [...new Set(ws.map(groupKey))];
  const SRC = ['riso', 'I9', 'cav', 'thrust', 'cut'];
  const SK = { riso: '리솔루토', I9: '비껴서며 찌르기', cav: '빼서 찌르기', thrust: '보통 찌르기', cut: '베기' };
  const DEF = (w) => (w.defMode === 'striking' ? '치는 중' : !w.seen ? '못 봄' : w.def === 'parry' ? '막기 골랐는데' : w.def === 'void' || w.def === 'withdraw' ? '피하기 골랐는데' : '봤지만 막지 않음');
  const DK = ['못 봄', '봤지만 막지 않음', '막기 골랐는데', '피하기 골랐는데', '치는 중'];
  const L = [`| ${label} | 상처 | 심각도 | ${SRC.map((k) => SK[k]).join(' | ')} | 맞박자 × 1.3 | 칼 우위 동안 | ${DK.join(' | ')} |`, `|---|---:|---:|${SRC.map(() => '---:').join('|')}|---:|---:|${DK.map(() => '---:').join('|')}|`];
  for (const g of groups) {
    const W = ws.filter((w) => groupKey(w) === g);
    const tot = W.reduce((a, w) => a + w.sv, 0);
    const sh = (f) => pc(W.filter(f).reduce((a, w) => a + w.sv, 0), tot);
    L.push(`| ${g} | ${W.length} | ${f2(tot)} | ${SRC.map((k) => sh((w) => w.src === k)).join(' | ')} | ${sh((w) => w.stop)} | ${sh((w) => w.edge)} | ${DK.map((k) => sh((w) => DEF(w) === k)).join(' | ')} |`);
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0];
  const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const out = arg('out', null);
  if (mode === 'ring') {
    const want = arg('pairs', 'german:italian,japanese:italian,italian:iberian,italian:chinese').split(',');
    const vars = arg('vars', '0').split(',');
    const seeds = range(arg('seeds', '1-3'));
    for (const v of vars) for (const pr of want) {
      const [a, b] = pr.split(':');
      let ci = 0;
      for (const wa of WEAPONS[a]) for (const wb of WEAPONS[b]) {
        for (const seed of seeds) {
          const swap = (ci + seed) % 2 === 1;
          const r = withVar(v, () => ringFightT({ a, b, wa, wb, seed, swap }));
          const row = { mode: 'ring', v, a, b, wa, wb, seed, swap, ...r };
          if (out) appendFileSync(out, JSON.stringify(row) + '\n');
          console.error(v, a, b, wa, wb, seed, r.win ? 'W' : r.lose ? 'L' : 'D', 'atk', r.atks.length, 'tell', r.tellA, r.tellB);
        }
        ci++;
      }
    }
  } else if (mode === 'bot') {
    const cells = arg('cells', 'def:german:longsword:rapier,atk:italian:rapier:longsword').split(',');
    const vars = arg('vars', '0').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const SCH = { longsword: 'german', rapier: 'italian', uchigatana: 'japanese', zweihander: 'iberian', hwando: 'chinese' };
    for (const v of vars) for (const c of cells) for (const seed of seeds) {
      const [role, school, weapon, opp] = c.split(':');
      const { fightOne } = await import('./school_balance.mjs');
      const r = withVar(v, () => botFightT(fightOne, { school, weapon, opp, seed, foeSchool: SCH[opp] ?? 'german' }));
      const row = { mode: 'bot', v, role, school, weapon, opp, seed, ...r };
      if (out) appendFileSync(out, JSON.stringify(row) + '\n');
      console.error(v, c, seed, 'atk', r.atks.length, 'tell', r.tellAi, r.tellGuard);
    }
  } else if (mode === 'riso') {
    // 리솔루토 · 칼 우위 표 (§8): 판 · 짝마다 — 이김 몫 · 칼 우위 켜진 길(판당 — 새로 켜짐 · 켜진 채 다시) · 맞박자 맞음 · 창 길별 · 낸 것 · 맞힌 것 · 흘려보냄 · 리솔루토 상처 몫
    const rows = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    const key = (r) => (r.mode === 'ring' ? `${r.v}|${KO[r.a]} 대 ${KO[r.b]}` : `${r.v}|사람 봇 이탈리아 대 ${r.opp}`);
    const groups = [...new Set(rows.map(key))];
    const per = (R, f) => (R.length ? (R.reduce((a, r) => a + f(r), 0) / R.length).toFixed(2) : '-');
    const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
    const PATHS = ['touch', 'hold', 'beat'];
    const SRC = ['cav', 'opp', 'special', 'feint', 'stop'];
    console.log('| 판 | 짝 | 판 | 앞 쪽 이김 몫 | 칼 우위 새로 켜짐 (판당 — I2 · I6 · I9 · I8 · 맞박자) | 켜진 채 다시 | 켜진 시간 s | 맞박자 맞음 | 창 ① · ② · ③ (판당) | 낸 ① · ② · ③ | 맞힘 ① · ② · ③ | 흘려보냄 | 리솔루토 상처 몫 | 발 묶음 스텝 |');
    console.log('|---|---|---:|---:|---|---:|---:|---:|---|---|---|---:|---:|---:|');
    for (const g of groups) {
      const R = rows.filter((r) => key(r) === g);
      const [v, pair] = g.split('|');
      const W = R.filter((r) => r.win).length, Ls = R.filter((r) => r.lose).length;
      const share = Math.round((100 * (W + (R.length - W - Ls) / 2)) / R.length);
      const rs = (r) => r.atks.filter((a) => a.kind === 'riso' && a.by === 'italian');
      const fired = (p) => per(R, (r) => rs(r).filter((a) => a.why === p).length);
      const landed = (p) => per(R, (r) => rs(r).filter((a) => a.why === p && a.out === 'landed').length);
      const itW = (r) => r.wounds.filter((w) => w.by === 'italian');
      const sv = R.reduce((a, r) => a + itW(r).reduce((b, w) => b + w.sv, 0), 0);
      const svR = R.reduce((a, r) => a + itW(r).filter((w) => w.src === 'riso').reduce((b, w) => b + w.sv, 0), 0);
      console.log(`| ${v} | ${pair} | ${R.length} | ${share} % | ${SRC.map((k) => per(R, (r) => r.it?.fresh[k] ?? 0)).join(' · ')} | ${per(R, (r) => sum(r.it?.refresh))} | ${per(R, (r) => r.it?.edgeT ?? 0)} | ${per(R, (r) => r.it?.stopHits ?? 0)} | ${PATHS.map((p) => per(R, (r) => r.it?.opened[p] ?? 0)).join(' · ')} | ${PATHS.map(fired).join(' · ')} | ${PATHS.map(landed).join(' · ')} | ${per(R, (r) => sum(r.it?.lapsed))} | ${sv > 0 ? Math.round((100 * svR) / sv) : 0} % | ${per(R, (r) => r.risoHold ?? 0)} |`);
    }
  } else if (mode === 'agg') {
    const rows = args.slice(1).filter((x) => !x.startsWith('--')).flatMap((p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    const ring = rows.filter((r) => r.mode === 'ring');
    const bot = rows.filter((r) => r.mode === 'bot');
    if (ring.length) {
      const atks = ring.flatMap((r) => r.atks.map((a) => ({ ...a, v: r.v, pair: `${KO[r.a]} 대 ${KO[r.b]}` })));
      console.log('### 고리 — 들어오는 공격 끝 (치는 쪽 갈래)\n');
      console.log(outcomeTable(atks, (a) => `${a.v} · ${KO[a.by]} ${a.kind}`, '판 · 치는 쪽 · 갈래'));
      const ws = ring.flatMap((r) => r.wounds.map((w) => ({ ...w, v: r.v, pair: `${KO[r.a]} 대 ${KO[r.b]}` })));
      console.log('\n### 고리 — 준 칼날 상처 (심각도 몫)\n');
      console.log(woundTable(ws, (w) => `${w.v} · ${w.pair} · ${KO[w.by]} 가 줌`, '판 · 짝 · 준 쪽'));
      console.log('\n### 고리 — 판\n');
      const groups = [...new Set(ring.map((r) => `${r.v}|${r.a}|${r.b}`))];
      console.log('| 판 | 짝 (앞 쪽 이김 몫) | 이김 · 짐 · 비김 | 이김 몫 |\n|---|---|---|---:|');
      for (const g of groups) {
        const [v, a, b] = g.split('|');
        const R = ring.filter((r) => `${r.v}|${r.a}|${r.b}` === g);
        const W = R.filter((r) => r.win).length, Ls = R.filter((r) => r.lose).length;
        console.log(`| ${v} | ${KO[a]} 대 ${KO[b]} | ${W} · ${Ls} · ${R.length - W - Ls} | ${Math.round((100 * (W + (R.length - W - Ls) / 2)) / R.length)} % |`);
      }
    }
    if (bot.length) {
      const atks = bot.flatMap((r) => r.atks.map((a) => ({ ...a, v: r.v, cell: `${r.role}:${r.school}:${r.weapon}:${r.opp}` })));
      const bw = bot.flatMap((r) => r.wounds.map((w) => ({ ...w, v: r.v, cell: `${r.role}:${r.school}:${r.weapon}:${r.opp}`, who: w.by === r.school ? '봇' : 'AI' })));
      console.log('\n### 사람 봇 — 들어오는 공격 끝\n');
      console.log(outcomeTable(atks, (a) => `${a.v} · ${a.cell} · ${a.by === a.cell.split(':')[1] ? '봇' : 'AI'} ${a.kind === 'riso' && a.by !== 'italian' ? 'secret' : a.kind}`, '판 · 칸 · 치는 쪽 · 갈래'));
      console.log('\n### 사람 봇 — 준 칼날 상처\n');
      console.log(woundTable(bw, (w) => `${w.v} · ${w.cell} · ${w.who} 가 줌`, '판 · 칸 · 준 쪽'));
      console.log('\n| 판 · 칸 | 판 | 봇 이김 · 짐 · 비김 |\n|---|---:|---|');
      for (const g of [...new Set(bot.map((r) => `${r.v}|${r.role}:${r.school}:${r.weapon}:${r.opp}`))]) {
        const R = bot.filter((r) => `${r.v}|${r.role}:${r.school}:${r.weapon}:${r.opp}` === g);
        const W = R.filter((r) => r.win).length, Ls = R.filter((r) => r.lose).length;
        console.log(`| ${g.replace('|', ' · ')} | ${R.length} | ${W} · ${Ls} · ${R.length - W - Ls} |`);
      }
    }
  }
}
