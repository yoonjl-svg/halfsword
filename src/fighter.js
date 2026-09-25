// ─────────────────────────────────────────────────────────────
//  검투사 한 명 = "액티브 래그돌"
//
//  몸은 관절로 이어진 강체(rigid body) 13개다. 애니메이션을 틀어주는
//  대신, 매 물리 스텝마다 "근육" 역할을 하는 힘과 회전력을 걸어서
//  서 있게 하고 걷게 하고 칼을 휘두르게 한다. 그래서 맞으면 비틀거리고
//  힘이 빠지면 인형처럼 쓰러진다. 이것이 하프 소드 느낌의 핵심이다.
//
//  좌표 약속: 싸움은 x축 위에서 벌어진다. 카메라는 +z 쪽에서 바라본다.
//  facing = +1 이면 오른쪽(+x)을 보고, -1 이면 왼쪽을 본다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BODY, WEAPON, DAMAGE } from './config.js';

// 충돌 그룹 비트. 자기 몸과 자기 칼끼리는 부딪히지 않게 한다.
const BIT = { ground: 1 };
const bodyBit = (i) => (i === 0 ? 2 : 8);
const weaponBit = (i) => (i === 0 ? 4 : 16);
const groups = (member, filter) => (member << 16) | filter;
export const GROUND_GROUPS = groups(BIT.ground, 0xffff);

// 부위 정의. 오른쪽(+x)을 보고 서 있는 자세 기준 좌표. s = 칼 든 팔 쪽 z 부호.
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

// 관절 정의: [부모, 자식, 관절 위치, 근육 강도, 감쇠, 최대 회전력]
function jointDefs(s) {
  return [
    ['pelvis', 'chest', [0, 1.08, 0], 500, 35, 400],
    ['chest', 'head', [0, 1.53, 0], 60, 4, 60],
    ['chest', 'uarmS', [0, 1.44, s * 0.25], 12, 1.2, 30],
    ['uarmS', 'farmS', [0, 1.14, s * 0.25], 6, 0.6, 20],
    ['chest', 'uarmO', [0, 1.44, -s * 0.25], 40, 3, 60],
    ['uarmO', 'farmO', [0, 1.14, -s * 0.25], 20, 1.5, 30],
    ['pelvis', 'thighF', [0, 0.88, s * 0.11], 400, 30, 400],
    ['thighF', 'shinF', [0, 0.46, s * 0.11], 200, 15, 250],
    ['pelvis', 'thighB', [0, 0.88, -s * 0.11], 400, 30, 400],
    ['thighB', 'shinB', [0, 0.46, -s * 0.11], 200, 15, 250],
  ];
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const toV = (v) => _v3.set(v.x, v.y, v.z);
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
   * @param {number} o.x      시작 x 위치
   * @param {number} o.facing +1 오른쪽을 봄 / -1 왼쪽을 봄
   * @param {object} o.colors { cloth, skin, metal }
   */
  constructor(RAPIER, world, scene, colliderInfo, o) {
    this.R = RAPIER;
    this.world = world;
    this.index = o.index;
    this.facing = o.facing;
    this.name = o.name;
    // 칼 든 팔이 항상 카메라 쪽(+z)에 오도록, 왼쪽을 보는 쪽은 부위를 반대로 놓는다.
    this.side = o.facing === 1 ? 1 : -1;

    this.hp = 100;
    this.balance = 100;
    this.state = 'stand'; // stand | down | getup | dead
    this.stateTime = 0;
    this.muscle = 1; // 근육 힘 비율 (넘어지면 0 근처로)
    this.armHealth = 1; // 칼 든 팔 상태
    this.legHealth = 1;
    this.moveInput = 0; // -1(뒤) ~ 1(앞) 이 아니라 화면 기준 -1(왼쪽) ~ 1(오른쪽)
    this.strength = o.strength ?? 1;
    this.gaitPhase = 0;
    this.hitCooldowns = new Map();
    this.onHurt = null;

    // 손 목표: 어깨 기준 (앞쪽, 위쪽) 오프셋. 입력/AI가 이 값을 바꾼다.
    this.handOffset = new THREE.Vector2(0.38, 0.02);

    this.bodies = {};
    this.meshes = [];
    this.joints = [];
    this.totalMass = 0;

    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, o.facing === 1 ? 0 : Math.PI);
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

      const color = d.kind === 'head' ? o.colors.skin : d.kind === 'chest' || d.kind === 'pelvis' ? o.colors.cloth : o.colors.limb;
      const group = new THREE.Group();
      const mesh = shapeMesh(d.shape, color);
      group.add(mesh);

      if (d.foot) {
        const fd = RAPIER.ColliderDesc.cuboid(0.1, 0.03, 0.05)
          .setTranslation(0.05, -0.185, 0)
          .setMass(0.8)
          .setFriction(0.8)
          .setCollisionGroups(bodyGroups);
        const fc = world.createCollider(fd, rb);
        colliderInfo.set(fc.handle, { fighter: this, kind: 'leg', part: d.name, body: rb });
        const fm = shapeMesh(['box', 0.1, 0.03, 0.05], o.colors.boot);
        fm.position.set(0.05, -0.185, 0);
        group.add(fm);
      }
      if (d.kind === 'head') {
        // 투구 흉내: 머리 위에 금속 반구
        const helm = new THREE.Mesh(
          new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
          new THREE.MeshStandardMaterial({ color: o.colors.metal, metalness: 0.7, roughness: 0.35 }),
        );
        helm.castShadow = true;
        group.add(helm);
        // 눈 방향 표시 (+x가 앞)
        const visor = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.02, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x111111 }),
        );
        visor.position.set(0.105, 0.01, 0);
        group.add(visor);
      }
      scene.add(group);
      this.meshes.push({ rb, group, baseColor: new THREE.Color(color), kind: d.kind, mesh });
      this.bodies[d.name] = rb;
      this.localPos[d.name] = new THREE.Vector3(...d.pos);
      this.totalMass += d.mass + (d.foot ? 0.8 : 0);
    }

    // 관절(구형 관절) 생성 + 근육(PD 제어) 정보 저장
    for (const [pa, ch, p, k, dmp, maxT] of jointDefs(this.side)) {
      const P = new THREE.Vector3(...p);
      const a1 = P.clone().sub(this.localPos[pa]);
      const a2 = P.clone().sub(this.localPos[ch]);
      world.createImpulseJoint(RAPIER.JointData.spherical(vecArg(a1), vecArg(a2)), this.bodies[pa], this.bodies[ch], true);
      this.joints.push({
        parent: this.bodies[pa],
        child: this.bodies[ch],
        name: ch,
        k,
        d: dmp,
        maxT,
        target: new THREE.Quaternion(),
      });
    }
    this.jointByName = Object.fromEntries(this.joints.map((j) => [j.name, j]));

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
      [['box', 0.018, 0.1, 0.018], 0, 0.1, o.colors.grip, false],
      [['ball', 0.03], -0.12, 0.1, o.colors.metal, false],
      [['box', 0.11, 0.015, 0.022], 0.115, 0.18, o.colors.metal, false],
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
    this.shoulderLocal = new THREE.Vector3(0, 1.44 - 1.28, this.side * 0.25); // chest 기준
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

  shoulderWorld(out = new THREE.Vector3()) {
    const c = this.bodies.chest.translation();
    rot(this.bodies.chest, _q1);
    return out.copy(this.shoulderLocal).applyQuaternion(_q1).add(_v1.set(c.x, c.y, c.z));
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
      const h = BODY.standHeight - (1 - this.legHealth) * 0.08;
      let fy = M * g * BODY.support * this.legHealth + BODY.supportStiffness * (h - p.y) - BODY.supportDamping * v.y;
      fy = THREE.MathUtils.clamp(fy * mus, 0, M * g * 2.5);
      // 너무 높이 떠 있으면(점프한 것처럼) 받치지 않는다
      if (p.y > h + 0.25) fy = 0;
      pelvis.addForce({ x: 0, y: fy, z: 0 }, true);
    }

    // 2) 좌우 이동 + 앞뒤(z) 흔들림 억제
    const speed = BODY.moveSpeed * (0.5 + 0.5 * this.legHealth);
    const desired = this.state === 'stand' ? this.moveInput * speed : 0;
    let fx = M * BODY.moveAccel * (desired - v.x);
    fx = THREE.MathUtils.clamp(fx, -M * 12, M * 12) * mus;
    const fz = M * (-25 * p.z - 8 * v.z) * mus;
    pelvis.addForce({ x: fx, y: 0, z: fz }, true);

    // 3) 똑바로 서기 (골반과 가슴을 목표 방향으로 회전)
    const k = BODY.uprightStiffness * mus;
    const d = BODY.uprightDamping * mus;
    const lean = this.state === 'stand' ? THREE.MathUtils.clamp(-v.x * this.facing * 0.06, -0.15, 0.15) : 0;
    _q2.setFromAxisAngle(Z_AXIS, lean).premultiply(this.yaw); // 이동 방향으로 살짝 숙임
    uprightTorque(pelvis, this.yaw, k, d, 600);
    uprightTorque(chest, _q2, k * 0.8, d * 0.8, 500);

    // 걷기 위상
    this.gaitPhase += Math.abs(v.x) * dt * 5.2;
  }

  // 관절 목표 자세 정하기 (걷기 사이클, 방패 없는 손 가드)
  applyPose() {
    const J = this.jointByName;
    const v = this.bodies.pelvis ? this.bodies.pelvis.linvel().x : 0;
    const amp = Math.min(1, Math.abs(v) / BODY.moveSpeed) * 0.5;
    const ph = this.gaitPhase;
    const setZ = (name, a) => J[name].target.setFromAxisAngle(Z_AXIS, a);
    // 앞다리/뒷다리: 펜싱 자세처럼 벌리고, 걸을 때 번갈아 흔든다
    setZ('thighF', 0.28 + amp * Math.sin(ph));
    setZ('thighB', -0.22 + amp * Math.sin(ph + Math.PI));
    setZ('shinF', -0.25 - amp * 1.1 * Math.max(0, Math.sin(ph + Math.PI / 2)));
    setZ('shinB', -0.15 - amp * 1.1 * Math.max(0, Math.sin(ph + Math.PI * 1.5)));
    // 빈 손은 앞으로 들어 균형을 잡는다
    setZ('uarmO', 0.5);
    setZ('farmO', 1.0);
    setZ('uarmS', 0.4);
    setZ('farmS', 0.6);
    setZ('head', 0);
    setZ('chest', 0);
  }

  driveJoints() {
    const legsMus = Math.max(0.15, this.muscle);
    for (const j of this.joints) {
      const isLeg = j.name.startsWith('thigh') || j.name.startsWith('shin');
      const mus = isLeg ? legsMus * (0.6 + 0.4 * this.legHealth) : Math.max(0.1, this.muscle);
      pdJoint(j.parent, j.child, j.target, j.k * mus, j.d * Math.max(0.3, mus), j.maxT);
    }
  }

  // 칼 조종: 손(칼자루)을 목표 위치로 끌고, 칼끝을 원하는 방향으로 돌린다.
  driveSword() {
    const sword = this.sword;
    const chest = this.bodies.chest;
    const mus = this.muscle;
    if (mus < 0.12) return; // 쓰러지면 칼을 놓친 듯 힘이 빠진다

    // 손 목표 위치 (어깨 + 오프셋), 팔 길이 이내로 제한
    const off = this.handOffset;
    const len = off.length();
    if (len > WEAPON.reach) off.multiplyScalar(WEAPON.reach / len);
    const shoulder = this.shoulderWorld(_v2);
    const target = this.handTarget.set(shoulder.x + off.x * this.facing, shoulder.y + off.y, shoulder.z + 0.08);

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

    // 칼끝 방향: 어깨→손 방향에 약간 위쪽을 더하고, 칼끝이 몸 중심선(z=0)을 향하게 기울인다.
    // (손은 몸 옆에 있으니, 칼을 안쪽으로 기울여야 상대 몸통과 머리에 닿는다)
    const aim = _v3.set(off.x * this.facing, off.y + 0.28, -target.z * 0.9);
    if (aim.lengthSq() < 1e-4) aim.set(0, 1, 0);
    aim.normalize();
    rot(sword, _q1);
    const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(_q1);
    const axis = new THREE.Vector3().crossVectors(blade, aim);
    const sinA = axis.length();
    const angle = Math.atan2(sinA, blade.dot(aim));
    const torque = new THREE.Vector3();
    if (sinA > 1e-5) torque.copy(axis).multiplyScalar((WEAPON.aimStiffness * angle) / sinA);
    // 칼날 면이 카메라를 향하도록(날이 휘두르는 방향으로 서도록) 비틀림 유지
    const flat = new THREE.Vector3(0, 0, 1).applyQuaternion(_q1);
    const flatTarget = Z_AXIS.clone().addScaledVector(blade, -blade.z).normalize();
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

/** 쿼터니언 오차 → (회전축 * 각도) 벡터 */
function rotationError(qTarget, qCur, out) {
  _q3.copy(qCur).invert().premultiply(qTarget); // qTarget * qCur^-1
  if (_q3.w < 0) _q3.set(-_q3.x, -_q3.y, -_q3.z, -_q3.w);
  const s = Math.sqrt(1 - Math.min(1, _q3.w * _q3.w));
  const angle = 2 * Math.acos(Math.min(1, _q3.w));
  if (s < 1e-5) return out.set(0, 0, 0);
  return out.set(_q3.x / s, _q3.y / s, _q3.z / s).multiplyScalar(angle);
}

const _e = new THREE.Vector3();
const _w1 = new THREE.Vector3();
const _w2 = new THREE.Vector3();
const _qc = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qd = new THREE.Quaternion();

// 한 몸체를 월드 기준 목표 방향으로 돌리는 힘
function uprightTorque(rb, qTarget, k, d, maxT) {
  rot(rb, _qc);
  rotationError(qTarget, _qc, _e);
  angvel(rb, _w1);
  const t = _e.multiplyScalar(k).addScaledVector(_w1, -d);
  if (t.length() > maxT) t.setLength(maxT);
  rb.addTorque(vecArg(t), true);
}

// 관절 근육: 자식 몸체를 (부모 기준) 목표 자세로 돌린다. 부모에는 반작용.
function pdJoint(parent, child, qRel, k, d, maxT) {
  rot(parent, _qp);
  rot(child, _qc);
  _qd.copy(_qp).multiply(qRel);
  rotationError(_qd, _qc, _e);
  angvel(child, _w1);
  angvel(parent, _w2);
  const t = _e.multiplyScalar(k).addScaledVector(_w1.sub(_w2), -d);
  if (t.length() > maxT) t.setLength(maxT);
  child.addTorque(vecArg(t), true);
  parent.addTorque({ x: -t.x, y: -t.y, z: -t.z }, true);
}
