// ─────────────────────────────────────────────────────────────
//  상대 AI
//  플레이어와 똑같이 "손 목표 위치"와 "이동 방향"만 조종한다.
//  즉 AI도 물리 법칙을 따르므로 반칙(순간이동 칼질)을 하지 않는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_LEVELS } from './config.js';

// 공격 패턴: [준비 자세(손 위치), 공격 끝 자세] — (앞쪽, 위쪽) 미터
const ATTACKS = [
  { name: 'overhead', windup: [-0.05, 0.58], strike: [0.55, -0.1] },
  { name: 'high', windup: [-0.25, 0.4], strike: [0.6, 0.2] },
  { name: 'low', windup: [0.05, 0.5], strike: [0.5, -0.4] },
  { name: 'thrust', windup: [0.0, 0.12], strike: [0.62, 0.08] },
];
const GUARD = [0.3, 0.45];
const READY = [0.38, 0.02];

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
    const headY = foe.bodies.head.translation().y;
    const pick = (names) => {
      const name = names[Math.floor(Math.random() * names.length)];
      return ATTACKS.find((a) => a.name === name);
    };
    if (Math.random() < 0.3) return ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    if (tipY > headY + 0.1) return pick(['low', 'thrust']);
    return pick(['overhead', 'high']);
  }

  update(dt) {
    const me = this.me;
    const foe = this.foe;
    if (me.state !== 'stand') {
      me.moveInput = 0;
      this.phase = 'ready';
      this.timer = 0.6;
      return;
    }
    const L = this.level;
    const myX = me.bodies.pelvis.translation().x;
    const foeX = foe.bodies.pelvis.translation().x;
    const dist = Math.abs(foeX - myX);
    const toward = Math.sign(foeX - myX) || 1;
    this.timer -= dt;

    // ── 막기: 플레이어 칼이 빠르게 내 머리 쪽으로 오면 ──
    const foeSwinging = foe.tipVel.length() > 5;
    if (!foeSwinging) this.guardDecided = false;
    if (foeSwinging && !this.guardDecided && this.phase !== 'strike' && foe.alive) {
      this.guardDecided = true;
      const head = me.bodies.head.translation();
      const tip = foe.bladePoint(1);
      const close = Math.hypot(tip.x - head.x, tip.y - head.y) < 1.4;
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
        if (this.timer <= 0 && dist < 1.75 && foe.alive) {
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
      case 'strike':
        this.target.set(...this.attack.strike);
        handSpeed = L.strikeSpeed;
        if (this.timer <= 0) {
          this.phase = 'recover';
          this.timer = 0.5;
        }
        break;
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

    // ── 거리 조절 ──
    this.shuffleTimer -= dt;
    if (this.shuffleTimer <= 0) {
      this.shuffleTimer = 0.4 + Math.random() * 0.8;
      this.shuffle = (Math.random() - 0.5) * 0.8;
    }
    let move = 0;
    const want = this.phase === 'strike' ? 1.1 : 1.45;
    if (dist > want + 0.15) move = 1;
    else if (dist < want - 0.35) move = -0.7;
    else move = this.shuffle;
    if (!foe.alive) move = 0;
    me.moveInput = THREE.MathUtils.clamp(move, -1, 1) * toward;
  }
}
