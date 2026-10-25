// 파펜하이머 시험 (10/25 — 샛별 저장소 e3e1f144 에서 들여옴 · 사장님 10/25 결정 베기 0.9 · 찌르기 1.15 (19:0x — 전 0.85 · 1.10) · 사장님 글 · docs/import/pappenheimer_import_2026-10-25.md)
//  스펙 · 질량 배분 · 이탈리아 넷과 다른 손맛(배율 · 무게 — 사장님 10/25 신규 무기 원칙) · 글 · 겉모습(밝은 테 · 피 묻는 칼날 · 썸네일) · 이탈리아 꾸러미 · AI 간격 줄 ·
//  총사의 결투 한손검 · 사람 카드 칸 · 짧은 판
//  node --test tools/sim/pappenheimer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, TIER_FRAGILITY, THRUST_STYLE, getWeapon, weaponSpecText, isOneHandSword } from '../../src/weapons.js';
import { weaponPhysics } from '../../src/weapon_class.js';
import { traditionOf, schoolOf } from '../../src/schools.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { LIB_PARRY, HAND_GRIPS } from '../../src/frames.js';
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';
import { duelOneHandMult } from '../../src/combat.js';
import { newRound, DT, AI } from './harness_m.mjs';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b} (±${eps})`);
const W = () => getWeapon('pappenheimer');
const ITALIAN = ['rapier', 'dartagnan', 'balisarda'];

test('스펙: 레어 · 이탈리아 · 한손 · 찌르기 틀 · 베기 0.9 · 찌르기 1.15(사장님 10/25 19:0x) · 둔타 0.70 · 레어 계수 · 레이피어 찌르기 장점 · 111 cm · 1.34 kg', () => {
  const w = W();
  assert.equal(w.id, 'pappenheimer');
  assert.equal(w.nameKo, '파펜하이머');
  assert.equal(w.tier, 'rare');
  assert.equal(traditionOf(w), 'italian');
  assert.equal(w.grip, 'one-hand');
  assert.equal(w.frame, 'one');
  assert.equal(w.style, 'thrust');
  near(w.mCut, 0.9); near(w.mThrust, 1.15); near(w.mBlunt, 0.7);
  near(w.power, 1.05);
  assert.equal(w.fragility, TIER_FRAGILITY.rare);
  assert.equal(w.thrustStyle, THRUST_STYLE.rapier);
  assert.ok(!w.ability && !w.duelOneHand && !w.ignoreArmor);
  near(w.bladeLength, 0.892); near(w.hiltLength + w.bladeLength, 1.0, 1e-9);
  assert.equal(weaponSpecText(w), '한손 찌르기검, 111 cm, 1.34 kg');
});

test('질량 배분 (샛별 저장소 값 그대로): 자루 0.09 · 폼멜 0.24 · 방호판 0.37 · 칼날 0.54 · 숨은 가로대 0.10 (실폭 21.3 cm · 안 그림) = 1.34 kg', () => {
  const w = W(), parts = w.buildParts({}), p = weaponPhysics(w);
  assert.deepEqual(parts.map((q) => q[2][0]), [0.09, 0.24, 0.37, 0.54, 0.1]);
  near(p.mass, 1.34, 1e-9); near(p.com, 0.1817, 5e-4); near(p.I, 0.1314, 5e-4);
  const cross = parts[4];
  assert.deepEqual(cross[0], ['box', 0.1065, 0.0035, 0.004]);
  assert.equal(cross[3], null);
  assert.equal(cross[4], false);
  assert.deepEqual(parts.map((q) => q[4]), [false, false, false, true, false]);
  near(parts[3][2][2], 0.54 * (0.25 * 0.892) ** 2, 1e-12); // bladeInertia Ie
  near(parts[3][2][1], (0.36 - 0.5) * 0.892, 1e-12); // bladeInertia comY
});

test('다른 손맛 (사장님 10/25 \'같은 계열 기존 무기들과 다른 손맛\' · \'베기도 잘 할 수 있는 검\'): 이탈리아 넷 가운데 베기 가장 셈 · 찌르기 가장 약함 · 가장 무겁고 손에서 가장 묵직하게 돎 · 손 ~ 칼끝은 달타냥과 레이피어 사이', () => {
  const w = W(), p = weaponPhysics(w);
  for (const id of ITALIAN) {
    const o = getWeapon(id), q = weaponPhysics(o);
    assert.ok(w.mCut > o.mCut, `${id} 베기 ${o.mCut}`);
    assert.ok(w.mThrust < o.mThrust, `${id} 찌르기 ${o.mThrust}`);
    assert.ok(p.mass > q.mass && p.I > q.I, `${id} 질량 ${q.mass} · 관성 ${q.I}`);
  }
  const reach = (id) => getWeapon(id).hiltLength + getWeapon(id).bladeLength;
  assert.ok(reach('dartagnan') < reach('pappenheimer') && reach('pappenheimer') < reach('rapier'));
});

test('글: 사장님 10/25 글 그대로 (두 줄 · 숫자 없음)', () => {
  assert.equal(W().desc, '롱소드와 레이피어의 장점을 흡수한 결투용 검.\n구멍 뚫린 두 방호판이 손을 감싸 지킨다.');
  assert.ok(!/[0-9]/.test(W().desc));
});

test('겉모습: 칼날 뿌리 Mesh(피 묻음) · 자루 · 폼멜 · 칼날은 콜라이더 안 · 코등이 폭 21.3 cm = 숨은 가로대 · 검푸른 강철에 밝은 테 · 유한 · 썸네일 256²', () => {
  const w = W(), parts = w.buildParts({});
  const meshes = parts.map(([shape, , , color, blade], i) => w.partMesh(i, blade, shape, color ?? 0x888888, {}, {}, w.tier));
  assert.ok(meshes[3].isMesh, '칼날 뿌리는 Mesh');
  assert.equal(meshes[4], undefined); // 숨은 가로대는 partMesh 가 그리지 않음 (fighter.js 가 색 null 로 감춤)
  for (const i of [0, 1, 3]) {
    const shape = parts[i][0], root = meshes[i];
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), h = shape[0] === 'box' ? shape.slice(1) : Array(3).fill(shape[1]);
    const over = Math.max(0, ...['x', 'y', 'z'].flatMap((a, j) => [box.max[a] - h[j], -h[j] - box.min[a]]));
    assert.ok(over < 0.01, `부품 ${i} 콜라이더 밖 ${over}`);
  }
  const g = meshes[2];
  g.updateMatrixWorld(true);
  const gb = new THREE.Box3().setFromObject(g);
  near(gb.max.x - gb.min.x, 2 * parts[4][0][1], 0.004); // 가로대 그림 폭 = 숨은 가로대 콜라이더 폭 (곡선 보간 넘침을 맞춤)
  const colors = new Set();
  g.traverse((m) => { if (m.isMesh) { colors.add(m.material.color.getHex()); assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite)); } });
  assert.ok(colors.has(0x35414a), '검푸른 강철');
  assert.ok([...colors].some((c) => [16, 8, 0].every((k) => ((c >> k) & 255) > 0xd0)), '밝은 강철 테 (사장님 10/25 승인 — 감독 안 ①)');
  const thumb = fs.readFileSync(new URL('../../public/ui/weapons/pappenheimer.webp', import.meta.url));
  assert.equal(thumb.toString('ascii', 0, 4), 'RIFF');
  assert.equal(thumb.toString('ascii', 8, 12), 'WEBP');
  const kind = thumb.toString('ascii', 12, 16);
  assert.equal(kind, 'VP8X'); // 투명 배경 (알파)
  assert.deepEqual([1 + thumb.readUIntLE(24, 3), 1 + thumb.readUIntLE(27, 3)], [256, 256]);
});

test('유파 · AI: 이탈리아 — 자세표 · 쥠 · 빈팔 · 막기 · 동작 · 기술이 레이피어와 같음 · 막기 자리 · 손 쥠 줄 = 레이피어 · 간격 줄 1.51/1.66/1.20 · 베는 시간 0.19', () => {
  const a = resolveSwordArt(W()), r = resolveSwordArt(getWeapon('rapier'));
  assert.equal(a.tradition, 'italian');
  for (const k of ['table', 'grip', 'offArm', 'parry', 'motion', 'tech', 'feints']) assert.deepEqual(a[k], r[k], k);
  assert.deepEqual(LIB_PARRY.pappenheimer, LIB_PARRY.rapier);
  assert.deepEqual(HAND_GRIPS.pappenheimer, HAND_GRIPS.rapier);
  const s = schoolOf('pappenheimer');
  assert.equal(s.weapon, 'pappenheimer');
  assert.equal(s.tradition, 'italian');
  assert.deepEqual(MEASURED.pappenheimer, [1.51, 1.66, 1.20, 0.26]);
  assert.equal(CUT_TIME_30.pappenheimer, 0.19);
  assert.deepEqual(s.measure, { contact: 1.51, reach: 1.66, clinch: 1.20, cutTime: 0.19 });
  // 같은 실행 차례: 맞닿는 간격 · 한 걸음 간격이 달타냥보다 길다 (칼이 4.2 cm 김 — 전달본 줄은 거꾸로였다)
  assert.ok(MEASURED.pappenheimer[0] > MEASURED.dartagnan[0] && MEASURED.pappenheimer[1] > MEASURED.dartagnan[1]);
});

test('총사의 결투: 한손 날 있는 칼이라 한손검 — 달타냥이 파펜하이머를 쥔 상대를 치면 × 1.15', () => {
  const f = (id, armed = true) => ({ weapon: getWeapon(id), armed });
  assert.equal(isOneHandSword(W()), true);
  near(duelOneHandMult(f('dartagnan'), f('pappenheimer')), 1.15);
  assert.equal(duelOneHandMult(f('pappenheimer'), f('dartagnan')), 1); // 파펜하이머는 능력 없음
  assert.equal(Object.values(WEAPONS).filter(isOneHandSword).length, 12);
});

test('사람 카드: 뽑기 목록에 있음 · 레어 칸 다섯째(이탈리아 레어 빈칸을 채움) · 편지 없으면 첫 장 5.2 %', () => {
  const pool = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 식
  assert.ok(pool.includes('pappenheimer'));
  assert.ok(!W().characterOnly);
  const rare = pool.filter((id) => WEAPONS[id].tier === 'rare');
  assert.deepEqual(rare.filter((id) => traditionOf(WEAPONS[id]) === 'italian'), ['pappenheimer']);
  const slots = new Set(rare.map((id) => WEAPONS[id].drawGroup || id));
  assert.equal(slots.size, 5);
  const sum = Object.keys(TIER_DRAW).filter((t) => pool.some((id) => WEAPONS[id].tier === t)).reduce((a, t) => a + TIER_DRAW[t], 0);
  near(TIER_DRAW.rare / sum / slots.size, 0.052, 1e-9);
});

test('짧은 판: 파펜하이머 AI 대 롱소드 AI 3 s — 유한 · 피 묻음 · 안 부러짐 · 질량 1.34', () => {
  const G = newRound({ seed: 7, weapon: 'pappenheimer', weapon2: 'longsword', AI2Class: AI });
  const p = G.player;
  assert.ok(p.bladeMesh.isMesh);
  p.bloodyBlade(0.1);
  assert.ok(p.bladeBlood > 0);
  for (let i = 0; i < 3 / DT; i++) {
    G.step();
    const tip = p.bladePoint(1);
    assert.ok([tip.x, tip.y, tip.z].every(Number.isFinite));
  }
  assert.ok(!p.weaponBroken);
  near(p.swordMass, 1.34, 1e-6);
  G.world.free();
});
