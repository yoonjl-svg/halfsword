// ─────────────────────────────────────────────────────────────
//  검투사 한 명 = "액티브 래그돌"
//
//  몸은 관절로 이어진 강체(rigid body) 13개다. 애니메이션을 틀어주는
//  대신, 매 물리 스텝마다 "근육" 역할을 하는 힘과 회전력을 걸어서
//  서 있게 하고 걷게 하고 칼을 휘두르게 한다. 그래서 맞으면 비틀거리고
//  힘이 빠지면 인형처럼 쓰러진다. 이것이 하프 소드 느낌의 핵심이다.
//
//  좌표 약속: 몸 기준(로컬)으로 +x가 앞, +y가 위, +z가 오른쪽이다.
//  heading(라디안)은 몸이 월드에서 바라보는 방향. 항상 상대 쪽으로 천천히 돈다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BODY, WEAPON, DAMAGE } from './config.js';

// 충돌 그룹 비트. 자기 몸과 자기 칼끼리는 부딪히지 않게 한다.
const BIT = { ground: 1 };
const bodyBit = (i) => (i === 0 ? 2 : 8);
const weaponBit = (i) => (i === 0 ? 4 : 16);
const groups = (member, filter) => (member << 16) | filter;
export const GROUND_GROUPS = groups(BIT.ground, 0xffff);

// 부위 정의. 앞(+x)을 보고 서 있는 자세 기준 좌표. s = 칼 든 팔 쪽 z 부호(+1 = 오른손).
function partDefs(s) {
  return [
    { name: 'pelvis', kind: 'pelvis', shape: ['box', 0.1, 0.09, 0.15], pos: [0, 0.95, 0], mass: 12 },
    { name: 'chest', kind: 'chest', shape: ['box', 0.11, 0.2, 0.18], pos: [0, 1.28, 0], mass: 22 },
    { name: 'head', kind: 'head', shape: ['ball', 0.11], pos: [0, 1.66, 0], mass: 5 },
    { name: 'uarmS', kind: 'arm', shape: ['capsule', 0.1, 0.05], pos: [0, 1.29, s * 0.25], mass: 2.5 },
    { name: 'farmS', kind: 'arm', shape: ['capsule', 0.09, 0.045], pos: [0, 1.0, s * 0.25], mass: 1.8 },
    { name: 'uarmO', kind: 'arm', shape: ['capsule', 0.1, 0.05], pos: [0, 1.29, -s * 0.25], mass: 2.5 },
    { name: 'farmO', kind: 'arm', shape: ['capsule', 0.09, 0.045], pos: [0, 1.0, -s * 0.25], mass: 1.8 },
    { name: 'thighF', kind: 'leg', shape: ['capsule', 0.15, 0.07], pos: [0, 0.67, s * 0.11], mass: 8 },
    { name: 'shinF', kind: 'leg', shape: ['capsule', 0.15, 0.055], pos: [0, 0.25, s * 0.11], mass: 4, foot: true },
    { name: 'thighB', kind: 'leg', shape: ['capsule', 0.15, 0.07], pos: [0, 0.67, -s * 0.11], mass: 8 },
    { name: 'shinB', kind: 'leg', shape: ['capsule', 0.15, 0.055], pos: [0, 0.25, -s * 0.11], mass: 4, foot: true },
  ];
}

// 관절 정의: [부모, 자식, 관절 위치, 근육 강도(ω, 초당 라디안)]
//  근육은 물리 엔진의 "관절 모터"로 구현한다. 엔진이 충돌·관절과 함께 한꺼번에 풀기 때문에
//  아무리 세게 해도 떨리거나 폭주하지 않는다. ω가 클수록 목표 자세로 빨리 돌아간다.
function jointDefs(s) {
  return [
    ['pelvis', 'chest', [0, 1.08, 0], 45],
    ['chest', 'head', [0, 1.53, 0], 30],
    ['chest', 'uarmS', [0, 1.44, s * 0.25], 6],
    ['uarmS', 'farmS', [0, 1.14, s * 0.25], 6],
    ['chest', 'uarmO', [0, 1.44, -s * 0.25], 25],
    ['uarmO', 'farmO', [0, 1.14, -s * 0.25], 25],
    ['pelvis', 'thighF', [0, 0.88, s * 0.11], 110],
    ['thighF', 'shinF', [0, 0.46, s * 0.11], 110],
    ['pelvis', 'thighB', [0, 0.88, -s * 0.11], 110],
    ['thighB', 'shinB', [0, 0.46, -s * 0.11], 110],
  ];
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const toV = (v) => _v3.set(v.x, v.y, v.z);
const RIGHT_LOCAL = new THREE.Vector3(0, 0, 1);
const rot = (b, out) => {
  const r = b.rotation();
  return out.set(r.x, r.y, r.z, r.w);
};
const angvel = (b, out) => {
  const v = b.angvel();
  return out.set(v.x, v.y, v.z);
};
const vecArg = (v) => ({ x: v.x, y: v.y, z: v.z });

export class Fighter {
  /**
   * @param {object} o
   * @param {number} o.index  0 = 플레이어, 1 = 상대
   * @param {number} o.x       시작 x 위치
   * @param {number} o.heading 처음 바라보는 방향(라디안). 0 = +x
   * @param {object} o.look    겉모습(색, 투구 등) — looks.js 참고
   */
  constructor(RAPIER, world, scene, colliderInfo, o) {
    this.R = RAPIER;
    this.world = world;
    this.index = o.index;
    this.name = o.name;
    this.side = 1; // 오른손잡이
    this.heading = o.heading ?? 0;
    this.faceTarget = null; // 바라볼 지점(보통 상대 골반). main이 매 스텝 넣어준다.

    this.hp = 100;
    this.balance = 100;
    this.state = 'stand'; // stand | down | getup | dead
    this.stateTime = 0;
    this.muscle = 1; // 근육 힘 비율 (넘어지면 0 근처로)
    this.armHealth = 1; // 칼 든 팔 상태
    this.legHealth = 1;
    this.move = new THREE.Vector2(); // x: 옆걸음(+오른쪽), y: 앞(+)/뒤(-). 각각 -1 ~ 1
    this.strength = o.strength ?? 1;
    this.gaitPhase = 0;
    this.gaitWeight = 0; // 0 = 서 있음, 1 = 걷는 중 (부드럽게 바뀜)
    this.stanceDrop = 0; // 딛는 다리가 기울어진 만큼 골반을 낮춰 발이 땅에 닿게 한다
    this.gaitDir = new THREE.Vector2(1, 0); // 몸 기준 이동 방향 (x 앞, y 오른쪽)
    this.localVel = new THREE.Vector2();
    this.hitCooldowns = new Map();
    this.onHurt = null;

    // 손 목표: 몸 앞 평면에서 (좌우, 위아래) 오프셋(m). 입력/AI가 이 값을 바꾼다.
    // 앞뒤 깊이는 자동: 가운데로 모을수록 팔을 앞으로 뻗는다.
    this.handOffset = new THREE.Vector2(0.15, 0.0);

    this.bodies = {};
    this.meshes = [];
    this.joints = [];
    this.totalMass = 0;

    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, this.heading);
    this.yaw = yaw;
    const origin = new THREE.Vector3(o.x, 0, 0);
    const toWorld = (p) => new THREE.Vector3(...p).applyQuaternion(yaw).add(origin);

    const myBody = bodyBit(this.index);
    const otherBody = bodyBit(1 - this.index);
    const otherWeapon = weaponBit(1 - this.index);
    const bodyGroups = groups(myBody, BIT.ground | otherBody | otherWeapon);
    const weaponGroups = groups(weaponBit(this.index), BIT.ground | otherBody | otherWeapon);

    const defs = partDefs(this.side);
    this.localPos = {};
    for (const d of defs) {
      const wp = toWorld(d.pos);
      const rb = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wp.x, wp.y, wp.z)
          .setRotation(vecQ(yaw))
          .setLinearDamping(0.05)
          .setAngularDamping(0.4),
      );
      const cd = shapeDesc(RAPIER, d.shape)
        .setMass(d.mass)
        .setFriction(0.6)
        .setCollisionGroups(bodyGroups);
      const col = world.createCollider(cd, rb);
      colliderInfo.set(col.handle, { fighter: this, kind: d.kind, part: d.name, body: rb });

      const group = new THREE.Group();
      const mesh = dressPart(group, d, o.look);

      if (d.foot) {
        // 발바닥은 둥근 캡슐(앞뒤로 누운 막대) → 걸을 때 발끝/뒤꿈치가 땅에 걸리지 않고 굴러간다
        const footRot = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI / 2);
        const fd = RAPIER.ColliderDesc.capsule(0.07, 0.033)
          .setTranslation(0.05, -0.187, 0)
          .setRotation(vecQ(footRot))
          .setMass(0.8)
          .setFriction(0.8)
          .setCollisionGroups(bodyGroups);
        const fc = world.createCollider(fd, rb);
        colliderInfo.set(fc.handle, { fighter: this, kind: 'leg', part: d.name, body: rb });
        const fm = shapeMesh(['box', 0.1, 0.035, 0.055], o.look.shoes);
        fm.position.set(0.05, -0.185, 0);
        group.add(fm);
      }
      scene.add(group);
      this.meshes.push({ rb, group, kind: d.kind, mesh });
      this.bodies[d.name] = rb;
      this.localPos[d.name] = new THREE.Vector3(...d.pos);
      this.totalMass += d.mass + (d.foot ? 0.8 : 0);
    }

    // 관절(구형 관절) 생성 + 근육(PD 제어) 정보 저장
    for (const [pa, ch, p, omega] of jointDefs(this.side)) {
      const P = new THREE.Vector3(...p);
      const a1 = P.clone().sub(this.localPos[pa]);
      const a2 = P.clone().sub(this.localPos[ch]);
      const joint = world.createImpulseJoint(RAPIER.JointData.spherical(vecArg(a1), vecArg(a2)), this.bodies[pa], this.bodies[ch], true);
      for (const ax of MOTOR_AXES) joint.rawSet.jointConfigureMotorModel(joint.handle, ax, 0); // 0 = 질량과 무관한 가속도 기준
      this.joints.push({ joint, name: ch, omega, target: new THREE.Quaternion() });
    }
    this.jointByName = Object.fromEntries(this.joints.map((j) => [j.name, j]));

    // ── 똑바로 서기: 보이지 않는 "기준 막대"(운동학 물체)에 골반을 회전 모터로 묶는다 ──
    //  위치는 자유(골반을 끌고 다니지 않음), 회전만 모터로 맞춘다. 엔진이 한꺼번에 풀어서 떨리지 않는다.
    const pp = this.bodies.pelvis.translation();
    this.anchor = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pp.x, pp.y, pp.z).setRotation(vecQ(yaw)),
    );
    this.uprightJoint = world.createImpulseJoint(
      RAPIER.JointData.generic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0),
      this.anchor,
      this.bodies.pelvis,
      true,
    );
    for (const ax of MOTOR_AXES) this.uprightJoint.rawSet.jointConfigureMotorModel(this.uprightJoint.handle, ax, 1); // 1 = 힘(N·m) 기준


    // ── 무기: 롱소드 ──
    const L = WEAPON.length;
    const wristLocal = new THREE.Vector3(0, 0.865, this.side * 0.25);
    const wp = toWorld(wristLocal.toArray());
    const sword = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(wp.x, wp.y, wp.z)
        .setRotation(vecQ(yaw))
        .setAngularDamping(0.3)
        .setCcdEnabled(true),
    );
    const m = WEAPON.mass;
    const parts = [
      // [모양, 위치y, 질량비, 색, 칼날인가]
      [['box', 0.018, 0.1, 0.018], 0, 0.1, o.look.grip, false],
      [['ball', 0.03], -0.12, 0.1, o.look.hilt, false],
      [['box', 0.11, 0.015, 0.022], 0.115, 0.18, o.look.hilt, false],
      [['box', 0.024, L / 2, 0.008], 0.13 + L / 2, 0.62, 0xd8dde3, true],
    ];
    const group = new THREE.Group();
    this.bladeColliders = [];
    for (const [shape, y, frac, color, isBlade] of parts) {
      const cd = shapeDesc(RAPIER, shape)
        .setTranslation(0, y, 0)
        .setMass(m * frac)
        .setFriction(0.4)
        .setCollisionGroups(weaponGroups)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(1);
      const col = world.createCollider(cd, sword);
      colliderInfo.set(col.handle, { fighter: this, kind: 'weapon', part: isBlade ? 'blade' : 'hilt', body: sword });
      const mesh = shapeMesh(shape, color, isBlade ? { metalness: 0.9, roughness: 0.25 } : null);
      mesh.position.y = y;
      group.add(mesh);
      if (isBlade) this.bladeColliders.push(col);
    }
    scene.add(group);
    this.meshes.push({ rb: sword, group, kind: 'weapon' });
    this.sword = sword;
    world.createImpulseJoint(
      RAPIER.JointData.spherical({ x: 0, y: -0.135, z: 0 }, { x: 0, y: 0, z: 0 }),
      this.bodies.farmS,
      sword,
      true,
    );
    this.swordMass = m;
    this.handTarget = new THREE.Vector3();
    this.tipPrev = null;
    this.tipVel = new THREE.Vector3();
    this.hitPointPrev = null;
    this.hitPointVel = new THREE.Vector3();

    this.applyPose(0);
  }

  get alive() {
    return this.state !== 'dead';
  }

  get pelvisPos() {
    return toV(this.bodies.pelvis.translation()).clone();
  }

  /** 칼날 위의 한 지점(0=손잡이, 1=칼끝)의 월드 좌표 */
  bladePoint(t, out = new THREE.Vector3()) {
    const p = this.sword.translation();
    rot(this.sword, _q1);
    return out.set(0, 0.13 + WEAPON.length * t, 0).applyQuaternion(_q1).add(_v1.set(p.x, p.y, p.z));
  }

  /** 몸 기준 앞 방향(수평) */
  forward(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  /** 몸 기준 오른쪽 방향(수평) */
  right(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  // 상대 쪽으로 몸을 천천히 돌린다 (한 번에 휙 돌지 못하게 회전 속도 제한)
  updateHeading(dt) {
    if (this.state === 'stand' || this.state === 'getup') {
      if (this.faceTarget) {
        const p = this.bodies.pelvis.translation();
        const want = Math.atan2(-(this.faceTarget.z - p.z), this.faceTarget.x - p.x);
        let diff = want - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const maxTurn = BODY.turnSpeed * this.muscle * dt;
        this.heading += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
      }
    } else {
      // 쓰러져 있는 동안에는 골반이 실제로 향한 방향을 따라간다 (일어날 때 몸이 비틀리지 않게)
      rot(this.bodies.pelvis, _q1);
      const f = _v1.set(1, 0, 0).applyQuaternion(_q1);
      if (Math.hypot(f.x, f.z) > 0.3) this.heading = Math.atan2(-f.z, f.x);
    }
    this.yaw.setFromAxisAngle(UP, this.heading);
  }

  // ── 매 물리 스텝마다 호출: 근육을 움직인다 ──
  step(dt) {
    this.stateTime += dt;
    this.updateState(dt);

    // 상태에 따른 근육 힘 목표치
    let targetMuscle = 1;
    if (this.state === 'down') targetMuscle = 0.08;
    else if (this.state === 'dead') targetMuscle = 0.02;
    else if (this.state === 'getup') targetMuscle = Math.min(1, this.stateTime / BODY.getUpDuration);
    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));

    for (const { rb } of this.meshes) rb.resetForces(true), rb.resetTorques(true);

    this.updateHeading(dt);
    this.driveBalance(dt);
    this.applyPose(dt);
    this.driveJoints();
    this.driveSword();
    this.trackBlade(dt);

    for (const [k, t] of this.hitCooldowns) {
      if (t - dt <= 0) this.hitCooldowns.delete(k);
      else this.hitCooldowns.set(k, t - dt);
    }
  }

  updateState(dt) {
    if (this.state === 'dead') return;
    const tilt = this.tiltDeg();
    if (this.state === 'stand') {
      this.balance = Math.min(100, this.balance + DAMAGE.balanceRegen * dt);
      if (tilt > BODY.fallTiltDeg || this.balance <= 0) this.knockDown();
    } else if (this.state === 'down') {
      if (this.stateTime > BODY.fallDuration) this.setState('getup');
    } else if (this.state === 'getup') {
      if (this.stateTime > BODY.getUpDuration + 0.4) {
        this.setState('stand');
        this.balance = 60;
      }
    }
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  knockDown() {
    if (this.state === 'dead' || this.state === 'down') return;
    this.setState('down');
    this.balance = 0;
  }

  tiltDeg() {
    rot(this.bodies.chest, _q1);
    const up = _v1.set(0, 1, 0).applyQuaternion(_q1);
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.y, -1, 1)));
  }

  // 골반을 떠받치고, 몸을 세우고, 걷게 한다.
  driveBalance(dt) {
    const pelvis = this.bodies.pelvis;
    const chest = this.bodies.chest;
    const M = this.totalMass;
    const g = 9.81;
    const mus = this.muscle;
    const p = pelvis.translation();
    const v = pelvis.linvel();

    // 1) 높이 유지 (보이지 않는 다리 스프링)
    if (mus > 0.1) {
      const h = BODY.standHeight - (1 - this.legHealth) * 0.08 - this.stanceDrop;
      let fy = M * g * BODY.support * this.legHealth + BODY.supportStiffness * (h - p.y) - BODY.supportDamping * v.y;
      fy = THREE.MathUtils.clamp(fy * mus, 0, M * g * 2.5);
      // 너무 높이 떠 있으면(점프한 것처럼) 받치지 않는다
      if (p.y > h + 0.25) fy = 0;
      pelvis.addForce({ x: 0, y: fy, z: 0 }, true);
    }

    // 2) 걷기: 앞뒤 + 옆걸음 (옆/뒤로는 조금 느리게)
    const fwd = this.forward(_v1);
    const rgt = this.right(_v2);
    const speed = BODY.moveSpeed * (0.5 + 0.5 * this.legHealth);
    const mv = this.state === 'stand' ? this.move : { x: 0, y: 0 };
    const along = mv.y * speed * (mv.y < 0 ? 0.75 : 1);
    const side = mv.x * speed * 0.8;
    const dvx = fwd.x * along + rgt.x * side - v.x;
    const dvz = fwd.z * along + rgt.z * side - v.z;
    const lim = M * 12;
    const fx = THREE.MathUtils.clamp(M * BODY.moveAccel * dvx, -lim, lim) * mus;
    const fz = THREE.MathUtils.clamp(M * BODY.moveAccel * dvz, -lim, lim) * mus;
    pelvis.addForce({ x: fx, y: 0, z: fz }, true);

    // 3) 똑바로 서기: 기준 막대를 골반 위치 + 바라보는 방향으로 옮기고, 회전 모터 세기를 근육에 맞춘다
    const vFwd = v.x * fwd.x + v.z * fwd.z;
    this.localVel.set(vFwd, v.x * rgt.x + v.z * rgt.z);
    this.anchor.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    this.anchor.setNextKinematicRotation(vecQ(this.yaw));
    const k = BODY.uprightStiffness * mus;
    const d = BODY.uprightDamping * mus;
    const raw = this.uprightJoint.rawSet;
    for (const ax of MOTOR_AXES) raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, k, d);
    // 걷는 방향으로 상체를 살짝 숙인다 (골반-가슴 관절 목표)
    this.lean = this.state === 'stand' ? THREE.MathUtils.clamp(-vFwd * 0.06, -0.12, 0.12) : 0;
  }

  // 관절 목표 자세 정하기 (걷기 사이클, 방패 없는 손 가드)
  //
  // 걷기: 다리 흔드는 속도를 "실제로 이동한 거리"에 묶는다.
  //  - 보폭(stepLength)만큼 이동할 때마다 발이 한 번씩 번갈아 나간다 → 발이 미끄러지지 않는다.
  //  - 다리는 실제 이동 방향(앞/뒤/옆/대각선)으로 흔든다.
  //  - 멈추면 부드럽게 원래 서 있는 자세로 돌아온다.
  applyPose(dt = 0) {
    const J = this.jointByName;
    const lv = this.localVel;
    const speed = lv.length();
    const moving = this.state === 'stand' && speed > 0.12 ? 1 : 0;
    this.gaitWeight += (moving - this.gaitWeight) * Math.min(1, dt * 6);
    if (speed > 0.12) this.gaitDir.lerp(_v2d.set(lv.x / speed, lv.y / speed), Math.min(1, dt * 8)).normalize();
    // 한 주기(왼발+오른발) = 보폭 2개
    this.gaitPhase += (speed / (2 * BODY.stepLength)) * Math.PI * 2 * dt;

    const w = this.gaitWeight;
    const d = this.gaitDir;
    // (0,-1,0)으로 늘어진 다리를 방향 d(몸 기준 x=앞, z=오른쪽)로 보내는 회전축
    _axis.set(-d.y, 0, d.x);
    // 실제 걸음처럼: 한 주기의 60%는 발이 땅을 딛고(몸이 앞으로 가는 만큼 발이 뒤로 일정하게 밀림),
    // 나머지 40%는 발을 들어 앞으로 빠르게 가져온다. 딛는 동안 몸은 보폭의 1.2배를 가므로 발도 그만큼 쓸어준다.
    const STANCE = 0.6;
    const reach = 0.6 * BODY.stepLength; // 발이 몸 중심에서 앞뒤로 나가는 최대 거리
    let drop = 0;
    const legPose = (thigh, shin, phase, stanceHip, stanceKnee) => {
      const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
      let x; // 몸 기준 발의 앞뒤 위치(m)
      let lift = 0;
      if (u < STANCE) {
        x = reach - 2 * reach * (u / STANCE);
      } else {
        const t = (u - STANCE) / (1 - STANCE);
        x = -reach + 2 * reach * (0.5 - 0.5 * Math.cos(Math.PI * t));
        lift = Math.sin(Math.PI * t);
      }
      // 무릎을 굽히면 발이 몸 뒤쪽으로 빠지므로, 그만큼 허벅지를 더 앞으로 보내 상쇄한다
      const knee = 0.08 + 1.0 * lift;
      const hip = Math.atan2(x + 0.42 * Math.sin(knee) * d.x, 0.85) * w;
      const base = _qa.setFromAxisAngle(Z_AXIS, stanceHip * (1 - w));
      J[thigh].target.setFromAxisAngle(_axis, hip).multiply(base);
      J[shin].target.setFromAxisAngle(Z_AXIS, stanceKnee * (1 - w) - w * knee);
      // 딛고 있는 다리: 비스듬할수록 엉덩이가 낮아진다 (다리 길이 0.85m)
      if (u < STANCE) drop = Math.max(drop, 0.85 * (1 - Math.cos(hip)) + 0.02 * w);
    };
    // 가만히 있을 때는 펜싱 자세(앞발/뒷발), 걸을 때는 번갈아 걷기
    legPose('thighF', 'shinF', this.gaitPhase, 0.24, -0.22);
    legPose('thighB', 'shinB', this.gaitPhase + Math.PI, -0.18, -0.14);
    this.stanceDrop += (drop - this.stanceDrop) * Math.min(1, dt * 20);
    const setZ = (name, a) => J[name].target.setFromAxisAngle(Z_AXIS, a);
    // 빈 손은 앞으로 들어 균형을 잡는다
    setZ('uarmO', 0.5);
    setZ('farmO', 1.0);
    setZ('uarmS', 0.4);
    setZ('farmS', 0.6);
    setZ('head', 0);
    setZ('chest', this.lean || 0);
  }

  driveJoints() {
    const legsMus = Math.max(0.15, this.muscle);
    for (const j of this.joints) {
      const isLeg = j.name.startsWith('thigh') || j.name.startsWith('shin');
      const mus = isLeg ? legsMus * (0.6 + 0.4 * this.legHealth) : Math.max(0.1, this.muscle);
      // 목표 회전 → 축별 각도(회전 벡터). ω²가 강도, 2ω가 감쇠(딱 알맞게 멈추는 값)
      const w = j.omega * Math.sqrt(mus);
      toRotVec(j.target, _rv);
      const raw = j.joint.rawSet;
      raw.jointConfigureMotorPosition(j.joint.handle, MOTOR_AXES[0], _rv.x, w * w, 2 * w);
      raw.jointConfigureMotorPosition(j.joint.handle, MOTOR_AXES[1], _rv.y, w * w, 2 * w);
      raw.jointConfigureMotorPosition(j.joint.handle, MOTOR_AXES[2], _rv.z, w * w, 2 * w);
    }
  }

  // 칼 조종: 손(칼자루)을 목표 위치로 끌고, 칼끝을 원하는 방향으로 돌린다.
  driveSword() {
    const sword = this.sword;
    const chest = this.bodies.chest;
    const mus = this.muscle;
    if (mus < 0.12) return; // 쓰러지면 칼을 놓친 듯 힘이 빠진다

    // 손 목표 위치: 가슴 앞 평면의 (좌우, 위아래) + 자동 깊이
    const off = this.handOffset;
    const R = WEAPON.reach;
    const len = off.length();
    if (len > R) off.multiplyScalar(R / len);
    const depth = 0.2 + 0.35 * Math.sqrt(Math.max(0, 1 - (off.x * off.x + off.y * off.y) / (R * R)));
    const handLocal = _v2.set(depth, 0.16 + off.y, 0.1 + off.x);
    const c = chest.translation();
    const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));

    const grip = sword.translation();
    const gv = sword.linvel();
    const str = this.strength * mus * (0.35 + 0.65 * this.armHealth);
    const armMass = this.swordMass + 1.8 + 1.25;
    const f = _v1.set(
      WEAPON.handStiffness * (target.x - grip.x) - WEAPON.handDamping * gv.x,
      WEAPON.handStiffness * (target.y - grip.y) - WEAPON.handDamping * gv.y + armMass * 9.81,
      WEAPON.handStiffness * (target.z - grip.z) - WEAPON.handDamping * gv.z,
    );
    // 손 속도가 한계를 넘으면 브레이크를 건다
    const gs = Math.hypot(gv.x, gv.y, gv.z);
    if (gs > WEAPON.maxHandSpeed) {
      const brake = (WEAPON.handDamping * 4 * (gs - WEAPON.maxHandSpeed)) / gs;
      f.x -= gv.x * brake;
      f.y -= gv.y * brake;
      f.z -= gv.z * brake;
    }
    const maxF = WEAPON.maxHandForce * str;
    if (f.length() > maxF) f.setLength(maxF);
    sword.addForce(vecArg(f), true);
    chest.addForce({ x: -f.x * 0.7, y: -f.y * 0.7, z: -f.z * 0.7 }, true); // 반작용: 휘두르면 몸도 끌려간다

    // 칼끝 방향: 가슴 아래 뒤쪽의 한 점(지렛대 받침)에서 손을 잇는 방향 + 앞쪽으로 살짝.
    // → 손을 올리면 칼이 서고, 오른쪽으로 빼면 칼이 오른쪽으로 눕고, 가운데면 상대를 겨눈다.
    //  (손은 몸 중심보다 0.1m 오른쪽에 있으니, 칼끝은 살짝 안쪽으로 모아 상대 중심선을 겨눈다)
    const aim = _v3.set(handLocal.x + 0.45, handLocal.y + 0.2, off.x - 0.08);
    aim.normalize().applyQuaternion(this.yaw);
    rot(sword, _q1);
    const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(_q1);
    const axis = new THREE.Vector3().crossVectors(blade, aim);
    const sinA = axis.length();
    const angle = Math.atan2(sinA, blade.dot(aim));
    const torque = new THREE.Vector3();
    if (sinA > 1e-5) torque.copy(axis).multiplyScalar((WEAPON.aimStiffness * angle) / sinA);
    // 칼날(날 선 쪽)이 휘두르는 방향을 향하도록 비틀림 유지.
    // 칼이 거의 멈춰 있으면 칼 면이 몸 오른쪽을 보게 둔다.
    const flat = new THREE.Vector3(0, 0, 1).applyQuaternion(_q1);
    const edgeDir = new THREE.Vector3(gv.x, gv.y, gv.z).addScaledVector(blade, -(gv.x * blade.x + gv.y * blade.y + gv.z * blade.z));
    let flatTarget;
    if (edgeDir.length() > 1) {
      flatTarget = new THREE.Vector3().crossVectors(blade, edgeDir).normalize();
      if (flatTarget.dot(flat) < 0) flatTarget.negate();
    } else {
      flatTarget = RIGHT_LOCAL.clone().applyQuaternion(this.yaw);
      flatTarget.addScaledVector(blade, -flatTarget.dot(blade));
      if (flatTarget.lengthSq() < 1e-4) flatTarget.copy(flat);
      flatTarget.normalize();
    }
    // 칼날 축(길쭉한 방향)으로 도는 회전은 관성이 아주 작아서, 큰 힘을 주면
    // 계산이 폭주해 칼이 팽이처럼 돈다. 그래서 비틀림은 아주 약하게 따로 다룬다.
    const w = angvel(sword, new THREE.Vector3());
    const wTwist = blade.clone().multiplyScalar(w.dot(blade));
    const wSwing = w.clone().sub(wTwist);
    torque.addScaledVector(wSwing, -WEAPON.aimDamping);
    const maxT = WEAPON.maxAimTorque * str;
    if (torque.length() > maxT) torque.setLength(maxT);
    const twist = new THREE.Vector3().crossVectors(flat, flatTarget).projectOnVector(blade).multiplyScalar(1.2);
    twist.addScaledVector(wTwist, -0.12);
    torque.add(twist);
    sword.addTorque(vecArg(torque), true);
    chest.addTorque({ x: -torque.x * 0.5, y: -torque.y * 0.5, z: -torque.z * 0.5 }, true);
  }

  // 칼끝/타격 지점 속도 추적 (데미지 계산용)
  trackBlade(dt) {
    const tip = this.bladePoint(1, new THREE.Vector3());
    const mid = this.bladePoint(0.7, new THREE.Vector3());
    if (this.tipPrev) {
      this.tipVel.subVectors(tip, this.tipPrev).divideScalar(dt);
      this.hitPointVel.subVectors(mid, this.hitPointPrev).divideScalar(dt);
    }
    this.tipPrev = tip;
    this.hitPointPrev = mid;
  }

  /** 피해 받기. 반환값: 실제 피해량 */
  takeHit(kind, amount) {
    if (this.state === 'dead') return 0;
    this.hp -= amount;
    this.balance -= amount * DAMAGE.balanceLossPerDamage;
    if (kind === 'arm') this.armHealth = Math.max(0, this.armHealth - amount / 45);
    if (kind === 'leg') this.legHealth = Math.max(0.2, this.legHealth - amount / 50);
    if (kind === 'head' && amount > 22) this.knockDown();
    // 맞은 만큼 몸이 붉어진다(피 대신 멍 느낌)
    for (const m of this.meshes) {
      if (m.kind === kind && m.mesh) m.mesh.material.color.lerp(new THREE.Color(0x7a0a0a), Math.min(0.5, amount / 60));
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('dead');
    } else if (this.balance <= 0 && this.state === 'stand') {
      this.knockDown();
    }
    return amount;
  }

  syncMeshes() {
    for (const { rb, group } of this.meshes) {
      const t = rb.translation();
      const r = rb.rotation();
      group.position.set(t.x, t.y, t.z);
      group.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}

// ── 도우미 함수들 ──

function vecQ(q) {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

function shapeDesc(RAPIER, s) {
  if (s[0] === 'box') return RAPIER.ColliderDesc.cuboid(s[1], s[2], s[3]);
  if (s[0] === 'ball') return RAPIER.ColliderDesc.ball(s[1]);
  return RAPIER.ColliderDesc.capsule(s[1], s[2]);
}

function shapeMesh(s, color, matOpts) {
  let geo;
  if (s[0] === 'box') geo = new THREE.BoxGeometry(s[1] * 2, s[2] * 2, s[3] * 2);
  else if (s[0] === 'ball') geo = new THREE.SphereGeometry(s[1], 16, 12);
  else geo = new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...(matOpts || {}) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function mat(color, opts) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...(opts || {}) });
}

function addMesh(group, geo, material, pos, rotEuler) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  if (rotEuler) m.rotation.set(...rotEuler);
  m.castShadow = true;
  group.add(m);
  return m;
}

/**
 * 부위 하나에 옷을 입힌다. 반환값은 "맞으면 붉어지는" 대표 메쉬.
 * 모든 좌표는 그 부위 몸체 기준 (+x 앞, +y 위, +z 오른쪽).
 */
function dressPart(group, d, look) {
  const s = d.shape;
  switch (d.name) {
    case 'pelvis': {
      const main = addMesh(group, new THREE.BoxGeometry(0.21, 0.19, 0.31), mat(look.tunic));
      // 상의 치마 자락 (허벅지 위를 덮음)
      addMesh(group, new THREE.CylinderGeometry(0.17, 0.215, 0.26, 14, 1, true), mat(look.tunic, { side: THREE.DoubleSide }), [0, -0.12, 0]);
      addMesh(group, new THREE.BoxGeometry(0.225, 0.04, 0.325), mat(look.belt), [0, 0.07, 0]);
      return main;
    }
    case 'chest': {
      const main = addMesh(group, new THREE.BoxGeometry(0.24, 0.42, 0.37), mat(look.tunic));
      // 누빔 줄무늬 (앞/뒤)
      for (const x of [0.121, -0.121]) {
        for (const z of [-0.11, 0, 0.11]) addMesh(group, new THREE.BoxGeometry(0.004, 0.4, 0.012), mat(look.quilt), [x, 0, z]);
      }
      // 옷깃
      addMesh(group, new THREE.CylinderGeometry(0.075, 0.09, 0.05, 12), mat(look.quilt), [0, 0.22, 0]);
      // 가죽 끈 X자 (앞/뒤)
      if (look.straps) {
        for (const x of [0.126, -0.126]) {
          for (const a of [0.62, -0.62]) addMesh(group, new THREE.BoxGeometry(0.006, 0.5, 0.035), mat(look.straps), [x, 0, 0], [a, 0, 0]);
        }
      }
      return main;
    }
    case 'head': {
      const face = addMesh(group, new THREE.SphereGeometry(s[1], 18, 14), mat(look.skin));
      const dark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
      for (const z of [-0.038, 0.038]) addMesh(group, new THREE.BoxGeometry(0.012, 0.016, 0.022), dark, [0.102, 0.018, z]);
      addMesh(group, new THREE.BoxGeometry(0.03, 0.035, 0.022), mat(look.skin), [0.112, -0.012, 0]);
      if (look.hair) {
        // 머리카락: 뒤통수와 정수리를 덮는 반구
        addMesh(group, new THREE.SphereGeometry(0.117, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(look.hair, { roughness: 1 }), [-0.012, 0.004, 0], [0, 0, 0.35]);
      }
      if (look.headband) addMesh(group, new THREE.CylinderGeometry(0.118, 0.118, 0.028, 18, 1, true), mat(look.headband), [0, 0.03, 0], [0, 0, 0.15]);
      if (look.helmet === 'kettle') {
        const steel = mat(look.metal, { metalness: 0.75, roughness: 0.3 });
        addMesh(group, new THREE.SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), steel, [0, 0.02, 0]);
        // 넓은 챙 (아래로 살짝 퍼짐)
        addMesh(group, new THREE.CylinderGeometry(0.135, 0.235, 0.05, 28, 1, true), new THREE.MeshStandardMaterial({ color: look.metal, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide }), [0, 0.0, 0]);
        // 정수리 능선
        addMesh(group, new THREE.BoxGeometry(0.2, 0.025, 0.012), steel, [0, 0.14, 0], [0, 0, 0]);
      }
      return face;
    }
    case 'uarmS':
    case 'uarmO':
      return addMesh(group, new THREE.CapsuleGeometry(s[2] + 0.008, s[1] * 2, 4, 10), mat(look.sleeve));
    case 'farmS':
    case 'farmO': {
      const m = addMesh(group, new THREE.CapsuleGeometry(s[2] + 0.004, s[1] * 2, 4, 10), mat(look.sleeve));
      addMesh(group, new THREE.SphereGeometry(0.042, 12, 8), mat(look.hands), [0, -0.135, 0]);
      return m;
    }
    case 'thighF':
    case 'thighB':
      return addMesh(group, new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10), mat(look.hoseUpper));
    default:
      return addMesh(group, new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10), mat(look.hoseLower));
  }
}

const _rv = new THREE.Vector3();
const MOTOR_AXES = [3, 4, 5]; // 회전 x, y, z (RawJointAxis.AngX/AngY/AngZ)

/** 쿼터니언 → 회전 벡터(축 * 각도) */
function toRotVec(q, out) {
  const w = Math.min(1, Math.abs(q.w));
  const sgn = q.w < 0 ? -1 : 1;
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-6) return out.set(0, 0, 0);
  const angle = 2 * Math.acos(w);
  return out.set(q.x, q.y, q.z).multiplyScalar((sgn * angle) / s);
}
const _qa = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _v2d = new THREE.Vector2();
