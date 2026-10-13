// ─────────────────────────────────────────────────────────────
//  잠든 습지(sluice) 가운데 말레이곰 석상 — 사장님이 주신 정면 사진(두 발로 선 말레이곰)의 비율·무늬·얼굴을 재어 다시 조형했다.
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/stage_sluice_bear.js 를 옮겨 고침 (짓는 틀·충돌체 꼴만 이어받고 몸은 새로 깎음).
//   사진 파일·사진 질감은 쓰지 않는다 — 아래 표의 수치는 사진을 눈대중·픽셀로 잰 비율이다 (docs/import/sluice_port_2026-10-14.md §1).
//   표의 단위: 곰 키(정수리 ~ 발바닥) = 1. t = 정수리에서 내려온 거리(사진에서 잰 그대로), 높이 Y = 1 − t.
//   x + = 곰 자신의 왼쪽(사진의 오른쪽), z + = 곰이 보는 앞. 놓을 때 −X(시작 카메라 쪽)를 보게 돌린다.
//   옆모습(주둥이 길이·목 숙임·가슴 두께·배)은 사진에 없어 말레이곰 해부 상식으로 채운 추정이다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Kit, h3 } from './stage_kit.js';

/** 곰 키(m, 정수리 ~ 발바닥, 받침 빼고). 사장님 10/14 03:0x 승인 '약 3 m' — 경기 화면에서 머리·가슴 무늬가 들어오는 키 (확인표 1110) */
export const BEAR_HEIGHT = 3.0;
/** 이끼 낀 돌 받침 (낮은 팔각기둥): 높이·바깥 반지름(m) (확인표 1112) */
export const BEAR_PLINTH = Object.freeze({ height: 0.35, radius: 0.86 });
export const SLUICE_BEAR_POSITION = Object.freeze([0, 0, 0]); // 결투장 한가운데 (사장님 10/14 02:3x)
export const SLUICE_BEAR_ROTATION_Y = -Math.PI / 2; // 모델 앞(+Z) → 세상 −X (판 시작 카메라 쪽을 본다)
/** AI 돌아가기·카메라가 쓰는 석상 반지름(m): 받침 바깥 반지름 + 0.04 (확인표 1113) */
export const BEAR_AVOID_RADIUS = BEAR_PLINTH.radius + 0.04;

// 색: 사진 색 그대로 칠한 석상 (디자인 결정 A). 돌 회색판이 필요하면 이 값들만 바꾸면 된다 (스위치는 두지 않는다 — 확인표 1111)
export const BEAR_COLORS = Object.freeze({
  fur: 0x232228, // 짧고 윤기 나는 검정 털 — 순검정이면 평면 음영에서 형태가 사라져 아주 어두운 숯빛
  sheen: 0x6c6d77, // 털 윤기: 하늘을 보는 면에 구워 넣는 서늘한 회색 반사 (사진 이마·어깨의 햇빛 받은 털 빛)
  chestTop: 0xd9822c, // 가슴 말굽 위 — 짙은 주황금
  chestBottom: 0xebc48e, // 가슴 말굽 아래 — 밝게 (사진 아래 끝은 크림빛 황갈)
  chestSpot: 0x2a1f1a, // 말굽 아래쪽 작은 검은 점
  muzzle: 0xc9a06a, // 짧은 주둥이·눈썹 자리 황갈색
  nose: 0x54443f, // 넓은 코 (사진은 짙은 회갈색)
  eye: 0x120d0c,
  claw: 0xcfc6b4, // 길고 아래로 휜 밝은 회백 발톱
  stone: 0x7c8077, // 받침 돌
  moss: 0x58733f, // 받침 이끼
});

const TAU = Math.PI * 2;

// ── 사진에서 잰 몸 (정면 폭은 사진, 깊이 d·앞뒤 cz 는 추정) ─────────────────────────────
// 몸통 [t, 반폭 w, 반깊이 d, 앞뒤 cz] — 목·어깨는 머리 아래로 이어지고, 옆선은 거의 곧고, 아랫배(t 0.6~0.7)만 살짝 앞으로 불룩.
const TORSO = [
  [0.105, 0.075, 0.068, 0.022], [0.125, 0.09, 0.08, 0.019], [0.15, 0.103, 0.089, 0.01], [0.18, 0.114, 0.097, 0.009],
  [0.2, 0.118, 0.1025, 0.0075], [0.24, 0.124, 0.109, 0.0075], [0.29, 0.128, 0.113, 0.007],
  [0.35, 0.128, 0.114, 0.006], [0.42, 0.127, 0.1115, 0.0055], [0.5, 0.123, 0.1095, 0.0075],
  [0.57, 0.119, 0.111, 0.011], [0.63, 0.12, 0.116, 0.014], [0.68, 0.129, 0.119, 0.011],
  [0.73, 0.145, 0.122, 0], [0.78, 0.153, 0.116, -0.01], [0.8, 0.148, 0.106, -0.014],
  [0.811, 0.1, 0.08, -0.016], [0.817, 0.04, 0.038, -0.016],
];
// 다리 [t, 가운데 cx, 반폭, 반깊이, cz] (한쪽, 거울로 다른 쪽) — 짧고 굵고 살짝 O자: 허벅지가 바깥으로 벌어지고 정강이는 거의 곧게.
//  가랑이 아치 꼭대기 t 0.825 · 무릎 t 0.89 · 두 발 가운데 사이 0.258 (사진 잰 값, 감독 메모 0.21 은 두 발 안쪽 틈 0.20 과 맞는다)
const THIGH = [ // 두 허벅지 안쪽 선이 가랑이 꼭대기(t 0.817)에서 만나 둥근 아치로 벌어진다 (사진: t 0.83 ±0.01 · 0.85 ±0.04 · 0.86 ±0.055 · 0.89 ±0.09)
  [0.72, 0.066, 0.074, 0.09, 0], [0.78, 0.07, 0.082, 0.093, 0.004], [0.805, 0.0745, 0.0825, 0.09, 0.007], [0.82, 0.0805, 0.0765, 0.087, 0.009],
  [0.83, 0.0875, 0.0695, 0.083, 0.01], [0.845, 0.0965, 0.0605, 0.076, 0.011], [0.86, 0.107, 0.052, 0.068, 0.012], [0.875, 0.116, 0.046, 0.061, 0.012],
  [0.89, 0.124, 0.0395, 0.056, 0.011], [0.925, 0.128, 0.036, 0.05, 0.005], [0.96, 0.129, 0.034, 0.048, -0.003], [0.985, 0.129, 0.031, 0.044, -0.008],
  [0.996, 0.129, 0.02, 0.03, -0.008],
];
// 발 [z, 반폭, 반높이, 가운데 높이 Y] — 발바닥을 평평하게 딛는다 (앞에서 보면 반폭 0.033 덩어리, 길이는 추정)
const FOOT = [
  [-0.045, 0.022, 0.016, 0.018], [-0.03, 0.03, 0.022, 0.024], [0, 0.033, 0.026, 0.028],
  [0.04, 0.034, 0.021, 0.022], [0.075, 0.033, 0.015, 0.016], [0.098, 0.028, 0.01, 0.011], [0.108, 0.016, 0.006, 0.007],
];
const FOOT_TOE_IN = 0.12; // 발끝이 살짝 안쪽 (곰이 서는 꼴, rad)
// 팔 [t, cx, 반폭, 반깊이, cz] — 어깨에서 거의 곧게, 아래로 갈수록 조금 벌어져 몸 옆에 붙는다. 팔 굵기 0.074~0.1
const ARM = [
  [0.2, 0.062, 0.05, 0.068, 0.004], [0.24, 0.076, 0.047, 0.064, 0.008], [0.283, 0.096, 0.045, 0.06, 0.013],
  [0.318, 0.115, 0.043, 0.056, 0.017], [0.35, 0.124, 0.041, 0.053, 0.02], [0.394, 0.131, 0.039, 0.05, 0.023],
  [0.437, 0.136, 0.038, 0.048, 0.026], [0.483, 0.146, 0.037, 0.046, 0.03], [0.528, 0.151, 0.037, 0.045, 0.033],
  [0.56, 0.153, 0.037, 0.044, 0.035],
];
// 늘어진 앞발 [t, cx, 반폭, 반깊이, cz] — 손목이 안쪽으로 꺾여 발이 아래로 늘어진다 (사진 왼발 폭 0.085)
const PAW = [
  [0.55, 0.152, 0.037, 0.044, 0.034], [0.575, 0.156, 0.041, 0.04, 0.04], [0.6, 0.154, 0.042, 0.034, 0.046],
  [0.62, 0.149, 0.039, 0.028, 0.05], [0.636, 0.142, 0.03, 0.022, 0.052], [0.645, 0.136, 0.018, 0.014, 0.052],
];
// 발톱: 발마다 다섯, 길이 약 0.034, 끝 t ≈ 0.665 (사진 0.66~0.68)
const CLAW = { count: 5, baseT: 0.626, spread: 0.05, inward: 0.006, drop: 0.04, rBase: 0.0074, rTip: 0.0009 };

// 머리 (머리 가운데 기준 머리 좌표, 앞 +z). 사진: 귀 끝 t 0.02~0.03 · 눈 0.053 · 코끝 0.085 · 입 0.12 · 턱 0.147,
//  머리 폭(귀 빼고) 약 0.19, 귀 포함 0.23. 작은 둥근 머리 + 짧고 앞으로 나온 황갈색 주둥이 + 넓은 코.
const HEAD_CENTER = [0.015, 0.921, 0.03]; // 몸 좌표 (Y = 1 − t). 사진의 머리(두 귀 가운데)는 몸 가운데보다 0.012 오른쪽
// 고개: 곰 자신의 왼쪽(사진 오른쪽)으로 돌리고 갸웃 — 사진의 코·두 눈 가운데가 두 귀 가운데보다 0.05·0.033 오른쪽, 오른귀가 0.011 낮다
const HEAD_TURN = { yaw: 0.42, pitch: 0.07, roll: -0.045 }; // rad (확인표 1114)
const SKULL = [ // [y, 반폭, 반깊이, cz] — 위가 넓고 둥근 머리(사진 정수리 높이 폭 0.165), 아래(뺨·턱밑)는 목털과 이어질 만큼 넓게 (뺨 높이 폭 0.21)
  [-0.088, 0.05, 0.045, -0.012], [-0.078, 0.09, 0.072, -0.008], [-0.058, 0.104, 0.082, -0.004], [-0.035, 0.105, 0.084, 0],
  [-0.008, 0.102, 0.085, 0.002], [0.02, 0.097, 0.082, 0], [0.042, 0.09, 0.076, -0.004],
  [0.058, 0.086, 0.068, -0.007], [0.07, 0.072, 0.056, -0.009], [0.076, 0.052, 0.04, -0.01], [0.08, 0.028, 0.021, -0.01], [0.082, 0.006, 0.005, -0.01],
];
const MUZZLE = [ // [z, 반폭, 반높이, 가운데 y] — 짧지만 넓고 앞으로 나온 주둥이, 위 선은 두 눈 사이에서 시작해 코로 내려간다
  [0.035, 0.06, 0.046, -0.014], [0.065, 0.057, 0.042, -0.015], [0.092, 0.05, 0.036, -0.014],
  [0.112, 0.042, 0.029, -0.012], [0.126, 0.031, 0.021, -0.01], [0.133, 0.014, 0.009, -0.009],
];
const JAW = [ // 아래턱: 주둥이 밑에 조금 물러나 다문 입 (턱 끝 t 0.15)
  [0.03, 0.05, 0.024, -0.05], [0.065, 0.045, 0.021, -0.049], [0.09, 0.036, 0.016, -0.047],
  [0.104, 0.024, 0.01, -0.045], [0.11, 0.01, 0.005, -0.044],
];
const NOSE = [ // 사진 코 폭 0.039 · 높이 t 0.07~0.1 — 주둥이 끝 위를 덮는 넓고 납작한 코
  [0.112, 0.018, 0.0105, 0.002], [0.124, 0.022, 0.0125, 0.0015], [0.133, 0.02, 0.0105, 0.0005], [0.138, 0.011, 0.005, -0.0005],
];
const EYE = { x: 0.043, y: 0.027, rx: 0.0078, ry: 0.0066 }; // 작은 검은 눈 (사진 두 눈 사이 0.086 — 고개 돌림을 되돌린 값)
const EAR = { x: 0.1, y: 0.038, z: -0.01, r: 0.0225, thick: 0.01 }; // 작고 동그란 검은 귀, 정수리 양옆 위 (사진 귀 가운데 t 0.042, 머리 가운데에서 0.097)
// 얼굴 황갈색 자리: 사진 정면에서 잰 테두리 [x, t] (몸 가운데 기준 — 고개를 돌린 채 보이는 그대로). 고개를 돌린 뒤 앞을 보는 머리 면만 이 안을 칠한다.
//  주둥이 둘레·눈 둘레·눈 위(눈썹 자리, t 0.026 까지)·턱. 그 밖(이마·머리 옆·귀)은 검정
const FACE_MASK = [
  [0.009, 0.026], [-0.002, 0.033], [-0.006, 0.042], [-0.011, 0.052], [-0.014, 0.062], [-0.022, 0.072], [-0.022, 0.08],
  [-0.014, 0.09], [-0.008, 0.1], [-0.002, 0.108], [0.006, 0.115], [0.016, 0.122], [0.024, 0.13], [0.034, 0.138], [0.048, 0.146],
  [0.065, 0.148], [0.075, 0.14], [0.085, 0.13], [0.09, 0.115], [0.092, 0.1], [0.097, 0.088], [0.098, 0.078], [0.095, 0.067],
  [0.09, 0.057], [0.086, 0.046], [0.08, 0.036], [0.06, 0.03], [0.038, 0.027],
];
function inFaceMask(x, t) {
  let inside = false;
  for (let i = 0, j = FACE_MASK.length - 1; i < FACE_MASK.length; j = i++) {
    const [xi, ti] = FACE_MASK[i];
    const [xj, tj] = FACE_MASK[j];
    if (ti > t !== tj > t && x < ((xj - xi) * (t - ti)) / (tj - ti) + xi) inside = !inside;
  }
  return inside;
}

// 가슴 말굽(U): 사진에서 줄마다 잰 주황 칸 [t, 왼쪽 바깥, 왼쪽 안, 오른쪽 안, 오른쪽 바깥] (안쪽 둘이 null 이면 가운데가 이어진 줄).
//  위 0.19 ~ 아래 0.33, 폭 0.178. 위 가운데가 검게 둥글게 파여 0.277 까지, 양 팔이 어깨선까지. 무늬 가운데는 몸 가운데보다 0.009 오른쪽(사진 그대로)
const CHEST = [
  [0.192, -0.052, -0.037, 0.048, 0.064], [0.2, -0.054, -0.03, 0.048, 0.073], [0.214, -0.056, -0.023, 0.047, 0.078],
  [0.227, -0.066, -0.028, 0.048, 0.088], [0.241, -0.073, -0.031, 0.048, 0.096], [0.254, -0.078, -0.028, 0.043, 0.097],
  [0.264, -0.08, -0.02, 0.036, 0.095], [0.272, -0.075, -0.008, 0.026, 0.09], [0.278, -0.069, null, null, 0.087],
  [0.287, -0.065, null, null, 0.081], [0.298, -0.057, null, null, 0.074], [0.309, -0.045, null, null, 0.061],
  [0.319, -0.031, null, null, 0.05], [0.327, -0.01, null, null, 0.028],
];
const CHEST_SPOTS = [[-0.043, 0.283, 0.0042], [-0.069, 0.277, 0.0036], [0.03, 0.296, 0.0042], [0.061, 0.273, 0.0036]]; // [x, t, 반지름]

// ── 기하 도구 ─────────────────────────────────────────────
const ex = (c, e) => Math.sign(c) * Math.abs(c) ** e;
/** 위아래로 쌓은 고리 (고리면 XZ). rings: [Y, 반폭, 반깊이, cx, cz]. e < 1 이면 조금 각지게. 양 끝을 막는다.
 *  고리를 반 칸씩 엇갈려(twist) 세로 줄무늬 대신 삼각 면이 지게 한다 — 돌기둥이 아니라 짐승 몸으로 읽히게 */
function loftY(rings, sides, e = 1, twist = true) {
  const pos = [];
  const idx = [];
  for (const [j, [y, w, d, cx, cz]] of rings.entries()) {
    for (let i = 0; i < sides; i++) {
      const a = ((i + (twist && j % 2 ? 0.5 : 0)) / sides) * TAU;
      pos.push(cx + w * ex(Math.cos(a), e), y, cz + d * ex(Math.sin(a), e));
    }
  }
  close(pos, idx, rings.length, sides, rings[0][0] < rings[rings.length - 1][0]);
  return geo(pos, idx);
}
/** 앞뒤로 쌓은 고리 (고리면 XY). rings: [z, 반폭, 반높이, cx, cy] */
function loftZ(rings, sides, e = 1, twist = true) {
  const pos = [];
  const idx = [];
  for (const [j, [z, w, h, cx, cy]] of rings.entries()) {
    for (let i = 0; i < sides; i++) {
      const a = ((i + (twist && j % 2 ? 0.5 : 0)) / sides) * TAU;
      pos.push(cx + w * ex(Math.cos(a), e), cy + h * ex(Math.sin(a), e), z);
    }
  }
  close(pos, idx, rings.length, sides, false);
  return geo(pos, idx);
}
/** 옆면·양 끝 뚜껑을 바깥을 보게 감는다. up = 고리가 +Y 로 쌓였나 (loftZ 는 +Z 로 쌓여 up=false 와 같은 감김) */
function close(pos, idx, n, sides, up) {
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const a = j * sides + i;
      const b = j * sides + ((i + 1) % sides);
      if (up) idx.push(a, a + sides, b, b, a + sides, b + sides);
      else idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  const last = (n - 1) * sides;
  for (let i = 1; i < sides - 1; i++) {
    if (up) idx.push(0, i, i + 1, last, last + i + 1, last + i);
    else idx.push(0, i + 1, i, last, last + i, last + i + 1);
  }
}
function geo(pos, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const tY = (t) => 1 - t;
const mirror = (side, rows) => rows.map(([t, cx, w, d, cz]) => [tY(t), w, d, cx * side, cz]);

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _col = new THREE.Color();
/** 삼각형마다 한 색 (꼭짓점 셋에 같은 색 → 평면 음영에서 색 경계가 면 경계를 따라 또렷하다). fn(가운데, 면 법선) → THREE.Color | null(그대로) */
function paintTris(g, fn) {
  const p = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i += 3) {
    _a.fromBufferAttribute(p, i);
    _b.fromBufferAttribute(p, i + 1);
    _c.fromBufferAttribute(p, i + 2);
    _n.copy(_b).sub(_a).cross(_c.clone().sub(_a)).normalize();
    const m = _a.clone().add(_b).add(_c).multiplyScalar(1 / 3);
    const c = fn(m, _n);
    if (!c) continue;
    for (let k = 0; k < 3; k++) col.setXYZ(i + k, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
/** 털 윤기: 위·앞 하늘을 보는 면일수록 서늘한 회색 반사를 조금 더한다 (꼭짓점 색에 굽는다 — 우리 무대 결) */
const SKY = new THREE.Vector3(0, 1, 0.6).normalize();
function sheen(g, amount) {
  const sh = new THREE.Color(BEAR_COLORS.sheen);
  const p = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i += 3) {
    _a.fromBufferAttribute(p, i);
    _b.fromBufferAttribute(p, i + 1);
    _c.fromBufferAttribute(p, i + 2);
    _n.copy(_b).sub(_a).cross(_c.clone().sub(_a)).normalize();
    const k = amount * Math.max(0, _n.dot(SKY)) ** 1.6;
    if (k <= 0) continue;
    for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) + (sh.r - col.getX(j)) * k, col.getY(j) + (sh.g - col.getY(j)) * k, col.getZ(j) + (sh.b - col.getZ(j)) * k);
  }
  col.needsUpdate = true;
}
/** 그늘 굽기: fn(가운데, 면 법선) → 밝기 배수 (팔과 몸 사이처럼 가려진 면을 어둡게 — 검은 털에서 팔이 몸과 갈라져 읽히게) */
function shade(g, fn) {
  const p = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i += 3) {
    _a.fromBufferAttribute(p, i);
    _b.fromBufferAttribute(p, i + 1);
    _c.fromBufferAttribute(p, i + 2);
    _n.copy(_b).sub(_a).cross(_c.clone().sub(_a)).normalize();
    const k = fn(_a.clone().add(_b).add(_c).multiplyScalar(1 / 3), _n);
    if (k === 1) continue;
    for (let j = i; j < i + 3; j++) col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
  }
  col.needsUpdate = true;
}
/** 앞(+z)에서 쏜 광선이 처음 닿는 면의 z (곡면에 무늬·눈을 붙일 때) */
function surfaceZ(mesh, x, y, from = 1) {
  const r = new THREE.Raycaster(new THREE.Vector3(x, y, from), new THREE.Vector3(0, 0, -1));
  const hit = r.intersectObject(mesh, false)[0];
  return hit ? hit.point.z : null;
}

const FUR = { vary: 0.02, noise: 0.025 };
const SHEEN = 0.34; // 털 윤기 세기 (꼭짓점 색에 굽는 하늘 반사, 확인표 1111)
// ── 조형 ────────────────────────────────────────────────
function sculpt(kit) {
  const C = BEAR_COLORS;
  const fur = [];
  const put = (g, color, opt = FUR, m = null) => {
    const out = kit.putM('bear', g, color, m || new THREE.Matrix4(), opt);
    g.dispose();
    return out;
  };
  // 몸통 (가슴 무늬를 붙이려고 광선용 사본을 먼저 둔다)
  const torsoRings = TORSO.map(([t, w, d, cz]) => [tY(t), w, d, 0, cz]);
  const torsoGeo = loftY(torsoRings, 28, 0.92);
  const torsoMesh = new THREE.Mesh(torsoGeo.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const torso = put(torsoGeo, C.fur);
  const S = THREE.MathUtils.smoothstep;
  // 팔이 덮는 몸통 옆면(t 0.27~0.64)은 그늘
  shade(torso, (m, n) => 1 - 0.42 * S(Math.abs(m.x), 0.085, 0.122) * S(n.x * Math.sign(m.x), 0.25, 0.8) * S(1 - m.y, 0.25, 0.3) * (1 - S(1 - m.y, 0.6, 0.66)));
  fur.push(torso);
  for (const side of [-1, 1]) {
    fur.push(put(loftY(mirror(side, THIGH), 16, 0.95), C.fur));
    // 발: 발목 아래에서 앞으로 (발끝 살짝 안쪽)
    const foot = loftZ(FOOT.map(([z, w, h, y]) => [z, w, h, 0, y]), 14, 0.9);
    const fm = new THREE.Matrix4().compose(new THREE.Vector3(side * 0.129, 0, -0.004), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * FOOT_TOE_IN), new THREE.Vector3(1, 1, 1));
    sheen(put(foot, C.fur, FUR, fm), SHEEN * 0.35); // 발등은 윤기를 덜 (사진 발은 검다)
    for (const rows of [ARM, PAW]) {
      const limb = put(loftY(mirror(side, rows), 14, rows === ARM ? 0.95 : 0.92), C.fur);
      shade(limb, (m, n) => 1 - 0.36 * S(-n.x * side, 0.15, 0.7)); // 몸 쪽을 보는 팔 안쪽은 그늘
      fur.push(limb);
    }
    // 발톱 다섯: 앞발 아래 안쪽·앞 가장자리에서 앞으로 나왔다가 아래로, 끝은 안쪽·뒤로 휜 갈고리 (사진 그대로 몸 쪽에 몰려 있다)
    const [, pcx, , pd, pcz] = PAW[3];
    for (let k = 0; k < CLAW.count; k++) {
      const u = k / (CLAW.count - 1); // 0 = 바깥 → 1 = 몸 쪽
      const off = -0.012 + u * CLAW.spread * 0.84; // + = 몸 쪽
      const x0 = side * (pcx - off);
      const y0 = tY(CLAW.baseT) + (u - 0.5) ** 2 * 0.01;
      const z0 = pcz + pd * 0.72 - Math.abs(u - 0.6) * 0.012;
      const L = CLAW.drop * (0.9 + 0.2 * (1 - Math.abs(u - 0.55)));
      const pts = [[x0, y0, z0], [x0 - side * 0.002, y0 - L * 0.34, z0 + 0.005], [x0 - side * 0.005, y0 - L * 0.7, z0 + 0.003], [x0 - side * CLAW.inward * 1.5, y0 - L, z0 - 0.003]];
      const r = [CLAW.rBase, CLAW.rBase * 0.72, CLAW.rBase * 0.45, CLAW.rTip];
      for (let i = 0; i < 3; i++) clawSeg(kit, pts[i], pts[i + 1], r[i], r[i + 1]);
    }
  }
  chestPatch(kit, torsoMesh);
  torsoMesh.geometry.dispose();
  torsoMesh.material.dispose();
  for (const g of fur) sheen(g, SHEEN);
  head(kit);
}

function clawSeg(kit, a, b, r0, r1) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
  const g = new THREE.CylinderGeometry(r1, r0, dir.length(), 6, 1, false);
  kit.putM('bear', g, BEAR_COLORS.claw, m, { vary: 0.03, noise: 0.03 });
  g.dispose();
}

/** 가슴 말굽: 줄마다 잰 칸을 띠 모양 격자로 이어 몸통 앞면에 붙인다 (살짝 도드라진 칠, 위 짙은 주황 → 아래 밝게) */
function chestPatch(kit, torsoMesh) {
  const pos = [];
  const cols = [];
  const top = new THREE.Color(BEAR_COLORS.chestTop);
  const bot = new THREE.Color(BEAR_COLORS.chestBottom);
  const N = 5; // 칸마다 가로 나눔
  const lift = 0.0032;
  const vtx = (x, t) => {
    const y = tY(t);
    const z = (surfaceZ(torsoMesh, x, y) ?? 0.11) + lift;
    pos.push(x, y, z);
    const k = THREE.MathUtils.smoothstep(t, 0.255, 0.335); // 위 2/3 는 짙은 주황, 아래 끝으로 밝게
    _col.copy(top).lerp(bot, k);
    cols.push(_col.r, _col.g, _col.b);
  };
  const spans = (row) => (row[2] == null ? [[row[1], row[4]]] : [[row[1], row[2]], [row[3], row[4]]]);
  for (let j = 0; j < CHEST.length - 1; j++) {
    const A = CHEST[j];
    const B = CHEST[j + 1];
    const sa = spans(A);
    const sb = spans(B);
    // 두 줄의 칸 수가 같으면 칸끼리, 다르면(파인 자리 끝) 위 두 칸을 아래 한 칸의 양쪽 반에 잇는다
    const pairs = sa.length === sb.length ? sa.map((s, i) => [s, sb[i]]) : [[sa[0], [sb[0][0], (sb[0][0] + sb[0][1]) / 2]], [sa[1], [(sb[0][0] + sb[0][1]) / 2, sb[0][1]]]];
    for (const [[a0, a1], [b0, b1]] of pairs) {
      for (let i = 0; i < N; i++) {
        const u0 = i / N;
        const u1 = (i + 1) / N;
        const p = [
          [a0 + (a1 - a0) * u0, A[0]], [a0 + (a1 - a0) * u1, A[0]],
          [b0 + (b1 - b0) * u0, B[0]], [b0 + (b1 - b0) * u1, B[0]],
        ];
        for (const [x, t] of [p[0], p[2], p[1], p[1], p[2], p[3]]) vtx(x, t);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const out = kit.putM('bear', g, 0xffffff, new THREE.Matrix4(), { vary: 0, noise: 0.02 });
  // Kit 이 칠한 흰색 위에 줄 높이별 색을 다시 얹는다 (작은 얼룩 noise 는 곱해서 남긴다)
  const c = out.attributes.color;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * cols[i * 3], c.getY(i) * cols[i * 3 + 1], c.getZ(i) * cols[i * 3 + 2]);
  g.dispose();
  // 아래쪽 작은 검은 점
  for (const [x, t, r] of CHEST_SPOTS) {
    const y = tY(t);
    const z = (surfaceZ(torsoMesh, x, y) ?? 0.11) + lift + 0.0016;
    const s = new THREE.CircleGeometry(r, 8);
    kit.putM('bear', s, BEAR_COLORS.chestSpot, new THREE.Matrix4().makeTranslation(x, y, z), { vary: 0.05, noise: 0 });
    s.dispose();
  }
}

/** 머리: 머리 좌표에서 깎은 뒤 고개 돌림을 얹어 몸에 붙이고, 돌린 채로 털 윤기·얼굴 황갈색을 칠한다 */
function head(kit) {
  const C = BEAR_COLORS;
  const start = kit.bins.bear.length;
  const fur = [];
  const skullGeo = loftY(SKULL.map(([y, w, d, cz]) => [y, w, d, 0, cz]), 36, 1);
  const skullMesh = new THREE.Mesh(skullGeo.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const skull = kit.putM('bear', skullGeo, C.fur, new THREE.Matrix4(), FUR);
  skullGeo.dispose();
  fur.push(skull);
  const tanOpt = { vary: 0.02, noise: 0.03 };
  for (const g of [loftZ(MUZZLE.map(([z, w, h, y]) => [z, w, h, 0, y]), 18, 0.95), loftZ(JAW.map(([z, w, h, y]) => [z, w, h, 0, y]), 14, 0.95)]) {
    kit.putM('bear', g, C.muzzle, new THREE.Matrix4(), tanOpt);
    g.dispose();
  }
  const nose = loftZ(NOSE.map(([z, w, h, y]) => [z, w, h, 0, y]), 14, 0.85);
  kit.putM('bear', nose, C.nose, new THREE.Matrix4(), { vary: 0.02, noise: 0.02 });
  nose.dispose();
  // 입: 다문 무표정 — 웃는 입선을 그리지 않는다 (주둥이와 조금 물러난 아래턱 사이 그늘만)
  for (const side of [-1, 1]) {
    // 눈: 머리 겉면에 반쯤 묻힌 작은 납작 타원
    const ex0 = side * EYE.x;
    const ez = surfaceZ(skullMesh, ex0, EYE.y) ?? 0.07;
    const eye = new THREE.SphereGeometry(1, 10, 6);
    kit.putM('bear', eye, C.eye, new THREE.Matrix4().compose(new THREE.Vector3(ex0, EYE.y, ez - 0.0015), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.35, 0)), new THREE.Vector3(EYE.rx, EYE.ry, 0.004)), { vary: 0, noise: 0 });
    eye.dispose();
    // 귀: 작고 동그란 검은 귀 (앞·바깥을 보게, 머리 위 모서리에 붙는다)
    const ear = new THREE.SphereGeometry(1, 12, 8);
    fur.push(kit.putM('bear', ear, C.fur, new THREE.Matrix4().compose(new THREE.Vector3(side * EAR.x, EAR.y, EAR.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, side * 0.75, side * -0.3, 'YXZ')), new THREE.Vector3(EAR.r, EAR.r * 1.05, EAR.thick)), FUR));
    ear.dispose();
  }
  skullMesh.geometry.dispose();
  skullMesh.material.dispose();
  const turn = new THREE.Matrix4().compose(new THREE.Vector3(...HEAD_CENTER), new THREE.Quaternion().setFromEuler(new THREE.Euler(HEAD_TURN.pitch, HEAD_TURN.yaw, HEAD_TURN.roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
  for (const g of kit.bins.bear.slice(start)) g.applyMatrix4(turn);
  for (const g of fur) sheen(g, SHEEN);
  const tan = new THREE.Color(C.muzzle);
  paintTris(skull, (m, n) => (n.z > -0.2 && inFaceMask(m.x, 1 - m.y) ? tan.clone().multiplyScalar(1 + (h3(m.x * 9, m.y * 9, m.z * 9, 3) - 0.5) * 0.06) : null));
}

/** 받침: 낮은 팔각기둥 + 윗면 가장자리·옆 아래 이끼 (m 단위, 곰과 따로) */
function plinth(kit) {
  const P = BEAR_PLINTH;
  const C = BEAR_COLORS;
  const moss = new THREE.Color(C.moss);
  const block = new THREE.CylinderGeometry(P.radius * 0.95, P.radius, P.height * 0.82, 8, 2);
  block.translate(0, (P.height * 0.82) / 2, 0);
  const cap = new THREE.CylinderGeometry(P.radius * 0.9, P.radius * 0.96, P.height * 0.18, 8, 1);
  cap.translate(0, P.height * 0.91, 0);
  for (const g of [block, cap]) {
    const out = kit.putM('plinth', g, C.stone, new THREE.Matrix4().makeRotationY(Math.PI / 8), { rough: 0.018, vary: 0.06, noise: 0.08, uv: 'box', uvScale: 0.9 });
    paintTris(out, (m, n) => {
      const r = Math.hypot(m.x, m.z) / P.radius;
      const patch = h3(Math.round(m.x * 3), 0, Math.round(m.z * 3), 41);
      const up = n.y > 0.6 ? THREE.MathUtils.smoothstep(r, 0.55, 0.9) * (0.45 + patch * 0.6) : 0;
      const low = n.y < 0.6 ? (1 - THREE.MathUtils.smoothstep(m.y, 0.02, 0.2)) * 0.7 * patch : 0;
      const k = Math.min(1, Math.max(up, low));
      if (k < 0.35) return null;
      return moss.clone().multiplyScalar(0.85 + patch * 0.3);
    });
    g.dispose();
  }
}

/** 석상 겉모습 + 충돌체 꼴. 충돌체는 부르는 쪽(arena_obstacle.js)이 shapes 로 만든다 */
export function buildSluiceBear(scene, { position = SLUICE_BEAR_POSITION, rotationY = SLUICE_BEAR_ROTATION_Y, height = BEAR_HEIGHT } = {}) {
  const kit = new Kit(64371);
  sculpt(kit);
  for (const g of kit.bins.bear) g.scale(height, height, height).translate(0, BEAR_PLINTH.height, 0);
  plinth(kit);
  // 칠한 석상: 털 윤기는 꼭짓점 색에 구웠고, 해 빛에 은은한 반사가 생기게 거칠기를 조금 낮춘다 (확인표 1111)
  const bearMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: 0 });
  const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const group = new THREE.Group();
  group.name = 'sluice-sun-bear-statue';
  const bear = kit.mesh('bear', bearMat, { cast: true, receive: true });
  bear.name = 'sluice-sun-bear';
  const base = kit.mesh('plinth', stoneMat, { cast: true, receive: true });
  base.name = 'sluice-sun-bear-plinth';
  group.add(bear, base);
  for (const list of Object.values(kit.bins)) for (const g of list) g.dispose();
  group.position.set(...position);
  group.rotation.y = rotationY;
  scene.add(group);
  const triangleCount = (bear.geometry.attributes.position.count + base.geometry.attributes.position.count) / 3;
  const footprint = { position: [...position], rotationY, radius: BEAR_AVOID_RADIUS, shapes: bearObstacleShapes(position, rotationY, height) };
  group.userData.sluiceBear = { triangleCount, footprint };
  return { group, mesh: bear, footprint, triangleCount };
}

/**
 * 충돌체 꼴 (세상 좌표의 가운데·회전): 받침 원기둥 + 다리·몸통·팔·머리 캡슐 — 곰 키에 맞춰 줄인다 (샛별 저장소 방식, 확인표 1115).
 *  캡슐 halfHeight 는 양 끝 반구를 뺀 반 길이. 가는 귀·발톱·주둥이에는 따로 두지 않는다
 */
export function bearObstacleShapes(position = SLUICE_BEAR_POSITION, rotationY = SLUICE_BEAR_ROTATION_Y, height = BEAR_HEIGHT) {
  const s = Math.sin(rotationY);
  const c = Math.cos(rotationY);
  const P = BEAR_PLINTH.height;
  const H = height;
  const world = ([x, y, z]) => [x * c + z * s + position[0], y + position[1], -x * s + z * c + position[2]];
  const at = (x, t, z) => [x * H, P + tY(t) * H, z * H];
  const capsule = (name, A, B, r) => {
    const a = world(A);
    const b = world(B);
    const d = b.map((v, i) => v - a[i]);
    const len = Math.hypot(...d);
    const [x, y, z] = d.map((v) => v / len);
    const ql = Math.hypot(z, -x, 1 + y);
    return Object.freeze({ name, type: 'capsule', radius: r * H, halfHeight: len / 2, center: Object.freeze(a.map((v, i) => (v + b[i]) / 2)), rotation: Object.freeze({ x: z / ql, y: 0, z: -x / ql, w: (1 + y) / ql }) });
  };
  const shapes = [Object.freeze({ name: 'bear-plinth', type: 'cylinder', radius: BEAR_PLINTH.radius, halfHeight: P / 2, center: Object.freeze(world([0, P / 2, 0])) })];
  for (const side of [-1, 1]) shapes.push(capsule(`bear-leg-${side < 0 ? 'right' : 'left'}`, at(side * 0.124, 0.955, 0.0), at(side * 0.09, 0.79, 0.004), 0.058));
  shapes.push(capsule('bear-torso', at(0, 0.7, 0.006), at(0, 0.3, 0.006), 0.125));
  for (const side of [-1, 1]) shapes.push(capsule(`bear-arm-${side < 0 ? 'right' : 'left'}`, at(side * 0.15, 0.6, 0.04), at(side * 0.1, 0.29, 0.015), 0.042));
  shapes.push(capsule('bear-head', at(0, 0.11, 0.05), at(0, 0.04, 0.04), 0.085));
  return Object.freeze(shapes);
}

export const BEAR_OBSTACLE_SHAPES = bearObstacleShapes();
