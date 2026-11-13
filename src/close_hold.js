// ─────────────────────────────────────────────────────────────
//  붙은 거리 규칙 — 밀치기 시작 거리 · 묶임 · 칼자루만 (11/14 — 재기 docs/strike/de_dirty_2026-11-14.md · 값 config CLOSE.startD · holdMin · holdPush · holdDrain · holdCool · holdLock · nearHilt · startAI)
//   사장님 11/14 결정: "밀치기 기준 1m로 하자. 그리고 한번 밀치기가 시작되면 서로 힘을 받아서 최소 n초 무조건 유지되게 해" → "1.2초로 해" →
//    "아니야 밀치기애 묶인 1.2초 동안은 아무 공격도 못하고 기력이 2배 소모돼. 밀치기가 발동하는 1m 이내에서는 손잡이 찍기만 가능해.
//     밀치기가 발동돼서 1.2초간 묶인 후에는 그게 풀린 후 2초간 다시 강제로 묶이지 않아. 쿨타임인 셈."
//   · 시작 거리: 사람 밀치기는 가슴 사이 startD(1.0 m — 모든 유파 · 무기 한 값) 안에서 상대 쪽으로 밀면 나감(fighter.js closeStep)
//   · 묶임: 누르기에 든 뒤 holdMin(실제 1.2 s) 동안은 떨어짐 · 스틱 놓음 · 팔 다 펴짐 · 긋기 · 찌르기로 안 끝남(몸 상태 — 나 · 상대 넘어짐 · 쓰러짐 · 걸음 꺼짐 · 탈진만 끝냄) ·
//     그동안 맞밀기(holdPushBack — 상대 몸이 제 스텝에 제 골반을 나 쪽으로) · 어떤 공격 입력도 안 나감(손잡이 찍기 · 비기 포함 — closeInputGate lock) ·
//     붙어 버티기 기력 빠짐 × holdDrain(2 — stamina.js stepClinch · 두 몸 모두 · 스틱 · 닿음과 상관없이 묶인 동안은 버팀)
//   · 쿨타임: 묶임이 풀린 뒤 holdCool(실제 2.0 s) 동안 새 밀치기는 걸음 · 밂은 되지만 묶임이 안 걸림(holdCoolLeft)
//   · 칼자루만: 묶여 있지 않고 가슴 사이 startD 안(밀치기가 나는 거리 — 나 · 상대 서 있음)이면 공격 입력(탭 · 빠른 끌기)은 손잡이 찍기(skill.pommel — 시제품 POMMEL)만 ·
//     긴 베기 · 찌르기 · 고유 공격은 안 나감 · 독일 모르트슐라크 창이 열려 있으면 그것은 나감(칼자루 공격 — 감독 해석 · 여쭐 것) · 그 밖 비기는 안 나감
//   사람만 기본 켬 · AI 는 startAI(기본 null = 지금 판 · 관문 그대로) 견줌 스위치로 같은 규칙(ai.js startAttack — 묶인 동안 공격 안 함 · 칼자루만 거리에선 찍기)
//  재기 셈 f.closeLog (읽기만 — 판정에 안 씀)
// ─────────────────────────────────────────────────────────────
import { CLOSE } from './config.js';

/** 이 몸에 붙은 거리 규칙(시작 거리 · 묶임 · 칼자루만)이 걸리나 — 사람(사람 입력이 모는 몸 humanInput — main.js 플레이어 · 재기 손가락 봇) 늘 · AI 는 startAI 견줌일 때만 · 시뮬 대본 몸은 아님 */
export const closeRulesOn = (f) => !!f.humanInput || (!!f.aiControlled && CLOSE.startAI > 0);

/** 이 몸의 밀치기 시작 거리(가슴 사이 m) — 사람 CLOSE.startD · AI CLOSE.startAI · 없으면(그 밖 · 끔) 무기 reach(옛 판 — 같은 수) */
export function closeStartD(f, reach) {
  const v = f.humanInput ? CLOSE.startD : f.aiControlled ? CLOSE.startAI : null;
  return v > 0 ? v : reach;
}

/** 새 밀치기의 묶임 시간(게임 초) — 0 = 없음(끔 · AI 견줌 끔 · 쿨타임 안) */
export function closeHoldT(f) {
  if (!closeRulesOn(f) || !(CLOSE.holdMin > 0) || (f.holdCool ?? 0) > 0) return 0;
  return CLOSE.holdMin;
}

/** 이 밀치기(barge)가 지금 묶임 안인가 */
export const bargeHeld = (b) => !!b && b.phase === 'press' && b.hold > 0 && b.holdT < b.hold;

/** 재기 셈 */
export function closeLog(f) {
  return (f.closeLog ??= { holds: 0, holdT: 0, trap: { apart: 0, release: 0, armFull: 0, atk: 0 }, lockT: 0, lockAtk: 0, nearT: 0, nearAtk: 0, pommel: 0, nearSecret: 0, ends: {}, landed: 0, push: 0, cooled: 0 });
}

/**
 * 맞밀기 (CLOSE.holdPush — fighter.js step 이 closeStep 뒤에 부름): 상대가 나를 밀치는 묶임 안이면 내 골반을 상대 가슴 쪽으로 다리 밀기(legDrive × 내 근육 · 힘 —
 *  상대 closeStep 의 다리 밀기와 같은 셈 · 같은 값) — 내 발 하나라도 땅에 있고 서 있을 때만. 내 스텝에서 내 몸에만 힘을 건다(상대 스텝의 힘 지우기에 안 지워짐). 아니면 아무것도 안 함
 */
export function holdPushBack(f) {
  const o = f.foe;
  if (!CLOSE.holdPush || !o || !bargeHeld(o.barge) || f.state !== 'stand' || !f.alive || !f.gait?.active) return;
  if (!((f.gait.legs.F.N || 0) > 0 || (f.gait.legs.B.N || 0) > 0)) return;
  const a = f.bodies.chest.translation();
  const c = o.bodies.chest.translation();
  const dx = c.x - a.x;
  const dz = c.z - a.z;
  const n = Math.hypot(dx, dz);
  if (!(n > 1e-6)) return;
  const k = (CLOSE.legDrive * f.muscle * f.strength) / n;
  f.bodies.pelvis.addForce({ x: dx * k, y: 0, z: dz * k }, true);
  if (!o.aiControlled) closeLog(o).push += f.lastDt ?? 0;
}

/** 묶인 동안 붙어 버티기 기력 빠짐 배율 (stamina.js stepClinch — 두 몸 가운데 하나라도 묶임 안이면 holdDrain · 아니면 1) */
export function clinchHoldK(a, b) {
  if (!(CLOSE.holdDrain > 0) || CLOSE.holdDrain === 1) return 1;
  return bargeHeld(a?.barge) || bargeHeld(b?.barge) ? CLOSE.holdDrain : 1;
}

/** 칼자루만 거리인가 (묶임 밖 · 가슴 사이 ≤ 시작 거리 · 나 · 상대 서 있음 · 칼(총 아님)을 쥠) */
export function nearHilt(f) {
  if (!CLOSE.nearHilt || !CLOSE.on || !closeRulesOn(f) || bargeHeld(f.barge) || bargeHeld(f.foe?.barge)) return false;
  const o = f.foe;
  if (!o || !o.alive || o.state !== 'stand' || o.revival || f.state !== 'stand' || !f.armed || f.weapon?.gun) return false;
  return f.foeDistance() <= closeStartD(f, CLOSE.reach(f.weapon));
}

/**
 * 사람 입력 문 (main.js playerInputFrame · 재기 손가락 봇 — 비기 차례 앞에 부름): { lock, near, secretOk }
 *  lock = 묶임 안(holdLock) — 어떤 공격도 안 나감(부른 쪽이 비기 실행 중처럼 secBusy) · near = 칼자루만 거리 · secretOk = 비기 창을 써도 되나(near 면 모르트슐라크 창만)
 */
export function closeInputGate(f, watch) {
  if (!f.humanInput) return { lock: false, near: false, secretOk: true };
  const lock = !!CLOSE.holdLock && (bargeHeld(f.barge) || bargeHeld(f.foe?.barge)); // 내 밀치기든 상대가 나를 민 밀치기든(AI 견줌 startAI 를 켰을 때만 AI 밀치기에 묶임이 걸림) — 맞밀기로 둘 다 묶임
  const near = !lock && nearHilt(f);
  return { lock, near, secretOk: !near || watch?.S?.name === 'mordschlag' };
}

/**
 * 사람 입력 바꿈 (closeInputGate 뒤 · 비기 차례 뒤 — 부른 쪽은 true 면 taps 를 0 으로): lock = 손가락 움직임 · 공격 입력을 버림(재기 셈) ·
 *  near = 공격 입력(탭 · 빠른 끌기)이면 손잡이 찍기를 내고(이미 찍는 중이면 안 남) 그 프레임 손가락 움직임은 버림 — 느린 끌기(자세 옮김)는 그대로. 아니면 false
 */
export function closeInputApply(f, gate, d, taps, swipe, dt = 0) {
  if (!gate.lock && !gate.near) return false;
  const L = closeLog(f);
  const atk = taps > 0 || !!swipe;
  const first = atk && !f.holdAtkPrev; // 공격 입력 하나(빠른 끌기는 여러 프레임 — 처음 프레임만 셈)
  f.holdAtkPrev = atk;
  if (gate.lock) {
    L.lockT += dt;
    if (first) L.lockAtk++;
    d.x = 0;
    d.y = 0;
    return true;
  }
  L.nearT += dt;
  if (!atk) return false;
  if (first) L.nearAtk++;
  if (f.alive && f.skill?.pommel()) L.pommel++;
  d.x = 0;
  d.y = 0;
  return true;
}
