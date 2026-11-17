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
const ARM = () => CONFIG.SECRET.iaiArmTime + (CONFIG.SECRET.iaiSheathe > 0 ? CONFIG.SECRET.iaiSheathe : 0);

test("기본값: gnsReady 'idle' · iaiArmTime 2 · 싱지르 무장 2 · 들어옴 창 끔 (사장님 10/25 22:3x · 22:5x)", () => {
  assert.equal(SECRET.iaiArmTime, CONFIG.realS(2)); // 실제 2 s (표준 시간 10/25 — 게임 값 × 1.1)
  assert.equal(SECRET.ibSpin.armTime, CONFIG.realS(2));
  assert.equal(SECRET.gilmokArmTime, CONFIG.realS(1.5)); // 길목은 따로 열쇠 — 그대로 (실제 1.5 s)
  assert.equal(SECRET.gnsReadyStill, undefined); // 22:5x 규칙으로 바뀜 (걷기 스위치 없음)
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


