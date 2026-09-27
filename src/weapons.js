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

// 감독이 정한 무기 등급 (docs/characters.md, 캐릭터 PM 계약): 쓰레기(trash) / 커먼(common) / 레전드(legend).
// 등급마다 power(타격 에너지 배율, common=1.0)와 durability(내구, 0~1)가 다르다. 무기 스펙에 직접 적으면
// 그 값이 이기고, 안 적으면 등급 기본값을 받는다. 부서지는 연출·규칙은 감독이 붙인다 — 여기서는 수치만.
// (power는 combat.js가 실제로 에너지에 곱한다. durability는 아직 아무 데서도 안 쓰는 계약 수치이고,
//  지금 나뭇가지·냉동 참치가 부러지는 건 별도의 breakImpulse(칼끼리 부딪힌 충격량 예산, N·s) 때문이다.)
export const TIERS = ['trash', 'common', 'legend'];
export const TIER_DEFAULTS = {
  trash: { power: 0.85, durability: 0.15 },
  common: { power: 1.0, durability: 0.6 },
  legend: { power: 1.2, durability: 1.0 },
};


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
  return isBlade ? { metalness: 0.9, roughness: 0.25 } : null;
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
const GRIP_TORQUE = { 'one-hand': 12, 'hand-and-half': 17, 'two-hand': 22 };

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
    breakImpulse: s.breakImpulse ?? Infinity, // 부러지기까지의 충격량 예산 (N·s, Infinity면 안 부러짐)
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
});

// ═════════════════════════════════════════════════════════════
//  10) 지안 (중국 검) — 0.8~0.9kg, 칼날 대개 70~80cm. 균형점 자료가 서로 어긋나
//      (한쪽은 ~20cm, 다른 쪽은 ~10cm) [I]-leaning, 절충값으로 잡는다
// ═════════════════════════════════════════════════════════════
const jian = finalizeSpec('jian', {
  nameKo: '지안 (중국검)', nameEn: 'Jian',
  grip: 'one-hand', material: 'steel',
  hiltLength: 0.12, bladeLength: 0.74,
  mCut: 1.0, mThrust: 1.15, mBlunt: 0.95, // 캐릭터 PM 계약: 가볍고 빠름·찌르기 강함·누르는 힘 약함(한손 12N·m)
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.1, 0.015, 0.09, 0.015);
    const pommel = sphereInertia(0.1, 0.02);
    const cross = boxInertia(0.04, 0.035, 0.008, 0.012);
    const blade = bladeInertia(0.61, L, 0.36, 0.25, 0.028, 0.009);
    return [
      partTuple(['box', 0.015, 0.09, 0.015], 0, 0.1, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.02], -0.09, 0.1, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.035, 0.008, 0.012], 0.11, 0.04, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.014, L / 2, 0.0045], 0.12 + L / 2, 0.61, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
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
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.12, 0.017, 0.1, 0.017);
    const pommel = sphereInertia(0.16, 0.022); // 고리자루(환두)
    const cross = boxInertia(0.05, 0.04, 0.01, 0.03);
    const blade = bladeInertia(0.97, L, 0.4, 0.25, 0.03, 0.009);
    return [
      partTuple(['box', 0.017, 0.1, 0.017], 0, 0.12, 0, grip.Ie, grip.It, look.grip),
      partTuple(['ball', 0.022], -0.09, 0.16, 0, pommel.Ie, pommel.It, look.hilt),
      partTuple(['box', 0.04, 0.01, 0.03], 0.11, 0.05, 0, cross.Ie, cross.It, look.hilt),
      partTuple(['box', 0.015, L / 2, 0.0045], 0.12 + L / 2, 0.97, blade.comY, blade.Ie, blade.It, 0xd8dde3, true),
    ];
  },
});

// ═════════════════════════════════════════════════════════════
//  12) 엑스칼리버 — 전설의 검. 롱소드 가문의 비율을 그대로 쓰되(완벽한 균형이라는
//      설정), 실전 성능은 확실히 세지만 절대적이지 않게(밸런스 시뮬로 검증) [I] 창작
// ═════════════════════════════════════════════════════════════
const excalibur = finalizeSpec('excalibur', {
  nameKo: '엑스칼리버', nameEn: 'Excalibur',
  grip: 'two-hand', material: 'steel',
  tier: 'legend', // 감독 등급: 레전드 → power 1.2·durability 1.0. 진품은 플레이어 전용(docs/characters.md)
  hiltLength: 0.13, bladeLength: 1.0, gripAlong: -0.15,
  buildParts(look) {
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
  },
});

// ═════════════════════════════════════════════════════════════
//  12b) 엑스칼리버 복제품 — 하인리히(characters.js)가 "진품"이라 우기며 드는 싸구려 소품.
//      물리·판정은 기본 롱소드와 완전히 같고(부품 질량·관성·길이·비틀림 보정까지 동일) 겉모습만
//      엑스칼리버 금색. 등급은 커먼. 캐릭터 담당 계약(docs/school_contract.md)상 AI는 이 무기를
//      longsword 유파로 다루면 된다 (measure 값도 롱소드와 같다).
// ═════════════════════════════════════════════════════════════
const EXCALIBUR_LOOK = { grip: 0x2a2440, hilt: 0xf2c94c, blade: 0xeef3f8 };
const excaliburReplica = finalizeSpec('excalibur_replica', {
  nameKo: '엑스칼리버 (복제품)', nameEn: 'Excalibur (replica)',
  grip: 'two-hand', material: 'steel',
  tier: 'common', // 제원·등급은 롱소드(커먼)
  hiltLength: 0.13, bladeLength: 1.05, gripAlong: -0.14,
  controlOverrides: { twistScale: 1 }, // 롱소드와 똑같은 손목 비틀기 힘 (fighter.js가 롱소드에 강제하는 값)
  buildParts() {
    // 롱소드 부품 그대로 만들고 색만 바꾼다 (부품 순서·질량·관성 동일)
    return longsword.buildParts(EXCALIBUR_LOOK).map((part) => {
      const [shape, y, mass, , isBlade] = part;
      return [shape, y, mass, isBlade ? EXCALIBUR_LOOK.blade : part[3], isBlade];
    });
  },
});

// ═════════════════════════════════════════════════════════════
//  13) 라이트세이버 — 칼날은 거의 질량이 없는 플라스마(자루·이미터에 무게가 실린다).
//      쥐는 힘은 한 손 기준(gripType='one-hand')이라 물리 자체가 "가볍게 잘 돌지만
//      맞대면 무거운 칼에 밀린다"를 자연스럽게 만든다 — 별도 '이기는 판정' 없이
//      질량·관성만으로 밸런스를 만든다는 것이 설계 의도 [I] 창작
// ═════════════════════════════════════════════════════════════
const lightsaber = finalizeSpec('lightsaber', {
  nameKo: '라이트세이버', nameEn: 'Lightsaber',
  grip: 'one-hand', material: 'plasma',
  hiltLength: 0.15, bladeLength: 0.9,
  edged: true, ignoreArmor: true, mCut: 1.35, mThrust: 1.3,
  controlOverrides: { wristVmax: 36, aimDamping: 9 }, // 가볍고 매끄러운 이미터: 손목이 더 빨리 돌아간다
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
//      날이 없고(edged:false → 항상 둔기 판정), 세게 부딪히면 부러진다(breakImpulse)
// ═════════════════════════════════════════════════════════════
const treeBranch = finalizeSpec('tree_branch', {
  nameKo: '나뭇가지', nameEn: 'Tree Branch',
  grip: 'one-hand', material: 'wood',
  hiltLength: 0.15, bladeLength: 0.8,
  tier: 'trash', // 감독 등급: 쓰레기 → power 0.85(등급 기본값)·durability 0.15
  edged: false, breakImpulse: 9, // 몇 번 세게 맞부딪히면 부러진다 (총 타격 배율은 power 0.85 그대로)
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
  // 옹이 몇 개를 붙여 매끈한 상자가 아니라 진짜 나뭇가지처럼 보이게 한다
  decorate(group) {
    const L = this.bladeLength;
    const bark = new THREE.MeshStandardMaterial({ color: 0x4d3820, roughness: 1 });
    for (const t of [0.25, 0.5, 0.8]) addMesh(group, new THREE.SphereGeometry(0.02 + 0.01 * Math.random(), 6, 5), bark, [0.012, 0.15 + L * t, 0.01]);
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
  controlOverrides: { aimStiffness: 34, maxAimTorque: 11 }, // 물렁하고 가벼워 조준이 흐물흐물하다
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.05, 0.02, 0.05, 0.02); // 목 부분을 쥔다
    const pommel = sphereInertia(0.03, 0.02); // 다리 쪽
    const blade = bladeInertia(0.12, L, 0.5, 0.3, 0.06, 0.05); // 몸통+머리
    return [
      partTuple(['box', 0.02, 0.05, 0.02], 0, 0.05, 0, grip.Ie, grip.It, 0xf5e6a8),
      partTuple(['ball', 0.02], -0.08, 0.03, 0, pommel.Ie, pommel.It, 0xe8b830),
      partTuple(['box', 0.035, L / 2, 0.03], 0.1 + L / 2, 0.12, blade.comY, blade.Ie, blade.It, 0xfbf3d8, false),
    ];
  },
  // 부리·볏·눈을 붙여 누가 봐도 "고무 닭"으로 보이게 한다 (물리에는 영향 없음)
  decorate(group) {
    const L = this.bladeLength;
    const headY = 0.1 + L; // 칼끝 = 닭 머리 쪽
    const skin = new THREE.MeshStandardMaterial({ color: 0xfbf3d8, roughness: 0.95 });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.8 });
    const comb = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.8 });
    addMesh(group, new THREE.SphereGeometry(0.04, 12, 10), skin, [0, headY, 0]);
    addMesh(group, new THREE.ConeGeometry(0.014, 0.035, 8), beak, [0, headY, 0.045]).rotation.set(Math.PI / 2, 0, 0);
    addMesh(group, new THREE.ConeGeometry(0.01, 0.03, 6), comb, [0, headY + 0.035, 0]);
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
  edged: false, mBlunt: 2.2, breakImpulse: 14, durability: 0.25, // 세게 맞부딪히면 쩍 갈라진다 (커먼이지만 내구는 낮게)
  controlOverrides: { aimStiffness: 46, maxAimTorque: 16 }, // 미끄러운 꼬리를 쥐고 있어 손아귀 힘이 잘 안 실린다
  buildParts(look) {
    const L = this.bladeLength;
    const grip = boxInertia(0.15, 0.025, 0.12, 0.025); // 꼬리 쪽을 쥔다
    const pommel = sphereInertia(0.1, 0.03); // 꼬리지느러미
    const blade = bladeInertia(1.25, L, 0.45, 0.3, 0.1, 0.09); // 얼어붙은 몸통
    return [
      partTuple(['box', 0.025, 0.12, 0.025], 0, 0.15, 0, grip.Ie, grip.It, 0x8fa5b0),
      partTuple(['ball', 0.03], -0.15, 0.1, 0, pommel.Ie, pommel.It, 0x7d94a0),
      partTuple(['box', 0.05, L / 2, 0.045], 0.15 + L / 2, 1.25, blade.comY, blade.Ie, blade.It, 0x9db3bd, false),
    ];
  },
});

export const WEAPONS = {
  longsword, longsword_sharp: longswordSharp, arming_sword: armingSword, messer, zweihander, estoc, sabre, rapier, falchion,
  katana, jian, hwandudaedo, excalibur, excalibur_replica: excaliburReplica, lightsaber, tree_branch: treeBranch,
  rubber_chicken: rubberChicken, frozen_tuna: frozenTuna,
};

// 다른 담당이 쓰는 짧은 이름 → 정식 id (characters.js의 'branch', URL 파라미터의 'chicken' 등)
export const WEAPON_ALIASES = {
  branch: 'tree_branch', stick: 'tree_branch',
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
