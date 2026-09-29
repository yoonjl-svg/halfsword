// ─────────────────────────────────────────────────────────────
//  클립 아틀라스 (R2 §4) — clip/2 기준 동작을 읽고, 검사하고, φ(위상)·S(크기)로 표본한다
//
//  원본: docs/motion/clips/<베기>_<right|left>_<small|medium|large>.json + index.json (동작 연구 PM, 게임은 고치지 않는다)
//  묶음: src/strike/clips/atlas_v0.json (stillness-atlas-pack/1, tools/motion/pack_atlas.mjs 가 만든다) — 모는 채널만, φ 격자로 다시 표본, Float32 base64
//  두 길 모두 buildAtlas() 로 끝난다. 도함수(dv/dφ, d²v/dφ²)는 저장하지 않고 읽을 때 격자 위 5점 Savitzky–Golay 로 만든다.
//
//  좌표 (clip_format §2 = 게임 바라보는 틀): x 앞 · y 위 · z 칼 든 쪽. 가슴 틀 값(handS·handO·sword·edge·pole·girdle)은 가슴 가운데 원점.
//   가슴 틀 → 바라보는 틀: M = ry(−chest.yaw)·rz(−chest.lean)·rx(+chest.side) = tools/motion/lib/body.mjs frame(yaw, lean, side)
//   게임 단위 부호(§4.3): 골반·가슴 yaw = −deg·D2R (fighter.js pT = -G.pelvisYaw…), 숙임 = +lean·D2R, 옆굽힘 = +side·D2R,
//   drop = pelvis.drop − 0.06 (fighter.js follow('drop', (G.drop - 0.06)…)), 발끝 yaw = −deg·D2R, 뒤꿈치 = lift·GAIT.heelMax
//
//  섞기 (§4.4): S ≤ sizeMid 작게↔보통, 그 위 보통↔크게. 값·자리·각은 선형(yaw 는 풀어 둔 도 단위), 방향(sword·pole·edge)은 slerp(ω 는 slerp 의 닫힌 도함수).
//   격자 칸 안은 (v, v′, v″) 5차 에르미트 → C² (방향은 시작 마디 접평면에서 같은 5차 → ḋ = ω × d).
//   S 가 1 을 넘는 몫(over)은 모든 채널에 over·(크게 − 보통)을 더한다(방향은 보통→크게 회전 벡터를 over 배 더 돌림).
//   이득 1, 상한 없음 — 아틀라스는 자료를 표본할 뿐 빠르기·크기·시간에 걸쇠를 두지 않는다. φ 는 격자 양 끝(−1, 2.2) 밖에서 끝 자세를 든다(클립이 거기서 끝난다).
//
//  검사 (§4.2): 경고가 아니라 예외(AtlasError). 형식·hz·표본 수·채널 길이·NaN·t 단조·표시 순서·phiMarks·phi 지도·단위 벡터·칼 방향 한 표본 각·
//   세 벌 완비·보통/크게의 step·startFrom/recoverTo 자세 id·작은 벌의 손 오차·작은 벌 시작/끝 손 vs guards.js(≤ smallTol)·오른손잡이.
//   pelvis.pitch ≠ 0 과 wristOver160·닿는 거리·pole 뒤집힘·벌 사이 방향 각은 report 에 적는다(도구가 찍는다).
// ─────────────────────────────────────────────────────────────
import { ATLAS, GAIT } from '../config.js';
import { GUARDS, guardAt } from '../guards.js';

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
export const SIZES = ['small', 'medium', 'large'];
export const SIDES = ['right', 'left'];
/** 표시 이름과 φ 값 (clip_format §3-1). 모든 벌·모든 베기가 같다 — 그래서 φ 로 섞을 수 있다 */
export const MARK_NAMES = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
export const PHI_MARKS = [-1, 0, 0.55, 0.85, 1.6, 2.2];
export const SHOULDER_S = [0, 0.1, 0.2]; // 칼 든 어깨 (가슴 틀, fighter.js armIK)
export const SHOULDER_O = [0, 0.1, -0.2];
export const ARM_REACH = 0.565; // 위팔 0.3 + 아래팔 0.265 (fighter.js a + b − 0.005)
export const DROP_BASE = 0.06; // fighter.js:649 follow('drop', (G.drop - 0.06)…)

// 게임 자세표 id (동작 연구 PM 의 cuts.mjs GAME_GUARDS 와 같은 이름) — guards.js GUARDS 의 앞 14개와 같은 차례.
//  자리(pad)는 guards.js 에서 그대로 읽는다: 자세표 차례나 자리가 바뀌면 작은 벌 대조(smallTol)가 걸린다
export const GUARD_IDS = ['tag', 'tagR', 'ochs', 'langort', 'side', 'pflug', 'wechsel', 'neben', 'alber', 'tagL', 'ochsL', 'sideL', 'pflugL', 'wechselL'];
export const GUARD_PADS = Object.fromEntries(GUARD_IDS.map((id, i) => [id, GUARDS[i].pad]));

// 묶음·표본 채널 (모는 것 + edge). chest.xFactor 는 chest.yaw − pelvis.yaw 라 저장하지 않고 표본 끝에 계산해 준다(index CH.xFactor)
//  kind: scalar 값 · yaw 풀어 둔 도 · pos 자리·길이 · dir 단위 방향(접평면 에르미트·slerp; d1·d2 = ω·α)
export const CHANNELS = [
  ['pelvis.yaw', 1, 'yaw'], ['pelvis.pitch', 1, 'scalar'], ['pelvis.drop', 1, 'pos'],
  ['chest.yaw', 1, 'yaw'], ['chest.lean', 1, 'scalar'], ['chest.side', 1, 'scalar'],
  ['handS', 3, 'pos'], ['handO', 3, 'pos'], ['sword', 3, 'dir'], ['edge', 3, 'dir'], ['elbowPoleS', 3, 'dir'], ['elbowPoleO', 3, 'dir'],
  ['girdleS', 2, 'pos'], ['girdleO', 2, 'pos'], ['guardGap', 1, 'pos'], ['openness', 1, 'pos'],
  ['feet.L.yaw', 1, 'yaw'], ['feet.L.lift', 1, 'pos'], ['feet.R.yaw', 1, 'yaw'], ['feet.R.lift', 1, 'pos'],
];
/** 채널 → 표본 배열 시작 칸 */
export const OFF = {};
export const WIDTH = CHANNELS.reduce((o, [name, w]) => ((OFF[name] = o), o + w), 0); // 34
/** 짧은 이름 (drive 가 out.v[CH.handS + k] 로 읽는다). xFactor 는 표본 뒤에 붙는 계산 칸 */
export const CH = {
  pelvisYaw: OFF['pelvis.yaw'], pelvisPitch: OFF['pelvis.pitch'], pelvisDrop: OFF['pelvis.drop'],
  chestYaw: OFF['chest.yaw'], chestLean: OFF['chest.lean'], chestSide: OFF['chest.side'],
  handS: OFF.handS, handO: OFF.handO, sword: OFF.sword, edge: OFF.edge, poleS: OFF.elbowPoleS, poleO: OFF.elbowPoleO,
  girdleS: OFF.girdleS, girdleO: OFF.girdleO, guardGap: OFF.guardGap, openness: OFF.openness,
  footLYaw: OFF['feet.L.yaw'], footLLift: OFF['feet.L.lift'], footRYaw: OFF['feet.R.yaw'], footRLift: OFF['feet.R.lift'],
  xFactor: WIDTH,
};
export const OUT_WIDTH = WIDTH + 1;
export const DIR_OFFS = new Int32Array(CHANNELS.filter((c) => c[2] === 'dir').map((c) => OFF[c[0]]));
export const LIN_IDX = (() => {
  const a = [];
  for (const [name, w, kind] of CHANNELS) if (kind !== 'dir') for (let k = 0; k < w; k++) a.push(OFF[name] + k);
  return new Int32Array(a);
})();

/** 원본 clip/2 에 있어야 하는 채널과 폭 (§4.2). 도구(tools) 길은 J·ang.* 도 본다 */
export const REQUIRED = { t: 1, phi: 1, 'chest.xFactor': 1, ...Object.fromEntries(CHANNELS.map(([n, w]) => [n, w])) };
const TOOLS_REQUIRED = { J: 69, 'ang.pelvisYaw': 1, 'ang.chestYaw': 1, 'ang.lean': 1, 'ang.elbowS': 1, 'ang.wrist': 1 };

/** 검사 실패. id = 클립·묶음·패밀리 이름, reason = 무엇이 어떻게 틀렸나 (값을 함께 적는다) */
export class AtlasError extends Error {
  constructor(id, reason) {
    super(`${id}: ${reason}`);
    this.name = 'AtlasError';
    this.id = id;
    this.reason = reason;
  }
}
const fail = (id, reason) => {
  throw new AtlasError(id, reason);
};

// ── 격자 ──
export function makeGrid(g = { from: -1, to: 2.2, step: ATLAS.phiStep }) {
  const n = Math.round((g.to - g.from) / g.step) + 1;
  const phi = new Float64Array(n);
  for (let i = 0; i < n; i++) phi[i] = Math.round((g.from + i * g.step) * 1e6) / 1e6;
  return { from: g.from, to: g.to, step: g.step, n, phi };
}

// ── 표시 ↔ φ (선형 조각) ──
/** t → φ (clip.mjs phaseAt 과 같은 식) */
export function phiOfT(m, t) {
  if (t <= m[0]) return PHI_MARKS[0];
  for (let i = 0; i < 5; i++) if (t <= m[i + 1]) return PHI_MARKS[i] + ((PHI_MARKS[i + 1] - PHI_MARKS[i]) * (t - m[i])) / (m[i + 1] - m[i]);
  return PHI_MARKS[5];
}
/** φ → t (역함수; 격자 밖은 끝 값) */
export function tOfPhi(m, phi) {
  if (phi <= PHI_MARKS[0]) return m[0];
  for (let i = 0; i < 5; i++) if (phi <= PHI_MARKS[i + 1]) return m[i] + ((m[i + 1] - m[i]) * (phi - PHI_MARKS[i])) / (PHI_MARKS[i + 1] - PHI_MARKS[i]);
  return m[5];
}
/** dT/dφ (조각의 기울기; 표시 밖은 0) */
export function dTdPhi(m, phi) {
  if (phi < PHI_MARKS[0] || phi > PHI_MARKS[5]) return 0;
  for (let i = 0; i < 5; i++) if (phi <= PHI_MARKS[i + 1]) return (m[i + 1] - m[i]) / (PHI_MARKS[i + 1] - PHI_MARKS[i]);
  return 0;
}
const marksArr = (marks) => MARK_NAMES.map((k) => marks[k]);

// ── 작은 벡터 도구 (할당 없음: 배열 + 시작 칸) ──
const dot3 = (a, ao, b, bo) => a[ao] * b[bo] + a[ao + 1] * b[bo + 1] + a[ao + 2] * b[bo + 2];
function normalize3(o, oo) {
  const l = Math.hypot(o[oo], o[oo + 1], o[oo + 2]) || 1;
  o[oo] /= l;
  o[oo + 1] /= l;
  o[oo + 2] /= l;
}
/** 단위 방향 slerp: o[oo..] = slerp(a[ao..], b[bo..], u). u 는 0~1 밖도 된다(큰 원을 따라 이어 간다). 마주보면(180°) 수직축 하나를 골라 돈다 */
function slerp3(a, ao, b, bo, u, o, oo) {
  const ax = a[ao], ay = a[ao + 1], az = a[ao + 2];
  const bx = b[bo], by = b[bo + 1], bz = b[bo + 2];
  let d = ax * bx + ay * by + az * bz;
  if (d > 1) d = 1;
  else if (d < -1) d = -1;
  if (d > 0.9999995) {
    o[oo] = ax + (bx - ax) * u;
    o[oo + 1] = ay + (by - ay) * u;
    o[oo + 2] = az + (bz - az) * u;
    normalize3(o, oo);
    return;
  }
  if (d < -0.9999995) {
    // 마주봄: a 에 수직인 축 p 를 잡아 u·π 만큼
    let px, py, pz;
    if (Math.abs(ay) < 0.9) (px = -az), (py = 0), (pz = ax);
    else (px = 0), (py = az), (pz = -ay);
    const pl = Math.hypot(px, py, pz) || 1;
    const c = Math.cos(u * Math.PI), s = Math.sin(u * Math.PI) / pl;
    o[oo] = ax * c + px * s;
    o[oo + 1] = ay * c + py * s;
    o[oo + 2] = az * c + pz * s;
    return;
  }
  const th = Math.acos(d), sn = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / sn, wb = Math.sin(u * th) / sn;
  o[oo] = ax * wa + bx * wb;
  o[oo + 1] = ay * wa + by * wb;
  o[oo + 2] = az * wa + bz * wb;
}
/** a → b 회전 벡터 (축·각, 라디안) 를 o[oo..] 에. 되돌림: 각 */
function logRot(a, ao, b, bo, o, oo) {
  const cx = a[ao + 1] * b[bo + 2] - a[ao + 2] * b[bo + 1];
  const cy = a[ao + 2] * b[bo] - a[ao] * b[bo + 2];
  const cz = a[ao] * b[bo + 1] - a[ao + 1] * b[bo];
  const s = Math.hypot(cx, cy, cz);
  const c = dot3(a, ao, b, bo);
  const ang = Math.atan2(s, c);
  if (s < 1e-9) {
    if (c > 0) {
      o[oo] = o[oo + 1] = o[oo + 2] = 0;
      return 0;
    }
    // 마주봄: 수직축 하나 × π
    let px, py, pz;
    if (Math.abs(a[ao + 1]) < 0.9) (px = -a[ao + 2]), (py = 0), (pz = a[ao]);
    else (px = 0), (py = a[ao + 2]), (pz = -a[ao + 1]);
    const pl = Math.hypot(px, py, pz) || 1;
    o[oo] = (px / pl) * Math.PI;
    o[oo + 1] = (py / pl) * Math.PI;
    o[oo + 2] = (pz / pl) * Math.PI;
    return Math.PI;
  }
  o[oo] = (cx / s) * ang;
  o[oo + 1] = (cy / s) * ang;
  o[oo + 2] = (cz / s) * ang;
  return ang;
}
/** o[oo..] 를 회전 벡터 r (rx,ry,rz; 각 = |r|) 로 돌린다 (로드리게스) */
function rotateBy(o, oo, rx, ry, rz) {
  const ang = Math.hypot(rx, ry, rz);
  if (ang < 1e-12) return;
  const kx = rx / ang, ky = ry / ang, kz = rz / ang;
  const c = Math.cos(ang), s = Math.sin(ang);
  const vx = o[oo], vy = o[oo + 1], vz = o[oo + 2];
  const kd = kx * vx + ky * vy + kz * vz;
  o[oo] = vx * c + (ky * vz - kz * vy) * s + kx * kd * (1 - c);
  o[oo + 1] = vy * c + (kz * vx - kx * vz) * s + ky * kd * (1 - c);
  o[oo + 2] = vz * c + (kx * vy - ky * vx) * s + kz * kd * (1 - c);
}
/** 같은 회전 벡터 (rx,ry,rz) 로 세 벡터를 제자리에서 돌린다 (로드리게스, 삼각함수 한 번) */
function rotate3(rx, ry, rz, p, po, q, qo, w, wo) {
  const ang = Math.hypot(rx, ry, rz);
  if (ang < 1e-12) return;
  const kx = rx / ang, ky = ry / ang, kz = rz / ang;
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  let vx = p[po], vy = p[po + 1], vz = p[po + 2], kd = kx * vx + ky * vy + kz * vz;
  p[po] = vx * c + (ky * vz - kz * vy) * s + kx * kd * t;
  p[po + 1] = vy * c + (kz * vx - kx * vz) * s + ky * kd * t;
  p[po + 2] = vz * c + (kx * vy - ky * vx) * s + kz * kd * t;
  vx = q[qo];
  vy = q[qo + 1];
  vz = q[qo + 2];
  kd = kx * vx + ky * vy + kz * vz;
  q[qo] = vx * c + (ky * vz - kz * vy) * s + kx * kd * t;
  q[qo + 1] = vy * c + (kz * vx - kx * vz) * s + ky * kd * t;
  q[qo + 2] = vz * c + (kx * vy - ky * vx) * s + kz * kd * t;
  vx = w[wo];
  vy = w[wo + 1];
  vz = w[wo + 2];
  kd = kx * vx + ky * vy + kz * vz;
  w[wo] = vx * c + (ky * vz - kz * vy) * s + kx * kd * t;
  w[wo + 1] = vy * c + (kz * vx - kx * vz) * s + ky * kd * t;
  w[wo + 2] = vz * c + (kx * vy - ky * vx) * s + kz * kd * t;
}
const _rr = new Float64Array(3);
export const angleDeg = (a, ao, b, bo) => Math.acos(Math.max(-1, Math.min(1, dot3(a, ao, b, bo) / (Math.hypot(a[ao], a[ao + 1], a[ao + 2]) * Math.hypot(b[bo], b[bo + 1], b[bo + 2]) || 1)))) * R2D;

// ── 가슴 틀 (body.mjs frame 과 같은 식: ry(−yaw)·rz(−lean)·rx(+side), 행 우선 9칸) ──
export function chestFrame(yawDeg, leanDeg, sideDeg, M = new Float64Array(9)) {
  const a = -yawDeg * D2R, b = -leanDeg * D2R, c = sideDeg * D2R;
  const cy = Math.cos(a), sy = Math.sin(a), cz = Math.cos(b), sz = Math.sin(b), cx = Math.cos(c), sx = Math.sin(c);
  M[0] = cy * cz;
  M[1] = -cy * sz * cx + sy * sx;
  M[2] = cy * sz * sx + sy * cx;
  M[3] = sz;
  M[4] = cz * cx;
  M[5] = -cz * sx;
  M[6] = -sy * cz;
  M[7] = sy * sz * cx + cy * sx;
  M[8] = -sy * sz * sx + cy * cx;
  return M;
}
export function m3apply(M, v, vo, o, oo) {
  const x = v[vo], y = v[vo + 1], z = v[vo + 2];
  o[oo] = M[0] * x + M[1] * y + M[2] * z;
  o[oo + 1] = M[3] * x + M[4] * y + M[5] * z;
  o[oo + 2] = M[6] * x + M[7] * y + M[8] * z;
  return o;
}
export function m3applyT(M, v, vo, o, oo) {
  const x = v[vo], y = v[vo + 1], z = v[vo + 2];
  o[oo] = M[0] * x + M[3] * y + M[6] * z;
  o[oo + 1] = M[1] * x + M[4] * y + M[7] * z;
  o[oo + 2] = M[2] * x + M[5] * y + M[8] * z;
  return o;
}
/** 회전 행렬 → 쿼터니언 [x, y, z, w] (three.js 차례) */
export function quatFromM3(M, q = new Float64Array(4)) {
  const tr = M[0] + M[4] + M[8];
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    q[3] = 0.25 / s;
    q[0] = (M[7] - M[5]) * s;
    q[1] = (M[2] - M[6]) * s;
    q[2] = (M[3] - M[1]) * s;
  } else if (M[0] > M[4] && M[0] > M[8]) {
    const s = 2 * Math.sqrt(1 + M[0] - M[4] - M[8]);
    q[3] = (M[7] - M[5]) / s;
    q[0] = 0.25 * s;
    q[1] = (M[1] + M[3]) / s;
    q[2] = (M[2] + M[6]) / s;
  } else if (M[4] > M[8]) {
    const s = 2 * Math.sqrt(1 + M[4] - M[0] - M[8]);
    q[3] = (M[2] - M[6]) / s;
    q[0] = (M[1] + M[3]) / s;
    q[1] = 0.25 * s;
    q[2] = (M[5] + M[7]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + M[8] - M[0] - M[4]);
    q[3] = (M[3] - M[1]) / s;
    q[0] = (M[2] + M[6]) / s;
    q[1] = (M[5] + M[7]) / s;
    q[2] = 0.25 * s;
  }
  return q;
}
/** 표본 v 의 가슴 틀 (chest.yaw·lean·side) */
export const chestFrameOf = (v, M) => chestFrame(v[CH.chestYaw], v[CH.chestLean], v[CH.chestSide], M);
/** 가슴 틀 3칸(v[vo..]) → 바라보는 틀 o[oo..] (같은 표본의 가슴 틀로) */
export function toFacing(v, vo, o, oo, M = _M) {
  chestFrameOf(v, M);
  return m3apply(M, v, vo, o, oo);
}
const _M = new Float64Array(9);

/** 게임 단위 부호표 (§4.3). 값(v)이면 drop 에서 0.06 을 빼고, 비율(d1·d2)이면 빼지 않는다 */
export const GAME_SIGN = { yaw: -D2R, lean: D2R, side: D2R, drop: 1, footYaw: -D2R, lift: GAIT.heelMax };
export function toGame(v, cmd, rates = false) {
  cmd.pelvisYaw = v[CH.pelvisYaw] * GAME_SIGN.yaw;
  cmd.chestYaw = v[CH.chestYaw] * GAME_SIGN.yaw;
  cmd.pitch = v[CH.chestLean] * GAME_SIGN.lean;
  cmd.side = v[CH.chestSide] * GAME_SIGN.side;
  cmd.drop = v[CH.pelvisDrop] * GAME_SIGN.drop - (rates ? 0 : DROP_BASE);
  cmd.footLYaw = v[CH.footLYaw] * GAME_SIGN.footYaw;
  cmd.footRYaw = v[CH.footRYaw] * GAME_SIGN.footYaw;
  cmd.footLHeel = v[CH.footLLift] * GAME_SIGN.lift;
  cmd.footRHeel = v[CH.footRLift] * GAME_SIGN.lift;
  return cmd;
}

// ── 1차원 보간 도구 ──
/** 풀어 둔 도: 이웃과 180° 넘게 차이 나면 360° 를 더해 잇는다 (제자리에서) */
function unwrapDeg(a) {
  for (let i = 1; i < a.length; i++) {
    let d = a[i] - a[i - 1];
    while (d > 180) (a[i] -= 360), (d -= 360);
    while (d < -180) (a[i] += 360), (d += 360);
  }
  return a;
}
/** PCHIP 기울기 (Fritsch–Carlson, 균일 간격 h) */
function pchipSlopes(y, h) {
  const n = y.length, m = new Float64Array(n);
  if (n < 2) return m;
  if (n === 2) {
    m[0] = m[1] = (y[1] - y[0]) / h;
    return m;
  }
  const d = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = (y[i + 1] - y[i]) / h;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] > 0 ? (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]) : 0;
  const end = (d0, d1) => {
    let s = (3 * d0 - d1) / 2;
    if (s * d0 <= 0) s = 0;
    else if (d0 * d1 <= 0 && Math.abs(s) > 3 * Math.abs(d0)) s = 3 * d0;
    return s;
  };
  m[0] = end(d[0], d[1]);
  m[n - 1] = end(d[n - 2], d[n - 3]);
  return m;
}
const hermite = (y0, y1, m0, m1, h, u) => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * m1;
};
/** 5점 Savitzky–Golay(2차) 가중치: 창 오프셋 k(격자 단위) 에 대해 b(1차)·2c(2차) 를 주는 무게 */
function sgWeights(ks) {
  // 정규 방정식 3×3 역행렬
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  for (const k of ks) (s0 += 1), (s1 += k), (s2 += k * k), (s3 += k * k * k), (s4 += k * k * k * k);
  const A = [s0, s1, s2, s1, s2, s3, s2, s3, s4];
  const det = A[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * A[7] - A[4] * A[6]);
  const inv = [
    (A[4] * A[8] - A[5] * A[7]) / det, (A[2] * A[7] - A[1] * A[8]) / det, (A[1] * A[5] - A[2] * A[4]) / det,
    (A[5] * A[6] - A[3] * A[8]) / det, (A[0] * A[8] - A[2] * A[6]) / det, (A[2] * A[3] - A[0] * A[5]) / det,
    (A[3] * A[7] - A[4] * A[6]) / det, (A[1] * A[6] - A[0] * A[7]) / det, (A[0] * A[4] - A[1] * A[3]) / det,
  ];
  const w1 = ks.map((k) => inv[3] + inv[4] * k + inv[5] * k * k);
  const w2 = ks.map((k) => 2 * (inv[6] + inv[7] * k + inv[8] * k * k));
  return { w1, w2 };
}
const SG_HALF = (ATLAS.sgWindow - 1) >> 1;
/** 창 이동(−half … +half) 별 가중치 — 격자 끝에서는 창을 안쪽으로 민다 */
const SG = (() => {
  const t = {};
  for (let sh = -SG_HALF; sh <= SG_HALF; sh++) {
    const ks = [];
    for (let j = -SG_HALF; j <= SG_HALF; j++) ks.push(j + sh);
    t[sh] = sgWeights(ks);
  }
  return t;
})();
const sgShift = (i, n) => (i < SG_HALF ? SG_HALF - i : i > n - 1 - SG_HALF ? n - 1 - SG_HALF - i : 0);

// ── 원본 → 격자 ──
/** 검사가 끝난 clip/2 한 벌을 φ 격자에 다시 표본한다 → Float32Array [n × WIDTH] (묶음이 저장하는 그것) */
export function resampleClip(clip, grid = makeGrid()) {
  const D = clip.data, C = D.cols, W = D.width, n = D.n;
  const m = marksArr(clip.marks);
  const hz = clip.hz;
  const out = new Float32Array(grid.n * WIDTH);
  // 격자 φ → t → 표본 칸·비율. 표본 시각은 i/hz (t 열은 1e-4 로 반올림된 값이라 검사에만 쓴다 — 시간 축으로 쓰면 5e-5 s × 기울기만큼 어긋난다)
  const cell = new Int32Array(grid.n), frac = new Float64Array(grid.n);
  for (let g = 0; g < grid.n; g++) {
    const x = tOfPhi(m, grid.phi[g]) * hz;
    let i = Math.floor(x + 1e-9);
    if (i > n - 2) i = n - 2;
    if (i < 0) i = 0;
    cell[g] = i;
    frac[g] = Math.min(1, Math.max(0, x - i));
  }
  const col = new Float64Array(n);
  for (const [name, w, kind] of CHANNELS) {
    const src = C[name], o = OFF[name];
    if (kind === 'dir') {
      for (let g = 0; g < grid.n; g++) {
        const i = cell[g];
        slerp3(src, i * 3, src, (i + 1) * 3, frac[g], out, g * WIDTH + o);
        normalize3(out, g * WIDTH + o);
      }
      continue;
    }
    for (let k = 0; k < w; k++) {
      for (let i = 0; i < n; i++) col[i] = src[i * w + k];
      if (kind === 'yaw') unwrapDeg(col);
      const sl = pchipSlopes(col, 1 / hz);
      for (let g = 0; g < grid.n; g++) {
        const i = cell[g];
        out[g * WIDTH + o + k] = hermite(col[i], col[i + 1], sl[i], sl[i + 1], 1 / hz, frac[g]);
      }
    }
  }
  return out;
}

/**
 * 격자 값 → (v, d1, d2, rc) Float64 배열. 방향 채널의 d1·d2 = 각속도·각가속도 벡터(ḋ = ω × d, φ 단위; 마디에서 로그 지도 좌표의 5점 SG).
 *  rc = 방향 채널의 칸 자료 (칸 i, 채널 q 마다 DIRC 칸): r1 = log(d_i → d_{i+1}), 끝 마디의 ω·α 를 R(−r1) 로 시작 마디 접평면에 옮긴 것.
 *  칸 안은 이 접평면에서 5차 에르미트 r(u) → d = R(r)·d_i, ω = R(r)·r′/h, α = R(r)·r″/h² (칸 회전각 ≤ 2° 라 O(θ²) 안에서 ḋ = ω × d)
 */
const DIRC = 9;
function derive(grid, gv) {
  const n = grid.n, h = grid.step;
  const v = new Float64Array(gv), d1 = new Float64Array(n * WIDTH), d2 = new Float64Array(n * WIDTH);
  for (let i = 0; i < n; i++) {
    const sh = sgShift(i, n), { w1, w2 } = SG[sh];
    for (let q = 0; q < LIN_IDX.length; q++) {
      const c = LIN_IDX[q];
      let a = 0, b = 0;
      for (let j = 0; j < w1.length; j++) {
        const y = v[(i + sh + j - SG_HALF) * WIDTH + c];
        a += w1[j] * y;
        b += w2[j] * y;
      }
      d1[i * WIDTH + c] = a / h;
      d2[i * WIDTH + c] = b / (h * h);
    }
    for (let q = 0; q < DIR_OFFS.length; q++) {
      const o = DIR_OFFS[q], base = i * WIDTH + o;
      let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
      for (let j = 0; j < w1.length; j++) {
        const k = i + sh + j - SG_HALF;
        logRot(v, base, v, k * WIDTH + o, _r, 0); // 로그 지도: 자기 자신은 0
        ax += w1[j] * _r[0];
        ay += w1[j] * _r[1];
        az += w1[j] * _r[2];
        bx += w2[j] * _r[0];
        by += w2[j] * _r[1];
        bz += w2[j] * _r[2];
      }
      d1[base] = ax / h;
      d1[base + 1] = ay / h;
      d1[base + 2] = az / h;
      d2[base] = bx / (h * h);
      d2[base + 1] = by / (h * h);
      d2[base + 2] = bz / (h * h);
    }
  }
  const ND = DIR_OFFS.length, rc = new Float64Array(n * ND * DIRC);
  for (let i = 0; i < n - 1; i++)
    for (let q = 0; q < ND; q++) {
      const o = DIR_OFFS[q], a = i * WIDTH + o, b = a + WIDTH, base = (i * ND + q) * DIRC;
      logRot(v, a, v, b, rc, base);
      for (let k = 0; k < 3; k++) {
        rc[base + 3 + k] = d1[b + k];
        rc[base + 6 + k] = d2[b + k];
      }
      rotateBy(rc, base + 3, -rc[base], -rc[base + 1], -rc[base + 2]);
      rotateBy(rc, base + 6, -rc[base], -rc[base + 1], -rc[base + 2]);
    }
  return { v, d1, d2, rc };
}
const _r = new Float64Array(3);

// ── 검사 ──
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
function checkMarks(id, marks, phiMarks) {
  if (!marks) fail(id, 'marks 없음');
  const m = marksArr(marks);
  for (let i = 0; i < 6; i++) if (!isNum(m[i])) fail(id, `marks.${MARK_NAMES[i]} 가 수가 아님 (${m[i]})`);
  for (let i = 0; i < 5; i++) if (!(m[i] < m[i + 1])) fail(id, `marks 차례가 t0 < tw < tr < tc < tf < tg 가 아님: ${MARK_NAMES[i]} ${m[i]} ≥ ${MARK_NAMES[i + 1]} ${m[i + 1]}`);
  if (!phiMarks) fail(id, 'phiMarks 없음');
  for (let i = 0; i < 6; i++) if (phiMarks[MARK_NAMES[i]] !== PHI_MARKS[i]) fail(id, `phiMarks.${MARK_NAMES[i]} = ${phiMarks[MARK_NAMES[i]]} (있어야 할 값 ${PHI_MARKS[i]})`);
  return m;
}
function checkIds(id, clip) {
  if (!GUARD_IDS.includes(clip.startFrom)) fail(id, `startFrom '${clip.startFrom}' 은 게임 자세 id 가 아님 (${GUARD_IDS.join(' ')})`);
  if (!GUARD_IDS.includes(clip.recoverTo)) fail(id, `recoverTo '${clip.recoverTo}' 은 게임 자세 id 가 아님`);
  if (clip.size !== 'small' && !clip.step) fail(id, `${clip.size} 벌에 step 이 없음`);
  if (clip.step) {
    const s = clip.step;
    if (!(s.foot === 'L' || s.foot === 'R') || !Array.isArray(s.from) || !Array.isArray(s.to) || !isNum(s.liftPhi) || !isNum(s.landPhi)) fail(id, `step 이 온전하지 않음: ${JSON.stringify(s)}`);
  }
}

/** index.json 검사 */
export function validateIndex(index) {
  if (!index || typeof index !== 'object') fail('index', 'index.json 을 읽을 수 없음');
  if (index.format !== ATLAS.indexFormat) fail('index', `format '${index.format}' (있어야 할 값 '${ATLAS.indexFormat}')`);
  if (!Array.isArray(index.clips) || !index.clips.length) fail('index', 'clips 가 비어 있음');
  for (const e of index.clips) if (!e.id || !e.file || !e.cut || !e.side || !e.size) fail('index', `항목이 온전하지 않음: ${JSON.stringify(e).slice(0, 120)}`);
  return index;
}

/**
 * clip/2 한 벌 검사 (§4.2). 통과하면 표본 단위 검사값을 돌려준다 (칼 한 표본 최대 각, pole 뒤집힘, 닿는 거리) — 묶음 meta 에 실린다.
 * opts.tools: J·ang.* 도 있어야 한다 (node 도구 길)
 */
export function validateClip(clip, opts = {}) {
  const id = clip?.id ?? '(id 없음)';
  if (!clip || typeof clip !== 'object') fail(id, '클립을 읽을 수 없음');
  if (clip.format !== ATLAS.format) fail(id, `format '${clip.format}' (있어야 할 값 '${ATLAS.format}'; clip/1 은 girdle·elbowPoleO·step·recoverTo 가 없어 거절)`);
  if (!SIZES.includes(clip.size)) fail(id, `size '${clip.size}'`);
  if (!SIDES.includes(clip.side)) fail(id, `side '${clip.side}'`);
  if (typeof clip.cut !== 'string' || !clip.cut) fail(id, 'cut 없음');
  if (clip.hz !== ATLAS.hz) fail(id, `hz ${clip.hz} (있어야 할 값 ${ATLAS.hz})`);
  if (clip.handedness !== 'right') fail(id, `handedness '${clip.handedness}' (v0 는 오른손잡이만)`);
  const m = checkMarks(id, clip.marks, clip.phiMarks);
  const D = clip.data;
  if (!D || !D.cols || !D.width) fail(id, 'data.cols / data.width 없음');
  const n = D.n, hz = clip.hz;
  const nExp = Math.round(m[5] * hz) + 1;
  if (n !== nExp) fail(id, `data.n ${n} ≠ round(tg·hz) + 1 = ${nExp}`);
  const req = opts.tools ? { ...REQUIRED, ...TOOLS_REQUIRED } : REQUIRED;
  for (const ch in req) {
    const col = D.cols[ch];
    if (!col) fail(id, `채널 '${ch}' 없음`);
    if (D.width[ch] !== req[ch]) fail(id, `채널 '${ch}' 폭 ${D.width[ch]} (있어야 할 값 ${req[ch]})`);
    if (col.length !== n * req[ch]) fail(id, `채널 '${ch}' 길이 ${col.length} ≠ n·폭 = ${n * req[ch]}`);
  }
  for (const ch in D.cols) {
    const col = D.cols[ch];
    for (let i = 0; i < col.length; i++) if (!isNum(col[i])) fail(id, `채널 '${ch}' [${i}] 가 수가 아님 (${col[i]})`);
  }
  const t = D.cols.t;
  for (let i = 1; i < n; i++) if (!(t[i] > t[i - 1])) fail(id, `t 가 단조 증가가 아님: t[${i - 1}] ${t[i - 1]} → t[${i}] ${t[i]}`);
  for (let i = 0; i < n; i++) if (Math.abs(t[i] - i / hz) > 1e-3) fail(id, `t[${i}] ${t[i]} 가 ${hz} Hz 격자 ${(i / hz).toFixed(4)} 에서 1e-3 넘게 벗어남`);
  if (Math.abs(t[0] - m[0]) > 1e-6 || Math.abs(t[n - 1] - m[5]) > 1e-3) fail(id, `t 가 t0 ${m[0]} … tg ${m[5]} 를 덮지 않음 (${t[0]} … ${t[n - 1]})`);
  const phi = D.cols.phi;
  for (let i = 0; i < n; i++) {
    const p = phiOfT(m, t[i]);
    if (Math.abs(phi[i] - p) > 1e-3) fail(id, `phi[${i}] ${phi[i]} 가 표시 선형 지도 ${p.toFixed(4)} 에서 1e-3 넘게 벗어남`);
  }
  checkIds(id, clip);
  // 단위 방향: 길이. 칼은 한 표본 각도 (저작 오류), 팔꿈치 pole·edge 는 뒤집힘이 정상 → 보고
  const checks = { swordStepMax: 0, poleStepMax: 0, poleFlips: [], reach: null };
  for (const ch of ['sword', 'elbowPoleS', 'elbowPoleO']) {
    const col = D.cols[ch];
    for (let i = 0; i < n; i++) {
      const l = Math.hypot(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
      if (Math.abs(l - 1) > 0.02) fail(id, `${ch}[${i}] 길이 ${l.toFixed(3)} (단위 벡터 ±0.02)`);
      if (i === 0) continue;
      const a = angleDeg(col, (i - 1) * 3, col, i * 3);
      if (ch === 'sword') {
        if (a > ATLAS.vecStepMaxDeg) fail(id, `sword 가 한 표본(t ${t[i - 1]} → ${t[i]}) 에 ${a.toFixed(1)}° 돎 (vecStepMaxDeg ${ATLAS.vecStepMaxDeg})`);
        if (a > checks.swordStepMax) checks.swordStepMax = a;
      } else {
        if (a > checks.poleStepMax) checks.poleStepMax = a;
        if (a > ATLAS.poleFlipDeg) checks.poleFlips.push({ ch, t: t[i], deg: +a.toFixed(1) });
      }
    }
  }
  if (clip.size === 'small') {
    const se = clip.startPose?.handError, ee = clip.endPose?.handError;
    if (!isNum(se) || se > ATLAS.smallTol) fail(id, `작은 벌 startPose.handError ${se} > smallTol ${ATLAS.smallTol}`);
    if (!isNum(ee) || ee > ATLAS.smallTol) fail(id, `작은 벌 endPose.handError ${ee} > smallTol ${ATLAS.smallTol}`);
  }
  // 닿는 거리 (고정 어깨에서, §4.6): 가슴 틀 손 − 어깨, 가장 먼 표본
  checks.reach = reachOf(D.cols.handS, D.cols.handO, n, (i) => t[i]);
  return checks;
}
function reachOf(hS, hO, n, tAt) {
  const r = { hand: { over: -Infinity, t: 0 }, off: { over: -Infinity, t: 0 } };
  for (let i = 0; i < n; i++) {
    const a = Math.hypot(hS[i * 3] - SHOULDER_S[0], hS[i * 3 + 1] - SHOULDER_S[1], hS[i * 3 + 2] - SHOULDER_S[2]) - ARM_REACH;
    const b = Math.hypot(hO[i * 3] - SHOULDER_O[0], hO[i * 3 + 1] - SHOULDER_O[1], hO[i * 3 + 2] - SHOULDER_O[2]) - ARM_REACH;
    if (a > r.hand.over) r.hand = { over: a, t: tAt(i) };
    if (b > r.off.over) r.off = { over: b, t: tAt(i) };
  }
  r.hand.over = +r.hand.over.toFixed(4);
  r.off.over = +r.off.over.toFixed(4);
  return r;
}

/** 묶음(stillness-atlas-pack/1) 검사. 통과하면 격자와 클립 목록(meta + 풀어 낸 Float32 격자)을 돌려준다 */
export function validatePack(pack) {
  if (!pack || typeof pack !== 'object') fail('pack', '묶음을 읽을 수 없음');
  if (pack.format !== ATLAS.packFormat) fail('pack', `format '${pack.format}' (있어야 할 값 '${ATLAS.packFormat}')`);
  if (pack.sourceFormat !== ATLAS.format) fail('pack', `sourceFormat '${pack.sourceFormat}' (있어야 할 값 '${ATLAS.format}')`);
  if (pack.indexFormat !== ATLAS.indexFormat) fail('pack', `indexFormat '${pack.indexFormat}' (있어야 할 값 '${ATLAS.indexFormat}')`);
  const g = pack.phiGrid;
  if (!g || !isNum(g.from) || !isNum(g.to) || !isNum(g.step) || g.step <= 0) fail('pack', `phiGrid 가 온전하지 않음: ${JSON.stringify(g)}`);
  if (g.from !== PHI_MARKS[0] || g.to !== PHI_MARKS[5]) fail('pack', `phiGrid ${g.from} … ${g.to} (있어야 할 값 ${PHI_MARKS[0]} … ${PHI_MARKS[5]})`);
  const grid = makeGrid(g);
  if (!Array.isArray(pack.channels) || pack.channels.length !== CHANNELS.length) fail('pack', `channels ${pack.channels?.length} 개 (있어야 할 값 ${CHANNELS.length})`);
  for (let i = 0; i < CHANNELS.length; i++) {
    const c = pack.channels[i];
    if (!c || c.name !== CHANNELS[i][0] || c.width !== CHANNELS[i][1]) fail('pack', `channels[${i}] ${JSON.stringify(c)} ≠ ${CHANNELS[i][0]}×${CHANNELS[i][1]}`);
  }
  if (pack.width !== WIDTH) fail('pack', `width ${pack.width} ≠ ${WIDTH}`);
  if (!Array.isArray(pack.clips) || !pack.clips.length) fail('pack', 'clips 가 비어 있음');
  const recs = [];
  for (const c of pack.clips) {
    const id = c.id ?? '(id 없음)';
    if (!SIZES.includes(c.size) || !SIDES.includes(c.side) || !c.cut) fail(id, `cut/side/size 가 온전하지 않음 (${c.cut} ${c.side} ${c.size})`);
    if (typeof c.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(c.sha1)) fail(id, `sha1 '${c.sha1}'`);
    checkMarks(id, c.marks, c.phiMarks);
    checkIds(id, c);
    if (typeof c.data !== 'string' || !c.data.length) fail(id, 'data(base64) 없음');
    const f = decodeF32(c.data);
    if (f.length !== grid.n * WIDTH) fail(id, `data 길이 ${f.length} ≠ 격자 ${grid.n} × 폭 ${WIDTH} = ${grid.n * WIDTH}`);
    for (let i = 0; i < f.length; i++) if (!Number.isFinite(f[i])) fail(id, `data[${i}] 가 수가 아님 (칸 ${Math.floor(i / WIDTH)}, 채널 칸 ${i % WIDTH})`);
    for (let q = 0; q < DIR_OFFS.length; q++)
      for (let i = 0; i < grid.n; i++) {
        const o = i * WIDTH + DIR_OFFS[q];
        const l = Math.hypot(f[o], f[o + 1], f[o + 2]);
        if (Math.abs(l - 1) > 0.02) fail(id, `${CHANNELS.find((ch) => OFF[ch[0]] === DIR_OFFS[q])[0]} 격자 ${i} 길이 ${l.toFixed(3)}`);
      }
    const { data, ...meta } = c;
    recs.push({ meta, grid: f });
  }
  return { grid, recs };
}

// ── base64 ↔ Float32 (리틀 엔디언) ──
const LE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
export function decodeF32(b64) {
  let bytes;
  if (typeof Buffer !== 'undefined') bytes = Buffer.from(b64, 'base64');
  else {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  if (bytes.length % 4) fail('pack', `base64 바이트 ${bytes.length} 가 4 의 배수가 아님`);
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  if (LE) return new Float32Array(buf);
  const dv = new DataView(buf), out = new Float32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = dv.getFloat32(i * 4, true);
  return out;
}
export function encodeF32(f32) {
  let bytes;
  if (LE) bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  else {
    bytes = new Uint8Array(f32.length * 4);
    const dv = new DataView(bytes.buffer);
    for (let i = 0; i < f32.length; i++) dv.setFloat32(i * 4, f32[i], true);
  }
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** 원본 클립 → 묶음 meta (data 빼고 싣는 것) */
export function metaOf(clip, sha1, checks) {
  return {
    id: clip.id, cut: clip.cut, side: clip.side, size: clip.size, sha1,
    nameKo: clip.nameKo, nameDe: clip.nameDe, provenance: clip.provenance,
    sources: (clip.sources || []).map((s) => ({ id: s.id, kind: s.kind, license: s.license })),
    marks: { ...clip.marks }, phiMarks: { ...clip.phiMarks }, step: clip.step ?? null,
    startFrom: clip.startFrom, startPose: clip.startPose, recoverTo: clip.recoverTo, endPose: clip.endPose, recovery: clip.recovery,
    summary: { time: clip.summary?.time, checks: { ...(clip.summary?.checks || {}), ...(checks || {}) } },
  };
}

// ── 아틀라스 ──
const sizeIdx = { small: 0, medium: 1, large: 2 };
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
const sjD = (u) => (u <= 0 || u >= 1 ? 0 : 30 * u * u * (1 - u) * (1 - u));
const sjDD = (u) => (u <= 0 || u >= 1 ? 0 : 60 * u * (1 - u) * (1 - 2 * u));

/** 표본 그릇 (미리 만들어 두고 매 스텝 다시 쓴다). v·d1·d2: OUT_WIDTH 칸 (마지막 칸 xFactor) */
export function makeSample() {
  return { v: new Float64Array(OUT_WIDTH), d1: new Float64Array(OUT_WIDTH), d2: new Float64Array(OUT_WIDTH), phi: 0, S: 0, over: 0, t: 0, dt: 0, cut: '', side: '' };
}

export class Atlas {
  /** recs: [{ meta, grid(Float32Array n×WIDTH) }], opts: { families, grid, source } */
  constructor(recs, opts = {}) {
    const grid = (this.grid = opts.grid ?? makeGrid());
    this.source = opts.source ?? 'pack';
    this.fams = {};
    this.index = new Map();
    this.meta = {};
    this.clips = [];
    this.report = { warn: [], wristOver160: [], reach: [], poleFlips: [], crossSize: [], smallVsGuards: [], swordStepMax: 0, families: [] };
    const want = opts.families ?? [...new Set(recs.map((r) => r.meta.cut))];
    for (const r of recs) {
      const m = r.meta;
      if (!want.includes(m.cut)) continue;
      if (r.grid.length !== grid.n * WIDTH) fail(m.id, `격자 길이 ${r.grid.length} ≠ ${grid.n * WIDTH}`);
      const { v, d1, d2, rc } = derive(grid, r.grid);
      const rec = { id: m.id, cut: m.cut, side: m.side, size: m.size, meta: m, grid: r.grid, v, d1, d2, rc, marks: marksArr(m.marks), raw: r.raw };
      if (this.index.has(m.id)) fail(m.id, '같은 id 가 두 번');
      this.index.set(m.id, rec);
      this.meta[m.id] = m;
      this.clips.push(rec);
      ((this.fams[m.cut] ||= {})[m.side] ||= { cut: m.cut, side: m.side }) [m.size] = rec;
    }
    // 세 벌 완비 (베기 × 쪽)
    for (const cut of want) {
      const f = this.fams[cut];
      if (!f) fail(cut, `클립이 하나도 없음 (families ${want.join(',')})`);
      for (const side of SIDES) {
        const fs = f[side];
        for (const size of SIZES) if (!fs || !fs[size]) fail(`${cut}_${side}`, `${size} 벌이 없음 — 세 벌이 모두 있어야 한다`);
        for (const size of SIZES) {
          const rec = fs[size];
          if (rec.meta.startFrom !== fs.small.meta.startFrom) this.report.warn.push(`${rec.id}: startFrom ${rec.meta.startFrom} ≠ small ${fs.small.meta.startFrom}`);
        }
      }
    }
    this.families = want.slice();
    this.report.families = want.map((cut) => `${cut} (${SIDES.map((s) => SIZES.map((z) => this.fams[cut][s][z].id).join(' ')).join(' | ')})`);
    this._tmp = [makeSample(), makeSample(), makeSample(), makeSample(), makeSample()];
    this._M = new Float64Array(9);
    this._buildReport();
  }

  has(cut, side) {
    return !!this.fams[cut]?.[side];
  }
  fam(cut, side) {
    const f = this.fams[cut]?.[side];
    if (!f) fail(`${cut}_${side}`, '아틀라스에 없는 베기·쪽');
    return f;
  }

  // ── 검사·보고 (읽을 때 한 번) ──
  _buildReport() {
    const R = this.report, g = this.grid, tmp = new Float64Array(3), gh = { hand: [0, 0, 0], dir: [0, 0, 0] };
    for (const rec of this.clips) {
      const m = rec.meta, ck = m.summary?.checks || {};
      if (ck.wristOver160 > 0) R.wristOver160.push({ id: rec.id, s: ck.wristOver160, wristMax: ck.wristMax });
      if (ck.reach) R.reach.push({ id: rec.id, hand: ck.reach.hand, off: ck.reach.off });
      else {
        // 묶음에 표본 단위 값이 없으면 격자에서 (같은 값에 가깝다)
        const hS = new Float64Array(g.n * 3), hO = new Float64Array(g.n * 3);
        for (let i = 0; i < g.n; i++) for (let k = 0; k < 3; k++) (hS[i * 3 + k] = rec.v[i * WIDTH + CH.handS + k]), (hO[i * 3 + k] = rec.v[i * WIDTH + CH.handO + k]);
        const r = reachOf(hS, hO, g.n, (i) => tOfPhi(rec.marks, g.phi[i]));
        R.reach.push({ id: rec.id, hand: r.hand, off: r.off });
      }
      for (const f of ck.poleFlips || []) R.poleFlips.push({ id: rec.id, ...f });
      if (ck.swordStepMax > R.swordStepMax) R.swordStepMax = ck.swordStepMax;
      // pelvis.pitch 는 v0 에서 0 (아니면 경고만)
      let pp = 0;
      for (let i = 0; i < g.n; i++) pp = Math.max(pp, Math.abs(rec.v[i * WIDTH + CH.pelvisPitch]));
      if (pp >= 1e-6) R.warn.push(`${rec.id}: pelvis.pitch 최대 ${pp.toFixed(3)}° (v0 는 0 이어야; 몰지 않는다)`);
    }
    // 작은 벌 시작·끝 손 vs guards.js (바라보는 틀, 자세 자리에서 guardAt) — 넘으면 예외
    for (const cut of this.families)
      for (const side of SIDES) {
        const s = this.fams[cut][side].small, m = s.meta;
        const d0 = this._guardDist(s, 0, m.startFrom, gh, tmp), d1 = this._guardDist(s, g.n - 1, m.recoverTo, gh, tmp);
        R.smallVsGuards.push({ id: s.id, startFrom: m.startFrom, start: +d0.toFixed(4), recoverTo: m.recoverTo, end: +d1.toFixed(4) });
        if (d0 > ATLAS.smallTol) fail(s.id, `시작 손(바라보는 틀)이 guards.js '${m.startFrom}' 자리의 손과 ${(d0 * 100).toFixed(1)} cm 어긋남 (smallTol ${ATLAS.smallTol} m)`);
        if (d1 > ATLAS.smallTol) fail(s.id, `끝 손(바라보는 틀)이 guards.js '${m.recoverTo}' 자리의 손과 ${(d1 * 100).toFixed(1)} cm 어긋남 (smallTol ${ATLAS.smallTol} m)`);
        // 같은 φ 에서 벌 사이 방향 각 (최대)
        for (const ch of ['sword', 'elbowPoleS', 'elbowPoleO'])
          for (const [a, b] of [['small', 'medium'], ['medium', 'large']]) {
            const A = this.fams[cut][side][a], B = this.fams[cut][side][b];
            let mx = 0, at = 0;
            for (let i = 0; i < g.n; i++) {
              const d = angleDeg(A.v, i * WIDTH + OFF[ch], B.v, i * WIDTH + OFF[ch]);
              if (d > mx) (mx = d), (at = g.phi[i]);
            }
            R.crossSize.push({ cut, side, ch, pair: `${a}↔${b}`, deg: +mx.toFixed(1), phi: at });
          }
      }
  }
  _guardDist(rec, gi, guardId, gh, tmp) {
    const pad = GUARD_PADS[guardId];
    guardAt(pad[0], pad[1], gh);
    const M = chestFrame(rec.v[gi * WIDTH + CH.chestYaw], rec.v[gi * WIDTH + CH.chestLean], rec.v[gi * WIDTH + CH.chestSide], this._M);
    m3apply(M, rec.v, gi * WIDTH + CH.handS, tmp, 0);
    return Math.hypot(tmp[0] - gh.hand[0], tmp[1] - gh.hand[1], tmp[2] - gh.hand[2]);
  }
  /** 보고를 사람이 읽는 줄로 */
  reportLines() {
    const R = this.report, L = [];
    L.push(`[atlas] source ${this.source} · 격자 ${this.grid.from}…${this.grid.to} step ${this.grid.step} (${this.grid.n} 점) · 폭 ${WIDTH} · 클립 ${this.clips.length}`);
    for (const f of R.families) L.push(`  family ${f}`);
    L.push(`  작은 벌 vs guards.js (m): ${R.smallVsGuards.map((s) => `${s.id} ${s.startFrom} ${s.start} / ${s.recoverTo} ${s.end}`).join(' · ')}`);
    L.push(`  닿는 거리 (고정 어깨 0.565 m 대비, 가장 먼 표본, cm): ` + R.reach.map((r) => `${r.id} 손 ${(r.hand.over * 100).toFixed(1)}@${r.hand.t}s 빈손 ${(r.off.over * 100).toFixed(1)}@${r.off.t}s`).join(' · '));
    L.push(`  wristOver160: ${R.wristOver160.length ? R.wristOver160.map((w) => `${w.id} ${w.s}s (max ${w.wristMax}°)`).join(' · ') : '없음'}`);
    L.push(`  칼 한 표본 최대 각 ${R.swordStepMax.toFixed(1)}° (vecStepMaxDeg ${ATLAS.vecStepMaxDeg})`);
    L.push(`  팔꿈치 pole 뒤집힘 (> ${ATLAS.poleFlipDeg}°/표본) ${R.poleFlips.length}곳: ${R.poleFlips.map((p) => `${p.id} ${p.ch} ${p.t}s ${p.deg}°`).join(' · ') || '없음'}`);
    const cs = R.crossSize.filter((c) => c.ch === 'sword');
    L.push(`  같은 φ 벌 사이 칼 방향 각 최대: ${cs.map((c) => `${c.cut}_${c.side} ${c.pair} ${c.deg}°@φ${c.phi}`).join(' · ')}`);
    const cp = R.crossSize.filter((c) => c.ch !== 'sword').sort((a, b) => b.deg - a.deg).slice(0, 6);
    L.push(`  같은 φ 벌 사이 pole 각 최대(상위 6): ${cp.map((c) => `${c.cut}_${c.side} ${c.ch} ${c.pair} ${c.deg}°@φ${c.phi}`).join(' · ')}`);
    for (const w of R.warn) L.push(`  경고: ${w}`);
    return L;
  }

  // ── 표본 ──
  /** 한 벌·한 크기를 φ 에서 (섞기 없음). out.v/d1/d2 를 채운다 */
  sampleSize(out, cut, side, size, phi) {
    this._eval(this.fam(cut, side)[size], phi, out);
    for (let q = 0; q < DIR_OFFS.length; q++) normalize3(out.v, DIR_OFFS[q]);
    out.v[CH.xFactor] = out.v[CH.chestYaw] - out.v[CH.pelvisYaw];
    out.d1[CH.xFactor] = out.d1[CH.chestYaw] - out.d1[CH.pelvisYaw];
    out.d2[CH.xFactor] = out.d2[CH.chestYaw] - out.d2[CH.pelvisYaw];
    out.phi = phi;
    out.cut = cut;
    out.side = side;
    return out;
  }
  /**
   * 표본 (§4.4). req = { cut, side, phi, S, over?, cutB?, wAB? }
   *  S ≤ sizeMid: 작게↔보통, 그 위: 보통↔크게. S > 1 인 몫은 over 에 더해 크게 너머로 직선으로 잇는다(이득 1, 상한 없음).
   *  cutB·wAB: 두 번째 베기와 섞는 비율(같은 φ·S). 값·d1·d2 를 모두 채운다 (d = dφ 기준: ẋ = d1·φ̇, ẍ = d2·φ̇² + d1·φ̈)
   */
  sample(out, req) {
    const S0 = req.S, phi = req.phi;
    let over = req.over || 0, S = S0;
    if (S > 1) (over += S - 1), (S = 1);
    else if (!(S >= 0)) S = 0;
    this._famSample(this.fam(req.cut, req.side), phi, S, over, out, this._tmp[0], this._tmp[1], this._tmp[2], this._tmp[3]);
    const w = req.wAB;
    if (req.cutB && w > 0 && req.cutB !== req.cut) {
      const o2 = this._tmp[4];
      this._famSample(this.fam(req.cutB, req.side), phi, S, over, o2, this._tmp[0], this._tmp[1], this._tmp[2], this._tmp[3]);
      blendInto(out, o2, w, out);
    }
    for (let q = 0; q < DIR_OFFS.length; q++) normalize3(out.v, DIR_OFFS[q]); // slerp 는 Float32 격자 오차(≈1e-7)를 남긴다
    out.v[CH.xFactor] = out.v[CH.chestYaw] - out.v[CH.pelvisYaw];
    out.d1[CH.xFactor] = out.d1[CH.chestYaw] - out.d1[CH.pelvisYaw];
    out.d2[CH.xFactor] = out.d2[CH.chestYaw] - out.d2[CH.pelvisYaw];
    out.phi = phi;
    out.S = S0;
    out.over = over;
    out.cut = req.cut;
    out.side = req.side;
    // 시각: 표시를 S 로 섞어 T(φ)·dT/dφ
    this.marks(req.cut, req.side, S, _mk);
    out.t = tOfPhi(_mk, phi);
    out.dt = dTdPhi(_mk, phi);
    return out;
  }
  /** 위치 인자 꼴 */
  sampleAt(cut, side, phi, S, out, over = 0) {
    _req.cut = cut;
    _req.side = side;
    _req.phi = phi;
    _req.S = S;
    _req.over = over;
    _req.cutB = null;
    _req.wAB = 0;
    return this.sample(out, _req);
  }
  _famSample(f, phi, S, over, out, tA, tB, tM, tL) {
    const mid = ATLAS.sizeMid;
    let A, B, u;
    if (S <= mid) (A = f.small), (B = f.medium), (u = S / mid);
    else (A = f.medium), (B = f.large), (u = (S - mid) / (1 - mid));
    this._eval(A, phi, tA);
    this._eval(B, phi, tB);
    blendInto(tA, tB, u, out);
    if (over > 0) {
      let M = tA, L = tB;
      if (A !== f.medium) {
        this._eval(f.medium, phi, tM);
        this._eval(f.large, phi, tL);
        M = tM;
        L = tL;
      }
      addOver(out, M, L, over);
    }
  }
  /** 격자 칸 안 5차 에르미트 (값·d1·d2 로 C²). 방향: 시작 마디 접평면의 5차 에르미트 → 회전 (derive 참고). 격자 밖은 끝 자세, 도함수 0 */
  _eval(rec, phi, out) {
    const g = this.grid, h = g.step;
    let x = (phi - g.from) / h, outside = false;
    if (!(x > 0)) (x = 0), (outside = phi < g.from);
    else if (x > g.n - 1) (x = g.n - 1), (outside = true);
    let i = Math.floor(x);
    if (i > g.n - 2) i = g.n - 2;
    const u = x - i;
    const u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
    const h0 = 1 - 10 * u3 + 15 * u4 - 6 * u5, h1 = u - 6 * u3 + 8 * u4 - 3 * u5, h2 = 0.5 * (u2 - 3 * u3 + 3 * u4 - u5);
    const h3 = 10 * u3 - 15 * u4 + 6 * u5, h4 = -4 * u3 + 7 * u4 - 3 * u5, h5 = 0.5 * (u3 - 2 * u4 + u5);
    const g0 = -30 * u2 + 60 * u3 - 30 * u4, g1 = 1 - 18 * u2 + 32 * u3 - 15 * u4, g2 = 0.5 * (2 * u - 9 * u2 + 12 * u3 - 5 * u4);
    const g3 = 30 * u2 - 60 * u3 + 30 * u4, g4 = -12 * u2 + 28 * u3 - 15 * u4, g5 = 0.5 * (3 * u2 - 8 * u3 + 5 * u4);
    const k0 = -60 * u + 180 * u2 - 120 * u3, k1 = -36 * u + 96 * u2 - 60 * u3, k2 = 0.5 * (2 - 18 * u + 36 * u2 - 20 * u3);
    const k3 = 60 * u - 180 * u2 + 120 * u3, k4 = -24 * u + 84 * u2 - 60 * u3, k5 = 0.5 * (6 * u - 24 * u2 + 20 * u3);
    const V = rec.v, D1 = rec.d1, D2 = rec.d2, a = i * WIDTH, b = a + WIDTH, hh = h * h;
    const ov = out.v, od1 = out.d1, od2 = out.d2;
    for (let q = 0; q < LIN_IDX.length; q++) {
      const c = LIN_IDX[q];
      const p0 = V[a + c], p1 = V[b + c], m0 = D1[a + c] * h, m1 = D1[b + c] * h, a0 = D2[a + c] * hh, a1 = D2[b + c] * hh;
      ov[c] = p0 * h0 + m0 * h1 + a0 * h2 + p1 * h3 + m1 * h4 + a1 * h5;
      od1[c] = (p0 * g0 + m0 * g1 + a0 * g2 + p1 * g3 + m1 * g4 + a1 * g5) / h;
      od2[c] = (p0 * k0 + m0 * k1 + a0 * k2 + p1 * k3 + m1 * k4 + a1 * k5) / hh;
    }
    const RC = rec.rc, ND = DIR_OFFS.length;
    for (let q = 0; q < ND; q++) {
      const o = DIR_OFFS[q], base = (i * ND + q) * DIRC;
      for (let k = 0; k < 3; k++) {
        const m0 = D1[a + o + k] * h, a0 = D2[a + o + k] * hh, p1 = RC[base + k], m1 = RC[base + 3 + k] * h, a1 = RC[base + 6 + k] * hh;
        _rr[k] = m0 * h1 + a0 * h2 + p1 * h3 + m1 * h4 + a1 * h5;
        od1[o + k] = (m0 * g1 + a0 * g2 + p1 * g3 + m1 * g4 + a1 * g5) / h;
        od2[o + k] = (m0 * k1 + a0 * k2 + p1 * k3 + m1 * k4 + a1 * k5) / hh;
        ov[o + k] = V[a + o + k];
      }
      rotate3(_rr[0], _rr[1], _rr[2], ov, o, od1, o, od2, o);
    }
    if (outside) {
      od1.fill(0);
      od2.fill(0);
    }
  }

  // ── 벌 사이 값 (표시·시간·걸음·자세 id) ──
  /** 표시 여섯 [t0 … tg] 를 S 로 섞는다 (두 구간). S > 1 은 크게 너머로 직선 */
  marks(cut, side, S, out = new Float64Array(6)) {
    const f = this.fam(cut, side), mid = ATLAS.sizeMid;
    let A, B, u;
    if (S <= mid) (A = f.small.marks), (B = f.medium.marks), (u = Math.max(0, S) / mid);
    else (A = f.medium.marks), (B = f.large.marks), (u = (S - mid) / (1 - mid));
    for (let i = 0; i < 6; i++) out[i] = A[i] + (B[i] - A[i]) * u;
    return out;
  }
  tAt(cut, side, phi, S) {
    return tOfPhi(this.marks(cut, side, S, _mk), phi);
  }
  phiAt(cut, side, t, S) {
    return phiOfT(this.marks(cut, side, S, _mk), t);
  }
  /** summary.time 을 S 로 섞는다 (할당함 — 스텝마다 부르지 않는다) */
  timing(cut, side, S) {
    const f = this.fam(cut, side);
    const pick = (rec) => rec.meta.summary?.time || {};
    const [A, B, u] = this._pair(f, S);
    const out = {};
    for (const k of Object.keys(pick(A))) out[k] = pick(A)[k] + (pick(B)[k] - pick(A)[k]) * u;
    return out;
  }
  /**
   * 걸음 자료를 S 로 섞는다 (§1 row 3, §5.6): fwd = to[0] − from[0], side = to[1] − from[1]; 작게 = { 0, 0, liftPhi·landPhi 는 보통 것 }.
   *  swingT = 그 벌의 발 뜸 → 딛음 시간(작게는 작은 표시로 같은 φ 구간을 시간으로), phiDotClip = (landPhi − liftPhi) / swingT
   */
  step(cut, side, S) {
    const f = this.fam(cut, side);
    const of = (rec) => {
      const s = rec.meta.step;
      if (!s) {
        const ms = f.medium.meta.step, m = rec.marks;
        const liftT = tOfPhi(m, ms.liftPhi), landT = tOfPhi(m, ms.landPhi);
        return { foot: ms.foot, fwd: 0, side: 0, liftPhi: ms.liftPhi, landPhi: ms.landPhi, liftT, landT, swingT: landT - liftT };
      }
      const liftT = s.liftT ?? tOfPhi(rec.marks, s.liftPhi), landT = s.landT ?? tOfPhi(rec.marks, s.landPhi);
      return { foot: s.foot, fwd: s.to[0] - s.from[0], side: s.to[1] - s.from[1], liftPhi: s.liftPhi, landPhi: s.landPhi, liftT, landT, swingT: landT - liftT };
    };
    const [A, B, u] = this._pair(f, S);
    const a = of(A), b = of(B), out = { foot: b.foot };
    for (const k of ['fwd', 'side', 'liftPhi', 'landPhi', 'liftT', 'landT', 'swingT']) out[k] = a[k] + (b[k] - a[k]) * u;
    out.phiDotClip = (out.landPhi - out.liftPhi) / out.swingT;
    return out;
  }
  _pair(f, S) {
    const mid = ATLAS.sizeMid;
    return S <= mid ? [f.small, f.medium, Math.max(0, S) / mid] : [f.medium, f.large, (S - mid) / (1 - mid)];
  }
  /** 복귀 자세 id — 크기에 따라 다를 수 있다(unterhau: small pflugL, medium/large ochsL). S 에 가장 가까운 벌의 값 */
  recoverTo(cut, side, S = 1) {
    return this._nearest(cut, side, S).meta.recoverTo;
  }
  startFrom(cut, side, S = 1) {
    return this._nearest(cut, side, S).meta.startFrom;
  }
  /** 끝 자세에 가까운 게임 자세 [{ id, err }] (endPose.next) */
  nearGuards(cut, side, S = 1) {
    return this._nearest(cut, side, S).meta.endPose?.next ?? [];
  }
  _nearest(cut, side, S) {
    const f = this.fam(cut, side), mid = ATLAS.sizeMid;
    return S <= mid * 0.5 ? f.small : S <= mid + (1 - mid) * 0.5 ? f.medium : f.large;
  }
}
const _mk = new Float64Array(6);
const _req = { cut: '', side: 'right', phi: 0, S: 0, over: 0, cutB: null, wAB: 0 };

/** o = a + (b − a)·u : 값·자리·각은 선형, 방향은 slerp, ω·α 선형 (o 가 a 나 b 여도 된다) */
export function blendInto(a, b, u, o) {
  const av = a.v, bv = b.v, ov = o.v, ad1 = a.d1, bd1 = b.d1, od1 = o.d1, ad2 = a.d2, bd2 = b.d2, od2 = o.d2;
  for (let q = 0; q < LIN_IDX.length; q++) {
    const c = LIN_IDX[q];
    ov[c] = av[c] + (bv[c] - av[c]) * u;
    od1[c] = ad1[c] + (bd1[c] - ad1[c]) * u;
    od2[c] = ad2[c] + (bd2[c] - ad2[c]) * u;
  }
  for (let q = 0; q < DIR_OFFS.length; q++) {
    const c = DIR_OFFS[q];
    // slerp 의 정확한 도함수: s = R(n, uθ)·a, n = a×b/|a×b| → Ω = uθ̇n + sin(uθ)ṅ + (1−cos uθ)(n×ṅ) + R(n,uθ)·ω_a  (ȧ = ω_a×a, ḃ = ω_b×b)
    const ax = av[c], ay = av[c + 1], az = av[c + 2], bx = bv[c], by = bv[c + 1], bz = bv[c + 2];
    const wax = ad1[c], way = ad1[c + 1], waz = ad1[c + 2], wbx = bd1[c], wby = bd1[c + 1], wbz = bd1[c + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const sn = Math.hypot(cx, cy, cz);
    slerp3(av, c, bv, c, u, ov, c);
    if (sn < 1e-6) {
      for (let k = 0; k < 3; k++) od1[c + k] = ad1[c + k] + (bd1[c + k] - ad1[c + k]) * u; // 나란함/마주봄: 축이 없어 선형
    } else {
      const dax = way * az - waz * ay, day = waz * ax - wax * az, daz = wax * ay - way * ax; // ȧ
      const dbx = wby * bz - wbz * by, dby = wbz * bx - wbx * bz, dbz = wbx * by - wby * bx; // ḃ
      const th = Math.atan2(sn, ax * bx + ay * by + az * bz);
      const thd = -(dax * bx + day * by + daz * bz + ax * dbx + ay * dby + az * dbz) / sn;
      const nx = cx / sn, ny = cy / sn, nz = cz / sn;
      const ccx = day * bz - daz * by + ay * dbz - az * dby, ccy = daz * bx - dax * bz + az * dbx - ax * dbz, ccz = dax * by - day * bx + ax * dby - ay * dbx; // ċ
      const nd = nx * ccx + ny * ccy + nz * ccz;
      const ndx = (ccx - nx * nd) / sn, ndy = (ccy - ny * nd) / sn, ndz = (ccz - nz * nd) / sn; // ṅ
      const ps = u * th, sp = Math.sin(ps), cp = 1 - Math.cos(ps);
      const nnx = ny * ndz - nz * ndy, nny = nz * ndx - nx * ndz, nnz = nx * ndy - ny * ndx; // n×ṅ
      // R(n, ψ)·ω_a
      const kd = nx * wax + ny * way + nz * waz, cc = 1 - cp;
      const rwx = wax * cc + (ny * waz - nz * way) * sp + nx * kd * cp;
      const rwy = way * cc + (nz * wax - nx * waz) * sp + ny * kd * cp;
      const rwz = waz * cc + (nx * way - ny * wax) * sp + nz * kd * cp;
      od1[c] = u * thd * nx + sp * ndx + cp * nnx + rwx;
      od1[c + 1] = u * thd * ny + sp * ndy + cp * nny + rwy;
      od1[c + 2] = u * thd * nz + sp * ndz + cp * nnz + rwz;
    }
    for (let k = 0; k < 3; k++) od2[c + k] = ad2[c + k] + (bd2[c + k] - ad2[c + k]) * u; // α 는 선형 근사 (아무도 안 쓴다: 팔 α 는 IK 유한 차분, §6.6)
  }
  return o;
}
/** 크게 너머 직선 이음: o += over·(L − M). 방향은 M→L 회전 벡터를 over 배 더 돌린다 (slerp t > 1). 이득 1, 자르지 않는다 */
export function addOver(o, M, L, over) {
  const ov = o.v, mv = M.v, lv = L.v;
  for (let q = 0; q < LIN_IDX.length; q++) {
    const c = LIN_IDX[q];
    ov[c] += (lv[c] - mv[c]) * over;
    o.d1[c] += (L.d1[c] - M.d1[c]) * over;
    o.d2[c] += (L.d2[c] - M.d2[c]) * over;
  }
  for (let q = 0; q < DIR_OFFS.length; q++) {
    const c = DIR_OFFS[q];
    logRot(mv, c, lv, c, _r, 0);
    rotateBy(ov, c, _r[0] * over, _r[1] * over, _r[2] * over);
    for (let k = 0; k < 3; k++) {
      o.d1[c + k] += (L.d1[c + k] - M.d1[c + k]) * over;
      o.d2[c + k] += (L.d2[c + k] - M.d2[c + k]) * over;
    }
  }
  return o;
}
/**
 * 베기 시작 이월 (§1 row 6, §5.2): out += [rev − base]·k, k = 1 − sj(phi / carryPhi) (phi ≥ carryPhi 면 0).
 *  rev = φ_rev 표본, base = φ 0 표본 (둘 다 베기 시작 때 한 번, 그때의 S 로). phi = 베기 시작부터 잰 위상 (§5.2 wind 의 phiB).
 *  방향은 base→rev 회전 벡터 r 을 k 배: d = R(k·r)·d, ω = R(k·r)·ω + r·k′ (닫힌 식), α = R(k·r)·α + r·k″ (선형 근사). 돌려주는 값 = k
 */
export function carryOver(out, rev, base, phi, carryPhi) {
  const u = phi / carryPhi;
  const k = 1 - sj(u), kd = -sjD(u) / carryPhi, kdd = -sjDD(u) / (carryPhi * carryPhi);
  if (k <= 0) return 0;
  const ov = out.v, rv = rev.v, bv = base.v;
  for (let q = 0; q < LIN_IDX.length; q++) {
    const c = LIN_IDX[q], d = rv[c] - bv[c];
    ov[c] += d * k;
    out.d1[c] += d * kd;
    out.d2[c] += d * kdd;
  }
  for (let q = 0; q < DIR_OFFS.length; q++) {
    const c = DIR_OFFS[q];
    logRot(bv, c, rv, c, _r, 0);
    rotate3(_r[0] * k, _r[1] * k, _r[2] * k, ov, c, out.d1, c, out.d2, c); // 값·ω·α 를 같은 R(k·r) 로
    for (let j = 0; j < 3; j++) {
      out.d1[c + j] += _r[j] * kd;
      out.d2[c + j] += _r[j] * kdd;
    }
  }
  return k;
}

/** 검사가 끝난 격자 클립 목록 → Atlas (두 길이 여기서 만난다) */
export function buildAtlas(recs, opts = {}) {
  return new Atlas(recs, opts);
}

// ── 읽기 ──
/**
 * 묶음에서. src: 없음 = 번들의 src/strike/clips/atlas_v0.json (브라우저·기본), 객체 = 이미 읽은 JSON, 문자열 = 파일 경로(node).
 *  base64 → Float32 풀기와 도함수 계산이 여기서 돈다 (main.js 가 RAPIER.init 뒤에 부르고 beginFight 가 기다린다 — 싸움 중에는 돌지 않는다)
 */
export async function loadPack(src, opts = {}) {
  let pack = src;
  if (src == null) pack = (await import('./clips/atlas_v0.json', { with: { type: 'json' } })).default;
  else if (typeof src === 'string') {
    const fs = await import('node:fs');
    pack = JSON.parse(fs.readFileSync(src, 'utf8'));
  }
  const { grid, recs } = validatePack(pack);
  const atlas = buildAtlas(recs, { families: opts.families ?? ATLAS.families, grid, source: 'pack' });
  atlas.pack = { format: pack.format, generated: pack.generated, tool: pack.tool, bytes: opts.bytes };
  return atlas;
}
/**
 * 원본 클립 폴더에서 (node 도구: atlas_check · puppet · pack_atlas). index.json → 세 벌씩 읽어 검사·격자화.
 *  opts: { families = ATLAS.families, keepRaw = false, grid }
 */
export async function loadRaw(dir, opts = {}) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  const families = opts.families ?? ATLAS.families;
  const idxPath = path.join(dir, 'index.json');
  if (!fs.existsSync(idxPath)) fail('index', `${idxPath} 가 없음 (--clips=<폴더> 로 원본 클립 폴더를 준다)`);
  const index = validateIndex(JSON.parse(fs.readFileSync(idxPath, 'utf8')));
  const grid = opts.grid ?? makeGrid();
  const recs = [];
  for (const e of index.clips) {
    if (!families.includes(e.cut) || !SIZES.includes(e.size)) continue;
    const p = path.join(dir, e.file);
    if (!fs.existsSync(p)) fail(e.id, `파일 ${e.file} 이 없음`);
    const buf = fs.readFileSync(p);
    const clip = JSON.parse(buf.toString('utf8'));
    const checks = validateClip(clip, { tools: true });
    if (clip.id !== e.id || clip.cut !== e.cut || clip.side !== e.side || clip.size !== e.size) fail(e.id, `index 항목과 파일이 다름 (${clip.id} ${clip.cut} ${clip.side} ${clip.size})`);
    const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
    recs.push({ meta: metaOf(clip, sha1, checks), grid: resampleClip(clip, grid), raw: opts.keepRaw ? clip : undefined });
  }
  const atlas = buildAtlas(recs, { families, grid, source: 'clips' });
  atlas.dir = dir;
  atlas.indexGenerated = index.generated;
  return atlas;
}
/** node 도구의 원본 클립 폴더: --clips=<dir> > ATLAS.clipsDir(저장소 뿌리 기준) > docs/motion/clips */
export async function defaultClipsDir(root, argv = []) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const a = argv.find((s) => s.startsWith('--clips='));
  if (a) return path.resolve(root, a.slice(8));
  const c1 = path.resolve(root, ATLAS.clipsDir);
  if (fs.existsSync(path.join(c1, 'index.json'))) return c1;
  return path.resolve(root, 'docs', 'motion', 'clips');
}
/** 묶음 JSON 을 만든다 (pack_atlas.mjs). atlas 는 loadRaw 의 것 */
export function packOf(atlas, tool = 'tools/motion/pack_atlas.mjs') {
  return {
    format: ATLAS.packFormat, sourceFormat: ATLAS.format, indexFormat: ATLAS.indexFormat,
    generated: new Date().toISOString().slice(0, 10), tool, sourceIndexGenerated: atlas.indexGenerated ?? null,
    phiGrid: { from: atlas.grid.from, to: atlas.grid.to, step: atlas.grid.step, n: atlas.grid.n },
    channels: CHANNELS.map(([name, width, kind]) => ({ name, width, kind })), width: WIDTH,
    note: 'Float32 리틀 엔디언 base64, 행 = φ 격자 점, 열 = channels 차례. 도함수는 읽을 때 만든다. chest.xFactor = chest.yaw − pelvis.yaw, t(φ) = marks 선형 조각',
    clips: atlas.clips.map((c) => ({ ...c.meta, data: encodeF32(c.grid) })),
  };
}
export const loadAtlasPacked = loadPack;
export const loadAtlasFromClips = loadRaw;
