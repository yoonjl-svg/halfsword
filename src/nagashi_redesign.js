// 일본 흘려 받기(우케나가시) 판정 개편 — 샛별 저장소 연구(판정·기력 개편 `ebe8de5d`, 전달 `d98fa34d`) 들여옴 · docs/strike/japanese_flow_adopt_2026-10-18.md
//  판 값 · 스위치는 config.js FLOW_REDESIGN (사장님 10/18 22:1x — 기본 켬 · 기력 40). 여기는 판정(flowCandidate)과 기력 청구(spendFlowPenalty)만.
//  판정: 칼끼리 실제로 닿은 순간만 본다 — 들어오는 칼(빠르기 · 몸 쪽 접근 · 칼날에 수직인 쓸기 · 맞부딪는 세기 · 가슴 기준 높이)을 그 공격의 첫 접촉에서 재고,
//   window(0.12 s) 안에 지금 칼 기하(칼끝 쪽으로 미끄러뜨려 몸 바깥으로 빠지나 · 정면으로 맞받지 않나)와 막기(플레이어 막기 단추 · AI 'defend')를 다시 본다.
//   붙어 있는 접촉은 창을 늘리지 않고, 떨어졌다 다시 닿으면 새 창이지만 기력은 공격 하나에 한 번만. 찌르기 · 공격 번호 없음 · 끝난 공격은 흘리지 않는다.
import * as THREE from 'three';
import { STEEL, PHYSICS, FLOW_REDESIGN } from './config.js';
export { FLOW_REDESIGN };
const v = x => new THREE.Vector3(x.x, x.y, x.z);
const velocity = (s, p) => v(p).sub(s.com).cross(s.w).negate().add(s.v);

// 칼끼리 실제로 닿을 때만 부른다(combat.js). 한 공격의 첫 접촉에서 들어오는 빠르기를 재 두고, 짧은 창 안에서 '지금' 칼 기하 · 막기를 다시 본다.
//  붙어 있는 접촉은 창을 늘리지 못한다. 떨어졌다 다시 닿으면(칼 재무장 규칙 STEEL.rearmSteps) 새 창 — 그래도 기력은 공격 하나에 한 번.
export function flowCandidate(D, O, SO, point, normal, impact, now) {
  const st = D.skill?._cover, s = O.stamina;
  const no = (reason, details = {}) => { D.flowCheck = { time: now, attackId: s.attackId, reason, ...details }; return null; };
  if (!D.alive || !O.alive || !D.armed || !O.armed || D.state !== 'stand' ||
      D.stamina.exhausted || s.exhausted || O.state !== 'stand' || !st?.nagashi || D.schoolParry === false ||
      !O.swordProps) return no('scope');
  O.flowContactWindows ??= new WeakMap();
  let entry = O.flowContactWindows.get(D);
  const chest = v(D.bodies.chest.translation());
  if (!entry || now - entry.last > STEEL.rearmSteps * PHYSICS.timestep + 1e-9) {
    const relative = velocity(SO, point);
    const body = D.cache?.parts?.chest;
    if (body) relative.sub(velocity(body, point));
    // 지키는 곳 = 가슴 위 · 머리 기둥. 내려 베기 · 옆 베기는 받고, 물러나는 칼 · 거의 칼 길이 방향인 찌르기는 뺀다.
    const target = chest.clone();
    target.y = Math.min(chest.y + 0.28, Math.max(chest.y - 0.15, point.y));
    const toward = target.sub(point).normalize();
    const speed = relative.length();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(SO.q);
    const sweep = relative.clone().addScaledVector(axis, -relative.dot(axis)).length();
    const radialApproach = relative.dot(toward), height = point.y - chest.y;
    // 세로 베기는 맞닿은 점이 가로로 멀어지는 중에도 이미 팔 위에 있을 수 있다 — 가까운 윗몸 둘레에서 내려오는 칼은 접근으로 친다.
    const nearUpper = height >= -0.10 && Math.hypot(point.x - chest.x, point.z - chest.z) <= 0.65;
    const approach = Math.max(radialApproach, nearUpper ? -relative.y : -Infinity);
    entry = { attackId: s.attackId, start: now, last: now, speed, sweep, approach, impact,
      height, radialApproach, nearUpper, velocity: relative.toArray(),
      eligible: speed >= FLOW_REDESIGN.minSpeed && approach >= FLOW_REDESIGN.minApproach &&
        sweep >= FLOW_REDESIGN.minSweep && sweep >= speed * FLOW_REDESIGN.minSweepRatio &&
        impact >= FLOW_REDESIGN.minImpact && height >= FLOW_REDESIGN.upperHeight && height <= FLOW_REDESIGN.maxHeight };
    O.flowContactWindows.set(D, entry);
  }
  entry.last = now;
  if (!s.attackId || s.flowAttackKind === 'thrust') return no('attack-kind');
  // 공격 유효 구간(stamina.attackUntil)을 그대로 쓴다 — 실제 긋기 · 내리치기 동안(느려진 긋기 포함) 계속 늘어난다. 이미 낸 번호로 나중 회수 동작을 베기로 읽지 않는다.
  // threatEnd(판 값 — config.js): 공격 번호 시간이 지났어도 들어오는 칼 기하(entry.eligible — 아래)로 위협이면 본다 · 끄면 공격 번호 시간으로(`?flowEnd=timer`)
  if (s.time > s.attackUntil && !FLOW_REDESIGN.threatEnd) return no('attack-ended', { time: s.time, until: s.attackUntil });
  if (O.flowSpentAttack === s.attackId) return no('already-paid');
  if (entry.attackId !== s.attackId) return no('new-command-in-bind');
  const age = now - entry.start;
  const guard = D.parryGuard ? D.parryGuard.active && D.parryGuard.held && !D.parryGuard.broken : st.ai?.mode === 'defend' && !st.ai.defVoid;
  if (!guard) return no('not-guarding');
  if (!entry.eligible) return no('entry-path', { entry: { ...entry } });
  if (age < -1e-9 || age > FLOW_REDESIGN.window + 1e-9) return no('window-expired', { age });
  const height = point.y - chest.y;
  if (height < FLOW_REDESIGN.upperHeight || height > FLOW_REDESIGN.maxHeight) return no('current-height', { height });
  const axis = D.bladePoint(1, new THREE.Vector3()).sub(D.bladePoint(0, new THREE.Vector3())).normalize();
  const direction = axis.clone().addScaledVector(normal, -axis.dot(normal));
  if (direction.length() < FLOW_REDESIGN.minTangent) return no('head-on', { tangent: direction.length() });
  direction.normalize(); // 늘 코등이 → 칼끝 쪽으로 — 받은 칼을 손 쪽으로 끌어오지 않는다
  const off = v(point).sub(chest), exit = off.clone().addScaledVector(direction, FLOW_REDESIGN.exitDistance);
  // 몸에서 멀어지거나(반지름 늘어남) · 몸 앞에 머문 채 옆으로 빠지면 흘림. 칼 지붕은 반지름이 줄면서도 옆으로 흘려보낼 수 있어 반지름만 보면 흔한 꼴을 놓친다.
  const gain = exit.x * exit.x + exit.z * exit.z - off.x * off.x - off.z * off.z;
  const heading = D.heading ?? 0;
  const front = p => p.x * Math.cos(heading) - p.z * Math.sin(heading);
  const side = p => p.x * Math.sin(heading) + p.z * Math.cos(heading);
  const sideGain = Math.abs(side(exit)) - Math.abs(side(off));
  const sideways = sideGain >= FLOW_REDESIGN.sideGain &&
    Math.min(front(off), front(exit)) >= FLOW_REDESIGN.frontClearance;
  if (gain < FLOW_REDESIGN.exitGain && !sideways) return no('exit-towards-body', { gain, sideGain, offset: off.toArray(), direction: direction.toArray(), front: [front(off), front(exit)] });
  if (!(impact > 0)) return no('no-current-approach');
  D.flowCheck = { time: now, attackId: s.attackId, reason: 'eligible', age, gain, sideGain };
  return { direction, entry, age, gain, sideGain, height, impact: Math.min(entry.impact, impact) };
}

/** 흘림당한 쪽(O) 기력 청구 — 공격 번호 하나에 한 번(같은 공격의 재접촉 · 다른 방어자를 만난 재접촉도 다시 안 냄) · 바닥(탈진 문턱)에 닿으면 덜 깎일 수 있음 · 기력 무한 장비는 청구 없음(stamina.spend) */
export function spendFlowPenalty(O, D) {
  const s = O.stamina;
  if (!(FLOW_REDESIGN.penalty > 0) || !s?.attackId || O.flowSpentAttack === s.attackId) return null;
  O.flowSpentAttack = s.attackId;
  s.spent.flow ??= 0;
  s.counts.flow ??= 0;
  const before = s.value;
  const charged = s.spend('flow', FLOW_REDESIGN.penalty);
  if (charged) s.counts.flow++;
  const event = { attackId: s.attackId, time: s.time, defender: D.index,
    requested: FLOW_REDESIGN.penalty, charged, before, after: s.value,
    actual: before - s.value };
  O.lastFlowPenalty = event;
  return event;
}
