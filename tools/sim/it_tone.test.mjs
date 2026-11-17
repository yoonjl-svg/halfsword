// 찌르기를 막을 수 있게 — 시제품 시험 (11/15 사장님 '찌르기의 맛은 살려야 해. 혹은 찌르기를 더 잘 방어할 방법? 지금 찌르기 막기 거의 불가능하지 않아?' ·
//  config AI_TELL · THRUST.driveChamber · driveStep · src/thrust_tell.js · 기록 docs/strike/it_tone_2026-11-15.md): 11/16 묶음 P 기본 켬(사장님 결정 · 붙잡기 latch 는 끔) · 낌새 셈(앞 · 뒤 칼날 줄 빠르기 · 몸통 원통) · AI 위협 읽기 자리 · AI 몸 싣기 칸
//  11/16 리솔루토 세 안 (사장님 1안 · 2안 · 3안 — SECRET.risolutoTouchMin · risoAiWait · 기록 §8 · §9): 1안 · 2안 끔 · 3안 켬(사장님 11/16 결정) · 칼 우위 길 · 칼끝 얽힘 시간 · AI 박자 싸움 · 손잡이 둘 · 리솔루토 위험 읽기
//  node --test tools/sim/it_tone.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI, THREE } from './harness_m.mjs';
import { thrustTell } from '../../src/thrust_tell.js';
import { thrustDrive } from '../../src/skill.js';

const T = CONFIG.AI_TELL;
const with_ = (o, k, v, fn) => { const old = o[k]; o[k] = v; try { return fn(); } finally { o[k] = old; } };
/** 본 모습 — 상대 칼(타격점 → 칼끝)이 +x 쪽 나를 겨눔 (나 = 원점 가슴) · 칼끝 빠르기 v (칼날 줄 몫) */
const seen = ({ v = 2, tipX = 0.9, side = 0, armed = true } = {}) => ({ armed, tx: tipX, ty: 0, tz: side, mx: tipX + 0.5, my: 0, mz: side, tvx: -v, tvy: 0, tvz: 0 });
const C = { x: 0, y: 0, z: 0 };

test('기본값 — 묶음 P 켬 (사장님 11/16 결정 "묶음 P 넣어.") · 붙잡기는 끔 · 문턱은 있던 수 (칼 드는 낌새 1.6 m/s · 걸음 사다리 0.9)', () => {
  assert.equal(T.v, 1.6);
  assert.equal(T.ray, 0.9);
  assert.equal(CONFIG.IT_OUTBOX.inqMul, 0.5);
});

test('낌새 셈: 칼이 칼날 줄로 나오기 시작(1.6 m/s 이상 — 앞 · 당김 모두) · 그 줄이 몸통 원통을 지나야 · 느림 · 비낌 · 멂 · 칼 없음 = 없음', () => {
  const h = thrustTell(seen({ v: 2 }), C);
  assert.ok(h && h.tell, '나오는 칼');
  assert.ok(Math.abs(h.sp - 2) < 1e-9);
  assert.ok(thrustTell(seen({ v: -2 }), C), '당김(찌르기 전) 도 낌새');
  assert.equal(thrustTell(seen({ v: 1.5 }), C), null, '1.6 밑 — 걷는 몸 · 맞대기 잔걸음');
  assert.equal(thrustTell(seen({ side: 0.7 }), C), null, '칼날 줄이 몸통 원통(0.55) 밖');
  assert.equal(thrustTell(seen({ tipX: 2.0 }), C), null, '칼끝에서 0.9 안에 몸이 없음');
  assert.equal(thrustTell(seen({ armed: false }), C), null);
});

test('AI 위협 읽기: 느린 찌르기 시작을 찌르기 줄로 봄 (같은 늦게 본 모습)', () => {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    const c = new THREE.Vector3(0, 1.3, 0);
    const r = new THREE.Vector3(0, 0, 1);
    const s = { ...seen({ v: 2 }), tx: 0.9, ty: 1.3, tz: 0, mx: 1.4, my: 1.3, mz: 0, tvy: 0, mvx: -2, mvy: 0, mvz: 0, cx: 1.6, cz: 0, hy: 0, hx: 0 };
    const d = Math.min(1.5, ai.foeReach);
    const th = ai.threat(s, c, r, d);
    assert.ok(th && th.thrust && th.line === 'thrust', '켬 — 찌르기 줄');
    assert.equal(ai.stats.tell, 1);
  } finally { G.world.free(); }
});

test('AI 찌르기 몸 싣기: 사람과 같은 칸 값 (당김 · 몸 싣기)', () => {
  const D = CONFIG.THRUST;
  for (const f of [{ aiControlled: true }, { aiControlled: false }]) {
    const a = thrustDrive(f);
    assert.ok(a && a.chamber === D.driveChamber && a.step === D.driveStep && a.ride);
  }
});

test('비껴서며 찌르기 배율 IT_OUTBOX.inqMul (기본 0.5 — 사장님 11/16 결정 · 1 = 전 판): 사람 · AI 같게 판정 배율 — 0.5 · 0.8 · 맞박자와 곱 · 다른 찌르기는 thrustMul 그대로', async () => {
  const { itThrust } = await import('../../src/italian_outbox.js');
  const IO = CONFIG.IT_OUTBOX;
  assert.equal(IO.inqMul, 0.5);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mk = (ai) => {
    const foe = { alive: true, state: 'stand', gait: { walking: false }, cache: { parts: { pelvis: { p: V(1.8, 0.9, 0), v: V(0, 0, 0) } } } };
    const me = { swordArt: { tradition: 'italian' }, aiControlled: ai, skill: {}, stamina: {}, foe, cache: { parts: { pelvis: { p: V(0, 0.9, 0), v: V(0, 0, 0) } } }, fightT: 5 };
    if (ai) me.aiCtl = { mode: 'attack', phase: 'strike', tech: { kind: 'thrust', name: 'inquartata' } };
    else me.iai = { tech: 'inquartata' };
    return { me, foe };
  };
  for (const ai of [false, true]) {
    const { me, foe } = mk(ai);
    assert.equal(with_(IO, 'inqMul', 1, () => itThrust(me, foe)), null, '1 = 배율 없음');
    assert.equal(itThrust(me, foe)?.k, 0.5, `${ai ? 'AI' : '사람'} 기본 × 0.5`);
    for (const m of [0.5, 0.8]) assert.equal(with_(IO, 'inqMul', m, () => itThrust(me, foe)?.k), m, `${ai ? 'AI' : '사람'} × ${m}`);
    foe.gait.walking = true;
    foe.cache.parts.pelvis.v = V(-0.5, 0, 0);
    assert.ok(Math.abs(with_(IO, 'inqMul', 0.5, () => itThrust(me, foe).k) - 0.5 * (1 + IO.stop)) < 1e-12, '맞박자와 곱');
  }
});

// ── 11/16 리솔루토 세 안 (기록 §8 — 모두 기본 끔) ──
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** 칼이 붙은 두 몸 (덮음 0.05 m · 실제 맞닿음) — 상대는 물러서는 중 · 나는 스틱 앞 */
const bound = () => {
  const me = { armed: true, weapon: { id: 'rapier' }, bladePoint: (t, v) => v.set(0, 1.3, t), foeDistance: () => 2.0, stickY: 1, stickX: 0, skill: {}, stamina: {}, feel: { touching: true } };
  const foe = { armed: true, weapon: { id: 'longsword' }, bladePoint: (t, v) => v.set(0.05, 1.3, 1.5 - t), skill: {}, stamina: {}, move: { y: -0.5 }, feel: {} };
  return { me, foe };
};

test('세 안 기본값 — 1안 · 2안 끔 · 3안 켬 (사장님 11/16 "3안도 넣어." — AI 0.2 s 뒤 박자 싸움 · 리솔루토 위험 읽기) · 손잡이 둘은 지금 그대로', () => {
  assert.equal(CONFIG.SECRET.risolutoTouchMin, 0);
  assert.equal(CONFIG.SECRET.risoAiWait, CONFIG.realS(0.2));
  assert.equal(CONFIG.SECRET.risoAiMax, 0);
  assert.equal(CONFIG.SECRET.risoAiGame, 1);
});

test('2안 SECRET.risolutoTouchMin: 0 = 덮인 채 나아가기 첫 스텝에 칼끝 얽힘 창 · 0.2 s = 창을 열 수 있는 동안(칼 우위) 0.2 s 이어진 뒤', async () => {
  const { RisolutoWatch } = await import('../../src/italian_risoluto.js');
  const S = CONFIG.SECRET;
  const dt = CONFIG.realS(0.05);
  const { me, foe } = bound();
  const W0 = new RisolutoWatch(me, foe);
  assert.equal(W0.tick(dt, true)?.path, 'touch', '지금 — 곧장');
  with_(S, 'risolutoTouchMin', CONFIG.realS(0.2), () => {
    const W = new RisolutoWatch(me, foe);
    for (let k = 0; k < 4; k++) assert.equal(W.tick(dt, false), null, '칼 우위 없음 — 셈만');
    for (let k = 0; k < 3; k++) assert.equal(W.tick(dt, true), null, `칼 우위 ${k + 1} 스텝 — 0.2 s 전`);
    assert.equal(W.tick(dt, true)?.path, 'touch', '0.2 s');
    assert.equal(W.opens.touch, 1);
  });
});

test('3안 AI 박자 싸움 SECRET.risoAiWait (기본 0.2 s): 창이 열리고 0.2 s 전엔 안 냄 · 박자 싸움 몫이면 본 휘두름 · 칼 듦 · 걸어 들어옴에만 · 아니면 0.2 s 에 곧장', () => {
  const S = CONFIG.SECRET;
  const fake = (o = {}) => ({ sense: { seen: () => ({ hvx: 0, hvy: o.hvy ?? 0, hy: o.hy ?? 0 }) }, level: { reaction: 0.1 }, seenSwing: () => !!o.swing, foeClosing: o.closing ?? 0 });
  const R = (age, tgame) => ({ win: S.playerWindow - CONFIG.realS(age), tgame });
  with_(S, 'risoAiWait', CONFIG.realS(0.2), () => {
    const go = (f, r) => AI.prototype.risoTiming.call(f, r);
    assert.equal(go(fake({ swing: true }), R(0.1, true)), null, '0.2 s 전');
    assert.equal(go(fake(), R(0.1, false)), null, '0.2 s 전 (곧장 몫도)');
    assert.equal(go(fake(), R(0.3, false)), 'plain', '박자 싸움 밖 몫 — 0.2 s 뒤 곧장');
    assert.equal(go(fake(), R(0.3, true)), null, '상대가 박자를 안 냄 — 기다림');
    assert.equal(go(fake({ swing: true }), R(0.3, true)), 'swing');
    assert.equal(go(fake({ hvy: 2, hy: 0.1 }), R(0.3, true)), 'raise');
    assert.equal(go(fake({ closing: 1 }), R(0.3, true)), 'step');
    assert.equal(go(fake({ closing: -1 }), R(0.3, true)), null, '물러섬은 박자 아님');
    // 손잡이 risoAiMax (기본 0 = 창 끝까지 기다림): 0.4 s 면 그때 창이 열려 있으면 그대로 냄
    assert.equal(go(fake(), R(0.5, true)), null, '기본 — 0.5 s 에도 기다림');
    with_(S, 'risoAiMax', CONFIG.realS(0.4), () => {
      assert.equal(go(fake(), R(0.3, true)), null, '0.4 s 전 — 기다림');
      assert.equal(go(fake(), R(0.45, true)), 'late', '0.4 s 뒤 — 그대로 냄');
      assert.equal(go(fake({ closing: 1 }), R(0.45, true)), 'step', '박자가 있으면 그 까닭');
    });
  });
});

test('3안 손잡이 risoAiGame (기본 1): 창이 열릴 때 박자 싸움 몫 = 띠 기울기 × 이 값 — 숙련 5 · 6 은 1 이면 늘 기다림 · 0.5 면 창 둘에 하나', () => {
  const G = newRound({ seed: 2, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai2.riso ? G.ai2 : G.ai;
    assert.ok(ai.riso, '레이피어 숙련 5 AI 는 리솔루토 셈이 있음');
    assert.equal(ai.planK, 1);
    const S = CONFIG.SECRET;
    const roll = (game, n = 400) => {
      let k = 0;
      with_(S, 'risoAiGame', game, () => {
        for (let i = 0; i < n; i++) {
          const R = ai.riso;
          R.win = 0;
          R.W.tick = () => ({ ev: 'risoluto', path: 'touch' }); // 창이 열린다고 침 (셈은 위 시험)
          ai.risoTick(1 / 120, false);
          k += R.tgame ? 1 : 0;
        }
      });
      return k / n;
    };
    const keep = { w: ai.riso.W.tick, go: ai.risoGo, free: ai.secretFree };
    ai.risoGo = () => false;
    try {
      assert.equal(roll(1), 1, '기본 — 늘 기다림');
      const h = roll(0.5);
      assert.ok(h > 0.4 && h < 0.6, `0.5 — 반쯤 (${h})`);
    } finally { ai.riso.W.tick = keep.w; ai.risoGo = keep.go; }
  } finally { G.world.free(); }
});

test('3안 리솔루토 위험 읽기 (사장님 11/16 결정): 칼 우위 빛 + 칼 붙음이면 발을 묶음(띠 세기만큼) · 칼이 떨어져 있으면 거리를 벌림 · 0 = 전 판', async () => {
  const { readFeetV } = await import('../../src/ai_read.js');
  const RD = CONFIG.AI_PLAN.read;
  const mk = (planK, near) => {
    const { me, foe } = bound();
    me.feel.touching = near;
    if (!near) foe.bladePoint = (t, v) => v.set(1, 1.3, 1.5 - t);
    Object.assign(foe, { swordArt: { tradition: 'italian' }, itEdge: { until: 10 }, fightT: 5 });
    return { me, foe, planK, chasing: false, read: { school: true, st: {} } };
  };
  const r = RD.risk;
  {
    const a = mk(1, true);
    assert.equal(readFeetV(a, -0.6, 1.5) + 0, 0, '높음 — 발을 묶음');
    assert.equal(a.read.st.risoHold, 1);
    assert.ok(Math.abs(readFeetV(mk(2 / 3, true), -0.6, 1.5) + 0.2) < 1e-12, '가운데 — ⅓ 만');
    assert.equal(readFeetV(mk(1, false), 0.5, 1.5), -r, '칼이 떨어짐 — 지금처럼 거리를 벌림');
  }
});
