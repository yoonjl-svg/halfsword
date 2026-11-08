// ─────────────────────────────────────────────────────────────
//  손가락 긋기 세기 (11/06 사장님 '손가락 베기 세기 -> 이건 최소한, 상처의 최소 문턱과 비슷해져야해' — config SKILL.fingerCut · 기록 docs/strike/finger_cut_2026-11-06.md)
//   사람이 손가락으로 긋는 보통 베기(기본 · 강화 · 걸음 공격 긋기 — 특수 공격 · 비기 · 끌고 가는 칼 · 탭 찌르기 · 손잡이 찍기가 아닌 것)의 세기를 키우는 길 셋. 기본은 모두 1 = 끔(판이 바이트까지 같음).
//    arm  — 긋는 동안(skill.swinging — 손 목표가 휘두르기 빠르기를 넘는 동안) 칼 팔 · 손목의 힘을 × arm: 몸의 힘(fighter.strength)이 들어가는 세 자리와 같은 자리
//           (칼 팔 관절 근육 · 손목 힘 · 손목 빠르기 한계 √) — 비기 do.strength(ai.js secretStrength · skill.js run.str0)가 그 베기 구간만 몸의 힘을 올리는 것과 같은 꼴. 칼이 실제로 빨라진다
//           칼 팔 관절 근육(손을 옮기는 힘 — 키 'armReach')은 11/08 부터 '손이 손 목표에 닿을 때까지'만 (사장님 11/08 '1로 해봐' · 기록 docs/strike/fc_arm_reach_2026-11-08.md):
//           손이 손 목표로 다가가는 동안(손목 빠르기가 손 목표 쪽 +)이고 아직 닿지 않음(손목이 손 목표에서 SECRET.mord.ready 0.1 m 밖) — 닿았거나 지나치는 동안은 1.
//           2 배 근육이 손을 손 목표 너머로 밀어 내려 벤 손이 손 목표 아래 · 뒤로 지나치던 몫을 없앰(곧은 길 판 앞지름 28 → 0/30). 손목(칼 돌림 · 칼 무게 붙잡기 — 키 'arm')은 긋는 동안 그대로
//    gain — 긋는 동안 손가락이 옮긴 손 목표 몫을 × gain (skill.js update 처음 — 빠른 끌기만 감도를 올림 · 손 목표 반지름 WEAPON.reach 그대로)
//    hit  — 긋는 동안과 그 끝 recoverDelay 안의 닿음(combat.js analyze)의 판정 에너지를 × hit — 물리(빠르기 · 질량 · 가르나 튕기나 판단 앞 에너지)는 그대로, 판정만 (마지막 수단 — 보이는 움직임은 그대로)
//    ai   — 1 이면 AI 몸의 보통 긋기(AI 가 손 목표를 옮기는 휘두름 — 비기 · 끌고 가는 칼 아님)에도 arm · hit 를 건다 (gain 은 손가락이 없어 사람만). 기본 0 = 사람만
//   주소 손잡이 (main.js): ?fcArm= · ?fcGain= · ?fcHit= · ?fcAi=1
//   새 문턱 · 상한 · 시간 없음 — '긋는 동안'은 skill.swinging(SKILL.swingSpeed), 끝 몫은 SKILL.recoverDelay(손가락을 떼고 자세로 돌아가기까지) 를 그대로 읽는다
// ─────────────────────────────────────────────────────────────
import { SKILL, SECRET } from './config.js';

/** 이 몸이 지금 손가락 긋기 길을 받을 몸인가 (사람 손가락 팔 — skill.autoGuard · ai 켬이면 AI 몸도) — 칼 · 살아 있음 · 비기 · 끌고 가는 칼 · 찌르기 · 찍기 · 채찍 톡 · 감기 · 칼자루 치기 아님 */
function strokeBody(f, F, human) {
  const sk = f.skill;
  if (!sk || !f.alive || !f.armed || f.weapon?.gun) return false;
  if (human ? sk.autoGuard !== true : !(F.ai && f.aiControlled && sk.autoGuard !== true)) return false;
  if (sk.sec || sk.tap || sk.pom || sk.flick || sk.uniq?.winding || f.iai || f.iaiReq || f.ibSpin || f.secretStiff || f.mordAim || f.rdWind || f.parryGuard?.active) return false;
  if ((f.secretHit ?? 1) !== 1 || (f.powerMul ?? 1) !== 1) return false; // AI 비기 베기 (판정 · 서보 힘 창)
  return true;
}

/** 손가락 긋기 배율 (key = 'arm' 손목 · 'armReach' 칼 팔 근육 · 'gain' · 'hit' — 'armReach' 는 SKILL.fingerCut.arm 을 읽음): 켜지 않았거나 그 몸 · 그때가 아니면 1 — 곱해도 값이 바뀌지 않는다 */
export function fingerCutK(f, key) {
  const F = SKILL.fingerCut;
  const k = F?.[key === 'armReach' ? 'arm' : key] ?? 1;
  if (k === 1 || !f) return 1;
  const sk = f.skill;
  const human = sk?.autoGuard === true;
  if (key === 'gain' && !human) return 1;
  if (!strokeBody(f, F, human)) return 1;
  if (key === 'hit') return sk.swinging || sk.quiet <= SKILL.recoverDelay ? k : 1;
  if (key === 'armReach') return sk.swinging && reaching(f) ? k : 1;
  return sk.swinging ? k : 1;
}

/**
 * 손이 손 목표로 다가가는 중이고 아직 닿지 않았나 (11/08 사장님 '1로 해봐' — 칼 팔 근육 × arm 은 '손이 가려던 자리에 닿을 때까지'만):
 *  손목 = 아래팔 앞끝 (0.13, 0, 0) (칼 잡은 자리 — mordschlag.js mordReady 와 같은 점) · 손 목표 = fighter.handTarget (이 스텝 driveSword 가 정한 팔 IK 목표).
 *  닿음 = 손목이 손 목표에서 SECRET.mord.ready (0.1 m — 비기 칼자루 치기 '실제 손목이 손 목표에 들면 준비 끝' 과 같은 잣대) 안 → 거짓.
 *  다가감 = 손목의 가슴 대비 빠르기(손 목표는 가슴 자리를 따라 옮겨지므로 몸 옮김 몫을 뺌)가 손 목표 쪽으로 + — 0 이하(멈춤 · 지나쳐 멀어짐)면 거짓.
 *  새 문턱 · 상한 · 시간 없음. 몸 · 손 목표가 없는 몸(시험 꼴)은 다가가는 중으로 봄 (전과 같음)
 */
function reaching(f) {
  const fa = f.bodies?.farmS;
  const ch = f.bodies?.chest;
  const h = f.handTarget;
  if (!fa || !ch || !h) return true;
  const r = fa.rotation();
  const t = fa.translation();
  const wx = t.x + 0.13 * (1 - 2 * (r.y * r.y + r.z * r.z));
  const wy = t.y + 0.13 * 2 * (r.x * r.y + r.w * r.z);
  const wz = t.z + 0.13 * 2 * (r.x * r.z - r.w * r.y);
  const ex = h.x - wx;
  const ey = h.y - wy;
  const ez = h.z - wz;
  if (Math.hypot(ex, ey, ez) <= SECRET.mord.ready) return false;
  const v = fa.velocityAtPoint({ x: wx, y: wy, z: wz });
  const c = ch.linvel();
  return (v.x - c.x) * ex + (v.y - c.y) * ey + (v.z - c.z) * ez > 0;
}
