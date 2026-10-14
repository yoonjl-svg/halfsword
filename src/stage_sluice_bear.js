// ─────────────────────────────────────────────────────────────
//  잠든 습지(sluice) 가운데 말레이곰 석상 — 사장님이 주신 정면 사진(두 발로 선 말레이곰)의 비율·무늬·얼굴을 재어 다시 조형했다.
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/stage_sluice_bear.js 를 옮겨 고침 (짓는 틀·충돌체 꼴만 이어받고 몸은 새로 깎음).
//   사진 파일·사진 질감은 쓰지 않는다 — 아래 표의 수치는 사진을 눈대중·픽셀로 잰 비율이다 (docs/import/sluice_port_2026-10-14.md §1 · §6).
//   표의 단위: 곰 키(정수리 ~ 발바닥) = 1. t = 정수리에서 내려온 거리(사진에서 잰 그대로), 높이 Y = 1 − t.
//   x + = 곰 자신의 왼쪽(사진의 오른쪽), z + = 곰이 보는 앞. 놓을 때 −X(시작 카메라 쪽)를 보게 돌린다.
//   옆모습(주둥이 길이·목 숙임·가슴 두께·배)은 사진에 없어 말레이곰 해부 상식으로 채운 추정이다.
//   1b(감독 검수 10/14): 머리·목·몸통을 고리 하나로 이어 이음매를 없애고, 얼굴 무늬를 좌우 대칭으로, 넓적한 주둥이·큰 코·처진 입선,
//   정수리 양옆 위 납작한 컵 귀, 위가 곧고 넓은 가슴 말굽, 손목에서 꺾인 앞발 덩어리, 부드러운 법선(짧고 윤기 나는 털)으로 고쳤다.
//   1c(감독 검수 · 사장님 10/14 03:5x '눈과 눈 주위가 중요'): 주둥이를 머리 고리에서 뽑아낸 한 덩어리(아래턱까지)로, 얼굴 황갈을 꼭짓점
//   그러데이션으로(날카로운 테두리 없음), 눈을 작은 아몬드꼴·바깥 눈꼬리 처짐·쑥 들어간 눈두덩·짙은 테·반사점으로, 가슴 파임을 넓은 U 로 고쳤다.
//   1d(감독 검수): 황갈 판을 주둥이·두 눈 바로 둘레·눈 위로 좁히고(볼·관자놀이 검정), 눈 1.3 배·윗눈꺼풀 짙은 선, 주둥이 15 % 짧고 넓게, 넓고 납작한 코.
//   1e(감독 검수): 갈색 홍채·더 짙은 동공·옅은 눈 둘레(구슬 눈 → 부드러운 눈), 아래눈꺼풀 선은 아주 옅게, 이마 황갈 경계를 콧등 위가 가장 높은
//   둥근 아치로(부드럽게), 아래턱 20 % 짧게·입선을 코 쪽으로, 머리통 위쪽을 넓고 평평하게·귀를 조금 위로.
//   2(사장님 10/14 08:3x '정수리가 움푹 들어가야 저 곰의 특징이 나와. 색은 회색조 투톤 명암과 음각 양각 등으로 표현해서 오래된 실제
//   석상처럼'): 정수리 가운데를 사진에서 잰 만큼 꺼뜨리고 앞뒤로 얕은 골(CROWN), 칠한 색 → 회색조 두 톤 돌(검은 털 자리 짙은 돌 · 황갈·주황
//   자리 밝은 돌), 가슴 말굽은 양각 판 + 둘레 음각 홈(RELIEF), 얼굴 무늬 경계는 얕은 단(FACE_STEP), 털은 드문 끌 자국(CHISEL), 눈은 돌 조각
//   (음각 윗눈꺼풀 선 · 드릴로 판 눈동자), 오래된 돌(때 · 씻겨 바램 · 닳음 · 이끼 · 지의류 · 작은 깨짐 — WEATHER). 키 3.2 m (사장님 10/14 10:3x).
//   2b(사장님 10/14 12:2x '얼굴 영역의 밝은 테두리가 이마 쪽에서 거의 직선으로 연결돼 있어. 실제 사진은 약간 밑으로 들어가는 곡선임' · 감독 검수 '가면 쓴
//   원숭이처럼 보인다' · 12:3x '투톤 중 어두운 영역이 돌이나 바위 색처럼 안 느껴져. 너무 검달까?'): 이마 경계를 두 눈썹 자리 위가 높고 콧등 위 가운데가
//   처지는 곡선(BROW_TOP)으로, 볼 바깥 경계를 사진 곡선(CHEEK_LINE)으로, 얼굴 판 단을 낮추고 둥근 비탈(FACE_STEP · FACE_BEVEL)로, 짙은 돌을 중간 회색으로
//   밝히고 아주 작은 돌 결(MOTTLE.amp3)을 더했다. 눈·눈 둘레·주둥이·가슴 말굽·키·충돌체는 그대로.
//   2c(사장님 10/14 13:3x '곰 석상에서 검은색으로 표시되는 영역 때문인지, 자연 속에 방치된 석상이 아니라 현대의 모형 피규어 같아 보여. 모양은 지키되
//   개선해봐'): 검게 칠한 듯한 곳(눈동자·윗눈꺼풀 선·콧구멍·가슴 홈·드릴 점·귀 안)을 판 자리의 그늘로 — 가장 깊은 그늘도 짙은 돌 선형 밝기의 절반(DEEP),
//   때도 검정 대신 젖은 녹회색(grime). 습지에 오래 버려진 돌: 위를 보는 면의 이끼(MOSS_UP) · 튀어나온 곳 아래 옅은 녹회색 빗물 자국(STREAKS) ·
//   지의류 딱지(LICHEN_BEAR) · 큰 덩어리 돌 빛깔 얼룩(STONE_TINT) · 귀 테두리·주먹·받침 모서리 닳음과 작은 깨짐 · 아래쪽 젖은 띠와 발등 진흙 튐(WET) ·
//   받침 둘레 풀 몇 포기 · 무광(거칠기 1). 실루엣·비율·얼굴 생김·정수리 꺼짐·이마 곡선·키·충돌체는 그대로.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, h3 } from './stage_kit.js';

/** 곰 키(m, 정수리 ~ 발바닥, 받침 빼고). 사장님 10/14 10:3x '곰 석상은 3.2m로 넣어' (03:0x '약 3 m' 승인 뒤 — 확인표 1110 → 1250) */
export const BEAR_HEIGHT = 3.2;
/** 이끼 낀 돌 받침 (낮은 팔각기둥): 높이·바깥 반지름(m) (확인표 1112) */
export const BEAR_PLINTH = Object.freeze({ height: 0.35, radius: 0.86 });
export const SLUICE_BEAR_POSITION = Object.freeze([0, 0, 0]); // 결투장 한가운데 (사장님 10/14 02:3x)
export const SLUICE_BEAR_ROTATION_Y = -Math.PI / 2; // 모델 앞(+Z) → 세상 −X (판 시작 카메라 쪽을 본다)
/** AI 돌아가기·카메라가 쓰는 석상 반지름(m): 받침 바깥 반지름 + 0.04 (확인표 1113 — 받침에 묶여 키 3.2 m 에도 그대로) */
export const BEAR_AVOID_RADIUS = BEAR_PLINTH.radius + 0.04;

// 색: 오래된 돌 석상, 회색조 두 톤 (곰 2 — 사장님 10/14 08:3x '회색조 투톤 명암', 확인표 1241 · 곰 2b 짙은 돌 1283). 사진의 검은 털 자리 = 짙은 회색 돌,
//  황갈·주황 자리(주둥이·눈 둘레 '안경'·눈썹 자리·가슴 말굽)와 발톱 = 밝은 회색 돌. 순검정·순백 없이 돌빛 회색만 (때·그늘도 짙은 회색).
//  곰 2b: 짙은 돌·밝은 돌 밝기(선형) 비 4.16 → 2.30 (경기 화면 같은 카메라에서 가슴 판 ÷ 몸통 4.62 → 2.65)
//  곰 2c: 칠한 듯한 검정(눈동자 0x1f2122 · 윗눈꺼풀 선 0x26292a · 콧구멍 0x242627 · 귀 안 0x2e3132 · 때 0x2c2f30)을 걷었다 — 판 자리는 그 자리 돌빛 → DEEP 쪽 섞음(EYE_CARVE ·
//   SOFT_PIT)으로, 때는 젖은 녹회색으로. 두 톤(짙은 돌 · 밝은 돌)은 그대로
export const BEAR_COLORS = Object.freeze({
  dark: 0x787873, // 짙은 회색 돌 — 검은 털 자리. 곰 2b(사장님 10/14 12:3x '어두운 영역이 돌이나 바위 색처럼 안 느껴져. 너무 검달까?'): 0x575b5e(서늘한 숯빛) → 조금 따뜻한 중간 회색
  light: 0xb3afa5, // 밝은 회색 돌 — 황갈·주황 자리 · 발톱 (아주 조금 따뜻한 회색)
  lightTip: 0xc0bcb2, // 주둥이 끝 — 닳아 가장 밝은 돌
  bleach: 0xcbc8bf, // 비에 씻겨 바랜 윗면 쪽으로 섞는 빛
  grime: 0x4a4e44, // 오목한 곳의 때 (겨드랑이·가랑이·홈·아랫면) — 곰 2c(확인표 1294): 0x2c2f30(거의 검정) → 젖은 이끼 그늘빛 짙은 녹회색 (섞음 한도 0.85 에서도 짙은 돌 선형 밝기의 약 48 %)
  worn: 0x9a988f, // 짙은 돌의 튀어나온 곳이 닳은 빛 (코끝·주먹·발가락·귀 테두리) — 곰 2b: 0x8a8d8b → 짙은 돌을 따라 밝고 따뜻하게
  wornLight: 0xc6c3ba, // 밝은 돌의 튀어나온 곳이 닳은 빛 (눈썹뼈 · 눈 바로 둘레)
  chip: 0x9c9e9a, // 깨진 자리 — 새로 드러난 돌 속
  nose: 0x898881, // 코 — 곰 2c(확인표 1291): 0x7b7b76 → 주둥이와 같은 돌에서 조금 짙게 (짙은 돌 3 : 밝은 돌 1, 선형)
  moss: 0x58733f, // 발 둘레 이끼 (꼭짓점 색 — 받침 이끼와 같은 빛)
  mossDeep: 0x4a6833, // 위를 보는 면 이끼 — 두툼한 가운데 (곰 2c)
  mossLit: 0x768f45, // 위를 보는 면 이끼 — 얇은 가장자리·햇빛 (곰 2c)
  streak: 0x9ca391, // 옅은 녹회색 빗물 자국 (곰 2c)
  mud: 0x5d5140, // 발등 진흙 튐 (곰 2c)
  stone: 0x7c8077, // 받침 돌
  plinthMoss: 0x58733f, // 받침 이끼
  lichen: 0xa8ac8d, // 지의류 (옅은 회녹색)
  lichenWarm: 0xb7aa78, // 지의류 (옅은 누런빛, 하나 둘만)
  grass: 0x6a7a44, // 받침 둘레 풀 (곰 2c)
});
/** 가장 깊은 그늘 (곰 2c · 확인표 1290): 짙은 돌 × DEEP (선형) — 눈동자 바닥 · 콧구멍 · 귀 컵 바닥도 이보다 어둡지 않다 (순검정 없음) */
const DEEP = 0.5;

const TAU = Math.PI * 2;

// ── 사진에서 잰 몸 (정면 폭은 사진, 깊이 d·앞뒤 cz 는 추정) ─────────────────────────────
// 머리·목·몸통을 고리 하나로 [t, 반폭 w, 반깊이 d, 앞뒤 cz]: 넓고 조금 평평한 정수리(1e — 관자놀이 쪽을 약 10 % 넓힘) → 볼(가장 넓은 곳, 머리 폭 0.192 — 어깨보다 확실히 좁게)
//  → 굵은 목이 이음매 없이 비스듬한 어깨로 흘러내림 → 옆선이 거의 곧은 긴 몸통 → 아랫배 살짝 불룩 → 엉덩이가 가장 넓다(0.31) → 가랑이(t 0.817)
const BODY = [
  [0, 0.006, 0.005, 0.022], [0.004, 0.04, 0.031, 0.023], [0.011, 0.062, 0.05, 0.025], [0.022, 0.078, 0.063, 0.027],
  [0.037, 0.089, 0.073, 0.029], [0.057, 0.095, 0.08, 0.03], [0.08, 0.096, 0.082, 0.03], [0.106, 0.095, 0.082, 0.027],
  [0.13, 0.099, 0.084, 0.021], [0.152, 0.105, 0.089, 0.013], [0.178, 0.113, 0.096, 0.009], [0.205, 0.119, 0.103, 0.0075],
  [0.24, 0.124, 0.109, 0.0075], [0.29, 0.128, 0.113, 0.007], [0.35, 0.129, 0.114, 0.006], [0.42, 0.128, 0.1115, 0.0055],
  [0.5, 0.125, 0.11, 0.0075], [0.57, 0.122, 0.112, 0.011], [0.63, 0.123, 0.117, 0.015], [0.68, 0.131, 0.12, 0.012],
  [0.73, 0.146, 0.122, 0], [0.78, 0.153, 0.116, -0.01], [0.8, 0.148, 0.106, -0.014], [0.811, 0.1, 0.08, -0.016], [0.817, 0.04, 0.038, -0.016],
];
// 다리 [t, 가운데 cx, 반폭, 반깊이, cz] (한쪽, 거울로 다른 쪽) — 짧고 굵고 살짝 O자. 두 허벅지 안쪽 선이 가랑이 꼭대기(t 0.817)에서 만나
//  둥근 아치로 벌어진다 (사진: t 0.83 ±0.01 · 0.86 ±0.055 · 0.89 ±0.09) · 무릎 t 0.89 · 두 발 가운데 사이 0.258
//  (감독 메모 0.21 은 사진에서 두 발 안쪽 틈 0.20 과 맞는다)
const THIGH = [
  // 곰 2: 엉덩이 속 위 두 줄(t 0.72 · 0.78)을 조금 안으로 — 엉덩이 겉면과 1 mm 안팎으로 겹쳐 들쭉날쭉 비치던 이음매 (보이는 꼴은 그대로)
  [0.72, 0.066, 0.064, 0.082, 0], [0.78, 0.07, 0.077, 0.09, 0.004], [0.805, 0.0745, 0.0825, 0.09, 0.007], [0.82, 0.0805, 0.0765, 0.087, 0.009],
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
const CLAW = { count: 5, baseT: 0.624, spread: 0.05, inward: 0.011, drop: 0.049, rBase: 0.0074, rTip: 0.0015 }; // 곰 2c: 끝 0.0009 → 0.0015 (닳아 무딘 끝)
const BROKEN_CLAW = { side: -1, k: 1 }; // 곰 오른 앞발 둘째 발톱은 끝이 부러졌다 (작은 깨짐 — 확인표 1246)

// 머리 (머리 가운데 기준 머리 좌표, 앞 +z). 사진: 눈 t 0.053 · 코 가운데 0.085 · 입 0.12 · 턱 0.147, 코 폭 0.039
const HEAD_SHIFT = 0.012; // 사진의 머리(두 귀 가운데)는 몸 가운데보다 키의 0.012 오른쪽 — 머리 고리를 그만큼 옮기고 목에서 0 으로 잇는다
const HEAD_CENTER = [HEAD_SHIFT, 0.921, 0.03]; // 몸 좌표 (Y = 1 − t)
// 고개: 곰 왼쪽으로 조금 돌림(감독 측정: 코가 두 눈 가운데보다 약 9 px = 키의 0.02 오른쪽, 두 눈 (350, 66)·(383, 65)) · 갸웃은 아주 작게.
//  얼굴(주둥이·눈·무늬·귀)은 이 돌림을 따르고, 머리통 고리도 같은 각만큼 비틀어 목에서 0 으로 잇는다 (1d)
const HEAD_TURN = { yaw: 0.36, pitch: 0.02, roll: -0.02 }; // rad (확인표 1114)
// 얼굴은 머리 고리를 머리 좌표 앞(+z)으로 밀어 깎는다 (주둥이·아래턱이 머리에서 솟은 한 덩어리 — 1c).
//  주둥이: 바닥 타원(가운데 y −0.014, 반폭 0.057 — 윗입술 자리가 넓다, 위로 0.046 = 두 눈 사이 콧등 · 아래로 0.0424 = 턱 끝)에서 끝으로 갈수록
//  가늘어지는 짧고 넓적한 원뿔꼴, 끝까지 0.049 앞으로(1d: 15 % 짧게). 아래쪽(턱)은 덜 나온다. 다문 입선은 주둥이 아래쪽의 얕은 홈 (양 끝이 살짝 처짐)
const SNOUT = { yc: -0.014, a: 0.057, chinA: 0.04, up: 0.046, down: 0.0424, out: 0.049, flat: 0.26, chin: 0.3 }; // 1e: 아래턱(down) 0.053 → 0.0424 (20 % 짧게)
const MOUTH = { y: -0.035, droop: 0.004, half: 0.031, depth: 0.0036, width: 0.0028 }; // 1e: 입선 −0.04 → −0.035 (코 쪽으로)
// 눈 (감독 측정 10/14: 두 눈 사이 키의 0.073 · 눈 ~ 코 세로 0.034 · 눈 t 0.056): 작은 아몬드꼴, 바깥 눈꼬리가 살짝 처진다.
//  쑥 들어간 눈 — 눈자리를 얕게 파고(socket) 위 눈두덩(brow)을 살짝 내밀어 눈 위에 그늘. 곰 2: 돌 조각 눈 — 윗눈꺼풀 음각 선 · 짙은 돌 눈알 ·
//  드릴로 판 눈동자(pupil) · 구멍에 남긴 작은 돌 다리(shine 자리)
const EYE = { x: 0.039, y: 0.028, w: 0.028, h: 0.0205, droop: 0.0045, tilt: 0.12, rim: 1.12, rimH: 1.3, iris: 0.5, pupil: 0.32, shine: 0.0018, socket: 0.0048, brow: 0.0052 };
const EAR = { x: 0.098, y: 0.044, z: -0.012, r: 0.0175, thick: 0.007 }; // 작고 납작한 컵 귀, 넓어진 정수리 양옆 위 모서리 (1e: 조금 위·바깥으로 — 사진 귀 가운데 (309, 62)·(396, 66))
const EAR_CHIP = { side: -1, angle: 1.2, r: 0.42, depth: 0.32 }; // 곰 오른 귀 위 바깥 테두리의 작은 깨짐 (귀 반지름 몫 — 확인표 1246)
const EAR_CHIP2 = { side: 1, angle: 2.3, r: 0.3, depth: 0.24 }; // 곰 2c: 왼 귀 위 안쪽 테두리에도 작은 깨짐 하나 (확인표 1300)
// 곰 2c — 귀 컵 (확인표 1293): 납작한 공의 앞면을 오목하게 눌러 컵으로 (곰 2 의 짙은 원판 0x2e3132 대신 — 앞면 가운데가 귀 두께 × (1 − depth) 까지 들어간다).
//  컵 바닥은 짙은 돌 → 가장 깊은 그늘 쪽으로 shade 만큼(오목한 그늘), 테두리(가장 튀어나온 곳)는 닳아 밝게 rimWear
const EAR_CUP = Object.freeze({ depth: 1.45, pow: 1.15, shade: 0.8, rimWear: 0.45 });
// 곰 2c — 눈은 판 자리의 그늘로만 (확인표 1290): 눈 조각 겹(윗눈꺼풀 · 눈알 · 홍채 · 눈동자 · 돌 다리)의 꼴 · 자리 · 들림은 곰 2 그대로 두고, 색만
//  그 자리 얼굴 판 돌빛 → 가장 깊은 그늘(짙은 돌 × DEEP)의 섞음 a 로 (0 = 판 돌빛 · 1 = 가장 깊은 그늘). 윗눈꺼풀은 눈알 위 가장자리에서 가장 짙고(lidIn) 위로 판 돌빛까지
//  옅어지는 그늘 띠, 눈알은 테두리 ballRim → 안 ball(위쪽 ballTop — 눈꺼풀 그늘), 홍채 자리 iris, 눈동자는 가운데로 갈수록 짙은 얕은 오목(pupil = 가장 깊은 그늘),
//  곰 2 의 돌 다리(1e 반사점 자리)는 그 오목 안에 남은 돌(bridge). 겹마다 테두리는 바로 밑 겹과 같은 a 라 겹 경계가 칠한 선으로 안 보인다.
//  법선은 판 자리처럼 가운데 쪽으로 기울여(slope · 윗눈꺼풀 띠는 아래로 lidSlope) 위쪽 벽은 해를 덜 받고 아래쪽 벽은 받는다
const EYE_CARVE = Object.freeze({ lidIn: 0.9, ballRim: 0.66, ball: 0.86, ballTop: 0.94, iris: 0.97, pupil: 1, bridge: 0.62, slope: 0.3, lidSlope: 0.25 });
// 곰 2c — 얕게 판 점 (확인표 1291 · 1292): 콧구멍 · 가슴 드릴 점은 가운데로 갈수록 그 자리 돌빛 → 가장 깊은 그늘 쪽으로 a, 법선은 가운데 쪽으로 기운 오목 (곰 2 의 짙은 원판 대신)
const SOFT_PIT = Object.freeze({ nostril: 0.8, chestDot: 0.5, slope: 0.7 });
// 얼굴 밝은 돌 자리 (머리 좌표, 좌우 대칭): 주둥이 덩어리 + 두 눈을 감싸는 '안경' + 콧등 + 눈 위 눈썹 자리 둘. 무늬 세기 0.5 선이 얼굴 판 경계다.
//  곰 2: 1e 의 부드러운 그러데이션은 무늬 세기 0.5 보다 바깥까지 밝게 보였다 — 또렷한 판 경계로 바꾸며 그 보이던 자리에 맞춰 '안경'을 넓히고(SPECS),
//  이마 아치를 눈 위에서 평평하게(BROW_ARCH pow 4 — 곰 2b 에서 BROW_TOP 으로 바뀜), 볼 경계를 조금 바깥으로(CHEEK) 옮겼다 — 사진처럼 가까운 눈 위에 밝은 띠,
//  바깥 눈꼬리에 좁은 띠가 남게
const SPECS = { x: 0.037, rx: 0.024, ry: 0.0185 }; // 눈마다 감싸는 밝은 타원 (1d 0.036 · 0.0175 · 0.016)
const BROWS = { x: 0.034, y: 0.047, rx: 0.017, ry: 0.0115 }; // 눈썹 자리 (콧등과 이어진다)
// 이마 위 경계 (곰 2b · 확인표 1280 — 사장님 10/14 12:2x '이마 쪽에서 거의 직선으로 연결돼 있어. 실제 사진은 약간 밑으로 들어가는 곡선'):
//  두 눈썹 자리 위(|x| px)가 가장 높고 콧등 위 가운데가 dip 만큼 처진다 — 짙은 이마가 두 눈썹 자리 사이로 조금 내려온다. 눈썹 자리 바깥은 바깥 눈꼬리 쪽으로 내려간다.
//  y = peak − dip·(1 + cos(π|x|/px))/2 (|x| ≤ px) · peak − drop·((|x| − px)/(span − px))^pow (바깥), 경계 폭 ±soft.
//  사진 이마 경계를 머리 좌표로 옮겨 좌우 평균한 꼴(봉우리 0.0533 · 처짐 0.0051)을, 둥근 비탈(FACE_BEVEL)이 보이는 경계를 위로 넓히는 만큼 낮춰
//  사진 구도 렌더에서 두 봉우리 평균 · 처짐(키의 0.0055) · 폭을 사진과 맞춘 값 (docs/import/sluice_port_2026-10-14.md §7-1). 곰 2 까지는 콧등 위가 가장 높은
//  아치(BROW_ARCH: 가운데 0.05 · 눈 위 0.046 · 바깥 눈꼬리 0.034, 4 제곱 꼴)였다 — 앞에서 보면 두 눈썹 자리 위를 거의 곧게 이었다
const BROW_TOP = { peak: 0.0519, px: 0.023, dip: 0.005, drop: 0.0222, span: 0.058, pow: 1.81, soft: 0.0075 };
const CHEEK = [0.07, 0.054]; // 눈 둘레('안경')·눈썹 자리·주둥이 무늬의 바깥 끝 |x| (1d·1e 0.067 → 0.051) — 볼은 아래 CHEEK_LINE
// 볼 바깥 경계 (곰 2b · 확인표 1281 — 감독 검수 '볼 쪽 바깥 경계도 사진의 곡선'): 사진 윤곽을 머리 좌표로 옮겨 좌우 평균한 [y, 바깥 |x|] — 눈 아래에서 바깥으로 불룩하다가(0.060)
//  주둥이 옆을 거의 곧게 내려와 턱으로 둥글게 모인다. 입선(y −0.035) 아래는 사진 턱이 우리 아래턱(1e — 20 % 짧게)보다 길어 세로로 0.68 배 눌러 맞췄다.
//  곰 2 까지는 눈 아래에서 안으로 파였고(|x| 0.047) 볼 끝은 세로 곧은 선(CHEEK)이었다. 위(top)는 눈 둘레 무늬와 겹쳐 사라진다
const CHEEK_LINE = Object.freeze({
  rows: [
    [0.022, 0.0525], [0.016, 0.057], [0.01, 0.0598], [0.004, 0.0601], [-0.002, 0.0585], [-0.008, 0.0558], [-0.014, 0.0541], [-0.02, 0.0531], [-0.026, 0.0526],
    [-0.032, 0.0521], [-0.0357, 0.0502], [-0.0384, 0.046], [-0.0411, 0.0409], [-0.0438, 0.0352], [-0.0466, 0.0295], [-0.0493, 0.0246], [-0.052, 0.019], [-0.0547, 0.011], [-0.0575, 0],
  ],
  soft: 0.007,
  top: 0.021,
  topSoft: 0.004,
});
const NOSE = { y: -0.004, w: 0.0235, h: 0.0115, d: 0.012 }; // 넓고 납작한 코 — 폭 0.047, 위가 평평, 주둥이 끝 위 (사진 코 가운데 (376, 81), 눈 ~ 코 세로 키의 0.034)

// 곰 2 — 정수리 꺼짐 (사장님 10/14 08:3x '정수리가 움푹 들어가야 저 곰의 특징이 나와', 확인표 1240): 머리 좌표에서 정수리를 앞뒤로 지나는 얕은 골과 그 양옆 둔덕.
//  아래로 미는 깊이 = depth·exp(−((x − x0)/sx)²) − lip·exp(−((|x − x0| − lx)/lw)²), 머리 윗부분(머리 좌표 높이 y0 → y1 에서 차오름)과 정수리 앞뒤 구간(zb ~ zf, ±soft)
//  에서만 — 이마·뒤통수 쪽으로 사라지고 귀·관자놀이·얼굴은 그대로. 골 가운데 x0 는 머리 가운데보다 곰 오른쪽으로 0.009 (사진 꺼짐이 두 귀 가운데보다 사진 왼쪽).
//  사진 정면 윗선(키 449 px, 같은 방법으로 잼): 두 봉우리 x 340 · 354(사이 키의 0.031) 사이 x 348 에서 두 봉우리 잇는 선보다 키의 0.0024 · 둥근 지붕보다 0.0035 꺼짐
//  → 모델 0.0022 · 0.0040, 봉우리 340 · 354, 꺼짐 348 (docs/import/sluice_port_2026-10-14.md §6-2)
const CROWN = { x0: -0.009, depth: 0.002, sx: 0.008, lip: 0.004, lx: 0.022, lw: 0.01, y0: 0.05, y1: 0.068, zb: -0.05, zf: 0.08, soft: 0.015 };
// 얼굴 밝은 돌 판 (확인표 1243 · 1282): 머리 좌표 격자(h 간격)에 머리 겉면을 그려 넣고(앞을 보는 삼각형만 — z 버퍼), 밝은 돌 자리(무늬 세기 ≥ 0.5)만
//  경계선에서 잘라 겉면에서 FACE_STEP 띄운다. 판은 머리 겉면을 따라 눈자리로 파여 들어가고, 눈 조각은 1e 와 같은 자리·같은 들림으로 판 위에 얹는다
//  (판 두께만큼 더 띄움). 머리 고리 자체는 모두 짙은 돌 — 머리 고리 꼭짓점 간격(4~8 mm)으로는 또렷한 경계를 못 그려서 밝은 돌은 판만 진다.
//  곰 2b (감독 검수 '가면 쓴 원숭이처럼 보인다'): 단 3.5 mm(0.0011) → 1.3 mm(0.0004), 곧은 벽 + 벽 밑 때(0.45) → 판 가장자리에서 바깥으로 FACE_BEVEL.w
//  (키 3.2 m 에서 6.4 mm) 동안 둥글게 내려가 겉면에 닿는 비탈(어깨·발 모두 둥근 cos² 꼴) — 색도 그 비탈에서 밝은 돌 → 짙은 돌로 넘어간다. 돌에 새긴 무늬 경계
const FACE_STEP = 0.0004;
const FACE_BEVEL = Object.freeze({ w: 0.002, rings: [0, 0.5, 1] }); // 비탈 너비(머리·몸 단위) · 비탈 고리 자리(0 = 판 가장자리, 1 = 겉면에 닿는 발)
const FACE_PLATE = Object.freeze({ h: 0.003, x0: -0.077, x1: 0.077, y0: -0.066, y1: 0.064 });
// 가슴 말굽 양각 (확인표 1242): 판을 몸 겉면에서 lift 만큼 띄우고 둘레를 얕은 음각 홈으로 돌린다.
//  rings = [판 가장자리에서 바깥으로 거리, 들림]: 벽 발 · 홈 바닥 · 홈 바깥 둔덕 · 몸에 녹아드는 끝 (몸 단위 — 키 3.2 m 에서 0.001 = 3.2 mm)
const RELIEF = Object.freeze({ lift: 0.0027, rings: [[0.0006, 0.00035], [0.0026, 0.00035], [0.0048, 0.001], [0.0095, 0.00035]] });

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
const CHEST_SPOTS = [[-0.056, 0.276, 0.0045], [-0.031, 0.285, 0.004], [0.042, 0.296, 0.0045], [0.076, 0.267, 0.004]]; // [x, t, 반지름] 아래쪽 점 — 곰 2: 드릴로 판 얕은 점

// 끌 자국 (확인표 1244): 큰 털 덩어리마다 드문 음각 선 — 뒤통수·목덜미 · 어깨 · 위팔 바깥 · 등 · 엉덩이 바깥 · 허벅지 바깥 (가슴·배 앞은 비움).
//  [붙일 곳, [[t, 방위 φ(rad, 0 = 앞 · + = 곰 왼쪽 · π = 뒤)], …], 폭(몸 단위)]. 폭 0.0035 = 키 3.2 m 에서 약 1.1 cm
const CHISEL = [
  ['body', [[0.065, 2.62], [0.11, 2.74], [0.16, 2.86]], 0.0034],
  ['body', [[0.07, -2.7], [0.12, -2.82], [0.17, -2.95]], 0.0034],
  ['body', [[0.1, 3.1], [0.15, 3.12], [0.205, 3.08]], 0.003],
  ['body', [[0.172, 1.0], [0.205, 1.2], [0.24, 1.42]], 0.0036],
  ['body', [[0.172, -1.0], [0.205, -1.2], [0.24, -1.42]], 0.0036],
  ['armL', [[0.29, 1.15], [0.345, 1.25], [0.405, 1.38]], 0.0034],
  ['armL', [[0.335, 1.95], [0.395, 2.02], [0.455, 2.08]], 0.0032],
  ['armR', [[0.29, 1.15], [0.345, 1.25], [0.405, 1.38]], 0.0034],
  ['armR', [[0.335, 1.95], [0.395, 2.02], [0.455, 2.08]], 0.0032],
  ['body', [[0.3, 2.55], [0.39, 2.62], [0.48, 2.7]], 0.0036],
  ['body', [[0.33, -2.6], [0.42, -2.68], [0.51, -2.76]], 0.0036],
  ['body', [[0.655, 1.72], [0.715, 1.84], [0.775, 1.96]], 0.0036],
  ['body', [[0.655, -1.72], [0.715, -1.84], [0.775, -1.96]], 0.0036],
  ['body', [[0.69, 2.4], [0.745, 2.5], [0.795, 2.6]], 0.0032],
  ['thighL', [[0.835, 1.45], [0.875, 1.52], [0.915, 1.58]], 0.003],
  ['thighR', [[0.835, 1.45], [0.875, 1.52], [0.915, 1.58]], 0.003],
];
// 지의류 딱지 (곰 2c · 확인표 1297): 몸 겉면에 꼭짓점마다 붙인 얇고 들쭉날쭉한 딱지 (크고 작은 조각 셋) — 옅은 회녹색, 하나만 누런빛.
//  [붙일 곳, t, 방위 φ(rad, 0 = 앞 · + = 곰 왼쪽 · 팔·다리는 + = 바깥), 반지름(몸 단위 — 0.01 = 3.2 cm), 누런빛]. 얼굴 · 가슴 말굽엔 두지 않는다 (무늬가 읽히게)
const LICHEN_BEAR = [
  ['body', 0.215, -1.75, 0.0085, false], // 오른 어깨 바깥 (해 쪽)
  ['body', 0.25, 2.2, 0.011, false], // 왼 어깨 뒤
  ['body', 0.43, -2.45, 0.009, false], // 등 오른쪽
  ['armR', 0.34, 1.2, 0.0065, false], // 오른 위팔 바깥
  ['armL', 0.42, 1.6, 0.006, false], // 왼 위팔 바깥
  ['body', 0.6, -1.4, 0.0075, false], // 오른 옆구리 아래
  ['thighL', 0.87, 1.25, 0.006, true], // 왼 허벅지 바깥 — 누런빛 하나
  ['body', 0.035, -1.05, 0.005, false], // 머리 오른쪽 위
  ['armR', 0.5, 0.7, 0.0055, false], // 오른 아래팔 바깥 앞
  ['body', 0.7, -0.95, 0.007, false], // 오른 배 아래 옆
];
const PAW_CHIP = { side: 1, t: 0.588, r: 0.013, depth: 0.003 }; // 곰 2c: 왼 앞발(주먹) 앞 모서리 작은 깨짐 — ARM 고리 t 0.588 의 맨 앞 꼭짓점 둘레 (확인표 1300)

// 오래된 돌 (확인표 1245): 오목한 곳·아랫면은 때(비를 덜 맞아 낀 딱지 — 곰 2c: 검정 대신 젖은 녹회색, 확인표 1294), 하늘을 보는 면은 비에 씻겨 바램, 튀어나온 곳은 닳아 밝게, 발 둘레 이끼.
//  grime: 다른 덩어리를 바라보는 오목한 곳의 때 · down: 아랫면 때 · up: 윗면 바램 · mossTop: 발바닥에서 이 높이(몸 단위)까지 이끼 · moss: 이끼 세기
//  곰 2c: grimeMax 때 섞음 한도 · streak 옅은 녹회색 빗물 자국 세기(곰 2 의 짙은 자국 0.25 대신) · mossUp 위를 보는 면 이끼 · wetTop · wet 아래쪽 젖은 띠(발바닥에서 높이 · 짙어짐) ·
//  mud 발등 진흙 튐 (확인표 1295 · 1296 · 1299)
const WEATHER = Object.freeze({ grime: 0.55, grimeMax: 0.85, down: 0.24, up: 0.3, mossTop: 0.025, moss: 0.7, streak: 0.5, mossUp: 0.92, wetTop: 0.075, wet: 0.24, mud: 0.7 });
// 돌 얼룩: 큰 얼룩(scale — 키 3.2 m 에서 약 20 cm) + 잔 얼룩(scale2 — 약 8 cm) + 돌 결(scale3 — 약 3 cm, 곰 2b · 확인표 1284)의 밝기 흔들림 (꼭짓점 색, 질감 없음)
//  곰 2b: 짙은 돌이 밝아져 같은 몫의 흔들림이 더 잘 보인다 — 머리·얼굴처럼 꼭짓점이 촘촘한 곳에서 결로 읽히는 아주 작은 얼룩을 더했다
const MOTTLE = Object.freeze({ amp: 0.14, scale: 16, amp2: 0.06, scale2: 40, amp3: 0.06, scale3: 110 });
// 큰 덩어리 돌 빛깔 얼룩 (곰 2c · 확인표 1298): 약 60 cm 결로 조금 밝은 황토 회색 ↔ 조금 짙은 녹회색 — 채널 배수 (잡음 × amp 를 ±1 에서 자름). 밝기 잔얼룩(MOTTLE)보다 큰 덩어리
const STONE_TINT = Object.freeze({ scale: 5.5, amp: 1.7, warm: [1.08, 1.02, 0.88], cool: [0.9, 0.95, 0.93] });
// 빗물 자국 (곰 2c · 확인표 1296): 튀어나온 곳(이마 · 턱 · 가슴 말굽 아래 · 팔 바깥) 아래로 흘러내린 옅은 녹회색 세로 줄 —
//  [붙일 곳, 방위 φ(rad, 0 = 앞 · + = 곰 왼쪽 · 팔은 + = 바깥), 시작 t, 끝 t, 반폭(rad), 세기]. 곰 2 의 등·옆구리 짙은 자국 다섯은 같은 자리에서 옅은 녹회색으로
const STREAKS = [
  ['body', 1.2, 0.03, 0.115, 0.06, 0.9], ['body', -0.48, 0.03, 0.11, 0.06, 0.8], // 이마 → 관자놀이 · 볼 바깥 (얼굴은 곰 왼쪽으로 0.36 rad 돌아 있다)
  ['body', 0.05, 0.168, 0.265, 0.08, 1], // 턱 아래 → 가슴 파임(U) 안
  ['body', -0.36, 0.312, 0.52, 0.06, 0.9], ['body', 0.2, 0.333, 0.55, 0.065, 1], ['body', 0.66, 0.288, 0.48, 0.05, 0.75], // 가슴 말굽 아래
  ['body', 2.55, 0.2, 0.62, 0.05, 0.8], ['body', -2.62, 0.22, 0.58, 0.045, 0.8], ['body', 3.06, 0.24, 0.5, 0.04, 0.7], ['body', 1.62, 0.3, 0.66, 0.04, 0.8], ['body', -1.66, 0.32, 0.64, 0.04, 0.8], // 등 · 옆구리
  ['arm', 1.35, 0.23, 0.56, 0.17, 1], ['arm', 2.05, 0.3, 0.5, 0.15, 0.7], // 팔 바깥 (양팔 거울)
];
// 위를 보는 면 이끼 (곰 2c · 확인표 1295): 자리(t 구간)마다 위를 보는 정도(법선 y up[0] → up[1]) × 얼룩(scale: 약 23 cm · 8 cm 두 겹, 문턱 patch 위만 — 군데군데).
//  몸통: 정수리(정말 위를 보는 곳만 · 드물게 — 골은 따로 더 짙게) · 어깨와 가슴 말굽 위턱(비탈진 어깨도) / 팔: 위팔 윗면 · 주먹 위. 얼굴 판 · 귀 · 다리 · 발톱엔 없다
const MOSS_UP = Object.freeze({
  body: [{ t: [0, 0.075], up: [0.55, 0.9], patch: [0.2, 0.42] }, { t: [0.15, 0.32], up: [0.02, 0.4], patch: [-0.06, 0.24] }],
  arm: [{ t: [0.19, 0.33], up: [0.02, 0.4], patch: [-0.06, 0.24] }, { t: [0.535, 0.62], up: [0.05, 0.45], patch: [-0.1, 0.2] }],
  relief: [{ t: [0.17, 0.215], up: [0.05, 0.25], patch: [0.0, 0.26], scale: [45, 90] }], // 가슴 말굽 위턱 — 판 윗변 위 홈 · 둔덕만 (약 7 cm 얼룩으로 군데군데). 밝은 판(plate)엔 없다
  scale: [14, 40],
});
// 때 끼는 오목한 곳을 어림하는 캡슐 (몸 좌표 [x, Y, z], 키 = 1): 꼭짓점이 바라보는 쪽에 다른 덩어리가 가까울수록 때가 낀다
//  (겨드랑이·팔과 몸 사이 · 가랑이·허벅지 안쪽 · 턱 밑 · 귀 뒤 · 발목)
const OCC = [
  { part: 'body', a: [0, 0.72, 0.008], b: [0, 0.33, 0.012], r: 0.112 },
  { part: 'body', a: [0, 0.33, 0.012], b: [0, 0.215, -0.012], r: 0.12 },
  { part: 'body', a: [-0.11, 0.215, -0.012], b: [0.11, 0.215, -0.012], r: 0.05 }, // 엉덩이 밑 (허벅지 윗면 그늘)
  { part: 'head', a: [0.012, 0.925, 0.025], b: [0.022, 0.895, 0.085], r: 0.07 },
];
for (const s of [-1, 1]) {
  const k = s < 0 ? 'R' : 'L';
  OCC.push({ part: `arm${k}`, a: [s * 0.085, 0.745, 0.01], b: [s * 0.15, 0.452, 0.037], r: 0.04 });
  OCC.push({ part: `arm${k}`, a: [s * 0.15, 0.452, 0.037], b: [s * 0.13, 0.367, 0.057], r: 0.034 });
  OCC.push({ part: `thigh${k}`, a: [s * 0.072, 0.26, 0.004], b: [s * 0.124, 0.11, 0.011], r: 0.06 });
  OCC.push({ part: `thigh${k}`, a: [s * 0.124, 0.11, 0.011], b: [s * 0.129, 0.02, -0.005], r: 0.037 });
}

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

// ── 돌 겉면: 때 · 바램 · 이끼 (꼭짓점 색에 굽는다) ─────────────────────
const _oa = new THREE.Vector3();
const _ob = new THREE.Vector3();
const _oq = new THREE.Vector3();
/** 오목한 곳 세기 0~1: 꼭짓점(p, 법선 n)이 바라보는 쪽에 다른 덩어리(OCC 캡슐)가 가까울수록. 머리는 턱 밑 목·귀 뒤만 가린다 */
function occlusion(p, n, part) {
  let o = 0;
  for (const q of OCC) {
    if (q.part === part || (part.startsWith('claw') && q.part === `arm${part.slice(4)}`)) continue;
    if (q.part === 'head' && !(part === 'ear' || (part === 'body' && p.y < 0.86))) continue;
    _oa.fromArray(q.a);
    _ob.fromArray(q.b).sub(_oa);
    const u = Math.min(1, Math.max(0, _oq.subVectors(p, _oa).dot(_ob) / _ob.lengthSq()));
    _oq.copy(_oa).addScaledVector(_ob, u).sub(p); // 꼭짓점 → 캡슐 축의 가장 가까운 점
    const d = _oq.length();
    const gap = d - q.r;
    if (gap > 0.07 || d < 1e-6) continue;
    const facing = _oq.dot(n) / d;
    if (facing <= 0) continue;
    o += facing * Math.exp(-((Math.max(0, gap) / 0.024) ** 2));
  }
  return Math.min(1, o);
}
/** 값 잡음 −1~1 (정수 격자 해시를 부드럽게 이음) */
function vnoise(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const [u, v, w] = [x - xi, y - yi, z - zi].map((f) => f * f * (3 - 2 * f));
  let out = 0;
  for (let k = 0; k < 8; k++) {
    const [a, b, c] = [k & 1, (k >> 1) & 1, (k >> 2) & 1];
    out += h3(xi + a, yi + b, zi + c, seed) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return out * 2 - 1;
}
/** 돌 얼룩 밝기 배수 (몸 좌표) */
const mottle = (p) =>
  1 + MOTTLE.amp * vnoise(p.x * MOTTLE.scale, p.y * MOTTLE.scale, p.z * MOTTLE.scale, 3) + MOTTLE.amp2 * vnoise(p.x * MOTTLE.scale2, p.y * MOTTLE.scale2, p.z * MOTTLE.scale2, 7) + MOTTLE.amp3 * vnoise(p.x * MOTTLE.scale3, p.y * MOTTLE.scale3, p.z * MOTTLE.scale3, 11);
/** 허벅지와 엉덩이가 만나는 골 (0~1): 허벅지 꼭짓점은 몸통 겉면에, 몸통 꼭짓점은 허벅지 겉면에 가까울수록 — 두 덩어리가 엇갈려 만나는 선을 때 낀 골로 */
function hipCrease(p, part) {
  const t = 1 - p.y;
  if (t < 0.7 || t > 0.83) return 0;
  if (part.startsWith('thigh')) {
    const [w, d, cz] = bodyRing(Math.min(t, 0.817));
    return ss(Math.hypot(p.x / w, (p.z - cz) / d), 1.16, 1.0) * ss(t, 0.835, 0.8);
  }
  if (part !== 'body') return 0;
  const [cx, cz] = lerpRow(THIGH, t, Math.sign(p.x) || 1);
  let i = 0;
  while (i < THIGH.length - 2 && t > THIGH[i + 1][0]) i++;
  const f = Math.min(1, Math.max(0, (t - THIGH[i][0]) / (THIGH[i + 1][0] - THIGH[i][0])));
  const w = THIGH[i][2] + (THIGH[i + 1][2] - THIGH[i][2]) * f;
  const d = THIGH[i][3] + (THIGH[i + 1][3] - THIGH[i][3]) * f;
  return ss(Math.hypot((p.x - cx) / w, (p.z - cz) / d), 1.16, 1.0) * ss(t, 0.74, 0.77);
}
/** 빗물 자국 세기 0~1 (곰 2c — 옅은 녹회색, STREAKS): 몸통 · 팔 겉면의 방위 폭 안에서, 시작에서 짙고 끝으로 갈수록 옅게. 줄은 조금 구불구불 */
function streak(p, part) {
  const arm = part.startsWith('arm');
  if (!arm && part !== 'body') return 0;
  const t = 1 - p.y;
  let phi;
  if (arm) {
    const side = part === 'armL' ? 1 : -1;
    const [cx, cz] = lerpRow(ARM, t, side);
    phi = Math.atan2((p.x - cx) * side, p.z - cz); // + = 팔 바깥
  } else phi = Math.atan2(p.x - HEAD_SHIFT * (1 - S(t, 0.13, 0.19)), p.z - bodyRing(Math.min(t, 0.817))[2]);
  let k = 0;
  for (const [where, a0, t0, t1, hw, amp] of STREAKS) {
    if ((where === 'arm') !== arm || t < t0 - 0.015 || t > t1) continue;
    const a = a0 + 0.35 * hw * Math.sin(t * 70 + a0 * 3);
    const da = Math.abs(Math.atan2(Math.sin(phi - a), Math.cos(phi - a)));
    if (da > hw * 1.6) continue;
    k = Math.max(k, amp * ss(da, hw * 1.6, hw * 0.4) * ss(t, t0 - 0.015, t0 + 0.02) * (1 - 0.85 * ss(t, t0, t1)));
  }
  return k;
}
/** 위를 보는 면 이끼 무게 0~1 (곰 2c, MOSS_UP): 붙일 곳의 t 구간 × 위를 보는 정도 × 얼룩 문턱 (군데군데) */
function mossUp(p, n, part) {
  const zones = part.startsWith('arm') ? MOSS_UP.arm : part === 'body' || part === 'relief' ? MOSS_UP[part] : null;
  if (!zones) return 0;
  const t = 1 - p.y;
  let m = 0;
  for (const z of zones) {
    const [a, b] = z.t;
    const w = (a <= 0 ? 1 : ss(t, a - 0.012, a + 0.012)) * ss(t, b + 0.012, b - 0.012) * ss(n.y, z.up[0], z.up[1]);
    if (w > 0) m = Math.max(m, w * mossPatch(p, z.patch, z.scale));
  }
  return m;
}
/** 이끼 얼룩 0~1 (약 23 cm · 8 cm 두 겹 — 몸 고리 간격에 맞춘 결, 문턱 위만 — 군데군데) */
const mossPatch = (p, [lo, hi] = [0, 0.28], [a, b] = MOSS_UP.scale) => {
  return ss(0.7 * vnoise(p.x * a, p.y * a, p.z * a, 17) + 0.3 * vnoise(p.x * b, p.y * b, p.z * b, 19), lo, hi);
};
const MOSS_DEEP = new THREE.Color(BEAR_COLORS.mossDeep);
const MOSS_LIT = new THREE.Color(BEAR_COLORS.mossLit);
const _moss = new THREE.Color();
/** 이끼 빛 (두툼한 가운데 짙게 · 얇은 가장자리 누렇게 — 자리 잡음으로) */
const mossColor = (p) => _moss.copy(MOSS_DEEP).lerp(MOSS_LIT, ss(vnoise(p.x * 45, p.y * 45, p.z * 45, 31), -0.4, 0.5));
/** 큰 덩어리 돌 빛깔 (곰 2c, STONE_TINT): 따뜻한 황토 회색 ↔ 서늘한 녹회색 채널 배수 */
function stoneTint(c, p) {
  const T = STONE_TINT;
  const k = Math.max(-1, Math.min(1, T.amp * vnoise(p.x * T.scale, p.y * T.scale, p.z * T.scale, 23)));
  const m = k > 0 ? T.warm : T.cool;
  const a = Math.abs(k);
  c.r *= 1 + (m[0] - 1) * a;
  c.g *= 1 + (m[1] - 1) * a;
  c.b *= 1 + (m[2] - 1) * a;
  return c;
}
const GRIME = new THREE.Color(BEAR_COLORS.grime);
const BLEACH = new THREE.Color(BEAR_COLORS.bleach);
const MOSS_FOOT = new THREE.Color(BEAR_COLORS.moss);
const STREAK = new THREE.Color(BEAR_COLORS.streak);
const MUD = new THREE.Color(BEAR_COLORS.mud);
/**
 * 오래된 돌의 겉 한 꼭짓점 (c 를 고쳐 돌려준다): 돌 얼룩 · 빛깔 얼룩, 윗면 바램, 빗물 자국, 오목한 곳 · 아랫면 때, 발 · 다리 아래 젖은 띠 · 발 둘레 이끼 · 발등 진흙, 위를 보는 면 이끼.
 *  extra = { cav: 새긴 홈 세기(때를 더하고 바램을 던다), moss: 홈 안 이끼 } — 정수리 골
 */
function weatherAt(c, p, n, part0, extra = null) {
  const W = WEATHER;
  const part = part0 === 'relief' || part0 === 'plate' ? 'body' : part0; // 가슴 말굽 판(plate) · 홈 고리(relief)는 몸통 겉 그대로 — 이끼만 따로 (판엔 없고 홈 고리는 위턱만, MOSS_UP.relief)
  stoneTint(c.multiplyScalar(mottle(p)), p);
  const cav = extra ? extra.cav : 0;
  c.lerp(BLEACH, W.up * ss(n.y, 0.35, 0.95) * (1 - cav));
  const st = W.streak * streak(p, part);
  if (st > 0) c.lerp(STREAK, st);
  c.lerp(GRIME, Math.min(W.grimeMax, W.grime * occlusion(p, n, part) + W.down * ss(n.y, -0.15, -0.85) + cav + 0.42 * hipCrease(p, part)));
  if (part.startsWith('foot') || part.startsWith('thigh')) {
    // 아래쪽 젖은 띠 (곰 2c): 발바닥에서 wetTop(키 3.2 m 에서 약 24 cm, 고르지 않은 윗선)까지 짙게
    const edge = W.wetTop * (1 + 0.2 * vnoise(p.x * 40, 0.5, p.z * 40, 29));
    c.multiplyScalar(1 - W.wet * ss(p.y, edge, edge * 0.6));
    if (p.y < W.mossTop) {
      const patch = 0.55 + 0.45 * Math.sin(p.x * 310 + p.z * 170) * Math.cos(p.z * 260 - p.x * 90); // 고르지 않은 이끼 자리
      c.lerp(MOSS_FOOT, W.moss * ss(p.y, W.mossTop, W.mossTop * 0.25) * patch);
    }
    // 발등 진흙 튐 (곰 2c): 발등 · 발끝 앞에 흩어진 점 (위 · 앞을 보는 면)
    if (part.startsWith('foot')) c.lerp(MUD, W.mud * ss(n.y + 0.6 * n.z, 0.15, 0.7) * ss(vnoise(p.x * 60, p.y * 60, p.z * 60, 37), 0.12, 0.42));
  }
  const mu = W.mossUp * Math.max(mossUp(p, n, part0), extra ? extra.moss : 0);
  if (mu > 0) c.lerp(mossColor(p), mu);
  return c;
}
/** 오래된 돌의 겉 (weatherAt 을 꼭짓점마다). extra(p, n) → { cav, moss } 를 주면 새긴 홈 (정수리 골) */
function weather(g, part, extra = null) {
  paint(g, (p, n, col, i) => weatherAt(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)), p, n, part, extra ? extra(p, n) : null));
}
/** 작은 깨짐: 가운데 c · 반지름 r 안 꼭짓점을 toward(단위 벡터) 쪽으로 가운데일수록 깊게(depth) 밀고, 그 삼각형은 깨진 면 — 평면 법선 · 새 돌빛(무게만큼) */
function chipAt(g, c, r, depth, toward, color, flat = true) {
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  const col = g.attributes.color;
  const w = new Float32Array(p.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.distanceTo(c);
    if (d >= r) continue;
    w[i] = 1 - (d / r) ** 2;
    v.addScaledVector(toward, depth * w[i]);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const k = new THREE.Color(color);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const e = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    if (!w[i] && !w[i + 1] && !w[i + 2]) continue;
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1).sub(a);
    e.fromBufferAttribute(p, i + 2).sub(a);
    b.cross(e).normalize();
    for (let j = i; j < i + 3; j++) {
      if (flat && nr) nr.setXYZ(j, b.x, b.y, b.z);
      const m = Math.max(w[i], w[i + 1], w[i + 2]) * (0.55 + 0.45 * w[j]);
      col.setXYZ(j, col.getX(j) + (k.r - col.getX(j)) * m, col.getY(j) + (k.g - col.getY(j)) * m, col.getZ(j) + (k.b - col.getZ(j)) * m);
    }
  }
  p.needsUpdate = true;
  if (nr) nr.needsUpdate = true;
  col.needsUpdate = true;
}
/** 광선용 사본 + 꼭짓점 색 (붙이는 조각 — 가슴 홈·끌 자국 — 이 밑면과 이음매 없이 이어지게, 밑면의 부드러운 법선·색을 읽는다) */
function surfaceInfo(indexed, painted) {
  const mesh = new THREE.Mesh(indexed, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const colors = new Float32Array(indexed.attributes.position.count * 3);
  const order = indexed.index.array;
  const c = painted.attributes.color.array;
  for (let k = 0; k < order.length; k++) colors.set(c.subarray(k * 3, k * 3 + 3), order[k] * 3);
  return { mesh, colors };
}
/** 광선용 사본의 일부 삼각형만 (같은 꼭짓점 배열 · 색) — keep(첫 꼭짓점 Y, z, x) 인 삼각형. 광선 수백 개를 몸 전체에 쏘지 않게 */
function subInfo(info, keep) {
  const g = info.mesh.geometry;
  const P = g.attributes.position;
  const src = g.index.array;
  const idx = [];
  for (let i = 0; i < src.length; i += 3) if (keep(P.getY(src[i]), P.getZ(src[i]), P.getX(src[i]))) idx.push(src[i], src[i + 1], src[i + 2]);
  const sub = new THREE.BufferGeometry();
  sub.setAttribute('position', P);
  sub.setAttribute('normal', g.attributes.normal);
  sub.setIndex(idx);
  return { mesh: new THREE.Mesh(sub, info.mesh.material), colors: info.colors };
}
/** 광선이 닿은 곳: 자리 · 밑면 법선(꼭짓점 법선 보간) · 밑면 색(보간) */
function surfaceAt(info, from, dir) {
  const hit = hitOn(info.mesh, from, dir);
  if (!hit) return null;
  const { a, b, c } = hit.face;
  const w = hit.barycoord;
  const color = new THREE.Color(0, 0, 0);
  for (const [k, f] of [[a, w.x], [b, w.y], [c, w.z]]) {
    color.r += info.colors[k * 3] * f;
    color.g += info.colors[k * 3 + 1] * f;
    color.b += info.colors[k * 3 + 2] * f;
  }
  return { point: hit.point.clone(), normal: hit.normal.clone().normalize(), color };
}
/** 꼭짓점 색을 직접 쓴 조각을 넣는다 (Kit 은 흰색을 칠하고, 펼쳐진 꼭짓점 순서대로 색을 얹는다) */
function putColored(kit, g, cols) {
  const out = kit.putM('bear', g, 0xffffff, new THREE.Matrix4(), PLAIN);
  const order = g.index.array;
  const c = out.attributes.color;
  for (let k = 0; k < c.count; k++) c.setXYZ(k, cols[order[k] * 3], cols[order[k] * 3 + 1], cols[order[k] * 3 + 2]);
  return out;
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
 *  r = 주둥이 바닥 타원 기준 거리(0 = 끝, 1 = 바닥 테두리), mouth = 입선 홈 세기, brow = 눈두덩(눈썹뼈) 세기
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
  let brow = 0;
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x;
    d -= EYE.socket * Math.exp(-((dx / 0.011) ** 2) - ((y - EYE.y) / 0.008) ** 2); // 쑥 들어간 눈자리
    const b = Math.exp(-((dx / 0.016) ** 2) - ((y - EYE.y - 0.012) / 0.006) ** 2);
    d += EYE.brow * b; // 눈 위를 덮는 눈두덩
    brow = Math.max(brow, b);
  }
  return { d, r, mouth, brow };
}
/** 이마 위 경계 높이 (머리 좌표 x → y, BROW_TOP): 두 눈썹 자리 위가 가장 높고 콧등 위 가운데가 조금 처진 곡선 (곰 2b) */
function browTop(x) {
  const B = BROW_TOP;
  const ax = Math.abs(x);
  if (ax <= B.px) return B.peak - (B.dip * (1 + Math.cos((Math.PI * ax) / B.px))) / 2;
  return B.peak - B.drop * Math.min(1.4, (ax - B.px) / (B.span - B.px)) ** B.pow;
}
/** 볼 바깥 경계 |x| (머리 좌표 y → |x|, CHEEK_LINE 표 사이를 3 차 에르미트로 매끈하게). 표 밖이면 null */
function cheekLine(y) {
  const R = CHEEK_LINE.rows;
  if (y > R[0][0] || y < R[R.length - 1][0]) return null;
  let i = 0;
  while (i < R.length - 2 && y < R[i + 1][0]) i++;
  const p0 = R[Math.max(0, i - 1)];
  const p1 = R[i];
  const p2 = R[i + 1];
  const p3 = R[Math.min(R.length - 1, i + 2)];
  const h = p2[0] - p1[0];
  const u = (y - p1[0]) / h;
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * h;
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * h;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * p1[1] + (u ** 3 - 2 * u ** 2 + u) * m1 + (-2 * u ** 3 + 3 * u ** 2) * p2[1] + (u ** 3 - u ** 2) * m2;
}
/** 얼굴 밝은 돌 자리 세기 0~1 (머리 좌표, 자리만으로): [주둥이 + 두 눈 '안경' + 콧등 + 눈썹 자리 × 무늬 바깥 끝(CHEEK)] 과 볼(CHEEK_LINE 안) 중 큰 쪽 × 이마 경계 아래.
 *  '안경'·눈썹 자리·콧등·주둥이는 1c~1e · 곰 2 그대로, 이마 경계(browTop)와 볼(cheekLine)은 곰 2b */
function faceTone(x, y, f) {
  let te = 0;
  let tb = 0;
  for (const side of [-1, 1]) {
    te = Math.max(te, ss(Math.hypot((x - side * SPECS.x) / SPECS.rx, (y - EYE.y) / SPECS.ry), 1.22, 0.72));
    tb = Math.max(tb, ss(Math.hypot((x - side * BROWS.x) / BROWS.rx, (y - BROWS.y) / BROWS.ry), 1.25, 0.6));
  }
  const bw = 0.026 + 0.02 * ss(y, 0.03, 0.05); // 콧등은 위로 갈수록 넓어져 눈썹 자리와 한 판이 된다 (1e — 이마 경계 안이 비지 않게)
  const bridge = ss(Math.abs(x), bw, bw * 0.5) * ss(y, 0.08, 0.062) * ss(y, SNOUT.yc - 0.01, SNOUT.yc + 0.01); // 콧등이 두 눈 사이로 이마 경계까지
  const inner = Math.max(ss(f.r, 1.08, 0.84), te, bridge, tb) * ss(Math.abs(x), CHEEK[0], CHEEK[1]);
  const L = CHEEK_LINE;
  const cw = cheekLine(y);
  const cheek = cw == null ? 0 : ss(Math.abs(x), cw + L.soft, cw - L.soft) * ss(y, L.top + L.topSoft, L.top - L.topSoft);
  const top = browTop(x);
  return Math.max(inner, cheek) * ss(y, top + BROW_TOP.soft, top - BROW_TOP.soft);
}
/** 정수리 골 깊이 (머리 좌표, + = 아래로): 가운데를 앞뒤로 지나는 얕은 골 − 골 양옆 둔덕 — 머리 윗부분(y)과 정수리 앞뒤 구간(z)에서만 */
function crownDip(x, y, z) {
  const C = CROWN;
  const u = x - C.x0;
  const win = ss(y, C.y0, C.y1) * ss(z, C.zb - C.soft, C.zb + C.soft) * ss(z, C.zf + C.soft, C.zf - C.soft);
  return (C.depth * Math.exp(-((u / C.sx) ** 2)) - C.lip * Math.exp(-(((Math.abs(u) - C.lx) / C.lw) ** 2))) * win;
}
/** 얼굴 판 색 (머리 좌표 x, y): 밝은 돌 — 주둥이 끝은 닳아 가장 밝고, 눈썹뼈·눈 바로 둘레도 조금 닳아 밝다. 입선·윗눈꺼풀 주름·아래눈꺼풀 선(아주 옅게)은 새긴 홈의 그늘
 *  (곰 2c: 검은 때 0.75 · 0.32 · 0.12 섞음 → 같은 돌을 그만큼 짙게 0.5 · 0.22 · 0.08 — 칠한 선이 아니라 홈의 그늘) */
function faceLight(x, y, f) {
  const C = BEAR_COLORS;
  let lid = 0;
  let skin = 0;
  let under = 0;
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x;
    const dy = y - EYE.y;
    lid = Math.max(lid, Math.exp(-((dx / 0.0135) ** 2)) * ss(dy, 0.004, 0.0085) * ss(dy, 0.016, 0.0105)); // 윗눈꺼풀 위 주름
    const de = Math.hypot(dx / (EYE.w * 0.62), (dy - EYE.h * 0.05) / (EYE.h * 0.78)); // 눈 바로 둘레 (1 ≈ 눈 테두리)
    skin = Math.max(skin, ss(de, 2.1, 1.25));
    under = Math.max(under, Math.exp(-((dx / 0.012) ** 2)) * Math.exp(-(((dy + EYE.h * 0.5) / 0.0024) ** 2))); // 아래눈꺼풀 선 — 아주 옅게
  }
  const c = new THREE.Color(C.light).lerp(new THREE.Color(C.lightTip), ss(f.r, 0.55, 0.12)).lerp(new THREE.Color(C.wornLight), Math.max(0.35 * skin, 0.4 * f.brow));
  return c.multiplyScalar(1 - Math.min(0.55, 0.5 * f.mouth + 0.22 * lid + 0.08 * under));
}
/** 아몬드꼴 (u = 바깥 눈꼬리 쪽, v = 위): 위 눈꺼풀 선은 안쪽이 높고, 바깥 눈꼬리는 droop 만큼 처진다 */
function almondShape(w, h, droop) {
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0);
  sh.bezierCurveTo(-w * 0.25, h * 0.62, w * 0.2, h * 0.56, w / 2, -droop);
  sh.bezierCurveTo(w * 0.2, -h * 0.44 - droop * 0.5, -w * 0.25, -h * 0.4, -w / 2, 0);
  return sh;
}
/**
 * 얼굴 밝은 돌 판 (FACE_PLATE): head = 머리 좌표의 머리·몸 고리(색인 있음).
 *  격자 칸 삼각형을 무늬 세기 0.5 선에서 잘라 판을 짓고, 잘린 선을 따라 판 가장자리에서 바깥 겉면으로 둥글게 내려가는 비탈(FACE_BEVEL)을 두른다
 *  (곰 2 의 곧은 벽 · 벽 밑 때 대신 — 곰 2b). 판·비탈은 머리 좌표 그대로 넣는다
 */
function facePlate(kit, head) {
  const F = FACE_PLATE;
  const C = BEAR_COLORS;
  const nx = Math.round((F.x1 - F.x0) / F.h) + 1;
  const ny = Math.round((F.y1 - F.y0) / F.h) + 1;
  const n = nx * ny;
  const P = head.attributes.position.array;
  const Nr = head.attributes.normal.array;
  const I = head.index.array;
  const gx = (k) => F.x0 + (k % nx) * F.h;
  const gy = (k) => F.y0 + Math.floor(k / nx) * F.h;
  // z 버퍼: 앞을 보는 삼각형을 격자에 그려 맨 앞 겉면 z · 보간 법선. 판 격자(h)보다 SUB 배 촘촘히 그려 둔다 —
  //  판 삼각형이 머리 고리의 볼록한 꺾임(눈두덩·주둥이 둘레)보다 낮아지는 만큼 꼭짓점을 들어 올리려고 (곰 2b: 판이 얇아져 꺾임이 판을 뚫고 비쳤다)
  const SUB = 3;
  const hf = F.h / SUB;
  const nxf = (nx - 1) * SUB + 1;
  const nyf = (ny - 1) * SUB + 1;
  const Zf = new Float32Array(nxf * nyf).fill(-Infinity);
  const Nf = new Float32Array(nxf * nyf * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const [ax, ay, bx, by, cx, cy] = [P[a], P[a + 1], P[b], P[b + 1], P[c], P[c + 1]];
    if (Math.max(ay, by, cy) < F.y0 || Math.min(ay, by, cy) > F.y1 || Math.max(P[a + 2], P[b + 2], P[c + 2]) < 0) continue;
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (det <= 1e-12) continue; // 뒤를 보거나 납작한 삼각형
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - F.x0) / hf));
    const i1 = Math.min(nxf - 1, Math.floor((Math.max(ax, bx, cx) - F.x0) / hf));
    const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - F.y0) / hf));
    const j1 = Math.min(nyf - 1, Math.floor((Math.max(ay, by, cy) - F.y0) / hf));
    for (let j = j0; j <= j1; j++) {
      const py = F.y0 + j * hf;
      for (let i = i0; i <= i1; i++) {
        const px = F.x0 + i * hf;
        const wb = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / det;
        const wc = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / det;
        const wa = 1 - wb - wc;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const z = wa * P[a + 2] + wb * P[b + 2] + wc * P[c + 2];
        const k = j * nxf + i;
        if (z <= Zf[k]) continue;
        Zf[k] = z;
        for (let e = 0; e < 3; e++) Nf[k * 3 + e] = wa * Nr[a + e] + wb * Nr[b + e] + wc * Nr[c + e];
      }
    }
  }
  const Z = new Float32Array(n);
  const Nm = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const kf = Math.floor(k / nx) * SUB * nxf + (k % nx) * SUB;
    Z[k] = Zf[kf];
    for (let e = 0; e < 3; e++) Nm[k * 3 + e] = Nf[kf * 3 + e];
  }
  // 들어 올림: 판 격자 칸의 두 삼각형(아래 tri() 와 같은 대각선) 안 촘촘한 점마다 겉면이 판 평면보다 높은 만큼 그 삼각형 세 꼭짓점을 올린다
  const lift = new Float32Array(n);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const [z00, z10, z11, z01] = [Z[k], Z[k + 1], Z[k + nx + 1], Z[k + nx]];
      if (z00 === -Infinity || z10 === -Infinity || z11 === -Infinity || z01 === -Infinity) continue;
      for (let b = 0; b <= SUB; b++) {
        for (let a = 0; a <= SUB; a++) {
          const zs = Zf[(j * SUB + b) * nxf + i * SUB + a];
          if (zs === -Infinity) continue;
          const [u, v] = [a / SUB, b / SUB];
          const lower = u >= v; // (i,j)·(i+1,j)·(i+1,j+1) 삼각형
          const zp = lower ? z00 + u * (z10 - z00) + v * (z11 - z10) : z00 + v * (z01 - z00) + u * (z11 - z01);
          const e = zs - zp;
          if (e <= 0) continue;
          for (const q of lower ? [k, k + 1, k + nx + 1] : [k, k + nx + 1, k + nx]) lift[q] = Math.max(lift[q], e);
        }
      }
    }
  }
  // 무늬 세기 (경계 폭이 격자 간격보다 넓어 잘린 선이 무늬 세기 0.5 자리에 온다)
  const M = new Float32Array(n);
  const nv = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    if (Z[k] === -Infinity) continue;
    nv.fromArray(Nm, k * 3).normalize().toArray(Nm, k * 3);
    M[k] = faceTone(gx(k), gy(k), faceShape(gx(k), gy(k))) * ss(nv.z, -0.25, 0.2);
  }
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const vmap = new Map();
  const sfc = []; // 판 꼭짓점 밑 실제 겉면 z (들어 올림 빼고 — 비탈 발이 닿는 곳)
  const add = (x, y, z, lz, nX, nY, nZ) => {
    const l = Math.hypot(nX, nY, nZ) || 1;
    const [ux, uy, uz] = [nX / l, nY / l, nZ / l];
    pos.push(x + ux * FACE_STEP, y + uy * FACE_STEP, z + lz + uz * FACE_STEP);
    sfc.push(z);
    nor.push(ux, uy, uz);
    const c = faceLight(x, y, faceShape(x, y));
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  const gv = (k) => {
    if (!vmap.has(k)) vmap.set(k, add(gx(k), gy(k), Z[k], lift[k], Nm[k * 3], Nm[k * 3 + 1], Nm[k * 3 + 2]));
    return vmap.get(k);
  };
  const ev = (ka, kb) => {
    const [lo, hi] = ka < kb ? [ka, kb] : [kb, ka];
    const key = n + lo * n + hi;
    if (!vmap.has(key)) {
      const u = (0.5 - M[lo]) / (M[hi] - M[lo]);
      const L = (q, k, e = 0) => q[k * 3 + e];
      const mix = (fa, fb) => fa + (fb - fa) * u;
      vmap.set(key, add(mix(gx(lo), gx(hi)), mix(gy(lo), gy(hi)), mix(Z[lo], Z[hi]), mix(lift[lo], lift[hi]), mix(L(Nm, lo), L(Nm, hi)), mix(L(Nm, lo, 1), L(Nm, hi, 1)), mix(L(Nm, lo, 2), L(Nm, hi, 2))));
    }
    return vmap.get(key);
  };
  const walls = [];
  const tri = (k0, k1, k2) => {
    const ks = [k0, k1, k2];
    if (ks.some((k) => Z[k] === -Infinity)) return;
    const ins = ks.map((k) => M[k] >= 0.5);
    const cnt = ins.filter(Boolean).length;
    if (cnt === 0) return;
    if (cnt === 3) return void idx.push(gv(k0), gv(k1), gv(k2));
    const r = ins.findIndex((v) => (cnt === 1 ? v : !v)); // 홀로 다른 꼭짓점
    const [A, B, D] = [ks[r], ks[(r + 1) % 3], ks[(r + 2) % 3]];
    const ab = ev(A, B);
    const ad = ev(A, D);
    if (cnt === 1) {
      idx.push(gv(A), ab, ad);
      walls.push([ab, ad, gv(A)]);
    } else {
      idx.push(ab, gv(B), gv(D), ab, gv(D), ad);
      walls.push([ad, ab, gv(B)]);
    }
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      tri(k, k + 1, k + nx + 1);
      tri(k, k + nx + 1, k + nx);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  putColored(kit, g, col).userData.part = 'face';
  g.dispose();
  // 둥근 비탈 (곰 2b): 판 가장자리 꼭짓점마다 겉면 접평면 위 바깥 방향으로 FACE_BEVEL.w 만큼 고리를 내어, 높이는 판 들림 → 겉면(cos² — 어깨·발 모두 둥글게),
  //  법선은 비탈 기울기만큼 바깥으로, 색은 그 가장자리 판 색 → 짙은 돌 (곰 2 의 벽 밑 때 0.45 는 걷음 — 테두리가 검은 선으로 읽혔다).
  //  비탈 발은 겉면 위 0.0001 — 머리 고리와 이음매 없이 만난다
  const V = (i, q) => new THREE.Vector3(q[i * 3], q[i * 3 + 1], q[i * 3 + 2]);
  const outAcc = new Map(); // 가장자리 꼭짓점 → 바깥 방향 누적 (가장자리 길이 무게)
  for (const [e1, e2, inner] of walls) {
    const a = V(e1, pos);
    const b = V(e2, pos);
    const t = new THREE.Vector3().subVectors(b, a);
    const o = new THREE.Vector3().crossVectors(t, V(e1, nor).add(V(e2, nor)));
    if (o.lengthSq() < 1e-24) continue;
    if (o.dot(a.add(b).multiplyScalar(0.5).sub(V(inner, pos))) < 0) o.negate();
    o.setLength(t.length());
    for (const e of [e1, e2]) {
      if (!outAcc.has(e)) outAcc.set(e, new THREE.Vector3());
      outAcc.get(e).add(o);
    }
  }
  const BV = FACE_BEVEL;
  const R = BV.rings.length;
  const lift0 = 0.0001;
  const dark = new THREE.Color(C.dark);
  const bp = [];
  const bn = [];
  const bc = [];
  const bi = [];
  const ring = new Map(); // 가장자리 꼭짓점 → 비탈 고리 첫 꼭짓점 번호
  const ringOf = (e) => {
    if (ring.has(e)) return ring.get(e);
    const nE = V(e, nor);
    const base = V(e, pos).addScaledVector(nE, -FACE_STEP); // 판 가장자리 밑 (들어 올림 포함)
    const out = (outAcc.get(e) || new THREE.Vector3()).clone();
    out.addScaledVector(nE, -out.dot(nE));
    if (out.lengthSq() > 1e-24) out.normalize();
    // 비탈 발: 실제 겉면 자리에서 접평면 위 바깥으로 w — 겉면이 옆·아래로 돌아가는 곳(턱 밑 · 앞을 덜 보는 곳)일수록 비탈을 좁혀
    //  (법선 z 0.4 → 0.1 에서 1 → 0) 허공에 뜨지 않게, 이웃 꼭짓점끼리 매끈하게
    const w = Math.max(1e-6, BV.w * ss(nE.z, 0.1, 0.4));
    const foot = new THREE.Vector3(base.x, base.y, sfc[e]).addScaledVector(out, w);
    const c0 = new THREE.Color(col[e * 3], col[e * 3 + 1], col[e * 3 + 2]);
    const first = bp.length / 3;
    for (const s of BV.rings) {
      const h = lift0 + (FACE_STEP - lift0) * Math.cos((Math.PI * s) / 2) ** 2;
      const p = base.clone().lerp(foot, s).addScaledVector(nE, h);
      const slope = ((FACE_STEP - lift0) * (Math.PI / 2) * Math.sin(Math.PI * s)) / w; // 높이가 바깥 거리에 따라 내려가는 기울기 (−dh/d거리)
      const nb = nE.clone().addScaledVector(out, slope).normalize();
      const c = c0.clone().lerp(dark, ss(s, 0, 1));
      bp.push(p.x, p.y, p.z);
      bn.push(nb.x, nb.y, nb.z);
      bc.push(c.r, c.g, c.b);
    }
    ring.set(e, first);
    return first;
  };
  for (const [e1, e2] of walls) {
    if (!outAcc.has(e1) || !outAcc.has(e2)) continue;
    const r1 = ringOf(e1);
    const r2 = ringOf(e2);
    // 감김이 겉면 바깥(법선 쪽)을 보게
    const f = V(r2, bp).sub(V(r1, bp)).cross(V(r1 + 1, bp).sub(V(r1, bp)));
    const flip = f.dot(V(r1, bn)) < 0;
    for (let k = 0; k < R - 1; k++) {
      const [a, b, c, d] = [r1 + k, r2 + k, r2 + k + 1, r1 + k + 1];
      if (flip) bi.push(a, c, b, a, d, c);
      else bi.push(a, b, c, a, c, d);
    }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  bg.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  bg.setIndex(bi);
  putColored(kit, bg, bc).userData.part = 'face';
  bg.dispose();
}
/** 아몬드꼴 테두리 점 [[x, y], …] (almondShape — 첫 div + 1 점이 윗눈꺼풀 선) — side < 0 이면 거울 (오른눈은 바깥이 −x) */
function almondPts(w, h, droop, side, div) {
  const pts = almondShape(w, h, droop).getPoints(div).map((v) => [v.x * (side < 0 ? -1 : 1), v.y]);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts.pop();
  return pts;
}
/** 타원 테두리 점 (가운데 cx, cy · 반지름 rx, ry · n 점) */
const ovalPts = (cx, cy, rx, ry, n) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * TAU), cy + ry * Math.sin((i / n) * TAU)]);
/**
 * 판 자리 조각 (곰 2c): 닫힌 테두리 outline 을 그 무게중심 쪽으로 겹(rings: s 1 = 테두리 → 0 = 가운데 점)으로 줄여 잇는 평평한 판 (조각 좌표 +z 가 겉).
 *  돌려줌: { g: 색인 BufferGeometry(법선 +z — 부르는 쪽이 고친다), xy: 꼭짓점마다 [x, y], s: 꼭짓점마다 겹 자리 }
 */
function dish(outline, rings) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  outline.forEach(([x0, y0], i) => {
    const [x1, y1] = outline[(i + 1) % outline.length];
    const cr = x0 * y1 - x1 * y0;
    area += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  });
  [cx, cy] = [cx / (3 * area), cy / (3 * area)];
  const ol = area < 0 ? [...outline].reverse() : outline; // 반시계로 (앞면이 +z)
  const n = ol.length;
  const pos = [];
  const xy = [];
  const sv = [];
  for (const s of rings) {
    for (const [x, y] of s === 0 ? [[cx, cy]] : ol.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s])) {
      pos.push(x, y, 0);
      xy.push([x, y]);
      sv.push(s);
    }
  }
  const idx = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const [a0, b0] = [r * n, (r + 1) * n];
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      if (rings[r + 1] === 0) idx.push(a0 + i, a0 + i2, b0);
      else idx.push(a0 + i, a0 + i2, b0 + i2, a0 + i, b0 + i2, b0 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  return { g, xy, s: sv };
}
/**
 * 곰 2c 눈 그늘 마당 (눈 조각 좌표 — 눈알 아몬드 원점, 바깥 눈꼬리 쪽으로 처짐·기울임은 틀이 진다): (x, y) → { a, gx, gy }.
 *  a = 그 자리 판 돌빛 → 가장 깊은 그늘 섞음, (gx, gy) = 법선 기울기 (법선 = (gx, gy, 1) 정규화). 모든 겹이 같은 마당을 읽어 겹 경계가 안 보인다 (EYE_CARVE)
 */
function eyeField(side, rimLift) {
  const E = EYE;
  const K = EYE_CARVE;
  const DIV = 40;
  const ball = almondPts(E.w, E.h, E.droop, side, DIV);
  const top = ball.slice(0, DIV + 1).sort((p, q) => p[0] - q[0]); // 눈알 윗선 (윗눈꺼풀 선 자리)
  const topEdge = (x) => {
    if (x <= top[0][0]) return top[0][1];
    for (let i = 1; i < top.length; i++) if (x <= top[i][0]) return top[i - 1][1] + ((top[i][1] - top[i - 1][1]) * (x - top[i - 1][0])) / (top[i][0] - top[i - 1][0] || 1);
    return top[top.length - 1][1];
  };
  const ys = ball.map((p) => p[1]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const [cy, ax, ay] = [(y0 + y1) / 2, E.w / 2, (y1 - y0) / 2];
  const [ox, oy] = [-side * E.w * 0.04, E.h * 0.03]; // 홍채 · 눈동자 가운데 (곰 2 그대로)
  const ir = [E.h * E.iris, E.h * E.iris * 1.04];
  const pr = [E.h * E.pupil, E.h * E.pupil * 1.05];
  const [bx, by] = [-side * E.w * 0.1, E.h * 0.2]; // 돌 다리 (1e 반사점 자리)
  const lidH = E.h * 0.2 + rimLift * 0.5; // 윗눈꺼풀 그늘 띠 높이 (눈알 윗선에서 위로)
  return (x, y) => {
    const e = Math.hypot(x / ax, (y - cy) / ay);
    const d = y - topEdge(x);
    const fade = ss(e, 1.15, 0.9);
    let gx = (-K.slope * x * fade) / ax;
    let gy = (-K.slope * (y - cy) * fade) / ay;
    let a;
    if (d > 0) {
      // 윗눈꺼풀 그늘: 눈알 윗선에서 가장 짙고 위로 옅어진다 · 법선은 아래로 (해를 덜 받는 눈꺼풀 밑 벽)
      a = K.lidIn * ss(d, lidH, lidH * 0.1);
      gy = Math.min(gy, -K.lidSlope * ss(d, lidH, 0));
      gx *= ss(d, lidH * 0.5, 0);
    } else {
      a = (K.ballRim + (K.ball - K.ballRim) * ss(e, 1, 0.7) + (K.ballTop - K.ball) * ss((y - cy) / ay, -0.1, 0.8)) * ss(e, 1.25, 1.0);
    }
    const ri = Math.hypot((x - ox) / ir[0], (y - oy) / ir[1]);
    if (ri < 1) a += (Math.max(a, K.iris) - a) * ss(ri, 1, 0.6);
    const rp = Math.hypot((x - ox) / pr[0], (y - oy) / pr[1]);
    if (rp < 1) {
      a += (K.pupil - a) * ss(rp, 1, 0.3);
      const tilt = 0.8 * K.slope * Math.sin(Math.PI * rp); // 얕게 판 눈동자 오목 — 가운데·테두리 0
      gx -= (tilt * (x - ox)) / (pr[0] * (rp || 1));
      gy -= (tilt * (y - oy)) / (pr[1] * (rp || 1));
    }
    const rb = Math.hypot(x - bx, y - by) / E.shine;
    if (rb < 1) {
      a += (K.bridge - a) * ss(rb, 1, 0.35);
      gy += 0.5 * ss(rb, 1, 0.3); // 남은 돌 — 위를 조금 보아 빛을 받는다
    }
    return { a, gx, gy };
  };
}

const PLAIN = { vary: 0, noise: 0 };
const TURN = new THREE.Matrix4().compose(new THREE.Vector3(...HEAD_CENTER), new THREE.Quaternion().setFromEuler(new THREE.Euler(HEAD_TURN.pitch, HEAD_TURN.yaw, HEAD_TURN.roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
const TURN_INV = TURN.clone().invert();

// ── 조형 ────────────────────────────────────────────────
function sculpt(kit) {
  const C = BEAR_COLORS;
  const I = new THREE.Matrix4();
  // 머리·목·몸통 한 고리 (정수리 ~ 가랑이) — 정수리 골·얼굴을 깎고 짙은 돌·때까지 headAndBody() 가 짓는다 (밝은 돌 무늬는 faceParts 의 얼굴 판)
  const body = headAndBody(kit);
  const surf = { body: body.info };
  const worn = new THREE.Color(C.worn);
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'R' : 'L';
    const thighG = loftY(mirror(side, THIGH), 18);
    const thigh = kit.putM('bear', thighG, C.dark, I, PLAIN);
    weather(thigh, `thigh${k}`);
    surf[`thigh${k}`] = surfaceInfo(thighG, thigh);
    // 발: 발목 아래에서 앞으로 (발끝 살짝 안쪽) — 발가락 끝 윗면은 닳아 밝게, 발바닥 둘레 이끼.
    //  곰 2c: 고리를 촘촘히(footLoft — 겉면 그대로) · 닳음을 먼저 칠하고 오래된 돌 겉(젖은 띠 · 진흙 튐)을 그 위에 (젖은 발이 닳은 끝까지 짙게)
    const fm = new THREE.Matrix4().compose(new THREE.Vector3(side * 0.129, 0, -0.004), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * FOOT_TOE_IN), new THREE.Vector3(1, 1, 1));
    const footG = footLoft();
    const foot = kit.putM('bear', footG, C.dark, fm, PLAIN);
    footG.dispose();
    paint(foot, (p, n, col, i) => {
      const m = 0.42 * ss(p.z, 0.05, 0.095) * ss(n.y + 0.6 * n.z, 0.2, 0.9);
      return m > 0 ? new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).lerp(worn, m) : null;
    });
    weather(foot, `foot${k}`);
    if (side < 0) chipAt(foot, new THREE.Vector3(side * 0.118, 0.019, 0.094), 0.011, 0.005, new THREE.Vector3(0, -0.6, -0.8).normalize(), C.chip); // 오른발 앞 모서리 작은 깨짐
    // 팔·앞발: 주먹(앞발 앞·위)은 닳아 밝게
    const armG = loftY(mirror(side, ARM), 18);
    const arm = kit.putM('bear', armG, C.dark, I, PLAIN);
    weather(arm, `arm${k}`);
    paint(arm, (p, n, col, i) => {
      const m = 0.4 * ss(1 - p.y, 0.55, 0.6) * ss(n.z + 0.35 * n.y + 0.25 * n.x * side, 0.15, 0.85);
      return m > 0 ? new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).lerp(worn, m) : null;
    });
    surf[`arm${k}`] = surfaceInfo(armG, arm);
    if (side === PAW_CHIP.side) {
      const [, rx, , rd, rz] = ARM.find((r) => r[0] === PAW_CHIP.t);
      chipAt(arm, new THREE.Vector3(side * rx, tY(PAW_CHIP.t), rz + rd), PAW_CHIP.r, PAW_CHIP.depth, new THREE.Vector3(0, -0.45, -0.9).normalize(), C.chip, false); // 주먹 앞 모서리 작은 깨짐 (곰 2c — 닳은 주먹이라 깨진 면도 둥글게: 법선 그대로)
    }
    claws(kit, side);
  }
  chestPatch(kit, body.info);
  chisel(kit, surf);
  lichenSpots(kit, surf);
  faceParts(kit, body.info.mesh);
  for (const s of Object.values(surf)) {
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
  }
}

/** 발톱 다섯(밝은 돌): 앞발 덩어리 끝 안쪽·앞에 모여 아래로 내려가다 몸 쪽·뒤로 휜 긴 갈고리 (사진: 발 안쪽 아래에서 나와 t 0.66~0.68 까지).
 *  곰 오른 앞발 둘째 발톱은 끝 마디가 부러졌다 (BROKEN_CLAW — 끝이 평평하고 새 돌빛) */
function claws(kit, side) {
  const C = BEAR_COLORS;
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
    const broken = side === BROKEN_CLAW.side && k === BROKEN_CLAW.k;
    for (let i = 0; i < (broken ? 2 : 3); i++) {
      const A = new THREE.Vector3(...pts[i]);
      const B = new THREE.Vector3(...pts[i + 1]);
      if (broken && i === 1) B.lerp(A, 0.25); // 둘째 마디 끝 4 분의 1 에서 부러짐
      const dir = B.clone().sub(A);
      const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), new THREE.Vector3(1, 1, 1));
      const g = new THREE.CylinderGeometry(broken && i === 1 ? r[i + 1] * 1.2 : r[i + 1], r[i], dir.length(), 7, 1, false);
      const out = kit.putM('bear', g, C.light, m, { vary: 0.03, noise: 0 });
      weather(out, `claw${side < 0 ? 'R' : 'L'}`);
      if (broken && i === 1) chipAt(out, B, CLAW.rBase * 0.9, 0, dir.clone().normalize(), C.chip); // 부러진 끝 — 새 돌빛
      g.dispose();
    }
  }
}

/** 가슴 말굽 양각: 줄마다 잰 칸을 왼쪽·오른쪽 반 띠 격자로 이어 몸 겉면에서 RELIEF.lift 만큼 띄운 밝은 돌 판 + 둘레 음각 홈(벽 · 홈 바닥 · 바깥 둔덕 ·
 *  몸에 녹아드는 끝 — 끝 고리는 몸의 법선·색을 그대로 읽어 이음매가 없다) + 아래쪽 드릴 점 넷 */
function chestPatch(kit, bodyInfo) {
  const C = BEAR_COLORS;
  const info = subInfo(bodyInfo, (y, z) => y > 0.6 && y < 0.86 && z > 0); // 가슴 앞 삼각형만 (광선 약 540 개)
  const N = 6; // 반 띠마다 가로 나눔
  const lift = RELIEF.lift;
  const top = new THREE.Color(C.light).multiplyScalar(0.94);
  const bot = new THREE.Color(C.light);
  const base = []; // 격자 꼭짓점마다 몸 겉면 { point, normal }
  const pos = [];
  const cols = [];
  const idx = [];
  const halves = (row) => (row[2] == null ? [[row[1], CHEST_MID], [CHEST_MID, row[4]]] : [[row[1], row[2]], [row[3], row[4]]]);
  const per = 2 * (N + 1);
  const from = new THREE.Vector3();
  const back = new THREE.Vector3(0, 0, -1);
  CHEST.forEach((row, j) => {
    // 아래 가장자리는 조금 울퉁불퉁 (사진 털 끝)
    const wob = (x) => (row[2] == null ? 0.0012 * Math.sin(x * 140 + j) : 0); // 곰 2: 털 끝 울퉁불퉁 0.0025 → 0.0012 (깎은 돌 테두리)
    const edge = (x) => 0.0007 * Math.sin(j * 2.3 + x * 90); // 바깥 테두리 살짝 불규칙 (곰 2: 0.0018 → 0.0007 — 줄마다 엇갈려 톱니처럼 보이지 않게)
    for (const [h0, [a, b]] of halves(row).entries()) {
      for (let i = 0; i <= N; i++) {
        const outer = (h0 === 0 && i === 0) || (h0 === 1 && i === N);
        const x = a + ((b - a) * i) / N + (outer ? edge(a + b) * (h0 ? 1 : -1) : 0);
        const t = row[0] + (i === 0 || i === N ? wob(x) : 0);
        const s = surfaceAt(info, from.set(x, tY(t), 1), back) || { point: new THREE.Vector3(x, tY(t), 0.11), normal: new THREE.Vector3(0, 0, 1) };
        base.push(s);
        pos.push(s.point.x + s.normal.x * lift, s.point.y + s.normal.y * lift, s.point.z + s.normal.z * lift);
        const c = top.clone().lerp(bot, S(t, 0.24, 0.334)); // 아래쪽이 아주 조금 밝다 (사진의 주황 → 크림을 돌 한 톤 안에서)
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
  g.computeVertexNormals(); // 판 안에서 부드럽게 (몸 겉면과 거의 같은 법선)
  const plateOut = putColored(kit, g, cols);
  weather(plateOut, 'plate');
  const plateMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); // 드릴 점 둘레 색을 판에서 읽으려고 (곰 2c)

  // 판 둘레 한 바퀴 (반시계 — 왼쪽 바깥 ↓ · 아래 끝 → · 오른쪽 바깥 ↑ · 오른 팔 윗변 ← · 파임 오른쪽 ↓ · 파임 바닥 · 파임 왼쪽 ↑ · 왼 팔 윗변 ←)
  const J = CHEST.length;
  const lastNotch = CHEST.map((row) => row[2] != null).lastIndexOf(true);
  const vid = (j, h, i) => j * per + h * (N + 1) + i;
  const loop = [];
  for (let j = 0; j < J; j++) loop.push(vid(j, 0, 0));
  for (let i = 1; i <= N; i++) loop.push(vid(J - 1, 0, i));
  for (let i = 1; i <= N; i++) loop.push(vid(J - 1, 1, i));
  for (let j = J - 2; j >= 0; j--) loop.push(vid(j, 1, N));
  for (let i = N - 1; i >= 0; i--) loop.push(vid(0, 1, i));
  for (let j = 1; j <= lastNotch + 1; j++) loop.push(vid(j, 1, 0));
  for (let j = lastNotch; j >= 1; j--) loop.push(vid(j, 0, N));
  for (let i = N; i >= 1; i--) loop.push(vid(0, 0, i));
  // 홈 고리: 판 가장자리(벽 위) + RELIEF.rings — 바깥 방향은 몸 겉면을 따라 (밑면 법선 × 둘레 방향, 둘레가 반시계라 2D 바깥 = (dY, −dx))
  const K = loop.length;
  const R = RELIEF.rings.length + 1;
  const rp = [];
  const rn = [];
  const rc = [];
  const dark = new THREE.Color(C.dark);
  const o = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let k = 0; k < K; k++) {
    const s = base[loop[k]];
    const sPrev = base[loop[(k + K - 1) % K]].point;
    const sNext = base[loop[(k + 1) % K]].point;
    tan.subVectors(sNext, sPrev);
    o.crossVectors(tan, s.normal).normalize();
    if (o.x * tan.y - o.y * tan.x < 0) o.negate(); // 2D 바깥 (dY, −dx) 쪽으로
    // 벽 위 = 판 가장자리 그대로 (꼭짓점은 따로 — 판 모서리가 또렷하게)
    rp.push(pos[loop[k] * 3], pos[loop[k] * 3 + 1], pos[loop[k] * 3 + 2]);
    rn.push(0, 0, 0);
    rc.push(cols[loop[k] * 3], cols[loop[k] * 3 + 1], cols[loop[k] * 3 + 2]);
    RELIEF.rings.forEach(([dist, h], r) => {
      const q = s.point.clone().addScaledVector(o, dist);
      const hit = surfaceAt(info, q.clone().addScaledVector(s.normal, 0.03), dir.copy(s.normal).negate()) || { point: q, normal: s.normal, color: dark };
      rp.push(hit.point.x + hit.normal.x * h, hit.point.y + hit.normal.y * h, hit.point.z + hit.normal.z * h);
      rn.push(hit.normal.x, hit.normal.y, hit.normal.z);
      const last = r === RELIEF.rings.length - 1;
      // 벽 발 · 홈 바닥은 같은 돌의 그늘(곰 2c: 검은 때 0.62 섞음 → 몸 돌빛 × 0.78 · 0.7 — 그려진 검은 선이 아니라 얕은 홈) · 둔덕 조금 닳음
      const c = last ? hit.color : r < 2 ? hit.color.clone().multiplyScalar(r === 0 ? 0.78 : 0.7) : hit.color.clone().lerp(new THREE.Color(C.worn), 0.08);
      rc.push(c.r, c.g, c.b);
    });
  }
  const ri = [];
  for (let k = 0; k < K; k++) {
    const k2 = (k + 1) % K;
    for (let r = 0; r < R - 1; r++) {
      const a = k * R + r;
      const b = k2 * R + r;
      ri.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rg.setIndex(ri);
  rg.computeVertexNormals();
  // 감김이 몸 바깥을 보게 (첫 고리 둔덕 법선과 몸 법선 비교)
  const nn = rg.attributes.normal;
  if (nn.getX(3) * rn[9] + nn.getY(3) * rn[10] + nn.getZ(3) * rn[11] < 0) {
    for (let i = 0; i < ri.length; i += 3) [ri[i + 1], ri[i + 2]] = [ri[i + 2], ri[i + 1]];
    rg.setIndex(ri);
    rg.computeVertexNormals();
  }
  for (let k = 0; k < K; k++) {
    const v = k * R + R - 1; // 끝 고리는 몸 법선 그대로 (이음매 없이)
    nn.setXYZ(v, rn[v * 3], rn[v * 3 + 1], rn[v * 3 + 2]);
  }
  const ring = putColored(kit, rg, rc);
  // 벽·홈·둔덕만 때·바램 (끝 고리는 이미 몸 색)
  const rcol = ring.attributes.color;
  const keep = rcol.array.slice();
  weather(ring, 'relief');
  const order = rg.index.array;
  for (let k = 0; k < order.length; k++) if (order[k] % R === R - 1) rcol.setXYZ(k, keep[k * 3], keep[k * 3 + 1], keep[k * 3 + 2]);
  rg.dispose();
  // 아래쪽 점 넷: 드릴로 판 얕은 점 (판 겉면을 보게 · 판 위). 곰 2c: 짙은 원판(0x5d605f) 대신 얕게 판 오목 — 둘레는 판 돌빛 그대로, 가운데로 갈수록
  //  가장 깊은 그늘 쪽으로 SOFT_PIT.chestDot, 법선은 가운데 쪽으로 기운다
  const deep = new THREE.Color(C.dark).multiplyScalar(DEEP);
  const pc = plateOut.attributes.color;
  for (const [x, t, r] of CHEST_SPOTS) {
    const s = surfaceAt(info, from.set(x, tY(t), 1), back);
    if (!s) continue;
    const { g: sp, xy, s: sv } = dish(ovalPts(0, 0, r, r, 10), [1, 0.5, 0]);
    xy.forEach(([px, py], k) => {
      const v = new THREE.Vector3((-SOFT_PIT.slope * px) / r, (-SOFT_PIT.slope * py) / r, 1).normalize();
      sp.attributes.normal.setXYZ(k, v.x, v.y, v.z);
    });
    sp.applyMatrix4(new THREE.Matrix4().compose(s.point.clone().addScaledVector(s.normal, lift + 0.0005), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.normal), new THREE.Vector3(1, 1, 1)));
    // 꼭짓점(색인)마다 밑 판 색을 읽어 둘레가 판과 이어지게
    const SP = sp.attributes.position;
    const v = new THREE.Vector3();
    const cols = [];
    for (let k = 0; k < SP.count; k++) {
      const h = hitOn(plateMesh, v.fromBufferAttribute(SP, k).addScaledVector(s.normal, 0.01), s.normal.clone().negate());
      const base = new THREE.Color(0, 0, 0);
      if (!h) base.set(C.light);
      else for (const [j, w] of [[0, h.barycoord.x], [1, h.barycoord.y], [2, h.barycoord.z]]) base.add(new THREE.Color(pc.getX(h.faceIndex * 3 + j), pc.getY(h.faceIndex * 3 + j), pc.getZ(h.faceIndex * 3 + j)).multiplyScalar(w));
      cols.push(...base.lerp(deep, SOFT_PIT.chestDot * ss(sv[k], 1, 0.15)).toArray());
    }
    putColored(kit, sp, cols);
    sp.dispose();
  }
  plateMesh.material.dispose();
  g.dispose();
  info.mesh.geometry.dispose();
}

/** 끌 자국: CHISEL 의 선마다 밑면(몸·팔·허벅지)에 붙인 가는 V 홈 — 가장자리는 밑면 색·법선 그대로, 가운데는 같은 돌의 그늘, 두 벽 법선을 서로 기울여 한쪽은 빛을 받는다.
 *  곰 2c (잔디테일은 무디게): 가운데 검은 때 0.6 섞음 → 밑면 돌빛 × (1 − 0.3) · 벽 기울임 0.5 → 0.35 — 오래 닳아 무뎌진 홈 */
function chisel(kit, surf) {
  const axis = {
    body: (t) => [HEAD_SHIFT * (1 - S(t, 0.13, 0.19)), bodyRing(Math.min(t, 0.817))[2]],
    armL: (t) => lerpRow(ARM, t, 1),
    armR: (t) => lerpRow(ARM, t, -1),
    thighL: (t) => lerpRow(THIGH, t, 1),
    thighR: (t) => lerpRow(THIGH, t, -1),
  };
  const M = 9;
  for (const [where, pts, width] of CHISEL) {
    const info = surf[where];
    const samples = [];
    for (let k = 0; k < M; k++) {
      const u = k / (M - 1);
      const f = u * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(f));
      const w = f - i;
      const t = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * w;
      const phi = (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * w) * (where.endsWith('R') ? -1 : 1); // 오른 팔·다리는 거울
      const [cx, cz] = axis[where](t);
      const s = surfaceAt(info, new THREE.Vector3(cx + Math.sin(phi) * 0.5, tY(t), cz + Math.cos(phi) * 0.5), new THREE.Vector3(-Math.sin(phi), 0, -Math.cos(phi)));
      if (s) samples.push({ ...s, taper: Math.sin(Math.PI * u) ** 0.6 });
    }
    if (samples.length < 3) continue;
    const pos = [];
    const nor = [];
    const col = [];
    const idx = [];
    const B = new THREE.Vector3();
    samples.forEach((s, k) => {
      const a = samples[Math.max(0, k - 1)].point;
      const b = samples[Math.min(samples.length - 1, k + 1)].point;
      B.subVectors(b, a).cross(s.normal).normalize(); // 선을 가로지르는 방향 (밑면 위)
      const hw = (width / 2) * s.taper;
      const groove = s.color.clone().multiplyScalar(1 - 0.3 * s.taper);
      const tilt = 0.35 * s.taper;
      const put = (off, lift, tiltSign, c) => {
        pos.push(s.point.x + B.x * off + s.normal.x * lift, s.point.y + B.y * off + s.normal.y * lift, s.point.z + B.z * off + s.normal.z * lift);
        const nv = s.normal.clone().addScaledVector(B, tiltSign * tilt).normalize();
        nor.push(nv.x, nv.y, nv.z);
        col.push(c.r, c.g, c.b);
      };
      put(hw, 0.00045, 0, s.color); // 가장자리 (+B)
      put(0, 0.00025, -1, groove); // 가운데 (+B 쪽 벽 — 법선이 −B 로 기운다)
      put(0, 0.00025, 1, groove); // 가운데 (−B 쪽 벽)
      put(-hw, 0.00045, 0, s.color); // 가장자리 (−B)
      if (k === 0) return;
      const p0 = (k - 1) * 4;
      const p1 = k * 4;
      idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1, p0 + 2, p1 + 2, p0 + 3, p1 + 2, p1 + 3, p0 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    // 감김이 밖을 보게 (첫 사각형의 면 법선과 밑면 법선 비교)
    const f0 = new THREE.Triangle(new THREE.Vector3().fromArray(pos, idx[0] * 3), new THREE.Vector3().fromArray(pos, idx[1] * 3), new THREE.Vector3().fromArray(pos, idx[2] * 3)).getNormal(new THREE.Vector3());
    if (f0.dot(samples[1].normal) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
    }
    putColored(kit, g, col);
    g.dispose();
  }
}
/** 지의류 딱지 (곰 2c, LICHEN_BEAR): 밑면 겉면 자리에서 접평면 위 들쭉날쭉한 조각 셋을 그리고, 꼭짓점마다 밑면으로 광선을 쏘아 겉면에 얇게 붙인다.
 *  색은 밑면 돌빛(이미 오래된 돌 겉)에 지의류 빛을 섞음 — 가운데 0.72 · 가장자리 0.55 */
function lichenSpots(kit, surf) {
  const C = BEAR_COLORS;
  const axis = {
    body: (t) => [HEAD_SHIFT * (1 - S(t, 0.13, 0.19)), bodyRing(Math.min(t, 0.817))[2]],
    armL: (t) => lerpRow(ARM, t, 1),
    armR: (t) => lerpRow(ARM, t, -1),
    thighL: (t) => lerpRow(THIGH, t, 1),
    thighR: (t) => lerpRow(THIGH, t, -1),
  };
  const up = new THREE.Vector3(0, 1, 0);
  LICHEN_BEAR.forEach(([where, t, phi0, r, warm], n) => {
    const info = surf[where];
    const phi = phi0 * (where.endsWith('R') ? -1 : 1);
    const [cx, cz] = axis[where](t);
    const at = surfaceAt(info, new THREE.Vector3(cx + Math.sin(phi) * 0.5, tY(t), cz + Math.cos(phi) * 0.5), new THREE.Vector3(-Math.sin(phi), 0, -Math.cos(phi)));
    if (!at) return;
    const tu = up.clone().cross(at.normal).normalize();
    const tv = at.normal.clone().cross(tu).normalize();
    const near = r * 3 + 0.012;
    const sub = subInfo(info, (y, z, x) => Math.abs(y - at.point.y) < near && Math.abs(z - at.point.z) < near && Math.abs(x - at.point.x) < near);
    const tint = new THREE.Color(warm ? C.lichenWarm : C.lichen);
    const pos = [];
    const nor = [];
    const cols = [];
    const idx = [];
    const SEG = 12;
    const put = (u, v, k) => {
      const q = at.point.clone().addScaledVector(tu, u).addScaledVector(tv, v);
      const h = surfaceAt(sub, q.clone().addScaledVector(at.normal, 0.02), at.normal.clone().negate()) || { point: q, normal: at.normal, color: at.color };
      pos.push(...h.point.clone().addScaledVector(h.normal, 0.0005).toArray());
      nor.push(...h.normal.toArray());
      cols.push(...h.color.clone().lerp(tint, k).toArray());
    };
    [[r, 0, 0], [r * 0.6, r * 0.85, r * 0.32], [r * 0.45, -r * 0.62, -r * 0.7]].forEach(([br, ox, oy], b) => {
      const c0 = pos.length / 3;
      const seed = n * 3 + b;
      put(ox, oy, 0.72);
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * TAU;
        const k = 0.72 + 0.28 * Math.abs(Math.sin(i * 2.7 + seed * 1.9)) + 0.2 * Math.sin(i * 0.9 + seed);
        put(ox + Math.cos(a) * br * k, oy + Math.sin(a) * br * k, 0.55);
      }
      for (let i = 0; i < SEG; i++) idx.push(c0, c0 + 1 + i, c0 + 1 + ((i + 1) % SEG));
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    // 감김이 밖(밑면 법선 쪽)을 보게
    const f0 = new THREE.Triangle(...[0, 1, 2].map((j) => new THREE.Vector3().fromArray(pos, idx[j] * 3))).getNormal(new THREE.Vector3());
    if (f0.dot(at.normal) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      g.setIndex(idx);
    }
    putColored(kit, g, cols);
    g.dispose();
    sub.mesh.geometry.dispose();
  });
}
/** 발 고리 (곰 2c): FOOT 표 고리 사이마다 가운데 고리를 끼운 loftZ — 끼운 고리는 원래 곧은 띠 위라 겉면은 곰 2 그대로, 법선도 원래 고리 법선(끼운 고리는 앞뒤 평균)을
 *  이어 받아 음영이 같다. 발등 진흙 튐(WEATHER.mud)이 꼭짓점 사이에서 뭉개지지 않게 */
function footLoft() {
  const SIDES = 16;
  const rows = FOOT.map(([z, w, h, y]) => [z, w, h, 0, y]);
  const fine = [];
  rows.forEach((r, j) => {
    if (j) fine.push(r.map((v, k) => (v + rows[j - 1][k]) / 2));
    fine.push(r);
  });
  const coarse = loftZ(rows, SIDES, 0.9);
  const g = loftZ(fine, SIDES, 0.9);
  const cn = coarse.attributes.normal;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  for (let j = 0; j < fine.length; j++) {
    for (let i = 0; i < SIDES; i++) {
      if (j % 2 === 0) v.fromBufferAttribute(cn, (j / 2) * SIDES + i);
      else v.fromBufferAttribute(cn, ((j - 1) / 2) * SIDES + i).add(w.fromBufferAttribute(cn, ((j + 1) / 2) * SIDES + i)).normalize();
      g.attributes.normal.setXYZ(j * SIDES + i, v.x, v.y, v.z);
    }
  }
  coarse.dispose();
  return g;
}
/** 다리·팔 표의 축 [cx, cz] 를 t 로 (선형) */
function lerpRow(rows, t, side) {
  let i = 0;
  while (i < rows.length - 2 && t > rows[i + 1][0]) i++;
  const [t0, x0, , , z0] = rows[i];
  const [t1, x1, , , z1] = rows[i + 1];
  const w = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  return [side * (x0 + (x1 - x0) * w), z0 + (z1 - z0) * w];
}

/** 머리·목·몸통 한 고리(앞쪽 촘촘): 머리 좌표에서 정수리 골을 꺼뜨리고(곰 2), 앞으로 밀어 주둥이·아래턱·눈자리를 깎는다.
 *  색은 모두 짙은 돌 + 정수리 골의 때 + 오래된 돌 겉(weather) — 밝은 돌 무늬는 얼굴 판(facePlate)이 진다.
 *  머리통 고리는 고개 돌림만큼 비틀어(목에서 0) 얼굴 쪽 깎기·칠·조각과 함께 돈다 (1d) */
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
    v.y -= crownDip(v.x, v.y, v.z); // 정수리 가운데 앞뒤로 얕은 골 (곰 2)
    if (v.z > 0) {
      const f = faceShape(v.x, v.y);
      v.z += f.d * S(v.z, 0, 0.04);
    }
    v.applyMatrix4(TURN);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const headMesh = kit.putM('bear', g, C.dark, new THREE.Matrix4(), PLAIN);
  const hp = new THREE.Vector3();
  // 정수리 골 (새긴 홈 — 바램을 덜고 그늘을 더한다). 곰 2c: 골 바닥 때 0.32 → 0.14(확인표 1294), 대신 위를 보는 골 안에 이끼(1295)
  const groove = (p, n) => {
    hp.copy(p).applyMatrix4(TURN_INV);
    const k = ss(crownDip(hp.x, hp.y + crownDip(hp.x, hp.y, hp.z), hp.z) / CROWN.depth, 0.2, 0.9);
    return { cav: 0.14 * k, moss: k * ss(n.y, 0.2, 0.6) * (0.45 + 0.55 * mossPatch(p)) };
  };
  weather(headMesh, 'body', groove);
  return { mesh: headMesh, info: surfaceInfo(g, headMesh) };
}

/** 얼굴 조각: 코(콧구멍)·얼굴 밝은 돌 판·눈(돌 조각)·귀 — 머리 좌표에서 붙이고 고개 돌림(TURN)을 얹는다.
 *  곰 2c: 눈 · 콧구멍은 판 자리의 그늘(EYE_CARVE · SOFT_PIT — 색은 맨 끝에, 둘레 돌빛이 정해진 뒤 칠한다), 귀는 오목한 컵(EAR_CUP) */
function faceParts(kit, bodyMesh) {
  const C = BEAR_COLORS;
  const headLocal = new THREE.Mesh(bodyMesh.geometry.clone().applyMatrix4(TURN_INV), bodyMesh.material); // 광선용 (머리 좌표)
  const start = kit.bins.bear.length;
  const back = new THREE.Vector3(0, 0, -1);
  const onHead = (x, y) => hitOn(headLocal, new THREE.Vector3(x, y, 0.5), back);
  const pits = []; // 콧구멍 (곰 2c): { out, s, at: 꼭짓점마다 코 겉면 [삼각형, 무게] }
  const deep = new THREE.Color(C.dark).multiplyScalar(DEEP); // 가장 깊은 그늘 (곰 2c)
  let noseOut = null;
  let noseLocal = null;
  // 큰 코: 주둥이 끝 위에 얹힌 넓고 납작한 코 — 주둥이와 같은 돌에서 조금 짙게(곰 2c), 코끝 윗면은 닳아 밝고 아랫면은 그늘
  {
    const hit = onHead(0, NOSE.y);
    const at = hit ? hit.point : new THREE.Vector3(0, NOSE.y, 0.14);
    // 넓고 납작한 코: 둥근 네모 단면(위가 평평)을 앞뒤로 쌓은 덩어리, 코끝이 조금 아래로
    const nose = loftZ([
      [-0.012, NOSE.w * 0.86, NOSE.h * 0.9, 0, 0], [-0.004, NOSE.w, NOSE.h, 0, 0.0004], [0.004, NOSE.w * 0.97, NOSE.h * 0.96, 0, 0.0004],
      [0.009, NOSE.w * 0.82, NOSE.h * 0.74, 0, -0.0004], [0.012, NOSE.w * 0.45, NOSE.h * 0.38, 0, -0.001],
    ], 20, 0.55);
    const noseM = new THREE.Matrix4().compose(at.clone().add(new THREE.Vector3(0, 0.001, -0.004)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)), new THREE.Vector3(1, 1, 1));
    noseOut = kit.putM('bear', nose, C.nose, noseM, PLAIN);
    noseOut.userData.part = 'face';
    const worn = new THREE.Color(C.worn);
    paint(noseOut, (q, n, col, i) => new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).lerp(worn, 0.5 * Math.max(0, n.y) * ss(n.z, -0.2, 0.6) + 0.25 * ss(n.z, 0.6, 0.95)).multiplyScalar(1 - 0.18 * Math.max(0, -n.y)));
    noseLocal = new THREE.Mesh(nose.clone().applyMatrix4(noseM), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    nose.dispose();
    for (const side of [-1, 1]) {
      // 콧구멍 둘: 코 앞면 아래쪽에 얕게 판 쉼표꼴 (곰 2c — 짙은 원판 0x242627 대신 가운데로 갈수록 짙은 오목)
      const hitN = hitOn(noseLocal, new THREE.Vector3(side * NOSE.w * 0.45, NOSE.y - NOSE.h * 0.3, 0.5), back);
      if (!hitN) continue;
      const nz = hitN.face.normal.clone().normalize();
      const nx = new THREE.Vector3(1, 0, 0).addScaledVector(nz, -nz.x).normalize();
      const nb = new THREE.Matrix4().makeBasis(nx, new THREE.Vector3().crossVectors(nz, nx), nz);
      const nm = new THREE.Matrix4().makeTranslation(hitN.point.x, hitN.point.y, hitN.point.z).multiply(nb).multiply(new THREE.Matrix4().makeRotationZ(side * 0.45)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0006));
      const [rx, ry] = [NOSE.w * 0.34, NOSE.h * 0.4];
      const { g, xy, s } = dish(ovalPts(0, 0, rx, ry, 12), [1, 0.5, 0]);
      xy.forEach(([x, y], k) => {
        const v = new THREE.Vector3((-SOFT_PIT.slope * s[k] * x) / rx, (-SOFT_PIT.slope * s[k] * y) / ry, 1).normalize();
        g.attributes.normal.setXYZ(k, v.x, v.y, v.z);
      });
      g.applyMatrix4(nm);
      const out = kit.putM('bear', g, C.nose, new THREE.Matrix4(), PLAIN);
      // 꼭짓점(색인)마다 밑 코 겉면 자리 (색은 코가 다 칠해진 뒤 — 맨 끝)
      const P = g.attributes.position;
      const v = new THREE.Vector3();
      const hits = [];
      for (let k = 0; k < P.count; k++) {
        const h = hitOn(noseLocal, v.fromBufferAttribute(P, k).addScaledVector(nz, 0.01), nz.clone().negate());
        hits.push(h ? [h.faceIndex, h.barycoord.clone()] : null);
      }
      const order = g.index.array;
      pits.push({ out, s: Float32Array.from(order, (k) => s[k]), at: Array.from(order, (k) => hits[k]) });
      g.dispose();
    }
  }
  // 얼굴 밝은 돌 판
  facePlate(kit, headLocal.geometry);
  const rimLift = EYE.h * 0.31 * (EYE.rimH - 1); // 윗눈꺼풀 선을 위로 올린 만큼 (1e)
  const eyes = []; // 눈 조각 겹 (곰 2c): { out, a: 꼭짓점마다 그늘 섞음, n: 판 법선(머리 좌표) }
  for (const side of [-1, 1]) {
    // 눈(돌 조각): 눈자리 겉면(판 위)에 붙인 아몬드꼴 겹 — 윗눈꺼풀 · 눈알 · 홍채 자리 · 눈동자 · 남긴 돌 다리. 틀(자리·법선·기울임)과 들림은 1e · 곰 2 그대로라
    //  오목한 눈자리에 가장자리가 묻히는 꼴(보이는 아몬드)도 같다. 곰 2c: 색은 칠한 짙은 돌 · 검정 대신 판 돌빛 → 그늘 섞음(eyeField), 법선은 판 자리처럼 오목
    const hit = onHead(side * EYE.x, EYE.y);
    if (hit) {
      const z = hit.face.normal.clone().normalize();
      const x = new THREE.Vector3(1, 0, 0).addScaledVector(z, -z.x).normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      const frame = new THREE.Matrix4().makeTranslation(hit.point.x, hit.point.y, hit.point.z).multiply(new THREE.Matrix4().makeBasis(x, y, z)).multiply(new THREE.Matrix4().makeRotationZ(-side * EYE.tilt)); // 바깥 눈꼬리 쪽이 조금 내려가게
      const field = eyeField(side, rimLift);
      const layer = (outline, rings, lift, rimToPlate = false) => {
        const { g, xy, s } = dish(outline, rings);
        const a = new Float32Array(xy.length);
        xy.forEach(([px, py], k) => {
          const f = field(px, py);
          a[k] = rimToPlate && s[k] === 1 ? 0 : f.a; // 윗눈꺼풀 띠 바깥 테두리는 판 돌빛 그대로
          const v = new THREE.Vector3(f.gx, f.gy, 1).normalize();
          g.attributes.normal.setXYZ(k, v.x, v.y, v.z);
        });
        g.applyMatrix4(frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, lift + FACE_STEP)));
        eyes.push({ out: kit.putM('bear', g, 0xffffff, new THREE.Matrix4(), PLAIN), a: Float32Array.from(g.index.array, (k) => a[k]), n: z });
        g.dispose();
      };
      const [ox, oy] = [-side * EYE.w * 0.04, EYE.h * 0.03];
      // 윗눈꺼풀: 아랫선을 눈알 아랫선과 겹치게 올려(아래눈꺼풀 선은 안 보임) 윗선만 — 1e 의 짙은 테 자리 → 곰 2c: 눈알 윗선에서 위로 옅어지는 그늘 띠
      layer(almondPts(EYE.w * EYE.rim, EYE.h * EYE.rimH, EYE.droop * 1.2, side, 12).map(([px, py]) => [px, py + rimLift]), [1, 0.82, 0.6, 0], 0.0006, true);
      layer(almondPts(EYE.w, EYE.h, EYE.droop, side, 12), [1, 0.75, 0.45, 0], 0.0012); // 눈알 (1e 갈색 홍채 자리)
      layer(ovalPts(ox, oy, EYE.h * EYE.iris, EYE.h * EYE.iris * 1.04, 16), [1, 0.5, 0], 0.0014); // 홍채 자리
      layer(ovalPts(ox, oy, EYE.h * EYE.pupil, EYE.h * EYE.pupil * 1.05, 14), [1, 0.55, 0], 0.0016); // 눈동자 — 얕게 판 오목
      layer(ovalPts(-side * EYE.w * 0.1, EYE.h * 0.2, EYE.shine, EYE.shine, 10), [1, 0], 0.0019); // 남긴 돌 다리 (1e 반사점 자리)
    }
    // 귀(짙은 돌): 작고 납작한 컵 (앞·바깥을 보게, 정수리 양옆 위). 곰 2c: 짙은 원판(0x2e3132) 대신 앞면을 눌러 판 오목한 컵 — 바닥은 그늘, 테두리는 닳아 밝게.
    //  곰 오른 귀 위 바깥 테두리 · 왼 귀 위 안쪽 테두리에 작은 깨짐
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, side * 0.42, side * -0.5, 'YXZ'));
    const em = new THREE.Matrix4().compose(new THREE.Vector3(side * EAR.x, EAR.y, EAR.z), q, new THREE.Vector3(EAR.r, EAR.r * 1.06, EAR.thick));
    const { g: ear, cup, rim } = earCup();
    const earOut = kit.putM('bear', ear, C.dark, em, PLAIN);
    earOut.userData.part = 'ear';
    const order = ear.index.array;
    const worn = new THREE.Color(C.worn);
    paint(earOut, (p, n, col, i) => new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).lerp(deep, EAR_CUP.shade * cup[order[i]]).lerp(worn, EAR_CUP.rimWear * rim[order[i]]));
    ear.dispose();
    for (const ch of [EAR_CHIP, EAR_CHIP2]) {
      if (side !== ch.side) continue;
      const c = new THREE.Vector3(side * Math.cos(ch.angle), Math.sin(ch.angle), 0).applyMatrix4(em);
      const centre = new THREE.Vector3(side * EAR.x, EAR.y, EAR.z);
      chipAt(earOut, c, EAR.r * ch.r, EAR.r * ch.depth, centre.sub(c).normalize(), C.chip);
    }
  }
  headLocal.geometry.dispose();
  for (const gg of kit.bins.bear.slice(start)) gg.applyMatrix4(TURN);
  // 귀·코·얼굴 판은 머리 좌표 → 몸 좌표로 옮긴 뒤에 때·바램 (귀 뒤 · 코 아래 · 턱 밑)
  for (const gg of kit.bins.bear.slice(start)) if (gg.userData.part) weather(gg, gg.userData.part);
  // 곰 2c — 판 자리 색 (둘레 돌빛이 정해진 뒤): 그 자리 돌빛 → 가장 깊은 그늘(짙은 돌 × DEEP) 섞음. 순검정 없음
  const hp = new THREE.Vector3();
  const nb = new THREE.Vector3();
  for (const { out, a, n } of eyes) {
    nb.copy(n).transformDirection(TURN);
    paint(out, (p, nn, col, i) => {
      hp.copy(p).applyMatrix4(TURN_INV);
      return weatherAt(faceLight(hp.x, hp.y, faceShape(hp.x, hp.y)), p, nb, 'face').lerp(deep, a[i]);
    });
  }
  const nc = noseOut.attributes.color;
  for (const { out, s, at } of pits) {
    paint(out, (p, nn, col, i) => {
      const base = new THREE.Color(0, 0, 0);
      const h = at[i];
      if (!h) base.copy(new THREE.Color(C.nose));
      else for (const [k, w] of [[0, h[1].x], [1, h[1].y], [2, h[1].z]]) base.add(new THREE.Color(nc.getX(h[0] * 3 + k), nc.getY(h[0] * 3 + k), nc.getZ(h[0] * 3 + k)).multiplyScalar(w));
      return base.lerp(deep, SOFT_PIT.nostril * ss(s[i], 1, 0.2));
    });
  }
  noseLocal.geometry.dispose();
  noseLocal.material.dispose();
}
/** 귀 컵 (곰 2c · EAR_CUP): 단위 공의 앞(+z) 반을 가운데일수록 깊게 눌러 오목하게 — { g: 색인 BufferGeometry, cup: 꼭짓점마다 컵 바닥 그늘 0~1, rim: 테두리 닳음 0~1 } */
function earCup() {
  const sp = new THREE.SphereGeometry(1, 16, 12);
  sp.deleteAttribute('normal');
  sp.deleteAttribute('uv');
  const g = mergeVertices(sp);
  sp.dispose();
  const P = g.attributes.position;
  const cup = new Float32Array(P.count);
  const rim = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const [x, y, z] = [P.getX(i), P.getY(i), P.getZ(i)];
    const r = Math.min(1, Math.hypot(x, y));
    if (z > 0) {
      P.setZ(i, z - EAR_CUP.depth * (1 - r * r) ** EAR_CUP.pow);
      cup[i] = ss(r, 0.9, 0.3);
    }
    rim[i] = ss(r, 0.7, 0.95) * ss(z, -0.25, 0.05);
  }
  g.computeVertexNormals();
  return { g, cup, rim };
}

// 받침의 작은 깨짐 둘 · 지의류 · 발 둘레 이끼 덩이 (m, 받침 좌표 — 확인표 1246·1247)
// 곰 2c: 앞 왼쪽 위 모서리에 작은 깨짐 하나 더 (확인표 1300)
const PLINTH_CHIPS = [{ a: -Math.PI / 8, r: 0.05, depth: 0.034 }, { a: (5 * Math.PI) / 8, r: 0.045, depth: 0.03 }, { a: (3 * Math.PI) / 8, r: 0.036, depth: 0.022 }]; // 팔각 위 모서리 (방위: 0 = 곰 앞)
const LICHEN = [
  [0.56, 0.2, 0.03], [-0.6, -0.26, 0.026], [0.16, -0.64, 0.034], [-0.22, 0.66, 0.024], [0.62, -0.44, 0.02], // 윗면 [x, z, 반지름] — 셋째는 누런빛
];
const LICHEN_SIDE = [[2.2, 0.2, 0.026], [3.9, 0.1, 0.034]]; // 옆면 [방위, 높이, 반지름] (뒤쪽 그늘 면)
const MOSS_TUFTS = [[0.48, -0.1, 0.05], [-0.5, -0.12, 0.06], [0.33, 0.37, 0.045], [-0.43, 0.3, 0.04]]; // 발 둘레 [x, z, 크기]
// 곰 2c (확인표 1299 · 1300 · 1301): 받침 아래쪽 젖은 띠 — 땅에서 top ± jag(고르지 않은 윗선, 0.2~0.3 m)까지 dark 만큼 짙게 / 위 모서리 닳음(밝게) / 받침 둘레 풀 몇 포기
const PLINTH_WET = Object.freeze({ top: 0.25, jag: 0.04, dark: 0.3 });
const PLINTH_WORN = Object.freeze({ color: 0xa2a59a, amount: 0.32 });
const GRASS = [[0.95, 0.93, 7], [2.45, 0.9, 6], [-2.05, 0.92, 7], [-0.8, 0.95, 5]]; // [방위 a(0 = 곰 앞), 반지름(m), 잎 수] — 앞 디딤돌 쪽은 비움

/** 받침: 낮은 팔각기둥 + 윗면 가장자리·옆 아래 이끼 · 위 모서리 깨짐 셋 · 지의류 점 · 발 둘레 이끼 덩이 (m 단위, 곰과 따로 — 평면 음영 돌).
 *  곰 2c: 아래쪽 젖은 띠 · 위 모서리 닳음 · 둘레 풀 몇 포기 */
function plinth(kit, height) {
  const P = BEAR_PLINTH;
  const C = BEAR_COLORS;
  const moss = new THREE.Color(C.plinthMoss);
  const block = new THREE.CylinderGeometry(P.radius * 0.95, P.radius, P.height * 0.82, 8, 5); // 곰 2c: 높이 나눔 2 → 5 (젖은 띠 윗선이 뭉개지지 않게)
  block.translate(0, (P.height * 0.82) / 2, 0);
  // 위 단: 옆면 + 위 모서리 모따기 (모서리를 깨도 윗면 큰 삼각형은 그대로이게 고리를 하나 더 둔다)
  const capH = P.height * 0.18;
  const bevel = 0.012;
  const cap = new THREE.CylinderGeometry(P.radius * 0.9, P.radius * 0.96, capH - bevel, 8, 1, true);
  cap.translate(0, P.height * 0.82 + (capH - bevel) / 2, 0);
  const capTop = new THREE.CylinderGeometry(P.radius * 0.87, P.radius * 0.9, bevel, 8, 1, false);
  capTop.translate(0, P.height - bevel / 2, 0);
  const R = new THREE.Matrix4().makeRotationY(Math.PI / 8);
  const pieces = [];
  for (const g of [block, cap, capTop]) {
    const out = kit.putM('plinth', g, C.stone, R, { rough: 0.018, vary: 0.06, noise: 0.08, uv: 'box', uvScale: 0.9 });
    pieces.push(out);
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
    // 아래쪽 젖은 띠 (곰 2c): 물을 머금은 돌 — 윗선은 방위에 따라 고르지 않게
    paint(out, (q) => {
      const a = Math.atan2(q.x, q.z);
      const top = PLINTH_WET.top + PLINTH_WET.jag * (0.6 * Math.sin(a * 5 + 1.3) + 0.4 * Math.sin(a * 13 + 0.4));
      const w = ss(q.y, top + 0.02, top - 0.03);
      return w > 0 ? 1 - PLINTH_WET.dark * w : null;
    });
    // 위 모서리 닳음 (곰 2c): 모따기 둘레가 밝게
    const wornStone = new THREE.Color(PLINTH_WORN.color);
    paint(out, (q, n, col, i) => {
      const e = ss(q.y, P.height - 0.03, P.height - 0.006) * ss(Math.hypot(q.x, q.z) / P.radius, 0.84, 0.89);
      return e > 0 ? new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)).lerp(wornStone, PLINTH_WORN.amount * e) : null;
    });
    // 위 모서리 작은 깨짐 셋 (새 돌빛 — 옆면·모따기에 걸친다)
    for (const ch of PLINTH_CHIPS) {
      const at = new THREE.Vector3(Math.sin(ch.a) * P.radius * 0.9, P.height - bevel, Math.cos(ch.a) * P.radius * 0.9);
      chipAt(out, at, ch.r, ch.depth, new THREE.Vector3(-Math.sin(ch.a), -0.75, -Math.cos(ch.a)).normalize(), 0x9a9c94, false);
    }
    g.dispose();
  }
  // 지의류: 윗면·옆면에 들쭉날쭉한 옅은 딱지 — 크고 작은 둥근 조각 셋이 겹친 무리 (하나는 누런빛, 돌빛에 섞어 튀지 않게)
  const blob = (r, seed, ox, oy) => {
    const g = new THREE.CircleGeometry(r, 14);
    const q = g.attributes.position;
    for (let i = 1; i < q.count; i++) {
      const k = 0.7 + 0.3 * Math.abs(Math.sin(i * 2.7 + seed * 1.9)) + 0.22 * Math.sin(i * 0.9 + seed);
      q.setXY(i, q.getX(i) * k, q.getY(i) * k);
    }
    return g.translate(ox, oy, 0.0004 * seed);
  };
  const spot = (r, seed) => mergeGeometries([blob(r, seed, 0, 0), blob(r * 0.55, seed + 3, r * 0.8, r * 0.35), blob(r * 0.4, seed + 5, -r * 0.55, -r * 0.7)]);
  // 흔든(rough) 받침 겉면에 붙이려고 광선으로 자리·면 법선을 찾는다
  const probe = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const onPlinth = (from, dir) => {
    let best = null;
    for (const g of pieces) {
      probe.geometry = g;
      const h = hitOn(probe, from, dir);
      if (h && (!best || h.distance < best.distance)) best = h;
    }
    return best;
  };
  const stick = (g, color, hit, lift) => {
    const nrm = hit.face.normal.clone().normalize();
    const m = new THREE.Matrix4().compose(hit.point.clone().addScaledVector(nrm, lift), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm), new THREE.Vector3(1, 1, 1));
    kit.putM('plinth', g, color, m, { vary: 0.08, noise: 0 });
    g.dispose();
  };
  const down = new THREE.Vector3(0, -1, 0);
  const stone = new THREE.Color(C.stone);
  const lichen = (warm) => stone.clone().lerp(new THREE.Color(warm ? C.lichenWarm : C.lichen), 0.7);
  LICHEN.forEach(([x, z, r], i) => {
    const hit = onPlinth(new THREE.Vector3(x, P.height + 0.2, z), down);
    if (hit) stick(spot(r, i), lichen(i === 2), hit, 0.002);
  });
  LICHEN_SIDE.forEach(([a0, y, r], i) => {
    const a = Math.round(a0 / (Math.PI / 4)) * (Math.PI / 4); // 팔각 옆면 가운데 방위 (꼭짓점 사이)
    const hit = onPlinth(new THREE.Vector3(Math.sin(a) * 2, y, Math.cos(a) * 2), new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)));
    if (hit) stick(spot(r, i + 7), lichen(false), hit, 0.002);
  });
  // 발 둘레 이끼 덩이: 받침 윗면에서 발 가장자리에 낮게 붙는다 (곰 키에 맞춰 자리만 늘린다)
  const s = height / 3.0;
  MOSS_TUFTS.forEach(([x, z, k], i) => {
    const hit = onPlinth(new THREE.Vector3(x * s, P.height + 0.2, z * s), down);
    const g = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x * s, (hit ? hit.point.y : P.height) + k * 0.08, z * s), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3), new THREE.Vector3(k, k * 0.32, k * 0.72));
    kit.putM('plinth', g, C.plinthMoss, m, { vary: 0.12, noise: 0.05 });
    g.dispose();
  });
  probe.material.dispose();
  grassTufts(kit);
}
/** 받침 둘레 풀 (곰 2c, GRASS): 땅에서 받침 아래 둘레로 몇 포기 — 잎마다 앞뒤 두 장 세모(평면 음영), 밑동 짙고 끝 밝게 (m 단위, 받침 좌표) */
function grassTufts(kit) {
  const base = new THREE.Color(BEAR_COLORS.grass);
  const dry = new THREE.Color(0x9a9a5c);
  GRASS.forEach(([a, rr, count], t) => {
    const [cx, cz] = [Math.sin(a) * rr, Math.cos(a) * rr];
    const pos = [];
    const cols = [];
    for (let i = 0; i < count; i++) {
      const [r1, r2, r3, r4] = [1, 2, 3, 4].map((k) => h3(t, i, k, 70 + k));
      const yaw = r1 * TAU;
      const [ox, oz] = [cx + (r2 - 0.5) * 0.12, cz + (r3 - 0.5) * 0.12];
      const h = 0.11 + 0.16 * r4;
      const w = 0.012 + 0.014 * r2;
      const lean = 0.03 + 0.07 * r3;
      const [dx, dz] = [Math.cos(yaw) * w * 0.5, Math.sin(yaw) * w * 0.5];
      const A = [ox - dx, -0.01, oz - dz];
      const B = [ox + dx, -0.01, oz + dz];
      const T = [ox + Math.sin(a) * lean + (r1 - 0.5) * 0.04, h, oz + Math.cos(a) * lean + (r4 - 0.5) * 0.04];
      pos.push(...A, ...B, ...T, ...B, ...A, ...T);
      const root = base.clone().multiplyScalar(0.62 + 0.1 * r2);
      const tip = base.clone().multiplyScalar(1.1 + 0.12 * r1).lerp(dry, 0.25 * r4);
      for (const c of [root, root, tip, root, root, tip]) cols.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    kit.putM('plinth', g, 0xffffff, new THREE.Matrix4(), PLAIN).attributes.color.array.set(cols);
    g.dispose();
  });
}

/** 석상 겉모습 + 충돌체 꼴. 충돌체는 부르는 쪽(arena_obstacle.js)이 shapes 로 만든다 */
export function buildSluiceBear(scene, { position = SLUICE_BEAR_POSITION, rotationY = SLUICE_BEAR_ROTATION_Y, height = BEAR_HEIGHT } = {}) {
  const kit = new Kit(64371);
  sculpt(kit);
  for (const g of kit.bins.bear) g.scale(height, height, height).translate(0, BEAR_PLINTH.height, 0);
  plinth(kit, height);
  // 돌 석상 (곰 2, 확인표 1241): 거친 돌 · 부드러운 법선(닳아 둥근 돌 덩어리 — 끌 자국·깨짐·홈은 법선을 따로 준다) · 색은 모두 꼭짓점 색.
  //  곰 2c (확인표 1302): 거칠기 0.92 → 1 · 금속 0 — 무광 (해 쪽 반사가 가장 넓게 퍼져 거의 안 보인다). 무대 덩굴과 같은 재질 꼴이라 셰이더가 늘지 않는다
  const bearMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
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
