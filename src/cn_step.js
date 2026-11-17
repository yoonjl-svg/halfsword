// ─────────────────────────────────────────────────────────────
//  동방 보법 회피 '편섬(偏閃)' (11/15 사장님 '동방은 단순하게 접근하자. 발을 떼고 n초 이내에 받은 피해는 n% 감소.' → '방향을 꺾은 순간으로 하자. 그렇다고 항상 켜지면 안돼.
//   0.4초 50% 감소.' · 첫 안 '동방은 비켜 들기를 응용하되 보법으로 풀어보자 …' · 값 config CN_STEP · 기록 docs/strike/cn_step_2026-11-15.md)
//  원전: 조선세법 點劍勢 「偏閃奏進」(비껴 피하며 빠르게 나아감 — 무비지 권86 쪽155 · 『무예도보통지』 권2 예도 p035) · 展翅勢 손 이름 偏閃(쪽167 · p041).
//  동방 몸(무기 유파 chinese · 사람은 보법 I '가벼운 발' C1 열쇠 footwork) · 사람 · AI 같게 — 같은 스틱(fighter.move)을 같은 셈으로 읽음:
//   꺾음: 걷는 중 걷는 방향을 turnT 안에 turn 넘게 꺾으면 그 때부터 keepT 동안 칼날 상처(베기 · 찌르기) × (1 − cut) · 서 있다 걷기 시작은 꺾음 아님 ·
//    '항상 켜지면 안돼' — 건 때부터 rearm 안의 꺾음은 다시 걸지 않음(한도 ①) · straight 넘게 곧게 걸은 뒤의 꺾음만(한도 ② — 견줌 · 기본 0)
//  AI 동방 꺾음: 偏閃奏進(ai_plan_cn.js cnDive — 칼을 보면 aiT 꺾고 곧장 뛰어들어 벰)이 꺾는 스틱을 여기(cnAiTurn)서 냄.
//  (11/17 — 견줌용 첫 시제품 ⓐ 꺾어 딛기 · ⓑ 줄임만 · ⓒ 저절로 비킴과 끔 판은 지움)
// ─────────────────────────────────────────────────────────────
import { CN_STEP as C, GAIT } from './config.js';
import { kitOff } from './skill_kit.js';

/** 이 몸이 편섬을 쓰나 */
export function cnStepOn(f) {
  return f?.swordArt?.tradition === 'chinese' && f.schoolFootwork !== false && !kitOff(f, 'footwork');
}

const stOf = (f) => (f.cnStep ??= { keepUntil: -1, ax: 0, ay: 0, aOk: false, bx: 0, by: 0, bOk: false, hT: -Infinity, lastTrig: -Infinity, straightT: 0, n: { trig: 0, cut: 0, turn: 0, block: 0, onT: 0, T: 0, dive: 0 } });

/** 칼이 오는 반대쪽 옆 (+1 오른 · −1 왼) — 줄 이름(내 몸 쪽)으로: 오른쪽으로 오면 왼쪽으로 · 가운데 · 찌르기는 dflt */
export function awaySide(th, dflt) {
  const L = th?.line ?? '';
  return L.endsWith('R') ? -1 : L.endsWith('L') ? 1 : dflt;
}

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

/** 스텝마다 (fighter.js — 걸음을 정하기 전): 꺾음 */
export function cnStepTick(f, dt) {
  if (!cnStepOn(f)) return;
  turnTick(f, dt, stOf(f));
}

/** 칼날 상처 심각도에 곱할 몫 (combat.js analyze) — 꺾은 때부터 줄임 시간 안이면 1 − cut */
export function cnStepKeep(vic) {
  const S = vic.cnStep;
  if (!S || !cnStepOn(vic)) return 1;
  const t = vic.stamina.time;
  if (t <= S.keepUntil) {
    S.n.cut++;
    return 1 - C.cut;
  }
  return 1;
}

/** AI 동방 꺾는 스틱 (ai.js moveFeet 끝): 偏閃奏進이 꺾는 동안(막기 꼴 · aiT) 칼이 오는 반대쪽 옆 스틱 · 막기 꼴을 벗어났으면(맞음 · 새 공격) 버림. 돌려줌: [fwd, side] (바꾸지 않으면 그대로) */
export function cnAiTurn(ai, fwd, side) {
  const D = ai.cnDive; // ai_plan_cn.js cnDive
  if (!D) return [fwd, side];
  if (ai.mode !== 'defend') return (ai.cnDive = null), [fwd, side];
  return [0, D.side];
}
