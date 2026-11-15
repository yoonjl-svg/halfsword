// 이어 돌리기 사슬 칼 (11/15 사장님 "몇번째 칼이든 그은 그대로 칼이 나가야 하고 이어돌리기는 그 사이의 힌지일 뿐이야." — 기록 docs/strike/ib_link_2026-11-15.md)
//  사람 넘기기 판: 손가락 몫을 지연 줄로 받아 그은 박자 그대로 냄 — 둘째 · 셋째 · 넷째 칼의 손 목표가 그은 몫과 같고(그 시작 자리에서) · 읽힌 칼이 같은 긋기를 새로 그은 것과 같음.
//  사슬 칼 빠르기 시제품 (IB_LINK.chainSpeed — 기본 끔): 서보 힘 × s² · 기력 + 베기 값 × (s² − 1)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { chainOne, chainRun } from './ib_link_chain.mjs';
import { linkBoost } from '../../src/iberian_link.js';

const { IB_LINK, STAMINA } = CONFIG;

function same(r, names) {
  assert.deepEqual(r.cuts.map((c) => c.link), names, JSON.stringify(r.cuts.map((c) => [c.k, c.link, c.cancel])));
  for (const c of r.cuts) {
    assert.ok(c.hErr <= 1e-9 && c.hEnd <= 1e-9, `${c.k}째 ${c.name} 손 목표가 그은 몫과 다름 ${c.hErr} · ${c.hEnd}`);
    assert.equal(c.hSpeed, 1, `${c.k}째 ${c.name} 그은 빠르기 그대로`);
    assert.equal(c.exe, c.fresh, `${c.k}째 ${c.name} 읽힌 칼 ${c.exe} · 새로 그은 칼 ${c.fresh}`);
  }
}

test('기본값 — 사슬 칼 빠르기 시제품 끔 (사장님 확인 전) · p 0.05 · n 3', () => {
  assert.equal(IB_LINK.chainSpeed.on, 0);
  assert.equal(IB_LINK.chainSpeed.p, 0.05);
  assert.equal(IB_LINK.chainSpeed.n, 3);
});

test('사슬 넷 (쉼 0.1 s) — 둘째 · 셋째 · 넷째 칼 모두 그은 그대로 (손 목표 · 빠르기 · 읽힌 칼) · 넘기기는 그 칼 시작 자리로만', () => {
  for (const ws of ['zweihander', 'tizona']) same(chainOne({ ws, seq: ['zornhau', 'zwerchL', 'zornhau', 'zwerch'], gap: 0.1 }), ['zwerchL', 'zornhau', 'zwerch']);
});

test('사슬 셋 (쉬지 않고 꺾어 그음) — 다음 칼 첫머리가 앞 칼 다시 긋기에 섞이지 않음 · 셋째 칼도 나감', () => {
  same(chainOne({ seq: ['zornhau', 'zwerchL', 'zornhau'], gap: 0 }), ['zwerchL', 'zornhau']);
  same(chainOne({ seq: ['zornhau', 'zornhauL', 'zwerch'], gap: 0 }), ['zornhauL', 'zwerch']);
});

test('휘어 들어온 다음 칼(↙ 뒤 ↓) · 되짚음(→ 뒤 ←) — 앞 칼 몫이 다음 칼 첫머리로 안 들어감', () => {
  same(chainOne({ seq: ['zornhau', 'oberhau'], gap: 0 }), ['oberhau']);
  const r = chainOne({ seq: ['zwerch', 'zwerchL'], gap: 0 }); // 앞 칼 끝 = 다음 칼 시작 자리 — 넘기지 않고 그대로
  assert.equal(r.cuts[0].link, null);
  assert.equal(r.cuts[0].exe, 'zwerchL');
  assert.ok(r.cuts[0].hErr <= 1e-9);
});

test('사슬 칼 빠르기 — s = 1 + p × min(k, n) · 서보 힘 × s² · 기력 + 베기 값 × 무기 무게 × (s² − 1) · 모자라면 안 더함', (t) => {
  const c0 = { ...IB_LINK.chainSpeed };
  t.after(() => Object.assign(IB_LINK.chainSpeed, c0));
  const mk = (k, v) => ({ ibLinkK: k, stamina: { value: v, weight: 1.5, spend(_, c) { this.value -= c; } } });
  Object.assign(IB_LINK.chainSpeed, { on: 0 });
  const f0 = mk(1, 100);
  assert.equal(linkBoost(f0), null);
  assert.equal(f0.ibBoostK, undefined);
  Object.assign(IB_LINK.chainSpeed, { on: 1, p: 0.1, n: 3 });
  const f = mk(2, 100);
  const b = linkBoost(f);
  assert.ok(Math.abs(b.s - 1.2) < 1e-12 && Math.abs(f.ibBoostK - 1.44) < 1e-12);
  if (STAMINA.on) assert.ok(Math.abs(100 - f.stamina.value - STAMINA.cutCost * 1.5 * 0.44) < 1e-9);
  const f5 = mk(5, 100);
  assert.ok(Math.abs(linkBoost(f5).s - 1.3) < 1e-12, 'n 번째 넘김까지만');
  if (STAMINA.on) assert.equal(linkBoost(mk(3, 1)), null, '기력이 모자라면 안 더함');
});

test('사슬 칼 빠르기 켜면 — 넘김마다 k 1 · 2 · 3 · 손 목표는 그대로(그은 길 · 박자) · 끄면 더함 없음', (t) => {
  const c0 = { ...IB_LINK.chainSpeed };
  t.after(() => Object.assign(IB_LINK.chainSpeed, c0));
  const seq = ['zornhau', 'zwerchL', 'zornhau', 'zwerch'];
  Object.assign(IB_LINK.chainSpeed, { on: 1, p: 0.1, n: 3 });
  const R = chainRun({ seq, gap: 0.1 });
  assert.deepEqual(R.boost?.k, { 1: 1, 2: 1, 3: 1 }, JSON.stringify(R.boost));
  same(chainOne({ seq, gap: 0.1 }), ['zwerchL', 'zornhau', 'zwerch']);
  Object.assign(IB_LINK.chainSpeed, { on: 0 });
  assert.equal(chainRun({ seq, gap: 0.1 }).boost, null);
});
