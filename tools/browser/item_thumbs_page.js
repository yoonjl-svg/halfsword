// ─────────────────────────────────────────────────────────────
//  아이템 · 재화 그림 (사장님 10/16 14:4x ③ · 15:3x ⑦⑧⑨ · 16:1x — docs/import/item_art_2026-10-16.md · 스타일 규칙 '겉은 픽셀, 속은 매끈' docs/design_language.md §5)
//  무기 카드 그림(weapon_thumbs_page.js)과 같은 집안: 같은 빛 넷 · 같은 금속 재질(weapon_looks.js metalMat — 무기 반사 환경) · 정사영 카메라 ·
//  두 배로 그려 곱게 줄인 투명 배경 webp. 모형은 여기서 간단히 짓는다(게임 모형이 없는 물건이라).
//   · 스킬북 25 장 books/<유파>_<급>.webp — 256 × 336 (책 칸 .book-thumb 32 × 42 와 같은 비 — CSS 가 칸을 꽉 채워 늘이므로 비가 같아야 안 찌그러진다)
//     사장님 16:1x '유파별로 스킬북을 그리고 급수 별로 종이나 표지 색, 끈 색, 볼륨 등의 디테일을 달리 … 무기 섬네일이 그렇듯 … 사실성을 가진 외형':
//      유파마다 책 꼴 하나 — 독일 펜히트부흐(나무 판자 가죽 · 놋쇠 귀 · 걸쇠) · 이탈리아 르네상스 논고(붉은 모로코 가죽 · 금박 틀 · 비단 끈) ·
//      이베리아 데스트레사 논고(부드러운 양피지 · 가죽 끈 · 먹 문양) · 일본 和綴じ(쪽빛 종이 표지 · 실로 꿰맨 오른쪽 · 제목 쪽지) · 동방 線裝(천 갑 · 뼈 걸쇠 · 위로 보이는 책 몇 권)
//      급(I~V)마다: 종이(새 크림 → 크림 → 바랜 상아 → 금 가장자리) · 표지 색(점점 짙고 깊게) · 두께(급이 높을수록 두껍게) · 쇠붙이 · 금박이 늘어남 ·
//      등급 색(index.html :root --tier-* · 언커먼은 entrance_type.css --tier-uncommon) = 급 숫자 + 그 유파의 끈(가름끈 · 비단 끈 · 가죽 끈 · 꿰맨 실 · 걸쇠 끈)
//      유파마다 다섯 권을 같은 틀(같은 배율 · 표지가 같은 자리)로 찍는다 — 급마다 두께 차이가 그대로 보이게
//   · 금화 wallet/coins.webp — 256 × 256: 금화 여덟이 아무렇게나 쌓임(다섯 쌓임 · 하나 기댐 · 흩어진 둘)
//   · 머리(천 주머니) wallet/pouch.webp — 256 × 256: 불룩한 천 주머니 · 묶은 끈 · 아래가 살짝 피에 젖음(사장님 ⑧)
//  ?ids=books,coins,pouch 또는 german_3 처럼 몇 개만. 결과는 window.thumbs = { done, list: [{ path, url, w, h, bytes }] }
//  구도 시험: ?by=0.5 (책 돌림, rad) ?bx=0.2 (책 위 숙임) ?cx=0.78 (금화 내려다보기) ?px=0.28 (주머니 내려다보기) ?soak=0.22 (피 높이)
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

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? +params.get(k) : d);
const want = params.get('ids') ? params.get('ids').split(',') : ['books', 'coins', 'pouch'];

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

// ── 2D 모양 도우미 (문양 · 숫자 · 틀 · 쇠붙이) ──
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
/** 모양을 돌리고 옮긴다 (일본 칼을 비스듬히) */
function turn(shape, ang, ox = 0, oy = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), pts = shape.getPoints(32);
  return poly(pts.map((p) => [p.x * c - p.y * s + ox, p.x * s + p.y * c + oy]));
}

// ── 유파 문양: 칼 다섯 (y = −1 칼자루 끝 ~ +1 칼끝 · 옛 skill_tree.js EMBLEMS 의 12 × 12 도트 칼을 매끈하게) ──
//  책 칸(폰 32 × 42 css)에서 획이 안 사라지게 굵게: 칼날 폭 ≥ 화면 약 1 css px · 코등이 · 폼멜은 덩어리로
const EMBLEM = {
  // 독일 — 롱소드: 곧은 양날 · 곧은 코등이(끝 구슬) · 바퀴 폼멜
  german: () => [
    poly([[-0.11, -0.27], [-0.088, 0.78], [0, 1], [0.088, 0.78], [0.11, -0.27]]),
    rect(-0.44, -0.4, 0.44, -0.26), disc(-0.45, -0.33, 0.085), disc(0.45, -0.33, 0.085),
    poly([[-0.075, -0.4], [-0.064, -0.68], [0.064, -0.68], [0.075, -0.4]]),
    ring(0, -0.8, 0.05, 0.15),
  ],
  // 이탈리아 — 레이피어: 가는 칼날 · 고리 막이 · 긴 코등이 · 손가락 보호 활 · 달걀 폼멜
  italian: () => [
    poly([[-0.062, -0.32], [-0.046, 0.86], [0, 1], [0.046, 0.86], [0.062, -0.32]]),
    ring(0, -0.33, 0.1, 0.2),
    rect(-0.55, -0.375, 0.55, -0.285), disc(-0.56, -0.33, 0.07), disc(0.56, -0.33, 0.07),
    poly([[-0.064, -0.37], [-0.056, -0.7], [0.056, -0.7], [0.064, -0.37]]),
    stroke(curve((t) => [0.2 + 0.13 * Math.sin(t * Math.PI) - 0.14 * t, -0.37 - 0.4 * t]), 0.07),
    ellipse(0, -0.8, 0.1, 0.115),
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
  // 일본 — 우치가타나: 휜 칼날(칼끝이 오른쪽 위) · 둥근 날밑 · 긴 손잡이
  japanese: () => {
    const bend = (t) => [-0.14 * t * t, -0.2 + 1.2 * t]; // 날밑(0) → 칼끝(1) — 칼등 쪽으로 휜다
    const parts = [
      stroke(curve(bend), (t) => (t < 0.85 ? 0.15 - 0.025 * t : 0.129 * Math.sqrt(Math.max(0, (1 - t) / 0.15)))),
      rect(-0.21, -0.29, 0.21, -0.2),
      rect(-0.085, -0.21, 0.085, -0.14),
      stroke(curve((t) => [0.025 * t, -0.29 - 0.6 * t]), 0.12),
      stroke(curve((t) => [0.015 + 0.008 * t, -0.88 - 0.07 * t], 4), 0.14),
    ];
    return parts.map((s) => turn(s, -0.6, 0.03, 0.02));
  },
  // 동방 — 검(지엔): 곧은 칼날(가운데 등줄) · 날개처럼 올라간 코등이 · 둥근 폼멜 · 술
  chinese: () => [
    (() => { const s = new THREE.Shape(); s.moveTo(-0.1, -0.25); s.lineTo(-0.085, 0.79); s.quadraticCurveTo(-0.065, 0.93, 0, 1); s.quadraticCurveTo(0.065, 0.93, 0.085, 0.79); s.lineTo(0.1, -0.25); s.closePath(); return s; })(),
    stroke(curve((t) => { const x = -0.31 + 0.62 * t; return [x, -0.32 + 0.15 * (x / 0.31) ** 2]; }, 32), 0.11),
    poly([[-0.068, -0.35], [-0.058, -0.62], [0.058, -0.62], [0.068, -0.35]]),
    disc(0, -0.69, 0.1),
    stroke(curve((t) => [0.04 + 0.07 * t, -0.76 - 0.08 * t], 8), 0.05),
    stroke(curve((t) => [0.11 + 0.035 * t, -0.82 - 0.18 * t], 10), (t) => 0.07 + 0.1 * t),
  ],
};
// 칼날 가운데 등줄 (문양보다 한 겹 높이 — 빛을 받아 칼날이 납작한 띠로 안 보이게): [x0, y0, x1, y1]
const RIDGE = { german: [-0.016, -0.24, 0.016, 0.82], italian: null, iberian: [-0.018, -0.16, 0.018, 0.82], japanese: null, chinese: [-0.015, -0.22, 0.015, 0.85] };

// ── 급 숫자 I ~ V (세리프 있는 로마 숫자 — 글꼴 없이 모양으로: 작은 크기에서도 획이 안 뭉개지게 굵게) ── 높이 1, 가운데 x = 0
function numeralShapes(roman) {
  const ADV = { I: 0.5, V: 0.96 }, GAP = 0.05, glyphs = roman.split('');
  let x = -(glyphs.reduce((n, g) => n + ADV[g], 0) + GAP * (glyphs.length - 1)) / 2;
  const out = [];
  for (const g of glyphs) {
    const c = x + ADV[g] / 2;
    if (g === 'I') out.push(rect(c - 0.13, 0, c + 0.13, 1), rect(c - 0.25, 0, c + 0.25, 0.14), rect(c - 0.25, 0.86, c + 0.25, 1));
    else out.push(poly([[c - 0.42, 1], [c - 0.17, 1], [c, 0.4], [c + 0.17, 1], [c + 0.42, 1], [c + 0.1, 0], [c - 0.1, 0]]), rect(c - 0.48, 0.86, c - 0.12, 1), rect(c + 0.12, 0.86, c + 0.48, 1));
    x += ADV[g] + GAP;
  }
  return out;
}
const numeralWidth = (roman) => roman.split('').reduce((n, g) => n + (g === 'I' ? 0.5 : 0.96), 0) + 0.05 * (roman.length - 1);

/**
 * 표지에 도드라진 모양 (금박 · 숫자 · 틀 · 쇠붙이) — 표지 앞면(z = 0)에서 앞으로. 크기는 모양 좌표 그대로(부르는 쪽이 scale).
 *  edge: 눌러 찍은 자국 — 같은 모양을 grow 만큼 넓혀 짙은 표지색으로 밑에 깐다(작은 화면에서 금박 가장자리가 표지에 안 묻히게)
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
/** 표지 위 판 모양 하나 (책 단위 그대로 — 틀 · 쇠붙이 · 쪽지) */
function plate(g, shapes, mat, z, { depth = 0.003, bevel = 0.002 } = {}) {
  const r = relief(Array.isArray(shapes) ? shapes : [shapes], mat, { depth, bevel });
  r.position.z = z;
  g.add(r);
  return r;
}

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
// 쪽 가장자리 결 (종이 겹 — dir 'h' 가로줄 = 윗면 · 'v' 세로줄 = 앞마구리)
const edgeTex = (hex, dir) => cached(`e:${hex}:${dir}`, () => canvasTex(128, 128, (g, w, h) => {
  const r = rng(hex + (dir === 'h' ? 1 : 2));
  g.fillStyle = hexStr(hex); g.fillRect(0, 0, w, h);
  for (let i = 0; i < 128; i += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.07})`; if (dir === 'h') g.fillRect(0, i, w, 1); else g.fillRect(i, 0, 1, h); }
}));

// 재질 (모든 책이 같이 쓴다)
const goldMat = metalMat(0xf6c552, { rough: 0.34, metal: 0.6, env: 1.4 }); // 금박: 무기 금속에서 금속 기운을 조금 덜어 — 카메라를 보는 표지에서 칙칙한 올리브색이 되지 않게
// 금 가장자리 (쪽 결이 비치게) — 윗면은 밝은 하늘을 비춰 옅은 종이처럼 보이기 쉬워 바탕 금색을 짙게
const giltMat = metalMat(0xc48a2a, { rough: 0.3, metal: 0.78, env: 1.1, map: edgeTex(0xffffff, 'v') });
const giltTopMat = metalMat(0xc48a2a, { rough: 0.3, metal: 0.78, env: 1.1, map: edgeTex(0xffffff, 'h') });
const brassMat = metalMat(0xa7843f, { rough: 0.36, metal: 0.82 }); // 놋쇠 귀 · 걸쇠
const inkMat = plainMat(0x2b1a10, 0.5); // 먹 (양피지 위 문양 · 틀)
const ivoryMat = plainMat(0xefe4cc, 0.32); // 뼈 걸쇠 · 제목 쪽지
const numeralMat = Object.fromEntries(Object.entries(TIER_COLOR).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.15, emissive: c, emissiveIntensity: 0.16 })]));
const tierCordMat = Object.fromEntries(Object.entries(TIER_COLOR).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.05, emissive: c, emissiveIntensity: 0.14, side: THREE.DoubleSide })]));

// 종이 (급마다): 유럽 책 — 새 크림 · 크림 · 바랜 상아 · 금 가장자리 둘 / 일본 · 동방 — 흰 한지 · 크림 · 상아 · 바랜 황갈 · 더 바랜 황갈
const PAPER_EU = [0, 0xf4eddc, 0xeadcbc, 0xdcc595, 'gilt', 'gilt'];
const PAPER_ASIA = [0, 0xf6f1e4, 0xefe5cc, 0xe4d3ad, 0xd8c08f, 0xcdb07a];

// ── 책 조각들 ──
/** 쪽 덩어리 (w × h × t) — spineX = 책등 쪽 끝. 왼쪽 묶음(유럽)이면 앞마구리가 +x, 오른쪽 묶음(일본 · 동방)이면 −x */
function pageBlock(g, x0, x1, h, t, paper, z = 0) {
  const top = paper === 'gilt' ? giltTopMat : cached(`pt:${paper}`, () => new THREE.MeshStandardMaterial({ map: edgeTex(paper, 'h'), roughness: 0.92 }));
  const side = paper === 'gilt' ? giltMat : cached(`ps:${paper}`, () => new THREE.MeshStandardMaterial({ map: edgeTex(paper, 'v'), roughness: 0.92 }));
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
/** 둥근 책등 (반 원기둥을 납작하게 · 도드라진 띠 bands 개) — x = 책등 쪽 끝, dir = −1 왼쪽 · +1 오른쪽 */
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
function ribbon(g, mat, x, yTop, len, z = 0, w = 0.05) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, -len); s.lineTo(0, -len + w * 0.7); s.lineTo(-w / 2, -len); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
  m.position.set(x, yTop, z);
  m.rotation.set(-0.12, 0.25, 0.06);
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
/** 앞마구리 끈 (비단 끈 — 납작 · 가죽 끈 — 둥근 끈 끝 매듭) */
function ties(g, w, z, mat, ys, round = false) {
  for (const y of ys) {
    if (round) {
      const path = new THREE.CatmullRomCurve3([[w / 2 - 0.02, y, z + 0.002], [w / 2 + 0.02, y - 0.006, z - 0.004], [w / 2 + 0.05, y - 0.04, z - 0.01], [w / 2 + 0.055, y - 0.085, z - 0.012]].map((p) => new THREE.Vector3(...p)));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 16, 0.009, 8, false), mat));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mat); k.position.set(w / 2 + 0.055, y - 0.088, z - 0.012); g.add(k);
    } else {
      const s = new THREE.Shape(), tw = 0.034;
      s.moveTo(w / 2 - 0.03, y + tw / 2); s.lineTo(w / 2 + 0.03, y + tw / 2); s.quadraticCurveTo(w / 2 + 0.05, y + tw / 2, w / 2 + 0.05, y - 0.02);
      s.lineTo(w / 2 + 0.05, y - 0.09); s.lineTo(w / 2 + 0.05 - tw / 2, y - 0.07); s.lineTo(w / 2 + 0.05 - tw, y - 0.09); s.lineTo(w / 2 + 0.05 - tw, y - 0.02); s.lineTo(w / 2 - 0.03, y - tw / 2); s.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat); m.position.z = z + 0.002; g.add(m);
    }
  }
}
/** 금박 문양 + 급 숫자. o = { cx, ey, eh, ny, nh, press(눌린 자국 색), ink(먹 문양), label(숫자 밑 딱지 재질) } */
function coverMarks(g, school, tier, rarity, z, o) {
  const emMat = o.ink ? inkMat : goldMat, pressM = o.ink ? null : plainMat(o.press, 0.7);
  const em = relief(EMBLEM[school](), emMat, { depth: (o.ink ? 0.0015 : 0.004) / o.eh, bevel: (o.ink ? 0.0008 : 0.003) / o.eh, edge: pressM, grow: 0.034 });
  em.name = 'emblem'; // 자리 점검이 읽는다 (layoutCheck)
  em.scale.set(o.eh, o.eh, o.eh);
  em.position.set(o.cx, o.ey, z);
  g.add(em);
  const r = RIDGE[school];
  if (r && !o.ink) {
    const ridge = relief([rect(...r)], goldMat, { depth: 0.007 / o.eh, bevel: 0.0015 / o.eh });
    ridge.scale.set(o.eh, o.eh, o.eh);
    ridge.position.set(o.cx, o.ey, z);
    g.add(ridge);
  }
  const roman = ROMAN[tier];
  if (o.label) { // 숫자 밑 가죽 딱지 (밝은 양피지 위에서 밝은 등급 색이 읽히게)
    const lw = numeralWidth(roman) * o.nh / 2 + 0.035, lh = o.nh / 2 + 0.03, ly = o.ny + o.nh / 2;
    plate(g, roundRect(o.cx - lw, ly - lh, o.cx + lw, ly + lh, 0.018), o.label, z, { depth: 0.003, bevel: 0.002 }).name = 'label';
    z += 0.005;
  }
  const nm = relief(numeralShapes(roman), numeralMat[rarity], { depth: 0.005 / o.nh, bevel: 0.003 / o.nh, edge: plainMat(o.label ? 0x1a0c08 : o.press, 0.7), grow: 0.055 });
  nm.name = 'numeral';
  nm.scale.set(o.nh, o.nh, o.nh);
  nm.position.set(o.cx, o.ny, z);
  g.add(nm);
}
const LAYOUT = { cx: 0.012, ey: 0.085, eh: 0.31, ny: -0.425, nh: 0.15 }; // 표지 자리 (책 높이 1 기준): 문양 가운데 · 반 높이 · 숫자 아래 끝 · 높이

// ── 유파 다섯 ──
// 독일 — 펜히트부흐: 나무 판자에 씌운 갈색 가죽 · 민무늬 눌러 찍은 테 · 둥근 책등 띠 넷 · 가름끈(등급 색)
//  급: I 밝은 송아지 가죽 · 쇠 없음 → II 바깥 귀 → III 짙은 가죽 · 귀 + 걸쇠 하나 · 테 둘 → IV 네 귀 · 걸쇠 둘 · 금 가장자리 → V 가장 짙은 가죽 · 귀 징 · 금 가장자리
function germanBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.74, h = 1, bt = 0.04, pt = [0, 0.1, 0.125, 0.15, 0.175, 0.2][tier];
  const hex = [0, 0x8b5a34, 0x704327, 0x5c331c, 0x4b2818, 0x3f2115][tier], fz = pt / 2 + bt;
  boards(g, w, h, bt, pt, surfaceMat('leather', hex, 11 + tier), plainMat(hex, 0.6));
  pageBlock(g, -w / 2 + 0.02, w / 2 - 0.022, h - 0.044, pt, PAPER_EU[tier]);
  roundSpine(g, h, fz, -w / 2, plainMat(shade(hex, 0.8), 0.55), 4);
  const blind = plainMat(shade(hex, 0.5), 0.7);
  plate(g, frameShape(-w / 2 + 0.03, -h / 2 + 0.03, w / 2 - 0.03, h / 2 - 0.03, 0.01), blind, fz, { depth: 0.0015, bevel: 0 });
  if (tier >= 3) plate(g, frameShape(-w / 2 + 0.052, -h / 2 + 0.052, w / 2 - 0.052, h / 2 - 0.052, 0.007), blind, fz, { depth: 0.0015, bevel: 0 });
  if (tier >= 2) corners(g, w, h, fz, brassMat, tier >= 4 ? [1, -1] : [1], tier >= 5);
  if (tier >= 3) clasps(g, w, fz, brassMat, plainMat(shade(hex, 0.7), 0.6), tier >= 4 ? [0.27, -0.27] : [0.02]);
  ribbon(g, tierCordMat[rarity], -w / 2 + 0.17, -h / 2 + 0.06, 0.13, 0.0);
  coverMarks(g, 'german', tier, rarity, fz, { ...LAYOUT, ny: -0.42, nh: 0.17, press: shade(hex, 0.3) });
  g.userData.cover = { w, h }; // 표지 네모 (자리 점검)
  return g;
}
// 이탈리아 — 르네상스 논고: 붉은 모로코 가죽 · 얇은 판자 · 납작한 책등 · 금박 틀 · 앞마구리 비단 끈 둘(등급 색)
//  급: I 바랜 붉은 가죽 · 민무늬 테 → II 벽돌색 · 금 테 하나 → III 진홍 · 금 테 둘 · 책등 금줄 → IV 검붉은 · 네 귀 꽃 · 금 가장자리 → V 가장 짙은 · 테 셋 · 큰 꽃 · 금 가장자리
function italianBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.72, h = 1, bt = 0.028, pt = [0, 0.09, 0.11, 0.13, 0.15, 0.17][tier];
  const hex = [0, 0xa04c3a, 0x8e3124, 0x7c2120, 0x64171a, 0x521116][tier], fz = pt / 2 + bt;
  boards(g, w, h, bt, pt, surfaceMat('leather', hex, 21 + tier), plainMat(hex, 0.58), 0.01);
  pageBlock(g, -w / 2 + 0.018, w / 2 - 0.02, h - 0.04, pt, PAPER_EU[tier]);
  const spineM = plainMat(shade(hex, 0.82), 0.55);
  const sp = new THREE.Mesh(new RoundedBoxGeometry(0.036, h, pt + bt * 2 + 0.004, 3, 0.012), spineM);
  sp.position.x = -w / 2 + 0.006;
  g.add(sp);
  if (tier >= 3) for (const y of [0.3, 0.1, -0.1, -0.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, pt + bt * 2 - 0.02), goldMat); b.position.set(-w / 2 - 0.013, y, 0); g.add(b); }
  const lineM = tier >= 2 ? goldMat : plainMat(shade(hex, 0.5), 0.7);
  if (tier >= 5) plate(g, frameShape(-w / 2 + 0.022, -h / 2 + 0.022, w / 2 - 0.022, h / 2 - 0.022, 0.006), goldMat, fz, { depth: 0.0015, bevel: 0.001 });
  plate(g, frameShape(-w / 2 + 0.036, -h / 2 + 0.036, w / 2 - 0.036, h / 2 - 0.036, 0.01), lineM, fz, { depth: 0.0018, bevel: 0.001 });
  if (tier >= 3) plate(g, frameShape(-w / 2 + 0.058, -h / 2 + 0.058, w / 2 - 0.058, h / 2 - 0.058, 0.006), goldMat, fz, { depth: 0.0015, bevel: 0.001 });
  if (tier >= 4) { // 네 귀 꽃 (금박 잎 넷)
    const f = tier >= 5 ? 0.05 : 0.036;
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const x = sx * (w / 2 - 0.058 - 0.004), y = sy * (h / 2 - 0.058 - 0.004);
      plate(g, poly([[x, y], [x - sx * f, y - sy * f * 0.35], [x - sx * f * 0.75, y - sy * f * 0.75], [x - sx * f * 0.35, y - sy * f]]), goldMat, fz, { depth: 0.002, bevel: 0.0012 });
    }
  }
  ties(g, w, fz - 0.004, tierCordMat[rarity], [0.3, -0.3]);
  coverMarks(g, 'italian', tier, rarity, fz, { ...LAYOUT, eh: 0.3, ey: 0.08, ny: -0.415, nh: 0.165, press: shade(hex, 0.3) });
  g.userData.cover = { w, h }; // 표지 네모 (자리 점검)
  return g;
}
// 이베리아 — 데스트레사 논고: 판자 없는 부드러운 양피지 표지(쪽보다 조금 크다) · 둥근 책등 · 먹 문양(밝은 양피지 위에선 금박보다 먹이 작은 크기에서 읽힌다) · 숫자 밑 가죽 딱지 · 가죽 끈 둘(등급 색)
//  급: 새 흰 양피지 → 상아 · 먹 테 → 따뜻한 양피지 · 먹 테 둘 → 바랜 금빛 양피지 · 금 테 · 금 가장자리 → 더 바랜 양피지 · 금 테 둘
function iberianBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.72, h = 0.98, vt = 0.012, pt = [0, 0.08, 0.1, 0.12, 0.14, 0.16][tier];
  const hex = [0, 0xf0e8d4, 0xebdfc3, 0xe2cfa6, 0xd9bf8e, 0xd0b07a][tier], fz = pt / 2 + vt;
  const vel = surfaceMat('vellum', hex, 31 + tier), side = plainMat(shade(hex, 0.92), 0.5);
  boards(g, w, h, vt, pt, vel, side, 0.005);
  pageBlock(g, -w / 2 + 0.015, w / 2 - 0.03, h - 0.05, pt, PAPER_EU[tier]);
  roundSpine(g, h, fz, -w / 2, side, 0, 0.36);
  if (tier >= 2) {
    const lm = tier >= 4 ? goldMat : inkMat;
    plate(g, frameShape(-w / 2 + 0.035, -h / 2 + 0.035, w / 2 - 0.035, h / 2 - 0.035, 0.008), lm, fz, { depth: 0.0012, bevel: 0 });
    if (tier === 3 || tier >= 5) plate(g, frameShape(-w / 2 + 0.054, -h / 2 + 0.054, w / 2 - 0.054, h / 2 - 0.054, 0.005), lm, fz, { depth: 0.0012, bevel: 0 });
  }
  ties(g, w, fz - 0.006, tierCordMat[rarity], [0.27, -0.27], true);
  coverMarks(g, 'iberian', tier, rarity, fz, { ...LAYOUT, eh: 0.3, ey: 0.11, ny: -0.415, nh: 0.14, ink: true, press: shade(hex, 0.32), label: plainMat(0x5a2117, 0.55) });
  g.userData.cover = { w, h }; // 표지 네모 (자리 점검)
  return g;
}
// 일본 — 和綴じ(四つ目綴じ): 판자 없는 쪽빛 종이 표지 · 오른쪽을 실로 꿰맴(실 = 등급 색) · 왼쪽 위 제목 쪽지 · 왼쪽(앞마구리)에 접힌 종이 겹
//  급: 옅은 쪽빛 → 쪽빛 → 짙은 감색 · 귀 천(무명) → 남색 · 금박 조각 종이 · 금빛 귀 천 → 검은 쪽빛 · 금박 조각 많이 · 금빛 귀 천
function japaneseBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.68, h = 1, ct = 0.007, pt = [0, 0.05, 0.065, 0.08, 0.095, 0.11][tier];
  const hex = [0, 0x5d7189, 0x3e5879, 0x2c4064, 0x23314f, 0x1c253c][tier], fz = pt / 2 + ct;
  const paper = surfaceMat('paper', hex, 41 + tier, { flecks: tier >= 5 ? 260 : tier >= 4 ? 120 : 0 }), side = plainMat(shade(hex, 0.9), 0.8);
  boards(g, w, h, ct, pt, paper, side, 0.003);
  pageBlock(g, -w / 2 + 0.004, w / 2 - 0.004, h - 0.008, pt, PAPER_ASIA[tier]);
  // 꿰맨 실: 오른쪽에서 조금 안쪽 세로 한 줄 + 구멍마다 가장자리로 감기는 가로 실 넷
  const xs = w / 2 - 0.05, thread = tierCordMat[rarity], tz = fz + 0.004;
  const tube = (pts, r = 0.0095) => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 8, r, 8, false), thread));
  tube([[xs, h / 2 + 0.004, tz - 0.003], [xs, 0, tz], [xs, -h / 2 - 0.004, tz - 0.003]]);
  for (const y of [0.36, 0.12, -0.12, -0.36]) tube([[xs, y, tz], [w / 2 - 0.01, y, tz], [w / 2 + 0.006, y, fz - 0.006]]);
  // 귀 천 (III 무명 · IV~V 금빛 비단) — 꿰맨 쪽 위 · 아래 귀
  if (tier >= 3) for (const sy of [1, -1]) plate(g, rect(w / 2 - 0.075, sy > 0 ? h / 2 - 0.07 : -h / 2, w / 2 + 0.002, sy > 0 ? h / 2 : -h / 2 + 0.07), tier >= 4 ? surfaceMat('cloth', 0xb0883c, 7, { brocade: 0.8 }) : plainMat(0x8a7a5e, 0.85), fz, { depth: 0.002, bevel: 0.001 });
  // 제목 쪽지 (왼쪽 위 — 흰 종이 · 가는 테 · 먹 글자 셋)
  const sx0 = -w / 2 + 0.05, sx1 = sx0 + 0.12, sy1 = h / 2 - 0.05, sy0 = sy1 - 0.38;
  plate(g, rect(sx0, sy0, sx1, sy1), ivoryMat, fz, { depth: 0.002, bevel: 0.001 }); // 쪽지 윗면 = fz + 0.003 — 테 · 글자는 그 위에
  plate(g, frameShape(sx0 + 0.012, sy0 + 0.012, sx1 - 0.012, sy1 - 0.012, 0.006), inkMat, fz + 0.0032, { depth: 0.0008, bevel: 0 });
  // 먹 글자 셋 — 붓 획 몇 개(가로 · 세로 · 삐침)로 글자처럼 (네모 덩어리면 필름 구멍처럼 보인다)
  const mx = (sx0 + sx1) / 2, st = 0.011;
  [[[-0.03, 0.022, 0.03, 0.022], [-0.034, -0.004, 0.034, -0.004], [0, 0.04, 0, -0.04]], [[-0.03, 0.03, 0.03, 0.03], [-0.02, -0.035, 0.024, 0.012], [0.024, -0.035, -0.02, 0.012]], [[-0.032, 0.03, -0.032, -0.03], [-0.032, 0.03, 0.03, 0.03], [-0.032, -0.006, 0.026, -0.006], [-0.032, -0.03, 0.03, -0.03]]].forEach((strokes, i) => {
    const y = sy1 - 0.085 - i * 0.105;
    plate(g, strokes.map(([ax, ay, bx, by]) => stroke([[mx + ax, y + ay], [mx + bx, y + by]], st)), inkMat, fz + 0.0032, { depth: 0.0008, bevel: 0 });
  });
  coverMarks(g, 'japanese', tier, rarity, fz, { ...LAYOUT, cx: 0.03, ey: 0.035, eh: 0.3, ny: -0.42, nh: 0.16, press: shade(hex, 0.35) });
  g.userData.cover = { w, h }; // 표지 네모 (자리 점검)
  return g;
}
// 동방 — 線裝을 담은 천 갑(函套): 천 씌운 판자 넷(위 · 아래는 열려 책 머리가 보인다) · 오른쪽 뼈 걸쇠 둘과 끈(등급 색) · 안에 든 책 권수 = 두께
//  급: 옅은 청자빛 천 · 한 권 → 비취빛 · 두 권 → 짙은 초록 · 두 권(두껍게) → 검푸른 초록 무늬 비단 · 세 권 → 가장 짙은 초록 금빛 무늬 비단 · 네 권
function chineseBook(tier, rarity) {
  const g = new THREE.Group(), w = 0.7, h = 1, bt = 0.022, [nv, vt] = [0, [1, 0.09], [2, 0.065], [2, 0.08], [3, 0.065], [4, 0.058]][tier], inner = nv * vt;
  const hex = [0, 0x617f70, 0x40705a, 0x2e5846, 0x244738, 0x1d392d][tier], fz = inner / 2 + bt;
  const cloth = surfaceMat('cloth', hex, 51 + tier, { brocade: tier >= 5 ? 0.5 : tier >= 4 ? 0.3 : 0 }), side = plainMat(shade(hex, 0.85), 0.88);
  boards(g, w, h, bt, inner, cloth, side, 0.006);
  for (const sx of [1, -1]) { const p = new THREE.Mesh(new RoundedBoxGeometry(bt, h, inner + 0.002, 2, 0.006), side); p.position.x = sx * (w / 2 - bt / 2); g.add(p); }
  // 안에 든 책: 권마다 얇은 쪽빛 표지 둘 사이 종이 (위에서 줄무늬로 보인다)
  const volCover = plainMat(0x34465e, 0.8);
  for (let i = 0; i < nv; i++) {
    const z = -inner / 2 + vt * (i + 0.5);
    pageBlock(g, -w / 2 + bt + 0.004, w / 2 - bt - 0.004, h - 0.024, vt - 0.01, PAPER_ASIA[tier], z);
    for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w - bt * 2 - 0.006, h - 0.02, 0.004), volCover); c.position.z = z + s * (vt / 2 - 0.004); g.add(c); }
  }
  // 뼈 걸쇠 둘 (오른쪽 — 세로 막대) + 걸쇠를 감은 끈 (등급 색)
  for (const y of [0.25, -0.25]) {
    const peg = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.06, 4, 10), ivoryMat);
    peg.position.set(w / 2 - 0.075, y, fz + 0.016);
    g.add(peg);
    const cord = new THREE.CatmullRomCurve3([[w / 2 + 0.004, y + 0.012, fz - 0.004], [w / 2 - 0.04, y + 0.014, fz + 0.01], [w / 2 - 0.09, y + 0.01, fz + 0.012], [w / 2 - 0.1, y - 0.012, fz + 0.012], [w / 2 - 0.05, y - 0.014, fz + 0.01], [w / 2 + 0.004, y - 0.012, fz - 0.004]].map((p) => new THREE.Vector3(...p)));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 24, 0.008, 8, false), tierCordMat[rarity]));
  }
  coverMarks(g, 'chinese', tier, rarity, fz, { ...LAYOUT, cx: -0.02, ey: 0.11, nh: 0.17, press: shade(hex, 0.32) }); // 술이 길어 문양을 조금 위로
  g.userData.cover = { w, h }; // 표지 네모 (자리 점검)
  return g;
}
const BOOK = { german: germanBook, italian: italianBook, iberian: iberianBook, japanese: japaneseBook, chinese: chineseBook };
/**
 * 자리 점검 (돌리기 전 책 좌표 — 표지 면 위): 급 숫자(+ 딱지)가 표지 안에 margin 만큼 들어와 있나 · 문양 아래 끝과 숫자 위 끝 사이 gap.
 *  눌린 자국까지 넣은 실제 보이는 넓이로 잰다. item_thumbs.mjs 가 기준(margin ≥ 0.035 · gap ≥ 0.015)을 못 넘으면 멈춘다
 */
function layoutCheck(book) {
  book.updateMatrixWorld(true);
  const { w, h } = book.userData.cover, box = (n) => { const o = book.getObjectByName(n); return o ? new THREE.Box3().setFromObject(o, true) : null; };
  const nb = box('numeral'), lb = box('label'), eb = box('emblem'), mark = lb ? nb.clone().union(lb) : nb;
  const margin = Math.min(mark.min.x + w / 2, w / 2 - mark.max.x, mark.min.y + h / 2, h / 2 - mark.max.y);
  return { margin: +margin.toFixed(3), gap: +(eb.min.y - mark.max.y).toFixed(3) };
}
/** 책 한 권 — 3/4 보기: 책등(왼쪽)이 보이게 돌리고 윗면(쪽 가장자리)이 보이게 앞으로 숙인다 (Euler XYZ = 먼저 y, 다음 x) */
function buildBook(school, tier, rarity) {
  const book = BOOK[school](tier, rarity);
  book.userData.check = layoutCheck(book);
  book.rotation.set(num('bx', 0.2), num('by', 0.5), 0);
  return book;
}

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

// 책 틀: 유파마다 다섯 권(I~V)을 모두 담는 한 틀 — 한 유파 안에선 같은 배율 · 표지가 같은 자리라 급마다 두께 차이가 그대로 보이고,
//  유파끼리는 저마다 칸을 채운다(대기실 별자리 판은 유파 탭 하나씩 보여 준다). 몇 장만 찍어도 틀은 같다
const bookFrame = {};
for (const s of BOOK_SCHOOLS) {
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
  list.push({ path: j.path, url, w: j.w, h: j.h, bytes: Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4), pad, ...(obj.userData.check ?? {}) });
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
