// 이베리아 B7 '이어 돌리기' 시험 (11/14 사장님 '이베리아 이어 돌리기로 진행해.' — config IB_LINK · src/iberian_link.js · unique_assist.js linkTry · linkTick · 기록 docs/strike/ib_link_2026-11-14.md)
//  새 공격이 아니라 사이동작: 앞 진짜 긋기가 끝나고 이어짐 창 안에 다음 큰 칼을 그었는데 손이 그 시작 자리에 없으면 칼이 머리 위로 돌아 시작 자리로 · 그은 칼이 거기서 나감 ·
//  흐름 사슬의 다음 칼로 셈 · 원 동안 막기 안 됨 · 끄면(IB_LINK.on 0) 11/12 판 풍차 베기 · 다른 유파 그대로 · 스위치 B · C' 끄면 전 판.
//  시간 상한(몇 초 안에 끝나야 함)을 보는 시험은 없음.
//  node --test tools/sim/ib_link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { IB_LINK, IB_FLOW, SECRET, ARENA, UNIQUE_ASSIST as UA, realS } from '../../src/config.js';
import { linkNeed, LINK_TECH, linkStart, linkEnd, linkPlan, linkNow } from '../../src/iberian_link.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { G as PAD } from '../../src/ai_techniques.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { airOne } from './ib_link.mjs';
import { fightOne } from './school_balance.mjs';

const LADDER = [0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0].map((s) => realS(s));
const keep = () => ({ ...IB_LINK });
const restore = (o) => Object.assign(IB_LINK, o);

test('기본값 — 이어 돌리기 켬 (사장님 11/14 결정) · 원 시간 사다리 값 · 식힘 · B · C\' · AI 끔', () => {
  assert.equal(IB_LINK.on, 1);
  assert.ok(LADDER.some((x) => Math.abs(x - IB_LINK.time) < 1e-12), `원 시간 ${IB_LINK.time} — 시간 사다리 값`);
  assert.equal(IB_LINK.cool, 0, '공격이 아니므로 특수 공격 식힘 없음 (감독 안)');
  assert.equal(IB_LINK.chainArm, 0);
  assert.equal(IB_LINK.trade, 0);
  assert.equal(IB_LINK.ai, 0);
  assert.equal(IB_LINK.tradeHurt, 1.2);
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

test('다른 유파 그대로 — 이어 돌리기 · 스위치 B · C\' · AI 를 켜도 독일 칸 판은 같음', () => {
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

test('스위치 B · C\' 끄면 전 판 — 세 칼 기력 0 이 들어도 무장 없음 · 맞바꿈 없음 / 켜면 무장 · 맞바꿈', () => {
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
    // C'
    IB_LINK.trade = 0;
    P.ibFlowOn = true;
    assert.equal(P.ibTradeLive(), false);
    assert.equal(P.ibTradeHurt(), 1);
    IB_LINK.trade = 1;
    assert.equal(P.ibTradeLive(), true, '흐름 사슬 중');
    P.ibTrade = P.ibTradeLive();
    assert.equal(P.ibTradeHurt(), IB_LINK.tradeHurt);
    const pain = P.pain;
    P.pain = 1;
    const vT = P.vigor;
    P.ibTrade = false;
    const v0 = P.vigor;
    assert.ok(vT > v0, `맞바꿈 동안 아픔이 힘을 안 뺌 ${vT} > ${v0}`);
    P.pain = pain;
  } finally {
    restore(o);
    G.world.free();
  }
});
