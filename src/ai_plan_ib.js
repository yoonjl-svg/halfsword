// ─────────────────────────────────────────────────────────────
//  유파 AI 기본 전투 흐름 2 단계 — 이베리아 플랜 (11/14 — 사장님 '이베리아 = 거칠고 모험적인 슬러거' · 설계안 docs/design/ai_school_baseline_2026-11-14.md §3-5 ·
//   기록 docs/strike/ai_plan_ib_2026-11-14.md · 표 src/ai_plan.js SCHOOL_PLAN.iberian · 값 config AI_PLAN.ib)
//
//  플랜: 넓게 돌며(옆 박차기) 비스듬히 들어가 큰 칼을 되도록 멈추지 않고 이어 친다(이어 돌리기 0.4 s 머리 위 원 · 셋째 칼 기력 0 · 원 동안 한 대 버팀 — 맞바꿈).
//   사슬이 끝나면 내 칼끝 밖으로 빠져 알티바슈 포르트를 무장했다가 들어오는 상대에 내려친다.
//  모두 기울기(사장님 11/14 '절대적 규칙은 빼'): 칸 값 × 띠 세기(planK)를 확률 · 곱으로만 쓴다 — '사슬을 늘 이음'이 아니라 '이을 마음이 큼'.
//  무 · 낮음 = '더 전략 없이 행운에 기대는 전투'(굴림 몫 planLuck — 무모 · 무계획 · 성급함 아님): 원을 아무 때나 · 이어 칠지 동전 쪽 · 기력 계획 없음(옆 박차기도 기력을 안 봄) · 고노센 선을 무모하게 넘음(11/14 합침 — 네 유파 같은 규칙 하나로: ai.js gnsWatch W.reck · 이 파일엔 없음).
//  변칙성 (11/14 둘째 — 사장님 '이베리아의 특성에 변칙성을 추가하고 그 맥락에서 종종 사이드스텝을 쓰게 해'): 들어가는 각 · 박자 · 걸음이 고르지 않음 — 곧게 들어가지 않고
//   비스듬히 · 옆으로 돌아 들어감 · 돌기 박자가 흔들림 · 원과 옆 박차기가 섞임. 원전: 피게이레두 1651 단ⅩⅢ 「walking like a screw over the left」 · 고디뉴 1599 규칙 10
//   「sich selbst im Rad herumdrehend」(바퀴처럼 몸을 돌리며) — 몬탄테는 둘레를 쓸며 자리를 바꾸는 칼 · 이베리아 둥근 · 옆걸음(에텐하르트 1675 원서 55 ~ 56 쪽 — 이 유파 걸음 칸 schools.js IBERIAN_GAIT).
//   옆 박차기 때: 돌기 박자에 각을 바꿀 때 · 상대 칼이 들어올 때 선 밖으로 · 사슬이 끝나고 빠질 때 · 상대가 되풀이하는 수에 맞춰 비켜 꾐(높음) → 나선 걸음 베기(사람 B2 · B3 와 같은 장치)
//  ai.js 는 플랜 표에 ib 표식이 있을 때만(this.ibPlan) 이 파일의 셈을 부른다 — 다른 유파 · 옛 판(`?aiPlan=0` · `?aiPlanIb=0`)은 한 줄도 안 탄다(굴림 그대로).
//  연산: 스텝마다 새 객체 · 배열 없음(옆 박차기 칸 · 버릇 고리 버퍼는 AI 하나에 한 번) · 탐색 없음. 반사 층(막기 · 피하기 · 맞받기 · 비기)은 건드리지 않는다.
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, IB_LINK, IB_FLOW, SECRET, STAMINA, GAIT } from './config.js';
import { bandOf, axesOf } from './ai_plan.js';
import { secretSpent } from './secret.js';
import { padDist } from './ai_techniques.js';
import { readAtkN } from './ai_read.js'; // 3 단계 (11/14): 되풀이 기억은 공통 읽기 그릇 하나로

const MEM = 4; // 버릇 고리 버퍼 칸 — 상대가 내 원(이어 돌리기) 사이를 친 때 (10 s 창에 넉넉)
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** 재기 칸 (AI 하나에 한 번) */
export function ibStats() {
  return { cont: 0, end: 0, spinPick: 0, nearPick: 0, out: 0, outArmed: 0, goIn: 0, dash: 0, slant: 0, lure: 0, habit: 0, freeWant: 0, tryCircle: 0, tryDodge: 0, tryEnd: 0, bait: 0, odd: 0, jitter: 0, dashGo: 0 };
}

/** 플랜이 이베리아(ib 표식)인 AI 를 차린다 — 생성자에서 한 번 (this.plan 을 정한 뒤) */
export function ibInit(ai) {
  const A = axesOf(ai.proficiency, 'iberian');
  ai.ibPlan = {
    read: A.read.school, // 상대 유파 — 원을 시작하는 거리 (가운데부터)
    habit: A.read.habit, // 버릇 — 원 사이를 치는 상대 (가운데 6.0 s)
    repeat: A.read.repeat, // 되풀이 — 10.0 s 안에 두 번 (높음)
    mem: A.read.mem,
    hitT: new Float64Array(MEM).fill(-Infinity),
    hitI: 0,
    inLink: false,
    linkHit: false,
    trade0: null,
    dash: { on: false, side: 0, t: 0, done: false },
    slantT: -Infinity,
    slantArmed: false,
    out: false,
    outUntil: 0,
    beatT: 0,
    lureArmed: true,
    lureT: -Infinity,
    lastCircle: 0, // 지난 돌기 쪽 (각을 바꿈 — 옆 박차기)
    dodgeId: -1, // 옆 박차기로 비킨 상대 칼 번호 (칼 하나에 한 번 굴림)
    charge: false, // 상대 달려듦 (오르는 때 한 번 굴림)
    ang: 0, // 비스듬히 들어감 — 이 공격의 옆 스틱 쪽 (0 = 곧게)
    angSeq: -1,
  };
  ai.stats.ib = ibStats();
  if (AI_PLAN.ib.chainBody) ai.me.ibChainAi = true; // B6 이어지는 흐름 — 사람과 같은 규칙 (fighter.js ibChainOn)
}

/** 맞바꿈(B12)이 남았나 — 이번 사슬에서 안 썼고 기력이 베기 한 번 값 이상 (내 몸 — 읽기만) */
export function swapReady(me) {
  if (!IB_LINK.trade || me.ibTradeUsed) return false;
  const S = me.stamina;
  return !STAMINA.on || !S || S.infinite || S.value >= STAMINA.cutCost * (S.weight ?? 1);
}

/** 다음 칼이 세 칼마다 기력 0 칼인가 (B6 — 몸이 그 셈을 받을 때만 · fighter.js ibChainCostK 와 같은 셈 · 읽기만) */
export function nextFree(me) {
  const every = IB_FLOW.freeEvery | 0;
  if (!(every > 0) || !me.ibChainOn?.()) return false;
  const n = (me.ibFlowChainNow?.() ?? -1) >= 0 ? (me.ibLastN ?? 0) + 1 : 0;
  return n > 0 && (n - (me.ibChainN0 ?? 0) + 1) % every === 0;
}

/** 버릇 · 되풀이 — 기억 창(가운데 6.0 · 높음 10.0 s) 안에 상대가 내 원 사이를 친 수 */
export function habitN(ai) {
  const I = ai.ibPlan;
  if (!I.habit) return 0;
  const t0 = ai.sense.t - I.mem;
  let n = 0;
  for (let i = 0; i < MEM; i++) if (I.hitT[i] > t0) n++;
  return n;
}

/**
 * 수 읽기 — 상대 유파에 맞춰 원을 시작하는 거리 (가운데부터 · 높음일수록 또렷): 원(0.4 s · 막기 못 함)을 이 거리에서 시작하면 위험한가 → 원을 고를 몫의 곱.
 *  이탈리아(맞박자 — 걸어 들어오는 몸 · 원 사이를 찌름): 그 칼끝 어림 안이면 덜 · 독일(파고들기 — 헛친 칼 뒤 두 걸음): 앞 칼이 헛쳤고 맞닿기보다 멀면 덜. 상대 유파는 칼로 보임
 */
export function schoolRead(ai, d) {
  if (!ai.ibPlan.read) return 1;
  const t = ai.foe.swordArt?.tradition;
  const cut = 1 - AI_PLAN.ib.readCut * ai.planK;
  if (t === 'italian') return d < ai.foeReach ? cut : 1;
  if (t === 'german') return !ai.hitLanded && !ai.bound && d > ai.M.contact ? cut : 1;
  return 1;
}

/**
 * 원(이어 돌리기)으로 큰 칼을 이을 몫 (이어 치기 기술 고르기의 곱 · 0 이면 원 후보 없음):
 *  계획 몫 = 띠 세기 × 칸 spin × 맞바꿈(남았으면 × (1 + swap) · 썼으면 × (1 − swap ÷ 2)) × 상대 유파 거리 × 버릇(남았으면 꾀어 맞바꿈 · 썼으면 덜 — 되풀이면 두 번 곱)
 *  무계획(굴림 몫 Lk): 계획 몫 × (1 − Lk) + 동전(coin) × Lk — 원을 아무 때나 (맞바꿈 · 거리를 덜 셈 — 무모)
 */
export function spinK(ai, d) {
  const me = ai.me;
  if (!IB_LINK.ai || !me.sword || !me.armed || me.weaponBroken || me.state !== 'stand') return 0;
  const C = ai.planC;
  const k = ai.planK;
  const Lk = ai.planLuck;
  const sw = C?.swap ?? 0;
  const left = swapReady(me);
  let c = left ? 1 + sw : 1 - 0.5 * sw;
  c *= schoolRead(ai, d);
  const n = habitN(ai);
  if (n >= 1) {
    const f = left ? 1 + 0.5 * k : 1 - AI_PLAN.ib.readCut * k;
    c *= ai.ibPlan.repeat && n >= 2 ? f * f : f;
  }
  return k * (C?.spin ?? 0) * c * (1 - Lk) + AI_PLAN.coin * Lk;
}

/** 알티바슈 무장 쪽 몫 (높음 — 비기가 남았을 때): 띠 세기 × 칸 arm × 남은 기력 몫(비기 몫 35 위 — 알티바슈 위력 = 남은 기력 몫이라 기력이 많을수록 무장 · 적을수록 사슬) */
export function armK(ai) {
  const me = ai.me;
  if (!ai.spinArm || !ai.secret?.do?.altib || secretSpent(me) || !me.stamina?.secretReady) return 0;
  const S = me.stamina;
  const share = STAMINA.on && !S.infinite ? clamp((S.value - STAMINA.secretCost) / Math.max(1, S.max - STAMINA.secretCost), 0, 1) : 1;
  return ai.planK * (ai.planC?.arm ?? 0) * share;
}

/**
 * 사슬을 이을 마음 (afterStrike 의 이어 칠 몫 want — 옛 판과 같은 바탕에서): 기울기를 얹은 몫 (0 ~ 1)
 *  ① 이을 마음: + (1 − want) × chainKeep × 띠 세기 × 칸 chain × (½ + ½ × 이은 칼 몫 — 사슬이 이어질수록) · 막혀도 헛쳐도 같은 몫
 *  ② 기력(가운데부터): 다음 칼이 기력 0 칼이면 + (1 − want) × ½ × 띠 세기 · 높음 + 알티바슈가 남음: × (1 − ½ × 무장 쪽 몫)
 *  ③ 불리 · 맞바꿈을 쓴 뒤: × (1 − ½ × 띠 세기) — 쓴 뒤 맞으면 빠지는 쪽 · 유도 ① 뒤 상대가 걸어 들어오면 + (1 − want) × 띠 세기 — 다음 칼로 받아침
 *  ④ 무계획(굴림 몫): × (1 − Lk) + coin × Lk
 */
export function chainWant(ai, base, aK = armK(ai)) {
  const C = ai.planC;
  const k = ai.planK;
  const I = ai.ibPlan;
  let w = Math.min(1, base);
  w += (1 - w) * AI_PLAN.ib.chainKeep * k * (C?.chain ?? 0) * (0.5 + 0.5 * Math.min(1, ai.chain / 2));
  if (bandOf(ai.proficiency) >= 2 && nextFree(ai.me)) {
    w += (1 - w) * 0.5 * k;
    ai.stats.ib.freeWant++;
  }
  w *= 1 - 0.5 * aK;
  if (ai.planPh === 'behind' && ai.me.ibTradeUsed) w *= 1 - 0.5 * k;
  if (ai.sense.t - I.lureT < 2 * AI_PLAN.beat && ai.foeClosing >= GAIT.walkMin) w += (1 - w) * k;
  const Lk = ai.planLuck;
  if (Lk > 0) w = w * (1 - Lk) + AI_PLAN.coin * Lk;
  return w;
}

/** 이어 칠 칼: 지금 손에서 바로 이어지는 칼(옛 판과 같은 셈) + 원으로 이을 큰 칼(시작 자리가 가슴 높이 이상인 베기 — 손이 멀어도 이어 돌리기가 머리 위로 넘김) */
export function nextTech(ai, d) {
  const me = ai.me;
  const hand = [me.handOffset.x, me.handOffset.y];
  const S = spinK(ai, d);
  let best = null;
  let bestW = -1;
  let spin = false;
  for (const t0 of ai.school.tech) {
    const t = ai.techNow(t0);
    if (!t || t0 === ai.tech || t === ai.tech) continue;
    const cd = padDist(hand, t.from);
    const far = cd > 0.35;
    if (far && !(S > 0 && t.kind === 'cut' && t.from[1] > 0)) continue;
    const w = ai.pers.techPref[t0.name] * t.base * (far ? S : Math.exp(-cd / 0.2)) * rand(0.6, 1.4);
    if (w > bestW) {
      bestW = w;
      best = t;
      spin = far;
    }
  }
  if (best) ai.stats.ib[spin ? 'spinPick' : 'nearPick']++;
  return best;
}

/**
 * afterStrike 의 이어 치기 · 물러남 (패시브 굴림 뒤 — 옛 판의 이어 칠 굴림 자리를 이베리아 셈으로): 늘 true (이어 쳤거나 물러남을 시작함)
 *  이을 수 있는 칼 수 = 옛 판(2 · 집념 3) + B6 세 칼 셈 × 띠 세기(낮음 1 · 가운데 2 · 높음 3 — 반올림) · 거리 창은 옛 판 그대로.
 *  사슬 끝: 옛 판처럼 물러남 · 알티바슈 무장 쪽 몫(armK)이면 그 몫의 확률로 '칼끝 밖 무장 기다림'(무장 2 s + 0.6 s 동안 먼저 치지 않고 내 칼끝 밖 + outStep 에 섬)
 *  유파 기력 장치(가운데부터): 다음 칼이 세 칼마다 기력 0 칼이면 쉼 문턱(staminaRest)이 그 칼을 막지 않음 — 기력 0 칼이라 (탈진은 그대로 막음 · 이을지는 위 굴림 그대로)
 */
export function ibAfter(ai, d) {
  const L = ai.level;
  const st = ai.stats.ib;
  const more = Math.round((IB_FLOW.freeEvery | 0) * ai.planK);
  const can = ai.chain < (ai.obsession > 0.5 ? 3 : 2) + more && d < ai.M.reach + 0.1 && d > ai.M.clinch - 0.5 && ai.foe.alive;
  const base = (ai.hitLanded || ai.bound ? L.followUp : L.followUp * 0.4) + 0.2 * ai.anger;
  const aK = armK(ai);
  if (can && Math.random() < chainWant(ai, base, aK)) {
    const t = nextTech(ai, d);
    const rest = ai.staminaRest;
    if (rest && bandOf(ai.proficiency) >= 2 && nextFree(ai.me)) ai.staminaRest = false;
    const ok = !!t && ai.startAttack(t, 'follow', { chain: ai.chain + 1, noFeint: true });
    ai.staminaRest = rest;
    if (ok) {
      ai.stats.followUps++;
      st.cont++;
      return true;
    }
  }
  st.end++;
  ai.patience = Math.max(ai.patience, rand(0.45, 0.75) * (1 - 0.7 * ai.anger));
  ai.startWithdraw(0.9 - 0.4 * ai.obsession);
  const cd = ai.planC?.dash ?? 0; // 사슬 끝 — 옆으로 박차 빠짐 (변칙 · 곧게 물러나지 않음)
  if (cd > 0) {
    st.tryEnd++;
    if (Math.random() < mixP(ai, ai.planK * cd * AI_PLAN.coin, cd)) dashStart(ai, Math.sign(ai.circle) || ai.pers.circleDir);
  }
  if (aK > 0 && Math.random() < aK) {
    const I = ai.ibPlan;
    I.out = true;
    I.outUntil = ai.sense.t + SECRET.ibSpin.armTime + SECRET.ibSpin.armGrace;
    st.out++;
  }
  return true;
}

/** 옆 박차기를 걺 (사람 B2 와 같은 장치 — 걷는 중에 gait.sideDash · 스틱 옆 끝 dashT): 간 보기 · 물러남 · 막기 꼴 · 서 있음. 가운데부터는 기력이 쉼 문턱 + 박차기 값(12)보다 많을 때만 — 무 · 낮음은 기력을 안 봄(무계획). 걸었으면 true */
function dashStart(ai, side) {
  const D = ai.ibPlan.dash;
  if (D.on || !side || ai.chasing || ai.me.state !== 'stand' || !ai.me.gait || !(ai.mode === 'watch' || ai.mode === 'withdraw' || ai.mode === 'defend')) return false;
  const S = ai.me.stamina;
  if (bandOf(ai.proficiency) >= 2 && STAMINA.on && S && !S.infinite && S.value < ai.planRestAt() + STAMINA.pushCost) return false;
  D.on = true;
  D.side = Math.sign(side);
  D.t = 0;
  D.done = false;
  ai.stats.ib.dashGo++;
  return true;
}

/** 무계획 몫을 섞은 확률: 계획 몫 × (1 − 굴림 몫) + 굴림 몫 × coin × 칸 (무 · 낮음은 '아무 때나') */
function mixP(ai, planned, cell) {
  const Lk = ai.planLuck;
  return planned * (1 - Lk) + Lk * AI_PLAN.coin * cell;
}

/** 되풀이 (높음) — 기억 창 안에 상대가 칼을 낸 수 */
export function foeAtkN(ai) {
  return ai.ibPlan.repeat ? readAtkN(ai, AI_PLAN.read.repeatT) : 0; // 공통 읽기 그릇 (3 단계 — 상대가 낸 칼은 readTick 이 적음)
}

/** 전략 층 덧칸 (스텝마다 — planTick 뒤): 버릇 기억 · 옆 박차기 진행 · 무장 기다림 끝 · 상대 칼 · 달려듦에 선 밖으로 비킴 · 비스듬히 들어감 (굴림은 사건 하나에 한 번) */
export function ibTick(ai, dt, th, hurt) {
  const I = ai.ibPlan;
  const me = ai.me;
  if (me.ibLink) {
    if (!I.inLink) {
      I.inLink = true;
      I.linkHit = false;
      I.trade0 = me.ibTradeHit ?? null;
    }
    if (!I.linkHit && (th || hurt || (me.ibTradeHit ?? null) !== I.trade0)) {
      I.linkHit = true; // 원 한 번에 한 번 — 상대가 원 사이를 노려 들어옴 (본 위협 · 맞음 · 넘긴 맞음)
      I.hitT[I.hitI] = ai.sense.t;
      I.hitI = (I.hitI + 1) % MEM;
      ai.stats.ib.habit++;
    }
  } else I.inLink = false;
  // 상대가 칼을 냄 (본 위협 — 새 번호): 되풀이 기억 · 선 밖으로 비킴 (칼 하나에 한 번 굴림)
  const charge = ai.foeClosing > 0.9 && ai.d < ai.foeReach + 0.9; // 달려듦 (preThreat 와 같은 수 · 위협을 보는 거리 — threat 와 같은 상대 칼끝 어림 + 0.9 안)
  const C = ai.planC;
  const cd = C?.dash ?? 0;
  if (cd > 0 && ((th && th.id !== I.dodgeId) || (charge && !I.charge)) && ai.mode !== 'attack' && ai.mode !== 'secret') {
    if (th) I.dodgeId = th.id;
    ai.stats.ib.tryDodge++;
    if (Math.random() < ai.planK * cd * AI_PLAN.coin * (1 - ai.planLuck)) { // 위협 줄을 읽고 비킴 — 가운데 · 높음 몫 (무 · 낮음은 덜 읽음)
      const L = th?.line ?? '';
      dashStart(ai, L.endsWith('L') ? 1 : L.endsWith('R') ? -1 : Math.sign(ai.circle) || ai.pers.circleDir); // 내 왼쪽으로 오는 칼이면 오른쪽으로
    }
  }
  I.charge = charge;
  // 비스듬히 들어감 (변칙 — 새 공격 하나에 한 번): 준비 · 다가가는 동안 옆 스틱을 얹어 곧게 들어가지 않음
  if (ai.mode === 'attack' && ai.atkSeq !== I.angSeq) {
    I.angSeq = ai.atkSeq;
    I.ang = 0;
    const ko = C?.odd ?? 0;
    if (ko > 0 && !ai.chain && !ai.secretRun && !ai.chasing && Math.random() < mixP(ai, ai.planK * ko, ko)) {
      I.ang = Math.random() < 0.5 ? 1 : -1;
      ai.stats.ib.odd++;
    }
  } else if (ai.mode !== 'attack') I.ang = 0;
  const D = I.dash;
  if (D.on) {
    if (ai.mode !== 'watch' && ai.mode !== 'withdraw' && ai.mode !== 'defend') D.on = false;
    else {
      if (!D.done && me.gait?.walking && (D.done = !!me.gait.sideDash?.(D.side))) {
        ai.stats.ib.dash++; // 박찬 걸음이 걸림 (걷는 중에만 — gait.js sideDash)
        I.slantT = ai.sense.t + AI_PLAN.ib.dashT - D.t; // 나선 걸음 베기 창: 박찬 때부터 박차기 끝 + 2 beat (1.2 s) 까지
        I.slantArmed = true;
      }
      if ((D.t += dt) >= AI_PLAN.ib.dashT) D.on = false;
    }
  }
  if (I.out && (ai.sense.t > I.outUntil || !ai.spinArm)) I.out = false;
}

/**
 * 옆으로 돌기 박자 (moveFeet — 옛 돌기 굴림 x 를 그대로 씀 · 그 박자에 한 번): 넓게 돎 — 멈출 몫이 줄고(0.45 × (1 − ½ kw)) 옆걸음이 큼(× (1 + ½ kw)) ·
 *  옆 박차기 — 거리 다툼(간 보는 거리 + 0.6 안)에서 돌기 박자마다 띠 세기 × 칸 dash × coin 확률로 그쪽으로 박참(가운데부터는 기력이 쉼 문턱 + 박차기 값보다 많을 때만 — 낮음은 안 봄: 무계획)
 */
export function ibCircle(ai, x) {
  const C = ai.planC;
  const kw = ai.planK * (C?.wide ?? 0);
  if (kw > 0 && !ai.drySense) {
    let c = ai.circle;
    if (!c && x >= 0.45 * (1 - 0.5 * kw)) c = (x < 0.85 ? ai.pers.circleDir : -ai.pers.circleDir) * ai.pers.circleRate;
    ai.circle = c * (1 + 0.5 * kw);
  }
  const I = ai.ibPlan;
  // 박자가 흔들림 (변칙): 다음 돌기 박자를 × (1 + odd × (u − ½)) — 높음 0.5 ~ 1.5 배 (잔걸음 · 돌기 사이 간격이 고르지 않음)
  const ko = ai.planK * (C?.odd ?? 0) + ai.planLuck * (C?.odd ?? 0) * AI_PLAN.coin;
  if (ko > 0) {
    ai.circleTimer *= 1 + Math.min(1, ko) * (Math.random() - 0.5);
    ai.stats.ib.jitter++;
  }
  const c = ai.circle;
  const turn = !!c && Math.sign(c) !== Math.sign(I.lastCircle);
  I.lastCircle = c;
  // 옆 박차기 — 간 보기 · 거리 다툼(넓게 도는 거리 안)에서 돌기 박자마다: 각을 바꿀 때(계획) · 아무 때나(무계획) · 상대가 되풀이해 칼을 내면 비켜 꾐(높음)
  const cd = C?.dash ?? 0;
  if (!(cd > 0) || I.dash.on || ai.mode !== 'watch' || ai.chasing || !(ai.d < ai.holdDist() + 0.6 * (1 + kw))) return;
  const bait = I.repeat && foeAtkN(ai) >= 2 ? ai.planK * AI_PLAN.coin : 0;
  const p = mixP(ai, ai.planK * cd * AI_PLAN.coin * (turn ? 1 : 0), cd) + bait;
  ai.stats.ib.tryCircle++;
  if (!(Math.random() < p)) return;
  if (dashStart(ai, Math.sign(c) || ai.pers.circleDir) && bait > 0) ai.stats.ib.bait++;
}

/** 간 보기 옆 스틱 (moveFeet — 옛 줄 뒤): 넓게 돎이면 돌기 거리를 간 보는 거리 + 0.6 × (1 + kw) 까지 (옆 박차기 · 비스듬히 들어감은 꼴 뒤 ibSidePost) */
export function ibSide(ai, side, d, hold) {
  const kw = ai.planK * (ai.planC?.wide ?? 0);
  if (!side && kw > 0 && d < hold + 0.6 * (1 + kw)) return ai.circle;
  return side;
}

/** 꼴 뒤 옆 스틱 (moveFeet — 꼴마다 걸음을 정한 뒤 · 울타리 · 붙음 줄 앞): 옆 박차기 동안 옆 끝 (간 보기 · 물러남 · 막기) · 비스듬히 들어감 — 준비 · 다가가는 동안 옆 0.6 (달려드는 몸을 맞받는 옆 비킴 0.6 과 같은 수) */
export function ibSidePost(ai, side) {
  const I = ai.ibPlan;
  if (I.dash.on) return I.dash.side;
  if (I.ang && ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach') && ai.sideStepT == null) return I.ang * 0.6;
  return side;
}

/** 꼴 뒤 앞뒤 스틱: 옆 박차기 동안은 옆이 앞뒤보다 크게 (|앞뒤| ≤ 0.6 — 옆 박찬 걸음이 끊기지 않게) */
export function ibFwdPost(ai, fwd) {
  return ai.ibPlan.dash.on ? clamp(fwd, -0.6, 0.6) : fwd;
}

/**
 * 간 보기 다가가는 빠르기 (moveFeet — 플랜 걸음 뒤 · 고노센 경계 줄 앞): 칼끝 밖 무장 기다림 — 내 칼끝 거리 + outStep 안이면 물러섬.
 *  (무 · 낮음이 준비된 고노센 선을 무모하게 넘는 것은 11/14 합치며 공통 틀 하나로 모음 — ai.js gnsWatch 의 W.reck · 감독 '사장님 결정은 하나')
 */
export function ibFeetV(ai, v, d) {
  const I = ai.ibPlan;
  if (I.out && !ai.spinArm?.armed) {
    const want = ai.M.reach + AI_PLAN.ib.outStep;
    if (d < want) v = Math.min(v, clamp((d - want) * 1.6, -1.9, 0));
  }
  return v;
}

/** 큰 칼 하나 (유도 · 들어감): 무거운 베기를 더 · 찌르기를 덜 — 기술 고르기(pickTech) 그대로에 곱만 */
function bigCut(ai, s, why) {
  return ai.pickTech(s, why, { presses: 2, thrust: 0.5 });
}

/**
 * 간 보기 덧칸 (watch — 싱지르 · 알티바슈 무장 걸쇠 앞): 냈거나 이 스텝을 쥐었으면 true
 *  ① 무장된 뒤 상대가 armWait 넘게 안 들어오면(유도 ② — 4 부터) beat 마다 띠 세기 × 칸 lure × coin 으로 사슬로 들어감(무장은 휘두르면 풀림 — 사람과 같은 규칙) ·
 *  ② 칼끝 밖 무장 기다림 — 무장 전엔 먼저 치지 않음(상대가 내 칼끝 안으로 들면 풀림 · 들어오는 칼 받기는 위에서 그대로) ·
 *  ③ 옆 박차기가 걸린 때부터 박차기 끝 + 2 beat(1.2 s) 안 — 칠 거리(+ 나선 걸음 베기의 앞 걸음)에 든 첫 때 띠 세기 × 칸 slant 로 나선 걸음 베기(박찬 각에서 비스듬히 들어감 — 사람 B2 → B3) ·
 *  ④ 원 돌려 보이기(유도 ① — 4 부터): 맞바꿈이 남았고 상대가 내 칼끝 밖 0.45 m 안에 막 들면 한 번 굴려 띠 세기 × 칸 lure × coin 로 큰 칼 사슬을 엶(원 사이로 들어오면 맞바꿈 · 다음 칼) —
 *   알티바슈 무장이 쌓이는 중(칼끝 밖 시간 > 0)이면 굴리지 않음 (11/14 둘째 — 무장 2 s 를 휘둘러 버리지 않게 · 무장 쪽이 먼저)
 */
export function ibWatch(ai, s, d, CALM) {
  const I = ai.ibPlan;
  const C = ai.planC;
  if (!C) return false;
  const st = ai.stats.ib;
  const A = ai.spinArm;
  const beat = ai.sense.t >= I.beatT;
  if (beat) I.beatT = ai.sense.t + AI_PLAN.beat;
  if (A?.armed) {
    if (I.out) {
      I.out = false;
      st.outArmed++;
    }
    if (beat && ai.planLure && A.t - SECRET.ibSpin.armTime >= AI_PLAN.ib.armWait && ai.foeClosing < GAIT.walkMin && s.state === 'stand' && Math.random() < ai.planK * (C.lure ?? 0) * AI_PLAN.coin) {
      const t = bigCut(ai, s, 'lure');
      if (t && ai.startAttack(t, 'lure', { noFeint: true })) {
        st.goIn++;
        return true;
      }
    }
    return false;
  }
  if (I.out) {
    if (d < ai.M.reach) I.out = false;
    else return true;
  }
  if (I.slantArmed && ai.sense.t - I.slantT > 2 * AI_PLAN.beat) I.slantArmed = false;
  const tr = I.slantArmed ? ai.techNow(ai.uniqueByName.get('talhoRodeado') ?? null) : null;
  if (tr && s.state === 'stand' && d < ai.holdDist() + ai.watchReachOut() + (tr.step?.fwd ?? 0)) {
    I.slantArmed = false; // 칠 거리(+ 그 기술이 비껴 딛는 앞 걸음 0.45)에 든 첫 때 한 번 굴림 (박차는 동안도 — 박찬 각에서 곧장)
    if (Math.random() < ai.planK * (C.slant ?? 0) && ai.startAttack(tr, 'slant')) {
      st.slant++;
      return true;
    }
  }
  const edge = d > ai.M.reach && d < ai.M.reach + 0.45;
  if (!edge) I.lureArmed = true;
  else if (I.lureArmed && ai.planLure && ai.noThreat > CALM && s.state === 'stand' && !(A?.t > 0)) { // 알티바슈 무장이 쌓이는 중이면 미룸 (휘두르면 풀림 — 무장 쪽이 먼저: 유도 ②)
    I.lureArmed = false;
    if (swapReady(ai.me) && Math.random() < ai.planK * (C.lure ?? 0) * AI_PLAN.coin) {
      const t = bigCut(ai, s, 'lure');
      if (t && ai.startAttack(t, 'lure', { noFeint: true })) {
        I.lureT = ai.sense.t;
        st.lure++;
        return true;
      }
    }
  }
  return false;
}
