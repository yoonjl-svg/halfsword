// ─────────────────────────────────────────────────────────────
//  cn_block_measure.mjs — 동방 막기 재기 (11/15 사장님 '동방의 장점은 막을 때 피해 50% 감소인데 막기를 잘 활용 못하는 거 아닐까? 막기를 쓰면 오히려 격살을
//   소모하게 될 위험도 있고.. 타격이 강해서 막기 자체가 별로 쓸모가 없나?' · 기록 docs/strike/cn_block_2026-11-15.md · 시제품 src/ai_block_cut.js · SKILL.aiParryCut)
//  ai    — 동방 AI(환도 · 청강검) 숙련 5 대 롱소드 · 츠바이핸더 · 레이피어 AI 숙련 5 · 씨앗 1 ~ 6 · 30 s · 벽 · 홀수 씨앗 = 동방이 E 자리 · 판마다 시제품 끔(지금) · 켬:
//          막기(칼로 받기) · 피하기 수 · 받은 칼날 상처(수 · 심각도) — 막는 중 · 피하는 중 · 공격 중 · 그 밖 · 상대 칼 맞힘 · 막힘 · 헛침 · 격살(나서며 막기 · 뚫림 · 냄 · 맞힘 · 그 뒤 판)
//  pair  — 상성 짝 견줌(시제품 끔 · 켬): --pairs=hwando:longsword,… 의 앞 = E 자리가 아니라 홀수 씨앗 E · 숙련 5 · 씨앗 1 ~ 6 — 이김 · 짐 · 비김 · 받은 심각도
//  human — 사람 손가락 봇 동방(청강검 · school_balance.mjs fightOne — 상대 롱소드 AI 숙련 3): 막기 단추로 막는 중 받은 칼날 상처 · 감소 0.5(지금) · 0(뺀 판) ·
//          격살이 봇 뜻(막기 + 앞 스틱)과 다르게 나갔나 — walk 판: 그냥 막기도 걸어 들어가는 스틱(0.7)을 쥔 채 누름
//  node tools/sim/cn_block_measure.mjs ai [--weapons=hwando,qinggang] [--foes=longsword,zweihander,rapier] [--seeds=1-6] [--json=..]
//  node tools/sim/cn_block_measure.mjs human [--seeds=1-6]
//  ib    — 이베리아 막아 내면 기력 되찾음 (11/15): 츠바이핸더 AI 숙련 5 대 롱소드 · 레이피어 · 환도 AI · 씨앗 1 ~ 6 — 20 % 옛 판 · ⓐ 고정 30 · ⓑ 상대 베기 × 2
//  node tools/sim/cn_block_measure.mjs ib [--foes=longsword,rapier,hwando] [--seeds=1-6] [--json=..]
//  cnib  — 동방 대 이베리아만 (11/15 사장님 덧붙임): 환도 · 청강검 AI 대 츠바이핸더 AI · 숙련 5 · 씨앗 1 ~ 12 × 자리 둘 × {ⓐ 고정 30 · ⓑ 상대 베기 × 2}
//  node tools/sim/cn_block_measure.mjs cnib [--weapons=hwando,qinggang] [--seeds=1-12] [--json=..]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] ?? 'ai';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KO = { hwando: '환도', qinggang: '청강검', longsword: '롱소드', zweihander: '츠바이핸더', rapier: '레이피어', uchigatana: '우치가타나', monohoshizao: '모노호시자오' };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

export function withCut(on, fn) {
  const S = CONFIG.SKILL;
  const keep = S.aiParryCut;
  S.aiParryCut = on;
  try { return fn(); } finally { S.aiParryCut = keep; }
}

/** AI 대 AI 한 판 — subject(동방 등) AI 의 막기 · 맞음 · 격살 */
export function aiFight({ weapon, foe, seed, prof = 5, dur = 30 }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const me = subjE ? G.enemy : G.player;
  const op = subjE ? G.player : G.enemy;
  const ai = subjE ? G.ai : G.ai2;
  const oa = subjE ? G.ai2 : G.ai;
  const W = { def: [0, 0], void: [0, 0], atk: [0, 0], other: [0, 0], dealt: [0, 0] };
  const F = { strikes: 0, hit: 0, bound: 0, miss: 0 };
  const GK = { fired: 0, hit: 0, sev: 0, kill3: 0, at: [], after: null };
  let gkT = null;
  const af = oa.afterStrike;
  oa.afterStrike = function (...a) {
    F.strikes++;
    F[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++;
    return af.apply(this, a);
  };
  const sg = ai.secretGo;
  ai.secretGo = function (S, ctx = {}) {
    const r = sg.call(this, S, ctx);
    if (r && ctx.gk) {
      GK.fired++;
      gkT = G.t;
      GK.at.push(+G.t.toFixed(1));
    }
    return r;
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (!(sv > 0)) return;
    if (vic === me) {
      const k = ai.mode === 'defend' ? (ai.defVoid ? 'void' : 'def') : ai.mode === 'attack' || ai.mode === 'secret' ? 'atk' : 'other';
      W[k][0]++;
      W[k][1] += sv;
    } else if (vic === op) {
      W.dealt[0]++;
      W.dealt[1] += sv;
      if (gkT != null && G.t - gkT <= 1.5) (GK.hit++, (GK.sev += sv));
    }
  };
  const out = (f) => !f.alive || f.state === 'dead';
  let tEnd = dur;
  while (G.t < dur && !out(me) && !out(op)) G.step();
  tEnd = G.t;
  if (gkT != null && out(op) && tEnd - gkT <= 3) GK.kill3 = 1;
  const st = ai.stats;
  const r = {
    weapon, foe, seed, T: +tEnd.toFixed(1), win: out(op) && !out(me), lose: out(me) && !out(op),
    parries: st.parries ?? 0, voids: st.voids ?? 0, W, F, gkTry: st.gkTry ?? 0, gk: { ...(st.gk ?? {}) }, GK,
    blood: [+me.blood.toFixed(3), +op.blood.toFixed(3)],
  };
  G.world.free();
  return r;
}

export function aiTable(runs) {
  const L = ['| 동방 AI 대 상대 AI (숙련 5) | 판 | 판 수 | 막기 · 피하기 / 판 | 상대 칼 / 판: 맞힘 · 막힘 · 헛침 | 받은 칼날 상처 수 / 판: 막는 중 · 피하는 중 · 공격 중 · 그 밖 | 받은 심각도 / 판: 막는 중 · 모두 | 준 상처 수 · 심각도 / 판 | 나서며 막기 6 판 합: 시도 · 닿음 · 뚫림 · 늦음/앞 아님/느림/받은 자세 없음 | 격살 6 판 합: 냄 · 1.5 s 안 맞힘 · 3 s 안 쓰러뜨림 | 이김 · 짐 · 비김 |',
    '|---|---|---|---|---|---|---|---|---|---|---|'];
  const keys = [...new Set(runs.map((r) => `${r.weapon}|${r.foe}|${r.v}`))];
  for (const key of keys) {
    const [w, fo, v] = key.split('|');
    const rs = runs.filter((r) => `${r.weapon}|${r.foe}|${r.v}` === key);
    const n = rs.length;
    const q = (f) => f2(rs.reduce((s, r) => s + f(r), 0) / n);
    const s = (f) => rs.reduce((x, r) => x + f(r), 0);
    const Wn = s((r) => r.win), Ln = s((r) => r.lose);
    const allSev = (r) => r.W.def[1] + r.W.void[1] + r.W.atk[1] + r.W.other[1];
    L.push(`| ${KO[w] ?? w} 대 ${KO[fo] ?? fo} | ${v === 'on' ? '시제품 켬' : '지금'} | ${n} | ${q((r) => r.parries)} · ${q((r) => r.voids)} | ${q((r) => r.F.hit)} · ${q((r) => r.F.bound)} · ${q((r) => r.F.miss)} | ${q((r) => r.W.def[0])} · ${q((r) => r.W.void[0])} · ${q((r) => r.W.atk[0])} · ${q((r) => r.W.other[0])} | ${q((r) => r.W.def[1])} · ${q(allSev)} | ${q((r) => r.W.dealt[0])} · ${q((r) => r.W.dealt[1])} | ${s((r) => r.gkTry)} · ${s((r) => r.gk.edges ?? 0)} · ${s((r) => r.gk.cut ?? 0)} · ${s((r) => (r.gk.late ?? 0))}/${s((r) => r.gk.notFwd ?? 0)}/${s((r) => r.gk.slow ?? 0)}/${s((r) => r.gk.noStance ?? 0)} | ${s((r) => r.GK.fired)} · ${s((r) => r.GK.hit)} · ${s((r) => r.GK.kill3)} | ${Wn} · ${Ln} · ${n - Wn - Ln} |`);
  }
  return L.join('\n');
}

/** 사람 손가락 봇 동방 한 판 — 막기 단추로 막는 중 받은 칼날 상처 · 격살이 봇 뜻과 다르게 나갔나 */
export async function humanFight({ seed, opp = 'longsword', walk = false, dur = 30 }) {
  const { fightOne } = await import('./school_balance.mjs');
  const H = { defN: 0, defSev: 0, allN: 0, allSev: 0, gkOpen: 0, gkMeant: 0, gkNotMeant: 0 };
  let guard = null, W = null, act = null, lastOpen = 0, lastPend = 0, lastGuard = null, lastGuardT = 0;
  const pendMeant = [];
  const probe = {
    init: ({ G, P, guard: g, W: w }) => {
      guard = g;
      W = w;
      const pw = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, ...rest) => {
        pw?.(att, vic, r, ...rest);
        const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
        if (vic !== P || !(sv > 0)) return;
        H.allN++;
        H.allSev += sv;
        if (guard.mode === 'defend') (H.defN++, (H.defSev += sv));
      };
    },
    step: (cur, a) => {
      act = a;
      if (a?.kind === 'guard' && a !== lastGuard) (lastGuard = a), (lastGuardT = cur?.t ?? 0); // 마지막 막기 (격살 창은 칼이 갈라질 때 열려 막기 손이 이미 끝났을 수 있음)
      const pend = W?.pc?.gk?.pend ?? 0;
      if (pend > lastPend) {
        // 받아 냄 기다림이 생긴 때(칼이 닿은 스텝 — 격살 조건 ① ~ ⑤ 를 다 채움)의 막기 손이 봇 뜻(막기 + 앞 스틱 — act.want 비기)인가
        pendMeant.push(!!(lastGuard?.want && lastGuard.fwd === 1));
        lastPend = pend;
      }
      const open = W?.pc?.gk?.open ?? 0;
      if (open > lastOpen) {
        for (let i = lastOpen; i < open; i++) {
          H.gkOpen++;
          if (pendMeant.at(-1)) H.gkMeant++;
          else H.gkNotMeant++;
        }
        lastOpen = open;
      }
    },
    done: () => H,
  };
  // walk 판: 그냥 막기(앞 스틱이 없는 막기)도 걸어 들어가는 스틱 0.7 을 쥔 채 누름 — 다가가며 막는 사람 손
  const botHook = walk ? ({ sy, guardPress, seen }) => (guardPress && sy <= 0 && seen && seen.dist > 1.2 ? { sy: 0.7 } : null) : null;
  const r = fightOne({ school: 'chinese', weapon: 'qinggang', opp, seed, dur, probe, botHook });
  return { seed, walk, win: r.win, lose: r.lose, recv: r.recv, recvN: r.recvN, dealt: r.dealt, secretFired: r.secretFired, H: r.probe };
}


/** 이베리아 막아 내면 기력 되찾음 (11/15 사장님 '이베리아도 막기 20% 감소 없애. 대신 막기에 성공하면 기력 n 회복 어때.') — 츠바이핸더 AI 대 상대 AI · 숙련 5
 *  판: cut20 = 20 % 감소 옛 판(사람과 같게 — aiParryCut 1 · ibParryDmgCut 0.2 · 되찾음 끔) · fixed = ⓐ 고정 30 · foe2 = ⓑ 상대 베기 기력 × 2 (사장님 11/15) */
export const IB_VARS = { cut20: { aiParryCut: 1, ibParryDmgCut: 0.2, ibBlockRegen: 0, ibBlockRegenN: 'fixed' }, fixed: { aiParryCut: 0, ibParryDmgCut: 0, ibBlockRegen: 1, ibBlockRegenN: 'fixed' }, foe2: { aiParryCut: 0, ibParryDmgCut: 0, ibBlockRegen: 1, ibBlockRegenN: 'foe2' } };
export function ibFight({ foe, seed, v, prof = 5, dur = 30, slotE = null }) {
  const S = CONFIG.SKILL;
  const keep = { aiParryCut: S.aiParryCut, ibParryDmgCut: S.ibParryDmgCut, ibBlockRegen: S.ibBlockRegen, ibBlockRegenN: S.ibBlockRegenN };
  Object.assign(S, IB_VARS[v]);
  try {
    const subjE = slotE ?? seed % 2 === 1; // 자리 (null = 홀수 씨앗이 E — 다른 재기와 같음)
    const G = newRound({ seed, walls: true, weapon: subjE ? foe : 'zweihander', weapon2: subjE ? 'zweihander' : foe, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
    const me = subjE ? G.enemy : G.player;
    const op = subjE ? G.player : G.enemy;
    const ai = subjE ? G.ai : G.ai2;
    let stMin = Infinity, stSum = 0, n = 0, restN = 0, wasRest = false;
    const out = (f) => !f.alive || f.state === 'dead';
    while (G.t < dur && !out(me) && !out(op)) {
      G.step();
      if (ai.staminaRest && !wasRest) restN++; // 기력 쉼 문턱에 닿아 새 공격을 멈춤 (바닥 쪽)
      wasRest = !!ai.staminaRest;
      stMin = Math.min(stMin, me.stamina.value);
      stSum += me.stamina.value;
      n++;
    }
    const st = ai.stats;
    const r = { foe, seed, v, slotE: subjE, win: out(op) && !out(me), lose: out(me) && !out(op), block: me.stamina.counts.block ?? 0, regenN: me.stamina.counts.blockRegen ?? 0, regenSum: me.stamina.blockRegenSum ?? 0,
      chain: st.ib?.cont ?? 0, link: st.ibLink?.fired ?? 0, altib: st.altib?.fired ?? 0, stMin, stMean: stSum / Math.max(1, n), restN, exh: me.stamina.counts.exhaustion ?? 0, recv: me.wounds.filter((w) => w.severity > 0).length };
    G.world.free();
    return r;
  } finally {
    Object.assign(S, keep);
  }
}
export function ibTable(runs) {
  const VK = { cut20: '20 % 감소 옛 판 (사람과 같게)', fixed: 'ⓐ 고정 30', foe2: 'ⓑ 상대 베기 × 2' };
  const L = ['| 츠바이핸더 AI 대 상대 AI (숙련 5) | 판 | 판 수 | 막아 받음 / 판 | 막아 냄(되찾음) / 판 · 되찾은 기력 / 판 | 사슬 이음 / 판 | 이어 돌리기 / 판 | 알티바슈 / 판 | 기력 가장 낮음 · 평균 | 쉼 문턱 닿음 · 탈진 / 판 | 받은 칼날 상처 / 판 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const fo of [...new Set(runs.map((r) => r.foe))]) for (const v of ['cut20', 'fixed', 'foe2']) {
    const rs = runs.filter((r) => r.foe === fo && r.v === v);
    if (!rs.length) continue;
    const k = rs.length;
    const q = (f) => f2(rs.reduce((x, r) => x + f(r), 0) / k);
    const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
    L.push(`| 츠바이핸더 대 ${KO[fo] ?? fo} | ${VK[v]} | ${k} | ${q((r) => r.block)} | ${q((r) => r.regenN)} · ${q((r) => r.regenSum)} | ${q((r) => r.chain)} | ${q((r) => r.link)} | ${q((r) => r.altib)} | ${q((r) => r.stMin)} · ${q((r) => r.stMean)} | ${q((r) => r.restN)} · ${q((r) => r.exh)} | ${q((r) => r.recv)} | ${W} · ${Ls} · ${k - W - Ls} |`);
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'ai' || mode === 'pair') {
    const ws = arg('weapons', 'hwando,qinggang').split(',');
    const foes = arg('foes', 'longsword,zweihander,rapier').split(',');
    const seeds = range(arg('seeds', '1-6'));
    const vars = arg('vars', 'off,on').split(',');
    const runs = [];
    for (const weapon of ws) for (const foe of foes) for (const v of vars) for (const seed of seeds) {
      const r = withCut(v === 'on' ? 1 : 0, () => aiFight({ weapon, foe, seed }));
      runs.push({ ...r, v });
      console.error(weapon, foe, v, seed, JSON.stringify({ p: r.parries, vo: r.voids, def: r.W.def, w: r.win, l: r.lose, gk: r.GK.fired }));
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(aiTable(runs));
  } else if (mode === 'ib') {
    const foes = arg('foes', 'longsword,rapier,hwando').split(',');
    const seeds = range(arg('seeds', '1-6'));
    const runs = [];
    for (const foe of foes) for (const v of ['cut20', 'fixed', 'foe2']) for (const seed of seeds) {
      const r = ibFight({ foe, seed, v });
      runs.push(r);
      console.error(foe, v, seed, JSON.stringify(r));
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(ibTable(runs));
  } else if (mode === 'cnib') {
    // 11/15 사장님 '상대 무기를 배율로 하는 건 최대한 동방에게 상대적 유리함을 주고자 했던 고민이었어' — 동방 대 이베리아만 · 씨앗 1 ~ 12 × 자리 둘 × {ⓐ 고정 30 · ⓑ 상대 베기 × 2}
    const ws = arg('weapons', 'hwando,qinggang').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const runs = [];
    for (const foe of ws) for (const v of ['fixed', 'foe2']) for (const seed of seeds) for (const slotE of [true, false]) {
      const r = ibFight({ foe, seed, v, slotE });
      runs.push(r);
      console.error(foe, v, seed, slotE, JSON.stringify({ w: r.win, l: r.lose, rg: r.regenN, rs: +r.regenSum.toFixed(1), ch: r.chain }));
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(ibTable(runs));
  } else if (mode === 'agg') {
    const { readFileSync } = await import('node:fs');
    console.log(aiTable(args.slice(1).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else if (mode === 'human') {
    const seeds = range(arg('seeds', '1-6'));
    const rows = [];
    for (const [tag, cut, walk] of [['지금 (감소 0.5)', 0.5, false], ['감소 뺌 (0)', 0, false], ['걸으며 막기 (감소 0.5)', 0.5, true]]) {
      const keep = CONFIG.SKILL.cnParryDmgCut;
      CONFIG.SKILL.cnParryDmgCut = cut;
      const rs = [];
      try {
        for (const seed of seeds) rs.push(await humanFight({ seed, walk }));
      } finally {
        CONFIG.SKILL.cnParryDmgCut = keep;
      }
      const n = rs.length;
      const s = (f) => rs.reduce((x, r) => x + f(r), 0);
      rows.push(`| ${tag} | ${n} | ${f2(s((r) => r.H.defN) / n)} · ${f2(s((r) => r.H.defSev) / n)} | ${f2(s((r) => r.H.allN) / n)} · ${f2(s((r) => r.H.allSev) / n)} | ${s((r) => r.H.gkOpen)} (${s((r) => r.H.gkMeant)} · ${s((r) => r.H.gkNotMeant)}) | ${s((r) => r.win)} · ${s((r) => r.lose)} · ${n - s((r) => r.win) - s((r) => r.lose)} |`);
      console.error(tag, JSON.stringify(rs.map((r) => ({ s: r.seed, H: r.H, w: r.win, l: r.lose }))));
    }
    console.log(['| 사람 손가락 봇 동방(청강검) 대 롱소드 AI 숙련 3 | 판 수 | 막기 단추로 막는 중 받은 칼날 상처 수 · 심각도 / 판 | 모든 받은 칼날 상처 수 · 심각도 / 판 | 격살 냄 6 판 합 (봇 뜻 — 막기 + 앞 스틱 · 뜻 밖) | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|', ...rows].join('\n'));
  }
}
