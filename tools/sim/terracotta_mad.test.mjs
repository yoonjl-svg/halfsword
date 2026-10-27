// 광기의 병마용: 사람처럼 죽되 흰 피 · 사람 살 소리 · 목소리 없음 · 숙련도 5 (사장님 10/27 23:2x · 23:3x — docs/decisions.md · 확인표 2650 ~ 2655)
//  출처: 샛별 저장소 6821e98c (blood_palette.js · characters.js 광기의 병마용 시트) — 우리 코드에 맞춰 다시 씀
//  ① 시트: 광기의 병마용 사람 몸 · 흰 피 · 'silent' · 숙련도 5(예외) · 병마용 원본 그대로(흙 몸 · 숙련도 2) · 다른 얼터 모두 원본 +1(상한 5)
//  ② 피 색: 흰 피는 광기의 병마용만 — 나머지 인물 · 시트 없는 검객은 붉은 피(예전 값 그대로) · 입자 · 칼에 묻는 피 · 단면
//  ③ 죽음: 같은 몸통 상처에 사람과 똑같이 피를 흘리고 쓰러짐(목 관절 그대로) · 머리 찌르기도 참수 없이 죽음 · 원본 병마용은 피 0 · 머리가 떨어져야만
//  ④ 소리: 절단 · 참수는 사람 소리(흙 부서지는 소리 0) · 목소리 호출 0
//  node --test tools/sim/terracotta_mad.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, THREE, DT, CONFIG } from './harness_m.mjs';
import { HUMAN_BODY } from '../../src/fighter.js';
import { CHARACTERS_BY_ID as C } from '../../src/characters.js';
import { AI_PROFICIENCY, ANATOMY } from '../../src/config.js';
import { BLOOD_RED, BLOOD_WHITE, bloodPalette } from '../../src/blood_palette.js';
import { Particles } from '../../src/effects.js';
import { createDecapFx } from '../../src/decap_fx.js';
import { createLimbFx } from '../../src/limb_fx.js';
import { BodySounds, Sound, VOICES } from '../../src/sound.js';

const MAD = C.terracotta_mad, TERRA = C.terracotta;
const bodyOf = (c) => (c.physiology ? Object.freeze({ ...HUMAN_BODY, ...c.physiology }) : HUMAN_BODY); // fighter.js 생성자와 같은 덮기
class Passive { update() {} }
/** 가만히 선 두 사람 (AI 없음). enemy 몸 = sheet 의 physiology (없으면 사람) */
function quiet(sheet = null) {
  const G = newRound({ walls: false, seed: 7, AIClass: Passive });
  if (sheet) G.enemy.physiology = bodyOf(sheet);
  for (let i = 0; i < 120; i++) G.step();
  return G;
}
function wound(part, zone, type, severity, local, patch = {}) {
  return { part, zone, type, severity, energy: 150, pass: false, passing: false, stuck: false, helmet: false, plate: false, local: local.clone(), dir: new THREE.Vector3(0, -1, 0),
    bleedPerSev: ANATOMY[zone === 'neck' ? 'neck' : zone === 'head' ? 'head' : zone === 'arm' ? 'arm' : zone === 'leg' ? 'leg' : 'chest'].bleed, helmetBlunt: 1, plateBlunt: 1, ...patch };
}
const headless = (f) => f.decapitated && !f.jointByName.head?.joint;

test('① 시트: 광기의 병마용 사람 몸 · 흰 피 · 목소리 없음 · 숙련도 5 — 원본 병마용 그대로', () => {
  assert.deepEqual(MAD.physiology, { body: 'human', bleeds: true, deathRequiresHeadDetachment: false, blood: 'white' });
  assert.equal(MAD.voice, 'silent');
  assert.equal(VOICES.silent.mute, true);
  assert.equal(MAD.ai.proficiency, 5);
  assert.equal(MAD.proficiencyFixed, 5);
  assert.equal(MAD.ai.level, AI_PROFICIENCY.levels[5]);
  assert.deepEqual(MAD.ai.persona.proficiency, { chinese: 5 });
  assert.equal(MAD.weapon, TERRA.weapon);
  assert.equal(MAD.ai.persona.school, TERRA.ai.persona.school);
  assert.deepEqual(MAD.ai.persona.level, TERRA.ai.persona.level); // 실력 숫자 +20 % 없음 (retainBaseStats — 전 '외양만'과 같음)
  assert.equal(MAD.look.alter, 'terracotta'); // 겉모습(채색 갑옷 · 창백한 사람 얼굴 · 흰 망토) 그대로
  // 원본 병마용: 흙 몸 · 피 없음 · 머리가 떨어져야만 죽음 · 숙련도 2 · 목소리 없음
  assert.deepEqual(TERRA.physiology, { body: 'clay', bleeds: false, deathRequiresHeadDetachment: true });
  assert.equal(TERRA.voice, 'silent');
  assert.equal(TERRA.ai.proficiency, 2);
  assert.deepEqual(TERRA.ai.persona.proficiency, { chinese: 2 });
});

test('① 얼터 숙련도: 광기의 병마용만 5(예외) — 다른 얼터는 모두 원본 +1(상한 5) · 광기의 랴오 4', () => {
  const alters = Object.values(C).filter((c) => c.variantOf);
  assert.ok(alters.length >= 16);
  for (const c of alters) {
    const want = c.id === 'terracotta_mad' ? 5 : Math.min(AI_PROFICIENCY.max, C[c.variantOf].ai.proficiency + 1);
    assert.equal(c.ai.proficiency, want, c.id);
    if (c.id !== 'terracotta_mad') assert.equal(c.proficiencyFixed, undefined, c.id);
  }
  assert.equal(C.liao_mad.ai.proficiency, 4);
});

test('② 피 색: 흰 피는 광기의 병마용만 · 붉은 피 값은 예전 그대로', () => {
  assert.deepEqual({ ...BLOOD_RED }, { key: 'red', splash: 0x8a0000, drip: 0x7a0000, blade: 0x5a0808, flesh: 0x4a0a0c, rim: 0x6a1a18 });
  assert.equal(BLOOD_WHITE.key, 'white');
  for (const [id, c] of Object.entries(C)) assert.equal(bloodPalette(c), id === 'terracotta_mad' ? BLOOD_WHITE : BLOOD_RED, id);
  assert.equal(bloodPalette(null), BLOOD_RED);
  assert.equal(bloodPalette({ physiology: HUMAN_BODY }), BLOOD_RED);
  assert.equal(bloodPalette({ physiology: bodyOf(MAD) }), BLOOD_WHITE); // 검객 몸(덮은 뒤)에서도
  // 흰 피 색은 실제로 밝다 (붉은 피와 섞이지 않게)
  for (const k of ['splash', 'drip', 'blade', 'flesh', 'rim']) {
    const c = new THREE.Color(BLOOD_WHITE[k]);
    assert.ok(Math.min(c.r, c.g, c.b) > 0.4 && Math.abs(c.r - c.g) < 0.1, k);
  }
});

test('② 입자: 기본은 붉은 피 그대로 · 흰 피와 붉은 피가 한 판에 함께 · 피 끄기면 먼지 · 핏방울 없음', () => {
  const p = new Particles(new THREE.Scene());
  const pos = new THREE.Vector3(0, 0.01, 0), dir = new THREE.Vector3(1, 0, 0);
  p.blood(pos, dir, 1, 1);
  p.drip(pos);
  const red = new Set(p.list.map((it) => it.color.getHex()));
  assert.deepEqual([...red].sort(), [0x7a0000, 0x8a0000].sort()); // 색을 안 주면 예전 값
  p.blood(pos, dir, 1, 1, BLOOD_WHITE.splash);
  p.drip(pos, BLOOD_WHITE.drip);
  p.update(0.5);
  const all = new Set(p.list.map((it) => it.color.getHex()));
  for (const c of [0x8a0000, 0x7a0000, BLOOD_WHITE.splash, BLOOD_WHITE.drip]) assert.ok(all.has(c), c.toString(16));
  assert.ok(p.list.some((it) => it.stuck && it.color.getHex() === BLOOD_WHITE.splash)); // 바닥 얼룩도 흰 피
  p.clear();
  p.bloodOn = false;
  p.drip(pos, BLOOD_WHITE.drip);
  assert.equal(p.list.length, 0);
  p.blood(pos, dir, 1, 1, BLOOD_WHITE.splash);
  assert.ok(p.list.length > 0 && p.list.every((it) => it.color.getHex() === 0xb3b0a9));
});

test('② 칼에 묻는 피: 기본은 예전 붉은 섞기 그대로 · 흰 피 몸을 베면 흰 피 · 다시 붉은 피로 돌아감', () => {
  const G = newRound({ walls: false, seed: 3, AIClass: Passive });
  const f = G.player;
  const base = f.bladeBaseColor.clone();
  const mix = (hex, t) => base.clone().lerp(new THREE.Color(hex), t).getHex();
  f.bloodyBlade(0.2);
  assert.equal(f.bladeMesh.material.color.getHex(), mix(0x5a0808, 0.2));
  f.bloodyBlade(0.1, BLOOD_WHITE.blade);
  assert.equal(f.bladeMesh.material.color.getHex(), mix(BLOOD_WHITE.blade, f.bladeBlood));
  f.bloodyBlade(0.1); // 공유 색 칸이 흰색에 묶여 있지 않다
  assert.equal(f.bladeMesh.material.color.getHex(), mix(0x5a0808, f.bladeBlood));
  G.world.free();
});

test('② 단면: 흰 피 몸은 사람 단면(뼈 있음)에 흰 살 · 흰 분출 — 붉은 사람 단면 · 피 끄기 회색 그대로', () => {
  const adds = [];
  const particles = { bloodOn: true, add: (p, v, color) => adds.push(color) };
  const decap = createDecapFx(particles), limb = createLimbFx(particles);
  const make = (white) => ({ physiology: white ? bodyOf(MAD) : HUMAN_BODY, decapitated: true, wounds: [],
    groups: { chest: new THREE.Group(), head: new THREE.Group(), uarmS: new THREE.Group(), farmS: new THREE.Group() },
    severed: [{ parent: 'uarmS', parts: ['farmS'], kind: 'elbow', parentLocal: { x: 0.1, y: 0, z: 0 }, childLocal: { x: 0, y: 0.1, z: 0 } }] });
  const w = make(true), r = make(false);
  decap.update([w, r], 0.1); limb.update([w, r], 0.1);
  const disc = (f, g, name) => f.groups[g].getObjectByName(name).children.map((m) => m.material.color.getHex());
  assert.deepEqual(disc(w, 'chest', 'decapStump'), [BLOOD_WHITE.flesh, BLOOD_WHITE.rim, 0xcfc4b2]);
  assert.deepEqual(disc(r, 'chest', 'decapStump'), [0x4a0a0c, 0x6a1a18, 0xcfc4b2]);
  assert.deepEqual(disc(w, 'farmS', 'limbStump'), [BLOOD_WHITE.flesh, BLOOD_WHITE.rim, 0xcfc4b2]);
  assert.deepEqual(disc(r, 'uarmS', 'limbStump'), [0x4a0a0c, 0x6a1a18, 0xcfc4b2]);
  assert.ok(adds.includes(BLOOD_WHITE.splash) && adds.includes(0x8a0000));
  assert.ok(adds.every((c) => c === BLOOD_WHITE.splash || c === 0x8a0000));
  adds.length = 0;
  particles.bloodOn = false;
  decap.update([w, r], 0.1); limb.update([w, r], 0.1);
  assert.equal(adds.length, 0);
  for (const f of [w, r]) assert.deepEqual(disc(f, 'chest', 'decapStump').slice(0, 2), [0x3a3634, 0x4a4644]);
});

test('③ 가슴 깊은 찌르기 둘: 광기의 병마용은 사람과 똑같이 피를 흘리고 쓰러짐(목 관절 그대로) · 원본 병마용은 피 0 · 살아 있음', () => {
  const run = (sheet) => {
    const G = quiet(sheet), E = G.enemy;
    E.applyWound(wound('chest', 'chest', 'stab', 2.0, new THREE.Vector3(0.1, 0, 0)));
    E.applyWound(wound('chest', 'chest', 'stab', 2.0, new THREE.Vector3(0.1, 0.03, 0.02)));
    const trace = [];
    for (let i = 0; i < 10 / DT && E.state !== 'dead'; i++) { G.step(); if (i % 60 === 0) trace.push(+E.blood.toFixed(6)); }
    const out = { state: E.state, cause: E.causeOfDeath, blood: +E.blood.toFixed(6), t: +G.t.toFixed(3), head: !!E.jointByName.head?.joint, decap: !!E.decapitated, trace };
    G.world.free();
    return out;
  };
  const mad = run(MAD), human = run(null), clay = run(TERRA);
  assert.equal(mad.state, 'dead');
  assert.equal(mad.cause, '출혈');
  assert.ok(mad.head && !mad.decap);
  assert.deepEqual(mad, human); // 같은 상처 · 같은 판이면 붉은 피 사람과 한 자리까지 같다 (몸 규칙이 사람 그대로)
  assert.notEqual(clay.state, 'dead');
  assert.equal(clay.blood, 1);
});

test('③ 머리 찌르기 · 목 찌르기 · die(): 광기의 병마용은 참수 없이 죽음 — 원본 병마용은 머리가 떨어져야 죽음', () => {
  for (const [name, h] of [
    ['머리 찌르기 0.6', () => wound('head', 'head', 'stab', 0.6, new THREE.Vector3(0.1, 0, 0), { pass: true })],
    ['지나가지 못한 목 찌르기 0.6', () => wound('chest', 'neck', 'stab', 0.6, new THREE.Vector3(0.05, 0.19, 0))],
  ]) {
    const G = quiet(MAD), E = G.enemy;
    E.applyWound(h());
    for (let i = 0; i < 12; i++) G.step();
    assert.equal(E.state, 'dead', name);
    assert.ok(!E.decapitated && E.jointByName.head?.joint, `${name}: 목 관절 그대로`);
    G.world.free();
    const G2 = quiet(TERRA), T = G2.enemy;
    T.applyWound(h());
    for (let i = 0; i < 12; i++) G2.step();
    assert.ok(T.state === 'dead' && headless(T), `${name}: 원본 병마용은 머리가 떨어지고 죽음`);
    G2.world.free();
  }
  const G = quiet(MAD);
  G.enemy.die('출혈');
  assert.equal(G.enemy.state, 'dead'); // 사람처럼 죽음 요청을 받는다 (흙 몸은 거부)
  G.world.free();
  const G2 = quiet(TERRA);
  G2.enemy.die('출혈');
  assert.notEqual(G2.enemy.state, 'dead');
  G2.world.free();
});

test('④ 소리: 절단 · 참수는 사람 소리(흙 부서지는 소리 0) · 신음 · 죽음 · 숨 목소리 호출 0', () => {
  const sever0 = CONFIG.COMBAT.limbSever;
  CONFIG.COMBAT.limbSever = 'on';
  try {
    const G = quiet(MAD), E = G.enemy;
    const calls = [];
    const spy = new Proxy({}, { get: (_, k) => (...a) => { calls.push(String(k)); } });
    const bs = new BodySounds(spy, E, MAD.voice);
    const tick = (n) => { for (let i = 0; i < n; i++) { G.step(); bs.update(DT); } };
    E.applyWound(wound('farmO', 'arm', 'cut', 1.5, (({ x, y, z }) => new THREE.Vector3(x, y, z))(E.jointByName.farmO.joint.anchor2()), { pass: true, passing: true })); tick(6);
    E.applyWound(wound('chest', 'chest', 'cut', 1.0, new THREE.Vector3(0.1, 0, 0))); tick(300); // 깊은 상처 (사람 목소리면 신음)
    E.applyWound(wound('chest', 'neck', 'cut', 1.2, new THREE.Vector3(0.05, 0.19, 0), { pass: true, passing: true })); tick(240);
    assert.equal(E.severed?.length, 1);
    assert.ok(E.decapitated);
    assert.equal(calls.filter((k) => k === 'sever').length, 1);
    assert.equal(calls.filter((k) => k === 'decapitate').length, 1);
    assert.equal(calls.filter((k) => k === 'clayBreak').length, 0);
    assert.deepEqual(calls.filter((k) => ['hurt', 'death', 'breath', 'revive'].includes(k)), []);
    G.world.free();
  } finally {
    CONFIG.COMBAT.limbSever = sever0;
  }
  // 참수가 아닌 죽음(출혈 · 머리 · 기절)이면 BodySounds 가 death('silent') 를 부른다 — 소리 쪽에서 목소리 0 (신음도 0)
  const s = Object.create(Sound.prototype);
  let layers = 0;
  Object.assign(s, { _on: true, ctx: { currentTime: 0 }, event: () => ({}), layer: () => layers++, fadeOutWorld: () => {},
    pick: () => { throw new Error('목소리 합성 호출'); }, pickSample: () => { throw new Error('목소리 녹음 호출'); } });
  for (const cause of ['출혈', '머리', '기절']) s.death(MAD.voice, cause);
  s.hurt(MAD.voice, 1);
  assert.equal(layers, 0);
});
