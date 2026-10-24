// 이베리아 비기 '휘감아 돌기 (싱지르)' 시험 (10/22 — src/iberian_spin.js · secret.js PlayerSecretWatch spinTick · docs/strike/iberian_spin_2026-10-22.md)
//  node --test tools/sim/iberian_spin.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, AI } from './harness_m.mjs';
import { SECRET, SKILL } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { spinProgress, spinRate } from '../../src/iberian_spin.js';
import * as D from '../../src/skill_tree_data.js';

const setup = (P) => {
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
};

test('도는 진행: 0 → 1 · 빠르기 끝 0 · 가운데 1 · 한 바퀴 시간 = 시간 사다리 0.6 s (share 0 판) · 오르내림 0.2 s', () => {
  const { time: T, ramp: r } = SECRET.ibSpin;
  assert.equal(T, 0.6);
  assert.equal(r, 0.2);
  assert.equal(SECRET.ibSpin.armTime, 1.5);
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

test('열림: 사람 · AI (10/24 사장님 \'싱지르 ai에게도 열어\' — aiOpenSchools 에 이베리아) · 비기 판 기본 spin · 스킬트리 B7 열림', () => {
  assert.ok(SECRET.openSchools.includes('iberian'));
  assert.ok(SECRET.aiOpenSchools.includes('iberian'));
  assert.equal(SECRET.iberianSecret, 'spin');
  assert.equal(TRADITIONS.iberian.secret.name, 'ibSpin');
  assert.equal(D.isClosed('iberian', D.nodeOf('iberian', 'B7')), false);
  assert.equal(D.kitFromNodes('iberian', D.allNodeIds('iberian')).secret, true);
  const G = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 5 } });
  assert.equal(G.ai.secret?.name, 'ibSpin'); // AI 이베리아 숙련도 5(AI_PROFICIENCY.secretAt) = 싱지르 · 무장 셈
  assert.ok(G.ai.spinArm);
  G.world.free();
  const G2 = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 4 } });
  assert.equal(G2.ai.secret, null); // 숙련도 4 는 비기 없음
  assert.equal(G2.ai.spinArm, null);
  G2.world.free();
});

test('무장: 칼끝 거리 밖 1.5 s → 끝 없는 창(금색 !) · 휘두르면 풀림 · 무장 동안 상처 나면 풀림(hurtDisarm) · 창을 쓰면 한 번', () => {
  const G = newRound({ seed: 2, weapon: 'zweihander', weapon2: 'longsword', gap: 3.4 });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  assert.equal(W.S?.name, 'ibSpin');
  let armT = null;
  let busy = false;
  G.before = () => W.update(DT, busy);
  while (G.t < 3 && armT == null) {
    G.step();
    if (W.open?.ctx?.ev === 'spin') armT = G.t;
  }
  assert.ok(armT != null, '무장');
  assert.ok(P.foeDistance() > P.swordArt.measure.reach);
  assert.equal(W.open.t, Infinity);
  // 휘두름(비기 실행 중 busy 와 같은 칸) → 풀림 · 창 닫힘
  busy = true;
  G.step();
  assert.equal(W.spinArm.armed, false);
  assert.equal(W.open, null);
  busy = false;
  for (let i = 0; i < Math.round(1.6 / DT); i++) G.step();
  assert.equal(W.open?.ctx?.ev, 'spin');
  // 상처 → 풀림
  P.wounds.push({ part: 'farmO', severity: 0.1 });
  G.step();
  assert.equal(W.spinArm.armed, false);
  // 끄면(0) 발도 대기처럼 상처로는 안 풀림
  SECRET.ibSpin.hurtDisarm = 0;
  try {
    for (let i = 0; i < Math.round(1.6 / DT); i++) G.step();
    assert.equal(W.spinArm.armed, true);
    P.wounds.push({ part: 'farmO', severity: 0.1 });
    G.step();
    assert.equal(W.spinArm.armed, true);
  } finally {
    SECRET.ibSpin.hurtDisarm = 1;
  }
  const o = W.fire();
  assert.equal(o.ctx.ev, 'spin');
  assert.equal(W.spinArm.armed, false); // 한 번 무장에 한 번
  G.world.free();
});

test('한 바퀴: 대본이 몸을 2π 돌리고 · 한 걸음쯤 나아가고 · 서 있고 · 끝에 가로로 쳐 서 있는 과녁을 벤다(물리 판정)', () => {
  // 과녁 2.2 m (10/24 share 0.7 — 전 2.3 m: 츠바이핸더 칼 든 쪽 2.3 m 는 닿는 끝이라 몫 0.6 은 팔 · 가슴을 베고 0.7 은 비켰다 · 2.1 · 2.2 m 는 둘 다 벰 — docs/strike/iberian_spin_2026-10-22.md §16-1)
  const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 2.2, walls: false });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  const W = new PlayerSecretWatch(P, E, { locked: false });
  let started = null, turned = 0, last = null, x0 = null, tipMax = 0, ended = null, extra = 0;
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    if (started == null && G.t > 2.6 && P.skill.secret({ S: W.S, ctx: { ev: 'spin' } })) {
      started = G.t;
      extra = P.ibSpin.pre + (SECRET.ibSpin.settle ? SECRET.ibSpin.ramp : 0) + P.ibSpin.T; // 10/23: 먼저 감기(칼이 가슴보다 높으면 ramp) · 마무리 받기(ramp) · 10/24 한 바퀴 = 칼마다(share — spinPlan)
      last = P.heading;
      const p = P.bodies.pelvis.translation();
      x0 = { x: p.x, z: p.z };
    }
  };
  while (G.t < 5) {
    G.step();
    if (started != null && P.ibSpin) {
      turned += P.heading - last;
      last = P.heading;
      tipMax = Math.max(tipMax, P.tipVel.length());
    } else if (started != null && ended == null) ended = G.t;
  }
  assert.ok(started != null, '비기를 냄');
  assert.ok(Math.abs(turned - 2 * Math.PI) < 0.05, `돈 각 ${turned}`);
  assert.ok(Math.abs(ended - started - extra) < 0.03, `도는 시간 ${ended - started} (한 바퀴 · 먼저 감기 · 받기 ${extra})`);
  const p = P.bodies.pelvis.translation();
  const travel = Math.hypot(p.x - x0.x, p.z - x0.z);
  assert.ok(travel > 0.3 && travel < 0.55, `나아간 거리 ${travel}`); // 10/24 upright: 나아감 상한 advance 0.45 · 한 바퀴에 0.5 m 안팎
  assert.equal(P.state, 'stand');
  assert.ok(tipMax > 15 && tipMax < 40, `칼끝 ${tipMax}`);
  const cuts = G.wounds.filter((w) => w.att === P && w.vic === E && w.type === 'cut' && w.severity > 0);
  assert.ok(cuts.length > 0, '가로로 벰');
  G.world.free();
});

test('빠르기 몫 (10/24 share): 한 바퀴 = ramp + 2π · 칼끝 거리 ÷ (share × 고노센 칼끝) · 칼마다 · share 0 = 0.6 s 판', async () => {
  const { spinPlan } = await import('../../src/iberian_spin.js');
  const { iaiTipSpeed } = await import('../../src/secret_instant.js');
  assert.equal(SECRET.ibSpin.share, 0.7); // 사장님 10/24 10:5x '싱지르 고노센의 70%로' (전 0.6)
  const share = SECRET.ibSpin.share;
  for (const w of ['zweihander', 'flamberge', 'tizona']) {
    const G = newRound({ seed: 1, weapon: w, weapon2: 'longsword' });
    const P = G.player;
    const p = spinPlan(P);
    const v0 = iaiTipSpeed(P);
    assert.ok(Math.abs(p.v - share * v0) < 1e-9, w);
    assert.ok(Math.abs(p.w - p.v / P.swordArt.measure.reach) < 1e-9, w);
    assert.ok(Math.abs(p.T - (0.2 + (2 * Math.PI) / p.w)) < 1e-9, w);
    assert.ok(p.T > 0.6 && p.T < 0.7, `${w} ${p.T}`); // 0.6 s 보다 느림 (0.7 몫 — 0.62 ~ 0.66 s)
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

test('칼끝 자름 · 몸 곧게 (10/24): 두 쪽 모두 칼끝 ≤ 고노센의 share + 4 %p · 몸 기울기 ≤ 20° · 골반 옮김 ≤ 0.55 m · 내려앉음 ≤ 0.12 m · 서 있음', async () => {
  const { iaiTipSpeed } = await import('../../src/secret_instant.js');
  for (const dir of [1, -1]) {
    const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 2.0, walls: false });
    const P = G.player, E = G.enemy;
    setup(P);
    G.ai.update = () => E.move.set(0, 0);
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    E.die = () => {};
    const W = new PlayerSecretWatch(P, E, { locked: false });
    const v0 = iaiTipSpeed(P);
    let t0 = null, p0 = null, tip = 0, tilt = 0, drop = 0, y0 = 0, end = null;
    G.before = () => {
      W.update(DT, !!P.skill.sec);
      P.move.set(0, 0);
      if (t0 == null && G.t > 2.6 && P.skill.secret({ S: W.S, ctx: { ev: 'spin', turnDir: dir } })) {
        t0 = G.t;
        const p = P.bodies.pelvis.translation();
        p0 = { x: p.x, z: p.z };
        y0 = p.y;
      }
    };
    while (G.t < 6) {
      G.step();
      if (t0 == null || end != null) continue;
      if (!P.skill.sec) end = G.t;
      tip = Math.max(tip, P.tipVel.length());
      const pp = P.bodies.pelvis.translation(), hd = P.bodies.head.translation();
      tilt = Math.max(tilt, (Math.atan2(Math.hypot(hd.x - pp.x, hd.z - pp.z), hd.y - pp.y) * 180) / Math.PI);
      drop = Math.max(drop, y0 - pp.y);
    }
    const p = P.bodies.pelvis.translation();
    const travel = Math.hypot(p.x - p0.x, p.z - p0.z);
    assert.ok(tip / v0 < SECRET.ibSpin.share + 0.04, `칼끝 ${tip} / ${v0} (${dir})`); // 전: 반대 쪽 2.0 m 에서 104 % · 자름 = share
    assert.ok(tilt < 20, `기울기 ${tilt} (${dir})`);
    assert.ok(travel < 0.55, `옮김 ${travel} (${dir})`);
    assert.ok(drop < 0.12, `내려앉음 ${drop} (${dir})`);
    assert.equal(P.state, 'stand');
    G.world.free();
  }
});

test('AI 싱지르 (10/24): 롤랑(이베리아 숙련도 6)이 칼끝 거리 밖 무장 → 다가오는 상대에게 한 바퀴 · 끝나면 다시 간 보기', async () => {
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const H = CHARACTERS_BY_ID.roland;
  const G = newRound({ seed: 3, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, gap: 4 });
  const P = G.player, E = G.enemy;
  assert.equal(G.ai.secret?.name, 'ibSpin');
  let fired = null, sawSpin = false, back = false;
  G.before = () => {
    P.move.set(0, G.t > 3 ? 0.7 : 0); // 사람 자리: 서 있다가 3 s 부터 곧장 다가간다
    if (G.ai.secretRun?.stage === 'spin' && fired == null) fired = G.t;
    if (E.ibSpin) sawSpin = true;
    if (fired != null && !G.ai.secretRun && G.ai.mode !== 'secret') back = true;
  };
  while (G.t < 9 && !back) G.step();
  assert.ok(fired != null, 'AI 가 싱지르를 냄');
  assert.ok(sawSpin, '대본이 돎');
  assert.ok(back, '끝나고 다시 간 보기');
  assert.equal(G.ai.stats.secrets.ibSpin.fired, 1);
  G.world.free();
});
