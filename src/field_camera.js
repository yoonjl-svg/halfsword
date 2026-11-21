// ─────────────────────────────────────────────────────────────
//  생사전 성벽 안뜰 카메라 (11/21 — 설계 docs/design/saengsa_3v3_2026-11-21.md §3-3 '휴대폰 카메라' · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//   가운데 성벽(3 m) · 문루(3.8 m · 지붕 밑 2.7 m)가 어깨 너머 카메라(2.3 m · 무리 판 더 위)보다 높아 카메라가 벽에 박히거나 내 몸이 벽에 가린다. 폰은 카메라를 손으로 못 돌리니
//   ① 당김(돌림): 지금 카메라 보호(arena_obstacle.js clampStageCamera — 돌 꼴로 시선을 재고 막히면 내 몸 둘레로 옆으로 돌림)에 벽 · 탑 · 지붕 상자를 돌로 넘김
//      — 성벽에 등을 대면 벽을 따라 옆으로 돈 자리에서 봄 · 높이 · 거리는 그대로 (돌 꼴 보호와 같은 규칙 · 같은 시간 상수)
//   ② 지붕 밑: 내 몸이 문길 안이면 카메라 높이를 지붕 밑으로 (roofUnder) · 문길 축에서 벗어난 카메라는 문길 안으로 당김
//   ③ 바깥 성벽(4 m): 카메라는 지도 꼴 테두리(성벽 안쪽 면 − 0.45 m) 안 — 등을 대면 카메라가 내 몸 가까이로 밀리니 가까운 만큼 위로 (closeLift)
//   ④ 비침: ①~③ 뒤에도 카메라 → 내 머리 · 가슴 시선이 안쪽 성벽 · 지붕에 막히면 안쪽 성벽 · 지붕 메쉬를 반투명으로 (see 몫 — 시간 상수로 옅어지고 돌아옴)
//  두 다리 개울(낮은 난간 · 둔덕)은 ①·②·④ 없음 (시야를 가리는 막이가 없음 — 설계 '카메라 그대로') · 원 무대는 이 파일을 타지 않는다
// ─────────────────────────────────────────────────────────────
import { clampStageCamera } from './arena_obstacle.js';

export const FIELD_CAMERA = Object.freeze({
  roofUnder: 0.35, // 문길 안이면 카메라를 지붕 밑에서 이만큼(m) 아래로
  laneIn: 0.35, // 문길 안이면 카메라를 문길 벽에서 이만큼(m) 안쪽으로 (문길 축 쪽으로 당김)
  closeLift: 0.7, // 테두리에 밀려 카메라가 몸 가까이 오면(수평 거리 < CAMERA.back) 모자란 거리 × 이 몫만큼 위로
  see: 0.3, // 비칠 때 안쪽 성벽 · 지붕 불투명도
  tau: 0.12, // 비침 · 돌아옴 시간 상수 (실제 초)
});

/** 지도 꼴 → 카메라 보호 몸 (축에 맞춘 상자 — 가운데 성벽 · 문루 탑 · 지붕). 시야를 가리는 막이가 없으면 null */
const guards = new WeakMap();
export function fieldGuardOf(F) {
  if (!F?.hasSight) return null;
  if (guards.has(F)) return guards.get(F);
  const G = F.geo;
  const boxes = [
    ...G.blocks.filter((b) => b.sight).map((b) => Object.freeze({ k: 'box', x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0, y1: b.h + 0.2 })),
    ...G.roofs.map((r) => Object.freeze({ k: 'box', x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0: r.y0, y1: r.y1 + 0.4 })),
  ];
  const guard = Object.freeze({ camera: Object.freeze(boxes), seekSight: false, field: F });
  guards.set(F, guard);
  return guard;
}

/** 선분 p → q 가 상자(3 차원)를 지나나 */
function segHitsBox(b, p, q) {
  let t0 = 0, t1 = 1;
  for (const [a, d, lo, hi] of [[p.x, q.x - p.x, b.x0, b.x1], [p.y, q.y - p.y, b.y0, b.y1], [p.z, q.z - p.z, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return false; continue; }
    let ta = (lo - a) / d, tb = (hi - a) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * 화면마다 (main.js updateCamera — 지도 꼴 테두리 뒤): origin = 내 무게중심(따라가는 점) · cam = 카메라 자리(고침) · back = 평소 뒤 거리.
 *  back 보다 가까우면(테두리에 밀림) 위로 — main.js 는 CAMERA.minDist (keepDistance 뒤라 밀렸을 때만)
 */
export function fieldCamera(F, origin, cam, back) {
  const G = F.geo;
  const C = FIELD_CAMERA;
  // ③ 테두리에 밀려 가까워진 카메라는 위로
  const d = Math.hypot(cam.x - origin.x, cam.z - origin.z);
  if (d < back) cam.y += (back - d) * C.closeLift;
  const guard = fieldGuardOf(F);
  if (!guard) return false;
  // ② 문길 안: 지붕 밑 · 문길 안쪽으로
  for (const R of G.roofs) {
    if (origin.x < R.x0 || origin.x > R.x1 || origin.z < R.z0 || origin.z > R.z1) continue;
    cam.y = Math.min(cam.y, R.y0 - C.roofUnder);
    cam.z = Math.min(R.z1 - C.laneIn, Math.max(R.z0 + C.laneIn, cam.z));
  }
  // ① 벽 · 탑 · 지붕 둘레로 돌림 (돌 꼴 카메라 보호 — 지도 꼴 테두리 안)
  clampStageCamera(origin, cam, guard, { field: F });
  return cam;
}

/** ④ 카메라 자리 pos → 내 머리 · 가슴 시선이 안쪽 성벽 · 지붕에 막혔나 (판 시작 훑기 자리에도 — main.js 가 마지막 카메라 자리로 부름) */
export function fieldCamBlocked(F, origin, pos) {
  const guard = fieldGuardOf(F);
  if (!guard) return false;
  for (const up of [0.62, 0.3]) {
    const q = { x: origin.x, y: origin.y + up, z: origin.z };
    for (const b of guard.camera) if (segHitsBox(b, pos, q)) return true;
  }
  return false;
}

/** 비침 (무대 seeThrough.meshes 의 재질 불투명도를 시간 상수로) — blocked = fieldCamBlocked 의 답 · dt 실제 초 */
export function seeThroughStep(see, blocked, dt) {
  if (!see?.meshes?.length) return;
  const want = blocked ? FIELD_CAMERA.see : 1;
  const k = 1 - Math.exp(-Math.max(0, dt) / FIELD_CAMERA.tau);
  see.alpha = (see.alpha ?? 1) + (want - (see.alpha ?? 1)) * k;
  if (Math.abs(see.alpha - want) < 0.005) see.alpha = want;
  for (const m of see.meshes) {
    m.material.opacity = see.alpha;
    m.material.depthWrite = see.alpha > 0.97;
  }
}
