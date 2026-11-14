// 이탈리아 아웃복싱 시험 (사장님 11/14 '이탈리아는 아웃복싱 스타일이야 … 찌르기 자체를 너프 … 걸어들어오는 상대를 카운터하면 +30%. 제안 A와 B 좋아.' —
//  config IT_OUTBOX · src/italian_outbox.js · 기록 docs/strike/it_outbox_2026-11-14.md):
//   1 찌르기 배율(판정 에너지 × thrustMul — 비기 배율과 같은 자리) · 2 맞박자 찌르기 +30 % 조건(걸어 들어옴 · 몫 열쇠 itTempo) · 3 칼 우위 켜짐 · 리솔루토는 칼 우위 밖에선 창이 안 열림 ·
//   4 박자 찌르기 조건(상대가 치기 시작한 0.4 s 안의 탭 — 스틱 옆 아니어도) · 스위치 끔이면 전 판 · 다른 유파 바이트 같음
//  node --test tools/sim/it_outbox.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CONFIG, newRound, THREE } from './harness_m.mjs';
import { itThrust, itThrustKind, foeWalkingIn, itEdgeGrant, itEdgeOn, itEdgeOk, itOnStrike, beatOk, beatSide, beatTick, aiBeatTick, aiBeatTech } from '../../src/italian_outbox.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { kitFromNodes, allNodeIds, KIT_KEYS } from '../../src/skill_tree_data.js';
import { fightOne } from './school_balance.mjs';
import { THRUST_STYLE } from '../../src/weapons.js';

const IO = CONFIG.IT_OUTBOX;
const { realS, GAIT } = CONFIG;
const withIO = (vals, fn) => { const old = { ...IO }; Object.assign(IO, vals); try { return fn(); } finally { Object.assign(IO, old); } };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 가짜 몸 — 사람 이탈리아(나 · 원점) · 상대(+x 1.8 m)
function fake({ kind = 'tap', foeV = [0, 0, 0], walking = true, school = 'italian', ai = false, kit = null } = {}) {
  const foe = { alive: true, state: 'stand', gait: { walking }, cache: { parts: { pelvis: { p: V(1.8, 0.9, 0), v: V(...foeV) } } } };
  const me = { swordArt: { tradition: school }, aiControlled: ai, skill: {}, stamina: {}, foe, cache: { parts: { pelvis: { p: V(0, 0.9, 0), v: V(0, 0, 0) } } }, fightT: 5, ...(kit ? { skillKit: kit } : {}) };
  if (kind === 'tap') me.skill.tap = {};
  if (kind === 'imbro') me.skill.tap = { uniqTech: 'imbroccata' };
  if (kind === 'cav') me.iai = { tech: 'cavazione' };
  if (kind === 'special') me.iai = { tech: 'inquartata' };
  if (kind === 'secret') me.skill.sec = {};
  if (kind === 'opp') me.parryGuard = { opposition: { run: {} } };
  if (kind === 'stroke') me.stamina = { stroke: { kind: 'thrust', paid: true } };
  if (kind === 'cut') me.stamina = { stroke: { kind: 'cut', paid: true } };
  return { me, foe };
}

test('기본값 (11/14 사장님 \'이탈리아 찌르기 0.8로 해. 우위 2초 권고대로. ai에도 적용. 콘트라템포 ok\'): 넷 모두 켬 · 찌르기 × 0.8 · 맞박자 +30 % · 칼 우위 2.0 s · 박자 0.4 s (실제 초 — 시간 사다리) · AI 에도 · 몫 열쇠 itTempo = 새 칸 I12 맞박자 찌르기', () => {
  assert.equal(IO.on, 1);
  assert.equal(IO.thrustMul, 0.8);
  assert.equal(IO.stop, 0.3);
  assert.equal(IO.stopV, null);
  assert.ok(Math.abs(IO.edge - realS(2.0)) < 1e-12 && Math.abs(IO.beat - realS(0.4)) < 1e-12);
  assert.equal(IO.ai, 1);
  assert.ok(KIT_KEYS.includes('itTempo'));
  assert.equal(kitFromNodes('italian', new Set(['I1', 'I12'])).itTempo, true);
  assert.equal(kitFromNodes('italian', new Set(['I1'])).itTempo, false, 'I1 임시 이음은 걷음 (새 칸 I12)');
});

test('1 찌르기 배율: 사람 이탈리아 보통 찌르기(탭 · 내려 찌르기 · 돌려 빼기 · 막아찌르기 · 그어 찌르기) × thrustMul · 비기 · 베기 · AI · 다른 유파 · 끔 = 배율 없음(null)', () => {
  for (const kind of ['tap', 'imbro', 'cav', 'opp', 'stroke']) {
    const { me, foe } = fake({ kind });
    const r = itThrust(me, foe);
    assert.equal(r?.k, 0.8, kind);
    assert.equal(r.stop, false, kind);
  }
  for (const m of [0.7, 0.9]) withIO({ thrustMul: m }, () => assert.equal(itThrust(...Object.values(fake())).k, m));
  assert.equal(itThrust(...Object.values(fake({ kind: 'secret' }))), null, '비기(리솔루토) 뺌');
  assert.equal(itThrust(...Object.values(fake({ kind: 'special' }))), null, '특수 공격 — 약화 없음(맞박자 아니면 배율 없음)');
  assert.equal(itThrust(...Object.values(fake({ kind: 'cut' }))), null, '긋기');
  assert.equal(itThrust(...Object.values(fake({ ai: true }))), null, 'AI 가 찌르는 중이 아님');
  assert.equal(itThrust(...Object.values(fake({ school: 'german' }))), null, '다른 유파');
  withIO({ on: 0 }, () => assert.equal(itThrust(...Object.values(fake())), null, '끔'));
  withIO({ thrustMul: 1 }, () => assert.equal(itThrust(...Object.values(fake())), null, '배율 1 = 그대로'));
  { // AI 에도 (11/14 사장님 'ai에도 적용' — IT_OUTBOX.ai 1): AI 찌르기 기술 × 0.8 · 빼서 찌르기(칼끝 돌려 빼기) 'cav' · 비껴서며 찌르기 'special' · ai 0 = 사람만
    const { me, foe } = fake({ ai: true, kind: 'none' });
    me.aiCtl = { mode: 'attack', phase: 'strike', tech: { kind: 'thrust', name: 'stichPflug' } };
    assert.equal(itThrust(me, foe)?.k, 0.8, 'AI 찌르기');
    me.aiCtl.passiveAtk = 'cavazione';
    assert.equal(itThrust(me, foe)?.kind, 'cav', 'AI 빼서 찌르기 = 칼끝 돌려 빼기');
    me.aiCtl = { mode: 'attack', phase: 'strike', tech: { kind: 'thrust', name: 'inquartata' } };
    assert.equal(itThrustKind(me), 'special');
    me.aiCtl = { mode: 'attack', phase: 'strike', tech: { kind: 'cut', name: 'zornhau' } };
    assert.equal(itThrust(me, foe), null, 'AI 베기');
    me.aiCtl = { mode: 'attack', phase: 'strike', tech: { kind: 'thrust', name: 'stichPflug' } };
    withIO({ ai: 0 }, () => assert.equal(itThrust(me, foe), null, 'ai 0 = 사람만'));
  }
  assert.equal(itThrustKind(fake({ kind: 'secret' }).me), 'secret');
  const s = fake();
  s.me.secretHit = 0.5; // 리솔루토 탭 찌르기 판(?risoLunge=0)도 비기 배율이 걸리면 비기
  assert.equal(itThrust(s.me, s.foe), null);
});

test('1 찌르기 배율 = 판정 에너지 자리 (combat.js analyze hk — 같은 칼 · 같은 맞음에서 에너지 × 0.8 · 물리 빠르기 그대로)', () => {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  try {
    for (let i = 0; i < 3; i++) G.step();
    const P = G.player, A = G.enemy;
    P.cacheState();
    A.cacheState();
    P.skill.tap = {}; // 탭 찌르기 중인 꼴 (판을 돌리지 않음)
    const c = A.cache.parts.chest;
    const s = P.cache.sword;
    s.v.set(0, 0, 0);
    s.w.set(0, 0, 0);
    // 칼을 상대 가슴 쪽으로 6 m/s 로 미는 꼴 — 칼 축 방향(찌르기)
    const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(s.q);
    s.v.copy(ax).multiplyScalar(6);
    const pr = { w: { fighter: P, part: 'blade' }, v: { fighter: A, part: 'chest', kind: 'chest' } }; // combat.js zoneOf 가 읽는 칸 (colliderInfo 와 같은 꼴)
    const tip = s.p.clone().addScaledVector(ax, P.weaponCfg.hiltLength + P.weaponCfg.bladeLength);
    const run = () => G.combat.analyze(pr, tip.clone(), s, c, true);
    const off = withIO({ on: 0 }, run);
    const on = withIO({ on: 1 }, run);
    assert.ok(off && on && off.energy > 0);
    assert.ok(Math.abs(on.energy / off.energy - 0.8) < 1e-9, `에너지 비 ${on.energy / off.energy}`);
    assert.equal(on.speed, off.speed, '물리 빠르기 그대로');
    assert.equal(on.itThrust?.k, 0.8);
    assert.equal(off.itThrust, undefined, '끔이면 결과 칸도 전과 같음');
  } finally {
    G.world.free();
  }
});

test('2 맞박자 찌르기 +30 %: 상대가 내 쪽으로 걸음 문턱 넘게 · 걷는 중이면 × 1.3 (보통 찌르기 0.8 × 1.3 · 비껴서며 찌르기 1 × 1.3 · 비기 없음) · 몫 열쇠 itTempo 를 익혀야', () => {
  const walkIn = [-(GAIT.walkMin + 0.05), 0, 0]; // 상대(+x)가 나(원점) 쪽으로
  const a = fake({ foeV: walkIn });
  assert.equal(foeWalkingIn(a.me, a.foe), true);
  const r = itThrust(a.me, a.foe);
  assert.ok(r.stop && Math.abs(r.k - 0.8 * 1.3) < 1e-12, '보통 찌르기 0.8 × 1.3');
  const sp = fake({ kind: 'special', foeV: walkIn });
  assert.ok(Math.abs(itThrust(sp.me, sp.foe).k - 1.3) < 1e-12, '비껴서며 찌르기 × 1.3 (약화 없음)');
  withIO({ stopSpecial: 0 }, () => assert.equal(itThrust(sp.me, sp.foe), null));
  assert.equal(itThrust(...Object.values(fake({ kind: 'secret', foeV: walkIn }))), null, '비기 뺌');
  // 문턱 · 걸음 단계
  assert.equal(foeWalkingIn(...Object.values(fake({ foeV: [-(GAIT.walkMin - 0.05), 0, 0] }))), false, '문턱 밑');
  assert.equal(foeWalkingIn(...Object.values(fake({ foeV: [GAIT.walkMin + 0.5, 0, 0] }))), false, '물러남');
  assert.equal(foeWalkingIn(...Object.values(fake({ foeV: [0, 0, 1] }))), false, '옆걸음');
  assert.equal(foeWalkingIn(...Object.values(fake({ foeV: walkIn, walking: false }))), false, '걷는 중 아님');
  withIO({ stopWalk: 0 }, () => assert.equal(foeWalkingIn(...Object.values(fake({ foeV: walkIn, walking: false }))), true));
  const down = fake({ foeV: walkIn });
  down.foe.state = 'kneel';
  assert.equal(foeWalkingIn(down.me, down.foe), false, '선 상대만');
  // 몫 열쇠: 스킬트리 몫이 있는 사람 몸은 itTempo(지금 I1)를 익혀야
  const noKit = fake({ foeV: walkIn, kit: kitFromNodes('italian', new Set(['I1', 'I3'])) });
  assert.equal(itThrust(noKit.me, noKit.foe).stop, false);
  assert.equal(itThrust(noKit.me, noKit.foe).k, 0.8);
  const kit = fake({ foeV: walkIn, kit: kitFromNodes('italian', new Set(['I1', 'I12'])) }); // 새 칸 I12 맞박자 찌르기 (콘트라템포)
  assert.equal(itThrust(kit.me, kit.foe).stop, true);
  withIO({ stop: 0 }, () => assert.equal(itThrust(a.me, a.foe).stop, false, 'stop 0 = 끔'));
  // 다른 상대(2:2 — 겨눈 상대가 아님)는 안 받음
  assert.equal(itThrust(a.me, { ...a.foe }).stop, false);
});

test('3 칼 우위: I2 · I6 · I9 가 상처를 내면 · I8 헛누름이 들면 2.0 s 켜짐 · AI 도 · 탭 찌르기 · 상처 없음 · 다른 유파 · 끔 · ai 0 의 AI = 안 켜짐', () => {
  for (const kind of ['cav', 'opp', 'special']) {
    const { me, foe } = fake({ kind });
    itOnStrike(me, foe, { severity: 0.3, itThrust: itThrust(me, foe) ?? undefined });
    assert.equal(itEdgeOn(me), true, kind);
    assert.equal(me.itOut.by[kind === 'special' ? 'special' : kind], 1);
    me.fightT += IO.edge - 0.01;
    assert.equal(itEdgeOn(me), true);
    me.fightT += 0.02;
    assert.equal(itEdgeOn(me), false, '2.0 s 뒤 꺼짐');
  }
  const t = fake({ kind: 'tap' });
  itOnStrike(t.me, t.foe, { severity: 0.5, itThrust: itThrust(t.me, t.foe) });
  assert.equal(itEdgeOn(t.me), false, '탭 찌르기는 안 켬');
  assert.equal(t.me.itOut.thrustHits, 1);
  const n = fake({ kind: 'cav' });
  itOnStrike(n.me, n.foe, { severity: 0 });
  assert.equal(itEdgeOn(n.me), false, '상처 없음');
  assert.equal(itEdgeGrant(fake({ ai: true }).me, 'cav'), true, 'AI 에도 (ai 1)');
  withIO({ ai: 0 }, () => assert.equal(itEdgeGrant(fake({ ai: true }).me, 'cav'), false, 'ai 0 = 사람만'));
  assert.equal(itEdgeGrant(fake({ school: 'german' }).me, 'cav'), false, '다른 유파');
  withIO({ edge: 0 }, () => assert.equal(itEdgeGrant(fake().me, 'cav'), false, 'edge 0 = 끔'));
  const f = fake().me;
  assert.equal(itEdgeGrant(f, 'feint'), true, '헛누름');
  assert.equal(itEdgeOn(f), true);
  withIO({ edge: realS(3.0) }, () => { const g = fake().me; itEdgeGrant(g, 'cav'); g.fightT += realS(2.5); assert.equal(itEdgeOn(g), true, '3.0 s 견줌'); });
});

test('3 리솔루토는 칼 우위 동안만 창: 덮인 채 나아가기 셈이 창을 열려 해도 칼 우위 밖이면 안 열림 · 켜지면 열림 · 끔(edge 0 · edgeRiso 0 · on 0)이면 전 판', () => {
  const G = newRound({ walls: true, seed: 9, weapon: 'rapier', weapon2: 'longsword', gap: 2.4 });
  try {
    for (let i = 0; i < 3; i++) G.step();
    const P = G.player;
    const W = new PlayerSecretWatch(P, G.enemy);
    assert.ok(W.riso, '리솔루토 비기');
    const calls = [];
    W.riso.tick = (dt, can) => (calls.push(can), can ? { ev: 'risoluto', path: 'touch', held: 0 } : null); // 덮인 채 나아가기가 창을 열려는 스텝
    W.risoTick(1 / 60, false);
    assert.equal(W.open, null, '칼 우위 없음 — 창 없음');
    assert.equal(calls.at(-1), false);
    for (const v of [{ edge: 0 }, { edgeRiso: 0 }, { on: 0 }]) withIO(v, () => { W.open = null; W.risoTick(1 / 60, false); assert.ok(W.open, `끔 ${JSON.stringify(v)} — 전 판`); });
    W.open = null;
    assert.equal(itEdgeOk(P), false);
    itEdgeGrant(P, 'cav');
    assert.equal(itEdgeOk(P), true);
    W.risoTick(1 / 60, false);
    assert.ok(W.open, '칼 우위 — 창');
  } finally {
    G.world.free();
  }
});

test('5 AI 리솔루토 (11/14 사장님 \'리솔루토도 쓰게해\'): AI 이탈리아 숙련 5 = 사람과 같은 비기 · 숙련 4 · 닫음 = 없음 · 칼 우위 밖엔 창 없음 · 창이 열리면 곧장 같은 실행부 · 무장 동안 발은 상대 걸음을 맞받음', () => {
  const mk = (prof) => newRound({ walls: true, seed: 9, weapon: 'longsword', weapon2: 'rapier', gap: 2.4, persona: { proficiency: { italian: prof } } });
  for (const [prof, open, want] of [[5, true, 'andareRisoluto'], [4, true, null], [5, false, null]]) {
    const open0 = CONFIG.SECRET.aiOpenSchools;
    if (!open) CONFIG.SECRET.aiOpenSchools = open0.filter((x) => x !== 'italian');
    const G = mk(prof);
    try {
      assert.equal(G.ai.secret?.name ?? null, want, `숙련 ${prof} · 열림 ${open}`);
      assert.equal(!!G.ai.riso, !!want);
    } finally { G.world.free(); CONFIG.SECRET.aiOpenSchools = open0; }
  }
  const G = mk(5);
  try {
    const ai = G.ai, E = G.enemy;
    for (let i = 0; i < 3; i++) G.step();
    const calls = [];
    ai.riso.W.tick = (dt, can) => (calls.push(can), can ? { ev: 'risoluto', path: 'touch', held: 0 } : null); // 덮인 채 나아가기가 창을 열려는 스텝 (사람 시험과 같은 꼴)
    const got = [];
    E.skill.secret = (o) => (got.push(o), true); // 실행부는 사람과 같은 skill.secret — 받은 비기만 봄
    ai.mode = 'watch';
    ai.risoTick(1 / 60, false);
    assert.deepEqual([calls.at(-1), got.length, ai.riso.armed], [false, 0, false], '칼 우위 없음 — 창 · 무장 없음');
    itEdgeGrant(E, 'feint');
    ai.risoTick(1 / 60, false);
    assert.equal(calls.at(-1), true);
    assert.equal(got.length, 1, '창 — 곧장 냄');
    assert.equal(got[0].S, ai.secret);
    assert.equal(got[0].S.do.risoluto, true);
    assert.deepEqual([ai.secretRun?.stage, ai.mode, ai.stats.riso.wins, ai.stats.riso.fired, ai.stats.riso.by.touch, E.secretUsed], ['riso', 'secret', 1, 1, 1, 1]);
  } finally { G.world.free(); }
  // 무장 동안 발은 상대 걸음을 맞받음 — 옛 판(AI_PLAN 끔)은 상대 스틱을 그대로 · 11/14 유파 플랜(이탈리아 · 기본 켬 — docs/design/ai_school_baseline_2026-11-14.md §4-3 · §9)은
  //  사람 스틱 대신 늦게 본 다가옴(ai.foeClosing)으로 읽고 그 빠르기로 맞받음 (감독 지시 '리솔루토 맞춤 걸음을 사람 스틱 대신 본 걸음으로') — 두 판을 다 봄
  const AP = CONFIG.AI_PLAN, apOn = AP.on;
  for (const planOn of [0, 1]) {
    AP.on = planOn;
    const H = mk(5);
    try {
      const ai = H.ai, E = H.enemy, P = H.player;
      for (let i = 0; i < 3; i++) H.step();
      ai.mode = 'watch';
      ai.riso.armed = true;
      const sp = CONFIG.BODY.moveSpeed;
      for (const [y, want] of [[-0.6, 0.6], [0.6, -0.6]]) {
        if (planOn) {
          P.move.set(0, -y); // 사람 스틱은 반대로 — 읽지 않음
          ai.foeClosing = y; // 본 다가옴 (+ = 다가옴)
          ai.moveFeet(1 / 60, ai.d);
          const v = -y, stick = v >= 0 ? v / sp : v / (sp * 0.75);
          assert.deepEqual([+E.stickY.toFixed(3), E.stickX], [+stick.toFixed(3), 0], `본 다가옴 ${y} → 맞받음 ${stick}`);
        } else {
          P.move.set(0, y);
          ai.moveFeet(1 / 60, ai.d);
          assert.deepEqual([+E.stickY.toFixed(3), E.stickX], [want, 0], `상대 걸음 ${y} → 맞받음 ${want}`);
        }
      }
      P.move.set(0, 0);
      ai.riso.armed = false;
      ai.moveFeet(1 / 60, ai.d); // 무장 밖 = 평소 걸음 (값은 보지 않음 — 굴림 차례만 같음)
    } finally { H.world.free(); AP.on = apOn; }
  }
});

/** 사람 레이피어 몸 + 막기 단추 + 연 고유 공격 (cavazione_tap.test.mjs body 와 같은 꼴 — 판을 돌리지 않음) */
function body(names = ['inquartata']) {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  const P = G.player;
  const guard = new PlayerParryGuard(P, G.enemy);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: new Set(names) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  const tap = (name = 'inquartata') => {
    P.skill.tap = null;
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired[name] ?? 0;
    P.skill.thrust();
    return (uq.stats.fired[name] ?? 0) > n0;
  };
  return { G, P, uq, guard, tap, free: () => G.world.free() };
}

test('4 박자 찌르기: 상대가 치기 시작한 0.4 s 안의 탭 = 비껴서며 찌르기 (스틱 옆 아니어도 · 위협 없어도) · 몸 빼는 쪽 = 들어오는 칼 반대쪽 · 스틱 옆이면 그쪽 · 0.4 s 밖 · 끔 = 보통 탭 · 한 공격에 한 번', () => {
  const B = body();
  const cd = CONFIG.UNIQUE_ASSIST.specialCooldown;
  CONFIG.UNIQUE_ASSIST.specialCooldown = 0;
  try {
    B.guard.noThreat = realS(1); // 위협 없음 (지금 조건으로는 안 나감)
    B.P.stickX = 0;
    B.P.stickY = 0;
    const swing = (age) => (B.uq.foeAtk = { n: (B.uq.foeAtk?.n ?? 0) + 1, t0: B.uq.t - age });
    swing(realS(0.5));
    assert.equal(B.tap(), false, '0.4 s 밖');
    swing(realS(0.3));
    withIO({ beat: 0 }, () => assert.equal(B.tap(), false, 'beat 0 = 끔'));
    withIO({ on: 0 }, () => assert.equal(B.tap(), false, 'on 0 = 끔'));
    const side = beatSide(B.P);
    assert.equal(B.tap(), true, '치기 시작 0.3 s — 스틱 가운데 · 위협 없음');
    assert.equal(B.P.itOut.beatFired, 1);
    assert.equal(B.P.iaiReq.moves[0].dyn.void.lat, 0.3 * side, '몸 빼는 쪽 = beatSide');
    assert.equal(B.tap(), false, '한 공격에 한 번');
    swing(realS(0.1));
    B.P.stickX = 0.9; // 스틱 오른 옆이면 그쪽
    assert.equal(B.tap(), true);
    assert.equal(B.P.iaiReq.moves[0].dyn.void.lat, 0.3);
    swing(realS(0.1));
    B.P.stickX = -0.9;
    assert.equal(B.tap(), true);
    assert.equal(B.P.iaiReq.moves[0].dyn.void.lat, -0.3);
    assert.equal(B.uq.stats.fired.inquartata, 3, '같은 I9 (이름 그대로)');
  } finally {
    CONFIG.UNIQUE_ASSIST.specialCooldown = cd;
    B.free();
  }
});

test('4 박자 찌르기 셈 · 몸 빼는 쪽: 상대 휘두름이 선 스텝에 공격 번호 · 상대 칼이 내 오른쪽이면 왼쪽(−1)', () => {
  const foe = { skill: {}, stamina: {}, aiControlled: true, aiCtl: { mode: 'watch', phase: 'ready' } };
  const uq = { f: { foe }, t: 1, foeAtk: null, foeSw: false, inqBeatSeen: -1 };
  beatTick(uq);
  assert.equal(uq.foeAtk, null);
  foe.aiCtl = { mode: 'attack', phase: 'strike' };
  uq.t = 2;
  beatTick(uq);
  assert.deepEqual(uq.foeAtk, { n: 1, t0: 2 });
  uq.t = 2.3;
  beatTick(uq);
  assert.deepEqual(uq.foeAtk, { n: 1, t0: 2 }, '휘두르는 동안 그대로');
  assert.equal(beatOk(uq), true);
  uq.t = 2 + IO.beat + 0.01;
  assert.equal(beatOk(uq), false);
  // 몸 빼는 쪽 (가짜 몸: 나 원점 → 상대 +x · 내 오른쪽 = −z 쪽... secret_instant.js 몸 빼기와 같은 기하 r = (−uz, ux))
  const chest = (x, z) => ({ translation: () => ({ x, y: 1.2, z }) });
  const me = { bodies: { chest: chest(0, 0) }, foe: { armed: true, bodies: { chest: chest(1.8, 0) }, bladePoint: (t, o) => o.set(1.2, 1.3, 0.4) } };
  assert.equal(beatSide(me), -1, '칼이 오른쪽(+z) — 왼쪽으로');
  me.foe.bladePoint = (t, o) => o.set(1.2, 1.3, -0.4);
  assert.equal(beatSide(me), 1);
});

test('4 박자 찌르기 AI 몫: 상대 휘두름이 선 뒤 0.4 s 안이면 맞받아 베기 칼 = 비껴서며 찌르기 · 밖 · 이미 씀 · ai 0 · 끔 = 전 판 목록(null)', () => {
  const foe = { skill: {}, stamina: {}, aiControlled: true, aiCtl: { mode: 'watch', phase: 'ready' } };
  const B = { f: { foe }, t: 0, foeAtk: null, foeSw: false, inqBeatSeen: -1 };
  const inq = { name: 'inquartata' };
  aiBeatTick(B, 0.1);
  assert.equal(aiBeatTech(B, inq), null, '상대가 안 휘두름');
  foe.aiCtl = { mode: 'attack', phase: 'strike' };
  aiBeatTick(B, 0.1);
  assert.equal(aiBeatTech(B, inq), inq, '치기 시작 — 비껴서며 찌르기');
  withIO({ ai: 0 }, () => assert.equal(aiBeatTech(B, inq), null, 'ai 0'));
  withIO({ beat: 0 }, () => assert.equal(aiBeatTech(B, inq), null, 'beat 0'));
  aiBeatTick(B, IO.beat + 0.01);
  assert.equal(aiBeatTech(B, inq), null, '0.4 s 밖');
  foe.aiCtl = { mode: 'watch', phase: 'ready' };
  aiBeatTick(B, 0.1);
  foe.aiCtl = { mode: 'attack', phase: 'strike' };
  aiBeatTick(B, 0.1);
  assert.equal(B.foeAtk.n, 2);
  B.inqBeatSeen = 2;
  assert.equal(aiBeatTech(B, inq), null, '이 공격에 이미 씀');
});

const hash = (r) => createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 12);
test('스위치 끔이면 전 판 (본판 c1cad826 과 판 바이트 같음 — 사람 이탈리아 손가락 봇 판 둘 · 거울은 AI 이탈리아도) · 다른 유파 판은 켬 그대로 같음', () => {
  // 11/14 틈 파고들기(사장님 '기본찌르기는 0.6 위에서 내려찌르기는 0.9' — 무기 값 · IT_OUTBOX 밖)는 그때 값으로 묶어 본판과 견줌 (레이피어 0.3 · 에스톡 0.5 · 내려 찌르기 0.6)
  const UA = CONFIG.UNIQUE_ASSIST, keep = [THRUST_STYLE.rapier.gap, THRUST_STYLE.estoc.gap, UA.imbroccataGap];
  THRUST_STYLE.rapier.gap = 0.3; THRUST_STYLE.estoc.gap = 0.5; UA.imbroccataGap = 0.6;
  try {
    // 11/14 유파 AI 플랜(이탈리아 AI — config AI_PLAN · 기본 켬)도 그때 판(끔)으로 묶음: 거울 판의 AI 이탈리아가 본판 c1cad826 과 같은 몸이어야 해서 (플랜이 생긴 몫은 ai_plan.test 가 봄)
    const AP = CONFIG.AI_PLAN, apOn = AP.on;
    AP.on = 0;
    try {
      withIO({ on: 0 }, () => {
        assert.equal(hash(fightOne({ school: 'italian', weapon: 'rapier', opp: 'longsword', seed: 1 })), '905c89d08abf');
        assert.equal(hash(fightOne({ school: 'italian', weapon: 'rapier', opp: 'rapier', seed: 2 })), '63a6e3dacbfe');
      });
    } finally { AP.on = apOn; }
  } finally { [THRUST_STYLE.rapier.gap, THRUST_STYLE.estoc.gap, UA.imbroccataGap] = keep; }
  assert.notEqual(hash(fightOne({ school: 'italian', weapon: 'rapier', opp: 'longsword', seed: 1 })), '905c89d08abf', '켬 — 이탈리아 판은 바뀜');
  assert.equal(hash(fightOne({ school: 'german', weapon: 'sabre', opp: 'longsword', seed: 1 })), '436777985e44', '독일 — 켬이어도 같음 (본판 c1cad826 해시)');
});
