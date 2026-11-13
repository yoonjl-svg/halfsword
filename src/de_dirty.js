// ─────────────────────────────────────────────────────────────
//  독일 더티복싱 B · C (11/14 — 설계안 docs/design/german_dirty_boxing_2026-11-14.md §2 B · C · 재기 docs/strike/de_dirty_2026-11-14.md · 값 config DE_DIRTY · 모두 기본 끔)
//   사람(사람 입력이 모는 몸 humanInput) · 무기 유파 독일 · 새 몫 열쇠를 가진 몸만(deDirtyBody) — B = 'deClinch' · C = 'deHilt'(skill_tree_data.js KIT_KEYS · 11/14 사장님 '새 효과는 새 스킬트리 칸으로' —
//   새 칸 자리 대기: 지금은 G9 '그 순간'을 익히면 두 열쇠가 함께 켜지게 임시로 이어 둠).
//   B1 밀어 흔들기 — shoveLanded (fighter.js closeStep: 누르기 중 내 팔 · 칼이 상대 몸에 처음 닿음) → 상대 두 팔 늦춤(nagashi_recovery.js beginFlowRecovery — 헛누름과 같은 장치)
//   B2 붙어 버티기 — clinchRate (stamina.js stepClinch: 독일 몸 몫만 × clinchK)
//   C1 모르트슐라크 빠른 문 — 문 열기: shoveLanded('shove') · school_passive.js deHit · deTouch('dup' — 겹치기가 맞거나 칼에 닿음) → 문 시계 f.mordDoor ·
//      문 쓰기: secret.js pressTick 'close' 가 mordDoorTick 을 부름(문 안 + 'dup' 이면 가슴 사이 mordCloseN 안 → 창 곧장)
//   C2 칼자루 뒤 칼 — school_passive.js deHit (모르트슐라크가 머리에 판정 → 그 순간 창 · 비기 동안 시계 멈춤)
//  모두 끔이면(기본) 아무 일도 하지 않는다 — 난수 · 몸 · 기력 그대로(재기 셈 deDirtyStats 만 사람 몸에 적음).
// ─────────────────────────────────────────────────────────────
import { DE_DIRTY, GAIT } from './config.js';
import { G as PAD } from './ai_techniques.js'; // 옆 자세 자리 sideR (칼 씨름 — 상대 칼 손이 몸 옆 바깥으로 벌어지는 자리)
import { kitOff } from './skill_kit.js';
import { beginFlowRecovery } from './nagashi_recovery.js';
import { bargeHeld } from './close_hold.js'; // 밀치기 묶임 (11/14) — 문 시계 멈춤

/** 이 몸이 독일 더티복싱 몫 key('deClinch' B · 'deHilt' C)를 받나: 사람(사람 입력이 모는 몸 humanInput) · 무기 유파 독일 · 그 몫 열쇠(skillKit 이 없는 몸은 켜짐) */
export const deDirtyBody = (f, key) => !!f?.humanInput && f.swordArt?.tradition === 'german' && !kitOff(f, key);

/** 재기 셈 (읽기만 — 판정에 안 씀) */
export function deStats(f) {
  return (f.deDirtyStats ??= { landed: 0, armSlow: 0, doorOpen: { shove: 0, dup: 0 }, doorWin: { shove: 0, dup: 0 }, mordHead: 0, mordIndes: 0, clinchSaved: 0, ring: 0, ringFall: 0, ringGap: [] });
}

/** B · C 가운데 하나라도 켜졌나 (fighter.js closeStep 이 첫 몸 닿음을 셈할지) */
export const deDirtyOn = () => DE_DIRTY.armSlow > 0 || DE_DIRTY.clinchK !== 1 || DE_DIRTY.door > 0 || !!DE_DIRTY.mordIndes || !!DE_DIRTY.ring;

/**
 * 독일 밀치기가 상대 몸에 들었다 (fighter.js closeStep — 누르기 중 내 팔 · 칼이 상대 몸(발 빼고 · 칼 빼고)에 처음 닿은 스텝 · 한 밀치기에 한 번):
 *  B1 상대 두 팔 armSlow 초 늦춤 · C1 문(쓸 수 있는 시계 door 초 — 'shove')
 */
export function shoveLanded(f, foe) {
  if (!f?.humanInput || f.swordArt?.tradition !== 'german') return;
  const st = deStats(f);
  st.landed++;
  if (DE_DIRTY.armSlow > 0 && foe && deDirtyBody(f, 'deClinch') && beginFlowRecovery(foe, f, DE_DIRTY.armSlow)) st.armSlow++;
  openDoor(f, 'shove');
}

/** C1 문 열기 ('shove' 밀치기가 듦 · 'dup' 겹치기가 맞거나 칼에 닿음) — 문 시계 door 초(다시 오면 새로) */
export function openDoor(f, kind) {
  if (!(DE_DIRTY.door > 0) || !deDirtyBody(f, 'deHilt')) return;
  if (!f.mordDoor || f.mordDoor.kind !== kind || f.mordDoor.t < DE_DIRTY.door) deStats(f).doorOpen[kind]++;
  f.mordDoor = { t: DE_DIRTY.door, kind };
}

/**
 * C1 문 쓰기 (secret.js PlayerSecretWatch.pressTick 'close' 판 — 1.5 s 붙음 셈 다음에 부름): 문 시계를 dt 만큼 줄이고, 문이 살아 있으면서
 *  'shove' 이거나 ('dup' 이고 가슴 사이 ≤ mordCloseN — close) 이면 그 문을 돌려준다(부른 쪽이 창을 열면 consumeDoor). 끔이면 늘 null ·
 *  밀치기 묶임(나 · 상대의 밀치기 — close_hold.js) 동안은 시계가 멈추고 문을 안 돌려줌(풀린 뒤 door 초 — 사장님 11/14 '묶인 1.2초 동안은 아무 공격도 못하고' 뒤 맞춤)
 */
export function mordDoorTick(f, dt, close) {
  const D = f.mordDoor;
  if (!D) return null;
  if (DE_DIRTY.door > 0 && (bargeHeld(f.barge) || bargeHeld(f.foe?.barge))) return null; // 밀치기 묶임(11/14 사장님 '묶인 1.2초 동안은 아무 공격도 못하고' — close_hold.js) 동안은 문 시계가 멈춤 — 풀린 뒤 door 초 (묶인 동안 창이 열려 쓰지 못하고 닫히지 않게)
  if (!(DE_DIRTY.door > 0) || (D.t -= dt) <= 0) {
    f.mordDoor = null;
    return null;
  }
  return D.kind === 'shove' || close ? D : null;
}
export function consumeDoor(f, D) {
  deStats(f).doorWin[D.kind]++;
  if (f.mordDoor === D) f.mordDoor = null;
}

/** B2 붙어 버티기 기력 빠짐 배율 (stamina.js stepClinch — 그 몸 몫) */
export const clinchRate = (f) => (DE_DIRTY.clinchK !== 1 && deDirtyBody(f, 'deClinch') ? DE_DIRTY.clinchK : 1);

/** C2: 이 몸이 지금 모르트슐라크를 내는 중인가 (skill.js 비기 실행 run.mord) */
export const inMord = (f) => !!f?.skill?.sec?.mord;


// ── 칼 씨름 1] (링엔 암 슈베르트 — 11/14 · config DE_DIRTY.ring · 몫 열쇠 'deRing' · 기본 끔) ──

/**
 * 밀치기 묶임 안에서 상대가 지침이면 칼 씨름 (fighter.js closeStep — 묶인 누르기 스텝마다): 독일 사람(deRing) · 상대 서 있음 · 상대 기력 0 아래(지침 문턱) → ringThrow · true(부른 쪽이 밀치기를 끝냄 'ring')
 */
export function ringCheck(f, foe) {
  if (!DE_DIRTY.ring || !foe?.alive || foe.state !== 'stand' || foe.ringHit || !deDirtyBody(f, 'deRing')) return false;
  if (!(foe.stamina?.value < 0)) return false;
  ringThrow(f, foe);
  return true;
}

/**
 * 칼 씨름 — 세게 밀침 (사장님 11/14 '1번으로 해' · 감독 '새 동작 없이 물리 밀침 + 지금 균형 걸음으로 · 힘 · 방향만 맞춰 0.6 m'): 상대 몸 마디마다 빠르기에 내 → 상대 쪽
 *  v0 = √(2 · GAIT.maxAccel · ringDist) 를 더함(새 수 없음 — 발로 내는 가속 한도로 서는 거리가 ringDist 인 빠르기) · 무너진 동안(ringStep) 상대 스틱 0 → 몸은 균형 걸음(gait 'catch')으로 따라 디디며 섬 ·
 *  무너진 자세 ringT 초 · 내 그 순간 창
 */
export function ringThrow(f, foe) {
  const a = f.bodies.chest.translation();
  const b = foe.bodies.chest.translation();
  let dx = b.x - a.x;
  let dz = b.z - a.z;
  const n = Math.hypot(dx, dz) || 1;
  dx /= n;
  dz /= n;
  const p = foe.bodies.pelvis.translation();
  foe.ringHit = { t: 0, T: DE_DIRTY.ringT, x0: p.x, z0: p.z, dx, dz, d0: n, dMax: n };
  if (foe.stamina && DE_DIRTY.ringNoRecover > 0) foe.stamina.noRecover = Math.max(foe.stamina.noRecover ?? 0, DE_DIRTY.ringNoRecover); // 밀려난 상대 기력 회복 막힘 (11/14 사장님 'n초간 기력회복 불가' — stamina.js)
  const V = Math.sqrt(2 * GAIT.maxAccel * DE_DIRTY.ringDist);
  for (const { rb } of foe.meshes) {
    if (!rb) continue;
    const v = rb.linvel();
    rb.setLinvel({ x: v.x + dx * V, y: v.y, z: v.z + dz * V }, true);
  }
  f.schoolPassive?.ringOpen?.(foe);
  deStats(f).ring++;
}

/**
 * 칼 씨름으로 무너진 몸 (fighter.js step — 몸이 제 스텝 머리에 부름 · ringHit 이 없으면 안 부름): ringT 초 동안 스틱 0(제 걸음 없음 — 밀린 빠르기는 균형 걸음으로) ·
 *  칼 손 목표 = 옆 자세 자리(ai_techniques G.sideR — 칼을 몸 옆 바깥으로 · 막기 · 겨눔이 풀림) · AI 는 이 동안 공격을 시작하지 않음(ai.js startAttack). 넘어지면 · 죽으면 끝
 */
export function ringStep(f, dt) {
  const R = f.ringHit;
  if (!R) return;
  if (!f.alive || f.state !== 'stand' || (R.t += dt) >= R.T) {
    f.ringHit = null;
    return;
  }
  const p = f.bodies.pelvis.translation();
  const moved = (p.x - R.x0) * R.dx + (p.z - R.z0) * R.dz;
  // 0.6 m 에서 서기: 밀린 빠르기를 세게 멈춤(박찬 걸음 뒤와 같은 gait.burstBrake — 가속 한도 × burstAccel)으로 줄여 서는 거리를 더해 ringDist 에 닿을 때 건다 (새 수 없음)
  if (!R.braked && f.gait) {
    const v = f.bodies.pelvis.linvel();
    const vb = Math.max(0, v.x * R.dx + v.z * R.dz);
    if (moved + (vb * vb) / (2 * GAIT.maxAccel * GAIT.burstAccel) >= DE_DIRTY.ringDist) {
      R.braked = true;
      f.gait.burstBrake = { x: R.dx, z: R.dz };
    }
  }
  f.move.set(0, 0); // 제 걸음 없음 — 밀린 몸은 균형 걸음(catch)으로만 디딤
  f.stickX = 0;
  f.stickY = 0;
  f.handOffset.set(PAD.sideR[0], PAD.sideR[1]);
  R.moved = moved;
  if (f.foe) R.dMax = Math.max(R.dMax, f.foeDistance());
}
