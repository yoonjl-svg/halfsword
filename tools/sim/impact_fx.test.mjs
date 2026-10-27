// 타격감 시험 (10/25 사장님 '타격감 보강도 진행해' — config IMPACT_FX · src/impact_fx.js · 기록 docs/strike/impact_feel_2026-10-25.md · 확인표 2620 ~ 2629):
//  셈(무게 · 세기 · 멈칫 · 카메라 · 소리)이 에너지 · 무기 무게를 따라 오르고 위 끝을 넘지 않는지, 멈칫 묶음 합이 chainCap 을 넘지 않는지,
//  화면 · 소리만인지(판정 · 물리 · AI 파일이 이 셈을 읽지 않음 · main.js 멈칫은 한 곳으로만 들어감), 무게 소리 한 겹이 기존 소리 장치로만 나는지 본다.
//  node --test tools/sim/impact_fx.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IMPACT_FX, STRIKE } from '../../src/config.js';
import { woundHeft, clashHeft, heftLevel, woundImpact, clashImpact, stopGrant, stopTick, shakeWall } from '../../src/impact_fx.js';

const C = IMPACT_FX;
const src = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = { rapier: 1.1, longsword: 1.6, zweihander: 2.865, flamberge: 3.0 }; // fighter.swordProps.m (판을 만들어 읽은 값 — impact_fx_table.mjs MASS)

test('세기: h0 아래 0 · h1 위 1 · 에너지가 오르면 오름', () => {
  assert.equal(heftLevel(C.h0, C), 0);
  assert.equal(heftLevel(C.h0 * 0.5, C), 0);
  assert.equal(heftLevel(C.h1, C), 1);
  assert.equal(heftLevel(C.h1 * 4, C), 1);
  assert.equal(heftLevel(NaN, C), 0);
  let prev = -1;
  for (let E = 10; E <= 300; E += 10) {
    const x = woundImpact({ energy: E, mass: M.longsword }, C).x;
    assert.ok(x >= prev, `E ${E}`);
    prev = x;
  }
});

test('무게: 같은 에너지면 무거운 칼이 더 크게 (레이피어 < 롱소드 < 츠바이핸더 < 플랑베르주) · 무게 모름 · 총알 = 롱소드 눈금', () => {
  for (const E of [40, 60, 100]) {
    const xs = ['rapier', 'longsword', 'zweihander', 'flamberge'].map((w) => woundImpact({ energy: E, mass: M[w] }, C));
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i].H > xs[i - 1].H && xs[i].stop >= xs[i - 1].stop && xs[i].cam >= xs[i - 1].cam && xs[i].sound >= xs[i - 1].sound, `E ${E} · ${i}`);
    }
  }
  assert.equal(woundHeft(80, 0, C), 80);
  assert.equal(woundHeft(80, undefined, C), 80);
  assert.equal(woundHeft(80, C.massRef, C), 80);
  assert.equal(woundHeft(-5, 2, C), 0);
  assert.equal(woundHeft(80, 3.2, { ...C, massExp: 0 }), 80, '`?impactMass=0` = 판정 에너지만');
});

test('위 끝: 멈칫 ≤ stopMax · 카메라 ≤ 맞음 / 침 최대 · 소리 ≤ gain · 가르고 지나감 < 보통 < 걸림', () => {
  for (const E of [0, 5, 20, 60, 150, 400, 5000]) {
    for (const m of [0.3, 1.1, 1.6, 3, 8]) {
      const base = { energy: E, mass: m };
      const t = woundImpact({ ...base, taken: true }, C);
      const d = woundImpact({ ...base, taken: false }, C);
      const p = woundImpact({ ...base, pass: true }, C);
      const h = woundImpact({ ...base, hard: true }, C);
      for (const r of [t, d, p, h]) {
        assert.ok(r.stop >= 0 && r.stop <= C.stopMax + 1e-12, `stop ${E} ${m}`);
        assert.ok(r.sound >= 0 && r.sound <= C.sound.gain + 1e-12);
        assert.ok(r.down >= 0 && r.down <= C.camDown + 1e-12);
      }
      assert.ok(t.cam <= C.camTaken + 1e-12 && d.cam <= C.camDealt + 1e-12);
      assert.ok(d.cam <= t.cam, '내가 맞을 때가 더 크다');
      assert.ok(p.stop <= t.stop && t.stop <= h.stop);
    }
  }
  assert.ok(C.camTaken <= C.camCap && C.stopMax <= 0.1 && C.chainCap <= 0.1, '폰 멀미 · 손 굼뜸 상한');
});

test('가벼운 맞음은 거의 0 · 대검 큰 맞음은 뚜렷이 (레이피어 찌르기 25 J · 츠바이핸더 베기 100 J — AI 대 롱소드 판 가운데 · 위 10 % 값 언저리)', () => {
  const light = woundImpact({ energy: 25, mass: M.rapier, pass: true, taken: true }, C);
  const heavy = woundImpact({ energy: 100, mass: M.zweihander, taken: true }, C);
  assert.ok(light.stop < 0.01 && light.cam < 0.1 && light.sound < 0.02, JSON.stringify(light));
  assert.ok(heavy.stop >= 0.06 && heavy.stop <= 0.09 && heavy.cam > 1.5 && heavy.sound > 0.5, JSON.stringify(heavy));
});

test('칼끼리 부딪힘은 같은 무게 · 빠르기의 맞음보다 순하다 · 무거운 칼끼리 더 크게', () => {
  for (const vn of [4, 8, 12, 16, 30]) {
    const c = clashImpact({ vn, m1: M.longsword, m2: M.longsword, energyScale: STRIKE.energyScale }, C);
    const w = woundImpact({ energy: c.H, mass: M.longsword, taken: true }, C);
    assert.ok(c.stop <= w.stop && c.cam <= w.cam && c.sound <= w.sound && c.down === 0, `vn ${vn}`);
    assert.ok(c.stop <= C.stopMax && c.cam <= C.clashCam + 1e-12);
  }
  const ll = clashHeft(10, M.longsword, M.longsword, C, STRIKE.energyScale);
  const zl = clashHeft(10, M.zweihander, M.longsword, C, STRIKE.energyScale);
  const zf = clashHeft(10, M.zweihander, M.flamberge, C, STRIKE.energyScale);
  assert.ok(ll < zl && zl < zf);
  assert.ok(Math.abs(clashHeft(10, 1.6, 1.6, C, 2) - 0.5 * 0.8 * 100 * 2) < 1e-9, '같은 무게 둘: ½ μ vn² × energyScale (2μ = 그 무게 → 배율 1)');
});

test('멈칫 묶음: 더 긴 쪽만 (쌓지 않음) · 한 묶음 합 ≤ chainCap · chainGap 지나면 새 묶음', () => {
  const S = { left: 0, spent: 0, quiet: C.chainGap };
  const dt = 1 / 60;
  // 한 칼이 팔 → 몸통을 잇달아 벰: 멈칫이 끝나자마자 다음 멈칫 — 합이 chainCap 을 넘지 않는다
  let stopped = 0;
  stopGrant(S, 0.09, C);
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 6 || i === 9) stopGrant(S, 0.09, C);
    const f = stopTick(S, dt, C);
    assert.ok(f >= 0 && f <= 1);
    stopped += f * dt;
  }
  assert.ok(Math.abs(stopped - C.chainCap) < 1e-9, `멈춘 실제 시간 ${stopped}`);
  assert.ok(S.spent <= C.chainCap + 1e-9);
  // 느린 화면(0.1 s 한 장)에 짧은 멈칫 0.01 s: 그 화면의 1/10 만 멈칫 몫
  const W = { left: 0, spent: 0, quiet: C.chainGap };
  stopGrant(W, 0.01, C);
  assert.ok(Math.abs(stopTick(W, 0.1, C) - 0.1) < 1e-9);
  assert.equal(stopTick(W, 0.1, C), 0);
  // 겹친 멈칫: 짧은 것이 와도 남은 긴 것 그대로 · 긴 것이 오면 그만큼만
  const T = { left: 0, spent: 0, quiet: C.chainGap };
  stopGrant(T, 0.05, C);
  stopGrant(T, 0.02, C);
  assert.equal(T.left, 0.05);
  stopGrant(T, 0.08, C);
  assert.equal(T.left, 0.08);
  stopGrant(T, 0.5, C);
  assert.ok(T.left <= C.chainCap);
  // 쉼이 chainGap 을 넘으면 새 묶음: 다시 온전한 멈칫
  const U = { left: 0, spent: 0, quiet: C.chainGap };
  stopGrant(U, 0.1, C);
  for (let t = 0; t < 0.1 + C.chainGap + 0.05; t += dt) stopTick(U, dt, C);
  assert.equal(U.spent, 0);
  stopGrant(U, 0.07, C);
  assert.equal(U.left, 0.07);
  // 0 · 음수 · NaN 은 아무것도 안 함
  const V = { left: 0, spent: 0, quiet: 1 };
  for (const w of [0, -1, NaN, undefined]) stopGrant(V, w, C);
  assert.equal(V.left, 0);
});

test('카메라 흔들림 벽: 맞음 둘이 잇달아 와도 밀린 거리 ≤ camMaxOff · 한 번 밀림 위 끝(camCap)은 벽에 닿지 않음 · 안쪽 빠르기는 그대로', () => {
  // main.js 카메라 스프링과 같은 적분 (단단함 170 · 감쇠 13 · 60 fps)
  const run = (kicks, wall) => {
    const o = { x: 0, y: 0, z: 0 }, v = { x: 0, y: 0, z: 0 };
    let peak = 0;
    const h = 1 / 60;
    for (let i = 0; i < 90; i++) {
      for (const [at, s] of kicks) if (at === i) v.x += s;
      v.x += -170 * o.x * h; v.y += -170 * o.y * h; v.z += -170 * o.z * h;
      const d = Math.max(0, 1 - 13 * h);
      v.x *= d; v.y *= d; v.z *= d;
      o.x += v.x * h; o.y += v.y * h; o.z += v.z * h;
      if (wall) shakeWall(o, v, C.camMaxOff);
      peak = Math.max(peak, Math.hypot(o.x, o.y, o.z));
    }
    return peak;
  };
  const one = run([[0, C.camCap]], true);
  assert.ok(one < C.camMaxOff && Math.abs(one - run([[0, C.camCap]], false)) < 1e-12, `한 번 ${one}`);
  const twoFree = run([[0, C.camTaken], [5, C.camTaken]], false);
  const two = run([[0, C.camTaken], [5, C.camTaken]], true);
  assert.ok(twoFree > C.camMaxOff * 1.3, `벽 없으면 ${twoFree}`); // 10/27 브라우저 진짜 판: 149 J · 135 J 잇달아 13.7 cm
  assert.ok(two <= C.camMaxOff + 1e-12, `벽 ${two}`);
  const o = { x: 0.2, y: 0, z: 0 }, v = { x: -1, y: 0.5, z: 0 };
  assert.ok(shakeWall(o, v, 0.1));
  assert.ok(Math.abs(o.x - 0.1) < 1e-12 && v.x === -1 && v.y === 0.5, '안쪽 빠르기 그대로');
  const o2 = { x: 0.2, y: 0, z: 0 }, v2 = { x: 2, y: 0.5, z: 0 };
  shakeWall(o2, v2, 0.1);
  assert.ok(Math.abs(v2.x) < 1e-12 && v2.y === 0.5, '바깥쪽 빠르기만 없앰');
  assert.equal(shakeWall({ x: 0.01, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.1), false);
});

test('화면 · 소리만: 판정 · 물리 · AI · 시뮬 바탕은 impact_fx 를 읽지 않는다 · impact_fx 는 가져오는 것이 없다', () => {
  for (const f of ['src/combat.js', 'src/fighter.js', 'src/ai.js', 'src/skill.js', 'src/gun.js', 'src/secret_instant.js', 'tools/sim/harness_m.mjs']) {
    assert.ok(!/impact_fx|IMPACT_FX/.test(src(f)), f);
  }
  assert.ok(!/^\s*import\s/m.test(src('src/impact_fx.js')), 'impact_fx.js 는 순수 셈');
});

test('main.js: 멈칫은 addHitStop 한 곳으로만 들어가고 · 끄면 옛 식 · 멈칫은 화면 시간 배율만 바꾼다 (물리 스텝 길이 그대로)', () => {
  const m = src('src/main.js');
  const writes = m.match(/hitStop(\.left)?\s*=\s*Math\.max/g) || [];
  assert.equal(writes.length, 1, '옛 식(끔) 한 줄만 Math.max');
  assert.ok(/function addHitStop\(t\)\s*\{\s*if \(CONFIG\.IMPACT_FX\.on\) stopGrant\(hitStop, t, CONFIG\.IMPACT_FX\);/.test(m));
  assert.equal((m.match(/addHitStop\(/g) || []).length, 4, '정의 1 + 맞음 · 흘림 · 부딪힘');
  assert.ok(/scale = 1 - stopTick\(hitStop, dt, CONFIG\.IMPACT_FX\) \* \(1 - 0\.12\);/.test(m));
  assert.ok(/if \(CONFIG\.IMPACT_FX\.on\) shakeWall\(camShake\.o, camShake\.v, CONFIG\.IMPACT_FX\.camMaxOff\);/.test(m), '카메라 벽은 켬일 때만');
  // 물리 스텝은 늘 PHYSICS.timestep — 멈칫이 스텝 길이를 바꾸지 않는다
  assert.ok(/world\.step\(eventQueue, combat\.physicsHooks\)/.test(m));
  assert.ok(/acc \+= dt \* scale \* TEMPO;/.test(m));
  assert.ok(!/timestep\s*\*\s*scale/.test(m));
});

test('무게 소리 한 겹: 이미 있는 소리 조각만 · 무거울수록 크고 낮고 어둡게 · 곧장 뒤따른 더 센 것만 남김', async () => {
  const { Sound } = await import('../../src/sound.js');
  const s = Object.create(Sound.prototype);
  const evs = [];
  Object.assign(s, { _on: true, ctx: { currentTime: 0 }, useSamples: true, fleshBus: 'flesh', metalBus: 'metal', voices: [] });
  s.samples = { soft: [{ name: 'soft' }], punch: [{ name: 'punch' }] };
  s.pick = (n) => ({ name: n });
  s.event = (o) => {
    const ev = { ...o, layers: [], faded: false };
    ev.out = { gain: { setTargetAtTime: (v) => (ev.faded = v === 0) } };
    evs.push(ev);
    return ev;
  };
  s.layer = (ev, buf, o) => ev.layers.push({ name: buf.name, ...o });
  const lo = woundImpact({ energy: 40, mass: M.longsword }, C);
  const hi = woundImpact({ energy: 100, mass: M.zweihander }, C);
  s.heft(lo.sound, lo.x);
  s.ctx.currentTime = 1;
  s.heft(hi.sound, hi.x, { metal: true });
  assert.equal(evs.length, 2);
  const [a, b] = evs;
  assert.ok(b.gain > a.gain && b.bright < a.bright);
  assert.equal(a.bus, 'flesh');
  assert.equal(b.bus, 'metal');
  assert.deepEqual(a.layers.map((l) => l.name), ['thump', 'soft', 'punch']);
  assert.deepEqual(b.layers.map((l) => l.name), ['thump', 'soft', 'punch', 'clashSoft']);
  assert.ok(b.layers[0].rate < a.layers[0].rate * 0.95);
  // 0.06 s 안: 약한 것은 버림 · 센 것은 앞 겹을 끄고 냄
  s.ctx.currentTime = 1.03;
  s.heft(hi.sound * 0.5, hi.x);
  assert.equal(evs.length, 2);
  s.ctx.currentTime = 1.04;
  s.heft(C.sound.gain, 1);
  assert.equal(evs.length, 3);
  assert.ok(b.faded);
  // 아주 작은 것 · 꺼진 소리는 아무것도 안 냄
  s.ctx.currentTime = 3;
  s.heft(0.01, 0.1);
  s._on = false;
  s.heft(0.9, 1);
  assert.equal(evs.length, 3);
});
