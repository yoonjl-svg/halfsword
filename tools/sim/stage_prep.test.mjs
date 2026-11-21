// 다음 판 배경을 결과 창에서 미리 (사장님 11/22 '다음판 열 때 멈춰.' · 감사 N-025 — src/stages.js prepare · withNext · adopt · dropNext)
//  작은 시험 배경으로 본다: ① 미리 지어도 지금 장면 · 빛 · 안개 · 그림자는 그대로 (결과 창 뒤 마지막 장면 — 화면 크기가 바뀌어 다시 그려도 같음)
//  ② withNext 안에서만 다음 배경 ③ 미리 지은 것을 올리면(build → adopt) 그 자리에서 지은 것과 같은 빛 · 안개 · 그림자 · 물체 · 옛 배경 자원 풀기
//  ④ 버리면(dropNext) 다음 배경만의 자원만 푼다 ⑤ 이름으로 제 물체를 찾는 배경이 지금 배경 것을 집지 않음 ⑥ 짓다 오류가 나도 장면 그대로
//  화면 밖 그리기 · 셰이더(prepStep)는 그래픽 칩이 있어야 해서 헤드리스 크롬으로 잰다 (커밋 글에 적은 측정)
//  node --test tools/sim/stage_prep.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Stages } from '../../src/stages.js';

const SHARED = new THREE.Texture(); // 모듈에 한 번 만들어 두 배경이 같이 쓰는 질감 (예: 무늬 질감 캐시)
function stageA(scene, { hemi, sun }) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: SHARED }));
  floor.name = 'a-floor';
  const own = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
  scene.add(floor, own);
  scene.fog = new THREE.Fog(0x884422, 10, 90);
  hemi.intensity = 0.3;
  sun.color.setHex(0xff2200);
  sun.position.set(1, 2, 3);
  return { update() {}, sunOffset: { x: 1, y: 2, z: 3 } };
}
function stageB(scene, { hemi, sun }) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial({ map: SHARED, roughness: 0.2 })));
  g.add(new THREE.PointLight(0xffaa00, 2));
  scene.add(g, new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshLambertMaterial({ map: new THREE.Texture() })));
  scene.background = new THREE.Color(0x112244);
  hemi.groundColor.setHex(0x223311);
  sun.intensity = 2.5;
  return { update() {}, sunOffset: { x: -6, y: 8, z: -5 }, shadow: { mapSize: 2048, left: -9, right: 9, top: 9, bottom: -9, bias: -0.0004, snap: true } };
}
/** 밤 갈래처럼: 낮 배경을 짓고 이름으로 제 물체를 찾아 고친다 */
function stageAN(scene, lights) {
  const st = stageA(scene, lights);
  scene.getObjectByName('a-floor').userData.night = true;
  return st;
}
function stageBad(scene) {
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  scene.fog = new THREE.FogExp2(0xffffff, 0.1);
  throw new Error('짓다 실패');
}
const BUILDERS = { a: stageA, b: stageB, an: stageAN, bad: stageBad };

function rig() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc4c8c6);
  scene.fog = new THREE.Fog(0xc4c8c6, 20, 480);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
  scene.add(hemi, sun, sun.target);
  const fighter = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: 0x996633 }));
  scene.add(fighter); // 배경이 아닌 것 (싸움꾼 — 짓기 · 치우기와 상관없이 남는다)
  const stages = new Stages(scene, { hemi, sun }, BUILDERS);
  return { scene, hemi, sun, fighter, stages };
}
/** 비교용 값: 물체 참조 · 색 · 벡터 · 그림자 설정 */
function look(stages) {
  const e = stages.envOf();
  return {
    background: e.background, fog: e.fog,
    hemi: [e.hemiColor.getHex(), e.hemiGround.getHex(), e.hemiIntensity, ...e.hemiPos.toArray()],
    sun: [e.sunColor.getHex(), e.sunIntensity, ...e.sunPos.toArray()],
    shadow: e.shadow, snap: e.snap && { right: e.snap.right.toArray(), up: e.snap.up.toArray(), du: e.snap.du, dv: e.snap.dv }, sunOffset: e.sunOffset,
  };
}
const plain = (l) => ({ ...l, background: l.background?.getHex?.() ?? l.background, fog: l.fog && [l.fog.color.getHex(), l.fog.near, l.fog.far, l.fog.density] });
const kids = (scene) => new Set(scene.children);
/** 자원이 풀렸나 적어 둔다 */
function watchDispose(objs) {
  const gone = new Set();
  for (const o of objs)
    o.traverse((c) => {
      for (const r of [c.geometry, ...[].concat(c.material ?? [])]) {
        if (!r) continue;
        r.addEventListener('dispose', () => gone.add(r));
        for (const v of Object.values(r)) if (v?.isTexture) v.addEventListener('dispose', () => gone.add(v));
      }
    });
  return gone;
}

test('① 미리 지어도 지금 장면 · 빛 · 안개 · 그림자는 그대로', () => {
  const { scene, stages } = rig();
  stages.build('a');
  const before = kids(scene), env0 = look(stages);
  stages.prepare('b');
  assert.deepEqual(kids(scene), before, '장면의 물체가 같다 (미리 지은 것은 떼어 둔다)');
  assert.deepEqual(look(stages), env0, '빛 · 안개 · 하늘색 · 그림자 · 해 방향이 같다');
  assert.equal(stages.id, 'a');
  assert.equal(stages.next.id, 'b');
  assert.ok(stages.next.objects.length === 2 && stages.next.objects.every((o) => !o.parent), '다음 배경 물체 둘은 장면 밖');
});

test('② withNext 안에서만 다음 배경 — 나오면 되돌린다', () => {
  const { scene, stages, fighter } = rig();
  stages.build('a');
  const cur = stages.objects.slice(), before = kids(scene), env0 = look(stages);
  stages.prepare('b');
  stages.withNext(() => {
    for (const o of stages.next.objects) assert.equal(o.parent, scene);
    for (const o of cur) assert.equal(o.parent, null, '지금 배경은 잠깐 뗀다');
    assert.equal(fighter.parent, scene, '배경 아닌 것은 그대로');
    assert.equal(scene.background.getHex(), 0x112244);
    assert.equal(stages.sun.shadow.mapSize.x, 2048);
  });
  assert.deepEqual(kids(scene), before);
  assert.deepEqual(look(stages), env0);
  assert.throws(() => stages.withNext(() => { throw new Error('x'); }));
  assert.deepEqual(kids(scene), before, '안에서 오류가 나도 되돌린다');
  assert.deepEqual(look(stages), env0);
});

test('③ 미리 지은 것을 올리면 그 자리에서 지은 것과 같다 · 옛 배경 자원은 풀고 같이 쓰는 것은 둔다', () => {
  // 그 자리에서 짓기 (예전 길)
  const R1 = rig();
  R1.stages.build('a');
  const arena1 = R1.stages.build('b');
  const fresh = plain(look(R1.stages));
  // 미리 짓고 올리기
  const R2 = rig();
  R2.stages.build('a');
  const old = R2.stages.objects.slice();
  const gone = watchDispose(old);
  R2.stages.prepare('b');
  const prepared = R2.stages.next.objects.slice();
  const goneNext = watchDispose(prepared);
  const arena2 = R2.stages.build('b');
  assert.equal(R2.stages.next, null);
  assert.equal(R2.stages.id, 'b');
  assert.equal(R2.stages.early, true);
  assert.deepEqual(R2.stages.objects, prepared, '미리 지은 물체를 그대로 올린다');
  for (const o of prepared) assert.equal(o.parent, R2.scene);
  for (const o of old) assert.equal(o.parent, null, '옛 배경은 뗀다');
  assert.deepEqual(plain(look(R2.stages)), fresh, '빛 · 안개 · 하늘색 · 그림자 · 화소 맞춤 · 해 방향이 그 자리에서 지은 것과 같다');
  assert.deepEqual(Object.keys(arena2).sort(), Object.keys(arena1).sort());
  assert.equal(R2.scene.children.length, R1.scene.children.length, '장면 물체 수가 같다');
  assert.ok(!gone.has(SHARED), '두 배경이 같이 쓰는 질감은 풀지 않는다');
  assert.ok(gone.size >= 4, `옛 배경만의 모양 · 재질 · 질감은 푼다 (${gone.size})`);
  assert.equal(goneNext.size, 0, '올린 배경의 자원은 하나도 풀지 않는다');
  assert.equal(R2.stages.warmed, false, 'GPU 준비를 끝내지 않았으면 warm 이 예전처럼 한다');
});

test('④ 다른 배경을 짓게 되면 미리 지은 것만의 자원을 버린다', () => {
  const { scene, stages, fighter } = rig();
  stages.build('a');
  const before = kids(scene), env0 = look(stages);
  stages.prepare('b');
  const prepared = stages.next.objects.slice();
  const gone = watchDispose(prepared);
  const fighterGone = watchDispose([fighter]);
  stages.dropNext();
  assert.equal(stages.next, null);
  assert.ok(!gone.has(SHARED), '지금 배경이 쓰는 질감은 둔다');
  assert.ok(gone.size >= 3, `미리 지은 배경만의 자원은 푼다 (${gone.size})`);
  assert.equal(fighterGone.size, 0, '배경 아닌 것은 건드리지 않는다');
  for (const o of prepared) assert.equal(o.parent, null);
  assert.deepEqual(kids(scene), before);
  assert.deepEqual(look(stages), env0);
  // build 가 다른 id 를 부르면 미리 지은 것을 버리고 예전처럼 짓는다
  stages.prepare('b');
  stages.build('an');
  assert.equal(stages.next, null);
  assert.equal(stages.early, false);
  assert.equal(stages.id, 'an');
  assert.equal(scene.children.filter((o) => o.name === 'a-floor').length, 1);
});

test('⑤ 이름으로 제 물체를 찾는 배경(밤 갈래)이 지금 배경 것을 집지 않는다', () => {
  const { scene, stages } = rig();
  stages.build('a');
  const curFloor = scene.getObjectByName('a-floor');
  stages.prepare('an');
  assert.equal(curFloor.userData.night, undefined, '지금 배경의 바닥은 그대로');
  assert.equal(stages.next.objects.find((o) => o.name === 'a-floor').userData.night, true, '미리 지은 배경의 바닥을 고친다');
});

test('⑥ 미리 짓다 오류가 나도 장면 · 빛 · 안개는 그대로', () => {
  const { scene, stages } = rig();
  stages.build('a');
  const before = kids(scene), env0 = look(stages);
  assert.throws(() => stages.prepare('bad'), /짓다 실패/);
  assert.deepEqual(kids(scene), before);
  assert.deepEqual(look(stages), env0);
  assert.equal(stages.next, null);
  assert.equal(stages.prepStep('bad', null, null), false, 'prepStep 은 오류를 삼키고 다시 해 보지 않는다');
  assert.equal(stages.prepFailed, 'bad');
  assert.deepEqual(kids(scene), before);
});
