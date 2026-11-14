// ─────────────────────────────────────────────────────────────
//  유파 AI 기본 전투 흐름 — 동방 플랜 (2 단계 · 11/14 사장님 '동방은 사냥감을 말려 죽이는 고양이과 맹수' · 설계안 docs/design/ai_school_baseline_2026-11-14.md §3-4 ·
//   기록 docs/strike/ai_plan_cn_2026-11-14.md · 칸 표 src/ai_plan.js SCHOOL_PLAN.chinese · 값 config AI_PLAN.cn)
//
//  고리: 가까운 간격을 많이 돌며 허리 베기로 피를 내 사냥 겹을 쌓고(상대 기력 회복 −8 %/겹 · 격살 빠르기 +8 %/겹 — cn_hunt.js) →
//   겹이 쌓이면 몰아치기를 줄이고 돌며 지치게 함 → (가운데 끝 4 부터) 간격 끝에 서서 공격을 끌어냄(유도) → 지친 상대가 칠 때 나서며 받아 격살(판당 1 번 · 숙련 5 부터).
//  모두 기울기다(사장님 11/14 '절대적 규칙은 빼'): 몫 = 띠 기울기(planK — 낮음 ⅓ · 가운데 ⅔ · 높음 1) × 국면 칸(planC) × 값(AI_PLAN.cn) — 곱 · 문턱 이동 · 확률.
//   큰 틈(상대 헛친 뒤 · 무너짐)은 문턱을 올리지 않는다.
//  격살을 노릴 마음 (사장님 11/14 '동방도 반드시 스택이 쌓여야 격살을 쓴다는 절대적 규칙은 지우자 마음의 기울기로 남겨둬'): 옛 문(SECRET.gyeoksalAi — 겹 1 이상 또는 판 10 s 넘음 ·
//   ai.js gkWant)은 플랜 몸에선 마음(cnWill)으로 — 겹이 많을수록 · 판이 길수록 · 상대가 지쳤을수록 커지고 겹 0 · 초반에도 will0 · 높음도 1 − will0 을 넘지 않음 · 위협 하나에 한 번 굴림(cnWant).
//   두 수(1 겹 · 10 s)는 기울기의 기준점(그만큼이면 마음이 반쯤 기욺)으로 씀. 옛 판(`?aiPlan=0` · `?aiPlanCn=0`)은 문 그대로.
//  ai.js 는 this.planCn(동방 플랜 몸만 — cnInit)이 있을 때만 여기를 부른다 — 다른 유파 · 옛 판(`?aiPlan=0` · `?aiPlanCn=0`)은 굴림 · 셈 그대로.
//  무 · 낮음 '행운에 기대는 전투'(무모 · 무계획) · 띠별 기력(planRestAt) · 거리 오차는 공통 틀(ai.js · ai_plan.js)이 그대로 맡는다 — 여기는 그 위 동방 몫:
//   무계획 = 겹 · 유도 · 격살 때를 셈하지 않음(기울기가 작음) · 무모 = 고노센 경계 선을 넘는 쪽(준비 한 번에 한 번 굴림 — 굴림 몫 × reck).
//  수 읽기의 동방 몫(본 것만 — 늦게 본 위협 줄): 가운데부터 버릇(최근 6.0 s 상대 공격 — 안 치는 상대면 기다리지 않고 허리 견제) · 높음 되풀이(같은 줄 두 번 10.0 s 안 — 그 줄을 나서며 받을 준비).
//  연산: 스텝마다 새 객체 · 배열 없음(기억은 길이 4 고리) · 굴림은 유도(간 보기 · 물러남 한 번) · 고노센 준비 한 번 · 위협 하나 · 기술 고르기 · 속임 고르기에만.
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, UNIQUE_ASSIST as UA, SECRET, realS } from './config.js';
import { huntN } from './cn_hunt.js';
import { secretSpent } from './secret.js';
import { bandOf, axesOf } from './ai_plan.js';

const RING = 4; // 본 상대 공격 기억 고리 (버릇 · 되풀이)
const CN = () => AI_PLAN.cn;
/** 사냥 겹을 쌓는 허리 베기 계열 (요격 · 체보요격 · 날개 접기 — cn_hunt.js 와 같은 목록) */
const isWaist = (name) => !!name && (UA.yaojiBleed?.techs ?? []).includes(name);
/** 상대가 지쳤나 (머리 위 기력 막대가 보임 — 공정 · 설계 §4-3) */
const foeTired = (ai) => (ai.foe.stamina?.level ?? 0) > 0 || !!ai.foe.stamina?.exhausted;

/** 격살이 이 판에 남았나 (숙련 5 부터 · 판당 1 번) */
const gkLeft = (ai) => ai.secret?.when === 'gyeoksal' && !secretSpent(ai.me);

/** 동방 플랜 상태 칸 (ai 생성자 — this.plan 이 동방 플랜일 때만 · 한 번 만듦) */
export function cnInit(ai) {
  const R = axesOf(ai.proficiency).read; // 기억 창 — 가운데 6.0 s · 높음 10.0 s (공통 틀 그릇의 값 · 실제 초 · 설계 §4-2)
  ai.planCn = {
    lure: 0, // 유도 남은 게임 초 (0 = 아님)
    lureArmed: true, // 이번 간 보기 · 물러남에서 아직 유도를 굴리지 않음 (공격 · 막기로 나가면 다시)
    drawnId: -1, // 유도가 끌어낸 위협 번호 (cnMeet — 그 칼은 유도 중과 같게 받음)
    wantId: -2, // 격살을 노릴 마음을 굴린 위협 번호 (cnWant — 위협 하나에 한 번)
    want: false,
    gnsSkip: false, // 고노센 경계 무모: 이번 준비를 없는 셈
    gnsWas: false,
    habitT: R.habit ? realS(R.mem) : 0, // 버릇 창 (가운데부터)
    repeatT: R.repeat ? realS(R.mem) : 0, // 되풀이 창 (높음)
    thId: -1,
    thT: new Float64Array(RING),
    thL: new Array(RING).fill(null),
    thN: 0,
    quiet: false, // 안 치는 상대 (버릇)
    rep: null, // 되풀이 줄 (높음)
    repT: 0,
    st: (ai.stats.cn = { lure: 0, lureDraw: 0, meet: 0, gnsSkip: 0, rep: 0, wearT: 0, quietT: 0, lianchi: 0, wantRoll: 0, want: 0 }),
  };
}

/**
 * 전략 층 덧칸 (updateCombat — planTick 바로 뒤 · 반사 층은 그대로 매 스텝): 수 읽기 기억 · 유도 박자 · 고노센 경계 무모.
 *  th = 이 스텝 본 위협(없으면 null). 굴림은 유도 — 간 보기 · 물러남 한 번에 한 번 · 고노센 준비가 켜진 한 번에 한 번뿐.
 */
export function cnTick(ai, dt, d, s, th) {
  const S = ai.planCn;
  const st = S.st;
  const C = ai.planC;
  const k = ai.planK;
  const t = ai.sense.t;
  const n = huntN(ai.foe);
  // 수 읽기 — 새 위협(늦게 본 칼끝)을 고리에 적음
  if (th && th.id !== S.thId) {
    S.thId = th.id;
    if (S.repeatT > 0) {
      for (let j = 0; j < Math.min(S.thN, RING); j++) {
        if (S.thL[j] === th.line && t - S.thT[j] <= S.repeatT) {
          S.rep = th.line; // 같은 줄이 되풀이 창 안에 두 번 — 그 줄을 나서며 받을 준비 (cnMeet)
          S.repT = t;
          st.rep++;
          break;
        }
      }
    }
    const i = S.thN++ % RING;
    S.thT[i] = t;
    S.thL[i] = th.line;
    if (S.lure > 0) {
      st.lureDraw++; // 끌어냄 — 유도는 여기서 끝 (막기 · 격살은 반사 층 respond 가 — 이 위협은 끌어낸 칼로 받음 drawnId)
      S.lure = 0;
      S.drawnId = th.id;
    }
  }
  if (S.rep && t - S.repT > S.repeatT) S.rep = null;
  if (S.habitT > 0) {
    const last = S.thN ? S.thT[(S.thN - 1) % RING] : -Infinity;
    S.quiet = ai.me.fightT > S.habitT && t - last > S.habitT; // 버릇 창 동안 칼을 안 냄 — 끌어낼 수 없는 상대
    if (S.quiet) st.quietT += dt;
  }
  if (n > 0 && !foeTired(ai)) st.wearT += dt;
  // 유도 (가운데 끝 4 부터 — planLure): 겹이 있거나 · 지친 상대이고 격살이 남았고 칼을 쥐었고 상대가 서 있고 간 보기 · 물러남 동안 · 안 치는 상대가 아니면
  //  그 한 번(공격 · 막기로 나갔다 오면 다시)에 띠 기울기 × 칸 몫으로 한 번 굴림 →
  //  lureHold 동안 상대 칼끝 바로 밖에 서서(cnHoldM) 먼저 치지 않음(cnNeed) — 상대가 칼을 내면(위 수 읽기) · 내가 공격 · 막기로 나가면 · 때가 지나면 끝
  const calm = ai.mode === 'watch' || ai.mode === 'withdraw';
  if (!calm) S.lureArmed = true;
  if (S.lure > 0) {
    S.lure -= dt;
    if (!calm || s.state !== 'stand' || !ai.me.armed) S.lure = 0;
  } else if (calm && S.lureArmed && ai.planLure && C?.lure && ai.me.armed && (n >= 1 || (foeTired(ai) && gkLeft(ai))) && s.state === 'stand' && !S.quiet) {
    S.lureArmed = false;
    if (Math.random() < k * C.lure) {
      S.lure = CN().lureHold;
      st.lure++;
    }
  }
  // 고노센 경계 무모 (무 · 낮음 — 굴림 몫 planLuck · 사장님 11/14 '고노센 경계 선도 무 · 낮음은 무모하게 넘는 쪽으로'): 준비된 고노센 상대(gnsWatch 가 이 스텝 앞에서 셈)를
  //  준비가 켜진 한 번에 한 번 굴려(굴림 몫 × AI_PLAN.reck) 없는 셈으로 — 선 밖 여유(holdDist) · 선 언저리 걸음 막음(moveFeet) · 결행/속임(gnsAct)을 안 탐. 막 베인 물러남(W.cut)은 그대로
  const W = ai.gnsW;
  if (W?.user) {
    const ready = !!W.ready;
    if (ready && !S.gnsWas) {
      S.gnsSkip = ai.planLuck > 0 && Math.random() < ai.planLuck * AI_PLAN.reck;
      if (S.gnsSkip) st.gnsSkip++;
    }
    S.gnsWas = ready;
    if (!ready) S.gnsSkip = false;
    else if (S.gnsSkip) W.ready = false;
  }
}

/** 간 보는 여유 m (holdDist — 공통 무모 몫 뒤): 유도 동안은 상대 칼끝 바로 밖(최소 여유) · 아니면 가까운 간격 쪽으로 */
export function cnHoldM(ai, m) {
  const C = ai.planC;
  if (!C) return m;
  if (ai.planCn.lure > 0 && ai.me.armed) return Math.min(m, 0);
  return C.close ? m * (1 - CN().close * ai.planK * C.close) : m;
}

/**
 * 공격 문턱 (watch — 겁 몫 뒤): 겹이 쌓이면 몰아치기를 줄임(상대가 지치지 않은 동안 · 안 치는 상대는 기다리지 않음) · 유도 동안 먼저 치지 않는 쪽.
 *  큰 틈(헛친 뒤 recover · 무너짐 finish)은 그대로 — 기울기. 지친 상대 몰아침은 공통 틀(띠 기울기)이 그대로 맡는다
 */
export function cnNeed(ai, need, kind) {
  const C = ai.planC;
  if (!C || kind === 'recover' || kind === 'finish') return need;
  const S = ai.planCn;
  let add = 0;
  const n = Math.min(huntN(ai.foe), UA.cnHunt?.max ?? 5);
  if (C.wear && n > 0 && !foeTired(ai) && !S.quiet) add += CN().wear * ai.planK * C.wear * n;
  if (S.lure > 0) add += CN().lureNeed * ai.planK;
  return need + add;
}

/** 허리 베기 계열 고를 몫 (pickTech — 기술마다 곱): 높음은 안 치는 상대(버릇)에 견제를 더 (× 2) · 쓰러진 상대 내려치기는 그대로 */
export function cnTechW(ai, t0, why) {
  const C = ai.planC;
  if (!C?.waist || why === 'finish' || !isWaist(t0.name)) return 1;
  return 1 + CN().waist * ai.planK * C.waist * (ai.planCn.quiet && bandOf(ai.proficiency) >= 3 ? 2 : 1);
}

/** 속임 고르기 (startAttack — 고른 뒤): 날개 접기가 후보에 있으면 허리 몫(cnTechW 와 같은 곱 f)만큼 그쪽으로 — P = f ÷ (n − 1 + f) · 한 번 굴림 */
export function cnFeint(ai, cands, cur) {
  const C = ai.planC;
  if (!C?.waist || cands.length < 2) return cur;
  const L = cands.find((f) => isWaist(ai.uniqueByName.get(f.name)?.name));
  if (!L || L === cur) return cur;
  const f = 1 + CN().waist * ai.planK * C.waist * (ai.planCn.quiet && bandOf(ai.proficiency) >= 3 ? 2 : 1);
  if (!(Math.random() < (f - 1) / (cands.length - 1 + f))) return cur;
  ai.planCn.st.lianchi++;
  return L;
}

/** 옆 돌기 (moveFeet — 돌기 박자에 고른 뒤 · 같은 굴림 x): 멈춤 몫 일부를 돎으로(겹이 있고 상대가 안 지쳤으면 더) · 빠르기 × (1 + circle × 몫) */
export function cnCircle(ai, circle, x) {
  const C = ai.planC;
  if (!C?.circle) return circle;
  const k = ai.planK * C.circle;
  const wear = huntN(ai.foe) > 0 && !foeTired(ai);
  let c = circle;
  if (c === 0 && x >= 0.45 * (1 - k * (wear ? 1 : 0.5))) c = ai.pers.circleDir * ai.pers.circleRate; // 0.45 = ai.js 멈춤 몫 그대로
  return c * (1 + CN().circle * k);
}

/**
 * 나서며 받기 (respond — 물러나 피하기로 정한 뒤 · 위협 하나에 한 번): 격살이 남았고 이 위협에 노릴 마음이 났으면(cnWant) 칼로 받기로 바꿀 몫 —
 *  띠 기울기 × 칸 × (상대 지침 · 유도 중 · 유도가 끌어낸 칼 1 · 아니면 meetFresh) · 되풀이 줄(높음)이면 띠 기울기만큼 준비. 바꿨으면 true (respond 가 gk 를 둬 나서며 받음)
 */
export function cnMeet(ai, th) {
  const C = ai.planC;
  if (!C?.meet || !ai.me.armed || !gkLeft(ai) || !cnWant(ai, th)) return false;
  const S = ai.planCn;
  let p = ai.planK * C.meet * (S.lure > 0 || (th && th.id === S.drawnId) || foeTired(ai) ? 1 : CN().meetFresh);
  if (S.rep && th?.line === S.rep) p = Math.max(p, ai.planK);
  if (!(Math.random() < p)) return false;
  S.st.meet++;
  return true;
}

/** 이어 치기 몫 (afterStrike — 공통 무계획 몫 뒤): 겹을 쌓은 상대가 안 지쳤는데 맞혔으면 주고받기보다 빠져 돎 */
export function cnNext(ai, want) {
  const C = ai.planC;
  if (!C?.wear || !ai.hitLanded || !(huntN(ai.foe) > 0) || foeTired(ai)) return want;
  return want * (1 - CN().wearNext * ai.planK * C.wear);
}

/**
 * 격살을 노릴 마음 0 ~ 1 (사장님 11/14 '… 절대적 규칙은 지우자 마음의 기울기로 남겨둬'): 기울기 점수 L = 상대 겹 ÷ 기준 겹(SECRET.gyeoksalAi.stacks 1) + 판 시간 ÷ 기준 시간(late 10 s)
 *  + 상대 지침 1 + (높음 — 칠 낌새를 읽음: 유도가 끌어낸 칼 · 되풀이 줄) 1 → 마음 = will0 + (1 − 2 · will0) × (1 − 2^−L) — 겹 0 · 초반 will0(0.2) · 기준점 하나 0.5 · 끝 1 − will0(0.8 — '반드시' 없음).
 *  무계획(굴림 몫 Lk — 무 · 낮음이 큼): Lk 만큼은 동전(AI_PLAN.coin)으로 — 아무 때나 노리기도 함. 가운데는 겹 · 시간 · 기력만 · 높음은 낌새까지
 */
export function cnWill(ai, th) {
  const G = SECRET.gyeoksalAi ?? { stacks: 1, late: realS(10) };
  const S = ai.planCn;
  let L = huntN(ai.foe) / Math.max(1, G.stacks) + Math.max(0, ai.me.fightT ?? 0) / Math.max(1e-6, G.late) + (foeTired(ai) ? 1 : 0);
  if (bandOf(ai.proficiency) >= 3 && th && (th.id === S.drawnId || (S.rep && th.line === S.rep))) L += 1;
  const w0 = CN().will0;
  const plan = w0 + (1 - 2 * w0) * (1 - Math.pow(2, -L));
  const Lk = ai.planLuck ?? 0;
  return Lk > 0 ? Lk * AI_PLAN.coin + (1 - Lk) * plan : plan;
}

/** 이 위협에 격살을 노리나 (ai.js gkWant · cnMeet — 위협 하나에 한 번 굴려 붙잡음 · 같은 위협은 같은 답) */
export function cnWant(ai, th) {
  const S = ai.planCn;
  const id = th?.id ?? -1;
  if (S.wantId !== id) {
    S.wantId = id;
    S.want = Math.random() < cnWill(ai, th);
    S.st.wantRoll++;
    if (S.want) S.st.want++;
  }
  return S.want;
}
