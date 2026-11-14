// 짧은 칼 파고들기 시제품 시험 (11/14 사장님 '짧은 무기 파고들기는 동방이 내 기대치보다 약한 면과도 연결되어 중요해 …' · src/dig_proto.js · config DIG_PROTO ·
//  기록 docs/strike/ai_dig_2026-11-14.md): A 기본 켬(사장님 11/14 'A안 켜고') · B · C 기본 끔 · 끄면 판이 바이트 같음 · A(AI 판단) 셈 · B(앞 박차기 — 사람 · AI 같은 조건 · 독일 두 걸음 그대로) ·
//  C(달림 — 기력 문턱 · 스틱 · 휘두름 · 기력 대가) · 켜면 판에서 실제로 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/ai_dig.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI, DT, THREE } from './harness_m.mjs';
import { digRecoverReach, digStepIn, digTechW, digKeepWant, digWallNeed, aiFrontDash, runTick, techStepFwd, digProtoOn } from '../../src/dig_proto.js';

const { DIG_PROTO: D, GAIT, SECRET } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
function withDig(over, fn) {
  const keep = { ...D };
  Object.assign(D, over);
  try {
    return fn();
  } finally {
    Object.assign(D, keep);
  }
}
/** AI 둘 판 (자리 0 = 롱소드 AI · 자리 1 = weapon2 AI · 숙련 5) — secs 초 돌리며 몸 자리 · 피를 30 스텝마다 적은 글 */
function trace({ weapon2 = 'hwando', secs = 6, seed = 2 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  const r = { text: out.join(';'), dP: { ...(G.ai.stats.digP ?? {}) }, digs: G.enemy.gait?.digs ?? 0 };
  G.world.free();
  return r;
}
/** 서 있는 몸 하나 (AI 끔 · 시작 정지 뒤 1.5 s 가만히) */
function standing(weapon2 = 'hwando', human = true) {
  const G = newRound({ walls: false, seed: 1, weapon: 'longsword', weapon2, gap: 8 });
  G.ai.update = () => {};
  const E = G.enemy;
  E.humanInput = human;
  let k = 0;
  while (E.feetHeld || k++ < Math.round(1.5 / DT)) {
    E.move.set(0, 0);
    G.step();
  }
  return { G, E, free: () => G.world.free() };
}

test('A 기본 켬(사장님 11/14 \'A안 켜고\') · B · C 기본 끔 · 값은 사다리 칸 · 끄면 판이 바이트 같음 (값을 바꿔도 안 읽음)', () => {
  assert.equal(D.ai, 1, '[사장님 11/14 결정] A안 켜고');
  assert.equal(D.step, 0);
  assert.equal(D.run, 0);
  assert.equal(withDig({ ai: 0 }, () => digProtoOn()), false);
  assert.ok([0.3, 0.45, 0.6, 0.9].includes(D.dashGap) && [0.3, 0.45, 0.6, 0.9].includes(D.runGap), '걸음 사다리');
  assert.ok(near(D.crossT, CONFIG.realS(0.6)) && near(D.dashWait, CONFIG.realS(0.2)), '시간 사다리');
  const a = withDig({ ai: 0 }, () => trace());
  const b = withDig({ ai: 0, holdM: 0.9, stepN: 3, runAt: 0, runV: 9, keep: 1, wallNeed: 2, dashGap: 0.3, runGap: 0.3, crossT: 9, stepIn: 3 }, () => trace());
  assert.equal(a.text, b.text, '스위치가 꺼져 있으면 값은 판에 안 닿음');
  assert.deepEqual(a.dP, {}, '재기 칸도 안 생김');
});

test('A — AI 판단 셈: 헛친 틈 거리 · 걸음 실린 기술 · 붙은 뒤 · 울타리 · 간 보는 여유 (파고들기 판 몸만)', () => {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2: 'hwando', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    assert.equal(ai.digNow(), true, '환도는 파고들기 판');
    withDig({ ai: 0 }, () => assert.equal(digRecoverReach(ai), Math.max(ai.M.reach, ai.foeReach), '끄면 옛 셈'));
    withDig({ ai: 1 }, () => assert.ok(near(digRecoverReach(ai), Math.min(Math.max(ai.M.reach, ai.foeReach), ai.M.contact + 0.05 + D.crossT * GAIT.moveSpeed)), '건널 수 있는 거리까지만'));
    const T = ai.school.techByName;
    assert.ok(near(techStepFwd(T.chebuYaoji), 0.3), '체보요격 앞 걸음 0.3');
    assert.equal(techStepFwd(T.zornhau), 0);
    assert.ok(near(techStepFwd({ step: { when: 'strike', fwd: 'chineseStep' } }), SECRET.chineseStep));
    assert.equal(techStepFwd({ step: { when: 'strike', fwd: 0.3, back: true } }), 0, '물러나는 걸음은 아님');
    ai.atkSeq = 7;
    assert.ok(near(digStepIn(ai, T.chebuYaoji), 0.3 * D.stepIn));
    assert.equal(digStepIn(ai, T.zornhau), 0);
    assert.ok(near(digTechW(ai, T.chebuYaoji), 1 + ai.digK) && digTechW(ai, T.zornhau) === 1, '걸음 실린 기술 × (1 + 띠 기울기)');
    ai.hitLanded = true;
    assert.ok(near(digKeepWant(ai, 0.4), 0.4 + 0.6 * D.keep * ai.digK), '맞힌 뒤 이어 침');
    ai.hitLanded = ai.bound = false;
    assert.equal(digKeepWant(ai, 0.4), 0.4, '헛침은 그대로');
    assert.equal(digWallNeed(ai, 1), 1, '상대가 가운데 · 안 지침');
    G.player.stamina.level = 1;
    assert.ok(near(digWallNeed(ai, 1), 1 - D.wallNeed * ai.digK), '지친 상대 — 몰아침');
    G.player.stamina.level = 0;
    const h0 = ai.holdDist();
    ai.dig = true;
    const h1 = withDig({ ai: 1 }, () => ai.holdDist());
    assert.ok(h1 <= h0 && near(h1, ai.foeReach + 0.08), `상대 칼끝 바로 밖 ${h1.toFixed(3)} ≤ ${h0.toFixed(3)}`);
  } finally {
    G.world.free();
  }
});

test('B — 앞 박차기: 사람 · AI 같은 \'서 있음\' 조건 · 한 걸음(독일은 두 걸음 그대로) · 끄면 없음', () => {
  // 사람: 서 있다가 스틱을 앞으로 세게 — 박찬 앞 걸음 하나
  for (const [on, want] of [[0, 0], [1, 1]]) {
    withDig({ step: on }, () => {
      const { G, E, free } = standing('hwando', true);
      for (let i = 0; i < 30; i++) {
        E.move.set(0, 1);
        G.step();
      }
      const n = E.gait.digs;
      free();
      assert.equal(n, want, `사람 앞 박차기 ${on ? '켬' : '끔'}`);
    });
  }
  // AI: 같은 조건 — 서 있으면 걺 · 걷는 중이면 안 걺 · 독일은 두 걸음
  withDig({ step: 1 }, () => {
    for (const [w, n] of [['hwando', D.stepN], ['longsword', GAIT.digSteps]]) {
      const { G, E, free } = standing(w, false);
      const ai = new AI(E, G.player, 'normal', { proficiency: 5 });
      assert.equal(aiFrontDash(ai), true, `${w} 서 있음`);
      assert.equal(E.gait.burst.dig, n, `${w} 박찬 걸음 ${n}`);
      assert.equal(aiFrontDash(ai), false, '이미 걸어 둠');
      E.gait.burst = null;
      for (let i = 0; i < 60; i++) {
        E.move.set(0, 1);
        G.step();
      }
      assert.equal(aiFrontDash(ai), false, '걷는 중 — 서 있음 아님');
      free();
    }
  });
});

test('C — 달림: 기력 문턱 위 · 스틱 앞 끝 · 휘두르지 않을 때만 · 앞 빠르기 × runV ÷ 걷는 빠르기 · 기력 대가', () => {
  const { G, E, free } = standing('hwando', true);
  try {
    const fwd = E.forward(new THREE.Vector3());
    const mk = () => new THREE.Vector3(fwd.x, 0, fwd.z).multiplyScalar(1.5);
    const along = (w) => w.x * fwd.x + w.z * fwd.z;
    E.stamina.value = 80;
    let w = mk();
    runTick(E, DT, w, fwd, { x: 0, y: 1 });
    assert.equal(E.running, true);
    assert.ok(near(along(w), 1.5 * (D.runV / GAIT.moveSpeed), 1e-9), '앞 몫 × runV ÷ 걷는 빠르기');
    w = mk();
    runTick(E, DT, w, fwd, { x: 0, y: 0.5 });
    assert.equal(E.running, false, '스틱 앞 끝이 아님');
    assert.ok(near(along(w), 1.5));
    E.stamina.value = D.runAt - 1;
    runTick(E, DT, mk(), fwd, { x: 0, y: 1 });
    assert.equal(E.running, false, '기력 문턱 아래');
    E.stamina.value = 80;
    E.skill.swinging = true;
    runTick(E, DT, mk(), fwd, { x: 0, y: 1 });
    assert.equal(E.running, false, '휘두르는 중');
    E.skill.swinging = false;
    // 기력: 실제로 달리는 몸은 달린 거리만큼 덧 기력
    withDig({ run: 1 }, () => {
      E.stamina.value = 100;
      let spent = 0;
      const sp = E.stamina.spend.bind(E.stamina);
      E.stamina.spend = (k, a) => ((spent += k === 'move' ? a : 0), sp(k, a));
      for (let i = 0; i < Math.round(1.5 / DT); i++) {
        E.move.set(0, 1);
        G.step();
      }
      assert.ok(spent > 0, `달림 기력 ${spent.toFixed(2)}`);
    });
  } finally {
    free();
  }
});

test('켜면 판에서 실제로 쓰임 — A 걸음 실린 칼 · 건넘 · B 박참 · C 달림 (환도 숙련 5 대 롱소드 AI 숙련 5 · 씨앗 1 ~ 4 가운데 처음 난 판)', () => {
  const first = (over, ok) => {
    for (const seed of [1, 2, 3, 4]) {
      const r = withDig(over, () => trace({ secs: 30, seed }));
      if (ok(r)) return { ...r, seed };
    }
    return null;
  };
  const a = first({ ai: 1 }, (r) => (r.dP.stepIn ?? 0) + (r.dP.cross ?? 0) + (r.dP.keep ?? 0) > 0);
  assert.ok(a, 'A 가 쓰인 판');
  const b = first({ ai: 0, step: 1 }, (r) => (r.dP.dash ?? 0) > 0 && r.digs > 0);
  assert.ok(b, 'B 박찬 판');
  const c = first({ ai: 0, run: 1 }, (r) => (r.dP.runT ?? 0) > 0);
  assert.ok(c, 'C 달린 판');
  for (const r of [a, b, c]) assert.notEqual(r.text, withDig({ ai: 0 }, () => trace({ secs: 30, seed: r.seed })).text, '끈 판(A 도 끔)과 다름');
});
