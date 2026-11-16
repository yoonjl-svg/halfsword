// ─────────────────────────────────────────────────────────────
//  react_old.mjs — 11/16 AI 반응 시간을 숙련도 사다리(전 판 — config AI_PROFICIENCY.reaction [0.35 … 0.05] · 한 단계 0.05 s)로 잠깐
//   (11/16 사장님 '다 너의 권고대로 하마' — 모든 숙련도 0.2 s 하나 전의 옛 장면 시험을 그때 판으로 묶을 때 — 기준은 그대로 · 기록 docs/strike/prof_kit_2026-11-16.md §7)
//  반응 시간은 AI 를 만들 때 읽는다(ai.js setLevel) — 판(AI)을 묶은 뒤 만들어야 한다.
//  pinReactOld(t) — 시험 하나 동안(t.after 로 되돌림) · withReactOld(fn) — fn 이 끝나면(던져도) 되돌림 · reactOld() — 바꾸고 되돌리는 함수를 돌려줌
// ─────────────────────────────────────────────────────────────
import { AI_PROFICIENCY, realS } from '../../src/config.js';

export const REACT_OLD = Object.freeze([0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05].map(realS));

export function reactOld() {
  const keep = AI_PROFICIENCY.reaction;
  AI_PROFICIENCY.reaction = REACT_OLD;
  return () => {
    AI_PROFICIENCY.reaction = keep;
  };
}

export function pinReactOld(t) {
  t.after(reactOld());
}

export function withReactOld(fn) {
  const back = reactOld();
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
