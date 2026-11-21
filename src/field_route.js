// ─────────────────────────────────────────────────────────────
//  AI 길목 길 (생사전 전용 맵 — 11/21 · 설계 docs/design/saengsa_3v3_2026-11-21.md §3-1 '지을 것' · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//   겨눈 상대가 물 · 벽(지도 꼴의 막이) 너머라 곧은 길이 막혔으면, 가장 짧은 길목(다리 · 문)의 내 쪽 머리 점 → 길목 안 → 저쪽 머리 점으로 스틱을 돌린다.
//   스틱(입력)만 바꾼다 — 보이지 않는 힘 · 몸 끌기 없음 (사람은 제 손으로 다리를 건넌다 · arena_obstacle.js routeAroundStageObstacle 과 같은 꼴).
//   바라보는 쪽도 그 점으로 (f.fieldFace — match.js stepMatch 가 바라볼 곳으로 읽음): 강 건너 상대를 본 채 옆걸음으로 다리까지 가지 않게.
//   스틱 세기: 지금 세기를 그대로 두되 적어도 걷는 세기 FIELD_ROUTE.walk — 강 건너 · 벽 너머에서 서로 간만 보고 서 있지 않게.
//   길을 갈 때는 몸이 갈 점을 보니(fieldFace) AI 의 간 보기 · 물러남 스틱(상대 쪽 틀)은 뜻이 없어 늘 갈 점으로 (상대가 막이 너머면 쫓아올 수 없음) · 공격 휘두름 · 쓰러짐은 그대로.
//  원 무대(1:1 · 여정 · 다른 판)는 막이가 없어 곧장 돌아간다 (관문 바이트 같음).
// ─────────────────────────────────────────────────────────────
import { fieldOf } from './field.js';

export const FIELD_ROUTE = Object.freeze({
  walk: 0.85, // 길목으로 가는 걷는 세기 (스틱 끝 1 의 몫 — 지금 세기가 이보다 작으면 이만큼) [사장님 확인 전]
  reach: 0.6, // 머리 점에 이만큼(m) 다가가면 다음 점으로
  slack: 2, // 고른 길목이 다른 길목보다 이만큼(m) 넘게 길어질 때만 바꾼다 (두 다리 사이에서 떨지 않게)
  every: 0.1, // 길을 다시 셈하는 사이 (게임 초)
  seenNear: 1.5, // 벽 너머 상대를 마지막으로 본 자리에 이만큼(m) 다가가고도 안 보이면 지금 자리로 (성벽 안뜰)
});

/** 막이 너머 상대면 길목 길로 스틱 방향 (AI.update — 석상 돌아가기 뒤 · 마른 길 앞) */
export function routeThroughField(ai) {
  const f = ai.me;
  const F = fieldOf(f);
  if (F.kind === 'circle') return;
  const foe = ai.foe;
  f.fieldFace = null;
  if (!f.alive || !foe?.alive || f.state !== 'stand' || f.feetHeld || f.revival) return;
  const p = f.bodies.pelvis.translation();
  let q = foe.bodies.pelvis.translation();
  // 성벽 안뜰 (11/21 — targeting.js sightTick): 벽 너머 상대는 마지막으로 본 자리로 간다. 그 자리에 닿고도 안 보이면 지금 자리로(발소리 — 멈춰 서지 않게)
  const mem = f.seenPos?.get(foe);
  const hunt = !!mem && Math.hypot(mem.x - p.x, mem.z - p.z) > FIELD_ROUTE.seenNear;
  if (hunt) q = { x: mem.x, y: q.y, z: mem.z };
  if (!F.segBlocked(p, q) && !hunt) {
    ai.fieldLane = -1;
    ai.fieldRoute = null;
    return;
  }
  // 길은 FIELD_ROUTE.every 초마다 다시 셈 (몸 여섯 · 스텝마다 셈하지 않게) — 갈 점에 닿으면 곧장
  const now = f.fightT ?? 0;
  let r = ai.fieldRoute;
  if (!r || now - r.t > FIELD_ROUTE.every || r.foe !== foe || r.hunt !== hunt || Math.hypot(r.way.x - p.x, r.way.z - p.z) < FIELD_ROUTE.reach) {
    r = F.segBlocked(p, q) ? F.route(p, q, ai.fieldLane ?? -1, FIELD_ROUTE.slack) : { lane: -1, way: { x: q.x, z: q.z }, len: Math.hypot(q.x - p.x, q.z - p.z) }; // 본 자리가 막히지 않았으면 곧장
    if (Math.hypot(r.way.x - p.x, r.way.z - p.z) < FIELD_ROUTE.reach) r = { ...F.route(r.way, q, r.lane, FIELD_ROUTE.slack), lane: r.lane }; // 머리 점에 닿음 → 다음 점
    r.t = now;
    r.foe = foe;
    r.hunt = hunt;
    ai.fieldRoute = r;
    ai.fieldLane = r.lane;
  }
  const w = r.way;
  f.fieldFace = { x: w.x, y: q.y, z: w.z }; // 바라볼 곳 = 갈 점 (다음 스텝 — match.js)
  const c = Math.cos(f.heading);
  const s = Math.sin(f.heading);
  const speed = Math.hypot(f.move.x, f.move.y);
  if (ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow')) return; // 휘두르는 중은 그대로
  const k = Math.max(speed, FIELD_ROUTE.walk);
  const dx = w.x - p.x, dz = w.z - p.z, L = Math.hypot(dx, dz);
  if (L < 1e-6) return;
  const x = dx / L, z = dz / L;
  f.move.set((x * s + z * c) * k, (x * c - z * s) * k);
  f.stickX = f.move.x;
  f.stickY = f.move.y;
}
