// 방랑 규칙 · 저장 시험 (src/wander_rules.js · src/lobby_progress.js 방랑 몫 — 샛별 저장소 전달본 977c2a43 의 시험을 node:test 로 옮겨 우리 고침까지 더함,
//  docs/import/wander_heroes_import_2026-10-23.md). 저장소는 메모리 흉내(localStorage) — 판을 다시 여는 것은 모듈을 새로 읽어 흉내 낸다.
//  node --test tools/sim/wander.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
let freshId = 0;
const fresh = () => import(`../../src/lobby_progress.js?wander=${freshId++}`); // 새로고침 흉내 (모듈 메모리 비움)
const { WANDER, WANDER_EXCLUSIVE, WANDER_BONUS, WANDER_BONUS_LABEL, WANDER_COINS, WANDER_STREAK, WANDER_HEAD, WANDER_NOTICE_TEXT, wanderReward, wanderStreakPct, wanderStreakBonus, normalizeWander, chooseWanderEncounter, legacyWanderStages } = await import('../../src/wander_rules.js');
const { STAGE_ORDER } = await import('../../src/stages.js');
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const encounter = (foe = 'roland', stage = 'poseidon') => () => ({ stage, foe, foeWeapon: 'tizona' });
const unlock = (p) => { for (const s of STAGE_ORDER) p.recordCampaignStage(s, STAGE_ORDER); };
const reset = async () => { memory.clear(); return fresh(); };

test('해금: 30 무대를 모두 깨야 열린다 — 같은 무대를 되풀이해 이긴 것은 하나 · 처음 열린 판만 opened', async () => {
  const p = await reset();
  assert.equal(STAGE_ORDER.length, 30);
  assert.equal(p.ensureWanderRun(encounter()), null, '잠겨 있으면 판이 없다');
  for (let n = 0; n < 100; n++) p.recordCampaignStage(STAGE_ORDER[0], STAGE_ORDER);
  assert.equal(p.readProgress().wander.unlocked, false);
  assert.deepEqual(p.recordCampaignStage('darkhall', STAGE_ORDER), { unlocked: false, opened: false }, '여정 밖 무대는 세지 않는다');
  const opened = STAGE_ORDER.slice(1).map((s) => p.recordCampaignStage(s, STAGE_ORDER).opened);
  assert.deepEqual(opened.filter(Boolean).length, 1);
  assert.equal(opened.at(-1), true, '마지막 무대를 깬 판이 처음 연 판');
  assert.equal(p.recordCampaignStage(STAGE_ORDER[3], STAGE_ORDER).opened, false, '한 번 열리면 다시 opened 가 아니다');
  assert.equal((await fresh()).readProgress().wander.unlocked, true, '저장에 남는다');
});

test('옛 저장 인정: 지점 앞 무대 · 한 바퀴(깬 수 ≥ 무대 수 + 지점) · 지점 없으면 증거 없음 · 스위치 끄면 한 바퀴 안 셈', () => {
  const R = STAGE_ORDER, N = R.length;
  assert.deepEqual(legacyWanderStages('castle', 2, R), R.slice(0, 2));
  assert.deepEqual(legacyWanderStages(R.at(-1), N - 1, R), R.slice(0, N - 1));
  assert.deepEqual(legacyWanderStages('poseidon', N, R), R, '한 바퀴 돌아 지점이 1 번 = 모두');
  assert.deepEqual(legacyWanderStages('poseidon', 120, R), R);
  assert.deepEqual(legacyWanderStages('poseidon', N - 1, R), [], '1 번에 29 승은 한 바퀴가 아니다(1 번을 되풀이했을 수 있다)');
  assert.deepEqual(legacyWanderStages(R[5], N + 5, R), R, '한 바퀴 돈 뒤 6 번째까지 온 저장');
  assert.deepEqual(legacyWanderStages(R[5], N + 4, R), R.slice(0, 5));
  assert.deepEqual(legacyWanderStages(R[5], 3, R), [], '깬 수가 지점보다 적으면(옛 판 · 시험 경로) 인정 안 함');
  assert.deepEqual(legacyWanderStages(null, 500, R), [], '지점이 없으면 증거가 없다');
  assert.deepEqual(legacyWanderStages('darkhall', 500, R), []);
  assert.deepEqual(legacyWanderStages('poseidon', 120, R, { loop: false }), [], '스위치 끔 = 전달본 그대로');
  assert.equal(WANDER.legacyLoop, true, '기본 켬 (사장님 18:3x 이미 다 깬 여정도 인정)');
});

test('옛 저장 옮기기: 한 번만 · 한 바퀴 돈 저장은 바로 열림 · 반쯤 온 저장은 남은 무대를 깨면 열림', async () => {
  let p = await reset();
  assert.equal(p.migrateCampaignStages('poseidon', 30, STAGE_ORDER), true);
  assert.equal(p.readProgress().wander.unlocked, true);
  assert.equal(p.migrateCampaignStages('poseidon', 30, STAGE_ORDER), false, '두 번째는 아무 일 없음');
  p = await reset();
  p.migrateCampaignStages(STAGE_ORDER.at(-1), 29, STAGE_ORDER);
  assert.equal(p.readProgress().wander.cleared.length, 29);
  assert.equal(p.readProgress().wander.unlocked, false);
  assert.equal(p.recordCampaignStage(STAGE_ORDER.at(-1), STAGE_ORDER).opened, true);
  p = await reset();
  p.migrateCampaignStages('poseidon', 2, STAGE_ORDER);
  p.migrateCampaignStages('poseidon', 300, STAGE_ORDER);
  assert.equal(p.readProgress().wander.unlocked, false, '처음 본 때의 저장으로 한 번만 판단');
});

test('대면 뽑기: 무대 · 상대를 따로 · 방랑 전용 다섯은 모두 있는 인물 · 특별 몫 표', () => {
  const seq = [0.1, 0.9];
  assert.deepEqual(chooseWanderEncounter(['a', 'b'], ['x', 'y'], () => seq.shift()), { stage: 'a', foe: 'y' });
  assert.deepEqual(chooseWanderEncounter(['a'], ['x'], () => 0.9999999), { stage: 'a', foe: 'x' });
  assert.throws(() => chooseWanderEncounter([], ['x']));
  assert.deepEqual([...WANDER_EXCLUSIVE], ['artoria', 'artoria_mad', 'roland', 'white_scale', 'bernardo']);
  for (const id of WANDER_EXCLUSIVE) assert.ok(CHARACTERS_BY_ID[id], id);
  assert.deepEqual(Object.keys(WANDER_BONUS), ['artoria', 'artoria_mad', 'roland', 'white_scale', 'bernardo']);
  const Z = { coins: 0, heads: 0 };
  assert.deepEqual(wanderReward(true, 'roland', 32), { coins: 232, heads: 0, bonus: { coins: 200, heads: 0 }, streak: 0 }, '롤랑 왕의 금고 +200 (사장님 10/24 02:4x — 전 400) · 판 금화 32 뒤에 더함');
  assert.deepEqual(wanderReward(true, 'bernardo', 32), { coins: 232, heads: 0, bonus: { coins: 200, heads: 0 }, streak: 0 }, '베르나르도 = 롤랑과 같은 몫 (사장님 10/23 저녁 · 10/24 02:4x 200)');
  assert.deepEqual(wanderReward(true, 'artoria', 32), { coins: 132, heads: 0, bonus: { coins: 100, heads: 0 }, streak: 0 }, '아르토리아 왕의 금고 +100 (사장님 10/24 02:4x — 전 250)');
  assert.deepEqual(wanderReward(true, 'artoria_mad', 32), { coins: 132, heads: 0, bonus: { coins: 100, heads: 0 }, streak: 0 });
  assert.deepEqual(wanderReward(true, 'heinrich', 32), { coins: 32, heads: 0, bonus: Z, streak: 0 }, '방랑 전용이 아닌 상대 = 판 금화 그대로');
  assert.deepEqual(wanderReward(false, 'bernardo', 14), { coins: -14, heads: 0, bonus: Z, streak: 0 });
  assert.deepEqual(wanderReward(true, 'white_scale', 32), { coins: 32, heads: 10, bonus: { coins: 0, heads: 10 }, streak: 0 }, '백린 빼앗은 수급 머리 +10 (사장님 10/23 저녁 · 10/24 그대로)');
  assert.deepEqual(wanderReward(false, 'roland', 13, 5), { coins: -13, heads: 0, bonus: Z, streak: 0 }, '지면 특별 몫 · 연승 보너스 없음');
  assert.deepEqual(wanderReward(true, 'roland', 31, 3), { coins: 236, heads: 0, bonus: { coins: 200, heads: 0 }, streak: 5 }, '3승째 롤랑: 31 + 연승 보너스 15 % 올림(4.65) 5 + 왕의 금고 200 (왕의 금고에는 % 를 걸지 않음)');
  assert.deepEqual(JSON.parse(JSON.stringify(WANDER_COINS)), { win: [20, 50], loss: [10, 20] }, '방랑 판 금화 (사장님 10/24 03:0x — 낮 · 밤 같음)');
  assert.equal(WANDER_HEAD, 1, '참수 머리 1 — 여정과 같음 (사장님 10/24 02:4x — 전 2)');
  assert.deepEqual({ ...WANDER_BONUS_LABEL }, { coins: '왕의 금고', heads: '빼앗은 수급', streak: '연승 보너스' }, '보너스 이름 (사장님 10/24 02:4x · 03:0x)');
  assert.match(WANDER_NOTICE_TEXT, /이기면 보상이 두 배입니다/, '알림 글 그대로 — 방랑 +20~50 = 여정 +10~25 의 두 배 (10/24 03:0x)');
  assert.match(WANDER_NOTICE_TEXT, /방랑이 열렸습니다/);
  assert.doesNotMatch(WANDER_NOTICE_TEXT, /\(/, '알림 글에 괄호 없음');
  assert.equal(WANDER_NOTICE_TEXT.split('\n').length, 2, '알림 글 두 문단 (사장님 10/24 — 셋째 문단 뺌)');
  assert.doesNotMatch(WANDER_NOTICE_TEXT, /아르토리아|롤랑|베르나르도|백린/, '방랑 전용 상대 줄 없음 (사장님 10/24)');
});

test('판 저장 · 보상: 다시 열어도 같은 판 · 머리 한 번 · 정산 한 번 · 이긴 뒤 다음 판 · 진 뒤 새 연속', async () => {
  let p = await reset();
  unlock(p);
  const first = p.ensureWanderRun(encounter());
  assert.equal(first.round, 1);
  assert.equal(first.status, 'active');
  p.saveWanderLoadout({ weapon: 'rapier', cards: ['rapier', 'longsword'], lastWeapon: 'rapier' });
  assert.equal(p.ensureWanderRun(() => { throw new Error('진행 중 판을 다시 뽑으면 안 됨'); }).weapon, 'rapier');
  assert.ok(p.awardWanderHead());
  assert.ok(!p.awardWanderHead(), '판마다 한 번');
  assert.deepEqual(p.settleWander(true, () => 30), { coins: 230, heads: 1, bonus: { coins: 200, heads: 0 }, streak: 0 }, '롤랑 1승째: 30 + 왕의 금고 200 · 참수 머리 1 · 연승 보너스 없음');
  const wallet = p.readProgress();
  p = await fresh();
  assert.equal(p.settleWander(true, () => 30), null, '새로고침 뒤 같은 판을 또 셈하지 않는다');
  assert.equal(p.readProgress().coins, wallet.coins);
  assert.equal(p.readProgress().heads, wallet.heads);
  const second = p.ensureWanderRun(encounter('white_scale'));
  assert.equal(second.id, first.id);
  assert.equal(second.round, 2);
  assert.equal(second.lastWeapon, 'rapier');
  assert.deepEqual(p.settleWander(true, () => 25), { coins: 25, heads: 10, bonus: { coins: 0, heads: 10 }, streak: 0 }, '백린 2승째: 빼앗은 수급 머리 10 은 참수와 무관 · 연승 보너스 없음');
  p.ensureWanderRun(encounter('artoria_mad'));
  assert.deepEqual(p.settleWander(true, () => 35), { coins: 141, heads: 0, bonus: { coins: 100, heads: 0 }, streak: 6 }, '광기의 아르토리아 3승째: 35 + 연승 보너스 15 % 올림(5.25) 6 + 왕의 금고 100');
  p.ensureWanderRun(encounter('bernardo'));
  assert.deepEqual(p.settleWander(true, () => 35), { coins: 242, heads: 0, bonus: { coins: 200, heads: 0 }, streak: 7 }, '베르나르도 4승째: 35 + 20 % 7 + 왕의 금고 200');
  p.ensureWanderRun(encounter('white_scale'));
  assert.ok(p.awardWanderHead());
  assert.deepEqual(p.settleWander(true, () => 25), { coins: 32, heads: 11, bonus: { coins: 0, heads: 10 }, streak: 7 }, '백린 5승째를 베어 이기면: 25 + 25 % 올림(6.25) 7 · 머리 11 (빼앗은 수급 10 + 참수 1)');
  p.ensureWanderRun(encounter('heinrich'));
  assert.deepEqual(p.settleWander(true, () => 40), { coins: 52, heads: 0, bonus: { coins: 0, heads: 0 }, streak: 12 }, '일반 상대 6승째: 40 + 30 % 12');
  assert.equal(p.readProgress().wander.run.wins, 6);
  p.ensureWanderRun(encounter('roland'));
  assert.deepEqual(p.settleWander(false, () => 13), { coins: -13, heads: 0, bonus: { coins: 0, heads: 0 }, streak: 0 }, '7번째 판에서 짐: 판 금화만 잃음 · 연승 보너스 없음');
  assert.equal(p.readProgress().wander.run.status, 'lost');
  const again = p.ensureWanderRun(encounter());
  assert.equal(again.round, 1, '진 뒤엔 새 연속');
  assert.notEqual(again.id, first.id);
  p.setCoins(1);
  assert.equal(p.settleWander(false, () => 15).coins, -1, '0 아래로는 안 내려감');
  assert.equal(p.readProgress().coins, 0);
  assert.equal(p.journeyCoins(true, () => 15).delta, 15, '여정 판 보상은 따로');
});

test('보상 범위 (사장님 10/24 03:0x): 방랑 낮 · 밤 무대 모두 이기면 20~50 · 지면 10~20 (전 일반 판 × 2 — 낮 20~60 · 밤 40~120 · 지면 일반 차감)', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich', 'poseidon_night'));
  assert.equal(p.settleWander(true, (lo, hi) => { assert.deepEqual([lo, hi], [20, 50]); return hi; }).coins, 50);
  p.ensureWanderRun(encounter('heinrich', 'poseidon'));
  assert.equal(p.settleWander(true, (lo, hi) => { assert.deepEqual([lo, hi], [20, 50]); return lo; }).coins, 20);
  p.ensureWanderRun(encounter('roland', 'castle_night'));
  assert.equal(p.settleWander(true, (lo, hi) => hi).coins, 258, '밤 무대 롤랑 3승째: 50 + 연승 보너스 15 % 올림(7.5) 8 + 왕의 금고 200');
  p.ensureWanderRun(encounter('heinrich', 'castle_night'));
  assert.equal(p.settleWander(false, (lo, hi) => { assert.deepEqual([lo, hi], [10, 20]); return hi; }).coins, -20);
  p.ensureWanderRun(encounter('heinrich', 'castle'));
  assert.equal(p.settleWander(false, (lo, hi) => { assert.deepEqual([lo, hi], [10, 20]); return lo; }).coins, -10);
});

test('연승 보너스 (사장님 10/24 03:0x · 04:3x — 3승째 +15 % 부터 한 판마다 +5 %p · 그 판 금화에만 · 금화 한 닢 단위로 올림)', async () => {
  assert.deepEqual({ ...WANDER_STREAK }, { from: 3, basePct: 15, stepPct: 5 });
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10, 20, 30].map(wanderStreakPct), [0, 0, 15, 20, 25, 30, 50, 100, 150], '1 · 2승째 0 · 3승째 15 % (04:3x 기본 15 % 시작) · 4승째 20 % … 30승째 150 % · 상한 없음');
  assert.equal(wanderStreakPct(0), 0);
  assert.equal(wanderStreakBonus(1, 50), 0);
  assert.equal(wanderStreakBonus(2, 50), 0);
  assert.equal(wanderStreakBonus(3, 20), 3, '3승째 20 × 15 % = 3 딱 — 소수 오차로 4 가 되지 않음');
  assert.equal(wanderStreakBonus(3, 21), 4, '3승째 21 × 15 % = 3.15 → 올림 4');
  assert.equal(wanderStreakBonus(3, 25), 4, '3.75 → 4');
  assert.equal(wanderStreakBonus(3, 50), 8, '7.5 → 8');
  assert.equal(wanderStreakBonus(4, 20), 4, '4승째 20 × 20 % = 4');
  assert.equal(wanderStreakBonus(4, 21), 5, '4승째 21 × 20 % = 4.2 → 올림 5');
  assert.equal(wanderStreakBonus(5, 40), 10, '5승째 40 × 25 % = 10');
  assert.equal(wanderStreakBonus(30, 20), 30, '30승째 20 × 150 % = 30');
  assert.equal(wanderStreakBonus(30, 21), 32, '30승째 21 × 150 % = 31.5 → 올림 32');
  assert.equal(wanderStreakBonus(30, 50), 75, '30승째 50 × 150 % = 75');
  for (let win = 1; win <= 30; win++) for (let c = 20; c <= 50; c++) {
    const pct = win < 3 ? 0 : 15 + 5 * (win - 3), whole = Math.floor((c * pct) / 100);
    assert.equal(wanderStreakBonus(win, c), (c * pct) % 100 === 0 ? whole : whole + 1, `${win}승째 ${c}`);
  }
  // 저장 판으로: 한 방랑 1 ~ 4승 → 새로고침 → 5승 → 짐 → 새 방랑 1승 (연승 리셋) · 새로고침 뒤 두 번 받지 않음
  let p = await reset();
  unlock(p);
  const got = [];
  for (const foe of ['heinrich', 'heinrich', 'roland', 'heinrich']) {
    p.ensureWanderRun(encounter(foe));
    got.push(p.settleWander(true, () => 21));
  }
  assert.deepEqual(got.map((r) => r.streak), [0, 0, 4, 5], '3승째 21 × 15 % = 3.15 → 4 · 4승째 21 × 20 % = 4.2 → 5');
  assert.deepEqual(got.map((r) => r.coins), [21, 21, 225, 26], '3승째 롤랑 = 21 + 4 + 왕의 금고 200 (왕의 금고에는 % 를 걸지 않음)');
  const coins = p.readProgress().coins;
  assert.equal(p.readProgress().wander.run.reward.streak, 5, '판 보상에 연승 보너스도 남는다 (같은 저장)');
  p = await fresh();
  assert.equal(p.settleWander(true, () => 21), null, '새로고침 뒤 같은 판을 또 셈하지 않는다');
  assert.equal(p.readProgress().coins, coins);
  assert.equal(p.ensureWanderRun(encounter('heinrich')).wins, 4, '다음 판 = 5승째 자리');
  p = await fresh(); // 카드 고르다 새로고침 — 같은 판 · 같은 연승 수
  assert.equal(p.ensureWanderRun(() => { throw new Error('진행 중 판을 다시 뽑으면 안 됨'); }).wins, 4);
  assert.equal(p.settleWander(true, () => 40).streak, 10, '5승째 40 × 25 %');
  p.ensureWanderRun(encounter('heinrich'));
  assert.equal(p.settleWander(false, () => 10).streak, 0);
  const next = p.ensureWanderRun(encounter('heinrich'));
  assert.equal(next.wins, 0, '진 뒤 새 방랑 — 연승 0 부터');
  assert.equal(p.settleWander(true, () => 21).streak, 0, '새 방랑 1승째는 보너스 없음');
});

test('쓰러뜨린 뒤 벤 목도 센다 (리뷰 2-9 — 여정과 같게): 정산 뒤 참수면 머리 +1 · 판 보상에도 · 두 번은 없음', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich'));
  const r = p.settleWander(true, () => 10);
  assert.equal(r.heads, 0);
  const heads = p.readProgress().heads;
  assert.ok(p.awardWanderHead());
  assert.equal(p.readProgress().heads, heads + 1);
  assert.equal(p.readProgress().wander.run.reward.heads, 1);
  assert.ok(!p.awardWanderHead());
  assert.ok(!(await fresh()).awardWanderHead(), '새로고침 뒤에도 한 번');
});

test('무효 판 (리뷰 2-3): 진행 중 판의 상대 · 무대가 지금 목록에 없으면 그 대면만 다시 뽑는다 — 연속 · 판 번호 그대로', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich'));
  p.settleWander(true, () => 10);
  p.ensureWanderRun(() => ({ stage: 'poseidon', foe: 'sebastian', foeWeapon: 'tizona' })); // 옛 id 로 저장된 판
  const old = p.readProgress().wander.run;
  assert.equal(old.round, 2);
  const valid = (run) => !!CHARACTERS_BY_ID[run.foe];
  const fixed = p.ensureWanderRun(encounter('roland', 'castle'), valid);
  assert.equal(fixed.foe, 'roland');
  assert.equal(fixed.stage, 'castle');
  assert.equal(fixed.round, 2);
  assert.equal(fixed.id, old.id);
  assert.equal(fixed.status, 'active');
  assert.equal(p.ensureWanderRun(() => { throw new Error('고친 판은 그대로'); }, valid).foe, 'roland');
});

test('도중에 그만두기: 기본 끔(일반 여정과 같게 — 정지 창 재대결 = 같은 대면 카드부터 · 나가기 = 같은 대면) · 켬이면 싸우던 판을 버리면 패배', async () => {
  assert.equal(WANDER.quitAsLoss, false, '기본 끔 (사장님 18:5x 언제든 들어가는 자유 무대 — 감독 판단)');
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich'));
  p.saveWanderLoadout({ weapon: 'rapier', cards: ['rapier', 'longsword'], lastWeapon: null });
  const coins = p.readProgress().coins;
  assert.ok(p.resetWanderLoadout());
  const run = p.readProgress().wander.run;
  assert.equal(run.weapon, null);
  assert.equal(run.cards, null);
  assert.equal(run.foe, 'heinrich', '같은 상대');
  assert.equal(p.readProgress().coins, coins, '금화 그대로');
  assert.equal(p.settleAbandonedWander(() => 3), null, '싸움 표시가 없으면 버린 판이 아니다');
  // 켬: 싸움을 시작한 표시 → 새로고침(모듈 새로) → 패배로 셈
  assert.ok(p.markWanderFighting(true));
  const q = await fresh();
  const lost = q.settleAbandonedWander(() => 3);
  assert.deepEqual(lost, { coins: -3, heads: 0, bonus: { coins: 0, heads: 0 }, streak: 0, round: 1 });
  assert.equal(q.readProgress().wander.run.status, 'lost');
  assert.equal(q.readProgress().coins, coins - 3);
  assert.equal(q.settleAbandonedWander(() => 3), null, '한 번만');
  // 정산이 끝나면 싸움 표시는 지워진다
  q.ensureWanderRun(encounter('heinrich'));
  q.markWanderFighting(true);
  q.settleWander(true, () => 10);
  assert.equal(q.readProgress().wander.run.fighting, false);
});

test('저장 실패: 방랑 거래는 이번 실행 동안 지킨다(보상 두 번 없음) · 다른 거래는 전처럼 옛 값으로 (리뷰 2-8) · 바깥에서 바꾸면 버린다', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter());
  p.setCoins(1000);
  const realSet = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  p.settleWander(true, () => 10);
  assert.equal(p.readProgress().coins, 1210, '1000 + 롤랑 10 + 왕의 금고 200');
  assert.equal(p.settleWander(true, () => 10), null);
  assert.equal(p.readProgress().coins, 1210, '옛 지갑을 다시 읽어 또 주지 않는다');
  const buy = p.purchase({ receipt: 'skill:german:footwork', kind: 'skill', price: 100 });
  assert.equal(buy.ok, true);
  assert.equal(buy.saved, false);
  assert.equal(p.readProgress().coins, 1210, '막힌 구매는 다음 읽기에서 되돌아간다(방랑 거래는 남음)');
  assert.ok(!p.readProgress().acquisitions.some((a) => a.receipt === 'skill:german:footwork'));
  localStorage.setItem = realSet;
  // 바깥 교체(?coins= 같은) — 저장소 글이 바뀌면 메모리 보관을 버린다
  localStorage.setItem = () => { throw new Error('quota'); };
  p.ensureWanderRun(encounter());
  localStorage.setItem = realSet;
  localStorage.setItem(p.PROGRESS_KEY, JSON.stringify({ version: 1, coins: 123, heads: 7, acquisitions: [], titles: [], title: '여행자' }));
  assert.equal(p.readProgress().coins, 123);
  assert.equal(p.readProgress().wander.run, null);
});

test('다른 저장과 함께: 스킬트리 거래 · 구매가 방랑 칸을 지키고 방랑 거래가 스킬트리 칸을 지킨다', async () => {
  let p = await reset();
  unlock(p);
  assert.ok(p.purchase({ receipt: 'skill:german:1', kind: 'skill', price: 0 }).ok);
  assert.ok(p.readProgress().wander.unlocked);
  p.update((d) => {
    d.tree = { v: 1, at: '2026-10-23', books: 3, coins: 100, heads: 0, bonus: 0, notice: true };
    d.acquisitions.push({ receipt: 'skill:german:footwork', kind: 'skill', paid: { coins: 15, heads: 0 } });
    return true;
  });
  p.ensureWanderRun(encounter());
  p.settleWander(true, () => 10);
  p = await fresh();
  assert.equal(p.readProgress().tree.books, 3);
  assert.ok(p.readProgress().acquisitions.some((a) => a.receipt === 'skill:german:footwork'));
  assert.ok(p.readProgress().wander.unlocked);
  assert.equal(p.readProgress().wander.run.status, 'won');
});

test('방랑 알림 창: 열린 뒤 한 번 — 확인하면 저장에 남아 다시 안 뜬다', async () => {
  let p = await reset();
  assert.equal(p.wanderNoticeDue(), false, '잠겨 있으면 안 뜸');
  unlock(p);
  assert.equal(p.wanderNoticeDue(), true);
  assert.ok(p.markWanderNotice());
  assert.equal(p.wanderNoticeDue(), false);
  p = await fresh();
  assert.equal(p.wanderNoticeDue(), false);
  assert.equal(p.readProgress().wander.noticeSeen, true);
});

test('방랑 전용 상대 알림 창 (사장님 10/24 01:1x): 대면마다 한 번 — 확인하면 그 판에 남아 재대결 · 다시 열기에도 안 뜸 · 다음 대면은 새로', async () => {
  let p = await reset();
  unlock(p);
  assert.equal(p.ensureWanderRun(encounter('roland')).encounterSeen, false);
  assert.ok(p.markWanderEncounter());
  assert.ok(!p.markWanderEncounter(), '한 번만 적는다');
  p.resetWanderLoadout(); // 정지 '재대결'
  p = await fresh(); // 새로고침 · 대기실 → '방랑 이어가기'
  assert.equal(p.ensureWanderRun(() => { throw new Error('진행 중 판을 다시 뽑으면 안 됨'); }).encounterSeen, true, '같은 대면은 다시 안 뜬다');
  p.settleWander(true, () => 10);
  assert.equal(p.ensureWanderRun(encounter('bernardo')).encounterSeen, false, '다음 대면은 새로');
  assert.equal(normalizeWander({ run: { ...p.readProgress().wander.run, encounterSeen: 'yes' } }).run.encounterSeen, true);
  assert.equal(normalizeWander({ run: { ...p.readProgress().wander.run, encounterSeen: undefined } }).run.encounterSeen, false, '옛 저장(칸 없음) = 안 봄');
});

test('아르토리아 방랑 전용 (사장님 10/23 18:3x): 대성당 · 밤의 대성당 후보 없음 · 무작위 상대에 방랑 전용 없음', async () => {
  const { STAGE_FOE_EXTRA, stageFoeId } = await import('../../src/stages.js');
  const { randomCharacter } = await import('../../src/characters.js');
  assert.deepEqual(STAGE_FOE_EXTRA, {});
  assert.equal(stageFoeId('cathedral', 'artoria'), 'margarethe', '저장된 상대가 아르토리아여도 마르그레테');
  assert.equal(stageFoeId('cathedral_night', 'artoria_mad'), 'margarethe_mad');
  for (let n = 0; n < 300; n++) assert.ok(!WANDER_EXCLUSIVE.includes(randomCharacter().id));
  for (let n = 0; n < 50; n++) assert.notEqual(randomCharacter('heinrich').id, 'heinrich');
});

test('칭호 왕 (사장님 10/24 02:4x \'셋 다 칭호는 왕으로 해\'): 아르토리아 · 광기의 아르토리아(아르토리아 시트를 복사) · 롤랑 · 베르나르도', () => {
  for (const id of ['artoria', 'artoria_mad', 'roland', 'bernardo']) assert.equal(CHARACTERS_BY_ID[id].epithet, '왕', id);
  assert.equal(CHARACTERS_BY_ID.white_scale.epithet, '초원의 검객', '백린의 전사는 그대로');
});

test('저장 칸 거르기: 모양이 틀린 판은 버리고 나머지는 지킨다', () => {
  assert.deepEqual(normalizeWander(null), { cleared: [], unlocked: false, legacyChecked: false, noticeSeen: false, run: null });
  const w = normalizeWander({ cleared: ['poseidon', 'poseidon', 'X!', 3], unlocked: true, noticeSeen: true, run: { id: 'a', round: 0, wins: 0, stage: 'poseidon', foe: 'roland', foeWeapon: 'tizona', status: 'active' } });
  assert.deepEqual(w.cleared, ['poseidon']);
  assert.equal(w.unlocked, true);
  assert.equal(w.noticeSeen, true);
  assert.equal(w.run, null, '판 번호 0 은 틀림');
  const ok = normalizeWander({ run: { id: 'a', round: 1, wins: 0, stage: 'poseidon', foe: 'roland', foeWeapon: 'tizona', status: 'won', cards: ['rapier', 'longsword'] } });
  assert.equal(ok.run.headTaken, false);
  assert.equal(ok.run.fighting, false);
});

test('몸 상태 이어받기 (사장님 10/30 01:1x · 08:2x \'둘 다 켜\' — WANDER.resumeState 기본 켬): 진행 중 판에 사본 · 새로고침에도 남음 · 정산 · 재대결에 지움 · 끝난 판엔 안 적음', async () => {
  assert.equal(WANDER.resumeState, true, '기본 켬 (주소 ?wanderResume=0 = 전 판)');
  let p = await reset();
  unlock(p);
  assert.equal(p.saveWanderResume({ v: 1 }), false, '판이 없으면 안 적음');
  p.ensureWanderRun(encounter());
  const R = { v: 1, foe: 'roland', foeWeapon: 'tizona', player: { v: 1, blood: 0.8, wounds: [{ part: 'thighF', type: 'cut', severity: 0.4, bleed: 0.01, local: [0, 0, 0] }] }, enemy: { v: 1, blood: 1, wounds: [] } };
  assert.ok(p.saveWanderResume(R));
  p = await fresh();
  assert.deepEqual(p.ensureWanderRun(() => { throw new Error('진행 중 판을 다시 뽑으면 안 됨'); }).resume, R, '새로고침 · 앱을 다시 켜도 그 몸');
  p.resetWanderLoadout();
  assert.equal(p.readProgress().wander.run.resume, undefined, '재대결 = 처음 몸');
  p.saveWanderResume(R);
  p.saveWanderResume(null);
  assert.equal(p.readProgress().wander.run.resume, undefined, 'null = 지움');
  p.saveWanderResume(R);
  p.settleWander(true, () => 30);
  assert.equal(p.readProgress().wander.run.resume, undefined, '끝난 판은 이어받을 몸이 없다');
  assert.equal(p.saveWanderResume(R), false, '끝난 판엔 안 적음');
  assert.equal(p.ensureWanderRun(encounter('heinrich')).resume, undefined, '다음 판은 처음 몸');
});

test('몸 사본 (src/fight_snapshot.js): 셈 칸만 · 값 묶음 · 무기가 다르면 부러짐은 안 옮김 · 남은 부활은 줄기만', async () => {
  const { snapshotFighter, applyFighterSnapshot } = await import('../../src/fight_snapshot.js');
  const body = (over = {}) => ({ weapon: { id: 'longsword', fragile: true }, blood: 1, bleed: 0, consciousness: 1, pain: 0, limbs: { armS: 1, armO: 1, legF: 1, legB: 1 }, wounds: [], weaponBroken: false, stamina: { value: 100, max: 130 }, secretUsed: 0, revive: { left: 1 }, armed: true,
    breakWeapon() { this.weaponBroken = true; }, dropSword() { this.armed = false; }, ...over });
  const a = body({ blood: 0.71, bleed: 0.02, pain: 0.4, limbs: { armS: 0.9, armO: 0.5, legF: 1, legB: 0.8 }, wounds: [{ part: 'uarmO', type: 'cut', severity: 0.5, bleed: 0.01, local: { x: 0.1, y: 0.2, z: 0.3 } }], weaponBroken: true, stamina: { value: 42, max: 130 }, secretUsed: 1, revive: { left: 0 } });
  const s = JSON.parse(JSON.stringify(snapshotFighter(a)));
  const b = body();
  assert.ok(applyFighterSnapshot(b, s));
  assert.deepEqual([b.blood, b.bleed, b.pain, b.limbs.armO, b.limbs.legB, b.wounds.length, b.wounds[0].part, b.wounds[0].local.y, b.weaponBroken, b.stamina.value, b.secretUsed, b.revive.left, b.armed], [0.71, 0.02, 0.4, 0.5, 0.8, 1, 'uarmO', 0.2, true, 42, 1, 0, true]);
  const c = body({ weapon: { id: 'rapier', fragile: true } });
  applyFighterSnapshot(c, s);
  assert.equal(c.weaponBroken, false, '대기실에서 무기를 바꿨으면 부러짐은 안 옮김');
  const d = body({ revive: { left: 0 } });
  applyFighterSnapshot(d, { ...s, reviveLeft: 3, blood: 7, stamina: 999 });
  assert.deepEqual([d.revive.left, d.blood, d.stamina.value], [0, 1, 130], '부활은 늘지 않음 · 피 0 ~ 1 · 기력은 최대까지');
  const e = body();
  applyFighterSnapshot(e, { ...s, limbs: { ...s.limbs, armS: 0.05 } });
  assert.equal(e.armed, false, '칼 쥔 팔이 문턱 밑이면 칼을 놓친 채');
  assert.equal(applyFighterSnapshot(body(), { v: 2 }), false, '모르는 꼴은 안 입힘');
});
