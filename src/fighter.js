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
import { BODY, WEAPON, VITALS, BALANCE } from './config.js';
import { Skill } from './skill.js';

// 충돌 그룹 비트. 자기 몸과 자기 칼끼리는 부딪히지 않게 한다.
const BIT = { ground: 1 };
const bodyBit = (i) => (i === 0 ? 2 : 8);
const weaponBit = (i) => (i === 0 ? 4 : 16);
// 발은 따로: 상대 발·다리와는 부딪히지 않는다 (서로 발을 밟고 마찰로 엉겨 붙는 것을 막는다)
const footBit = (i) => (i === 0 ? 64 : 128);
const groups = (member, filter) => (member << 16) | filter;
export const GROUND_GROUPS = groups(BIT.ground, 0xffff);

// ─────────────────────────────────────────────────────────────
//  몸 설계: 사람 인체 측정 자료(Winter, "Biomechanics and Motor Control of Human Movement")의
//  부위별 질량 비율·길이 비율로 키 1.75m, 몸무게 75kg인 사람을 만든다.
//  좌표: 앞(+x)을 보고 선 자세 기준. s = 칼 든 팔 쪽 z 부호(+1 = 오른손).
//   관절 높이: 발목 0.08, 무릎 0.50, 엉덩이 0.93, 허리 1.06, 등 1.20, 어깨 1.43, 목 1.50
// ─────────────────────────────────────────────────────────────
function partDefs(s) {
  return [
    // 몸통 (몸무게의 약 50%): 골반·배·가슴 세 덩어리로 나눠 허리가 휘고 비틀린다
    { name: 'pelvis', kind: 'pelvis', shape: ['box', 0.1, 0.085, 0.16], pos: [0, 0.97, 0], mass: 10.7 },
    { name: 'abdomen', kind: 'abdomen', shape: ['box', 0.1, 0.07, 0.15], pos: [0, 1.13, 0], mass: 10.4 },
    { name: 'chest', kind: 'chest', shape: ['box', 0.11, 0.13, 0.18], pos: [0, 1.33, 0], mass: 16.2 },
    { name: 'head', kind: 'head', shape: ['ball', 0.1], pos: [0, 1.62, 0], mass: 6.1 },
    // 팔: 위팔 2.8%, 아래팔+손 2.2%
    // 칼 든 팔은 "앞으로 뻗은 자세"를 관절의 기준(0°)으로 만든다. 칼을 쓰는 범위(겨누기~머리 위~아래)가
    // 기준에서 ±90° 안에 들어와야 물리 엔진의 관절 계산이 정확하다.
    // 몸체 좌표축은 가슴과 나란하게 두고(엔진의 0° = 이 자세), 뼈 모양만 앞(+x)으로 눕힌다(alongX).
    { name: 'uarmS', kind: 'arm', shape: ['capsule', 0.105, 0.045], pos: [0.15, 1.43, s * 0.2], alongX: true, mass: 2.1 },
    { name: 'farmS', kind: 'arm', shape: ['capsule', 0.095, 0.04], pos: [0.435, 1.43, s * 0.2], alongX: true, mass: 1.65 },
    { name: 'uarmO', kind: 'arm', shape: ['capsule', 0.105, 0.045], pos: [0, 1.28, -s * 0.2], mass: 2.1 },
    { name: 'farmO', kind: 'arm', shape: ['capsule', 0.095, 0.04], pos: [0, 0.99, -s * 0.2], mass: 1.65 },
    // 다리: 허벅지 10%, 정강이 4.65%, 발 1.45%
    { name: 'thighF', kind: 'leg', shape: ['capsule', 0.15, 0.065], pos: [0, 0.715, s * 0.095], mass: 7.5 },
    { name: 'shinF', kind: 'leg', shape: ['capsule', 0.16, 0.05], pos: [0, 0.29, s * 0.095], mass: 3.5 },
    { name: 'footF', kind: 'leg', shape: ['box', 0.12, 0.035, 0.05], pos: [0.05, 0.045, s * 0.095], mass: 1.1, foot: true },
    { name: 'thighB', kind: 'leg', shape: ['capsule', 0.15, 0.065], pos: [0, 0.715, -s * 0.095], mass: 7.5 },
    { name: 'shinB', kind: 'leg', shape: ['capsule', 0.16, 0.05], pos: [0, 0.29, -s * 0.095], mass: 3.5 },
    { name: 'footB', kind: 'leg', shape: ['box', 0.12, 0.035, 0.05], pos: [0.05, 0.045, -s * 0.095], mass: 1.1, foot: true },
  ];
}

// ─────────────────────────────────────────────────────────────
//  관절 = 뼈 연결 + 근육
//   ball  : 공 관절(엉덩이·어깨·척추·목) — 세 방향으로 돌지만 각도 제한이 있다
//   hinge : 경첩 관절(무릎·팔꿈치·발목) — 한 방향으로만 접힌다
//   k: 근육 강도(N·m/rad), d: 감쇠, max: 낼 수 있는 최대 회전력(N·m, 사람 근력 수준)
//   lim: 각도 제한(라디안). 회전축 x = 옆으로 벌리기, y = 비틀기, z = 앞뒤로 굽히기(+ 앞)
//        (척추·목은 z가 + 일 때 뒤로 젖혀진다)
// ─────────────────────────────────────────────────────────────
function jointDefs(s) {
  return [
    { p: 'pelvis', c: 'abdomen', at: [0, 1.06, 0], type: 'ball', k: 900, d: 90, max: 250, lim: { x: [-0.35, 0.35], y: [-0.5, 0.5], z: [-0.7, 0.3] } },
    { p: 'abdomen', c: 'chest', at: [0, 1.2, 0], type: 'ball', k: 800, d: 80, max: 220, lim: { x: [-0.3, 0.3], y: [-0.6, 0.6], z: [-0.5, 0.25] } },
    { p: 'chest', c: 'head', at: [0, 1.5, 0], type: 'ball', k: 140, d: 8, max: 40, lim: { x: [-0.5, 0.5], y: [-1.0, 1.0], z: [-0.7, 0.5] } },
    // 칼 든 어깨: 뼈가 x축을 따라 누워 있어서 x = 팔 비틀기, y = 좌우로 휘두르기, z = 위아래
    //  (칼 든 어깨는 머리 위~등 뒤까지 크게 돌아서, 엔진 모터 대신 직접 계산한 근육 힘을 쓴다: manual)
    { p: 'chest', c: 'uarmS', at: [0, 1.43, s * 0.2], type: 'ball', manual: true, k: 320, d: 26, max: 110 },
    { p: 'uarmS', c: 'farmS', at: [0, 1.13, s * 0.2], type: 'hinge', k: 200, d: 12, max: 80, lim: [0, 2.5] },
    { p: 'chest', c: 'uarmO', at: [0, 1.43, -s * 0.2], type: 'ball', k: 200, d: 18, max: 70, lim: { x: [-2.4, 2.4], y: [-1.5, 1.5], z: [-1.0, 2.9] } },
    { p: 'uarmO', c: 'farmO', at: [0, 1.13, -s * 0.2], type: 'hinge', k: 120, d: 10, max: 50, lim: [0, 2.5] },
    { p: 'pelvis', c: 'thighF', at: [0, 0.93, s * 0.095], type: 'ball', k: 900, d: 80, max: 280, lim: { x: [-0.6, 0.6], y: [-0.6, 0.6], z: [-0.5, 2.0] } },
    { p: 'thighF', c: 'shinF', at: [0, 0.5, s * 0.095], type: 'hinge', k: 800, d: 50, max: 250, lim: [-2.5, 0.02] },
    { p: 'shinF', c: 'footF', at: [0, 0.08, s * 0.095], type: 'hinge', k: 350, d: 12, max: 120, lim: [-0.6, 0.8] },
    { p: 'pelvis', c: 'thighB', at: [0, 0.93, -s * 0.095], type: 'ball', k: 900, d: 80, max: 280, lim: { x: [-0.6, 0.6], y: [-0.6, 0.6], z: [-0.5, 2.0] } },
    { p: 'thighB', c: 'shinB', at: [0, 0.5, -s * 0.095], type: 'hinge', k: 800, d: 50, max: 250, lim: [-2.5, 0.02] },
    { p: 'shinB', c: 'footB', at: [0, 0.08, -s * 0.095], type: 'hinge', k: 350, d: 12, max: 120, lim: [-0.6, 0.8] },
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

/**
 * 손 목표(몸 앞 평면의 좌우 x, 위아래 y) → 칼끝 방향 (몸 기준: x 앞, y 위, z 칼 든 쪽)
 */
function guardDir(x, y) {
  // 들어 올릴수록 칼이 선다: 가슴 높이(0.1) 수평, 머리 위(0.6)에서 약 95°(살짝 뒤로)
  const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  // 옆으로 뺄수록 칼이 그쪽으로 눕는다 (칼 든 쪽은 더 크게 뺄 수 있다)
  const az = THREE.MathUtils.clamp((x - 0.05) * 1.7, -1.1, 1.3);
  const c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}

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

    // ── 몸 상태 (체력 게이지 대신) ──
    this.blood = 1; // 남은 피 (1 = 100%)
    this.bleed = 0; // 초당 출혈량 (전체 피 대비 비율)
    this.consciousness = 1; // 의식. 0이 되면 기절(패배)
    this.pain = 0; // 통증: 크게 맞으면 잠깐 힘이 빠진다
    this.limbs = { armS: 1, armO: 1, legF: 1, legB: 1 }; // 팔다리 기능 (1 = 멀쩡)
    this.wounds = []; // { part, type, severity, bleed, local(몸 기준 위치) }
    this.causeOfDeath = null;
    this.daze = 0;
    this.downTime = BODY.fallDuration;
    this.kneelTime = 1.1;
    this.riseTime = 0.9;
    this.hasHelmet = o.look.helmet === 'kettle';
    this.helmetIntegrity = 1; // 투구 상태 (찌그러질수록 덜 막아준다)
    this.cloth = {}; // 부위별 옷(누비 상의) 상태 1 = 멀쩡, 0 = 넝마
    this.scene = scene;
    this.armed = true;
    this.balance = 100; // 휘청임 게이지: 세게 맞으면 줄고, 바닥나면 넘어진다
    this.offBalance = 0; // 무게중심이 발 밖으로 벗어난 거리 (m)
    this.offBalanceTime = 0;
    this.stumble = new THREE.Vector2(); // 균형을 잡으려고 자동으로 딛는 걸음 (몸 기준)
    this.state = 'stand'; // stand | down | getup | dead
    this.stateTime = 0;
    this.muscle = 1; // 근육 힘 비율 (넘어지면 0 근처로)
    this.move = new THREE.Vector2(); // x: 옆걸음(+오른쪽), y: 앞(+)/뒤(-). 각각 -1 ~ 1
    this.strength = o.strength ?? 1;
    this.gaitPhase = 0;
    this.gaitWeight = 0; // 0 = 서 있음, 1 = 걷는 중 (부드럽게 바뀜)
    this.stanceDrop = 0; // 딛는 다리가 기울어진 만큼 골반을 낮춰 발이 땅에 닿게 한다
    this.prevU = {};
    this.footLoad = { F: 1, B: 1 };
    this.crouch = 0; // 무릎 꿇기 등으로 낮춘 높이(m)
    this.footstep = 0; // 발을 디딘 순간의 세기 (main이 읽고 0으로 되돌린다)
    this.gaitDir = new THREE.Vector2(1, 0); // 몸 기준 이동 방향 (x 앞, y 오른쪽)
    this.localVel = new THREE.Vector2();
    this.hitCooldowns = new Map();
    this.onHurt = null;

    // 손 목표: 몸 앞 평면에서 (좌우, 위아래) 오프셋(m). 입력/AI가 이 값을 바꾼다.
    // 앞뒤 깊이는 자동: 가운데로 모을수록 팔을 앞으로 뻗는다.
    this.handOffset = new THREE.Vector2(0.15, 0.0);
    this.skill = new Skill(this); // 검술 층: 손 목표·허리·발에 익힌 몸놀림을 보탠다

    this.bodies = {};
    this.groups = {}; // 부위 이름 → 화면용 그룹
    this.partMesh = {}; // 부위 이름 → 겉면 메쉬 (상처 자국을 붙인다)
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
    const footGroups = groups(footBit(this.index), BIT.ground | otherWeapon);
    const weaponGroups = groups(weaponBit(this.index), BIT.ground | otherBody | otherWeapon | footBit(1 - this.index));

    const defs = partDefs(this.side);
    this.localPos = {};
    this.localRot = {};
    for (const d of defs) {
      const wp = toWorld(d.pos);
      const lq = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, d.rz || 0);
      this.localRot[d.name] = lq;
      const rb = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wp.x, wp.y, wp.z)
          .setRotation(vecQ(yaw.clone().multiply(lq)))
          .setLinearDamping(0.05)
          // 칼 든 팔은 엔진 쪽 회전 감쇠를 조금 더 준다 (엔진이 안정적으로 처리하는 감쇠)
          .setAngularDamping(d.alongX ? 1.5 : 0.4),
      );
      const cd = shapeDesc(RAPIER, d.shape)
        .setRotation(vecQ(d.alongX ? ALONG_X : IDENTITY_Q))
        .setMass(d.mass)
        // 옷·살끼리는 잘 미끄러진다 (마찰이 크면 팔이 상대 몸에 걸려 같이 끌려간다)
        .setFriction(d.foot ? 0.9 : 0.25)
        .setCollisionGroups(d.foot ? footGroups : bodyGroups);
      const col = world.createCollider(cd, rb);
      if (d.alongX) {
        // 팔을 길이 방향으로 비트는 관성: 가느다란 캡슐만으로는 실제 팔(근육·뼈·손)보다 훨씬 작아서
        // 조금만 비틀어도 팽이처럼 돈다. 실제 팔 수준(약 0.004 kg·m²)을 더해 준다.
        rb.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 0.004, y: 0, z: 0 }, vecQ(IDENTITY_Q), true);
      }
      colliderInfo.set(col.handle, { fighter: this, kind: d.kind, part: d.name, body: rb });

      const group = new THREE.Group();
      this.groups[d.name] = group;
      // 뼈가 앞으로 누운 부위는 겉모습도 같이 눕힌다
      const dressTo = d.alongX ? new THREE.Group() : group;
      if (d.alongX) {
        dressTo.quaternion.copy(ALONG_X);
        group.add(dressTo);
      }
      const mesh = dressPart(dressTo, d, o.look);
      this.partMesh[d.name] = mesh; // 흔적(데칼)을 붙일 겉면
      if (group.userData.helmet) this.helmetGroup = group.userData.helmet;
      if (d.kind === 'head') {
        this.faceMat = mesh.material;
        this.skinColor = mesh.material.color.clone();
      }

      scene.add(group);
      this.meshes.push({ rb, group, kind: d.kind, mesh });
      this.bodies[d.name] = rb;
      this.localPos[d.name] = new THREE.Vector3(...d.pos);
      this.totalMass += d.mass;
    }

    // 관절 생성 + 근육(관절 모터) + 각도 제한
    for (const jd of jointDefs(this.side)) {
      const P = new THREE.Vector3(...jd.at);
      const rp = this.localRot[jd.p];
      const rc = this.localRot[jd.c];
      const a1 = P.clone().sub(this.localPos[jd.p]).applyQuaternion(rp.clone().invert());
      const a2 = P.clone().sub(this.localPos[jd.c]).applyQuaternion(rc.clone().invert());
      // 만들 때의 상대 회전 = 관절의 기준(0°) 자세
      const rest = rp.clone().invert().multiply(rc);
      const data =
        jd.type === 'hinge'
          ? RAPIER.JointData.revolute(vecArg(a1), vecArg(a2), { x: 0, y: 0, z: 1 })
          : RAPIER.JointData.spherical(vecArg(a1), vecArg(a2));
      const joint = world.createImpulseJoint(data, this.bodies[jd.p], this.bodies[jd.c], true);
      const raw = joint.rawSet;
      if (jd.manual) {
        // 엔진 모터·각도 제한 없음 (driveJoints에서 직접 회전력을 건다)
      } else if (jd.type === 'hinge') {
        joint.setLimits(jd.lim[0], jd.lim[1]);
        raw.jointConfigureMotorModel(joint.handle, HINGE_AXIS, 1); // 1 = 힘(N·m) 기준
      } else {
        ['x', 'y', 'z'].forEach((ax, i) => {
          raw.jointSetLimits(joint.handle, MOTOR_AXES[i], jd.lim[ax][0], jd.lim[ax][1]);
          raw.jointConfigureMotorModel(joint.handle, MOTOR_AXES[i], 1);
        });
      }
      this.joints.push({ joint, name: jd.c, parent: this.bodies[jd.p], child: this.bodies[jd.c], type: jd.type, manual: !!jd.manual, restInv: rest.clone().invert(), k: jd.k, d: jd.d, max: jd.max, target: new THREE.Quaternion() });
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
    const wristLocal = new THREE.Vector3(0.565, 1.43, this.side * 0.2); // 앞으로 뻗은 팔 끝
    const wp = toWorld(wristLocal.toArray());
    // 처음부터 준비 자세(칼끝이 앞을 향함)로 만든다. 세워서 만들면 시작하자마자 칼이 앞으로 쓰러지며 내리친다.
    const swordRot = yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -1.45));
    const sword = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(wp.x, wp.y, wp.z)
        .setRotation(vecQ(swordRot))
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
        .setContactForceEventThreshold(1)
        // 칼날만: 충돌 직전에 combat.js가 "가르고 지나갈지"를 정할 수 있게 한다
        .setActiveHooks(isBlade ? RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS : RAPIER.ActiveHooks.NONE);
      const col = world.createCollider(cd, sword);
      colliderInfo.set(col.handle, { fighter: this, kind: 'weapon', part: isBlade ? 'blade' : 'hilt', body: sword });
      const mesh = shapeMesh(shape, color, isBlade ? { metalness: 0.9, roughness: 0.25 } : null);
      mesh.position.y = y;
      group.add(mesh);
      if (isBlade) {
        this.bladeColliders.push(col);
        this.bladeMesh = mesh; // 벨수록 피가 묻는다
      }
    }
    scene.add(group);
    this.meshes.push({ rb: sword, group, kind: 'weapon' });
    this.sword = sword;
    this.gripJoint = world.createImpulseJoint(
      RAPIER.JointData.spherical({ x: 0.13, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), // 아래팔 앞끝(손목)
      this.bodies.farmS,
      sword,
      true,
    );
    this.swordGroup = group;
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

  /** 다리 기능 (두 다리 평균) */
  get legHealth() {
    return (this.limbs.legF + this.limbs.legB) / 2;
  }

  /** 칼 든 팔 기능 */
  get armHealth() {
    return this.limbs.armS;
  }

  /** 피가 모자라거나 아프면 힘이 빠진다 (0~1) */
  get vigor() {
    const b = THREE.MathUtils.clamp((this.blood - VITALS.collapseBlood) / (VITALS.weakBlood - VITALS.collapseBlood), 0, 1);
    return Math.min(1, 0.35 + 0.65 * b) * (1 - 0.4 * Math.min(1, this.pain));
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
    if (this.state === 'stand' || this.state === 'getup' || this.state === 'kneel') {
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

  /** 상대 가슴까지의 수평 거리 (상대가 없으면 Infinity) */
  foeDistance() {
    const f = this.foe;
    if (!f) return Infinity;
    const a = this.bodies.chest.translation();
    const b = f.bodies.chest.translation();
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  /** 바짝 붙었을 때 손을 상대 몸 속으로 뻗지 않는다 (팔을 접어 칼자루를 몸 가까이 당긴다) */
  closeReach() {
    return Math.max(0.12, this.foeDistance() - 0.3);
  }

  /**
   * 밀쳐내기: 바짝 붙은 채 뒤로 물러나려 하면 빈손(과 칼자루)으로 상대 가슴을 민다.
   * 같은 크기, 반대 방향의 힘을 내 가슴에도 건다 (작용·반작용) → 둘 다 밀려 떨어진다.
   * 아주 가까우면(몸이 닿으면) 물러날 생각이 없어도 조금은 밀어낸다.
   */
  shove() {
    const f = this.foe;
    if (!f || !f.alive || this.muscle < 0.5) return;
    if (this.state !== 'stand' && this.state !== 'kneel') return;
    const d = this.foeDistance();
    if (d > 0.75) return;
    const back = Math.max(0, -this.move.y); // 조이스틱을 뒤로 당긴 정도
    const touch = THREE.MathUtils.clamp((0.55 - d) / 0.2, 0, 1); // 몸이 닿을수록
    const amt = Math.max(back, 0.35 * touch);
    if (amt <= 0) return;
    const a = this.bodies.chest.translation();
    const b = f.bodies.chest.translation();
    const dir = _v1.set(b.x - a.x, 0, b.z - a.z);
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    const F = BODY.shoveForce * amt * this.muscle * this.strength * (0.4 + 0.6 * this.limbs.armO);
    f.bodies.chest.addForce({ x: dir.x * F, y: 0, z: dir.z * F }, true);
    this.bodies.chest.addForce({ x: -dir.x * F, y: 0, z: -dir.z * F }, true);
  }

  // ── 매 물리 스텝마다 호출: 근육을 움직인다 ──
  step(dt) {
    this.lastDt = dt;
    this.stateTime += dt;
    this.updateState(dt);

    // 상태에 따른 근육 힘 목표치
    let targetMuscle = 1;
    if (this.state === 'down') targetMuscle = 0.1;
    else if (this.state === 'dead') targetMuscle = 0.02;
    else if (this.state === 'getup') targetMuscle = Math.min(1, 0.35 + this.stateTime / this.kneelTime);
    if (this.state !== 'dead') targetMuscle *= this.vigor;
    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));

    for (const { rb } of this.meshes) rb.resetForces(true), rb.resetTorques(true);

    this.updateHeading(dt);
    this.skill.update(dt);
    this.driveBalance(dt);
    this.applyPose(dt);
    this.shove();
    this.driveSword(); // 팔 목표(IK)를 정한 뒤
    this.driveJoints(); // 모든 관절 근육을 움직인다
    this.trackBlade(dt);

    for (const [k, t] of this.hitCooldowns) {
      if (t - dt <= 0) this.hitCooldowns.delete(k);
      else this.hitCooldowns.set(k, t - dt);
    }
  }

  // 상태: stand(서 있음) → down(완전히 쓰러짐) → getup(무릎 꿇고 → 일어섬) → stand
  //       kneel: 다리를 크게 다쳐 무릎 꿇은 채로 버팀(칼은 쓸 수 있다)
  updateState(dt) {
    this.updateVitals(dt);
    if (this.state === 'dead') return;
    const tilt = this.tiltDeg();
    const leg = Math.max(0.3, this.legHealth);
    // 일어나는 데 걸리는 시간: 다리가 다칠수록, 피를 흘릴수록 오래
    this.kneelTime = (1.1 / leg) / Math.max(0.5, this.vigor);
    this.riseTime = (0.9 / leg) / Math.max(0.5, this.vigor);
    if (this.state === 'stand') {
      this.balance = Math.min(100, this.balance + VITALS.balanceRegen * dt);
      const lostFooting = this.offBalanceTime > BALANCE.fallDelay;
      if (tilt > BODY.fallTiltDeg || this.balance <= 0 || lostFooting) this.knockDown(tilt > BODY.fallTiltDeg + 15);
      else if (this.legHealth < 0.25) this.knockDown(false); // 다리가 버티지 못해 주저앉는다
    } else if (this.state === 'down') {
      if (this.stateTime > this.downTime && this.consciousness > 0.3) this.setState('getup');
    } else if (this.state === 'getup') {
      if (this.stateTime > this.kneelTime) {
        // 무릎 꿇은 자세에서 일어서기. 다리가 못 버티면 무릎 꿇은 채로 남는다
        if (this.legHealth < 0.25) this.setState('kneel');
        else if (this.stateTime > this.kneelTime + this.riseTime) {
          this.setState('stand');
          this.balance = 60;
          this.offBalanceTime = 0;
        }
      }
    }
  }

  /** 일어나는 중 무릎 꿇은 정도 (1 = 완전히 무릎 꿇음, 0 = 서 있음) */
  get kneelAmount() {
    if (this.state === 'kneel') return 1;
    if (this.state !== 'getup') return 0;
    if (this.stateTime < this.kneelTime) return 1;
    return THREE.MathUtils.clamp(1 - (this.stateTime - this.kneelTime) / this.riseTime, 0, 1);
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  /**
   * 넘어지기. heavy = 크게 맞거나 완전히 균형을 잃음 → 인형처럼 쓰러짐.
   * 아니면 무릎이 꺾여 주저앉았다가(무릎 꿇기) 다시 일어난다.
   */
  knockDown(heavy = true) {
    if (this.state === 'dead' || this.state === 'down') return;
    if (!heavy && (this.state === 'getup' || this.state === 'kneel')) return;
    this.balance = 0;
    if (heavy) {
      this.downTime = BODY.fallDuration * (1 + (1 - this.legHealth) + (1 - this.vigor));
      this.setState('down');
    } else {
      this.setState('getup'); // 무릎 꿇은 자세부터
    }
  }

  die(cause) {
    if (this.state === 'dead') return;
    this.causeOfDeath = cause;
    this.setState('dead');
  }

  // ── 출혈·의식·통증 ──
  updateVitals(dt) {
    if (this.bleed > 0) {
      this.blood = Math.max(0, this.blood - this.bleed * dt);
      // 피가 굳으며 출혈이 줄어든다 (큰 상처일수록 느리게)
      this.bleed = Math.max(0, this.bleed - this.bleed * VITALS.clotting * dt);
      for (const w of this.wounds) w.bleed *= 1 - VITALS.clotting * dt;
    }
    this.pain = Math.max(0, this.pain - dt * 0.6);
    if (this.state === 'dead') return;
    this.consciousness = Math.min(1, this.consciousness + dt * 0.03); // 정신이 천천히 돌아온다
    if (this.blood < VITALS.collapseBlood) this.die('출혈');
    else if (this.consciousness <= 0) this.die('기절');
  }

  /**
   * 상처 입기. combat.js가 칼이 닿은 순간을 분석해서 부른다.
   * @param {object} h { part, zone('head'|'neck'|'chest'|'pelvis'|'arm'|'leg'), type('cut'|'stab'|'blunt'),
   *                     severity(0~), energy(J), local(부위 기준 위치), helmet(bool) }
   */
  applyWound(h) {
    if (this.state === 'dead') return;
    const sev = h.severity;
    const Z = h.zone;
    // 통증과 휘청임 (에너지가 클수록)
    this.pain = Math.min(2, this.pain + sev * 0.8 + h.energy / 150);
    this.balance -= h.energy * VITALS.staggerPerJoule;

    // 옷과 투구도 상한다
    if (h.helmet) {
      this.helmetIntegrity = Math.max(0, this.helmetIntegrity - h.energy / 450);
      if (this.helmetIntegrity <= 0 || (h.type === 'blunt' && h.energy > 200)) this.knockOffHelmet(h.dir, h.energy);
    } else if (Z !== 'head' && Z !== 'neck') {
      const c = this.cloth[h.part] ?? 1;
      const tear = h.type === 'blunt' ? h.energy / 800 : 0.25 + sev * 0.5;
      this.cloth[h.part] = Math.max(0, c - tear);
    }

    if (h.type === 'blunt') {
      if (Z === 'head' || Z === 'neck') {
        const k = h.helmet ? h.helmetBlunt : 1;
        this.consciousness -= h.energy * VITALS.concussionPerJoule * k;
        if (h.energy * k > 45) this.knockDown(h.energy * k > 90); // 머리를 세게 맞으면 주저앉거나 쓰러진다
        this.daze = Math.min(1, (this.daze || 0) + h.energy * k / 100); // 멍함
      }
      return;
    }

    // 베기/찌르기 → 상처 + 출혈
    const bleedPerSev = h.bleedPerSev;
    const bleed = sev * bleedPerSev * (h.type === 'stab' ? 1.6 : 1);
    this.bleed += bleed;
    this.wounds.push({ part: h.part, type: h.type, severity: sev, bleed, local: h.local.clone() });

    // 치명상
    if (Z === 'neck' && sev > 0.5) this.die('목');
    else if (Z === 'head' && ((h.type === 'cut' && sev > 0.8) || (h.type === 'stab' && sev > 0.5))) this.die('머리');
    else if (Z === 'chest' && h.type === 'stab' && sev > 1.1) this.bleed += 0.25; // 심장·폐: 몇 초 안에 쓰러진다

    // 팔다리 기능
    const limb = { uarmS: 'armS', farmS: 'armS', uarmO: 'armO', farmO: 'armO', thighF: 'legF', shinF: 'legF', footF: 'legF', thighB: 'legB', shinB: 'legB', footB: 'legB' }[h.part];
    if (limb) {
      this.limbs[limb] = Math.max(0, this.limbs[limb] - sev * 0.7);
      if (limb === 'armS' && this.limbs.armS < VITALS.dropSwordArm) this.dropSword();
    }
    if (Z === 'head' && h.type === 'cut') this.consciousness -= sev * 0.5;
  }

  /** 투구가 벗겨져 날아간다 (따로 굴러다니는 물체가 된다) */
  knockOffHelmet(dir, energy) {
    if (!this.hasHelmet || !this.helmetGroup) return;
    this.hasHelmet = false;
    const R = this.R;
    const head = this.groups.head;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    this.helmetGroup.getWorldPosition(wp);
    this.helmetGroup.getWorldQuaternion(wq);
    head.remove(this.helmetGroup);
    this.scene.add(this.helmetGroup);
    const rb = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(wp.x, wp.y, wp.z).setRotation(vecQ(wq)).setAngularDamping(0.5),
    );
    this.world.createCollider(
      R.ColliderDesc.cylinder(0.04, 0.2).setMass(1.3).setFriction(0.7).setRestitution(0.3).setCollisionGroups((32 << 16) | 1),
      rb,
    );
    const k = Math.min(1, energy / 250);
    rb.applyImpulse({ x: dir.x * 3 * k, y: 1.5 + 1.5 * k, z: dir.z * 3 * k }, true);
    rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.3 }, true);
    this.meshes.push({ rb, group: this.helmetGroup, kind: 'loose' });
  }

  /** 칼날에 피가 묻는다 */
  bloodyBlade(amount) {
    if (!this.bladeMesh) return;
    this.bladeBlood = Math.min(0.65, (this.bladeBlood || 0) + amount);
    this.bladeMesh.material.color.set(0xd8dde3).lerp(_bloodColor, this.bladeBlood);
  }

  dropSword() {
    if (!this.armed) return;
    this.armed = false;
    this.world.removeImpulseJoint(this.gripJoint, true);
  }

  /** 몸통이 "의도한 자세"(가속할 때 숙인 것 포함)에서 벗어난 각도 */
  tiltDeg() {
    rot(this.bodies.chest, _q1);
    const up = _v1.set(0, 1, 0).applyQuaternion(_q1);
    const ref = this.anchorUp || UP;
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.dot(ref), -1, 1)));
  }

  // 골반을 떠받치고, 몸을 세우고, 걷게 한다.
  driveBalance(dt) {
    const pelvis = this.bodies.pelvis;
    const M = this.totalMass;
    const g = 9.81;
    const mus = this.muscle;
    const p = pelvis.translation();
    const v = pelvis.linvel();
    const fwd = this.forward(_v1);
    const rgt = this.right(_v2);
    // 내가 가려는 속도 (입력 + 균형 잡으려는 발걸음)
    const speed = BODY.moveSpeed * (0.45 + 0.55 * this.legHealth);
    const st = this.stumble;
    const mv = this.state === 'stand' ? { x: this.move.x * (1 - st.length()) + st.x, y: this.move.y * (1 - st.length()) + st.y } : { x: 0, y: 0 };
    if (this.state === 'stand' && this.daze > 0.2) {
      // 멍하면 발이 제멋대로 움찔거린다
      mv.x += Math.sin(this.stateTime * 3.1) * this.daze * 0.5;
      mv.y += Math.sin(this.stateTime * 2.3 + 1) * this.daze * 0.4;
    }
    const along = mv.y * speed * (mv.y < 0 ? 0.75 : 1);
    const side = mv.x * speed * 0.8;
    const want = _v4.set(fwd.x * along + rgt.x * side, 0, fwd.z * along + rgt.z * side);
    this.updateFooting(dt, fwd, rgt, want);
    // 두 발이 체중을 얼마나 받는지 (땅에 닿고 몸 아래에 있을수록 1).
    // 걷는 중엔 들어 올리는 발(스윙)에는 체중을 싣지 않는다 → 발을 뗄 수 있다
    const stanceOf = (thigh) => {
      if (this.gaitWeight < 0.3) return 1;
      const u = this.prevU[thigh] ?? 0;
      return u < 0.6 ? 1 : 0.05;
    };
    const load = { F: this.footLoad.F * stanceOf('thighF'), B: this.footLoad.B * stanceOf('thighB') };
    // 무릎 꿇기/일어나는 중엔 무릎과 손으로 땅을 짚으니 받칠 수 있다
    const kn = this.kneelAmount;
    if (kn > 0) {
      load.F = Math.max(load.F, 0.6);
      load.B = Math.max(load.B, 0.6);
    }
    this.crouch = kn * 0.43;
    const loadSum = load.F + load.B;

    // 다리 근육이 "골반은 위로, 발은 아래로" 민다. 발이 땅을 딛고 있으면 땅이 되받아쳐서 몸이 선다.
    // 발이 공중이면 아무것도 받쳐주지 않으니 그대로 주저앉는다. (보이지 않는 줄에 매달려 있지 않다)
    // 몸 전체가 함께 가속되도록 힘을 골반과 상체에 무게 비율대로 나눈다
    // (골반만 밀면 막대 아래만 잡아당긴 것처럼 상체가 뒤로 젖혀진다)
    const chest = this.bodies.chest;
    const push = (fx, fy, fz) => {
      const up = BODY.upperShare; // 가슴(+머리·팔)이 몸무게에서 차지하는 비율
      pelvis.addForce({ x: fx * (1 - up), y: fy, z: fz * (1 - up) }, true);
      chest.addForce({ x: fx * up, y: 0, z: fz * up }, true);
      if (loadSum < 1e-3 || BODY.footReaction === 0) return;
      for (const [k, shin] of [['F', 'shinF'], ['B', 'shinB']]) {
        const w = load[k] / loadSum;
        const r = BODY.footReaction ?? 1;
        if (w > 0) this.bodies[shin].addForce({ x: -fx * w * r, y: -fy * w * r, z: -fz * w * r }, true);
      }
    };

    // 1) 체중 받치기 (다리를 펴는 힘)
    if (mus > 0.1 && loadSum > 0) {
      const h = BODY.standHeight - (1 - this.legHealth) * 0.1 - this.stanceDrop - this.crouch;
      let fy = M * g * BODY.support + BODY.supportStiffness * (h - p.y) - BODY.supportDamping * v.y;
      // 다친 다리는 힘을 못 쓴다 → 체중을 버틸 수 있는 한계
      const legPower = (load.F * this.limbs.legF + load.B * this.limbs.legB) / loadSum;
      fy = THREE.MathUtils.clamp(fy * mus, 0, M * g * (1.2 + 1.3 * legPower) * Math.min(1, loadSum * 1.5));
      if (p.y > h + 0.25) fy = 0;
      push(0, fy, 0);
    }

    // 2) 걷기: 딛고 있는 발로 땅을 밀어서 나아간다 (발이 떠 있으면 못 민다, 미끄러우면 미끄러진다)
    const dvx = want.x - v.x;
    const dvz = want.z - v.z;
    const grip = Math.min(1, loadSum * 1.5);
    const lim = M * BODY.maxAccel * grip; // 사람이 발로 낼 수 있는 가속에는 한계가 있다
    const fx = THREE.MathUtils.clamp(M * BODY.moveAccel * dvx, -lim, lim) * mus;
    const fz = THREE.MathUtils.clamp(M * BODY.moveAccel * dvz, -lim, lim) * mus;
    push(fx, 0, fz);

    // 3) 똑바로 서기: 주로 딛고 있는 다리의 엉덩이 관절이 골반을 세운다 (applyPose 참고).
    //    여기 "기준 막대"는 평형감각 정도의 약한 보조일 뿐이다.
    const vFwd = v.x * fwd.x + v.z * fwd.z;
    this.localVel.set(vFwd, v.x * rgt.x + v.z * rgt.z);
    this.anchor.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    // 가속하는 방향으로 몸을 숙인다 (달리기 출발처럼). 기울기 = atan(가속도 / 중력).
    // 발로 땅을 밀면 몸을 뒤로 넘기는 회전이 생기는데, 숙인 몸의 무게가 그걸 상쇄한다.
    const fh = Math.hypot(fx, fz);
    this.accelLean = this.accelLean || new THREE.Vector3();
    this.accelLean.lerp(_v5.set(fx, 0, fz), Math.min(1, dt * 10));
    const al = this.accelLean.length();
    let anchorQ = this.yaw;
    if (al > 1) {
      const ang = Math.atan(al / (M * g)) * BODY.accelLean;
      _axis2.set(this.accelLean.z / al, 0, -this.accelLean.x / al);
      anchorQ = _qt.setFromAxisAngle(_axis2, ang).multiply(this.yaw);
    }
    this.anchor.setNextKinematicRotation(vecQ(anchorQ));
    this.anchorUp = (this.anchorUp || new THREE.Vector3()).set(0, 1, 0).applyQuaternion(anchorQ);
    const hold = THREE.MathUtils.clamp(1 - this.offBalance / BALANCE.fallRange, 0.15, 1);
    const assist = BODY.uprightAssist * mus * hold * (0.3 + 0.7 * Math.min(1, loadSum));
    const raw = this.uprightJoint.rawSet;
    for (const ax of MOTOR_AXES) raw.jointConfigureMotorPosition(this.uprightJoint.handle, ax, 0, BODY.uprightStiffness * assist, BODY.uprightDamping * assist);
    // 걷는 방향으로 상체를 살짝 숙인다 (골반-가슴 관절 목표)
    this.lean = this.state === 'stand' ? THREE.MathUtils.clamp(-vFwd * 0.05, -0.12, 0.12) : 0;
  }

  // ── 진짜 균형 ──
  // 무게중심(CoM)의 속도까지 고려한 "캡처 포인트"(= 지금 속도로 몸이 멈추려면 발을 디뎌야 할 곳)를 구해서,
  // 그 점이 발 주변을 벗어나면 그쪽으로 발을 딛게 하고, 너무 멀면 넘어지게 한다.
  updateFooting(dt, fwd, rgt, want) {
    let M = 0;
    const com = _c1.set(0, 0, 0);
    const vel = _c2.set(0, 0, 0);
    for (const name in this.bodies) {
      const b = this.bodies[name];
      const m = b.mass();
      const c = b.worldCom();
      const v = b.linvel();
      com.x += c.x * m;
      com.y += c.y * m;
      com.z += c.z * m;
      vel.x += v.x * m;
      vel.z += v.z * m;
      M += m;
    }
    com.multiplyScalar(1 / M);
    vel.multiplyScalar(1 / M);
    this.com = this.com || new THREE.Vector3();
    this.com.copy(com);
    const w0 = Math.sqrt(9.81 / Math.max(0.5, com.y));
    const cpx = com.x + vel.x / w0;
    const cpz = com.z + vel.z / w0;
    // 걷는 중엔 무게중심이 발보다 앞서는 게 정상이다(다음 발로 받는다).
    // 그래서 가려는 방향으로 "다음 발을 디딜 자리"까지는 안전하다고 본다.
    const planX = (want.x / w0) * 1.3;
    const planZ = (want.z / w0) * 1.3;
    // 발바닥 위치 (땅에 닿은 발만)
    const a = this.solePoint('footF', _c3);
    const b = this.solePoint('footB', _c4);
    const ga = a.y < 0.09;
    const gb = b.y < 0.09;
    // 발마다 "체중을 받을 수 있는 정도": 땅에 닿아 있고(높이) 몸 아래에 있을수록(수평 거리) 크다
    const pp = this.bodies.pelvis.translation();
    const loadOf = (f) => {
      const grounded = THREE.MathUtils.clamp((0.16 - f.y) / 0.08, 0, 1);
      const under = THREE.MathUtils.clamp(1.3 - Math.hypot(f.x - pp.x, f.z - pp.z) / 0.7, 0, 1);
      return grounded * under;
    };
    const k = Math.min(1, dt * 25);
    this.footLoad.F += (loadOf(a) - this.footLoad.F) * k;
    this.footLoad.B += (loadOf(b) - this.footLoad.B) * k;
    const offFrom = (x, z) => {
      if (ga && gb) return distToSegment2D(x, z, a.x, a.z, b.x, b.z);
      if (ga || gb) {
        const f = ga ? a : b;
        return Math.hypot(x - f.x, z - f.z);
      }
      // 두 발 모두 떠 있으면 (걷는 중 잠깐) 골반 아래를 기준으로
      return Math.hypot(x - pp.x, z - pp.z) + 0.05;
    };
    // 지금 발 위치 기준과, 계획한 다음 발 위치 기준 중 더 가까운 쪽
    const off = Math.min(offFrom(cpx, cpz), offFrom(cpx - planX, cpz - planZ));
    this.offBalance = this.state === 'stand' ? Math.max(0, off - BALANCE.footMargin) : 0;
    if (this.offBalance > BALANCE.fallRange) this.offBalanceTime += dt;
    else this.offBalanceTime = Math.max(0, this.offBalanceTime - dt * 2);
    // 넘어지지 않으려고 캡처 포인트 쪽으로 딛는 걸음 (몸 기준 방향으로 변환)
    const s = THREE.MathUtils.clamp(this.offBalance / BALANCE.stumbleRange, 0, 1);
    if (s > 0) {
      const p = this.bodies.pelvis.translation();
      const dx = cpx - p.x;
      const dz = cpz - p.z;
      const len = Math.hypot(dx, dz) || 1;
      this.stumble.set(((dx * rgt.x + dz * rgt.z) / len) * s, ((dx * fwd.x + dz * fwd.z) / len) * s);
    } else this.stumble.set(0, 0);
  }

  /** 발바닥 한가운데의 월드 좌표 */
  solePoint(foot, out) {
    const t = this.bodies[foot].translation();
    rot(this.bodies[foot], _q1);
    return out.set(0, -0.035, 0).applyQuaternion(_q1).add(_v3.set(t.x, t.y, t.z));
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
    const legPose = (thigh, shin, foot, phase, stanceHip, stanceKnee) => {
      const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
      // 발을 막 디딘 순간(u가 1→0으로 넘어감) → 발소리/카메라 흔들림용 신호
      const prevU = this.prevU[thigh] ?? u;
      if (w > 0.5 && prevU > 0.8 && u < 0.2) this.footstep = Math.min(1, this.localVel.length() / BODY.moveSpeed);
      this.prevU[thigh] = u;
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
      // 딛고 있는 다리는 발이 땅에 붙어 있어서, 엉덩이 관절이 목표 각도를 맞추려 하면
      // 허벅지 대신 골반이 돌아간다 → 몸통을 세우는 힘의 반작용이 다리를 타고 땅으로 간다.
      const kneeAng = stanceKnee * (1 - w) - w * knee;
      J[shin].target.setFromAxisAngle(Z_AXIS, kneeAng);
      // 발목: 발바닥이 땅과 나란하도록 (엉덩이·무릎 굽힘을 되돌린다). 발을 들 땐 발끝을 살짝 든다
      const hipPitch = hip * d.x + stanceHip * (1 - 0.7 * w);
      J[foot].target.setFromAxisAngle(Z_AXIS, THREE.MathUtils.clamp(-(hipPitch + kneeAng) + 0.15 * lift, -0.6, 0.8));
      // 딛고 있는 다리: 비스듬할수록 엉덩이가 낮아진다 (다리 길이 0.85m)
      if (u < STANCE) drop = Math.max(drop, 0.85 * (1 - Math.cos(hip)) + 0.02 * w);
    };
    // 가만히 있을 때는 펜싱 자세(앞발/뒷발), 걸을 때는 번갈아 걷기
    legPose('thighF', 'shinF', 'footF', this.gaitPhase, 0.24, -0.22);
    legPose('thighB', 'shinB', 'footB', this.gaitPhase + Math.PI, -0.18, -0.14);
    // 절뚝거림: 다친 다리로 디딜 때 골반이 더 내려앉는다
    const uF = this.prevU.thighF ?? 0;
    const bad = uF < STANCE ? 1 - this.limbs.legF : 1 - this.limbs.legB;
    drop += bad * 0.08 * w;
    this.stanceDrop += (drop - this.stanceDrop) * Math.min(1, dt * 20);
    // 무릎 꿇기 자세 (앞다리는 세워 발을 딛고, 뒷다리는 무릎을 땅에)
    const kn = this.kneelAmount;
    if (kn > 0) {
      const K = (name, a) => J[name].target.slerp(_qk.setFromAxisAngle(Z_AXIS, a), kn);
      K('thighF', 1.25);
      K('shinF', -1.45);
      K('footF', 0.2);
      K('thighB', -0.15);
      K('shinB', -1.75);
      K('footB', 0.8); // 뒷발은 발끝으로 땅을 짚는다
    }
    const setZ = (name, a) => J[name].target.setFromAxisAngle(Z_AXIS, a);
    // 빈 손은 앞으로 들어 균형을 잡는다 (다친 팔은 힘없이 늘어진다)
    const armO = this.limbs.armO;
    setZ('uarmO', 0.5 * armO);
    setZ('farmO', 1.0 * armO);
    // (칼 든 팔은 driveSword의 역운동학이 정한다)
    // 척추: 걷는 방향으로 살짝 숙이고, 몸통을 다치면 웅크리고, 칼 든 손 쪽으로 허리를 튼다
    this.daze = Math.max(0, (this.daze || 0) - dt * 0.12);
    const gut = this.wounds.reduce((a, wd) => a + (wd.part === 'chest' || wd.part === 'abdomen' || wd.part === 'pelvis' ? wd.severity : 0), 0);
    const sk = this.skill;
    const bend = (this.lean || 0) - Math.min(0.45, gut * 0.3) - 0.2 * kn + sk.bend;
    // 손이 왼쪽이면 몸통도 왼쪽으로 + 휘두를 때는 허리가 먼저 돈다(검술 층)
    const twist = THREE.MathUtils.clamp(-sk.aim.x * 0.7 + sk.twist, -0.8, 0.8);
    const spine = (name, pitch, yaw) => J[name].target.setFromEuler(_eu.set(0, yaw, pitch, 'YXZ'));
    spine('abdomen', bend * 0.5, twist * 0.45);
    spine('chest', bend * 0.5, twist * 0.55);
    // 머리: 몸통이 틀어져도 상대를 본다. 멍하면 고개가 떨어진다
    spine('head', -0.35 * this.daze, -twist);
  }

  // 근육: 목표 자세로 관절을 돌린다. 모터는 물리 엔진이 한꺼번에 풀어서 떨리지 않는다.
  // 근력 한계: 목표를 "지금 자세 + (최대 회전력 / 강도)" 이내로만 잡는다 → 낼 수 있는 힘이 사람 수준으로 제한된다.
  driveJoints() {
    const legsMus = Math.max(0.15, this.muscle);
    const inv = this.lastDt > 0 ? 1 / this.lastDt : 0;
    for (const j of this.joints) {
      const n = j.name;
      const isLeg = n.startsWith('thigh') || n.startsWith('shin') || n.startsWith('foot');
      let mus = isLeg ? legsMus * (0.6 + 0.4 * this.legHealth) : Math.max(0.1, this.muscle);
      if (n === 'uarmO' || n === 'farmO') mus *= 0.15 + 0.85 * this.limbs.armO; // 다친 팔은 힘이 없다
      if (n === 'uarmS' || n === 'farmS') mus *= (0.3 + 0.7 * this.limbs.armS) * this.strength;
      if (n.endsWith('F') && isLeg) mus *= 0.4 + 0.6 * this.limbs.legF;
      if (n.endsWith('B') && isLeg) mus *= 0.4 + 0.6 * this.limbs.legB;
      const k = j.k * mus;
      const d = j.d * Math.sqrt(Math.max(0.05, mus));
      const maxErr = (j.max * mus) / Math.max(1, k); // 이 이상 벌어진 목표는 근력으로 못 따라간다
      // 물리 엔진은 관절 각도 오차를 "반각의 사인"(≈ 각도/2)으로 계산한다 → 강도·감쇠를 2배로 넘겨야 설계대로 작동한다
      const kE = 2 * k;
      const dE = 2 * d;
      if (j.manual) {
        this.manualMuscle(j, k, d, j.max * mus);
        continue;
      }
      // 목표와 현재 자세를 "관절 기준 자세"에서 잰 회전으로 바꾼다
      toRotVec(_qt2.copy(j.restInv).multiply(j.target), _rv);
      rot(j.parent, _qp);
      rot(j.child, _qc);
      toRotVec(_qt2.copy(j.restInv).multiply(_qp.invert().multiply(_qc)), _cur);
      // 목표가 움직이는 속도 (걸음처럼 계속 움직이는 목표를 뒤처지지 않게)
      const prev = j.prevRV || (j.prevRV = _rv.clone());
      const raw = j.joint.rawSet;
      if (j.type === 'hinge') {
        const tz = _cur.z + THREE.MathUtils.clamp(_rv.z - _cur.z, -maxErr, maxErr);
        const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);
        raw.jointConfigureMotor(j.joint.handle, HINGE_AXIS, tz, vz, kE, dE);
      } else {
        for (const [i, ax] of [[0, 'x'], [1, 'y'], [2, 'z']]) {
          const t = _cur[ax] + THREE.MathUtils.clamp(_rv[ax] - _cur[ax], -maxErr, maxErr);
          const v = THREE.MathUtils.clamp((_rv[ax] - prev[ax]) * inv, -15, 15);
          raw.jointConfigureMotor(j.joint.handle, MOTOR_AXES[i], t, v, kE, dE);
        }
      }
      prev.copy(_rv);
    }
  }

  /**
   * 직접 계산하는 근육 (큰 각도에서도 정확): 목표 자세와의 차이(쿼터니언)로 회전력을 만든다.
   * 뼈 길이 방향으로 비트는 축은 관성이 작아 세게 걸면 팽이처럼 돌기 때문에 약하게 따로 다룬다.
   */
  manualMuscle(j, k, d, maxT) {
    rot(j.parent, _qp);
    rot(j.child, _qc);
    _qt2.copy(_qp).multiply(j.target); // 목표 (월드)
    _qt2.multiply(_qc.clone().invert()); // 목표 × 현재⁻¹ = 남은 회전
    toRotVec(_qt2, _mE);
    const wc = j.child.angvel();
    const wp = j.parent.angvel();
    _mW.set(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z);
    const boneAxis = _mA.set(1, 0, 0).applyQuaternion(_qc); // 위팔 뼈 방향 (x)
    const eTw = _mE.dot(boneAxis);
    const wTw = _mW.dot(boneAxis);
    // 휘두르는 방향(뼈에 수직)
    _mT.copy(_mE).addScaledVector(boneAxis, -eTw).multiplyScalar(k);
    _mT.addScaledVector(_mW.clone().addScaledVector(boneAxis, -wTw), -d);
    if (_mT.length() > maxT) _mT.setLength(maxT);
    // 비틀기: 위팔 자체의 비틀림 관성은 ≈0.003kg·m²로 아주 작다 → 안정 한계(강도 ≤10, 감쇠 ≤0.2) 안에서만
    //  (엔진 쪽 회전 감쇠(팔 몸체 1.5)가 함께 잡아줘서 조금 더 세게 걸 수 있다)
    _mT.addScaledVector(boneAxis, THREE.MathUtils.clamp(eTw * 25 - wTw * 0.8, -12, 12));
    j.child.addTorque(vecArg(_mT), true);
    j.parent.addTorque({ x: -_mT.x, y: -_mT.y, z: -_mT.z }, true);
  }

  // ── 칼 조종: 팔 근육(어깨·팔꿈치)이 손을 목표로 옮기고, 손목 근육이 칼끝 방향을 맞춘다 ──
  //  예전처럼 손을 보이지 않는 줄로 끌지 않는다. 손이 갈 곳 → 어깨·팔꿈치 각도(역운동학, IK)를 계산해서
  //  관절 근육의 목표로 준다. 칼의 무게와 관성은 팔과 몸통이 그대로 버틴다.
  driveSword() {
    const sword = this.sword;
    const chest = this.bodies.chest;
    const mus = this.muscle;

    // 손 목표 위치: 가슴 앞 평면의 (좌우, 위아래) + 자동 깊이 (몸이 바라보는 방향 기준)
    const off = this.skill.aim; // 손 목표 (입력 + 검술 층의 이어 베기)
    const R = WEAPON.reach;
    // 가운데로 모을수록 팔을 앞으로 뻗는다 (찌르기는 가장자리→가운데로 옮기면 약 0.5m 내지른다)
    const depth = 0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (off.x * off.x + off.y * off.y) / (R * R)));
    const handLocal = _v2.set(Math.min(depth, this.closeReach()), 0.1 + off.y, 0.1 + off.x);
    const c = chest.translation();
    const target = this.handTarget.copy(handLocal).applyQuaternion(this.yaw).add(_v1.set(c.x, c.y, c.z));
    if (mus >= 0.12 && this.state !== 'dead') this.armIK(target);
    if (mus < 0.12 || !this.armed) return; // 쓰러지거나 칼을 놓치면 손목에 힘을 쓰지 않는다
    const str = this.strength * mus * (0.35 + 0.65 * this.armHealth);
    const forearm = this.bodies.farmS;

    // 칼끝 방향: 손 위치가 곧 검술의 자세(가드)다.
    //  가슴 높이 가운데 → 칼끝이 상대를 겨눔(찌르기 자세)
    //  머리 위로 올리면 → 칼이 서고 조금 뒤로 누움(위에서 내려베기 준비, "지붕 자세")
    //  옆으로 빼면     → 칼이 그쪽으로 누움(가로베기 준비)
    //  허리 아래로     → 칼끝이 내려감(아래 자세)
    // 자세에서 자세로 손을 옮기면 칼이 크게(최대 100° 넘게) 돌며 베기가 된다.
    const aim = _v3.set(...guardDir(off.x, off.y));
    aim.applyQuaternion(this.yaw);
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
    // 칼날 가운데쯤이 실제로 움직이는 방향 (손잡이 속도와 다르다: 칼은 손을 축으로 돈다)
    const bv = this.hitPointVel;
    const edgeDir = new THREE.Vector3(bv.x, bv.y, bv.z).addScaledVector(blade, -bv.dot(blade));
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
    // 날 세우기(손목 비틀기). 칼날 축 관성이 매우 작아 안정 한계(≈5) 안에서 최대한 세게
    const twist = new THREE.Vector3().crossVectors(flat, flatTarget).projectOnVector(blade).multiplyScalar(4);
    twist.addScaledVector(wTwist, -0.12);
    torque.add(twist);
    sword.addTorque(vecArg(torque), true);
    // 손목 근육의 반작용은 아래팔로 간다. 단, 아래팔 길이 방향으로 비트는 몫은
    // 아래팔이 너무 가늘어(관성이 작아) 받으면 팽이처럼 돈다 → 팔뚝 뼈(요골·척골)가 그러듯
    // 팔을 따라 몸통으로 넘긴다. 전체 반작용의 합은 그대로다.
    rot(forearm, _q2);
    const fa = _v4.set(1, 0, 0).applyQuaternion(_q2);
    const along = torque.dot(fa);
    forearm.addTorque({ x: -(torque.x - fa.x * along), y: -(torque.y - fa.y * along), z: -(torque.z - fa.z * along) }, true);
    chest.addTorque({ x: -fa.x * along, y: -fa.y * along, z: -fa.z * along }, true);
  }

  /**
   * 두 마디 팔 역운동학: 손(칼자루)이 target(월드)에 가도록 어깨·팔꿈치 목표 각도를 정한다.
   * 가슴 기준 좌표에서 계산하므로, 허리가 틀어져도 손은 목표를 향한다.
   */
  armIK(target) {
    const J = this.jointByName;
    const chest = this.bodies.chest;
    rot(chest, _q1);
    const c = chest.translation();
    const T = _ik1.set(target.x - c.x, target.y - c.y, target.z - c.z).applyQuaternion(_q2.copy(_q1).invert());
    const S = _ik2.set(0, 0.1, this.side * 0.2); // 어깨 (가슴 기준)
    const a = 0.3; // 위팔
    const b = 0.27; // 아래팔 + 손목까지
    const D = T.sub(S);
    const d = THREE.MathUtils.clamp(D.length(), 0.08, a + b - 0.005);
    const Dn = D.normalize();
    // 팔꿈치는 아래·뒤·바깥쪽을 향한다
    const pole = _ik3.set(-0.25, -1, this.side * 0.5).normalize();
    const pDir = pole.addScaledVector(Dn, -pole.dot(Dn));
    if (pDir.lengthSq() < 1e-6) pDir.set(0, -1, 0);
    pDir.normalize();
    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const u = _ik4.copy(Dn).multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha)); // 위팔 방향
    const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    // 위팔 몸체 좌표축: x = 위팔 방향(어깨→팔꿈치), y = 아래팔이 접히는 쪽, z = x × y (팔꿈치 경첩 축)
    const xA = _ik5.copy(u);
    const fore = _ik6.copy(Dn).multiplyScalar(d).sub(_ik7.copy(u).multiplyScalar(a)); // 팔꿈치 → 손
    const yA = fore.addScaledVector(u, -fore.dot(u));
    if (yA.lengthSq() < 1e-6) yA.set(0, 1, 0).addScaledVector(u, -u.y);
    yA.normalize();
    const zA = _ik7.crossVectors(xA, yA).normalize();
    _ikM.makeBasis(xA, yA, zA);
    J.uarmS.target.setFromRotationMatrix(_ikM);
    J.farmS.target.setFromAxisAngle(Z_AXIS, flex);
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

  /** 물리 스텝 직전의 상태를 JS 쪽에 복사해 둔다 (충돌 훅이 엔진을 건드리지 않고 계산하도록) */
  cacheState() {
    const c = (this.cache = this.cache || { parts: {} });
    const put = (b, o = {}) => {
      const t = b.translation();
      const r = b.rotation();
      const com = b.worldCom();
      const v = b.linvel();
      const w = b.angvel();
      o.p = (o.p || new THREE.Vector3()).set(t.x, t.y, t.z);
      o.q = (o.q || new THREE.Quaternion()).set(r.x, r.y, r.z, r.w);
      o.com = (o.com || new THREE.Vector3()).set(com.x, com.y, com.z);
      o.v = (o.v || new THREE.Vector3()).set(v.x, v.y, v.z);
      o.w = (o.w || new THREE.Vector3()).set(w.x, w.y, w.z);
      return o;
    };
    c.sword = put(this.sword, c.sword);
    for (const name in this.bodies) c.parts[name] = put(this.bodies[name], c.parts[name]);
  }

  syncMeshes() {
    // 피를 많이 흘리면 얼굴이 창백해진다
    if (this.faceMat) {
      const pale = THREE.MathUtils.clamp((1 - this.blood) / 0.5, 0, 1) * 0.7;
      this.faceMat.color.copy(this.skinColor).lerp(_paleColor, pale);
    }
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
      const main = addMesh(group, new THREE.BoxGeometry(0.21, 0.18, 0.33), mat(look.tunic));
      // 상의 치마 자락 (허벅지 위를 덮음)
      addMesh(group, new THREE.CylinderGeometry(0.17, 0.215, 0.26, 14, 1, true), mat(look.tunic, { side: THREE.DoubleSide }), [0, -0.12, 0]);
      return main;
    }
    case 'abdomen': {
      const main = addMesh(group, new THREE.BoxGeometry(0.22, 0.155, 0.32), mat(look.tunic));
      addMesh(group, new THREE.BoxGeometry(0.235, 0.04, 0.335), mat(look.belt), [0, -0.05, 0]);
      for (const x of [0.111, -0.111]) for (const z of [-0.1, 0, 0.1]) addMesh(group, new THREE.BoxGeometry(0.004, 0.15, 0.012), mat(look.quilt), [x, 0, z]);
      return main;
    }
    case 'chest': {
      const main = addMesh(group, new THREE.BoxGeometry(0.24, 0.28, 0.37), mat(look.tunic));
      // 누빔 줄무늬 (앞/뒤)
      for (const x of [0.121, -0.121]) {
        for (const z of [-0.11, 0, 0.11]) addMesh(group, new THREE.BoxGeometry(0.004, 0.27, 0.012), mat(look.quilt), [x, 0, z]);
      }
      // 옷깃
      addMesh(group, new THREE.CylinderGeometry(0.07, 0.085, 0.05, 12), mat(look.quilt), [0, 0.15, 0]);
      // 가죽 끈 X자 (앞/뒤)
      if (look.straps) {
        for (const x of [0.126, -0.126]) {
          for (const a of [0.7, -0.7]) addMesh(group, new THREE.BoxGeometry(0.006, 0.36, 0.035), mat(look.straps), [x, 0, 0], [a, 0, 0]);
        }
      }
      return main;
    }
    case 'footF':
    case 'footB':
      return addMesh(group, new THREE.BoxGeometry(0.25, 0.075, 0.11), mat(look.shoes));
    case 'head': {
      const face = addMesh(group, new THREE.SphereGeometry(s[1], 18, 14), mat(look.skin));
      const dark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
      for (const z of [-0.035, 0.035]) addMesh(group, new THREE.BoxGeometry(0.012, 0.015, 0.02), dark, [0.093, 0.016, z]);
      addMesh(group, new THREE.BoxGeometry(0.028, 0.032, 0.02), mat(look.skin), [0.102, -0.01, 0]);
      if (look.hair) {
        // 머리카락: 뒤통수와 정수리를 덮는 반구
        addMesh(group, new THREE.SphereGeometry(0.107, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(look.hair, { roughness: 1 }), [-0.011, 0.004, 0], [0, 0, 0.35]);
      }
      if (look.headband) addMesh(group, new THREE.CylinderGeometry(0.108, 0.108, 0.026, 18, 1, true), mat(look.headband), [0, 0.028, 0], [0, 0, 0.15]);
      if (look.helmet === 'kettle') {
        // 투구는 따로 묶어 둔다 → 세게 맞으면 통째로 벗겨져 날아간다
        const helm = new THREE.Group();
        const steel = mat(look.metal, { metalness: 0.75, roughness: 0.3 });
        addMesh(helm, new THREE.SphereGeometry(0.117, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), steel, [0, 0.018, 0]);
        // 넓은 챙 (아래로 살짝 퍼짐)
        addMesh(helm, new THREE.CylinderGeometry(0.123, 0.215, 0.046, 28, 1, true), new THREE.MeshStandardMaterial({ color: look.metal, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide }), [0, 0.0, 0]);
        // 정수리 능선
        addMesh(helm, new THREE.BoxGeometry(0.18, 0.023, 0.011), steel, [0, 0.128, 0], [0, 0, 0]);
        group.add(helm);
        group.userData.helmet = helm;
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
const HINGE_AXIS = 3; // 경첩 관절의 회전축은 엔진 안에서 첫 번째 회전축(AngX)으로 다룬다
const _cur = new THREE.Vector3();
const _q2 = new THREE.Quaternion();
const _ik1 = new THREE.Vector3();
const _ik2 = new THREE.Vector3();
const _ik3 = new THREE.Vector3();
const _ik4 = new THREE.Vector3();
const _ik5 = new THREE.Vector3();
const _ik6 = new THREE.Vector3();
const _ik7 = new THREE.Vector3();
const _ikM = new THREE.Matrix4();
const _qp = new THREE.Quaternion();
const _qc = new THREE.Quaternion();
const _qt2 = new THREE.Quaternion();
const _mE = new THREE.Vector3();
const _mW = new THREE.Vector3();
const _mA = new THREE.Vector3();
const _mT = new THREE.Vector3();
const IDENTITY_Q = new THREE.Quaternion();
const ALONG_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); // 세로(y) 뼈 → 앞(x)으로 눕힘

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
const _qk = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _bloodColor = new THREE.Color(0x5a0808);
const _paleColor = new THREE.Color(0xb8b4a8);
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _axis2 = new THREE.Vector3();
const _qt = new THREE.Quaternion();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();

/** 점 (px,pz) 에서 선분 (ax,az)-(bx,bz) 까지 거리 (수평면) */
function distToSegment2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
const _axis = new THREE.Vector3();
const _v2d = new THREE.Vector2();
