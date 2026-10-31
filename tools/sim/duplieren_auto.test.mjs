// 겹치기 자동 시험 (사장님 10/31 16:xx '겹치기는 추가 커맨드 없이 일정 조건 충족하면 자동으로 나가게 하자' → 18:xx 결정 "겹치기는 가슴 사이 0.8~1.6 사이로 해. 0.6초 쌓이면 나가게 하고
//   0.2초 넘게 떨어지면 처음부터 다시 쌓고 막기 단추로 맞댄 것도 쌓아. 자세에 안 띄워도 돼. 초안 ok." — UNIQUE_ASSIST.dupAuto · 기록 docs/strike/duplieren_auto_2026-10-31.md):
//   기본 'bind' = 칼끼리 닿고 가슴 사이가 띠(죽음의 일격 거리 0.8 m 초과 ~ 1.6 m) 안인 채 쌓임 0.6 s 면 냄 · 끊김 0.2 s 안은 쥠 · 넘으면 0 · 막기 단추 맞댐도 셈 · 자세 칸 알림 없음 ·
//   0 = 전 판 탭 · 'clash2' = 두 닿음(떨어진 틈 dupClashGap 이상)이 dupClashT 안 · 막기 단추(dupAutoParry 0 판) · 식힘 · 긋는 중 미룸 · 켜면 탭은 보통 탭 찌르기 · 카드 입력 줄.
//  작게 · 빠르게: 판을 돌리지 않고 닿음 · 거리를 손으로 놓고 drive 를 부른다.  node --test tools/sim/duplieren_auto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { G7_CMD_AUTO, nodeCmd, nodeOf } from '../../src/skill_tree_data.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET } = CONFIG;
const KEYS = ['dupAuto', 'dupStackS', 'dupStackGap', 'dupStackDrain', 'dupBandMin', 'dupBandMax', 'dupClashT', 'dupClashGap', 'dupClashMax', 'dupAutoParry', 'dupAutoHint', 'specialCooldown', 'dupTap'];

test("기본값 — 사장님 10/31 18:xx 결정: 'bind' · 띠 0.8 m 초과(죽음의 일격 거리 밖) ~ 1.6 m · 쌓임 0.6 s · 끊김 0.2 s 넘으면 처음부터 · 막기 단추 맞댐도 셈 · 자세 칸 알림 없음 · clash2 값은 사다리 칸", () => {
  assert.equal(UA.dupAuto, 'bind');
  assert.equal(UA.dupTap, 1); // 탭 조건 스위치는 그대로 (자동 판이면 TAP_TRIG.dup 이 안 봄 — dupAuto 0 이면 전 판 탭)
  assert.ok(Math.abs(UA.dupStackS - realS(0.6)) < 1e-9, `dupStackS ${UA.dupStackS}`);
  assert.ok(Math.abs(UA.dupStackGap - realS(0.2)) < 1e-9, `dupStackGap ${UA.dupStackGap}`);
  assert.equal(UA.dupStackDrain, 0, '0.2 s 넘게 떨어지면 처음부터');
  assert.equal(UA.dupBandMin, null);
  assert.equal(SECRET.mordCloseN, 0.8);
  assert.equal(UA.dupBandMax, 1.6);
  assert.equal(UA.dupAutoParry, 1, '막기 단추로 맞댄 것도 쌓음');
  assert.equal(UA.dupAutoHint, 0, '자세에 안 띄움');
  const LAD = [0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0];
  for (const k of ['dupClashT', 'dupClashGap']) assert.ok(LAD.some((s) => Math.abs(UA[k] - realS(s)) < 1e-9), `${k} ${UA[k]}`);
  assert.equal(UA.dupClashMax, 0);
});

/** 사람 롱소드 몸 + 독일 고유 공격 셋 (판을 돌리지 않음 — 닿음 · 가슴 사이를 손으로 놓고 drive 를 부름) */
function body(set = {}) {
  const save = Object.fromEntries(KEYS.map((k) => [k, UA[k]]));
  Object.assign(UA, set);
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword' });
  const P = G.player;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['zwerchAbtritt', 'duplieren', 'schielhau']) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  const st = { touch: true, d: 1.1 };
  uq.bladeTouch = () => st.touch;
  P.foeDistance = () => st.d;
  P.skill.inputSwinging = false;
  const fired = () => uq.stats.fired.duplieren ?? 0;
  /** n 스텝 drive (냈으면 그 스텝 번호 · 아니면 -1) — 낸 칼은 곧장 지움(다음 시험이 이어 셀 수 있게) */
  const run = (n, each = null) => {
    for (let i = 0; i < n; i++) {
      each?.(i);
      const f0 = fired();
      uq.drive(DT);
      if (fired() > f0) return i;
    }
    return -1;
  };
  const clear = () => {
    P.iai = null;
    P.iaiReq = null;
    P.iaiHoldT = 0;
    P.iaiFade = 0;
    uq.coolT = {};
    uq.coolRun = {};
  };
  return { G, P, uq, st, run, fired, clear, free: () => (Object.assign(UA, save), G.world.free()) };
}

test("'bind' — 띠 안에서 맞댄 채 쌓임 dupStackS 째 스텝에 냄 (탭 판과 같은 칼 · 식힘 시작 · 탭 하나 기력 · autoFired) · 그 전엔 안 냄", () => {
  const B = body({ dupAuto: 'bind', specialCooldown: realS(3.0) });
  try {
    const need = Math.ceil(UA.dupStackS / DT);
    const i = B.run(need + 5);
    assert.ok(i >= need - 2 && i <= need + 1, `냄 스텝 ${i} (쌓임 ${need} 스텝)`);
    const R = B.P.iaiReq;
    assert.ok(R?.combo && R.tech === 'duplieren', '운동학 칼 (requestArtDup)');
    assert.ok(R.moves[0].dup && R.moves[0].same);
    assert.equal(B.uq.stats.autoFired, 1);
    assert.ok(B.uq.cooling(B.uq.dupE), '특수 공격 식힘 시작');
    assert.ok(B.P.uniqueCue?.name === 'duplieren', '기술 이름 알림');
    // 식힘 중엔 안 쌓임
    B.P.iai = null;
    B.P.iaiReq = null;
    assert.equal(B.run(need * 2), -1, '식힘 중');
  } finally {
    B.free();
  }
});

test("'bind' — 죽음의 일격 거리(가슴 사이 ≤ 0.8 m) · 띠 위(> dupBandMax) · 떨어짐은 안 쌓임 · 끊김 dupStackGap 안은 쥠 · 넘으면 0", () => {
  const B = body({ dupAuto: 'bind', specialCooldown: 0 });
  try {
    const need = Math.ceil(UA.dupStackS / DT);
    B.st.d = 0.8;
    assert.equal(B.run(need * 3), -1, '0.8 m (죽음의 일격 거리)');
    B.st.d = 0.6;
    assert.equal(B.run(need * 3), -1, '0.6 m');
    B.st.d = UA.dupBandMax + 0.01;
    assert.equal(B.run(need * 3), -1, '띠 위');
    B.st.d = 1.1;
    B.st.touch = false;
    assert.equal(B.run(need * 3), -1, '떨어짐');
    // 절반 쌓고 · 짧은 끊김(쥠) · 나머지 → 냄
    B.st.touch = true;
    const half = Math.floor(need / 2);
    assert.equal(B.run(half), -1);
    const gapN = Math.floor(UA.dupStackGap / DT) - 2;
    B.st.touch = false;
    assert.equal(B.run(gapN), -1);
    B.st.touch = true;
    const i = B.run(need);
    assert.ok(i >= need - half - 2 && i <= need - half + 1, `짧은 끊김 뒤 이어 셈 — ${i}`);
    B.clear();
    // 절반 쌓고 · 긴 끊김(0) · 다시 처음부터
    assert.equal(B.run(half), -1);
    B.st.touch = false;
    assert.equal(B.run(Math.ceil(UA.dupStackGap / DT) + 3), -1);
    B.st.touch = true;
    const j = B.run(need + 3);
    assert.ok(j >= need - 2, `긴 끊김 뒤 처음부터 — ${j}`);
    // 가슴 사이가 띠 밖으로 나간 것도 끊김
    B.clear();
    assert.equal(B.run(half), -1);
    B.st.d = 0.75;
    assert.equal(B.run(Math.ceil(UA.dupStackGap / DT) + 3), -1);
    B.st.d = 1.1;
    const k = B.run(need + 3);
    assert.ok(k >= need - 2, `띠 밖으로 나간 뒤 처음부터 — ${k}`);
  } finally {
    B.free();
  }
});

test("'bind' — 막기 단추를 누른 동안은 안 쌓임(dupAutoParry 0) · 1 이면 쌓고 냄 · 손가락이 긋는 중이면 냄만 미룸(쌓임 쥠) · 자세 칸 알림은 절반부터 · 빠짐 판", () => {
  const B = body({ dupAuto: 'bind', specialCooldown: 0, dupAutoParry: 0, dupAutoHint: 1 }); // 16:xx 시제품 판(막기 단추 안 셈 · 알림 켬)부터 보고 아래에서 사장님 판(1)으로
  try {
    const need = Math.ceil(UA.dupStackS / DT);
    B.uq.feed(0, 0, 1 / 60, true, true); // 막기 단추 누름 (main.js feed — blocked · handHeld)
    assert.equal(B.run(need * 3), -1, '막기 단추');
    UA.dupAutoParry = 1;
    const i = B.run(need + 3);
    assert.ok(i >= 0, '막기 단추와 상관없이 (dupAutoParry 1)');
    UA.dupAutoParry = 0;
    B.clear();
    B.uq.feed(0, 0, 1 / 60, false, false);
    // 자세 칸 알림 · 긋는 중엔 미룸
    const half = Math.floor(need / 2);
    assert.equal(B.run(half), -1);
    assert.equal(B.uq.dupCue?.name, 'duplieren', '절반 — 자세 칸 알림');
    assert.equal(B.uq.dupCue?.sub, '맞물림');
    B.P.skill.inputSwinging = true;
    assert.equal(B.run(need * 2), -1, '긋는 중 — 미룸');
    assert.ok(B.uq.dupA.st >= UA.dupStackS, '쌓임은 쥠');
    B.P.skill.inputSwinging = false;
    assert.equal(B.run(2), 0, '손가락이 멈춘 스텝에 냄');
    UA.dupAutoHint = 0;
    B.clear();
    B.run(Math.floor(need * 0.8));
    assert.equal(B.uq.dupCue, null, '알림 끔');
    // 빠짐 판 (dupStackDrain 0.5): 긴 끊김 뒤에도 쌓임이 남아 이어 셈
    UA.dupAutoHint = 1;
    UA.dupStackDrain = 0.5;
    B.clear();
    B.uq.dupA = null;
    assert.equal(B.run(half), -1);
    B.st.touch = false;
    const offN = Math.ceil(UA.dupStackGap / DT) + Math.ceil(realS(0.2) / DT);
    assert.equal(B.run(offN), -1);
    const left = B.uq.dupA.st;
    assert.ok(left > 0 && left < half * DT, `빠진 뒤 남음 ${left}`);
    B.st.touch = true;
    const k = B.run(need);
    assert.ok(k >= 0 && k < need - 2, `빠짐 판 이어 셈 — ${k}`);
  } finally {
    B.free();
  }
});

test("'clash2' — 두 닿음(떨어진 틈 ≥ dupClashGap)이 dupClashT 안이면 둘째 닿음에 냄 · 짧은 떨어짐은 같은 닿음 · dupClashT 넘으면 안 냄 · 죽음의 일격 거리면 안 냄", () => {
  const B = body({ dupAuto: 'clash2', specialCooldown: 0 });
  try {
    const gapN = Math.ceil(UA.dupClashGap / DT) + 2;
    const pulse = (on, off) => {
      B.st.touch = true;
      const a = B.run(on);
      if (a >= 0) return a;
      B.st.touch = false;
      const b = B.run(off);
      return b >= 0 ? on + b : -1;
    };
    assert.equal(pulse(5, gapN), -1, '첫 닿음');
    B.st.touch = true;
    assert.ok(B.run(3) >= 0, '둘째 닿음 — 냄');
    B.clear();
    B.uq.dupA = null;
    // 짧은 떨어짐 = 같은 닿음
    assert.equal(pulse(5, 3), -1);
    assert.equal(pulse(5, 3), -1, '짧은 떨어짐은 같은 닿음');
    B.uq.dupA = null;
    // T 넘음
    assert.equal(pulse(5, Math.ceil(UA.dupClashT / DT) + 5), -1);
    B.st.touch = true;
    assert.equal(B.run(3), -1, 'dupClashT 넘음');
    B.uq.dupA = null;
    B.st.touch = false;
    B.run(gapN);
    // 죽음의 일격 거리
    B.st.d = 0.7;
    assert.equal(pulse(5, gapN), -1);
    B.st.touch = true;
    assert.equal(B.run(3), -1, '0.7 m');
  } finally {
    B.free();
  }
});

test('켜면 탭은 보통 탭 찌르기 (맞물린 채 탭이어도 겹치기 아님) · 끄면(0) 탭 판 그대로', () => {
  const B = body({ dupAuto: 'bind', specialCooldown: 0 });
  try {
    B.uq.cur = { tech: 'zornhau', kind: 'cut', tap: false, t0: B.uq.t - 0.2, dir: [-0.7, -0.7], landed: false, bound: true, tEnd: null, unique: null };
    B.P.skill.tap = null;
    B.P.skill.thrust();
    assert.equal(B.fired(), 0, '자동 판 — 탭은 겹치기 아님');
    assert.ok(B.P.skill.tap, '보통 탭 찌르기');
    UA.dupAuto = 0;
    B.P.skill.tap = null;
    B.uq.tapRec = null;
    B.uq.cur = { tech: 'zornhau', kind: 'cut', tap: false, t0: B.uq.t - 0.2, dir: [-0.7, -0.7], landed: false, bound: true, tEnd: null, unique: null };
    B.P.skill.thrust();
    assert.equal(B.fired(), 1, '끔 — 탭 판');
    // 끔이면 drive 가 자동 셈을 안 함
    B.clear();
    B.uq.dupA = null;
    B.run(Math.ceil(realS(3) / DT));
    assert.equal(B.uq.dupA, null);
  } finally {
    B.free();
  }
});

test('G7 카드 입력 줄 — 기본(자동 bind) = 사장님 초안 ok 글 · 0 이면 전 탭 글 · clash2 초안(검수 전): 33 자 안 · 숫자 · 원어 글자 없음 · 칼 동작 말(베기 · 찌르기) 없음 · 효과 글은 사장님 글 그대로', () => {
  const n = nodeOf('german', 'G7');
  assert.equal(n.eff, '칼이 맞물리면 상대 칼 뒤로 들어가 얼굴을 벤다');
  assert.equal(n.cmd, '가까이서 칼을 맞댄 채 버티면 자동 발동', '사장님 10/31 18:xx 초안 ok');
  assert.equal(nodeCmd(n), n.cmd, '기본(자동 bind) — 카드에 이 글');
  const save = UA.dupAuto;
  try {
    UA.dupAuto = 0;
    assert.equal(nodeCmd(n), '긋기가 상대 칼에 닿은 채 탭', '0 = 전 판 탭 글');
    for (const m of ['bind', 'clash2']) {
      UA.dupAuto = m;
      const c = nodeCmd(n);
      assert.equal(c, G7_CMD_AUTO[m]);
      assert.ok(c.length <= 33, `${c} ${c.length}`);
      assert.ok(!/[0-9A-Za-z一-鿿぀-ヿ]/.test(c), c);
      assert.ok(!/베기|찌르기/.test(c), c);
      assert.ok(/자동 발동$/.test(c), c);
    }
  } finally {
    UA.dupAuto = save;
  }
  // 다른 칸은 그대로
  assert.equal(nodeCmd(nodeOf('german', 'G5')), nodeOf('german', 'G5').cmd);
});
