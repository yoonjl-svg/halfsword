// 숙련도별 몸 값 시험 (11/17 E — [사장님 11/17 결정 'A~E 기본으로'] · config PROF_BODY · src/prof_body.js · 기록 docs/strike/prof_body_2026-11-17.md):
//  표 값 · 모양(오름 · 숙련 3 ~ 4 가 1 가까이) · AI 몸에 들어감(사람 몫 숙련도 · 시트 힘이 이김) · 옛 PROF6_VITALITY · AI_LEVELS 힘이 없음 ·
//  사람 숙련도(익힌 칸 문턱 · 다섯 유파 가운데 가장 높은 값 · 테스트 경로 = 모든 칸) · main.js 가 사람 몸에 넣음(1:1 · 동시 대전).
//  node --test tools/sim/prof_body.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRound, CONFIG } from './harness_m.mjs';
import { profBody, bodyIndex } from '../../src/prof_body.js';
import { playerProficiency, humanProficiency } from '../../src/skill_tree_store.js';
import { playerProficiency as rosterProficiency } from '../../src/saengsa_roster.js';
import { TREE_SCHOOLS, aiLadderIds } from '../../src/skill_tree_data.js';
import { CHARACTERS_BY_ID as C } from '../../src/characters.js';

const { PROF_BODY, AI_LEVELS } = CONFIG;

test('표 값 (11/17 재기로 찾은 값 — 숙련도 0 ~ 6)', () => {
  assert.deepEqual(PROF_BODY, {
    vitality: [0.5, 0.5, 0.7, 0.9, 1, 1.35, 2.2],
    strength: [0.5, 0.5, 0.7, 0.9, 1, 1.25, 1.7],
  });
});

test('표 모양: 일곱 칸 · 양수 · 숙련도가 오르면 줄지 않음 · 숙련 3 ~ 4 는 1 가까이(다른 내용과의 균형)', () => {
  for (const k of ['vitality', 'strength']) {
    const xs = PROF_BODY[k];
    assert.equal(xs.length, CONFIG.AI_PROFICIENCY.levels.length, k);
    for (let i = 0; i < xs.length; i++) {
      assert.ok(xs[i] > 0, `${k}[${i}]`);
      if (i) assert.ok(xs[i] >= xs[i - 1], `${k} 오름 ${i - 1} → ${i}`);
    }
    for (const i of [3, 4]) assert.ok(Math.abs(xs[i] - 1) <= 0.1 + 1e-9, `${k}[${i}] ${xs[i]}`);
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

test('AI 몸: 숫자 숙련도 p → PROF_BODY[p] (두 자리 모두 AI · 같은 무기)', () => {
  for (const p of [0, 1, 2, 3, 4, 5, 6]) {
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'longsword', difficulty: CONFIG.AI_PROFICIENCY.levels[p], persona: { proficiency: p } });
    assert.equal(G.enemy.vitality, PROF_BODY.vitality[p], `vitality ${p}`);
    assert.equal(G.enemy.strength, PROF_BODY.strength[p], `strength ${p}`);
    assert.equal(G.ai.level.strength, PROF_BODY.strength[p], `level.strength ${p}`);
    G.world.free();
  }
});

test('AI 몸: 이름만 받은 AI(인물 · 숙련도 없음)는 AI_PROFICIENCY.ofLevel 의 숙련도 — 보통 = 2', () => {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'longsword' });
  assert.equal(G.enemy.vitality, PROF_BODY.vitality[2]);
  assert.equal(G.enemy.strength, PROF_BODY.strength[2]);
  G.world.free();
});

test('AI 인물: 본 유파 숙련도의 버티는 힘 · 시트에 힘이 있으면 그 값(브론 1.3 · 이졸데 0.85 · 롤랑 1.1 · 베르나르도 1.15) · 없으면 표(미나미 · 백린의 전사)', () => {
  const fightOf = (id) => {
    const c = C[id];
    const G = newRound({ seed: 1, weapon: 'longsword', weapon2: c.weapon, difficulty: c.ai.level, persona: c.ai.persona });
    const out = { vitality: G.enemy.vitality, strength: G.enemy.strength };
    G.world.free();
    return out;
  };
  for (const [id, str] of [['bran', 1.3], ['isolde', 0.85], ['roland', 1.1], ['bernardo', 1.15], ['minami', null], ['white_scale', null], ['heinrich_mad', 1.38]]) {
    const c = C[id], p = c.ai.proficiency;
    const got = fightOf(id);
    assert.equal(got.vitality, PROF_BODY.vitality[p], `${id} vitality (숙련 ${p})`);
    assert.equal(got.strength, str ?? PROF_BODY.strength[p], `${id} strength`);
  }
  // 숙련도 6 인물(옛 PROF6_VITALITY 1.1 을 받던 다섯 + 광기의 다라이시) = 표 6 칸
  const six = Object.values(C).filter((c) => c.ai?.proficiency === 6).map((c) => c.id).sort();
  assert.deepEqual(six, ['artoria', 'artoria_mad', 'bernardo', 'minami_mad', 'roland', 'silver_wanderer_mad']);
  for (const id of six) assert.equal(fightOf(id).vitality, PROF_BODY.vitality[6], id);
});

test('사람 숙련도: 익힌 칸 문턱(5 · 7 · 9 · 11) · 다섯 유파 가운데 가장 높은 값 · 테스트 경로 = 5 · 생사전과 같은 함수', () => {
  assert.equal(rosterProficiency, playerProficiency);
  assert.equal(humanProficiency({ learned: {} }), 1);
  for (let l = 1; l <= 5; l++) assert.equal(humanProficiency({ learned: { german: aiLadderIds('german', l) } }), l, `독일 ${l}`);
  assert.equal(humanProficiency({ learned: { german: aiLadderIds('german', 2), japanese: aiLadderIds('japanese', 4) } }), 4);
  assert.equal(humanProficiency({ test: true }), 5);
  for (const s of TREE_SCHOOLS) assert.equal(playerProficiency({ [s]: aiLadderIds(s, 3) })[s], 3, s);
});

test('main.js: 사람 몸(1:1 · 동시 대전)에 profBody(humanProficiency(…)) · 상대 몸에 시트 vitality 를 넘기지 않음', () => {
  const src = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.equal((src.match(/\.\.\.profBody\(humanProficiency\(\{ test: testRoute\.active \}\)\)/g) ?? []).length, 2);
  assert.ok(!/vitality: (currentFoe|ch)\?\.vitality/.test(src));
});
