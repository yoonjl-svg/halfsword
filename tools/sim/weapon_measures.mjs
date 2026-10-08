// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 10/8 ① 구조: 숫자는 이제 src/weapon_measured.js 한 곳에서 읽는다 (전엔 이 파일에 셋째 벌이 있었다 — 값은 같다).
//  거리 셋은 MEASURED, 베는 시간은 날것(MEASURED 넷째 칸) — 단 롱소드 줄은 기본 AI 값 그대로(베는 시간 0.30 = CUT_TIME_30, 회귀 기준)
//  생성기: `node tools/sim/weapon_measures.mjs --gen` (아래 맨 끝) — 같은 측정으로 전 무기를 재어 파일에 쓰고 손 표와 나란히 찍는다(비교란)
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';

export const WEAPON_MEASURES = Object.fromEntries(
  Object.entries(MEASURED).map(([id, m]) => [id, { contact: m[0], reach: m[1], clinch: m[2], cutTime: id === 'longsword' ? CUT_TIME_30.longsword : m[3] }]),
);

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
// cutTime 은 weapon_measure.mjs 가 거리와 달리 보정 없이 raw 로 적는다(롱소드 raw 0.43s). 그런데 롱소드 AI 는 0.3 을 쓴다 —
//  raw 그대로 끼우면 롱소드 말고 모든 무기의 AI 가 "내 베기는 롱소드보다 40% 늦다"고 착각해 너무 멀리서 공격을 걸었다
//  (3→4라운드 밸런스에서 확인한 근본 원인). 거리와 똑같이 롱소드 기준으로 보정한다: 0.3 × (무기 raw ÷ 롱소드 raw).
export const LONGSWORD_RAW_CUT = MEASURED.longsword[3]; // hybrid 재실측 롱소드 raw 0.41 (예전 levitate 0.43) — weapon_measured.js
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  const M = { ...m, cutTime: WEAPON_MEASURES.longsword.cutTime * (m.cutTime / LONGSWORD_RAW_CUT) };
  ai.school = { ...ai.school, measure: M };
  ai.M = M;
  // foeReach(상대 칼이 닿는 거리 어림)는 건드리지 않는다: 게임처럼 AI 생성자가 상대 무기로 정한 값(ai.foeM.reach + 0.05)을 쓴다.
  //  (예전엔 여기서 내 무기 사거리로 덮어써서, 짧은 칼 AI 가 롱소드 사거리를 짧게 어림하고 너무 가까이 서 있었다)
}
