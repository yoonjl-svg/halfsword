// 이탈리아 물러서기 걸음 수 한도 (10/31 08:xx 사장님 결정 '다른 모든 유파는 물러설 때 70%이지? 그럼 이탈리아도 네걸음 이후에는 (다섯 걸음째부터) 70% 적용')
//  ITALIAN_GAIT.backCap(steps 4 · idle 0.6 s) — gait.js backStep · backTick · update 의 'flat' 배율
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRADITIONS, setItalianBackCap } from '../../src/schools.js';
import { Gait } from '../../src/gait.js';
import { newRound, DT } from './harness_m.mjs';

test('걸음 칸: 이탈리아만 backCap 4 · idle 0.6 s(박자 걸음 멈춤 기준) · `?itBackCap=` 스위치', () => {
  const g = TRADITIONS.italian.gait;
  assert.equal(g.backMul, 'flat');
  assert.deepEqual(g.backCap, { steps: 4, idle: 0.6 });
  assert.equal(g.backCap.idle, g.rhythm.idle);
  for (const t of Object.keys(TRADITIONS)) if (t !== 'italian') assert.equal(TRADITIONS[t].gait?.backCap, undefined, t);
  const keep = g.backCap;
  try {
    assert.equal(setItalianBackCap('0'), true);
    assert.equal(g.backCap, undefined);
    assert.equal(setItalianBackCap('6'), true);
    assert.equal(g.backCap.steps, 6);
    assert.equal(setItalianBackCap('x'), false);
  } finally {
    g.backCap = keep;
  }
});

test('셈 규칙 (backStep): 뒤 디딤 +1 · 앞 디딤 · 옆 몫이 큰 디딤은 0 · 기술 걸음 · 자세 고치기 · 서 있을 때 catch 는 그대로', () => {
  const s = (o, kind) => {
    const me = { backN: 2, walking: true, ...o };
    Gait.prototype.backStep.call(me, kind);
    return me.backN;
  };
  assert.equal(s({ backWf: -1, backWl: 0.3 }, 'walk'), 3);
  assert.equal(s({ backWf: -1, backWl: 0.3 }, 'catch'), 3);
  assert.equal(s({ backWf: 1, backWl: 0 }, 'walk'), 0); // 앞
  assert.equal(s({ backWf: -0.3, backWl: 0.5 }, 'walk'), 0); // 옆 몫이 큼
  for (const k of ['req', 'draw', 'settle']) assert.equal(s({ backWf: 1, backWl: 0 }, k), 2, k);
  assert.equal(s({ backWf: 1, backWl: 0, walking: false }, 'catch'), 2);
});

// 사람 몸(I3 를 익힌 것과 같은 — 시뮬 몸은 몫이 늘 켜짐) · 상대는 20 m 밖 · 서 있다가 스틱 끝까지 뒤로 5 s
function retreat(capOff) {
  const keep = TRADITIONS.italian.gait.backCap;
  if (capOff) delete TRADITIONS.italian.gait.backCap;
  const G = newRound({ walls: false, seed: 7, weapon: 'rapier', weapon2: 'longsword', gap: 20 });
  try {
    G.ai.update = () => G.enemy.move.set(0, 0);
    const P = G.player;
    for (let i = 0; i < Math.round(2.5 / DT); i++) { P.move.set(0, 0); G.step(); }
    let sum = 0, n = 0, maxN = 0;
    const T = 5;
    for (let i = 0; i < Math.round(T / DT); i++) {
      P.move.set(0, -1);
      G.step();
      maxN = Math.max(maxN, P.gait.backN);
      if (i * DT >= T - 1.5) {
        const v = P.bodies.pelvis.linvel();
        sum += -(v.x * Math.cos(P.heading) - v.z * Math.sin(P.heading));
        n++;
      }
    }
    // 서서 0.6 s 넘게 있으면 셈이 처음부터
    for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); G.step(); }
    return { v: sum / n, maxN, after: P.gait.backN };
  } finally {
    G.world.free();
    TRADITIONS.italian.gait.backCap = keep;
  }
}

test('실제 몸: 이어 물러서면 다섯째 디딤부터 뒷걸음 × 0.7 — 꾸준한 뒷걸음이 한도 없는 판의 0.6 ~ 0.8 배 · 멈추면 셈 0', () => {
  const on = retreat(false);
  const off = retreat(true);
  assert.ok(on.maxN > 8, `셈 ${on.maxN}`);
  assert.equal(on.after, 0);
  const r = on.v / off.v;
  assert.ok(r > 0.6 && r < 0.8, `꾸준한 뒷걸음 ${on.v.toFixed(2)} / ${off.v.toFixed(2)} = ${r.toFixed(2)}`);
});
