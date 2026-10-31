// 겹치기 단순 길 · 앞 박차기 시험 (사장님 10/31 19:xx '겹치기의 발동 경로가 좀 어색하더라 … 컨셉에 맞게 가장 효율적이고 단순한 움직임 … 속도는 … 낮추는 대신 박차기를 앞으로 쓰면서 치는 효과 …
//   앞 박차기는 … 겹치기와 함께만 발동' · '손 동작과 발 동작이 어우러져야 하니까. 그게 최우선.' — 기록 docs/strike/duplieren_simple_2026-10-31.md · 확인표 3300 ~ 3309):
//   기본 = 단순 길(dupOld 0 — 맞닿은 자리 축 한 축 돌림) · 앞 박차기 dupBurst(걸음 사다리 칸 · 죽음의 일격 거리에서 멈춤 · 칼과 같은 시간에 고르게 미끄러짐 · 앞발이 같은 시간에 내딛음 · 기력 pushCost — dupBurstFree 면 안 냄)
//   · `?dupOld=1` 판은 10/28 길 그대로(박차기 없음). 작게 · 빠르게: 판을 돌리지 않고 닿음을 손으로 놓고 겹치기를 낸 뒤 스텝을 몇 번 돌림.  node --test tools/sim/duplieren_simple.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET, STAMINA } = CONFIG;
const LADDER = [0.3, 0.45, 0.6, 0.9];

test('기본값 — 단순 길(dupOld 0) · 앞 박차기 걸음 사다리 칸 · 기력 냄(dupBurstFree 0) · 견줌 몫 0.5 · 끄는 시간 상한 실제 0.2 s 그대로', () => {
  assert.equal(UA.dupOld, 0);
  assert.ok(LADDER.includes(UA.dupBurst), `dupBurst ${UA.dupBurst}`);
  assert.equal(UA.dupBurstFree, 0);
  assert.equal(UA.dupOldShare, 0.5);
  assert.ok(UA.specialShare.duplieren > 0 && UA.specialShare.duplieren < 0.5, `몫 ${UA.specialShare.duplieren}`);
  assert.ok(Math.abs(UA.dupSnapTime - realS(0.2)) < 1e-12);
  assert.equal(UA.dupEdge, 1);
});

/** 사람 롱소드 몸 + 겹치기 (판을 돌리지 않음 — 가슴 사이를 d 로 두고 겹치기를 바로 냄) */
function body(set = {}, gap = 1.25) {
  const keys = ['dupOld', 'dupBurst', 'dupBurstFree', 'dupAxisMax', 'specialCooldown'];
  const save = Object.fromEntries(keys.map((k) => [k, UA[k]]));
  const share0 = UA.specialShare.duplieren;
  Object.assign(UA, { specialCooldown: 0, ...set });
  if (set.share != null) UA.specialShare.duplieren = set.share;
  const G = newRound({ walls: true, seed: 3, weapon: 'longsword', weapon2: 'longsword', gap });
  const P = G.player;
  const E = G.enemy;
  G.ai.update = () => {};
  E.applyWound = () => {};
  const uq = new PlayerUniqueAssist(P, { names: new Set(['duplieren']) });
  // 판 시작 발 묶임(ARENA.startHold)을 넘김 — 묶인 발은 걸음을 안 받음
  while (P.feetHeld && G.t < 3) G.step();
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  const fire = () => {
    const ok = uq.launchTap(uq.dupE, uq.t, true);
    const out = { ok, steps: [] };
    for (let i = 0; i < 60; i++) {
      G.step();
      const I = P.iai;
      out.steps.push({ t: G.t, on: !!(I && I.tech === 'duplieren'), slide: I?.slide ? { ...I.slide } : null, dup: I?.dup ?? null, burst: I?.burst ?? null, ax: I?.dupAx ? I.dupAx.clone() : null, segs: I?.segs ? I.segs.map((s) => ({ D: s.B.D.clone(), T: s.T })) : null, legs: P.gait?.legs ? { F: !!P.gait.legs.F.stance, B: !!P.gait.legs.B.stance, kF: P.gait.legs.F.kind, kB: P.gait.legs.B.kind } : null, d: P.foeDistance(), req: P.gait?.req ? { ...P.gait.req } : null });
    }
    return out;
  };
  return { G, P, E, uq, fire, free: () => (Object.assign(UA, save), (UA.specialShare.duplieren = share0), G.world.free()) };
}

test('단순 길 — 맞닿은 자리 축 한 축 돌림 (토막 칼 방향이 모두 같은 축 둘레 · 따로 밀어 넣는 토막 없음 · 모두 베는 토막) · 앞 박차기 = 칼이 끌리는 시간 동안 고르게 · 앞발이 같은 때 뜸', () => {
  const B = body({ dupBurst: 0.45, share: 0.2 });
  try {
    const R = B.fire();
    assert.ok(R.ok, '냄');
    const first = R.steps.find((s) => s.on);
    assert.ok(first, '운동학 칼');
    assert.equal(first.dup.line, 1, '단순 길');
    // 한 축: 토막 끝 칼 방향이 모두 같은 축(I.dupAx)과 같은 각 (한 축 돌림 — 원뿔 · 큰 원)
    const segs = first.segs;
    assert.ok(segs.length >= 3);
    const ax = first.ax;
    const c0 = segs[0].D.dot(ax);
    for (const s of segs) assert.ok(Math.abs(s.D.dot(ax) - c0) < 1e-6, `한 축 ${s.D.dot(ax)} · ${c0}`);
    // 박차기: 고르게 · 칼 시간에 맞춤 (상한 안)
    const S = first.slide;
    assert.ok(S && S.slide > 0.3 && S.slide <= 0.45 + 1e-9, `미끄러짐 ${S?.slide}`);
    assert.equal(S.ease, 'line');
    const span = Math.min(segs.reduce((a, s) => a + s.T, 0), UA.dupSnapTime);
    assert.ok(Math.abs(S.span - span) < 1e-6, `미끄러짐 시간 ${S.span} · 칼 ${span}`);
    assert.ok(first.burst?.asked, '앞발 걸음을 받음');
    // 앞발: 칼이 시작한 뒤 두 스텝 안에 뜸 (걷던 앞발이 떠 있었으면 그 걸음을 이어받음 — 'req')
    const i0 = R.steps.indexOf(first);
    const lifted = R.steps.slice(i0, i0 + 3).some((s) => s.legs && ((!s.legs.F && s.legs.kF === 'req') || (!s.legs.B && s.legs.kB === 'req')));
    assert.ok(lifted, `앞발 뜸 ${JSON.stringify(R.steps.slice(i0, i0 + 3).map((s) => s.legs))}`);
  } finally {
    B.free();
  }
});

test('앞 박차기는 죽음의 일격 거리(가슴 사이 SECRET.mordCloseN 0.8 m)에서 멈춤 — 가슴 사이 1.0 m 에서 0.45 m 박차기면 0.2 m 만', () => {
  const B = body({ dupBurst: 0.45, share: 0.2 }, 1.0);
  try {
    const d0 = B.P.foeDistance();
    const R = B.fire();
    const first = R.steps.find((s) => s.on);
    assert.ok(first?.slide, '미끄러짐');
    assert.ok(Math.abs(first.slide.slide - Math.max(0, Math.min(0.45, d0 - SECRET.mordCloseN))) < 0.03, `미끄러짐 ${first.slide.slide} · 처음 가슴 사이 ${d0}`);
  } finally {
    B.free();
  }
});

test('기력: 박차기 걸음 pushCost 12 (죽음의 일격 강제 박차기와 같은 칸) — dupBurstFree 1 이면 안 냄 · 탭 하나(베기 12 × 무게)는 그대로', () => {
  for (const free of [0, 1]) {
    const B = body({ dupBurst: 0.45, dupBurstFree: free, share: 0.2 });
    try {
      const st = B.P.stamina;
      const p0 = st.spent.push;
      const a0 = st.spent.attack;
      B.fire();
      assert.equal(st.spent.push - p0, free ? 0 : STAMINA.pushCost, `push ${st.spent.push - p0}`);
      assert.ok(st.spent.attack - a0 > 0, '탭 하나');
    } finally {
      B.free();
    }
  }
});

test('박차기 0 = 걸음 · 미끄러짐 없음 (단순 길만) · dupOld 1 = 10/28 길(comboPlanDup — 감는 쪽 way 칸) · 박차기 없음', () => {
  for (const [set, old] of [[{ dupBurst: 0, share: 0.2 }, false], [{ dupOld: 1, share: 0.5 }, true]]) {
    const B = body(set);
    try {
      const R = B.fire();
      const first = R.steps.find((s) => s.on);
      assert.ok(first, '운동학 칼');
      assert.equal(first.slide, null, '미끄러짐 없음');
      assert.equal(first.burst, null, '박차기 없음');
      if (old) assert.ok(first.dup.way != null && first.dup.line == null, '10/28 길');
      else assert.equal(first.dup.line, 1);
    } finally {
      B.free();
    }
  }
});
