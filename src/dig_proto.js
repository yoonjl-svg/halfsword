// ─────────────────────────────────────────────────────────────
//  짧은 칼 파고들기 시제품 셋 (11/14 사장님 '짧은 무기 파고들기는 동방이 내 기대치보다 약한 면과도 연결되어 중요해. 방안을 마련해보고 정 안되면
//   앞 박차기를 모든 캐릭터에 공통으로 주거나, 기력 n이상이면 빠르게 뛸 수 있게 하거나?' · 값 config DIG_PROTO · 기록 docs/strike/ai_dig_2026-11-14.md)
//  셋 다 기본 끔 — 끄면 이 파일의 어떤 셈도 판에 닿지 않는다(부르는 자리마다 스위치를 먼저 봄 · 굴림 없음 · 관문 바이트 같음).
//   A (DIG_PROTO.ai)  AI 판단 — 파고들기 판 몸(ai.dig — 내 칼이 상대 칼보다 뚜렷이 짧음)만: 상대 칼끝 바로 밖에 섬 · 건널 수 있는 헛친 틈만 노리고 스틱 끝으로 건넘 ·
//                     걸음 실린 기술을 칼끝 밖에서 냄 · 붙은 뒤 이어 침 · 상대 등이 울타리에 닿았거나 지쳤으면 몰아침. 몸 · 걸음 장치는 그대로(AI 고르기만)
//   B (DIG_PROTO.step) 앞 박차기 모두에게 — 사람(gait.js 걷기 시작 · 독일 파고들기 다음 줄) · AI(aiFrontDash — 다가감 첫 걸음) 같은 조건 · 같은 장치(gait burst dig)
//   C (DIG_PROTO.run)  기력 문턱 위에서 달림 — 사람 · AI 같은 몸 셈(fighter.js runTick — 가려는 앞 빠르기 × runV ÷ 걷는 빠르기 · 달린 거리 걸음 기력 × runCost) · AI 는 먼 다가감에서 스틱 끝
//  모두 기울기(몫 · 문턱 이동)이고 대가는 몸이 진다: 박찬 걸음은 기력 12 · 세게 멈춤 · 달림은 기력이 빨리 닳고, 빠르게 다가오는 몸은 고노센 창 · 맞박자(+30 %)의 먹잇감 그대로.
// ─────────────────────────────────────────────────────────────
import { DIG_PROTO as D, GAIT, STAMINA, SECRET, PHYSICS } from './config.js';

/** 시제품 하나라도 켜졌나 (ai.js 다가감 걸음 자리 — 끄면 부르지 않음) */
export const digProtoOn = () => !!(D.ai || D.step || D.run);

const statsOf = (ai) => (ai.stats.digP ??= { dash: 0, runT: 0, stepIn: 0, cross: 0, keep: 0, wall: 0 });

/** 기술의 앞 걸음 몫 m (기술 걸음 'strike' — 칼이 나갈 때 딛는 걸음 · 'chineseStep' 은 SECRET 칸) */
export function techStepFwd(t) {
  const st = t?.step;
  if (!st || st.when !== 'strike' || st.back) return 0;
  const f = typeof st.fwd === 'number' ? st.fwd : typeof st.fwd === 'string' ? SECRET[st.fwd] ?? 0 : 0;
  return f > 0 ? f : 0;
}

// ── A. AI 판단 ──

/** A2 헛친 틈을 노리는 거리 (opportunity — 파고들기 판): 끄면 옛 셈 그대로(내 칼끝 · 상대 칼끝 어림 가운데 먼 쪽) · 켜면 건널 수 있는 거리(칠 거리 + crossT × 앞 걷는 빠르기)까지만 */
export function digRecoverReach(ai) {
  const r = Math.max(ai.M.reach, ai.foeReach);
  if (!D.ai) return r;
  return Math.min(r, ai.M.contact + 0.05 + D.crossT * GAIT.moveSpeed);
}

/** A3 칼을 내는 거리 덧 (attack 다가감 — 파고들기 판 · A 켬): 걸음 실린 기술은 그 앞 걸음 몫만큼 일찍 */
export function digStepIn(ai, t) {
  if (ai.feint || ai.secretRun) return 0;
  const f = techStepFwd(t) * D.stepIn;
  if (f > 0 && ai.digInSeq !== ai.atkSeq) (ai.digInSeq = ai.atkSeq), statsOf(ai).stepIn++; // 재기: 공격 하나에 한 번
  return f;
}

/** A3 기술 고르기 곱 (pickTech — 파고들기 판 · A 켬): 걸음 실린 기술(앞 걸음 · 다가가며 딛는 기술)을 (1 + 띠 기울기) 배 */
export function digTechW(ai, t0) {
  const st = t0?.step;
  const fwd = techStepFwd(t0) || (st?.when === 'approach' && typeof st.fwd === 'number' && st.fwd > 0 ? st.fwd : 0);
  return fwd > 0 ? 1 + (ai.digK ?? 0) : 1;
}

/** A4 이어 칠 몫 (afterStrike — 파고들기 판 · A 켬): 맞히거나 막혔으면(붙음) 들어간 거리를 지킴 */
export function digKeepWant(ai, want) {
  if (!(ai.hitLanded || ai.bound)) return want;
  statsOf(ai).keep++;
  return want + (1 - want) * D.keep * (ai.digK ?? 0);
}

/** A5 공격 문턱 (watch — 파고들기 판 · A 켬): 상대 등이 울타리 가까이(보이는 자리)거나 상대가 지쳤으면(머리 위 막대) 물러섬 끝 — 몰아침. 큰 틈은 그대로 */
export function digWallNeed(ai, need) {
  const foe = ai.foe;
  const p = foe.bodies?.pelvis?.translation();
  const atWall = p && Math.hypot(p.x, p.z) > D.wall;
  const tired = (foe.stamina?.level ?? 0) > 0 || !!foe.stamina?.exhausted;
  if (!atWall && !tired) return need;
  statsOf(ai).wall++;
  return need - D.wallNeed * (ai.digK ?? 0);
}

// ── B. 앞 박차기 (AI 몫 — 사람 몫은 gait.js 걷기 시작) ──

/**
 * AI 다가감 첫 걸음을 박참: 사람과 같은 '서 있음'(골반 빠르기 burstStandV 아래 · 두 발 땅 · 박찬 뒤 세게 멈춤 끝남)에서만 · 걸음 장치 burst(dig — fastBegin 이 앞 걸음일 때 씀).
 *  독일(파고들기 두 걸음 — 사람 G2 와 같은 GAIT.digSteps) · 그 밖 DIG_PROTO.stepN. 걸었으면 true
 */
export function aiFrontDash(ai) {
  const f = ai.me;
  const g = f.gait;
  if (!g?.active || g.burst || g.burstBrake || g.fastK > 1 || f.feetHeld || f.finish?.amt > 0.5 || f.state !== 'stand') return false;
  if (Math.hypot(g.vf.x, g.vf.z) >= GAIT.burstStandV || !(g.legs.F.stance && g.legs.B.stance)) return false;
  const n = GAIT.deDig && ai.art?.tradition === 'german' ? GAIT.digSteps : D.stepN;
  g.burst = { fore: 1, side: 0, lat: 0, foreOnly: false, dig: n };
  statsOf(ai).dash++;
  return true;
}

/**
 * AI 다가감 걸음 (moveFeet 준비 · 다가감 — 시제품이 하나라도 켜졌을 때만 부름): fwd = 지금 스틱 · gap = 칠 거리(준비는 칼끝 거리 + 0.2)까지 남은 거리.
 *  B: 공격 하나에 한 번 — gap ≥ dashGap 이면 첫 걸음을 박참(박찬 걸음 동안 스틱 끝) · C: gap ≥ runGap 이고 기력 runAt 이상이면 스틱 끝(달림) ·
 *  A: 파고들기 판의 헛친 틈 공격(recover) · 받으며 들어간 뒤 다시 들어감(dig)은 스틱 끝까지 (건넘)
 */
export function digFeet(ai, fwd, gap) {
  if (!(gap > 0) || ai.foeClosing > 0.5) return fwd;
  const g = ai.me.gait;
  if (D.step && gap >= D.dashGap && ai.digDashSeq !== ai.atkSeq) {
    // 공격 하나에 한 번 — 사람과 같은 '서 있음'이 되면 박참 · 아니면 dashWait 동안 발을 멈춰 섬(사람도 서서 민다) · 그래도 안 되면 보통 걸음
    if (ai.digWaitSeq !== ai.atkSeq) (ai.digWaitSeq = ai.atkSeq), (ai.digWait = 0);
    if (aiFrontDash(ai)) ai.digDashSeq = ai.atkSeq;
    else if (ai.digWait < D.dashWait) {
      ai.digWait += PHYSICS.timestep; // 물리 한 스텝 (굴림 없음)
      return 0;
    } else ai.digDashSeq = ai.atkSeq;
  }
  if (D.step && g && ((g.burst && g.burst.dig) || g.digStep)) fwd = 1;
  if (D.run && gap >= D.runGap && (ai.me.stamina?.value ?? 0) >= D.runAt) fwd = 1;
  if (D.ai && ai.dig && (ai.why === 'recover' || ai.why === 'dig')) {
    const c = Math.min(1, Math.max(0.25, gap * 3));
    if (c > fwd) {
      fwd = c;
      if (ai.digCrossSeq !== ai.atkSeq) (ai.digCrossSeq = ai.atkSeq), statsOf(ai).cross++; // 재기: 공격 하나에 한 번
    }
  }
  return fwd;
}

// ── C. 달림 (사람 · AI 같은 몸 셈) ──

/**
 * fighter.js driveBalance — 걸음 장치에 넘기기 전 가려는 빠르기(want)에: 서 있고 · 기력 runAt 이상이고 · 스틱 앞 몫이 runStick 넘고 · 휘두르는 중이 아니면
 *  앞 몫을 runV ÷ 앞 걷는 빠르기 배로(박자는 걸음 장치가 빠르기 ÷ 보폭으로 따라 올림) · 달린 거리의 걸음 기력을 × runCost 로 더 냄(덧 몫만 — 걸음 기력은 stamina.js 그대로).
 *  f.running = 지금 달리나(재기 · 화면 없음)
 */
export function runTick(f, dt, want, fwd, mv) {
  const S = f.stamina;
  const run = !!S && !S.exhausted && S.value >= D.runAt && mv && mv.y >= D.runStick && !f.feetHeld && !f.skill?.swinging && !(f.skill?.lunge > 0) && !f.aiCtl?.secretRun;
  f.running = run;
  if (!run) return;
  const wf = want.x * fwd.x + want.z * fwd.z;
  if (!(wf > 0)) return;
  const k = D.runV / GAIT.moveSpeed;
  if (k > 1) want.addScaledVector(fwd, wf * (k - 1));
  const v = f.bodies.pelvis.linvel();
  const along = Math.max(0, v.x * fwd.x + v.z * fwd.z);
  const cost = STAMINA.stepCosts?.[f.swordArt?.tradition] ?? STAMINA.stepCosts?.default ?? 0;
  if (D.runCost > 1 && cost > 0 && along > 0) S.spend('move', ((D.runCost - 1) * cost * Math.min(along, STAMINA.maxWalkSpeed) * dt) / STAMINA.stepDistance);
  if (f.aiCtl) statsOf(f.aiCtl).runT += dt;
}

