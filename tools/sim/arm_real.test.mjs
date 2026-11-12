// 팔 사람 꼴 넷 (사장님 11/12 '셋 다 진행해.' · '일단 양손검은 두 손으로 잡는 게 맞고.' · '덤도 고쳐.' — docs/strike/arm_real_2026-11-12.md · 확인표 3600 ~):
//   A 두손 칼은 두 손으로 쥔 채 손이 몸 앞 (SKILL.twoHandReach 1) — 두손 칼 15 개 모두 오른쪽 끝에서 위팔 돌림 한도 밖 · 팔꿈치 뒤집힘 없음 · 빈손이 안 놓음
//   B 한손 칼 패드 끝에서 팔이 다 펴짐 (SKILL.edgeReach 1) — 쉼 자리 · 가운데 찌르기 그대로
//   C 동방 한손 칼 일곱 날것 매핑 잣대 (SKILL.eastScale 'frame') — 독일 한손과 같은 배수 · 일본 두손은 A 만 켠 판과 바이트 같음 · 비기 · 고유 공격 동안은 전 판 잣대
//   D 두 팔 엇갈림 막기 (SKILL.armClear) — 두손 롱소드 위 · 왼쪽 · 오른쪽 · 이탈리아 왼쪽에서 두 팔이 2 cm 넘게 안 뚫음 · 새 한도 닿음 · 팔꿈치 뒤집힘 · 쥠 놓침 없음 · 손 뗀 쉼 · AI 그대로
//   (시간 기준 없음 — 사장님 11/01 '공격이 몇 초 안에 끝나야한다 이런 기준 없애')
//   node --test tools/sim/arm_real.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, CONFIG } from './harness_m.mjs';
import { runDir } from './arm_reach_audit.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { withArmOld } from './arm_real_pin.mjs';

const { SKILL } = CONFIG;
const withSkill = (o, fn) => {
  const old = {};
  for (const k of Object.keys(o)) (old[k] = SKILL[k]), (SKILL[k] = o[k]);
  try { return fn(); } finally { Object.assign(SKILL, old); }
};
const withClear = (on, fn) => {
  const old = SKILL.armClear.on;
  SKILL.armClear.on = on;
  try { return fn(); } finally { SKILL.armClear.on = old; }
};
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

test('기본값 — A twoHandReach 1 · B edgeReach 1 · C eastScale frame · D armClear 켬 (사장님 11/12 결정 셋 + 덤)', () => {
  assert.equal(SKILL.twoHandReach, 1);
  assert.equal(SKILL.edgeReach, 1);
  assert.equal(SKILL.eastScale, 'frame');
  assert.equal(SKILL.armClear.on, 1);
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

test('B 한손 칼 패드 끝 — 세이버 · 레이피어 · 환도 오른쪽 · 위 끝에서 팔이 다 펴짐 (전 판보다) · 쉼 자리 그대로', () => {
  for (const w of ['sabre', 'rapier', 'hwando']) {
    for (const dir of ['right', 'up']) {
      const on = runDir({ weapon: w, dir, mode: 'slow' });
      const old = withSkill({ edgeReach: 0 }, () => runDir({ weapon: w, dir, mode: 'slow' }));
      assert.ok(on.end.reach >= 0.95 && on.end.reach > old.end.reach, `${w} ${dir} ${old.end.reach.toFixed(3)} → ${on.end.reach.toFixed(3)}`);
      assert.deepEqual(on.flags, [], `${w} ${dir} ${on.flags}`);
    }
  }
});

test('C 동방 한손 일곱 — 배수 · 몸 돌림이 독일 세이버와 같음 (전 판 0.666) · 비기 · 고유 공격 동안은 전 판 잣대 · 일본 두손 · 다른 무기 그대로', () => {
  assert.deepEqual(CHINESE_ONE.sort(), ['chixiao', 'ganjiang', 'goujian', 'hwando', 'moye', 'qinggang', 'sain']);
  const sab = corr('sabre');
  for (const w of CHINESE_ONE) {
    const now = corr(w);
    const old = withSkill({ eastScale: 'off' }, () => corr(w));
    assert.ok(Math.abs(old.k - 0.666) < 0.002, `${w} 전 판 ${old.k}`);
    assert.ok(Math.abs(now.k - sab.k) < 0.002 && Math.abs(now.stC - sab.stC) < 1e-3, `${w} ${now.k} · 세이버 ${sab.k}`); // 틀 표 이웃 칸 섞음으로 1e-4 차이
    // 비기가 도는 동안(skill.sec)은 덮은 표 그대로 (대검 · 이탈리아 잣대와 같은 규칙)
    const sec = corr(w, (f) => { f.skill.sec = { stage: 'test' }; });
    assert.deepEqual(sec, old, `${w} 비기 동안`);
  }
  for (const w of ['uchigatana', 'kusanagi', 'muramasa', 'longsword', 'rapier', 'sabre', 'zweihander']) assert.deepEqual(corr(w), withSkill({ eastScale: 'off' }, () => corr(w)), w);
});

test('C 일본 두손 셋 — A 만 켠 판과 팔 끝 자세 바이트 같음 (eastScale 끔과)', () => {
  for (const w of ['uchigatana', 'kusanagi', 'muramasa']) {
    for (const dir of ['right', 'up']) {
      const a = runDir({ weapon: w, dir, mode: 'slow' });
      const b = withSkill({ eastScale: 'off' }, () => runDir({ weapon: w, dir, mode: 'slow' }));
      assert.deepEqual(a.end, b.end, `${w} ${dir}`);
      assert.deepEqual(a.poseEnd, b.poseEnd, `${w} ${dir}`);
    }
  }
});

test('C 동방 한손 — 패드 끝 뻗음(B)을 끈 판에서 독일 한손(세이버)과 같은 뻗음 (전 판보다 뻗음)', () => {
  for (const dir of ['right', 'up', 'left']) {
    const hw = withSkill({ edgeReach: 0 }, () => runDir({ weapon: 'hwando', dir, mode: 'slow' }));
    const hwOld = withSkill({ edgeReach: 0, eastScale: 'off' }, () => runDir({ weapon: 'hwando', dir, mode: 'slow' }));
    const sab = withSkill({ edgeReach: 0 }, () => runDir({ weapon: 'sabre', dir, mode: 'slow' }));
    assert.ok(hw.end.reach > hwOld.end.reach, `${dir} 환도 ${hwOld.end.reach.toFixed(3)} → ${hw.end.reach.toFixed(3)}`);
    assert.ok(Math.abs(hw.end.reach - sab.end.reach) < 0.03, `${dir} 환도 ${hw.end.reach.toFixed(3)} · 세이버 ${sab.end.reach.toFixed(3)}`);
  }
});

test('D 두 팔 엇갈림 — 롱소드 위 · 왼쪽 · 왼위 · 오른쪽 · 이탈리아 왼쪽: 끄면 두 팔이 뚫음 · 켜면 안 뚫음 · 새 한도 닿음 · 팔꿈치 뒤집힘 · 쥠 놓침 없음', () => {
  const cells = [['longsword', 'up'], ['longsword', 'left'], ['longsword', 'upLeft'], ['longsword', 'right'], ['balisarda', 'left'], ['rapier', 'left']];
  for (const [w, dir] of cells) {
    const on = runDir({ weapon: w, dir, mode: 'slow' });
    const off = withClear(0, () => runDir({ weapon: w, dir, mode: 'slow' }));
    assert.ok(off.flags.includes('arms'), `${w} ${dir} 끔 ${off.flags}`);
    assert.ok(!on.flags.includes('arms') && on.frac.arms < 0.05, `${w} ${dir} 켬 두 팔 ${on.frac.arms}`);
    for (const k of ['elbowUp', 'shRot', 'shPlane', 'grip', 'body', 'sword']) assert.ok(!on.flags.includes(k) || off.flags.includes(k), `${w} ${dir} 새 ${k}`);
    if (WEAPONS[w].twoHand) assert.equal(on.frac.grip, 0, `${w} ${dir} 빈손 놓침`);
  }
});

test('D 두 팔 엇갈림 막기 — 손을 뗀 쉼 · 사람 아닌 몸(AI)은 그대로', () => {
  const rest = (w) => {
    const G = newRound({ seed: 1, weapon: w, weapon2: 'longsword', onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    try {
      const P = G.player;
      P.skill.corr = 'v2';
      P.skill.autoGuard = true;
      while (G.t < 2.4) G.step();
      const tr = (b) => { const t = b.translation(); return [t.x, t.y, t.z]; };
      return { sw: P.swivelTh, s: tr(P.bodies.farmS), o: tr(P.bodies.farmO), e: tr(G.enemy.bodies.farmS) };
    } finally {
      G.world.free();
    }
  };
  // 11/12 둘째(armClear.ai — 사장님 '남은 팔 엇갈림 고치고 ai에도 넣어')부터 AI 몸도 엇갈림 막기를 탐 — 이 시험은 첫 판(사람만 · main 30929293) 잣대라 그 판으로 묶음 (arm_real_pin armClear2 · 새 AI 몫은 arm_clear2.test.mjs)
  withArmOld(() => {
    for (const w of ['longsword', 'zweihander', 'uchigatana', 'balisarda']) assert.deepEqual(rest(w), withClear(0, () => rest(w)), w);
  }, ['armClear2']);
});
