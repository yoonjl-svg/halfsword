// 인장 → 금화 (사장님 10/16 04:2x '이미 받은 인장은 인장마다 금화 *100으로 바꿔줘' — docs/import/lobby_fix_2026-10-16.md §6-4)
//  10/16 08:1x 사장님 '인장 제도 없애' — 인장은 이제 없다(얻지도 않고 알리지도 않고 아무것도 열지 않음). 이 파일은 이미 받은 인장을 한 번 금화로 바꾸는 일만 한다.
//  옛 인장 셈은 아래 얼린 상수(OLD_SEALS — 깬 무대 10 번마다 하나 · 25 개에서 끝, 지운 config.js UNIQUE_ASSIST.sealEvery·sealMax 와 같은 값)로 여기에만 둔다.
//  깬 수 = 저장된 통계 stillness.journeyClears.v1 (journey_save.js journeyClears).
//  바꾼 기록 = SEAL_COINS_KEY { version, converted: 금화로 바꾼 인장 수, at, notice } — 있으면 다시 바꾸지 않는다(새로 고침·어느 길로 와도 한 번).
//  바꾸는 때 = 이 판을 처음 연 때(main.js — 첫 화면 · 옛 메뉴 · 주소 판 어느 길이든, 테스트 경로만 빼고): 인장을 없앤 뒤에 깬 무대가 금화로 바뀌지 않게
//   대기실을 기다리지 않는다(10/16 — 확인표 1928). 알림('인장 N개를 금화 …으로 바꿨습니다.')은 그 뒤 처음 연 대기실이 한 번 띄운다(takeSealNotice — notice 표시).
//  10/16 04:5x 판이 남긴 기록(notice 칸 없음)은 이미 알림을 본 것으로 읽는다.
import { journeyClears } from './journey_save.js';
import { addCoins } from './lobby_progress.js';

export const SEAL_COINS_KEY = 'stillness.lobby.sealCoins.v1';
export const COINS_PER_SEAL = 100; // 사장님 결정 10/16 04:2x
/** 옛 인장 셈 (얼림 — 사장님 결정 10/13 22:3x · 23:1x 값 그대로): 깬 무대 clearsPerSeal 번마다 하나 · max 개에서 끝 */
export const OLD_SEALS = Object.freeze({ clearsPerSeal: 10, max: 25 });
/** 깬 수 → 그때까지 받았던 인장 수 */
export const sealCount = (clears) => Math.min(OLD_SEALS.max, Math.floor(Math.max(0, clears) / OLD_SEALS.clearsPerSeal));
let sessionRecord = null; // 저장이 막혔을 때 이번 실행 동안만 기억

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
 * 이미 받은 인장을 금화로 바꾼다 (오직 한 자리 · 한 번). 기록이 있으면 아무것도 안 한다 — 그 뒤에 깬 무대는 바꾸지 않는다.
 *  돌려줌 { seals: 이번에 바꾼 인장 수, coins: 더한 금화, first: 처음 바꿈이었나 } — 바꿀 것이 없으면 seals 0 (인장 0 이어도 첫 번에 기록은 남긴다)
 */
export function convertSeals({ clears = journeyClears(), storage = globalThis.localStorage, add = addCoins } = {}) {
  if (readRecord(storage)) return { seals: 0, coins: 0, first: false };
  const seals = sealCount(clears);
  writeRecord(storage, { version: 1, converted: seals, at: new Date().toISOString().slice(0, 10), notice: seals > 0 });
  const coins = seals * COINS_PER_SEAL;
  if (coins) add(coins);
  return { seals, coins, first: true };
}

/** 바꾼 알림 한 번 (대기실 — lobby.js): 아직 안 띄운 바꿈이 있으면 { seals, coins } 를 돌려주고 띄운 것으로 적는다 · 없으면 null */
export function takeSealNotice(storage = globalThis.localStorage) {
  const record = readRecord(storage);
  if (!record?.notice || !record.converted) return null;
  writeRecord(storage, { ...record, notice: false });
  return { seals: record.converted, coins: record.converted * COINS_PER_SEAL };
}
