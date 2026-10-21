// 막아찌르기 — 플레이어 이탈리아 유파(무기 이름 조건 없음 — 지금은 레이피어 · 달타냥) 막기 단추의 새 누름 한 번에 약한 찌르기 한 번 (입력형).
//  10/21 사장님 '입력형 50% 0.6초로 넣어' — 샛별 저장소 입력형 개선안(10/21 인계)의 설계를 우리 판에 맞춰 새로 짰다
//  (docs/strike/italian_opposition_2026-10-20.md 10/21 절).
//  · 누르는 순간 바로 시작: 상대 칼 접촉 · 상대 공격 · 시간 창 · 거리를 기다리지 않는다. 허공에도 찌르고 기력을 낸다.
//  · 새 누름 하나에 한 번. 짧게 놓아도 시작한 동작은 마치고, 계속 누르면 동작이 끝난 뒤 보통 막기로 이어진다.
//    진행 중 다시 눌러도 예약 · 겹침 · 보호 늘림은 없다.
//  · 겨눔: 상대 칼 든 쪽 위팔 — 지금 자리에서 lead 초 앞(leadMax m 까지)을 내다본다. 손은 지금 자리에서 pull 만큼 당겼다가 reach 만큼 뻗는다.
//  · 받는 피해: 누른 때부터 shield 초 동안 칼날 상처 심각도 × (1 − shieldCut) — 동방 · 일본 · 이베리아 막기 피해 감소와 같은 칸(parry_button.js woundKeep).
//  · 주는 피해: 찌르는 동안 칼날 상처 심각도 · 둔타 에너지 × dealt (combat.js analyze).
//  · 기력: 보통 찌르기 한 번(막아 받기 값 포함 — 찌르는 동안 칼이 맞닿아도 막기 값을 따로 내지 않음, stamina.js block).
//  · 사람만(AI 는 안 씀). 옛 접촉형(10/20)은 걷어냄. 이탈리아 유파 전체(10/21 사장님 확인 — 샛별 저장소 fb5b344e 와 같은 뜻, 우리가 새로 고침).
import * as THREE from 'three';
import { SKILL } from './config.js';
import { kitOff } from './skill_kit.js'; // 플레이어 스킬트리 몫 (10/21 — 이탈리아 막기 II 막아찌르기 I6)
const V = () => new THREE.Vector3();
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export class ItalianOpposition {
  constructor(f, foe, guard) {
    this.f = f; this.foe = foe; this.guard = guard;
    this.run = null; this.lastHeld = false;
    this.shieldUntil = -Infinity; // 받는 피해 감소가 끝나는 때 (guard.clock)
    this.lastInjury = -Infinity;
    this.starts = 0; this.lastStart = null; this.lastEnd = null; this.contacts = 0;
    this.pad = new THREE.Vector2();
  }

  /** 이 몸이 막아찌르기를 쓸 수 있는 꼴인가 (유파 · 책 · 몸 상태) — 이어 가기 조건. 시작은 여기에 막기 단추 새 누름을 더한다 */
  eligible() {
    const f = this.f, sk = f.skill, g = this.guard;
    return SKILL.itOpposition && f.swordArt?.tradition === 'italian' // 10/21 사장님 '이탈리아 유파 전체로 넓히는 거 맞아' — 무기 이름 조건 없음(지금 이탈리아 무기 = 레이피어 · 달타냥 · 발리사르다)
      && f.schoolParry !== false && !kitOff(f, 'opposition') && !g.broken && f.alive && this.foe.alive
      && f.armed && !f.stamina.exhausted && ['stand', 'kneel'].includes(f.state)
      && !sk.tap && !sk.sec && !sk.pom && !f.secretStiff;
  }

  beginGuardStep() {
    const g = this.guard, fresh = g.held && !this.lastHeld;
    this.lastHeld = g.held;
    this.pad.copy(this.f.handOffset);
    if (this.run && !this.eligible()) this.cancel('interrupt');
    else if (fresh && !this.run && this.eligible()) this.start();
  }

  endGuardStep() {
    // 막기 손 목표가 찌르기와 싸우거나 따로 휘두르기로 청구되지 않도록 한다.
    if (this.run) { this.f.handOffset.copy(this.pad); this.f.skill.prev.copy(this.pad); }
  }

  beforeSkill() {
    if (!this.run) return;
    if (!this.eligible()) this.cancel('interrupt');
    else { this.f.skill.thrustPose.w = 0; this.f.skill.thrustPush = false; }
  }

  cancel(reason) {
    if (!this.run) return;
    this.lastEnd = { t: this.guard.clock, reason };
    if (reason !== 'complete') this.shieldUntil = Math.min(this.shieldUntil, this.guard.clock); // 끊기면 보호도 끝
    this.run = null; this.f.skill.thrustPose.w = 0; this.f.skill.thrustPush = false;
  }

  /** 받는 칼날 상처에 곱할 몫 (parry_button.js woundKeep 이 부른다) */
  keep() {
    const cut = SKILL.itOppositionVals.shieldCut;
    return cut > 0 && this.guard.clock < this.shieldUntil ? 1 - cut : 1;
  }

  /** 주는 피해에 곱할 몫 (combat.js analyze — 공격자가 이 몸일 때) */
  dealtK() { return this.run ? SKILL.itOppositionVals.dealt : 1; }

  onWound(hit) { if (hit.severity > 0) this.lastInjury = this.guard.clock; }

  /** 찌르는 동안 상대 칼과 맞닿음 — 센다(측정 · 소리 검토용). 효과는 없다 */
  onClash(attacker) { if (this.run && attacker === this.foe) this.contacts++; }

  start() {
    const f = this.f, foe = this.foe, g = this.guard, cfg = SKILL.itOppositionVals;
    const ch = f.bodies.chest.translation();
    const inv = f.yaw.clone().invert(), c = V().copy(ch);
    const hand = V().copy(f.sword.translation()).sub(c).applyQuaternion(inv);
    const dir = f.bladePoint(1, V()).sub(f.bladePoint(0, V())).applyQuaternion(inv).normalize();
    // 겨눔: 상대 칼 든 쪽 위팔 · 지금 빠르기로 lead 초 앞(leadMax 까지)
    const arm = foe.bodies.uarmS ?? foe.bodies.chest, av = arm.linvel();
    const ahead = V().set(av.x, av.y, av.z).multiplyScalar(cfg.lead);
    if (ahead.length() > cfg.leadMax) ahead.setLength(cfg.leadMax);
    const target = V().copy(arm.translation()).add(ahead).sub(c).applyQuaternion(inv).sub(hand).normalize();
    const before = f.stamina.value;
    f.stamina.parryThrust(foe); // 보통 찌르기 한 번 (막아 받기 값을 이미 냈으면 그만큼 뺀다)
    f.skill.thrusts++;
    this.starts++;
    this.lastStart = { t: g.clock, cost: before - f.stamina.value };
    if (f.stamina.exhausted) return; // 비용으로 탈진했다면 시작하지 않는다
    this.shieldUntil = g.clock + cfg.shield;
    const b = f.guardPose ?? {};
    this.run = { t: 0, hand, dir, target, side: Math.sign(hand.z) || 1,
      body: { pelvisYaw: b.pelvisYaw ?? 0, chestYaw: b.chestYaw ?? 0, pitch: b.pitch ?? 0, drop: b.drop ?? 0 } };
  }

  update(dt) {
    const r = this.run; if (!r) return;
    if (!this.eligible()) { this.cancel('interrupt'); return; }
    const cfg = SKILL.itOppositionVals, sk = this.f.skill;
    r.t += dt * this.f.stamina.attackSpeed;
    const end = cfg.aim + cfg.extend + cfg.hold;
    if (r.t >= end + cfg.recover) { this.cancel('complete'); return; }
    const e = smooth((r.t - cfg.aim) / cfg.extend), a = smooth(r.t / cfg.aim);
    const w = r.t < .04 ? smooth(r.t / .04) : r.t < end ? 1 : 1 - smooth((r.t - end) / cfg.recover);
    const axis = r.dir.clone().lerp(r.target, cfg.turn * a).normalize();
    const h = r.hand.clone().addScaledVector(axis, cfg.reach * e - cfg.pull * a * (1 - e));
    h.z += r.side * cfg.side * a;
    Object.assign(sk.thrustPose, { w, hand: h.toArray(), dir: axis.toArray(), ...r.body });
    sk.thrustPush = r.t >= cfg.aim && r.t < end;
    sk.activity = Math.max(sk.activity, w);
  }
}
