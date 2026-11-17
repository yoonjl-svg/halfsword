// 격살 풀기 시험 (11/15–16 사장님 '격살은 … 무한으로 쓸 수 있게 풀어 … 쿨타임' · '기본 빠르기를 35로 하고 쿨타임 3초, 기본 빠르기를 50으로 하고 쿨타임 6초' ·
//  'b안은 격살 겹당 +5%로 해' — config SECRET.gkFree · 기록 docs/strike/cn_gk_2026-11-16.md): 11/17 풀기 판만(스위치 지움) · 동방만 끝없음 ·
//  칼끝 빠르기 몫 = 기본 + 겹 × 더함(더함 — 지금 판은 곱) · 식힘(몸이 자유로운 때부터) · AI 마음은 판 시간 대신 겹. 시간 상한 기준은 없다.  node --test tools/sim/cn_gk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { secretUsesOf, secretSpent, gkCooling, gkCoolFrom } from '../../src/secret.js';
import { gyeoksalComboOpt } from '../../src/skill.js';
import { cnMeet, cnWill } from '../../src/ai_plan_cn.js';

const S = CONFIG.SECRET;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
test('기본 값 [사장님 11/16 결정 \'A안으로 해\']: 빠르기 0.40 · 겹당 0.10 · 식힘 3.0 s', () => {
  near(S.gkFree.share, 0.4); near(S.gkFree.add, 0.1); // share 0.40 [사장님 11/16 '격살과 모르트슐라크도 40%로' — 전 0.35] · add 0.10 [사장님 11/16 결정 '스탯 하나당 추가 합산은 +10%로' — 전 0.08]
  near(S.gkFree.cool, CONFIG.realS(3.0));
  near(S.gkFree.share + 5 * S.gkFree.add, 0.9); // 겹 5
});

test('칼끝 빠르기 몫: 기본 + 겹 × 더함 (0.40 + 0.10 × 겹 · 겹 5 = 0.90)', () => {
  const D = { power: 'gyeoksal' };
  const f = (n) => ({ swordArt: { tradition: 'chinese' }, aiControlled: true, foe: { cnHunt: { n } } });
  near(gyeoksalComboOpt(D, f(0), []).share, 0.4); // 11/16 '격살과 모르트슐라크도 40%로' (전 0.35)
  near(gyeoksalComboOpt(D, f(3), []).share, 0.7); // 0.40 + 0.10 × 3
  near(gyeoksalComboOpt(D, f(5), []).share, 0.9); // 겹 5
});

test('식힘: 몸이 자유로운 때부터 cool 동안 · AI 는 식히는 동안 나서며 받지 않음 · 마음은 판 시간 대신 겹', () => {
  const f = { fightT: 10 };
  gkCoolFrom(f);
  assert.equal(gkCooling(f), true);
  f.fightT += S.gkFree.cool - 0.01;
  assert.equal(gkCooling(f), true);
  f.fightT += 0.02;
  assert.equal(gkCooling(f), false, 'cool 뒤');
  const G = newRound({ walls: true, seed: 1, weapon: 'longsword', weapon2: 'hwando', AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  try {
    const ai = G.ai;
    assert.equal(ai.secret?.when, 'gyeoksal');
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
  near(gyeoksalComboOpt({ power: 'gyeoksal' }, att, []).share, S.gkFree.share, 1e-9);
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
