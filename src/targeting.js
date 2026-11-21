// ─────────────────────────────────────────────────────────────
//  상대 고르기 — 2:2 · 2:1 동시 대전 2단계 (사장님 10/29 14:2x 생사전 · docs/strike/team_fight_2026-10-29.md §8)
//
//  난수 없음 (같은 판 = 같은 고름). 점수 = 가슴 수평 거리(m) + 더함 · 뺌, 낮을수록 고름 (같으면 작은 자리):
//   + downAdd   쓰러진(서 있지 않은) 상대 — 다른 상대가 downNear 안에 서 있으면 (서 있는 상대 먼저)
//   + allyAdd   내 편이 이미 겨눈 상대 하나마다 (나눠 맡기)
//   − attackSub 나를 겨눠 제 칼끝 거리(reach) 안에서 치고 있는 상대
//   + 인물 취향  f.targetPref ('weakest' · 'strongest' · 'allyAttacker' · 'nearest') × prefAdd — 갈고리만 (인물 시트가 아직 안 채움)
//   + 무리 싸움 판단 (11/18 — src/team_sense.js senseScore · 판 사본 M.sense 가 있는 셋 이상 판의 AI 만 · 그 AI 의 눈(늦음 · 시야)으로 본 것만)
//  바꾸는 때: 지금 상대가 죽었거나 부활하는 중이면 곧장 (붙잡고 있어도 — 죽은 몸을 겨눌 까닭이 없다).
//   그 밖엔 다른 상대가 margin 넘게 낮은 채 hold 동안 이어지면. 나를 치고 있는 상대면 hold 를 기다리지 않는다 — 그 상대가 attackHold(실제 초 0.4) 동안 내리 쳤으면 (3단계 10/29 · 2877).
//   붙잡힘(committed — 공격 · 비기 · 칼끼리 맞댐 · 밀치기) 동안은 바꾸지 않는다.
//  사람 몸 (AI 조종이 없는 몸 — 11/21 사장님 '가장 가까운 적을 자동으로 바라본다거나'): 가장 가까운 적 — allyAdd 없음 · margin · hold 짧게 (TEAM_FIGHT.target.human · 쓰러진 적 뒤로 · 나를 치는 적 먼저는 그대로)
//  값: config.js TEAM_FIGHT.target (모두 사장님 확인 전 — 확인표 2864 ~ 2869 · 2877)
// ─────────────────────────────────────────────────────────────
import { TEAM_FIGHT } from './config.js';
import { supportScore } from './team_support.js'; // 서포트 (11/19): 유파마다 동료로서의 겨눔 덧셈 — 판 사본이 있는 판의 AI 만
import { sameSide } from './team.js';
import { woundDegree } from './combat.js';
import { senseScore, senseHold } from './team_sense.js'; // 무리 싸움 판단 (11/18): 판 사본(M.sense)이 있는 판의 AI 만 — 덧셈 · 바꿈 기다림
import { fixHoldK } from './ai_lone.js'; // 결투 고집 (11/19 — 이탈리아 마음가짐 many.fix): 수가 밀리면 바꿈 기다림을 길게

const hdist = (a, b) => {
  const p = a.bodies.chest.translation();
  const q = a.seenPos?.get(b) ?? b.bodies.chest.translation(); // 성벽 안뜰 (11/21): 벽 너머 적은 마지막으로 본 자리 (sightTick)
  // 생사전 전용 맵 (11/21 — src/field.js): 물 · 벽 너머 상대는 길목을 거쳐 걷는 길 길이 (같은 편 쪽 가까운 적 먼저) · 원 무대는 곧은 거리 그대로
  return a.field ? pathDist(a, b, p, q) : Math.hypot(q.x - p.x, q.z - p.z);
};
/** 걷는 길 길이 — 막혔으면 길목 길(셈이 무거워 몸 짝마다 PATH_EVERY 게임 초 동안 그 길 길이에 곧은 거리 바뀜만 더해 씀) */
const PATH_EVERY = 0.1;
function pathDist(a, b, p, q) {
  const F = a.field;
  const d = Math.hypot(q.x - p.x, q.z - p.z);
  if (!F.segBlocked(p, q)) return d;
  const C = (a.pathCache ??= new Map());
  const t = a.fightT ?? 0;
  let c = C.get(b);
  if (!c || t - c.t > PATH_EVERY || t < c.t) C.set(b, (c = { t, extra: F.pathLen(p, q) - d }));
  return d + c.extra;
}
/**
 * 시야 (생사전 성벽 안뜰 — 11/21 사장님 원칙 '가급적 ai와 사람이 같아야 한다'): 사람은 성벽 너머를 못 보니 AI 도 벽 광선에 막힌 적은 마지막으로 본 자리만 안다.
 *  f.seenPos = 적 → 마지막으로 본 가슴 자리 (판 시작 = 그 적의 시작 자리 — 판 시작 훑기로 누구나 본 자리). 보이는 적은 지운다(지금 자리를 그대로 읽음).
 *  안 본 지 SIGHT_FORGET 게임 초가 지나면 지운다 — 발소리 · 칼 소리로 어림 (벽 너머 낡은 자리만 쫓아 판이 멈추지 않게)
 *  시야를 가리는 막이가 없는 판(원 무대 · 두 다리 개울)은 아무 일 없음
 */
export const SIGHT_FORGET = 6;
export function sightTick(f, M) {
  const F = f.field;
  if (!F?.hasSight || !f.alive) return;
  const seen = (f.seenPos ??= new Map());
  const p = f.bodies.chest.translation();
  const now = f.fightT ?? 0;
  for (const g of M.fighters) {
    if (sameSide(g, f)) continue;
    const q = g.bodies.chest.translation();
    const heard = (f.heard ??= new Set());
    if (!F.sightBlocked(p, q)) { seen.delete(g); heard.delete(g); (f.lastSaw ??= new Map()).set(g, { x: q.x, z: q.z, t: now }); continue; } // 보임 — 지금 자리
    if (heard.has(g)) continue; // 오래 안 보임 — 소리로 어림한 지금 자리
    const m = seen.get(g) ?? f.lastSaw?.get(g) ?? { x: q.x, z: q.z, t: 0 }; // 안 보임 — 마지막으로 본 자리 (판 시작 = 시작 자리)
    if (now - m.t > SIGHT_FORGET) { seen.delete(g); heard.add(g); } else seen.set(g, m);
  }
}

/** 겨눌 수 있는 상대: 살아 있고 부활하는 중이 아님 */
export const targetable = (g) => !!g && g.alive && !g.revival;

/** 지금 치고 있나 (AI = 공격 꼴 · 비기 · 사람 = 기력 장부의 공격 · 휘두름 · 탭) */
export function isAttacking(g) {
  const c = g.aiCtl;
  if (c) return c.mode === 'attack' || !!c.secretRun;
  return !!g.stamina?.attacking || !!g.skill?.swinging || !!g.skill?.tap;
}

/** g 의 칼끝 거리 (AI 간격 M.reach · 없으면 검술 풀이의 간격) */
export const reachOf = (g) => g.aiCtl?.M?.reach ?? g.swordArt?.measure?.reach ?? 1.8;

/** g 가 f 를 겨눠 칼끝 거리 안에서 치고 있나 */
export function attacking(g, f) {
  return g.foe === f && targetable(g) && isAttacking(g) && hdist(g, f) <= reachOf(g);
}

/** 붙잡힘: 이 동안은 상대를 바꾸지 않는다 (공격 · 비기 · 칼끼리 맞댐 · 밀치기 — 쓰러진 상대 마무리는 AI 공격 꼴 · 사람 휘두름으로 들어간다) */
export function committed(f) {
  if (f.barge || f.skill?.sec || f.feel?.touching) return true;
  const c = f.aiCtl;
  if (c) return c.mode === 'attack' || c.mode === 'secret' || !!c.secretRun || !!c.bound;
  return !!f.stamina?.attacking || !!f.skill?.swinging || !!f.skill?.tap;
}

/** 인물 취향 덧셈 (m — 낮을수록 고름). 이름이 없거나 모르면 0 */
export const TARGET_PREFS = {
  nearest: () => 0,
  weakest: (M, f, g) => -TEAM_FIGHT.target.prefAdd * woundDegree(g), // 많이 다친 상대 먼저
  strongest: (M, f, g) => -TEAM_FIGHT.target.prefAdd * (1 - woundDegree(g)), // 덜 다친 상대 먼저
  allyAttacker: (M, f, g) => (M.fighters.some((m) => m !== f && sameSide(m, f) && m.alive && g.foe === m) ? -TEAM_FIGHT.target.prefAdd : 0), // 내 편을 겨눈 상대 먼저
};

/** 사람 몸 값 (AI 조종이 없는 몸 — 11/21 · TEAM_FIGHT.target.human) 또는 null */
const humanT = (f) => (f.aiCtl ? null : TEAM_FIGHT.target.human ?? null);

/** f 가 g 를 겨눌 점수 (m, 낮을수록 고름) — 읽기만 */
export function targetScore(M, f, g) {
  const T = TEAM_FIGHT.target;
  const allyAdd = humanT(f)?.allyAdd ?? T.allyAdd;
  let s = hdist(f, g);
  if (g.state !== 'stand') {
    for (const h of M.fighters) if (h !== g && !sameSide(h, f) && targetable(h) && h.state === 'stand' && hdist(f, h) <= T.downNear) { s += T.downAdd; break; }
  }
  if (allyAdd) for (const m of M.fighters) if (m !== f && sameSide(m, f) && m.alive && m.foe === g) s += allyAdd;
  if (attacking(g, f)) s -= T.attackSub;
  const pref = f.targetPref && TARGET_PREFS[f.targetPref];
  if (pref) s += pref(M, f, g);
  if (M.sense) s += senseScore(M, f, g) + supportScore(M, f, g); // 무리 싸움 판단 (11/18 — team_sense.js · 셋 이상 판의 AI 만): 다친 동료를 겨눈 적 … · 서포트 (11/19 — team_support.js): 동방 동료를 치는 적
  return s;
}

/**
 * 상대 고르기 (src/match.js stepMatch 의 foeOf 자리 — createMatch 가 셋 이상 판에 건다). 판(M)마다 싸움꾼별 상태 M.targeting(Map):
 *  { foe(지금 상대), cand(바꿀 후보), held(후보가 이어진 시간 s), switches(바꾼 수), log? }
 */
export function chooseTarget(f, M, dt = 0) {
  const T = TEAM_FIGHT.target;
  const S = M.targeting ?? (M.targeting = new Map());
  let st = S.get(f);
  if (!st) S.set(f, (st = { foe: null, cand: null, held: 0, switches: 0, why: { gone: 0, attacked: 0, held: 0 }, atk: new Map() }));
  if (!f.alive) return st.foe ?? f.foe ?? null;
  sightTick(f, M); // 성벽 안뜰: 벽 너머 적은 마지막으로 본 자리로 (11/21 — 시야를 가리는 막이가 없는 판은 아무 일 없음)
  if (T.attackHold > 0) for (const g of M.fighters) if (!sameSide(g, f)) { if (attacking(g, f)) st.atk.set(g, (st.atk.get(g) ?? 0) + dt); else st.atk.delete(g); } // '나를 침'이 이어진 시간 (멈추면 0 부터)
  let best = null;
  let bs = Infinity;
  let cur = Infinity;
  for (const g of M.fighters) {
    if (sameSide(g, f) || !targetable(g)) continue;
    const s = targetScore(M, f, g);
    if (g === st.foe) cur = s;
    if (s < bs) (bs = s), (best = g); // 같으면 먼저 본(작은) 자리
  }
  if (!best) return st.foe ?? f.foe ?? null; // 겨눌 상대가 없다 (판 끝) — 지금 상대 그대로
  const H = humanT(f);
  const margin = H?.margin ?? T.margin;
  const take = (g, why) => {
    if (st.foe && st.foe !== g) (st.switches++), st.why[why]++;
    st.foe = g;
    st.cand = null;
    st.held = 0;
  };
  if (!targetable(st.foe)) take(best, 'gone'); // 처음 · 죽음 · 부활 — 곧장
  else if (best !== st.foe) {
    if (committed(f) || cur - bs < margin) {
      st.cand = null;
      st.held = 0;
    } else {
      if (st.cand !== best) (st.cand = best), (st.held = 0);
      st.held += dt;
      const fk = M.sense ? fixHoldK(f) : 1; // 결투 고집 (11/19 — ai_lone.js · 이탈리아): 수가 밀려도 겨눈 상대를 붙듦 — 바꿈 기다림 × (1 + fix × w)
      if (attacking(best, f) && (T.attackHold <= 0 || (st.atk.get(best) ?? 0) >= T.attackHold * fk)) take(best, 'attacked'); // 나를 치는 상대는 hold 를 기다리지 않는다 (attackHold 만큼 내리 쳤으면)
      else if (st.held >= ((M.sense && senseHold(M, f, best)) ?? H?.hold ?? T.hold) * fk) take(best, 'held'); // 무리 싸움 판단 (11/18): 엄호 바꿈은 짧게 기다림 (TEAM_SENSE.cover.hold)
    }
  } else (st.cand = null), (st.held = 0);
  return st.foe;
}
