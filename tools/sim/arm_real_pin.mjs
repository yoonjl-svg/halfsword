// 11/12 팔 사람 꼴 넷을 전 판으로 묶기 (docs/strike/arm_real_2026-11-12.md §10): 옛 장면(씨앗 판 · 옛 결함 재현 · 잰 때 조건)을 본 시험이 그 장면을 잰 때의 팔로 돌게.
//  A SKILL.twoHandReach 0 · B SKILL.edgeReach 0 · C SKILL.eastScale 'off' · D SKILL.armClear.on 0 — keys 로 고름. fn 이 약속을 돌려주면 끝난 뒤 되돌림
import { SKILL } from '../../src/config.js';

export const ARM_OLD = { twoHandReach: 0, edgeReach: 0, eastScale: 'off', armClear: 0 };
const get = (k) => (k === 'armClear' ? SKILL.armClear.on : SKILL[k]);
const set = (k, v) => (k === 'armClear' ? (SKILL.armClear.on = v) : (SKILL[k] = v));

export function withArmOld(fn, keys = Object.keys(ARM_OLD)) {
  const keep = keys.map((k) => [k, get(k)]);
  for (const k of keys) set(k, ARM_OLD[k]);
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
