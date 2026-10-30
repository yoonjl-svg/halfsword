// 상점 규칙 (사장님 10/30 19:0x — 값은 config.js SHOP · 화면 src/shop_panel.js · 저장 lobby_progress.js shop · horns). 화면 · 저장소 없이 셈만 — 시험 tools/sim/shop.test.mjs.
//  갱신 칸(slot): 현실 시간 SHOP.refreshHours(4) 시간마다 하나 — 한국 시간 SHOP.slotStartHour(0) 시부터(00 · 04 · 08 · 12 · 16 · 20 시 · 기기 시간대와 상관없이 · 감독 기본).
//  물건(stock)은 칸 번호 + 저장마다 하나인 씨앗(seed)으로 뽑는다 — 같은 저장 · 같은 칸이면 다시 열어도 같다. 뽑은 물건은 저장에도 적어(lobby_progress.js ensureShopStock)
//   그 칸 동안 산 뒤에도 남은 물건이 바뀌지 않는다(산 물건은 '판매 완료' — 가진 무기라 다음 칸에서는 빠짐).
//  보통 상인: 물건마다 등급을 SHOP.tierWeights(커먼 60 · 레어 25 · 에픽 10 · 레전드 5)로 뽑고 그 등급에서 아직 안 가진 무기 하나 · 두 물건은 서로 다름.
//   그 등급에 남은 무기가 없으면 남은 등급끼리 다시 뽑는다(SHOP.redrawEmptyTier — 감독 기본). 값 = 등급 SHOP.price(금화 SHOP.coinStep 단위 · 뿔피리).
//  얼터(SHOP.alterChance 5 %): 물건마다 쓰레기 · ??? 반반(SHOP.alterTiers) · 안 가진 무기 · 값 = 머리 SHOP.alterPrice.heads(3) · 금화 없음.
//  다시 들이기 (사장님 10/31 00:2x "'다음 갱신'도 재화가 필요해. 머리 1개로 하자." — SHOP.rerollHeads): 같은 칸에서 머리를 내고 물건을 새로 뽑는다 — 같은 규칙(얼터 5 % 도 새로).
//   칸 안 다시 들인 수(reroll — 저장 shop.rerolls)를 씨앗에 섞어 뽑으므로 같은 저장 · 같은 칸 · 같은 수면 늘 같다. 4 시간 갱신 시각은 그대로(감독 기본) · 새 칸이 되면 수는 0.
//  파는 무기 = 무기 표 전부에서 주인공 카드에 안 나오는 것(복제 엑스칼리버 · 빼 둔 무기 weapons.js RETIRED_WEAPONS)을 뺀 것 — main.js PLAYER_WEAPON_POOL 과 같은 규칙(감독 기본)
import { SHOP } from './config.js';
import { WEAPON_LIST, RETIRED_WEAPONS } from './weapons.js';

const HOUR = 3600e3;
/** 상점이 팔 수 있는 무기 id (무기 표 차례) — main.js PLAYER_WEAPON_POOL 과 같은 걸름 */
export const SHOP_POOL = Object.freeze(WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)));
const TIER_OF = new Map(WEAPON_LIST.map((w) => [w.id, w.tier]));
export const tierOf = (id) => TIER_OF.get(id) ?? null;

/** 지금(ms) → 갱신 칸 번호 (정수 — 한국 시간 0 시 맞춤 4 시간 칸) */
export function shopSlot(nowMs, cfg = SHOP) {
  const span = cfg.refreshHours * HOUR, shift = (cfg.slotTzHours - cfg.slotStartHour) * HOUR;
  return Math.floor((nowMs + shift) / span);
}
/** 칸 번호 → 그 칸이 시작하는 때(ms) */
export function slotStart(slot, cfg = SHOP) {
  return slot * cfg.refreshHours * HOUR - (cfg.slotTzHours - cfg.slotStartHour) * HOUR;
}
/** 다음 갱신까지 남은 시간(ms) */
export function msToNextSlot(nowMs, cfg = SHOP) {
  return slotStart(shopSlot(nowMs, cfg) + 1, cfg) - nowMs;
}

// ── 씨앗 난수 (칸 · 저장마다 같은 흐름 — 게임 난수 Math.random 과 따로) ──
function mix32(a, b) {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x6b43a9b5, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
/** mulberry32 — [0, 1) 흐름 · reroll(칸 안 다시 들인 수)이 0 이면 전과 같은 흐름 */
export function seededRandom(seed, slot, reroll = 0) {
  let s = mix32(seed >>> 0, slot | 0);
  if (reroll) s = mix32(s, 0x5eed0000 + (reroll | 0));
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** [lo, hi] 안의 step 눈금 정수 하나 (양 끝 포함 — lo 부터 step 씩) */
export function rollStep(rnd, lo, hi, step = 1) {
  const n = Math.floor((hi - lo) / step) + 1;
  return lo + step * Math.min(n - 1, Math.floor(rnd() * n));
}
/** 무게표 { 열쇠: 무게 } 에서 하나 (무게 0 · 빈 표면 null) */
function pickWeighted(rnd, weights) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  if (!total) return null;
  let r = rnd() * total;
  for (const k of keys) { r -= weights[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}
const pickOne = (rnd, list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/** 등급 → 값 { coins, heads, horns } (보통 상인) */
export function rollPrice(rnd, tier, cfg = SHOP) {
  const p = cfg.price[tier];
  return { coins: rollStep(rnd, p.coins[0], p.coins[1], cfg.coinStep), heads: 0, horns: p.horns ? rollStep(rnd, p.horns[0], p.horns[1], 1) : 0 };
}

/** 등급 무게대로 물건 count 개 (left = 등급 → 남은 무기 id — 뽑은 것은 빠짐) · 보통 = 등급표 값 · 얼터 = 머리 */
function drawItems(rnd, { alter, left, count }, cfg) {
  const weights = alter ? Object.fromEntries(cfg.alterTiers.map((t) => [t, 1])) : { ...cfg.tierWeights };
  const items = [];
  for (let i = 0; i < count; i++) {
    const open = Object.fromEntries(Object.entries(weights).filter(([t]) => left[t]?.length));
    let tier = pickWeighted(rnd, weights);
    if (!left[tier]?.length) {
      if (!cfg.redrawEmptyTier) continue; // 감독 기본은 다시 뽑음 — 끄면 그 자리는 비움
      tier = pickWeighted(rnd, open);
    }
    if (!tier) break;
    const list = left[tier], id = pickOne(rnd, list);
    list.splice(list.indexOf(id), 1);
    const price = alter ? { coins: 0, heads: cfg.alterPrice.heads, horns: 0 } : rollPrice(rnd, tier, cfg);
    items.push({ id, tier, ...price });
  }
  return items;
}
const leftOf = (exclude) => {
  const have = new Set(exclude), left = {};
  for (const id of SHOP_POOL) if (!have.has(id)) (left[tierOf(id)] ??= []).push(id);
  return left;
};

/**
 * 한 칸의 물건 뽑기 — 같은 seed · slot · owned 면 늘 같다.
 *  reroll = 이 칸에서 다시 들인 수(0 = 갱신 때 물건) · owned = 가진 무기 id 목록(시작 무기 포함 — owned_weapons.js ownedWeapons) · forceAlter = 시험판 ?shopAlter (true · false · null = 확률대로)
 *  돌려줌 { v 1, slot, rerolls, n, alter, items: [{ id, tier, coins, heads, horns }] } — n = 뽑은 수(SHOP.items) · 팔 무기가 모자라면 items 가 짧다(없으면 빈 목록).
 *  물건은 하나씩 차례로 뽑으므로 수만 늘리면(2 → 3) 앞 물건은 그대로 · 뒤에 하나 더 (topUpStock 은 저장된 물건을 지키며 채움)
 */
export function rollStock({ seed, slot, reroll = 0, owned = [], forceAlter = null }, cfg = SHOP) {
  const rnd = seededRandom(seed, slot, reroll);
  const alterRoll = rnd(); // 늘 먼저 하나 — 얼터를 억지로 정해도 뒤 흐름은 같다
  const alter = forceAlter == null ? alterRoll < cfg.alterChance : !!forceAlter;
  const items = drawItems(rnd, { alter, left: leftOf(owned), count: cfg.items }, cfg);
  return { v: 1, slot, rerolls: reroll, n: cfg.items, alter, items };
}

/**
 * 저장된 칸 채우기 (사장님 10/31 02:xx — 파는 수를 2 → 3 으로 바꾼 뒤 옛 저장): 그 칸을 뽑은 수(n — 없으면 옛 2)가 지금 수보다 적고 물건도 적으면
 *  있던 물건(산 것 · 판매 완료 포함)은 그대로 두고 모자란 만큼 같은 규칙(그 칸의 보통 · 얼터)으로 더 뽑아 붙인다 — 가진 무기 · 있던 무기는 뺌 ·
 *  같은 씨앗 · 칸 · 다시 들인 수면 늘 같다(다른 흐름 — 씨앗에 고정 값을 섞음). 채울 것이 없으면 null
 */
export function topUpStock(stock, { owned = [], count = SHOP.items } = {}, cfg = SHOP) {
  if (!stock || (stock.n ?? 2) >= count || stock.items.length >= count) return null;
  const rnd = seededRandom((stock.seed ^ 0x7f4a7c15) >>> 0, stock.slot, stock.rerolls ?? 0);
  const extra = drawItems(rnd, { alter: !!stock.alter, left: leftOf([...owned, ...stock.items.map((i) => i.id)]), count: count - stock.items.length }, cfg);
  return { ...stock, n: count, items: [...stock.items, ...extra] };
}

const count = (n) => Number.isSafeInteger(n) && n >= 0;
/** 저장된 상점 칸 모양 맞춤 (lobby_progress.js) — 맞으면 사본, 아니면 null */
export function normalizeShop(s) {
  if (!s || s.v !== 1 || !Number.isSafeInteger(s.slot) || !count(s.seed) || s.seed > 0xffffffff || !Array.isArray(s.items)) return null;
  const items = [];
  for (const it of s.items) {
    if (!it || !SHOP_POOL.includes(it.id) || tierOf(it.id) !== it.tier || !count(it.coins) || !count(it.heads) || !count(it.horns) || items.some((x) => x.id === it.id)) return null;
    items.push({ id: it.id, tier: it.tier, coins: it.coins, heads: it.heads, horns: it.horns });
  }
  return { v: 1, seed: s.seed, slot: s.slot, rerolls: count(s.rerolls) ? s.rerolls : 0, ...(count(s.n) ? { n: s.n } : {}), alter: s.alter === true, items };
}
