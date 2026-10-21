// ─────────────────────────────────────────────────────────────
//  플랑베르주 겉모습 — 부품 질량·콜라이더·전투 규칙은 weapons.js(flamberge)가 정한다. 여기는 보여 주기만 한다.
//
//  원형: 클리블랜드 미술관 1919.71 「Two-Handed Sword with Flamboyant Blade」, 독일 1550–1600 (박물관 열린 자료 CC0).
//   실측 [M]: 전체 168.9 · 날 118.7(리카소 26.7 포함 — 날 세운 부분 92.0) · 코등이 50.5 · 손잡이(폼멜 포함) 49.2 cm. 무게는 자료에 없다.
//   물결 22 주기·진폭 ±3.6 mm·날 밑동 단면 6.4 mm·뒷면 장식·잔 곡률은 사진으로 어림한 값 [추정] — 박물관 실측이 아니다.
//  샛별 저장소 origin/main 325a5c38 의 flamberge_design.js 생김새를 옮겨 고침 (그쪽 모델은 겉모습 시안뿐 — 질량·쥠·충돌체 없음):
//   · 원점: 그쪽은 폼멜 끝(y 0)이었다 → 우리 무기처럼 칼 원점 = 오른손 주먹 가운데. 주먹은 날밑 덩이 아랫면 바로 밑(칼날 밑동에서 0.085 m 아래 —
//     주먹 가운데 ~ 날밑 아랫면 0.065 m, 츠바이핸더 날밑 쥠과 같은 몫). 그쪽 y 에서 ORIGIN(0.417)을 빼면 우리 y.
//   · 부품: 우리 칼 네 부품(weapons.js buildParts 차례 — 자루 0 · 폼멜 1 · 코등이 2 · 칼날 3)으로 나눠 partMesh 가 부품마다 그린다.
//     리카소·보조 갈고리·이음 덩이는 츠바이핸더처럼 decorate 가 칼 그룹에 그린다(칼날 콜라이더 안 — 리카소 날 판정은 츠바이핸더와 같다).
//   · 같은 재질·같은 부품의 잔 조각(리벳·이음 띠·말림·새김 줄)은 지오메트리를 하나로 합쳐 그리기 호출을 줄였다(모양·빛깔은 같다 — outfits.js 와 같은 방식).
//   · 칼날만 등급 마감(weapon_looks.js FINISH — 처음 에픽, 10/21 부터 레어). 나머지 재질(검갈색 가죽·황동 리벳·청동 폼멜·
//     어두운 리카소)은 그쪽 값 그대로. 기운·불꽃 없음.
//   · 물결 날(bladeGeometry 의 edgeX·backX)·리카소·앞으로 휜 보조 갈고리·말린 넓은 코등이·가죽 손잡이·황동 리벳·청동 폼멜은 치수 그대로.
//  난수는 쓰지 않는다(시뮬 재현성).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bladeGeometry, metalMat, FINISH } from './weapon_looks.js';

// 박물관 실측 [M] (m) — 전체 · 날(리카소 포함) · 리카소 · 코등이 폭 · 손잡이(폼멜 포함)
export const FLAMBERGE_MUSEUM = Object.freeze({ overall: 1.689, blade: 1.187, ricasso: 0.267, guard: 0.505, handle: 0.492 });
// 게임 치수 (사장님 10/21 23:5x '플랑베르주는 전체 4 cm 줄여' — 나누기는 감독): 박물관 실측은 위 기록 그대로 두고 게임은 이것을 쓴다 [I].
//  날 −2.5 cm(물결 날 칼끝 쪽 — 리카소 26.7 cm 그대로) · 손잡이 −1.5 cm(왼손 아래 — 폼멜이 1.5 cm 올라옴 · 오른손 · 날밑 · 손 사이 0.24 m 그대로) → 전체 164.9 cm.
//  손잡이가 츠바이핸더 것(날밑 아랫면 ~ 폼멜 끝 0.398 m)보다 9 cm 길어 자루에서 비례 몫(1.2 cm)보다 조금 더 덜었다
export const FLAMBERGE_GAME = Object.freeze({ overall: 1.649, blade: 1.162, ricasso: 0.267, guard: 0.505, handle: 0.477 });

// 그쪽 모델 좌표(폼멜 끝 = 0, 칼끝 +y)에서 칼날 밑동·물결 날 시작
const ROOT_SB = FLAMBERGE_MUSEUM.overall - FLAMBERGE_MUSEUM.blade; // 0.502
const EDGE_SB = ROOT_SB + FLAMBERGE_MUSEUM.ricasso; // 0.769
// 손잡이 줄임 (게임 치수): 그쪽 y 로 손잡이 아래 끝(0.059) ~ 아래 마디 위 이음 띠(0.167) 사이를 1.5 cm 줄이고 그 아래(폼멜)는 통째로 1.5 cm 올린다.
//  이음 띠 0.167 위(왼손이 쥐는 아래 마디 윗부분 · 위 마디 · 날밑 · 칼날)는 그대로 — 박물관 그림의 모양은 아래 마디가 조금 짧아질 뿐
const HANDLE_CUT = FLAMBERGE_MUSEUM.handle - FLAMBERGE_GAME.handle; // 0.015
const CUT_LO = 0.059, CUT_HI = 0.167;
const H = (ySb) => (ySb >= CUT_HI ? ySb : ySb <= CUT_LO ? ySb + HANDLE_CUT : CUT_HI - ((CUT_HI - ySb) * (CUT_HI - CUT_LO - HANDLE_CUT)) / (CUT_HI - CUT_LO));
// 우리 칼 원점(오른손 주먹 가운데)의 그쪽 y: 칼날 밑동 0.085 m 아래
export const FLAMBERGE_HILT = 0.085; // = weapons.js flamberge.hiltLength (손 → 칼날 밑동)
const ORIGIN = ROOT_SB - FLAMBERGE_HILT; // 0.417
const Y = (ySb) => ySb - ORIGIN; // 그쪽 y → 우리 y (칼 원점 기준)

// 빛깔 (그쪽 값 그대로)
export const FLAMBERGE_COLORS = { leather: 0x30231d, seam: 0x181712, steel: 0x9ba1a2, darkSteel: 0x646967, bronze: 0x776044, brass: 0x9d7a43, blade: 0xa3adb4 };

// ── 기하 도우미 (그쪽 plate·strap 그대로) ──
function plate(points, depth, bevel = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
}

function strap(points, width, depth) {
  const side = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    return [(-dy / l) * width / 2, (dx / l) * width / 2];
  });
  return plate(
    [...points.map(([x, y], i) => [x + side[i][0], y + side[i][1]]), ...points.map(([x, y], i) => [x - side[i][0], y - side[i][1]]).reverse()],
    depth,
    depth > 0.003 ? 0.00035 : 0,
  );
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
/** 조각을 자리(pos)·늘림(scale)으로 굽는다 — 합치기 전에 */
function bake(geo, pos = [0, 0, 0], scale = [1, 1, 1]) {
  _m4.compose(_p.set(...pos), _q.identity(), _s.set(...scale));
  geo.applyMatrix4(_m4);
  return geo.index ? geo.toNonIndexed() : geo;
}

/** 같은 재질의 조각들을 메쉬 하나로 (위치·법선·uv 만 남긴다) */
function merged(group, pieces, material, name) {
  const keep = pieces.map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    return g;
  });
  const geo = mergeGeometries(keep, false);
  for (const g of keep) g.dispose();
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = true;
  group.add(m);
  return m;
}

// ── 부품 0: 두 마디 검갈색 가죽 손잡이(나무 위 가죽) · 이음 띠 · 황동 리벳 (그쪽 y 0.059~0.492) ──
const GRIP_PROFILE = [[0.011, 0.059], [0.014, 0.086], [0.017, 0.18], [0.018, 0.241], [0.015, 0.252], [0.018, 0.278], [0.018, 0.37], [0.019, 0.475], [0.017, 0.492]];
const SEAMS = [0.085, 0.167, 0.245, 0.284, 0.369, 0.449, 0.483];
const RIVETS = [0.108, 0.153, 0.202, 0.305, 0.35, 0.404, 0.452];
function gripGroup(y0) {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: FLAMBERGE_COLORS.leather, roughness: 0.94 });
  const seam = new THREE.MeshStandardMaterial({ color: FLAMBERGE_COLORS.seam, roughness: 0.95 });
  const brass = metalMat(FLAMBERGE_COLORS.brass, { rough: 0.38, metal: 0.78 });
  const grip = new THREE.Mesh(new THREE.LatheGeometry(GRIP_PROFILE.map(([r, y]) => new THREE.Vector2(r, Y(H(y)) - y0)), 16), leather);
  grip.scale.z = 0.86;
  grip.name = 'leather-grip';
  grip.castShadow = true;
  group.add(grip);
  // 가죽 이음 띠와 황동 리벳 (지어낸 금실 감개가 아니다 — 그쪽 주석 그대로)
  merged(group, SEAMS.map((y) => {
    const r = (y < 0.15 ? 0.0145 : 0.0182) + 0.0004;
    return bake(new THREE.CylinderGeometry(r, r, 0.002, 16), [0, Y(H(y)) - y0, 0], [1, 1, 0.87]);
  }), seam, 'grip-seams');
  const rivets = [];
  for (const y of RIVETS) for (const side of [-1, 1]) rivets.push(bake(new THREE.SphereGeometry(0.0024, 8, 6), [0.006, Y(H(y)) - y0, side * (y < 0.15 ? 0.0125 : 0.0156)], [1, 1, 0.45]));
  merged(group, rivets, brass, 'brass-rivets');
  return group;
}

// ── 부품 1: 각진 청동 폼멜 (그쪽 y 0~0.066, 여덟 모 회전체) ──
const POMMEL_PROFILE = [[0, 0], [0.011, 0.014], [0.024, 0.034], [0.021, 0.044], [0.012, 0.061], [0.010, 0.066]];
function pommelGroup(y0) {
  const group = new THREE.Group();
  const bronze = metalMat(FLAMBERGE_COLORS.bronze, { rough: 0.45, metal: 0.75 });
  const m = new THREE.Mesh(new THREE.LatheGeometry(POMMEL_PROFILE.map(([r, y]) => new THREE.Vector2(r, Y(y + HANDLE_CUT) - y0)), 8), bronze); // 폼멜은 모양 그대로 1.5 cm 올림 (게임 치수)
  m.name = 'bronze-pommel';
  m.castShadow = true;
  group.add(m);
  return group;
}

// ── 부품 2: 휜 납작 코등이 + 끝 판 + 열린 말림 여섯 + 잔 새김 + 가운데 덩이 (그쪽 y = 칼날 밑동 0.502 기준) ──
const QUILLON = [[0.018, -0.010], [0.10, 0.000], [0.19, 0.018], [0.227, 0.033], [0.247, 0.038], [0.2525, 0.048], [0.238, 0.054], [0.220, 0.044], [0.186, 0.031], [0.097, 0.014], [0.018, 0.011]];
const SCROLLS = [[0.073, 0.029, 0.018, -Math.PI / 2, -Math.PI * 1.62], [0.181, 0.045, 0.015, -Math.PI / 2, Math.PI * 1.72], [0.190, 0.004, 0.014, Math.PI / 2, -Math.PI * 1.66]];
const GUARD_BLOCK = [[-0.032, -0.013], [-0.032, 0.010], [-0.012, 0.018], [0.031, 0.008], [0.031, -0.013], [0.010, -0.020]];
function guardGroup(y0) {
  const group = new THREE.Group();
  const steel = metalMat(FLAMBERGE_COLORS.steel, { rough: 0.34 });
  const darkSteel = metalMat(FLAMBERGE_COLORS.darkSteel, { rough: 0.44 });
  const yr = Y(ROOT_SB) - y0; // 칼날 밑동의 부품 안 y
  const arms = [];
  const scrolls = [];
  const cuts = [];
  for (const s of [-1, 1]) {
    // 바깥 폭은 박물관 코등이 50.5 cm 안 (모따기가 칼 닿는 거리를 늘리지 않게 — 그쪽 주석 그대로)
    const q = plate(QUILLON.map(([x, y]) => [s * x, y]), 0.011, 0.0008);
    q.computeBoundingBox();
    const xmax = Math.max(Math.abs(q.boundingBox.min.x), Math.abs(q.boundingBox.max.x));
    q.scale(FLAMBERGE_MUSEUM.guard / 2 / xmax, 1, 1);
    arms.push(bake(q, [0, yr, 0]));
    for (const [cx, cy, rad, start, sweep] of SCROLLS) {
      const pts = Array.from({ length: 29 }, (_, i) => {
        const a = start + (sweep * i) / 28;
        return [s * (cx + rad * Math.cos(a)), cy + rad * Math.sin(a)];
      });
      scrolls.push(bake(strap(pts, 0.0038, 0.0055), [0, yr, 0]));
    }
    // 사진에 보이는 잔 빗금 새김 (뒷면은 거울로 다시 만든 것)
    for (let i = 0; i < 7; i++) {
      for (const z of [-0.0057, 0.0057]) {
        const x = 0.049 + i * 0.022;
        const y = 0.002 + (x - 0.049) * 0.14;
        cuts.push(bake(strap([[s * (x - 0.005), y - 0.005], [s * (x + 0.004), y + 0.007]], 0.00055, 0.0003), [0, yr, z]));
      }
    }
  }
  for (const z of [-0.0157, 0.0157]) for (const s of [-1, 1]) cuts.push(bake(strap([[-0.019, s * 0.010], [0.019, -s * 0.010]], 0.0006, 0.0003), [0, yr, z]));
  merged(group, [...arms, bake(plate(GUARD_BLOCK, 0.031, 0.001), [0, yr, 0])], steel, 'swept-quillons');
  merged(group, scrolls, steel, 'open-scrolls');
  merged(group, cuts, darkSteel, 'guard-incisions');
  return group;
}

// ── 부품 3: 촘촘하고 얕은 물결 양날 (그쪽 y 0.769~1.689 — 날 세운 92.0 cm · 게임 치수는 칼끝 쪽 2.5 cm 짧은 89.5 cm) ──
//  22 주기(박물관 날 길이에서 — 게임 날은 같은 물결 길이로 21.4 주기)·6.4 mm 밑동 단면은 그림 어림 [추정]. 물결 = 칼몸 가운데 선이 ±3.6 mm 로 흔들린다(칼몸 폭 3.4 cm 는 그대로)
const WAVE = { cycles: 22, amp: 0.0036 };
export function flambergeBladeGeometry() {
  const L = FLAMBERGE_GAME.blade - FLAMBERGE_GAME.ricasso;
  const k = L / (FLAMBERGE_MUSEUM.blade - FLAMBERGE_MUSEUM.ricasso); // 물결 · 잔물결 한 주기의 길이는 박물관 날 그대로 (칼끝 쪽만 잘린 꼴)
  const wave = (t) => WAVE.amp * Math.sin(t * WAVE.cycles * k * Math.PI * 2) * Math.min(1, t / 0.025) * Math.min(1, (1 - t) / 0.07);
  const half = (t) => 0.017 * (1 - 0.12 * t) + 0.0006 * Math.sin(t * 44 * k * Math.PI * 2);
  return bladeGeometry(0.017, L / 2, 0.0032, {
    edge: 'double', thick: 0.0032, segs: 352,
    edgeX: (t) => wave(t) + half(t), backX: (t) => wave(t) - half(t),
    tip: 'spear', tipLen: 0.032, overshoot: 0, bevel: 0.005,
  });
}
function bladeMesh(y0, tier) {
  const L = FLAMBERGE_GAME.blade - FLAMBERGE_GAME.ricasso;
  const F = FINISH[tier] ?? FINISH.common;
  // 등급 마감: 그쪽 값(거칠기 0.30 · 금속 0.9 · 반사 1) 대신 등급표(FINISH — 처음 에픽, 10/21 부터 레어)로 — 빛깔 0xa3adb4 와 날 세움 꼭짓점 색은 그대로
  const mat = metalMat(FLAMBERGE_COLORS.blade, {
    rough: F.blade, metal: F.metal, env: F.env, vertexColors: true, side: THREE.DoubleSide,
    ...(F.sheen ? { emissive: F.sheen, emissiveIntensity: 0.06 } : {}),
  });
  const m = new THREE.Mesh(flambergeBladeGeometry(), mat);
  m.position.y = Y(EDGE_SB + L / 2) - y0;
  m.name = 'waved-double-edge';
  m.castShadow = true;
  return m;
}

/**
 * weapons.js flamberge.partMesh 를 만든다. partY = 부품 자리 [자루, 폼멜, 코등이, 칼날] (칼 원점 기준 y — weapons.js buildParts 와 같은 값).
 *  fighter.js 가 부품마다 부르고 그 자리를 메쉬에 준다 → 여기서는 부품 안 좌표(우리 y − 부품 자리)로 그린다.
 *  칼날(3)은 물결 날 메쉬 하나를 그룹에 넣어 돌려준다 — 피 묻히기(fighter.bladeMesh)는 decorate 가 group.userData.bladeMesh 로 그 메쉬를 가리킨다.
 */
export function flambergePartMesh(partY) {
  return (index, isBlade, shape, color, opts, look, tier) => {
    const y0 = partY[index];
    if (isBlade) {
      const group = new THREE.Group();
      group.add(bladeMesh(y0, tier));
      return group;
    }
    if (index === 0) return gripGroup(y0);
    if (index === 1) return pommelGroup(y0);
    if (index === 2) return guardGroup(y0);
    return new THREE.Group();
  };
}

/**
 * weapons.js flamberge.decorate — 칼 그룹에 (칼 원점 기준 y 그대로):
 *  곧고 긴 날 안 세운 리카소(박물관 날 길이 안) · 앞으로 휜 보조 갈고리 둘(뿌리가 넓고 끝으로 가늘다) · 리카소와 물결 날 사이 이음 덩이.
 *  물결 날 메쉬를 피 묻히기 대상으로 알려 준다.
 */
export function flambergeDecorate(group) {
  const steel = metalMat(FLAMBERGE_COLORS.steel, { rough: 0.34 });
  const darkSteel = metalMat(FLAMBERGE_COLORS.darkSteel, { rough: 0.44 });
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  add(bake(new THREE.BoxGeometry(0.031, 0.237, 0.007), [0, Y(ROOT_SB + 0.237 / 2), 0]), darkSteel, 'straight-ricasso');
  const hook = [[0, 0], [0.032, 0.004], [0.061, 0.017], [0.083, 0.039], [0.089, 0.050], [0.072, 0.035], [0.047, 0.025], [0.019, 0.021], [0, 0.020]];
  add(mergeGeometries([
    ...[-1, 1].map((s) => bake(plate(hook.map(([x, y]) => [s * x, y]), 0.007, 0.0007), [0, Y(ROOT_SB + 0.220), 0])),
    bake(new THREE.BoxGeometry(0.027, 0.034, 0.006), [0, Y(EDGE_SB - 0.017), 0]),
  ].map((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    return g;
  }), false), steel, 'parrying-lugs');
  // 피는 물결 날에 묻는다 (리카소는 날을 안 세운 자리)
  group.traverse((o) => {
    if (o.name === 'waved-double-edge') group.userData.bladeMesh = o;
  });
}
