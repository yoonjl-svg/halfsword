// ─────────────────────────────────────────────────────────────
//  화산섬(etna) AI 용암 피하기 — 스틱 입력(자발 이동)의 방향만 바꾼다. 몸을 끌거나 막는 보이지 않는 벽은 없다
//   출처: 샛별 저장소 origin/main 7684c732(내용은 0116047c·37c8857b)의 src/terrain_navigation.js 를 옮김
//   (docs/import/volcano_port_2026-10-14.md · 확인표 1460~ '사장님 확인 전'). ai.js update 끝(습지 석상 돌아가기와 같은 자리)에서 부른다.
//   · 내리막 쪽 자발 이동을 LOOK_AHEAD 초 미리 보고, 용암 물가 WARNING_DISTANCE 앞에서 오르막·안쪽으로 돌린다(목표 SAFE_DISTANCE 밖)
//   · 내리막으로 부탁해 둔 기술 걸음(gait.req)은 취소한다 — 균형 잡는 걸음(stumble·닿지 않는 발)은 그대로
//   · 밀리면 들어간다(물리 그대로). 플레이어는 손대지 않는다 — 사람은 스스로 피한다
//  지형이 없는 무대(평지)는 첫 줄에서 돌아간다 — AI 상태를 읽지도 쓰지도 않는다
// ─────────────────────────────────────────────────────────────
import { BODY, GAIT } from './config.js';

// 계획 여유(m · s) — 충돌 경계가 아니다: 보통 다리가 이 입력을 실제로 걸어야 한다 (샛별 값)
export const LAVA_AVOID = Object.freeze({ warning: 1.25, safe: 1.75, lookAhead: 0.45, inward: 0.15, inwardMax: 0.6 });

/** AI 의 자발 이동이 용암 쪽이면 방향을 돌린다 (몸은 옮기지 않는다). 돌렸거나 기술 걸음을 취소했으면 true */
export function avoidEtnaLava(ai) {
  const f = ai.me;
  const terrain = f.terrain;
  if (terrain?.id !== 'etna' || !Number.isFinite(terrain.lavaEdgeZ)) return false; // 평지 무대: 여기서 끝
  if (!f.alive || f.state !== 'stand' || f.feetHeld || f.revival || f.missingSupportLeg) return false;
  const strength = Math.hypot(f.move.x, f.move.y);
  const emotionScale = f.emoMods?.move ?? 1;
  if ((strength < 0.01 && !f.gait?.req) || !(emotionScale > 0)) return false;

  const pelvis = f.bodies.pelvis;
  const p = pelvis.translation();
  const c = Math.cos(f.heading);
  const s = Math.sin(f.heading);
  const hybrid = !!f.gait;
  const sideRatio = hybrid ? GAIT.sideFactor : 0.8;
  const backRatio = hybrid ? GAIT.backFactor : 0.75;
  const speed = hybrid ? GAIT.moveSpeed : BODY.moveSpeed;
  // 지금 내리막 관성과 지금 이동 요청을 함께 미리 본다. 골반이 오르막으로 가는 중이어도 발이 이미 앞에 나가 있으면 그 발이 먼저다
  //  (+z = 내리막. 몸 앞 = (cos h, 0, −sin h), 오른쪽 = (sin h, 0, cos h) — fighter.forward·right)
  const requestedZ = speed * (f.move.x * sideRatio * c - f.move.y * (f.move.y < 0 ? backRatio : 1) * s);
  let leadingZ = p.z + 0.35;
  for (const name of ['footF', 'footB']) {
    const foot = f.bodies[name];
    if (foot) leadingZ = Math.max(leadingZ, foot.translation().z + 0.14);
  }
  const projectedZ = leadingZ + Math.max(0, pelvis.linvel().z, requestedZ) * LAVA_AVOID.lookAhead;
  if (projectedZ < terrain.lavaEdgeZ - LAVA_AVOID.warning) return false;

  // 먼저 부탁해 둔 기술 걸음도 자발 이동이다 — 스틱을 읽은 뒤 제 앞 이동을 더하므로, 내리막 쪽이면(다리가 이미 떠 있어도) 취소한다
  const request = f.gait?.req;
  const cancelStep = !!request && -(request.fwd ?? 0) * s + (request.side ?? 0) * c > 0;
  if (cancelStep) f.gait.req = null;
  if (strength < 0.01) return cancelStep;

  // 오르막으로, 결투장 양옆에서는 조금 안쪽으로 (빠른 내리막 관성으로 일찍 경고가 났을 때도 최소 −0.5 m 오르막)
  const dx = Math.max(-LAVA_AVOID.inwardMax, Math.min(LAVA_AVOID.inwardMax, -p.x * LAVA_AVOID.inward));
  const dz = Math.min(-0.5, terrain.lavaEdgeZ - LAVA_AVOID.safe - p.z);
  let side = (dx * s + dz * c) / sideRatio;
  let forward = dx * c - dz * s;
  if (forward < 0) forward /= backRatio;
  // 옆·뒤 빠르기 차이를 되돌린 뒤 세기를 맞춘다 — 원래 입력 세기와 감정 배수(스틱 원값 ±1 안)는 그대로
  const limit = emotionScale;
  const scale = Math.min(strength / Math.hypot(side, forward), limit / Math.max(Math.abs(side), Math.abs(forward)));
  side *= scale;
  forward *= scale;
  f.move.set(side, forward);
  f.stickX = side / emotionScale;
  f.stickY = forward / emotionScale;
  return true;
}
