// 이탈리아 특수 공격 시험 (사장님 10/27 23:5x '임브로카타 찌르기 뻗게 고치고' · 10/28 00:5x 칼끝 돌려 빼기로 옮김 · 01:0x · 01:1x 탭 창 0.6 ~ 1.2 s —
//   docs/strike/imbroccata_2026-10-27.md · docs/strike/cavazione_2026-10-28.md · config UNIQUE_ASSIST.imbroReach · cavTap · cavSnap · cavFrom · cavTo):
//   ① 위에서 내려 찌르기(I7)는 읽힌 순간 탭 찌르기 덧씌우기로 찌른다(AI 와 같은 길) — 칼끝이 닿아 찌른 상처가 남(전 판 0)
//   ② 칼끝 돌려 빼기(I9): 내 찌르기가 상대 칼에 맞물린 때부터 실제 0.6 ~ 1.2 s 의 탭만 — 이른 탭은 보통 탭이고 그 기회를 없앰(연달아 두드리면 안 나감) ·
//      창 밖 · 맞물림 없는 탭 · 칼끝 돌려 빼기 제 맞물림 뒤의 탭은 보통 탭 · 낸 칼은 운동학 찌름(리솔루토 런지 칼끝 빠르기 × 0.6 · 0.2 s)
//  작게 · 빠르게(사장님): 손으로 기록을 놓는 시험 + 씨앗 하나 판 셋.  node --test tools/sim/cavazione_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import { drillRun } from './special_balance.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS } = CONFIG;

test('기본값 — 닿게 켬 · 탭 창 실제 0.6 ~ 1.2 s · 운동학 찌름 0.6 · 0.2 s (사장님 10/27 23:5x · 10/28 00:5x · 01:1x)', () => {
  assert.equal(UA.imbroReach, 1);
  assert.equal(UA.cavTap, 1);
  assert.equal(UA.cavSnap, 1);
  assert.equal(UA.cavSnapShare, 0.6);
  assert.ok(Math.abs(UA.cavSnapTime - realS(0.2)) < 1e-12);
  assert.ok(Math.abs(UA.cavFrom - realS(0.6)) < 1e-12);
  assert.ok(Math.abs(UA.cavTo - realS(1.2)) < 1e-12);
  const it = Object.fromEntries(PLAYER_UNIQUE.italian.map((e) => [e.name, e]));
  assert.deepEqual(it.imbroccata.on, [{ tech: 'stichOchs' }], '위에서 내려 찌르기 조건은 그대로 (늘 — 이어 찌르기 조건 없음)');
  assert.ok(it.imbroccata.tap && !it.imbroccata.tapKey);
  assert.deepEqual(it.cavazione.on, [{ prev: 'thrust', when: 'bound' }, { prev: 'thrust', when: 'turn' }], '긋기 조건(전 판)은 그대로');
  assert.equal(it.cavazione.tapKey, 'cav');
  assert.equal(UA.cavTrig, 'bind');
});

/** 사람 레이피어 몸 + 칼끝 돌려 빼기만 연 강화 (판을 돌리지 않음 — 기록을 손으로 놓고 탭을 부름) */
function body() {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  const P = G.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['cavazione']) });
  for (let i = 0; i < 3; i++) G.step(); // 상대 이음(f.foe) · 서 있는 몸
  uq.t = 10;
  const bound = (age, extra = {}) => {
    uq.last = { tech: 'tap', kind: 'thrust', tap: true, t0: uq.t - age - 0.2, dir: [0, 0], landed: false, bound: true, boundT: uq.t - age, tEnd: uq.t - age + 0.1, unique: null, ...extra };
    uq.atk = uq.last;
    return uq.last;
  };
  const tap = () => {
    P.skill.tap = null; // 앞 탭은 끝났다고 둠 (판을 돌리지 않으므로)
    P.iai = null;
    P.iaiReq = null;
    const n0 = uq.stats.fired.cavazione ?? 0;
    P.skill.thrust();
    return (uq.stats.fired.cavazione ?? 0) > n0;
  };
  return { G, P, uq, bound, tap, free: () => G.world.free() };
}

test('② 맞물린 때부터 실제 0.8 s 의 탭 = 칼끝 돌려 빼기 (운동학 찌름 요청 · 리솔루토 런지 칼끝 빠르기 × 0.6 · 0.2 s · 같은 공격) · 맞물림 없는 탭은 보통 탭', () => {
  const B = body();
  try {
    B.bound(realS(0.8));
    assert.equal(B.tap(), true);
    const R = B.P.iaiReq;
    assert.ok(R?.combo, '운동학 찌름 요청');
    assert.equal(R.tech, 'cavazione');
    assert.ok(Math.abs(R.share - UA.cavSnapShare * CONFIG.SECRET.risolutoShare) < 1e-12);
    assert.equal(R.maxT, UA.cavSnapTime);
    assert.equal(R.hold, 0);
    assert.equal(R.hitMul, 1);
    assert.ok(R.moves[0].same && R.moves[0].artThrust && R.moves[0].dyn.under && R.moves[0].plane);
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기는 없음');
    assert.ok(iaiTipSpeed(B.P) * R.share > 15, '레이피어 칼끝 빠르기 (고노센 × 0.6)');
    // 맞물림 없는 앞 찌르기 → 보통 탭
    B.uq.last = { tech: 'tap', kind: 'thrust', tap: true, t0: B.uq.t - 1, landed: false, bound: false, tEnd: B.uq.t - 0.8, unique: null };
    B.uq.atk = B.uq.last;
    B.uq.tapRec = null;
    assert.equal(B.tap(), false);
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
  } finally {
    B.free();
  }
});

test('② 창 끝: 실제 0.5 s(이른) · 1.3 s(늦음) 탭은 보통 탭 · 이른 탭 뒤 0.8 s 탭도 안 나감 · 칼끝 돌려 빼기 제 맞물림은 다시 열지 않음 · 끄면(cavTap 0) 보통 탭', () => {
  const B = body();
  try {
    B.bound(realS(1.3));
    assert.equal(B.tap(), false, '늦은 탭');
    const r = B.bound(realS(0.5));
    assert.equal(B.tap(), false, '이른 탭');
    assert.ok(r.cavSpent, '이른 탭이 기회를 없앰');
    B.uq.tapRec = null;
    B.uq.last = r;
    B.uq.atk = r;
    B.uq.t += realS(0.3); // 같은 맞물림에서 0.8 s
    assert.equal(B.tap(), false, '이른 탭 뒤에는 창 안이어도 안 나감');
    B.uq.tapRec = null;
    B.bound(realS(0.8), { unique: 'cavazione' });
    assert.equal(B.tap(), false, '칼끝 돌려 빼기 제 맞물림');
    B.uq.tapRec = null;
    B.bound(realS(0.8));
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

test('② 탭 연타(0.15 s 마다 · 탭마다 다시 맞물림)는 칼끝 돌려 빼기가 한 번도 안 나감', () => {
  const B = body();
  try {
    let fired = 0;
    for (let k = 0; k < 12; k++) {
      // 앞 탭이 이 탭 0.15 s 전에 맞물렸다고 둠 (연타 — 늘 0.6 s 전)
      B.uq.tapRec = null;
      B.bound(realS(0.15));
      if (B.tap()) fired++;
      B.uq.t += realS(0.15);
    }
    // 마지막 맞물림 뒤 아무 탭 없이 0.8 s 를 기다렸다 친 탭은 나감 (연타를 멈추면 다시 쓸 수 있음)
    B.uq.tapRec = null;
    B.bound(realS(0.8));
    assert.equal(fired, 0);
    assert.equal(B.tap(), true);
  } finally {
    B.free();
  }
});

test('판 (씨앗 1 · 긴 자세 상대): 맞물린 탭 뒤 창 안 탭이 칼끝 돌려 빼기로 찔러 상처 · 맞는 순간 손목 사람 범위 안 · 탭 연타 손은 0 번', () => {
  const r = drillRun('cavTap', 1, { foe: 'guard', variant: 'on', dur: 14 });
  const F = r.atts.filter((a) => a.fired > 0);
  assert.ok(F.length >= 1, `나감 ${F.length}`);
  const H = F.flatMap((a) => a.hits.filter((h) => h.tech === 'cavazione'));
  assert.ok(H.some((h) => h.type === 'stab' && h.sev > 0), '찌른 상처');
  for (const h of H.filter((x) => x.w)) assert.ok(h.w.oor <= 1 && Math.abs(h.w.fe) <= CONFIG.JOINTS.wristFE, `손목 ${JSON.stringify(h.w)}`);
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

test('후보 조건 갈래 (사장님 확인 전 — cavTrig tap2): 맞물림 없이 내 탭 찌르기를 낸 때부터 실제 0.8 s 의 탭 = 칼끝 돌려 빼기 · 0.3 s 탭은 기회를 없앰', () => {
  const B = body();
  UA.cavTrig = 'tap2';
  try {
    B.uq.last = { tech: 'tap', kind: 'thrust', tap: true, t0: B.uq.t - realS(0.8), dir: [0, 0], landed: false, bound: false, tEnd: B.uq.t - realS(0.4), unique: null };
    B.uq.atk = B.uq.last;
    assert.equal(B.tap(), true);
    B.uq.tapRec = null;
    B.uq.last = { tech: 'tap', kind: 'thrust', tap: true, t0: B.uq.t - realS(0.3), dir: [0, 0], landed: false, bound: false, tEnd: null, unique: null };
    B.uq.atk = B.uq.last;
    assert.equal(B.tap(), false);
    assert.ok(B.uq.last.cavSpent);
  } finally {
    UA.cavTrig = 'bind';
    B.free();
  }
});
