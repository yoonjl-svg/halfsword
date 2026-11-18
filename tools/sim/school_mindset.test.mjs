// 유파 마음가짐 (11/18 — src/ai_mindset.js · 값 표 schools.js SCHOOL_MINDSET · 끝 값 config MINDSET · 기록 docs/strike/school_mindset_2026-11-18.md)
//  ① 값 표가 점수 · 곧은 줄 셈과 같다 (한눈에 보이는 수 = 셈) ② 기질 범위 = 가운데 ± 폭 · 무유파는 옛 값 ③ 집요함 — 일본은 상대 상태에 안 움직이고 동방은 폭 ±2 안에서 정한 쪽으로
//  ④ 일격 — 입힐 피해로 판단하면 큰 베기 · 받을 피해로 판단하면 짧은 칼 ⑤ 횡보 1(이탈리아)은 옆으로 돌지 않음 ⑥ 짧은 판 하나 — 다섯 유파 모두 옮긴 점수가 1 ~ 5 안
//  node --test tools/sim/school_mindset.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, AI, DT } from './harness_m.mjs';
const { MINDSET, AI_PROFICIENCY } = await import('../../src/config.js');
const { SCHOOL_MINDSET, TRADITIONS } = await import('../../src/schools.js');
const M = await import('../../src/ai_mindset.js');

const SCH = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const AXES5 = ['initiative', 'distance', 'tenacity', 'decisive', 'lateral'];
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('값 표 = 점수 · 셈 (1 점 값 + (5 점 값 − 1 점 값) × (점수 − 1) ÷ 4 · 집요함 폭 (점수 − 1) × 0.5)', () => {
  assert.deepEqual(Object.keys(SCHOOL_MINDSET).sort(), [...SCH].sort());
  for (const s of SCH) {
    const row = SCHOOL_MINDSET[s];
    assert.deepEqual([...row.score], AXES5.map((a) => MINDSET.score[s][a]), `${s} 점수`);
    const at = { aggr: 'initiative', patienceTime: 'initiative', need: 'initiative', first: 'initiative', answer: 'initiative', margin: 'distance', gap: 'distance', creep: 'distance', give: 'distance', reward: 'decisive', latShare: 'lateral', circleRate: 'lateral' };
    for (const [k, ax] of Object.entries(at)) assert.ok(near(row[k], M.knobAt(k, MINDSET.score[s][ax]), 1e-9), `${s}.${k} = ${row[k]} · 셈 ${M.knobAt(k, MINDSET.score[s][ax])}`);
    assert.equal(row.band, (MINDSET.score[s].tenacity - 1) * MINDSET.band, `${s}.band`);
  }
  // 설계 §2 점수 (사장님 11/17 · 11/18) — 바꾸면 설계 문서 · 도표와 함께
  assert.deepEqual(SCH.map((s) => [...SCHOOL_MINDSET[s].score]), [[5, 1, 2, 3, 2], [2, 5, 4, 2, 1], [4, 4, 3, 5, 5], [1, 2, 1, 4, 3], [3, 3, 5, 1, 4]]);
  assert.deepEqual(SCH.map((s) => SCHOOL_MINDSET[s].band), [0.5, 1.5, 1, 0, 2]);
  assert.deepEqual(SCH.map((s) => SCHOOL_MINDSET[s].latShare), [0.125, 0, 0.5, 0.25, 0.375]);
});

test('기질 범위 = 마음가짐 가운데 ± 폭 · 무유파는 옛 독일 값 그대로', () => {
  for (const s of SCH) {
    const T = TRADITIONS[s].temper, row = SCHOOL_MINDSET[s];
    for (const k of ['aggr', 'patienceTime', 'margin', 'circleRate']) {
      const w = MINDSET.spread[k];
      assert.ok(near(T[k][0], row[k] - w, 1e-4) && near(T[k][1], row[k] + w, 1e-4), `${s}.${k} ${T[k]}`);
    }
  }
  assert.deepEqual(TRADITIONS.none.temper, { margin: [0.2, 0.5], aggr: [0.85, 1.2], circleRate: [0.15, 0.4], rhythm: [2.4, 4.5], vor: [0.15, 0.6], patienceTime: [7, 12], guardStick: 2.5, guardSpeed: 0.9 });
  assert.equal(M.mindOf('none', 4), null);
  assert.equal(M.mindOf('chinese', 0), null, '숙련도 0 = 무 — 마음가짐 없음');
  assert.equal(M.mindOf('chinese', 3), SCHOOL_MINDSET.chinese);
});

/** 판 하나 차리기 — 재는 유파 무기(E 자리) 대 롱소드 · 숙련 4 */
function setup(weapon) {
  const G = newRound({ seed: 3, walls: true, weapon: 'longsword', weapon2: weapon, AI2Class: AI, difficulty: AI_PROFICIENCY.levels[4], difficulty2: AI_PROFICIENCY.levels[4], persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
  return { G, ai: G.ai, foe: G.player };
}
/** 상대 상태를 꾸며 3 초 동안 mindTick (늦게 본 모습 s 는 지금 몸) */
function soak(ai, set) {
  set(ai.foe);
  const s = { state: 'stand', armed: true };
  for (let t = 0; t < 3; t += 0.05) {
    ai.sense.t += 0.05;
    M.mindTick(ai, 0.05, s, 0, 0);
  }
  return [...ai.mindShift];
}

test('집요함: 일본(1)은 상대 상태에 안 움직임 · 동방(5)은 폭 ±2 안에서 정한 쪽으로 · 피 → 기다림 · 멀리 / 지침 → 먼저 · 붙음 / 다리 → 옆', () => {
  const jp = setup('uchigatana');
  const sj = soak(jp.ai, (f) => { f.bleed = 0.05; f.blood = 0.5; f.stamina.exhaustLeft = 99; f.limbs.legF = 0.2; });
  assert.deepEqual(sj, [0, 0, 0, 0], '일본은 제 페이스');
  jp.G.world.free();
  const cn = setup('hwando');
  const sb = soak(cn.ai, (f) => { f.bleed = 0.05; f.blood = 0.5; });
  assert.ok(sb[0] < -1.5 && sb[1] > 1.5, `피: 선공 ↓ 거리 ↑ ${sb}`);
  assert.ok(sb.every((x) => Math.abs(x) <= 2 + 1e-9), `폭 ±2 ${sb}`);
  const st = soak(cn.ai, (f) => { f.bleed = 0; f.blood = 1; f.stamina.exhaustLeft = 99; });
  assert.ok(st[0] > 1.5 && st[1] < -1.5, `지침: 선공 ↑ 거리 ↓ ${st}`);
  const sl = soak(cn.ai, (f) => { f.stamina.exhaustLeft = 0; f.stamina.level = 0; f.limbs.legF = 0; f.limbs.legB = 0; });
  assert.ok(sl[3] > 0.9 && sl[3] <= 1 + 1e-9, `다리: 횡보 ↑ (4 → 5 끝에서 잘림) ${sl}`);
  for (const [k, ax] of [[0, 'initiative'], [1, 'distance'], [3, 'lateral']]) { const v = M.mindScore(cn.ai, ax); assert.ok(v >= 1 && v <= 5, `${ax} ${v}`); void k; }
  cn.G.world.free();
});

test('일격: 입힐 피해로 판단(이베리아 1)하면 머리 위 큰 베기 · 받을 피해로 판단(동방 0)하면 짧은 찌르기 쪽', () => {
  const ib = setup('zweihander'), cn = setup('hwando');
  const big = { name: 'z', kind: 'cut', from: [0.42, 0.42], path: [[0.12, 0.14], [-0.4, -0.42]], presses: true };
  const small = { name: 's', kind: 'thrust', from: [0.18, -0.28], path: [[0.06, -0.1], [0, 0.03]], fast: true };
  const hand = [0.1, 0];
  const pd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (const [x, wantBig] of [[ib.ai, true], [cn.ai, false]]) {
    const S = M.mindStakes(x, [big, small], hand, pd);
    const wb = M.mindTechW(S, 0), ws = M.mindTechW(S, 1);
    assert.equal(wb > ws, wantBig, `${x.art.tradition}: 큰 ${wb.toFixed(3)} · 작은 ${ws.toFixed(3)}`);
  }
  assert.ok(M.mindRiskK(ib.ai) < 0.01 && M.mindRiskK(cn.ai) > 1.99, '절제: 입힐 피해 판단 → 덜 참음 · 받을 피해 판단 → 더 참음');
  ib.G.world.free(); cn.G.world.free();
});

test('횡보: 이탈리아(1 — 목표 0 %)는 옆으로 돌지 않고 · 붙어서도 곧게 물러남 · 이베리아(5)는 돎', () => {
  const it = setup('rapier'), ib = setup('zweihander');
  for (let i = 0; i < 50; i++) assert.equal(M.mindCircle(it.ai, 0.3), 0);
  assert.equal(M.mindSideK(it.ai), 0);
  let n = 0;
  for (let i = 0; i < 200; i++) if (M.mindCircle(ib.ai, 0) !== 0) n++;
  assert.ok(n > 150, `이베리아 돌기 박자 ${n} / 200`);
  it.G.world.free(); ib.G.world.free();
});

test('짧은 판 (6 s) — 다섯 유파 모두 마음가짐이 있고 옮긴 점수가 1 ~ 5 · 폭 안', () => {
  for (const [s, w] of [['german', 'longsword'], ['italian', 'rapier'], ['iberian', 'zweihander'], ['japanese', 'uchigatana'], ['chinese', 'hwando']]) {
    const { G, ai } = setup(w);
    assert.equal(ai.mind, SCHOOL_MINDSET[s], s);
    for (let i = 0; i < Math.round(6 / DT); i++) {
      G.step();
      if (i % 60) continue;
      const band = SCHOOL_MINDSET[s].band;
      for (const ax of ['initiative', 'distance', 'decisive', 'lateral']) {
        const sh = M.mindShiftOf(ai, ax), v = M.mindScore(ai, ax);
        assert.ok(Math.abs(sh) <= band + 1e-9 && v >= 1 - 1e-9 && v <= 5 + 1e-9, `${s} ${ax} ${sh} ${v}`);
      }
    }
    G.world.free();
  }
});
