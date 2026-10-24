// 대기실 고친 것 시험 (docs/import/lobby_fix_2026-10-16.md): 케틀 햇 최대 기력 130 · 이미 받은 인장 → 금화 · 여정 금화 · 머리
//  10/21 스킬북 → 스킬트리: 사기 · 판에서 켜고 끔 · ?uniqueStage 시험은 tools/sim/skill_tree.test.mjs 로 옮김 (src/skill_books.js 지움)
//  10/16 08:1x 인장 없앰(docs/strike/school_kit_map.md §3): 인장 셈은 seal_coins.js 의 얼린 상수 · 깬 수는 journey_save.js 통계
//  node --test tools/sim/lobby_fix.test.mjs   (시뮬 판은 tools/sim/harness_m.mjs — 플래그는 main.js newRound 가 플레이어에게만 거는 것과 같은 자리)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
const { Stamina } = await import('../../src/stamina.js');
const { STAMINA } = await import('../../src/config.js');
const { readProgress, journeyCoins, rollInt, awardHead, JOURNEY_COINS, PROGRESS_KEY, setCoins, setHeads } = await import('../../src/lobby_progress.js');
const { convertSeals, takeSealNotice, sealCount, OLD_SEALS, COINS_PER_SEAL, SEAL_COINS_KEY } = await import('../../src/seal_coins.js');
const { CLEAR_KEY, journeyClears, addJourneyClear } = await import('../../src/journey_save.js');
const { newRound, DT } = await import('./harness_m.mjs');

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
// 새 기기처럼: 저장을 비우고 모듈이 이번 실행 동안 들고 있는 값도 새 값으로 덮는다(저장이 비면 모듈은 지난 값을 그대로 쓰므로)
const reset = () => {
  storage.clear();
  storage.set(PROGRESS_KEY, JSON.stringify({ version: 1, acquisitions: [], coins: 100, heads: 0, titles: [], title: '여행자' }));
  readProgress();
};
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f); f.pos = pos; return f;
}
const tick = (f, seconds, dt = 1 / 120) => { for (let t = 0; t < seconds - 1e-9; t += dt) f.stamina.step(Math.min(dt, seconds - t)); };

// ── 케틀 햇 '생존술: 기력 +30' (사장님 10/16 03:5x) ──
test('케틀 햇: 최대 130에서 시작 · 130까지만 회복 · 문턱 0 / STAMINA.severeAt / STAMINA.floor 그대로 · 막대 = 130의 몫', () => {
  const f = actor(); f.stamina.setMaxBonus(30);
  near(f.stamina.max, 130); near(f.stamina.value, 130); near(f.stamina.ratio, 1);
  f.stamina.spend('attack', 70); near(f.stamina.value, 60); near(f.stamina.ratio, 60 / 130); assert.equal(f.stamina.level, 0);
  tick(f, 10); near(f.stamina.value, 130); // 사람 회복 21/s — 130에서 멈춤
  f.stamina.spend('attack', 130.5); assert.equal(f.stamina.level, 1); // −0.5: 지침
  f.stamina.spend('attack', 40); assert.equal(f.stamina.level, 2); // −40.5: 심한 지침 (severeAt −35 아래)
  f.stamina.spend('attack', 40); assert.equal(f.stamina.exhausted, true); near(f.stamina.value, STAMINA.floor); // −80.5 → floor(−70)에서 멈춤 · 탈진
  const plain = actor(); near(plain.stamina.max, 100); near(plain.stamina.value, 100); // 덧 없는 몸(AI · 그 밖)은 100 그대로
});
test('기력 끔(?stamina=0)이면 덧 없이 100 — 지금 판 그대로', () => {
  try {
    STAMINA.on = false;
    const f = actor(); f.stamina.setMaxBonus(30); near(f.stamina.max, 100); near(f.stamina.value, 100);
    tick(f, 0.5); near(f.stamina.value, 100); near(f.stamina.ratio, 1);
  } finally { STAMINA.on = true; }
});
test('실제 판: 케틀 햇 플레이어는 130까지 회복, 상대는 100', () => {
  const g = newRound({ weapon: 'longsword', seed: 7 });
  try {
    g.ai.update = () => {}; g.player.stamina.setMaxBonus(30);
    for (let i = 0; i < 240; i++) g.step();
    for (const f of [g.player, g.enemy]) { f.stamina.value = 20; f.stamina.rest = 0; }
    for (let i = 0; i < 1200; i++) g.step();
    near(g.player.stamina.value, 130, 1e-5); near(g.enemy.stamina.value, 100, 1e-5);
  } finally { g.world.free(); }
});

// ── 이미 받은 인장 → 금화 (사장님 10/16 04:2x · 08:1x 인장 없앰 — 한 번만) ──
test('인장 → 금화: 한 번만 · 인장 0 = 없음 · 인장 25 = 2,500 · 바꾼 뒤 깬 무대는 안 바꿈 · 옛 셈은 얼린 상수', () => {
  assert.deepEqual(OLD_SEALS, { clearsPerSeal: 10, max: 25 }); assert.equal(Object.isFrozen(OLD_SEALS), true); assert.equal(COINS_PER_SEAL, 100);
  assert.deepEqual([0, 9, 10, 35, 37, 249, 250, 999].map(sealCount), [0, 0, 1, 3, 3, 24, 25, 25]);
  reset(); storage.set(CLEAR_KEY, '0');
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: true }); assert.equal(readProgress().coins, 100);
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); // 기록이 생겼다 — 다시 안 함
  reset(); storage.set(CLEAR_KEY, '250'); // 인장 25
  assert.deepEqual(convertSeals(), { seals: 25, coins: 2500, first: true }); assert.equal(readProgress().coins, 2600);
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 2600); // 새로 고침해도 한 번
  assert.deepEqual(JSON.parse(storage.get(SEAL_COINS_KEY)).converted, 25);
  reset(); storage.set(CLEAR_KEY, '35'); // 인장 3
  assert.equal(convertSeals().coins, 300); assert.equal(readProgress().coins, 400);
  storage.set(CLEAR_KEY, '52'); // 바꾼 뒤에 깬 무대 — 인장이 없으니 그대로
  assert.equal(convertSeals().coins, 0); assert.equal(readProgress().coins, 400);
});
test('이미 바꾼 기록(10/16 04:5x 판이 남긴 꼴)이 있으면 깬 수가 늘어도 다시 안 줌 · 깬 수는 통계로 셈', () => {
  reset(); storage.set(CLEAR_KEY, '120');
  storage.set(SEAL_COINS_KEY, JSON.stringify({ version: 1, converted: 3, at: '2026-10-16' }));
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 100);
  assert.equal(journeyClears(), 120); assert.equal(addJourneyClear(), 121); assert.equal(storage.get(CLEAR_KEY), '121');
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 100);
});

test('바꾼 알림은 한 번: 판을 처음 연 때 바꾸고(어느 길이든) 다음 대기실이 한 번 알림 · 인장 0 · 04:5x 기록은 알림 없음 · 바꾼 뒤 깬 무대는 안 바꿈', () => {
  reset(); storage.set(CLEAR_KEY, '35'); // 인장 3 — 옛 메뉴·주소 판으로 먼저 연 사람 (main.js 가 판을 열 때 바꿈)
  assert.deepEqual(convertSeals(), { seals: 3, coins: 300, first: true }); assert.equal(readProgress().coins, 400);
  assert.equal(JSON.parse(storage.get(SEAL_COINS_KEY)).notice, true);
  addJourneyClear(); addJourneyClear(); assert.equal(journeyClears(), 37); // 그 뒤 주소 판에서 깬 무대 — 금화가 안 된다
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 400);
  assert.deepEqual(takeSealNotice(), { seals: 3, coins: 300 }); // 대기실: 알림 한 번
  assert.equal(takeSealNotice(), null); assert.equal(JSON.parse(storage.get(SEAL_COINS_KEY)).notice, false);
  reset(); storage.set(CLEAR_KEY, '9'); // 인장 0 — 기록만, 알림 없음
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: true }); assert.equal(takeSealNotice(), null);
  storage.set(CLEAR_KEY, '10'); assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(takeSealNotice(), null);
  reset(); storage.set(SEAL_COINS_KEY, JSON.stringify({ version: 1, converted: 3, at: '2026-10-16' })); // 04:5x 판 기록 — 그때 이미 알림을 봄
  assert.equal(takeSealNotice(), null);
});

// ── 여정 금화 · 머리 (사장님 10/16 04:3x) ──
test('판 끝 금화: 낮 · 밤 같음 — 이기면 +10~25 · 지면 −5~10 (정수) · 0 아래로 안 내려감 (사장님 10/24 03:0x — 전 낮 +10~30 / −1~5 · 밤 +20~60 / −2~10)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(JOURNEY_COINS)), { win: [10, 25], loss: [5, 10], night: { win: [10, 25], loss: [5, 10] } });
  reset();
  assert.deepEqual(journeyCoins(true, (lo) => lo).delta, 10); assert.deepEqual(journeyCoins(true, (lo, hi) => hi).delta, 25);
  assert.equal(readProgress().coins, 135);
  assert.equal(journeyCoins(false, (lo, hi) => hi).delta, -10); assert.equal(journeyCoins(false, (lo) => lo).delta, -5); assert.equal(readProgress().coins, 120);
  assert.equal(journeyCoins(true, (lo, hi) => hi, { night: true }).delta, 25); assert.equal(journeyCoins(false, (lo, hi) => hi, { night: true }).delta, -10);
  assert.equal(journeyCoins(true, (lo) => lo, { night: true }).delta, 10); assert.equal(journeyCoins(false, (lo) => lo, { night: true }).delta, -5); assert.equal(readProgress().coins, 140);
  assert.equal(setHeads(77), true); assert.equal(readProgress().heads, 77); assert.equal(setHeads(-1), false); assert.equal(readProgress().heads, 77); setHeads(0); // 시험용 ?heads=N (10/25)
  setCoins(3); assert.equal(journeyCoins(false, (lo, hi) => hi).delta, -3); assert.equal(readProgress().coins, 0); // 바닥 0
  assert.equal(journeyCoins(false, (lo, hi) => hi).delta, 0); assert.equal(readProgress().coins, 0);
  const seen = { win: new Set(), loss: new Set() };
  for (let i = 0; i < 3000; i++) { seen.win.add(rollInt(5, 15)); seen.loss.add(rollInt(1, 5)); }
  assert.deepEqual([...seen.win].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual([...seen.loss].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});
test('머리: 상대의 목을 베면 1 — 한 상대에 한 번 (같은 몸이 두 번 알려도)', () => {
  reset();
  const foe = {}, other = {};
  assert.equal(awardHead(foe), true); assert.equal(awardHead(foe), false); assert.equal(readProgress().heads, 1);
  assert.equal(awardHead(other), true); assert.equal(readProgress().heads, 2);
  assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).heads, 2);
});
test('실제 판: 참수 훅은 판의 상대에게 한 번 — 흙 몸 머리 떨어짐 길로 부른다', async () => {
  const { COMBAT_HOOKS } = await import('../../src/combat.js');
  reset();
  const g = newRound({ weapon: 'longsword', seed: 11 });
  let calls = 0;
  try {
    COMBAT_HOOKS.onDecapitate = (f) => { calls++; if (f === g.enemy) awardHead(f); };
    g.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false });
    g.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); // 두 번째는 decapitate 가 거절(이미 뗌) — 훅도 안 부른다
    assert.equal(calls, 1); assert.equal(g.enemy.decapitated, true); assert.equal(readProgress().heads, 1);
  } finally { COMBAT_HOOKS.onDecapitate = null; g.world.free(); }
});
