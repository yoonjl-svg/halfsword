// 이탈리아 아웃복싱 시험 (사장님 11/14 '이탈리아는 아웃복싱 스타일이야 … 찌르기 자체를 너프 … 걸어들어오는 상대를 카운터하면 +30%. 제안 A와 B 좋아.' —
//  config IT_OUTBOX · src/italian_outbox.js · 기록 docs/strike/it_outbox_2026-11-14.md):
//   1 찌르기 배율(판정 에너지 × thrustMul — 비기 배율과 같은 자리) · 2 맞박자 찌르기 +30 % 조건(걸어 들어옴 · 몫 열쇠 itTempo) · 3 칼 우위 켜짐 · 리솔루토는 칼 우위 밖에선 창이 안 열림 ·
//   4 박자 찌르기 조건(상대가 치기 시작한 0.4 s 안의 탭 — 스틱 옆 아니어도) · 스위치 끔이면 전 판 · 다른 유파 바이트 같음
//  node --test tools/sim/it_outbox.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CONFIG, newRound, THREE, AI } from './harness_m.mjs';
import { itThrust, itThrustKind, foeWalkingIn, itEdgeGrant, itEdgeOn, itEdgeOk, itOnStrike, beatOk, beatSide, beatTick, aiBeatTick, aiBeatTech } from '../../src/italian_outbox.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { kitFromNodes, allNodeIds, KIT_KEYS } from '../../src/skill_tree_data.js';
import { fightOne } from './school_balance.mjs';
import { THRUST_STYLE } from '../../src/weapons.js';
import { SCHOOL_PLAN, tiltOf, luckOf, itInqP } from '../../src/ai_plan.js';
const pinArc0 = (t) => { const on = CONFIG.AI_ARC.on; CONFIG.AI_ARC.on = 0; t.after(() => { CONFIG.AI_ARC.on = on; }); }; // 11/15 ① 둥근 칼 읽기 · 칼끝 틈(모든 AI — 사장님 11/15 결정)이 판을 바꾼 옛 장면은 그때 판(① 끔)으로 묶음 · 기준 그대로

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
  assert.equal(IO.beatHuman, 0, '11/15 사장님 \'l9는 이전처럼 되돌려\' — 사람 박자 찌르기 끔');
  assert.equal(IO.beatAi, 0, '11/15 사장님 \'ai도 되돌려\' — AI 박자 찌르기 끔');
  assert.ok(KIT_KEYS.includes('itTempo'));
  assert.equal(kitFromNodes('italian', new Set(['I1', 'I12'])).itTempo, true);
  assert.equal(kitFromNodes('italian', new Set(['I1'])).itTempo, false, 'I1 임시 이음은 걷음 (새 칸 I12)');
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
    swing(realS(0.3));
    assert.equal(B.tap(), false, '기본(beatHuman 0 — 11/15 사장님 \'l9는 이전처럼\') = 사람은 전 조건만: 위협 없음 · 스틱 가운데면 안 나감');
    IO.beatHuman = 1; // 아래는 11/14 판 (사람 박자 찌르기 — 스위치로만)
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
    IO.beatHuman = 0;
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

test('4 박자 찌르기 AI 몫 (11/15 사장님 \'ai도 되돌려\' — 기본 beatAi 0 = 늘 전 판 목록 · 아래는 beatAi 1 = 11/14 판): 상대 휘두름이 선 뒤 0.4 s 안이면 맞받아 베기 칼 = 비껴서며 찌르기 · 밖 · 이미 씀 · ai 0 · 끔 = 전 판 목록(null)', () => withIO({ beatAi: 1 }, () => {
  const foe = { skill: {}, stamina: {}, aiControlled: true, aiCtl: { mode: 'watch', phase: 'ready' } };
  const B = { f: { foe }, t: 0, foeAtk: null, foeSw: false, inqBeatSeen: -1 };
  const inq = { name: 'inquartata' };
  aiBeatTick(B, 0.1);
  assert.equal(aiBeatTech(B, inq), null, '상대가 안 휘두름');
  foe.aiCtl = { mode: 'attack', phase: 'strike' };
  aiBeatTick(B, 0.1);
  assert.equal(aiBeatTech(B, inq), inq, '치기 시작 — 비껴서며 찌르기');
  withIO({ beatAi: 0 }, () => assert.equal(aiBeatTech(B, inq), null, 'beatAi 0 (기본 — 11/15 \'ai도 되돌려\') = 박자 안이어도 전 판 목록'));
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
}));

/** AI 이탈리아(레이피어 · 숙련 prof — 자리 1 G.ai) 판 하나를 만들어 fn(ai) — 끝나면 지움 */
function itAi(prof, fn) {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'rapier', AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: 3 } });
  try { return fn(G.ai, G); } finally { G.world.free(); }
}
/** 굴림을 묶고 위협 하나에 respond — 첫 굴림(위협을 알아챔) 0.01 · 그 뒤 v · 굴림 수도 셈 */
function respondWith(ai, v, d, id = 101) {
  const rnd = Math.random;
  let n = 0;
  Math.random = () => (n++ === 0 ? 0.01 : v);
  try { return { ok: ai.respond({ id, line: 'highR', thrust: false }, d), n }; } finally { Math.random = rnd; }
}

test('11/15 AI 비껴서며 찌르기 기울기 (사장님 \'그냥 l9를 더 선호하게 하면 되잖아\' — ai_plan.js itInqP · AI_PLAN.it.inq 0.6): 몫 높음 0.6 · 가운데 0.5 · 지침 반 · 겁 × (1 − 0.8 공포) · 끔 0', () => {
  assert.equal(CONFIG.AI_PLAN.it.inq, 0.6);
  const fa = (prof, ph = 'contest', fear = 0) => ({ planC: SCHOOL_PLAN.italian[ph], planK: tiltOf(prof), planLuck: luckOf(prof), fear });
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  assert.ok(near(itInqP(fa(5)), 0.6) && near(itInqP(fa(6)), 0.6), '높음 (기울기 1)');
  assert.ok(near(itInqP(fa(3)), 0.5) && near(itInqP(fa(4)), 0.5), '가운데 (⅔ + ⅓ × 동전 0.5)');
  assert.ok(near(itInqP(fa(5, 'tired')), 0.3), '지침 칸 0.5');
  for (const ph of ['probe', 'contest', 'commit', 'ahead', 'finish', 'behind']) assert.equal(SCHOOL_PLAN.italian[ph].inq, 1, ph);
  assert.ok(near(itInqP(fa(5, 'contest', 0.5)), 0.36), '겁 0.5 → × 0.6');
  const AP = CONFIG.AI_PLAN, it0 = AP.it;
  AP.it = { ...it0, inq: 0 };
  try { assert.equal(itInqP(fa(5)), 0, '끔'); } finally { AP.it = it0; }
});

test('11/15 AI 비껴서며 찌르기 기울기 — 실제 AI respond: 굴림이 몫 안이면 맞받아 베기 앞에 비껴서며 찌르기(맞받아 베기 칼 · 굴림 하나 더) · 몫 밖 · 식는 동안 · 거리 밖 · 끔(굴림 수 그대로) = 전 판 · 박자 셈은 기본 안 돎', () => {
  itAi(5, (ai) => {
    assert.ok(ai.planIt && ai.school.techByName.inquartata, '숙련 5 이탈리아 플랜 몸 · 꾸러미에 비껴서며 찌르기');
    const r = respondWith(ai, 0.01, ai.M.reach);
    assert.equal(r.ok, true);
    assert.equal(ai.tech.name, 'inquartata');
    assert.equal(ai.why, 'counter');
    assert.equal(ai.stats.plan.inq, 1);
    assert.equal(ai.stats.counters, 1);
  });
  itAi(5, (ai) => {
    respondWith(ai, 0.99, ai.M.reach);
    assert.notEqual(ai.tech?.name, 'inquartata', '몫 밖');
    assert.equal(ai.stats.plan.inq, 0);
  });
  const calls = (inq) => itAi(5, (ai) => {
    const AP = CONFIG.AI_PLAN, it0 = AP.it;
    AP.it = { ...it0, inq };
    try { return respondWith(ai, 0.99, ai.M.reach).n; } finally { AP.it = it0; }
  });
  assert.equal(calls(0.6), calls(0) + 1, '끔이면 굴림을 안 함 (그 전 판과 굴림 차례 같음)');
  itAi(5, (ai) => {
    ai.specCool.inquartata = ai.sense.t; // 막 끝난 특수 공격 — 식는 중
    respondWith(ai, 0.01, ai.M.reach);
    assert.notEqual(ai.tech?.name, 'inquartata', '식는 동안');
    assert.equal(ai.stats.plan.inq, 0);
  });
  itAi(5, (ai) => {
    respondWith(ai, 0.01, ai.M.reach + 0.5);
    assert.notEqual(ai.tech?.name, 'inquartata', '맞받아 벨 거리 밖');
  });
  itAi(2, (ai) => assert.equal(ai.school.techByName.inquartata, undefined, '숙련 2 — 꾸러미에 없음 (낮음 띠)'));
  itAi(5, (ai, G) => {
    for (let k = 0; k < 30; k++) G.step();
    assert.equal(ai.itBeat, undefined, 'beatAi 0 — 박자 셈 안 돎');
    withIO({ beatAi: 1 }, () => G.step());
    assert.ok(ai.itBeat, 'beatAi 1 — 11/14 판 박자 셈');
  });
});

test('11/15 둘째 AI 비껴서며 찌르기 = 사람과 같은 운동학 칼 (UNIQUE_ASSIST.inqAi 1): 칼이 나가는 순간 requestArtThrust 몸 빼기 · 같은 이름 · 식힘 · 갈래 special(칼 우위) · 빼는 쪽 = 본 상대 칼 반대 · 끔(0) = 옛 탭 찌르기', () => {
  const UA = CONFIG.UNIQUE_ASSIST;
  assert.equal(UA.inqAi, 1);
  const go = (ai, G) => {
    for (let k = 0; k < 20; k++) G.step();
    assert.ok(ai.startAttack(ai.school.techByName.inquartata, 'counter', { noFeint: true, skipChamber: true }));
    ai.startStrike();
  };
  itAi(5, (ai, G) => {
    const me = ai.me;
    const st0 = me.stamina.value;
    go(ai, G);
    assert.ok(me.iaiReq || me.iai, '운동학 칼 부탁');
    assert.equal((me.iaiReq ?? me.iai).tech, 'inquartata', '같은 이름');
    assert.equal(ai.phase, 'strike');
    assert.equal(ai.inqRun, true);
    assert.equal(ai.stats.inqArt.fired, 1);
    assert.equal(ai.stats.specials.inquartata, 1, '특수 공격 셈 (식힘 시작)');
    assert.ok(me.stamina.value < st0 || me.stamina.infinite, '찌르기 기력');
    let k = 0;
    while ((me.iai || me.iaiReq) && k++ < 240) {
      G.step();
      if (me.iai) assert.equal(itThrustKind(me), 'special', '끄는 동안 갈래 = 비껴서며 찌르기');
    }
    assert.ok(k < 240, '칼이 끝남');
    G.step();
    assert.ok(ai.inqRun === false && ai.phase !== 'strike', '끝나면 다음 스텝에 뒤따름으로');
    assert.ok(ai.specCooling('inquartata'), '끝난 뒤 식힘 (사람과 같은 수)');
  });
  itAi(5, (ai, G) => {
    const UA0 = UA.inqAi;
    UA.inqAi = 0;
    try {
      go(ai, G);
      assert.ok(!ai.me.iaiReq && !ai.me.iai, '옛 판 — 운동학 칼 없음');
      assert.ok(ai.me.skill.tap, '옛 판 — 탭 찌르기 길');
      assert.equal(ai.stats.inqArt, undefined);
    } finally { UA.inqAi = UA0; }
  });
  itAi(5, (ai) => {
    const c = ai.me.bodies.chest.translation();
    const fc = ai.foe.bodies.chest.translation();
    const ux = fc.x - c.x, uz = fc.z - c.z, d = Math.hypot(ux, uz);
    const at = (lat) => ({ armed: true, cx: fc.x, cz: fc.z, mx: c.x + ux * 0.5 + (-uz / d) * lat, mz: c.z + uz * 0.5 + (ux / d) * lat });
    assert.equal(ai.inqSide(at(0.3)), -1, '본 칼이 내 오른쪽 — 왼쪽으로 뺌');
    assert.equal(ai.inqSide(at(-0.3)), 1, '왼쪽 — 오른쪽으로');
    assert.equal(ai.inqSide({ ...at(0.3), armed: false }), 1, '칼을 못 봄 — 기술 표 쪽(오른쪽)');
  });
});

const hash = (r) => createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 12);
