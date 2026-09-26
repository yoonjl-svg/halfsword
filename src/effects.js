// ─────────────────────────────────────────────────────────────
//  타격감 연출: 피/불꽃 입자, 효과음(파일 없이 코드로 합성)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const MAX = 500;

export class Particles {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.bloodOn = true;
  }

  /**
   * 피(또는 피 끄기 설정이면 먼지). dir = 칼이 지나간 방향(단위벡터), amount = 세기, speed = 칼 속도
   * 피는 칼이 지나간 방향으로 흩뿌려진다.
   */
  blood(point, dir, amount, speed = 4) {
    const n = Math.min(60, Math.round(4 + amount));
    const color = this.bloodOn ? 0x8a0000 : 0xcfc3a6;
    for (let i = 0; i < n; i++) {
      const k = 0.15 + Math.random() * 0.45;
      const v = new THREE.Vector3(
        dir.x * speed * k + (Math.random() - 0.5) * 1.6,
        dir.y * speed * k + Math.random() * 1.8,
        dir.z * speed * k + (Math.random() - 0.5) * 1.6,
      );
      this.add(point, v, color, 0.012 + Math.random() * 0.025, 3 + Math.random() * 3, true);
    }
  }

  /** 상처에서 뚝뚝 떨어지는 핏방울 */
  drip(point) {
    if (!this.bloodOn) return;
    const v = new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.2, (Math.random() - 0.5) * 0.2);
    this.add(point, v, 0x7a0000, 0.012 + Math.random() * 0.01, 6, true);
  }

  sparks(point, amount) {
    const n = Math.min(24, Math.round(6 + amount));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 3);
      this.add(point, v, 0xffd27a, 0.012 + Math.random() * 0.01, 0.25 + Math.random() * 0.3, false);
    }
  }

  add(p, v, color, size, life, sticks) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ p: p.clone(), v, color: new THREE.Color(color), size, life, sticks, stuck: false });
  }

  update(dt) {
    const out = [];
    for (const it of this.list) {
      it.life -= dt;
      if (it.life <= 0) continue;
      if (!it.stuck) {
        it.v.y -= 9.81 * dt;
        it.p.addScaledVector(it.v, dt);
        if (it.p.y <= 0.002) {
          if (it.sticks) {
            // 바닥에 떨어진 피는 납작한 얼룩으로 남는다
            it.stuck = true;
            it.p.y = 0.002;
            it.life = 12;
            it.size *= 1.8;
          } else it.life = 0;
        }
      }
      out.push(it);
    }
    this.list = out;
    let i = 0;
    for (const it of this.list) {
      const s = it.size;
      this._s.set(s, it.stuck ? 0.002 : s, s);
      this._m.compose(it.p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, it.color);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
  }
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
  }

  // 브라우저 규칙상 사용자가 화면을 누른 뒤에만 소리를 켤 수 있다.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // 짧은 백색소음 버퍼 하나를 만들어 두고 재사용
      const len = this.ctx.sampleRate * 0.4;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** 몸에 맞는 둔탁한 소리 */
  hit(intensity) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const vol = Math.min(1, 0.25 + intensity / 40);
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900 + intensity * 20;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + 0.2);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(og).connect(c.destination);
    o.start(t);
    o.stop(t + 0.2);
  }

  // 공통: 잡음 한 방
  noiseBurst({ type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.002, decay = 0.15, delay = 0, freqEnd = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  tone(freq, freqEnd, vol, decay, type = 'sine', delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  /** 베기: 날카롭게 찢는 소리 + (에너지가 크면) 둔탁한 울림 */
  cut(energy, through) {
    if (!this.on || !this.ctx) return;
    const e = Math.min(1, energy / 140);
    this.noiseBurst({ type: 'bandpass', freq: 3200, freqEnd: 900, q: 1.2, vol: 0.25 + 0.4 * e, decay: through ? 0.22 : 0.12 });
    this.noiseBurst({ type: 'lowpass', freq: 500, vol: 0.2 + 0.5 * e, decay: 0.16 });
    this.tone(160, 60, 0.2 + 0.4 * e, 0.15);
  }

  /** 찌르기: 짧고 무거운 소리 */
  stab(energy) {
    if (!this.on || !this.ctx) return;
    const e = Math.min(1, energy / 100);
    this.noiseBurst({ type: 'lowpass', freq: 700, vol: 0.3 + 0.4 * e, decay: 0.12 });
    this.tone(120, 50, 0.3 + 0.4 * e, 0.14);
    this.noiseBurst({ type: 'bandpass', freq: 1800, q: 3, vol: 0.12, decay: 0.08, delay: 0.02 });
  }

  /** 둔기(칼 면, 손잡이, 막힌 베기): 퍽 */
  blunt(energy) {
    if (!this.on || !this.ctx) return;
    const e = Math.min(1, energy / 120);
    this.tone(110, 45, 0.25 + 0.5 * e, 0.18);
    this.noiseBurst({ type: 'lowpass', freq: 400 + 600 * e, vol: 0.2 + 0.4 * e, decay: 0.14 });
  }

  /** 뼈 부딪히는 소리 */
  bone(energy) {
    if (!this.on || !this.ctx) return;
    this.noiseBurst({ type: 'highpass', freq: 2500, vol: Math.min(0.5, energy / 200), decay: 0.04 });
    this.noiseBurst({ type: 'bandpass', freq: 1200, q: 4, vol: Math.min(0.3, energy / 300), decay: 0.06, delay: 0.01 });
  }

  /** 휘두르는 바람 소리 (칼끝 속도에 따라) */
  whoosh(speed) {
    if (!this.on || !this.ctx) return;
    const e = Math.min(1, (speed - 8) / 12);
    this.noiseBurst({ type: 'bandpass', freq: 500 + 900 * e, freqEnd: 250, q: 2, vol: 0.05 + 0.15 * e, attack: 0.06, decay: 0.28 });
  }

  /** 칼끼리 부딪히는 쇳소리 */
  clash(intensity) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const vol = Math.min(0.5, 0.08 + intensity / 60);
    const base = 900 + Math.random() * 500;
    for (const [mul, dec] of [
      [1, 0.6],
      [2.76, 0.35],
      [5.4, 0.2],
    ]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mul;
      const g = c.createGain();
      g.gain.setValueAtTime(vol / mul ** 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  진동(햅틱). 안드로이드는 표준 진동 기능, 아이폰(사파리)은 막혀 있어서
//  iOS 18부터 되는 우회: "스위치" 체크박스를 누르면 기기가 톡 하고 진동한다.
// ─────────────────────────────────────────────────────────────
let iosLabel = null;
let lastHaptic = 0;
export function haptic(strength = 1) {
  const now = performance.now();
  if (now - lastHaptic < 60) return; // 너무 잦으면 무시
  lastHaptic = now;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(Math.round(10 + 30 * Math.min(1, strength)));
      return;
    }
    if (!iosLabel) {
      iosLabel = document.createElement('label');
      iosLabel.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      iosLabel.appendChild(input);
      document.body.appendChild(iosLabel);
    }
    iosLabel.click();
    // 세게 맞으면 한 번 더 톡
    if (strength > 0.7) setTimeout(() => iosLabel.click(), 70);
  } catch {
    /* 지원 안 하면 조용히 넘어감 */
  }
}

// ─────────────────────────────────────────────────────────────
//  상처 자국: 맞은 부위에 붙는 핏자국. 부위가 움직이면 같이 움직인다.
// ─────────────────────────────────────────────────────────────
const woundMat = new THREE.MeshStandardMaterial({ color: 0x5a0606, roughness: 0.4, metalness: 0 });
const woundMatDark = new THREE.MeshStandardMaterial({ color: 0x2a0303, roughness: 0.6 });
const bruiseMat = new THREE.MeshStandardMaterial({ color: 0x4a2a44, roughness: 1, transparent: true, opacity: 0.55 });

/**
 * @param {THREE.Group} group 부위 그룹
 * @param {THREE.Vector3} local 부위 기준 접촉점
 * @param {THREE.Vector3} bladeLocal 부위 기준 칼날 방향(베인 자국이 이 방향으로 길게 남는다)
 */
export function addWoundMark(group, local, bladeLocal, type, severity, bloodOn = true) {
  let mesh;
  if (type === 'blunt') {
    if (severity < 0.01) return;
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.025 + severity * 0.02, 8, 6), bruiseMat);
    mesh.scale.set(1, 1, 0.3);
  } else if (type === 'stab') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.01, 10), bloodOn ? woundMatDark : bruiseMat);
    mesh.rotation.x = Math.PI / 2;
  } else {
    const len = Math.min(0.2, 0.05 + severity * 0.12);
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.008 + Math.min(0.012, severity * 0.01), len, 0.012), bloodOn ? woundMat : bruiseMat);
    // 칼날 방향으로 길게
    const d = bladeLocal.clone().normalize();
    if (d.lengthSq() > 0.5) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  }
  // 옷/피부 겉면으로 살짝 띄운다 (충돌 모양보다 옷이 약간 두껍다)
  mesh.position.copy(local).addScaledVector(local.clone().normalize(), 0.012);
  group.add(mesh);
}
