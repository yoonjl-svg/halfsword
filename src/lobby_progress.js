// 대기실 레벨·호칭·금화·머리 (샛별 저장소 3b280a1b): 레벨 = 1 + 얻은 물건 · 익힌 스킬 칸 수(10/21 — 전: 물건 · 스킬북) + 얻은 호칭 수(10/24 사장님 '호칭 하나마다 레벨+1 해' —
//  title_rules.js TITLE.countsLevel). 시작 지급품(나뭇가지 · 방어구 kettle)은 세지 않는다.
// 전리품/구매가 생기면 획득 사건마다 고유 receipt 를 넘긴다. 같은 사건을 재처리해도 중복 상승하지 않으며, 장착/해제는 레벨에 영향이 없다.
// 10/16 (docs/import/lobby_fix_2026-10-16.md §6): 스킬북을 금화로 샀다(purchase — 사장님 04:1x '금화나 머리를 얻으면 교환해서 개방') · 산 책은 receipt 'skillbook:<유파>:<급>' 으로
//  acquisitions 에 남았다(10/21 스킬트리로 바뀜 — 아래) · 이미 받은 인장을 금화로(seal_coins.js addCoins).
//  금화 벌기 (사장님 결정 04:3x '승리시 랜덤으로 벌어. 5~15원 중 랜덤. 패배시 1~5원 감소'): 첫 화면·대기실 여정의 판 끝마다 journeyCoins — 0 아래로는 안 내려간다.
//  머리 (사장님 결정 04:3x '적의 머리를 베면 1개씩 주는 재화'): 같은 여정에서 상대의 목을 베면 1 (main.js — COMBAT_HOOKS.onDecapitate · 한 상대에 한 번, awardHead).
//   머리로 사는 것 (10/21 스킬트리 — 사장님 19:0x): 패시브 칸 머리 5 · 비기 칸 금화 400 + 머리 10(10/25 01:5x 사장님 — 전 10 · 20) · 유파 초기화 머리 1 (skill_tree_store.js). 디자인 보기용 주소 `?coins=N`(game_entry.js setCoins) · 시험용 `?heads=N`(setHeads).
//  10/21 스킬트리 (docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md): 익힌 칸은 receipt 'skill:<유파>:<칸 id>' · kind 'skill' · paid { coins, heads }(낸 값 — 초기화 때 그대로 돌려줌)로
//   acquisitions 에 남는다(값과 같은 저장 — 반쯤 산 채로 남지 않음). 옛 스킬북('skillbook:<유파>:<급>')은 옮기기(skill_tree_store.js migrateSkillBooks)가 한 번의 저장으로 거두고 돌려준다 —
//   그 기록 = tree { v, at, books, coins, heads, bonus, notice }(이 저장 안 — 금화와 같은 저장이라 '금화만 받고 기록이 없음' · '기록만 있고 금화가 없음'이 생기지 않는다). update = 그 한 번의 저장 틀.
//  호칭 (사장님 10/16 15:3x ⑥ "호칭 시스템을 나중에 추가할 거라서 '여행자'는 내림박스 같은 기능을 만들어서 호칭 선택할 수 있게 해" · 16:0x "… 이미 가진 호칭인 여행자가 보이고"
//   — docs/import/ui_unify_2026-10-16.md §5): 얻은 호칭은 titles { event, name, seen } · 고른 호칭은 title(selectTitle) · (10/16 ~ 10/23 기본 호칭 '여행자' — 10/24 뺌, 아래).
//  10/24 호칭 (사장님 03:2x ~ 04:2x — title_rules.js · docs/handoff/school_titles_2026-10-24/README.md): 유파 계승자 다섯 · 소드마스터 · 방랑자 · 왕 시해자 · 정복자 · 도살자 · 대부호 · 나무꾼.
//   '여행자'는 호칭이 아니다(사장님 10/24 — 전 기본 호칭 DEFAULT_TITLE 은 지움): 호칭이 없으면 title = ''(대기실 '호칭 없음') · 처음 얻은 호칭이 저절로 고른 호칭 ·
//   저장된 고름이 가진 호칭이 아니면(옛 '여행자' 포함) 가진 호칭의 첫째 · 없으면 ''.
//   얻는 조건은 title_rules.js dueTitles 한 곳 — 저장할 때마다(save) 맞춰 그 거래와 같은 저장에 들어간다(칸을 산 저장 · 방랑이 열린 저장 · 이긴 판 저장 — 반쯤 남지 않음).
//   대기실을 열 때 한 번 더(checkTitles — 이미 조건을 채운 옛 저장). 얻은 호칭은 잃지 않는다(유파 초기화 · 방랑 패배 뒤에도) · seen = 알림 창을 봤나(titleNotices · markTitleSeen).
//   이름은 사건 열쇠로 표에서 읽는다(표 이름을 바꾸면 저장된 호칭 · 고른 호칭도 새 이름). 왕 시해자 기록 regicide { run, foes } = 이번 방랑(run.id)에서 이긴 왕(같은 저장 — 방랑 칸 밖에 둠).
//   번 것 earned { coins, heads } (도살자 · 대부호 — 감독 기본 '가진 것'이 아니라 '번 것'): 싸움 보상만(여정 이긴 판 금화 · 방랑 이긴 판 금화(특별 몫 포함) · 벤 머리 · 방랑 특별 머리) —
//    보상을 주는 그 저장에서 더한다(noteEarned — 새로고침해도 두 번 세지 않음). 초기화 돌려받기 · `?coins=` · 테스트 경로 · 인장 바꾸기는 세지 않는다.
//    옛 저장(earned 가 없음)은 처음 읽을 때 지금 금화 · 머리 + 칸 · 물건에 낸 값으로 셈해 두고 다음 저장에 한 번 적는다(earnedSeed).
//  10/23 방랑 (wander_rules.js — 샛별 저장소 전달본 977c2a43, docs/import/wander_heroes_import_2026-10-23.md): 같은 저장에 wander 칸(깬 무대 · 열림 · 알림 창 · 지금 판)을 더했다 —
//   판 결과와 보상을 한 번의 저장에 같이 써서 새로고침 · 대기실 왕복 · 다시 열기로 같은 보상을 두 번 받지 않는다. 옛 판(wander 를 모르는 판)으로 되돌리면 이 칸은 버려진다(금화 · 머리는 남음).
//   저장이 막히면 방랑 거래만 이번 실행 메모리에 남긴다(pendingSave — 옛 지갑을 다시 읽어 같은 보상을 또 주지 않게). 다른 거래는 전처럼 '실패하면 다음 읽기에서 옛 값'.
//  10/30 상점 (사장님 19:0x — config.js SHOP · shop_rules.js · shop_panel.js): 새 재화 뿔피리 horns(금화 · 머리 옆 — 왕을 이긴 판에서 awardKingHorn) · 상점 칸 shop { v, seed, slot, alter, items }
//   (뽑은 물건 — ensureShopStock · 같은 칸 동안 그대로 · rerolls = 이 칸에서 머리로 다시 들인 수 — rerollShopStock, 10/31). 무기를 사면 purchase 가 금화 · 머리 · 뿔피리 · 얻은 것(receipt 'weapon:<id>' — owned_weapons.js)을 한 번에 저장.
//   이 모듈은 첫 화면 묶음에 들어 무기 표(weapons.js — three)를 읽지 않는다: 물건 뽑기 · 무기 맞춤은 부르는 쪽(shop_panel.js)이 넘긴다. 뿔피리는 '번 것'(earned)에 세지 않는다(쓰는 호칭이 없음)
import { normalizeWander, wanderReward, WANDER_HEAD, WANDER_COINS, legacyWanderStages } from './wander_rules.js';
import { TITLE, TITLE_NAMES, titleName, titleReason, dueTitles, noteKing, regicideOf, tierDrawFor } from './title_rules.js';
export const PROGRESS_KEY = 'stillness.lobby.progress.v1';
/** 얻은 것 갈래: item 물건 · skill 스킬트리 칸(10/21) · skillbook 옛 스킬북(읽기만 — 옮기기가 거둔다) */
export const ACQ_KINDS = Object.freeze(['item', 'skill', 'skillbook']);
let session = { acquisitions: [], coins: 100, heads: 0, horns: 0, titles: [], title: '', tree: null, wander: normalizeWander(null), regicide: null, earned: { coins: 0, heads: 0 }, shop: null };
// 저장이 막혔을 때 이번 실행 동안 지킬 방랑 거래(저장하려던 글 · 그때 저장소에 있던 글 · 그 저장소). 저장소 글이 바뀌면(?coins= · 바깥에서 바꿈) 버린다
let pendingSave = null, pendingBase = null, pendingStore = null;
const validText = s => typeof s === 'string' && s.length > 0 && s.length <= 160;
const count = n => Number.isSafeInteger(n) && n >= 0;
const paidOf = p => (p && count(p.coins) && count(p.heads) ? { coins: p.coins, heads: p.heads, ...(count(p.horns) && p.horns ? { horns: p.horns } : {}) } : null); // 뿔피리(10/30 상점)는 낸 때만
/** 상점 칸 (10/30 — 모양만 · 무기 id 맞춤은 shop_rules.js normalizeShop) — 맞으면 사본, 아니면 null */
const shopOf = s => (s?.v === 1 && Number.isSafeInteger(s.slot) && count(s.seed) && s.seed <= 0xffffffff && Array.isArray(s.items) && s.items.length <= 8
  && s.items.every(i => i && validText(i.id) && validText(i.tier) && count(i.coins) && count(i.heads) && count(i.horns))
  ? { v: 1, seed: s.seed, slot: s.slot, rerolls: count(s.rerolls) ? s.rerolls : 0, alter: s.alter === true, items: s.items.map(({ id, tier, coins, heads, horns }) => ({ id, tier, coins, heads, horns })) } : null);
/** 번 것 (도살자 · 대부호 — title_rules.js) — 모양이 맞으면 사본, 아니면 null */
const earnedOf = e => (e && count(e.coins) && count(e.heads) ? { coins: e.coins, heads: e.heads } : null);
/** 옛 저장의 번 것 = 지금 가진 것 + 칸 · 물건에 낸 값 (적어도 이만큼은 벌었다 — 감독 10/24) */
const earnedSeed = (coins, heads, acquisitions) => acquisitions.reduce((e, a) => ({ coins: e.coins + (a.paid?.coins ?? 0), heads: e.heads + (a.paid?.heads ?? 0) }), { coins, heads });
/** 스킬트리 옮기기 기록 (skill_tree_store.js) — 모양이 맞으면 사본, 아니면 null */
const treeOf = t => (t?.v === 1 && count(t.books) && count(t.coins) && count(t.heads) && count(t.bonus)
  ? { v: 1, at: validText(t.at) ? t.at : '', books: t.books, coins: t.coins, heads: t.heads, bonus: t.bonus, notice: t.notice === true } : null);
export function readProgress() {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    if (pendingSave != null && (pendingStore !== localStorage || stored !== pendingBase)) pendingSave = null; // 바깥에서 지갑을 바꿨으면 그쪽이 먼저
    const value = JSON.parse(pendingSave ?? stored);
    if (value?.version === 1) {
      const seen = new Set();
      const acquisitions = (Array.isArray(value.acquisitions) ? value.acquisitions : []).filter(a => {
        if (!a || !validText(a.receipt) || !ACQ_KINDS.includes(a.kind) || seen.has(a.receipt)) return false;
        seen.add(a.receipt); return true;
      }).map(({receipt, kind, paid}) => (paidOf(paid) ? {receipt, kind, paid: paidOf(paid)} : {receipt, kind}));
      // 호칭: 사건마다 하나 · 표에 있는 사건은 표 이름(이름을 바꿔도 따라감 — 고른 호칭도 옛 이름이면 새 이름으로) · seen 이 없는 옛 줄은 본 것으로
      //  고른 호칭 = 가진 호칭 중 저장된 고름 · 아니면(옛 '여행자' · 안 가진 이름) 가진 호칭의 첫째 · 없으면 ''
      const titles = [];
      let title = '';
      for (const t of Array.isArray(value.titles) ? value.titles : []) {
        if (!t || !validText(t.event) || !validText(t.name) || titles.some(x => x.event === t.event)) continue;
        const name = titleName(t.event) ?? t.name;
        titles.push({ event: t.event, name, seen: t.seen !== false });
        if (value.title === name || (value.title === t.name && !title)) title = name;
      }
      title ||= titles[0]?.name ?? '';
      const coins = count(value.coins) ? value.coins : 100, heads = count(value.heads) ? value.heads : 0;
      session = { acquisitions, titles, title, coins, heads, horns: count(value.horns) ? value.horns : 0, tree: treeOf(value.tree), wander: normalizeWander(value.wander), regicide: regicideOf(value.regicide),
        earned: earnedOf(value.earned) ?? earnedSeed(coins, heads, acquisitions), shop: shopOf(value.shop) };
    }
  } catch { /* 이번 실행 동안 유지한다. */ }
  return { ...structuredClone(session), level: levelOf(session) };
}
/** 가진 호칭 수 (이름 하나에 하나 — 레벨 · 레전드 확률이 같이 쓰는 셈) */
const titleCount = (s) => new Set(s.titles.map(t => t.name)).size;
/** 레벨 = 1 + 얻은 것 + 얻은 호칭(TITLE.countsLevel 이 켜졌을 때 — 사장님 10/24 03:4x) */
const levelOf = (s) => 1 + s.acquisitions.length + (TITLE.countsLevel ? titleCount(s) : 0);
/** 내 카드 뽑기 등급 확률 (사장님 10/24 04:0x — 호칭 하나마다 레전드 +0.2 %p · 커먼 −0.2 %p · main.js drawCardIds 가 여정 · 방랑에서만): base = weapons.js TIER_DRAW */
export function titleTierDraw(base) {
  readProgress();
  return tierDrawFor(base, titleCount(session));
}
/** 싸움 보상으로 번 것 더하기 (도살자 · 대부호 — 보상 거래 안에서 저장 전에 부른다 · 음수는 0) */
function noteEarned(coins, heads) {
  session.earned.coins += Math.max(0, coins);
  session.earned.heads += Math.max(0, heads);
}
/** 호칭 맞춤 (저장할 때마다 — 그 거래와 같은 저장): 방랑 이긴 판이면 왕 기록에 더하고 · 조건을 채운 호칭을 얻는다(seen false — 알림 한 번). 돌려줌: 이번에 얻은 사건 */
function grantTitles() {
  session.regicide = noteKing(session.regicide, session.wander?.run);
  const due = dueTitles(session);
  for (const event of due) session.titles.push({ event, name: titleName(event), seen: false });
  if (!session.titles.some(t => t.name === session.title)) session.title = session.titles[0]?.name ?? ''; // 처음 얻은 호칭 = 저절로 고른 호칭
  return due;
}
/**
 * 저장. 막히면 false — 방랑 거래(wander = true)만 이번 실행 메모리에 남긴다(pendingSave).
 *  다른 거래(구매 · 초기화 · 옮기기 …)가 막히면 전처럼 다음 읽기에서 옛 값으로 돌아간다 — 앞서 남겨 둔 방랑 거래가 있으면 그 판(구매 전)으로 (리뷰 2-8: 전달본은 이때 구매도 메모리에 남았다)
 */
function save(wander = false) {
  grantTitles();
  const text = JSON.stringify({ version: 1, ...session });
  let before = null;
  try { before = localStorage.getItem(PROGRESS_KEY); } catch { /* 저장소를 못 엶 */ }
  try {
    localStorage.setItem(PROGRESS_KEY, text);
    pendingSave = null;
    return true;
  } catch {
    if (wander) {
      pendingSave = text;
      pendingBase = before;
      try { pendingStore = globalThis.localStorage; } catch { pendingStore = null; }
    }
    return false;
  }
}
export function recordAcquisition({ receipt, kind, source }) {
  readProgress();
  if (source === 'starter' || !validText(receipt) || !ACQ_KINDS.includes(kind) || session.acquisitions.some(a => a.receipt === receipt)) return false;
  session.acquisitions.push({ receipt, kind }); save(); return true;
}
/** 이 receipt 를 이미 얻었나 (스킬트리 칸 'skill:<유파>:<칸 id>') */
export function owns(receipt) {
  return readProgress().acquisitions.some(a => a.receipt === receipt);
}
/**
 * 사기: 금화 price · 머리 heads · 뿔피리 horns(10/30 상점)를 내고 receipt 를 얻는다 — 한 번의 저장(금화 · 머리 · 뿔피리 · 얻은 것 같이). 이미 가졌거나 돈이 모자라면 아무것도 안 바뀐다.
 *  낸 값은 paid 로 남긴다(유파 초기화가 그대로 돌려줌 — skill_tree_store.js resetSchool · 뿔피리는 낸 때만 paid.horns).
 *  돌려줌 { ok, saved, why } — why: 'owned' · 'coins' · 'heads' · 'horns' · 'bad'(모자란 것 가운데 첫째) · 재화가 모자라면 short = 모자란 재화 모두(['coins', 'horns'] … — 10/30 상점 안내 줄).
 *  레벨 = 1 + 얻은 수라 칸 · 무기 하나마다 Lv +1
 */
export function purchase({ receipt, kind, price, heads = 0, horns = 0 }) {
  readProgress();
  if (!validText(receipt) || !ACQ_KINDS.includes(kind) || kind === 'skillbook' || !count(price) || !count(heads) || !count(horns)) return { ok: false, saved: false, why: 'bad' };
  if (session.acquisitions.some(a => a.receipt === receipt)) return { ok: false, saved: false, why: 'owned' };
  const short = [session.coins < price && 'coins', session.heads < heads && 'heads', session.horns < horns && 'horns'].filter(Boolean);
  if (short.length) return { ok: false, saved: false, why: short[0], short };
  session.coins -= price;
  session.heads -= heads;
  session.horns -= horns;
  session.acquisitions.push({ receipt, kind, paid: { coins: price, heads, ...(horns ? { horns } : {}) } });
  return { ok: true, saved: save(), why: null };
}
/**
 * 한 번의 저장으로 고치기 (스킬트리 옮기기 · 유파 초기화 — skill_tree_store.js): fn(draft) 가 지금 값의 사본을 고치고 참을 돌려주면 그 사본이 지금 값이 되고 한 번 저장한다.
 *  거짓이면 아무것도 안 바뀐다. 저장이 막히면 이번 실행 동안만 그 값(다음 실행은 저장된 옛 값에서 다시 — 금화가 사라지거나 두 번 생기지 않는다).
 *  돌려줌 { changed, saved }
 */
export function update(fn) {
  readProgress();
  const draft = structuredClone(session);
  if (!fn(draft)) return { changed: false, saved: false };
  session = { ...draft, coins: count(draft.coins) ? draft.coins : session.coins, heads: count(draft.heads) ? draft.heads : session.heads, horns: count(draft.horns) ? draft.horns : session.horns,
    tree: treeOf(draft.tree), shop: shopOf(draft.shop) };
  return { changed: true, saved: save() };
}
/** 금화 더하기 (인장 → 금화 바꾸기 — seal_coins.js). 돌려줌: 저장했나 */
export function addCoins(amount) {
  readProgress();
  if (!count(amount)) return false;
  session.coins += amount;
  return save();
}
/** 금화를 이 값으로 (디자인 보기용 주소 `?coins=N` — game_entry.js) */
export function setCoins(amount) {
  readProgress();
  if (!count(amount) || amount > 1e7) return false;
  session.coins = amount;
  return save();
}
/** 머리를 이 값으로 (시험용 주소 `?heads=N` — game_entry.js · 사장님 10/25 01:5x 스킬을 직접 사서 해 보려는데 머리가 모자람) */
export function setHeads(amount) {
  readProgress();
  if (!count(amount) || amount > 1e7) return false;
  session.heads = amount;
  return save();
}
/** 뿔피리를 이 값으로 (상점 시험판 주소 `?horns=N` — shop_test.js · ?heads 와 같은 꼴) */
export function setHorns(amount) {
  readProgress();
  if (!count(amount) || amount > 1e7) return false;
  session.horns = amount;
  return save();
}
// ── 상점 (10/30 — shop_rules.js · shop_panel.js) ──
/** 저장마다 하나인 상점 씨앗 (처음 상점을 열 때 만듦 — crypto) */
const newShopSeed = () => Math.floor(rand01() * 4294967296) >>> 0;
/**
 * 이 칸(slot)의 물건: 저장된 칸이 같은 칸이고 맞으면(valid — 무기 id 맞춤) 그대로 · 아니면 roll(seed, reroll) 로 새로 뽑아 한 번 저장.
 *  같은 칸을 다시 뽑을 때(깨진 칸 · 시험판 forceAlter 가 다름)는 그 칸의 다시 들인 수 그대로 · 새 칸이면 0.
 *  forceAlter (시험판 ?shopAlter — true · false · null) 가 저장된 칸과 다르면 다시 뽑는다. 씨앗은 저장에 하나(없으면 만듦 — 같은 칸 · 같은 씨앗 · 같은 수 = 같은 물건).
 *  돌려줌: { v, seed, slot, rerolls, alter, items } 사본 (저장이 막혀도 이번 실행 동안 같은 물건)
 */
export function ensureShopStock({ slot, roll, valid = () => true, forceAlter = null }) {
  readProgress();
  const s = session.shop;
  if (s && s.slot === slot && valid(s) && (forceAlter == null || s.alter === forceAlter)) return structuredClone(s);
  const seed = s?.seed ?? newShopSeed(), rerolls = s?.slot === slot ? s.rerolls : 0;
  const next = shopOf({ ...roll(seed, rerolls), seed, slot, rerolls });
  if (!next) return null;
  session.shop = next;
  save();
  return structuredClone(next);
}
/**
 * 다시 들이기 (사장님 10/31 00:2x "'다음 갱신'도 재화가 필요해. 머리 1개로 하자." — 상점 칸 '다음 갱신' 단추 · config.js SHOP.rerollHeads):
 *  지금 칸(slot)의 저장된 물건이 있을 때만 · 머리 heads 를 내고 roll(seed, rerolls + 1) 로 같은 규칙의 새 물건 — 머리 · 새 물건 · 수가 한 번의 저장(반쯤 남지 않음 · 새로고침해도 다시 안 뽑음).
 *  4 시간 갱신 시각은 그대로(칸 번호를 바꾸지 않음). 머리가 모자라면 아무것도 안 바뀐다.
 *  돌려줌 { ok, saved, why, stock } — why: 'heads'(모자람) · 'stale'(저장된 칸이 지금 칸이 아님 — ensureShopStock 먼저) · 'bad'
 */
export function rerollShopStock({ slot, roll, heads = 1 }) {
  readProgress();
  const s = session.shop;
  if (!count(heads)) return { ok: false, saved: false, why: 'bad', stock: null };
  if (!s || s.slot !== slot) return { ok: false, saved: false, why: 'stale', stock: null };
  if (session.heads < heads) return { ok: false, saved: false, why: 'heads', stock: structuredClone(s) };
  const rerolls = s.rerolls + 1;
  const next = shopOf({ ...roll(s.seed, rerolls), seed: s.seed, slot, rerolls });
  if (!next) return { ok: false, saved: false, why: 'bad', stock: structuredClone(s) };
  session.heads -= heads;
  session.shop = next;
  return { ok: true, saved: save(), why: null, stock: structuredClone(next) };
}
/**
 * 왕을 이긴 판의 뿔피리 (main.js checkRoundEnd — 여정 · 방랑 이긴 판 · config.js SHOP.hornKings · hornChance · hornAmount): 상대가 왕이고 roll() < chance 면 +amount 한 번 저장.
 *  force = 시험판 ?horn=1 (왕이 아니어도 · 확률 없이). 돌려줌: 얻은 수(0 = 못 얻음). roll 은 rand01(crypto — 게임 난수를 건드리지 않음 · 시험은 바꿔 넣음)
 */
export function awardKingHorn(foe, { kings = [], chance = 0, amount = 1, roll = rand01, force = false } = {}) {
  if (!count(amount) || !amount) return 0;
  if (!force && (!kings.includes(foe) || !(roll() < chance))) return 0;
  readProgress();
  session.horns += amount;
  save();
  return amount;
}
// ── 여정 판 끝 금화 · 머리 (사장님 결정 10/16 04:3x) ──
// 사장님 10/22 01:5x '획득량이라도 지금의 2배로 · 밤 스테이지에서는 다시 그 2배 · 대신 밤 스테이지에서는 패배 시 잃어버리는 양을 지금의 2배로'
//  → 10/24 02:4x '스테이지 모드에서도 밤에 금화 보상 2배 주던 거 낮과 똑같이 바꿔' · 03:0x '스테이지 승리 +10~25 패배 -5~10': 낮 · 밤 같음 —
//  이기면 +10~25 · 지면 −5~10 (정수, 양 끝 포함 · 전 낮 +10~30 / −1~5 · 밤 +20~60 / −2~10). night 칸은 낮과 같은 값(밤 무대 갈래를 남겨 두어 다시 가를 때 한 곳만)
export const JOURNEY_COINS = Object.freeze({ win: [10, 25], loss: [5, 10], night: Object.freeze({ win: [10, 25], loss: [5, 10] }) });
/** [lo, hi] 정수 하나 — 게임 난수(Math.random — AI 가 쓰는 흐름)를 건드리지 않게 crypto 로 */
export function rollInt(lo, hi) {
  const span = hi - lo + 1;
  return lo + Math.min(span - 1, Math.floor(rand01() * span));
}
/** [0, 1) 하나 — rollInt 와 같은 crypto 흐름 (방랑 대면 뽑기도 이것 — main.js) */
export function rand01() {
  const c = globalThis.crypto;
  return c?.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random();
}
/**
 * 판 끝 금화 (main.js checkRoundEnd — 첫 화면·대기실 여정만): 이기면 +rollInt(10, 25) · 지면 −rollInt(5, 10) — 밤 무대(opts.night)도 같음(10/24 03:0x) ·
 *  0 아래로는 안 내려간다 (JOURNEY_COINS · 사장님 10/22 · 10/24).
 *  돌려줌 { delta: 실제로 바뀐 값(지면 음수 — 금화가 모자라면 그만큼만), coins: 바뀐 뒤 금화, saved }
 */
export function journeyCoins(win, roll = rollInt, { night = false } = {}) {
  readProgress();
  const T = night ? JOURNEY_COINS.night : JOURNEY_COINS;
  const [lo, hi] = win ? T.win : T.loss;
  const amount = roll(lo, hi);
  const before = session.coins;
  session.coins = win ? before + amount : Math.max(0, before - amount);
  noteEarned(session.coins - before, 0); // 대부호 — 이긴 판만(진 판 차감은 빼지 않음)
  return { delta: session.coins - before, coins: session.coins, saved: save() };
}
/** 머리 더하기 (상대의 목을 벤 판 — main.js). fight = 싸움 보상(도살자 셈 — awardHead). 돌려줌: 저장했나 */
export function addHeads(amount = 1, fight = false) {
  readProgress();
  if (!count(amount)) return false;
  session.heads += amount;
  if (fight) noteEarned(0, amount);
  return save();
}
/** 이 상대의 머리를 처음 벤 때만 1 (한 상대에 한 번 — 같은 몸이 두 번 알려도) · 돌려줌: 이번에 더했나 */
export function awardHead(foe) {
  if (!foe || foe.headTaken) return false;
  foe.headTaken = true;
  addHeads(1, true);
  return true;
}
// ── 방랑 (wander_rules.js — 10/23) ── 판 결과 · 보상 · 머리를 같은 저장에 한 번에 쓴다(save(true) — 막혀도 이번 실행 동안은 지킨다)
const newRunId = () => {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.floor(rand01() * 2 ** 32).toString(36)}`;
};
/** 여정에서 이긴 무대를 적는다 (main.js checkRoundEnd — 첫 화면 · 대기실 여정만). 무대를 모두(required) 깨면 방랑이 열린다(한 번 열리면 계속). 돌려줌 { unlocked, opened: 이번에 처음 열렸나 } */
export function recordCampaignStage(stage, required) {
  readProgress();
  const w = session.wander;
  if (!required.includes(stage)) return { unlocked: w.unlocked, opened: false };
  const was = w.unlocked;
  if (!w.cleared.includes(stage)) w.cleared.push(stage);
  w.unlocked ||= required.every((s) => w.cleared.includes(s));
  save(true);
  return { unlocked: w.unlocked, opened: w.unlocked && !was };
}
/** 옛 저장 인정 (한 번 — legacyChecked): 방랑이 들어오기 전 저장의 이어하기 지점 · 누적 깬 수로 깬 무대를 적는다 (wander_rules.js legacyWanderStages). 돌려줌: 이번에 열렸나 */
export function migrateCampaignStages(checkpointStage, clears, required) {
  readProgress();
  const w = session.wander;
  if (w.legacyChecked) return false;
  w.legacyChecked = true;
  const was = w.unlocked;
  w.cleared = [...new Set([...w.cleared, ...legacyWanderStages(checkpointStage, clears, required)])];
  w.unlocked ||= required.every((s) => w.cleared.includes(s));
  save(true);
  return w.unlocked && !was;
}
/**
 * 지금 방랑 판 (main.js startFight): 진행 중(active) 판이 있으면 그 판 · 없거나 끝났으면 makeEncounter() → { stage, foe, foeWeapon } 로 새로 뽑는다
 *  (이긴 판 뒤면 같은 연속의 다음 판 — 판 번호 +1 · 진 판 뒤면 새 연속 1 번).
 *  진행 중 판이 지금 목록에 없는 무대 · 상대 · 무기면(isValid 거짓 — 인물 · 무대를 바꾼 뒤) 그 대면만 새로 뽑는다(연속 · 판 번호는 그대로)
 *   — 리뷰 2-3: 전달본은 이때 대기실 '대면을 열지 못했습니다'로 방랑이 영영 막혔다. 잠겨 있으면 null
 */
export function ensureWanderRun(makeEncounter, isValid = () => true) {
  readProgress();
  const w = session.wander;
  if (!w.unlocked) return null;
  const old = w.run;
  if (old?.status === 'active' && isValid(old)) return structuredClone(old);
  const won = old?.status === 'won', redraw = old?.status === 'active'; // redraw = 무효라 대면만 다시 뽑는 판
  const next = makeEncounter();
  w.run = {
    id: won || redraw ? old.id : newRunId(),
    round: won ? old.round + 1 : redraw ? old.round : 1,
    wins: won || redraw ? old.wins : 0,
    stage: next.stage,
    foe: next.foe,
    foeWeapon: next.foeWeapon,
    status: 'active',
    weapon: null,
    cards: null,
    lastWeapon: won ? old.weapon || old.lastWeapon : redraw ? old.lastWeapon : null,
    headTaken: false,
    fighting: false,
    encounterSeen: false, // 방랑 전용 상대 알림 창 (10/24 — 대면마다 한 번 · 다시 뽑은 대면도 새로)
    reward: null,
  };
  save(true);
  return structuredClone(w.run);
}
/** 카드를 펼치거나 무기를 고름 (main.js saveJourneyRound — 여정 이어하기 지점과 같은 몫): 진행 중 판에 내 카드 · 무기를 적는다 */
export function saveWanderLoadout({ weapon, cards, lastWeapon }) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return false;
  Object.assign(run, { weapon, cards, lastWeapon });
  return save(true);
}
/**
 * 몸 상태 이어받기 (WANDER.resumeState — 사장님 10/30 01:1x '이어하면 그 상황 그대로' · 감독 안 (b)): 진행 중 판에 두 몸의 사본을 적는다 · null 이면 지움.
 *  resume = { v 1, foe, foeWeapon, player: 사본, enemy: 사본 } (src/fight_snapshot.js) · 돌려줌: 저장했나
 */
export function saveWanderResume(resume) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return false;
  if (resume) run.resume = resume; else delete run.resume;
  return save(true);
}
/** 정지 창 '재대결'(10/24 02:4x — 전 '처음부터 다시') (WANDER.quitAsLoss 끔 — 일반 여정과 같게): 같은 대면을 카드부터 다시 — 고른 무기 · 카드만 지운다 */
export function resetWanderLoadout() {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return false;
  Object.assign(run, { weapon: null, cards: null, fighting: false });
  delete run.resume; // 재대결 = 처음 몸 (몸 상태 이어받기 사본도 지움 — 방랑 정지 창엔 재대결이 없지만 이 길로 오면)
  return save(true);
}
/** 싸움이 시작됨 / 끝남 (WANDER.quitAsLoss 켬 — main.js beginFight): 싸우는 동안 판을 버리면(새로고침 · 대기실 · 재대결) 다음에 패배로 셈한다 */
export function markWanderFighting(on = true) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active' || run.fighting === on) return false;
  run.fighting = on;
  return save(true);
}
/** 싸우던 중 버린 판이 있으면(WANDER.quitAsLoss 켬) 패배로 셈한다 — 돌려줌: 그 판 보상(settleWander 와 같은 꼴 + round) · 없으면 null */
export function settleAbandonedWander(roll = rollInt) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active' || !run.fighting) return null;
  const round = run.round;
  const reward = settleWander(false, roll);
  return reward && { ...reward, round };
}
/** 방랑 판에서 상대의 목을 벰 (main.js COMBAT_HOOKS.onDecapitate): 판마다 한 번 머리 WANDER_HEAD(1 — 여정과 같음 · 10/24 02:4x, 전 2). 판이 끝난 뒤(쓰러뜨린 뒤) 벤 목도 센다 — 여정과 같게(리뷰 2-9). 돌려줌: 이번에 더했나 */
export function awardWanderHead() {
  readProgress();
  const run = session.wander.run;
  if (!run || run.headTaken) return false;
  run.headTaken = true;
  session.heads += WANDER_HEAD;
  noteEarned(0, WANDER_HEAD); // 도살자
  if (run.reward) run.reward.heads += WANDER_HEAD; // 이미 셈한 판이면 그 판 보상에도
  save(true);
  return true;
}
/**
 * 판 끝 (main.js checkRoundEnd): 진행 중 판만 한 번 — 금화(WANDER_COINS 이기면 +20 ~ 50 + 연승 보너스 + 특별 몫 '왕의 금고' · 지면 −10 ~ 20 · 0 아래 없음) · 특별 머리 '빼앗은 수급' · 판 결과를 한 번에 적는다.
 *  연승 보너스는 이 방랑에서 몇 번째 승리인가(run.wins + 1 — 진 판에서 연속이 끝나 새 방랑은 0 부터)로 셈 · 판 결과와 같은 한 번의 저장이라 새로고침 · 다시 열기로 두 번 받지 않는다.
 *  돌려줌 { coins: 실제로 바뀐 금화, heads: 이 판 머리(특별 + 참수), bonus, streak: 연승 보너스 금화 } · 진행 중 판이 없으면 null (같은 판을 두 번 셈하지 않는다)
 */
export function settleWander(win, roll = rollInt) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return null;
  const reward = wanderReward(win, run.foe, roll(...(win ? WANDER_COINS.win : WANDER_COINS.loss)), run.wins + 1);
  const before = session.coins;
  session.coins = Math.max(0, before + reward.coins);
  session.heads += reward.heads;
  noteEarned(session.coins - before, reward.heads); // 대부호 · 도살자 — 특별 몫 포함 · 진 판 차감은 빼지 않음
  run.status = win ? 'won' : 'lost';
  run.fighting = false;
  delete run.resume; // 끝난 판은 이어받을 몸이 없다 (WANDER.resumeState)
  if (win) run.wins++;
  run.reward = { coins: session.coins - before, heads: reward.heads + (run.headTaken ? WANDER_HEAD : 0), bonus: reward.bonus, streak: reward.streak };
  save(true);
  return structuredClone(run.reward);
}
/** 방랑 전용 상대 알림 창을 봤다 (main.js wanderEncounter 의 확인 — 사장님 10/24 01:1x): 진행 중 판에 적어 같은 대면(재대결 · 방랑 이어가기)에서 다시 띄우지 않는다. 돌려줌: 저장했나 */
export function markWanderEncounter() {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active' || run.encounterSeen) return false;
  run.encounterSeen = true;
  return save(true);
}
/** 방랑 알림 창을 띄울 때인가 (열렸고 아직 안 봄 — 30 무대를 처음 다 깼을 때 · 이미 깬 사람은 대기실에 처음 들어올 때) */
export function wanderNoticeDue() {
  const w = readProgress().wander;
  return w.unlocked && !w.noticeSeen;
}
/** 방랑 알림 창을 봤다 (확인) — 다시 띄우지 않는다. 돌려줌: 저장했나 */
export function markWanderNotice() {
  readProgress();
  session.wander.noticeSeen = true;
  return save(true);
}

// ── 호칭 ──
/**
 * 이벤트 호칭 얻기 (표 밖 — 앞으로 이벤트가 부른다 · 지금은 부르는 곳 없음): 사건(event)마다 한 번 · 이벤트 조건은 해당 이벤트에서 판정한다.
 *  표 호칭(title_rules.js TITLE_NAMES — 유파 계승자 · 방랑자 …)은 조건으로만 얻는다(여기로 못 얻음). 처음 얻은 호칭이면 저절로 고른 호칭(저장 때). 돌려줌: 이번에 얻었나
 */
export function unlockEventTitle(event, name) {
  readProgress();
  if (!validText(event) || !validText(name) || Object.hasOwn(TITLE_NAMES, event) || session.titles.some(t => t.event === event)) return false;
  session.titles.push({ event, name, seen: false }); save(); return true;
}
/** 대기실을 열 때 한 번 (lobby.js): 조건을 이미 채운 저장(옛 저장 — 유파 칸을 모두 익힘 · 방랑이 열림 …)에 호칭을 준다 · 줄 것이 있을 때만 저장. 돌려줌: 이번에 얻은 사건 */
export function checkTitles() {
  readProgress();
  if (!dueTitles(session).length) return [];
  const before = session.titles.length;
  save();
  return session.titles.slice(before).map(t => t.event);
}
/** 아직 알리지 않은 호칭 { event, name, why } — 얻은 차례 (알림 창이 하나씩 — lobby.js · title_notice.js) */
export function titleNotices() {
  return readProgress().titles.filter(t => !t.seen).map(t => ({ event: t.event, name: t.name, why: titleReason(t.event, t.name) }));
}
/** 호칭 알림 창을 봤다(확인) — 다시 띄우지 않는다. 돌려줌: 저장했나 */
export function markTitleSeen(event) {
  readProgress();
  const t = session.titles.find(x => x.event === event);
  if (!t || t.seen) return false;
  t.seen = true;
  return save();
}
/** 가진 호칭 — 얻은 차례 · 같은 이름은 하나 (10/24 — '여행자'는 호칭이 아님 · 없으면 빈 목록). 대기실 호칭 내림 상자가 이것만 보인다 (사장님 16:0x '이미 가진 호칭') */
export function titleOptions() {
  return [...new Set(readProgress().titles.map(t => t.name))];
}
/** 호칭 고르기: 가진 호칭만 · 고른 것은 title 에 저장. 돌려줌 { ok, saved } (저장 못 하면 이번 실행 동안 유지) */
export function selectTitle(name) {
  if (!titleOptions().includes(name)) return { ok: false, saved: false };
  session.title = name;
  return { ok: true, saved: save() };
}
