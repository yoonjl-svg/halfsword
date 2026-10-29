// 특수 공격 공통 식힘 시험 (사장님 10/28 02:0x 6 s · 나간 순간부터 → 10/29 19:5x '쿨타임은 특수공격 3초(발동이 완료된 시점부터 카운트, 경직시간을 포함할지 말지는 너가 판단)' —
//   config UNIQUE_ASSIST.specialCooldown · specialCoolFrom 'free' 감독 해석 · 사장님 확인 중):
//   다섯(제비 베기 · 겹치기 · 날개 접기 · 칼끝 돌려 빼기 · 풍차 베기 — 풍차 베기는 redondo_hold.test.mjs) 마다: 나간 뒤 그 동작이 끝날 때까지 + 끝난 때(몸이 다시 자유로울 때 — 운동학 칼 · 풀기 0.2 s ·
//   탭 찌르기 · 강화 긋기 끝)부터 실제 3 s 안에 조건이 다시 차면 보통 동작 · 3 s 뒤면 다시 나감 · 기술마다 따로 · 식힘 중 탭은 조건을 보지 않음(칼끝 돌려 빼기의 이른 탭 규칙도 안 걸림) ·
//   'motion' = 동작 끝부터(풀기 빼고) · 'fire' = 나간 순간부터(10/28 판)
//  실제 물리 스텝으로 시간이 감 (상대는 서 있음).  node --test tools/sim/special_cooldown.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS } = CONFIG;
const CD = realS(3.0);

test('기본값 — 식힘 실제 3 s · 끝난 때(몸이 자유로울 때 free)부터 · 표 칸 special = 제비 베기 · 겹치기 · 날개 접기 · 칼끝 돌려 빼기 · 풍차 베기 다섯뿐', () => {
  assert.ok(Math.abs(UA.specialCooldown - CD) < 1e-12);
  assert.equal(UA.specialCoolFrom, 'free');
  const sp = Object.values(PLAYER_UNIQUE).flat().filter((e) => e.special).map((e) => e.name).sort();
  assert.deepEqual(sp, ['cavazione', 'duplieren', 'lianchi', 'redondo', 'tsubameGaeshi']);
});

/** 몸 하나 + 한 기술만 연 강화 · 실제 스텝 */
function body(weapon, name) {
  const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword', gap: 2.4 });
  const P = G.player;
  G.ai.update = () => {};
  const guard = weapon === 'rapier' ? new PlayerParryGuard(P, G.enemy) : null;
  if (guard) P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: new Set([name]) });
  if (guard) G.before = () => guard.step(DT);
  const until = (pred, max = 30) => {
    for (let i = 0; i < Math.round(max / DT) && !pred(); i++) G.step();
  };
  for (let i = 0; i < 30; i++) G.step();
  const free = () => !P.skill.tap && !P.iai && !P.iaiReq && !(P.iaiHoldT > 0) && !(P.iaiFade > 0) && !uq.r && !uq.cur;
  return { G, P, uq, guard, until, free, e: uq.list.find((x) => x.name === name) };
}

const TAPS = {
  cavazione: ['rapier', (B) => (B.guard.opposition.lastEnd = { t: B.guard.clock - realS(0.8), reason: 'complete', dealt: false })],
  lianchi: ['hwando', (B) => (B.uq.backOff = B.uq.t - realS(0.2))],
  duplieren: ['longsword', (B) => {
    B.uq.bladeTouch = () => true;
    B.uq.cur = { tech: 'zornhau', kind: 'cut', tap: false, t0: B.uq.t - 0.2, dir: [-0.7, -0.7], landed: false, bound: true, tEnd: null, unique: null };
  }],
};
const tapper = (B, name, arm) => () => {
  const n0 = B.uq.stats.fired[name] ?? 0;
  arm(B);
  B.P.skill.thrust();
  return (B.uq.stats.fired[name] ?? 0) > n0;
};

for (const [name, [weapon, arm]] of Object.entries(TAPS))
  test(`${name}: 나감 → 끝날 때까지 식힘 중 · 끝난 때부터 실제 2.9 s 뒤 조건이 다시 차도 보통 탭 찌르기 → 3.1 s 뒤 다시 나감`, () => {
    for (const at of [2.9, 3.1]) {
      const B = body(weapon, name);
      try {
        const tap = tapper(B, name, arm);
        assert.equal(tap(), true, '처음');
        assert.equal(B.uq.coolT[name], Infinity, '도는 동안');
        assert.ok(B.uq.cooling(B.e));
        B.until(() => B.uq.coolT[name] !== Infinity, 3);
        const tEnd = B.uq.coolT[name];
        assert.ok(Number.isFinite(tEnd) && B.free(), '끝난 때 = 몸이 자유로울 때');
        const run = B.uq.stats.coolRuns.at(-1);
        assert.ok(run.free > run.motion - 1e-9 && run.free > 0, `동작 ${run.motion} · 자유 ${run.free}`);
        B.until(() => B.uq.t - tEnd >= realS(at) - 1e-9, 5);
        const out = tap();
        if (at < 3) {
          assert.equal(out, false, `${at} s`);
          assert.ok(B.P.skill.tap, '보통 탭 찌르기');
        } else assert.equal(out, true, `${at} s`);
      } finally {
        B.G.world.free();
      }
    }
  });

test('칼끝 돌려 빼기: 식힘 중의 이른 탭은 조건을 보지 않아 기회를 없애지 않음 (식힘이 끝난 뒤 같은 막아찌르기 끝에서 창 안 탭이면 나감)', () => {
  const B = body('rapier', 'cavazione');
  try {
    assert.equal(tapper(B, 'cavazione', TAPS.cavazione[1])(), true);
    B.until(() => B.uq.coolT.cavazione !== Infinity, 3);
    const tEnd = B.uq.coolT.cavazione;
    B.until(() => B.uq.t - tEnd >= CD - realS(0.3) && B.free(), 6);
    const E = (B.guard.opposition.lastEnd = { t: B.guard.clock - realS(0.1), reason: 'complete', dealt: false }); // 식힘 끝 0.3 s 전에 끝난 막아찌르기
    const n0 = B.uq.stats.fired.cavazione;
    B.P.skill.thrust();
    assert.equal(B.uq.stats.fired.cavazione, n0, '식힘 중 (이른 탭이기도 함)');
    assert.ok(!E.cavSpent, '기회를 없애지 않음');
    const tEarly = B.uq.t;
    B.P.skill.tap = null; // 보통 탭 찌르기는 거둠 (몸을 비움 — 다음 탭을 막지 않게)
    B.until(() => B.uq.t - tEarly >= realS(0.6), 2); // 끝난 때부터 0.7 s(창 안) · 식힘은 0.3 s 전에 끝남
    B.P.skill.thrust();
    assert.equal(B.uq.stats.fired.cavazione, n0 + 1);
  } finally {
    B.G.world.free();
  }
});

/** 제비 베기: 빗나간 내려베기 뒤 올려 긋기 시작 (detect → choose → start part 1 — 사람 길 그대로) */
function tsuUp(B) {
  const { uq } = B;
  const n0 = uq.stats.fired.tsubameGaeshi ?? 0;
  uq.chainFrom = null;
  uq.cur = null;
  uq.last = { tech: 'oberhau', kind: 'cut', tap: false, t0: uq.t - 0.4, dir: [0, -1], landed: false, bound: false, tEnd: uq.t - 0.05, unique: null };
  uq.wasSwing = false;
  uq.restPos = [0, -0.4];
  uq.detect(DT, true, new THREE.Vector2(0, 2.5));
  return (uq.stats.fired.tsubameGaeshi ?? 0) > n0;
}

test('제비 베기: 나감 → 강화 긋기 · 되돌림 칼이 끝날 때까지 식힘 중(자세 칸 이름 없음) → 끝난 때부터 2.9 s 안 보통 올려 긋기 · 3.1 s 뒤 다시 제비 베기', () => {
  for (const at of [2.9, 3.1]) {
    const B = body('uchigatana', 'tsubameGaeshi');
    try {
      assert.equal(tsuUp(B), true);
      assert.equal(B.uq.coolT.tsubameGaeshi, Infinity);
      B.until(() => B.uq.coolT.tsubameGaeshi !== Infinity, 3);
      const tEnd = B.uq.coolT.tsubameGaeshi;
      assert.ok(Number.isFinite(tEnd) && !B.uq.r, '강화 긋기가 끝난 뒤');
      B.until(() => B.uq.t - tEnd >= realS(at) - 1e-9, 5);
      B.uq.last = { tech: 'oberhau', kind: 'cut', tap: false, t0: B.uq.t - 0.4, dir: [0, -1], landed: false, bound: false, tEnd: B.uq.t - 0.05, unique: null };
      if (at < 3) assert.equal(B.uq.readyChain(B.uq.t), null, '식힘 중 자세 칸 이름 없음');
      assert.equal(tsuUp(B), at > 3, `${at} s`);
    } finally {
      B.G.world.free();
    }
  }
});

test('제비 베기: 이어 긋기 뒷몫(part 2)은 새로 나간 것이 아님 (식힘을 다시 열지 않음)', () => {
  const B = body('uchigatana', 'tsubameGaeshi');
  try {
    const e = B.e;
    const cur = { tech: null, kind: 'cut', pad: null, t0: B.uq.t, dir: [0, 1], start: [0, -0.4], landed: false, bound: false, tEnd: null, unique: null };
    B.uq.start(e, cur, 1);
    assert.equal(B.uq.coolRun.tsubameGaeshi?.t0, B.uq.t);
    const t0 = B.uq.t;
    B.uq.end?.('done', B.uq.t);
    B.uq.t += 0.3;
    B.uq.start(e, { ...cur, t0: B.uq.t }, 2);
    assert.equal(B.uq.coolRun.tsubameGaeshi?.t0, t0, '뒷몫은 식힘을 다시 열지 않음');
  } finally {
    B.G.world.free();
  }
});

test("세기 시작하는 때: 'motion' = 동작 끝(풀기 0.2 s 빼고 — free 보다 이름) · 'fire' = 나간 순간(10/28 판)", () => {
  const got = {};
  for (const from of ['free', 'motion', 'fire']) {
    UA.specialCoolFrom = from;
    const B = body('hwando', 'lianchi');
    try {
      const tap = tapper(B, 'lianchi', TAPS.lianchi[1]);
      const tFire = B.uq.t;
      assert.equal(tap(), true);
      B.until(() => B.free() && !B.uq.coolRun.lianchi, 3);
      got[from] = B.uq.coolT.lianchi - tFire;
    } finally {
      UA.specialCoolFrom = 'free';
      B.G.world.free();
    }
  }
  assert.ok(Math.abs(got.fire) < 1e-9, `fire ${got.fire}`);
  assert.ok(got.motion > 0 && got.free > got.motion + 0.15, `motion ${got.motion} · free ${got.free}`);
});

test('기술마다 따로 · 몸마다 따로 · 0 = 끔', () => {
  const B = body('hwando', 'lianchi');
  try {
    assert.equal(tapper(B, 'lianchi', TAPS.lianchi[1])(), true);
    const lian = B.e;
    assert.ok(B.uq.cooling(lian));
    for (const n of ['tsubameGaeshi', 'duplieren', 'cavazione', 'redondo']) assert.equal(B.uq.cooling({ name: n, special: true }), false, n);
    const C = body('hwando', 'lianchi');
    try {
      assert.equal(C.uq.cooling(C.e), false);
    } finally {
      C.G.world.free();
    }
    UA.specialCooldown = 0;
    try {
      assert.equal(B.uq.cooling(lian), false, '끔 (0)');
    } finally {
      UA.specialCooldown = CD;
    }
  } finally {
    B.G.world.free();
  }
});
