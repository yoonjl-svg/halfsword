// 호칭 시험 (사장님 10/24 03:2x ~ 04:2x — src/title_rules.js · src/lobby_progress.js 호칭 몫 · docs/handoff/school_titles_2026-10-24/README.md):
//  유파 계승자 다섯(칸을 모두 익힘 · 닫힌 칸 뺌 · 칸을 산 저장과 같은 저장 · 초기화 뒤에도 남음) · 소드마스터(다섯 호칭 — 따로 얻어도) · 방랑자(방랑이 열림 · 옛 저장 인정) ·
//  왕 시해자(한 번의 방랑에서 아르토리아 · 롤랑 · 베르나르도 — 차례 상관없음 · 광기의 아르토리아 뺌 · 지면 다시) · 정복자(한 번의 방랑에서 30 연승) ·
//  도살자 · 대부호(지금까지 번 머리 100 · 금화 10000 — 싸움 보상만 · 옛 저장 셈 · 새로고침해도 두 번 세지 않음 · 초기화 돌려받기 · ?coins= 는 안 셈) ·
//  알림 한 번(seen) · 옛 저장은 대기실을 열 때(checkTitles) · 내림 상자 · 레벨 +1 · 이름을 바꿔도 저장이 따라감
//  node --test tools/sim/titles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
let blockWrite = false;
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => { if (blockWrite) throw Error('blocked'); storage.set(k, String(v)); },
  removeItem: (k) => storage.delete(k),
};
const P = await import('../../src/lobby_progress.js');
const R = await import('../../src/title_rules.js');
const D = await import('../../src/skill_tree_data.js');
const S = await import('../../src/skill_tree_store.js');
const { STAGE_ORDER } = await import('../../src/stages.js');
const KEY = P.PROGRESS_KEY;
const saved = () => JSON.parse(storage.get(KEY));
const blank = (extra = {}) => ({ version: 1, acquisitions: [], coins: 100000, heads: 1000, titles: [], title: '', earned: { coins: 0, heads: 0 }, ...extra }); // 지갑은 넉넉히 · 번 것 0 (도살자 · 대부호는 따로 시험)
const fresh = (extra) => { blockWrite = false; storage.clear(); storage.set(KEY, JSON.stringify(blank(extra))); P.readProgress(); };
/** 앞 칸 차례대로 — 호칭에 드는 칸(닫힌 칸 뺌) */
function learnOrder(school) {
  const need = R.titleNodes(school), done = new Set(), out = [];
  while (out.length < need.length) {
    const next = D.nodesOf(school).find((n) => need.includes(n.id) && !done.has(n.id) && n.pre.every((p) => done.has(p)));
    assert.ok(next, `${school} 차례가 막힘`);
    done.add(next.id); out.push(next.id);
  }
  return out;
}
const learnAll = (school, upto = Infinity) => { for (const id of learnOrder(school).slice(0, upto)) assert.equal(S.learnNode(school, id).ok, true, `${school} ${id}`); };
const events = () => P.readProgress().titles.map((t) => t.event);
const skillSave = (school) => learnOrder(school).map((id) => ({ receipt: `skill:${school}:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } }));
// 방랑 판 (wander.test.mjs 와 같은 흉내 — 무대 · 무기는 아무것이나)
const enc = (foe) => () => ({ stage: 'poseidon', foe, foeWeapon: 'tizona' });
const unlockWander = () => { for (const s of STAGE_ORDER) P.recordCampaignStage(s, STAGE_ORDER); };
const fight = (foe, win) => { P.ensureWanderRun(enc(foe)); return P.settleWander(win, () => 10); };

test('호칭 표: 유파 다섯 = 비기 원전 책 이름 + 계승자 (04:0x 줄인 이름) · 소드마스터 · 방랑자 · 왕 시해자 · 정복자 · 도살자 · 대부호 · 나무꾼 · 이름은 표 하나', () => {
  assert.deepEqual(R.TITLE_NAMES, {
    'school:german': '캄프페히텐 계승자', 'school:italian': '스케르모 계승자', 'school:iberian': '에스그리마 계승자', 'school:japanese': '오륜서 계승자', 'school:chinese': '무비지 계승자',
    swordmaster: '소드마스터', wander: '방랑자', regicide: '왕 시해자', conqueror: '정복자', butcher: '도살자', tycoon: '대부호', woodcutter: '나무꾼',
  });
  assert.equal(Object.values(R.TITLE_NAMES).includes('여행자'), false, "'여행자'는 호칭이 아님 (10/24)"); assert.equal(R.NO_TITLE_TEXT, '호칭 없음');
  assert.deepEqual(Object.keys(R.TITLE_NAMES).slice(0, 5), D.TREE_SCHOOLS.map((s) => `school:${s}`));
  // 원전 = 그 유파 비기 칸의 출처 줄 책 (skill_tree_data.js NODE_LORE src)
  const book = { german: 'Kampffechten', italian: 'Lo Schermo', iberian: 'Arte de Esgrima', japanese: '오륜서', chinese: '무비지' };
  for (const s of D.TREE_SCHOOLS) assert.match(D.nodesOf(s).find((n) => n.cat === 'secret').src, new RegExp(`『${book[s]}』`), s);
  assert.equal(R.TITLE.countsLevel, true); assert.equal(R.TITLE.conquerWins, 30); assert.equal(R.TITLE.butcherHeads, 100); assert.equal(R.TITLE.tycoonCoins, 10000);
  assert.deepEqual([...R.KING_FOES], ['artoria', 'roland', 'bernardo']);
});

test('유파 호칭: 칸을 모두 익힌 저장에 얻음(칸을 산 저장과 같은 저장) · 하나 모자라면 없음 · 닫힌 칸(일본 J8)은 뺌 · 편지 · 곁가지는 듦', () => {
  fresh();
  assert.deepEqual(R.titleNodes('german'), D.nodesOf('german').map((n) => n.id)); // 독일 11 칸 모두 (편지 G11 포함)
  assert.equal(R.titleNodes('japanese').includes('J8'), false); assert.equal(R.titleNodes('japanese').length, 10);
  assert.ok(R.titleNodes('iberian').includes('B2') && R.titleNodes('chinese').includes('C2')); // 곁가지 보법 II
  const order = learnOrder('german');
  learnAll('german', order.length - 1);
  assert.deepEqual(events(), [], '하나 모자라면 없음');
  assert.equal(P.readProgress().level, 1 + order.length - 1);
  const last = order.at(-1);
  const r = S.learnNode('german', last);
  assert.deepEqual(r, { ok: true, saved: true, why: null });
  const s = saved(); // 같은 저장: 마지막 칸 + 호칭
  assert.ok(s.acquisitions.some((a) => a.receipt === `skill:german:${last}`));
  assert.deepEqual(s.titles, [{ event: 'school:german', name: '캄프페히텐 계승자', seen: false }]);
  assert.equal(P.readProgress().level, 1 + order.length + 1, '호칭 하나 = Lv +1');
  // 일본: 열린 열 칸으로 얻음 (J8 은 살 수 없음)
  learnAll('japanese');
  assert.equal(S.learnNode('japanese', 'J8').why, 'closed');
  assert.deepEqual(events(), ['school:german', 'school:japanese']);
});

test('저장이 막히면 칸도 호칭도 남지 않는다 (반쯤 산 채 없음) · 다시 사면 같이 얻음', () => {
  fresh();
  const order = learnOrder('italian');
  learnAll('italian', order.length - 1);
  const before = storage.get(KEY);
  blockWrite = true;
  assert.equal(S.learnNode('italian', order.at(-1)).saved, false);
  blockWrite = false;
  assert.equal(storage.get(KEY), before);
  assert.deepEqual(events(), []); assert.equal(S.readLearned().italian.has(order.at(-1)), false); // 다음 읽기 = 저장된 값(산 것 · 호칭 모두 전)
  assert.equal(S.learnNode('italian', order.at(-1)).saved, true);
  assert.deepEqual(saved().titles.map((t) => t.event), ['school:italian']);
});

test('얻은 호칭은 유파 초기화 뒤에도 남는다 (칸 · 레벨 몫은 내려감 · 호칭 몫 Lv +1 은 남음) · 다시 다 익혀도 하나', () => {
  fresh();
  learnAll('iberian');
  assert.deepEqual(events(), ['school:iberian']);
  const r = S.resetSchool('iberian');
  assert.equal(r.ok, true);
  const p = P.readProgress();
  assert.deepEqual(p.titles.map((t) => t.name), ['에스그리마 계승자']); assert.equal(p.level, 2); // 1 + 칸 0 + 호칭 1
  assert.deepEqual(P.titleOptions(), ['에스그리마 계승자']);
  learnAll('iberian');
  assert.deepEqual(events(), ['school:iberian']);
});

test('알림은 한 번: 얻은 호칭 = 안 봄(seen false) · 글 · 본 뒤에는 다시 없음 · 저장에 남음', () => {
  fresh();
  learnAll('japanese');
  assert.deepEqual(P.titleNotices(), [{ event: 'school:japanese', name: '오륜서 계승자', why: '일본 유파의 모든 기술을 익혀 오륜서 계승자가 되었습니다.' }]);
  assert.equal(R.TITLE_NOTICE_HEAD, '호칭을 얻었습니다');
  assert.equal(P.markTitleSeen('school:japanese'), true);
  assert.deepEqual(P.titleNotices(), []);
  assert.equal(P.markTitleSeen('school:japanese'), false, '두 번 적지 않음');
  assert.deepEqual(saved().titles, [{ event: 'school:japanese', name: '오륜서 계승자', seen: true }]);
  assert.deepEqual(P.checkTitles(), [], '대기실을 다시 열어도 새로 얻을 것 없음');
  assert.deepEqual(P.titleNotices(), []);
  // 알림 글 (나머지)
  assert.equal(R.titleReason('school:german'), '독일 유파의 모든 기술을 익혀 캄프페히텐 계승자가 되었습니다.');
  assert.equal(R.titleReason('school:chinese'), '동방 유파의 모든 기술을 익혀 무비지 계승자가 되었습니다.');
  assert.equal(R.titleReason('swordmaster'), '다섯 유파의 모든 기술을 익혀 소드마스터가 되었습니다.');
  assert.equal(R.titleReason('wander'), '모든 무대를 깨고 방랑을 열어 방랑자가 되었습니다.');
  assert.equal(R.titleReason('regicide'), '한 번의 방랑에서 아르토리아와 롤랑, 베르나르도를 모두 쓰러뜨려 왕 시해자가 되었습니다.');
  assert.equal(R.titleReason('conqueror'), '한 번의 방랑에서 지지 않고 30번을 내리 이겨 정복자가 되었습니다.');
  assert.equal(R.titleReason('butcher'), '지금까지 머리를 100개 얻어 도살자가 되었습니다.');
  assert.equal(R.titleReason('tycoon'), '지금까지 금화를 10,000 벌어 대부호가 되었습니다.');
  assert.equal(R.titleReason('woodcutter'), '나뭇가지 하나로 왕을 쓰러뜨려 나무꾼이 되었습니다.');
});

test('옛 저장: 이미 칸을 모두 익혔거나 방랑이 열린 저장은 대기실을 열 때(checkTitles) 얻고 알림 한 번 · 그 전에는 저장을 건드리지 않음', () => {
  fresh({ acquisitions: [...skillSave('german'), ...skillSave('chinese'), { receipt: 'drop-1', kind: 'item' }], wander: { cleared: [...STAGE_ORDER], unlocked: true, legacyChecked: true, noticeSeen: true, run: null } });
  const before = storage.get(KEY);
  assert.deepEqual(P.titleNotices(), []); assert.equal(storage.get(KEY), before, '읽기만으로는 저장하지 않음');
  assert.deepEqual(P.checkTitles(), ['school:german', 'school:chinese', 'wander']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['캄프페히텐 계승자', '무비지 계승자', '방랑자']);
  assert.equal(P.readProgress().level, 1 + 11 + 11 + 1 + 3);
  assert.deepEqual(P.checkTitles(), [], '한 번만');
});

test('내림 상자: 호칭이 없으면 빈 목록(여행자 없음) · 처음 얻은 호칭이 저절로 고른 호칭(칸을 산 저장과 같이) · 얻은 차례로 · 고를 수 있음 · 고른 것 저장', () => {
  fresh();
  assert.deepEqual(P.titleOptions(), []); assert.equal(P.readProgress().title, '');
  learnAll('chinese');
  assert.equal(saved().title, '무비지 계승자');
  learnAll('german');
  assert.deepEqual(P.titleOptions(), ['무비지 계승자', '캄프페히텐 계승자']); assert.equal(P.readProgress().title, '무비지 계승자', '둘째 호칭은 고른 것을 바꾸지 않음');
  assert.deepEqual(P.selectTitle('캄프페히텐 계승자'), { ok: true, saved: true });
  assert.equal(saved().title, '캄프페히텐 계승자'); assert.equal(P.readProgress().title, '캄프페히텐 계승자');
  assert.deepEqual(P.selectTitle('오륜서 계승자'), { ok: false, saved: false }, '안 가진 호칭');
  assert.equal(P.unlockEventTitle('school:japanese', '오륜서 계승자'), false, '표 호칭은 조건으로만');
});

test('이름을 표에서 바꾸면 저장된 호칭 · 고른 호칭이 새 이름으로 (사건 열쇠로 읽음)', () => {
  fresh({ titles: [{ event: 'school:italian', name: '로 스케르모 계승자', seen: true }, { event: 'old-event', name: '옛 호칭' }], title: '로 스케르모 계승자' });
  const p = P.readProgress();
  assert.equal(p.title, '스케르모 계승자');
  assert.deepEqual(p.titles, [{ event: 'school:italian', name: '스케르모 계승자', seen: true }, { event: 'old-event', name: '옛 호칭', seen: true }]); // seen 이 없는 옛 줄 = 본 것
  assert.deepEqual(P.titleOptions(), ['스케르모 계승자', '옛 호칭']);
});

test('소드마스터: 유파 호칭 다섯 — 따로따로(초기화하며) 얻어도 · 다섯째 호칭과 같은 저장 · 알림은 다섯째 다음', () => {
  fresh();
  for (const s of D.TREE_SCHOOLS.slice(0, 4)) { learnAll(s); S.resetSchool(s); P.markTitleSeen(`school:${s}`); }
  assert.equal(events().includes('swordmaster'), false);
  learnAll('chinese');
  assert.deepEqual(saved().titles.slice(-2).map((t) => t.event), ['school:chinese', 'swordmaster']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['무비지 계승자', '소드마스터']);
  assert.equal(P.readProgress().level, 1 + 11 + 6);
});

test('방랑자: 30 무대를 처음 다 깬 판의 저장에 같이 · 옛 저장 인정(migrateCampaignStages)도', () => {
  fresh();
  for (const s of STAGE_ORDER.slice(0, -1)) P.recordCampaignStage(s, STAGE_ORDER);
  assert.deepEqual(events(), []);
  assert.equal(P.recordCampaignStage(STAGE_ORDER.at(-1), STAGE_ORDER).opened, true);
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['방랑자']);
  fresh();
  assert.equal(P.migrateCampaignStages('poseidon', STAGE_ORDER.length, STAGE_ORDER), true); // 한 바퀴 돈 옛 저장
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander']);
});

test('정복자: 한 번의 방랑에서 30 연승 — 29 번째엔 없음 · 30 번째 이긴 판 저장에 같이 · 지면 처음부터', () => {
  fresh(); unlockWander(); P.markTitleSeen('wander');
  for (let i = 0; i < 29; i++) fight('heinrich', true);
  assert.equal(P.readProgress().wander.run.wins, 29); assert.equal(events().includes('conqueror'), false);
  fight('heinrich', false); // 지면 그 방랑이 끝남
  for (let i = 0; i < 29; i++) fight('heinrich', true);
  assert.equal(events().includes('conqueror'), false, '진 뒤 새 방랑은 0 부터');
  fight('heinrich', true);
  const s = saved();
  assert.equal(s.wander.run.wins, 30); assert.equal(s.wander.run.status, 'won');
  assert.deepEqual(s.titles.map((t) => t.event), ['wander', 'conqueror']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['정복자']);
  fight('heinrich', true); assert.deepEqual(events(), ['wander', 'conqueror'], '한 번만');
});

test('왕 시해자: 한 번의 방랑에서 아르토리아 · 롤랑 · 베르나르도(차례 상관없음) · 광기의 아르토리아는 셈 밖 · 지면 다시 모음 · 이긴 판 저장에 같이', () => {
  fresh(); unlockWander(); P.markTitleSeen('wander');
  fight('artoria_mad', true); fight('roland', true); fight('bernardo', true);
  assert.equal(events().includes('regicide'), false, '광기의 아르토리아는 아르토리아가 아님');
  fight('artoria', false); // 아르토리아에게 짐 → 이 방랑 끝
  assert.equal(events().includes('regicide'), false);
  fight('artoria', true);
  assert.equal(events().includes('regicide'), false, '새 방랑 — 롤랑 · 베르나르도는 다시');
  fight('bernardo', true); fight('white_scale', true);
  assert.deepEqual(saved().regicide.foes, ['artoria', 'bernardo']);
  fight('roland', true);
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander', 'regicide']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['왕 시해자']);
  // 다른 차례 (롤랑 → 베르나르도 → 아르토리아) · 같은 판에 정복자도 얻으면 둘을 차례로
  fresh(); unlockWander(); P.markTitleSeen('wander');
  fight('roland', true); fight('bernardo', true);
  for (let i = 0; i < 27; i++) fight('heinrich', true);
  assert.deepEqual(events(), ['wander']);
  fight('artoria', true); // 30 번째 승 · 셋째 왕
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander', 'regicide', 'conqueror']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['왕 시해자', '정복자']);
  assert.equal(P.readProgress().level, 1 + 3);
});

// ── 도살자 · 대부호 (사장님 10/24 03:5x — 감독 기본 '지금까지 번 것') ──
const earned = () => P.readProgress().earned;
test('번 것: 옛 저장(earned 없음) = 지금 금화 · 머리 + 칸에 낸 값 · 처음 저장에 한 번 적음 · 그 뒤 쓰거나 돌려받아도 그대로', () => {
  const save = blank({ coins: 700, heads: 4, acquisitions: [{ receipt: 'skill:german:G1', kind: 'skill', paid: { coins: 100, heads: 0 } }, { receipt: 'skill:german:G2', kind: 'skill', paid: { coins: 100, heads: 0 } }, { receipt: 'skill:german:G9', kind: 'skill', paid: { coins: 0, heads: 10 } }, { receipt: 'drop-1', kind: 'item' }] });
  delete save.earned;
  blockWrite = false; storage.clear(); storage.set(KEY, JSON.stringify(save));
  assert.deepEqual(earned(), { coins: 900, heads: 14 });
  assert.equal(saved().earned, undefined, '읽기만으로는 적지 않음');
  assert.equal(S.resetSchool('german').ok, true); // 돌려받기 (금화 200 · 머리 10 — 머리 1 냄) — 번 것 아님
  assert.deepEqual(saved().earned, { coins: 900, heads: 14 }, '처음 저장에 셈한 값을 적음');
  assert.equal(P.readProgress().coins, 900); assert.equal(P.readProgress().heads, 13);
  P.setCoins(50000); // 디자인 보기 주소 ?coins= — 번 것 아님
  assert.deepEqual(earned(), { coins: 900, heads: 14 });
  assert.equal(P.addCoins(400), true); // 인장 바꾸기 — 번 것 아님
  assert.deepEqual(earned(), { coins: 900, heads: 14 });
});
test('번 것은 싸움 보상만 · 그 보상 저장에 같이(새로고침해도 두 번 세지 않음): 여정 이긴 판 금화(진 판 차감은 안 뺌) · 벤 머리 · 방랑 이긴 판 금화 · 특별 머리 · 방랑 머리', () => {
  fresh({ coins: 0, heads: 0 });
  assert.equal(P.journeyCoins(true, () => 20).delta, 20);
  assert.deepEqual(saved().earned, { coins: 20, heads: 0 });
  assert.equal(P.journeyCoins(false, () => 5).delta, -5);
  assert.deepEqual(saved().earned, { coins: 20, heads: 0 }, '진 판은 빼지 않음');
  const foe = {};
  assert.equal(P.awardHead(foe), true); assert.equal(P.awardHead(foe), false);
  assert.deepEqual(saved().earned, { coins: 20, heads: 1 });
  assert.deepEqual(earned(), saved().earned, '다시 읽어도(새로고침) 같은 값');
  unlockWander();
  const r = fight('white_scale', true); // 방랑: 일반 × 2 + 백린 특별 머리
  assert.ok(r.coins > 0 && r.heads > 0, JSON.stringify(r));
  assert.deepEqual(saved().earned, { coins: 20 + r.coins, heads: 1 + r.heads });
  assert.equal(P.awardWanderHead(), true);
  assert.deepEqual(saved().earned, { coins: 20 + r.coins, heads: 1 + r.heads + 2 });
  fight('heinrich', false);
  assert.deepEqual(saved().earned, { coins: 20 + r.coins, heads: 1 + r.heads + 2 }, '방랑 진 판도 빼지 않음');
});
test('도살자 = 번 머리 100 · 대부호 = 번 금화 10000 — 문턱 바로 아래엔 없음 · 그 보상 저장에 같이 · 쓰고 나서도(가진 것이 적어도) 남음 · 옛 저장은 대기실을 열 때', () => {
  fresh({ coins: 0, heads: 0, earned: { coins: 9990, heads: 99 } });
  assert.equal(P.journeyCoins(true, () => 9).delta, 9);
  assert.deepEqual(events(), [], '9999 — 아직');
  P.journeyCoins(true, () => 1);
  assert.deepEqual(saved().titles.map((t) => t.event), ['tycoon']);
  assert.equal(P.awardHead({}), true);
  assert.deepEqual(saved().titles.map((t) => t.event), ['tycoon', 'butcher']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['대부호', '도살자']);
  assert.equal(P.readProgress().level, 3);
  // 옛 저장: 가진 금화 9000 + 칸에 낸 1000 = 10000 → 대기실을 열 때
  const old = blank({ coins: 9000, heads: 0, acquisitions: [{ receipt: 'skill:german:G1', kind: 'skill', paid: { coins: 1000, heads: 0 } }] });
  delete old.earned;
  storage.set(KEY, JSON.stringify(old));
  assert.deepEqual(P.checkTitles(), ['tycoon']);
  assert.deepEqual(saved().earned, { coins: 10000, heads: 0 });
});

// ── 나무꾼 (사장님 10/24 03:5x — 나뭇가지로 왕 하나를 이김 · 광기의 아르토리아 뺌) ──
const fightWith = (foe, weapon, win, { lobby = false } = {}) => {
  P.ensureWanderRun(enc(foe));
  P.saveWanderLoadout(lobby ? { weapon: null, cards: null, lastWeapon: weapon } : { weapon, cards: ['a', 'b'], lastWeapon: weapon }); // 대기실 장착 = 카드 없이(weapon null · lastWeapon) · 카드로 고름 = weapon
  return P.settleWander(win, () => 10);
};
test('나무꾼: 나뭇가지로 아르토리아 · 롤랑 · 베르나르도 중 하나를 이긴 판 저장에 같이 (카드로 고르든 대기실에서 장착하든) · 다른 무기 · 광기의 아르토리아 · 진 판은 아님', () => {
  fresh(); unlockWander(); P.markTitleSeen('wander');
  fightWith('artoria_mad', 'tree_branch', true);
  fightWith('roland', 'longsword', true);
  fightWith('heinrich', 'tree_branch', true);
  fightWith('bernardo', 'tree_branch', false);
  assert.equal(events().includes('woodcutter'), false);
  fightWith('bernardo', 'tree_branch', true, { lobby: true }); // 대기실에서 나뭇가지를 장착하고 카드 없이
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander', 'woodcutter']);
  assert.deepEqual(P.titleNotices().map((n) => n.name), ['나무꾼']);
  fresh(); unlockWander(); P.markTitleSeen('wander');
  fightWith('artoria', 'tree_branch', true); // 카드로 나뭇가지
  assert.deepEqual(saved().titles.map((t) => t.event), ['wander', 'woodcutter']);
  assert.equal(R.playerWeapon({ weapon: null, lastWeapon: 'tree_branch' }), 'tree_branch'); assert.equal(R.playerWeapon({ weapon: 'saber', lastWeapon: 'tree_branch' }), 'saber');
});

// ── 호칭 하나마다 레전드 +0.2 %p · 커먼 −0.2 %p (사장님 10/24 04:0x — 내 카드 뽑기만 · TIER_DRAW 는 그대로) ──
const W = await import('../../src/weapons.js');
const { traditionOf } = await import('../../src/schools.js');
const { LETTER } = await import('../../src/config.js');
const DRAW_POOL = W.WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !W.RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 목록
const mulberry = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const iberianLetter = (id) => D.letterMul(traditionOf(W.getWeapon(id)), new Set(['iberian']));
test('등급 표: k = 0 이면 TIER_DRAW 그대로(같은 난수 → 같은 카드 · 편지 길도) · k = 12 레전드 8.4 · 커먼 37.6 · 나머지 그대로 · 합 100 · TIER_DRAW 는 안 바뀜', () => {
  const base = { ...W.TIER_DRAW };
  assert.deepEqual(base, { common: 40, rare: 26, epic: 18, legend: 6, trash: 4, mystery: 6 });
  assert.equal(R.tierDrawFor(W.TIER_DRAW, 0), W.TIER_DRAW);
  for (let seed = 1; seed <= 300; seed++) {
    for (const weightOf of [null, iberianLetter]) {
      const a = W.drawWeaponCards(DRAW_POOL, 2, { rnd: mulberry(seed), weightOf, exclude: seed % 3 ? null : 'longsword' });
      const b = W.drawWeaponCards(DRAW_POOL, 2, { rnd: mulberry(seed), weightOf, exclude: seed % 3 ? null : 'longsword', tierDraw: R.tierDrawFor(W.TIER_DRAW, 0) });
      assert.deepEqual(b, a, `seed ${seed}`);
    }
  }
  const t12 = R.tierDrawFor(W.TIER_DRAW, 12);
  assert.deepEqual(t12, { common: 37.6, rare: 26, epic: 18, legend: 8.4, trash: 4, mystery: 6 });
  for (const k of [1, 5, 7, 11, 12]) assert.ok(Math.abs(Object.values(R.tierDrawFor(W.TIER_DRAW, k)).reduce((s, v) => s + v, 0) - 100) < 1e-9, `k ${k}`);
  assert.deepEqual(W.TIER_DRAW, base, 'TIER_DRAW 그대로');
  assert.equal(R.tierDrawFor(W.TIER_DRAW, 1).legend, 6.2); assert.equal(R.tierDrawFor(W.TIER_DRAW, 1).common, 39.8);
  // 저장의 호칭 수 = k (레벨 +1 과 같은 셈): 12 개 → 8.4 · 없음 → 기본 표 그대로
  fresh({ titles: Object.entries(R.TITLE_NAMES).map(([event, name]) => ({ event, name, seen: true })) });
  assert.equal(Object.keys(R.TITLE_NAMES).length, 12);
  assert.deepEqual(P.titleTierDraw(W.TIER_DRAW), t12); assert.equal(P.readProgress().level, 13);
  fresh();
  assert.equal(P.titleTierDraw(W.TIER_DRAW), W.TIER_DRAW);
});
test('30 만 번 뽑기: 첫 장이 엑스칼리버(레전드 한 칸)일 확률 — k = 0 · 12, 이베리아 편지 없음 · 있음 (기대값 ± 0.1 %p)', () => {
  const pool = DRAW_POOL.filter((id) => !W.getWeapon(id).characterOnly), groupOf = (id) => W.getWeapon(id).drawGroup || id;
  const slots = {}; for (const id of pool) (slots[W.getWeapon(id).tier] ||= new Set()).add(groupOf(id));
  const expect = (table, weightOf) => { // 칸마다 무게 = 등급 확률 ÷ 그 등급 칸 수 × 편지 배율
    const w = (id) => (table[W.getWeapon(id).tier] ?? 0) / slots[W.getWeapon(id).tier].size * (weightOf ? weightOf(id) : 1);
    const seen = new Set(), all = pool.filter((id) => !seen.has(groupOf(id)) && seen.add(groupOf(id)));
    return w('excalibur') / all.reduce((s, id) => s + w(id), 0);
  };
  const N = 300000, out = {};
  for (const k of [0, 12]) for (const [label, weightOf] of [['편지 없음', null], ['이베리아 편지', iberianLetter]]) {
    const table = R.tierDrawFor(W.TIER_DRAW, k), rnd = mulberry(1000 + k + (weightOf ? 1 : 0));
    let hit = 0;
    for (let i = 0; i < N; i++) if (W.drawWeaponCards(DRAW_POOL, 1, { rnd, weightOf, tierDraw: table })[0] === 'excalibur') hit++;
    const p = hit / N, e = expect(table, weightOf);
    out[`k ${k} · ${label}`] = `${(p * 100).toFixed(3)} % (기대 ${(e * 100).toFixed(3)} %)`;
    assert.ok(Math.abs(p - e) < 0.001, `k ${k} ${label}: ${p} vs ${e}`);
  }
  console.log('# 첫 장 엑스칼리버 (30 만 번):', JSON.stringify(out));
  assert.equal(LETTER.mult, 2);
});
