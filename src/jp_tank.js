// ─────────────────────────────────────────────────────────────
//  일본 기다리는 중전차 (11/14 — config JP_TANK · 설계안 docs/design/japanese_heavy_tank_2026-11-14.md · 기록 docs/strike/jp_tank_2026-11-14.md)
//   스택(J10 기다림과 침)은 school_passive.js 가 맡는다. 이 파일은 기력 장부(stamina.js)가 묻는 밀치기 기력 한 갈래만(몫 열쇠 jpRock) — 들여오는 것은 config · skill_kit 뿐(고리 없음).
// ─────────────────────────────────────────────────────────────
import { JP_TANK } from './config.js';
import { kitOff } from './skill_kit.js';

/**
 * 밀치기에 기력 안 씀 (사장님 11/14 '낮은 걸음에 효과를 추가해서 밀치기에 기력이 소모되는 않는 걸로' — JP_TANK.lowShove):
 *  사람(사람 입력이 모는 몸 humanInput — main.js 플레이어 · 재기 손가락 봇) 일본 몸이 그 몫(스킬트리 몫 열쇠 jpRock — 11/14 감독: 새 칸 자리 대기 · 지금은 J1 낮은 걸음을 익히면 함께 켜짐)을 가졌으면 참.
 *  stamina.js stepClinch(붙어 버티기 — 밀치기 누르기)가 이 몸의 기력 빠짐을 0 으로. 상대 몸 · AI · 시뮬 대본 몸은 늘 거짓(지금 판 그대로)
 */
export function lowShoveFree(f) {
  return !!JP_TANK.lowShove && !!f?.humanInput && !f.aiControlled && f.swordArt?.tradition === 'japanese' && !kitOff(f, 'jpRock');
}
