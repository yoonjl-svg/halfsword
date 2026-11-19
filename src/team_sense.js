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
//   끼어듦 (§3-6)         겨눈 상대가 넘어지거나 무릎 꿇은 동료를 겨누면 그 상대를 축으로 동료 쪽으로 돌아 사이에 섬 (cover.k × k — 피만 준 동료는 겨눔 바꿈만)
//   기습 자리 (§3-4)      겨눈 상대가 남과 붙은 동안 그 칼끝 밖이 아니라 내 칼끝 + ambush.near 에 섬 (ai.js holdDist)
//  모든 층 (P3 — 멈춘 판의 까닭 · 11/18 재기):
//   사냥할 때 (huntFree)  겨눈 상대가 남과 붙었고 나를 붙잡은 적 없음 → 상대가 들어오기를 기다리는 꼴(고노센 준비 · 싱지르 · 리솔루토 · 이베리아 무장 기다림)을 안 기다림 (ai.tsFree) ·
//                          고노센 준비를 쌓는 제자리(스틱 0)에는 이 파일의 발을 얹지 않음 (걸음 뜻이 준비를 0 으로 되돌려 영영 못 들어가던 판)
//  행동 (P3 위 6 만 — 5 에는 없는 판 읽기 · 사장님 11/18 1 · 3 · 7):
//   눈                    사방(360°) · 늦음 0.2 s · 내다봄 ahead — 피 흐름(지난 장들의 기울기)으로 ahead 뒤 피를 어림
//   엄호 미리 (§3-6)      동료 피가 ahead 뒤 cover.blood 밑으로 갈 것이면 넘어지기 전에 그 적을 겨눔
//   2:2 → 2:1 (§3-7)     내 동료와 붙은 적은 옆 · 등을 안 보여도 − opp.side · 동료가 지고 있으면(어림 피가 그 적보다 two.margin 넘게 낮음 · 서 있지 않음) − two.sub 더
//   칼 내는 순간 (§3-4)   겨눈 상대가 동료와 붙었고 내가 그 앞 밖: 그 상대가 동료에게 칼을 낼 때 · 이미 내 칼끝 + shot.near 안이면 + ambush.top · 아니면 ambush.wait 까지는
//                          빈틈 점수 − ambush.hold(기다림) · 지나면 가운데처럼
//   틈 베기 (§3-4 · §3-7) 남과 붙어 내게 옆 · 등을 보인 적이 내 칼끝 + shot.near 안이고 지금 상대가 나를 치는 중이 아니면 붙잡혀 있어도 − shot.sub · shot.hold 만에 바꿈
//   방패 (§3-5)           내 동료와 붙지 않은 적 둘 — 앞 적(지금 상대) 뒤에 다른 적이 한 줄(나에게서 shield.angle° 안 · 더 멂)이면 앞 적을 몰아침(빈틈 점수 + shield.add 'press')
//   이끌기 (§3-8)         물러날 때 비어 있는 동료(붙은 적 없음 · lure.range 안) 쪽으로 기울여 상대가 그 동료 칼끝 앞을 지나가게
//   역할 (사장님 11/18 3)  6 이 같은 편 AI 동료에게: 묶기(그 동료가 붙은 내 상대를 놓지 않음 · 그 동료는 집게로 돌지 않음 — 내가 등으로 돎) ·
//                          이어 치기(나를 붙잡은 상대를 비어 있는 동료가 겨눔). 동료는 제 층 그대로 실행 · 사람 동료에게는 없음 · 화면 신호 없음
//   등 뒤 알림 (사장님 11/18 7)  backThreat — 사람 몸을 겨눈 AI 가 등 뒤(± back.deg° 밖)에서 칼끝 + engage 안에서 공격 꼴이면 참 (main.js → team_hud.js 화면 밖 화살표가 붉게 깜빡)
// ─────────────────────────────────────────────────────────────
import { TEAM_SENSE, TEAM_FIGHT } from './config.js';
import { sameSide } from './team.js';
import { woundDegree } from './combat.js';
import { manyMul, manyHuntOff } from './ai_mindset.js'; // 결투 고집 (11/19 — 이탈리아 마음가짐 many.ally · many.hunt): 동료가 있을 때 동료를 위한 몫을 거둠 (ai_mindset.js 는 이 파일을 읽지 않음)

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
  return { frames: [], next: 0, keep: Math.max(keep, E.top.ahead / 2 + TEAM_SENSE.frame), fighters: M.fighters, roles: new Map(), roleN: { pin: 0, follow: 0 } };
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
  assignRoles(M);
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

/** 내다봄 (6): j 의 ahead 뒤 피 어림 = 지금 피 + 지난 ahead/2 동안의 기울기 × ahead (늘지는 않음) */
export function bloodAhead(S, fr, j, ahead) {
  const old = frameAt(S, (S.frames.at(-1).t - fr.t) + ahead / 2);
  const now = fr.b[j].blood;
  if (!old || old === fr || fr.t - old.t < 1e-6) return now;
  const slope = (now - old.b[j].blood) / (fr.t - old.t);
  return now + Math.min(0, slope) * ahead;
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

/** 다친 동료(넘어짐 · 무릎 · 피 cover.blood 밑 — 6 은 내다본 피)를 겨눈 적인가 — 그 장에서 (ahead 0 = 지금 피) */
function coverFoe(S, fr, i, j, ahead = 0) {
  const r = fr.b[j];
  if (!r.live || r.foe < 0 || r.foe === i || !sameAt(S, i, r.foe)) return false;
  const m = fr.b[r.foe];
  return m.live && (!m.stand || (ahead > 0 ? bloodAhead(S, fr, r.foe, ahead) : m.blood) < TEAM_SENSE.cover.blood);
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
  const top = v.T.tier === 'top';
  const ahead = top ? v.T.eye.ahead : 0;
  if (coverFoe(S, v.fr, f.index, g.index, ahead)) s -= TEAM_SENSE.cover.sub;
  const k = v.T.k;
  const shot = top && g !== ai.foe && freeShot(S, v.fr, v.i, g.index, ai.foe?.index ?? -1); // 6: 틈 베기 — 붙잡혀 있어도
  if (shot) s -= TEAM_SENSE.shot.sub;
  if (k > 0 && (g === ai.foe || shot || !pinnedBy(v.fr, v.i, ai.foe?.index ?? -1))) {
    const r = v.fr.b[g.index];
    const busy = busyWithOther(S, v.fr, v.i, g.index);
    if (busy && (top || outsideFront(v.fr, g.index, v.i, TEAM_SENSE.ambush.front))) s -= O.side * k; // 6: 옆 · 등을 안 보여도 (등으로 돌아 침 — 집게 θ* 위)
    if (busy && top && losing(S, v.fr, r.foe, g.index, ahead)) s -= TEAM_SENSE.two.sub; // 6: 지고 있는 동료의 적 먼저 (2:2 → 2:1)
    s -= O.wound * r.wound * k;
    if (r.tired) s -= O.tired * k;
    if (r.blood < O.focus) for (const m of M.fighters) if (m !== f && sameSide(m, f) && m.alive && m.foe === g) s -= TEAM_FIGHT.target.allyAdd * k; // 몰아침 (§3-7): 나눠 맡기 덧셈을 거둠
  }
  const R = S.roles.get(f);
  if (R && R.x === g.index && R.until >= v.fr.t) s -= R.role === 'pin' ? TEAM_SENSE.role.pin : TEAM_SENSE.role.follow; // 6 이 준 역할 (사장님 11/18 3 — 받는 쪽 층 그대로)
  return s * manyMul(ai, 'ally'); // 결투 고집 (11/19 — 이탈리아 many.ally): 엄호 · 노릴 상대 · 역할을 거둠 (동료를 치는 적으로 바꾸지 않음 · 숙련 곡선만큼)
}

/**
 * 6 의 틈 베기 (§3-4 · §3-7 — 2:2 를 2:1 로): 적 j 가 남과 붙어 내게 옆 · 등을 보이고 내 칼끝 + shot.near 안 · 지금 상대 cur 가 나를 치는 중이 아님 —
 *  붙잡혀 있어도(지금 상대가 나를 겨눠 붙음) 그 적으로 잠깐 돌아 침 (shot.hold 만에 바꿈 · 지금 상대가 치러 오면 '나를 침' 바꿈이 되돌림)
 */
function freeShot(S, fr, i, j, cur) {
  const r = fr.b[j];
  const me = fr.b[i];
  if (!r.stand || !busyWithOther(S, fr, i, j) || !outsideFront(fr, j, i, TEAM_SENSE.ambush.front)) return false;
  if (Math.hypot(r.x - me.x, r.z - me.z) > me.reach + TEAM_SENSE.shot.near) return false;
  return cur < 0 || !fr.b[cur].atk;
}

/** 동료 m 이 적 g 에게 지고 있나 (6 의 내다봄): 서 있지 않음 · 어림 피가 그 적보다 two.margin 넘게 낮음 */
function losing(S, fr, m, g, ahead) {
  const a = fr.b[m];
  if (!a.stand) return true;
  return bloodAhead(S, fr, m, ahead) < bloodAhead(S, fr, g, ahead) - TEAM_SENSE.two.margin;
}

/** 바꿈 기다림 (chooseTarget): 엄호 바꿈이면 cover.hold — 아니면 null (예전 hold 그대로) */
export function senseHold(M, f, g) {
  const ai = f.aiCtl;
  if (!ai || !f.teamSense) return null;
  const v = viewOf(ai);
  if (!v || !v.sees(g.index)) return null;
  if (v.T.tier === 'top' && g !== ai.foe && freeShot(M.sense, v.fr, v.i, g.index, ai.foe?.index ?? -1)) return TEAM_SENSE.shot.hold; // 6 틈 베기
  return coverFoe(M.sense, v.fr, f.index, g.index, v.T.tier === 'top' ? v.T.eye.ahead : 0) ? TEAM_SENSE.cover.hold : null;
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
  return { laneHold: 0, laneStep: 0, pincer: 0, interpose: 0, ambush: 0, ambushWait: 0, ambushStrike: 0, shield: 0, lure: 0 };
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
  const A = TEAM_SENSE.ambush;
  const j = ai.foe.index;
  const now = ai.sense?.t ?? 0;
  const dk = manyMul(ai, 'ally'); // 결투 고집 (11/19 — 이탈리아 many.ally): 동료와 붙은 적의 틈을 노리지 않음 (제 상대와의 거리 싸움만)
  if (dk <= 0 || !busyWithOther(S, v.fr, v.i, j) || !outsideFront(v.fr, j, v.i, A.front)) {
    ai.tsAmbT = null;
    return null;
  }
  if (v.T.tier !== 'top') return { v: A.mid * v.T.k * dk, kind: 'ambush' };
  // 6: 칼 내는 순간 — 그 적이 동료에게 칼을 내면 + top · 아니면 wait 까지 기다림(− hold) · 지나면 가운데처럼
  const St = (ai.stats.team ??= teamStats());
  ai.tsAmbT ??= now;
  const X = v.fr.b[j];
  if (X.atk || Math.hypot(X.x - v.me.x, X.z - v.me.z) <= v.me.reach + TEAM_SENSE.shot.near) return St.ambushStrike++, { v: A.top * dk, kind: 'ambush' }; // 칼을 내는 순간 · 이미 내 칼끝 안(틈 베기)이면 곧장
  if (now - ai.tsAmbT < A.wait) return St.ambushWait++, { v: 0, hold: A.hold * dk };
  return { v: A.mid * dk, kind: 'ambush' };
}

/**
 * 방패 (6 — §3-5): 내 동료와 붙지 않은 적 둘 이상 · 지금 상대 X 뒤로 다른 적 Y 가 한 줄(나에게서 shield.angle° 안 · 더 멂)이면 { v: shield.add, kind: 'press' } — 앞 적을 몰아쳐 겹치게
 */
export function shieldOpp(ai) {
  const v = viewOf(ai);
  if (!v || !ai.foe || v.T.tier !== 'top') return null;
  const S = ai.me.teamSense;
  const X = v.fr.b[ai.foe.index];
  if (!X.stand) return null;
  const dX = Math.hypot(X.x - v.me.x, X.z - v.me.z);
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || j === ai.foe.index || sameAt(S, v.i, j)) continue;
    const Y = v.fr.b[j];
    if (!Y.stand || busyWithOther(S, v.fr, v.i, j)) continue;
    const dY = Math.hypot(Y.x - v.me.x, Y.z - v.me.z);
    if (dY <= dX || dY > TEAM_SENSE.shield.range) continue;
    if (angAt(v.me, X, Y) <= TEAM_SENSE.shield.angle * DEG) {
      (ai.stats.team ??= teamStats()).shield++;
      return { v: TEAM_SENSE.shield.add, kind: 'press' };
    }
  }
  return null;
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
  if (ai.iaiArm && !ai.iaiArm.armed && !ai.chasing && ai.mode === 'watch') return [fwd, side]; // 고노센 준비를 쌓는 중(제자리 — ai.js moveFeet 스틱 0): 걸음 뜻이 준비를 0 으로 되돌려 영영 못 들어가지 않게 (11/18 재기 — 멈춘 판의 까닭)
  const S = ai.me.teamSense;
  const St = (ai.stats.team ??= teamStats());
  const dk = manyMul(ai, 'ally'); // 결투 고집 (11/19 — 이탈리아 many.ally): 끼어듦 · 이끌기 · 집게를 거둠 · 구하러 가지 않음 (칼길 비우기는 그대로)
  // ① 칼길 비우기: 나 → 상대 줄에 선 동료에게서 옆으로 (가까울수록 세게)
  const L = laneMate(ai, v);
  if (L) {
    side -= L.side * TEAM_SENSE.lane.k * clamp(1 - L.perp / TEAM_SENSE.lane.w, 0.3, 1);
    St.laneStep++;
  }
  // ② 끼어듦 (가운데 · 위 — §3-6): 겨눈 상대 X 가 다친 동료 D 를 겨누면 X 를 축으로 D 쪽으로 돌아 X 와 D 사이에 섬
  const X = v.fr.b[ai.foe.index];
  if (X.live && !L && v.T.k > 0 && (ai.mode === 'watch' || ai.mode === 'withdraw') && coverFoe(S, v.fr, v.i, ai.foe.index) && !v.fr.b[X.foe].stand) {
    const D = v.fr.b[X.foe]; // 넘어지거나 무릎 꿇은 동료만 (피가 줄었을 뿐 서 있는 동료 앞으로 들어가면 옆 · 등 자리를 버림 — 겨눔 바꿈만)
    const th = angAt(X, v.me, D);
    if (th > TEAM_SENSE.pincer.tol * DEG) {
      side += orbit(X, v.me, D, -1) * TEAM_SENSE.cover.k * v.T.k * clamp(th / (Math.PI / 2), 0.3, 1) * dk;
      St.interpose++;
    }
    return [fwd, side];
  }
  // ③ 이끌기 (6 — §3-8): 물러나는 동안 비어 있는 동료 쪽으로 기울임 (상대가 그 동료 칼끝 앞을 지나가게)
  if (v.T.tier === 'top' && X.live && fwd < 0 && (ai.mode === 'withdraw' || ai.mode === 'watch')) {
    let B = null;
    let bd = TEAM_SENSE.lure.range;
    for (let j = 0; j < v.fr.b.length; j++) {
      if (j === v.i || !sameAt(S, v.i, j)) continue;
      const m = v.fr.b[j];
      if (!m.stand || m.busy || v.fr.b.some((g, q) => q !== j && g.live && g.foe === j && g.busy)) continue; // 비어 있는 동료: 붙은 적 없음 · 저를 붙잡은 적 없음 (11/18 재기: 붙은 동료 쪽으로도 끌면 2:1 의 둘이 서로에게 물러나 판이 멈춤 — 비어 있는 동료만)
      const d = Math.hypot(m.x - v.me.x, m.z - v.me.z);
      if (d < bd) (bd = d), (B = m);
    }
    if (B) {
      const lat = (B.x - v.me.x) * -v.me.fz + (B.z - v.me.z) * v.me.fx; // + = 동료가 내 오른쪽
      side += Math.sign(lat || 1) * TEAM_SENSE.lure.k * -fwd * dk;
      St.lure++;
    }
  }
  // ④ 협공 자리: 내 상대 X 에 붙은(또는 겨눈) 동료 B — X 자리에서 본 B · 나 사이 각이 목표보다 작으면 X 를 축으로 B 에게서 멀어지는 쪽으로 돎 (6 이 준 묶기 역할을 받은 몸은 돌지 않음 — 앞을 지킴)
  const R = S.roles.get(ai.me);
  const pinned = R && R.role === 'pin' && R.x === ai.foe.index && R.until >= v.fr.t;
  if (X.live && !L && !pinned && (ai.mode === 'watch' || ai.mode === 'withdraw')) {
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
        const o = orbit(X, v.me, B, 1) * (v.T.tier === 'top' ? TEAM_SENSE.pincer.kTop : TEAM_SENSE.pincer.k) * clamp((goal - th) / (goal / 2), 0.3, 1); // 간 보기 옆 돌기 대신
        side = dk >= 1 ? o : side + (o - side) * dk; // 결투 고집 (이탈리아 many.ally)은 dk 만큼만
        St.pincer++;
      }
    }
  }
  return [fwd, side];
}

/** 열세 몫 (숙련도 레버의 sk 를 갈음 — ai.js teamFeet): out.base + (1 − out.base) × 층 몫 k — 숙련 0 ~ 2 = base · 5 · 6 = 1 */
export function outSkill(ai) {
  const T = tierOf(ai);
  return TEAM_SENSE.out.base + (1 - TEAM_SENSE.out.base) * T.k;
}

/**
 * 사냥할 때인가 (ai.js updateCombat — 셋 이상 판의 AI 매 스텝 · ai.tsFree): 겨눈 상대가 나 아닌 서 있는 몸과 붙었고(제 눈으로 본 장) 나를 붙잡은 적이 없음 —
 *  이때는 상대가 들어오기를 기다리는 꼴(고노센 준비 · 싱지르 · 리솔루토 · 이베리아 무장 기다림)을 기다리지 않는다 (상대는 나를 치러 오지 않는다 — 11/18 재기의 멈춘 판)
 */
export function huntFree(ai) {
  if (manyHuntOff(ai)) return false; // 결투 고집 (11/19 — 이탈리아 many.hunt): 겨눈 상대가 동료와 붙어도 제 간격에서 상대를 기다리는 꼴 그대로
  const v = viewOf(ai);
  if (!v || !ai.foe) return false;
  const S = ai.me.teamSense;
  if (!busyWithOther(S, v.fr, v.i, ai.foe.index)) return false;
  for (let q = 0; q < v.fr.b.length; q++) if (q !== v.i && !sameAt(S, v.i, q) && v.sees(q) && pinnedBy(v.fr, v.i, q)) return false;
  return true;
}

/** 기습 자리 (ai.js holdDist — ai.tsFree 일 때): 가운데 · 위는 겨눈 상대의 칼끝 밖이 아니라 내 칼끝 + ambush.near 까지 다가가 섬 (§3-4 '닿는 거리 + 0.3 m 까지') · 바탕은 그대로 */
export function ambushHold(ai, h) {
  return tierOf(ai).k > 0 ? Math.min(h, (ai.M?.reach ?? h) + TEAM_SENSE.ambush.near) : h;
}

/** 열세 셈에서 뺄 적인가 (ai.js teamFeet 둘러싸임 · 줄 세우기): 내 눈에 보이고 나 아닌 몸(두 편 판 = 내 동료)과 붙어 있으면 true — 내 둘레의 수가 아님 */
export function busyFoe(ai, g) {
  const v = viewOf(ai);
  if (!v || !v.sees(g.index)) return false;
  return busyWithOther(ai.me.teamSense, v.fr, v.i, g.index);
}

// ───────────────────────── 역할 (6 → 같은 편 AI 동료 — 사장님 11/18 3) ─────────────────────────

/**
 * 장마다 (recordSense 끝): 서 있는 6 AI 마다 제 눈(늦은 장 · 사방)으로 —
 *  묶기: 같은 편 AI 동료 B 가 내 상대 X 와 붙어 있으면 B 에게 'pin'(X) — B 는 X 를 놓지 않고 앞을 지킴 (나는 X 의 등으로 돎)
 *  이어 치기: 내 상대 X 가 나를 붙잡았고 비어 있는 같은 편 AI 동료 B 가 있으면 B 에게 'follow'(X) — B 가 X 를 겨눔
 *  역할은 role.ttl 동안 (다시 주면 늘어남) · 사람 몸에게는 안 줌 · 받는 쪽은 제 층 그대로 실행 · 역할을 받아 든 6 은 주지 않음(지휘는 하나)
 */
export function assignRoles(M) {
  const S = M.sense;
  const T = TEAM_SENSE.role;
  for (const f of M.fighters) {
    const ai = f.aiCtl;
    if (!ai || !f.alive || f.state !== 'stand' || tierOf(ai).tier !== 'top' || !f.foe) continue;
    const fr = frameAt(S, tierOf(ai).eye.lag);
    if (!fr) continue;
    const i = f.index;
    const x = f.foe.index;
    if (!fr.b[x].live) continue;
    const mine = S.roles.get(f);
    if (mine && mine.until >= M.t) continue; // 다른 6 에게서 역할을 받은 6 은 이번엔 주지 않음 (둘이 서로 묶기를 주고 아무도 등으로 돌지 않는 일이 없게 — 자리 차례가 앞인 6 이 지휘)
    const pinMe = pinnedBy(fr, i, x);
    for (const B of M.fighters) {
      if (B === f || !B.aiCtl || !sameSide(B, f) || !B.alive || B.state !== 'stand') continue;
      const b = fr.b[B.index];
      let role = null;
      if (!pinMe && b.foe === x && b.busy) role = 'pin';
      else if (pinMe && !b.busy && !fr.b.some((g, q) => g.live && g.foe === B.index && g.busy && !sameAt(S, q, B.index))) role = 'follow';
      if (!role) continue;
      const cur = S.roles.get(B);
      if (!cur || cur.role !== role || cur.x !== x || cur.until < fr.t) S.roleN[role]++;
      S.roles.set(B, { role, x, by: i, until: M.t + T.ttl });
    }
  }
}

// ───────────────────────── 등 뒤 알림 (사람 몸 — 사장님 11/18 7 · main.js → team_hud.js) ─────────────────────────

/** 사람 몸 H 를 등 뒤에서 치려는 AI g 인가: g 가 H 를 겨눔 · 공격 꼴 · 칼끝 + engage 안 · H 의 바라보는 쪽에서 back.deg° 넘게 뒤 (지금 모습 — 화면 알림이라 늦음 없음) */
export function backThreat(H, g) {
  if (!H?.teamSense || !g?.aiCtl || g.foe !== H || !g.alive || g.revival || !H.alive) return false;
  if (g.aiCtl.mode !== 'attack') return false;
  const p = H.bodies.chest.translation();
  const q = g.bodies.chest.translation();
  const x = q.x - p.x;
  const z = q.z - p.z;
  const d = Math.hypot(x, z);
  if (d > reachOf(g) + TEAM_SENSE.engage || d < 1e-6) return false;
  return (x * Math.cos(H.heading) + z * -Math.sin(H.heading)) / d < Math.cos(TEAM_SENSE.back.deg * DEG);
}
