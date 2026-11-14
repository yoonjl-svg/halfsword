// ─────────────────────────────────────────────────────────────
//  ai_plan_free_measure.mjs — 유파 AI 3 단계 무유파 플랜 재기 (11/14 — src/ai_plan_free.js · config AI_PLAN_FREE · 기록 docs/strike/ai_plan_free_2026-11-14.md)
//   사장님 11/14 'ai의 변화 재는 거 최소로 해' — 무유파 무기 AI(모르겐슈테른 · 냉동 참치 · 고무 닭) 숙련 2 · 5 대 롱소드 AI(같은 숙련) × 씨앗 1 ~ 6 · 30 s · 벽 ·
//   홀수 씨앗 = 무유파 무기가 E 자리 (ai_plan_measure.mjs dig 와 같은 판). 판마다: 옛 판(`AI_PLAN_FREE.on` 0) · 새 판 · 새 판에서 쳐내기만 뺀 판.
//  node tools/sim/ai_plan_free_measure.mjs [--weapons=morgenstern,frozen_tuna,rubber_chicken] [--profs=2,5] [--seeds=1-6] [--vars=old,new,nobeat] [--json=out.json]
//  node tools/sim/ai_plan_free_measure.mjs agg a.json b.json …   (나눠 돌린 json 을 한 표로)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const NAME = { morgenstern: '모르겐슈테른', frozen_tuna: '냉동 참치', rubber_chicken: '고무 닭', tree_branch: '나뭇가지', brothers_sword: '황약사의 검' };
export const VARS = {
  old: { on: 0 },
  new: { on: 1 },
  nobeat: { on: 1, beat: 0, wild: 0 },
};
const VAR_KO = { old: '옛 판', new: '새 판', nobeat: '새 판 − 쳐내기' };

export function withFree(over, fn) {
  const F = CONFIG.AI_PLAN_FREE;
  const keep = { ...F };
  Object.assign(F, over);
  try { return fn(); } finally { Object.assign(F, keep); }
}

/** 한 판 — subject = 무유파 무기 AI */
export function fightOne({ weapon, seed, prof, dur = 30, foe = 'longsword' }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, difficulty: 'normal', persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const ai = subjE ? G.ai : G.ai2;
  const f = subjE ? G.enemy : G.player;
  const o = subjE ? G.player : G.enemy;
  const S = { atk: 0, entered: 0, strikes: 0, hits: 0, hurtIn: 0, dealt: 0, recv: 0, dealtE: 0, recvSev: 0, win: 0, lose: 0 };
  const sa = ai.startAttack, ss = ai.startStrike, af = ai.afterStrike;
  ai.startAttack = function (...a) { const r = sa.apply(this, a); if (r && this.mode === 'attack' && !a[2]?.chain) S.atk++; return r; };
  ai.startStrike = function (...a) { S.strikes++; if (!this.chain && this.why !== 'beat') S.entered++; return ss.apply(this, a); }; // 쳐내기 칼(상대 칼을 침)은 들어간 수에 안 셈
  ai.afterStrike = function (...a) { if (this.hitLanded) S.hits++; return af.apply(this, a); };
  G.onWound = (att, vic, r) => {
    if (vic === f) { S.recv++; S.recvSev += r.type === 'blunt' ? 0 : r.severity ?? 0; if (ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach')) S.hurtIn++; }
    if (vic === o) { S.dealt++; S.dealtE += r.energy ?? 0; }
  };
  for (let i = 0; i < Math.round(dur / DT); i++) {
    G.step();
    if (!f.alive || !o.alive) break;
  }
  if (f.alive && !o.alive) S.win = 1;
  else if (!f.alive && o.alive) S.lose = 1;
  S.plan = !!ai.plan;
  S.free = ai.stats.free ? { ...ai.stats.free } : null;
  S.luck = ai.stats.plan ? { blurFire: ai.stats.plan.blurFire, blurMiss: ai.stats.plan.blurMiss, reckSkip: ai.stats.plan.reckSkip, restLow: ai.stats.plan.restLow } : null;
  S.dig = ai.stats.dig ? { ...ai.stats.dig } : null;
  S.err = ai.distErr ?? 0;
  G.world.free();
  return S;
}

function sum(rows) {
  const T = { n: rows.length, free: {}, luck: {}, dig: {} };
  for (const r of rows) {
    for (const k of ['atk', 'entered', 'strikes', 'hits', 'hurtIn', 'dealt', 'recv', 'dealtE', 'recvSev', 'win', 'lose']) T[k] = (T[k] ?? 0) + r[k];
    for (const g of ['free', 'luck', 'dig']) if (r[g]) for (const k in r[g]) T[g][k] = (T[g][k] ?? 0) + r[g][k];
  }
  return T;
}

export function table(runs) {
  const L = ['| 무기 (무유파 AI) | 숙련 | 판 | 판 수 | 공격 / 판 | 들어간 수 / 판 (첫 칼을 냄 · 쳐내기 칼 뺌) | 낸 칼 / 판 | 맞힌 칼 / 판 | 다가가다 맞음 / 판 | 준 · 받은 상처 / 판 | 받은 칼날 심각도 / 판 | 이김 · 짐 · 비김 | 쳐내기 6 판 합: 계획 · 막 휘두름 (칼 닿음 · 맞힘 · 헛침) · 건너 들어감 (칼 냄) | 붙어 두들김 · 굴림(흐림 냄 · 넘김 · 낮은 쉼) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const keys = [...new Set(runs.map((r) => `${r.weapon}|${r.prof}|${r.v}`))];
  for (const key of keys) {
    const [w, p, v] = key.split('|');
    const T = sum(runs.filter((r) => `${r.weapon}|${r.prof}|${r.v}` === key));
    const n = T.n;
    const q = (x) => ((x ?? 0) / n).toFixed(2);
    const fr = T.free, lu = T.luck;
    const fcol = fr.beat != null ? `${fr.beat} · ${fr.wild} (${fr.beatBound} · ${fr.beatHit} · ${fr.beatMiss}) · ${fr.go} (${fr.goStrike})` : '-';
    const lcol = `${fr.press ?? '-'} · ${lu.blurFire ?? '-'} · ${lu.reckSkip ?? '-'} · ${lu.restLow ?? '-'}`;
    L.push(`| ${NAME[w] ?? w} | ${p} | ${VAR_KO[v] ?? v} | ${n} | ${q(T.atk)} | ${q(T.entered)} | ${q(T.strikes)} | ${q(T.hits)} | ${q(T.hurtIn)} | ${q(T.dealt)} · ${q(T.recv)} | ${q(T.recvSev)} | ${T.win} · ${T.lose} · ${n - T.win - T.lose} | ${fcol} | ${lcol} |`);
  }
  return L.join('\n');
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain && args[0] === 'agg') {
  const runs = args.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
  console.log(table(runs));
} else if (isMain) {
  const ws = arg('weapons', 'morgenstern,frozen_tuna,rubber_chicken').split(',');
  const profs = arg('profs', '2,5').split(',').map(Number);
  const seeds = range(arg('seeds', '1-6'));
  const vars = arg('vars', 'old,new,nobeat').split(',');
  const runs = [];
  for (const weapon of ws) for (const prof of profs) for (const v of vars) for (const seed of seeds) {
    const r = withFree(VARS[v], () => fightOne({ weapon, seed, prof }));
    runs.push({ weapon, prof, v, seed, ...r });
    console.error(weapon, prof, v, seed, JSON.stringify({ e: r.entered, h: r.hits, hi: r.hurtIn, w: r.win, l: r.lose, f: r.free }));
  }
  const out = arg('json', null);
  if (out) writeFileSync(out, JSON.stringify(runs));
  console.log(table(runs));
}
