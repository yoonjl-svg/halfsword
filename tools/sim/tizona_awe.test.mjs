// 티소나 '위세' 시험 (사장님 10/21 23:xx 막힘 깎음 → 10/24 11:3x · 11:4x 판 시작 최대 기력 − 15 · 값 config.js WEAPON_ABILITY · 계산 src/stamina.js applyAweStart · 옛 spendAweDrain)
//  이 칼의 공격이 상대 칼에 막히면(못 벰 · 칼끼리 닿음 — 독일 인데스 '막힘'과 같은 가름) 막은 쪽 기력 − 8 · 한 공격에 한 번 · 1.5 s 에 한 번 ·
//  맞힘 · 헛침은 없음 · 칼 주인이 사람이든(skill.js whiffEnd) AI 든(ai.js afterStrike) 같다
//  node --test tools/sim/tizona_awe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2, Vector3 } from 'three';
import { Stamina, spendAweDrain, applyAweStart } from '../../src/stamina.js';
import { STAMINA, WEAPON_ABILITY, UNIQUE_ASSIST, realS } from '../../src/config.js'; // realS: 표준 시간(10/25) — 위세 틈 1.5 s 는 실제 초
import { getWeapon, WEAPONS, WEAPON_ALIASES } from '../../src/weapons.js';
import { Skill } from '../../src/skill.js';
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
// 옛 판(10/21 — 막힘마다 기력 −8): 10/24 사장님 결정으로 끔(aweDrain 0) · 스위치로 남긴 셈이 그대로 도는지 이 시험들은 8 로 켜고 본다
const oldDrain = (fn) => () => { const was = WEAPON_ABILITY.aweDrain; WEAPON_ABILITY.aweDrain = 8; try { return fn(); } finally { WEAPON_ABILITY.aweDrain = was; } };

test('값 · 카드 · 몸: 막힘 깎음 끔 · 판 시작 15 · 티소나만 능력 · 카드 능력 줄 · 사장님 설명 그대로 · 칼날 1.05 m · 2.3 kg · 앞무게 이베리아 · 츠바이핸더 그대로', () => {
  assert.equal(WEAPON_ABILITY.aweDrain, 0); // 10/24 사장님 — 막힘마다 깎던 몫 끔(옛 판 8)
  assert.equal(WEAPON_ABILITY.aweStart, 15); // 판 시작 최대 기력 − 15 (고정 — 사장님 11:4x)
  assert.equal(WEAPON_ABILITY.aweGap, realS(1.5)); // 실제 1.5 s (표준 시간 10/25 — 게임 1.65)
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

test('spendAweDrain: 막은 쪽 −8 · 1.5 s 안엔 다시 안 깎음(1.5 s 지나면 다시) · 능력 없는 칼 · 부러진 칼 · 빈손 · 기력 무한 · 0 이면 없음', oldDrain(() => {
  const A = actor({ index: 1, weapon: tizona() }), V = actor({ index: 0 });
  const v0 = V.stamina.value;
  const e = spendAweDrain(A, V);
  assert.ok(e); near(V.stamina.value, v0 - 8); near(e.actual, 8); assert.equal(V.stamina.counts.awe, 1); near(V.stamina.spent.awe, 8);
  assert.equal(V.lastAwe, e); assert.equal(e.attacker, 1);
  assert.equal(spendAweDrain(A, V), null); // 같은 때 (한 공격에 두 번 불려도)
  A.stamina.time += realS(1.49); assert.equal(spendAweDrain(A, V), null); near(V.stamina.value, v0 - 8); // 1.5 s 안
  A.stamina.time += realS(0.01); assert.ok(spendAweDrain(A, V)); near(V.stamina.value, v0 - 16); // 1.5 s 지남
  // 능력 없는 칼 · 부러진 칼 · 빈손 — 아무 일 없음 (기록 칸도 안 생김)
  for (const extra of [{ weapon: getWeapon('zweihander') }, { weapon: tizona(), weaponBroken: true }, { weapon: tizona(), armed: false }]) {
    const a = actor({ index: 1, ...extra }), v = actor();
    assert.equal(spendAweDrain(a, v), null); near(v.stamina.value, STAMINA.max); assert.equal(v.stamina.spent.awe, undefined);
  }
  // 기력 무한(용사의 눈물): 깎이지 않고 시계도 안 셈 → 무한을 풀면 바로 깎임
  const a2 = actor({ index: 1, weapon: tizona() }), h = actor(); h.stamina.setInfinite(true);
  assert.equal(spendAweDrain(a2, h), null); near(h.stamina.value, STAMINA.max);
  h.stamina.setInfinite(false); assert.ok(spendAweDrain(a2, h)); near(h.stamina.value, STAMINA.max - 8);
  // 바닥: 탈진 문턱에서 멈춤
  const a3 = actor({ index: 1, weapon: tizona() }), low = actor(); low.stamina.value = STAMINA.floor + 3;
  const e3 = spendAweDrain(a3, low); near(e3.actual, 3); assert.equal(low.stamina.exhausted, true);
  const was = WEAPON_ABILITY.aweDrain;
  try { WEAPON_ABILITY.aweDrain = 0; const a = actor({ index: 1, weapon: tizona() }), v = actor(); assert.equal(spendAweDrain(a, v), null); near(v.stamina.value, STAMINA.max); } finally { WEAPON_ABILITY.aweDrain = was; }
}));

// ── 사람 칼 주인: skill.js whiffTrack → whiffEnd (공격 하나 = 휘두르기 + 손이 멈춘 뒤 칼이 지나갈 때까지) ──
function humanAttack({ weapon = tizona(), bound = true, landed = false, att = true, steps = 12 } = {}) {
  const P = actor({ index: 0, weapon }), F = actor({ index: 1 });
  P.foe = F;
  P.tipVel = new Vector3();
  P.tipPrev = new Vector3(0, 1.5, 0.6);
  P.bladePoint = (t, out) => out.set(0, 1.5, 0.1);
  F.tipPrev = new Vector3(bound ? 0.03 : 1.5, 1.5, 0.6); // 칼끼리 0.03 m(맞물림) 또는 1.5 m(헛침)
  F.bladePoint = (t, out) => out.set(bound ? 0.03 : 1.5, 1.5, 0.1);
  const sk = Object.create(Skill.prototype);
  sk.f = P; sk.tap = null; P.skill = sk;
  const run = (n, tap) => { for (let i = 0; i < n; i++) { sk.tap = tap; P.stamina.time += DT; sk.whiffTrack(DT, false); } };
  const v0 = () => F.stamina.value;
  const before = v0();
  run(steps, att ? {} : null); // 탭 찌르기 동안 (기력 장부의 공격 — attacking)
  if (!att) { sk.tap = null; sk.whiff.on = true; } // 공격으로 셈하지 않은 휘두르기 (준비 동작 같은)
  if (landed) F.pain = 0.2; // 맞힘 = 상대 아픔 +0.05 넘게
  run(1, att ? {} : null);
  const mid = v0();
  run(Math.ceil((UNIQUE_ASSIST.onsetQuiet + 0.6) / DT), null); // 손이 멈추고 칼이 지나감 → whiffEnd
  return { P, F, sk, before, mid, after: v0() };
}

test('사람이 든 티소나: 막힘 → 공격이 끝날 때 한 번 −8 · 맞힘 · 헛침 · 공격 아닌 휘두르기 · 다른 칼은 없음', oldDrain(() => {
  const b = humanAttack();
  near(b.mid, b.before); // 칼이 닿는 동안이 아니라 공격 끝에
  near(b.after, b.before - 8); assert.equal(b.F.stamina.counts.awe, 1); assert.equal(b.sk.whiff.on, false);
  for (const o of [{ landed: true }, { bound: false }, { att: false }, { weapon: getWeapon('zweihander') }]) {
    const r = humanAttack(o);
    near(r.after, r.before); assert.equal(r.F.stamina.counts.awe ?? 0, 0, JSON.stringify(Object.keys(o)));
  }
}));

test('사람이 든 티소나: 막힌 공격 둘이 1.5 s 안이면 둘째는 없음 · 1.5 s 뒤 공격은 다시 −8', oldDrain(() => {
  const b = humanAttack();
  const { P, F, sk } = b;
  const again = () => {
    for (let i = 0; i < 12; i++) { sk.tap = {}; P.stamina.time += DT; sk.whiffTrack(DT, false); }
    for (let i = 0; i < Math.ceil((UNIQUE_ASSIST.onsetQuiet + 0.6) / DT); i++) { sk.tap = null; P.stamina.time += DT; sk.whiffTrack(DT, false); }
  };
  const t0 = F.lastAwe.time;
  again(); // 바로 이은 둘째 공격(끝이 첫 기력 깎음에서 1.5 s 안)
  assert.ok(P.stamina.time - t0 < 1.5); near(F.stamina.value, b.before - 8); assert.equal(F.stamina.counts.awe, 1);
  P.stamina.time = t0 + 1.5; // 1.5 s 지난 뒤 셋째 공격
  again(); near(F.stamina.value, b.before - 16); assert.equal(F.stamina.counts.awe, 2);
}));

// ── AI 칼 주인: ai.js afterStrike (공격 하나 끝에 한 번 — 막힘 = !hitLanded · bound) ──
function aiStrikeEnd(ai, { hit = false, bound = true } = {}) {
  ai.hitLanded = hit; ai.bound = bound;
  const s = ai.foe.stamina, v0 = s.value;
  ai.afterStrike(ai.d ?? 2);
  return v0 - s.value;
}
test('AI 가 든 티소나 (상대 자리 · 플레이어 자리 모두): 막힘 −8 · 같은 공격 끝이 다시 와도 1.5 s 안엔 없음 · 맞힘 · 헛침 없음 · 롱소드 AI 는 없음', oldDrain(() => {
  for (const [w1, w2] of [['longsword', 'tizona'], ['tizona', 'longsword']]) {
    const G = newRound({ walls: true, weapon: w1, weapon2: w2, seed: 3, AI2Class: AI });
    for (let i = 0; i < 5; i++) G.step();
    const wielder = w1 === 'tizona' ? G.ai2 : G.ai, other = w1 === 'tizona' ? G.ai : G.ai2;
    assert.equal(wielder.me.weapon.id, 'tizona');
    near(aiStrikeEnd(wielder, { hit: true, bound: true }), 0); // 맞힘
    near(aiStrikeEnd(wielder, { hit: false, bound: false }), 0); // 헛침
    near(aiStrikeEnd(other), 0); // 롱소드의 막힌 공격
    near(aiStrikeEnd(wielder), 8); // 막힘
    near(aiStrikeEnd(wielder), 0); // 1.5 s 안
    wielder.me.stamina.time += realS(1.5); // 실제 1.5 s
    near(aiStrikeEnd(wielder), 8); // 1.5 s 지남
    assert.equal(wielder.foe.stamina.counts.awe, 2);
  }
}));

test('AI 대 AI 실제 판 (티소나 대 롱소드 — 상대 자리 11 s · 플레이어 자리 11 s): 기력 깎음은 티소나의 막힌 공격 끝에서만 · 공격 하나에 한 번 · 8 씩 · 1.5 s 안의 둘째 막힘은 없음', oldDrain(() => {
  const orig = AI.prototype.afterStrike;
  const log = [];
  AI.prototype.afterStrike = function (d) {
    const s = this.foe.stamina, c0 = s.counts.awe ?? 0, v0 = s.value, hit = this.hitLanded, bound = this.bound;
    const r = orig.call(this, d);
    log.push({ t: this.me.stamina.time, who: this.me.weapon.id, blocked: !hit && bound, drains: (s.counts.awe ?? 0) - c0, dv: v0 - s.value });
    return r;
  };
  try {
    // 상대 자리 씨앗 6 (깎음 뒤 1.5 s 안 막힘 하나 건너뜀) · 플레이어 자리 씨앗 1 — 몸 · AI 가 바뀌면 씨앗을 다시 고른다. 이 파일의 앞 시험들을 거친 뒤의 판이라
    //  씨앗을 따로 돌린 결과와 다를 수 있다 — 고를 때는 이 파일째 돌려 본다
    //  (10/24 17:2x 팔꿈치 돌림 켬 · 손목 교정으로 상대 자리 씨앗을 다시 고름 — 전 씨앗 9: 10.1 · 10.7 s · 10/27 손맛 티소나 몸(칼날 질량 분포를 그림 꼴에서) 뒤
    //   상대 자리 씨앗 1 → 6 · 플레이어 자리 씨앗 9 · 7.5 s → 씨앗 1 · 11 s — 전 씨앗은 그 시간 안에 막힘이 없어짐)
    //  (10/27 표준 시간 — AI 판단 박자 · 반응 · 위세 틈이 실제 초가 되어 판이 바뀜: 상대 자리 씨앗 6 은 건너뜀 0 · 플레이어 자리 씨앗 1 은 깎음 0 → 이 파일째 돌려 다시 고름 — 상대 자리 씨앗 27 · 플레이어 자리 씨앗 10)
    //  (10/31 자연 바인드 본판(사장님 19:xx — 칼끼리 덜 튕기고 AI 가 막힌 칼을 밂)으로 판이 바뀜: 플레이어 자리 씨앗 10 은 깎음 0 → 이 파일째 1 ~ 30 을 돌려 다시 고름 — 씨앗 5 (깎음 1 · 건너뜀 1).
    //   30 씨앗 모두 위 규칙(티소나 막힌 끝에서만 · 한 번 · 8 · 1.5 s)은 그대로 맞음)
    for (const [w1, w2, seed, secs, minDrains, minSkipped] of [['longsword', 'tizona', 27, 11, 1, 1], ['tizona', 'longsword', 5, 11, 1, 0]]) {
      log.length = 0;
      const G = newRound({ walls: true, weapon: w1, weapon2: w2, seed, AI2Class: AI });
      for (let i = 0; i < secs / DT; i++) G.step();
      const drains = log.filter((l) => l.drains);
      for (const l of drains) { assert.equal(l.who, 'tizona'); assert.equal(l.blocked, true); assert.equal(l.drains, 1); near(l.dv, 8, 1e-6); }
      let last = -Infinity, want = 0, skipped = 0; // 막힌 티소나 공격을 차례로: 지난 깎음에서 1.5 s 지났으면 깎음
      for (const l of log) if (l.who === 'tizona' && l.blocked) { if (l.t - last >= WEAPON_ABILITY.aweGap - 1e-9) { want++; last = l.t; } else skipped++; }
      assert.equal(drains.length, want, `${w1}-${w2} ${seed}`);
      assert.ok(drains.length >= minDrains && skipped >= minSkipped, `${w1}-${w2} 씨앗 ${seed}: 깎음 ${drains.length} · 1.5 s 안이라 건너뜀 ${skipped}`);
      const wielder = w1 === 'tizona' ? G.player : G.enemy, other = w1 === 'tizona' ? G.enemy : G.player;
      assert.equal(wielder.stamina.counts.awe ?? 0, 0); // 롱소드 쪽 공격은 티소나 주인 기력을 깎지 않는다
      assert.equal(other.stamina.counts.awe ?? 0, drains.length);
    }
  } finally {
    AI.prototype.afterStrike = orig;
  }
}));

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
