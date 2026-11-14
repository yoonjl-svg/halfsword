// ─────────────────────────────────────────────────────────────
//  ai_plan_ib_measure.mjs — 유파 AI 플랜 2 단계 이베리아 재기 (11/14 — src/ai_plan_ib.js · config AI_PLAN.ib · 기록 docs/strike/ai_plan_ib_2026-11-14.md)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 한 짝(AI 이베리아 츠바이핸더 숙련 2 · 5 대 롱소드 AI 숙련 2) × 씨앗 1 ~ 6 · 30 s · 벽.
//   판: 새 판(지금) · 옛 판(`AI_PLAN.on` 0 — `?aiPlan=0` 꼴) 한 줄씩. 보는 것 셋: 국면 몫 · 이베리아 행동이 났나(사슬 길이 · 이어 돌리기 · 맞바꿈 · 알티바슈) · 이김 · 짐 · 비김.
//  node tools/sim/ai_plan_ib_measure.mjs [--profs=2,5] [--seeds=1-6] [--dur=30] [--set=ib.chainBody=0]
//   --table=step (11/14 둘째 — 변칙성 · 옆 박차기): 새 판 한 줄만 — 옆 박차기(걸린 수 · 굴림 자리: 돌기 박자 · 선 밖 비킴 · 사슬 끝 · 비켜 꾐) · 나선 걸음 베기 · 비스듬히 들어감 · 맞음(준 · 받은 칼날 상처 수) · 이김 · 짐 · 비김
//    (합친 판과 견줄 때는 그 판 파일에 이 도구를 놓고 같은 줄로 돌림)
// ─────────────────────────────────────────────────────────────
import { newRound, AI, CONFIG } from './harness_m.mjs';

const { AI_PLAN } = CONFIG;
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const PH = ['probe', 'contest', 'commit', 'ahead', 'finish', 'behind', 'tired'];
const PH_KO = { probe: '간 보기', contest: '거리 다툼', commit: '들어감/받음', ahead: '우위', finish: '끝내기', behind: '불리', tired: '지침' };

function withPlan(over, fn) {
  const keep = { ...AI_PLAN, ib: { ...AI_PLAN.ib } };
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('ib.')) AI_PLAN.ib[k.slice(3)] = v;
    else AI_PLAN[k] = v;
  }
  try { return fn(); } finally { Object.assign(AI_PLAN, keep); }
}

/** 한 판: 자리 0(사람 자리) 롱소드 AI 숙련 2 · 자리 1 이베리아(츠바이핸더) AI 숙련 prof */
export function fightOne({ seed = 1, prof = 2, dur = 30, weapon = 'zweihander' } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: weapon, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: 2 } });
  const P = G.player; // 롱소드 AI
  const E = G.enemy; // 이베리아 AI
  const ai = G.ai;
  const sev = { E: 0, P: 0, nE: 0, nP: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic === E) (sev.E += sv), sv > 0 && sev.nE++;
    if (vic === P) (sev.P += sv), sv > 0 && sev.nP++;
  };
  // 사슬 = 새 공격 하나 + 그 뒤 이어 친 공격(opt.chain > 0)들의 칼 수
  const chains = [];
  let cur = 0;
  const sa = ai.startAttack;
  ai.startAttack = function (t, why, opt = {}) {
    const r = sa.call(this, t, why, opt);
    if (r && this.mode === 'attack') {
      if ((opt.chain ?? 0) > 0) cur++;
      else {
        if (cur) chains.push(cur);
        cur = 1;
      }
    }
    return r;
  };
  let bodyN = 0;
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) {
    G.step();
    if ((E.ibLastN ?? 0) > bodyN) bodyN = E.ibLastN;
  }
  if (cur) chains.push(cur);
  const st = ai.stats;
  const r = {
    seed, prof, plan: !!ai.ibPlan, T: +G.t.toFixed(2), win: out(P) && !out(E), lose: out(E) && !out(P), recv: +sev.E.toFixed(4), dealt: +sev.P.toFixed(4), hitsDealt: sev.nP, hitsRecv: sev.nE,
    chainN: chains.length, chainCuts: chains.reduce((a, b) => a + b, 0), chainMax: Math.max(0, ...chains), chain3: chains.filter((c) => c >= 3).length,
    bodyN, free: E.ibFreeCuts ?? 0, link: st.ibLink?.fired ?? 0, linkDone: st.ibLink?.done ?? 0, swap: E.ibTradeLog?.length ?? 0,
    altib: st.altib?.fired ?? 0, altibBegin: st.altib?.begin ?? 0,
    ph: st.plan ? { ...st.plan.t } : null, ib: st.ib ? { ...st.ib } : null,
  };
  G.world.free();
  return r;
}

function table(runs) {
  const by = {};
  for (const r of runs) (by[`${r.tag} · 숙련 ${r.prof}`] ??= []).push(r);
  const L = ['| 판 | 판 수 | 이김 · 짐 · 비김 | 받은 / 준 심각도 판당 | 사슬 길이 평균 (가장 긺 · 세 칼 넘은 사슬/판) | 몸 사슬 n 가장 큼 평균 · 기력 0 칼/판 | 이어 돌리기/판 (다 돎) | 맞바꿈/판 | 알티바슈/판 (멤) | 옆 박차기 · 나선 걸음 베기 · 무장 기다림(무장됨) · 무장 뒤 들어감 · 원 돌려 보이기 · 원으로 이음 (판당) | 국면 몫 % |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, rs] of Object.entries(by)) {
    const n = rs.length, W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    const per = (f) => f2(mean(rs.map(f)));
    const cuts = rs.reduce((a, r) => a + r.chainCuts, 0), cn = rs.reduce((a, r) => a + r.chainN, 0);
    const ib = rs[0].ib ? `${per((r) => r.ib.dash)} · ${per((r) => r.ib.slant)} · ${per((r) => r.ib.out)}(${per((r) => r.ib.outArmed)}) · ${per((r) => r.ib.goIn)} · ${per((r) => r.ib.lure)} · ${per((r) => r.ib.spinPick)}` : '-';
    let ph = '-';
    if (rs[0].ph) {
      const tot = {}; let all = 0;
      for (const r of rs) for (const p of PH) { tot[p] = (tot[p] ?? 0) + r.ph[p]; all += r.ph[p]; }
      ph = PH.filter((p) => tot[p] > 0).map((p) => `${PH_KO[p]} ${Math.round((100 * tot[p]) / all)}`).join(' · ');
    }
    L.push(`| ${k} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(rs.map((r) => r.recv)))} / ${f2(mean(rs.map((r) => r.dealt)))} | ${f2(cuts / Math.max(1, cn))} (${Math.max(...rs.map((r) => r.chainMax))} · ${per((r) => r.chain3)}) | ${per((r) => r.bodyN)} · ${per((r) => r.free)} | ${per((r) => r.link)} (${per((r) => r.linkDone)}) | ${per((r) => r.swap)} | ${per((r) => r.altib)} (${per((r) => r.altibBegin)}) | ${ib} | ${ph} |`);
  }
  return L.join('\n');
}

function stepTable(runs) {
  const by = {};
  for (const r of runs) (by[`숙련 ${r.prof}`] ??= []).push(r);
  const L = ['| 판 | 판 수 | 이김 · 짐 · 비김 | 옆 박차기/판 (판마다) | 굴림 자리/판: 돌기 박자 · 선 밖 비킴 · 사슬 끝 · 비켜 꾐(걸림) | 나선 걸음 베기/판 | 비스듬히 들어감/판 | 맞음/판 준 · 받은 (칼날 상처) | 판 길이 s |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [k, rs] of Object.entries(by)) {
    const n = rs.length, W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    const per = (f) => f2(mean(rs.map(f)));
    const ib = (key) => (r) => r.ib?.[key] ?? 0;
    L.push(`| ${k} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${per(ib('dash'))} (${rs.map(ib('dash')).join(' · ')}) | ${per(ib('tryCircle'))} · ${per(ib('tryDodge'))} · ${per(ib('tryEnd'))} · ${per(ib('bait'))} | ${per(ib('slant'))} | ${per(ib('odd'))} | ${per((r) => r.hitsDealt)} · ${per((r) => r.hitsRecv)} | ${per((r) => r.T)} |`);
  }
  return L.join('\n');
}

const profs = arg('profs', '2,5').split(',').map(Number);
const seeds = range(arg('seeds', '1-6'));
const dur = +arg('dur', 30);
const sets = Object.fromEntries((arg('set', '') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, +v]; }));
const runs = [];
const stepMode = arg('table', '') === 'step';
for (const [tag, over] of stepMode ? [['새 판', { on: 1, ...sets }]] : [['새 판', { on: 1, ...sets }], ['옛 판', { on: 0 }]]) for (const prof of profs) for (const seed of seeds) {
  const r = withPlan(over, () => fightOne({ seed, prof, dur }));
  r.tag = tag;
  runs.push(r);
  console.error(tag, JSON.stringify(r));
}
console.log(stepMode ? stepTable(runs) : table(runs));
