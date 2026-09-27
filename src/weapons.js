// ─────────────────────────────────────────────────────────────
//  무기고: 실제 자료 기반(+부족한 곳은 물리적으로 추정) 데이터 중심 무기 목록.
//
//  칼(자루+폼멜+코등이+칼날)은 그대로 fighter.js의 강체 모델을 쓴다: 네 부분(칼날 없는
//  무기는 코등이를 뺀 세 부분)의 질량·무게중심·관성을 정하면 나머지(균형점, 손 느낌,
//  휘두르는 관성)는 물리 엔진이 알아서 계산한다. fighter.js는 spec.buildParts(look)이
//  돌려주는 배열을 그대로 칼 콜라이더로 만들 뿐이다 (원래 하드코딩돼 있던 롱소드 계산과
//  똑같은 모양).
//
//  자료 출처와 신뢰도는 scratchpad 연구 노트(weapon_research.md, 이 브랜치의 PM 보고서에도
//  요약)를 따른다: [M]=박물관·제작사 실측, [D]=그 실측값에서 계산으로 뽑아냄, [I]=참고할
//  실측이 없어 물리적으로 그럴듯하게 추정/창작한 값. 아래 각 무기 설명에 표기해 둔다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// 재질별 되튐(반발 계수). 칼끼리 부딪히면 곱해진다(Multiply 규칙) → 강철끼리 0.7² 정도,
//  고무 대 강철처럼 하나가 낮으면 거의 튕기지 않는다(고무 닭이 칼에 그냥 맞고 만다).
export const MATERIALS = {
  steel: { restitution: 0.7 },
  plasma: { restitution: 0.85 }, // 빛의 칼날이라도 코등이·자루는 부딪히면 튕긴다
  wood: { restitution: 0.35 },
  rubber: { restitution: 0.55 },
  frozen: { restitution: 0.2 }, // 얼린 생선: 물컹하지 않고 딱딱하지만 다시 튕기진 않는다
};

// 소리 담당의 재질 쌍 API(sound.impact({a,b,energy})) 가 아는 이름은 sound.js MATERIALS =
// ['steel','armor','flesh','wood','plasma','rubber'] 뿐이다. 물리 재질(위 표)과 소리 재질이
// 다른 것은 여기서 옮긴다 — 얼린 참치는 딱딱한 통나무 소리(wood)가 제일 가깝다.
export const SOUND_MATERIAL = { steel: 'steel', plasma: 'plasma', wood: 'wood', rubber: 'rubber', frozen: 'wood' };

// 감독이 정한 무기 등급 (docs/characters.md, 캐릭터 PM 계약) — 다섯 단계:
//   쓰레기(trash) < 커먼(common) < 레어(rare) < 에픽(epic) < 레전드(legend)
// 등급마다 power(타격 에너지 배율, 감독 확정: 0.65/1.0/1.05/1.1/1.2)와 durability(내구 0~1, docs/characters.md 53da1bb:
// 0.4/0.8/0.85/0.95/1.0)가 다르다. 무기 스펙에 직접 적으면 그 값이 이기고, 안 적으면 등급 기본값을 받는다.
// power는 combat.js가 실제로 에너지에 곱한다. durability는 아래 breakChance()로 "부딪힐 때마다 부러질 확률"이 된다.
// 부서지는 연출·그 뒤 흐름(맨손·주운 무기)은 감독이 붙인다.
export const TIERS = ['trash', 'common', 'rare', 'epic', 'legend'];
export const TIER_DEFAULTS = {
  trash: { power: 0.65, durability: 0.4 },
  common: { power: 1.0, durability: 0.8 },
  rare: { power: 1.05, durability: 0.85 },
  epic: { power: 1.1, durability: 0.95 },
  legend: { power: 1.2, durability: 1.0 },
};

// ── 파손 판정 규칙: 확률식 (감독 지시 — "예산을 넘으면 부러진다"는 너무 필연적이라 버렸다) ──
//  무기가 "칼끼리 세게 부딪힌 충격"이나 "투구·뼈를 치고 되튄 충격"(combat.js → fighter.absorbWeaponImpact, 충격량 J N·s)을
//  받을 때마다, 그 충돌 하나가 무기를 부러뜨릴 확률을 굴린다:
//      p(J) = BREAK.A × (1 − d)^BREAK.fragilityPow × min(1, J / BREAK.jRef)^BREAK.k ÷ 재질계수
//  · (1 − d)^4 (감독 지시로 지수 4): 내구 d가 1이면 0(레전드는 절대 안 부러짐). 쓰레기(0.4) 0.13 → 커먼(0.8) 0.0016 →
//    레어 0.0005 → 에픽 0.000006 으로 등급 사이가 크게 벌어진다.
//  · min(1, J/6)^2 : 얼마나 무게가 실린 충돌인가. 6 N·s(AI 대 AI 한 판의 상위 1% 충돌쯤)면 온전히, 가벼운 스침(중앙값 0.5~0.9)은
//    그 제곱 비율만큼만 센다 — 살짝 닿은 충돌로는 사실상 안 부러지고 크게 맞부딪힌 한 방이 위험하다.
//  · A = 12, 지수 4 실측(AI 대 AI 롱소드 상대 50판): 나뭇가지 70%, 참치 70%, 커먼 롱소드 한 자루당 약 4%, 에픽 청강검 0%
//    (docs/weapons.md §3a 표). 나뭇가지를 감독 목표 60%에 맞추려면 A 를 9쯤으로 내리면 된다.
//  · 재질계수: 얼린 참치는 강철보다 훨씬 잘 갈라지고(0.35, 내구도 0.6으로 따로 낮춤), 고무·플라스마 칼날은 부러질 것이 없다(무한 → 확률 0).
//  굴리는 난수는 fighter.js의 파이터별 전용 난수(Math.random 과 분리)라, 부러지지 않는 한 기존 시뮬 결과가 바뀌지 않는다.
export const BREAK = { A: 12, jRef: 6, k: 2, fragilityPow: 4 };
export const MATERIAL_TOUGHNESS = { steel: 1, wood: 1, frozen: 0.35, rubber: Infinity, plasma: Infinity };
/** 내구 d·재질의 무기가 충격량 J(N·s)짜리 충돌 한 번에 부러질 확률 (0~1) */
export function breakChance(J, durability, material) {
  const t = MATERIAL_TOUGHNESS[material] ?? 1;
  if (durability >= 1 || !Number.isFinite(t) || !(J > 0)) return 0;
  const fragility = (BREAK.A * (1 - durability) ** BREAK.fragilityPow) / t;
  return Math.min(1, fragility * Math.min(1, J / BREAK.jRef) ** BREAK.k);
}


// ── 관성 계산 도우미 (fighter.js 원래 롱소드 계산과 같은 식) ──
// 상자 모양 부품의 휘두르는 축(Ie, x·z 성분에 함께 쓴다)·비트는 축(It, y=칼 길이 방향) 관성.
function boxInertia(m, hx, hy, hz) {
  return { Ie: (m * ((2 * hx) ** 2 + (2 * hy) ** 2)) / 12, It: (m * ((2 * hx) ** 2 + (2 * hz) ** 2)) / 12 };
}
// 공 모양(폼멜) 관성: 어느 축이나 같다.
function sphereInertia(m, r) {
  const I = 0.4 * m * r * r;
  return { Ie: I, It: I };
}
/**
 * 칼날 자체의 무게중심·관성. comFrac = 무게중심이 칼날 길이의 몇 %인지(자루 쪽=0),
 * gyrationFrac = 그 무게중심을 축으로 한 회전 반경(칼날 길이의 비율, 실측 자료가 있으면
 * 그 conjugate-point 계산값을 그대로 쓴다). 비트는 축 관성은 롱소드의 실측값
 * (0.842kg·폭4.8cm·두께1.6cm → 0.0000736)을 질량·단면적 비로 옮겨 쓴 추정값 [D].
 */
function bladeInertia(mass, L, comFrac, gyrationFrac, width, thickness) {
  const comY = (comFrac - 0.5) * L;
  const Ie = mass * (gyrationFrac * L) ** 2;
  // width/thickness는 칼날 단면의 전체 폭·두께(m). 기준값 0.0000736은 롱소드 실측
  // (질량 0.842kg, 폭 4.8cm, 두께 1.6cm)이므로 그 전체 치수(0.048×0.016)에 대한 비로 옮긴다.
  // fighter.js driveSword()의 "날 세우기(손목 비틀기)" 힘은 이 비틀림 관성이 롱소드와 비슷하다고
  // 가정한 고정 세기(4, 25 등)를 쓴다 → 너무 얇은 칼날(라이트세이버 등)은 그 힘 그대로면 축이
  // 팽이처럼 돌아 발산한다. 0.45배 밑으로는 내려가지 않게 바닥을 둔다 (안정성 안전장치, 창작 [I]).
  const ratio = Math.max(0.45, (width * thickness) / (0.048 * 0.016));
  const It = 0.0000736 * (mass / 0.842) * ratio;
  return { comY, Ie, It };
}
const partTuple = (shape, y, mass, comY, Ie, It, color, isBlade = false) => [shape, y, [mass, comY, Ie, It], color, !!isBlade];

// 물리에는 영향 없는 장식용 메쉬. fighter.js가 칼 콜라이더를 다 만든 뒤
// spec.decorate?.(group, look)를 한 번 불러 준다 (group에 자유롭게 덧붙이면 된다).
function addMesh(group, geo, mat, pos) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  group.add(m);
  return m;
}

// 재질(빛깔) 결정: 기본은 강철(칼끝 은색, 날 제외 부분은 캐릭터 옷과 맞춘 손잡이/코등이 색).
function steelMatOpts(isBlade) {
  // 이 장면엔 환경 맵(envMap)이 없다 — metalness를 실제 강철만큼(0.9) 올리면 직접광 하이라이트
  // 말고는 다 새까맣게 나온다(반사할 "환경"이 없어서), 그래서 칼날이 "가늘고 어두운 막대"로
  // 보였다. metalness를 적당히 낮추고 그만큼 난반사(roughness는 살짝만)로 받쳐서, 환경 맵 없이도
  // "강철"로 밝게 읽히게 한다. 물리에는 영향 없다(장식용 메쉬 재질일 뿐).
  return isBlade ? { metalness: 0.35, roughness: 0.3 } : null;
}

// ── 곡도·외날 등 곡면 칼날/몸통 메쉬 (물리 콜라이더는 그대로 상자꼴 — 겉보기만 다르다) ──
// fighter.js가 spec.partMesh(idx, shape, color, matOpts, look)를 부를 수 있으면 그걸 쓴다.

/**
 * 단면이 쐐기꼴(등 쪽 두껍고 날 쪽은 거의 0두께)인 외날 칼날 지오메트리. curve>0이면 칼끝으로
 * 갈수록 등 방향(-x)으로 살짝 휘어 사브르·카타나 같은 곡도가 된다. hx/hy/hz는 콜라이더 상자의
 * 반너비·반길이·반두께(그대로 물려받는다) — 곡률은 ~1cm 안에서만 준다(콜라이더와 겉보기 약속).
 */
function edgedBladeGeometry(hx, hy, hz, curve = 0, segs = 16) {
  const ringAt = (t) => {
    const y = -hy + 2 * hy * t;
    const bend = -curve * t * t; // 자루 쪽은 그대로, 칼끝 쪽으로 갈수록 휜다
    return [
      [hx + bend, y, 0], // 날(얇은 쪽)
      [-hx + bend, y, hz], // 등 한쪽 모서리
      [-hx + bend, y, -hz], // 등 다른쪽 모서리
    ];
  };
  const verts = [];
  const quad = (p0, p1, p2, p3) => verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  let prev = ringAt(0);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    quad(prev[0], cur[0], cur[1], prev[1]); // 날 → 등1
    quad(prev[2], cur[2], cur[0], prev[0]); // 등2 → 날
    quad(prev[1], cur[1], cur[2], prev[2]); // 등1 → 등2 (칼등 면)
    prev = cur;
  }
  const base = ringAt(0);
  const tip = ringAt(1);
  verts.push(...base[0], ...base[2], ...base[1]); // 자루 쪽 마개
  verts.push(...tip[0], ...tip[1], ...tip[2]); // 칼끝 쪽 마개
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 단면이 마름모(양날 — 가운데 등마루가 두껍고 양옆 날로 갈수록 얇아짐)인 양날 칼날 지오메트리.
 * 롱소드 계열 곧은 검(암소드·츠바이핸더·지안·레이피어·엑스칼리버 등)에 쓴다. tipTaper>0이면
 * 칼끝으로 갈수록 폭이 좁아진다. hx/hy/hz는 콜라이더 상자의 반너비·반길이·반두께 그대로.
 */
function diamondBladeGeometry(hx, hy, hz, tipTaper = 0.3, segs = 16) {
  const ringAt = (t) => {
    const y = -hy + 2 * hy * t;
    const w = hx * (1 - tipTaper * t);
    const th = hz * (1 - tipTaper * 0.5 * t);
    return [
      [w, y, 0], // 오른쪽 날
      [0, y, th], // 등마루 앞
      [-w, y, 0], // 왼쪽 날
      [0, y, -th], // 등마루 뒤
    ];
  };
  const verts = [];
  const quad = (p0, p1, p2, p3) => verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  let prev = ringAt(0);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      quad(prev[k], cur[k], cur[k2], prev[k2]);
    }
    prev = cur;
  }
  const base = ringAt(0);
  const tip = ringAt(1);
  verts.push(...base[0], ...base[1], ...base[2], ...base[0], ...base[2], ...base[3]); // 자루 쪽 마개
  verts.push(...tip[0], ...tip[3], ...tip[2], ...tip[0], ...tip[2], ...tip[1]); // 칼끝 쪽 마개(반대 감김)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 단면이 각진 다각형(대충 둥근) 막대 지오메트리 — 나뭇가지·고무 닭 목·냉동 참치 몸통처럼
 * "칼날이 아닌" 부품을 밋밋한 상자 대신 자연스러운 몸통으로 보이게 한다. bend(t)는 [x,z] 오프셋
 * (t=0 자루 쪽 ~ t=1 끝), taper(t)는 그 위치의 단면 배율(1이면 hx/hz 그대로).
 */
function rodGeometry(hx, hy, hz, { bend, taper, sides = 10, segs = 14 } = {}) {
  const ringAt = (t) => {
    const y = -hy + 2 * hy * t;
    const s = taper ? taper(t) : 1;
    const [bx, bz] = bend ? bend(t) : [0, 0];
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      pts.push([Math.cos(a) * hx * s + bx, y, Math.sin(a) * hz * s + bz]);
    }
    return pts;
  };
  const verts = [];
  const quad = (p0, p1, p2, p3) => verts.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  let prev = ringAt(0);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      quad(prev[k], cur[k], cur[k2], prev[k2]);
    }
    prev = cur;
  }
  const center = (ring, y) => {
    let cx = 0, cz = 0;
    for (const [x, , z] of ring) { cx += x; cz += z; }
    return [cx / ring.length, y, cz / ring.length];
  };
  const base = ringAt(0);
  const bc = center(base, -hy);
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; verts.push(...bc, ...base[k2], ...base[k]); }
  const tip = ringAt(1);
  const tc = center(tip, hy);
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; verts.push(...tc, ...tip[k], ...tip[k2]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 칼날 부품(isBlade)에만 곡면 지오메트리를 입히는 partMesh 팩토리 (그 밖의 부품은 예전처럼
 * 상자·공 그대로). shape=['box',hx,hy,hz]를 그대로 물려받는다 — 물리 콜라이더는 안 바뀐다.
 */
function curvedBlade(build) {
  return (idx, isBlade, shape, color, matOpts, look) => {
    if (!isBlade || shape[0] !== 'box') return undefined;
    const [, hx, hy, hz] = shape;
    const geo = build(hx, hy, hz, look);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide, ...(matOpts || {}) }));
    m.castShadow = true;
    return m;
  };
}

/**
 * 날이 없는 무기(나뭇가지·고무 닭·냉동 참치)의 "몸통" 부품(둘 다 idx=2, 세 부품짜리 구성의
 * 마지막)만 밋밋한 상자 대신 자연스레 휘거나 가늘어지는 막대로 바꾼다.
 */
function bentBody(build) {
  return (idx, isBlade, shape, color, matOpts, look) => {
    if (idx !== 2 || shape[0] !== 'box') return undefined;
    const [, hx, hy, hz] = shape;
    const geo = build(hx, hy, hz, look);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide, ...(matOpts || {}) }));
    m.castShadow = true;
    return m;
  };
}

/** 무기 재질에 따라 칼 부품 겉면 재질을 다르게 (fighter.js가 그대로 shapeMesh에 넘긴다) */
export function weaponMatOpts(material, isBlade) {
  switch (material) {
    case 'plasma':
      return isBlade ? { emissive: 0x2f8fe0, emissiveIntensity: 2.4, color: 0xbfe6ff, metalness: 0, roughness: 0.2, toneMapped: false } : { metalness: 0.6, roughness: 0.35 };
    case 'rubber':
      return { metalness: 0, roughness: 0.95 };
    case 'wood':
      return { metalness: 0, roughness: 1 };
    case 'frozen':
      return { metalness: 0.15, roughness: 0.45 };
    default:
      return steelMatOpts(isBlade);
  }
}

// ── 무기마다 손을 잡는 방식에 따른 손목 힘 한계 (config.js WEAPON.maxAimTorque=22의 기본값은
//  "두 손목"을 가정한 값. 한 손이면 그 절반 남짓, 한 손 반이면 그 중간) ──
// 감독 확정: 한손 무기도 "양손으로 잡고 휘두른다"고 가정한다(현실의 한손검 이점 — 가벼운 몸놀림·빠른 자세 전환 — 을 지금 다
//  구현할 수 없으니 그 대신). 그래픽·grip 표시는 그대로 두고 손목·팔 힘 한계만 두손 값(22 N·m)으로 통일. 한손 값 12 는
//  Delp 1996 손목 굴곡 토크 실측(평균 12.2 N·m)이었고, 22 는 양손·팔 전체 기여 추정치 [D].
const GRIP_TORQUE = { 'one-hand': 22, 'hand-and-half': 22, 'two-hand': 22 };

function finalizeSpec(id, s) {
  // ...s를 먼저 펼치고 계산된 필드를 뒤에 둔다 (뒤에 적은 값이 이긴다) →
  //  controlOverrides처럼 "기본값과 병합"해야 하는 필드가 s의 원본 값에 덮어써지지 않는다.
  return {
    ...s,
    id,
    edged: s.edged !== false,
    mCut: s.mCut ?? 1,
    mThrust: s.mThrust ?? 1,
    mBlunt: s.mBlunt ?? 1,
    tier: s.tier ?? 'common', // 등급 안 적으면 커먼
    power: s.power ?? TIER_DEFAULTS[s.tier ?? 'common'].power, // 등급 공격력 배율 (mCut/mThrust/mBlunt 위에 한 번 더 곱한다)
    durability: s.durability ?? TIER_DEFAULTS[s.tier ?? 'common'].durability, // 등급 내구 (0~1, 감독이 쓸 계약 수치)
    // 충돌 한 번(충격량 J)에 부러질 확률. 재질상 안 부러지는 무기(고무·플라스마)와 레전드는 늘 0.
    breakChance(J) { return breakChance(J, this.durability, this.material); },
    fragile: breakChance(BREAK.jRef, s.durability ?? TIER_DEFAULTS[s.tier ?? 'common'].durability, s.material) > 0, // 부러질 수 있는 무기인가
    ignoreArmor: !!s.ignoreArmor,
    gripAlong: s.gripAlong ?? -0.14,
    twoHand: s.grip !== 'one-hand',
    soundMaterial: s.soundMaterial ?? SOUND_MATERIAL[s.material] ?? 'steel', // 소리 담당 API에 넘길 재질 이름
    controlOverrides: { maxAimTorque: GRIP_TORQUE[s.grip] ?? 22, ...s.controlOverrides },
  };
}

// ═════════════════════════════════════════════════════════════
//  1) 롱소드 (기본값, 절대 바뀌면 안 된다 — 기존 시뮬 결과와 그대로 맞아야 한다)
//     Albion Liechtenauer 훈련용 롱소드 실측치 그대로 (fighter.js에 있던 원래 계산과 동일)
// ═════════════════════════════════════════════════════════════
const longsword = finalizeSpec('longsword', {
  nameKo: '롱소드', nameEn: 'Longsword',
  grip: 'two-hand', material: 'steel',
  hiltLength: 0.13, bladeLength: 1.05, gripAlong: -0.14,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.16, 0.018, 0.1, 0.018);
    const pommel = sphereInertia(0.418, 0.03);
    const cross = boxInertia(0.18, 0.11, 0.015, 0.022);
    const blade = bladeInertia(0.842, L, 0.344, 0.253, 0.048, 0.016);
    return [
      partTuple(['box', 0.018, 0.1, 0.018], 0, 0.16, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.03], -0.12, 0.418, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.11, 0.015, 0.022], 0.115, 0.18, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.024, L / 2, 0.008], 0.13 + L / 2, 0.842, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  1b) 롱소드(실전용 보정판) — 기본 롱소드 수치는 Albion Liechtenauer *훈련용* 페더(1.58kg,
//      균형점 9.8cm)에서 왔다(docs/weapons_research.md, docs/weapon_leads.md 확인). 진짜 날 선
//      롱소드는 더 가볍다: Albion Crécy 전체 113.7cm·1.39kg·균형점 10.16cm [M, 제조사 공개 치수].
//      하이런 길이 0.13·칼날 0.90m로 두고 부품 질량을 (총질량 1.390, 균형점 10.16cm, 칼날 무게중심
//      0.344L 유지) 조건으로 풀어서 넣었다 [D]. 기본 롱소드는 절대 바꾸지 않고 별도 id로 둔다 —
//      DEFAULT_WEAPON 을 'longsword_sharp'로 바꾸면 전체 기본값이 이걸로 바뀐다(설정 스위치).
// ═════════════════════════════════════════════════════════════
const longswordSharp = finalizeSpec('longsword_sharp', {
  nameKo: '롱소드 (실전용)', nameEn: 'Longsword (sharp)',
  grip: 'two-hand', material: 'steel',
  hiltLength: 0.13, bladeLength: 0.9, gripAlong: -0.14,
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.139, 0.018, 0.1, 0.018);
    const pommel = sphereInertia(0.3168, 0.03);
    const cross = boxInertia(0.1564, 0.11, 0.015, 0.022);
    const blade = bladeInertia(0.7779, L, 0.344, 0.253, 0.048, 0.016);
    return [
      partTuple(['box', 0.018, 0.1, 0.018], 0, 0.139, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.03], -0.12, 0.3168, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.11, 0.015, 0.022], 0.115, 0.1564, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.024, L / 2, 0.008], 0.13 + L / 2, 0.7779, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  2) 암소드 — Albion Squire (13세기풍) 1.13kg·칼날 78.7cm·균형점 12.1cm [M]
// ═════════════════════════════════════════════════════════════
const armingSword = finalizeSpec('arming_sword', {
  nameKo: '암소드 (한손검)', nameEn: 'Arming Sword',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.1, bladeLength: 0.72,
  mCut: 1.0, mThrust: 1.0,
  // 양날: 가운데 등마루가 두껍고 양옆 날로 갈수록 얇아지는 마름모 단면.
  partMesh: curvedBlade((hx, hy, hz) => diamondBladeGeometry(hx, hy, hz, 0.32)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.11, 0.017, 0.06, 0.017);
    const pommel = sphereInertia(0.19, 0.026);
    const cross = boxInertia(0.1, 0.085, 0.012, 0.018);
    const blade = bladeInertia(0.73, L, 0.36, 0.25, 0.045, 0.012);
    return [
      partTuple(['box', 0.017, 0.06, 0.017], 0, 0.11, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.026], -0.1, 0.19, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.085, 0.012, 0.018], 0.095, 0.1, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.0225, L / 2, 0.006], 0.1 + L / 2, 0.73, blade.comY, blade.Ie, blade.It, 0xd4dae0, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  3) 메서 (langes messer) — Albion Soldat 0.955kg·칼날 61.6cm·균형점 10.2cm,
//     회전반경(conjugate-point 계산) 28.3% [M]/[D]. 외날, 단순한 코등이(나겔 생략)
// ═════════════════════════════════════════════════════════════
const messer = finalizeSpec('messer', {
  nameKo: '메서 (긴 칼)', nameEn: 'Langes Messer',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.11, bladeLength: 0.6,
  mCut: 1.05, mThrust: 0.9,
  // 외날: 등 쪽은 두껍고 날 쪽은 얇은 쐐기 단면. 메서는 실물도 거의 곧아 곡률은 살짝만 준다.
  partMesh: curvedBlade((hx, hy, hz) => edgedBladeGeometry(hx, hy, hz, 0.004)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.09, 0.017, 0.065, 0.017);
    const pommel = sphereInertia(0.17, 0.024);
    const cross = boxInertia(0.06, 0.05, 0.01, 0.015);
    const blade = bladeInertia(0.635, L, 0.38, 0.283, 0.039, 0.011);
    return [
      partTuple(['box', 0.017, 0.065, 0.017], 0, 0.09, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.024], -0.075, 0.17, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.05, 0.01, 0.015], 0.1, 0.06, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.0195, L / 2, 0.0055], 0.11 + L / 2, 0.635, blade.comY, blade.Ie, blade.It, 0xcfd6dc, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  4) 츠바이핸더 (Great Sword / Montante) — 전체 무게 2.4~4kg대, Albion "The Wallace"
//     2.892kg·칼날 117cm [M]. 균형점 실측 자료를 못 찾아(연구 노트 §14) 롱소드 가문의
//     비율로 크기만 올려서 추정 [I]
// ═════════════════════════════════════════════════════════════
const zweihander = finalizeSpec('zweihander', {
  nameKo: '츠바이핸더 (대형 양손검)', nameEn: 'Zweihänder',
  grip: 'two-hand', material: 'steel',
  hiltLength: 0.19, bladeLength: 1.17, gripAlong: -0.18,
  mCut: 1.1, mThrust: 0.85, mBlunt: 1.15,
  // 자루가 길어(0.16m 반경) 손 사이 지렛대가 롱소드보다 커서, 같은 손 힘으로도 더 큰 돌림힘을
  // 낼 수 있다 (안 그러면 2.9kg 칼이 22N·m 한도 그대로라 너무 굼떠서 전혀 못 이긴다 — 시뮬로 확인)
  controlOverrides: { maxAimTorque: 28 },
  // 양날: 두꺼운 등마루 + 양옆 날.
  partMesh: curvedBlade((hx, hy, hz) => diamondBladeGeometry(hx, hy, hz, 0.28)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.26, 0.02, 0.16, 0.02);
    const pommel = sphereInertia(0.62, 0.038);
    const cross = boxInertia(0.32, 0.14, 0.02, 0.026);
    const blade = bladeInertia(1.7, L, 0.34, 0.253, 0.056, 0.018);
    return [
      partTuple(['box', 0.02, 0.16, 0.02], 0, 0.26, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.038], -0.16, 0.62, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.14, 0.02, 0.026], 0.175, 0.32, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.028, L / 2, 0.009], 0.19 + L / 2, 1.7, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
  // 파리어하켄(parrying hook): 코등이 바로 위, 칼날이 시작되는 자리에서 양옆으로 뻗은 갈고리 —
  // 상대 칼을 걸어채거나 손을 보호한다. 물리에는 영향 없는 장식(콜라이더는 그대로 상자 하나).
  decorate(group, look) {
    const mat = new THREE.MeshStandardMaterial({ color: look.hilt, roughness: 0.6, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const hook = addMesh(group, new THREE.ConeGeometry(0.012, 0.09, 8), mat, [0, 0.2, s * 0.03]);
      hook.rotation.x = s * 1.1; // 칼끝 쪽으로 비스듬히, 바깥으로 벌어지게
      hook.castShadow = true;
    }
  },
});

// ═════════════════════════════════════════════════════════════
//  5) 에스톡 (튜크, 갑옷 찌르기 전용) — Cleveland Museum 1.6kg·칼날 125.3cm,
//     Met 1.616kg·칼날 106.9cm [M]. 균형점 자료 없음(연구 노트 §14) → 뻣뻣하고
//     테이퍼가 적은 각진 칼날이라 무게중심이 롱소드보다 앞쪽이라고 추정 [I]
// ═════════════════════════════════════════════════════════════
const estoc = finalizeSpec('estoc', {
  nameKo: '에스톡 (찌르기검)', nameEn: 'Estoc',
  grip: 'hand-and-half', material: 'steel',
  hiltLength: 0.14, bladeLength: 1.15, gripAlong: -0.15,
  mCut: 0.55, mThrust: 1.35, mBlunt: 0.9, // 날이 거의 없어 베기는 약하고, 갑옷 틈을 노리는 찌르기는 뛰어나다
  // 각진(사각/육각) 뻣뻣한 단면 — 실제 에스톡처럼 날이 아니라 뻣뻣한 각진 봉 느낌으로.
  partMesh: curvedBlade((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 6, taper: (t) => 1 - 0.18 * t })),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.14, 0.019, 0.12, 0.019);
    const pommel = sphereInertia(0.48, 0.032);
    const cross = boxInertia(0.14, 0.1, 0.015, 0.02);
    const blade = bladeInertia(0.84, L, 0.42, 0.27, 0.022, 0.022); // 각진(사각/육각) 단면: 폭≈두께
    return [
      partTuple(['box', 0.019, 0.12, 0.019], 0, 0.14, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.032], -0.13, 0.48, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.1, 0.015, 0.02], 0.125, 0.14, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.011, L / 2, 0.011], 0.14 + L / 2, 0.84, blade.comY, blade.Ie, blade.It, 0xc7ccd2, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  6) 세이버 (1796년 영국 경기병도) — 실전 원본 0.9~1.08kg, 칼날 82.6~84cm,
//     균형점 18.4~22cm(코등이에서, 곡도라 앞쪽으로 쏠림) [M]
// ═════════════════════════════════════════════════════════════
const sabre = finalizeSpec('sabre', {
  nameKo: '세이버 (기병도)', nameEn: 'Cavalry Sabre',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.11, bladeLength: 0.83,
  mCut: 1.25, mThrust: 0.85, mBlunt: 0.9, // 굽은 날의 베기 효율은 물리 모델이 다 담지 못해 보정
  // 기병도 특유의 뚜렷한 곡도 + 외날 쐐기 단면.
  partMesh: curvedBlade((hx, hy, hz) => edgedBladeGeometry(hx, hy, hz, 0.012)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.11, 0.017, 0.06, 0.017);
    const pommel = sphereInertia(0.16, 0.02);
    const cross = boxInertia(0.05, 0.04, 0.01, 0.013); // 나크본(손등을 가리는 고리)은 생략, 단순화
    const blade = bladeInertia(0.63, L, 0.46, 0.24, 0.032, 0.009);
    return [
      partTuple(['box', 0.017, 0.06, 0.017], 0, 0.11, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.02], -0.08, 0.16, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.01, 0.013], 0.09, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.016, L / 2, 0.0045], 0.11 + L / 2, 0.63, blade.comY, blade.Ie, blade.It, 0xd2d8dd, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  7) 레이피어 — Albion "Munich" rapier 1.56kg·칼날 83.5cm·균형점 6cm(코등이 바로 앞,
//     화려한 컵 힐트가 무게추 역할) [M]. 좀 더 가벼운 버전(1.1kg급)으로 잡는다 [I]
// ═════════════════════════════════════════════════════════════
const rapier = finalizeSpec('rapier', {
  nameKo: '레이피어', nameEn: 'Rapier',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.1, bladeLength: 0.95,
  mCut: 0.5, mThrust: 1.3, mBlunt: 0.7,
  // 가늘고 뻣뻣한 다이아몬드(마름모) 단면 — 찌르기 전용 칼답게 폭이 좁고 끝으로 갈수록 더 가늘어진다.
  partMesh: curvedBlade((hx, hy, hz) => diamondBladeGeometry(hx, hy, hz, 0.4)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.08, 0.014, 0.055, 0.014);
    const pommel = sphereInertia(0.09, 0.018);
    const cup = sphereInertia(0.55, 0.05); // 컵 힐트: 손을 덮는 둥근 방패
    const blade = bladeInertia(0.38, L, 0.3, 0.24, 0.018, 0.012); // 가늘고 뻣뻣한(다이아몬드 단면) 찌르기 전용
    return [
      partTuple(['box', 0.014, 0.055, 0.014], 0, 0.08, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.018], -0.07, 0.09, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['ball', 0.05], 0.06, 0.55, 0, cup.Ie, cup.It, look.hilt),
      partTuple(['box', 0.009, L / 2, 0.006], 0.1 + L / 2, 0.38, blade.comY, blade.Ie, blade.It, 0xdfe4e8, true),
    ];
  },
  // 컵 힐트 위에 스웹트 힐트(swept-hilt) 느낌의 가는 고리들을 더해 손을 감싸는 바구니 모양으로.
  decorate(group, look) {
    const mat = new THREE.MeshStandardMaterial({ color: look.hilt, roughness: 0.55, metalness: 0.45 });
    const rim = addMesh(group, new THREE.TorusGeometry(0.052, 0.004, 6, 20), mat, [0, 0.06, 0]);
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    for (const a of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      const bar = addMesh(group, new THREE.TorusGeometry(0.05, 0.0035, 6, 12, Math.PI * 0.6), mat, [0, -0.02, 0]);
      bar.rotation.y = a;
      bar.rotation.z = Math.PI / 2.3;
      bar.castShadow = true;
    }
  },
});

// ═════════════════════════════════════════════════════════════
//  8) 팔쉬온 — Thorpe falchion(13세기 원본) 0.904kg·칼날 80.3cm [M]. 균형점 자료 없음
//     → 넓고 앞이 무거운 외날 반달칼 형태라 무게중심이 앞쪽이라고 추정 [I]
// ═════════════════════════════════════════════════════════════
const falchion = finalizeSpec('falchion', {
  nameKo: '팔쉬온 (반달칼)', nameEn: 'Falchion',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.1, bladeLength: 0.8,
  mCut: 1.3, mThrust: 0.6, mBlunt: 1.1,
  // 기술 간격(TECH[].reach) 자동 보정 비율을 실측 그대로(약 0.8배) 쓰면 다가서는 시간 계산이
  // 너무 빡빡해져 공격을 걸다가 자꾸 제시간에 못 붙고 물러서기만 반복했다(무기 밸런스 시뮬로 확인
  // — src/ai.js의 reachScale 주석 참고). 이 무기만 그 보정을 끈다.
  techReachScale: 1,
  // 넓은 외날 반달 곡선 — 칼끝 쪽으로 갈수록 등 쪽으로 완만히 휜다.
  partMesh: curvedBlade((hx, hy, hz) => edgedBladeGeometry(hx, hy, hz, 0.006)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.08, 0.018, 0.06, 0.018);
    const pommel = sphereInertia(0.16, 0.022);
    const cross = boxInertia(0.05, 0.06, 0.012, 0.016);
    const blade = bladeInertia(0.614, L, 0.4, 0.26, 0.05, 0.007); // 끝으로 갈수록 넓어지는 칼날
    return [
      partTuple(['box', 0.018, 0.06, 0.018], 0, 0.08, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.022], -0.08, 0.16, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.06, 0.012, 0.016], 0.09, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.03, L / 2, 0.005], 0.1 + L / 2, 0.614, blade.comY, blade.Ie, blade.It, 0xd4dae0, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  9) 카타나 — 나가사(칼날) 통상 70~74cm, 전체 무게 1.0~1.3kg, 균형점(츠바 기준)
//     통상 ~14cm가 자주 인용됨 [I]-leaning(제작자·수련자 통설, 박물관 실측 원본 특정 못함)
// ═════════════════════════════════════════════════════════════
const katana = finalizeSpec('katana', {
  nameKo: '카타나', nameEn: 'Katana',
  grip: 'two-hand', material: 'steel',
  hiltLength: 0.25, bladeLength: 0.72, gripAlong: -0.22,
  mCut: 1.85, mThrust: 0.85, mBlunt: 0.95,
  controlOverrides: { wristVmax: 38, aimStiffness: 70 }, // 짧고 가벼워 손목을 더 빨리 돌릴 수 있다
  // 카타나 특유의 곡도(소리) + 외날 쐐기 단면.
  partMesh: curvedBlade((hx, hy, hz) => edgedBladeGeometry(hx, hy, hz, 0.01)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.2, 0.014, 0.14, 0.017); // 츠카: 길고 타원 단면
    const pommel = sphereInertia(0.06, 0.014); // 카시라(자루끝 마개), 가볍다
    const cross = boxInertia(0.04, 0.04, 0.005, 0.04); // 츠바: 얇고 넓은 원반
    const blade = bladeInertia(0.9, L, 0.4, 0.25, 0.03, 0.007);
    return [
      partTuple(['box', 0.014, 0.14, 0.017], 0, 0.2, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.014], -0.2, 0.06, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.005, 0.04], 0.24, 0.04, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.015, L / 2, 0.0035], 0.25 + L / 2, 0.9, blade.comY, blade.Ie, blade.It, 0xdadfe3, true),
    ];
  },
  // 츠바(둥근 코등이 원반)를 뚜렷하게 — 물리 콜라이더(얇은 사각 원반)는 그대로 두고 겉모습만 덧붙인다.
  decorate(group) {
    const tsuba = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, metalness: 0.4 }),
    );
    tsuba.position.y = 0.24; // 칼이 y축을 따라 뻗어 있으니, 원반 모양 그대로(원기둥 축=y) 꿰어 놓는다
    tsuba.castShadow = true;
    group.add(tsuba);
  },
});

// ═════════════════════════════════════════════════════════════
//  10) 청강검 (靑鋼劍, qinggang, 옛 id 'jian') — 랴오의 검. 감독 결정으로 지안(중국 검)을 에픽 등급 "청강검"으로
//      바꿨다(삼국지 조조의 보검 — "쇠도 진흙처럼 벤다"). 물리는 지안 자료 그대로: 0.8~0.9kg, 칼날 대개 70~80cm,
//      균형점 자료가 서로 어긋나(~10cm vs ~20cm) 절충 [I]-leaning. 한손이라 누르는 힘이 약하다(12N·m).
//      캐릭터 PM 계약: 가볍고 빠름·찌르기 강함(mThrust 1.15)·전설대로 잘 벰(mCut 1.35, 세이버·팔쉬온급).
//      등급 epic(power 1.1·내구 0.95)이라 실제 베기 배율은 1.35×1.1 ≈ 1.49 —
//      mCut 1.5로 잰 결과(롱소드 상대 승률 22%, 판당 severity 롱소드의 87%)와 같은 급이다.
//      mCut 은 상처 깊이(severity)에만 곱하고 표시되는 타격 J(물리값, 롱소드의 2/3쯤)는 안 바꾼다.
//      겉모습은 푸른 강철 칼날에 검은 자루 [I] 창작. 'jian' 은 별칭으로 남긴다.
// ═════════════════════════════════════════════════════════════
const QINGGANG_LOOK = { grip: 0x1c1c24, hilt: 0x2f6f7a };
const qinggang = finalizeSpec('qinggang', {
  nameKo: '청강검', nameEn: 'Qinggang Sword',
  grip: 'one-hand', material: 'steel',
  tier: 'epic',
  hiltLength: 0.12, bladeLength: 0.74,
  mCut: 1.35, mThrust: 1.15, mBlunt: 0.95, // 감독 확정치 (mCut 1.35)
  // 양날 + 가운데 등마루(지안 특유의 곧은 검등 능선).
  partMesh: curvedBlade((hx, hy, hz) => diamondBladeGeometry(hx, hy, hz, 0.3)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.1, 0.015, 0.09, 0.015);
    const pommel = sphereInertia(0.1, 0.02);
    const cross = boxInertia(0.04, 0.035, 0.008, 0.012);
    const blade = bladeInertia(0.61, L, 0.36, 0.25, 0.028, 0.009);
    return [
      partTuple(['box', 0.015, 0.09, 0.015], 0, 0.1, 0, grip.Ie, grip.It, QINGGANG_LOOK.grip),
      partTuple(['ball', 0.02], -0.09, 0.1, 0, pommel.Ie, pommel.It, QINGGANG_LOOK.hilt),
      partTuple(['box', 0.035, 0.008, 0.012], 0.11, 0.04, 0, cross.Ie, cross.It, QINGGANG_LOOK.hilt),
      partTuple(['box', 0.014, L / 2, 0.0045], 0.12 + L / 2, 0.61, blade.comY, blade.Ie, blade.It, 0xbfe3ea, true),
    ];
  },
  // 폼멜 끝에 매다는 붉은 술(劍穗) + 마름모꼴 호심(護心) 코등이 테두리.
  decorate(group, look) {
    const guardMat = new THREE.MeshStandardMaterial({ color: look.hilt, roughness: 0.5, metalness: 0.5 });
    const flourish = addMesh(group, new THREE.OctahedronGeometry(0.028, 0), guardMat, [0, 0.11, 0]);
    flourish.scale.set(1, 0.35, 0.6);
    flourish.castShadow = true;
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x7a1414, roughness: 0.9 });
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.95 });
    const cord = addMesh(group, new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), cordMat, [0, -0.14, 0]);
    cord.castShadow = true;
    addMesh(group, new THREE.SphereGeometry(0.018, 8, 6), tuftMat, [0, -0.185, 0]);
  },
});

// ═════════════════════════════════════════════════════════════
//  11) 환두대도 (고리자루 큰칼, 삼국시대) — 조선 환도 계열 참고치(1.0~1.3kg, 전체
//      ~1m, 칼날 ~68cm) [M]/[D] mixed, 이름이 가리키는 고대 대도는 실측을 못 찾아
//      비슷한 크기의 환도 자료로 대신한다(§14 참고)
// ═════════════════════════════════════════════════════════════
const hwandudaedo = finalizeSpec('hwandudaedo', {
  nameKo: '환두대도', nameEn: 'Hwandudaedo (Ring-Pommel Sword)',
  grip: 'hand-and-half', material: 'steel',
  hiltLength: 0.12, bladeLength: 0.68, gripAlong: -0.11,
  mCut: 1.25, mThrust: 0.9,
  // 환도 계열은 외날 곡도(사브르·카타나와 같은 계열) — 여태 상자 그대로였던 걸 고친다.
  partMesh: curvedBlade((hx, hy, hz) => edgedBladeGeometry(hx, hy, hz, 0.007)),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.12, 0.017, 0.1, 0.017);
    // 환두(고리자루)를 더 묵직하게: 실측 균형점 자료가 없는 무기라([I], 연구 노트 §14), 칼날을
    // 원래(0.97kg, 총중량의 75%) 지나치게 무겁게 잡아서 짧은 칼날인데도 손 기준 관성이 롱소드와
    // 맞먹어(둘 다 cutTime 실측 0.43s) 짧다는 이점이 하나도 안 살았다 — 무기 밸런스 시뮬로 확인한
    // 근본 원인. 칼날을 역사적 총중량 범위(1.0~1.3kg) 하한 쪽으로 가볍게 하고 그만큼 고리자루를
    // 무겁게 해 균형을 맞추면, 짧고 가벼운 칼답게 손목 기준 관성이 줄어 빠르게 돈다.
    const pommel = sphereInertia(0.28, 0.026);
    const cross = boxInertia(0.05, 0.04, 0.01, 0.03);
    const blade = bladeInertia(0.72, L, 0.4, 0.25, 0.03, 0.009);
    return [
      partTuple(['box', 0.017, 0.1, 0.017], 0, 0.12, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.026], -0.09, 0.28, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.01, 0.03], 0.11, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.015, L / 2, 0.0045], 0.12 + L / 2, 0.72, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
  // 환두(고리자루): 폼멜 자리에 뚜렷한 고리를 씌운다 — 물리는 공 모양 폼멜 그대로, 겉모습만 덧붙인다.
  decorate(group, look) {
    // 토러스는 기본이 xy 평면에 눕는 모양(구멍이 z를 본다) — 칼날 면을 보는 카메라(z축 방향)에서
    // 그대로 동그란 고리로 보인다. 회전 없이 그대로 둔다.
    const ring = addMesh(group, new THREE.TorusGeometry(0.026, 0.007, 8, 16), new THREE.MeshStandardMaterial({ color: look.hilt, roughness: 0.55, metalness: 0.45 }), [0, -0.09, 0]);
    ring.castShadow = true;
  },
});

// ═════════════════════════════════════════════════════════════
//  12) 엑스칼리버 — 전설의 검. 롱소드 가문의 비율을 그대로 쓰되(완벽한 균형이라는
//      설정), 실전 성능은 확실히 세지만 절대적이지 않게(밸런스 시뮬로 검증) [I] 창작
// ═════════════════════════════════════════════════════════════
// 엑스칼리버 진품·복제품은 겉모습이 완전히 같아야 한다(플레이어가 눈으로 구분할 수 없게) — 모양·
// 치수·색을 하나의 buildParts/decorate로 공유하고, 진품에만 칼날 오라를 덧붙인다. 성능(배율·질량)
// 차이는 buildParts를 부르는 쪽(mCut 등)에서만 갈라 눈에는 안 보이게 한다.
function excaliburParts(look) {
  const L = this.bladeLength;
  const grip = boxInertia(0.14, 0.019, 0.1, 0.019);
  const pommel = sphereInertia(0.36, 0.032); // 보석 박힌 폼멜
  const cross = boxInertia(0.15, 0.115, 0.016, 0.024);
  const blade = bladeInertia(0.7, L, 0.34, 0.253, 0.05, 0.016);
  return [
    partTuple(['box', 0.019, 0.1, 0.019], 0, 0.14, 0, grip.Ie, grip.It, 0x2a2440),
    partTuple(['ball', 0.032], -0.13, 0.36, 0, pommel.Ie, pommel.It, 0xf2c94c),
    partTuple(['box', 0.115, 0.016, 0.024], 0.115, 0.15, 0, cross.Ie, cross.It, 0xf2c94c),
    partTuple(['box', 0.025, L / 2, 0.008], 0.13 + L / 2, 0.7, blade.comY, blade.Ie, blade.It, 0xeef3f8, true),
  ];
}
const excaliburPartMesh = curvedBlade((hx, hy, hz) => diamondBladeGeometry(hx, hy, hz, 0.25));
// 보석 박힌 황금 코등이·폼멜 — 작은 보석 알을 몇 개 박아 "전설의 검"답게 (둘 다 똑같이 박혀 있다).
function excaliburGems(group) {
  const gems = [
    { color: 0xd63b3b, pos: [0, -0.13, 0.033] }, // 폼멜 정면
    { color: 0x2f6fd6, pos: [0.06, 0.115, 0] }, // 코등이 한쪽
    { color: 0x2fa85a, pos: [-0.06, 0.115, 0] }, // 코등이 반대쪽
  ];
  for (const { color, pos } of gems) {
    const gem = addMesh(group, new THREE.OctahedronGeometry(0.011, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1 }), pos);
    gem.castShadow = true;
  }
}

const excalibur = finalizeSpec('excalibur', {
  nameKo: '엑스칼리버', nameEn: 'Excalibur',
  grip: 'two-hand', material: 'steel',
  tier: 'legend', // 감독 등급: 레전드 → power 1.2·durability 1.0. 진품은 플레이어 전용(docs/characters.md)
  hiltLength: 0.13, bladeLength: 1.0, gripAlong: -0.15,
  mCut: 1.2, mThrust: 1.2, mBlunt: 1.1,
  partMesh: excaliburPartMesh,
  buildParts: excaliburParts,
  decorate: excaliburGems, // 진품·복제품 겉모습은 완전히 같다 — 진품의 오라는 aura.js(attachAura)가 main.js에서 붙인다
});

// ═════════════════════════════════════════════════════════════
//  12b) 엑스칼리버 복제품 — 하인리히(characters.js)가 "진품"이라 우기며 드는 가짜. 겉모습은
//      진품과 완전히 똑같다(플레이어가 눈으로 구분할 수 없어야 한다는 요청) — 오직 전설의
//      힘(power 배율 없음)과 aura.js 오라가 없다는 점만 다르다. 등급은 커먼.
// ═════════════════════════════════════════════════════════════
const excaliburReplica = finalizeSpec('excalibur_replica', {
  nameKo: '엑스칼리버 복제품', nameEn: 'Excalibur (replica)',
  grip: 'two-hand', material: 'steel',
  tier: 'common', // 제원·등급은 커먼 (power 1.0)
  hiltLength: 0.13, bladeLength: 1.0, gripAlong: -0.15,
  partMesh: excaliburPartMesh,
  buildParts: excaliburParts,
  decorate: excaliburGems,
});

// ═════════════════════════════════════════════════════════════
//  13) 라이트세이버 — 칼날은 거의 질량이 없는 플라스마(자루·이미터에 무게가 실린다).
//      쥐는 힘은 한 손 기준(gripType='one-hand')이라 물리 자체가 "가볍게 잘 돌지만
//      맞대면 무거운 칼에 밀린다"를 자연스럽게 만든다 — 별도 '이기는 판정' 없이
//      질량·관성만으로 밸런스를 만든다는 것이 설계 의도 [I] 창작
// ═════════════════════════════════════════════════════════════
const lightsaber = finalizeSpec('lightsaber', {
  nameKo: '라이트세이버', nameEn: 'Lightsaber', // 감독 최종: 고유 이름 없이 '라이트세이버' (에픽)
  grip: 'one-hand', material: 'plasma',
  tier: 'epic', // power 1.1 · 내구 0.95 (플라스마 칼날이라 어차피 안 부러진다)
  hiltLength: 0.15, bladeLength: 0.9,
  edged: true, ignoreArmor: true, mCut: 1.35, mThrust: 1.3,
  controlOverrides: { wristVmax: 36, aimDamping: 9 }, // 가볍고 매끄러운 이미터: 손목이 더 빨리 돌아간다
  // 플라스마 칼날은 각진 막대가 아니라 매끄러운 원기둥이어야 "에너지 칼날"답다.
  partMesh: curvedBlade((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 14 })),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.25, 0.016, 0.11, 0.016);
    const pommel = sphereInertia(0.35, 0.018); // 배터리·이미터 쪽에 무게가 쏠린다
    const cross = boxInertia(0.05, 0.017, 0.01, 0.017);
    // 플라스마 기둥: 테이퍼가 없는 균일한 막대라 무게중심은 정확히 가운데(50%),
    //  회전반경은 균일봉 이론값(1/√12 ≈ 0.289)에 가깝다
    const blade = bladeInertia(0.12, L, 0.5, 0.289, 0.024, 0.024);
    return [
      partTuple(['box', 0.016, 0.11, 0.016], 0, 0.25, 0, grip.Ie, grip.It, look.metal ?? 0x9aa3ad),
      partTuple(['ball', 0.018], -0.12, 0.35, 0, pommel.Ie, pommel.It, 0x4a4f57),
      partTuple(['box', 0.017, 0.01, 0.017], 0.13, 0.05, 0, cross.Ie, cross.It, 0x2b2e33),
      partTuple(['box', 0.012, L / 2, 0.012], 0.15 + L / 2, 0.12, blade.comY, blade.Ie, blade.It, 0x3fa9f5, true),
    ];
  },
  // 칼날 바깥에 반투명한 빛기둥을 하나 더 둘러 "빛나는 칼날" 느낌을 낸다 (물리에는 영향 없음)
  decorate(group) {
    const L = this.bladeLength;
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, L, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }),
    );
    glow.position.y = 0.15 + L / 2;
    group.add(glow);
  },
});

// ═════════════════════════════════════════════════════════════
//  14) 나뭇가지 — 아무 자료도 없다. 주워 든 막대기라는 설정대로 대충 만든 값 [I] 창작.
//      날이 없고(edged:false → 항상 둔기 판정), 세게 부딪히면 부러진다(breakChance 확률)
// ═════════════════════════════════════════════════════════════
const treeBranch = finalizeSpec('tree_branch', {
  nameKo: '나뭇가지', nameEn: 'Tree Branch',
  grip: 'one-hand', material: 'wood',
  hiltLength: 0.15, bladeLength: 0.8,
  tier: 'trash', // 감독 등급: 쓰레기 → power 0.65·durability 0.4 (한 판에 약 60% 확률로 부러진다)
  edged: false, mBlunt: 0.85, // 날이 없어 항상 둔기 판정 (총 타격 배율은 power 0.65 × mBlunt)
  // 몸통을 곧은 상자 대신 한쪽으로 완만히 휘어지며 끝으로 갈수록 가늘어지는 옹이진 막대로 —
  // 콜라이더는 그대로 상자라 판정엔 영향 없다(휘는 양은 ~1cm 안).
  partMesh: bentBody((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 6, bend: (t) => [0.012 * t * t, 0.006 * Math.sin(t * 3)], taper: (t) => 1.15 - 0.4 * t })),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.08, 0.018);
    const pommel = sphereInertia(0.02, 0.015); // 뭉툭한 밑동
    const blade = bladeInertia(0.25, L, 0.55, 0.29, 0.036, 0.03); // 울퉁불퉁, 거의 균일한 막대
    return [
      partTuple(['box', 0.02, 0.08, 0.018], 0, 0.05, 0, grip.Ie, grip.It, 0x5a4530),
      partTuple(['ball', 0.015], -0.1, 0.02, 0, pommel.Ie, pommel.It, 0x5a4530),
      partTuple(['box', 0.018, L / 2, 0.015], 0.15 + L / 2, 0.25, blade.comY, blade.Ie, blade.It, 0x6b4423, false),
    ];
  },
  // 옹이 + 옆으로 뻗은 잔가지 두어 개 + 끝에 달린 잎(새싹) — 실제로 나무에서 꺾어 온 가지처럼
  // 보이게 한다(참고: 젤다 시리즈의 "데쿠 나무막대"는 원줄기에 짧은 옹이 가지 몇 개와 잎 하나만
  // 달아도 "주워 온 나뭇가지"로 뚜렷이 읽힌다 — 그 어법을 따른다).
  decorate(group) {
    const L = this.bladeLength;
    const bark = new THREE.MeshStandardMaterial({ color: 0x4d3820, roughness: 1 });
    for (const t of [0.25, 0.5, 0.8]) addMesh(group, new THREE.SphereGeometry(0.02 + 0.01 * Math.random(), 6, 5), bark, [0.012, 0.15 + L * t, 0.01]);

    // 옆으로 삐죽 뻗은 잔가지 두 개 (원래 나무에서 갈라져 나온 가지의 밑동만 남은 흔적)
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x4a3418, roughness: 0.95 });
    const twigs = [
      { t: 0.36, side: 1, len: 0.1, bend: 0.9 },
      { t: 0.66, side: -1, len: 0.08, bend: 1.15 },
    ];
    for (const { t, side, len, bend } of twigs) {
      const y = 0.15 + L * t;
      const twig = addMesh(group, new THREE.ConeGeometry(0.009, len, 5), twigMat, [side * 0.018, y, side * 0.012]);
      twig.rotation.z = side * bend; // 원줄기에서 바깥·위쪽으로 비스듬히
      twig.rotation.x = 0.25 * side;
      twig.castShadow = true;
    }

    // 칼끝 쪽: 여린 새잎 몇 장 + 작은 새싹 — 갓 꺾은 가지 티가 나게 초록빛으로.
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f8f3d, roughness: 0.8, side: THREE.DoubleSide });
    const budMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
    const tipY = 0.15 + L * 0.97;
    const leaves = [
      [0.022, tipY - 0.035, 0.005, 0.3, 0.4],
      [-0.02, tipY - 0.01, 0.014, -0.4, 1.9],
      [0.012, tipY + 0.022, -0.016, 0.5, -1.1],
    ];
    for (const [x, y, z, rx, ry] of leaves) {
      const leaf = addMesh(group, new THREE.SphereGeometry(0.024, 7, 5), leafMat, [x, y, z]);
      leaf.scale.set(1, 0.32, 2.4); // 둥근 공을 납작하고 길게 눌러 잎 모양으로
      leaf.rotation.set(rx, ry, 0.3);
      leaf.castShadow = true;
    }
    addMesh(group, new THREE.SphereGeometry(0.011, 6, 5), budMat, [0, tipY + 0.045, 0]).castShadow = true;
  },
});

// ═════════════════════════════════════════════════════════════
//  15) 고무 치킨 — 장난 무기. 거의 무해하지만 부딪히는 느낌은 확실히 다르게(물렁하고
//      되튐이 낮다). 날이 없다 [I] 창작
// ═════════════════════════════════════════════════════════════
const rubberChicken = finalizeSpec('rubber_chicken', {
  nameKo: '고무 닭', nameEn: 'Rubber Chicken',
  grip: 'one-hand', material: 'rubber',
  hiltLength: 0.1, bladeLength: 0.35,
  // 날이 없는 무기는 몸통·팔다리를 때려도 판정상 아무 효과가 없다(fighter.applyWound: 머리·목만
  // 기절 효과가 있다) → 고무 닭이 이길 수 있는 유일한 길은 머리를 맞히는 것뿐이라, mBlunt를
  // 크게 올려도 몸통 타격은 여전히 무해하고 "머리에 제대로 맞으면 그래도 어질하다"만 세진다.
  edged: false, mBlunt: 2.6,
  controlOverrides: { aimStiffness: 34 }, // 물렁해서 정확히 겨누기 어렵다 (토크는 양손 가정으로 22)
  // 목 부분(자루 쪽)은 가늘고, 몸통(머리 쪽)으로 갈수록 굵어지며 옆으로 축 늘어지는 "흐물흐물한
  // 목" — 콜라이더는 그대로 곧은 상자.
  partMesh: bentBody((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 8, bend: (t) => [0.016 * Math.sin(t * 1.8), 0], taper: (t) => 0.5 + 0.75 * t })),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.05, 0.02); // 목 부분을 쥔다
    const pommel = sphereInertia(0.03, 0.02); // 다리 쪽
    const blade = bladeInertia(0.12, L, 0.5, 0.3, 0.06, 0.05); // 몸통+머리
    return [
      partTuple(['box', 0.02, 0.05, 0.02], 0, 0.05, 0, grip.Ie, grip.It, 0xf5d020),
      partTuple(['ball', 0.02], -0.08, 0.03, 0, pommel.Ie, pommel.It, 0xe8b830),
      partTuple(['box', 0.035, L / 2, 0.03], 0.1 + L / 2, 0.12, blade.comY, blade.Ie, blade.It, 0xf7d84a, false),
    ];
  },
  // 부리·볏·눈을 붙여 누가 봐도 "고무 닭"으로 보이게 한다 (물리에는 영향 없음)
  decorate(group) {
    const L = this.bladeLength;
    const headY = 0.1 + L; // 칼끝 = 닭 머리 쪽
    const skin = new THREE.MeshStandardMaterial({ color: 0xf7d84a, roughness: 0.95 });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.8 });
    const comb = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 });
    const eye = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
    addMesh(group, new THREE.SphereGeometry(0.04, 12, 10), skin, [0, headY, 0]);
    addMesh(group, new THREE.ConeGeometry(0.014, 0.035, 8), beak, [0, headY, 0.045]).rotation.set(Math.PI / 2, 0, 0);
    addMesh(group, new THREE.ConeGeometry(0.01, 0.03, 6), comb, [0, headY + 0.035, 0]);
    for (const s of [-1, 1]) addMesh(group, new THREE.SphereGeometry(0.008, 8, 6), eye, [s * 0.022, headY + 0.008, 0.03]);
    // 다리 두 개 (아래로 늘어진 채)
    for (const s of [-1, 1]) addMesh(group, new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), beak, [s * 0.02, -0.08, 0]);
  },
});

// ═════════════════════════════════════════════════════════════
//  16) 냉동 참치 — 두 번째 장난 무기. 얼린 통생선이라 은근히 묵직해서 맞으면 진짜
//      아프지만(mBlunt 높음), 쥐는 곳이 미끄러운 꼬리라 다루기 서투르다 [I] 창작
// ═════════════════════════════════════════════════════════════
const frozenTuna = finalizeSpec('frozen_tuna', {
  nameKo: '냉동 참치', nameEn: 'Frozen Tuna',
  grip: 'two-hand', material: 'frozen',
  hiltLength: 0.15, bladeLength: 0.75, gripAlong: -0.17,
  // 날이 없어 몸통 타격은 무해하다(§고무 닭 주석) → 머리에 맞았을 때만 확실히 세게 만든다
  edged: false, mBlunt: 2.2, durability: 0.6, // 커먼이지만 얼린 생선이라 내구 0.6·재질 frozen(0.35): 세게 맞부딪히면 쩍 갈라진다
  controlOverrides: { aimStiffness: 46, maxAimTorque: 16 }, // 미끄러운 꼬리를 쥐고 있어 손아귀 힘이 잘 안 실린다
  // 몸통을 곧은 상자 대신 가운데가 굵고 양끝(꼬리·머리)이 가늘어지는 물고기 몸매로.
  partMesh: bentBody((hx, hy, hz) => rodGeometry(hx, hy, hz, { sides: 8, taper: (t) => 0.5 + 1.1 * Math.sin(t * Math.PI) })),
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.15, 0.025, 0.12, 0.025); // 꼬리 쪽을 쥔다
    const pommel = sphereInertia(0.1, 0.03); // 꼬리지느러미
    const blade = bladeInertia(1.25, L, 0.45, 0.3, 0.1, 0.09); // 얼어붙은 몸통
    return [
      partTuple(['box', 0.025, 0.12, 0.025], 0, 0.15, 0, grip.Ie, grip.It, 0x8fa5b0),
      partTuple(['ball', 0.03], -0.15, 0.1, 0, pommel.Ie, pommel.It, 0x7d94a0),
      partTuple(['box', 0.05, L / 2, 0.045], 0.15 + L / 2, 1.25, blade.comY, blade.Ie, blade.It, 0xc3d8de, false),
    ];
  },
  // 등지느러미·가슴지느러미·꼬리지느러미 + 서리 반점 — 진짜 얼린 생선처럼.
  decorate(group) {
    const L = this.bladeLength;
    const finMat = new THREE.MeshStandardMaterial({ color: 0x5f7680, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
    const frostMat = new THREE.MeshStandardMaterial({ color: 0xf2f9fc, roughness: 0.9, transparent: true, opacity: 0.8 });
    const dorsal = addMesh(group, new THREE.ConeGeometry(0.09, 0.03, 3), finMat, [0, 0.15 + L * 0.45, 0.07]);
    dorsal.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    dorsal.castShadow = true;
    for (const s of [-1, 1]) {
      const pec = addMesh(group, new THREE.ConeGeometry(0.06, 0.02, 3), finMat, [s * 0.05, 0.15 + L * 0.35, 0]);
      pec.rotation.z = s * 0.9;
      pec.castShadow = true;
    }
    const tailFin = addMesh(group, new THREE.ConeGeometry(0.06, 0.05, 4), finMat, [0, 0.15 + L * 0.98, 0]);
    tailFin.rotation.x = Math.PI;
    tailFin.scale.set(1.6, 1, 0.3);
    tailFin.castShadow = true;
    // 서리: 몸통을 따라 작은 흰 반점 몇 개
    for (const t of [0.15, 0.35, 0.55, 0.75]) addMesh(group, new THREE.SphereGeometry(0.012, 6, 5), frostMat, [0.03, 0.15 + L * t, 0.02]);
  },
});

export const WEAPONS = {
  longsword, longsword_sharp: longswordSharp, arming_sword: armingSword, messer, zweihander, estoc, sabre, rapier, falchion,
  katana, qinggang, hwandudaedo, excalibur, excalibur_replica: excaliburReplica, lightsaber, tree_branch: treeBranch,
  rubber_chicken: rubberChicken, frozen_tuna: frozenTuna,
};

// 다른 담당이 쓰는 짧은 이름 → 정식 id (characters.js의 'branch', URL 파라미터의 'chicken' 등)
export const WEAPON_ALIASES = {
  branch: 'tree_branch', stick: 'tree_branch',
  jian: 'qinggang', // 옛 id (지안 → 청강검, 감독 결정)
  chicken: 'rubber_chicken', tuna: 'frozen_tuna',
  sharp: 'longsword_sharp', replica: 'excalibur_replica',
  arming: 'arming_sword', saber: 'lightsaber',
};

// 아무 무기도 지정하지 않았을 때(o.weapon 없음) 쓰는 기본 무기. 'longsword_sharp'로 바꾸면
// 실전용 롱소드 보정이 전체에 적용된다 — 기존 시뮬 수치가 바뀌므로 감독 결정 후에만 바꿀 것.
export const DEFAULT_WEAPON = 'longsword';

export const WEAPON_LIST = Object.values(WEAPONS);

/** id(또는 별칭)로 무기 사양을 찾는다. 모르는 id면 기본 무기(경고 한 번). */
const warned = new Set();
export function getWeapon(id) {
  const key = WEAPON_ALIASES[id] ?? id;
  const spec = WEAPONS[key];
  if (spec) return spec;
  if (id != null && !warned.has(id)) {
    warned.add(id);
    console.warn(`[weapons] 모르는 무기 id '${id}' → ${DEFAULT_WEAPON} 로 대신합니다`);
  }
  return WEAPONS[DEFAULT_WEAPON];
}
