// 손가락 긋기 세기 시험 (11/06 — 사장님 '손가락 베기 세기 -> 이건 최소한, 상처의 최소 문턱과 비슷해져야해' · 기록 docs/strike/finger_cut_2026-11-06.md · 확인표 3430 ~)
//  ① 기본값: SKILL.fingerCut arm 1 · gain 1 · hit 2 · ai 0 (11/11 사장님 — 조작 예전 · 판정 2 배 · 전 11/06 arm 2 · gain 2)
//  ② fingerCutK: 끄면 늘 1 · 켜면 사람 손가락 팔(autoGuard)이 긋는 동안만 · AI 는 ai 켬일 때만(gain 은 사람만) · 비기 · 끌고 가는 칼 · 찌르기 · 막기 단추 등은 1 · hit 는 긋기 끝 recoverDelay 안까지
//  ③ 켜도 사람 몸이 긋지 않으면 판이 같음 (AI 대 가만히 선 사람 — AI 몸은 그대로) · ai 켬이면 AI 판이 바뀜
//  ④ 켬 = 의도대로 (서 있는 상대 과녁): arm · gain 은 칼끝이 더 빨라짐 · hit 는 같은 닿음의 판정 J 가 정확히 × hit
//  node --test tools/sim/finger_cut.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { drillOne, airSwing } from './finger_cut.mjs';
import { fingerCutK } from '../../src/finger_cut.js';

const { SKILL } = CONFIG;
const FC0 = { ...SKILL.fingerCut };
const withFC = (o, fn) => {
  Object.assign(SKILL.fingerCut, o);
  try {
    return fn();
  } finally {
    Object.assign(SKILL.fingerCut, FC0);
  }
};

test('기본값: 손가락 긋기 세기 hit 2 (11/11 사장님 — 조작 예전) · arm · gain 1 · ai 0', () => {
  assert.deepEqual(SKILL.fingerCut, { arm: 1, gain: 1, hit: 2, ai: 0 }); // 11/11 사장님 — 조작 예전 · 판정 2 배
});

test('fingerCutK: 사람 손가락 팔이 긋는 동안만 · AI 는 ai 켬일 때만 · 다른 동작은 1', () => {
  const body = (o = {}) => ({ alive: true, armed: true, weapon: {}, ...o, skill: { autoGuard: true, swinging: true, quiet: 0, ...(o.skill ?? {}) } });
  const H = body();
  withFC({ arm: 1, gain: 1, hit: 1 }, () => { for (const k of ['arm', 'gain', 'hit']) assert.equal(fingerCutK(H, k), 1, `끔 ${k}`); });
  withFC({ arm: 1.5, gain: 1.3, hit: 2 }, () => {
    assert.equal(fingerCutK(H, 'arm'), 1.5);
    assert.equal(fingerCutK(H, 'gain'), 1.3);
    assert.equal(fingerCutK(H, 'hit'), 2);
    const still = body({ skill: { swinging: false, quiet: 1 } });
    for (const k of ['arm', 'gain', 'hit']) assert.equal(fingerCutK(still, k), 1, `긋지 않음 ${k}`);
    const tail = body({ skill: { swinging: false, quiet: SKILL.recoverDelay * 0.5 } });
    assert.equal(fingerCutK(tail, 'hit'), 2, '긋기 끝 recoverDelay 안 닿음');
    assert.equal(fingerCutK(tail, 'arm'), 1, '팔 힘은 긋는 동안만');
    const AIb = body({ aiControlled: true, skill: { autoGuard: false } });
    for (const k of ['arm', 'gain', 'hit']) assert.equal(fingerCutK(AIb, k), 1, `AI ${k}`);
    withFC({ ai: 1 }, () => {
      assert.equal(fingerCutK(AIb, 'arm'), 1.5, 'ai 켬: AI 팔');
      assert.equal(fingerCutK(AIb, 'hit'), 2, 'ai 켬: AI 판정');
      assert.equal(fingerCutK(AIb, 'gain'), 1, '감도는 손가락이 있는 사람만');
      assert.equal(fingerCutK(body({ aiControlled: true, skill: { autoGuard: false }, secretHit: 2 }), 'arm'), 1, 'AI 비기 베기');
      assert.equal(fingerCutK(body({ aiControlled: true, skill: { autoGuard: false }, powerMul: 1.5 }), 'arm'), 1, 'AI 비기 서보 힘 창');
    });
    const off = [
      ['비기', { skill: { sec: {} } }], ['탭 찌르기', { skill: { tap: {} } }], ['손잡이 찍기', { skill: { pom: {} } }], ['채찍 톡', { skill: { flick: {} } }],
      ['감기', { skill: { uniq: { winding: true } } }], ['끌고 가는 칼', { iai: {} }], ['끌고 갈 칼 부탁', { iaiReq: {} }], ['휘감아 돌기', { ibSpin: {} }], ['경직', { secretStiff: true }],
      ['칼자루 치기', { mordAim: true }], ['AI 풍차 감기', { rdWind: {} }], ['막기 단추', { parryGuard: { active: true } }], ['죽음', { alive: false }], ['칼 없음', { armed: false }], ['권총', { weapon: { gun: true } }],
    ];
    for (const [why, o] of off) {
      const b = body(o);
      b.skill = { autoGuard: true, swinging: true, quiet: 0, ...(o.skill ?? {}) };
      for (const k of ['arm', 'gain', 'hit']) assert.equal(fingerCutK(b, k), 1, `${why} ${k}`);
    }
  });
});

/** AI 대 가만히 선 사람 (harness 기본 — 사람 몸은 입력 없음) · 몸 자리 · 상처 지문 */
function aiOnly(seed, steps) {
  const G = newRound({ seed, weapon: 'longsword', weapon2: 'longsword', walls: true });
  const log = [];
  try {
    const ow = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (a, v, r, ...x) => { ow?.(a, v, r, ...x); log.push([a.index, r.type, r.zone, +r.energy.toFixed(9)]); };
    for (let i = 0; i < steps; i++) G.step();
    const p = (f) => Object.values(f.bodies).map((b) => { const t = b.translation(); return [t.x, t.y, t.z].map((x) => +x.toFixed(9)); });
    return JSON.stringify({ log, P: p(G.player), E: p(G.enemy), s: [G.player.sword.translation(), G.enemy.sword.translation()] });
  } finally {
    G.world.free();
  }
}

test('켜도 사람 몸이 긋지 않으면 판이 같음 (AI 몸 그대로) · ai 켬이면 AI 판이 바뀜', () => {
  const steps = Math.round(9 / DT);
  const a = aiOnly(4, steps);
  const b = withFC({ arm: 2, gain: 2, hit: 2 }, () => aiOnly(4, steps));
  assert.equal(b, a, '사람만 (ai 0)');
  const c = withFC({ arm: 2, hit: 2, ai: 1 }, () => aiOnly(4, steps));
  assert.notEqual(c, a, 'ai 켬: AI 보통 긋기가 바뀜');
});

test('켬 = 의도대로: 허공 긋기 — arm · gain 은 칼끝 · 손이 빨라짐 (롱소드 · 우치가타나)', () => {
  for (const [weapon, school] of [['longsword', 'german'], ['uchigatana', 'japanese']]) {
    const base = withFC({ arm: 1, gain: 1, hit: 1 }, () => airSwing({ weapon, school, v: 4.5 })); // 끈 판 (기본은 11/06 부터 켬)
    const arm = withFC({ arm: 2, gain: 1 }, () => airSwing({ weapon, school, v: 4.5 }));
    const gain = withFC({ arm: 1, gain: 1.5 }, () => airSwing({ weapon, school, v: 4.5 }));
    assert.ok(arm.tip > base.tip && arm.hand > base.hand, `${weapon} arm 2: ${JSON.stringify([base, arm])}`);
    assert.ok(gain.tip > base.tip && gain.hand > base.hand, `${weapon} gain 1.5: ${JSON.stringify([base, gain])}`);
    assert.deepEqual(withFC({ arm: 1, gain: 1, hit: 1 }, () => airSwing({ weapon, school, v: 4.5 })), base, `${weapon} 1 = 끔`);
  }
});

test('켬 = 의도대로: 서 있는 상대 과녁 — hit 는 같은 닿음의 판정 J 만 정확히 × hit (빠르기 그대로)', () => {
  const cell = { school: 'german', weapon: 'longsword', dur: 14 };
  // 같은 닿음(같은 스텝 · 같은 칼 · 몸 상태)을 hit 1 로 다시 셈한 값의 정확히 2 배 (스위치가 걸린 닿음만)
  let checked = 0;
  withFC({ hit: 2 }, () => drillOne({ ...cell, seed: 1, onRound({ G, P }) {
    const an0 = G.combat.analyze.bind(G.combat);
    G.combat.analyze = (pr, point, S, Pp, predicting = false) => {
      const r = an0(pr, point, S, Pp, predicting);
      if (r && predicting && pr.w.fighter === P && checked < 3 && fingerCutK(P, 'hit') === 2) {
        SKILL.fingerCut.hit = 1;
        const r1 = an0(pr, point, S, Pp, true);
        SKILL.fingerCut.hit = 2;
        assert.ok(Math.abs(r.energy - 2 * r1.energy) < 1e-9 * Math.max(1, r.energy), `${r.energy} = 2 × ${r1.energy}`);
        assert.equal(r.speed, r1.speed, '빠르기 그대로');
        checked++;
      }
      return r;
    };
  } }));
  assert.ok(checked > 0, '스위치가 걸린 닿음이 있었음');
});
