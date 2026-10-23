// ─────────────────────────────────────────────────────────────
//  드루이드의 채찍 (??? 등급 — 샛별 저장소 커밋 69ef7dac8 에서 들여옴, 10/23 · docs/import/druid_whip_2026-10-23.md)
//
//  단단한 손잡이 하나(칼 몸체 = fighter.sword) + 마디 8 개 덩굴. 마디는 저마다 강체이고 구면 관절로 줄줄이 이어져
//  무게 · 중력 · 접촉과 작은 굽힘 복원력으로 늘어지고 휘어진다 — 단단한 칼을 숨겨 두고 겉모습만 휘는 것이 아니다.
//  치수는 게임값(창작)이고 겉모습과 콜라이더가 같은 수를 쓴다. 치수 · 모양은 샛별 값 그대로, 덩굴 물리 · 손잡이 서보 · 톡 다섯 가지는 10/23 검수로 고침(아래 WHIP_NOW).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// grip 손잡이(덩굴 시작까지) · lash 덩굴 길이 · count 마디 수 · mass 전체 질량 · handleMass 손잡이 + 끝 공 · tipWeight 끝 두 마디에 더한 무게(kg)
export const DRUID = Object.freeze({ grip: .26, lash: 1.44, count: 8, mass: .77, handleMass: .21, tipWeight: .12 });
// 덩굴 물리 값. SRC = 샛별 값 그대로(`?whip=src` 로 견줌) · NOW = 10/23 검수 뒤 지금 값(확인표 2224 ~ 2229 · 2273 '사장님 확인 전' — 잰 값은 docs/import/druid_whip_2026-10-23.md §5)
//  tip: 끝 두 마디에 더한 무게(kg — 합 질량 DRUID.mass 는 그대로, 나머지 줄 몫에서 뺀다) · tipSplit: 그 무게를 [끝에서 둘째, 끝] 마디에 나누는 몫 · taper: 마디 1 ~ 8 의 줄 질량 비
//  bend: 굽힘 용수철 N·m/rad — 관절 i(0 = 손잡이 ~ 마디 1) 의 굳기 = k[i] + fold × max(0, .5 − cos 꺾인 각) (샛별 값 k[i] = .035 × (1 − i/10) + (i < 2 ? .08 : .025))
//  bendDamp: 굽힘 감쇠 1/s — 관절 양쪽 몸의 상대 굽힘 빠르기를 줄이는 몫(엮은 줄기의 속 마찰 · 0 = 없음)
//  angDamp · linDamp: 마디 회전 · 이동 감쇠(공기) · friction · restitution: 마디 마찰 · 반발 · armAssist: 마디로 친 몫의 팔 보조 질량(kg — combat.js)
//  iters: 마디 몸의 덧 풀이 횟수(엔진 additionalSolverIterations — 마디가 든 섬, 곧 칼 주인 몸 전체에 걸린다)
//  bladeFrom: 이 번호(0 = 마디 1)부터의 마디만 상대 칼과 부딪힌다(그 앞 마디는 상대 칼을 지나간다 — 상대 몸 · 땅 · 장애물과는 그대로) · 0 = 모두(샛별 값)
//  servo: 손잡이 손목 서보(weapons.js controlOverrides 와 같은 칸 — fighter.weaponCfg 에 덮는다) · flick: 톡 = 손목 튕기기(아래 WHIP_FLICK — 샛별 판은 보통 탭 찌르기)
export const WHIP_SRC = Object.freeze({
  tip: .12, tipSplit: [.25, .75], taper: [1.8, 1.65, 1.5, 1.35, 1.2, 1.05, .9, .75],
  bend: { k: Array.from({ length: 8 }, (_, i) => .035 * (1 - i / 10) + (i < 2 ? .08 : .025)), fold: .12 },
  bendDamp: Array(8).fill(0), angDamp: .15, linDamp: .15, friction: .65, restitution: .08, armAssist: .12, iters: 8, bladeFrom: 0,
  servo: { aimStiffness: 24, aimDamping: 1.2, releaseDamping: .6, maxAimTorque: 10, twistScale: .08 }, flick: false,
});
// 10/23 검수 (사장님 '채찍은 너가 검수해서 다 낫게 고쳐봐') — 바꾼 다섯, 나머지는 샛별 값 그대로 (잰 값: tools/sim/druid_whip.mjs · docs/import/druid_whip_2026-10-23.md §5):
//  ① iters 8 → 1: 덧 풀이가 굽힘 용수철(바깥 회전력)과 겹치면 덩굴이 에너지를 얻었다 — 손잡이를 고정한 덩굴의 운동 에너지가 10 초에 1.7 → 5.7 J 로 늘었고(용수철을 끄면 잦아듦),
//     덧 풀이가 칼 주인 몸 전체(같은 섬)에 걸려 다른 무기를 든 몸과 풀이가 달랐다. 1 이면(③ 과 함께) 잦아들고 마디 벌어짐은 AI 판에서도 2 cm 안(0 은 3.9 cm)
//  ② servo 24 · 1.2 · .6 → 10 · .2 · .1: 덩굴을 떼어 낸 손잡이(0.21 kg)는 손목 기준 관성이 약 0.0011 kg·m² 뿐이라 감쇠 × dt ÷ 관성이 2 를 넘어(1.2 → 9)
//     서보가 상한에서 튀었다 — 쉬는 자세에서 손잡이가 평균 25 rad/s 로 떨며 덩굴을 쉬지 않고 흔들었다(가만히 있어도 앞 상대를 쳤다)
//  ③ bendDamp 0 → 8 /s: 쉬는 자세 · 휘두른 뒤 덩굴이 오래 휘청이지 않게. 20 은 엔진에서 튀어(두 몸의 실제 짝 관성이 셈보다 작다) 넉넉히 아래
//  ④ tip .12 → .06: 끝을 조금 가볍게 — 끝이 손잡이 끝보다 빨라지는 몫(채찍 꼴 '끝에서 터짐')을 키움. 덜어 낸 60 g 은 줄 몫(taper)으로 — 합 770 g 그대로
//  ⑤ flick: 톡을 손목 튕기기로(아래 WHIP_FLICK)
//  다 합쳐(샛별 → 지금): 쉬는 자세 손잡이 떨림 25 → 1.5 rad/s · 끝 빠르기 3.8 → 0.4 m/s · 긋기 끝 ÷ 손잡이 끝 빠르기 2.5 → 3.2 · 되풀이 휘두르기 앞 도달 0.83 ~ 1.15 → 1.24 ~ 1.42 m
//  ⑥ bladeFrom 0 → 3 (10/23 셋째 일 — 사장님 '(가)와 둔타계수 올리기?' · 확인표 2273 — 사장님 확인 전): 손 쪽 마디 1 ~ 3(덩굴 0.54 m)은 상대 칼을 지나가고 마디 4 ~ 8 은 그대로 부딪힌다.
//     잰 값(tools/sim/whip_duel.mjs --stand=contact · 인물 여섯 × 시드 여섯): 채찍이 닿는 간격(1.25 m)에 서도 상대 칼이 덩굴 길 한가운데에 있어 획의 88 % 가 칼에 닿고
//     판당 7.3 s 붙어 있었다(칼 닿음 시간의 56 % 가 마디 1 ~ 3). 마찰 0.3 · 0.2 는 붙은 시간 5.5 · 5.7 s · 몸 닿을 기회 획 49 · 44 % 로 모자랐고, 3 이면 칼 닿은 획 54 % · 1.3 s · 몸 닿을 기회 44 → 53 %
//     (2 = 42 % · 4 = 52 % · 5 = 54 % — 3 위로는 늘지 않음). 마찰 · 반지름 · 굽힘 용수철 · 몸 · 땅과의 닿음은 그대로
export const WHIP_NOW = Object.freeze({
  ...WHIP_SRC, iters: 1, bendDamp: Array(8).fill(8), tip: .06, bladeFrom: 3,
  servo: { aimStiffness: 10, aimDamping: .2, releaseDamping: .1, maxAimTorque: 10, twistScale: .08 }, flick: true,
});
const copyWhip = (P) => ({ ...P, bend: { ...P.bend, k: [...P.bend.k] }, bendDamp: [...P.bendDamp], tipSplit: [...P.tipSplit], taper: [...P.taper], servo: { ...P.servo } });
export const WHIP = copyWhip(WHIP_NOW);
/** 덩굴 값 판 고르기 ('src' = 샛별 값 · 그 밖 = 지금 기본) — fighter 를 만들기 전에 부른다 (main.js `?whip=src`) */
export function setWhipPreset(name) {
  Object.assign(WHIP, copyWhip(name === 'src' ? WHIP_SRC : WHIP_NOW));
}

// 톡 = 손목 튕기기 (10/23 검수 — 사람 몫만, AI 는 톡 찌르기를 칼끝 무기에만 쓴다): 채찍은 찌를 끝이 없어 탭 찌르기(손을 칼 선으로 뻗기)가 늘어진 덩굴을 앞으로 조금 밀 뿐이었다
//  (끝 빠르기 1.2 m/s). 그래서 휘는 무기의 탭(쓰러진 상대 마무리가 아닐 때)은 손가락으로 짧게 올렸다 내려 긋는 것과 같은 손 길 — 패드에서 지금 손 → 위로 up 까지 rise s →
//  아래 down 까지 snap s — 을 손 목표에 그린다. 힘은 늘 손 · 팔 서보로만(긋기와 같은 길 · 덧힘 없음). 값은 사장님 확인 전(확인표 2229)
export const WHIP_FLICK = { up: 0.5, down: -0.45, rise: 0.14, snap: 0.12 };
/** 튕기기 시작 (skill.thrust 가 휘는 무기 · 마무리 아님일 때 부른다) */
export function startFlick(skill) {
  const o = skill.f.handOffset;
  skill.flick = { t: 0, x: o.x, y: o.y };
  if (skill.f.flexWeapon) { skill.f.flexWeapon.strokes++; skill.strokeOn = true; } // 톡도 한 획 (무릎 꿇리기 — combat.js whipKneelCheck · 튕기는 손 길이 다시 세지 않게)
  return true;
}
/** 튕기기 한 스텝 (skill.update 앞머리): 손 목표(handOffset)를 길대로 옮기고 손가락이 닿아 움직이는 것처럼 알린다. 끝나면 놓는다 */
export function flickDrive(skill, dt) {
  const F = WHIP_FLICK, k = skill.flick, f = skill.f;
  k.t += dt;
  if (k.t >= F.rise + F.snap) { skill.flick = null; f.handHeld = false; f.inputActive = false; return; }
  const top = [k.x * 0.5, F.up]; // 올릴 때 손을 몸 가운데 쪽으로 반쯤 (머리 위에서 내려 긋는 꼴)
  if (k.t < F.rise) { const u = k.t / F.rise; f.handOffset.set(k.x + (top[0] - k.x) * u, k.y + (top[1] - k.y) * u); }
  else { const u = (k.t - F.rise) / F.snap; f.handOffset.set(top[0], top[1] + (F.down - top[1]) * u); }
  f.handHeld = true;
  f.inputActive = true;
}

const Y = new THREE.Vector3(0, 1, 0);
const palette = [0x69704a, 0xa59a70, 0x67533c];
/** 몸체 자료 (weapons.js buildParts 꼴): [손잡이 상자, 끝 공, 마디 8 개]. 마디는 isBlade = true (fighter 가 마디 강체로 옮겨 단다) */
export function druidParts() {
  const out = [
    [['box', .023, .13, .023], 0, [.18, 0, .00105, .000065], null, false],
    [['ball', .025], -.135, [.03, 0, .0000075, .0000075], null, false],
  ];
  const L = DRUID.lash / DRUID.count;
  const weights = WHIP.taper;
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < DRUID.count; i++) {
    // 줄 몫은 taper 비로 나누고, 더한 끝 무게(WHIP.tip)는 마지막 두 마디에 모은다(tipSplit)
    const added = i === 7 ? WHIP.tip * WHIP.tipSplit[1] : i === 6 ? WHIP.tip * WHIP.tipSplit[0] : 0;
    const m = (DRUID.mass - DRUID.handleMass - WHIP.tip) * weights[i] / sum + added;
    const r = i === 7 ? .024 : i === 6 ? .012 : .022 - .016 * i / (DRUID.count - 1);
    out.push([['box', r, L / 2, r], .13 + (i + .5) * L,
      [m, 0, m * (L * L + 4 * r * r) / 12, m * r * r * 2 / 3], null, true]);
  }
  return out;
}

// 이어진 세 가닥 꼬임 메쉬 하나 — 물리 관절 자리를 따라 같은 메쉬를 휜다(숨긴 곧은 칼 위에 늘어진 그림을 얹지 않는다)
export function makeBraid(steps = 72) {
  const sides = 5, vertices = 3 * (steps + 1) * sides;
  const p = new Float32Array(vertices * 3), colors = new Float32Array(vertices * 3), indices = [];
  for (let s = 0; s < 3; s++) {
    const color = new THREE.Color(palette[s]);
    for (let j = 0; j <= steps; j++) for (let k = 0; k < sides; k++) {
      const i = (s * (steps + 1) + j) * sides + k;
      color.toArray(colors, i * 3);
      if (j < steps) { const b = i - k + (k + 1) % sides; indices.push(i, b, i + sides, b, b + sides, i + sides); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .94, metalness: 0 }));
  mesh.castShadow = true; mesh.frustumCulled = false;
  const point = new THREE.Vector3(), tangent = new THREE.Vector3(), n = new THREE.Vector3(), bin = new THREE.Vector3();
  mesh.userData.bend = (points, start = 0, end = 1, handle = false) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, along = start + t * (end - start);
      curve.getPoint(t, point); curve.getTangent(t, tangent).normalize();
      n.set(0, 0, 1); if (Math.abs(n.dot(tangent)) > .95) n.set(1, 0, 0);
      n.addScaledVector(tangent, -n.dot(tangent)).normalize(); bin.crossVectors(tangent, n).normalize();
      // 끝에 묶은 굵은 매듭: 모인 끝 무게가 눈에 읽히게 끝쪽을 두껍게
      const bundle = Math.max(0, Math.min(1, (along - .76) / .14));
      const tipRound = along > .97 ? 1 - .35 * (along - .97) / .03 : 1;
      const radius = handle ? .0195 : (.022 * (1 - .76 * along) + .018 * bundle) * tipRound;
      for (let s = 0; s < 3; s++) {
        const a = (handle ? t * 5 : along * 21) * Math.PI * 2 + s * Math.PI * 2 / 3;
        for (let k = 0; k < sides; k++) {
          const b = k / sides * Math.PI * 2;
          const x = radius * (.60 * Math.cos(a) + .41 * Math.cos(b));
          const z = radius * (.60 * Math.sin(a) + .41 * Math.sin(b));
          const i = ((s * (steps + 1) + j) * sides + k) * 3;
          p[i] = point.x + n.x * x + bin.x * z;
          p[i + 1] = point.y + n.y * x + bin.y * z;
          p[i + 2] = point.z + n.z * x + bin.z * z;
        }
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  };
  return mesh;
}

/** 겉모습 (weapons.js decorate): 꼰 손잡이 · 덩굴(처음엔 늘어진 꼴 — 물리 마디가 붙으면 sync 가 다시 휜다) · 수피 감개 넷 · 잎 두 장 */
export function drawDruidWhip(group) {
  const grip = makeBraid(22);
  grip.userData.bend([new THREE.Vector3(0, -.15, 0), new THREE.Vector3(0, .13, 0)], 0, 1, true);
  group.add(grip);
  const lash = makeBraid();
  lash.name = 'druid-lash';
  lash.userData.bend([new THREE.Vector3(0, .13, 0), new THREE.Vector3(.04, .55, 0), new THREE.Vector3(-.09, 1.0, 0), new THREE.Vector3(.14, 1.55, 0)]);
  group.add(lash); group.userData.bladeMesh = lash;
  const bark = new THREE.MeshStandardMaterial({ color: 0x6d573d, roughness: 1 });
  for (const y of [-.12, -.10, .095, .115]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.022, .003, 4, 9), bark);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  }
  for (const side of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, side*.035,.025,.008, side*.065,.075,0, side*.022,.057,-.006], 3));
    geo.setIndex([0,1,2,0,2,3]); geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: side > 0 ? 0x7f8650 : 0x596943, side: THREE.DoubleSide, roughness: 1 }));
    leaf.position.y = .09; group.add(leaf);
  }
}

/**
 * 칼 몸체(손잡이)에 붙어 만들어진 마디 콜라이더 8 개를 떼어 마디 강체 8 개로 옮기고 구면 관절로 잇는다 (fighter.js 생성자 — spec.flexible).
 *  ownTorsoBit: 제 몸통 · 허벅지 충돌 비트(BODY.humanLimits). 단단한 손잡이는 사람 관절 · 몸 한계를 그대로 지키고,
 *  휘는 덩굴만 제 몸에서 빼 준다 — 마찰 있는 마디가 제 몸에 감겨 다시 휘두르지 못하던 것(샛별 749a7b367). 상대 몸 · 땅 · 장애물 비트는 그대로 · 상대 무기 비트(foeWeaponBit)는 WHIP.bladeFrom 번 마디부터만.
 *  돌려줌 flex: step(dt) 굽힘 복원 · cache(put) 스텝 전 상태 · point(t, out) 덩굴 위 한 점 · sync() 메쉬 휨
 */
export function attachDruidWhip(f, ownTorsoBit, foeWeaponBit = 0) {
  const R = f.R, world = f.world, root = f.sword;
  Object.assign(f.weaponCfg, WHIP.servo); // 손잡이 서보 (판 고르기 — 기본은 weapons.js controlOverrides 와 같은 값)
  const parts = f.weapon.buildParts({}), L = DRUID.lash / DRUID.count;
  const p0 = new THREE.Vector3().copy(root.translation()), q0 = new THREE.Quaternion().copy(root.rotation());
  const segments = [], joints = [];
  let previous = root;
  for (let i = 0; i < DRUID.count; i++) {
    const part = parts[i + 2], old = f.swordColliders[i + 2];
    const groups = old.collisionGroups() & ~ownTorsoBit & ~(i < WHIP.bladeFrom ? foeWeaponBit : 0);
    f.colliderInfo.delete(old.handle); world.removeCollider(old, true);
    const pos = new THREE.Vector3(0, part[1], 0).applyQuaternion(q0).add(p0);
    const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(q0)
      .setAngularDamping(WHIP.angDamp).setLinearDamping(WHIP.linDamp).setAdditionalSolverIterations(WHIP.iters).setSoftCcdPrediction(.12));
    const [m, , Ie, It] = part[2];
    const col = world.createCollider(R.ColliderDesc.cuboid(part[0][1], L / 2, part[0][3])
      .setMassProperties(m, { x: 0, y: 0, z: 0 }, { x: Ie, y: It, z: Ie }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(WHIP.friction).setRestitution(WHIP.restitution).setCollisionGroups(groups)
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.1), body);
    const state = {};
    // 접촉 기록(combat.js): 이 마디의 스텝 전 상태(state) · 질량 · 관성(props)으로 둔타를 셈 · flexible = 팔 보조 질량 0.12 · 되튐 없음
    const info = { fighter: f, kind: 'weapon', part: 'blade', body, flexible: true, armAssist: WHIP.armAssist, state,
      props: { m, I: { x: Ie, y: It, z: Ie }, frame: new THREE.Quaternion() } };
    f.colliderInfo.set(col.handle, info);
    f.swordColliders[i + 2] = col; f.bladeColliders[i] = col;
    const joint = world.createImpulseJoint(R.JointData.spherical({ x: 0, y: i === 0 ? .13 : L / 2, z: 0 }, { x: 0, y: -L / 2, z: 0 }), previous, body, true);
    joint.setContactsEnabled(false); joints.push(joint);
    const group = new THREE.Group(); f.scene.add(group); f.meshes.push({ rb: body, group, kind: 'weapon-flex' });
    segments.push({ body, col, state, info, group }); previous = body;
  }
  root.recomputeMassPropertiesFromColliders();
  const flex = { segments, joints, active: DRUID.count, L, flick: WHIP.flick, strokes: 0, rolled: 0 }; // strokes · rolled: 획 수 · 무릎 꿇리기를 굴린 획 (combat.js)
  const lash = f.swordGroup.userData.bladeMesh;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), torque = new THREE.Vector3();
  const K = [...WHIP.bend.k], fold = WHIP.bend.fold; // 이 몸이 만들어질 때의 값 (판 도중에 바꾸지 않는다)
  // 굽힘 감쇠: 관절 양쪽 몸의 상대 회전 빠르기 × (감쇠 1/s × 두 몸의 줄인 관성) 을 크기 같고 방향 반대로 — 상대 회전만 줄고 덩굴 전체의 휘두름 운동량은 그대로
  //  (줄인 관성으로 곱해 한 스텝에 줄이는 몫 = 감쇠 × dt — 마디 질량이 달라도 같은 빠르기로 잦아든다)
  const BD = WHIP.bendDamp.some((x) => x > 0) ? [...WHIP.bendDamp] : null;
  const rootI = root.principalInertia(), Iroot = Math.max(rootI.x, rootI.z);
  const Ired = segments.map((sg, i) => { const ic = parts[i + 2][2][2], ip = i ? parts[i + 1][2][2] : Iroot; return 1 / (1 / ic + 1 / ip); });
  const rel = new THREE.Vector3();
  flex.step = dt => {
    for (let i = 0; i < segments.length; i++) {
      const parent = i === 0 ? root : segments[i - 1].body, child = segments[i].body;
      qa.copy(parent.rotation()); qb.copy(child.rotation());
      a.copy(Y).applyQuaternion(qa); b.copy(Y).applyQuaternion(qb);
      // 뿌리 쪽을 단단히 해 다음 손짓을 실어 나르고, 많이 꺾일수록 세지는 굽힘 용수철이 접힌 줄을 풀어 준다(덩굴 전체가 막대가 되지는 않게).
      //  관절 양쪽에 크기가 같고 방향이 반대인 회전력만 — 순간이동 · 겨눔 고정 · 끝 덧힘 없음
      const folded = Math.max(0, .5 - a.dot(b));
      const stiffness = K[i] + folded * fold;
      torque.crossVectors(b, a).multiplyScalar(stiffness);
      child.addTorque(torque, true); parent.addTorque({ x: -torque.x, y: -torque.y, z: -torque.z }, true);
      if (BD) {
        const wc = child.angvel(), wp = parent.angvel();
        rel.set(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z);
        rel.addScaledVector(b, -rel.dot(b)).multiplyScalar(-BD[i] * Ired[i]); // 굽힘 몫만 (줄 축 비틀림은 관성이 아주 작아 건드리지 않는다)
        child.addTorque(rel, true); parent.addTorque({ x: -rel.x, y: -rel.y, z: -rel.z }, true);
      }
    }
  };
  flex.cache = put => { for (const s of segments) put(s.body, s.state); };
  flex.point = (t, out) => {
    const u = THREE.MathUtils.clamp(t, 0, 1) * flex.active;
    const i = Math.min(flex.active - 1, Math.floor(u));
    const body = segments[i].body;
    return out.set(0, (u - i - .5) * L, 0).applyQuaternion(qb.copy(body.rotation())).add(a.copy(body.translation()));
  };
  const inv = new THREE.Matrix4(), points = [];
  flex.sync = () => {
    f.swordGroup.updateMatrixWorld(true); inv.copy(f.swordGroup.matrixWorld).invert(); points.length = 0;
    points.push(new THREE.Vector3(0, .13, 0));
    for (let i = 0; i < flex.active; i++) points.push(new THREE.Vector3(0, L / 2, 0).applyQuaternion(qb.copy(segments[i].body.rotation())).add(a.copy(segments[i].body.translation())).applyMatrix4(inv));
    lash.userData.bend(points, 0, flex.active / DRUID.count);
  };
  return flex;
}
