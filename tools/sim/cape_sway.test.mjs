// 망토 흔들림 시험 (10/24 — src/cape_sway.js · 사장님 '베르나르도 롤랑 아르토리아 망토에 다 넣어')
//  쉬는 꼴 그대로(꼭짓점 · 줄 · 차례) · 바깥 난수 흐름 0 · 어깨 줄 고정 · 아랫단이 몸 움직임 반대쪽으로 늦게 따라옴(앞 가속 → 뒤 · 옆 가속 → 반대 옆 · 돌기 → 뒤에 남음) ·
//  묶음 안 · 가라앉음 · 자리 옮김에 튀지 않음 · 세 인물 망토에 달림(광기의 아르토리아 궁정 예복은 망토 없음)
//  node --test tools/sim/cape_sway.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachCapeSway, updateCapeSway, capeSwayAngles } from '../../src/cape_sway.js';
import { CAPE } from '../../src/config.js';
import { newRound } from './harness_m.mjs';
import { CHARACTERS_BY_ID, CHARACTER_VARIANTS } from '../../src/characters.js';

/** 가슴 그룹 → 대표 메쉬 → 천 층 → 망토 판(위 0.15 · 아래 −1.0 m · 몸 뒤 x −0.2) */
function rig() {
  const chest = new THREE.Group();
  const holder = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.3), new THREE.MeshBasicMaterial());
  chest.add(holder);
  const layer = new THREE.Group();
  holder.add(layer);
  const geo = new THREE.PlaneGeometry(0.5, 1.15, 4, 12);
  geo.rotateY(Math.PI / 2);
  geo.translate(-0.2, 0.15 - 0.575, 0);
  const cape = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  cape.name = 'test-cape';
  layer.add(new THREE.Object3D(), cape, new THREE.Object3D());
  return { fighter: { groups: { chest }, index: 0 }, chest, layer, cape };
}
const hemWorld = (layer) => {
  const s = layer.children.find((o) => o.isSkinnedMesh), p = s.geometry.attributes.position;
  let k = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < p.getY(k)) k = i;
  let t = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > p.getY(t)) t = i;
  layer.parent.parent.updateMatrixWorld(true);
  const w = (i) => s.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(s.matrixWorld);
  return { hem: w(k), top: w(t), restHem: new THREE.Vector3().fromBufferAttribute(p, k), restTop: new THREE.Vector3().fromBufferAttribute(p, t) };
};
const run = (R, n, fn, dt = 1 / 60) => { for (let i = 0; i < n; i++) { fn(i * dt, i); updateCapeSway(R.fighter, dt); } };

test('붙이기: 꼴 · 차례 그대로 · 바깥 난수 0 · 뼈 5', () => {
  const R = rig(), before = Array.from(R.cape.geometry.attributes.position.array), idx = Array.from(R.cape.geometry.index.array);
  const real = Math.random;
  let draws = 0;
  Math.random = () => { draws++; return 0.5; };
  let ctl;
  try { ctl = attachCapeSway(R.layer, [R.cape]); } finally { Math.random = real; }
  assert.equal(draws, 0);
  const s = R.layer.children[1];
  assert.ok(s.isSkinnedMesh);
  assert.equal(s.name, 'test-cape');
  assert.deepEqual(Array.from(s.geometry.attributes.position.array), before);
  assert.deepEqual(Array.from(s.geometry.index.array), idx);
  assert.equal(ctl.bones.length, CAPE.bones + 1);
  assert.ok(Math.abs(ctl.top - 0.15) < 1e-6 && Math.abs(ctl.hem + 1.0) < 1e-6);
});

test('가만히 서면 쉬는 꼴(숨쉬기만 — 아랫단 1° 안) · 어깨 줄은 늘 고정', () => {
  const R = rig();
  attachCapeSway(R.layer, [R.cape]);
  run(R, 240, () => {});
  const [a] = capeSwayAngles(R.fighter);
  assert.ok(Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)) < CAPE.idle.amp * 1.2);
  const { top, restTop } = hemWorld(R.layer);
  assert.ok(top.distanceTo(restTop) < 1e-6);
});

test('앞으로 가속 → 아랫단이 뒤로 · 옆(+Z) 가속 → 아랫단이 −Z 로 · 왼쪽으로 돌기(+Y) → 뒤에 남음(−) · 어깨 고정', () => {
  for (const [axis, check] of [
    ['x', (a, d) => { assert.ok(a.z < -0.02, `앞뒤 ${a.z}`); assert.ok(d.hem.x < d.restHem.x - 0.01); }],
    ['z', (a, d) => { assert.ok(a.x > 0.02, `옆 ${a.x}`); assert.ok(d.hem.z < d.restHem.z - 0.01); }],
  ]) {
    const R = rig();
    attachCapeSway(R.layer, [R.cape]);
    run(R, 30, () => {});
    // 0.3 s 동안 3 m/s² 로 빨라짐
    run(R, 18, (t) => { R.chest.position[axis] += 0.5 * 3 * ((t + 1 / 60) ** 2 - t * t); });
    const [a] = capeSwayAngles(R.fighter), d = hemWorld(R.layer);
    d.hem.sub(R.chest.position);
    check(a, d);
    assert.ok(d.top.clone().sub(R.chest.position).distanceTo(d.restTop) < 1e-6);
  }
  const R = rig();
  attachCapeSway(R.layer, [R.cape]);
  run(R, 30, () => {});
  run(R, 12, () => R.chest.rotateY(3 / 60)); // 3 rad/s
  assert.ok(capeSwayAngles(R.fighter)[0].y < -0.02);
});

test('세게 흔들어도 묶음 안 (앞 · 뒤 · 옆 · 비틀림) · 멈추면 settle 안팎에서 가라앉음', () => {
  const R = rig();
  attachCapeSway(R.layer, [R.cape]);
  let maxF = 0, maxB = 0, maxS = 0, maxT = 0;
  run(R, 600, (t, i) => {
    R.chest.position.x = 0.4 * Math.sin(9 * t);
    R.chest.position.z = 0.4 * Math.cos(7 * t);
    R.chest.rotation.set(0.8 * Math.sin(11 * t), 2 * Math.sin(8 * t), 0.8 * Math.cos(10 * t));
    if (i) {
      const [a] = capeSwayAngles(R.fighter);
      maxF = Math.max(maxF, a.z); maxB = Math.max(maxB, -a.z); maxS = Math.max(maxS, Math.abs(a.x)); maxT = Math.max(maxT, Math.abs(a.y));
    }
  });
  const L = CAPE.clamp;
  assert.ok(maxF <= L.fwd + 1e-9 && maxB <= L.back + 1e-9 && maxS <= L.side + 1e-9 && maxT <= L.twist + 1e-9);
  assert.ok(maxB > 0.8 * L.back && maxF > 0.8 * L.fwd);
  // 멈춤 → CAPE.settle 의 두 배 뒤면 숨쉬기 크기 안
  run(R, Math.round(2 * CAPE.settle * 60), () => {});
  const [a] = capeSwayAngles(R.fighter);
  assert.ok(Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z + 0)) < 0.25 * L.fwd + CAPE.idle.amp, JSON.stringify(a));
});

test('자리 옮김(판 새로 · 되살아남)에 튀지 않음 · dt 0 이면 그대로', () => {
  const R = rig();
  attachCapeSway(R.layer, [R.cape]);
  run(R, 30, () => {});
  R.chest.position.set(5, 0, -3);
  updateCapeSway(R.fighter, 1 / 60);
  updateCapeSway(R.fighter, 1 / 60);
  const [a] = capeSwayAngles(R.fighter);
  assert.ok(Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)) < 2 * CAPE.idle.amp);
  const q = R.layer.children.filter((o) => o.isBone).map((b) => b.quaternion.toArray().join());
  updateCapeSway(R.fighter, 0);
  assert.deepEqual(R.layer.children.filter((o) => o.isBone).map((b) => b.quaternion.toArray().join()), q);
});

test('세 인물 망토에 흔들림이 달림 · 광기의 아르토리아 궁정 예복은 망토 없음', () => {
  const names = { bernardo: ['bernardo-gold-mantle', 'bernardo-mantle-lining'], roland: ['roland-wine-cape'], artoria: ['artoria-cape'] };
  for (const [id, want] of Object.entries(names)) {
    const C = CHARACTERS_BY_ID[id];
    const G = newRound({ seed: 1, look2: C.look, weapon: 'longsword', weapon2: C.weapon });
    const got = [];
    G.enemy.groups.chest.traverse((o) => { if (o.isSkinnedMesh) got.push(o.name); });
    for (const w of want) assert.ok(got.includes(w), `${id}: ${w} 없음 (${got})`);
    assert.equal(capeSwayAngles(G.enemy).length, 1, id);
  }
  const mad = CHARACTER_VARIANTS.find((c) => c.id === 'artoria_mad');
  const G = newRound({ seed: 1, look2: mad.look, weapon: 'longsword', weapon2: mad.weapon });
  assert.equal(capeSwayAngles(G.enemy).length, 0);
});
