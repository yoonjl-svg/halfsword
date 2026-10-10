// 청람잔도 (`qinglan`) — 김씨(renji)의 무대. 초여름 한낮(12~1시), 깎아지른 화강암 절벽에 매달린 잔도(棧道).
//  처음엔 샛별 저장소에서 가져온 꼴(6dfd771 → 3d3ec11: 큰 강 협곡 위 바위 쉼터) 그대로였고, 사장님 디자인 리뷰
//  (10/10 21:0x "'잔도' 느낌이 안 나 … 기암절벽의 스케일이 남다른 태산") · 덧붙임('12~1시 한낮, 초여름') 로 다시 지었다:
//   - 싸우는 바닥 = 절벽 면에 박은 나무 들보·쇠 받침 위의 넓은 판자 마루 (물리 바닥·경계 벽은 다른 무대와 같다 — 장식만)
//   - 앞 가장자리 = 쇠사슬 난간, 그 너머는 발아래 아득한 낭떠러지와 흰 구름 바다
//   - 양 끝에서 절벽을 따라 이어지는 좁은 판자 잔도(오르막·내리막), 벽의 쇠사슬 손잡이, 벽의 붉은 마애 글씨(태산 꼴)
//   - 먼 경치(stage_qinglan_vista.js): 구름 위로 솟은 거대한 바위 기둥 세 겹 + 태산 같은 산덩이 — 옅은 공기 원근
//  소리: 샘 낙수(springDrip)·새(cliffBird)는 샛별 것 그대로(stage_detail_sound.js), 자리만 새 꼴에 맞췄다.
//  그림자: 마루 난간(가까운 것)만 드리운다. 마루·벽은 받는다. docs/stages.md '청람잔도'
import * as THREE from 'three';
import { Kit, rng, h3, canvasTex, box, cyl, limb } from './stage_kit.js';
import { buildQinglanVista, wallZ, wallSlope, cliffPine, CLOUD_Y } from './stage_qinglan_vista.js';

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

/** 판자 질감 (4 m × 4 m 한 장): 절벽에서 바깥쪽으로 놓인 판자, 판 사이 틈, 닳은 결, 쇠못 */
function plankMap() {
  const r = rng(801301);
  const tex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#2a241d'; g.fillRect(0, 0, w, h);
    const n = 14, bw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = i * bw;
      let y = -r() * 200;
      while (y < h) {
        const len = 260 + r() * 420;
        const tone = 118 + r() * 38;
        g.fillStyle = `rgb(${tone},${tone * 0.9 | 0},${tone * 0.74 | 0})`;
        g.fillRect(x0 + 3, y + 3, bw - 6, len - 6);
        for (let k = 0; k < 14; k++) { // 나뭇결
          g.strokeStyle = `rgba(${r() < 0.5 ? '70,55,40' : '205,190,160'},${0.08 + r() * 0.1})`;
          g.lineWidth = 1 + r() * 2;
          const gx = x0 + 6 + r() * (bw - 12);
          g.beginPath(); g.moveTo(gx, y + 4); g.bezierCurveTo(gx + (r() - 0.5) * 8, y + len * 0.3, gx + (r() - 0.5) * 8, y + len * 0.7, gx + (r() - 0.5) * 6, y + len - 4); g.stroke();
        }
        g.fillStyle = 'rgba(40,36,34,.9)'; // 들보에 박은 쇠못
        for (const yy of [y + 18, y + len - 22]) for (const xx of [x0 + bw * 0.28, x0 + bw * 0.72]) { g.beginPath(); g.arc(xx, yy, 3.2, 0, TAU); g.fill(); }
        y += len;
      }
    }
    // 가운데로 지나다니며 밝게 닳은 자리
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,240,215,0)'); grad.addColorStop(0.5, 'rgba(255,240,215,.08)'); grad.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  tex.repeat.set(0.25, 0.25);
  return tex;
}

/** 붉은 마애 글씨 (태산 바위 글씨 꼴): 투명 바탕, alphaTest 로 그린다(정렬 필요 없음) */
function inscription() {
  const tex = canvasTex(256, 768, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#a3241c';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 168px "Noto Serif CJK SC","Noto Serif CJK KR","Songti SC","SimSun",serif';
    ['青', '嵐', '棧', '道'].forEach((c, i) => g.fillText(c, w / 2, 96 + i * 180));
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7.8), mat);
  m.position.set(3.6, 5.6, wallZ(3.6) + 0.04);
  m.name = 'qinglan-inscription';
  return m;
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
  // 마루 둘레(|x|<16, -3<y<12): 마루와 닿는 띠(-1.5<y<1.6)와 마애 글씨 자리만 판판하고, 나머지는 안쪽으로만 얕게 패인다(마루 뒤에 틈이 안 보이게)
  const inNear = (x, y) => Math.abs(x) < 16 && y > -3 && y < 12;
  const flat = (x, y) => (y > -1.5 && y < 1.6) || (Math.abs(x - 3.6) < 1.8 && y > 1.2 && y < 10);
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
function deck(K, scene) {
  const shape = new THREE.Shape();
  shape.moveTo(-DECK_HALF, -DECK_BACK);
  for (let i = 0; i <= 48; i++) { const x = -DECK_HALF + (2 * DECK_HALF * i) / 48; shape.lineTo(x, -deckFront(x)); }
  shape.lineTo(DECK_HALF, -DECK_BACK);
  shape.closePath();
  const floorGeo = new THREE.ShapeGeometry(shape, 1);
  floorGeo.rotateX(-Math.PI / 2); // shape y → -z
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: plankMap(), roughness: 0.92, color: 0xd8cfc0 }));
  floor.receiveShadow = true; floor.name = 'qinglan-deck'; scene.add(floor);
  const WOOD = 0x5e4a36, DARK = 0x3d3027, IRON = 0x2e2f31;
  // 앞 가장자리 들보 (마루 두께가 보이게)
  const edge = [];
  for (let i = 0; i <= 40; i++) { const x = -DECK_HALF + (2 * DECK_HALF * i) / 40; edge.push([x, deckFront(x)]); }
  for (let i = 0; i < edge.length - 1; i++) {
    const [x0, z0] = edge[i], [x1, z1] = edge[i + 1];
    limb(K, 'beam', [x0, -0.17, z0 + 0.05], [x1, -0.17, z1 + 0.05], 0.2, 0.2, DARK, { noise: 0.04 }, 4);
  }
  for (const s of [-1, 1]) limb(K, 'beam', [s * DECK_HALF, -0.17, DECK_BACK], [s * DECK_HALF, -0.17, deckFront(DECK_HALF) + 0.05], 0.2, 0.2, DARK, {}, 4);
  // 밑의 들보: 절벽에서 바깥으로 나온 굵은 들보 + 비스듬한 버팀대 (절벽 밑 7~9 m 에 박힘)
  for (let x = -DECK_HALF + 0.6; x <= DECK_HALF - 0.5; x += 2.2) {
    const zf = deckFront(x) - 0.25;
    K.put('beam', box(0.3, 0.34, zf - DECK_BACK + 0.6), WOOD, [x, -0.45, (zf + DECK_BACK) / 2 - 0.3], undefined, 1, { noise: 0.06 });
    limb(K, 'beam', [x, -0.6, zf - 0.4], [x, -8.5 + 0.3 * Math.sin(x), wallZ(x) + 0.3], 0.13, 0.15, WOOD, { noise: 0.06 }, 5);
    K.put('iron', box(0.36, 0.08, 0.36), IRON, [x, -0.25, zf - 0.1]);
  }
  // 쇠사슬 난간: 가장자리 안쪽 0.25 m 에 나무 기둥(쇠 머리), 기둥 사이 사슬 두 줄
  const posts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, a = Math.PI * (1 - t);
    let x = Math.cos(a) * 13.3; x = THREE.MathUtils.clamp(x, -DECK_HALF + 0.25, DECK_HALF - 0.25);
    const z = deckFront(x) - 0.28;
    posts.push([x, z]);
    K.put('rail', box(0.14, 1.12, 0.14), WOOD, [x, 0.56, z], [0, -a, 0], 1, { rough: 0.01, noise: 0.06 });
    K.put('railIron', cyl(0.1, 0.1, 0.08, 6), IRON, [x, 1.15, z]);
  }
  const r = rng(801327);
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
    for (let ax = DECK_HALF + 0.1; ax < 118; ax += 0.34, i++) {
      const x = s * ax, y = (ax - DECK_HALF) * rise + (s > 0 ? Math.max(0, ax - 60) * 0.12 : 0);
      const ang = Math.atan2(wallSlope(x), 1); // 벽을 따라 돈다 (판자 방향)
      const wz = wallZ(x) + 0.15;
      const nx = -Math.sin(ang), nz = Math.cos(ang); // 벽에서 바깥
      const w = 1.7;
      const cx = x + nx * w / 2, cz = wz + nz * w / 2;
      K.put('road', box(0.3, 0.06, w), i % 7 === 3 ? 0x6b5a46 : 0x7a6650, [cx, y, cz], [0, -ang, 0], 1, { vary: 0.18, noise: 0.05 });
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
    grad.addColorStop(0, '#3f8fd0'); grad.addColorStop(0.38, '#7fb9e2'); grad.addColorStop(0.5, '#c9e2ef'); grad.addColorStop(1, '#d9e9f0');
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
  scene.background = new THREE.Color(0xc9e2ef);
  scene.fog = new THREE.Fog(0xc4dcea, 45, 1000); // 400 m 에서 약 0.37 — 먼 봉우리가 가려지지 않고 푸르스름해질 만큼만
  hemi.color.setHex(0xd8ebff); hemi.groundColor.setHex(0x6f7a66); hemi.intensity = 1.6;
  sun.color.setHex(0xfff8ee); sun.intensity = 2.6;
  sky(scene);
  const vista = buildQinglanVista(scene);
  scene.add(cliffWall());
  scene.add(inscription());
  const K = new OwnedKit(801311);
  deck(K, scene);
  plankRoads(K);
  // 바위틈 소나무 (마루 둘레 절벽과 잔도 위아래) — 싱그러운 초여름 초록
  const r = rng(801313);
  const pinesAt = [[-15.5, 7.5], [16.5, 9], [-21, -6], [22, -9], [-34, 13], [30, 16], [-45, -14], [41, 4], [10, 14.5], [-8, 18], [55, 26], [-60, 6]];
  pinesAt.forEach(([x, y], i) => cliffPine(K, x, y, wallZ(x) + 0.3, 1.1 + r() * 0.7, 81260 + i * 7, Math.atan2(1, -wallSlope(x)) + (x > 0 ? -0.4 : 0.4))); // 벽 법선 쪽으로 눕는다
  const mats = {
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
  const CAST = new Set(['rail', 'railIron', 'stone']); // 마루 위 가까운 것만 그림자를 드리운다
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
    sunOffset: { x: 3, y: 16, z: 2.5 }, // 한낮: 해가 거의 머리 위 — 짧고 진한 그림자
    fighterLight: { color: 0xeef3ea, rimColor: 0xcfe4f0, rim: 0.8, level: 0.35 },
    stats: vista.stats,
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
