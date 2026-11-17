// 걸음 사다리 — follow 안 pass → lunge + 끌어붙임 걸음 길이 (10/29 18:5x 사장님 '네 제안대로' — docs/strike/step_ladder_2026-10-29.md §11)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAIT } from '../../src/config.js';
import { passAsFwd } from '../../src/gait.js';

const pa = { kind: 'lunge', fwdK: 0.85, draw: true };

test('passAs: 사다리 한 칸 아래 · 맨 아래 칸 이하는 그대로', () => {
  const cases = [[0.9, 0.6], [0.6, 0.45], [0.45, 0.3], [0.3, 0.3], [0.5, 0.3], [0.7, 0.45], [1.2, 0.6], [0.15, 0.15], [0, 0], [-0.3, -0.3]];
  for (const [x, want] of cases) assert.equal(passAsFwd(x, pa), want, `${x}`);
});

test('passAs: rung false 면 그 유파만 옛 꼴', () => {
  assert.equal(passAsFwd(0.6, { ...pa, rung: false, fwdK: 1 }), 0.6);
});
