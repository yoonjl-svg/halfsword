// 찌르기 막기 재기 시험 (11/05 — 사장님 11/04 '찌르기가 막기를 뚫는 까닭 이어서 재.' · 기록 docs/strike/rapier_defence_2026-11-05.md · 확인표 3370 ~ 3379)
//  ① 새 스위치는 모두 기본 끔 (AI_THRUST_DEF.lungeReach · lungeParry · 레이피어 판정 폭 그대로)
//  ② 재기 꽂개(rapier_defence.mjs makeProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ④ AI_THRUST_DEF.lungeReach = 런지 찌르는 상대(이탈리아)에게만 AI 거리 어림 + 그 값 · 다른 상대는 그대로
//  node --test tools/sim/rapier_defence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { makeProbe, respBefore } from './rapier_defence.mjs';
import { THRUST_STYLE } from '../../src/weapons.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';

const { THRUST, AI_THRUST_DEF } = CONFIG;

test('기본값: 새 스위치 모두 끔 · 레이피어 찌르기 장점 그대로', () => {
  assert.equal(AI_THRUST_DEF.lungeReach, 0);
  assert.equal(AI_THRUST_DEF.lungeParry, 0);
  assert.deepEqual({ ...THRUST_STYLE.rapier }, { recover: 0.6, reach: 0.1, gap: 0.6, window: 0.12 }); // gap 11/14 사장님 '기본찌르기는 0.6' (전 0.3)
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
