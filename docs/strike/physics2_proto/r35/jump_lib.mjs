// r35 jump — 스텝 기록(jump_trace)의 겨눔 단계 값에서 '이 스텝 명령 칼 방향을 누가 바꿨나'를 셈 (읽기만)
//  단계(driveSword 차례): g 자세(guardDir) → wi 쉼 무게 섞기 → tilt 기술 길 칼끝 들기 → th 탭 섞기(thrustPose.dir · w) → it 이탈리아 곧은 선 → mord 죽음의 일격
//   → yaw 몸 틀 → corr 궤적 탐지(corrStep) → raw 세로 이월 · 탈진 → wg 손목 지킴 교정(wristGuardAim) = aimDirW
export const STAGES = ['g', 'wi', 'tilt', 'th', 'it', 'mord', 'yaw', 'corr', 'raw', 'wg'];
const HD = 180 / Math.PI;
export const ang = (a, b) => { if (!a || !b) return null; const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const la = Math.hypot(...a), lb = Math.hypot(...b); return Math.acos(Math.max(-1, Math.min(1, d / (la * lb)))) * HD; };
// 스텝 i 의 단계마다 한 스텝 각(앞 스텝 같은 단계와) · 단계마다 늘어난 몫 inc = d_k − d_{k−1} · 그 스텝 단계가 바꾼 각 own_k = ang(단계 k−1 출력, 단계 k 출력) 의 한 스텝 변화
export function stepSources(prev, cur) {
  if (!prev?.as || !cur?.as) return null; const out = {}; let dPrev = 0;
  for (const k of STAGES) { const d = ang(prev.as[k], cur.as[k]); out[k] = { d, inc: d - dPrev }; dPrev = d; }
  // 단계가 겨눔을 바꾼 크기(그 스텝 안): own = ang(앞 단계, 이 단계) — yaw 는 틀 바꿈이라 뺌
  let p = null; for (const k of STAGES) { const v = cur.as[k]; if (p && k !== 'yaw') { out[k].own = ang(cur.as[p], v); out[k].ownPrev = prev.as[p] && prev.as[k] ? ang(prev.as[p], prev.as[k]) : null; } p = k; }
  return out;
}
// 한 스텝 뜀의 출처: inc 가 가장 큰 단계 (몸 틀 단계는 g~mord 와 world 단계가 다른 틀이라 yaw 의 inc 에 몸 yaw 한 스텝이 들어감)
export function topSource(src) { let best = null; for (const k of STAGES) { const v = src[k]; if (v.d == null) continue; if (!best || v.inc > src[best].inc) best = k; } return best; }
// 둘째 셈 (쓰는 쪽): 뒤 두 단계가 겨눔을 '바꾼 각'의 한 스텝 변화로 몫을 셈 — 위쪽(g ~ corr 까지 들어온 겨눔의 한 스텝 각) · raw = 세로 이월(vertLead) · 탈진이 바꾼 각의 변화 · wg = 손목 지킴이 바꾼 각의 변화.
//  출처 = 셋 가운데 가장 큰 것. 위쪽이면 그 안에서 inc 가 가장 큰 단계(g · wi · tilt · th · it · mord · yaw · corr)를 붙임.
export function source2(src) { if (!src) return 'noprobe'; const up = src.corr.d; const raw = Math.abs((src.raw.own ?? 0) - (src.raw.ownPrev ?? 0)); const wg = Math.abs((src.wg.own ?? 0) - (src.wg.ownPrev ?? 0));
  if (raw >= up && raw >= wg) return 'raw'; if (wg >= up) return 'wg'; let best = 'g'; for (const k of STAGES.slice(0, 8)) if (src[k].inc > src[best].inc) best = k; return 'up:' + best; }
