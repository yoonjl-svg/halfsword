// ─────────────────────────────────────────────────────────────
//  무리 싸움 판단 (사장님 11/18 '다대다 전투에서 ai의 지능이 너무 무식하긴 해 … 눈 앞의 적과 싸우는 것 이상의 결정을 내리지 못해' ·
//   설계 docs/design/team_sense_2026-11-18.md · 사장님 11/18 '정할 것에 대해서는 너의 권고대로 할게')
//
//  셋 이상 판에서만 돈다: 판 사본 M.sense 는 createMatch 가 싸움꾼 셋 이상일 때만 만들고(src/match.js), AI 쪽은 ai.js 의 me.foes 갈래 안에서만 부른다.
//  1:1 은 이 파일을 하나도 타지 않는다. 난수를 부르지 않는다 (같은 씨앗 = 같은 판).
//  편 수를 셈하지 않는다 — '같은 편'은 늘 sameSide(team.js) 하나로 가르고, 판 사본은 몸 N 개 · 편 N 개 그대로 적는다 (셋 이상 따로 싸우는 판을 만들 때도 그대로 — 사장님 11/18 '셋 이상의 난전도 만들 계획 있어').
//  이 파일은 targeting.js · ai.js 를 읽지 않는다 (둘이 이 파일을 읽음 — 돌림 import 없게). 작은 셈(치는 중 · 칼끝 거리)은 그 파일과 같은 셈을 여기 둔다.
//
//  판 사본 (§3-0): 판이 TEAM_SENSE.frame 마다 한 장 — 모든 몸의 자리 · 바라보는 쪽 · 겨눈 상대 · 치는 중 · 서 있나 · 피 · 다침 · 지침 · 칼끝 거리 · 붙음(겨눈 상대와 칼끝 + engage 안).
//   AI 는 제 층의 눈으로 읽는다 — 늦음(lag 만큼 지난 장) · 시야(그 장의 내 바라보는 쪽 ± fov/2 · 지금 겨눈 상대는 늘 보임 — AI 의 제 눈이 따로 봄).
//  층 (§4 · 사장님 11/18 8. 권고대로 — 본 유파 숙련도 ai.mainProficiency): 바탕(0 ~ 2) · 가운데(3 ~ 5 — 몫 k = (숙련 − 2) ÷ 3) · 위(6)
//  행동 (P1 바탕 — 모든 AI):
//   칼길 비우기 (§3-1)   내 칼 부채꼴(칼끝 + 0.3 · 앞 ± lane.fan°) 안 · 나 → 상대 사이에 동료 몸이 있으면 새 공격을 lane.hold 동안 미룸(막기 · 맞받기는 그대로) · 옆으로 비켜 나란히
//   협공 자리 (§3-3)      동료가 붙은 내 상대를 그 상대 자리에서 본 동료와 나 사이 각 θ 가 층 목표 θ*(바탕 60° — 나란히 · 동료 뒤 줄만 피함)보다 작으면 그 상대를 축으로 돎
//   엄호 겨눔 (§3-6)      넘어짐 · 무릎 · 피 cover.blood 밑 동료를 겨눈 적 − cover.sub (상대 고르기 점수 — targeting.js) · 바꿈 기다림 cover.hold
//   열세 바탕 (§3-5)      숙련도 레버(줄 세우기 · 피하기 — ai.js teamFeet)의 몫을 out.base 부터 · 열세는 '내 둘레의 수' — 내 동료와 붙은 적은 줄 세우기 · 둘러싸임에서 뺌
//  행동 (P2 가운데 3 ~ 5 — 몫 k 로 커짐 · 위 6 은 k = 1 위에 P3):
//   노릴 상대 (§3-2)      내 동료와 붙었고(셋 따로 판은 제삼자와도) 내게 옆 · 등을 보인 적 − opp.side × k · 다친 적 − opp.wound × 다침 × k · 지친 적 − opp.tired × k ·
//                          다친 적(피 opp.focus 밑)은 나눠 맡기(+ allyAdd)를 k 만큼 거둠 = 몰아침 (§3-7) — 내가 지금 상대에게 붙잡혀 있으면(그 상대가 나를 겨눠 붙음) 이 덧셈은 없음(등을 보이지 않게)
//   협공 자리 (§3-3)      θ* = 바탕 → mid 를 k 만큼 (3 = 80° · 4 = 100° · 5 = 120°)
//   옆 기습 (§3-4)        겨눈 상대가 내 동료와(셋 따로 판은 제삼자와도) 붙었고 내가 그 앞(± ambush.front°) 밖이면 빈틈 점수 + ambush.mid × k ('ambush' — ai.js opportunity)
//   끼어듦 (§3-6)         겨눈 상대가 다친 동료를 겨누면 그 상대를 축으로 동료 쪽으로 돌아 사이에 섬 (cover.k × k)
// ─────────────────────────────────────────────────────────────
import { TEAM_SENSE, TEAM_FIGHT } from './config.js';
import { sameSide } from './team.js';
import { woundDegree } from './combat.js';

const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
/** g 가 치는 중인가 (targeting.js isAttacking 과 같은 셈) */
const isAtk = (g) => (g.aiCtl ? g.aiCtl.mode === 'attack' || !!g.aiCtl.secretRun : !!g.stamina?.attacking || !!g.skill?.swinging || !!g.skill?.tap);
/** g 의 칼끝 거리 (targeting.js reachOf 와 같음) */
const reachOf = (g) => g.aiCtl?.M?.reach ?? g.swordArt?.measure?.reach ?? 1.8;

// ───────────────────────── 판 사본 ─────────────────────────

/** 판 사본 그릇 (createMatch — 셋 이상 판만). frames = 지난 장들(오래된 것부터) · keep = 가장 늦은 눈 + 한 장 */
export function createSense(M) {
  const E = TEAM_SENSE.eye;
  const keep = Math.max(E.base.lag, E.mid.lag, E.top.lag) + 2 * TEAM_SENSE.frame;
  return { frames: [], next: 0, keep, fighters: M.fighters };
}

/** 몸 하나의 한 장 칸 */
function bodyRec(f) {
  const c = f.bodies.chest.translation();
  const v = f.bodies.pelvis.linvel();
  return {
    live: f.alive && !f.revival,
    stand: f.alive && !f.revival && f.state === 'stand',
    x: c.x,
    z: c.z,
    vx: v.x,
    vz: v.z,
    fx: Math.cos(f.heading),
    fz: -Math.sin(f.heading),
    foe: f.foe ? f.foe.index : -1,
    atk: f.alive && isAtk(f),
    blood: f.blood,
    wound: woundDegree(f),
    tired: !!f.stamina?.exhausted || (f.stamina?.level ?? 0) > 0,
    reach: reachOf(f),
    busy: false, // 겨눈 상대와 붙음 (아래에서 — 모든 칸을 적은 뒤)
  };
}

/** 한 장 적기 (stepMatch ① 상대 고르기 뒤 — 셋 이상 판만). TEAM_SENSE.frame 마다 */
export function recordSense(M) {
  const S = M.sense;
  if (M.t + 1e-9 < S.next) return;
  S.next = M.t + TEAM_SENSE.frame;
  const b = M.fighters.map(bodyRec);
  for (const r of b) {
    const x = r.foe >= 0 ? b[r.foe] : null;
    r.busy = !!x && r.live && x.live && Math.hypot(x.x - r.x, x.z - r.z) <= r.reach + TEAM_SENSE.engage;
  }
  S.frames.push({ t: M.t, b });
  while (S.frames.length > 2 && S.frames[1].t < M.t - S.keep) S.frames.shift();
}

/** lag 만큼 지난 장 (그보다 오래된 장이 없으면 가장 오래된 장 · 아직 없으면 null) */
export function frameAt(S, lag) {
  const F = S?.frames;
  if (!F?.length) return null;
  const want = F[F.length - 1].t - lag;
  let out = F[0];
  for (const fr of F) {
    if (fr.t > want + 1e-9) break;
    out = fr;
  }
  return out;
}

// ───────────────────────── 층 · 눈 ─────────────────────────

/** 숙련도 → 층 { tier 'base'|'mid'|'top', k(가운데 몫 0 ~ 1 · 위 1), eye } (본 유파 숙련도 — 다른 유파 무기를 들어도 그대로 · §4) */
export function tierOfProf(p) {
  const q = Math.round(p ?? 2);
  const E = TEAM_SENSE.eye;
  if (q >= 6) return { tier: 'top', k: 1, eye: E.top };
  if (q >= 3) return { tier: 'mid', k: clamp((q - 2) / 3, 0, 1), eye: E.mid };
  return { tier: 'base', k: 0, eye: E.base };
}

/** AI 의 층 (처음 한 번 적어 둠) */
export function tierOf(ai) {
  return (ai.tsTier ??= tierOfProf(ai.mainProficiency ?? ai.proficiency));
}

/** 그 장에서 i 가 j 를 보나 (i 의 바라보는 쪽 ± fov/2 · 360 이면 늘) */
function seesIn(fr, i, j, fov) {
  if (fov >= 360) return true;
  const a = fr.b[i];
  const g = fr.b[j];
  const x = g.x - a.x;
  const z = g.z - a.z;
  const d = Math.hypot(x, z);
  if (d < 1e-6) return true;
  return (x * a.fx + z * a.fz) / d >= Math.cos((fov / 2) * DEG);
}

/** AI 의 눈으로 본 판: { fr(늦은 장), me(내 칸), sees(j) } — 지금 겨눈 상대는 늘 보임 (AI 의 제 눈이 따로 본다) · 장이 없으면 null */
export function viewOf(ai) {
  const S = ai.me.teamSense;
  const T = tierOf(ai);
  const fr = frameAt(S, T.eye.lag);
  if (!fr) return null;
  const i = ai.me.index;
  const foe = ai.foe?.index ?? -1;
  return { fr, T, i, me: fr.b[i], sees: (j) => j === foe || seesIn(fr, i, j, T.eye.fov) };
}

/** 그 장에서 b 칸 몸이 a 칸 몸과 같은 편인가 (판 사본은 칸 번호 — 몸 목록에서 편을 읽음) */
const sameAt = (S, i, j) => sameSide(S.fighters[i], S.fighters[j]);

/**
 * 그 장에서 적 j 가 나(i) 아닌 서 있는 몸과 붙어 있나 — 두 편 판에서는 그 몸이 늘 내 동료(j 는 제 편을 겨누지 않음) · 셋 이상 따로 싸우는 판에서는 제삼자도
 *  (편 수를 셈하지 않음 — 사장님 11/18 '셋 이상의 난전도 만들 계획 있어': 남과 붙은 적은 내 둘레의 수가 아니고 칼이 그쪽에 있다)
 */
export function busyWithOther(S, fr, i, j) {
  const r = fr.b[j];
  return r.busy && r.foe >= 0 && r.foe !== i && fr.b[r.foe].stand;
}

/** 그 장에서 j 의 앞(± deg°) 밖에 i 가 있나 (j 가 i 에게 옆 · 등을 보임) */
export function outsideFront(fr, j, i, deg) {
  const g = fr.b[j];
  const a = fr.b[i];
  const x = a.x - g.x;
  const z = a.z - g.z;
  const d = Math.hypot(x, z);
  if (d < 1e-6) return false;
  return (x * g.fx + z * g.fz) / d < Math.cos(deg * DEG);
}

/** 그 장에서 i 가 지금 상대 j 에게 붙잡혀 있나 (j 가 i 를 겨눠 제 칼끝 + engage 안) — 이때는 다른 적을 노리는 덧셈이 없음 (등을 보이지 않게) */
export function pinnedBy(fr, i, j) {
  if (j < 0) return false;
  const g = fr.b[j];
  return g.live && g.foe === i && g.busy;
}

// ───────────────────────── 상대 고르기 덧셈 (targeting.js targetScore — M.sense 있을 때 · AI 만) ─────────────────────────

/** 다친 동료(넘어짐 · 무릎 · 피 cover.blood 밑)를 겨눈 적인가 — 그 장에서 */
function coverFoe(S, fr, i, j) {
  const r = fr.b[j];
  if (!r.live || r.foe < 0 || r.foe === i || !sameAt(S, i, r.foe)) return false;
  const m = fr.b[r.foe];
  return m.live && (!m.stand || m.blood < TEAM_SENSE.cover.blood);
}

/**
 * f 가 g 를 겨눌 점수 덧셈 (m, 낮을수록 고름 · 0 = 그대로). 사람 몸(aiCtl 없음)은 0 — 사람의 상대는 사람이 정한다(지금 그대로).
 *  바탕: 다친 동료를 겨눈 적 − cover.sub (내 눈에 보일 때)
 *  가운데 · 위 (몫 k): 내 동료와 붙어 내게 옆 · 등을 보인 적 · 다친 적 · 지친 적 − · 다친 적은 나눠 맡기를 거둠 (지금 상대에게 붙잡혀 있지 않을 때)
 */
export function senseScore(M, f, g) {
  const ai = f.aiCtl;
  if (!ai || !f.teamSense) return 0;
  const v = viewOf(ai);
  if (!v || !v.sees(g.index)) return 0;
  const S = M.sense;
  const O = TEAM_SENSE.opp;
  let s = 0;
  if (coverFoe(S, v.fr, f.index, g.index)) s -= TEAM_SENSE.cover.sub;
  const k = v.T.k;
  if (k > 0 && (g === ai.foe || !pinnedBy(v.fr, v.i, ai.foe?.index ?? -1))) {
    const r = v.fr.b[g.index];
    if (busyWithOther(S, v.fr, v.i, g.index) && outsideFront(v.fr, g.index, v.i, TEAM_SENSE.ambush.front)) s -= O.side * k;
    s -= O.wound * r.wound * k;
    if (r.tired) s -= O.tired * k;
    if (r.blood < O.focus) for (const m of M.fighters) if (m !== f && sameSide(m, f) && m.alive && m.foe === g) s -= TEAM_FIGHT.target.allyAdd * k; // 몰아침 (§3-7): 나눠 맡기 덧셈을 거둠
  }
  return s;
}

/** 바꿈 기다림 (chooseTarget): 엄호 바꿈이면 cover.hold — 아니면 null (예전 hold 그대로) */
export function senseHold(M, f, g) {
  const ai = f.aiCtl;
  if (!ai || !f.teamSense) return null;
  const v = viewOf(ai);
  if (!v || !v.sees(g.index)) return null;
  return coverFoe(M.sense, v.fr, f.index, g.index) ? TEAM_SENSE.cover.hold : null;
}

// ───────────────────────── 칼길 비우기 (§3-1) ─────────────────────────

/**
 * 나 → 지금 상대 사이에 선 동료: { side(+ = 동료가 내 오른쪽), perp(줄에서 떨어진 m), fan(내 칼 부채꼴 안인가) } · 없으면 null.
 *  늦은 장의 자리로 셈 (동료는 내 앞이라 보임 — 시야 셈 없음)
 */
export function laneMate(ai, v = viewOf(ai)) {
  if (!v || !ai.foe) return null;
  const S = ai.me.teamSense;
  const L = TEAM_SENSE.lane;
  const a = v.me;
  const x = v.fr.b[ai.foe.index];
  const dx = x.x - a.x;
  const dz = x.z - a.z;
  const D = Math.hypot(dx, dz);
  if (D < 1e-6) return null;
  const ux = dx / D;
  const uz = dz / D;
  const rx = -a.fz; // 내 오른쪽 (fighter.right — 바라보는 쪽에서 시계 방향 90°)
  const rz = a.fx;
  const reach = a.reach + L.sweep;
  let best = null;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameAt(S, v.i, j)) continue;
    const m = v.fr.b[j];
    if (!m.live) continue;
    const px = m.x - a.x;
    const pz = m.z - a.z;
    const t = px * ux + pz * uz;
    if (t <= 0 || t >= D) continue;
    const perp = Math.abs(px * uz - pz * ux);
    if (perp >= L.w) continue;
    const dm = Math.hypot(px, pz);
    const fan = dm <= reach && (px * a.fx + pz * a.fz) / (dm || 1) >= Math.cos(L.fan * DEG);
    if (!best || perp < best.perp) best = { side: Math.sign(px * rx + pz * rz) || 1, perp, fan };
  }
  return best;
}

/** 새 공격을 미루나 (ai.js atkGate — me.foes 갈래): 동료가 내 칼 부채꼴 안 · 나 → 상대 사이 → lane.hold 동안 미룸 (막기 · 맞받기 · 이어 치기 · 비기는 안 미룸 — 부르는 쪽이 가림) */
export function laneHold(ai) {
  const now = ai.sense?.t ?? 0;
  if (now < (ai.tsLaneT ?? -Infinity)) return true;
  const L = laneMate(ai);
  if (!L?.fan) return false;
  ai.tsLaneT = now + TEAM_SENSE.lane.hold;
  (ai.stats.team ??= teamStats()).laneHold++;
  return true;
}

/** 재기 칸 (ai.stats.team) */
export function teamStats() {
  return { laneHold: 0, laneStep: 0, pincer: 0, interpose: 0, ambush: 0 };
}

// ───────────────────────── 기습 (§3-4 — ai.js opportunity · me.foes 갈래) ─────────────────────────

/**
 * 빈틈 점수 덧셈 { v, kind: 'ambush' } 또는 null: 겨눈 상대가 내 동료와 붙었고 내가 그 앞(± ambush.front°) 밖 (가운데 · 위 — 몫 k).
 *  가운데: + ambush.mid × k
 */
export function ambushOpp(ai) {
  const v = viewOf(ai);
  if (!v || !ai.foe || v.T.k <= 0) return null;
  const S = ai.me.teamSense;
  const j = ai.foe.index;
  if (!busyWithOther(S, v.fr, v.i, j) || !outsideFront(v.fr, j, v.i, TEAM_SENSE.ambush.front)) return null;
  return { v: TEAM_SENSE.ambush.mid * v.T.k, kind: 'ambush' };
}

// ───────────────────────── 발 (ai.js teamFeet 끝 — 간 보기 · 물러남 · 공격 준비) ─────────────────────────

/** o 자리에서 본 a · b 사이 각 (라디안 · 장의 칸) */
function angAt(o, a, b) {
  const ux = a.x - o.x;
  const uz = a.z - o.z;
  const wx = b.x - o.x;
  const wz = b.z - o.z;
  return Math.acos(clamp((ux * wx + uz * wz) / ((Math.hypot(ux, uz) * Math.hypot(wx, wz)) || 1), -1, 1));
}

/** me 가 o 를 축으로 돌 때 옆 스틱 부호: away = 1 이면 b 에게서 멀어지는 쪽(각 ↑) · −1 이면 b 쪽(각 ↓). 스틱 오른쪽 = me 의 바라보는 쪽에서 시계 방향 90° */
function orbit(o, me, b, away) {
  const ux = me.x - o.x;
  const uz = me.z - o.z;
  const wx = b.x - o.x;
  const wz = b.z - o.z;
  let tx = -uz;
  let tz = ux;
  if ((tx * wx + tz * wz) * away > 0) (tx = -tx), (tz = -tz);
  return Math.sign(tx * -me.fz + tz * me.fx || 1);
}

/** 협공 목표 각 θ* (°) — 층 상한 */
export function pincerGoal(T) {
  const P = TEAM_SENSE.pincer;
  return T.tier === 'top' ? P.top : T.tier === 'mid' ? P.base + (P.mid - P.base) * T.k : P.base;
}

/**
 * 스틱 (fwd 앞 · side 오른쪽)을 고쳐 돌려준다 — 칼길 비우기 · 협공 자리. 베는 중 · 비기 동안은 부르는 쪽이 안 부름.
 */
export function senseFeet(ai, fwd, side) {
  const v = viewOf(ai);
  if (!v || !ai.foe) return [fwd, side];
  const S = ai.me.teamSense;
  const St = (ai.stats.team ??= teamStats());
  // ① 칼길 비우기: 나 → 상대 줄에 선 동료에게서 옆으로 (가까울수록 세게)
  const L = laneMate(ai, v);
  if (L) {
    side -= L.side * TEAM_SENSE.lane.k * clamp(1 - L.perp / TEAM_SENSE.lane.w, 0.3, 1);
    St.laneStep++;
  }
  // ② 끼어듦 (가운데 · 위 — §3-6): 겨눈 상대 X 가 다친 동료 D 를 겨누면 X 를 축으로 D 쪽으로 돌아 X 와 D 사이에 섬
  const X = v.fr.b[ai.foe.index];
  if (X.live && !L && v.T.k > 0 && (ai.mode === 'watch' || ai.mode === 'withdraw') && coverFoe(S, v.fr, v.i, ai.foe.index)) {
    const D = v.fr.b[X.foe];
    const th = angAt(X, v.me, D);
    if (th > TEAM_SENSE.pincer.tol * DEG) {
      side += orbit(X, v.me, D, -1) * TEAM_SENSE.cover.k * v.T.k * clamp(th / (Math.PI / 2), 0.3, 1);
      St.interpose++;
    }
    return [fwd, side];
  }
  // ③ 협공 자리: 내 상대 X 에 붙은(또는 겨눈) 동료 B — X 자리에서 본 B · 나 사이 각이 목표보다 작으면 X 를 축으로 B 에게서 멀어지는 쪽으로 돎
  if (X.live && !L && (ai.mode === 'watch' || ai.mode === 'withdraw')) {
    const goal = pincerGoal(v.T) * DEG;
    let B = null;
    for (let j = 0; j < v.fr.b.length; j++) {
      if (j === v.i || !sameAt(S, v.i, j)) continue;
      const m = v.fr.b[j];
      if (!m.stand || m.foe !== ai.foe.index || Math.hypot(X.x - m.x, X.z - m.z) > m.reach + TEAM_SENSE.engage + TEAM_SENSE.pincer.near) continue;
      if (!B || Math.hypot(X.x - m.x, X.z - m.z) < Math.hypot(X.x - B.x, X.z - B.z)) B = m;
    }
    if (B) {
      const th = angAt(X, v.me, B);
      if (th < goal - TEAM_SENSE.pincer.tol * DEG) {
        side += orbit(X, v.me, B, 1) * TEAM_SENSE.pincer.k * clamp((goal - th) / (goal / 2), 0.3, 1);
        St.pincer++;
      }
    }
  }
  return [fwd, side];
}

/** 열세 몫 (숙련도 레버의 sk 를 갈음 — ai.js teamFeet): out.base + (1 − out.base) × 층 몫 k */
export function outSkill(ai) {
  const T = tierOf(ai);
  return TEAM_SENSE.out.base + (1 - TEAM_SENSE.out.base) * T.k;
}

/** 열세 셈에서 뺄 적인가 (ai.js teamFeet 둘러싸임 · 줄 세우기): 내 눈에 보이고 나 아닌 몸(두 편 판 = 내 동료)과 붙어 있으면 true — 내 둘레의 수가 아님 */
export function busyFoe(ai, g) {
  const v = viewOf(ai);
  if (!v || !v.sees(g.index)) return false;
  return busyWithOther(ai.me.teamSense, v.fr, v.i, g.index);
}
