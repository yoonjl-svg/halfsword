// ─────────────────────────────────────────────────────────────
//  ai_plan_cn_measure.mjs — 유파 AI 동방 플랜 재기 (2 단계 · 11/14 — src/ai_plan_cn.js · config AI_PLAN.cn · 기록 docs/strike/ai_plan_cn_2026-11-14.md)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 한 짝: AI 동방(환도 · 숙련 2 · 5) 대 롱소드 AI(숙련 2) × 씨앗 1 ~ 6 · 30 s · 벽 ·
//   홀수 씨앗 = 동방이 E 자리 · 짝수 = P 자리 (자리 치우침을 덜게 — ai_plan_measure.mjs dig 와 같은 꼴).
//   새 판(지금) · 옛 판(`AI_PLAN.on` 0 — `?aiPlan=0` 꼴) 한 줄씩: 이김 · 짐 · 비김 · 국면 몫 · 동방 행동(허리 베기 몫 · 겹 · 격살 · 유도 · 격살을 노릴 마음 · 나서며 받기) · 받은 / 준 심각도.
//  node tools/sim/ai_plan_cn_measure.mjs [--profs=2,5] [--seeds=1-6] [--dur=30] [--foeProf=2] [--weapon=hwando]
// ─────────────────────────────────────────────────────────────
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { huntN } from '../../src/cn_hunt.js';

const { AI_PLAN, UNIQUE_ASSIST: UA } = CONFIG;
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const PH = ['probe', 'contest', 'commit', 'ahead', 'finish', 'behind', 'tired'];
const PH_KO = { probe: '간 보기', contest: '거리 다툼', commit: '들어감/받음', ahead: '우위', finish: '끝내기', behind: '불리', tired: '지침' };

function withPlan(over, fn) {
  const keep = { ...AI_PLAN };
  Object.assign(AI_PLAN, over);
  try { return fn(); } finally { Object.assign(AI_PLAN, keep); }
}

/** 한 판: 동방 AI (weapon · 숙련 prof) 대 롱소드 AI (숙련 foeProf) — 홀수 씨앗은 동방이 E 자리 */
export function fightOne({ seed = 1, prof = 2, foeProf = 2, dur = 30, weapon = 'hwando' } = {}) {
  const subjE = seed % 2 === 1;
  const G = newRound({ walls: true, seed, weapon: subjE ? 'longsword' : weapon, weapon2: subjE ? weapon : 'longsword', AI2Class: AI, persona: { proficiency: subjE ? prof : foeProf }, persona2: { proficiency: subjE ? foeProf : prof } });
  const P = subjE ? G.player : G.enemy; // 롱소드 AI
  const E = subjE ? G.enemy : G.player; // 동방 AI
  const ai = subjE ? G.ai : G.ai2;
  const sev = { E: 0, P: 0 };
  const gk = { hits: 0, sev: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic === E) sev.E += sv;
    if (vic === P) {
      sev.P += sv;
      if (ai.secretRun?.S?.when === 'gyeoksal' || ai.secretRun?.S?.name === 'gyeoksal') (gk.hits++, (gk.sev += sv));
    }
  };
  // 허리 베기 몫: 낸 공격(공격 꼴에 든 것) 가운데 허리 베기 계열(요격 · 체보요격 · 날개 접기) — 속임이면 속임의 고유 동작 이름으로
  const A = { atk: 0, waist: 0 };
  const waist = UA.yaojiBleed.techs;
  const sa = ai.startAttack;
  ai.startAttack = function (...a) {
    const r = sa.apply(this, a);
    if (r && this.mode === 'attack' && !this.secretRun) {
      A.atk++;
      const nm = this.feint ? this.uniqueByName.get(this.feint.name)?.name : this.tech?.name;
      if (waist.includes(nm)) A.waist++;
    }
    return r;
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) G.step();
  const st = ai.stats;
  const r = { seed, prof, plan: !!ai.plan, cn: !!ai.planCn, T: +G.t.toFixed(2), win: out(P) && !out(E), lose: out(E) && !out(P), recv: +sev.E.toFixed(4), dealt: +sev.P.toFixed(4),
    ph: st.plan ? { ...st.plan.t } : null, atk: A.atk, waist: A.waist, hunt: huntN(P), huntHits: P.cnHunt?.hits ?? 0,
    gkTry: st.gkTry ?? 0, gkOpen: st.gk?.open ?? 0, gkUsed: E.secretUsed ?? 0, gkHits: gk.hits, gkSev: +gk.sev.toFixed(3),
    cn: st.cn ? { ...st.cn } : null };
  G.world.free();
  return r;
}

function table(runs) {
  const by = {};
  for (const r of runs) (by[`${r.plan ? '새 판' : '옛 판'} · 숙련 ${r.prof}`] ??= []).push(r);
  const L = ['| 판 (AI 동방 환도 대 롱소드 AI 숙련 2) | 판 수 | 이김 · 짐 · 비김 | 받은 / 준 심각도 판당 | 공격 / 판 · 허리 베기 몫 % | 상대에 쌓인 겹 판당 (판 끝) | 격살 시도 막기 · 창 · 낸 · 맞힘 (6 판 합) | 유도 · 끌어냄 · 격살 노릴 마음(굴림 → 남) · 나서며 받기 · 날개 접기 고름 (6 판 합) | 국면 몫 % |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [k, rs] of Object.entries(by).sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
    const n = rs.length, W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    const sum = (f) => rs.reduce((s, r) => s + f(r), 0);
    const atk = sum((r) => r.atk), wst = sum((r) => r.waist);
    const cn = rs[0].cn ? `${sum((r) => r.cn.lure)} · ${sum((r) => r.cn.lureDraw)} · ${sum((r) => r.cn.wantRoll)} → ${sum((r) => r.cn.want)} · ${sum((r) => r.cn.meet)} · ${sum((r) => r.cn.lianchi)}` : '-';
    let ph = '-';
    if (rs[0].ph) {
      const tot = {}; let all = 0;
      for (const r of rs) for (const p of PH) { tot[p] = (tot[p] ?? 0) + r.ph[p]; all += r.ph[p]; }
      ph = PH.filter((p) => tot[p] > 0).map((p) => `${PH_KO[p]} ${Math.round((100 * tot[p]) / all)}`).join(' · ');
    }
    L.push(`| ${k} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(rs.map((r) => r.recv)))} / ${f2(mean(rs.map((r) => r.dealt)))} | ${f2(atk / n)} · ${atk ? Math.round((100 * wst) / atk) : 0} | ${f2(mean(rs.map((r) => r.hunt)))} | ${sum((r) => r.gkTry)} · ${sum((r) => r.gkOpen)} · ${sum((r) => r.gkUsed)} · ${sum((r) => r.gkHits)} | ${cn} | ${ph} |`);
  }
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const profs = arg('profs', '2,5').split(',').map(Number);
  const seeds = range(arg('seeds', '1-6'));
  const dur = +arg('dur', 30);
  const foeProf = +arg('foeProf', 2);
  const weapon = arg('weapon', 'hwando');
  const runs = [];
  for (const on of [1, 0]) for (const prof of profs) for (const seed of seeds) {
    const r = withPlan({ on }, () => fightOne({ seed, prof, foeProf, dur, weapon }));
    runs.push(r);
    console.error(JSON.stringify(r));
  }
  console.log(table(runs));
}
