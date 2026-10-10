// 청람잔도의 먼 경치 — 구름 바다 위로 솟은 거대한 바위 기둥 무리(남중국 화강암·사암 봉우리 — 황산·장자제 같은 꼴)와
//  그 뒤 태산처럼 넓고 무거운 산덩이. 가까운 절벽·잔도는 stage_qinglan.js.
//  사장님 디자인 리뷰(10/10 21:0x '잔도 느낌이 안 나 … 기암절벽의 스케일이 남다른 태산') 로 다시 지었다.
//  처음 꼴(샛별 저장소 3d3ec11: 큰 강 협곡)은 docs/stages.md '청람잔도' 의 전/후 캡처에 남겼다.
//  모두 장식(물리 없음). 그림자를 드리우지 않는다(멀어서 해 그림자 범위 밖). 투명 재질은 안개 띠 둘뿐.
import * as THREE from 'three';
import { Kit, rng, canvasTex, limb } from './stage_kit.js';

export const CLOUD_Y = -48; // 구름 바다 높이 (싸우는 바닥 = 0)
const TAU = Math.PI * 2;

// Kit 은 넣은 모양을 복사한다 — 원본은 바로 푼다
class OwnedKit extends Kit {
  putM(bin, geo, color, matrix, options = {}) {
    try { return super.putM(bin, geo, color, matrix, options); }
    finally { geo.dispose(); }
  }
}

/** 절벽 벽의 바닥 곡선 (stage_qinglan.js 도 쓴다): 마루 뒤(|x| < 13)는 z = -11.5 로 곧고, 양끝은 뒤로 휘어 물러난다
 *  → 마루는 튀어나온 절벽 모서리에 매달린 꼴. 싸움 카메라가 x 축을 따라 보면 왼쪽엔 가까운 절벽 면, 앞·오른쪽엔 낭떠러지와 먼 봉우리 */
export const wallZ = (x) => -11.5 - Math.max(0, Math.abs(x) - 13) ** 2 * 0.006;
/** wallZ 의 기울기 dz/dx */
export const wallSlope = (x) => -Math.sign(x) * 2 * 0.006 * Math.max(0, Math.abs(x) - 13);

/** 바위 기둥 하나: 7각 기둥을 세로 홈·가로 지층·둥근 머리로 흔든다. 꼭짓점 색 = 사암 회황색 + 머리의 푸른 숲 */
function pillar(pos, col, x, z, rBot, top, seed) {
  const r = rng(seed);
  const SEG = 8, ROWS = 12, bottom = CLOUD_Y - 40;
  const twist = r() * TAU, lean = (r() - 0.5) * 0.06, leanA = r() * TAU;
  const ring = [];
  for (let j = 0; j <= ROWS; j++) {
    const t = j / ROWS;
    const y = THREE.MathUtils.lerp(bottom, top, t);
    // 곧게 선 기둥: 허리가 조금 들고 나며, 지층마다 턱(들쭉날쭉한 띠), 머리는 거의 판판(숲이 덮는다)
    const taper = (1 - 0.12 * t + 0.1 * Math.sin(t * 4.1 + seed)) * (j === ROWS ? 0.86 : 1);
    const strata = j % 3 === 1 ? 0.9 : 1 + 0.06 * (r() - 0.5);
    const row = [];
    for (let i = 0; i < SEG; i++) {
      const a = twist + (i / SEG) * TAU;
      const groove = 1 + 0.16 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + t * 4) + 0.2 * (r() - 0.5);
      const rr = rBot * taper * groove * strata;
      const ox = Math.cos(leanA) * lean * (y - bottom), oz = Math.sin(leanA) * lean * (y - bottom);
      row.push([x + ox + Math.cos(a) * rr, j === ROWS ? y + rBot * 0.05 * r() : y + (j ? (r() - 0.5) * 2 : 0), z + oz + Math.sin(a) * rr]);
    }
    ring.push(row);
  }
  const capY = top + rBot * 0.1;
  const cx = ring[ROWS].reduce((s, p) => s + p[0], 0) / SEG, cz = ring[ROWS].reduce((s, p) => s + p[2], 0) / SEG;
  // 기둥마다 바탕색이 조금씩 다르다(회황 사암 ~ 밝은 화강암). 세로 물 얼룩 띠, 가로 지층, 턱마다 풀, 머리는 숲
  const rock = new THREE.Color(), base = new THREE.Color(r() < 0.5 ? 0xa59a85 : 0xaaa79c).multiplyScalar(0.92 + r() * 0.14);
  const dark = new THREE.Color(0x5b5a54), green = new THREE.Color(0x4c7f3f);
  const push = (p) => {
    pos.push(p[0], p[1], p[2]);
    const u = (p[1] - bottom) / (top - bottom);
    const a = Math.atan2(p[2] - z, p[0] - x);
    const streak = Math.max(0, Math.sin(a * 4 + seed + Math.sin(p[1] * 0.05))) ** 3;
    // 홈(기둥 가운데에 가까운 꼭짓점)은 어둡게 — 해가 거의 머리 위라 그림자가 납작해서, 세로 면의 명암을 꼭짓점 색에 굽는다(무대 리뷰 10/10)
    const groove = THREE.MathUtils.clamp((Math.hypot(p[0] - x, p[2] - z) / rBot - 0.62) / 0.42, 0, 1);
    rock.copy(base).lerp(dark, 0.55 * streak + 0.12 * Math.sin(p[1] * 0.3 + seed) ** 2 + 0.38 * (1 - groove));
    if (Math.sin(p[1] * 0.18 + seed * 0.7) > 0.86 && u > 0.35) rock.lerp(green, 0.55); // 턱마다 풀·관목 띠
    if (u > 0.9) rock.lerp(green, Math.min(1, (u - 0.9) / 0.07)); // 머리의 숲
    col.push(rock.r, rock.g, rock.b);
  };
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < SEG; i++) {
    const a = ring[j][i], b = ring[j][(i + 1) % SEG], c = ring[j + 1][i], d = ring[j + 1][(i + 1) % SEG];
    push(a); push(c); push(b); push(b); push(c); push(d);
  }
  for (let i = 0; i < SEG; i++) { push(ring[ROWS][i]); push([cx, capY, cz]); push(ring[ROWS][(i + 1) % SEG]); }
  return { x: cx, y: capY, z: cz, r: rBot * 0.6 };
}

/** 휘어 자란 소나무(황산 소나무 꼴): 줄기가 바깥으로 눕고 납작한 잎 층이 겹친다. dir = 눕는 방향(라디안) */
export function cliffPine(K, x, y, z, scale, seed, dir = null) {
  const r = rng(seed);
  const a = dir ?? r() * TAU;
  K.push([x, y, z], 0, scale);
  const out = (k) => [Math.cos(a) * k, 0, Math.sin(a) * k];
  const p0 = [0, 0, 0];
  const p1 = [out(0.9)[0], 1.2, out(0.9)[2]];
  const p2 = [out(2.0)[0], 1.9 + r() * 0.4, out(2.0)[2]];
  limb(K, 'wood', p0, p1, 0.2, 0.15, 0x4e463a, {}, 6);
  limb(K, 'wood', p1, p2, 0.15, 0.09, 0x4e463a, {}, 6);
  const pads = [[p2[0], p2[1] + 0.25, p2[2], 1.7], [p1[0] - Math.cos(a) * 0.3, p1[1] + 0.55, p1[2] - Math.sin(a) * 0.3, 1.25], [p2[0] + Math.cos(a + 1.4) * 0.9, p2[1] - 0.1, p2[2] + Math.sin(a + 1.4) * 0.9, 1.1]];
  for (const [px, py, pz, rad] of pads) {
    const pts = [];
    for (let j = 0; j < 9; j++) {
      const b = (j / 9) * TAU, c = ((j + 1) / 9) * TAU;
      pts.push(px, py + 0.32, pz, px + Math.cos(b) * rad, py + Math.sin(b * 4) * 0.06, pz + Math.sin(b) * rad * 0.8, px + Math.cos(c) * rad, py + Math.sin(c * 4) * 0.06, pz + Math.sin(c) * rad * 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    K.put('leaf', g, r() < 0.5 ? 0x3d6b37 : 0x4f8040, undefined, undefined, 1, { vary: 0.1 });
  }
  K.pop();
}

/** 구름 바다 질감: 흰 뭉게구름 덩이와 옅은 푸른 그늘 */
function cloudTexture(seed, alpha) {
  const r = rng(seed);
  return canvasTex(512, 512, (g, w, h) => {
    if (!alpha) { g.fillStyle = '#dfe9ee'; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rad = 18 + r() * 70;
      for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        const shade = i % 5 === 0;
        grad.addColorStop(0, alpha ? `rgba(255,255,255,${0.16 + r() * 0.12})` : shade ? 'rgba(170,190,205,.32)' : 'rgba(255,255,255,.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
    }
  });
}

/** 태산 같은 넓은 산덩이: 앞뒤 두 줄 능선으로 된 큰 띠. 안개가 멀리 있는 만큼 옅게 만든다 */
function massif(pos, col, a0, a1, dist, height, seed, color) {
  const r = rng(seed);
  const n = 40, c = new THREE.Color(color), lo = new THREE.Color(0x56635c);
  const crest = [];
  for (let i = 0; i <= n; i++) crest.push(height * (0.55 + 0.45 * Math.sin((i / n) * Math.PI) ** 0.7) * (0.85 + 0.3 * r()));
  const pt = (i, row) => {
    const a = a0 + ((a1 - a0) * i) / n;
    const d = dist + (row ? 0 : -35);
    return [Math.cos(a) * d, row ? crest[i] : CLOUD_Y - 10, Math.sin(a) * d];
  };
  for (let i = 0; i < n; i++) {
    const A = pt(i, 0), B = pt(i + 1, 0), C = pt(i, 1), D = pt(i + 1, 1);
    for (const p of [A, C, B, B, C, D]) {
      pos.push(...p);
      const t = THREE.MathUtils.clamp((p[1] - CLOUD_Y) / (height - CLOUD_Y), 0, 1);
      const k = lo.clone().lerp(c, t);
      col.push(k.r, k.g, k.b);
    }
  }
}

export function buildQinglanVista(scene) {
  const r = rng(615211);
  const pos = [], col = [];
  const tops = [];
  // ① 바위 기둥 무리: 열린 쪽(절벽 벽 앞)에 세 겹 — 가까운 겹 45~110 m, 가운데 130~230 m, 먼 겹 260~470 m
  //  가까운 겹은 자리를 손으로 골랐다: 싸움 카메라가 처음 보는 쪽(+x, 조금 오른쪽)은 비워 구름 바다와 먼 겹이 보이게 하고, 양옆에서 화면을 잡는다
  const NEAR = [[0.78, 92, 8, 58], [1.3, 125, 6.5, 82], [1.95, 98, 9, 38], [2.55, 135, 7.5, 66], [-0.42, 150, 8.5, 48], [3.45, 118, 7, 52]];
  const layers = [
    { list: NEAR },
    { n: 12, d0: 175, d1: 285, r0: 8, r1: 15, h0: 30, h1: 120 },
    { n: 14, d0: 310, d1: 480, r0: 13, r1: 24, h0: 45, h1: 160 },
  ];
  for (const L of layers) {
    const spots = L.list ?? Array.from({ length: L.n }, (_, i) => [-0.55 + (Math.PI + 1.1) * ((i + 0.2 + r() * 0.6) / L.n), L.d0 + r() * (L.d1 - L.d0), L.r0 + r() * (L.r1 - L.r0), L.h0 + r() * (L.h1 - L.h0)]); // -0.55 ~ π+0.55 (절벽이 없는 쪽)
    for (const [a, d, rb, top] of spots) {
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z < wallZ(x) + 14) continue; // 절벽 벽 뒤로 들어가지 않게
      tops.push({ ...pillar(pos, col, x, z, rb, top, 7000 + tops.length * 31), near: L === layers[0] });
      // 큰 기둥 곁의 가는 기둥 (무리 지어 선다)
      if (r() < 0.6) {
        const ox = x + Math.cos(a + 1.6) * rb * 2.1, oz = z + Math.sin(a + 1.6) * rb * 2.1;
        if (oz > wallZ(ox) + 14) pillar(pos, col, ox, oz, rb * 0.45, top * 0.55 + CLOUD_Y * 0.1, 9100 + tops.length * 17);
      }
    }
  }
  // ② 태산 같은 산덩이 셋 (가장 먼 겹, 하늘을 가른다)
  massif(pos, col, 0.35, 1.25, 540, 175, 31, 0x7d8f8c);
  massif(pos, col, 1.1, 2.15, 560, 205, 37, 0x7a8b8b);
  massif(pos, col, 2.0, 2.85, 530, 160, 41, 0x80918e);
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  rock.name = 'qinglan-vista-peaks';
  scene.add(rock);
  // ③ 가까운 기둥 머리의 소나무 (가까운 겹만 — 먼 기둥은 꼭짓점 색의 숲으로 충분)
  const K = new OwnedKit(615223);
  let pines = 0;
  for (const t of tops) {
    const dist = Math.hypot(t.x, t.z);
    if (dist > 300) continue; // 먼 겹은 꼭짓점 색의 숲으로 충분
    const k = t.near ? 3 + Math.floor(r() * 3) : 2;
    for (let i = 0; i < k; i++) {
      const a = r() * TAU, d = t.r * (0.35 + r() * 0.75);
      cliffPine(K, t.x + Math.cos(a) * d, t.y - 0.8 - d * 0.08, t.z + Math.sin(a) * d, (t.near ? 1.8 : 3.2) + r() * 1.4, 7300 + pines * 13, a);
      pines++;
    }
  }
  const mats = { wood: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, flatShading: true }) };
  for (const [bin, mat] of Object.entries(mats)) {
    const mesh = K.mesh(bin, mat, { cast: false, receive: false });
    if (!mesh) { mat.dispose(); continue; }
    mesh.name = 'qinglan-vista-pine-' + bin; scene.add(mesh);
    for (const g of K.bins[bin]) g.dispose();
  }
  // ④ 구름 바다 (불투명 바닥) + 안개 띠 둘 (반투명, 기둥 허리에 걸린다)
  const seaTex = cloudTexture(615227, false); seaTex.repeat.set(7, 7);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(640, 48), new THREE.MeshBasicMaterial({ map: seaTex, color: 0xffffff }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = CLOUD_Y; sea.name = 'qinglan-cloud-sea'; scene.add(sea);
  for (const [y, inner, op, rep, seed] of [[CLOUD_Y + 14, 30, 0.75, 5, 615229], [CLOUD_Y + 27, 70, 0.45, 4, 615233]]) {
    const tex = cloudTexture(seed, true); tex.repeat.set(rep, rep);
    const band = new THREE.Mesh(new THREE.RingGeometry(inner, 620, 40, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
    band.rotation.x = -Math.PI / 2; band.position.y = y; band.name = 'qinglan-mist-band'; band.renderOrder = 1; scene.add(band);
  }
  return { stats: { pillars: tops.length, pines, triangles: pos.length / 9 } };
}
