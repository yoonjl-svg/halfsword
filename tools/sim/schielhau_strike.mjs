// ─────────────────────────────────────────────────────────────
//  schielhau_strike.mjs — 셸하우(곁눈 베기) 세기 · 맞는 순간 손목 (10/25 08:0x 사장님 '셸하우 3번 — 길 다시 그림' · 기록 docs/strike/wrist_audit_2026-10-24.md §13)
//   duel   = 롱소드 독일 AI(숙련 4 · 0 번 자리) 가 셸하우만 고름(속임수 · 패시브 · 비기 없이) · 상대 = 1 번 자리 롱소드(투구 없음) — foe 'ai'(기본) 칼을 아래 [0, −0.5] 에 둔 채
//            걷기만 하는 AI(치지도 막지도 않음) · 'still' 서 있는 몸 · 씨앗 SEEDS × DUR 초 (기본 6 × 40 s · §11 대본과 같은 꼴)
//            공격(베기 토막 시작)마다 칼의 상대 몸 첫 맞음: 갈래(베기 · 둔 · 찌름) · 심각도 · 판정 에너지 · 부위 · 칼끝 최고 빠르기 · 맞는 스텝 손목(wrist_audit wristSample —
//            dev · 범위 밖(손 면 안 각이 [−30, 135] 밖으로 1° 넘게) · 거꾸로 · 굽힘 · 폄 · 굴림 · 교정 각) · allPerAtk = 그 공격 동안 셸하우로 난 칼날 상처 모두
//   fights = 유파 대 롱소드 (school_passive_duel 과 같은 판 — 유파 무기 AI 대 롱소드 AI · 숙련 4 · 자리 둘 · 씨앗 1001… · 2001… · 30 s · 패시브 켬 · SEEDS 12 = 유파마다 24 판) —
//            기술별 칼날 상처 심각도 합(셸하우는 두 자리 합 — 독일 유파 무기도 롱소드) · 판을 끝낸 상처(죽은 쪽이 마지막으로 받은 칼날 상처)의 기술 · 승 / 패 / 무 ·
//            셸하우 공격마다 첫 몸 맞음과 그 스텝 손목(strike — 싸움 속 '맞는 순간 손목')
//   player = 사람 곁눈 베기 (10/25 18:0x '같은 길 입혀'): 0 번 자리 사람 몸을 손가락 봇이 긋는다(playerRun — 분노의 베기 길 = 강화동작 곁눈 베기) · 맞는 쪽 duel 과 같음(--foe=still 기본)
//            --finger=zornhau|schiel|redraw · --spd=3,5.5(긋기 빠르기 패드 m/s) · --jit=0.04(점 흔들림 m) · --sjit=(시작 자리 흔들림 m) · --foeW=(맞는 쪽 무기)
//            --immortal = 맞는 쪽 상처 끔(duel · player — 판정은 재고 몸에 안 검: 공격마다 같은 몸이라 세기 견줌이 고름) · --first=N 씨앗마다 앞 N 칼만(지치기 전)
//            고른 견줌(10/25 18:5x — §15): --immortal --dur=14 --first=5 --seeds=18
//   fight  = 사람 싸움 (playerFight — 손가락 봇 대 치고 막는 AI · --opps · --fseeds · --delays · --prof · --share)
//   duel · fights · player 묶음에 rollT = 맞는 스텝 앞뒤(−8 ~ +8 스텝) 아래팔 굴림 ≥ 78 몫 · plan = 맞는 순간 길 덧칸
//  사용법: node tools/sim/schielhau_strike.mjs duel|fights|player [--set=JOINTS.wristGuard=0,…] [--seeds=6] [--seed0=1] [--dur=40] [--foe=ai|still] [--schools=italian,japanese,german,chinese] [--json=파일]
//          시험 길: --path='x,y;x,y;…'(from 부터) · --plan='들기,뻗기,돌리기;…'(점마다) · --reach= · --tech=zornhau(다른 기술만 — 견줌)
//   견줌: 전(손목 교정 전) = --set=JOINTS.elbowSwivel=0,JOINTS.wristGuard=0,JOINTS.swivelThrust=0,UNIQUE_ASSIST.schielPath=0 · 옛 길(10/25 전 판) = --set=UNIQUE_ASSIST.schielPath=0 · 지금 = 인자 없음
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { wristSample, outOfRange, REV, FE_IN, OOR_EPS, OOR_X, ROLL_AT, ELBOW_UP_X } from './wrist_audit.mjs';
import { strokeTechOf, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { TECH, TECH_BY_NAME } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { isMain } from './is_main.mjs';

const p50 = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
};

// 굴림 때 (10/25 18:0x 사장님 '맞는 순간 23 %(아래팔 엎침 끝 ≥ 78°)는 타격에 의한 일시적인 일그러짐인가?'): 맞는 스텝 앞 PRE 스텝 · 뒤 POST 스텝의 손목을 함께 적는다 (1 스텝 = 1/120 s)
const PRE = 8;
const POST = 8;
export const ROLL_OFFS = [-8, -4, -2, -1, 0, 1, 2, 4, 8];
/** 공격 기록 rec 에 이 스텝(G.step 뒤) 손목: 맞기 전이면 앞 고리(PRE) · 맞은 뒤면 post (맞은 스텝 자체는 hit.s — 같은 자세라 건너뜀) */
function rollTrack(rec, f) {
  const h = rec.hit;
  if (!h) {
    (rec.ring ??= []).push(wristSample(f));
    if (rec.ring.length > PRE) rec.ring.shift();
  } else if (!h.postStarted) h.postStarted = true;
  else if (h.post.length < POST) h.post.push(wristSample(f));
}
/** 첫 맞음 기록에 앞 고리를 붙임 */
const rollPre = (rec) => ({ pre: [...(rec.ring ?? [])], post: [], postStarted: false });
/** 맞음 h 의 스텝 차 k 손목 (0 = 맞은 스텝) */
function rollAt(h, k) {
  if (k === 0) return h.s;
  if (k < 0) return h.pre?.[h.pre.length + k] ?? null;
  return h.post?.[k - 1] ?? null;
}
/** 굴림 때 묶음: 스텝 차마다 굴림 ≥ 78 몫(%) · 굴림 p50 · 맞는 순간 ≥ 78 인 맞음(end) 가운데 2 · 4 · 8 스텝 앞에도 ≥ 78 · 4 · 8 스텝 뒤에도 ≥ 78 (%) · 굴림 변화(0 − (−2) 스텝) p50 */
export function rollTiming(H) {
  const by = {};
  for (const k of ROLL_OFFS) {
    const S = H.map((h) => rollAt(h, k)).filter(Boolean);
    by[k] = { n: S.length, r78: S.length ? +((100 * S.filter((s) => s.roll >= ROLL_AT).length) / S.length).toFixed(1) : null, roll: S.length ? +p50(S.map((s) => s.roll)).toFixed(0) : null };
  }
  const E = H.filter((h) => h.s && h.s.roll >= ROLL_AT);
  const share = (k) => {
    const S = E.map((h) => rollAt(h, k)).filter(Boolean);
    return S.length ? +((100 * S.filter((s) => s.roll >= ROLL_AT).length) / S.length).toFixed(0) : null;
  };
  const jump = (L) => L.map((h) => (h.s && rollAt(h, -2) ? h.s.roll - rollAt(h, -2).roll : null)).filter((x) => x != null);
  const dE = jump(E);
  const dA = jump(H);
  return { by, end: E.length, endPre2: share(-2), endPre4: share(-4), endPre8: share(-8), endPost4: share(4), endPost8: share(8), endJump2: dE.length ? +p50(dE).toFixed(1) : null, allJump2: dA.length ? +p50(dA).toFixed(1) : null };
}
/** 맞는 순간 물리 (combat.js analyze — 판정 에너지 = ½ · 유효 질량 · 맞은 점 상대 빠르기² × energyScale): 빠르기 m/s · 칼날 위 자리 t(0 손잡이 쪽 ~ 1 칼끝) · 유효 질량 kg · 끝 힘 배율(f.powerMul) */
const hitPhys = (r, f) => ({ speed: r.speed ?? null, bt: r.t ?? null, mEff: r.mEff ?? null, pow: f.powerMul ?? 1 });
/** 맞음 묶음의 물리 p50 */
function physP50(H) {
  const q = (k) => {
    const a = H.map((h) => h[k]).filter((x) => x != null);
    return a.length ? +p50(a).toFixed(3) : null;
  };
  return { speed: q('speed'), bt: q('bt'), mEff: q('mEff'), energy: q('energy'), powOn: H.length ? +((100 * H.filter((h) => (h.pow ?? 1) > 1.001).length) / H.length).toFixed(0) : null };
}
/** 맞는 순간 길 덧칸 p50 [들기, 뻗기, 돌리기] (덧칸 있던 맞음 수 n) */
function planP50(H) {
  const P = H.map((h) => h.plan).filter(Boolean);
  return P.length ? { n: P.length, tilt: p50(P.map((p) => p[0])), reach: p50(P.map((p) => p[1])), turn: p50(P.map((p) => p[2])) } : null;
}
/** 맞는 순간 길 덧칸 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] (없으면 null) */
const planOf = (f) => (f.techPlan ? [+((f.techPlan.tilt * 180) / Math.PI).toFixed(1), +f.techPlan.reach.toFixed(3), +((f.techPlan.turn * 180) / Math.PI).toFixed(1)] : null);

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
export function duelRun(seed, { dur = 40, low = LOW, foe = 'ai', immortal = false } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'longsword', AIClass: foe === 'ai' ? LowFoe : AI, persona: { proficiency: 4 }, AI2Class: SchielOnly, persona2: { proficiency: 4 } });
  const A = G.player;
  const D = G.enemy;
  const ai = G.ai2;
  if (foe !== 'ai') G.ai.update = () => {};
  if (immortal) D.applyWound = () => {}; // 상처 끔: 판정(심각도)은 재고 몸에 걸지 않음 — 맞는 쪽이 늘 같은 몸이라 공격마다 세기를 고르게 견줌 (먼저 쓰러뜨린 판이 공격 수를 바꾸지 않게)
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
    cur.hit = { type: r.type, zone: r.zone, sev: r.severity ?? 0, energy: r.energy, t: +(G.t - cur.t0).toFixed(3), tip: cur.tip, s, fix: A.wristFixDeg ?? 0, plan: planOf(A), ...hitPhys(r, A), ...rollPre(cur) };
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
      if (cur) rollTrack(cur, A);
      lastPhase = ai.mode === 'attack' ? ai.phase : null;
    }
    return { rows, dead: !D.alive, t: G.t };
  } finally {
    G.world.free();
  }
}

// ── 사람 곁눈 베기 (10/25 18:0x 사장님 '같은 길 입혀' — 손가락 봇) ──
//  손가락 길(사람이 긋는 꼴): zornhau = 분노의 베기 기본 동작 길(곁눈 베기 강화동작을 여는 긋기 — 오른 지붕 → 왼 아래 끝까지) · zornhauL = 왼 분노의 베기(거울 — 곁눈 베기를 안 엶) · schiel = 옛 곁눈 베기 길 · redraw = 다시 그린 길
const FINGER = (() => {
  const z = TECH_BY_NAME.zornhau;
  const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
  const zl = TECH_BY_NAME.zornhauL;
  return { zornhau: { from: z.from, path: z.path }, zornhauL: { from: zl.from, path: zl.path }, schiel: { from: u.from, path: u.path }, redraw: { from: u.from, path: u.redraw?.path ?? u.path } };
})();
/**
 * 사람 한 판: 0 번 자리(G.player — 사람 몸 · 고유 공격 강화 PlayerUniqueAssist 곁눈 베기 칸만 · main.js 와 같은 보정 · 자세 돌아가기)를 손가락 봇이 긋는다.
 *  긋기 = 시작 자리로 1.6 패드 m/s(손 뗌) → 4 프레임 멈춤 → 손가락 길 점마다 빠르기 spd(긋기마다 고르게 뽑음) · 점마다 ± jit 흔들림(손 댐) → 6 프레임 멈춤 (kote_drop_duel 손가락 봇과 같은 프레임 꼴 — 프레임 = 2 스텝)
 *  걸음: 내 무기 간격(weapon_measured 롱소드 맞닿기 · 칼끝 거리) 띠 — 긋는 동안 맞닿기 밖이면 앞으로 · 맞닿기 + 0.1 안이면 뒤로 · 칼끝 거리 + 0.25 밖이면 앞으로
 *  칠 때: 칼끝 거리 + 0.3 안 · 1.0 ~ 1.6 s 마다. 맞는 쪽 = 1 번 자리(duelRun 과 같은 몸 — foe 'still' 서 있음 · 'ai' 칼을 아래에 둔 채 걷는 AI)
 *  공격 = 곁눈 베기 강화가 열린 긋기(uniq.r — 손가락 긋기 가운데 곁눈 베기로 읽힌 것) · 첫 몸 맞음 · 그 스텝 손목 · 앞뒤 굴림 (duelRun 과 같은 기록 — duelSummary 로 묶음)
 */
export function playerRun(seed, { dur = 40, foe = 'still', finger = 'zornhau', spd = [3, 5.5], jit = 0.04, sjit = 0, foeW = 'longsword', low = LOW, immortal = false } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: foeW, AIClass: foe === 'ai' ? LowFoe : AI, persona: { proficiency: 4 } });
  const P = G.player;
  const D = G.enemy;
  if (foe !== 'ai') G.ai.update = () => {};
  if (immortal) D.applyWound = () => {}; // 상처 끔 (duelRun 과 같음)
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['schielhau']) });
  const FR = FINGER[finger];
  if (!FR) throw new Error(`손가락 길 ${finger}?`);
  let rs = (seed * 7919 + 17) >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const [CONTACT, REACH] = MEASURED.longsword;
  const FRAME = 2 * DT;
  let queue = [];
  let fx = P.handOffset.x;
  let fy = P.handOffset.y;
  let nextAtk = 1.5;
  let stepN = 0;
  let drawn = 0;
  const to = (p, vel, held) => {
    const fr = [];
    let x = fx;
    let y = fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x;
      const dy = p[1] - y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st;
      y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    fx = x;
    fy = y;
    return fr;
  };
  const stroke = () => {
    const v = spd[0] + rnd() * (spd[1] - spd[0]);
    const j = () => (rnd() * 2 - 1) * jit;
    const sj = () => (rnd() * 2 - 1) * sjit; // 시작 자리 흔들림 (다른 시작 자세 — 0 이면 난수를 안 뽑음: 전과 같은 줄)
    const fr = to(sjit ? [FR.from[0] + sj(), FR.from[1] + sj()] : FR.from, 1.6, false);
    fr.push(...Array(4).fill([0, 0, false]));
    for (const p of FR.path) fr.push(...to([p[0] + j(), p[1] + j()], v, true));
    fr.push(...Array(6).fill([0, 0, false]));
    return fr;
  };
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    if (!queue.length && t >= nextAtk && dist < REACH + 0.3 && P.alive && P.armed && !P.stamina.exhausted) {
      queue = stroke();
      drawn++;
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    if ((stepN++ & 1) === 0) {
      const f = queue.shift() ?? [0, 0, false];
      const u = P.skill.uniq;
      u?.feed(f[0], f[1], FRAME, false);
      if (!(u ? (u.holdsHand ?? u.running) : false)) {
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
      }
      P.handHeld = f[2];
      if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
      if (!queue.length) {
        fx = P.handOffset.x;
        fy = P.handOffset.y;
      }
    }
    const fwd = P.stamina.exhausted || !P.alive ? 0 : queue.length && dist > CONTACT ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.25 ? 0.45 : 0;
    P.move.set(0, fwd);
    P.stickX = 0;
    P.stickY = fwd;
  };
  const rows = [];
  let cur = null;
  let wasR = false;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att !== P || vic !== D || !cur) return;
    if (strokeTechOf(P) !== 'schielhau') return;
    cur.sevAll += r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (cur.hit) return;
    cur.hit = { type: r.type, zone: r.zone, sev: r.severity ?? 0, energy: r.energy, t: +(G.t - cur.t0).toFixed(3), tip: cur.tip, s: wristSample(P), fix: P.wristFixDeg ?? 0, plan: planOf(P), ...hitPhys(r, P), ...rollPre(cur) };
  };
  try {
    while (G.t < dur && D.alive && P.alive) {
      if (foe !== 'ai') holdLow(D, low);
      G.step();
      const isR = uq.r?.e.name === 'schielhau' && uq.r.part === 1;
      if (isR && !wasR) {
        cur = { t0: G.t, tip: 0, hit: null, sevAll: 0 };
        rows.push(cur);
      }
      wasR = isR;
      if (cur && strokeTechOf(P) === 'schielhau') cur.tip = Math.max(cur.tip, P.tipVel.length());
      if (cur) rollTrack(cur, P);
    }
    return { rows, dead: !D.alive, t: G.t, drawn, fired: uq.stats.fired.schielhau ?? 0, power: uq.stats.power };
  } finally {
    G.world.free();
  }
}

/**
 * 사람 곁눈 베기 — 싸움 (10/25 18:5x 사장님 '특수한 일부 상황이 아니라 일반적인 상황인가' — 손가락 봇 싸움 · kote_drop_duel 손가락 봇 꼴):
 *  0 번 자리 사람 롱소드(독일 · 고유 공격 강화 단계 4 — 곁눈 베기 · 비껴 딛는 가로베기 · 겹치기) 대 AI(숙련 PROF · 무기 opp — 치고 막는 보통 AI).
 *  봇: 칠 때 SHARE 몫(기본 0.5)은 분노의 베기 긋기(= 곁눈 베기) · 나머지는 다른 기본 긋기 · 그 가운데 15 % 는 탭 찌르기 · 그은 뒤 30 % 되긋기.
 *   상대 칼이 가까이서 빠르게 움직이면 반응 지연(delay + 0 ~ 0.1 s) 뒤 COUNTER 몫(0.5)은 분노의 베기로 맞받고(받아 베기) 나머지는 0.6 ~ 1.0 s 막기 단추(PlayerParryGuard).
 *   걸음: 롱소드 간격 띠(맞닿기 + 0.1 ~ 칼끝 거리 + 0.25 · 긋는 동안 맞닿기 밖이면 앞으로). 판 dur 초(먼저 쓰러지면 0.5 s 뒤 끝).
 *  센다: 곁눈 베기 공격(강화가 열린 긋기)마다 첫 몸 맞음 · 손목(duelRun 과 같은 기록) · 곁눈 베기 칼날 상처 합 · 모든 칼날 상처 합(준 · 받은) · 판 결과
 */
export function playerFight(seed, opp, { dur = 30, prof = 3, delay = 0.15, share = 0.5, counter = 0.5 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: opp, persona: { proficiency: prof } });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player;
  const A = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { stage: 4 });
  let rs = (seed * 7919 + Math.round(delay * 1000)) >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const [CONTACT, REACH] = MEASURED.longsword;
  const FRAME = 2 * DT;
  const Z = FINGER.zornhau;
  const OTHER = TECH.filter((t) => t.name !== 'zornhau').map((t) => ({ from: t.from, path: t.path }));
  let queue = [];
  let fx = P.handOffset.x;
  let fy = P.handOffset.y;
  let nextAtk = 2.6;
  let due = Infinity;
  let heldUntil = 0;
  let lastMotion = -1;
  let notice = false;
  let stepN = 0;
  const to = (p, vel, held) => {
    const fr = [];
    let x = fx;
    let y = fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x;
      const dy = p[1] - y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st;
      y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    fx = x;
    fy = y;
    return fr;
  };
  const stroke = (b, back) => {
    const fr = to(b.from, 1.6, false);
    fr.push(...Array(4).fill([0, 0, false]));
    for (const p of b.path) fr.push(...to(p, 4, true));
    if (back) {
      fr.push(...Array(3).fill([0, 0, true]));
      fr.push(...to(b.from, 4, true));
    }
    fr.push(...Array(6).fill([0, 0, false]));
    return fr;
  };
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    const motion = A.armed && dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) {
      lastMotion = t;
      if (!notice && !guard.held && due === Infinity && !queue.length) {
        due = t + delay + rnd() * 0.1;
        notice = true;
      }
    } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) {
      due = Infinity;
      if (P.armed && !P.stamina.exhausted && rnd() < counter) {
        queue = stroke(Z, false);
        nextAtk = t + 1.0 + rnd() * 0.6;
      } else heldUntil = t + 0.6 + rnd() * 0.4;
    }
    guard.held = t < heldUntil && !queue.length && !P.skill.tap;
    guard.broken = !!(P.skill.tap || P.skill.pom || queue.length);
    if (!guard.held && !queue.length && t >= nextAtk && dist < REACH + 0.3 && P.alive && P.armed && !P.stamina.exhausted) {
      const z = rnd() < share;
      if (!z && rnd() < 0.15) P.skill.thrust();
      else queue = stroke(z ? Z : OTHER[Math.floor(rnd() * OTHER.length)], rnd() < 0.3);
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    guard.step(DT);
    P.inputActive = guard.active;
    if ((stepN++ & 1) === 0) {
      const f = queue.shift() ?? [0, 0, false];
      const u = P.skill.uniq;
      u?.feed(f[0], f[1], FRAME, false);
      if (!(u ? (u.holdsHand ?? u.running) : false)) {
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
      }
      P.handHeld = f[2];
      if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
      if (!queue.length) {
        fx = P.handOffset.x;
        fy = P.handOffset.y;
      }
    }
    const fwd = P.stamina.exhausted || !P.alive ? 0 : queue.length && dist > CONTACT ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.25 ? 0.45 : 0;
    P.move.set(0.18 * Math.sin(t * 0.65 + seed), fwd);
    P.stickX = P.move.x;
    P.stickY = P.move.y;
  };
  const rows = [];
  let cur = null;
  let wasR = false;
  let schielSev = 0;
  let dealt = 0;
  let recv = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (att === A && vic === P) recv += sv;
    if (att !== P || vic !== A) return;
    dealt += sv;
    if (strokeTechOf(P) !== 'schielhau') return;
    schielSev += sv;
    if (!cur) return;
    cur.sevAll += sv;
    if (cur.hit) return;
    cur.hit = { type: r.type, zone: r.zone, sev: r.severity ?? 0, energy: r.energy, t: +(G.t - cur.t0).toFixed(3), tip: cur.tip, s: wristSample(P), fix: P.wristFixDeg ?? 0, plan: planOf(P), ...hitPhys(r, P), ...rollPre(cur) };
  };
  let end = dur;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      const isR = uq.r?.e.name === 'schielhau' && uq.r.part === 1;
      if (isR && !wasR) {
        cur = { t0: G.t, tip: 0, hit: null, sevAll: 0 };
        rows.push(cur);
      }
      wasR = isR;
      if (cur && strokeTechOf(P) === 'schielhau') cur.tip = Math.max(cur.tip, P.tipVel.length());
      if (cur) rollTrack(cur, P);
      if ((!P.alive || !A.alive) && end === dur) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    return { rows, opp, seed, delay, win: !A.alive && P.alive, lose: !P.alive && A.alive, schielSev, dealt, recv, fired: uq.stats.fired.schielhau ?? 0, t: G.t };
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
    plan: planP50(H),
    phys: physP50(H),
    rollT: rollTiming(H),
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
    if (cs && !cs.hit && strokeTechOf(att) === 'schielhau') cs.hit = { type: r.type, zone: r.zone, sev: r.type === 'blunt' ? 0 : r.severity ?? 0, energy: r.energy, s: wristSample(att), fix: att.wristFixDeg ?? 0, t: +(G.t - cs.t0).toFixed(3), touch: !!att.feel?.touching, plan: planOf(att), ...hitPhys(r, att), ...rollPre(cs) };
    if (r.type === 'blunt' || !(r.severity > 0)) return;
    const tn = strokeTechOf(att) ?? (att.skill?.tap ? 'tap' : '-');
    const key = `${att === O ? 'L' : 'S'}:${tn}`;
    byTech[key] = (byTech[key] ?? 0) + r.severity;
    last.set(vic, key);
  };
  let end = null;
  const trk = new Map(); // 싸움꾼 → 굴림 때를 적는 셸하우 공격 기록 (맞기 전 고리 · 맞은 뒤 POST 스텝)
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
          trk.set(a.me, cs);
        } else if (!(a.mode === 'attack' && a.tech?.name === 'schielhau')) curS.delete(a.me);
        lastPh.set(a, ph);
      }
      for (const [f, rec] of trk) {
        if (!rec.hit && curS.get(f) !== rec) trk.delete(f);
        else {
          rollTrack(rec, f);
          if (rec.hit && rec.hit.post.length >= POST) trk.delete(f);
        }
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
    plan: planP50(H),
    phys: physP50(H),
    rollT: rollTiming(H),
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
    for (let s = 1; s <= seeds; s++) runs.push(duelRun(s, { dur: +(args.dur ?? 40), foe: args.foe ?? 'ai', immortal: !!args.immortal }));
    const first = args.first ? +args.first : 0; // 씨앗마다 앞 N 칼만 (지치기 전 · 고른 견줌 — --immortal 과 같이)
    res = duelSummary(first ? runs.map((r) => ({ ...r, rows: r.rows.slice(0, first) })) : runs);
    console.log(`셸하우 duel${args.set ? ` · set ${args.set}` : ''}${args.path ? ` · 길 ${args.path}` : ''}${args.plan ? ` · 덧칸 ${args.plan}` : ''}: ${JSON.stringify(res)}`);
    if (args.rows) for (const r of runs.flatMap((x) => x.rows)) console.log(JSON.stringify({ t0: +r.t0.toFixed(2), tip: +r.tip.toFixed(1), ...(r.hit ? { type: r.hit.type, zone: r.hit.zone, sev: +r.hit.sev.toFixed(3), E: +r.hit.energy.toFixed(0), dev: r.hit.s ? +r.hit.s.dev.toFixed(0) : null, fe: r.hit.s ? +r.hit.s.fe.toFixed(0) : null, roll: r.hit.s ? +r.hit.s.roll.toFixed(0) : null, fix: +r.hit.fix.toFixed(1) } : { miss: 1 }) }));
  } else if (mode === 'player') {
    if (PATCH) {
      // 시험 길 · 덧칸: 사람 곁눈 베기가 읽는 자리(unique_assist.js uniqueDef — 다시 그린 길을 쓰는 판이면 redraw 칸)를 덮는다
      const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
      Object.assign(CONFIG.UNIQUE_ASSIST.schielPath && CONFIG.UNIQUE_ASSIST.schielPlayer && u.redraw ? u.redraw : u, PATCH);
    }
    const seeds = +(args.seeds ?? 6);
    const S0 = +(args.seed0 ?? 1);
    const spd = args.spd ? String(args.spd).split(',').map(Number) : [3, 5.5];
    const runs = [];
    for (let s = S0; s < S0 + seeds; s++) runs.push(playerRun(s, { dur: +(args.dur ?? 40), foe: args.foe ?? 'still', finger: args.finger ?? 'zornhau', spd, jit: args.jit != null ? +args.jit : 0.04, sjit: +(args.sjit ?? 0), foeW: args.foeW ?? 'longsword', immortal: !!args.immortal }));
    const first = args.first ? +args.first : 0;
    res = { ...duelSummary(first ? runs.map((r) => ({ ...r, rows: r.rows.slice(0, first) })) : runs), drawn: runs.reduce((a, r) => a + r.drawn, 0), fired: runs.reduce((a, r) => a + r.fired, 0), power: runs.reduce((a, r) => a + r.power, 0) };
    console.log(`사람 곁눈 베기 (손가락 ${args.finger ?? 'zornhau'} · 상대 ${args.foe ?? 'still'})${args.set ? ` · set ${args.set}` : ''}${args.plan ? ` · 덧칸 ${args.plan}` : ''}: ${JSON.stringify(res)}`);
  } else if (mode === 'fight') {
    if (PATCH) {
      const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
      Object.assign(CONFIG.UNIQUE_ASSIST.schielPath && CONFIG.UNIQUE_ASSIST.schielPlayer && u.redraw ? u.redraw : u, PATCH);
    }
    const opps = String(args.opps ?? 'longsword,zweihander,rapier,qinggang,uchigatana,flamberge').split(',');
    const seeds = String(args.fseeds ?? '901,902,903').split(',').map(Number);
    const delays = String(args.delays ?? '0.12,0.22').split(',').map(Number);
    const runs = [];
    for (const opp of opps) for (const seed of seeds) for (const delay of delays) runs.push(playerFight(seed, opp, { delay, prof: +(args.prof ?? 3), dur: +(args.dur ?? 30), share: +(args.share ?? 0.5) }));
    const sum = (f) => +runs.reduce((a, r) => a + f(r), 0).toFixed(2);
    res = { ...duelSummary(runs.map((r) => ({ rows: r.rows, dead: r.win }))), n: runs.length, win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length, schielSev: sum((r) => r.schielSev), dealt: sum((r) => r.dealt), recv: sum((r) => r.recv), fired: sum((r) => r.fired) };
    const byOpp = {};
    for (const r of runs) {
      const o = (byOpp[r.opp] ??= { n: 0, win: 0, lose: 0, schielSev: 0, atk: 0, sev: 0 });
      o.n++;
      o.win += r.win ? 1 : 0;
      o.lose += r.lose ? 1 : 0;
      o.schielSev = +(o.schielSev + r.schielSev).toFixed(2);
      o.atk += r.rows.length;
      o.sev = +(o.sev + r.rows.reduce((a, x) => a + (x.hit?.sev ?? 0), 0)).toFixed(2);
    }
    res.byOpp = byOpp;
    console.log(`사람 곁눈 베기 싸움 (손가락 봇 · AI 숙련 ${args.prof ?? 3})${args.set ? ` · set ${args.set}` : ''}${args.plan ? ` · 덧칸 ${args.plan}` : ''}: ${JSON.stringify(res)}`);
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
