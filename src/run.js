// ─────────────────────────────────────────────────────────────
//  뛰기 (11/18 사장님 '생사전에서 더 적극적인 전략이 가능하려면 이동 속도가 지금보다 빨라져야 할 거 같아. 지금은 걷기만 하니까 '뛰기' 기능을 만들자.
//   우선 이동용 스틱 크기를 지금보다 조금 키우고 스틱을 가장 극단적인 값으로 밀면 뛰게 해.' → 같은 날 빠르기 걷기의 2 배 · 기력 걷기의 1.5 배 ·
//   '대신 기력 회복이 안 되는 걸로' · 기력 50 이상에서 시작 0 까지 — 값 config RUN · 기록 docs/strike/run_2026-11-18.md)
//
//  누가: 스틱 길 몫(f.runReach)을 두는 몸 — 사람(main.js · 프레임마다) · 셋 이상 판 AI(11/19 사장님 '뛰기 AI에도 넣고 무리 싸움에 먼저 넣어.' — src/ai_run.js 가
//   사람과 같은 칸 runReach · stickX · stickY · move · runBreak 를 두고 '언제 미나'만 정함). fighter.step 은 사람 몸에는 늘 · 다른 몸에는 runReach 를 둔 때부터 runStep 을 부른다.
//   규칙 · 값은 몸을 가리지 않는다 (아래 모두 사람 · AI 같음 — AI 몫 빠르기 · 기력 · 돌기 값 없음).
//  1:1 AI · 시뮬 대본 몸은 runReach 를 두지 않아 f.run 이 없고 걸음 · 몸 돌림 · 기력 셈이 한 글자도 다르지 않다(관문 바이트 같음).
//
//  걷기와 뛰기는 두 상태다 (빠르기를 스틱에 비례해 잇지 않음 — 걷기는 전과 같은 걷기):
//   들어감  스틱을 길 끝(손잡이 길의 RUN.stickIn 몫 넘게 · PC 는 Shift + 방향 키)까지 민 채 RUN.hold(실제 2 s — 11/21 사장님 '끝까지 밀고 2초 이상 유지하면 뛰기 시작.') 넘게 버팀 · 기력 RUN.startAt(50) 이상 · 서 있음 · 다리 걸음 · 공격 · 막기 · 기술 걸음 · 비기 · 밀치기 · 줍기가 아님 ·
//          지난 뛰기를 공격 · 막기로 끊었으면 스틱을 한 번 RUN.stickOut 안으로 되돌린 뒤(다시 걺 — armed · Shift 는 떼었다 누름)
//   나감    스틱이 RUN.stickOut 안으로 돌아옴(들락날락 막는 사이 띠) · 기력이 RUN.stopAt(0)까지 닳음 · 공격 · 막기 입력(곧바로 — 몸은 RUN.accel 한도로 줄어듦) ·
//          넘어짐 · 탈진 · 발 묶임 …
//
//  뛰는 동안
//   · 방향 = 스틱 방향을 상대 틀(나 → 상대가 앞 — 카메라가 보는 틀)에서 읽음. 몸은 그쪽으로 돈다(등이 상대에게 열림 — fighter.updateHeading 이 runFace 를 읽음 · 빠르기 BODY.turnSpeed 그대로).
//     걸음 장치가 읽는 조종 입력(f.move)은 그 방향을 몸 틀로 옮긴 값 — 돌아서는 동안(사이 각 > RUN.alignMax)은 스틱 × RUN.turnMove 로 거의 그 자리에서 돌고 몸이 그쪽을 보면 앞걸음.
//     뒤 · 옆 끝으로 밀어도 몸이 돌아 그쪽으로 뛴다(상대를 보며 뒷걸음으로 뛰지 않음 — 옆 · 뒤 배율 없음).
//     끝난 뒤 몸이 다시 상대를 볼 때까지(RUN.faceTol 안)도 상대 틀로 읽음 — 등진 채 스틱을 뒤로 밀면 몸 틀로는 '뒷걸음 = 상대 쪽'이 되므로. 다 돌면 전과 같은 걷기(몸 틀)
//   · 빠르기 = 걷는 앞 몫 + 덧 빠르기(걷는 앞 몫 × (RUN.mul − 1) — 11/20 mul 3 → 11/21 사장님 '너무 빠르더라. 2.5배로 하고' mul 2.5: 보통 실제 5.0 m/s) (runWant — 몸이 뛰는 쪽을 볼수록 다 실림 · 다친 다리 · 판금 · 무기 발 빠르기 · 유파 걸음 빠르기 · 진흙이 걷기처럼 곱해짐) ·
//     덧 빠르기는 RUN.accel 로만 오르내리고 몸 빠르기 + RUN.lead 를 넘지 않음 · 발로 내는 가속 한도도 RUN.accel (뛰는 동안 · 뛰다 멈춰 몸이 걷는 끝 빠르기로 줄 때까지 — fighter.driveBalance)
//   · 걸음 꼴 = gait.js 가 f.run.k(0 → 1, 뛰기 들어감 · 나감에 RUN.blend s 로 옮겨 감 — 뛰다 멈춰 줄어드는 동안(fast)도 1 쪽)만큼 뛰는 걸음 값으로 섞음 (보폭 상한 · 박자 · 두 발 디딤 · 무릎 · 골반 높이 · 덜 나감 문턱).
//     날며 뛰기 (11/20 — 빠르기 × 3): 몸 앞으로 RUN.flyFrom 넘게 빠르면 한 발 디딤을 짧게 · 두 발 모두 뜬 채 나감(긴 걸음 · 느린 박자 — gait.js fly · RUN.fly*)
//   · 꺾기 (11/20): 내달리는 동안 뛰는 쪽은 RUN.curve 로 둥글게 돈다 · RUN.curveMax 넘게 거꾸로 민 스틱은 먼저 줄인 뒤 돌아섬(R.brake)
//   · 끝난 뒤 (11/20): 몸이 걷는 끝 × RUN.faceSlow 넘게 가는 동안은 가는 쪽을 봄(runFace) — 서고 나서 상대 쪽으로 돎
//   · 기력 = 초당 runCostRate(그 몸이 걷는 끝 빠르기로 걸을 때 초당 걸음 기력 × RUN.cost — 11/20 사장님 '걷기의 2배' 1.5 → 2) · 자연 회복 없음 (stamina.js — 걸은 거리 셈은 쉼)
//  화면 글자 없음 (스틱 테두리만 뛰는 동안 조금 밝게 — main.js · index.html #moveStick.run · 11/21 끝까지 민 채 버티는 동안 테두리가 차오름 — #moveStick::before --runHold = R.hold ÷ RUN.hold)
// ─────────────────────────────────────────────────────────────
import { RUN, GAIT, STAMINA, ARMOR } from './config.js';
import { kitOff } from './skill_kit.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** 이 몸의 뛰기 상태 (처음 부를 때 만든다). fast = 뛰는 가속 한도를 쓰는 동안(뛰는 중 · 뛰다 멈춰 줄어드는 중) · back = 스틱을 상대 틀로 읽는 동안 */
export function runState(f) {
  return (f.run ??= { on: false, armed: true, k: 0, vb: 0, fast: false, back: false, brake: false, curve: false, m0: 0, mx: NaN, my: NaN, dx: 1, dz: 0, fx: undefined, fz: undefined, end: null, runs: 0, runT: 0, hold: 0, ha: 0 });
}

/** 공격 · 막기 · 기술 중인가 (뛰기를 끊고 다시 들어가지 못하게) — 몸 상태 그대로 (사람 · AI 같음) */
export function runBusy(f) {
  const sk = f.skill;
  return !!(sk?.swinging || sk?.tap || sk?.pom || sk?.sec || sk?.lunge > 0 || sk?.uniq?.winding || f.stamina?.attacking || f.stamina?.guarding || f.iaiDraw || f.ibLink || f.gait?.req || f.barge || f.pickup || f.autoPick);
}

/** 뛸 수 있는 몸인가 (스틱 · 기력 · 다시 걺 빼고) */
function canRun(f) {
  return f.alive && f.state === 'stand' && !!f.gait?.active && !f.feetHeld && !f.stamina?.exhausted && !(f.finish?.amt > 0.5) && !f.revival && !f.ringHit;
}

/** 그 몸이 앞으로 걷는 끝 빠르기 (m/s, 게임) — fighter.driveBalance 걷는 빠르기와 같은 곱 · 유파 걸음 빠르기(P.speedMul — 일본 0.70) */
export function walkTopOf(f) {
  const P = f.gait?.P ?? GAIT;
  return GAIT.moveSpeed * (0.45 + 0.55 * (f.legHealth ?? 1)) * (f.weapon?.moveMul ?? 1) * (f.wearsPlate?.() ? ARMOR.moveMul : 1) * (P.speedMul || 1);
}

/** 걸음 기력 (0.6 m 마다 — stamina.js 걷기 셈과 같은 고르기: 보법을 안 익혔거나 걷기 기력 칸이 없으면 보통) */
export function stepCostOf(f) {
  return STAMINA.stepCosts[f.schoolFootwork === false || kitOff(f, 'stepCost') ? 'default' : f.swordArt?.tradition] ?? STAMINA.stepCosts.default;
}

/** 뛰는 동안 초당 기력 (게임 초당): 그 몸이 앞으로 걷는 끝 빠르기로 걸을 때 초당 걸음 기력 × RUN.cost */
export function runCostRate(f) {
  return (stepCostOf(f) / STAMINA.stepDistance) * walkTopOf(f) * RUN.cost;
}

/**
 * 스텝마다 (fighter.step — updateHeading 앞 · 이름 runStep — 시제품 C 의 dig_proto.js runTick 과 다름): 들어감 · 나감 · 방향 · 걸음 꼴 섞기(k) · 가속 한도 창(fast) · 조종 입력을 몸 틀로.
 *  읽는 입력(사람 main.js 가 프레임마다 · AI ai_run.js 가 스텝마다 둠): f.runReach — 스틱 손잡이 길 몫(0 ~ 1, PC Shift + 방향이면 1 · AI 는 뛸 때 1) · f.stickX · stickY — 스틱(상대 틀) ·
 *  f.runBreak — 이 프레임에 공격 · 막기 입력이 있었음(읽으면 지움 — AI 는 공격 · 막기 · 비기 꼴)
 */
export function runStep(f, dt) {
  const R = runState(f);
  const S = f.stamina;
  const v = S?.infinite ? Infinity : S?.value ?? 0;
  const reach = f.runReach || 0;
  const brk = !!f.runBreak;
  f.runBreak = false;
  if (reach < RUN.stickOut) R.armed = true; // 스틱을 되돌렸으면 다시 걺 (공격 · 막기로 끊긴 뒤)
  const busy = runBusy(f);
  const sx = f.stickX || 0;
  const sy = f.stickY || 0;
  const dirOk = sx * sx + sy * sy > 1e-6;
  // 앞 반원만 (11/20 사장님 '뒤돌아 뛰는 거 자체를 없애는 게 나을 수도 있어 카메라 워크가 애매하면...'): 스틱이 상대 쪽에서 RUN.arc(rad) 안일 때만 뛴다 — 앞 · 옆 · 비스듬히 앞.
  //  뒤 반원(비스듬히 뒤 · 뒤)은 뛰지 않고 전처럼 걷기(뒷걸음 — 몸은 상대를 봄 · 카메라 그대로). 뛰는 중 스틱이 RUN.arc + RUN.arcOut 밖으로 가면 걷기(옆 끝에서 엄지가 조금 흔들려도 들락날락하지 않게)
  const front = dirOk && Math.atan2(Math.abs(sx), sy) <= RUN.arc + (R.on || R.hold > 0 ? RUN.arcOut : 0);
  if (R.on) {
    let why = null;
    if (brk || busy) why = 'break';
    else if (v <= RUN.stopAt) why = 'stamina';
    else if (reach < RUN.stickOut || !front) why = 'stick';
    else if (!canRun(f)) why = 'state';
    if (why) {
      R.on = false;
      R.end = why;
      if (why === 'break') R.armed = false; // 끊은 뒤 스틱을 그대로 밀고 있어도 다시 뛰지 않음 — 한 번 되돌렸다 밀어야
    }
  } else {
    // 들어가기 (11/21 사장님 '끝까지 밀고 2초 이상 유지하면 뛰기 시작.'): 스틱을 끝(RUN.stickIn)까지 민 채 RUN.hold(실제 2 s) 넘게 버티면 뜀 — 그동안은 걷기.
    //  버티는 셈(R.hold)은 뛸 수 있을 때만 — 앞 쪽 · 기력 RUN.startAt 이상 · 서 있음 · 다시 걺 · 공격 · 막기 아님 (하나라도 깨지면 처음부터).
    //  스틱이 RUN.stickOut 안으로 돌아오거나 · 버티기 시작한 스틱 방향에서 RUN.holdTurn(rad) 넘게 돌면 처음부터 (그 자리에서 새로 셈)
    const ang = Math.atan2(sx, sy);
    const ok = front && R.armed && v >= RUN.startAt && !brk && !busy && canRun(f);
    if (R.hold > 0 && (!ok || reach < RUN.stickOut || Math.abs(wrap(ang - R.ha)) > RUN.holdTurn)) R.hold = 0;
    if (ok && (R.hold > 0 || reach >= RUN.stickIn)) {
      if (!(R.hold > 0)) R.ha = ang;
      R.hold += dt;
      if (R.hold >= RUN.hold - 1e-9) { // (스텝 dt 를 거듭 더한 셈의 끝자리 어긋남 — 1e-9)
        R.on = true;
        R.end = null;
        R.runs++;
        R.hold = 0;
      }
    }
  }
  if (!R.on && f.state !== 'stand') R.vb = 0; // 넘어짐 · 무릎 — 덧 빠르기(runWant)를 버림
  if (R.on) R.runT += dt;
  // 뛰는 가속 한도 창: 뛰는 동안 + 끝난 뒤 몸 수평 빠르기가 걷는 끝 빠르기(+ 10 %)로 줄 때까지
  const pv = f.bodies.pelvis.linvel();
  R.fast = R.on || (R.fast && Math.hypot(pv.x, pv.z) > walkTopOf(f) * 1.1 && f.state === 'stand');
  // 걸음 꼴 섞임: 뛰는 동안 · 뛰다 멈춰 줄어드는 동안(fast — 11/20: 뛰는 빠르기에서 걷는 걸음 꼴로 돌아가면 발이 못 따라감) 1 쪽으로
  R.k = clamp(R.k + (R.fast ? dt : -dt) / RUN.blend, 0, 1);
  // 상대 틀 (나 → 바라볼 곳이 앞 — fighter.updateHeading 이 몸을 돌리는 쪽과 같은 셈). 너무 붙었으면 지난 틀
  const p = f.bodies.pelvis.translation();
  const tg = f.pickup?.face ?? f.faceTarget;
  if (tg) {
    const ax = tg.x - p.x;
    const az = tg.z - p.z;
    const n = Math.hypot(ax, az);
    if (n > 0.3) (R.fx = ax / n), (R.fz = az / n);
  }
  if (R.fx === undefined) (R.fx = Math.cos(f.heading)), (R.fz = -Math.sin(f.heading));
  const fx = R.fx;
  const fz = R.fz;
  // 돌아옴: 뛰기가 끝난 뒤 몸이 다시 상대를 볼 때까지(앞 사이 각 RUN.faceTol 안)는 스틱을 상대 틀로 읽음
  if (R.on) R.back = true;
  else if (R.back && (f.state !== 'stand' || Math.abs(wrap(Math.atan2(-fz, fx) - f.heading)) < RUN.faceTol)) R.back = false;
  if (!R.back) return void (R.mx = NaN);
  // 뛰는 방향 = 스틱(상대 틀 — 앞 = 상대 쪽 · 오른쪽 = (−앞.z, 앞.x) fighter.right 와 같은 틀)
  //  사람 몸 화면 틀 (11/21 사장님 '카메라 문제야 이건.'): main.js 가 뛰는 동안 카메라를 천천히 돌리는 동안(camRunYaw)은 f.runFrame = 카메라 방위(화면 위)를 두고 스틱을 그 틀로 읽는다 —
  //   카메라가 상대 쪽보다 늦게 도는 동안에도 스틱 오른쪽 = 화면 오른쪽. 카메라가 상대 쪽을 다시 보면 null (상대 틀 — 둘이 같음) · AI · 대본 몸은 두지 않음(늘 상대 틀)
  //  내달리는 동안 꺾기 (11/20): 몸 빠르기가 걷는 끝 × RUN.curveFrom 을 넘으면 뛰는 쪽은 초당 RUN.curve ÷ 빠르기(rad — 옆으로 내는 가속 RUN.curve m/s²)까지만 돈다(둥글게 꺾음).
  //   지금 뛰는 쪽에서 RUN.curveMax 넘게 돌린 스틱(거꾸로 · 비스듬히 뒤)은 그쪽으로 돌지 않고 먼저 줄인다(R.brake — 덧 빠르기 0 · runWant) → 그 빠르기 밑으로 줄면 그 자리에서 돌아섬(전과 같음)
  R.brake = false;
  if (dirOk) {
    const gx = f.runFrame ? f.runFrame.x : fx;
    const gz = f.runFrame ? f.runFrame.z : fz;
    const dx = gx * sy - gz * sx;
    const dz = gz * sy + gx * sx;
    const dn = Math.hypot(dx, dz);
    const vh = Math.hypot(pv.x, pv.z);
    if (R.on && R.curve && vh > walkTopOf(f) * RUN.curveFrom) {
      const a0 = Math.atan2(R.dz, R.dx);
      const a = wrap(Math.atan2(dz, dx) - a0);
      if (Math.abs(a) > RUN.curveMax) R.brake = true;
      else {
        const m = (RUN.curve / vh) * dt;
        const b = a0 + clamp(a, -m, m);
        R.dx = Math.cos(b);
        R.dz = Math.sin(b);
      }
    } else {
      R.dx = dx / dn;
      R.dz = dz / dn;
    }
    R.curve = R.on; // (뛰기를 막 시작한 스텝은 스틱 쪽 그대로)
  }
  // 걸음 장치 · 기력 셈이 읽는 조종 입력(몸 틀)을 그 방향으로 — 크기(스틱 · 감정 배율)는 그대로.
  //  뛰는 동안 몸이 아직 뛰는 쪽을 보지 않으면(돌아서는 중) 크기를 줄인다 — 사이 각이 RUN.alignMax 넘으면 RUN.turnMove · 그 안에서는 각 0 의 1 까지 곧게
  //  (옆 · 뒷걸음으로 내달리며 돌면 걸음이 균형을 잃는다 — 거의 그 자리에서 돌아선 뒤 뜀)
  //  (11/20 고침: 사람 몸은 스틱을 화면마다 한 번 두고 물리 스텝은 화면마다 2 ~ 6 번 — 두 번째 스텝부터는 이 함수가 지난 스텝에 둔 몸 틀 입력을 다시 읽어 크기를 또 줄였다(돌아서는 동안 × 0.2 가 거듭 곱해짐).
  //   지난 스텝에 둔 그대로면 그때 읽은 크기를 쓴다 — 스텝마다 입력을 두는 몸(AI · 시뮬 대본)은 전과 같음)
  let m = f.move.x === R.mx && f.move.y === R.my ? R.m0 : Math.hypot(f.move.x, f.move.y);
  R.m0 = m;
  if (!(m > 0)) return;
  const bf = Math.cos(f.heading);
  const bz = -Math.sin(f.heading);
  if (R.on) {
    const th = Math.acos(clamp(R.dx * bf + R.dz * bz, -1, 1));
    m *= th >= RUN.alignMax ? RUN.turnMove : RUN.turnMove + (1 - RUN.turnMove) * (1 - th / RUN.alignMax);
  }
  f.move.set(m * (R.dx * -bz + R.dz * bf), m * (R.dx * bf + R.dz * bz));
  R.mx = f.move.x;
  R.my = f.move.y;
}

/** 뛰는 동안 바라볼 쪽 (fighter.updateHeading · gait.headAhead — 몸이 뛰는 쪽을 봄 · 아니면 null — 상대 쪽).
 *  뛰기가 끝난 뒤(돌아오는 동안 — back) 몸이 아직 걷는 끝 빠르기 × RUN.faceSlow 넘게 가는 동안은 몸이 가는 쪽을 본다 (11/20 — 내달리는 채로 몸만 상대 쪽으로 돌리면
 *  뒷걸음 · 옆걸음으로 내달리게 되어 발이 못 따라감 — 서고 나서 돈다) */
export function runFace(f) {
  const R = f.run;
  if (R?.on) return Math.atan2(-R.dz, R.dx);
  if (R?.back && f.state === 'stand') {
    const v = f.bodies.pelvis.linvel();
    const w = walkTopOf(f) * RUN.faceSlow;
    if (v.x * v.x + v.z * v.z > w * w) return Math.atan2(-v.z, v.x);
  }
  return null;
}

/**
 * 가려는 속도에 뛰는 몫을 더함 (fighter.driveBalance — 걸음 장치에 넘기기 전): 몸 앞 몫에 걷는 앞 몫 × (RUN.mul − 1) 을 덧 빠르기(R.vb)로 —
 *  몸이 뛰는 쪽을 볼수록 다 실림(뛰는 쪽과 몸 앞 사이 각이 RUN.alignMax 를 넘으면 0 — 돌아서는 동안은 걷는 빠르기).
 *  덧 빠르기는 곧장 붙지 않고 RUN.accel 로만 오르내린다 · 가려는 앞 빠르기가 몸이 낸 앞 빠르기보다 RUN.lead 넘게 앞서지 않음 — 몸이 따라갈 수 있는 가려는 속도라야
 *  균형 셈(캡처 점 · 다음 발 자리)이 '넘어지는 중'으로 읽지 않는다. 뛰기가 끝나면(공격 · 막기 · 스틱 · 기력) 같은 가속으로 0 까지 내려온다 — 몸이 한 번에 서지 않음.
 *  걷는 몫(균형 걸음 · 진흙 · 지침 배율이 섞인 가려는 속도)은 손대지 않는다
 */
export function runWant(f, want, fwd, dt) {
  const R = f.run;
  if (!R || (!R.on && !(R.vb > 0))) return;
  const wf = want.x * fwd.x + want.z * fwd.z;
  let tgt = 0;
  if (R.on && !R.brake && wf > 0) {
    const c = clamp(R.dx * fwd.x + R.dz * fwd.z, -1, 1);
    tgt = wf * (RUN.mul - 1) * clamp(1 - Math.acos(c) / RUN.alignMax, 0, 1);
  }
  const step = RUN.accel * dt;
  let b = (R.vb || 0) + clamp(tgt - (R.vb || 0), -step, step);
  // 걷는 몫 + 덧 빠르기가 몸 앞 빠르기 + lead 를 넘지 않음 — 몸이 따라오는 만큼만 (밀리거나 걸려 느려지면 명령도 같이 내려옴).
  //  명령은 유파 걸음 빠르기(P.speedMul — 일본 0.70)를 곱하기 전 값이라 몸 빠르기도 그 몫으로 나눠 견줌
  const v = f.bodies.pelvis.linvel();
  const vb = Math.max(0, v.x * fwd.x + v.z * fwd.z) / (f.gait?.P?.speedMul || 1);
  b = Math.min(b, vb + RUN.lead - Math.max(0, wf));
  R.vb = b > 1e-6 ? b : 0;
  if (R.vb > 0) want.addScaledVector(fwd, R.vb);
}

/** 뛰는 동안의 기력 (stamina.js step — 걷기 셈 대신): 초당 runCostRate · stopAt 아래로는 깎지 않음 · 자연 회복 쉼(회복 시계를 0 으로 — 끝나면 recoverDelay 뒤 회복) */
export function runSpend(S, f, dt) {
  S.rest = 0;
  const room = S.value - RUN.stopAt;
  const amt = Math.min(runCostRate(f) * dt, Math.max(0, room));
  if (amt > 0) S.spend('move', amt); // 마지막 스텝은 남은 몫 그대로(value − room = stopAt 딱) — 0 밑(지침)으로 넘지 않음
}
