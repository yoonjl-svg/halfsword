// 간격과 박자 · 오코리 시험 (11/17 · config MEASURE · OKORI · src/ai_measure.js · 기록 docs/strike/measure_okori_2026-11-17.md):
//  기본 끔 · 끄면 셈이 없음 · 값이 사다리 위 · 선(유파 여유 · 독일 칼 붙음) · 오코리(띠 크기 · 베기 반대쪽 · 이미 실린 자세 · 칼이 이미 움직이는 공격 빼기) · 판에서 쓰임.
//  node --test tools/sim/measure_okori.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { msLine, msHold, msFeetV, okoriStart, okoriFrom, okoriCue } from '../../src/ai_measure.js';

const M = CONFIG.MEASURE;
const O = CONFIG.OKORI;
function withOn(fn) {
  const k = [M.on, O.on];
  M.on = 1;
  O.on = 1;
  try {
    return fn();
  } finally {
    [M.on, O.on] = k;
  }
}
/** 가짜 AI (선 · 오코리 셈만 읽는 칸) */
function fake(o = {}) {
  return {
    proficiency: 4, art: { tradition: 'german' }, foeReach: 1.7, chasing: false, Mup: null, drillOut: false, me: { armed: true, handOffset: { x: 0, y: 0 } },
    sense: { t: 10 }, stats: {}, M: { reach: 1.8 }, d: 1.9, phase: 'windup', tech: { kind: 'cut', from: [0.02, 0.52], path: [[0, 0.14], [-0.02, -0.5]] }, ...o,
  };
}

test('기본 끔 · 값 (시간 사다리 0.2 · 0.4 · 0.6 s · 걸음 사다리)', () => {
  assert.equal(M.on, 0, '사장님 확인 전 — 기본 끔');
  assert.equal(O.on, 0, '사장님 확인 전 — 기본 끔');
  const L = CONFIG.realS(1);
  assert.deepEqual(O.T.map((x) => +(x / L).toFixed(6)), [0.6, 0.6, 0.4, 0.2], '띠마다 몸 시작 시간 — 사다리 위');
  assert.deepEqual(O.amp.map((x) => +x.toFixed(4)), [1, 1, 0.6667, 0.3333], '크기 — 낮음이 크고 높음이 작음');
  assert.ok(M.gap.italian === 0 && M.gap.chinese === 0 && M.gap.other === 0.15 && M.deep === 0.15 && M.step === 0.6, JSON.stringify(M));
  assert.ok(Math.abs(M.bindT / L - 0.2) < 1e-9);
});

test('끄면 셈이 없다 (판에서 stats.ms · okori · 보이는 크기 없음)', () => {
  const G = newRound({ seed: 1, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 2 }, persona2: { proficiency: 5 } });
  try {
    while (G.t < 10) G.step();
    for (const ai of [G.ai, G.ai2]) {
      assert.equal(ai.stats.ms, undefined);
      assert.equal(ai.okori, undefined);
      assert.equal(ai.me.okoriBody, null);
      assert.equal(ai.me.okoriVis, 0);
    }
  } finally {
    G.world.free();
  }
});

test('선: 상대 칼끝 어림 + 유파 여유 · 독일은 칼이 붙어 있는 동안 선 없음 · 간 보기 바닥 · 기어 들지 않음', () => {
  assert.equal(msLine(fake({ art: { tradition: 'italian' } })), 1.7);
  assert.equal(msLine(fake({ art: { tradition: 'chinese' } })), 1.7);
  assert.ok(Math.abs(msLine(fake({ art: { tradition: 'japanese' } })) - 1.85) < 1e-9);
  assert.ok(Math.abs(msLine(fake()) - 1.85) < 1e-9);
  assert.equal(msLine(fake({ msBindT: 10 })), -Infinity, '독일 — 칼이 방금 붙음');
  assert.ok(msLine(fake({ msBindT: 10 - 2 * M.bindT })) > 0, '독일 — 붙은 지 오래');
  assert.equal(msLine(fake({ chasing: true })), -Infinity, '빈손 상대 쫓기');
  assert.ok(Math.abs(msHold(fake(), 1.5) - 1.93) < 1e-9, '바닥 = 선 + 0.08');
  assert.equal(msHold(fake(), 2.2), 2.2);
  assert.equal(msFeetV(fake(), 0.18, 1.9), 0, '선 + 0.08 안 — 앞으로 안 감');
  assert.equal(msFeetV(fake(), -0.3, 1.9), -0.3, '물러남은 그대로');
  assert.equal(msFeetV(fake(), 0.18, 2.1), 0.18, '선 밖 — 그대로');
});

test('오코리: 띠 크기 · 베기 반대쪽 · 이미 실린 자세는 높은 띠가 감지 않음 · 칼이 이미 움직이는 공격은 없음', () => {
  // 손이 멀리(가운데) · 정수리 베기(위 → 아래): 손은 준비 자리 너머 위로
  const lo = fake({ proficiency: 1 });
  okoriStart(lo, {});
  assert.ok(lo.okori && lo.okori.A === 1 && Math.abs(lo.okori.T - O.T[1]) < 1e-12 && lo.okori.by > 0.14 && !lo.okori.loaded, JSON.stringify(lo.okori));
  const hi = fake({ proficiency: 6 });
  okoriStart(hi, {});
  assert.ok(hi.okori.A < 0.34 && hi.okori.T < lo.okori.T && hi.okori.by < lo.okori.by, '높은 띠 — 작고 짧게');
  const F = okoriFrom(lo, lo.tech.from);
  assert.ok(Math.hypot(F[0], F[1]) <= 0.6 + 1e-9, '손 목표 한도 안');
  // 이미 준비 자리 (실린 자세): 높은 띠 = 너머 몫 0 · 낮은 띠 = 그래도 감음
  const hiL = fake({ proficiency: 6, me: { armed: true, handOffset: { x: 0.02, y: 0.52 } } });
  okoriStart(hiL, {});
  assert.ok(hiL.okori.loaded && hiL.okori.by === 0 && hiL.okori.bx === 0, '높은 띠 — 이미 실린 자세에서 곧장');
  const loL = fake({ proficiency: 1, me: { armed: true, handOffset: { x: 0.02, y: 0.52 } } });
  okoriStart(loL, {});
  assert.ok(loL.okori.loaded && loL.okori.by > 0, '낮은 띠 — 그래도 감음');
  // 가로베기(오른쪽 → 왼쪽): 몸통은 칼 든 쪽(+)으로 감음
  const zw = fake({ tech: { kind: 'cut', from: [0.52, 0.06], path: [[0, 0.1], [-0.52, 0.06]] } });
  okoriStart(zw, {});
  assert.ok(zw.okori.yaw > 0.9 && zw.okori.bx > 0, '가로베기 — 오른쪽으로 감음');
  for (const opt of [{ chain: 1 }, { secret: true }, { skipChamber: true }, { drill: true }]) {
    const a = fake();
    okoriStart(a, opt);
    assert.equal(a.okori, null, JSON.stringify(opt));
  }
});

test('오코리 읽기: 띠 문턱 (높은 띠가 더 작은 몸 시작도 봄) · 느린 감기도 낌새', () => {
  const s = { okori: 0.3, hx: 0.2, hy: 0.2, hvx: 0, hvy: 0, tvx: 0, tvy: 0, tvz: 0 };
  assert.equal(okoriCue(fake({ proficiency: 6 }), s), true, '높은 띠 — 0.3 을 봄 (문턱 0.2 · 기울기 1)');
  assert.equal(okoriCue(fake({ proficiency: 2 }), s), false, '낮은 띠 — 0.3 은 못 봄 (문턱 0.6)');
  const w = { okori: 0, hx: 0.3, hy: 0.3, hvx: 1.2, hvy: 1.2, tvx: 1, tvy: 0, tvz: 0 };
  assert.equal(okoriCue(fake({ proficiency: 2 }), w), true, '손이 바깥으로 1.7 m/s · 칼끝 느림 — 감기');
  assert.equal(okoriCue(fake({ proficiency: 2 }), { ...w, tvx: 5 }), false, '칼끝이 빠르면 휘두름 (위협 눈 몫)');
});

test('켜면 판에서 쓰임 (오코리 시작 · 몸 덧씌우기 · 보이는 크기 · 박자 걸음)', () =>
  withOn(() => {
    const G = newRound({ seed: 2, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 2 }, persona2: { proficiency: 4 } });
    let vis = 0, body = 0;
    try {
      while (G.t < 30 && G.player.alive && G.enemy.alive) {
        G.step();
        vis = Math.max(vis, G.enemy.okoriVis, G.player.okoriVis);
        if (G.enemy.okoriBody || G.player.okoriBody) body++;
      }
      const ms = [G.ai.stats.ms, G.ai2.stats.ms];
      assert.ok(ms[0] && ms[1], '재기 칸');
      assert.ok(ms[0].okori + ms[1].okori > 0, '오코리 시작');
      assert.ok(vis > 0.3 && body > 0, `보이는 크기 ${vis} · 덧씌운 스텝 ${body}`);
    } finally {
      G.world.free();
    }
  }));
