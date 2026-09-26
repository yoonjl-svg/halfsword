// ─────────────────────────────────────────────────────────────
//  타격감 연출: 피/불꽃 입자, 효과음(파일 없이 코드로 합성)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

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

  /**
   * 칼마다 하나씩 계속 도는 바람 소리. 칼끝 속도에 따라 커지고 높아진다 → 칼이 가속·감속하는 게 들린다.
   * 음량 곡선은 아래로 볼록 (Blade & Sorcery의 긴 칼 바람 소리 곡선 모양: 느릴 땐 거의 안 들리다가 빨라지면 확 커진다)
   */
  whooshLoop() {
    if (!this.ctx) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.value = 300;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
    const self = this;
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16)); // 칼끝 4 → 20 m/s
        const vol = self.on ? 0.6 * Math.pow(x, 2.2) * 0.5 : 0; // (0,0) (0.66, ≈0.25) (1, 0.6) × 전체 음량
        const t = c.currentTime;
        g.gain.setTargetAtTime(vol, t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
      },
    };
  }

  /** 휘두르는 바람 소리 한 번 (예전 방식, 지금은 whooshLoop를 쓴다) */
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
let pending = null; // 아이폰: 다음 손가락 떼는 순간 울릴 진동

function iosTap() {
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
}

export function haptic(strength = 1) {
  const now = performance.now();
  try {
    if (navigator.vibrate) {
      if (now - lastHaptic < 60) return;
      lastHaptic = now;
      navigator.vibrate(Math.round(10 + 30 * Math.min(1, strength)));
      return;
    }
    // 아이폰 사파리는 손가락이 화면을 누르거나 뗀 "그 순간"에만 진동을 허락한다.
    // 그래서 예약해 두었다가 곧 손가락을 뗄 때 울린다 (flushHaptic).
    pending = { strength: Math.max(pending?.strength || 0, strength), until: now + 600 };
  } catch {
    /* 지원 안 하면 조용히 넘어감 */
  }
}

/** 손가락을 뗄 때(input.js가 부른다) 예약된 진동을 울린다 */
export function flushHaptic() {
  if (!pending) return;
  const p = pending;
  pending = null;
  if (performance.now() > p.until) return;
  try {
    iosTap();
    if (p.strength > 0.7) setTimeout(iosTap, 70);
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────────────────────────────────────
//  흔적(데칼): 상처, 옷 찢김, 번지는 핏자국, 멍, 투구 긁힘/찌그러짐.
//  그림을 몸 표면에 "투사"해서 붙인다 → 곡면·모서리를 따라 딱 붙고, 부위와 함께 움직인다.
//  그림은 파일 없이 캔버스에 코드로 그린다.
// ─────────────────────────────────────────────────────────────
const texCache = {};
function rand(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}
function texture(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = rand(kind.length * 977 + 13);
  const blob = (x, y, rad, color) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color);
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  if (kind === 'soak') {
    for (let i = 0; i < 18; i++) blob(64 + (r() - 0.5) * 50, 64 + (r() - 0.5) * 50, 14 + r() * 26, 'rgba(70,4,4,0.55)');
    blob(64, 64, 34, 'rgba(60,2,2,0.8)');
  } else if (kind === 'cut' || kind === 'tear') {
    // 가운데 벌어진 틈(어두움) + 붉은 속살 + 가장자리 번짐
    for (let i = 0; i < 10; i++) blob(64 + (r() - 0.5) * 16, 10 + i * 11, 12 + r() * 8, 'rgba(90,6,6,0.35)');
    g.strokeStyle = 'rgba(25,4,4,0.95)';
    g.lineWidth = kind === 'tear' ? 14 : 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(64, 8);
    for (let y = 8; y <= 120; y += 8) g.lineTo(64 + (r() - 0.5) * 6, y);
    g.stroke();
    g.strokeStyle = 'rgba(150,20,15,0.95)';
    g.lineWidth = kind === 'tear' ? 6 : 3;
    g.beginPath();
    g.moveTo(64, 14);
    g.lineTo(64, 114);
    g.stroke();
  } else if (kind === 'stab') {
    blob(64, 64, 40, 'rgba(90,6,6,0.5)');
    blob(64, 64, 14, 'rgba(20,2,2,1)');
  } else if (kind === 'bruise') {
    for (let i = 0; i < 6; i++) blob(64 + (r() - 0.5) * 30, 64 + (r() - 0.5) * 30, 20 + r() * 18, 'rgba(70,35,70,0.35)');
  } else if (kind === 'scratch') {
    g.strokeStyle = 'rgba(245,248,250,0.95)';
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(58 + k * 5 + (r() - 0.5) * 4, 6);
      g.lineTo(60 + k * 4 + (r() - 0.5) * 4, 122);
      g.stroke();
    }
  } else if (kind === 'dent') {
    blob(64, 64, 50, 'rgba(20,22,25,0.75)');
    blob(52, 52, 16, 'rgba(230,235,240,0.5)');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache[kind] = t;
  return t;
}
function decalMaterial(kind) {
  const metal = kind === 'scratch' || kind === 'dent';
  return new THREE.MeshStandardMaterial({
    map: texture(kind),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: metal ? 0.2 : 0.7,
    metalness: metal ? 0.9 : 0,
  });
}

/** 표면 방향(법선) 어림: 상자는 가장 가까운 면, 캡슐은 옆면, 구는 바깥쪽 */
function surfaceNormal(mesh, p) {
  const t = mesh.geometry.type;
  const P = mesh.geometry.parameters || {};
  if (t === 'BoxGeometry') {
    const rx = Math.abs(p.x) / (P.width / 2);
    const ry = Math.abs(p.y) / (P.height / 2);
    const rz = Math.abs(p.z) / (P.depth / 2);
    if (rx >= ry && rx >= rz) return new THREE.Vector3(Math.sign(p.x) || 1, 0, 0);
    if (ry >= rz) return new THREE.Vector3(0, Math.sign(p.y) || 1, 0);
    return new THREE.Vector3(0, 0, Math.sign(p.z) || 1);
  }
  if (t === 'CapsuleGeometry') {
    const half = (P.height || 0) / 2;
    if (Math.abs(p.y) > half) return new THREE.Vector3(p.x, p.y - Math.sign(p.y) * half, p.z).normalize();
    const n = new THREE.Vector3(p.x, 0, p.z);
    return n.lengthSq() > 1e-8 ? n.normalize() : new THREE.Vector3(1, 0, 0);
  }
  const n = p.clone();
  return n.lengthSq() > 1e-8 ? n.normalize() : new THREE.Vector3(1, 0, 0);
}

const _Z = new THREE.Vector3(0, 0, 1);
const _mw = new THREE.Matrix4();

/**
 * 메쉬 표면에 흔적을 붙인다.
 * @param {THREE.Mesh} mesh 대상(부위의 옷/피부 메쉬)
 * @param {THREE.Vector3} p  메쉬 기준 위치
 * @param {THREE.Vector3|null} along 메쉬 기준 방향 — 베인 자국이 이 방향으로 길게 남는다
 * @param {number} w,h 크기(m)
 */
export function stickDecal(mesh, p, along, kind, w, h) {
  const n = surfaceNormal(mesh, p);
  const q = new THREE.Quaternion().setFromUnitVectors(_Z, n);
  if (along) {
    const xA = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const yA = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const b = along.clone().addScaledVector(n, -along.dot(n));
    if (b.lengthSq() > 1e-6) q.multiply(new THREE.Quaternion().setFromAxisAngle(_Z, Math.atan2(-b.dot(xA), b.dot(yA))));
  }
  const decal = new THREE.Mesh(new THREE.BufferGeometry(), decalMaterial(kind));
  decal.userData = { mesh, p: p.clone(), rot: new THREE.Euler().setFromQuaternion(q), kind, w, h };
  rebuildDecal(decal, w, h);
  mesh.add(decal);
  return decal;
}

/** 크기를 바꿔 다시 투사 (핏자국이 번질 때) */
export function rebuildDecal(decal, w, h) {
  const { mesh, p, rot } = decal.userData;
  // 메쉬 자기 좌표계에서 투사하려고 잠깐 월드 행렬을 단위행렬로 바꾼다
  _mw.copy(mesh.matrixWorld);
  mesh.matrixWorld.identity();
  const geo = new DecalGeometry(mesh, p, rot, new THREE.Vector3(w, h, Math.max(w, h) * 1.5 + 0.05));
  mesh.matrixWorld.copy(_mw);
  decal.geometry.dispose();
  decal.geometry = geo;
  decal.userData.w = w;
  decal.userData.h = h;
}
