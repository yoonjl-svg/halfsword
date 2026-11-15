// 11/16 묶음 P · 리솔루토 3안을 전 판으로 묶기 (사장님 11/16 '묶음 P 넣어.' · '3안도 넣어.' — docs/strike/it_tone_2026-11-15.md §9):
//  옛 장면(씨앗 판 · 옛 결함 재현 · 잰 때 조건)을 본 시험이 그 장면을 잰 때의 판으로 돌게 — 기준은 안 고침.
//  P = AI_TELL.ai · guard 0 · THRUST.driveAi · drive 0 · STRIKE.hitKPhys 0 · IT_OUTBOX.inqMul 1 / 3안 = SECRET.risoAiWait 0 · AI_PLAN.read.riso 0. fn 이 약속을 돌려주면 끝난 뒤 되돌림
import { AI_TELL, THRUST, STRIKE, IT_OUTBOX, SECRET, AI_PLAN } from '../../src/config.js';

const OLD = [
  [AI_TELL, 'ai', 0],
  [AI_TELL, 'guard', 0],
  [THRUST, 'driveAi', 0],
  [THRUST, 'drive', 0],
  [STRIKE, 'hitKPhys', 0],
  [IT_OUTBOX, 'inqMul', 1],
  [SECRET, 'risoAiWait', 0],
  [AI_PLAN.read, 'riso', 0],
];

/** 묶음 P · 3안 전 판으로 fn 을 돌림 */
export function withPOff(fn) {
  const keep = OLD.map(([o, k]) => [o, k, o[k]]);
  for (const [o, k, v] of OLD) o[k] = v;
  const back = () => { for (const [o, k, v] of keep) o[k] = v; };
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

/** 시험 하나를 묶음 P · 3안 전 판으로 (node:test 의 t — 끝나면 되돌림) */
export function pinPOff(t) {
  const keep = OLD.map(([o, k]) => [o, k, o[k]]);
  for (const [o, k, v] of OLD) o[k] = v;
  t.after(() => { for (const [o, k, v] of keep) o[k] = v; });
}
