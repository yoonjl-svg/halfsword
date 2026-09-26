// ─────────────────────────────────────────────────────────────
//  상대 AI
//  플레이어와 똑같이 "손 목표 위치"와 "이동 방향"만 조종한다.
//  즉 AI도 물리 법칙을 따르므로 반칙(순간이동 칼질)을 하지 않는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_LEVELS } from './config.js';

// 공격 패턴: 몸 앞 평면의 손 위치 [좌우(+오른쪽), 위아래] 미터
//  준비(windup) 자세에서 공격 끝(strike) 자세로 손을 빠르게 옮긴다.
const ATTACKS = [
  { name: 'overhead', windup: [0.1, 0.6], strike: [0.0, -0.25] }, // 내려치기
  { name: 'diagR', windup: [0.5, 0.45], strike: [-0.35, -0.2] }, // 오른쪽 위 → 왼쪽 아래 사선
  { name: 'diagL', windup: [-0.35, 0.45], strike: [0.45, -0.15] }, // 왼쪽 위 → 오른쪽 아래 사선
  { name: 'horizontal', windup: [0.6, 0.1], strike: [-0.5, 0.05] }, // 가로베기
  { name: 'thrust', windup: [0.45, -0.25], strike: [0.0, 0.05] }, // 찌르기 (가운데로 모으면 팔이 뻗는다)
];
const GUARD = [0.05, 0.4];
const READY = [0.15, 0.0];

export class AI {
  constructor(me, foe, levelName = 'normal') {
    this.me = me;
    this.foe = foe;
    this.setLevel(levelName);
    this.phase = 'ready'; // ready | windup | strike | recover | guard
    this.timer = 1.0;
    this.attack = ATTACKS[0];
    this.target = new THREE.Vector2(...READY);
    this.shuffle = 0;
    this.shuffleTimer = 0;
    this.guardDecided = false;
  }

  setLevel(name) {
    this.level = AI_LEVELS[name] || AI_LEVELS.normal;
    this.me.strength = this.level.strength;
  }

  // 상대 칼이 높이 있으면 아래를, 낮으면 위를 노린다 (가끔은 무작위)
  chooseAttack() {
    const foe = this.foe;
    const tipY = foe.bladePoint(1).y;
    const headY = foe.bodies.head.translation().y + 0.1;
    const pick = (names) => {
      const name = names[Math.floor(Math.random() * names.length)];
      return ATTACKS.find((a) => a.name === name);
    };
    if (Math.random() < 0.3) return ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    if (tipY > headY) return pick(['horizontal', 'thrust', 'diagL']);
    return pick(['overhead', 'diagR', 'diagL']);
  }

  update(dt) {
    const me = this.me;
    const foe = this.foe;
    if (me.state !== 'stand') {
      me.move.set(0, 0);
      this.phase = 'ready';
      this.timer = 0.6;
      return;
    }
    const L = this.level;
    const a = me.bodies.pelvis.translation();
    const b = foe.bodies.pelvis.translation();
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    this.timer -= dt;

    // ── 막기: 플레이어 칼이 빠르게 내 머리 쪽으로 오면 ──
    const foeSwinging = foe.tipVel.length() > 5;
    if (!foeSwinging) this.guardDecided = false;
    if (foeSwinging && !this.guardDecided && this.phase !== 'strike' && foe.alive) {
      this.guardDecided = true;
      const head = me.bodies.head.translation();
      const tip = foe.bladePoint(1);
      const close = Math.hypot(tip.x - head.x, tip.y - head.y, tip.z - head.z) < 1.4;
      if (close && Math.random() < L.guardChance) {
        this.phase = 'guard';
        this.timer = 0.35 + L.reaction;
        this.target.set(...GUARD);
      }
    }

    // ── 공격 흐름 ──
    let handSpeed = 2.2;
    switch (this.phase) {
      case 'ready':
        this.target.set(...READY);
        if (this.timer <= 0 && dist < 1.85 && foe.alive) {
          this.attack = this.chooseAttack();
          this.phase = 'windup';
          this.timer = L.windup * (0.8 + Math.random() * 0.4);
        }
        break;
      case 'windup':
        this.target.set(...this.attack.windup);
        if (this.timer <= 0) {
          this.phase = 'strike';
          this.timer = 0.45;
        }
        break;
      case 'strike': {
        this.target.set(...this.attack.strike);
        // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다
        const h = foe.bodies.head.translation();
        const c = me.bodies.chest.translation();
        const r = me.right(new THREE.Vector3());
        const lat = (h.x - c.x) * r.x + (h.z - c.z) * r.z;
        this.target.x = THREE.MathUtils.clamp(this.target.x + lat * 0.6, -0.6, 0.6);
        handSpeed = L.strikeSpeed;
        if (this.timer <= 0) {
          this.phase = 'recover';
          this.timer = 0.5;
        }
        break;
      }
      case 'recover':
        this.target.set(...READY);
        if (this.timer <= 0) {
          this.phase = 'ready';
          this.timer = (1.4 - L.aggression) * (0.6 + Math.random());
        }
        break;
      case 'guard':
        this.target.set(...GUARD);
        handSpeed = 4;
        if (this.timer <= 0) {
          this.phase = 'ready';
          this.timer = 0.2 + Math.random() * 0.4;
        }
        break;
    }

    // 손을 목표 쪽으로 제한 속도로 이동 (AI가 순간적으로 칼을 옮기지 못하게)
    const off = me.handOffset;
    const dx = this.target.x - off.x;
    const dy = this.target.y - off.y;
    const d = Math.hypot(dx, dy);
    const stepLen = handSpeed * dt;
    if (d > stepLen) {
      off.x += (dx / d) * stepLen;
      off.y += (dy / d) * stepLen;
    } else {
      off.set(this.target.x, this.target.y);
    }

    // ── 거리 조절 + 옆으로 돌기 ──
    this.shuffleTimer -= dt;
    if (this.shuffleTimer <= 0) {
      this.shuffleTimer = 0.6 + Math.random() * 1.2;
      this.shuffle = (Math.random() - 0.5) * 0.6; // 앞뒤 잔걸음
      this.circle = Math.random() < 0.6 ? (Math.random() < 0.5 ? -0.7 : 0.7) : 0; // 옆걸음
    }
    let fwd = 0;
    // 칼끝 쪽(가장 빠른 부분)이 닿는 거리를 유지한다
    const want = this.phase === 'strike' ? 1.4 : 1.6;
    if (dist > want + 0.15) fwd = 1;
    else if (dist < want - 0.35) fwd = -0.7;
    else fwd = this.shuffle;
    let side = dist < 2.5 && this.phase !== 'strike' ? this.circle || 0 : 0;
    if (!foe.alive) fwd = side = 0;
    me.move.set(THREE.MathUtils.clamp(side, -1, 1), THREE.MathUtils.clamp(fwd, -1, 1));
  }
}
