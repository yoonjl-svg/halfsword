// 끝없는 비기 · 유파 대가 시험 (11/16 사장님 '고노센을 쓰지 않고 칼을 뺄 때도 시간이 강제로 들게 하자 … 0.6으로 하고 기력 소모 50으로.' · '알티바슈는 -35까지 기력 강제 소진으로 해.' ·
//  '둘째로 해' · '맞든 빗나가든 항상 0.6초 무방비. 리솔루토와 죽음의 일격 모두 적용. 리솔루토는 기력 50 죽음의 일격은 기력 35 소모.' — 기록 docs/strike/secret_free_2026-11-16.md)
//  node --test tools/sim/secret_free.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { SECRET, STAMINA, UNIQUE_ASSIST as UA, AI_PLAN_JP, realS } from '../../src/config.js';
import { TRADITIONS, playerSecretDef } from '../../src/schools.js';
import { PlayerSecretWatch, secretUsesOf, secretCostOf, secretFree } from '../../src/secret.js';
import { drawInput, drawTapTake, iaiSeated } from '../../src/iai_obi.js';
import { altibShot } from '../../src/unique_assist.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import { withSecretFreeOff } from './secret_free_off.mjs';

const K = CONFIG.TIME.k;
const body = (tr) => ({ swordArt: { tradition: tr } });

test('기본값 — [사장님 11/16 결정] 고노센 · 알티바슈 · 죽음의 일격 · 리솔루토 판당 끝없음 · 기력 50 · 35 · 50 · 뽑기 0.6 s · −35 · 빠르기 둘째 셈 · 되돌림 0.6 s', () => {
  assert.equal(SECRET.gnsFree, 1);
  assert.equal(SECRET.gnsCost, 50);
  assert.equal(SECRET.gnsDraw, realS(0.6));
  assert.equal(SECRET.altib.free, 1);
  assert.equal(SECRET.altib.drop, -35);
  assert.equal(SECRET.altib.drop, STAMINA.severeAt); // 심한 지침 문턱과 같은 수
  assert.equal(SECRET.altib.speed, 'f2');
  assert.equal(SECRET.mord.free, 1);
  assert.equal(SECRET.mord.cost, 35);
  assert.equal(SECRET.mord.guard, realS(0.6));
  assert.equal(SECRET.risolutoFree, 1);
  assert.equal(SECRET.risolutoCost, 50);
  assert.equal(SECRET.risolutoBack, realS(0.6));
  assert.equal(AI_PLAN_JP.drawRead, 1);
  for (const tr of ['japanese', 'iberian', 'german', 'italian']) assert.equal(secretUsesOf(body(tr)), Infinity, tr);
  assert.equal(secretFree('chinese'), false); // 동방 격살은 다른 일 — 공용 표 그대로
  assert.equal(secretUsesOf(body('chinese')), UA.secretUses?.chinese ?? Infinity);
  assert.equal(secretCostOf(TRADITIONS.japanese.secret), 50);
  assert.equal(secretCostOf(TRADITIONS.german.playerSecret), 35);
  assert.equal(secretCostOf(playerSecretDef('italian')), 50);
  assert.equal(secretCostOf(TRADITIONS.iberian.secret), undefined); // 알티바슈는 비기 값 없음(메는 기력 · 뒤 −35)
  withSecretFreeOff(() => {
    for (const tr of ['japanese', 'iberian', 'german', 'italian']) assert.equal(secretUsesOf(body(tr)), 1, tr); // 끄면 11/15 판 (판당 1)
    assert.equal(secretCostOf(TRADITIONS.japanese.secret), undefined);
  });
});

test('알티바슈 빠르기 — 둘째 셈(기력 ÷ 100) · 첫째 셈((기력 + 35) ÷ 135) · 바닥 = 같은 칼 보통 큰 베기 · 옛 판은 0.35 × 기력 몫 위력', () => {
  const G = newRound({ seed: 1, walls: true, weapon: 'zweihander', weapon2: 'longsword' });
  try {
    const P = G.player;
    const vg = iaiTipSpeed(P);
    const floor = CONFIG.realV(SECRET.altib.floorTip.zweihander) / vg;
    const at = (v) => ((P.stamina.value = v), altibShot(P));
    let s = at(100);
    assert.equal(s.share, 1);
    assert.equal(s.hitMul, 1);
    s = at(60);
    assert.ok(Math.abs(s.share - 0.6) < 1e-9, '둘째 셈 60 → 0.6');
    s = at(10);
    assert.ok(Math.abs(s.share - floor) < 1e-9 && s.floor, '바닥');
    SECRET.altib.speed = 'f1';
    try {
      s = at(60);
      assert.ok(Math.abs(s.share - 95 / 135) < 1e-9, '첫째 셈 (60 + 35) ÷ 135');
    } finally {
      SECRET.altib.speed = 'f2';
    }
    withSecretFreeOff(() => {
      s = at(60);
      assert.equal(s.share, 0.35);
      assert.ok(Math.abs(s.hitMul - 0.6) < 1e-9, '옛 판 판정 × 기력 몫');
    });
  } finally {
    G.world.free();
  }
});

test('기력 — 알티바슈 뒤 −35 까지(더 낮으면 그대로) · 고노센 50', () => {
  const G = newRound({ seed: 1, walls: true, weapon: 'uchigatana', weapon2: 'longsword' });
  try {
    const S = G.player.stamina;
    S.value = 40;
    S.drainTo(-35);
    assert.equal(S.value, -35);
    S.value = -50;
    S.drainTo(-35);
    assert.equal(S.value, -50);
    S.value = 100;
    S.secret(secretCostOf(TRADITIONS.japanese.secret));
    assert.equal(S.value, 50);
  } finally {
    G.world.free();
  }
});

/** 사람 우치가타나 — 6 실제 s 서서 고노센 준비(2 s + 납도 0.6 s · 판 시작 정지 포함) */
function seated() {
  const G = newRound({ seed: 1, walls: true, weapon: 'uchigatana', weapon2: 'longsword', gap: 3.2, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  G.ai.update = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.autoGuard = true;
  const W = new PlayerSecretWatch(P, G.enemy);
  G.before = () => W.update(1 / 120, !!P.skill.sec);
  for (let t = 0; t < 6 * 120 * K; t++) G.step();
  return { G, P, W };
}

test('뽑기 — 칼집에 든 채 칼을 쥐면 0.6 s 칼집 축을 따라 뽑아 납도 전 겨눔으로 · 그동안 입력 잠금 · 쥔 탭 하나는 끝에 냄 · 준비 셈 0', () => {
  const { G, P, W } = seated();
  try {
    assert.ok(W.iaiArm.armed && iaiSeated(P), '칼집에 듦');
    const tip = () => { const t = P.bladePoint(1, new THREE.Vector3()); const p = P.bodies.pelvis.translation(); return new THREE.Vector3(t.x - p.x, t.y - p.y, t.z - p.z); };
    const t0 = tip();
    assert.ok(t0.length() < 0.9 && t0.x < 0.3, '칼끝은 허리 뒤 (칼집)');
    assert.equal(drawInput(P, { taps: 1, grip: false, guard: false }, false), true);
    assert.ok(P.iaiDraw, '뽑기 시작');
    let steps = 0;
    while (P.iaiDraw && steps < 2 * 120 * K) {
      assert.equal(drawInput(P, { taps: 0, grip: true, guard: true }, false), true, '뽑는 동안 잠금');
      G.step();
      steps++;
      assert.equal(W.iaiArm.armed, false);
    }
    const T = steps / 120 / K;
    assert.ok(Math.abs(T - 0.6) < 0.02, `뽑기 ${T.toFixed(3)} 실제 s`);
    assert.ok(tip().x > 0.8, '끝 = 겨눔 (칼끝이 앞)');
    assert.equal(P.skill.thrustPose.w, 0, '덧씌우기 놓음');
    assert.equal(drawTapTake(P), 1, '쥔 탭');
    assert.equal(drawTapTake(P), 0);
    assert.equal(P.drawLog.n, 1);
    assert.equal(P.drawLog.done, 1);
  } finally {
    G.world.free();
  }
});

test('뽑기 — 끄면(gnsDraw 0) 곧장 사람 손 (11/15 판)', () => {
  const back = SECRET.gnsDraw;
  SECRET.gnsDraw = 0;
  const { G, P } = seated();
  try {
    assert.equal(iaiSeated(P), false);
    assert.equal(drawInput(P, { taps: 1, grip: true, guard: false }, false), false);
  } finally {
    SECRET.gnsDraw = back;
    G.world.free();
  }
});

test('죽음의 일격 · 리솔루토 — 맞든 빗나가든 0.6 s 겨눔 되돌림(굳음 대신) · 기력 35 · 50 · 끄면 굳음 판', () => {
  for (const [w, S, ctx, cost, gap] of [['longsword', TRADITIONS.german.playerSecret, { ev: 'press', held: 2 }, 35, 1.0], ['rapier', playerSecretDef('italian'), { ev: 'risoluto' }, 50, 1.7]]) {
    const run = (off) => {
      const G = newRound({ seed: 1, walls: true, weapon: w, weapon2: 'longsword', gap });
      const P = G.player;
      G.ai.update = () => {};
      P.skill.corr = CONFIG.SKILL.corr;
      P.skill.autoGuard = true;
      try {
        for (let i = 0; i < 300; i++) G.step();
        P.stamina.value = 100;
        assert.ok(P.skill.secret({ S, ctx }), `${S.name} 냄`);
        const st = P.stamina.value;
        let guardT = 0, stiffT = 0, n = 0;
        while ((P.skill.sec || P.iai) && n < 3 * 120 * K) {
          G.step();
          n++;
          if (P.iai?.guarding) guardT += 1 / 120 / K;
          if (P.skill.secretPhase === 'stiff') stiffT += 1 / 120 / K;
        }
        return { st, guardT, stiffT, log: P.secretGuardLog };
      } finally {
        G.world.free();
      }
    };
    const on = run(false);
    assert.equal(on.st, 100 - cost, `${S.name} 기력`);
    assert.ok(Math.abs(on.guardT - 0.6) < 0.02, `${S.name} 되돌림 ${on.guardT.toFixed(3)}`);
    assert.ok(on.stiffT < 0.02, '굳음 없음');
    assert.equal(on.log?.n, 1);
    const off = withSecretFreeOff(() => run(true));
    assert.equal(off.st, 100 - STAMINA.secretCost);
    assert.equal(off.guardT, 0);
    assert.ok(off.stiffT > 0.5, '끄면 굳음 0.6 s');
  }
});

test('AI 뽑기 — 칼집에 든 AI 의 공격 · 막기는 뽑기부터 (공격을 열지 않음)', () => {
  const G = newRound({ seed: 3, walls: true, weapon: 'longsword', weapon2: 'uchigatana', gap: 4.5, persona: { proficiency: 5 } });
  try {
    const E = G.enemy;
    const ai = G.ai;
    G.player.move.set(0, 0);
    let seatedAt = null;
    for (let i = 0; i < 12 * 120 * K && seatedAt == null; i++) {
      G.step();
      if (iaiSeated(E)) seatedAt = i;
    }
    assert.ok(seatedAt != null, 'AI 가 칼집에 넣음');
    const t = ai.school.techByName.oberhau ?? Object.values(ai.school.techByName)[0];
    assert.equal(ai.startAttack(t, 'test'), false);
    assert.ok(E.iaiDraw, '뽑기 시작');
    assert.equal(ai.startAttack(t, 'test'), false, '뽑는 동안');
  } finally {
    G.world.free();
  }
});

test('일본 기다림과 침 스택 = 빠르기 [사장님 11/16 결정] — 사람 +5 % · AI +2.5 % / 스택 (합연산) · 스택 공격력 없음 · 고노센 · 제비 베기(들고 온 스택) · 서보 힘 × 빠르기²', async () => {
  const { JP_TANK } = await import('../../src/config.js');
  const { fingerCutK } = await import('../../src/finger_cut.js');
  const { allNodeIds, kitFromNodes } = await import('../../src/skill_tree_data.js');
  assert.equal(JP_TANK.speed, 1);
  assert.equal(JP_TANK.speedHuman, 0.05);
  assert.equal(JP_TANK.speedAi, 0.025);
  const kit = kitFromNodes('japanese', allNodeIds('japanese'));
  const G = newRound({ weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 3, kit, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  try {
    const P = G.player;
    const SP = P.schoolPassive;
    assert.ok(SP.stackOn);
    SP.stk = 10;
    P.stamina.attack('cut'); // 칼 하나에 10 스택을 묶음
    assert.equal(SP.lock.stk, 10);
    assert.ok(Math.abs(SP.speedOf() - 1.5) < 1e-12, '사람 1 + 0.05 × 10');
    SP.ai = true;
    assert.ok(Math.abs(SP.speedOf() - 1.25) < 1e-12, 'AI 1 + 0.025 × 10');
    SP.ai = false;
    SP.lock.stk = 0;
    SP.lock.carryStk = 6;
    assert.equal(SP.speedOf(), 1, '보통 칼은 들고 온 스택 안 씀');
    assert.ok(Math.abs(SP.speedOf('tsubameGaeshi') - 1.3) < 1e-12, '제비 베기 = 들고 온 스택');
    SP.lock.stk = 10;
    P.skill.tap = {}; // 묶인 칼이 휘두르는 중 (swingingNow)
    assert.equal(SP.dealtK(), 1, '스택 공격력 없음');
    P.skill.tap = null;
    P.jpArmK = 2.25;
    assert.equal(fingerCutK(P, 'arm'), 2.25, '서보 힘 × 빠르기²');
    assert.equal(fingerCutK(P, 'hit'), 1);
    P.jpArmK = 1;
  } finally {
    G.world.free();
  }
});
