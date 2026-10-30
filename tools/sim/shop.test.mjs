// 상점 (사장님 10/30 19:0x — config.js SHOP · src/shop_rules.js · src/shop_panel.js · lobby_progress.js horns · shop · purchase · awardKingHorn)
//  물건 뽑기(등급 무게 · 가진 무기 빼기 · 칸마다 같음) · 값 범위 · 얼터 규칙 · 갱신 칸(한국 시간 4 시간) · 구입 한 번의 저장(금화 · 머리 · 뿔피리) · 왕 뿔피리 · 대사 표
//  node --test tools/sim/shop.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
let writes = 0;
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => { writes++; storage.set(k, v); }, removeItem: (k) => storage.delete(k) };
const { SHOP } = await import('../../src/config.js');
const R = await import('../../src/shop_rules.js');
const P = await import('../../src/lobby_progress.js');
const { ownedWeapons, weaponReceipt } = await import('../../src/owned_weapons.js');
const { LOBBY_ITEMS, readLobbyEquipment, saveLobbyEquipment } = await import('../../src/lobby_equipment.js');
const { WEAPON_LIST, RETIRED_WEAPONS } = await import('../../src/weapons.js');
const T = await import('../../src/shop_text.js');
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');

const fresh = (extra = {}) => { storage.clear(); storage.set(P.PROGRESS_KEY, JSON.stringify({ version: 1, acquisitions: [], coins: 0, heads: 0, ...extra })); };
const tierCount = (items) => items.reduce((m, it) => ((m[it.tier] = (m[it.tier] ?? 0) + 1), m), {});
const H = 3600e3;

test('사장님 값이 config SHOP 에 그대로 (10/30 19:0x) · 본판 기본은 꺼짐', () => {
  assert.equal(SHOP.enabled, false); // 본판 · 시뮬 · 개발 서버 — 시험판 빌드(VITE_SHOP_TEST=1)만 켬
  assert.equal(SHOP.slots, 2);
  assert.deepEqual(SHOP.tierWeights, { common: 60, rare: 25, epic: 10, legend: 5 });
  assert.deepEqual(SHOP.price, { common: { coins: [800, 1000] }, rare: { coins: [1600, 2000] }, epic: { coins: [3300, 3900], horns: [2, 4] }, legend: { coins: [5000, 5800], horns: [3, 7] } });
  assert.equal(SHOP.refreshHours, 4);
  assert.equal(SHOP.alterChance, 0.05);
  assert.deepEqual(SHOP.alterTiers, ['trash', 'mystery']);
  assert.deepEqual(SHOP.alterPrice, { heads: 3 });
  assert.equal(SHOP.hornChance, 0.5);
  // 감독 기본 (사장님 확인 전)
  assert.equal(SHOP.coinStep, 10);
  assert.equal(SHOP.slotTzHours, 9); assert.equal(SHOP.slotStartHour, 0);
  assert.equal(SHOP.redrawEmptyTier, true);
  assert.deepEqual(SHOP.hornKings, ['roland', 'bernardo', 'artoria', 'artoria_mad']);
  for (const id of SHOP.hornKings) assert.ok(CHARACTERS_BY_ID[id], `왕 id ${id} 가 인물 표에 있다`);
  for (const id of ['roland_mad', 'bernardo_mad']) assert.equal(CHARACTERS_BY_ID[id], undefined, `${id} 는 없다 — 그래서 왕 목록에 없음`);
});

test('파는 무기 = 주인공 카드 무기 (복제 엑스칼리버 · 빼 둔 무기 없음)', () => {
  assert.ok(!R.SHOP_POOL.includes('excalibur_replica'));
  for (const id of RETIRED_WEAPONS) assert.ok(!R.SHOP_POOL.includes(id));
  assert.equal(R.SHOP_POOL.length, WEAPON_LIST.length - 1 - RETIRED_WEAPONS.size);
});

test('갱신 칸: 한국 시간 00 · 04 · 08 · 12 · 16 · 20 시 · 칸 안에서는 같은 번호 · 남은 시간', () => {
  const kst = (y, mo, d, h, mi = 0) => Date.UTC(y, mo - 1, d, h - 9, mi);
  for (const h of [0, 4, 8, 12, 16, 20]) {
    const at = kst(2026, 10, 30, h);
    assert.equal(R.slotStart(R.shopSlot(at)), at, `KST ${h} 시가 칸 시작`);
    assert.equal(R.shopSlot(at - 1), R.shopSlot(at) - 1);
    assert.equal(R.shopSlot(at + 4 * H - 1), R.shopSlot(at));
    assert.equal(R.msToNextSlot(at), 4 * H);
  }
  assert.equal(R.msToNextSlot(kst(2026, 10, 30, 19, 5)), 55 * 60e3); // 19:05 → 20:00
  assert.equal(R.shopSlot(kst(2026, 10, 31, 0)) - R.shopSlot(kst(2026, 10, 30, 0)), 6); // 하루 여섯 칸
});

test('물건 뽑기: 같은 씨앗 · 같은 칸 · 같은 가진 무기면 늘 같다 · 칸이나 씨앗이 다르면 바뀐다', () => {
  const owned = [...LOBBY_ITEMS];
  const a = R.rollStock({ seed: 12345, slot: 100, owned }), b = R.rollStock({ seed: 12345, slot: 100, owned });
  assert.deepEqual(a, b);
  let diffSlot = 0, diffSeed = 0;
  for (let s = 0; s < 200; s++) {
    if (JSON.stringify(R.rollStock({ seed: 12345, slot: s, owned }).items) !== JSON.stringify(R.rollStock({ seed: 12345, slot: s + 1, owned }).items)) diffSlot++;
    if (JSON.stringify(R.rollStock({ seed: s, slot: 7, owned }).items) !== JSON.stringify(R.rollStock({ seed: s + 1, slot: 7, owned }).items)) diffSeed++;
  }
  assert.ok(diffSlot > 190 && diffSeed > 190, `${diffSlot} · ${diffSeed}`);
});

test('보통 상인: 등급 무게 60 · 25 · 10 · 5 (첫 물건 · 3 만 칸) · 쓰레기 · ??? 없음 · 두 물건은 서로 다르고 안 가진 무기', () => {
  const owned = [...LOBBY_ITEMS, 'longsword', 'kusanagi', 'flamberge'];
  const first = { common: 0, rare: 0, epic: 0, legend: 0 };
  let n = 0;
  for (let slot = 0; slot < 30000; slot++) {
    const s = R.rollStock({ seed: 777, slot, owned, forceAlter: false });
    assert.equal(s.items.length, 2);
    assert.notEqual(s.items[0].id, s.items[1].id);
    for (const it of s.items) {
      assert.ok(!owned.includes(it.id), `가진 무기 ${it.id} 를 팔지 않는다`);
      assert.ok(['common', 'rare', 'epic', 'legend'].includes(it.tier), it.tier);
      assert.equal(R.tierOf(it.id), it.tier);
    }
    first[s.items[0].tier]++; n++;
  }
  for (const [t, w] of Object.entries(SHOP.tierWeights)) assert.ok(Math.abs(first[t] / n - w / 100) < 0.012, `${t} ${(first[t] / n * 100).toFixed(1)} % (목표 ${w})`);
});

test('등급에 남은 무기가 없으면 남은 등급끼리 다시 뽑는다 (감독 기본) · 다 가지면 물건이 줄고 없으면 빈 목록', () => {
  const commons = R.SHOP_POOL.filter((id) => R.tierOf(id) === 'common');
  const owned = [...LOBBY_ITEMS, ...commons];
  const seen = {};
  for (let slot = 0; slot < 4000; slot++) {
    const s = R.rollStock({ seed: 9, slot, owned, forceAlter: false });
    assert.equal(s.items.length, 2);
    for (const it of s.items) seen[it.tier] = (seen[it.tier] ?? 0) + 1;
  }
  assert.equal(seen.common, undefined);
  const firstRare = seen.rare / (seen.rare + seen.epic + seen.legend); // 첫째 물건만이 아니라 둘 다라 대략 — 레어가 가장 많다
  assert.ok(firstRare > 0.55, String(firstRare));
  // 하나만 남음 → 하나 · 없음 → 빈 목록
  const all = [...LOBBY_ITEMS, ...R.SHOP_POOL];
  const oneLeft = all.filter((id) => id !== 'durandal');
  const s1 = R.rollStock({ seed: 1, slot: 1, owned: oneLeft, forceAlter: false });
  assert.deepEqual(s1.items.map((i) => i.id), ['durandal']);
  assert.deepEqual(R.rollStock({ seed: 1, slot: 1, owned: all, forceAlter: false }).items, []);
});

test('값 범위: 커먼 800~1000 · 레어 1600~2000 · 에픽 3300~3900 + 뿔피리 2~4 · 레전드 5000~5800 + 뿔피리 3~7 · 금화 10 단위 · 양 끝이 나온다', () => {
  const seen = {};
  for (let slot = 0; slot < 40000; slot++) {
    for (const it of R.rollStock({ seed: 4242, slot, owned: LOBBY_ITEMS, forceAlter: false }).items) {
      const p = SHOP.price[it.tier], s = (seen[it.tier] ??= { cMin: Infinity, cMax: -Infinity, hMin: Infinity, hMax: -Infinity });
      assert.ok(it.coins >= p.coins[0] && it.coins <= p.coins[1], `${it.tier} ${it.coins}`);
      assert.equal(it.coins % SHOP.coinStep, 0);
      assert.equal(it.heads, 0);
      if (p.horns) assert.ok(it.horns >= p.horns[0] && it.horns <= p.horns[1], `${it.tier} 뿔피리 ${it.horns}`);
      else assert.equal(it.horns, 0);
      s.cMin = Math.min(s.cMin, it.coins); s.cMax = Math.max(s.cMax, it.coins); s.hMin = Math.min(s.hMin, it.horns); s.hMax = Math.max(s.hMax, it.horns);
    }
  }
  for (const [t, p] of Object.entries(SHOP.price)) {
    assert.equal(seen[t].cMin, p.coins[0], `${t} 금화 아래 끝`); assert.equal(seen[t].cMax, p.coins[1], `${t} 금화 위 끝`);
    if (p.horns) { assert.equal(seen[t].hMin, p.horns[0]); assert.equal(seen[t].hMax, p.horns[1]); }
  }
  // 눈금 1 로 바꾸면 아무 정수 (사장님이 바꾸기 쉬움)
  const odd = new Set();
  for (let i = 0; i < 3000; i++) odd.add(R.rollPrice(R.seededRandom(i, 0), 'common', { ...SHOP, coinStep: 1 }).coins % 10);
  assert.equal(odd.size, 10);
});

test('얼터: 갱신마다 5 % · 쓰레기 · ??? 반반 · 안 가진 무기 · 값 = 머리 3 (금화 · 뿔피리 없음) · 억지로 켜도 뒤 흐름은 같다', () => {
  let alters = 0;
  const tiers = { trash: 0, mystery: 0 };
  const N = 40000;
  for (let slot = 0; slot < N; slot++) {
    const s = R.rollStock({ seed: 31337, slot, owned: LOBBY_ITEMS });
    if (!s.alter) continue;
    alters++;
    assert.equal(s.items.length, 2);
    assert.notEqual(s.items[0].id, s.items[1].id);
    for (const it of s.items) {
      assert.ok(SHOP.alterTiers.includes(it.tier), it.tier);
      assert.ok(!LOBBY_ITEMS.includes(it.id), '시작 무기(나뭇가지 · 드루이드의 채찍)는 팔지 않는다');
      assert.deepEqual({ coins: it.coins, heads: it.heads, horns: it.horns }, { coins: 0, heads: 3, horns: 0 });
    }
    tiers[s.items[0].tier]++;
  }
  assert.ok(Math.abs(alters / N - 0.05) < 0.005, `얼터 ${(alters / N * 100).toFixed(2)} %`);
  assert.ok(Math.abs(tiers.trash / alters - 0.5) < 0.04, `쓰레기 ${(tiers.trash / alters * 100).toFixed(1)} %`);
  // 억지로 켬 · 끔: 얼터 판정 난수는 늘 먼저 하나라 같은 칸이면 같은 흐름 — 억지로 켠 칸 = 확률로 얼터가 된 칸과 같은 물건
  for (let slot = 0; slot < 400; slot++) {
    const s = R.rollStock({ seed: 31337, slot, owned: LOBBY_ITEMS });
    if (s.alter) assert.deepEqual(R.rollStock({ seed: 31337, slot, owned: LOBBY_ITEMS, forceAlter: true }), s);
    else assert.deepEqual(R.rollStock({ seed: 31337, slot, owned: LOBBY_ITEMS, forceAlter: false }), s);
  }
  // 쓰레기를 다 가지면 ??? 만 · 둘 다 다 가지면 빈 목록
  const trash = R.SHOP_POOL.filter((id) => R.tierOf(id) === 'trash');
  const mystery = R.SHOP_POOL.filter((id) => R.tierOf(id) === 'mystery');
  const onlyMystery = R.rollStock({ seed: 5, slot: 5, owned: [...LOBBY_ITEMS, ...trash], forceAlter: true });
  assert.ok(onlyMystery.items.length === 2 && onlyMystery.items.every((i) => i.tier === 'mystery'));
  assert.deepEqual(R.rollStock({ seed: 5, slot: 5, owned: [...LOBBY_ITEMS, ...trash, ...mystery], forceAlter: true }).items, []);
});

test('저장: 뿔피리 · 상점 칸이 금화 · 머리 옆에 남고 옛 저장(뿔피리 없음)은 0 · 같은 칸은 다시 뽑지 않고 칸이 바뀌면 새로 · 씨앗은 하나', () => {
  fresh({ coins: 500, heads: 2 });
  assert.equal(P.readProgress().horns, 0); // 옛 저장
  assert.equal(P.readProgress().shop, null);
  let rolls = 0;
  const roll = (slot) => (seed) => { rolls++; return R.rollStock({ seed, slot, owned: ownedWeapons() }); };
  const valid = (s) => !!R.normalizeShop(s);
  const a = P.ensureShopStock({ slot: 50, roll: roll(50), valid });
  assert.equal(rolls, 1);
  const saved = JSON.parse(storage.get(P.PROGRESS_KEY));
  assert.equal(saved.shop.slot, 50); assert.deepEqual(saved.shop.items, a.items); assert.equal(saved.coins, 500);
  const again = P.ensureShopStock({ slot: 50, roll: roll(50), valid }); // 다시 열기 · 새로고침 = 저장된 칸 그대로
  assert.equal(rolls, 1); assert.deepEqual(again, a);
  const next = P.ensureShopStock({ slot: 51, roll: roll(51), valid });
  assert.equal(rolls, 2); assert.equal(next.seed, a.seed); assert.equal(next.slot, 51);
  assert.deepEqual(next.items, R.rollStock({ seed: a.seed, slot: 51, owned: ownedWeapons() }).items);
  // 시험판 ?shopAlter=1 — 저장된 칸이 보통이면 같은 칸을 얼터로 다시
  const forced = P.ensureShopStock({ slot: 51, roll: (seed) => R.rollStock({ seed, slot: 51, owned: ownedWeapons(), forceAlter: true }), valid, forceAlter: true });
  assert.equal(forced.alter, true); assert.equal(rolls, 2);
  // 깨진 저장 칸(모르는 무기)은 버리고 다시
  const broken = JSON.parse(storage.get(P.PROGRESS_KEY)); broken.shop.items[0].id = 'no_such_sword'; storage.set(P.PROGRESS_KEY, JSON.stringify(broken));
  const healed = P.ensureShopStock({ slot: 51, roll: roll(51), valid });
  assert.equal(rolls, 3); assert.ok(R.normalizeShop(healed));
});

test('구입: 금화 · 머리 · 뿔피리를 내고 무기를 얻는 것이 한 번의 저장 · 모자라면 모자란 재화를 모두 알려 주고 아무것도 안 바뀐다', () => {
  fresh({ coins: 4000, heads: 1, horns: 2 });
  const before = storage.get(P.PROGRESS_KEY);
  const short = P.purchase({ receipt: weaponReceipt('kusanagi'), kind: 'item', price: 5200, heads: 0, horns: 5 });
  assert.deepEqual(short, { ok: false, saved: false, why: 'coins', short: ['coins', 'horns'] });
  assert.equal(storage.get(P.PROGRESS_KEY), before, '모자라면 저장도 안 바뀜');
  assert.deepEqual(P.purchase({ receipt: weaponReceipt('rubber_chicken'), kind: 'item', price: 0, heads: 3 }).short, ['heads']);
  assert.equal(T.shortText(['coins', 'horns']), '금화와 뿔피리가 부족합니다.');
  assert.equal(T.shortText(['heads']), '머리가 부족합니다.');
  assert.equal(T.shortText(['coins']), '금화가 부족합니다.');
  const w0 = writes;
  const ok = P.purchase({ receipt: weaponReceipt('qinggang'), kind: 'item', price: 3500, heads: 0, horns: 2 });
  assert.deepEqual(ok, { ok: true, saved: true, why: null }); // 성공 · 'owned' · 'bad' 의 꼴은 전과 같다(스킬트리 시험이 그대로 봄)
  assert.equal(writes - w0, 1, '저장은 한 번');
  const saved = JSON.parse(storage.get(P.PROGRESS_KEY));
  assert.equal(saved.coins, 500); assert.equal(saved.heads, 1); assert.equal(saved.horns, 0);
  assert.deepEqual(saved.acquisitions.at(-1), { receipt: 'weapon:qinggang', kind: 'item', paid: { coins: 3500, heads: 0, horns: 2 } });
  assert.equal(P.readProgress().level, 2); // 얻은 것 하나 = Lv +1
  assert.deepEqual(P.readProgress().acquisitions.at(-1).paid, { coins: 3500, heads: 0, horns: 2 }); // 읽어도 뿔피리 낸 값이 남음
  assert.equal(P.purchase({ receipt: weaponReceipt('qinggang'), kind: 'item', price: 0 }).why, 'owned');
  // 머리로 사기 (얼터 — 금화 0 · 머리 3)
  P.setHeads(3);
  assert.equal(P.purchase({ receipt: weaponReceipt('pistol'), kind: 'item', price: 0, heads: 3 }).ok, true);
  assert.equal(P.readProgress().heads, 0);
  assert.equal(P.purchase({ receipt: weaponReceipt('morgenstern'), kind: 'item', price: 0, heads: -1 }).why, 'bad');
});

test('산 무기는 가진 무기 · 아이템 칸 장착 · 생사전 셈(ownedWeapons)에 바로 든다 · 안 가진 무기는 걸 수 없다', () => {
  fresh({ coins: 2000 });
  assert.deepEqual(ownedWeapons(), [...LOBBY_ITEMS]);
  assert.equal(saveLobbyEquipment('rapier'), false);
  assert.equal(P.purchase({ receipt: weaponReceipt('rapier'), kind: 'item', price: 900 }).ok, true);
  assert.deepEqual(ownedWeapons(), [...LOBBY_ITEMS, 'rapier']);
  assert.equal(saveLobbyEquipment('rapier'), true);
  assert.equal(readLobbyEquipment(), 'rapier');
  fresh(); // 저장을 지우면 산 무기도 없음 → 장착 기록은 맨손으로
  assert.equal(readLobbyEquipment(), null);
});

test('왕 뿔피리: 왕을 이기고 난수 < 50 % 면 +1 저장 · 아니면 0 · 왕이 아니면 난수도 안 씀 · 시험판 강제 · 뿔피리 값 저장', () => {
  fresh();
  const opts = { kings: SHOP.hornKings, chance: SHOP.hornChance, amount: SHOP.hornAmount };
  assert.equal(P.awardKingHorn('roland', { ...opts, roll: () => 0.49 }), 1);
  assert.equal(P.readProgress().horns, 1);
  assert.equal(JSON.parse(storage.get(P.PROGRESS_KEY)).horns, 1);
  assert.equal(P.awardKingHorn('bernardo', { ...opts, roll: () => 0.5 }), 0);
  assert.equal(P.readProgress().horns, 1);
  let asked = 0;
  assert.equal(P.awardKingHorn('isolde', { ...opts, roll: () => { asked++; return 0; } }), 0);
  assert.equal(asked, 0);
  for (const k of ['artoria', 'artoria_mad']) assert.equal(P.awardKingHorn(k, { ...opts, roll: () => 0 }), 1);
  assert.equal(P.awardKingHorn('isolde', { ...opts, force: true }), 1); // 시험판 ?horn=1
  assert.equal(P.readProgress().horns, 4);
  // 기본 난수(rand01 — crypto)로 대략 반
  let got = 0;
  for (let i = 0; i < 4000; i++) got += P.awardKingHorn('roland', opts);
  assert.ok(Math.abs(got / 4000 - 0.5) < 0.04, String(got / 4000));
  P.setHorns(7); assert.equal(P.readProgress().horns, 7);
  assert.equal(P.setHorns(-1), false);
});

test('상인 대사: 보통 10 · 얼터 10 (사장님 검수 끝) · 장면 글 그대로 · 결과 창 글 · 남은 시간 글', () => {
  assert.equal(T.SHOP_LINES.length, 10);
  assert.equal(T.SHOP_ALTER_LINES.length, 10);
  assert.equal(new Set(T.SHOP_LINES).size, 10);
  assert.equal(T.SHOP_LINES[0], '어서 오너라, 길손이여. 갓 들인 칼이로다.');
  assert.equal(T.SHOP_ALTER_LINES[5], '오호, 뿔피리를 지녔느냐? それなら 말이 다, 다, 違う…달라지노라.');
  assert.equal(T.SHOP_ALTER_LINES[8], '东西은 곧 바뀌느니라. 망설이다간 别人的 칼이 되리라. 되리라. 되ㄹ');
  assert.equal(T.SHOP_ALTER_MOOD, '*크리스테바의 분위기가 이상하다*');
  assert.equal(T.HORN_GAINED_TEXT, '뿔피리를 얻었다.');
  for (const line of [...T.SHOP_LINES, ...T.SHOP_ALTER_LINES]) assert.ok(line.length <= 48, `${line.length} 자 — ${line}`);
  assert.deepEqual(T.SHOP_KEEPER_NAME, { julia: '쥘리아 크리스테바', julia_mad: '광기의 쥘리아 크리스테바' });
  assert.equal(T.leftText(3 * H + 12 * 60e3 + 5e3), '3시간 12분');
  assert.equal(T.leftText(4 * H), '4시간');
  assert.equal(T.leftText(59e3), '1분 미만');
  assert.equal(T.leftText(12 * 60e3), '12분');
});
