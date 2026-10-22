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

test('도는 진행: 0 → 1 · 빠르기 끝 0 · 가운데 1 · 한 바퀴 시간 = 시간 사다리 0.6 s', () => {
  const { time: T, ramp: r } = SECRET.ibSpin;
  assert.equal(T, 0.6);
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

test('열림: 사람만 (openSchools 에 이베리아 · aiOpenSchools 에는 없음) · 비기 판 기본 spin · 스킬트리 B7 열림', () => {
  assert.ok(SECRET.openSchools.includes('iberian'));
  assert.ok(!SECRET.aiOpenSchools.includes('iberian'));
  assert.equal(SECRET.iberianSecret, 'spin');
  assert.equal(TRADITIONS.iberian.secret.name, 'ibSpin');
  assert.equal(D.isClosed('iberian', D.nodeOf('iberian', 'B7')), false);
  assert.equal(D.kitFromNodes('iberian', D.allNodeIds('iberian')).secret, true);
  const G = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 5 } });
  assert.equal(G.ai.secret, null); // AI 이베리아 숙련도 5 라도 비기 없음 (닫힌 채)
  G.world.free();
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
  const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 2.3, walls: false });
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
      extra = P.ibSpin.pre + (SECRET.ibSpin.settle ? SECRET.ibSpin.ramp : 0); // 10/23: 먼저 감기(칼이 가슴보다 높으면 ramp) · 마무리 받기(ramp)
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
  assert.ok(Math.abs(ended - started - SECRET.ibSpin.time - extra) < 0.03, `도는 시간 ${ended - started} (먼저 감기 · 받기 ${extra})`);
  const p = P.bodies.pelvis.translation();
  const travel = Math.hypot(p.x - x0.x, p.z - x0.z);
  assert.ok(travel > 0.3 && travel < 1.2, `나아간 거리 ${travel}`);
  assert.equal(P.state, 'stand');
  assert.ok(tipMax > 15 && tipMax < 40, `칼끝 ${tipMax}`);
  const cuts = G.wounds.filter((w) => w.att === P && w.vic === E && w.type === 'cut' && w.severity > 0);
  assert.ok(cuts.length > 0, '가로로 벰');
  G.world.free();
});
