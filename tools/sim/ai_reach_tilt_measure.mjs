// ─────────────────────────────────────────────────────────────
//  ai_reach_tilt_measure.mjs — 상대가 길 때의 대처 (모든 AI 기본 — 11/14 사장님 '그 판단을 상대 무기가 나보다 길 때의 대처 전략으로 모든 ai에게 기본으로' ·
//   src/dig_proto.js digWeight · config DIG_PROTO.reach · reachRef · 기록 docs/strike/ai_dig_2026-11-14.md §9) 재기 — 최소:
//   길이가 조금 · 꽤 모자란 짝(짧은 쪽 AI 대 긴 쪽 AI · 같은 숙련) × 숙련 3 · 5 × 씨앗 1 ~ 6 · 30 s · 벽 · 홀수 씨앗 = 짧은 쪽이 E 자리.
//   판마다 지금(옛 문 — `DIG_PROTO.reach` 0) · 기울기(1) 한 줄씩: 들어간 수(첫 칼을 낸 공격) · 첫 상처(판의 첫 칼날 상처를 짧은 쪽이 냄) · 맞힌 칼 · 다가가다 맞음 · 이김 · 짐 · 비김.
//  node tools/sim/ai_reach_tilt_measure.mjs [--pairs=longsword:zweihander,…] [--profs=3,5] [--seeds=1-6] [--json=out.json]
//  node tools/sim/ai_reach_tilt_measure.mjs agg a.json b.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { instrument } from './ai_dig_measure.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', rapier: '레이피어', uchigatana: '우치가타나', hwando: '환도', saber: '세이버' };
export const PAIRS = ['longsword:zweihander', 'rapier:zweihander', 'uchigatana:longsword', 'hwando:rapier', 'saber:longsword'];
const VAR_KO = { now: '지금 (옛 문)', tilt: '기울기' };

export function withReach(on, fn) {
  const D = CONFIG.DIG_PROTO;
  const keep = D.reach;
  D.reach = on;
  try { return fn(); } finally { D.reach = keep; }
}

/** 한 판 — subject = 짧은 쪽(short) AI · 상대 = 긴 쪽(long) AI · 같은 숙련 */
export function fightOne({ short, long, seed, prof, dur = 30 }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ walls: true, seed, weapon: subjE ? long : short, weapon2: subjE ? short : long, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const me = subjE ? G.enemy : G.player;
  const foe = subjE ? G.player : G.enemy;
  const ai = subjE ? G.ai : G.ai2;
  const S = instrument(G, ai, me, foe);
  let first = 0; // 1 = 짧은 쪽이 판의 첫 칼날 상처를 냄 · −1 = 긴 쪽
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (!first && r.type !== 'blunt' && (r.severity ?? 0) > 0) first = vic === foe ? 1 : -1;
  };
  let wsum = 0, wn = 0;
  const step = G.step.bind(G);
  G.step = () => { step(); if (ai.digS > 0 && !ai.Mup) { wsum += ai.digW; wn++; } };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(me) && !out(foe)) G.step();
  const r = { seed, T: +G.t.toFixed(2), win: out(foe) && !out(me), lose: out(me) && !out(foe), first, S: { atk: S.atk, entered: S.entered, hits: S.hits, hurtIn: S.hurtIn, recvN: S.recvN, dealtN: S.dealtN }, digS: ai.digS, wMean: wn ? wsum / wn : 0, dig: { ...(ai.stats.dig ?? {}) }, digP: { ...(ai.stats.digP ?? {}) } };
  G.world.free();
  return r;
}

export function table(runs) {
  const L = ['| 짝 (짧은 쪽 AI 대 긴 쪽 AI) | 모자람 m · 길이 몫 s | 숙련 | 판 | 판 수 | 공격 / 판 | 들어간 수 / 판 (첫 칼을 냄) | 첫 상처 짧은 쪽 · 긴 쪽 · 없음 | 맞힌 칼 / 판 | 다가가다 맞음 / 판 | 준 · 받은 칼날 상처 / 판 | 이김 · 짐 · 비김 | 몫 w 평균 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const keys = [...new Set(runs.map((r) => `${r.pair}|${r.prof}|${r.v}`))];
  for (const key of keys) {
    const [pair, prof, v] = key.split('|');
    const rs = runs.filter((r) => `${r.pair}|${r.prof}|${r.v}` === key);
    const n = rs.length;
    const q = (f) => (rs.reduce((s, r) => s + f(r), 0) / n).toFixed(2);
    const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    const f1 = rs.filter((r) => r.first === 1).length, f2 = rs.filter((r) => r.first === -1).length;
    const [a, b] = pair.split(':');
    const sh = rs[0].short;
    L.push(`| ${KO[a] ?? a} 대 ${KO[b] ?? b} | ${sh.toFixed(2)} · ${Math.min(1, sh / CONFIG.DIG_PROTO.reachRef).toFixed(2)} | ${prof} | ${VAR_KO[v] ?? v} | ${n} | ${q((r) => r.S.atk)} | ${q((r) => r.S.entered)} | ${f1} · ${f2} · ${n - f1 - f2} | ${q((r) => r.S.hits)} | ${q((r) => r.S.hurtIn)} | ${q((r) => r.S.dealtN)} · ${q((r) => r.S.recvN)} | ${W} · ${Ls} · ${n - W - Ls} | ${v === 'tilt' ? q((r) => r.wMean) : '-'} |`);
  }
  return L.join('\n');
}

/** 짝의 길이 모자람 (상대 칼 간격 − 내 칼 간격 — AI 간격표) */
function shortOf(short, long) {
  const G = newRound({ seed: 1, weapon: long, weapon2: short, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const v = Math.max(0, G.ai.foeM.reach - G.ai.M.reach);
  G.world.free();
  return v;
}

const main = isMain(import.meta.url);
if (main && args[0] === 'agg') {
  console.log(table(args.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
} else if (main) {
  const pairs = arg('pairs', PAIRS.join(',')).split(',');
  const profs = arg('profs', '3,5').split(',').map(Number);
  const seeds = range(arg('seeds', '1-6'));
  const runs = [];
  for (const pair of pairs) {
    const [short, long] = pair.split(':');
    const sh = shortOf(short, long);
    for (const prof of profs) for (const v of ['now', 'tilt']) for (const seed of seeds) {
      const r = withReach(v === 'tilt' ? 1 : 0, () => fightOne({ short, long, seed, prof }));
      runs.push({ pair, prof, v, short: sh, ...r });
      console.error(pair, prof, v, seed, JSON.stringify({ e: r.S.entered, h: r.S.hits, hi: r.S.hurtIn, w: r.win, l: r.lose, f: r.first, wm: +r.wMean.toFixed(2) }));
    }
  }
  const out = arg('json', null);
  if (out) writeFileSync(out, JSON.stringify(runs));
  console.log(table(runs));
}
