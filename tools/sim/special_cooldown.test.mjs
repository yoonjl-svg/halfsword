// 특수 공격 공통 식힘 시험 (사장님 10/28 02:0x '‘특수공격’은 6초 쿨타임이 있어. 제비베기 듀플리렌 염시 카바치오네. 쿨타임은 스킬이 발동한 순간부터 재.' — config UNIQUE_ASSIST.specialCooldown):
//   넷(제비 베기 · 겹치기 · 날개 접기 · 칼끝 돌려 빼기) 마다: 나간 뒤 실제 6 s 안에 조건이 다시 차면 보통 동작(탭 = 보통 탭 찌르기 · 제비 베기 = 보통 올려 긋기 — 자세 칸 '이어 긋기' 이름 없음) ·
//   6 s 뒤면 다시 나감 · 기술마다 따로 · 식힘 중 탭은 조건을 보지 않음(칼끝 돌려 빼기의 이른 탭 규칙도 안 걸림)
//  작게 · 빠르게: 기록을 손으로 놓는 시험.  node --test tools/sim/special_cooldown.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS } = CONFIG;
const CD = realS(6.0);

test('기본값 — 식힘 실제 6 s · 표 칸 special = 제비 베기 · 겹치기 · 날개 접기 · 칼끝 돌려 빼기 넷뿐', () => {
  assert.ok(Math.abs(UA.specialCooldown - CD) < 1e-12);
  const sp = Object.values(PLAYER_UNIQUE).flat().filter((e) => e.special).map((e) => e.name).sort();
  assert.deepEqual(sp, ['cavazione', 'duplieren', 'lianchi', 'tsubameGaeshi']);
});

/** 몸 하나 + 한 기술만 연 강화 */
function body(weapon, name) {
  const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword' });
  const P = G.player;
  const guard = weapon === 'rapier' ? new PlayerParryGuard(P, G.enemy) : null;
  if (guard) P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: new Set([name]) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  if (guard) guard.clock = 10;
  const wait = (s) => {
    uq.t += s;
    if (guard) guard.clock += s;
  };
  const tap = () => {
    P.skill.tap = null;
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired[name] ?? 0;
    P.skill.thrust();
    return (uq.stats.fired[name] ?? 0) > n0;
  };
  return { G, P, uq, guard, wait, tap, free: () => G.world.free() };
}

/** 탭 특수 공격 셋: arm() = 그 조건을 채움 (매번 새로) */
const TAPS = {
  cavazione: ['rapier', (B) => (B.guard.opposition.lastEnd = { t: B.guard.clock - realS(0.8), reason: 'complete', dealt: false })],
  lianchi: ['hwando', (B) => (B.uq.backOff = B.uq.t - realS(0.2))],
  duplieren: [
    'longsword',
    (B) => {
      B.uq.bladeTouch = () => true;
      B.uq.cur = { tech: 'zornhau', kind: 'cut', tap: false, t0: B.uq.t - 0.2, dir: [-0.7, -0.7], landed: false, bound: true, tEnd: null, unique: null };
    },
  ],
};

for (const [name, [weapon, arm]] of Object.entries(TAPS))
  test(`${name}: 나감 → 실제 1 s · 5.9 s 뒤 조건이 다시 차도 보통 탭 찌르기 → 6.1 s 뒤 다시 나감`, () => {
    const B = body(weapon, name);
    try {
      arm(B);
      assert.equal(B.tap(), true, '처음');
      const e = B.uq.list.find((x) => x.name === name);
      assert.ok(B.uq.cooling(e));
      B.wait(realS(1));
      arm(B);
      assert.equal(B.tap(), false, '1 s');
      assert.ok(B.P.skill.tap, '보통 탭 찌르기');
      B.wait(realS(4.9));
      arm(B);
      assert.equal(B.tap(), false, '5.9 s');
      B.wait(realS(0.2));
      arm(B);
      assert.equal(B.tap(), true, '6.1 s');
    } finally {
      B.free();
    }
  });

test('칼끝 돌려 빼기: 식힘 중의 이른 탭은 조건을 보지 않아 기회를 없애지 않음 (식힘이 끝난 뒤 같은 막아찌르기 끝에서 창 안 탭이면 나감)', () => {
  const B = body('rapier', 'cavazione');
  try {
    TAPS.cavazione[1](B);
    assert.equal(B.tap(), true);
    B.wait(CD - realS(0.3));
    const E = (B.guard.opposition.lastEnd = { t: B.guard.clock - realS(0.1), reason: 'complete', dealt: false }); // 식힘 끝 0.3 s 전에 끝난 막아찌르기
    assert.equal(B.tap(), false, '식힘 중 (이른 탭이기도 함)');
    assert.ok(!E.cavSpent, '기회를 없애지 않음');
    B.wait(realS(0.6)); // 끝난 때부터 0.7 s — 식힘도 끝남
    assert.equal(B.tap(), true);
  } finally {
    B.free();
  }
});

test('제비 베기: 나감 → 6 s 안의 빗나간 내려베기 뒤 올려 긋기는 보통 올려 긋기 (고르지 않음 · 자세 칸 이름 없음) → 6 s 뒤 다시 제비 베기', () => {
  const B = body('uchigatana', 'tsubameGaeshi');
  try {
    const e = B.uq.list.find((x) => x.name === 'tsubameGaeshi');
    const miss = () => {
      B.uq.chainFrom = null;
      B.uq.last = { tech: 'oberhau', kind: 'cut', tap: false, t0: B.uq.t - 0.4, dir: [0, -1], landed: false, bound: false, tEnd: B.uq.t - 0.05, unique: null };
    };
    const up = () => ({ tech: null, kind: 'cut', pad: null, t0: B.uq.t, dir: [0, 1], start: [0, -0.4], landed: false, bound: false, tEnd: null, unique: null });
    miss();
    assert.equal(B.uq.readyChain(B.uq.t)?.name, 'tsubameGaeshi', '자세 칸 이어 긋기');
    assert.equal(B.uq.choose(up(), [0, -0.4], [0, 1], B.uq.t)?.e.name, 'tsubameGaeshi');
    B.uq.coolStart(e); // 나간 순간 (start 의 part 1 과 같은 자리)
    B.wait(realS(2));
    miss();
    assert.equal(B.uq.readyChain(B.uq.t), null, '식힘 중 자세 칸 이름 없음');
    assert.equal(B.uq.choose(up(), [0, -0.4], [0, 1], B.uq.t)?.e.name ?? null, null, '보통 올려 긋기');
    B.wait(realS(4.1));
    miss();
    assert.equal(B.uq.choose(up(), [0, -0.4], [0, 1], B.uq.t)?.e.name, 'tsubameGaeshi', '6 s 뒤');
  } finally {
    B.free();
  }
});

test('제비 베기: 강화 시작(start part 1)이 식힘을 엶 · 이어 긋기 뒷몫(part 2)은 새로 나간 것이 아님', () => {
  const B = body('uchigatana', 'tsubameGaeshi');
  try {
    const e = B.uq.list.find((x) => x.name === 'tsubameGaeshi');
    const cur = { tech: null, kind: 'cut', pad: null, t0: B.uq.t, dir: [0, 1], start: [0, -0.4], landed: false, bound: false, tEnd: null, unique: null };
    B.uq.start(e, cur, 1);
    assert.equal(B.uq.coolT.tsubameGaeshi, B.uq.t);
    B.uq.end?.('done', B.uq.t);
    B.wait(0.3);
    B.uq.start(e, { ...cur, t0: B.uq.t }, 2);
    assert.equal(B.uq.coolT.tsubameGaeshi, B.uq.t - 0.3, '뒷몫은 식힘을 다시 열지 않음');
  } finally {
    B.free();
  }
});

test('기술마다 따로: 한 기술이 식는 동안 다른 특수 공격은 그대로 (몸마다 따로 — 강화 하나에 기록)', () => {
  const B = body('hwando', 'lianchi');
  try {
    TAPS.lianchi[1](B);
    assert.equal(B.tap(), true);
    const lian = B.uq.list.find((x) => x.name === 'lianchi');
    assert.ok(B.uq.cooling(lian));
    for (const n of ['tsubameGaeshi', 'duplieren', 'cavazione']) assert.equal(B.uq.cooling({ name: n, special: true }), false, n);
    B.uq.coolStart({ name: 'duplieren', special: true });
    assert.ok(B.uq.cooling({ name: 'duplieren', special: true }));
    assert.ok(Math.abs(B.uq.coolLeft('lianchi') - CD) < 1e-9);
    const C = body('hwando', 'lianchi'); // 다른 몸 — 따로
    try {
      assert.equal(C.uq.cooling(C.uq.list.find((x) => x.name === 'lianchi')), false);
    } finally {
      C.free();
    }
    UA.specialCooldown = 0;
    try {
      assert.equal(B.uq.cooling(lian), false, '끔 (0)');
    } finally {
      UA.specialCooldown = CD;
    }
  } finally {
    B.free();
  }
});
