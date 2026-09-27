// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 캐릭터 PM 의 schools.js 에 무기별 꾸러미가 다 생기면 이 표는 필요 없어진다.
export const WEAPON_MEASURES = {
  longsword: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 }, // 기본 AI 값 그대로 (회귀 기준)
  longsword_sharp: { contact: 1.51, reach: 1.77, clinch: 1.17, cutTime: 0.4 },
  arming_sword: { contact: 1.25, reach: 1.5, clinch: 0.96, cutTime: 0.38 },
  messer: { contact: 1.23, reach: 1.46, clinch: 0.95, cutTime: 0.37 },
  zweihander: { contact: 1.62, reach: 2.05, clinch: 1.25, cutTime: 0.48 },
  estoc: { contact: 1.65, reach: 2.0, clinch: 1.27, cutTime: 0.44 },
  sabre: { contact: 1.29, reach: 1.58, clinch: 1.0, cutTime: 0.38 },
  rapier: { contact: 1.48, reach: 1.72, clinch: 1.14, cutTime: 0.36 },
  falchion: { contact: 1.29, reach: 1.55, clinch: 1.0, cutTime: 0.38 },
  katana: { contact: 1.44, reach: 1.77, clinch: 1.11, cutTime: 0.44 },
  qinggang: { contact: 1.32, reach: 1.55, clinch: 1.02, cutTime: 0.38 },
  hwandudaedo: { contact: 1.29, reach: 1.55, clinch: 1.0, cutTime: 0.42 },
  excalibur: { contact: 1.61, reach: 1.87, clinch: 1.24, cutTime: 0.39 },
  excalibur_replica: { contact: 1.59, reach: 1.86, clinch: 1.23, cutTime: 0.42 },
  lightsaber: { contact: 1.56, reach: 1.72, clinch: 1.2, cutTime: 0.29 },
  tree_branch: { contact: 1.41, reach: 1.63, clinch: 1.09, cutTime: 0.36 },
  rubber_chicken: { contact: 1.07, reach: 1.21, clinch: 0.83, cutTime: 0.26 },
  frozen_tuna: { contact: 1.32, reach: 1.64, clinch: 1.02, cutTime: 0.43 },
};

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  ai.school = { ...ai.school, measure: m };
  ai.M = m;
  ai.foeReach = m.reach + 0.05;
}
