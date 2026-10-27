// 적소검의 날 윤곽을 겉모습·충돌·질량 적분이 함께 쓴다 (10/27 사용자 자체 리뷰 승인).
// 특정 유물의 실측 복원이 아니라, 승인된 80 cm 고대 직검의 게임 모형이다.
export const CHIXIAO_SECTIONS = [0, 0.025, 0.08, 0.18, 0.34, 0.55, 0.76, 0.84, 0.90, 0.95, 0.98, 1];
export const CHIXIAO_X = [-1, -0.92, -0.77, -0.18, -0.13, -0.055, 0, 0.055, 0.13, 0.18, 0.77, 0.92, 1];
export const CHIXIAO_Z = [0, 0.22, 0.44, 0.84, 0.75, 0.97, 1, 0.97, 0.75, 0.84, 0.44, 0.22, 0];
export const chixiaoWidth = t => 1.20 * (1 - 0.50 * t - 0.50 * t ** 6);
export const chixiaoThickness = t => (1 - 0.25 * t) * (t > 0.90 ? (1 - t) / 0.10 : 1);

// 정면 테이퍼·최대 두께를 따른 한 개의 볼록 껍질. 아주 얇은 날선·홈은 시각 표현이다.
// 날선의 두 면이 완전히 만나는 영두께 모서리는 Rapier 광선 검사에서 일부 누락된다.
// 단면을 작은 사각으로 감싸 접촉을 안정시키며, 48점으로 긴 칼의 판정 비용도 줄인다.
// 남은 길이는 강제 파손 검사에서도 원래 테이퍼를 유지하기 위한 값이다.
export function chixiaoCollider(R, index, isBlade, shape, remaining = 1) {
  if (!isBlade) return undefined;
  const [, hx, hy, hz] = shape, points = [];
  const sections = [...CHIXIAO_SECTIONS.filter(t => t < remaining), remaining];
  for (const t of sections) for (const side of [-1, 1]) for (const x of [-1, 1]) {
    points.push(x * hx * chixiaoWidth(t), 2 * hy * t - hy * remaining,
      side * hz * chixiaoThickness(t));
  }
  const desc = R.ColliderDesc.convexHull(new Float32Array(points));
  if (!desc) throw new Error('적소검 칼날 볼록 충돌체 생성 실패');
  return desc;
}

// 실제 날 면의 삼각형을 원점과 잇는 사면체로 적분한다.
// 중공 장식·슴베를 포함한 자루 부품 질량은 별도 게임 추정이며, 날 관성을 임의 목표에 역산하지 않는다.
export function chixiaoBladeMass(mass, shape) {
  const [, hx, hy, hz] = shape;
  const point = (t, k, side) => [CHIXIAO_X[k] * hx * chixiaoWidth(t), 2 * hy * t,
    side * hz * CHIXIAO_Z[k] * chixiaoThickness(t)];
  let volume = 0, first = 0, xx = 0, yy = 0, zz = 0;
  function tri(a, b, c) {
    const v = (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    volume += v;
    first += v * (a[1] + b[1] + c[1]) / 4;
    const moment = k => v * (a[k] ** 2 + b[k] ** 2 + c[k] ** 2 + a[k] * b[k] + a[k] * c[k] + b[k] * c[k]) / 10;
    xx += moment(0); yy += moment(1); zz += moment(2);
  }
  for (const side of [-1, 1]) for (let j = 1; j < CHIXIAO_SECTIONS.length; j++) for (let k = 0; k < CHIXIAO_X.length - 1; k++) {
    const a = point(CHIXIAO_SECTIONS[j - 1], k, side), b = point(CHIXIAO_SECTIONS[j], k, side);
    const c = point(CHIXIAO_SECTIONS[j], k + 1, side), d = point(CHIXIAO_SECTIONS[j - 1], k + 1, side);
    if (side > 0) { tri(a, c, b); tri(a, d, c); } else { tri(a, b, c); tri(a, c, d); }
  }
  // 밑동의 마개는 y=0 면이므로 이 좌표계의 부피·모멘트 기여가 0이다.
  const centre = first / volume;
  return { mass, comY: centre - hy, Ie: mass * ((yy + zz) / volume - centre ** 2),
    It: mass * (xx + zz) / volume, volume: Math.abs(volume) };
}
