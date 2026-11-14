// 일본 강화 길 시험 (11/05 사장님 '걸음 속도가 특색이니 유지하면서 다른 방법으로 강화할 방법을 찾음 좋겠는데' · 기록 docs/strike/jp_strength_2026-11-05.md · 확인표 3420 ~ 3429)
//  ① 새 스위치는 모두 기본 끔 · 일본 걷기 빠르기(JAPANESE_GAIT 사람 · AI 0.70)는 그대로
//  ② 재기 꽂개(jp_strength.mjs strengthProbe)는 읽기만 — 같은 씨앗 싸움이 꽂개 없을 때와 바이트 같음
//  ③ 스위치마다: 끔 = 지금 판 그대로 · 켬 = 뜻한 대로 (맞아도 고노센 준비 이어 셈 · 고노센 베고 지나감 · 제비 베기 미끄러져 들어감 · 일본 칼끝 거리 숨김)
//  node --test tools/sim/jp_strength.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { strengthProbe } from './jp_strength.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { LOOKS } from '../../src/looks.js';
import { JAPANESE_GAIT } from '../../src/schools.js';
import { gnsHumanUnsettled } from '../../src/secret.js';
import { foeReachBase } from '../../src/ai.js';
import { withArmOld } from './arm_real_pin.mjs'; // 11/12 팔 사람 꼴 — 옛 장면은 잰 때 팔로 (docs/strike/arm_real_2026-11-12.md §10)
import { withJpOld } from './jp_tank_pin.mjs'; // 11/14 일본 스택 · 바위 몸 — 옛 장면은 잰 때 판으로 (docs/strike/jp_tank_2026-11-14.md §5)

const { SECRET, UNIQUE_ASSIST: UA, AI_MAAI } = CONFIG;
const allOff = () => { SECRET.gnsHurtKeep = 0; SECRET.gnsThrough = 0; UA.tsuStep = 0; AI_MAAI.hide = 0; };

test('기본값: 새 스위치 모두 끔 · 일본 걷기 빠르기 그대로', () => {
  assert.equal(SECRET.gnsHurtKeep, 0);
  assert.equal(SECRET.gnsThrough, 0);
  assert.equal(UA.tsuStep, 0);
  assert.equal(AI_MAAI.hide, 0);
  assert.equal(JAPANESE_GAIT.speedMul, 0.7);
});

test('꽂개는 읽기만: 일본 대 롱소드 AI 가 꽂개 없을 때와 같음', () => {
  const a = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 3, dur: 10 });
  const b = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 3, dur: 10, probe: strengthProbe() });
  const strip = (r) => JSON.stringify({ ...r, probe: undefined });
  assert.equal(strip(b), strip(a));
  assert.ok(b.probe.iai && b.probe.big && b.probe.dist);
});

/** 사람 몸 판 (발 묶임이 풀릴 때까지) — { G, P, A } */
function humanRound(school, weapon, opp = 'longsword') {
  const kit = kitFromNodes(school, allNodeIds(school));
  const G = newRound({ seed: 5, weapon, weapon2: opp, walls: true, kit, look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  for (let i = 0; i < 2400 && (P.feetHeld || P.state !== 'stand'); i++) G.step();
  return { G, P, A: G.enemy };
}

test('gnsHurtKeep: 끔이면 맞음이 준비를 풂 · 켜면 맞음으로는 안 풀림 (치기 · 막기는 그대로 풂)', () => {
  const f = { skill: {}, parryGuard: { held: false } };
  try {
    assert.equal(gnsHumanUnsettled(f, true), true, '끔 — 맞으면 풀림');
    assert.equal(gnsHumanUnsettled(f, false), false);
    SECRET.gnsHurtKeep = 1;
    assert.equal(gnsHumanUnsettled(f, true), false, '켬 — 맞음만으로는 안 풀림');
    assert.equal(gnsHumanUnsettled({ ...f, skill: { swinging: true } }, true), true, '휘두름은 풂');
    assert.equal(gnsHumanUnsettled({ ...f, skill: { tap: {} } }, false), true, '탭은 풂');
    assert.equal(gnsHumanUnsettled({ ...f, parryGuard: { held: true } }, false), true, '막기 단추는 풂');
  } finally {
    allOff();
  }
});

test('jpMaaiHide: AI 가 일본 칼끝 거리를 hide m 짧게 봄 · 다른 유파 · 끔은 그대로', () => {
  const { G, P, A } = humanRound('japanese', 'uchigatana');
  try {
    const foeM = P.swordArt.measure;
    const base = foeReachBase(foeM, P);
    assert.equal(base, foeM.reach + 0.05, '끔 = 무기 간격 + 0.05');
    AI_MAAI.hide = 0.3;
    assert.ok(Math.abs(foeReachBase(foeM, P) - (base - 0.3)) < 1e-12, '일본 상대 — 0.3 짧게');
    assert.equal(foeReachBase(A.swordArt.measure, A), A.swordArt.measure.reach + 0.05, '독일 롱소드 상대는 그대로');
  } finally {
    allOff();
    G.world.free();
  }
});

test('켜도 일본이 아닌 칸은 그대로: 네 스위치를 켠 독일 롱소드 대 롱소드 AI 판이 끈 판과 바이트 같음', () => {
  try {
    const a = fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 2, dur: 8 });
    SECRET.gnsHurtKeep = 1;
    SECRET.gnsThrough = 1;
    UA.tsuStep = 0.3;
    AI_MAAI.hide = 0.3;
    const b = fightOne({ school: 'german', weapon: 'longsword', opp: 'longsword', seed: 2, dur: 8 });
    assert.equal(JSON.stringify(b), JSON.stringify(a), '독일 롱소드 칸');
  } finally {
    allOff();
  }
});

test('tsuStep: 켜면 제비 베기 되돌림 칼이 맞는 거리까지 미끄러져 들어감 (끄면 0)', () => withJpOld(() => withArmOld(() => {
  // 11/14 일본 스택 · 바위 몸과 帯刀(대기 칼 자리)이 함께 켜진 판에서 씨앗 1 의 되돌림 칼이 안 나옴(둘 중 하나만이면 나옴) — 스택 전 판(jp_tank_pin)으로 묶음 · 기준은 그대로
  // 11/12 둘째(두 팔 엇갈림 막기 AI 몫 · 사람 두손 칼 칼자루 끝 앞 바닥)로 씨앗 1 판에 제비 베기 되돌림 칼이 안 나옴 — 이 장면을 잰 때의 팔(arm_real_pin armClear2)로 묶음
  const runs = {};
  for (const v of [0, 0.3]) {
    let uq = null;
    let r = null;
    try {
      UA.tsuStep = v;
      // 씨앗 1 (11/11 손가락 긋기 판정 2 배 — 조작 예전 · 씨앗 2 · 4 는 20 s 안에 되돌림 칼이 없음 · 전: 11/06 감도 · 팔 2 판은 씨앗 4 · 그 전은 씨앗 2)
      r = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 1, dur: 20, onRound(o) { uq = o.uq; } });
    } finally {
      allOff();
    }
    runs[v] = { tsu: uq.stats.tsuStep ?? 0, snap: uq.stats.snap ?? 0, r };
  }
  assert.equal(runs[0].tsu, 0);
  assert.ok(runs[0].snap > 0, '이 씨앗에 제비 베기 되돌림 칼이 있음');
  assert.ok(runs[0.3].tsu > 0, `제비 베기 미끄러져 들어감 ${runs[0.3].tsu}`);
  assert.notEqual(JSON.stringify(runs[0.3].r), JSON.stringify(runs[0].r), '켜면 판이 달라짐');
}, ['armClear2'])));

test('gnsThrough: 켜면 팔을 가른 발도가 몸까지 한 번 더 벰 (끄면 첫 닿음에서 끝)', () => withJpOld(() => withArmOld(() => {
  // 씨앗 6 판은 11/12 두 팔 엇갈림 막기(SKILL.armClear) 전 팔로 — 켠 판은 이 씨앗이 14 s 안에 고노센을 안 냄 (기록 arm_real §10)
  const runs = {};
  for (const v of [0, 1]) {
    let P = null;
    const belly = SECRET.iaiBelly;
    const real = SECRET.iaiReal;
    const obi = SECRET.iaiObi;
    try {
      SECRET.gnsThrough = v;
      SECRET.iaiBelly = 0; // 11/08 고노센 배 길 기본 켬 전 장면 (씨앗 6 발도가 팔에 먼저 닿는 판 — 배 길이면 팔을 비켜 감)
      SECRET.iaiReal = 0; // 11/13 사람 발도 원전 꼴 전 장면 (docs/strike/iai_real_2026-11-13.md §7)
      SECRET.iaiObi = 0; // 11/14 帯刀(대기 칼 배꼽 앞) 전 장면 — 켜면 대기 칼 자리 · 뽑는 길이 달라 이 씨앗 판이 달라짐 (docs/strike/iai_obi_2026-11-14.md §9)
      const r = fightOne({ school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 6, dur: 14, probe: strengthProbe(), onRound(o) { P = o.P; } });
      runs[v] = { n: P.gnsThroughN ?? 0, big: r.probe.big.dealt.filter((b) => b[3] === 'secret'), fired: r.secretFired };
    } finally {
      allOff();
      SECRET.iaiBelly = belly;
      SECRET.iaiReal = real;
      SECRET.iaiObi = obi;
    }
  }
  assert.equal(runs[0].fired, 1, '이 씨앗은 14 s 안에 고노센을 냄');
  assert.equal(runs[0].n, 0);
  assert.deepEqual(runs[0].big.map((b) => b[1]), ['arm'], '끔 — 팔 하나');
  assert.equal(runs[1].n, 1);
  assert.deepEqual(runs[1].big.map((b) => b[1]), ['arm', 'chest'], '켬 — 팔을 베고 가슴까지');
  assert.ok(runs[1].big[1][2] < runs[1].big[0][2], '두 번째 상처는 남은 에너지로 (첫 상처보다 얕음)');
}, ['armClear']))); // 11/14 그때 판 (스택 · 바위 몸 전)
