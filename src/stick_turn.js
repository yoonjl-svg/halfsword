// ─────────────────────────────────────────────────────────────
//  이동 스틱 돌리기 몸짓 읽기 (10/23 — 이베리아 휘감아 돌기 스틱 판 · secret.js PlayerSecretWatch.spinStick 이 부른다). 순수 함수 · 난수 없음 · 가져오는 것 없음.
//   사장님 10/23 00:3x '공격 버튼 대신 이동 버튼을 360도 돌린다거나' · 00:4x '한 바퀴로 하지 말고 반 바퀴 이상으로 하자'
//   docs/strike/iberian_spin_2026-10-22.md §10 · 값 config SECRET.ibSpin.stickTurn · stickTime · stickPath
//
//   스틱 값(input.move — 데드존 안이면 0, 키보드는 여덟 방향 단위 벡터)이 0 이 아닌 동안 표본마다 각의 바뀜(짧은 쪽, −π ~ π)을 부호 있게 쌓는다.
//   한 방향으로만 쌓는다 — 반대로 돌면 돌아선 그 표본부터 그 방향으로 새로 센다. 최근 time 초 안에 쌓인 각이 need(rad) 에 이르면 참.
//   스틱을 놓으면(0 — 데드존 안) 셈을 비운다. 부르는 쪽이 무장이 풀리거나 낼 수 없을 때 stickTurnClear 로 비운다.
//   path(스위치 SECRET.ibSpin.stickPath): 두 표본 사이 곧은 길이 데드존을 지나면(한 프레임에 스틱이 가운데를 건너뜀 — 앞에서 뒤로 휙 당김 · 키보드 W → S)
//    놓은 것과 같게 비운다. 끄면 그런 한 걸음이 짧은 쪽으로 읽혀(정확히 반대면 π) 반 바퀴로 셀 수 있다
//   잘못 나감을 막는 시험 칸 둘 (기본 끔 — 새 수 없이 있는 수만 · 확인표 2247):
//    rate: 표본마다 각 빠르기가 need ÷ time(반 바퀴 · 0.6 s 면 300°/s — 몸짓이 내야 하는 평균 빠르기) 밑이면 쌓지 않는다(머묾으로 봄 — 걷다 천천히 흘러간 각을 안 셈)
//    from: 스틱을 데드존 밖으로 민 때부터 time 초 안에 다 돌아야 한다(쥐고 걷던 스틱을 둥글게 옮기는 것은 안 셈 — 몸짓은 가운데에서 밀어 시작)
// ─────────────────────────────────────────────────────────────

export const STICK_DEAD = 0.15; // 화면 조이스틱 가운데 데드존 (원값 — input.js attachStick 이 이 수를 쓴다)
const EPS = 1e-6; // 각 비교 여유 (rad — 키보드 45° 넷의 뜬수 오차)

/** 셈 상태 하나 (몸마다) */
export function stickTurnState() {
  return { t: 0, a: null, sgn: 0, s: 0, hist: [], x: 0, y: 0, turn: 0, zero: false, out: -Infinity };
}

/** 셈 비우기 (무장 풀림 · 낼 수 없음 — 부르는 쪽). released = 스틱을 놓아 비움(데드존 안 · 가운데 건너뜀 — 다음 표본이 '밀어 나옴') */
export function stickTurnClear(st, released = false) {
  st.a = null;
  st.sgn = 0;
  st.s = 0;
  st.hist.length = 0;
  st.turn = 0;
  st.zero = released;
}

/** 데드존 뒤 값(크기 0 ~ 1)을 손가락 원값(크기 DEAD ~ 1)으로 — input.js attachStick 의 거꾸로 (키보드 단위 벡터는 1 그대로) */
function rawOf(x, y) {
  const m = Math.hypot(x, y);
  const k = (STICK_DEAD + (1 - STICK_DEAD) * Math.min(1, m)) / m;
  return [x * k, y * k];
}

/** 선분 a–b 와 원점 사이 가장 가까운 거리 */
function segOrigin(ax, ay, bx, by) {
  const ux = bx - ax;
  const uy = by - ay;
  const L2 = ux * ux + uy * uy;
  const t = L2 > 1e-12 ? Math.min(1, Math.max(0, -(ax * ux + ay * uy) / L2)) : 0;
  return Math.hypot(ax + ux * t, ay + uy * t);
}

/**
 * 표본 하나 (dt 초 뒤 스틱 x · y). 돌려줌: 최근 time 초 안에 한 방향으로 쌓인 각이 need 에 이르렀나 (st.turn 에 그 각 rad).
 *  opt = { time (s), need (rad), path (bool — 기본 참), rate (bool — 기본 거짓), from (bool — 기본 거짓) }
 */
export function stickTurnStep(st, dt, x, y, opt) {
  st.t += dt;
  if (!(Math.hypot(x, y) > 1e-9)) {
    stickTurnClear(st, true); // 놓음 (데드존 안)
    return false;
  }
  if (st.a != null && opt.path !== false) {
    const p = rawOf(st.x, st.y);
    const q = rawOf(x, y);
    if (segOrigin(p[0], p[1], q[0], q[1]) < STICK_DEAD) stickTurnClear(st, true); // 표본 사이에 가운데를 건너뜀 = 놓음
  }
  st.x = x;
  st.y = y;
  const a = Math.atan2(y, x);
  if (st.a == null) {
    st.a = a;
    st.out = st.zero ? st.t : -Infinity; // 밀어 나온 때 (부르는 쪽이 비운 뒤 쥔 채 이어진 스틱은 모름 = −∞)
    st.zero = false;
    st.hist.push({ t: st.t, s: 0 });
    return false;
  }
  let d = a - st.a;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  st.a = a;
  if (d === 0 || (opt.rate && Math.abs(d) < (opt.need / opt.time) * dt)) {
    st.hist[st.hist.length - 1].t = st.t; // 그 각에 머묾(또는 느린 흐름 — rate) — 마지막 표본을 지금으로 (오래 쥐었다 돌려도 돌기 시작한 때부터 잼)
    return false;
  }
  const sg = d > 0 ? 1 : -1;
  if (st.sgn && sg !== st.sgn) {
    // 반대로 돎 — 돌아선 표본(앞 표본)부터 이 방향으로 새로
    const t0 = st.hist[st.hist.length - 1].t;
    st.hist.length = 0;
    st.s = 0;
    st.hist.push({ t: t0, s: 0 });
  }
  st.sgn = sg;
  st.s += d;
  st.hist.push({ t: st.t, s: st.s });
  while (st.hist.length > 1 && st.hist[0].t < st.t - opt.time - 1e-9) st.hist.shift(); // time 초보다 오래된 표본은 버림 (남은 가장 이른 표본부터 잼)
  st.turn = Math.abs(st.s - st.hist[0].s);
  if (opt.from && st.t - st.out > opt.time + 1e-9) return false; // 밀어 나온 지 time 초가 넘음
  return st.turn >= opt.need - EPS;
}
