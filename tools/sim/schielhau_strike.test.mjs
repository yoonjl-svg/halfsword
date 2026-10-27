// 곁눈 베기(셸하우) 길 다시 그림 시험 (10/25 08:0x 사장님 '셸하우 3번 — 맞는 순간 손목이 사람 범위 안 · 손목 교정 전처럼 세게' — docs/strike/wrist_audit_2026-10-24.md §13):
//   UNIQUE_ASSIST.schielPath 1(기본): AI 곁눈 베기 = schools.js schielhau redraw(길 점 + 길 덧칸 — 칼끝 들기 · 손 뻗기 · 손 돌리기) · 0 = 10/25 전 길(옛 꼴이 다시 보여야 시험이 산다).
//   사람 쪽(10/25 18:0x 사장님 '같은 길 입혀' — UNIQUE_ASSIST.schielPlayer 1(기본)): 강화동작 곁눈 베기의 잣대 길(uniqueDef)이 다시 그린 길 · 같은 덧칸(PlayerUniqueAssist.planStep —
//    손가락이 그 길 위 어디쯤인지로 섞음) · 0 = 옛 길 잣대 · 덧칸 없음(18:0x 전 판). 덧칸 없는 기술은 techPlan 이 늘 null.
//   사람 곁눈 베기 세기 손잡이 UNIQUE_ASSIST.schielPlayerK (18:5x '50% 세기' 조건부 — 기본 1): 같은 길인 사람 곁눈 베기의 칼날 상처 심각도만 × k — 물리 · 손목 그대로 · AI 그대로.
//   사람 칼끝 들기 UNIQUE_ASSIST.schielPlayerTip (사장님 10/25 20:2x 결정 — 기본 1 = AI 와 같은 셋): 0 = 시험용 — 사람 덧칸은 손 뻗기 · 손 돌리기만.
//  node --test tools/sim/schielhau_strike.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, AI } from './harness_m.mjs';
import { duelRun, duelSummary, playerRun, tsubameRun, tsubameSummary } from './schielhau_strike.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { PLAYER_UNIQUE, uniqueDef, PlayerUniqueAssist } from '../../src/unique_assist.js';

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
const withPlayer = (v, fn) => {
  const old = UA.schielPlayer;
  UA.schielPlayer = v;
  try {
    return fn();
  } finally {
    UA.schielPlayer = old;
  }
};
const schielOf = (ai) => ai.school.tech.find((t) => t.name === 'schielhau');

test('값 · 자료 꼴 (기본 켬 · 놓는 시간 0.2 s — 시간 사다리 · 덧칸은 [from, ...path] 점마다 셋 · from 은 0)', () => {
  assert.equal(UA.schielPath, 1);
  assert.equal(UA.schielPlayer, 1);
  assert.equal(UA.schielPlayerK, 1); // 사장님 10/25 20:2x 결정 — 세기 100 % (0.5 는 시험용 · wrist_audit §15)
  assert.equal(UA.schielPlayerTip, 1); // 사장님 10/25 20:2x '칼끝 들기 빼지 말란 얘기야' — 같은 길 그대로(덧칸 셋) · 0 은 시험용
  assert.equal(UA.planRelease, 0.2);
  const u = TRADITIONS.german.unique.find((x) => x.name === 'schielhau');
  assert.ok(u.redraw?.path?.length && u.redraw.plan?.length);
  assert.equal(u.redraw.plan.length, u.redraw.path.length + 1);
  for (const p of u.redraw.plan) assert.equal(p.length, 3);
  assert.deepEqual(u.redraw.plan[0], [0, 0, 0]); // 베기 시작에서 덧칸이 튀지 않게
  assert.deepEqual(u.path, [[0.22, 0.36], [0.06, 0.2], [0.0, 0.03]]); // 옛 길은 그대로 남김 (스위치 0 · 사람 강화 잣대)
});

test('AI 꾸러미: 켜면 다시 그린 길 · 덧칸 · 끄면 옛 길 · 덧칸 없음 — 사람 잣대 길: 둘 다 켜면 다시 그린 길 · 덧칸 · schielPlayer 0 이나 schielPath 0 이면 옛 길 · 덧칸 없음', () => {
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
  const both = uniqueDef('german', e);
  assert.deepEqual(both.pts, [u.from, ...u.redraw.path]);
  assert.deepEqual(both.plan, u.redraw.plan);
  for (const d of [withPlayer(0, () => uniqueDef('german', e)), withPath(0, () => uniqueDef('german', e))]) {
    assert.deepEqual(d.pts, [u.from, ...u.path]);
    assert.equal('plan' in d, false); // 18:0x 전 판과 같은 꼴
  }
  // AI 꾸러미는 사람 스위치와 상관없음
  assert.deepEqual(withPlayer(0, mk).plan, u.redraw.plan);
});

test('사람 덧칸 셈: 손 목표를 다시 그린 길에 비춘 자리로 섞음 · 뒤로 가지 않음 · 길 끝을 지나면 끝 점 값 · 강화가 끝나면 planRelease 에 걸쳐 0 · 끄면 늘 null', () => {
  const G = newRound({ seed: 7, weapon: 'longsword', weapon2: 'longsword' });
  try {
    const P = G.player;
    const HD = Math.PI / 180;
    const uq = new PlayerUniqueAssist(P, { names: new Set(['schielhau']) });
    const e = uq.list.find((x) => x.name === 'schielhau');
    const U = e.U;
    const L = U.plan;
    const fire = () => (uq.r = { e, U, part: 1, t: 0, travel: 0, len: 0.7, stepAsked: true });
    fire();
    // 첫 토막 가운데
    P.handOffset.set((U.pts[0][0] + U.pts[1][0]) / 2, (U.pts[0][1] + U.pts[1][1]) / 2);
    uq.planStep(DT);
    assert.ok(Math.abs(P.techPlan.reach - (L[0][1] + L[1][1]) / 2) < 1e-9);
    assert.ok(Math.abs(P.techPlan.tilt - ((L[0][0] + L[1][0]) / 2) * HD) < 1e-9); // 기본: AI 와 같은 덧칸 셋
    assert.ok(Math.abs(P.techPlan.turn - ((L[0][2] + L[1][2]) / 2) * HD) < 1e-9);
    const tip0 = UA.schielPlayerTip;
    UA.schielPlayerTip = 0; // 세 갈래 3: 사람은 칼끝 들기 없음
    try {
      uq.planStep(DT);
      assert.equal(P.techPlan.tilt, 0);
      assert.ok(Math.abs(P.techPlan.reach - (L[0][1] + L[1][1]) / 2) < 1e-9);
    } finally {
      UA.schielPlayerTip = tip0;
    }
    // 길 끝 너머(손가락은 분노의 베기처럼 더 긋는다) = 끝 점 값 · 손이 되돌아가도 그대로
    const z = U.pts[U.pts.length - 1];
    P.handOffset.set(z[0] - 0.3, z[1] - 0.3);
    uq.planStep(DT);
    const end = L[L.length - 1];
    assert.ok(Math.abs(P.techPlan.reach - end[1]) < 1e-9 && Math.abs(P.techPlan.turn - end[2] * HD) < 1e-9);
    P.handOffset.set(U.pts[0][0], U.pts[0][1]);
    uq.planStep(DT);
    assert.ok(Math.abs(P.techPlan.reach - end[1]) < 1e-9);
    // 강화 끝 → 놓음
    uq.r = null;
    let steps = 0;
    while (P.techPlan && steps < 1000) {
      uq.planStep(DT);
      steps++;
    }
    assert.ok(Math.abs(steps * DT - UA.planRelease) <= 2 * DT, `놓는 데 ${steps * DT} s`);
    // 끔: 옛 잣대 · 덧칸 없음 → techPlan 이 생기지 않음
    withPlayer(0, () => {
      const uq0 = new PlayerUniqueAssist(P, { names: new Set(['schielhau']) });
      const e0 = uq0.list.find((x) => x.name === 'schielhau');
      uq0.r = { e: e0, U: e0.U, part: 1, t: 0, travel: 0, len: 0.6, stepAsked: true };
      P.handOffset.set(0.1, 0.1);
      uq0.planStep(DT);
      assert.equal(P.techPlan, null);
    });
  } finally {
    G.world.free();
  }
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

// 씨앗 여섯 → 열둘 (10/27 표준 시간 — 적힌 시간이 실제 초가 되어 손가락 봇 판 · 과녁 몸 돌기가 바뀜: 여섯 씨앗으론 3 판 범위 밖 4 / 23 = 17 % · 3 ÷ 전 판 세기 1.38 로 문턱을 넘고
//  옛 판도 여섯 씨앗 2 / 24 · 0.80 처럼 출렁임 — 열둘이면 표준 시간 5 / 46 · 1.23 · 옛 판 5 / 48 · 0.91 로 둘 다 문턱 안 · 문턱 그대로 · 기록 docs/strike/time_standard_2026-10-25.md §4)
test('사람 곁눈 베기 맞는 순간 (손가락 봇 · 분노의 베기 길 · 고른 견줌 — 상대 상처 끔 · 씨앗 열둘 × 앞 다섯 칼): 같은 길(기본 · 덧칸 셋)과 3(칼끝 들기 없음) 모두 손목 범위 밖 ≤ 15 % · 거꾸로 ≤ 5 % · 3 은 공격당 심각도가 18:0x 전 판의 ± 25 % 안 · 같은 길은 더 셈 / 전 판은 범위 밖 ≥ 25 %', () => {
  const fair = () => duelSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => playerRun(s, { foe: 'still', dur: 14, immortal: true })).map((r) => ({ ...r, rows: r.rows.slice(0, 5) })));
  const withTip = (v, fn) => {
    const old = UA.schielPlayerTip;
    UA.schielPlayerTip = v;
    try {
      return fn();
    } finally {
      UA.schielPlayerTip = old;
    }
  };
  const full = fair();
  const opt3 = withTip(0, fair);
  const old = withPlayer(0, fair);
  assert.ok(full.contacts >= 15 && opt3.contacts >= 15 && old.contacts >= 15, `맞음 ${full.contacts} · ${opt3.contacts} · ${old.contacts}`);
  for (const [nm, d] of [['같은 길', full], ['3', opt3]]) {
    assert.ok(d.oor <= 0.15 * d.contacts, `${nm} 범위 밖 ${d.oor} / ${d.contacts}`);
    assert.ok(d.rev <= 0.05 * d.contacts, `${nm} 거꾸로 ${d.rev} / ${d.contacts}`);
  }
  assert.ok(old.oor >= 0.25 * old.contacts, `전 판 범위 밖 ${old.oor} / ${old.contacts} (옛 꼴이 보여야 시험이 산다)`);
  assert.ok(Math.abs(opt3.perAtk / old.perAtk - 1) <= 0.25, `3 공격당 심각도 ${opt3.perAtk} · 전 판 ${old.perAtk} (손목 고침으로 세지지도 약해지지도 않게)`);
  assert.ok(full.perAtk > opt3.perAtk, `같은 길 ${full.perAtk} · 3 ${opt3.perAtk} (칼끝 들기가 세기 몫)`);
});

test('사람 곁눈 베기 세기 손잡이 (schielPlayerK — 18:5x 50 % 조건부): 0.5 면 첫 맞음 심각도만 × k · 맞는 빠르기 · 에너지 · 손목 그대로 · AI 곁눈 베기 그대로 · schielPlayer 0 이면 안 걸림', () => {
  const K0 = UA.schielPlayerK;
  const firstHit = (k, fn) => {
    UA.schielPlayerK = k;
    try {
      return fn();
    } finally {
      UA.schielPlayerK = K0;
    }
  };
  const pl = () => playerRun(1, { foe: 'still', dur: 12 }).rows.find((x) => x.hit).hit;
  const a = firstHit(1, pl);
  const b = firstHit(0.5, pl);
  assert.ok(a.sev > 0);
  assert.ok(Math.abs(b.sev - 0.5 * a.sev) < 1e-12, `심각도 ${b.sev} · ${a.sev}`);
  assert.equal(b.energy, a.energy);
  assert.equal(b.speed, a.speed);
  assert.equal(b.s.dev, a.s.dev);
  // 끔: 같은 길이 아니면 세기 값이 안 걸림
  const c = withPlayer(0, () => firstHit(1, pl));
  const d = withPlayer(0, () => firstHit(0.5, pl));
  assert.equal(d.sev, c.sev);
  // AI 곁눈 베기는 그대로
  const ai = (k) => firstHit(k, () => duelRun(2, { foe: 'still', dur: 12 }).rows.map((x) => x.hit?.sev ?? null));
  assert.deepEqual(ai(0.5), ai(1));
});

test('제비 베기 견줌 판 (10/25 20:3x — 재기 도구만): 정수리 내려베기 → 곧장 위로 한 벌이 제비 베기로 강화됨 · ghostDown 이면 아래 칼 맞음 없음 · 게임 값 그대로', () => {
  const r = tsubameRun(1, { immortal: true, dur: 14, ghostDown: true });
  const d = tsubameSummary([r]);
  assert.ok(d.combos >= 2, `한 벌 ${d.combos}`);
  assert.ok(d.firedCombos >= 1, `제비 베기 ${d.firedCombos} / ${d.combos}`);
  assert.equal(d.downContacts, 0);
  assert.equal(UA.schielPlayerTip, 1);
});
