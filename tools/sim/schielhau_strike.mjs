// ─────────────────────────────────────────────────────────────
//  schielhau_strike.mjs — 셸하우(곁눈 베기) 세기 · 맞는 순간 손목 (10/25 08:0x 사장님 '셸하우 3번 — 길 다시 그림' · 기록 docs/strike/wrist_audit_2026-10-24.md §13)
//   duel   = 롱소드 독일 AI(숙련 4 · 0 번 자리) 가 셸하우만 고름(속임수 · 패시브 · 비기 없이) · 상대 = 1 번 자리 롱소드(투구 없음) — foe 'ai'(기본) 칼을 아래 [0, −0.5] 에 둔 채
//            걷기만 하는 AI(치지도 막지도 않음) · 'still' 서 있는 몸 · 씨앗 SEEDS × DUR 초 (기본 6 × 40 s · §11 대본과 같은 꼴)
//            공격(베기 토막 시작)마다 칼의 상대 몸 첫 맞음: 갈래(베기 · 둔 · 찌름) · 심각도 · 판정 에너지 · 부위 · 칼끝 최고 빠르기 · 맞는 스텝 손목(wrist_audit wristSample —
//            dev · 범위 밖(손 면 안 각이 [−30, 135] 밖으로 1° 넘게) · 거꾸로 · 굽힘 · 폄 · 굴림 · 교정 각) · allPerAtk = 그 공격 동안 셸하우로 난 칼날 상처 모두
//   fights = 유파 대 롱소드 (school_passive_duel 과 같은 판 — 유파 무기 AI 대 롱소드 AI · 숙련 4 · 자리 둘 · 씨앗 1001… · 2001… · 30 s · 패시브 켬 · SEEDS 12 = 유파마다 24 판) —
//            기술별 칼날 상처 심각도 합(셸하우는 두 자리 합 — 독일 유파 무기도 롱소드) · 판을 끝낸 상처(죽은 쪽이 마지막으로 받은 칼날 상처)의 기술 · 승 / 패 / 무 ·
//            셸하우 공격마다 첫 몸 맞음과 그 스텝 손목(strike — 싸움 속 '맞는 순간 손목')
//  사용법: node tools/sim/schielhau_strike.mjs duel|fights [--set=JOINTS.wristGuard=0,…] [--seeds=6] [--seed0=1] [--dur=40] [--foe=ai|still] [--schools=italian,japanese,german,chinese] [--json=파일]
//          시험 길: --path='x,y;x,y;…'(from 부터) · --plan='들기,뻗기,돌리기;…'(점마다) · --reach= · --tech=zornhau(다른 기술만 — 견줌)
//   견줌: 전(손목 교정 전) = --set=JOINTS.elbowSwivel=0,JOINTS.wristGuard=0,JOINTS.swivelThrust=0,UNIQUE_ASSIST.schielPath=0 · 옛 길(10/25 전 판) = --set=UNIQUE_ASSIST.schielPath=0 · 지금 = 인자 없음
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { wristSample, outOfRange, REV, FE_IN, OOR_EPS, OOR_X, ROLL_AT, ELBOW_UP_X } from './wrist_audit.mjs';
import { strokeTechOf } from '../../src/unique_assist.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { isMain } from './is_main.mjs';

const p50 = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
};

function holdLow(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  const sk = f.skill;
  sk.prev?.set(xy[0], xy[1]);
  sk.aim?.set(xy[0], xy[1]);
  sk.aimRaw?.set(xy[0], xy[1]);
  sk.anchor?.set(xy[0], xy[1]);
  sk.aimVel?.set(0, 0);
  sk.vel?.set(0, 0);
  sk.follow?.set(0, 0);
}

let PATCH = null; // 시험: 셸하우 길 덮어쓰기 { from, path, plan, reach } (--path= · --plan= · --reach= — 길 고르기 견줌)
let TECH_NAME = 'schielhau'; // 견줌: 다른 기술만 고르게 (--tech=zornhau 등 — 같은 대본)
/** 셸하우만 고르는 독일 롱소드 AI (속임수 · 패시브 · 비기 · 흐름 없이 — 셸하우 한 칼씩) */
class SchielOnly extends AI {
  constructor(...a) {
    super(...a);
    let t = this.school.tech.find((x) => x.name === TECH_NAME) ?? (this.school.techByName?.[TECH_NAME]?.name === TECH_NAME ? this.school.techByName[TECH_NAME] : TECH_BY_NAME[TECH_NAME]);
    if (!t) throw new Error(`${TECH_NAME} 이 꾸러미에 없음 (숙련도 4 아래?)`);
    if (PATCH) t = { ...t, ...PATCH };
    if (!(this.pers.techPref[t.name] > 0)) this.pers.techPref[t.name] = 1; // 꾸러미 밖 기술(강화동작이 바꾼 기본 동작 — 견줌)도 고르게
    this.school = { ...this.school, tech: [t], feints: [] };
    this.passives = [];
    this.secret = null;
    this.press = null;
    this.binds = null;
  }
}

/** 칼을 아래 [0, −0.5] 에 둔 채 걷기만 하는 롱소드 AI (치지도 막지도 않음 — 간 보기 · 물러남 · 옆 돌기 걸음은 AI 그대로) */
class LowFoe extends AI {
  startAttack() {
    return false;
  }
  respond() {
    return false;
  }
  moveHand() {
    this.me.handOffset.set(LOW[0], LOW[1]);
  }
}
const LOW = [0, -0.5];

/** duel 한 판: 공격마다 첫 몸 맞음. 친 쪽 = 0 번 자리(AI2) · 맞는 쪽 = 1 번 자리(투구 없는 겉모습 — 머리 맞음도 칼날로 셈).
 *  foe 'ai' = 칼을 아래에 둔 채 걷는 AI (LowFoe) · 'still' = 서 있는 몸(AI 없음 · 칼 아래로 붙잡음) */
export function duelRun(seed, { dur = 40, low = LOW, foe = 'ai' } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'longsword', AIClass: foe === 'ai' ? LowFoe : AI, persona: { proficiency: 4 }, AI2Class: SchielOnly, persona2: { proficiency: 4 } });
  const A = G.player;
  const D = G.enemy;
  const ai = G.ai2;
  if (foe !== 'ai') G.ai.update = () => {};
  const rows = [];
  let cur = null;
  let lastPhase = null;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att !== A || vic !== D || !cur) return;
    if (strokeTechOf(A) !== TECH_NAME) return;
    cur.sevAll += r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (cur.hit) return;
    const s = wristSample(A);
    cur.hit = { type: r.type, zone: r.zone, sev: r.severity ?? 0, energy: r.energy, t: +(G.t - cur.t0).toFixed(3), tip: cur.tip, s, fix: A.wristFixDeg ?? 0 };
  };
  try {
    while (G.t < dur && D.alive && A.alive) {
      if (foe !== 'ai') holdLow(D, low);
      G.step();
      const striking = ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow') && ai.tech?.name === TECH_NAME;
      if (striking && ai.phase === 'strike' && lastPhase !== 'strike') {
        cur = { t0: G.t, tip: 0, hit: null, sevAll: 0 };
        rows.push(cur);
      }
      if (cur && striking) cur.tip = Math.max(cur.tip, A.tipVel.length());
      lastPhase = ai.mode === 'attack' ? ai.phase : null;
    }
    return { rows, dead: !D.alive, t: G.t };
  } finally {
    G.world.free();
  }
}

/** 맞는 순간 손목 · 팔 묶음 (wrist_audit 잣대): 범위 밖(> 1°) · 크게(> 10°) · 거꾸로 · 굽힘 · 폄 > wristFE · 굴림 ≥ 78 · 팔꿈치 줄 위(> 0 · > 30°) · 위팔 돌림 한도 밖 */
export function contactStats(S) {
  const J = CONFIG.JOINTS;
  return {
    oor: S.filter((s) => outOfRange(s) > OOR_EPS).length,
    oorX: S.filter((s) => outOfRange(s) > OOR_X).length,
    rev: S.filter((s) => s.dev < REV && Math.abs(s.fe) < FE_IN).length,
    feOut: S.filter((s) => Math.abs(s.fe) > J.wristFE).length,
    roll78: S.filter((s) => s.roll >= ROLL_AT).length,
    up0: S.filter((s) => s.elbowUp > 0).length,
    up30: S.filter((s) => s.elbowUp > ELBOW_UP_X).length,
    shOut: S.filter((s) => s.shRot != null && (s.shRot < J.twist[0] || s.shRot > J.twist[1])).length,
  };
}

export function duelSummary(runs) {
  const R = runs.flatMap((r) => r.rows);
  const H = R.map((r) => r.hit).filter(Boolean);
  const cut = H.filter((h) => h.type === 'cut').length;
  const blunt = H.filter((h) => h.type === 'blunt').length;
  const sev = H.reduce((a, h) => a + h.sev, 0);
  const sevAll = R.reduce((a, r) => a + r.sevAll, 0);
  const zones = {};
  for (const h of H) zones[h.zone] = (zones[h.zone] ?? 0) + 1;
  const S = H.map((h) => h.s).filter(Boolean);
  const { oor, rev, ...arm } = contactStats(S);
  return {
    attacks: R.length,
    contacts: H.length,
    cut,
    blunt,
    sev: +sev.toFixed(2),
    perAtk: R.length ? +(sev / R.length).toFixed(3) : 0,
    allPerAtk: R.length ? +(sevAll / R.length).toFixed(3) : 0,
    energy: +(p50(H.map((h) => h.energy)) ?? 0).toFixed(0),
    tip: +(p50(R.map((r) => r.tip)) ?? 0).toFixed(1),
    dev: S.length ? +p50(S.map((s) => s.dev)).toFixed(0) : null,
    devMin: S.length ? +Math.min(...S.map((s) => s.dev)).toFixed(0) : null,
    fe: S.length ? +p50(S.map((s) => Math.abs(s.fe))).toFixed(0) : null,
    roll: S.length ? +p50(S.map((s) => s.roll)).toFixed(0) : null,
    fix: +(p50(H.map((h) => Math.abs(h.fix))) ?? 0).toFixed(1),
    oor,
    rev,
    ...arm,
    zones,
    dead: runs.filter((r) => r.dead).length,
  };
}

// ── 유파 대 롱소드 (school_passive_duel 과 같은 판) — 기술별 칼날 상처 심각도 ──
const WEAPON = { italian: 'rapier', japanese: 'uchigatana', german: 'longsword', chinese: 'qinggang' };
export function fightRun(school, seed, side, { dur = 30, prof = 4 } = {}) {
  const SP = CONFIG.SCHOOL_PASSIVE;
  const keep = { on: SP.on, ...Object.fromEntries(['iberian', ...Object.keys(WEAPON)].map((k) => [k, SP[k]?.on])) };
  SP.on = true;
  for (const k of ['iberian', ...Object.keys(WEAPON)]) if (SP[k]) SP[k].on = k === school;
  const w = WEAPON[school];
  const G = newRound({ walls: true, seed, weapon: side === 0 ? w : 'longsword', weapon2: side === 0 ? 'longsword' : w, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  applyWeaponMeasure(G.ai2, side === 0 ? w : 'longsword');
  applyWeaponMeasure(G.ai, side === 0 ? 'longsword' : w);
  const T = side === 0 ? G.player : G.enemy;
  const O = side === 0 ? G.enemy : G.player;
  O.schoolPassive?.set(null);
  const byTech = {};
  const last = new Map();
  // 셸하우 공격(베기 토막 시작)마다 첫 몸 맞음 · 그 스텝 손목 (두 자리 모두 — 독일 유파 무기 쪽 S 도)
  const strikes = [];
  const curS = new Map();
  const ais = [G.ai, G.ai2];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const cs = curS.get(att);
    if (cs && !cs.hit && strokeTechOf(att) === 'schielhau') cs.hit = { type: r.type, zone: r.zone, sev: r.type === 'blunt' ? 0 : r.severity ?? 0, s: wristSample(att), fix: att.wristFixDeg ?? 0, t: +(G.t - cs.t0).toFixed(3), touch: !!att.feel?.touching };
    if (r.type === 'blunt' || !(r.severity > 0)) return;
    const tn = strokeTechOf(att) ?? (att.skill?.tap ? 'tap' : '-');
    const key = `${att === O ? 'L' : 'S'}:${tn}`;
    byTech[key] = (byTech[key] ?? 0) + r.severity;
    last.set(vic, key);
  };
  let end = null;
  try {
    const lastPh = new Map();
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      for (const a of ais) {
        const ph = a.mode === 'attack' ? a.phase : null;
        if (ph === 'strike' && lastPh.get(a) !== 'strike' && a.tech?.name === 'schielhau') {
          const cs = { side: a.me === O ? 'L' : 'S', hit: null, t0: G.t, gap0: +a.me.foeDistance().toFixed(2) };
          strikes.push(cs);
          curS.set(a.me, cs);
        } else if (!(a.mode === 'attack' && a.tech?.name === 'schielhau')) curS.delete(a.me);
        lastPh.set(a, ph);
      }
      if (!T.alive || !O.alive) {
        end = +G.t.toFixed(1);
        break;
      }
    }
    return {
      school, seed, side, end,
      win: !O.alive && T.alive, lose: !T.alive && O.alive, both: !T.alive && !O.alive,
      byTech: Object.fromEntries(Object.entries(byTech).map(([k, v]) => [k, +v.toFixed(3)])),
      killedBy: !O.alive ? last.get(O) ?? null : !T.alive ? last.get(T) ?? null : null,
      strikes,
    };
  } finally {
    G.world.free();
    Object.assign(SP, { on: keep.on });
    for (const k of ['iberian', ...Object.keys(WEAPON)]) if (SP[k]) SP[k].on = keep[k];
  }
}

export function fightSummary(out) {
  const tech = {};
  for (const r of out) for (const [k, v] of Object.entries(r.byTech)) tech[k] = (tech[k] ?? 0) + v;
  const kills = {};
  for (const r of out) if (r.killedBy) kills[r.killedBy] = (kills[r.killedBy] ?? 0) + 1;
  const wld = {};
  for (const r of out) {
    const W = (wld[r.school] ??= [0, 0, 0]);
    W[r.win ? 0 : r.lose ? 1 : 2]++;
  }
  const R = out.flatMap((r) => r.strikes ?? []);
  const H = R.map((r) => r.hit).filter(Boolean);
  const S = H.map((h) => h.s).filter(Boolean);
  const strike = {
    attacks: R.length,
    contacts: H.length,
    cut: H.filter((h) => h.type === 'cut').length,
    perAtk: R.length ? +(H.reduce((a, h) => a + h.sev, 0) / R.length).toFixed(3) : 0,
    dev: S.length ? +p50(S.map((s) => s.dev)).toFixed(0) : null,
    ...contactStats(S),
    fix: +(p50(H.map((h) => Math.abs(h.fix))) ?? 0).toFixed(1),
    fixN: H.filter((h) => Math.abs(h.fix) > 0.5).length,
  };
  return { n: out.length, schielBoth: +((tech['L:schielhau'] ?? 0) + (tech['S:schielhau'] ?? 0)).toFixed(1), schielKillsBoth: (kills['L:schielhau'] ?? 0) + (kills['S:schielhau'] ?? 0), strike, schiel: +(tech['L:schielhau'] ?? 0).toFixed(1), schielKills: kills['L:schielhau'] ?? 0, draws: Object.values(wld).reduce((a, w) => a + w[2], 0), wld, tech: Object.fromEntries(Object.entries(tech).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +v.toFixed(1)])), kills };
}

if (isMain(import.meta.url)) {
  const args = { _: [] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
    else args._.push(a);
  }
  if (args.set) {
    for (const kv of String(args.set).split(',')) {
      const [path, val] = kv.split('=');
      const ks = path.split('.');
      let o = CONFIG[ks[0]];
      for (const k of ks.slice(1, -1)) o = o[k];
      o[ks.at(-1)] = isNaN(+val) ? val : +val;
    }
  }
  if (args.tech) TECH_NAME = String(args.tech);
  if (args.path) {
    const pts = String(args.path).split(';').map((p) => p.split(',').map(Number));
    PATCH = { from: pts[0], path: pts.slice(1) };
  }
  if (args.plan) PATCH = { ...PATCH, plan: String(args.plan).split(';').map((p) => p.split(',').map(Number)) };
  if (args.reach != null) PATCH = { ...PATCH, reach: +args.reach };
  const mode = args._[0] ?? 'duel';
  let res;
  if (mode === 'duel') {
    const seeds = +(args.seeds ?? 6);
    const runs = [];
    for (let s = 1; s <= seeds; s++) runs.push(duelRun(s, { dur: +(args.dur ?? 40), foe: args.foe ?? 'ai' }));
    res = duelSummary(runs);
    console.log(`셸하우 duel${args.set ? ` · set ${args.set}` : ''}${args.path ? ` · 길 ${args.path}` : ''}${args.plan ? ` · 덧칸 ${args.plan}` : ''}: ${JSON.stringify(res)}`);
    if (args.rows) for (const r of runs.flatMap((x) => x.rows)) console.log(JSON.stringify({ t0: +r.t0.toFixed(2), tip: +r.tip.toFixed(1), ...(r.hit ? { type: r.hit.type, zone: r.hit.zone, sev: +r.hit.sev.toFixed(3), E: +r.hit.energy.toFixed(0), dev: r.hit.s ? +r.hit.s.dev.toFixed(0) : null, fe: r.hit.s ? +r.hit.s.fe.toFixed(0) : null, roll: r.hit.s ? +r.hit.s.roll.toFixed(0) : null, fix: +r.hit.fix.toFixed(1) } : { miss: 1 }) }));
  } else if (mode === 'fights') {
    if (PATCH) {
      // 시험 길 (AI 꾸러미를 만들기 전에): 다시 그린 길을 쓰는 판(UNIQUE_ASSIST.schielPath 1)이면 redraw 칸을 · 아니면 원래 칸을 덮는다 (sword_art.js applySchoolArt 가 읽는 자리)
      const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
      Object.assign(CONFIG.UNIQUE_ASSIST.schielPath && u.redraw ? u.redraw : u, PATCH);
    }
    const schools = String(args.schools ?? 'italian,japanese,german,chinese').split(',');
    const N = +(args.seeds ?? 12);
    const S0 = +(args.seed0 ?? 1);
    const out = [];
    for (const school of schools) for (let s = S0; s < S0 + N; s++) for (const side of [0, 1]) out.push(fightRun(school, (side ? 2000 : 1000) + s, side, { dur: +(args.dur ?? 30) }));
    res = fightSummary(out);
    console.log(`유파 대 롱소드${args.set ? ` · set ${args.set}` : ''}${args.path ? ` · 길 ${args.path}` : ''}${args.plan ? ` · 덧칸 ${args.plan}` : ''}${S0 !== 1 ? ` · 씨앗 ${S0}~${S0 + N - 1}` : ''}: 판 ${res.n} · 셸하우 심각도 합 (두 자리) ${res.schielBoth} · 판을 끝낸 셸하우 ${res.schielKillsBoth} · 무 ${res.draws} · ${JSON.stringify(res.wld)}`);
    console.log(`  셸하우 공격 · 맞는 순간: ${JSON.stringify(res.strike)}`);
    console.log(`  기술별 (L = 롱소드 · S = 유파 무기): ${JSON.stringify(res.tech)}`);
    console.log(`  판을 끝낸 상처: ${JSON.stringify(res.kills)}`);
    res.rows = out;
  } else throw new Error(`알 수 없는 판 ${mode}`);
  if (args.json) writeFileSync(args.json, JSON.stringify(res, null, 1));
}
