// 찌르기를 막을 수 있게 — 시제품 시험 (11/15 사장님 '찌르기의 맛은 살려야 해. 혹은 찌르기를 더 잘 방어할 방법? 지금 찌르기 막기 거의 불가능하지 않아?' ·
//  config AI_TELL · THRUST.driveAi · src/thrust_tell.js · 기록 docs/strike/it_tone_2026-11-15.md): 기본 끔 · 낌새 셈(앞 · 뒤 칼날 줄 빠르기 · 몸통 원통) · AI 위협 읽기 자리 · AI 몸 싣기 칸
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

test('기본값 — 모두 끔 (관문 판 그대로) · 문턱은 있던 수 (칼 드는 낌새 1.6 m/s · 걸음 사다리 0.9)', () => {
  assert.equal(T.ai, 0);
  assert.equal(T.guard, 0);
  assert.equal(T.v, 1.6);
  assert.equal(T.ray, 0.9);
  assert.equal(CONFIG.THRUST.driveAi, 0);
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

test('AI 위협 읽기: 끔이면 느린 찌르기 시작은 못 봄 · 켜면 찌르기 줄로 봄 (같은 늦게 본 모습)', () => {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    const c = new THREE.Vector3(0, 1.3, 0);
    const r = new THREE.Vector3(0, 0, 1);
    const s = { ...seen({ v: 2 }), tx: 0.9, ty: 1.3, tz: 0, mx: 1.4, my: 1.3, mz: 0, tvy: 0, mvx: -2, mvy: 0, mvz: 0, cx: 1.6, cz: 0, hy: 0, hx: 0 };
    const d = Math.min(1.5, ai.foeReach);
    assert.equal(with_(T, 'ai', 0, () => ai.threat(s, c, r, d)), null, '끔 — 3.5 m/s 밑');
    const th = with_(T, 'ai', 1, () => ai.threat(s, c, r, d));
    assert.ok(th && th.thrust && th.line === 'thrust', '켬 — 찌르기 줄');
    assert.equal(ai.stats.tell, 1);
  } finally { G.world.free(); }
});

test('AI 찌르기 몸 싣기: driveAi 0 이면 AI 몸은 null (사람 drive 와 따로) · 켜면 같은 칸 값', () => {
  const ai = { aiControlled: true };
  const hu = { aiControlled: false };
  const D = CONFIG.THRUST;
  assert.equal(with_(D, 'drive', 3, () => thrustDrive(ai)), null, '사람 스위치는 AI 를 안 건드림');
  const a = with_(D, 'driveAi', 3, () => thrustDrive(ai));
  assert.ok(a && a.chamber === D.driveChamber && a.step === D.driveStep && a.ride);
  assert.equal(with_(D, 'driveAi', 3, () => thrustDrive(hu)), null, 'AI 스위치는 사람을 안 건드림 (drive 0)');
  assert.equal(with_(D, 'driveAi', 1, () => thrustDrive(ai)).step, null, '1 = 당김만');
});

test('비껴서며 찌르기 배율 IT_OUTBOX.inqMul (기본 1 = 그대로): 사람 · AI 같게 판정 배율 — 0.5 · 0.8 · 맞박자와 곱 · 다른 찌르기는 thrustMul 그대로', async () => {
  const { itThrust } = await import('../../src/italian_outbox.js');
  const IO = CONFIG.IT_OUTBOX;
  assert.equal(IO.inqMul, 1);
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
    assert.equal(itThrust(me, foe), null, '1 = 배율 없음');
    for (const m of [0.5, 0.8]) assert.equal(with_(IO, 'inqMul', m, () => itThrust(me, foe)?.k), m, `${ai ? 'AI' : '사람'} × ${m}`);
    foe.gait.walking = true;
    foe.cache.parts.pelvis.v = V(-0.5, 0, 0);
    assert.ok(Math.abs(with_(IO, 'inqMul', 0.5, () => itThrust(me, foe).k) - 0.5 * (1 + IO.stop)) < 1e-12, '맞박자와 곱');
  }
});

test('막기 단추 낌새 붙잡기 AI_TELL.latch (기본 0 = 끔 · guard 1 일 때만): 놓은 뒤 latch 안에 찌르기 낌새면 막기 꼴 · 밖 · guard 0 = 그대로', async () => {
  const { PlayerParryGuard } = await import('../../src/parry_button.js');
  assert.equal(T.latch, 0);
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'rapier' });
  try {
    const P = G.player;
    const g = new PlayerParryGuard(P, G.enemy);
    for (let k = 0; k < 10; k++) G.step();
    g.held = true;
    g.step(1 / 120);
    g.held = false;
    g.thrustSoon = () => ({ tell: true }); // 찌르기 낌새가 왔다고 침 (셈은 위 시험)
    assert.equal(with_(T, 'guard', 1, () => g.step(1 / 120)), false, 'latch 0 = 놓으면 끝');
    g.held = true; g.step(1 / 120); g.held = false;
    const on = () => with_(T, 'guard', 1, () => with_(T, 'latch', CONFIG.realS(0.6), () => g.step(1 / 120)));
    assert.equal(on(), true, '놓은 뒤 0.6 s 안 · 찌르기 낌새 = 막기 단추를 쥔 것처럼');
    g.heldAt = g.clock - CONFIG.realS(0.7);
    g.latchRun = false;
    assert.equal(on(), false, '0.6 s 밖');
    g.held = true; g.step(1 / 120); g.held = false;
    assert.equal(with_(T, 'guard', 0, () => with_(T, 'latch', CONFIG.realS(0.6), () => g.step(1 / 120))), false, 'guard 0 = 그대로');
  } finally { G.world.free(); }
});
