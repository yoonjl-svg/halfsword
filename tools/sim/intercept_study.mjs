// ─────────────────────────────────────────────────────────────
//  intercept_study.mjs — 막기 2.0 STEP B 가로막기 재기 (11/17 · src/ai_intercept.js · config AI_INTERCEPT). 게임 값은 스위치로만 (기본 끔)
//  block2_study.mjs 와 같은 판 짜임: 유파 다섯 × 무기 둘(ai_ring_measure WEAPONS) × 씨앗 × 자리 둘(번갈음) · 60 s · 한쪽이 죽으면 끝 · 두 자리 모두 LOOKS.enemy.
//  판마다 모으는 것:
//   · 칼 닿음(새로 닿음 fresh) 수
//   · 공격 = AI 가 휘두름(strike) 단계로 들어간 때 하나(이어 치기도 하나씩). 창 = 들어간 때 ~ 그 공격 꼴이 끝난 때(strike · follow 를 떠남) + 0.1 s.
//     칼로 맞음 = 창 안에 칼끼리 새로 닿음 · 깨끗한 막기 = 그 닿음 때 막는 쪽이 칼로 막는 중(defend · 피하기 아님)이고 손이 겨눈 자리(가로막기면 그 자리 · 아니면 그 줄 막기 자리) 0.15 m 안 ·
//     그리고 창 + 0.3 s 안에 그 공격 쪽이 막는 쪽에 상처를 내지 않음
//   · 상처 · 맞교환(0.5 s 안 서로) · 이김(주인공 = 높은 쪽 / 첫 수)
//   · 반응 굴림 몫(막기 · 피하기 · 맞받기 · 탈락) · 가로막기 셈(ai.stats.icp)
//   · (STEP C 11/17) 상처 때 맞은 쪽이 공격 꼴이었나(준비 · 다가감 / 휘두름 · 마무리) · 휘두름마다 막는 쪽 반응 굴림이 있었나(휘두름 시작 ~ 1 s) · 공격 연 까닭(why)
//  node tools/sim/intercept_study.mjs run --seeds=1-6 [--shard=i/n] [--out=p.json] [--icp=1] [--aim=0|1] [--counter=0|1] [--strike=1] [--block2=1] [--reward=0.4] [--str=1.6:1.1] [--prof=2:6]
//     STEP C: [--disc=1] [--antic=1] [--anticwd=1] [--swing=1] [--rule=base|str2|lever|both] [--vit=1.3:1]
//  node tools/sim/intercept_study.mjs agg a.json b.json …
//  node tools/sim/intercept_study.mjs table --dir=D v1 v2 …   (파일 D/{변형}_{mirror|str|prof|p24|p46|vit}_{1..4}.json — 없는 묶음은 건너뜀) · --c = STEP C 표
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { WEAPONS } from './ai_ring_measure.mjs';
import { isMain } from './is_main.mjs';
import { wilson } from './ref_duel.mjs';

const { AI_PROFICIENCY, PROF6_VITALITY } = CONFIG;
const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const out = (f) => !f.alive || f.state === 'dead';

const RULES = { base: [1, 1, 1], str2: [2, 1, 1], lever: [1, 0.5, 2], both: [2, 0.5, 2] };
export function studyFight({ school, weapon, wi, seed, swap, dur = 60, icp = 0, aim = 1, counter = 1, strike = 0, block2 = 0, reward = 0, str, prof, disc = 0, antic = 0, anticWd = 0, swing = 0, rule = 'base', vit }) {
  CONFIG.AI_INTERCEPT.on = icp ? 1 : 0;
  CONFIG.AI_INTERCEPT.discipline = disc; // STEP C (11/17): 공격 절제 · 미리 줄 닫기 · 새 휘두름
  CONFIG.AI_INTERCEPT.antic = antic;
  CONFIG.AI_INTERCEPT.anticWd = anticWd;
  CONFIG.AI_INTERCEPT.swing = swing;
  [CONFIG.BLOCK2.strExp, CONFIG.BLOCK2.speedExp, CONFIG.BLOCK2.leverExp] = RULES[rule]; // 겨룸 점수 지수
  CONFIG.AI_INTERCEPT.aim = aim; // 가름 재기: --aim=0 = 덮는 맞받기만 · --counter=0 = 가로막기만
  CONFIG.AI_INTERCEPT.counter = counter;
  CONFIG.AI_INTERCEPT.strike = strike; // --strike=1 = 덮는 베기 켬 (기본 0)
  CONFIG.BLOCK2.on = block2 ? 1 : 0;
  CONFIG.BLOCK2.reward = reward;
  const lk = LOOKS.enemy;
  const [pLo, pHi] = prof ? prof : [4, 4];
  const lvl = (n) => AI_PROFICIENCY.levels[n];
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, look: lk, look2: lk,
    difficulty: lvl(swap ? pHi : pLo), difficulty2: lvl(swap ? pLo : pHi),
    persona: { proficiency: swap ? pHi : pLo }, persona2: { proficiency: swap ? pLo : pHi },
  });
  const P = G.player, E = G.enemy;
  const hero = swap ? E : P, other = swap ? P : E;
  if (str) { hero.strength = str[0]; other.strength = str[1]; }
  if (prof) { if (pHi === 6 && !process.env.NO_VITAL) hero.vitality = PROF6_VITALITY; if (pLo === 6) other.vitality = PROF6_VITALITY; }
  if (vit) { hero.vitality = vit[0]; other.vitality = vit[1]; }
  const aiOf = new Map([[E, G.ai], [P, G.ai2]]);
  const foeOf = new Map([[E, P], [P, E]]);
  const nm = (f) => (f === P ? 'P' : 'E');
  const wounds = [];
  const atks = [];
  const open = new Map(); // 싸움꾼 → 열린 공격
  let fresh = 0;
  const handIn = (f) => {
    const a = aiOf.get(f);
    const p = (a.icp && !a.defVoid && a.icpPad) || a.school.parry?.[a.defLine] || a.school.pose?.point;
    return !!p && Math.hypot(f.handOffset.x - p[0], f.handOffset.y - p[1]) <= 0.15;
  };
  G.combat.hooks.onClash = (point, sp, info) => {
    G.clashes++;
    if (!info.fresh) return;
    fresh++;
    for (const f of [P, E]) {
      const A = open.get(f);
      if (!A) continue;
      const D = foeOf.get(f), da = aiOf.get(D);
      if (!A.met) A.met = { t: G.t, def: da.mode === 'defend' && !da.defVoid, hand: handIn(D), icp: !!(da.icp && !da.defVoid), free: !!da.icpFree };
    }
  };
  G.onWound = (att, vic, r) => {
    if (!(r.severity > 0)) return;
    const va = aiOf.get(vic);
    const vm = va.mode === 'attack' ? (va.phase === 'strike' || va.phase === 'follow' ? 'S' : 'W') : va.mode === 'defend' ? (va.defVoid ? 'V' : va.icpPre ? 'P' : 'D') : va.mode === 'withdraw' ? 'R' : 'O'; // 맞은 쪽 꼴: 휘두름 · 준비 / 막기 · 피하기 · 미리 닫음 / 물러남 / 그 밖
    wounds.push({ t: +G.t.toFixed(3), att: nm(att), vic: nm(vic), sev: +r.severity.toFixed(2), vm, why: va.mode === 'attack' ? va.why : null });
  };
  const resp = { parry: 0, void: 0, counter: 0, rollfail: 0, other: 0 };
  const lastStrike = new Map(); // 싸움꾼 → 마지막 휘두름 (반응 굴림을 붙일 곳)
  for (const f of [P, E]) {
    const ai = aiOf.get(f);
    const oRe = ai.respond.bind(ai);
    ai.respond = (th, d) => {
      const before = ai.threatSeen, c0 = ai.stats.counters;
      const r = oRe(th, d);
      if (before !== th.id && ai.threatSeen === th.id) {
        const L = lastStrike.get(foeOf.get(f));
        if (L && G.t - L.t0 <= 1.0) L.rolled = true;
        const b = !r ? 'rollfail' : ai.mode === 'attack' || ai.stats.counters > c0 ? 'counter' : ai.defVoid ? 'void' : ai.mode === 'defend' ? 'parry' : 'other';
        resp[b]++;
      }
      return r;
    };
  }
  const prevPh = new Map([[P, ''], [E, '']]);
  while (G.t < dur && !out(P) && !out(E)) {
    G.step();
    for (const f of [P, E]) {
      const a = aiOf.get(f);
      const ph = a.mode === 'attack' ? a.phase : '';
      const A = open.get(f);
      if (ph === 'strike' && prevPh.get(f) !== 'strike') {
        if (A) A.t1 = G.t;
        const n = { att: nm(f), t0: G.t, t1: null, met: null, why: a.why, rolled: false };
        atks.push(n);
        open.set(f, n);
        lastStrike.set(f, n);
      } else if (A && ph !== 'strike' && ph !== 'follow') {
        if (A.t1 == null) A.t1 = G.t;
        if (G.t > A.t1 + 0.1) open.delete(f);
      }
      prevPh.set(f, ph);
    }
  }
  for (const A of atks) if (A.t1 == null) A.t1 = G.t;
  // 깨끗한 막기: 칼로 맞았고 그 때 막는 중 · 손이 자리 안 · 창 + 0.3 s 안에 그 공격 쪽이 막는 쪽에 상처를 내지 않음
  for (const A of atks) {
    const vic = A.att === 'P' ? 'E' : 'P';
    A.wound = wounds.some((w) => w.att === A.att && w.vic === vic && w.t >= A.t0 && w.t <= A.t1 + 0.4);
    A.clean = !!(A.met && A.met.def && A.met.hand && !A.wound);
  }
  const res = out(hero) && !out(other) ? 'lo' : out(other) && !out(hero) ? 'hi' : 'd';
  const icpS = [P, E].map((f) => aiOf.get(f).stats.icp ?? null);
  const pc = [P, E].reduce((s, f) => s + (aiOf.get(f).stats.parryWin ?? 0), 0);
  const rec = {
    school, weapon, seed, swap, res, endT: +G.t.toFixed(2), clashes: G.clashes, fresh, wounds, hero: swap ? 'E' : 'P', resp, icp: icpS, pcWin: pc,
    atks: atks.map((a) => [a.att === 'P' ? 0 : 1, +a.t0.toFixed(3), a.met ? 1 : 0, a.met?.def ? 1 : 0, a.met?.hand ? 1 : 0, a.clean ? 1 : 0, a.wound ? 1 : 0, a.met?.icp ? 1 : 0, a.rolled ? 1 : 0, a.why]),
    whys: [P, E].map((f) => aiOf.get(f).stats.attacks ?? 0),
    b2: G.combat.block2Stats ?? null,
  };
  G.world.free();
  return rec;
}

// ───────── 모으기 ─────────
const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '-');
export function summary(recs) {
  const n = recs.length;
  const W = recs.reduce((s, r) => s + r.wounds.length, 0);
  let trade = 0;
  for (const r of recs) for (const w of r.wounds) if (r.wounds.some((x) => x !== w && x.att === w.vic && x.vic === w.att && Math.abs(x.t - w.t) <= 0.5)) trade++;
  const hi = recs.filter((r) => r.res === 'hi').length, dr = recs.filter((r) => r.res === 'd').length, lo = recs.filter((r) => r.res === 'lo').length;
  const k = hi + dr / 2;
  const A = recs.flatMap((r) => r.atks);
  const met = A.filter((a) => a[2]).length, clean = A.filter((a) => a[5]).length, metDef = A.filter((a) => a[2] && a[3]).length, wnd = A.filter((a) => a[6]).length;
  const rs = recs.reduce((a, r) => { for (const q in r.resp) a[q] = (a[q] ?? 0) + r.resp[q]; return a; }, {});
  const rt = Object.values(rs).reduce((a, b) => a + b, 0);
  const ic = recs.flatMap((r) => r.icp.filter(Boolean)).reduce((a, x) => { for (const q in x) a[q] = (a[q] ?? 0) + x[q]; return a; }, {});
  const b2 = (q) => recs.reduce((a, r) => a + (r.b2?.[q] ?? 0), 0) / n;
  const allW = recs.flatMap((r) => r.wounds);
  const vm = allW.reduce((a, w) => ((a[w.vm ?? '?'] = (a[w.vm ?? '?'] ?? 0) + 1), a), {});
  const rolled = A.filter((a) => a[8]).length;
  const draws = recs.filter((r) => r.res === 'd').length;
  return {
    wAtk: W ? ((vm.S ?? 0) + (vm.W ?? 0)) / W : 0, wStrike: W ? (vm.S ?? 0) / W : 0, vm, rolled: A.length ? rolled / A.length : 0, draws: draws / n,
    n, W, wpf: W / n, trade: W ? trade / W : 0, share: k / n, ci: wilson(k, n), hi, dr, lo,
    fresh: recs.reduce((s, r) => s + r.fresh, 0) / n, atk: A.length / n, met: A.length ? met / A.length : 0, metDef: A.length ? metDef / A.length : 0,
    clean: A.length ? clean / A.length : 0, cleanPf: clean / n, atkWound: A.length ? wnd / A.length : 0,
    parry: rt ? (rs.parry ?? 0) / rt : 0, void: rt ? (rs.void ?? 0) / rt : 0, counter: rt ? (rs.counter ?? 0) / rt : 0,
    icp: ic, clash2: b2('clash'), reward2: b2('reward'), endT: recs.reduce((s, r) => s + r.endT, 0) / n, pcWin: recs.reduce((s, r) => s + (r.pcWin ?? 0), 0) / n,
  };
}
export function aggregate(recs) {
  const S = summary(recs);
  const O = [];
  O.push(`판 ${S.n} · 상처 ${S.W} (판당 ${S.wpf.toFixed(2)}) · 맞교환 ${pc(S.trade * S.W, S.W)} · 칼 새로 닿음 판당 ${S.fresh.toFixed(1)}`);
  O.push(`주인공 몫 ${(100 * S.share).toFixed(1)} % [${(100 * S.ci[0]).toFixed(0)} ~ ${(100 * S.ci[1]).toFixed(0)}] — 승 ${S.hi} · 무 ${S.dr} · 패 ${S.lo} · 평균 끝 ${S.endT.toFixed(1)} s`);
  O.push(`공격 판당 ${S.atk.toFixed(1)} · 칼로 맞음 ${(100 * S.met).toFixed(1)} % (막는 중 ${(100 * S.metDef).toFixed(1)} %) · 깨끗한 막기 ${(100 * S.clean).toFixed(1)} % (판당 ${S.cleanPf.toFixed(2)}) · 상처 낸 공격 ${(100 * S.atkWound).toFixed(1)} %`);
  O.push(`반응: 막기 ${(100 * S.parry).toFixed(1)} % · 피하기 ${(100 * S.void).toFixed(1)} % · 맞받기 ${(100 * S.counter).toFixed(1)} % · 막기 연환 창 판당 ${S.pcWin.toFixed(2)}`);
  O.push(`가로막기 셈: ${JSON.stringify(S.icp)} · 겨룸 판당 ${S.clash2.toFixed(2)} · 막기 보상 판당 ${S.reward2.toFixed(2)}`);
  O.push(`STEP C: 공격 중 맞은 상처 ${(100 * S.wAtk).toFixed(1)} % (휘두름 · 마무리 ${(100 * S.wStrike).toFixed(1)} %) · 맞은 꼴 ${JSON.stringify(S.vm)} · 반응 굴림 받은 휘두름 ${(100 * S.rolled).toFixed(1)} % · 비김 ${(100 * S.draws).toFixed(1)} %`);
  return O.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
  const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'table') {
    const dir = arg('dir', '.');
    const names = args.slice(1).filter((a) => !a.startsWith('--'));
    const load = (n, set) => { const fs = [1, 2, 3, 4].map((i) => `${dir}/${n}_${set}_${i}.json`).filter(existsSync); return fs.length ? fs.flatMap((p) => JSON.parse(readFileSync(p, 'utf8'))) : null; };
    const sh = (rs) => { if (!rs) return '-'; const S = summary(rs); return `${(100 * S.share).toFixed(1)} % [${(100 * S.ci[0]).toFixed(0)}~${(100 * S.ci[1]).toFixed(0)}] (${rs.length})`; };
    if (args.includes('--c')) {
      // STEP C 표 (11/17): 거울(숙련 4) 짓 + 숙련 2 : 6 · 힘 · 버팀 몫
      console.log('| 변형 | 판당 상처 | 공격 중 맞은 상처 (휘두름 · 마무리) | 물러나다 맞은 상처 | 맞교환 상처 | 반응 굴림 받은 휘두름 | 판당 칼 새로 닿음 | 칼로 맞은 공격 (막는 중) | 판당 공격 | 비김 | 숙련 2 : 6 의 6 쪽 | 2 : 6 판당 상처 | 힘 1.6 : 1.1 | 버팀 1.3 : 1 |');
      console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
      for (const n of names) {
        const m = load(n, 'mirror');
        const pr = load(n, 'prof');
        if (!m && !pr) continue;
        const S = m ? summary(m) : null;
        const Sp = pr ? summary(pr) : null;
        const f = (v) => (S ? v(S) : '-');
        console.log(`| ${n} | ${f((x) => x.wpf.toFixed(2))} | ${f((x) => `${(100 * x.wAtk).toFixed(1)} % (${(100 * x.wStrike).toFixed(1)} %)`)} | ${f((x) => `${((100 * (x.vm.R ?? 0)) / x.W).toFixed(1)} %`)} | ${f((x) => `${(100 * x.trade).toFixed(1)} %`)} | ${f((x) => `${(100 * x.rolled).toFixed(1)} %`)} | ${f((x) => x.fresh.toFixed(1))} | ${f((x) => `${(100 * x.met).toFixed(1)} % (${(100 * x.metDef).toFixed(1)} %)`)} | ${f((x) => x.atk.toFixed(1))} | ${f((x) => `${(100 * x.draws).toFixed(1)} %`)} | ${sh(pr)} | ${Sp ? Sp.wpf.toFixed(2) : '-'} | ${sh(load(n, 'str'))} | ${sh(load(n, 'vit'))} |`);
      }
      process.exit(0);
    }
    console.log('| 변형 | 판당 칼 새로 닿음 | 칼로 맞은 공격 (막는 중) | 깨끗한 막기 (판당) | 맞교환 상처 | 판당 상처 | 칼로 막기 고른 몫 | 힘 1.6 : 1.1 센 쪽 | 숙련 2 : 6 의 6 쪽 | 2 : 4 의 4 쪽 | 4 : 6 의 6 쪽 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const n of names) {
      const m = load(n, 'mirror');
      if (!m) continue;
      const S = summary(m);
      console.log(`| ${n} | ${S.fresh.toFixed(1)} | ${(100 * S.met).toFixed(1)} % (${(100 * S.metDef).toFixed(1)} %) | ${(100 * S.clean).toFixed(1)} % (${S.cleanPf.toFixed(2)}) | ${(100 * S.trade).toFixed(1)} % | ${S.wpf.toFixed(2)} | ${(100 * S.parry).toFixed(1)} % | ${sh(load(n, 'str'))} | ${sh(load(n, 'prof'))} | ${sh(load(n, 'p24'))} | ${sh(load(n, 'p46'))} |`);
    }
  } else if (mode === 'agg') {
    const recs = args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(aggregate(recs));
  } else {
    const [s0, s1] = arg('seeds', '1-3').split('-').map(Number);
    const seeds = Array.from({ length: (s1 ?? s0) - s0 + 1 }, (_, i) => s0 + i);
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const dur = +arg('dur', '60');
    const str = arg('str', null)?.split(':').map(Number);
    const prof = arg('prof', null)?.split(':').map(Number);
    const list = [];
    for (const school of SCHOOLS) WEAPONS[school].forEach((weapon, wi) => { for (const seed of seeds) for (const swap of [false, true]) list.push({ school, weapon, wi, seed, swap }); });
    const mine = list.filter((_, i) => i % sn === si - 1);
    const recs = [];
    for (const f of mine) {
      const r = studyFight({ ...f, dur, icp: +arg('icp', '0'), aim: +arg('aim', '1'), counter: +arg('counter', '1'), strike: +arg('strike', '0'), block2: +arg('block2', '0'), reward: +arg('reward', '0'), str, prof, disc: +arg('disc', '0'), antic: +arg('antic', '0'), anticWd: +arg('anticwd', '0'), swing: +arg('swing', '0'), rule: arg('rule', 'base'), vit: arg('vit', null)?.split(':').map(Number) });
      recs.push(r);
      console.error(f.school, f.weapon, f.seed, f.swap ? 'S' : '-', r.res, r.endT, 'fresh', r.fresh);
    }
    const o = arg('out', null);
    if (o) writeFileSync(o, JSON.stringify(recs));
    console.log(aggregate(recs));
  }
}
