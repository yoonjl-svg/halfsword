// AI 숙련도 = 스킬트리 칸 시험 (11/16 사장님 결정 — config AI_KIT · src/skill_tree_data.js aiKitOf · src/ai.js applyKit · 기록 docs/strike/prof_kit_2026-11-16.md):
//  사다리가 바른가(먼저 익힐 칸 · 11 칸을 꼭 한 번씩 · 6 = 5) · 숙련도마다 AI 몸 칸 몫 · 고유 공격 · 유파 패시브 · 비기가 칸을 따르나 ·
//  AI 만의 스위치(사냥 겹 · 칼 씨름 · 바위 몸 · 이어 돌리기 · 파고들기 · 막는 동안 피해 감소)도 칸을 묻나 · 사람 숙련도 mode 'count' · 'ladder'.
//  node --test tools/sim/prof_kit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG, DT } from './jelly_harness.mjs';
import { TREE_SCHOOLS, nodesOf, nodeOf, kitFromNodes, aiLadderIds, aiKitOf, AI_SLOTLESS_PERKS, KIT_KEYS } from '../../src/skill_tree_data.js';
import { aiUniqueStages, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { TRADITIONS } from '../../src/schools.js';
import { getWeapon } from '../../src/weapons.js';
import { huntOn } from '../../src/cn_hunt.js';
import { deDirtyBody } from '../../src/de_dirty.js';
import { lowShoveFree } from '../../src/jp_tank.js';
import { aiWoundKeep } from '../../src/ai_block_cut.js';
import { kitOff, uniqueOff, perkOff } from '../../src/skill_kit.js';
import { playerProficiency } from '../../src/saengsa_roster.js';

const { AI_KIT, SAENGSA, SCHOOL_PASSIVE, AI_PROFICIENCY, AI_PLAN } = CONFIG;
const WEAPON = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'qinggang' };
const skillIds = (s) => nodesOf(s).filter((n) => !n.letter).map((n) => n.id);
/** 칸 → 처음 들어오는 단계 (1 ~ 5) */
const levelOf = (s, id) => AI_KIT.ladder[s].findIndex((ids) => ids.includes(id)) + 1;
/** 판 하나 — 두 자리 모두 AI · 같은 무기 · 숙련도 p (persona.proficiency — 숫자 = 손에 든 무기 유파의 값) */
const match = (s, p, o = {}) => newMatch({ weapons: [WEAPON[s], WEAPON[s]], ai: 'all', aiOf: () => ({ level: 'normal', persona: { proficiency: p } }), ...o });
/** 이 유파 고유 공격 칸 → AI 꾸러미 이름 (unique_assist.js aiUniqueStages slot 의 거꾸로 — 통폐합으로 뺀 것 제외) */
const aiNamesOf = (s) => {
  const ST = aiUniqueStages(s);
  const out = new Map();
  for (const [ai, slot] of ST.slot) if (ST.unique.has(ai) && !ST.retired.has(ai)) out.set(slot, ai);
  return out;
};
/** AI 꾸러미(uniqueByName)에 든 고유 동작 이름 (속임수 꼴은 u.name) */
const pkgNames = (A) => new Set([...A.uniqueByName.values()].map((u) => u.name));

test('AI_KIT 기본값 — 켬 [사장님 11/16 결정] · 사다리 표(11/16 사장님 손목 힘 3단계 · 맞박자 찌르기 3단계 · 헛누름 4단계 · 막아찌르기 2단계 · 굳은 받기 2단계 반영)', () => {
  assert.deepEqual(AI_KIT.ladder, {
    german: [['G1', 'G2'], ['G3', 'G5', 'G8'], ['G4', 'G6'], ['G7', 'G9'], ['G10', 'G12']],
    italian: [['I1', 'I3'], ['I5', 'I7', 'I6'], ['I2', 'I12'], ['I9', 'I8'], ['I4', 'I10']],
    iberian: [['B1', 'B2'], ['B8', 'B3', 'B9'], ['B5', 'B10'], ['B7', 'B6'], ['B4', 'B12']],
    japanese: [['J1', 'J6'], ['J2', 'J3', 'J4'], ['J7', 'J8'], ['J9', 'J10'], ['J5', 'J12']],
    chinese: [['C1', 'C2'], ['C7', 'C3', 'C5'], ['C8', 'C4'], ['C6', 'C10'], ['C9', 'C12']],
  });
  assert.equal(SAENGSA.playerProf.mode, 'step'); // 사람 숙련도 = 칸 수 문턱 5 · 7 · 9 · 11 [사장님 11/16 결정 '사람 셈도 문턱 기준으로 바꿔']
});

test('사다리가 바르다: 단계마다 칸의 먼저 익힐 칸(pre)은 그 단계나 앞 · 1 ~ 5 가 편지 아닌 11 칸을 꼭 한 번씩 · 편지 없음 · 6 = 5 · 0 = 없음', () => {
  for (const s of TREE_SCHOOLS) {
    const L = AI_KIT.ladder[s];
    assert.equal(L.length, 5, s);
    const seen = [];
    L.forEach((ids, i) => {
      for (const id of ids) {
        const n = nodeOf(s, id);
        assert.ok(n, `${s} ${id} 칸이 있다`);
        assert.ok(!n.letter, `${s} ${id} 편지는 사다리 밖`);
        for (const p of n.pre) {
          const lp = levelOf(s, p);
          assert.ok(lp >= 1 && lp <= i + 1, `${s} ${id}(${i + 1}단계)의 먼저 익힐 칸 ${p} 는 ${lp}단계`);
        }
      }
      seen.push(...ids);
    });
    assert.equal(seen.length, 11, s);
    assert.equal(new Set(seen).size, 11, `${s} 겹치는 칸 없음`);
    assert.deepEqual([...seen].sort(), skillIds(s).sort(), `${s} 편지 아닌 11 칸 모두`);
    assert.deepEqual([...aiLadderIds(s, 6)].sort(), [...aiLadderIds(s, 5)].sort(), `${s} 6 = 5`);
    assert.equal(aiLadderIds(s, 0).size, 0, `${s} 0 = 없음`);
    assert.equal(aiLadderIds(s, NaN).size, 0);
    // 쌓임 수 (사장님 11/16 표 — 다섯 유파 모두 2 · 5 · 7 · 9 · 11)
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((l) => aiLadderIds(s, l).size), [2, 5, 7, 9, 11, 11], s);
  }
});

test('사장님 말씀대로: 숙련도 1 = 보법 칸만 · 5 단계 = 비기 + 핵심 칸 하나(곧은 선 · 맹호은림 · 바위 몸 · 칼 씨름 · 멈추지 않는 칼)', () => {
  for (const s of TREE_SCHOOLS) {
    const l1 = AI_KIT.ladder[s][0].map((id) => nodeOf(s, id).cat);
    assert.equal(l1[0], 'foot', s); // 1단계 첫 칸 = 보법 I (뿌리)
    assert.equal(nodeOf(s, AI_KIT.ladder[s][0][0]).pre.length, 0, s);
    const l5 = AI_KIT.ladder[s][4];
    assert.ok(l5.some((id) => nodeOf(s, id).cat === 'secret'), `${s} 5단계에 비기`);
  }
  assert.deepEqual(['G12', 'I10', 'B12', 'J12', 'C12'].map((id) => AI_KIT.ladder[{ G: 'german', I: 'italian', B: 'iberian', J: 'japanese', C: 'chinese' }[id[0]]][4].includes(id)), [true, true, true, true, true]);
  assert.deepEqual(['칼 씨름', '곧은 선', '멈추지 않는 칼', '바위 몸', '맹호은림'], [nodeOf('german', 'G12'), nodeOf('italian', 'I10'), nodeOf('iberian', 'B12'), nodeOf('japanese', 'J12'), nodeOf('chinese', 'C12')].map((n) => n.name));
  assert.equal(levelOf('iberian', 'B10'), 3); // 사장님 11/16 '손목힘은 3단계로 보내'
  assert.equal(levelOf('italian', 'I12'), 3); // 사장님 11/16 '맞박자찌르기를 3단계에 주고 헛누름을 4단계로'
  assert.equal(levelOf('italian', 'I8'), 4);
  assert.equal(levelOf('italian', 'I6'), 2); // 사장님 11/16 '그럼 막아찌르기를 2단계로 보내'
  assert.equal(levelOf('iberian', 'B9'), 2); // 사장님 11/16 '굳은 받기 2단계로 가자'
});

test('aiKitOf = 사람 kitFromNodes(사다리 칸) + 칸 없는 이점 · 유파 칸 없는 무기 = null', () => {
  for (const s of TREE_SCHOOLS) {
    for (let l = 0; l <= 6; l++) {
      const k = aiKitOf(s, l);
      const h = kitFromNodes(s, aiLadderIds(s, l));
      for (const key of KIT_KEYS) assert.equal(k[key], h[key], `${s} ${l} ${key}`);
      assert.deepEqual([...k.unique].sort(), [...h.unique].sort(), `${s} ${l} unique`);
      assert.deepEqual([...k.perk].sort(), [...new Set([...h.perk, ...AI_SLOTLESS_PERKS])].sort(), `${s} ${l} perk`);
      assert.equal(k.ai, true);
    }
  }
  assert.equal(aiKitOf('none', 5), null);
  assert.equal(aiKitOf(undefined, 5), null);
  // 칸 없는 이점은 어느 칸도 켜지 않는다 (사람은 못 받음 — 기록 §3-4) · 11/16 내려 찌르기 틈 파고들기는 칸 I7 로 옮겨 이 목록에서 빠짐
  for (const s of TREE_SCHOOLS) for (const n of nodesOf(s)) assert.ok(!AI_SLOTLESS_PERKS.includes(n.perk), `${s} ${n.id}`);
  assert.deepEqual([...AI_SLOTLESS_PERKS], ['redondo']);
});

test('11/16 사장님 \'다 너의 권고대로 하마\' ① 내려 찌르기 틈 파고들기 = 내려 찌르기 칸 I7 (사람 · AI 같음 — AI 는 숙련도 2 부터)', () => {
  const ids = (xs) => new Set(xs);
  const withI7 = kitFromNodes('italian', ids(['I1', 'I3', 'I7'])), noI7 = kitFromNodes('italian', ids(['I1', 'I3']));
  assert.equal(uniqueOff({ skillKit: withI7 }, 'imbroccata'), false, '사람 I7 = 받음');
  assert.equal(uniqueOff({ skillKit: noI7 }, 'imbroccata'), true);
  assert.equal(uniqueOff({}, 'imbroccata'), false, '칸 몫 없는 몸(시뮬 · 옛 판 AI) = 받음');
  assert.deepEqual([1, 2].map((l) => uniqueOff({ skillKit: aiKitOf('italian', l) }, 'imbroccata')), [true, false]);
  assert.equal(perkOff({ skillKit: aiKitOf('italian', 6) }, 'imbroccata'), true, '이점 이름(perk)으로는 더 묻지 않음');
  assert.equal(CONFIG.UNIQUE_ASSIST.imbroccataGap, 0.9);
});


test('11/16 사장님 \'단 실력 등급은 높음을 4~5, 최고를 6으로\' · \'다 너의 권고대로 하마\' ⑥ 반응 시간 모든 숙련도 0.2 s', () => {
  assert.deepEqual(AI_PLAN.levels, ['easy', 'easy', 'normal', 'normal', 'hard', 'hard', 'expert']);
  assert.deepEqual(AI_PROFICIENCY.levels, ['easy', 'easy', 'normal', 'hard', 'hard', 'hard', 'expert']);
  assert.equal(AI_PROFICIENCY.reaction.length, 7);
  assert.ok(AI_PROFICIENCY.reaction.every((r) => r === CONFIG.realS(0.2)));
  for (const p of [0, 2, 6]) assert.equal(match('german', p).ai.level.reaction, CONFIG.realS(0.2), `숙련 ${p}`);
});

test('AI 몸 칸 몫 (숙련도 0 ~ 6 · 다섯 유파): skillKit · 보법 I · 막기 I · 막기 자리 몸꼴 · 무유파 막기 자리', () => {
  for (const s of TREE_SCHOOLS) {
    for (const p of [0, 1, 2, 3, 4, 5, 6]) {
      const G = match(s, p);
      for (const A of [G.ai, G.ai2]) {
        const me = A.me;
        const ids = aiLadderIds(s, p);
        assert.equal(me.skillKit, A.kit, `${s} ${p}`);
        assert.equal(A.kit.school, s);
        for (const n of nodesOf(s)) {
          if (n.letter) continue;
          for (const key of n.f) if (ids.has(n.id)) assert.equal(kitOff(me, key), false, `${s} ${p} ${n.id} ${key} 켬`);
        }
        const foot = ids.has(AI_KIT.ladder[s][0][0]);
        assert.equal(me.schoolFootwork, foot ? undefined : false, `${s} ${p} 보법 I`);
        const parry = nodesOf(s).some((n) => ids.has(n.id) && n.f.includes('parry'));
        assert.equal(me.schoolParry, parry ? undefined : false, `${s} ${p} 막기 I`);
        assert.equal(A.school.parry === TRADITIONS.none.parry, !parry || A.art.school.parry === TRADITIONS.none.parry, `${s} ${p} 막기 자리`);
        const cover = nodesOf(s).some((n) => ids.has(n.id) && n.f.includes('parryCover'));
        const pc = TRADITIONS[s].parryCover;
        if (pc && cover) assert.ok(me.skill._cover, `${s} ${p} 막기 몸꼴`);
        if (pc && !cover) assert.equal(!!me.skill._cover, !!pc.down, `${s} ${p} 막기 몸꼴 없음(쓰러져 가리기만)`);
      }
    }
  }
});

test('고유 공격 · 유파 패시브 · 비기는 칸을 따른다 (옛 단계표 · SCHOOL_PASSIVE.at · secretAt 대신)', () => {
  for (const s of TREE_SCHOOLS) {
    const names = aiNamesOf(s);
    const passiveSlot = nodesOf(s).find((n) => n.cat === 'passive' && n.f.includes('passive')).id;
    const secretSlot = nodesOf(s).find((n) => n.cat === 'secret').id;
    for (const p of [0, 1, 2, 3, 4, 5, 6]) {
      const A = match(s, p).ai;
      const ids = aiLadderIds(s, p);
      const pkg = pkgNames(A);
      for (const n of nodesOf(s)) {
        if (!n.u || !names.has(n.u)) continue;
        const ai = names.get(n.u);
        if (!(TRADITIONS[s].unique ?? []).some((u) => u.name === ai && u.ai !== false && !u.counter)) continue;
        assert.equal(pkg.has(ai), ids.has(n.id), `${s} ${p} ${n.id} ${ai}`);
      }
      const pas = ids.has(passiveSlot);
      if (s === 'iberian') assert.equal(A.me.wristK, pas ? SCHOOL_PASSIVE.iberian.wrist : 1, `${s} ${p} 손목 힘`);
      else assert.equal(A.me.schoolPassive.school, pas ? s : null, `${s} ${p} 패시브`);
      assert.equal(!!A.secret, ids.has(secretSlot), `${s} ${p} 비기`);
      assert.equal(!!A.secret, p >= 5, `${s} ${p} 비기 = 5 단계 (옛 secretAt ${AI_PROFICIENCY.secretAt} 와 같음)`);
    }
  }
  // 동방 자→격 패시브(요격 이음)는 요격 칸(C3 — 2단계)과 같이
  assert.equal(match('chinese', 1).ai.passives.some((x) => x.name === 'ciji'), false);
  assert.equal(match('chinese', 2).ai.passives.some((x) => x.name === 'ciji'), true);
  // 이탈리아 헛누름 AI 몫(cavDeep): 칼끝 돌려 빼기(I2 · 3단계)와 헛누름(I8 · 4단계)이 모두 있어야
  assert.deepEqual([2, 3, 4].map((p) => match('italian', p).ai.cavDeep), [false, false, true]);
});

test('AI 만의 스위치도 칸을 묻는다: 사냥 겹 C12 · 칼 씨름 G12 · 바위 몸 밀치기 J12 · 이어 돌리기 B7 · 파고들기 G2 · 막는 동안 피해 감소 C8', () => {
  const cn4 = match('chinese', 4).ai, cn5 = match('chinese', 5).ai;
  assert.deepEqual([huntOn(cn4.me), huntOn(cn5.me)], [false, true]);
  const de4 = match('german', 4).ai, de5 = match('german', 5).ai;
  assert.ok(de4.planDe && de5.planDe);
  assert.deepEqual([deDirtyBody(de4.me, 'deRing'), deDirtyBody(de5.me, 'deRing')], [false, true]);
  const jp4 = match('japanese', 4).ai, jp5 = match('japanese', 5).ai;
  assert.ok(jp4.me.schoolPassive.stackOn && jp5.me.schoolPassive.stackOn); // 스택은 J10(4단계)
  assert.deepEqual([lowShoveFree(jp4.me), lowShoveFree(jp5.me)], [false, true]); // 바위 몸은 J12(5단계)
  assert.deepEqual([3, 4].map((p) => match('iberian', p).ai.kitLink), [false, true]);
  const g0 = match('german', 0).ai, g1 = match('german', 1).ai;
  assert.equal(kitOff(g0.me, 'chase'), true);
  assert.equal(g0.me.gait.deDigAi(), false); // 보법 I · 파고들기 칸 없음
  assert.equal(kitOff(g1.me, 'chase'), false);
  const cut0 = CONFIG.SKILL.cnParryDmgCut;
  const fake = (p) => {
    const A = match('chinese', p).ai;
    A.mode = 'defend';
    A.defVoid = false;
    return aiWoundKeep(A.me);
  };
  assert.ok(cut0 > 0);
  assert.equal(fake(2), 1); // 단단한 받기 C8(3단계) 전
  assert.equal(fake(3), 1 - cut0);
});

test('손에 든 무기가 바뀌면 칸 몫을 그 유파 숙련도로 다시 (kitRefresh — 숙련도 표 { 유파: 숙련도 })', () => {
  const G = newMatch({ weapons: ['longsword', 'longsword'], ai: 'all', aiOf: () => ({ level: 'normal', persona: { proficiency: { german: 2, italian: 5 } } }) });
  const A = G.ai;
  assert.equal(A.kit.school, 'german');
  assert.equal(A.me.schoolPassive.school, null);
  A.me.weapon = getWeapon('rapier');
  assert.notEqual(A.kitWeapon, A.me.weapon);
  A.kitRefresh();
  assert.equal(A.kit.school, 'italian');
  assert.equal(A.me.skillKit, A.kit);
  assert.deepEqual([...aiLadderIds('italian', 5)].every((id) => !nodeOf('italian', id).f.some((k) => kitOff(A.me, k))), true);
  assert.equal(A.me.schoolPassive.school, 'italian'); // I10 곧은 선 (5단계)
  A.me.weapon = getWeapon('tree_branch'); // 무유파 — 칸 몫 걷음
  A.kitRefresh();
  assert.equal(A.kit, null);
  assert.equal(A.me.skillKit, undefined);
  assert.equal(A.me.schoolFootwork, undefined);
});



test('사람 숙련도 (11/16 사장님 \'사람 셈도 문턱 기준으로 바꿔\'): 익힌 칸 수 문턱 = AI 사다리 쌓임 칸 수 — 사다리 1 ~ L 단계를 다 익힌 사람 = 숙련도 L 인 AI 와 같은 숫자 · 옛 규칙 mode \'old\'', () => {
  const P = SAENGSA.playerProf;
  assert.deepEqual([P.at2, P.at3, P.at4, P.at5], [2, 3, 4, 5].map((l) => aiLadderIds('german', l).size));
  for (const s of TREE_SCHOOLS) {
    assert.deepEqual([P.at2, P.at3, P.at4, P.at5], [2, 3, 4, 5].map((l) => aiLadderIds(s, l).size), s);
    for (let l = 1; l <= 5; l++) assert.equal(playerProficiency({ [s]: aiLadderIds(s, l) })[s], l, `${s} ${l}`);
    assert.equal(playerProficiency({ [s]: new Set([...aiLadderIds(s, 2)].slice(1)) })[s], 1, `${s} 4 칸 = 1`);
  }
  // 칸 수만 셈 — 어느 칸이든 (사다리 차례와 상관없이)
  const g = (ids, cfg) => playerProficiency({ german: new Set(ids) }, cfg).german;
  assert.equal(g(['G10', 'G7', 'G12', 'G9', 'G4']), 2);
  // 옛 규칙 (`?playerProf=old`)
  const OLD = { ...P, mode: 'old' };
  assert.equal(g(['G1', 'G2'], OLD), 2);
  assert.equal(g(['G1', 'G2', 'G5', 'G8', 'G3'], OLD), 3);
  assert.equal(g(['G10', 'G7'], OLD), 4);
  assert.equal(g(['G10', 'G7']), 1);
});

test('짧은 AI 대 AI 싸움 (다섯 유파 × 숙련도 1 · 2 · 4 · 6 — 4 초): 깨지지 않고 수가 모두 유한', () => {
  for (const s of TREE_SCHOOLS) {
    for (const p of [1, 2, 4, 6]) {
      const G = match(s, p);
      for (let i = 0; i < 4 / DT; i++) G.step();
      for (const f of [G.player, G.enemy]) {
        const t = f.bodies.pelvis.translation();
        assert.ok([t.x, t.y, t.z, f.stamina.value ?? 0].every(Number.isFinite), `${s} ${p} ${f.name}`);
      }
    }
  }
});
