// 격살 풀기 시험 (11/15–16 사장님 '격살은 … 무한으로 쓸 수 있게 풀어 … 쿨타임' · '기본 빠르기를 35로 하고 쿨타임 3초, 기본 빠르기를 50으로 하고 쿨타임 6초' ·
//  'b안은 격살 겹당 +5%로 해' — config SECRET.gkFree · 기록 docs/strike/cn_gk_2026-11-16.md): 기본 끔 · 끄면 판 바이트 같음 · 풀면 동방만 끝없음 ·
//  칼끝 빠르기 몫 = 기본 + 겹 × 더함(더함 — 지금 판은 곱) · 식힘(몸이 자유로운 때부터) · AI 마음은 판 시간 대신 겹. 시간 상한 기준은 없다.  node --test tools/sim/cn_gk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { secretUsesOf, secretSpent, gkCooling, gkCoolFrom } from '../../src/secret.js';
import { gyeoksalComboOpt } from '../../src/skill.js';
import { cnMeet, cnWill } from '../../src/ai_plan_cn.js';

const S = CONFIG.SECRET;
function withGk(v, fn) {
  const keep = { ...S.gkFree };
  if (v) Object.assign(S.gkFree, { on: 1, ...S.gkFreeSets[v] });
  else S.gkFree.on = 0; // 0 = 전 판 (11/16 사장님 결정으로 기본이 A 켬이 되어 끈 판은 따로 부름)
  try {
    return fn();
  } finally {
    Object.assign(S.gkFree, keep);
  }
}
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
function trace(seed = 2, secs = 12) {
  const G = newRound({ walls: true, seed, weapon: 'hwando', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const out = [];
  let i = 0;
  while (G.t < secs) {
    G.step();
    if (++i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.pelvis.translation(); out.push(`${p.x.toFixed(6)},${p.z.toFixed(6)},${f.blood.toFixed(6)}`); }
  }
  G.world.free();
  return out.join(';');
}

test('기본 안 A 켬 [사장님 11/16 결정 \'A안으로 해\'] · 안 A · B 값 · 끄면 값을 바꿔도 판이 바이트 같음', () => {
  assert.equal(S.gkFree.on, 1, '[사장님 11/16 결정] A 켬 (전 기본 끔)');
  near(S.gkFree.share, 0.35); near(S.gkFree.add, 0.1); near(S.gkFree.cool, CONFIG.realS(3.0)); // 11/16 add 0.10
  const A = S.gkFreeSets.A, B = S.gkFreeSets.B;
  near(A.share, 0.35); near(A.add, 0.1); near(A.cool, CONFIG.realS(3.0)); // add 0.10 [사장님 11/16 결정 '스탯 하나당 추가 합산은 +10%로' — 전 0.08]
  near(B.share, 0.5); near(B.add, 0.05); near(B.cool, CONFIG.realS(6.0));
  near(A.share + 5 * A.add, 0.85); near(B.share + 5 * B.add, 0.75); // A 겹 5 = 0.85 (11/16 — 전 0.75)
  withGk(0, () => {
    const a = trace();
    Object.assign(S.gkFree, { share: 0.9, add: 0.3, cool: 0 });
    assert.equal(trace(), a);
  });
});

test('풀면 동방 격살만 끝없음 (사람 · AI 같은 표) · 다른 유파는 그대로', () => {
  const cn = { swordArt: { tradition: 'chinese' }, secretUsed: 3 };
  const de = { swordArt: { tradition: 'german' }, secretUsed: 1 };
  withGk(0, () => {
    assert.equal(secretUsesOf(cn), CONFIG.UNIQUE_ASSIST.secretUses.chinese);
    assert.equal(secretSpent(cn), true);
  });
  withGk('A', () => {
    assert.equal(secretUsesOf(cn), Infinity);
    assert.equal(secretSpent(cn), false);
    assert.equal(secretSpent(de), true, '독일은 그대로');
  });
});

test('칼끝 빠르기 몫: 풀면 기본 + 겹 × 더함 (A 0.35 + 0.10 [사장님 11/16 — 전 0.08] · B 0.50 + 0.05 · 겹 5 = A 0.85 · B 0.75) · 지금 판은 0.7 × (1 + 0.08 × 겹) 곱 · 쌓는 몸이 아니면 겹 없음', () => {
  const D = { power: 'gyeoksal' };
  const f = (n) => ({ swordArt: { tradition: 'chinese' }, aiControlled: true, foe: { cnHunt: { n } } });
  withGk(0, () => near(gyeoksalComboOpt(D, f(3), []).share, 0.7 * (1 + 0.08 * 3), 1e-9));
  withGk('A', () => {
    near(gyeoksalComboOpt(D, f(0), []).share, 0.35);
    near(gyeoksalComboOpt(D, f(3), []).share, 0.65); // 0.35 + 0.10 × 3 (11/16 — 전 0.59)
    near(gyeoksalComboOpt(D, f(5), []).share, 0.85); // 겹 5 (11/16 — 전 0.75)
  });
  withGk('B', () => {
    near(gyeoksalComboOpt(D, f(0), []).share, 0.5);
    near(gyeoksalComboOpt(D, f(5), []).share, 0.75);
    near(gyeoksalComboOpt(D, { ...f(5), swordArt: { tradition: 'german' } }, []).share, 0.5, 1e-9);
  });
});

test('식힘: 몸이 자유로운 때부터 cool 동안 · 끄면 없음 · AI 는 식히는 동안 나서며 받지 않음 · 마음은 판 시간 대신 겹', () => {
  const f = { fightT: 10 };
  withGk(0, () => {
    gkCoolFrom(f);
    assert.equal(gkCooling(f), false, '끔이면 식힘 없음');
  });
  withGk('B', () => {
    gkCoolFrom(f);
    assert.equal(gkCooling(f), true);
    f.fightT += S.gkFree.cool - 0.01;
    assert.equal(gkCooling(f), true);
    f.fightT += 0.02;
    assert.equal(gkCooling(f), false, '6 s 뒤');
  });
  const G = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'hwando', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    assert.equal(ai.secret?.when, 'gyeoksal');
    withGk('A', () => {
      ai.me.secretUsed = 4;
      ai.me.fightT = 20;
      ai.me.gkCoolUntil = 25;
      const th = { id: 9001, line: 'highL', thrust: false };
      assert.equal(cnMeet(ai, th), false, '식히는 중');
      // 마음: 판 시간이 길어도 겹 0 이면 바닥 (아껴 두기 몫 없음) · 겹이 많을수록 큼
      G.player.cnHunt = { n: 0 };
      const w0 = cnWill(ai, null);
      G.player.cnHunt = { n: 3 };
      const w3 = cnWill(ai, null);
      assert.ok(w3 > w0, `${w0} < ${w3}`);
    });
    G.player.cnHunt = { n: 0 };
    ai.me.fightT = 20;
    const old0 = withGk(0, () => cnWill(ai, null));
    withGk('A', () => assert.ok(cnWill(ai, null) < old0, '지금 판은 판 시간이 마음을 키움 · 풀면 안 키움'));
  } finally {
    G.world.free();
  }
});

test("사냥 겹 사라짐 [사장님 11/16 결정 '기력 회복 -10%' · '8초로 하자']: 겹마다 쌓인 때부터 8.0 s 뒤 제 시계로 사라짐 · 상한에서 자리가 비면 다시 쌓임 · life 0 = 전 판(안 빠짐) · 격살 몫도 같이 줄어듦", async () => {
  const { huntHit, huntN, huntRegenK } = await import('../../src/cn_hunt.js');
  const C = CONFIG.UNIQUE_ASSIST.cnHunt;
  near(C.life, CONFIG.realS(8.0));
  near(C.regen, 0.1); // 기력 회복 −10 %/겹 (11/16 — 전 0.08)
  let id = 0;
  const att = { swordArt: { tradition: 'chinese' }, aiControlled: true, stamina: { attackId: 0 } };
  const vic = { fightT: 0 };
  att.foe = vic;
  const hit = () => { att.stamina.attackId = ++id; return huntHit(att, vic); };
  assert.equal(hit(), true);
  vic.fightT = 2;
  hit();
  assert.equal(huntN(vic), 2);
  vic.fightT = C.life - 0.01;
  assert.equal(huntN(vic), 2);
  vic.fightT = C.life + 0.01;
  assert.equal(huntN(vic), 1, '첫 겹이 8 s 지나 사라짐');
  near(huntRegenK(vic), 1 - C.regen);
  vic.fightT = C.life + 2.01;
  assert.equal(huntN(vic), 0, '둘째도');
  for (let k = 0; k < 7; k++) hit();
  assert.equal(huntN(vic), C.max, '상한');
  vic.fightT += C.life + 0.01;
  assert.equal(huntN(vic), 0);
  withGk('A', () => near(gyeoksalComboOpt({ power: 'gyeoksal' }, att, []).share, S.gkFree.share, 1e-9));
  const keep = C.life;
  C.life = 0;
  try {
    const v2 = { fightT: 0 };
    att.foe = v2;
    att.stamina.attackId = ++id;
    huntHit(att, v2);
    v2.fightT = 100;
    assert.equal(huntN(v2), 1, 'life 0 — 안 빠짐');
  } finally {
    C.life = keep;
  }
});
