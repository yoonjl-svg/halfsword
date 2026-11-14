// ─────────────────────────────────────────────────────────────
//  유파 AI 기본 전투 흐름 — 무유파 플랜 (3 단계 · 11/14 사장님 'A안 켜고 3단계 진행해' · '독일과 함께 무유파 무모함 켜' ·
//   기록 docs/strike/ai_plan_free_2026-11-14.md · 칸 표 FREE_PLAN(아래) · 값 config AI_PLAN_FREE · `?aiPlanFree=0` = 옛 판)
//
//  무유파 = 검술을 배운 적 없는 몸과 유파 없는 무기다(schools.js TRADITIONS.none — 나뭇가지 · 고무 닭 · 냉동 참치 · 모르겐슈테른 · 황약사의 검).
//   고유 동작 · 패시브 · 비기 · 연계 · 유도가 없다. 그래서 플랜은 공용 동작과 무기의 실제 몸(짧음 · 머리 무게)만 쓴다.
//  ① 쳐내며 들어감 — 둔기 파고들기 (A 가 못 푼 몫: 둔기에는 걸음 실린 기술이 없음):
//   상대 칼끝 바로 밖에서 상대 칼을 내려쳐 비키며 한 걸음 내딛는다(누르는 내려베기 — 칼끝이 나를 겨누면 그 칼부터 쳐서 비킨다는 AI 의 옛 셈 · pointBlocked).
//   그 칼이 끝나면 곧장 스틱 끝으로 건너 들어가 둔기로 친다. 헛친 틈 건넘 · 붙은 뒤 이어 침은 파고들기 A(dig_proto.js)가 그대로 맡는다.
//  ② 붙어 두들김: 붙은 거리에서 이어 칠 마음이 크고, 주고받은 뒤 짧게만 물러난다(긴 칼 앞으로 다시 나가면 또 건너야 하므로).
//  무 · 낮음 '행운에 기대는 전투'(무모 · 무계획 · 운 — 사장님 11/14 '독일과 함께 무유파 무모함 켜'): 공통 틀의 굴림 몫(planLuck)과 거리 오차를 이 몸도 받는다.
//   무유파는 무 띠(숙련 0 — 브론)에도 굴림을 탄다(ai_plan.js planFor). 쳐내기는 계획 몫(띠 기울기 — 상대 칼끝이 나를 겨눌 때) + 막 휘두름 몫(굴림 몫 — 때를 안 가림)이다.
//  띠별 기력 · 수 읽기는 공통 틀이 맡는다. 모두 기울기다(사장님 11/14 '절대적 규칙은 빼').
//  ai.js 는 this.planFree(무유파 플랜 몸만 — freeInit)가 있을 때만 여기를 부른다 — 다른 유파 · 옛 판은 굴림 · 셈 그대로.
//  연산: 스텝마다 새 객체 · 배열 없음 · 굴림은 쳐내기(AI_PLAN.beat 마다 한 번) · 쳐낸 뒤 들어감(한 번) · 기술 고르기에만.
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, AI_PLAN_FREE } from './config.js';

const F = () => AI_PLAN_FREE;

/**
 * 무유파 플랜 칸 (설계 §3 꼴 — 국면마다 고를 몫 0 ~ 1 · × 띠 세기 planK 또는 굴림 몫 planLuck):
 *  beat  쳐내며 들어감 — 상대 칼끝 바로 밖에서 상대 칼을 내려쳐 비키며 내딛고 건너 들어감
 *  press 붙어 두들김 — 붙은 거리에서 이어 칠 마음 · 주고받은 뒤 짧게 물러남
 */
export const FREE_PLAN = Object.freeze({
  nameKo: '막싸움꾼',
  lureAt: Infinity, // 유도 없음 (무유파 — 연계 · 유도가 없는 몸)
  free: true,
  probe: Object.freeze({ beat: 1, press: 0.5 }),
  contest: Object.freeze({ beat: 1, press: 1 }),
  commit: Object.freeze({ beat: 1, press: 1 }), // 들어감 — 다가가다 상대 칼끝 안에서 막히면 그 칼을 쳐내며 들어감
  ahead: Object.freeze({ beat: 1, press: 1 }), // 상대가 더 흘림 — 붙어 이어 감
  finish: Object.freeze({ beat: 0, press: 1 }), // 무너진 상대 — 쳐낼 칼이 없음 · 곧장 침 (공통)
  behind: Object.freeze({ beat: 1, press: 0.5 }), // 긴 칼 앞에서 물러나면 또 맞음 — 판을 다시 여는 법은 쳐내며 붙음
  tired: Object.freeze({ beat: 0, press: 0 }), // 쉼 — 공통 틀 띠별 기력
});

/** 무유파 플랜 상태 칸 (ai 생성자 — this.plan 이 무유파 플랜일 때만 · 한 번 만듦) */
export function freeInit(ai) {
  ai.planFree = {
    rollT: 0, // 다음 쳐내기 굴림 때 (게임 초 — AI_PLAN.beat 마다 한 번)
    crossSeq: -1, // 쳐낸 뒤 건너 들어가는 공격 번호 (그 공격의 다가감만 스틱 끝)
  };
  ai.stats.free = { beat: 0, wild: 0, onWay: 0, beatBound: 0, beatHit: 0, beatMiss: 0, go: 0, goStrike: 0, press: 0 };
}

/**
 * 쳐내기 굴림 — 간 보기(watch · 판단 박자 앞)와 다가감(attack approach — 상대 칼끝 안에서 내 칠 거리까지 beatGap 넘게 남아 막힘)에서:
 *  창 = 내 칼은 몸에 안 닿고(내 칼끝 + 0.1 < d) 상대 칼끝 어림 + beatOut 안 · 상대가 서서 칼을 쥠 · 단단한 무기(휘는 채찍 아님) · AI_PLAN.beat 마다 한 번 굴림 —
 *  계획 몫 planK × 칸 × beat(상대 칼이 내 앞 줄에 있을 때만 — 칼끝이 나를 겨눔 · 가운데 · 낮음 · 들어오는 칼 · 높이 든 칼은 쳐낼 칼이 없음) +
 *  막 휘두름 몫 planLuck × 칸 × wild(때를 안 가림). 굴려 나오면 'beat'(계획) · 'wild' 를 돌려줌 · 아니면 null
 */
function beatRoll(ai, s, d) {
  const P = ai.planFree;
  const cb = ai.planC?.beat ?? 0;
  if (!(cb > 0) || ai.chasing || ai.Mup || !ai.foe.alive || !s || s.state !== 'stand' || !s.armed || !ai.me.armed) return null;
  if (ai.me.flexWeapon) return null; // 휘는 무기(드루이드의 채찍 — 덩굴 마디)는 쳐내기를 안 함: 단단한 머리로 상대 칼을 쳐 비키는 몸이 아님 (해 보니 마디 벌어짐만 커짐 — 기록 §2-2)
  if (d > ai.foeReach + F().beatOut || d <= ai.M.reach + 0.1) return null;
  if (ai.sense.t < P.rollT) return null;
  P.rollT = ai.sense.t + AI_PLAN.beat;
  const plan = ai.foeClass(s).high ? 0 : ai.planK * cb * F().beat;
  const wild = ai.planLuck * cb * F().wild;
  const r = Math.random();
  return r < plan ? 'beat' : r < plan + wild ? 'wild' : null;
}

/** 간 보기에서 쳐내기 (watch): 굴려 나오면 누르는 내려베기를 더 골라 'beat' 공격을 냄. 냈으면 true */
export function freeBeat(ai, s, d) {
  const k = beatRoll(ai, s, d);
  if (!k) return false;
  const tech = ai.pickTech(s, 'beat', { presses: 2 }); // 누르는 내려베기(분노의 베기 · 정수리 베기)를 더 — 위에서 그 칼을 눌러 비킴
  if (!ai.startAttack(tech, 'beat', { noFeint: true })) return false;
  ai.stats.free[k]++;
  return true;
}

/** 다가가다 상대 칼끝 안에서 막힘 (attack approach — 내 칠 거리까지 beatGap 넘게 남음): 굴려 나오면 지금 칼을 그 자리에서 쳐내기로 냄 (기술 그대로 · why 'beat') */
export function freeBeatOnWay(ai, s, d) {
  if (ai.why === 'beat' || ai.why === 'finish' || ai.feint || ai.secretRun || ai.passiveAtk || d - (ai.need ?? 0) <= F().beatGap) return;
  const k = beatRoll(ai, s, d);
  if (!k) return;
  ai.why = 'beat';
  ai.stats.free[k]++;
  ai.stats.free.onWay++;
}

/** 쳐내기 칼은 지금 거리에서 곧장 낸다 (다가감 need — 상대 칼끝 어림 + beatOut 까지) */
export function freeNeed(ai, need) {
  return ai.why === 'beat' ? Math.max(need, ai.foeReach + F().beatOut) : need;
}

/** 쳐내기 칼은 칼끝을 쳐 비키며 한 걸음 내딛는다 (stepTime — 칼끝이 나를 겨누면 안 딛는 옛 셈보다 먼저) */
export function freeStepIn(ai) {
  return ai.why === 'beat';
}

/**
 * 친 뒤 (afterStrike — 옛 이어 치기 굴림 앞): 쳐내기 칼이 끝났으면 곧장 건너 들어가 칠까 —
 *  몫 = planK × go + planLuck × coin(무계획 — 동전). 들어가면 그 공격의 다가감은 스틱 끝(freeFeet). 냈으면 true
 */
export function freeAfter(ai, d) {
  if (ai.why !== 'beat') return false;
  const st = ai.stats.free;
  st[ai.hitLanded ? 'beatHit' : ai.bound ? 'beatBound' : 'beatMiss']++;
  const s = ai.lastSeen;
  if (!s || !ai.foe.alive || s.state !== 'stand' || d < ai.M.clinch + 0.1 || d > ai.foeReach + F().beatOut + 0.3) return false;
  if (!(Math.random() < ai.planK * F().go + ai.planLuck * AI_PLAN.coin)) return false;
  if (!ai.startAttack(ai.pickTech(s, 'recover'), 'dig', { noFeint: true })) return false;
  ai.planFree.crossSeq = ai.atkSeq;
  st.go++;
  return true;
}

/** 쳐낸 뒤 건너 들어가는 다가감 (moveFeet approach · windup): 칠 거리까지 스틱 끝 */
export function freeFeet(ai, fwd, gap) {
  if (ai.atkSeq !== ai.planFree.crossSeq || !(gap > 0)) return fwd;
  return 1;
}

/** 건너 들어간 공격이 칼을 냄 (startStrike — 재기) */
export function freeStrike(ai) {
  if (ai.atkSeq === ai.planFree.crossSeq) ai.stats.free.goStrike++;
}

/** 붙어 두들김 (afterStrike 이어 칠 몫): 붙은 거리(내 칼끝 + 0.3 안)면 want 에 (1 − want) × planK × 칸 × press 를 얹음 */
export function freePress(ai, want, d) {
  const cp = ai.planC?.press ?? 0;
  if (!(cp > 0) || !(ai.planK > 0) || d > ai.M.reach + 0.3) return want; // 무 띠(기울기 0)는 계획 몫이 없음 — 셈 그대로 (재기에도 안 셈)
  ai.stats.free.press++;
  return want + (1 - want) * ai.planK * cp * F().press;
}

/** 붙어 두들김 — 주고받은 뒤 물러나는 시간 몫 (1 − planK × 칸 × back) */
export function freeBackK(ai) {
  return 1 - ai.planK * (ai.planC?.press ?? 0) * F().back;
}
