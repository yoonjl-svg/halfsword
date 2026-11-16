// ─────────────────────────────────────────────────────────────
//  ai_kit_off.mjs — 11/16 AI 숙련도 = 칸(config AI_KIT)을 끈 판(11/16 전 판 — AI 는 칸 몫 없이 모두 켬 · 옛 단계표 · 패시브 4 · 비기 5)으로 잠깐
//   (낮은 숙련도 AI 가 모든 몫을 가졌던 옛 장면 시험을 그때 판으로 묶을 때 — 기준은 그대로 · 기록 docs/strike/prof_kit_2026-11-16.md)
//  AI_KIT.on 은 AI 를 만들 때 읽는다 — 판(AI)을 fn 안에서 만들어야 한다.
//  withAiKitOff(fn) — fn 이 끝나면(던져도) 되돌림 · async fn 이면 기다림 · pinAiKitOff(t) — 시험 하나 동안(t.after 로 되돌림) · aiKitOff() — 끄고 되돌리는 함수를 돌려줌
// ─────────────────────────────────────────────────────────────
import { AI_KIT } from '../../src/config.js';

export function aiKitOff() {
  const keep = AI_KIT.on;
  AI_KIT.on = 0;
  return () => {
    AI_KIT.on = keep;
  };
}

/** 시험 하나 동안 끔 (node:test 의 t — 끝나면 t.after 로 되돌림 · 시험 첫 줄에서 부름) */
export function pinAiKitOff(t) {
  t.after(aiKitOff());
}

export function withAiKitOff(fn) {
  const back = aiKitOff();
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
