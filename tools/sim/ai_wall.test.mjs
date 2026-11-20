// AI 울타리 몰림 띠 (11/19 사장님 'AI 울타리 피함 거리는 경기장 크기에 다시 맞춰' — config ARENA.aiWall · ai.js moveFeet · ai_mindset.js mindTick · DIG_PROTO.wall · 기록 docs/strike/lone_master_2026-11-19.md):
//  띠 = 경기장 반지름 − aiWall (10/16 경기장 √2 전 6.5 − 4.6 = 1.9 m 간격 그대로 — 전엔 4.6 m 가 박혀 넓힌 경기장의 가운데 반쪽에서도 옆으로 빠졌다)
//  node --test tools/sim/ai_wall.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG, DT } from './jelly_harness.mjs';

const { ARENA } = CONFIG;
// AI 굴림 씨앗 (11/20 — ai_run.test.mjs 와 같은 꼴): newMatch 의 seed 는 무기 파손 굴림(breakSeed)만 — AI 생성자 · 판단 굴림은 전역 Math.random 이라
//  판마다 시험이 씨앗을 둔다 (fights12 · many_fighters.test.mjs 와 같은 굴림 · 같은 씨앗이면 늘 같은 싸움). 시험이 끝나면 원래 Math.random 으로 되돌림
const realRandom = Math.random;
const seedRand = (t, seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  t.after(() => { Math.random = realRandom; });
};

test('띠 = 반지름 − 1.9 m (√2 전 6.5 − 4.6 과 같은 간격) · 파고들기 \'상대 등이 울타리 가까이\'(DIG_PROTO.wall)는 띠 − 0.6', () => {
  assert.equal(ARENA.aiWall, 1.9);
  assert.ok(Math.abs(ARENA.radius - ARENA.aiWall - (6.5 * Math.SQRT2 - (6.5 - 4.6))) < 1e-12);
  assert.ok(ARENA.radius - ARENA.aiWall > 7.2);
  assert.ok(Math.abs(CONFIG.DIG_PROTO.wall - (ARENA.radius - ARENA.aiWall - 0.6)) < 1e-12, '전 4.0 (= 옛 4.6 − 0.6)');
});

/** 1:1 AI 판을 가운데에서 gap / 2 떨어진 자리로 세워 판 시작 정지 뒤 간 보기 스틱 옆 몫을 봄 */
function sideAt(t, gap) {
  seedRand(t, 1);
  const G = newMatch({ seed: 1, ai: 'all', gap, walls: true });
  const f = G.fighters[1];
  const side = [];
  for (let i = 0; i < 2.6 / DT; i++) {
    G.step();
    if (G.t > ARENA.startHold + 0.05 && f.aiCtl.mode === 'watch') side.push(Math.abs(f.stickX));
  }
  G.world.free();
  return Math.max(...side);
}

test('넓힌 경기장의 가운데 쪽(반지름 6 m)에서는 울타리로 옆으로 빠지지 않음 · 띠 안(8 m)에서는 빠짐', (t) => {
  assert.ok(sideAt(t, 12) < 0.5, '6 m — 띠 밖 (전 4.6 m 판은 여기서 옆 끝 1)');
  assert.ok(sideAt(t, 16) > 0.5, '8 m — 띠 안');
});
