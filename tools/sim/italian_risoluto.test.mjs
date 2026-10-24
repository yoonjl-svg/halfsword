// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토 — 10/22 사람 먼저 · docs/strike/italian_risoluto_2026-10-22.md):
//  덮음은 칼 모양(내 손 쪽 절반 ↔ 상대 칼끝 쪽 절반 가장 가까운 거리) · 덮인 채 나아가기 셈 · 창 · 두 번째 길(상대 박자) · 실제 몸에서 실행(탭 찌르기 · 상대 팔 늦춤 · 비기 배율 · 굳음) · AI 는 닫힘.
//  10/23 넓은 판정(기본 — 칼 어느 부위든 · 너그러움 0.2 s · 가슴 사이 조건 없음 · 다 붙음 · 상대 박자 켬) · 10/22 판(?risoWide=0 = OLD)은 그 판으로 시험.
//  10/24 런지(기본 — 운동학 찌르기 · 고노센 칼끝 빠르기 · 몸 미끄러짐 + 앞발 런지 · 팔 늦춤 0.6 · 굳음 0.6) · 10/23 탭 찌르기 판(?risoLunge=0 = TAP1023)은 그 판으로 시험.
//  node --test tools/sim/italian_risoluto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { coverDist, RisolutoWatch } from '../../src/italian_risoluto.js';
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { playerSecretDef, TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';

const { SECRET } = CONFIG;
const keep = (o, k, v, fn) => { const old = o[k]; o[k] = v; try { return fn(); } finally { o[k] = old; } };
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const OLD = { risolutoAnyPart: 0, risolutoGrace: 0, risolutoClosing: 1, risolutoClose: 0, risolutoBeat: 0 }; // 10/22 판 (main.js ?risoWide=0 과 같은 값)
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
  assert.equal(SECRET.risolutoCover, 0.07);
});

test('10/22 판(?risoWide=0) 덮인 채 나아가기: 덮음 · 둘 다 안 휘두름 · 스틱 앞 · 가슴 사이 줄어듦이 risolutoHold 이어지면 창 (하나라도 빠지면 셈이 0)', () => withCfg(OLD, () => {
  const f = fake();
  const W = new RisolutoWatch(f.me, f.foe);
  assert.equal(SECRET.risolutoHold, 0.6);
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

test('10/23 넓은 판정 (사장님 \'칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게\'): 기본값 · 칼 어느 부위든 · 끊김 너그러움 0.2 s(모아서 셈) · 가슴 사이 조건 없음', () => {
  assert.deepEqual([SECRET.risolutoAnyPart, SECRET.risolutoGrace, SECRET.risolutoClosing, SECRET.risolutoClose, SECRET.risolutoBeat, SECRET.risolutoHold], [1, 0.2, 0, 1, 1, 0.6]);
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
    assert.equal(tick(W, f, Math.round(0.4 / DT)), null);
    f.foe.bladePoint = blade([2.2, 1.6, 0.4], [0.9, 1.6, 0.4]); // 칼이 떨어짐
    assert.equal(tick(W, f, Math.round(gapS / DT)), null);
    f.foe.bladePoint = on;
    let k = 0, r = null;
    for (; k < n && !r; k++) { f.me.gap -= 0.01; r = W.tick(DT, true); }
    return { r, k };
  });
  const b1 = blink(0.1); assert.equal(b1.r?.path, 'hold'); assert.ok(b1.k <= Math.round(0.2 / DT) + 2, `이어서 셈 ${b1.k}`); // 0.4 s 모은 뒤 0.2 s 더
  const b3 = blink(0.3); assert.equal(b3.r?.path, 'hold'); assert.ok(b3.k >= Math.round(0.6 / DT) - 1, `처음부터 ${b3.k}`);
  // 상대 박자 + 너그러움: 덮음이 풀리면 너그러움(0.2 s)이 지난 뒤 창 · 상대가 칼을 내면 곧장
  const f = fake(); const W = new RisolutoWatch(f.me, f.foe);
  tick(W, f, Math.round(0.3 / DT));
  f.foe.bladePoint = blade([2.2, 1.6, 0.4], [0.9, 1.6, 0.4]);
  let k = 0, r = null;
  for (; k < 60 && !r; k++) r = W.tick(DT, true);
  assert.deepEqual([r?.path, r?.why], ['beat', 'uncover']); assert.ok(Math.abs(k * DT - SECRET.risolutoGrace) < 2 * DT, `${k}`);
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
  for (const w of ['rapier', 'dartagnan', 'balisarda']) {
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
    assert.equal(SECRET.stiff.italian, 0.4);
  } finally { g.world.free(); }
}));


// 10/24 런지 — 상대는 멈춤 · 판 시작 발 묶임(ARENA.startHold) 뒤 · 창을 열어 탭 하나
function lungeRun(w, { gap = 1.8, seed = 9, foeW = 'longsword', cfg = {} } = {}) {
  return withCfg(cfg, () => {
    const g = newRound({ weapon: w, weapon2: foeW, gap, seed });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    try {
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) g.step();
      const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
      const ps = new PlayerSecretWatch(p, e);
      ps.openWindow({ ev: 'risoluto', path: 'close', held: 0.6 });
      const out = { w, gap0: p.foeDistance(), clinch: p.swordArt.measure.clinch, gon: iaiTipSpeed(p), spent0: p.stamina.spent.attack, secret0: p.stamina.spent.secret, tipV: 0, stiffT: null, stiffSteps: 0, held: false, drew: false, gaitReq: null, standAll: true, tilt: 0, wounds: [] };
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
        out.gaitReq ??= p.gait?.req ? { kind: p.gait.req.kind, fwd: p.gait.req.fwd, draw: !!p.gait.req.draw } : null;
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
      return out;
    } finally { g.world.free(); }
  });
}

test('10/24 런지 값 (사장님 \'런지로 진행해. 단 런지 동작이 고노센처럼 빠르게 나가야 의미가 있어. 상대 팔 늦어지는 효과는 0.6초 내 경직도 0.6초\')', () => {
  assert.equal(SECRET.risolutoLunge, 1);
  assert.equal(SECRET.risolutoShare, 1); // 고노센 칼끝 빠르기 그대로
  assert.equal(SECRET.risolutoArmSlow, 0.6);
  assert.equal(SECRET.risolutoStiff, 0.6);
  assert.equal(SECRET.hitMul, 1.3); // 판정 배율 그대로 (사장님 지시 — 바꾸지 않음)
  // 걸음은 있던 수: 몸 미끄러짐 = 고노센 발도 iaiStep · 앞발 = 이탈리아 런지 italianStep · 디딘 뒤 뒷발 끌어붙임
  assert.deepEqual(SECRET.risolutoStep, { slide: 'iaiStep', foot: 'italianStep', draw: 1, room: 0 }); // room 1 = 앞발도 clinch 밖까지만 (?risoRoom=1)
  assert.equal(SECRET.iaiStep, 0.6); assert.equal(SECRET.italianStep, 0.9);
  // 다른 곳 값은 그대로 (흘림 팔 늦춤 · 이탈리아 비기 굳음 — 10/23 판 · AI 칸)
  assert.equal(CONFIG.FLOW_RECOVERY.seconds, 0.4); assert.equal(SECRET.stiff.italian, 0.4);
});

test('10/24 런지 실제 몸: 탭 하나 = 운동학 찌르기(고노센 칼끝 빠르기) · 몸 미끄러짐 + 앞발 런지 0.9 m · 상대 팔 늦춤 0.6 s · 굳음 0.6 s(끝 자세 붙잡음 · 뒷발 끌어붙임) · 넘어지지 않음', () => {
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
    assert.equal(o.req.hold, 0.6);
    assert.deepEqual([m.step.fwd, m.step.foot, m.step.draw, !!m.step.room], [SECRET.iaiStep, SECRET.italianStep, true, false]);
    assert.equal(m.glide, true);
    assert.equal(o.armSlow, 0.6, '상대 두 팔 늦춤 0.6 s');
    assert.ok(o.lungeT > 0, '런지 자세 (SECRET.stance.lunge)');
    assert.equal(o.spentAttack, 0, '찌르기 값은 따로 안 냄');
    assert.ok(o.spentSecret > 0 || !CONFIG.STAMINA.on, '비기 값 하나');
    // 고노센처럼 빠르게: 길 빠르기 = 같은 칼 고노센 칼끝 빠르기 × 1 · 찌르는 토막 칼끝(월드 — 쓸린 자리 조각) 가장 빠름 ≥ 고노센의 0.9 · 평균 ≥ 0.8 (몸 미끄러짐 몫을 길 시간에 넣어 늘임 — 연환 그때 계산 길과 같음)
    assert.ok(Math.abs(o.res.v - SECRET.risolutoShare * o.gon) < 1e-6, `${w} 길 빠르기 ${o.res.v}`);
    assert.ok(o.res.tipVmax >= 0.9 * o.gon && o.res.tipV >= 0.8 * o.gon, `${w} 칼끝 ${o.res.tipV.toFixed(1)} · 최고 ${o.res.tipVmax.toFixed(1)} / 고노센 ${o.gon.toFixed(1)}`);
    assert.deepEqual(o.gaitReq, { kind: 'lunge', fwd: SECRET.italianStep, draw: true }, `${w} 앞발 런지 걸음`);
    assert.equal(o.stiffT, 0.6, '굳음 0.6 s');
    assert.ok(Math.abs(o.stiffSteps * DT - 0.6) < 3 * DT, `${w} 굳음 ${(o.stiffSteps * DT).toFixed(3)} s`);
    assert.equal(o.phase, 'stiff'); // main.js 가 칼 입력 · 스틱 · 막기 단추를 막는다
    assert.equal(o.held, true, '굳음 동안 끝 자세 붙잡음');
    assert.equal(o.drew, true, `${w} 디딘 뒤 뒷발 끌어붙임`);
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

test('창 안의 끌기(베기)는 비기가 아님 · 내가 베기를 시작하면 창이 닫힘', () => {
  assert.equal(playerSecretDef('italian').do.tapOnly, true);
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: 1.8, seed: 9 });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    g.step();
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
    p.skill.swinging = true;
    ps.update(DT, false);
    assert.equal(ps.open, null);
  } finally { g.world.free(); }
});

test('다 붙음 창(risolutoClose — 10/23 기본 켬: 맞닿기 거리 밖에서 안으로 든 순간 · 덮인 채 나아가기 한 번에 한 번 · 시간 조건 없음) · 시험 스위치(기본 끔) · 칼을 대지 않는 덮음(risolutoLine — 겨눔 곧은 선 12° 안 · 강한 쪽이 상대 칼끝 → 내 가슴 줄 위)', () => {
  assert.equal(SECRET.risolutoClose, 1); // 10/23 기본 켬
  assert.equal(SECRET.risolutoLine, 0);
  // 다 붙음: 1.6 m 에서 0.01 m 씩 다가감 · 맞닿기 1.5 m → 1.5 를 넘는 스텝에 창 (0.6 s 전) · 안에 머무는 동안 다시 안 열림 (밖으로 나갔다 들어와야)
  keep(SECRET, 'risolutoClose', 1, () => {
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
