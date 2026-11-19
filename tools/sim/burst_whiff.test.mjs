// 뒤 박차기 헛침 경직 시험 (11/19 [사장님 결정] '뒤로 박차서 상대 칼을 헛치게 하면, 그 상대는 헛친 칼이 끝난 뒤 0.6초 동안 경직 (막기 · 공격 불가)'
//  — src/burst_whiff.js · config BURST_WHIFF · 기록 docs/strike/burst_whiff_2026-11-19.md)
//  ① 칼이 나가는 동안 뒤 박차기 + 아무 데도 안 닿고 끝남 → 굳음 ② 몸에 닿음 → 안 굳음 · 칼끼리 · 코등이 닿음은 헛침 그대로 (11/19 [사장님 답] '권고대로' — 몸에 안 닿으면 헛침) ③ 박차기 없음 → 안 굳음 ④ 처음부터 칼끝 밖 → 안 굳음
//  ⑤ 칼이 나가기 전(기록 없음) · 칼이 끝난 뒤에야 뗀 박찬 걸음 · 비기 칼 → 표시 없음 ⑥ 굳은 동안 AI 는 막기 · 공격 없음 · 걸음 0 ⑦ 굳은 동안 사람은 막기 단추 · 칼 · 입력 막음(검술 층 'stiff')
//  ⑧ 걸음 장치: 사람 독일 몸이 서 있다가 뒤로 밀면 뗀 박찬 걸음이 표시를 남김 (gait.js fastBegin)
//  ⑨ 박찬 걸음(발 뜬 시간) 동안 나간 칼도 박찬 칼 · 칼끝 거리는 박차기 전 자리로도 봄 (11/19 §8 — 칼이 떠나는 순간을 읽고 먼저 박참)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, DT } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { bwAtkStart, bwAtkEnd, bwAtkDrop, bwAim, bwBurst, bwTouch, bwStiff, bwElapsed, bwDragW } from '../../src/burst_whiff.js';

const { BURST_WHIFF, ARENA } = CONFIG;

/** 사람 자리(P — 박차는 쪽 X · 사람 입력 몸) 대 AI(E — 치는 쪽 Y) · 가슴 사이 gap m · 판 시작 정지를 지나 AI 판단은 멈춤(꼴을 손으로 놓음) */
function duel(gap) {
  const G = newRound({ seed: 2, walls: true, weapon: 'longsword', weapon2: 'longsword', gap });
  const ai = G.ai;
  ai.update = () => {};
  while (G.t < ARENA.startHold + 0.1) G.step();
  return { G, X: G.player, Y: G.enemy, ai };
}
/** Y 의 칼이 X 를 겨눠 나가는 중 (AI 공격 꼴 'strike') */
function swing(D) {
  D.ai.mode = 'attack';
  D.ai.phase = 'strike';
  bwAtkStart(D.Y);
}

test('① 칼이 나가는 동안 뒤 박차기 + 몸에 안 닿고 끝남 → 그 칼이 끝난 때부터 BURST_WHIFF.stiff 동안 굳음 ([사장님 11/19 승인] 시간 사다리 1.2 · 그 가운데 앞 0.6 끌려감)', () => {
  const D = duel(1.6); // 11/19 보정 v2 묶음: 1.3 m 에선 손으로 놓은 AI 꼴(날것 손 목표)의 칼이 첫 스텝에 사람 칼에 닿아 그 공격의 닿음이 됨 — 칼끝 거리 안 1.6
  try {
    assert.ok(Math.abs(BURST_WHIFF.stiff - CONFIG.realS(1.2)) < 1e-12);
    assert.ok(Math.abs(BURST_WHIFF.drag - CONFIG.realS(0.6)) < 1e-12, '끌려감 = 앞 0.6');
    assert.ok(Math.abs(CONFIG.SECRET.stiff.german - CONFIG.realS(0.6)) < 1e-12, '비기 경직은 그대로 0.6');
    swing(D);
    assert.equal(D.Y.bwAtk.inReach, true, '가슴 사이 1.6 m — 롱소드 칼끝 거리 안');
    bwBurst(D.X);
    assert.equal(D.Y.bwAtk.burst, true);
    assert.equal(bwAtkEnd(D.Y, false, false), true);
    assert.equal(D.Y.bwStiffT, BURST_WHIFF.stiff);
    assert.ok(bwStiff(D.Y));
    const n = Math.round(BURST_WHIFF.stiff / DT);
    for (let i = 0; i < n - 2; i++) D.G.step();
    assert.ok(bwStiff(D.Y), '아직 굳음');
    for (let i = 0; i < 4; i++) D.G.step();
    assert.ok(!bwStiff(D.Y), 'stiff 초 뒤 풀림');
    assert.equal(D.Y.bwStats.stiff, 1);
  } finally {
    D.G.world.free();
  }
});

test('② 몸에 닿음(판정 문턱 밑 · 운동학 칼) · 그 몸이 센 맞힘 → 안 굳음 · 칼끼리 · 코등이 닿음(막기로 받아낸 칼)은 헛침 그대로 (11/19 몸에 안 닿으면 헛친 것)', () => {
  const D = duel(1.6); // 11/19 보정 v2 묶음: 1.3 m 에선 손으로 놓은 AI 꼴(날것 손 목표)의 칼이 첫 스텝에 사람 칼에 닿아 그 공격의 닿음이 됨 — 칼끝 거리 안 1.6
  try {
    for (const hit of ['body', 'kin', 'landed']) {
      swing(D);
      bwBurst(D.X);
      if (hit !== 'landed') bwTouch(D.Y, D.X, hit);
      assert.equal(bwAtkEnd(D.Y, hit === 'landed'), false, hit);
      assert.ok(!bwStiff(D.Y), hit);
    }
    assert.equal(D.Y.bwStats.touched, 3);
    swing(D);
    bwBurst(D.X);
    bwTouch(D.Y, D.X, 'blade'); // 칼끼리 닿음 (막기 단추 · AI 막기가 받아냄 · 코등이)
    assert.equal(bwAtkEnd(D.Y), true, '칼끼리만 닿음 → 헛침 → 굳음');
    assert.equal(D.Y.bwStats.bladeOnly, 1);
    D.Y.bwStiffT = 0;
    // 굳은 바로 그 스텝의 칼끼리 닿음도 거두지 않음 (몸 닿음만 거둠)
    swing(D);
    bwBurst(D.X);
    assert.equal(bwAtkEnd(D.Y), true);
    D.Y.fightT += D.Y.lastDt;
    bwTouch(D.Y, D.X, 'blade');
    assert.ok(bwStiff(D.Y), '같은 스텝 칼끼리 닿음은 그대로 굳음');
    D.Y.bwStiffT = 0;
    // 그 칼이 끝난 바로 그 물리 스텝의 닿음(끝을 정한 뒤 다 느려진 칼끝이 스침)도 그 공격의 닿음 → 막 건 굳음을 거둠 · 한 스텝 뒤 닿음은 아님
    swing(D);
    bwBurst(D.X);
    assert.equal(bwAtkEnd(D.Y), true);
    D.Y.fightT += D.Y.lastDt;
    bwTouch(D.Y, D.X);
    assert.ok(!bwStiff(D.Y), '같은 스텝 닿음 → 거둠');
    swing(D);
    bwBurst(D.X);
    assert.equal(bwAtkEnd(D.Y), true);
    D.G.step();
    D.G.step();
    bwTouch(D.Y, D.X);
    assert.ok(bwStiff(D.Y), '두 스텝 뒤 닿음은 그 공격 밖');
    D.Y.bwStiffT = 0;
    // 다른 몸에 닿은 것은 셈하지 않음 (겨눈 상대만)
    swing(D);
    bwBurst(D.X);
    bwTouch(D.Y, D.Y);
    assert.equal(bwAtkEnd(D.Y), true, '겨눈 상대 밖 닿음은 셈 안 함');
  } finally {
    D.G.world.free();
  }
});

test('③ 뒤 박차기 없이 헛침 → 안 굳음 · ④ 처음부터 칼끝 밖(닿지 않을 칼) → 박차도 안 굳음', () => {
  const D = duel(1.3);
  try {
    swing(D);
    assert.equal(bwAtkEnd(D.Y), false, '박차기 없음');
    assert.ok(!bwStiff(D.Y));
  } finally {
    D.G.world.free();
  }
  const F = duel(3.2);
  try {
    swing(F);
    assert.equal(F.Y.bwAtk.inReach, false, '가슴 사이 3.2 m — 칼끝 밖');
    bwBurst(F.X);
    assert.equal(bwAtkEnd(F.Y), false);
    assert.ok(!bwStiff(F.Y));
    assert.equal(F.Y.bwStats.far, 1);
  } finally {
    F.G.world.free();
  }
});

test('⑤ 칼이 나가기 전(공격 기록 없음 — AI 는 startStrike 에서 엶) · 칼이 끝난 뒤에야 뗀 박찬 걸음 · 비기 칼 → 표시 없음', () => {
  const D = duel(1.3);
  try {
    D.ai.mode = 'attack';
    D.ai.phase = 'windup';
    assert.equal(bwAim(D.X), null, '준비 · 다가감 — 칼이 아직 안 나감');
    const early = bwAim(D.X); // 칼을 들 때 미리 읽고 건 박차기 (건 때는 기록 없음)
    swing(D); // 그 뒤 칼이 나감
    bwBurst(D.X, early); // 뗄 때 나가는 중 → 표시
    assert.equal(D.Y.bwAtk.burst, true, '미리 읽고 건 박차기도 뗄 때 칼이 나가는 중이면 표시');
    bwAtkDrop(D.Y);
    D.X.bwBurstAt = null; // (그 걸음이 다 끝난 뒤)
    swing(D);
    const aim = bwAim(D.X);
    assert.equal(aim?.length, 1, '박차기를 걸 때 나가는 칼');
    bwAtkDrop(D.Y); // 그 칼이 끝남(거둠)
    bwBurst(D.X, aim); // 그 뒤에야 박찬 걸음을 뗌
    assert.equal(aim[0].burst, false, '끝난 칼엔 표시 없음');
    D.X.bwBurstAt = null; // (그 걸음이 다 끝난 뒤)
    swing(D);
    const aim2 = bwAim(D.X);
    assert.equal(bwAtkEnd(D.Y), false, '박찬 걸음을 떼기 전에 칼이 끝남 → 안 굳음');
    bwBurst(D.X, aim2);
    assert.ok(!bwStiff(D.Y));
    swing(D);
    D.ai.secretRun = { stage: 'run' };
    assert.equal(bwAim(D.X), null, '비기 칼');
    D.ai.secretRun = null;
  } finally {
    D.G.world.free();
  }
});

test('⑥ 굳은 AI: 공격 문이 막힘 · 위협에 답하지 않음(위협 번호도 안 씀) · 꼴 분기 없음 · 뜻대로 걷기 없음(비틀 걸음만) · 칼은 끌려갔다가 쉴 자세로 — 풀리면 다시 막음', () => {
  const D = duel(1.6);
  const { ai, Y, X } = D;
  try {
    delete ai.update; // 원래 판단으로
    swing(D);
    bwBurst(X);
    ai.hitLanded = ai.bound = false;
    ai.afterStrike(1.6);
    assert.ok(bwStiff(Y), 'afterStrike 가 굳힘');
    Y.bwEnd = null; // 끝난 스텝의 늦은 닿음 셈(②)은 이 시험 밖 — 11/19 보정 v2 묶음: 원래 판단으로 돌린 AI 의 간 보기 손이 첫 스텝에 사람 칼에 닿아 굳음을 거두던 장면
    assert.equal(ai.mode, 'watch', '이어 치기 · 물러남 없이 간 보기 꼴로');
    assert.equal(ai.stats.bwStiff, 1);
    const tech = ai.school.tech[0];
    assert.equal(ai.startAttack(tech, 'patience'), false, '공격 시작 없음');
    assert.equal(ai.startAttack(tech, 'follow', { chain: 1 }), false, '이어 치기 없음');
    const seen = ai.threatSeen;
    assert.equal(ai.respond({ id: 777, line: 'highC', thrust: false, tc: 0.1 }, 1.6), false, '막기 없음');
    assert.equal(ai.threatSeen, seen, '위협 번호 그대로');
    for (let i = 0; i < 10; i++) D.G.step();
    assert.ok(bwStiff(Y));
    assert.notEqual(ai.mode, 'attack');
    assert.notEqual(ai.mode, 'defend');
    const { step, stepT } = BURST_WHIFF;
    assert.ok(Math.abs(Y.move.length() - step) < 1e-6 && Y.move.y > 0, '비틀 걸음 스틱 (앞으로 step)');
    while (bwStiff(Y) && bwElapsed(Y) < stepT + DT) D.G.step();
    assert.equal(Y.move.length(), 0, '비틀 걸음 뒤엔 걸음 0 (AI 걸음 판단은 0 · 굳음이 스틱을 덮음)');
    while (bwStiff(Y)) D.G.step();
    const home = Y.swordArt?.restGuard?.pad ?? CONFIG.SKILL.homeGuard;
    assert.ok(Math.hypot(Y.handOffset.x - home[0], Y.handOffset.y - home[1]) < 0.02, '굳음 끝 = 쉴 자세');
    ai.threatSeen = -1;
    ai.level = { ...ai.level, guardChance: 1 };
    assert.equal(ai.respond({ id: 778, line: 'highC', thrust: false, tc: 0.1 }, 1.6), true, '풀리면 다시 막음');
  } finally {
    D.G.world.free();
  }
});

test('⑦ 굳은 사람: 검술 층 secretPhase = stiff (main.js 가 칼 · 막기 · 스틱 입력을 막는 같은 문) · 막기 단추가 손을 못 쥠 · 칼은 굳은 자리', () => {
  const D = duel(1.6);
  const P = D.X;
  try {
    const guard = new PlayerParryGuard(P, D.Y);
    P.stamina.controller = guard;
    guard.held = true;
    guard.step(DT);
    assert.equal(guard.active, true, '굳기 전엔 막기 단추가 쥠');
    guard.held = false;
    guard.step(DT);
    P.bwStiffT = BURST_WHIFF.stiff;
    assert.equal(P.skill.secretPhase, 'stiff');
    guard.held = true;
    assert.equal(guard.step(DT), false);
    assert.equal(guard.active, false, '굳은 동안 막기 없음');
    D.G.step();
    P.handOffset.x += 0.3; // 손 목표를 한 스텝에 크게 끌어도 (main.js 는 굳은 동안 손가락 끌기를 더하지 않음 — 여기선 문을 건너 직접)
    D.G.step();
    assert.equal(P.skill.swinging, false, '휘두름이 안 섬 (whiffDrag — 손 목표는 끌려감 · 되찾음 길 · 손 빠르기 0)');
    assert.equal(P.skill.vel.length(), 0);
    while (bwStiff(P)) D.G.step();
    assert.equal(P.skill.secretPhase, null, '풀림');
    for (let i = 0; i < 30; i++) D.G.step();
    P.handOffset.x -= 0.3; // 견줌: 풀린 뒤 같은 끌기는 휘두름
    D.G.step();
    assert.equal(P.skill.swinging, true, '풀린 뒤 같은 끌기 = 휘두름');
    assert.equal(guard.step(DT), true);
    assert.equal(guard.active, true, '풀리면 막기 단추가 다시 쥠');
  } finally {
    D.G.world.free();
  }
});

test('⑧ 걸음 장치: 사람 독일 몸이 서 있다가(두 발 땅) 뒤로 밀면 뗀 뒤 박찬 걸음이 그 칼에 표시 · 옆 박찬 걸음은 표시 안 함', () => {
  const D = duel(1.3);
  const { X, Y } = D;
  /** 걷지 않고 두 발이 땅에 있고 박찬 빠르기를 다 줄일 때까지 (뒤 박차기가 걸리는 '서 있음') */
  const stand = () => {
    X.move.set(0, 0);
    for (let i = 0; i < 900 && (X.gait.walking || !X.gait.legs.F.stance || !X.gait.legs.B.stance || X.gait.burstBrake); i++) D.G.step();
    assert.ok(!X.gait.walking && X.gait.legs.F.stance && X.gait.legs.B.stance && !X.gait.burstBrake, '서 있음');
  };
  try {
    assert.equal(X.swordArt.tradition, 'german');
    stand();
    swing(D);
    X.move.set(0, -1); // 스틱 곧장 뒤
    for (let i = 0; i < 60 && !Y.bwAtk.burst; i++) D.G.step();
    assert.equal(Y.bwAtk.burst, true, '뒤 박찬 걸음을 뗄 때 표시');
    assert.ok(X.gait.fastK > 1, '박찬 걸음');
    stand();
    swing(D);
    X.gait.burst = { fore: 0, side: 1, lat: 1 }; // 옆 박찬 걸음 (이베리아 burstSide 몫 — 걸음 장치에 바로 놓음)
    X.move.set(1, 0);
    for (let i = 0; i < 60 && X.gait.burst; i++) D.G.step();
    assert.equal(X.gait.burst, null, '옆 박찬 걸음을 뗌');
    assert.equal(Y.bwAtk.burst, false, '옆 박찬 걸음은 표시 없음');
  } finally {
    D.G.world.free();
  }
});

test('⑨ 칼이 떠나는 순간을 읽고 먼저 박참: 박찬 걸음(발 뜬 시간 GAIT.burstT) 동안 칼이 나가면 그 칼도 박찬 칼 · 걸음이 끝난 뒤 나간 칼은 아님', () => {
  const D = duel(1.3);
  try {
    bwBurst(D.X); // 뒤 박찬 걸음을 막 뗌 (gait.js fastBegin — 그때 나가는 칼은 없음 · 뗀 때 · 자리를 적음)
    swing(D);
    assert.equal(D.Y.bwAtk.burst, true, '걸음 동안 칼이 나감');
    assert.equal(bwAtkEnd(D.Y), true);
    D.Y.bwStiffT = 0;
    D.X.bwBurstAt = D.X.fightT - CONFIG.GAIT.burstT - 0.05; // 걸음이 끝난 뒤
    swing(D);
    assert.equal(D.Y.bwAtk.burst, false, '걸음이 끝난 뒤 나간 칼');
    assert.equal(bwAtkEnd(D.Y), false);
    // 박찬 걸음으로 칼끝 밖에 나간 뒤 칼이 나감: 박차기 전 자리가 칼끝 거리 안이면 닿았을 칼 → 칼끝 안으로 봄
    bwBurst(D.X);
    const art = D.Y.swordArt;
    D.Y.swordArt = { ...art, measure: { ...art.measure, reach: 0.5 } }; // 지금 가슴 사이(1.3 m)는 칼끝 밖이라고 놓음
    const p = D.X.bodies.chest.translation();
    const q = D.Y.bodies.chest.translation();
    D.X.bwBurstFrom = { x: q.x + 0.3 * Math.sign(p.x - q.x), z: q.z }; // 박차기 전엔 0.3 m — 칼끝 안
    swing(D);
    assert.equal(D.Y.bwAtk.burst, true);
    assert.equal(D.Y.bwAtk.inReach, true, '박차기 전 자리로 칼끝 안');
    D.X.bwBurstAt = null;
    swing(D);
    assert.equal(D.Y.bwAtk.inReach, false, '박차기 없이는 지금 거리로 — 칼끝 밖');
    D.Y.swordArt = art;
  } finally {
    D.G.world.free();
  }
});

test('⑩ 굳음 꼴 ([사장님 11/19 승인] 끌려갔다가 되찾음 — 사람 · AI 같음): 손 목표가 휘두른 쪽으로 over 만큼 더 흘러감 · 몸이 숙고 칼 쪽으로 돎 · 반걸음 비틀 걸음 · 되찾음 끝엔 쉴 자세 · 비기 경직은 멈춤 그대로', () => {
  const W = BURST_WHIFF;
  for (const who of ['X', 'Y']) {
    const D = duel(2.4); // 칼이 상대 몸에 안 닿는 거리 (같은 스텝 몸 닿음 거둠이 없게)
    const F = D[who]; // X = 사람 몸 · Y = AI 몸 (AI 판단은 멈춤)
    try {
      F.handOffset.set(0.4, 0.4);
      F.skill.aim.set(0.4, 0.4);
      F.bwAtk = { y: F, tgt: F.foe, inReach: true, burst: true, touched: false, blade: false, live: true, h0: [0.4, 0.4] };
      F.handOffset.set(-0.2, -0.2); // 휘두름 끝 (오른 위 → 왼 아래)
      F.skill.aim.set(-0.2, -0.2);
      assert.equal(bwAtkEnd(F), true, who);
      F.bwEnd = null;
      const dir = F.bwDrag.dir;
      assert.ok(Math.abs(dir[0] + Math.SQRT1_2) < 1e-6 && Math.abs(dir[1] + Math.SQRT1_2) < 1e-6, '휘두른 쪽');
      const p0 = F.bodies.pelvis.translation();
      const P0 = [p0.x, p0.z];
      let maxPitch = 0;
      let maxTurn = 0;
      while (bwStiff(F) && bwElapsed(F) < W.drag - DT) {
        D.G.step();
        maxPitch = Math.max(maxPitch, F.bwBody?.pitch ?? 0);
        maxTurn = Math.min(maxTurn, F.bwBody?.chestYaw ?? 0);
      }
      const to = F.bwDrag.to;
      assert.ok(Math.hypot(to[0] - (-0.2 - W.over * Math.SQRT1_2), to[1] - (-0.2 - W.over * Math.SQRT1_2)) < 1e-6, '끌려감 끝 = 휘두름 끝 너머 over');
      assert.ok(Math.hypot(F.handOffset.x - to[0], F.handOffset.y - to[1]) < 0.02, `${who}: 끌려감 끝에 손 목표가 거기`);
      assert.ok(maxPitch > 0.9 * W.lean, '몸이 숙음');
      assert.ok(maxTurn < -0.5 * W.turn * Math.SQRT1_2, '왼쪽으로 친 칼 → 가슴이 그쪽(−)으로');
      const p1 = F.bodies.pelvis.translation();
      assert.ok(Math.hypot(p1.x - P0[0], p1.z - P0[1]) > 0.1, `${who}: 비틀 걸음 (골반이 옮겨 감)`);
      assert.equal(F.state, 'stand', '넘어지지 않음');
      while (bwStiff(F)) D.G.step();
      const home = F.swordArt?.restGuard?.pad ?? CONFIG.SKILL.homeGuard;
      assert.ok(Math.hypot(F.handOffset.x - home[0], F.handOffset.y - home[1]) < 0.02, '되찾음 끝 = 쉴 자세');
      assert.equal(F.bwBody, null, '몸 덧씌우기 끝');
      assert.equal(bwDragW(F), 0);
      assert.equal(F.state, 'stand');
    } finally {
      D.G.world.free();
    }
  }
  // 비기 경직은 멈춤 꼴 그대로 (holdStiff — 손 목표가 그 자리)
  const D = duel(1.6);
  try {
    const P = D.X;
    P.secretStiff = true;
    D.G.step();
    const h = P.handOffset.clone();
    for (let i = 0; i < 20; i++) D.G.step();
    assert.ok(P.handOffset.distanceTo(h) < 1e-9, '비기 경직은 멈춤');
    assert.equal(P.bwBody, null);
  } finally {
    D.G.world.free();
  }
});
