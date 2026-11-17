// 칠 때 알림 (10/21 — src/strike_cue.js): 어느 창을 읽나 · 남은 시간 몫 · 비기 창 금색 테두리. 그림(느낌표)은 브라우저에서만.
//  실제 발동 화면은 tools/browser/strike_cue_shots.mjs (docs/ui/strike_cue_2026-10-21/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readCueWindow, createStrikeCue } from '../../src/strike_cue.js';
import { UNIQUE_ASSIST as UA } from '../../src/config.js';

const alive = { alive: true };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('reads only a live player window — secret first (gold), then chain, then Indes', () => {
  const last = { tEnd: 1.0 };
  const unique = { ready: { name: 'tsubameGaeshi', nameKo: '제비 베기' }, t: 1.2, last, chainFrom: null };
  const secret = { open: { S: {}, ctx: null, t: 0.4 } };
  assert.equal(readCueWindow(null, unique, secret).kind, null);
  assert.equal(readCueWindow({ alive: false }, unique, secret).kind, null);
  let w = readCueWindow(alive, unique, secret);
  assert.equal(w.kind, 'secret');
  assert.equal(w.gold, true);
  assert.equal(w.left, 0.4);
  assert.equal(w.token, secret.open);
  w = readCueWindow(alive, unique, { open: null });
  assert.equal(w.kind, 'chain');
  assert.equal(w.gold, false);
  assert.equal(w.token, last);
  assert.ok(near(w.total, UA.afterWindow));
  assert.ok(near(w.left, UA.afterWindow - 0.2));
  // 잇는 동작 뒷몫: chainWait 창이 먼저
  w = readCueWindow(alive, { ...unique, chainFrom: { tEnd: 1.15 } }, null);
  assert.ok(near(w.total, UA.chainWait));
  assert.ok(near(w.left, UA.chainWait - 0.05));
  // 독일 막기 연환은 붙어 있는 동안 열림 — 끝없는 창
  assert.equal(readCueWindow(alive, null, { open: { t: Infinity } }).left, Infinity);
});

test('Indes is read defensively (getter may be missing on this base)', () => {
  assert.equal(readCueWindow({ alive: true }, null, null).kind, null);
  assert.equal(readCueWindow({ alive: true, indesOpen: 'yes' }, null, null).kind, null);
  let w = readCueWindow({ alive: true, indesOpen: true, indesLeft: 0.3 }, null, null);
  assert.equal(w.kind, 'indes');
  assert.equal(w.left, 0.3);
  w = readCueWindow({ alive: true, indesOpen: true, indesLeft: null }, null, null);
  assert.equal(w.left, null);
});

test('secret window is gold; its length is the first time-left seen', () => {
  const cue = createStrikeCue(null, null);
  const secret = { open: { t: 0.6 } };
  for (let i = 0; i < 18; i++) {
    cue.update(1 / 60, null, true, alive, null, null, secret);
    secret.open.t -= 1 / 60;
  }
  assert.equal(cue.state.gold, true);
  assert.ok(near(cue.state.frac, (0.6 - 17 / 60) / 0.6, 0.01));
});

test('10/23: gold screen edge only for a secret window', () => {
  const gold = [];
  const tint = { setSecretEdge: (v) => gold.push(v) };
  const cue = createStrikeCue(null, tint);
  const secret = { open: { t: 0.6 } };
  for (let i = 0; i < 12; i++) {
    cue.update(1 / 60, null, true, alive, null, null, secret);
    secret.open.t -= 1 / 60;
  }
  assert.ok(gold.at(-1) > 0.5, `gold edge on (${gold.at(-1)})`);
  // 끝없는 창(무장 동안)은 늘 다 켜짐
  const armed = createStrikeCue(null, tint);
  const endless = { open: { t: Infinity } };
  for (let i = 0; i < 12; i++) armed.update(1 / 60, null, true, alive, null, null, endless);
  assert.ok(near(gold.at(-1), 1));
  // 이어 긋기(금빛 아님) 창은 금색 테두리 없음
  const plain = createStrikeCue(null, tint);
  const unique = { ready: { name: 'x' }, t: 0.1, last: { tEnd: 0 }, chainFrom: null };
  for (let i = 0; i < 12; i++) plain.update(1 / 60, null, true, alive, null, unique, null);
  assert.equal(gold.at(-1), 0);
  // 싸움 밖
  cue.update(1 / 60, null, false, alive, null, null, secret);
  assert.equal(gold.at(-1), 0);
});
