// ─────────────────────────────────────────────────────────────
//  secret_free_off.mjs — 11/16 끝없는 비기 · 유파 대가 스위치를 모두 끈 판(11/15 판)으로 잠깐 (옛 장면 시험을 그때 판으로 묶을 때 — 기준은 그대로)
//   끄는 것: 고노센 SECRET.gnsFree · gnsCost · gnsDraw · AI 뽑기 읽기 AI_PLAN_JP.drawRead · 알티바슈 SECRET.altib.free · drop · speed ·
//   죽음의 일격 SECRET.mord.free · cost · guard · 리솔루토 SECRET.risolutoFree · risolutoCost · risolutoBack · 격살 기력 SECRET.gkFree.cost (기록 docs/strike/secret_free_2026-11-16.md)
//  withSecretFreeOff(fn) — fn 이 끝나면(던져도) 되돌림 · async fn 이면 기다림 · secretFreeOff() — 끄고 되돌리는 함수를 돌려줌
// ─────────────────────────────────────────────────────────────
import { SECRET, AI_PLAN_JP, JP_TANK } from '../../src/config.js';

export function secretFreeOff() {
  const A = SECRET.altib;
  const M = SECRET.mord;
  const keep = { gnsFree: SECRET.gnsFree, gnsCost: SECRET.gnsCost, gnsDraw: SECRET.gnsDraw, read: AI_PLAN_JP.drawRead, free: A.free, drop: A.drop, speed: A.speed, mFree: M.free, mCost: M.cost, mGuard: M.guard, rFree: SECRET.risolutoFree, rCost: SECRET.risolutoCost, rGuard: SECRET.risolutoBack };
  Object.assign(SECRET, { gnsFree: 0, gnsCost: null, gnsDraw: 0, risolutoFree: 0, risolutoCost: null, risolutoBack: 0 });
  Object.assign(A, { free: 0, drop: null, speed: 0 });
  const kin0 = M.kin;
  Object.assign(M, { free: 0, cost: null, guard: 0, kin: 0.35 }); // kin 0.35 = 11/15 판 빠르기 (11/16 사장님 '모르트슐라크 30%' 전)
  AI_PLAN_JP.drawRead = 0;
  const G = SECRET.gkFree;
  const gkCost0 = G?.cost;
  if (G) G.cost = null; // 격살 기력 = 공통 35 (11/16 '격살은 20' 전)
  return () => {
    if (G) G.cost = gkCost0;
    M.kin = kin0;
    Object.assign(SECRET, { gnsFree: keep.gnsFree, gnsCost: keep.gnsCost, gnsDraw: keep.gnsDraw, risolutoFree: keep.rFree, risolutoCost: keep.rCost, risolutoBack: keep.rGuard });
    Object.assign(A, { free: keep.free, drop: keep.drop, speed: keep.speed });
    Object.assign(M, { free: keep.mFree, cost: keep.mCost, guard: keep.mGuard });
    AI_PLAN_JP.drawRead = keep.read;
  };
}

export function withSecretFreeOff(fn) {
  const back = secretFreeOff();
  let r;
  try {
    r = fn();
  } catch (e) {
    back();
    throw e;
  }
  if (r && typeof r.then === 'function') return r.finally(back);
  back();
  return r;
}

/**
 * 11/16 일본 기다림과 침 스택 = 빠르기(JP_TANK.speed)를 끈 판(11/14 판 — 스택 공격력 each)으로 잠깐 (옛 스택 공격력 장면 시험을 그때 판으로 묶을 때 — 기준 그대로)
 */
export function withJpSpeedOff(fn) {
  const keep = JP_TANK.speed;
  JP_TANK.speed = 0;
  let r;
  try {
    r = fn();
  } catch (e) {
    JP_TANK.speed = keep;
    throw e;
  }
  if (r && typeof r.then === 'function') return r.finally(() => (JP_TANK.speed = keep));
  JP_TANK.speed = keep;
  return r;
}
