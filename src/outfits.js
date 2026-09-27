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

export const OUTFITS = {
  bran_farmer: BRAN_FARMER,
  isolde_saber: ISOLDE_SABER,
  liao_ronin: LIAO_RONIN,
  heinrich_knight: HEINRICH_KNIGHT,
  margarethe_dragon: MARGARETHE_DRAGON,
};

/** dressPart가 부위 하나를 다 그린 뒤 불린다. look.outfit이 가리키는 세트에 그 부위용 함수가 있으면 얹는다. */
export function decorateOutfit(dressTo, d, look) {
  const set = look?.outfit && OUTFITS[look.outfit];
  const fn = set && set[d.name];
  if (fn) fn(dressTo, look, d);
}
