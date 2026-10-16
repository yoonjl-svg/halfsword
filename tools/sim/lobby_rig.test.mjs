// 대기실 캐릭터 몸 시험 (src/lobby_rig.js — docs/import/ui_fix_2026-10-16.md §6): 판과 같은 Fighter 를 따로 된 작은 세계에 세운 몸이 실제 판의 플레이어와 같은 자세인가
//  node --test tools/sim/lobby_rig.test.mjs   (판 = harness_m newRound · 상대 AI 멈춤 — 맞대기 수치 도구는 tools/sim/lobby_rig_probe.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, RAPIER, THREE, CONFIG, DT } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { createLobbyRig, RIG } from '../../src/lobby_rig.js';
import { Fighter } from '../../src/fighter.js';

const skill = { level: 0.7, corr: CONFIG.SKILL.corr, corrTip: CONFIG.SKILL.corrTip, autoGuard: true }; // main.js newRound 의 플레이어
const spec = (weapon) => ({ look: LOOKS.player, weapon, skill });
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
/** 골반 기준 몸 틀(앞 x · 위 y · 오른쪽 z): 몸 부위 · 손목 · 칼끝 · 칼날 축 */
function pose(f) {
  const pv = V(f.bodies.pelvis.translation()), inv = f.yaw.clone().invert(), loc = (p) => p.clone().sub(pv).applyQuaternion(inv);
  const parts = Object.fromEntries(Object.entries(f.bodies).map(([k, b]) => [k, loc(V(b.translation()))]));
  return {
    parts,
    wrist: loc(new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(f.bodies.farmS.rotation())).add(V(f.bodies.farmS.translation()))),
    tip: loc(f.bladePoint(1)),
    axis: new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation())).applyQuaternion(inv),
  };
}
const deg = (a, b) => THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));

for (const id of ['tree_branch', 'longsword', 'zweihander']) {
  test(`${id}: 대기실 몸 = 판의 플레이어 (${RIG.settle} s — 손목·칼끝 2 mm · 칼날 축 0.5° · 몸 부위 2 cm 안)`, () => {
    const G = newRound({ weapon: id, weapon2: 'longsword', seed: 7 });
    Object.assign(G.player.skill, skill);
    G.ai.update = () => {};
    for (let i = 0; i < Math.round(RIG.settle / DT); i++) G.step();
    const fight = pose(G.player);
    G.world.free();
    const count = Fighter._breakCount;
    const rig = createLobbyRig(RAPIER, new THREE.Group(), spec(id));
    assert.equal(Fighter._breakCount, count, '게임 판의 파손 굴림 셈을 늘리지 않는다');
    assert.equal(rig.settled, false);
    let guard = 0;
    while (!rig.settle(1e9) && guard++ < 10);
    assert.equal(rig.settled, true); assert.ok(Math.abs(rig.time - RIG.settle) < 1e-9, String(rig.time));
    const lobby = pose(rig.fighter);
    assert.ok(fight.wrist.distanceTo(lobby.wrist) < 0.002, `wrist ${fight.wrist.distanceTo(lobby.wrist)}`);
    assert.ok(fight.tip.distanceTo(lobby.tip) < 0.002, `tip ${fight.tip.distanceTo(lobby.tip)}`);
    assert.ok(deg(fight.axis, lobby.axis) < 0.5, `axis ${deg(fight.axis, lobby.axis)}`);
    for (const k of Object.keys(fight.parts)) assert.ok(fight.parts[k].distanceTo(lobby.parts[k]) < 0.02, `${k} ${fight.parts[k].distanceTo(lobby.parts[k])}`);
    // 기억한 자세: 같은 spec 의 새 몸에 되돌리면 몸·칼 자리가 같다 (물리 없이)
    const snap = rig.snapshot();
    const again = createLobbyRig(RAPIER, new THREE.Group(), spec(id));
    assert.equal(again.restore(snap), true); assert.equal(again.settled, true);
    const back = pose(again.fighter);
    assert.ok(back.tip.distanceTo(lobby.tip) < 1e-6 && back.wrist.distanceTo(lobby.wrist) < 1e-6);
    for (const r of [rig, again]) r.dispose();
  });
}

test('맨손: 물리 없이 만든 그대로의 몸 · 칼은 숨김 · 칼팔만 어깨에서 내림 · 두 손 편 손', () => {
  const parent = new THREE.Group();
  const rig = createLobbyRig(RAPIER, parent, spec(null));
  assert.equal(rig.armed, false); assert.equal(rig.settled, true);
  const f = rig.fighter;
  assert.equal(f.armed, false);
  assert.equal(f.meshes.find((m) => m.kind === 'weapon').group.visible, false);
  const before = f.groups.uarmO.position.clone();
  rig.step(50); // 맨손은 물리를 안 돌린다
  assert.equal(rig.time, 0); assert.ok(f.groups.uarmO.position.equals(before));
  // 칼팔은 어깨 아래로 (위팔 · 아래팔이 골반보다 낮은 쪽으로) — 빈팔은 만든 그대로
  const uS = f.groups.uarmS.position, fS = f.groups.farmS.position, rb = V(f.bodies.farmS.translation());
  assert.ok(fS.y < uS.y && fS.y < rb.y - 0.2, JSON.stringify({ uS, fS, rb }));
  assert.ok(parent.children.length > 10);
  rig.dispose();
  assert.equal(parent.children.length, 0, '풀면 메쉬가 묶음에서 빠진다');
});
