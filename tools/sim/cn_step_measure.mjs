// ─────────────────────────────────────────────────────────────
//  cn_step_measure.mjs — 동방 보법 회피 '편섬(偏閃)' 재기 (11/15 사장님 '방향을 꺾은 순간으로 하자. 그렇다고 항상 켜지면 안돼. 0.4초 50% 감소.' ·
//   '동방 유파 설계에 이것도 감안한 전투 스타일과 뛰어들기가 나오도록 해' · 첫 안 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · src/cn_step.js · ai_plan_cn.js cnDive ·
//   config CN_STEP · 기록 docs/strike/cn_step_2026-11-15.md)
//  ai — 동방 AI(환도 · 청강검) 숙련 5 대 유파 AI 숙련 5(롱소드 독일 · 레이피어 이탈리아 · 츠바이핸더 이베리아 · 우치가타나 일본) · 씨앗 · 30 s · 벽 · 홀수 씨앗 = 동방이 E 자리 ·
//   판: 0 끔 · turn 꺾음만(AI 뛰어들기 없음) · dive 꺾음 + 偏閃奏進 · (견줌 a · b · c 첫 시제품): 받은 칼날 심각도(그때 동방 AI 꼴) · 상대 칼(맞힘 · 막힘 · 빗나감) · 준 심각도 ·
//   꺾음 줄임이 켜진 몫 · 건 수 · 줄인 상처 · 뛰어들기(굴려 나옴 · 낸 칼 · 맞힘) · 동방 이김 · 짐 · 비김 · 이김 몫(비김 반)
//  human — 사람 손가락 봇 동방(청강검 · school_balance fightOne — 상대 롱소드 AI): 끔 · 꺾음(전 봇) · 꺾음(꺾는 봇 — 상대가 치는 것을 보면 0.2 s 옆 스틱)
//  zig — 지그재그 봇(스틱을 왼앞 · 오른앞 대각으로 늘 번갈아 — 0.2 · 0.4 s 마다): 한도 없음 · 다시 걸기 0.6 · 1.2 s · 곧게 걸음 0.4 · 0.6 s — 꺾음 줄임이 켜진 몫
//  node tools/sim/cn_step_measure.mjs ai [--weapons=hwando,qinggang] [--foes=longsword,rapier,zweihander,uchigatana] [--vars=0,turn,dive] [--seeds=1-6] [--json=..]
//  node tools/sim/cn_step_measure.mjs agg a.json …   · node tools/sim/cn_step_measure.mjs human [--seeds=1-6] · node tools/sim/cn_step_measure.mjs zig [--seeds=1-3]
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] ?? 'ai';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KO = { hwando: '환도', qinggang: '청강검', longsword: '롱소드 (독일)', rapier: '레이피어 (이탈리아)', zweihander: '츠바이핸더 (이베리아)', uchigatana: '우치가타나 (일본)' };
/** 사장님 고리 '일본 > 독일 > 이탈리아 > 동방 > 이베리아 > 일본' — 동방 이김 몫 목표 (이기는 쪽 55 ~ 85 % · 나머지 35 ~ 65 %) */
const TARGET = { longsword: [35, 65], rapier: [15, 45], zweihander: [55, 85], uchigatana: [35, 65] };
const VK = { 0: '끔', turn: '꺾음만', dive: '꺾음 + 偏閃奏進', a: 'ⓐ 꺾어 딛기', b: 'ⓑ 줄임만', c: 'ⓒ 저절로 비킴' };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

/** 판 v 로 fn: '0' 끔 · 'turn' 꺾음만(AI 뛰어들기 0) · 'dive' 꺾음 + 뛰어들기 · 'a' 'b' 'c' 첫 시제품 */
export function withStep(v, fn) {
  const keep = CONFIG.CN_STEP.mode;
  const keepD = CONFIG.AI_PLAN.cn.dive;
  CONFIG.CN_STEP.mode = v === '0' || v === 0 ? 0 : v === 'dive' ? 'turn' : v;
  CONFIG.AI_PLAN.cn.dive = v === 'dive' ? keepD || 1 : 0;
  try { return fn(); } finally { CONFIG.CN_STEP.mode = keep; CONFIG.AI_PLAN.cn.dive = keepD; }
}
/** 값 몇 개를 잠깐 바꿔 fn (지그재그 한도 견줌) */
function withVals(o, fn) {
  const keep = { ...CONFIG.CN_STEP };
  Object.assign(CONFIG.CN_STEP, o);
  try { return fn(); } finally { Object.assign(CONFIG.CN_STEP, keep); }
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
  const DV = { hit: 0, bound: 0, miss: 0 };
  const af = oa.afterStrike;
  oa.afterStrike = function (...a) { F[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++; return af.apply(this, a); };
  const mf = ai.afterStrike;
  ai.afterStrike = function (...a) { if (this.why === 'dive') DV[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++; return mf.apply(this, a); };
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
  const c = ai.stats.cn ?? {};
  const r = { weapon, foe, seed, win: out(op) && !out(me), lose: out(me) && !out(op), R, F, dealt, n: { ...(me.cnStep?.n ?? {}) }, dv: { roll: c.diveRoll ?? 0, yes: c.dive ?? 0, go: c.diveGo ?? 0, ...DV } };
  G.world.free();
  return r;
}

const share = (rs) => (100 * rs.reduce((x, r) => x + (r.win ? 1 : r.lose ? 0 : 0.5), 0)) / Math.max(1, rs.length);
export function aiTable(runs) {
  const L = ['| 동방 AI 대 상대 AI (숙련 5) | 판 | 판 수 | 받은 칼날 심각도 / 판: 간 보기 · 다가감 · 물러남 · 치는 중 · 막기 · 모두 | 상대 칼 / 판: 맞힘 · 막힘 · 빗나감 | 준 심각도 / 판 | 줄임 켜진 몫 · 건 수 / 판 · 줄인 상처 합 | 뛰어들기 합: 굴림 · 나옴 · 낸 칼 · 맞힘 | 동방 이김 · 짐 · 비김 | 이김 몫 (비김 반) |',
    '|---|---|---|---|---|---|---|---|---|---|'];
  const keys = [...new Set(runs.map((r) => `${r.weapon}|${r.foe}|${r.v}`))];
  for (const key of keys) {
    const [w, fo, v] = key.split('|');
    const rs = runs.filter((r) => `${r.weapon}|${r.foe}|${r.v}` === key);
    L.push(row(`${KO[w] ?? w} 대 ${KO[fo] ?? fo}`, VK[v] ?? v, rs));
  }
  return L.join('\n');
}
function row(a, b, rs) {
  const n = rs.length;
  const q = (f) => f2(rs.reduce((x, r) => x + f(r), 0) / n);
  const s = (f) => rs.reduce((x, r) => x + f(r), 0);
  const all = (r) => Object.values(r.R).reduce((x, y) => x + y, 0);
  const W = s((r) => r.win), Ls = s((r) => r.lose);
  const onT = s((r) => r.n.onT ?? 0), T = s((r) => r.n.T ?? 0);
  return `| ${a} | ${b} | ${n} | ${q((r) => r.R.watch)} · ${q((r) => r.R.approach)} · ${q((r) => r.R.withdraw)} · ${q((r) => r.R.strike)} · ${q((r) => r.R.defend)} · ${q(all)} | ${q((r) => r.F.hit)} · ${q((r) => r.F.bound)} · ${q((r) => r.F.miss)} | ${q((r) => r.dealt)} | ${T > 0 ? ((100 * onT) / T).toFixed(0) : '-'} % · ${q((r) => r.n.trig ?? 0)} · ${s((r) => r.n.cut ?? 0)} | ${s((r) => r.dv?.roll ?? 0)} · ${s((r) => r.dv?.yes ?? 0)} · ${s((r) => r.dv?.go ?? 0)} · ${s((r) => r.dv?.hit ?? 0)} | ${W} · ${Ls} · ${n - W - Ls} | ${share(rs).toFixed(0)} % |`;
}
/** 상대(유파)마다 판 셋 이김 몫 · 목표 */
export function ringTable(runs) {
  const vs = [...new Set(runs.map((r) => r.v))];
  const L = [`| 동방 대 | 목표 (동방 이김 몫) | ${vs.map((v) => VK[v] ?? v).join(' | ')} |`, `|---|---|${vs.map(() => '---').join('|')}|`];
  for (const fo of [...new Set(runs.map((r) => r.foe))]) {
    const T = TARGET[fo];
    L.push(`| ${KO[fo] ?? fo} | ${T ? `${T[0]} ~ ${T[1]} %` : '-'} | ${vs.map((v) => { const rs = runs.filter((r) => r.foe === fo && r.v === v); const x = share(rs); const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length; return `${x.toFixed(0)} %${T && x >= T[0] && x <= T[1] ? ' ✓' : ''} (${W} · ${Ls} · ${rs.length - W - Ls})`; }).join(' | ')} |`);
  }
  const rs = (v) => runs.filter((r) => r.v === v);
  L.push(`| 모두 | | ${vs.map((v) => { const x = rs(v); const n = x.length; const sum = (f) => x.reduce((a, r) => a + f(r), 0) / n; return `받은 ${f2(sum((r) => Object.values(r.R).reduce((a, b) => a + b, 0)))} · 준 ${f2(sum((r) => r.dealt))} · 빗나감 ${f2(sum((r) => r.F.miss))}`; }).join(' | ')} |`);
  return L.join('\n');
}

/** 사람 손가락 봇 동방 — turn 판: 봇이 위협을 보면(늦게 본 상대가 침 · 2.6 m 안) 0.2 실제 s 옆 스틱으로 꺾음 · zig 판: 스틱을 늘 왼앞 · 오른앞으로 번갈아(zig 실제 s 마다) · 아니면 전 봇 */
let fightOne = null; // school_balance.mjs (human · zig 판에서만 부름 — loadHuman)
export async function loadHuman() {
  fightOne ??= (await import('./school_balance.mjs')).fightOne;
}
export function humanFight({ seed, turn = false, zig = 0, dur = 30 }) {
  let P = null, tEnd = -1, side = 1, seenAtk = false;
  const onRound = ({ P: p }) => { P = p; };
  const botHook = zig > 0 ? ({ t }) => ({ sx: Math.floor(t / zig) % 2 ? 0.7 : -0.7, sy: 0.7 })
    : turn ? ({ t, seen }) => {
      const atk = !!(seen?.attack && seen.dist < 2.6);
      if (atk && !seenAtk) (tEnd = t + 0.2), (side = -side);
      seenAtk = atk;
      return t <= tEnd ? { sx: side, sy: 0 } : null;
    } : null;
  const r = fightOne({ school: 'chinese', weapon: 'qinggang', opp: 'longsword', seed, dur, onRound, botHook });
  return { seed, turn, zig, win: r.win, lose: r.lose, recv: r.recv, n: { ...(P?.cnStep?.n ?? {}) } };
}
function humanRow(tag, rs) {
  const n = rs.length;
  const s = (f) => rs.reduce((x, r) => x + f(r), 0);
  const T = s((r) => r.n.T ?? 0);
  return `| ${tag} | ${n} | ${T > 0 ? ((100 * s((r) => r.n.onT ?? 0)) / T).toFixed(0) : '-'} % | ${s((r) => r.n.turn ?? 0)} · ${s((r) => r.n.trig ?? 0)} · ${s((r) => r.n.block ?? 0)} · ${s((r) => r.n.cut ?? 0)} | ${f2(s((r) => r.recv) / n)} | ${s((r) => r.win)} · ${s((r) => r.lose)} · ${n - s((r) => r.win) - s((r) => r.lose)} |`;
}
const HUMAN_HEAD = ['| 사람 손가락 봇 동방(청강검) 대 롱소드 AI | 판 수 | 줄임 켜진 몫 | 합: 꺾음 · 건 수 · 한도에 막힘 · 줄인 상처 | 받은 심각도 / 판 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|'];

if (isMain(import.meta.url)) {
  if (mode === 'ai') {
    const ws = arg('weapons', 'hwando,qinggang').split(',');
    const foes = arg('foes', 'longsword,rapier,zweihander,uchigatana').split(',');
    const vars = arg('vars', '0,turn,dive').split(',');
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
    console.log('');
    console.log(ringTable(runs));
  } else if (mode === 'agg') {
    const all = args.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(aiTable(all));
    console.log('');
    console.log(ringTable(all));
  } else if (mode === 'human') {
    await loadHuman();
    const seeds = range(arg('seeds', '1-6'));
    const rows = [];
    for (const [tag, v, turn] of [['끔 · 전 봇', '0', false], ['꺾음 · 전 봇', 'turn', false], ['꺾음 · 꺾는 봇', 'turn', true]]) {
      const rs = [];
      for (const seed of seeds) rs.push(withStep(v, () => humanFight({ seed, turn })));
      rows.push(humanRow(tag, rs));
      console.error(tag, JSON.stringify(rs.map((r) => [r.seed, r.win, r.lose, +r.recv.toFixed(3), r.n.trig ?? 0])));
    }
    console.log([...HUMAN_HEAD, ...rows].join('\n'));
  } else if (mode === 'zig') {
    await loadHuman();
    const seeds = range(arg('seeds', '1-3'));
    const rows = [];
    const lims = [['한도 없음', { rearm: 0, straight: 0 }], ['다시 걸기 0.6 s', { rearm: CONFIG.realS(0.6), straight: 0 }], ['다시 걸기 1.2 s (권고)', { rearm: CONFIG.realS(1.2), straight: 0 }], ['곧게 걸음 0.4 s', { rearm: 0, straight: CONFIG.realS(0.4) }], ['곧게 걸음 0.6 s', { rearm: 0, straight: CONFIG.realS(0.6) }]];
    for (const zig of arg('zigs', '0.2,0.4,0.6').split(',').map(Number)) for (const [tag, o] of lims) {
      const rs = [];
      for (const seed of seeds) rs.push(withStep('turn', () => withVals(o, () => humanFight({ seed, zig }))));
      rows.push(humanRow(`지그재그 ${zig} s · ${tag}`, rs));
      console.error(zig, tag, JSON.stringify(rs.map((r) => [r.seed, r.n.onT && +(r.n.onT / r.n.T).toFixed(3), r.n.trig])));
    }
    console.log([...HUMAN_HEAD, ...rows].join('\n'));
  }
}
