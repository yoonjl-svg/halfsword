// ─────────────────────────────────────────────────────────────
//  무기 파편: 부러진 칼날 끝 조각이 날아가 땅에 튀고 1~2초 뒤 흐려지며 사라진다 (보여 주기만 — 물리 엔진·판정과 무관).
//  감독이 갑옷 파편과 합칠 수 있게 일부러 단순하게 따로 둔다: spawnDebris 로 띄우고 tickDebris(dt) 로 움직인다.
//   · 브라우저에선 스스로 requestAnimationFrame 으로 돈다 (게임 루프를 건드리지 않는다). 헤드리스 시뮬엔 자동 루프가 없어
//     tickDebris 를 직접 부르거나 clearDebris 로 치운다.
//   · 판이 바뀌면(주인 칼 그룹이 장면에서 빠지면) 바로 치운다 — main.js newRound 가 싸움꾼 메쉬를 걷어낼 때.
//  난수는 쓰지 않는다 (튀는 방향은 조각 번호로 정한다).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const DEBRIS = {
  life: 1.6, // 초: 이만큼 지나면 사라진다
  fade: 0.5, // 초: 마지막 이만큼 동안 흐려진다
  gravity: 9.81,
  floorY: 0, // 경기장 바닥 높이
  bounce: 0.3, // 땅에 튈 때 되튀는 비율
  groundFriction: 0.55, // 땅에 닿을 때 수평 속도에 곱한다
  kick: 0.8, // 부러질 때 옆으로 튕겨 나가는 속도 (m/s)
  headless: false, // 브라우저 밖(시뮬)에서도 조각을 띄울까 (검사 도구만 켠다 — 자동 루프가 없어 쌓이기만 한다)
};

const live = [];
let rafOn = false;
let lastT = 0;
let count = 0;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _box = new THREE.Box3();

/**
 * 조각 하나를 띄운다. frag: 자식 좌표가 칼 그룹 기준인 그룹. pos/quat: 부러진 순간 칼 몸체의 자세,
 *  vel/angvel: 그 몸체의 속도·각속도 (월드). owner: 판이 바뀌면 장면에서 빠지는 칼 그룹 (정리 신호).
 */
export function spawnDebris(scene, frag, { pos, quat, vel, angvel, owner }) {
  frag.position.copy(pos);
  frag.quaternion.copy(quat);
  frag.updateMatrixWorld(true);
  // 조각 중심 속도 = 몸체 속도 + 각속도 × (중심 − 몸체 원점) + 옆으로 살짝 튕김
  _box.setFromObject(frag);
  const c = _box.getCenter(new THREE.Vector3());
  const r = c.clone().sub(pos);
  const v = new THREE.Vector3().crossVectors(angvel, r).add(vel);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).multiplyScalar(count++ % 2 ? DEBRIS.kick : -DEBRIS.kick);
  v.add(side).setY(v.y + 1.2);
  // 회전 중심을 조각 중심으로 옮긴다 (자식을 그만큼 반대로 민다)
  const pivot = new THREE.Group();
  pivot.position.copy(c);
  const local = c.clone().sub(pos).applyQuaternion(quat.clone().invert());
  for (const ch of [...frag.children]) ch.position.sub(local);
  frag.position.set(0, 0, 0);
  pivot.quaternion.copy(quat);
  frag.quaternion.identity();
  pivot.add(frag);
  const mats = [];
  frag.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.transparent = true;
      mats.push({ m, base: m.opacity ?? 1 });
    }
  });
  const size = _box.getSize(new THREE.Vector3());
  scene.add(pivot);
  live.push({ scene, obj: pivot, vel: v, w: angvel.clone().multiplyScalar(0.6), mats, t: 0, half: Math.max(0.01, Math.min(size.x, size.y, size.z) / 2), owner });
  startLoop();
  return pivot;
}

function remove(d) {
  d.scene.remove(d.obj);
  d.obj.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}

/** 한 프레임 움직인다 (초). 다 사라지면 false */
export function tickDebris(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const d = live[i];
    d.t += dt;
    if (d.t >= DEBRIS.life || (d.owner && !d.owner.parent)) {
      remove(d);
      live.splice(i, 1);
      continue;
    }
    const o = d.obj;
    d.vel.y -= DEBRIS.gravity * dt;
    o.position.addScaledVector(d.vel, dt);
    const wl = d.w.length();
    if (wl > 1e-4) o.quaternion.premultiply(_q.setFromAxisAngle(_v.copy(d.w).divideScalar(wl), wl * dt));
    const floor = DEBRIS.floorY + d.half;
    if (o.position.y < floor) {
      o.position.y = floor;
      if (d.vel.y < 0) d.vel.y = -d.vel.y * DEBRIS.bounce;
      d.vel.x *= DEBRIS.groundFriction;
      d.vel.z *= DEBRIS.groundFriction;
      d.w.multiplyScalar(0.5);
      d.landed = true; // (제안) 조각이 땅에 떨어지는 소리를 붙일 자리
    }
    const left = DEBRIS.life - d.t;
    if (left < DEBRIS.fade) for (const { m, base } of d.mats) m.opacity = base * (left / DEBRIS.fade);
  }
  return live.length > 0;
}

/** 남은 조각을 모두 치운다 */
export function clearDebris() {
  for (const d of live) remove(d);
  live.length = 0;
}

/** 이 환경에서 조각을 띄울까 (브라우저, 또는 검사 도구가 headless 를 켰을 때) */
export function debrisEnabled() {
  return DEBRIS.headless || typeof requestAnimationFrame === 'function';
}

/** 지금 떠 있는 조각 수 (검사용) */
export function debrisCount() {
  return live.length;
}

function startLoop() {
  if (rafOn || typeof requestAnimationFrame !== 'function') return;
  rafOn = true;
  lastT = performance.now();
  const step = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (tickDebris(dt)) requestAnimationFrame(step);
    else rafOn = false;
  };
  requestAnimationFrame(step);
}
