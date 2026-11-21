// ─────────────────────────────────────────────────────────────
//  보는 시계 (11/21 감사 N-011 · 사장님 11/21 '멈춤 동안 멈춰.')
//
//  겉모습만 도는 것(레전드 기운 · 비기 잔상 호 · 장식 진자 · 권총 효과 · 손 돌림 · 몸 그늘 · 등 뒤 알림 깜빡임)이 벽시계 대신 읽는 시계.
//  싸움 중 멈춤(일시정지 창 — main.js frame) 동안 흐르지 않고, 풀면 멈춘 그 자리에서 이어 간다 —
//  멈춘 동안의 벽시계 시간은 통째로 빠져 앞으로 튀거나 몰아 흐르지 않는다.
//  무대 움직임(눈 · 깃발 · 물 …)은 원래 화면 dt 로만 흐르고(arena.update) 멈춤 동안 부르지 않는다 — 이 시계와 같은 때 멈춘다.
//  멈춘 적이 없으면 viewNow() = performance.now() (모든 판이 예전 그대로).
// ─────────────────────────────────────────────────────────────

const wall = () => globalThis.performance?.now?.() ?? Date.now();
let heldAt = null; // 멈춘 때의 벽시계 ms (null = 흐름)
let lost = 0; // 지난 멈춤들의 벽시계 ms 합

/** 보는 시계 ms (멈춤 동안 그대로) */
export function viewNow() {
  return (heldAt ?? wall()) - lost;
}

/** 멈춤(true) · 풀기(false) — 같은 값을 거듭 불러도 한 번 */
export function holdView(on) {
  if (on) {
    if (heldAt == null) heldAt = wall();
  } else if (heldAt != null) {
    lost += wall() - heldAt;
    heldAt = null;
  }
}

/** 지금 멈춰 있나 */
export function viewHeld() {
  return heldAt != null;
}
