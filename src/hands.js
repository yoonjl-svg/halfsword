// ─────────────────────────────────────────────────────────────
//  벙어리장갑 손 (외형 PM, 사장님 10/2 "손가락을 다 그리진 않더라도 최소한 벙어리 장갑처럼 엄지가 보이게.
//  그렇지 않으면 무기를 쥔 모습이 계속 어색하겠다"). 겉모습만 — 물리 몸체·관절·판정은 그대로.
//   · 쥔 손(주먹): 손바닥 덩이(납작한 타원체)가 칼자루를 감싸고 엄지 하나가 자루를 둘러 감는다. 칼 그룹의 자식이라
//     칼자루 축(실제 물리 칼 몸체 +y)을 따르고, 손목 쪽은 매 프레임 아래팔이 들어오는 방향으로 돌린다(자루 축 둘레 회전만).
//     칼 든 손은 칼 원점(손목 공 관절 자리, y=0), 두 손 무기의 빈손은 잡고 있을 때(fighter.gripping) 폼멜 자리(gripAlong)에.
//   · 편 손(벙어리장갑): 아래팔 끝(dressPart 의 손 구체 자리)에 납작한 손 + 옆으로 벌린 엄지. 칼을 놓쳤을 때·빈손·한손 무기의 빈손.
//   · 쥠 방식: 지금은 롱소드 악수 쥠 하나(엄지가 자루를 감아 검지 쪽으로). 동작 PM 의 무기별 쥠 규칙 메모
//     (docs/motion/grip_rules_*.md)가 오면 GRIPS 에 망치 쥠·찌르기 쥠을 더한다.
//   · 색·재질은 원래 손 구체의 재질을 그대로 쓴다(맨손 살색·하인리히 쇠장갑 등 outfits 가 정한 그대로).
//   · 손 하나 삼각형 약 200, 그리기 호출 손마다 1(손바닥+엄지를 한 지오메트리로 합침).
//  main.js: const hands = attachHands(fighter) 를 판마다 두 검객에, 프레임마다 hands.update() — auras 와 같이.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 지오메트리를 변환해서 돌려준다 (scale → rotate → translate) */
function bake(geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return g;
}

// 쥔 주먹 (칼 그룹 기준): +y = 칼자루 축(코등이 쪽), +z = 손목(아래팔이 들어오는 쪽), −z = 말아 쥔 손가락 앞, +x = 엄지 쪽
let _fist = null;
function fistGeometry() {
  if (_fist) return _fist;
  const palm = bake(new THREE.SphereGeometry(1, 12, 8), [0, -0.002, 0.004], [0, 0, 0], [0.04, 0.05, 0.046]);
  // 손가락 마디 줄: 앞쪽(−z)에 살짝 각진 덩이 — 둥근 공이 아니라 "쥔 손"으로 읽히게
  const knuckles = bake(new THREE.SphereGeometry(1, 10, 6), [0, 0.002, -0.026], [0, 0, 0], [0.036, 0.046, 0.022]);
  // 엄지: 엄지 쪽(+x)에서 자루를 둘러 앞(−z)으로 감아 코등이 쪽(+y)으로 살짝 — 악수 쥠
  const thumb = bake(new THREE.CapsuleGeometry(0.0165, 0.046, 3, 8), [0.038, 0.032, -0.012], [0.35, 0, -0.45]);
  // 엄지 뿌리 두툼한 살
  const base = bake(new THREE.SphereGeometry(1, 8, 6), [0.03, 0.006, 0.02], [0, 0, 0], [0.018, 0.03, 0.022]);
  _fist = mergeGeometries([palm, knuckles, thumb, base]);
  _fist.computeVertexNormals();
  return _fist;
}

// 편 손 (아래팔 그룹 기준: +y = 어깨 쪽, −y = 손목 쪽, +x = 앞): 손목 끝에서 이어지는 납작한 손 + 앞쪽으로 벌린 엄지
let _open = null;
function openGeometry() {
  if (_open) return _open;
  const palm = bake(new THREE.SphereGeometry(1, 12, 8), [0, -0.15, 0], [0, 0, 0], [0.024, 0.055, 0.044]);
  const thumb = bake(new THREE.CapsuleGeometry(0.015, 0.04, 3, 8), [0.026, -0.135, 0.022], [0.3, 0, 0.75]);
  _open = mergeGeometries([palm, thumb]);
  _open.computeVertexNormals();
  return _open;
}

/** 원래 손 구체(dressPart: SphereGeometry r≈0.042, y −0.135)를 찾는다. 칼 든 팔은 겉모습이 눕힌 하위 그룹(dressTo) 안에 있다 */
function findHandSphere(group) {
  let found = null;
  group?.traverse((c) => {
    if (!found && c.isMesh && c.geometry?.type === 'SphereGeometry' && Math.abs((c.geometry.parameters?.radius ?? 0) - 0.042) < 0.002 && c.position.y < -0.1) found = c;
  });
  return found;
}

const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _d = new THREE.Vector3();
const AX_S = new THREE.Vector3(1, 0, 0); // 칼 든 아래팔: 뼈가 +x (손목 쪽)
const AX_O = new THREE.Vector3(0, -1, 0); // 빈 아래팔: 뼈가 −y (손목 쪽)

/** 아래팔 방향을 칼 기준으로 바꿔, 주먹의 손목(+z)이 팔꿈치 쪽을 보게 자루 축(y) 둘레로 돌린다 */
function aimFist(fist, armBody, axis, sword) {
  const r = armBody.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  _d.copy(axis).applyQuaternion(_q).multiplyScalar(-1); // 손목 → 팔꿈치 (세계)
  const s = sword.rotation();
  _qs.set(s.x, s.y, s.z, s.w).invert();
  _d.applyQuaternion(_qs); // 칼 기준
  if (_d.x * _d.x + _d.z * _d.z < 1e-6) return;
  fist.rotation.set(0, Math.atan2(_d.x, _d.z), 0);
}

/**
 * 검객 하나에 벙어리장갑 손을 단다. 반환 { update(), dispose() } — main.js 가 auras 처럼 부른다.
 */
export function attachHands(f) {
  const gS = f.groups?.farmS;
  const gO = f.groups?.farmO;
  const sphS = findHandSphere(gS);
  const sphO = findHandSphere(gO);
  if (!sphS || !sphO || !f.swordGroup) return null;
  const matS = sphS.material;
  const matO = sphO.material;
  // 편 손 (아래팔 끝)
  const openS = new THREE.Mesh(openGeometry(), matS);
  const openO = new THREE.Mesh(openGeometry(), matO);
  openO.scale.z = -1; // 빈손은 반대쪽 손 — 엄지를 몸 쪽 반대로 거울
  for (const m of [openS, openO]) m.castShadow = true;
  sphS.parent.add(openS); // 원래 손 구체와 같은 좌표계(+y 어깨, −y 손목, +x 앞)
  sphO.parent.add(openO);
  sphS.visible = sphO.visible = false;
  // 쥔 주먹 (칼 그룹)
  const fistS = new THREE.Mesh(fistGeometry(), matS);
  const fistO = new THREE.Mesh(fistGeometry(), matO);
  fistO.scale.x = -1; // 반대쪽 손
  fistO.position.y = f.weaponCfg?.gripAlong ?? -0.14;
  for (const m of [fistS, fistO]) m.castShadow = true;
  f.swordGroup.add(fistS, fistO);
  fistO.visible = false;

  const api = {
    update() {
      const armed = !!f.armed && !!f.sword;
      fistS.visible = armed;
      openS.visible = !armed;
      const twoHold = armed && !!f.gripping;
      fistO.visible = twoHold;
      openO.visible = !twoHold;
      if (armed) aimFist(fistS, f.bodies.farmS, AX_S, f.sword);
      if (twoHold) aimFist(fistO, f.bodies.farmO, AX_O, f.sword);
    },
    dispose() {
      openS.removeFromParent();
      openO.removeFromParent();
      f.swordGroup?.remove(fistS, fistO);
      sphS.visible = sphO.visible = true;
    },
  };
  api.update(); // 싸움 전(메뉴·무기 뽑기) 화면에서도 바로 맞는 손
  return api;
}
