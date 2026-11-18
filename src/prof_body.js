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

/**
 * 생사전 동시 대전 AI 의 몸 값 숙련도 [사장님 11/18 결정 '4. 권고대로'] — 1:1 과 같이 본 유파 숙련도 (main.js teamAiOf → persona.bodyProficiency):
 *  인물 = 시트 숙련도(본 유파) · 무명 검객 = 메인 유파 칸(person.main — 없으면 표에서 가장 높은 칸) · 숙련도 표가 없으면 fallback.
 *  몸 값에만 — 손에 든 유파 숙련도(고유 동작 · 실력 이름 …)는 그대로
 */
export function teamBodyProficiency(e, sheet, fallback) {
  if (sheet) return sheet.ai.proficiency;
  if (!e?.prof) return fallback;
  return e.prof[e.person?.main] ?? Math.max(0, ...Object.values(e.prof));
}
