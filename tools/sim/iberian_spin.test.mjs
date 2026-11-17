// 이베리아 비기 '휘감아 돌기 (싱지르)' 시험 (10/22 — src/iberian_spin.js · secret.js PlayerSecretWatch spinTick · docs/strike/iberian_spin_2026-10-22.md)
//  node --test tools/sim/iberian_spin.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, AI } from './harness_m.mjs';
import { SECRET, SKILL, JOINTS, ARENA, realS } from '../../src/config.js'; // realS: 표준 시간(10/25) — 무장 1.5 s 는 실제 초
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { spinProgress, spinRate } from '../../src/iberian_spin.js';
import * as D from '../../src/skill_tree_data.js';
// 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — SECRET.iberianSecret 'altib' 기본 · 싱지르 = 특수 공격): 이 파일은 싱지르 비기 판 장면(무장 창 · 비기 몫 0.5 · 11/05 대본)이라
//  그 판('spin')으로 묶는다. 특수 공격 판(무장 없음 · 0.3 · 한 걸음 나가며)의 같은 성질은 tools/sim/ib_swap.test.mjs

/** 손목 값을 잠깐 바꿔 fn (10/24 17:2x 팔꿈치 돌림 · 손목 교정 · 손목 치우침 밧줄 — 몸이 만들어질 때 밧줄을 거니 판을 만들기 전에) */
const withJoints = async (vals, fn) => {
  const old = {};
  for (const k of Object.keys(vals)) {
    old[k] = JOINTS[k];
    JOINTS[k] = vals[k];
  }
  try {
    return await fn();
  } finally {
    Object.assign(JOINTS, old);
  }
};
const WRIST_OLD = { elbowSwivel: 0, wristGuard: 0 }; // 10/24 17:2x 전 판 (옛 결함을 다시 보이는 판)
// 손목 치우침 밧줄(JOINTS.wristRope)을 켜면 어긋나는 대본 판 둘 — 아래 '한 바퀴'(2.2 m 과녁 가로 베기) · '발디딤'(플랑베르주 곧은 입력 도는 동안 두 발 엇갈림).
//  대본 · 걸음 기계를 보는 시험이라 밧줄 없이 본다 — 밧줄 판의 어긋남은 docs/strike/wrist_audit_2026-10-24.md §9 에 숫자와 함께 여쭘 (값은 안 고침)
const NO_ROPE = { wristRope: 0 };
const setup = (P) => {
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
};

test('도는 진행: 0 → 1 · 빠르기 끝 0 · 가운데 1 · 한 바퀴 시간 = 시간 사다리 0.6 s (share 0 판) · 오르내림 0.2 s', () => {
  const { time: T, ramp: r } = SECRET.ibSpin;
  assert.equal(T, 0.6);
  assert.equal(r, 0.2);
  assert.equal(SECRET.ibSpin.armTime, realS(2)); // 10/25 22:3x 사장님 '이베리아 비기도 기다리는 시간 2초로' (전 1.5) · 실제 2 s (표준 시간 10/25 — 게임 2.2)
  assert.equal(spinProgress(0, T, r), 0);
  assert.equal(spinProgress(T, T, r), 1);
  let prev = 0;
  for (let t = 0; t <= T + 1e-9; t += 0.01) {
    const q = spinProgress(t, T, r);
    assert.ok(q >= prev - 1e-12, `단조 ${t}`);
    prev = q;
  }
  assert.equal(spinRate(0, T, r), 0);
  assert.equal(spinRate(T, T, r), 0);
  assert.equal(spinRate(T / 2, T, r), 1);
  // 진행의 기울기 = 빠르기 몫 ÷ (T − r)
  const t = 0.13, h = 1e-5;
  assert.ok(Math.abs((spinProgress(t + h, T, r) - spinProgress(t - h, T, r)) / (2 * h) - spinRate(t, T, r) / (T - r)) < 1e-3);
});

test('빠르기 몫 (10/24 share): 한 바퀴 = ramp + 2π · 칼끝 거리 ÷ (share × 고노센 칼끝) · 칼마다 · share 0 = 0.6 s 판', async () => {
  const { spinPlan } = await import('../../src/iberian_spin.js');
  const { iaiTipSpeed } = await import('../../src/secret_instant.js');
  assert.equal(SECRET.ibSpin.share, 0.5); // 사장님 11/05 '싱지르 0.5로 넣고' (전 0.7 — 10/24 10:5x '싱지르 고노센의 70%로')
  const share = SECRET.ibSpin.share;
  for (const w of ['zweihander', 'flamberge', 'tizona']) {
    const G = newRound({ seed: 1, weapon: w, weapon2: 'longsword' });
    const P = G.player;
    const p = spinPlan(P);
    const v0 = iaiTipSpeed(P);
    assert.ok(Math.abs(p.v - share * v0) < 1e-9, w);
    assert.ok(Math.abs(p.w - p.v / P.swordArt.measure.reach) < 1e-9, w);
    assert.ok(Math.abs(p.T - (0.2 + (2 * Math.PI) / p.w)) < 1e-9, w);
    assert.ok(p.T > 0.75 && p.T < 1.0, `${w} ${p.T}`); // 0.6 s 보다 느림 (0.5 몫 — 츠바이핸더 0.78 s · 전 0.7 몫 0.62 ~ 0.72 s: 칼날 1.30 m · 간격 reach 2.57)
    SECRET.ibSpin.share = 0;
    try {
      const q = spinPlan(P);
      assert.equal(q.T, 0.6);
      assert.equal(q.v, Infinity);
    } finally {
      SECRET.ibSpin.share = share;
    }
    G.world.free();
  }
});

// ── 10/24 10:4x 사장님 '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어. 몸통을 겨누기로 했었는데' · '작게 그으면 … 나가다 말고 좀 이상한 작은 동작이 되어 실패' (§16) ──
const withSpin = async (vals, fn) => {
  const old = {};
  for (const k of Object.keys(vals)) {
    old[k] = SECRET.ibSpin[k];
    SECRET.ibSpin[k] = vals[k];
  }
  try {
    return await fn();
  } finally {
    Object.assign(SECRET.ibSpin, old);
  }
};
const HEAD = 0.45; // 시험 눈금 — 칼 가장 높은 점이 가슴 점 + 0.45 m(머리 꼭대기 언저리)를 넘으면 '허공' (판 값 아님)
const spinTop = (r) => Math.max(...['ramp', 'wind', 'free', 'settle', 'follow'].filter((p) => r.ph[p].n).map((p) => r.ph[p].top));

test('몸통 뚜껑 (10/24 lid): 놓은 칼끝이 몸통 위 끝 쪽으로 오르는 빠르기를 남은 높이 × track 쪽으로 자름(칼날에 수직인 몫) · 끄면 그대로', async () => {
  const { spinLid } = await import('../../src/iberian_spin.js');
  const { ARM } = await import('../../src/config.js');
  for (const lid of [1, 0]) {
    await withSpin({ lid }, () => {
      const G = newRound({ seed: 7, weapon: 'flamberge', weapon2: 'longsword', gap: 8, walls: false });
      const P = G.player;
      while (G.t < 1) G.step();
      const tip = P.bladePoint(1);
      const o = P.sword.translation();
      const rx = tip.x - o.x, rz = tip.z - o.z;
      const h = Math.hypot(rx, rz);
      const k = 12 / h; // 칼끝을 위로 12 m/s 차 올리는 돌림 (칼날 수평 성분에 수직인 수평 축) + 세로 축 돌림 3 rad/s
      P.sword.setAngvel({ x: (-rz / h) * k, y: 3, z: (rx / h) * k }, true);
      const v0 = P.sword.velocityAtPoint(tip);
      assert.ok(v0.y > 5, `차 올림 ${v0.y}`);
      spinLid(P);
      const v1 = P.sword.velocityAtPoint(tip);
      const allow = SECRET.ibSpin.track * (P.bodies.chest.translation().y + ARM.shoulder[1] - tip.y);
      if (lid) {
        // 고침은 칼날에 수직인 몫만(칼 손 둘레 돌림) — 위아래 몫은 (1 − 칼 방향 세로 성분²) 만큼 (놓은 칼은 거의 수평이라 거의 다)
        const ry = tip.y - o.y;
        const keep = (rx * rx + rz * rz) / (rx * rx + rz * rz + ry * ry);
        assert.ok(v1.y <= v0.y + (allow - v0.y) * keep + 1e-6, `칼끝 위 빠르기 ${v1.y} (전 ${v0.y} · 허용 ${allow} · 몫 ${keep.toFixed(2)})`);
        assert.ok(v1.y < v0.y - 0.5 * (v0.y - allow) * keep, '위 빠르기가 줄었다');
      } else assert.ok(Math.abs(v1.y - v0.y) < 1e-9, '끄면 그대로');
      G.world.free();
    });
  }
});

// 10/24 기록 장면 (표준 시간 전 판의 게임 초 — 싱지르 무장 ibSpin.armTime 1.5): 옛 결함 재현 판 둘(아래 '칼 높이' 의 고침 끈 판 · '땅' 의 손목 옛 판 · 땅 끔)은 원을 다 그려 내는 때가 10/24 그림 판과 같아야
//  칼이 솟고(본판 10/27 대검 몸 뒤 — 표준 시간으론 셋 중 하나만 솟음) · 칼끝이 땅을 스친다 — 표준 시간(무장 게임 1.65)으로는 그 때가 0.15 s 늦어 옛 결함이 안 보인다(옛 결함 재현만의 장면 · docs/strike/time_standard_2026-10-25.md §4). 고친 판(땅 · 발디딤)은 표준 시간 그대로 본다
const withScene1024 = async (fn) => {
  const a = SECRET.ibSpin.armTime, f = SECRET.armAtFight, fs = SKILL.frameScale, sh = SECRET.ibSpin.share, fc = { ...SKILL.fingerCut };
  Object.assign(SKILL.fingerCut, { arm: 1, gain: 1 }); // 11/06 손가락 긋기 기본 켬 전 장면 (원을 그리는 동안은 보통 휘두름 — 감도 · 팔 힘 2 면 낼 때 손 · 칼 자리가 달라 옛 결함(솟음 셋 중 하나만 · 땅 막힘 없음)이 안 남)
  SECRET.ibSpin.armTime = 1.5;
  SECRET.ibSpin.share = 0.7; // 10/24 장면의 빠르기 몫 (11/05 0.5 전 — 느린 한 바퀴면 옛 결함(솟음)이 덜 보임)
  SECRET.armAtFight = 0; // 10/24 장면은 판 시작부터 무장 시계가 감 (10/27 23:0x 전 판 — 공격이 풀린 때부터 세면 원을 긋는 때가 정지 뒤로 밀려 옛 결함 장면이 아님)
  SKILL.frameScale = 'off'; // 10/24 장면의 손 매핑 배수 (10/31 대검 배수 'heavy' 전 — docs/motion/guard_arms_2026-10-31.md: 대검 손이 13 % 멀어져 '땅' 의 옛 결함(칼끝 땅 스침)이 안 남)
  try {
    return await fn();
  } finally {
    SECRET.ibSpin.armTime = a;
    SECRET.armAtFight = f;
    SKILL.frameScale = fs;
    SECRET.ibSpin.share = sh;
    Object.assign(SKILL.fingerCut, fc);
  }
};


// ── 10/24 12:5x 사장님 '넘어지지 않으려면 다리가 넓게 딛거나 무릎 관절로 몸을 분산 지지해야 하는데 두 다리가 딱 붙어서 곧게 편 채 같은 방향을 지지하고 있음' (§17) ──
const FOOT_LON = 0.45; // 시험 눈금 — 받아 멈춤 끝 두 발 앞뒤 (이베리아 자세 guardLength 0.62 의 3/4 언저리 · 판 값 아님)
const PEL_MID = 0.1; // 시험 눈금 — 골반이 두 발 가운데에서 앞뒤로 벗어난 거리 (판 값 아님)
