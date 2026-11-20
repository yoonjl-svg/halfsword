// 자연 바인드 본판 시험 (사장님 10/31 19:xx '바인드 실험 본판에 적용해. 단 튕김은 0.1이 아니라 0.2로 해. ai가 밀지의 여부는 기본적으로 키되 성향에 따라 그 정도가 조절되면 좋겠네.'
//  — docs/strike/natural_bind_on_2026-10-31.md · 확인표 3310 ~ 3319)
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const { BIND, realS } = CONFIG;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
// AI 굴림 씨앗 (11/20 — ai_run.test.mjs 와 같은 꼴): newMatch 의 seed 는 무기 파손 굴림(breakSeed)만 — AI 생성자 · 판단 굴림은 전역 Math.random 이라
//  판마다 시험이 씨앗을 둔다 (fights12 · many_fighters.test.mjs 와 같은 굴림 · 같은 씨앗이면 늘 같은 싸움). 시험이 끝나면 원래 Math.random 으로 되돌림
const realRandom = Math.random;
const seedRand = (t, seed) => {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  t.after(() => { Math.random = realRandom; });
};

test('기본값: 반발 0.2(사장님) · 마찰 1.2 · 밀기 0.2 m/s · 상한 실제 1.5 s · 성향 셈 켬 [0.5, 1.5]', () => {
  assert.equal(BIND.restitution, 0.2);
  assert.equal(BIND.friction, 1.2);
  assert.equal(BIND.pressSpeed, 0.2);
  near(BIND.holdMax, realS(1.5));
  assert.deepEqual(BIND.will, { aggr0: 0.9, aggrK: 1.5, vor0: 0.4, vorK: 0.5, emoK: 0.5, lo: 0.5, hi: 1.5 });
});

test('미는 뜻 w (pressWill): 가운데 1 · 공격 성향 · 맞받기 성향 · 분노 · 집념은 올리고 공포는 내림 · [lo, hi] 로 자름', () => {
  const G = newRound({ walls: true, seed: 1 });
  const A = G.ai;
  const set = (aggr, lv, vor, anger = 0, obs = 0, fear = 0) => {
    A.pers.aggr = aggr;
    A.level = { ...A.level, aggression: lv };
    A.pers.vor = vor;
    A.anger = anger;
    A.obsession = obs;
    A.fear = fear;
    return A.pressWill();
  };
  near(set(1, 0.9, 0.4), 1); // aggr × aggression = aggr0 · vor = vor0
  assert.ok(set(1.2, 1.0, 0.4) > set(1, 0.9, 0.4) && set(0.85, 0.6, 0.4) < 1, '공격 성향');
  assert.ok(set(1, 0.9, 0.6) > 1 && set(1, 0.9, 0.15) < 1, '맞받기 성향');
  near(set(1, 0.9, 0.4, 0.5), 1.25);
  near(set(1, 0.9, 0.4, 0, 0.5), 1.25);
  near(set(1, 0.9, 0.4, 0, 0, 0.5), 0.75);
  assert.equal(set(1.3, 1.0, 0.8, 1, 1), BIND.will.hi); // 위 끝
  assert.equal(set(0.85, 0.6, 0.15, 0, 0, 1), BIND.will.lo); // 아래 끝
  G.world.free();
});

test('칼 면 (combat.js armSteel): 떨어져 있으면 반발 min(제 값, 0.2) · 제 마찰 / 맞닿은 동안 반발 0 · 마찰 1.2 — 덩굴 채찍 마디는 제 값(0.08 · 0.65) 그대로', () => {
  const look = (G, f) => f.swordColliders.map((c) => [+c.restitution().toFixed(3), +c.friction().toFixed(3)]);
  for (const weapon of ['longsword', 'druid_whip']) {
    const G = newRound({ walls: true, seed: 3, weapon, weapon2: 'longsword' });
    G.step();
    const C = G.combat;
    const base = weapon === 'druid_whip' ? (i) => (i >= 2 ? [0.08, 0.65] : [0.35, 0.4]) : () => [0.7, 0.4];
    const apart = () => look(G, G.player).forEach(([e, mu], i) => { const [e0, mu0] = base(i); near(e, Math.min(e0, BIND.restitution), 1e-6); near(mu, mu0, 1e-6); });
    apart();
    C.bladeLast = C.stepNo; // 칼끼리 맞닿음 (이번 스텝)
    for (const f of C.fighters) C.bladeLastOf.set(f, C.stepNo); // 동시 대전 병합: 실제 칼 접촉은 싸움꾼마다 시각을 적는다(combat.js clashGroup)
    C.armSteel();
    look(G, G.player).forEach(([e, mu], i) => { near(e, 0); near(mu, BIND.friction, 1e-6); });
    C.stepNo += CONFIG.STEEL.rearmSteps + 1; // 떨어진 지 rearmSteps 넘음
    C.armSteel();
    apart();
    G.world.free();
  }
});

test('2:2 자연 바인드: 맞닿은 두 칼만 반발을 끄고, 나머지 두 칼의 재질은 유지한다', async (t) => {
  const { newMatch } = await import('./jelly_harness.mjs');
  seedRand(t, 3);
  const G = newMatch({ count: 4, seed: 3 });
  try {
    const C = G.combat;
    const base = G.fighters.map((f) => f.swordColliders.map((c) => ({ e: c.restitution(), mu: c.friction() })));
    C.armSteel();
    C.bladeLast = C.stepNo;
    for (const f of G.fighters.slice(0, 2)) C.bladeLastOf.set(f, C.stepNo);
    C.armSteel();
    G.fighters.forEach((f, i) => f.swordColliders.forEach((c, j) => {
      near(c.restitution(), i < 2 ? 0 : Math.min(base[i][j].e, BIND.restitution), 1e-6);
      near(c.friction(), i < 2 ? BIND.friction : base[i][j].mu, 1e-6);
    }));
    C.stepNo += CONFIG.STEEL.rearmSteps + 1;
    C.armSteel();
    G.fighters.forEach((f, i) => f.swordColliders.forEach((c, j) => {
      near(c.restitution(), Math.min(base[i][j].e, BIND.restitution), 1e-6);
      near(c.friction(), base[i][j].mu, 1e-6);
    }));
  } finally { G.world.free(); }
});

test('밀기 칸 natP 는 모르트슐라크 누르기 셈(this.press)과 따로 (10/31 고침 — 10/11 판은 같은 칸을 써 10/24 뒤로 켜면 mordTick 이 비기 없는 AI 에서 멈춤)', () => {
  // 비기 없는 AI 둘 (숙련 2): 칼이 막혀 밀어도 press 칸은 그대로 null · 밀기는 natP
  // 유파 마음가짐 (11/19 — 숙련 2 는 마음가짐 몫 0 · 3 점 바탕): 씨앗 1 은 25 s 안에 칼이 붙은 공격이 없음 — 밀기가 나온 판까지 씨앗을 넘김 (판에서 쓰이는지만 봄)
  let pressed = 0;
  for (const seed of [1, 2, 3, 4]) {
    const G = newRound({ walls: true, seed, AI2Class: AI });
    for (let i = 0; i < 25 / DT; i++) {
      G.step();
      for (const A of [G.ai, G.ai2]) {
        assert.equal(A.press, null);
        if (A.natP) pressed++;
      }
    }
    G.world.free();
    if (pressed > 0) break;
  }
  assert.ok(pressed > 0, '밀기가 한 번은 있어야 함');
  // 모르트슐라크 AI (아르토리아 — 숙련 6 · 독일): press 는 누르기 셈 꼴 그대로(tech 칸 없음)
  const H = CHARACTERS_BY_ID.artoria;
  const G2 = newRound({ walls: true, seed: 2, weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, revive: H.revive, AI2Class: AI });
  assert.equal(G2.ai.secret?.when, 'press');
  for (let i = 0; i < 25 / DT; i++) {
    G2.step();
    const P = G2.ai.press;
    if (P) assert.ok('win' in P && !('tech' in P), JSON.stringify(P));
  }
  G2.world.free();
});
