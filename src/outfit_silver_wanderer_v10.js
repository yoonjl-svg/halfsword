// 다라이시 v10 — v7 바탕 + 허리띠 아래 보라 자락만 v9 의 길이·장식 (look.daraishiLower 10, 우리 판).
//  사장님 10/14 18:4x "근데 다라이시 말이야. v7이 제일 나은 거 같다. v7로 되돌리되, 허리띠 아래로 보라색 천 부분만 v9을 이식해
//   (벌어진 넓이는 그대로 유지하고 v9의 길이와 장식 등의 디테일 적용)"
//  · 바탕 = v7 전부: looks.js 의 v10 은 v7 에 daraishiLower 10 표시만 더한 것이라 머리·땋음·얼굴·흰 윗옷·소매·망토·허리띠·흰 바지·은 각반·신은
//    v7 갈래(daraishiRevision 7)를 그대로 탄다. v9 의 망토 금빛 띠·보라 위 소매·흰 V·캄마르반드·장화 금빛 고리는 가져오지 않는다.
//    빈 검집만 v8 자리(바깥 1.2 cm · 0.12 rad — v7 자리면 이 자락 바깥 겉면에 걸쳐 축이 자락을 지나는 표본 18.3 %, 감독 결정 10/14 · 확인표 1371)
//  · 바꾸는 것 = 허리띠 밑 보라 천: 엉덩이 자락(골반 도막) · 다리마다 바깥쪽 자락(v7 은 허벅지·정강이 두 도막이 무릎에서 겹친 것 → 한 장)
//    - 벌어짐 = v7: 엉덩이 자락은 앞 ±0.44 rad 만 트이고, 다리 자락은 다리 바깥 반쪽(앞 0.23 rad → 바깥 → 뒤 π)만 덮는다 — 앞이 약 25 cm 열려 흰 바지가 보이고,
//      뒤도 두 자락의 뒤 가장자리(다리 축 바로 뒤) 사이가 열린다. 단면(앞뒤·옆 반폭 · 뒤로 비킴 · 세로 주름)도 v7 값
//    - 길이 = v9: 다리 자락 옷단 0.30 m (v7 은 오른 0.165 · 왼 0.14 m 로 달랐다 — 앞뒤·좌우 같게). 엉덩이 자락(0.821 m)은 v7 길이 그대로 — 늘이면 앞 열림을 덮는다
//    - 장식 = v9: 겉감 #66528A · 옷단 테(금빛 1.2 · 짙은 보라 4.4 · 금빛 1.2 cm + 덩굴 물결·팔각 꽃·은 마름모) · 앞섶 테(열린 앞 가장자리 — 흰 바지 쪽 세로 가장자리,
//      금빛 1.1 · 짙은 보라 2.8 · 금빛 1.1 cm + 은 마름모) · 트임 테(다리 자락 뒤 가장자리 — 뒤에서 두 자락 사이가 벌어진 곳, 금빛 1.5 cm) · 띄우는 높이 ·
//      다리 자락은 겉감·테·문양을 꼭짓점 색 한 장으로 칠해 v8·v9 와 같은 무게로 스키닝한다(다리마다 그리기 하나)
//  · 겉모습만: 몸·질량·관절·충돌체 그대로. 값은 모두 사장님 확인 전(docs/strike/owner_defaults_table.md 1360~)
//  +X 앞 · +Y 위 · +Z 오른쪽 (부위 좌표). 자락 높이는 서 있을 때 세계 높이로 적는다(골반 0.97 · 허벅지 0.715 · 정강이 0.29)
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DARAISHI_V9, daraishiOrnaments } from './outfit_silver_wanderer_v9.js';

export function createDaraishiV10(h) {
  const { THREE, addMerged, CLOTH, artoriaCloth, hangingClothShading } = h;
  const C = DARAISHI_V9;
  const { paintHex, lozenge, hemOrnament } = daraishiOrnaments(THREE);
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.87, side: THREE.DoubleSide }; // v7 자락과 같은 천(안쪽 면도 겉감 색 — v7·v9 둘 다 그렇다)
  const layer = (g) => artoriaCloth(g, 'silver-wanderer-v10');
  const clamp = THREE.MathUtils.clamp;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  // v9 테 너비(outfit_silver_wanderer_v9.js 와 같은 값 — 확인표 1324~1326) · 겉면에서 띄우는 높이 mm(1331)
  const HEM_W = 0.068, HEM_LINE = 0.012, FRONT_W = 0.05, FRONT_LINE = 0.011, SLIT_LINE = 0.015;
  const LIFT = { band: 3, gold: 4.5, gem: 5.8 };

  // 띠 하나: 높이 rowsY 마다 각 from(y) → to(y) 를 segs 칸으로 — point(a, y) 가 자세 좌표 점. flip 이면 감는 방향을 뒤집는다(겉면 법선이 바깥을 보게)
  function strip(rowsY, segs, from, to, point, flip) {
    const pos = [], uv = [], idx = [];
    rowsY.forEach((y, j) => {
      const a0 = from(y), a1 = to(y);
      for (let i = 0; i <= segs; i++) { pos.push(...point(a0 + ((a1 - a0) * i) / segs, y)); uv.push(i / segs, j / (rowsY.length - 1)); }
    });
    for (let j = 0; j < rowsY.length - 1; j++) for (let i = 0; i < segs; i++) {
      const n = j * (segs + 1) + i, m = n + segs + 1;
      if (flip) idx.push(n, m, n + 1, n + 1, m, m + 1); else idx.push(n, n + 1, m, n + 1, m + 1, m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 각 fa(y) 에서 단면 겉면을 따라 w m 간 자리의 각 (w > 0 이면 각이 커지는 쪽) — sec(a, y) → [x, z] */
  const towardOn = (sec) => (fa, w) => (y) => {
    const dir = Math.sign(w), target = Math.abs(w), da = 0.002 * dir;
    let a = fa(y), d = 0, [px, pz] = sec(a, y);
    for (let i = 0; i < 2000; i++) {
      const [x, z] = sec(a + da, y), dd = Math.hypot(x - px, z - pz);
      if (d + dd >= target) return a + (da * (target - d)) / dd;
      d += dd; a += da; px = x; pz = z;
    }
    return a;
  };

  // ════════ 다리 자락 (v7 꼴 · v9 길이·장식) ════════
  //  v7 은 허벅지 자락(도막 좌표 0.264 → −0.24·−0.26)과 정강이 자락(0.29 → 옷단)을 도막마다 따로 붙여 무릎에서 겹쳤다(정강이 자락이 허벅지 자락 안으로 약 1 cm).
  //  서 있을 때 높이로 옮겨 한 장으로 잇는다 — 허벅지 자락 세 줄(0.979 · 0.825 · 0.595 m)과, 정강이 자락을 0.30 m 에서 자른 단면(0.43 · 0.20 m 줄 사이).
  //  [높이 y, 앞뒤 반폭 rx, 옆 반폭 rz, 뒤로 비킴 x, 주름 위상] — 주름은 v7 그대로 1 + 0.034·cos(8a + 위상), 위상은 v7 의 줄마다 0.25
  const LEG = [
    [0.979, 0.135, 0.13, -0.019, 0],
    [0.825, 0.142, 0.137, -0.022, 0.25],
    [0.595, 0.137, 0.137, -0.03, 0.5],
    [0.3, 0.1372, 0.1346, -0.0391, 0.75],
  ];
  const LEG_TOP = 0.979, HEM_Y = 0.3, FRONT_A = 0.23; // 앞 가장자리 각(v7 'tailored' 열림) — 뒤 가장자리는 π(다리 축 바로 뒤)
  const ROWS = [0.979, 0.93, 0.88, 0.825, 0.76, 0.7, 0.645, 0.595, 0.555, 0.515, 0.48, 0.445, 0.41, 0.37, 0.335, 0.3]; // 무릎(0.50 m) 둘레를 촘촘히 — 스키닝으로 굽힐 때 둥글게
  const SEGS = 32; // 앞 가장자리 → 뒤 가장자리 칸 (v7 drape 와 같은 32)
  function legAt(y) {
    let j = 0;
    while (j < LEG.length - 2 && y < LEG[j + 1][0]) j++;
    const A = LEG[j], B = LEG[j + 1], u = clamp((A[0] - y) / (A[0] - B[0]), 0, 1);
    return [1, 2, 3, 4].map((i) => A[i] + (B[i] - A[i]) * u);
  }
  /**
   * 자락 겉면 한 점(다리 축 기준): 바깥쪽 각 a(0 앞 · π/2 바깥 · π 뒤) · 높이 y · 겉면에서 mm 띄움 → [x(앞), 바깥쪽 z].
   *  side 는 v7 주름 위상을 맞추는 데만 쓴다 — v7 은 왼다리 자락을 절대 각 π → 2π − 0.23 으로 그렸다
   */
  function legSec(a, y, side, mm = 0) {
    const [rx, rz, x0, ph] = legAt(y), c = Math.cos(a), s = Math.sin(a);
    const a7 = side > 0 ? a : Math.PI * 2 - a;
    const R = (1 + 0.034 * Math.cos(a7 * 8 + ph)) / Math.hypot(c / rx, s / rz) + mm / 1000;
    return [x0 + R * c, R * s];
  }
  const weights = (y) => { // v8·v9 자락과 같은 무게(확인표 1231): 골반 0.5·smooth(0.84 → 0.95) · 정강이 0.75·smooth(0.585 → 0.43) · 나머지 허벅지
    const wp = 0.5 * smooth(0.84, 0.95, y), ws = 0.75 * smooth(0.585, 0.43, y);
    return [wp, Math.max(0, 1 - wp - ws), ws];
  };
  function skin(geo, pelvisY) {
    const p = geo.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const [wp, wt, ws] = weights(p.getY(i) + pelvisY);
      si.set([0, 1, 2, 0], i * 4); sw.set([wp, wt, ws, 0], i * 4);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return geo;
  }
  /** 한 다리 자락의 조각들 — [조각, 색] (겉감 + 옷단 테 · 앞섶 테 · 트임 테 · 문양) */
  function legPieces(info) {
    const { side, legZ, pelvisY } = info, flip = side < 0;
    const sec = (a, y) => legSec(a, y, side);
    const legR = (a, y) => { const [x, z] = sec(a, y); return Math.hypot(x - legAt(y)[2], z); }; // 단면 가운데(뒤로 비킨 점)에서 겉면까지 — 각 너비 = 길이 ÷ 이 값
    const P = (a, y, mm) => { const [x, zo] = legSec(a, y, side, mm); return [x, y - pelvisY, legZ + side * zo]; };
    const at = (mm) => (a, y) => P(a, y, mm);
    const toward = towardOn(sec);
    const fF = () => FRONT_A, fB = () => Math.PI;
    const out = [[strip(ROWS, SEGS, fF, fB, at(0), flip), C.coat]];
    const top = HEM_Y + HEM_W;
    // 옷단 테 — 앞 가장자리에서 뒤 가장자리까지 한 줄 (v7 자락은 옆트임이 없다)
    out.push([strip([top, HEM_Y], SEGS, fF, fB, at(LIFT.band), flip), C.band]);
    out.push([strip([HEM_Y + HEM_LINE, HEM_Y], SEGS, fF, fB, at(LIFT.gold), flip), C.gold]);
    out.push([strip([top, top - HEM_LINE], SEGS, fF, fB, at(LIFT.gold), flip), C.gold]);
    // 앞섶 테 — 열린 앞 가장자리(흰 바지 쪽 세로 가장자리)를 따라 자락 윗단부터. 옷단 테 윗선에서 멈추고 가장자리 금빛 선만 옷단까지 내려 액자처럼 만난다(v9 그대로)
    const frontRows = [...ROWS.filter((y) => y > top + 0.01), top];
    out.push([strip(frontRows, 2, fF, toward(fF, FRONT_W), at(LIFT.band), flip), C.band]);
    out.push([strip([...frontRows, HEM_Y + HEM_LINE, HEM_Y], 1, fF, toward(fF, FRONT_LINE), at(LIFT.gold), flip), C.gold]);
    out.push([strip(frontRows, 1, toward(fF, FRONT_W - FRONT_LINE), toward(fF, FRONT_W), at(LIFT.gold), flip), C.gold]);
    // 앞섶 띠 위 은 마름모 — 6.5 cm 마다 (자락 윗단 4 cm 아래부터 옷단 테 윗선 3 cm 위까지)
    for (let y = LEG_TOP - 0.04; y > top + 0.03; y -= 0.065) {
      const a = toward(fF, FRONT_W / 2)(y), r = legR(a, y);
      out.push([lozenge((u, v) => P(a + u / r, y + v, LIFT.gem), 0.0075, 0.012), C.silver]);
    }
    // 트임 테 — 뒤 가장자리(두 자락 뒤 가장자리 사이가 벌어진 곳)에 금빛 선 1.5 cm, 자락 윗단부터 옷단까지
    out.push([strip(ROWS, 1, toward(fB, -SLIT_LINE), fB, at(LIFT.gold), flip), C.gold]);
    // 옷단 띠 문양(덩굴 물결 · 팔각 꽃 · 은 마름모 — v9 와 같은 함수): 앞섶 테 옆 1.2 cm 부터 트임 테 옆 1.2 cm 까지
    const yc = HEM_Y + HEM_W / 2;
    hemOrnament(P, (a) => legR(a, yc), toward(fF, FRONT_W + 0.012)(yc), toward(fB, -(SLIT_LINE + 0.012))(yc), yc, out);
    return out;
  }
  // 부위는 골반 → … → 허벅지(앞) → 정강이(앞) → 발 → 허벅지(뒤) → 정강이(뒤) 차례로 꾸며진다(fighter.js partDefs) — 정강이 차례에 그 다리 자락을 만든다 (qaba 와 같은 방식)
  let rig = { pelvis: null, thigh: {} };
  /** 다리 도막: 허벅지 차례엔 자리만 적고, 정강이 차례에 자락 한 장(골반·허벅지·정강이를 뼈로 — 새 뼈·물리 몸 없음)을 만든다 */
  function leg(g, d, lower) {
    const side = Math.sign(d?.pos?.[2] || 1); // 바깥쪽(+z 오른다리 · −z 왼다리)
    if (!lower) { rig.thigh[side] = { g, pos: d?.pos ?? [0, 0.715, side * 0.095] }; return; }
    const shinPos = d?.pos ?? [0, 0.29, side * 0.095];
    const pelvis = rig.pelvis ?? { g, pos: [0, 0.97, 0] }, thigh = rig.thigh[side] ?? { g, pos: shinPos };
    const info = { side, legZ: shinPos[2], pelvisY: pelvis.pos[1] };
    const rest = (pos) => new THREE.Matrix4().makeTranslation(pos[0] - pelvis.pos[0], pos[1] - pelvis.pos[1], pos[2] - pelvis.pos[2]).invert();
    const skeleton = new THREE.Skeleton([pelvis.g, thigh.g, g], [new THREE.Matrix4(), rest(thigh.pos), rest(shinPos)]);
    skeleton.computeBoneTexture(); // 꾸미기 안에서 미리 — 첫 그리기 때 만들면 텍스처 UUID 가 전역 난수를 쓴다
    const pieces = legPieces(info).map(([geo, hex]) => paintHex(geo, hex));
    const geo = skin(mergeAll(pieces), info.pelvisY);
    const mat = hangingClothShading(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.06, ...cloth, vertexColors: true }));
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.bind(skeleton, new THREE.Matrix4()); // 기준 자세 좌표 그대로(bindMatrix 단위 행렬)
    mesh.castShadow = true;
    mesh.frustumCulled = false; // 경계 구는 기준 자세 것이라 다리를 크게 벌리면 맞지 않는다 — 인물 하나에 두 장뿐이라 늘 그린다
    layer(g).add(mesh);
  }
  /** 조각들을 한 꼭짓점 묶음으로 (addMerged 와 같은 mergeGeometries — 조각은 버린다) */
  function mergeAll(pieces) {
    const geo = mergeGeometries(pieces, false);
    for (const p of pieces) p.dispose();
    return geo;
  }

  // ════════ 엉덩이 자락 (골반 도막, v7 꼴 · v9 겉감) ════════
  //  v7 drape 그대로: 골반 좌표 [y, 앞뒤 반폭, 옆 반폭] 세 줄(서 있을 때 1.077 · 0.959 · 0.821 m), 앞 ±0.44 rad 만 트임, 주름 1 + 0.024·cos(8a + 0.25 j).
  //  테는 두지 않는다 — 앞 트임 가장자리(몸 가운데 ±5~6 cm)는 흰 바지가 아니라 골반의 짙은 보라(v7 그대로)를 보고, 다리 자락 앞섶 테(±12.6 cm)와
  //  2 cm 사이로 나란히 서서 테가 두 줄로 겹쳐 보인다. 옷단(0.821 m)은 앞에서 두 다리 자락 사이로 6 cm 씩만 보이고 나머지는 다리 자락 밑이다
  const HIP = [[0.107, 0.109, 0.16], [-0.011, 0.124, 0.186], [-0.149, 0.142, 0.211]];
  const HIP_OPEN = 0.44;
  /** 엉덩이 자락 겉면 한 점(골반 좌표): 절대 각 a(0 앞 · π/2 오른쪽) · 줄 j */
  function hipPoint(a, j) {
    const [y, rx, rz] = HIP[j], c = Math.cos(a), s = Math.sin(a);
    const R = (1 + 0.024 * Math.cos(a * 8 + j * 0.25)) / Math.hypot(c / rx, s / rz);
    return [R * c, y, R * s];
  }
  /** 골반 도막: 엉덩이 자락(v9 겉감 · 다리 자락과 같은 늘어진 천 음영) · 다리 자락의 뼈 자리를 적는다 */
  function hip(g, d) {
    rig = { pelvis: { g, pos: d?.pos ?? [0, 0.97, 0] }, thigh: {} }; // 새 인물의 첫 부위 — 다리 자락의 뼈로 쓴다
    const rows = HIP.map(([y]) => y), row = (y) => rows.indexOf(y);
    const geo = strip(rows, 32, () => HIP_OPEN, () => Math.PI * 2 - HIP_OPEN, (a, y) => hipPoint(a, row(y)), true); // 꼭짓점·감는 방향 v7 drape 그대로
    hangingClothShading(addMerged(layer(g), [geo], C.coat, cloth).material);
  }
  return { leg, hip };
}
