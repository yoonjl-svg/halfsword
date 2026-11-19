// 팔 사람 꼴 넷 (사장님 11/12 '셋 다 진행해.' · '일단 양손검은 두 손으로 잡는 게 맞고.' · '덤도 고쳐.' — docs/strike/arm_real_2026-11-12.md · 확인표 3600 ~ · 스위치 걷음 11/17 — 늘 켬):
//   A 두손 칼은 두 손으로 쥔 채 손이 몸 앞 — 두손 칼 15 개 모두 오른쪽 끝에서 위팔 돌림 한도 밖 · 팔꿈치 뒤집힘 없음 · 빈손이 안 놓음
//   B 한손 칼 패드 끝에서 팔이 다 펴짐 — 쉼 자리 · 가운데 찌르기 그대로
//   C 동방 한손 칼 일곱 날것 매핑 잣대(무기 틀 표) — 독일 한손과 같은 배수 · 비기 · 고유 공격 동안은 덮은 표(10/10 동방 자세표 — 배수 0.666)
//   D 두 팔 엇갈림 막기 (SKILL.armClear) — 두손 롱소드 위 · 왼쪽 · 오른쪽 · 이탈리아 왼쪽에서 두 팔이 2 cm 넘게 안 뚫음 · 쥠 놓침 없음
//   (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_real.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG } from './harness_m.mjs';
import { runDir } from './arm_reach_audit.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';

const { SKILL } = CONFIG;
const TWO = Object.keys(WEAPONS).filter((w) => WEAPONS[w].twoHand && !WEAPONS[w].gun && WEAPONS[w].frame !== 'gun');
const CHINESE_ONE = Object.keys(WEAPONS).filter((w) => WEAPONS[w].frame === 'one' && traditionOf(WEAPONS[w]) === 'chinese');
const corr = (weapon, setup = null) => {
  const G = newRound({ weapon, weapon2: 'longsword', seed: 1 });
  try {
    const f = G.player;
    f.skill.corr = 'v2';
    setup?.(f);
    const c = f.corrScale(f.skill.level);
    return { k: c.k, stC: c.stC, S: c.S.toArray() };
  } finally {
    G.world.free();
  }
};

test('기본값 — 두 팔 엇갈림 막기 틈 · 비킴 · 켜는 시간', () => {
  assert.ok(SKILL.armClear.gap > 0 && SKILL.armClear.yield > 0 && SKILL.armClear.hold > 0);
});

test('A 두손 칼 15 개 (대검 · 레전드 포함) 오른쪽 끝 — 두 손 쥔 채 · 손이 몸 앞 · 위팔 돌림 한도 밖 · 팔꿈치 뒤집힘 없음', () => {
  assert.equal(TWO.length, 15, TWO.join(','));
  for (const id of ['excalibur', 'kusanagi', 'durandal', 'zweihander', 'flamberge', 'tizona', 'monohoshizao']) assert.ok(TWO.includes(id), id);
  for (const w of TWO) {
    const r = runDir({ weapon: w, dir: 'right', mode: 'slow' });
    assert.ok(!r.flags.includes('shRot') && !r.flags.includes('elbowUp'), `${w} ${r.flags}`);
    assert.ok(!r.flags.includes('grip') && r.frac.grip === 0, `${w} 빈손 놓침 ${r.frac.grip}`);
    assert.ok(r.end.hand[0] > 0.15, `${w} 손 앞 ${r.end.hand[0].toFixed(3)} m`);
  }
});

test('B 한손 칼 패드 끝 — 레이피어 · 환도 오른쪽 · 위 끝에서 팔이 다 펴짐 (11/19 세이버 뺌 — 재기에 sabre 를 쓰지 않음)', () => {
  for (const w of ['rapier', 'hwando']) {
    for (const dir of ['right', 'up']) {
      const on = runDir({ weapon: w, dir, mode: 'slow' });
      assert.ok(on.end.reach >= 0.95, `${w} ${dir} ${on.end.reach.toFixed(3)}`);
      assert.deepEqual(on.flags, [], `${w} ${dir} ${on.flags}`);
    }
  }
});

test('C 동방 한손 일곱 — 배수 · 몸 돌림이 모두 같음(환도 기준 — 독일 세이버 표 그대로 · 11/19 재기에 sabre 를 쓰지 않음) · 비기 동안은 덮은 표(0.666)', () => {
  assert.deepEqual(CHINESE_ONE.sort(), ['chixiao', 'ganjiang', 'goujian', 'hwando', 'moye', 'qinggang', 'sain']);
  const sab = corr('hwando');
  for (const w of CHINESE_ONE) {
    const now = corr(w);
    assert.ok(Math.abs(now.k - sab.k) < 0.002 && Math.abs(now.stC - sab.stC) < 1e-3, `${w} ${now.k} · 환도 ${sab.k}`); // 틀 표 이웃 칸 섞음으로 1e-4 차이
    // 비기가 도는 동안(skill.sec)은 덮은 표 그대로 (대검 · 이탈리아 잣대와 같은 규칙)
    const sec = corr(w, (f) => { f.skill.sec = { stage: 'test' }; });
    assert.ok(Math.abs(sec.k - 0.666) < 0.002, `${w} 비기 동안 ${sec.k}`);
  }
});

test('D 두 팔 엇갈림 — 롱소드 위 · 왼쪽 · 왼위 · 오른쪽 · 이탈리아 왼쪽: 두 팔이 안 뚫음 · 쥠 놓침 없음', () => {
  const cells = [['longsword', 'up'], ['longsword', 'left'], ['longsword', 'upLeft'], ['longsword', 'right'], ['balisarda', 'left'], ['rapier', 'left']];
  for (const [w, dir] of cells) {
    const on = runDir({ weapon: w, dir, mode: 'slow' });
    assert.ok(!on.flags.includes('arms') && on.frac.arms < 0.05, `${w} ${dir} 켬 두 팔 ${on.frac.arms}`);
    if (WEAPONS[w].twoHand) assert.equal(on.frac.grip, 0, `${w} ${dir} 빈손 놓침`);
  }
});

