// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 캐릭터 PM 의 schools.js 에 무기별 꾸러미가 다 생기면 이 표는 필요 없어진다.
export const WEAPON_MEASURES = {
  longsword: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 }, // 기본 AI 값 그대로 (회귀 기준)
  arming_sword: { contact: 1.33, reach: 1.57, clinch: 1.03, cutTime: 0.35 },
  zweihander: { contact: 1.66, reach: 2.08, clinch: 1.28, cutTime: 0.49 },
  estoc: { contact: 1.66, reach: 2.04, clinch: 1.28, cutTime: 0.46 },
  sabre: { contact: 1.4, reach: 1.67, clinch: 1.08, cutTime: 0.38 },
  rapier: { contact: 1.52, reach: 1.73, clinch: 1.17, cutTime: 0.29 },
  falchion: { contact: 1.4, reach: 1.62, clinch: 1.08, cutTime: 0.36 },
  monohoshizao: { contact: 1.51, reach: 2.01, clinch: 1.17, cutTime: 0.44 },
  qinggang: { contact: 1.37, reach: 1.61, clinch: 1.06, cutTime: 0.36 },
  excalibur: { contact: 1.61, reach: 1.86, clinch: 1.24, cutTime: 0.41 },
  excalibur_replica: { contact: 1.59, reach: 1.86, clinch: 1.23, cutTime: 0.42 },
  lightsaber: { contact: 1.54, reach: 1.73, clinch: 1.19, cutTime: 0.25 },
  tree_branch: { contact: 1.44, reach: 1.64, clinch: 1.11, cutTime: 0.33 },
  rubber_chicken: { contact: 1.07, reach: 1.21, clinch: 0.83, cutTime: 0.27 },
  frozen_tuna: { contact: 1.34, reach: 1.69, clinch: 1.03, cutTime: 0.46 },
};

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  ai.school = { ...ai.school, measure: m };
  ai.M = m;
  ai.foeReach = m.reach + 0.05;
}
