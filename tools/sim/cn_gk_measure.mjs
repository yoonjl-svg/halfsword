// ─────────────────────────────────────────────────────────────
//  cn_gk_measure.mjs — 격살 풀기 재기 (11/15–16 사장님 '격살은 … 무한으로 쓸 수 있게 풀어 … 고노센의 35% … 스택 하나당 +5~8% … 쿨타임' →
//   '기본 빠르기를 35로 하고 쿨타임 3초, 기본 빠르기를 50으로 하고 쿨타임 6초 … 둘 다 재 봐. 최소로.' → 'b안은 격살 겹당 +5%로 해' · config SECRET.gkFree · 기록 docs/strike/cn_gk_2026-11-16.md)
//  판: cur = 지금(판당 1 번 · 0.7 × (1 + 0.08 × 겹)) · A = 0.35 + 0.08 × 겹 · 식힘 3 s · B = 0.50 + 0.05 × 겹 · 식힘 6 s (둘 다 끝없음)
//  ai — 동방 AI(환도 · 청강검) 숙련 5 대 독일 · 이탈리아 · 이베리아 · 일본 AI 숙련 5 (유파마다 대표 무기 둘 — ai_ring_measure.mjs · 짝마다 12 판):
//   이김 몫 · 격살(나감 · 맞힘 · 겹 0 에서 나감) · 동방이 준 · 받은 칼날 심각도 · 격살 칼끝 최고 빠르기(겹 0) · 보통 베기 칼끝 최고 빠르기
//  human — 사람 손가락 봇 동방(환도 · C12 익힘 · school_balance) 대 롱소드 AI · 판마다 6 판: 막기 + 앞 스틱(뜻한 격살) · 앞으로 걸으며 그냥 막기(봇이 그냥 막을 때 반은 스틱 앞 0.7 — 뜻 없는 격살) ·
//   나감 · 맞힘 · 뜻 없는 격살 뒤 1.5 s 동안 받은 심각도
//  node tools/sim/cn_gk_measure.mjs ai [--vars=cur,A,B] [--foes=german,italian,iberian,japanese] [--seeds=1-3] [--json=..] · human [--seeds=1-6] · agg a.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { iaiTipSpeed } from '../../src/secret_instant.js';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'ai';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const K = CONFIG.TIME.k;
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본' };
const TARGET = { german: [35, 65], italian: [15, 45], iberian: [55, 85], japanese: [35, 65] }; // 동방 이김 몫 — 고리 '일본 > 독일 > 이탈리아 > 동방 > 이베리아 > 일본'
const VK = { cur: '지금 (판당 1 번)', A: 'A 0.35 + 0.08 · 3 s', B: 'B 0.50 + 0.05 · 6 s' };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

export function withGk(v, fn) {
  const G = CONFIG.SECRET.gkFree;
  const keep = { ...G };
  if (v === 'A' || v === 'B') Object.assign(G, { on: 1, ...CONFIG.SECRET.gkFreeSets[v] });
  else G.on = 0;
  try { return fn(); } finally { Object.assign(G, keep); }
}

/** 동방 몸 me · 그 AI ai(사람이면 null) 에 격살 셈을 건다 — 나감 · 맞힘 · 겹 · 칼끝 최고 빠르기 */
function gkTap(G, me, op, ai, tally) {
  const st = { fires: [], cur: null, normPeak: [], normCur: null, dealt: 0, taken: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (!(sv > 0)) return;
    if (vic === op && att === me) {
      st.dealt += sv;
      if (st.cur && G.t - st.cur.t < CONFIG.realS(1.5)) st.cur.landed = true;
    }
    if (vic === me) {
      st.taken += sv;
      for (const F of st.fires) if (G.t - F.t >= 0 && G.t - F.t < CONFIG.realS(1.5)) F.after += sv;
    }
  };
  const onFire = () => {
    const F = { t: G.t, n: op.cnHunt?.n ?? 0, landed: false, peak: 0, after: 0, kind: tally?.kind?.() ?? null };
    st.fires.push(F);
    st.cur = F;
  };
  if (ai) {
    const sg = ai.secretGo;
    ai.secretGo = function (S, ctx = {}) {
      const r = sg.call(this, S, ctx);
      if (r && ctx.gk) onFire();
      return r;
    };
  }
  let prevRun = null;
  const step = () => {
    if (!ai) {
      const run = me.skill?.sec ?? null;
      if (run && run !== prevRun && !run.special) onFire();
      prevRun = run;
    }
    const v = me.tipVel ? me.tipVel.length() : 0;
    if (st.cur && G.t - st.cur.t < CONFIG.realS(1.0) && (me.iai || me.iaiReq)) st.cur.peak = Math.max(st.cur.peak, v);
    const striking = ai ? ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow') : !!me.skill?.swinging;
    if (striking && !(me.iai || me.iaiReq)) st.normCur = Math.max(st.normCur ?? 0, v);
    else if (st.normCur != null) (st.normPeak.push(st.normCur), (st.normCur = null));
  };
  return { st, step };
}

/** 동방 AI(무기 wa) 대 유파 AI(무기 wb) — swap 이면 동방이 E 자리 */
export function aiFight({ wa, wb, seed, swap, dur = 30 }) {
  const G = newRound({ seed, walls: true, weapon: swap ? wb : wa, weapon2: swap ? wa : wb, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const me = swap ? G.enemy : G.player;
  const op = swap ? G.player : G.enemy;
  const ai = swap ? G.ai : G.ai2;
  const { st, step } = gkTap(G, me, op, ai, null);
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(me) && !out(op)) { G.step(); step(); }
  const r = { win: out(op) && !out(me), lose: out(me) && !out(op), dealt: st.dealt, taken: st.taken, fires: st.fires.map(({ n, landed, peak }) => ({ n, landed, peak })), normPeak: st.normPeak, iaiV: iaiTipSpeed(me) };
  G.world.free();
  return r;
}

const share = (rs) => (100 * rs.reduce((x, r) => x + (r.win ? 1 : r.lose ? 0 : 0.5), 0)) / Math.max(1, rs.length);
const med = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
export function aiTables(runs) {
  const vs = [...new Set(runs.map((r) => r.v))];
  const L = [`| 동방 대 | 목표 | ${vs.map((v) => VK[v] ?? v).join(' | ')} |`, `|---|---|${vs.map(() => '---').join('|')}|`];
  const inN = Object.fromEntries(vs.map((v) => [v, 0]));
  const foes = [...new Set(runs.map((r) => r.b))];
  for (const b of foes) {
    const T = TARGET[b];
    L.push(`| ${KO[b] ?? b} | ${T[0]} ~ ${T[1]} % | ${vs.map((v) => { const rs = runs.filter((r) => r.b === b && r.v === v); const x = share(rs); const ok = x >= T[0] && x <= T[1]; if (ok) inN[v]++; const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length; return `${x.toFixed(0)} %${ok ? ' ✓' : ''} (${W} · ${Ls} · ${rs.length - W - Ls})`; }).join(' | ')} |`);
  }
  L.push(`| 목표 안 | | ${vs.map((v) => `${inN[v]} / ${foes.length}`).join(' | ')} |`);
  const M = ['| 판 | 판 수 | 격살 / 판: 나감 · 맞힘 · 겹 0 에서 나감 | 준 심각도 / 판 | 받은 심각도 / 판 | 격살 칼끝 최고(가운데 · m/s): 겹 0 · 모두 | 보통 베기 칼끝 최고(가운데 · m/s) | 발도 칼끝 빠르기(환도 · 청강검) |', '|---|---|---|---|---|---|---|---|'];
  for (const v of vs) {
    const rs = runs.filter((r) => r.v === v);
    const n = rs.length;
    const F = rs.flatMap((r) => r.fires);
    const iai = {};
    for (const r of rs) iai[r.wa] ??= r.iaiV;
    M.push(`| ${VK[v] ?? v} | ${n} | ${f2(F.length / n)} · ${f2(F.filter((x) => x.landed).length / n)} · ${f2(F.filter((x) => x.n === 0).length / n)} | ${f2(rs.reduce((a, r) => a + r.dealt, 0) / n)} | ${f2(rs.reduce((a, r) => a + r.taken, 0) / n)} | ${f2(med(F.filter((x) => x.n === 0 && x.peak > 0).map((x) => x.peak)))} · ${f2(med(F.filter((x) => x.peak > 0).map((x) => x.peak)))} | ${f2(med(rs.flatMap((r) => r.normPeak)))} | ${Object.entries(iai).map(([w, x]) => `${w} ${f2(x)}`).join(' · ')} |`);
  }
  return `${L.join('\n')}\n\n${M.join('\n')}`;
}

/** 사람 손가락 봇 — 그냥 막기(스틱 앞 아님)마다 반은 앞으로 걸으며 막음(스틱 앞 0.7) · 막기 + 앞 스틱 1 은 뜻한 격살 */
let fightOne = null;
export function humanFight({ seed, dur = 30 }) {
  let G = null, P = null, A = null, tap = null;
  let guardKind = 'none', prevPress = false, lcg = (seed * 2654435761) >>> 0;
  const rnd = () => ((lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0) / 4294967296);
  const onRound = (o) => { G = o.G; P = o.P; A = o.A; tap = gkTap(G, P, A, null, { kind: () => guardKind }); };
  const botHook = ({ sx, sy, guardPress }) => {
    tap?.step();
    if (guardPress && !prevPress) guardKind = sy >= 0.99 ? 'intended' : rnd() < 0.5 ? 'walk' : 'plain'; // 마지막 막기의 뜻 (격살은 칼이 갈라진 뒤 나가 단추를 뗀 뒤일 수 있음 — 다음 누름까지 둠)
    prevPress = guardPress;
    return guardPress && guardKind === 'walk' ? { sx, sy: 0.7, guardPress } : null;
  };
  const r = fightOne({ school: 'chinese', weapon: 'hwando', opp: 'longsword', seed, dur, onRound, botHook });
  const F = tap.st.fires;
  return { seed, win: r.win, lose: r.lose, recv: r.recv, dealt: tap.st.dealt, taken: tap.st.taken, fires: F.map(({ n, landed, after, kind }) => ({ n, landed, after, kind })) };
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    console.log(aiTables(args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else if (mode === 'human') {
    fightOne = (await import('./school_balance.mjs')).fightOne;
    const seeds = range(arg('seeds', '1-6'));
    const L = ['| 사람 봇 동방(환도 · C12) 대 롱소드 AI | 판 수 | 격살 나감(마지막 막기의 뜻): 뜻함 · 걸으며 막다 · 그 밖 | 맞힘: 뜻함 · 걸으며 막다 | 걸으며 막다 나간 격살 뒤 1.5 s 받은 심각도 (나감 하나당) | 받은 · 준 심각도 / 판 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|---|'];
    for (const v of arg('vars', 'cur,A,B').split(',')) {
      const rs = seeds.map((seed) => withGk(v, () => humanFight({ seed })));
      const F = rs.flatMap((r) => r.fires);
      const c = (k) => F.filter((x) => x.kind === k);
      const n = rs.length;
      const walk = c('walk');
      const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
      L.push(`| ${VK[v] ?? v} | ${n} | ${c('intended').length} · ${walk.length} · ${F.length - c('intended').length - walk.length} | ${c('intended').filter((x) => x.landed).length} · ${walk.filter((x) => x.landed).length} | ${walk.length ? f2(walk.reduce((a, x) => a + x.after, 0) / walk.length) : '-'} | ${f2(rs.reduce((a, r) => a + r.taken, 0) / n)} · ${f2(rs.reduce((a, r) => a + r.dealt, 0) / n)} | ${W} · ${Ls} · ${n - W - Ls} |`);
      console.error(v, JSON.stringify(rs.map((r) => [r.seed, r.fires.length])));
    }
    console.log(L.join('\n'));
  } else {
    const vars = arg('vars', 'cur,A,B').split(',');
    const foes = arg('foes', 'german,italian,iberian,japanese').split(',');
    const seeds = range(arg('seeds', '1-3'));
    const runs = [];
    for (const b of foes) for (const v of vars) {
      let ci = 0;
      for (const wa of WEAPONS.chinese) for (const wb of WEAPONS[b]) {
        for (const seed of seeds) {
          const swap = (ci + seed) % 2 === 1;
          const r = withGk(v, () => aiFight({ wa, wb, seed, swap }));
          runs.push({ a: 'chinese', b, wa, wb, seed, swap, v, ...r });
          console.error(b, v, wa, wb, seed, r.win ? 'W' : r.lose ? 'L' : 'D', r.fires.length);
        }
        ci++;
      }
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(aiTables(runs));
  }
}
