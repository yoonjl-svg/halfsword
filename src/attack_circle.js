// ─────────────────────────────────────────────────────────────
//  공격 원 그리기 몸짓 읽기 (10/24 — 이베리아 싱지르 공격 원 판 · secret.js PlayerSecretWatch.spinCircle 이 부른다). 순수 함수 · 난수 없음.
//   사장님 10/24 02:5x '커맨드를 방향키 말고 공격 동작 360도 원형 입력으로 변경'
//   docs/strike/iberian_spin_2026-10-22.md §14 · 값 config SECRET.ibSpin.circleTime · circleR (사장님 확인 전 — 확인표 2364)
//
//   공격 입력의 손 움직임(input.consumeHandDelta — 터치 오른쪽 끌기 · 데스크톱 잠긴 마우스, 손 m)을 프레임마다 받아 한 획의 길(점 줄)을 모은다.
//   획 = 손가락이 닿아 있는 동안(마우스는 늘) 움직임이 이어진 동안 — 손가락을 떼거나 gap 초 넘게 멈추면 끝(셈을 비움).
//   최근 time 초 안의 점들로 ① 그 길의 가운데(길이 무게 — 고르게 그린 원이면 원의 가운데) ② 가운데에서의 평균 거리(반지름)를 내고,
//   ③ 가운데 둘레로 돈 각을 부호 있게 쌓는다. 한 마디가 가운데 둘레 안쪽 원(반지름 × inner — 판 값 0.5 = SECRET.ibSpin.circleInner)을 지나면
//   거기까지 쌓은 각을 버린다(가운데를 지나는 곧은 · 휜 긋기 · 오가는 긋기 · 좁은 고리는 원이 아니다 — stick_turn.js 의 '가운데 건너뜀 = 놓음'과 같은 꼴.
//   스틱 데드존 몫 0.15 로는 한 획에 갔다 둥글게 돌아오는 U 긋기가 95 % · 쉼 없이 움직이는 마우스 6 s 가 39 % 원으로 읽혔다 — attack_circle_drives.mjs).
//   반지름이 rMin 이상이고 쌓인 각이 need(rad — 한 바퀴 2π) 에 이르면 참. 쌓인 각의 부호 = 도는 쪽(+ = 반시계 — 화면에서 손이 x 오른쪽 · y 위).
// ─────────────────────────────────────────────────────────────

export const CIRCLE_INNER = 0.5; // 가운데 건너뜀 문턱 (반지름의 몫 — opt.inner 를 안 주면. 판 값 SECRET.ibSpin.circleInner 와 같은 수)
const EPS = 1e-6;

/** 셈 상태 하나 (몸마다) */
export function circleState() {
  return { t: 0, pts: [], x: 0, y: 0, still: 0, t0: null, turn: 0, sgn: 0, r: 0, cx: 0, cy: 0 };
}

/** 셈 비우기 (획 끝 · 무장 풀림 · 낼 수 없음) */
export function circleClear(st) {
  st.pts.length = 0;
  st.x = st.y = 0;
  st.still = 0;
  st.t0 = null;
  st.turn = 0;
  st.sgn = 0;
  st.r = 0;
}

/** 획이 이어지는 중인가 (time 초 안에 시작한 획 — 부르는 쪽이 '원이 될 수 있는 동안'으로 읽는다) */
export function circleLive(st, time) {
  return st.t0 != null && st.t - st.t0 <= time + EPS;
}

/** 점 줄의 길이 무게 가운데 · 평균 반지름 (점이 둘 미만이면 null) */
export function circleFit(pts) {
  let L = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    L += l;
    sx += ((a.x + b.x) / 2) * l;
    sy += ((a.y + b.y) / 2) * l;
  }
  if (!(L > 1e-9)) return null;
  const cx = sx / L;
  const cy = sy / L;
  let R = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    R += Math.hypot((a.x + b.x) / 2 - cx, (a.y + b.y) / 2 - cy) * l;
  }
  return { cx, cy, r: R / L, len: L };
}

/** 선분 a–b 와 점 c 사이 가장 가까운 거리 */
function segDist(ax, ay, bx, by, cx, cy) {
  const ux = bx - ax;
  const uy = by - ay;
  const L2 = ux * ux + uy * uy;
  const t = L2 > 1e-12 ? Math.min(1, Math.max(0, ((cx - ax) * ux + (cy - ay) * uy) / L2)) : 0;
  return Math.hypot(ax + ux * t - cx, ay + uy * t - cy);
}

/** 가운데 (cx, cy) 둘레로 점 줄이 돈 각 (rad, 부호 있게) — 안쪽 원(반지름 inner)을 지나는 마디에서 버리고 그 뒤부터 */
export function circleTurn(pts, cx, cy, inner) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (segDist(a.x, a.y, b.x, b.y, cx, cy) < inner) {
      s = 0; // 가운데를 지남 — 원이 아니다
      continue;
    }
    let d = Math.atan2(b.y - cy, b.x - cx) - Math.atan2(a.y - cy, a.x - cx);
    if (d > Math.PI) d -= 2 * Math.PI;
    else if (d <= -Math.PI) d += 2 * Math.PI;
    s += d;
  }
  return s;
}

/**
 * 프레임 하나 (dt 초 동안 손 움직임 dx · dy — 손 m, x 오른쪽 · y 위). down = 손가락이 닿아 있나(마우스는 늘 참).
 *  opt = { time (s — 이 초 안의 점만), need (rad), rMin (m — 반지름 하한), gap (s — 이만큼 멈추면 획 끝), inner (반지름의 몫 — 기본 CIRCLE_INNER) }
 *  돌려줌: 원이 다 그려졌나 (st.turn = 쌓인 각 rad · st.sgn = 도는 쪽 · st.r = 반지름)
 */
export function circleStep(st, dt, dx, dy, down, opt) {
  st.t += dt;
  if (!down) {
    circleClear(st);
    return false;
  }
  if (!(Math.hypot(dx, dy) > 1e-9)) {
    if (st.t0 != null && (st.still += dt) >= opt.gap - EPS) circleClear(st); // 멈춤 = 획 끝
    return false;
  }
  st.still = 0;
  if (st.t0 == null) {
    st.t0 = st.t - dt;
    st.x = st.y = 0;
    st.pts.push({ t: st.t - dt, x: 0, y: 0 });
  }
  st.x += dx;
  st.y += dy;
  st.pts.push({ t: st.t, x: st.x, y: st.y });
  while (st.pts.length > 2 && st.pts[1].t < st.t - opt.time - EPS) st.pts.shift(); // time 초보다 오래된 점은 버림
  const F = circleFit(st.pts);
  if (!F) return false;
  st.r = F.r;
  st.cx = F.cx;
  st.cy = F.cy;
  if (F.r < opt.rMin) {
    st.turn = 0;
    st.sgn = 0;
    return false;
  }
  const s = circleTurn(st.pts, F.cx, F.cy, F.r * (opt.inner ?? CIRCLE_INNER));
  st.turn = Math.abs(s);
  st.sgn = s > 0 ? 1 : s < 0 ? -1 : 0;
  return st.turn >= opt.need - EPS;
}
