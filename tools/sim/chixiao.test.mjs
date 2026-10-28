// 적소검: 실제 테이퍼 접촉, 질량·피묻음·강제 절단·카드 등록.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, drawWeaponCards, weaponMatOpts } from '../../src/weapons.js';
import { weaponPhysics } from '../../src/weapon_class.js';
import { chixiaoBladeMass, chixiaoWidth } from '../../src/chixiao_profile.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { newRound, RAPIER, DT } from './harness_m.mjs';
const base = new URL('../../docs/import/chixiao_2026-10-27/', import.meta.url);
const w = WEAPONS.chixiao;
const phys = weaponPhysics(w), parts = w.buildParts({}), p = parts.find(p => p[4]);
assert(Math.abs(phys.mass - 1.26) < 1e-10); assert.equal(w.bladeLength, .80); // 1.30 → 1.26 kg (사장님 10/27 −40 g)
assert(phys.com > .29 && phys.com < .31); assert(phys.I > .18 && phys.I < .20); // 자루 쪽 −40 g 뒤 중심 0.295 → 0.304
assert(phys.I > weaponPhysics(WEAPONS.qinggang).I * 1.5); // 새 한손검의 묵직한 차이 보존
assert.equal(w.fragility, 0); assert.equal(w.tier, 'legend');
const art = resolveSwordArt(w), q = resolveSwordArt(WEAPONS.qinggang);
for (const k of ['grip', 'offArm', 'parry', 'motion']) assert.deepEqual(art[k], q[k], k);
let triangles = 0, meshes = 0; const bounds = new THREE.Box3();
for (const [i, [shape, y, , color, isBlade]] of parts.entries()) {
  const root = w.partMesh(i, isBlade, shape, color, weaponMatOpts(w.material, isBlade, w.tier)); root.position.y = y;
  root.updateMatrixWorld(true); bounds.union(new THREE.Box3().setFromObject(root));
  root.traverse(o => { if (!o.isMesh) return; assert([...o.geometry.attributes.position.array].every(Number.isFinite)); meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
}
assert(triangles < 23000); assert(Math.abs(bounds.max.y - bounds.min.y - 1.006) < .001);

// 실제 Rapier 형상에서 넓은 밑동은 닿고, 칼끝 곁의 옛 상자 빈 영역은 닿지 않는지 확인.
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
const col = world.createCollider(w.partCollider(RAPIER, 3, true, p[0]));
assert(col.containsPoint({ x: .025, y: -.39, z: 0 }));
assert(!col.containsPoint({ x: .018, y: .32, z: 0 })); // 옛 상자만 닿던 빈 영역
let maxWidthError = 0;
for (let i = 1; i < 100; i++) {
  const t = i / 100, y = -.4 + .8 * t;
  const hit = col.castRay(new RAPIER.Ray({ x: .06, y, z: 0 }, { x: -1, y: 0, z: 0 }), .1, false);
  assert(hit >= 0); const half = .06 - hit;
  maxWidthError = Math.max(maxWidthError, Math.abs(half - .0225 * chixiaoWidth(t)));
}
// 긴 얇은 볼록체의 Rapier 광선 계산 오차도 포함해 2mm 이내. 옛 끝 곁 오차는 약15mm.
assert(maxWidthError < .002); world.free();

// 표시 면 적분에 따른 밀도가 강철 범위인지 확인.
const bm = chixiaoBladeMass(1, p[0]), density = 1 / bm.volume;
assert(density > 7800 && density < 8000);
const g = newRound({ weapon: 'chixiao', weapon2: 'longsword', seed: 17 });
assert.equal(g.player.bladeColliders[0].shapeType(), RAPIER.ShapeType.ConvexPolyhedron);
assert(Math.abs(g.player.sword.mass() - 1.26) < 1e-6);
assert(Math.abs(g.player.sword.localCom().y - phys.com) < 1e-6);
g.player.bloodyBlade(.3); assert(g.player.bladeBlood > 0);
for (let i = 0; i < 120; i++) g.step();
assert(Object.values(g.player.sword.translation()).every(Number.isFinite));
// 자연 파손은0. 검사에서 강제로 잘라도 옛 칼끝의 판정을 남기지 않는다.
g.player.breakWeapon(); assert(g.player.weaponBroken);
assert.equal(g.player.bladeColliders[0].shapeType(), RAPIER.ShapeType.ConvexPolyhedron);
assert(g.player.weaponCfg.bladeLength < .8);
for (let i = 0; i < 30; i++) g.step();
assert(Object.values(g.player.sword.translation()).every(Number.isFinite)); g.world.free();
const pool = WEAPON_LIST.filter(x => !RETIRED_WEAPONS.has(x.id) && !x.characterOnly && x.id !== 'excalibur_replica').map(x => x.id);
let seed = 1, found = false;
for (let i = 0; i < 10000; i++) { const cards = drawWeaponCards(pool, 2, { rnd: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) }); assert.equal(new Set(cards).size, 2); if (cards.includes('chixiao')) found = true; }
assert(found);
const result = { physics: phys, density, triangles, meshes,
  maxWidthErrorMm: maxWidthError * 1000, collisionProbes: 101, naturalBreak: w.fragility, forcedTrim: true, blood: true, draw: true };
// 기록 파일(results/contracts.json — 사장님 적소검 기록)은 CHIXIAO_WRITE=1 일 때만 다시 쓴다 (사장님 10/28 '고쳐' — 평소 시험은 검사만 · 저장소 파일을 고치지 않음)
if (process.env.CHIXIAO_WRITE === '1') fs.writeFileSync(new URL('results/contracts.json', base), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
