// 일본 고노센 준비 — 10/25 22:3x 사장님 '거리와 상관없이 '1.5초 동안 치지도 막지도 않고 침착하게 있으면 준비'로 바꾸는 것 이것도 좋다. 그렇게 바꿔.' · '시간도 1.5초에서 2초로' ·
//  22:5x(감독 전달) '아무 행동 없이 2초' = 이동 입력도 없이 · '고노센은 일단 준비가 활성화되면 걸어도 준비가 유지돼' (SECRET.gnsReady 'idle' — secret.js gnsArmTick · docs/strike/school_secret_2026-10-09.md §19):
//  ① 셈: 이동 입력 · 공격 · 막기 · 맞음 · 비기 없이 iaiArmTime 초 → 준비 · 준비 전 이동 입력은 셈 0 · 준비된 뒤 걸어도 유지 · 공격 · 막기 · 맞음 · 비기는 곧장 풀림 · 'dist' = 옛 셈(상대 칼 거리 밖 · 유예)
//  ② 실제 몸(사람 창): 상대 칼 거리 안에 서 있어도 준비 · 막기 단추 · 탭 · 맞음 → 풀림 · 준비된 뒤 걸어도 유지 · ?gnsReady=dist 면 거리 안에선 준비 안 됨
//  ③ AI: 같은 함수 — 걸음 뜻(moveFeet 의 스틱 원값)이 있으면 쌓이지 않음
//  ⑤ 10/27 21:4x AI 낮게 치기(SECRET.gnsCrouchAim — ai.js crouchLow): 웅크린 사람만 · 내 가슴 − 상대 가슴
//  ⑥ 10/27 23:0x 무장 시계(고노센 준비 · 싱지르)는 공격이 풀린 때(판 시작 정지 끝 — fighter.openHold)부터
//  ⑦ 10/31 08:xx 웅크림 0 에서도 준비 · 창(사장님 '웅크리기를 없앴더니 고노센 발동창이 안열려.'): 얹은 손가락(떨림)으로도 준비 · 허리 대기(SECRET.gnsReadyHip — 몸은 선 채 칼만 왼 허리) ·
//   쥠(handGrip)이면 곧장 사람 손 · 상대가 발도 선 안에서 칼을 들면 창 (허리 대기 켬 · 끔 모두) · 든 칼 이어 봄(SECRET.gnsRaiseLatch — 선 밖에서 든 칼로 선 안에 들면 창)
//  ⑧ 10/31 13:xx 사장님 '1-2번 다 고쳐': 스틱에 얹은 엄지(데드존 밖 조금)는 걸음 뜻 아님 — 몸을 걷게 할 때만(SECRET.gnsStickWalk) · 칼이 허리에 있는 동안 자세 이름 '발도 대기'(iaiReadyShown)
//  node --test tools/sim/gonosen_ready.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch, IaiArm, gnsArmTick, gnsMoving, gnsHumanMoving, gnsHumanUnsettled } from '../../src/secret.js';
import { iaiReadyShown, IAI_READY_STANCE } from '../../src/secret_instant.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const steps = (s) => Math.round(s / DT);

// 준비까지 (11/14 사장님 '2초 후에 납도 시작' — 일본 준비는 iaiArmTime 뒤 납도 SECRET.iaiSheathe 가 끝나야 · 帯刀 끄면 납도 없음 · secret.js IaiArm.extra)
const ARM = () => CONFIG.SECRET.iaiArmTime + (CONFIG.SECRET.iaiObi && CONFIG.SECRET.iaiSheathe > 0 ? CONFIG.SECRET.iaiSheathe : 0);

test("기본값: gnsReady 'idle' · iaiArmTime 2 · 싱지르 무장 2 · 들어옴 창 끔 (사장님 10/25 22:3x · 22:5x)", () => {
  assert.equal(SECRET.gnsReady, 'idle');
  assert.equal(SECRET.iaiArmTime, CONFIG.realS(2)); // 실제 2 s (표준 시간 10/25 — 게임 값 × 1.1)
  assert.equal(SECRET.ibSpin.armTime, CONFIG.realS(2));
  assert.equal(SECRET.gilmokArmTime, CONFIG.realS(1.5)); // 길목은 따로 열쇠 — 그대로 (실제 1.5 s)
  assert.equal(SECRET.gnsWalkIn, 0);
  assert.equal(SECRET.gnsReadyStill, undefined); // 22:5x 규칙으로 바뀜 (걷기 스위치 없음)
});

test("① 셈 'idle': 쌓는 동안 이동 입력이면 0 · 준비된 뒤엔 걸어도 유지 · 공격 · 막기 · 맞음 · 비기면 곧장 풀림 (유예 없음)", () => {
  const A = new IaiArm();
  const run = (s, unsettled, moving) => { for (let i = 0; i < steps(s); i++) gnsArmTick(A, DT, unsettled, moving, { outside: false, busy: true }); };
  run(ARM() - 0.2, false, false);
  assert.equal(A.armed, false);
  run(0.1, false, true); // 쌓는 동안 걸음 → 셈 0
  assert.equal(A.t, 0);
  run(ARM() - 0.1, false, false);
  assert.equal(A.armed, false);
  run(0.2, false, false);
  assert.equal(A.armed, true, '이동 입력 없이 iaiArmTime 초');
  run(1, false, true);
  assert.equal(A.armed, true, '준비된 뒤엔 걸어도 유지');
  run(DT, true, false);
  assert.equal(A.armed, false, '공격 · 막기 · 맞음 · 비기 → 곧장 풀림');
  assert.equal(A.t, 0);
  // 'dist' = 옛 셈 그대로 (old 의 outside · busy — 걸음은 안 봄)
  withCfg({ gnsReady: 'dist' }, () => {
    const B = new IaiArm();
    for (let i = 0; i < steps(ARM() + 0.1); i++) gnsArmTick(B, DT, true, true, { outside: true, busy: false });
    assert.equal(B.armed, true, "'dist' — 밖이면 걸어도 · unsettled 여도 쌓임 (옛 판은 휘두름 · 비기만 — old.busy)");
    gnsArmTick(B, DT, false, false, { outside: false, busy: false });
    assert.equal(B.armed, true, '간격 안 — 유예 동안 남음');
    for (let i = 0; i < steps(SECRET.iaiArmGrace + 0.05); i++) gnsArmTick(B, DT, false, false, { outside: false, busy: false });
    assert.equal(B.armed, false, '유예 뒤 풀림');
  });
});

test('걸음 뜻 · 사람 풀림 몫: 스틱 원값 0 이 아니면 걸음 · 휘두름 · 탭 · 손잡이 찍기 · 비기 · 막기 단추 · 맞음', () => {
  assert.equal(gnsMoving({ stickX: 0, stickY: 0 }), false);
  assert.equal(gnsMoving({ stickX: 0, stickY: 0.05 }), true);
  assert.equal(gnsMoving({ stickX: -0.3, stickY: 0 }), true);
  const f = (skill = {}, held = false) => ({ skill, parryGuard: { held } });
  assert.equal(gnsHumanUnsettled(f(), false), false);
  for (const k of ['swinging', 'tap', 'pom', 'sec']) assert.equal(gnsHumanUnsettled(f({ [k]: true }), false), true, k);
  assert.equal(gnsHumanUnsettled(f({}, true), false), true, '막기 단추');
  assert.equal(gnsHumanUnsettled(f(), true), true, '맞음');
});

// 실제 몸: 모노호시자오 사람 · 상대 롱소드(가만히 선 몸 — AI 없음) · 가슴 사이 1.6 m (상대 칼 거리 안)
function near(vals, drive) {
  return withCfg(vals, () => {
    const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 3, gap: 1.6 });
    G.ai.update = () => G.enemy.move.set(0, 0);
    const p = G.player, e = G.enemy;
    p.skill.autoGuard = true;
    const pg = new PlayerParryGuard(p, e);
    p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    const out = { armedAt: null, log: [] };
    G.before = (t) => {
      drive?.(t, p, pg, ps, out);
      ps.update(DT, !!p.skill.sec);
      if (ps.iaiArm.armed && out.armedAt == null) out.armedAt = t;
    };
    out.view = ps.view();
    out.run = (s) => { for (let i = 0; i < steps(s); i++) G.step(); };
    out.G = G;
    out.ps = ps;
    out.p = p;
    out.pg = pg;
    out.run(CONFIG.ARENA.startHold); // 판 시작 정지 동안은 무장 시계가 안 감 (10/27 23:0x — SECRET.armAtFight) — 시험 시각은 공격이 풀린 때부터
    return out;
  });
}

test('② 실제 몸: 상대 칼 거리 안에 서 있어도 iaiArmTime 뒤 준비 · 막기 단추 · 탭 · 맞음이면 풀림 · 준비된 뒤 걸어도 유지 · dist 면 준비 안 됨', () => {
  const R = near({});
  R.run(ARM() + 0.3);
  assert.ok(R.p.foeDistance() < R.view.foeReach, `거리 안 ${R.p.foeDistance().toFixed(2)} < ${R.view.foeReach.toFixed(2)}`);
  assert.ok(R.armedAt != null && Math.abs(R.armedAt - CONFIG.ARENA.startHold - ARM()) < 0.15, `준비 ${R.armedAt}`);
  // 걸어도 유지
  R.p.stickY = 0.5;
  R.G.before = ((b) => (t) => { R.p.stickX = 0; R.p.stickY = 0.5; R.p.move.set(0, 0); b(t); })(R.G.before);
  R.run(0.5);
  assert.equal(R.ps.iaiArm.armed, true, '준비된 뒤 걸음 → 유지');
  // 막기 단추 → 풀림
  R.pg.held = true;
  R.run(DT);
  assert.equal(R.ps.iaiArm.armed, false, '막기 단추');
  R.pg.held = false;
  // 걷는 동안엔 다시 쌓이지 않음
  R.run(ARM() + 0.2);
  assert.equal(R.ps.iaiArm.armed, false, '걸음 뜻이 있으면 안 쌓임');
  R.G.world.free();
  // 맞음 → 풀림
  const H = near({});
  H.run(ARM() + 0.1);
  assert.equal(H.ps.iaiArm.armed, true);
  H.p.pain += 0.2;
  H.run(DT);
  assert.equal(H.ps.iaiArm.armed, false, '맞음 (아픔 +0.05 넘게)');
  H.G.world.free();
  // 탭 → 풀림
  const T = near({});
  T.run(ARM() + 0.1);
  assert.equal(T.ps.iaiArm.armed, true);
  T.p.skill.thrust();
  T.run(DT);
  assert.equal(T.ps.iaiArm.armed, false, '탭 찌르기');
  T.G.world.free();
  // 옛 판: 거리 안에선 준비 안 됨
  const D = near({ gnsReady: 'dist' });
  withCfg({ gnsReady: 'dist' }, () => D.run(ARM() + 0.5));
  assert.equal(D.armedAt, null, "?gnsReady=dist — 상대 칼 거리 안");
  D.G.world.free();
});

test('③ AI: 같은 셈 — 일본 AI(숙련도 5)는 걸음 뜻이 없고 공격 · 막기 꼴이 아닐 때만 쌓임 (secretScan 이 읽는 iaiArm)', async () => {
  const { AI } = await import('./harness_m.mjs');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const J = CHARACTERS_BY_ID.minami;
  const G = newRound({ weapon: 'longsword', weapon2: J.weapon, seed: 2, difficulty: J.ai.level, persona: J.ai.persona, gap: 3.2 });
  assert.equal(G.ai.secret?.name, 'goNoSen');
  const A = G.ai.iaiArm;
  let movingBuild = 0;
  G.before = () => { G.player.move.set(0, 0); };
  for (let i = 0; i < steps(12); i++) {
    const was = A.t;
    const mv = gnsMoving(G.enemy); // AI 는 준비 셈(updateCombat) 뒤에 moveFeet 가 스틱을 씀 — 셈은 지난 스텝의 걸음 뜻을 읽는다
    G.step();
    if (!A.armed && A.t > was && mv) movingBuild++; // 걸음 뜻이 있는데 쌓임 — 없어야
  }
  assert.equal(movingBuild, 0, '쌓는 동안 걸음 뜻 없음');
  G.world.free();
});


test('⑤ 10/27 21:4x AI 가 웅크린 사람에게 낮게 침 (SECRET.gnsCrouchAim): 늦게 본 모습이 웅크림 · 상대가 사람이면 내 가슴 − 상대 가슴 · 서 있음 · AI 상대 · 끔이면 0', async () => {
  const { AI } = await import('../../src/ai.js');
  const me = { bodies: { chest: { translation: () => ({ x: 0, y: 1.3, z: 0 }) } } };
  const low = (seen, foe = {}) => AI.prototype.crouchLow.call({ lastSeen: seen, foe, me });
  assert.ok(Math.abs(low({ crouch: 0.6, cy: 1.0 }) - 0.3) < 1e-9, '웅크린 사람 — 가슴 높이 차');
  assert.equal(low({ crouch: 0, cy: 1.0 }), 0, '서 있음(웅크림 무게 0) — 그대로');
  assert.equal(low({ crouch: 1, cy: 1.0 }, { aiControlled: true }), 0, 'AI 상대 — 그대로');
  assert.equal(low({ crouch: 1, cy: 1.4 }), 0, '상대가 더 높으면 0 (내리기만)');
  assert.equal(low(null), 0);
  withCfg({ gnsCrouchAim: 0 }, () => assert.equal(low({ crouch: 1, cy: 1.0 }), 0, '끔 = 7b02877 판'));
});

test('⑥ 10/27 23:0x 무장 시계는 공격이 풀린 때(판 시작 정지 ARENA.startHold 끝 — fighter.openHold)부터: 사람 고노센 준비 · 싱지르 무장 · AI 고노센 준비 — 정지 동안 0 · 풀린 뒤 무장 시간에 켜짐', async () => {
  const { AI } = await import('../../src/ai.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const hold = CONFIG.ARENA.startHold;
  assert.ok(hold > 0);
  for (const [w, key, T] of [['uchigatana', 'iaiArm', ARM()], ['zweihander', 'spinArm', SECRET.ibSpin.armTime]]) {
    const G = newRound({ weapon: w, weapon2: 'longsword', seed: 1 });
    G.ai.update = () => G.enemy.move.set(0, 0);
    const ps = new PlayerSecretWatch(G.player, G.enemy);
    G.before = () => ps.update(DT, !!G.player.skill.sec);
    let at = null, maxT = 0;
    for (let i = 0; i < (hold + T + 0.3) / DT; i++) {
      G.step();
      if (G.player.openHold) maxT = Math.max(maxT, ps[key].t);
      if (at == null && ps[key].armed) at = G.player.fightT;
    }
    assert.equal(maxT, 0, `${key} 정지 동안 셈 0`);
    assert.ok(at != null && Math.abs(at - (hold + T)) < 3 * DT, `${key} 공격이 풀리고 무장 시간 뒤 ${at}`);
    G.world.free();
  }
  const C = CHARACTERS_BY_ID.minami;
  const G = newRound({ weapon: 'longsword', weapon2: C.weapon, seed: 1, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, gap: 6 });
  G.before = () => G.player.move.set(0, 0);
  let at = null;
  for (let i = 0; i < (hold + ARM() + 0.3) / DT; i++) { G.step(); if (at == null && G.ai.iaiArm?.armed) at = G.enemy.fightT; }
  assert.ok(at != null && at >= hold + ARM() - 3 * DT, `AI 고노센 준비 ${at}`);
  G.world.free();
});


test("⑧ 10/31 13:xx 사장님 '1-2번 다 고쳐': 스틱 위 엄지는 몸을 걷게 할 때만 걸음 뜻 (SECRET.gnsStickWalk) · 허리 대기 동안 자세 이름 '발도 대기'", () => {
  const { GAIT } = CONFIG;
  assert.equal(SECRET.gnsStickWalk, 1);
  // 문턱 = 몸이 가려는 빠르기 > GAIT.walkMin (일본 걸음 빠르기 0.67) — 앞 1 · 뒤 backFactor · 옆 sideFactor
  const f = (x, y) => ({ stickX: x, stickY: y, gait: { P: { speedMul: 0.67 } } });
  const k = GAIT.moveSpeed * 0.67;
  const fwd = GAIT.walkMin / k, back = GAIT.walkMin / (k * GAIT.backFactor), side = GAIT.walkMin / (k * GAIT.sideFactor);
  assert.equal(gnsHumanMoving(f(0, 0)), false);
  for (const [nm, m, x, y] of [['앞', fwd, 0, 1], ['뒤', back, 0, -1], ['옆', side, 1, 0]]) {
    assert.equal(gnsHumanMoving(f(x * m * 0.9, y * m * 0.9)), false, `${nm} 문턱 아래 (${(m * 0.9).toFixed(3)})`);
    assert.equal(gnsHumanMoving(f(x * m * 1.1, y * m * 1.1)), true, `${nm} 문턱 위 (${(m * 1.1).toFixed(3)})`);
  }
  // 데드존 밖 몇 px 떠돈 엄지 (스틱 반지름 40 px · 데드존 0.15 — input.js attachStick): 가운데에서 9 px → 데드존 뒤 0.088 → 걸음 뜻 아님 · 25 px → 0.56 → 걸음
  const post = (px) => (px / 40 - 0.15) / 0.85;
  assert.equal(gnsHumanMoving(f(0, post(9))), false, '얹은 엄지 9 px');
  assert.equal(gnsHumanMoving(f(post(9) * 0.6, post(9) * 0.8)), false, '비스듬히 9 px');
  assert.equal(gnsHumanMoving(f(0, post(25))), true, '앞으로 민 25 px — 걸음');
  assert.ok(gnsMoving(f(0, post(9))), 'AI 자기 준비 · 옛 판은 0 이 아니면 걸음');
  withCfg({ gnsStickWalk: 0 }, () => assert.equal(gnsHumanMoving(f(0, post(9))), true, '?gnsStickWalk=0 — 0 이 아니면 걸음'));
  // 실제 몸: 얹은 엄지(앞 9 px 쯤 · 0.088)로 서 있음 → iaiArmTime 에 준비 · 앞으로 민 엄지(0.56)는 준비 안 됨 (몸이 걸음)
  for (const [m, want] of [[post(9), true], [post(25), false]]) {
    const R = near({}, (t, p) => { p.stickX = 0; p.stickY = m; p.move.set(0, m); });
    R.run(ARM() + 0.3);
    assert.equal(R.ps.iaiArm.armed, want, `스틱 ${m.toFixed(3)} → 준비 ${want}`);
    if (want) {
      // 허리 대기 동안 자세 이름 '발도 대기' · 칼을 쥐면 아님
      R.run(0.5);
      assert.ok(iaiReadyShown(R.p), `칼이 허리 (손 몫 ${R.p.iaiHandW})`);
      R.p.handGrip = true;
      R.run(DT);
      assert.equal(iaiReadyShown(R.p), false, '쥐면 보통 자세 이름으로');
    }
    R.G.world.free();
  }
  assert.equal(IAI_READY_STANCE.name, '발도 대기');
});
