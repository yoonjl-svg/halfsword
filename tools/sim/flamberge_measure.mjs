// 플랑베르주 간격 재기 (10/29 15:xx 사장님 '봐' — docs/strike/flamberge_measure_2026-10-29.md)
//  손 표(src/weapon_measured.js) 플랑베르주 [1.91, 2.57, 1.52, 0.77] 이 츠바이핸더 [1.68, 2.01, 1.30, 0.47] 보다 맞닿기 23 cm · 칼끝 거리 56 cm 큰데
//   손 ~ 칼끝은 5 cm 만 길다(1.385 · 1.335 m) — 어디서 오는지 · 그 값을 쓰는 AI 가 실제로 어떻게 싸우는지 잰다. 읽기 · 재기만(게임 값을 바꾸지 않는다).
//
//  node tools/sim/flamberge_measure.mjs gen [무기…]
//    생성기 분해: weapon_measure.mjs measureSwing 과 같은 대본(시작 정지 0 · --down · 이베리아 자세표 끔 = 10/27 손 표 줄의 조건)을 다시 돌려
//    가장 먼 순간의 몫을 나눈다 — 가슴이 간 거리(몸 이동) · 칼날 70 % 지점이 그때 제 가슴 앞에 있던 거리(칼 · 팔) · 그때 칼날 70 % 빠르기.
//    발 셋: stand = 생성기 contact · walk = 생성기 reach(스틱 앞 3 s 내내) · step = 걸음을 AI 한 걸음처럼(베기 0.04 s 뒤 스틱 앞 0.3 s — ai.js STEP_T · 그 뒤 −0.21 멈춤).
//  node tools/sim/flamberge_measure.mjs duel <짝…> [--seeds=1-24] [--secs=40] [--json=파일]
//    AI 대 AI: 짝 = 'ratna:flamberge~ratna:zweihander' 처럼 '인물:무기~인물:무기' (앞이 재는 쪽 A). 시드마다 자리를 바꿈(홀 = A 가 E).
//    다른 무기를 쥐면 꾸러미도 그 무기 것(main.js 와 같은 규칙 — persona.school = 무기 id). 쪽마다 칼(startStrike) 하나씩: 시작 가슴 거리 ·
//    상처 낸 칼 · 칼끼리만 닿음 · 헛침(몸에도 칼에도 안 닿음 — ai.js afterStrike 'missed' 와 같은 가름) · 칼날 70 % 가 시작 가슴에서 상대 쪽으로 간 가장 먼 거리(걸음 몫 포함) ·
//    칼날 ↔ 상대 머리 · 목 · 가슴 가운데 가장 가까움 · 판당 상처 · 승(죽음 — 둘 다 살면 피 많은 쪽) · 둘 다 선 동안의 가슴 거리 시간 분포(0.05 m 칸)
//  node tools/sim/flamberge_measure.mjs sum <json…>
//    duel --json 파일들을 한 표로: 판(손 표 판)마다 쪽별 위 수 · 칼끝 거리 밖 시간(TRUE_REACH 밖 — 아래) · 시작 거리 칸별 상처 낸 칼
//  손 표 판은 with_config 로 앞에: `node tools/sim/with_config.mjs WEAPON_MEASURE.flambergeFix=geo flamberge_measure.mjs duel …` (기본 'off' = 지금 표 · 주소 ?flMeasure=)
import fs from 'node:fs';
import { newRound, DT, AI } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { ARENA, WEAPON_MEASURE } from '../../src/config.js';
import { SCHOOL_ART } from '../../src/schools.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { WEAPONS } from '../../src/weapons.js';
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const MONTANTE = ['longsword', 'zweihander', 'tizona', 'durandal', 'flamberge'];
const f2 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(2));
const f3 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(3));
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(0)} %` : '-');
const q = (a, p) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const argOf = (args, k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const seedList = (s) => { if (s.includes('-')) { const [a, b] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); } return s.split(',').map(Number); };

// ── gen: 생성기 분해 ─────────────────────────────────────────────────────────────
const ZORN = TECH_BY_NAME.zornhau;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** measureSwing(weapon_measure.mjs) 과 같은 대본 · 같은 셈(down) — 가장 먼 순간의 몫을 함께 적는다 (feet: 'stand' | 'walk' | 'step' — 머리말) */
export function swingParts(id, feet = 'stand') {
  const G = newRound({ weapon: id, weapon2: id, seed: 1 });
  G.park();
  const att = G.player;
  const path = [ZORN.from, ...ZORN.path];
  let phase = 'chamber', phaseT = 0, prevY = null, prevP = null, sc = null, sf = null;
  let best = { raw: -Infinity };
  for (let i = 0; i < 3 / DT; i++) {
    phaseT += DT;
    if (phase === 'chamber') {
      att.handOffset.set(ZORN.from[0], ZORN.from[1]);
      att.move.set(0, 0);
      if (phaseT > 0.5) {
        phase = 'swing';
        phaseT = 0;
        const c = att.bodies.chest.translation();
        sc = { x: c.x, z: c.z };
        const f = att.forward();
        sf = { x: f.x, z: f.z };
      }
    } else {
      const u = Math.min(1, phaseT / 0.35);
      const seg = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const [x, y] = lerp(seg[0], seg[1], seg[2]);
      att.handOffset.set(x, y);
      const fwd = feet === 'walk' ? 1 : feet === 'step' ? (phaseT > 0.04 && phaseT <= 0.34 ? 1 : -0.21) : 0;
      att.move.set(0, fwd);
    }
    G.step();
    if (phase !== 'swing') continue;
    const p = att.bladePoint(0.7);
    const sp = prevP ? Math.hypot(p.x - prevP.x, p.y - prevP.y, p.z - prevP.z) / DT : 0;
    prevP = { x: p.x, y: p.y, z: p.z };
    const falling = prevY == null || p.y < prevY;
    prevY = p.y;
    if (!(p.y > 1.45 && p.y < 1.75 && falling)) continue;
    const c = att.bodies.chest.translation();
    const fw = (v, o) => (v.x - o.x) * sf.x + (v.z - o.z) * sf.z;
    const raw = fw(p, sc);
    if (raw > best.raw) best = { raw, t: phaseT, travel: fw(c, sc), blade: fw(p, c), speed: sp };
  }
  G.world.free();
  return best;
}

function runGen(ids) {
  ARENA.startHold = 0;
  SCHOOL_ART.table = false; // 10/27 손 표 줄의 조건 (이 도구는 이베리아 자세표에서 앞무게 칼을 못 잰다 — weapon_measured.js 플랑베르주 10/14 주석)
  const ls = swingParts('longsword', 'stand');
  const K = 1.62 / ls.raw;
  console.log(`생성기 분해 (시작 정지 0 · 내려오는 동안만 · 이베리아 자세표 끔) — 롱소드 raw ${ls.raw.toFixed(4)} m → 보정 배율 K ${K.toFixed(4)}`);
  console.log('값 = 생성기 단위(× K). 가장 먼 거리 = 가슴 이동(× K) + 칼날 70 % 가 그때 제 가슴 앞(× K). 빠르기 = 그때 칼날 70 % 지점 빠르기(m/s, 날것)');
  console.log('| 무기 | 손 ~ 칼끝 | 손 ~ 70 % | 발 | 가장 먼 거리 | 때 s | 가슴 이동 | 칼 몫 | 70 % 빠르기 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  const out = {};
  for (const id of ids) {
    const w = WEAPONS[id];
    out[id] = {};
    for (const feet of ['stand', 'walk', 'step']) {
      const b = id === 'longsword' && feet === 'stand' ? ls : swingParts(id, feet);
      out[id][feet] = { gen: b.raw * K, t: b.t, travel: b.travel * K, blade: b.blade * K, speed: b.speed };
      console.log(`| ${id} | ${f3(w.hiltLength + w.bladeLength)} | ${f3(w.hiltLength + 0.7 * w.bladeLength)} | ${feet} | ${(b.raw * K).toFixed(4)} | ${f3(b.t)} | ${(b.travel * K).toFixed(4)} | ${(b.blade * K).toFixed(4)} | ${f2(b.speed)} |`);
    }
  }
  return { K, rows: out };
}

// ── duel: AI 대 AI ─────────────────────────────────────────────────────────────
/** 칼끝 거리 밖 시간의 잣대 (m, 가슴과 가슴): 이 거리 밖에서 시작한 칼은 가까이서 낸 칼의 절반도 못 맞힌다.
 *  sum 이 모든 싸움 칼(판 · 짝 · 쪽 · 시드 묶음)을 무기마다 모아 시작 거리 0.1 m 칸별 상처 낸 몫을 보고, 그 몫이 1.4 ~ 1.8 m 칸 몫의 절반 아래로 처음 떨어지는 칸의 아래 끝 (realReach).
 *  표 판과 상관없는 무기 몸 값이라 판마다 같은 잣대를 쓴다 — 10/29 재기 값(기록 §3-1) */
export const TRUE_REACH = { longsword: 2.0, zweihander: 2.0, flamberge: 2.1 }; // 티소나 · 뒤랑달은 칸마다 칼이 모자라 안 셈
/** 모은 칼 L 에서 위 잣대를 셈 — 1.4 ~ 1.8 m 몫의 절반 아래로 처음 떨어지는 0.1 m 칸(칼 20 개 이상)의 아래 끝 */
export function realReach(L) {
  const share = (lo, hi) => { const B = L.filter((s) => s.d0 >= lo && s.d0 < hi); return B.length ? B.filter((s) => s.out === 'hit').length / B.length : NaN; };
  const near = share(1.4, 1.8);
  for (let x = 1.8; x < 2.8; x += 0.1) {
    const B = L.filter((s) => s.d0 >= x && s.d0 < x + 0.1);
    if (B.length >= 20 && share(x, x + 0.1) < near / 2) return +x.toFixed(1);
  }
  return null;
}
const BINS = [[0, 1.6], [1.6, 1.8], [1.8, 2.0], [2.0, 2.2], [2.2, 9]];

function sideStats() {
  return { list: [], dHist: {}, sec: { fired: 0, landed: 0 }, strikeWounds: 0, strikes: 0, feints: 0, hit: 0, bound: 0, miss: 0, wounds: 0, sev: 0, standT: 0, holdD: [], wins: 0, losses: 0, draws: 0, fights: 0, secrets: 0 };
}

const chestDist = (a, b) => { const p = a.bodies.chest.translation(), r = b.bodies.chest.translation(); return Math.hypot(p.x - r.x, p.z - r.z); };

function personaFor(charId, weapon) {
  const C = CHARACTERS_BY_ID[charId];
  if (!C) throw new Error(`인물 없음: ${charId}`);
  const P = C.ai.persona ?? {};
  return { level: C.ai.level, persona: weapon !== C.weapon ? { ...P, school: weapon } : P, revive: C.revive }; // main.js 와 같은 규칙: 다른 무기를 쥐면 꾸러미도 그 무기 것으로
}

/** 한 AI 의 칼을 하나씩 센다 (다음 칼 · 새 공격 · 공격 꼴이 끝나면 앞 칼을 닫는다 — 그때까지의 맞힘 · 칼끼리 닿음 · 그 칼 동안 낸 상처).
 *  칼마다 { d0 시작 가슴 거리, reach 칼날 70 % 지점이 시작 가슴에서 시작 때 상대 쪽으로 간 가장 먼 거리(걸음 몫 포함 · 1 s 안), gap 칼날 ↔ 상대 머리 · 목 · 가슴 가운데 가장 가까움, out 'hit'|'bound'|'miss' } */
const PARTS = ['head', 'neck', 'chest'];
function tapAI(ai, G, me, S) {
  let cur = null, appAt = null, prevPhase = null; // appAt: 이번 공격이 approach(준비 자세에서 다가감 · 칼이 자리 잡는 때)에 든 때
  const close = () => {
    if (!cur) return;
    const w = G.wounds.filter((x) => x.att === me && x.t >= cur.t0 && x.t <= G.t + 1e-9).length;
    const out = w > 0 || cur.landed ? 'hit' : cur.bound ? 'bound' : 'miss';
    S[out]++;
    S.strikeWounds += w;
    S.list.push({ d0: +cur.d0.toFixed(3), reach: +cur.reach.toFixed(3), gap: +cur.gap.toFixed(3), out, tech: cur.tech, why: cur.why, need: cur.need, secret: cur.secret, app: cur.app });
    cur = null;
  };
  const sa = ai.startAttack, ss = ai.startStrike;
  ai.startAttack = function () { close(); return sa.apply(this, arguments); };
  ai.startStrike = function () {
    close();
    const r = ss.apply(this, arguments);
    S.strikes++;
    if (this.feint) S.feints++;
    if (this.secretRun) S.secrets++;
    const d0 = chestDist(this.me, this.foe);
    const c = this.me.bodies.chest.translation(), o = this.foe.bodies.chest.translation();
    const app = appAt != null && this.phase === 'strike' ? +(G.t - appAt).toFixed(3) : null; // approach 에 머문 시간 (이어 치기 · 흐름은 null)
    appAt = null;
    cur = { app, t0: G.t, landed: false, bound: false, d0, c0: { x: c.x, z: c.z }, u: { x: (o.x - c.x) / d0, z: (o.z - c.z) / d0 }, reach: -9, gap: 9, tech: this.tech?.name, why: this.why, need: this.need != null ? +this.need.toFixed(3) : null, secret: !!this.secretRun };
    return r;
  };
  return {
    step() {
      if (ai.phase === 'approach' && prevPhase !== 'approach') appAt = G.t;
      prevPhase = ai.phase;
      if (!cur) return;
      cur.landed ||= ai.hitLanded;
      cur.bound ||= ai.bound;
      if (G.t - cur.t0 <= 1.0) {
        const p = me.bladePoint(0.7);
        cur.reach = Math.max(cur.reach, (p.x - cur.c0.x) * cur.u.x + (p.z - cur.c0.z) * cur.u.z);
        for (let k = 0; k <= 10; k += 2) {
          const qp = me.bladePoint(k / 10);
          for (const part of PARTS) {
            const b = ai.foe.bodies[part]?.translation();
            if (b) cur.gap = Math.min(cur.gap, Math.hypot(qp.x - b.x, qp.y - b.y, qp.z - b.z));
          }
        }
      }
      if (ai.mode !== 'attack' && ai.mode !== 'secret') close();
    },
    end: close,
  };
}

function runDuel(pair, args) {
  const seeds = seedList(argOf(args, 'seeds', '1-24'));
  const secs = +argOf(args, 'secs', '40');
  const [a, b] = pair.split('~').map((s) => { const [char, weapon] = s.split(':'); return { char, weapon: weapon ?? CHARACTERS_BY_ID[char].weapon }; });
  const SA = sideStats(), SB = sideStats();
  for (const seed of seeds) {
    const subjE = seed % 2 === 1; // 홀 시드 = A 가 E(G.ai)
    const E = subjE ? a : b, P = subjE ? b : a;
    const pe = personaFor(E.char, E.weapon), pp = personaFor(P.char, P.weapon);
    const G = newRound({ seed, walls: true, weapon: P.weapon, weapon2: E.weapon, persona: pe.persona, difficulty: pe.level, AI2Class: AI, persona2: pp.persona, difficulty2: pp.level, revive: pe.revive, revive2: pp.revive });
    const sideE = subjE ? SA : SB, sideP = subjE ? SB : SA;
    const tE = tapAI(G.ai, G, G.enemy, sideE), tP = tapAI(G.ai2, G, G.player, sideP);
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      tE.step();
      tP.step();
      const both = G.enemy.alive && G.player.alive && G.enemy.state === 'stand' && G.player.state === 'stand' && G.t > ARENA.startHold;
      if (both) {
        const d = chestDist(G.enemy, G.player);
        const k = (Math.floor(d / 0.05) * 0.05).toFixed(2);
        for (const S of [sideE, sideP]) {
          S.standT += DT;
          S.dHist[k] = (S.dHist[k] ?? 0) + DT;
        }
        if (G.ai.mode === 'watch' && i % 10 === 0) sideE.holdD.push(+d.toFixed(3));
        if (G.ai2.mode === 'watch' && i % 10 === 0) sideP.holdD.push(+d.toFixed(3));
      }
      if (!G.enemy.alive || !G.player.alive) break;
    }
    tE.end();
    tP.end();
    for (const [ai, S] of [[G.ai, sideE], [G.ai2, sideP]]) for (const v of Object.values(ai.stats.secrets ?? {})) { S.sec.fired += v.fired ?? 0; S.sec.landed += v.landed ?? 0; } // 비기(싱지르 등 — startStrike 를 안 거치는 대본 칼 포함)
    for (const w of G.wounds) {
      const S = w.att === G.enemy ? sideE : sideP;
      S.wounds++;
      S.sev += w.severity ?? 0;
    }
    const eA = G.enemy.alive, pA = G.player.alive;
    const win = eA && !pA ? 'E' : pA && !eA ? 'P' : !eA && !pA ? 'D' : G.enemy.blood === G.player.blood ? 'D' : G.enemy.blood > G.player.blood ? 'E' : 'P';
    for (const [S, me] of [[sideE, 'E'], [sideP, 'P']]) {
      S.fights++;
      if (win === 'D') S.draws++;
      else if (win === me) S.wins++;
      else S.losses++;
    }
    G.world.free();
  }
  const res = { pair, A: { ...a, ...SA }, B: { ...b, ...SB }, seeds, secs, fix: WEAPON_MEASURE.flambergeFix, row: [...MEASURED.flamberge], cut: CUT_TIME_30.flamberge };
  printDuel(res);
  const json = argOf(args, 'json', null);
  if (json) fs.writeFileSync(json, JSON.stringify(res));
  return res;
}

const outOf = (S, R) => { if (R == null) return NaN; let t = 0; for (const [k, v] of Object.entries(S.dHist)) if (+k >= R - 1e-9) t += v; return S.standT ? t / S.standT : NaN; };
function binLine(S) {
  return BINS.map(([lo, hi]) => { const L = S.list.filter((s) => s.d0 >= lo && s.d0 < hi); return `${hi > 8 ? `${lo}+` : `${lo}~${hi}`} ${L.filter((s) => s.out === 'hit').length}/${L.length}`; }).join(' · ');
}
function printDuel(r) {
  console.log(`\n## ${r.pair} · 시드 ${r.seeds[0]} ~ ${r.seeds[r.seeds.length - 1]} (${r.seeds.length} 판 · ${r.secs} s) · 판 WEAPON_MEASURE.flambergeFix = ${r.fix} · 플랑베르주 줄 [${r.row.join(', ')}] · 꾸러미 베는 시간 ${r.cut}`);
  console.log('| 쪽 | 칼 | 시작 가슴 거리 p50 [p25 ~ p75] | 헛침 | 상처 낸 칼 | 칼끼리만 | 판당 상처 | 승 (승/무/패) | 칼끝 거리 밖 시간 | 간 보는 거리 p50 | 70 % 간 거리 p50 · p90 | 칼 ↔ 몸 p50 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const S of [r.A, r.B]) {
    const d0 = S.list.map((s) => s.d0);
    console.log(`| ${S.char}:${S.weapon} | ${S.strikes} | ${f2(q(d0, 0.5))} [${f2(q(d0, 0.25))} ~ ${f2(q(d0, 0.75))}] | ${pct(S.miss, S.strikes)} | ${pct(S.hit, S.strikes)} | ${pct(S.bound, S.strikes)} | ${f2(S.wounds / S.fights)} | ${pct(S.wins, S.fights)} (${S.wins}/${S.draws}/${S.losses}) | ${pct(100 * outOf(S, TRUE_REACH[S.weapon]), 100)} | ${f2(q(S.holdD, 0.5))} | ${f2(q(S.list.map((s) => s.reach), 0.5))} · ${f2(q(S.list.map((s) => s.reach), 0.9))} | ${f2(q(S.list.map((s) => s.gap), 0.5))} |`);
  }
  for (const S of [r.A, r.B]) console.log(`  ${S.char}:${S.weapon} 시작 거리 칸별 상처 낸 칼: ${binLine(S)}${S.sec ? ` · 비기 냄 ${S.sec.fired} · 맞힘 ${S.sec.landed} · 칼(startStrike) 밖 상처 ${S.wounds - S.strikeWounds}` : ''}`);
}

// ── sum: duel --json 파일들을 한 표로 ─────────────────────────────────────────────
function runSum(files) {
  const R = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  for (const r of R) printDuel(r);
  // 무기마다 모든 칼(판 · 짝 · 쪽)을 모아 시작 거리 0.1 m 칸별 상처 낸 몫 — TRUE_REACH 를 고른 표
  const pool = {};
  for (const r of R) for (const S of [r.A, r.B]) (pool[S.weapon] ??= []).push(...S.list);
  console.log('\n## 무기마다 모든 칼 — 시작 가슴 거리 0.1 m 칸별 상처 낸 칼 / 칼 (판 · 짝 · 쪽 모두)');
  const edges = []; for (let x = 1.3; x <= 2.6 + 1e-9; x += 0.1) edges.push(+x.toFixed(1));
  console.log(`| 무기 | ${edges.map((x) => `${x.toFixed(1)}~`).join(' | ')} |`);
  console.log(`|---|${edges.map(() => '---').join('|')}|`);
  for (const [w, L] of Object.entries(pool)) console.log(`| ${w} | ${edges.map((x) => { const B = L.filter((s) => s.d0 >= x && s.d0 < x + 0.1); return B.length ? `${pct(B.filter((s) => s.out === 'hit').length, B.length)} (${B.length})` : '-'; }).join(' | ')} |`);
  console.log(`\n실제 칼끝 거리(realReach — 1.4 ~ 1.8 m 몫의 절반 아래로 처음 떨어지는 칸): ${Object.entries(pool).map(([w, L]) => `${w} ${realReach(L) ?? '-'} (TRUE_REACH ${TRUE_REACH[w] ?? '-'} · 손 표 reach ${MEASURED[w]?.[1] ?? '-'})`).join(' · ')}`);
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const args = rest.filter((x) => x.startsWith('--'));
  const ids = rest.filter((x) => !x.startsWith('--'));
  if (mode === 'gen') runGen(ids.length ? ids : MONTANTE);
  else if (mode === 'duel') for (const p of ids) runDuel(p, args);
  else if (mode === 'sum') runSum(ids);
  else console.log('쓰는 법: flamberge_measure.mjs gen | duel <짝…> | sum <json…> (머리말)');
}
