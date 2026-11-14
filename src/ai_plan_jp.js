// ─────────────────────────────────────────────────────────────
//  유파 AI 2 단계 — 일본 '기다리는 중전차' 플랜 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §3-2 · 기록 §12 · config AI_PLAN_JP)
//
//  일본 몫만 이 파일에 묶는다(동방 · 이베리아 작업자와 공통 틀 파일 충돌을 작게). ai.js 는 플랜이 일본인 몸(ai.planJp)일 때만 아래를 부른다 —
//  다른 유파 · 플랜 없는 몸은 한 줄도 안 탄다(굴림 · 셈 그대로). ai_plan.js 를 들여오지 않는다(고리 없음 — 띠 기울기 · 국면 칸은 ai 에서 읽음).
//  모두 기울기: 몫 = 띠 기울기(ai.planK) × 국면 칸(ai.planC) × AI_PLAN_JP 값 — 확률 · 곱 · 문턱 이동 (사장님 11/14 '절대적 규칙은 빼').
//
//  플랜 칸
//   still  서 있기 — 적게 돎 · 자세를 드물게 바꿈 · 다가가는 몫이 작음 · 맞은 뒤 물러남이 짧음(바위 몸으로 버팀) · 고노센 준비가 켜진 동안 기다림
//   block  피하기 대신 칼로 받기(막기 +2 · 흘려 받기 +3 스택)
//   stack  스택이 적을수록 참고 쌓일수록 먼저 칠 마음 · 쌓일수록 크고 단순한 한 칼(내려베기)
//   link   빗나가거나 막힌 내려벤 칼 → 제비 베기 (스택을 들고 감) · 칼이 맞닿으면 되받아 치기(공통 planBind — 일본 bindDef 패시브)
//   lure   유도(가운데 끝 4 부터) — 준비 자세로 서서 상대를 칼끝 밖에 묶음 (2.6 s 서 있으면 고노센 준비 — 2.0 + 납도 0.6)
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, AI_PLAN_JP as J, JP_TANK } from './config.js';

const P = (o) => Object.freeze(o);
/** 일본 플랜 칸 (국면마다 — 값은 고를 몫 0 ~ 1) */
export const JP_PLAN = Object.freeze({
  nameKo: '기다리는 중전차',
  lureAt: 4,
  probe: P({ still: 1, block: 1, stack: 1, link: 1, lure: 1 }),
  contest: P({ still: 1, block: 1, stack: 1, link: 1, lure: 1 }),
  commit: P({ still: 0, block: 1, stack: 1, link: 1, lure: 0 }),
  ahead: P({ still: 1, block: 1, stack: 1, link: 1, lure: 0 }),
  finish: P({ still: 0, block: 0, stack: 0, link: 1, lure: 0 }),
  behind: P({ still: 1, block: 1, stack: 1, link: 1, lure: 0 }),
  tired: P({ still: 1, block: 1, stack: 1, link: 0, lure: 0 }),
});

const MEM = 6; // 버릇 · 되풀이 기억 칸 (상대 공격 줄 — 가장 최근 MEM 개)

/** ai 생성자 (플랜이 일본일 때 한 번): 기억 칸 · 재기 칸 */
export function jpInit(ai) {
  ai.jpMem = { t: new Float64Array(MEM).fill(-1e9), line: new Array(MEM).fill(null), i: 0 };
  ai.jpPre = null; // 높음 되풀이 — 미리 잡은 흘려 받기 줄 (jpRead — 되풀이 줄이 바뀔 때마다 한 번 굴림)
  ai.jpRep = null; // 지금 되풀이로 읽은 줄
  ai.stats.plan.jp = { tsubame: 0, habit: 0, pre: 0, lure: 0 };
}

/** 지금 스택 몫 0 ~ 1 (스택 판 — 숙련도 4 부터 · JP_TANK.ai) · 아니면 null */
export function jpStackF(ai) {
  const S = ai.me.schoolPassive;
  return S?.stackOn ? S.stk / JP_TANK.max : null;
}

/** 서 있기 세기 0 ~ still (띠 기울기 × 칸) */
export function jpStill(ai) {
  return ai.planK * (ai.planC?.still ?? 0) * J.still;
}

/** 공격 문턱에 얹을 몫 (watch — 헛친 뒤 · 끝내기 같은 큰 틈엔 스택 몫을 안 얹음): 스택 적음 + · 가득 − · 고노센 준비 동안 + */
export function jpNeed(ai, opp) {
  const C = ai.planC;
  if (!C) return 0;
  let n = 0;
  const f = jpStackF(ai);
  if (f != null && opp.kind !== 'recover' && opp.kind !== 'finish') n += ai.planK * (C.stack ?? 0) * J.stackAmp * (1 - 2 * f);
  if (ai.iaiArm?.armed) n += ai.planK * (C.still ?? 0) * J.iaiWait;
  return n;
}

/** 기술 고르기 곱 (pickTech — 굴림 없음): 스택이 쌓일수록 크고 단순한 내려베기(presses) */
export function jpTechK(ai, t) {
  const f = jpStackF(ai);
  return f != null && t.presses ? 1 + ai.planK * (ai.planC?.stack ?? 0) * f : 1;
}

/** 물러나 피하는 몫 (respond): 칼로 받는 쪽으로 */
export function jpVoid(ai, pVoid) {
  return pVoid * (1 - ai.planK * (ai.planC?.block ?? 0) * J.block);
}

/** 상대 공격 줄을 기억 (respond — 새 위협을 처음 판단할 때 · 본 것만) */
export function jpSeeThreat(ai, th) {
  const M = ai.jpMem;
  M.t[M.i] = ai.sense.t;
  M.line[M.i] = th.line;
  M.i = (M.i + 1) % MEM;
}

/** 줄 line 이 지난 win 초 안에 몇 번 왔나 */
function seen(ai, line, win) {
  const M = ai.jpMem;
  let n = 0;
  for (let k = 0; k < MEM; k++) if (M.line[k] === line && ai.sense.t - M.t[k] <= win) n++;
  return n;
}

/** 막을 눈 몫 (respond — 굴림 수 그대로 · 문턱만): 가운데부터 버릇 — 같은 줄이 habitT 안에 이미 왔으면 (1 − 몫) × habitK × 기울기 만큼 올림 */
export function jpGuardChance(ai, th, gc) {
  if (ai.planK < 0.5 || !seen(ai, th.line, J.habitT)) return gc;
  ai.stats.plan.jp.habit++;
  return gc + (1 - gc) * J.habitK * ai.planK;
}

/** 높음 되풀이 — 같은 줄이 repeatT 안에 두 번 이상 온 가장 최근 줄 (없으면 null) */
function repeatLine(ai) {
  if (ai.planK < 1) return null;
  const M = ai.jpMem;
  for (let k = 1; k <= MEM; k++) {
    const j = (M.i - k + MEM) % MEM;
    const line = M.line[j];
    if (line && ai.sense.t - M.t[j] <= J.repeatT && seen(ai, line, J.repeatT) >= 2) return line;
  }
  return null;
}

/**
 * 전략 층 (planTick 의 국면 판정 때 — 0.2 s · 사건): 높음 되풀이 — 같은 줄이 repeatT 안에 두 번이면, 그 줄이 새로 읽힐 때 한 번 pre × 기울기 몫으로
 *  흘려 받기 자리를 미리 잡아 둠(되풀이가 풀리거나 다른 줄이 될 때까지 — 간 보기 손 자리). 굴림은 줄이 바뀔 때만
 */
export function jpRead(ai) {
  const line = repeatLine(ai);
  if (line === ai.jpRep) return;
  ai.jpRep = line;
  ai.jpPre = line && ai.school.parry[line] && Math.random() < J.pre * ai.planK ? line : null;
  if (ai.jpPre) ai.stats.plan.jp.pre++;
}

/** 자세 박자마다 (watch — 자세를 새로 고른 때): 유도(4 부터) — lure × 기울기 몫으로 준비 자세로 서서 lureT(3.0 s) 동안 멈춤(공통 planFeet 'stop' — 고노센 준비 2.6 s 를 넘김). 굴림은 그 조건일 때만 */
export function jpBeat(ai) {
  const C = ai.planC;
  const R = ai.planR;
  if (ai.planLure && C?.lure && !R.mode && Math.random() < ai.planK * C.lure) {
    R.mode = 'stop';
    R.t = AI_PLAN.beat - J.lureT; // 공통 'stop' 은 R.t 가 AI_PLAN.beat 에 닿으면 끝 — 거기서 lureT 만큼 앞에서 시작
    ai.stats.plan.jp.lure++;
  }
}

/**
 * 제비 베기 연계 (afterStrike — 공통 이어 치기 앞): 내려벤 칼(위에서 시작한 베기)이 빗나가거나 막혔으면 link × 기울기 몫으로 제비 베기를 이어 냄 (스택은 school_passive 가 들고 감).
 *  제비 베기가 이 몸의 기술 목록에 없거나 식는 중이면 안 냄. 냈으면 true
 */
export function jpTsubame(ai, canChain) {
  const t0 = ai.tech;
  const C = ai.planC;
  if (!canChain || ai.hitLanded || !C?.link || !t0 || t0.kind !== 'cut' || !(t0.from?.[1] > 0) || t0.name === 'tsubameGaeshi') return false;
  const t = ai.school.techByName.tsubameGaeshi;
  if (!t || ai.techNow(t) !== t) return false;
  if (!(Math.random() < ai.planK * C.link)) return false;
  if (!ai.startAttack(t, 'follow', { chain: ai.chain + 1, noFeint: true })) return false;
  ai.stats.followUps++;
  ai.stats.plan.jp.tsubame++;
  return true;
}
