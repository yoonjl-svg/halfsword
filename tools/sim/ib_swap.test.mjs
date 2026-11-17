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
  assert.equal(SECRET.mord.kin, 0.4); // 11/16 '격살과 모르트슐라크도 40%로' (전 '30%') // 11/16 사장님 '모르트슐라크 30%' (전 11/11 '빠르기 35%로 하자.')
  assert.equal(SECRET.mordPress, realS(1.5)); // '1.5초로 해.'
  assert.equal(UA.specialShare.cingir, 0.3); // '빠르기를 고노센의 30%로'
  assert.equal(UA.specialShare.duplieren, 0.3); // '겹치기 30으로.'
  assert.equal(UA.rdDrainCut, 1); // 메는 동안 초당 베기 한 번 값 그대로 (사장님 11/01 — 오래 멜수록 약해짐)
  assert.ok(SECRET.ibSpin.stride > 0, '싱지르 한 걸음 (새 값 · 사장님 확인 전)');
  assert.ok([0.3, 0.45, 0.6].includes(SECRET.ibSpin.stride), '걸음 사다리 가운데');
});

test('스킬트리 — B4 알티바슈 포르트가 비기 자리(전 B7 값) · B7 싱지르가 특수 공격 자리(전 B4 값) · 이어지는 흐름은 그 자리의 칸(B7) 뒤', (t) => {
  // 11/14 그때 판으로 묶음 (B7 글이 이어 돌리기 글로 바뀜 — 사장님 '모두 본판에' · `?ibLink=0` 판은 11/12 풍차 베기 글 그대로 B7_WINDMILL · 기준은 안 고침 · docs/strike/ib_link_2026-11-14.md §11)
  const linkK = CONFIG.IB_LINK.on;
  CONFIG.IB_LINK.on = 0;
  t.after(() => (CONFIG.IB_LINK.on = linkK));
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



test('무게 보정 견줌(weightFix — 기본 끔): 켜면 위력 몫 = (멜 때 기력 − 무게 1 값으로 멘 만큼) ÷ 최대 · 끄면 뗀 순간 기력 ÷ 최대', () => {
  const f = { stamina: { value: 60, max: 100, infinite: false } };
  assert.equal(altibPower(f, { s0: 100, base: 30 }), 0.6);
  SECRET.altib.weightFix = 1;
  try {
    assert.equal(altibPower(f, { s0: 100, base: 30 }), 0.7);
  } finally {
    SECRET.altib.weightFix = 0;
  }
  assert.equal(altibPower({ stamina: { value: -5, max: 100 } }, null), 0);
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


