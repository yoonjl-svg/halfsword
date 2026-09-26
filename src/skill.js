// ─────────────────────────────────────────────────────────────
//  검술 층 (숙련도 보정)
//
//  입력(손가락/AI) → [검술 층] → 근육(관절 모터, 근력 한계) → 물리
//
//  이 캐릭터는 이미 검술을 익힌 사람이라고 가정하고, 입력이 "휘두르기"로 보이면
//  훈련된 사람이 저절로 하는 몸놀림을 덧붙인다. 단, 여기서 바꾸는 것은 "목표"뿐이다.
//  실제 움직임은 언제나 근육(힘의 한계)과 물리가 만든다 → 맞으면 흐트러지고, 칼은 여전히 무겁다.
//
//   1) 이어 베기(follow-through): 짧고 빠르게 그어도 칼이 그 방향으로 끝까지 지나간다
//   2) 몸으로 베기: 휘두르는 방향으로 허리를 틀고, 내려벨 때 상체를 숙여 체중을 싣는다
//   3) 내딛기: 알맞은 간격에서 휘두르기 시작하면 앞발을 내딛으며 벤다
//
//  level: 0 = 보정 없음(날것 그대로의 물리 조작), 1 = 숙련된 검사
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SKILL, WEAPON } from './config.js';

export class Skill {
  constructor(fighter, level = SKILL.level) {
    this.f = fighter;
    this.level = level;
    this.prev = fighter.handOffset.clone();
    this.vel = new THREE.Vector2(); // 손 목표가 움직이는 속도 (m/s, 몸 앞 평면)
    this.follow = new THREE.Vector2(); // 이어 베기로 더해지는 손 목표
    this.aim = fighter.handOffset.clone(); // 실제로 근육이 따라갈 손 목표
    this.twist = 0; // 허리 비틀기 보정 (라디안)
    this.bend = 0; // 허리 숙이기 보정 (라디안, 음수 = 앞으로)
    this.quiet = 1; // 손이 느리게 움직인 시간 (새 휘두르기 시작 판단용)
    this.lunge = 0; // 내딛는 중 남은 시간
    this.swings = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    const f = this.f;
    const L = this.level;
    const off = f.handOffset;
    const R = WEAPON.reach;
    if (off.length() > R) off.setLength(R);

    // 손 목표 속도 (손가락 떨림을 거르기 위해 살짝 부드럽게)
    const rx = (off.x - this.prev.x) / dt;
    const ry = (off.y - this.prev.y) / dt;
    this.prev.copy(off);
    const k = 1 - Math.exp(-dt * 25);
    this.vel.x += (rx - this.vel.x) * k;
    this.vel.y += (ry - this.vel.y) * k;
    const sp = this.vel.length();
    const swinging = sp > SKILL.swingSpeed && f.alive && f.armed;

    // 1) 이어 베기: 휘두르는 동안 움직이는 방향으로 목표를 더 밀어 두었다가 천천히 되돌린다
    if (swinging) this.follow.addScaledVector(this.vel, dt * SKILL.followGain * L);
    this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));
    const fm = SKILL.followMax * L;
    if (this.follow.length() > fm) this.follow.setLength(fm);
    this.aim.copy(off).add(this.follow);
    if (this.aim.length() > R) this.aim.setLength(R);

    // 2) 몸으로 베기: 손이 가는 방향으로 허리를 먼저 튼다 (몸통 회전이 칼에 속도를 더한다)
    const twistT = swinging ? THREE.MathUtils.clamp(-this.vel.x * SKILL.twistGain, -0.5, 0.5) * L : 0;
    const bendT = swinging ? THREE.MathUtils.clamp(this.vel.y * SKILL.bendGain, -0.4, 0.1) * L : 0;
    const kb = 1 - Math.exp(-dt * 14);
    this.twist += (twistT - this.twist) * kb;
    this.bend += (bendT - this.bend) * kb;

    // 3) 내딛기: 잠깐 멈췄다가 새로 휘두르기 시작할 때, 상대가 한 걸음 거리에 있으면
    if (swinging && this.quiet > 0.2 && f.state === 'stand') {
      this.swings++;
      const d = f.foeDistance();
      if (d > SKILL.lungeMin && d < SKILL.lungeMax) this.lunge = SKILL.lungeTime;
    }
    this.quiet = swinging ? 0 : this.quiet + dt;
    if (this.lunge > 0) {
      this.lunge -= dt;
      // 물러나려는 중이면 내딛지 않는다 (조작이 우선)
      if (f.move.y > -0.2 && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }
  }
}
