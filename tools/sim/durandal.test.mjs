// 뒤랑달 시험 (10/24 — 샛별 저장소 c039bcc7 에서 들여옴 · 사장님 10/24 베기 1.1 · 폼멜 0.55 · 칼날 1.17 kg · docs/import/durandal_import_2026-10-24.md)
//  스펙 · 질량 배분 · 부품 관성(같은 도우미 식) · 글 · 겉모습(콜라이더 안 · 피 묻는 칼날 메쉬 · 기운 · 썸네일) · 이베리아 몬탄테 꾸러미 · AI 간격 줄 · 롤랑 · 사람 카드 칸 · 짧은 판
//  node --test tools/sim/durandal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, getWeapon, weaponSpecText } from '../../src/weapons.js';
import { weaponPhysics } from '../../src/weapon_class.js';
import { traditionOf, schoolOf } from '../../src/schools.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { AURA_PROFILES } from '../../src/aura.js';
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { newRound, DT, AI } from './harness_m.mjs';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b} (±${eps})`);
const W = () => getWeapon('durandal');

test('스펙: 레전드 · 이베리아 · 양손 · 무거운 틀 · 베기 1.1(사장님 10/24) · 찌르기 0.9 · 둔타 1.05 · 힘 1.2 · 안 부러짐 · 155 cm · 2.2 kg · 손 사이 22 cm', () => {
  const w = W();
  assert.equal(w.id, 'durandal');
  assert.equal(w.nameKo, '뒤랑달');
  assert.equal(w.tier, 'legend');
  assert.equal(traditionOf(w), 'iberian');
  assert.equal(w.grip, 'two-hand');
  assert.equal(w.frame, 'heavy');
  assert.equal(w.style, 'cut');
  near(w.mCut, 1.1); near(w.mThrust, 0.9); near(w.mBlunt, 1.05);
  near(w.power, 1.2);
  assert.equal(w.fragility, 0);
  assert.equal(w.breakChance(1e9), 0);
  assert.ok(!w.ability && !w.awe && !w.ignoreArmor);
  near(w.bladeLength, 1.159); near(w.hiltLength + w.bladeLength, 1.289, 1e-9); near(w.gripAlong, -0.22);
  const g = w.buildParts({})[0]; // 두 손 자리(칼 원점 · gripAlong)가 감개 콜라이더 안
  for (const y of [0, w.gripAlong]) assert.ok(Math.abs(y - g[1]) <= g[0][2], `손 자리 ${y}`);
  assert.equal(weaponSpecText(w), '대형 양손검, 155 cm, 2.2 kg');
});

test('질량 배분 (사장님 10/24 02:3x · 10/25 손맛 — 칼날 0.05 kg 를 폼멜로): 감개 0.24 · 폼멜 0.60 · 코등이 0.24 · 칼날 1.12 kg · 무게중심 0.223 m · 손 관성 0.464 · 서보 30 · 부품 관성 = 같은 도우미 식', () => {
  const w = W(), parts = w.buildParts({}), p = weaponPhysics(w);
  assert.deepEqual(parts.map((q) => q[2][0]), [0.24, 0.6, 0.24, 1.12]);
  near(p.mass, 2.2, 1e-9); near(p.com, 0.2231, 5e-4); near(p.I, 0.4640, 5e-4);
  assert.equal(w.controlOverrides.maxAimTorque, 30); // 10/25 손맛 '무겁지만 말을 듣는 칼' (전 두 손 쥠 기본값 26)
  const L = w.bladeLength;
  near(parts[1][2][2], 0.4 * 0.6 * 0.036 ** 2, 1e-12); // sphereInertia
  near(parts[0][2][2], (0.24 * (0.04 ** 2 + 0.328 ** 2)) / 12, 1e-12); // boxInertia 감개
  near(parts[2][2][2], (0.24 * (0.26 ** 2 + 0.04 ** 2)) / 12, 1e-12); // boxInertia 코등이
  near(parts[3][2][2], 1.12 * (0.245 * L) ** 2, 1e-12); // bladeInertia Ie
  near(parts[3][2][1], (0.36 - 0.5) * L, 1e-12); // bladeInertia comY
  near(parts[3][2][3], 0.0000736 * (1.12 / 0.842) * ((0.06 * 0.018) / (0.048 * 0.016)), 1e-12); // bladeInertia It
  // 대검 넷 가운데: 손 ~ 칼끝은 플랑베르주 · 츠바이핸더 다음(10/25 플랑베르주 칼날 1.30 m 뒤) · 손에서 도는 관성은 가장 작고 서보는 가장 세다
  const big = ['zweihander', 'tizona', 'flamberge'].map((id) => ({ id, I: weaponPhysics(getWeapon(id)).I, cap: getWeapon(id).controlOverrides.maxAimTorque, reach: getWeapon(id).hiltLength + getWeapon(id).bladeLength }));
  for (const b of big) assert.ok(p.I < b.I && w.controlOverrides.maxAimTorque > b.cap, `${b.id} 관성 ${b.I} · 서보 ${b.cap}`);
  const byReach = [...big, { id: 'durandal', reach: 1.289 }].sort((a, b) => b.reach - a.reach).map((x) => x.id);
  assert.deepEqual(byReach.slice(0, 3), ['flamberge', 'zweihander', 'durandal']);
});

test('글: 두 줄 · 숫자 없음 (편집 지침 — 역사 + 생김새)', () => {
  const lines = W().desc.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '롤랑이 바위에 내리쳐도 부서지지 않았다는 성검.');
  assert.equal(lines[1], '금빛 자루에는 성인들의 유물이 봉해져 있다.');
  assert.ok(!/[0-9]/.test(W().desc));
});

test('겉모습: 부품 메쉬가 콜라이더 안 · 칼날 뿌리는 Mesh(피 묻음) · 유한 · 레전드 기운 · 썸네일', () => {
  const w = W();
  for (const [i, [shape, , , color, blade]] of w.buildParts({}).entries()) {
    const root = w.partMesh(i, blade, shape, color, {}, {}, w.tier);
    if (blade) assert.ok(root.isMesh, '칼날 뿌리는 Mesh');
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), h = shape[0] === 'box' ? shape.slice(1) : Array(3).fill(shape[1]);
    const over = Math.max(0, ...['x', 'y', 'z'].flatMap((a, j) => [box.max[a] - h[j], -h[j] - box.min[a]]));
    assert.ok(over < 0.001, `부품 ${i} 콜라이더 밖 ${over}`);
    root.traverse((m) => { if (m.isMesh) assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite)); });
  }
  assert.ok(AURA_PROFILES.durandal);
  assert.ok(fs.existsSync(new URL('../../public/ui/weapons/durandal.webp', import.meta.url)));
});

test('유파 · AI: 이베리아 몬탄테 — 자세표 · 쥠 · 빈팔 · 막기 · 동작 · 기술이 츠바이핸더와 같음 · 간격 줄 1.70/1.94/1.35 · 베는 시간 0.32', () => {
  const a = resolveSwordArt(W()), z = resolveSwordArt(getWeapon('zweihander'));
  assert.equal(a.tradition, 'iberian');
  for (const k of ['table', 'grip', 'offArm', 'parry', 'motion']) assert.deepEqual(a[k], z[k], k);
  const s = schoolOf('durandal');
  assert.equal(s.weapon, 'durandal');
  assert.equal(s.tradition, 'iberian');
  assert.deepEqual(s.tech.map((t) => t.name), schoolOf('zweihander').tech.map((t) => t.name));
  assert.deepEqual(MEASURED.durandal, [1.71, 1.92, 1.36, 0.42]); // 10/25 손맛 뒤 다시 잼 (전 [1.70, 1.94, 1.35, 0.44] · 0.32)
  assert.equal(CUT_TIME_30.durandal, 0.30);
  assert.deepEqual(s.measure, { contact: 1.71, reach: 1.92, clinch: 1.36, cutTime: 0.30 });
});

test('롤랑: 무기 · AI 꾸러미 = 뒤랑달 · 숙련도 6 · 버티는 힘 1.1 그대로 · 베르나르도는 티소나 그대로', () => {
  const r = CHARACTERS_BY_ID.roland, b = CHARACTERS_BY_ID.bernardo;
  assert.equal(r.weapon, 'durandal');
  assert.equal(r.ai.persona.school, 'durandal');
  assert.equal(r.ai.proficiency, 6);
  assert.deepEqual(r.ai.persona.proficiency, { iberian: 6 });
  assert.equal(r.vitality, 1.1);
  assert.equal(b.weapon, 'tizona');
  assert.equal(b.ai.persona.school, 'tizona');
});

test('사람 카드: 뽑기 목록에 있음 · 레전드 칸 다섯째 (등급 확률 6 % 그대로 — 편지 없으면 첫 장 1.2 %)', () => {
  const pool = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 식
  assert.ok(pool.includes('durandal'));
  assert.ok(!W().characterOnly);
  const slots = new Set(pool.filter((id) => WEAPONS[id].tier === 'legend').map((id) => WEAPONS[id].drawGroup || id));
  assert.equal(slots.size, 5);
  assert.equal(TIER_DRAW.legend, 6);
  const sum = Object.keys(TIER_DRAW).filter((t) => pool.some((id) => WEAPONS[id].tier === t)).reduce((a, t) => a + TIER_DRAW[t], 0);
  near(TIER_DRAW.legend / sum / slots.size, 0.012, 1e-9);
});

test('짧은 판: 뒤랑달 AI 대 롱소드 AI 3 s — 유한 · 두 손 쥠 · 피 묻음 · 안 부러짐 · 질량 2.2', () => {
  const G = newRound({ seed: 7, weapon: 'durandal', weapon2: 'longsword', AI2Class: AI });
  const p = G.player;
  assert.ok(p.bladeMesh.isMesh);
  p.bloodyBlade(0.1);
  assert.ok(p.bladeBlood > 0);
  let grip = 0, stand = 0;
  for (let i = 0; i < 3 / DT; i++) {
    G.step();
    const tip = p.bladePoint(1);
    assert.ok([tip.x, tip.y, tip.z].every(Number.isFinite));
    if (p.state === 'stand') { stand++; if (p.gripping) grip++; }
  }
  assert.ok(!p.weaponBroken);
  near(p.swordMass, 2.2, 1e-6);
  assert.ok(grip / Math.max(1, stand) > 0.8, `두 손 쥔 몫 ${grip}/${stand}`);
  G.world.free();
});
