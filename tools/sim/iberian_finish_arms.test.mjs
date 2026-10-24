// 이베리아 마무리 공격 팔 관절 시험 (10/24 13:2x 사장님 '이베리아 마무리 공격도 팔 관절이 이상하게 꺾이지 않는지 확인해봐' — docs/strike/iberian_finish_arms_2026-10-24.md)
//  싱지르 마무리(받아 멈춤 · 따라 지나감 · 굳음)의 팔이 사람 범위 안인지 지킨다 — 칼 든 쪽 · 반대 쪽 한 판씩 (츠바이핸더 · 서 있는 과녁)
//  node --test tools/sim/iberian_finish_arms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spinRun, armSample, RANGE } from './iberian_finish_arms.mjs';
import { newRound } from './harness_m.mjs';

test('잣대: 선 자세 팔 — 과신전 · 경첩 밖 · 손목 범위 안 (재는 식이 맞나)', () => {
  const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 6, walls: false });
  G.ai.update = () => G.enemy.move.set(0, 0);
  for (let i = 0; i < 240; i++) G.step();
  const s = armSample(G.player);
  assert.ok(s.elbow > 0 && s.elbow < 145, `팔꿈치 ${s.elbow}`);
  assert.ok(Math.abs(s.elbowOff) < 2, `경첩 밖 ${s.elbowOff}`);
  assert.ok(s.wrist > 0 && s.wrist < 120, `아래팔-칼 ${s.wrist}`);
  assert.ok(s.roll >= 0 && s.roll <= RANGE.roll[1], `굴림 ${s.roll}`);
  assert.ok(s.gripping && s.gripGap < 0.1, `두 손 ${s.gripGap}`);
  G.world.free();
});

for (const dir of [0, -1]) {
  test(`싱지르 마무리 팔 (${dir ? '반대 쪽' : '칼 든 쪽'}): 과신전 · 경첩 옆 꺾임 · 손 엇갈림 없음 · 손목 100° 아래 · 두 손 0.2 m 안`, () => {
    const trace = [];
    const { fired } = spinRun({ weapon: 'zweihander', start: 'langort', dir, target: 'stand', trace });
    assert.ok(fired, '싱지르가 나감');
    const end = trace.filter((x) => x.ph === 'settle' || x.ph === 'follow' || x.ph === 'stiff');
    assert.ok(end.length > 100, `마무리 스텝 ${end.length}`);
    const mn = (k) => Math.min(...end.map((x) => x[k]).filter(Number.isFinite));
    const mx = (k) => Math.max(...end.map((x) => x[k]).filter(Number.isFinite));
    assert.ok(mn('elbow') > -5, `칼 팔꿈치 과신전 ${mn('elbow')}`);
    assert.ok(mn('elbowO') > -5, `빈팔 팔꿈치 과신전 ${mn('elbowO')}`);
    assert.ok(Math.max(mx('elbowOff'), -mn('elbowOff'), mx('elbowOffO'), -mn('elbowOffO')) < 5, '팔꿈치 경첩 옆 꺾임');
    assert.ok(mx('wrist') < 100, `아래팔-칼 ${mx('wrist')}`);
    assert.ok(mx('roll') <= RANGE.roll[1], `굴림 ${mx('roll')}`);
    assert.ok(mx('shPlane') <= RANGE.shPlane[1], `어깨 수평 모음 ${mx('shPlane')}`);
    assert.ok(Math.max(...end.filter((x) => x.gripping).map((x) => x.gripGap)) < 0.2, '두 손 떨어짐');
    assert.equal(end.filter((x) => x.cross).length, 0, '두 손 엇갈림');
  });
}
