// 투야나 니콜라예바(id eira) v2 — '눈길의 사제' 겨울 사제복. 사장님 디자인 리뷰(10/10 21:0x) "사제복에 디테일이 너무 없어서 뭔지 모르겠어" +
//  사장님 그림(모티브)을 우리 로우폴리 결로 최대한 가깝게 (docs/characters/new_four_review_2026-10-10.md §4). v1(샛별 저장소 판, outfit_eira.js)은 보관 — ?look=eira:v1.
//  그림의 요소: 발목까지 오는 긴 남색 사제복(아래로 넓어지는 A 자) · 앞자락 트임 사이 흰 속치마 · 흰 어깨 망토(케이프) + 높은 흰 선 깃 + 검은 리본 매듭과 늘어진 두 끈
//   · 접어 올린 넓은 흰 소매 끝 · 손목 붕대 · 끈 묶는 검은 장화 · 물결치는 긴 은발(허리까지, 앞으로도 흘러내림) · 금빛 눈.
//  사제복은 다리마다 허벅지·정강이 도막이 따로 붙어 래그돌을 따라간다(미나미 하카마와 같은 체계). 바깥선은 서 있을 때 높이로 적은 한 A 자 선이고,
//  안쪽 가장자리는 두 다리가 가운데서 겹쳐 한 벌로 읽힌다. 무릎(0.53 m)부터 앞 가운데가 갈라져 흰 속치마가 보인다.
//  겉모습만: 대표 메쉬(상처가 붙는 겉면)는 같은 메쉬·같은 종류·같은 치수 값으로 꼴만 바꾼다(reshapeMain) — 몸·질량·관절·충돌체·손 구체 그대로.
//  +X 앞 · +Y 위 · +Z 오른쪽 (부위 좌표).
//  v3 (opts.chotki, 사장님 10/10 23:5x '왼손에 묵주 같은 걸'): 왼손목(빈손 farmO)에 정교회 기도 매듭줄(추트키 — 검은 털실 매듭 고리 + 작은 십자가 + 술)을
//   감아 늘어뜨린다. 겉모습만(물리 몸 없음). 빈손 아래팔은 쉴 때 아래로 늘어지므로(−y = 손 쪽) 고리는 손등 바깥(−z)을 따라 손 아래로.
//  v4 (opts.dangle, 사장님 10/11 00:4x '묵주가 잘 안보여. 들지 말고 긴 묵주를 손목에 감아 늘어뜨리게 해. 살짝 달랑거리게'): 손목에 두 바퀴 감고
//   남은 고리(약 27 cm, 매듭 지름 1.3 cm · 십자가 4.5 × 2.6 cm · 술 4 cm)를 아래로 늘어뜨린다. 두 마디 진자(겉모습만 — 물리 몸·충돌체 없음, 난수 없음):
//   그릴 때마다(onBeforeRender, 한 번 그리는 동안 한 번만) 손목 자리를 따라가며 무게로 늦게 흔들린다. 게임 판정·시뮬과 무관(그리기 전용).
//  v5 (opts.thick, 사장님 10/11 01:4x '투야나 매듭 굵기 키워'): v4 그대로 + 매듭 지름 1.3 → 2.0 cm · 줄 3.8 → 5.6 mm · 십자가 4.5 × 2.6 → 5.5 × 3.2 cm · 술 4 → 5 cm (진자 그대로)
export function createTuyanaOutfit(h, opts = {}) {
  const TK = !!opts.thick;
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, isoldeLock, artoriaCloth, sleeveVolume, taperedTube, reshapeMain, hangingClothShading } = h;
  const NAVY = 0x222c48; // 그림의 남색 (v1 0x202a40 보다 아주 조금 푸르게)
  const NAVY_EDGE = 0x18203a;
  const WHITE = 0xf1f0ec, FOLD = 0xc9ced6, UNDER = 0xdadde3; // 흰 망토·소매 끝 / 접힌 그늘 / 속치마(그림처럼 옅은 회백)
  const RIBBON = 0x15161b, BOOT = 0x1b1c22, LACE = 0x5c606c, BANDAGE = 0xe8e4da;
  const fabric = (g) => artoriaCloth(g, 'tuyana-fabric');
  const hairLayer = (g) => artoriaCloth(g, 'tuyana-hair');
  const DS = { ...CLOTH, side: THREE.DoubleSide };
  const hairMat = (look) => ({ ...CLOTH, roughness: 0.82 });
  const hairColor = (look) => look.hair || 0xc9cbe0;

  function setMain(g, color, roughness = 0.95) {
    const m = g.children[0].material;
    m.color.setHex(color); m.roughness = roughness; m.metalness = 0;
    return m;
  }
  function hideExtras(g) { for (const extra of g.children.slice(1)) extra.visible = false; }
  /** 둥근 상자(세분 많게) — 위 → 아래 배율 taperBottom */
  function softBox(w, hgt, d, radius, taperBottom = 1, seg = 6) {
    const geo = new THREE.BoxGeometry(w, hgt, d, seg, seg, seg), p = geo.attributes.position;
    const core = new THREE.Vector3(w / 2 - radius, hgt / 2 - radius, d / 2 - radius);
    const v = new THREE.Vector3(), near = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      near.set(THREE.MathUtils.clamp(v.x, -core.x, core.x), THREE.MathUtils.clamp(v.y, -core.y, core.y), THREE.MathUtils.clamp(v.z, -core.z, core.z));
      v.sub(near).normalize().multiplyScalar(radius).add(near);
      const s = THREE.MathUtils.lerp(taperBottom, 1, (v.y + hgt / 2) / hgt);
      p.setXYZ(i, v.x * s, v.y, v.z * s);
    }
    geo.computeVertexNormals();
    return geo;
  }
  /** 고리마다 단면이 다른 천 통(위·아래 열림). rows = [{ y, a0, a1 }], section(a, row) → [x, z]. 각 고리는 a0 → a1 을 segs 등분 */
  function arcLoft(rows, segs, section) {
    const pos = [], uv = [], idx = [];
    rows.forEach((r, j) => {
      for (let k = 0; k <= segs; k++) {
        const a = r.a0 + (r.a1 - r.a0) * (k / segs);
        const [x, z] = section(a, r);
        pos.push(x, r.y, z); uv.push(k / segs, j / (rows.length - 1));
      }
    });
    for (let j = 0; j < rows.length - 1; j++) for (let k = 0; k < segs; k++) {
      const n = j * (segs + 1) + k, m = n + segs + 1;
      idx.push(n, m, n + 1, n + 1, m, m + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 얇은 천(망토): 고리 [y, x 반지름, z 반지름, 모남] 을 이어 붙인다. folds = 아래로 갈수록 커지는 굵은 주름 */
  function drape(rings, folds = 0, n = 10, frontLift = 0) {
    const pos = [], uv = [], idx = [], sides = 48;
    rings.forEach(([y, rx, rz, power = 4], j) => {
      const t = j / (rings.length - 1);
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const r = (Math.abs(c / rx) ** power + Math.abs(s / rz) ** power) ** (-1 / power) * (1 + folds * t * Math.cos(a * n));
        pos.push(c * r, y + frontLift * t * Math.max(0, c) ** 2, s * r); uv.push(k / sides, t);
        if (j < rings.length - 1 && k < sides) {
          const i = j * (sides + 1) + k;
          idx.push(i, i + sides + 1, i + 1, i + 1, i + sides + 1, i + sides + 2);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 물결치는 머리 가닥: 점마다 옆(z)·앞뒤(x)로 번갈아 흔든다 */
  const wavy = (pts, amp, phase = 0) => {
    // 점 사이를 둘로 나눠 굽이를 촘촘히 하고, 아래로 갈수록 크게 흔든다(머리끝이 물결) — 첫 점(뿌리)은 그대로
    const dense = [];
    pts.forEach((p, i) => { if (i) dense.push(p.map((v, k) => (v + pts[i - 1][k]) / 2)); dense.push(p); });
    return dense.map(([x, y, z], i) => {
      const t = i / (dense.length - 1), w = amp * (0.6 + 1.6 * t) * (i === 0 ? 0 : 1);
      return [x + w * 0.45 * Math.sin(i * 1.6 + phase), y, z + w * Math.sin(i * 1.6 + phase)];
    });
  };
  function sideLock(points, widths, depth) {
    // 옆 머리 커튼: 앞뒤(X)로 넓은 가닥 — isoldeLock 을 축 바꿔 쓴다 (v1 과 같은 방법)
    const geo = isoldeLock(points.map(([x, y, z]) => [z, y, x]), widths, depth);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getZ(i), p.getY(i), p.getX(i));
    const index = geo.index;
    for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
    geo.computeVertexNormals(); return geo;
  }

  // ── 머리: 이마를 덮는 앞머리(눈 위에서 끝남) · 얼굴 옆으로 물결치며 흘러내리는 옆머리 · 뒤통수 볼륨 ──
  function head(g, look) {
    const cap = g.children[4];
    if (cap?.isMesh && cap.geometry.type === 'SphereGeometry') {
      const geo = new THREE.SphereGeometry(0.112, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i)), t = Math.floor(i / 23) / 12;
        const theta = t * Math.PI * (0.66 - 0.25 * Math.max(0, Math.cos(a)));
        p.setXYZ(i, 0.112 * Math.sin(theta) * Math.cos(a), 0.112 * Math.cos(theta), 0.114 * Math.sin(theta) * Math.sin(a));
      }
      geo.computeVertexNormals(); cap.geometry.dispose(); cap.geometry = geo;
      cap.position.set(-0.008, 0.006, 0); cap.rotation.set(0, 0, 0);
      cap.material.color.setHex(hairColor(look));
    }
    const locks = [];
    // 앞머리: 가운데서 조금 갈라져 눈썹 위에서 끝나는 가닥 다섯
    for (let i = -2; i <= 2; i++) {
      const z = i * 0.024;
      locks.push(isoldeLock([[0.02, 0.108, z * 0.6], [0.08, 0.088, z], [0.101, 0.055, z * 1.05 + 0.004], [0.104, 0.036 + Math.abs(i) * 0.006, z * 1.08 + 0.008]], [0.03, 0.032, 0.024, 0.004], 0.008));
    }
    for (const s of [-1, 1]) {
      // 얼굴 옆으로 흘러내리는 물결 가닥(어깨 앞까지 — 가슴 도막이 이어 받는다)
      locks.push(sideLock(wavy([[0.04, 0.07, s * 0.098], [0.045, 0.0, s * 0.112], [0.05, -0.07, s * 0.118], [0.055, -0.14, s * 0.13], [0.065, -0.2, s * 0.14]], 0.009, s), [0.06, 0.07, 0.072, 0.07, 0.06], 0.02));
      locks.push(sideLock(wavy([[-0.03, 0.06, s * 0.105], [-0.035, -0.02, s * 0.124], [-0.03, -0.1, s * 0.14], [-0.02, -0.18, s * 0.152], [-0.015, -0.23, s * 0.158]], 0.011, 1 + s), [0.08, 0.1, 0.11, 0.1, 0.08], 0.024));
      locks.push(isoldeLock(wavy([[-0.06, 0.05, s * 0.085], [-0.105, -0.03, s * 0.095], [-0.135, -0.11, s * 0.108], [-0.15, -0.2, s * 0.115]], 0.012, s * 2), [0.06, 0.064, 0.06, 0.05], 0.015));
    }
    locks.push(isoldeLock(wavy([[-0.1, 0.04, 0], [-0.12, -0.05, 0], [-0.148, -0.13, 0.004], [-0.158, -0.21, 0]], 0.01), [0.11, 0.12, 0.112, 0.095], 0.015));
    addMerged(hairLayer(g), locks, hairColor(look), hairMat(look));
  }

  // ── 가슴: 남색 몸판 + 흰 어깨 망토(높은 흰 선 깃, 앞 가운데 검은 가장자리) + 검은 리본 매듭·늘어진 두 끈 + 뒤·앞 물결 머리 ──
  function chest(g, look) {
    const main = g.children[0];
    reshapeMain(main, softBox(0.23, 0.28, 0.345, 0.05, 0.86));
    setMain(g, NAVY); hideExtras(g);
    const layer = fabric(g);
    // 망토: 목에서 어깨를 덮고 가슴 중간(앞)·팔 윗부분(옆)까지. 굵은 주름 몇 개
    //  둥근 어깨선(모남 2.2~2.6)·굵은 주름 여덟 · 앞은 가슴 중간, 옆·뒤는 위팔 가운데까지 조금 더 길다
    addMerged(layer, [drape([[0.197, 0.062, 0.072, 2], [0.176, 0.105, 0.15, 2.6], [0.15, 0.138, 0.212, 2.5], [0.11, 0.155, 0.25, 2.4], [0.05, 0.163, 0.27, 2.3], [-0.015, 0.166, 0.278, 2.2], [-0.06, 0.168, 0.282, 2.2]], 0.045, 8, 0.05)], WHITE, DS).name = 'tuyana-cape';
    // 망토 안쪽 그늘(아랫단 바로 안) — 아래에서 올려다볼 때 흰 판이 납작해 보이지 않게
    addMerged(layer, [drape([[-0.058, 0.163, 0.276, 2.2], [-0.05, 0.157, 0.27, 2.2]], 0.045, 8, 0.05)], FOLD, DS);
    // 높은 흰 선 깃
    addMerged(layer, [cyl(0.057, 0.063, 0.062, 18, true, [0, 0.19, 0])], WHITE, DS);
    addMerged(layer, [cyl(0.0575, 0.0575, 0.004, 18, true, [0, 0.221, 0])], FOLD, CLOTH);
    // 검은 리본: 깃 앞 매듭(고리 둘) + 망토 앞 가운데를 따라 몸판 위까지 늘어진 두 끈 (그림의 검은 띠)
    const capeFront = (y) => {
      const rings = [[0.197, 0.062], [0.176, 0.105], [0.15, 0.138], [0.11, 0.155], [0.05, 0.163], [-0.015, 0.166]];
      for (let i = 0; i < rings.length - 1; i++) {
        const [y0, r0] = rings[i], [y1, r1] = rings[i + 1];
        if (y <= y0 && y >= y1) return r0 + (r1 - r0) * ((y0 - y) / (y0 - y1)) + 0.006;
      }
      return 0.172;
    };
    addMerged(layer, [
      bake(new THREE.SphereGeometry(0.014, 10, 8), [0.068, 0.194, 0], null, [0.7, 0.85, 1]),
      bake(new THREE.SphereGeometry(0.026, 10, 6), [0.066, 0.196, 0.026], [0.35, 0, 0], [0.32, 0.55, 1]),
      bake(new THREE.SphereGeometry(0.026, 10, 6), [0.066, 0.196, -0.026], [-0.35, 0, 0], [0.32, 0.55, 1]),
    ], RIBBON, CLOTH);
    const bodyFront = (y) => 0.115 * THREE.MathUtils.lerp(0.86, 1, (y + 0.14) / 0.28) + 0.006;
    for (const s of [-1, 1]) addMerged(layer, [taperedTube([[0.072, 0.188, s * 0.008], [capeFront(0.16), 0.16, s * 0.014], [capeFront(0.1), 0.1, s * 0.019], [capeFront(0.03), 0.03, s * 0.023], [0.168, -0.03, s * 0.026], [bodyFront(-0.1), -0.1, s * 0.028], [bodyFront(-0.135), -0.135, s * 0.029]], [0.008, 0.009, 0.0095, 0.0095, 0.0095, 0.009, 0.0085], 36, 5)], RIBBON, CLOTH);
    // 뒤 머리: 망토 겉으로 허리까지(배 도막이 이어 받음) — 물결
    backHair(g, look, false);
    // 앞으로 흘러내린 머리: 어깨 앞 망토 위로 가슴까지 (앞에서 넓게 보이도록 앞을 향한 가닥)
    const front = [];
    for (const s of [-1, 1]) {
      front.push(isoldeLock(wavy([[0.11, 0.2, s * 0.115], [0.16, 0.14, s * 0.135], [0.178, 0.07, s * 0.142], [0.184, 0.0, s * 0.146], [0.182, -0.07, s * 0.15], [0.175, -0.13, s * 0.15]], 0.01, s), [0.06, 0.075, 0.08, 0.075, 0.06, 0.012], 0.012));
      front.push(isoldeLock(wavy([[0.06, 0.2, s * 0.17], [0.12, 0.13, s * 0.205], [0.14, 0.05, s * 0.222], [0.15, -0.03, s * 0.226], [0.148, -0.1, s * 0.222]], 0.012, 2 * s), [0.06, 0.07, 0.07, 0.06, 0.01], 0.012));
    }
    addMerged(hairLayer(g), front, hairColor(look), hairMat(look));
  }
  function backHair(g, look, lower) {
    const locks = [], shades = [];
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.042, ph = i * 1.3;
      const pts = lower
        ? [[-0.18, 0.11, z * 1.12], [-0.182, 0.05, z * 1.1], [-0.188, -0.01, z * 1.04], [-0.175, -0.07 + Math.abs(i) * 0.012, z]]
        : [[-0.15, 0.215, z * 0.8], [-0.178, 0.13, z * 1.05], [-0.186, 0.04, z * 1.1], [-0.184, -0.05, z * 1.06], [-0.182, -0.13, z * 1.1], [-0.183, -0.19, z * 1.12]];
      const widths = lower ? [0.07, 0.072, 0.06, 0.006] : [0.066, 0.074, 0.074, 0.072, 0.07, 0.064];
      (i === -2 || i === 1 ? shades : locks).push(isoldeLock(wavy(pts, 0.012, ph), widths, 0.016));
    }
    addMerged(hairLayer(g), locks, hairColor(look), hairMat(look));
    addMerged(hairLayer(g), shades, 0xaeb1c8, hairMat(look));
  }
  function abdomen(g, look) {
    reshapeMain(g.children[0], softBox(0.2, 0.155, 0.29, 0.06, 1.07));
    setMain(g, NAVY); hideExtras(g);
    backHair(g, look, true);
  }
  // ── 골반: 사제복 윗자락(서 있을 때 1.05 → 0.84 m) — 다리 도막 사제복 위를 덮는다 ──
  function pelvis(g) {
    reshapeMain(g.children[0], softBox(0.215, 0.17, 0.31, 0.045, 1.05));
    setMain(g, NAVY); hideExtras(g);
    addMerged(fabric(g), [drape([[0.085, 0.103, 0.15, 4], [0.02, 0.112, 0.168, 4], [-0.05, 0.124, 0.19, 4], [-0.13, 0.137, 0.21, 3.6]], 0.015, 8)], NAVY, DS);
  }

  // ── 다리: A 자 사제복 한 도막 (허벅지·정강이 따로) ──
  //  서 있을 때 높이 y(세계)로 적은 바깥선: 0.95 m(엉덩이) → 0.19 m(옷단, 장화 목이 보인다).
  //  out = 다리 축에서 바깥 가장자리, inner = 안쪽 가장자리(0.095 를 넘으면 몸 가운데를 지나 반대 다리 도막과 겹친다), rx = 앞뒤 반폭
  const HIP_Y = 0.95, HEM_Y = 0.19, SLIT_Y = 0.53;
  const ROBE = (y) => {
    const t = THREE.MathUtils.clamp((HIP_Y - y) / (HIP_Y - HEM_Y), 0, 1);
    return { out: 0.105 + 0.115 * t, inner: 0.097 + 0.035 * t, rx: 0.122 + 0.09 * t, t };
  };
  const smooth = (a, b, x) => { const u = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  /** 앞 트임 가장자리 각(바깥 = +90°, 안쪽 = −90°): 0.53 m(허벅지 도막 옷단 바로 아래) 위는 닫힘(−90°), 옷단에서 −12° */
  const slitEdge = (y) => THREE.MathUtils.degToRad(-90 + 78 * Math.pow(smooth(SLIT_Y, HEM_Y, y), 0.8));
  function robeRows(y0, y1, n, a0f, a1f, grow = 1) {
    return Array.from({ length: n + 1 }, (_, j) => {
      const y = y0 + (y1 - y0) * (j / n);
      return { y, a0: a0f(y), a1: a1f(y), grow };
    });
  }
  function robeSection(side, base, scale = 1) {
    return (a, r) => {
      const { out, inner, rx, t } = ROBE(r.y + base);
      const sa = Math.sin(a), ca = Math.cos(a);
      const fold = 1 + 0.028 * t * Math.cos(a * 7);
      const x = rx * ca * fold * scale, zr = (sa > 0 ? out : inner) * sa * fold * scale;
      return [x, side * zr];
    };
  }
  /** base = 그 도막 원점의 서 있을 때 세계 높이 (허벅지 0.715 · 정강이 0.29) */
  function robeLeg(g, d, base, yTop, yBot, scale, isShin) {
    const side = Math.sign(d?.pos?.[2] || 1);
    const main = g.children[0];
    // 허벅지 도막은 트임 없이 닫힌 통 — 무릎에서 두 도막 가장자리가 어긋나 흰 속치마가 가로줄로 비치지 않게. 트임은 정강이 도막에서만
    const edge = isShin ? (y) => slitEdge(y + base) : () => -Math.PI / 2;
    const rows = robeRows(yTop, yBot, 10, edge, () => Math.PI * 1.5);
    reshapeMain(main, arcLoft(rows, 44, robeSection(side, base, scale)));
    const m = setMain(g, NAVY);
    m.side = THREE.DoubleSide;
    hangingClothShading(m);
    // 트임 사이 흰 속치마 (트임이 열리는 높이부터)
    const top = Math.min(yTop, SLIT_Y - base); // 트임이 열리는 높이부터 — 무릎 틈으로 속치마 윗단이 비치지 않게
    if (isShin && top > yBot) {
      const under = robeRows(top, yBot, 6, () => THREE.MathUtils.degToRad(-115), () => THREE.MathUtils.degToRad(12));
      const mesh = addMerged(fabric(g), [arcLoft(under, 18, robeSection(side, base, scale * 0.965))], UNDER, DS);
      hangingClothShading(mesh.material);
    }
    if (isShin) {
      // 옷단 안쪽 짙은 단(안감) — 옷단 끝이 얇은 종이처럼 보이지 않게
      const hem = robeRows(yBot + 0.012, yBot, 1, (y) => slitEdge(y + base), () => Math.PI * 1.5);
      addMerged(fabric(g), [arcLoft(hem, 44, robeSection(side, base, scale * 0.995))], NAVY_EDGE, DS);
    }
  }
  function thigh(g, look, d) { robeLeg(g, d, 0.715, 0.235, 0.47 - 0.715, 1.02, false); }
  function shin(g, look, d) {
    robeLeg(g, d, 0.29, 0.56 - 0.29, HEM_Y - 0.29, 1, true);
    // 끈 묶는 검은 장화 목: 발목 ~ 종아리 (옷단 아래로 보인다)
    addMerged(fabric(g), [cyl(0.052, 0.046, 0.25, 14, false, [0, -0.115, 0])], BOOT, { ...CLOTH, roughness: 0.6 });
    addMerged(fabric(g), [-0.2, -0.17, -0.14, -0.11, -0.08, -0.05].flatMap((y) => [
      box(0.003, 0.004, 0.048, [0.05, y, 0], [0.38, 0, 0]),
      box(0.003, 0.004, 0.048, [0.051, y, 0], [-0.38, 0, 0]),
    ]), LACE, CLOTH);
    addMerged(fabric(g), [box(0.004, 0.17, 0.012, [0.049, -0.125, 0])], 0x2a2c33, CLOTH); // 끈 사이 혀
  }
  function foot(g) {
    setMain(g, BOOT, 0.6);
    addMerged(fabric(g), [box(0.252, 0.014, 0.113, [0, -0.034, 0]), box(0.05, 0.03, 0.1, [-0.095, -0.03, 0])], 0x14151a, CLOTH); // 밑창·굽
    addMerged(fabric(g), [-0.03, 0.0, 0.03].flatMap((x) => [
      box(0.004, 0.004, 0.06, [x, 0.04, 0], [0, 0.34, 0]),
      box(0.004, 0.004, 0.06, [x, 0.041, 0], [0, -0.34, 0]),
    ]), LACE, CLOTH);
  }
  // ── 팔: 넓은 남색 소매 + 접어 올린 넓은 흰 소매 끝 + 손목·손바닥 붕대 ──
  function upperArm(g) { setMain(g, NAVY); sleeveVolume(g, 1.05, 1.14); }
  /** 추트키: 손목 둘레 매듭 고리 + 아래로 늘어진 짧은 고리 + 십자가 + 술 */
  function chotki(g) {
    const KNOT = 0x101014, CORD = 0x1c1c22, CROSS = 0xbfc3c8;
    const ringY = -0.113, r = 0.0465, knots = [], cord = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      knots.push(bake(new THREE.SphereGeometry(0.0052, 7, 5), [Math.cos(a) * r, ringY + 0.003 * Math.sin(a * 2), Math.sin(a) * r], null, [1, 0.85, 1]));
    }
    cord.push(bake(new THREE.TorusGeometry(r, 0.0018, 4, 28), [0, ringY, 0], [Math.PI / 2, 0, 0]));
    // 늘어진 고리: 손목 바깥(−z)에서 두 가닥이 손 옆을 따라 내려와 손 아래에서 모인다 — 가닥마다 매듭
    const bottom = [0, ringY - 0.044, -0.05]; // 손 길이 안쪽에서 모인다 — 손에 감아 쥔 꼴로 읽히게(손끝 너머로 막대처럼 뻗지 않게)
    for (const s of [-1, 1]) {
      const pts = [[s * 0.014, ringY, -r], [s * 0.013, ringY - 0.016, -0.051], [s * 0.007, ringY - 0.031, -0.053], bottom];
      cord.push(taperedTube(pts, [0.0018, 0.0018, 0.0018, 0.0018], 16, 4));
      for (let k = 1; k <= 5; k++) {
        const u = k / 6, i = Math.min(2, Math.floor(u * 3)), f = u * 3 - i;
        const p0 = pts[i], p1 = pts[i + 1];
        knots.push(ball(0.0048, 7, 5, p0.map((v, j) => v + (p1[j] - v) * f)));
      }
    }
    knots.push(ball(0.0062, 8, 6, bottom)); // 모이는 매듭
    addMerged(fabric(g), knots, KNOT, { ...CLOTH, roughness: 1 });
    addMerged(fabric(g), cord, CORD, CLOTH);
    // 작은 십자가(세로 2.4 cm · 가로 1.3 cm)와 그 아래 검은 술
    const cy = bottom[1] - 0.017, cz = bottom[2] - 0.004;
    addMerged(fabric(g), [box(0.0045, 0.024, 0.0045, [0, cy, cz]), box(0.013, 0.0045, 0.0045, [0, cy + 0.004, cz])], CROSS, { roughness: 0.4, metalness: 0.5 });
    addMerged(fabric(g), [bake(new THREE.ConeGeometry(0.0075, 0.024, 8), [0, cy - 0.026, cz]), ball(0.005, 6, 5, [0, cy - 0.014, cz])], KNOT, { ...CLOTH, roughness: 1 });
  }
  /** v4 추트키: 손목 두 바퀴 + 두 마디로 늘어져 흔들리는 긴 고리 */
  function chotkiDangle(g) {
    const KNOT = 0x0e0e12, CORD = 0x1a1a20, CROSS = 0xc9ccd2;
    const KNOT_MAT = { ...CLOTH, roughness: 1 };
    const turns = [], cord = [];
    const KR = TK ? 0.0095 : 0.0062, CR = TK ? 0.0028 : 0.0019; // 손목 매듭 반지름 · 줄 반지름
    for (const [y, r] of TK ? [[-0.1, 0.05], [-0.12, 0.0495]] : [[-0.104, 0.0475], [-0.118, 0.047]]) {
      const nK = TK ? 17 : 22;
      for (let i = 0; i < nK; i++) {
        const a = (i / nK) * Math.PI * 2 + y * 40;
        turns.push(bake(new THREE.SphereGeometry(KR, 8, 6), [Math.cos(a) * r, y, Math.sin(a) * r], null, [1, 0.85, 1]));
      }
      cord.push(bake(new THREE.TorusGeometry(r, CR, 4, 28), [0, y, 0], [Math.PI / 2, 0, 0]));
    }
    addMerged(fabric(g), turns, KNOT, KNOT_MAT);
    addMerged(fabric(g), cord, CORD, CLOTH);
    // 늘어진 고리: 손목 바깥(−z) 아래쪽에 매단 두 마디. 마디마다 '−y 로 늘어진' 꼴로 만들고 돌려서 세운다
    const L1 = 0.1, L2 = 0.08;
    const strand = (len, w0, w1, n) => {
      const knots = [], lines = [];
      for (const sd of [-1, 1]) {
        const a = [sd * w0, 0, 0], b = [sd * w1, -len, 0];
        lines.push(taperedTube([a, [(a[0] + b[0]) / 2, -len / 2, 0.002], b], [CR, CR, CR], 8, 4));
        for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; knots.push(ball(TK ? 0.01 : 0.0065, 8, 6, [a[0] + (b[0] - a[0]) * u, -len * u, 0])); }
      }
      return { knots, lines };
    };
    const layerA = fabric(g);
    const pivotA = new THREE.Group(); pivotA.name = 'tuyana-chotki-a'; pivotA.position.set(0, TK ? -0.12 : -0.118, TK ? -0.054 : -0.05); layerA.add(pivotA);
    const sa = TK ? strand(L1, 0.017, 0.015, 5) : strand(L1, 0.013, 0.011, 6);
    const meshA = addMerged(pivotA, sa.knots, KNOT, KNOT_MAT);
    addMerged(pivotA, sa.lines, CORD, CLOTH);
    const pivotB = new THREE.Group(); pivotB.name = 'tuyana-chotki-b'; pivotB.position.set(0, -L1, 0); pivotA.add(pivotB);
    const sb = TK ? strand(L2 - 0.014, 0.015, 0.003, 3) : strand(L2 - 0.012, 0.011, 0.002, 4);
    sb.knots.push(ball(TK ? 0.013 : 0.0085, 8, 6, [0, -L2 + 0.006, 0])); // 모이는 큰 매듭
    addMerged(pivotB, sb.knots, KNOT, KNOT_MAT);
    addMerged(pivotB, sb.lines, CORD, CLOTH);
    if (TK) {
      addMerged(pivotB, [box(0.01, 0.055, 0.01, [0, -L2 - 0.034, 0]), box(0.032, 0.01, 0.01, [0, -L2 - 0.022, 0])], CROSS, { roughness: 0.35, metalness: 0.55 });
      addMerged(pivotB, [bake(new THREE.ConeGeometry(0.015, 0.05, 8), [0, -L2 - 0.091, 0]), ball(0.008, 6, 5, [0, -L2 - 0.066, 0])], KNOT, KNOT_MAT);
    } else {
      addMerged(pivotB, [box(0.007, 0.045, 0.007, [0, -L2 - 0.024, 0]), box(0.026, 0.007, 0.007, [0, -L2 - 0.014, 0])], CROSS, { roughness: 0.35, metalness: 0.55 });
      addMerged(pivotB, [bake(new THREE.ConeGeometry(0.011, 0.04, 8), [0, -L2 - 0.066, 0]), ball(0.006, 6, 5, [0, -L2 - 0.048, 0])], KNOT, KNOT_MAT);
    }
    // 두 마디 진자: 끝점 둘을 베를레 적분 + 길이 고정. 손목이 움직이면 고리가 늦게 따라온다
    const down = new THREE.Vector3(0, -1, 0), anchor = new THREE.Vector3(), q = new THREE.Quaternion(), dir = new THREE.Vector3();
    const p1 = new THREE.Vector3(), p1o = new THREE.Vector3(), p2 = new THREE.Vector3(), p2o = new THREE.Vector3(), tmp = new THREE.Vector3();
    let lastFrame = -1, lastT = 0, ready = false;
    meshA.onBeforeRender = (renderer) => {
      const frame = renderer.info.render.frame;
      if (frame === lastFrame) return;
      lastFrame = frame;
      const now = performance.now() / 1000, dt = ready ? Math.min(1 / 20, Math.max(1 / 240, now - lastT)) : 1 / 60;
      lastT = now;
      anchor.copy(pivotA.position).applyMatrix4(pivotA.parent.matrixWorld);
      if (!ready) { p1.copy(anchor).y -= L1; p2.copy(p1).y -= L2; p1o.copy(p1); p2o.copy(p2); ready = true; }
      const keep = Math.exp(-dt * 2.2), gdt2 = 9.8 * dt * dt; // 공기 저항(늦게 멎음) · 중력
      for (const [p, o] of [[p1, p1o], [p2, p2o]]) { tmp.copy(p).sub(o).multiplyScalar(keep); o.copy(p); p.add(tmp); p.y -= gdt2; }
      for (let it = 0; it < 3; it++) {
        p1.sub(anchor).setLength(L1).add(anchor);
        tmp.copy(p2).sub(p1).setLength(L2); p2.copy(p1).add(tmp);
      }
      pivotA.parent.getWorldQuaternion(q).invert();
      dir.copy(p1).sub(anchor).normalize().applyQuaternion(q);
      pivotA.quaternion.setFromUnitVectors(down, dir);
      pivotA.updateMatrixWorld(true);
      pivotA.getWorldQuaternion(q).invert();
      dir.copy(p2).sub(p1).normalize().applyQuaternion(q);
      pivotB.quaternion.setFromUnitVectors(down, dir);
      pivotB.updateMatrixWorld(true);
    };
  }
  function forearm(g, look, d) {
    setMain(g, NAVY); sleeveVolume(g, 1.16, 1.3);
    // 접어 올린 흰 소매 끝: 아래로 조금 넓어지는 통 + 위 가장자리(접힌 금) + 안쪽 남색 안감
    addMerged(fabric(g), [cyl(0.061, 0.064, 0.068, 16, true, [0, -0.072, 0])], WHITE, DS);
    addMerged(fabric(g), [cyl(0.0615, 0.0615, 0.004, 16, true, [0, -0.038, 0])], FOLD, CLOTH);
    addMerged(fabric(g), [cyl(0.0645, 0.0645, 0.004, 16, true, [0, -0.105, 0])], FOLD, CLOTH);
    // 손목 붕대: 손 구체(반지름 0.042, y −0.135) 둘레를 비스듬히 감은 띠 넷
    const wraps = [-0.108, -0.12, -0.132, -0.144].map((y, i) => {
      const dy = y + 0.135, r = Math.sqrt(Math.max(0, 0.042 * 0.042 - dy * dy)) + 0.0025;
      return cyl(Math.max(r, 0.03), Math.max(r, 0.03), 0.009, 14, true, [0, y, 0], [i % 2 ? 0.18 : -0.18, 0, 0.1]);
    });
    addMerged(fabric(g), wraps, BANDAGE, DS);
    if (opts.dangle && d?.name === 'farmO') chotkiDangle(g); // v4: 손목에 감아 늘어뜨려 흔들림
    else if (opts.chotki && d?.name === 'farmO') chotki(g); // 왼손(칼 안 든 손)만
  }
  return {
    head, chest, abdomen, pelvis,
    uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm,
    thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin,
    footF: foot, footB: foot,
  };
}
