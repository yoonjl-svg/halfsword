// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 캐릭터 PM 의 schools.js 에 무기별 꾸러미가 다 생기면 이 표는 필요 없어진다.
export const WEAPON_MEASURES = {
  longsword: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 }, // 기본 AI 값 그대로 (회귀 기준)
  longsword_sharp: { contact: 1.51, reach: 1.77, clinch: 1.17, cutTime: 0.4 },
  arming_sword: { contact: 1.25, reach: 1.5, clinch: 0.96, cutTime: 0.38 },
  messer: { contact: 1.18, reach: 1.46, clinch: 0.91, cutTime: 0.37 }, // 유효 간격: 실측 최대의 ~95% — 최대 거리는 칼끝 스침만 닿아(트레이스 확인) 한 뼘 안쪽을 쓴다
  zweihander: { contact: 1.62, reach: 2.05, clinch: 1.25, cutTime: 0.48 },
  estoc: { contact: 1.6, reach: 2.05, clinch: 1.24, cutTime: 0.42 }, // 균형 재분배 후 재실측·유효 간격: 최대 도달의 안쪽(칼 중간이 닿게)
  sabre: { contact: 1.29, reach: 1.58, clinch: 1.0, cutTime: 0.38 },
  rapier: { contact: 1.48, reach: 1.72, clinch: 1.14, cutTime: 0.36 },
  falchion: { contact: 1.29, reach: 1.55, clinch: 1.0, cutTime: 0.38 },
  katana: { contact: 1.42, reach: 1.77, clinch: 1.1, cutTime: 0.42 }, // 균형 재분배 후 재실측·유효 간격: 실측 최대의 ~95% — 최대 거리는 칼끝 스침만 닿아(트레이스 확인) 한 뼘 안쪽을 쓴다
  qinggang: { contact: 1.32, reach: 1.55, clinch: 1.02, cutTime: 0.38 },
  hwandudaedo: { contact: 1.26, reach: 1.55, clinch: 0.97, cutTime: 0.42 }, // 유효 간격: 최대 도달의 안쪽(칼 중간이 닿게)
  excalibur: { contact: 1.61, reach: 1.87, clinch: 1.24, cutTime: 0.39 },
  excalibur_replica: { contact: 1.59, reach: 1.86, clinch: 1.23, cutTime: 0.42 },
  lightsaber: { contact: 1.56, reach: 1.72, clinch: 1.2, cutTime: 0.29 },
  tree_branch: { contact: 1.37, reach: 1.63, clinch: 1.06, cutTime: 0.36 }, // 유효 간격: 실측 최대의 ~95% — 최대 거리는 칼끝 스침만 닿아(트레이스 확인) 한 뼘 안쪽을 쓴다
  rubber_chicken: { contact: 1.07, reach: 1.21, clinch: 0.83, cutTime: 0.26 },
  frozen_tuna: { contact: 1.34, reach: 1.69, clinch: 1.03, cutTime: 0.46 }, // 재실측값 그대로 (좁히면 오히려 나빠짐 — 몸통이 굵어 붙으면 못 휘두른다)
};

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  ai.school = { ...ai.school, measure: m };
  ai.M = m;
  ai.foeReach = m.reach + 0.05;
}
