// ─────────────────────────────────────────────────────────────
//  몸 값 읽기 한 스텝 한 번 (11/21 감사 N-010 (c) · (f) — 같은 결과로 덜 하기 · 기록 docs/strike/perf_2026-11-21.md)
//   (c) worldCom · linvel · angvel (cacheState 가 몸마다 읽는 셋) · (f) translation · rotation · mass (온 코드가 읽는 자리 · 회전)
//
//  Rapier JS 의 몸 값 읽기(rb.translation() 따위)는 부를 때마다 엔진(WASM)을 다섯 번 남짓 건너고 임시 객체 둘을 만든다.
//  한 스텝 안에서 같은 몸의 같은 값을 수십 번 읽는다(cacheState · 걸음 · AI · 보정 …). 몸 값은 물리 스텝(world.step)과
//  그 몸을 바꾸는 부름(setTranslation · applyImpulse · sleep …) 사이에서는 바뀌지 않으므로, 처음 읽은 숫자를 적어 두고
//  다음 읽기는 그 숫자로 새 객체를 만들어 돌려준다 — 돌려주는 값 · 꼴(RAPIER.Vector3 · Quaternion) · 새 객체인 것까지 엔진 읽기와 같다.
//
//  지우는 때 (모르는 부름은 바꾸는 것으로 친다 — 아래 목록에 없는 메서드는 모두 지움):
//   · 세계(World)의 바꾸는 부름(step · 몸 · 콜라이더 · 관절 만들기 · 지우기 …) → 모든 몸 (EPOCH 를 올림 · 부름 앞뒤로)
//   · 몸(RigidBody)의 바꾸는 부름(set* · apply* · sleep · lock* · setNextKinematic* …) → 그 몸 (부름 앞뒤로)
//   · 콜라이더(Collider)의 바꾸는 부름(set* — 질량 · 모양 · 자리) → 그 콜라이더가 붙은 몸
//  지우지 않는 부름: 읽기만 하는 메서드와 힘 쌓기(addForce · addTorque · addForceAtPoint · resetForces · resetTorques — 다음 스텝 셈에만 들어감) · wakeUp.
//  Fighter 생성자가 한 번 깐다 (같은 RAPIER 에 두 번 깔지 않음). 싸움꾼이 없는 도구는 엔진 그대로.
// ─────────────────────────────────────────────────────────────

let EPOCH = 1; // 세계가 바뀔 때마다 올림 — 몸마다 적은 값의 EPOCH 가 같아야 쓴다

/** 몸의 읽기만 하는 메서드 + 몸 값을 바로 바꾸지 않는 메서드 (이 밖의 메서드는 부르면 그 몸의 적은 값을 지움) */
const BODY_KEEP = new Set([
  'isValid', 'dominanceGroup', 'additionalSolverIterations', 'softCcdPrediction', 'translation', 'rotation', 'nextTranslation', 'nextRotation',
  'gravityScale', 'linvel', 'velocityAtPoint', 'angvel', 'mass', 'effectiveInvMass', 'invMass', 'localCom', 'worldCom', 'invPrincipalInertia',
  'principalInertia', 'principalInertiaLocalFrame', 'effectiveWorldInvInertia', 'effectiveAngularInertia', 'isCcdEnabled', 'numColliders', 'collider',
  'isEnabled', 'bodyType', 'isSleeping', 'isMoving', 'isFixed', 'isKinematic', 'isDynamic', 'linearDamping', 'angularDamping', 'userForce', 'userTorque',
  'addForce', 'addTorque', 'addForceAtPoint', 'resetForces', 'resetTorques', 'wakeUp',
]);
/** 세계의 읽기만 하는 메서드 (물음 · 찾기 · 시간 재기) — 이 밖의 메서드는 부르면 모든 몸의 적은 값을 지움 */
const WORLD_KEEP = new Set([
  'getRigidBody', 'getCollider', 'getImpulseJoint', 'getMultibodyJoint', 'forEachCollider', 'forEachRigidBody', 'forEachActiveRigidBody',
  'castRay', 'castRayAndGetNormal', 'intersectionsWithRay', 'intersectionWithShape', 'projectPoint', 'projectPointAndGetFeature', 'intersectionsWithPoint',
  'castShape', 'intersectionsWithShape', 'collidersWithAabbIntersectingAabb', 'contactPairsWith', 'intersectionPairsWith', 'contactPair', 'intersectionPair',
  'debugRender', 'takeSnapshot',
]);
/** 콜라이더의 읽기만 하는 메서드 — 이 밖의 메서드는 부르면 붙은 몸의 적은 값을 지움 */
const COLLIDER_KEEP = new Set([
  'finalizeDeserialization', 'ensureShapeIsCached', 'clearShapeCache', 'isValid', 'translation', 'translationWrtParent', 'rotation', 'rotationWrtParent',
  'isSensor', 'isEnabled', 'frictionCombineRule', 'restitutionCombineRule', 'contactSkin', 'activeHooks', 'activeEvents', 'activeCollisionTypes',
  'contactForceEventThreshold', 'shapeType', 'halfExtents', 'radius', 'roundRadius', 'halfHeight', 'vertices', 'indices', 'heightfieldHeights',
  'heightfieldScale', 'heightfieldNRows', 'heightfieldNCols', 'parent', 'friction', 'restitution', 'density', 'mass', 'volume', 'collisionGroups',
  'solverGroups', 'containsPoint', 'projectPoint', 'intersectsRay', 'castShape', 'castCollider', 'intersectsShape', 'contactShape', 'contactCollider',
  'castRay', 'castRayAndGetNormal',
]);

/** 몸마다 적은 값 (e* = 적은 때의 EPOCH · 0 = 없음) */
function slot(b) {
  return (b._rd = {
    eT: 0, tx: 0, ty: 0, tz: 0, eR: 0, rx: 0, ry: 0, rz: 0, rw: 0, eM: 0, m: 0,
    eC: 0, cx: 0, cy: 0, cz: 0, eV: 0, vx: 0, vy: 0, vz: 0, eW: 0, wx: 0, wy: 0, wz: 0,
  });
}
function forget(b) {
  const s = b._rd;
  if (s) s.eT = s.eR = s.eM = s.eC = s.eV = s.eW = 0;
}

const methods = (P) => Object.getOwnPropertyNames(P).filter((m) => m !== 'constructor' && typeof Object.getOwnPropertyDescriptor(P, m).value === 'function');

/** RAPIER 의 몸 · 세계 · 콜라이더 메서드에 한 스텝 읽기 기억을 깐다 (여러 번 불러도 한 번) */
export function installBodyReads(RAPIER) {
  const RB = RAPIER?.RigidBody?.prototype, W = RAPIER?.World?.prototype, C = RAPIER?.Collider?.prototype, V3 = RAPIER?.Vector3, Q4 = RAPIER?.Quaternion;
  if (!RB || !W || !C || !V3 || !Q4 || Object.prototype.hasOwnProperty.call(RB, '_bodyReads')) return;
  Object.defineProperty(RB, '_bodyReads', { value: true });
  // 바꾸는 부름: 앞뒤로 지움 (부름 안에서 읽어 적은 값도 남기지 않게)
  for (const m of methods(RB)) {
    if (BODY_KEEP.has(m)) continue;
    const f = RB[m];
    RB[m] = function (...a) {
      forget(this);
      try {
        return f.apply(this, a);
      } finally {
        forget(this);
      }
    };
  }
  for (const m of methods(W)) {
    if (WORLD_KEEP.has(m) || m.startsWith('timing')) continue;
    const f = W[m];
    W[m] = function (...a) {
      EPOCH++;
      try {
        return f.apply(this, a);
      } finally {
        EPOCH++;
      }
    };
  }
  for (const m of methods(C)) {
    if (COLLIDER_KEEP.has(m)) continue;
    const f = C[m];
    C[m] = function (...a) {
      const p = this._parent;
      if (p) forget(p);
      try {
        return f.apply(this, a);
      } finally {
        if (p) forget(p);
      }
    };
  }
  // 읽기: 이 스텝(EPOCH)에 적은 값이 있으면 그 숫자로 새 객체 · 없으면 엔진에서 읽어 적음
  const tra = RB.translation, rot = RB.rotation, mas = RB.mass, com = RB.worldCom, lin = RB.linvel, ang = RB.angvel;
  RB.translation = function translation() {
    const s = this._rd || slot(this);
    if (s.eT === EPOCH) return new V3(s.tx, s.ty, s.tz);
    const v = tra.call(this);
    if (v) (s.tx = v.x), (s.ty = v.y), (s.tz = v.z), (s.eT = EPOCH);
    return v;
  };
  RB.rotation = function rotation() {
    const s = this._rd || slot(this);
    if (s.eR === EPOCH) return new Q4(s.rx, s.ry, s.rz, s.rw);
    const v = rot.call(this);
    if (v) (s.rx = v.x), (s.ry = v.y), (s.rz = v.z), (s.rw = v.w), (s.eR = EPOCH);
    return v;
  };
  RB.mass = function mass() {
    const s = this._rd || slot(this);
    if (s.eM === EPOCH) return s.m;
    const m = mas.call(this);
    s.m = m;
    s.eM = EPOCH;
    return m;
  };
  RB.worldCom = function worldCom() {
    const s = this._rd || slot(this);
    if (s.eC === EPOCH) return new V3(s.cx, s.cy, s.cz);
    const v = com.call(this);
    if (v) (s.cx = v.x), (s.cy = v.y), (s.cz = v.z), (s.eC = EPOCH);
    return v;
  };
  RB.linvel = function linvel() {
    const s = this._rd || slot(this);
    if (s.eV === EPOCH) return new V3(s.vx, s.vy, s.vz);
    const v = lin.call(this);
    if (v) (s.vx = v.x), (s.vy = v.y), (s.vz = v.z), (s.eV = EPOCH);
    return v;
  };
  RB.angvel = function angvel() {
    const s = this._rd || slot(this);
    if (s.eW === EPOCH) return new V3(s.wx, s.wy, s.wz);
    const v = ang.call(this);
    if (v) (s.wx = v.x), (s.wy = v.y), (s.wz = v.z), (s.eW = EPOCH);
    return v;
  };
}
