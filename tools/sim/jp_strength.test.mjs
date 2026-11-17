// 일본 강화 길 시험 (11/05 사장님 '걸음 속도가 특색이니 유지하면서 다른 방법으로 강화할 방법을 찾음 좋겠는데' · 기록 docs/strike/jp_strength_2026-11-05.md · 확인표 3420 ~ 3429)
//  ① 새 스위치는 모두 기본 끔 · 일본 걷기 빠르기(JAPANESE_GAIT 사람 · AI 0.70)는 그대로
//  ② 재기 꽂개(jp_strength.mjs strengthProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ③ 스위치마다: 끔 = 지금 판 그대로 · 켬 = 뜻한 대로 (맞아도 고노센 준비 이어 셈 · 고노센 베고 지나감 · 제비 베기 미끄러져 들어감 · 일본 칼끝 거리 숨김)
//  node --test tools/sim/jp_strength.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { strengthProbe } from './jp_strength.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';
import { JAPANESE_GAIT } from '../../src/schools.js';
import { gnsHumanUnsettled } from '../../src/secret.js';
import { foeReachBase } from '../../src/ai.js';
/** 11/14 칼집 각도 · 납도 전 판 (docs/strike/iai_obi_2026-11-14.md §13 — 납도 없음 · 쉬는 칼집 입 배꼽 앞 · 축 −121 / −15 — 鞘戻し 점(쉬는 칼집 입 쥠)이 빈손 다시 쥐는 길에 들어감) — 옛 장면만 */
const OBI2_OLD = { iaiSheathe: 0, iaiObiSayaMouth: [0.21, 0.085, 0.02], iaiObiSayaAxis: { yaw: -121, el: -15 }, iaiObiPull: { yaw: -160, el: -25 }, iaiObiFollow: { m: 0.06, deg: 20 } };
const withNoto0 = (fn) => { const S = CONFIG.SECRET; const was = {}; for (const k of Object.keys(OBI2_OLD)) (was[k] = S[k]), (S[k] = OBI2_OLD[k]); try { return fn(); } finally { Object.assign(S, was); } };

const { SECRET, UNIQUE_ASSIST: UA, AI_MAAI } = CONFIG;
const allOff = () => { SECRET.gnsHurtKeep = 0; SECRET.gnsThrough = 0; UA.tsuStep = 0; AI_MAAI.hide = 0; };

// 3 단계(11/14) 그때 판으로 묶음 (기준은 안 고침): 롱소드 AI 의 독일 플랜 · 모든 AI 손잡이 찍기를 뺀 판 (이 장면을 잰 때의 상대)
const deOff = () => { const P = CONFIG.AI_PLAN, k = [P.schools, P.errSchools, P.pommel]; for (const x of ['schools', 'errSchools']) P[x] = P[x].filter((t) => t !== 'german'); P.pommel = 0; return k; };
const deOn = (k) => { const P = CONFIG.AI_PLAN; [P.schools, P.errSchools, P.pommel] = k; };
const withDeOff = (fn) => { const k = deOff(); try { return fn(); } finally { deOn(k); } };

test('기본값: 새 스위치 모두 끔 · 일본 걷기 빠르기 그대로', () => {
  assert.equal(UA.tsuStep, 0);
  assert.equal(AI_MAAI.hide, 0);
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


test('jpMaaiHide: AI 가 일본 칼끝 거리를 hide m 짧게 봄 · 다른 유파 · 끔은 그대로', () => {
  const { G, P, A } = humanRound('japanese', 'uchigatana');
  try {
    const foeM = P.swordArt.measure;
    const base = foeReachBase(foeM, P);
    assert.equal(base, foeM.reach + 0.05, '끔 = 무기 간격 + 0.05');
    AI_MAAI.hide = 0.3;
    assert.ok(Math.abs(foeReachBase(foeM, P) - (base - 0.3)) < 1e-12, '일본 상대 — 0.3 짧게');
    assert.equal(foeReachBase(A.swordArt.measure, A), A.swordArt.measure.reach + 0.05, '독일 롱소드 상대는 그대로');
  } finally {
    allOff();
    G.world.free();
  }
});

test('켜도 일본이 아닌 칸은 그대로: 네 스위치를 켠 독일 롱소드 대 롱소드 AI 판이 끈 판과 바이트 같음', () => {
  try {
    const a = fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 2, dur: 8 });
    SECRET.gnsHurtKeep = 1;
    SECRET.gnsThrough = 1;
    UA.tsuStep = 0.3;
    AI_MAAI.hide = 0.3;
    const b = fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 2, dur: 8 });
    assert.equal(JSON.stringify(b), JSON.stringify(a), '독일 롱소드 칸');
  } finally {
    allOff();
  }
});


 // 11/14 그때 판 (스택 · 바위 몸 전 · 3 단계 읽기 · 공정함 전)
