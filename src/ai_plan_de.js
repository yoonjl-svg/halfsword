// ─────────────────────────────────────────────────────────────
//  유파 AI 3 단계 — 독일 '상대 리듬을 빼앗는 더티복서' 플랜 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §3-1 · 기록 §13 · config AI_PLAN_DE)
//
//  독일 몫만 이 파일에 묶는다(다른 3 단계 작업자와 공통 틀 파일 충돌을 작게). ai.js 는 플랜이 독일인 몸(ai.planDe)일 때만 아래를 부른다 —
//  다른 유파 · 플랜 없는 몸 · 옛 판은 한 줄도 안 탄다(굴림 · 셈 그대로). ai_plan.js 를 들여오지 않는다(고리 없음).
//  모두 기울기: 몫 = 띠 기울기(ai.planK) × 국면 칸(ai.planC) × AI_PLAN_DE 값 — 확률 · 곱 · 문턱 이동 (사장님 11/14 '절대적 규칙은 빼').
//
//  플랜 칸
//   edge   간 보기 — 상대 칼끝 바로 밖(여유 작게) · 상대가 먼저 휘두르게
//   dig    파고들기 — 상대 헛침을 보면 두 걸음 박찬 앞 걸음(사람 파고들기와 같은 장치) · 낮은 띠는 굴림 몫만큼 동전으로 뛰어듦(digLuck — 11/15)
//   push   인물 칸 없는 밀치기(독일 유파 몫) — 닿는 거리 안에서 밀어 묶음(묶임 1.2 s · 기력 × 2 → 칼 씨름 · 모르트슐라크) · 맞닿기 안 헛침에도 밀 마음(pushNear — 11/15)
//   stick  붙음 물러남을 덜 함 (독일은 덜 떨어짐 — 끄지 않음)
//   back   뒤 박차기 — 물러나 피하기로 정한 위협에 박찬 뒤 걸음으로 빠짐 (빠진 뒤 헛침을 꾐)
//   lure   유도(가운데 끝 4 부터) — 바보 자세로 칼끝 끝에 서서 내려베기를 꾐
//   stam   내 기력 ↔ 상대 기력의 차 (사장님 11/14 '기력 우위일 경우엔 밀지 않을 이유도 없는') — 우위면 밀어 묶고 열세면 칼끝 밖에서 숨 고름 · 띠가 높을수록 또렷 · 높음은 바위 몸 상대면 뒤집음
//
//  띠 높음 (숙련 5 ~ · planK 1 — [사장님 11/19 결정] "숙련 5면 이미 대가잖아. 상대 칼을 예측 가능해서 그 동작이 의미 있을 때 뒤로 박차야해. 박찬 다음에는 실제 그로 인한
//   이득이 취해지도록 다음 동작을 연계해야 하고. 비기 기력은 모르트슐라크로 누르는 동안에만 남겨." · 기록 docs/strike/de_band3_2026-11-19.md):
//   ① 읽고 박차기 — 뒤 박차기는 상대가 칼을 낸 것을 읽었고(칼 든 낌새를 본 뒤 그 칼의 첫 휘두름 · 달려듦 — deCommit) 그 칼이 지금 자리에 닿는데
//      걷는 뒷걸음으론 못 빠지고 박찬 뒷걸음으로는 빠질 때만 (deBackRead) · 쉬는 중이거나 기력이 쉼 문턱 + 박차기 값 + 베기 값 아래면 안 박참 (11/19 §8 — 뒤 칼까지 낼 기력)
//      11/19 §8 출발 읽기 (deLeaveTick): 감아 든 꼴(오코리 · 느린 감기)을 읽었으면 칼이 떠나는 때(상대 몸이 칠 거리에 막 듦)에 박참 — 박찬 걸음이 그 칼의 출발과 겹침
//   ② 뒤 칼 — 박차서 그 칼을 비낀 뒤 상대 칼이 다한 틈(헛친 뒤 굳음 0.6 s)에 곧장 다시 들어가 침 (deNachTick — 나흐라이젠 · 나흐슐라크 · 기술은 독일 꾸러미 'recover' 고르기 · 오코리 없음)
//   ③ 비기 기력 35 남김은 모르트슐라크로 누르는 동안만 (deReserve — ai.js planRestAt)
//   띠 낮음 · 가운데(숙련 1 ~ 4)는 한 줄도 안 바뀜 (옛 굴림 그대로)
// ─────────────────────────────────────────────────────────────
import { AI_PLAN_DE as D, AI_PLAN, GAIT, STAMINA, OKORI } from './config.js';
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
  ai.deDig = { t: 0, armed: true, after: 0, push: false }; // after = 파고들기 뒤 밀치기를 크게 기울이는 남은 시간 (digT + AI_PLAN.beat) · push = 밀 마음(pushNear — 맞닿기 안 헛침에서 굴려 났음 · 닿는 거리에 들면 굴림 없이 민다 · 밀거나 after 가 끝나면 지움)
  ai.stats.plan.de = { digTry: 0, dig: 0, back: 0, lure: 0, diffUp: 0, diffDown: 0, pushTry: 0, pushGo: 0, knee: 0, kneeGo: 0 };
  ai.deKnee = { at: null, live: false, seen: false }; // G6 무릎 꺾기 뒤 끝내기 (11/19 — deKnee): 마지막으로 본 꺾음(foe.buckleAt) · 그 꺾음에 아직 끝내기를 안 냄 · 꿇은 모습을 봄
  ai.deNach = null; // 띠 높음 뒤 칼 (11/19 — deNachTick): 박찬 뒤 { t0 · tau(그 칼이 가장 가까워질 어림 초) · until · w0(내 상처 수) · f0 · lift(박찬 걸음을 뗌 — 몸 시계 fightT) · seen(나를 겨눈 칼을 봄) · thId(본 칼의 위협 번호) · vT(비낀 때) · voided · fired · seq · fw0(상대 상처 수) · dig(앞 박차기를 아직 못 뗌 — 다시 걺) }
  ai.deCue = master(ai) ? { t: -Infinity, id: -1 } : null; // 띠 높음 칼 든 낌새 (11/19 — deCueTick): 마지막으로 본 때 · 그 낌새가 시작될 때의 위협 번호
  ai.deLeave = master(ai) ? { on: false, ok: false, done: false, set: false } : null; // 띠 높음 출발 읽기 (11/19 — deLeaveTick): 감아 든 꼴 하나 · 읽었나 · 그 꼴에서 박찰지 봤나 · 서서 기다림(moveFeet)
  if (master(ai)) Object.assign(ai.stats.plan.de, { backSee: 0, backFar: 0, backWalk: 0, backDeep: 0, backCue: 0, backStam: 0, backVoid: 0, backHit: 0, nach: 0, nachHit: 0, nachW: 0, nachLost: 0, leaveSee: 0, leaveRead: 0, leave: 0 }); // 재기 (11/19)
}

/** 띠 높음(숙련 5 ~ — 띠 기울기 1)인가 — 11/19 '대가' 몫(읽고 박차기 · 뒤 칼 · 누르는 동안만 비기 기력)을 받는 몸 */
export function master(ai) {
  return ai.planK >= 1;
}

/** 박찬 뒷걸음이 τ 초에 가는 거리 m (gait.js fastBegin 과 같은 셈 — 가속 한도 maxAccel × burstAccel 로 burstBackV 까지 · 서 있다가) */
function burstGain(tau) {
  const a = GAIT.maxAccel * GAIT.burstAccel;
  const V = GAIT.burstBackV;
  const t1 = V / a;
  return tau <= t1 ? 0.5 * a * tau * tau : 0.5 * a * t1 * t1 + V * (tau - t1);
}

/** 걷는 뒷걸음이 τ 초에 가는 거리 m (가속 한도 maxAccel 로 뒷걸음 빠르기 moveSpeed × backFactor 까지 · 서 있다가) */
function walkGain(tau) {
  const a = GAIT.maxAccel;
  const V = GAIT.moveSpeed * GAIT.backFactor;
  const t1 = V / a;
  return tau <= t1 ? 0.5 * a * tau * tau : 0.5 * a * t1 * t1 + V * (tau - t1);
}

/**
 * 읽고 박차기 (띠 높음 · 11/19): 들어오는 칼 th(늦게 본 모습 — ai.js threat 의 tc = 그 모습에서 칼끝이 가장 가까워지는 데 남은 초)가
 *  닿을 때까지 τ = tc (대가는 칼을 미리 읽음 — 늦게 본 몫을 빼지 않음 · 적어도 판정 박자 한 칸 AI_PLAN.tick) 의 거리 = 지금 거리 − 상대 다가오는 빠르기 × τ.
 *  그 거리가 상대 칼끝 어림 + 0.05 안이고(닿는 칼) · 걷는 뒷걸음 τ 몫으로는 못 빠지고 · 박찬 뒷걸음 τ 몫으로는 빠지면 'read'.
 *  아니면 까닭 — 'far'(안 닿는 칼) · 'walk'(걸어도 빠짐) · 'deep'(박차도 못 빠짐 — 걷는 물러나 피하기 그대로)
 */
export function deBackRead(ai, th, d) {
  const tau = Math.max(th?.tc ?? 0, AI_PLAN.tick);
  const R = ai.foeReach + 0.05;
  const dE = d - Math.max(0, ai.foeClosing ?? 0) * tau;
  if (dE > R) return 'far';
  if (dE + walkGain(tau) > R) return 'walk';
  if (dE + burstGain(tau) <= R) return 'deep';
  return 'read';
}

/**
 * 칼 든 낌새 (띠 높음 · 11/19 — ai.js update 가 스텝마다 · 늦게 본 모습 s · 굴림 없음): preThreat 의 '칼 듦'과 같은 보이는 꼴 —
 *  손을 들어 올림(손 위로 1.6 · 가슴 위) · 오코리(띠 높음 문턱 OKORI.see[3] — AI 몸만 보임) · 느린 감기(손이 자세 바깥쪽으로 OKORI.windV 넘게 · 칼끝은 휘두름 아래 — 사람 몸도).
 *  낌새가 판정 박자 한 칸(AI_PLAN.tick) 넘게 끊겼다가 다시 보이면 새 낌새 — 그때의 위협 번호를 적음(이 낌새 뒤 첫 휘두름을 가리려고)
 */
export function deCueTick(ai, s) {
  const C = ai.deCue;
  if (!C) return;
  const hr = Math.hypot(s.hx, s.hy);
  const out = hr > 1e-3 ? (s.hx * s.hvx + s.hy * s.hvy) / hr : 0;
  const cue = (s.hvy > 1.6 && s.hy > 0.05) || (s.okori ?? 0) >= OKORI.see[3] || (out > OKORI.windV && Math.hypot(s.tvx, s.tvy, s.tvz) < 3.5);
  if (!cue) return;
  const t = ai.sense.t;
  if (t - C.t > AI_PLAN.tick) C.id = ai.threatId;
  C.t = t;
}

/**
 * 상대가 칼을 냈나 (띠 높음 · 11/19 — 읽고 박차기의 첫 문): 달려듦(preThreat 의 charging 과 같은 문턱 0.9) ·
 *  또는 칼 든 낌새를 판정 박자 두 칸(2 × AI_PLAN.tick) 안에 봤고 이 위협이 그 낌새 뒤 첫 휘두름(위협 번호 + 1 안 — 자세 옮김 · 받는 칼 · 물러나며 거두는 칼은 낌새가 없거나 앞 휘두름의 뒤)
 */
export function deCommit(ai, th) {
  if ((ai.foeClosing ?? 0) > 0.9) return true;
  const C = ai.deCue;
  return !!C && !!th && ai.sense.t - C.t <= 2 * AI_PLAN.tick && th.id - C.id <= 1;
}

/** 박찰 기력이 있나 (띠 높음 · 11/19): 쉼 문턱(planRestAt) + 박차기 값(STAMINA.pushCost 12) 위 · 기력 무한이면 늘 */
function burstStamOk(ai) {
  const S = ai.me.stamina;
  return !S || S.infinite || S.value >= ai.planRestAt() + STAMINA.pushCost;
}

/**
 * 박차고 이어 칠 기력이 있나 (띠 높음 · 11/19 §8 — 출발 읽기 · 읽고 박차기): 쉬는 중(staminaRest — 다시 나갈 기력까지 쉼) 아님 ·
 *  쉼 문턱 + 박차기 값 + 베기 값(STAMINA.cutCost 12) 위 — 박찬 뒤 뒤 칼이 기력 쉼에 막히지 않을 때만 박참 (박찬 다음에 그 이득을 취할 다음 동작이 있어야). 기력 무한이면 늘
 */
function leaveStamOk(ai) {
  const S = ai.me.stamina;
  return !S || S.infinite || (!ai.staminaRest && S.value >= ai.planRestAt() + STAMINA.pushCost + STAMINA.cutCost);
}

/** 비기 기력 35 를 남길 때인가 (띠 높음 독일 · 11/19 — ai.js planRestAt): 모르트슐라크로 누르는 동안(몸 붙이기를 정했거나 밀치기 중)만 */
export function deReserve(ai) {
  return !!ai.press && (!!ai.press.go || !!ai.me.barge);
}

/** 상대가 바위 몸(밀치기에 기력 안 씀 — 사람 · AI 일본 jp_tank.js lowShoveFree)인가 */
function rockFoe(ai) {
  return lowShoveFree(ai.foe);
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

/** 밀 몫 0 ~ 0.95 = push × 기울기 × 칸 × (1 + 기력 차) × (파고들기 뒤면 2 — 헛침 → 파고들기 → 밀치기) */
function pushRate(ai) {
  return Math.max(0, Math.min(0.95, D.push * ai.planK * (ai.planC?.push ?? 0) * (1 + deDiff(ai)) * (ai.deDig.after > 0 ? 2 : 1)));
}

/** closeQuarters 가 읽는 밀치기 칸 (인물 칸이 없는 독일 플랜 몸): 밀 몫 pushRate (밀 마음이 이미 났으면 1 — 들어서면 민다) · 찍기 몫 = 공통 AI_PLAN.pommel */
export function deCloseCfg(ai, pommel) {
  const R = ai.deClose;
  R.rate = ai.deDig.push ? 1 : pushRate(ai);
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
 * 파고들기 굴림 몫 (사장님 11/15 결정 (나) '낮음에서도 조금 크게' — D.digLuck): 계획 몫 dig × 기울기 × 칸 에 공통 틀의 굴림 몫(planLuck — 낮음 ⅔ · 가운데 ⅓ · 높음 0 · 1 − 기울기)을 섞음 —
 *  계획 몫 × (1 − 굴림 몫) + 동전(AI_PLAN.coin) × 굴림 몫 × 칸 (무계획 — 헛침을 본 때 셈 없이 동전으로 뛰어듦 · 이베리아 · 무유파와 같은 꼴 · 새 값 없음).
 *  칸 몫 1 에서 낮음 0.2 → 0.4 · 가운데 0.4 → 0.43 · 높음 0.6 그대로. 끄면(0) 계획 몫 그대로
 */
function digP(ai, cell) {
  const p = D.dig * ai.planK * cell;
  const Lk = ai.planLuck ?? 0;
  return Lk > 0 ? p * (1 - Lk) + AI_PLAN.coin * Lk * cell : p;
}

/**
 * 밀 마음 (사장님 11/15 결정 (다) — D.pushNear): 헛침이 내 맞닿기 거리(무기 간격표 contact — 롱소드 1.57 · 거리 오차 포함 · 내가 믿는 거리) 안이면 파고들기 대신
 *  밀 몫(pushRate — 닿는 거리 안 사건과 같은 몫)으로 굴림. 나면 닿는 거리 안이면 곧장 밀고(closeWant), 밖이면 파고들기와 같은 창으로 걸어 들어감
 *  (digT 동안 스틱 앞 끝 · 새 공격 미룸 → afterT 동안 밖이면 걸어 들어감 — deFeet) · 들어서면 굴림 없이 민다(deCloseCfg 1). 새 값 없음. 났으면 true
 *  인물 칸(persona.close)이 있는 몸은 인물 칸 그대로(이 굴림 없음)
 */
function dePushNear(ai, s) {
  const me = ai.me;
  if (ai.persona.close || s.state !== 'stand' || !ai.foe.alive || me.state !== 'stand' || me.barge || ai.closeWant || me.stamina?.exhausted || ai.chasing || ai.Mup) return false;
  const p = pushRate(ai);
  if (!(p > 0)) return false;
  ai.stats.plan.de.pushTry++;
  if (!(Math.random() < p)) return false;
  ai.stats.plan.de.pushGo++;
  if (ai.closeInside) {
    ai.closeWant = true; // 이미 닿는 거리 안 — 지금 민다 (closeQuarters 가 안쪽 · 서 있음을 다시 봄)
    return true;
  }
  const G = ai.deDig;
  G.t = D.digT;
  G.after = D.digT + D.afterT;
  G.push = true;
  return true;
}

/**
 * 파고들기 (watch · seize 앞 — 상대 헛침을 본 한 번에 한 번 굴림): 상대가 휘두른 뒤 손이 멈춤(seize 의 recovering 과 같은 셈 — 늦게 본 모습) ·
 *  내 칼끝 안 아님 · 상대 칼끝 어림 + 1.0 안(두 걸음) → 파고들기 몫(digP)으로 gait.deDigAi(두 걸음 박찬 앞 걸음) + digT 동안 스틱 앞 끝(deFeet). 걸었으면 true ·
 *  내 맞닿기 안 헛침은 밀 마음(dePushNear — pushNear 켬)
 */
export function deDigTry(ai, s, d, recovering) {
  const G = ai.deDig;
  if (!recovering) {
    G.armed = true;
    return false;
  }
  if (!G.armed || G.t > 0) return false;
  G.armed = false;
  if (d < ai.M.contact) return dePushNear(ai, s);
  const C = ai.planC;
  if (!C?.dig || d < ai.M.contact || d > ai.foeReach + 1.0 || s.state !== 'stand' || !ai.me.armed) return false;
  ai.stats.plan.de.digTry++;
  if (!(Math.random() < digP(ai, C.dig))) return false;
  if (!ai.me.gait?.deDigAi?.()) return false;
  G.t = D.digT;
  G.after = D.digT + D.afterT;
  ai.stats.plan.de.dig++;
  return true;
}

/**
 * 파고들기 스틱 (moveFeet — 간 보기 · 물러남 · 막기 · 공격 준비 · 다가감): digT 동안 앞 끝(두 걸음 박찬 앞 걸음 — 그동안 ai.startAttack 이 새 공격을 미룸) · 그 뒤 afterT 동안은 밀치기 거리(붙은 거리 규칙 시작 거리) 밖이면
 *  걸어 들어감(헛침 → 파고들기 → 1 m 안 밀치기 — 안에 들면 closeQuarters 가 밀 몫 × 2 로 굴림 · 밀 마음이 났으면 굴림 없이 민다). 덮었으면 앞뒤 스틱 값 · 아니면 null
 */
export function deFeet(ai, dt, d, startD) {
  const G = ai.deDig;
  if (G.after > 0) G.after -= dt;
  if (G.push && (!(G.after > 0) || ai.closeWant || ai.me.barge)) G.push = false; // 밀 마음은 밀거나 창이 끝나면 지움
  if (G.t > 0) {
    G.t -= dt;
    if (d >= startD) return 1;
    G.t = 0;
  }
  if (G.after > 0 && !ai.closeInside && d > startD && !ai.me.barge) return 1;
  return null;
}

/**
 * 출발 읽기 (띠 높음 · [사장님 11/19 결정] '권고대로' — 상대 칼이 떠나는 순간을 읽고 그때 박참 · 기록 docs/strike/burst_whiff_2026-11-19.md §8):
 *  사람과 같은 눈 — 늦게 본 모습 s (반응 시간 그대로 · 칼이 나가기 시작하는 것은 내다보지 않음)와 앞질러 본 몸 거리 d (몸 움직임만 반응 시간 × predict 만큼 — ai.js 와 같은 셈).
 *  ① 감아 든 꼴: 칼 든 낌새(deCue — 손 듦 · 오코리 OKORI.see 띠 문턱 · 느린 감기 · 사람 몸도 보임)를 판정 박자 두 칸 안에 봄 · 감은 상대가 한 박자 안에 칠 거리
 *     (deBackRead τ = AI_PLAN.beat 가 'far' 아님 — 멀리서 감은 꼴은 가까이 올 때 읽음). 꼴 하나에 한 번 읽기 굴림 OKORI.read × 띠 기울기
 *     (planK — 숙련도에 따라 읽기 정확도). 읽었으면 그 꼴 동안 간 보기 · 물러남 걸음을 세우고 섬(set — ai.js moveFeet): 서 있다가 뒤로 밀면 첫 걸음을 박차는 G1 그대로라
 *     박차는 때에 박찬 걸음을 곧장 뗌 (걷는 중이면 디디던 걸음이 끝나야 뗌 — 사람은 서 있을 때만 박참).
 *  ② 칼이 떠나는 때: 감아 든 상대 몸이 그 칼이 떠나면 닿는 거리에 듦 — deBackRead(τ = 판정 박자 한 칸 — 떠난 칼이 나에게 닿기까지 · 박찬 걸음을 떼기까지) 가 'read'
 *     (닿는 칼 · 걸어선 못 빠짐 · 박차면 빠짐). 감은 상대는 칠 거리(맞닿기 + 기술 걸음)에 들면 칼을 내므로 박찬 걸음이 칼이 떠나는 때와 겹침 —
 *     칼이 나가는 것을 본 뒤(반응 시간 + 걸음 떼는 시간)엔 칼이 이미 닿거나 지나감(사람 시험대 '보고 0.2 s 뒤'와 같은 꼴 · §5).
 *  ③ 박차고 이어 칠 기력(leaveStamOk) · 국면 칸 back 몫 → 박참 (ai.js voidBurst — 물러나 피하기 꼴로) · 뒤 칼 기다림(deNach) — 꼴 하나에 한 번. 박찼으면 true.
 *  박찬 걸음과 상대 칼이 나가는 때가 겹치면 그 칼이 박찬 칼(burst_whiff.js bwAtkStart · bwBurst) · 몸에 안 닿고 끝나면 상대가 0.6 s 굳음 → 뒤 칼(deNachTick)이 그 창에
 */
export function deLeaveTick(ai, s, d, th) {
  const L = ai.deLeave;
  if (!L) return false;
  const st = ai.stats.plan.de;
  const coil = ai.sense.t - (ai.deCue?.t ?? -Infinity) <= 2 * AI_PLAN.tick;
  if (!coil) {
    L.on = L.set = false;
    return false;
  }
  if (deBackRead(ai, { tc: AI_PLAN.beat }, d) === 'far') {
    L.set = false; // 감은 상대가 한 박자(AI_PLAN.beat) 안에 칠 거리 밖 — 아직 읽지 않음 (가까이 오면 그때 그 꼴을 읽음)
    return false;
  }
  if (!L.on) {
    L.on = true;
    L.done = false;
    L.ok = Math.random() < OKORI.read * ai.planK;
    st.leaveSee++;
    if (L.ok) st.leaveRead++;
  }
  L.set = L.ok && !L.done;
  const C = ai.planC;
  if (!L.set || !C?.back || deBackRead(ai, { tc: AI_PLAN.tick }, d) !== 'read' || !leaveStamOk(ai)) return false;
  L.done = true; // 이 꼴에서 박찰지는 한 번만 굴림
  L.set = false;
  if (!(Math.random() < C.back) || !ai.me.gait?.backBurstAi?.()) return false;
  ai.deDig.t = ai.deDig.after = 0; // 걸어 둔 파고들기 앞 끝 스틱(deFeet — 걸음 · 뒤 밀치기 창)은 거둠 — 박찬 걸음이 뒤로 떼어지게
  st.leave++;
  st.back++;
  ai.deNach = { t0: ai.sense.t, tau: 2 * AI_PLAN.tick, until: ai.sense.t + 2 * AI_PLAN.beat, w0: ai.me.wounds?.length ?? 0, f0: ai.me.fightT ?? 0, lift: false, seen: !!th, thId: th?.id ?? null, vT: 0, voided: false, fired: false, seq: -1, fw0: 0, dig: false };
  return true;
}

/**
 * 뒤 박차기 (respond — 물러나 피하기로 정한 위협 th · 본 거리 d):
 *  띠 낮음 · 가운데 = back × 기울기 × 칸 몫으로 gait.backBurstAi (굴림은 이때만 — 11/14 그대로)
 *  띠 높음 (11/19) = 읽고 박차기: deBackRead 가 'read' 이고 박차고 이어 칠 기력(leaveStamOk)이 있을 때만 칸 몫(back 칸)으로 박참 → 뒤 칼 기다림(deNach)을 엶. 아니면 박차지 않고 걷는 물러나 피하기 그대로
 */
export function deBack(ai, th, d) {
  const C = ai.planC;
  if (!master(ai)) {
    if (!C?.back || !(Math.random() < D.back * ai.planK * C.back)) return false;
    if (!ai.me.gait?.backBurstAi?.()) return false;
    ai.stats.plan.de.back++;
    return true;
  }
  const st = ai.stats.plan.de;
  if (!C?.back) return false;
  st.backSee++;
  const why = deBackRead(ai, th, d);
  if (why !== 'read') {
    st[`back${why[0].toUpperCase()}${why.slice(1)}`]++;
    return false;
  }
  if (!deCommit(ai, th)) {
    st.backCue++;
    return false;
  }
  if (!leaveStamOk(ai)) {
    st.backStam++;
    return false;
  }
  if (!(Math.random() < C.back) || !ai.me.gait?.backBurstAi?.()) return false;
  ai.deDig.t = ai.deDig.after = 0; // 걸어 둔 파고들기 앞 끝 스틱(deFeet — 걸음 · 뒤 밀치기 창)은 거둠 — 박찬 걸음이 뒤로 떼어지게 (11/19 §8)
  st.back++;
  ai.deNach = { t0: ai.sense.t, tau: Math.max(th?.tc ?? 0, AI_PLAN.tick), until: ai.sense.t + 2 * AI_PLAN.beat, w0: ai.me.wounds?.length ?? 0, f0: ai.me.fightT ?? 0, lift: false, seen: !!th, thId: th?.id ?? null, vT: 0, voided: false, fired: false, seq: -1, fw0: 0, dig: false };
  return true;
}

/**
 * 뒤 칼 (띠 높음 · 11/19 — 나흐라이젠 · 나흐슐라크): 읽고 박찬 뒤 2 박자(AI_PLAN.beat × 2 = 1.32 게임 초) 안에 —
 *  박찬 걸음을 뗀 뒤 내가 맞지 않은 채 그 칼을 비꼈으면(backVoid) 곧장 다시 들어가 침. 비낌 = 늦게 본 모습(th)에 나를 겨눈 칼이 보였다가 지금 안 보임(그 칼이 나를 지나감 —
 *  상대 칼의 뒤따름 동안 들어가기 시작해야 굳은 창에 닿음) · 아직 한 번도 안 보였으면 걸음을 뗀 뒤 그 칼이 가장 가까워질 어림 초(tau)가 지나도록 오는 칼이 없음.
 *  들어가는 동안(준비 · 다가감) 비낀 그 칼의 꼬리(같은 휘두름 번호 · 방향이 한 번 꺾인 번호 — 판정 박자 두 칸 안)는 다시 막지 않음(deNachKeep — 박찬 다음 동작을 잇는 결단)
 *  (11/19 [사장님 결정] 뒤 박차기 헛침 경직 — 헛친 상대는 그 칼이 끝난 뒤 0.6 s 굳음(burst_whiff.js) · 그 창에 닿게 비낀 순간 바로 · 전 판은 상대 손이 멎은 틈 recovering 까지 기다림):
 *  'recover' 공격(독일 꾸러미에서 고름 · 빠른 준비 · 오코리 없음 opt.nach — 박찬 걸음에서 곧장 이어 가는 칼) · 내 맞닿기 거리 밖이면 그 칼의 준비 · 다가감 동안
 *  두 걸음 박찬 앞 걸음(gait.deDigAi — 파고들기와 같은 장치 · 박찰 기력이 있을 때 · 박찬 몸이 다 멈추기 전(burstBrake)엔 걸음 장치가 안 받음 — 사람과 같음 · 받을 때까지 다시 걺)과
 *  스틱 앞 끝(deDig.t — 파고들기와 같은 deFeet 몫). §8 (11/19 '박찬 다음에는 실제 그로 인한 이득이 취해지도록 다음 동작을 연계') — 박찬 몸이 뒤로 실려 가는 동안 준비를 해 두고 멈추는 대로 박차 들어감.
 *  상대 칼끝 어림 + 1.0(두 걸음) 밖 · 붙은 거리 안 · 상대가 서 있지 않음이면 내지 않음. 낸 칼이 끝나면 그 칼이 낸 상처를 셈(재기). 냈으면 true
 */
export function deNachTick(ai, s, d, th) {
  const N = ai.deNach;
  if (!N) return false;
  const st = ai.stats.plan.de;
  const me = ai.me;
  const foe = ai.foe;
  if (N.fired) {
    if (ai.mode === 'attack' && ai.atkSeq === N.seq) {
      if (N.dig && (ai.phase === 'windup' || ai.phase === 'approach') && d > ai.M.contact && burstStamOk(ai) && me.gait?.deDigAi?.()) N.dig = false;
      return false;
    }
    const w = (foe.wounds?.length ?? 0) - N.fw0;
    if (w > 0) st.nachHit++;
    st.nachW += Math.max(0, w);
    ai.deNach = null;
    return false;
  }
  if ((me.wounds?.length ?? 0) > N.w0) {
    st.backHit++;
    ai.deNach = null;
    return false;
  }
  if (ai.sense.t > N.until) {
    ai.deNach = null;
    return false;
  }
  if (!N.lift) {
    // 박찬 걸음을 뗐나 (burst_whiff.js 가 뗀 때를 적음 — 내 몸) · 걸음 장치가 그 박차기를 안 쓰고 버렸으면 뒤 칼도 없음 · 떼기 전엔 비낌을 보지 않음 (뒤 칼이 박찬 걸음을 덮지 않게)
    if ((me.bwBurstAt ?? -Infinity) >= N.f0) {
      N.lift = true;
      N.t0 = ai.sense.t; // 비낌 어림(tau)은 걸음을 뗀 때부터
      N.until = Math.max(N.until, N.t0 + 2 * AI_PLAN.beat);
    } else {
      if (!me.gait?.burst) ai.deNach = null;
      return false;
    }
  }
  if (!N.voided) {
    if (th) {
      N.seen = true;
      N.thId = th.id;
      return false;
    }
    if (!N.seen && ai.sense.t - N.t0 < N.tau) return false;
    N.voided = true;
    N.vT = ai.sense.t;
    st.backVoid++;
  }
  if (ai.mode === 'attack' || ai.secretRun || !foe.alive || s.state !== 'stand' || me.state !== 'stand' || !me.armed || d > ai.foeReach + 1.0 || d < ai.M.clinch) return false;
  const t = ai.pickTech(s, 'recover');
  if (!t || !ai.startAttack(t, 'recover', { noFeint: true, fastChamber: true, nach: true })) {
    st.nachLost++;
    ai.deNach = null;
    return false;
  }
  N.fired = true;
  N.seq = ai.atkSeq;
  N.fw0 = foe.wounds?.length ?? 0;
  if (d > ai.M.contact) {
    ai.deDig.t = D.digT; // 스틱 앞 끝 (deFeet — 공격 준비 · 다가감에서)
    N.dig = !(burstStamOk(ai) && me.gait?.deDigAi?.());
  }
  st.nach++;
  return true;
}

/**
 * 뒤 칼을 들어가는 동안 이 위협은 비낀 칼의 꼬리인가 (ai.js 공격 준비 · 다가감의 respond 앞 — 11/19 §8): 낸 뒤 칼이 아직 준비 · 다가감이고 ·
 *  위협 번호가 비낄 때 본 번호 + 1 안(같은 휘두름 · 칼 방향이 한 번 꺾임 — 뒤따름) · 비낀 뒤 판정 박자 두 칸 안 → 막지 않고 그대로 들어감
 */
export function deNachKeep(ai, th) {
  const N = ai.deNach;
  return !!N && N.fired && N.thId != null && ai.atkSeq === N.seq && th.id <= N.thId + 1 && ai.sense.t - N.vT <= 2 * AI_PLAN.tick;
}

/**
 * G6 무릎 꺾기 뒤 끝내기 (11/19 사장님 '권고대로' — 기록 docs/strike/de_band3_2026-11-19.md §G6 · 단계 덜어 보기 §2-2 안): 내 곁눈 베기가 상대 무릎을 꺾었으면
 *  (foe.buckleAt 이 바뀜 — 내 칼이 낸 사건 · 꿇는 몸은 눈에 보임) 늦게 본 모습(s)에 상대가 서 있지 않은 동안(꿇음 0.6 s + 일어남 — 그 한 번) 다음 간 보기 박자를 기다리지 않고
 *  곧장 '끝내기' 공격(pickTech 'finish' — 위에서 내려치기 쪽 · 빠른 준비). 늦게 본 모습이 다시 서 있으면 그 꺾음은 끝. 간 보기에서 칠 거리(holdDist + watchReachOut) 밖 ·
 *  내가 서 있지 않음 · 칼 없음이면 내지 않음(다음 스텝 다시 봄). chain = afterStrike 에서 부르면 이어 치기 번호 (간 보기 · 물러남은 0). 냈으면 true
 */
export function deKnee(ai, s, d, chain = 0) {
  const K = ai.deKnee;
  if (!K) return false;
  const b = ai.foe.buckleAt;
  if (b != null && b !== K.at) {
    K.at = b;
    K.live = true;
    K.seen = false;
    ai.stats.plan.de.knee++;
  }
  if (!K.live) return false;
  if (s.state === 'stand') {
    if (K.seen) K.live = false;
    return false;
  }
  K.seen = true;
  const me = ai.me;
  if (!ai.foe.alive || me.state !== 'stand' || !me.armed || ai.secretRun || d > ai.holdDist() + ai.watchReachOut()) return false;
  const o = chain ? { chain, noFeint: true, fastChamber: true } : { noFeint: true, fastChamber: true };
  if (!ai.startAttack(ai.pickTech(s, 'finish'), 'finish', o)) return false;
  K.live = false;
  ai.stats.plan.de.kneeGo++;
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

