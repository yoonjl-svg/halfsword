// ─────────────────────────────────────────────────────────────
//  ai_plan_measure.mjs — 유파 AI 기본 전투 흐름 1 단계 재기 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §9 · config AI_PLAN · src/ai_plan.js)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 한 짝(AI 이탈리아 레이피어 대 롱소드 AI · 둘 다 같은 숙련도) × 씨앗 1 ~ 6 · 30 s · 벽.
//   fight  — 판(on = 지금 · off = `AI_PLAN.on` 0 옛 판): 이김 · 짐 · 비김 · 국면 몫 · 유파 행동(물러서기 · 멈춤 · 꾐 · 칼 맞대기 · 첫 고리 · 받은 들어옴 공격 ·
//            맞박자 맞음 · 칼 우위 · 박자 찌르기 · 리솔루토) · 받은 · 준 심각도
//   perf   — 연산 비용(사장님 11/14 '랙이 생기진 않을까'): AI 한 번 갱신(update) ms 평균 · p99 · 가장 큼 — 옛 판 · 새 판(0.2 s + 사건) · 새 판 매 스텝 판정(tick 0)
//            1:1 한 판 + 넷이 싸우는 판(2:2 — jelly_harness newMatch) 한 판 · 물리 한 스텝 · 한 화면(1/60 s) 전체 시간과 견준 몫. 이 기계의 Node 값(폰은 따로)
//  node tools/sim/ai_plan_measure.mjs fight [--profs=2,5] [--seeds=1-6] [--dur=30]
//  node tools/sim/ai_plan_measure.mjs perf [--dur=20]
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
  Object.assign(AI_PLAN, over);
  try { return fn(); } finally { Object.assign(AI_PLAN, keep); }
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

if (mode === 'fight') {
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
