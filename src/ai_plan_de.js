// ─────────────────────────────────────────────────────────────
//  유파 AI 3 단계 — 독일 '상대 리듬을 빼앗는 더티복서' 플랜 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §3-1 · 기록 §13 · config AI_PLAN_DE)
//
//  독일 몫만 이 파일에 묶는다(다른 3 단계 작업자와 공통 틀 파일 충돌을 작게). ai.js 는 플랜이 독일인 몸(ai.planDe)일 때만 아래를 부른다 —
//  다른 유파 · 플랜 없는 몸 · 옛 판(`?aiPlan=0` · `?aiPlanDe=0`)은 한 줄도 안 탄다(굴림 · 셈 그대로). ai_plan.js 를 들여오지 않는다(고리 없음).
//  모두 기울기: 몫 = 띠 기울기(ai.planK) × 국면 칸(ai.planC) × AI_PLAN_DE 값 — 확률 · 곱 · 문턱 이동 (사장님 11/14 '절대적 규칙은 빼').
//
//  플랜 칸
//   edge   간 보기 — 상대 칼끝 바로 밖(여유 작게) · 상대가 먼저 휘두르게
//   dig    파고들기 — 상대 헛침을 보면 두 걸음 박찬 앞 걸음(사람 파고들기와 같은 장치)
//   push   인물 칸 없는 밀치기(독일 유파 몫) — 닿는 거리 안에서 밀어 묶음(묶임 1.2 s · 기력 × 2 → 칼 씨름 · 모르트슐라크)
//   stick  붙음 물러남을 덜 함 (독일은 덜 떨어짐 — 끄지 않음)
//   back   뒤 박차기 — 물러나 피하기로 정한 위협에 박찬 뒤 걸음으로 빠짐 (빠진 뒤 헛침을 꾐)
//   lure   유도(가운데 끝 4 부터) — 바보 자세로 칼끝 끝에 서서 내려베기를 꾐
//   stam   내 기력 ↔ 상대 기력의 차 (사장님 11/14 '기력 우위일 경우엔 밀지 않을 이유도 없는') — 우위면 밀어 묶고 열세면 칼끝 밖에서 숨 고름 · 띠가 높을수록 또렷 · 높음은 바위 몸 상대면 뒤집음
// ─────────────────────────────────────────────────────────────
import { AI_PLAN_DE as D, JP_TANK } from './config.js';
import { lowShoveFree } from './jp_tank.js';

const P = (o) => Object.freeze(o);
/** 독일 플랜 칸 (국면마다 — 값은 고를 몫 0 ~ 1) */
export const DE_PLAN = Object.freeze({
  nameKo: '더티복서',
  lureAt: 4,
  probe: P({ edge: 1, dig: 0.5, push: 0.5, stick: 0.5, back: 1, lure: 1, stam: 1 }),
  contest: P({ edge: 1, dig: 1, push: 1, stick: 1, back: 1, lure: 1, stam: 1 }),
  commit: P({ edge: 0, dig: 1, push: 1, stick: 1, back: 0.5, lure: 0, stam: 1 }),
  ahead: P({ edge: 1, dig: 1, push: 1, stick: 1, back: 0.5, lure: 0, stam: 1 }), // 묶임 · 그 순간 창 — 다시 누름
  finish: P({ edge: 0, dig: 1, push: 1, stick: 1, back: 0, lure: 0, stam: 1 }), // 칼 씨름 · 무너진 상대에게 다시 밀치기 → 모르트슐라크
  behind: P({ edge: 1, dig: 0.5, push: 0.5, stick: 0, back: 1, lure: 0, stam: 1 }), // 뒤 박차기로 빠짐 — 빠진 뒤 헛침을 다시 꾐
  tired: P({ edge: 0, dig: 0, push: 0.5, stick: 0, back: 1, lure: 0, stam: 1 }), // 기력 차로 — 열세면 칼끝 밖 숨 고름
});

/** ai 생성자 (플랜이 독일일 때 한 번): 밀치기 칸 · 파고들기 상태 · 재기 칸 */
export function deInit(ai) {
  ai.me.canShove = true; // 인물 칸 없는 밀치기 (독일 유파 몫 — fighter.closeStep 을 탐)
  ai.deClose = { rate: 0, then: 'pommel', pommel: 0 }; // closeQuarters 가 읽는 칸 (밀 몫은 deCloseCfg 가 사건마다 새로 — 객체는 하나)
  ai.deDig = { t: 0, armed: true, after: 0 }; // after = 파고들기 뒤 밀치기를 크게 기울이는 남은 시간 (digT + AI_PLAN.beat)
  ai.stats.plan.de = { digTry: 0, dig: 0, back: 0, lure: 0, diffUp: 0, diffDown: 0 };
}

/** 상대가 바위 몸(밀치기에 기력 안 씀 — 사람 · AI 일본 jp_tank.js lowShoveFree)인가 */
function rockFoe(ai) {
  return !!JP_TANK.lowShove && lowShoveFree(ai.foe);
}

/**
 * 기력 차 −1 ~ 1 (내 기력 − 상대 기력 — 둘 다 머리 위 막대로 보임 · 공정) × 또렷함(기울기 × (1 − 굴림 몫) — 낮음은 거의 안 셈 · 무계획) × 칸 stam.
 *  높음(기울기 1)은 상대가 바위 몸이면 뒤집음(상대는 묶여도 안 지침 — 내가 먼저 바닥남). 없으면 0
 */
export function deDiff(ai) {
  const C = ai.planC;
  const w = ai.planK * (1 - (ai.planLuck ?? 0)) * (C?.stam ?? 0);
  if (!(w > 0)) return 0;
  const a = ai.me.stamina?.value ?? 0;
  const b = ai.foe.stamina?.value ?? 0;
  let d = Math.max(-1, Math.min(1, (D.diffK * (a - b)) / 100));
  if (ai.planK >= 1 && rockFoe(ai)) d = -Math.abs(d) - 0.5 * (1 - Math.abs(d)); // 바위 몸 상대 — 밀어 지치게 할 수 없음(열세 쪽으로)
  return d * w;
}

/** closeQuarters 가 읽는 밀치기 칸 (인물 칸이 없는 독일 플랜 몸): 밀 몫 = push × 기울기 × 칸 × (1 + 기력 차) × (파고들기 뒤면 2 — 헛침 → 파고들기 → 밀치기) · 찍기 몫 = 공통 AI_PLAN.pommel */
export function deCloseCfg(ai, pommel) {
  const C = ai.planC;
  const R = ai.deClose;
  R.rate = Math.max(0, Math.min(0.95, D.push * ai.planK * (C?.push ?? 0) * (1 + deDiff(ai)) * (ai.deDig.after > 0 ? 2 : 1)));
  R.pommel = pommel;
  return R;
}

/** 전략 층 (planTick 의 국면 판정 때 — 0.2 s · 사건): 기력 차 판단을 셈 (재기 — 우위 쪽 · 열세 쪽 박자 수) */
export function deRead(ai) {
  const diff = deDiff(ai);
  if (diff > 0.05) ai.stats.plan.de.diffUp++;
  else if (diff < -0.05) ai.stats.plan.de.diffDown++;
}

/** 간 보는 여유 m (holdDist): 칼끝 바로 밖(edge) · 기력 열세면 숨 고름(breath) */
export function deHoldM(ai, m) {
  const C = ai.planC;
  if (!C) return m;
  m *= 1 - D.edge * ai.planK * (C.edge ?? 0);
  const diff = deDiff(ai);
  if (diff < 0) m += D.breath * -diff;
  return m;
}

/** 너무 붙었을 때 물러나는 스틱 배율 0 ~ 1 (moveFeet — 독일은 덜 떨어짐) */
export function deStickK(ai) {
  return 1 - D.stick * ai.planK * (ai.planC?.stick ?? 0);
}

/**
 * 파고들기 (watch · seize 앞 — 상대 헛침을 본 한 번에 한 번 굴림): 상대가 휘두른 뒤 손이 멈춤(seize 의 recovering 과 같은 셈 — 늦게 본 모습) ·
 *  내 칼끝 안 아님 · 상대 칼끝 어림 + 1.0 안(두 걸음) → dig × 기울기 × 칸 몫으로 gait.deDigAi(두 걸음 박찬 앞 걸음) + digT 동안 스틱 앞 끝(deFeet). 걸었으면 true
 */
export function deDigTry(ai, s, d, recovering) {
  const G = ai.deDig;
  if (!recovering) {
    G.armed = true;
    return false;
  }
  if (!G.armed || G.t > 0) return false;
  G.armed = false;
  const C = ai.planC;
  if (!C?.dig || d < ai.M.contact || d > ai.foeReach + 1.0 || s.state !== 'stand' || !ai.me.armed) return false;
  ai.stats.plan.de.digTry++;
  if (!(Math.random() < D.dig * ai.planK * C.dig)) return false;
  if (!ai.me.gait?.deDigAi?.()) return false;
  G.t = D.digT;
  G.after = D.digT + D.afterT;
  ai.stats.plan.de.dig++;
  return true;
}

/**
 * 파고들기 스틱 (moveFeet — 간 보기 · 물러남 · 막기 · 공격 준비 · 다가감): digT 동안 앞 끝(두 걸음 박찬 앞 걸음 — 그동안 ai.startAttack 이 새 공격을 미룸) · 그 뒤 afterT 동안은 밀치기 거리(붙은 거리 규칙 시작 거리) 밖이면
 *  걸어 들어감(헛침 → 파고들기 → 1 m 안 밀치기 — 안에 들면 closeQuarters 가 밀 몫 × 2 로 굴림). 덮었으면 앞뒤 스틱 값 · 아니면 null
 */
export function deFeet(ai, dt, d, startD) {
  const G = ai.deDig;
  if (G.after > 0) G.after -= dt;
  if (G.t > 0) {
    G.t -= dt;
    if (d >= startD) return 1;
    G.t = 0;
  }
  if (G.after > 0 && !ai.closeInside && d > startD && !ai.me.barge) return 1;
  return null;
}

/** 뒤 박차기 (respond — 물러나 피하기로 정한 위협): back × 기울기 × 칸 몫으로 gait.backBurstAi. 굴림은 이때만 */
export function deBack(ai) {
  const C = ai.planC;
  if (!C?.back || !(Math.random() < D.back * ai.planK * C.back)) return false;
  if (!ai.me.gait?.backBurstAi?.()) return false;
  ai.stats.plan.de.back++;
  return true;
}

/** 자세 박자마다 (watch — 자세를 새로 고른 때): 유도(4 부터) — lure × 기울기 × 칸 몫으로 바보 자세(있으면). 굴림은 그 조건일 때만 */
export function deBeat(ai) {
  const C = ai.planC;
  if (!ai.planLure || !C?.lure) return;
  const g = ai.school.guards.find((x) => x.name === 'alber');
  if (!g || !(Math.random() < D.lure * ai.planK * C.lure)) return;
  ai.guard = g;
  ai.stats.plan.de.lure++;
}

