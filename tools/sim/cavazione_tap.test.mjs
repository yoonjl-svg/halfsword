// 이탈리아 특수 공격 시험 (사장님 10/27 23:5x '임브로카타 찌르기 뻗게 고치고' · 10/28 00:5x 칼끝 돌려 빼기로 옮김 · 01:1x 탭 창 0.6 ~ 1.2 s · 01:2x 조건 = 실패한 막아찌르기 —
//   docs/strike/imbroccata_2026-10-27.md · docs/strike/cavazione_2026-10-28.md · config UNIQUE_ASSIST.imbroReach · cavTap · cavSnap · cavFrom · cavTo):
//   ① 위에서 내려 찌르기(I7)는 읽힌 순간 탭 찌르기 덧씌우기로 찌른다(AI 와 같은 길) — 칼끝이 닿아 찌른 상처가 남(전 판 0)
//   ② 칼끝 돌려 빼기(I9): 막아찌르기(I6)가 상처를 못 내고 끝난 때부터 실제 0.2 ~ 1.2 s(10/29 20:0x — 전 0.6 ~ 1.2) 의 탭만 — 이른 탭은 보통 탭이고 그 기회를 없앰(연달아 두드리면 안 나감) ·
//      창 밖 · 상처를 낸 막아찌르기 · 막아찌르기 없는 탭은 보통 탭 · 낸 칼은 운동학 찌름(리솔루토 런지 칼끝 빠르기 × 0.6 · 0.2 s)
//  작게 · 빠르게(사장님): 손으로 기록을 놓는 시험 + 씨앗 하나 판 둘.  node --test tools/sim/cavazione_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import { drillRun } from './special_balance.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS } = CONFIG;

test('기본값 — 닿게 켬 · 탭 창 실제 0.6 ~ 1.2 s · 운동학 찌름 고노센 × 0.3(10/29 12:3x) · 0.2 s (사장님 10/27 23:5x · 10/28 00:5x · 01:1x · 01:2x)', () => {
  assert.equal(UA.imbroReach, 1);
  assert.equal(UA.cavTap, 1);
  assert.equal(UA.cavSnap, 1);
  assert.equal(UA.specialShare.cavazione, 0.3); // 10/29 12:3x 사장님 0.3 (02:0x 고노센 × 0.6 — 전 리솔루토 런지 1 × 0.6 과 같은 수)
  assert.ok(Math.abs(UA.cavSnapTime - realS(0.2)) < 1e-12);
  assert.ok(Math.abs(UA.cavFrom - realS(0.2)) < 1e-12); // 10/29 20:0x 0.6 → 0.2 (사람 반응 박자 — 이른 탭이 모두 0.6 s 전이었음)
  assert.ok(Math.abs(UA.cavTo - realS(1.2)) < 1e-12);
  const it = Object.fromEntries(PLAYER_UNIQUE.italian.map((e) => [e.name, e]));
  assert.deepEqual(it.imbroccata.on, [{ tech: 'stichOchs' }], '위에서 내려 찌르기 조건은 그대로 (늘 — 이어 찌르기 조건 없음)');
  assert.ok(it.imbroccata.tap && !it.imbroccata.tapKey);
  assert.deepEqual(it.cavazione.on, [], '긋기 조건 없음 (탭으로만 — 10/28 01:2x)');
  assert.equal(it.cavazione.tapKey, 'cav');
  assert.equal(UA.cavTrig, undefined, '조건 갈래 손잡이 없음');
});

/** 사람 레이피어 몸 + 막기 단추 + 칼끝 돌려 빼기만 연 강화 (판을 돌리지 않음 — 막아찌르기 끝 기록을 손으로 놓고 탭을 부름) */
function body() {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  const P = G.player;
  const guard = new PlayerParryGuard(P, G.enemy);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['cavazione']) });
  for (let i = 0; i < 3; i++) G.step(); // 상대 이음(f.foe) · 서 있는 몸
  uq.t = 10;
  guard.clock = 10;
  const O = guard.opposition;
  /** 막아찌르기가 age 초 전에 끝남 (dealt = 상처를 냈나) */
  const ended = (age, dealt = false, reason = 'complete') => {
    O.run = null;
    O.lastEnd = { t: guard.clock - age, reason, dealt };
    return O.lastEnd;
  };
  const tap = () => {
    P.skill.tap = null; // 앞 탭은 끝났다고 둠 (판을 돌리지 않으므로)
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired.cavazione ?? 0;
    P.skill.thrust();
    return (uq.stats.fired.cavazione ?? 0) > n0;
  };
  const wait = (s) => {
    guard.clock += s;
    uq.t += s;
  };
  const cd = UA.specialCooldown;
  UA.specialCooldown = 0; // 조건 시험은 식힘 없이 (식힘은 special_cooldown.test.mjs)
  return { G, P, uq, guard, O, ended, tap, wait, free: () => ((UA.specialCooldown = cd), G.world.free()) };
}

test('② 상처를 못 낸 막아찌르기가 끝난 때부터 실제 0.8 s 의 탭 = 칼끝 돌려 빼기 (운동학 찌름 요청 · 리솔루토 런지 칼끝 빠르기 × 0.6 · 0.2 s · 같은 공격) · 끊긴 막아찌르기도 같음', () => {
  const B = body();
  try {
    B.ended(realS(0.8));
    assert.equal(B.tap(), true);
    const R = B.P.iaiReq;
    assert.ok(R?.combo, '운동학 찌름 요청');
    assert.equal(R.tech, 'cavazione');
    assert.ok(Math.abs(R.share - 0.3) < 1e-12); // 고노센 × 0.3 (10/29 12:3x 사장님)
    assert.equal(R.maxT, UA.cavSnapTime);
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    assert.ok(R.moves[0].same && R.moves[0].artThrust && R.moves[0].dyn.under && R.moves[0].plane);
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기는 없음');
    assert.ok(iaiTipSpeed(B.P) * R.share > 8, '레이피어 칼끝 빠르기 (고노센 × 0.3 — 약 10.6 m/s · 10/29 12:3x)');
    assert.equal(B.tap(), false, '한 번 막아찌르기에 한 번');
    assert.ok(B.P.skill.tap, '두 번째 탭은 보통 탭 찌르기');
    B.ended(realS(0.7), false, 'interrupt');
    assert.equal(B.tap(), true, '끊긴(막힘 · 맞닿음) 막아찌르기도 실패');
  } finally {
    B.free();
  }
});

test('② 상처를 낸 막아찌르기 · 막아찌르기 없는 탭 · 도는 중 · 창 밖(실제 1.3 s) · 이른 탭(0.1 s — 그 기회를 없앰 · 10/29 20:0x 창 0.2 s 부터) · 끔(cavTap 0)은 보통 탭', () => {
  const B = body();
  try {
    B.O.lastEnd = null;
    assert.equal(B.tap(), false, '막아찌르기 없음');
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
    B.ended(realS(0.8), true);
    assert.equal(B.tap(), false, '상처를 낸 막아찌르기');
    B.ended(realS(0.8));
    B.O.run = { t: 0.1 };
    assert.equal(B.tap(), false, '새 막아찌르기가 도는 중');
    B.O.run = null;
    B.ended(realS(1.3));
    assert.equal(B.tap(), false, '늦은 탭');
    const E = B.ended(realS(0.1));
    assert.equal(B.tap(), false, '이른 탭');
    assert.ok(E.cavSpent, '이른 탭이 기회를 없앰');
    B.wait(realS(0.3)); // 같은 막아찌르기 끝에서 0.4 s (창 안)
    assert.equal(B.tap(), false, '이른 탭 뒤에는 창 안이어도 안 나감');
    B.ended(realS(0.8));
    UA.cavTap = 0;
    try {
      assert.equal(B.tap(), false, '끔');
    } finally {
      UA.cavTap = 1;
    }
  } finally {
    B.free();
  }
});

test('② 막기 단추를 쥔 채 친 탭 (10/30 00:4x 사장님 \'한번도 안나감\' — UNIQUE_ASSIST.cavHeld 1): main.js 가 쥔 막기를 알려도(feed 넷째 값) 손이 정말 쥐이지 않았으면(다섯째 값 — 탭이 막기를 놓아 줌) 나감 · cavHeld 0 은 전 판(버려짐) · 손이 쥐였으면 늘 버려짐', () => {
  const B = body();
  try {
    assert.equal(UA.cavHeld, 1);
    B.ended(realS(0.8));
    B.uq.feed(0, 0, 1 / 60, true, false); // 막기 단추를 쥔 채 탭 — main.js: guardHold 거짓(탭이 G.broken) · playerGuard.held 참
    assert.equal(B.tap(), true, '쥔 채 탭 = 칼끝 돌려 빼기');
    B.ended(realS(0.8));
    B.uq.feed(0, 0, 1 / 60, true, true); // 막기가 손을 쥐는 중 (탭이 아닌 때 — 시험으로)
    assert.equal(B.tap(), false, '손이 쥐였으면 버려짐');
    B.ended(realS(0.8));
    UA.cavHeld = 0;
    try {
      B.uq.feed(0, 0, 1 / 60, true, false);
      assert.equal(B.tap(), false, '전 판: 막기 단추를 쥐고 있으면 버려짐');
    } finally {
      UA.cavHeld = 1;
    }
    B.uq.feed(0, 0, 1 / 60, true); // 다섯째 값이 없으면 넷째 값 그대로 (다른 부르는 곳 — 전과 같음)
    assert.equal(B.uq.handHeld, true);
  } finally {
    B.free();
  }
});

test('② 탭 연타(0.15 s 마다)는 실패한 막아찌르기 뒤에도 칼끝 돌려 빼기가 한 번도 안 나감 · 막아찌르기 끝 실제 0.8 s 를 기다린 탭은 나감', () => {
  const B = body();
  try {
    B.ended(realS(0.05));
    let fired = 0;
    for (let k = 0; k < 12; k++) {
      if (B.tap()) fired++;
      B.wait(realS(0.15));
    }
    assert.equal(fired, 0, '연타');
    B.ended(realS(0.8));
    assert.equal(B.tap(), true, '기다린 탭');
  } finally {
    B.free();
  }
});

test('② 막아찌르기 기록: 도는 동안 상처(심각도 > 0)를 내면 끝 기록 dealt · 못 내면(둔타 0 · 헛침) dealt 거짓', () => {
  const B = body();
  try {
    B.O.run = { t: 0 };
    B.O.onDealt({ severity: 0 });
    B.O.cancel('complete');
    assert.equal(B.O.lastEnd.dealt, false);
    B.O.run = { t: 0 };
    B.O.onDealt({ severity: 0.4 });
    B.O.cancel('interrupt');
    assert.equal(B.O.lastEnd.dealt, true);
    B.O.onDealt({ severity: 0.4 }); // 끝난 뒤의 맞음은 그 판에 안 적음
    assert.equal(B.O.run, null);
  } finally {
    B.free();
  }
});

test('판 (씨앗 1 · 긴 자세 상대): 막기 단추 새 누름 → 막아찌르기가 상처를 못 내고 끝남 → 창 안 탭이 칼끝 돌려 빼기로 찔러 상처 · 맞는 순간 손목 사람 범위 안', () => {
  const r = drillRun('cavTap', 1, { foe: 'guard', variant: 'on', dur: 14 });
  const F = r.atts.filter((a) => a.fired > 0);
  assert.ok(F.length >= 1, `나감 ${F.length}`);
  const H = F.flatMap((a) => a.hits.filter((h) => h.tech === 'cavazione'));
  assert.ok(H.some((h) => h.type === 'stab' && h.sev > 0), '찌른 상처');
  for (const h of H.filter((x) => x.w)) assert.ok(h.w.oor <= 1 && Math.abs(h.w.fe) <= CONFIG.JOINTS.wristFE, `손목 ${JSON.stringify(h.w)}`);
});

test('② 가까운 거리 (10/30 — UNIQUE_ASSIST.cavCapCut 1): 시간 상한 0.2 s 를 찌르는 토막부터 셈 → 가슴 사이 1.1 m 에서도 찔러 맞음 · 0 = 전 판(돌려 빼기 · 겨눔이 상한을 다 써 찌름 없이 끝남)', () => {
  const one = () => {
    const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword', gap: 1.2 });
    try {
      const P = G.player;
      P.fightT = G.enemy.fightT = 1e3;
      G.ai.update = () => {};
      const guard = new PlayerParryGuard(P, G.enemy);
      P.stamina.controller = guard;
      const uq = new PlayerUniqueAssist(P, { names: new Set(['cavazione']) });
      for (let i = 0; i < 60; i++) G.step();
      guard.opposition.lastEnd = { t: guard.clock - realS(0.6), reason: 'complete', dealt: false };
      uq.t = guard.clock;
      P.skill.thrust();
      const R = P.iaiReq;
      for (let i = 0; i < 120 && (P.iai || P.iaiReq); i++) G.step();
      return { d: P.foeDistance(), cap: !!R?.moves?.[0]?.capFromCut, res: P.instantResult };
    } finally {
      G.world.free();
    }
  };
  const cd = UA.specialCooldown;
  UA.specialCooldown = 0;
  try {
    assert.equal(UA.cavCapCut, 1);
    const on = one();
    assert.ok(on.cap, '찌르는 토막부터 셈');
    assert.ok(on.d < 1.3, `가슴 사이 ${on.d}`);
    assert.equal(on.res?.tech, 'cavazione');
    assert.ok(on.res.hit && on.res.part === 'chest', `맞음 ${JSON.stringify(on.res)}`);
    UA.cavCapCut = 0;
    try {
      const off = one();
      assert.ok(!off.cap);
      assert.equal(off.res?.tech, 'cavazione');
      assert.equal(off.res.hit, false, '전 판: 찌름 없이 끝남');
    } finally {
      UA.cavCapCut = 1;
    }
  } finally {
    UA.specialCooldown = cd;
  }
});

test('① 위에서 내려 찌르기 닿게 (씨앗 1 · 서 있는 상대): 찌른 상처가 남 · 끄면(imbroReach 0) 전 판(칼날 상처 0) · 탭 찌르기 맞음은 이 기술 이름(I8 틈)', () => {
  const on = drillRun('italian', 1, { foe: 'still', variant: 'on', dur: 14 });
  const stab = on.atts.flatMap((a) => a.hits).filter((h) => h.tech === 'imbroccata' && h.type === 'stab' && h.sev > 0);
  assert.ok(stab.length >= 1, `찌른 상처 ${stab.length}`);
  UA.imbroReach = 0;
  try {
    const off = drillRun('italian', 1, { foe: 'still', variant: 'on', dur: 14 });
    assert.equal(off.atts.flatMap((a) => a.hits).filter((h) => h.sev > 0).length, 0);
  } finally {
    UA.imbroReach = 1;
  }
  assert.equal(typeof strokeTechOf, 'function');
});

test('① ② 탭이 걸어 맞추기 판(무릎 꿇은 상대 약한 자리 — skill.thrust 가 참이어도 탭이 아직 없음)이면 이름을 달지 않고 넘어감 (10/28 싸움 재기에서 떨어진 오류)', () => {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  try {
    const P = G.player;
    const guard = new PlayerParryGuard(P, G.enemy);
    P.stamina.controller = guard;
    const uq = new PlayerUniqueAssist(P, { names: new Set(['imbroccata', 'cavazione']) });
    for (let i = 0; i < 3; i++) G.step();
    const real = P.skill.thrust.bind(P.skill);
    P.skill.thrust = (o = {}) => (o.uniq === false ? true : real(o)); // 걸어 맞추기 판: 참 · 탭 없음
    const e = uq.list.find((x) => x.name === 'imbroccata');
    assert.doesNotThrow(() => uq.start(e, { tech: 'stichOchs', kind: 'thrust', t0: uq.t, dir: [0, -1], start: [0.2, 0.3], landed: false, bound: false, tEnd: null, unique: null }, 1));
    const snap = UA.cavSnap;
    UA.cavSnap = 0; // 운동학 칼 없이 — 탭 찌르기 덧씌우기 갈래
    try {
      guard.clock = 10;
      uq.t = 10;
      guard.opposition.lastEnd = { t: 10 - realS(0.8), reason: 'complete', dealt: false };
      assert.doesNotThrow(() => uq.tapChain());
    } finally {
      UA.cavSnap = snap;
    }
  } finally {
    G.world.free();
  }
});
