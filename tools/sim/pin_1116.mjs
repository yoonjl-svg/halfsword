// 11/16 사장님 결정 묶음 앞 판으로 옛 장면 시험을 묶는 손잡이 (기준은 그대로 — 바뀐 판에서 갈라진 장면만):
//  격살 풀기 안 A(SECRET.gkFree) · 편섬 꺾음(CN_STEP.mode 'turn') · 偏閃奏進(AI_PLAN.cn.dive) · 사냥 겹 다시 짬(cnHunt.any · life 8.0 · regen 0.10) · 요격 출혈 × 2(yaojiBleed.k) ·
//  시간 사다리 10 → 8 s(AI_PLAN.read.repeatT · AI_PLAN_JP.repeatT · SECRET.gyeoksalAi.late — 띠 기억 창 높음은 read.repeatT 를 따름)
import { CONFIG } from './harness_m.mjs';

const OLD = () => {
  const C = CONFIG;
  return [
    [C.SECRET.gkFree, 'on', 0],
    [C.CN_STEP, 'mode', 0],
    [C.AI_PLAN.cn, 'dive', 0],
    [C.UNIQUE_ASSIST.cnHunt, 'any', 0],
    [C.UNIQUE_ASSIST.cnHunt, 'life', 0],
    [C.UNIQUE_ASSIST.cnHunt, 'regen', 0.08],
    [C.UNIQUE_ASSIST.yaojiBleed, 'k', 1.5],
    [C.AI_PLAN.read, 'repeatT', C.realS(10)],
    [C.AI_PLAN_JP, 'repeatT', C.realS(10)],
    [C.SECRET.gyeoksalAi, 'late', C.realS(10)],
  ];
};
/** fn 을 11/16 앞 판으로 돌림 */
export function withOld1116(fn) {
  const L = OLD().map(([o, k, v]) => [o, k, o[k], v]);
  for (const [o, k, , v] of L) o[k] = v;
  try {
    return fn();
  } finally {
    for (const [o, k, was] of L) o[k] = was;
  }
}
/** node:test 시험 하나를 11/16 앞 판으로 (t.after 로 되돌림) */
export function pin1116(t) {
  const L = OLD().map(([o, k, v]) => [o, k, o[k], v]);
  for (const [o, k, , v] of L) o[k] = v;
  t.after(() => {
    for (const [o, k, was] of L) o[k] = was;
  });
}
