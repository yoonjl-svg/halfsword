// ─────────────────────────────────────────────────────────────
//  서포트 — 유파마다 동료로서의 판단 (사장님 11/19 '동방과 독일이 서포트에 강하고 이베리아가 서포트에 특별히 도움 안 되는 걸로 하자. 동료 칼에 의한 피격 가능성을
//   열어둬야 하는데 … 그러면 이베리아는 자연스럽게 운신의 폭이 넓어지거나 때로는 팀킬도 해야 마땅해. 그리고 이베리아 혼자 대 다수전을 특별히 낮춰잡을 필요는 없어.' ·
//   기록 docs/strike/team_support_2026-11-19.md)
//
//  규칙은 그대로 — 판단 · 꼴만 (사장님 '가급적 ai와 사람이 같아야 한다'): 새 힘 · 빠르기 · 판정 수 없음. 같은 편 칼은 이미 적과 같다(사장님 10/29 22:3x — fighter.js FFA 비트 · combat.js).
//  몫 w = 숙련 곡선 MINDSET.profF[손에 든 유파 숙련] (f = max(0, 1 − ((6 − p)/4)²) — 숙련 2 이하 0 · 6 이 1 · 마음가짐 '검술이 높을수록 유파다워진다'와 같은 곡선) — 유파 칸이 없는 몸 · 무유파는 0.
//  셋 이상 판에서만: 판 사본(me.teamSense)이 있는 AI 만 부른다 (ai.js me.foes 갈래 · targeting.js M.sense) — 1:1 은 이 파일을 하나도 타지 않는다. 난수를 부르지 않는다.
//  이 파일은 team_sense.js · targeting.js · ai.js 를 읽지 않는다 (셋이 이 파일을 읽음 — 돌림 import 없게) — 판 사본 읽기(층 눈의 늦은 장)는 team_sense.js 와 같은 작은 셈을 여기 둔다.
//
//  독일 (묶어 주는 동료 — 선공 · 붙어 싸움):
//   ① 동료 칼길 밖 (발): 동료 칼길(동료 → 그 상대 선분 laneW m 안)에 서면 줄에서 먼 쪽으로 비킴 (간 보기 · 물러남 · 막기 · 공격 준비 · 다가감) ·
//      내 상대 X 가 동료 B 와 붙어 있으면 X 자리에서 본 B · 나 사이 각 θ 를 de.goal° 까지 X 를 축으로 B 에게서 먼 쪽으로 돎 — 옆에서 묶음 [사장님 11/19 답 '동료 칼길 옆에서 묶기']
//   ② 밀치기 · 묶기 (ai.js closeQuarters — 붙은 거리 안 · 몸은 사람과 같은 밀치기 · 묶임 규칙 CLOSE.holdMin · holdLock 그대로):
//      내 → X 가 동료 쪽(θ ≥ de.shove°)이고 X 가 동료 칼끝 + de.reach 안이면 밂 / 서 있는 동료가 X 에서 de.pinR m 안이면 묶음 /
//      서 있는 적이 둘 이상이고 X 가 내 동료와 붙지 않았으면(제 적 — 2:2) 묶음: 묶인 동안 X 는 칼을 못 냄 — 제 적을 묶어 두어 동료에게 가지 않게 /
//      내가 동료 칼길 위에 서 있으면 밀지 않음 (굴림이 밀기로 정했어도 — 감독 11/19 답 3)
//   ③ 박자 (ai.js opportunity): 동료가 X 를 치는 중(그 칼끝 + engage 안)이면 빈틈 점수 + de.follow ('ambush' — 동료와 같은 박자에 침)
//   동료의 적으로 겨눔을 바꾸지 않음 (3 차 재기: 2:2 에서 제 적이 풀려 동료를 침 — 4 차에서 뺌)
//  동방 (동료를 지키는 칼 — 집요함):
//   ① 동료 칼길 밖 (발 — 간 보기 · 물러남)
//   ② 동료를 치는 적 (targeting.js): 내 동료와 붙은 적 − cn.focus · 그 적이 동료를 치는 중이면 − cn.hit 더 (지금 상대에게 붙잡혀 있으면 없음)
//   ③ 기습 (opportunity): 그 적이 동료와 붙었고 내가 그 앞(± TEAM_SENSE.ambush.front°) 밖이면 빈틈 점수 + cn.ambush
//   ④ 치고 빠짐 (ai.js afterStrike): 내 상대가 동료와 붙어 있으면 내 칼 뒤 이어 치기 마음 × (1 − cn.run) — 빠져 다시 봄 (동방 몸의 사냥 겹 · 칼 떨굼은 그대로 — 새 수 없음)
//   옆 · 등으로 돌기는 뺌 (3 차 재기: 도움 칼만 올리고 동료가 받는 상처는 못 줄임)
//  이베리아 (넓은 원이 동료 자리를 가로지름 — 감독 권고 11/19 · 사장님 '운신의 폭이 넓어지거나 때로는 팀킬도' — 사장님 답 전):
//   ① 원 걸음 (발 — 간 보기 · 물러남): 서 있는 동료가 ib.crossR m 안이면 제 원을 그 동료 쪽으로 돎 (동료 앞 · 칼길을 지나감 — 크기는 제 걸음 그대로 · 쪽만)
//   ② 같은 편 비킴(TEAM_FIGHT.mateSep) 거리 × (1 − (1 − ib.sepX) × w) — 동료 곁을 비키지 않고 지나감 (부딪힘)
//   ③ 칼길: 동료가 내 칼길 한가운데(줄에서 lane.w × (1 − ib.lane × w) 안)가 아니면 공격을 미루지 않음 (ai.js atkGate) · 칼길 비키는 걸음 × (1 − ib.lane × w)
//   → 동료 칼길 가림 · 부딪힘 · 가끔 벰 (대본 아님 — 재서 봄) · 혼자 판은 그대로 (모두 '서 있는 동료'가 있을 때의 셈)
//  이탈리아: 결투 고집은 마음가짐 줄 many(ally · hunt — 수가 밀릴 때의 lever · out · fix 와 같은 칸)로 옮김 — 이 파일에는 없음
//  일본: 칸 없음 (혼자 대 다수 유파)
// ─────────────────────────────────────────────────────────────
import { TEAM_SUPPORT, TEAM_SENSE, MINDSET } from './config.js';
import { sameSide } from './team.js';

const DEG = Math.PI / 180;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SCH = { german: 'de', chinese: 'cn', iberian: 'ib' };

/** 이 AI 의 서포트 칸 { key('de' · 'cn' · 'ib' · 'it' · null), w(숙련 곡선 몫) } — 처음 한 번 적어 둠 (유파 · 숙련은 판 동안 그대로) */
export function supportOf(ai) {
  if (ai.supS) return ai.supS;
  const key = SCH[ai.art?.tradition] ?? null;
  const p = clamp(Math.round(ai.proficiency ?? 6), 0, MINDSET.profF.length - 1);
  return (ai.supS = { key, w: key && TEAM_SUPPORT[key] ? MINDSET.profF[p] : 0 });
}
/** 그 유파 몫 (아니면 0) */
const wOf = (ai, key) => { const S = supportOf(ai); return S.key === key ? S.w : 0; };

/** 재기 칸 (ai.stats.support) */
export function supportStats() {
  return { deLane: 0, deOrbit: 0, deShove: 0, dePin: 0, deNoShove: 0, deFollow: 0, cnLane: 0, cnAmbush: 0, cnRun: 0, ibLaneFree: 0, ibLaneStep: 0, ibCross: 0 };
}
const stats = (ai) => (ai.stats.support ??= supportStats());

// ───────── 판 사본 읽기 (team_sense.js frameAt · tierOfProf · 시야와 같은 셈) ─────────
/** 층 눈 (본 유파 숙련도 — team_sense.js tierOfProf 와 같은 가름) */
function eyeOf(ai) {
  const q = Math.round(ai.mainProficiency ?? ai.proficiency ?? 2);
  const E = TEAM_SENSE.eye;
  return q >= 6 ? E.top : q >= 3 ? E.mid : E.base;
}
/** lag 만큼 지난 장 (team_sense.js frameAt 과 같음) */
function frameAt(S, lag) {
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
/** 내 눈으로 본 장 { fr, i, me, fov } · 없으면 null */
function viewOf(ai) {
  const S = ai.me.teamSense;
  const E = eyeOf(ai);
  const fr = frameAt(S, E.lag);
  if (!fr) return null;
  return { S, fr, i: ai.me.index, me: fr.b[ai.me.index], fov: E.fov };
}
/** 그 장에서 i 가 j 를 보나 (± fov/2) */
function sees(v, j) {
  if (v.fov >= 360 || j === v.i) return true;
  const g = v.fr.b[j];
  const x = g.x - v.me.x;
  const z = g.z - v.me.z;
  const d = Math.hypot(x, z);
  return d < 1e-6 || (x * v.me.fx + z * v.me.fz) / d >= Math.cos((v.fov / 2) * DEG);
}
/** o 자리에서 본 a · b 사이 각 (rad) */
function angAt(o, a, b) {
  const ux = a.x - o.x;
  const uz = a.z - o.z;
  const wx = b.x - o.x;
  const wz = b.z - o.z;
  return Math.acos(clamp((ux * wx + uz * wz) / ((Math.hypot(ux, uz) * Math.hypot(wx, wz)) || 1), -1, 1));
}
/** me 가 o 를 축으로 b 에게서 멀어지는 쪽(각 ↑)으로 도는 옆 스틱 부호 (스틱 오른쪽 = 바라보는 쪽에서 시계 방향 90° — team_sense.js orbit 과 같음) */
function orbitAway(o, me, b) {
  const ux = me.x - o.x;
  const uz = me.z - o.z;
  let tx = -uz;
  let tz = ux;
  if (tx * (b.x - o.x) + tz * (b.z - o.z) > 0) (tx = -tx), (tz = -tz);
  return Math.sign(tx * -me.fz + tz * me.fx || 1);
}
/** 그 장에서 적 j 가 나(i) 아닌 내 동료와 붙어 있나 (j 가 그 동료를 겨눠 제 칼끝 + engage 안 · 그 동료 서 있음) */
function busyWithMate(v, j) {
  const r = v.fr.b[j];
  return r.busy && r.foe >= 0 && r.foe !== v.i && v.fr.b[r.foe].stand && sameSide(v.S.fighters[r.foe], v.S.fighters[v.i]);
}
/** 내 상대 x 에 붙은(겨눈) 서 있는 동료 칸 번호 (가장 가까운 — 그 동료 칼끝 + engage + pincer.near 안) · 없으면 −1 */
function mateOn(v, x) {
  const X = v.fr.b[x];
  let best = -1;
  let bd = Infinity;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
    const m = v.fr.b[j];
    if (!m.stand || m.foe !== x) continue;
    const d = Math.hypot(X.x - m.x, X.z - m.z);
    if (d > m.reach + TEAM_SENSE.engage + TEAM_SENSE.pincer.near || d >= bd) continue;
    (bd = d), (best = j);
  }
  return best;
}
/** 나 → 지금 상대 줄에 선 동료 (team_sense.js laneMate 와 같은 셈): { side, perp, fan } · 없으면 null */
function laneOf(ai, v) {
  const L = TEAM_SENSE.lane;
  const a = v.me;
  const x = v.fr.b[ai.foe.index];
  const dx = x.x - a.x;
  const dz = x.z - a.z;
  const D = Math.hypot(dx, dz);
  if (D < 1e-6) return null;
  const ux = dx / D;
  const uz = dz / D;
  const reach = a.reach + L.sweep;
  let best = null;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
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
    if (!best || perp < best.perp) best = { side: Math.sign(px * -a.fz + pz * a.fx) || 1, perp, fan };
  }
  return best;
}
/** 그 장에서 i 가 지금 상대 j 에게 붙잡혀 있나 (team_sense.js pinnedBy 와 같음) */
const pinnedBy = (fr, i, j) => j >= 0 && fr.b[j].live && fr.b[j].foe === i && fr.b[j].busy;

// ───────── 상대 고르기 덧셈 (targeting.js targetScore — M.sense 있을 때 · AI 만) ─────────
/** f 가 g 를 겨눌 점수 덧셈 (m · 낮을수록 고름 · 0 = 그대로) */
export function supportScore(M, f, g) {
  const ai = f.aiCtl;
  if (!ai || !f.teamSense) return 0;
  const S = supportOf(ai);
  if (!(S.w > 0)) return 0;
  if (S.key !== 'cn') return 0; // 동방만 (독일은 4 차에서 뺌 — 제 적을 묶어 둠)
  const v = viewOf(ai);
  if (!v || !sees(v, g.index) || !v.fr.b[g.index].stand || !busyWithMate(v, g.index)) return 0;
  if (g !== ai.foe && pinnedBy(v.fr, v.i, ai.foe?.index ?? -1)) return 0; // 지금 상대에게 붙잡혀 있으면 등을 보이지 않음
  const C = TEAM_SUPPORT.cn;
  return -(C.focus + (v.fr.b[g.index].atk ? C.hit : 0)) * S.w; // 동료를 치는 적 — 치는 중이면 더
}

// ───────── 발 (ai.js teamFeet 끝 — 베는 중 · 비기 빼고) ─────────
/**
 * 내가 동료의 칼길(동료 → 그 동료 상대 선분 · 그 사이)에 서 있나 — { side(줄에서 벗어나는 옆 스틱 부호), perp(줄에서 m) } · 아니면 null.
 *  team_sense.js 칼길 비우기의 거울: 그쪽은 '내 칼길에 선 동료'에서 내가 비키고, 이쪽은 '동료 칼길에 선 나'가 비킴 (독일 · 동방 — 동료를 보는 유파)
 */
function inMateLane(v) {
  const me = v.me;
  let best = null;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
    const m = v.fr.b[j];
    if (!m.stand || m.foe < 0 || m.foe === v.i) continue;
    const y = v.fr.b[m.foe];
    if (!y.live) continue;
    const dx = y.x - m.x;
    const dz = y.z - m.z;
    const D = Math.hypot(dx, dz);
    if (D < 1e-6) continue;
    const px = me.x - m.x;
    const pz = me.z - m.z;
    const t = (px * dx + pz * dz) / D;
    if (t <= 0 || t >= D) continue;
    const cr = (px * dz - pz * dx) / D; // 줄에서 떨어진 쪽 (부호)
    const perp = Math.abs(cr);
    if (perp >= TEAM_SUPPORT.laneW) continue;
    // 줄에서 벗어나는 쪽 = 줄의 법선 (dz, −dx) × 부호 → 내 오른쪽 (−fz, fx) 에 비춘 부호
    const nx = (dz / D) * (Math.sign(cr) || 1);
    const nz = (-dx / D) * (Math.sign(cr) || 1);
    if (!best || perp < best.perp) best = { side: Math.sign(nx * -me.fz + nz * me.fx) || 1, perp };
  }
  return best;
}

/** 스틱 (fwd 앞 · side 오른쪽) 을 고쳐 돌려줌 — 독일 · 동방: 동료 칼길 밖 · 돌기 / 이베리아: 칼길 비킴 거둠 */
export function supportFeet(ai, fwd, side) {
  const S = supportOf(ai);
  if (!(S.w > 0) || !ai.foe || !ai.me.teamSense) return [fwd, side];
  const v = viewOf(ai);
  if (!v) return [fwd, side];
  const x = ai.foe.index;
  const X = v.fr.b[x];
  if (!X.live) return [fwd, side];
  if (S.key === 'ib') return ibFeet(ai, v, S.w, fwd, side);
  if (S.key !== 'de' && S.key !== 'cn') return [fwd, side];
  const C = TEAM_SUPPORT[S.key];
  const St = stats(ai);
  // ① 동료 칼길 밖 (간 보기 · 물러남 · 막기 · 공격 준비 · 다가감 — 베는 중 · 밀치는 중은 부르는 쪽이 안 부름)
  const laneMode = ai.mode === 'watch' || ai.mode === 'withdraw' || (S.key === 'de' && (ai.mode === 'defend' || (ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach')))); // 동방은 간 보기 · 물러남만 (2 차 재기: 걸음이 제 칼을 덜 내게 함)
  const LM = laneMode ? inMateLane(v) : null;
  if (LM) {
    side += (LM.side * C.laneK * clamp(1 - LM.perp / TEAM_SUPPORT.laneW, 0.3, 1) - side) * S.w;
    St[S.key === 'de' ? 'deLane' : 'cnLane']++;
    return [fwd, side];
  }
  // ② 돌기 (내 칼끝 + C.near 안에서만 — 멀면 다가감이 먼저)
  if (S.key !== 'de') return [fwd, side]; // 동방은 옆 · 등 돌기 없음 (4 차)
  const modeOk = ai.mode === 'watch' || ai.mode === 'withdraw' || (ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach'));
  if (!modeOk || Math.hypot(X.x - v.me.x, X.z - v.me.z) > v.me.reach + C.near) return [fwd, side];
  const R = v.S.roles?.get(ai.me);
  if (R && R.role === 'pin' && R.x === x && R.until >= v.fr.t) return [fwd, side]; // 6 이 준 묶기 역할: 앞을 지킴 (team_sense.js 와 같음)
  const b = mateOn(v, x);
  if (b < 0 || X.foe !== b || !X.busy) return [fwd, side]; // 그 적이 그 동료와 붙어 있을 때만 (동료가 앞을 잡음 — 나를 겨눈 적 둘레를 돌지 않음)
  const B = v.fr.b[b];
  const th = angAt(X, v.me, B);
  const goal = C.goal * DEG;
  if (th >= goal - C.tol * DEG) return [fwd, side];
  const want = orbitAway(X, v.me, B) * C.k * clamp((goal - th) / (goal / 2), 0.3, 1);
  side += (want - side) * S.w;
  St[S.key === 'de' ? 'deOrbit' : 'cnOrbit']++;
  return [fwd, side];
}

/** 같은 편 비킴 거리 곱 (ai.js teamFeet — 이베리아 1 − (1 − ib.sepX) × w · 다른 몸 1): 동료 곁을 비키지 않고 지나감 */
export function mateSepX(ai) {
  return 1 - (1 - TEAM_SUPPORT.ib.sepX) * wOf(ai, 'ib');
}

/** 칼길 미룸을 건너뛰나 (ai.js atkGate — 이베리아): 동료가 내 칼길 한가운데(줄에서 lane.w × (1 − ib.lane × w) 안)가 아니면 true */
export function laneFree(ai) {
  const w = wOf(ai, 'ib');
  if (!(w > 0) || !ai.foe || !ai.me.teamSense) return false;
  const v = viewOf(ai);
  if (!v) return false;
  const L = laneOf(ai, v);
  if (!L?.fan || L.perp <= TEAM_SENSE.lane.w * (1 - TEAM_SUPPORT.ib.lane * w)) return false;
  stats(ai).ibLaneFree++;
  return true;
}

/**
 * 이베리아 발 (supportFeet — 간 보기 · 물러남): ① 서 있는 동료가 ib.crossR m 안이면 제 원(옆 스틱)의 쪽을 그 동료 쪽으로 — 크기는 제 걸음 그대로 (동료 앞 · 칼길을 지나감)
 *  ② 칼길 비우기 걸음(team_sense.js senseFeet ①)을 ib.lane × w 만큼 거둠
 */
function ibFeet(ai, v, w, fwd, side) {
  const St = stats(ai);
  const L = laneOf(ai, v);
  if (L) {
    side += L.side * TEAM_SENSE.lane.k * clamp(1 - L.perp / TEAM_SENSE.lane.w, 0.3, 1) * TEAM_SUPPORT.ib.lane * w;
    St.ibLaneStep++;
  }
  if (ai.mode !== 'watch' && ai.mode !== 'withdraw') return [fwd, side];
  let best = null;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
    const m = v.fr.b[j];
    if (!m.stand) continue;
    const d = Math.hypot(m.x - v.me.x, m.z - v.me.z);
    if (d <= TEAM_SUPPORT.ib.crossR && (!best || d < best.d)) best = { m, d };
  }
  if (!best || Math.abs(side) < 1e-6) return [fwd, side];
  const lat = (best.m.x - v.me.x) * -v.me.fz + (best.m.z - v.me.z) * v.me.fx; // + = 동료가 내 오른쪽
  const toward = Math.sign(lat || 1) * Math.abs(side);
  if (Math.sign(toward) !== Math.sign(side)) St.ibCross++;
  return [fwd, side + (toward - side) * w];
}

// ───────── 빈틈 · 밀치기 · 이어 치기 (ai.js) ─────────
/** 빈틈 점수 덧셈 (ai.js opportunity 7) — { v, kind } · 없으면 null */
export function supportOpp(ai) {
  const S = supportOf(ai);
  if (!(S.w > 0) || !ai.foe || !ai.me.teamSense || (S.key !== 'de' && S.key !== 'cn')) return null;
  const v = viewOf(ai);
  if (!v) return null;
  const x = ai.foe.index;
  const X = v.fr.b[x];
  if (!X.stand) return null;
  if (S.key === 'de') {
    // 박자: 동료가 X 를 치는 중 (X 에 붙어 공격 꼴)
    for (let j = 0; j < v.fr.b.length; j++) {
      if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
      const m = v.fr.b[j];
      if (m.stand && m.atk && m.foe === x && m.busy) return stats(ai).deFollow++, { v: TEAM_SUPPORT.de.follow * S.w, kind: 'ambush' };
    }
    return null;
  }
  // 동방 기습: X 가 동료와 붙었고 내가 그 앞 밖
  if (!busyWithMate(v, x)) return null;
  const px = v.me.x - X.x;
  const pz = v.me.z - X.z;
  const d = Math.hypot(px, pz);
  if (d < 1e-6 || (px * X.fx + pz * X.fz) / d >= Math.cos(TEAM_SENSE.ambush.front * DEG)) return null;
  stats(ai).cnAmbush++;
  return { v: TEAM_SUPPORT.cn.ambush * S.w, kind: 'ambush' };
}

/**
 * 독일 밀치기 · 묶기 (ai.js closeQuarters — 붙은 거리 안 · 밀치는 중이 아님) → 1 밀기로 정함 · −1 밀지 않음 · 0 그대로(굴림대로) (몸은 사람과 같은 밀치기 · 묶임 규칙 CLOSE.holdMin · holdLock 그대로):
 *  ⓪ 내가 동료 칼길(동료 → 그 상대 선분 laneW m 안)에 서 있으면 −1 — 밀며 들어가면 동료 칼 앞을 막음
 *  ① 내 → X 가 동료 쪽(X 자리에서 본 나 · 동료 사이 각 ≥ de.shove°)이고 X 가 그 동료 칼끝 + de.reach 안 — 동료 칼끝 쪽으로 밂
 *  ② 서 있는 동료가 X 에서 de.pinR m 안 — 붙어 묶음 (묶인 동안 X 는 칼을 못 냄 · 동료가 칠 틈) · 동료가 없으면(혼자) 굴림대로
 */
export function shoveToMate(ai) {
  const w = wOf(ai, 'de');
  if (!(w > 0) || !ai.foe || !ai.me.teamSense) return 0;
  const v = viewOf(ai);
  if (!v) return 0;
  const x = ai.foe.index;
  const X = v.fr.b[x];
  if (!X.stand) return 0;
  if (inMateLane(v)) return stats(ai).deNoShove++, -1; // 동료 칼길 위에서는 밀지 않음 (밀며 들어가면 동료 칼 앞을 막음 — 감독 11/19 답 3)
  const D = TEAM_SUPPORT.de;
  let pin = false;
  let foes = 0;
  for (let j = 0; j < v.fr.b.length; j++) if (j !== v.i && !sameSide(v.S.fighters[j], v.S.fighters[v.i]) && v.fr.b[j].stand) foes++;
  const own = foes >= 2 && !busyWithMate(v, x); // 2:2 의 제 적 (내 동료와 붙지 않음) — 묶어 두어 동료에게 가지 않게
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || !sameSide(v.S.fighters[j], v.S.fighters[v.i])) continue;
    const m = v.fr.b[j];
    if (!m.stand) continue;
    const dm = Math.hypot(X.x - m.x, X.z - m.z);
    if ((m.foe === x || !m.busy) && dm <= m.reach + D.reach && angAt(X, v.me, m) >= D.shove * DEG) return stats(ai).deShove++, 1; // 동료 칼끝 쪽으로 밂
    if (dm <= D.pinR) pin = true; // 묶기: 동료가 곁에 서 있음 — 붙어 묶으면 그 적은 묶인 동안 칼을 못 냄 (CLOSE.holdLock — 사람과 같은 규칙) · 동료가 칠 틈
  }
  let mates = false;
  for (let j = 0; j < v.fr.b.length; j++) if (j !== v.i && sameSide(v.S.fighters[j], v.S.fighters[v.i]) && v.fr.b[j].stand) mates = true;
  if (own && mates) pin = true;
  if (pin) stats(ai).dePin++;
  return pin ? 1 : 0;
}

/** 동방 치고 빠짐 (ai.js afterStrike — 이어 치기 마음): 내 상대가 동료와 붙어 있으면 × (1 − cn.run × w) */
export function supportChain(ai, want) {
  const w = wOf(ai, 'cn');
  if (!(w > 0) || !ai.foe || !ai.me.teamSense) return want;
  const v = viewOf(ai);
  if (!v || !busyWithMate(v, ai.foe.index)) return want;
  stats(ai).cnRun++;
  return want * (1 - TEAM_SUPPORT.cn.run * w);
}
