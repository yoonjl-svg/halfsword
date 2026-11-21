// ─────────────────────────────────────────────────────────────
//  AI 길목 길 (생사전 전용 맵 — 11/21 · 설계 docs/design/saengsa_3v3_2026-11-21.md §3-1 '지을 것' · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//   겨눈 상대가 물 · 벽(지도 꼴의 막이) 너머라 곧은 길이 막혔으면, 가장 짧은 길목(다리 · 문)의 내 쪽 머리 점 → 길목 안 → 저쪽 머리 점으로 스틱을 돌린다.
//   스틱(입력)만 바꾼다 — 보이지 않는 힘 · 몸 끌기 없음 (사람은 제 손으로 다리를 건넌다 · arena_obstacle.js routeAroundStageObstacle 과 같은 꼴).
//   바라보는 쪽도 그 점으로 (f.fieldFace — match.js stepMatch 가 바라볼 곳으로 읽음): 강 건너 상대를 본 채 옆걸음으로 다리까지 가지 않게.
//   스틱 세기: 지금 세기를 그대로 두되 적어도 걷는 세기 FIELD_ROUTE.walk — 강 건너 · 벽 너머에서 서로 간만 보고 서 있지 않게.
//   길을 갈 때는 몸이 갈 점을 보니(fieldFace) AI 의 간 보기 · 물러남 스틱(상대 쪽 틀)은 뜻이 없어 늘 갈 점으로 (상대가 막이 너머면 쫓아올 수 없음) · 공격 휘두름 · 쓰러짐은 그대로.
//  원 무대(1:1 · 여정 · 다른 판)는 막이가 없어 곧장 돌아간다 (관문 바이트 같음).
// ─────────────────────────────────────────────────────────────
import { fieldOf, inLaneBox, segThroughLane } from './field.js';

export const FIELD_ROUTE = Object.freeze({
  walk: 0.85, // 길목으로 가는 걷는 세기 (스틱 끝 1 의 몫 — 지금 세기가 이보다 작으면 이만큼) [사장님 확인 전]
  reach: 0.6, // 머리 점에 이만큼(m) 다가가면 다음 점으로
  slack: 2, // 고른 길목이 다른 길목보다 이만큼(m) 넘게 길어질 때만 바꾼다 (두 다리 사이에서 떨지 않게)
  every: 0.1, // 길을 다시 셈하는 사이 (게임 초)
  seenNear: 1.5, // 벽 너머 상대를 마지막으로 본 자리에 이만큼(m) 다가가고도 안 보이면 지금 자리로 (성벽 안뜰)
  // 길목 나눠 쓰기 (11/21 감독 — 다리 위 같은 편 칼: 두 다리 3:3 같은 편 상처 / 판 1.71 · 열린 원 0.72) — 편 가리지 않고 모든 AI 같은 규칙:
  share: 6, // 동료가 이미 그 길목 안에 있거나 그 길목으로 가는 중이면 한 사람마다 그 길목 길을 이만큼(m) 길게 셈 (두 다리로 나눠 건넘) [사장님 확인 전]
  busy: 20, // 동료가 그 길목 안에 서 있거나(걷든 싸우든) · 길목 끝에서 내 쪽을 등지고 싸우는 중(동료가 그 적보다 내 쪽 머리에 가까움)이면 그 길목 길을 이만큼(m) 길게 — 다른 길목으로 돌아 적 뒤로 [사장님 확인 전]
  engage: 1.2, // '싸우는 중' = 동료 ↔ 그 동료의 상대 가슴 사이가 동료 칼끝 + 이만큼(m) 안
  back: 1.5, // 그래도 그 길목이 가장 짧으면 길목 안으로 들어가 동료 뒤에 서지 않고 내 쪽 머리 점에서 이만큼(m) 뒤에서 기다림 [사장님 확인 전]
  stop: 0.5, // 기다리는 자리에 이만큼(m) 다가가면 섬
});

const reachOf = (g) => g.aiCtl?.M?.reach ?? g.swordArt?.measure?.reach ?? 1.8;
/** m 이 길목 L 안에서 싸우는 중이고, 내 쪽(머리 점 A)에서 보아 그 상대보다 앞(A 쪽)에 있나 — 들어가면 그 동료 등 뒤에 줄 서게 됨 */
function fightingAhead(L, A, B, m) {
  if (!m.alive || m.revival || m.state !== 'stand') return false;
  const g = m.foe;
  if (!g?.alive) return false;
  const a = m.bodies.chest.translation(), b = g.bodies.chest.translation();
  if (!inLaneBox(L, a.x, a.z, 0.3) || Math.hypot(b.x - a.x, b.z - a.z) > reachOf(m) + FIELD_ROUTE.engage) return false;
  const ax = B.x - A.x, az = B.z - A.z;
  return (a.x - A.x) * ax + (a.z - A.z) * az < (b.x - A.x) * ax + (b.z - A.z) * az;
}
/** m 이 길목 L 안(± 0.2 m)에 서 있나 */
function standingIn(L, m) {
  if (!m.alive || m.revival || m.state !== 'stand') return false;
  const t = m.bodies.pelvis.translation();
  return inLaneBox(L, t.x, t.z, 0.2);
}
/** 길목마다 덧셈 (m): 싸우는 동료 앞길 busy · 그리 가는 동료 share — 그리고 busy 인 길목 (내 쪽 머리 점에서 본) */
function laneBias(F, f, p) {
  const lanes = F.geo.lanes, mates = f.mates ?? [];
  const busy = [], bias = [];
  lanes.forEach((L, i) => {
    const [E0, E1] = L.ends;
    const A = Math.hypot(E0.x - p.x, E0.z - p.z) <= Math.hypot(E1.x - p.x, E1.z - p.z) ? E0 : E1, B = A === E0 ? E1 : E0;
    busy[i] = mates.some((m) => fightingAhead(L, A, B, m) || standingIn(L, m)); // 길목 안에 서 있는 동료(싸우든 걷든) · 길목 끝에서 싸우는 동료 — 들어가면 그 등 뒤에 줄 섬
    const n = mates.filter((m) => { if (!m.alive || m.revival) return false; const t = m.bodies.pelvis.translation(); return m.aiCtl?.fieldLane === i || inLaneBox(L, t.x, t.z); }).length;
    bias[i] = (busy[i] ? FIELD_ROUTE.busy : 0) + FIELD_ROUTE.share * n;
  });
  return { busy, bias };
}

/** 막이 너머 상대면 길목 길로 스틱 방향 (AI.update — 석상 돌아가기 뒤 · 마른 길 앞) */
export function routeThroughField(ai) {
  const f = ai.me;
  const F = fieldOf(f);
  if (F.kind === 'circle') return;
  const foe = ai.foe;
  f.fieldFace = null;
  if (!f.alive || !foe?.alive || f.state !== 'stand' || f.feetHeld || f.revival || !f.armed || f.pickup) return; // 칼을 놓쳤으면 제 칼 줍기(pickup.js aiPickup)가 먼저
  const p = f.bodies.pelvis.translation();
  let q = foe.bodies.pelvis.translation();
  // 성벽 안뜰 (11/21 — targeting.js sightTick): 벽 너머 상대는 마지막으로 본 자리로 간다. 그 자리에 닿고도 안 보이면 지금 자리로(발소리 — 멈춰 서지 않게)
  const mem = f.seenPos?.get(foe);
  const hunt = !!mem && Math.hypot(mem.x - p.x, mem.z - p.z) > FIELD_ROUTE.seenNear;
  if (hunt) q = { x: mem.x, y: q.y, z: mem.z };
  // 길목 나눠 쓰기: 내가 길목 밖이면 동료가 싸우는 길목 · 동료가 가는 길목을 길게 셈 — 곧은 길이 동료가 싸우는 길목을 지나도(상대가 다리 위) 막힌 길로 봄
  const lanes = F.geo.lanes;
  const inMine = lanes.some((L) => inLaneBox(L, p.x, p.z));
  const LB = inMine ? null : laneBias(F, f, p);
  const crossBusy = LB ? lanes.findIndex((L, i) => LB.busy[i] && segThroughLane(L, p, q, 0.2)) : -1;
  const throughBusy = crossBusy >= 0;
  if (!F.segBlocked(p, q) && !hunt && !throughBusy) {
    ai.fieldLane = -1;
    ai.fieldRoute = null;
    return;
  }
  // 길은 FIELD_ROUTE.every 초마다 다시 셈 (몸 여섯 · 스텝마다 셈하지 않게) — 갈 점에 닿으면 곧장
  const now = f.fightT ?? 0;
  let r = ai.fieldRoute;
  if (!r || now - r.t > FIELD_ROUTE.every || r.foe !== foe || r.hunt !== hunt || (!r.hold && Math.hypot(r.way.x - p.x, r.way.z - p.z) < FIELD_ROUTE.reach)) {
    r = F.segBlocked(p, q) || throughBusy ? F.route(p, q, ai.fieldLane ?? -1, FIELD_ROUTE.slack, LB?.bias, crossBusy) : { lane: -1, way: { x: q.x, z: q.z }, len: Math.hypot(q.x - p.x, q.z - p.z) }; // 본 자리가 막히지 않았으면 곧장
    if (r.way !== q && Math.hypot(r.way.x - p.x, r.way.z - p.z) < FIELD_ROUTE.reach) r = { ...F.route(r.way, q, r.lane, FIELD_ROUTE.slack, LB?.bias, crossBusy), lane: r.lane }; // 머리 점에 닿음 → 다음 점
    // 그래도 동료가 싸우는 길목으로 들어가야 하면: 들어가 그 동료 등 뒤에 줄 서지 않고 내 쪽 머리 점 뒤에서 기다림 (그 동료가 쓰러지거나 · 적이 길목을 나오면 풀림)
    r.hold = null;
    if (LB && r.lane >= 0 && LB.busy[r.lane]) {
      const L = lanes[r.lane], [E0, E1] = L.ends;
      const A = Math.hypot(E0.x - p.x, E0.z - p.z) <= Math.hypot(E1.x - p.x, E1.z - p.z) ? E0 : E1;
      const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, d = Math.hypot(A.x - cx, A.z - cz) || 1;
      r.hold = { x: A.x + ((A.x - cx) / d) * FIELD_ROUTE.back, z: A.z + ((A.z - cz) / d) * FIELD_ROUTE.back, cx, cz };
      r.way = { x: r.hold.x, z: r.hold.z };
    }
    r.t = now;
    r.foe = foe;
    r.hunt = hunt;
    ai.fieldRoute = r;
    ai.fieldLane = r.lane;
  }
  const w = r.way;
  f.fieldFace = r.hold ? { x: r.hold.cx, y: q.y, z: r.hold.cz } : { x: w.x, y: q.y, z: w.z }; // 바라볼 곳 = 갈 점 (기다리면 길목 가운데) (다음 스텝 — match.js)
  if (r.hold && Math.hypot(r.hold.x - p.x, r.hold.z - p.z) < FIELD_ROUTE.stop) {
    if (!(ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow'))) { f.move.set(0, 0); f.stickX = f.stickY = 0; }
    return;
  }
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
