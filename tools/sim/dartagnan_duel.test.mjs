// 달타냥 '총사의 결투' 시험 (사장님 10/25 01:4x '달타냥은 B로 하고 배율 1.15로 해' — B = 한손검 상대)
//  값 config.js WEAPON_ABILITY.duelOneHand · 한손검 가름 weapons.js isOneHandSword · 계산 combat.js duelOneHandMult(analyze 의 공격력 자리 — 와신상담과 같은 자리)
//  node --test tools/sim/dartagnan_duel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, getWeapon, isOneHandSword } from '../../src/weapons.js';
import { WEAPON_ABILITY } from '../../src/config.js';
import { duelOneHandMult } from '../../src/combat.js';
import { newRound, THREE } from './harness_m.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const withK = (k, fn) => { const was = WEAPON_ABILITY.duelOneHand; WEAPON_ABILITY.duelOneHand = k; try { return fn(); } finally { WEAPON_ABILITY.duelOneHand = was; } };
const ONE_HAND_SWORDS = ['sabre', 'rapier', 'falchion', 'qinggang', 'ganjiang', 'moye', 'sain', 'goujian', 'dartagnan', 'hwando', 'balisarda'];

test('값 · 스펙 · 글: 1.15(사장님 10/25) · 달타냥에만 능력 · 능력 줄 \'별칭: 효과\' · 설명 두 줄 그대로', () => {
  assert.equal(WEAPON_ABILITY.duelOneHand, 1.15);
  const d = getWeapon('dartagnan');
  assert.equal(d.duelOneHand, true);
  assert.equal(d.ability, '총사의 결투: 한손검에 강함');
  assert.equal(d.desc, '세 벗과 맹세를 나눈 총사의 검.\n푸른 가죽 손잡이와 빛바랜 금빛 코등이. (총사의 결투: 한손검에 강함)');
  assert.deepEqual(Object.values(WEAPONS).filter((w) => w.duelOneHand).map((w) => w.id), ['dartagnan']);
  // 능력 줄 길이는 다른 에픽 능력 줄의 가장 긴 것(와신상담 17 자)을 넘지 않는다
  const longest = Math.max(...Object.values(WEAPONS).filter((w) => w.ability && w.id !== 'dartagnan').map((w) => w.ability.length));
  assert.ok(d.ability.length <= longest, `${d.ability.length} > ${longest}`);
});

test('한손검 가름: 한손 쥠 · 날 있음 — 날 없는 한손 무기 · 에스톡 · 양손 무기는 빠진다', () => {
  assert.deepEqual(Object.values(WEAPONS).filter(isOneHandSword).map((w) => w.id), ONE_HAND_SWORDS);
  for (const id of ['tree_branch', 'rubber_chicken', 'pistol', 'morgenstern', 'brothers_sword', 'druid_whip', 'estoc', 'longsword', 'zweihander', 'tizona', 'lightsaber', 'monohoshizao']) assert.equal(isOneHandSword(getWeapon(id)), false, id);
  assert.equal(isOneHandSword(null), false);
});

test('배율: 달타냥이 한손검을 쥔 상대 × 1.15 · 양손검 · 날 없는 무기 · 놓친 칼 1 · 달타냥 아닌 칼 1 · 끔(1) 1', () => {
  const f = (id, armed = true) => ({ weapon: getWeapon(id), armed });
  for (const v of ONE_HAND_SWORDS) near(duelOneHandMult(f('dartagnan'), f(v)), 1.15);
  for (const v of ['longsword', 'zweihander', 'tizona', 'estoc', 'morgenstern', 'tree_branch', 'pistol']) assert.equal(duelOneHandMult(f('dartagnan'), f(v)), 1, v);
  assert.equal(duelOneHandMult(f('dartagnan'), f('rapier', false)), 1); // 칼을 놓친 상대
  assert.equal(duelOneHandMult(f('rapier'), f('sabre')), 1); // 능력 없는 칼
  assert.equal(duelOneHandMult(f('balisarda'), f('rapier')), 1);
  withK(1, () => assert.equal(duelOneHandMult(f('dartagnan'), f('rapier')), 1)); // ?dartagnanAbility=0
  withK(0, () => assert.equal(duelOneHandMult(f('dartagnan'), f('rapier')), 1));
});

// 같은 판 · 같은 맞음(칼날 70 % 자리로 날 방향 14 m/s · 가슴)을 analyze 에 두 번 — 켬 · 끔 판정 에너지 비
function sameHit(weapon, weapon2) {
  const G = newRound({ seed: 1, weapon, weapon2, walls: false });
  for (let i = 0; i < 5; i++) G.step();
  const att = G.player, vic = G.enemy;
  let wI, vI;
  for (const [, i] of G.combat.info) {
    if (i.fighter === att && i.kind === 'weapon' && i.part === 'blade') wI = i;
    if (i.fighter === vic && i.part === 'chest') vI = i;
  }
  const S0 = att.cache.sword, P = vic.cache.parts.chest;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(S0.q);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(S0.q);
  const point = S0.p.clone().addScaledVector(axis, att.weaponCfg.hiltLength + 0.7 * att.weaponCfg.bladeLength);
  const S = { p: S0.p.clone(), q: S0.q.clone(), com: S0.com.clone(), v: edge.multiplyScalar(14), w: new THREE.Vector3() };
  const Pz = { p: P.p.clone(), q: P.q.clone(), com: P.com.clone(), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const hit = () => G.combat.analyze({ w: wI, v: vI }, point, S, Pz, true);
  return { on: hit(), off: withK(1, hit) };
}

test('판정: 한손검 상대(레이피어 · 세이버)는 같은 맞음의 판정 에너지 × 1.15 · 양손검 상대(롱소드 · 츠바이핸더)는 그대로 · 끔이면 그대로', () => {
  for (const v of ['rapier', 'sabre']) {
    const { on, off } = sameHit('dartagnan', v);
    assert.equal(on.type, 'cut', v);
    near(on.eff / off.eff, 1.15, 1e-12);
    near(on.duelOneHand, 1.15);
    assert.equal(off.duelOneHand, undefined); // 끔(1)이면 결과에 배율 칸도 없다
    assert.ok(on.severity > off.severity, v);
  }
  for (const v of ['longsword', 'zweihander']) {
    const { on, off } = sameHit('dartagnan', v);
    assert.equal(on.eff, off.eff, v);
    assert.equal(on.severity, off.severity, v);
    assert.equal(on.duelOneHand, undefined, v);
  }
  // 달타냥이 아닌 칼(레이피어)로 레이피어를 쳐도 그대로
  const { on, off } = sameHit('rapier', 'rapier');
  assert.equal(on.eff, off.eff);
  assert.equal(on.duelOneHand, undefined);
});
