// ─────────────────────────────────────────────────────────────
//  아이템 · 재화 그림 (사장님 10/16 14:4x ③ · 15:3x ⑦⑧⑨ · 16:1x · 17:3x · 17:4x — docs/import/item_art_2026-10-16.md · 스타일 규칙 '겉은 픽셀, 속은 매끈' docs/design_language.md §5)
//  무기 카드 그림(weapon_thumbs_page.js)과 같은 집안: 같은 빛 넷 · 같은 금속 재질(weapon_looks.js metalMat — 무기 반사 환경) · 정사영 카메라 ·
//  두 배로 그려 곱게 줄인 투명 배경 webp. 모형은 여기서 간단히 짓는다(게임 모형이 없는 물건이라).
//   · 스킬북 25 장 books/<유파>_<급>.webp — 256 × 336 (책 칸 .book-thumb 32 × 42 와 같은 비 — CSS 가 칸을 꽉 채워 늘이므로 비가 같아야 안 찌그러진다)
//     사장님 16:1x '유파별로 … 급수 별로 종이나 표지 색, 끈 색, 볼륨 등의 디테일을 달리 … 사실성' · 17:3x '전부 책이라 어색하다. 말린 양피지나 서류더미처럼
//     여러 가지 형태 … 로마자는 빼도 돼. 볼륨과 색깔만으로도 충분' · 17:4x '일본의 가짜 글짜는 좋은데? … 실제 오륜서를 모티브로 … 동방 죽간 좋다':
//      유파마다 실제 옛 물건을 본뜬 문서 꼴 하나 (윤곽 다섯이 다르다)
//       독일 = 가죽 펜히트부흐(나무 판자 · 놋쇠 귀 · 걸쇠 — 앞 작업 그대로, 숫자만 뺌) · 이탈리아 = 『Fior di Battaglia』 처럼 그림 있는 낱장 묶음(리본으로 묶음) ·
//       이베리아 = 말린 양피지(검술 사범 시험 증서 carta de examen — 리본 · 밀랍 인장) · 일본 = 『五輪書』 두루마리(地 · 水 · 火 · 風 · 空 — 나무 축 · 끈 · 제목 쪽지) ·
//       동방 = 銀雀山 한나라 『孫子兵法』 죽간(끈으로 엮은 대쪽 · 반쯤 펼침 · 먹 글자)
//      급(I~V) = 볼륨 + 색만 (로마 숫자 없음): 볼륨 = 두께 · 쌓인 높이 · 두루마리 굵기 · 길이 · 대쪽 수가 급마다 늘어남 /
//       색 = 등급 색(index.html :root --tier-* · 언커먼은 entrance_type.css --tier-uncommon)을 그 유파의 끈에 — 가름끈 · 리본 · 인장 리본 · 두루마리 끈 · 엮은 끈 /
//       높은 급일수록 종이 · 겉감이 짙고 귀해짐(바랜 종이 · 금박 · 쇠붙이 · 옻칠 · 상아 · 금 축)
//      유파마다 다섯 장을 같은 틀(같은 배율)로 찍는다 — 급마다 크기 차이가 그대로 보이게
//   · 금화 wallet/coins.webp — 256 × 256: 금화 여덟이 아무렇게나 쌓임(다섯 쌓임 · 하나 기댐 · 흩어진 둘)
//   · 머리(천 주머니) wallet/pouch.webp — 256 × 256: 불룩한 천 주머니 · 묶은 끈 · 아래가 살짝 피에 젖음(사장님 ⑧)
//  ?ids=books,coins,pouch 또는 german_3 처럼 몇 개만. 결과는 window.thumbs = { done, list: [{ path, url, w, h, bytes, pad }] }
//  구도 시험: ?cx=0.78 (금화 내려다보기) ?px=0.28 (주머니 내려다보기) ?soak=0.22 (피 높이)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { metalMat } from '../../src/weapon_looks.js';
import { BOOK_SCHOOLS, BOOK_TIERS, ROMAN } from '../../src/skill_books.js';

const SS = 2; // 두 배로 그린 뒤 줄여서 가장자리를 곱게 (무기 그림과 같다)
const QUALITY = 0.86; // webp 품질 (무기 그림과 같다)
const PAD = 0.035; // 틀 가장자리 여백 (비율)
// 등급 색 = index.html :root --tier-* (언커먼만 entrance_type.css :host --tier-uncommon) — 그 값을 바꾸면 여기도 바꾸고 다시 찍는다
const TIER_COLOR = { common: 0xfff3c4, uncommon: 0xa8d67e, rare: 0x8cc4ff, epic: 0xd6a8ff, legend: 0xffd24a };
// 글자 (일본 제목 쪽지 · 죽간): 이 컴퓨터의 한자 글꼴. 글자는 256 px 그림에서도 몇 px — 화면에선 읽히지 않는 먹 점 줄이 된다 (사장님 17:4x '어차피 글자가 읽히지 않을 정도로 작기 때문에')
const CJK_FONT = '"IPAGothic", "WenQuanYi Zen Hei", "Noto Sans CJK JP", sans-serif';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? +params.get(k) : d);
const want = params.get('ids') ? params.get('ids').split(',') : ['books', 'coins', 'pouch'];
await document.fonts.load(`32px ${CJK_FONT}`, '孫子五輪書').catch(() => {}); // 시스템 글꼴이라 곧 끝난다 — 캔버스에 쓰기 전에 확실히

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

// 빛 = 무기 카드 그림과 같다 (흐린 하늘 + 누그러진 해 + 뒤쪽 윤곽 + 카메라 쪽 윤)
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.3));
for (const [color, power, x, y, z] of [[0xffe7cb, 1.8, -2, 4, 6], [0xc8d4e0, 0.6, 3, -1, -2], [0xffffff, 1.0, 2.5, 1, 5]]) {
  const light = new THREE.DirectionalLight(color, power);
  light.position.set(x, y, z);
  scene.add(light);
}

// ── 2D 모양 도우미 (문양 · 틀 · 쇠붙이 · 리본 고리) ──
const V3 = (p) => (p.isVector3 ? p : new THREE.Vector3(...p));
const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); return s; };
const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const disc = (cx, cy, r) => { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; };
const ring = (cx, cy, r0, r1) => { const s = disc(cx, cy, r1), h = new THREE.Path(); h.absarc(cx, cy, r0, 0, Math.PI * 2, true); s.holes.push(h); return s; };
const ellipse = (cx, cy, rx, ry) => { const s = new THREE.Shape(); s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0); return s; };
const roundRect = (x0, y0, x1, y1, r) => { const s = new THREE.Shape(); s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s; };
/** 네모 테 (바깥 x0..x1 · y0..y1, 굵기 lw) */
const frameShape = (x0, y0, x1, y1, lw) => { const s = rect(x0, y0, x1, y1), h = new THREE.Path(); h.moveTo(x0 + lw, y0 + lw); h.lineTo(x0 + lw, y1 - lw); h.lineTo(x1 - lw, y1 - lw); h.lineTo(x1 - lw, y0 + lw); h.closePath(); s.holes.push(h); return s; };
/** 굵기가 있는 선 (pts = [[x, y], …] 를 따라 width(t) 만큼 — 활 · 휜 칼날 · 코등이) */
function stroke(pts, width) {
  const w = typeof width === 'function' ? width : () => width, n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, h = w(i / (n - 1)) / 2;
    L.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    R.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  return poly([...L, ...R.reverse()]);
}
const curve = (f, n = 28) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
/** 모양을 돌리고 옮긴다 (구멍까지 — 일본 칼 · 리본 고리) */
function turn(shape, ang, ox = 0, oy = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), tf = (p) => [p.x * c - p.y * s + ox, p.x * s + p.y * c + oy];
  const out = poly(shape.getPoints(32).map(tf));
  for (const h of shape.holes) { const hp = new THREE.Path(), pts = h.getPoints(32).map(tf); hp.moveTo(...pts[0]); for (const p of pts.slice(1)) hp.lineTo(...p); out.holes.push(hp); }
  return out;
}

// ── 유파 문양: 칼 다섯 (y = −1 칼자루 끝 ~ +1 칼끝 · 옛 skill_tree.js EMBLEMS 의 12 × 12 도트 칼을 매끈하게) ── 독일 책 표지 · 이베리아 인장이 쓴다
const EMBLEM = {
  // 독일 — 롱소드: 곧은 양날 · 곧은 코등이(끝 구슬) · 바퀴 폼멜
  german: () => [
    poly([[-0.11, -0.27], [-0.088, 0.78], [0, 1], [0.088, 0.78], [0.11, -0.27]]),
    rect(-0.44, -0.4, 0.44, -0.26), disc(-0.45, -0.33, 0.085), disc(0.45, -0.33, 0.085),
    poly([[-0.075, -0.4], [-0.064, -0.68], [0.064, -0.68], [0.075, -0.4]]),
    ring(0, -0.8, 0.05, 0.15),
  ],
  // 이베리아 — 몬탄테: 넓고 긴 칼날 · 끝이 처진 긴 코등이 · 두 손 손잡이(가운데 띠) · 머리 위로 크게 도는 호(왼쪽 초승달)
  iberian: () => [
    poly([[-0.125, -0.19], [-0.104, 0.78], [0, 1], [0.104, 0.78], [0.125, -0.19]]),
    stroke(curve((t) => { const x = -0.47 + 0.94 * t, d = Math.max(0, Math.abs(x) - 0.28) / 0.19; return [x, -0.23 - 0.17 * d * d]; }, 40), 0.11),
    poly([[-0.076, -0.27], [-0.07, -0.82], [0.07, -0.82], [0.076, -0.27]]),
    rect(-0.1, -0.57, 0.1, -0.5),
    disc(0, -0.9, 0.11),
    stroke(curve((t) => { const a = Math.PI * (0.18 + 0.66 * t); return [-0.17 - 0.42 * Math.sin(a), 0.38 + 0.56 * Math.cos(a)]; }), (t) => 0.025 + 0.14 * Math.sin(t * Math.PI)),
  ],
};

/**
 * 도드라진 모양 (금박 · 틀 · 쇠붙이 · 인장 무늬) — 앞면(z = 0)에서 앞으로. 크기는 모양 좌표 그대로(부르는 쪽이 scale).
 *  edge: 눌러 찍은 자국 — 같은 모양을 grow 만큼 넓혀 짙은 색으로 밑에 깐다(작은 화면에서 금박 가장자리가 겉감에 안 묻히게)
 */
function relief(shapes, mat, { depth = 0.004, bevel = 0.0028, edge = null, grow = 0 } = {}) {
  const g = new THREE.Group();
  for (const s of shapes) {
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelOffset: -bevel * 0.5, bevelSegments: 2, curveSegments: 24 });
    g.add(new THREE.Mesh(geo, mat));
    if (edge) {
      const under = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0005, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0005, bevelOffset: grow, bevelSegments: 1, curveSegments: 24 }), edge);
      under.position.z = -0.0004;
      g.add(under);
    }
  }
  return g;
}
/** 겉 위 판 모양 하나 (단위 그대로 — 틀 · 쇠붙이) */
function plate(g, shapes, mat, z, { depth = 0.003, bevel = 0.002 } = {}) {
  const r = relief(Array.isArray(shapes) ? shapes : [shapes], mat, { depth, bevel });
  r.position.z = z;
  g.add(r);
  return r;
}
/** 휘는 띠 (리본 · 납작한 끈): 길 points 를 따라 너비 방향 dir 로 펼친 띠 — dir 은 벡터 또는 (t, 점) => 벡터 */
function band(points, width, mat, dir = new THREE.Vector3(1, 0, 0), closed = false) {
  const pts = points.map(V3), n = pts.length, pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const d = typeof dir === 'function' ? dir(i / (n - 1), pts[i]) : dir;
    const a = pts[i].clone().addScaledVector(d, width / 2), b = pts[i].clone().addScaledVector(d, -width / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(i / (n - 1), 0, i / (n - 1), 1);
    if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  if (closed) { const k = (n - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
/** 둥근 끈 (관 — 길을 매끈하게) */
const cord = (points, r, mat, seg = 48) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V3)), seg, r, 8, false), mat);
const smoothPts = (points, n = 48) => new THREE.CatmullRomCurve3(points.map(V3)).getPoints(n);

// ── 겉감 (캔버스 결): 가죽 낟알 · 양피지 얼룩 · 천 씨실날실(무늬 비단) · 종이 섬유(금박 조각) — 화면 크기에선 덩어리 음영만, 256 px 에선 결이 보인다 ──
const hexStr = (h) => '#' + h.toString(16).padStart(6, '0');
const shade = (h, k) => new THREE.Color(h).multiplyScalar(k).getHex();
const rng = (seed) => { let s = seed % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const CACHE = new Map();
const cached = (key, make) => (CACHE.has(key) ? CACHE.get(key) : (CACHE.set(key, make()), CACHE.get(key)));
function surfaceTex(kind, hex, seed, opt = {}) {
  return cached(`t:${kind}:${hex}:${seed}:${opt.flecks ?? ''}:${opt.brocade ?? ''}`, () => canvasTex(512, 672, (g, w, h) => {
    const r = rng(seed * 7919 + 13);
    g.fillStyle = hexStr(hex); g.fillRect(0, 0, w, h);
    if (kind === 'leather' || kind === 'vellum') {
      g.filter = 'blur(7px)'; // 얼룩은 흐릿하게 (점박이로 안 보이게)
      for (let i = 0; i < 200; i++) {
        const x = r() * w, y = r() * h, rad = 12 + r() * 40;
        g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.02 + r() * 0.035})` : `rgba(255,236,210,${0.015 + r() * 0.03})`;
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
      g.filter = 'none';
      if (kind === 'leather') for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,240,220,0.05)'; g.fillRect(r() * w, r() * h, 1.5, 1.5); } // 가죽 낟알
      else for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(120,90,50,0.12)'; g.fillRect(r() * w, r() * h, 1.2, 1.2); } // 양피지 모공
    } else if (kind === 'cloth') { // 씨실 · 날실
      for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.05})`; g.fillRect(0, y, w, 1); }
      for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.025})`; g.fillRect(x, 0, 1, h); }
      if (opt.brocade) { // 무늬 비단 — 작은 금빛 마름모 격자
        g.fillStyle = `rgba(222,178,86,${opt.brocade})`;
        for (let y = 10, row = 0; y < h; y += 30, row++) for (let x = (row % 2) * 15 + 8; x < w; x += 30) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.closePath(); g.fill(); }
      }
    } else if (kind === 'paper') { // 닥나무 종이 섬유 (+ 금박 조각)
      for (let i = 0; i < 1600; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; const x = r() * w, y = r() * h, a = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
      if (opt.flecks) for (let i = 0; i < opt.flecks; i++) { g.fillStyle = `rgba(232,192,92,${0.65 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 4); }
    }
    const v = g.createRadialGradient(w * 0.45, h * 0.42, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.72); // 손때 — 가장자리 어둡게
    v.addColorStop(0, kind === 'vellum' ? 'rgba(255,250,235,0.06)' : 'rgba(255,230,200,0.06)');
    v.addColorStop(1, kind === 'vellum' ? 'rgba(120,80,30,0.24)' : 'rgba(0,0,0,0.3)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }));
}
const surfaceMat = (kind, hex, seed, opt = {}) => cached(`m:${kind}:${hex}:${seed}:${opt.flecks ?? ''}:${opt.brocade ?? ''}`, () => new THREE.MeshStandardMaterial({ map: surfaceTex(kind, hex, seed, opt), roughness: { leather: 0.58, vellum: 0.5, cloth: 0.88, paper: 0.8 }[kind], metalness: 0 }));
const plainMat = (hex, rough = 0.6, metal = 0) => cached(`p:${hex}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
// 쪽 가장자리 결 (종이 겹 — dir 'h' 가로줄 · 'v' 세로줄)
const edgeTex = (hex, dir) => cached(`e:${hex}:${dir}`, () => canvasTex(128, 128, (g, w, h) => {
  const r = rng(hex + (dir === 'h' ? 1 : 2));
  g.fillStyle = hexStr(hex); g.fillRect(0, 0, w, h);
  for (let i = 0; i < 128; i += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.07})`; if (dir === 'h') g.fillRect(0, i, w, 1); else g.fillRect(i, 0, 1, h); }
}));
const edgeMat = (hex, dir) => cached(`em:${hex}:${dir}`, () => new THREE.MeshStandardMaterial({ map: edgeTex(hex, dir), roughness: 0.92 }));

// 재질 (여럿이 같이 쓴다)
const goldMat = metalMat(0xf6c552, { rough: 0.34, metal: 0.6, env: 1.4 }); // 금박: 무기 금속에서 금속 기운을 조금 덜어 — 카메라를 보는 면에서 칙칙한 올리브색이 되지 않게
// 금 가장자리 (쪽 결이 비치게) — 윗면은 밝은 하늘을 비춰 옅은 종이처럼 보이기 쉬워 바탕 금색을 짙게
const giltMat = metalMat(0xc48a2a, { rough: 0.3, metal: 0.78, env: 1.1, map: edgeTex(0xffffff, 'v') });
const giltTopMat = metalMat(0xc48a2a, { rough: 0.3, metal: 0.78, env: 1.1, map: edgeTex(0xffffff, 'h') });
const brassMat = metalMat(0xa7843f, { rough: 0.36, metal: 0.82 }); // 놋쇠 귀 · 걸쇠
// 등급 색 끈 · 리본 (조금 스스로 빛나게 — 어두운 칸 위 작은 크기에서 색이 죽지 않게)
const tierCordMat = Object.fromEntries(Object.entries(TIER_COLOR).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.05, emissive: c, emissiveIntensity: 0.16, side: THREE.DoubleSide })]));
// 끈 그늘 (등급 색 끈 밑에 깐 짙은 테 — 밝은 크림 끈이 밝은 종이 위에서도 끈으로 읽히게)
const cordShadowMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false });

// ── 독일 — 펜히트부흐 (탈호퍼 사본 같은 가죽 장정 — 앞 작업의 책 그대로, 급 숫자만 뺌) ──
// 종이 (급마다): 새 크림 · 크림 · 바랜 상아 · 금 가장자리 둘
const PAPER_EU = [0, 0xf4eddc, 0xeadcbc, 0xdcc595, 'gilt', 'gilt'];
/** 쪽 덩어리 (x0..x1 × h × t) */
function pageBlock(g, x0, x1, h, t, paper, z = 0) {
  const top = paper === 'gilt' ? giltTopMat : edgeMat(paper, 'h');
  const side = paper === 'gilt' ? giltMat : edgeMat(paper, 'v');
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, t), [side, side, top, top, side, side]);
  m.position.set((x0 + x1) / 2, 0, z);
  g.add(m);
  return m;
}
/** 딱딱한 표지 둘 (앞 · 뒤) — front 는 앞 판자 바깥 면 재질 */
function boards(g, w, h, bt, inner, front, side, r = 0.014) {
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, bt, 3, r), [side, side, side, side, s > 0 ? front : side, side]);
    b.position.z = s * (inner / 2 + bt / 2);
    g.add(b);
  }
}
/** 둥근 책등 (반 원기둥을 납작하게 · 도드라진 띠 bands 개) */
function roundSpine(g, h, R, x, mat, bands = 0, flat = 0.42) {
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 32, 1, true, Math.PI, Math.PI), mat);
  sp.scale.x = flat;
  sp.position.x = x + 0.004;
  g.add(sp);
  for (let i = 0; i < bands; i++) {
    const y = (h / 2) * 0.62 * (1 - (2 * i) / Math.max(1, bands - 1));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.06, 0.03, 32, 1, false, Math.PI, Math.PI), mat);
    b.scale.x = flat * 1.25;
    b.position.set(x + 0.004, y, 0);
    g.add(b);
  }
}
/** 가름끈 (제비꼬리 끝 — 책 아래로 늘어진다) */
function ribbon(g, mat, x, yTop, len, z = 0, w = 0.05, rz = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, -len); s.lineTo(0, -len + w * 0.7); s.lineTo(-w / 2, -len); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
  m.position.set(x, yTop, z);
  m.rotation.set(-0.12, 0.25, rz);
  g.add(m);
}
/** 앞 표지 바깥 귀 쇠붙이 (L 꼴 · 안쪽은 오목한 곡선) — xs = 귀가 있는 가장자리들 (+1 앞마구리 · −1 책등 쪽) */
function corners(g, w, h, z, mat, xs, studs = false) {
  const L = 0.14;
  for (const sx of xs) for (const sy of [1, -1]) {
    const x1 = (sx * w) / 2, y1 = (sy * h) / 2, s = new THREE.Shape();
    s.moveTo(x1, y1); s.lineTo(x1 - sx * L, y1); s.quadraticCurveTo(x1 - sx * L * 0.3, y1 - sy * L * 0.3, x1, y1 - sy * L); s.closePath();
    plate(g, s, mat, z, { depth: 0.004, bevel: 0.003 });
    if (studs) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 10), mat); d.scale.z = 0.5; d.position.set(x1 - sx * 0.042, y1 - sy * 0.042, z + 0.006); g.add(d); }
  }
}
/** 걸쇠 (앞마구리 쪽 놋쇠 판 + 못 · 밑에 가죽 띠) */
function clasps(g, w, z, mat, strapMat, ys) {
  for (const y of ys) {
    plate(g, rect(w / 2 - 0.06, y - 0.024, w / 2 + 0.008, y + 0.024), strapMat, z, { depth: 0.004, bevel: 0.002 });
    plate(g, roundRect(w / 2 - 0.1, y - 0.032, w / 2 - 0.02, y + 0.032, 0.012), mat, z + 0.004, { depth: 0.004, bevel: 0.003 });
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), mat); pin.scale.z = 0.6; pin.position.set(w / 2 - 0.08, y, z + 0.012); g.add(pin);
  }
}
// 독일: 나무 판자에 씌운 갈색 가죽 · 민무늬 눌러 찍은 테 · 둥근 책등 띠 넷 · 금박 롱소드 문양 · 가름끈(등급 색 — 책 아래로 늘어져 어두운 칸 위에서 읽힌다)
//  급: 볼륨 = 쪽 두께 0.09 → 0.25 / I 밝은 송아지 가죽 · 쇠 없음 → II 바깥 귀 → III 짙은 가죽 · 귀 + 걸쇠 하나 · 테 둘 → IV 네 귀 · 걸쇠 둘 · 금 가장자리 → V 가장 짙은 가죽 · 귀 징 · 금 가장자리
function germanBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.74, h = 1, bt = 0.04, pt = [0, 0.09, 0.13, 0.17, 0.21, 0.25][tier];
  const hex = [0, 0x8b5a34, 0x704327, 0x5c331c, 0x4b2818, 0x3f2115][tier], fz = pt / 2 + bt;
  boards(g, w, h, bt, pt, surfaceMat('leather', hex, 11 + tier), plainMat(hex, 0.6));
  pageBlock(g, -w / 2 + 0.02, w / 2 - 0.022, h - 0.044, pt, PAPER_EU[tier]);
  roundSpine(g, h, fz, -w / 2, plainMat(shade(hex, 0.8), 0.55), 4);
  const blind = plainMat(shade(hex, 0.5), 0.7);
  plate(g, frameShape(-w / 2 + 0.03, -h / 2 + 0.03, w / 2 - 0.03, h / 2 - 0.03, 0.01), blind, fz, { depth: 0.0015, bevel: 0 });
  if (tier >= 3) plate(g, frameShape(-w / 2 + 0.052, -h / 2 + 0.052, w / 2 - 0.052, h / 2 - 0.052, 0.007), blind, fz, { depth: 0.0015, bevel: 0 });
  if (tier >= 2) corners(g, w, h, fz, brassMat, tier >= 4 ? [1, -1] : [1], tier >= 5);
  if (tier >= 3) clasps(g, w, fz, brassMat, plainMat(shade(hex, 0.7), 0.6), tier >= 4 ? [0.27, -0.27] : [0.02]);
  // 가름끈 둘 (등급 색 — 넓고 길게: 숫자를 뺀 뒤 급 색은 이 끈이 알린다)
  ribbon(g, tierCordMat[rarity], -w / 2 + 0.16, -h / 2 + 0.06, 0.23, 0.0, 0.088, 0.05);
  ribbon(g, tierCordMat[rarity], -w / 2 + 0.28, -h / 2 + 0.06, 0.17, -0.01, 0.07, -0.1);
  // 금박 문양 (가운데 — 숫자가 빠진 자리만큼 조금 크게)
  const eh = 0.36, em = relief(EMBLEM.german(), goldMat, { depth: 0.004 / eh, bevel: 0.003 / eh, edge: plainMat(shade(hex, 0.3), 0.7), grow: 0.034 });
  em.scale.setScalar(eh);
  em.position.set(0.012, 0.02, fz);
  g.add(em);
  const ridge = relief([rect(-0.016, -0.24, 0.016, 0.82)], goldMat, { depth: 0.007 / eh, bevel: 0.0015 / eh }); // 칼날 등줄 (납작한 띠로 안 보이게)
  ridge.scale.setScalar(eh);
  ridge.position.set(0.012, 0.02, fz);
  g.add(ridge);
  g.rotation.set(0.2, 0.5, 0); // 3/4 보기: 책등(왼쪽)이 보이게 돌리고 윗면(쪽 가장자리)이 보이게 숙인다 (Euler XYZ = 먼저 y, 다음 x)
  return g;
}

// ── 이탈리아 — 그림 있는 낱장 묶음 (피오레 데이 리베리 『Fior di Battaglia』 사본의 낱장처럼: 조금씩 어긋난 장들 · 리본으로 묶음) ──
// 낱장 그림: 맞선 두 검사(펜 선 + 옅은 채색 · 스승은 금관) 두 줄 · 옆에 짧은 글 줄 — 급이 오를수록 종이가 바래고 채색 · 금박 · 머리글자가 는다
function leafTex(tier, paperHex) {
  return cached(`leaf:${tier}`, () => canvasTex(512, 694, (g, w, h) => {
    const r = rng(97 + tier * 31);
    g.fillStyle = hexStr(paperHex); g.fillRect(0, 0, w, h);
    g.filter = 'blur(10px)'; // 얼룩 (바랜 정도 = 급)
    for (let i = 0; i < 40 + tier * 30; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '120,84,40' : '255,248,230'},${0.02 + r() * 0.035})`; g.beginPath(); g.arc(r() * w, r() * h, 14 + r() * 46, 0, Math.PI * 2); g.fill(); }
    g.filter = 'none';
    const INK = '#3a2616', wash = ['', 'rgba(0,0,0,0)', 'rgba(150,120,80,0.35)', 'rgba(70,96,150,0.55)', 'rgba(150,52,40,0.6)', 'rgba(60,84,150,0.65)'][tier];
    const wash2 = ['', 'rgba(0,0,0,0)', 'rgba(150,120,80,0.25)', 'rgba(150,60,44,0.5)', 'rgba(64,98,62,0.55)', 'rgba(150,40,36,0.65)'][tier];
    const GOLD = tier >= 4 ? '#d8a22e' : '#b08a3e';
    // 검사 하나 (발 가운데 x, y · 키 s · dir 1 = 오른쪽을 봄)
    // 검사 하나 (발 가운데 x, y · 키 s · dir 1 = 오른쪽을 봄): 펜 선 + 옅은 채색 — 다리를 벌려 앞무릎을 굽힌 자세 · 두 손으로 롱소드를 앞으로 겨눔
    const fencer = (x, y, s, dir, fill, hose, crown) => {
      g.save(); g.translate(x, y); g.scale((dir * s) / 100, s / 100);
      g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 2.6;
      const shape = (pts, f) => { g.beginPath(); g.moveTo(...pts[0]); for (const q of pts.slice(1)) g.lineTo(...q); g.closePath(); if (f) { g.fillStyle = f; g.fill(); } g.stroke(); };
      shape([[-8, -50], [2, -50], [-22, -2], [-31, 0], [-30, -4]], hose); // 뒷다리
      shape([[-2, -50], [9, -50], [19, -29], [27, -3], [33, -1], [32, 1], [20, 1], [11, -28]], hose); // 앞다리 (굽힌 무릎)
      shape([[-11, -46], [11, -46], [14, -40], [-15, -40]], fill); // 웃옷 자락
      shape([[-10, -47], [10, -47], [9, -84], [3, -88], [-5, -88], [-10, -82]], fill); // 웃옷 (몸에 붙는 더블릿)
      shape([[2, -84], [17, -73], [27, -71], [27, -67], [15, -68], [0, -76]], fill); // 두 팔 (앞으로)
      g.fillStyle = '#ecd6b6'; g.beginPath(); g.arc(1, -97, 8.5, 0, Math.PI * 2); g.fill(); g.stroke(); // 머리
      g.fillStyle = 'rgba(70,46,26,0.9)'; g.beginPath(); g.arc(1, -98, 8.6, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill(); // 머리카락
      g.lineWidth = 2.4; g.beginPath(); g.moveTo(29, -70); g.lineTo(92, -124); g.stroke(); // 칼날
      g.lineWidth = 3.6; g.beginPath(); g.moveTo(22, -78); g.lineTo(35, -62); g.stroke(); // 코등이
      g.lineWidth = 3; g.beginPath(); g.moveTo(29, -70); g.lineTo(19, -62); g.stroke(); g.beginPath(); g.arc(17, -60, 2.6, 0, Math.PI * 2); g.fillStyle = INK; g.fill(); // 손잡이 · 폼멜
      if (crown) { g.lineWidth = 1.4; shape([[-7, -104], [-8, -115], [-3, -109], [1, -117], [5, -109], [10, -115], [9, -104]], GOLD); } // 스승의 금관
      g.restore();
    };
    // 글 줄 (낱말처럼 끊긴 짧은 먹 줄)
    const lines = (x0, x1, y0, n, lh = 15) => {
      g.fillStyle = 'rgba(58,38,22,0.78)';
      for (let k = 0; k < n; k++) { let x = x0; const y = y0 + k * lh; while (x < x1 - 12) { const ww = Math.min(x1 - x, 12 + r() * 34); g.fillRect(x, y, ww, 3.2); x += ww + 7 + r() * 4; } }
    };
    const M = 46;
    if (tier >= 3) { // 머리글자 (붉은 바탕 · 푸른 꾸밈 — 금박은 IV~V)
      g.fillStyle = '#9c2a20'; g.fillRect(M, M, 40, 40);
      g.strokeStyle = tier >= 4 ? GOLD : '#2f4f8a'; g.lineWidth = 4; g.strokeRect(M + 4, M + 4, 32, 32);
      g.fillStyle = tier >= 4 ? GOLD : '#f1e3c2'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', M + 20, M + 22);
    }
    lines(tier >= 3 ? M + 50 : M, w - M, M + 6, 3);
    // 두 줄의 맞선 검사 (칼이 가운데서 엇갈림)
    for (const [y, a] of [[300, 0], [580, 1]]) {
      fencer(w * 0.3, y, 150, 1, a ? wash2 : wash, a ? wash : wash2, tier >= 4 && a === 0);
      fencer(w * 0.7, y, 150, -1, a ? wash : wash2, a ? wash2 : wash, tier >= 5 && a === 1);
      if (tier >= 2) { g.fillStyle = 'rgba(58,38,22,0.55)'; g.fillRect(w * 0.2, y + 8, w * 0.6, 2); } // 땅 선
    }
    lines(M, w - M, 330, 2, 14);
    lines(M, w - M, 612, 2, 14);
    const v = g.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); // 가장자리 손때
    v.addColorStop(0, 'rgba(255,248,230,0)'); v.addColorStop(1, `rgba(110,72,30,${0.12 + tier * 0.05})`);
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }));
}
/** 리본 고리 (나비 매듭의 한쪽 — 납작한 타원 고리 · 매듭에서 바깥으로) */
const loopShape = (len, wid, th, ang) => {
  const s = ellipse(len / 2, 0, len / 2, wid / 2), hole = new THREE.Path();
  hole.absellipse(len / 2 + th * 0.2, 0, len / 2 - th, wid / 2 - th, 0, Math.PI * 2, true, 0);
  s.holes.push(hole);
  return turn(s, ang);
};
// 이탈리아: 크림 양피지 낱장 · 장마다 조금씩 어긋나고 기울어 가장자리가 고르지 않다 · 맨 위 장에 그림 · 가로로 감은 리본 + 나비 매듭(등급 색 — 꼬리가 아래로 늘어져 어두운 칸 위에서 읽힌다)
//  급: 볼륨 = 쌓인 높이 0.035 → 0.15 (장 묶음 4 → 12) / 종이 새 크림 → 바랜 양피지 · 그림 채색 → 머리글자 → 금관 · 금박
function italianLeaves(tier, rarity) {
  const g = new THREE.Group(), w = 0.62, h = 0.84, t = [0, 0.035, 0.064, 0.093, 0.122, 0.15][tier], n = [0, 4, 6, 8, 10, 12][tier];
  const paperHex = [0, 0xf2ead6, 0xebdfc2, 0xe3d1a9, 0xdac496, 0xd1b682][tier], r = rng(61 + tier * 7);
  const face = plainMat(shade(paperHex, 0.97), 0.85), topE = edgeMat(shade(paperHex, 0.94), 'h'), sideE = edgeMat(shade(paperHex, 0.94), 'v');
  for (let i = 0; i < n; i++) { // 뒤(바닥)에서 앞(맨 위 장)으로 — 묶음마다 어긋남 · 기울기
    const bt = t / n, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, bt * 0.94), [sideE, sideE, topE, topE, face, face]);
    m.position.set((r() - 0.5) * 0.03, (r() - 0.5) * 0.026, -t + bt * (i + 0.5));
    m.rotation.z = (r() - 0.5) * 0.06;
    g.add(m);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), [sideE, sideE, topE, topE, new THREE.MeshStandardMaterial({ map: leafTex(tier, paperHex), roughness: 0.82 }), face]);
  top.position.set(0.004, 0.003, 0.002);
  top.rotation.z = 0.012;
  g.add(top);
  // 리본: 쌓임을 가로로 한 바퀴 (앞 · 옆 · 뒤) + 나비 매듭
  const mat = tierCordMat[rarity], yb = -0.17, bw = 0.05, ex = w / 2 + 0.018, zf = 0.007, zb = -t - 0.004;
  g.add(band([[-ex, yb, zf], [ex, yb, zf], [ex, yb, zb], [-ex, yb, zb]], bw, mat, new THREE.Vector3(0, 1, 0), true));
  g.add(band([[-ex, yb - 0.004, zf - 0.0015], [ex, yb - 0.004, zf - 0.0015]], bw + 0.016, cordShadowMat, new THREE.Vector3(0, 1, 0))); // 리본 그늘 (밝은 종이 위에서도 띠로 읽히게)
  const kx = 0.1, kz = zf + 0.002;
  for (const [len, ang] of [[0.15, 2.75], [0.14, 0.4]]) { const l = new THREE.Mesh(new THREE.ExtrudeGeometry(loopShape(len, 0.085, 0.022, ang), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), mat); l.position.set(kx, yb, kz); g.add(l); }
  const knot = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.056, 0.02, 2, 0.008), mat); knot.position.set(kx, yb, kz + 0.008); g.add(knot);
  // 꼬리 둘: 매듭에서 앞면을 타고 내려가 아래 모서리를 넘어 바닥에 놓인다 (어두운 칸 위로 나온다)
  const yE = -h / 2 - 0.012;
  for (const [dx, len] of [[-0.06, 0.17], [0.05, 0.13]]) {
    const pts = smoothPts([[kx, yb - 0.02, kz], [kx + dx * 0.5, (yb + yE) / 2, zf + 0.001], [kx + dx * 0.8, yE + 0.01, zf - 0.002], [kx + dx, yE - 0.006, -t * 0.4], [kx + dx * 1.1, yE - 0.012, -t - 0.004], [kx + dx * 1.3, yE - len, -t - 0.006]], 40);
    g.add(band(pts, 0.044, mat, (q) => new THREE.Vector3(1, 0.1 * Math.sign(dx), 0).normalize()));
  }
  // 3/4 보기: 탁자에 놓인 묶음을 앞 위에서 — 앞 가장자리(쌓인 높이)가 보이게 아래쪽을 카메라로 숙이고 왼쪽 옆이 보이게 돌린다
  g.rotation.set(-0.72, 0.3, 0);
  return g;
}

// ── 이베리아 — 말린 양피지 (스페인 검술 사범 시험 증서 carta de examen 처럼: 양피지 두루마리 · 가운데 감은 리본 · 리본 끝에 매단 붉은 밀랍 인장 — 인장에 유파 문양) ──
/** 말린 끝 결 (둥근 단면에 감긴 겹 — 밝은 종이 선 · 그 사이 그늘 · 가운데 빈 구멍) */
const spiralTex = (paperHex, gapHex, turns, holeK = 0.32) => cached(`sp:${paperHex}:${gapHex}:${turns}:${holeK}`, () => canvasTex(256, 256, (g, w) => {
  const c = w / 2, R = w / 2 - 1;
  g.fillStyle = hexStr(gapHex); g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = hexStr(paperHex); g.lineWidth = (R * (1 - holeK)) / turns * 0.55; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0, N = 400; i <= N; i++) { const a = (i / N) * turns * Math.PI * 2, rr = R * holeK + (R * (1 - holeK) * i) / N - g.lineWidth / 2; const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = 'rgba(20,12,6,0.9)'; g.beginPath(); g.arc(c, c, R * holeK * 0.8, 0, Math.PI * 2); g.fill();
}));
/** 두루마리 몸 (축 = y · 반지름 R · 길이 L): 겉 원기둥 + 양 끝 감긴 겹 */
function rollBody(R, L, sideMat, endTex) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 64, 1, true), sideMat));
  const endMat = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.85 });
  for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(R * 0.995, 48), endMat); e.rotation.x = -s * Math.PI / 2; e.position.y = (s * L) / 2; g.add(e); }
  return g;
}
const waxMat = new THREE.MeshStandardMaterial({ color: 0x8e1b13, roughness: 0.36, metalness: 0.02 });
const waxDeepMat = new THREE.MeshStandardMaterial({ color: 0x6a120c, roughness: 0.42, metalness: 0.02 });
/** 밀랍 인장 (얼굴이 +z · 가장자리가 고르지 않게 · 눌린 테 · 가운데 문양) */
function waxSeal(rs) {
  const g = new THREE.Group();
  const prof = [[0, 0.03], [0.7, 0.03], [0.78, 0.05], [0.9, 0.055], [0.98, 0.03], [1, 0], [0.96, -0.03], [0, -0.03]].map(([x, y]) => new THREE.Vector2(x, y)).reverse();
  const geo = new THREE.LatheGeometry(prof, 64), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + 0.05 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 11 + 2); pos.setX(i, x * k); pos.setZ(i, z * k); }
  geo.computeVertexNormals();
  const disc0 = new THREE.Mesh(geo, waxMat);
  disc0.rotation.x = Math.PI / 2; // 얼굴(+y) → +z
  disc0.scale.set(rs, rs * 1.4, rs);
  g.add(disc0);
  const em = relief(EMBLEM.iberian(), waxDeepMat, { depth: 0.08, bevel: 0.04 });
  em.scale.setScalar(rs * 0.6);
  em.position.z = rs * 0.042;
  g.add(em);
  return g;
}
// 이베리아: 크림 양피지 두루마리 (비스듬히 '/') · 가운데 감은 리본(등급 색) · 리본 두 끝이 아래로 내려와 붉은 밀랍 인장을 단다
//  급: 볼륨 = 두루마리 길이 0.7 → 0.94 · 굵기 반지름 0.084 → 0.13 / 양피지 새 흰빛 → 바랜 금빛 · 인장이 커짐 · IV~V 바깥 끝에 금 테
function iberianRoll(tier, rarity) {
  const holder = new THREE.Group();
  const L = [0, 0.7, 0.76, 0.82, 0.88, 0.94][tier], R = [0, 0.084, 0.095, 0.106, 0.118, 0.13][tier];
  const hex = [0, 0xf3ebd6, 0xede0c2, 0xe4d1a8, 0xdbc292, 0xd1b07c][tier];
  const roll = new THREE.Group(), body = rollBody(R, L, surfaceMat('vellum', hex, 31 + tier), spiralTex(shade(hex, 1.02), shade(hex, 0.45), 4 + tier * 0.5));
  roll.add(body);
  // 바깥 끝 (양피지 가장자리가 겉에 살짝 도드라짐) · IV~V 는 그 가장자리에 금 테 (꾸민 증서)
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.01, L * 0.998, 0.006), plainMat(shade(hex, 0.86), 0.6));
  lip.position.set(Math.sin(0.5) * (R + 0.002), 0, Math.cos(0.5) * (R + 0.002)); lip.rotation.y = 0.5; roll.add(lip);
  if (tier >= 4) { const gl = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0015, R + 0.0015, L * 0.94, 32, 1, true, 0.2, 0.08), goldMat); roll.add(gl); }
  // 가운데 리본 (축 둘레 한 바퀴 — 두 겹)
  const mat = tierCordMat[rarity], yb = -0.04 * L;
  for (const [dy, ww] of [[0, 0.07], [0.035, 0.03]]) roll.add(band(curve((t) => [Math.sin(t * Math.PI * 2) * (R + 0.004 + dy * 0.02), yb + dy * 0.3, Math.cos(t * Math.PI * 2) * (R + 0.004 + dy * 0.02)], 64), ww, mat, new THREE.Vector3(0, 1, 0)));
  // 비스듬히 놓기: 축을 오른쪽 위로 (가로에서 44°) · 왼쪽 아래 끝이 카메라 쪽으로 (말린 끝이 보이게)
  const mid = new THREE.Group(); mid.add(roll); mid.rotation.z = -(Math.PI / 2 - 0.77);
  const outer = new THREE.Group(); outer.add(mid); outer.rotation.set(0.25, 0.42, 0);
  holder.add(outer);
  // 인장: 리본이 감긴 자리의 아래 앞쪽에서 두 끝이 내려와 인장을 단다
  holder.updateMatrixWorld(true);
  let a = null;
  for (let k = 0; k < 64; k++) { const t = (k / 64) * Math.PI * 2, p = new THREE.Vector3(Math.sin(t) * R, yb, Math.cos(t) * R).applyMatrix4(roll.matrixWorld); if (p.z > -0.02 && (!a || p.y < a.y)) a = p; }
  const rs = [0, 0.074, 0.081, 0.088, 0.095, 0.102][tier], drop = 0.12 + R * 0.6, sy = a.y - drop;
  for (const dx of [-0.018, 0.016]) {
    const pts = smoothPts([[a.x + dx * 0.3, a.y + 0.012, a.z + 0.004], [a.x + dx * 0.8, a.y - drop * 0.35, a.z + 0.02], [a.x + dx * 1.2, sy + rs * 0.6, a.z + 0.03], [a.x + dx * 1.2, sy, a.z + 0.03]], 24);
    holder.add(band(pts, 0.03, mat, new THREE.Vector3(1, 0, 0)));
  }
  const seal = waxSeal(rs); seal.position.set(a.x, sy, a.z + 0.045); seal.rotation.set(0.12, -0.18, 0.08); holder.add(seal);
  return holder;
}

// ── 일본 — 『五輪書』 두루마리 (미야모토 무사시 — 地 · 水 · 火 · 風 · 空 다섯 권 = 급 I ~ V: 나무 축 끝 · 감은 끈 · 제목 쪽지 題簽) ──
const GORIN = ['', '地之巻', '水之巻', '火之巻', '風之巻', '空之巻'];
/** 제목 쪽지 결 (세로 글: 五輪書 + 권 이름 — 가는 테) */
const slipTex = (tier) => cached(`slip:${tier}`, () => canvasTex(64, 448, (g, w, h) => {
  const r = rng(7 + tier);
  g.fillStyle = tier >= 4 ? '#efe3c2' : '#f2ead8'; g.fillRect(0, 0, w, h);
  if (tier >= 4) for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(214,170,70,${0.5 + r() * 0.4})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); } // 금박 조각 종이
  g.strokeStyle = 'rgba(60,40,24,0.7)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#1d140d'; g.font = `600 34px ${CJK_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...`五輪書${GORIN[tier]}`].forEach((ch, i) => g.fillText(ch, w / 2 + (r() - 0.5) * 1.5, 34 + i * 40 + (i >= 3 ? 14 : 0)));
}));
// 일본: 비단 겉감 두루마리 (비스듬히 '\' — 이베리아 '/' 와 반대로 눕혀 작은 크기에서도 윤곽이 갈린다) · 양 끝 축 머리 · 가운데 두 번 감은 납작한 끈(등급 색 — 끝이 아래로 늘어짐) · 제목 쪽지
//  급: 볼륨 = 길이 0.72 → 0.96 · 굵기 반지름 0.068 → 0.096 / 겉감 쪽빛 종이 → 쪽빛 비단 → 무늬 비단 → 금빛 무늬가 짙어짐 · 축 머리 밝은 나무 → 짙은 나무 → 검은 옻칠 → 상아 → 금
function japaneseScroll(tier, rarity) {
  const holder = new THREE.Group();
  const L = [0, 0.72, 0.78, 0.84, 0.9, 0.96][tier], R = [0, 0.068, 0.075, 0.082, 0.089, 0.096][tier];
  const hex = [0, 0x46607e, 0x34507a, 0x2b416a, 0x243457, 0x1d2742][tier];
  const cover = tier === 1 ? surfaceMat('paper', hex, 41) : surfaceMat('cloth', hex, 51 + tier, { brocade: [0, 0, 0, 0.32, 0.55, 0.85][tier] });
  const roll = new THREE.Group();
  roll.add(rollBody(R, L, cover, spiralTex(0xefe6cf, 0x3a2c22, 5 + tier)));
  // 축 머리 (양 끝 — 급마다 귀해짐)
  const knobMat = [null, plainMat(0xb68a56, 0.62), plainMat(0x6a3f24, 0.5), plainMat(0x15100c, 0.16), plainMat(0xeee2c4, 0.28), metalMat(0xe0b04a, { rough: 0.25, metal: 0.85, env: 1.4 })][tier];
  for (const s of [1, -1]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.66, 0.036, 32), knobMat); k.position.y = s * (L / 2 + 0.018); roll.add(k);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 0.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), knobMat); cap.scale.y = 0.35; cap.position.y = s * (L / 2 + 0.036); if (s < 0) cap.rotation.x = Math.PI; roll.add(cap);
  }
  // 바깥 끝 대나무 살(八双) — 겉에 가는 줄로 도드라짐
  const hasso = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, L * 0.999, 8), plainMat(shade(hex, 0.6), 0.6));
  hasso.position.set(Math.sin(-0.9) * (R + 0.003), 0, Math.cos(-0.9) * (R + 0.003)); roll.add(hasso);
  // 제목 쪽지 (윗 끝 가까이 · 축을 따라 — 겉에 붙은 좁은 종이)
  const slipLen = L * 0.42, slip = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0016, R + 0.0016, slipLen, 8, 1, true, 0.15 - 0.2, 0.4), new THREE.MeshStandardMaterial({ map: slipTex(tier), roughness: 0.75 }));
  slip.position.y = L / 2 - 0.05 - slipLen / 2; roll.add(slip);
  // 끈: 가운데 아래쪽에 나란히 두 번 감은 납작한 끈 + 늘어진 끝 (등급 색)
  const mat = tierCordMat[rarity], yc = -0.12 * L, cw = 0.032;
  for (const dy of [0.02, -0.02]) roll.add(band(curve((t) => [Math.sin(t * Math.PI * 2) * (R + 0.004), yc + dy, Math.cos(t * Math.PI * 2) * (R + 0.004)], 64), cw, mat, new THREE.Vector3(0, 1, 0)));
  const mid = new THREE.Group(); mid.add(roll); mid.rotation.z = Math.PI / 2 - 0.92; // 축이 왼쪽 위 → 오른쪽 아래 ('\')
  const outer = new THREE.Group(); outer.add(mid); outer.rotation.set(0.22, -0.42, 0);
  holder.add(outer);
  // 늘어진 끈 끝: 감긴 자리의 아래 앞쪽에서 아래로 (어두운 칸 위로 나온다) · 끝에 작은 매듭
  holder.updateMatrixWorld(true);
  let a = null;
  for (let k = 0; k < 64; k++) { const t = (k / 64) * Math.PI * 2, p = new THREE.Vector3(Math.sin(t) * (R + 0.004), yc - 0.036, Math.cos(t) * (R + 0.004)).applyMatrix4(roll.matrixWorld); if (p.z > -0.01 && (!a || p.y < a.y)) a = p; }
  const tail = smoothPts([[a.x, a.y + 0.01, a.z], [a.x - 0.02, a.y - 0.06, a.z + 0.02], [a.x - 0.012, a.y - 0.13, a.z + 0.03], [a.x + 0.012, a.y - 0.19, a.z + 0.03]], 32);
  holder.add(band(tail, cw * 0.85, mat, new THREE.Vector3(1, 0.15, 0).normalize()));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), mat); knot.position.copy(tail[tail.length - 1]); holder.add(knot);
  return holder;
}

// ── 동방 — 죽간 (銀雀山 한나라 무덤 『孫子兵法』 대쪽처럼: 끈으로 엮은 대쪽 · 왼쪽은 말리고 오른쪽은 펼침 · 대쪽마다 먹 글자 한 줄) ──
const SUNZI = '孫子曰兵者國之大事死生之地存亡之道不可不察也故經之以五事校之以計而索其情一曰道二曰天三曰地四曰將五曰法道者令民與上同意也故可以與之死可以與之生而民不畏危天者陰陽寒暑時制也地者遠近險易廣狹死生也將者智信仁勇嚴也法者曲制官道主用也凡此五者將莫不聞知之者勝不知者不勝';
/** 대쪽 한 장의 글 면 (먹 글자 한 줄 — 끈 자리는 비움) */
const slatTex = (k, hex) => cached(`slat:${k}:${hex}`, () => canvasTex(40, 720, (g, w, h) => {
  const r = rng(300 + k);
  g.fillStyle = hexStr(hex); g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(90,60,20,${0.05 + r() * 0.06})`; g.fillRect(0, r() * h, w, 1 + r() * 2); } // 대 결 (가로 마디 · 얼룩)
  g.fillStyle = 'rgba(80,52,20,0.18)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); // 모서리 그늘
  g.fillStyle = '#20150c'; g.font = `600 25px ${CJK_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const cut = (y) => Math.abs(y - h * 0.18) < 22 || Math.abs(y - h * 0.5) < 22 || Math.abs(y - h * 0.82) < 22; // 끈 자리 (위 · 가운데 · 아래)
  let i = 0;
  for (let y = 30; y < h - 20; y += 27) { if (cut(y)) continue; g.globalAlpha = 0.82 + r() * 0.15; g.fillText(SUNZI[(k * 23 + i++) % SUNZI.length], w / 2 + (r() - 0.5) * 1.5, y); }
  g.globalAlpha = 1;
}));
// 동방: 대쪽(누런 대 · 등은 푸르스름한 대 껍질) 여럿을 세 줄 끈(등급 색)으로 엮음 · 왼쪽은 말린 뭉치 · 오른쪽은 펼친 대쪽에 먹 글자 · 끈 끝이 오른쪽으로 늘어짐(어두운 칸 위)
//  급: 볼륨 = 펼친 대쪽 6 → 10 · 말린 대쪽 12 → 30 / 대 빛깔 새 대 → 짙은 호박빛(오래 손 탄 대 · V 는 옻칠 윤)
function chineseSlips(tier, rarity) {
  const g = new THREE.Group();
  const nu = [0, 6, 7, 8, 9, 10][tier], nr = [0, 12, 16, 20, 25, 30][tier], sw = 0.05, gap = 0.005, sl = 0.9, st = 0.014, pitch = sw + gap;
  const hex = [0, 0xd8c890, 0xcfb87a, 0xc4a466, 0xb79254, 0xa47f44][tier], skin = plainMat([0, 0x9aa070, 0x8f9264, 0x8a8458, 0x80764c, 0x6e6440][tier], 0.55);
  const sideM = plainMat(shade(hex, 0.86), tier >= 5 ? 0.35 : 0.6), plainFace = plainMat(hex, tier >= 5 ? 0.38 : 0.62);
  const slat = (k, face) => new THREE.Mesh(new RoundedBoxGeometry(sw, sl, st, 2, 0.004), [sideM, sideM, sideM, sideM, face, skin]);
  // 말린 뭉치: 바깥 대쪽이 바닥에 닿은 자리(x = 0)에서 펼친 쪽(+x)으로 이어진다 — 아르키메데스 나선 (글 면은 안쪽)
  const b = (st + 0.003) / (Math.PI * 2), rin = 0.022, ang = [];
  let th = 0;
  for (let k = 0; k < nr; k++) { ang.push(th); th += pitch / (rin + b * th); }
  const thOut = ang[ang.length - 1], rOut = rin + b * thOut, off = -Math.PI / 2 - thOut, zc = rOut;
  for (let k = 0; k < nr; k++) {
    const a = ang[k] + off, rr = rin + b * ang[k], m = slat(k, plainFace);
    m.position.set(Math.cos(a) * rr, 0, zc + Math.sin(a) * rr);
    m.rotation.y = -(a + Math.PI / 2);
    g.add(m);
  }
  // 펼친 대쪽 (오른쪽 — 맨 오른쪽이 첫 대쪽: 글은 오른쪽에서 왼쪽으로 읽는다)
  const x0 = pitch * 0.6;
  for (let i = 0; i < nu; i++) {
    const m = slat(i, new THREE.MeshStandardMaterial({ map: slatTex(nu - 1 - i, hex), roughness: tier >= 5 ? 0.38 : 0.62 }));
    m.position.set(x0 + i * pitch, 0, st / 2);
    m.rotation.z = (rng(500 + i * 13 + tier)() - 0.5) * 0.012;
    g.add(m);
  }
  // 엮은 끈 셋 (등급 색): 펼친 대쪽 위를 지나며 대쪽 사이로 살짝 들어가고 · 말린 뭉치는 겉을 감고 · 오른쪽 끝에서 늘어진다
  const mat = tierCordMat[rarity], cr = 0.0125, xEnd = x0 + (nu - 1) * pitch + sw / 2;
  for (const [yy, k] of [[sl * 0.32, 0], [0, 1], [-sl * 0.32, 2]]) {
    const pts = [];
    for (let x = x0 - pitch * 0.5; x <= xEnd + 0.001; x += pitch / 2) pts.push([x, yy, st + cr * (Math.round(x / (pitch / 2)) % 2 ? 0.2 : 0.95)]);
    const dl = 0.07 + k * 0.025, loose = [[xEnd + 0.022, yy - 0.003, st * 0.9], [xEnd + 0.036, yy - dl * 0.4, st * 0.5], [xEnd + 0.042 + k * 0.006, yy - dl, cr * 0.9]];
    g.add(cord([...pts, ...loose], cr, mat, 96));
    const end = new THREE.Mesh(new THREE.SphereGeometry(cr * 1.7, 12, 10), mat); end.position.set(...loose[2]); g.add(end); // 끈 끝 매듭
    g.add(new THREE.Mesh(new THREE.TorusGeometry(rOut + st / 2 + cr * 0.6, cr, 8, 64), mat).translateY(yy).translateZ(zc).rotateX(Math.PI / 2)); // 뭉치 겉을 감은 끈
  }
  // 3/4 보기: 탁자에 놓인 죽간을 앞 위에서 — 아래쪽을 카메라로 숙이고 조금 돌린다 (말린 뭉치의 윗 끝이 보이게)
  g.rotation.set(-0.62, -0.22, 0);
  return g;
}

const BOOK = { german: germanBook, italian: italianLeaves, iberian: iberianRoll, japanese: japaneseScroll, chinese: chineseSlips };
const buildBook = (school, tier, rarity) => BOOK[school](tier, rarity);

// ── 금화 ──
const coinGold = metalMat(parseInt(params.get('kc') || 'f0b840', 16), { rough: num('kr', 0.2), metal: num('km', 0.9), env: num('ke', 1.5) });
function coinGeometry() {
  // 단면(반지름 r, 높이 y) — 도드라진 테 · 안쪽 고리 · 가운데 볼록 · 비스듬히 깎은 옆면
  const pts = [[0, 0.03], [0.1, 0.032], [0.14, 0.026], [0.27, 0.026], [0.3, 0.032], [0.33, 0.026], [0.4, 0.027], [0.43, 0.04], [0.47, 0.041], [0.5, 0.026], [0.5, -0.026], [0.47, -0.041], [0.43, -0.04], [0.4, -0.027], [0.33, -0.026], [0.3, -0.032], [0.27, -0.026], [0.14, -0.026], [0.1, -0.032], [0, -0.03]];
  return new THREE.LatheGeometry(pts.reverse().map(([r, y]) => new THREE.Vector2(r, y)), 64);
}
function buildCoins() {
  const g = new THREE.Group(), geo = coinGeometry(), coin = (x, y, z, rx = 0, rz = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, coinGold);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  // 뒤 왼쪽 다섯 쌓임 (조금씩 어긋나고 기울어 — 가지런한 기둥이 아니게)
  const stack = [[-0.2, -0.18, 0.02, -0.015], [-0.16, -0.15, -0.04, 0.035], [-0.23, -0.2, 0.05, 0.05], [-0.17, -0.13, -0.07, -0.06], [-0.21, -0.17, 0.06, 0.04]];
  stack.forEach(([x, z, rx, rz], k) => coin(x, 0.041 + k * 0.082, z, rx, rz, k * 1.3));
  // 쌓임 오른쪽 윗모서리(xc, yc)에 걸쳐 기댄 하나 — 아래 가장자리는 바닥, 약 40° (가운데 = 바닥 닿는 점에서 반지름만큼 위로 + 두께 반)
  const lean = 0.7, s = Math.sin(lean), c = Math.cos(lean), xc = 0.32, yc = 0.041 + 4 * 0.082 + 0.04, xb = xc + (yc / s) * c;
  coin(xb - 0.5 * c + 0.04 * s, 0.5 * s + 0.04 * c, -0.1, 0.06, -lean, 0.25);
  // 앞에 흩어진 둘: 납작한 것 · 그 가장자리에 걸쳐 기운 것
  coin(0.2, 0.041, 0.42, 0, 0, 0.8);
  coin(-0.4, 0.1, 0.36, 0.08, 0.13, 1.7);
  // 내려다보는 3/4: 바닥을 카메라 쪽으로 숙이고 조금 돌린다 (작은 크기에서 동전 얼굴이 둥글게 읽히게 약 45°)
  g.rotation.set(num('cx', 0.78), num('cy', 0.32), 0);
  return g;
}

// ── 머리 — 천 주머니 (불룩한 몸 · 목을 묶은 끈 · 위로 벌어진 주름 · 아래가 살짝 피에 젖음) ──
function buildPouch() {
  const g = new THREE.Group();
  // 단면 (반지름, 높이): 바닥 → 불룩한 배 → 목 → 위로 벌어진 주름
  const prof = [[0.001, 0], [0.2, 0.012], [0.36, 0.05], [0.47, 0.13], [0.52, 0.25], [0.51, 0.37], [0.45, 0.5], [0.34, 0.62], [0.21, 0.71], [0.145, 0.77], [0.135, 0.8], [0.15, 0.84], [0.2, 0.9], [0.27, 0.96], [0.31, 1.0]];
  // 단면을 매끈한 곡선으로 촘촘히 (꼭짓점 색 — 피 경계 · 주름 골 — 이 큰 세모로 뭉개지지 않게)
  const lathe = new THREE.LatheGeometry(new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(120), 128);
  lathe.rotateY(Math.PI / 2);
  const pos = lathe.attributes.position, n = pos.count, colors = new Float32Array(n * 3);
  const cloth = new THREE.Color(0xb08a58), clothDark = new THREE.Color(0x6e5232), blood = new THREE.Color(0x701a14), bloodDeep = new THREE.Color(0x3a0d0b), tide = new THREE.Color(0x4a0f0c);
  const soakAt = num('soak', 0.22); // 피가 스민 높이 (주머니 높이 비 — 사장님 ⑧ '아래가 살짝' · 흘러내림 없이 아래에서 스며 오른 꼴)
  const tmp = new THREE.Color();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), th = Math.atan2(z, x);
    // 주름: 목 둘레로 모인 천(촘촘) · 위 벌어진 끝은 물결 · 배는 낮은 혹(속에 든 것)
    const neck = Math.exp(-(((y - 0.78) / 0.09) ** 2)), top = smooth(0.82, 1.0, y), belly = Math.exp(-(((y - 0.3) / 0.2) ** 2));
    const fold = Math.sin(th * 9 + y * 3) * (0.1 * neck + 0.16 * top) + Math.sin(th * 5 - 1.3) * 0.05 * smooth(0.55, 0.75, y);
    const lump = belly * (0.05 * Math.sin(th * 2 + 0.9) + 0.035 * Math.sin(th * 3 - 0.4 + y * 4));
    const k = 1 + fold + lump;
    // 바닥에 앉아 납작 · 가로로 조금 넓게
    const flat = y < 0.12 ? 1 + 0.06 * (1 - y / 0.12) : 1;
    pos.setXYZ(i, x * k * 1.06 * flat, y < 0.05 ? y * 0.8 : y, z * k * 0.94 * flat);
    // 색: 주름 골은 어둡게 · 피는 아래에서 올라와 스민다(경계가 고르지 않게 · 경계에 옅게 마른 띠)
    tmp.copy(cloth).lerp(clothDark, Math.max(0, -fold) * 2.2 + 0.25 * top * (1 - Math.abs(Math.cos(th))));
    const edge = soakAt + 0.045 * Math.sin(th * 3 + 0.7) + 0.025 * Math.sin(th * 7 + 2.1) + 0.015 * Math.sin(th * 13 + 0.3);
    const soak = smooth(edge + 0.05, edge - 0.04, y);
    if (soak > 0) {
      const ringK = Math.exp(-(((y - edge + 0.012) / 0.018) ** 2)) * 0.5;
      tmp.lerp(blood.clone().lerp(bloodDeep, smooth(edge, 0, y) * 0.9), soak * 0.95).lerp(tide, ringK * soak);
    }
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  lathe.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  lathe.computeVertexNormals();
  g.add(new THREE.Mesh(lathe, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })));
  // 끈: 목을 두 번 감고 앞에서 매듭 · 늘어진 두 가닥(끝에 작은 매듭)
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x3e2a1a, roughness: 0.8, metalness: 0 });
  for (const [y, rr] of [[0.775, 0.152], [0.81, 0.148]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.021, 10, 48), cordMat);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    t.scale.set(1.06, 0.94, 1);
    g.add(t);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), cordMat);
  knot.position.set(0.04, 0.79, 0.155);
  g.add(knot);
  for (const [a, b, c, d] of [
    [[0.04, 0.78, 0.16], [0.09, 0.68, 0.27], [0.12, 0.56, 0.36], [0.13, 0.47, 0.41]],
    [[0.04, 0.78, 0.16], [0.0, 0.66, 0.29], [-0.04, 0.55, 0.38], [-0.03, 0.44, 0.43]],
  ]) {
    const path = new THREE.CatmullRomCurve3([a, b, c, d].map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.016, 8, false), cordMat));
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), cordMat);
    end.position.set(...d);
    g.add(end);
  }
  g.rotation.set(num('px', 0.28), num('py', -0.35), 0);
  return g;
}


// ── 찍기 ──
const small = document.createElement('canvas');
const ctx2d = small.getContext('2d');
/** 틀 fr = { x0, x1, y0, y1 } (세계 좌표 — 정사영이라 x · y 가 곧 화면) 를 W × H 비에 맞춰 넓혀 찍는다. 틀이 없으면 그 물건에 꼭 맞게 */
function shoot(obj, W, H, fr = null) {
  scene.add(obj);
  obj.updateMatrixWorld(true);
  if (!fr) { const b = new THREE.Box3().setFromObject(obj, true); fr = { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y }; }
  const cx = (fr.x0 + fr.x1) / 2, cy = (fr.y0 + fr.y1) / 2, aspect = W / H;
  const hy = Math.max((fr.y1 - fr.y0) / 2, (fr.x1 - fr.x0) / 2 / aspect) * (1 + PAD * 2), hx = hy * aspect;
  const cam = new THREE.OrthographicCamera(-hx, hx, hy, -hy, 0.01, 20);
  cam.position.set(cx, cy, 5);
  cam.lookAt(cx, cy, 0);
  renderer.setSize(W * SS, H * SS);
  renderer.render(scene, cam);
  small.width = W; small.height = H;
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = 'high';
  ctx2d.clearRect(0, 0, W, H);
  ctx2d.drawImage(renderer.domElement, 0, 0, W, H);
  scene.remove(obj);
  // 투명 여백: 보이는 화소(알파 > 8)의 상자와 그림 가장자리 사이 가장 좁은 곳 (px) — 물건이 틀에 닿지 않았나
  const a = ctx2d.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { url: small.toDataURL('image/webp', QUALITY), pad: Math.min(x0, y0, W - 1 - x1, H - 1 - y1) };
}

const jobs = [];
for (const s of BOOK_SCHOOLS) for (const T of BOOK_TIERS) {
  const id = `${s}_${T.tier}`;
  // 책 그림 세로 = 336 (책 칸 32 × 42 비). ?bookh=256 이면 정사각형 — 그때는 lobby.css .book-svg 에 object-fit: contain 이 있어야 안 찌그러진다
  if (want.includes('books') || want.includes(id)) jobs.push({ path: `books/${id}.webp`, label: `${s} ${ROMAN[T.tier]}`, w: 256, h: num('bookh', 336), school: s, build: () => buildBook(s, T.tier, T.rarity), show: [[32, 42], [26, 34]] });
}
if (want.includes('coins')) jobs.push({ path: 'wallet/coins.webp', label: '금화', w: 256, h: 256, build: buildCoins, show: [[20, 20], [14, 14], [9, 9]] });
if (want.includes('pouch')) jobs.push({ path: 'wallet/pouch.webp', label: '머리', w: 256, h: 256, build: buildPouch, show: [[20, 20], [14, 14]] });

// 틀: 유파마다 다섯 장(I~V)을 모두 담는 한 틀 — 한 유파 안에선 같은 배율이라 급마다 볼륨(두께 · 높이 · 길이 · 대쪽 수) 차이가 그대로 보이고,
//  유파끼리는 저마다 칸을 채운다(대기실 별자리 판은 유파 탭 하나씩 보여 준다). 몇 장만 찍어도 틀은 같다
const bookFrame = {};
for (const s of BOOK_SCHOOLS) {
  if (!jobs.some((j) => j.school === s)) continue;
  const f = (bookFrame[s] = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  for (const T of BOOK_TIERS) {
    const b = buildBook(s, T.tier, T.rarity);
    b.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b, true);
    f.x0 = Math.min(f.x0, box.min.x); f.x1 = Math.max(f.x1, box.max.x);
    f.y0 = Math.min(f.y0, box.min.y); f.y1 = Math.max(f.y1, box.max.y);
  }
}

const list = [];
const out = document.getElementById('out'), real = document.getElementById('real');
for (const j of jobs) {
  const obj = j.build(), { url, pad } = shoot(obj, j.w, j.h, j.school ? bookFrame[j.school] : null);
  list.push({ path: j.path, url, w: j.w, h: j.h, bytes: Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4), pad });
  const fig = document.createElement('figure'), img = document.createElement('img'), cap = document.createElement('figcaption');
  img.src = url; img.style.width = `${j.w / 2}px`; img.style.height = `${j.h / 2}px`;
  cap.textContent = j.label;
  fig.append(img, cap); out.append(fig);
  const row = document.createElement('div'); // 실제 화면 크기 (CSS px — 폰 화소 비 3 이면 그대로 폰 모습)
  row.className = 'real-row';
  for (const [w, h] of j.show) { const im = document.createElement('img'); im.src = url; im.style.width = `${w}px`; im.style.height = `${h}px`; row.append(im); }
  real.append(row);
}
window.thumbs = { done: true, list, bookFrame };
