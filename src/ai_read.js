// ─────────────────────────────────────────────────────────────
//  유파 AI 3 단계 — 수 읽기 그릇 (11/14 — 사장님 'A안 켜고 3단계 진행해' · 설계안 docs/design/ai_school_baseline_2026-11-14.md §2-4 ③ · §4 · 기록 docs/strike/ai_read_2026-11-14.md · 값 config AI_PLAN.read)
//
//  공통 틀의 읽기 그릇: 플랜이 있는 AI(ai.plan) 하나에 한 번 만든다(readInit). 본 것만 쌓는다 — 반응 시간만큼 늦게 본 위협(threat)과 늦게 본 상대 손(칼 들기) · 머리 위 기력 막대 ·
//   몸에 보이는 표식(칼 우위 빛 · 스택 빛 · 발톱 자국 · 머리 위 원 · 비기 뒤 굳은 몸). 사람 스틱 · 단추 · 내부 공격 상태는 읽지 않는다(설계 §4-3).
//  ① 버릇 · 되풀이 (유파마다 따로 있던 기억을 여기 하나로 — 일본 jpGuardChance · jpRead · 동방 cnTick · 이베리아 foeAtkN 이 이 그릇을 읽음):
//     상대가 낸 칼(새 위협 번호)의 때 · 줄 · 거리 고리(RING) — 가운데 버릇 habitT 6.0 s · 높음 되풀이 repeatT 10.0 s · 상대가 칼을 드는 거리(일본 고노센이 서는 자리를 고름)
//  ② 상대 유파의 대표 위험 (가운데부터 · 설계 §4-2 표 — 보이는 표식으로만 · 모두 기울기 r = 띠 세기 × risk):
//     이탈리아 — 곧게 걸어 들지 않음(상대 칼끝 어림 + 0.3 안에서 다가가는 빠르기 × (1 − r)) · 칼 우위 빛 동안 들어가지 않고 거리를 벌림
//     일본 — 준비된 고노센 선 언저리에서 함부로 안 듦 · 스택 빛이 적을 때 견제(쌓이기 전에)
//     독일 — 헛치지 않음(내 칼끝 밖에서 칼을 덜 냄 · 그 거리의 큰 칼을 덜 고름 · 헛친 뒤 이어 치기를 덜 — 파고들기 두 걸음)
//     동방 — 큰 칼을 아낌(내 몸에 발톱 자국이 쌓이고 · 내가 지쳤을수록 크게 휘두르기를 덜 — 지친 채 휘두르면 격살)
//     이베리아 — 원 사이를 노림(머리 위 원이 보이면 칠 마음) · 무장처럼 보이는 상대(제 칼끝 밖에서 휘두르지 않고 2 s)에게 들어가지 않음
//  ③ 상대 대가 창 (높음): 비기 뒤 굳은 몸(0.6 s — 고노센 굳음 · 리솔루토 굳음 포함) · 이어 돌리기 원(0.4 s · 막기 못 함) — 반응 시간 뒤부터 보임 · 칠 마음 + 빠른 칼
//  ④ 상대 기력 (높음): 머리 위 기력 막대(사람 화면에 보임 — 공정): 내가 더 남았으면 몰아치고 · 모자라면 기다림
//  무 · 낮음은 거의 안 읽음(②③④ 없음 — 띠 세기 0 · ⅓ 이고 읽기 칸이 닫힘). 플랜 없는 몸 · `?aiPlan=0` · AI_PLAN.read.on 0 은 한 줄도 안 탐(굴림 · 셈 그대로).
//  연산: 스텝마다 새 객체 · 배열 없음(고리 버퍼는 AI 하나에 한 번) · 굴림 없음(읽기는 문턱 · 곱만).
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, SECRET, STAMINA, JP_TANK } from './config.js';
import { axesOf } from './ai_plan.js';
import { itEdgeOn } from './italian_outbox.js';
import { huntN } from './cn_hunt.js';

const RING = 8; // 본 상대 공격 · 칼 들기 기억 칸
const P = () => AI_PLAN.read;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** 재기 칸 */
export function readStats() {
  return { notes: 0, raises: 0, risk: { italian: 0, japanese: 0, german: 0, chinese: 0, iberian: 0 }, cost: 0, costT: 0, stamina: 0 };
}

/** 플랜이 있는 AI 를 차린다 (생성자 — this.plan 을 정한 뒤 한 번) */
export function readInit(ai) {
  const A = axesOf(ai.proficiency);
  ai.read = {
    band: A.band,
    school: A.read.school, // 상대 유파 대표 위험 (가운데부터)
    habit: A.read.habit, // 버릇 (가운데부터)
    repeat: A.read.repeat, // 되풀이 · 대가 창 · 상대 기력 (높음)
    t: new Float64Array(RING).fill(-Infinity),
    line: new Array(RING).fill(null),
    id: new Float64Array(RING).fill(-1), // 위협 번호 (지금 칼을 버릇에서 뺄 때)
    d: new Float64Array(RING),
    n: 0,
    lastId: -1,
    lastT: -Infinity,
    rT: new Float64Array(RING).fill(-Infinity), // 상대가 칼을 든 때
    rD: new Float64Array(RING), // 그때 거리
    rn: 0,
    raising: false,
    costKind: null, // 지금 보이는 상대 대가 ('stiff' 비기 뒤 굳음 · 'circle' 이어 돌리기 원)
    costT0: 0,
    idleT: 0, // 상대가 제 칼끝 밖에서 휘두르지 않고 선 시간 (무장처럼 보임 — 이베리아)
    st: (ai.stats.read = readStats()),
  };
}

const school = (ai) => ai.foe?.swordArt?.tradition ?? null;
/** 상대 일본 스택 몫 (스택 빛 — 보임) · 없으면 null */
function foeStack(foe) {
  const S = foe.schoolPassive;
  return S?.stackOn ? S.stk / JP_TANK.max : null;
}
/** 지금 상대 몸에 보이는 대가 — 비기 뒤 굳음(AI 몸 secretStiff · 사람 검술 층 굳음) · 이어 돌리기 원 */
export function foeCost(foe) {
  if (foe.ibLink) return 'circle';
  if (foe.secretStiff || foe.skill?.sec?.stage === 'stiff') return 'stiff';
  return null;
}

/** 상대가 낸 칼 하나를 적음 (같은 위협 번호는 한 번 — 번호가 없으면 부를 때마다) · th = { id?, line } */
export function readNote(ai, th, d = ai.d) {
  const R = ai.read;
  if (!R || !th) return;
  if (th.id != null) {
    if (th.id === R.lastId) return;
    R.lastId = th.id;
  }
  const i = R.n++ % RING;
  R.t[i] = ai.sense.t;
  R.line[i] = th.line ?? null;
  R.id[i] = th.id ?? -1;
  R.d[i] = d;
  R.lastT = ai.sense.t;
  R.st.notes++;
}

/** 줄 line 이 지난 win 초 안에 몇 번 왔나 (except = 뺄 위협 번호 — 지금 보는 칼은 버릇에 안 셈) */
export function readLineN(ai, line, win, except = null) {
  const R = ai.read;
  if (!R || !line) return 0;
  const t0 = ai.sense.t - win;
  let n = 0;
  for (let k = 0; k < RING; k++) if (R.line[k] === line && R.t[k] >= t0 && !(except != null && R.id[k] === except)) n++;
  return n;
}

/** 지난 win 초 안에 상대가 낸 칼 수 */
export function readAtkN(ai, win) {
  const R = ai.read;
  if (!R) return 0;
  const t0 = ai.sense.t - win;
  let n = 0;
  for (let k = 0; k < RING; k++) if (R.t[k] >= t0) n++;
  return n;
}

/** 되풀이 — win 초 안에 두 번 이상 온 가장 최근 줄 (없으면 null) */
export function readRepeatLine(ai, win) {
  const R = ai.read;
  if (!R) return null;
  for (let k = 1; k <= Math.min(R.n, RING); k++) {
    const j = (R.n - k) % RING;
    const line = R.line[j];
    if (line && ai.sense.t - R.t[j] <= win && readLineN(ai, line, win) >= 2) return line;
  }
  return null;
}

/** 버릇 — 상대가 칼을 드는 거리 (되풀이 창 안의 평균 · 두 번부터) · 모르면 NaN */
export function readRaiseD(ai) {
  const R = ai.read;
  if (!R) return NaN;
  const t0 = ai.sense.t - P().repeatT;
  let s = 0;
  let n = 0;
  for (let k = 0; k < RING; k++) if (R.rT[k] >= t0) (s += R.rD[k]), n++;
  return n >= 2 ? s / n : NaN;
}

/** 대가 창이 보이나 (높음 — 그 대가가 반응 시간 넘게 이어짐 · 본 것만) */
export function costOpen(ai) {
  const R = ai.read;
  return !!R?.repeat && !!R.costKind && ai.sense.t - R.costT0 >= ai.level.reaction;
}

/**
 * 스텝마다 (planTick 뒤 · 유파 덧칸 앞): 새 위협을 적음 · 상대가 칼을 든 거리 · 보이는 대가 · 무장처럼 선 시간. 굴림 없음.
 *  s = 늦게 본 상대 모습 · th = 이 스텝 본 위협(없으면 null) · d = 본 거리
 */
export function readTick(ai, dt, d, s, th) {
  const R = ai.read;
  if (th) readNote(ai, th, d);
  const raising = s.hvy > 1.6 && s.hy > 0.05; // 칼을 듦 (preThreat · 비기 사건과 같은 꼴 — 늦게 본 손)
  if (raising && !R.raising) {
    const i = R.rn++ % RING;
    R.rT[i] = ai.sense.t;
    R.rD[i] = d;
    R.st.raises++;
  }
  R.raising = raising;
  const kind = foeCost(ai.foe);
  if (kind !== R.costKind) (R.costKind = kind), (R.costT0 = ai.sense.t);
  if (costOpen(ai)) R.st.costT += dt;
  R.idleT = school(ai) === 'iberian' && d > ai.foeReach && Math.hypot(s.hvx, s.hvy) < 1.8 && s.state === 'stand' ? R.idleT + dt : 0;
}

/** 무장처럼 보이는 이베리아 상대 (제 칼끝 밖에서 휘두르지 않고 무장 시간만큼 — 보이는 꼴로만 어림) */
const ibArmed = (ai) => ai.read.idleT >= SECRET.ibSpin.armTime;

/**
 * 공격 문턱에 얹을 몫 (watch — 다른 유파 몫 뒤): ② 상대 유파 대표 위험(가운데부터) · ③ 대가 창 · ④ 상대 기력(높음). + 는 참음 · − 는 칠 마음
 */
export function readNeed(ai, opp) {
  const R = ai.read;
  if (!R || !P().on) return 0;
  const k = ai.planK;
  const foe = ai.foe;
  const d = ai.d;
  let n = 0;
  if (R.school) {
    const r = k * P().risk;
    const t = school(ai);
    const big = opp.kind === 'recover' || opp.kind === 'finish'; // 큰 틈엔 안 얹음
    let a = 0;
    if (t === 'italian') {
      if (itEdgeOn(foe) && !big) a = r; // 칼 우위 빛 — 들어가지 않음
    } else if (t === 'japanese') {
      const W = ai.gnsW;
      const f = foeStack(foe);
      if (W?.ready && !W.reck && d < W.line + 0.3 && !big) a = r; // 준비된 고노센 — 선 언저리에서 함부로 안 듦
      else if (f != null && f < 0.5 && !W?.ready) a = -r * (1 - 2 * f); // 스택이 쌓이기 전에 견제
    } else if (t === 'german') {
      if (d > ai.M.reach && !big) a = r; // 내 칼끝 밖에서 칼을 덜 냄 (헛치면 파고듦)
    } else if (t === 'chinese') {
      const f = Math.min(1, huntN(ai.me) / 2 + (ai.me.stamina?.level > 0 ? 0.5 : 0)); // 발톱 자국 · 내 지침 (둘 다 보임)
      if (f > 0 && !big) a = r * f; // 지친 채 크게 휘두르기를 덜 (격살)
    } else if (t === 'iberian') {
      if (R.costKind === 'circle' && ai.sense.t - R.costT0 >= ai.level.reaction) a = R.repeat ? 0 : -r; // 원 사이를 노림 (높음은 아래 대가 창이 한 번 셈 — 두 번 얹지 않음)
      else if (ibArmed(ai) && !big) a = r; // 무장처럼 보이는 상대에게 들어가지 않음
    }
    if (a && t) R.st.risk[t]++;
    n += a;
  }
  if (R.repeat) {
    if (costOpen(ai) && d < ai.M.reach + 0.45) {
      n -= k * P().cost; // 대가 창 — 칠 마음
      R.st.cost++;
    }
    const S = ai.me.stamina;
    const F = foe.stamina;
    if (STAMINA.on && S && F && !S.infinite && !F.infinite) {
      const diff = clamp((S.value - F.value) / STAMINA.max, -1, 1); // 머리 위 막대 — 내가 더 남았으면 몰아침 · 모자라면 기다림
      if (Math.abs(diff) > 0.05) {
        n -= k * P().stamina * diff;
        R.st.stamina++;
      }
    }
  }
  return n;
}

/** 간 보기 다가가는 빠르기 (moveFeet — 플랜 걸음 뒤 · 고노센 경계 줄 앞): 이탈리아 — 곧게 걸어 들지 않음 · 칼 우위 빛 동안 거리를 벌림 / 이베리아 — 무장처럼 보이는 상대의 칼끝 + 0.3 안으로 안 듦 */
export function readFeetV(ai, v, d) {
  const R = ai.read;
  if (!R?.school || !P().on || ai.chasing) return v;
  const r = ai.planK * P().risk;
  const t = school(ai);
  if (t === 'italian') {
    if (itEdgeOn(ai.foe)) return Math.min(v, -r); // 칼 우위 빛 — 거리를 벌림
    if (v > 0 && d < ai.foeReach + 0.3) return v * (1 - r); // 맞박자 — 곧게 걸어 들지 않음
  } else if (t === 'iberian' && ibArmed(ai)) {
    const want = ai.foeReach + (SECRET.altib?.aiFire ?? SECRET.ibSpin.aiFire) + 0.1;
    if (d < want) return Math.min(v, clamp((d - want) * 1.6, -1.9, 0));
  }
  return v;
}

/** 기술 고르기 곱 (pickTech — 굴림 없음): 독일 — 내 칼끝 언저리 밖에서 큰 칼(헛치기 쉬운 내려베기)을 덜 · 동방 — 지친 채 · 발톱 자국이 쌓이면 큰 칼을 아낌 / 대가 창(높음) — 빠른 칼 */
export function readTechK(ai, t) {
  const R = ai.read;
  if (!R || !P().on) return 1;
  let w = 1;
  if (R.school && t.presses) {
    const r = ai.planK * P().risk;
    const s = school(ai);
    if (s === 'german' && ai.d > ai.M.reach - 0.1) w *= 1 - r;
    else if (s === 'chinese') w *= 1 - r * Math.min(1, huntN(ai.me) / 2 + (ai.me.stamina?.level > 0 ? 0.5 : 0));
  }
  if (t.fast && costOpen(ai)) w *= 1 + ai.planK * P().cost;
  return w;
}

/** 이어 칠 몫 곱 (afterStrike — 옛 이어 치기 굴림 자리): 독일 상대에게 헛쳤으면 덜 이음(헛친 뒤 물러나는 쪽 — 파고들기 두 걸음) */
export function readChainK(ai) {
  const R = ai.read;
  if (!R?.school || !P().on || ai.hitLanded || ai.bound || school(ai) !== 'german') return 1;
  R.st.risk.german++;
  return 1 - ai.planK * P().risk;
}
