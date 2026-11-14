// ─────────────────────────────────────────────────────────────
//  이베리아 막아 내면 기력 되찾음 (11/15 사장님 '이베리아도 막기 20% 감소 없애. 대신 막기에 성공하면 기력 n 회복 어때.' · 스킬트리 B9 '굳은 받기' ·
//   config SKILL.ibBlockRegen · `?ibBlockRegen=0` = 끔 · 기록 docs/strike/cn_block_2026-11-15.md §5)
//  막기 성공 = 상대 공격(공격 번호 하나에 한 번)을 칼로 받아 막았고(stamina.js block — 일본 스택 막기 guardEvent 'block' 과 같은 사건 · 쳐내기 B8 꼴도 막는 중이면 같음)
//   그 공격이 끝날 때까지(상대 공격 번호가 바뀌거나 공격 시간이 지남) 내 몸에 칼날 상처(베기 · 찌르기 심각도 > 0)가 들지 않은 때.
//  되찾는 몫 n (사장님 11/15 'n은 상대 무기의 베기 기력 *2 어때. or 고정값 30. (일본 흘리기와 동일선상에서)' → '고정 30으로 해'): SKILL.ibBlockRegenN
//   'fixed' = 고정 SKILL.ibBlockRegenFixed 30(확정 · 기본) · 'foe2' = 상대 무기 베기 기력 × 2(견줌 스위치로만). 기력 한도는 넘지 않음 · 탈진 중은 없음.
//  사람 · AI 같게: 무기 유파 이베리아 몸 · 사람은 막기 책을 쥐고(schoolParry) B9 몫 열쇠 'blockRegen' 을 익힌 몸만(AI 는 늘).
// ─────────────────────────────────────────────────────────────
import { STAMINA, SKILL } from './config.js';
import { kitOff } from './skill_kit.js';

/** 이 몸이 막아 내면 기력을 되찾나 */
export function ibBlockOn(f) {
  return !!SKILL.ibBlockRegen && !!STAMINA.on && f?.swordArt?.tradition === 'iberian' && f.schoolParry !== false && !kitOff(f, 'blockRegen');
}

/** 되찾는 몫 n — 고정 30 · 또는 상대 무기 베기 기력 × 2 */
export function regenN(att) {
  return SKILL.ibBlockRegenN === 'foe2' ? STAMINA.cutCost * (att?.stamina?.weight ?? 1) * 2 : SKILL.ibBlockRegenFixed;
}

/** 막아 받음이 듦 (stamina.js block — 상대 공격 번호 하나에 한 번): 그 공격이 끝날 때까지 기다림 */
export function ibBlockMark(f, att, id) {
  if (!ibBlockOn(f)) return;
  (f.ibBlockPend ??= new Map()).set(att, { id, cut: false });
}

/** 맞음 (combat.js — applyWound 뒤): 기다리는 그 공격의 칼날 상처면 막아 내지 못함 */
export function ibBlockHit(vic, att, r) {
  const p = vic.ibBlockPend?.get(att);
  if (p && p.id === att?.stamina?.attackId && (r.type === 'cut' || r.type === 'stab') && r.severity > 0) p.cut = true;
}

/** 스텝마다 (stamina.js step): 기다리던 공격이 끝났으면 — 칼날 상처가 없었으면 베기 한 번 값을 되찾음 (한도 안) */
export function ibBlockTick(f) {
  const M = f.ibBlockPend;
  if (!M?.size) return;
  for (const [att, p] of M) {
    const s = att.stamina;
    if (s && s.attackId === p.id && s.time <= s.attackUntil) continue; // 아직 그 공격
    M.delete(att);
    const S = f.stamina;
    if (p.cut || !f.alive || !S || S.exhausted || S.infinite) continue;
    const before = S.value;
    S.value = Math.min(S.max, S.value + regenN(att));
    const got = S.value - before;
    S.counts.blockRegen = (S.counts.blockRegen ?? 0) + 1;
    S.blockRegenSum = (S.blockRegenSum ?? 0) + got;
  }
}
