// 11/12 팔 사람 꼴 넷을 전 판으로 묶기 (docs/strike/arm_real_2026-11-12.md §10): 옛 장면(씨앗 판 · 옛 결함 재현 · 잰 때 조건)을 본 시험이 그 장면을 잰 때의 팔로 돌게.
//  A SKILL.twoHandReach 0 · B SKILL.edgeReach 0 · C SKILL.eastScale 'off' · D SKILL.armClear.on 0 — keys 로 고름. fn 이 약속을 돌려주면 끝난 뒤 되돌림
//  armClear2 (11/12 둘째 — docs/strike/arm_clear2_2026-11-12.md §6): 두 팔 엇갈림 막기를 11/12 첫 판(main 30929293)으로 — AI 몫 끔 · 지금 몸 손목 끔 · 칼자루 끝 앞 바닥 끔 · 빈손 비킴 끔 · 틈 없을 때 덜 겹치는 돌림
//   (on 은 그대로 — 'armClear' 와 함께 고르면 D 전체가 꺼짐)
//  armOdd (11/13 — docs/strike/arm_odd_2026-11-13.md): 칼자루 끝 앞 바닥을 쥐는 순간 곧장 켜던 11/12 둘째 판으로 (frontIn 0)
import { SKILL } from '../../src/config.js';

export const ARM_OLD = { twoHandReach: 0, edgeReach: 0, eastScale: 'off', armClear: 0 };
/** 11/12 첫 판 두 팔 엇갈림 막기 (armClear 의 새 칸들 — 'armClear2' 키) */
export const ARM_CLEAR1 = { ai: 0, body: 0, front: 0, grip: 0, miss: 'gap' };
/** 11/12 둘째 판 (칼자루 끝 앞 바닥 쥐면 곧장 — 'armOdd' 키) */
export const ARM_CLEAR2 = { frontIn: 0 };
const SUB = { armClear2: ARM_CLEAR1, armOdd: ARM_CLEAR2 }; // SKILL.armClear 안 칸 묶음
const get = (k) => (k === 'armClear' ? SKILL.armClear.on : SUB[k] ? Object.fromEntries(Object.keys(SUB[k]).map((x) => [x, SKILL.armClear[x]])) : SKILL[k]);
const set = (k, v) => (k === 'armClear' ? (SKILL.armClear.on = v) : SUB[k] ? Object.assign(SKILL.armClear, v) : (SKILL[k] = v));
const OLD = { ...ARM_OLD, ...SUB };

export function withArmOld(fn, keys = Object.keys(ARM_OLD)) {
  const keep = keys.map((k) => [k, get(k)]);
  for (const k of keys) set(k, OLD[k]);
  const back = () => { for (const [k, v] of keep) set(k, v); };
  let r;
  try {
    r = fn();
  } catch (e) {
    back();
    throw e;
  }
  if (r && typeof r.then === 'function') return r.finally(back);
  back();
  return r;
}
