// ─────────────────────────────────────────────────────────────
//  거점전 — 두 거점 쥐기 규칙 한 곳 (사장님 11/21 '거점 쥐기 넣어' → '생사전은 전멸을 목표로 해야 생사전이야. 거점전은 따로 만들자.' · 설계 docs/design/saengsa_3v3_2026-11-21.md §3-5 · 기록 docs/strike/capture_mode_2026-11-21.md)
//   거점 = 맵의 거점 원 둘 (무대 표 src/saengsa_maps.js points — 두 다리 = 다리 가운데 반지름 1.3 · 성벽 안뜰 = 문길 가운데 1.2)
//   ① 원 안에 한 편 몸만 서 있는 채 CAPTURE.take 초가 이어지면 그 편 것 (판 시작엔 둘 다 빔 · 다른 편이 뺏을 때까지 그 편 것)
//      서 있는 몸만 셈: 산 · 부활하는 중이 아님 · 서 있음(stand · 다리를 다쳐 꿇은 채 싸우는 kneel) — 쓰러짐(down) · 일어나는 중 · 죽음 · 코마는 안 셈
//      두 편이 함께 서 있거나 아무도 없으면 쥐는 셈은 처음부터
//   ② 한 편이 두 거점을 다 가진 채 CAPTURE.hold 초 → 그 편 이김. 상대 몸이 어느 원에든 서 있는 동안은 멈춤 · 하나를 뺏기면 hold 초부터 다시
//   ③ 한 편 전멸도 그대로 이김 (match.js 가 먼저 봄)
//  사람 · AI 같은 규칙 (몸 자리만 읽음). 거점전 판 하나에 하나 (match.js createMatch({ capture: true }) — 거점이 둘 있는 맵만). 생사전 · 1:1 · 여정 · 다른 동시 대전은 없음(전멸만 — 예전 그대로)
//  화면(team_hud.js) · AI(capture_ai.js)는 이 상태를 읽기만 — 사람에게 보이는 것(거점 주인 · 쥐는 중 · 남은 초)과 같은 정보
// ─────────────────────────────────────────────────────────────
import { CAPTURE } from './config.js';

/** 거점 원에서 세는 몸: 산 · 부활하는 중이 아님 · 서 있음 (쓰러짐 · 일어나는 중 · 죽음은 안 셈) */
export const pointBody = (f) => !!f && f.alive && !f.revival && (f.state === 'stand' || f.state === 'kneel');

/** 판의 거점 상태. points = [{ x, z, r }] (지도 꼴 geo.points) · cfg = CAPTURE */
export function createCapture(points, cfg = CAPTURE) {
  return {
    take: cfg.take,
    hold: cfg.hold,
    t: 0,
    points: points.map((p) => ({ x: p.x, z: p.z, r: p.r, owner: null, by: null, k: 0, n: [0, 0] })), // owner = 그 편 (null 빔) · by = 쥐는 중인 편 · k = 쥔 초 · n = 편마다 원 안에 선 몸 수
    holder: null, // 두 거점을 다 가진 편 (없으면 null)
    clock: cfg.hold, // 남은 초 (holder 가 있을 때 줄어듦)
    paused: false, // 상대 몸이 원 안에 서 있어 시계가 멈춤
    winner: null, // 쥐기로 이긴 편
  };
}

/** 원 안에 서 있나 (골반 수평 자리) */
export function inPoint(P, f) {
  const t = f.bodies.pelvis.translation();
  const dx = t.x - P.x, dz = t.z - P.z;
  return dx * dx + dz * dz <= P.r * P.r;
}

/** 한 스텝 (match.js stepMatch — 전멸을 본 뒤). 돌려줌: 쥐기로 이긴 편 (아직이면 null) */
export function stepCapture(C, fighters, dt) {
  C.t += dt;
  for (const P of C.points) {
    P.n[0] = P.n[1] = 0;
    for (const f of fighters) if (pointBody(f) && inPoint(P, f)) P.n[f.team]++;
    const k = P.n[0] > 0 && P.n[1] === 0 ? 0 : P.n[1] > 0 && P.n[0] === 0 ? 1 : -1;
    if (k < 0 || P.owner === k) { P.by = null; P.k = 0; continue; }
    if (P.by !== k) (P.by = k), (P.k = 0);
    P.k += dt;
    if (P.k >= C.take - 1e-9) (P.owner = k), (P.by = null), (P.k = 0);
  }
  const o = C.points[0].owner;
  const both = o != null && C.points.every((P) => P.owner === o) ? o : null;
  if (both !== C.holder) (C.holder = both), (C.clock = C.hold); // 쥔 편이 바뀌거나 하나를 뺏기면 처음부터
  C.paused = both != null && C.points.some((P) => P.n[1 - both] > 0);
  if (both == null || C.paused) return null;
  C.clock -= dt;
  if (C.clock > 1e-9) return null;
  C.clock = 0;
  C.winner = both;
  return both;
}
