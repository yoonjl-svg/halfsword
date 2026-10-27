// 이동 스틱 돌리기 몸짓 시험 (10/23 — 이베리아 휘감아 돌기 스틱 판 · src/stick_turn.js · secret.js PlayerSecretWatch.spinStick · docs/strike/iberian_spin_2026-10-22.md §10)
//  node --test tools/sim/stick_turn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { stickTurnState, stickTurnStep, STICK_DEAD } from '../../src/stick_turn.js';
import { SECRET, SKILL, ARENA } from '../../src/config.js';

const F = 1 / 60; // 표본 간격 (60 fps 프레임)
const R = Math.PI / 180;
const opt = (o = {}) => ({ time: SECRET.ibSpin.stickTime, need: SECRET.ibSpin.stickTurn * R, path: !!SECRET.ibSpin.stickPath, ...o });

/** 스틱 끝을 a0 → a0 + turn(°) 으로 dur 초 동안 고르게 돌린다 (크기 r). 돌려줌: 처음 참이 된 표본 시각 또는 null */
function arc(st, a0, turn, dur, { r = 1, o = opt() } = {}) {
  const n = Math.max(1, Math.round(dur / F));
  let hit = null;
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (turn * i) / n) * R;
    if (stickTurnStep(st, i ? F : 0, r * Math.cos(a), r * Math.sin(a), o) && hit == null) hit = i * F;
  }
  return hit;
}
/** 한 자리에 dur 초 (x, y) */
function hold(st, x, y, dur, o = opt()) {
  let any = false;
  for (let i = 0; i < Math.round(dur / F); i++) any = stickTurnStep(st, F, x, y, o) || any;
  return any;
}

test('판 값: 스틱 판(10/24 부터 스위치 — 기본은 공격 원 판 attackCircle) · 반 바퀴 180° (사장님 10/23 00:4x) · 0.6 s (사다리 이어짐/입력) · 데드존 0.15', () => {
  assert.equal(SECRET.ibSpin.input, 'attackCircle');
  assert.equal(SECRET.ibSpin.stickTurn, 180);
  assert.equal(SECRET.ibSpin.stickTime, 0.6);
  assert.equal(SECRET.ibSpin.stickPath, 1);
  assert.equal(STICK_DEAD, 0.15);
});

test('한 바퀴 0.5 s 참 (반 바퀴 지점에서) · 반 바퀴(190°) 0.5 s 참 · 시계 · 반시계 모두', () => {
  for (const dir of [1, -1]) {
    const t1 = arc(stickTurnState(), 90, dir * 360, 0.5);
    assert.ok(t1 != null && Math.abs(t1 - 0.25) < 0.03, `한 바퀴 ${dir} ${t1}`);
    const t2 = arc(stickTurnState(), 0, dir * 190, 0.5);
    assert.ok(t2 != null, `반 바퀴 ${dir}`);
  }
});

test('반 바퀴에 못 미침(170°) 거짓 · 0.6 s 를 넘겨 돌림 거짓(반 바퀴를 0.8 s · 한 바퀴를 1.5 s)', () => {
  assert.equal(arc(stickTurnState(), 90, 170, 0.3), null);
  assert.equal(arc(stickTurnState(), 90, -170, 0.3), null);
  assert.equal(arc(stickTurnState(), 90, 200, 0.8), null); // 0.6 s 안에는 150° 까지만
  assert.equal(arc(stickTurnState(), 90, 360, 1.5), null); // 0.6 s 안에는 144° 까지만
  assert.notEqual(arc(stickTurnState(), 90, 360, 1.0), null); // 0.6 s 안에 216° — 참
});

test('반대로 돌기: 120° 반시계 → 120° 시계는 거짓(돌아선 곳부터 새로 셈) · 이어서 시계로 200° 까지 가면 참', () => {
  const st = stickTurnState();
  assert.equal(arc(st, 90, 120, 0.15), null);
  assert.equal(arc(st, 210, -120, 0.15), null);
  assert.ok(st.turn < 125 * R);
  assert.notEqual(arc(st, 90, -80, 0.1), null); // 시계 쪽 합 200°
});

test('놓음(데드존 안 = 0)에서 셈을 비움: 120° · 놓음 · 120° 는 거짓', () => {
  const st = stickTurnState();
  assert.equal(arc(st, 0, 120, 0.15), null);
  assert.equal(hold(st, 0, 0, F), false);
  assert.equal(st.turn, 0);
  assert.equal(arc(st, 120, 120, 0.15), null);
});

test('곧게 지나가기는 반 바퀴가 아님: 왼쪽 → 앞을 스쳐 → 오른쪽 (가운데에서 0.3 떨어진 곧은 길) · 앞 → 뒤 가운데 지나기', () => {
  // 곧은 길은 원점을 지나지 않으면 늘 180° 보다 적게 돈다
  const st = stickTurnState();
  let hit = false;
  for (let i = 0; i <= 12; i++) hit = stickTurnStep(st, F, -0.9 + (1.8 * i) / 12, 0.3, opt()) || hit;
  assert.equal(hit, false);
  assert.ok(st.turn < Math.PI);
  // 앞 → 뒤 를 한 프레임에 (스틱이 가운데를 건너뜀) — path 켬이면 놓음으로 봄
  const st2 = stickTurnState();
  hold(st2, 0.02, 1, 0.1);
  assert.equal(stickTurnStep(st2, F, 0, -1, opt()), false);
  assert.equal(stickTurnStep(st2, F, -0.1, -1, opt()), false); // 이어 조금 더 돌아도 새로 셈
  assert.ok(st2.turn < 10 * R);
});

test('여덟 방향 키보드: W → WD → D → SD → S (45° 넷 = 반 바퀴) 0.1 s 씩 참 · 셋(90°) 거짓 · A → A+D(0) → D 거짓 · W → S 바로는 path 켬 거짓 · 끔 참', () => {
  const s2 = Math.SQRT1_2;
  const key = (seq, dur, o = opt()) => {
    const st = stickTurnState();
    let hit = false;
    for (const [x, y] of seq) hit = hold(st, x, y, dur, o) || hit;
    return hit;
  };
  assert.equal(key([[0, 1], [s2, s2], [1, 0], [s2, -s2], [0, -1]], 0.1), true);
  assert.equal(key([[0, 1], [-s2, s2], [-1, 0], [-s2, -s2], [0, -1]], 0.1), true); // 반대쪽
  assert.equal(key([[0, 1], [s2, s2], [1, 0]], 0.1), false);
  assert.equal(key([[-1, 0], [0, 0], [1, 0]], 0.05), false); // 옆 → 옆 (두 키를 함께 누른 순간 0)
  assert.equal(key([[0, 1], [0, -1]], 0.05), false); // 앞 키를 떼며 뒤 키 — 한 프레임에 정반대
  assert.equal(key([[0, 1], [0, -1]], 0.05, opt({ path: false })), true); // 표본만 보면 정반대 한 걸음 = π 로 읽힘 (path 를 둔 까닭)
  assert.equal(key([[0, 1], [s2, s2], [1, 0], [s2, -s2], [0, -1]], 0.2), false); // 0.2 s 씩이면 0.6 s 안에 135° 까지
  // W 를 오래 쥐다가 굴림: 쥔 시간은 세지 않는다 (돌기 시작한 때부터 0.6 s)
  {
    const st = stickTurnState();
    hold(st, 0, 1, 0.8);
    let hit = false;
    for (const [x, y] of [[s2, s2], [1, 0], [s2, -s2], [0, -1]]) hit = hold(st, x, y, 0.12) || hit;
    assert.equal(hit, true);
  }
});

test('사람 몸: 무장 창이 열린 동안 스틱 반 바퀴 → 참 (공격 입력 창 아님) · attack 판이면 거짓 · 창 없으면 셈 비움', async () => {
  const prevIn = SECRET.ibSpin.input;
  SECRET.ibSpin.input = 'stick'; // 10/24 부터 기본은 공격 원 판 — 스틱 판을 스위치로 켜고 잰다
  const { newRound, DT } = await import('./harness_m.mjs');
  const { PlayerSecretWatch } = await import('../../src/secret.js');
  const G = newRound({ seed: 2, weapon: 'zweihander', weapon2: 'longsword', gap: 3.4 });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  G.before = () => W.update(DT, !!P.skill.sec);
  // 창 전: 돌려도 거짓 (셈 없음)
  assert.equal(W.spinStick(F, { x: 1, y: 0 }, true), false);
  while (G.t < ARENA.startHold + SECRET.ibSpin.armTime + 0.5 && W.open?.ctx?.ev !== 'spin') G.step(); // 무장 시계는 판 시작 정지가 끝나야 감 (10/27 23:0x)
  assert.equal(W.open?.ctx?.ev, 'spin');
  assert.equal(W.stickOwns(), true);
  const turn = (can = true) => {
    let hit = false;
    for (let i = 0; i <= 18; i++) {
      const a = (90 - i * 12) * R; // 0.3 s 에 216° (시계)
      hit = W.spinStick(F, { x: Math.cos(a), y: Math.sin(a) }, can) || hit;
    }
    return hit;
  };
  assert.equal(turn(false), false); // 낼 수 없음(기력 · 굳음 · 비기 중) — 셈 비움
  assert.equal(turn(), true);
  SECRET.ibSpin.input = 'attack';
  try {
    assert.equal(W.stickOwns(), false);
    assert.equal(turn(), false);
  } finally {
    SECRET.ibSpin.input = 'stick';
  }
  const o = W.fire();
  assert.equal(o.ctx.ev, 'spin');
  assert.ok(P.skill.secret(o), '휘감아 돌기 냄');
  G.world.free();
  SECRET.ibSpin.input = prevIn;
});
