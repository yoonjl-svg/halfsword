// ─────────────────────────────────────────────────────────────
//  권총 겉모습 효과 (외형 PM, 사장님 결정 "총구 섬광·연기 필요"): 쏠 때 총구에 섬광 두 장(별 모양 큰 것 + 뜨거운 심)이
//  두어 프레임 번쩍이고, 회색 연기 점 24개가 총신 방향으로 뿜어져 나가 위로 흩어지며 1초 안에 사라진다.
//   · gun.js 의 GUN_HOOKS.onShot 을 감싼다: 원래 걸린 것(소리)은 그대로 부르고, 없으면 gun.js 의 총소리를 직접 낸다 — 판정·난수 무관.
//   · 총신 방향은 gun.js fire 와 같은 계산(칼 축 +y 를 총 몸체 회전으로). 연기의 퍼짐은 정해진 표(난수 없음).
//   · 스스로 돈다(requestAnimationFrame): main.js 는 installGunFx({ scene, sound }) 한 줄만 부른다. 일시정지 중에는 멈춘다.
//   · 판이 바뀔 때는 clearGunFx() (main.js 가 clearDebris() 를 부르는 자리에 한 줄) — 흔적이 쌓이지 않는다.
//   · 폰에서 가볍게: 효과 두 벌(두 검객이 거의 동시에 쏠 때)만 미리 만들어 돌려쓴다. 조명은 안 만든다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GUN_HOOKS, gunshotSound } from './gun.js';
import { canvasTex } from './stage_kit.js';

const FLASH_T = 0.075; // 초: 섬광이 보이는 시간 (60fps 에서 네댓 프레임)
const SMOKE_T = 1.2; // 초: 연기가 사라지기까지
const NP = 24; // 연기 점 수

/** 섬광: 네 갈래 별 + 둥근 심 (가운데 흰빛 → 주황 → 투명) */
function flashTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const c = w / 2;
    let rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(255,250,225,1)');
    rg.addColorStop(0.18, 'rgba(255,210,120,0.9)');
    rg.addColorStop(0.45, 'rgba(255,140,50,0.35)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    // 네 갈래 (가로·세로 길게, 대각선 짧게)
    g.fillStyle = 'rgba(255,235,180,0.85)';
    for (const [len, wd, rot] of [
      [c, 3, 0],
      [c, 3, Math.PI / 2],
      [c * 0.55, 2, Math.PI / 4],
      [c * 0.55, 2, -Math.PI / 4],
    ]) {
      g.save();
      g.translate(c, c);
      g.rotate(rot);
      const lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,235,180,0)');
      lg.addColorStop(0.5, 'rgba(255,245,215,0.95)');
      lg.addColorStop(1, 'rgba(255,235,180,0)');
      g.fillStyle = lg;
      g.fillRect(-len, -wd / 2, len * 2, wd);
      g.restore();
    }
  });
}
function puffTexture() {
  return canvasTex(32, 32, (g, w, h) => {
    const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    rg.addColorStop(0, 'rgba(255,255,255,0.9)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  });
}

// 연기 점마다 정해진 흩어짐 (난수 없음): [옆 u, 옆 v, 앞 속도 배, 위로]
const SPREAD = Array.from({ length: NP }, (_, i) => {
  const a = i * 2.399963; // 황금각으로 고르게
  const rr = 0.25 + ((i * 7) % NP) / NP;
  return [Math.cos(a) * rr, Math.sin(a) * rr, 0.6 + ((i * 5) % NP) / NP, 0.4 + ((i * 3) % NP) / NP / 2];
});

const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

let _clear = null;
/** 판이 바뀔 때(main.js 가 clearDebris() 를 부르는 자리) 남은 섬광·연기를 바로 거둔다. 효과는 1.2초 안에 스스로 사라지지만 쌓임 없이 깨끗이 (디렉터 조건) */
export function clearGunFx() {
  _clear?.();
}

/**
 * 권총 효과를 설치한다. scene: 장면, sound: main.js 의 Sound (GUN_HOOKS.onShot 이 비어 있을 때 총소리를 내는 데 쓴다).
 *  반환 { fire(pos, dir), clear() } — 점검 도구가 직접 터뜨려 볼 때 / 판 바뀜에 치울 때
 */
export function installGunFx({ scene, sound }) {
  const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const puffMap = puffTexture();
  const pool = [];
  for (let k = 0; k < 2; k++) {
    const flash = new THREE.Sprite(flashMat.clone());
    const core = new THREE.Sprite(flashMat.clone());
    core.material.color.set(0xfff4d0);
    flash.visible = core.visible = false;
    flash.renderOrder = core.renderOrder = 5;
    const pos = new Float32Array(NP * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: puffMap, transparent: true, opacity: 0, depthWrite: false, color: 0x7d7874 })); // 흰 눈밭·밝은 하늘 앞에서도 보이게 조금 짙은 회색
    smoke.frustumCulled = false;
    smoke.visible = false;
    scene.add(flash, core, smoke);
    pool.push({ flash, core, smoke, pos, vel: new Float32Array(NP * 3), t: -1, o: new THREE.Vector3(), d: new THREE.Vector3() });
  }
  let next = 0;

  const fire = (origin, dir) => {
    const e = pool[next];
    next = (next + 1) % pool.length;
    e.t = 0;
    e.o.copy(origin).addScaledVector(dir, 0.03);
    e.d.copy(dir).normalize();
    // 총신에 수직인 두 축
    _u.set(0, 1, 0);
    if (Math.abs(e.d.y) > 0.9) _u.set(1, 0, 0);
    _u.cross(e.d).normalize();
    _v.crossVectors(e.d, _u);
    for (let i = 0; i < NP; i++) {
      const [su, sv, fw, up] = SPREAD[i];
      e.pos[i * 3] = e.o.x;
      e.pos[i * 3 + 1] = e.o.y;
      e.pos[i * 3 + 2] = e.o.z;
      e.vel[i * 3] = e.d.x * 1.3 * fw + _u.x * su * 0.6 + _v.x * sv * 0.6;
      e.vel[i * 3 + 1] = e.d.y * 1.3 * fw + _u.y * su * 0.6 + _v.y * sv * 0.6 + up * 0.3;
      e.vel[i * 3 + 2] = e.d.z * 1.3 * fw + _u.z * su * 0.6 + _v.z * sv * 0.6;
    }
    e.flash.position.copy(e.o).addScaledVector(e.d, 0.05);
    e.core.position.copy(e.o).addScaledVector(e.d, 0.02);
    e.flash.visible = e.core.visible = e.smoke.visible = true;
    step(e, 0);
  };

  const step = (e, dt) => {
    e.t += dt;
    const t = e.t;
    if (t < FLASH_T) {
      const k = t / FLASH_T;
      e.flash.scale.setScalar(0.3 + 0.35 * k);
      e.flash.material.opacity = 1 - k * 0.7;
      e.flash.material.rotation = k * 0.6;
      e.core.scale.setScalar(0.12 + 0.05 * k);
      e.core.material.opacity = 1 - k;
    } else e.flash.visible = e.core.visible = false;
    if (t < SMOKE_T) {
      const damp = Math.max(0, 1 - dt * 3);
      for (let i = 0; i < NP; i++) {
        const j = i * 3;
        e.pos[j] += e.vel[j] * dt;
        e.pos[j + 1] += e.vel[j + 1] * dt;
        e.pos[j + 2] += e.vel[j + 2] * dt;
        e.vel[j] *= damp;
        e.vel[j + 1] = e.vel[j + 1] * damp + 0.25 * dt; // 연기는 느려지며 떠오른다
        e.vel[j + 2] *= damp;
      }
      e.smoke.geometry.attributes.position.needsUpdate = true;
      const k = t / SMOKE_T;
      e.smoke.material.opacity = 0.75 * (1 - k) * (1 - k * 0.6);
      e.smoke.material.size = 0.16 + 0.3 * k; // 퍼지며 커진다
    } else {
      e.smoke.visible = false;
      e.t = -1;
    }
  };

  // gun.js 의 onShot 을 감싼다 (소리는 그대로)
  const prev = GUN_HOOKS.onShot;
  GUN_HOOKS.onShot = (f, p) => {
    if (prev) prev(f, p);
    else if (sound?.ctx && sound._on) gunshotSound(sound, p);
    const r = f.sword?.rotation?.();
    if (!r) return;
    _q.set(r.x, r.y, r.z, r.w);
    _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향 (gun.js fire 와 같다)
    fire(p, _d);
  };

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (globalThis.window?.game?.state !== 'paused') for (const e of pool) if (e.t >= 0) step(e, dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  _clear = () => {
    for (const e of pool) {
      e.t = -1;
      e.flash.visible = e.core.visible = e.smoke.visible = false;
    }
  };
  return { fire, clear: _clear };
}
