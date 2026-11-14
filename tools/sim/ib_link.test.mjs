// 이베리아 B7 '이어 돌리기' 시험 (11/14 사장님 '이베리아 이어 돌리기로 진행해.' — config IB_LINK · src/iberian_link.js · unique_assist.js linkTry · linkTick · 기록 docs/strike/ib_link_2026-11-14.md)
//  새 공격이 아니라 사이동작: 앞 진짜 긋기가 끝나고 이어짐 창 안에 다음 큰 칼을 그었는데 손이 그 시작 자리에 없으면 칼이 머리 위로 돌아 시작 자리로 · 그은 칼이 거기서 나감 ·
//  흐름 사슬의 다음 칼로 셈 · 원 동안 막기 안 됨 · 끄면(IB_LINK.on 0) 11/12 판 풍차 베기 · 다른 유파 그대로 · 스위치 B 끄면 전 판 ·
//  B12 맞바꿈 '멈추지 않는 칼'(11/14 사장님 확인 — IB_LINK.trade · fighter.js ibTradeTry): 원 동안 몸에 든 맞음 한 번을 기력(그 무기 베기 한 번 값)으로 넘김 · 사슬당 한 번.
//  시간 상한(몇 초 안에 끝나야 함)을 보는 시험은 없음.
//  node --test tools/sim/ib_link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { IB_LINK, IB_FLOW, SECRET, ARENA, STAMINA, UNIQUE_ASSIST as UA, realS } from '../../src/config.js';
import { linkNeed, LINK_TECH, linkStart, linkEnd, linkPlan, linkNow } from '../../src/iberian_link.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { G as PAD } from '../../src/ai_techniques.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { airOne } from './ib_link.mjs';
import { fightOne } from './school_balance.mjs';
import { AI } from '../../src/ai.js';

const LADDER = [0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0].map((s) => realS(s));
const keep = () => ({ ...IB_LINK });
const restore = (o) => Object.assign(IB_LINK, o);

test('기본값 — 이어 돌리기 켬 (사장님 11/14 결정) · 원 시간 사다리 값 · 식힘 · B 끔 · 맞바꿈 B12 켬 · AI 도 켬 (사장님 11/14 \'모두 본판에 넣어 ai에게도 똑같이 적용해\')', () => {
  assert.equal(IB_LINK.on, 1);
  assert.ok(LADDER.some((x) => Math.abs(x - IB_LINK.time) < 1e-12), `원 시간 ${IB_LINK.time} — 시간 사다리 값`);
  assert.equal(IB_LINK.cool, 0, '공격이 아니므로 특수 공격 식힘 없음 (감독 안)');
  assert.equal(IB_LINK.chainArm, 0);
  assert.equal(IB_LINK.trade, 1, '맞바꿈 B12 칸 효과 켬 (칸을 익힌 사람만)');
  assert.equal(IB_LINK.ai, 1, 'AI 이베리아도 이어 돌리기 · 맞바꿈 (11/14 사장님)');
  assert.equal(IB_LINK.tradeHurt, undefined, '옛 C\' 받는 피해 배율은 걷어냄 (사장님 11/14 \'권고대로 해\')');
});

test('잇는 칼 고르기 — 큰 칼(내려 · 가로 베기)만 · 여기서 그대로 그어지는 칼이면 안 돌림', () => {
  assert.deepEqual(LINK_TECH.map((t) => t.name).sort(), ['oberhau', 'zornhau', 'zornhauL', 'zwerch', 'zwerchL']);
  const n = (start, dir) => linkNeed(start, dir)?.name ?? null;
  assert.equal(n(PAD.wechselL, [0.73, -0.68]), 'zornhauL', '탈류 끝(왼 아래)에서 ↘ → 왼 분노의 베기 자리로');
  assert.equal(n(PAD.wechselL, [-0.73, -0.68]), 'zornhau', '탈류 끝에서 ↙ 다시 → 분노의 베기 자리로 (머리 위 한 바퀴)');
  assert.equal(n(PAD.wechselL, [0, -1]), 'oberhau', '↓ → 정수리 베기');
  assert.equal(n(PAD.wechselL, [0.7, 0.7]), null, '↗ 는 여기서 왼 올려베기 — 그대로');
  assert.equal(n(PAD.tagR, [-0.73, -0.68]), null, '이미 분노의 베기 자리 — 그대로');
  assert.equal(n(PAD.wechselR, [-0.7, 0.7]), null, '↖ 올려베기 — 그대로');
  assert.equal(n(PAD.sideR, [-1, 0.08]), null, '가로베기 자리에서 ← — 그대로');
  assert.equal(n(PAD.wechselR, [-1, 0.08]), 'zwerch', '레베스 끝(오른 아래)에서 ← → 가로베기 자리로');
});

test('머리 위 원 길 — 앞 칼이 가던 쪽으로 · 탈류 뒤 레베스는 짧게 · 탈류 뒤 탈류는 머리 뒤로 한 바퀴', () => {
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 1, gap: 6 });
  const P = G.player;
  try {
    const pose = (pad) => {
      const A = linkNow(P);
      const B = { H: A.H.clone(), D: A.D.clone() };
      P.padPose(pad[0], pad[1], B.H, B.D);
      return B;
    };
    const A = pose(PAD.wechselL);
    const toL = linkPlan(P, A, pose(PAD.tagL), -1);
    const toR = linkPlan(P, A, pose(PAD.tagR), -1);
    const deg = (x) => Math.abs((x * 180) / Math.PI);
    assert.ok(deg(toL.dpsi) <= 45, `탈류 → 레베스 ${deg(toL.dpsi).toFixed(0)}°`);
    assert.ok(deg(toR.dpsi) >= 180, `탈류 → 탈류 ${deg(toR.dpsi).toFixed(0)}°`);
    assert.ok(toR.dpsi < 0, '앞 칼(오른 → 왼)이 가던 쪽 그대로');
    // 머리 위 원 자리: 칼이 곧게 선 축에서 기운 꼴(위 성분 > 0.8) · 두 손이 이마 앞 위
    const over = toR.pts.slice(1, -1);
    assert.ok(over.length >= 4);
    for (const p of over) assert.ok(p.D.y > 0.8 && p.H.y > 0.25, '머리 위');
  } finally {
    G.world.free();
  }
});

test('이어 돌리기 — 앞 칼 뒤 이어짐 창 안에 큰 칼을 그으면 머리 위로 돌아 시작 자리에서 그 칼이 나감 · 흐름 사슬의 다음 칼(위력 · n)로 셈', () => {
  const r = airOne({ next: ['zornhauL', 'zornhau', 'zornhau'], v: 5.5 });
  assert.equal(r.stats?.fired, 3, JSON.stringify(r.stats));
  assert.equal(r.stats.done, 3);
  assert.deepEqual(r.links.map((l) => l.tech), ['zornhauL', 'zornhau', 'zornhau']);
  assert.ok(r.links.every((l) => l.still === 0), '원 동안 칼이 서지 않음 (칼끝 1.5 m/s 밑 스텝 0)');
  const cuts = r.cuts;
  assert.equal(cuts.length, 4, JSON.stringify(cuts));
  assert.deepEqual(cuts.map((c) => c.tech), ['zornhau', 'zornhauL', 'zornhau', 'zornhau'], '다시 그은 칼이 그 기술로 읽힘');
  assert.deepEqual(cuts.map((c) => c.n), [0, 1, 2, 3], '사슬의 다음 칼');
  if (IB_FLOW.chainStack) assert.deepEqual(cuts.map((c) => c.k), [1, 1.2, 1.4, 1.6], '이어지는 흐름 위력 1 + 0.2 n');
});

test('창 밖이면 안 돌림 · 여기서 그어지는 칼(올려베기)이면 안 돌림', () => {
  const late = airOne({ next: ['zornhauL'], v: 5.5, pause: 1.0 });
  assert.equal(late.stats?.fired ?? 0, 0, '앞 칼 끝에서 이어짐 창(0.6 s) 넘게 쉬면 없음');
  const up = airOne({ next: ['unterhauL'], v: 5.5 });
  assert.equal(up.stats?.fired ?? 0, 0, '탈류 끝(왼 아래)에서 왼 올려베기 — 그대로');
});

test('원 동안 막기 안 됨 — 막기 단추를 쥐어도 손을 안 쥠 (슬러거의 대가)', () => {
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 2, gap: 1.8 });
  const P = G.player;
  const E = G.enemy;
  try {
    G.ai.update = () => E.move.set(0, 0);
    const guard = new PlayerParryGuard(P, E);
    while (G.t < ARENA.startHold + 0.2) G.step();
    guard.held = true;
    guard.step(DT);
    assert.equal(guard.active, true, '보통은 막기가 손을 쥠');
    assert.ok(linkStart(P, PAD.tagR), '이어 돌리기 시작');
    guard.step(DT);
    assert.equal(guard.active, false, '원 동안 막기 없음');
    linkEnd(P);
    guard.step(DT);
    assert.equal(guard.active, true, '끝나면 다시');
  } finally {
    G.world.free();
  }
});

test('끄면(IB_LINK.on 0) 11/12 판 풍차 베기 — 원 긋기로 냄 · 이어 돌리기 없음 / 켜면 원 긋기로 풍차 베기 안 남', () => {
  const o = keep();
  const run = () => {
    const G = newRound({ seed: 3, weapon: 'zweihander', weapon2: 'longsword', gap: 1.9 });
    const P = G.player;
    const E = G.enemy;
    P.skill.corr = CONFIG.SKILL.corr;
    P.skill.corrTip = CONFIG.SKILL.corrTip;
    P.skill.autoGuard = true;
    G.ai.update = () => E.move.set(0, 0);
    const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo', 'cingir']) });
    const F = 1 / 60;
    let go = false;
    try {
      while (G.t < ARENA.startHold + 0.3) G.step();
      const n = Math.round(0.8 / F);
      let prev = [0, 0];
      for (let i = 1; i <= n && !go; i++) {
        const z = i / n;
        const p = [0.15 * (Math.cos(z * Math.PI * 2 * 1.35) - 1), 0.15 * Math.sin(z * Math.PI * 2 * 1.35)];
        go = uq.circleTick(F, { x: p[0] - prev[0], y: p[1] - prev[1] }, true, !P.skill.sec && P.alive);
        prev = p;
        G.step();
      }
      return { go, special: P.skill.sec?.special ?? null };
    } finally {
      G.world.free();
    }
  };
  try {
    IB_LINK.on = 0;
    const off = run();
    assert.equal(off.go, true);
    assert.equal(off.special, 'cingir', '풍차 베기 (싱지르)');
    IB_LINK.on = 1;
    const on = run();
    assert.equal(on.go, false, '이어 돌리기 판엔 원 긋기 풍차 베기 없음');
    IB_LINK.on = 0;
    const r = airOne({ next: ['zornhauL'], v: 5.5, repos: false });
    assert.equal(r.stats, null, '이어 돌리기 없음');
  } finally {
    restore(o);
  }
});

test('다른 유파 그대로 — 이어 돌리기 · 스위치 B · 맞바꿈 · AI 를 켜도 독일 칸 판은 같음', () => {
  const o = keep();
  const one = () => JSON.stringify(fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 5, dur: 8 }));
  try {
    IB_LINK.on = 0;
    const a = one();
    Object.assign(IB_LINK, { on: 1, chainArm: 1, trade: 1, ai: 1 });
    const b = one();
    assert.equal(a, b);
  } finally {
    restore(o);
  }
});

test('스위치 B 끄면 전 판 — 세 칼 기력 0 이 들어도 무장 없음 / 켜면 곧장 무장', () => {
  const o = keep();
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 4, gap: 1.6, kit });
  const P = G.player;
  const E = G.enemy;
  try {
    G.ai.update = () => E.move.set(0, 0);
    const W = new PlayerSecretWatch(P, E, { locked: false });
    G.before = () => W.update(DT, !!P.skill.sec);
    while (G.t < ARENA.startHold + 0.3) G.step();
    IB_LINK.chainArm = 0;
    P.ibFreeCut();
    assert.ok(!P.ibChainArmReq, 'B 끔: 부탁 없음');
    G.step();
    assert.equal(W.spinArm.armed, false);
    IB_LINK.chainArm = 1;
    P.ibFreeCut();
    G.step();
    assert.equal(W.spinArm.armed, true, 'B 켬: 칼끝 거리 안이어도 곧장 무장');
    assert.equal(W.open?.ctx?.ev, 'altib');
  } finally {
    restore(o);
    G.world.free();
  }
});

test('맞바꿈 B12 (사장님 11/14 확인) — 이어 돌리는 동안 몸에 든 맞음 한 번을 그 무기 베기 한 번 값의 기력으로 넘김 · 같은 칼이 마저 친 부위도 함께 · 사슬당 한 번 · 기력 모자람 · 끔 · 칸 없음 · 원 밖이면 그대로 맞음', () => {
  const o = keep();
  const all = allNodeIds('iberian');
  const kit = kitFromNodes('iberian', all);
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 4, gap: 1.6, kit });
  const P = G.player;
  const E = G.enemy;
  const real = G.combat.analyze;
  try {
    let cap = null; // 상대 AI 가 실제로 몸에 넣은 칼날 맞음 하나 (그 판정 그대로 다시 넣어 봄)
    const pw = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, point, pr) => {
      pw?.(att, vic, r, point, pr);
      if (!cap && att === E && vic === P && r.type !== 'blunt' && r.severity > 0) cap = { r, point, pr };
    };
    while (!cap && G.t < 30) G.step();
    assert.ok(cap, '상대 칼이 몸에 듦');
    G.combat.hooks.onWound = pw;
    G.combat.analyze = () => ({ ...cap.r });
    let id = 9000;
    const hit = (part = cap.pr.v.part, same = false) => {
      if (!same) E.stamina.attackId = ++id;
      P.hitCooldowns.clear();
      return G.combat.strike({ ...cap.pr, v: { ...cap.pr.v, part } }, cap.point, false);
    };
    const cost = STAMINA.cutCost * P.stamina.weight;
    assert.ok(cost > STAMINA.cutCost, `츠바이핸더 베기 한 번 값 ${cost.toFixed(1)} (무게 배율)`);
    const fresh = () => { P.ibTradeUsed = false; P.ibTradeHit = null; P.stamina.value = STAMINA.max; };
    // 원 동안 첫 맞음 — 넘김
    IB_LINK.trade = 1;
    P.ibLink = { wounds0: P.wounds.length };
    fresh();
    const w0 = P.wounds.length, c0 = P.consciousness, p0 = P.pain;
    assert.equal(hit().traded, true, '원 동안 첫 맞음은 넘김');
    assert.equal(P.wounds.length, w0, '상처 없음');
    assert.equal(P.consciousness, c0, '의식 그대로');
    assert.equal(P.pain, p0, '아픔 그대로');
    assert.ok(Math.abs(STAMINA.max - P.stamina.value - cost) < 1e-9, `기력 = 베기 한 번 값 ${(STAMINA.max - P.stamina.value).toFixed(2)}`);
    assert.equal(hit(cap.pr.v.part === 'chest' ? 'pelvis' : 'chest', true).traded, true, '같은 칼이 같은 길에 다른 부위를 마저 침 — 함께 넘김');
    assert.ok(Math.abs(STAMINA.max - P.stamina.value - cost) < 1e-9, '기력은 한 번만');
    // 같은 사슬의 다음 칼 — 그대로 맞음
    assert.ok(!hit().traded, '사슬당 한 번');
    assert.equal(P.wounds.length, w0 + 1, '두 번째 칼은 상처');
    // 사슬이 끊기면 다시
    P.ibLink = null;
    P.ibFlowChain = false;
    P.updateIbFlow(DT);
    assert.equal(P.ibTradeUsed, false, '사슬이 끊기면 다시 한 번');
    P.ibLink = { wounds0: P.wounds.length };
    P.stamina.value = STAMINA.max;
    assert.equal(hit().traded, true, '새 사슬의 원 — 다시 넘김');
    // 기력이 베기 한 번 값보다 적으면 못 넘김
    fresh();
    P.stamina.value = cost - 0.5;
    assert.ok(!hit().traded, '기력 모자람 — 그대로 맞음');
    // 끔 · 원 밖 · 칸 없음
    fresh();
    IB_LINK.trade = 0;
    assert.ok(!hit().traded, 'IB_LINK.trade 0 — 그대로 맞음');
    IB_LINK.trade = 1;
    fresh();
    P.ibLink = null;
    assert.ok(!hit().traded, '원 밖(이어 돌리는 중이 아님) — 그대로 맞음');
    P.ibLink = { wounds0: P.wounds.length };
    fresh();
    P.skillKit = kitFromNodes('iberian', new Set([...all].filter((x) => x !== 'B12')));
    assert.ok(!hit().traded, 'B12 칸 없음 — 그대로 맞음');
  } finally {
    P.ibLink = null;
    G.combat.analyze = real;
    restore(o);
    G.world.free();
  }
});

test('맞바꿈 B12 — 칼끼리 맞아 돌던 칼이 서는 것(jolt)은 넘기지 않음 (원이 그만둠 · 막을 길은 남김)', () => {
  const o = keep();
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: 'zweihander', weapon2: 'longsword', seed: 4, gap: 3, kit });
  const P = G.player;
  const E = G.enemy;
  try {
    G.ai.update = () => E.move.set(0, 0);
    while (G.t < ARENA.startHold + 0.3) G.step();
    const uq = new PlayerUniqueAssist(P, { names: kit.unique });
    IB_LINK.trade = 1;
    P.ibLink = { wounds0: P.wounds.length };
    P.jolt = 1;
    assert.equal(uq.linkStop(), 'jolt', '맞바꿈이 켜져도 칼끼리 세게 맞으면 원이 그만둠');
    P.jolt = 0;
    assert.notEqual(uq.linkStop(), 'jolt');
  } finally {
    P.ibLink = null;
    restore(o);
    G.world.free();
  }
});

test('AI 에도 똑같이 (11/14 사장님 \'모두 본판에 넣어 ai에게도 똑같이 적용해\') — AI 이베리아가 이어 돌리기를 쓰고 풍차 베기는 안 냄 · 맞바꿈도 같은 규칙(칸 없이 늘)', () => {
  const o = keep();
  // 11/14 둘째 그때 판으로 묶음 (기준은 안 고침): 이베리아 플랜 변칙(옆 박차기 · 비스듬히 들어감 — src/ai_plan_ib.js)으로 씨앗 2 판이 갈라져 20 s 안에 이어 돌리기가 안 남 → 이베리아 플랜 전 판(`?aiPlanIb=0` 꼴)으로
  const AP = CONFIG.AI_PLAN;
  const ap = [AP.schools, AP.errSchools, AP.pommel];
  for (const k of ['schools', 'errSchools']) AP[k] = AP[k].filter((x) => x !== 'iberian' && x !== 'german'); // 3 단계(11/14): 독일 플랜 · 모든 AI 손잡이 찍기도 그 전 판으로 (상대 롱소드 AI)
  AP.pommel = 0;
  // 11/14 상대가 길 때의 대처(모든 AI — DIG_PROTO.reach): 롱소드 AI 가 상대 칼보다 짧아 파고들기 몫을 받아 이 판이 갈라짐 → 그 전 판(옛 문 reach 0)으로도 묶음 · 기준 그대로
  const reachOn = CONFIG.DIG_PROTO.reach;
  CONFIG.DIG_PROTO.reach = 0;
  const G = newRound({ walls: false, weapon: 'longsword', weapon2: 'zweihander', seed: 2, gap: 2.4, persona: { proficiency: 5 }, AI2Class: AI }); // AI 대 AI (롱소드 AI 대 츠바이핸더 이베리아 AI)
  const P = G.player;
  const E = G.enemy;
  try {
    while (G.t < 20 && P.alive && E.alive && !(G.ai.stats.ibLink?.fired > 0)) G.step();
    assert.ok(G.ai.stats.ibLink?.fired > 0, `AI 이어 돌리기 ${JSON.stringify(G.ai.stats.ibLink ?? null)}`);
    assert.equal(G.ai.stats.cingir?.fired ?? 0, 0, 'AI 풍차 베기 없음 (IB_LINK.ai 1)');
    // 맞바꿈 — AI 는 skillKit 이 없어 늘 가짐 · 사람과 같은 규칙
    assert.equal(E.skillKit ?? null, null);
    E.ibLink = { wounds0: E.wounds.length };
    E.ibTradeUsed = false;
    E.ibTradeHit = null;
    E.stamina.value = STAMINA.max;
    P.stamina.attackId = 777;
    assert.equal(E.ibTradeTry(P, { type: 'cut', severity: 0.8 }), true, 'AI 이베리아 원 동안 첫 맞음 넘김');
    assert.ok(Math.abs(STAMINA.max - E.stamina.value - STAMINA.cutCost * E.stamina.weight) < 1e-9, '기력 = 그 무기 베기 한 번 값');
    P.stamina.attackId = 778;
    assert.equal(E.ibTradeTry(P, { type: 'cut', severity: 0.8 }), false, '사슬당 한 번');
    IB_LINK.trade = 0;
    E.ibTradeUsed = false;
    E.ibTradeHit = null;
    P.stamina.attackId = 779;
    assert.equal(E.ibTradeTry(P, { type: 'cut', severity: 0.8 }), false, '끄면 AI 도 없음');
    IB_LINK.trade = 1;
    P.ibLink = { wounds0: P.wounds.length };
    assert.equal(P.ibTradeTry(E, { type: 'cut', severity: 0.8 }), false, '이베리아가 아닌 몸은 없음');
  } finally {
    E.ibLink = null;
    P.ibLink = null;
    restore(o);
    [AP.schools, AP.errSchools, AP.pommel] = ap;
    CONFIG.DIG_PROTO.reach = reachOn;
    G.world.free();
  }
});
