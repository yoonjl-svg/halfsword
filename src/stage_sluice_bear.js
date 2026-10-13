// ─────────────────────────────────────────────────────────────
//  잠든 습지(sluice) 가운데 말레이곰 석상 — 사장님이 주신 정면 사진(두 발로 선 말레이곰)의 비율·무늬·얼굴을 재어 다시 조형했다.
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/stage_sluice_bear.js 를 옮겨 고침 (짓는 틀·충돌체 꼴만 이어받고 몸은 새로 깎음).
//   사진 파일·사진 질감은 쓰지 않는다 — 아래 표의 수치는 사진을 눈대중·픽셀로 잰 비율이다 (docs/import/sluice_port_2026-10-14.md §1).
//   표의 단위: 곰 키(정수리 ~ 발바닥) = 1. t = 정수리에서 내려온 거리(사진에서 잰 그대로), 높이 Y = 1 − t.
//   x + = 곰 자신의 왼쪽(사진의 오른쪽), z + = 곰이 보는 앞. 놓을 때 −X(시작 카메라 쪽)를 보게 돌린다.
//   옆모습(주둥이 길이·목 숙임·가슴 두께·배)은 사진에 없어 말레이곰 해부 상식으로 채운 추정이다.
//   1b(감독 검수 10/14): 머리·목·몸통을 고리 하나로 이어 이음매를 없애고, 얼굴 무늬를 좌우 대칭으로, 넓적한 주둥이·큰 코·처진 입선,
//   정수리 양옆 위 납작한 컵 귀, 위가 곧고 넓은 가슴 말굽, 손목에서 꺾인 앞발 덩어리, 부드러운 법선(짧고 윤기 나는 털)으로 고쳤다.
//   1c(감독 검수 · 사장님 10/14 03:5x '눈과 눈 주위가 중요'): 주둥이를 머리 고리에서 뽑아낸 한 덩어리(아래턱까지)로, 얼굴 황갈을 꼭짓점
//   그러데이션으로(날카로운 테두리 없음), 눈을 작은 아몬드꼴·바깥 눈꼬리 처짐·쑥 들어간 눈두덩·짙은 테·반사점으로, 가슴 파임을 넓은 U 로 고쳤다.
//   1d(감독 검수): 황갈 판을 주둥이·두 눈 바로 둘레·눈 위로 좁히고(볼·관자놀이 검정), 눈 1.3 배·윗눈꺼풀 짙은 선, 주둥이 15 % 짧고 넓게, 넓고 납작한 코.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Kit } from './stage_kit.js';

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
  fur: 0x232228, // 짧고 윤기 나는 검정 털 — 순검정이면 형태가 사라져 아주 어두운 숯빛
  sheen: 0x6c6d77, // 털 윤기: 하늘을 보는 면에 구워 넣는 서늘한 회색 반사 (사진 이마·어깨의 햇빛 받은 털 빛)
  chestTop: 0xd9822c, // 가슴 말굽 위 — 짙은 주황금
  chestBottom: 0xecc792, // 가슴 말굽 아래 — 크림빛 황갈
  chestSpot: 0x2a1f1a, // 말굽 아래쪽 작은 검은 점
  muzzleTip: 0xddbc8e, // 주둥이 끝 — 가장 밝은 황갈
  muzzle: 0xc69c66, // 주둥이·턱 황갈
  brow: 0xd2b088, // 두 눈을 감싸는 '안경'·눈 위 눈썹 자리 — 옅은 황갈 (이마 검정으로 부드럽게 녹아든다)
  nose: 0x66524d, // 큰 코 (사진은 짙은 회갈색 — 윗면이 조금 밝고 아래에 콧구멍 둘)
  nostril: 0x1d1514,
  eye: 0x4a2c1c, // 짙은 갈색 눈동자 (가운데 동공은 더 짙게)
  eyeRim: 0x120c0a, // 눈 가장자리 얇은 짙은 테
  eyeShine: 0xf1ebdf, // 아주 작은 반사점
  claw: 0xcfc6b4, // 길고 아래로 휜 밝은 회백 발톱
  earIn: 0x151417, // 귀 컵 안쪽
  stone: 0x7c8077, // 받침 돌
  moss: 0x58733f, // 받침 이끼
});

const TAU = Math.PI * 2;

// ── 사진에서 잰 몸 (정면 폭은 사진, 깊이 d·앞뒤 cz 는 추정) ─────────────────────────────
// 머리·목·몸통을 고리 하나로 [t, 반폭 w, 반깊이 d, 앞뒤 cz]: 둥근 정수리 → 볼(가장 넓은 곳, 머리 폭 0.188 — 어깨보다 확실히 좁게)
//  → 굵은 목이 이음매 없이 비스듬한 어깨로 흘러내림 → 옆선이 거의 곧은 긴 몸통 → 아랫배 살짝 불룩 → 엉덩이가 가장 넓다(0.31) → 가랑이(t 0.817)
const BODY = [
  [0, 0.004, 0.004, 0.022], [0.005, 0.032, 0.03, 0.023], [0.013, 0.054, 0.049, 0.025], [0.026, 0.071, 0.064, 0.027],
  [0.043, 0.083, 0.074, 0.029], [0.063, 0.09, 0.08, 0.03], [0.085, 0.093, 0.082, 0.03], [0.108, 0.094, 0.082, 0.027],
  [0.13, 0.099, 0.084, 0.021], [0.152, 0.105, 0.089, 0.013], [0.178, 0.113, 0.096, 0.009], [0.205, 0.119, 0.103, 0.0075],
  [0.24, 0.124, 0.109, 0.0075], [0.29, 0.128, 0.113, 0.007], [0.35, 0.129, 0.114, 0.006], [0.42, 0.128, 0.1115, 0.0055],
  [0.5, 0.125, 0.11, 0.0075], [0.57, 0.122, 0.112, 0.011], [0.63, 0.123, 0.117, 0.015], [0.68, 0.131, 0.12, 0.012],
  [0.73, 0.146, 0.122, 0], [0.78, 0.153, 0.116, -0.01], [0.8, 0.148, 0.106, -0.014], [0.811, 0.1, 0.08, -0.016], [0.817, 0.04, 0.038, -0.016],
];
// 다리 [t, 가운데 cx, 반폭, 반깊이, cz] (한쪽, 거울로 다른 쪽) — 짧고 굵고 살짝 O자. 두 허벅지 안쪽 선이 가랑이 꼭대기(t 0.817)에서 만나
//  둥근 아치로 벌어진다 (사진: t 0.83 ±0.01 · 0.86 ±0.055 · 0.89 ±0.09) · 무릎 t 0.89 · 두 발 가운데 사이 0.258
//  (감독 메모 0.21 은 사진에서 두 발 안쪽 틈 0.20 과 맞는다)
const THIGH = [
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
// 팔과 앞발을 고리 하나로 [t, cx, 반폭, 반깊이, cz] — 몸 속 어깨에서 비스듬히 흘러나와 거의 곧게, 아래로 갈수록 조금 벌어져 몸 옆에 붙는다.
//  굵은 아래팔(폭 0.074)이 손목에서 잘록해지지 않고 앞발 덩어리로 이어져 안쪽·앞으로 꺾이고(가운데 0.151 → 0.126), 그 끝에서 발톱이 아래로 휜다
//  (사진 앞발 폭 0.085, 앞발 끝 t 0.645)
const ARM = [
  [0.19, 0.06, 0.034, 0.05, 0.004], [0.22, 0.07, 0.044, 0.062, 0.006], [0.255, 0.083, 0.047, 0.063, 0.01], [0.283, 0.096, 0.045, 0.06, 0.013],
  [0.318, 0.115, 0.043, 0.056, 0.017], [0.35, 0.124, 0.041, 0.053, 0.02], [0.394, 0.131, 0.039, 0.05, 0.023], [0.437, 0.136, 0.038, 0.048, 0.026],
  [0.483, 0.145, 0.037, 0.046, 0.03], [0.52, 0.149, 0.037, 0.045, 0.033], [0.548, 0.151, 0.0375, 0.043, 0.037], [0.568, 0.15, 0.041, 0.04, 0.043],
  [0.588, 0.146, 0.042, 0.036, 0.049], [0.606, 0.141, 0.04, 0.031, 0.053], [0.621, 0.135, 0.034, 0.025, 0.056], [0.633, 0.13, 0.026, 0.018, 0.057],
  [0.641, 0.127, 0.016, 0.011, 0.057], [0.646, 0.125, 0.006, 0.005, 0.056],
];
const PAW_TIP = 15; // ARM 안에서 발톱이 나오는 고리 (t 0.633)
// 발톱: 발마다 다섯, 길이 약 0.05(사진에 보이는 발톱 0.045~0.06), 끝 t ≈ 0.67 (사진 0.661~0.677)
const CLAW = { count: 5, baseT: 0.624, spread: 0.05, inward: 0.011, drop: 0.049, rBase: 0.0074, rTip: 0.0009 };

// 머리 (머리 가운데 기준 머리 좌표, 앞 +z). 사진: 눈 t 0.053 · 코 가운데 0.085 · 입 0.12 · 턱 0.147, 코 폭 0.039
const HEAD_SHIFT = 0.012; // 사진의 머리(두 귀 가운데)는 몸 가운데보다 키의 0.012 오른쪽 — 머리 고리를 그만큼 옮기고 목에서 0 으로 잇는다
const HEAD_CENTER = [HEAD_SHIFT, 0.921, 0.03]; // 몸 좌표 (Y = 1 − t)
// 고개: 곰 왼쪽으로 조금 돌림(감독 측정: 코가 두 눈 가운데보다 약 9 px = 키의 0.02 오른쪽, 두 눈 (350, 66)·(383, 65)) · 갸웃은 아주 작게.
//  머리통은 둥근 고리라 그대로 두고 얼굴(주둥이·눈·무늬·귀)만 돌린다
const HEAD_TURN = { yaw: 0.36, pitch: 0.02, roll: -0.02 }; // rad (확인표 1114)
// 얼굴은 머리 고리를 머리 좌표 앞(+z)으로 밀어 깎는다 (주둥이·아래턱이 머리에서 솟은 한 덩어리 — 1c).
//  주둥이: 바닥 타원(가운데 y −0.014, 반폭 0.057 — 윗입술 자리가 넓다, 위로 0.046 = 두 눈 사이 콧등 · 아래로 0.053 = 턱 끝)에서 끝으로 갈수록
//  가늘어지는 짧고 넓적한 원뿔꼴, 끝까지 0.049 앞으로(1d: 15 % 짧게). 아래쪽(턱)은 덜 나온다. 다문 입선은 주둥이 아래쪽의 얕은 홈 (양 끝이 살짝 처짐)
const SNOUT = { yc: -0.014, a: 0.057, chinA: 0.04, up: 0.046, down: 0.053, out: 0.049, flat: 0.26, chin: 0.3 };
const MOUTH = { y: -0.04, droop: 0.004, half: 0.031, depth: 0.0036, width: 0.0028 };
// 눈 (감독 측정 10/14: 두 눈 사이 키의 0.073 · 눈 ~ 코 세로 0.034 · 눈 t 0.056): 작은 아몬드꼴, 바깥 눈꼬리가 살짝 처진다.
//  쑥 들어간 눈 — 눈자리를 얕게 파고(socket) 위 눈두덩(brow)을 살짝 내밀어 눈 위에 그늘, 가장자리에 얇은 짙은 테, 짙은 갈색 눈동자에 반사점 하나
const EYE = { x: 0.039, y: 0.028, w: 0.028, h: 0.0185, droop: 0.0045, tilt: 0.12, rim: 1.16, lid: 0.07, pupil: 0.5, shine: 0.0021, socket: 0.0048, brow: 0.0052 };
const EAR = { x: 0.092, y: 0.04, z: -0.012, r: 0.0175, thick: 0.007 }; // 작고 납작한 컵 귀, 정수리 양옆 위 (사진 귀 가운데 (309, 62)·(396, 66))
// 얼굴 황갈 자리 (머리 좌표, 좌우 대칭): 주둥이 덩어리 + 두 눈을 감싸는 '안경' + 콧등 + 눈 위 눈썹 자리 둘. 모두 부드러운 가장자리
const SPECS = { x: 0.036, rx: 0.0175, ry: 0.016 }; // 눈마다 감싸는 옅은 황갈 타원 — 바깥 끝이 눈꼬리보다 조금만 넓게 (1d)
const BROWS = { x: 0.034, y: 0.047, rx: 0.017, ry: 0.0115 }; // 눈썹 자리 (콧등과 이어진다)
const NOSE = { y: -0.004, w: 0.0235, h: 0.0115, d: 0.012 }; // 넓고 납작한 코 — 폭 0.047, 위가 평평, 주둥이 끝 위 (사진 코 가운데 (376, 81), 눈 ~ 코 세로 키의 0.034)

// 가슴 말굽: 사진에서 줄마다 잰 주황 칸 [t, 왼쪽 바깥, 왼쪽 안, 오른쪽 안, 오른쪽 바깥] (안쪽 둘이 null 이면 가운데가 이어진 줄).
//  두꺼운 말굽: 두 팔 위 가장자리는 어깨선(t 0.19)에서 가로로 곧고, 바깥선은 아래로 갈수록 벌어져 t 0.24 에서 가장 넓다(0.18).
//  목 아래 가운데에 넓고 둥근 검은 반원(U — 폭 0.08, 곧은 옆 뒤 반지름 0.0385 반원)이 무늬 높이의 약 60 %(t 0.275)까지만 파이고,
//  아래 가장자리는 넓은 곡선(조금 울퉁불퉁)으로 t 0.332 에서 모인다. 무늬 가운데는 몸 가운데보다 0.009 오른쪽(사진 그대로).
//  1b: 사진 6 배 확대에서 윤곽을 다시 따라 그림 · 1c: 파임을 넓은 U 로, 바깥 테두리를 살짝 불규칙하게
const CHEST = [
  [0.19, -0.061, -0.03, 0.05, 0.091], [0.205, -0.069, -0.0295, 0.0495, 0.095], [0.22, -0.075, -0.029, 0.049, 0.097],
  [0.235, -0.079, -0.0285, 0.0485, 0.098], [0.245, -0.081, -0.0272, 0.0472, 0.098], [0.255, -0.082, -0.0229, 0.0429, 0.097],
  [0.262, -0.081, -0.0174, 0.0374, 0.096], [0.268, -0.08, -0.0098, 0.0298, 0.094], [0.272, -0.079, -0.0007, 0.0207, 0.093],
  [0.2745, -0.078, 0.0062, 0.0138, 0.092], [0.276, -0.077, null, null, 0.09], [0.288, -0.069, null, null, 0.08],
  [0.298, -0.06, null, null, 0.069], [0.308, -0.047, null, null, 0.054], [0.318, -0.032, null, null, 0.037],
  [0.326, -0.016, null, null, 0.02], [0.332, -0.002, null, null, 0.007],
];
const CHEST_MID = 0.01;
const CHEST_SPOTS = [[-0.056, 0.276, 0.0045], [-0.031, 0.285, 0.004], [0.042, 0.296, 0.0045], [0.076, 0.267, 0.004]]; // [x, t, 반지름] 아래쪽 검은 점

// ── 기하 도구 ─────────────────────────────────────────────
const ex = (c, e) => Math.sign(c) * Math.abs(c) ** e;
/** 위아래로 쌓은 고리 (고리면 XZ). rings: [Y, 반폭, 반깊이, cx, cz]. e < 1 이면 조금 각지게. 양 끝을 막는다 (띠 모양 고리 — 부드러운 법선) */
function loftY(rings, sides, e = 1) {
  const pos = [];
  const idx = [];
  for (const [y, w, d, cx, cz] of rings) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      pos.push(cx + w * ex(Math.cos(a), e), y, cz + d * ex(Math.sin(a), e));
    }
  }
  close(idx, rings.length, sides, rings[0][0] < rings[rings.length - 1][0]);
  return geo(pos, idx);
}
/** 앞뒤로 쌓은 고리 (고리면 XY). rings: [z, 반폭, 반높이, cx, cy] */
function loftZ(rings, sides, e = 1) {
  const pos = [];
  const idx = [];
  for (const [z, w, h, cx, cy] of rings) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      pos.push(cx + w * ex(Math.cos(a), e), cy + h * ex(Math.sin(a), e), z);
    }
  }
  close(idx, rings.length, sides, false);
  return geo(pos, idx);
}
/** 옆면·양 끝 뚜껑을 바깥을 보게 감는다. up = 고리가 +Y 로 쌓였나 (loftZ 는 +Z 로 쌓여 up=false 와 같은 감김). lastCap=false 면 끝 고리를 열어 둔다 */
function close(idx, n, sides, up, lastCap = true) {
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
    if (up) idx.push(0, i, i + 1);
    else idx.push(0, i + 1, i);
    if (!lastCap) continue;
    if (up) idx.push(last, last + i + 1, last + i);
    else idx.push(last, last + i, last + i + 1);
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

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
/** 꼭짓점마다 색을 다시 칠한다: fn(자리, 법선) → THREE.Color(칠함) | number(밝기 배수) | null(그대로). 경계는 꼭짓점 사이에서 부드럽게 섞인다 */
function paint(g, fn) {
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    _p.fromBufferAttribute(p, i);
    _n.fromBufferAttribute(nr, i);
    const c = fn(_p, _n, col, i);
    if (c == null) continue;
    if (typeof c === 'number') col.setXYZ(i, col.getX(i) * c, col.getY(i) * c, col.getZ(i) * c);
    else col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
/** 털 윤기: 위·앞 하늘을 보는 꼭짓점일수록 서늘한 회색 반사를 조금 더한다 (꼭짓점 색에 굽는다) */
const SKY = new THREE.Vector3(0, 1, 0.6).normalize();
const SHEEN = 0.32; // 털 윤기 세기 (확인표 1111)
function sheen(g, amount = SHEEN) {
  const sh = new THREE.Color(BEAR_COLORS.sheen);
  paint(g, (p, n, col, i) => {
    const k = amount * Math.max(0, n.dot(SKY)) ** 1.6;
    if (k <= 0) return null;
    return new THREE.Color(col.getX(i) + (sh.r - col.getX(i)) * k, col.getY(i) + (sh.g - col.getY(i)) * k, col.getZ(i) + (sh.b - col.getZ(i)) * k);
  });
}
const S = THREE.MathUtils.smoothstep;
/** 광선이 처음 닿는 곳 (곡면에 무늬·눈을 붙일 때) */
function hitOn(mesh, from, dir) {
  return new THREE.Raycaster(from, dir).intersectObject(mesh, false)[0] || null;
}

/** 부드러운 계단 (a > b 도 된다 — THREE.MathUtils.smoothstep 은 a < b 만) */
function ss(x, a, b) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** 앞(+z)이 촘촘한 고리: 고리마다 sides 꼭짓점, 앞쪽 각 간격 × (1 − k), 뒤쪽 × (1 + k) — 눈·주둥이를 깎을 얼굴 앞에 꼭짓점을 모은다 */
function loftFront(rings, sides, k, lastCap = false) {
  const pos = [];
  const idx = [];
  for (const [y, w, d, cx, cz] of rings) {
    for (let i = 0; i < sides; i++) {
      const u = (i / sides) * TAU - Math.PI;
      const a = Math.PI / 2 + u - k * Math.sin(u);
      pos.push(cx + w * Math.cos(a), y, cz + d * Math.sin(a));
    }
  }
  close(idx, rings.length, sides, rings[0][0] < rings[rings.length - 1][0], lastCap);
  return geo(pos, idx);
}
/** BODY 표 사이를 매끈하게 (3 차 에르미트) — 머리 고리를 잘게 나눌 때 [w, d, cz] */
function bodyRing(t) {
  const R = BODY;
  let i = 0;
  while (i < R.length - 2 && t > R[i + 1][0]) i++;
  const p0 = R[Math.max(0, i - 1)];
  const p1 = R[i];
  const p2 = R[i + 1];
  const p3 = R[Math.min(R.length - 1, i + 2)];
  const h = p2[0] - p1[0];
  const u = Math.min(1, Math.max(0, (t - p1[0]) / h));
  const u2 = u * u;
  const u3 = u2 * u;
  const out = [];
  for (let k = 1; k < 4; k++) {
    const m1 = ((p2[k] - p0[k]) / (p2[0] - p0[0] || 1)) * h;
    const m2 = ((p3[k] - p1[k]) / (p3[0] - p1[0] || 1)) * h;
    out.push((2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * m2);
  }
  return out;
}
const HEAD_T = [0, 0.003, 0.007, 0.012, 0.018, 0.025, 0.032, 0.039, ...Array.from({ length: 28 }, (_, i) => 0.044 + i * 0.0045), 0.172, 0.181, 0.19, 0.198, 0.205];
const HEAD_SIDES = 72;
const HEAD_FRONT = 0.55;
/**
 * 얼굴 깎기 (머리 좌표 x, y → 앞으로 미는 거리 d): 주둥이·아래턱 한 덩어리(짧은 원뿔꼴) + 얕은 입선 홈 + 눈자리 파기 + 눈두덩.
 *  r = 주둥이 바닥 타원 기준 거리(0 = 끝, 1 = 바닥 테두리), mouth = 입선 홈 세기
 */
function faceShape(x, y) {
  const N = SNOUT;
  const a = y > N.yc ? N.a : N.a + (N.chinA - N.a) * ss(y, N.yc, N.yc - N.down); // 아래턱 쪽으로 좁아진다 (사진 턱 폭 약 0.07)
  const r = Math.hypot(x / a, (y - N.yc) / (y > N.yc ? N.up : N.down));
  let d = 0;
  if (r < 1) {
    d = N.out * ss(r, 1, N.flat);
    if (y < N.yc) d *= 1 - N.chin * ss(y, N.yc, N.yc - N.down); // 턱 쪽은 덜 나온다
  }
  const ym = MOUTH.y - MOUTH.droop * (x / MOUTH.half) ** 2;
  const mouth = Math.abs(x) < MOUTH.half * 1.08 ? Math.exp(-(((y - ym) / MOUTH.width) ** 2)) * (1 - (x / (MOUTH.half * 1.08)) ** 2) : 0;
  d -= MOUTH.depth * mouth;
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x;
    d -= EYE.socket * Math.exp(-((dx / 0.011) ** 2) - ((y - EYE.y) / 0.008) ** 2); // 쑥 들어간 눈자리
    d += EYE.brow * Math.exp(-((dx / 0.016) ** 2) - ((y - EYE.y - 0.012) / 0.006) ** 2); // 눈 위를 덮는 눈두덩
  }
  return { d, r, mouth };
}
/** 아몬드꼴 눈 조각 (u = 바깥 눈꼬리 쪽, v = 위): 위 눈꺼풀 선은 안쪽이 높고, 바깥 눈꼬리는 droop 만큼 처진다 */
function almond(w, h, droop, side) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.bezierCurveTo(-w * 0.25, h * 0.62, w * 0.2, h * 0.56, w / 2, -droop);
  sh.bezierCurveTo(w * 0.2, -h * 0.44 - droop * 0.5, -w * 0.25, -h * 0.4, -w / 2, 0);
  const g = new THREE.ShapeGeometry(sh, 10);
  if (side < 0) {
    g.scale(-1, 1, 1); // 거울: 오른눈은 바깥이 −x
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  }
  return g;
}

const FUR = { vary: 0, noise: 0 };
const TURN = new THREE.Matrix4().compose(new THREE.Vector3(...HEAD_CENTER), new THREE.Quaternion().setFromEuler(new THREE.Euler(HEAD_TURN.pitch, HEAD_TURN.yaw, HEAD_TURN.roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
const TURN_INV = TURN.clone().invert();

// ── 조형 ────────────────────────────────────────────────
function sculpt(kit) {
  const C = BEAR_COLORS;
  const put = (g, color = C.fur, m = null, opt = FUR) => {
    const out = kit.putM('bear', g, color, m || new THREE.Matrix4(), opt);
    g.dispose();
    return out;
  };
  // 머리·목·몸통 한 고리 (정수리 ~ 가랑이) — 얼굴을 깎고 칠한 것까지 head() 가 짓는다. 가슴 무늬를 붙이려고 광선용 사본을 받는다
  const { mesh: body, local: bodyMesh } = headAndBody(kit);
  // 팔이 덮는 몸통 옆면(t 0.27~0.64)은 그늘 — 검은 털에서 팔이 몸과 갈라져 읽히게
  paint(body, (p, n) => {
    const t = 1 - p.y;
    const k = 0.4 * S(Math.abs(p.x), 0.085, 0.122) * S(n.x * Math.sign(p.x), 0.25, 0.8) * S(t, 0.25, 0.3) * (1 - S(t, 0.6, 0.66));
    return k > 0 ? 1 - k : null;
  });
  const fur = [];
  for (const side of [-1, 1]) {
    fur.push(put(loftY(mirror(side, THIGH), 18)));
    // 발: 발목 아래에서 앞으로 (발끝 살짝 안쪽)
    const fm = new THREE.Matrix4().compose(new THREE.Vector3(side * 0.129, 0, -0.004), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * FOOT_TOE_IN), new THREE.Vector3(1, 1, 1));
    sheen(put(loftZ(FOOT.map(([z, w, h, y]) => [z, w, h, 0, y]), 16, 0.9), C.fur, fm), SHEEN * 0.35); // 발등은 윤기를 덜 (사진 발은 검다)
    const limb = put(loftY(mirror(side, ARM), 18));
    paint(limb, (p, n) => 1 - 0.34 * S(-n.x * side, 0.15, 0.7)); // 몸 쪽을 보는 팔 안쪽은 그늘
    fur.push(limb);
    claws(kit, side);
  }
  chestPatch(kit, bodyMesh);
  for (const g of fur) sheen(g);
  faceParts(kit, bodyMesh);
  bodyMesh.geometry.dispose();
  bodyMesh.material.dispose();
}

/** 발톱 다섯: 앞발 덩어리 끝 안쪽·앞에 모여 아래로 내려가다 몸 쪽·뒤로 휜 긴 갈고리 (사진: 발 안쪽 아래에서 나와 t 0.66~0.68 까지) */
function claws(kit, side) {
  const [, pcx, , pd, pcz] = ARM[PAW_TIP - 1];
  for (let k = 0; k < CLAW.count; k++) {
    const u = k / (CLAW.count - 1); // 0 = 바깥 → 1 = 몸 쪽
    const off = -0.016 + u * CLAW.spread; // + = 몸 쪽
    const x0 = side * (pcx - off);
    const y0 = tY(CLAW.baseT) + (u - 0.55) ** 2 * 0.014;
    const z0 = pcz + pd * 0.5 - Math.abs(u - 0.55) * 0.012;
    const L = CLAW.drop * (0.82 + 0.25 * (1 - Math.abs(u - 0.6) * 1.6));
    const curl = CLAW.inward * (0.6 + 0.6 * (1 - u)); // 바깥 발톱일수록 몸 쪽으로 더 휜다
    const pts = [[x0, y0, z0], [x0 - side * curl * 0.15, y0 - L * 0.32, z0 + 0.007], [x0 - side * curl * 0.5, y0 - L * 0.68, z0 + 0.005], [x0 - side * curl, y0 - L, z0 - 0.003]];
    const r = [CLAW.rBase, CLAW.rBase * 0.74, CLAW.rBase * 0.46, CLAW.rTip];
    for (let i = 0; i < 3; i++) {
      const A = new THREE.Vector3(...pts[i]);
      const B = new THREE.Vector3(...pts[i + 1]);
      const dir = B.clone().sub(A);
      const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
      const g = new THREE.CylinderGeometry(r[i + 1], r[i], dir.length(), 7, 1, false);
      kit.putM('bear', g, BEAR_COLORS.claw, m, { vary: 0.03, noise: 0 });
      g.dispose();
    }
  }
}

/** 가슴 말굽: 줄마다 잰 칸을 왼쪽·오른쪽 반 띠 격자로 이어 몸 겉면에 살짝 띄워 붙인다 (위 짙은 주황 → 아래 크림) */
function chestPatch(kit, bodyMesh) {
  const N = 6; // 반 띠마다 가로 나눔
  const lift = 0.003;
  const top = new THREE.Color(BEAR_COLORS.chestTop);
  const bot = new THREE.Color(BEAR_COLORS.chestBottom);
  const pos = [];
  const cols = [];
  const idx = [];
  const halves = (row) => (row[2] == null ? [[row[1], CHEST_MID], [CHEST_MID, row[4]]] : [[row[1], row[2]], [row[3], row[4]]]);
  const per = 2 * (N + 1);
  const from = new THREE.Vector3();
  const back = new THREE.Vector3(0, 0, -1);
  CHEST.forEach((row, j) => {
    // 아래 가장자리는 조금 울퉁불퉁 (사진 털 끝)
    const wob = (x) => (row[2] == null ? 0.0025 * Math.sin(x * 140 + j) : 0);
    const edge = (x) => 0.0018 * Math.sin(j * 2.3 + x * 90); // 바깥 테두리 살짝 불규칙
    for (const [h0, [a, b]] of halves(row).entries()) {
      for (let i = 0; i <= N; i++) {
        const outer = (h0 === 0 && i === 0) || (h0 === 1 && i === N);
        const x = a + ((b - a) * i) / N + (outer ? edge(a + b) * (h0 ? 1 : -1) : 0);
        const t = row[0] + (i === 0 || i === N ? wob(x) : 0);
        from.set(x, tY(t), 1);
        const hit = hitOn(bodyMesh, from, back);
        const z = hit ? hit.point.z : 0.11;
        const fn = hit ? hit.face.normal : new THREE.Vector3(0, 0, 1);
        pos.push(x + fn.x * lift, tY(t) + fn.y * lift, z + fn.z * lift);
        const c = top.clone().lerp(bot, S(t, 0.24, 0.334)); // 아래쪽으로 크림빛
        cols.push(c.r, c.g, c.b);
      }
    }
    if (j === 0) return;
    for (let h = 0; h < 2; h++) {
      for (let i = 0; i < N; i++) {
        const a = (j - 1) * per + h * (N + 1) + i;
        const b = j * per + h * (N + 1) + i;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals(); // 무늬 띠 안에서 부드럽게 (몸 겉면과 거의 같은 법선)
  const out = kit.putM('bear', g, 0xffffff, new THREE.Matrix4(), { vary: 0, noise: 0 });
  // Kit 이 칠한 흰색 위에 줄 높이별 색을 얹는다 (꼭짓점이 펼쳐진 순서대로)
  const order = g.index.array;
  const c = out.attributes.color;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, cols[order[i] * 3], cols[order[i] * 3 + 1], cols[order[i] * 3 + 2]);
  g.dispose();
  for (const [x, t, r] of CHEST_SPOTS) {
    const hit = hitOn(bodyMesh, from.set(x, tY(t), 1), back);
    const z = (hit ? hit.point.z : 0.11) + lift + 0.0014;
    const s = new THREE.CircleGeometry(r, 10);
    kit.putM('bear', s, BEAR_COLORS.chestSpot, new THREE.Matrix4().makeTranslation(x, tY(t), z), { vary: 0.04, noise: 0 });
    s.dispose();
  }
}

/** 머리·목·몸통 한 고리(앞쪽 촘촘): 머리 좌표 앞으로 밀어 주둥이·아래턱·눈자리를 깎고, 꼭짓점 색 그러데이션으로 얼굴 황갈을 칠한다.
 *  머리통은 돌리지 않고 얼굴 쪽 깎기·칠·조각만 고개 돌림(TURN)을 따른다 */
function headAndBody(kit) {
  const C = BEAR_COLORS;
  // 머리는 잘게(HEAD_T), 그 아래 몸통은 BODY 표 고리 그대로 — 고리 하나라 목에 이음매가 없다
  const rings = [...HEAD_T.map((t) => [t, ...bodyRing(t)]), ...BODY.filter(([t]) => t > HEAD_T[HEAD_T.length - 1])].map(([t, w, d, cz]) => [tY(t), w, d, HEAD_SHIFT * (1 - S(t, 0.13, 0.19)), cz]);
  const g = loftFront(rings, HEAD_SIDES, HEAD_FRONT, true);
  const P = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    // 머리통도 고개를 따라 돈다: 머리 가운데를 지나는 세로축으로 고개 돌림만큼 비틀고 목(t 0.12 ~ 0.2)에서 0 으로 — 돌아간 쪽 볼의 검정이 가장자리에 남게 (1d)
    const tw = HEAD_TURN.yaw * (1 - S(1 - v.y, 0.12, 0.2));
    if (tw) {
      const dx = v.x - HEAD_CENTER[0];
      const dz = v.z - HEAD_CENTER[2];
      v.x = HEAD_CENTER[0] + dx * Math.cos(tw) + dz * Math.sin(tw);
      v.z = HEAD_CENTER[2] - dx * Math.sin(tw) + dz * Math.cos(tw);
    }
    v.applyMatrix4(TURN_INV);
    if (v.z > 0) {
      const f = faceShape(v.x, v.y);
      v.z += f.d * S(v.z, 0, 0.04);
    }
    v.applyMatrix4(TURN);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const local = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); // 광선용 (몸 좌표)
  const headMesh = kit.putM('bear', g, C.fur, new THREE.Matrix4(), FUR);
  g.dispose();
  // 얼굴 색: 털(하늘 윤기) → 황갈 그러데이션. 주둥이 끝이 가장 밝고, 콧등을 따라 두 눈 사이로 옅어지며, 두 눈을 감싸는 '안경'과 눈썹 자리의
  //  옅은 황갈이 이마 검정으로 부드럽게 녹아든다. 입선 홈·위 눈꺼풀 아래는 조금 어둡게
  const fur = new THREE.Color(C.fur);
  const shine = new THREE.Color(C.sheen);
  const tip = new THREE.Color(C.muzzleTip);
  const muz = new THREE.Color(C.muzzle);
  const brow = new THREE.Color(C.brow);
  const hp = new THREE.Vector3();
  const hn = new THREE.Vector3();
  paint(headMesh, (p, n) => {
    const furC = fur.clone().lerp(shine, SHEEN * Math.max(0, n.dot(SKY)) ** 1.6);
    hp.copy(p).applyMatrix4(TURN_INV);
    hn.copy(n).transformDirection(TURN_INV);
    if (hp.z < 0.01) return furC;
    const f = faceShape(hp.x, hp.y);
    let te = 0;
    let tb = 0;
    let lid = 0;
    for (const side of [-1, 1]) {
      const dx = hp.x - side * EYE.x;
      const dy = hp.y - EYE.y;
      te = Math.max(te, ss(Math.hypot((hp.x - side * SPECS.x) / SPECS.rx, dy / SPECS.ry), 1.22, 0.72));
      tb = Math.max(tb, ss(Math.hypot((hp.x - side * BROWS.x) / BROWS.rx, (hp.y - BROWS.y) / BROWS.ry), 1.25, 0.6));
      lid = Math.max(lid, Math.exp(-((dx / 0.0135) ** 2)) * ss(dy, 0.004, 0.0085) * ss(dy, 0.016, 0.0105)); // 윗눈꺼풀 위 그늘
    }
    const bw = 0.026 + 0.012 * ss(hp.y, 0.03, 0.048); // 콧등은 위로 갈수록 넓어져 눈썹 자리와 이어진다
    const bridge = ss(Math.abs(hp.x), bw, bw * 0.5) * ss(hp.y, 0.062, 0.048) * ss(hp.y, SNOUT.yc - 0.01, SNOUT.yc + 0.01); // 콧등이 두 눈 사이로 눈썹 높이까지
    const T = Math.max(ss(f.r, 1.08, 0.84), te, bridge, tb) * ss(hp.y, 0.068, 0.055) * ss(hn.z, -0.25, 0.2) * ss(Math.abs(hp.x), 0.067, 0.051); // 볼·관자놀이는 검정 (경계는 넓게 부드럽게)
    const c = brow.clone().lerp(muz, ss(f.r, 0.98, 0.6) * ss(hn.y, 0.35, -0.1)).lerp(tip, ss(f.r, 0.55, 0.12)); // 주둥이 옆은 황갈, 콧등·윗면은 옅게, 끝이 가장 밝게
    c.multiplyScalar(1 - 0.8 * f.mouth);
    const out = furC.lerp(c, T);
    return out.multiplyScalar(1 - 0.45 * lid);
  });
  return { mesh: headMesh, local };
}

/** 얼굴 조각: 코(콧구멍)·눈(테·눈동자·반사점)·귀 — 머리 좌표에서 붙이고 고개 돌림(TURN)을 얹는다 */
function faceParts(kit, bodyMesh) {
  const C = BEAR_COLORS;
  const headLocal = new THREE.Mesh(bodyMesh.geometry.clone().applyMatrix4(TURN_INV), bodyMesh.material); // 광선용 (머리 좌표)
  const start = kit.bins.bear.length;
  const plain = { vary: 0, noise: 0 };
  const back = new THREE.Vector3(0, 0, -1);
  const onHead = (x, y) => hitOn(headLocal, new THREE.Vector3(x, y, 0.5), back);
  // 큰 코: 주둥이 끝 위에 얹힌 넓고 납작한 코 (윗면은 조금 밝게)
  {
    const hit = onHead(0, NOSE.y);
    const at = hit ? hit.point : new THREE.Vector3(0, NOSE.y, 0.14);
    // 넓고 납작한 코: 둥근 네모 단면(위가 평평)을 앞뒤로 쌓은 덩어리, 코끝이 조금 아래로
    const nose = loftZ([
      [-0.012, NOSE.w * 0.86, NOSE.h * 0.9, 0, 0], [-0.004, NOSE.w, NOSE.h, 0, 0.0004], [0.004, NOSE.w * 0.97, NOSE.h * 0.96, 0, 0.0004],
      [0.009, NOSE.w * 0.82, NOSE.h * 0.74, 0, -0.0004], [0.012, NOSE.w * 0.45, NOSE.h * 0.38, 0, -0.001],
    ], 20, 0.55);
    const noseM = new THREE.Matrix4().compose(at.clone().add(new THREE.Vector3(0, 0.001, -0.004)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)), new THREE.Vector3(1, 1, 1));
    const out = kit.putM('bear', nose, C.nose, noseM, plain);
    paint(out, (q, n) => 1 + 0.32 * Math.max(0, n.y) - 0.22 * Math.max(0, -n.y));
    const noseLocal = new THREE.Mesh(nose.clone().applyMatrix4(noseM), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    nose.dispose();
    for (const side of [-1, 1]) {
      // 콧구멍 둘: 코 앞면 아래쪽에 또렷한 짙은 쉼표꼴
      const hitN = hitOn(noseLocal, new THREE.Vector3(side * NOSE.w * 0.45, NOSE.y - NOSE.h * 0.3, 0.5), back);
      if (!hitN) continue;
      const nz = hitN.face.normal.clone().normalize();
      const nx = new THREE.Vector3(1, 0, 0).addScaledVector(nz, -nz.x).normalize();
      const nb = new THREE.Matrix4().makeBasis(nx, new THREE.Vector3().crossVectors(nz, nx), nz);
      const nm = new THREE.Matrix4().makeTranslation(hitN.point.x, hitN.point.y, hitN.point.z).multiply(nb).multiply(new THREE.Matrix4().makeRotationZ(side * 0.45)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0006));
      const nostril = new THREE.CircleGeometry(1, 12).scale(NOSE.w * 0.34, NOSE.h * 0.4, 1);
      kit.putM('bear', nostril, C.nostril, nm, plain);
      nostril.dispose();
    }
    noseLocal.geometry.dispose();
    noseLocal.material.dispose();
  }
  for (const side of [-1, 1]) {
    // 눈: 눈자리 겉면에 붙인 아몬드꼴 세 겹 — 얇은 짙은 테 · 짙은 갈색 눈동자 · 아주 작은 반사점
    const hit = onHead(side * EYE.x, EYE.y);
    if (hit) {
      const z = hit.face.normal.clone().normalize();
      const x = new THREE.Vector3(1, 0, 0).addScaledVector(z, -z.x).normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      const basis = new THREE.Matrix4().makeBasis(x, y, z);
      const tilt = new THREE.Matrix4().makeRotationZ(-side * EYE.tilt); // 바깥 눈꼬리 쪽이 조금 내려가게
      const layer = (geom, color, lift, ox = 0, oy = 0) => {
        const m = new THREE.Matrix4().makeTranslation(hit.point.x, hit.point.y, hit.point.z).multiply(basis).multiply(tilt).multiply(new THREE.Matrix4().makeTranslation(ox, oy, lift));
        kit.putM('bear', geom, color, m, plain);
        geom.dispose();
      };
      layer(almond(EYE.w * EYE.rim, EYE.h * 1.5, EYE.droop * 1.3, side), C.eyeRim, 0.0006, 0, EYE.h * EYE.lid); // 테 — 위로 올려 윗눈꺼풀 선이 굵다
      layer(almond(EYE.w, EYE.h, EYE.droop, side), C.eye, 0.0012);
      layer(new THREE.CircleGeometry(1, 14).scale(EYE.h * EYE.pupil, EYE.h * EYE.pupil * 1.05, 1), C.eyeRim, 0.0015, -side * EYE.w * 0.04, EYE.h * 0.02); // 동공
      layer(new THREE.CircleGeometry(EYE.shine, 10), C.eyeShine, 0.0019, -side * EYE.w * 0.1, EYE.h * 0.2);
    }
    // 귀: 작고 납작한 컵 (앞·바깥을 보게, 정수리 양옆 위) — 납작한 원판 + 앞면 가운데 컵 안쪽을 어둡게
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, side * 0.42, side * -0.5, 'YXZ'));
    const ear = new THREE.SphereGeometry(1, 14, 10);
    sheen(kit.putM('bear', ear, C.fur, new THREE.Matrix4().compose(new THREE.Vector3(side * EAR.x, EAR.y, EAR.z), q, new THREE.Vector3(EAR.r, EAR.r * 1.06, EAR.thick)), FUR));
    ear.dispose();
    const inner = new THREE.CircleGeometry(EAR.r * 0.68, 14);
    const im = new THREE.Matrix4().compose(new THREE.Vector3(side * EAR.x, EAR.y, EAR.z).add(new THREE.Vector3(0, -EAR.r * 0.06, EAR.thick * 0.93).applyQuaternion(q)), q, new THREE.Vector3(1, 1.06, 1));
    kit.putM('bear', inner, C.earIn, im, plain);
    inner.dispose();
  }
  headLocal.geometry.dispose();
  for (const gg of kit.bins.bear.slice(start)) gg.applyMatrix4(TURN);
}

/** 받침: 낮은 팔각기둥 + 윗면 가장자리·옆 아래 이끼 (m 단위, 곰과 따로 — 평면 음영 돌) */
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
    // 이끼: 삼각형마다 (평면 음영 돌 결)
    const p = out.attributes.position;
    const col = out.attributes.color;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const m = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      const r = Math.hypot(m.x, m.z) / P.radius;
      const patch = (Math.sin(m.x * 9.1 + m.z * 5.3) * Math.cos(m.z * 7.7 - m.x * 3.1) + 1) / 2;
      const up = n.y > 0.6 ? S(r, 0.55, 0.9) * (0.45 + patch * 0.6) : 0;
      const low = n.y < 0.6 ? (1 - S(m.y, 0.02, 0.2)) * 0.7 * patch : 0;
      if (Math.min(1, Math.max(up, low)) < 0.35) continue;
      const k = 0.85 + patch * 0.3;
      for (let j = i; j < i + 3; j++) col.setXYZ(j, moss.r * k, moss.g * k, moss.b * k);
    }
    g.dispose();
  }
}

/** 석상 겉모습 + 충돌체 꼴. 충돌체는 부르는 쪽(arena_obstacle.js)이 shapes 로 만든다 */
export function buildSluiceBear(scene, { position = SLUICE_BEAR_POSITION, rotationY = SLUICE_BEAR_ROTATION_Y, height = BEAR_HEIGHT } = {}) {
  const kit = new Kit(64371);
  sculpt(kit);
  for (const g of kit.bins.bear) g.scale(height, height, height).translate(0, BEAR_PLINTH.height, 0);
  plinth(kit);
  // 칠한 석상: 부드러운 법선(짧고 윤기 나는 털) · 털 윤기는 꼭짓점 색에 굽고, 해 빛에 은은한 반사가 생기게 거칠기를 조금 낮춘다 (확인표 1111)
  const bearMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 });
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
 *  받침 원기둥 반지름은 팔각 꼭짓점(0.86)과 면(0.79) 사이 0.82. 캡슐 halfHeight 는 양 끝 반구를 뺀 반 길이. 가는 귀·발톱·주둥이에는 두지 않는다
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
  const shapes = [Object.freeze({ name: 'bear-plinth', type: 'cylinder', radius: BEAR_PLINTH.radius * 0.955, halfHeight: P / 2, center: Object.freeze(world([0, P / 2, 0])) })];
  for (const side of [-1, 1]) shapes.push(capsule(`bear-leg-${side < 0 ? 'right' : 'left'}`, at(side * 0.124, 0.955, 0.0), at(side * 0.09, 0.79, 0.004), 0.058));
  shapes.push(capsule('bear-torso', at(0, 0.7, 0.006), at(0, 0.3, 0.006), 0.125));
  for (const side of [-1, 1]) shapes.push(capsule(`bear-arm-${side < 0 ? 'right' : 'left'}`, at(side * 0.148, 0.61, 0.045), at(side * 0.1, 0.29, 0.015), 0.042));
  shapes.push(capsule('bear-head', at(0, 0.11, 0.05), at(0, 0.04, 0.03), 0.088));
  return Object.freeze(shapes);
}

export const BEAR_OBSTACLE_SHAPES = bearObstacleShapes();
