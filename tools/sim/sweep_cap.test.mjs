// 끌고 가는 칼 맞음 빠르기 묶음 시험 (11/04 결함 고침 — config SECRET.sweepCap · secret_instant.js stepCombo · instantWound plan · 기록 docs/strike/school_balance_2026-11-04.md §1)
//  결함: 끌고 가는 칼(연환 · 특수 공격 · 비기)의 맞은 점 빠르기를 놓인 칼이 한 스텝에 옮긴 길이로 쟀다. 손목 교정(JOINTS.wristGuard — wristClamp)이 한 스텝에 켜지고 꺼지면
//   칼이 한 스텝에 30 ~ 57° 돌아 그 튐이 칼 빠르기로 읽혔다(샛별 저장소 연구 65dab6f 의 정수리 가르기 4965 J · 격살 2325 · 인콰르타타 2257 · 겹치기 1470 J — 같은 판이 바이트 그대로 재현됨).
//  우리 도구 장면: special_balance.mjs drill rdHold(정수리 가르기 — 서 있는 상대) 씨앗 4 · 고치기 전 554.9 J · 27.9 m/s(짠 길 10.7 m/s) · 심각도 6.28 → 고친 뒤 짠 길 빠르기.
//  node --test tools/sim/sweep_cap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { drillRun } from './special_balance.mjs';

const SECRET = CONFIG.SECRET;

/** drill rdHold 한 판 — 끌고 가는 칼이 상대 몸에 닿은 맞음마다 { E, v(판정 빠르기), act(놓인 칼) · plan(짠 길) } */
function rdDrill(seed, cap) {
  const was = SECRET.sweepCap;
  SECRET.sweepCap = cap;
  // 11/11 이베리아 자리 바꿈: 이 장면은 정수리 가르기 특수 공격 판(drill rdHold — 무장 없이 길게 눌러 냄 · 'spin' 판)이라 그 판으로 묶음 (시험 안에서만)
  const wasIb = SECRET.iberianSecret;
  SECRET.iberianSecret = 'spin';
  const hits = [];
  let hooked = false;
  const probe = (G, P) => {
    if (hooked) return;
    hooked = true;
    const pw = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, ...rest) => {
      pw?.(att, vic, r, ...rest);
      if (att === P && P.iai?.kind === 'combo') hits.push({ tech: P.iai.tech, E: r.energy, v: r.speed, sev: r.severity ?? 0, act: P.iai.sweepV?.act ?? null, plan: P.iai.sweepV?.plan ?? null });
    };
  };
  try {
    drillRun('rdHold', seed, { foe: 'still', probe });
  } finally {
    SECRET.sweepCap = was;
    SECRET.iberianSecret = wasIb;
  }
  return hits;
}

test('기본값: 끌고 가는 칼 맞음 빠르기 묶음 켬 (SECRET.sweepCap 1 · `?sweepCap=0` = 전 판)', () => {
  assert.equal(SECRET.sweepCap, 1);
});

test('정수리 가르기 손목 교정 튐 (drill rdHold 씨앗 4): 끄면 554 J 튐이 그대로 · 켜면 짠 길 빠르기 — 같은 판 다른 씨앗의 보통 맞음과 같은 크기', () => {
  const off = rdDrill(4, 0);
  const on = rdDrill(4, 1);
  assert.equal(off.length, 1, '끔: 맞음 하나');
  assert.equal(on.length, 1, '켬: 맞음 하나 (맞음 수는 그대로)');
  assert.equal(off[0].tech, 'redondo');
  assert.ok(off[0].E > 400 && off[0].v > 25, `끔 = 튐이 칼 빠르기로 읽힘 (전 판 554.9 J · 27.9 m/s): ${off[0].E.toFixed(1)} J · ${off[0].v.toFixed(1)} m/s`);
  assert.ok(on[0].act > 2 * on[0].plan, `켬: 놓인 칼은 여전히 튐 (그림 · 움직임은 그대로 — 판정만): 놓인 ${on[0].act.toFixed(1)} · 짠 길 ${on[0].plan.toFixed(1)} m/s`);
  assert.ok(on[0].v <= on[0].plan + 0.6, `켬: 판정 빠르기 ≤ 짠 길 빠르기 (+ 상대 몸 빠르기 몫): ${on[0].v.toFixed(2)} ≤ ${on[0].plan.toFixed(2)}`);
  assert.ok(on[0].E < 150 && on[0].sev < 1.5, `켬: 보통 정수리 가르기 맞음 크기 (다른 씨앗 75 ~ 80 J · 심각도 0.6): ${on[0].E.toFixed(1)} J · ${on[0].sev.toFixed(2)}`);
});

test('튐이 없는 맞음은 그대로 (drill rdHold 씨앗 7 — 켬 · 끔 바이트 같음)', () => {
  const off = rdDrill(7, 0);
  const on = rdDrill(7, 1);
  assert.equal(on.length, off.length);
  assert.ok(on.length >= 1);
  for (let i = 0; i < on.length; i++) {
    assert.equal(on[i].E, off[i].E, '에너지 같음');
    assert.equal(on[i].sev, off[i].sev, '심각도 같음');
    assert.ok(on[i].act <= on[i].plan * 1.05, '놓인 칼 ≈ 짠 길 (튐 없음)');
  }
});
