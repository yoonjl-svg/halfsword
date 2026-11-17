// ─────────────────────────────────────────────────────────────
//  AI 막는 동안 피해 감소 (11/15 사장님 '동방의 장점은 막을 때 피해 50% 감소인데 막기를 잘 활용 못하는 거 아닐까? …' → '동방 ai 막기 감소 켜' ·
//   기록 docs/strike/cn_block_2026-11-15.md · 늘 켬)
//  지금 막는 동안 피해 감소(동방 C8 0.5 — 일본 · 이베리아는 11/15 사장님 결정으로 없앰 · 0)는 사람 막기 단추(parry_button.js PlayerParryGuard.woundKeep)에만 붙는다 — AI 몸에는 그 칸이 없다.
//  '사람과 같게': AI 가 막는 중(AI 막기 꼴 mode 'defend' · 물러나 피하기 defVoid 아님 — 칼로 받기)이면 그 칼날 상처 심각도 × (1 − 그 유파 몫).
//   막는 중의 길이도 사람 단추와 같다(새 위협을 읽은 때부터 '공격이 지나갔다' 또는 막기 시간 0.65 s — ai.js respond · defend).
//   유파 몫 = 사람과 같은 칸(SKILL.cnParryDmgCut · jpParryDmgCut · ibParryDmgCut) · 독일 · 이탈리아 · 무유파 = 1(감소 없음).
//  combat.js analyze 가 사람 단추가 없는 AI 몸일 때 부른다 (굴림 없음).
// ─────────────────────────────────────────────────────────────
import { SKILL } from './config.js';
import { kitOff } from './skill_kit.js';

/** 이 유파의 막는 동안 피해 감소 몫 (사람 parry_button.js woundKeep 과 같은 표) */
export function schoolParryCut(tradition) {
  return { chinese: SKILL.cnParryDmgCut, japanese: SKILL.jpParryDmgCut, iberian: SKILL.ibParryDmgCut }[tradition] ?? 0;
}

/** AI 몸이 지금 받는 칼날 상처 심각도에 곱할 몫 — 막는 중(칼로 받기)이 아니면 1 */
export function aiWoundKeep(f) {
  const ai = f.aiCtl;
  if (!ai || ai.mode !== 'defend' || ai.defVoid) return 1;
  if (f.schoolParry === false || kitOff(f, 'parryCut')) return 1; // 11/16 칸 몫 (config AI_KIT): 사람 woundKeep 과 같게 — 막기 I · 피해 감소 칸(동방 C8)이 없으면 감소 없음
  const cut = schoolParryCut(f.swordArt?.tradition ?? ai.art?.tradition);
  return cut > 0 ? 1 - cut : 1;
}
