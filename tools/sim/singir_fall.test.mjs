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
// 11/11 이베리아 자리 바꿈 (사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — SECRET.iberianSecret 'altib' 기본): 이 파일은 싱지르 비기 넘어짐 장면(11/05 — 가까우면 뒷발 축 near · 무장 창 원 · 비기 몫)이라
//  그 판('spin')으로 묶는다(이 파일 안에서만). 새 판(비기 알티바슈 포르트 · 특수 공격 싱지르 한 걸음)은 tools/sim/ib_swap.test.mjs

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

test('재기 꽂개는 읽기만: singir_fall runOne 판 = school_balance fightOne 판 (이베리아 · 롱소드 AI 씨앗 3 · 5 s)', () => {
  const a = runOne({ weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  const b = fightOne({ school: 'iberian', weapon: 'zweihander', opp: 'longsword', seed: 3, dur: 5 });
  assert.deepEqual(a.fires, b.fires.filter((f) => f.name === 'ibSpin'));
  assert.deepEqual(a.falls, b.falls);
  assert.equal(a.dealt, b.dealt);
  assert.equal(a.recv, b.recv);
});
