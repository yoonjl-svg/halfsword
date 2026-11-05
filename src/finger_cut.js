// ─────────────────────────────────────────────────────────────
//  손가락 긋기 세기 (11/06 사장님 '손가락 베기 세기 -> 이건 최소한, 상처의 최소 문턱과 비슷해져야해' — config SKILL.fingerCut · 기록 docs/strike/finger_cut_2026-11-06.md)
//   사람이 손가락으로 긋는 보통 베기(기본 · 강화 · 걸음 공격 긋기 — 특수 공격 · 비기 · 끌고 가는 칼 · 탭 찌르기 · 손잡이 찍기가 아닌 것)의 세기를 키우는 길 셋. 기본은 모두 1 = 끔(판이 바이트까지 같음).
//    arm  — 긋는 동안(skill.swinging — 손 목표가 휘두르기 빠르기를 넘는 동안) 칼 팔 · 손목의 힘을 × arm: 몸의 힘(fighter.strength)이 들어가는 세 자리와 같은 자리
//           (칼 팔 관절 근육 · 손목 힘 · 손목 빠르기 한계 √) — 비기 do.strength(ai.js secretStrength · skill.js run.str0)가 그 베기 구간만 몸의 힘을 올리는 것과 같은 꼴. 칼이 실제로 빨라진다
//    gain — 긋는 동안 손가락이 옮긴 손 목표 몫을 × gain (skill.js update 처음 — 빠른 끌기만 감도를 올림 · 손 목표 반지름 WEAPON.reach 그대로)
//    hit  — 긋는 동안과 그 끝 recoverDelay 안의 닿음(combat.js analyze)의 판정 에너지를 × hit — 물리(빠르기 · 질량 · 가르나 튕기나 판단 앞 에너지)는 그대로, 판정만 (마지막 수단 — 보이는 움직임은 그대로)
//    ai   — 1 이면 AI 몸의 보통 긋기(AI 가 손 목표를 옮기는 휘두름 — 비기 · 끌고 가는 칼 아님)에도 arm · hit 를 건다 (gain 은 손가락이 없어 사람만). 기본 0 = 사람만
//   주소 손잡이 (main.js): ?fcArm= · ?fcGain= · ?fcHit= · ?fcAi=1
//   새 문턱 · 상한 · 시간 없음 — '긋는 동안'은 skill.swinging(SKILL.swingSpeed), 끝 몫은 SKILL.recoverDelay(손가락을 떼고 자세로 돌아가기까지) 를 그대로 읽는다
// ─────────────────────────────────────────────────────────────
import { SKILL } from './config.js';

/** 이 몸이 지금 손가락 긋기 길을 받을 몸인가 (사람 손가락 팔 — skill.autoGuard · ai 켬이면 AI 몸도) — 칼 · 살아 있음 · 비기 · 끌고 가는 칼 · 찌르기 · 찍기 · 채찍 톡 · 감기 · 칼자루 치기 아님 */
function strokeBody(f, F, human) {
  const sk = f.skill;
  if (!sk || !f.alive || !f.armed || f.weapon?.gun) return false;
  if (human ? sk.autoGuard !== true : !(F.ai && f.aiControlled && sk.autoGuard !== true)) return false;
  if (sk.sec || sk.tap || sk.pom || sk.flick || sk.uniq?.winding || f.iai || f.iaiReq || f.ibSpin || f.secretStiff || f.mordAim || f.rdWind || f.parryGuard?.active) return false;
  if ((f.secretHit ?? 1) !== 1 || (f.powerMul ?? 1) !== 1) return false; // AI 비기 베기 (판정 · 서보 힘 창)
  return true;
}

/** 손가락 긋기 배율 (key = 'arm' | 'gain' | 'hit'): 켜지 않았거나 그 몸 · 그때가 아니면 1 — 곱해도 값이 바뀌지 않는다 */
export function fingerCutK(f, key) {
  const F = SKILL.fingerCut;
  const k = F?.[key] ?? 1;
  if (k === 1 || !f) return 1;
  const sk = f.skill;
  const human = sk?.autoGuard === true;
  if (key === 'gain' && !human) return 1;
  if (!strokeBody(f, F, human)) return 1;
  if (key === 'hit') return sk.swinging || sk.quiet <= SKILL.recoverDelay ? k : 1;
  return sk.swinging ? k : 1;
}
