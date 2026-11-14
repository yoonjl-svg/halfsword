// 싱지르 넘어짐 (11/05 — SECRET.ibSpin.near · src/iberian_spin.js spinNear · 기록 docs/strike/singir_fall_2026-11-05.md)
//  node --test tools/sim/singir_fall.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { SECRET, SKILL, ARENA } from '../../src/config.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { fightOne } from './school_balance.mjs';
import { runOne } from './singir_fall.mjs';
import { footSnap } from './iberian_spin_feet.mjs';
import { withArmOld } from './arm_real_pin.mjs'; // 11/12 팔 사람 꼴 — 옛 장면은 잰 때 팔로 (docs/strike/arm_real_2026-11-12.md §10)
// 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — SECRET.iberianSecret 'altib' 기본): 이 파일은 싱지르 비기 넘어짐 장면(11/05 — 가까우면 뒷발 축 near · 무장 창 원 · 비기 몫)이라
//  그 판('spin')으로 묶는다(이 파일 안에서만). 새 판(비기 알티바슈 포르트 · 특수 공격 싱지르 한 걸음)은 tools/sim/ib_swap.test.mjs
(await import('../../src/config.js')).SECRET.iberianSecret = 'spin';

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
      if (r.dq == null && P.ibSpin.q >= 0.25) r.dq = P.foeDistance(); // 무게를 축발로 다 옮긴 때 (돌기 진행 0.25) 상대 가슴 거리
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

// 3 단계(11/14) 그때 판으로 묶음 (기준은 안 고침): 롱소드 AI 의 독일 플랜 · 모든 AI 손잡이 찍기를 뺀 판 (이 장면을 잰 때의 상대)
const deOff = () => { const P = CONFIG.AI_PLAN, k = [P.schools, P.errSchools, P.pommel]; for (const x of ['schools', 'errSchools']) P[x] = P[x].filter((t) => t !== 'german'); P.pommel = 0; return k; };
const deOn = (k) => { const P = CONFIG.AI_PLAN; [P.schools, P.errSchools, P.pommel] = k; };
const withDeOff = (fn) => { const k = deOff(); try { return fn(); } finally { deOn(k); } };

test('기본값: 가까운 상대 뒷발 축 near 1 (11/05 · 사장님 확인 전)', () => {
  assert.equal(SECRET.ibSpin.near, 1);
  assert.equal(SECRET.ibSpin.share, 0.5); // 빠르기 몫 (사장님 11/05 '싱지르 0.5로 넣고')
});

test('가까우면(맞닿기 + 나아감 안) 뒷발 축: 처음엔 상대에게서 물러나고 끝에 칼과 함께 나아감 · 한 바퀴 · 서 있음 · 벰 · 발 자리 — 끄면 앞발 축(처음에 다가감)', async () => {
  const on = standSpin('zweihander', 1.75);
  assert.ok(on.d0 < on.contact + SECRET.ibSpin.advance, `가슴 거리 ${on.d0}`);
  assert.equal(on.near, true);
  assert.ok(Math.abs(on.turned - 2 * Math.PI) < 0.05, `돈 각 ${on.turned}`);
  assert.ok(on.dq > on.d0, `무게 옮긴 때 거리 ${on.dq.toFixed(2)} (낼 때 ${on.d0.toFixed(2)} — 물러남)`);
  assert.ok(on.end.travel > 0.3 && on.end.travel < 0.55, `골반 옮김 ${on.end.travel.toFixed(2)} (나아감 그대로)`);
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
  assert.ok(off.dq < off.d0 - 0.1, `끔 무게 옮긴 때 거리 ${off.dq.toFixed(2)} (낼 때 ${off.d0.toFixed(2)} — 다가감)`);
  assert.ok(on.dq - off.dq > 0.3, `무게 옮긴 때 거리 켬 ${on.dq.toFixed(2)} · 끔 ${off.dq.toFixed(2)}`);
  assert.ok(Math.abs(off.end.travel - on.end.travel) < 0.1, `끝 골반 옮김 켬 ${on.end.travel.toFixed(2)} · 끔 ${off.end.travel.toFixed(2)}`);
  // 견줌 'place' (뒷발 축 · 제자리): 나아감 0
  const pl = await withNear('place', () => standSpin('zweihander', 1.75));
  assert.equal(pl.near, true);
  assert.ok(pl.end.travel < 0.2 && pl.state === 'stand', `제자리 골반 옮김 ${pl.end.travel.toFixed(2)}`);
});

test('멀면(맞닿기 + 나아감 밖) 전 판 그대로 — 앞발 축 · 나아감 (켬 · 끔 같은 몸)', async () => {
  const on = standSpin('zweihander', 2.2); // 11/05 몫 0.5 뒤 2.4 m(가슴 2.53)면 칼이 닿지 않음 → 2.2 m(가슴 2.33 — 여전히 맞닿기 + 나아감 밖)
  assert.ok(on.d0 >= on.contact + SECRET.ibSpin.advance, `가슴 거리 ${on.d0}`);
  assert.equal(on.near, false);
  const off = await withNear(0, () => standSpin('zweihander', 2.2));
  assert.equal(off.pk, on.pk);
  assert.equal(off.end.travel.toFixed(6), on.end.travel.toFixed(6), '골반 옮김 바이트 같음');
  assert.equal(off.cuts, on.cuts);
  assert.ok(on.cuts > 0, '벰');
});

test('넘어지던 판 (티소나 대 롱소드 AI 씨앗 3 — 사람 손가락 봇): 끄면 돌기 0.13 s 에 맞아 넘어짐 · 켜면 1 s 안 안 넘어짐', () => withArmOld(async () => {
  const deK = deOff();
  // 11/14 상대가 길 때의 대처(모든 AI — DIG_PROTO.reach): 롱소드 AI 가 상대 칼보다 짧아 파고들기 몫을 받아 이 판이 갈라짐 → 그 전 판(옛 문 reach 0)으로도 묶음 · 기준 그대로
  const reachOn = CONFIG.DIG_PROTO.reach;
  CONFIG.DIG_PROTO.reach = 0;
  try {
  // 11/12 두 팔 엇갈림 막기(SKILL.armClear) 전 팔로 — 켠 판은 씨앗 3 의 그 넘어짐 장면이 안 나옴 (끔 · 켬 같은 판 · 기록 arm_real §10)
  const fc = { ...SKILL.fingerCut };
  Object.assign(SKILL.fingerCut, { arm: 1, gain: 1 }); // 11/06 손가락 긋기 기본 켬 전 장면 (손가락 봇 긋기가 세지면 씨앗 3 판이 달라져 그 넘어짐 장면이 안 나옴 — 끔 · 켬 같은 판)
  try {
    const off = await withNear(0, () => runOne({ weapon: 'tizona', opp: 'longsword', seed: 3, dur: 5 }));
    const s0 = off.probe.spins[0];
    assert.ok(s0?.fall && s0.fall.dt <= 1 && s0.fall.why === 'gauge' && s0.fall.stage === 'spin', `끔 ${JSON.stringify(s0?.fall)}`);
    const on = runOne({ weapon: 'tizona', opp: 'longsword', seed: 3, dur: 5 });
    const s1 = on.probe.spins[0];
    assert.equal(s1.near, true);
    assert.ok(!(s1.fall && s1.fall.dt <= 1), `켬 ${JSON.stringify(s1.fall)}`);
    assert.ok(s1.dealt.some((d) => d.sev > 0), '켬 벰');
  } finally {
    Object.assign(SKILL.fingerCut, fc);
  }
  } finally { deOn(deK); CONFIG.DIG_PROTO.reach = reachOn; }
}, ['armClear']));

test('재기 꽂개는 읽기만: singir_fall runOne 판 = school_balance fightOne 판 (이베리아 · 롱소드 AI 씨앗 3 · 5 s)', () => {
  const a = runOne({ weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  const b = fightOne({ school: 'iberian', weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  assert.deepEqual(a.fires, b.fires.filter((f) => f.name === 'ibSpin'));
  assert.deepEqual(a.falls, b.falls);
  assert.equal(a.dealt, b.dealt);
  assert.equal(a.recv, b.recv);
});
