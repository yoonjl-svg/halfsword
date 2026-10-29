// AI 특수 공격 식힘 시험 (사장님 10/29 19:4x 'AI의 모든 쿨타임은 사람과 맞춰.' · 19:5x 특수공격 3초 · 끝난 때부터 — ai.js specCooling · techNow · specStart · specTick · 감독 해석 · 사장님 확인 중):
//   AI 몫 = 제비 베기 길 · 되받아 치기 패시브(kaeshi — 제비 베기) / 칼끝 돌려 빼기 속임 · 빼서 찌르기 패시브(cavazione) / 날개 접기 속임 / 겹치기 길 · 겹치기 패시브 / 머리 위 돌려 베기 강화동작(왼 가로베기 자리)
//   식는 동안: 고르지 않음(강화동작은 바탕 왼 가로베기로) · 패시브 · 속임 없음 · 나간 공격이 끝날 때까지 식힘 중 → 끝난 때부터 3 s.  node --test tools/sim/ai_special_cooldown.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const UA = CONFIG.UNIQUE_ASSIST;

function aiOf(id, seed = 1, gap = undefined) {
  const H = CHARACTERS_BY_ID[id];
  const G = newRound({ seed, gap, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona });
  for (let i = 0; i < 3; i++) G.step();
  return { G, ai: G.ai };
}

test('강화동작(머리 위 돌려 베기): 식는 동안 그 자리는 바탕 왼 가로베기 · 다 식으면 다시 돌려 베기', () => {
  const { G, ai } = aiOf('roland');
  try {
    const rd = ai.school.techByName.redondo;
    assert.ok(rd && rd.plain?.name === 'zwerchL', '강화동작에 바탕 동작');
    assert.equal(ai.techNow(rd), rd);
    ai.specCool.redondo = ai.sense.t;
    assert.equal(ai.techNow(rd).name, 'zwerchL');
    const s = ai.sense.seen(0);
    for (let k = 0; k < 200; k++) assert.notEqual(ai.pickTech(s, 'patience')?.name, 'redondo');
    ai.specCool.redondo = ai.sense.t - UA.specialCooldown - 1e-6;
    assert.equal(ai.techNow(rd), rd, '다 식음');
  } finally {
    G.world.free();
  }
});

test('패시브(겹치기 · 되받아 치기 · 빼서 찌르기)는 식는 동안 없음 — 다른 패시브는 그대로', () => {
  for (const [id, key, name] of [['margarethe', 'parried', 'duplieren'], ['minami', 'bindDef', 'kaeshi'], ['eira', 'parried', 'cavazione']]) {
    const { G, ai } = aiOf(id);
    try {
      const P0 = ai.passiveFor(key);
      if (P0?.name !== name) continue; // 그 인물 꾸러미에 그 패시브가 먼저 오지 않으면 건너뜀 (숙련도 거르기)
      const sp = name === 'kaeshi' ? 'tsubameGaeshi' : name;
      ai.specCool[sp] = ai.sense.t;
      assert.notEqual(ai.passiveFor(key)?.name, name, `${id} ${name} 식는 동안`);
    } finally {
      G.world.free();
    }
  }
});

test('속임(날개 접기): 식는 동안 고르지 않음', () => {
  const { G, ai } = aiOf('liao');
  try {
    const f = ai.school.feints.find((x) => x.name === '날개 접기 (염시)');
    assert.ok(f, '염시 속임');
    ai.specCool.lianchi = ai.sense.t;
    const r = Math.random;
    Math.random = () => 0;
    try {
      for (let k = 0; k < 20; k++) {
        ai.mode = 'watch';
        ai.me.handOffset.set(ai.school.techByName[f.fake].from[0], ai.school.techByName[f.fake].from[1]);
        ai.startAttack(ai.school.techByName.zornhau, 'patience');
        assert.notEqual(ai.feint?.name, f.name);
      }
    } finally {
      Math.random = r;
    }
  } finally {
    G.world.free();
  }
});

test('나간 공격이 끝날 때까지 식힘 중 · 끝난 때부터 셈 (겹치기 길 — 서 있는 상대)', () => {
  const { G, ai } = aiOf('artoria', 1, 1.6);
  try {
    const t = ai.school.techByName.duplieren;
    assert.ok(t);
    while (G.enemy.openHold) G.step(); // 판 시작 정지 뒤 (AI 가 공격을 시작하는 때)
    let tries = 0;
    for (let i = 0; i < Math.round(6 / DT) && !ai.stats.specRuns?.length; i++) {
      if (tries < 20 && ai.mode !== 'attack' && ai.mode !== 'secret' && ai.startAttack(t, 'patience', { noFeint: true })) tries++;
      G.step();
      if (ai.specRun) assert.equal(ai.specCool.duplieren, Infinity, '도는 동안');
    }
    const run = ai.stats.specRuns?.[0];
    assert.ok(run?.name === 'duplieren', '겹치기가 나가고 끝남');
    assert.ok(run.free >= run.motion && Number.isFinite(ai.specCool.duplieren));
    assert.ok(ai.specCooling('duplieren'));
  } finally {
    G.world.free();
  }
});
