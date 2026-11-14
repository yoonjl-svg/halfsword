// ─────────────────────────────────────────────────────────────
//  ai_reach_fight.mjs — AI 가 믿는 내 칼 거리 ↔ 실제 싸움에서 닿는 거리 (11/14 사장님 '거리를 잘못 아는 의심 무기 11가지를 실제 싸움으로 확인. 단 최소 실험.')
//   기록: docs/strike/ai_reach_fight_2026-11-14.md · 바탕: 설계안 docs/design/ai_school_baseline_2026-11-14.md §6 · 부록 B (점검 도구 ai_reach_check.mjs 는 허공 기하 —
//   무거운 칼을 길게 재는 버릇이 있어 잣대를 싸움 칼로 옮긴다). 재기만 한다 — 게임 값(src)은 그대로.
//
//  판: 그 무기 AI(숙련 2) 대 롱소드 AI(숙련 2) · 벽 있음 · 30 s · 홀 시드 = 재는 무기가 E 자리(G.ai), 짝 시드 = P 자리(G.ai2) — flamberge_measure.mjs duel · school_ai_fights.mjs 꼴.
//   견줌 판: 롱소드 대 롱소드(두 쪽 칼을 모두 모음).
//  칼 하나 = startStrike 하나(다음 칼 · 새 공격 · 공격 꼴이 끝나면 닫음 — flamberge_measure.mjs tapAI 와 같은 가름):
//   d0   칼을 낸 순간 가슴 ↔ 가슴 수평 거리 · byNeed 준비(approach)에서 '닿을 거리(need)'를 보고 낸 칼인가(공격을 시작한 그 스텝에 곧장 낸 칼 — 이어 치기 · 흐름 · 맞받기 — 은 아님)
//        need · cd(그때 contactDist — 다가오는 몫을 뺀 '칼이 닿을 때 거리' 어림)
//   out  'hit' 상처(또는 상대 아픔 튐 — ai.hitLanded) · 'bound' 칼끼리만 닿음 · 'miss' 헛침(몸에도 칼에도 안 닿음 — ai.js afterStrike 'missed' 와 같은 가름)
//   dHit 그 칼의 첫 상처 순간 가슴 거리 · tHit 그때 칼날 위 맞은 자리(0 = 칼날 뿌리 · 1 = 칼끝 — combat.js analyze r.t) · zone
//   tip  칼끝 남음(m) = 칼끝이 내 가슴에서 상대 쪽(가슴 ↔ 가슴 줄)으로 간 거리 − 그 몸 자리가 같은 줄에서 있는 거리.
//        몸 자리 = 첫 상처면 맞은 점(combat onWound point) · 아니면 1 s 안 칼(뿌리 ~ 칼끝 여섯 점)이 상대 몸 부위(발 빼고 열둘) 가운데에 가장 가까이 간 순간의 그 부위.
//        칼끼리 닿으면 거기서 멈춤(상대 칼이 멈춘 칼 — 잣대에서 뺌). 0 = 칼끝으로 맞힘 · 음수 = 칼끝이 몸에 못 미침(멀리서 냄) · 양수가 크면 칼 안쪽으로 맞힘(붙어서 냄).
//        팔 · 다리를 맞힌 칼도 그 자리 기준이라 '칼끝으로 팔을 맞힘'은 0 근처(가슴 기준이면 팔 길이만큼 음수로 보이는 치우침을 뺌).
//  잣대: 롱소드 손 표 줄(1.57 / 1.80)은 모든 줄의 바탕이고 롱소드 AI 의 싸움 거리는 관문(fights12)으로 맞춰 둔 값이다 → 롱소드 대 롱소드의 칼끝 남음 가운데를 '맞는 거리'로 놓고
//   무기마다 칼끝 남음 가운데 − 롱소드 가운데 = Δ. Δ > 0 = 칼이 남는데도 붙어서 냄 = 짧게 믿음(줄 + Δ) · Δ < 0 = 모자란데 냄 = 길게 믿음(줄 + Δ).
//   멀리서 냄 = 칼끼리 안 닿고 상처도 없이 칼끝 남음 < −0.10(칼끝이 가장 가까운 부위 가운데보다 0.1 m 넘게 못 미침 — 부위 반지름 0.05 ~ 0.11 밖)
//   붙어서 냄 = 칼끝 남음 > 롱소드 가운데 + 칼날 길이의 반(칼 안쪽 반으로 맞힘 · 지나감)
//   판정: 칼(칼끼리 닿은 칼 뺌) 10 개 미만 = 판정 못 함 · |Δ| < 0.1 또는 붓스트랩 5 ~ 95 % 가 0 을 걸치면 맞음 · 그 밖 길게 / 짧게 믿음 Δ. 고칠 값 안 = 손 표 줄 맞닿기 · 칼끝 + Δ (사장님 확인 전).
//   칼끝 줄 확인(덧 표): 상처 순간 가슴 거리 p90 − 손 표 칼끝, 롱소드 몫을 뺌 — 칼끝 거리 줄(이어 치기 창 · 상대 어림의 바탕)이 싸움에서 어떤지.
//
//  node tools/sim/ai_reach_fight.mjs fight <무기…> [--foe=longsword] [--seeds=1-3] [--secs=30] [--prof=2] [--out=폴더]   (무기마다 <폴더>/<무기>.json)
//  node tools/sim/ai_reach_fight.mjs sum <json…> [--md]
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { newRound, DT, AI, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { ARENA } from '../../src/config.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { getWeapon } from '../../src/weapons.js';

const argOf = (args, k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const seedList = (s) => { if (s.includes('-')) { const [a, b] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); } return s.split(',').map(Number); };
const q = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
const f2 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(2));
const sg = (x) => (x == null || !Number.isFinite(x) ? '-' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '-');

const SKIP = new Set(['footF', 'footB']);
const FAR = -0.1; // 멀리서 냄 문턱 (머리말)
const _tip = new THREE.Vector3(), _bp = new THREE.Vector3();
const chestDist = (a, b) => { const p = a.bodies.chest.translation(), r = b.bodies.chest.translation(); return Math.hypot(p.x - r.x, p.z - r.z); };
/** 가슴 ↔ 가슴 줄 (내 가슴 · 상대 쪽 단위 벡터 · 거리) */
function line(me, foe) {
  const c = me.bodies.chest.translation(), o = foe.bodies.chest.translation();
  const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
  return { c, ux: dx / d, uz: dz / d, d };
}
const fwd = (L, p) => (p.x - L.c.x) * L.ux + (p.z - L.c.z) * L.uz;
/** 칼끝 남음: 칼끝이 줄 위로 간 거리 − 몸 자리 p 가 줄 위에 있는 거리 */
function tipLead(me, foe, p) {
  const L = line(me, foe);
  return fwd(L, me.bladePoint(1, _tip)) - fwd(L, p);
}
/** 칼(뿌리 ~ 칼끝 여섯 점) ↔ 상대 몸 부위 가운데 가장 가까움 { g, part, pos } */
function bladeGap(me, foe) {
  let g = 9, part = null, pos = null;
  for (let k = 0; k <= 10; k += 2) {
    const p = me.bladePoint(k / 10, _bp);
    for (const [name, rb] of Object.entries(foe.bodies)) {
      if (SKIP.has(name)) continue;
      const b = rb.translation();
      const x = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
      if (x < g) { g = x; part = name; pos = { x: b.x, y: b.y, z: b.z }; }
    }
  }
  return { g, part, pos };
}

/** 한 AI 의 칼을 하나씩 센다 (flamberge_measure.mjs tapAI 꼴 + 칼끝 남음 · 상처 순간 거리) */
function tapAI(ai, G, me, list, seed) {
  let cur = null, atkT = -1;
  const close = () => {
    if (!cur) return;
    const out = cur.wound || cur.landed ? 'hit' : cur.bound ? 'bound' : 'miss';
    list.push({ seed, d0: +cur.d0.toFixed(3), byNeed: cur.byNeed, need: cur.need, cd: cur.cd, tech: cur.tech, kind: cur.kind, why: cur.why, feint: cur.feint, out, tip: cur.tip == null ? null : +cur.tip.toFixed(3), part: cur.part, gap: +cur.gap.toFixed(3), dHit: cur.wound ? +cur.wound.d.toFixed(3) : null, tHit: cur.wound ? +cur.wound.t.toFixed(3) : null, zone: cur.wound?.zone ?? null });
    cur = null;
  };
  const sa = ai.startAttack, ss = ai.startStrike;
  ai.startAttack = function () { close(); atkT = G.t; return sa.apply(this, arguments); };
  ai.startStrike = function () {
    close();
    const byNeed = this.phase === 'approach' && G.t > atkT + 1e-9; // 준비에서 need 를 보고 낸 칼 (공격을 시작한 스텝에 곧장 낸 칼은 아님)
    const need = byNeed && this.need != null ? +this.need.toFixed(3) : null;
    const cd = byNeed ? +this.contactDist().toFixed(3) : null;
    const r = ss.apply(this, arguments);
    cur = { t0: G.t, d0: chestDist(this.me, this.foe), byNeed, need, cd, tech: this.tech?.name ?? null, kind: this.tech?.kind ?? null, why: this.why ?? null, feint: !!this.feint, landed: false, bound: false, wound: null, gap: 9, tip: null, part: null, frozen: false };
    return r;
  };
  return {
    step() {
      if (!cur) return;
      cur.landed ||= ai.hitLanded;
      if (ai.bound && !cur.bound) { cur.bound = true; if (!cur.wound) cur.frozen = true; } // 칼끼리 닿음: 상대 칼이 멈춘 칼 — 칼끝 남음은 거기서 멈춤
      if (!cur.frozen && !cur.wound && G.t - cur.t0 <= 1.0) {
        const B = bladeGap(me, ai.foe);
        if (B.g < cur.gap) { cur.gap = B.g; cur.part = B.part; cur.tip = tipLead(me, ai.foe, B.pos); }
      }
      if (ai.mode !== 'attack' && ai.mode !== 'secret') close();
    },
    wound(r, point) {
      if (!cur || cur.wound || G.t - cur.t0 > 1.0 + 1e-9) return;
      cur.wound = { d: chestDist(me, ai.foe), t: r.t ?? NaN, zone: r.zone };
      if (!cur.frozen && point) { cur.tip = tipLead(me, ai.foe, point); cur.part = `hit:${r.zone}`; }
    },
    end: close,
  };
}

/** AI 가 믿는 내 칼 (그 AI 인스턴스 그대로) */
const belief = (ai) => ({ contact: +ai.M.contact.toFixed(3), reach: +ai.M.reach.toFixed(3), clinch: +ai.M.clinch.toFixed(3), cutTime: +ai.M.cutTime.toFixed(3), reachScale: +ai.reachScale.toFixed(3), foeReach: +ai.foeReach.toFixed(3) });

export function fightWeapon(weapon, { foe = 'longsword', seeds = [1, 2, 3], secs = 30, prof = 2 } = {}) {
  const res = { weapon, foe, seeds, secs, prof, row: MEASURED[weapon] ? [...MEASURED[weapon]] : null, bladeLength: getWeapon(weapon).bladeLength, subj: [], other: [], fights: [] };
  for (const seed of seeds) {
    const subjE = seed % 2 === 1; // 홀 시드 = 재는 무기가 E(G.ai)
    const wE = subjE ? weapon : foe, wP = subjE ? foe : weapon;
    const G = newRound({ seed, walls: true, weapon: wP, weapon2: wE, AI2Class: AI, difficulty: 'normal', persona: { proficiency: prof }, persona2: { proficiency: prof } });
    const aiS = subjE ? G.ai : G.ai2, aiO = subjE ? G.ai2 : G.ai;
    const fS = subjE ? G.enemy : G.player, fO = subjE ? G.player : G.enemy;
    const tS = tapAI(aiS, G, fS, res.subj, seed), tO = tapAI(aiO, G, fO, res.other, seed);
    const ow = G.combat.hooks.onWound; // 맞은 점(point)까지 받으려고 combat 알림을 감쌈 (harness 의 G.onWound 는 point 를 안 넘김)
    G.combat.hooks.onWound = (att, vic, r, point, ...rest) => { ow?.(att, vic, r, point, ...rest); const p = point ? { x: point.x, y: point.y, z: point.z } : null; if (att === fS) tS.wound(r, p); else if (att === fO) tO.wound(r, p); };
    const bS = belief(aiS), bO = belief(aiO);
    let standT = 0, dSum = 0;
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      tS.step();
      tO.step();
      if (G.t > ARENA.startHold && fS.alive && fO.alive && fS.state === 'stand' && fO.state === 'stand') { standT += DT; dSum += chestDist(fS, fO) * DT; }
      if (!fS.alive || !fO.alive) break;
    }
    tS.end();
    tO.end();
    const wS = G.wounds.filter((w) => w.att === fS).length, wO = G.wounds.filter((w) => w.att === fO).length;
    const win = fS.alive && !fO.alive ? 'S' : fO.alive && !fS.alive ? 'O' : !fS.alive && !fO.alive ? 'D' : fS.blood === fO.blood ? 'D' : fS.blood > fO.blood ? 'S' : 'O';
    res.fights.push({ seed, subjSide: subjE ? 'E' : 'P', beliefS: bS, beliefO: bO, woundsS: wS, woundsO: wO, win, t: +G.t.toFixed(2), meanD: standT ? +(dSum / standT).toFixed(3) : null });
    G.world.free();
  }
  return res;
}

// ── sum ─────────────────────────────────────────────────────────────
/** 결정적 붓스트랩: 두 묶음 칼끝 남음 가운데 차의 5 · 95 % */
function bootDiff(a, b, n = 2000) {
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const pick = (x) => { const y = new Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[Math.floor(rnd() * x.length)]; return y; };
  const D = [];
  for (let i = 0; i < n; i++) D.push(med(pick(a)) - med(pick(b)));
  return [q(D, 0.05), q(D, 0.95)];
}

export function summarize(R) {
  const base = R.find((r) => r.weapon === 'longsword' && r.foe === 'longsword');
  const lsList = base ? [...base.subj, ...base.other] : [];
  const lsTips = lsList.filter((s) => s.out !== 'bound' && s.tip != null).map((s) => s.tip);
  const lsMed = med(lsTips);
  const lsReachOff = base ? q(lsList.filter((s) => s.out === 'hit' && s.dHit != null).map((s) => s.dHit), 0.9) - base.row[1] : NaN; // 롱소드: 상처 순간 거리 p90 − 손 표 칼끝
  const rows = [];
  for (const r of R) {
    const L = r === base ? lsList : r.subj;
    const b = r.fights[0].beliefS;
    const tips = L.filter((s) => s.out !== 'bound' && s.tip != null).map((s) => s.tip);
    const hits = L.filter((s) => s.out === 'hit');
    const dHit = hits.map((s) => s.dHit).filter((x) => x != null);
    const app = L.filter((s) => s.byNeed);
    const tipMed = med(tips);
    const delta = r === base ? 0 : tipMed - lsMed;
    const ci = r === base ? [NaN, NaN] : bootDiff(tips, lsTips);
    const far = L.filter((s) => s.out === 'miss' && s.tip != null && s.tip < FAR).length; // 칼끝이 가장 가까운 몸 부위에 못 미친 헛침
    const closeIn = L.filter((s) => s.out !== 'bound' && s.tip != null && s.tip > (lsMed + 0.5 * r.bladeLength)).length; // 롱소드 가운데보다 칼 반 넘게 남음
    const perSeed = r.seeds.map((sd) => med(L.filter((s) => s.seed === sd && s.out !== 'bound' && s.tip != null).map((s) => s.tip)));
    rows.push({
      weapon: r.weapon, foe: r.foe, n: r.fights.length, secs: r.secs, belief: b, row: r.row,
      otherTip: r === base ? NaN : med(r.other.filter((s) => s.out !== 'bound' && s.tip != null).map((s) => s.tip)),
      d0HitMiss: [med(hits.map((s) => s.d0)), med(L.filter((s) => s.out === 'miss').map((s) => s.d0))], strikes: L.length, perFight: L.length / (r === base ? 2 * r.fights.length : r.fights.length),
      hit: hits.length, bound: L.filter((s) => s.out === 'bound').length, miss: L.filter((s) => s.out === 'miss').length,
      d0: [q(L.map((s) => s.d0), 0.1), med(L.map((s) => s.d0)), q(L.map((s) => s.d0), 0.9)],
      d0Hit: [q(hits.map((s) => s.d0), 0.1), med(hits.map((s) => s.d0)), q(hits.map((s) => s.d0), 0.9)],
      dHit: [q(dHit, 0.1), med(dHit), q(dHit, 0.9), dHit.length ? Math.max(...dHit) : NaN], nHit: dHit.length,
      tHit: med(hits.map((s) => s.tHit).filter((x) => x != null && Number.isFinite(x))),
      app: app.length, appMiss: app.filter((s) => s.out === 'miss').length, appFar: app.filter((s) => s.out === 'miss' && s.tip != null && s.tip < FAR).length, needMed: med(app.map((s) => s.need).filter((x) => x != null)), appD0: med(app.map((s) => s.d0)), appCd: med(app.map((s) => s.cd).filter((x) => x != null)),
      appTip: med(app.filter((s) => s.out !== 'bound' && s.tip != null).map((s) => s.tip)),
      reachOff: r.row ? q(dHit, 0.9) - r.row[1] : NaN, // 상처 순간 거리 p90 − 손 표 칼끝 (칼끝 거리 줄 확인 — 상처가 적으면 p90 ≈ 가장 먼)
      tipN: tips.length, tipMed, tipQ: [q(tips, 0.25), q(tips, 0.75)], delta, ci, perSeed, far, closeIn,
      foeOfMe: r.fights[0].beliefO.foeReach,
      wounds: [r.fights.reduce((a, f) => a + f.woundsS, 0), r.fights.reduce((a, f) => a + f.woundsO, 0)], wins: r.fights.filter((f) => f.win === 'S').length, losses: r.fights.filter((f) => f.win === 'O').length,
    });
  }
  for (const r of rows) r.reachRel = r.reachOff - lsReachOff;
  return { lsMed, lsReachOff, rows };
}

const MIN_N = 10; // 판정에 쓰는 칼(칼끼리 닿은 칼 뺌) 가장 적은 수
const SMALL = 0.1; // 이보다 작은 Δ 는 맞음 (설계안 §6-5 알림 문턱 0.1 m 와 같음)
function verdict(r) {
  if (r.weapon === 'longsword' && r.foe === 'longsword') return '기준';
  if (r.tipN < MIN_N) return `칼 모자람 (${r.tipN} 개 — 판정 못 함)`;
  const [lo, hi] = r.ci;
  if (Math.abs(r.delta) < SMALL || (lo <= 0 && hi >= 0)) return `맞음 (${sg(r.delta)})`;
  return r.delta < 0 ? `길게 믿음 ${Math.abs(r.delta).toFixed(2)}` : `짧게 믿음 ${r.delta.toFixed(2)}`;
}
/** 고칠 값 안: 손 표 줄(맞닿기 · 칼끝)에 Δ 를 더함 (사장님 확인 전) */
const fixOf = (r) => {
  const v = verdict(r);
  if (v === '기준') return '-';
  if (!v.startsWith('길게') && !v.startsWith('짧게')) return '그대로';
  return r.row ? `${(r.row[0] + r.delta).toFixed(2)} / ${(r.row[1] + r.delta).toFixed(2)}` : '-';
};

function print(S, mdOut) {
  const { lsMed, rows } = S;
  console.log(`롱소드 대 롱소드 칼끝 남음 가운데 = ${f2(lsMed)} m (기준)`);
  console.log('| 무기 | 판 | 손 표 줄 맞닿기 / 칼끝 (AI 안 맞닿기) | 칼 / 판 | 낸 거리 p50 [p10 ~ p90] | 상처 순간 거리 p50 [p10 ~ p90] · 가장 먼 (상처 수) | 상처 낸 칼의 낸 거리 p50 [p10 ~ p90] | 맞은 칼날 자리 p50 | 상처 · 막힘 · 헛침 | 칼끝 남음 p50 [p25 ~ p75] (칼) | 씨앗별 p50 | Δ [5 ~ 95 %] | 멀리서 냄 (칼끝이 몸에 못 미친 헛침) | 붙어서 냄 (칼 반 넘게 남음) | 판정 | 고칠 값 안 맞닿기 / 칼끝 |');
  console.log('|' + '---|'.repeat(16));
  for (const r of rows) {
    console.log(`| ${r.weapon}${r.foe !== 'longsword' ? ` ~ ${r.foe}` : ''} | ${r.n} × ${r.secs} s | ${r.row ? `${f2(r.row[0])} / ${f2(r.row[1])}` : '-'} (${f2(r.belief.contact)}) | ${r.perFight.toFixed(1)} | ${f2(r.d0[1])} [${f2(r.d0[0])} ~ ${f2(r.d0[2])}] | ${f2(r.dHit[1])} [${f2(r.dHit[0])} ~ ${f2(r.dHit[2])}] · ${f2(r.dHit[3])} (${r.nHit}) | ${f2(r.d0Hit[1])} [${f2(r.d0Hit[0])} ~ ${f2(r.d0Hit[2])}] | ${f2(r.tHit)} | ${pct(r.hit, r.strikes)} · ${pct(r.bound, r.strikes)} · ${pct(r.miss, r.strikes)} | ${sg(r.tipMed)} [${sg(r.tipQ[0])} ~ ${sg(r.tipQ[1])}] (${r.tipN}) | ${r.perSeed.map(sg).join(' · ')} | ${r.weapon === 'longsword' && r.foe === 'longsword' ? '0' : `${sg(r.delta)} [${sg(r.ci[0])} ~ ${sg(r.ci[1])}]`} | ${pct(r.far, r.strikes)} | ${pct(r.closeIn, r.strikes)} | ${verdict(r)} | ${fixOf(r)} |`);
  }
  if (!mdOut) return;
  console.log('\n| 무기 | 상처 순간 거리 p90 − 손 표 칼끝 | 롱소드 몫을 뺌 (칼끝 줄 어긋남 어림) | 상처 수 |');
  console.log('|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.weapon} | ${sg(r.reachOff)} | ${r.weapon === 'longsword' && r.foe === 'longsword' ? '기준' : sg(r.reachRel)} | ${r.nHit} |`);
  console.log('\n| 무기 | need 로 낸 칼 (준비에서) | 그 칼 헛침 · 멀리서 | need p50 | 그 칼 contactDist p50 | 그 칼 낸 거리 p50 | 그 칼 칼끝 남음 p50 | 낸 거리 p50 상처 낸 칼 · 헛친 칼 | 상대 롱소드 칼끝 남음 p50 | 판당 상처 준 · 받은 | 승 · 패 (판) | reachScale | 롱소드 상대의 어림 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.weapon} | ${r.app} / ${r.strikes} | ${pct(r.appMiss, r.app)} · ${pct(r.appFar, r.app)} | ${f2(r.needMed)} | ${f2(r.appCd)} | ${f2(r.appD0)} | ${sg(r.appTip)} | ${f2(r.d0HitMiss[0])} · ${f2(r.d0HitMiss[1])} | ${sg(r.otherTip)} | ${(r.wounds[0] / r.n).toFixed(1)} · ${(r.wounds[1] / r.n).toFixed(1)} | ${r.wins} · ${r.losses} (${r.n}) | ${f2(r.belief.reachScale)} | ${f2(r.foeOfMe)} |`);
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const args = rest.filter((x) => x.startsWith('--'));
  const ids = rest.filter((x) => !x.startsWith('--'));
  if (mode === 'fight') {
    const opt = { foe: argOf(args, 'foe', 'longsword'), seeds: seedList(argOf(args, 'seeds', '1-3')), secs: +argOf(args, 'secs', '30'), prof: +argOf(args, 'prof', '2') };
    const outDir = argOf(args, 'out', null);
    for (const w of ids) {
      const r = fightWeapon(w, opt);
      if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, `${w}${opt.foe !== 'longsword' ? `~${opt.foe}` : ''}.json`), JSON.stringify(r)); }
      print(summarize(r.weapon === 'longsword' ? [r] : [r]), false);
    }
  } else if (mode === 'sum') {
    const R = ids.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    print(summarize(R), args.includes('--md'));
  } else console.log('쓰는 법: ai_reach_fight.mjs fight <무기…> [--seeds=1-3] [--secs=30] [--prof=2] [--out=폴더] | sum <json…> [--md] (머리말)');
}
