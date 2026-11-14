// ─────────────────────────────────────────────────────────────
//  독일 칼 씨름 (링엔 암 슈베르트 — 11/14 · 재기 docs/strike/de_dirty_2026-11-14.md · 값 config DE_DIRTY · 기본 켬)
//   사람(사람 입력이 모는 몸 humanInput) · 무기 유파 독일 · 몫 열쇠 'deRing'(skill_tree_data.js KIT_KEYS — 칸 G12 칼 씨름 · 11/14 사장님 '독일 권고대로 해' · 전 G9 임시 이음).
//   밀치기 묶임 동안 상대가 지침이면 세게 밀쳐 무너뜨림 — ringCheck(fighter.js closeStep) · ringThrow · ringStep(무너진 몸 — fighter.js step).
//   설계안 B(밀어 흔들기 · 붙어 버티기) · C(모르트슐라크 빠른 문 · 칼자루 뒤 칼)는 사장님 11/14 결정으로 폐기(걷어냄 — 확인표 3755 ~ 3758).
// ─────────────────────────────────────────────────────────────
import { DE_DIRTY, GAIT } from './config.js';
import { G as PAD } from './ai_techniques.js'; // 옆 자세 자리 sideR (칼 씨름 — 상대 칼 손이 몸 옆 바깥으로 벌어지는 자리)
import { kitOff } from './skill_kit.js';

/** 이 몸이 독일 몫 key('deRing' 칼 씨름)를 받나: 사람(사람 입력이 모는 몸 humanInput) · 무기 유파 독일 · 그 몫 열쇠(skillKit 이 없는 몸은 켜짐) */
export const deDirtyBody = (f, key) => !!f?.humanInput && f.swordArt?.tradition === 'german' && !kitOff(f, key);

/** 재기 셈 (읽기만 — 판정에 안 씀) */
export function deStats(f) {
  return (f.deDirtyStats ??= { ring: 0 });
}

// ── 칼 씨름 1] (링엔 암 슈베르트 — 11/14 · config DE_DIRTY.ring · 몫 열쇠 'deRing' · 기본 켬) ──

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
