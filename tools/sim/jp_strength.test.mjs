// 일본 강화 길 시험 (11/05 사장님 '걸음 속도가 특색이니 유지하면서 다른 방법으로 강화할 방법을 찾음 좋겠는데' · 기록 docs/strike/jp_strength_2026-11-05.md · 확인표 3420 ~ 3429)
//  ① 일본 걷기 빠르기(JAPANESE_GAIT 사람 · AI 0.70)는 그대로 (강화 길 스위치 넷 — 맞아도 고노센 준비 이어 셈 · 베고 지나감 · 제비 미끄러져 들어감 · 칼끝 거리 숨김 — 은 끈 판 그대로 걷음, 11/17)
//  ② 재기 꽂개(jp_strength.mjs strengthProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ③ AI 가 어림하는 상대 칼 닿는 거리 바탕 = 무기 간격 + 0.05 (일본 · 독일 같게)
//  node --test tools/sim/jp_strength.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { strengthProbe } from './jp_strength.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';
import { JAPANESE_GAIT } from '../../src/schools.js';
import { gnsHumanUnsettled } from '../../src/secret.js';
import { foeReachBase } from '../../src/ai.js';
test('기본값: 일본 걷기 빠르기 그대로', () => {
  assert.equal(JAPANESE_GAIT.speedMul, 0.7);
});

test('꽂개는 읽기만: 일본 대 롱소드 AI 가 꽂개 없을 때와 같음', () => {
  const a = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 3, dur: 10 });
  const b = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 3, dur: 10, probe: strengthProbe() });
  const strip = (r) => JSON.stringify({ ...r, probe: undefined });
  assert.equal(strip(b), strip(a));
  assert.ok(b.probe.iai && b.probe.big && b.probe.dist);
});

/** 사람 몸 판 (발 묶임이 풀릴 때까지) — { G, P, A } */
function humanRound(school, weapon, opp = 'longsword') {
  const kit = kitFromNodes(school, allNodeIds(school));
  const G = newRound({ seed: 5, weapon, weapon2: opp, walls: true, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  for (let i = 0; i < 2400 && (P.feetHeld || P.state !== 'stand'); i++) G.step();
  return { G, P, A: G.enemy };
}


test('AI 가 어림하는 상대 칼 닿는 거리 바탕 = 무기 간격 + 0.05 (일본 · 독일 같게)', () => {
  const { G, P, A } = humanRound('japanese', 'uchigatana');
  try {
    const foeM = P.swordArt.measure;
    assert.equal(foeReachBase(foeM, P), foeM.reach + 0.05, '일본 상대');
    assert.equal(foeReachBase(A.swordArt.measure, A), A.swordArt.measure.reach + 0.05, '독일 롱소드 상대');
  } finally {
    G.world.free();
  }
});
