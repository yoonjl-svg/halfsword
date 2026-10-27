// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토 — 10/22 사람 먼저 · docs/strike/italian_risoluto_2026-10-22.md):
//  덮음은 칼 모양(내 손 쪽 절반 ↔ 상대 칼끝 쪽 절반 가장 가까운 거리) · 덮인 채 나아가기 셈 · 창 · 두 번째 길(상대 박자) · 실제 몸에서 실행(탭 찌르기 · 상대 팔 늦춤 · 비기 배율 · 굳음) · AI 는 닫힘.
//  10/23 넓은 판정(기본 — 칼 어느 부위든 · 너그러움 0.2 s · 가슴 사이 조건 없음 · 다 붙음 · 상대 박자 켬) · 10/22 판(?risoWide=0 = OLD)은 그 판으로 시험.
//  10/24 런지(기본 — 운동학 찌르기 · 고노센 칼끝 빠르기 · 몸 미끄러짐 + 앞발 런지 · 팔 늦춤 0.6 · 굳음 0.6) · 10/23 탭 찌르기 판(?risoLunge=0 = TAP1023)은 그 판으로 시험.
//  node --test tools/sim/italian_risoluto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { coverDist, bladesNear, RisolutoWatch, lungeGap, lungeGapOk } from '../../src/italian_risoluto.js';
import { MEASURED, risolutoContact } from '../../src/weapon_measured.js'; // 10/25 이탈리아 간격 판 THRUST.itMeasure (old 기본 · contact · full — IT_MEASURE=…)
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { playerSecretDef, TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { iaiTipSpeed, stanceSpread } from '../../src/secret_instant.js';

const { SECRET } = CONFIG;
const rs = CONFIG.realS; // 표준 시간 (10/25 22:3x): 적힌 0.6 · 0.2 · 0.4 s 는 실제 초 — 게임 초 = × 1.1
const keep = (o, k, v, fn) => { const old = o[k]; o[k] = v; try { return fn(); } finally { o[k] = old; } };
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const withJ = (vals, fn) => { const J = CONFIG.JOINTS, old = {}; for (const k of Object.keys(vals)) (old[k] = J[k]), (J[k] = vals[k]); try { return fn(); } finally { Object.assign(J, old); } }; // 손목 값 (10/24 17:2x)
const OLD = { risolutoAnyPart: 0, risolutoGrace: 0, risolutoClosing: 1, risolutoClose: 0, risolutoBeat: 0, risolutoTouch: 0 }; // 10/22 판 (main.js ?risoWide=0 과 같은 값)
const HOLD1024 = { risolutoTouch: 0 }; // 10/24 판 창 규칙 — 이어짐 0.6 s 를 기다림 (main.js ?risoTouch=0 과 같은 값 · 10/25 칼끝 얽힘 창 전)
const TAP1023 = { risolutoLunge: 0, risolutoArmSlow: null, risolutoStiff: null }; // 10/23 탭 찌르기 판 (main.js ?risoLunge=0 과 같은 값)

// 가짜 몸 — 칼은 a(손 쪽 0) → b(칼끝 1) 선분
const blade = (a, b) => (t, out = new THREE.Vector3()) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
function fake({ foeA = [1.4, 1.03, 0.4], foeB = [0.2, 1.03, -0.4] } = {}) {
  const me = { armed: true, alive: true, stickX: 0, stickY: 1, skill: {}, stamina: {}, aiControlled: false, gap: 2, bladePoint: blade([0.3, 1, 0], [1.4, 1, 0]) };
  const foe = { armed: true, alive: true, skill: {}, stamina: {}, aiControlled: true, aiCtl: { mode: 'watch', phase: 'ready' }, bladePoint: blade(foeA, foeB) };
  me.foeDistance = () => me.gap;
  return { me, foe };
}
const tick = (W, f, n, step = -0.01) => { let r = null; for (let i = 0; i < n && !r; i++) { f.me.gap += step; r = W.tick(DT, true); } return r; };

test('덮음 거리 = 내 칼 손 쪽 절반 ↔ 상대 칼 칼끝 쪽 절반 (모양 — 닿음이 아님)', () => {
  // 상대 칼끝 쪽 절반(0.5 = [0.8, 1.03, 0] → 칼끝 [0.2, 1.03, −0.4])이 내 손 쪽 절반(x 0.3 → 0.85) 위 3 cm 를 엇갈려 지나감 → 0.03
  const { me, foe } = fake();
  assert.ok(Math.abs(coverDist(me, foe) - 0.03) < 1e-6);
  // 상대 칼끝 쪽이 내 칼 끝 쪽 절반 곁에만 있는 자리(내 약한 쪽) → 덮음 아님
  const weak = fake({ foeA: [2.4, 1.02, 0.4], foeB: [1.2, 1.02, -0.4] });
  assert.ok(coverDist(weak.me, weak.foe) > SECRET.risolutoCover);
  // 칼이 없으면 덮음 없음
  assert.equal(coverDist({ ...me, armed: false }, foe), Infinity);
  assert.equal(SECRET.risolutoCover, 0.15); // 사장님 10/25 21:0x '칼끼리 닿아 있거나 15cm 이내에' (전 0.07 — `?risoCover=0.07`)
});

test('10/22 판(?risoWide=0) 덮인 채 나아가기: 덮음 · 둘 다 안 휘두름 · 스틱 앞 · 가슴 사이 줄어듦이 risolutoHold 이어지면 창 (하나라도 빠지면 셈이 0)', () => withCfg(OLD, () => {
  const f = fake();
  const W = new RisolutoWatch(f.me, f.foe);
  assert.equal(SECRET.risolutoHold, rs(0.6));
  const n = Math.round(SECRET.risolutoHold / DT);
  assert.equal(tick(W, f, n - 2), null);
  const r = tick(W, f, 4);
  assert.equal(r?.path, 'hold');
  assert.ok(r.held >= SECRET.risolutoHold - 1e-9);
  assert.equal(W.held, 0); // 창을 열면 다시 셈
  // 가슴 사이가 안 줄어들면 (상대가 같이 물러남 · 맞붙어 멈춤) 셈이 안 쌓임
  const g = fake(); const W2 = new RisolutoWatch(g.me, g.foe);
  assert.equal(tick(W2, g, n + 10, 0), null); assert.equal(W2.held, 0);
  // 스틱이 옆이면 (앞 90° 부채꼴 밖) 안 쌓임
  const h = fake(); h.me.stickX = 1; h.me.stickY = 0.5; const W3 = new RisolutoWatch(h.me, h.foe);
  assert.equal(tick(W3, h, n + 10), null);
  // 내가 막기 단추를 누르거나 손을 휘두르면 안 쌓임
  for (const set of [(m) => { m.parryGuard = { held: true }; }, (m) => { m.skill.swinging = true; }, (m) => { m.skill.tap = {}; }]) {
    const k = fake(); set(k.me); const Wk = new RisolutoWatch(k.me, k.foe);
    assert.equal(tick(Wk, k, n + 10), null);
  }
  // 상대가 휘두르는 중(공격의 긋기 · 지나감)이면 안 쌓임
  const a = fake(); a.foe.aiCtl = { mode: 'attack', phase: 'strike' }; const Wa = new RisolutoWatch(a.me, a.foe);
  assert.equal(tick(Wa, a, n + 10), null);
}));

test('두 번째 길(상대 박자 — 10/23 기본 켬 · 10/22 판 위에서): 덮인 채 나아가던 중 상대가 칼을 내거나 덮음이 풀리면 곧장 창 · 내가 끊은 것 · 짧은 덮음은 아님', () => withCfg({ ...OLD, risolutoBeat: SECRET.risolutoBeat }, () => {
  assert.equal(SECRET.risolutoBeat, 1);
  const n = Math.round(0.3 / DT);
  const run = (beat, after) => keep(SECRET, 'risolutoBeat', beat, () => {
    const f = fake(); const W = new RisolutoWatch(f.me, f.foe);
    assert.equal(tick(W, f, n), null);
    after(f);
    f.me.gap -= 0.01;
    return W.tick(DT, true);
  });
  const foeSwing = (f) => { f.foe.aiCtl = { mode: 'attack', phase: 'strike' }; };
  const uncover = (f) => { f.foe.bladePoint = blade([2.2, 1.6, 0.4], [0.9, 1.6, 0.4]); };
  assert.equal(run(0, foeSwing), null); // 끔
  assert.deepEqual([run(1, foeSwing)?.path, run(1, foeSwing)?.why], ['beat', 'foeSwing']);
  assert.deepEqual([run(1, uncover)?.path, run(1, uncover)?.why], ['beat', 'uncover']);
  assert.equal(run(1, (f) => { f.me.stickY = 0; }), null); // 내가 스틱을 놓음
  assert.equal(run(1, (f) => { f.me.skill.swinging = true; }), null); // 내가 휘두름
  // risolutoBeatMin(0.2 반응) 보다 짧은 덮음 뒤에는 안 열림
  keep(SECRET, 'risolutoBeat', 1, () => {
    const f = fake(); const W = new RisolutoWatch(f.me, f.foe);
    tick(W, f, Math.round(0.1 / DT)); foeSwing(f); f.me.gap -= 0.01;
    assert.equal(W.tick(DT, true), null);
  });
}));

test('10/23 넓은 판정 (사장님 \'칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게\'): 기본값 · 칼 어느 부위든 · 끊김 너그러움 0.2 s(모아서 셈) · 가슴 사이 조건 없음 (이어짐 창 — 10/24 판 ?risoTouch=0 위에서)', () => {
  assert.deepEqual([SECRET.risolutoAnyPart, SECRET.risolutoGrace, SECRET.risolutoClosing, SECRET.risolutoClose, SECRET.risolutoBeat, SECRET.risolutoHold], [1, rs(0.2), 0, 1, 1, rs(0.6)]);
  withCfg(HOLD1024, () => {
    const n = Math.round(SECRET.risolutoHold / DT) + 4;
    // 칼 어느 부위든: 손 쪽 ↔ 칼끝 쪽은 아니지만(내 약한 쪽 곁) 실제로 칼끼리 맞닿음 → 덮음
    const weak = () => { const f = fake({ foeA: [2.4, 1.02, 0.4], foeB: [1.2, 1.02, -0.4] }); f.me.feel = { touching: true }; return f; };
    const w1 = weak(); assert.equal(tick(new RisolutoWatch(w1.me, w1.foe), w1, n)?.path, 'hold');
    const w2 = weak(); assert.equal(keep(SECRET, 'risolutoAnyPart', 0, () => tick(new RisolutoWatch(w2.me, w2.foe), w2, n)), null);
    // 가슴 사이가 안 줄어도(맞붙어 멈춤 · 상대가 같이 물러남) 스틱 앞이면 셈
    const g = fake(); assert.equal(tick(new RisolutoWatch(g.me, g.foe), g, n, 0)?.path, 'hold');
    // 너그러움: 0.1 s 떨어졌다 다시 붙으면 이어서 셈(떨어진 동안은 안 셈) · 0.3 s 떨어지면 처음부터 (상대 박자 끔으로 따로 봄)
    const blink = (gapS) => keep(SECRET, 'risolutoBeat', 0, () => {
      const f = fake(); const W = new RisolutoWatch(f.me, f.foe), on = f.foe.bladePoint;
      assert.equal(tick(W, f, Math.round(rs(0.4) / DT)), null);
      f.foe.bladePoint = blade([2.2, 1.6, 0.4], [0.9, 1.6, 0.4]); // 칼이 떨어짐
      assert.equal(tick(W, f, Math.round(rs(gapS) / DT)), null);
      f.foe.bladePoint = on;
      let k = 0, r = null;
      for (; k < n && !r; k++) { f.me.gap -= 0.01; r = W.tick(DT, true); }
      return { r, k };
    });
    const b1 = blink(0.1); assert.equal(b1.r?.path, 'hold'); assert.ok(b1.k <= Math.round(rs(0.2) / DT) + 2, `이어서 셈 ${b1.k}`); // 0.4 s 모은 뒤 0.2 s 더
    const b3 = blink(0.3); assert.equal(b3.r?.path, 'hold'); assert.ok(b3.k >= Math.round(rs(0.6) / DT) - 1, `처음부터 ${b3.k}`);
    // 상대 박자 + 너그러움: 덮음이 풀리면 너그러움(0.2 s)이 지난 뒤 창 · 상대가 칼을 내면 곧장
    const f = fake(); const W = new RisolutoWatch(f.me, f.foe);
    tick(W, f, Math.round(rs(0.3) / DT));
    f.foe.bladePoint = blade([2.2, 1.6, 0.4], [0.9, 1.6, 0.4]);
    let k = 0, r = null;
    for (; k < 60 && !r; k++) r = W.tick(DT, true);
    assert.deepEqual([r?.path, r?.why], ['beat', 'uncover']); assert.ok(Math.abs(k * DT - SECRET.risolutoGrace) < 2 * DT, `${k}`);
  });
});

test('사람 길만: 이탈리아 무기 사람 비기 = 거침없이 나아가 찌르기 · ?itSecret=contratempo = 옛 엇박 찌르기 · AI 이탈리아 비기는 옛 것 그대로 닫힘', () => {
  assert.ok(SECRET.openSchools.includes('italian'));
  assert.ok(!SECRET.aiOpenSchools.includes('italian'));
  assert.equal(playerSecretDef('italian').name, 'andareRisoluto');
  assert.equal(playerSecretDef('italian').nameKo, '안다레 리솔루토');
  assert.equal(TRADITIONS.italian.secret.name, 'passataContratempo'); // AI 가 보는 칸 그대로
  assert.equal(keep(SECRET, 'itSecret', 'contratempo', () => playerSecretDef('italian').name), 'passataContratempo');
  assert.equal(playerSecretDef('japanese'), TRADITIONS.japanese.secret);
  const C = CHARACTERS_BY_ID.tome;
  for (const w of ['rapier', 'dartagnan', 'balisarda', 'pappenheimer']) {
    const g = newRound({ weapon: w, weapon2: C.weapon, seed: 3, difficulty: C.ai.level, persona: { ...C.ai.persona, proficiency: { italian: 5 } } });
    try {
      assert.equal(playerSecretOf(g.player)?.name, 'andareRisoluto', w);
      assert.equal(new PlayerSecretWatch(g.player, g.enemy).riso != null, true, w);
      assert.equal(g.ai.secret, null, `${w} AI 이탈리아 숙련도 5 도 비기 없음`);
    } finally { g.world.free(); }
  }
});

test('10/23 판(?risoLunge=0) 실제 몸 실행: 탭 찌르기 하나 · 기력은 비기 값 하나 · 상대 팔 늦춤(흘림 장치 0.4 s) · 찌르는 동안 비기 배율 · 패시브 곧은 선 안 실림 · 끝나면 굳음 0.4 s', () => withCfg(TAP1023, () => {
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 1.8, seed: 9 });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    for (let i = 0; i < 30; i++) g.step();
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    p.schoolPassive.school = 'italian'; // 패시브 곧은 선 켬 (비기엔 안 실려야)
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
    const spent0 = p.stamina.spent.attack, secret0 = p.stamina.spent.secret;
    const o = ps.fire();
    assert.equal(o.S.name, 'andareRisoluto');
    assert.equal(p.skill.secret(o), true);
    assert.ok(p.skill.tap, '탭 찌르기');
    assert.equal(p.skill.sec.stage, 'riso');
    assert.equal(p.stamina.spent.attack, spent0, '찌르기 값은 따로 안 냄');
    assert.ok(p.stamina.spent.secret > secret0 || !CONFIG.STAMINA.on, '비기 값 하나');
    assert.ok(e.flowRecovery && e.flowRecovery.duration === CONFIG.FLOW_RECOVERY.seconds, '상대 팔 늦춤 0.4 s');
    assert.equal(p.skill.secretStats.andareRisoluto.armSlow, 1);
    let sawPower = false, sawTip = false;
    for (let i = 0; i < Math.round(1.5 / DT) && p.skill.sec; i++) {
      g.step();
      if (p.skill.sec?.stage === 'riso' && p.skill.tap) {
        sawPower ||= p.powerMul === SECRET.power && p.secretHit === SECRET.hitMul;
        sawTip ||= p.schoolPassive.thrustTarget() != null;
      }
      if (p.skill.sec?.stage === 'stiff') {
        assert.equal(p.skill.sec.stiffT, SECRET.stiff.italian);
        assert.equal(p.powerMul, 1); assert.equal(p.secretHit, 1);
      }
    }
    assert.ok(sawPower, '찌르는 동안 서보 힘 · 판정 배율 = SECRET.power · hitMul');
    assert.equal(sawTip, false, '곧은 선은 비기에 안 실림');
    assert.equal(p.skill.sec, null, '굳음 뒤 끝');
    assert.equal(SECRET.stiff.italian, rs(0.4));
  } finally { g.world.free(); }
}));


// 10/24 런지 — 상대는 멈춤 · 판 시작 발 묶임(ARENA.startHold) 뒤 · 창을 열어 탭 하나
// 10/24 13:2x · 13:4x 간격 조건: 런지는 가슴 사이 ≥ 맞닿기 거리(레이피어 1.54 · 달타냥 1.39 m)에서만 — 시험 판은 그 밖 2.2 m 에서 연다
function lungeRun(w, { gap = 2.2, seed = 9, foeW = 'longsword', cfg = {} } = {}) {
  return withCfg(cfg, () => {
    const g = newRound({ weapon: w, weapon2: foeW, gap, seed });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    try {
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) g.step();
      const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
      const ps = new PlayerSecretWatch(p, e);
      ps.openWindow({ ev: 'risoluto', path: 'close', held: 0.6 });
      const out = { w, gap0: p.foeDistance(), clinch: p.swordArt.measure.clinch, gon: iaiTipSpeed(p), spent0: p.stamina.spent.attack, secret0: p.stamina.spent.secret, tipV: 0, stiffT: null, stiffSteps: 0, held: false, drew: false, gaitReq: null, spread0: stanceSpread(p), standAll: true, tilt: 0, wounds: [] };
      const pel0 = new THREE.Vector3().copy(p.bodies.pelvis.translation());
      g.onWound = (a, v, r) => { if (a === p) out.wounds.push(r); };
      const o = ps.fire();
      out.name = o.S.name;
      out.ok = p.skill.secret(o);
      out.stage0 = p.skill.sec?.stage; out.lunge = !!p.skill.sec?.lunge; out.tap = !!p.skill.tap;
      out.req = p.iaiReq ? { ...p.iaiReq, moves: p.iaiReq.moves.map((m) => ({ ...m })) } : null;
      out.armSlow = e.flowRecovery?.duration ?? null; out.lungeT = p.lungeT ?? 0;
      out.spentAttack = p.stamina.spent.attack - out.spent0; out.spentSecret = p.stamina.spent.secret - out.secret0;
      let prev = p.bladePoint(1, new THREE.Vector3());
      for (let i = 0; i < Math.round(1.5 / DT) && p.skill.sec; i++) {
        const comboBefore = p.iai?.kind === 'combo';
        g.step();
        const tip = p.bladePoint(1, new THREE.Vector3());
        if (comboBefore) out.tipV = Math.max(out.tipV, tip.distanceTo(prev) / DT);
        prev = tip;
        out.gaitReq ??= p.gait?.req ? { kind: p.gait.req.kind, fwd: p.gait.req.fwd, draw: !!p.gait.req.draw, push: p.gait.req.push ?? 1, accel: !!p.gait.req.accel } : null;
        if (p.skill.sec?.stage === 'stiff') {
          out.stiffT = p.skill.sec.stiffT; out.stiffSteps++;
          out.held ||= p.iaiHoldT > 0 && p.skill.thrustPose.w === 1;
          out.phase = p.skill.secretPhase;
          out.res ??= p.skill.sec.lungeRes;
        }
        out.drew ||= !!p.gait?.drawPending || p.gait?.legs?.F?.kind === 'draw' || p.gait?.legs?.B?.kind === 'draw';
        out.standAll &&= p.state === 'stand';
        const ch = p.bodies.chest.translation(), pl = p.bodies.pelvis.translation();
        out.tilt = Math.max(out.tilt, (Math.atan2(Math.hypot(ch.x - pl.x, ch.z - pl.z), ch.y - pl.y) * 180) / Math.PI);
      }
      const pl = p.bodies.pelvis.translation();
      out.pelMove = Math.hypot(pl.x - pel0.x, pl.z - pel0.z);
      out.end = p.skill.sec;
      // 10/24 14:0x 되돌아오기: 굳음이 끝난 뒤 · 몸이 다 실리면 앞발을 뒤로 거둠 (1 s 더 보며 그 걸음 · 두 발 간격 · 가슴 사이)
      out.spreadMax = stanceSpread(p);
      out.gapLunge = p.foeDistance();
      for (let i = 0; i < Math.round(1.0 / DT); i++) {
        g.step();
        out.recReq ??= p.gait?.req && p.gait.req.fwd < 0 ? { kind: p.gait.req.kind, fwd: p.gait.req.fwd, accel: !!p.gait.req.accel } : null;
        out.spreadMax = Math.max(out.spreadMax ?? 0, out.recReq ? 0 : stanceSpread(p) ?? 0);
        out.standAll &&= p.state === 'stand';
      }
      out.recovered = p.lungeRecovered ?? null;
      out.spreadEnd = stanceSpread(p);
      out.gapEnd = p.foeDistance();
      return out;
    } finally { g.world.free(); }
  });
}

test('10/24 런지 값 (사장님 \'런지로 진행해. 단 런지 동작이 고노센처럼 빠르게 나가야 의미가 있어. 상대 팔 늦어지는 효과는 0.6초 내 경직도 0.6초\')', () => {
  assert.equal(SECRET.risolutoLunge, 1);
  assert.equal(SECRET.risolutoShare, 1); // 고노센 칼끝 빠르기 그대로
  assert.equal(SECRET.risolutoArmSlow, rs(0.6));
  assert.equal(SECRET.risolutoStiff, rs(0.6));
  assert.equal(SECRET.hitMul, 1.3); // 판정 배율 그대로 (사장님 지시 — 바꾸지 않음)
  // 걸음은 있던 수: 몸 미끄러짐 = 고노센 발도 iaiStep · 앞발 = 이탈리아 런지 italianStep · 디딘 뒤 뒷발 끌어붙임
  // 10/24 14:0x: 디딘 뒤 뒷발 끌어붙임(draw) 대신 앞발을 뒤로 거둠(recover — 걸음 시간 0.4 사다리) · 걸음 동안 몸 따라감 배율 stepPush(엇박 찌르기 런지와 같은 2.0) · 몸 가속 한도 × burstAccel(accel)
  assert.deepEqual(SECRET.risolutoStep, { slide: 'iaiStep', foot: 'italianStep', draw: 0, room: 0, push: 'stepPush', accel: 1, recover: 1, recoverT: 0.4 }); // room 1 = 앞발도 clinch 밖까지만 (?risoRoom=1)
  assert.equal(SECRET.iaiStep, 0.6); assert.equal(SECRET.italianStep, 0.9);
  // 다른 곳 값은 그대로 (흘림 팔 늦춤 · 이탈리아 비기 굳음 — 10/23 판 · AI 칸)
  assert.equal(CONFIG.FLOW_RECOVERY.seconds, rs(0.4)); assert.equal(SECRET.stiff.italian, rs(0.4));
});

test('10/24 런지 실제 몸: 탭 하나 = 운동학 찌르기(고노센 칼끝 빠르기) · 몸 미끄러짐 + 앞발 런지 0.9 m · 상대 팔 늦춤 0.6 s · 굳음 0.6 s(끝 자세 붙잡음) · 굳음 뒤 앞발을 뒤로 거둠(14:0x) · 넘어지지 않음', () => {
  for (const w of ['rapier', 'dartagnan']) {
    const o = lungeRun(w);
    assert.equal(o.name, 'andareRisoluto');
    assert.equal(o.ok, true, w);
    assert.equal(o.stage0, 'instant', `${w} 런지는 운동학 틀`);
    assert.equal(o.lunge, true);
    assert.equal(o.tap, false, '탭 찌르기 아님');
    const m = o.req?.moves?.[0];
    assert.ok(o.req?.combo && m?.lunge && m.kind === 'thrust', '운동학 찌르기 한 수');
    assert.equal(o.req.share, SECRET.risolutoShare);
    assert.equal(o.req.hitMul, SECRET.hitMul);
    assert.equal(o.req.hold, rs(0.6));
    assert.deepEqual([m.step.fwd, m.step.foot, !!m.step.draw, !!m.step.room, m.step.push, !!m.step.accel], [SECRET.iaiStep, SECRET.italianStep, false, false, SECRET.stepPush, true]);
    assert.equal(m.glide, true);
    assert.equal(o.armSlow, rs(0.6), '상대 두 팔 늦춤 0.6 s');
    assert.ok(o.lungeT > 0, '런지 자세 (SECRET.stance.lunge)');
    assert.equal(o.spentAttack, 0, '찌르기 값은 따로 안 냄');
    assert.ok(o.spentSecret > 0 || !CONFIG.STAMINA.on, '비기 값 하나');
    // 고노센처럼 빠르게: 길 빠르기 = 같은 칼 고노센 칼끝 빠르기 × 1 · 찌르는 토막 칼끝(월드 — 쓸린 자리 조각) 가장 빠름 ≥ 고노센의 0.9 · 평균 ≥ 0.8 (몸 미끄러짐 몫을 길 시간에 넣어 늘임 — 연환 그때 계산 길과 같음)
    assert.ok(Math.abs(o.res.v - SECRET.risolutoShare * o.gon) < 1e-6, `${w} 길 빠르기 ${o.res.v}`);
    assert.ok(o.res.tipVmax >= 0.9 * o.gon && o.res.tipV >= 0.8 * o.gon, `${w} 칼끝 ${o.res.tipV.toFixed(1)} · 최고 ${o.res.tipVmax.toFixed(1)} / 고노센 ${o.gon.toFixed(1)}`);
    assert.deepEqual(o.gaitReq, { kind: 'lunge', fwd: SECRET.italianStep, draw: false, push: SECRET.stepPush, accel: true }, `${w} 앞발 런지 걸음`);
    assert.equal(o.stiffT, rs(0.6), '굳음 0.6 s');
    assert.ok(Math.abs(o.stiffSteps * DT - rs(0.6)) < 3 * DT, `${w} 굳음 ${(o.stiffSteps * DT).toFixed(3)} s`);
    assert.equal(o.phase, 'stiff'); // main.js 가 칼 입력 · 스틱 · 막기 단추를 막는다
    assert.equal(o.held, true, '굳음 동안 끝 자세 붙잡음');
    assert.equal(o.drew, false, `${w} 뒷발 끌어붙임 없음 (14:0x)`);
    // 되돌아오기: 굳음 뒤 앞발을 뒤로 거둠 — 같은 다리 lunge 걸음 · 뒤로(fwd 음수) · 몸 가속 · 두 발 간격이 런지 전 보폭 쪽으로 · 가슴 사이가 다시 벌어짐
    assert.ok(o.recovered && o.recovered.back > 0, `${w} 앞발 거둠 ${JSON.stringify(o.recovered)}`);
    assert.ok(o.recReq && o.recReq.kind === 'lunge' && o.recReq.fwd < 0 && o.recReq.accel, `${w} 거두는 걸음 ${JSON.stringify(o.recReq)}`);
    assert.ok(o.spreadEnd < o.spreadMax - 0.2, `${w} 두 발 간격 ${o.spreadMax?.toFixed(2)} → ${o.spreadEnd?.toFixed(2)} (런지 전 ${o.spread0?.toFixed(2)})`);
    // 가슴 사이가 다시 벌어짐 — 10/24 17:2x 팔꿈치 돌림 · 손목 교정을 켠 판은 이 맞닿은 판(런지 끝 가슴 사이 0.4 m)에서 1 s 안에 안 벌어진다:
    //  docs/strike/wrist_audit_2026-10-24.md §9 에 숫자와 함께 여쭘 (값은 안 고침) → 이 줄만 옛 손목 판으로 본다 (거둠 걸음 · 두 발 간격은 위에서 새 판으로)
    const ow = withJ({ elbowSwivel: 0, wristGuard: 0 }, () => lungeRun(w));
    assert.ok(ow.gapEnd > ow.gapLunge, `${w} 옛 손목 판 가슴 사이 ${ow.gapLunge.toFixed(2)} → ${ow.gapEnd.toFixed(2)}`);
    assert.equal(o.standAll, true, `${w} 넘어지지 않음`);
    assert.ok(o.tilt < 35, `${w} 몸통 기울기 ${o.tilt.toFixed(1)}°`);
    assert.ok(o.pelMove > 0.2, `${w} 몸이 앞으로 ${o.pelMove.toFixed(2)} m`);
    assert.ok(o.res?.ok && o.res.lunge, '런지 결과');
    assert.equal(o.end, null, '굳음 뒤 끝');
  }
});

test('10/24 런지는 멈춘 상대를 칼 축으로 찌른다 (찌르기 상처) · 런지를 끄면(?risoLunge=0) 10/23 탭 찌르기 그대로', () => {
  const o = lungeRun('rapier');
  assert.equal(o.res.hit, true);
  assert.ok(o.wounds.some((r) => r.type === 'stab'), `찌르기 상처 ${o.wounds.map((r) => r.type)}`);
  // ?risoRoom=1: 앞발 걸음을 미끄러진 뒤 가슴 사이 − clinch 까지만 (가슴 사이 1.8 m → 미끄러짐 뒤 맞닿기 → 앞발은 맞닿기 − clinch 안쪽)
  const r = lungeRun('rapier', { cfg: { risolutoStep: { ...SECRET.risolutoStep, room: 1 } } });
  assert.ok(r.res.foot > 0 && r.res.foot < SECRET.italianStep, `앞발 ${r.res.foot}`);
  assert.ok(r.res.foot <= r.gap0 - r.res.slide - r.clinch + 1e-6, `앞발 ${r.res.foot} · 가슴 사이 ${r.gap0} · 미끄러짐 ${r.res.slide}`);
  const t = lungeRun('rapier', { cfg: TAP1023 });
  assert.equal(t.stage0, 'riso');
  assert.equal(t.tap, true);
  assert.equal(t.armSlow, CONFIG.FLOW_RECOVERY.seconds);
  assert.equal(t.stiffT, SECRET.stiff.italian);
});

test('10/25 21:0x 공격하면 발동 (사장님 \'찌르기(탭)로 발동 -> 공격하면 발동\'): 창 안의 끌기도 비기 · 내 휘두름이 열린 창을 0.6 s 안에 닫지 않음 · ?risoTap=1 · ?secretHold=0 = 전(끌기는 보통 베기 · 베기를 시작하면 창이 닫힘)', () => {
  assert.equal(SECRET.risolutoTap, 0);
  assert.equal(playerSecretDef('italian').do.tapOnly, false); // main.js secSwipe — 끌기도 비기 입력
  withCfg({ risolutoTap: 1 }, () => assert.equal(playerSecretDef('italian').do.tapOnly, true)); // 전: 탭만
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 1.8, seed: 9 });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    g.step();
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
    p.skill.swinging = true;
    ps.update(DT, false);
    assert.ok(ps.open, '창 지킴 — 내 휘두름(끌기)이 창을 닫지 않음');
    // 끌기로 낸 비기 = 탭과 같은 런지 (skill.secret 은 입력 종류를 보지 않음 — o.dir 만 다름)
    p.skill.swinging = false;
    const o = ps.fire();
    o.dir = [0.05, -0.02];
    assert.equal(p.skill.secret(o), true);
    assert.ok(p.skill.sec?.risoluto && p.skill.sec.lunge, '런지');
    // 전(?secretHold=0): 베기를 시작하면 창이 닫힘
    withCfg({ secretHold: 0 }, () => {
      const ps2 = new PlayerSecretWatch(p, e);
      ps2.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
      p.skill.swinging = true;
      ps2.update(DT, false);
      assert.equal(ps2.open, null);
    });
  } finally { g.world.free(); }
});

test('다 붙음 창(risolutoClose — 10/23 기본 켬: 맞닿기 거리 밖에서 안으로 든 순간 · 덮인 채 나아가기 한 번에 한 번 · 시간 조건 없음) · 시험 스위치(기본 끔) · 칼을 대지 않는 덮음(risolutoLine — 겨눔 곧은 선 12° 안 · 강한 쪽이 상대 칼끝 → 내 가슴 줄 위)', () => {
  assert.equal(SECRET.risolutoClose, 1); // 10/23 기본 켬
  assert.equal(SECRET.risolutoLine, 0);
  // 다 붙음: 1.6 m 에서 0.01 m 씩 다가감 · 맞닿기 1.5 m → 1.5 를 넘는 스텝에 창 (0.6 s 전) · 안에 머무는 동안 다시 안 열림 (밖으로 나갔다 들어와야) — 10/24 판(?risoTouch=0) 위에서 (칼끝 얽힘 창이 첫 스텝에 먼저 염)
  withCfg({ ...HOLD1024, risolutoClose: 1 }, () => {
    const f = fake(); f.me.gap = 1.6; f.me.swordArt = { measure: { contact: 1.5 } };
    const W = new RisolutoWatch(f.me, f.foe);
    const r = tick(W, f, 30);
    assert.equal(r?.path, 'close'); assert.ok(r.held < SECRET.risolutoHold);
    assert.equal(tick(W, f, 20), null, '들어오는 순간 한 번');
    f.me.gap = 1.6; W.tick(DT, true); // 밖으로 나감 (같은 덮인 채 나아가기 — 한 번에 한 번이라 안 열림)
    assert.equal(tick(W, f, 20), null, '같은 덮인 채 나아가기에서는 한 번');
    f.me.gap = 1.6; f.me.stickY = 0; W.tick(DT, true); f.me.stickY = 1; // 스틱을 놓아 끝내고 밖에서 다시
    assert.equal(tick(W, f, 20)?.path, 'close', '새 덮인 채 나아가기로 다시 들어오면 또');
  });
  // 줄 막기: 칼끼리는 멀지만(덮음 거리 > 0.07) 내 칼끝이 상대 가슴을 겨누고 강한 쪽이 상대 칼끝 → 내 가슴 줄 위
  const mk = () => {
    const f = fake({ foeA: [2.0, 1.4, 0.5], foeB: [1.2, 1.0, 0.1] });
    f.me.bodies = { chest: { translation: () => ({ x: 0, y: 1, z: 0 }) } };
    f.foe.bodies = { chest: { translation: () => ({ x: 2.0, y: 1, z: 0 }) } };
    return f;
  };
  const a = mk();
  assert.ok(coverDist(a.me, a.foe) > SECRET.risolutoCover);
  const n = Math.round(SECRET.risolutoHold / DT) + 4;
  assert.equal(withCfg(OLD, () => tick(new RisolutoWatch(a.me, a.foe), a, n)), null, '끔이면 덮음 아님 (10/22 판 — 넓은 판정은 칼끼리 거리로 따로 봄)');
  withCfg({ ...OLD, risolutoLine: 1 }, () => {
    const b = mk();
    assert.equal(tick(new RisolutoWatch(b.me, b.foe), b, n)?.path, 'hold');
    const c = mk(); c.foe.bodies.chest.translation = () => ({ x: 2.0, y: 1, z: 0.8 }); // 칼끝이 상대 가슴을 안 겨눔 (≈ 22°)
    assert.equal(tick(new RisolutoWatch(c.me, c.foe), c, n), null);
  });
});

test('10/24 13:2x 런지 간격 조건 (사장님 \'그럼 오히려 간격이 약간 있어야 쓸 수 있게 해 너무 가까우면 못쓰게\' · 13:4x \'맞닿는 거리만 막기\'): 최소 간격 = 맞닿기 거리 · 가까우면 창이 안 뜸 · 뜬 창은 닫힘 · 그때 탭은 비기가 아님', () => {
  assert.equal(SECRET.risolutoGap, 1);
  const ctx = { ev: 'risoluto', path: 'hold', held: 0.6 };
  const at = (w, gap, fn) => {
    const g = newRound({ weapon: w, weapon2: 'longsword', gap, seed: 9 });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    try {
      g.step();
      const ps = new PlayerSecretWatch(p, e);
      ps.riso.tick = () => ctx; // 창 조건이 찬 스텝 (덮인 채 나아가기 셈은 위 시험들)
      return fn(p, ps, g);
    } finally { g.world.free(); }
  };
  // 최소 간격 = 무기 실측 맞닿기 거리 measure.contact (13:4x 대안 ③ '맞닿는 거리만 막기' — 13:2x 첫 식 clinch + 앞발은 버림) — 새 수 없음
  // 'contact' 판(맞닿음만 찌르기 잣대 값)은 리솔루토만 지금 맞닿음 그대로(risolutoContact) · 'full' 판은 새 맞닿음 1.72 · 1.64 를 따름
  for (const w of ['rapier', 'dartagnan', 'balisarda', 'pappenheimer']) at(w, 2.5, (p) => assert.equal(lungeGap(p), risolutoContact(w) ?? p.swordArt.measure.contact, w));
  const C = CONFIG.THRUST.itMeasure === 'full' ? { rapier: 1.72, dartagnan: 1.64 } : { rapier: 1.54, dartagnan: 1.39 };
  at('rapier', 2.5, (p) => assert.ok(Math.abs(lungeGap(p) - C.rapier) < 0.01, `레이피어 ${lungeGap(p)}`));
  at('dartagnan', 2.5, (p) => assert.ok(Math.abs(lungeGap(p) - C.dartagnan) < 0.01, `달타냥 ${lungeGap(p)}`));
  // 가까움(1.3 m — 맞닿기 1.54 안): 창 조건이 차도 창이 안 뜸 (금색 '!' 없음) · 그 밖(2.4 m): 뜸
  at('rapier', 1.3, (p, ps) => {
    assert.equal(lungeGapOk(p), false);
    ps.risoTick(DT, false);
    assert.equal(ps.open, null, '가까우면 창 없음');
    assert.equal(ps.riso.gapBlocked, 1);
    // 간격 조건 끔(?risoGap=0) = 12:1x 판 — 가까워도 뜸 · 10/23 탭 찌르기 판(?risoLunge=0)도 간격 조건 없음
    withCfg({ risolutoGap: 0 }, () => { ps.risoTick(DT, false); assert.ok(ps.open, '간격 조건 끔'); ps.open = null; });
    withCfg(TAP1023, () => { assert.equal(lungeGapOk(p), true); ps.risoTick(DT, false); assert.ok(ps.open, '10/23 판'); ps.open = null; });
  });
  // 10/25 21:0x 창 지킴: 창이 열린 뒤 맞닿기 거리 안(1.3 m)으로 들어와 낸 런지 = 몸 미끄러짐 0 (comboMoveStart clamp — 음수 없음) · 앞발 걸음 · 넘어지지 않음
  at('rapier', 1.3, (p, ps, g) => {
    ps.riso.tick = () => null;
    ps.openWindow(ctx);
    ps.risoTick(DT, false);
    assert.ok(ps.open, '지킴');
    const o = ps.fire();
    assert.ok(o, '지키는 동안 비기');
    assert.equal(p.skill.secret(o), true);
    let res = null, minSlide = Infinity, maxSlide = -Infinity;
    g.before = () => ps.update(DT, !!p.skill.sec);
    for (let i = 0; i < Math.round(2 / DT) && !res; i++) {
      g.step();
      const sl = p.iai?.slide?.slide;
      if (sl != null) (minSlide = Math.min(minSlide, sl)), (maxSlide = Math.max(maxSlide, sl));
      res = p.skill.sec?.lungeRes ?? null;
    }
    assert.ok(res?.lunge, '런지 결과');
    assert.ok(Math.abs(res.slide) <= 1e-3, `몸 미끄러짐 ${res.slide}`);
    assert.ok(!(minSlide < 0) && !(maxSlide > 1e-3), `미끄러짐 ${minSlide} ~ ${maxSlide}`);
    assert.equal(p.state, 'stand');
  });
  at('rapier', 2.4, (p, ps) => {
    assert.equal(lungeGapOk(p), true);
    ps.risoTick(DT, false);
    assert.equal(ps.open?.ctx?.path, 'hold', '간격이 있으면 창');
    // 10/25 21:0x 창 지킴(기본 SECRET.secretHold): 창이 뜬 뒤 가까워져도 playerWindow 초는 열림 · 그 탭은 비기
    p.foeDistance = () => 1.3;
    ps.riso.tick = () => null;
    ps.risoTick(DT, false);
    assert.ok(ps.open, '창 지킴 — 가까워져도 열림');
    assert.equal(ps.riso.gapHeld, 1);
    assert.equal(ps.riso.gapClosed ?? 0, 0);
    assert.ok(ps.fire(), '지키는 동안 탭 = 비기');
    // 전(?secretHold=0): 창이 뜬 뒤 가까워지면 닫힘 (그때의 탭은 보통 탭 찌르기 — 창이 없으니 main.js 가 skill.thrust)
    withCfg({ secretHold: 0 }, () => {
      ps.openWindow(ctx);
      ps.risoTick(DT, false);
      assert.equal(ps.open, null, '가까워지면 창 닫힘');
      assert.equal(ps.riso.gapClosed, 1);
      // 같은 스텝 안의 탭(창은 아직 열림 · 간격은 모자람): fire() = null → 비기 아님
      ps.openWindow(ctx);
      assert.equal(ps.fire(), null);
      assert.equal(ps.open, null);
      assert.equal(p.skill.secret(null), false);
    });
  });
});

test('10/25 칼끝 얽힘 창 (사장님 \'칼끝이 얽히자마자 그 순간부터 쓸 수 있게\'): 칼끝끼리 닿은 첫 스텝에 곧장 창 · 한 번 묶임에 한 번 · 휘두름 · 스틱은 그대로 막음 · ?risoTouch=0 = 10/24 판(0.6 s 기다림)', () => {
  assert.equal(SECRET.risolutoTouch, 1);
  // 칼끝 ↔ 칼끝: 상대 칼끝(1.45, 1, 0.03)이 내 칼끝(1.4, 1, 0) 곁 6 cm · 손 쪽 ↔ 칼끝 쪽 덮음은 아님 (칼끼리 어느 부위든만)
  const tipTip = () => fake({ foeA: [2.6, 1.0, 0.0], foeB: [1.45, 1.0, 0.03] });
  const a = tipTip();
  assert.ok(coverDist(a.me, a.foe) > SECRET.risolutoCover, '덮음 아님');
  const Wa = new RisolutoWatch(a.me, a.foe);
  const r = Wa.tick(DT, true);
  assert.equal(r?.path, 'touch', '첫 스텝에 창');
  assert.ok(r.held <= DT + 1e-9);
  // 같은 묶임에서는 다시 안 열림 → 이어서 묶여 있으면 0.6 s 뒤 이어짐 창
  const n = Math.round(SECRET.risolutoHold / DT);
  const r2 = tick(Wa, a, n + 2);
  assert.equal(r2?.path, 'hold');
  assert.equal(Wa.opens.touch, 1);
  // 칼이 떨어졌다(너그러움 0.2 s 넘게) 다시 닿으면 새 묶임 → 또 곧장
  const on = a.foe.bladePoint;
  a.foe.bladePoint = blade([2.6, 1.6, 0.4], [1.5, 1.6, 0.4]);
  assert.equal(keep(SECRET, 'risolutoBeat', 0, () => tick(Wa, a, Math.round(0.4 / DT))), null);
  a.foe.bladePoint = on;
  assert.equal(Wa.tick(DT, true)?.path, 'touch', '다시 닿은 첫 스텝');
  // 칼끝이 상대 칼 몸에 엇걸림 (내 칼끝 쪽 절반 곁 · 실제 맞닿음 사건)
  const c = fake({ foeA: [2.4, 1.02, 0.4], foeB: [1.2, 1.02, -0.4] }); c.me.feel = { touching: true };
  assert.equal(new RisolutoWatch(c.me, c.foe).tick(DT, true)?.path, 'touch');
  // 창이 열려 있는 동안(canOpen false)은 셈만 · 그 창이 끝난 스텝에 엶
  const d = tipTip(); const Wd = new RisolutoWatch(d.me, d.foe);
  assert.equal(Wd.tick(DT, false), null);
  assert.equal(Wd.tick(DT, true)?.path, 'touch');
  // 막기 · 휘두름은 얽힘이 아님: 상대가 휘두르는 중 · 내가 휘두르는 중 · 스틱이 앞이 아님이면 안 열림
  for (const set of [(f) => { f.foe.aiCtl = { mode: 'attack', phase: 'strike' }; }, (f) => { f.me.skill.swinging = true; }, (f) => { f.me.stickX = 1; f.me.stickY = 0.2; }]) {
    const k = tipTip(); set(k); assert.equal(new RisolutoWatch(k.me, k.foe).tick(DT, true), null);
  }
  // ?risoTouch=0 = 10/24 판: 첫 스텝엔 없음 · 0.6 s 이어지면 이어짐 창
  withCfg(HOLD1024, () => {
    const b = tipTip(); const Wb = new RisolutoWatch(b.me, b.foe);
    assert.equal(Wb.tick(DT, true), null);
    assert.equal(tick(Wb, b, n + 2)?.path, 'hold');
  });
  // ?risoWide=0 (10/22 판)도 끔
  withCfg(OLD, () => { const b = tipTip(); assert.equal(new RisolutoWatch(b.me, b.foe).tick(DT, true), null); });
});

test('10/25 칼끝 얽힘 창 · 실제 몸: 맞닿기 거리 밖이면 첫 닿음에 금색 창 · 맞닿기 거리 안이면 그대로 막힘(간격 조건 — ?risoGap=0 이면 뜸) · ?risoTouch=0 이면 0.6 s 뒤', () => {
  const at = (w, gap, fn) => {
    const g = newRound({ weapon: w, weapon2: 'longsword', gap, seed: 9 });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    try {
      g.step();
      const ps = new PlayerSecretWatch(p, e);
      p.stickX = 0; p.stickY = 1; // 스틱 앞
      const touch = () => { p.feel.touching = true; }; // 칼끼리 맞닿음 사건 (combat.js 가 스텝마다 적는 것 — 여기선 물리 스텝 없이 셈만)
      return fn(p, ps, touch);
    } finally { g.world.free(); }
  };
  at('rapier', 2.2, (p, ps, touch) => {
    assert.ok(p.foeDistance() > lungeGap(p), `${p.foeDistance()}`);
    assert.equal(ps.open, null);
    touch(); ps.update(DT, false);
    assert.equal(ps.open?.ctx?.path, 'touch', '첫 닿음 스텝에 창');
    assert.ok(Math.abs(ps.open.t - SECRET.playerWindow) < 1e-9, '창 0.6 s 그대로');
    const o = ps.fire();
    assert.equal(o?.S?.name, 'andareRisoluto', '창 안의 탭 = 비기');
  });
  at('rapier', 1.3, (p, ps, touch) => {
    assert.equal(lungeGapOk(p), false);
    touch(); ps.update(DT, false);
    assert.equal(ps.open, null, '맞닿기 거리 안 — 첫 닿음이어도 창 없음');
    assert.equal(ps.riso.gapBlocked, 1);
    assert.equal(ps.riso.opens.touch, 1);
  });
  withCfg({ risolutoGap: 0 }, () => at('rapier', 1.3, (p, ps, touch) => { touch(); ps.update(DT, false); assert.equal(ps.open?.ctx?.path, 'touch', '간격 조건 끔'); }));
  withCfg(HOLD1024, () => at('rapier', 2.2, (p, ps, touch) => {
    touch(); ps.update(DT, false);
    assert.equal(ps.open, null, '10/24 판 — 첫 닿음엔 없음');
    let k = 1;
    for (; k < 200 && !ps.open; k++) { touch(); ps.update(DT, false); }
    assert.equal(ps.open?.ctx?.path, 'hold');
    assert.ok(Math.abs(k * DT - SECRET.risolutoHold) < 2 * DT, `${k}`);
  }));
});

// 10/24 14:0x 런지 자세 (사장님 '런지할 때 런지 자세가 되려면 앞무릎을 굽히면서 자세 낮춰야 하는데 지금 그렇게 보여?'): 앞무릎 굽힘 · 뒷다리 펴짐 · 골반 낮춤 — 무릎 굽힘 = 넓적다리(엉덩이 → 무릎)와 정강이(무릎 → 발목) 사이 각
function lungePose(cfg) {
  return withCfg(cfg, () => {
    // 가슴 사이 2.2 m = 맞닿기 1.54 + 0.66(몸 미끄러짐이 한도 0.6 를 다 나가는 거리) — 'full' 판(맞닿기 1.72)은 같은 자리로 맞닿기 + 0.66
    const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: CONFIG.THRUST.itMeasure === 'full' ? MEASURED.rapier[0] + 0.66 : 2.2, seed: 9 });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
    const jw = (c) => { const a = p.jointByName[c].joint.anchor2(), b = p.bodies[c], r = b.rotation(); return new THREE.Vector3(a.x, a.y, a.z).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(V(b.translation())); };
    const pose = () => {
      const c = p.bodies.chest.translation(), f = e.bodies.chest.translation(), fw = new THREE.Vector3(f.x - c.x, 0, f.z - c.z).normalize();
      const leg = (k) => { const h = jw('thigh' + k), kn = jw('shin' + k), an = jw('foot' + k); return { flex: (kn.clone().sub(h).angleTo(an.clone().sub(kn)) * 180) / Math.PI, x: an.dot(fw) }; };
      const F = leg('F'), B = leg('B'), front = F.x > B.x ? F : B, back = F.x > B.x ? B : F;
      return { front: front.flex, back: back.flex, spread: front.x - back.x, pel: p.bodies.pelvis.translation().y };
    };
    try {
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.5) / DT); i++) g.step();
      const pel0 = pose().pel;
      const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
      const ps = new PlayerSecretWatch(p, e);
      ps.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
      assert.equal(p.skill.secret(ps.fire()), true);
      const rows = [];
      let wasLunge = false, landed = false, last = null;
      for (let i = 0; i < Math.round(1.2 / DT); i++) {
        g.step();
        const rq = p.gait?.req;
        if (rq && rq.fwd > 0) wasLunge = true;
        if (wasLunge && !(rq && rq.fwd > 0)) landed = true;
        if (rq && rq.fwd < 0) break; // 앞발을 거두기 시작
        if (landed) last = pose();
        if (landed && p.gait.legs.F.stance && p.gait.legs.B.stance) rows.push(last);
      }
      const ms = Math.max(...rows.map((r) => r.spread));
      const wide = rows.filter((r) => r.spread >= 0.85 * ms); // 두 발이 가장 벌어진 몫 (런지 자세)
      // 10/24 15:5x 손목(SECRET.thrustArm — 팔을 뻗은 채 굳음): 몸이 다 실린 끝 무렵은 걸음 몸의 앞발 '디딤' 표시가 몇 스텝 꺼졌다 켜지는 사이라(옛 팔에서도 0.50 ~ 0.60 s 꺼짐)
      //  그 몇 스텝이 창 밖으로 밀리면 런지 자세를 못 본다 → 앞발을 거두기 바로 전 자세(문서 §12-1 셋째 줄 '몸이 다 실려 앞발이 뜨기 바로 전')도 런지 자세로 셈
      if (last && !wide.includes(last)) wide.push(last);
      const best = wide.reduce((a, r) => (r.front - r.back > a.front - a.back ? r : a), wide[0]);
      return { ...best, drop: pel0 - Math.min(...rows.map((r) => r.pel)) };
    } finally { g.world.free(); }
  });
}

test('10/24 14:0x 런지 자세: 앞무릎이 굽고 뒷다리가 펴짐 (전: 앞다리가 곧고 뒷무릎이 굽어 뒤로 주저앉음) · 골반 낮춤', () => {
  const now = lungePose({});
  assert.ok(now.front >= 30 && now.back <= 40 && now.front - now.back >= 15, `지금 앞무릎 ${now.front.toFixed(0)}° · 뒷무릎 ${now.back.toFixed(0)}°`);
  assert.ok(now.drop >= 0.08, `골반 낮춤 ${now.drop.toFixed(3)} m`);
  // 14:0x 전 걸음 (?risoRecover=0 — 뒷발 끌어붙임 · 몸 따라감 배율 · 몸 가속 없음)
  const old = lungePose({ risolutoStep: { ...SECRET.risolutoStep, draw: 1, recover: 0, push: 0, accel: 0 } });
  assert.ok(old.front - old.back < 0, `전 앞무릎 ${old.front.toFixed(0)}° · 뒷무릎 ${old.back.toFixed(0)}°`);
});

test("10/25 21:0x 사장님 조건 (스틱 '앞이나 뒤' · 덮음 '15cm 이내'): 뒤 90° 부채꼴도 덮인 채 나아가기 · 옆 · 놓음은 아님 · 0.12 m 떨어진 칼도 덮음 · ?risoStick=fwd · ?risoCover=0.07 = 전", () => {
  assert.equal(SECRET.risolutoStick, 'both');
  const open = (set, cfg = {}) => withCfg(cfg, () => { const f = fake(); set(f.me); return tick(new RisolutoWatch(f.me, f.foe), f, 5)?.path ?? null; });
  assert.equal(open((m) => { m.stickY = -1; }), 'touch', '뒤');
  assert.equal(open((m) => { m.stickY = -0.6; m.stickX = 0.4; }), 'touch', '뒤 부채꼴 안');
  assert.equal(open((m) => { m.stickY = -0.4; m.stickX = 0.6; }), null, '옆');
  assert.equal(open((m) => { m.stickY = 0; m.stickX = 0; }), null, '놓음');
  assert.equal(open((m) => { m.stickY = -1; }, { risolutoStick: 'fwd' }), null, '전: 앞만');
  assert.equal(open((m) => { m.stickY = 1; }, { risolutoStick: 'fwd' }), 'touch');
  // 덮음 15 cm: 상대 칼이 내 칼 위 0.12 m 를 엇갈려 지나감
  const far = () => fake({ foeA: [1.4, 1.12, 0.4], foeB: [0.2, 1.12, -0.4] });
  const a = far();
  assert.ok(Math.abs(coverDist(a.me, a.foe) - 0.12) < 1e-6);
  assert.ok(bladesNear(a.me, a.foe));
  assert.equal(tick(new RisolutoWatch(a.me, a.foe), a, 5)?.path, 'touch');
  withCfg({ risolutoCover: 0.07 }, () => { const b = far(); assert.equal(bladesNear(b.me, b.foe), false); assert.equal(tick(new RisolutoWatch(b.me, b.foe), b, 5), null); });
});

test("10/25 21:0x 창 지킴 (사장님 '비기 발동창이 열리면 어떻게 상황이 변하더라도 최소 0.6초는 열린 상태를 유지') — 모든 사람 비기 창: 짧은 창도 0.6 s · 조건이 바뀌어도 열림 · 몸이 낼 수 없으면(넘어짐) 닫힘 · ?secretHold=0 = 전", () => {
  assert.equal(SECRET.secretHold, 1);
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 2.4, seed: 9 });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    g.step();
    const ps = new PlayerSecretWatch(p, e);
    ps.riso.tick = () => null;
    const run = (secs) => { for (let i = 0; i < Math.round(rs(secs) / DT); i++) ps.update(DT, false); }; // 실제 초
    // 짧은 창(0.2 s)도 playerWindow 까지 · 그 뒤 닫힘
    ps.openWindow({ ev: 'x' }, rs(0.2));
    run(0.5); assert.ok(ps.open, '0.5 s — 열림'); assert.ok(ps.holding());
    run(0.11); assert.equal(ps.open, null, '0.61 s — 닫힘');
    // 0.6 s 창은 그대로 0.6 s (한 스텝도 더 열리지 않음)
    ps.openWindow({ ev: 'x' });
    let k = 0; while (ps.open && k < 200) (ps.update(DT, false), k++);
    assert.equal(k, Math.ceil(SECRET.playerWindow / DT - 1e-6)); // 창이 다 닫히는 스텝 (게임 0.66 s = 79.2 스텝 → 80째)
    // 몸이 비기를 낼 수 없음(넘어짐) = 지킴과 상관없이 닫힘 (skill.secret 이 받지 않는 몸)
    ps.openWindow({ ev: 'x' });
    const st = p.state; p.state = 'down';
    ps.update(DT, false); assert.equal(ps.open, null, '넘어지면 닫힘');
    p.state = st;
    // 전(?secretHold=0): 짧은 창은 그 길이에 닫힘
    withCfg({ secretHold: 0 }, () => { ps.openWindow({ ev: 'x' }, rs(0.2)); run(0.21); assert.equal(ps.open, null); });
  } finally { g.world.free(); }
});
