// 찌르기 막기 재기 시험 (11/05 — 사장님 11/04 '찌르기가 막기를 뚫는 까닭 이어서 재.' · 기록 docs/strike/rapier_defence_2026-11-05.md · 확인표 3370 ~ 3379)
//  ① 새 스위치는 모두 기본 끔 (THRUST.itDrop · itStep · itClashEnd · itAccel · AI_THRUST_DEF.lungeReach · lungeParry · 레이피어 판정 폭 그대로)
//  ② 재기 꽂개(rapier_defence.mjs makeProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ③ THRUST.itAccel 0 = 이탈리아 탭 찌르기 런지 부탁에서 몸 가속(accel)만 빠짐 (걸음 길이 · 몸 따라감 그대로)
//  ④ AI_THRUST_DEF.lungeReach = 런지 찌르는 상대(이탈리아)에게만 AI 거리 어림 + 그 값 · 다른 상대는 그대로
//  node --test tools/sim/rapier_defence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { makeProbe, respBefore } from './rapier_defence.mjs';
import { THRUST_STYLE } from '../../src/weapons.js';
import { itPartOn } from '../../src/skill.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';

const { THRUST, AI_THRUST_DEF } = CONFIG;

test('기본값: 새 스위치 모두 끔 · 레이피어 찌르기 장점 그대로', () => {
  assert.equal(THRUST.itDrop, '');
  assert.equal(THRUST.itStep, null);
  assert.equal(THRUST.itClashEnd, 0);
  assert.equal(THRUST.itAccel, 0); // 11/05 사장님 결정 — 이탈리아 보통 찌르기 몸 박차기 뺌
  assert.equal(AI_THRUST_DEF.lungeReach, 0);
  assert.equal(AI_THRUST_DEF.lungeParry, 0);
  assert.deepEqual({ ...THRUST_STYLE.rapier }, { recover: 0.6, reach: 0.1, gap: 0.3, window: 0.12 });
  for (const k of ['aim', 'chamber', 'lunge', 'hold', 'push', 'accel']) assert.equal(itPartOn(k), true, k);
});

test('itDrop: 고른 몫만 꺼짐 (+ 로 여럿)', () => {
  const was = THRUST.itDrop;
  try {
    THRUST.itDrop = 'lunge+accel';
    assert.deepEqual(['aim', 'chamber', 'lunge', 'hold', 'push', 'accel'].map(itPartOn), [true, true, false, true, true, false]);
  } finally {
    THRUST.itDrop = was;
  }
});

test('꽂개는 읽기만: 이탈리아 대 롱소드 씨앗 1 · 2 가 꽂개 없을 때와 같음', () => {
  for (const seed of [1, 2]) {
    const a = fightOne({ school: 'italian', weapon: 'rapier', opp: 'longsword', seed });
    const b = fightOne({ school: 'italian', weapon: 'rapier', opp: 'longsword', seed, probe: makeProbe() });
    const strip = (r) => JSON.stringify({ ...r, probe: undefined });
    assert.equal(strip(b), strip(a), `seed ${seed}`);
    assert.equal(b.probe.length, b.fires.length);
    for (const p of b.probe) assert.ok(['hit', 'hitAfterClash', 'touch', 'blocked', 'whiff'].includes(p.out) && typeof respBefore(p) === 'string');
  }
});

/** 이탈리아 사람 몸으로 판을 열고 발 묶임이 풀린 뒤 탭 찌르기 한 번 — 런지 걸음 부탁(requestStep 인자)을 돌려줌 */
function italianTapStep() {
  const kit = kitFromNodes('italian', allNodeIds('italian'));
  const G = newRound({ seed: 3, weapon: 'rapier', weapon2: 'longsword', walls: true, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  try {
    const P = G.player;
    for (let i = 0; i < 2400 && (P.feetHeld || P.state !== 'stand'); i++) G.step();
    const reqs = [];
    const rs = P.gait.requestStep.bind(P.gait);
    P.gait.requestStep = (o) => (reqs.push({ ...o }), rs(o));
    assert.ok(P.skill.thrust(), '탭 찌르기 시작');
    assert.ok(P.skill.tap?.it, '이탈리아 찌르기');
    return reqs;
  } finally {
    G.world.free();
  }
}

test('itAccel 0: 이탈리아 탭 런지 부탁에서 몸 가속만 빠짐', () => {
  const was = THRUST.itAccel; // 11/05 기본 0 — 켠 판(1)과 견줌
  let on, off;
  try {
    THRUST.itAccel = 1;
    on = italianTapStep();
    THRUST.itAccel = 0;
    off = italianTapStep();
  } finally {
    THRUST.itAccel = was;
  }
  assert.equal(on.length, 1);
  assert.equal(off.length, 1);
  assert.equal(on[0].accel, true);
  assert.equal(off[0].accel, undefined);
  assert.equal(off[0].fwd, on[0].fwd);
  assert.equal(off[0].push, on[0].push);
  assert.equal(off[0].kind, 'lunge');
});

test('lungeReach: 이탈리아 상대에게만 AI 거리 어림 + 값', () => {
  const reachOf = (weapon, school) => {
    const kit = school ? kitFromNodes(school, allNodeIds(school)) : null;
    const G = newRound({ seed: 1, weapon, weapon2: 'longsword', walls: true, ...(kit ? { kit } : {}), persona: { proficiency: 3 } });
    try {
      return G.ai.foeReach;
    } finally {
      G.world.free();
    }
  };
  const was = AI_THRUST_DEF.lungeReach;
  const base = { it: reachOf('rapier', 'italian'), de: reachOf('longsword', 'german') };
  let pad;
  try {
    AI_THRUST_DEF.lungeReach = 0.3;
    pad = { it: reachOf('rapier', 'italian'), de: reachOf('longsword', 'german') };
  } finally {
    AI_THRUST_DEF.lungeReach = was;
  }
  assert.ok(Math.abs(pad.it - base.it - 0.3) < 1e-9, `${pad.it} ${base.it}`);
  assert.equal(pad.de, base.de);
});
