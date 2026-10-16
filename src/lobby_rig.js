// 대기실 캐릭터 몸 (사장님 10/16 08:4x '캐릭터가 동작을 보여줄 수 있게 하려면 무기 장착도 정교해져야 돼. 지금 나뭇가지 장착해보면 전투 때 모습과 달라.'
//  — docs/import/ui_fix_2026-10-16.md §6): 싸움과 **같은 Fighter** 를 따로 된 작은 물리 세계(바닥 하나 · 상대 없음)에 세워, 판에서 가만히 선 몸이 되는 때까지만 돌린다.
//  쥠(아래팔 끝 공 관절 (0.13, 0, 0))·칼 몸·주먹(hands.js 쥠 α·β·θ · 두손 무기 빈손)·자세표·서보·걸음(판 시작 발 묶임 뒤 자세 고쳐 딛기)이 판 그 코드라 겨눈 모습이 판의 그것과 같다
//  (tools/sim/lobby_rig_probe.mjs — 같은 때 판의 플레이어와 몸 부위·칼끝 0.5 cm 안).
//  · 물리는 무기·책이 바뀌어 자세를 새로 잡을 때만(RIG.settle 초 — 화면 한 장에 RIG.budget ms 까지 나눠 돌림) · 선 뒤로는 물리도 그리기도 없다
//  · 잡은 자세는 이번 실행 동안 기억한다(snapshot · restore — 같은 무기·책이면 대기실을 다시 열어도 바로)
//  · 맨손(장착 없음)은 물리 없이 만든 그대로의 몸에서 칼팔만 내린다(전 미리보기와 같은 꼴 — 무기가 없으면 싸움은 카드로 고른다)
//  · 나중 '동작 재생'(같은 문서 §7): 이 몸에 손 목표를 먹이며 step 을 돌리면 판과 같은 움직임이 나온다(물리는 그동안만)
//  · 게임의 물리 세계 · 판 · 난수 순서는 건드리지 않는다: 세계가 따로 · 파손 굴림 씨앗을 넘김(Fighter._breakCount 안 셈) · 겉모습 난수는 원래 따로(isolatedVisual)
import * as THREE from 'three';
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { attachHands } from './hands.js';
import { Combat } from './combat.js';
import { PHYSICS, ARENA } from './config.js';
import { setSupportFloor } from './gait.js';

// 값 (사장님 확인 전 — 확인표 1935): settle = 자세를 잡는 시간(판의 시작 발 묶임 hold 초 + 발을 고쳐 딛고 서는 때까지 — 나뭇가지 · 롱소드 · 츠바이핸더가
//  6 s 면 0.1 s 동안 칼끝 1 mm 안으로 선다, tools/sim/lobby_rig_probe.mjs) · hold = 시뮬 도구의 판 시작 발 묶임(config ARENA.startHold 2.0 — 브라우저 판은 무대 훑기 길이로
//  바뀌는 값이라 여기선 고정) · budget = 화면 한 장에 물리를 돌리는 시간(ms — 폰에서 화면이 멎지 않게 나눔) · faceAt = 바라보는 곳(앞 +x 멀리 — 판 첫 자리에서 상대 골반 쪽)
export const RIG = Object.freeze({ settle: 6, hold: 2, budget: 8, faceAt: Object.freeze({ x: 20, y: 1, z: 0 }) });
const STEPS = Math.round(RIG.settle / PHYSICS.timestep);
const _up = new THREE.Vector3(0, 1, 0);

/**
 * RAPIER: 초기화된 물리 모듈 (게임이 넘긴다) · parent: 몸 메쉬를 붙일 THREE 묶음 · spec: main.js lobbyRigSpec — 플레이어 판과 같은 값
 *  { look, weapon(무기 id — null 이면 맨손), schoolFootwork, schoolParry, skill: { level, corr, corrTip, autoGuard } }
 *  돌려줌 { fighter, armed, settled, step(n), settle(budgetMs), snapshot(), restore(s), pelvis(), dispose() }
 */
export function createLobbyRig(RAPIER, parent, spec) {
  const armed = !!spec.weapon;
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6; // 게임 판과 같은 값 (main.js newRound)
  const queue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(4, 0.5, 4).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor); // 발 체중 받침 = 이 바닥 (세계마다 따로 — gait.js)
  const fighter = new Fighter(RAPIER, world, parent, colliderInfo, {
    index: 0, name: spec.name ?? '나', x: 0, heading: 0, look: spec.look,
    weapon: spec.weapon || undefined, schoolFootwork: spec.schoolFootwork, schoolParry: spec.schoolParry,
    breakSeed: 1, // 파손 굴림 씨앗을 넘긴다 — 게임 판이 쓰는 '몇 번째 싸움꾼' 셈(Fighter._breakCount)을 늘리지 않게
  });
  Object.assign(fighter.skill, spec.skill ?? {}); // 판의 플레이어와 같은 검술 층 값 (main.js newRound)
  fighter.faceTarget = RIG.faceAt;
  fighter.fightT = ARENA.startHold - RIG.hold; // 발 묶임 = RIG.hold 초 (fighter.feetHeld 가 읽는 ARENA.startHold 는 브라우저 판이 무대마다 바꾼다)
  const combat = new Combat(colliderInfo, { onWound() {}, onClash() {} }); // 칼날 접촉 훅도 판과 같게 (상대가 없어 상처는 안 난다)
  let steps = 0;
  if (!armed) {
    fighter.armed = false; // 맨손: 두 손 모두 편 손(hands.js — 칼을 놓친 손과 같은 꼴) · 칼은 숨김
    fighter.meshes.find((m) => m.kind === 'weapon').group.visible = false;
  }
  const hands = attachHands(fighter);
  const show = () => { fighter.syncMeshes(); hands?.update(); };
  show();
  if (!armed) dropSwordArm(fighter);
  const rig = {
    fighter,
    armed,
    get settled() { return !armed || steps >= STEPS; },
    get time() { return steps * PHYSICS.timestep; },
    /** 물리 n 스텝 (판의 한 스텝과 같은 차례: 몸 → 상태 저장 → 세계 → 칼 접촉) 뒤 겉모습을 몸에 맞춘다 */
    step(n = 1) {
      if (!armed) return;
      for (let i = 0; i < n; i++) {
        fighter.step(PHYSICS.timestep);
        fighter.cacheState();
        world.step(queue, combat.physicsHooks);
        combat.afterStep(world, queue);
        steps++;
      }
      show();
    },
    /** 자세 잡기를 조금 (budget ms 까지) — 다 잡았으면 true */
    settle(budget = RIG.budget) {
      const t0 = performance.now();
      while (!rig.settled && performance.now() - t0 < budget) rig.step(Math.min(8, STEPS - steps));
      return rig.settled;
    },
    /** 잡은 자세 (몸·칼의 자리·돌림 · 바라보는 각 · 두 손 쥠) — 같은 spec 의 새 몸에 restore 로 (걸음·검술 층의 속 상태는 안 담음 — 보이기용) */
    snapshot() {
      return { steps, heading: fighter.heading, gripping: !!fighter.gripping, bodies: fighter.meshes.map(({ rb }) => { const t = rb.translation(), r = rb.rotation(); return [t.x, t.y, t.z, r.x, r.y, r.z, r.w]; }) };
    },
    restore(s) {
      if (!armed || s.bodies.length !== fighter.meshes.length) return false;
      fighter.meshes.forEach(({ rb }, i) => {
        const [x, y, z, qx, qy, qz, qw] = s.bodies[i];
        rb.setTranslation({ x, y, z }, false); rb.setRotation({ x: qx, y: qy, z: qz, w: qw }, false);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, false); rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      });
      fighter.gripping = s.gripping;
      fighter.heading = s.heading; fighter.yaw.setFromAxisAngle(_up, s.heading); // 몸 틀 (fighter.updateHeading 과 같은 셈)
      steps = s.steps;
      show();
      return true;
    },
    /** 골반 자리 (돌림판 축) */
    pelvis(out = new THREE.Vector3()) {
      const p = fighter.bodies.pelvis.translation();
      return out.set(p.x, p.y, p.z);
    },
    dispose() {
      hands?.dispose();
      for (const { group } of fighter.meshes) group.removeFromParent(); // 모양·재질은 게임과 같이 쓰는 것이 있어 풀지 않는다 (미리보기 그리개를 닫으면 그 GL 자원은 같이 사라진다)
      queue.free();
      world.free();
    },
  };
  return rig;
}

/** 맨손: 칼팔(위팔 · 아래팔)만 어깨에서 내린다 — 물리 없이 만든 그대로의 몸 (전 미리보기 lobby_character.js 와 같은 꼴) */
function dropSwordArm(f) {
  const pelvis = f.bodies.pelvis, pr = pelvis.rotation(), pt = pelvis.translation();
  const facing = new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w);
  const shoulder = f.localPos.uarmS.clone(); shoulder.x = 0;
  shoulder.sub(f.localPos.pelvis).applyQuaternion(facing).add(new THREE.Vector3(pt.x, pt.y, pt.z));
  const drop = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1).applyQuaternion(facing), -Math.PI / 2);
  for (const g of [f.groups.uarmS, f.groups.farmS]) {
    g.position.sub(shoulder).applyQuaternion(drop).add(shoulder);
    g.quaternion.premultiply(drop);
  }
}
