// ─────────────────────────────────────────────────────────────
//  생사전 전용 맵 (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — 설계 docs/design/saengsa_3v3_2026-11-21.md §3-1 · §3-3 · §5 · 기록 docs/strike/saengsa_maps_2026-11-21.md)
//
//  무대 표 SAENGSA_MAPS — 맵마다 한 줄. 그림(stage_saengsa_maps.js) · 충돌체 · 시작 자리 · AI 길(길목 머리 점) · 카메라 테두리 · 판 시작 훑기 · 고르기 화면 작은 그림이
//   모두 이 표에서 mapGeo(줄) 로 셈한 몫을 읽는다 — 값을 고치면 맵이 따라 바뀐다 (설계 §5 '사장님이 고칠 값').
//  좌표: 판 가운데 (0, 0) · 0 편(내 편)은 −x 끝에서 +x 를 본다 · 길목(다리 · 문)은 z ∓ 로 둘. 길이는 m.
//  이기는 조건은 (가) 전멸만 — 지금 그대로 (사장님 11/21). 거점(point) · 길목 점(chokes)은 (나) 두 거점 쥐기를 위해 표에 미리 적어 두기만 한다(지금 규칙은 읽지 않음).
//  생사전 판은 늘 전용 맵(낮 하나) — 경기마다 대회 씨앗(경기 씨앗 = hash32(대회 씨앗, 경기 id))으로 둘 가운데 하나 (pickSaengsaMap — 다시보기 · 이어받기 같음).
//   상대 AI 팀끼리 빠른 셈은 맵을 모르니 그대로.
// ─────────────────────────────────────────────────────────────
import { CIRCLE_FIELD, rectField } from './field.js';
import { hash32 } from './saengsa_rules.js';

export const SAENGSA_MAPS = Object.freeze([
  // 안 1 · 강가 두 다리 (설계 §3-1 · §5-1): 개울(못 건넘)을 건너는 다리 둘 — 난간 · 둔덕이 낮아 카메라 · 시야가 지금 그대로
  Object.freeze({
    id: 'bridges',
    stage: 'saengsa_bridges', // 무대 id (stages.js) — 생사전 판에서만 짓는다
    name: '두 다리 개울', // 화면 이름 (고르기 화면 · 싸움 화면 왼쪽 위)
    size: [36, 24], // 판 크기 x × z (가장자리 둔덕 안쪽 면)
    edge: { show: 0.5, block: 1.2 }, // 가장자리 낮은 돌 둔덕: 보이는 높이 · 막이 높이 (지금 울타리와 같은 1.2 m)
    stream: 4, // 개울 너비 (x — 들어갈 수 없음 · 3 m 밑이면 긴 칼이 건너 닿음)
    lanes: { z: 7, width: 2.6, length: 5.6 }, // 다리 둘: z ∓ 7 (사이 14 m) · 너비 2.6 · 길이 5.6
    rail: { show: 0.5, block: 1.2 }, // 다리 난간: 보이는 높이 · 막이 높이
    start: { x: 14, z: [-2.5, 0, 2.5] }, // 시작 자리: 편마다 x ∓ 14 · 셋이면 z −2.5 · 0 · +2.5 (둘 ∓1.25 · 하나 0)
    point: 1.3, // 거점 원 반지름 — 다리 가운데 ((나) 몫 · 지금 규칙은 읽지 않음)
    camOut: 1.3, // 카메라가 둔덕 밖으로 나갈 수 있는 거리 (지금 원: 울타리 9.19 → 카메라 10.5 m 와 같은 몫)
    sweep: { r0: 16, h0: 7 }, // 판 시작 훑기: 가운데에서 반지름 · 높이 (두 다리가 다 보이게 — 설계 §3-6)
  }),
  // 안 3 · 문 둘 성벽 안뜰 (설계 §3-3 · §5-3): 가운데 성벽(못 넘음 · 너머가 안 보임)을 지나는 문 둘 — 문루 아래 지붕 있는 좁은 길
  Object.freeze({
    id: 'court',
    stage: 'saengsa_court',
    name: '성벽 안뜰',
    size: [34, 22],
    edge: { show: 4, block: 4 }, // 바깥 높은 성벽 (카메라를 가둠)
    wall: { height: 3, thick: 1.5 }, // 가운데 성벽 높이 · 두께 (1.2 m 밑으로 낮추면 시야가 열려 다리 맵과 비슷해짐)
    lanes: { z: 6, width: 2.4, length: 3.4 }, // 문 둘: z ∓ 6 (사이 12 m) · 문길 너비 2.4 · 깊이 3.4 (문루 아래)
    gate: { tower: 1.2, height: 3.8, roof: 2.7 }, // 문루: 문길 양옆 탑 두께(z) · 문루 높이 · 지붕 밑 높이
    start: { x: 13, z: [-2.5, 0, 2.5] },
    point: 1.2, // 거점 원 — 문길 가운데 ((나) 몫)
    camOut: -0.45, // 카메라는 바깥 성벽 안쪽 면에서 이만큼 안 (음수 = 안쪽)
    sweep: { r0: 12.5, h0: 10 }, // 바깥 성벽 위로 훑음 (안뜰 안 · 성벽 둘 위에서 문 둘이 다 보이게)
  }),
]);
export const SAENGSA_MAP_BY_ID = Object.freeze(Object.fromEntries(SAENGSA_MAPS.map((m) => [m.id, m])));
export const SAENGSA_MAP_BY_STAGE = Object.freeze(Object.fromEntries(SAENGSA_MAPS.map((m) => [m.stage, m])));
export const isSaengsaStage = (stageId) => !!SAENGSA_MAP_BY_STAGE[stageId];

/** 경기 씨앗(matchSetup 의 seed = hash32(대회 씨앗, 경기 id)) → 이 경기의 맵 줄 (다시보기 · 이어받기 · 고르기 화면이 같은 값) */
export function pickSaengsaMap(seed) {
  return SAENGSA_MAPS[hash32(seed >>> 0, 'map') % SAENGSA_MAPS.length];
}

/** 대회 t 의 경기 m 의 맵 줄 (고르기 화면 — matchSetup 의 seed 와 같은 hash32(대회 씨앗, 경기 id)) */
export const mapOfMatch = (t, m) => pickSaengsaMap(hash32(t.seed, m.id));

/** 표 한 줄 → 셈한 몫 (막이 상자 · 길목 · 충돌체 · 거점 · 시작 자리 · 카메라 테두리) — 그림 · 물리 · AI · 작은 그림이 같이 읽는다 */
export function mapGeo(m) {
  const hx = m.size[0] / 2, hz = m.size[1] / 2;
  const blocks = [], lanes = [], colliders = [], rails = [], points = [];
  const box = (x0, x1, y0, y1, z0, z1) => colliders.push({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2] });
  const L = m.lanes, lw = L.width / 2, ll = L.length / 2;
  const laneZ = [-L.z, L.z];
  // 바깥 테두리 막이 (두께 0.4 m · 둔덕 / 성벽 높이) — 안쪽 면이 판 크기
  const et = m.edge.block >= 3 ? 1.0 : 0.4, eh = m.edge.block;
  box(-hx - et, -hx, 0, eh, -hz - et, hz + et);
  box(hx, hx + et, 0, eh, -hz - et, hz + et);
  box(-hx, hx, 0, eh, -hz - et, -hz);
  box(-hx, hx, 0, eh, hz, hz + et);
  // 막이 띠를 z 로 길목에서 끊어 놓는다: [z0, z1] 조각들
  const cuts = (gap) => {
    const out = [];
    let z = -hz;
    for (const zc of laneZ) { out.push([z, zc - gap]); z = zc + gap; }
    out.push([z, hz]);
    return out;
  };
  if (m.stream) {
    const sw = m.stream / 2;
    for (const [z0, z1] of cuts(lw)) {
      blocks.push({ x0: -sw, x1: sw, z0, z1, h: 0, kind: 'water' });
      box(-sw, -sw + 0.4, 0, m.rail.block, z0, z1); // 물가 막이 (안쪽 면 = 물가 선)
      box(sw - 0.4, sw, 0, m.rail.block, z0, z1);
    }
    for (const zc of laneZ) {
      for (const s of [-1, 1]) {
        const z = zc + s * (lw + 0.1);
        box(-ll, ll, 0, m.rail.block, z - 0.1, z + 0.1); // 다리 난간 막이 (두께 0.2 · 안쪽 면 = 다리 가장자리)
        rails.push({ x0: -ll, x1: ll, z0: z - 0.1, z1: z + 0.1 });
      }
    }
  }
  if (m.wall) {
    const wt = m.wall.thick / 2, G = m.gate, gt = G.tower;
    for (const [z0, z1] of cuts(lw + gt)) {
      blocks.push({ x0: -wt, x1: wt, z0, z1, h: m.wall.height, sight: true, kind: 'wall' });
      box(-wt, wt, 0, m.wall.height, z0, z1);
    }
    for (const zc of laneZ) {
      for (const s of [-1, 1]) {
        const za = zc + s * lw, zb = zc + s * (lw + gt);
        const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
        blocks.push({ x0: -ll, x1: ll, z0, z1, h: G.height, sight: true, kind: 'tower' });
        box(-ll, ll, 0, G.height, z0, z1);
      }
      box(-ll, ll, G.roof, G.height, zc - lw, zc + lw); // 문루 지붕 (문길 위)
    }
  }
  for (const zc of laneZ) {
    const head = m.stream ? 0.6 : 0.6;
    lanes.push({ x0: -ll, x1: ll, z0: zc - lw, z1: zc + lw, ends: [{ x: -ll - head, z: zc }, { x: ll + head, z: zc }] });
    points.push({ x: 0, z: zc, r: m.point });
  }
  const co = m.camOut;
  return {
    id: m.id,
    half: { x: hx, z: hz },
    blocks,
    lanes,
    rails,
    colliders,
    points, // 거점 ((나) 몫)
    chokes: lanes.flatMap((l) => l.ends), // 길목 점 = 길목 양쪽 머리 ((나) 몫 · AI 길이 지금 읽음)
    cam: { x0: -hx - co, x1: hx + co, z0: -hz - co, z1: hz + co },
    roofs: m.wall ? laneZ.map((zc) => ({ x0: -ll, x1: ll, z0: zc - lw, z1: zc + lw, y0: m.gate.roof, y1: m.gate.height })) : [],
    start: m.start,
  };
}

/** 시작 자리 (자리 차례 — teams[i] = 자리 i 의 편): 0 편 x = −start.x 에서 +x 를 · 1 편 +start.x 에서 −x 를 본다. 편 안 셋 = z 표 그대로 · 둘 = ∓ 반 간격 · 하나 = 0 */
export function mapSpawnSpots(m, teams) {
  const size = [0, 0];
  for (const t of teams) size[t]++;
  const seen = [0, 0];
  const zs = m.start.z, gap = zs.length > 1 ? zs[1] - zs[0] : 0;
  return teams.map((t) => {
    const k = seen[t]++;
    const n = size[t];
    const z = n >= zs.length ? zs[Math.min(k, zs.length - 1)] + (k >= zs.length ? (k - zs.length + 1) * gap : 0) : (k - (n - 1) / 2) * gap;
    return { x: t === 0 ? -m.start.x : m.start.x, z, heading: t === 0 ? 0 : Math.PI, team: t };
  });
}

const FIELDS = new Map();
/** 무대 id → 지도 꼴 (생사전 전용 맵이 아니면 원 무대) */
export function fieldForStage(stageId) {
  const m = SAENGSA_MAP_BY_STAGE[stageId];
  if (!m) return CIRCLE_FIELD;
  if (!FIELDS.has(m.id)) FIELDS.set(m.id, rectField({ ...mapGeo(m), map: m }));
  return FIELDS.get(m.id);
}
/** 맵 id → 지도 꼴 (시뮬 · 시험) */
export const fieldOfMap = (id) => fieldForStage(SAENGSA_MAP_BY_ID[id]?.stage);

/** 고르기 화면 작은 그림 (위에서 본 꼴 — 표에서 바로 그린 SVG 글): 땅 · 물 · 벽 · 길목 · 두 편 시작 점 (거점은 (나) 규칙이 들어올 때까지 그리지 않음) */
export function mapThumbSvg(m, { w = 132 } = {}) {
  const G = mapGeo(m);
  const pad = 1.2, W = m.size[0] + pad * 2, H = m.size[1] + pad * 2;
  const h = Math.round((w * H) / W);
  const X = (x) => (x + G.half.x + pad).toFixed(2), Z = (z) => (z + G.half.z + pad).toFixed(2);
  const rect = (b, fill, extra = '') => `<rect x="${X(b.x0)}" y="${Z(b.z0)}" width="${(b.x1 - b.x0).toFixed(2)}" height="${(b.z1 - b.z0).toFixed(2)}" fill="${fill}"${extra}/>`;
  const ground = m.stream ? '#b9ad86' : '#c8b48f', water = '#5f8fa8', wall = '#6a5a4a', deck = '#8d7150', rim = m.stream ? '#857a62' : '#5a4b3d';
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="${rim}"/>`, rect({ x0: -G.half.x, x1: G.half.x, z0: -G.half.z, z1: G.half.z }, ground)];
  for (const b of G.blocks) parts.push(rect(b, b.kind === 'water' ? water : wall));
  for (const l of G.lanes) parts.push(rect(l, m.stream ? deck : '#b39b78'));
  for (const t of [0, 1]) for (const z of m.start.z) parts.push(`<circle cx="${X(t ? m.start.x : -m.start.x)}" cy="${Z(z)}" r="0.9" fill="${t ? '#a33a2c' : '#d9a441'}" stroke="#2b241d" stroke-width="0.25"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" aria-hidden="true">${parts.join('')}</svg>`;
}
