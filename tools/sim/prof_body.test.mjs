// 숙련도별 몸 값 시험 (11/17 E — [사장님 11/17 결정 'A~E 기본으로'] · config PROF_BODY · src/prof_body.js · 기록 docs/strike/prof_body_2026-11-17.md):
//  표 값 · 모양(오름 · 숙련 3 ~ 4 가 1 가까이) · AI 몸에 들어감(사람 몫 숙련도 · 시트 힘은 곱하는 몫 — 11/18) · 생사전 몸 숙련도 · 옛 PROF6_VITALITY · AI_LEVELS 힘이 없음 ·
//  사람 숙련도(익힌 칸 문턱 · 다섯 유파 가운데 가장 높은 값 · 테스트 경로 = 모든 칸) · main.js 가 사람 몸에 넣음(1:1 · 동시 대전).
//  node --test tools/sim/prof_body.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRound, CONFIG } from './harness_m.mjs';
import { profBody, bodyIndex, teamBodyProficiency, deVitalityK } from '../../src/prof_body.js';
import { playerProficiency, humanProficiency, humanSchoolProficiency } from '../../src/skill_tree_store.js';
import { traditionOf } from '../../src/schools.js';
import { WEAPONS } from '../../src/weapons.js';
import { playerProficiency as rosterProficiency } from '../../src/saengsa_roster.js';
import { TREE_SCHOOLS, aiLadderIds } from '../../src/skill_tree_data.js';
import { CHARACTERS_BY_ID as C } from '../../src/characters.js';

const { PROF_BODY, AI_LEVELS, DE_VITALITY } = CONFIG;
/** 독일 유파 버티는 힘 덤 (11/20 — config DE_VITALITY): 그 무기 유파 · 숙련도의 곱 */
const deK = (weapon, p) => deVitalityK(traditionOf(WEAPONS[weapon]), p);

test("표 값 [사장님 11/18 결정 '1부터 6까지 0.6 0.7 0.8 0.9 1.0 1.1 힘과 버티는 힘 모두' · '0은 0.6이야' · 11/21 '힘 표는 0.5 0.65 0.8 0.95 1.1 1.2 이렇게 하자.']", () => {
  assert.deepEqual(PROF_BODY, {
    vitality: [0.6, 0.6, 0.7, 0.8, 0.9, 1, 1.1],
    strength: [0.5, 0.5, 0.65, 0.8, 0.95, 1.1, 1.2], // 11/21 사장님 힘 표 (숙련 0 = 1 · 버티는 힘 그대로)
  });
});

test('표 모양: 일곱 칸 · 양수 · 숙련도가 오르면 줄지 않음 · 숙련 1 부터 한 칸 차 버티는 힘 0.1 (10 %) · 힘 0.15 · 끝 칸(5 → 6)만 0.1 (11/21) · 0 = 1', () => {
  for (const k of ['vitality', 'strength']) {
    const xs = PROF_BODY[k];
    assert.equal(xs.length, CONFIG.AI_PROFICIENCY.levels.length, k);
    for (let i = 0; i < xs.length; i++) {
      assert.ok(xs[i] > 0, `${k}[${i}]`);
      if (i) assert.ok(xs[i] >= xs[i - 1], `${k} 오름 ${i - 1} → ${i}`);
    }
    assert.equal(xs[0], xs[1], `${k} 0 = 1`);
    for (let i = 2; i < xs.length; i++) {
      const step = k === 'strength' && i < xs.length - 1 ? 0.15 : 0.1;
      assert.ok(Math.abs(xs[i] - xs[i - 1] - step) < 1e-9, `${k} ${i - 1} → ${i} 한 칸 ${step}`);
    }
  }
});

test('옛 값 없음: PROF6_VITALITY · AI_LEVELS 의 힘 칸 · 시트의 vitality', () => {
  assert.equal(CONFIG.PROF6_VITALITY, undefined);
  for (const [name, L] of Object.entries(AI_LEVELS)) assert.equal(L.strength, undefined, name);
  for (const c of Object.values(C)) assert.equal(c.vitality, undefined, c.id);
});

test('profBody · bodyIndex: 반올림 · 0 ~ 6 으로 자름 · 수가 아니면 2', () => {
  assert.deepEqual(profBody(4), { vitality: PROF_BODY.vitality[4], strength: PROF_BODY.strength[4] });
  assert.equal(bodyIndex(3.6), 4);
  assert.equal(bodyIndex(-1), 0);
  assert.equal(bodyIndex(9), 6);
  assert.equal(bodyIndex(undefined), 2);
});

test('AI 몸: 숫자 숙련도 p → PROF_BODY[p] (두 자리 모두 AI · 같은 무기 — 롱소드는 독일이라 버티는 힘 × 독일 덤 DE_VITALITY[p])', () => {
  for (const p of [0, 1, 2, 3, 4, 5, 6]) {
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'longsword', difficulty: CONFIG.AI_PROFICIENCY.levels[p], persona: { proficiency: p } });
    assert.ok(Math.abs(G.enemy.vitality - PROF_BODY.vitality[p] * DE_VITALITY.k[p]) < 1e-12, `vitality ${p} ${G.enemy.vitality}`);
    assert.equal(G.enemy.strength, PROF_BODY.strength[p], `strength ${p}`);
    assert.equal(G.ai.level.strength, PROF_BODY.strength[p], `level.strength ${p}`);
    G.world.free();
  }
});

test('AI 몸: 이름만 받은 AI(인물 · 숙련도 없음)는 AI_PROFICIENCY.ofLevel 의 숙련도 — 보통 = 2', () => {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'longsword' });
  assert.ok(Math.abs(G.enemy.vitality - PROF_BODY.vitality[2] * deVitalityK(G.ai.art.tradition, G.ai.proficiency)) < 1e-12, `${G.enemy.vitality}`); // 독일 덤 — 손에 든 유파 숙련도 칸
  assert.equal(G.enemy.strength, PROF_BODY.strength[2]);
  G.world.free();
});

test("AI 인물: 본 유파 숙련도의 칸 · 시트 힘은 표에 곱하는 몫 [사장님 11/18 '3. 곱하기'] (브론 1.3 × 표[0] · 롤랑 1.1 × 표[6] · 없으면 1) · 광기의 하인리히 = 표[4] × 1.15 × 1.2", () => {
  const fightOf = (id) => {
    const c = C[id];
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: c.weapon, difficulty: c.ai.level, persona: c.ai.persona });
    const out = { vitality: G.enemy.vitality, strength: G.enemy.strength, level: G.ai.level.strength };
    G.world.free();
    return out;
  };
  const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);
  for (const [id, mul] of [['bran', 1.3], ['isolde', 0.85], ['roland', 1.1], ['bernardo', 1.15], ['artoria', 1], ['minami', 1], ['white_scale', 1], ['heinrich_mad', 1.38]]) {
    const c = C[id], p = c.ai.proficiency;
    const got = fightOf(id);
    assert.ok(Math.abs(got.vitality - PROF_BODY.vitality[p] * deK(c.weapon, p)) < 1e-12, `${id} vitality (숙련 ${p}) ${got.vitality}`); // 독일 무기면 덤
    near(got.strength, PROF_BODY.strength[p] * mul, `${id} strength`);
    near(got.level, got.strength, `${id} level.strength = 몸 힘 (비기 보조 힘의 바탕)`);
  }
  assert.equal(C.heinrich_mad.ai.persona.level.strength, 1.38); // 원본 시트 1.15 × 광기 1.2 — 표는 AI 가 곱함
  // 숙련도 6 인물(옛 PROF6_VITALITY 1.1 을 받던 다섯 + 광기의 다라이시) = 표 6 칸
  const six = Object.values(C).filter((c) => c.ai?.proficiency === 6).map((c) => c.id).sort();
  assert.deepEqual(six, ['artoria', 'artoria_mad', 'bernardo', 'minami_mad', 'roland', 'silver_wanderer_mad']);
  for (const id of six) assert.ok(Math.abs(fightOf(id).vitality - PROF_BODY.vitality[6] * deK(C[id].weapon, 6)) < 1e-12, id);
});

test("생사전 동시 대전 몸 값 숙련도 [사장님 11/18 '4. 권고대로']: 인물 = 시트(본 유파) · 무명 검객 = 메인 유파 칸 · 없으면 가장 높은 칸 · 표 없으면 대신값 · AI 가 persona.bodyProficiency 를 읽음", () => {
  assert.equal(teamBodyProficiency({ prof: { german: 0, japanese: 2 } }, C.minami), C.minami.ai.proficiency);
  assert.equal(teamBodyProficiency({ prof: { german: 2, italian: 1, japanese: 0 }, person: { main: 'italian' } }, null, 2), 1);
  assert.equal(teamBodyProficiency({ prof: { german: 0, italian: 2 } }, null, 2), 2);
  assert.equal(teamBodyProficiency({}, null, 2), 2);
  // 손에 든 유파 숙련 0 (이탈리아 무기) · 본 유파 4 → 몸은 4 칸 · 손에 든 유파 숙련도(this.proficiency)는 0 그대로
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'rapier', persona: { proficiency: { german: 4, italian: 0 }, bodyProficiency: 4 } });
  assert.equal(G.ai.proficiency, 0);
  assert.equal(G.enemy.vitality, PROF_BODY.vitality[4]);
  assert.equal(G.enemy.strength, PROF_BODY.strength[4]);
  G.world.free();
  const src = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.equal((src.match(/bodyProficiency: teamBodyProficiency\(e, /g) ?? []).length, 2);
});

test('사람 숙련도: 익힌 칸 문턱(5 · 7 · 9 · 11) · 다섯 유파 가운데 가장 높은 값 · 테스트 경로 = 5 · 생사전과 같은 함수', () => {
  assert.equal(rosterProficiency, playerProficiency);
  assert.equal(humanProficiency({ learned: {} }), 1);
  for (let l = 1; l <= 5; l++) assert.equal(humanProficiency({ learned: { german: aiLadderIds('german', l) } }), l, `독일 ${l}`);
  assert.equal(humanProficiency({ learned: { german: aiLadderIds('german', 2), japanese: aiLadderIds('japanese', 4) } }), 4);
  assert.equal(humanProficiency({ test: true }), 5);
  for (const s of TREE_SCHOOLS) assert.equal(playerProficiency({ [s]: aiLadderIds(s, 3) })[s], 3, s);
});

test('main.js: 사람 몸(1:1 · 동시 대전)에 humanBodyOf(무기) — profBody(humanProficiency(…)) + 독일 덤(11/20) · 상대 몸에 시트 vitality 를 넘기지 않음', () => {
  const src = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.equal((src.match(/\.\.\.humanBodyOf\((weaponId|e\.weapon)\)/g) ?? []).length, 2);
  assert.ok(/const b = profBody\(humanProficiency\(\{ test: testRoute\.active \}\)\);/.test(src));
  assert.ok(/deVitalityK\(traditionOf\(getWeapon\(weaponId\)\), humanSchoolProficiency\('german'/.test(src));
  assert.ok(!/vitality: (currentFoe|ch)\?\.vitality/.test(src));
});

test("독일 유파 버티는 힘 덤 [사장님 11/20 '1-2 숙련도는 1.05 3-4 숙련도는 1.15 5-6 숙련도는 1.25로 해.']: 표 · 독일 무기만 · 사람 독일 숙련도 셈", () => {
  assert.deepEqual(DE_VITALITY.k, [1, 1.05, 1.05, 1.15, 1.15, 1.25, 1.25]);
  for (const p of [0, 1, 2, 3, 4, 5, 6]) {
    assert.equal(deVitalityK('german', p), DE_VITALITY.k[p]);
    for (const t of ['italian', 'iberian', 'japanese', 'chinese', 'none', undefined]) assert.equal(deVitalityK(t, p), 1, `${t} ${p}`);
  }
  // 독일 아닌 무기를 든 AI 는 표 그대로 · 크릭스메서(독일)는 덤
  for (const [w, k] of [['uchigatana', 1], ['hwando', 1], ['kriegsmesser', DE_VITALITY.k[5]]]) {
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: w, difficulty: CONFIG.AI_PROFICIENCY.levels[5], persona: { proficiency: 5 } });
    assert.ok(Math.abs(G.enemy.vitality - PROF_BODY.vitality[5] * k) < 1e-12, `${w} ${G.enemy.vitality}`);
    G.world.free();
  }
  // 사람 독일 숙련도 = 스킬트리 독일 칸으로 센 값 (playerProficiency 와 같음 · 테스트 경로 = 모두 익힘 5)
  assert.equal(humanSchoolProficiency('german', { learned: {} }), 1);
  assert.equal(humanSchoolProficiency('german', { test: true }), 5);
  const L = { german: new Set(aiLadderIds('german', 3)) };
  assert.equal(humanSchoolProficiency('german', { learned: L }), playerProficiency(L).german);
});
