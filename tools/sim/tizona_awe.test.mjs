// 티소나 '위세' 시험 (사장님 10/24 11:3x · 11:4x 판 시작 최대 기력 − 15 · 값 config.js WEAPON_ABILITY · 계산 src/stamina.js applyAweStart)
//  node --test tools/sim/tizona_awe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
import { Stamina, applyAweStart } from '../../src/stamina.js';
import { STAMINA, WEAPON_ABILITY } from '../../src/config.js';
import { getWeapon, WEAPONS, WEAPON_ALIASES } from '../../src/weapons.js';
import { newRound, DT, AI } from './harness_m.mjs';

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { index: 0, alive: true, armed: true, weaponBroken: false, aiControlled: false, state: 'stand', heading: 0, swordMass: 2.9, pain: 0,
    move: new Vector2(), handOffset: new Vector2(), weapon: getWeapon('longsword'), bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f);
  return f;
}
const tizona = () => getWeapon('tizona');

test('값 · 카드 · 몸: 막힘 깎음 끔 · 판 시작 15 · 티소나만 능력 · 카드 능력 줄 · 사장님 설명 그대로 · 칼날 1.05 m · 2.3 kg · 앞무게 이베리아 · 츠바이핸더 그대로', () => {
  assert.equal(WEAPON_ABILITY.aweStart, 15); // 판 시작 최대 기력 − 15 (고정 — 사장님 11:4x)
  const T = tizona();
  assert.equal(T.id, 'tizona'); assert.equal(T.tier, 'epic'); assert.equal(T.awe, true);
  assert.equal(T.ability, '위세: 상대 기력 감소'); // 사장님 10/24 11:2x
  assert.equal(T.desc, '엘 시드가 부카르를 쓰러뜨리고 얻은 명검.\n그의 적들은 티소나를 알아보고 두려움에 사로잡혔다. (위세: 상대 기력 감소)');
  for (const [id, w] of Object.entries(WEAPONS)) if (id !== 'tizona') assert.ok(!w.awe, `${id} 에 위세가 있으면 안 됨`);
  const Z = getWeapon('zweihander');
  const mass = (w) => w.buildParts({}).reduce((a, p) => a + p[2][0], 0);
  near(T.bladeLength, 1.05); near(T.hiltLength + T.bladeLength, 1.195); near(mass(T), 2.3, 1e-9); // 사장님 10/21 23:4x · 23:5x
  near(T.buildParts({})[3][2][0], 1.62, 1e-9); // 늘린 무게는 칼날에
  assert.deepEqual(T.buildParts({}).map((p) => [p[0], p[1]]).slice(0, 3), Z.buildParts({}).map((p) => [p[0], p[1]]).slice(0, 3)); // 자루 · 폼멜 · 날밑 모양 · 자리(쥠)는 같음
  near(T.gripAlong, Z.gripAlong); near(T.hiltLength, Z.hiltLength);
  assert.equal(T.frame, 'heavy'); assert.equal(T.school, 'iberian');
});

test('북부 대공의 검 지움: 무기 목록에 없음 · 옛 id ice = 츠바이핸더 · 라트나는 츠바이핸더 · 플랑베르주 레어', async () => {
  assert.equal(WEAPONS.ice, undefined);
  assert.equal(WEAPON_ALIASES.ice, 'zweihander');
  assert.equal(getWeapon('ice').id, 'zweihander');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  for (const id of ['ratna', 'ratna_mad']) { assert.equal(CHARACTERS_BY_ID[id].weapon, 'zweihander'); assert.equal(CHARACTERS_BY_ID[id].ai.persona.school, 'zweihander'); }
  const { schoolOf } = await import('../../src/schools.js');
  assert.equal(schoolOf('zweihander').tradition, 'iberian');
  const F = getWeapon('flamberge');
  assert.equal(F.tier, 'rare'); near(F.power, 1.05); near(F.fragility, 0.032); assert.ok(!F.ability);
  assert.equal(Object.keys(WEAPONS).length, 34); // 28 (+ 티소나 − 북부 대공의 검) + 발리사르다 · 무라마사 (dev 가지 e3b1532) + 드루이드의 채찍 (10/23) + 뒤랑달 (10/24) + 파펜하이머 (10/25) + 적소검 (10/27)
});

test('몸 길이 (사장님 10/21 23:5x · 10/25 22:5x 손맛 · 10/27 21:2x): 츠바이핸더 손 ~ 칼끝 1.335 m · 2.865 kg 그대로 · 플랑베르주 칼날 1.30 m · 3.2 kg(폼멜 0.35) · 서보 22 · 티소나 앞무게(무게중심 0.368 m · 관성은 츠바이핸더 · 플랑베르주보다 작음)', async () => {
  const { weaponPhysics } = await import('../../src/weapon_class.js');
  const { FLAMBERGE_MUSEUM, FLAMBERGE_GAME } = await import('../../src/flamberge_look.js');
  const Z = getWeapon('zweihander'), F = getWeapon('flamberge'), T = getWeapon('tizona');
  const pz = weaponPhysics(Z), pf = weaponPhysics(F), pt = weaponPhysics(T);
  near(Z.hiltLength + Z.bladeLength, 1.335, 1e-9); near(pz.mass, 2.865, 1e-9); near(pz.I, 0.749, 0.001);
  assert.deepEqual({ ...FLAMBERGE_MUSEUM }, { overall: 1.689, blade: 1.187, ricasso: 0.267, guard: 0.505, handle: 0.492 }); // 박물관 기록은 그대로
  near(FLAMBERGE_GAME.blade, 1.30); near(FLAMBERGE_GAME.handle, 0.437); near(FLAMBERGE_GAME.overall, 1.747); // 손잡이 47.7 → 43.7 cm (사장님 10/22 03:3x) · 칼날 1.162 → 1.30 m (10/25 손맛 — 전체 160.9 → 174.7 cm)
  near(F.bladeLength, 1.30); near(F.hiltLength + F.bladeLength, 1.385, 1e-9); // 전 1.162 · 1.247
  const fm = F.buildParts({}).map((p) => p[2][0]);
  near(pf.mass, 3.2, 1e-9); near(fm[1], 0.35); near(fm[3], 1.989, 0.001); near(pf.com, 0.329, 0.001); near(pf.I, 1.029, 0.001); // 10/25 손맛: 칼끝 쪽 토막 0.2 kg (전 3.0 kg · 칼날 1.789 · 무게중심 0.263 · 관성 0.682)
  assert.equal(F.controlOverrides.maxAimTorque, 22); // 10/25 손맛 '세우기 어려운 칼' (전 두 손 쥠 기본값 26)
  { // 칼자루 충돌체는 손에서 −0.28 m 까지만 (사장님 10/22 03:3x 'a로' — 묻힘 균형으로 −0.25 → −0.28) — 폼멜 질량은 −0.33 에 그대로
    const fp = F.buildParts({});
    near(fp[0][1] - fp[0][0][2], -0.28, 1e-9); near(fp[1][1], -0.28, 1e-9); near(fp[1][1] + fp[1][2][1], -0.33, 1e-9); near(fp[0][1] + fp[0][2][1], -0.13, 1e-9);
  } assert.ok(pf.I / 0.2724 >= 2.5, `플랑베르주 관성 ${pf.I}`);
  near(pt.mass, 2.3, 1e-9); near(pt.com, 0.368, 0.001); near(pt.I, 0.675, 0.001); near(T.hiltLength + T.bladeLength, 1.195, 1e-9); // 10/27 손맛 앞무게 — 칼날 질량 분포를 그림 꼴에서 (전 무게중심 0.339 · 관성 0.586)
  assert.ok(pt.I < pz.I && pt.I < pf.I, `티소나 관성 ${pt.I} — 츠바이핸더 · 플랑베르주보다 작다 (사장님 10/27 21:2x)`);
  { const { TIZONA_COLORS } = await import('../../src/tizona_details.js'); assert.ok(TIZONA_COLORS); } // 겉모습 모듈은 들여온 그대로 (칼날 그림 꼴 0.28 · 0.45)
  assert.equal(T.controlOverrides.maxAimTorque, 26); assert.equal(Z.controlOverrides.maxAimTorque, 26);
  assert.ok(pt.mass * pt.com > pz.mass * pz.com && pt.com > pz.com, '티소나 중력 몫(질량 × 무게중심)이 츠바이핸더보다 크다'); // 0.846 · 0.834 kg·m · 무게중심 0.368 · 0.291 m
  for (const w of [Z, F, T]) assert.equal(w.frame, 'heavy');
});

test('위세 판 시작 (사장님 10/24 11:3x): 티소나를 든 쪽의 상대는 최대 기력 − 15 로 시작 · 그 판 내내 · 막대는 깎인 몫이 빈 칸 · 다른 칼 · 기력 무한', () => {
  const a = actor({ index: 1, weapon: tizona() });
  for (const want of [15]) { // 고정 15 (무작위 아님 — 몇 번 해도 같다)
    const v = actor();
    assert.deepEqual(applyAweStart(a, v), { loss: want }); assert.deepEqual(applyAweStart(a, actor()), { loss: want });
    near(v.stamina.max, STAMINA.max - want); near(v.stamina.value, STAMINA.max - want);
    near(v.stamina.ratio, (STAMINA.max - want) / STAMINA.max); // 가득 차도 깎인 몫만큼 빈 칸
  }
  const v = actor(); assert.equal(applyAweStart(actor({ weapon: getWeapon('zweihander') }), v), null); near(v.stamina.max, STAMINA.max); // 다른 칼은 없음
  const t = actor({ weapon: tizona() }); assert.equal(applyAweStart(actor(), t), null); near(t.stamina.max, STAMINA.max); // 티소나 주인은 안 깎임
  const h = actor(); h.stamina.setInfinite(true); applyAweStart(a, h); near(h.stamina.value, STAMINA.max - 15); assert.equal(h.stamina.infinite, true); // 기력 무한: 깎인 최대로 늘 가득
  const k = actor(); k.stamina.setMaxBonus(30); applyAweStart(a, k); near(k.stamina.max, STAMINA.max + 30 - 15); // 케틀 햇 덧과 함께
  const was = WEAPON_ABILITY.aweStart;
  try { WEAPON_ABILITY.aweStart = null; const z = actor(); assert.equal(applyAweStart(a, z), null); near(z.stamina.max, STAMINA.max); } finally { WEAPON_ABILITY.aweStart = was; }
});

test('위세 막힘 깎음은 꺼짐 (10/24): AI 대 AI 실제 판에서 막힌 티소나 공격이 있어도 상대 기력 awe 청구 0', () => {
  const G = newRound({ walls: true, weapon: 'tizona', weapon2: 'longsword', seed: 9, AI2Class: AI });
  for (let i = 0; i < 7.5 / DT; i++) G.step();
  assert.equal(G.enemy.stamina.counts.awe ?? 0, 0);
  assert.equal(G.player.stamina.counts.awe ?? 0, 0);
});
