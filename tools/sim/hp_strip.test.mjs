// 동시 대전 체력 칸 시험 (사장님 11/18 — src/hp_strip.js · config TEAM_FIGHT.hpStrip · 그리는 곳 src/stamina_hud.js · 기록 docs/strike/saengsa_ui_2026-11-18.md §2):
//  10 칸 · 켜진 칸 = 올림(몫 × 10) · 색 ≥ 80 % 초록 · < 80 % 노랑 · < 50 % 주황 · < 20 % 빨강(편과 무관) · 점멸 = 출혈(초당 0.002 넘게) 또는 중상 이상 상처(심각도 ≥ SAENGSA.seriousAt).
//  node --test tools/sim/hp_strip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEAM_FIGHT, VITALS, SAENGSA } from '../../src/config.js';
import { hpShare, hpLit, hpTone, hpAlarm, hpStrip, hpLift } from '../../src/hp_strip.js';
import { hexToOklch, oklchToCss } from '../../src/oklch.js';
import { BLOOD_RED } from '../../src/blood_palette.js';

const C0 = VITALS.collapseBlood;
/** 가짜 몸: 체력 몫 share (피 = 쓰러지는 문턱 + 몫 × 나머지) · 출혈 · 상처 */
const body = (share, o = {}) => ({ alive: true, blood: C0 + (1 - C0) * share, bleed: 0, wounds: [], ...o });

test('값 — 10 칸 · 문턱 80 · 50 · 20 % [사장님 11/18 결정] · 출혈 문턱 0.002 (1:1 출혈 맥박과 같음)', () => {
  assert.equal(TEAM_FIGHT.hpStrip.cells, 10);
  assert.deepEqual(TEAM_FIGHT.hpStrip.tones, [[0.8, 'green'], [0.5, 'yellow'], [0.2, 'orange']]);
  assert.equal(TEAM_FIGHT.hpStrip.low, 'red');
  assert.equal(TEAM_FIGHT.hpStrip.bleedAt, 0.002);
  assert.equal(hpLift(), TEAM_FIGHT.hpStrip.h + TEAM_FIGHT.hpStrip.gap);
  assert.equal(TEAM_FIGHT.hudColor.allyHue, undefined, '아군 체력 막대 녹색은 왼쪽 위 목록과 함께 걷음');
});

test('몫 — 피 1 = 1 · 쓰러지는 문턱 = 0 · 죽으면 0 (생사전 판 끝 체력과 같은 잣대)', () => {
  assert.equal(hpShare(body(1)), 1);
  assert.equal(hpShare({ alive: true, blood: C0 }), 0);
  assert.equal(hpShare({ alive: true, blood: 0.1 }), 0);
  assert.equal(hpShare({ alive: false, blood: 1 }), 0);
  assert.ok(Math.abs(hpShare(body(0.37)) - 0.37) < 1e-12);
});

test('켜진 칸 = 올림(몫 × 10): 산 몸은 늘 한 칸 이상 · 한 칸은 10 % 를 다 잃어야 꺼짐', () => {
  const rows = [[1, 10], [0.95, 10], [0.9, 9], [0.900001, 10], [0.81, 9], [0.8, 8], [0.5, 5], [0.49, 5], [0.41, 5], [0.4, 4], [0.11, 2], [0.1, 1], [0.01, 1], [1e-6, 1], [0, 0], [-0.2, 0]];
  for (const [s, n] of rows) assert.equal(hpLit(s), n, `몫 ${s}`);
  assert.equal(hpLit(0.1 + 0.2), 3); // 셈 찌꺼기(0.30000000000000004)에 한 칸 더 켜지지 않음
  assert.equal(hpLit(0.7), 7);
  for (let i = 0; i <= 1000; i++) { const s = i / 1000, n = hpLit(s); assert.ok(n >= 0 && n <= 10 && (s > 0) === (n > 0), `몫 ${s} → ${n}`); }
});

test('색 — ≥ 80 % 초록 · < 80 % 노랑 · < 50 % 주황 · < 20 % 빨강 (아군 · 적 같음)', () => {
  const rows = [[1, 'green'], [0.8, 'green'], [0.7999, 'yellow'], [0.5, 'yellow'], [0.4999, 'orange'], [0.2, 'orange'], [0.1999, 'red'], [0.01, 'red'], [0, 'red']];
  for (const [s, tone] of rows) assert.equal(hpTone(s), tone, `몫 ${s}`);
  assert.deepEqual(hpStrip(body(0.62, { team: 0 })), hpStrip(body(0.62, { team: 1 })), '편과 무관');
});

test('점멸 — 출혈(초당 0.002 넘게) 또는 중상 이상 상처(심각도 ≥ 0.5 · 지고 들어온 부상 포함) · 경상 · 멎은 출혈은 아님', () => {
  assert.equal(SAENGSA.seriousAt, 0.5);
  assert.equal(hpAlarm(body(1)), false);
  assert.equal(hpAlarm(body(1, { bleed: 0.002 })), false, '문턱 그대로는 멎음');
  assert.equal(hpAlarm(body(1, { bleed: 0.0021 })), true, '출혈');
  assert.equal(hpAlarm(body(1, { wounds: [{ part: 'uarmO', type: 'cut', severity: 0.49, bleed: 0 }] })), false, '경상');
  assert.equal(hpAlarm(body(1, { wounds: [{ part: 'uarmO', type: 'cut', severity: 0.5, bleed: 0 }] })), true, '중상 문턱');
  assert.equal(hpAlarm(body(1, { wounds: [{ part: 'thighB', type: 'cut', severity: 0.7, bleed: 0, carried: true }] })), true, '지고 들어온 중상');
  assert.equal(hpAlarm(body(0.9, { wounds: [{ part: 'chest', type: 'cut', severity: 1.3, bleed: 0, stump: true }] })), true, '잘린 단면');
  const s = hpStrip(body(0.15, { bleed: 0.01 }));
  assert.deepEqual(s, { lit: 2, tone: 'red', blink: true, pct: 15 });
  assert.deepEqual(hpStrip(body(0.9)), { lit: 9, tone: 'green', blink: false, pct: 90 });
});

test('스택 표시 없음 — 머리 위 기세 칸 · 사냥 발톱 자국 · 왼쪽 스택 칸 · 왼쪽 위 체력 목록 (사장님 11/18 \'스택 표시는 … 그냥 빼\')', () => {
  // 옛 머리 위 칸은 CSS display 가 hidden 을 덮어 숨겨도 남았다(왼쪽 위 모서리 점선 · 허공에 남은 수 — 기록 §3-1) — 그 판 · 꼴이 다시 들어오지 않게
  const read = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  for (const f of ['src/cn_hunt_hud.js', 'src/stack_hud.js']) assert.ok(!fs.existsSync(new URL(`../../${f}`, import.meta.url)), `${f} 가 남음`);
  assert.ok(!/stackShow|ken-pips|huntN/.test(read('src/stamina_hud.js')), 'stamina_hud.js 에 스택 칸이 남음');
  assert.ok(!/\.ken-pips|\.hunt-marks|#teamList|stackHud/.test(read('index.html')), 'index.html 에 스택 · 왼쪽 위 체력 목록 꼴이 남음');
  assert.ok(!/createHuntHud|createStackHud|from '\.\/(stack_hud|cn_hunt_hud)\.js'/.test(read('src/main.js')), 'main.js 가 스택 판을 만듦');
});

test('색 넷 — 있는 색에서 끌어냄 (사장님 11/18 둘째 \'채도 낮추면서 지금 컬러칩과 디자인 언어를 맞춰\' — index.html --hp-*)', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const tok = (name) => html.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
  const hex = (v) => parseInt(v.slice(1), 16);
  const A = hexToOklch(hex(tok('c-accent'))), FOE = hexToOklch(hex(tok('foe')));
  assert.equal(tok('hp-yellow'), 'var(--c-accent)', '노랑 = 강조 금색 그대로');
  assert.equal(tok('hp-red'), 'var(--foe)', '빨강 = 상대 색(피 색상) 그대로');
  assert.equal(tok('hp-orange'), oklchToCss(A.map((v, i) => (v + FOE[i]) / 2)), '주황 = 노랑 · 빨강의 OKLCH 가운데');
  const allyC = hexToOklch(BLOOD_RED.splash)[1] * TEAM_FIGHT.hudColor.foeChromaK; // 10/30 아군 체력 막대 녹색의 채도 (= 적 색 채도)
  assert.equal(tok('hp-green'), oklchToCss([0.7, allyC, 145]), '초록 = 10/30 아군 녹색(145° · 적 색 채도) · 밝기 0.70');
  // 채도: 전(0.16 ~ 0.20)보다 낮고 UI 색(강조 0.13 · 상대 0.14) 안 · 넷이 서로 갈림(밝기나 색상이 넉넉히 다름)
  const lch = { green: hexToOklch(hex(tok('hp-green'))), yellow: A, orange: hexToOklch(hex(tok('hp-orange'))), red: FOE };
  for (const [k, [, C]] of Object.entries(lch)) assert.ok(C <= 0.145, `${k} 채도 ${C.toFixed(3)}`);
  const ks = Object.keys(lch);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const [p, q] = [lch[ks[i]], lch[ks[j]]];
    const dh = Math.abs(((p[2] - q[2] + 540) % 360) - 180);
    assert.ok(Math.abs(p[0] - q[0]) >= 0.05 || dh >= 40, `${ks[i]} · ${ks[j]} 가 비슷함`);
  }
});
