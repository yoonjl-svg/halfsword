// 동방 특수 공격 시험 — 날개 접기 (C6 염시 · 사장님 10/28 00:2x ~ 00:3x · 01:0x — docs/strike/lianchi_2026-10-28.md · config UNIQUE_ASSIST.lianTap · lianWindow · lianSnapShare · lianSnapTime):
//   내가 긋는 칼(긋기)이 상대 칼에 부딪힌 때부터 실제 0.6 s 안의 탭 = 날개 접기(오른 허리로 거둠 → 앞으로 반걸음 들며 허리를 오른 → 왼 가로 호 · 격살 칼끝 빠르기 × 0.6 · 0.2 s) ·
//   찌르기의 맞물림 · 긋기가 끝난 뒤 닿은 칼(손가락이 긋지 않는 때) · 창 밖의 탭은 보통 탭 찌르기 · 탭 연타(찌르기 맞닿음을 되풀이)로는 날개 접기 · 칼끝 돌려 빼기 모두 안 나감
//  작게 · 빠르게(사장님): 손으로 기록을 놓는 시험 + 씨앗 하나 판.  node --test tools/sim/lianchi_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { drillRun } from './special_balance.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET } = CONFIG;

test('기본값 — 날개 접기 탭 켬 · 창 실제 0.6 s · 격살 칼끝 빠르기 × 0.6 · 실제 0.2 s (사장님 10/28 00:3x · 01:0x) · 전 판 꺾음 입력 그대로', () => {
  assert.equal(UA.lianTap, 1);
  assert.ok(Math.abs(UA.lianWindow - realS(0.6)) < 1e-12);
  assert.equal(UA.lianSnapShare, 0.6);
  assert.ok(Math.abs(UA.lianSnapTime - realS(0.2)) < 1e-12);
  const e = PLAYER_UNIQUE.chinese.find((x) => x.name === 'lianchi');
  assert.deepEqual(e.on, [{ prev: 'stichPflug', when: 'turn' }]);
  assert.equal(e.tapKey, 'lian');
  assert.equal(UA.lianTrig, 'clash');
  assert.ok(e.tapFold);
});

/** 사람 몸 + 연 고유 공격 (판을 돌리지 않음 — 기록을 손으로 놓고 탭을 부름) */
function body(weapon, names, w2 = 'longsword') {
  const G = newRound({ walls: true, seed: 3, weapon, weapon2: w2 });
  const P = G.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(names) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  const put = (rec) => {
    uq.tapRec = null;
    uq.cur = null;
    uq.last = { tech: null, kind: 'cut', tap: false, t0: uq.t - 0.5, dir: [0, 0], landed: false, bound: false, tEnd: uq.t - 0.1, unique: null, ...rec };
    uq.atk = uq.last;
    return uq.last;
  };
  const tap = (name) => {
    P.skill.tap = null;
    P.iai = null;
    P.iaiReq = null;
    const n0 = uq.stats.fired[name] ?? 0;
    P.skill.thrust();
    return (uq.stats.fired[name] ?? 0) > n0;
  };
  return { G, P, uq, put, tap, free: () => G.world.free() };
}

test('긋기가 부딪힌 뒤 실제 0.3 s 의 탭 = 날개 접기 (허리 호 요청 · 격살 몫 × 0.6 · 실제 0.2 s · 앞으로 반걸음 · 같은 공격) · 찌르기 맞물림 뒤 0.3 s 탭은 아님', () => {
  const B = body('hwando', ['lianchi']);
  try {
    B.put({ bound: true, boundT: B.uq.t - realS(0.3), clashT: B.uq.t - realS(0.3) });
    assert.equal(B.tap('lianchi'), true);
    const R = B.P.iaiReq;
    assert.ok(R?.combo && R.tech === 'lianchi');
    const gk = SECRET.gyeoksal.share > 0 ? SECRET.gyeoksal.share : SECRET.cnFastShare;
    assert.ok(Math.abs(R.share - UA.lianSnapShare * gk) < 1e-12);
    assert.equal(R.maxT, UA.lianSnapTime);
    assert.equal(R.hold, 0);
    assert.ok(R.keepAim);
    const m = R.moves[0];
    assert.ok(m.same && m.cutSweep && m.capFromCut);
    assert.equal(m.dyn.target, 'waist');
    assert.equal(m.dyn.band, 'waist');
    assert.equal(m.step.fwd, SECRET.chineseStep);
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기 없음');
    // 찌르기가 맞물린 뒤(긋기 부딪힘 아님) 0.3 s 탭 → 보통 탭
    B.put({ kind: 'thrust', tap: true, tech: 'tap', bound: true, boundT: B.uq.t - realS(0.3) });
    assert.equal(B.tap('lianchi'), false);
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
  } finally {
    B.free();
  }
});

test('창 밖(실제 0.7 s) · 긋기가 끝난 뒤 닿음(부딪힘 없이 맞물림만) · 한 번 부딪힘에 두 번 · 끔(lianTap 0)은 보통 탭', () => {
  const B = body('hwando', ['lianchi']);
  try {
    B.put({ bound: true, boundT: B.uq.t - realS(0.7), clashT: B.uq.t - realS(0.7) });
    assert.equal(B.tap('lianchi'), false, '늦음');
    B.put({ bound: true, boundT: B.uq.t - realS(0.2) }); // 맞물림만 (긋던 동안의 부딪힘 clashT 없음)
    assert.equal(B.tap('lianchi'), false, '긋지 않는 때 닿음');
    const r = B.put({ bound: true, boundT: B.uq.t - realS(0.2), clashT: B.uq.t - realS(0.2) });
    assert.equal(B.tap('lianchi'), true);
    B.uq.tapRec = null;
    B.uq.last = r;
    B.uq.atk = r;
    assert.equal(B.tap('lianchi'), false, '한 번 부딪힘에 한 번');
    B.put({ bound: true, boundT: B.uq.t - realS(0.2), clashT: B.uq.t - realS(0.2) });
    UA.lianTap = 0;
    try {
      assert.equal(B.tap('lianchi'), false, '끔');
    } finally {
      UA.lianTap = 1;
    }
  } finally {
    B.free();
  }
});

test('탭 연타(0.15 s 마다 · 탭마다 찌르기 맞닿음)는 날개 접기 · 칼끝 돌려 빼기 모두 0 번 · 맞닿고 실제 0.8 s 뒤 탭은 칼끝 돌려 빼기', () => {
  for (const [weapon, names, name] of [['hwando', ['lianchi'], 'lianchi'], ['rapier', ['cavazione'], 'cavazione']]) {
    const B = body(weapon, names);
    try {
      let fired = 0;
      for (let k = 0; k < 12; k++) {
        B.put({ kind: 'thrust', tap: true, tech: 'tap', bound: true, boundT: B.uq.t - realS(0.15), clashT: undefined });
        if (B.tap(name)) fired++;
        B.uq.t += realS(0.15);
      }
      assert.equal(fired, 0, `${name} 연타`);
      if (name === 'cavazione') {
        B.put({ kind: 'thrust', tap: true, tech: 'tap', bound: true, boundT: B.uq.t - realS(0.8) });
        assert.equal(B.tap(name), true, '맞닿고 0.8 s 탭');
      }
    } finally {
      B.free();
    }
  }
});

test('판 (씨앗 1 · 칼끝을 든 가운데 자세 상대): 사선 내려 긋기가 칼에 부딪힌 뒤 탭이 날개 접기로 나가 허리(배 · 골반)를 침 · 손목 사람 범위', () => {
  let fired = 0;
  const H = [];
  for (const seed of [1, 2, 3, 4]) {
    const r = drillRun('lianTap', seed, { foe: 'guardHigh', variant: 'on', dur: 14 });
    for (const a of r.atts.filter((x) => x.fired > 0)) {
      fired++;
      H.push(...a.hits.filter((h) => h.tech === 'lianchi'));
    }
  }
  assert.ok(fired >= 1, `나감 ${fired}`);
  assert.ok(H.some((h) => h.zone === 'abdomen' || h.zone === 'pelvis'), `허리 맞음 ${H.map((h) => h.zone).join(',')}`);
  for (const h of H.filter((x) => x.w)) assert.ok(h.w.oor <= 1 && Math.abs(h.w.fe) <= CONFIG.JOINTS.wristFE, `손목 ${JSON.stringify(h.w)}`);
});

test('후보 조건 갈래 (사장님 확인 전 — lianTrig back): 뒤로 물러남(스틱 뒤) 뒤 실제 0.3 s 의 탭 = 날개 접기 · 0.7 s 는 아님 · 한 번 물러남에 한 번', () => {
  const B = body('hwando', ['lianchi']);
  UA.lianTrig = 'back';
  try {
    B.put({});
    B.uq.back = { t: B.uq.t - realS(0.7), spent: false };
    assert.equal(B.tap('lianchi'), false, '늦음');
    B.uq.back = { t: B.uq.t - realS(0.3), spent: false };
    assert.equal(B.tap('lianchi'), true);
    B.uq.tapRec = null;
    assert.equal(B.tap('lianchi'), false, '한 번에 한 번');
  } finally {
    UA.lianTrig = 'clash';
    B.free();
  }
});
