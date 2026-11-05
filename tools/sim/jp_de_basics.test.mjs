// 일본 · 독일 롱소드 기본 공격 재기 시험 (11/05 — 사장님 '다음 조사 시작해' · 기록 docs/strike/jp_de_basics_2026-11-05.md · 확인표 3400 ~ 3409)
//  ① 새 스위치는 기본 끔 (SKILL.cutStepIn.fwd 0) · 죽음의 일격 조건 그대로 (0.8 m · 'close')
//  ② 재기 꽂개(jp_de_basics.mjs deepProbe + rapier_defence makeProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ③ cutStepIn: 사람 몸 · 받는 유파 · 상대가 맞는 거리(contact) 밖 · 한 걸음으로 칼끝 거리(reach) 안 — 그때만 lunge 걸음 fwd (AI · 다른 유파 · 가까움 · 너무 멂은 없음)
//  node --test tools/sim/jp_de_basics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { deepProbe } from './jp_de_basics.mjs';
import { makeProbe } from './rapier_defence.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';

const { SKILL, SECRET } = CONFIG;

test('기본값: 새 스위치 끔 · 죽음의 일격 조건 그대로', () => {
  assert.equal(SKILL.cutStepIn.fwd, 0);
  assert.deepEqual(SKILL.cutStepIn.schools, ['german']);
  assert.deepEqual(SKILL.cutStepIn.frames, ['two']);
  assert.equal(SECRET.mordRule, 'close');
  assert.equal(SECRET.mordCloseN, 0.8);
});

test('꽂개는 읽기만: 일본 · 독일 롱소드 대 롱소드 AI 가 꽂개 없을 때와 같음', () => {
  for (const [school, weapon] of [['japanese', 'uchigatana'], ['german', 'longsword']]) {
    const a = fightOne({ school, weapon, opp: 'longsword', seed: 3, dur: 10 });
    const pa = makeProbe();
    const pd = deepProbe();
    const both = { init(o) { pa.init(o); pd.init(o); }, step(c, x) { pa.step(c, x); pd.step(c, x); }, done(f) { return { base: pa.done(f), ...pd.done(f) }; } };
    const b = fightOne({ school, weapon, opp: 'longsword', seed: 3, dur: 10, probe: both });
    const strip = (r) => JSON.stringify({ ...r, probe: undefined });
    assert.equal(strip(b), strip(a), school);
    assert.equal(b.probe.fires.length, b.fires.length);
    assert.ok(b.probe.fight.dist && Array.isArray(b.probe.fight.aiAtk));
  }
});

/** 사람 몸 판 (발 묶임이 풀릴 때까지) — { G, P, A } */
function humanRound(school, weapon) {
  const kit = kitFromNodes(school, allNodeIds(school));
  const G = newRound({ seed: 5, weapon, weapon2: 'longsword', walls: true, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  for (let i = 0; i < 2400 && (P.feetHeld || P.state !== 'stand'); i++) G.step();
  return { G, P, A: G.enemy };
}

test('cutStepIn: 맞는 거리 밖 · 한 걸음 안이면 lunge 걸음 · 그 밖은 없음', () => {
  const was = { ...SKILL.cutStepIn };
  const { G, P, A } = humanRound('german', 'longsword');
  try {
    const M = P.swordArt.measure;
    const reqs = [];
    const rs = P.gait.requestStep.bind(P.gait);
    P.gait.requestStep = (o) => (reqs.push({ ...o }), rs(o));
    SKILL.cutStepIn.fwd = 0;
    assert.equal(P.skill.cutStepIn(M.contact + 0.05), false, '끔');
    SKILL.cutStepIn.fwd = 0.3;
    P.gait.req = null;
    assert.equal(P.skill.cutStepIn(M.contact - 0.05), false, '이미 맞는 거리 안');
    assert.equal(P.skill.cutStepIn(M.reach + 0.3 + 0.01), false, '한 걸음으로 못 닿음');
    assert.equal(reqs.length, 0);
    assert.equal(P.skill.cutStepIn(M.contact + 0.05), true, '맞는 거리 밖 · 한 걸음 안');
    assert.equal(reqs.length, 1);
    assert.deepEqual({ kind: reqs[0].kind, fwd: reqs[0].fwd }, { kind: 'lunge', fwd: 0.3 });
    assert.equal(P.skill.cutStepIn(M.contact + 0.05), false, '걸음이 이미 부탁돼 있으면 덮지 않음');
    P.gait.req = null;
    assert.equal(A.skill.cutStepIn(A.swordArt.measure.contact + 0.05), false, 'AI 몸은 없음');
    SKILL.cutStepIn.frames = ['one'];
    assert.equal(P.skill.cutStepIn(M.contact + 0.05), false, '받는 몸 틀이 아님');
    SKILL.cutStepIn.frames = null;
    SKILL.cutStepIn.schools = ['japanese'];
    assert.equal(P.skill.cutStepIn(M.contact + 0.05), false, '받는 유파가 아님');
  } finally {
    Object.assign(SKILL.cutStepIn, was);
    G.world.free();
  }
});
