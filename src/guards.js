// ─────────────────────────────────────────────────────────────
//  검술 자세 지도 (독일식 롱소드, 리히테나워 전통)
//
//  손가락이 가리키는 곳(패드 위치, 몸 앞 평면의 좌우 x·위아래 y, 미터) → 실제 검술 자세.
//  자세마다 손(칼자루) 위치, 칼끝 방향, 골반·가슴을 트는 정도, 상체 숙이기, 무릎 굽혀 낮추기가 있다.
//  손가락이 자세와 자세 사이에 있으면 가까운 자세들을 부드럽게 섞는다.
//  → 자세에서 자세로 빠르게 옮기는 것이 곧 베기다.
//     지붕(위) → 긴 자세(가운데) → 바보(아래) = 위에서 내려베기 (마이어: "지붕에서 긴 자세를 지나 바보 자세로")
//     오른쪽 위 → 왼쪽 아래 = 사선 베기(분노의 베기)
//     오른쪽 옆 → 왼쪽 옆 = 가로베기
//
//  자료: Ringeck·Meyer 교본의 자세 설명 + 현대 HEMA 수련 기준을 몸 크기(키 1.75m)에 맞춰 옮긴 값.
//  각도·높이 숫자는 교본에 적혀 있지 않아 추정한 값이다.
//
//  좌표 (몸 기준, 가슴 한가운데가 원점): hand = [앞, 위, 칼 든 쪽] (m)
//  blade = [올려본 각, 옆으로 돌린 각] (도). 0,0 = 칼끝이 정면. 옆 각은 + 가 칼 든 쪽.
//  yaw = + 이면 칼 든 쪽 어깨·골반이 뒤로 빠진다(몸을 칼 든 쪽으로 튼다). pitch = + 이면 앞으로 숙인다.
// ─────────────────────────────────────────────────────────────

const RAW = [
  // 이름, 패드 [x, y], 손 [앞, 위, 옆], 칼끝 [올려본 각, 옆 각], 골반 yaw, 가슴 yaw, 숙이기, 낮추기(m)
  { name: '지붕 (Vom Tag)', pad: [0.02, 0.52], hand: [0.18, 0.55, 0.06], blade: [100, 0], pelvisYaw: 25, chestYaw: 30, pitch: 0, drop: 0.05 },
  { name: '황소 (Ochs)', pad: [0.3, 0.26], hand: [0.28, 0.29, 0.22], blade: [-15, -12], pelvisYaw: 25, chestYaw: 30, pitch: 3, drop: 0.07 },
  { name: '긴 자세 (Langort)', pad: [0.0, 0.03], hand: [0.57, 0.07, 0.03], blade: [-3, 0], pelvisYaw: -20, chestYaw: -20, pitch: 8, drop: 0.07 },
  // 옆 자세: 가로베기(Mittelhau/Zwerchhau)를 준비하려고 칼을 옆으로 눕혀 뒤로 뺀 자세 (추정)
  { name: '옆 자세', pad: [0.52, 0.03], hand: [0.15, 0.12, 0.28], blade: [5, 110], pelvisYaw: 30, chestYaw: 45, pitch: 2, drop: 0.06 },
  { name: '쟁기 (Pflug)', pad: [0.18, -0.28], hand: [0.28, -0.31, 0.15], blade: [30, -12], pelvisYaw: 25, chestYaw: 25, pitch: 5, drop: 0.07 },
  { name: '바꿈 (Wechsel)', pad: [0.38, -0.44], hand: [0.25, -0.33, 0.2], blade: [-45, 40], pelvisYaw: 10, chestYaw: 15, pitch: 5, drop: 0.07 },
  { name: '옆 지킴 (Nebenhut)', pad: [0.55, -0.26], hand: [0.08, -0.31, 0.24], blade: [-35, 150], pelvisYaw: 40, chestYaw: 45, pitch: 5, drop: 0.08 },
  { name: '바보 (Alber)', pad: [0.0, -0.5], hand: [0.4, -0.33, 0.02], blade: [-40, 0], pelvisYaw: -15, chestYaw: -10, pitch: 8, drop: 0.07 },
  // 왼쪽 (칼 든 반대쪽): 오른쪽 자세를 거울에 비춘 것 + 사선 베기가 끝나는 왼쪽 바꿈 자세
  { name: '왼쪽 황소', pad: [-0.3, 0.26], hand: [0.28, 0.29, -0.12], blade: [-15, 12], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.07 },
  { name: '왼쪽 옆 자세', pad: [-0.52, 0.03], hand: [0.2, 0.12, -0.18], blade: [5, -110], pelvisYaw: -30, chestYaw: -45, pitch: 2, drop: 0.06 },
  { name: '왼쪽 쟁기', pad: [-0.18, -0.28], hand: [0.28, -0.31, -0.06], blade: [30, 12], pelvisYaw: -20, chestYaw: -20, pitch: 5, drop: 0.07 },
  { name: '왼쪽 바꿈', pad: [-0.4, -0.42], hand: [0.32, -0.31, -0.1], blade: [-45, -40], pelvisYaw: -30, chestYaw: -40, pitch: 12, drop: 0.08 },
];

const D2R = Math.PI / 180;
export const GUARDS = RAW.map((g) => {
  const el = g.blade[0] * D2R;
  const az = g.blade[1] * D2R;
  return {
    ...g,
    dir: [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)],
    pelvisYaw: g.pelvisYaw * D2R,
    chestYaw: g.chestYaw * D2R,
    pitch: g.pitch * D2R,
  };
});

const SIGMA2 = 0.15 * 0.15;

/**
 * 패드 위치 (x, y) → 섞인 자세. out을 채워서 돌려준다.
 * out = { hand:[3], dir:[3], pelvisYaw, chestYaw, pitch, drop, nearest }
 */
export function guardAt(x, y, out) {
  let wSum = 0;
  let best = -1;
  let bestW = -1;
  const h = (out.hand ||= [0, 0, 0]);
  const d = (out.dir ||= [0, 0, 0]);
  h[0] = h[1] = h[2] = d[0] = d[1] = d[2] = 0;
  out.pelvisYaw = out.chestYaw = out.pitch = out.drop = 0;
  for (let i = 0; i < GUARDS.length; i++) {
    const g = GUARDS[i];
    const dx = x - g.pad[0];
    const dy = y - g.pad[1];
    const w = Math.exp(-(dx * dx + dy * dy) / SIGMA2);
    if (w > bestW) {
      bestW = w;
      best = i;
    }
    wSum += w;
    for (let k = 0; k < 3; k++) {
      h[k] += g.hand[k] * w;
      d[k] += g.dir[k] * w;
    }
    out.pelvisYaw += g.pelvisYaw * w;
    out.chestYaw += g.chestYaw * w;
    out.pitch += g.pitch * w;
    out.drop += g.drop * w;
  }
  const inv = 1 / Math.max(1e-9, wSum);
  for (let k = 0; k < 3; k++) h[k] *= inv;
  out.pelvisYaw *= inv;
  out.chestYaw *= inv;
  out.pitch *= inv;
  out.drop *= inv;
  // 칼끝 방향: 가중 평균을 정규화. 거의 반대 방향끼리 섞여 상쇄되면 가장 가까운 자세의 방향을 쓴다
  let len = Math.hypot(d[0], d[1], d[2]) * inv;
  if (len < 0.35) {
    const g = GUARDS[best];
    d[0] = g.dir[0];
    d[1] = g.dir[1];
    d[2] = g.dir[2];
    len = 1;
  } else {
    const s = 1 / Math.hypot(d[0], d[1], d[2]);
    d[0] *= s;
    d[1] *= s;
    d[2] *= s;
  }
  out.nearest = best;
  return out;
}
