// 숙련도별 몸 값 (E — [사장님 11/17 결정 'A~E 기본으로'] · config.js PROF_BODY · 기록 docs/strike/prof_body_2026-11-17.md)
//  AI(ai.js setLevel — 사람 몫 숙련도)와 사람(main.js — 익힌 스킬 칸으로 센 숙련도)이 같은 표를 읽는다.
import { PROF_BODY } from './config.js';

/** 숙련도 → 표의 칸 번호 (반올림 · 0 ~ 표 끝 · 수가 아니면 2 = 기본 상대 숙련도 AI_PROFICIENCY.ofLevel.normal) */
export function bodyIndex(p) {
  const n = PROF_BODY.vitality.length - 1;
  return Number.isFinite(p) ? Math.max(0, Math.min(n, Math.round(p))) : 2;
}

/** 숙련도 → { vitality, strength } */
export function profBody(p) {
  const i = bodyIndex(p);
  return { vitality: PROF_BODY.vitality[i], strength: PROF_BODY.strength[i] };
}
