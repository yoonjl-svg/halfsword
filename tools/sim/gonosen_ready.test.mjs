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
  run(SECRET.iaiArmTime - 0.2, false, false);
  assert.equal(A.armed, false);
  run(0.1, false, true); // 쌓는 동안 걸음 → 셈 0
  assert.equal(A.t, 0);
  run(SECRET.iaiArmTime - 0.1, false, false);
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
    for (let i = 0; i < steps(SECRET.iaiArmTime + 0.1); i++) gnsArmTick(B, DT, true, true, { outside: true, busy: false });
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
  R.run(SECRET.iaiArmTime + 0.3);
  assert.ok(R.p.foeDistance() < R.view.foeReach, `거리 안 ${R.p.foeDistance().toFixed(2)} < ${R.view.foeReach.toFixed(2)}`);
  assert.ok(R.armedAt != null && Math.abs(R.armedAt - CONFIG.ARENA.startHold - SECRET.iaiArmTime) < 0.15, `준비 ${R.armedAt}`);
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
  R.run(SECRET.iaiArmTime + 0.2);
  assert.equal(R.ps.iaiArm.armed, false, '걸음 뜻이 있으면 안 쌓임');
  R.G.world.free();
  // 맞음 → 풀림
  const H = near({});
  H.run(SECRET.iaiArmTime + 0.1);
  assert.equal(H.ps.iaiArm.armed, true);
  H.p.pain += 0.2;
  H.run(DT);
  assert.equal(H.ps.iaiArm.armed, false, '맞음 (아픔 +0.05 넘게)');
  H.G.world.free();
  // 탭 → 풀림
  const T = near({});
  T.run(SECRET.iaiArmTime + 0.1);
  assert.equal(T.ps.iaiArm.armed, true);
  T.p.skill.thrust();
  T.run(DT);
  assert.equal(T.ps.iaiArm.armed, false, '탭 찌르기');
  T.G.world.free();
  // 옛 판: 거리 안에선 준비 안 됨
  const D = near({ gnsReady: 'dist' });
  withCfg({ gnsReady: 'dist' }, () => D.run(SECRET.iaiArmTime + 0.5));
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

test("④ 사람 웅크림 (10/25 23:0x 사장님 '플레이어도 고노센 준비가 되면 웅크리게 해.' — SECRET.gnsCrouch): 준비 → AI 와 같은 발도 대기 자세 · 손을 쉬면 칼이 왼 허리(발도가 그 자리에서) · 칼을 쥐면 손은 곧장 사람 것 · 막기로 풀리면 gnsCrouchOut 에 풀림 · 끄면 표시만", async () => {
  const THREE = await import('three');
  assert.equal(SECRET.gnsCrouch, 0); // 10/31 01:0x 사장님 '플레이어만 웅크리기 꺼' — 기본 끔 · 아래는 켠 판(`?gnsCrouch=1`)을 본다
  const gnsWas = SECRET.gnsCrouch;
  SECRET.gnsCrouch = 1;
  try {
  assert.equal(SECRET.gnsCrouchOut, 0.2);
  const R = near({});
  const p = R.p;
  R.run(SECRET.iaiArmTime + 1.0); // 웅크림이 다 들고 칼이 자리 잡은 뒤(켜지고 0.4 ~ 0.8 s 칼이 한 번 흔들림 — 칼날 방향 0.18 ~ 0.67 rad · 10/27 표준 시간 병합 뒤 0.6 s 에 재면 흔들림 끝 0.62)
  assert.equal(R.ps.iaiArm.armed, true);
  assert.ok(p.iaiReadyW > 0.99 && p.skill.thrustPose.w > 0.99, `웅크림 ${p.iaiReadyW} · 손 ${p.skill.thrustPose.w}`);
  // 발도가 그 자세에서: secret_instant.js 발도 시작의 '손이 왼 허리에 있나'(far) 셈 그대로 — 칼 손 · 칼날 방향이 발도 길 B(왼 허리) 곁
  const K = SECRET.iaiPath;
  const inv = p.yaw.clone().invert();
  const sw = p.sword.translation(), c = p.bodies.chest.translation();
  const AH = new THREE.Vector3(sw.x - c.x, sw.y - c.y, sw.z - c.z).applyQuaternion(inv);
  const AD = p.bladePoint(1, new THREE.Vector3()).sub(p.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  const yaw = (K.B.yaw * Math.PI) / 180, el = (K.B.el * Math.PI) / 180;
  const DB = new THREE.Vector3(Math.cos(el) * Math.cos(yaw), Math.sin(el), Math.cos(el) * Math.sin(yaw));
  assert.ok(AH.distanceTo(new THREE.Vector3(...K.B.hand)) <= 0.12, `손 ↔ 왼 허리 ${AH.distanceTo(new THREE.Vector3(...K.B.hand)).toFixed(3)} m`);
  assert.ok(AD.angleTo(DB) <= 0.6, `칼날 ↔ 왼 허리 방향 ${AD.angleTo(DB).toFixed(2)} rad`);
  // 칼을 쥐면(손가락 움직임) 손 · 칼은 곧장 사람 것 · 몸 웅크림 · 준비는 그대로
  p.inputActive = true;
  R.run(DT);
  assert.equal(p.skill.thrustPose.w, 0, '손 덧씌우기 곧장 0');
  assert.ok(p.iaiReadyW > 0.99 && R.ps.iaiArm.armed, '몸 웅크림 · 준비 그대로');
  p.inputActive = false;
  R.run(0.5);
  assert.ok(p.skill.thrustPose.w > 0.99, '손을 놓으면 다시 왼 허리');
  // 막기 단추 → 준비 풀림 → 손은 곧장 · 몸은 gnsCrouchOut 초에
  R.pg.held = true;
  R.run(DT);
  assert.equal(R.ps.iaiArm.armed, false);
  assert.equal(p.skill.thrustPose.w, 0);
  assert.ok(p.iaiReadyW > 0.85, `몸은 천천히 ${p.iaiReadyW}`);
  R.run(SECRET.gnsCrouchOut);
  assert.equal(p.iaiReadyW, 0, '0.2 s 에 다 풀림');
  R.G.world.free();
  // 맞음 → 손 · 몸 같이 gnsCrouchOut 에 풀림 (곧장 0 이 아님)
  const H = near({});
  H.run(SECRET.iaiArmTime + 0.6);
  H.p.pain += 0.2;
  H.run(DT);
  assert.equal(H.ps.iaiArm.armed, false);
  assert.ok(H.p.skill.thrustPose.w > 0.8 && H.p.skill.thrustPose.w < 1, `손도 천천히 ${H.p.skill.thrustPose.w}`);
  H.G.world.free();
  // 끄면 전 판 (표시만 — 10/31 허리 대기도 끈 판 `?gnsCrouch=0&gnsReadyHip=0` · 허리 대기는 아래 ⑦)
  const O = near({});
  withCfg({ gnsCrouch: 0, gnsReadyHip: 0 }, () => O.run(SECRET.iaiArmTime + 0.6));
  assert.equal(O.ps.iaiArm.armed, true);
  assert.ok(!(O.p.iaiReadyW > 0) && O.p.skill.thrustPose.w === 0, '?gnsCrouch=0&gnsReadyHip=0 — 자세 그대로');
  O.G.world.free();
  } finally {
    SECRET.gnsCrouch = gnsWas;
  }
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
  for (const [w, key, T] of [['uchigatana', 'iaiArm', SECRET.iaiArmTime], ['zweihander', 'spinArm', SECRET.ibSpin.armTime]]) {
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
  for (let i = 0; i < (hold + SECRET.iaiArmTime + 0.3) / DT; i++) { G.step(); if (at == null && G.ai.iaiArm?.armed) at = G.enemy.fightT; }
  assert.ok(at != null && at >= hold + SECRET.iaiArmTime - 3 * DT, `AI 고노센 준비 ${at}`);
  G.world.free();
});

test("⑦ 10/31 08:xx 웅크림 0 에서도 준비 · 창 (사장님 '웅크리기를 없앴더니 고노센 발동창이 안열려.' — SECRET.gnsReadyHip · docs/strike/gonosen_window_2026-10-31.md)", async () => {
  const THREE = await import('three');
  assert.equal(SECRET.gnsCrouch, 0);
  assert.equal(SECRET.gnsReadyHip, 1);
  assert.equal(SECRET.gnsRaiseLatch, 1);
  // 칼 쪽 화면에 얹은 손가락: 프레임(물리 두 스텝)마다 ±0.5 px 떨림(손 목표 ±3 mm — 휘두름 문턱 1.5 m/s 의 한참 아래) · 손가락 닿음(handHeld) · 쥠 아님(handGrip — 길게 누름 한도 안)
  const px = CONFIG.INPUT.touchSensitivity / 390;
  let n = 0, grip = false;
  const finger = (t, p) => {
    if (n++ % 2) return;
    const d = (n % 4 < 2 ? 0.5 : -0.5) * px;
    p.handOffset.x += d;
    p.handOffset.y -= d * 1.35;
    p.handHeld = true;
    p.inputActive = true;
    p.handGrip = grip;
  };
  for (const hip of [1, 0]) {
    n = 0;
    const R = near({ gnsReadyHip: hip }, finger);
    const p = R.p;
    const pel0 = p.bodies.pelvis.translation().y;
    withCfg({ gnsReadyHip: hip }, () => R.run(SECRET.iaiArmTime + 1.0));
    assert.ok(R.armedAt != null && Math.abs(R.armedAt - CONFIG.ARENA.startHold - SECRET.iaiArmTime) < 0.15, `hip ${hip}: 얹은 손가락 그대로 준비 ${R.armedAt}`);
    assert.equal(R.ps.iaiArm.armed, true);
    assert.equal(p.iaiReadyW ?? 0, 0, `hip ${hip}: 몸 웅크림 없음`);
    assert.ok(Math.abs(p.bodies.pelvis.translation().y - pel0) < 0.03, `hip ${hip}: 골반 높이 그대로 ${pel0.toFixed(3)} → ${p.bodies.pelvis.translation().y.toFixed(3)}`);
    if (hip) {
      assert.ok(p.skill.thrustPose.w > 0.99, `허리 대기 — 손 덧씌우기 ${p.skill.thrustPose.w}`);
      assert.equal(p.skill.thrustPose.pitch, 0, '몸 숙임 0');
      // 칼이 왼 허리 곁 · 칼끝은 왼 뒤 아래 (④ 와 같은 셈 — 선 몸이라 손은 발도 길 B 에서 0.2 m 안 · 발도는 발도 길 B 를 거쳐 나감 — 웅크림 끈 판과 같은 길)
      const K = SECRET.iaiPath;
      const inv = p.yaw.clone().invert();
      const sw = p.sword.translation(), c = p.bodies.chest.translation();
      const AH = new THREE.Vector3(sw.x - c.x, sw.y - c.y, sw.z - c.z).applyQuaternion(inv);
      const AD = p.bladePoint(1, new THREE.Vector3()).sub(p.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
      const yaw = (K.B.yaw * Math.PI) / 180, el = (K.B.el * Math.PI) / 180;
      const DB = new THREE.Vector3(Math.cos(el) * Math.cos(yaw), Math.sin(el), Math.cos(el) * Math.sin(yaw));
      assert.ok(AH.distanceTo(new THREE.Vector3(...K.B.hand)) <= 0.2, `손 ↔ 왼 허리 ${AH.distanceTo(new THREE.Vector3(...K.B.hand)).toFixed(3)} m`);
      assert.ok(AD.angleTo(DB) <= 0.6, `칼날 ↔ 왼 허리 방향 ${AD.angleTo(DB).toFixed(2)} rad`);
      assert.ok(p.bladePoint(1, new THREE.Vector3()).y < c.y - 0.2, '칼끝이 가슴 아래 (상대를 안 겨눔)');
      // 쥠(끌어서 길게 누름 한도를 넘음) → 곧장 사람 손 · 준비 그대로 · 놓으면 다시
      grip = true;
      withCfg({ gnsReadyHip: hip }, () => R.run(2 * DT));
      grip = false;
      assert.equal(p.skill.thrustPose.w, 0, '쥐면 곧장 0');
      assert.equal(R.ps.iaiArm.armed, true, '준비 그대로');
    } else assert.equal(p.skill.thrustPose.w, 0, '?gnsReadyHip=0 — 자세 그대로');
    R.G.world.free();
  }
  // 창: 준비된 채 상대가 발도 선 안(가슴 사이 1.6 m)에서 칼을 빠르게 듦 → 창(raise) — 허리 대기 켬 · 끔 모두
  for (const hip of [1, 0]) {
    const R = near({ gnsReadyHip: hip });
    withCfg({ gnsReadyHip: hip }, () => R.run(SECRET.iaiArmTime + 0.5));
    assert.equal(R.ps.iaiArm.armed, true);
    const e = R.G.enemy;
    const line = R.view.contact + SECRET.iaiStep + SECRET.iaiMargin;
    assert.ok(R.p.foeDistance() < line, `선 안 ${R.p.foeDistance().toFixed(2)} < ${line.toFixed(2)}`);
    const o0 = R.ps.opened;
    let ev = null;
    R.G.ai.update = () => { e.move.set(0, 0); if (e.handOffset.y < 0.45) e.handOffset.y += 0.03; }; // 손 목표를 물리 스텝마다 3 cm 위로 (3.6 m/s)
    for (let i = 0; i < steps(0.4) && ev == null; i++) { withCfg({ gnsReadyHip: hip }, () => R.G.step()); if (R.ps.opened > o0) ev = R.ps.open?.ctx?.ev ?? '?'; }
    assert.equal(ev, 'raise', `hip ${hip}: 칼을 듦 → 창`);
    R.G.world.free();
  }
  // 든 칼 이어 봄 (SECRET.gnsRaiseLatch): 선 밖에서 칼을 들고 그 칼로 선 안에 들면 창 · 끄면 창 없음
  for (const latch of [1, 0]) {
    const R = near({ gnsRaiseLatch: latch });
    withCfg({ gnsRaiseLatch: latch }, () => R.run(SECRET.iaiArmTime + 0.5));
    const e = R.G.enemy;
    const line = R.view.contact + SECRET.iaiStep + SECRET.iaiMargin;
    // 상대를 선 밖 0.15 m 로 옮김 (몸 전부 같은 만큼)
    const back = line + 0.15 - R.p.foeDistance();
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + back, y: t.y, z: t.z }, true); }
    e.anchor.setTranslation({ x: e.anchor.translation().x + back, y: e.anchor.translation().y, z: e.anchor.translation().z }, true);
    withCfg({ gnsRaiseLatch: latch }, () => R.run(0.4));
    assert.ok(R.p.foeDistance() > line, `선 밖 ${R.p.foeDistance().toFixed(2)} > ${line.toFixed(2)}`);
    const o0 = R.ps.opened;
    let ev = null, k = 0;
    R.G.ai.update = () => { k++; if (e.handOffset.y < 0.45) e.handOffset.y += 0.03; e.move.set(0, 0); if (k > 12) for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x - 0.01, y: t.y, z: t.z }, true); } }; // 칼을 들고(3.6 m/s) 0.1 s 뒤부터 1.2 m/s 로 다가옴
    for (let i = 0; i < steps(0.6) && ev == null; i++) { withCfg({ gnsRaiseLatch: latch }, () => R.G.step()); if (R.ps.opened > o0) ev = R.ps.open?.ctx; }
    if (latch) assert.ok(ev?.ev === 'raise' && ev.latched != null, `이어 봄 → 창 ${JSON.stringify(ev)}`);
    else assert.notEqual(ev?.ev, 'raise', `끄면 선 밖에서 든 칼은 '듦' 창 없음 (손이 멎으면 헛침 창은 그대로) ${JSON.stringify(ev)}`);
    R.G.world.free();
  }
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
    R.run(SECRET.iaiArmTime + 0.3);
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
