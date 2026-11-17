// ─────────────────────────────────────────────────────────────
//  공격 조이스틱 (11/17 — 사장님 '이동스위치처럼 공격 스위치를 만들어. 그걸로 공격해야 정교한 컨트롤이 되고 상대 공격을 막는 컨트롤 가능해져'
//   · 기록 docs/strike/atk_stick_2026-11-17.md · 확인표 4656 ~ · 켬 · 끔 = 설정 '공격 조이스틱'(사장님 11/17 — 기본 끔 · main.js settings.atkStick) ·
//   붙이기 input.js attachAtkStick · useAtkStick · 프레임 main.js playerInputFrame)
//
//  자리 조종: 손잡이 자리(오른쪽 +x · 위 +y · 길이 ≤ 1)가 손 목표(handOffset — 손가락 끌기와 같은 패드 m 공간)를 정한다.
//   가운데 = 긴 자세 자리(0, 0 — 칼끝이 상대를 겨눔) · 위 = 지붕 · 오른쪽 = 옆 자세 · 아래 = 바보 자세 쪽. 끝까지 민 손잡이 = 손 닿는 끝 WEAPON.reach
//   (손 목표가 잘리는 반지름 — 긴 손가락 끌기가 닿는 끝과 같은 자리). 데드존 = 이동 스틱과 같은 STICK_DEAD(0.15)를 빼고 0 → 1 로 다시 폄.
//  손이 따라가는 길 = 손가락과 같은 길: 프레임마다 손 목표에 더하는 몫 d 를 내 main.js 가 손가락 끌기 몫에 더한다 → 긋기 판정(SKILL.swingSpeed) · 비기 창 ·
//   공격 원 · 고유 동작 긋기 읽기 · 기력 청구 · 서보 · 몸의 한도 모두 손가락과 같다. 새 빠르기 · 새 힘 규칙은 없다 (사람 몸과 AI 몸은 같은 물리 한도).
//   ① 손잡이가 이 프레임 옮긴 몫은 그대로 — 빠른 튕김 = 같은 빠르기의 손가락 긋기. 손 목표는 엄지보다 빨리 움직이지 않는다.
//   ② 그 밖의 틈(처음 쥘 때 손잡이 자리와 손 사이 · 찌르기 · 비기 · 막기 · 감기가 손을 쥐었다 놓은 뒤)은 자세 복귀 빠르기 SKILL.recoverSpeed
//      (1.2 m/s — 휘두르기 문턱 1.5 보다 느림: 긋기로 세지 않음)로 메운다. 손잡이를 가만히 두면 칼이 그 자리에 머문다(막는 선을 쥐고 기다림).
//  얹은 엄지 (손가락의 길게 누름 한도 INPUT.holdPx · skill.js 얹은 손가락과 같은 뜻): 데드존 안에 닿고 holdPx 넘게 끌지 않은 엄지는 칼을 쥐지 않음 —
//   칼은 쉼 자세 그대로 · 이 엄지의 톡 = 찌르기 · 길게 누름 = 풍차 베기 · 알티바슈 포르트(손가락 길게 누름과 같은 길). 데드존 밖에 닿거나 holdPx 넘게 끌면 칼을 쥠(뗄 때까지).
//   쥔 동안은 길게 누름이 아님 — 막는 선을 쥐고 기다리는 엄지가 풍차 베기를 감지 않게.
//  손잡이를 떼면 손가락을 뗀 것과 같다: 손 목표는 그 자리에서 쉼 자세로 되돌아간다(skill.js 자세로 돌아가기 — 손가락과 같은 길).
// ─────────────────────────────────────────────────────────────
import { INPUT, SKILL, WEAPON } from './config.js';
import { STICK_DEAD } from './stick_turn.js';

/** 손잡이 상태 (input.js attachAtkStick 이 채운다): id = 쥔 포인터 · x y = 손잡이 자리 원값 · grip = 칼을 쥠 · prev = 지난 프레임 손 목표 자리 */
export function atkStickState() {
  return { id: null, held: false, x: 0, y: 0, x0: 0, y0: 0, travel: 0, grip: false, ring: false, prev: null };
}

/** 손잡이 자리 → 손 목표 (패드 m). 데드존 안 = 가운데(긴 자세 자리) · 끝 = 손 닿는 끝 */
export function atkStickTarget(x, y, out = { x: 0, y: 0 }) {
  const m = Math.hypot(x, y);
  const k = m <= STICK_DEAD ? 0 : ((Math.min(1, m) - STICK_DEAD) / (1 - STICK_DEAD) / m) * WEAPON.reach;
  out.x = x * k;
  out.y = y * k;
  return out;
}

/** 엄지가 손잡이를 옮김 (input.js — 포인터 사건마다): 손잡이 자리 · 끈 거리 · 칼을 쥠 (데드존 밖에 닿음 · 길게 누름 한도 넘게 끎) */
export function atkStickKnob(st, x, y, travelPx) {
  st.x = x;
  st.y = y;
  st.travel = Math.max(st.travel, travelPx);
  if (!st.grip && (Math.hypot(st.x0, st.y0) > STICK_DEAD || st.travel >= (INPUT.holdPx ?? INPUT.tapPx))) st.grip = true;
}

/** 엄지가 닿음: 그 자리 · 처음 자리 (지난 프레임 자리는 비움 — 닿는 순간의 손잡이 뜀은 ① 이 아니라 ② 로) */
export function atkStickGrab(st, id, x, y) {
  st.id = id;
  st.held = true;
  st.x0 = x;
  st.y0 = y;
  st.travel = 0;
  st.grip = false;
  st.prev = null;
  atkStickKnob(st, x, y, 0);
}

/** 엄지를 뗌 · 놓침 */
export function atkStickRelease(st) {
  st.id = null;
  st.held = false;
  st.ring = false;
  st.x = st.y = st.x0 = st.y0 = st.travel = 0;
  st.grip = false;
  st.prev = null;
}

/**
 * 한 프레임 (main.js playerInputFrame — 손가락 끌기 몫 d 를 받은 바로 뒤): 손 목표(hand = player.handOffset)에 더할 몫을 out 에.
 *  ① 손잡이가 옮긴 몫 그대로 + ② 남은 틈을 SKILL.recoverSpeed × dt 안에서. 칼을 쥐지 않았으면(얹은 엄지 · 뗌) 0
 */
export function atkStickStep(st, hand, dt, out = { x: 0, y: 0 }) {
  out.x = 0;
  out.y = 0;
  if (!st.held) {
    st.prev = null;
    return out;
  }
  const t = atkStickTarget(st.x, st.y);
  const p = st.prev ?? t;
  st.prev = t;
  if (!st.grip) return out;
  let ex = p.x - hand.x;
  let ey = p.y - hand.y;
  const e = Math.hypot(ex, ey);
  const lim = SKILL.recoverSpeed * Math.max(0, dt);
  if (e > lim) {
    ex *= lim / e;
    ey *= lim / e;
  }
  out.x = t.x - p.x + ex;
  out.y = t.y - p.y + ey;
  return out;
}
