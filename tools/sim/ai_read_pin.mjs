// 11/14 유파 AI 3 단계 수 읽기 · 공정함 · AI 고노센 지키기를 그 전 판으로 묶기 (docs/strike/ai_read_2026-11-14.md §6): 옛 장면(씨앗 판 · 셈 시험)을 본 시험이 그 장면을 잰 때의 판으로 돌게.
//  AI_PLAN.read on 0(읽기 몫 없음) · fair 0(사람 스틱 · AI 속 셈 · 기력 장부를 바로 읽던 눈 · 비기 조건 지금 모습) · gns 0(일본 AI 고노센 준비 지키기 · 꾐 없음).
//  fn 이 약속을 돌려주면 끝난 뒤 되돌림
import { AI_PLAN } from '../../src/config.js';

export const READ_OLD = { on: 0, fair: 0, gns: 0 };

export function withReadOld(fn) {
  const keep = AI_PLAN.read;
  AI_PLAN.read = { ...keep, ...READ_OLD };
  const back = () => {
    AI_PLAN.read = keep;
  };
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
