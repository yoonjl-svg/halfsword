// ─────────────────────────────────────────────────────────────
//  ai_plan_measure.mjs — 유파 AI 기본 전투 흐름 1 단계 재기 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §9 · config AI_PLAN · src/ai_plan.js)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 한 짝(AI 이탈리아 레이피어 대 롱소드 AI · 둘 다 같은 숙련도) × 씨앗 1 ~ 6 · 30 s · 벽.
//   fight  — 판(on = 지금 · off = `AI_PLAN.on` 0 옛 판): 이김 · 짐 · 비김 · 국면 몫 · 유파 행동(물러서기 · 멈춤 · 꾐 · 칼 맞대기 · 첫 고리 · 받은 들어옴 공격 ·
//            맞박자 맞음 · 칼 우위 · 박자 찌르기 · 리솔루토) · 받은 · 준 심각도
//   perf   — 연산 비용(사장님 11/14 '랙이 생기진 않을까'): AI 한 번 갱신(update) ms 평균 · p99 · 가장 큼 — 옛 판 · 새 판(0.2 s + 사건) · 새 판 매 스텝 판정(tick 0)
//            1:1 한 판 + 넷이 싸우는 판(2:2 — jelly_harness newMatch) 한 판 · 물리 한 스텝 · 한 화면(1/60 s) 전체 시간과 견준 몫. 이 기계의 Node 값(폰은 따로)
//  node tools/sim/ai_plan_measure.mjs fight [--profs=2,5] [--seeds=1-6] [--dur=30]
//  node tools/sim/ai_plan_measure.mjs perf [--dur=20]
//   dig    — 무 · 낮음 띠 '행운에 기대는 전투'(이탈리아 플랜) · 파고들기(공통 틀 — 짧은 칼) 재기 (11/14): 그 무기 AI 숙련 2 대 롱소드 AI 숙련 2 · 씨앗 1 ~ 6 · 30 s ·
//            홀수 씨앗 = 그 무기가 E 자리 (tools/sim/morg_weight.mjs fight 와 같은 판) — 새 판 · 옛 판(`AI_PLAN.on` 0) 한 줄씩:
//            공격 시작 · 칼 냄(맞힘 · 막힘 · 헛침) · 칼 내기 전 접음 · 그 가운데 시간 넘음 · 다가가다(준비 · 다가감) 받은 상처 · 준 / 받은 상처 · 이김 · 짐 · 비김 · 파고들기 · 굴림 행동
//  node tools/sim/ai_plan_measure.mjs dig [--weapons=rapier,frozen_tuna,morgenstern,rubber_chicken] [--seeds=1-6] [--prof=2]
//   de     — 3 단계 독일(11/14): 롱소드(독일) AI 숙련 2 · 5 — 새 판 · 옛 판 — 대 롱소드 AI 옛 판(persona.planOff) · 씨앗 1 ~ 6 · 독일 행동 수 · 이김 · 짐 · 비김
//  node tools/sim/ai_plan_measure.mjs de [--profs=2,5] [--seeds=1-6]
// ─────────────────────────────────────────────────────────────
import { performance } from 'node:perf_hooks';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { newMatch } from './jelly_harness.mjs';

const { AI_PLAN } = CONFIG;
const args = process.argv.slice(2);
const mode = args[0] ?? 'fight';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const pct = (a, p) => { const b = Float64Array.from(a).sort(); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const PH = ['probe', 'contest', 'commit', 'ahead', 'finish', 'behind', 'tired'];
const PH_KO = { probe: '간 보기', contest: '거리 다툼', commit: '들어감/받음', ahead: '우위', finish: '끝내기', behind: '불리', tired: '지침' };

function withPlan(over, fn) {
  const keep = { ...AI_PLAN };
  const jk = CONFIG.JP_TANK.ai;
  Object.assign(AI_PLAN, over);
  if (!AI_PLAN.on) CONFIG.JP_TANK.ai = 0; // 옛 판 = AI 일본 스택 · 바위 몸도 끔 (main.js `?aiPlan=0` 과 같게 — 2 단계 일본)
  try { return fn(); } finally { Object.assign(AI_PLAN, keep); CONFIG.JP_TANK.ai = jk; }
}

/** 한 판: 자리 0 롱소드 AI · 자리 1 이탈리아(레이피어) AI */
export function fightOne({ seed = 1, prof = 2, dur = 30 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const P = G.player; // 롱소드 AI
  const E = G.enemy; // 이탈리아 AI
  const sev = { E: 0, P: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic === E) sev.E += sv;
    if (vic === P) sev.P += sv;
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) G.step();
  const st = G.ai.stats;
  const it = E.itOut ?? {};
  const r = { seed, prof, plan: !!G.ai.plan, T: +G.t.toFixed(2), win: out(P) && !out(E), lose: out(E) && !out(P), recv: +sev.E.toFixed(4), dealt: +sev.P.toFixed(4),
    ph: st.plan ? { ...st.plan.t } : null, act: st.plan ? { retreat: st.plan.retreat, stop: st.plan.stop, invite: st.plan.invite, engage: st.plan.engage, engageTouch: st.plan.engageTouch, link: st.plan.link, stepin: st.plan.stepin, judges: st.plan.judges, events: st.plan.events } : null,
    stopHits: it.stopHits ?? 0, edge: it.edge ?? 0, beat: it.beatFired ?? 0, riso: st.riso?.fired ?? 0, passives: st.passives?.cavazione ?? 0 };
  G.world.free();
  return r;
}

function fightTable(runs) {
  const by = {};
  for (const r of runs) (by[`${r.plan ? '새 판' : '옛 판'} · 숙련 ${r.prof}`] ??= []).push(r);
  const L = ['| 판 | 판 수 | 이김 · 짐 · 비김 | 받은 / 준 심각도 판당 | 맞박자 맞음 · 칼 우위 · 박자 찌르기 · 리솔루토 · 빼서 찌르기 (판당) | 물러서기 · 멈춤 · 꾐 · 칼 맞대기(닿음) · 첫 고리 · 받은 들어옴 공격 (판당) | 국면 몫 % |', '|---|---|---|---|---|---|---|'];
  for (const [k, rs] of Object.entries(by).sort()) {
    const n = rs.length, W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    const per = (f) => f2(mean(rs.map(f)));
    const act = rs[0].act ? `${per((r) => r.act.retreat)} · ${per((r) => r.act.stop)} · ${per((r) => r.act.invite)} · ${per((r) => r.act.engage)}(${per((r) => r.act.engageTouch)}) · ${per((r) => r.act.link)} · ${per((r) => r.act.stepin)}` : '-';
    let ph = '-';
    if (rs[0].ph) {
      const tot = {}; let all = 0;
      for (const r of rs) for (const p of PH) { tot[p] = (tot[p] ?? 0) + r.ph[p]; all += r.ph[p]; }
      ph = PH.filter((p) => tot[p] > 0).map((p) => `${PH_KO[p]} ${Math.round((100 * tot[p]) / all)}`).join(' · ');
    }
    L.push(`| ${k} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(rs.map((r) => r.recv)))} / ${f2(mean(rs.map((r) => r.dealt)))} | ${per((r) => r.stopHits)} · ${per((r) => r.edge)} · ${per((r) => r.beat)} · ${per((r) => r.riso)} · ${per((r) => r.passives)} | ${act} | ${ph} |`);
  }
  return L.join('\n');
}

/** 갱신 시간 재기: ai.update 를 감싼다 (판 결과는 같다 — 시간만 잰다) */
function timeAi(ai, acc) {
  const orig = ai.update.bind(ai);
  ai.update = (dt) => { const t = performance.now(); orig(dt); acc.push(performance.now() - t); };
}

function perfOne({ dur = 20, count = 2 } = {}) {
  const ups = [];
  const steps = [];
  let G;
  if (count === 2) {
    G = newRound({ walls: true, seed: 4, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
    timeAi(G.ai, ups);
    timeAi(G.ai2, ups);
  } else {
    G = newMatch({ count, seed: 4, walls: true, ai: 'all', weapons: ['rapier', 'longsword', 'rapier', 'longsword'], aiOf: () => ({ level: 'hard', persona: { proficiency: 5 } }) });
    for (const a of G.ais) if (a) timeAi(a, ups);
  }
  while (G.t < dur) { const t = performance.now(); G.step(); steps.push(performance.now() - t); }
  const fighters = count;
  const stepMs = mean(steps);
  const upMean = mean(ups);
  const r = { count, ups: ups.length, upMean, upP99: pct(ups, 0.99), upMax: Math.max(...ups), stepMs, stepP99: pct(steps, 0.99), aiShare: (upMean * fighters) / stepMs, frameMs: stepMs * (1 / 60) / DT };
  G.world.free();
  return r;
}

/** 파고들기 · 굴림 재기 — 한 무기 × 씨앗들 (subject = 그 무기 AI) */
export function digRun(weapon, { seeds = [1, 2, 3, 4, 5, 6], prof = 2, dur = 30, foe = 'longsword' } = {}) {
  const S = { n: 0, atk: 0, strikes: 0, out: { hit: 0, bound: 0, miss: 0 }, fold: 0, foldTime: 0, hurtIn: 0, dealt: 0, recv: 0, W: 0, L: 0, dig: { recover: 0, keep: 0, restart: 0, long: 0 }, luck: { blurFire: 0, blurMiss: 0, reckSkip: 0, restLow: 0 },
    sch: { parries: 0, voids: 0, stkStrokes: 0, stkSum: 0, stkMax: 0, tsubame: 0, secret: 0, habit: 0, pre: 0, lure: 0, still: 0 } };
  for (const seed of seeds) {
    const subjE = seed % 2 === 1;
    const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, difficulty: 'normal', persona: { proficiency: prof }, persona2: { proficiency: prof } });
    const ai = subjE ? G.ai : G.ai2;
    const f = subjE ? G.enemy : G.player;
    const o = subjE ? G.player : G.enemy;
    const sa = ai.startAttack, ss = ai.startStrike, af = ai.afterStrike, ab = ai.abortAttack;
    ai.startAttack = function (...a) { const r = sa.apply(this, a); if (r && this.mode === 'attack') S.atk++; return r; };
    ai.startStrike = function (...a) { S.strikes++; return ss.apply(this, a); };
    ai.afterStrike = function (...a) { S.out[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++; return af.apply(this, a); };
    ai.abortAttack = function (...a) { if (this.phase === 'approach' && this.attackT > 1.3) S.foldTime++; return ab.apply(this, a); };
    G.onWound = (att, vic, r) => {
      if (vic === f) { S.recv++; if (ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach')) S.hurtIn++; }
      if (vic === o) S.dealt++;
    };
    let pm = ai.mode, pp = ai.phase;
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      if (pm === 'attack' && ai.mode !== 'attack' && (pp === 'windup' || pp === 'approach')) S.fold++;
      pm = ai.mode;
      pp = ai.phase;
      if (!f.alive || !o.alive) break;
    }
    S.n++;
    if (f.alive && !o.alive) S.W++;
    else if (!f.alive && o.alive) S.L++;
    for (const k in S.dig) S.dig[k] += ai.stats.dig?.[k] ?? 0;
    for (const k in S.luck) S.luck[k] += ai.stats.plan?.[k] ?? 0;
    const st = ai.stats, stk = f.schoolPassive?.stats?.stk, jp = st.plan?.jp;
    S.sch.parries += st.parries;
    S.sch.voids += st.voids;
    S.sch.stkStrokes += stk?.strokes ?? 0;
    S.sch.stkSum += stk?.sum ?? 0;
    S.sch.stkMax = Math.max(S.sch.stkMax, stk?.max ?? 0);
    S.sch.secret += Object.values(st.secrets ?? {}).reduce((x, v) => x + (v.fired ?? 0), 0);
    for (const k of ['tsubame', 'habit', 'pre', 'lure']) S.sch[k] += jp?.[k] ?? 0;
    G.world.free();
  }
  return S;
}

function digTable(rows) {
  const L = [`| 무기 AI (숙련 ${rows[0]?.[3] ?? 2}) 대 롱소드 AI | 판 | 공격 시작 / 판 | 칼 냄 / 판 (맞힘 · 막힘 · 헛침 — 6 판 합) | 칼 내기 전 접음 / 판 (그 가운데 시간 넘음) | 다가가다 받은 상처 / 판 | 준 · 받은 상처 / 판 | 이김 · 짐 · 비김 | 파고들기 6 판 합: 헛친 틈 · 받으며 들어감 · 다시 들어감 · 늘린 한도 | 굴림 6 판 합: 흐림이 낸 · 흐림이 놓친 · 위협 넘김 · 바닥 가까이 씀 | 유파 6 판 합: 막기 · 피하기 · 스택 실은 칼(실은 스택 합 · 가장 큼) · 비기 · 제비 베기 고리 · 버릇 · 미리 받기 · 유도 |`, '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [w, tag, S] of rows) {
    const n = S.n;
    const p = (x) => (x / n).toFixed(1);
    L.push(`| ${w} | ${tag} | ${p(S.atk)} | ${p(S.strikes)} (${S.out.hit} · ${S.out.bound} · ${S.out.miss}) | ${p(S.fold)} (${p(S.foldTime)}) | ${p(S.hurtIn)} | ${p(S.dealt)} · ${p(S.recv)} | ${S.W} · ${S.L} · ${n - S.W - S.L} | ${S.dig.recover} · ${S.dig.keep} · ${S.dig.restart} · ${S.dig.long} | ${S.luck.blurFire} · ${S.luck.blurMiss} · ${S.luck.reckSkip} · ${S.luck.restLow} | ${S.sch.parries} · ${S.sch.voids} · ${S.sch.stkStrokes}(${S.sch.stkSum} · ${S.sch.stkMax}) · ${S.sch.secret} · ${S.sch.tsubame} · ${S.sch.habit} · ${S.sch.pre} · ${S.sch.lure} |`);
  }
  return L.join('\n');
}

/**
 * 독일 재기 (3 단계 11/14): 롱소드(독일) AI 숙련 prof — 새 판(플랜) 또는 옛 판(persona.planOff) — 대 롱소드 AI 옛 판(persona.planOff) · 씨앗들 · 30 s · 홀수 씨앗은 그 AI 가 E 자리
 *  독일 행동: 파고들기(굴림 · 건 수 · 박찬 걸음 수) · 뒤 박차기 · 바보 자세 · 밀치기(이긴 굴림 · 낸 수) · 칼 씨름 · 손잡이 찍기 · 모르트슐라크 · 기력 차 판단(우위 · 열세 쪽)
 */
export function deRun({ seeds = [1, 2, 3, 4, 5, 6], prof = 2, dur = 30, subjOff = false } = {}) {
  const S = { n: 0, W: 0, L: 0, dealt: 0, recv: 0, strikes: 0, de: { digTry: 0, dig: 0, digSteps: 0, back: 0, lure: 0, pushWon: 0, shoves: 0, ring: 0, pommel: 0, mord: 0, diffUp: 0, diffDown: 0 }, foe: { pommel: 0, shoves: 0 } };
  for (const seed of seeds) {
    const subjE = seed % 2 === 1;
    const ps = { proficiency: prof, ...(subjOff ? { planOff: true } : {}) };
    const po = { proficiency: prof, planOff: true };
    const G = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, difficulty: 'normal', persona: subjE ? ps : po, persona2: subjE ? po : ps });
    const ai = subjE ? G.ai : G.ai2, fo = subjE ? G.ai2 : G.ai;
    const f = ai.me, o = fo.me;
    const ss = ai.startStrike;
    ai.startStrike = function (...a) { S.strikes++; return ss.apply(this, a); };
    G.onWound = (att, vic) => { if (vic === f) S.recv++; if (vic === o) S.dealt++; };
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      if (!f.alive || !o.alive) break;
    }
    S.n++;
    if (f.alive && !o.alive) S.W++;
    else if (!f.alive && o.alive) S.L++;
    const pd = ai.stats.plan?.de ?? {};
    for (const k of ['digTry', 'dig', 'back', 'lure', 'diffUp', 'diffDown']) S.de[k] += pd[k] ?? 0;
    S.de.digSteps += f.gait?.digs ?? 0;
    S.de.pushWon += ai.closeEv?.won ?? 0;
    S.de.shoves += f.shoves ?? 0;
    S.de.ring += f.deDirtyStats?.ring ?? 0;
    S.de.pommel += ai.stats.pommels ?? 0;
    S.de.mord += Object.entries(ai.stats.secrets ?? {}).reduce((x, [, v]) => x + (v.fired ?? 0), 0);
    S.foe.pommel += fo.stats.pommels ?? 0;
    S.foe.shoves += o.shoves ?? 0;
    G.world.free();
  }
  return S;
}

if (mode === 'de') {
  const seeds = range(arg('seeds', '1-6'));
  const L = ['| 판 (롱소드 AI 숙련 · 대 롱소드 AI 옛 판) | 판 | 이김 · 짐 · 비김 | 준 · 받은 상처 / 판 | 칼 냄 / 판 | 파고들기 굴림 · 건 수 · 박찬 걸음 | 뒤 박차기 | 바보 자세 | 밀치기 이긴 굴림 · 낸 수 | 칼 씨름 | 손잡이 찍기 (상대) | 비기(모르트슐라크) | 기력 차 판단 우위 · 열세 쪽 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const prof of arg('profs', '2,5').split(',').map(Number)) for (const [tag, off] of [['새 판 독일', false], ['옛 판 (둘 다)', true]]) {
    const S = deRun({ seeds, prof, subjOff: off });
    console.error(prof, tag, JSON.stringify(S));
    const n = S.n, p = (x) => (x / n).toFixed(1), D = S.de;
    L.push(`| ${tag} 숙련 ${prof} | ${n} | ${S.W} · ${S.L} · ${n - S.W - S.L} | ${p(S.dealt)} · ${p(S.recv)} | ${p(S.strikes)} | ${D.digTry} · ${D.dig} · ${D.digSteps} | ${D.back} | ${D.lure} | ${D.pushWon} · ${D.shoves} | ${D.ring} | ${D.pommel} (${S.foe.pommel}) | ${D.mord} | ${D.diffUp} · ${D.diffDown} |`);
  }
  console.log(L.join('\n'));
} else if (mode === 'dig') {
  const ws = arg('weapons', 'rapier,frozen_tuna,morgenstern,rubber_chicken').split(',');
  const seeds = range(arg('seeds', '1-6'));
  const prof = +arg('prof', 2);
  const rows = [];
  for (const w of ws) for (const [tag, over] of [['새 판', { on: 1 }], ...(w === 'rapier' ? [['1 단계 판 (굴림 몫 0)', { on: 1, luck: [0, 0, 0, 0] }]] : []), ['옛 판', { on: 0 }]]) {
    const S = withPlan(over, () => digRun(w, { seeds, prof }));
    rows.push([w, tag, S, prof]);
    console.error(w, tag, JSON.stringify(S));
  }
  console.log(digTable(rows));
} else if (mode === 'fight') {
  const profs = arg('profs', '2,5').split(',').map(Number);
  const seeds = range(arg('seeds', '1-6'));
  const dur = +arg('dur', 30);
  const runs = [];
  for (const on of [1, 0]) for (const prof of profs) for (const seed of seeds) {
    const r = withPlan({ on }, () => fightOne({ seed, prof, dur }));
    runs.push(r);
    console.error(JSON.stringify(r));
  }
  console.log(fightTable(runs));
} else if (mode === 'perf') {
  const dur = +arg('dur', 20);
  const L = ['| 판 | 몸 | AI 갱신 수 | AI 한 번 갱신 ms 평균 · p99 · 가장 큼 | 물리 한 스텝 ms 평균 · p99 | AI 몫 (한 스텝) | 한 화면(1/60 s) ms |', '|---|---|---|---|---|---|---|'];
  for (const count of [2, 4]) for (const [name, over] of [['옛 판 (끔)', { on: 0 }], ['새 판 0.2 s + 사건', { on: 1 }], ['새 판 매 스텝 판정', { on: 1, tick: 0 }]]) {
    const r = withPlan(over, () => perfOne({ dur, count }));
    L.push(`| ${name} | ${count} | ${r.ups} | ${f3(r.upMean)} · ${f3(r.upP99)} · ${f3(r.upMax)} | ${f3(r.stepMs)} · ${f3(r.stepP99)} | ${Math.round(100 * r.aiShare)} % | ${f2(r.frameMs)} |`);
    console.error(name, count, JSON.stringify(r));
  }
  console.log(L.join('\n'));
}
