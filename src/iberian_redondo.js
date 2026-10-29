// ─────────────────────────────────────────────────────────────
//  이베리아 특수 공격 '풍차 베기 (레돈두)' (B4 — 사장님 10/29 00:4x ~ 01:5x · 기록 docs/strike/redondo_hold_2026-10-29.md · 확인표 2727 ~ 2733) — 길게 누르는 동안 칼을 머리 위로 돌리는 감기
//   사장님: "탭을 오래 누르면 그 준비 동작이 시작되고 바로 손을 떼면 그걸 내려치는 거야. 그 사이에 이동을 할수 있고, 이동을 하면서 그걸 내려칠 타이밍을 고르는 거지" ·
//   '머리 위에서 계속 돈다' · 01:0x '이게 특수공격 위치의 스킬이잖아' (조건 · 기력 · 식힘은 unique_assist.js PlayerUniqueAssist.holdTick · 내려침은 secret_instant.js requestArtRedondo)
//
//  몸놀림만 대본 (물리 원칙의 예외 — 특수 공격 몸놀림 · 발도 · 특수 공격 넷의 끌고 가는 칼과 같은 놓기): 두 팔 · 칼을 물리 스텝마다 대본 자리에 놓는다(secret_instant.js placeArmsAt =
//   placeIai — 팔 IK · 굴림 묶음 · 손목 교정(사람 손목 범위) · 날 = 도는 쪽 · 빠르기 = 가슴 · 덧씌우기 칸도 같은 자세 · 몸 비틀기 0 — 팔만 · 몸은 상대를 봄).
//   칼 · 팔은 동역학 몸 그대로 · 충돌을 끄지 않는다(끌고 가는 칼의 충돌 끔 instantGhost 를 걸지 않음) → 칼을 세게 맞거나(jolt) 몸에 상처가 나면 감기를 그만둔다(holdTick — 식힘 없음) · 닿기만 하면 그대로 감음(닿은 스텝은 재기만).
//   감는 칼은 맞히는 칼이 아니다(빠르기 = 가슴 — 놓인 자리만 돈다 · 상처 판정은 물리 맞닿음 그대로).
//   앞 시험 (기록 §2): ① 서보로 감기(덧씌우기 칸만) — 칼이 길을 못 따라 평균 90° 어긋남 · 손목 범위 밖 42 % · 칼이 제 머리를 지남 /
//   ② 놓기 + 빠르기 = 놓은 자리의 차(싱지르 placeArms 꼴) — 팔 · 칼 운동량이 어깨로 가슴을 밀어 4 s 에 몸이 1.7 m 미끄러지고 넘어짐 /
//   ③ 머리 위 가로 고리 — 어깨 · 손목 밧줄이 팽팽해져 몸이 밀려 넘어지고 손목이 뒤집힘 → 지금 꼴(원뿔 고리 · 빠르기 = 가슴).
//
//  길 (몸 틀 — 지금 몸 방향 f.yaw · 가슴 원점 · x 앞 · y 위 · z 칼 든 쪽 m · UNIQUE_ASSIST.rdLoop — windPose):
//   두 손은 이마 앞 위에 두고 칼은 곧게 선 축에서 cone ° 기운 채, 기운 쪽 가로 각 ψ 가 rdLoopT 초에 한 바퀴 — 앞 → 칼 든 쪽 → 뒤 → 반대쪽
//   (내려칠 레베스가 왼 → 오른으로 가므로 같은 쪽으로 돎) · 칼끝이 머리 위에서 원을 그림 · 날 = 도는 쪽(rdEdge).
//   처음 rdWindIn 초는 지금 손 · 칼날에서 길로 섞는다(가로 각은 지금 칼 가로 각에서 시작 — 섞는 길이 짧게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { UNIQUE_ASSIST as UA } from './config.js';
import { placeArmsAt } from './secret_instant.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const sideOf = (f) => (f.side >= 0 ? 1 : -1);
const BODY0 = Object.freeze({ pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 });

/**
 * 감는 길 한 자리 (몸 틀): 칼 가로 각 psi(rad — 0 앞 · + 칼 든 쪽) → 손(칼자루 쥔 자리 = 칼 원점) H · 칼날 D(단위).
 *  원뿔 고리 (UNIQUE_ASSIST.rdLoop): 두 손은 이마 앞 위 hand 에 두고, 칼은 곧게 선 축에서 cone ° 기운 채 그 기운 쪽(가로 각 psi)을 돌린다 — 칼끝이 머리 위에서 원을 그림.
 *  칼날이 아래팔 축 가까이(30°)라 어느 쪽으로 기울어도 손목이 굽힘 · 폄 · 치우침만으로 닿아 굴림을 뒤집지 않는다 (머리 위 가로 고리 · 자세표 머리 위 자세를 이은 고리는
 *  손목이 거꾸로 뒤집히거나 칼자루 · 팔이 머리를 지났다 — 기록 §2)
 */
export function windPose(f, psi, H = new THREE.Vector3(), D = new THREE.Vector3()) {
  const L = UA.rdLoop;
  const s = sideOf(f);
  const b = L.cone * D2R;
  H.set(L.hand[0], L.hand[1], s * L.hand[2]);
  D.set(Math.sin(b) * Math.cos(psi), Math.cos(b), s * Math.sin(b) * Math.sin(psi));
  return { H, D };
}
/** 감는 빠르기 (rad/s) */
export const windRate = () => TAU / Math.max(1e-3, UA.rdLoopT);
/** 감는 칼이 도는 쪽 (몸 틀 — 가로 각이 느는 쪽 · 날 세우기 · rdEdge −1 이면 반대 날) */
function windEdge(f, psi, out = new THREE.Vector3()) {
  return out.set(-Math.sin(psi), 0, sideOf(f) * Math.cos(psi)).multiplyScalar(UA.rdEdge < 0 ? -1 : 1);
}

/** 감기 시작 (지금 손 · 칼날을 몸 틀로 적어 둠 — 섞기의 처음) · f.rdWind 를 돌려줌 */
export function windStart(f) {
  const inv = f.yaw.clone().invert();
  const c = f.bodies.chest.translation();
  const sw = f.sword.translation();
  const AH = new THREE.Vector3(sw.x - c.x, sw.y - c.y, sw.z - c.z).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  const psi = Math.atan2(sideOf(f) * AD.z, AD.x); // 지금 칼 가로 각에서 돌기 시작
  const I = { yaw: f.yaw.clone(), mord: null, kind: 'wind', moves: null, mi: 0, off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), body: BODY0, wristMargin: UA.rdWristMargin ?? 0 }; // 손목 교정은 범위 끝에서 rdWristMargin ° 안쪽으로 (10/29 몸 검사)
  f.rdWind = { t: 0, psi, psi0: psi, AH, AD, H: AH.clone(), D: AD.clone(), k: 0, I, turns: 0 };
  return f.rdWind;
}

const _q = new THREE.Quaternion();
const _e = new THREE.Vector3();
/**
 * 한 물리 스텝 (unique_assist.js holdTick — skill.update 머리 · 물리 스텝 앞): 가로 각을 돌리고 그 자리에 두 팔 · 칼을 놓는다.
 *  돌려줌 = 감는 칼이 지난 물리 스텝에 무엇에 닿았나('body' 상대 몸 · 'blade' 상대 칼 · 'other' 벽 · 땅) 또는 null
 */
export function windStep(f, dt) {
  const W = f.rdWind;
  if (!W) return null;
  const hit = windContact(f);
  W.t += dt;
  W.psi += windRate() * dt;
  W.turns = (W.psi - W.psi0) / TAU;
  const { H, D } = windPose(f, W.psi);
  const k = UA.rdWindIn > 0 ? smooth(W.t / UA.rdWindIn) : 1;
  if (k < 1) {
    H.lerpVectors(W.AH, H, k);
    _q.setFromUnitVectors(W.AD, D);
    D.copy(W.AD).applyQuaternion(new THREE.Quaternion().slerp(_q, k)).normalize();
  }
  W.H.copy(H);
  W.D.copy(D);
  W.k = k;
  W.I.yaw.copy(f.yaw); // 몸 틀 = 지금 몸 방향 (걷고 돌아도 머리 위 그대로)
  placeArmsAt(f, W.I, H, D, windEdge(f, W.psi, _e).applyQuaternion(f.yaw));
  return hit;
}

/** 감기 끝 (내려침이 이어받든 그만두든): 대본 놓기를 멈춤 — 팔 · 칼은 동역학 몸 그대로(서보 · 덧씌우기 칸은 holdTick 이 내려놓음) */
export function windEnd(f) {
  f.rdWind = null;
}

/** 감는 칼이 지난 물리 스텝에 무엇에 닿았나 (iberian_spin.js swordContact 와 같은 셈 — 내 몸은 뺌): 'body' · 'blade' · 'other'(벽 · 땅) · null */
function windContact(f) {
  const Wd = f.world;
  const foe = f.foe;
  if (!Wd || !f.armed || !f.swordColliders) return null;
  const mine = new Set([...Object.values(f.bodies).map((b) => b.handle), f.sword.handle]);
  const foeB = new Set(foe?.bodies ? Object.values(foe.bodies).map((b) => b.handle) : []);
  const foeSword = foe?.sword?.handle;
  let out = null;
  for (const c1 of f.swordColliders) {
    Wd.contactPairsWith(c1, (c2) => {
      if (out) return;
      const h = c2.parent()?.handle;
      if (h != null && mine.has(h)) return;
      Wd.contactPair(c1, c2, (m) => {
        for (let i = 0; i < m.numContacts(); i++) {
          if (m.contactDist(i) <= 0) {
            out = h === foeSword ? 'blade' : foeB.has(h) ? 'body' : 'other';
            return;
          }
        }
      });
    });
    if (out) break;
  }
  return out;
}
