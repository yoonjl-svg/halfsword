// 풍차 베기 (싱지르 · 이베리아 특수 공격) 두 마디 대본 · 이름 시험 (11/12 사장님 '싱지르 이름을 이제 풍차 베기로 바꿔야하지 않아? 그리고 한걸음 내딛는 동작이 이상해.
//  다리 하나를 축 삼아 돌고 있는데 그러면 안 되지. 먼저 빠르게 돌고 그 다음 발을 내딛으면서베야지.' · '돌려면 앞 디딤발 각도를 90도 정도 틀어서 미리 바꿔야 할 수도 있어' —
//  기록 docs/strike/windmill_2026-11-12.md · config SECRET.ibSpin.split · src/iberian_spin.js splitStep · 재는 판 tools/sim/windmill.mjs)
//  시간 상한(몇 초 안에 끝나야 함)은 보지 않는다 — 차례 · 몸 범위 · 넘어짐 · 칼 빠르기 몫만.
//  node --test tools/sim/windmill.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT } from './harness_m.mjs';
import { SECRET, ARENA, UNIQUE_ASSIST as UA, realS } from '../../src/config.js';
import { PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { nodeTitle } from '../../src/skill_tree.js';
import * as D from '../../src/skill_tree_data.js';
import { windRun } from './windmill.mjs';
import { runOne } from './singir_fall.mjs';
import { IB_LINK } from '../../src/config.js';
/** 11/14 이어 돌리기(B7 — IB_LINK.on) 전 판으로 잠깐 (풍차 베기 원 긋기 장면 시험 — docs/strike/ib_link_2026-11-14.md §7) */
const withLinkOff = (fn) => { const k = IB_LINK.on; IB_LINK.on = 0; try { return fn(); } finally { IB_LINK.on = k; } };

const W4 = ['zweihander', 'flamberge', 'tizona', 'durandal'];
const LADDER = [0.2, 0.4, 0.6, 1.2, 1.5]; // 시간 사다리 (사장님 10/28 — 반응 · 짧은 효과 · 이어짐/입력 · 1.2 · 무장)
const withSet = (patch, fn) => {
  const old = { ...SECRET.ibSpin.split };
  Object.assign(SECRET.ibSpin.split, patch);
  try {
    return fn();
  } finally {
    Object.assign(SECRET.ibSpin.split, old);
  }
};

test('기본값: 두 마디 켬 · 앞발 틀기 90° · 엉덩이 밑 · 마디 시간은 시간 사다리 · 걸음 0.6 · 칼끝 고노센 × 0.3 그대로 (새 값 — 사장님 확인 전)', () => {
  const S = SECRET.ibSpin.split;
  assert.equal(S.on, 1);
  assert.equal(S.foot, 90); // 사장님 '90도 정도'
  assert.equal(S.under, 1);
  for (const k of ['prep', 'turn', 'step']) assert.ok(LADDER.includes(S[k]), `${k} ${S[k]} 사다리 밖`);
  assert.equal(SECRET.ibSpin.stride, 0.6); // 걸음 길이 그대로 (사장님 따로 안 정함)
  assert.equal(UA.specialShare.cingir, 0.3); // '빠르기를 고노센의 30%로' 그대로
});

test('두 마디 차례 — 발 틀기 → 제자리 돌기 → 앞발 내디디며 벰 → 받아 멈춤 · 걸음은 돌기 뒤 · 몸 범위 (네 칼 · 서 있는 과녁 가슴 2.2 m)', () => {
  for (const w of W4) {
    const r = windRun({ w, gap: 2.1 });
    const P = r.phases;
    assert.equal(r.split, true, w);
    assert.ok(P.prep && P.spin && P.step && P.settle, `${w} 마디 ${JSON.stringify(P)}`);
    assert.ok(P.prep[0] < P.spin[0] && P.spin[0] < P.step[0] && P.step[0] < P.settle[0], `${w} 차례 ${JSON.stringify(P)}`);
    // 걸음은 돌기 뒤: 돌기 동안 골반은 축발 위로만(낼 때 상대 쪽 몫 < 0.25 m — 11/11 판 0.6) · 내딛기 마디에서 나머지를 나아감 · 끝 = stride
    assert.ok(r.pelEnd.spin < 0.25, `${w} 돌기 동안 골반 ${r.pelEnd.spin}`);
    assert.ok(r.pelEnd.step - r.pelEnd.spin > 0.35, `${w} 내딛기 동안 골반 ${r.pelEnd.step - r.pelEnd.spin}`);
    assert.ok(Math.abs(r.pelEnd.step - SECRET.ibSpin.stride) < 0.08, `${w} 끝 골반 ${r.pelEnd.step}`);
    assert.equal(r.axisLiftSpin ?? 0, 0, `${w} 돌기 동안 축발은 디딘 채`);
    assert.ok(r.axisLiftStep > 0, `${w} 내딛기 동안 앞발이 들림`);
    assert.equal(r.otherLiftStep ?? 0, 0, `${w} 내딛기 동안 뒷발은 디딘 채`);
    assert.ok(Math.abs(r.turned - 360) < 2, `${w} 돈 각 ${r.turned}`);
    // 칼은 내딛기 마디(앞발이 딛는 무렵)에 상대를 지나감 · 칼끝 = 고노센 × 0.3 상한 안
    assert.ok(r.hit, `${w} 벰`);
    assert.ok(['step', 'settle'].includes(r.first.ph), `${w} 처음 맞음 마디 ${r.first.ph}`);
    assert.ok(r.tipMax <= r.vmax * 1.1, `${w} 칼끝 ${r.tipMax} · 상한 ${r.vmax}`);
    // 몸: 넘어짐 · 두 발 엇갈림 없음 · 기울기 · 칼이 제 몸 · 다리 · 땅에 안 닿음 · 팔 관절
    assert.equal(r.fell, false, `${w} 넘어짐`);
    assert.equal(r.cross, 0, `${w} 두 발 엇갈림`);
    assert.ok(r.tiltMax < 20, `${w} 기울기 ${r.tiltMax}`);
    assert.ok(r.ownMin > 0.1, `${w} 칼 ↔ 제 몸 ${r.ownMin} (${r.ownAt})`);
    assert.ok(r.lowMin > 0.3, `${w} 칼 가장 낮은 높이 ${r.lowMin}`);
    for (const k of ['elbow', 'elbowO', 'elbowOff', 'elbowOffO', 'wrist', 'roll', 'shBack', 'shPlane', 'shRot', 'spine', 'gripGap']) assert.equal(r.arms.out[k] ?? 0, 0, `${w} 팔 ${k} 범위 밖 ${r.arms.out[k]}`);
    assert.ok(r.arms.max.wristFE < 82, `${w} 손목 굽힘 ${r.arms.max.wristFE}`); // 끝 스프링 ±70 + 물리 몫 (11/11 판도 80)
    assert.ok(r.feetLon > 0.45 && r.feetLat > 0.2, `${w} 끝 두 발 앞뒤 ${r.feetLon} · 옆 ${r.feetLat}`);
  }
});

test('앞발 틀기 — 앞발이 도는 쪽으로 90° 안팎 틀려 엉덩이 밑에 딛고 그 발로 돎: 축발이 땅에 비빈 각이 11/11 판(한 바퀴)보다 적고 엉덩이 비틀림은 허벅지 한계(34°) 안', () => {
  const r = windRun({ w: 'zweihander', gap: 2.1 });
  assert.ok(Math.abs(r.prepEnd.turn - SECRET.ibSpin.split.foot) < 8, `틀린 각 ${r.prepEnd.turn}`);
  assert.ok(r.prepEnd.dist < 0.2, `골반 ↔ 축발 ${r.prepEnd.dist}`);
  assert.ok(r.grindPivot < 300, `축발 비빈 각 ${r.grindPivot}`);
  assert.ok(r.twistMax < 30, `엉덩이 비틀림 ${r.twistMax}`);
  const old = withSet({ on: 0 }, () => windRun({ w: 'zweihander', gap: 2.1 }));
  assert.equal(old.split, false);
  assert.ok(old.grindPivot > 340, `11/11 판 축발 비빈 각 ${old.grindPivot}`);
  assert.ok(old.pelEnd.spin > 0.5, `11/11 판 돌기 동안 골반 ${old.pelEnd.spin} (돌며 나아감)`);
  // 견줌: 엉덩이 밑에 안 딛으면(제자리에서 틀기) 돌기 동안 골반이 축발로 옮겨 가고 두 발이 엇갈렸다 — under 1 의 까닭
  const nu = withSet({ under: 0 }, () => windRun({ w: 'zweihander', gap: 2.1 }));
  assert.ok(nu.pelEnd.spin > 0.4 && nu.cross > 0, `under 0 골반 ${nu.pelEnd.spin} · 엇갈림 ${nu.cross}`);
});

test('걷다 내도 같은 차례 — 한 발이 떠 있을 때 (앞으로 걷다 냄 · 두 거리): 두 발 엇갈림 없음 · 안 넘어짐 · 돌기 뒤 내딛기', () => {
  for (const gap of [2.6, 3.2]) {
    const r = windRun({ w: 'zweihander', gap, walk: 1 });
    assert.equal(r.split, true);
    assert.equal(r.cross, 0, `${gap} 엇갈림 ${JSON.stringify(r.crossAt)}`);
    assert.equal(r.fell, false, `${gap} 넘어짐`);
    assert.ok(r.phases.step && r.pelEnd.spin < 0.3, `${gap} 마디 ${JSON.stringify(r.phases)} · 돌기 동안 골반 ${r.pelEnd.spin}`);
    assert.ok(r.tiltMax < 20, `${gap} 기울기 ${r.tiltMax}`);
  }
});

test('넘어짐 되살아나지 않음 (11/05 고친 것 — 손가락 봇 대 숙련 3 롱소드 AI · 특수 공격 판 · 씨앗 1 ~ 6): 풍차 베기 뒤 1 s 안 몸 균형 넘어짐 0', () => {
  const HIT = new Set(['gauge', 'head', 'sever', 'buckle', 'revive']);
  let n = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = withLinkOff(() => runOne({ weapon: 'zweihander', opp: 'longsword', seed, dur: 8, secret: false, ibBot: 'old' })); // 11/14 그때 판으로 묶음 (B7 = 풍차 베기 · 그때 봇 — 이어 돌리기 판엔 원 긋기 풍차 베기가 없음 · ib_link 기록 §7)
    for (const s of r.probe.spins) {
      n++;
      assert.ok(!(s.fall && s.fall.dt <= 1 && !HIT.has(s.fall.why)), `씨앗 ${seed} 몸 균형 넘어짐 ${JSON.stringify(s.fall)}`);
    }
  }
  assert.ok(n > 0, '봇이 풍차 베기를 냄');
});

test('AI 도 같은 대본 — 숙련 3 이베리아 AI(왼 가로베기 자리 특수 공격)가 낸 풍차 베기는 두 마디 (발 틀기 · 돌기 · 내딛기)', () => {
  const G = newRound({ seed: 2, weapon: 'longsword', weapon2: 'zweihander', persona: { proficiency: 3 }, gap: 2.4 });
  const E = G.enemy;
  try {
    assert.equal(G.ai.school.techByName.cingir?.nameKo, '풍차 베기 (싱지르)', 'AI 기술 목록에 풍차 베기 (이름)');
    while (G.t < ARENA.startHold + 0.4) G.step();
    let fired = false;
    for (let i = 0; i < 200 && !fired; i++) {
      if (E.state === 'stand' && !E.skill.sec && !G.ai.secretRun) fired = G.ai.cingirGo();
      if (!fired) G.step();
    }
    assert.ok(fired, 'AI 가 냄');
    assert.ok(E.ibSpin?.sp, 'AI 몸에 두 마디 대본');
    const seen = new Set();
    for (let t = 0; t < realS(3) && E.skill.sec; t += DT) {
      if (E.ibSpin) seen.add(E.ibSpin.settle ? 'settle' : E.ibSpin.stepPh ? 'step' : E.ibSpin.tp < E.ibSpin.pre ? 'prep' : 'spin');
      G.step();
    }
    assert.deepEqual([...seen].filter((x) => x !== 'settle').slice(0, 3), ['prep', 'spin', 'step'], `마디 ${[...seen]}`);
    assert.equal(E.state, 'stand');
  } finally {
    G.world.free();
  }
});

test('이름 — 풍차 베기 (특수 공격 뜻 이름 · 원어 cingir 그대로 · 효과 글 · 입력 글 · 오의 · 출처 그대로)', (t) => {
  // 11/14 그때 판으로 묶음 (B7 글이 이어 돌리기 글로 바뀜 — 사장님 '모두 본판에' · `?ibLink=0` 판은 11/12 풍차 베기 글 그대로 B7_WINDMILL · 기준은 안 고침 · docs/strike/ib_link_2026-11-14.md §11)
  const k = IB_LINK.on;
  IB_LINK.on = 0;
  t.after(() => (IB_LINK.on = k));
  const e = PLAYER_UNIQUE.iberian.find((x) => x.name === 'cingir');
  assert.equal(e.nameKo, '풍차 베기 (싱지르)');
  assert.equal(e.orig, 'cingir');
  assert.equal(e.hint, '원을 그리며 그으면 한 걸음 나가며 몸을 한 바퀴 돌려 가로로 벤다'); // 사장님 11/12 글 — 새 동작 글 안은 기록에만 (코드 안 바꿈)
  const n = D.nodeOf('iberian', 'B7');
  assert.equal(n.name, '풍차 베기');
  assert.equal(n.l1, '풍차 베기');
  assert.equal(n.l2, '돌며 베기');
  assert.equal(n.eff, '한 걸음 나가며 몸을 한 바퀴 돌려 가로로 벤다');
  assert.equal(n.cmd, '원을 그리며 긋기(↻/↺)');
  assert.equal(n.lore, '큰 칼로 갈비를 온통 휘감고, 온몸을 돌려라');
  assert.equal(n.src, '고디뉴 『Arte de Esgrima』(1599) — 몬탄테 장 규칙 8');
  assert.equal(nodeTitle('iberian', n).title, '풍차 베기 (싱지르 · cingir)');
  // 옛 정수리 가르기(열쇠 redondo · 10/31 전 이름 '풍차 베기 (레돈두)')는 지금 알티바슈 포르트 — 같은 이름을 쓰지 않음
  const rd = PLAYER_UNIQUE.iberian.find((x) => x.name === 'redondo');
  assert.ok(!rd || !rd.nameKo.includes('풍차'), `redondo ${rd?.nameKo}`);
});
