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

  /** 피(또는 피 끄기 설정이면 먼지) */
  blood(point, dir, amount) {
    const n = Math.min(40, Math.round(4 + amount * 1.2));
    const color = this.bloodOn ? 0x8a0000 : 0xcfc3a6;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        dir.x * 0.25 + (Math.random() - 0.5) * 2.2,
        dir.y * 0.25 + Math.random() * 2.2,
        dir.z * 0.25 + (Math.random() - 0.5) * 1.5,
      );
      this.add(point, v, color, 0.02 + Math.random() * 0.025, 3 + Math.random() * 3, true);
    }
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
