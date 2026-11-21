// ─────────────────────────────────────────────────────────────
//  짧은 칼 파고들기 (시제품 셋 가운데 A — 11/14 사장님 '짧은 무기 파고들기는 동방이 내 기대치보다 약한 면과도 연결되어 중요해. 방안을 마련해보고 정 안되면
//   앞 박차기를 모든 캐릭터에 공통으로 주거나, 기력 n이상이면 빠르게 뛸 수 있게 하거나?' · 값 config DIG_PROTO · 기록 docs/strike/ai_dig_2026-11-14.md)
//  A 는 기본 켬(사장님 11/14 'A안 켜고'). B(앞 박차기 모두에게) · C(기력 문턱 위 달림)는 고르지 않아 지움(11/21 감사 N-004 — 뛰기는 run.js 가 따로 맡음).
//   A (DIG_PROTO.ai)  AI 판단 — 파고들기 판 몸(ai.dig — 11/14 부터 몫 ai.digW: 길이 모자람 × 띠 세기 · 모든 AI · 아래 digWeight · 전엔 내 칼이 상대 칼보다 뚜렷이 짧음 · 쓰러진 상대를 내리칠 짧은 간격으로 바뀐 동안(ai.Mup)은 아님)만: 상대 칼끝 바로 밖에 섬 · 건널 수 있는 헛친 틈만 노리고 스틱 끝으로 건넘 ·
//                     걸음 실린 기술을 칼끝 밖에서 냄 · 붙은 뒤 이어 침 · 상대 등이 울타리에 닿았거나 지쳤으면 몰아침. 몸 · 걸음 장치는 그대로(AI 고르기만)
//  모두 기울기(몫 · 문턱 이동)이고 대가는 몸이 진다: 빠르게 다가오는 몸은 고노센 창 · 맞박자(+30 %)의 먹잇감 그대로.
// ─────────────────────────────────────────────────────────────
import { DIG_PROTO as D, GAIT, SECRET, AI_PLAN } from './config.js';
import { luckOf } from './ai_plan.js';
import { fieldOf } from './field.js'; // 지도 꼴 (11/21 — 상대 등이 울타리 · 막이 가까이: 원 무대는 가운데에서 거리 그대로)

/** 파고들기 A 가 켜졌나 (ai.js 다가감 걸음 자리 — 끄면 부르지 않음) */
export const digProtoOn = () => !!D.ai;

const statsOf = (ai) => (ai.stats.digP ??= { stepIn: 0, cross: 0, keep: 0, wall: 0 });

/** 기술의 앞 걸음 몫 m (기술 걸음 'strike' — 칼이 나갈 때 딛는 걸음 · 'chineseStep' 은 SECRET 칸) */
export function techStepFwd(t) {
  const st = t?.step;
  if (!st || st.when !== 'strike' || st.back) return 0;
  const f = typeof st.fwd === 'number' ? st.fwd : typeof st.fwd === 'string' ? SECRET[st.fwd] ?? 0 : 0;
  return f > 0 ? f : 0;
}

// ── 상대가 길 때의 대처 — 모든 AI 기본 (11/14 사장님 '그 판단을 상대 무기가 나보다 길 때의 대처 전략으로 모든 ai에게 기본으로') ──
//  옛 판은 문 하나(상대 칼끝 어림 − 내 칼끝 ≥ AI_PLAN.digShort)로 파고들기 판을 켜고 끔. 이제는 기울기: 몫 w = 길이 모자람 s × 띠 세기.
//  s = (상대 칼끝 어림 − 여유 0.05 − 내 칼끝) ÷ D.reachRef (0 ~ 1) — 상대 칼은 본 칼로(무기 간격표 · 부러지면 줄임 · 거리 오차는 두 쪽에 같이 얹혀 지워짐) · 같은 칼이면 0.
//  띠 세기 = 띠 기울기 + 굴림 몫 × (AI_PLAN.beat 마다 동전) — 무 · 낮음은 서툴게(행운이 섞임) · 높음은 또렷이. 유파 · 무유파 · 플랜과 상관없이 모든 AI (AI_PLAN.on 아래).
//  몫을 쓰는 곳: 끄고 켜던 자리(칼끝 바로 밖 서기 · 건널 수 있는 틈 · 그 다가감 스틱 · 걸음 실린 칼을 칼끝 밖에서 · 다가감 시간 한도)는 w 만큼 옛 값 → 파고들기 값으로 옮김(digMix) ·
//   이미 띠 기울기를 곱하던 자리(헛친 틈 점수 · 받으며 들어감 · 걸음 실린 기술 고르기 · 붙은 뒤 이어 침 · 몰린 상대 몰아침)는 띠 기울기 × s.
//  쓰러진 상대 간격(ai.Mup — 내리칠 짧은 간격으로 바뀐 동안)은 칼 길이 탓 모자람이 아니라 옛 문 그대로 · D.reach 0 이면 모두 옛 문(굴림 없음 · 바이트 같음).

/** 길이 모자람 m — 상대 칼끝 어림(본 칼 · 거리 오차 포함) − 여유 0.05(foeReachBase 의 여유) − 내 칼끝 거리 (5 mm 밑은 0 — 같은 칼) */
export function digShortM(ai) {
  const sh = ai.foeBase(ai.foeM, ai.foe) - 0.05 - ai.M.reach;
  return sh > 0.005 ? sh : 0;
}

/** 이 스텝 파고들기 몫 0 ~ 1 (updateCombat — AI_PLAN.on 일 때만 부름). ai.digS = 길이 몫(띠 기울기를 곱하던 자리가 씀) · 돌려줌 = w (0 이면 파고들기 판 아님) */
export function digWeight(ai) {
  if (ai.chasing) return (ai.digS = 0);
  if (!D.reach || ai.Mup) return (ai.digS = ai.foeBase(ai.foeM, ai.foe) - ai.M.reach >= AI_PLAN.digShort ? 1 : 0); // 옛 문 (쓰러진 상대 간격 · 끈 판)
  const sh = digShortM(ai);
  const s = sh >= D.reachRef - 1e-6 ? 1 : sh / D.reachRef; // 기준점에 닿으면 1 (소수 끝수로 0.999… 가 되지 않게)
  ai.digS = s;
  if (!(s > 0)) return 0;
  const lk = luckOf(ai.proficiency);
  if (lk > 0 && ai.sense.t >= (ai.digLuckT ?? 0)) {
    ai.digLuckT = ai.sense.t + AI_PLAN.beat; // 박자마다 한 번 굴림 (모자람이 있는 몸만 — 같은 칼끼리는 굴리지 않음)
    ai.digLuck = Math.random() < AI_PLAN.coin;
  }
  return s * Math.min(1, (ai.digK ?? 0) + (lk > 0 && ai.digLuck ? lk : 0));
}

/** 옛 값 a → 파고들기 값 b 를 몫 w 만큼 (w 1 이면 b 그대로 · 0 이면 a 그대로 — 옛 문 판과 바이트 같음) */
export const digMix = (a, b, w) => (w >= 1 ? b : w <= 0 ? a : a + (b - a) * w);

// ── A. AI 판단 ──

/** A2 헛친 틈을 노리는 거리 (opportunity — 파고들기 판): 끄면 옛 셈 그대로(내 칼끝 · 상대 칼끝 어림 가운데 먼 쪽) · 켜면 건널 수 있는 거리(칠 거리 + crossT × 앞 걷는 빠르기)까지만 */
export function digRecoverReach(ai) {
  const r = Math.max(ai.M.reach, ai.foeReach);
  if (!D.ai || ai.Mup) return r; // 쓰러진 상대 간격(Mup — 내리칠 짧은 간격으로 바뀐 동안)은 칼 길이 탓 파고들기가 아님 — 옛 셈
  return Math.min(r, ai.M.contact + 0.05 + D.crossT * GAIT.moveSpeed);
}

/** A3 칼을 내는 거리 덧 (attack 다가감 — 파고들기 판 · A 켬): 걸음 실린 기술은 그 앞 걸음 몫만큼 일찍 */
export function digStepIn(ai, t) {
  if (ai.feint || ai.secretRun) return 0;
  const f = techStepFwd(t) * D.stepIn * (ai.digW ?? 1); // 몫 w (상대가 길 때의 대처 — 옛 문 판은 1)
  if (f > 0 && ai.digInSeq !== ai.atkSeq) (ai.digInSeq = ai.atkSeq), statsOf(ai).stepIn++; // 재기: 공격 하나에 한 번
  return f;
}

/** A3 기술 고르기 곱 (pickTech — 파고들기 판 · A 켬): 걸음 실린 기술(앞 걸음 · 다가가며 딛는 기술)을 (1 + 띠 기울기) 배 */
export function digTechW(ai, t0) {
  const st = t0?.step;
  const fwd = techStepFwd(t0) || (st?.when === 'approach' && typeof st.fwd === 'number' && st.fwd > 0 ? st.fwd : 0);
  return fwd > 0 ? 1 + (ai.digK ?? 0) * (ai.digS ?? 1) : 1;
}

/** A4 이어 칠 몫 (afterStrike — 파고들기 판 · A 켬): 맞히거나 막혔으면(붙음) 들어간 거리를 지킴 */
export function digKeepWant(ai, want) {
  if (!(ai.hitLanded || ai.bound)) return want;
  statsOf(ai).keep++;
  return want + (1 - want) * D.keep * (ai.digK ?? 0) * (ai.digS ?? 1);
}

/** A5 공격 문턱 (watch — 파고들기 판 · A 켬): 상대 등이 울타리 가까이(보이는 자리)거나 상대가 지쳤으면(머리 위 막대) 물러섬 끝 — 몰아침. 큰 틈은 그대로 */
export function digWallNeed(ai, need) {
  const foe = ai.foe;
  const p = foe.bodies?.pelvis?.translation();
  const atWall = p && fieldOf(foe).radial(p.x, p.z) > D.wall;
  const tired = (foe.stamina?.level ?? 0) > 0 || !!foe.stamina?.exhausted;
  if (!atWall && !tired) return need;
  statsOf(ai).wall++;
  return need - D.wallNeed * (ai.digK ?? 0) * (ai.digS ?? 1);
}

/**
 * AI 다가감 걸음 (moveFeet 준비 · 다가감 — 파고들기 A 가 켜졌을 때만 부름): fwd = 지금 스틱 · gap = 칠 거리(준비는 칼끝 거리 + 0.2)까지 남은 거리.
 *  파고들기 판의 헛친 틈 공격(recover) · 받으며 들어간 뒤 다시 들어감(dig)은 스틱 끝까지 (건넘)
 */
export function digFeet(ai, fwd, gap) {
  if (!(gap > 0) || ai.foeClosing > 0.5) return fwd;
  if (D.ai && ai.dig && !ai.Mup && (ai.why === 'recover' || ai.why === 'dig')) {
    const c = Math.min(1, Math.max(0.25, gap * 3));
    if (c > fwd) {
      fwd = digMix(fwd, c, ai.digW ?? 1); // 몫 w (상대가 길 때의 대처)
      if (ai.digCrossSeq !== ai.atkSeq) (ai.digCrossSeq = ai.atkSeq), statsOf(ai).cross++; // 재기: 공격 하나에 한 번
    }
  }
  return fwd;
}
