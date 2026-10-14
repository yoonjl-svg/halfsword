// ─────────────────────────────────────────────────────────────
//  화산섬(etna) AI 용암 피하기 — 스틱 입력(자발 이동)의 방향만 바꾼다. 몸을 끌거나 막는 보이지 않는 벽은 없다
//   출처: 샛별 저장소 origin/main 7684c732(내용은 0116047c·37c8857b)의 src/terrain_navigation.js 를 옮김
//   (docs/import/volcano_port_2026-10-14.md · 확인표 1460~ '사장님 확인 전'). ai.js update 끝(습지 석상 돌아가기와 같은 자리)에서 부른다.
//   · 내리막 쪽 자발 이동을 LOOK_AHEAD 초 미리 보고, 용암 물가 WARNING_DISTANCE 앞에서 오르막·안쪽으로 돌린다(목표 SAFE_DISTANCE 밖)
//   · 내리막으로 부탁해 둔 기술 걸음(gait.req)은 취소한다 — 균형 잡는 걸음(stumble·닿지 않는 발)은 그대로
//   · 밀리면 들어간다(물리 그대로). 플레이어는 손대지 않는다 — 사람은 스스로 피한다
//   · 용암 속 마무리(사장님 결정 10/14 23:0x — 안 ①): 상대가 마무리할 수 있는 상태로 용암 안이나 가장자리에 있을 때만(lavaFinishOpen)
//     경고 거리를 물가 선 그대로(0)로 줄이고, 넘을 셈이면 오르막으로 돌리는 대신 내리막 몫만 빼 가장자리까지 다가가게 한다.
//     베기 걸음은 디딜 자리가 물가 앞이면 그대로 딛는다(넘을 걸음만 취소 — 스스로 발을 들이지 않는다). 그 밖의 때는 같은 값·같은 차례의 셈 그대로다
//  지형이 없는 무대(평지)는 첫 줄에서 돌아간다 — AI 상태를 읽지도 쓰지도 않는다
// ─────────────────────────────────────────────────────────────
import { BODY, GAIT } from './config.js';

// 계획 여유(m · s) — 충돌 경계가 아니다: 보통 다리가 이 입력을 실제로 걸어야 한다 (샛별 값)
export const LAVA_AVOID = Object.freeze({ warning: 1.25, safe: 1.75, lookAhead: 0.45, inward: 0.15, inwardMax: 0.6 });

// 마무리할 수 있는 상태 — 기존 마무리 판정(약한 자세 겨눔 findVital · 쓰러진 상대 내려찍기 진입)이 보는 셋: 무릎 꿇음 · 일어나는 중(무릎부터) · 쓰러짐
const FINISHABLE = ['kneel', 'getup', 'down'];

/**
 * 용암 속 마무리 (사장님 결정 10/14 23:0x — 안 ①, docs/import/volcano_port_2026-10-14.md '용암 속 마무리'):
 *  이 AI 의 상대(플레이어든 AI 든 같은 규칙)가 살아 있고 마무리할 수 있는 상태이며, 용암 안(이번 물리 스텝에 덴 몸 부위가 있음 — lavaBurn.inLava)이거나
 *  가장자리(골반이 물가 앞 경고 띠 안 — 기존 LAVA_AVOID.warning)에 있으면 true. 읽기만 한다(난수·상태를 건드리지 않는다).
 *  새 문턱·상한·쿨다운 없음 — 상태는 기존 마무리 판정의 것, 띠는 기존 피하기 경고 거리
 */
export function lavaFinishOpen(ai) {
  const foe = ai.foe;
  const terrain = ai.me.terrain;
  if (!foe?.alive || !FINISHABLE.includes(foe.state) || !Number.isFinite(terrain?.lavaEdgeZ)) return false;
  if (foe.lavaBurn?.inLava) return true;
  return foe.bodies.pelvis.translation().z >= terrain.lavaEdgeZ - LAVA_AVOID.warning;
}

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
  // 용암 속 마무리(lavaFinishOpen): 그때만 경고 거리를 물가 선 그대로(0)로 — 앞선 발(골반 + 0.35 · 발 + 0.14 m)·미리 보기(0.45 s) 여유는 그대로
  const finishing = lavaFinishOpen(ai);
  if (projectedZ < terrain.lavaEdgeZ - (finishing ? 0 : LAVA_AVOID.warning)) return false;

  // 먼저 부탁해 둔 기술 걸음도 자발 이동이다 — 스틱을 읽은 뒤 제 앞 이동을 더하므로, 내리막 쪽이면(다리가 이미 떠 있어도) 취소한다.
  //  용암 속 마무리에서는 디딜 자리(앞선 발 + 그 걸음의 내리막 몫)가 물가를 넘을 때만 취소한다 — 물가 앞에 딛는 베기 걸음은 그대로, 넘을 걸음은 딛지 않고 그 자리에서 친다
  //  (스스로 발을 들이지 않는다. 걸음 길이는 그 걸음의 부탁값 그대로 — 새 값 없음)
  const request = f.gait?.req;
  const stepZ = request ? -(request.fwd ?? 0) * s + (request.side ?? 0) * c : 0;
  const cancelStep = !!request && stepZ > 0 && (!finishing || leadingZ + stepZ >= terrain.lavaEdgeZ);
  if (cancelStep) f.gait.req = null;
  if (strength < 0.01) return cancelStep;

  if (finishing) {
    // 용암 속 마무리 — 가장자리까지: 오르막으로 돌려 물러나지 않고, 이동 요청에서 내리막(+z) 몫만 뺀다(물가 선을 따라 옆으로 도는 몫은 그대로).
    //  내리막 몫이 없는 요청(물러남 등)은 그대로 둔다. 뺀 뒤 옆·뒤 빠르기 차이를 되돌리고, 감정 배수 한도(스틱 원값 ±1) 밖이면 그 안으로만 줄인다
    if (requestedZ <= 0) return cancelStep;
    const along = f.move.y * (f.move.y < 0 ? backRatio : 1) * c + f.move.x * sideRatio * s; // 남길 월드 x 빠르기 (÷ speed)
    let side = (along * s) / sideRatio;
    let forward = along * c;
    if (forward < 0) forward /= backRatio;
    const big = Math.max(Math.abs(side), Math.abs(forward));
    if (big > emotionScale) {
      side *= emotionScale / big;
      forward *= emotionScale / big;
    }
    f.move.set(side, forward);
    f.stickX = side / emotionScale;
    f.stickY = forward / emotionScale;
    return true;
  }

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
