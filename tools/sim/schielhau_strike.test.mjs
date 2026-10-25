// 곁눈 베기(셸하우) 길 다시 그림 시험 (10/25 08:0x 사장님 '셸하우 3번 — 맞는 순간 손목이 사람 범위 안 · 손목 교정 전처럼 세게' — docs/strike/wrist_audit_2026-10-24.md §13):
//   UNIQUE_ASSIST.schielPath 1(기본): AI 곁눈 베기 = schools.js schielhau redraw(길 점 + 길 덧칸 — 칼끝 들기 · 손 뻗기 · 손 돌리기) · 0 = 10/25 전 길(옛 꼴이 다시 보여야 시험이 산다).
//   사람 쪽(강화 끝 힘 잣대 길 — unique_assist.js uniqueDef)은 원래 길 그대로 · 덧칸 없는 기술은 techPlan 이 늘 null.
//  node --test tools/sim/schielhau_strike.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { duelRun, duelSummary } from './schielhau_strike.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { PLAYER_UNIQUE, uniqueDef } from '../../src/unique_assist.js';

const UA = CONFIG.UNIQUE_ASSIST;
const withPath = (v, fn) => {
  const old = UA.schielPath;
  UA.schielPath = v;
  try {
    return fn();
  } finally {
    UA.schielPath = old;
  }
};
const schielOf = (ai) => ai.school.tech.find((t) => t.name === 'schielhau');

test('값 · 자료 꼴 (기본 켬 · 놓는 시간 0.2 s — 시간 사다리 · 덧칸은 [from, ...path] 점마다 셋 · from 은 0)', () => {
  assert.equal(UA.schielPath, 1);
  assert.equal(UA.planRelease, 0.2);
  const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
  assert.ok(u.redraw?.path?.length && u.redraw.plan?.length);
  assert.equal(u.redraw.plan.length, u.redraw.path.length + 1);
  for (const p of u.redraw.plan) assert.equal(p.length, 3);
  assert.deepEqual(u.redraw.plan[0], [0, 0, 0]); // 베기 시작에서 덧칸이 튀지 않게
  assert.deepEqual(u.path, [[0.22, 0.36], [0.06, 0.2], [0.0, 0.03]]); // 옛 길은 그대로 남김 (스위치 0 · 사람 강화 잣대)
});

test('AI 꾸러미: 켜면 다시 그린 길 · 덧칸 · 끄면 옛 길 · 덧칸 없음 — 사람 강화 잣대 길은 늘 옛 길', () => {
  const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
  const mk = () => {
    const G = newRound({ seed: 3, weapon: 'longsword', weapon2: 'longsword', persona: { proficiency: 4 } });
    const t = schielOf(G.ai);
    G.world.free();
    return t;
  };
  const on = withPath(1, mk);
  assert.deepEqual(on.path, u.redraw.path);
  assert.deepEqual(on.plan, u.redraw.plan);
  assert.deepEqual(on.from, u.from);
  const off = withPath(0, mk);
  assert.deepEqual(off.path, u.path);
  assert.equal(off.plan, undefined);
  const e = PLAYER_UNIQUE.german.find((x) => x.name === 'schielhau');
  for (const v of [0, 1]) withPath(v, () => assert.deepEqual(uniqueDef('german', e).pts, [u.from, ...u.path]));
});

test('덧칸 셈: 토막에서 손이 간 몫만큼 섞음 · 따라 베기는 끝 점 값 · 끝나면 planRelease 에 걸쳐 0 · 덧칸 없는 기술은 null', () => {
  const G = newRound({ seed: 5, weapon: 'longsword', weapon2: 'longsword', persona: { proficiency: 4 } });
  try {
    const ai = G.ai;
    const me = G.enemy;
    const t = schielOf(ai);
    const P = t.plan;
    ai.mode = 'attack';
    ai.tech = t;
    ai.feint = null;
    ai.phase = 'strike';
    ai.path.length = 0;
    for (const p of t.path) ai.path.push(p.slice());
    // from → path[0] 의 가운데
    me.handOffset.set((t.from[0] + t.path[0][0]) / 2, (t.from[1] + t.path[0][1]) / 2);
    ai.techPlanStep(DT);
    const HD = Math.PI / 180;
    assert.ok(Math.abs(me.techPlan.reach - (P[0][1] + P[1][1]) / 2) < 1e-9);
    assert.ok(Math.abs(me.techPlan.tilt - ((P[0][0] + P[1][0]) / 2) * HD) < 1e-9);
    assert.ok(Math.abs(me.techPlan.turn - ((P[0][2] + P[1][2]) / 2) * HD) < 1e-9);
    // 따라 베기 = 끝 점
    ai.phase = 'follow';
    ai.techPlanStep(DT);
    const L = P[P.length - 1];
    assert.ok(Math.abs(me.techPlan.reach - L[1]) < 1e-9 && Math.abs(me.techPlan.tilt - L[0] * HD) < 1e-9);
    // 끝남 → 놓음
    ai.mode = 'watch';
    ai.phase = 'ready';
    let steps = 0;
    while (me.techPlan && steps < 1000) {
      ai.techPlanStep(DT);
      steps++;
    }
    assert.ok(Math.abs(steps * DT - UA.planRelease) <= 2 * DT, `놓는 데 ${steps * DT} s`);
    // 덧칸 없는 기술
    ai.mode = 'attack';
    ai.phase = 'strike';
    ai.tech = ai.school.tech.find((x) => !x.plan && x.kind === 'cut');
    ai.techPlanStep(DT);
    assert.equal(me.techPlan, null);
  } finally {
    G.world.free();
  }
});

test('맞는 순간 손목 · 세기 (서 있는 상대 · 셸하우만 · 씨앗 넷): 새 길 = 손목 범위 밖 ≤ 10 % · 거꾸로 ≤ 5 % · 교정 안 걸림 · 공격당 심각도가 옛 길의 3 배 넘게', () => {
  const run = (v) => withPath(v, () => duelSummary([1, 2, 3, 4].map((s) => duelRun(s, { foe: 'still', dur: 40 }))));
  const neu = run(1);
  const old = run(0);
  assert.ok(neu.contacts >= 12 && old.contacts >= 12, `맞음 ${neu.contacts} · ${old.contacts}`); // 새 길은 상대가 일찍 쓰러져 맞음 수가 적다
  assert.ok(neu.oor <= 0.1 * neu.contacts, `새 길 범위 밖 ${neu.oor} / ${neu.contacts}`);
  assert.ok(neu.rev <= 0.05 * neu.contacts, `새 길 거꾸로 ${neu.rev} / ${neu.contacts}`);
  assert.ok(neu.fix < 1, `새 길 교정 각 p50 ${neu.fix}`);
  assert.ok(old.oor >= 0.5 * old.contacts, `옛 길 범위 밖 ${old.oor} / ${old.contacts} (옛 꼴이 보여야 시험이 산다)`);
  assert.ok(neu.perAtk >= 3 * old.perAtk, `공격당 심각도 새 ${neu.perAtk} · 옛 ${old.perAtk}`);
});
