// 손가락 긋기 세기 시험 (11/06 — 사장님 '손가락 베기 세기 -> 이건 최소한, 상처의 최소 문턱과 비슷해져야해' · 기록 docs/strike/finger_cut_2026-11-06.md · 확인표 3430 ~)
//  ① 기본값: SKILL.fingerCut arm 2 · gain 2 · hit 1 · ai 0 (11/06 사장님 '바로 기본으로 켜') · floor −0.5 (11/09 감도 바닥 — 사장님 확인 전)
//  ② fingerCutK: 끄면 늘 1 · 켜면 사람 손가락 팔(autoGuard)이 긋는 동안만 · AI 는 ai 켬일 때만(gain 은 사람만) · 비기 · 끌고 가는 칼 · 찌르기 · 막기 단추 등은 1 · hit 는 긋기 끝 recoverDelay 안까지
//  ②′ fingerCutFloor (11/09 사장님 '감도 2배는 두되 손이 원 바닥에 닿기 전에서 멈추게 해'): 감도로 더 간 손 목표만 바닥에서 멈춤 · 감도 1 로 갔을 자리 · 위 · 옆은 그대로 · 끔 · AI · 손가락 뗌은 아무것도 안 함
//  ③ 켜도 사람 몸이 긋지 않으면 판이 같음 (AI 대 가만히 선 사람 — AI 몸은 그대로) · ai 켬이면 AI 판이 바뀜
//  ④ 켬 = 의도대로 (서 있는 상대 과녁): arm · gain 은 칼끝이 더 빨라짐 · hit 는 같은 닿음의 판정 J 가 정확히 × hit
//  node --test tools/sim/finger_cut.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { drillOne, airSwing } from './finger_cut.mjs';
import { fingerCutK, fingerCutFloor } from '../../src/finger_cut.js';
import { G as GU } from '../../src/ai_techniques.js';

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

test('기본값: 손가락 긋기 세기 arm 2 · gain 2 (11/06 사장님) · hit 1 · ai 0 · 감도 바닥 floor = 바보 자세 높이 (11/09)', () => {
  assert.deepEqual(SKILL.fingerCut, { arm: 2, gain: 2, hit: 1, ai: 0, floor: -0.5 });
  assert.equal(SKILL.fingerCut.floor, GU.alber[1], '감도 바닥 = 자세표 가장 낮은 자리 (바보 G.alber)');
});

/** skill.js update 머리와 같은 차례 (손가락 몫 → 감도 몫 → 감도 바닥 → 원 자르기 → fcOff) — 손가락 길 pts 를 한 스텝 d 씩. swingOff(pad) = 그 스텝 긋는 중이 아님(손 목표가 멈춘 판 등) */
function padRun(pts, { from = [0, 0.14], d = 0.0375, body = {}, swingOff = null } = {}) {
  const R = CONFIG.WEAPON.reach;
  const f = { alive: true, armed: true, weapon: {}, handHeld: true, inputActive: true, handOffset: new THREE.Vector2(...from), ...body };
  f.skill = { autoGuard: true, swinging: true, quiet: 0, ...(body.skill ?? {}) };
  const sk = f.skill;
  const out = [];
  let fg = [...from];
  for (const p of pts) {
    for (;;) {
      const dx = p[0] - fg[0], dy = p[1] - fg[1], L = Math.hypot(dx, dy);
      if (L < 1e-9) break;
      const st = Math.min(L, d);
      const mx = (dx / L) * st, my = (dy / L) * st;
      fg = [fg[0] + mx, fg[1] + my];
      f.handOffset.x += mx;
      f.handOffset.y += my;
      if (swingOff) sk.swinging = !swingOff(f.handOffset, out);
      const g = fingerCutK(f, 'gain');
      const ex = sk.fcOff ? f.handOffset.x - sk.fcOff.x : 0, ey = sk.fcOff ? f.handOffset.y - sk.fcOff.y : 0;
      if (g !== 1 && f.inputActive && sk.fcOff) { f.handOffset.x += ex * (g - 1); f.handOffset.y += ey * (g - 1); }
      fingerCutFloor(f, sk, ex, ey);
      if (f.handOffset.length() > R) f.handOffset.setLength(R);
      if ((SKILL.fingerCut.gain ?? 1) !== 1) (sk.fcOff ??= f.handOffset.clone()).copy(f.handOffset);
      out.push([+fg[0].toFixed(4), +fg[1].toFixed(4), +f.handOffset.x.toFixed(4), +f.handOffset.y.toFixed(4)]);
    }
  }
  return out;
}

test('감도 바닥 (11/09 — fingerCutFloor): 감도로 더 간 손 목표만 바닥에서 멈춤 · 감도 1 로 갔을 자리 · 위 · 옆은 그대로 · 끔 · AI · 손가락 뗌은 그대로', () => {
  const R = CONFIG.WEAPON.reach;
  const fl = SKILL.fingerCut.floor;
  const down = [[0, -0.5]]; // 제비 베기 손가락 길 (지붕 → [0, 0.14] → 바보)
  const lo = (rows) => Math.min(...rows.map((r) => r[3]));
  withFC({ floor: null }, () => assert.ok(lo(padRun(down)) <= -R + 1e-6, '끔(11/09 전): 감도 2 는 같은 손가락 길에 원 바닥까지'));
  const on = padRun(down);
  assert.ok(Math.abs(lo(on) - fl) < 1e-9, `켬: 바닥에서 멈춤 ${lo(on)}`);
  const at = on.findIndex((r) => r[3] <= fl + 1e-9);
  assert.ok(on[at][1] > fl / 2, `바닥까지는 감도 2 그대로 (손가락 ${on[at][1]} 에서 닿음 — 손가락 길 절반 언저리)`);
  for (let i = 1; i <= at; i++) assert.ok(Math.abs(on[i - 1][3] - on[i][3] - Math.min(0.075, on[i - 1][3] - fl)) < 1e-9, '바닥 앞 스텝 몫 = 손가락 × 2');
  // 손 목표가 멈춰 긋는 중이 아니어도(감도 1 스텝) 감도 1 로 갔을 자리(손가락 −0.5)보다 깊이 안 감
  const still = padRun(down, { swingOff: (p, rows) => rows.length > 2 && Math.abs(rows[rows.length - 1][3] - fl) < 1e-9 });
  assert.ok(lo(still) >= fl - 1e-9, `멈춘 뒤 감도 1 스텝도 바닥 밑 안 감 ${lo(still)}`);
  // 감도 1 로도 바닥 밑으로 갔을 손가락(−0.9 — 그림자가 원 바닥)은 그 자리까지 그대로
  const deep = padRun([[0, -0.9]]);
  assert.ok(lo(deep) <= -R + 1e-6, `깊은 손가락은 감도 1 판처럼 원 바닥까지 ${lo(deep)}`);
  withFC({ gain: 1, floor: null }, () => { const g1 = padRun([[0, -0.9]]); assert.ok(lo(g1) <= -R + 1e-6); });
  // 바닥 밑에서 시작한 손(그림자 = 손 목표)은 감도 몫 없이 감도 1 로만 내려감
  const below = padRun([[0, -0.6]], { from: [0, -0.52], d: 0.01 });
  assert.ok(Math.abs(below[0][3] - -0.53) < 1e-9 && Math.abs(below[1][3] - -0.54) < 1e-9, `바닥 밑 시작 = 감도 1 ${JSON.stringify(below.slice(0, 2))}`);
  // 위 · 옆 · 위로 긋기는 끔과 같은 길 (바닥만)
  for (const path of [[[0.6, 0.3]], [[-0.6, 0.1]], [[0, -0.3], [0, 0.6]], [[-0.5, -0.4]]]) {
    const a = padRun(path, { from: [0.1, 0] });
    const b = withFC({ floor: null }, () => padRun(path, { from: [0.1, 0] }));
    if (Math.min(...b.map((r) => r[3])) >= fl) assert.deepEqual(a, b, `바닥에 안 닿는 길은 그대로 ${JSON.stringify(path)}`);
  }
  // 끔 · AI · 손가락 뗌 · 감도 1 은 끔과 같은 길
  const off = withFC({ floor: null }, () => padRun(down));
  assert.deepEqual(padRun(down, { body: { handHeld: false } }), off, '손가락 뗌');
  assert.deepEqual(padRun(down, { body: { aiControlled: true, skill: { autoGuard: false } } }), withFC({ floor: null }, () => padRun(down, { body: { aiControlled: true, skill: { autoGuard: false } } })), 'AI');
  assert.deepEqual(padRun(down, { body: { skill: { sec: {} } } }), withFC({ floor: null }, () => padRun(down, { body: { skill: { sec: {} } } })), '비기 (손가락 긋기 아닌 길)');
  withFC({ gain: 1 }, () => assert.deepEqual(padRun(down), withFC({ floor: null }, () => padRun(down)), '감도 1'));
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
