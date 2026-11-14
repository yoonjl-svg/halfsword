// ─────────────────────────────────────────────────────────────
//  cn_step_measure.mjs — 동방 보법 회피 '편섬(偏閃)' 시제품 재기 (11/15 사장님 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · src/cn_step.js · config CN_STEP ·
//   기록 docs/strike/cn_step_2026-11-15.md) — 최소: 동방 AI(환도 · 청강검) 숙련 5 대 롱소드 · 레이피어 · 츠바이핸더 AI 숙련 5 · 씨앗 1 ~ 6 · 30 s · 벽 · 홀수 씨앗 = 동방이 E 자리 ·
//   판 넷 {끔 · ⓐ 꺾어 딛기 · ⓑ 줄임만 · ⓒ 저절로 비킴}: 받은 칼날 심각도(그때 동방 AI 꼴 — 간 보기 · 다가감 · 물러남 · 치는 중 · 막기) · 상대 칼(맞힘 · 막힘 · 빗나감) ·
//   창 · 꺾음 · 박찬 걸음 · 줄인 상처 · 동방 이김 · 짐 · 비김.
//  human — 사람 손가락 봇 동방(청강검 · school_balance fightOne — 상대 롱소드 AI): 봇이 위협을 보면(0.22 s 늦게) 0.2 s 옆 스틱으로 꺾음 — 창 안에 든 몫 · ⓒ 는 봇 입력 없이 비킨 수
//  node tools/sim/cn_step_measure.mjs ai [--weapons=hwando,qinggang] [--foes=longsword,rapier,zweihander] [--vars=0,a,b,c] [--seeds=1-6] [--json=..]
//  node tools/sim/cn_step_measure.mjs agg a.json …   · node tools/sim/cn_step_measure.mjs human [--seeds=1-6]
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] ?? 'ai';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KO = { hwando: '환도', qinggang: '청강검', longsword: '롱소드', rapier: '레이피어', zweihander: '츠바이핸더' };
const VK = { 0: '끔 (지금)', a: 'ⓐ 꺾어 딛기', b: 'ⓑ 줄임만', c: 'ⓒ 저절로 비킴' };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

export function withStep(m, fn) {
  const keep = CONFIG.CN_STEP.mode;
  CONFIG.CN_STEP.mode = m === '0' || m === 0 ? 0 : m;
  try { return fn(); } finally { CONFIG.CN_STEP.mode = keep; }
}

/** 동방 AI 한 판 */
export function aiFight({ weapon, foe, seed, prof = 5, dur = 30 }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const me = subjE ? G.enemy : G.player;
  const op = subjE ? G.player : G.enemy;
  const ai = subjE ? G.ai : G.ai2;
  const oa = subjE ? G.ai2 : G.ai;
  const R = { watch: 0, approach: 0, withdraw: 0, strike: 0, defend: 0, other: 0 };
  const F = { hit: 0, bound: 0, miss: 0 };
  let dealt = 0;
  const af = oa.afterStrike;
  oa.afterStrike = function (...a) { F[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++; return af.apply(this, a); };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (!(sv > 0)) return;
    if (vic === op) dealt += sv;
    if (vic !== me) return;
    const k = ai.mode === 'watch' ? 'watch' : ai.mode === 'withdraw' ? 'withdraw' : ai.mode === 'defend' ? 'defend'
      : ai.mode === 'attack' ? (ai.phase === 'approach' || ai.phase === 'windup' ? 'approach' : 'strike') : 'other';
    R[k] += sv;
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(me) && !out(op)) G.step();
  const r = { weapon, foe, seed, win: out(op) && !out(me), lose: out(me) && !out(op), R, F, dealt, n: { ...(me.cnStep?.n ?? {}) } };
  G.world.free();
  return r;
}

export function aiTable(runs) {
  const L = ['| 동방 AI 대 상대 AI (숙련 5) | 판 | 판 수 | 받은 칼날 심각도 / 판: 간 보기 · 다가감 · 물러남 · 치는 중 · 막기 · 모두 | 상대 칼 / 판: 맞힘 · 막힘 · 빗나감 | 준 심각도 / 판 | 6 판 합: 창 · 꺾음(AI 꺾음) · 박찬 걸음 · 줄인 상처 | 동방 이김 · 짐 · 비김 |',
    '|---|---|---|---|---|---|---|---|'];
  const keys = [...new Set(runs.map((r) => `${r.weapon}|${r.foe}|${r.v}`))];
  for (const key of keys) {
    const [w, fo, v] = key.split('|');
    const rs = runs.filter((r) => `${r.weapon}|${r.foe}|${r.v}` === key);
    const n = rs.length;
    const q = (f) => f2(rs.reduce((x, r) => x + f(r), 0) / n);
    const s = (f) => rs.reduce((x, r) => x + f(r), 0);
    const all = (r) => Object.values(r.R).reduce((a, b) => a + b, 0);
    const W = s((r) => r.win), Ls = s((r) => r.lose);
    L.push(`| ${KO[w] ?? w} 대 ${KO[fo] ?? fo} | ${VK[v] ?? v} | ${n} | ${q((r) => r.R.watch)} · ${q((r) => r.R.approach)} · ${q((r) => r.R.withdraw)} · ${q((r) => r.R.strike)} · ${q((r) => r.R.defend)} · ${q(all)} | ${q((r) => r.F.hit)} · ${q((r) => r.F.bound)} · ${q((r) => r.F.miss)} | ${q((r) => r.dealt)} | ${s((r) => r.n.win ?? 0)} · ${s((r) => r.n.trig ?? 0)}(${s((r) => r.n.aiTurn ?? 0)}) · ${s((r) => (r.n.slide ?? 0))} · ${s((r) => r.n.cut ?? 0)} | ${W} · ${Ls} · ${n - W - Ls} |`);
  }
  return L.join('\n');
}

/** 사람 손가락 봇 동방 — 봇이 위협을 보면(늦게 본 상대가 침 · 칼끝 거리 + 0.8 안) 0.2 실제 s 옆 스틱으로 꺾음 (turn 판) · 아니면 전 봇 */
export async function humanFight({ seed, turn = true, dur = 30 }) {
  const { fightOne } = await import('./school_balance.mjs');
  let P = null, tEnd = -1, side = 1, seenAtk = false;
  const onRound = ({ P: p }) => { P = p; };
  const botHook = turn ? ({ t, sx, sy, seen }) => {
    const atk = !!(seen?.attack && seen.dist < 2.6);
    if (atk && !seenAtk) (tEnd = t + 0.2), (side = -side);
    seenAtk = atk;
    return t <= tEnd ? { sx: side, sy: 0 } : null;
  } : null;
  const r = fightOne({ school: 'chinese', weapon: 'qinggang', opp: 'longsword', seed, dur, onRound, botHook });
  return { seed, turn, win: r.win, lose: r.lose, recv: r.recv, n: { ...(P?.cnStep?.n ?? {}) } };
}

if (isMain(import.meta.url)) {
  if (mode === 'ai') {
    const ws = arg('weapons', 'hwando,qinggang').split(',');
    const foes = arg('foes', 'longsword,rapier,zweihander').split(',');
    const vars = arg('vars', '0,a,b,c').split(',');
    const seeds = range(arg('seeds', '1-6'));
    const runs = [];
    for (const weapon of ws) for (const foe of foes) for (const v of vars) for (const seed of seeds) {
      const r = withStep(v, () => aiFight({ weapon, foe, seed }));
      runs.push({ ...r, v });
      console.error(weapon, foe, v, seed, JSON.stringify({ w: r.win, l: r.lose, n: r.n }));
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(aiTable(runs));
  } else if (mode === 'agg') {
    console.log(aiTable(args.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else if (mode === 'human') {
    const seeds = range(arg('seeds', '1-6'));
    const rows = [];
    for (const [tag, v, turn] of [['끔 · 전 봇', 0, false], ['ⓐ · 꺾는 봇', 'a', true], ['ⓑ · 꺾는 봇', 'b', true], ['ⓒ · 전 봇(꺾지 않음)', 'c', false]]) {
      const keep = CONFIG.CN_STEP.mode;
      CONFIG.CN_STEP.mode = v;
      const rs = [];
      try { for (const seed of seeds) rs.push(await humanFight({ seed, turn })); } finally { CONFIG.CN_STEP.mode = keep; }
      const n = rs.length;
      const s = (f) => rs.reduce((x, r) => x + f(r), 0);
      rows.push(`| ${tag} | ${n} | ${s((r) => r.n.win ?? 0)} · ${s((r) => r.n.trig ?? 0)} · ${s((r) => r.n.slide ?? 0)} · ${s((r) => r.n.auto ?? 0)} · ${s((r) => r.n.cut ?? 0)} | ${f2(s((r) => r.recv) / n)} | ${s((r) => r.win)} · ${s((r) => r.lose)} · ${n - s((r) => r.win) - s((r) => r.lose)} |`);
      console.error(tag, JSON.stringify(rs));
    }
    console.log(['| 사람 손가락 봇 동방(청강검) 대 롱소드 AI | 판 수 | 6 판 합: 창 · 꺾음(창 안) · 박찬 걸음 · 저절로 비킴 · 줄인 상처 | 받은 심각도 / 판 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|', ...rows].join('\n'));
  }
}
