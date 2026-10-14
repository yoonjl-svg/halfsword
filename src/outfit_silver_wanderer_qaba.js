// 다라이시 v8 — 카바(qaba, 페르시아 귀족의 긴 겉옷). 우리 판 (look.daraishiRevision 8 — v7 겉모습 덜기 위에 얹는다).
//  사장님 10/14 12:2x "지금에서 조금만 더 페르시안 귀족의 전통이 묻어나게 옷을 바꿀 수 있는지. 특히 하의 길이나 겹침이 좀 애매해 보이는데…"
//  → 실루엣(보라 선 깃·짧은 어깨 망토·흰 소매·긴 은발)은 그대로 두고, v7 의 '앞이 갈라진 치마 같은 자락 + 흰 바지 + 은 각반'을
//    가슴부터 종아리 중간까지 한 벌인 흰 카바로 바꾼다:
//   · 앞섶: 왼쪽 자락(겉자락)이 오른쪽으로 건너 여며진다 — 가슴은 목 왼쪽에서 오른쪽 아래로 내려오는 사선, 허리 아래는 몸 가운데에서
//     조금 오른쪽으로 곧게 내려가는 겉자락 앞 가장자리. 두 자락이 몸 가운데에서 4 cm 겹친다(겉자락 2 cm 오른쪽까지 · 속자락 2 cm 왼쪽까지)
//   · 허리에 천 띠(캄마르반드 — 띠 몸통·팔각 꽃·매듭은 detail 모듈, 늘어진 띠 끝 둘은 여기 골반)
//   · 길이는 종아리 중간(서 있을 때 0.30 m — 무릎 0.50 m 와 발목 0.08 m 의 가운데)으로 앞뒤·좌우 모두 같게, 양옆 트임(0.60 m → 옷단)
//   · 그 밑은 통이 적당한 바지(옅은 보랏빛 회색)가 부드러운 가죽 장화로 들어간다 — 옷단 아래 약 8 cm 바지가 보이고 장화 위에서 살짝 불룩
//   · 문양은 폰에서 보이는 큰 띠만: 앞섶 테(2.2 cm) · 옷단 테(3.4 cm) · 트임 테(1.6 cm) — 모두 망토와 같은 짙은 보라
//  자락은 다리마다 한 장(엉덩이 → 옷단)이고 골반·허벅지·정강이 부위 그룹을 무게로 섞어 따라간다(스키닝 — 아래 leg 설명). 다리 대표 메쉬(상처가 붙는 겉면)는
//  꼴을 그대로 두고 바지 색만 칠한다 — 트임과 앞섶 사이로 바지 다리가 보여야 하므로. 발만 대표 메쉬 꼴을 장화로 바꾼다(reshapeMain — 종류·치수 값 그대로).
//  겉모습만: 몸·질량·관절·충돌체·손 구체 그대로. 값은 모두 사장님 확인 전(docs/strike/owner_defaults_table.md 1226~1234).
//  +X 앞 · +Y 위 · +Z 오른쪽 (부위 좌표). 높이는 서 있을 때 세계 높이로 적고 도막 원점 높이(허벅지 0.715 · 정강이 0.29 · 골반 0.97)를 빼서 쓴다.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createDaraishiQaba(h) {
  const { THREE, addMerged, CLOTH, artoriaCloth, reshapeMain, hangingClothShading } = h;
  const COAT = 0xe9e9e5; // 겉감 — v7 흰 셔츠와 같은 색 (가슴·배 대표 메쉬가 그대로 카바 윗몸이 된다)
  const TRIM = 0x433653; // 테 — 어깨 망토·선 깃과 같은 짙은 보라
  const TROUSER = 0x776b88; // 바지 — v6·v7 자락 단 띠 색(옅은 보랏빛 회색): 흰 카바·짙은 테·장화와 명도가 갈린다
  const BOOT = 0x4a3836; // 부드러운 가죽 장화
  const SASH = 0x513c60; // 캄마르반드 — v6·v7 허리 띠와 같은 자두색 (detail 모듈 띠 몸통과 같은 값)
  const cloth = { ...CLOTH, metalness: 0, roughness: 0.87, side: THREE.DoubleSide };
  const sashCloth = { ...CLOTH, metalness: 0.12, roughness: 0.73, side: THREE.DoubleSide };
  const layer = (g) => artoriaCloth(g, 'silver-wanderer-qaba');
  const clamp = THREE.MathUtils.clamp;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  // ── 자락 선 (서 있을 때 세계 높이 y) ──
  const HIP_Y = 0.95, HEM_Y = 0.30, SLIT_TOP = 0.60;
  const CROSS = 0.115; // 자락 앞·뒤 가장자리가 다리 축에서 안쪽으로 가는 거리 (다리 축 0.095 → 몸 가운데를 2 cm 넘는다)
  const SLIT_GAP = 0.10; // 트임이 옷단에서 벌어지는 반각(rad) — 바깥 반지름 0.14 m 에서 약 2.8 cm
  const W_FRONT = 0.022, W_HEM = 0.034, W_SLIT = 0.016, LIFT = 0.003; // 테 너비 · 겉면에서 띄우는 높이
  /** A 자 선: t 0 = 엉덩이(0.95 m) → 1 = 옷단(0.30 m). rx = 앞뒤 반폭, out = 다리 축에서 바깥 가장자리 — 옷단 너비 0.47 m(다리 축 ±0.095 + 0.14)로 v7 자락과 같은 실루엣 */
  const lineAt = (y) => {
    const t = clamp((HIP_Y - y) / (HIP_Y - HEM_Y), 0, 1);
    return { t, rx: 0.124 + 0.024 * t, out: 0.097 + 0.043 * t };
  };
  /**
   * 자락 단면 한 점. a: 0 앞 · π/2 바깥(옆) · π 뒤 · 3π/2 안쪽(다리 사이 — 자락이 없는 쪽).
   * outer = 겉자락(몸 왼쪽 다리): 안쪽 앞·뒤 사분면을 납작하게(지수 4, 반폭 0.21) 펴서 가장자리까지 앞면 그대로 몸 가운데를 건넌다.
   * 속자락(오른쪽 다리)은 안쪽 사분면을 둥글게(지수 2.4, 반폭 0.17) 4 % 줄여 겉자락 뒤로 숨는다 → 서 있을 때 겉자락 앞 가장자리만 보인다.
   * 돌려주는 값: [x(앞), 바깥쪽 z]
   */
  function section(a, y, outer, k = 1) {
    const { t, rx, out } = lineAt(y);
    const c = Math.cos(a), s = Math.sin(a), inner = s < 0;
    const zr = inner ? (outer ? 0.21 : 0.17) : out;
    const p = inner && outer ? 4 : 2.4;
    const shrink = inner && !outer ? 1 - 0.04 * Math.sqrt(-s) : 1;
    const r = (Math.abs(c / rx) ** p + Math.abs(s / zr) ** p) ** (-1 / p) * shrink;
    const fold = 1 + 0.018 * t * Math.cos(a * 6 + 0.4); // 옷단으로 갈수록 살짝 깊어지는 세로 주름
    return [r * c * fold * k, r * s * fold * k];
  }
  /** 바깥쪽 z 가 −CROSS 인 각 — 앞 가장자리는 (−π/2, 0) 에서 z 가 각을 따라 늘고, 뒤 가장자리는 (π, 3π/2) 에서 준다 (이분법) */
  function edgeAngle(y, outer, back) {
    let lo = back ? Math.PI : -Math.PI / 2, hi = back ? Math.PI * 1.5 : 0;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2, z = section(mid, y, outer)[1];
      if (back ? z > -CROSS : z < -CROSS) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  const gap = (y) => (y >= SLIT_TOP ? 0 : SLIT_GAP * Math.pow((SLIT_TOP - y) / (SLIT_TOP - HEM_Y), 1.15));
  const radiusAt = (a, y, outer) => Math.hypot(...section(a, y, outer));

  /**
   * 고리(높이 y — 서 있을 때 세계 높이)마다 각 from(y) → to(y) 를 segs 칸으로 잇는 천 띠. 점은 '골반 기준 자세 좌표'(골반 원점 · 서 있는 자세)로 적는다:
   *  x 앞 · y − 골반 높이 · z = 다리 축(legZ) + 바깥쪽(side) 단면. scale(y) = 다리 축에서 늘이는 배율(테를 겉면 위로 띄울 때)
   */
  function strip(rowsY, segs, from, to, leg, scale = () => 1) {
    const { outer, side, legZ, pelvisY } = leg;
    const pos = [], uv = [], idx = [];
    rowsY.forEach((y, j) => {
      const a0 = from(y), a1 = to(y), k = scale(y);
      for (let i = 0; i <= segs; i++) {
        const [x, zo] = section(a0 + ((a1 - a0) * i) / segs, y, outer, k);
        pos.push(x, y - pelvisY, legZ + side * zo); uv.push(i / segs, j / (rowsY.length - 1));
      }
    });
    for (let j = 0; j < rowsY.length - 1; j++) for (let i = 0; i < segs; i++) {
      const n = j * (segs + 1) + i, m = n + segs + 1;
      // 겉면 법선이 바깥을 보게: 각이 커지는 쪽이 +z(오른다리)일 때와 −z(왼다리)일 때 감는 방향을 바꾼다
      if (side > 0) idx.push(n, n + 1, m, n + 1, m + 1, m); else idx.push(n, m, n + 1, n + 1, m, m + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 같은 자리 꼭짓점의 법선을 평균 — 앞 조각·뒤 조각이 트임 위 옆선에서 만나는 자리에 음영 금이 가지 않게 */
  function smoothSeams(geo) {
    const p = geo.attributes.position, nrm = geo.attributes.normal, sums = new Map(), keys = [], v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const key = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
      keys.push(key);
      if (!sums.has(key)) sums.set(key, new THREE.Vector3());
      sums.get(key).add(v.fromBufferAttribute(nrm, i));
    }
    for (let i = 0; i < p.count; i++) { v.copy(sums.get(keys[i])).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
    return geo;
  }
  /** 고리(높이 y, 반지름 r)를 잇는 둥근 통 — 바지·장화 목. 이음매는 뒤(−x) */
  function ringLoft(rows, segs) {
    const pos = [], uv = [], idx = [];
    rows.forEach(([y, r], j) => {
      for (let i = 0; i <= segs; i++) {
        const a = Math.PI + (i / segs) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(i / segs, j / (rows.length - 1));
      }
    });
    for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < segs; i++) {
      const n = j * (segs + 1) + i, m = n + segs + 1;
      idx.push(n, n + 1, m, n + 1, m + 1, m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  // ── 다리 하나의 카바 자락: 엉덩이(0.95 m)부터 옷단(0.30 m)까지 한 장, 골반·허벅지·정강이 세 부위를 섞어 따라간다(스키닝) ──
  //  도막마다 따로 붙이면(v8 첫 시안) 무릎을 굽힐 때 허벅지 자락 아래끝과 정강이 자락 윗단이 벌어져 바지가 네모로 비치고, 트임 테가 두 겹으로 어긋났다.
  //  한 장을 무게로 섞으면 무릎에서 천이 둥글게 굽고 틈이 없다. 다리끼리는 섞지 않는다 — 앞으로 나간 다리가 반대쪽 자락을 뚫지 않게(자락은 제 다리만 따른다).
  //  무게(서 있을 때 높이 y): 골반 0.5·smooth(0.84 → 0.95) (엉덩이 윗단이 골반 통 밑에서 덜 들리게) · 정강이 0.75·smooth(0.585 → 0.43) (무릎 0.50 m 둘레) · 나머지 허벅지.
  //   옷단까지 허벅지 몫 0.25 를 남긴다 — 무릎 꿇은 뒷다리에서 자락 아랫도리가 가로누운 정강이를 따라 판자처럼 뒤로 뻗지 않고 바닥 쪽으로 처지게(긴 겉옷은 엉덩이에 걸려 늘어진다).
  //  뼈는 그 인물의 골반·허벅지·정강이 부위 그룹 그대로(물리 몸이 움직이는 그 그룹 — 새 뼈 없음). 그리기 전용: 물리·시드 시뮬과 무관
  const COAT_ROWS = [0.95, 0.88, 0.81, 0.74, 0.67, 0.62, 0.585, 0.55, 0.515, 0.48, 0.445, 0.41, 0.37, 0.335, 0.30];
  const weights = (y) => {
    const wp = 0.5 * smooth(0.84, 0.95, y), ws = 0.75 * smooth(0.585, 0.43, y);
    return [wp, Math.max(0, 1 - wp - ws), ws];
  };
  function skin(geo, leg) {
    const p = geo.attributes.position, n = p.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const [wp, wt, ws] = weights(p.getY(i) + leg.pelvisY);
      si.set([0, 1, 2, 0], i * 4); sw.set([wp, wt, ws, 0], i * 4);
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return geo;
  }
  function skinned(parent, geo, color, skeleton) {
    const mat = hangingClothShading(new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.06, ...cloth }));
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.bind(skeleton, new THREE.Matrix4()); // 기준 자세 좌표 그대로(bindMatrix 단위 행렬)
    mesh.castShadow = true;
    mesh.frustumCulled = false; // 경계 구는 기준 자세 것이라 다리를 크게 벌리면 맞지 않는다 — 인물 하나에 두 장뿐이라 늘 그린다
    parent.add(mesh);
    return mesh;
  }
  // 부위는 골반 → … → 허벅지(앞) → 정강이(앞) → 발 → 허벅지(뒤) → 정강이(뒤) 차례로 꾸며진다(fighter.js partDefs) — 정강이 차례에 그 다리 자락을 만든다
  let rig = { pelvis: null, thigh: {} };
  function leg(g, d, lower) {
    const side = Math.sign(d?.pos?.[2] || 1); // 바깥쪽(+z 오른다리 · −z 왼다리)
    const main = g.children[0];
    main.material.color.setHex(TROUSER); main.material.metalness = 0; main.material.roughness = 0.9;
    if (!lower) { rig.thigh[side] = { g, pos: d?.pos ?? [0, 0.715, side * 0.095] }; return; }
    const shinPos = d?.pos ?? [0, 0.29, side * 0.095];
    const pelvis = rig.pelvis ?? { g, pos: [0, 0.97, 0] }, thigh = rig.thigh[side] ?? { g, pos: shinPos };
    const info = { outer: side < 0, side, legZ: shinPos[2], pelvisY: pelvis.pos[1] }; // 왼쪽 자락이 겉자락 (오른쪽으로 건너 여민다)
    const rest = (pos) => new THREE.Matrix4().makeTranslation(pos[0] - pelvis.pos[0], pos[1] - pelvis.pos[1], pos[2] - pelvis.pos[2]).invert();
    const skeleton = new THREE.Skeleton([pelvis.g, thigh.g, g], [new THREE.Matrix4(), rest(thigh.pos), rest(shinPos)]);
    skeleton.computeBoneTexture(); // 지금(꾸미기 안 — 따로 된 난수) 만들어 둔다: 첫 그리기 때 만들면 텍스처 UUID 가 전역 난수를 쓴다
    const fF = (y) => edgeAngle(y, info.outer, false), fB = (y) => edgeAngle(y, info.outer, true);
    const slitF = (y) => Math.PI / 2 - gap(y), slitB = (y) => Math.PI / 2 + gap(y);
    const segs = 14;
    const coat = smoothSeams(mergeGeometries([strip(COAT_ROWS, segs, fF, slitF, info), strip(COAT_ROWS, segs, slitB, fB, info)]));
    skinned(layer(g), skin(coat, info), COAT, skeleton);
    // 테: 앞섶(자락 앞 가장자리) · 트임 양쪽 가장자리 · 옷단 — 겉면에서 3 mm 띄운다
    const lift = (y) => 1 + LIFT / lineAt(y).rx;
    const slitRows = COAT_ROWS.filter((y) => y <= SLIT_TOP + 1e-6), hemRows = [HEM_Y + W_HEM, HEM_Y + W_HEM / 2, HEM_Y];
    const trims = mergeGeometries([
      strip(COAT_ROWS, 2, fF, (y) => fF(y) + W_FRONT / radiusAt(fF(y), y, info.outer), info, lift),
      strip(slitRows, 1, (y) => slitF(y) - W_SLIT / radiusAt(slitF(y), y, info.outer), slitF, info, lift),
      strip(slitRows, 1, slitB, (y) => slitB(y) + W_SLIT / radiusAt(slitB(y), y, info.outer), info, lift),
      strip(hemRows, segs, fF, slitF, info, lift), strip(hemRows, segs, slitB, fB, info, lift),
    ]);
    skinned(layer(g), skin(trims, info), TRIM, skeleton);
    // 바지 통(무릎 → 장화 목): 반지름 6.1 cm, 장화 바로 위에서 6.45 cm 로 불룩했다가 장화 안으로 들어간다 (정강이에 붙는다)
    const L = (y) => y - shinPos[1];
    addMerged(layer(g), [ringLoft([[L(0.505), 0.061], [L(0.42), 0.0605], [L(0.33), 0.061], [L(0.258), 0.0632], [L(0.234), 0.0645],
      [L(0.214), 0.0585], [L(0.204), 0.052]], 14)], TROUSER, { ...cloth, roughness: 0.9 });
    // 부드러운 장화 목: 0.219 m(옷단 아래 8 cm) → 발목. 윗단 1 cm 를 조금 넓혀 접힌 가죽 끝으로
    addMerged(layer(g), [ringLoft([[L(0.219), 0.0592], [L(0.209), 0.0596], [L(0.199), 0.0558], [L(0.15), 0.0522], [L(0.10), 0.0488],
      [L(0.062), 0.0472], [L(0.04), 0.0452]], 14)], BOOT, { ...cloth, roughness: 0.62 });
  }

  // ── 발: 장화 발 — 대표 메쉬(0.25 × 0.075 × 0.11 상자)를 앞코가 좁고 둥근 가죽 장화 꼴로 (종류·치수 값 그대로) ──
  function boot(g) {
    const main = g.children[0], { width, height, depth } = main.geometry.parameters;
    const geo = new THREE.BoxGeometry(width, height, depth, 8, 3, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = Math.max(0, x / (width / 2)); // 0 가운데 → 1 앞코
      const back = Math.max(0, -x / (width / 2)); // 0 가운데 → 1 뒤꿈치
      const zs = 1 - 0.42 * Math.pow(u, 1.8) - 0.16 * Math.pow(back, 3); // 앞코 좁힘 42 % · 뒤꿈치 둥글게
      const top = y > 0 ? 1 - 0.45 * Math.pow(u, 1.4) : 1; // 발등이 앞코로 낮아진다
      const lift = Math.pow(u, 4) * 0.006; // 앞코가 아주 조금 들린다
      p.setXYZ(i, x, y * top + lift, z * zs);
    }
    geo.computeVertexNormals();
    reshapeMain(main, geo);
    main.material.color.setHex(BOOT); main.material.metalness = 0; main.material.roughness = 0.62;
  }

  // ── 골반: 카바 허리 아래 윗단(띠 밑 1.035 m → 0.82 m, 닫힌 통) + 겉자락 앞 가장자리 테 + 캄마르반드 늘어진 끝 둘 ──
  //  다리 도막 자락이 0.95 m 부터 이 안에서 나온다. 테는 왼다리 겉자락 테와 같은 자리(몸 가운데 −0.2 ~ +2.0 cm)
  const HIP_ROWS = [[0.065, 0.113, 0.168], [-0.011, 0.124, 0.186], [-0.149, 0.142, 0.211]]; // 골반 좌표 y, 앞뒤 반폭, 옆 반폭
  function hipPoint(a, j, k = 1) {
    const [y, rx, rz] = HIP_ROWS[j], c = Math.cos(a), s = Math.sin(a), p = 2.2;
    const r = (Math.abs(c / rx) ** p + Math.abs(s / rz) ** p) ** (-1 / p) * (1 + 0.012 * (j / 2) * Math.cos(a * 8 + 0.5)) * k;
    return [r * c, y, r * s];
  }
  /** 골반 통에서 몸 가운데 z 자리의 각 (앞쪽, 0 근처) */
  function hipAngleAtZ(j, z) {
    let lo = -Math.PI / 2, hi = Math.PI / 2;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (hipPoint(mid, j)[2] < z) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function hipGrid(a0f, a1f, segs, k) {
    const pos = [], uv = [], idx = [];
    HIP_ROWS.forEach((_, j) => {
      const a0 = a0f(j), a1 = a1f(j);
      for (let i = 0; i <= segs; i++) { pos.push(...hipPoint(a0 + ((a1 - a0) * i) / segs, j, k)); uv.push(i / segs, j / (HIP_ROWS.length - 1)); }
    });
    for (let j = 0; j < HIP_ROWS.length - 1; j++) for (let i = 0; i < segs; i++) {
      const n = j * (segs + 1) + i, m = n + segs + 1;
      idx.push(n, n + 1, m, n + 1, m + 1, m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 늘어진 띠 끝: 점(골반 좌표)을 잇는 납작한 천 한 장(너비는 z 쪽) — 양면 */
  function ribbon(points, widths) {
    const pos = [], uv = [], idx = [];
    points.forEach(([x, y, z], i) => {
      const w = widths[i] / 2;
      pos.push(x, y, z - w, x, y, z + w); uv.push(0, i / (points.length - 1), 1, i / (points.length - 1));
      if (i < points.length - 1) { const n = i * 2; idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  function pelvis(g, d) {
    rig = { pelvis: { g, pos: d?.pos ?? [0, 0.97, 0] }, thigh: {} }; // 새 인물의 첫 부위 — 다리 자락의 뼈로 쓴다
    const l = layer(g);
    const ring = hipGrid(() => Math.PI, () => Math.PI * 3, 40, 1); // 이음매는 뒤
    const ringMesh = addMerged(l, [ring], COAT, cloth);
    hangingClothShading(ringMesh.material);
    const band = hipGrid((j) => hipAngleAtZ(j, 0.02 - W_FRONT), (j) => hipAngleAtZ(j, 0.02), 1, 1 + LIFT / 0.12);
    const bandMesh = addMerged(l, [band], TRIM, cloth);
    hangingClothShading(bandMesh.material);
    // 캄마르반드 띠 끝 둘: 왼 앞(겉자락 쪽 — 오른쪽 앞섶 테를 가리지 않게)의 매듭(배 도막 띠 위)에서 엉덩이 위로 11 · 8.5 cm, 통 겉면에서 6 mm 앞
    const front = (y, z) => {
      const j = y > HIP_ROWS[1][0] ? 0 : 1, y0 = HIP_ROWS[j][0], y1 = HIP_ROWS[j + 1][0];
      const x0 = hipPoint(hipAngleAtZ(j, z), j)[0], x1 = hipPoint(hipAngleAtZ(j + 1, z), j + 1)[0];
      return THREE.MathUtils.lerp(x0, x1, clamp((y0 - y) / (y0 - y1), 0, 1)) + 0.006;
    };
    const tail = (pts, widths) => ribbon(pts.map(([y, z]) => [front(y, z), y, z]), widths);
    addMerged(l, [
      tail([[0.058, -0.068], [0.0, -0.072], [-0.052, -0.079]], [0.03, 0.032, 0.029]),
      tail([[0.056, -0.088], [0.01, -0.095], [-0.027, -0.102]], [0.027, 0.029, 0.026]),
    ], SASH, sashCloth);
  }

  // ── 가슴·배: 겉자락 앞섶 사선 테 (목 왼쪽 → 오른쪽 아래, 가슴 밑부터 띠까지 곧게) ──
  //  대표 메쉬(detail 모듈 soften 의 둥근 상자 — 가슴 0.24 × 0.28 × 0.37 · 배 0.22 × 0.155 × 0.32)의 앞면을 앞에서 쏜 광선으로 찾아 3.5 mm 띄운다
  //  (식 대신 실제 메쉬를 따라야 칸이 성긴 둥근 모서리에서도 테가 뜨지 않는다)
  const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _dir = new THREE.Vector3(-1, 0, 0);
  function surfaceBand(main, path, width, n) {
    const probe = new THREE.Mesh(main.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    probe.updateMatrixWorld(true);
    const frontX = (y, z) => {
      _ray.set(_o.set(1, y, z), _dir);
      const hit = _ray.intersectObject(probe, false)[0];
      return hit ? hit.point.x : 0;
    };
    const curve = new THREE.CatmullRomCurve3(path.map(([y, z]) => new THREE.Vector3(0, y, z)));
    const pts = curve.getSpacedPoints(n), pos = [], uv = [], idx = [];
    pts.forEach((pt, i) => {
      const tan = curve.getTangentAt(Math.min(1, i / n)), ny = -tan.z, nz = tan.y, len = Math.hypot(ny, nz) || 1;
      for (const s of [-1, 1]) {
        const y = pt.y + (s * width * ny) / (2 * len), z = pt.z + (s * width * nz) / (2 * len);
        pos.push(frontX(y, z) + 0.0035, y, z); uv.push((s + 1) / 2, i / n);
      }
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    probe.material.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  // 가슴 좌표 (y, z): 목 왼쪽 깃 안(서 있을 때 1.442 m, 가운데서 6.2 cm 왼쪽) → 1.36 m 에서 몸 가운데 → 가슴 밑(1.205 m) 2 cm 오른쪽
  const CHEST_PATH = [[0.112, -0.062], [0.09, -0.042], [0.06, -0.017], [0.03, 0.0], [0.0, 0.012], [-0.05, 0.019], [-0.125, 0.02]];
  function chestBand(g) {
    addMerged(layer(g), [surfaceBand(g.children[0], CHEST_PATH, W_FRONT, 16)], TRIM, { ...cloth });
  }
  // 배 좌표: 가슴 밑(1.196 m)에서 캄마르반드 윗단 밑(1.105 m)까지 곧게, 몸 가운데 2 cm 오른쪽
  function abdomenBand(g) {
    addMerged(layer(g), [surfaceBand(g.children[0], [[0.066, 0.02], [0.02, 0.02], [-0.025, 0.02]], W_FRONT, 4)], TRIM, { ...cloth });
  }
  return { leg, boot, pelvis, chestBand, abdomenBand, COAT, TRIM, SASH };
}
