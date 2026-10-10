// 청람잔도 (`qinglan`) — 김씨(renji)의 무대. 초여름 한낮(12~1시), 깎아지른 화강암 절벽에 매달린 잔도(棧道).
//  처음엔 샛별 저장소에서 가져온 꼴(6dfd771 → 3d3ec11: 큰 강 협곡 위 바위 쉼터) 그대로였고, 사장님 디자인 리뷰
//  (10/10 21:0x "'잔도' 느낌이 안 나 … 기암절벽의 스케일이 남다른 태산") · 덧붙임('12~1시 한낮, 초여름') 로 다시 지었고,
//  10/11 00:1x ("글씨 너무 흉측하다. 없애. 나무 마루바닥이 너무 현대적 … 발아래에는 지금 거의 뭐가 안 보이잖아. 초기 맵 풍경 선택적으로 이식") 로 2차:
//   - 싸우는 바닥 = 절벽 구멍에 박은 통나무 들보 위에 거칠게 다듬은 두꺼운 널(폭·길이 들쭉날쭉, 틈, 바랜 회갈색, 이끼·밧줄, 뒤 구석은 바위 턱)
//     (물리 바닥·경계 벽은 다른 무대와 같다 — 겉모습만)
//   - 앞 가장자리 = 통나무 기둥과 쇠사슬 난간, 그 너머 발아래 멀리 옥빛 큰 강이 굽이치는 협곡(stage_qinglan_gorge.js — 샛별 초기 판에서 골라 옮김)
//   - 양 끝에서 절벽을 따라 이어지는 좁은 판자 잔도(오르막·내리막), 벽의 쇠사슬 손잡이. 마애 글씨는 없앴다
//   - 먼 경치(stage_qinglan_vista.js): 협곡 위로 솟은 거대한 바위 기둥 + 태산 같은 산덩이, 협곡 허리의 엷은 구름 띠 — 옅은 공기 원근
//  소리: 샘 낙수(springDrip)·새(cliffBird)는 샛별 것 그대로(stage_detail_sound.js), 자리만 새 꼴에 맞췄다.
//  그림자: 마루 난간(가까운 것)·돌만 드리운다. 마루·벽은 받는다. docs/stages.md '청람잔도'
import * as THREE from 'three';
import { Kit, rng, h3, canvasTex, box, cyl, limb } from './stage_kit.js';
import { buildQinglanVista, wallZ, wallSlope, cliffPine, CLOUD_Y } from './stage_qinglan_vista.js';
import { buildQinglanGorge } from './stage_qinglan_gorge.js';

const TAU = Math.PI * 2;
const DECK_HALF = 13.2; // 마루 양 끝 x
/** 마루 앞 가장자리 z (x 에서). 카메라가 가는 곳(가운데에서 10.5 m 안)까지 늘 마루 위다 */
const deckFront = (x) => 10.8 * Math.sqrt(Math.max(0, 1 - (x / 13.8) ** 2));
const DECK_BACK = -11.3;

class OwnedKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}

/** 나뭇결 질감 (회색조, 꼭짓점 색에 곱한다): 결이 u(가로) 방향으로 흐르고 갈라진 틈·옹이가 있다. 널마다 box 투사(uv: 'box')로 붙인다 */
function grainMap() {
  const r = rng(801301);
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6d2cb'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // 결 (가로로 길게, 조금씩 물결)
      const y = r() * h, a = 1 + r() * 3, ph = r() * 6;
      g.strokeStyle = r() < 0.6 ? `rgba(70,62,54,${0.08 + r() * 0.16})` : `rgba(255,252,245,${0.08 + r() * 0.12})`;
      g.lineWidth = 0.8 + r() * 2.2;
      g.beginPath();
      for (let x = -8; x <= w + 8; x += 16) { const yy = y + Math.sin(x * 0.02 + ph) * a; x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < 26; i++) { // 비바람에 갈라진 틈
      const x = r() * w, y = r() * h, len = 40 + r() * 160;
      g.strokeStyle = 'rgba(40,34,30,.55)'; g.lineWidth = 1.5 + r() * 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 6); g.stroke();
    }
    for (let i = 0; i < 9; i++) { // 옹이
      const x = r() * w, y = r() * h, rx = 6 + r() * 9;
      g.fillStyle = 'rgba(60,50,42,.5)'; g.beginPath(); g.ellipse(x, y, rx, rx * 0.55, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,50,42,.3)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, rx * 1.9, rx * 0.9, 0, 0, TAU); g.stroke();
    }
  });
  tex.colorSpace = THREE.NoColorSpace; // 밝기 곱셈용 (색은 꼭짓점 색이 정한다)
  return tex;
}

/** 절벽 벽: 가운데는 마루 뒤에 곧게 서고 양끝은 앞으로 휘어 감싸는 큰 반원 화강암 벽. 세로 결·물 얼룩·바위틈 초록 */
function cliffWall() {
  const us = [];
  for (let k = -1; k <= 1; k += 2) {
    const side = [];
    for (let x = 0; x <= 150; x += x < 30 ? 1.6 : x < 70 ? 3.5 : 7) side.push(x * k);
    us.push(...(k < 0 ? side.reverse() : side.slice(1)));
  }
  us.sort((a, b) => a - b);
  const ROWS = [-260, -180, -125, -88, -62, -44, -31, -22, -15, -10, -6.5, -4, -2, -0.6, 0.6, 2, 3.6, 5.4, 7.5, 10, 13, 17, 22, 28, 36, 46, 58, 73, 90, 110, 132, 156, 180];
  const topY = (x) => { const ax = Math.abs(x); return ax < 60 ? 180 : THREE.MathUtils.lerp(180, CLOUD_Y - 30, THREE.MathUtils.smoothstep(ax, 60, 150)); };
  // 마루 둘레(|x|<16, -3<y<12): 마루와 닿는 띠(-1.5<y<1.6)만 판판하고(10/11 마애 글씨를 없애 그 자리도 거친 바위로), 나머지는 안쪽으로만 얕게 패인다(마루 뒤에 틈이 안 보이게)
  const inNear = (x, y) => Math.abs(x) < 16 && y > -3 && y < 12;
  const flat = (x, y) => y > -1.5 && y < 1.6;
  const jit = (x, y0) => [(h3(x, y0, 1, 3) - 0.5) * (Math.abs(x) < 30 ? 1.1 : 3), (h3(x, y0, 2, 5) - 0.5) * Math.min(6, Math.abs(y0) * 0.25 + 0.4)];
  const P = (x0, yy) => {
    const [jx, jy] = inNear(x0, yy) && flat(x0, yy) ? [0, 0] : jit(x0, yy); // 격자가 보이지 않게 꼭짓점을 흔든다(판판한 자리는 그대로)
    const x = x0 + jx, y0 = yy + jy;
    const y = y0 > 0 ? (y0 * topY(x)) / 180 : y0;
    const dz = wallSlope(x);
    const nl = Math.hypot(dz, 1), nx = -dz / nl, nz = 1 / nl; // 벽에서 열린 쪽으로 향한 법선
    // 세로 결(화강암 절리) + 큰 혹 + 가로 턱
    let d = 1.3 * Math.sin(x * 0.85 + Math.sin(y * 0.04) * 2) + 0.7 * Math.sin(x * 2.3 + y * 0.03)
      + 3.2 * Math.sin(x * 0.11 + y * 0.023) * Math.sin(y * 0.05 + x * 0.03) + 0.8 * Math.sin(y * 0.6 + x * 0.2);
    if (inNear(x0, yy)) d = flat(x0, yy) ? 0 : -Math.abs(d) * 0.3;
    return [x + nx * d, y, wallZ(x) + nz * d];
  };
  const pos = [], col = [];
  const base = new THREE.Color(0xa29d90), stain = new THREE.Color(0x5d5c56), moss = new THREE.Color(0x58833f), c = new THREE.Color();
  const push = (p) => {
    pos.push(...p);
    const s = 0.5 + 0.5 * Math.sin(p[0] * 1.7 + Math.sin(p[1] * 0.08) * 3);
    c.copy(base).lerp(stain, s ** 3 * 0.75 + (p[1] < -20 ? 0.18 : 0));
    const ledge = Math.max(0, Math.sin(p[1] * 0.6 + p[0] * 0.2)) ** 6;
    if (Math.abs(p[0]) > 15 || p[1] < -4 || p[1] > 12) c.lerp(moss, ledge * 0.7);
    col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < ROWS.length - 1; j++) for (let i = 0; i < us.length - 1; i++) {
    const a = P(us[i], ROWS[j]), b = P(us[i + 1], ROWS[j]), cc = P(us[i], ROWS[j + 1]), d = P(us[i + 1], ROWS[j + 1]);
    push(a); push(b); push(cc); push(b); push(d); push(cc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.receiveShadow = true;
  m.name = 'qinglan-cliff';
  return m;
}

/** 늘어진 쇠사슬: a → b 사이를 고리(작은 납작 상자, 번갈아 90°)로 잇는다. 고리 수가 많아 가까운 마루 난간만 쓴다 */
function chain(K, bin, a, b, sag, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B), n = Math.max(4, Math.round(len / 0.11));
  const pt = (t) => new THREE.Vector3().lerpVectors(A, B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), roll = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const p0 = pt(i / n), p1 = pt((i + 1) / n);
    const dir = p1.clone().sub(p0).normalize();
    q.setFromUnitVectors(X, dir);
    roll.setFromAxisAngle(X, i % 2 ? Math.PI / 2 : 0);
    m.compose(p0.add(p1).multiplyScalar(0.5), q.multiply(roll), new THREE.Vector3(1, 1, 1));
    K.putM(bin, box(0.14, 0.045, 0.018), color, m, { vary: 0, noise: 0.05 });
  }
}

/** 마루: 판자 바닥(질감 한 장) + 앞 가장자리 들보 + 밑의 들보·버팀대(절벽에 박힘) + 쇠사슬 난간 + 붉은 천·자물쇠 */
/** x 에서 마루 앞 가장자리 안쪽인 z 범위의 x 한계 (줄 z 에서 널이 갈 수 있는 |x|) */
const rowHalf = (z) => (z <= 0 ? DECK_HALF : Math.min(DECK_HALF, 13.8 * Math.sqrt(Math.max(0, 1 - (z / 10.8) ** 2))));

/**
 * 옛 잔도 마루 (10/11 사장님 '나무 마루바닥이 너무 현대적'): 절벽 구멍에 박은 통나무 들보 위에, 절벽과 나란히 거칠게 다듬은 두꺼운 널을 얹었다.
 *  널 폭 0.24~0.46 m · 길이 1.3~3.6 m 가 줄마다 들쭉날쭉하고 사이가 벌어져(틈 2~6 cm) 밑의 어둠과 들보가 보인다. 비바람에 바랜 회갈색,
 *  절벽 가까이·구석엔 이끼, 뒤 양 구석은 바위 턱이 마루를 대신한다. 널 윗면은 y 0 ± 1 cm (물리 바닥은 그대로 평평한 판정 면)
 */
function deck(K, scene) {
  const r = rng(801323);
  const WOOD = 0x6a5d4e, DARK = 0x3d3530, IRON = 0x2e2f31, ROPE = 0x8b7c5e;
  const BOARD = [0x8b8173, 0x7d7466, 0x948a7a, 0x726a5e, 0x857a68, 0x9a9282];
  // 밑 어둠: 널 틈으로 보이는 그늘 (마루 꼴 한 장, 10 cm 아래)
  const shape = new THREE.Shape();
  shape.moveTo(-DECK_HALF, -DECK_BACK);
  for (let i = 0; i <= 48; i++) { const x = -DECK_HALF + (2 * DECK_HALF * i) / 48; shape.lineTo(x, -deckFront(x)); }
  shape.lineTo(DECK_HALF, -DECK_BACK);
  shape.closePath();
  const under = new THREE.ShapeGeometry(shape, 1);
  under.rotateX(-Math.PI / 2);
  K.put('beam', under, 0x1f1b18, [0, -0.13, 0], undefined, 1, { vary: 0, noise: 0.02 });
  // 바위 턱 (뒤 양 구석: 샘 돌확·돌 등 자리) — 윗면 y 0~2 cm, 거친 모서리
  const ledge = (x, z, w, d) => K.put('stone', box(w, 0.6, d), 0x8d8f86, [x, -0.29 + r() * 0.02, z], [0, (r() - 0.5) * 0.12, 0], 1, { rough: 0.09, noise: 0.08, uv: 'box', uvScale: 0.5 });
  ledge(-11.2, -10.2, 4.2, 2.6); ledge(-12.6, -7.9, 1.8, 2.2); ledge(11.4, -10.3, 3.8, 2.4); ledge(12.5, -8.4, 1.6, 1.8);
  const onLedge = (x, z) => (x < -9.2 && z < -9.0) || (x < -11.6 && z < -6.8) || (x > 9.6 && z < -9.1) || (x > 11.7 && z < -7.5);
  // 널: 절벽과 나란히(x 방향) 줄지어 놓는다
  let z = DECK_BACK + 0.05;
  let boards = 0;
  while (z < 10.9) {
    const wz = 0.24 + r() * 0.22, cz = z + wz / 2;
    const half = rowHalf(cz + wz / 2);
    if (half < 0.6) break;
    let x = -half - r() * 0.15;
    while (x < half) {
      const len = 1.3 + r() * 2.3, x1 = Math.min(x + len, half + r() * 0.2);
      if (x1 - x > 0.35 && !onLedge((x + x1) / 2, cz)) {
        const t = 0.09 + r() * 0.05, cx = (x + x1) / 2;
        const mossy = Math.abs(cx) > 9 || cz < -10 ? r() < 0.4 : r() < 0.05; // 절벽 가까이·구석일수록 이끼 낀 널 (옅게)
        const col = mossy ? 0x7a7b63 : BOARD[Math.floor(r() * BOARD.length)];
        K.put('deck', box(x1 - x, t, wz), col, [cx, -t / 2 + (r() - 0.5) * 0.02, cz], [(r() - 0.5) * 0.02, (r() - 0.5) * 0.03, (r() - 0.5) * 0.012], 1,
          { rough: 0.012, noise: 0.07, vary: 0.16, uv: 'box', uvScale: 0.55 });
        boards++;
      }
      x = x1 + 0.02 + r() * 0.05;
    }
    z += wz + 0.02 + r() * 0.04;
  }
  // 앞 가장자리 통나무 (마루 두께가 보이게, 거친 껍질)
  const edge = [];
  for (let i = 0; i <= 40; i++) { const x = -DECK_HALF + (2 * DECK_HALF * i) / 40; edge.push([x, deckFront(x)]); }
  for (let i = 0; i < edge.length - 1; i++) {
    const [x0, z0] = edge[i], [x1, z1] = edge[i + 1];
    limb(K, 'beam', [x0, -0.2, z0 + 0.08], [x1, -0.2, z1 + 0.08], 0.17, 0.17, 0x584c40, { noise: 0.08, rough: 0.02 }, 7);
  }
  for (const s of [-1, 1]) limb(K, 'beam', [s * DECK_HALF, -0.2, DECK_BACK], [s * DECK_HALF, -0.2, deckFront(DECK_HALF) + 0.05], 0.17, 0.17, 0x584c40, { noise: 0.08, rough: 0.02 }, 7);
  // 밑의 통나무 들보: 절벽 구멍(어두운 네모)에서 바깥으로 나와 앞 가장자리 밖으로 끝이 삐죽 나온다 + 비스듬한 버팀대(절벽 밑 7~9 m)
  for (let x = -DECK_HALF + 0.6; x <= DECK_HALF - 0.5; x += 2.2) {
    const zf = deckFront(x);
    const zb = wallZ(x) - 0.4, zt = zf + 0.35 + r() * 0.25;
    limb(K, 'beam', [x, -0.36, zb], [x + (r() - 0.5) * 0.1, -0.36, zt], 0.19, 0.17, WOOD, { noise: 0.08, rough: 0.025 }, 7);
    K.put('beam', box(0.5, 0.5, 0.06), 0x16130f, [x, -0.36, wallZ(x) + 0.02]); // 절벽에 판 들보 구멍
    limb(K, 'beam', [x, -0.55, zf - 0.6], [x, -8.5 + 0.3 * Math.sin(x), wallZ(x) + 0.3], 0.12, 0.14, WOOD, { noise: 0.08 }, 6);
    // 들보 끝을 동여맨 밧줄 두 바퀴
    for (const dz of [-0.12, 0.05]) K.put('rope', new THREE.TorusGeometry(0.2, 0.028, 4, 10), ROPE, [x, -0.36, zf - 0.2 + dz], [0, 0, 0], 1, { vary: 0.1, noise: 0.05 });
  }
  // 난간: 가장자리 안쪽 0.25 m 에 껍질 벗긴 통나무 기둥(쇠 머리), 밑동을 밧줄로 동여맸다. 기둥 사이 쇠사슬 두 줄
  const posts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, a = Math.PI * (1 - t);
    let x = Math.cos(a) * 13.3; x = THREE.MathUtils.clamp(x, -DECK_HALF + 0.25, DECK_HALF - 0.25);
    const z = deckFront(x) - 0.28;
    posts.push([x, z]);
    const lean = (r() - 0.5) * 0.06;
    limb(K, 'rail', [x, -0.25, z], [x + lean, 1.12, z + lean], 0.085, 0.07, 0x6e6252, { noise: 0.08, rough: 0.012 }, 6);
    K.put('railIron', cyl(0.085, 0.085, 0.07, 6), IRON, [x + lean, 1.15, z + lean]);
    K.put('rope', new THREE.TorusGeometry(0.1, 0.022, 4, 9), ROPE, [x, 0.1, z], [Math.PI / 2, 0, 0], 1, { vary: 0.1, noise: 0.05 });
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const [x0, z0] = posts[i], [x1, z1] = posts[i + 1];
    chain(K, 'railIron', [x0, 1.02, z0], [x1, 1.02, z1], 0.16, IRON);
    chain(K, 'railIron', [x0, 0.55, z0], [x1, 0.55, z1], 0.1, IRON);
    // 붉은 천(소원 띠)과 자물쇠 몇 개
    if (r() < 0.55) {
      const t = 0.3 + r() * 0.4, x = THREE.MathUtils.lerp(x0, x1, t), z = THREE.MathUtils.lerp(z0, z1, t);
      const y = 1.02 - 0.16 * 4 * t * (1 - t);
      K.put('ribbon', box(0.07, 0.42 + r() * 0.2, 0.012), 0xb3261e, [x, y - 0.24, z], [0.05, r() * TAU, 0.08]);
    }
    if (r() < 0.6) for (let k = 0; k < 1 + Math.floor(r() * 3); k++) {
      const t = 0.15 + r() * 0.7, x = THREE.MathUtils.lerp(x0, x1, t), z = THREE.MathUtils.lerp(z0, z1, t);
      K.put('railIron', box(0.06, 0.07, 0.025), r() < 0.5 ? 0xb08d3c : 0x8a3a2c, [x, 1.02 - 0.16 * 4 * t * (1 - t) - 0.07, z], [0, r() * TAU, 0]);
    }
  }
  // 절벽 쪽: 벽에 박은 쇠고리와 손잡이 사슬, 작은 샘 돌확, 돌 의자, 돌 등
  const back = wallZ(0) + 0.25;
  for (let x = -12.5; x <= 12.5; x += 2.5) K.put('iron', cyl(0.06, 0.06, 0.25, 5), IRON, [x, 1.15, back - 0.05], [Math.PI / 2, 0, 0]);
  chain(K, 'railIron', [-12.5, 1.15, back + 0.07], [-2, 1.15, back + 0.07], 0.12, IRON);
  chain(K, 'railIron', [7, 1.15, back + 0.07], [12.5, 1.15, back + 0.07], 0.12, IRON);
  K.put('stone', cyl(0.62, 0.76, 0.26, 12), 0x8f948a, [-10.4, 0.13, back + 0.6]);
  K.put('water', cyl(0.52, 0.52, 0.01, 14), 0x6aa6a2, [-10.4, 0.265, back + 0.6]);
  K.put('stone', box(0.5, 0.18, 0.35), 0x7d8279, [-10.4, 1.62, back + 0.05], [0.1, 0, 0]); // 샘이 스미는 바위 턱
  K.put('stone', box(2.4, 0.16, 0.6), 0x9a9c92, [-5.6, 0.48, back + 0.45], undefined, 1, { rough: 0.02 });
  for (const x of [-6.5, -4.7]) K.put('stone', box(0.32, 0.42, 0.5), 0x878a81, [x, 0.21, back + 0.45]);
  K.put('stone', box(0.42, 0.9, 0.42), 0x9b9d94, [10.2, 0.45, back + 0.5]);
  K.put('stone', box(0.7, 0.14, 0.7), 0x8d9087, [10.2, 0.97, back + 0.5]);
  K.put('stone', box(0.4, 0.34, 0.4), 0xa3a59b, [10.2, 1.21, back + 0.5]);
  K.put('stone', cyl(0.05, 0.5, 0.36, 4), 0x7f6b55, [10.2, 1.56, back + 0.5], [0, Math.PI / 4, 0]);
}

/** 좁은 판자 잔도: 마루 양 끝에서 절벽을 따라 (오른쪽은 오르막, 왼쪽은 내리막) — 판자·쇠 받침 들보·버팀대·바깥 기둥과 늘어진 사슬 */
function plankRoads(K) {
  const WOOD = 0x5e4a36, DARK = 0x3d3027, IRON = 0x2e2f31;
  for (const s of [-1, 1]) {
    const rise = s > 0 ? 0.16 : -0.11;
    let prevPost = null;
    let i = 0;
    for (let ax = DECK_HALF + 0.1; ax < 118; ax += ax < 40 ? 0.34 : 0.62, i++) { // 40 m 밖은 널을 두 배 넓게(멀어서 같은 꼴, 삼각형 절반 — 10/11 3차)
      const x = s * ax, y = (ax - DECK_HALF) * rise + (s > 0 ? Math.max(0, ax - 60) * 0.12 : 0);
      const ang = Math.atan2(wallSlope(x), 1); // 벽을 따라 돈다 (판자 방향)
      const wz = wallZ(x) + 0.15;
      const nx = -Math.sin(ang), nz = Math.cos(ang); // 벽에서 바깥
      const w = 1.7;
      const cx = x + nx * w / 2, cz = wz + nz * w / 2;
      K.put('road', box(ax < 40 ? 0.3 : 0.58, 0.06, w), i % 7 === 3 ? 0x6e665a : 0x7d7466, [cx, y, cz], [0, -ang, 0], 1, { vary: 0.18, noise: 0.05 });
      if (i % 5 === 0) {
        // 벽에 박은 들보(받침)와 아래 버팀대
        K.put('road', box(0.12, 0.12, w + 0.4), DARK, [x + nx * (w / 2 - 0.15), y - 0.1, wz + nz * (w / 2 - 0.15)], [0, -ang, 0]);
        limb(K, 'road', [x + nx * (w - 0.1), y - 0.12, wz + nz * (w - 0.1)], [x + nx * 0.05, y - 1.9, wz + nz * 0.05], 0.05, 0.05, DARK, {}, 4);
        // 바깥 기둥 + 늘어진 사슬(멀어서 가는 막대로)
        const post = [x + nx * (w - 0.08), y, wz + nz * (w - 0.08)];
        limb(K, 'road', post, [post[0], y + 1.05, post[2]], 0.05, 0.045, IRON, {}, 4);
        if (prevPost) limb(K, 'road', [prevPost[0], prevPost[1] + 0.95, prevPost[2]], [post[0], y + 0.95, post[2]], 0.018, 0.018, IRON, {}, 3);
        prevPost = post;
      }
    }
  }
  // 마루 왼쪽 위 절벽에 붙은 작은 정자(亭): 절벽 크기를 재는 눈금 (붉은 기둥·검푸른 휜 지붕)
  const px = -27, pz = wallZ(-27) + 2.6, py = 21;
  K.put('road', box(5.4, 1.0, 4.6), 0x8f8a7e, [px, py - 0.5, pz - 0.6], [0, 0.25, 0], 1, { rough: 0.2 });
  for (let k = 0; k < 6; k++) { // 정자까지 지그재그 돌계단 (벽에 붙은 판자 계단)
    const y0 = (k * py) / 6, x0 = -DECK_HALF - 1 - (k % 2 ? 8 : 2), x1 = -DECK_HALF - 1 - (k % 2 ? 2 : 8);
    limb(K, 'road', [x0, y0 + 0.2, wallZ(x0) + 0.6], [x1, y0 + py / 6, wallZ(x1) + 0.6], 0.3, 0.3, 0x6e5d48, {}, 4);
  }
  K.push([px, py, pz - 0.6], 0.25);
  for (const x of [-1.6, 1.6]) for (const z of [-1.2, 1.2]) limb(K, 'pavilion', [x, 0, z], [x, 2.5, z], 0.11, 0.1, 0xa2302a, {}, 6);
  for (const sgn of [-1, 1]) for (let i = 0; i < 18; i++) {
    const x = -2.05 + i * 0.24, strip = [];
    const roof = (xx, t) => [xx, 3.1 - 0.7 * Math.sin((t * Math.PI) / 2) + 0.3 * t ** 6, sgn * t * 1.9];
    for (let j = 0; j < 6; j++) {
      const a = roof(x, j / 6), b = roof(x + 0.245, j / 6), c = roof(x, (j + 1) / 6), d = roof(x + 0.245, (j + 1) / 6);
      if (sgn === 1) strip.push(...a, ...c, ...b, ...b, ...c, ...d); else strip.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(strip, 3)); g.computeVertexNormals();
    K.put('roof', g, i % 3 ? 0x3f5552 : 0x4b615c);
  }
  K.pop();
}

function sky(scene) {
  // 한낮의 맑은 하늘: 위는 짙은 하늘색, 지평선은 옅은 푸른빛 (노을·새벽 색 없음)
  const tex = canvasTex(8, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    // 10/11 3차(사장님 '좀 아침같네. 한낮보다는'): 지평선의 옅은 흰빛(아침 안개 하늘)을 걷고 한낮의 짙고 맑은 푸른색으로, 채도를 올렸다
    grad.addColorStop(0, '#1c64c4'); grad.addColorStop(0.3, '#3d86d8'); grad.addColorStop(0.46, '#7ab4e6'); grad.addColorStop(0.5, '#9cc8ec'); grad.addColorStop(1, '#a8cfee');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(660, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }));
  mesh.name = 'qinglan-sky';
  scene.add(mesh);
}

function smallBird(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x263c36, side: THREE.DoubleSide });
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g; };
  const group = new THREE.Group(); group.name = 'qinglan-cliff-bird';
  const left = new THREE.Mesh(tri([0, 0, 0, -0.55, 0, 0.08, -0.22, 0, -0.12]), mat);
  const right = new THREE.Mesh(tri([0, 0, 0, 0.55, 0, 0.08, 0.22, 0, -0.12]), mat);
  group.add(left, right); group.visible = false; scene.add(group);
  return { group, left, right };
}

export function buildQinglan(scene, { hemi, sun }) {
  // 초여름 한낮(12~1시): 높이 뜬 해, 맑고 밝은 하늘, 옅은 공기 원근(멀수록 푸르스름 — 안개는 멀리서 옅게만)
  // 10/11 3차: 한낮으로 — 대기를 줄여 먼 능선까지 또렷하게(안개 80~2000 m: 400 m 에서 약 0.17, 2차 0.37), 햇빛은 밝은 중성 백색(2차 0xfff8ee 노르스름),
  //  반구광은 덜 푸르게(2차 0xd8ebff). 골짜기 허리 구름 띠는 stage_qinglan_vista.js 에서 뺐다(골짜기 안개는 아침에 끼고 한낮이면 걷힌다)
  scene.background = new THREE.Color(0x9cc8ec);
  scene.fog = new THREE.Fog(0xa9cdea, 80, 2000);
  hemi.color.setHex(0xe4eefa); hemi.groundColor.setHex(0x76806c); hemi.intensity = 1.5;
  sun.color.setHex(0xffffff); sun.intensity = 2.75;
  sky(scene);
  const vista = buildQinglanVista(scene);
  scene.add(cliffWall());
  const gorge = buildQinglanGorge(scene); // 발아래 큰 강 협곡 (샛별 초기 판에서 골라 옮김, 10/11)
  const K = new OwnedKit(801311);
  deck(K, scene);
  plankRoads(K);
  // 바위틈 소나무 (마루 둘레 절벽과 잔도 위아래) — 싱그러운 초여름 초록
  const r = rng(801313);
  const pinesAt = [[-15.5, 7.5], [16.5, 9], [-21, -6], [22, -9], [-34, 13], [30, 16], [-45, -14], [41, 4], [10, 14.5], [-8, 18], [55, 26], [-60, 6]];
  pinesAt.forEach(([x, y], i) => cliffPine(K, x, y, wallZ(x) + 0.3, 1.1 + r() * 0.7, 81260 + i * 7, Math.atan2(1, -wallSlope(x)) + (x > 0 ? -0.4 : 0.4))); // 벽 법선 쪽으로 눕는다
  const mats = {
    deck: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: grainMap() }),
    rope: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    beam: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    rail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    railIron: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.5 }),
    iron: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.45 }),
    ribbon: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    water: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.03 }),
    road: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    pavilion: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: true }),
  };
  const CAST = new Set(['rail', 'stone']); // 마루 위 가까운 것만 그림자를 드리운다 (쇠사슬 railIron 은 10/11 3차에 뺐다: 사슬 고리 9 천여 삼각형이 그림자 그리기에 한 번 더 들어가는데, 한낮이라 그림자가 발밑에 짧아 사슬 그림자는 거의 안 보인다)
  for (const [name, mat] of Object.entries(mats)) {
    const mesh = K.mesh(name, mat, { cast: CAST.has(name), receive: name !== 'leaf' && name !== 'wood' });
    if (!mesh) { mat.dispose(); continue; }
    mesh.name = 'qinglan-' + name; scene.add(mesh);
    for (const g of K.bins[name]) g.dispose();
  }
  // 샘 물방울(샛별 것 그대로의 소리와 같은 때에 떨어진다) · 낭떠러지 위를 지나는 작은 새
  const SPRING = { x: -10.4, z: wallZ(0) + 0.6 };
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: 0xc1e0dd }));
  drop.name = 'qinglan-spring-drop'; drop.visible = false; scene.add(drop);
  const bird = smallBird(scene), rr = rng(801319);
  let time = 0, nextDrip = 3.2, nextBird = 11, birdStart = -100, birdCalled = false;
  const stage = {
    sunOffset: { x: 1.2, y: 20, z: 1 }, // 한낮 12~1시: 해가 거의 머리 위(고도 약 86°, 2차 77°) — 그림자가 발밑에 짧고 진하다
    fighterLight: { color: 0xf4f4f2, rimColor: 0xdde9f2, rim: 0.8, level: 0.35 },
    stats: { ...vista.stats, gorge },
    excite() {},
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, 0.1);
      if (time >= nextBird) { birdStart = time; birdCalled = false; nextBird = time + 33 + rr() * 13; }
      const pass = time - birdStart;
      bird.group.visible = pass >= 0 && pass < 5.2;
      if (bird.group.visible) {
        bird.group.position.set(-30 + pass * 11, -3 + Math.sin(pass) * 0.8, 26 + Math.sin(pass * 0.8) * 3);
        bird.left.rotation.z = Math.sin(time * 8) * 0.22; bird.right.rotation.z = -Math.sin(time * 8) * 0.22;
        if (pass >= 1 && !birdCalled) { birdCalled = true; stage.onEvent?.('stageDetail', { kind: 'cliffBird', amp: 0.85, pos: { ...bird.group.position }, seed: 8013, time }); }
      }
      const until = nextDrip - time;
      drop.visible = until > 0 && until < 0.42;
      if (drop.visible) drop.position.set(SPRING.x, 1.52 - 1.25 * (1 - until / 0.42) ** 2, SPRING.z - 0.45);
      if (time >= nextDrip) {
        if (Math.abs(time - (birdStart + 1)) > 2.1 && Math.abs(time - (nextBird + 1)) > 2.1)
          stage.onEvent?.('stageDetail', { kind: 'springDrip', amp: 0.8, pos: { x: SPRING.x, y: 0.27, z: SPRING.z }, seed: 8014, time });
        nextDrip = time + 2.8 + rr() * 2.2;
      }
    },
  };
  return stage;
}
