// 파펜하이머 겉모습 (10/25 샛별 저장소 e3e1f144 에서 들여옴 — 겉모습만 · 물리 · 질량은 weapons.js buildParts)
//  바탕: 클리블랜드 미술관 1916.697 (CC0 사진 — 약 1620 ~ 30 년 솔링겐 · 전체 111.1 cm · 칼날 89.2 cm · 코등이 21.3 cm · 1.34 kg).
//   검푸른 강철과 금장 · 구멍 뚫린 방호판 두 장 · 끝이 휜 코등이 · 철사 감개 · 여섯 갈래 홈 폼멜 · 칼날 밑동 양면 라틴어 명문.
//   작은 치수는 박물관 정면 · 확대 사진에서 어림한 것 — 3D 스캔 복원이 아니다. 조사 기록은 docs/import/pappenheimer_import_2026-10-25.md.
//  우리 쪽 고침 (사장님 10/25 승인 — 감독 안): 폰 · 게임 크기에서 검푸른 코등이가 검은 덩어리로 뭉치고 구멍 난 방호판이 안 보이며,
//   칼날 밑동 검은 띠 때문에 멀리서 칼날이 끊겨 보였다 →
//   ① 방호판 테두리 · 코등이 가로대 · 손등 고리 가장자리에 밝은 강철 테(BRIGHT) — 코등이 윤곽이 읽히게
//   ② 칼날 밑동 띠 = 밝은 강철 바탕에 금 상감 새김(박물관 실물처럼) — 검은 · 검푸른 판이 아니다
//   나머지(구멍 뚫린 방호판 · 철사 감개 · 여섯 갈래 폼멜 · 라틴어 명문)는 전달본 그대로. 숫자 꼴 · 띄어쓰기는 우리 꼴로 옮김.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat, weaponEnv, FINISH } from './weapon_looks.js';

export const PAPPENHEIMER_COLORS = { grip: 0x96938a, hilt: 0x35414a, blade: 0xc5ccce };
// 박물관 실측 길이 · 칼날 · 코등이 폭 + 게임 부품 자리 (칼날 밑동 · 코등이 가운데 · 폼멜 가운데 — 손 기준 m)
export const PAPPENHEIMER_DIM = { length: 1.111, blade: 0.892, cross: 0.213, bladeBase: 0.108, guardY: 0.075, pommelY: -0.0855 };

const V = (a) => new THREE.Vector3(...a);
const kit = swordKit({ blade: { edge: 'double', width: (t) => 1 - 0.64 * t, thick: 0.0042, bevel: 0.0016, tip: 'needle', tipLen: 0.085, overshoot: 0 } });
const BRIGHT = 0xe3e7ea; // ① 밝은 강철 테 (전달본 테 0x89969c — 게임 크기에서 검푸른 몸과 갈리지 않았다)
const mat = {
  steel: () => metalMat(0x35414a, { rough: 0.4 }), // 검푸른 강철 (전달본 그대로)
  edge: () => metalMat(BRIGHT, { rough: 0.22 }), // 밝은 강철 테 · 폼멜 홈 줄
  gold: () => metalMat(0xb49756, { rough: 0.43 }),
  wire: () => metalMat(0xa6a497, { rough: 0.48 }),
};

function add(g, geo, m, pos = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(...pos);
  o.castShadow = true;
  g.add(o);
  return o;
}
function tube(g, p, r, m, n = 28, radial = 4) {
  return add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(V)), n, r, radial, false), m);
}
// 같은 재질 조각을 메쉬 하나로 합친다 (그림자까지 그리는 횟수를 줄임 — 부품마다 재질 서넛)
function compact(g) {
  const bins = new Map();
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    let a = o.geometry.clone();
    a.applyMatrix4(o.matrixWorld);
    a.deleteAttribute('uv');
    if (a.index) {
      const b = a;
      a = a.toNonIndexed();
      b.dispose();
    }
    const arr = bins.get(o.material) || [];
    arr.push(a);
    bins.set(o.material, arr);
  });
  const result = new THREE.Group();
  for (const [m, gs] of bins) {
    add(result, mergeGeometries(gs), m);
    gs.forEach((x) => x.dispose());
  }
  g.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  return result;
}

// 자루: 검푸른 심 + 철사 두 가닥 감개 + 양끝 엮은 금 띠
function grip() {
  const g = new THREE.Group(), dark = mat.steel(), wire = mat.wire(), gold = mat.gold();
  add(g, new THREE.CylinderGeometry(0.0123, 0.0132, 0.096, 12), dark);
  add(g, new THREE.CylinderGeometry(0.01, 0.007, 0.016, 12), dark, [0, -0.054, 0]); // 폼멜로 이어지는 목
  for (const phase of [0, Math.PI]) {
    const p = [];
    for (let i = 0; i <= 384; i++) {
      const t = i / 384, a = t * 24 * Math.PI * 2 + phase, r = 0.0134 - 0.0009 * t;
      p.push([Math.cos(a) * r, -0.046 + t * 0.092, Math.sin(a) * r]);
    }
    tube(g, p, 0.00052, wire, 384, 5);
  }
  // 감개 양끝을 묶는 엮은 띠 (보석 장식이 아니다)
  for (const y of [-0.047, 0.047]) {
    for (const phase of [0, Math.PI]) {
      const p = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2, r = 0.0138;
        p.push([Math.cos(a) * r, y + Math.sin(a * 6 + phase) * 0.0012, Math.sin(a) * r]);
      }
      tube(g, p, 0.00075, gold, 48);
    }
  }
  g.position.y = 0.006; // 자루 콜라이더 가운데가 손보다 6 mm 아래 — 보이는 감개를 손에 맞춤
  return compact(g);
}

// 폼멜: 여섯 갈래 홈이 팬 둥근 끝장식 + 홈마다 밝은 줄 + 금 고리 둘
function pommel() {
  const g = new THREE.Group(), steel = mat.steel(), edge = mat.edge(), gold = mat.gold();
  const profile = [[-0.0255, 0], [-0.023, 0.004], [-0.019, 0.005], [-0.017, 0.012], [-0.01, 0.022], [0, 0.024], [0.01, 0.02], [0.016, 0.01], [0.02, 0.007], [0.025, 0.006]];
  const geo = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), 36);
  const a = geo.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), z = a.getZ(i), theta = Math.atan2(z, x), f = 1 + 0.055 * Math.cos(theta * 6);
    a.setX(i, x * f);
    a.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  add(g, geo, steel);
  for (let k = 0; k < 6; k++) {
    const theta = (k / 6) * Math.PI * 2;
    const p = profile.slice(3, -2).map(([y, r]) => [Math.cos(theta) * r * 1.055, y, Math.sin(theta) * r * 1.055]);
    tube(g, p, 0.00065, edge, 22);
  }
  for (const y of [0.018, 0.023]) add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.0015, 12), gold, [0, y, 0]);
  return compact(g);
}

// 구멍 뚫린 방호판: 실제 구멍(옆벽까지 있는 형상 — 불투명 점 무늬나 알파 텍스처가 아니다) · 바깥으로 조금 볼록
function perforatedPlate() {
  const rx = 0.049, ry = 0.0255, s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
  for (let row = -3; row <= 3; row++) {
    for (let col = -7; col <= 7; col++) {
      const x = col * 0.0064 + (row % 2 ? 0.0032 : 0), y = row * 0.0063;
      if ((x / (rx - 0.0045)) ** 2 + (y / (ry - 0.0045)) ** 2 > 1) continue;
      const h = new THREE.Path(), r = 0.00235;
      h.moveTo(x, y + r);
      h.lineTo(x + r, y);
      h.lineTo(x, y - r);
      h.lineTo(x - r, y);
      h.closePath();
      s.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0014, bevelEnabled: false, curveSegments: 36 });
  const a = geo.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), y = a.getY(i);
    a.setZ(i, a.getZ(i) + 0.006 * ((x / rx) ** 2 + (y / ry) ** 2));
  }
  geo.computeVertexNormals();
  geo.userData.holes = s.holes.length;
  return geo;
}

// 코등이 전체: 가로대 · 손등 고리 · 방호판 두 장과 받침 고리 (부품 2 — 코등이 가운데가 원점)
function guard() {
  const g = new THREE.Group(), steel = mat.steel(), edge = mat.edge(), gold = mat.gold();
  const offset = (p) => [p[0], p[1] - PAPPENHEIMER_DIM.guardY, p[2]];
  const line = (p, r, m, n) => tube(g, p.map(offset), r, m, n);
  // ① 밝은 테 줄: 둥근 막대의 앞 · 뒤 면(±z)에 가는 밝은 줄을 얹어 — 어느 쪽에서 보아도 막대 윤곽이 밝게 읽힌다
  const brightFaces = (p, rBar, n) => [-1, 1].map((s) => line(p.map(([x, y, z]) => [x, y, z + s * rBar * 0.7]), 0.0013, edge, n));
  // 가로대: 양끝이 ±10.65 cm 에서 끝나고 끝이 살짝 말림 — 곡선 보간으로 넘친 폭을 실측 21.3 cm 에 맞춤(테 줄도 같은 맞춤)
  const crossPts = [[-0.103, 0.039, 0], [-0.1035, 0.049, 0], [-0.075, 0.052, 0], [0, 0.05, 0], [0.07, 0.049, 0], [0.1035, 0.053, 0], [0.103, 0.064, 0]];
  const cross = line(crossPts, 0.003, steel, 40);
  cross.geometry.computeBoundingBox();
  const box = cross.geometry.boundingBox, cx = (box.max.x + box.min.x) / 2, sx = PAPPENHEIMER_DIM.cross / (box.max.x - box.min.x);
  for (const o of [cross, ...brightFaces(crossPts, 0.003, 40)]) o.geometry.translate(-cx, 0, 0).scale(sx, 1, 1);
  for (const sign of [-1, 1]) add(g, new THREE.SphereGeometry(0.003, 8, 6), gold, offset([sign * 0.103, 0.0515 + sign * 0.0125, 0]));
  // 손등 고리 (폼멜 쪽에서 가로대로) + 밝은 테 줄 (전달본의 짧은 테 줄 하나 — 막대 속에 묻혀 안 보였다 — 를 고리 전체 길이로)
  const bowPts = [[0, -0.07, 0], [-0.048, -0.059, 0], [-0.073, -0.025, 0], [-0.072, 0.018, 0], [-0.045, 0.044, 0], [0, 0.05, 0]];
  line(bowPts, 0.0033, steel, 38);
  brightFaces(bowPts, 0.0033, 38);
  for (const side of [-1, 1]) {
    const panel = add(g, perforatedPlate(), steel, [0, 0.007, side * 0.03]);
    if (side < 0) panel.rotation.y = Math.PI;
    panel.userData.piercedPlate = true;
    // 방호판 테두리: 밝은 강철 테 (전달본 반지름 2.3 mm · 회색 → 3.2 mm · 밝게 — 폰 내 인물 자리에서 1 화소 남짓)
    const rim = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * 2 * Math.PI;
      rim.push([Math.cos(t) * 0.051, 0.082 + Math.sin(t) * 0.027, side * 0.0375]);
    }
    line(rim, 0.0032, edge, 64);
    line([[-0.051, 0.082, side * 0.036], [-0.055, 0.055, side * 0.022], [-0.036, 0.044, side * 0.01], [0, 0.05, 0], [0.037, 0.044, side * 0.01], [0.055, 0.055, side * 0.022], [0.051, 0.082, side * 0.036]], 0.0028, steel, 40);
    // 방호판을 가로대 · 칼날 밑동에 잇는 받침 고리
    line([[-0.049, 0.086, side * 0.037], [-0.027, 0.107, side * 0.02], [0, 0.108, 0], [0.028, 0.107, side * 0.02], [0.049, 0.086, side * 0.037]], 0.0025, steel, 32);
    line([[-0.032, 0.052, side * 0.009], [-0.025, 0.071, side * 0.014], [0, 0.077, side * 0.018], [0.025, 0.071, side * 0.014], [0.032, 0.052, side * 0.009]], 0.0021, steel, 32);
  }
  add(g, new THREE.CylinderGeometry(0.011, 0.013, 0.035, 10), steel, [0, -0.01, 0]);
  for (const y of [0.043, 0.052]) add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.0015, 12), gold, offset([0, y, 0]));
  // 금장은 아래 칼날 명문 둘레에 모은다 (코등이는 절제)
  return compact(g);
}

// ② 칼날 밑동 새김 띠 텍스처: 밝은 강철 바탕 + 금 상감(테두리 두 줄 · 덩굴 줄 · 명문 세 줄 · 아래 격자 칸 — 가는 금 줄) — 멀리서는 금빛이 살짝 도는 밝은 칼몸으로 읽힌다
//  명문은 박물관 전사 그대로(지어낸 룬 글자로 바꾸지 않음). 노드 시험(문서 없음)에서는 띠를 그리지 않는다
let inscriptionTexture;
function inscription() {
  if (typeof document === 'undefined') return null;
  if (inscriptionTexture) return inscriptionTexture;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 2048;
  const x = c.getContext('2d');
  const STEEL = '#cdd3d6', GOLD = '#d2a84e';
  x.fillStyle = STEEL; // 새긴 바탕 = 밝은 강철 (칼몸 0xc5ccce 보다 조금 밝게 — 게임 크기에서 띠가 칼몸처럼 밝게 이어지게 · 금은 가는 줄로만)
  x.fillRect(0, 0, 256, 2048);
  x.strokeStyle = GOLD;
  x.lineWidth = 7;
  x.strokeRect(6, 6, 244, 2036);
  x.lineWidth = 3;
  x.strokeRect(22, 22, 212, 2004);
  // 양 가장자리 덩굴 줄 (금)
  for (let y = 40; y < 1560; y += 40) {
    for (const side of [0, 1]) {
      const a = side ? 232 : 24, d = side ? -12 : 12;
      x.beginPath();
      x.moveTo(a, y);
      x.bezierCurveTo(a + d, y + 8, a + d, y + 28, a, y + 40);
      x.stroke();
    }
  }
  // 명문 세 줄 (칼날 축을 따라 세로로 — 칼끝 쪽이 위)
  x.fillStyle = GOLD;
  x.font = 'bold 52px serif';
  x.textAlign = 'center';
  const lines = ['NEC TEMPARE NEC TIMIDE', 'INTER ARMA SILENT LEGE', 'VERITATEM DILIGE ET PUGNA PRO PATRIA'];
  for (let k = 0; k < 3; k++) {
    x.save();
    x.translate(56 + k * 72, 1520);
    x.rotate(-Math.PI / 2);
    x.fillText(lines[k], 740, 0, 1450);
    x.restore();
  }
  // 아래(코등이 쪽) 금 격자 칸 — 박물관 실물 밑동의 격자 장식을 가는 금 줄로 간략히
  x.lineWidth = 4;
  x.strokeRect(34, 1584, 188, 432);
  for (let y = 1584 + 48; y < 2016; y += 48) {
    x.beginPath();
    x.moveTo(34, y);
    x.lineTo(222, y);
    x.stroke();
  }
  for (const xx of [97, 159]) {
    x.beginPath();
    x.moveTo(xx, 1584);
    x.lineTo(xx, 2016);
    x.stroke();
  }
  for (let y = 1584; y < 2016; y += 48) {
    for (const [xa, xb] of [[34, 97], [97, 159], [159, 222]]) {
      const xm = (xa + xb) / 2, ym = y + 24;
      x.beginPath();
      x.moveTo(xm, ym - 14);
      x.lineTo(xm + 14, ym);
      x.lineTo(xm, ym + 14);
      x.lineTo(xm - 14, ym);
      x.closePath();
      x.fill();
    }
  }
  x.lineWidth = 4;
  for (const y of [85, 1550]) {
    x.beginPath();
    x.moveTo(128, y - 30);
    x.lineTo(162, y);
    x.lineTo(128, y + 30);
    x.lineTo(94, y);
    x.closePath();
    x.stroke();
  }
  inscriptionTexture = new THREE.CanvasTexture(c);
  inscriptionTexture.colorSpace = THREE.SRGBColorSpace;
  inscriptionTexture.anisotropy = 4;
  return inscriptionTexture;
}

// 칼날: 바탕 칼날(swordKit — 피 묻는 뿌리 Mesh) + 양면 새김 띠 + 띠 가장자리 금 줄
function blade(args) {
  const m = kit(...args), g = new THREE.Group(), half = args[2][2], gold = mat.gold(), base = -half;
  const F = FINISH.rare;
  for (const side of [-1, 1]) {
    const tex = inscription();
    if (tex) {
      // 칼몸과 같은 마감(레어 등급 강철 — 거칠기 · 금속성 · 환경 반사). 전달본은 환경 반사 없는 반금속 판이라 검게 보였다
      const band = new THREE.MeshStandardMaterial({ map: tex, roughness: F.blade + 0.08, metalness: F.metal, envMap: weaponEnv(), envMapIntensity: F.env });
      const o = add(g, new THREE.PlaneGeometry(0.02, 0.216), band, [0, base + 0.117, side * 0.0044]);
      if (side < 0) o.rotation.y = Math.PI;
    }
    for (const x of [-0.0108, 0.0108]) tube(g, [[x, base + 0.014, side * 0.0046], [x * 0.96, base + 0.119, side * 0.0046], [x * 0.9, base + 0.224, side * 0.0046]], 0.00045, gold, 16);
  }
  m.add(g);
  return m; // 뿌리 칼날 Mesh 를 그대로 돌려준다 (피 묻음 · 부러짐이 이 메쉬를 쓴다)
}

/** fighter.js partMesh: 자루(0) · 폼멜(1) · 코등이(2) · 칼날(3). 부품 4(숨은 가로대 콜라이더)는 그리지 않음(색 null) */
export function pappenheimerPartMesh(...args) {
  const [i, isBlade] = args;
  if (isBlade) return blade(args);
  if (i === 0) return grip();
  if (i === 1) return pommel();
  if (i === 2) return guard();
  return undefined;
}
