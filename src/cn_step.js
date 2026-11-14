// ─────────────────────────────────────────────────────────────
//  동방 보법 회피 '편섬(偏閃)' (11/15 사장님 '동방은 단순하게 접근하자. 발을 떼고 n초 이내에 받은 피해는 n% 감소.' → '방향을 꺾은 순간으로 하자. 그렇다고 항상 켜지면 안돼.
//   0.4초 50% 감소.' · 첫 안 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · 값 config CN_STEP · 기록 docs/strike/cn_step_2026-11-15.md)
//  원전: 조선세법 點劍勢 「偏閃奏進」(비껴 피하며 빠르게 나아감 — 무비지 권86 쪽155 · 『무예도보통지』 권2 예도 p035) · 展翅勢 손 이름 偏閃(쪽167 · p041).
//  동방 몸(무기 유파 chinese · 사람은 보법 I '가벼운 발' C1 열쇠 footwork) · 사람 · AI 같게 — 같은 스틱(fighter.move)을 같은 셈으로 읽음:
//   'turn' 꺾음 (기본): 걷는 중 걷는 방향을 turnT 안에 turn 넘게 꺾으면 그 때부터 keepT 동안 칼날 상처(베기 · 찌르기) × (1 − cut) · 서 있다 걷기 시작은 꺾음 아님 ·
//    '항상 켜지면 안돼' — 건 때부터 rearm 안의 꺾음은 다시 걸지 않음(한도 ①) · straight 넘게 곧게 걸은 뒤의 꺾음만(한도 ② — 견줌 · 기본 0)
//   견줌용 첫 시제품 (공격 창 — 들어오는 칼을 본 때부터 win · 눈은 AI threat · 사람 막기 단추 위협 읽기):
//    ⓐ 'a' 꺾어 딛기: 창 안에 스틱을 turn 넘게 꺾거나 서 있다 걷기 시작하면 그 쪽으로 박찬 한 걸음 + slideT 동안 × (1 − cut)
//    ⓑ 'b' 줄임만: 같은 꺾음이면 창이 끝날 때까지 × (1 − cut) · ⓒ 'c' 저절로 비킴: 창이 열릴 때 치는 중이 아니고 기력이 있으면 칼이 오는 반대쪽으로 박찬 한 걸음 + 줄임
//  AI 동방 꺾음: 'turn' 은 偏閃奏進(ai_plan_cn.js cnDive — 칼을 보면 aiT 꺾고 곧장 뛰어들어 벰)이 꺾는 스틱을 여기(cnAiTurn)서 냄 · ⓐ ⓑ 는 창 하나에 한 번 굴려 꺾음.
//  끄면(mode 0) 어느 자리도 셈하지 않는다(굴림 없음 · 바이트 같음).
// ─────────────────────────────────────────────────────────────
import { CN_STEP as C, GAIT, STAMINA, AI_PLAN, realS } from './config.js';
import { kitOff } from './skill_kit.js';
import { tiltOf, luckOf } from './ai_plan.js';

const QUIET_T = realS(0.12); // 위협이 이만큼 없으면 창을 닫음 (ai.js · parry_button.js '공격이 지나갔다'와 같은 수)
const NEW_T = realS(0.25); // 조용했다가 다시 오면 새 공격 (ai.js · parry_button.js 와 같은 수)
const _m = { x: 0, y: 0 };

/** 이 몸이 편섬을 쓰나 */
export function cnStepOn(f) {
  return !!C.mode && f?.swordArt?.tradition === 'chinese' && f.schoolFootwork !== false && !kitOff(f, 'footwork');
}

const stOf = (f) => (f.cnStep ??= { open: null, quiet: 1, slideUntil: -1, keepUntil: -1, auto: null, ax: 0, ay: 0, aOk: false, bx: 0, by: 0, bOk: false, hT: -Infinity, lastTrig: -Infinity, straightT: 0, n: { win: 0, trig: 0, slide: 0, keep: 0, auto: 0, cut: 0, aiTurn: 0, turn: 0, block: 0, onT: 0, T: 0, dive: 0 } });

/** 본 위협 (AI threat · 사람 막기 단추 위협 읽기 — 스텝마다 부름) */
export function cnSee(f, th) {
  if (cnStepOn(f)) f.cnSeen = th || null;
}

/** 칼이 오는 반대쪽 옆 (+1 오른 · −1 왼) — 줄 이름(내 몸 쪽)으로: 오른쪽으로 오면 왼쪽으로 · 가운데 · 찌르기는 dflt */
export function awaySide(th, dflt) {
  const L = th?.line ?? '';
  return L.endsWith('R') ? -1 : L.endsWith('L') ? 1 : dflt;
}

/** 박찬 한 걸음 (걸음 장치 burst — 스틱 쪽 · gait.js 옆 박차기 · 뒤 박차기 · 파고들기 앞 걸음과 같은 꼴) · 줄임 시간 */
function slide(f, x, y, S) {
  const g = f.gait;
  if (!g?.active || g.burst || g.burstBrake || g.fastK > 1 || f.feetHeld || f.finish?.amt > 0.5 || f.state !== 'stand' || f.stamina?.exhausted) return false;
  const m = Math.hypot(x, y);
  if (!(m > 1e-6)) return false;
  if (Math.abs(x) >= Math.abs(y) * 0.5) g.burst = { fore: Math.sign(y), side: Math.sign(x), lat: (x * x) / (m * m) };
  else if (y < 0) g.burst = { fore: -1, side: 0, lat: 0, foreOnly: false };
  else g.burst = { fore: 1, side: 0, lat: 0, foreOnly: false, dig: 1 };
  S.slideUntil = f.stamina.time + C.slideT;
  S.n.slide++;
  return true;
}

/** 치는 중인가 (AI 공격 꼴 · 사람 휘두름 · 탭) */
const busy = (f) => (f.aiControlled ? f.aiCtl?.mode === 'attack' || f.aiCtl?.mode === 'secret' : !!(f.skill?.swinging || f.skill?.tap || f.skill?.sec));

/** 스틱이 몸을 걷게 하나 (가려는 빠르기 > GAIT.walkMin — secret.js gnsHumanMoving 과 같은 셈 · 새 수 없음) */
function walking(f, mv) {
  if (f.feetHeld || f.state !== 'stand' || (!mv.x && !mv.y)) return false;
  const along = mv.y * (mv.y < 0 ? GAIT.backFactor : 1);
  return Math.hypot(along, mv.x * GAIT.sideFactor) * GAIT.moveSpeed * (f.gait?.P?.speedMul || 1) > GAIT.walkMin;
}

/**
 * 'turn' 꺾음 (스텝마다): 걷는 방향 둘(turnT ÷ 2 마다 적음 — 앞 칸 A · 뒤 칸 B)을 두고 지금 방향을 A 와 견줌 — turn 넘게 바뀌었으면 꺾음.
 *  A 가 걷는 방향이 아니면(서 있었음) 꺾음 아님. 꺾음이면 두 칸을 지금 방향으로(같은 꺾음을 두 번 세지 않게).
 *  한도: 건 때부터 rearm 안 · straight 만큼 곧게 걷지 않았으면 걸지 않음(n.block). 셈: 배열 · 새 객체 없음
 */
function turnTick(f, dt, S) {
  const mv = f.move;
  const t = f.stamina.time;
  const on = walking(f, mv);
  const m = on ? Math.hypot(mv.x, mv.y) : 1;
  const x = on ? mv.x / m : 0;
  const y = on ? mv.y / m : 0;
  S.n.T += dt;
  if (t <= S.keepUntil) S.n.onT += dt;
  let turned = false;
  if (on && S.aOk && x * S.ax + y * S.ay <= Math.cos(C.turn) + 1e-9) {
    turned = true;
    S.n.turn++;
    if (t - S.lastTrig >= C.rearm && S.straightT >= C.straight) {
      S.keepUntil = t + C.keepT;
      S.lastTrig = t;
      S.n.trig++;
    } else S.n.block++;
    S.ax = S.bx = x;
    S.ay = S.by = y;
    S.aOk = S.bOk = true;
    S.hT = t;
  } else if (t - S.hT >= C.turnT / 2) {
    S.ax = S.bx;
    S.ay = S.by;
    S.aOk = S.bOk;
    S.bx = x;
    S.by = y;
    S.bOk = on;
    S.hT = t;
  }
  S.straightT = on && !turned ? S.straightT + dt : 0;
}

/** 스텝마다 (fighter.js — 걸음을 정하기 전): 'turn' 꺾음 · 견줌 ⓐ ⓑ ⓒ (창 열기 · 꺾음 읽기) */
export function cnStepTick(f, dt) {
  if (!cnStepOn(f)) return;
  const S = stOf(f);
  if (C.mode === 'turn') return turnTick(f, dt, S);
  const th = f.cnSeen;
  const mv = f.move;
  if (th) {
    if (!S.open && S.quiet > NEW_T) {
      S.open = { t: 0, x0: mv.x, y0: mv.y, trig: false, th, ai: null };
      S.n.win++;
      if (C.mode === 'c' && !busy(f) && (f.stamina?.value ?? 0) >= STAMINA.pushCost) {
        const side = awaySide(th, (f.index ?? 0) % 2 ? 1 : -1);
        if (slide(f, side, 0, S)) {
          S.auto = { x: side, y: 0, until: f.stamina.time + realS(0.2) };
          S.n.auto++;
        }
      }
    }
    S.quiet = 0;
  } else S.quiet += dt;
  const W = S.open;
  if (!W) return;
  W.t += dt;
  if (!W.trig && (C.mode === 'a' || C.mode === 'b')) {
    const m = Math.hypot(mv.x, mv.y);
    const m0 = Math.hypot(W.x0, W.y0);
    let trig = false;
    if (m >= GAIT.burstStick) {
      if (m0 < 0.2) trig = true; // 서 있다 걷기 시작
      else {
        const c = (mv.x * W.x0 + mv.y * W.y0) / (m * m0);
        trig = Math.acos(Math.max(-1, Math.min(1, c))) >= C.turn; // 크게 꺾음
      }
    }
    if (trig) {
      W.trig = true;
      S.n.trig++;
      if (C.mode === 'a') slide(f, mv.x, mv.y, S);
      else {
        S.keepUntil = f.stamina.time + Math.max(0, C.win - W.t);
        S.n.keep++;
      }
    }
  }
  if (W.t >= C.win || S.quiet > QUIET_T) S.open = null;
}

/** 저절로 비킴(ⓒ)이 스틱을 쥔 동안의 스틱 (fighter.js mvIn) — 아니면 null */
export function cnStepMove(f) {
  const A = f.cnStep?.auto;
  if (!A) return null;
  if (f.stamina.time > A.until) return (f.cnStep.auto = null);
  _m.x = A.x;
  _m.y = A.y;
  return _m;
}

/** 칼날 상처 심각도에 곱할 몫 (combat.js analyze) — 박찬 걸음 줄임 시간 · ⓑ 줄임 시간 안이면 1 − cut */
export function cnStepKeep(vic) {
  const S = vic.cnStep;
  if (!S || !cnStepOn(vic)) return 1;
  const t = vic.stamina.time;
  if (t <= S.slideUntil || t <= S.keepUntil) {
    S.n.cut++;
    return 1 - C.cut;
  }
  return 1;
}

/**
 * AI 동방 꺾는 스틱 (ai.js moveFeet 끝): 'turn' — 偏閃奏進이 꺾는 동안 옆 스틱 · 견줌 ⓐ · ⓑ — 창 하나에 한 번 굴려 꺾음 — 몫 = 띠 기울기 × ai + 굴림 몫 × coin. 꺾으면 aiT 동안 칼이 오는 반대쪽 옆 스틱.
 *  내 공격 중(준비 · 다가감 · 침 · 비기)인 창은 굴리지 않는다 — 꺾으면 제 칼을 버리게 됨. 돌려줌: [fwd, side] (바꾸지 않으면 그대로)
 */
export function cnAiTurn(ai, fwd, side) {
  const f = ai.me;
  if (C.mode === 'turn') {
    const D = ai.cnDive; // 偏閃奏進 (ai_plan_cn.js cnDive): 꺾는 동안(막기 꼴 · aiT) 칼이 오는 반대쪽 옆 스틱 · 막기 꼴을 벗어났으면(맞음 · 새 공격) 버림
    if (!D) return [fwd, side];
    if (ai.mode !== 'defend') return (ai.cnDive = null), [fwd, side];
    return [0, D.side];
  }
  const S = f.cnStep;
  if (!S || (C.mode !== 'a' && C.mode !== 'b') || !cnStepOn(f)) return [fwd, side];
  const W = S.open;
  if (W && W.ai == null && ai.mode !== 'attack' && ai.mode !== 'secret') { // 내 공격 중(준비 · 다가감 · 침)은 꺾지 않음 — 제 칼을 버리지 않게 (그 창은 굴리지 않고 지나감)
    const p = Math.min(1, tiltOf(ai.proficiency) * C.ai + luckOf(ai.proficiency) * AI_PLAN.coin);
    W.ai = Math.random() < p;
    if (W.ai) {
      let sd = awaySide(W.th, ai.pers?.circleDir || 1);
      if (Math.abs(side) > 0.5 && Math.sign(side) === sd && Math.abs(fwd) < 0.5) sd = -sd; // 이미 그 쪽으로 걷는 중이면 반대로 꺾음
      ai.cnTurn = { until: f.stamina.time + C.aiT, side: sd };
      S.n.aiTurn++;
    }
  }
  const T = ai.cnTurn;
  if (!T) return [fwd, side];
  if (f.stamina.time > T.until) {
    ai.cnTurn = null;
    return [fwd, side];
  }
  return [0, T.side];
}
