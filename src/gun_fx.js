// ─────────────────────────────────────────────────────────────
//  권총 겉모습 효과 (외형 PM, 사장님 결정 "총구 섬광·연기 필요"): 쏠 때 총구에 섬광 두 장(별 모양 큰 것 + 뜨거운 심)이
//  두어 프레임 번쩍이고, 회색 연기 점 24개가 총신 방향으로 뿜어져 나가 위로 흩어지며 1초 안에 사라진다.
//   · gun.js 의 GUN_HOOKS.onShot 을 감싼다: 원래 걸린 것(소리)은 그대로 부르고, 없으면 gun.js 의 총소리를 직접 낸다 — 판정·난수 무관.
//   · 총신 방향은 gun.js fire 와 같은 계산(칼 축 +y 를 총 몸체 회전으로). 연기의 퍼짐은 정해진 표(난수 없음).
//   · 스스로 돈다(requestAnimationFrame): main.js 는 installGunFx({ scene, sound }) 한 줄만 부른다. 일시정지 중에는 멈춘다.
//   · 판이 바뀔 때는 clearGunFx() (main.js 가 clearDebris() 를 부르는 자리에 한 줄) — 흔적이 쌓이지 않는다.
//   · 폰에서 가볍게: 효과 두 벌(두 검객이 거의 동시에 쏠 때)만 미리 만들어 돌려쓴다. 조명은 안 만든다.
//   · 총알 궤적 (사장님 결정 "방식 B"): 총구에서 총알이 닿은 곳까지 옅은 담황색 줄 하나가 0.1초쯤 보였다 사라진다 — 빗나갔는지 한눈에 읽힌다.
//     실제 총알 방향(gun.js 의 퍼짐·AI 보정이 든 것)과 닿은 거리는 무기 PM 이 onShot(f, p, dir, dist) 로 넘긴다.
//     안 넘어오면 총신 방향으로 그리고, 거리는 gun.js 와 같은 광선으로 재고 아니면 GUN.range 다.
//     무기 PM 의 GUN_HOOKS.onImpact(f, point, dir, what) 가 오면(닿았을 때만, onShot 바로 뒤) 그 발의 줄을 실제 방향·닿은 점으로 바로잡는다.
//   · 총구: onShot 의 pos 가 총구다(리볼버는 총신이 주먹 위 8 cm — 칼 축이 아니다). 레이저 시작점도 같은 자리(칼 몸체 (weapon.muzzleX, 손잡이+총신 길이, 0)).
//   · 조준 레이저 (사장님: "아주 미세해야 해 … 희미하게"): 총을 든 검객마다 총구에서 총신 방향으로 처음 닿는 곳까지 아주 옅은 붉은 선과
//     닿은 자리의 작은 점. 매 프레임 gun.js 와 같은 광선으로 잰다(world·combat 필요, 판정과 무관한 읽기뿐). 장전 중에도 같은 밝기 —
//     장전 표시는 하지 않는다(사장님). 겉모습은 여기서만 정한다: gun.js 의 GUN.laser 는 무기 PM 이 끈다 (두 겹으로 그리지 않게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GUN, GUN_HOOKS, gunshotSound } from './gun.js';
import { canvasTex } from './stage_kit.js';

const FLASH_T = 0.075; // 초: 섬광이 보이는 시간 (60fps 에서 네댓 프레임)
const SMOKE_T = 1.2; // 초: 연기가 사라지기까지
const TRACE_T = 0.11; // 초: 총알 궤적 줄이 사라지기까지 (60fps 에서 예닐곱 프레임 — 한 프레임이면 폰에서 놓친다)
const NP = 24; // 연기 점 수
const LASER_A = 0.13; // 조준 레이저 선의 불투명도 — 있는 듯 없는 듯, 눈밭 위에서도 겨우 보이는 정도
const LASER_DOT_A = 0.3; // 닿은 자리 점 (겨누는 데 쓰는 건 이 점이라 선보다 조금 또렷하게)

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
const _Y = new THREE.Vector3(0, 1, 0);
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

let _clear = null;
/** 판이 바뀔 때(main.js 가 clearDebris() 를 부르는 자리) 남은 섬광·연기를 바로 거둔다. 효과는 1.2초 안에 스스로 사라지지만 쌓임 없이 깨끗이 (디렉터 조건) */
export function clearGunFx() {
  _clear?.();
}

/**
 * 권총 효과를 설치한다. scene: 장면, sound: main.js 의 Sound (GUN_HOOKS.onShot 이 비어 있을 때 총소리를 내는 데 쓴다).
 *  world·combat 은 안 넘겨도 된다: 검객의 world(f.world)와 window.game.combat 을 그때그때 읽는다 (main.js 는 combat 을 나중에 만든다).
 *  레이저·궤적 끝을 재는 광선에만 쓴다 (gun.js 와 같은 광선, 판정과 무관한 읽기뿐).
 *  반환 { fire(pos, dir, dist), clear() } — 점검 도구가 직접 터뜨려 볼 때 / 판 바뀜에 치울 때
 */
export function installGunFx({ scene, sound, world = null, combat = null }) {
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
    // 궤적: 가는 네모 기둥 (+y 로 1 m, 길이는 scale.y). 보통 섞기·호박색 — 더하기 섞기는 눈밭·밝은 하늘 앞에서 아예 안 보였다
    const trace = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 1, 0.01).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    trace.visible = false;
    trace.renderOrder = 4;
    scene.add(flash, core, smoke, trace);
    pool.push({ flash, core, smoke, trace, pos, vel: new Float32Array(NP * 3), t: -1, o: new THREE.Vector3(), d: new THREE.Vector3(), origin: new THREE.Vector3() });
  }
  let next = 0;

  const aimTrace = (e, origin, dir, dist) => {
    e.trace.position.copy(origin);
    e.trace.quaternion.setFromUnitVectors(_Y, dir);
    e.trace.scale.set(1, Math.max(0.01, dist), 1);
    e.trace.visible = true;
  };
  const fire = (origin, dir, dist = GUN.range) => {
    const e = pool[next];
    next = (next + 1) % pool.length;
    e.t = 0;
    e.o.copy(origin).addScaledVector(dir, 0.03);
    e.d.copy(dir).normalize();
    // 궤적 줄: 총구에서 닿은 곳까지 (onImpact 가 오면 실제 방향·점으로 바로잡는다)
    e.origin.copy(origin);
    aimTrace(e, origin, e.d, dist);
    return e;
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
    if (t < TRACE_T) {
      const k = t / TRACE_T;
      e.trace.material.opacity = 0.42 * (1 - k * k); // 옅게 시작해 빠르게 사라진다 (사장님: 옅은 줄 하나)
    } else e.trace.visible = false;
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

  // 궤적 끝 거리 재기 (onShot 이 dist 를 안 넘길 때): gun.js castRay 와 같은 광선 — 쏜 사람 자신의 콜라이더는 건너뛴다
  const getCombat = () => combat ?? globalThis.window?.game?.combat ?? null;
  const measure = (f, o, d) => {
    const w = world ?? f.world;
    if (!w?.castRay) return GUN.range;
    const info = getCombat()?.info;
    const ray = { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } };
    const hit = w.castRay(ray, GUN.range, true, undefined, undefined, undefined, undefined, (c) => info?.get(c.handle)?.fighter !== f);
    return hit ? (hit.timeOfImpact ?? hit.toi) : GUN.range;
  };

  // 조준 레이저: 총을 든 검객 수만큼 (판마다 검객이 바뀌므로 자리로 돌려쓴다)
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: LASER_A, depthWrite: false });
  const dotMat = laserMat.clone();
  dotMat.opacity = LASER_DOT_A;
  const beamGeo = new THREE.BoxGeometry(0.005, 1, 0.005).translate(0, 0.5, 0);
  const dotGeo = new THREE.SphereGeometry(0.012, 6, 4);
  const lasers = [];
  const laserSlot = (i) => {
    while (lasers.length <= i) {
      const beam = new THREE.Mesh(beamGeo, laserMat);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      beam.renderOrder = dot.renderOrder = 2;
      beam.visible = dot.visible = false;
      scene.add(beam, dot);
      lasers.push({ beam, dot });
    }
    return lasers[i];
  };
  const updateLasers = () => {
    let n = 0;
    for (const f of getCombat()?.fighters ?? []) {
      if (!f.weapon?.gun || !f.alive || !f.armed) continue;
      const r = f.sword?.rotation?.();
      if (!r) continue;
      const L = laserSlot(n++);
      _q.set(r.x, r.y, r.z, r.w);
      _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향 (gun.js 와 같다)
      f.bladePoint(1, _u); // 칼 축 끝
      const mx = f.weapon.muzzleX ?? 0; // 총신이 칼 축에서 비켜 있으면(리볼버, 주먹 위) 그만큼 옮긴다 — gun.js muzzle() 과 같다
      if (mx) _u.add(_v.set(mx, 0, 0).applyQuaternion(_q));
      const dist = measure(f, _u, _d);
      L.beam.position.copy(_u);
      L.beam.quaternion.setFromUnitVectors(_Y, _d);
      L.beam.scale.set(1, Math.max(0.01, dist), 1);
      L.dot.position.copy(_u).addScaledVector(_d, dist);
      L.beam.visible = true;
      L.dot.visible = dist < GUN.range; // 허공으로 나가면 점은 없다
    }
    for (let i = n; i < lasers.length; i++) lasers[i].beam.visible = lasers[i].dot.visible = false;
  };

  const lastFire = new WeakMap(); // 검객 → 방금 쏜 효과 (onImpact 가 줄을 바로잡을 때)
  // gun.js 의 onShot 을 감싼다 (소리는 그대로). dir·dist 는 무기 PM 이 넘기는 실제 총알 방향·닿은 거리 (없으면 총신 방향으로 잰다)
  const prev = GUN_HOOKS.onShot;
  GUN_HOOKS.onShot = (f, p, dir, dist) => {
    if (prev) prev(f, p, dir, dist);
    else if (sound?.ctx && sound._on) gunshotSound(sound, p);
    if (dir) _d.set(dir.x, dir.y, dir.z).normalize();
    else {
      const r = f.sword?.rotation?.();
      if (!r) return;
      _q.set(r.x, r.y, r.z, r.w);
      _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향 (gun.js fire 와 같다)
    }
    lastFire.set(f, fire(p, _d, typeof dist === 'number' && dist > 0 ? dist : measure(f, p, _d)));
  };
  // 무기 PM 의 onImpact (닿았을 때만, 같은 fire() 안에서 onShot 바로 뒤): 방금 쏜 줄을 실제 총알 방향·닿은 점으로 바로잡는다
  const prevImpact = GUN_HOOKS.onImpact;
  GUN_HOOKS.onImpact = (f, point, dir, what) => {
    if (prevImpact) prevImpact(f, point, dir, what);
    const e = lastFire.get(f);
    if (!e || e.t < 0 || e.t > 0.05 || !point) return;
    _d.set(point.x, point.y, point.z).sub(e.origin);
    const dist = _d.length();
    if (dist < 0.01) return;
    aimTrace(e, e.origin, _d.divideScalar(dist), dist);
  };

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (globalThis.window?.game?.state !== 'paused') {
      for (const e of pool) if (e.t >= 0) step(e, dt);
      updateLasers();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  _clear = () => {
    for (const e of pool) {
      e.t = -1;
      e.flash.visible = e.core.visible = e.smoke.visible = e.trace.visible = false;
    }
    for (const L of lasers) L.beam.visible = L.dot.visible = false;
  };
  return { fire, clear: _clear };
}
