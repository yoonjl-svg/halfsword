// 흘림당한 쪽 팔 늦춤 — 샛별 저장소 연구(짧은 팔 회복 지연 `ad018bf7` · `15e18adf`) 들여옴 · docs/strike/japanese_flow_adopt_2026-10-18.md
//  판 값 · 스위치는 config.js FLOW_RECOVERY (사장님 10/18 22:1x — 0.36 s · 바닥 0.25).
//  흘림이 일어나면 흘림당한 쪽(공격한 쪽)의 두 팔 근육 · 손목 힘이 seconds 동안 줄었다 돌아온다(fighter.js flowArmScale): 처음 1/3 은 floor · 남은 2/3 에 부드럽게 1 로.
//   빠르기 초기화 · 손 순간이동 · 입력 지움 · 걸음 잠금 없음. 같은 공격으로는 한 번 · 돌아오는 중 다시 늘이지 않음.
import { FLOW_RECOVERY } from './config.js';
export { FLOW_RECOVERY };

/** seconds: 이 늦춤만의 시간 (없으면 FLOW_RECOVERY 그대로 — 흘림). 안다레 리솔루토 런지는 SECRET.risolutoArmSlow 0.6 (사장님 10/24) · 바닥 · 꼴은 같음 */
export function beginFlowRecovery(f, defender, seconds = null) {
  const hold = seconds != null ? null : FLOW_RECOVERY.hold, recover = seconds != null ? 0 : FLOW_RECOVERY.recover;
  const duration = seconds != null ? seconds : hold != null ? hold + (recover ?? 0) : FLOW_RECOVERY.seconds;
  if (!(duration > 0) || !f.alive || !f.armed || f.state !== 'stand') return false;
  const now = f.stamina.time, id = f.stamina.attackId;
  const old = f.flowRecovery;
  // 공격 하나에 한 번 · 돌아오는 중(끝 + 0.12 s 안)에는 다시 걸지 않는다
  if (old && (now < old.until + 0.12 || (id > 0 && id === old.attackId))) return false;
  f.flowRecovery = { start: now, until: now + duration, duration, attackId: id,
    defender: defender.index, floor: FLOW_RECOVERY.floor, hold: hold ?? null, recover: recover ?? 0 };
  return true;
}

export function flowRecoveryScale(f) {
  const s = f.flowRecovery;
  if (!s || !f.alive || !f.armed || f.state !== 'stand') return 1;
  const t = f.stamina.time - s.start;
  if (t >= s.duration) return 1;
  // 처음 1/3: 칼 기세에 끌려감(floor) · 남은 2/3: smoothstep 으로 1 까지
  const x = s.hold != null
    ? (t < s.hold ? 0 : Math.min(1, (t - s.hold) / Math.max(1e-6, s.recover)))  // 시험 꼴: hold 초 유지 → recover 초 회복
    : Math.max(0, Math.min(1, (t / s.duration - 1 / 3) * 1.5));
  return s.floor + (1 - s.floor) * x * x * (3 - 2 * x);
}
