// ─────────────────────────────────────────────────────────────
//  corr_ai_battery.mjs — AI 의 검술 보정 옛 방식 대 v2 (SKILL.corrAI) 거울 결투 (설계 'AI 전·후 비교', map_ai §9)
//   harness_m AI2Class: 롱소드끼리, 벽 있음, hybrid 걸음, 두 쪽 같은 난이도. 판마다 40 s (누가 죽으면 끝)
//   node tools/sim/corr_ai_battery.mjs [--levels=normal,easy,hard] [--sets=A,B] [--arms=old,v2] [--seeds=1001,2001] [--secs=40] [--json=<파일>]
//     --sets: A = 시드 1001-1018 + 2001-2018 (36판), B = 3001-3018 + 4001-4018 (36판). --seeds 를 주면 그 시드만 (시험용)
//     --arms: 판을 만들기 전에 SKILL.corrAI 를 이 값으로 (ai.js setLevel 이 skill.corr 에 넣는다). SKILL.corrAI 가 없는 트리의 v2 는 'feature absent' 로 건너뜀
//   재는 것 (방식·난이도·묶음마다, 0번 자리 = P 기준 승패):
//     죽음 판 수 · 승/패/무 + 윌슨 95 % · 쓰러짐 (선 자세 → down/getup, fights12 와 같은 셈) ·
//     휘두름당 상처 = 상처(심각도 > 0) / skill.swings (두 파이터 합; ai.stats.attacks + followUps 로 나눈 값도 옆에) ·
//     상처 수·에너지 (onWound r.energy, 심각도 > 0) · 닿을 때 칼끝 빠르기 (r.speed) · 닿을 때 날 각 acos(edgeAlign)·납작 몫 (corr_lib tapEdge, chain_corr 와 같은 탭) ·
//     머리·목 % · 버틴 막기 = ai.stats.parries 가 는 뒤 0.5 s 안에 그 파이터가 상처(심각도 > 0)를 안 받은 것 / 막기 수 ·
//     첫 상처 때 (중앙값 s) · 쓰러진 상대 마무리율 = 누가 down 인 동안 상대에게 상처를 받은 쓰러짐 / 쓰러짐
//   곁에 README 잡음 폭(36판: 죽음 24~27, 플레이어 승 12~19)을 찍는다. 두 묶음 모두 폭 밖이어야 변화로 읽는다
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { tapEdge, wilson, med, mean, rN } from './corr_lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m) throw new Error(`모르는 인자 ${a}`); return [m[1], m[2] ?? true]; }));
const list = (k, d) => String(args[k] ?? d).split(',').filter(Boolean);
const LEVELS = list('levels', 'normal,easy,hard');
const SETS = list('sets', 'A,B');
const ARMS = list('arms', 'old,v2');
const SECS = +(args.secs ?? 40);
const JSON_OUT = args.json && args.json !== true ? args.json : null;
const SEEDSET = { A: [1001, 2001], B: [3001, 4001] };
const HAS = !!CONFIG.SKILL && 'corrAI' in CONFIG.SKILL;
CONFIG.BODY.weightMode = 'hybrid';
const tap = tapEdge(Combat, THREE, CONFIG);
const ARM0 = HAS ? CONFIG.SKILL.corrAI : null;
const R2D = 180 / Math.PI;

function fight(seed, level) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'longsword', difficulty: level, AI2Class: AI, difficulty2: level });
  const P = G.player, E = G.enemy, F = [P, E];
  const AIS = [G.ai2, G.ai]; // P 의 AI, E 의 AI
  const W = [];
  G.onWound = (att, vic, r) => {
    if (!(r.severity > 0)) return;
    const rec = tap.info.get(r);
    W.push({ t: G.t, att: att.index, vic: vic.index, zone: r.zone, E: r.energy, v: r.speed, ea: rec?.eaDeg ?? null, vicDown: vic.state === 'down' || vic.state === 'getup' });
  };
  const contacts = [];
  const lis = (rec) => { if (F.includes(rec.att)) contacts.push({ t: G.t, part: rec.part, att: rec.att.index, kind: rec.kind, isBlade: rec.isBlade, ea: rec.eaDeg }); };
  tap.listeners.add(lis);
  const sw0 = F.map((f) => f.skill.swings);
  const prev = F.map((f) => f.state);
  const par0 = AIS.map((a) => a.stats.parries);
  const parries = [];
  let falls = 0;
  const downs = []; // { who, t0, t1 }
  let res = 'D';
  for (let i = 0; i < SECS / DT; i++) {
    G.step();
    for (let k = 0; k < 2; k++) {
      const f = F[k];
      const down = f.state === 'down' || f.state === 'getup';
      if (prev[k] === 'stand' && down) (falls++, downs.push({ who: k, t0: G.t, t1: null }));
      if (!down && (prev[k] === 'down' || prev[k] === 'getup')) { const d = downs.findLast((x) => x.who === k && x.t1 == null); if (d) d.t1 = G.t; }
      prev[k] = f.state;
      const pn = AIS[k].stats.parries;
      if (pn > par0[k]) { for (let j = par0[k]; j < pn; j++) parries.push({ who: k, t: G.t }); par0[k] = pn; }
    }
    if (P.state === 'dead' || E.state === 'dead') { res = P.state === 'dead' && E.state === 'dead' ? 'D' : E.state === 'dead' ? 'W' : 'L'; break; }
  }
  tap.listeners.delete(lis);
  // 닿음 사건 (같은 공격자·부위가 2 스텝 넘게 끊기면 새 사건)
  const ev = [];
  const last = {};
  for (const c of contacts) { const k = `${c.att}:${c.part}`; if (last[k] == null || c.t - last[k] > 2.5 * DT) ev.push(c); last[k] = c.t; }
  const swings = F.reduce((a, f, k) => a + f.skill.swings - sw0[k], 0);
  const atk = AIS.reduce((a, x) => a + x.stats.attacks + x.stats.followUps, 0);
  const held = parries.filter((p) => !W.some((w) => w.vic === p.who && w.t >= p.t && w.t <= p.t + 0.5)).length;
  for (const d of downs) if (d.t1 == null) d.t1 = G.t;
  const finished = downs.filter((d) => W.some((w) => w.vic === d.who && w.t >= d.t0 && w.t <= d.t1)).length;
  return { seed, res, dead: P.state === 'dead' || E.state === 'dead', falls, swings, atk, W, ev, parries: parries.length, held, downs: downs.length, finished, first: W.length ? W[0].t : null };
}

function summary(rs) {
  const n = rs.length;
  const c = (k) => rs.filter((r) => r.res === k).length;
  const W = rs.flatMap((r) => r.W), ev = rs.flatMap((r) => r.ev);
  const blade = ev.filter((e) => e.isBlade);
  const sw = rs.reduce((a, r) => a + r.swings, 0), atk = rs.reduce((a, r) => a + r.atk, 0);
  const [lo, hi] = wilson(c('W'), n);
  const par = rs.reduce((a, r) => a + r.parries, 0), held = rs.reduce((a, r) => a + r.held, 0);
  const downs = rs.reduce((a, r) => a + r.downs, 0), fin = rs.reduce((a, r) => a + r.finished, 0);
  return {
    n, deaths: rs.filter((r) => r.dead).length, W: c('W'), L: c('L'), D: c('D'), winCI: [rN(lo, 2), rN(hi, 2)], falls: rs.reduce((a, r) => a + r.falls, 0),
    wounds: W.length, woundsPerFight: rN(W.length / n, 2), hitsPerSwing: sw ? rN(W.length / sw, 3) : null, hitsPerAttack: atk ? rN(W.length / atk, 3) : null, swings: sw, aiAttacks: atk,
    E: rN(mean(W.map((w) => w.E)), 1), Emed: rN(med(W.map((w) => w.E)), 1), vHit: rN(mean(W.map((w) => w.v)), 2), eaDeg: rN(mean(W.map((w) => w.ea)), 1), eaDegAll: rN(mean(blade.map((e) => e.ea)), 1),
    flatShare: blade.length ? rN(blade.filter((e) => e.kind === 'flat').length / blade.length, 3) : null, headNeckPct: W.length ? rN((100 * W.filter((w) => w.zone === 'head' || w.zone === 'neck').length) / W.length, 1) : null,
    parries: par, parriesHeldPct: par ? rN((100 * held) / par, 1) : null, firstWoundMed: rN(med(rs.map((r) => r.first)), 2), downs, finishRate: downs ? rN(fin / downs, 3) : null,
  };
}

const t0 = Date.now();
const out = [];
console.log(`corr_ai_battery · SKILL.corrAI ${HAS ? 'O' : '없음'} · 난이도 ${LEVELS.join(',')} · 묶음 ${args.seeds ? `시드 ${args.seeds}` : SETS.join(',')} · 방식 ${ARMS.join(',')} · ${SECS} s/판`);
console.log('잡음 폭 (tools/sim/README.md, 36판): 죽음 24~27 · 플레이어(0번) 승 12~19 — 두 묶음 모두 이 폭 밖이어야 변화');
console.log('휘두름당 상처 = 상처(심각도 > 0) / skill.swings 합 (옆: / ai.stats.attacks + followUps)');
for (const level of LEVELS) for (const arm of ARMS) {
  if (arm === 'v2' && !HAS) { console.log(`${level} v2: feature absent (SKILL.corrAI 없음) — 건너뜀`); continue; }
  const sets = args.seeds ? [['seeds', String(args.seeds).split(',').map(Number)]] : SETS.map((s) => [s, SEEDSET[s].flatMap((b) => Array.from({ length: 18 }, (_, i) => b + i))]);
  for (const [setName, seeds] of sets) {
    if (HAS) CONFIG.SKILL.corrAI = arm;
    const ts = Date.now();
    const rs = seeds.map((s) => fight(s, level));
    const sm = summary(rs);
    const secs = (Date.now() - ts) / 1000;
    out.push({ level, arm, set: setName, secs, ...sm, fights: rs.map((r) => ({ seed: r.seed, res: r.res, falls: r.falls, wounds: r.W.length, first: r.first == null ? null : rN(r.first, 2) })) });
    console.log(`${level.padEnd(6)} ${arm.padEnd(3)} ${setName}: 판 ${sm.n} · 죽음 ${sm.deaths} · 승/패/무 ${sm.W}/${sm.L}/${sm.D} (승 95% ${sm.winCI.join('~')}) · 쓰러짐 ${sm.falls} · 상처 ${sm.wounds} (${sm.woundsPerFight}/판) · 휘두름당 ${sm.hitsPerSwing ?? 'n/a'} (공격당 ${sm.hitsPerAttack ?? 'n/a'}) · 에너지 ${sm.E} J (중앙 ${sm.Emed}) · 칼끝 ${sm.vHit} m/s · 날 각 ${sm.eaDeg ?? 'n/a'}° (모든 칼날 닿음 ${sm.eaDegAll ?? 'n/a'}°) · 납작 ${sm.flatShare ?? 'n/a'} · 머리·목 ${sm.headNeckPct ?? 'n/a'}% · 막기 ${sm.parries} 버팀 ${sm.parriesHeldPct ?? 'n/a'}% · 첫 상처 ${sm.firstWoundMed ?? 'n/a'} s · 마무리 ${sm.finishRate ?? 'n/a'} (${sm.downs} 쓰러짐) · ${secs.toFixed(0)} s (${((secs * 36) / sm.n).toFixed(0)} s/36판)`);
  }
}

if (HAS) CONFIG.SKILL.corrAI = ARM0;
console.log(`걸린 시간 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ levels: LEVELS, sets: SETS, arms: ARMS, secs: SECS, feature: HAS, runs: out }, null, 1));
