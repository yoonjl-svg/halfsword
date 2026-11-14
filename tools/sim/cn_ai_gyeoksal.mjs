// ─────────────────────────────────────────────────────────────
//  cn_ai_gyeoksal.mjs — 동방 격살 AI 몫 재기 (11/14 사장님 '동방도 격살 쓰게 해' — ai.js gyeoksalAi · 기록 docs/strike/cn_ai_gyeoksal_2026-11-14.md)
//   재기만 한다 (판 값은 이 프로세스 안에서만). 판(cfg): open = 가지 기본(AI 동방 격살 · AI 사냥 겹) · closed = 전 판(aiOpenSchools 에 동방 없음 · cnHunt.ai 0)
//   칸: ai:<내 무기>:<상대 무기> = AI 동방(숙련 5) 대 AI(숙련 3) · 30 s · 벽 (사장님 11/14 'ai의 변화 재는 거 최소로 해' — 환도 대 롱소드 한 짝 · 씨앗 1 ~ 6)
//  node tools/sim/cn_ai_gyeoksal.mjs run --cfg=open --cells=ai:hwando:longsword --seeds=1-6 --json=.tmp/x.json
//  node tools/sim/cn_ai_gyeoksal.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const { SECRET, UNIQUE_ASSIST: UA } = CONFIG;
export const CELLS = ['ai:hwando:longsword'];
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
const r3 = (x) => +(+x).toFixed(3);

export function applyCfg(cfg) {
  if (cfg === 'closed') {
    SECRET.aiOpenSchools = SECRET.aiOpenSchools.filter((x) => x !== 'chinese');
    UA.cnHunt.ai = 0;
  } else if (cfg !== 'open') throw new Error(`cfg ${cfg}`);
}

/** AI 동방 몸 하나의 격살 기록 꽂개: 낸 수 · 상처(그 칼이 도는 동안 · 낸 뒤 1 s 안) · gk 셈 */
function watch(G, cnAi, cnBody) {
  const rec = { fired: 0, hits: 0, sev: 0, onTo: [] };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att !== cnBody || !(r.severity > 0)) return;
    if (cnAi.secretRun?.S?.name === 'gyeoksal' || (rec.lastT != null && G.t - rec.lastT <= CONFIG.TIME.k)) (rec.hits++, (rec.sev += r.severity));
  };
  return {
    rec,
    step() {
      const f = cnAi.stats.secrets?.gyeoksal?.fired ?? 0;
      if (f > rec.fired) (rec.fired = f), (rec.lastT = G.t), rec.onTo.push(r3(cnAi.foe.cnHunt?.n ?? 0));
    },
  };
}

export function aiFight({ weapon, opp, seed, dur = 30 }) {
  const G = newRound({ walls: true, seed, weapon, weapon2: opp, AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: 5 } });
  try {
    const P = G.player; // AI 동방 (G.ai2)
    const E = G.enemy;
    const W = watch(G, G.ai2, P);
    const K = CONFIG.TIME.k;
    let end = null;
    while (G.t < dur * K) {
      G.step();
      W.step();
      if ((!P.alive || !E.alive) && end == null) end = G.t + 0.5 * K;
      if (end != null && G.t >= end) break;
    }
    return { kind: 'ai', weapon, opp, seed, T: r3(G.t / K), win: !E.alive && P.alive, lose: !P.alive && E.alive, fired: W.rec.fired, hits: W.rec.hits, sev: r3(W.rec.sev), stacksAt: W.rec.onTo, hunt: r3(E.cnHunt?.n ?? 0), gk: { try: G.ai2.stats.gkTry ?? 0, ...(G.ai2.stats.gk ?? {}) } };
  } finally {
    G.world.free();
  }
}

export function aggMarkdown(runs) {
  const by = {};
  for (const r of runs) (by[`${r.cfg}|${r.kind}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = ['| 판 | 칸 | 판 수 | AI 동방 이김·짐·비김 | AI 격살 낸 수 | 맞음(상처) | 상처 심각도 합 | 격살 시도 막기 | 닿음 | 때 늦음 · 걸음 · 느림 · 베임 · 자세 | 기다림 · 뚫림 · 창 | 판 길이 s |', '|---|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|'];
  const sum = (rs, k) => rs.reduce((s, r) => s + (r.gk?.[k] ?? 0), 0);
  for (const k of Object.keys(by).sort()) {
    const rs = by[k];
    const [cfg, cell] = k.split('|');
    const w = rs.filter((r) => r.win).length;
    const l = rs.filter((r) => r.lose).length;
    out.push(`| ${cfg} | ${cell} | ${rs.length} | ${w}·${l}·${rs.length - w - l} | ${rs.reduce((s, r) => s + r.fired, 0)} | ${rs.reduce((s, r) => s + r.hits, 0)} | ${rs.reduce((s, r) => s + r.sev, 0).toFixed(2)} | ${sum(rs, 'try')} | ${sum(rs, 'edges')} | ${['late', 'notFwd', 'slow', 'hurt', 'noStance'].map((x) => sum(rs, x)).join(' · ')} | ${['pend', 'cut', 'open'].map((x) => sum(rs, x)).join(' · ')} | ${(rs.reduce((s, r) => s + r.T, 0) / rs.length).toFixed(1)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    console.log(aggMarkdown(rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs)));
  } else {
    const cfg = arg('cfg', 'open');
    applyCfg(cfg);
    const runs = [];
    for (const c of arg('cells', CELLS.join(',')).split(',')) {
      const [kind, weapon, opp] = c.split(':');
      for (const seed of range(arg('seeds', '1-6'))) {
        const r = aiFight({ weapon, opp, seed });
        r.cfg = cfg;
        runs.push(r);
        console.error(JSON.stringify({ c, seed, cfg, win: r.win, lose: r.lose, fired: r.fired, hits: r.hits }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ cfg, runs }));
    console.log(aggMarkdown(runs));
  }
}
