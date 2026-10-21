// 칠 때 알림 (10/21 — src/strike_cue.js): 어느 창을 읽나 · 남은 시간 몫 · 나타남/사라짐. 그림(느낌표)은 브라우저에서만 — 여기서는 테두리 꼴(edge)로 세기만 본다.
//  실제 발동 화면은 tools/browser/strike_cue_shots.mjs (docs/ui/strike_cue_2026-10-21/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { cueStyle, readCueWindow, createStrikeCue, STRIKE_CUE } from '../../src/strike_cue.js';
import { UNIQUE_ASSIST as UA } from '../../src/config.js';

const alive = { alive: true };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('style from the address: default mark · 0/off · unknown falls back', () => {
  assert.equal(cueStyle(null), 'mark');
  assert.equal(cueStyle(''), 'mark');
  assert.equal(cueStyle('edge'), 'edge');
  assert.equal(cueStyle('both'), 'both');
  assert.equal(cueStyle('0'), 'off');
  assert.equal(cueStyle('off'), 'off');
  assert.equal(cueStyle('loud'), 'mark');
});

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

test('edge strength pops in, follows the time left, fades within 0.1 s after the window closes, and hides at once outside a fight', () => {
  const seen = [];
  const tint = { setCue: (v, gold) => seen.push([v, gold]) };
  const cue = createStrikeCue(null, tint, 'edge');
  const last = { tEnd: 0 };
  const unique = { ready: { name: 'x' }, t: 0, last, chainFrom: null };
  const dt = 1 / 60;
  const run = (n, live = true) => { for (let i = 0; i < n; i++) { unique.t += dt; cue.update(dt, null, live, alive, null, unique.ready ? unique : null, null); } };
  run(1);
  const first = seen.at(-1)[0];
  assert.ok(first > 0 && first < STRIKE_CUE.edge * 0.5, `pop-in starts small (${first})`);
  run(6); // 0.1 s — 다 나타남
  const opened = seen.at(-1)[0];
  assert.ok(opened > first);
  run(24); // 0.5 s
  const late = seen.at(-1)[0];
  assert.ok(late < opened, 'weaker as the window runs out');
  assert.ok(near(cue.state.frac, Math.max(0, (UA.afterWindow - unique.t) / UA.afterWindow), 0.01));
  assert.equal(seen.at(-1)[1], false);
  unique.ready = null; // 창 닫힘
  run(3);
  assert.ok(seen.at(-1)[0] > 0 && seen.at(-1)[0] < late, 'fading');
  run(4);
  assert.equal(seen.at(-1)[0], 0, 'gone 0.1 s after close');
  // 새 창 · 싸움 밖이면 바로 0
  unique.ready = { name: 'x' };
  last.tEnd = unique.t;
  run(8);
  assert.ok(seen.at(-1)[0] > 0);
  run(1, false);
  assert.equal(seen.at(-1)[0], 0);
});

test('secret window is gold; its length is the first time-left seen', () => {
  const seen = [];
  const cue = createStrikeCue(null, { setCue: (v, gold) => seen.push([v, gold]) }, 'both');
  const secret = { open: { t: 0.6 } };
  for (let i = 0; i < 18; i++) {
    cue.update(1 / 60, null, true, alive, null, null, secret);
    secret.open.t -= 1 / 60;
  }
  assert.equal(seen.at(-1)[1], true);
  assert.equal(cue.state.gold, true);
  assert.ok(near(cue.state.frac, (0.6 - 17 / 60) / 0.6, 0.01));
});

test('off draws nothing', () => {
  const seen = [];
  const cue = createStrikeCue(null, { setCue: (v) => seen.push(v) }, '0');
  cue.update(1 / 60, null, true, alive, null, null, { open: { t: 0.6 } });
  assert.equal(seen.length, 0);
  assert.equal(cue.sprite, null);
});
