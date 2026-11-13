// 이베리아 자리 바꿈 시험 (11/11 사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자. 싱지르를 제비베기와 같은 위계의 특수공격으로 알티바슈 포르트를 고노센 급의 비기로.' —
//  기록 docs/strike/ib_swap_2026-11-11.md · config SECRET.iberianSecret 'altib' · SECRET.altib · SECRET.ibSpin.stride · specialShare.cingir · 재는 판 tools/sim/ib_swap.mjs)
//  비기 알티바슈 포르트: 싱지르 무장(칼끝 거리 밖 2 s) 창에서만 길게 눌러 메기 · 칼끝 고노센 × 0.35 · 판정 = 비기 배율(1) × 남은 기력 몫 · 내려친 뒤 기력 0 · 판당 한 번.
//  특수 공격 싱지르: 무장 없이 원 한 바퀴 · 칼끝 고노센 × 0.3 · 식힘 · 비기 셈 · 판정 배율 없음 · 한 걸음 나가며 돎.
//  같은 날 사장님 결정 — 비기 판정 배율 1.3 은 고노센만 · 죽음의 일격 0.35 · 1.0 · 누르기 1.5 s · 겹치기 0.3.
//  node --test tools/sim/ib_swap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { SECRET, ARENA, UNIQUE_ASSIST as UA, STAMINA, realS } from '../../src/config.js';
import { TRADITIONS, IBERIAN_SPIN_DEF } from '../../src/schools.js';
import { PlayerSecretWatch, secretLeft } from '../../src/secret.js';
import { PlayerUniqueAssist, altibPower, altibHitMul } from '../../src/unique_assist.js';
import { mordHitMul } from '../../src/mordschlag.js';
import { nodeTitle } from '../../src/skill_tree.js';
import * as D from '../../src/skill_tree_data.js';
import { altibRun, spinRun } from './ib_swap.mjs';

const setup = (P) => {
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
};

test('기본값 — 사장님 11/11: 이베리아 비기 = 알티바슈 포르트 · 빠르기 0.35 · 기력 몫 · 기력 0 · 판정 1 · 싱지르 특수 0.3 · 고노센만 1.3 · 죽음의 일격 0.35 · 1.0 · 누르기 1.5 s · 겹치기 0.3', () => {
  assert.equal(SECRET.iberianSecret, 'altib');
  assert.equal(TRADITIONS.iberian.secret.name, 'altib');
  assert.equal(TRADITIONS.iberian.secret.nameKo, '알티바슈 포르트');
  assert.equal(SECRET.altib.share, 0.35); // '알티바슈 포르테로 35%로 해. 비기 숫자테이블이 일정해지게.'
  assert.equal(SECRET.altib.staminaK, 1); // '남은 기력 만큼의 % 공격력'
  assert.equal(SECRET.altib.zero, 1); // '발동 후에는 무조건 기력이 0이 됨'
  assert.equal(SECRET.altib.weightFix, 0); // '무게 가중치는 재 보고 정해' — 잰 뒤 보정 없음
  assert.equal(altibHitMul(), 1); // '비기 파괴력 배율 1.3배는 고노센에만 남긴다'
  assert.equal(SECRET.hitMul, 1.3); // 고노센 (비기 공통 열쇠 그대로)
  assert.equal(mordHitMul(), 1); // '죽음의 일격도 1.0으로 해.'
  assert.equal(SECRET.mord.kin, 0.35); // '빠르기 35%로 하자.'
  assert.equal(SECRET.mordPress, realS(1.5)); // '1.5초로 해.'
  assert.equal(UA.specialShare.cingir, 0.3); // '빠르기를 고노센의 30%로'
  assert.equal(UA.specialShare.duplieren, 0.3); // '겹치기 30으로.'
  assert.equal(UA.rdDrainCut, 1); // 메는 동안 초당 베기 한 번 값 그대로 (사장님 11/01 — 오래 멜수록 약해짐)
  assert.ok(SECRET.ibSpin.stride > 0, '싱지르 한 걸음 (새 값 · 사장님 확인 전)');
  assert.ok([0.3, 0.45, 0.6].includes(SECRET.ibSpin.stride), '걸음 사다리 가운데');
});

test('스킬트리 — B4 알티바슈 포르트가 비기 자리(전 B7 값) · B7 싱지르가 특수 공격 자리(전 B4 값) · 이어지는 흐름은 그 자리의 칸(B7) 뒤', () => {
  const b4 = D.nodeOf('iberian', 'B4');
  const b7 = D.nodeOf('iberian', 'B7');
  assert.deepEqual([b4.cat, [...b4.pre], b4.price, b4.heads, b4.d, b4.cx, [...b4.f], b4.u], ['secret', ['B10', 'B3', 'B5'], 400, 10, 3, 420, ['secret'], 'redondo']);
  assert.deepEqual([b7.cat, [...b7.pre], b7.price, b7.heads, b7.d, b7.cx, [...b7.f], b7.u], ['atk', ['B5'], 300, 0, 2, 560, [], 'cingir']);
  assert.deepEqual([...D.nodeOf('iberian', 'B6').pre], ['B7']);
  assert.deepEqual([b4.l1, b7.l2 != null], ['비기', true]);
  const kit = D.kitFromNodes('iberian', D.allNodeIds('iberian'));
  assert.equal(kit.secret, true);
  assert.ok(kit.unique.has('redondo') && kit.unique.has('cingir'));
  assert.equal(D.kitFromNodes('iberian', new Set(['B1', 'B5', 'B7'])).secret, false, '싱지르만 익히면 비기 없음');
  assert.equal(nodeTitle('iberian', b4).title, '비기 · 알티바슈 포르트 (altibaxo forte)');
  assert.equal(nodeTitle('iberian', b4).kind, '비기');
  assert.equal(nodeTitle('iberian', b7).title, '풍차 베기 (싱지르 · cingir)'); // 11/12 이름 '풍차 베기' (사장님) — 특수 공격 '뜻 (소리 · 원어)'
  assert.equal(nodeTitle('iberian', b7).kind, '고유 공격');
  assert.match(b4.cmd, /2초 기다리면 비기 활성화 · 탭을 길게 누르다 떼기로 발동/);
  assert.equal(b7.cmd, '원을 그리며 긋기(↻/↺)');
});

test('사람 비기 알티바슈 포르트 — 무장 없이 길게 누르면 아무 일 없음 · 칼끝 거리 밖 2 s 무장 창(금빛 !)에서 길게 누르면 메기(무장을 씀) · 떼면 비기 내려침 · 판당 한 번 · 기력 0 · 판정 = 1 × 기력 몫', () => {
  const G = newRound({ seed: 2, weapon: 'zweihander', weapon2: 'longsword', gap: 3.4 });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo', 'cingir']) });
  assert.equal(W.S?.name, 'altib');
  assert.ok(uq.holdE && uq.cingirE);
  let down = false;
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    uq.holdInput(down, true, !!W.open, W.holdOwns());
  };
  try {
    // 판 시작 정지 동안 · 무장 전: 길게 눌러도 메지 않음 (특수 공격이 아님)
    while (G.t < ARENA.startHold) G.step();
    down = true;
    for (let i = 0; i < Math.round(realS(0.9) / DT); i++) G.step();
    assert.equal(uq.winding, false, '무장 없이는 메지 않음');
    assert.ok((uq.stats.holdRefused ?? 0) >= 1);
    down = false;
    G.step();
    while (G.t < ARENA.startHold + SECRET.ibSpin.armTime + 1 && W.open?.ctx?.ev !== 'altib') G.step();
    assert.equal(W.open?.ctx?.ev, 'altib', '칼끝 거리 밖 무장 → 창');
    assert.equal(W.holdOwns(), true);
    assert.equal(W.circleOwns(), false, '원 긋기 창 아님');
    const left0 = secretLeft(P);
    down = true;
    for (let i = 0; i < Math.round((UA.rdHoldTime + realS(0.2)) / DT); i++) G.step();
    assert.equal(uq.winding, true, '무장 창에서 메기');
    assert.equal(uq.hold.secret, true);
    assert.equal(W.open, null, '메기 시작에 무장을 씀');
    assert.equal(W.spinArm.armed, false);
    for (let i = 0; i < Math.round(realS(0.6) / DT); i++) G.step();
    const st = P.stamina.value;
    const want = Math.min(1, Math.max(0, st / P.stamina.max));
    down = false;
    G.step();
    assert.equal(uq.stats.altib?.fired, 1, '비기 내려침');
    assert.ok(Math.abs(uq.stats.altib.k[0] - want) < 0.03, `위력 몫 ${uq.stats.altib.k[0]} ≈ 기력 몫 ${want}`);
    assert.equal(secretLeft(P), left0 - 1, '판당 한 번');
    assert.equal(P.stamina.value, 0, '내려친 뒤 기력 0');
    const I = P.iai ?? P.iaiReq;
    assert.equal(I?.secret, 'altib');
    assert.ok(Math.abs(I.hitMul - uq.stats.altib.k[0]) < 0.002, `판정 배율 = 1 × 기력 몫 (${I.hitMul})`);
    assert.equal(P.uniqueCue?.kind, 'secret');
    assert.equal(P.uniqueCue?.text, '알티바슈 포르트');
    assert.equal(uq.coolLeft('redondo'), 0, '특수 공격 식힘 없음');
    for (let i = 0; i < Math.round(realS(2.5) / DT); i++) G.step();
    assert.equal(W.open, null, '다 쓴 판엔 창 없음');
  } finally {
    G.world.free();
  }
});

test('기력 몫 — 서 있는 과녁 · 츠바이핸더 · 같은 메기: 멜 때 기력 50 % 면 위력 몫 · 판정 J 가 100 % 의 절반 안팎 · 내려친 뒤 기력 0', () => {
  const a = altibRun({ w: 'zweihander', st: 1, hold: 0.8 });
  const b = altibRun({ w: 'zweihander', st: 0.5, hold: 0.8 });
  assert.equal(a.fired, 1);
  assert.equal(b.fired, 1);
  assert.ok(a.first && b.first, '둘 다 맞음');
  const kr = b.k / a.k;
  assert.ok(kr > 0.4 && kr < 0.62, `몫 비 ${kr}`);
  const er = b.first.E / a.first.E;
  assert.ok(er > 0.35 && er < 0.7, `J 비 ${er} (${b.first.E} / ${a.first.E})`);
  assert.ok(a.k < 1 && a.k > 0.8, `메는 동안 기력이 빠져 몫 < 1 (${a.k})`);
});

test('무게 보정 견줌(weightFix — 기본 끔): 켜면 위력 몫 = (멜 때 기력 − 무게 1 값으로 멘 만큼) ÷ 최대 · 끄면 뗀 순간 기력 ÷ 최대', () => {
  const f = { stamina: { value: 60, max: 100, infinite: false } };
  assert.equal(altibPower(f, { s0: 100, base: 30 }), 0.6);
  SECRET.altib.weightFix = 1;
  try {
    assert.equal(altibPower(f, { s0: 100, base: 30 }), 0.7);
  } finally {
    SECRET.altib.weightFix = 0;
  }
  if (STAMINA.on) assert.equal(altibPower({ stamina: { value: -5, max: 100 } }, null), 0);
});

test('사람 특수 공격 싱지르 — 무장 없이 원 한 바퀴로 냄 · 비기 셈 · 판정 배율 · 굳음 없음 · 칼끝 고노센 × 0.3 · 식힘 동안 다시 안 남 · 한 걸음 나가며(앞발 축)', (t) => {
  // 11/14 그때 판으로 묶음 (B7 이어 돌리기 기본 — IB_LINK.on 1 이면 원 긋기 풍차 베기 없음 · docs/strike/ib_link_2026-11-14.md §7)
  const linkK = CONFIG.IB_LINK.on;
  CONFIG.IB_LINK.on = 0;
  t.after(() => (CONFIG.IB_LINK.on = linkK));
  const G = newRound({ seed: 3, weapon: 'zweihander', weapon2: 'longsword', gap: 1.9 });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo', 'cingir']) });
  G.before = () => W.update(DT, !!P.skill.sec);
  const F = 1 / 60;
  const circle = () => {
    let go = false;
    const n = Math.round(0.8 / F);
    let prev = [0, 0];
    for (let i = 1; i <= n && !go; i++) {
      const z = i / n;
      const p = [0.15 * (Math.cos(z * Math.PI * 2 * 1.35) - 1), 0.15 * Math.sin(z * Math.PI * 2 * 1.35)];
      go = uq.circleTick(F, { x: p[0] - prev[0], y: p[1] - prev[1] }, true, !P.skill.sec && P.alive);
      prev = p;
      G.step();
    }
    return go;
  };
  try {
    while (G.t < ARENA.startHold + 0.3) G.step();
    assert.equal(W.open, null, '비기 창 없음');
    const left0 = secretLeft(P);
    assert.equal(circle(), true, '원 한 바퀴 → 싱지르');
    const run = P.skill.sec;
    assert.equal(run?.special, 'cingir');
    assert.ok(P.ibSpin, '대본');
    assert.equal(P.ibSpin.near, false, '가까워도 앞발 축');
    assert.equal(P.ibSpin.stride, SECRET.ibSpin.stride);
    assert.equal(P.uniqueCue?.kind, 'unique');
    assert.equal(P.uniqueCue?.text, '풍차 베기 (싱지르)'); // 11/12 이름 (전투 화면은 splitName — 큰 줄 '풍차 베기' · 작은 줄 '싱지르')
    // 빠르기 = 고노센 × 0.3 → 비기 판(0.5)보다 한 바퀴가 김
    assert.ok(Math.abs(P.ibSpin.vmax / P.ibSpin.v0 - UA.specialShare.cingir) < 1e-9, `칼끝 상한 몫 ${P.ibSpin.vmax / P.ibSpin.v0}`);
    let maxHit = 0;
    let t = 0;
    while (P.skill.sec && t < realS(4)) {
      maxHit = Math.max(maxHit, P.secretHit ?? 1);
      assert.notEqual(P.skill.sec?.stage, 'stiff', '굳음 없음');
      G.step();
      t += DT;
    }
    assert.equal(P.skill.sec, null, '끝남');
    assert.equal(maxHit, 1, '비기 판정 배율 없음');
    assert.equal(secretLeft(P), left0, '비기 셈 아님');
    assert.equal(P.skill.secretBursts, 0, '비기 연출 · 소리 없음');
    assert.equal(uq.stats.fired.cingir, 1);
    assert.ok(uq.coolLeft('cingir') > 0, '식힘');
    assert.equal(circle(), false, '식는 동안 안 남');
  } finally {
    G.world.free();
  }
});

test('한 걸음 나가며 — 서 있는 과녁 · 네 칼: 골반이 stride 만큼 나아감(전 비기 판 0.42 ~ 0.53 m) · 안 넘어짐 · 몸 기울기 20° 아래 · 끝 두 발 앞뒤 펜싱 너비 · 칼끝 거리 밖 과녁도 벰', () => {
  for (const w of ['zweihander', 'flamberge', 'tizona', 'durandal']) {
    const r = spinRun({ w, gap: 2.1 });
    assert.equal(r.fell, false, w);
    assert.ok(r.tiltMax < 20, `${w} 기울기 ${r.tiltMax}`);
    assert.ok(r.travel > SECRET.ibSpin.stride - 0.06 && r.travel < SECRET.ibSpin.stride + 0.15, `${w} 나아감 ${r.travel}`);
    assert.ok(r.feetLon > 0.45 && r.feetLon < 0.85, `${w} 두 발 앞뒤 ${r.feetLon}`);
    assert.ok(r.hit, `${w} 벰`);
  }
});

test('AI — 숙련도 5 이베리아: 비기 알티바슈 포르트(싱지르 무장 셈) · 숙련도 3 이상: 왼 가로베기 자리 특수 공격 싱지르(바탕 왼 가로베기) · 정수리 가르기는 고르는 목록에 없음', () => {
  const G = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 5 } });
  try {
    assert.equal(G.ai.secret?.name, 'altib');
    assert.ok(G.ai.spinArm, '무장 셈');
    const cg = G.ai.school.techByName.cingir;
    assert.equal(cg?.plain?.name, 'zwerchL');
    assert.ok(!G.ai.school.tech.some((t) => t.name === 'redondo'));
    assert.ok(G.ai.school.techByName.redondo, '비기가 빌려 쓰는 길');
  } finally {
    G.world.free();
  }
  const G3 = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 3 } });
  try {
    assert.equal(G3.ai.secret, null);
    assert.ok(G3.ai.school.techByName.cingir?.plain);
  } finally {
    G3.world.free();
  }
});

test('AI 비기 알티바슈 포르트 — 무장된 채 상대가 칼끝 거리 + altib.aiFire 안이면 메고 다가가 내려침 · 비기 셈 · 기력 0 · 특수 공격 식힘 없음', () => {
  const G = newRound({ seed: 4, weapon: 'longsword', weapon2: 'zweihander', persona: { proficiency: 5 }, gap: 3.6 });
  const P = G.player, A = G.ai, E = G.enemy;
  try {
    assert.equal(A.secret?.name, 'altib');
    let fired = false, st = null, w = 0;
    for (let i = 0; i < Math.round(realS(12) / DT) && !fired; i++) {
      // 사람 몸은 서서 천천히 다가감 (무장 뒤 들어오는 상대)
      P.move.set(0, G.t > ARENA.startHold + SECRET.ibSpin.armTime + 0.3 && P.foeDistance() > 1.2 ? 0.5 : 0);
      G.step();
      if (A.stats.altib?.begin) w++;
      if (A.stats.altib?.fired) (fired = true), (st = E.stamina.value);
    }
    assert.ok(w > 0, 'AI 가 비기로 메기 시작');
    assert.ok(fired, `AI 비기 내려침 (${JSON.stringify(A.stats.altib)} · ${JSON.stringify(A.stats.rdWind)})`);
    assert.equal(st, 0, '내려친 뒤 기력 0');
    assert.equal(secretLeft(E), 0, '판당 한 번');
    assert.ok(!(A.specCool.redondo > 0), '특수 공격 식힘 없음');
    assert.ok(A.stats.altib.k[0] > 0 && A.stats.altib.k[0] <= 1);
  } finally {
    G.world.free();
  }
});
