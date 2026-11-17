// 겹치기 단순 길 · 앞 박차기 시험 (사장님 10/31 19:xx '겹치기의 발동 경로가 좀 어색하더라 … 컨셉에 맞게 가장 효율적이고 단순한 움직임 … 속도는 … 낮추는 대신 박차기를 앞으로 쓰면서 치는 효과 …
//   앞 박차기는 … 겹치기와 함께만 발동' · '손 동작과 발 동작이 어우러져야 하니까. 그게 최우선.' — 기록 docs/strike/duplieren_simple_2026-10-31.md · 확인표 3301 ~ 3309):
//   기본 = 단순 길(dupOld 0 — 맞닿은 자리 축 한 축 돌림) · 앞 박차기 dupBurst(걸음 사다리 칸 · 죽음의 일격 거리에서 멈춤 · 칼과 같은 시간에 고르게 미끄러짐 · 앞발이 같은 시간에 내딛음 · 기력 pushCost — dupBurstFree 면 안 냄)
//   · `?dupOld=1` 판은 10/28 길 그대로(박차기 없음). 작게 · 빠르게: 판을 돌리지 않고 닿음을 손으로 놓고 겹치기를 낸 뒤 스텝을 몇 번 돌림.  node --test tools/sim/duplieren_simple.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, SECRET, STAMINA } = CONFIG;
const LADDER = [0.3, 0.45, 0.6, 0.9];

test('기본값 — 단순 길(dupOld 0) · 앞 박차기 걸음 사다리 칸 · 기력 안 냄(dupBurstFree 1 — 사장님) · 손발 순서(dupBurstSync 1 — 몸 · 발 먼저 · 칼은 디딤에 출발 · 정해 둔 칼 늦음 없음) · 박차기 물리(dupBurstMatch 1) · 길이 맞춤(dupBurstFit 1) · 몫 0.25 — 사장님 11/01 00:xx 결정 · 견줌 몫 0.5 · 시간 상한 없음', () => {
  assert.ok(LADDER.includes(UA.dupBurst), `dupBurst ${UA.dupBurst}`);
  assert.equal(UA.dupStrikeLag, undefined, '사장님 10/31 00:xx — 칼이 닿는 때는 정해 두지 않음(길 ÷ 몫 빠르기)');
  assert.equal(UA.dupFitPoint, 0.2, '길이 맞춤 칼날 자리 — 잘 드는 몫의 코등이 쪽 끝 (사장님 확인 전)');
  assert.equal(UA.dupFitFloor, 0.5, '몸통이 맞닿는 가슴 사이까지 (죽음의 일격 거리 한도 없음 — 사장님 11/01 00:xx)');
  assert.equal(UA.specialShare.duplieren, 0.3, `몫 ${UA.specialShare.duplieren}`); // 11/11 사장님 '겹치기 30으로.' (전 0.25 — 11/01 00:xx '겹치기도 25%로 테이블 맞추자')
});

/** 사람 롱소드 몸 + 겹치기 (판을 돌리지 않음 — 가슴 사이를 d 로 두고 겹치기를 바로 냄) */
function body(set = {}, gap = 1.25) {
  const keys = ['dupBurst', 'dupFitPoint', 'dupFitMin', 'dupFitFloor', 'specialCooldown'];
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
      out.steps.push({ t: G.t, on: !!(I && I.tech === 'duplieren'), slide: I?.slide ? { ...I.slide } : null, dup: I?.dup ?? null, burst: I?.burst ?? null, maxT: I?.maxT ?? null, segs: I?.segs ? I.segs.map((s) => ({ D: s.B.D.clone(), T: s.T, pad: s.B.pad })) : null, cut: I?.segs ? I.segs.map((s) => s.cut) : null, legs: P.gait?.legs ? { F: !!P.gait.legs.F.stance, B: !!P.gait.legs.B.stance, kF: P.gait.legs.F.kind, kB: P.gait.legs.B.kind } : null, d: P.foeDistance(), req: P.gait?.req ? { ...P.gait.req } : null });
    }
    return out;
  };
  return { G, P, E, uq, fire, free: () => (Object.assign(UA, save), (UA.specialShare.duplieren = share0), G.world.free()) };
}

test('박차기 길이 맞춤(dupBurstFit 1 — 사장님 11/01 00:xx): 낸 자리에서 짠 얼굴 베기가 얼굴을 칼날 dupFitPoint 자리에서 지나는 거리까지 · 첫 걸음 박차기 물리 · 죽음의 일격 거리 한도 없음(몸통이 맞닿는 dupFitFloor 까지) · 짧으면 걸음 없음', () => {
  for (const gap of [1.5, 1.0, 0.82]) {
    const B = body({ dupBurst: 0.45, dupBurstFit: 1, share: 0.3 }, gap);
    try {
      const d0 = B.P.foeDistance();
      const R = B.fire();
      const first = R.steps.find((s) => s.on);
      assert.ok(first?.dup?.line === 1, '단순 길');
      const F = first.dup.fitStep;
      const S = first.slide;
      if (d0 <= UA.dupFitFloor + 1e-3) {
        assert.equal(S, null, `걸음 없음 (가슴 사이 ${d0})`);
        continue;
      }
      assert.ok(F, `맞춤 ${JSON.stringify(first.dup)}`);
      assert.ok(F.sMax <= d0 - UA.dupFitFloor + 0.02 && F.sMax > d0 - SECRET.mordCloseN, `한도 ${F.sMax} · 가슴 사이 ${d0} (죽음의 일격 거리 너머까지)`);
      if (S) {
        assert.ok(S.slide >= UA.dupFitMin - 1e-9 && S.slide <= F.sMax + 1e-9, `걸음 ${S.slide}`);
        assert.equal(first.dup.match, 1, '첫 걸음 박차기 물리');
        assert.ok(Math.abs(F.err) < 0.1 || S.slide >= F.sMax - 1e-3, `어긋남 ${F.err} · 걸음 ${S.slide}`);
        assert.ok(Math.abs(first.burst.Tf - Math.min(CONFIG.GAIT.burstT, Math.max(0.1, first.dup.Tstep))) < 1e-3, `앞발 ${first.burst.Tf} · 몸 ${first.dup.Tstep} (박찬 걸음 · 짧으면 몸이 설 때)`);
      } else assert.equal(F.s, 0, '짧으면 걸음 없음');
    } finally {
      B.free();
    }
  }
});
