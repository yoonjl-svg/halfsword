// ─────────────────────────────────────────────────────────────
//  mordschlag_ai.mjs — AI 모르트슐라크 재기 (10/24 사장님 12:0x 'ai도 비기 쓰게 해' — ai.js mordTick · SECRET.aiOpenSchools 'german' · docs/strike/german_mordschlag_2026-10-22.md §12)
//   독일 인물 AI(숙련도 AI_PROFICIENCY.secretAt 이상 — 아르토리아 · 광기의 아르토리아 5) 대 맞수. --mord=0 = 독일을 aiOpenSchools 에서 뺀 판(같은 시드 견줌 — 바꾸기 전).
//
//  node tools/sim/mordschlag_ai.mjs [--heroes=artoria] [--opps=human,still,block,back,backblock,isolde,liao,omari,tome,minami] [--seeds=1-6] [--dur=30] [--mord=1|0] [--walkStrike=1|0] [--json=파일] [--quiet]
//   --walkStrike: SECRET.mordWalkStrike (10/24 13:3x 걸어가며 치기 — 0 = 걸어가는 동안 안 침 12:0x 판)
//   맞수: 인물 id = 인물 AI(사람 자리 · 인물 시트 그대로 — AI2Class) ·
//    사람 자리 봇(롱소드 · 용사의 눈물 = 기력 무한 · 칼은 기본 자세 · 막기 단추 · 스틱만 — 사람 반응 0.12 ~ 0.30 s, mordschlag_duel.mjs 와 같은 수):
//    human = 기본 AI 'normal'(무작위 성격 — fights12 의 사람 자리와 같은 몸) + 기력 무한 · still = 아무 입력 없음 · block = 막기 단추를 늘 쥠 ·
//    back = 누르기를 느끼면(상대 밀치기 누르기가 시작되고 반응 시간 뒤) 스틱 뒤로 — 누르기가 끝날 때까지 · backblock = block + back
//   판마다: 이긴 쪽(먼저 죽은 쪽이 짐 · 같은 스텝이거나 끝까지 살면 무) · 영웅 누르기 시작 수 · 1.5 s(SECRET.mordPress) 넘게 이어진 누르기 수 · 가장 긴 누르기 · 누르기 끝 까닭 ·
//    몸 붙이기로 간 수(ai.js mordPressGo) · 창 수 · 낸 수 · 맞힘(그 비기 동안 상대 아픔 +0.05 — 검술 층 run.landed) · 머리 맞음 · 머리 J(투구 배율 곱함 — 일격 ~ 끝 + 1.5 s) · 넘어짐(일격 ~ 끝 + 1.5 s 안 무릎 · 쓰러짐 · 일어나기) ·
//    기절 · 죽음(같은 창 — 의식 0) · 막힘(운동학 길 상대 칼 먼저) · 준 · 받은 상처 심각도 합 · 판 길이 ·
//    걸어 들어간 덩이(ai.js mordWalking — 붙이러 간 뒤 밀치기 전) 하나하나 [초, 끝: barge 밀치기 · attack 걸어가며 침 · 그 밖 꼴(defend · withdraw …)]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, AI, CONFIG, DT } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',')) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};
const { SECRET, CLOSE, SKILL } = CONFIG;
if (arg('mord', '1') === '0') SECRET.aiOpenSchools = SECRET.aiOpenSchools.filter((s) => s !== 'german');
if (args.walkStrike != null) SECRET.mordWalkStrike = +args.walkStrike ? 1 : 0; // 걸어가며 치기 (10/24 13:3x — 0 = 12:0x 판)
const DUR = +arg('dur', 30);
// --why=watch,clinch: 몸 붙이기 사건 가운데 이것만 (ai.js mordPressGo — 시험 견줌 · 'barge' 걸쇠는 늘)
if (args.why) {
  const W = new Set(list('why', ''));
  const orig = AI.prototype.mordPressGo;
  AI.prototype.mordPressGo = function (why) {
    return W.has(why) ? orig.call(this, why) : false;
  };
}
// --walkVar=react: 견줌만(판에 없음) — 걸어 들어가는 동안 간 보기의 '칠 때 보기'(기회 굴림 decideTimer)는 쉬고 낌새 받아치기(preThreat · seize · 막기)만 둔다
if (args.walkVar === 'react') {
  const W0 = AI.prototype.watch;
  AI.prototype.watch = function (...a) {
    if (!this.mordWalking?.()) return W0.apply(this, a);
    const t0 = this.decideTimer;
    this.decideTimer = 1e9;
    const r = W0.apply(this, a);
    if (this.decideTimer >= 1e8) this.decideTimer = t0;
    return r;
  };
}
// --walkCut=2: 견줌만(판에 없음 — 사장님 13:2x 안 · 13:3x 취소) — 걸어 들어가기가 이 초 안에 닿는 거리에 못 들면 붙이기를 끝냄
if (args.walkCut) {
  const C = +args.walkCut;
  const M0 = AI.prototype.mordTick;
  AI.prototype.mordTick = function (dt, k) {
    const out = M0.call(this, dt, k);
    if (this.mordWalking()) {
      this.press.wt = (this.press.wt ?? 0) + dt;
      if (!this.closeInside && this.press.wt >= C) {
        this.press.go = false;
        this.press.cuts = (this.press.cuts ?? 0) + 1;
      }
    } else this.press.wt = 0;
    return out;
  };
}
const bump = (o, k) => (o[k] = (o[k] ?? 0) + 1);
const BOTS = new Set(['human', 'still', 'block', 'back', 'backblock']);
const FALL = new Set(['kneel', 'down', 'getup']);

function fight(heroId, oppId, seed) {
  const H = CHARACTERS_BY_ID[heroId];
  const bot = BOTS.has(oppId);
  const O = bot ? null : CHARACTERS_BY_ID[oppId];
  if (!H || (!bot && !O)) throw new Error(`인물 ${heroId} · ${oppId}?`);
  const opp = O
    ? { AI2Class: AI, weapon: O.weapon, difficulty2: O.ai.level, persona2: O.ai.persona, look: O.look, revive2: O.revive }
    : { weapon: 'longsword', ...(oppId === 'human' ? { AI2Class: AI, difficulty2: 'normal' } : {}) };
  const G = newRound({ seed, walls: true, weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, revive: H.revive, ...opp });
  const E = G.enemy;
  const P = G.player;
  const ai = G.ai;
  let guard = null;
  if (bot) {
    P.stamina.setInfinite(true); // 용사의 눈물 (대기실 기본 장착 — 기력 무한)
    if (oppId !== 'human') {
      P.skill.corr = SKILL.corr;
      P.skill.corrTip = SKILL.corrTip;
      P.skill.autoGuard = true;
      P.canShove = true;
      if (oppId === 'block' || oppId === 'backblock') {
        guard = new PlayerParryGuard(P, E);
        P.stamina.controller = guard; // main.js 와 같게
        guard.held = true;
      }
    }
  }
  let rs = (seed * 2654435761) >>> 0;
  const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  const r = { hero: heroId, opp: oppId, seed, walks: [], recut: [], presses: 0, press15: 0, maxPress: 0, ends: {}, windows: 0, fired: 0, landed: 0, headHits: 0, headJ: [], falls: 0, ko: 0, blocked: 0, backs: 0, p15By: {}, firedBy: {} };
  let pressRun = null; // 영웅 누르기 한 덩이 { b, t }
  let strike = null; // 일격 하나 { t0, tEnd, headHit, fell, ko }
  let react = null; // 봇 반응 { at, b }
  let lastRun = null;
  let walk = null; // 걸어 들어가는 덩이 { t0 }
  let lastCut = null; // 마지막으로 끊긴 때 (--walkCut)
  G.combat.hooks.onWound = ((prev) => (att, vic, w, pt, pr) => {
    prev?.(att, vic, w, pt, pr);
    if (att !== E || vic !== P || !strike) return;
    if (w.zone === 'head') {
      strike.headHit = true;
      r.headJ.push(Math.round(w.energy * (w.helmet ? w.helmetBlunt : 1)));
    }
  })(G.combat.hooks.onWound);
  G.before = () => {
    if (!bot || oppId === 'human') return;
    const t = G.t;
    const pressing = E.barge?.phase === 'press';
    if (pressing && (!react || react.b !== E.barge)) react = { at: t + 0.12 + 0.18 * rnd(), b: E.barge };
    const backNow = (oppId === 'back' || oppId === 'backblock') && react && t >= react.at && (pressing || P.foeDistance() <= CLOSE.reach(E.weapon));
    if (backNow && !react.counted) {
      react.counted = true;
      r.backs++;
    }
    if (!pressing && react && P.foeDistance() > CLOSE.reach(E.weapon)) react = null;
    const y = !P.alive || P.state !== 'stand' ? 0 : backNow ? -1 : 0;
    P.move.set(0, y);
    P.stickX = 0;
    P.stickY = y;
    if (guard) {
      guard.step(DT);
      P.inputActive = guard.active;
    } else if (!P.skill.sec) {
      P.handOffset.x += (SKILL.homeGuard[0] - P.handOffset.x) * 0.1;
      P.handOffset.y += (SKILL.homeGuard[1] - P.handOffset.y) * 0.1;
    }
  };
  let end = DUR;
  let prevP = P.state;
  let tDeadP = null; // 먼저 죽은 쪽이 진다 (부활하는 동안은 살아 있음 — revive.js)
  let tDeadE = null;
  for (let i = 0; i < DUR / DT; i++) {
    G.step();
    // 걸어 들어가는 덩이 (붙이러 간 뒤 밀치기 전)
    const walking = !!ai.mordWalking?.();
    if (walking && !walk) {
      walk = { t0: G.t - DT, cuts: ai.press?.cuts ?? 0 };
      if (lastCut != null) r.recut.push(+(walk.t0 - lastCut).toFixed(3)); // 끊긴 뒤 다시 걸어 들어가기까지 (--walkCut)
      lastCut = null;
    } else if (!walking && walk) {
      const cut = (ai.press?.cuts ?? 0) > walk.cuts;
      r.walks.push([+(G.t - DT - walk.t0).toFixed(3), cut ? 'cut' : E.barge ? 'barge' : ai.mode === 'attack' ? 'attack' : ai.secretRun ? 'secret' : ai.mode]);
      if (cut) lastCut = G.t - DT;
      walk = null;
    }
    // 영웅 누르기 덩이
    const b = E.barge?.phase === 'press' ? E.barge : null;
    if (b && (!pressRun || pressRun.b !== b)) {
      pressRun = { b, t: G.t - DT, held: 0, hit15: false };
      r.presses++;
    }
    if (pressRun) {
      if (b === pressRun.b) {
        pressRun.held += DT;
        r.maxPress = Math.max(r.maxPress, pressRun.held);
        if (!pressRun.hit15 && pressRun.held >= SECRET.mordPress - 1e-9) {
          pressRun.hit15 = true;
          r.press15++;
          bump(r.p15By, ai.press?.goWhy ?? '-');
        }
      } else {
        const why = E.bargeEnd ?? (E.barge ? 'phase' : '?');
        r.ends[why] = (r.ends[why] ?? 0) + 1;
        pressRun = b ? { b, t: G.t - DT, held: DT, hit15: false } : null;
        if (b) r.presses++;
      }
    }
    // 일격
    const run = ai.secretRun;
    if (run && run !== lastRun && run.S?.name === 'mordschlag') {
      strike = { t0: G.t, tEnd: null, headHit: false, fell: false, ko: false, run };
      r.fired++;
      bump(r.firedBy, ai.press?.goWhy ?? '-');
    }
    lastRun = run;
    if (strike) {
      if (FALL.has(P.state) && prevP === 'stand') strike.fell = true;
      if (!P.alive || P.consciousness <= 0) strike.ko = true;
      if (strike.tEnd == null && !E.skill.sec) {
        strike.tEnd = G.t;
        if (E.instantResult?.mord && E.instantResult.blocked) r.blocked++;
      }
      if (strike.tEnd != null && G.t > strike.tEnd + 1.5) {
        if (strike.run.landed) r.landed++;
        if (strike.headHit) r.headHits++;
        if (strike.fell) r.falls++;
        if (strike.ko) r.ko++;
        strike = null;
      }
    }
    prevP = P.state;
    if (!P.alive && tDeadP == null) tDeadP = G.t;
    if (!E.alive && tDeadE == null) tDeadE = G.t;
    if ((!P.alive || !E.alive) && end === DUR) end = G.t + 0.5;
    if (G.t >= end) break;
  }
  if (strike) {
    if (strike.run.landed) r.landed++;
    if (strike.headHit) r.headHits++;
    if (strike.fell) r.falls++;
    if (strike.ko) r.ko++;
  }
  r.windows = ai.press?.wins ?? 0;
  r.goes = ai.press?.goes ?? 0; // 몸 붙이기로 간 수 (ai.js mordPressGo)
  r.goBy = { ...(ai.stats.mordGo ?? {}) };
  r.win = tDeadP != null && (tDeadE == null || tDeadP < tDeadE);
  r.lose = tDeadE != null && (tDeadP == null || tDeadE < tDeadP);
  r.t = +G.t.toFixed(1);
  r.maxPress = +r.maxPress.toFixed(2);
  r.dealt = +G.wounds.filter((w) => w.att === E && w.vic === P).reduce((a, w) => a + w.severity, 0).toFixed(2);
  r.taken = +G.wounds.filter((w) => w.att === P && w.vic === E).reduce((a, w) => a + w.severity, 0).toFixed(2);
  r.secret = ai.secret?.name ?? null;
  G.world.free();
  return r;
}

const HEROES = list('heroes', 'artoria');
const OPPS = list('opps', 'human,still,block,back,backblock,isolde,liao,omari,tome,minami');
const SEEDS = range(arg('seeds', '1-6'));
const all = [];
for (const h of HEROES)
  for (const o of OPPS)
    for (const s of SEEDS) {
      const r = fight(h, o, s);
      all.push(r);
      if (!args.quiet) console.error(`… ${h} vs ${o} ${s}: ${r.win ? '이김' : r.lose ? '짐' : '무'} · 붙이기 ${r.goes} · 누르기 ${r.presses} (1.5 s ${r.press15} · 최장 ${r.maxPress}) · 창 ${r.windows} · 낸 ${r.fired} · 맞힘 ${r.landed} · 머리 ${r.headHits} [${r.headJ.join(',')}] · 넘어짐 ${r.falls} · 기절 ${r.ko} · ${r.t} s · 끝 ${JSON.stringify(r.ends)}`);
    }
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-');
console.log(`설정: aiOpenSchools ${JSON.stringify(SECRET.aiOpenSchools)} · ${DUR} s · 시드 ${SEEDS.join(',')}`);
console.log('| 영웅 | 맞수 | 판 | 이김 · 짐 · 무 | 붙이기/판 | 누르기 시작/판 | 1.5 s 누르기/판 | 창/판 | 낸 수 | 맞힘 | 머리 맞음 | 머리 J 가운데 / 최대 | 넘어짐 | 기절 · 죽음 | 막힘 | 준 심각도/판 | 받은 심각도/판 | 판 길이 s |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const groups = new Map();
for (const r of all) for (const k of [`${r.hero}|${r.opp}`]) (groups.get(k) ?? groups.set(k, []).get(k)).push(r);
for (const [k, rs] of groups) {
  const [h, o] = k.split('|');
  const n = rs.length;
  const S = (key) => rs.reduce((a, r) => a + r[key], 0);
  const J = rs.flatMap((r) => r.headJ);
  console.log(`| ${h} | ${o} | ${n} | ${rs.filter((r) => r.win).length} · ${rs.filter((r) => r.lose).length} · ${rs.filter((r) => !r.win && !r.lose).length} | ${f2(S('goes') / n)} | ${f2(S('presses') / n)} | ${f2(S('press15') / n)} | ${f2(S('windows') / n)} | ${S('fired')} | ${S('landed')} | ${S('headHits')} | ${med(J)} / ${J.length ? Math.max(...J) : '-'} | ${S('falls')} | ${S('ko')} | ${S('blocked')} | ${f2(S('dealt') / n)} | ${f2(S('taken') / n)} | ${f2(S('t') / n)} |`);
}
const ends = {};
for (const r of all) for (const [k, v] of Object.entries(r.ends)) ends[k] = (ends[k] ?? 0) + v;
console.log(`누르기 끝 까닭 (모두): ${JSON.stringify(ends)}`);
const sumBy = (k) => all.reduce((o, r) => { for (const [a, v] of Object.entries(r[k] ?? {})) o[a] = (o[a] ?? 0) + v; return o; }, {});
console.log(`붙이기 사건별 (간 수 · 1.5 s 누르기 · 낸 수): ${JSON.stringify(sumBy('goBy'))} · ${JSON.stringify(sumBy('p15By'))} · ${JSON.stringify(sumBy('firedBy'))}`);
if (args.json) writeFileSync(args.json, JSON.stringify(all));
