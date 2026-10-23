// 방랑 규칙 · 저장 시험 (src/wander_rules.js · src/lobby_progress.js 방랑 몫 — 샛별 저장소 전달본 977c2a43 의 시험을 node:test 로 옮겨 우리 고침까지 더함,
//  docs/import/wander_heroes_import_2026-10-23.md). 저장소는 메모리 흉내(localStorage) — 판을 다시 여는 것은 모듈을 새로 읽어 흉내 낸다.
//  node --test tools/sim/wander.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
let freshId = 0;
const fresh = () => import(`../../src/lobby_progress.js?wander=${freshId++}`); // 새로고침 흉내 (모듈 메모리 비움)
const { WANDER, WANDER_EXCLUSIVE, WANDER_BONUS, WANDER_HEAD, WANDER_NOTICE_TEXT, wanderReward, normalizeWander, chooseWanderEncounter, legacyWanderStages } = await import('../../src/wander_rules.js');
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
  assert.deepEqual(wanderReward(true, 'roland', 12), { coins: 424, heads: 0, bonus: { coins: 400, heads: 0 } }, '롤랑 금화 +400 (사장님 10/24 01:5x — 전 250) · 일반 12 × 2 뒤에 더함');
  assert.deepEqual(wanderReward(true, 'bernardo', 12), { coins: 424, heads: 0, bonus: { coins: 400, heads: 0 } }, '베르나르도 = 롤랑과 같은 몫 (사장님 10/23 저녁 · 10/24 400)');
  assert.deepEqual(wanderReward(true, 'artoria', 12), { coins: 274, heads: 0, bonus: { coins: 250, heads: 0 } }, '아르토리아 금화 +250 (사장님 10/24 01:5x — 전 200)');
  assert.deepEqual(wanderReward(true, 'artoria_mad', 12), { coins: 274, heads: 0, bonus: { coins: 250, heads: 0 } });
  assert.deepEqual(wanderReward(false, 'bernardo', 4), { coins: -4, heads: 0, bonus: { coins: 0, heads: 0 } });
  assert.deepEqual(wanderReward(true, 'white_scale', 12), { coins: 24, heads: 10, bonus: { coins: 0, heads: 10 } }, '백린 머리 +10 (사장님 10/23 저녁)');
  assert.deepEqual(wanderReward(false, 'roland', 3), { coins: -3, heads: 0, bonus: { coins: 0, heads: 0 } }, '지면 특별 몫 없음 · 일반 차감');
  assert.equal(WANDER_HEAD, 2);
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
  assert.deepEqual(p.settleWander(true, () => 10), { coins: 420, heads: 2, bonus: { coins: 400, heads: 0 } }, '롤랑: 10 × 2 + 400 · 참수 머리 2');
  const wallet = p.readProgress();
  p = await fresh();
  assert.equal(p.settleWander(true, () => 10), null, '새로고침 뒤 같은 판을 또 셈하지 않는다');
  assert.equal(p.readProgress().coins, wallet.coins);
  assert.equal(p.readProgress().heads, wallet.heads);
  const second = p.ensureWanderRun(encounter('white_scale'));
  assert.equal(second.id, first.id);
  assert.equal(second.round, 2);
  assert.equal(second.lastWeapon, 'rapier');
  assert.deepEqual(p.settleWander(true, () => 5), { coins: 10, heads: 10, bonus: { coins: 0, heads: 10 } }, '백린 머리 10 은 참수와 무관');
  p.ensureWanderRun(encounter('artoria_mad'));
  assert.equal(p.settleWander(true, () => 15).coins, 280, '광기의 아르토리아 금화 +250 (15 × 2 + 250 — 10/24, 전 200)');
  p.ensureWanderRun(encounter('bernardo'));
  assert.deepEqual(p.settleWander(true, () => 15), { coins: 430, heads: 0, bonus: { coins: 400, heads: 0 } }, '베르나르도 금화 +400 (일반 15 × 2 + 400)');
  p.ensureWanderRun(encounter('white_scale'));
  assert.ok(p.awardWanderHead());
  assert.equal(p.settleWander(true, () => 5).heads, 12, '백린을 베어 이기면 머리 12 (특별 10 + 참수 2)');
  p.ensureWanderRun(encounter('heinrich'));
  assert.equal(p.settleWander(true, () => 15).coins, 30);
  p.ensureWanderRun(encounter('roland'));
  assert.equal(p.settleWander(false, () => 3).coins, -3);
  assert.equal(p.readProgress().wander.run.status, 'lost');
  const again = p.ensureWanderRun(encounter());
  assert.equal(again.round, 1, '진 뒤엔 새 연속');
  assert.notEqual(again.id, first.id);
  p.setCoins(1);
  assert.equal(p.settleWander(false, () => 5).coins, -1, '0 아래로는 안 내려감');
  assert.equal(p.readProgress().coins, 0);
  assert.equal(p.journeyCoins(true, () => 5).delta, 5, '일반 판 보상은 그대로');
});

test('보상 범위: 낮 무대 일반 판(10~30)의 두 배 · 밤 무대(20~60)의 두 배', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich', 'poseidon_night'));
  assert.equal(p.settleWander(true, (lo, hi) => { assert.deepEqual([lo, hi], [20, 60]); return hi; }).coins, 120);
  p.ensureWanderRun(encounter('heinrich', 'poseidon'));
  assert.equal(p.settleWander(true, (lo, hi) => { assert.deepEqual([lo, hi], [10, 30]); return lo; }).coins, 20);
  p.ensureWanderRun(encounter('heinrich', 'castle_night'));
  assert.equal(p.settleWander(false, (lo, hi) => { assert.deepEqual([lo, hi], [2, 10]); return hi; }).coins, -10);
});

test('쓰러뜨린 뒤 벤 목도 센다 (리뷰 2-9 — 여정과 같게): 정산 뒤 참수면 머리 +2 · 판 보상에도 · 두 번은 없음', async () => {
  const p = await reset();
  unlock(p);
  p.ensureWanderRun(encounter('heinrich'));
  const r = p.settleWander(true, () => 10);
  assert.equal(r.heads, 0);
  const heads = p.readProgress().heads;
  assert.ok(p.awardWanderHead());
  assert.equal(p.readProgress().heads, heads + 2);
  assert.equal(p.readProgress().wander.run.reward.heads, 2);
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

test('도중에 그만두기: 기본 끔(일반 여정과 같게 — 처음부터 다시 = 같은 대면 카드부터 · 나가기 = 같은 대면) · 켬이면 싸우던 판을 버리면 패배', async () => {
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
  assert.deepEqual(lost, { coins: -3, heads: 0, bonus: { coins: 0, heads: 0 }, round: 1 });
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
  assert.equal(p.readProgress().coins, 1420);
  assert.equal(p.settleWander(true, () => 10), null);
  assert.equal(p.readProgress().coins, 1420, '옛 지갑을 다시 읽어 또 주지 않는다');
  const buy = p.purchase({ receipt: 'skill:german:footwork', kind: 'skill', price: 100 });
  assert.equal(buy.ok, true);
  assert.equal(buy.saved, false);
  assert.equal(p.readProgress().coins, 1420, '막힌 구매는 다음 읽기에서 되돌아간다(방랑 거래는 남음)');
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

test('방랑 전용 상대 알림 창 (사장님 10/24 01:1x): 대면마다 한 번 — 확인하면 그 판에 남아 처음부터 다시 · 다시 열기에도 안 뜸 · 다음 대면은 새로', async () => {
  let p = await reset();
  unlock(p);
  assert.equal(p.ensureWanderRun(encounter('roland')).encounterSeen, false);
  assert.ok(p.markWanderEncounter());
  assert.ok(!p.markWanderEncounter(), '한 번만 적는다');
  p.resetWanderLoadout(); // 정지 '처음부터 다시'
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
