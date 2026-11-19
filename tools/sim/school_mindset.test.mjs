// 유파 마음가짐 (11/18 — src/ai_mindset.js · 값 표 schools.js SCHOOL_MINDSET · 끝 값 config MINDSET · 기록 docs/strike/school_mindset_2026-11-18.md)
//  ① 값 표가 점수 · 곧은 줄 셈과 같다 (한눈에 보이는 수 = 셈) ② 기질 범위 = 가운데 ± 폭 · 무유파는 옛 값 ③ 집요함 — 일본은 상대 상태에 안 움직이고 동방은 폭 ±2 안에서 정한 쪽으로
//  ④ 일격 — 입힐 피해로 판단하면 큰 베기 · 받을 피해로 판단하면 짧은 칼 ⑤ 횡보 1(이탈리아)은 옆으로 돌지 않음 ⑥ 짧은 판 하나 — 다섯 유파 모두 옮긴 점수가 1 ~ 5 안
//  ⑦ 선공은 기울기 — 참을성이 다 닳으면 선공 1 · 2 도 먼저 들어감 ⑧ 숙련도 몫 ⑨ 독일 붙어 남음 ⑩ 상대 버릇 (11/19)
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
    const at = { aggr: 'initiative', patienceTime: 'initiative', need: 'initiative', first: 'initiative', answer: 'initiative', margin: 'distance', gap: 'distance', creep: 'distance', give: 'distance', stay: 'distance', reward: 'decisive', latShare: 'lateral', circleRate: 'lateral' };
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

/** 판 하나 차리기 — 재는 유파 무기(E 자리) 대 롱소드 · 숙련 p (기본 4) */
function setup(weapon, p = 4) {
  const G = newRound({ seed: 3, walls: true, weapon: 'longsword', weapon2: weapon, AI2Class: AI, difficulty: AI_PROFICIENCY.levels[p], difficulty2: AI_PROFICIENCY.levels[4], persona: { proficiency: p }, persona2: { proficiency: 4 } });
  return { G, ai: G.ai, foe: G.player };
}
/** 상대 상태를 꾸며 3 초 동안 mindTick (늦게 본 모습 s 는 지금 몸) → 집요함이 옮긴 몫 (숙련도 몫 뺌) */
function soak(ai, set) {
  set(ai.foe);
  const s = { state: 'stand', armed: true };
  for (let t = 0; t < 3; t += 0.05) {
    ai.sense.t += 0.05;
    M.mindTick(ai, 0.05, s, 0, 0);
  }
  return [...ai.mindTen];
}

test('집요함 (숙련 6): 일본(1)은 상대 상태에 안 움직임 · 동방(5)은 폭 ±2 안에서 정한 쪽으로 · 피 → 기다림 · 멀리 / 지침 → 먼저 · 붙음 / 다리 → 옆', () => {
  const jp = setup('uchigatana', 6);
  const sj = soak(jp.ai, (f) => { f.bleed = 0.05; f.blood = 0.5; f.stamina.exhaustLeft = 99; f.limbs.legF = 0.2; });
  assert.deepEqual(sj, [0, 0, 0, 0], '일본은 제 페이스');
  jp.G.world.free();
  const cn = setup('hwando', 6);
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

test('일격 (숙련 6): 입힐 피해로 판단(이베리아 1)하면 머리 위 큰 베기 · 받을 피해로 판단(동방 0)하면 짧은 찌르기 쪽', () => {
  const ib = setup('zweihander', 6), cn = setup('hwando', 6); // 숙련 6 — 값 표 끝 값 그대로
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

test('횡보 (숙련 6): 이탈리아(1 — 목표 0 %)는 옆으로 돌지 않고 · 붙어서도 곧게 물러남 · 이베리아(5)는 돎', () => {
  const it = setup('rapier', 6), ib = setup('zweihander', 6); // 숙련 6 — 값 표 끝 값 그대로
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
      const band = SCHOOL_MINDSET[s].band * M.profF(4);
      for (const ax of ['initiative', 'distance', 'decisive', 'lateral']) {
        const sh = M.mindTenOf(ai, ax), v = M.mindScore(ai, ax);
        assert.ok(Math.abs(sh) <= band + 1e-9 && v >= 1 - 1e-9 && v <= 5 + 1e-9, `${s} ${ax} ${sh} ${v}`);
      }
    }
    G.world.free();
  }
});

test('선공은 기울기 — 선공 1 · 2 도 참을성이 다 닳으면 먼저 들어감 (참다 빈틈은 1 밑으로 줄지 않음 · 이탈리아 거울판이 마주 서기만 하던 것)', () => {
  for (const [s, w] of [['japanese', 'uchigatana'], ['italian', 'rapier'], ['german', 'longsword']]) {
    const { G, ai } = setup(w);
    for (let i = 0; i < Math.round(2 / DT); i++) G.step();
    const seen = { ...ai.lastSeen, state: 'stand', armed: true };
    ai.patience = 0;
    const k = M.mindOppK(ai)[0];
    ai.me.offBalance = 0; // 내 몸 흔들림 감점(−0.5)은 빼고 봄
    const o = ai.opportunity(seen, ai.holdDist());
    assert.ok(o.score >= 1.1 * Math.max(1, k) - 1e-9, `${s}: 참을성 0 — 빈틈 점수 ${o.score.toFixed(3)} (${o.kind}) · 앞 곱 ${k.toFixed(2)}`);
    G.world.free();
  }
});

test('숙련도 몫 (사장님 11/19 \'검술이 높을수록 유파다워진다\'): 바탕 점수 = 3 + (점수 − 3) × f · f = max(0, 1 − ((6 − 숙련도) ÷ 4)²) · 숙련 6 은 값 표 그대로 · 폭도 × f', () => {
  assert.deepEqual(MINDSET.profF.map((x) => +x.toFixed(4)), [0, 1, 2, 3, 4, 5, 6].map((p) => +Math.max(0, 1 - ((6 - p) / 4) ** 2).toFixed(4)));
  for (const p of [2, 3, 4, 6]) {
    const { G, ai } = setup('rapier', p);
    const f = M.profF(p);
    assert.equal(ai.mindF, f);
    const sc = SCHOOL_MINDSET.italian.score; // [2, 5, 4, 2, 1]
    for (const [ax, k] of [['initiative', 0], ['distance', 1], ['decisive', 3], ['lateral', 4]]) assert.ok(near(M.mindScore(ai, ax), 3 + (sc[k] - 3) * f, 1e-9), `숙련 ${p} ${ax}`);
    assert.ok(near(M.mindGap(ai), M.knobAt('gap', 3 + 2 * f), 1e-9), `숙련 ${p} gap`);
    G.world.free();
  }
});

test('거리 — 내 칼 뒤 붙어 남음 (사장님 11/19 독일 \'붙어서 싸운다\'): 독일(1) 0.6 · 일본(2) 0.3 · 3 점부터 0 · 숙련 4 는 바탕 점수대로', () => {
  for (const [w, want] of [['longsword', 0.6], ['uchigatana', 0.3], ['hwando', 0], ['zweihander', 0], ['rapier', 0]]) {
    const { G, ai } = setup(w, 6);
    assert.ok(near(M.mindStay(ai), want, 1e-9), `${w} ${M.mindStay(ai)}`);
    G.world.free();
  }
  const { G, ai } = setup('longsword', 4);
  assert.ok(near(M.mindStay(ai), Math.max(0, M.knobAt('stay', 3 - 2 * M.profF(4))), 1e-9));
  G.world.free();
});

test('집요함 — 상대 버릇 (사장님 11/19 \'6초, 10초 기억\' = 수 읽기 그릇): 한 줄 되풀이 → 기다림 · 큰 칼 / 안 침 → 먼저 · 본 특수 공격 · 비기 기억 · 자주 침은 없음', () => {
  assert.ok(!M.STATES.includes('special') && !M.STATES.includes('secretUsed'));
  assert.ok(!M.STATES.includes('busy') && M.STATES.includes('quiet') && M.STATES.includes('repeat'));
  const { G, ai } = setup('hwando', 6); // 동방 폭 ±2 · 숙련 6 (높음 — 버릇 · 되풀이 그릇이 열림)
  const R = ai.read;
  assert.ok(R?.habit && R?.repeat, '높음 띠는 버릇 · 되풀이를 읽음');
  const s = { state: 'stand', armed: true };
  const run = (sec) => { for (let t = 0; t < sec; t += 0.05) { ai.sense.t += 0.05; M.mindTick(ai, 0.05, s); } return [...ai.mindTen]; };
  // 상대가 같은 줄로 다섯 번 (3 s 사이) — 한 줄 몫 100 % (되풀이 가득)
  for (let i = 0; i < 5; i++) { ai.sense.t += 0.6; R.n++; const j = (R.n - 1) % R.t.length; R.t[j] = ai.sense.t; R.line[j] = 'highR'; R.id[j] = 100 + i; R.lastT = ai.sense.t; }
  const a = run(2);
  assert.ok(a[0] < -1.5 && Math.abs(a[1]) < 0.05 && a[2] > 1.5, `되풀이: 선공 ↓ 일격 ↑ (거리 그대로) ${a}`);
  // 버릇 창(6 s)을 넘게 상대가 칼을 안 냄 — 안 침
  ai.me.fightT = 99;
  const b = run(12);
  assert.ok(b[0] > 1.5 && Math.abs(b[1]) < 0.05 && Math.abs(b[2]) < 0.05, `안 침: 선공 ↑ ${b}`);
  G.world.free();
  // 일본(폭 0)도 읽기는 그대로 — 옮김만 0
  const jp = setup('uchigatana', 6);
  assert.ok(jp.ai.read?.habit, '일본도 버릇을 읽음');
  for (let t = 0; t < 3; t += 0.05) { jp.ai.sense.t += 0.05; M.mindTick(jp.ai, 0.05, s); }
  assert.deepEqual([...jp.ai.mindTen], [0, 0, 0, 0]);
  jp.G.world.free();
});
