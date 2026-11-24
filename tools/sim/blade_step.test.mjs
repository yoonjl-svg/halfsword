// 칼날 자리 무게 · 걸음 운동량 시험 (11/17 — [사장님 11/17 결정] 감독 권고 따름 · config STRIKE.bladeW0 · bladeWFull · stepMass · stepVRef · combat.js analyze ·
//  옮긴 기록 docs/strike/ae_port_2026-11-17.md §4): 베기 판정 에너지 × w(t) (끝 ⅓ = 1 · 손잡이 끝 0.5) · 들어가며 친 베기 판정 유효 질량 + 1.0 kg × min(1, v ÷ 1.0) ·
//  찌르기 · 둔타는 그대로 · 찌르기 공격 중(탭 · 운동학 찌름 · 리솔루토 런지 끝 붙잡기 · AI 찌르기 기술)의 베기 꼴 닿음도 걸음 몫 없음 · 사람 · AI 같은 판정.
//  node --test tools/sim/blade_step.test.mjs
import { fingerCutK } from '../../src/finger_cut.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { bladeWeight, stepMassOf, thrustingNow } from '../../src/combat.js';

const S = CONFIG.STRIKE;

test('값 · 칼날 자리 무게 w(t): 끝 ⅓ = 1 · 손잡이 끝 0.5 · 사이는 곧게', () => {
  assert.ok(S.bladeW0 === 0.5 && Math.abs(S.bladeWFull - 2 / 3) < 1e-12 && S.stepMass === 1 && S.stepVRef === 1, JSON.stringify({ w0: S.bladeW0, full: S.bladeWFull, m: S.stepMass, v: S.stepVRef }));
  assert.equal(bladeWeight(1), 1);
  assert.equal(bladeWeight(0.7), 1);
  assert.equal(bladeWeight(2 / 3), 1);
  assert.equal(bladeWeight(0), 0.5);
  assert.ok(Math.abs(bladeWeight(1 / 3) - 0.75) < 1e-12);
  assert.ok(Math.abs(bladeWeight(0.5) - 0.875) < 1e-12);
});

test('걸음 운동량: 상대 쪽으로 들어갈 때만 · v_ref 에서 다 실림 · 서 있거나 물러나면 0 · 옆걸음은 상대 쪽 몫만', () => {
  const V = (x, y, z) => ({ x, y, z });
  const f = (px, vx, vz = 0) => ({ cache: { parts: { pelvis: { p: V(px, 1, 0), v: V(vx, 0, vz) } } } });
  const foe = f(2, 0);
  assert.equal(stepMassOf(f(0, 0), foe), 0, '서 있음');
  assert.equal(stepMassOf(f(0, -0.8), foe), 0, '물러남');
  assert.ok(Math.abs(stepMassOf(f(0, 0.5), foe) - 0.5) < 1e-12, '반 빠르기 — 반 몫');
  assert.equal(stepMassOf(f(0, 1.0), foe), 1, 'v_ref');
  assert.equal(stepMassOf(f(0, 2.5), foe), 1, 'v_ref 넘어도 1 kg 까지');
  assert.ok(Math.abs(stepMassOf(f(0, 0.4, 3), foe) - 0.4) < 1e-12, '옆걸음 — 상대 쪽 몫만');
  assert.equal(stepMassOf({}, foe), 0, '저장값 없음');
  // 상대가 왼쪽에 있으면 왼쪽으로 가는 것이 들어감
  assert.equal(stepMassOf(f(0, -1.2), f(-2, 0)), 1);
});

test('찌르기 공격 중이면 걸음 몫 없음 (닿음 꼴이 아니라 공격으로 — 칼날 스침도) · 칼날 자리 무게는 그대로', () => {
  const V = (x, y, z) => ({ x, y, z });
  const foe = { cache: { parts: { pelvis: { p: V(2, 1, 0), v: V(0, 0, 0) } } } };
  const f = (o = {}) => ({ cache: { parts: { pelvis: { p: V(0, 1, 0), v: V(1.2, 0, 0) } } }, skill: {}, ...o });
  assert.equal(stepMassOf(f(), foe), 1, '베기 · 서기 꼴 아님 — 걸음 몫');
  for (const [k, o] of [
    ['탭 찌르기', { skill: { tap: { t: 0.1 } } }],
    ['뻗는 구간', { skill: { thrustPush: true } }],
    ['운동학 찌름 (리솔루토 런지)', { iai: { kind: 'combo', mi: 0, moves: [{ kind: 'thrust', lunge: true }] } }],
    ['찌르는 운동학 칼 끝 풀기', { iaiHoldKind: 'combo', iaiHoldT: 0, iaiFade: 0.1, iaiHoldThrust: true }],
    ['AI 찌르기 기술', { aiCtl: { mode: 'attack', tech: { kind: 'thrust' } } }],
  ]) {
    assert.equal(thrustingNow(f(o)), true, k);
    assert.equal(stepMassOf(f(o), foe), 0, k);
  }
  for (const [k, o] of [
    ['대검 쪼개 내려치기 (탭 틀이지만 베기)', { skill: { tap: { cleave: true } } }],
    ['운동학 칼 베기 수', { iai: { kind: 'combo', mi: 1, moves: [{ kind: 'thrust' }, { kind: 'cut' }] } }],
    ['베는 운동학 칼 끝 풀기', { iaiHoldKind: 'combo', iaiFade: 0.1, iaiHoldThrust: false }],
    ['AI 베기 기술', { aiCtl: { mode: 'attack', tech: { kind: 'cut' } } }],
    ['AI 찌르기 기술이지만 공격 꼴 아님', { aiCtl: { mode: 'watch', tech: { kind: 'thrust' } } }],
  ]) {
    assert.equal(thrustingNow(f(o)), false, k);
    assert.equal(stepMassOf(f(o), foe), 1, k);
  }
});

test('판에서: 베기 판정 = ½ × (자유 칼 + 팔 + 걸음 몫) × 빠르기² × 눈금 × w(t) · 찌르기 · 둔타엔 걸음 몫 없음', () => {
  const cut = [], other = [];
  // 씨앗 1 · 2 → 1 ~ 3 (11/17 ③ 자세 → 칼길 — 판 흐름이 갈라져 씨앗 1 · 2 판이 20.2 · 13.5 s 에 끝나고 베기 상처 여섯이 모두 칼날 끝 ⅓ 에 닿음 · 씨앗 3 을 더하면 베기 13 · 무게 < 1 하나 — 뜻 그대로)
  // 씨앗 1 ~ 3 → 1 ~ 4 (11/25 칼끼리 튕김 실제 0.2 — 판 흐름이 바뀌어 씨앗 1 ~ 3 의 베기가 모두 칼날 끝 ⅓ 에 닿음 · 씨앗 4 에 무게 < 1 베기 둘)
  for (const seed of [1, 2, 3, 4]) {
    const G = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
    G.onWound = (att, vic, r) => (r.type === 'cut' ? cut : other).push({ ...r, sh: (att.secretHit ?? 1) * fingerCutK(att, 'hit') }); // 판정 배율 — 비기 secretHit · 손가락 긋기 판정 × 2 (11/19 보정 v2 묶음 C1 부터 AI 보통 베기에도)
    try {
      while (G.t < 40 && G.player.alive && G.enemy.alive) G.step();
    } finally {
      G.world.free();
    }
  }
  assert.ok(cut.length >= 5, `베기 ${cut.length}`);
  let ok = 0, stepped = 0, weighted = 0;
  for (const r of cut) {
    const m = r.mEff - r.mFree - S.armAssist;
    assert.ok(m >= -1e-9 && m <= S.stepMass + 1e-9, `걸음 몫 ${m}`);
    if (m > 1e-6) stepped++;
    if (bladeWeight(r.t) < 1) weighted++;
    const want = 0.5 * r.mEff * r.speed * r.speed * S.energyScale * bladeWeight(r.t) * r.sh;
    if (Math.abs(r.energy - want) <= 1e-6 * Math.max(1, want)) ok++;
  }
  assert.ok(ok >= cut.length * 0.8, `판정 에너지 식 맞음 ${ok} / ${cut.length} (나머지는 판정 배율 — 비기 · 유파 칼)`);
  assert.ok(stepped > 0 && weighted > 0, `걸음 몫 실린 베기 ${stepped} · 무게 < 1 베기 ${weighted}`);
  for (const r of other) {
    const m = r.mEff - r.mFree;
    assert.ok(Math.abs(m - S.armAssist) < 1e-9 || Math.abs(m - S.thrustAssist) < 1e-9, `${r.type} 유효 질량 덧몫 ${m} — 팔 몫만`);
  }
});
