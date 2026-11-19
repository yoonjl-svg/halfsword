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
//   lure   유도(가운데 끝 4 부터) — 고노센 준비 결심 (11/19 — 쓸 까닭 × 안전한 틈일 때만 서서 준비 2.6 s = 2.0 + 납도 0.6 · 아래 jpBeat · 전엔 늘 서서 쌓고 3 s 멈춤을 굴림)
//  11/19 고노센 쓰임 (사장님 11/19 '쓰기로 판단했을 때 준비하고 가급적 정확히 노려 발동되도록' — 기록 docs/strike/gonosen_ai_2026-11-19.md):
//   결심(jpBeat · jpGnsPrep) · 칼집에 든 준비는 미리 줄 닫기 · 맞받아 치기 · 뽑아 치기(상대가 한 걸음에 닿는 거리)를 하지 않고(jpGnsSeat · jpGnsDrawHold) ·
//   칼이 오면 뽑아 받는 대신 물러나 헛치게(jpGnsVoid · jpGnsVoidFeet — 물러남은 준비 유지 · 헛친 칼은 비기 셈이 냄) · 먼 위협 무시는 걸어 드는 몫을 뺌(jpGnsIgnore)
//  11/16 끝없는 고노센 · 뽑기 (사장님 11/16 '0.6으로 하고 기력 소모 50으로.' — AI_PLAN_JP.drawRead · 아래 jpArmRead · jpLureOk):
//   칼집에 든 채 다른 칼은 뽑기 SECRET.gnsDraw(0.6 s)가 듦을 알고, 본 것(상대 칼끝 어림 · 거리 · 다가오는 빠르기 · 내 기력)으로 납도를 시작할지 · 칼집에서 먼저 뽑을지 · 유도할지 고름
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, AI_PLAN_JP as J, JP_TANK, SECRET, STAMINA, GAIT, realS } from './config.js';
import { readNote, readLineN, readRepeatLine, readRaiseD } from './ai_read.js'; // 3 단계 (11/14): 버릇 · 되풀이 기억은 공통 읽기 그릇 하나로 · 상대가 칼을 드는 거리
import { gnsEnterLine } from './secret.js';
import { iaiSeated, drawStart } from './iai_obi.js'; // 11/16 뽑기 (SECRET.gnsDraw)

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

/** ai 생성자 (플랜이 일본일 때 한 번): 재기 칸 (버릇 · 되풀이 기억은 3 단계부터 공통 읽기 그릇 ai.read — src/ai_read.js) */
export function jpInit(ai) {
  ai.jpPre = null; // 높음 되풀이 — 미리 잡은 흘려 받기 줄 (jpRead — 되풀이 줄이 바뀔 때마다 한 번 굴림)
  ai.jpRep = null; // 지금 되풀이로 읽은 줄
  ai.jpGns = { was: false, keep: false, invite: false, line: 0, hold: null, meet: 0, ignId: -1, ignNow: false, struck: false, prep: false, quietT: 0 }; // 고노센 준비를 지키며 꾐 · 기다림 · 맞으러 나감 (3 단계 — jpGnsFeet · jpGnsHold) · prep 준비 결심 (11/19 — jpBeat · jpGnsPrep)
  ai.stats.plan.jp = { tsubame: 0, habit: 0, pre: 0, lure: 0, keep: 0, invite: 0, inviteT: 0, hold: 0, meet: 0, ignore: 0 };
}

/** 지금 스택 몫 0 ~ 1 (스택 판 — 숙련도 4 부터 · JP_TANK.ai) · 아니면 null */
export function jpStackF(ai) {
  const S = ai.me.schoolPassive;
  return S?.stackOn ? S.stk / JP_TANK.max : null;
}

/** 서 있기 세기 0 ~ still (띠 기울기 × 칸) */
export function jpStill(ai) {
  if (ai.manyGo > 0) return 0; // 다적의 자리 (11/19 — src/ai_lone.js): 수가 밀리면 멈춰 서지 않음
  return ai.planK * (ai.planC?.still ?? 0) * J.still;
}

/** 공격 문턱에 얹을 몫 (watch — 헛친 뒤 · 끝내기 같은 큰 틈엔 스택 몫을 안 얹음): 스택 적음 + · 가득 − · 고노센 준비 동안 + */
export function jpNeed(ai, opp) {
  const C = ai.planC;
  if (!C) return 0;
  let n = 0;
  const f = jpStackF(ai);
  if (f != null && opp.kind !== 'recover' && opp.kind !== 'finish') n += ai.planK * (C.stack ?? 0) * J.stackAmp * (1 - 2 * f);
  if (ai.iaiArm?.armed && !ai.tsFree) n += ai.planK * (C.still ?? 0) * J.iaiWait * (ai.d > gnsEnterLine(ai.M) ? 2 : 1); // 3 단계: 상대가 아직 내 발도 선 밖이면 두 배 — 준비를 지키며 기다림 (먼저 쳐서 풀지 않게) · 무리 싸움(11/18 ai.tsFree — 셋 이상 판만: 겨눈 상대가 남과 붙음)엔 안 기다림
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

/** 상대 공격 줄을 기억 (respond — 새 위협을 처음 판단할 때 · 본 것만) — 3 단계부터 공통 읽기 그릇에 (같은 위협 번호는 한 번) */
export function jpSeeThreat(ai, th) {
  readNote(ai, th);
}

/** 막을 눈 몫 (respond — 굴림 수 그대로 · 문턱만): 가운데부터 버릇 — 같은 줄이 habitT 안에 이미 왔으면 (1 − 몫) × habitK × 기울기 만큼 올림 (지금 칼은 안 셈) */
export function jpGuardChance(ai, th, gc) {
  if (ai.planK < 0.5 || !readLineN(ai, th.line, J.habitT, th.id)) return gc;
  ai.stats.plan.jp.habit++;
  return gc + (1 - gc) * J.habitK * ai.planK;
}

/** 높음 되풀이 — 같은 줄이 repeatT 안에 두 번 이상 온 가장 최근 줄 (없으면 null · 공통 읽기 그릇) */
function repeatLine(ai) {
  return ai.planK < 1 ? null : readRepeatLine(ai, J.repeatT);
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

/**
 * 고노센 준비 결심 (유도 — 4 부터 · 11/19 — 사장님 11/19 '시작하면 무조건 고노센 웅크려서 샌드백이 되는 게 아니라 쓰기로 판단했을 때 준비하고
 *  가급적 정확히 노려 발동되도록 최선을 다해야' · 기록 docs/strike/gonosen_ai_2026-11-19.md). jpArmRead 가 AI_PLAN.beat 마다 부름.
 *  전엔 고노센 몸이 간 보기 동안 늘 제자리에 서서(ai.js moveFeet) 준비 셈을 쌓고 · 유도는 그 위에 lureT(3.0 s) 멈춤을 굴렸다 — 상대가 걸어 들어도 물러나지 않는 과녁.
 *  이제 결심(jpGns.prep)한 동안만 선다: 몫 = 띠 기울기 × 칸 lure × 쓸 까닭(jpGnsCue) · 굴림은 고노센을 낼 기력 · 칼집이 안전(jpLureOk) · 틈(jpGnsRoom) ≥ gnsRoom 일 때만.
 *  결심한 동안 스텝마다 틈을 다시 봄(jpGnsPrep — 0 아래면 그만두고 보통 간 보기 · 걸으면 셈 0) · 준비가 켜지거나 간 보기를 떠나면 결심은 끝
 */
export function jpBeat(ai) {
  const C = ai.planC;
  const G = ai.jpGns;
  if (!ai.planLure || !C?.lure || ai.planR.mode || G.prep || !ai.iaiArm || ai.iaiArm.armed || ai.mode !== 'watch' || ai.chasing || !jpLureOk(ai) || !(jpGnsRoom(ai) >= J.gnsRoom)) return;
  if (Math.random() < ai.planK * C.lure * jpGnsCue(ai)) {
    G.prep = true;
    ai.stats.plan.jp.lure++;
  }
}

/** 틈 (m): 본 거리 − 상대 칼끝 어림 − 다가오는 빠르기 × 한 박자(AI_PLAN.beat) — 한 박자 안에 상대 칼이 닿을 거리면 0 아래 */
export function jpGnsRoom(ai) {
  return ai.d - ai.foeReach - Math.max(0, ai.foeClosing) * AI_PLAN.beat;
}

/** 쓸 까닭 0 ~ 1 (본 것만): 상대가 걸어 듦(다가오는 빠르기 ≥ 걸음 문턱) 1 · 버릇 — 내 발도 선 안에서 칼을 듦 1(선 밖이면 굴림 몫 coin 의 반 — 꾐이 선 안으로 들임) · 몰아침 foeAggro · 모르면 coin */
export function jpGnsCue(ai) {
  if (ai.foeClosing >= GAIT.walkMin) return 1;
  const rd = readRaiseD(ai);
  const habit = Number.isFinite(rd) ? (rd <= gnsEnterLine(ai.M) ? 1 : AI_PLAN.coin / 2) : AI_PLAN.coin;
  return Math.max(habit, ai.foeAggro ?? 0);
}

/** 준비하려 제자리에 서나 (ai.js moveFeet — 간 보기 걸음 끝 · 준비 전): 결심한 동안 · 틈이 0 아래로 줄면 그만둠(보통 간 보기 — 셈은 걸음으로 0) */
export function jpGnsPrep(ai) {
  const G = ai.jpGns;
  if (!G.prep) return false;
  if (jpGnsRoom(ai) < 0) {
    G.prep = false;
    ai.stats.plan.jp.prepOff = (ai.stats.plan.jp.prepOff ?? 0) + 1;
  }
  return G.prep;
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

/**
 * 고노센 준비를 지키며 기다리기 · 선 안으로 꾐 (3 단계 11/14 — 사장님 '3단계 수 읽기 때 함께'):
 *  롱소드 AI 상대로 AI 고노센이 거의 안 났다(설계 §12-3 — 상대가 내 발도 선 밖에서 칼을 듦 · 준비가 켜진 때와 상대 칼 들기가 안 겹침 · 3 단계 재기: 준비는 판당 한 번 켜지나
 *  먼 위협에 막기 · 出端 패시브 · 헛친 틈 공격으로 곧 풀림). 준비(발도 대기)가 켜진 때 한 번 굴림 둘 —
 *  ① 지킴 keep = 띠 세기 × 칸 still × 서 있기 몫(still 0.6): 준비 동안 먼 위협(상대가 제 칼끝 + 0.15 밖)에 막기로 풀지 않고(jpGnsIgnore) · 낌새(칼 듦 · 달려듦)에 먼저 치거나
 *     물러나지 않고(jpGnsHold — 出端 패시브 · 맞받기 · 물러남 대신) · 걸어 드는 상대를 出端 패시브로 먼저 치지 않음(ai.js passiveWatch 앞) · 먼저 칠 문턱은 jpNeed(선 밖이면 두 배).
 *     상대가 선 밖에서 칼을 들면 beat(0.6 s) 동안 스틱 끝으로 맞으러 나감(出端 — 칼을 드는 동안 선 안에 들면 비기 셈이 냄 · 실행은 그대로)
 *  ② 꾐 invite = 상대가 칼을 드는 거리(버릇 — 공통 읽기 그릇 readRaiseD · 모르면 상대 칼끝 어림 + 0.4 = 공격을 내는 여유 watchReachOut 과 같은 수)가 내 발도 선(gnsEnterLine) 밖이면
 *     띠 세기 × 칸 lure × (버릇을 알면 1 − coin/2 · 모르면 coin) 몫으로 — 준비를 켠 채(걸어도 유지) 선 − iaiMargin 까지 다가가 섬(상대가 내 선 안에서 칼을 들게)
 *  준비가 풀리면 끝. 굴림 없이 옛 길을 그대로 타는 몸: 준비가 없는 몸 · 플랜이 일본이 아닌 몸
 */
function jpGnsArm(ai) {
  const G = ai.jpGns;
  const armed = !!ai.iaiArm?.armed;
  if (armed && !G.was) {
    const line = gnsEnterLine(ai.M);
    const rd = readRaiseD(ai);
    const known = Number.isFinite(rd);
    G.line = line;
    G.keep = Math.random() < ai.planK * (ai.planC?.still ?? 0) * J.still;
    G.invite = (known ? rd : ai.foeReach + 0.4) > line && Math.random() < ai.planK * (ai.planC?.lure ?? 0) * (known ? 1 - AI_PLAN.coin / 2 : AI_PLAN.coin);
    if (G.keep) ai.stats.plan.jp.keep++;
    if (G.invite) ai.stats.plan.jp.invite++;
  }
  if (!armed) {
    G.keep = G.invite = G.struck = G.ignNow = false;
    G.meet = 0;
  }
  G.was = armed;
  return armed;
}

/** 준비를 지키는 중인가 (ai.js passiveWatch 앞 — 걸어 드는 상대를 出端 패시브로 먼저 치지 않음) */
export function jpGnsKeep(ai) {
  return jpGnsArm(ai) && ai.jpGns.keep;
}

/** 칼이 칼집에 든 준비인가 (11/19 — ai.js watch: 미리 줄 닫기 · 걸음에 치기를 건너뜀 — 막는 꼴 · 공격은 뽑기 SECRET.gnsDraw 0.6 s 를 거쳐 준비만 풀림) */
export function jpGnsSeat(ai) {
  return !!ai.iaiArm?.armed && iaiSeated(ai.me);
}

/** 간 보기 다가가는 빠르기 (moveFeet — 플랜 걸음 뒤 · 고노센 경계 줄 앞): 맞으러 나감 · 꾐 · 아니면 그대로 (v = m/s) */
export function jpGnsFeet(ai, v, d) {
  const G = ai.jpGns;
  if (!jpGnsArm(ai) || ai.chasing) return v;
  if (G.meet > 0 && d < G.line - SECRET.iaiMargin) G.meet = 0; // 선 안에 듦 — 멈춤 (비기 셈이 냄 · 안 나면 더 들지 않음)
  if (G.meet > 0) {
    G.meet -= 1 / 120;
    return 3; // 맞으러 나감 — 스틱 끝 (moveFeet 이 스틱 1 로 자름 · 준비는 걸어도 유지)
  }
  if (!G.invite) return v;
  ai.stats.plan.jp.inviteT += 1 / 120;
  const err = d - (G.line - SECRET.iaiMargin);
  return Math.max(-1.9, Math.min(err * 1.6, d > G.line + 0.5 ? 1.2 : 0.18)); // 간 보기 걸음과 같은 몫 · 끝
}

/** 낌새 (watch 의 preThreat 앞): 지키는 중이면 상대가 칼을 들거나 달려들거나 선 밖에서 헛치는 동안 이 스텝을 쥠(먼저 치거나 물러나지 않음) · 선 밖에서 들거나 헛친 칼이 끝나면 맞으러 나감(beat 동안 쥠). 쥐었으면 true */
export function jpGnsHold(ai, s, d) {
  const G = ai.jpGns;
  if (!jpGnsArm(ai) || !G.keep) return false;
  const ign = G.ignNow;
  G.ignNow = false;
  if (ign) {
    G.struck = true; // 선 밖에서 헛치는 칼 — 끝날 때까지 기다림
    return true;
  }
  if (G.struck) {
    G.struck = false; // 헛친 칼이 끝남 — 선 밖이면 거두는 동안 맞으러 나감(거둠 사건 foeRecover 를 선 안에서)
    if (d > G.line) {
      G.meet = AI_PLAN.beat;
      ai.stats.plan.jp.meet++;
    }
  }
  if (G.meet > 0) return true; // 맞으러 나가는 동안은 먼저 치지 않음 (발은 jpGnsFeet)
  const raising = s.hvy > 1.6 && s.hy > 0.05; // preThreat 와 같은 꼴 (늦게 본 손)
  const charging = ai.foeClosing > 0.9;
  if (!raising && !charging) {
    G.hold = null;
    return false;
  }
  if (G.hold == null) {
    G.hold = true;
    ai.stats.plan.jp.hold++;
    if (d > G.line) {
      G.meet = AI_PLAN.beat;
      ai.stats.plan.jp.meet++;
    }
  }
  return true;
}

/**
 * 먼 위협 (watch 의 들어오는 칼 받기 앞): 지키는 중이고 상대가 제 칼끝 어림 + 0.15 m 밖이면 막기로 준비를 풀지 않음 (거리는 스텝마다 — 그 안으로 들면 받기 · 칼집에 들었으면 물러나 피함 jpGnsVoid).
 *  11/19: 걸어 들며 휘두르는 칼은 닿음(단계 덜어 보기 §4-1) → 거리에서 상대가 다가오는 빠르기 × 칼이 닿는 동안(AI_PLAN_JP.gnsLead)을 빼고 견줌. true = 이 스텝 받지 않음
 */
export function jpGnsIgnore(ai, th, d) {
  if (!jpGnsArm(ai) || !ai.jpGns.keep || d - Math.max(0, ai.foeClosing) * J.gnsLead <= ai.foeReach + 0.15) return false;
  ai.jpGns.ignNow = true;
  if (th.id !== ai.jpGns.ignId) {
    ai.jpGns.ignId = th.id;
    ai.stats.plan.jp.ignore++;
  }
  return true;
}

/**
 * 칼집에 든 준비로 받는 위협 (respond — 막을 눈 굴림 뒤 · 뽑기 앞 · 11/19): 칼로 받으려면 뽑기(SECRET.gnsDraw 0.6 s)부터라 그동안 맞음 →
 *  대신 한 박자 물러나 헛치게 함(물러남은 준비를 안 풀음 — 사람과 같은 셈 · 헛친 칼은 비기 셈 foeRecover 가 발도 선 안에서 냄). 물러났으면 true
 */
export function jpGnsVoid(ai) {
  if (!jpGnsSeat(ai)) return false;
  ai.startWithdraw(J.gnsVoidT);
  ai.jpGns.voidT = ai.sense.t + realS(J.gnsVoidT);
  ai.stats.plan.jp.void = (ai.stats.plan.jp.void ?? 0) + 1;
  return true;
}

/** 물러나 피하는 걸음 (ai.js moveFeet 물러남 — 11/19): 그 박자 동안 뒤 끝(−1 — 보통 물러남은 간 보는 거리 가까이서 −0.3 으로 느림)으로 · 발도 선 − iaiMargin 에 닿으면 멈춤(헛친 칼을 선 안에서 냄) */
export function jpGnsVoidFeet(ai, fwd, d) {
  const G = ai.jpGns;
  if (!(ai.sense.t < (G.voidT ?? -1)) || !jpGnsSeat(ai)) return fwd;
  return d < G.line - SECRET.iaiMargin ? -1 : 0;
}

/**
 * 칼집에 든 준비에서 뽑아 칠까 (ai.js atkGate — 비기 아닌 공격 · 11/19): 뽑는 동안(SECRET.gnsDraw 0.6 s) 상대가 한 걸음 들어와 칠 수 있는 거리
 *  (거리 − 상대 칼끝 어림 − 다가옴 × 뽑기 초 < gnsRoom 한 걸음)면 뽑지 않음 — 뽑기를 걸면 준비가 풀리고 그 0.6 s 는 막지도 못함(전엔 상대가 걸어 들면 큰 틈 · 들어옴 공격으로 뽑다가 맞음).
 *  그 거리는 비기 셈(칼을 듦 · 달려듦 · 헛침)이 맡음 · 멀면 뽑고 침(보통 간 보기로). 상대가 준비 앞에서 칼을 내지 않고 gnsWait 넘게 조용하면(jpArmRead quietT) 기다림을 거둠 —
 *  서 있기만 하는 상대 앞에서 칼집에 든 채 끝없이 서지 않게(뽑아 보통 간 보기로). true = 이 공격을 열지 않음
 */
export function jpGnsDrawHold(ai) {
  if (!jpGnsSeat(ai) || ai.jpGns.quietT >= J.gnsWait || !(ai.d - ai.foeReach - Math.max(0, ai.foeClosing) * SECRET.gnsDraw < J.gnsRoom)) return false;
  ai.stats.plan.jp.drawHold = (ai.stats.plan.jp.drawHold ?? 0) + 1;
  return true;
}

// ── 11/16 뽑기 읽기 (AI_PLAN_JP.drawRead — 사장님 11/16 '고노센을 쓰지 않고 칼을 뺄 때도 시간이 강제로 들게 하자 …' · 사람 · AI 같은 규칙) ──
/**
 * 칼집 위험 (본 것만 — 늦게 본 거리 ai.d · 상대 칼끝 어림 foeReach · 다가오는 빠르기 foeClosing · 내 기력 · 내 발도 선 gnsEnterLine):
 *  near = 뽑는 동안(SECRET.gnsDraw) 상대 칼이 닿을 수 있음(거리 < 상대 칼끝 어림 + 다가오는 빠르기 × 뽑기 초) · out = 상대가 내 발도 선 밖에서 칠 수 있음(칼끝 어림 > 선) ·
 *  can = 고노센을 낼 기력(> 0 — 비기 문턱). ok = 칼집에 넣어도 됨(고노센을 낼 수 있고 · 선 밖에서 치는 상대가 닿지 않음) · now = 칼집에서 먼저 뽑을 때(닿는데 고노센을 못 내거나 선 밖에서 맞음)
 */
function drawRisk(ai) {
  const line = gnsEnterLine(ai.M);
  const can = !!ai.me.stamina?.secretReady;
  const near = ai.d < ai.foeReach + Math.max(0, ai.foeClosing) * SECRET.gnsDraw;
  const out = ai.foeReach > line;
  return { ok: can && (!out || !near), now: near && (!can || (out && ai.d > line)) };
}
/** 이번 준비 셈에 뽑기 읽기를 하나 (띠 기울기 — 높음은 늘 · 낮을수록 굴림 몫으로 · 셈이 풀리면 다시 굴림) */
function jpWary(ai) {
  const G = ai.jpGns;
  if (G.wary == null) G.wary = ai.planK >= 1 || (ai.planK > 0 && Math.random() < ai.planK);
  return G.wary;
}
/**
 * 고노센 준비 셈 뒤 (ai.js — gnsArmTick 다음 스텝마다 · 플랜이 일본인 몸만): 납도를 시작하기 전(셈이 iaiArmTime 에 닿음) 칼집이 위험하면 셈을 그 문턱에 쥠(납도를 미룸 — 안전해지면 곧장) ·
 *  칼이 칼집에 든 채 위험하면 먼저 뽑음(drawStart 'read' — 상대 칼이 닿기 전에 0.6 s 를 씀) · 맞으러 나가는 중(meet)은 그대로. drawRead 0 · 뽑기 없음이면 아무것도 안 함
 */
export function jpArmRead(ai, dt) {
  const A = ai.iaiArm;
  const G0 = ai.jpGns;
  if (G0 && (A?.armed || ai.mode !== 'watch')) G0.prep = false; // 11/19 준비 결심: 준비가 켜졌거나 간 보기를 떠나면(막기 · 공격 · 물러남 — 셈 0) 끝
  if (G0 && (G0.beatT = (G0.beatT ?? 0) - dt) <= 0) (G0.beatT = AI_PLAN.beat), jpBeat(ai); // 11/19 준비 결심은 한 박자마다 (전 자세 박자 — 2 ~ 10 s 에 한 번이라 판 시작 · 상대가 물러난 틈을 놓침)
  if (G0) G0.quietT = A?.armed && !ai.read?.raising && ai.mode === 'watch' ? (G0.quietT ?? 0) + dt : 0; // 11/19 준비 앞 조용한 시간 (상대가 칼을 듦 · 내가 물러나 피함 · 막음이면 0 — jpGnsDrawHold 의 기다림 한도 gnsWait)
  if (!J.drawRead || !(SECRET.gnsDraw > 0) || !A || !ai.jpGns) return;
  const T = SECRET.iaiArmTime;
  const G = ai.jpGns;
  if (!A.armed && A.t < T) {
    G.wary = null;
    return;
  }
  if (!jpWary(ai)) return;
  const R = drawRisk(ai);
  if (!A.armed && A.t - dt <= T + 1e-9 && !R.ok) {
    if (A.t > T) ai.stats.plan.jp.sheatheWait = (ai.stats.plan.jp.sheatheWait ?? 0) + 1;
    A.t = T; // 납도 몫 0 — 셈은 문턱에 쥠
    return;
  }
  if (R.now && !(G.meet > 0) && iaiSeated(ai.me)) {
    drawStart(ai.me, 'read');
    ai.stats.plan.jp.drawRead = (ai.stats.plan.jp.drawRead ?? 0) + 1;
  }
}
/** 준비를 결심해도 되나 (jpBeat): 고노센이 이 몸에 있고 · 기력이 고노센 값(SECRET.gnsCost) 넘게 있고 · 지금 칼집이 위험하지 않음. drawRead 0 이면 늘 (11/15 판) */
export function jpLureOk(ai) {
  if (!J.drawRead || !(SECRET.gnsDraw > 0)) return true;
  if (!ai.iaiArm) return false;
  if (ai.me.stamina && !ai.me.stamina.infinite && !(ai.me.stamina.value > (SECRET.gnsCost ?? STAMINA.secretCost))) return false;
  return drawRisk(ai).ok;
}
