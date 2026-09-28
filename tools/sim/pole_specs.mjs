// 자루 무기 시제품 스펙 (docs/pole_frame_design.md §8, docs/handoff/motion_library_integration.md §8 의 "1단계")
//  무기 목록에는 넣지 않는다 — 부르는 도구가 WEAPONS 에 끼운다. staff_proto.mjs 에서 잰 값 그대로:
//   봉 proto_staff: 2.4 m(앞손 앞 1.2 · 뒤 1.2), 1.8 kg, 날 없음, 둔기 3.5, 레이피어식 탭 찌르기 → 롱소드 상대 약 40%
//   창 proto_spear: 같은 2.4 m 자루를 앞손 앞 1.5 m 로 쥠 + 창날 0.25 m 만 날(찌르기 1.3), 둔기 2.5 → 리그 평균 54%
//  동작 라이브러리를 켜면 몸 틀 E(자루): 마이어 봉 자세표 · 찌르기 + 정수리 내려치기
import { classifyWeapon } from '../../src/weapon_class.js';

const L = 1.2; // 앞손 앞
const R = 1.2; // 앞손 뒤
const rod = (m, len) => ({ Ie: (m * len * len) / 12, It: 0.00006 * (m / 0.9) });

export function registerPoleWeapons(WEAPONS) {
  const front = rod(0.9, L);
  const rear = rod(0.9, R);
  const parts = () => [
    [['box', 0.015, L / 2, 0.015], L / 2, [0.9, 0, front.Ie, front.It], 0x8a6d3b, true],
    [['box', 0.015, R / 2, 0.015], -R / 2, [0.9, 0, rear.Ie, rear.It], 0x8a6d3b, false],
  ];
  const common = {
    ...WEAPONS.longsword,
    grip: 'two-hand', twoHand: true, material: 'wood', gripAlong: -0.6, tier: 'common',
    partMesh: null, decorate: undefined, controlOverrides: WEAPONS.longsword.controlOverrides,
    thrustStyle: WEAPONS.rapier.thrustStyle, frame: 'pole', style: 'thrust', buildParts: parts,
  };
  WEAPONS.proto_staff = { ...common, id: 'proto_staff', nameKo: '봉 (시제품)', edged: false, mBlunt: 3.5, mCut: 0.5, mThrust: 1, hiltLength: 0, bladeLength: L };
  // 창은 앞을 길게 쥘 수 있다(SPEAR_FRONT=앞손 앞 길이 m, 길이 합 2.4 m 그대로): 봉처럼 가운데를 쥐면 칼과 닿는 거리가 같다
  const F = +(process.env.SPEAR_FRONT ?? 1.5); // 1.2 → 45% · 1.5 → 54% · 1.8 → 44% (리그 평균, 짝마다 24판)
  const sf = rod(1.8 * (F / (L + R)), F);
  const sr = rod(1.8 * (1 - F / (L + R)), L + R - F);
  const spearParts = () => [
    [['box', 0.015, F / 2, 0.015], F / 2, [1.8 * (F / (L + R)), 0, sf.Ie, sf.It], 0x8a6d3b, true],
    [['box', 0.015, (L + R - F) / 2, 0.015], -(L + R - F) / 2, [1.8 * (1 - F / (L + R)), 0, sr.Ie, sr.It], 0x8a6d3b, false],
  ];
  WEAPONS.proto_spear = { ...common, id: 'proto_spear', nameKo: '창 (시제품)', edged: true, mBlunt: 2.5, mCut: 0.5, mThrust: 1.3, hiltLength: F - 0.25, bladeLength: 0.25, buildParts: spearParts };
  for (const k of ['proto_staff', 'proto_spear']) classifyWeapon(WEAPONS[k]); // frame·style 은 위에서 정했다(자루 판정은 아직 자동이 아님) — 물리 값 점검만
  return ['proto_staff', 'proto_spear'];
}
