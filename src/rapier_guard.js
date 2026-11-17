// ─────────────────────────────────────────────────────────────
//  Rapier 콜백 예외 드러내기 (11/17 — 기록 docs/strike/ae_port_2026-11-17.md §11-2)
//  물리 엔진(WASM)이 부르는 JS 콜백(물리 걸이 filterContactPair · 사건 비우기 drainContactForceEvents · contactPair · contactPairsWith ·
//   intersectionPairsWith · intersectionsWithShape · castRay 거르개) 안에서 난 예외는 엔진 경계에서 소리 없이 삼켜졌다 —
//   판정 버그가 멈춤 대신 '상처 없음'으로만 보였음(analyze 가 늘 던지게 해도 12 s 판이 멈추지 않고 상처 0).
//  guarded(통, fn, 대신값): 콜백을 감싸 예외를 잡고 — 첫 것을 통.lastError 에 남기고 · 프로세스에 한 번 console.error · 엔진에는 대신값을 돌려줌.
//  rethrowRapier(통): 엔진 부름이 돌아온 뒤 — node(시뮬 · 시험)에서는 잡힌 예외를 다시 던짐(크게 실패) · 브라우저는 적은 것으로 끝(판은 이어감).
//  예외가 없으면 아무 일도 하지 않는다 (판 · 관문 바이트 같음).
// ─────────────────────────────────────────────────────────────
const NODE = typeof window === 'undefined';
let logged = false;

/** 콜백 fn 을 감쌈 — 예외면 box.lastError(첫 것) · box.pending 에 적고 한 번 console.error · fallback 을 돌려줌 */
export function guarded(box, fn, fallback) {
  return function guardedRapierCallback(...a) {
    try {
      return fn.apply(this, a);
    } catch (e) {
      noteRapierError(box, e);
      return fallback;
    }
  };
}

/** 잡힌 예외 적기 (guarded 가 부름 · 시험도 부를 수 있음) */
export function noteRapierError(box, e) {
  if (box) {
    if (!box.lastError) box.lastError = e;
    if (!box.pending) box.pending = e;
  }
  if (!logged) {
    logged = true;
    console.error('[Rapier 콜백 예외 — 엔진이 삼키던 것]', e);
  }
}

/** 엔진 부름이 돌아온 뒤: 잡힌 예외가 있으면 node 에서는 다시 던짐 (한 예외에 한 번) · 브라우저는 비우기만 */
export function rethrowRapier(box) {
  const e = box?.pending;
  if (!e) return;
  box.pending = null;
  if (NODE) throw e;
}
