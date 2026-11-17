// 플레이어 스킬트리 몫 읽기 (10/21 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md) — 싸움 코드가 '이 몸에 그 몫이 꺼졌나'를 묻는 오직 한 자리.
//  몸의 skillKit = 사람(플레이어)은 main.js newRound 가 넣는다(skill_tree_data.js kitFromNodes) · AI 는 11/16 부터 ai.js applyKit 이 숙련도 사다리 칸으로 넣는다(config AI_KIT — aiKitOf).
//  시뮬 대본 몸 · 옛 판 AI 에는 없다 → 늘 '켜짐'. 아무것도 들여오지 않는다(걸음 · 막기 · 상처 코드 어디서나 불러도 고리가 생기지 않게).

/** 이 몸에 스킬트리 몫 key 가 꺼졌나 — skillKit 이 없으면(시뮬 · 옛 판 AI) false */
export const kitOff = (f, key) => !!f?.skillKit && !f.skillKit[key];

/** 이 몸에 강화동작 이점(심화 칸 — 곁눈 베기 무릎 꺾기 · 돌려 베기 쌓기 · 허리 베기 출혈)이 꺼졌나 — skillKit 이 없으면 false */
export const perkOff = (f, name) => !!f?.skillKit && !f.skillKit.perk?.has(name);

/** 이 몸에 고유 공격 칸(skillKit.unique — 스킬트리 u 칸)이 꺼졌나 — skillKit 이 없으면 false (11/16 내려 찌르기 틈 파고들기 = 내려 찌르기 칸 I7 · combat.js) */
export const uniqueOff = (f, name) => !!f?.skillKit && !f.skillKit.unique?.has(name);
