// ─────────────────────────────────────────────────────────────
//  생사전 전용 맵의 무대 그림 (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — 설계 docs/design/saengsa_3v3_2026-11-21.md §3-1 · §3-3 ·
//   기록 docs/strike/saengsa_maps_2026-11-21.md). 낮 하나. 생사전 판에서만 짓는다 (여정 차례 STAGE_ORDER 에 없음).
//  모든 자리 · 크기는 무대 표(src/saengsa_maps.js SAENGSA_MAPS → mapGeo)에서 읽는다 — 충돌체 · AI 길 · 카메라 테두리와 같은 수.
//   ① 두 다리 개울: 늦은 아침 강가 풀밭 · 돌 둔덕으로 두른 판 · 가운데를 흐르는 개울(돌 축대) · 돌 다리 둘(낮은 난간) · 둘레 버드나무 · 갈대 · 먼 언덕
//   ② 성벽 안뜰 (2단계 — buildSaengsaCourt)
//  폰 기준(3:3 은 1:1 의 3.3 배): 재질마다 한 메쉬로 합침(Kit) · 그림자는 다리 난간 · 둔덕 돌만 드리움(해 그림자 상자는 지금처럼 내 몸 둘레 ±4 m) · 움직이는 것은 물결 질감 하나
//  물리와는 상관없다 (막이는 main.js resetWorld → 지도 꼴 walls — 같은 표)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { rng, Kit, box, cyl, canvasTex } from './stage_kit.js';
import { SAENGSA_MAP_BY_ID, mapGeo } from './saengsa_maps.js';

const C = {
  grass: 0x76904a, grassDry: 0xa3a061, trodden: 0x8d9257, earth: 0x7a6546,
  stone: 0x9a958a, stoneDark: 0x6d6a62, moss: 0x5f6e3e,
  bed: 0x3d4a3c, water: 0x4f7f86,
  bark: 0x4a3c2e, leaf: 0x5d7a35, willow: 0x7f9a4a, reed: 0x8c8a4e,
  hill: 0x6f8455, hillFar: 0x8fa3a0,
};

function skyDome(scene, top, mid, low) {
  const tex = canvasTex(4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top); grad.addColorStop(0.42, mid); grad.addColorStop(0.52, low); grad.addColorStop(1, low);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false }));
  mesh.name = 'sg-sky';
  scene.add(mesh);
}

/** 땅 꼴 (평평한 판 · 둔덕 밖 몇 m 부터 낮은 기복) */
const lumpY = (x, z, G) => {
  const out = Math.max(Math.abs(x) - G.half.x - 5, Math.abs(z) - G.half.z - 5, 0);
  if (out <= 0) return 0;
  const k = Math.min(1, out / 25);
  return k * (0.6 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09) + 0.4 * Math.sin(z * 0.17 + x * 0.05) + 0.9 * k);
};

/** 풀밭: 개울 자리를 비운 두 장 (꼭짓점 색 — 판 안 밟힌 풀 · 둔덕 밖 풀 · 물가 흙) */
function meadow(scene, G, sw, r) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  const grain = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 175 + Math.floor(r() * 80); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 3); }
  });
  grain.repeat.set(24, 24);
  mat.map = grain;
  const cIn = new THREE.Color(C.trodden), cOut = new THREE.Color(C.grass), cDry = new THREE.Color(C.grassDry), cEarth = new THREE.Color(C.earth), tmp = new THREE.Color();
  for (const s of [-1, 1]) {
    const W = 90, D = 150, x0 = s * sw, xc = x0 + (s * W) / 2;
    const geo = new THREE.PlaneGeometry(W, D, 90, 100);
    geo.rotateX(-Math.PI / 2);
    geo.translate(xc, 0, 0);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (Math.abs(x - x0) < 0.01) p.setX(i, x0); // 물가 선
      p.setY(i, lumpY(x, z, G));
      const inside = Math.abs(x) < G.half.x + 0.6 && Math.abs(z) < G.half.z + 0.6;
      const n = Math.sin(x * 1.7 + z * 0.6) * 0.5 + Math.sin(z * 2.3 - x * 0.4) * 0.5;
      tmp.copy(inside ? cIn : cOut).lerp(cDry, 0.25 + 0.2 * n);
      const bank = Math.max(0, 1 - (Math.abs(x) - sw) / 0.9);
      if (bank > 0) tmp.lerp(cEarth, bank * 0.7);
      // 다리 머리 밟힌 흙
      for (const L of G.lanes) for (const e of L.ends) { const d = Math.hypot(x - e.x, z - e.z); if (d < 2.4) tmp.lerp(cEarth, (1 - d / 2.4) * 0.45); }
      const k = 0.92 + (Math.sin(x * 7.1) * Math.cos(z * 6.3)) * 0.05;
      col[i * 3] = tmp.r * k; col[i * 3 + 1] = tmp.g * k; col[i * 3 + 2] = tmp.b * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.name = 'sg-meadow';
    scene.add(m);
  }
}

/** 흐르는 물: 물결 무늬 질감을 흐름 쪽으로 밀어 움직임 (update) */
function stream(scene, sw, r) {
  const tex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#7a9fa3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h, x = r() * w, l = 6 + r() * 26, a = 0.08 + r() * 0.18;
      g.fillStyle = r() < 0.6 ? `rgba(235,245,240,${a})` : `rgba(30,60,64,${a})`;
      g.fillRect(x, y, 1 + r() * 2, l);
    }
  });
  tex.repeat.set(1, 18);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(sw * 2 + 0.2, 150).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.water, map: tex, roughness: 0.22, metalness: 0.05 }));
  water.position.y = -0.55;
  water.name = 'sg-water';
  water.receiveShadow = true;
  scene.add(water);
  return tex;
}

/** 버드나무 · 나무 한 그루 (줄기 + 잎 덩이) */
function tree(K, r, x, z, h, willow = false) {
  const lean = (r() - 0.5) * 0.15;
  K.put('bark', cyl(0.12 * h * 0.2 + 0.08, 0.2 * h * 0.2 + 0.12, h * 0.55, 6), C.bark, [x, h * 0.27, z], [lean, r() * 6, lean * 0.5], 1, { vary: 0.2 });
  const n = willow ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * h * 0.18, s = h * (willow ? 0.2 : 0.24) * (0.8 + r() * 0.4);
    const y = h * (willow ? 0.62 : 0.68) + r() * h * 0.18;
    K.put('leaf', new THREE.IcosahedronGeometry(1, 0), willow ? C.willow : C.leaf, [x + Math.cos(a) * d, y, z + Math.sin(a) * d], [r(), r() * 6, r()], [s * 1.15, s * (willow ? 1.35 : 0.9), s * 1.15], { vary: 0.25, noise: 0.1, rough: 0.05 * s });
  }
}

/**
 * ① 두 다리 개울. lights = main.js { hemi, sun }. 돌려줌 { update, excite, sunOffset, fighterLight }
 */
export function buildSaengsaBridges(scene, { hemi, sun } = {}) {
  const m = SAENGSA_MAP_BY_ID.bridges, G = mapGeo(m);
  const r = rng(52117);
  const K = new Kit(52119);
  const sw = m.stream / 2, hx = G.half.x, hz = G.half.z;
  scene.background = new THREE.Color(0xb7d0dc);
  scene.fog = new THREE.Fog(0xb9cfd6, 70, 380);
  if (hemi) { hemi.color.setHex(0xdcebf5); hemi.groundColor.setHex(0x6b6a4c); hemi.intensity = 1.45; }
  if (sun) { sun.color.setHex(0xfff1dc); sun.intensity = 2.3; }
  skyDome(scene, '#5f95c4', '#a9c9dc', '#cfdcd8');
  meadow(scene, G, sw, r);
  const flow = stream(scene, sw, r);

  // ── 개울 바닥 · 돌 축대 (물가 선 = 막이 안쪽 면 · 판 밖까지 흐름) ──
  K.put('bed', box(sw * 2 + 0.4, 0.1, 150), C.bed, [0, -1.05, 0]);
  for (const s of [-1, 1]) {
    for (let z = -74; z < 74; z += 1.1) {
      const len = 1.05 + r() * 0.05, h = 0.95 + r() * 0.08;
      K.put(Math.abs(z) < hz + 3 ? 'stone' : 'rock', box(0.42, h, len), r() < 0.2 ? C.stoneDark : C.stone, [s * (sw + 0.15), -0.07 - h / 2, z + len / 2], [0, (r() - 0.5) * 0.03, 0], 1, { rough: 0.04, vary: 0.18, noise: 0.08 });
    }
    // 축대 머리 돌 (땅과 같은 높이 — 물가 선)
    for (let z = -74; z < 74; z += 0.9) K.put(Math.abs(z) < hz + 3 ? 'stone' : 'rock', box(0.5, 0.08, 0.86), C.stone, [s * (sw + 0.2), -0.01, z + 0.45], [0, (r() - 0.5) * 0.05, 0], 1, { rough: 0.03, vary: 0.15 });
  }
  // 판 끝 개울 가로 큰 돌 (둔덕이 개울을 건너는 자리 — 막이와 같은 선)
  for (const s of [-1, 1]) for (let x = -sw + 0.3; x < sw; x += 0.75) K.put('stone', new THREE.IcosahedronGeometry(0.45, 0), C.stoneDark, [x + (r() - 0.5) * 0.15, -0.45, s * (hz + 0.25)], [r(), r() * 6, r()], [1.0, 0.85, 0.9], { rough: 0.08, vary: 0.2 });

  // ── 돌 다리 둘 (자리 · 너비 · 길이 · 난간 = 무대 표) ──
  for (const L of G.lanes) {
    const zc = (L.z0 + L.z1) / 2, w = L.z1 - L.z0, len = L.x1 - L.x0;
    K.put('deck', box(len, 0.28, w + 0.06), C.stone, [0, -0.13, zc], [0, 0, 0], 1, { uv: 'box', uvScale: 0.6, vary: 0.08, noise: 0.05 });
    // 디딤 판석 줄 (밟는 면)
    for (let x = L.x0 + 0.2; x < L.x1 - 0.1; x += 0.55) K.put('deck', box(0.5, 0.03, w - 0.08), r() < 0.3 ? C.stoneDark : C.stone, [x + 0.25, 0.005, zc], [0, 0, 0], 1, { vary: 0.14, noise: 0.06 });
    // 아치 (물 위 옆에서 보이는 둥근 밑)
    for (const s of [-1, 1]) {
      const arch = new THREE.TorusGeometry(sw * 0.92, 0.2, 4, 12, Math.PI);
      K.put('stone', arch, C.stoneDark, [0, -1.0, zc + s * (w / 2 - 0.12)], [0, 0, 0], [1, 0.4, 1], { vary: 0.1 });
    }
    // 난간: 보이는 높이 rail.show (막이는 rail.block — 보이지 않는 벽) · 끝 기둥
    const rh = m.rail.show;
    for (const rail of G.rails.filter((q) => q.z1 > L.z0 - 0.5 && q.z0 < L.z1 + 0.5)) {
      const z = (rail.z0 + rail.z1) / 2;
      K.put('rail', box(len, rh - 0.08, 0.22), C.stone, [0, (rh - 0.08) / 2, z], [0, 0, 0], 1, { rough: 0.02, uv: 'box', uvScale: 0.6, vary: 0.1 });
      K.put('rail', box(len + 0.06, 0.08, 0.3), C.stoneDark, [0, rh - 0.04, z], [0, 0, 0], 1, { vary: 0.08 });
      for (const ex of [L.x0, L.x1]) K.put('rail', box(0.34, rh + 0.16, 0.34), C.stone, [ex, (rh + 0.16) / 2, z], [0, 0, 0], 1, { rough: 0.03, vary: 0.12 });
    }
  }

  // ── 가장자리 낮은 돌 둔덕 (보이는 높이 edge.show — 막이 1.2 m 는 보이지 않는 벽 · 안쪽 면 = 판 크기) ──
  const sh = m.edge.show;
  const mound = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.8)), ang = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const s = 0.36 + r() * 0.16;
      K.put('stone', new THREE.IcosahedronGeometry(1, 0), r() < 0.3 ? C.stoneDark : C.stone, [x, sh * 0.42, z], [r(), -ang + r() * 0.3, r() * 0.3], [s * 1.35, sh * 0.62, s], { rough: 0.06, vary: 0.2, noise: 0.08 });
    }
    // 흙 둑 (돌 뒤)
    K.put('earth', box(L, sh * 0.7, 1.0), C.moss, [(x0 + x1) / 2 + Math.cos(ang + Math.PI / 2) * 0, sh * 0.2, (z0 + z1) / 2], [0, -ang, 0], [1, 1, 1], { rough: 0.12, vary: 0.1 });
  };
  const o = 0.68; // 둔덕 돌 가운데 = 안쪽 면에서 바깥으로 (돌 안쪽 끝이 막이 면 밖)
  for (const s of [-1, 1]) {
    mound(s * (hx + o), -hz - o, s * (hx + o), hz + o); // 서 · 동
    mound(-hx - o, s * (hz + o), -sw - 0.4, s * (hz + o)); // 북 · 남 (개울 자리는 비움 — 큰 돌이 막음)
    mound(sw + 0.4, s * (hz + o), hx + o, s * (hz + o));
  }

  // ── 둘레: 버드나무 (물가) · 나무 · 갈대 · 바위 · 먼 언덕 ──
  for (const s of [-1, 1]) for (const z of [-hz - 6, hz + 7, -hz - 15, hz + 16]) tree(K, r, s * (sw + 2.2 + r() * 2), z + (r() - 0.5) * 3, 6.5 + r() * 2, true);
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 0.5 + r() * 0.5;
    const x = Math.cos(a) * (hx + 7 + d * 30), z = Math.sin(a) * (hz + 7 + d * 30);
    if (Math.abs(x) < sw + 3) continue;
    tree(K, r, x, z, 5 + r() * 4, false);
  }
  for (let i = 0; i < 70; i++) {
    const s = r() < 0.5 ? -1 : 1, z = (r() - 0.5) * 140;
    if (Math.abs(z) < hz + 1.5 && r() < 0.6) continue; // 판 안 물가는 드물게
    const x = s * (sw + 0.35 + r() * 0.6);
    for (let k = 0; k < 5; k++) K.put('reed', cyl(0.004, 0.02, 0.9 + r() * 0.7, 3, true), C.reed, [x + (r() - 0.5) * 0.4, 0.4, z + (r() - 0.5) * 0.6], [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3], 1, { vary: 0.25 });
  }
  for (let i = 0; i < 24; i++) {
    const a = r() * Math.PI * 2, x = Math.cos(a) * (hx + 4 + r() * 20), z = Math.sin(a) * (hz + 4 + r() * 20);
    if (Math.abs(x) < sw + 2) continue;
    K.put('rock', new THREE.IcosahedronGeometry(1, 1), C.stoneDark, [x, lumpY(x, z, G) - 0.1, z], [r(), r() * 6, r()], [0.4 + r() * 0.9, 0.3 + r() * 0.5, 0.4 + r() * 0.8], { rough: 0.15, vary: 0.2 });
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2, d = 190 + r() * 90;
    K.put('hill', new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), r() < 0.5 ? C.hill : C.hillFar, [Math.cos(a) * d, -3, Math.sin(a) * d], [0, r() * 6, 0], [55 + r() * 60, 10 + r() * 18, 40 + r() * 45], { vary: 0.12, noise: 0.03 });
  }

  // ── 합치기 (재질마다 한 메쉬) ──
  const mats = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }),
    deck: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    earth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    bed: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    reed: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    hill: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  };
  const cast = new Set(['rail', 'stone', 'deck']); // 그림자는 판 안 · 둘레 돌만 (해 그림자 상자는 내 몸 둘레 ±4 m — 판 밖 나무 · 바위 · 판 밖 축대는 그 상자에 들 일이 없어 드리우지 않음)
  for (const [name, mat] of Object.entries(mats)) {
    const mesh = K.mesh(name, mat, { cast: cast.has(name), receive: name !== 'hill' && name !== 'reed' });
    if (!mesh) { mat.dispose(); continue; }
    mesh.name = 'sg-' + name;
    scene.add(mesh);
    for (const g of K.bins[name]) g.dispose();
  }
  let t = 0;
  return {
    sunOffset: { x: 5.5, y: 13, z: 3.5 },
    fighterLight: { color: 0xfff2e2, rimColor: 0xd2e3ee, rim: 0.8, level: 0.35 },
    excite() {},
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      t += Math.min(dt, 0.1);
      flow.offset.y = -(t * 0.045) % 1; // 물결이 +z 쪽으로 흐름
    },
  };
}

const CC = {
  sand: 0xb59a74, sandDark: 0x9c8260, flag: 0xa89474,
  wall: 0xa3927a, wallDark: 0x7d6f5d, cap: 0x8e7f6a, roof: 0x6b4a36, timber: 0x5a4130,
};

/**
 * ② 성벽 안뜰. 다져진 흙 안뜰 · 바깥 높은 성벽 · 가운데 성벽(문루 둘 — 지붕 있는 문길). 자리 · 높이 = 무대 표.
 *  가운데 성벽 · 문루는 카메라를 가리면 비친다(stage.see — main.js updateCamera 가 부름 · 2단계)
 */
export function buildSaengsaCourt(scene, { hemi, sun } = {}) {
  const m = SAENGSA_MAP_BY_ID.court, G = mapGeo(m);
  const r = rng(61031);
  const K = new Kit(61033);
  const hx = G.half.x, hz = G.half.z, eh = m.edge.show;
  scene.background = new THREE.Color(0xc9d6dc);
  scene.fog = new THREE.Fog(0xc6d2d6, 60, 360);
  if (hemi) { hemi.color.setHex(0xe6eef2); hemi.groundColor.setHex(0x7a6a54); hemi.intensity = 1.5; }
  if (sun) { sun.color.setHex(0xffeed8); sun.intensity = 2.25; }
  skyDome(scene, '#6b98c0', '#b4ccd8', '#d6dcd6');

  // ── 바닥: 다져진 흙 (판석 길 — 두 편 시작에서 문 둘로) ──
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  const geo = new THREE.PlaneGeometry(150, 130, 75, 65).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), c0 = new THREE.Color(CC.sand), c1 = new THREE.Color(CC.sandDark), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), n = Math.sin(x * 1.3 + z * 0.7) * 0.5 + Math.sin(z * 2.1 - x * 0.5) * 0.5;
    tmp.copy(c0).lerp(c1, 0.3 + 0.25 * n);
    const k = 0.93 + Math.sin(x * 6.1) * Math.cos(z * 5.7) * 0.05;
    col[i * 3] = tmp.r * k; col[i * 3 + 1] = tmp.g * k; col[i * 3 + 2] = tmp.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const floor = new THREE.Mesh(geo, floorMat);
  floor.receiveShadow = true;
  floor.name = 'sg-court-floor';
  scene.add(floor);
  // 문 앞뒤 판석 마당 (문길 안 · 양쪽 머리 앞 3 m) — 밟아 닳은 돌
  for (const L of G.lanes) {
    for (let x = -(L.x1 + 3); x < L.x1 + 3; x += 0.6) for (let z = L.z0 - 0.4; z < L.z1 + 0.4; z += 0.6) {
      if (Math.abs(x + 0.3) > L.x1 + 1.5 + r() * 1.5) continue;
      K.put('flag', box(0.57, 0.04, 0.57), r() < 0.3 ? CC.sandDark : CC.flag, [x + 0.3, 0.0, z + 0.3], [0, (r() - 0.5) * 0.06, 0], 1, { vary: 0.14, noise: 0.05 });
    }
  }
  // ── 성벽 (막이 상자 = 무대 표 colliders 와 같은 상자에 돌 쌓임 그림) ──
  const wallBox = (b, h, bin) => {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    K.put(bin, box(w, h, d), CC.wall, [(b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2], [0, 0, 0], 1, { uv: 'box', uvScale: 0.5, vary: 0.06, noise: 0.07 });
    K.put(bin, box(w + 0.12, 0.18, d + 0.12), CC.cap, [(b.x0 + b.x1) / 2, h + 0.09, (b.z0 + b.z1) / 2], [0, 0, 0], 1, { vary: 0.05 });
    K.put(bin, box(w + 0.06, 0.35, d + 0.06), CC.wallDark, [(b.x0 + b.x1) / 2, 0.17, (b.z0 + b.z1) / 2], [0, 0, 0], 1, { vary: 0.06 });
    for (let y = 0.9; y < h - 0.3; y += 0.9) K.put(bin, box(w + 0.03, 0.06, d + 0.03), CC.wallDark, [(b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2], [0, 0, 0], 1, { vary: 0.05 }); // 돌 켜 줄
  };
  // 바깥 성벽 (두께 1 m · 높이 edge.show) + 위 성가퀴
  const et = 1.0;
  const outer = [
    { x0: -hx - et, x1: -hx, z0: -hz - et, z1: hz + et }, { x0: hx, x1: hx + et, z0: -hz - et, z1: hz + et },
    { x0: -hx, x1: hx, z0: -hz - et, z1: -hz }, { x0: -hx, x1: hx, z0: hz, z1: hz + et },
  ];
  for (const b of outer) {
    wallBox(b, eh, 'outer');
    const along = b.x1 - b.x0 > b.z1 - b.z0, L = along ? b.x1 - b.x0 : b.z1 - b.z0;
    for (let t = 0.4; t < L - 0.3; t += 1.1) {
      const x = along ? b.x0 + t : (b.x0 + b.x1) / 2, z = along ? (b.z0 + b.z1) / 2 : b.z0 + t;
      K.put('outer', box(along ? 0.55 : 0.9, 0.55, along ? 0.9 : 0.55), CC.wall, [x, eh + 0.45, z], [0, 0, 0], 1, { vary: 0.1 });
    }
  }
  // 가운데 성벽 · 문루 탑 (보이는 꼴 = 막이)
  const inner = [];
  for (const b of G.blocks) {
    const h = b.kind === 'tower' ? m.gate.height : m.wall.height;
    wallBox(b, h, 'inner');
    inner.push({ ...b, y0: 0, y1: h + 0.2 });
  }
  // 문루 지붕 (문길 위 — 지붕 밑 gate.roof · 위 gate.height) · 기와 덮개 · 들보
  for (const R of G.roofs) {
    const w = R.x1 - R.x0, d = R.z1 - R.z0;
    K.put('inner', box(w, R.y1 - R.y0, d), CC.wallDark, [(R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2, (R.z0 + R.z1) / 2], [0, 0, 0], 1, { uv: 'box', uvScale: 0.5, vary: 0.06 });
    K.put('roof', box(w + 0.7, 0.22, d + 2.9), CC.roof, [(R.x0 + R.x1) / 2, R.y1 + 0.2, (R.z0 + R.z1) / 2], [0, 0, 0], 1, { vary: 0.1, noise: 0.08 });
    for (const s of [-1, 1]) K.put('timber', box(0.22, 0.26, d + 0.3), CC.timber, [s * (w / 2 - 0.05), R.y0 + 0.1, (R.z0 + R.z1) / 2], [0, 0, 0], 1, { vary: 0.1 });
    inner.push({ ...R, y1: R.y1 + 0.35 });
  }
  // ── 둘레: 성벽 밖 먼 언덕 · 지붕 몇 (바깥은 높은 성벽에 가려 거의 안 보임) ──
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.2, d = 150 + r() * 80;
    K.put('hill', new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), r() < 0.5 ? C.hill : C.hillFar, [Math.cos(a) * d, -2, Math.sin(a) * d], [0, r() * 6, 0], [40 + r() * 50, 16 + r() * 26, 30 + r() * 40], { vary: 0.15 });
  }
  // 안뜰 소품: 성벽 밑 나무 상자 · 물동이 (막이 밖 — 성벽에 붙여 둠)
  for (let i = 0; i < 10; i++) {
    const s = r() < 0.5 ? -1 : 1, x = s * (3 + r() * (hx - 6)), z = (r() < 0.5 ? -1 : 1) * (hz - 0.45);
    K.put('timber', box(0.6 + r() * 0.3, 0.5 + r() * 0.3, 0.55), CC.timber, [x, 0.3, z], [0, r() * 0.3, 0], 1, { vary: 0.2 });
  }

  const mats = {
    flag: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    outer: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }),
    inner: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, transparent: true, opacity: 1 }),
    roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, transparent: true, opacity: 1 }),
    timber: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    hill: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  };
  const meshes = {};
  for (const [name, mat] of Object.entries(mats)) {
    const mesh = K.mesh(name, mat, { cast: name === 'inner' || name === 'roof' || name === 'timber', receive: name !== 'hill' });
    if (!mesh) { mat.dispose(); continue; }
    mesh.name = 'sg-court-' + name;
    scene.add(mesh);
    meshes[name] = mesh;
    for (const g of K.bins[name]) g.dispose();
  }
  return {
    sunOffset: { x: 4.5, y: 13, z: 5 },
    fighterLight: { color: 0xfff1e0, rimColor: 0xd6e0e6, rim: 0.8, level: 0.35 },
    seeThrough: { meshes: [meshes.inner, meshes.roof].filter(Boolean), boxes: inner },
    excite() {},
    update() {},
  };
}
