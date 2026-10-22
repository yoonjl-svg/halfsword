// 드루이드의 채찍 시험 (10/23 — 샛별 저장소 69ef7dac8 에서 들여옴 · docs/import/druid_whip_2026-10-23.md)
//  스펙 · 글 · 뽑기 칸 · 인물 무기 아님 · 마디 물리(8 마디 · 벌어짐 · 유한 · 부서지지 않음) · 판 고르기(`?whip=src`) · 톡 = 손목 튕기기
//  node --test tools/sim/druid_whip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, getWeapon, weaponSpecText } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { CHARACTERS } from '../../src/characters.js';
import { WHIP, WHIP_SRC, WHIP_NOW, setWhipPreset, DRUID } from '../../src/druid_whip.js';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';

class Quiet { update() {} }
const W = () => getWeapon('druid_whip');

test('스펙 · 글: ??? · 한손 · 무유파 · 나무 · 날 없음 · 둔타 1.5 · 부서지지 않음 · 770 g · 173 cm · 두 줄 숫자 없음', () => {
  const w = W();
  assert.equal(w.id, 'druid_whip');
  assert.equal(w.nameKo, '드루이드의 채찍');
  assert.equal(w.tier, 'mystery');
  assert.equal(w.power, 1);
  assert.equal(w.grip, 'one-hand');
  assert.equal(traditionOf(w), 'none');
  assert.equal(w.material, 'wood');
  assert.equal(w.edged, false);
  assert.equal(w.mBlunt, 1.5);
  assert.equal(w.fragile, false);
  assert.equal(w.breakChance(1e9), 0);
  assert.equal(weaponSpecText(w), '한손 채찍, 173 cm, 0.77 kg');
  const lines = w.desc.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(!/[0-9]/.test(w.desc));
  // 끝 무게를 바꿔도 합 질량 · 길이는 그대로 (판 고르기 둘 다)
  for (const p of ['src', 'now']) {
    setWhipPreset(p);
    const parts = w.buildParts({});
    assert.ok(Math.abs(parts.reduce((a, q) => a + q[2][0], 0) - DRUID.mass) < 1e-9, p);
    assert.equal(parts.length, 2 + DRUID.count);
  }
  setWhipPreset('now');
});

test('뽑기 · 인물: 사람 카드 ??? 칸 넷째 · 첫 장 확률 1.5 % · 인물 무기 목록에는 없음', () => {
  const pool = WEAPON_LIST.map((x) => x.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 목록
  assert.ok(pool.includes('druid_whip'));
  const mystery = new Set(pool.filter((id) => getWeapon(id).tier === 'mystery').map((id) => getWeapon(id).drawGroup || id));
  assert.equal(mystery.size, 4);
  const total = Object.values(TIER_DRAW).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(TIER_DRAW.mystery / total / mystery.size - 0.015) < 1e-12);
  for (const c of CHARACTERS) assert.notEqual(c.weapon, 'druid_whip', c.id);
  assert.ok(!getWeapon('druid_whip').characterOnly);
});

test('판 고르기: 기본 = 지금 값 · src = 샛별 값 (덧 풀이 8 · 서보 24 · 굽힘 감쇠 없음 · 끝 무게 0.12 · 톡 찌르기)', () => {
  setWhipPreset('src');
  assert.equal(WHIP.iters, 8); assert.equal(WHIP.tip, 0.12); assert.equal(WHIP.servo.aimStiffness, 24); assert.equal(WHIP.flick, false);
  assert.ok(WHIP.bendDamp.every((x) => x === 0));
  assert.deepEqual(WHIP.bend.k, WHIP_SRC.bend.k);
  setWhipPreset('now');
  assert.equal(WHIP.iters, WHIP_NOW.iters); assert.equal(WHIP.tip, WHIP_NOW.tip); assert.equal(WHIP.flick, true);
  assert.deepEqual(W().controlOverrides, { ...W().controlOverrides, ...WHIP_NOW.servo });
});

test('마디 물리: 8 마디 · AI 끼리 6 s 벌어짐 3 cm 안 · 유한 · 끝 점 = 덩굴 마디 · 세게 쳐도 · 직접 불러도 안 부러짐', () => {
  CONFIG.ARENA.startHold = 0;
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', gap: 1.35, seed: 11, AIClass: AI, AI2Class: AI });
  const f = g.player, x = f.flexWeapon;
  assert.ok(x);
  assert.equal(x.segments.length, 8);
  assert.ok(Math.abs(f.stamina.originalMass - 0.77) < 1e-6);
  let gap = 0;
  for (let i = 0; i < 6 / DT; i++) {
    g.step();
    for (let j = 0; j < 8; j++) {
      const s = x.segments[j], p = s.body.translation();
      assert.ok([p.x, p.y, p.z].every(Number.isFinite));
      const a = new THREE.Vector3(0, -x.L / 2, 0).applyQuaternion(new THREE.Quaternion().copy(s.body.rotation())).add(new THREE.Vector3().copy(p));
      const prev = j ? x.segments[j - 1].body : f.sword;
      const b = new THREE.Vector3(0, j ? x.L / 2 : 0.13, 0).applyQuaternion(new THREE.Quaternion().copy(prev.rotation())).add(new THREE.Vector3().copy(prev.translation()));
      gap = Math.max(gap, a.distanceTo(b));
    }
  }
  assert.ok(gap < 0.03, `벌어짐 ${gap}`);
  const tip = f.bladePoint(1), last = x.segments[7].body.translation();
  assert.ok(tip.distanceTo(new THREE.Vector3().copy(last)) < x.L / 2 + 1e-6);
  for (let i = 0; i < 200; i++) f.absorbWeaponImpact(1000, { armed: true, weapon: { breakMult: 100 } });
  f.breakWeapon();
  assert.equal(f.weaponBroken, false);
  assert.equal(f.weaponCfg.bladeLength, 1.44);
  g.world.free();
});

test('톡 = 손목 튕기기 (사람 · 마무리 아님): 손 목표가 올라갔다 내려오고 끝나면 놓는다 · 덩굴 끝이 앞으로', () => {
  CONFIG.ARENA.startHold = 0;
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: 3.0, AIClass: Quiet });
  const f = g.player;
  for (let i = 0; i < 1 / DT; i++) g.step();
  assert.equal(f.skill.thrust(), true);
  assert.ok(f.skill.flick);
  assert.equal(f.skill.tap, null); // 찌르기 동작은 시작하지 않는다
  let top = -9, fwd = -9;
  for (let i = 0; i < 0.8 / DT; i++) {
    g.step();
    top = Math.max(top, f.handOffset.y);
    const t = f.bladePoint(1), c = f.bodies.chest.translation(), fw = f.forward();
    fwd = Math.max(fwd, (t.x - c.x) * fw.x + (t.z - c.z) * fw.z);
  }
  assert.ok(top > 0.4, `손 위 ${top}`);
  assert.equal(f.skill.flick, null);
  assert.equal(f.handHeld, false);
  assert.ok(fwd > 0.9, `끝 앞 ${fwd}`);
  g.world.free();
  // 샛별 판: 톡은 보통 탭 찌르기
  setWhipPreset('src');
  const g2 = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: 3.0, AIClass: Quiet });
  for (let i = 0; i < 1 / DT; i++) g2.step();
  assert.equal(g2.player.skill.thrust(), true);
  assert.ok(!g2.player.skill.flick);
  assert.ok(g2.player.skill.tap);
  g2.world.free();
  setWhipPreset('now');
});
