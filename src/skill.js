// ─────────────────────────────────────────────────────────────
//  검술 층 (숙련도 보정)
//
//  입력(손가락/AI) → [검술 층] → 근육(관절 모터, 근력 한계) → 물리
//
//  이 캐릭터는 이미 검술을 익힌 사람이라고 가정하고, 입력이 "휘두르기"로 보이면
//  훈련된 사람이 저절로 하는 몸놀림을 덧붙인다. 단, 여기서 바꾸는 것은 "목표"뿐이다.
//  실제 움직임은 언제나 근육(힘의 한계)과 물리가 만든다 → 맞으면 흐트러지고, 칼은 여전히 무겁다.
//
//   0) 입력 쪽 관성("가죽끈", SKILL.handDynamicsOn): 손가락 목표 앞에 반지름 작은 원(anchor)을 둔다.
//      손가락이 그 안에서 떨리는 동안은 anchor가 안 움직이고, 반경을 넘어야 그만큼만 끌려간다.
//      → 잘게 떠는 손가락이 자세 경계(guards.js RBF 블렌드)를 스치며 칼끝·몸통을 흔드는 것을 원천에서 막는다.
//      진짜 베기·자세 이동처럼 큰 움직임은 anchor가 거의 즉시 팽팽해져 그대로 전해진다 → 반응은 그대로.
//   1) 이어 베기(follow-through): 짧고 빠르게 그어도 칼이 그 방향으로 끝까지 지나간다
//   2) 검술 자세(guards.js): 손가락 위치를 실제 롱소드 자세로 바꾼다. 몸(골반·가슴)은 손보다 먼저
//      자세를 따라가서, 베기를 시작하면 허리 → 가슴 → 팔 → 칼 순서로 힘이 이어진다 (fighter.updateBodyPose)
//   3) 내딛기: 알맞은 간격에서 휘두르기 시작하면 앞발을 내딛으며 벤다
//   4) 자세로 돌아가기: 베기를 마치고 손가락을 떼면(마우스는 잠깐 멈추면) 교본의 기본 자세(쟁기)로 칼을 되돌린다.
//      숙련된 검사는 베고 나서 칼을 아무 데나 두지 않고 곧바로 자세를 잡는다. (플레이어만. AI는 스스로 자세를 고른다)
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
    this.aim = fighter.handOffset.clone(); // 실제로 근육이 따라갈 손 목표 (부드럽게 걸러진 값)
    this.anchor = fighter.handOffset.clone(); // 입력 쪽 관성의 "가죽끈" 중심 (0번 단계)
    this.aimRaw = fighter.handOffset.clone(); // 거르기 전 목표 (가죽끈으로 거른 입력 + 이어 베기)
    this.aimVel = new THREE.Vector2(); // 걸러진 목표가 움직이는 속도
    this.quiet = 1; // 손이 느리게 움직인 시간 (새 휘두르기 시작 판단용)
    this.lunge = 0; // 내딛는 중 남은 시간
    this.swings = 0;
    this.activity = 0; // 휘두르는 중인 정도 (0~1)
    this.autoGuard = false; // 플레이어만 true (main.js)
    this.cutPending = false; // 베기를 했고 아직 자세로 돌아가지 않음
    this.idle = 0; // 손가락(마우스)이 움직이지 않은 시간
    this.recovering = false;
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
    // 휘두르는 중인 정도 (0~1): 휘두르기 시작하면 빨리 1로, 멈추면 천천히 0으로 (몸을 크게 쓰는 건 벨 때뿐)
    this.activity += ((swinging ? 1 : 0) - this.activity) * Math.min(1, dt / (swinging ? 0.04 : 0.4));

    // 0) 가죽끈: anchor는 손가락(off)이 반경(inputDeadRadius)을 넘어야 그만큼만 끌려간다.
    //  반경 안의 떨림은 anchor를 전혀 움직이지 못한다 — 어디서 떨든(자세 경계라도) 걸러진다.
    //  큰 움직임(진짜 베기)은 반경이 순식간에 다 채워져 손가락과 거의 같이 움직인다(지연 ≈ 반경/속도).
    if (SKILL.handDynamicsOn) {
      const adx = off.x - this.anchor.x;
      const ady = off.y - this.anchor.y;
      const ad = Math.hypot(adx, ady);
      const dead = SKILL.inputDeadRadius;
      if (ad > dead) {
        const k = (ad - dead) / ad;
        this.anchor.x += adx * k;
        this.anchor.y += ady * k;
      }
    } else {
      this.anchor.copy(off);
    }

    // 1) 이어 베기: 휘두르는 동안 움직이는 방향으로 목표를 더 밀어 두었다가 천천히 되돌린다
    if (swinging) this.follow.addScaledVector(this.vel, dt * SKILL.followGain * L);
    this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));
    const fm = SKILL.followMax * L;
    if (this.follow.length() > fm) this.follow.setLength(fm);
    this.aimRaw.copy(this.anchor).add(this.follow);
    if (this.aimRaw.length() > R) this.aimRaw.setLength(R);
    // 손 목표를 "딱 멈추는"(임계 감쇠) 2차 필터로 거른다: 목표가 순간이동해도 손은 가속·감속하며 간다.
    //  (사람의 손도 순간적으로 속도를 바꾸지 못한다. 목표가 튀면 근육이 그 충격을 몸통에 그대로 전해 출렁인다)
    // 휘두르는 순간엔 근육을 긴장시켜(공동 수축) 더 빠르고 단단하게 따라간다
    const wT = swinging ? SKILL.aimFilterStrike : SKILL.aimFilter;
    this.filterW = (this.filterW ?? wT) + (wT - (this.filterW ?? wT)) * Math.min(1, dt * 30);
    const w = this.filterW;
    const ax = w * w * (this.aimRaw.x - this.aim.x) - 2 * w * this.aimVel.x;
    const ay = w * w * (this.aimRaw.y - this.aim.y) - 2 * w * this.aimVel.y;
    this.aimVel.x += ax * dt;
    this.aimVel.y += ay * dt;
    this.aim.x += this.aimVel.x * dt;
    this.aim.y += this.aimVel.y * dt;

    // 3) 내딛기: 잠깐 멈췄다가 새로 휘두르기 시작할 때, 상대가 한 걸음 거리에 있으면
    if (swinging && this.quiet > 0.2 && f.state === 'stand') {
      this.swings++;
      const d = f.foeDistance();
      // 쓰러진 상대를 내려찍을 때(finish.js)는 내딛지 않는다: 마무리 자세가 거리를 맞추고, 내딛으면 칼이 누운 몸을 지나 발밑에 떨어진다
      if (d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) this.lunge = SKILL.lungeTime;
    }
    this.quiet = swinging ? 0 : this.quiet + dt;

    // 4) 자세로 돌아가기
    if (swinging) {
      this.cutPending = true;
      this.recovering = false;
    }
    this.idle = f.inputActive ? 0 : this.idle + dt;
    const canRecover = this.autoGuard && L >= 0.35 && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel');
    if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay) {
      this.recovering = true;
      this.cutPending = false;
    }
    if (this.recovering) {
      if (f.inputActive || !canRecover) this.recovering = false; // 다시 조작하면 바로 조작이 우선
      else {
        const hx = SKILL.homeGuard[0] - off.x;
        const hy = SKILL.homeGuard[1] - off.y;
        const d = Math.hypot(hx, hy);
        // 휘두르기로 오인되지 않게 휘두르기 기준 속도보다 느리게 옮긴다
        const step = SKILL.recoverSpeed * dt;
        if (d <= step) {
          off.set(SKILL.homeGuard[0], SKILL.homeGuard[1]);
          this.recovering = false;
        } else {
          off.x += (hx / d) * step;
          off.y += (hy / d) * step;
        }
      }
    }
    if (this.lunge > 0) {
      this.lunge -= dt;
      // 물러나려는 중이면 내딛지 않는다 (조작이 우선)
      if (f.move.y > -0.2 && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }
  }
}
