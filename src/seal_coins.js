// 인장 → 금화 (사장님 10/16 04:2x '이미 받은 인장은 인장마다 금화 *100으로 바꿔줘' — docs/import/lobby_fix_2026-10-16.md §6-4)
//  스킬북을 금화로 사게 되며(04:1x) 인장은 플레이어에게 아무것도 열지 않는다. 그래서 이미 받은 인장을 한 번만 금화로 바꾼다.
//  인장 셈은 본판 그대로(unique_assist.js sealCount — 깬 무대 10 번마다 하나 · 25 개에서 끝 · 저장 stillness.journeyClears.v1, 주소 ?clears= 덮어쓰기는 안 읽음).
//  바꾼 기록 = SEAL_COINS_KEY { version, converted: 금화로 바꾼 인장 수 } — 있으면 다시 바꾸지 않는다(새로 고침·처음부터/이어하기 어느 길로 대기실에 와도 한 번).
//  앞으로 받을 인장: 아직 정하지 않음(사장님 확인 전) → CONVERT_FUTURE_SEALS 하나로 — 켜면 바꾼 뒤 새로 받은 인장도 하나마다 금화 100 (= 깬 무대 10 번에 100).
//   지금은 꺼 둠: 기록이 생긴 뒤 받은 인장은 그대로 쌓이기만 한다(켜는 날 그동안 받은 것까지 바뀐다).
//  테스트 경로·주소 ?clears= 판에서는 바꾸지 않는다(부르는 쪽 — lobby.js · main.js).
import { sealCount, CLEAR_KEY } from './unique_assist.js';
import { addCoins } from './lobby_progress.js';

export const SEAL_COINS_KEY = 'stillness.lobby.sealCoins.v1';
export const COINS_PER_SEAL = 100; // 사장님 결정 10/16 04:2x
export const CONVERT_FUTURE_SEALS = false; // 앞으로 받을 인장도 금화로 — 사장님 확인 전 (감독이 여쭙는 중)
let sessionRecord = null; // 저장이 막혔을 때 이번 실행 동안만 기억

/** 저장된 깬 무대 수 (주소 ?clears= 덮어쓰기는 안 읽는다 — 시험 값으로 금화를 만들지 않게) */
export function storedClears(storage = globalThis.localStorage) {
  try {
    const n = Number(storage.getItem(CLEAR_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
function readRecord(storage) {
  try {
    const v = JSON.parse(storage.getItem(SEAL_COINS_KEY));
    if (v?.version === 1 && Number.isSafeInteger(v.converted) && v.converted >= 0) return v;
  } catch { /* 저장 막힘 */ }
  return sessionRecord;
}
function writeRecord(storage, record) {
  try { storage.setItem(SEAL_COINS_KEY, JSON.stringify(record)); return true; } catch { sessionRecord = record; return false; } // 저장이 막혔을 때만 이번 실행 동안 기억
}

/**
 * 인장을 금화로 바꾼다 (오직 한 자리). 처음 한 번 = 지금까지 받은 인장 모두 · 그 뒤엔 CONVERT_FUTURE_SEALS(future) 일 때만 새로 받은 몫.
 *  돌려줌 { seals: 이번에 바꾼 인장 수, coins: 더한 금화, first: 처음 바꿈이었나 } — 바꿀 것이 없으면 seals 0
 */
export function convertSeals({ clears = storedClears(), storage = globalThis.localStorage, future = CONVERT_FUTURE_SEALS, add = addCoins } = {}) {
  const have = sealCount(clears);
  const record = readRecord(storage);
  const first = !record;
  const from = first ? 0 : record.converted;
  const seals = first || future ? Math.max(0, have - from) : 0;
  if (first || seals) writeRecord(storage, { version: 1, converted: first || future ? Math.max(from, have) : from, at: first ? new Date().toISOString().slice(0, 10) : record.at });
  const coins = seals * COINS_PER_SEAL;
  if (coins) add(coins);
  return { seals, coins, first };
}
