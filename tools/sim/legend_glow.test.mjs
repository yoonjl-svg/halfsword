// 레전드 기운 규칙 시험 (사장님 10/24 21:1x — 전설 무기 빛 = 엑스칼리버만큼 눈에 띄게 · 알갱이는 보완용 · docs/strike/legend_glow_2026-10-24.md)
//  ① 레전드 등급 무기는 모두 기운 줄이 있다 ② 엑스칼리버(기준)는 알갱이가 없다 ③ 알갱이가 있는 줄은 보완 까닭(comp)이 적혀 있다
//  ④ 아지랑이 판은 엑스칼리버보다 넓히지 않는다(사장님 10/24 11:2x '후광이 과하네') ⑤ 보기 손잡이 기본값 = 켬 · 시계 그대로 · 덮어쓰기 없음
//  node --test tools/sim/legend_glow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON_LIST } from '../../src/weapons.js';
import { AURA_PROFILES, AURA_VIEW } from '../../src/aura.js';

// 뽑기에서 뺀 레전드(간장 · 막야 — 적소검이 대신함, 사장님 10/27)도 센다: 막야를 쓰는 인물(찬다) · 이미 가진 칼은 빛이 그대로 있어야 한다.
const legends = WEAPON_LIST.filter((w) => w.tier === 'legend').map((w) => w.id);

test('레전드 무기는 모두 기운 줄이 있고, 기운 줄은 모두 레전드 무기', () => {
  assert.ok(legends.length >= 6, legends.join(','));
  for (const id of legends) assert.ok(AURA_PROFILES[id], `${id} 기운 없음`);
  for (const id of Object.keys(AURA_PROFILES)) assert.ok(legends.includes(id), `${id} 는 레전드가 아님`);
});

test('엑스칼리버(기준)는 알갱이 없음 · 알갱이는 보완 까닭이 적힌 줄만', () => {
  assert.equal(AURA_PROFILES.excalibur.motes ?? null, null);
  for (const [id, p] of Object.entries(AURA_PROFILES)) {
    if (!p.motes) continue;
    assert.equal(typeof p.motes.comp, 'string', `${id}: 알갱이에 보완 까닭(comp)이 없음`);
    assert.ok(p.motes.comp.length >= 8, `${id}: 보완 까닭이 너무 짧음`);
    assert.ok(p.motes.n >= 1 && p.motes.n <= 8 && p.motes.size > 0 && p.motes.size <= 0.028, `${id}: 알갱이 수 · 크기`);
  }
});

test('아지랑이 판은 엑스칼리버보다 넓지 않고, 색 · 세기 칸이 바르다', () => {
  for (const [id, p] of Object.entries(AURA_PROFILES)) {
    assert.ok((p.halfW ?? 0.11) <= 0.11 + 1e-9, `${id}: 판 절반 폭 ${p.halfW}`);
    assert.equal(p.color.length, 3);
    for (const c of p.color) assert.ok(c >= 0 && c <= 1, `${id}: 색 ${p.color}`);
    for (const k of ['gain', 'glow', 'lightGain']) if (p[k] !== undefined) assert.ok(p[k] > 0 && p[k] <= 2, `${id}: ${k} ${p[k]}`);
    if (p.glow !== undefined) assert.notEqual(p.emissive, null, `${id}: 칼날 발광 색 없이 glow`);
    if (p.lightGain !== undefined) assert.notEqual(p.light, null, `${id}: 점 조명 없이 lightGain`);
  }
});

test('보기 손잡이 기본값: 켬 · 시계 그대로 · 덮어쓰기 없음', () => {
  assert.deepEqual({ ...AURA_VIEW }, { on: true, t: null, tune: null });
});
