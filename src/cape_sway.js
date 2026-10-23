// 망토 흔들림 (10/24 — 사장님 10/24 02:0x '베르나르도 롤랑 아르토리아 망토에 다 넣어' · 02:1x '영상이나 스위치 필요 없어 바로 적용해'):
//  가슴에 단단히 붙어 몸통과 한 판처럼 움직이던 긴 망토에, 아래쪽이 몸 움직임을 반 박자 늦게 따라오며 살짝 흔들리는 '버금 움직임'을 더한다.
//  천 시뮬레이션이 아니다 — 뼈 몇 개짜리 스키닝(그리기 카드가 꼭짓점을 옮김): 어깨 줄 뼈 하나(고정) + 아래로 줄 뼈 CAPE.bones 개.
//   · 뼈는 모두 목 가운데 · 망토 위 끝 높이의 한 점(pivot)에서 돈다. 뼈 k 의 돌림 = 흔들림 각 × (k / bones)^ramp — 어깨 0 → 아랫단 1.
//     꼭짓점은 쉬는 높이로 이웃한 두 뼈에 나눠 걸린다(높이 몫 h = (위 끝 − y) / (위 끝 − 아랫단)) → 아래로 갈수록 크게 휜다.
//   · 흔들림 각 셋(앞뒤 · 옆 · 비틀림)은 몸통에서 읽은 두 가지에 감쇠 스프링으로 늦게 따라간다:
//       ① 몸통(망토 매단 점)의 선 가속 — 속도를 CAPE.lag 초로 늦게 따라간 값과의 차로 어림(내딛으면 아랫단이 뒤로 처짐)
//       ② 몸통의 각속도(돌기 · 비틀기 — 아랫단이 뒤에 남음)
//     + 아주 작은 숨쉬기 흔들림. 스프링은 CAPE.settle 초에 5 % 안으로 가라앉는다(감쇠비 CAPE.damping).
//   · 각은 부드럽게 묶는다(c · tanh(각 / c)) — 앞(다리 쪽)은 작게 · 뒤는 크게 · 옆 · 비틀림. 몸 · 다리 · 머리를 뚫고 접히지 않게.
//  겉모습만: 물리 몸 · 충돌체 · 판정 · AI 는 읽지도 쓰지도 않는다(가슴 그림 그룹의 자리 · 방향만 읽음 — syncMeshes 가 놓은 값).
//   만들 때(옷 입히기 — fighter.js isolatedVisual 안)의 three 객체 UUID 는 이 모듈의 따로 된 난수로 만들어 바깥 난수 흐름을 한 번도 쓰지 않는다.
//   main.js 게임 루프가 syncMeshes 뒤에 updateCapeSway(싸움꾼, 이번 프레임에 흐른 게임 시간)을 부르고, tools/sim/cape_clip.mjs 도 같은 함수로 잰다.
import * as THREE from 'three';
import { CAPE } from './config.js';

let _seed = 0x5bd1e995;
function quietly(fn) {
  const real = Math.random;
  Math.random = () => (_seed = (Math.imul(_seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

/**
 * 망토 메쉬들을 뼈 몇 개짜리 스키닝 메쉬로 바꿔 흔들림을 단다 (옷 만들 때 한 번).
 *  layer: 메쉬들이 든 천 층(artoriaCloth) · meshes: 망토 천 메쉬(겉감 · 안감 · 단 — 모두 layer 의 자식, 자리 · 방향 0)
 *  opts: { top, hem } 높이 몫을 잴 위 끝 · 아랫단 y (생략하면 메쉬들 꼭짓점의 가장 높은 · 낮은 y) · 그 밖의 CAPE 값을 인물별로 덮어씀
 *  메쉬의 모양(꼭짓점 · 줄 · 색) · 재질 · 이름 · 차례는 그대로 — 꼭짓점마다 뼈 번호 · 몫 두 칸만 더한다
 */
export function attachCapeSway(layer, meshes, opts = {}) {
  meshes = meshes.filter(Boolean);
  if (!meshes.length) return null;
  return quietly(() => {
    const cfg = { ...CAPE, ...opts, clamp: { ...CAPE.clamp, ...opts.clamp } };
    let top = -Infinity, hem = Infinity;
    for (const m of meshes) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > top) top = y;
        if (y < hem) hem = y;
      }
    }
    top = opts.top ?? top;
    hem = opts.hem ?? hem;
    const K = cfg.bones, span = Math.max(1e-3, top - hem);
    const pivot = new THREE.Vector3(0, top, 0);
    const bones = [];
    for (let k = 0; k <= K; k++) {
      const b = new THREE.Bone();
      b.name = `cape-sway-${k}`;
      b.position.copy(pivot);
      layer.add(b);
      bones.push(b);
    }
    const skinned = [];
    for (const m of meshes) {
      const g = m.geometry, p = g.attributes.position, n = p.count;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const h = THREE.MathUtils.clamp((top - p.getY(i)) / span, 0, 1) * K;
        const k = Math.min(K - 1, Math.floor(h)), w = h - k;
        si[i * 4] = k; si[i * 4 + 1] = k + 1;
        sw[i * 4] = 1 - w; sw[i * 4 + 1] = w;
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const s = new THREE.SkinnedMesh(g, m.material);
      for (const key of ['name', 'castShadow', 'receiveShadow', 'renderOrder', 'frustumCulled', 'visible']) s[key] = m[key];
      s.userData = m.userData;
      s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale);
      // 같은 자리(차례)에 바꿔 끼운다 — 이름 · 차례로 메쉬를 찾는 곳(cape_clip · look_hash)이 그대로 보게
      const parent = m.parent, at = parent.children.indexOf(m);
      parent.remove(m);
      parent.add(s);
      parent.children.splice(parent.children.indexOf(s), 1);
      parent.children.splice(at, 0, s);
      skinned.push(s);
    }
    let root = layer;
    while (root.parent) root = root.parent;
    root.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    for (const s of skinned) s.bind(skeleton);
    skeleton.computeBoneTexture(); // 그리기가 처음 만들면 바깥 난수를 쓴다 — 여기서 미리
    // 화면 밖 거르기 구: 쉬는 꼴 구 + 가장 크게 흔들린 아랫단이 옮겨 가는 거리 (화면 가장자리에서 흔들린 끝이 잘려 사라지지 않게)
    const reach = span * Math.sin(Math.max(cfg.clamp.fwd, cfg.clamp.back, cfg.clamp.side, cfg.clamp.twist));
    for (const s of skinned) {
      s.computeBoundingSphere();
      s.boundingSphere.radius += reach;
    }
    // 천 층의 그룹(부위 그림 그룹 = root) 안 자리 · 방향: 몸통 움직임을 망토 매단 점 · 천 층 축으로 읽는다
    const relQ = new THREE.Quaternion(), relP = new THREE.Vector3();
    layer.matrixWorld.decompose(relP, relQ, new THREE.Vector3());
    const pivotInRoot = pivot.clone().applyMatrix4(layer.matrixWorld);
    const ctl = {
      cfg, bones, skeleton, meshes: skinned, top, hem, relQ, pivotInRoot,
      ready: false, t: 0,
      prevP: new THREE.Vector3(), prevQ: new THREE.Quaternion(), vLag: new THREE.Vector3(),
      ang: new THREE.Vector3(), vel: new THREE.Vector3(), out: new THREE.Vector3(),
      ramp: bones.map((_, k) => Math.pow(k / K, cfg.ramp)),
    };
    layer.userData.capeSway = ctl;
    return ctl;
  });
}

const _list = new WeakMap();
function controllersOf(fighter) {
  let list = _list.get(fighter);
  if (!list) {
    list = [];
    fighter.groups?.chest?.traverse((o) => { if (o.userData.capeSway) list.push(o.userData.capeSway); });
    _list.set(fighter, list);
  }
  return list;
}

const _P = new THREE.Vector3(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _w = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YZX');
const soft = (x, c) => c * Math.tanh(x / c);

/**
 * 한 싸움꾼의 망토 흔들림을 dt(이번 프레임에 흐른 게임 시간 — 물리 스텝 수 × 스텝 길이) 만큼 나아가게 한다.
 *  syncMeshes 뒤에 부른다(가슴 그림 그룹의 자리 · 방향만 읽는다). 망토가 없는 싸움꾼은 아무 일도 없다
 */
export function updateCapeSway(fighter, dt) {
  const list = controllersOf(fighter);
  if (!list.length || !(dt > 0)) return;
  const group = fighter.groups.chest;
  for (const c of list) {
    const C = c.cfg;
    _q.copy(group.quaternion).multiply(c.relQ); // 천 층 축(+X 앞 · +Y 위 · +Z 오른쪽)의 월드 방향
    _P.copy(c.pivotInRoot).applyQuaternion(group.quaternion).add(group.position); // 망토 매단 점(월드)
    if (!c.ready || dt > 0.25) {
      c.prevP.copy(_P); c.prevQ.copy(_q); c.vLag.set(0, 0, 0);
      c.ready = true;
      continue;
    }
    _v.subVectors(_P, c.prevP).divideScalar(dt);
    if (_v.lengthSq() > 900) { // 30 m/s 넘게 튐 = 자리 옮김(판 새로 · 되살아남) — 셈을 처음부터
      c.prevP.copy(_P); c.prevQ.copy(_q); c.vLag.set(0, 0, 0);
      continue;
    }
    // ① 선 가속 어림: 속도 − (CAPE.lag 초로 늦게 따라간 속도) = 가속 × lag (꾸준한 가속에서) — 반 박자 늦은 가속
    c.vLag.lerp(_v, 1 - Math.exp(-dt / C.lag));
    _a.subVectors(_v, c.vLag).divideScalar(C.lag);
    // ② 각속도: 이번 프레임 방향 바뀜(작은 각)
    _dq.copy(_q).multiply(_qi.copy(c.prevQ).invert());
    if (_dq.w < 0) _dq.set(-_dq.x, -_dq.y, -_dq.z, -_dq.w);
    _w.set(_dq.x, _dq.y, _dq.z).multiplyScalar(2 / dt);
    c.prevP.copy(_P); c.prevQ.copy(_q);
    // 천 층 축으로
    _qi.copy(_q).invert();
    _a.applyQuaternion(_qi);
    _w.applyQuaternion(_qi);
    c.t += dt;
    const idle = C.idle, ph = (fighter.index ?? 0) * 2.1;
    // 목표 각 (아랫단, rad): x = 옆(+ 면 아랫단이 왼쪽 −Z 로) · y = 비틀림 · z = 앞뒤(+ 면 아랫단이 앞 +X 로)
    const tx = C.accel * _a.z - C.turn * _w.x + idle.amp * 0.5 * Math.sin((2 * Math.PI * c.t) / (idle.period * 1.5) + ph);
    const ty = -C.twist * _w.y;
    const tz = -C.accel * _a.x - C.turn * _w.z + idle.amp * Math.sin((2 * Math.PI * c.t) / idle.period + ph);
    // 감쇠 스프링 (반암시 오일러 · 잘게 나눠 폰의 긴 프레임에서도 안정)
    const wn = 3 / (C.damping * C.settle), k2 = wn * wn, d2 = 2 * C.damping * wn;
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    const A = c.ang, V = c.vel, L = C.clamp;
    for (let i = 0; i < n; i++) {
      V.x += (k2 * (tx - A.x) - d2 * V.x) * h;
      V.y += (k2 * (ty - A.y) - d2 * V.y) * h;
      V.z += (k2 * (tz - A.z) - d2 * V.z) * h;
      A.x += V.x * h; A.y += V.y * h; A.z += V.z * h;
    }
    // 스프링 상태가 묶음 밖으로 멀리 가 쌓이지 않게 (묶음의 두 배까지)
    A.x = THREE.MathUtils.clamp(A.x, -2 * L.side, 2 * L.side);
    A.y = THREE.MathUtils.clamp(A.y, -2 * L.twist, 2 * L.twist);
    A.z = THREE.MathUtils.clamp(A.z, -2 * L.back, 2 * L.fwd);
    c.out.set(soft(A.x, L.side), soft(A.y, L.twist), A.z > 0 ? soft(A.z, L.fwd) : soft(A.z, L.back));
    for (let k = 1; k < c.bones.length; k++) {
      const r = c.ramp[k];
      _e.set(c.out.x * r, c.out.y * r, c.out.z * r, 'YZX');
      c.bones[k].quaternion.setFromEuler(_e);
    }
  }
}

/** 지금 흔들림 각(아랫단, rad — 묶은 뒤): 재기 도구용 */
export function capeSwayAngles(fighter) {
  return controllersOf(fighter).map((c) => c.out.clone());
}
