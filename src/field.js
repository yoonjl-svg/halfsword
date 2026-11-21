// ─────────────────────────────────────────────────────────────
//  지도 꼴 (field) — 판의 바닥 꼴 하나: 바깥 테두리 · 막이 · 시작 자리 · 거점 · 길목 점 · edgeDist · inward
//   (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — 설계 docs/design/saengsa_3v3_2026-11-21.md §1-3 · §3-0 · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//
//  예전에는 '반지름을 읽는 곳'이 열 군데쯤 흩어져 원 무대(ARENA.radius)를 곧장 셈했다. 이제 그 자리들은 싸움꾼의 지도 꼴(fieldOf(f))에 묻는다:
//   radial(x, z)        가운데에서 잰 거리처럼 쓰는 값 — 원은 Math.hypot(x, z) 그대로. 다른 꼴은 ARENA.radius − edgeDist(x, z)
//                       (테두리가 ARENA.radius 자리에 오게 — 'radial > ARENA.radius − 띠' 꼴의 옛 줄이 '테두리에서 띠 안' 으로 그대로 읽힌다)
//   outward(x, z, o)    테두리 쪽 방향 (o.x, o.z) ÷ o.len — 원은 (x, z) ÷ hypot 그대로(옛 줄의 'a.x / rA' 꼴 · 나눗셈 차례까지 같음)
//   edgeDist(x, z)      가장 가까운 막이(바깥 테두리 · 물 · 벽)까지 거리 (안이면 +) · inward(x, z) = 그 반대쪽 단위 벡터
//   clampCamera(v, y)   카메라를 테두리 안에 (원 = 반지름 10.5 m · 넘으면 그 원 위로 당기고 높이 y — main.js 옛 줄 그대로)
//   walls(...)          보이지 않는 막이 충돌체 (원 = 32 조각 1.2 m 벽 — main.js resetWorld · 시뮬 newMatch 옛 줄 그대로)
//  원 무대(CIRCLE_FIELD)는 옛 식과 바이트까지 같은 값을 낸다 (1:1 관문 해시 그대로 — 시험 tools/sim/saengsa_maps.test.mjs).
//  1:1 · 여정 · 다른 판은 모두 원 무대 — 싸움꾼에 field 를 달지 않으면 원(fieldOf). 생사전 전용 맵만 직사각형 꼴(src/saengsa_maps.js 무대 표 → rectField)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';

/** 원 무대: 지금 결투장 (반지름은 그때그때 ARENA.radius 를 읽는다 — 시험이 바꿔도 따라감) */
export const CIRCLE_FIELD = Object.freeze({
  kind: 'circle',
  camWall: 10.5, // 카메라가 나가지 않는 반지름 (m — main.js updateCamera · arena_obstacle.js CAMERA_GUARD.wall 과 같은 값)
  radial: (x, z) => Math.hypot(x, z),
  outward(x, z, o) {
    o.x = x;
    o.z = z;
    o.len = Math.hypot(x, z);
    return o;
  },
  edgeDist: (x, z) => ARENA.radius - Math.hypot(x, z),
  inward(x, z, o = { x: 0, z: 0 }) {
    const r = Math.hypot(x, z) || 1;
    o.x = -x / r;
    o.z = -z / r;
    return o;
  },
  /** 카메라 자리 v(THREE.Vector3)를 반지름 camWall 안으로 — 넘으면 그 원 위로 당기고 높이 y (main.js 옛 줄 그대로) */
  clampCamera(v, y) {
    const r = Math.hypot(v.x, v.z);
    if (r > 10.5) v.multiplyScalar(10.5 / r).setY(y);
    return v;
  },
  /** 카메라 보호가 옆으로 돌린 자리도 원 안 (arena_obstacle.js swingTo 옛 줄 그대로) */
  clampSwing(o, wall) {
    const r = Math.hypot(o.x, o.z);
    if (r > wall) { o.x *= wall / r; o.z *= wall / r; }
    return o;
  },
  hasSight: false,
  segBlocked: () => false,
  sightBlocked: () => false,
  pathLen: (p, q) => Math.hypot(q.x - p.x, q.z - p.z),
  /** 원형 경계 벽 32 조각 (보이지 않는 벽 · 높이 1.2 m — main.js resetWorld · 시뮬 newMatch 옛 줄 그대로) */
  walls(RAPIER, world, body, groups) {
    const n = 32;
    const R = ARENA.radius + 0.25;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const half = R * Math.tan(Math.PI / n) + 0.05;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.2, 0.6, half)
          .setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setCollisionGroups(groups),
        body,
      );
    }
  },
});

/** 그 장에서 i → j 시선이 벽에 막히나 (성벽 안뜰 — 무리 판단 판 사본 장 fr 의 칸 i · j: 장마다 짝마다 한 번 셈해 장에 담아 둠 · team_sense.js · team_support.js 가 함께 씀) */
export function wallBetween(F, fr, i, j) {
  const memo = (fr.wall ??= new Map());
  const k = i * 64 + j;
  let v = memo.get(k);
  if (v === undefined) memo.set(k, (v = F.sightBlocked(fr.b[i], fr.b[j])));
  return v;
}

/** 싸움꾼(또는 AI 의 몸)의 지도 꼴 — 달지 않았으면 원 무대 */
export const fieldOf = (f) => f?.field ?? CIRCLE_FIELD;

/** 점에서 상자(x0..x1, z0..z1)까지 수평 거리 (안이면 0) · 가장 가까운 상자 위 점을 o 에 */
function boxNear(b, x, z, o) {
  o.x = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x;
  o.z = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z;
  return Math.hypot(x - o.x, z - o.z);
}
/** 선분 p → q 가 상자(e 만큼 부풀림)를 지나나 (수평 · 슬래브 — 할당 없음) */
function segBox(b, px, pz, qx, qz, e) {
  let t0 = 0, t1 = 1;
  const dx = qx - px, dz = qz - pz;
  if (Math.abs(dx) < 1e-9) { if (px < b.x0 - e || px > b.x1 + e) return false; }
  else {
    let ta = (b.x0 - e - px) / dx, tb = (b.x1 + e - px) / dx;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) return !(pz < b.z0 - e || pz > b.z1 + e);
  let ta = (b.z0 - e - pz) / dz, tb = (b.z1 + e - pz) / dz;
  if (ta > tb) { const t = ta; ta = tb; tb = t; }
  if (ta > t0) t0 = ta;
  if (tb < t1) t1 = tb;
  return t0 <= t1;
}
const inBox = (b, x, z, e = 0) => x >= b.x0 - e && x <= b.x1 + e && z >= b.z0 - e && z <= b.z1 + e;

/**
 * 직사각형 지도 꼴 (생사전 전용 맵 — src/saengsa_maps.js 가 무대 표 한 줄에서 만든 몫 g 를 넘긴다):
 *  g = { id, half: { x, z }(바깥 테두리 안쪽 면) · blocks: [{ x0, x1, z0, z1, h, sight }](들어갈 수 없는 곳 — 물 · 벽. sight = 시야를 가림) ·
 *        lanes: [{ x0, x1, z0, z1, ends: [{ x, z }, { x, z }] }](길목 — 다리 · 문길. ends = 양쪽 머리 점 · 그 안에서는 막이 띠를 셈하지 않음) ·
 *        colliders: [{ c: [x, y, z], h: [hx, hy, hz] }](보이지 않는 막이 상자) · cam: { x0, x1, z0, z1 }(카메라가 나가지 않는 곳) · points · spawn … }
 */
export function rectField(g) {
  const _n = { x: 0, z: 0 };
  /** 가장 가까운 막이까지 거리 · 그 막이 위 점(o) — 바깥 테두리 · 막이 상자 (길목 안이면 막이 상자는 셈하지 않음) */
  const nearest = (x, z, o) => {
    // 바깥 테두리: 네 면 가운데 가까운 면
    let d = g.half.x - x;
    o.x = g.half.x; o.z = z;
    if (x + g.half.x < d) { d = x + g.half.x; o.x = -g.half.x; o.z = z; }
    if (g.half.z - z < d) { d = g.half.z - z; o.x = x; o.z = g.half.z; }
    if (z + g.half.z < d) { d = z + g.half.z; o.x = x; o.z = -g.half.z; }
    if (g.lanes.some((L) => inBox(L, x, z))) return d;
    for (const b of g.blocks) {
      const e = boxNear(b, x, z, _n);
      if (e < d) { d = e; o.x = _n.x; o.z = _n.z; }
    }
    return d;
  };
  const _o = { x: 0, z: 0 };
  const edgeDist = (x, z) => nearest(x, z, _o);
  const walkBlocks = [...g.blocks, ...(g.rails ?? [])]; // 걸어 지날 수 없는 곳 (물 · 벽 · 탑 + 다리 난간)
  /** 선분이 걸어 지날 수 없는 곳에 막히나 — 끝점이 부풀린 띠 안이면(몸이 막이에 붙어 섬) 그 막이는 부풀리지 않고 본다 */
  function segBlockedRaw(p, q, e) {
    for (const b of walkBlocks) {
      const k = inBox(b, p.x, p.z, e) || inBox(b, q.x, q.z, e) ? 0 : e;
      if (segBox(b, p.x, p.z, q.x, q.z, k)) return true;
    }
    return false;
  }
  const ends = g.lanes.flatMap((L, i) => L.ends.map((e) => ({ x: e.x, z: e.z, lane: i })));
  // 머리 점끼리 이음은 맵마다 한 번 (같은 길목 양쪽 머리 = 길목 안 — 늘 열림): 길이 · 막히면 Infinity
  const endLink = ends.map((a) => ends.map((b) => (a === b ? 0 : a.lane === b.lane || !segBlockedRaw(a, b, 0.15) ? Math.hypot(b.x - a.x, b.z - a.z) : Infinity)));
  /** 점 몇 개의 가장 짧은 길 (다익스트라 — p · 머리 점 · q). only ≥ 0 이면 그 길목 머리 점만 씀. p · q 에서 머리 점까지만 그때 잼 */
  const shortest = (p, q, only) => {
    const ids = ends.map((e, i) => i).filter((i) => only < 0 || ends[i].lane === only);
    const m = ids.length, N = m + 2; // 0 = p · 1..m = 머리 점 · m + 1 = q
    const link = (u, v) => {
      if (u > v) [u, v] = [v, u];
      if (u === 0 && v === N - 1) return F.segBlocked(p, q) ? Infinity : Math.hypot(q.x - p.x, q.z - p.z);
      if (u === 0) { const e = ends[ids[v - 1]]; return F.segBlocked(p, e) ? Infinity : Math.hypot(e.x - p.x, e.z - p.z); }
      if (v === N - 1) { const e = ends[ids[u - 1]]; return F.segBlocked(e, q) ? Infinity : Math.hypot(q.x - e.x, q.z - e.z); }
      return endLink[ids[u - 1]][ids[v - 1]];
    };
    const memo = new Map(), linkM = (u, v) => { const k = u < v ? u * 64 + v : v * 64 + u; let d = memo.get(k); if (d === undefined) memo.set(k, (d = link(u, v))); return d; };
    const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === N - 1) break;
      done[u] = true;
      for (let v = 1; v < N; v++) {
        if (done[v] || v === u) continue;
        const d = dist[u] + linkM(u, v);
        if (d < dist[v]) (dist[v] = d), (prev[v] = u);
      }
    }
    if (dist[N - 1] === Infinity) return { lane: -1, way: q, len: Infinity };
    const path = [];
    for (let v = N - 1; v > 0; v = prev[v]) path.push(v);
    path.reverse();
    const lanesOn = path.filter((v) => v < N - 1).map((v) => ends[ids[v - 1]].lane);
    const crossed = lanesOn.find((l, i) => lanesOn.indexOf(l) !== i) ?? lanesOn[0] ?? -1;
    return { lane: crossed, way: path[0] === N - 1 ? q : ends[ids[path[0] - 1]], len: dist[N - 1] };
  };
  const F = {
    kind: 'rect',
    hasSight: g.blocks.some((b) => b.sight), // 시야를 가리는 막이(높은 벽)가 있나 — 성벽 안뜰 (사람 · AI 모두 벽 너머를 못 봄)
    id: g.id,
    geo: g,
    camWall: null,
    edgeDist,
    radial: (x, z) => ARENA.radius - edgeDist(x, z),
    /** 테두리 쪽 단위 방향 (len 1) — 가장 가까운 막이 쪽 */
    outward(x, z, o) {
      const d = nearest(x, z, _o);
      let ox = _o.x - x, oz = _o.z - z, l = Math.hypot(ox, oz);
      if (l < 1e-6 || d <= 0) { const w = F.inward(x, z, o); ox = -w.x; oz = -w.z; l = 1; }
      o.x = ox / l;
      o.z = oz / l;
      o.len = 1;
      return o;
    },
    inward(x, z, o = { x: 0, z: 0 }) {
      nearest(x, z, _o);
      let ix = x - _o.x, iz = z - _o.z, l = Math.hypot(ix, iz);
      if (l < 1e-6) { ix = -x; iz = -z; l = Math.hypot(ix, iz) || 1; } // 막이 위 · 안: 맵 가운데 쪽
      o.x = ix / l;
      o.z = iz / l;
      return o;
    },
    clampCamera(v, y) {
      const c = g.cam;
      const x = Math.min(c.x1, Math.max(c.x0, v.x)), z = Math.min(c.z1, Math.max(c.z0, v.z));
      if (x !== v.x || z !== v.z) v.set(x, y, z);
      return v;
    },
    clampSwing(o) {
      const c = g.cam;
      o.x = Math.min(c.x1, Math.max(c.x0, o.x));
      o.z = Math.min(c.z1, Math.max(c.z0, o.z));
      return o;
    },
    /**
     * 선분 p → q 가 걸어 지날 수 없는 곳(물 · 벽 · 다리 난간 — e 만큼 부풀림)에 막히나.
     *  끝점이 부풀린 띠 안이면(몸이 막이에 붙어 섬) 그 막이는 부풀리지 않고 본다 — 붙어 선 몸의 길이 다 막히지 않게
     */
    segBlocked: (p, q, e = 0.15) => segBlockedRaw(p, q, e),
    /** 눈 a → b 시선이 시야를 가리는 막이(높은 벽 — sight)에 막히나 (사람은 벽 너머를 못 본다 — 성벽 안뜰) */
    sightBlocked(a, b) {
      for (const s of g.sight) if (segBox(s, a.x, a.z, b.x, b.z, 0)) return true;
      return false;
    },
    /** p → q 걸어가는 길 길이 (막히지 않으면 곧은 거리 · 막히면 길목을 거쳐 — route) */
    pathLen(p, q) {
      if (!F.segBlocked(p, q)) return Math.hypot(q.x - p.x, q.z - p.z);
      return F.route(p, q).len;
    },
    /**
     * p → q 길목 길 (점 몇 개의 가장 짧은 길 — p · 길목 양쪽 머리 점 · q 사이 곧은 줄이 막히지 않으면 이음): { lane(건넌 길목 차례 · 없으면 −1), way(다음에 갈 점), len }.
     *  keep(전에 건넌 길목)이 있으면 그 길목 길이 slack m 넘게 길어질 때만 바꾼다 (두 다리 사이에서 떨지 않게)
     */
    route(p, q, keep = -1, slack = 2, bias = null, direct = -1) {
      if (bias) {
        // 길목마다 덧셈 bias[i] (m — 동료가 그 길목에서 싸움 · 그리 감 — field_route.js): 길목 하나씩만 써 본 가장 짧은 길 + 그 길목 덧셈 가운데 가장 작은 것.
        //  direct ≥ 0: p → q 곧은 줄이 그 길목을 지남(상대가 다리 위) — 곧은 길도 그 길목 길로 셈
        let b = null;
        for (let i = 0; i < g.lanes.length; i++) {
          const r = shortest(p, q, i);
          if (r.len === Infinity) continue;
          if (r.lane < 0 && direct >= 0) r.lane = direct;
          const k = r.len + (r.lane >= 0 ? bias[r.lane] ?? 0 : 0) - (keep >= 0 && r.lane === keep ? slack : 0);
          if (!b || k < b.k) b = { ...r, k };
        }
        if (b) return b;
      }
      const best = shortest(p, q, -1);
      if (keep >= 0 && best.lane !== keep) {
        const alt = shortest(p, q, keep);
        if (alt.len < Infinity && alt.len - slack <= best.len) return alt;
      }
      return best;
    },
    /** 막이 충돌체 (고정 몸 body 에) — 바깥 둔덕 · 물가 · 난간 · 벽 (표 그대로) */
    walls(RAPIER, world, body, groups) {
      for (const k of g.colliders) {
        world.createCollider(RAPIER.ColliderDesc.cuboid(...k.h).setTranslation(...k.c).setCollisionGroups(groups), body);
      }
    },
  };
  g.sight ??= g.blocks.filter((b) => b.sight);
  return Object.freeze(F);
}

/** 점(x, z)이 길목 안인가 (다리 위 · 문길 안) — 거점 · 시험 */
export const inLane = (F, x, z) => !!F.geo?.lanes.some((L) => inBox(L, x, z));
/** 점(x, z)이 길목 L 안인가 (e 만큼 넓혀) */
export const inLaneBox = (L, x, z, e = 0) => inBox(L, x, z, e);
/** 선분 p → q 가 길목 L 상자(e 만큼 넓힘)를 지나나 */
export const segThroughLane = (L, p, q, e = 0) => segBox(L, p.x, p.z, q.x, q.z, e);
