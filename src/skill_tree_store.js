// 스킬트리 저장 · 판 몫 (10/21 사장님 확정 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md) — 익힌 칸 · 배우기 · 유파 초기화 · 옛 스킬북 옮기기 · 판에 거는 몫.
//  익힌 칸 = lobby_progress.js 얻은 것 kind 'skill' · receipt 'skill:<유파>:<칸 id>' · paid { coins, heads }(낸 값). 레벨 = 1 + 얻은 수(칸 하나 = Lv +1, 초기화하면 그만큼 내려감).
//  사장님 10/21 결정: 배우기 = 그 칸 값(금화 · 머리 — skill_tree_data.js) · 앞 칸을 모두 익혀야 · 닫힌 칸('준비 중')은 못 배움 /
//   유파 초기화 = 머리 1 을 내고 그 유파 칸에 쓴 금화 · 머리를 모두 돌려받음(다른 유파 그대로 · 익힌 칸이 없거나 머리 0 이면 못 함) /
//   옛 스킬북 옮기기(모든 플레이어 · 처음 이 판을 연 때 한 번 — 새 플레이어도) = 산 책을 모두 거두고 쓴 금화(· 머리)를 돌려준 뒤 금화 500 을 더 줌 · 알림 한 번.
//  사용 / 봉인(10/16 책)은 칸마다 두지 않는다 — 앞 칸을 봉인하면 뒤 칸 몫이 어긋나 판이 복잡해지고, 유파 초기화가 되돌리기를 맡는다(IMPLEMENTATION.md §4).
//  판에 미치는 곳 (사람만 — AI · 시뮬은 그대로): main.js newRound → playerKit → 몸의 skillKit · schoolFootwork · schoolParry · schoolPassive · 고유 공격 이름 · 비기 잠금.
import { readProgress, purchase, update } from './lobby_progress.js';
import { TREE_SCHOOLS, nodeOf, canLearn, kitFromNodes, allNodeIds, nodesUpToStage, nodesParam, letterSchools, RESET_HEADS } from './skill_tree_data.js';

export const skillReceipt = (school, id) => `skill:${school}:${id}`;
/** receipt → { school, id } (모르는 칸이면 null) */
export function parseSkillReceipt(receipt) {
  const m = /^skill:([a-z]+):([A-Z]+\d+)$/.exec(receipt ?? '');
  return m && nodeOf(m[1], m[2]) ? { school: m[1], id: m[2] } : null;
}

/** 익힌 칸 — { german: Set<id>, … } (다섯 유파 모두 칸이 있다) */
export function readLearned(progress = readProgress()) {
  const out = Object.fromEntries(TREE_SCHOOLS.map((s) => [s, new Set()]));
  for (const a of progress.acquisitions) {
    if (a.kind !== 'skill') continue;
    const r = parseSkillReceipt(a.receipt);
    if (r) out[r.school].add(r.id);
  }
  return out;
}

/** 배우기 — { ok, saved, why } (why: skill_tree_data.js canLearn 의 'learned' · 'closed' · 'pre' · 'coins' · 'heads' · 'bad', 또는 lobby_progress purchase 의 'owned') */
export function learnNode(school, id) {
  const node = nodeOf(school, id);
  const progress = readProgress();
  const can = canLearn(school, node, readLearned(progress)[school] ?? new Set(), progress);
  if (!can.ok) return { ok: false, saved: false, why: can.why };
  return purchase({ receipt: skillReceipt(school, id), kind: 'skill', price: node.price, heads: node.heads });
}

// 낸 값 (paid 가 없으면 — 옛 저장 · 시험 기록 — 그 칸의 지금 값)
const paidOf = (a) => {
  if (a.paid) return a.paid;
  const r = parseSkillReceipt(a.receipt), n = r && nodeOf(r.school, r.id);
  return { coins: n?.price ?? 0, heads: n?.heads ?? 0 };
};
/** 유파 초기화 미리 보기 (확인 단계 글): { count 익힌 칸 수, coins · heads 돌려받는 값, cost 머리, ok, why: 'empty' · 'heads' · null } */
export function resetPreview(school, progress = readProgress()) {
  const mine = progress.acquisitions.filter((a) => a.kind === 'skill' && parseSkillReceipt(a.receipt)?.school === school);
  const coins = mine.reduce((s, a) => s + paidOf(a).coins, 0), heads = mine.reduce((s, a) => s + paidOf(a).heads, 0);
  const why = !mine.length ? 'empty' : progress.heads < RESET_HEADS ? 'heads' : null;
  return { count: mine.length, coins, heads, cost: RESET_HEADS, ok: !why, why };
}
/** 유파 초기화 — 한 번의 저장: 그 유파 칸을 모두 지우고 낸 금화 · 머리를 돌려준 뒤 머리 RESET_HEADS 를 뗀다. 돌려줌 { ok, saved, why, count, coins, heads } */
export function resetSchool(school) {
  let out = { ok: false, saved: false, why: 'bad', count: 0, coins: 0, heads: 0 };
  if (!TREE_SCHOOLS.includes(school)) return out;
  const r = update((p) => {
    const pre = resetPreview(school, p);
    if (!pre.ok) { out = { ...out, why: pre.why }; return false; }
    p.acquisitions = p.acquisitions.filter((a) => !(a.kind === 'skill' && parseSkillReceipt(a.receipt)?.school === school));
    p.coins += pre.coins;
    p.heads += pre.heads - RESET_HEADS;
    out = { ok: true, saved: false, why: null, count: pre.count, coins: pre.coins, heads: pre.heads };
    return true;
  });
  return { ...out, saved: r.saved };
}

// ── 옛 스킬북 옮기기 (사장님 10/21 — 모든 플레이어 한 번) ──
/** 옛 책 값 (얼림 — 10/16 skill_books.js BOOK_TIERS 1급 100 … 5급 500 · 머리로 사기는 없었음 BOOK_HEAD_PRICE null) */
export const OLD_BOOK_PRICE = Object.freeze({ 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 });
export const TREE_BONUS = 500; // 옮기며 더 주는 금화 (사장님 10/21)
export const OLD_BOOK_STATE_KEY = 'stillness.lobby.skillbooks.v1'; // 옛 사용 / 봉인 기록 — 옮기며 지운다
export const TREE_MARK_KEY = 'stillness.lobby.tree.v1'; // 옮긴 기록의 짝 — 옛 판(다른 탭)이 진행 저장을 다시 쓰며 tree 칸을 떨어뜨려도 500 을 두 번 주지 않게
const readMark = (storage) => { try { const v = JSON.parse(storage?.getItem(TREE_MARK_KEY)); return v?.v === 1 ? v : null; } catch { return null; } };

/**
 * 옮기기 — 판을 처음 연 때(main.js · 대기실 lobby.js — 어느 길이든 · 테스트 경로만 빼고) 부른다. 몇 번 불러도 한 번만 일한다.
 *  한 번의 저장(lobby_progress update)으로: 옛 책(kind 'skillbook')을 모두 지우고 · 'skillbook:<유파>:<급>' 마다 낸 값을 돌려주고 · 처음이면 금화 TREE_BONUS 와 기록 tree(notice)를 넣는다.
 *   책 돌려주기는 책 기록이 있을 때만이고 그 기록을 같은 저장에서 지운다 → 두 번 돌려줄 수 없다. 500 은 기록(tree · 짝 열쇠)이 없을 때만 → 두 번 주지 않는다.
 *   저장이 막히면 이번 실행 동안만 옮긴 값 — 저장된 옛 값은 그대로라 다음 실행에서 처음부터 다시(금화를 잃지 않는다). 저장이 됐을 때만 짝 열쇠를 쓰고 옛 봉인 기록을 지운다.
 *  돌려줌 { first 처음 옮김(500 을 줌), books 거둔 책 수, coins · heads 돌려준 값, bonus, saved }
 */
export function migrateSkillBooks({ storage = globalThis.localStorage, today = new Date().toISOString().slice(0, 10) } = {}) {
  const mark = readMark(storage);
  let info = { first: false, books: 0, coins: 0, heads: 0, bonus: 0, saved: false };
  const r = update((p) => {
    const old = p.acquisitions.filter((a) => a.kind === 'skillbook');
    const first = !p.tree && !mark;
    if (!old.length && (p.tree || !first)) {
      if (p.tree || !mark) return false;
      p.tree = { v: 1, at: mark.at ?? today, books: mark.books ?? 0, coins: mark.coins ?? 0, heads: mark.heads ?? 0, bonus: mark.bonus ?? TREE_BONUS, notice: false }; // 떨어진 기록만 다시
      return true;
    }
    let books = 0, coins = 0, heads = 0;
    for (const a of old) {
      const m = /^skillbook:([a-z]+):([1-5])$/.exec(a.receipt);
      if (!m) continue; // 값 없이 얻은 책(옛 시험 기록 등)은 거두기만
      books++;
      coins += a.paid?.coins ?? OLD_BOOK_PRICE[m[2]];
      heads += a.paid?.heads ?? 0;
    }
    p.acquisitions = p.acquisitions.filter((a) => a.kind !== 'skillbook');
    p.coins += coins;
    p.heads += heads;
    if (first) {
      p.coins += TREE_BONUS;
      p.tree = { v: 1, at: today, books, coins, heads, bonus: TREE_BONUS, notice: true };
    } else if (!p.tree) p.tree = { v: 1, at: mark?.at ?? today, books: mark?.books ?? 0, coins: mark?.coins ?? 0, heads: mark?.heads ?? 0, bonus: mark?.bonus ?? TREE_BONUS, notice: false };
    info = { first, books, coins, heads, bonus: first ? TREE_BONUS : 0, saved: false };
    return true;
  });
  info.saved = r.saved;
  if (r.saved) {
    const t = readProgress().tree;
    try { if (t && !mark) storage.setItem(TREE_MARK_KEY, JSON.stringify({ v: 1, at: t.at, books: t.books, coins: t.coins, heads: t.heads, bonus: t.bonus })); } catch { /* 진행 저장 안의 기록이 있다 */ }
    try { storage.removeItem?.(OLD_BOOK_STATE_KEY); } catch { /* 옛 봉인 기록은 아무것도 열지 않는다 */ }
  }
  return info;
}
/** 옮긴 알림 한 번 (대기실 — lobby.js): 아직 안 띄웠으면 { books, coins, heads, bonus } 를 돌려주고 띄운 것으로 적는다 · 없으면 null */
export function takeTreeNotice() {
  const t = readProgress().tree;
  if (!t?.notice) return null;
  update((p) => { p.tree = { ...p.tree, notice: false }; return true; });
  return { books: t.books, coins: t.coins, heads: t.heads, bonus: t.bonus };
}
/** 알림 글 ('~합니다' — 화면 글 지침 §2) */
export function treeNoticeText(n) {
  const won = (v) => v.toLocaleString('ko-KR');
  const back = n.books ? ` 가지고 있던 스킬북 ${n.books}권을 거두고 쓴 금화 ${won(n.coins)}${n.heads ? `과 머리 ${won(n.heads)}` : ''}을 돌려드렸습니다. 레벨도 그만큼 내려갑니다.` : '';
  return `스킬북이 유파마다 11칸의 스킬트리로 바뀌었습니다.${back} 새로 익히시도록 금화 ${won(n.bonus)}을 더 드립니다.`;
}

// ── 판에 거는 몫 (사람만) ──
/**
 * 플레이어가 이 판에 가진 유파 몫 — 해금 규칙의 오직 한 자리. tradition = 손에 든 무기 유파 · learned = readLearned().
 *  차례: nodes(개발 인자 `?skillNodes=G1,G5` · 'all' — 칸 그대로) → upTo(`?uniqueStage=N` — 옛 급 N 까지의 칸: 1 보법 · 2 막기 · 3 고유 공격 · 심화 · 4 패시브 · 5 비기) → test(테스트 경로 = 모두) → 익힌 칸.
 *  닫힌 칸은 어느 길이든 몫이 없다(비기는 SECRET.openSchools — 지금 일본만). 유파 칸이 없는 무기(무유파)는 null.
 *  돌려줌 skill_tree_data.js kitFromNodes 의 몫
 */
export function playerKit(tradition, learned, { test = false, upTo = null, nodes = null } = {}) {
  if (!TREE_SCHOOLS.includes(tradition)) return null;
  const ids = nodes ?? (upTo != null ? nodesUpToStage(tradition, upTo) : test ? allNodeIds(tradition) : learned?.[tradition] ?? new Set());
  return kitFromNodes(tradition, ids);
}
/** 개발 인자 `?skillNodes=` → 무기 유파의 칸 모음(없으면 null) — skill_tree_data.js nodesParam */
export const skillNodesParam = nodesParam;
/** 개발 인자 `?uniqueStage=N` → 옛 급 N (0~5 정수 — 0 = 칸 없음 · 2 = 보법 · 막기 · 5 = 모두) · 없거나 범위 밖이면 null (익힌 칸대로) */
export function stageParam(raw) {
  const n = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
}
/** 편지를 가진 유파 (카드 뽑기 — main.js drawCardIds): 테스트 경로 = 모두 */
export const playerLetters = ({ test = false } = {}) => (test ? new Set(TREE_SCHOOLS) : letterSchools(readLearned()));
