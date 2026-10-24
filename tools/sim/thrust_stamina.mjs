// 찌르기 기력 값 재기 (사장님 10/24 11:4x '찌르기 기력 소모가 너무 적은 거 같애 지금 이탈리아는 거의 무한 공격이야. 아니면 이탈리아만 풋스텝에서 기력 소모 키울까?')
//  재기만 한다 — 본판 값(config.js STAMINA)은 이 프로세스 안에서만 바꾼다. 기록: docs/strike/thrust_stamina_2026-10-24.md
//
//  ai  — AI 대 AI (두 쪽 다 AI · 벽 있음 · 숙련도 prof · 실력 숫자 = AI_PROFICIENCY.levels[prof] — main.js 상대와 같은 짝). 판은 한쪽이 죽거나 secs 초에서 끝.
//        다섯 유파 칼(롱소드 · 레이피어 · 츠바이핸더 · 우치가타나 · 청강검) 짝 모두(거울 판 포함 15 짝) + 덧 칼(에스톡 · 티소나 — 독일 · 이베리아 찌르기 쪽) × 다섯 칼.
//        시드 seeds 개 (홀수 시드는 자리 바꿈 · 값을 바꾼 판끼리 같은 시드 — 짝지은 비교).
//        잼(칼마다 · 판 시간 합으로 나눔): 분당 베기 · 찌르기 수 · 분당 기력 청구(베기 · 찌르기 · 막아 받기 · 걷기 · 박차기 · 비기 · 클린치 · 위세) · 지침 / 심한 지침 / 탈진 시간 몫 ·
//        AI 기력 쉼(staminaRest — 20 아래에서 새 공격 멈춤) 시간 몫 · 판마다 가장 낮은 기력(평균 · 최저) · 분당 맞힌 상처(severity > 0) · 이김 / 비김 / 짐(거울 판 뺌)
//  bot — 사람 같은 손가락 봇 레이피어(기력 무한 아님 · 플레이어 회복 21/s): 간격 1.4 ~ 1.9 m 를 스틱으로 지키며 탭 찌르기. 앞 누름에서 gap 초(+ 0 ~ 0.15 s 흔들림) 뒤 · 앞 찌르기가 끝났으면 다시 누름
//        (누름 간격 = 찌르기 길이 ≈ 0.65 s 와 gap 가운데 긴 쪽 — gap 0 · 0.3 = 연타 ≈ 0.65 s · 0.6 ≈ 0.73 s · 1.0 ≈ 1.15 s) —
//        gap 0 = 게임이 받는 대로 연타. 상대: 'still'(AI 멈춤 · 칼만 듦) 또는 AI 칼(살아 있는 상대 — 상대 칼이 빠르게 오면 0.2 s 뒤 막기 단추 0.6 s).
//        잼: 첫 지침(0 아래)까지 찌르기 수 · 그 시각 · 30 s 동안 찌르기 수 · 지침 / 심한 지침 시간 몫 · 가장 낮은 기력
//
//  쓰기: node tools/sim/thrust_stamina.mjs ai  [thrust=7] [itStep=1.4] [prof=2] [seeds=8] [secs=30] [set=all|rapier] [out=파일.json]
//        node tools/sim/thrust_stamina.mjs bot [thrust=7] [gaps=0,0.3,0.6] [opps=still,longsword] [seeds=3] [secs=30]
//        node tools/sim/thrust_stamina.mjs aivp [thrust=7] [w=rapier,estoc] [prof=2] [seeds=6] [secs=30]   (AI 대 사람 봇 — 아래 aivpMode)
//        (thrust = 찌르기 값 · 모든 유파 · itStep = 이탈리아만 걷기 0.62 m 당 값 — 없으면 보통 1.4 그대로 · S.열쇠=값 = 그 밖 STAMINA 값)
import { newRound, DT, AI } from './harness_m.mjs';
import { STAMINA, AI_PROFICIENCY } from '../../src/config.js';
import { Stamina } from '../../src/stamina.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { writeFileSync } from 'node:fs';

const [mode = 'ai', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.split('=')));
if (opt.thrust != null) STAMINA.thrustCost = +opt.thrust;
if (opt.itStep != null) STAMINA.stepCosts = { ...STAMINA.stepCosts, italian: +opt.itStep };
for (const [k, v] of Object.entries(opt)) if (k.startsWith('S.')) STAMINA[k.slice(2)] = +v; // 그 밖 기력 값 (예: S.recoverDelay=1 — 견주기용)
const secs = +(opt.secs ?? 30);
const r1 = (x) => +x.toFixed(1), r2 = (x) => +x.toFixed(2), r3 = (x) => +x.toFixed(3);

// 베기 · 찌르기 청구를 따로 셈 (stamina.js chargeAttack 을 감쌈 — 값은 그대로, 장부만 더 봄)
const charge0 = Stamina.prototype.chargeAttack;
Stamina.prototype.chargeAttack = function (kind = 'cut', bundled, credit) {
  const a0 = this.spent.attack;
  charge0.call(this, kind, bundled, credit);
  this.byKind ??= { cut: 0, thrust: 0 };
  this.byKind[kind === 'thrust' ? 'thrust' : 'cut'] += this.spent.attack - a0;
  if (this.spent.attack > a0 || (this.infinite && !bundled)) (this.atkTimes ??= []).push(this.time); // 청구된 공격 시각 (공격 사이 틈)
};
const gapsOf = (st) => { const t = st.atkTimes ?? []; return t.slice(1).map((x, i) => x - t[i]); };

function aiMode() {
  const prof = +(opt.prof ?? 2), N = +(opt.seeds ?? 8);
  const level = AI_PROFICIENCY.levels[prof] ?? 'normal';
  const MAIN = ['longsword', 'rapier', 'zweihander', 'uchigatana', 'qinggang'];
  const EXTRA = ['estoc', 'tizona'];
  const pairs = [];
  if ((opt.set ?? 'all') === 'rapier') for (const b of MAIN) pairs.push(['rapier', b]);
  else {
    for (let i = 0; i < MAIN.length; i++) for (let j = i; j < MAIN.length; j++) pairs.push([MAIN[i], MAIN[j]]);
    for (const a of EXTRA) for (const b of MAIN) pairs.push([a, b]);
  }
  const samples = [];
  for (const [a, b] of pairs) for (let k = 0; k < N; k++) {
    const seed = 7300 + k, swap = k % 2 === 1;
    const wP = swap ? b : a, wE = swap ? a : b;
    const G = newRound({ walls: true, seed, weapon: wP, weapon2: wE, AI2Class: AI, difficulty: level, persona: { proficiency: prof }, persona2: { proficiency: prof } });
    try {
      const F = [G.player, G.enemy], C = [G.ai2, G.ai];
      const m = F.map(() => ({ lv: [0, 0, 0, 0], rest: 0, min: Infinity, tiredAtk: 0 }));
      let end = secs;
      for (let i = 0; i < Math.round(secs / DT); i++) {
        G.step();
        for (let s = 0; s < 2; s++) {
          const st = F[s].stamina;
          m[s].lv[st.exhausted ? 3 : st.level] += DT;
          if (C[s].staminaRest) m[s].rest += DT;
          m[s].min = Math.min(m[s].min, st.value);
        }
        if (!F[0].alive || !F[1].alive) { end = G.t; break; }
      }
      for (let s = 0; s < 2; s++) {
        const f = F[s], o = F[1 - s], st = f.stamina;
        const hits = G.wounds.filter((w) => w.att === f && w.severity > 0).length;
        samples.push({
          w: f.weapon.id, opp: o.weapon.id, trad: f.swordArt.tradition, seed, dur: end, mirror: a === b,
          res: f.alive && !o.alive ? 'W' : o.alive && !f.alive ? 'L' : 'D',
          cuts: st.counts.cut, thrusts: st.counts.thrust, blocks: st.counts.block, secrets: st.counts.secret, exh: st.counts.exhaustion,
          sp: { cut: st.byKind?.cut ?? 0, thrust: st.byKind?.thrust ?? 0, block: st.spent.block, move: st.spent.move, push: st.spent.push, secret: st.spent.secret, clinch: st.spent.clinch, awe: st.spent.awe ?? 0 },
          rec: st.recovered, gaps: gapsOf(st), lv: m[s].lv, rest: m[s].rest, min: m[s].min, weight: st.weight, hits,
        });
      }
    } finally {
      G.world.free();
    }
  }
  return { mode: 'ai', thrust: STAMINA.thrustCost, itStep: STAMINA.stepCosts.italian ?? STAMINA.stepCosts.default, prof, level, seeds: N, secs, samples };
}

/** 칼마다 묶음 (bot 이 아니라 ai 결과) */
export function summarize(R) {
  const by = {};
  for (const s of R.samples) (by[s.w] ??= []).push(s);
  const out = {};
  for (const [w, L] of Object.entries(by)) {
    const T = L.reduce((a, s) => a + s.dur, 0), pm = (x) => r1((x * 60) / T);
    const sum = (f) => L.reduce((a, s) => a + f(s), 0);
    const nm = L.filter((s) => !s.mirror);
    const cause = Object.fromEntries(['cut', 'thrust', 'block', 'move', 'push', 'secret', 'clinch', 'awe'].map((k) => [k, pm(sum((s) => s.sp[k]))]));
    out[w] = {
      n: L.length, minutes: r1(T / 60), meanDur: r1(T / L.length), weight: r3(L[0].weight),
      cutPm: pm(sum((s) => s.cuts)), thrustPm: pm(sum((s) => s.thrusts)), blockPm: pm(sum((s) => s.blocks)),
      spendPm: cause, spendTotalPm: r1(Object.values(cause).reduce((a, x) => a + x, 0)), recPm: pm(sum((s) => s.rec)),
      tired: r3(sum((s) => s.lv[1]) / T), severe: r3(sum((s) => s.lv[2]) / T), exhausted: r3(sum((s) => s.lv[3]) / T), restShare: r3(sum((s) => s.rest) / T),
      minMean: r1(sum((s) => s.min) / L.length), minLow: r1(Math.min(...L.map((s) => s.min))), exhPerRound: r2(sum((s) => s.exh) / L.length),
      hitsPm: pm(sum((s) => s.hits)),
      ...(() => { const g = L.flatMap((s) => s.gaps ?? []).sort((a, b) => a - b); const q = (p) => (g.length ? r2(g[Math.min(g.length - 1, Math.floor(p * g.length))]) : null); return { gapP25: q(0.25), gapMed: q(0.5), gapUnder1: r3(g.filter((x) => x < 1).length / Math.max(1, g.length)) }; })(),
      win: nm.filter((s) => s.res === 'W').length, draw: nm.filter((s) => s.res === 'D').length, loss: nm.filter((s) => s.res === 'L').length,
      winRate: r3(nm.filter((s) => s.res === 'W').length / Math.max(1, nm.length)),
      vs: Object.fromEntries([...new Set(nm.map((s) => s.opp))].map((o) => { const v = nm.filter((s) => s.opp === o); return [o, `${v.filter((s) => s.res === 'W').length}-${v.filter((s) => s.res === 'D').length}-${v.filter((s) => s.res === 'L').length}`]; })),
    };
  }
  return out;
}

function botMode() {
  const gaps = (opt.gaps ?? '0,0.3,0.6').split(',').map(Number);
  const opps = (opt.opps ?? 'still,longsword').split(',');
  const N = +(opt.seeds ?? 3);
  const rows = [];
  for (const opp of opps) for (const gap of gaps) for (let k = 0; k < N; k++) {
    const seed = 8100 + k;
    let rs = (seed * 7919 + Math.round(gap * 1000)) >>> 0;
    const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
    const G = newRound({ walls: true, seed, weapon: 'rapier', weapon2: opp === 'still' ? 'longsword' : opp, gap: 3 });
    try {
      const D = G.player, A = G.enemy;
      if (opp === 'still') G.ai.update = () => { A.move.set(0, 0); };
      D.skill.autoGuard = true;
      const guard = new PlayerParryGuard(D, A);
      D.stamina.controller = guard;
      for (let i = 0; i < 120; i++) G.step(); // 1 s 자세 잡기 뒤 새 장부
      D.stamina = new Stamina(D); D.stamina.controller = guard;
      const st = D.stamina, t0 = G.t;
      let next = 0, heldUntil = 0, due = Infinity, lastMotion = -1, notice = false;
      let first = null, firstSevere = null, tired = 0, severe = 0, min = Infinity, tapsTried = 0;
      G.before = () => {
        const t = G.t - t0, dist = D.foeDistance();
        if (opp !== 'still') {
          const motion = dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
          if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity) { due = t + 0.2 + rnd() * 0.08; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
          if (t >= due) { heldUntil = t + 0.6; due = Infinity; }
        }
        guard.held = t < heldUntil && !D.skill.tap;
        guard.broken = !!D.skill.tap;
        if (!guard.held && !D.skill.tap && t >= next && dist < 2.0 && D.alive && D.armed && !st.exhausted) {
          tapsTried++;
          if (D.skill.thrust()) next = t + gap + rnd() * 0.15;
        }
        guard.step(DT);
        D.inputActive = guard.active;
        if (st.exhausted || !D.alive) D.move.set(0, 0);
        else D.move.set(0.15 * Math.sin(t * 0.7 + seed), dist < 1.4 ? -0.5 : dist > 1.9 ? 0.5 : 0);
        D.stickX = D.move.x; D.stickY = D.move.y;
      };
      let end = secs;
      for (let i = 0; i < Math.round(secs / DT); i++) {
        G.step();
        const t = G.t - t0;
        if (first == null && st.value < 0) first = { t: r2(t), thrusts: st.counts.thrust };
        if (firstSevere == null && st.level >= 2) firstSevere = { t: r2(t), thrusts: st.counts.thrust };
        if (st.level === 1) tired += DT;
        if (st.level >= 2) severe += DT;
        min = Math.min(min, st.value);
        if (!D.alive || !A.alive) { end = t; break; }
      }
      rows.push({ opp, gap, seed, dur: r1(end), thrusts: st.counts.thrust, thrustPm: r1((st.counts.thrust * 60) / end), blocks: st.counts.block, firstTired: first, firstSevere, exh: st.counts.exhaustion,
        tiredShare: r3(tired / end), severeShare: r3(severe / end), min: r1(min), spend: { thrust: r1(st.byKind?.thrust ?? 0), block: r1(st.spent.block), move: r1(st.spent.move) }, pAlive: D.alive, eAlive: A.alive, tapsTried });
    } finally {
      G.world.free();
    }
  }
  return { mode: 'bot', thrust: STAMINA.thrustCost, secs, rows };
}

/** AI 대 사람 봇: 상대 AI(칼 W) 쪽만 잰다. 사람 봇 = 롱소드 · 기력 무한(용사의 눈물 — 사장님이 보통 끼는 것) · 상대 칼이 빠르게 오면 0.2 s 뒤 막기 단추 0.6 s ·
 *  간격 안(2.0 m)이면 1.2 ~ 2.0 s 마다 가로 긋기 한 번(손 ±0.45 · 0.18 s — stamina_table 손길) · 1.5 ~ 2.2 m 를 스틱으로 지킴 */
function aivpMode() {
  const prof = +(opt.prof ?? 2), N = +(opt.seeds ?? 6);
  const level = AI_PROFICIENCY.levels[prof] ?? 'normal';
  const W = (opt.w ?? 'longsword,rapier,zweihander,uchigatana,qinggang,estoc,tizona').split(',');
  const samples = [];
  for (const w of W) for (let k = 0; k < N; k++) {
    const seed = 7600 + k;
    let rs = (seed * 104729) >>> 0;
    const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
    const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: w, difficulty: level, persona: { proficiency: prof } });
    try {
      const D = G.player, A = G.enemy;
      D.skill.autoGuard = true;
      D.stamina.setInfinite(true);
      const guard = new PlayerParryGuard(D, A);
      D.stamina.controller = guard;
      let heldUntil = 0, due = Infinity, lastMotion = -1, notice = false, next = 2, cut = null, dir = 1;
      G.before = (t) => {
        const dist = D.foeDistance();
        const motion = dist < 2.4 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
        if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity) { due = t + 0.2 + rnd() * 0.08; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
        if (t >= due) { heldUntil = t + 0.6; due = Infinity; }
        if (!cut && t >= next && t >= heldUntil && dist < 2.0 && D.alive && D.armed) { cut = { t0: t }; dir = -dir; next = t + 1.2 + rnd() * 0.8; }
        guard.held = t < heldUntil && !cut;
        guard.broken = !!cut;
        guard.step(DT);
        D.inputActive = guard.active;
        if (cut) {
          const u = Math.min(1, (t - cut.t0) / 0.18);
          D.handOffset.set(dir * (-0.45 + 0.9 * u), 0.12); D.handHeld = true; D.inputActive = true;
          if (t - cut.t0 > 0.45) cut = null;
        }
        D.move.set(0.15 * Math.sin(t * 0.6 + seed), dist < 1.5 ? -0.5 : dist > 2.2 ? 0.5 : 0);
        D.stickX = D.move.x; D.stickY = D.move.y;
      };
      const m = { lv: [0, 0, 0, 0], rest: 0, min: Infinity };
      let end = secs;
      for (let i = 0; i < Math.round(secs / DT); i++) {
        G.step();
        const st = A.stamina;
        m.lv[st.exhausted ? 3 : st.level] += DT;
        if (G.ai.staminaRest) m.rest += DT;
        m.min = Math.min(m.min, st.value);
        if (!D.alive || !A.alive) { end = G.t; break; }
      }
      const st = A.stamina;
      samples.push({ w, opp: 'bot', trad: A.swordArt.tradition, seed, dur: end, mirror: false, res: A.alive && !D.alive ? 'W' : D.alive && !A.alive ? 'L' : 'D',
        cuts: st.counts.cut, thrusts: st.counts.thrust, blocks: st.counts.block, secrets: st.counts.secret, exh: st.counts.exhaustion,
        sp: { cut: st.byKind?.cut ?? 0, thrust: st.byKind?.thrust ?? 0, block: st.spent.block, move: st.spent.move, push: st.spent.push, secret: st.spent.secret, clinch: st.spent.clinch, awe: st.spent.awe ?? 0 },
        rec: st.recovered, gaps: gapsOf(st), lv: m.lv, rest: m.rest, min: m.min, weight: st.weight, hits: G.wounds.filter((x) => x.att === A && x.severity > 0).length, botCuts: D.stamina.counts.cut });
    } finally {
      G.world.free();
    }
  }
  return { mode: 'aivp', thrust: STAMINA.thrustCost, itStep: STAMINA.stepCosts.italian ?? STAMINA.stepCosts.default, prof, level, seeds: N, secs, samples };
}

const R = mode === 'bot' ? botMode() : mode === 'aivp' ? aivpMode() : aiMode();
if (mode !== 'bot') R.summary = summarize(R);
if (opt.out) writeFileSync(opt.out, JSON.stringify(R));
console.log(JSON.stringify(mode === 'bot' ? R : { ...R, samples: undefined }, null, 1));
