// 이베리아 막아 내면 기력 되찾음 시험 (11/15 사장님 '이베리아도 막기 20% 감소 없애. 대신 막기에 성공하면 기력 n 회복 어때.' · src/ib_block_regen.js ·
//  config SKILL.ibBlockRegen · ibBlockRegenN · 스킬트리 B9 몫 열쇠 blockRegen · 기록 docs/strike/cn_block_2026-11-15.md §5): 기본 켬 · n = 내 무기 베기 한 번 값(기본 · 11/15) · 고정 30(전 판) · 상대 베기 × 2 · 한도 ·
//  그 공격이 칼날 상처 없이 끝나야 · 사람은 B9 · AI 는 늘 · 다른 유파 없음 · 끄면 없음 · 판에서 실제로 쓰임. 시간 상한 기준은 없다.  node --test tools/sim/ib_block_regen.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { ibBlockOn, ibBlockMark, ibBlockHit, ibBlockTick, regenN } from '../../src/ib_block_regen.js';
import { kitFromNodes } from '../../src/skill_tree_data.js';

const { SKILL, STAMINA } = CONFIG;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const body = (tradition = 'iberian', o = {}) => ({ alive: true, swordArt: { tradition }, stamina: { value: 50, max: 100, weight: 1.34, counts: {}, exhausted: false, infinite: false }, ...o });
const foe = (id = 3, time = 1, until = 2, weight = 1.34) => ({ stamina: { attackId: id, time, attackUntil: until, weight } });

test('값 · 켬: 이베리아 막는 동안 피해 감소 0(11/15) · 막아 내면 되찾음 기본 켬 · 이베리아만 · 사람은 B9 · 끄면 없음', () => {
  assert.equal(SKILL.ibParryDmgCut, 0, '[사장님 11/15 결정] 20 % 없앰');
  assert.equal(SKILL.ibBlockRegen, 1);
  assert.equal(ibBlockOn(body('iberian')), true, 'AI(몫 열쇠 없음)는 늘');
  for (const t of ['german', 'japanese', 'chinese', 'italian', 'none']) assert.equal(ibBlockOn(body(t)), false, t);
  assert.equal(ibBlockOn(body('iberian', { schoolParry: false })), false, '막기 책 없음');
  assert.equal(ibBlockOn(body('iberian', { skillKit: kitFromNodes('iberian', new Set(['B1', 'B8'])) })), false, 'B9 안 익힘');
  assert.equal(ibBlockOn(body('iberian', { skillKit: kitFromNodes('iberian', new Set(['B1', 'B8', 'B9'])) })), true, 'B9');
  SKILL.ibBlockRegen = 0;
  try { assert.equal(ibBlockOn(body('iberian')), false); } finally { SKILL.ibBlockRegen = 1; }
});

test('셈: 막아 받은 공격이 칼날 상처 없이 끝나면 n(내 무기 베기 한 번 값 · 전 판 고정 30 · 상대 베기 × 2) · 한도 · 그 공격 칼날 상처면 없음 · 둔타 · 다른 공격 상처는 셈 안 함', () => {
  const f = body();
  const a = foe(3, 1, 2);
  ibBlockMark(f, a, 3);
  ibBlockTick(f);
  assert.equal(f.stamina.value, 50, '아직 그 공격');
  a.stamina.time = 2.5; // 공격 시간 지남
  ibBlockTick(f);
  near(f.stamina.value, 50 + STAMINA.cutCost * 1.34, 1e-9); // 내 무기 베기 한 번 값 (몸 무게 배율 1.34)
  assert.equal(SKILL.ibBlockRegenN, 'cut', '[사장님 11/15 결정] 무기 베기 한 번 값 (전 고정 30)');
  near(regenN(foe(1, 1, 2, 1.0), body('iberian', { stamina: { weight: 1.0 } })), STAMINA.cutCost, 1e-9); // 롱소드 몸 12 — 상대 무기와 상관없음
  SKILL.ibBlockRegenN = 'fixed';
  try {
    assert.equal(regenN(foe(), body()), SKILL.ibBlockRegenFixed);
    assert.equal(SKILL.ibBlockRegenFixed, 30, '전 판 고정 30');
    SKILL.ibBlockRegenN = 'foe2';
    near(regenN(foe(1, 1, 2, 1)), STAMINA.cutCost * 2, 1e-9); // 롱소드 24
    near(regenN(foe(1, 1, 2, 1.34)), STAMINA.cutCost * 1.34 * 2, 1e-9);
  } finally {
    SKILL.ibBlockRegenN = 'cut';
  }
  assert.equal(f.stamina.counts.blockRegen, 1);
  f.stamina.value = 95; // 한도
  ibBlockMark(f, a, 4);
  a.stamina.attackId = 5; // 공격 번호가 바뀜 = 끝
  ibBlockTick(f);
  assert.equal(f.stamina.value, 100);
  // 그 공격의 칼날 상처 → 없음 · 둔타는 셈 안 함
  const g = body();
  const b = foe(7, 1, 2);
  ibBlockMark(g, b, 7);
  ibBlockHit(g, b, { type: 'blunt', severity: 0 });
  ibBlockHit(g, b, { type: 'cut', severity: 0.2 });
  b.stamina.time = 3;
  ibBlockTick(g);
  assert.equal(g.stamina.value, 50, '뚫림');
  // 탈진 중 · 기력 무한은 없음
  const h = body('iberian', { stamina: { value: 10, max: 100, weight: 1, counts: {}, exhausted: true } });
  const c = foe(1, 1, 2);
  ibBlockMark(h, c, 1);
  c.stamina.time = 3;
  ibBlockTick(h);
  assert.equal(h.stamina.value, 10);
});

test('판에서 쓰임 — 츠바이핸더 AI 숙련 5 대 롱소드 AI (씨앗 1 ~ 4 · 30 s): 막아 내 되찾은 기력이 있음 · 끄면 0', () => {
  const run = (on) => {
    const keep = SKILL.ibBlockRegen;
    SKILL.ibBlockRegen = on;
    let n = 0, sum = 0;
    try {
      for (const seed of [1, 2, 3, 4]) {
        const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'zweihander', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
        while (G.t < 30 && G.player.alive && G.enemy.alive) G.step();
        n += G.enemy.stamina.counts.blockRegen ?? 0;
        sum += G.enemy.stamina.blockRegenSum ?? 0;
        G.world.free();
      }
    } finally {
      SKILL.ibBlockRegen = keep;
    }
    return { n, sum };
  };
  const on = run(1);
  assert.ok(on.n > 0 && on.sum > 0, JSON.stringify(on));
  assert.ok(on.sum <= on.n * SKILL.ibBlockRegenFixed + 1e-9, '한 번에 n 안');
  assert.deepEqual(run(0), { n: 0, sum: 0 });
});
