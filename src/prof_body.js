// 숙련도별 몸 값 (E — [사장님 11/17 결정 'A~E 기본으로'] · config.js PROF_BODY · 기록 docs/strike/prof_body_2026-11-17.md)
//  AI(ai.js setLevel — 사람 몫 숙련도)와 사람(main.js — 익힌 스킬 칸으로 센 숙련도)이 같은 표를 읽는다.
import { PROF_BODY, AI_LEVELS, AI_PLAN, AI_PROFICIENCY, DE_VITALITY } from './config.js';

/** 숙련도 → 표의 칸 번호 (반올림 · 0 ~ 표 끝 · 수가 아니면 2 = 기본 상대 숙련도 AI_PROFICIENCY.ofLevel.normal) */
export function bodyIndex(p) {
  const n = PROF_BODY.vitality.length - 1;
  return Number.isFinite(p) ? Math.max(0, Math.min(n, Math.round(p))) : 2;
}

/** 독일 유파 버티는 힘 덤 (11/20 — config DE_VITALITY): 손에 든 유파가 독일이면 독일 숙련도 칸의 곱 · 아니면 1 */
export function deVitalityK(tradition, p) {
  return tradition === 'german' ? DE_VITALITY.k[bodyIndex(p)] ?? 1 : 1;
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

/**
 * 대본 손 빠르기의 실력 숫자 (11/19 사장님 '사람 막기 단추 · 비기 손 빠르기는 숙련도를 따름' — docs/strike/human_ai_parity_2026-11-19.md §7 A2 · B2):
 *  막기 단추(parry_button.js)가 손을 옮기는 빠르기 · 검술 층 비기 대본(skill.js updateSecret — 사람 비기 · AI 리솔루토 · 모르트슐라크)의 감기 · 벰 빠르기를 이 표에서 읽는다.
 *  AI 몸 = 그 AI 의 실력 숫자(ai.js setLevel 의 level — AI 가 제 패드 길 비기에 쓰는 값과 같음) ·
 *  사람 몸 = 몸 값과 같은 숙련도(f.bodyProficiency — main.js humanProficiency)의 실력 이름 — AI 와 같은 표(AI_PLAN.levels: 숙련 0 ~ 1 쉬움 · 2 ~ 3 보통 · 4 ~ 5 높음 · 6 최고) ·
 *  숙련도가 없는 몸(시뮬 대본 몸 · 재는 도구)은 보통 = 전 판 그대로. 보정 세기(설정 '검술 보정 세기')는 따로 — 그대로 (사장님 11/19)
 */
export function scriptLevel(f) {
  if (f?.aiControlled && f.aiCtl?.level) return f.aiCtl.level;
  const p = f?.bodyProficiency;
  if (!Number.isFinite(p)) return AI_LEVELS.normal;
  const names = AI_PLAN.levels ?? AI_PROFICIENCY.levels;
  return AI_LEVELS[names[bodyIndex(p)]] ?? AI_LEVELS.normal;
}
