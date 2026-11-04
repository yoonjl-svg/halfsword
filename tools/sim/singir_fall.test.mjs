// 싱지르 넘어짐 (11/05 — SECRET.ibSpin.near · src/iberian_spin.js spinNear · 기록 docs/strike/singir_fall_2026-11-05.md)
//  node --test tools/sim/singir_fall.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT } from './harness_m.mjs';
import { SECRET, SKILL, ARENA } from '../../src/config.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { fightOne } from './school_balance.mjs';
import { runOne } from './singir_fall.mjs';
import { footSnap } from './iberian_spin_feet.mjs';

const withNear = async (v, fn) => {
  const old = SECRET.ibSpin.near;
  SECRET.ibSpin.near = v;
  try {
    return await fn();
  } finally {
    SECRET.ibSpin.near = old;
  }
};

/** 멈춘 과녁(칼 충돌 끔 · 안 죽음)을 gap 에 두고 발이 풀린 뒤 0.6 s 에 싱지르 — 대본 시작 · 끝 기록 */
function standSpin(weapon, gap) {
  const G = newRound({ seed: 7, weapon, weapon2: 'longsword', gap, walls: false });
  const P = G.player;
  const E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  const W = new PlayerSecretWatch(P, E, { locked: false });
  let r = null;
  let last = 0;
  let turned = 0;
  let tilt = 0;
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    if (!r && G.t > ARENA.startHold + 0.6 && P.gait.legs.F.stance && P.gait.legs.B.stance) { // 두 발로 섰을 때 (한 발이 떠 있으면 디딘 발이 축 — 전과 같음)
      const d0 = P.foeDistance();
      if (P.skill.secret({ S: W.S, ctx: { ev: 'spin' } })) {
        const p = P.bodies.pelvis.translation();
        r = { d0, near: P.ibSpin.near, pk: P.ibSpin.pk, p0: { x: p.x, z: p.z }, end: null };
        last = P.heading;
      }
    }
  };
  while (G.t < 5) {
    G.step();
    if (r && P.ibSpin) {
      turned += P.heading - last;
      last = P.heading;
      tilt = Math.max(tilt, P.tiltDeg());
      if (P.ibSpin.tp >= P.ibSpin.pre && !P.ibSpin.settle && footSnap(P).lat < 0) r.cross = (r.cross ?? 0) + 1; // 도는 동안 두 발 엇갈림
    } else if (r && !r.end) {
      const p = P.bodies.pelvis.translation();
      r.end = { travel: Math.hypot(p.x - r.p0.x, p.z - r.p0.z), state: P.state, d: P.foeDistance(), t: G.t, feet: footSnap(P) };
    } else if (r && !r.after && G.t >= r.end.t + 0.6) r.after = footSnap(P); // 끝난 뒤 0.6 s
  }
  const cuts = G.wounds.filter((w) => w.att === P && w.vic === E && w.type === 'cut' && w.severity > 0).length;
  const out = { ...r, turned, tilt, cuts, state: P.state, contact: P.swordArt.measure.contact, reach: P.swordArt.measure.reach };
  G.world.free();
  return out;
}

test('기본값: 가까운 상대 뒷발 축 제자리 near 1 (11/05 · 사장님 확인 전)', () => {
  assert.equal(SECRET.ibSpin.near, 1);
  assert.equal(SECRET.ibSpin.share, 0.7); // 빠르기 몫 · 굳음은 그대로 (사장님 값)
});

test('가까우면(맞닿기 + 나아감 안 · 칼끝 거리 안) 뒷발 축으로 제자리에서 한 바퀴 · 서 있음 · 벰 — 끄면 앞발 축 · 나아감', async () => {
  const on = standSpin('zweihander', 1.75);
  assert.ok(on.d0 < on.contact + SECRET.ibSpin.advance, `가슴 거리 ${on.d0}`);
  assert.equal(on.near, true);
  assert.ok(Math.abs(on.turned - 2 * Math.PI) < 0.05, `돈 각 ${on.turned}`);
  assert.ok(on.end.travel < 0.2, `골반 옮김 ${on.end.travel.toFixed(2)} (제자리)`);
  assert.equal(on.state, 'stand');
  assert.ok(on.tilt < 25, `기울기 ${on.tilt.toFixed(0)}`);
  assert.ok(on.cuts > 0, '벰');
  // 발: 끝(받아 멈춤 끝)에 펜싱 자세 너비 · 골반은 두 발 사이 · 무게 가운데 발바닥 안 · 도는 동안 안 엇갈림 (iberian_spin.test.mjs 발디딤과 같은 눈금)
  const F = on.end.feet;
  assert.ok(F.lon >= 0.45 && F.lat >= 0.2, `끝 두 발 앞뒤 ${F.lon.toFixed(2)} · 옆 ${F.lat.toFixed(2)}`);
  assert.ok(Math.abs(F.pelFwd) <= 0.1, `골반 − 두 발 가운데 ${F.pelFwd.toFixed(2)}`);
  assert.ok(F.margin > -0.02, `무게 가운데 여유 ${F.margin.toFixed(3)}`);
  assert.equal(on.cross ?? 0, 0, '도는 동안 엇갈림');
  assert.ok(on.after.lon > 0.2, `끝난 뒤 0.6 s 앞발이 앞 ${on.after.lon.toFixed(2)}`);
  const off = await withNear(0, () => standSpin('zweihander', 1.75));
  assert.equal(off.near, false);
  assert.notEqual(off.pk, on.pk, '축발이 다름 (끄면 앞발)');
  assert.ok(off.end.travel > 0.3, `끔 골반 옮김 ${off.end.travel.toFixed(2)}`);
});

test('멀면(맞닿기 + 나아감 밖 · 또는 칼끝 거리 밖) 전 판 그대로 — 앞발 축 · 나아감 (켬 · 끔 같은 몸)', async () => {
  // 츠바이핸더 2.4 m (맞닿기 + 나아감 밖) · 뒤랑달 2.0 m (맞닿기 + 나아감 안이지만 칼끝 거리 1.91 m 밖 — 제자리면 안 닿음)
  for (const [w, gap] of [['zweihander', 2.4], ['durandal', 2.0]]) {
    const on = standSpin(w, gap);
    assert.ok(on.d0 >= Math.min(on.reach, on.contact + SECRET.ibSpin.advance), `${w} 가슴 거리 ${on.d0}`);
    assert.equal(on.near, false, w);
    const off = await withNear(0, () => standSpin(w, gap));
    assert.equal(off.pk, on.pk, w);
    assert.equal(off.end.travel.toFixed(6), on.end.travel.toFixed(6), `${w} 골반 옮김 바이트 같음`);
    assert.equal(off.cuts, on.cuts, w);
    assert.ok(on.cuts > 0, `${w} 벰`);
  }
});

test('넘어지던 판 (티소나 대 롱소드 AI 씨앗 3 — 사람 손가락 봇): 끄면 돌기 0.13 s 에 맞아 넘어짐 · 켜면 1 s 안 안 넘어짐', async () => {
  const off = await withNear(0, () => runOne({ weapon: 'tizona', opp: 'longsword', seed: 3, dur: 5 }));
  const s0 = off.probe.spins[0];
  assert.ok(s0?.fall && s0.fall.dt <= 1 && s0.fall.why === 'gauge' && s0.fall.stage === 'spin', `끔 ${JSON.stringify(s0?.fall)}`);
  const on = runOne({ weapon: 'tizona', opp: 'longsword', seed: 3, dur: 5 });
  const s1 = on.probe.spins[0];
  assert.equal(s1.near, true);
  assert.ok(!(s1.fall && s1.fall.dt <= 1), `켬 ${JSON.stringify(s1.fall)}`);
  assert.ok(s1.dealt.some((d) => d.sev > 0), '켬 벰');
});

test('재기 꽂개는 읽기만: singir_fall runOne 판 = school_balance fightOne 판 (이베리아 · 롱소드 AI 씨앗 3 · 5 s)', () => {
  const a = runOne({ weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  const b = fightOne({ school: 'iberian', weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  assert.deepEqual(a.fires, b.fires.filter((f) => f.name === 'ibSpin'));
  assert.deepEqual(a.falls, b.falls);
  assert.equal(a.dealt, b.dealt);
  assert.equal(a.recv, b.recv);
});
