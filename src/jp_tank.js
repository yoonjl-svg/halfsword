// ─────────────────────────────────────────────────────────────
//  일본 기다리는 중전차 (11/14 — config JP_TANK · 설계안 docs/design/japanese_heavy_tank_2026-11-14.md · 기록 docs/strike/jp_tank_2026-11-14.md)
//   스택(J10 기다림과 침)과 바위 몸의 받는 피해 줄임은 school_passive.js 가 맡는다. 이 파일은 기력 장부(stamina.js)가 묻는 바위 몸 밀치기 기력 한 갈래만(몫 열쇠 jpRock) — 들여오는 것은 config · skill_kit 뿐(고리 없음).
// ─────────────────────────────────────────────────────────────
import { JP_TANK } from './config.js';
import { kitOff } from './skill_kit.js';

/**
 * 바위 몸 — 밀치기에 기력 안 씀 (사장님 11/14 '바위 몸은 밀치기에 기력 소모 없는 효과' — JP_TANK.lowShove · 첫 말 '낮은 걸음에 효과를 추가해서 …'):
 *  사람(사람 입력이 모는 몸 humanInput — main.js 플레이어 · 재기 손가락 봇) 일본 몸이 바위 몸 몫(스킬트리 몫 열쇠 jpRock — 새 칸 J12 · 임시로 J10 을 익혀도 켜짐)을 가졌으면 참.
 *  stamina.js stepClinch(붙어 버티기 — 밀치기 누르기)가 이 몸의 기력 빠짐을 0 으로. 상대 몸 · 시뮬 대본 몸은 늘 거짓(지금 판 그대로).
 *  AI (11/14 2 단계 일본 — 사장님 '바위 몸 AI 켜는 것도'): JP_TANK.ai 이고 스택 판(school_passive stackOn — 숙련도 4 부터)인 AI 일본 몸도 참
 */
export function lowShoveFree(f) {
  if (f?.aiControlled) return !!JP_TANK.lowShove && !!JP_TANK.ai && f.swordArt?.tradition === 'japanese' && !!f.schoolPassive?.stackOn; // 11/14 2 단계 일본 — AI 바위 몸 (스택 판인 AI 일본 몸 — 숙련도 4 부터 · JP_TANK.ai)
  return !!JP_TANK.lowShove && !!f?.humanInput && f.swordArt?.tradition === 'japanese' && !kitOff(f, 'jpRock');
}
