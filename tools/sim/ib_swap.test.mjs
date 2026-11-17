// 이베리아 자리 바꿈 시험 (11/11 사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자. 싱지르를 제비베기와 같은 위계의 특수공격으로 알티바슈 포르트를 고노센 급의 비기로.' —
//  기록 docs/strike/ib_swap_2026-11-11.md · config SECRET.iberianSecret 'altib' · SECRET.altib · SECRET.ibSpin.stride · specialShare.cingir · 재는 판 tools/sim/ib_swap.mjs)
//  비기 알티바슈 포르트: 싱지르 무장(칼끝 거리 밖 2 s) 창에서만 길게 눌러 메기 · 칼끝 고노센 × 0.35 · 판정 = 비기 배율(1) × 남은 기력 몫 · 내려친 뒤 기력 0 · 판당 한 번.
//  특수 공격 싱지르: 무장 없이 원 한 바퀴 · 칼끝 고노센 × 0.3 · 식힘 · 비기 셈 · 판정 배율 없음 · 한 걸음 나가며 돎.
//  같은 날 사장님 결정 — 비기 판정 배율 1.3 은 고노센만 · 죽음의 일격 0.35 · 1.0 · 누르기 1.5 s · 겹치기 0.3.
//  node --test tools/sim/ib_swap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { SECRET, ARENA, UNIQUE_ASSIST as UA, STAMINA, realS } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch, secretLeft } from '../../src/secret.js';
import { PlayerUniqueAssist, altibHitMul } from '../../src/unique_assist.js';
import { mordHitMul } from '../../src/mordschlag.js';
import { nodeTitle } from '../../src/skill_tree.js';
import * as D from '../../src/skill_tree_data.js';
import { altibRun } from './ib_swap.mjs';

const setup = (P) => {
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
};

test('기본값 — 사장님 11/11: 이베리아 비기 = 알티바슈 포르트 · 빠르기 0.35 · 기력 몫 · 기력 0 · 판정 1 · 싱지르 특수 0.3 · 고노센만 1.3 · 죽음의 일격 0.35 · 1.0 · 누르기 1.5 s · 겹치기 0.3', () => {
  assert.equal(TRADITIONS.iberian.secret.name, 'altib');
  assert.equal(TRADITIONS.iberian.secret.nameKo, '알티바슈 포르트');
  assert.equal(SECRET.altib.share, 0.35); // '알티바슈 포르테로 35%로 해. 비기 숫자테이블이 일정해지게.'
  assert.equal(altibHitMul(), 1); // '비기 파괴력 배율 1.3배는 고노센에만 남긴다'
  assert.equal(SECRET.hitMul, 1.3); // 고노센 (비기 공통 열쇠 그대로)
  assert.equal(mordHitMul(), 1); // '죽음의 일격도 1.0으로 해.'
  assert.equal(SECRET.mord.kin, 0.4); // 11/16 '격살과 모르트슐라크도 40%로' (전 '30%') // 11/16 사장님 '모르트슐라크 30%' (전 11/11 '빠르기 35%로 하자.')
  assert.equal(SECRET.mordPress, realS(1.5)); // '1.5초로 해.'
  assert.equal(UA.specialShare.cingir, 0.3); // '빠르기를 고노센의 30%로'
  assert.equal(UA.specialShare.duplieren, 0.3); // '겹치기 30으로.'
});

