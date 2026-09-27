// ─────────────────────────────────────────────────────────────
//  겉모습 장식 레이어. fighter.js의 dressPart가 만든 기본 몸통(상자·캡슐) 위에
//  갑옷판·머리모양·수염·안대 같은 장식 메쉬를 "얹기만" 한다 — 콜라이더·질량·관절은
//  전혀 건드리지 않는다(완전히 시각 전용). 각 부위(pelvis, chest, uarmS...)는 몸의
//  래그돌 부위 그룹에 직접 자식으로 붙으므로, 그 부위가 넘어지든 흔들리든 항상 같이 따라간다.
//
//  좌표 규칙: dressPart와 같은 "그 부위 몸체 기준" 좌표를 쓴다(+x 앞, +y 위, +z 오른쪽).
//  칼 든 팔(uarmS·farmS)은 뼈가 앞으로 누워 있어 자세히 보면 그 부위에 넘겨준 그룹(dressTo)이
//  이미 알맞게 돌아가 있다 — dressPart가 이 그룹에 손 구체를 y=-0.135(먼 쪽=손목)에 놓은 것과
//  똑같이, 이 파일에서도 "+y = 몸통에 가까운 쪽(어깨), -y = 먼 쪽(손목)"로 다룬다.
//
//  삼각형·드로우콜을 아끼려고, 부위 하나에 여러 조각을 붙일 때는 지오메트리를 하나로 합쳐서
//  (mergeGeometries) 재질 하나당 메쉬 하나만 만든다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m4 = new THREE.Matrix4();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);

/** geo를 제자리에서 옮기고/돌리고/늘려서 돌려준다 (합치기 전에 각 조각을 부위 좌표로 "굽는다") */
function bake(geo, pos, rotEuler, scale) {
  _pos.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
  if (rotEuler) {
    _euler.set(rotEuler[0] || 0, rotEuler[1] || 0, rotEuler[2] || 0);
    _quat.setFromEuler(_euler);
  } else {
    _quat.identity();
  }
  _scale.set(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1);
  _m4.compose(_pos, _quat, _scale);
  geo.applyMatrix4(_m4);
  return geo;
}

const box = (w, h, d, pos, rot, scale) => bake(new THREE.BoxGeometry(w, h, d), pos, rot, scale);
const cyl = (rt, rb, h, segs, open, pos, rot) => bake(new THREE.CylinderGeometry(rt, rb, h, segs, 1, !!open), pos, rot);
const ball = (r, wSeg, hSeg, pos, rot, arcs) =>
  bake(new THREE.SphereGeometry(r, wSeg, hSeg, arcs?.[0] ?? 0, arcs?.[1] ?? Math.PI * 2, arcs?.[2] ?? 0, arcs?.[3] ?? Math.PI), pos, rot);
const cone = (r, h, segs, pos, rot) => bake(new THREE.ConeGeometry(r, h, segs), pos, rot);

/** 조각 목록을 하나로 합쳐 재질 하나짜리 메쉬로 붙인다. 곡면(투구·안대 등)은 double-side가 필요할 때만 켠다 */
function addMerged(parent, pieces, color, matOpts) {
  if (!pieces.length) return null;
  const geo = mergeGeometries(pieces, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.06, ...(matOpts || {}) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const STEEL_OPTS = { metalness: 0.7, roughness: 0.35 };

// ═══════════════════════════════════ 오소리 브란: 화전민 농부 ═══════════════════════════════════
const APRON = 0xcdbb92;
const APRON_DARK = 0xa89468;
const CUFF_BRAN = 0x6b5637;
const BRAN_FARMER = {
  abdomen(g) {
    // 앞치마 위쪽 (가슴받이)
    addMerged(g, [box(0.16, 0.14, 0.02, [0.16, 0.03, 0])], APRON);
  },
  pelvis(g) {
    // 앞치마 아래쪽 (허리부터 허벅지 위까지, 기존 옷자락 겉에 한 겹 더)
    addMerged(g, [cone(0.13, 0.22, 10, [0.15, -0.16, 0])], APRON);
    // 허리에 묶은 끈 자락 두 개 (앞으로 늘어짐)
    addMerged(g, [cyl(0.006, 0.006, 0.16, 4, false, [0.15, -0.28, -0.03], [0, 0, 0.15]), cyl(0.006, 0.006, 0.14, 4, false, [0.15, -0.3, 0.03], [0, 0, -0.1])], APRON_DARK);
  },
  // 소매를 걷어붙인 자국: 팔뚝 먼 쪽(손목 방향)에 두른 어두운 띠
  farmS(g) {
    addMerged(g, [cyl(0.05, 0.05, 0.03, 10, true, [0, -0.09, 0])], CUFF_BRAN);
  },
  farmO(g) {
    addMerged(g, [cyl(0.05, 0.05, 0.03, 10, true, [0, -0.09, 0])], CUFF_BRAN);
  },
};

// ═══════════════════════════════════ 이졸데 반 아커러: 평상복 ═══════════════════════════════════
const ISOLDE_SKIRT = 0x2b2e36;
const ISOLDE_TRIM = 0x4a4d57;
const ISOLDE_SABER = {
  // 옷깃 (목 둘레 얇은 테)
  chest(g) {
    addMerged(g, [cyl(0.078, 0.09, 0.03, 12, true, [0, 0.17, 0])], ISOLDE_TRIM);
  },
  // 허리 리본 (얇은 띠 하나, 화려하지 않게)
  abdomen(g) {
    addMerged(g, [box(0.006, 0.04, 0.05, [0.118, -0.02, 0])], ISOLDE_TRIM);
  },
  // 긴 치마 자락: 다리마다 따로 붙여서(래그돌이 벌어져도) 겹치지 않게, 넓적다리를 반쯘 덮는다
  thighF(g) {
    addMerged(g, [cyl(0.075, 0.15, 0.32, 12, true, [0, 0.02, 0])], ISOLDE_SKIRT, { side: THREE.DoubleSide });
  },
  thighB(g) {
    addMerged(g, [cyl(0.075, 0.15, 0.32, 12, true, [0, 0.02, 0])], ISOLDE_SKIRT, { side: THREE.DoubleSide });
  },
};

// ═══════════════════════════════════ 랴오 쓰위엔: 방랑 낭인 ═══════════════════════════════════
const LIAO_RONIN = {
  head(g) {
    // 장발: 뒤로 묶어 아래로 늘어뜨린 머리 (목~등 뒤까지)
    const hairPieces = [
      cyl(0.045, 0.03, 0.05, 10, false, [-0.09, -0.03, 0]), // 묶은 자리
      cone(0.035, 0.22, 8, [-0.1, -0.16, 0], [0.08, 0, 0]),
    ];
    addMerged(g, hairPieces, 0x111111, { roughness: 1 });
    // 안대: 한쪽 눈(기본 얼굴의 왼쪽 눈 상자와 같은 자리)만 작게 가리는 판 + 관자놀이로 짧게 이어지는 끈
    const patch = [
      ball(0.02, 10, 8, [0.096, 0.016, -0.035], [0, 0.3, 0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, 0.04, -0.06], [0, 0, 1.0]),
      cyl(0.004, 0.004, 0.05, 4, false, [0.07, -0.01, -0.06], [0, 0, -1.0]),
    ];
    addMerged(g, patch, 0x1a1a1a, { roughness: 0.9 });
  },
};

// ═══════════════════════════════════ 하인리히 도른: 은빛 중갑 기사 ═══════════════════════════════════
// 설정집: "화려한 배색"의 자칭 왕의 기사 — 은빛 판금이라도 수수하게 죽이지 않는다. 실전 갑옷보다
// 훨씬 반들반들하게 닦아(금속성↑·거칠기↓) 과시욕을 드러내고, 예전 금빛 복제 엑스칼리버·금장 취향을
// 잇는 금색 트림을 얇게 둘러 "자칭 왕"다운 허영을 남긴다
const HEINRICH_STEEL = { metalness: 0.85, roughness: 0.16 };
const HEINRICH_GOLD = 0xd8b23a;
const HEINRICH_KNIGHT = {
  // 판금 방어구가 붙는 부위 (수염이 붙는 head는 빠진다)
  armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'shinF', 'shinB']),
  chest(g) {
    // 가슴 판금 (기존 누빔 상의 겉에 한 겹) + 과시용 금테
    addMerged(g, [box(0.255, 0.24, 0.32, [0.005, 0.02, 0])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [box(0.01, 0.22, 0.01, [0.135, 0.02, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2 });
    // 어깨 견갑(팔 없는 쪽, uarmO는 몸통에서 늘어져 있어 어깨 캡을 chest에서 겹쳐 그린다)
  },
  abdomen(g) {
    // 배쪽 판금 벨트(fauld)
    addMerged(g, [cyl(0.135, 0.14, 0.09, 14, true, [0, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  pelvis(g) {
    // 허벅지 위쪽을 덮는 짧은 판금 자락(tasset) 두 장
    addMerged(g, [box(0.08, 0.16, 0.02, [0.13, -0.18, 0.09]), box(0.08, 0.16, 0.02, [0.13, -0.18, -0.09])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 어깨 견갑: +y(몸통 쪽) 끝을 둥글게 감싼다 — uarmS(칼 든 팔)는 dressTo가 이미 돌아가 있어도
  //  "+y = 몸통 쪽"인 규칙이 같이 적용된다(위 주석 참고). 테두리에 금띠를 둘러 과시욕을 더한다
  uarmS(g) {
    addMerged(g, [ball(0.075, 12, 8, [0, 0.09, 0], null, [0, Math.PI * 2, 0, Math.PI * 0.55])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.076, 0.076, 0.012, 12, true, [0, 0.05, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2 });
  },
  uarmO(g) {
    addMerged(g, [ball(0.075, 12, 8, [0, 0.09, 0], null, [0, Math.PI * 2, 0, Math.PI * 0.55])], 0xc7cdd3, HEINRICH_STEEL);
    addMerged(g, [cyl(0.076, 0.076, 0.012, 12, true, [0, 0.05, 0])], HEINRICH_GOLD, { metalness: 0.9, roughness: 0.2 });
  },
  // 손목 보호대(가운틀릿 커프): -y(손 쪽) 끝
  farmS(g) {
    addMerged(g, [cyl(0.055, 0.05, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  farmO(g) {
    addMerged(g, [cyl(0.055, 0.05, 0.05, 10, true, [0, -0.08, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 정강이받이(그리브)
  shinF(g) {
    addMerged(g, [cyl(0.058, 0.053, 0.24, 12, true, [0.006, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  shinB(g) {
    addMerged(g, [cyl(0.058, 0.053, 0.24, 12, true, [0.006, 0, 0])], 0xc7cdd3, HEINRICH_STEEL);
  },
  // 짧은 은수염
  head(g) {
    addMerged(g, [cone(0.045, 0.075, 10, [0.075, -0.075, 0], [0, 0, Math.PI])], 0xcfd3d6, { roughness: 0.95 });
  },
};

// ═══════════════════════════════════ 마르그레테 슈바르츠: 먹색 판금 · 용기사 ═══════════════════════════════════
// 설정집: "수수하고 차분한 배색", 칼자루에도 장식이 없는 인물 — 판금으로 바뀌어도 그 절제는 그대로
// 지킨다. 화려한 색 포인트(원래 있던 와인레드 트림)는 빼고, 무채색 안에서 짙고 옅은 판(2톤)만으로
// 깎아 만든 듯한 "빈틈없음"을 낸다. 견갑도 뾰족한 장식보다 낮고 두꺼운 쐐기꼴로 낮춰 과시보다
// 방어처럼 보이게 했다
const MG_PLATE = 0x2c2c32;
const MG_PLATE_DARK = 0x1c1c20;
const MARGARETHE_DRAGON = {
  chest(g) {
    addMerged(g, [box(0.26, 0.25, 0.34, [0, 0.01, 0])], MG_PLATE, STEEL_OPTS);
    // 이음매 자국(세로줄) — 색 대신 같은 계열의 더 짙은 판이라 눈에 안 띄고 만듦새만 드러낸다
    addMerged(g, [box(0.008, 0.24, 0.01, [0.132, 0.01, 0])], MG_PLATE_DARK, STEEL_OPTS);
  },
  abdomen(g) {
    addMerged(g, [cyl(0.13, 0.135, 0.1, 14, true, [0, 0, 0])], MG_PLATE, STEEL_OPTS);
  },
  // 골반: 기존 천 치마(기본 dressPart) 겉에 세로 판을 두른 갑주 치마 — "아래는 치마" 느낌의 핵심.
  // 자락 끝단도 같은 먹색 계열로 통일(원래 와인레드 포인트는 뺐다)
  pelvis(g) {
    const plates = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      plates.push(box(0.05, 0.3, 0.014, [Math.cos(a) * 0.185, -0.24, Math.sin(a) * 0.185], [0, a, 0]));
    }
    addMerged(g, plates, MG_PLATE, STEEL_OPTS);
    addMerged(g, [cyl(0.2, 0.235, 0.025, 20, true, [0, -0.39, 0])], MG_PLATE_DARK, STEEL_OPTS);
  },
  // 견갑: 낮고 두꺼운 쐐기꼴 — 각은 남기되 뾰족한 장식이 아니라 두꺼운 방어판처럼
  uarmS(g) {
    addMerged(g, [cone(0.085, 0.06, 6, [0, 0.075, 0])], MG_PLATE, STEEL_OPTS);
  },
  uarmO(g) {
    addMerged(g, [cone(0.085, 0.06, 6, [0, 0.075, 0])], MG_PLATE, STEEL_OPTS);
  },
};

// 마르그레테 v2: v1 갑옷 그대로 + 투구(오너 요청). 얼굴이 읽혀야 해서 얼굴을 막지 않는 코가리개
// 투구로 했다 — 돔을 앞쪽은 들고 뒤쪽은 내리게 기울여(이마 테가 눈 위에 걸린다) 뒤통수·목덜미를
// 덮는다. 볏이나 문장 대신 정수리에 낮은 능선 하나만(짙은 판) 둘러 절제를 지킨다.
// 붉은 머리는 투구 밑으로 삐져나온 옆머리(정면에서 보임)와 뒷머리(뒤에서 보임)로 드러난다.
// 순수 장식이라 세게 맞아도 벗겨지지 않는다(케틀햇과 달리 hasHelmet과 무관).
const MG_HELM_C = [-0.005, 0.015, 0];
const MG_HELM_TILT = [0, 0, 0.3];
const MG_HELM_DOME = [1, 1.12, 1]; // 살짝 뾰족하게
function mgHelmPiece(geo, dy) {
  if (dy) geo.translate(0, dy, 0); // 투구 자체 좌표에서 먼저 옮긴 뒤 같이 기울인다
  return bake(geo, MG_HELM_C, MG_HELM_TILT);
}
const MARGARETHE_DRAGON_HELM = {
  ...MARGARETHE_DRAGON,
  head(g, look) {
    addMerged(
      g,
      [
        bake(new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), MG_HELM_C, MG_HELM_TILT, MG_HELM_DOME), // 돔
        mgHelmPiece(new THREE.CylinderGeometry(0.121, 0.121, 0.022, 18, 1, true)), // 이마 테
        mgHelmPiece(new THREE.CylinderGeometry(0.12, 0.136, 0.045, 10, 1, true, Math.PI, Math.PI), -0.03), // 목가리개(뒤쪽 절반)
        box(0.01, 0.075, 0.018, [0.122, 0.012, 0]), // 코가리개
      ],
      MG_PLATE,
      STEEL_OPTS,
    );
    // 정수리 능선: 돔을 따라 앞에서 뒤로 휘는 낮은 둥근 띠
    addMerged(g, [bake(new THREE.TorusGeometry(0.119, 0.008, 4, 14, Math.PI), MG_HELM_C, MG_HELM_TILT, MG_HELM_DOME)], MG_PLATE_DARK, STEEL_OPTS);
    // 투구 밑으로 나온 붉은 머리: 얼굴 양옆으로 늘어진 옆머리 + 목가리개 밑으로 땋아 내린 머리 한 가닥
    // (흐트러진 머리보다 단정하게 땋은 머리가 "침묵의 벽"에 맞는다)
    const hair = [box(0.03, 0.13, 0.016, [0.03, -0.045, 0.099]), box(0.03, 0.13, 0.016, [0.03, -0.045, -0.099])];
    for (let i = 0; i < 5; i++) {
      const r = 0.03 - i * 0.0025;
      hair.push(bake(new THREE.SphereGeometry(r, 8, 6), [-0.118 - i * 0.008, -0.06 - i * 0.034, 0], null, [1, 1.35, 1]));
    }
    addMerged(g, hair, look.hair, { roughness: 1 });
  },
};

// ── 뿔·깃털 술처럼 휘는 것: 점 여러 개를 지나는 매끈한 곡선을 따라 굵기가 변하는 관을 만든다 ──
//  (원기둥 조각을 이어 붙이면 이음매마다 꺾이고 틈이 보여서 뿔은 막대기, 술은 발톱처럼 보였다)
const _tc = new THREE.Vector3();
const _tv = new THREE.Vector3();
function taperedTube(pts, radii, tubular = 12, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const last = radii.length - 1;
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    const f = u * last;
    const k0 = Math.min(last - 1, Math.floor(f));
    const r = radii[k0] + (radii[k0 + 1] - radii[k0]) * (f - k0);
    curve.getPointAt(u, _tc); // TubeGeometry도 같은 점을 중심으로 반지름 1짜리 고리를 만든다
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      _tv.fromBufferAttribute(pos, k).sub(_tc).multiplyScalar(r).add(_tc);
      pos.setXYZ(k, _tv.x, _tv.y, _tv.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
const mirrorZ = (pts) => pts.map(([x, y, z]) => [x, y, -z]);

// 마르그레테 v3: 오너 요청 "동그랗지 않게 더 장식적인 투구, 삼국지 마초나 용기사처럼".
// 둥근 돔 대신 팔각으로 각진 사발 위에 높은 첨탑을 세우고(면을 평평하게 칠해 각이 보인다),
// 마초 계열의 긴 붉은 깃털 술과 이마의 세 갈래 볏, 용기사 계열의 뒤로 휘는 두 뿔을 달았다.
// 특정 게임·작품의 투구를 그대로 베끼지 않고 실루엣 요소만 가져왔다. 얼굴은 여전히 열어 둔다
// (v2의 코가리개는 빼고 이마 테 가운데에 작은 뾰족 장식만). 색은 먹색 판 + 붉은 술 하나로 절제.
// 좌표는 "투구 자체 좌표"(y = 투구 축, 테 = y 0)로 잡은 뒤 한꺼번에 머리 위로 옮기고 기울인다.
const MG3_C = [-0.005, 0.015, 0];
const MG3_TILT = [0, 0, 0.22];
const onHelm = (geo) => bake(geo, MG3_C, MG3_TILT);
const oct = (geo) => geo.rotateY(Math.PI / 8); // 팔각의 평평한 면이 정면을 보게
const MG3_PLATE = { ...STEEL_OPTS, flatShading: true, side: THREE.DoubleSide };
// 뿔: 관자놀이 위에서 먼저 위로 솟았다가 뒤로 젖혀진다(옆으로 뻗으면 정면에서 귀처럼 보였다)
const MG3_HORN_R = [
  [0.02, 0.06, 0.095],
  [0.0, 0.115, 0.13],
  [-0.05, 0.16, 0.14],
  [-0.125, 0.185, 0.12],
];
const MG3_HORN_RADII = [0.025, 0.018, 0.011, 0.002];
// 깃털 술: 가는 가닥 여러 개는 붉은 발톱처럼 보여서, 굵게 한 덩어리로 부풀었다가 뒤로 흘러내리게
const MG3_PLUME = [
  [0, 0.175, 0],
  [-0.05, 0.215, 0],
  [-0.13, 0.2, 0],
  [-0.2, 0.12, 0],
  [-0.23, 0.04, 0],
];
const MG3_PLUME_RADII = [0.03, 0.042, 0.037, 0.025, 0.008];
const MARGARETHE_DRAGON_HORNED = {
  ...MARGARETHE_DRAGON,
  head(g, look) {
    const plate = [
      oct(new THREE.CylinderGeometry(0.124, 0.124, 0.032, 8, 1, true)), // 이마 테
      oct(new THREE.CylinderGeometry(0.104, 0.124, 0.05, 8, 1, true)).translate(0, 0.041, 0), // 사발
      oct(new THREE.ConeGeometry(0.104, 0.105, 8)).translate(0, 0.1185, 0), // 첨탑
      new THREE.CylinderGeometry(0.124, 0.142, 0.034, 8, 1, true, Math.PI, Math.PI).translate(0, -0.032, 0), // 목가리개 1
      new THREE.CylinderGeometry(0.14, 0.16, 0.034, 8, 1, true, Math.PI, Math.PI).translate(0, -0.062, 0), // 목가리개 2
      bake(new THREE.ConeGeometry(0.02, 0.034, 3), [0.124, -0.026, 0], [Math.PI, 0, 0], [0.4, 1, 1]), // 이마 가운데 뾰족 장식
      taperedTube(MG3_HORN_R, MG3_HORN_RADII, 10, 6), // 뿔(오른쪽)
      taperedTube(mirrorZ(MG3_HORN_R), MG3_HORN_RADII, 10, 6), // 뿔(왼쪽)
    ];
    // 투구 조각(판·볏·술)은 한 그룹으로 묶어 group.userData.helmet으로 넘긴다 — 오너 결정("실제로 막고,
    // 닳고, 완전히 부서지면 사라진다")을 전투 쪽이 켜면 fighter.js의 knockOffHelmet이 이 그룹을 통째로
    // 떼어 낸다. 방어 판정(hasHelmet)이 꺼져 있는 지금은 아무 일도 하지 않는다. 붉은 머리는 머리에 남는다
    const helm = new THREE.Group();
    g.add(helm);
    g.userData.helmet = helm;
    addMerged(helm, plate.map(onHelm), MG_PLATE, MG3_PLATE);
    // 이마의 세 갈래 볏 (가운데가 높고 양옆은 벌어진다) + 첨탑 끝 꼭지 — 짙은 판으로 도드라지게
    const crest = [
      bake(new THREE.ConeGeometry(0.03, 0.12, 4), [0.118, 0.075, 0], [0, 0, 0.18], [0.35, 1, 1]),
      bake(new THREE.ConeGeometry(0.022, 0.08, 4), [0.112, 0.055, 0.035], [0.35, 0, 0.18], [0.35, 1, 1]),
      bake(new THREE.ConeGeometry(0.022, 0.08, 4), [0.112, 0.055, -0.035], [-0.35, 0, 0.18], [0.35, 1, 1]),
      new THREE.SphereGeometry(0.016, 6, 4).translate(0, 0.172, 0),
    ];
    addMerged(helm, crest.map(onHelm), MG_PLATE_DARK, MG3_PLATE);
    // 첨탑 끝의 술 뭉치 + 뒤로 흘러내리는 굵은 술. 양옆 두 가닥이 폭을 더해 뒤에서 봐도 갈고리가
    // 아니라 술 다발로 읽히고, 끝으로 갈수록 가운데로 모인다
    const side = (s) => MG3_PLUME.map(([x, y], i) => [x * 0.94, y - 0.01, s * 0.03 * (1 - 0.6 * (i / (MG3_PLUME.length - 1)))]);
    const plume = [
      new THREE.SphereGeometry(0.032, 8, 6).translate(0, 0.178, 0),
      taperedTube(MG3_PLUME, MG3_PLUME_RADII, 14, 7),
      taperedTube(side(1), MG3_PLUME_RADII.map((r) => r * 0.8), 12, 6),
      taperedTube(side(-1), MG3_PLUME_RADII.map((r) => r * 0.8), 12, 6),
    ];
    addMerged(helm, plume.map(onHelm), look.plume ?? look.hair, { roughness: 0.95 });
    // 붉은 머리는 v2와 같다: 얼굴 양옆 옆머리 + 목가리개 밑으로 땋아 내린 머리
    const hair = [box(0.03, 0.13, 0.016, [0.03, -0.045, 0.099]), box(0.03, 0.13, 0.016, [0.03, -0.045, -0.099])];
    for (let i = 0; i < 5; i++) {
      const r = 0.03 - i * 0.0025;
      hair.push(bake(new THREE.SphereGeometry(r, 8, 6), [-0.118 - i * 0.008, -0.075 - i * 0.034, 0], null, [1, 1.35, 1]));
    }
    addMerged(g, hair, look.hair, { roughness: 1 });
  },
};

export const OUTFITS = {
  bran_farmer: BRAN_FARMER,
  isolde_saber: ISOLDE_SABER,
  liao_ronin: LIAO_RONIN,
  heinrich_knight: HEINRICH_KNIGHT,
  margarethe_dragon: MARGARETHE_DRAGON,
  margarethe_dragon_helm: MARGARETHE_DRAGON_HELM,
  margarethe_dragon_horned: MARGARETHE_DRAGON_HORNED,
};

/** dressPart가 부위 하나를 다 그린 뒤 불린다. look.outfit이 가리키는 세트에 그 부위용 함수가 있으면 얹는다. */
export function decorateOutfit(dressTo, d, look) {
  const set = look?.outfit && OUTFITS[look.outfit];
  const fn = set && set[d.name];
  if (!fn) return;
  const before = dressTo.children.length;
  fn(dressTo, look, d);
  // 방어구 부위: 이 부위에 얹은 판금 메쉬들을 userData.armor로 알려 둔다. 오너 결정("판금도 피해를
  // 줄여 주고, 닳고, 완전히 부서지면 사라진다")을 전투 쪽이 켜면 그 부위 내구도가 0일 때 이 메쉬들만
  // 숨기면 된다. 지금은 표시만 하고 아무 동작도 하지 않는다
  if (set.armorParts?.has(d.name)) dressTo.userData.armor = dressTo.children.slice(before);
}
