// 비기 잔상 점검 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해' — docs/decisions.md 10/23 · 그림 docs/handoff/secret_trails) 시험 — node --test tools/sim/secret_trail.test.mjs
//  결정타 몫에 비기 잔상(f.instantArc) · 밝기 = 칼끝 빠르기 ÷ 고노센(바닥 ART_MIN) · 그리는 밝기 바닥 SECRET.secretArcMin · 모르트슐라크 · 격살은 베는 토막만 · 마주 보는 띠(SECRET.secretStreak) 켬 · 끔
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { probe } from './secret_trail_probe.mjs';

const { SECRET } = CONFIG;
const { ART_MIN } = await import('../../src/secret_instant.js');

test('고노센 그대로 (기준): 발도 잔상 iai · 세기 1 · 마주 보는 띠 없음', () => {
  const o = probe('gonosen');
  assert.equal(o.kind, 'iai');
  assert.equal(o.share, 1);
  assert.equal(o.face, false);
});

test('안다레 리솔루토 런지 (10/24): 찌르는 토막에 비기 잔상(combo) · 세기 = 고노센 빠르기 몫(risolutoShare 1) · 찌르기라 마주 보는 띠(찌르는 줄)', () => {
  const o = probe('riso');
  assert.equal(o.kind, 'combo');
  assert.equal(o.share, SECRET.risolutoShare);
  assert.ok(o.pts >= 6, `점 ${o.pts}`);
  assert.equal(o.face, 'line');
  assert.equal(o.min, SECRET.secretArcMin); // 그리는 밝기는 결정타 잔상 바닥까지
});

test('안다레 리솔루토 10/23 탭 찌르기 판(?risoLunge=0): 찌르는 몫에 비기 잔상(combo) · 칼끝이 느려 바닥 ART_MIN · 마주 보는 띠', () => {
  const keep = [SECRET.risolutoLunge, SECRET.risolutoArmSlow, SECRET.risolutoStiff];
  Object.assign(SECRET, { risolutoLunge: 0, risolutoArmSlow: null, risolutoStiff: null });
  try {
    const o = probe('riso');
    assert.equal(o.kind, 'combo');
    assert.equal(o.share, ART_MIN);
    assert.ok(o.pts >= 8, `점 ${o.pts}`);
    assert.equal(o.face, 'line');
    assert.equal(o.min, SECRET.secretArcMin);
  } finally {
    [SECRET.risolutoLunge, SECRET.risolutoArmSlow, SECRET.risolutoStiff] = keep;
  }
});

test('모르트슐라크 · 격살: 잔상은 베는 토막만(준비 · 다시 세우기 · 이음 없음) · 세기는 빠르기 몫 그대로', () => {
  const m = probe('mord'); // 10/31 14:xx 사장님 '폼멜 찍기로 바꿔서 본판에 올려.' — 기본 폼멜 찍기는 내려찍는 토막이 짧아(손 길 기준 ~0.2 s) 점이 적음(18)
  assert.equal(m.kind, 'combo');
  assert.equal(m.share, SECRET.mord.kin);
  assert.ok(m.pts > 10 && m.ptsCut === m.ptsAll, `${m.ptsCut}/${m.ptsAll}`);
  const keep = { ...SECRET.mord };
  Object.assign(SECRET.mord, { pommel: 0, noSelfClip: 0 }); // 거꾸로 쥔 판(10/31 전 — `?mordPommel=0&mordNoClip=0`) 그대로 지킴
  try {
    const r = probe('mord');
    assert.ok(r.pts > 20 && r.ptsCut === r.ptsAll, `거꾸로 쥔 판 ${r.ptsCut}/${r.ptsAll}`);
  } finally {
    Object.assign(SECRET.mord, keep);
  }
  assert.equal(m.face, 'path'); // 정수리로 곧게 내리침 — 뒤 카메라에서 옆으로 보임 → 칼자루 끝 길
  assert.equal(m.min, SECRET.secretArcMin);
  const g = probe('gyeoksal');
  assert.equal(g.share, SECRET.gyeoksal.share);
  assert.ok(g.pts > 10 && g.ptsCut === g.ptsAll, `${g.ptsCut}/${g.ptsAll}`);
  assert.equal(g.face, false); // 머리 베기는 사선 호 — 띠 없음 (허파 찌르기만)
});

test('스위치 SECRET.secretStreak 0 = 호만 (마주 보는 띠 없음) · SECRET.secretArcMin 0 = 빠르기 몫 그대로', () => {
  const keep = [SECRET.secretStreak, SECRET.secretArcMin];
  SECRET.secretStreak = 0;
  SECRET.secretArcMin = 0;
  try {
    for (const k of ['riso', 'mord']) {
      const o = probe(k);
      assert.equal(o.face, false);
      assert.equal(o.min, 0);
      assert.equal(o.arcAlpha, +(0.95 * o.share).toFixed(2));
    }
  } finally {
    [SECRET.secretStreak, SECRET.secretArcMin] = keep;
  }
});
